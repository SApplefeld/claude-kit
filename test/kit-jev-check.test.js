'use strict';

// The coverage tool's contract: the shipped topic file pinned literal by
// literal, the request body built from the plan and nothing else, the section
// boundaries, all or nothing on a refusal, the three closing lines with their
// exit codes, the ordering on fixed scores, and the usage refusals. The tool
// is run as a child process against a stand-in Jev on 127.0.0.1, with a home
// directory and a planted key of the test's own, so nothing here leaves the
// machine and the real key never reaches a child. The tool's own parsers are
// also exercised in-process, where a spawn would prove nothing more.

const test = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('child_process');
const fs = require('fs');
const http = require('http');
const os = require('os');
const path = require('path');

const SCRIPTS = path.join(__dirname, '..', 'plugins', 'claude-kit', 'scripts');
const TOOL = path.join(SCRIPTS, 'kit-jev-check.js');
const tool = require(TOOL);

// A recognizable key, planted in every child's environment so any output
// carrying it or any eight characters of it fails the sweep below.
const PLANTED_KEY = 'PLANTED-KEY-7f3a9c';

// The 28 shipped topics, each as its own literal, so a paraphrase in the file
// fails here. The order is the file's order, code family first.
const TOPICS = [
    ['dep_throws', 'code', 'what must happen when something this code calls (a helper, a host function, a callback) throws or rejects'],
    ['invalid_input', 'code', 'what must happen when this code is given invalid, malformed or unexpected input'],
    ['error_vs_no', 'code', 'how an error from a dependency is told apart from a legitimate negative or empty answer'],
    ['partial_failure', 'code', 'what state must be left behind when an operation fails partway through'],
    ['memory_vs_disk', 'code', 'how in-memory state must relate to what was actually written or sent, when the write or send fails'],
    ['size_limits', 'code', 'a limit on the size or length of values that come from outside (files, responses, user text)'],
    ['outside_shape', 'code', 'that values received from outside must be checked field by field before use'],
    ['secrets', 'code', 'how secrets or credentials must be kept out of logs, results and error text'],
    ['concurrency', 'code', 'what must happen when two operations run at the same time'],
    ['timeouts', 'code', 'a time limit or deadline, and what happens when it passes'],
    ['who_calls', 'code', 'which code must call each exported helper or guard, so that none is left unused'],
    ['closed_sets', 'code', 'every closed list of allowed values, and what happens to a value outside the list'],
    ['test_failure_paths', 'code', 'that failure paths, and not only the happy path, must have tests'],
    ['rollback', 'code', 'how to turn the feature off or return to the old behaviour'],
    ['p_terms', 'prose', 'a definition of each new term it introduces, precise enough to decide a borderline case'],
    ['p_boundary', 'prose', 'at least one worked borderline example showing which side of a new rule a near-miss case falls on'],
    ['p_owner', 'prose', 'which single document owns each new rule, and that every other mention points at it or copies it whole'],
    ['p_copies', 'prose', 'how two copies of the same text are kept identical (a pin, a build step or a test)'],
    ['p_old_text', 'prose', 'which existing sentences elsewhere contradict the new rule and must be changed or removed'],
    ['p_executable', 'prose', 'for each new instruction, how the person following it can observe the condition that triggers it'],
    ['p_conflict', 'prose', 'how the new rule ranks against an existing rule it could collide with'],
    ['p_existing_items', 'prose', 'what happens to existing items (tests, documents, records) that do not meet the new rule'],
    ['p_acceptance_observable', 'prose', 'acceptance points that a third party could check as true or false without judgment'],
    ['p_pointers', 'prose', 'that every file, section or name the new text refers to exists, and how that is checked'],
    ['p_comment_truth', 'prose', 'that comments and headers touched by the change must describe what the code actually does'],
    ['p_scope_files', 'prose', 'the exact list of files each section may change'],
    ['p_total_rule', 'prose', 'for each new rule with several outcomes, that every possible case gets exactly one outcome, with none left unassigned and none given two'],
    ['p_test_instrument', 'prose', 'for each test or check the change adds or edits, what it must select and what it must not select, and the control that proves it']
];

