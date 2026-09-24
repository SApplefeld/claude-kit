'use strict';

// The fleet memory block's judge: its constants against the ruled floors, the
// battery's question wording, the four situation sources, the selection rule,
// every stand-down with a fake client, the request body's three fields and
// nothing else of a record, the shown file's writes and omissions, and the
// planted key's absence from every artifact the block can write. The block
// runs in-process through memq.fleetMemoryBlock against a fake database and,
// for the key sweep, the real client against a stand-in server on 127.0.0.1.
// The home directory is a fixture for the whole file, so nothing here reads
// the operator's own ~/.claude.

const test = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('child_process');
const fs = require('fs');
const http = require('http');
const os = require('os');
const path = require('path');
const util = require('util');

const FIXTURE_HOME = fs.mkdtempSync(path.join(os.tmpdir(), 'jev-judge-home-'));
process.env.HOME = FIXTURE_HOME;
process.env.USERPROFILE = FIXTURE_HOME;
// The judged block reaches a host only from the machine's own store root, and
// the key is planted by the one test that needs it.
delete process.env.KIT_MEMORY_ROOT;
delete process.env.KIT_MEMORY_ROOT_ALLOW_DATA;
delete process.env.TYPESAFE_API_KEY;
delete process.env.CLAUDE_CODE_SESSION_ID;
process.on('exit', () => {
    try { fs.rmSync(FIXTURE_HOME, { recursive: true, force: true }); } catch { /* best effort */ }
});

const SCRIPTS = path.join(__dirname, '..', 'plugins', 'claude-kit', 'scripts');
const judge = require(path.join(SCRIPTS, 'jev-judge.js'));
const memq = require(path.join(SCRIPTS, 'memq.js'));
const dbClient = require(path.join(SCRIPTS, 'memory-database.js'));
const BATTERY = path.join(__dirname, '..', 'sidecar', 'batteries', 'jev-recognition-v1', 'run.js');

const SESSION_A = '11111111-2222-4333-8444-555555555555';
const SESSION_B = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';
const PLANTED_KEY = 'PLANTED-KEY-7f3a9c';

// ---------------------------------------------------------------- fixtures --

function tempDir(t, prefix) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
    t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
    return dir;
}

function fleetConfigFixture() {
    return {
        server: '127.0.0.1,1', database: 'KitMemoryTest', login: '', password: '',
        timeoutMs: 10000, windowsAuth: true, trustServerCertificate: false,
        embedding: { url: 'http://127.0.0.1:1', model: 'test-model' }
    };
}

// The database client's two boundaries answering out of a row list, on the
// shape memq.test.js's fleetDeps takes: the procedure and the limit each batch
// declares are recorded, and the nearest scan withholds retired rows as the
// host does.
function fleetDeps(rows, options) {
    const opts = options || {};
    const seen = { calls: [], texts: [], limits: [] };
    return {
        seen,
        deps: {
            runBatch: (cfg, batch) => {
                const procedure = /EXEC mem\.(\w+)/.exec(batch)[1];
                seen.calls.push(procedure);
                if (procedure === 'usp_Health') {
                    return opts.unreachable
                        ? { ok: false, cause: 'outage', detail: 'no host answered' }
                        : { ok: true, rows: [{ schemaVersion: Math.max(dbClient.SEARCH_SCHEMA_VERSION, dbClient.NEAREST_ARCHIVED_SCHEMA_VERSION) }] };
                }
                const limit = Number(/;DECLARE @Limit INT = (\d+)$/m.exec(batch)[1]);
                seen.limits.push(limit);
                const served = procedure === 'usp_Nearest' ? rows.filter((r) => r.archived !== true) : rows;
                return { ok: true, rows: [served.slice(0, limit)] };
            },
            embedBatch: async (cfg, texts) => {
                for (const x of texts) seen.texts.push(x);
                return { ok: true, vectors: texts.map(() => new Array(1024).fill(0.25)) };
            }
        }
    };
}

function row(name, extra) {
    return {
        name, fileKey: name + '.md', tier: 'operator', segment: null, sandbox: 'NEO-CLAUDE',
        visibility: 'shared', description: 'what ' + name + ' teaches', archived: false, distance: 0.2,
        ...(extra || {})
    };
}

function rows(n) {
    const out = [];
    for (let i = 0; i < n; i += 1) out.push(row('record-' + i, { distance: 0.01 * i }));
    return out;
}

// A fake client recording every call and answering through `handler`.
function fakeJev(handler) {
    const calls = [];
    return {
        calls,
        askJev: async (state, questions, timeoutMs, retryDelaysMs) => {
            calls.push({ state, questions, timeoutMs, retryDelaysMs });
            return handler(state, questions, calls.length);
        }
    };
}

// A handler scoring each candidate by name, 0.1 where the map names none.
function scoresByName(byName) {
    return (state, questions) => {
        const answers = {};
        for (const [id, q] of Object.entries(questions)) {
            const p = Object.hasOwn(byName, q.instructions.record_title) ? byName[q.instructions.record_title] : 0.1;
            answers[id] = { noul: p };
        }
        return { ok: true, answers, inputTokens: 10 };
    };
}

// A settable clock for the judge's budget edge.
function clock(startMs) {
    let at = startMs;
    return { now: () => at, advance: (ms) => { at += ms; } };
}

// The block, with the judge configured through an injected config read and
// the fake client, over a project directory of the case's own.
function blockOptions(t, fake, jev, extra) {
    const cwd = tempDir(t, 'jev-judge-proj-');
    const { deps, situation, ...rest } = extra || {};
    return {
        cwd,
        options: {
            config: fleetConfigFixture(),
            deps: { ...fake.deps, askJev: jev.askJev, loadJevConfig: () => ({ ok: true }), ...(deps || {}) },
            cwd,
            ...rest,
            // A case that passes no situation composes one from `cwd`; every
            // other case passes this fixed one.
            situation: Object.hasOwn(extra || {}, 'situation') ? situation : 'the session is fixing the fleet block'
        }
    };
}

function readShown(cwd) {
    return JSON.parse(fs.readFileSync(judge.shownFilePath(cwd), 'utf8'));
}

function nameOf(line) {
    return /^ {2}fleet {2}(\S+)/.exec(line)[1];
}

// ---------------------------------------------------------- the constants --

test('the two floors, the fetch limit and the budget edge are the judge\'s own and equal the ruled values', () => {
    // The ruled values as this test's own literals, never read from the plan
    // doc, which the archive moves.
    assert.equal(judge.FIRST_FLOOR, 0.70);
    assert.equal(judge.SECOND_FLOOR, 0.75);
    assert.equal(judge.FETCH_LIMIT, 30);
    assert.equal(judge.BUDGET_EDGE_MS, 1500);
    assert.equal(judge.RETRY_DELAY_MS, 200);
    // And none of them lives in the shared client, which holds no caller's
    // policy.
    const clientSource = fs.readFileSync(path.join(SCRIPTS, 'jev-client.js'), 'utf8');
    for (const name of ['FIRST_FLOOR', 'SECOND_FLOOR', 'FETCH_LIMIT', 'BUDGET_EDGE_MS']) {
        assert.ok(!clientSource.includes(name), 'the client carries no ' + name);
    }
});

test('the question and its criteria are the battery\'s literals verbatim, in the battery\'s instructions shape', () => {
    // The battery is a frozen fixture, so its literals are read out of its
    // source text and evaluated as the string expressions they are written as.
    const source = fs.readFileSync(BATTERY, 'utf8');
    const literal = (name) => {
        const m = new RegExp('const ' + name + ' = ([\\s\\S]*?);\\r?\\n').exec(source);
        assert.ok(m, 'the battery declares ' + name);
        return new Function('return ' + m[1])();
    };
    assert.equal(judge.QUESTION, literal('QUESTION'));
    assert.equal(judge.CRITERIA_TRUE, literal('CRITERIA_TRUE'));
    assert.equal(judge.CRITERIA_FALSE, literal('CRITERIA_FALSE'));
    for (const key of ['question: QUESTION', 'record_title: c.name', 'record_description: c.description', 'record_status: c.status']) {
        assert.ok(source.includes(key), 'the battery\'s question carries ' + key);
    }
    const questions = judge.questionsFor([{ rank: 1, name: 'n', description: 'd', status: 'live' }]);
    assert.deepEqual(questions, {
        c1: {
            type: 'noul',
            instructions: { question: judge.QUESTION, record_title: 'n', record_description: 'd', record_status: 'live' },
            criteria: { true: judge.CRITERIA_TRUE, false: judge.CRITERIA_FALSE }
        }
    });
});

// ----------------------------------------------------------- the selection --

test('selection: the top candidate at the first floor, every further one at the second, by score, capped', () => {
    const c = (name, rank, score) => ({ name, rank, score });
    // Below the first floor: nothing, whatever sits under it.
    assert.deepEqual(judge.selectShown([c('a', 1, 0.69), c('b', 2, 0.5)], 5), []);
    assert.deepEqual(judge.selectShown([], 5), []);
    // At the first floor the top shows alone; a second at 0.74 does not show
    // beside a higher top, at 0.75 it does.
    assert.deepEqual(judge.selectShown([c('a', 1, 0.70), c('b', 2, 0.5)], 5).map((x) => x.name), ['a']);
    assert.deepEqual(judge.selectShown([c('a', 1, 0.80), c('b', 2, 0.74)], 5).map((x) => x.name), ['a']);
    assert.deepEqual(judge.selectShown([c('a', 1, 0.80), c('b', 2, 0.75)], 5).map((x) => x.name), ['a', 'b']);
    // The order is the judge's, not the procedure's, and a tie keeps the
    // procedure's order.
    const ordered = judge.selectShown([c('low', 1, 0.76), c('high', 2, 0.9), c('tie', 3, 0.76), c('under', 4, 0.74)], 5);
    assert.deepEqual(ordered.map((x) => x.name), ['high', 'low', 'tie']);
    // The cap is the block's line limit.
    const many = [];
    for (let i = 0; i < 8; i += 1) many.push(c('r' + i, i + 1, 0.9 - i * 0.01));
    assert.equal(judge.selectShown(many, 5).length, 5);
});

