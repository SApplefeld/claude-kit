// The Jev recognition battery: measures TypeSafe's Jev model as a judge over
// the fleet memory store's search shortlist, for the hand-labeled situations
// in situations.json beside this file.
//
// WHAT IT MEASURES. Every situation is scored in two shapes: `composed`, the
// situation in the old block state's format (the project segment name and
// three hand-picked action keys), and `situation`, the prose summary. For each shape the harness
// fetches usp_Search's top thirty through the memory database client, asks
// Jev one `noul` question per candidate, all sharing the shape's text as
// state, and scores the answers against the situation's gold list. The
// question carries the record's name, description and status and nothing
// else. The report gives, per shape and composed first: recall over the
// positives and clean negatives at each of 0.3, 0.5 and 0.7, the weakest gold
// score and the strongest ghost score on a negative, with the request count
// and input tokens. A positive's gold score is its best-scoring gold record,
// since the block needs one pointer to deliver the lesson. A gold record
// absent from the thirty is a stage-1 miss: its situation cannot be recalled
// at any threshold, and the report names it.
//
// WHERE THE DATA GOES. A live run sends every situation's text, and every
// candidate record's name, description and status, off this machine to the
// endpoint `TYPESAFE_API_URL` names, which is the vendor's by default. Record
// bodies are never sent. The run prints that disclosure before its first
// call. The key rides only in the request's Authorization header: it is
// written to no file and printed nowhere, no refusal text is built from a
// runtime error's own message, and a cleartext endpoint is refused unless its
// host is loopback.
//
// USAGE. From the repository root:
//
//   node sidecar/batteries/jev-recognition-v1/run.js [--cases <file>]
//
//   TYPESAFE_API_KEY  the vendor key; required unless MOCK=1
//   TYPESAFE_API_URL  the endpoint; https, or http on a loopback host
//   MOCK=1            runs every stage against in-process stand-ins for the
//                     memory database and the endpoint, with no network call
//                     and no database call; the test suite runs this path
//
// The per-candidate results are written to `.kit/jev-battery/<stamp>/` under
// the working directory, never into this battery's own directory.
//
// EXIT. 0: every situation measured in both shapes. 1: cannot measure, where
// stage 1 stood down, returned an empty shortlist, or a request failed for
// some situation, and the report names each one; or the run threw before it
// finished. 2: refused before any call, for a usage error, a case file
// the harness will not score, a missing key or an unusable endpoint.

'use strict';

const fs = require('fs');
const path = require('path');

const REPO = path.join(__dirname, '..', '..', '..');
const endpointLib = require(path.join(REPO, 'plugins', 'claude-kit', 'scripts', 'kit-endpoint-lib.js'));

const DEFAULT_CASES = path.join(__dirname, 'situations.json');
const DEFAULT_ENDPOINT = 'https://api.typesafe.ai';
const SYSTEMONE_PATH = '/v1/systemone';
const MODEL = 'jev-latest';

// The fleet block's own fetch limit, so the judge sees what the block's judge
// will see.
const FETCH_LIMIT = 30;
const THRESHOLDS = [0.3, 0.5, 0.7];

// The boundary reading is a separation between gold scores and ghost scores
// on true negatives, and a separation measured over a handful of negatives
// settles nothing, so a case file with fewer is refused rather than scored.
const MIN_NEGATIVES = 10;

// Report order: composed first, as the Chapter reports it. The floors are ruled
// from the `situation` shape.
const SHAPES = ['composed', 'situation'];

const REQUEST_TIMEOUT_MS = 30000;
// The vendor documents 429 and 529 as transient; these are the backoff delays
// before each retry, and their count is the retry count.
const RETRY_DELAYS_MS = [1000, 2000, 4000, 8000];
const RETRY_STATUSES = new Set([429, 529]);
const STAGE1_BUDGET_MS = 120000;

const QUESTION = 'The state describes what an AI coding agent is doing or just observed. '
    + 'Would reading the memory record below, right now, change what the agent does next? '
    + 'Most situations match zero or one records; do not invent relevance.';
const CRITERIA_TRUE = 'Reading this record now would change what the agent does next.';
const CRITERIA_FALSE = 'This record does not bear on the situation.';

const USAGE = 'usage: node sidecar/batteries/jev-recognition-v1/run.js [--cases <file>]';

function isObject(v) {
    return v !== null && typeof v === 'object' && !Array.isArray(v);
}