// The questions the tool sends, built from the literals above rather than
// from the file, so the wording is pinned on its own.
function expectedQuestions() {
    const questions = {};
    for (const [id, , text] of TOPICS) {
        questions[`c_${id}`] = {
            type: 'noul',
            instructions: `Does the specification in \`spec\` explicitly state ${text}?`,
            criteria: {
                true: 'Yes, the text states this explicitly.',
                false: 'No, the text is silent on this or only implies it.'
            }
        };
    }
    return questions;
}

// ---------------------------------------------------------------- fixtures --

// A fresh home for one child, so the client's fixed config path resolves
// under it. `os.homedir()` reads USERPROFILE on Windows and HOME elsewhere.
function tempDir(t, prefix) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
    t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
    return dir;
}

function writeConfig(home, endpoint) {
    fs.mkdirSync(path.join(home, '.claude'), { recursive: true });
    fs.writeFileSync(path.join(home, '.claude', 'kit-jev.json'), JSON.stringify({ endpoint, model: 'jev-test' }));
}

// A stand-in Jev on an ephemeral port that records every request body and
// answers each asked question with the `noul` value `score(n, id)` returns
// for the n-th request (1-based), or a status from `status(n)` where that
// returns one.
function startServer(t, score, status) {
    return new Promise((resolve) => {
        const requests = [];
        const server = http.createServer((req, res) => {
            let raw = '';
            req.on('data', (chunk) => { raw += chunk; });
            req.on('end', () => {
                let body = null;
                try { body = JSON.parse(raw); } catch { body = null; }
                requests.push(body);
                const n = requests.length;
                const code = status === undefined ? undefined : status(n);
                if (code !== undefined) {
                    res.writeHead(code, { 'content-type': 'application/json' });
                    res.end('{}');
                    return;
                }
                const answers = {};
                for (const id of Object.keys((body && body.questions) || {})) {
                    answers[id] = { type: 'noul', noul: score(n, id) };
                }
                res.writeHead(200, { 'content-type': 'application/json' });
                res.end(JSON.stringify({ model: 'jev-test', answers, usage: { input_tokens: 100 * n, output_tokens: 1 } }));
            });
        });
        server.listen(0, '127.0.0.1', () => {
            const port = server.address().port;
            t.after(() => new Promise((done) => {
                server.closeAllConnections();
                server.close(() => done());
            }));
            resolve({ url: `http://127.0.0.1:${port}`, requests });
        });
    });
}

// The tool as a child, its home and key replaced so no child reaches the
// real config or the real key. The parent's environment rides under those
// overrides on the sibling tests' shape, since Node needs the system paths.
// The spawn is asynchronous because the stand-in server runs in this process
// and a synchronous spawn would block the loop that answers it. The key sweep
// runs after the child's result is awaited, so a leaked key rejects the test
// that ran it.
async function run(script, args, home, key) {
    const r = await spawnTool(script, args, home, key);
    assertNoKey(r);
    return r;
}

function spawnTool(script, args, home, key) {
    return new Promise((resolve, reject) => {
        const child = spawn(process.execPath, [script, ...args], {
            env: { ...process.env, USERPROFILE: home, HOME: home, TYPESAFE_API_KEY: key === undefined ? PLANTED_KEY : key }
        });
        let stdout = '';
        let stderr = '';
        child.stdout.setEncoding('utf8');
        child.stderr.setEncoding('utf8');
        child.stdout.on('data', (chunk) => { stdout += chunk; });
        child.stderr.on('data', (chunk) => { stderr += chunk; });
        const timer = setTimeout(() => { child.kill(); }, 60000);
        child.on('error', (err) => { clearTimeout(timer); reject(err); });
        child.on('close', (status) => {
            clearTimeout(timer);
            resolve({ status, stdout, stderr });
        });
    });
}

