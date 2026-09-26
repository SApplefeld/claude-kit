// Tests for tools/corpus-compression/workflow.mjs, the corpus-compression
// plan's one dispatch path.
//
// The plan makes pacing a hard requirement enforced in the machinery, so these
// tests pin the three properties it names: every agent() call names a model and
// an effort, MAX_OPEN is present and at most five, and each wave settles before
// the next one starts. The last is read from a dry run: the script's own source
// is evaluated the way the Workflow runtime evaluates it, an async body with
// agent, log and args in scope, over a stub agent that records when each call
// starts and ends. Those three checks each also run once against a mutated
// copy of the source, so their green is shown to be a check that can go red.
// The rest pin what a failed or malformed wave does: nothing is dispatched for
// a list the script would refuse, and a failed agent costs no finished wave.
// The track tests pin the concurrent form: tracks overlap while each keeps its
// order, the run-wide MAX_OPEN and MAX_TRACKS ceilings hold, each shown red
// with its mechanism removed, and a failed track stops alone.

'use strict';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const SCRIPT = path.join(ROOT, 'tools', 'corpus-compression', 'workflow.mjs');
// Read with LF endings, since a Windows checkout may carry CRLF and the
// checks below anchor on line ends.
const SOURCE = fs.readFileSync(SCRIPT, 'utf8').replace(/\r\n/g, '\n');
const { reviewAgentClass } = require(path.join(ROOT, 'plugins', 'claude-kit', 'hooks', 'kit-agent-identity-lib.js'));