// ------------------------------------------------------------- the client --

test('the judge passes its own time limit and one 200 ms retry, and reads a scored answer', async () => {
    const at = clock(1000);
    const jev = fakeJev(scoresByName({ a: 0.8, b: 0.2 }));
    at.advance(300);
    const out = await judge.judge('state', [
        { rank: 1, name: 'a', description: 'd', status: 'live' },
        { rank: 2, name: 'b', description: 'd', status: 'archived' }
    ], { deps: { askJev: jev.askJev, now: at.now }, startedMs: 1000 });
    assert.deepEqual(out, { ok: true, scores: [0.8, 0.2], inputTokens: 10 });
    assert.equal(jev.calls.length, 1);
    assert.equal(jev.calls[0].state, 'state');
    assert.equal(jev.calls[0].timeoutMs, judge.BUDGET_EDGE_MS - 300, 'what remains of the edge, measured from the block\'s start');
    assert.deepEqual(jev.calls[0].retryDelaysMs, [judge.RETRY_DELAY_MS]);
});

test('every stand-down: a thrown call, busy after the client\'s retry, the edge passed before and after the call, no key, and not configured', async () => {
    const one = [{ rank: 1, name: 'a', description: 'd', status: 'live' }];
    const run = (handler, advanceBefore, advanceDuring) => {
        const at = clock(0);
        at.advance(advanceBefore || 0);
        const jev = fakeJev((...args) => { at.advance(advanceDuring || 0); return handler(...args); });
        return judge.judge('s', one, { deps: { askJev: jev.askJev, now: at.now }, startedMs: 0 }).then((out) => ({ out, calls: jev.calls.length }));
    };
    const thrown = await run(() => { throw new Error('the fake throws with ' + PLANTED_KEY); });
    assert.equal(thrown.out.ok, false);
    assert.equal(thrown.out.reason, 'unreachable');
    assert.match(thrown.out.line, /The fleet judge was unavailable \(unreachable: the call failed\)/);
    assert.ok(!thrown.out.line.includes(PLANTED_KEY), 'no runtime message rides in the line');

    const busy = await run(() => ({ ok: false, reason: 'busy', detail: 'retry policy spent' }));
    assert.equal(busy.out.reason, 'busy');
    assert.match(busy.out.line, /unavailable \(busy: retry policy spent\)/);

    const before = await run(scoresByName({ a: 0.9 }), judge.BUDGET_EDGE_MS);
    assert.equal(before.out.reason, 'timeout');
    assert.equal(before.calls, 0, 'past the edge the judge is not even asked');
    assert.match(before.out.line, /unavailable \(timeout/);

    const during = await run(scoresByName({ a: 0.9 }), 100, judge.BUDGET_EDGE_MS);
    assert.equal(during.out.reason, 'timeout', 'an answer that lands past the edge is not read');
    assert.equal(during.calls, 1);

    const noKey = await run(() => ({ ok: false, reason: 'no key' }));
    assert.equal(noKey.out.reason, 'no key');
    assert.match(noKey.out.line, /TYPESAFE_API_KEY is not set/);

    const unconfigured = await run(() => ({ ok: false, reason: 'not configured' }));
    assert.equal(unconfigured.out.reason, 'not configured');
    assert.equal(unconfigured.out.line, null, 'no line for a machine with no config');

    const junk = await run(() => ({ ok: true, answers: { c1: { noul: 'high' } } }));
    assert.equal(junk.out.reason, 'unusable answer');
});

test('only an absent Jev config is unconfigured: a present one that cannot be used stands the judge down with the client\'s reason', async (t) => {
    const loads = (config) => ({ loadJevConfig: () => config });
    assert.equal(judge.judgeConfigured(loads({ ok: false, reason: 'absent' })), false);
    for (const reason of ['unreadable', 'malformed', 'invalid']) {
        assert.equal(judge.judgeConfigured(loads({ ok: false, reason, detail: 'x' })), true, reason);
    }
    assert.equal(judge.judgeConfigured(loads({ ok: true, endpoint: 'https://example.test', model: 'm' })), true);

    // The real config read and the real client, over a config the client
    // refuses before it reads the key or opens a socket (cleartext to a host
    // that is not loopback).
    fs.mkdirSync(path.join(FIXTURE_HOME, '.claude'), { recursive: true });
    const configFile = path.join(FIXTURE_HOME, '.claude', 'kit-jev.json');
    fs.writeFileSync(configFile, JSON.stringify({ endpoint: 'http://example.test', model: 'jev-test' }), 'utf8');
    t.after(() => fs.rmSync(configFile, { force: true }));
    const fake = fleetDeps(rows(3));
    const cwd = tempDir(t, 'jev-judge-invalid-');
    const block = await memq.fleetMemoryBlock(os.tmpdir(), 5,
        { config: fleetConfigFixture(), deps: fake.deps, cwd, sessionId: SESSION_A, situation: 'a situation' });
    assert.deepEqual(fake.seen.calls, ['usp_Health', 'usp_Search'], 'the judged path ran');
    assert.equal(block.judged, false);
    assert.match(block.note, /^The fleet judge was unavailable \(config unusable: config invalid\)/);
    assert.deepEqual(block.lines.map(nameOf), ['record-0', 'record-1', 'record-2'], 'the vector list');
    assert.ok(!fs.existsSync(judge.shownFilePath(cwd)), 'a stand-down records nothing');

    // The control: with the file gone the block is the one it was before the
    // judge, the nearest scan with no line about a judge.
    fs.rmSync(configFile, { force: true });
    const plain = fleetDeps(rows(3));
    const memDir = tempDir(t, 'jev-judge-absent-');
    fs.writeFileSync(path.join(memDir, 'outcomes.jsonl'),
        JSON.stringify({ ts: '2026-09-17T00:00:00.000Z', key: 'newest.key', outcome: 'pass', summary: 'y' }) + '\n', 'utf8');
    const before = await memq.fleetMemoryBlock(memDir, 5, { config: fleetConfigFixture(), deps: plain.deps });
    assert.deepEqual(plain.seen.calls, ['usp_Health', 'usp_Nearest']);
    assert.equal(before.note, null);
});

// ----------------------------------------------------------- the composer --

const PLAN = [
    '# Alpha plan', '', 'Status: In Progress', 'Commit Model: Branch-and-PR', '',
    '## Goal', '', 'GOALMARK the goal sentence.', '',
    '## Intent', '', 'INTENTMARK the intent.', '',
    '## Sections of Work', '',
    '### 1. First section', '', 'S1MARK body.', '',
    '### 2. Second section', '', 'S2MARK body.', '', '```', '### 9. FENCEDMARK a heading inside a fence', '```', '', 'More of S2MARK.', '',
    '### 3. Third section', '', 'S3MARK body.', '',
    '## Chapters', '',
    '### Chapter 1 - 2026-09-23', 'Completed: 1. First section', 'Next: 2. Second section', 'CHAPMARK', ''
].join('\n');

function writePlan(cwd, name, text) {
    const dir = path.join(cwd, 'docs', 'plans');
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, name), text, 'utf8');
}

test('source 1: the in-progress plan\'s Goal, Intent and the section its latest Chapter names, with no model call', (t) => {
    const cwd = tempDir(t, 'jev-judge-plan-');
    writePlan(cwd, 'alpha_spec_v1.md', PLAN);
    writePlan(cwd, 'parked_spec_v1.md', PLAN.replace('Status: In Progress', 'Status: Ready').replace('GOALMARK', 'PARKEDMARK'));
    const state = judge.composeSituation(cwd, { source: 'startup' });
    assert.match(state, /^Plan: Alpha plan\n/);
    for (const mark of ['GOALMARK', 'INTENTMARK', 'S2MARK body.', 'FENCEDMARK', 'More of S2MARK.']) {
        assert.ok(state.includes(mark), 'the state carries ' + mark + ':\n' + state);
    }
    for (const mark of ['S1MARK', 'S3MARK', 'CHAPMARK', 'PARKEDMARK']) {
        assert.ok(!state.includes(mark), 'the state does not carry ' + mark + ':\n' + state);
    }
    assert.ok(!state.includes('Operator\'s last message'), 'a startup carries no message');

    // A Next line naming no section leaves the Goal and Intent alone.
    writePlan(cwd, 'alpha_spec_v1.md', PLAN.replace('Next: 2. Second section', 'Next: finishing-work'));
    const alone = judge.composeSituation(cwd, { source: 'startup' });
    assert.ok(alone.includes('GOALMARK') && alone.includes('INTENTMARK'));
    assert.ok(!alone.includes('Next section:'), alone);

    // Two in progress: the armed goal's plan wins over the newer one.
    writePlan(cwd, 'alpha_spec_v1.md', PLAN);
    writePlan(cwd, 'beta_spec_v1.md', PLAN.replace('# Alpha plan', '# Beta plan').replace('GOALMARK', 'BETAMARK'));
    const old = new Date(Date.now() - 3600000);
    fs.utimesSync(path.join(cwd, 'docs', 'plans', 'alpha_spec_v1.md'), old, old);
    assert.match(judge.composeSituation(cwd, {}), /^Plan: Beta plan/, 'the most recently modified without a goal');
    fs.mkdirSync(path.join(cwd, '.kit'), { recursive: true });
    fs.writeFileSync(path.join(cwd, '.kit', 'goal-state.json'), JSON.stringify({ plan: 'docs/plans/alpha_spec_v1.md' }), 'utf8');
    assert.match(judge.composeSituation(cwd, {}), /^Plan: Alpha plan/, 'the armed plan with one');
});