// Everything a run wrote, checked for the key or any eight consecutive
// characters of it.
function assertNoKey(r) {
    const text = r.stdout + '\n' + r.stderr;
    for (let i = 0; i + 8 <= PLANTED_KEY.length; i += 1) {
        assert.ok(!text.includes(PLANTED_KEY.slice(i, i + 8)), `output carries ${PLANTED_KEY.slice(i, i + 8)}`);
    }
}

// A run armed against a stand-in server: a home with the config naming it.
async function armed(t, score, status) {
    const server = await startServer(t, score, status);
    const home = tempDir(t, 'kit-jev-check-');
    writeConfig(home, server.url);
    return { server, home };
}

function writePlan(dir, name, text) {
    const file = path.join(dir, name);
    fs.writeFileSync(file, text);
    return file;
}

// A three-section plan whose path, title and each section carry a marker of
// their own, with the shapes the section rule must hold on: a fenced
// `### 9.` line and a `####` heading inside section 2, header lines above
// the block and a Chapters block below it.
const MARK = { path: 'PATHMARK-a1', title: 'TITLEMARK-b2', s1: 'S1MARK-c3', s2: 'S2MARK-d4', s3: 'S3MARK-e5', chapters: 'CHAPMARK-f6' };
const SECTION_1 = `### 1. First section\n\nModel: opus\n\nThe first body ${MARK.s1}.\n`;
const SECTION_2 = `### 2. Second section\n\nThe second body ${MARK.s2}.\n\n\`\`\`\n### 9. A fenced heading that starts nothing\n\`\`\`\n\n#### A fourth-level heading that stays inside\n\nMore of the second body.\n`;
const SECTION_3 = `### 3. Third section\n\nThe third body ${MARK.s3}.\n`;

// The marker plan around a given second section, and a given third where the
// case needs one.
function buildPlan(section2, section3 = SECTION_3) {
    return [
        `# A plan ${MARK.title}`,
        '',
        'Status: In Progress',
        'Commit Model: Review-Only',
        '',
        '## Goal',
        '',
        'The goal.',
        '',
        '## Sections of Work',
        '',
        SECTION_1,
        section2,
        section3,
        '## Chapters',
        '',
        `### Chapter 1 - ${MARK.chapters}`,
        'Completed: 1. First section',
        ''
    ].join('\n');
}

const PLAN = buildPlan(SECTION_2);

function markerPlan(t, text) {
    return writePlan(tempDir(t, 'kit-jev-plan-'), `plan-${MARK.path}.md`, text === undefined ? PLAN : text);
}

// The marker sweep over three requests: each body carries its own section's
// marker and none of the path's, the title's, the other sections' or the
// Chapters block's.
function assertMarkerSweep(requests) {
    const own = [MARK.s1, MARK.s2, MARK.s3];
    requests.forEach((body, i) => {
        const wire = JSON.stringify(body);
        for (const [name, marker] of Object.entries(MARK)) {
            if (marker === own[i]) assert.ok(wire.includes(marker), `request ${i + 1} carries its own marker`);
            else assert.ok(!wire.includes(marker), `request ${i + 1} carries the ${name} marker`);
        }
    });
}

// ------------------------------------------------------------ the topic file --

test('the shipped topic file holds exactly the 28 topics, by id, family and text', () => {
    const shipped = JSON.parse(fs.readFileSync(tool.TOPICS_PATH, 'utf8'));
    assert.deepEqual(shipped, TOPICS.map(([id, family, text]) => ({ id, family, text })));
    const read = tool.readTopics(tool.TOPICS_PATH);
    assert.equal(read.ok, true);
    assert.equal(read.topics.length, 28);
});