function refusal(detail) {
    return { ok: false, detail };
}

// ------------------------------------------------------------------ cases --

// The case file as scoreable rows, or the reason it is refused. Each row
// carries a positive integer `n` unique in the file, the two shape texts, and
// `gold` as a list of record names, empty for a true negative.
function loadCases(file) {
    let raw = '';
    try {
        raw = fs.readFileSync(file, 'utf8');
    } catch {
        return refusal('the case file could not be read');
    }
    let rows = null;
    try {
        rows = JSON.parse(raw);
    } catch {
        return refusal('the case file is not JSON');
    }
    if (!Array.isArray(rows)) return refusal('the case file is not a JSON array');
    const seen = new Set();
    for (const row of rows) {
        if (!isObject(row)) return refusal('a case is not a JSON object');
        if (!Number.isInteger(row.n) || row.n < 1) return refusal('a case has no positive integer n');
        if (seen.has(row.n)) return refusal(`case ${row.n} appears twice`);
        seen.add(row.n);
        for (const shape of SHAPES) {
            if (typeof row[shape] !== 'string' || row[shape].trim() === '') {
                return refusal(`case ${row.n} has no ${shape} text`);
            }
        }
        if (!Array.isArray(row.gold) || row.gold.some((g) => typeof g !== 'string' || g === '')) {
            return refusal(`case ${row.n} has a gold that is not a list of record names`);
        }
    }
    const negatives = rows.filter((r) => r.gold.length === 0).length;
    if (negatives < MIN_NEGATIVES) {
        return refusal(`the case file holds ${negatives} true negatives, and the boundary reading needs at least ${MIN_NEGATIVES}`);
    }
    return { ok: true, cases: rows };
}

// --------------------------------------------------------------- endpoint --

// Loopback is `localhost`, 127.0.0.0/8 and `::1`. The shared host test decides
// first, so an IPv4 octet with a leading zero is refused for the reason it
// states, and its private ranges are then dropped, since a private address is
// another machine and the key would cross the network in cleartext.
function hostIsLoopback(host) {
    const name = host.toLowerCase().replace(/^\[|\]$/g, '');
    if (!endpointLib.hostIsLocal(name)) return false;
    return name === 'localhost' || name === '::1' || name === '0:0:0:0:0:0:0:1' || name.startsWith('127.');
}