test('source 2: a resume or compaction adds the operator\'s last message from the transcript\'s tail', (t) => {
    const cwd = tempDir(t, 'jev-judge-resume-');
    writePlan(cwd, 'alpha_spec_v1.md', PLAN);
    const transcript = path.join(cwd, 'session.jsonl');
    const line = (o) => JSON.stringify(o);
    fs.writeFileSync(transcript, [
        line({ type: 'user', message: { role: 'user', content: 'OLDMSG do the first thing' } }),
        line({ type: 'assistant', message: { role: 'assistant', content: [{ type: 'text', text: 'ASSISTANTMSG' }] } }),
        line({ type: 'user', message: { role: 'user', content: [{ type: 'text', text: 'NEWMSG the last human turn' }] } }),
        line({ type: 'user', message: { role: 'user', content: [{ type: 'tool_result', tool_use_id: 'x', content: 'TOOLMSG' }] } }),
        line({ type: 'user', isMeta: true, message: { role: 'user', content: 'METAMSG a skill body' } }),
        line({ type: 'assistant', message: { role: 'assistant', content: [{ type: 'text', text: 'done' }] } })
    ].join('\n') + '\n', 'utf8');
    for (const source of ['resume', 'compact']) {
        const state = judge.composeSituation(cwd, { source, transcriptPath: transcript });
        assert.match(state, /\n\nOperator's last message: NEWMSG the last human turn(\n\n|$)/, source + ':\n' + state);
        // The message rides right after the Goal, ahead of the long parts, so
        // the search's head carries it however long they run.
        const at = state.indexOf('Operator\'s last message');
        assert.ok(state.indexOf('Goal: ') < at, source + ': the message follows the Goal');
        for (const part of ['Intent: ', 'Next section: ']) {
            assert.ok(state.includes(part), source + ': the fixture plan carries ' + part);
            assert.ok(at < state.indexOf(part), source + ': the message precedes ' + part);
        }
        for (const mark of ['OLDMSG', 'TOOLMSG', 'METAMSG', 'ASSISTANTMSG']) {
            assert.ok(!state.includes(mark), source + ' does not carry ' + mark);
        }
    }
    const startup = judge.composeSituation(cwd, { source: 'startup', transcriptPath: transcript });
    assert.ok(!startup.includes('NEWMSG'), 'a startup reads no transcript');
    const absent = judge.composeSituation(cwd, { source: 'resume', transcriptPath: path.join(cwd, 'missing.jsonl') });
    assert.ok(!absent.includes('Operator'), 'an absent transcript omits the message');
    assert.ok(absent.includes('GOALMARK'), 'and the plan still rides');
});

test('source 2: a slash command\'s invocation record and its stdout echo are not the operator\'s message', (t) => {
    const cwd = tempDir(t, 'jev-judge-command-');
    writePlan(cwd, 'alpha_spec_v1.md', PLAN);
    const transcript = path.join(cwd, 'session.jsonl');
    const line = (o) => JSON.stringify(o);
    // The shape a typed /compact leaves: the invocation record as one user
    // line and the command's stdout echoed back as the next, both newer than
    // the operator's last typed turn.
    fs.writeFileSync(transcript, [
        line({ type: 'user', message: { role: 'user', content: 'TYPEDMARK the real typed turn' } }),
        line({ type: 'assistant', message: { role: 'assistant', content: [{ type: 'text', text: 'ok' }] } }),
        line({ type: 'user', message: { role: 'user', content: '<command-name>/compact</command-name>\n<command-message>compact</command-message>\n<command-args></command-args>' } }),
        line({ type: 'user', message: { role: 'user', content: '<local-command-stdout>STDOUTMARK Compacted</local-command-stdout>' } })
    ].join('\n') + '\n', 'utf8');
    const state = judge.composeSituation(cwd, { source: 'compact', transcriptPath: transcript });
    assert.match(state, /\n\nOperator's last message: TYPEDMARK the real typed turn(\n\n|$)/, state);
    for (const mark of ['STDOUTMARK', 'command-name', 'command-args']) {
        assert.ok(!state.includes(mark), 'the state does not carry ' + mark + ':\n' + state);
    }
    // A typed turn carrying an echo beside it keeps the typed text alone.
    fs.appendFileSync(transcript, line({ type: 'user', message: { role: 'user', content: [
        { type: 'text', text: 'MIXEDMARK typed words' },
        { type: 'text', text: '<local-command-stdout>ECHOMARK</local-command-stdout>' }
    ] } }) + '\n', 'utf8');
    const mixed = judge.composeSituation(cwd, { source: 'resume', transcriptPath: transcript });
    assert.match(mixed, /\n\nOperator's last message: MIXEDMARK typed words(\n\n|$)/, mixed);
    assert.ok(!mixed.includes('ECHOMARK'), mixed);
});

test('the transcript\'s kind and size come off the open descriptor, never a stat of the name', (t) => {
    const cwd = tempDir(t, 'jev-judge-fstat-');
    const transcript = path.join(cwd, 'session.jsonl');
    fs.writeFileSync(transcript, JSON.stringify({ type: 'user', message: { role: 'user', content: 'FSTATMARK typed' } }) + '\n', 'utf8');
    const statted = [];
    const realStat = fs.statSync;
    fs.statSync = (p, ...rest) => { statted.push(String(p)); return realStat.call(fs, p, ...rest); };
    let message;
    try {
        message = judge.lastOperatorMessage(transcript);
    } finally {
        fs.statSync = realStat;
    }
    assert.equal(message, 'FSTATMARK typed');
    assert.deepEqual(statted.filter((p) => p === transcript), [], 'no stat of the transcript\'s name');
});

test('source 3: with no plan in progress the branch name and the last three commit titles stand in', (t) => {
    const cwd = tempDir(t, 'jev-judge-git-');
    const git = (...args) => {
        const r = spawnSync('git', ['-C', cwd, '-c', 'user.name=t', '-c', 'user.email=t@example.test',
            '-c', 'commit.gpgsign=false', ...args], { encoding: 'utf8', env: { ...process.env, GIT_TERMINAL_PROMPT: '0' } });
        assert.equal(r.status, 0, args.join(' ') + ': ' + r.stderr);
    };
    git('init', '-q', '-b', 'feat/judge-branch');
    for (const title of ['FOURTHMARK oldest', 'THIRDMARK', 'SECONDMARK', 'FIRSTMARK newest']) {
        git('commit', '-q', '--allow-empty', '-m', title);
    }
    const state = judge.composeSituation(cwd, { source: 'startup' });
    assert.match(state, /^Branch: feat\/judge-branch\n/);
    assert.match(state, /Recent commits:\n- FIRSTMARK newest\n- SECONDMARK\n- THIRDMARK$/);
    assert.ok(!state.includes('FOURTHMARK'), 'three titles, not four');

    // No repository and no plan composes nothing, so the block asks nothing.
    const bare = tempDir(t, 'jev-judge-bare-');
    assert.equal(judge.composeSituation(bare, {}), '');
});

test('source 3\'s two git calls are held to 500 ms, and the log never reaches a repository\'s signature program', (t) => {
    const cwd = tempDir(t, 'jev-judge-sig-');
    const git = (...args) => {
        const r = spawnSync('git', ['-C', cwd, ...args], { encoding: 'utf8', env: { ...process.env, GIT_TERMINAL_PROMPT: '0' } });
        assert.equal(r.status, 0, args.join(' ') + ': ' + r.stderr);
        return r.stdout.trim();
    };
    git('init', '-q', '-b', 'feat/sig-branch');
    git('-c', 'user.name=t', '-c', 'user.email=t@example.test', '-c', 'commit.gpgsign=false', 'commit', '-q', '--allow-empty', '-m', 'BASEMARK');
    // A commit object carrying a signature header, so a log that shows
    // signatures hands it to gpg.program to verify.
    const commit = [
        'tree ' + git('rev-parse', 'HEAD^{tree}'), 'parent ' + git('rev-parse', 'HEAD'),
        'author t <t@example.test> 1700000000 +0000', 'committer t <t@example.test> 1700000000 +0000',
        'gpgsig -----BEGIN PGP SIGNATURE-----', ' ', ' AAAA', ' -----END PGP SIGNATURE-----', '', 'SIGNEDMARK', ''
    ].join('\n');
    const objectFile = path.join(cwd, '.git', 'signed-commit.txt');
    fs.writeFileSync(objectFile, commit, 'utf8');
    git('update-ref', 'HEAD', git('hash-object', '-t', 'commit', '-w', objectFile));
    // The repository's own signature program, which records that it ran.
    const marker = path.join(cwd, '.git', 'gpg-ran');
    const program = path.join(cwd, '.git', 'fake-gpg.sh');
    fs.writeFileSync(program, '#!/bin/sh\necho ran > "' + marker.replace(/\\/g, '/') + '"\nexit 1\n', 'utf8');
    fs.chmodSync(program, 0o755);
    git('config', 'gpg.program', program.replace(/\\/g, '/'));
    git('config', 'log.showSignature', 'true');

    const gitLib = require(path.join(SCRIPTS, '..', 'hooks', 'kit-git-lib.js'));
    const calls = [];
    const realOutput = gitLib.gitOutput;
    gitLib.gitOutput = (dir, args, options) => { calls.push({ args, options }); return realOutput(dir, args, options); };
    let state;
    try {
        state = judge.composeSituation(cwd, {});
    } finally {
        gitLib.gitOutput = realOutput;
    }
    assert.match(state, /Recent commits:\n- SIGNEDMARK\n- BASEMARK$/, state);
    assert.equal(calls.length, 2);
    for (const call of calls) assert.deepEqual(call.options, { timeoutMs: 500 }, call.args.join(' '));
    assert.ok(!fs.existsSync(marker), 'the log did not run the repository\'s gpg.program');

    // The control, withheld from the composer: the same log without the flag
    // runs the program, so the silence above is the flag's.
    spawnSync('git', ['-C', cwd, 'log', '-3', '--format=%s'], { encoding: 'utf8' });
    assert.ok(fs.existsSync(marker), 'a plain log in this repository runs gpg.program');
});

test('the judge reads the composed situation whole: a long section and a long Intent both ride uncut', () => {
    const parts = judge.planParts(PLAN);
    const long = (mark, n) => (mark + ' ').repeat(n);
    // Parts running to 22,000 characters, so the test pins that no part is cut
    // at these lengths.
    parts.goal = [long('GOALMARK', 200)];
    parts.intent = [long('INTENTMARK', 2000)];
    parts.sections[1].lines = ['### 2. Second section', long('S2MARK', 2000)];
    const state = judge.assembleState(parts, null);
    assert.ok(state.length > 20000, 'the parts run long: ' + state.length);
    assert.ok(state.includes(parts.goal[0].trim()), 'the Goal rides whole');
    assert.ok(state.includes(parts.intent[0].trim()), 'the Intent rides whole');
    assert.ok(state.endsWith(parts.sections[1].lines[1].trim()), 'the section rides whole, to its own end');
});

test('the operator\'s last message rides whole into the situation at 1,500 characters', (t) => {
    const cwd = tempDir(t, 'jev-judge-longmsg-');
    writePlan(cwd, 'alpha_spec_v1.md', PLAN);
    const transcript = path.join(cwd, 'session.jsonl');
    const longMessage = 'LONGMARK ' + 'x'.repeat(1500) + ' LONGMARK-END';
    fs.writeFileSync(transcript, JSON.stringify({
        type: 'user', message: { role: 'user', content: [{ type: 'text', text: longMessage }] }
    }) + '\n', 'utf8');
    const state = judge.composeSituation(cwd, { source: 'resume', transcriptPath: transcript });
    assert.ok(state.includes(longMessage), 'the message rides whole:\n' + state);
});

// ---------------------------------------------------------------- the block --

test('with the judge configured stage 1 is usp_Search at thirty, each row\'s status rides, and the situation is the query and the state', async (t) => {
    const fake = fleetDeps([row('live-one'), row('retired-one', { archived: true, distance: 0.3 })]);
    const jev = fakeJev(scoresByName({ 'live-one': 0.9, 'retired-one': 0.8 }));
    const { options } = blockOptions(t, fake, jev, { situation: 'STATEMARK what the session is doing' });
    const block = await memq.fleetMemoryBlock(os.tmpdir(), 5, options);
    assert.deepEqual(fake.seen.calls, ['usp_Health', 'usp_Search']);
    assert.deepEqual(fake.seen.limits, [judge.FETCH_LIMIT]);
    assert.deepEqual(fake.seen.texts, ['STATEMARK what the session is doing'], 'the situation is what stage 1 embeds');
    assert.equal(jev.calls[0].state, 'STATEMARK what the session is doing', 'and what the judge reads');
    const q = jev.calls[0].questions;
    assert.deepEqual(Object.keys(q), ['c1', 'c2']);
    assert.equal(q.c1.instructions.record_status, 'live');
    assert.equal(q.c2.instructions.record_status, 'archived');
    assert.equal(block.reason, null);
    assert.equal(block.judged, true);
    assert.deepEqual(block.lines.map(nameOf), ['live-one', 'retired-one']);
    assert.match(block.lines[1], /retired/, 'a retired record the judge chose is labelled as retired');

    // The control: the same rows with no Jev config take the block as it was,
    // the nearest scan at the caller's limit over the project's own keys.
    const plain = fleetDeps([row('live-one')]);
    const memDir = tempDir(t, 'jev-judge-mem-');
    fs.writeFileSync(path.join(memDir, 'outcomes.jsonl'),
        JSON.stringify({ ts: '2026-09-17T00:00:00.000Z', key: 'newest.key', outcome: 'pass', summary: 'y' }) + '\n', 'utf8');
    const before = await memq.fleetMemoryBlock(memDir, 5,
        { config: fleetConfigFixture(), deps: { ...plain.deps, loadJevConfig: () => ({ ok: false, reason: 'absent' }) } });
    assert.deepEqual(plain.seen.calls, ['usp_Health', 'usp_Nearest']);
    assert.deepEqual(plain.seen.limits, [5]);
    assert.match(plain.seen.texts[0], /newest\.key/);
    assert.deepEqual(before, { lines: ['  fleet  live-one  (operator)  sandbox:NEO-CLAUDE  what live-one teaches'], reason: null, note: null, judged: false });
});

test('a request carries each record\'s name, description and status and nothing else of the record', async (t) => {
    // A record with frontmatter and a body, and its search row carrying every
    // field the host returns. Only three of them may reach the wire.
    const memDir = tempDir(t, 'jev-judge-record-');
    fs.writeFileSync(path.join(memDir, 'the-record.md'),
        '---\ndescription: DESCMARK what it teaches\ntags: [TAGMARK]\nanchors: ANCHORMARK.js@abc\n---\n# the-record\n\nBODYMARK the body never leaves the LAN.\n', 'utf8');
    const fake = fleetDeps([{
        name: 'the-record', fileKey: 'FILEKEYMARK.md', tier: 'project', segment: 'SEGMENTMARK',
        sandbox: 'SANDBOXMARK', visibility: 'VISMARK', description: 'DESCMARK what it teaches',
        archived: false, distance: 0.2, descriptionRank: 1, bodyRank: 2
    }]);
    const jev = fakeJev(scoresByName({ 'the-record': 0.9 }));
    const { options } = blockOptions(t, fake, jev);
    await memq.fleetMemoryBlock(memDir, 5, options);
    const body = JSON.stringify({ state: jev.calls[0].state, questions: jev.calls[0].questions });
    assert.deepEqual(Object.keys(jev.calls[0].questions.c1.instructions).sort(),
        ['question', 'record_description', 'record_status', 'record_title']);
    assert.ok(body.includes('the-record') && body.includes('DESCMARK'), 'the name and description ride');
    for (const mark of ['BODYMARK', 'TAGMARK', 'ANCHORMARK', 'FILEKEYMARK', 'SEGMENTMARK', 'SANDBOXMARK', 'VISMARK', '0.2']) {
        assert.ok(!body.includes(mark), 'nothing else rides: ' + mark);
    }
});

test('the judged block shows the judge\'s selection in its order and records every judged candidate under the session id', async (t) => {
    const fake = fleetDeps(rows(8));
    const jev = fakeJev(scoresByName({ 'record-5': 0.95, 'record-1': 0.8, 'record-7': 0.76, 'record-0': 0.74 }));
    const { cwd, options } = blockOptions(t, fake, jev, { sessionId: SESSION_A });
    const block = await memq.fleetMemoryBlock(os.tmpdir(), 5, options);
    assert.deepEqual(block.lines.map(nameOf), ['record-5', 'record-1', 'record-7'], 'by score; 0.74 is under the second floor');
    assert.equal(block.note, null);

    const file = judge.shownFilePath(cwd);
    assert.equal(file, path.join(cwd, '.kit', 'jev-shown.json'), 'under the project\'s scratch directory');
    const entries = readShown(cwd);
    assert.equal(entries.length, 8, 'one entry per judged candidate, shown or not');
    const byName = new Map(entries.map((e) => [e.name, e]));
    assert.deepEqual(Object.keys(byName.get('record-5')).sort(),
        ['marked', 'name', 'rank', 'recognitionId', 'score', 'session', 'shown', 'time']);
    assert.equal(byName.get('record-5').session, SESSION_A);
    assert.equal(byName.get('record-5').score, 0.95);
    assert.equal(byName.get('record-5').rank, 6, 'the stage-1 rank, 1-based in the procedure\'s order');
    assert.equal(byName.get('record-5').shown, true);
    assert.equal(byName.get('record-0').shown, false);
    assert.equal(byName.get('record-0').marked, null);
    assert.match(byName.get('record-0').time, /^\d{4}-\d{2}-\d{2}T/);
    assert.equal(new Set(entries.map((e) => e.recognitionId)).size, 8, 'a fresh recognition id per entry');

    // A second write appends rather than replaces.
    await memq.fleetMemoryBlock(os.tmpdir(), 5, { ...options, sessionId: SESSION_B });
    const again = readShown(cwd);
    assert.equal(again.length, 16);
    assert.equal(again.filter((e) => e.session === SESSION_A).length, 8, 'the first session\'s entries stay');
    assert.equal(again.filter((e) => e.session === SESSION_B).length, 8);
});

// A shown entry as shownEntries writes one, at `time`.
function plantedEntry(session, name, time, extra) {
    return {
        session, name, recognitionId: require('crypto').randomUUID(), score: 0.8, rank: 2,
        shown: true, time, marked: null, ...(extra || {})
    };
}

function daysAgo(days) {
    return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
}

function journalRows(cwd) {
    const file = path.join(memq.projectMemoryDir(cwd), 'outcomes.jsonl');
    return fs.existsSync(file)
        ? fs.readFileSync(file, 'utf8').split('\n').filter((l) => l !== '').map((l) => JSON.parse(l))
        : [];
}

test('the judged block\'s append sweeps stale entries, keying a stale shown unmarked one as unread, and leaves a peer\'s young entry', async (t) => {
    const fake = fleetDeps(rows(3));
    const jev = fakeJev(scoresByName({ 'record-0': 0.9 }));
    const { cwd, options } = blockOptions(t, fake, jev, { sessionId: SESSION_A });
    const stale = plantedEntry(SESSION_B, 'a-stale-record', daysAgo(8), { score: 0.72, rank: 4 });
    const young = plantedEntry(SESSION_B, 'a-young-record', daysAgo(6));
    const staleRead = plantedEntry(SESSION_B, 'a-stale-read-record', daysAgo(8), { marked: daysAgo(8) });
    const undated = plantedEntry(SESSION_B, 'an-undated-record', 'not a time');
    fs.mkdirSync(path.dirname(judge.shownFilePath(cwd)), { recursive: true });
    fs.writeFileSync(judge.shownFilePath(cwd),
        JSON.stringify([stale, young, { session: SESSION_B }, staleRead, undated]) + '\n', 'utf8');

    const block = await memq.fleetMemoryBlock(os.tmpdir(), 5, options);
    assert.deepEqual(block.lines.map(nameOf), ['record-0']);
    assert.equal(block.note, null);
    const rowsWritten = journalRows(cwd);
    assert.equal(rowsWritten.length, 1, JSON.stringify(rowsWritten));
    assert.equal(rowsWritten[0].key, 'kit.jev.pointer');
    assert.equal(rowsWritten[0].outcome, 'fail');
    assert.equal(rowsWritten[0].summary, 'a-stale-record');
    assert.equal(rowsWritten[0].recognitionId, stale.recognitionId);
    assert.equal(rowsWritten[0].score, 0.72);
    assert.equal(rowsWritten[0].rank, 4);
    const after = readShown(cwd);
    assert.deepEqual(after[0], young, 'the young peer entry stays, first, as it was');
    assert.deepEqual(after.slice(1).map((e) => [e.session, e.name]),
        [[SESSION_A, 'record-0'], [SESSION_A, 'record-1'], [SESSION_A, 'record-2']],
        'the block\'s own entries follow it, and every stale entry is gone');
});

test('the judged block\'s append keeps a stale entry the journal will not key, and still records its own', async (t) => {
    const fake = fleetDeps(rows(3));
    const jev = fakeJev(scoresByName({ 'record-0': 0.9 }));
    const { cwd, options } = blockOptions(t, fake, jev, { sessionId: SESSION_A });
    fs.mkdirSync(path.join(memq.projectMemoryDir(cwd), 'outcomes.jsonl'), { recursive: true });
    t.after(() => fs.rmSync(memq.projectMemoryDir(cwd), { recursive: true, force: true }));
    fs.mkdirSync(path.dirname(judge.shownFilePath(cwd)), { recursive: true });
    fs.writeFileSync(judge.shownFilePath(cwd),
        JSON.stringify([plantedEntry(SESSION_B, 'a-stale-record', daysAgo(8))]) + '\n', 'utf8');
    const block = await memq.fleetMemoryBlock(os.tmpdir(), 5, options);
    assert.deepEqual(block.lines.map(nameOf), ['record-0'], 'the block still renders');
    assert.equal(block.note, null, 'the block\'s own record was written');
    assert.deepEqual(readShown(cwd).map((e) => [e.session, e.name]),
        [[SESSION_B, 'a-stale-record'], [SESSION_A, 'record-0'], [SESSION_A, 'record-1'], [SESSION_A, 'record-2']],
        'the stale entry stays rather than leaving unrecorded, and the block\'s own entries follow it');
});

test('nothing is written where the shell carries no session id, where it is not id-shaped, or where the block fell back', async (t) => {
    const fake = fleetDeps(rows(3));
    const scored = () => fakeJev(scoresByName({ 'record-0': 0.9 }));
    for (const sessionId of [undefined, '', 'not-a-session-id', 'x'.repeat(36)]) {
        const { cwd, options } = blockOptions(t, fake, scored(), { sessionId });
        const block = await memq.fleetMemoryBlock(os.tmpdir(), 5, options);
        assert.deepEqual(block.lines.map(nameOf), ['record-0'], 'the block still judges and renders');
        assert.ok(!fs.existsSync(judge.shownFilePath(cwd)), 'no file for ' + JSON.stringify(sessionId));
    }
    const failing = fakeJev(() => ({ ok: false, reason: 'busy', detail: 'retry policy spent' }));
    const { cwd, options } = blockOptions(t, fake, failing, { sessionId: SESSION_A });
    const block = await memq.fleetMemoryBlock(os.tmpdir(), 5, options);
    assert.equal(block.judged, false);
    assert.ok(!fs.existsSync(judge.shownFilePath(cwd)), 'a fallback records nothing');

    // The control, withheld from every assertion above: the same fixture with
    // a shaped id and a judged answer does write.
    const control = blockOptions(t, fake, scored(), { sessionId: SESSION_A });
    await memq.fleetMemoryBlock(os.tmpdir(), 5, control.options);
    assert.ok(fs.existsSync(judge.shownFilePath(control.cwd)));
});

test('a judged block whose record could not be written says so in its note, and one with no session id says nothing', async (t) => {
    const fake = fleetDeps(rows(3));
    const holdLock = (cwd) => {
        fs.mkdirSync(path.dirname(judge.shownFilePath(cwd)), { recursive: true });
        fs.writeFileSync(judge.shownFilePath(cwd) + '.lock',
            JSON.stringify({ pid: 0, token: 'peer', ts: new Date().toISOString() }) + '\n', 'utf8');
    };
    const shown = blockOptions(t, fake, fakeJev(scoresByName({ 'record-0': 0.9 })), { sessionId: SESSION_A });
    holdLock(shown.cwd);
    const block = await memq.fleetMemoryBlock(os.tmpdir(), 5, shown.options);
    assert.deepEqual(block.lines.map(nameOf), ['record-0']);
    assert.equal(block.judged, true);
    assert.match(block.note, /^[^.]*\(lock held\)\.$/, 'one sentence naming the omission: ' + block.note);

    // The judged no-record line keeps its place, with the omission after it.
    const none = blockOptions(t, fake, fakeJev(scoresByName({})), { sessionId: SESSION_A });
    holdLock(none.cwd);
    const empty = await memq.fleetMemoryBlock(os.tmpdir(), 5, none.options);
    assert.deepEqual(empty.lines, []);
    assert.ok(empty.note.startsWith(judge.NO_RECORD_LINE + ' '), empty.note);
    assert.match(empty.note, /\(lock held\)\.$/);

    // No session id is the designed silence, not a failed record.
    const anonymous = blockOptions(t, fake, fakeJev(scoresByName({ 'record-0': 0.9 })), {});
    const quiet = await memq.fleetMemoryBlock(os.tmpdir(), 5, anonymous.options);
    assert.equal(quiet.note, null);
});

test('the shown file is appended under the lock, and a held lock or a foreign file is a named omission that touches nothing', (t) => {
    const cwd = tempDir(t, 'jev-judge-shown-');
    const entry = (name) => ({ session: SESSION_A, name, recognitionId: name, score: 0.9, rank: 1, shown: true, time: 't', marked: null });
    assert.deepEqual(judge.appendShown(cwd, SESSION_A, [entry('one')]), { ok: true });
    assert.deepEqual(judge.appendShown(cwd, SESSION_A, [entry('two')]), { ok: true });
    assert.deepEqual(readShown(cwd).map((e) => e.name), ['one', 'two']);
    assert.ok(!fs.existsSync(judge.shownFilePath(cwd) + '.lock'), 'the lock is released');

    const lockPath = judge.shownFilePath(cwd) + '.lock';
    fs.writeFileSync(lockPath, JSON.stringify({ pid: 0, token: 'peer', ts: new Date().toISOString() }) + '\n', 'utf8');
    assert.deepEqual(judge.appendShown(cwd, SESSION_A, [entry('three')]), { ok: false, reason: 'lock held' });
    assert.deepEqual(readShown(cwd).map((e) => e.name), ['one', 'two'], 'a held lock leaves the file as it was');
    fs.unlinkSync(lockPath);

    fs.writeFileSync(judge.shownFilePath(cwd), '{"not":"a list"}\n', 'utf8');
    assert.deepEqual(judge.appendShown(cwd, SESSION_A, [entry('four')]), { ok: false, reason: 'file is not a list' });
    assert.equal(fs.readFileSync(judge.shownFilePath(cwd), 'utf8'), '{"not":"a list"}\n', 'a foreign file is never overwritten');
    assert.deepEqual(judge.appendShown(cwd, undefined, [entry('five')]), { ok: false, reason: 'no session id' });
});

test('appendShown leaves .kit/.gitignore containing star beside the shown file it creates', (t) => {
    const cwd = tempDir(t, 'jev-judge-shown-marker-');
    const entry = { session: SESSION_A, name: 'one', recognitionId: 'one', score: 0.9, rank: 1, shown: true, time: 't', marked: null };
    assert.ok(!fs.existsSync(path.join(cwd, '.kit')), 'test setup: no .kit yet');
    assert.deepEqual(judge.appendShown(cwd, SESSION_A, [entry]), { ok: true });
    assert.equal(fs.readFileSync(path.join(path.dirname(judge.shownFilePath(cwd)), '.gitignore'), 'utf8'), '*\n',
        'the directory appendShown created is marked beside the shown file');
});

// A minimal entry of the shape shownEntries writes, named for a writer case.
function namedEntry(name) {
    return { session: SESSION_A, name, recognitionId: name, score: 0.9, rank: 1, shown: true, time: 't', marked: null };
}

// A list that parses, padded past the reader's 1 MiB ceiling, planted as the
// project's shown file.
function plantPastCeiling(cwd) {
    const file = judge.shownFilePath(cwd);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, '[' + ' '.repeat(1024 * 1024 + 16) + ']\n', 'utf8');
    return file;
}

// A symlink at `at` naming `target`, or null with the platform's refusal
// where a test may not create one, which a case turns into a stated skip.
function plantLink(target, at) {
    try {
        fs.symlinkSync(target, at, 'file');
        return null;
    } catch (err) {
        return 'this platform refuses symlink creation to a test (' + (err && err.code) + ')';
    }
}

test('the shown file is read under a 1 MiB ceiling and written compact, and an append over a file past the ceiling resets it to the new entries', (t) => {
    const cwd = tempDir(t, 'jev-judge-ceiling-');
    assert.deepEqual(judge.appendShown(cwd, SESSION_A, [namedEntry('one'), namedEntry('two')]), { ok: true });
    const written = fs.readFileSync(judge.shownFilePath(cwd), 'utf8');
    assert.equal(written, JSON.stringify(JSON.parse(written)) + '\n', 'compact JSON, no pretty-print');

    // Past the ceiling the reader names the case apart from an unreadable
    // file, and the writer treats it as a reset: the unread list is dropped,
    // uncounted, and the file holds the new entries alone.
    const file = plantPastCeiling(cwd);
    assert.deepEqual(judge.readShownList(file), { ok: false, reason: 'file past the ceiling' });
    assert.deepEqual(judge.appendShown(cwd, SESSION_A, [namedEntry('three')]), { ok: true, reset: true });
    assert.deepEqual(readShown(cwd).map((e) => e.name), ['three'], 'only the new entries remain');
    assert.deepEqual(judge.appendShown(cwd, SESSION_A, [namedEntry('four')]), { ok: true }, 'the next append is an ordinary one');
    assert.deepEqual(readShown(cwd).map((e) => e.name), ['three', 'four']);
});

test('a session end over a file past the ceiling removes it, and so does a get, and neither writes a row', (t) => {
    const ended = tempDir(t, 'jev-judge-ceiling-end-');
    const endedFile = plantPastCeiling(ended);
    assert.deepEqual(memq.recordUnreadPointers(ended, SESSION_A), { ok: true });
    assert.ok(!fs.existsSync(endedFile), 'the over-size file is gone');
    assert.deepEqual(journalRows(ended), [], 'the dropped entries go uncounted');

    const read = tempDir(t, 'jev-judge-ceiling-get-');
    const readFile = plantPastCeiling(read);
    assert.deepEqual(memq.keyPointerRead(read, SESSION_A, 'a-record'), { ok: true });
    assert.ok(!fs.existsSync(readFile), 'the over-size file is gone');
    assert.deepEqual(journalRows(read), []);
});

test('the judged block over a file past the ceiling resets it to its own entries and says so in its note', async (t) => {
    const fake = fleetDeps(rows(2));
    const jev = fakeJev(scoresByName({ 'record-0': 0.9 }));
    const { cwd, options } = blockOptions(t, fake, jev, { sessionId: SESSION_A });
    plantPastCeiling(cwd);
    const block = await memq.fleetMemoryBlock(os.tmpdir(), 5, options);
    assert.deepEqual(block.lines.map(nameOf), ['record-0']);
    assert.equal(block.note, memq.SHOWN_RESET_NOTE);
    assert.match(block.note, /reset/);
    assert.deepEqual(readShown(cwd).map((e) => [e.session, e.name]), [[SESSION_A, 'record-0'], [SESSION_A, 'record-1']]);
    assert.deepEqual(journalRows(cwd), [], 'the dropped entries are not keyed');
});

test('a shown file that is a link, or holds text that does not parse, is still file unreadable and untouched', (t) => {
    const cwd = tempDir(t, 'jev-judge-unreadable-');
    const file = judge.shownFilePath(cwd);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, '[{"name":', 'utf8');
    assert.deepEqual(judge.appendShown(cwd, SESSION_A, [namedEntry('one')]), { ok: false, reason: 'file unreadable' });
    assert.equal(fs.readFileSync(file, 'utf8'), '[{"name":', 'the unparseable text is left as it was');
    fs.unlinkSync(file);

    const target = path.join(cwd, 'link-target.json');
    fs.writeFileSync(target, JSON.stringify([namedEntry('elsewhere')]) + '\n', 'utf8');
    const refused = plantLink(target, file);
    if (refused !== null) return t.skip(refused);
    assert.deepEqual(judge.appendShown(cwd, SESSION_A, [namedEntry('two')]), { ok: false, reason: 'file unreadable' });
    assert.ok(fs.lstatSync(file).isSymbolicLink(), 'the link stays');
    assert.equal(fs.readFileSync(target, 'utf8'), JSON.stringify([namedEntry('elsewhere')]) + '\n', 'and its target is untouched');
});

// fs.renameSync made to throw for a rename onto `target` and restored after
// the case: the one failure a rewrite can meet after its change ran that no
// test has to guess a temp name to inject. The count says whether it fired.
function refuseRenameOnto(t, target) {
    const real = fs.renameSync;
    const fired = { count: 0 };
    fs.renameSync = (from, to) => {
        if (to === target) {
            fired.count += 1;
            const err = new Error('EACCES: injected rename refusal');
            err.code = 'EACCES';
            throw err;
        }
        return real(from, to);
    };
    t.after(() => { fs.renameSync = real; });
    return fired;
}

// Every exclusive create the writer opens, recorded off fs.openSync and
// restored after the case.
function spyExclusiveOpens(t, prefix) {
    const real = fs.openSync;
    const opened = [];
    fs.openSync = (p, flags, ...rest) => {
        if (flags === 'wx' && String(p).startsWith(prefix)) opened.push(p);
        return real(p, flags, ...rest);
    };
    t.after(() => { fs.openSync = real; });
    return opened;
}

function tempsBeside(file) {
    return fs.readdirSync(path.dirname(file)).filter((n) => n.startsWith(path.basename(file) + '.tmp'));
}

test('the temp name carries a random part beside the pid, is opened exclusive, and a temp stranded at the pid-only name blocks nothing', (t) => {
    const cwd = tempDir(t, 'jev-judge-tmp-name-');
    const file = judge.shownFilePath(cwd);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    const stranded = file + '.' + process.pid + '.tmp';
    fs.writeFileSync(stranded, 'left by a killed process\n', 'utf8');
    const opened = spyExclusiveOpens(t, file);
    assert.deepEqual(judge.appendShown(cwd, SESSION_A, [namedEntry('one')]), { ok: true });
    assert.deepEqual(judge.appendShown(cwd, SESSION_A, [namedEntry('two')]), { ok: true });
    assert.equal(opened.length, 2, 'one exclusive create per write');
    const shape = new RegExp('^' + file.replace(/[\\.]/g, '\\$&') + '\\.tmp\\.' + process.pid + '\\.[0-9a-f]{12}$');
    for (const p of opened) assert.match(p, shape);
    assert.notEqual(opened[0], opened[1], 'two writes, two names');
    assert.deepEqual(readShown(cwd).map((e) => e.name), ['one', 'two']);
    assert.equal(fs.readFileSync(stranded, 'utf8'), 'left by a killed process\n', 'the stranded temp is neither reused nor removed');
    assert.deepEqual(tempsBeside(file), [], 'no temp of this writer\'s shape is left behind');
});

test('an entry already at the temp name the writer drew fails the write, and neither it nor the shown file changes', (t) => {
    const cwd = tempDir(t, 'jev-judge-tmp-taken-');
    const file = judge.shownFilePath(cwd);
    assert.deepEqual(judge.appendShown(cwd, SESSION_A, [namedEntry('one')]), { ok: true });
    const settled = fs.readFileSync(file, 'utf8');
    // The name is random, so the entry is planted at the name the writer drew,
    // just before its open, which is the race the exclusive create refuses.
    const real = fs.openSync;
    const taken = [];
    fs.openSync = (p, flags, ...rest) => {
        if (typeof p === 'string' && p.startsWith(file + '.tmp.') && taken.length === 0) {
            taken.push(p);
            fs.writeFileSync(p, 'already here\n', 'utf8');
        }
        return real(p, flags, ...rest);
    };
    t.after(() => { fs.openSync = real; });
    assert.deepEqual(judge.appendShown(cwd, SESSION_A, [namedEntry('two')]), { ok: false, reason: 'write failed' });
    assert.equal(taken.length, 1, 'the injection fired');
    assert.equal(fs.readFileSync(file, 'utf8'), settled);
    assert.equal(fs.readFileSync(taken[0], 'utf8'), 'already here\n', 'the entry at the temp name is neither overwritten nor removed');
});

test('a rewrite whose rename fails is a failed write that leaves the shown file as it was and removes the temp it created', (t) => {
    const cwd = tempDir(t, 'jev-judge-tmp-fail-');
    const file = judge.shownFilePath(cwd);
    assert.deepEqual(judge.appendShown(cwd, SESSION_A, [namedEntry('one')]), { ok: true });
    const settled = fs.readFileSync(file, 'utf8');
    const fired = refuseRenameOnto(t, file);
    assert.deepEqual(judge.appendShown(cwd, SESSION_A, [namedEntry('two')]), { ok: false, reason: 'write failed' });
    assert.equal(fired.count, 1, 'the injection fired');
    assert.equal(fs.readFileSync(file, 'utf8'), settled, 'the shown file is as it was');
    assert.deepEqual(tempsBeside(file), [], 'the temp this call created is gone');
    assert.ok(!fs.existsSync(file + '.lock'), 'the lock is released');
});

test('the judged block\'s append drops an entry dated more than a day ahead with no row, and keeps one inside that day', async (t) => {
    // No row for a future-dated entry: a clock stepped back would otherwise
    // have a peer's sweep record a miss for a live session's pointer.
    const fake = fleetDeps(rows(2));
    const jev = fakeJev(scoresByName({ 'record-0': 0.9 }));
    const { cwd, options } = blockOptions(t, fake, jev, { sessionId: SESSION_A });
    const far = plantedEntry(SESSION_B, 'a-far-future-record', daysAgo(-2), { score: 0.77, rank: 3 });
    const farUnshown = plantedEntry(SESSION_B, 'a-far-future-unshown-record', daysAgo(-2), { shown: false });
    const near = plantedEntry(SESSION_B, 'a-near-future-record', daysAgo(-0.5));
    fs.mkdirSync(path.dirname(judge.shownFilePath(cwd)), { recursive: true });
    fs.writeFileSync(judge.shownFilePath(cwd), JSON.stringify([far, near, farUnshown]) + '\n', 'utf8');

    const block = await memq.fleetMemoryBlock(os.tmpdir(), 5, options);
    assert.deepEqual(block.lines.map(nameOf), ['record-0']);
    assert.deepEqual(journalRows(cwd), [], 'a future-dated entry is dropped uncounted, shown or not');
    const after = readShown(cwd);
    assert.deepEqual(after[0], near, 'the entry inside the day stays as it was');
    assert.deepEqual(after.slice(1).map((e) => [e.session, e.name]),
        [[SESSION_A, 'record-0'], [SESSION_A, 'record-1']], 'both far-dated entries are gone');
});

test('a judged block whose thirty hold no fleet-tier row is the unasked line, its own and not the judged no-record line', async (t) => {
    const fake = fleetDeps([row('a-pending-record', { tier: 'pending' })]);
    const jev = fakeJev(scoresByName({ 'a-pending-record': 0.95 }));
    const { cwd, options } = blockOptions(t, fake, jev, { sessionId: SESSION_A });
    const block = await memq.fleetMemoryBlock(os.tmpdir(), 5, options);
    assert.deepEqual(block, { lines: [], reason: null, note: judge.NO_CANDIDATE_LINE, judged: true });
    assert.notEqual(judge.NO_CANDIDATE_LINE, judge.NO_RECORD_LINE);
    assert.doesNotMatch(judge.NO_CANDIDATE_LINE, /read its nearest thirty/, 'the judge read nothing here');
    assert.equal(jev.calls.length, 0);
    assert.ok(!fs.existsSync(judge.shownFilePath(cwd)), 'nothing judged, nothing recorded');
});

// dbClient.deliver replaced by a recorder for the case and restored after it,
// so a test reads what the three pointer writers hand the host.
function recordDeliveries(t) {
    const delivered = [];
    const real = dbClient.deliver;
    dbClient.deliver = (entry) => { delivered.push(entry); return { delivered: true, queued: false }; };
    t.after(() => { dbClient.deliver = real; });
    return delivered;
}

function plantShownAt(cwd, entries) {
    fs.mkdirSync(path.dirname(judge.shownFilePath(cwd)), { recursive: true });
    fs.writeFileSync(judge.shownFilePath(cwd), JSON.stringify(entries) + '\n', 'utf8');
}

test('the sweep\'s fail rows reach the host only where the rewrite that removed the entries went through', async (t) => {
    const delivered = recordDeliveries(t);
    const fake = fleetDeps(rows(2));
    const jev = () => fakeJev(scoresByName({ 'record-0': 0.9 }));
    const stale = () => [plantedEntry(SESSION_B, 'a-stale-record', daysAgo(8))];

    // The control: the same sweep over a file the rewrite replaces delivers its row.
    const control = blockOptions(t, fake, jev(), { sessionId: SESSION_A });
    plantShownAt(control.cwd, stale());
    await memq.fleetMemoryBlock(os.tmpdir(), 5, control.options);
    assert.equal(delivered.length, 1, 'the control delivers the stale entry\'s row');
    assert.equal(delivered[0].actionKey, 'kit.jev.pointer');

    // A rename that fails after the sweep ran: the file keeps the stale entry,
    // so the row is not delivered, or the next block's sweep would count the
    // same recognition id at the host twice.
    const failed = blockOptions(t, fake, jev(), { sessionId: SESSION_A });
    plantShownAt(failed.cwd, stale());
    const fired = refuseRenameOnto(t, judge.shownFilePath(failed.cwd));
    const block = await memq.fleetMemoryBlock(os.tmpdir(), 5, failed.options);
    assert.equal(fired.count, 1, 'the injection fired');
    assert.match(block.note, /\(write failed\)\.$/, block.note);
    assert.equal(delivered.length, 1, 'no delivery for a rewrite that failed');
    assert.equal(readShown(failed.cwd).length, 1, 'the stale entry is still in the file');
});

test('a session end delivers its unread rows to the host only where the rewrite that removed the entries went through', (t) => {
    const delivered = recordDeliveries(t);
    const entries = () => [
        plantedEntry(SESSION_A, 'an-unread-record', daysAgo(0)),
        plantedEntry(SESSION_B, 'a-stale-record', daysAgo(8)),
        plantedEntry(SESSION_B, 'a-young-record', daysAgo(1))
    ];

    // The control: the own unread row and the stale peer's row both reach the host.
    const control = tempDir(t, 'jev-judge-end-deliver-');
    plantShownAt(control, entries());
    assert.deepEqual(memq.recordUnreadPointers(control, SESSION_A), { ok: true });
    assert.deepEqual(delivered.map((e) => e.summary).sort(), ['a-stale-record', 'an-unread-record']);
    assert.equal(readShown(control).length, 1, 'the young peer entry alone remains');

    // A rename that fails after the rows were written: nothing is delivered,
    // since the entries stay in the file for the next writer to key again.
    const failed = tempDir(t, 'jev-judge-end-fail-');
    plantShownAt(failed, entries());
    const fired = refuseRenameOnto(t, judge.shownFilePath(failed));
    assert.deepEqual(memq.recordUnreadPointers(failed, SESSION_A), { ok: false, reason: 'write failed' });
    assert.equal(fired.count, 1, 'the injection fired');
    assert.equal(delivered.length, 2, 'no delivery for a rewrite that failed');
    assert.equal(readShown(failed).length, 3, 'every entry is still in the file');
});

test('a get delivers its read row to the host only where the rewrite that marked the entry went through', (t) => {
    const delivered = recordDeliveries(t);
    const entries = () => [
        plantedEntry(SESSION_A, 'a-read-record', daysAgo(0)),
        plantedEntry(SESSION_B, 'a-peer-record', daysAgo(0))
    ];

    const control = tempDir(t, 'jev-judge-get-deliver-');
    plantShownAt(control, entries());
    assert.deepEqual(memq.keyPointerRead(control, SESSION_A, 'a-read-record'), { ok: true });
    assert.deepEqual(delivered.map((e) => e.summary), ['a-read-record']);
    assert.notEqual(readShown(control)[0].marked, null, 'the control marked the entry');

    const failed = tempDir(t, 'jev-judge-get-fail-');
    plantShownAt(failed, entries());
    const fired = refuseRenameOnto(t, judge.shownFilePath(failed));
    assert.deepEqual(memq.keyPointerRead(failed, SESSION_A, 'a-read-record'), { ok: false, reason: 'write failed' });
    assert.equal(fired.count, 1, 'the injection fired');
    assert.equal(delivered.length, 1, 'no delivery for a rewrite that failed');
    assert.equal(readShown(failed)[0].marked, null, 'the entry is still unmarked');
});

test('isShownEntry bounds the rank at the host queue\'s vector rank ceiling, and the two bounds are one number', () => {
    assert.equal(judge.RANK_MAX, dbClient.VECTOR_RANK_MAX);
    assert.equal(judge.RANK_MAX, 2147483647);
    const entry = plantedEntry(SESSION_A, 'a-record', daysAgo(0));
    assert.equal(judge.isShownEntry({ ...entry, rank: judge.RANK_MAX }), true);
    assert.equal(judge.isShownEntry({ ...entry, rank: judge.RANK_MAX + 1 }), false);
    assert.equal(judge.isShownEntry({ ...entry, rank: 0 }), false);
});

test('where the top candidate is under the first floor the block is the one no-record line and nothing else', async (t) => {
    const fake = fleetDeps(rows(3));
    const jev = fakeJev(scoresByName({ 'record-0': 0.69, 'record-1': 0.6 }));
    const { cwd, options } = blockOptions(t, fake, jev, { sessionId: SESSION_A });
    const block = await memq.fleetMemoryBlock(os.tmpdir(), 5, options);
    assert.deepEqual(block, { lines: [], reason: null, note: judge.NO_RECORD_LINE, judged: true });
    assert.match(block.note, /^No fleet record bears on this project's recent work/);
    // A judged result, not a fallback: what was judged is still recorded.
    assert.equal(readShown(cwd).length, 3);
    assert.ok(readShown(cwd).every((e) => e.shown === false));
});

test('each fallback renders the live, admitted hits nearest by vector first with the one stand-down line', async (t) => {
    const at = clock(5000);
    // The procedure's fused order, which is not the vector order: the
    // fallback reorders by similarity and drops what has none.
    const listed = [
        row('lexical-only', { distance: null, descriptionRank: 1 }),
        row('third', { distance: 0.25, descriptionRank: 2 }),
        row('second', { distance: 0.2 }),
        row('retired', { archived: true, distance: 0.05 }),
        row('under-floor', { distance: 0.9 }),
        row('fourth', { distance: 0.3 }),
        row('first', { distance: 0.1 }),
        row('sixth', { distance: 0.4 }),
        row('fifth', { distance: 0.35 })
    ];
    const cases = [
        ['a thrown call', () => { throw new Error('boom'); }, /unavailable \(unreachable: the call failed\)/],
        ['429 or 529 after the retry', () => ({ ok: false, reason: 'busy', detail: 'retry policy spent' }), /unavailable \(busy: retry policy spent\)/],
        ['the budget edge', () => { at.advance(judge.BUDGET_EDGE_MS + 1); return { ok: false, reason: 'timeout' }; }, /unavailable \(timeout/],
        ['no key', () => ({ ok: false, reason: 'no key' }), /TYPESAFE_API_KEY is not set/]
    ];
    for (const [what, handler, line] of cases) {
        const fake = fleetDeps(listed);
        const jev = fakeJev(handler);
        const { cwd, options } = blockOptions(t, fake, jev, { sessionId: SESSION_A, deps: { now: at.now } });
        const block = await memq.fleetMemoryBlock(os.tmpdir(), 5, options);
        assert.equal(block.reason, null, what);
        assert.equal(block.judged, false, what);
        assert.match(block.note, line, what);
        assert.deepEqual(block.lines.map(nameOf), ['first', 'second', 'third', 'fourth', 'fifth'],
            what + ': live, admitted, with a similarity, nearest first, capped');
        assert.ok(!fs.existsSync(judge.shownFilePath(cwd)), what + ' records nothing');
    }
    // The client's own `not configured` answer, the file gone between the
    // config read and the call: the vector list with no line at all.
    const fake = fleetDeps(listed);
    const { options } = blockOptions(t, fake, fakeJev(() => ({ ok: false, reason: 'not configured' })));
    const silent = await memq.fleetMemoryBlock(os.tmpdir(), 5, options);
    assert.equal(silent.note, null);
    assert.equal(silent.lines.length, 5);
});

test('a memory database that stands down leaves the judged block with its reason, and an empty shortlist asks the judge nothing', async (t) => {
    const away = fleetDeps([], { unreachable: true });
    const jev = fakeJev(scoresByName({}));
    const { options } = blockOptions(t, away, jev);
    const block = await memq.fleetMemoryBlock(os.tmpdir(), 5, options);
    assert.deepEqual(block.lines, []);
    assert.match(block.reason, /did not answer/);
    assert.equal(jev.calls.length, 0);

    // An empty shortlist is a judged result with nothing to judge: the
    // unasked line, as for thirty rows none of which is a fleet record.
    const empty = fleetDeps([]);
    const none = await memq.fleetMemoryBlock(os.tmpdir(), 5, blockOptions(t, empty, jev).options);
    assert.deepEqual(none, { lines: [], reason: null, note: judge.NO_CANDIDATE_LINE, judged: true });
    assert.equal(jev.calls.length, 0, 'nothing to judge');

    // No situation composes and none was passed: the block asks nothing, as
    // before the judge.
    const bare = fleetDeps(rows(2));
    const { options: unasked } = blockOptions(t, bare, jev, { situation: '' });
    const quiet = await memq.fleetMemoryBlock(os.tmpdir(), 5, unasked);
    assert.match(quiet.reason, /names nothing to ask/);
    assert.deepEqual(bare.seen.calls, []);
});

test('the composed situation drives the block where no situation was passed', async (t) => {
    const fake = fleetDeps(rows(2));
    const jev = fakeJev(scoresByName({ 'record-0': 0.9 }));
    const { cwd, options } = blockOptions(t, fake, jev, { situation: undefined });
    writePlan(cwd, 'alpha_spec_v1.md', PLAN);
    await memq.fleetMemoryBlock(os.tmpdir(), 5, options);
    assert.match(jev.calls[0].state, /^Plan: Alpha plan\n\nGoal: GOALMARK/);
    assert.equal(fake.seen.texts[0], jev.calls[0].state);
});

// ---------------------------------------------------------- the key sweep --

// A stand-in Jev on an ephemeral port, recording each request's headers and
// body and answering every candidate 0.9.
function startServer(t) {
    return new Promise((resolve) => {
        const requests = [];
        const server = http.createServer((req, res) => {
            let raw = '';
            req.on('data', (chunk) => { raw += chunk; });
            req.on('end', () => {
                const body = JSON.parse(raw);
                requests.push({ headers: req.headers, body });
                const answers = {};
                for (const id of Object.keys(body.questions)) answers[id] = { type: 'noul', noul: 0.9 };
                res.writeHead(200, { 'content-type': 'application/json' });
                res.end(JSON.stringify({ model: 'jev-test', answers, usage: { input_tokens: 100, output_tokens: 1 } }));
            });
        });
        server.listen(0, '127.0.0.1', () => {
            t.after(() => new Promise((done) => { server.closeAllConnections(); server.close(() => done()); }));
            resolve({ url: 'http://127.0.0.1:' + server.address().port, requests });
        });
    });
}

// The artifacts that carry the key or any eight consecutive characters of it.
function keyTraces(artifacts) {
    const hits = [];
    for (const [name, text] of Object.entries(artifacts)) {
        for (let i = 0; i + 8 <= PLANTED_KEY.length; i += 1) {
            if (text.includes(PLANTED_KEY.slice(i, i + 8))) hits.push(name + ' carries ' + PLANTED_KEY.slice(i, i + 8));
        }
    }
    return hits;
}

function filesUnder(dir) {
    const out = {};
    const walk = (d) => {
        for (const entry of fs.readdirSync(d, { withFileTypes: true })) {
            const full = path.join(d, entry.name);
            if (entry.isDirectory()) walk(full);
            else out[path.relative(dir, full)] = fs.readFileSync(full, 'utf8');
        }
    };
    if (fs.existsSync(dir)) walk(dir);
    return out;
}

test('a planted key reaches the wire and no artifact the block can write: the shown file, the block, the scratch directory, stdout or stderr', async (t) => {
    const server = await startServer(t);
    fs.mkdirSync(path.join(FIXTURE_HOME, '.claude'), { recursive: true });
    const configFile = path.join(FIXTURE_HOME, '.claude', 'kit-jev.json');
    fs.writeFileSync(configFile, JSON.stringify({ endpoint: server.url, model: 'jev-test' }), 'utf8');
    process.env.TYPESAFE_API_KEY = PLANTED_KEY;
    t.after(() => { delete process.env.TYPESAFE_API_KEY; fs.rmSync(configFile, { force: true }); });

    const written = { stdout: '', stderr: '' };
    const saved = { out: process.stdout.write, err: process.stderr.write };
    process.stdout.write = (chunk, ...rest) => { written.stdout += String(chunk); return saved.out.call(process.stdout, chunk, ...rest); };
    process.stderr.write = (chunk, ...rest) => { written.stderr += String(chunk); return saved.err.call(process.stderr, chunk, ...rest); };
    const fake = fleetDeps(rows(3));
    const cwd = tempDir(t, 'jev-judge-key-');
    let block;
    let thrown;
    try {
        // The real client and the real config read: the fixture home holds
        // the config and the environment holds the key.
        block = await memq.fleetMemoryBlock(os.tmpdir(), 5,
            { config: fleetConfigFixture(), deps: fake.deps, cwd, sessionId: SESSION_A, situation: 'a situation' });
    } catch (err) {
        thrown = err;
    } finally {
        process.stdout.write = saved.out;
        process.stderr.write = saved.err;
    }
    assert.equal(thrown, undefined);
    assert.equal(server.requests.length, 1, 'the judge was asked');
    assert.equal(server.requests[0].headers.authorization, 'Bearer ' + PLANTED_KEY, 'the key rode in the header');
    assert.equal(block.judged, true);
    assert.equal(block.lines.length, 3);

    const scratch = filesUnder(path.join(cwd, '.kit'));
    assert.ok(Object.hasOwn(scratch, 'jev-shown.json'), 'the shown file was written: ' + Object.keys(scratch));
    const artifacts = {
        block: JSON.stringify(block),
        inspected: util.inspect(block, { depth: Infinity }),
        stdout: written.stdout,
        stderr: written.stderr,
        ...Object.fromEntries(Object.entries(scratch).map(([k, v]) => ['scratch/' + k, v]))
    };
    assert.deepEqual(keyTraces(artifacts), []);

    // The control, withheld from the sweep above: the key written into the
    // scratch directory on purpose is found, so the silence is the block's.
    fs.writeFileSync(path.join(cwd, '.kit', 'control.txt'), 'leaked ' + PLANTED_KEY + '\n', 'utf8');
    const spoken = keyTraces(Object.fromEntries(Object.entries(filesUnder(path.join(cwd, '.kit'))).map(([k, v]) => ['scratch/' + k, v])));
    assert.ok(spoken.length > 0 && spoken.every((h) => h.startsWith('scratch/control.txt carries')), JSON.stringify(spoken));
});