test('each way the topic file can be unusable is a refusal, and a well-formed file of any length is read', (t) => {
    const dir = tempDir(t, 'kit-jev-topics-');
    const cases = [
        ['a missing file', null],
        ['not JSON', 'not json'],
        ['a JSON object', '{}'],
        ['an empty array', '[]'],
        ['an entry that is not an object', '[1]'],
        ['an entry missing its id', JSON.stringify([{ family: 'code', text: 't' }])],
        ['an entry missing its family', JSON.stringify([{ id: 'a', text: 't' }])],
        ['an entry missing its text', JSON.stringify([{ id: 'a', family: 'code' }])],
        ['an empty text', JSON.stringify([{ id: 'a', family: 'code', text: '' }])],
        ['a family outside code and prose', JSON.stringify([{ id: 'a', family: 'other', text: 't' }])],
        ['a repeated id', JSON.stringify([{ id: 'a', family: 'code', text: 't' }, { id: 'a', family: 'prose', text: 'u' }])]
    ];
    for (const [label, body] of cases) {
        const file = path.join(dir, 'topics.json');
        if (body === null) fs.rmSync(file, { force: true });
        else fs.writeFileSync(file, body);
        const out = tool.readTopics(file);
        assert.equal(out.ok, false, label);
        assert.equal(typeof out.detail, 'string', label);
    }
    const file = path.join(dir, 'two.json');
    fs.writeFileSync(file, JSON.stringify([{ id: 'a', family: 'code', text: 'ta' }, { id: 'b', family: 'prose', text: 'tb' }]));
    assert.deepEqual(tool.readTopics(file), { ok: true, topics: [{ id: 'a', family: 'code', text: 'ta' }, { id: 'b', family: 'prose', text: 'tb' }] });
});

test('an unusable topic file beside the tool is a usage refusal at the command line, sending nothing', async (t) => {
    // A scratch copy of the script directory, with a broken topic file in
    // the shipped one's place, is the only way to reach this branch, since
    // nothing relocates the topic file.
    const { server, home } = await armed(t, () => 0.5);
    const copy = tempDir(t, 'kit-jev-scripts-');
    for (const name of ['kit-jev-check.js', 'jev-client.js', 'kit-endpoint-lib.js']) {
        fs.copyFileSync(path.join(SCRIPTS, name), path.join(copy, name));
    }
    fs.writeFileSync(path.join(copy, 'jev-coverage-topics.json'), JSON.stringify([{ id: 'a', family: 'other', text: 't' }]));
    const r = await run(path.join(copy, 'kit-jev-check.js'), ['spec', markerPlan(t)], home);
    assert.equal(r.status, 1);
    assert.equal(r.stdout, '');
    assert.equal(r.stderr.trim().split('\n').length, 1);
    assert.match(r.stderr, /usage: node kit-jev-check\.js spec/);
    assert.equal(server.requests.length, 0);
});

// ------------------------------------------------------------- the sections --

test('a section runs from its heading to the next `## ` or `### ` line outside a fence', () => {
    const out = tool.parsePlan(PLAN);
    assert.equal(out.ok, true);
    assert.deepEqual(out.sections, [
        { number: '1', title: 'First section', text: SECTION_1 },
        { number: '2', title: 'Second section', text: SECTION_2 },
        { number: '3', title: 'Third section', text: SECTION_3 }
    ]);
});

test('CRLF line endings, a fenced `## ` line, a tilde fence and a non-numbered `### ` line are read on the rule', () => {
    const crlf = tool.parsePlan(PLAN.replace(/\n/g, '\r\n'));
    assert.equal(crlf.ok, true);
    assert.deepEqual(crlf.sections.map((s) => s.text), [SECTION_1, SECTION_2, SECTION_3]);

    const fencedBlockEnd = tool.parsePlan('## Sections of Work\n### 1. One\nbody\n~~~\n## Not a block end\n~~~\nstill one\n## Chapters\n');
    assert.deepEqual(fencedBlockEnd.sections, [{ number: '1', title: 'One', text: '### 1. One\nbody\n~~~\n## Not a block end\n~~~\nstill one' }]);

    const bareHeading = tool.parsePlan('## Sections of Work\n### 1. One\nbody\n### Not a section\nnot in any section\n### 2. Two\nsecond\n');
    assert.deepEqual(bareHeading.sections, [
        { number: '1', title: 'One', text: '### 1. One\nbody' },
        { number: '2', title: 'Two', text: '### 2. Two\nsecond\n' }
    ]);
});