function resolveEndpoint(raw) {
    const text = (typeof raw === 'string' && raw.trim() !== '')
        ? raw.trim().replace(/\/+$/, '') : DEFAULT_ENDPOINT;
    let url = null;
    try {
        url = new URL(text);
    } catch {
        return refusal('TYPESAFE_API_URL does not parse as a URL');
    }
    // The request path is appended to this address, so the address names a host
    // and nothing after it.
    if (url.pathname !== '/' || url.search !== '' || url.hash !== '' || /[?#]/.test(text)) {
        return refusal('TYPESAFE_API_URL must name the endpoint host alone, with no path or query');
    }
    if (url.username !== '' || url.password !== '') {
        return refusal('TYPESAFE_API_URL must carry no credentials; the key rides in its own header');
    }
    if (url.protocol === 'https:' || (url.protocol === 'http:' && hostIsLoopback(url.hostname))) {
        return { ok: true, endpoint: url.origin };
    }
    return refusal('TYPESAFE_API_URL must be https unless its host is loopback, since the key rides in the request');
}

// ----------------------------------------------------------------- stage 1 --

// One usp_Search row as the candidate the judge is asked about, with its
// position in the thirty. Status is `archived` where the procedure sets its
// archived key, else `live`.
function candidateOf(row, index) {
    return {
        rank: index + 1,
        name: typeof row.name === 'string' ? row.name : '',
        description: typeof row.description === 'string' ? row.description : '',
        status: row.archived === true ? 'archived' : 'live'
    };
}

// The live stage 1: both shapes of one situation in one query, one list per
// text in the order asked.
async function liveStage1(row) {
    const db = require(path.join(REPO, 'plugins', 'claude-kit', 'scripts', 'memory-database.js'));
    const answered = await db.queryHost({
        mode: 'search',
        texts: SHAPES.map((shape) => row[shape]),
        limit: FETCH_LIMIT,
        budgetMs: STAGE1_BUDGET_MS
    });
    if (!answered.ok) {
        return refusal('the memory database stood down: ' + endpointLib.neutralize(String(answered.standDown)));
    }
    if (!Array.isArray(answered.lists) || answered.lists.length !== SHAPES.length) {
        return refusal('the memory database answered a list count other than the texts asked');
    }
    return { ok: true, lists: answered.lists };
}

// ------------------------------------------------------------------- judge --

// `instructions` is an object here, the question beside the record's fields.
// The vendor's API reference types the field as a string, an object or an
// array, and its own examples carry reference data in an object this way.
function questionsFor(candidates) {
    const questions = {};
    candidates.forEach((c, i) => {
        questions[`c${i + 1}`] = {
            type: 'noul',
            instructions: {
                question: QUESTION,
                record_title: c.name,
                record_description: c.description,
                record_status: c.status
            },
            criteria: { true: CRITERIA_TRUE, false: CRITERIA_FALSE }
        };
    });
    return questions;
}

// The response as one score per asked id. A noul answer is read at
// `answers[id].noul`, the one spelling the shipped client in
// plugins/claude-kit/scripts/jev-client.js reads, so a run can only read as
// measured on answers that client can use. Anything else, or any asked id
// without a number from 0 to 1, makes the whole answer unusable.
function readAnswers(body, questions) {
    if (!isObject(body) || !isObject(body.answers)) return refusal('the response carries no answers object');
    const scores = {};
    for (const id of Object.keys(questions)) {
        const answer = Object.hasOwn(body.answers, id) ? body.answers[id] : undefined;
        const p = isObject(answer) ? answer.noul : undefined;
        if (typeof p !== 'number' || !(p >= 0 && p <= 1)) {
            return refusal('an asked question has no score from 0 to 1');
        }
        scores[id] = p;
    }
    const count = isObject(body.usage) ? body.usage.input_tokens : undefined;
    return { ok: true, scores, inputTokens: (Number.isInteger(count) && count >= 0) ? count : 0 };
}

// One POST. Resolves to `{ retry: true }` for a status the backoff covers and
// to `{ result }` otherwise; never throws. A refusal's text is this file's own
// literal or an HTTP status, never a runtime error's message, which can spell
// the request back out with its headers.
async function sendOnce(io, key, endpoint, body, questions, tally) {
    const controller = new AbortController();
    const timer = setTimeout(() => { controller.abort(); }, REQUEST_TIMEOUT_MS);
    tally.requests += 1;
    let res = null;
    try {
        res = await io.post(endpoint + SYSTEMONE_PATH, {
            method: 'POST',
            headers: { 'content-type': 'application/json', authorization: `Bearer ${key}` },
            body,
            signal: controller.signal,
            redirect: 'manual'
        });
    } catch (err) {
        clearTimeout(timer);
        return { result: refusal(endpointLib.classifyThrow(err).status) };
    }
    try {
        if (RETRY_STATUSES.has(res.status)) {
            await endpointLib.discardBody(res);
            return { retry: true };
        }
        if (res.status < 200 || res.status >= 300) {
            await endpointLib.discardBody(res);
            return { result: refusal(`HTTP ${res.status}`) };
        }
        const read = await endpointLib.readBoundedBody(res);
        if (!read.ok) {
            return {
                result: refusal(read.detail === undefined
                    ? endpointLib.classifyThrow(read.throwed).status
                    : 'the response body is not JSON under the size cap')
            };
        }
        return { result: readAnswers(read.body, questions) };
    } catch (err) {
        return { result: refusal(endpointLib.classifyThrow(err).status) };
    } finally {
        clearTimeout(timer);
    }
}

async function ask(io, key, endpoint, state, questions, tally) {
    const body = JSON.stringify({ state, model: MODEL, questions });
    for (let attempt = 0; ; attempt += 1) {
        const sent = await sendOnce(io, key, endpoint, body, questions, tally);
        if (sent.retry !== true) return sent.result;
        if (attempt >= RETRY_DELAYS_MS.length) return refusal('busy: 429 or 529 after every retry');
        await io.sleep(RETRY_DELAYS_MS[attempt]);
    }
}

// ----------------------------------------------------------------- scoring --

// One situation in one shape, scored. `judgeRank` is a record's position by
// judge score, 1 being the strongest; `rank` is its stage-1 position.
function scoreOne(row, candidates, scores) {
    const goldSet = new Set(row.gold);
    const scored = candidates.map((c, i) => ({ ...c, score: scores[`c${i + 1}`] }));
    // A tie with a non-gold candidate ranks behind it, so a gold that merely
    // matches a ghost's score never reads as separated from it. Golds tied with
    // each other share a rank, since neither is a ghost ahead of the other.
    const judgeRank = (self) => 1 + scored.filter((c) => c !== self
        && (goldSet.has(c.name) ? c.score > self.score : c.score >= self.score)).length;
    const golds = row.gold.map((name) => {
        const hits = scored.filter((c) => c.name === name);
        if (hits.length === 0) return { name, rank: null, judgeRank: null, score: null };
        const best = hits.reduce((a, b) => (b.score > a.score ? b : a));
        return { name, rank: best.rank, judgeRank: judgeRank(best), score: best.score };
    });
    const found = golds.filter((g) => g.score !== null);
    const bestGold = found.length === 0 ? null : found.reduce((a, b) => (b.score > a.score ? b : a));
    const ghosts = scored.filter((c) => !goldSet.has(c.name));
    const topGhost = ghosts.length === 0 ? null : ghosts.reduce((a, b) => (b.score > a.score ? b : a));
    return {
        n: row.n,
        kind: row.gold.length === 0 ? 'negative' : 'positive',
        golds,
        goldScore: bestGold === null ? null : bestGold.score,
        strongestNonGold: topGhost === null ? null
            : { name: topGhost.name, rank: topGhost.rank, score: topGhost.score },
        candidates: scored.map((c) => ({ rank: c.rank, name: c.name, status: c.status, score: c.score }))
    };
}

function totalsFor(measured, cases) {
    const positives = measured.filter((r) => r.kind === 'positive');
    const negatives = measured.filter((r) => r.kind === 'negative');
    const at = THRESHOLDS.map((t) => ({
        threshold: t,
        recall: positives.filter((r) => r.goldScore !== null && r.goldScore >= t).length,
        cleanNegatives: negatives.filter((r) => r.strongestNonGold === null || r.strongestNonGold.score < t).length
    }));
    const recalled = positives.filter((r) => r.goldScore !== null);
    const weakest = recalled.length === 0 ? null
        : recalled.reduce((a, b) => (b.goldScore < a.goldScore ? b : a));
    const ghosted = negatives.filter((r) => r.strongestNonGold !== null);
    const strongest = ghosted.length === 0 ? null
        : ghosted.reduce((a, b) => (b.strongestNonGold.score > a.strongestNonGold.score ? b : a));
    return {
        positives: cases.filter((c) => c.gold.length > 0).length,
        negatives: cases.filter((c) => c.gold.length === 0).length,
        at,
        stage1Misses: positives.filter((r) => r.goldScore === null).map((r) => r.n),
        weakestGold: weakest === null ? null : { n: weakest.n, score: weakest.goldScore },
        strongestGhost: strongest === null ? null
            : { n: strongest.n, name: strongest.strongestNonGold.name, score: strongest.strongestNonGold.score }
    };
}

// ------------------------------------------------------------------ report --

function fmt(score) {
    return score === null ? '-' : score.toFixed(2);
}

function reportLines(shapes, cases) {
    const lines = [];
    for (const shape of SHAPES) {
        const s = shapes[shape];
        lines.push('', `shape ${shape}`);
        lines.push('  n   kind      gold stage-1 rank  gold judge rank  gold score  strongest non-gold');
        for (const r of s.results) {
            if (r.unmeasured) {
                lines.push(`  ${String(r.n).padEnd(3)} unmeasured: ${r.unmeasured}`);
                continue;
            }
            const best = r.golds.filter((g) => g.score !== null)
                .reduce((a, b) => (a === null || b.score > a.score ? b : a), null);
            const ghost = r.strongestNonGold === null ? '-'
                : `${fmt(r.strongestNonGold.score)} ${endpointLib.neutralize(r.strongestNonGold.name)}`;
            const rank = r.kind === 'negative' ? '' : (best === null ? 'miss' : String(best.rank));
            const judge = r.kind === 'negative' ? '' : (best === null ? '-' : String(best.judgeRank));
            lines.push(`  ${String(r.n).padEnd(3)} ${r.kind.padEnd(9)} ${rank.padEnd(18)} ${judge.padEnd(16)} `
                + `${(r.kind === 'negative' ? '' : fmt(r.goldScore)).padEnd(11)} ${ghost}`);
        }
        const t = s.totals;
        for (const a of t.at) {
            lines.push(`  at ${a.threshold.toFixed(1)}: recall ${a.recall}/${t.positives}, clean negatives ${a.cleanNegatives}/${t.negatives}`);
        }
        lines.push(`  stage-1 misses: ${t.stage1Misses.length === 0 ? 'none' : t.stage1Misses.join(', ')}`);
        lines.push(`  weakest gold score: ${t.weakestGold === null ? '-' : `${fmt(t.weakestGold.score)} (situation ${t.weakestGold.n})`}`);
        lines.push(`  strongest ghost on a negative: ${t.strongestGhost === null ? '-'
            : `${fmt(t.strongestGhost.score)} ${endpointLib.neutralize(t.strongestGhost.name)} (situation ${t.strongestGhost.n})`}`);
        lines.push(`  requests ${s.tally.requests}, input tokens ${s.tally.inputTokens}`);
        const unmeasured = s.results.filter((r) => r.unmeasured).map((r) => r.n);
        if (unmeasured.length > 0) lines.push(`  unmeasured: ${unmeasured.join(', ')}`);
    }
    const total = SHAPES.reduce((acc, shape) => ({
        requests: acc.requests + shapes[shape].tally.requests,
        inputTokens: acc.inputTokens + shapes[shape].tally.inputTokens
    }), { requests: 0, inputTokens: 0 });
    lines.push('', `total: ${cases.length} situations, requests ${total.requests}, input tokens ${total.inputTokens}`);
    return lines;
}

// -------------------------------------------------------------------- mock --

// In-process stand-ins for the memory database and the endpoint. Every stage
// after them runs unchanged: the question build, the request with its key
// header, the 429 backoff, the bounded body read, the answer spelling, the
// archived status, a stage-1 miss, the scoring and the report. Gold records
// score 0.9 and fillers a fixed score of at most 0.45, derived from the name and
// the state so every run answers alike.
function mockIo(cases, key) {
    const firstPositive = cases.find((c) => c.gold.length > 0);
    let posts = 0;
    const fillerScore = (text) => {
        let h = 0;
        for (const ch of text) h = (h * 31 + ch.codePointAt(0)) % 1000;
        return Math.round((h / 1000) * 45) / 100;
    };
    return {
        // A situation whose text holds `mock-empty-shortlist` gets an empty shortlist in both
        // shapes, which the run records as unmeasured.
        stage1: async (row) => (row.situation.includes('mock-empty-shortlist')
            ? { ok: true, lists: SHAPES.map(() => []) } : {
            ok: true,
            lists: SHAPES.map((shape) => {
                const gold = (row === firstPositive && shape === 'composed') ? [] : row.gold;
                const rows = gold.map((name) => ({ name, description: 'mock gold record', archived: false }));
                for (let i = rows.length; i < FETCH_LIMIT; i += 1) {
                    rows.push({ name: `mock-filler-${i}`, description: 'mock filler record', archived: i % 7 === 0 });
                }
                return rows;
            })
        }),
        post: async (url, init) => {
            posts += 1;
            if (init.headers.authorization !== `Bearer ${key}`) return new Response('{}', { status: 401 });
            if (posts === 1) return new Response('', { status: 429 });
            const request = JSON.parse(init.body);
            const answers = {};
            Object.keys(request.questions).forEach((id) => {
                const title = request.questions[id].instructions.record_title;
                const p = title.startsWith('mock-filler-') ? fillerScore(title + request.state) : 0.9;
                answers[id] = { noul: p };
            });
            const usage = { input_tokens: 150 * Object.keys(answers).length };
            return new Response(JSON.stringify({ answers, usage }), { status: 200 });
        },
        sleep: async () => {}
    };
}

function liveIo() {
    return {
        stage1: liveStage1,
        post: (url, init) => fetch(url, init),
        sleep: (ms) => new Promise((resolve) => { setTimeout(resolve, ms); })
    };
}

// -------------------------------------------------------------------- main --

function parseArgs(argv) {
    let cases = DEFAULT_CASES;
    for (let i = 0; i < argv.length; i += 1) {
        if (argv[i] === '--cases') {
            if (i + 1 >= argv.length) return refusal('--cases needs a file');
            cases = path.resolve(argv[i + 1]);
            i += 1;
        } else {
            return refusal(`unknown argument: ${endpointLib.neutralize(argv[i])}`);
        }
    }
    return { ok: true, cases };
}

async function runBattery(cases, io, key, endpoint) {
    const shapes = {};
    for (const shape of SHAPES) shapes[shape] = { results: [], tally: { requests: 0, inputTokens: 0 } };
    for (const row of cases) {
        const fetched = await io.stage1(row);
        for (let s = 0; s < SHAPES.length; s += 1) {
            const shape = SHAPES[s];
            const bucket = shapes[shape];
            if (!fetched.ok) {
                bucket.results.push({ n: row.n, unmeasured: fetched.detail });
                continue;
            }
            const candidates = fetched.lists[s].map(candidateOf);
            // An empty shortlist judged nothing, so it is no evidence of a clean
            // negative and no stage-1 miss either.
            if (candidates.length === 0) {
                bucket.results.push({ n: row.n, unmeasured: 'stage 1 returned no candidates' });
                continue;
            }
            const questions = questionsFor(candidates);
            const answered = await ask(io, key, endpoint, row[shape], questions, bucket.tally);
            if (!answered.ok) {
                bucket.results.push({ n: row.n, unmeasured: answered.detail });
                continue;
            }
            bucket.tally.inputTokens += answered.inputTokens;
            bucket.results.push(scoreOne(row, candidates, answered.scores));
        }
    }
    for (const shape of SHAPES) {
        shapes[shape].totals = totalsFor(shapes[shape].results.filter((r) => !r.unmeasured), cases);
    }
    return shapes;
}

async function main() {
    const args = parseArgs(process.argv.slice(2));
    if (!args.ok) {
        process.stderr.write(`jev battery: ${args.detail}\n${USAGE}\n`);
        return 2;
    }
    const loaded = loadCases(args.cases);
    if (!loaded.ok) {
        process.stderr.write(`jev battery: refused: ${loaded.detail}\n`);
        return 2;
    }
    const cases = loaded.cases;
    const mock = process.env.MOCK === '1';
    const envKey = typeof process.env.TYPESAFE_API_KEY === 'string' ? process.env.TYPESAFE_API_KEY.trim() : '';
    if (!mock && envKey === '') {
        process.stderr.write('jev battery: refused: TYPESAFE_API_KEY is not set, and a live run needs it (MOCK=1 runs without it)\n');
        return 2;
    }
    const target = resolveEndpoint(process.env.TYPESAFE_API_URL);
    if (!target.ok) {
        process.stderr.write(`jev battery: refused: ${target.detail}\n`);
        return 2;
    }
    const key = envKey === '' ? 'mock-key' : envKey;
    const io = mock ? mockIo(cases, key) : liveIo();

    const negatives = cases.filter((c) => c.gold.length === 0).length;
    process.stdout.write(`jev battery: ${mock ? 'MOCK run, no network and no database' : 'live run'}; `
        + `${cases.length} situations (${cases.length - negatives} positive, ${negatives} negative), `
        + `usp_Search top ${FETCH_LIMIT}, model ${MODEL}\n`);
    if (!mock) {
        process.stderr.write('jev battery: this run sends each situation\'s text and each candidate record\'s '
            + 'name, description and status off this machine to the endpoint TYPESAFE_API_URL names '
            + '(the vendor\'s by default); record bodies are not sent\n');
    }

    const shapes = await runBattery(cases, io, key, target.endpoint);
    process.stdout.write(reportLines(shapes, cases).join('\n') + '\n');

    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const outDir = path.join(process.cwd(), '.kit', 'jev-battery', `${stamp}-${process.pid}`);
    fs.mkdirSync(outDir, { recursive: true });
    const outFile = path.join(outDir, 'results.json');
    fs.writeFileSync(outFile, JSON.stringify({
        mode: mock ? 'mock' : 'live',
        model: MODEL,
        fetchLimit: FETCH_LIMIT,
        thresholds: THRESHOLDS,
        shapes
    }, null, 2) + '\n', 'utf8');
    process.stdout.write(`results: ${outFile}\n`);

    const unmeasured = SHAPES.some((shape) => shapes[shape].results.some((r) => r.unmeasured));
    return unmeasured ? 1 : 0;
}

if (require.main === module) {
    // An unexpected throw is named by its error code alone, never its message,
    // on the same terms as every refusal above.
    main().then((code) => { process.exitCode = code; }, (err) => {
        const code = (err && typeof err.code === 'string') ? ` (${endpointLib.neutralize(err.code)})` : '';
        process.stderr.write(`jev battery: the run failed before it finished${code}\n`);
        process.exitCode = 1;
    });
}

module.exports = { loadCases, scoreOne, MIN_NEGATIVES };