// The argument text of every agent( call, read by balancing parentheses from
// the opening one. Line comments are dropped first, since the script's own
// comments name agent() calls in prose.
function agentCalls(source) {
    const src = source.replace(/^\s*\/\/.*$/gm, '');
    const calls = [];
    const re = /\bagent\(/g;
    let m;
    while ((m = re.exec(src)) !== null) {
        let depth = 1;
        let i = m.index + m[0].length;
        while (i < src.length && depth > 0) {
            if (src[i] === '(') depth++;
            else if (src[i] === ')') depth--;
            i++;
        }
        calls.push(src.slice(m.index + m[0].length, i - 1));
    }
    return calls;
}

function callProblems(src) {
    const calls = agentCalls(src);
    const problems = [];
    if (calls.length === 0) problems.push('no agent() call found');
    calls.forEach((c, n) => {
        if (!/\bmodel:/.test(c)) problems.push(`agent() call ${n + 1} names no model`);
        if (!/\beffort:/.test(c)) problems.push(`agent() call ${n + 1} names no effort`);
        if (/\.\.\./.test(c)) problems.push(`agent() call ${n + 1} spreads its options, so its model and effort are not literal`);
    });
    return problems;
}

function maxOpen(src) {
    const m = /^const MAX_OPEN = (\d+)$/m.exec(src);
    return m ? Number(m[1]) : null;
}

// Evaluates the script as the Workflow runtime does: the meta export becomes a
// plain declaration and the body runs as an async function with the hooks in
// scope.
function load(src) {
    const body = src.replace(/^export const meta/m, 'const meta');
    const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
    return new AsyncFunction('agent', 'log', 'phase', 'args', body);
}

// A stub agent whose calls take different times, so a wave that does not wait
// for the previous one shows up as an overlap in the recorded order. A prompt
// named in `fail` throws, and one named in `empty` returns null, the two ways
// the runtime reports an agent that produced nothing.
function stub({ fail = [], empty = [] } = {}) {
    const events = [];
    const calls = [];
    let open = 0;
    let peak = 0;
    let n = 0;
    const agent = async (prompt, opts) => {
        const delay = [15, 5, 25, 10][n++ % 4];
        calls.push({ prompt, opts });
        events.push({ at: 'start', prompt });
        open++;
        peak = Math.max(peak, open);
        await new Promise(r => setTimeout(r, delay));
        open--;
        events.push({ at: 'end', prompt });
        if (fail.includes(prompt)) throw new Error(`stub failure on ${prompt}`);
        if (empty.includes(prompt)) return null;
        return `text of ${prompt}`;
    };
    return { agent, events, calls, peak: () => peak };
}

const WAVES = [
    { id: 'd1', kind: 'draft', config: 'fable-low', prompt: 'd1' },
    { id: 'r1', kind: 'review', round: 1, reviews: [
        { agentType: 'claude-kit:prose-reviewer', prompt: 'r1a' },
        { agentType: 'claude-kit:blind-reader', prompt: 'r1b' },
        { agentType: 'claude-kit:blind-reader', prompt: 'r1c' },
        { agentType: 'claude-kit:blind-reader', prompt: 'r1d' },
    ] },
    { id: 'd2', kind: 'draft', config: 'opus-medium', prompt: 'd2' },
];

// Every call of one wave ends before any call of the next wave starts.
function orderProblems(events) {
    const waveOf = p => p.replace(/[a-d]$/, '');
    const problems = [];
    const seen = [];
    for (const e of events) {
        const w = waveOf(e.prompt);
        if (e.at === 'start') {
            for (const prior of seen) {
                if (prior.wave !== w && !prior.ended) problems.push(`${e.prompt} started while ${prior.prompt} was still open`);
            }
            seen.push({ wave: w, prompt: e.prompt, ended: false });
        } else {
            seen.find(s => s.prompt === e.prompt).ended = true;
        }
    }
    return problems;
}

async function dryRun(src, waves, done, opts) {
    const s = stub(opts);
    const result = await load(src)(s.agent, () => {}, () => {}, { waves, done });
    return { s, result };
}

test('every agent() call names a model and an effort', () => {
    assert.deepStrictEqual(callProblems(SOURCE), []);
});

test('the agent() check reds on a call with no effort', () => {
    const mutated = SOURCE.replace('    effort: REVIEW_EFFORT,\n', '');
    assert.notStrictEqual(mutated, SOURCE, 'the mutation found nothing to remove');
    assert.match(callProblems(mutated).join('\n'), /names no effort/);
});

test('MAX_OPEN is present and at most five', () => {
    const n = maxOpen(SOURCE);
    assert.ok(n !== null, 'MAX_OPEN is not declared as a numeric constant');
    assert.ok(n >= 1 && n <= 5, `MAX_OPEN is ${n}`);
    assert.strictEqual(maxOpen(SOURCE.replace(/^const MAX_OPEN = \d+$/m, 'const MAX_OPEN = 6')), 6);
    assert.strictEqual(maxOpen(SOURCE.replace(/^const MAX_OPEN = \d+$/m, '')), null);
});

test('each wave settles before the next starts, and a review wave holds at most MAX_OPEN open', async () => {
    const { s, result } = await dryRun(SOURCE, WAVES, []);
    assert.deepStrictEqual(orderProblems(s.events), []);
    assert.strictEqual(s.peak(), Math.min(maxOpen(SOURCE), 4), 'the four-reviewer wave should fill the pool up to its size');
    assert.deepStrictEqual(result.map(r => r.id), ['d1', 'r1', 'd2']);
    assert.strictEqual(result[1].reviews.length, 4);
});

test('the order check reds when a draft wave is not awaited', async () => {
    const mutated = SOURCE.replace("wave.kind === 'draft' ? await draftWave(wave)", "wave.kind === 'draft' ? draftWave(wave)");
    assert.notStrictEqual(mutated, SOURCE, 'the mutation found nothing to replace');
    const { s } = await dryRun(mutated, WAVES, []);
    await new Promise(r => setTimeout(r, 60));
    assert.notDeepStrictEqual(orderProblems(s.events), []);
});

test('each dispatch carries the constants for its kind', async () => {
    const { s } = await dryRun(SOURCE, WAVES, []);
    const byPrompt = Object.fromEntries(s.calls.map(c => [c.prompt, c.opts]));
    assert.deepStrictEqual([byPrompt.d1.model, byPrompt.d1.effort, byPrompt.d1.agentType], ['fable', 'low', 'claude-kit:corpus-drafter']);
    assert.deepStrictEqual([byPrompt.d2.model, byPrompt.d2.effort], ['opus', 'medium']);
    for (const p of ['r1a', 'r1b', 'r1c', 'r1d']) {
        assert.deepStrictEqual([byPrompt[p].model, byPrompt[p].effort], ['fable', 'low']);
    }
});

test('a wave listed as done is skipped, so a stopped run resumes from disk', async () => {
    const { s, result } = await dryRun(SOURCE, WAVES, ['d1', 'r1']);
    assert.deepStrictEqual(s.calls.map(c => c.prompt), ['d2']);
    assert.deepStrictEqual(result.map(r => r.id), ['d2']);
});

test('a malformed wave anywhere in the list is refused before any dispatch', async () => {
    const bad = [
        [{ id: 'x', kind: 'draft', config: 'fable-high', prompt: 'x' }, /config must be one of/],
        [{ id: 'x', kind: 'draft', config: 'constructor', prompt: 'x' }, /config must be one of/],
        [{ id: 'x', kind: 'review', round: 1, reviews: [{ agentType: 'general-purpose', prompt: 'x' }] }, /is not one of/],
        [{ id: 'x', kind: 'review', round: 1, reviews: [] }, /reviews must be a non-empty array/],
        [{ id: 'x', kind: 'review', round: 1 }, /reviews must be a non-empty array/],
        [{ id: 'x', kind: 'fix', prompt: 'x' }, /kind must be draft or review/],
        [{ id: 'd1', kind: 'draft', config: 'fable-low', prompt: 'x' }, /the id is used twice/],
    ];
    for (const [wave, reason] of bad) {
        const s = stub();
        await assert.rejects(load(SOURCE)(s.agent, () => {}, () => {}, { waves: [...WAVES, wave], done: [] }), reason);
        assert.deepStrictEqual(s.calls, [], `a list ending in ${JSON.stringify(wave)} dispatched before it was refused`);
    }
    const s = stub();
    await assert.rejects(load(SOURCE)(s.agent, () => {}, () => {}, { waves: WAVES, done: 'd1' }), /args.done must be an array/);
    await assert.rejects(load(SOURCE)(s.agent, () => {}, () => {}, { done: [] }), /args.waves must be a non-empty array/);
    assert.deepStrictEqual(s.calls, []);
});

test('a failed reviewer settles its wave, keeps the finished waves and stops the run', async () => {
    const { s, result } = await dryRun(SOURCE, WAVES, [], { fail: ['r1b'], empty: ['r1d'] });
    assert.deepStrictEqual(result.map(r => r.id), ['d1', 'r1'], 'the run should stop after the failed wave');
    assert.strictEqual(result[0].text, 'text of d1', 'the finished draft is returned');
    assert.deepStrictEqual(result[1].reviews.map(r => r.text || r.error), ['text of r1a', 'stub failure on r1b', 'text of r1c', 'the agent returned no result']);
    assert.match(result[1].error, /2 of 4 reviewers failed/);
    assert.ok(!s.calls.some(c => c.prompt === 'd2'), 'no wave after the failed one is dispatched');
});

test('a failed drafter stops the run with its error and dispatches nothing after it', async () => {
    const { s, result } = await dryRun(SOURCE, WAVES, [], { fail: ['d1'] });
    assert.deepStrictEqual(result.map(r => [r.id, r.error]), [['d1', 'stub failure on d1']]);
    assert.deepStrictEqual(s.calls.map(c => c.prompt), ['d1']);
});

function maxTracks(src) {
    const m = /^const MAX_TRACKS = (\d+)$/m.exec(src);
    return m ? Number(m[1]) : null;
}

// Waves for one document's track: a draft, then a review of `reviewers`
// reviewers. Prompts carry the track name first, so events filter by track.
function trackWaves(t, reviewers = 2) {
    return [
        { id: `${t}d`, track: t, kind: 'draft', config: 'opus-medium', prompt: `${t}d` },
        { id: `${t}r`, track: t, kind: 'review', round: 1, reviews: Array.from({ length: reviewers }, (_, i) => ({ agentType: 'claude-kit:prose-reviewer', prompt: `${t}r${'abcd'[i]}` })) },
    ];
}

// The peak number of calls open at once among those whose prompt passes `keep`.
function peakOf(events, keep) {
    let open = 0;
    let peak = 0;
    for (const e of events) {
        if (!keep(e.prompt)) continue;
        open += e.at === 'start' ? 1 : -1;
        peak = Math.max(peak, open);
    }
    return peak;
}

test('MAX_TRACKS is present and at most three', () => {
    const n = maxTracks(SOURCE);
    assert.ok(n !== null, 'MAX_TRACKS is not declared as a numeric constant');
    assert.ok(n >= 1 && n <= 3, `MAX_TRACKS is ${n}`);
    assert.strictEqual(maxTracks(SOURCE.replace(/^const MAX_TRACKS = \d+$/m, 'const MAX_TRACKS = 4')), 4);
});

test('tracks run at once while each track keeps its own order', async () => {
    const waves = [...trackWaves('A'), ...trackWaves('B')];
    const { s, result } = await dryRun(SOURCE, waves, []);
    for (const t of ['A', 'B']) {
        assert.deepStrictEqual(orderProblems(s.events.filter(e => e.prompt.startsWith(t)).map(e => ({ ...e, prompt: e.prompt.slice(1) }))), [], `track ${t} ran out of order`);
    }
    assert.ok(peakOf(s.events, p => p.endsWith('d')) === 2, 'the two drafts should be open together');
    assert.deepStrictEqual(result.map(r => r.id), ['Ad', 'Ar', 'Bd', 'Br']);
});

test('at most MAX_OPEN agents are open across all tracks, and the check reds without the shared slot', async () => {
    const waves = ['A', 'B', 'C'].flatMap(t => trackWaves(t, 4)).filter(w => w.kind === 'review');
    const { s } = await dryRun(SOURCE, waves, []);
    assert.strictEqual(s.peak(), maxOpen(SOURCE), 'twelve reviewers across three tracks should fill the shared ceiling exactly');
    const mutated = SOURCE.replace('const text = await slot(call)', 'const text = await call()');
    assert.notStrictEqual(mutated, SOURCE, 'the mutation found nothing to replace');
    const m = await dryRun(mutated, waves, []);
    assert.ok(m.s.peak() > maxOpen(SOURCE), `without the slot the peak is ${m.s.peak()}`);
});

test('at most MAX_TRACKS tracks are open at once, and the check reds without the track pool', async () => {
    const waves = ['A', 'B', 'C', 'D'].map(t => ({ id: `${t}d`, track: t, kind: 'draft', config: 'opus-medium', prompt: `${t}d` }));
    const { s, result } = await dryRun(SOURCE, waves, []);
    assert.strictEqual(s.peak(), maxTracks(SOURCE));
    assert.strictEqual(result.length, 4);
    const mutated = SOURCE.replace('MAX_TRACKS)\n', 'waves.length)\n');
    assert.notStrictEqual(mutated, SOURCE, 'the mutation found nothing to replace');
    const m = await dryRun(mutated, waves, []);
    assert.strictEqual(m.s.peak(), 4);
});

test('a failed track stops alone and the other tracks finish', async () => {
    const waves = [...trackWaves('A'), ...trackWaves('B')];
    const { s, result } = await dryRun(SOURCE, waves, [], { fail: ['Ad'] });
    assert.deepStrictEqual(result.map(r => [r.id, r.error || null]), [['Ad', 'stub failure on Ad'], ['Bd', null], ['Br', null]]);
    assert.ok(!s.calls.some(c => c.prompt.startsWith('Ar')), 'the failed track dispatched past its failure');
});

test('a wave naming an empty or non-string track is refused before any dispatch', async () => {
    for (const track of ['', 7]) {
        const s = stub();
        await assert.rejects(load(SOURCE)(s.agent, () => {}, () => {}, { waves: [{ id: 'x', track, kind: 'draft', config: 'opus-medium', prompt: 'x' }], done: [] }), /track must be a non-empty string/);
        assert.deepStrictEqual(s.calls, []);
    }
});

// The doctrine's Workflow grant covers a read-only dispatch naming an agentType
// the readonly-agent-guard governs, so every type this script may dispatch has
// to resolve to the guard's strict class.
test('every type the script dispatches is one the read-only guard governs', () => {
    const drafter = /^const DRAFTER = '([^']+)'$/m.exec(SOURCE)[1];
    const reviewers = [...(/^const REVIEWERS = \[([\s\S]*?)\]$/m.exec(SOURCE)[1]).matchAll(/'([^']+)'/g)].map(m => m[1]);
    assert.ok(reviewers.length >= 2, 'the REVIEWERS list was not read');
    for (const t of [drafter, ...reviewers]) assert.strictEqual(reviewAgentClass(t), 'strict', `${t} is not governed`);
});