test('a backtick run followed by another backtick on its line is inline code, not a fence opener', () => {
    const inline = tool.parsePlan('## Sections of Work\n### 1. One\n```x``` is how the block opens\n### 2. Two\n```\nfenced\n```\n');
    assert.equal(inline.ok, true);
    assert.deepEqual(inline.sections, [
        { number: '1', title: 'One', text: '### 1. One\n```x``` is how the block opens' },
        { number: '2', title: 'Two', text: '### 2. Two\n```\nfenced\n```\n' }
    ]);

    // The rule is the backtick fence's alone: a tilde run carrying a backtick
    // after it still opens a fence.
    const tilde = tool.parsePlan('## Sections of Work\n### 1. One\n~~~ `info`\n### 9. Fenced\n~~~\n### 2. Two\n');
    assert.deepEqual(tilde.sections.map((s) => s.number), ['1', '2']);
});

test('a plan with no sections block, or none with a section under it, is refused', () => {
    assert.equal(tool.parsePlan('# Title\n\n### 1. Orphan\n').ok, false);
    assert.equal(tool.parsePlan('# Title\n\n## Sections of Work\n\nprose only\n\n## Chapters\n').ok, false);
    assert.equal(tool.parsePlan('## Sections of Work\n```\n### 1. Fenced only\n```\n').ok, false);
    assert.equal(tool.parsePlan('## sections of work\n### 1. Wrong case above\n').ok, false);
    assert.equal(tool.parsePlan('## Sections of Work\n### 1. One\n```\nopen to the end\n').ok, false);
    assert.equal(tool.parsePlan('## Sections of Work\n### 1. One\n````\nshorter close\n```\n').ok, false);
    assert.equal(tool.parsePlan('## Sections of Work\n### 1. One\nbody\n## Chapters\n~~~\nopen in the Chapters\n').ok, false);
});

// ------------------------------------------------------------- the request --

test('each request carries its own section and nothing else from the plan', async (t) => {
    const { server, home } = await armed(t, () => 0.5);
    const file = markerPlan(t);
    const r = await run(TOOL, ['spec', file], home);
    assert.equal(r.status, 0, r.stderr);
    assert.equal(server.requests.length, 3);

    const texts = [SECTION_1, SECTION_2, SECTION_3];
    const questions = expectedQuestions();
    server.requests.forEach((body, i) => {
        assert.deepEqual(body, { state: { spec: texts[i] }, model: 'jev-test', questions });
        assert.deepEqual(Object.keys(body.state), ['spec']);
    });

    assertMarkerSweep(server.requests);
    server.requests.forEach((body, i) => {
        assert.ok(!JSON.stringify(body).includes('family'), `request ${i + 1} carries a family`);
    });
});

// A fence closes only on a line of its own character at least as long as the
// line that opened it, so neither fenced line below ends the section.
const FENCED_SECTIONS = [
    ['a tilde fence line and a `### 9.` line inside a triple-backtick block',
        `### 2. Second section\n\nThe second body ${MARK.s2}.\n\n\`\`\`\n~~~\n### 9. A fenced heading after a tilde line\n\`\`\`\n\nMore of the second body.\n`],
    ['a triple-backtick line and a `## Chapters` line inside a four-backtick block',
        `### 2. Second section\n\nThe second body ${MARK.s2}.\n\n\`\`\`\`\n\`\`\`\n## Chapters\n\`\`\`\n\`\`\`\`\n\nMore of the second body.\n`],
    ['a triple-backtick line carrying an info string inside a triple-backtick block',
        `### 2. Second section\n\nThe second body ${MARK.s2}.\n\n\`\`\`\n\`\`\`js\n### 9. A fenced heading after an info-string line\n\`\`\`\n\nMore of the second body.\n`]
];

for (const [label, section2] of FENCED_SECTIONS) {
    test(`a section keeps its boundary across ${label}`, async (t) => {
        const { server, home } = await armed(t, () => 0.5);
        const r = await run(TOOL, ['spec', markerPlan(t, buildPlan(section2))], home);
        assert.equal(r.status, 0, r.stderr);
        assert.equal(server.requests.length, 3);
        assert.deepEqual(server.requests.map((body) => body.state.spec), [SECTION_1, section2, SECTION_3]);
        assertMarkerSweep(server.requests);
    });
}

test('a line opening with inline code starts no fence, so the next section and a later real fence keep their boundaries', async (t) => {
    const section2 = `### 2. Second section\n\nThe second body ${MARK.s2}.\n\n\`\`\`x\`\`\` is how the block opens.\n`;
    const section3 = `### 3. Third section\n\nThe third body ${MARK.s3}.\n\n\`\`\`\n### 9. A fenced heading that starts nothing\n\`\`\`\n`;
    const { server, home } = await armed(t, () => 0.5);
    const r = await run(TOOL, ['spec', markerPlan(t, buildPlan(section2, section3))], home);
    assert.equal(r.status, 0, r.stderr);
    assert.equal(server.requests.length, 3);
    assert.deepEqual(server.requests.map((body) => body.state.spec), [SECTION_1, section2, section3]);
    assertMarkerSweep(server.requests);
    assert.match(r.stdout, /^jev coverage: 3 sections, /m);
});

test('a fence still open at the end of the plan is a usage refusal, sending nothing', async (t) => {
    const { server, home } = await armed(t, () => 0.5);
    const open = `### 2. Second section\n\nThe second body ${MARK.s2}.\n\n\`\`\`\nnever closed\n`;
    const r = await run(TOOL, ['spec', markerPlan(t, buildPlan(open))], home);
    assert.equal(r.status, 1);
    assert.equal(r.stdout, '');
    assert.equal(r.stderr.trim().split('\n').length, 1);
    assert.match(r.stderr, /usage: node kit-jev-check\.js spec/);
    assert.equal(server.requests.length, 0);
});

// -------------------------------------------------------------- the report --

test('sections print thinnest first with their means and three lowest topics, then the closing line', async (t) => {
    // Section 1 scores 0.5 throughout. Section 2 is the thinnest: code
    // topics 0.2, prose 0.4, with three named topics lower so the lowest
    // three are fixed and one tie among them keeps topic-file order.
    // Section 3 ties section 1 on its mean exactly, on binary-exact values,
    // and follows it in document order.
    const low = { c_secrets: 0.05, c_p_terms: 0.1, c_timeouts: 0.1 };
    const score = (n, id) => {
        if (n === 1) return 0.5;
        if (n === 3) return id.startsWith('c_p_') ? 0.75 : 0.25;
        if (Object.hasOwn(low, id)) return low[id];
        return id.startsWith('c_p_') ? 0.4 : 0.2;
    };
    const { server, home } = await armed(t, score);
    const r = await run(TOOL, ['spec', markerPlan(t)], home);
    assert.equal(r.status, 0, r.stderr);
    assert.equal(r.stderr, '');
    assert.equal(server.requests.length, 3);

    // The report is pinned on the tokens a reader acts on, never on its
    // sentences. The one exact line is the closing line, which the
    // brainstorming skill records.
    const lines = r.stdout.split(/\r?\n/);
    const closing = 'jev coverage: 3 sections, thinnest 2 at 0.28';
    assert.equal(lines[lines.length - 1], '');
    assert.equal(lines[lines.length - 3], closing);
    assert.ok(lines[lines.length - 2].includes('never a finding'), 'the final line says a low score is never a finding');

    // The closing line is the only line that opens with `jev coverage:`, so a
    // reader taking the last such line takes the one the skill records.
    assert.deepEqual(lines.filter((line) => line.startsWith('jev coverage:')), [closing]);
    for (const line of lines) assert.doesNotMatch(line, /threshold|\bpass|\bfail/i);

    // Section 2: code (12 * 0.2 + 0.05 + 0.1) / 14 = 0.182, prose
    // (13 * 0.4 + 0.1) / 14 = 0.379, mean 7.85 / 28 = 0.280. The lowest
    // three tie at 0.10 between timeouts and p_terms, in topic-file order.
    // Sections 1 and 3 tie at 0.50 and keep document order.
    const blocks = [
        ['2', 'Second section', ['0.28', 'code', '0.18', 'prose', '0.38', 'secrets', '0.05', 'timeouts', '0.10', 'p_terms', '0.10']],
        ['1', 'First section', ['0.50', 'code', '0.50', 'prose', '0.50', 'dep_throws', '0.50', 'invalid_input', '0.50', 'error_vs_no', '0.50']],
        ['3', 'Third section', ['0.50', 'code', '0.25', 'prose', '0.75', 'dep_throws', '0.25', 'invalid_input', '0.25', 'error_vs_no', '0.25']]
    ];
    const starts = blocks.map(([number, title]) => lines.findIndex((line) => line.includes(`${number}. ${title}`)));
    assert.ok(starts.every((start, i) => start > 0 && (i === 0 || start > starts[i - 1])), `sections print in the order 2, 1, 3: ${starts}`);
    assert.ok(lines.slice(0, starts[0]).some((line) => line.includes('jev-test') && line.includes('600')), 'a header above the sections names the model and the input tokens');
    blocks.forEach(([number, title, tokens], i) => {
        const block = lines.slice(starts[i], i + 1 < starts.length ? starts[i + 1] : lines.length - 3).join('\n');
        assertInOrder(block, [`${number}. ${title}`, ...tokens], `section ${number}`);
    });
});

// Each token appears in the text after the one before it.
function assertInOrder(text, tokens, label) {
    let at = 0;
    for (const token of tokens) {
        const found = text.indexOf(token, at);
        assert.ok(found >= 0, `${label}: ${token} after position ${at} in ${JSON.stringify(text)}`);
        at = found + token.length;
    }
}

test('two sections printing the same mean keep document order, and the closing line names the first', async (t) => {
    // The same 28 values in two orders: ascending by topic in section 1,
    // descending in section 2. Summed in topic order the two means differ in
    // the last bits (0.1964285714285714 and 0.19642857142857134), and both
    // print as 0.20. Section 3 is higher.
    const values = TOPICS.map((_, i) => [0.1, 0.2, 0.3][i % 3]).sort((a, b) => a - b);
    const index = (id) => TOPICS.findIndex(([topic]) => `c_${topic}` === id);
    const score = (n, id) => {
        if (n === 1) return values[index(id)];
        if (n === 2) return values[values.length - 1 - index(id)];
        return 0.9;
    };
    const { server, home } = await armed(t, score);
    const r = await run(TOOL, ['spec', markerPlan(t)], home);
    assert.equal(r.status, 0, r.stderr);
    assert.equal(server.requests.length, 3);

    const lines = r.stdout.split(/\r?\n/);
    const first = lines.findIndex((line) => line.includes('1. First section'));
    const second = lines.findIndex((line) => line.includes('2. Second section'));
    assert.ok(first > 0 && second > first, `section 1 prints before section 2: ${first}, ${second}`);
    assert.ok(lines.includes('jev coverage: 3 sections, thinnest 1 at 0.20'), r.stdout);
});

test('the report is all or nothing: a refused second section prints no ranking and stops the sends', async (t) => {
    const { server, home } = await armed(t, () => 0.5, (n) => (n === 2 ? 500 : undefined));
    const r = await run(TOOL, ['spec', markerPlan(t)], home);
    assert.equal(r.status, 2);
    assert.equal(r.stdout, 'jev coverage: not checked (refused)\n');
    assert.equal(r.stderr, '');
    assert.equal(server.requests.length, 2);
});

test('a machine with no config file reads not configured, and one without a key reads not checked', async (t) => {
    const bare = tempDir(t, 'kit-jev-check-');
    const r = await run(TOOL, ['spec', markerPlan(t)], bare);
    assert.equal(r.status, 2);
    assert.equal(r.stdout, 'jev coverage: not configured\n');
    assert.equal(r.stderr, '');

    const broken = tempDir(t, 'kit-jev-check-');
    fs.mkdirSync(path.join(broken, '.claude'), { recursive: true });
    fs.writeFileSync(path.join(broken, '.claude', 'kit-jev.json'), 'not json');
    const unusable = await run(TOOL, ['spec', markerPlan(t)], broken);
    assert.equal(unusable.status, 2);
    assert.equal(unusable.stdout, 'jev coverage: not checked (config unusable)\n');
    assert.equal(unusable.stderr, '');

    const { server, home } = await armed(t, () => 0.5);
    const noKey = await run(TOOL, ['spec', markerPlan(t)], home, '');
    assert.equal(noKey.status, 2);
    assert.equal(noKey.stdout, 'jev coverage: not checked (no key)\n');
    assert.equal(server.requests.length, 0);
});

test('a machine with no config file reads not configured even for a plan with a section past 60,000 characters', async (t) => {
    const server = await startServer(t, () => 0.5);
    const bare = tempDir(t, 'kit-jev-check-');
    const long = `### 1. Long\n${'x'.repeat(60001)}`;
    const file = writePlan(tempDir(t, 'kit-jev-plan-'), 'long.md', `## Sections of Work\n${long}`);
    const r = await run(TOOL, ['spec', file], bare);
    assert.equal(r.status, 2);
    assert.equal(r.stdout, 'jev coverage: not configured\n');
    assert.equal(r.stderr, '');
    assert.equal(server.requests.length, 0);
});

test('a section past 60,000 characters is not checked and nothing is sent, wherever it sits', async (t) => {
    const { server, home } = await armed(t, () => 0.5);
    const long = `### 3. Long\n${'x'.repeat(60001 - '### 3. Long\n'.length)}`;
    assert.equal(long.length, 60001);
    const file = writePlan(tempDir(t, 'kit-jev-plan-'), 'long.md', `## Sections of Work\n${SECTION_1}${SECTION_2}${long}`);
    const r = await run(TOOL, ['spec', file], home);
    assert.equal(r.status, 2);
    assert.equal(r.stdout, 'jev coverage: not checked (section too long)\n');
    assert.equal(server.requests.length, 0);

    // The bound itself: a section of exactly 60,000 characters is sent.
    const atBound = writePlan(tempDir(t, 'kit-jev-plan-'), 'bound.md', `## Sections of Work\n${long.slice(0, 60000)}`);
    const ok = await run(TOOL, ['spec', atBound], home);
    assert.equal(ok.status, 0, ok.stderr);
    assert.equal(server.requests.length, 1);
    assert.equal(server.requests[0].state.spec.length, 60000);
});

// ------------------------------------------------------------- the usage --

test('every usage refusal is one line on stderr, exit 1, with nothing sent', async (t) => {
    const { server, home } = await armed(t, () => 0.5);
    const dir = tempDir(t, 'kit-jev-plan-');
    const noBlock = writePlan(dir, 'no-block.md', '# Title\n\n### 1. Orphan\n');
    const noSection = writePlan(dir, 'no-section.md', '# Title\n\n## Sections of Work\n\nprose\n');
    const notMd = writePlan(dir, 'plan.txt', PLAN);
    const cases = [
        ['no verb', []],
        ['another verb', ['check', markerPlan(t)]],
        ['no path', ['spec']],
        ['a second path', ['spec', markerPlan(t), markerPlan(t)]],
        ['a path not ending in .md', ['spec', notMd]],
        ['a missing file', ['spec', path.join(dir, 'absent.md')]],
        ['no sections block', ['spec', noBlock]],
        ['no section under the block', ['spec', noSection]]
    ];
    for (const [label, args] of cases) {
        const r = await run(TOOL, args, home);
        assert.equal(r.status, 1, label);
        assert.equal(r.stdout, '', label);
        assert.equal(r.stderr.trim().split('\n').length, 1, label);
        assert.match(r.stderr, /usage: node kit-jev-check\.js spec/, label);
    }
    assert.equal(server.requests.length, 0);
});
