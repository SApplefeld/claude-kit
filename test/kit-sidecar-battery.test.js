// Tests for sidecar/battery.js (the regression battery runner) and
// sidecar/harvest.js (the transcript harvest command).
//
// Node's built-in test runner, no framework (Node v24).
//
// NO CASE HERE TALKS TO THE LIVE ENDPOINT. battery.js needs a real judge and
// a real recognizer to be worth anything, but its own tests must not: every
// case here that drives the daemon points --config at a mock HTTP server on
// an ephemeral port, per sidecar/battery.js's own header. And every case
// uses a temp state root and a temp memory root under os.tmpdir(), so no run
// of this suite WRITES anything under the real ~/.claude.
//
// NO CASE HERE READS IT EITHER, AND THE CONDITION IS AMBIENT STATE RATHER THAN
// A CALL SHAPE. The screen resolves the tree it screens against from its home
// operand, and with that operand absent or empty it falls back to os.homedir(),
// which itself resolves from HOME and USERPROFILE. So there are exactly two
// routes into the operator's real tree, and this file has to close both:
//
//   ROUTE ONE, an unpinned ARGUMENT, in process. Every in-process call of the
//     state-root screen, and every in-process call of a command main that
//     reaches one, passes a home operand naming a fixture. os.homedir() is read
//     inside this process, so no environment a case sets reaches those calls.
//   ROUTE TWO, an unpinned ENVIRONMENT, out of process. Every child this file
//     launches is started by the one launcher below, which supplies HOME and
//     USERPROFILE from a fixture home whether or not the case asked for one.
//     A child started any other way inherits this process's own environment,
//     which is the operator's, and the shipped screen inside that child then
//     reads the operator's store.
//
// os.homedir() is still called here, for the string it returns and never as a
// path to open: to compute the default state root's position BELOW a home so a
// fixture home can be given that same shape without spelling the sidecar
// directory's name here, and to name the tree the two effect-observing cases
// watch for and must find nothing at.
//
// Standing Brief Amendment 5 is what this paragraph is, and Amendment 9 is why
// it is written as a condition with two routes rather than as a rule about
// arguments: the operator's own store is not an input to a test of the guard
// that protects it. The paragraph is not left to be read and believed, because
// the way it fails is indirect on both routes: a call into the screen with no
// home operand opens the live tree three ways without ever spelling os.homedir()
// here, and a spawn with no env operand does the same in a child without
// spelling anything at all. Four cases check what an accounting of call sites
// cannot: two source predicates, one per route, and two cases that measure the
// filesystem calls the effect actually makes, one in this process and one across
// the process boundary, since an in-process recorder is structurally blind to a
// child.
//
// EVERY CASE BUILDS THE STATE ITS OWN BRANCH NEEDS. A shared fixture that
// every case reuses is the shape the plan's Standing Brief Amendment 2 rules
// out: a mock answer that already agrees with every case's expectation
// would leave the substance-versus-enum rule, the disagreement report and the
// pass/fail threshold all untested by a suite that reads as if it covered
// them.
//
// EVERY CLI CASE RUNS AS A SUBPROCESS, never in-process with
// process.stdout/stderr reassigned. Node's test runner reports concurrently
// running tests through those same globals, so a test that owns them across
// an await can swallow another test's still-pending report line, which reads
// as that test having silently never run; that held even for the fast,
// local-file-only harvest cases, since the hazard is Node's own test
// scheduling and not the speed of what runs under the override. runBattery
// and runHarvest below spawn the real CLI async (never spawnSync: the mock
// HTTP server a battery case talks to lives in THIS process's event loop, and
// a synchronous, blocking wait for the child would freeze the loop that has
// to answer its requests) and hand back its real stdout, stderr and exit
// code, so a case asserts on precisely what an operator running the command
// would see.

'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { spawn, execFileSync } = require('node:child_process');

const battery = require('../sidecar/battery.js');
const harvest = require('../sidecar/harvest.js');
const logs = require('../sidecar/logs.js');
const memoryIndex = require('../sidecar/memory-index.js');
// sidecar/inbox.js is required here because its writing half is pinned in this
// file: it appends through logs.appendJsonLine and holds no guard of its own.
const inbox = require('../sidecar/inbox.js');
// sidecar/rollup.js and sidecar/text.js are required here for the cross-reader
// pin: the rollup and the battery report are two readers of one gap record, and
// a rendering that drifts between them is invisible from inside either.
const rollup = require('../sidecar/rollup.js');
const text = require('../sidecar/text.js');

const BATTERY_BIN = path.join(__dirname, '..', 'sidecar', 'battery.js');
const HARVEST_BIN = path.join(__dirname, '..', 'sidecar', 'harvest.js');

// A home directory every child of this suite gets, whether or not its case
// names one. HOME and USERPROFILE are what os.homedir() reads, so a child that
// inherited this process's own would resolve the operator's live store as its
// default state root: not a write, since the screen refuses it, but the guard
// under test is exactly what that claim rests on, and Standing Brief Amendment
// 5 does not let a section's tests aim the code under test at the operator's
// store on the strength of the guard they exist to test. Created once, since
// every child that does not care which home it has can share one.
let suiteHomePath = null;
function suiteHome() {
    if (suiteHomePath === null) {
        suiteHomePath = makeDir('kit-sidecar-battery-suitehome-');
        fs.mkdirSync(path.join(suiteHomePath, '.claude'), { recursive: true });
        process.on('exit', () => rmDir(suiteHomePath));
    }
    return suiteHomePath;
}

// THE ONE PLACE THIS FILE STARTS A CHILD, and that is the function's purpose
// rather than a convenience it happens to offer. A child inherits this
// process's environment unless it is given one, this process's environment is
// the operator's, and os.homedir() inside the child reads HOME and USERPROFILE
// from it, so a child started anywhere else screens against the operator's real
// store no matter how careful the case's own paths are. Routing every start
// through here is what lets the predicate below decide the question by the
// shape of the file rather than by an inventory of the sites somebody listed:
// the interpreter is named in exactly one place, so a site added later without
// a fixture home cannot be written without moving that name.
//
// `env` overrides go to the child only, over the shared fixture home above, so
// a case that needs the code under test to resolve its own live paths inside a
// home of its own points them there, which is
// test/kit-sidecar-capture.test.js's own convention in this repository.
// `options` carries anything else spawn takes (a cwd, for the case that needs
// the child's working directory to differ from this one); it can no more drop
// the fixture home than a caller of runBin can, because the env is composed
// after it.
function spawnPinned(bin, args, env, options) {
    const home = suiteHome();
    return spawn(process.execPath, [bin, ...args], {
        ...(options !== undefined && options !== null ? options : {}),
        env: { ...process.env, HOME: home, USERPROFILE: home, ...env }
    });
}

function runBin(bin, args, env, options) {
    return new Promise((resolve, reject) => {
        const child = spawnPinned(bin, args, env, options);
        let stdout = '';
        let stderr = '';
        child.stdout.on('data', (d) => { stdout += d; });
        child.stderr.on('data', (d) => { stderr += d; });
        child.on('error', reject);
        child.on('close', (code) => resolve({ code, stdout, stderr }));
    });
}
function runBattery(args, env) { return runBin(BATTERY_BIN, args, env); }
function runHarvest(args, env) { return runBin(HARVEST_BIN, args, env); }

// A home directory this suite owns, with a `.claude` under it, handed to a
// child as HOME and USERPROFILE. Every case that drives the refusal through the
// real CLI uses one of these: the paths those cases name are refused only if
// the screen works, and Standing Brief Amendment 5 does not let a section's
// tests aim the code under test at the operator's own store on the strength of
// the very guard they exist to test.
function fixtureHomeDir(t) {
    const home = makeDir('kit-sidecar-battery-home-');
    t.after(() => rmDir(home));
    fs.mkdirSync(path.join(home, '.claude'), { recursive: true });
    return home;
}

// A fixture home and a state root inside it, for a case that drives
// battery.main or harvest.main IN PROCESS.
//
// Such a case cannot point the live-tree screen anywhere with an environment
// variable. The screen resolves the operator's home with os.homedir(), read
// inside THIS process, so HOME and USERPROFILE on a child are not in the path:
// only the home operand main threads through to the screen is. The state root
// sits under the fixture home rather than beside it so the screen answers about
// the tree the case actually built, and outside its `.claude` so the answer is
// ok.
function inProcessRoots(t) {
    const home = fixtureHomeDir(t);
    const stateDir = path.join(home, 'state');
    fs.mkdirSync(stateDir, { recursive: true });
    return { home, stateDir };
}

// ------------------------------------- the suite's own no-live-home rule ---

// THE GENERATING RULE, stated so the check below can be read against it rather
// than against a list of places somebody looked.
//
// sidecar/state-screen.js resolves the live tree from its `homeDir` operand,
// and liveHomeTree falls back to os.homedir() whenever that operand is absent
// or empty. So ANY invocation of the state-root screen carrying fewer than two
// arguments opens the operator's real `~/.claude`: fs.realpathSync and
// fs.realpathSync.native through the string overlay and the anchor walk, and
// fs.statSync with `bigint` through the identity read. Nothing about the call's
// spelling, its variable names or the branch it was written to test changes
// that. Standing Brief Amendment 5 bars it, and Amendment 6 bars closing it by
// enumerating the call sites: the one that breaks the rule is by definition the
// one no list suggested.
//
// So the predicate is over the SHAPE of a call. Two halves, and together they
// are total over the file:
//
//   1. Every call whose callee names the screen carries at least two top-level
//      arguments. A call site added at a line nobody listed is caught by this,
//      because the check finds it by parsing the source rather than by knowing
//      it is there.
//   2. The screen's name appears only as the callee of a call, never as a bare
//      value. A reference handed to another function carries no arity this
//      predicate can read, so the file spells a two-argument wrapper instead
//      and the wrapper's own call is caught by the first half.
//
// The name is also the reason half 2 governs prose: a comment spelling it
// outside a call reddens this case. Say "the state-root screen" in prose and
// keep the identifier for code.
// Assembled from two halves rather than written whole, because the scan below
// reads this file's own bytes and a literal spelling it here would be a bare
// reference to itself and fail half 2 against its own source.
const SCREEN_NAME = 'screen' + 'StateDir';

// The bracketed region that opens at `open`, read as a scan rather than as a
// regular expression because the arguments nest (`f(g(h(x)), y)`) and a pattern
// that miscounts them answers this question wrongly in the accepting direction.
// It hands back where the region closes, how many top-level arguments it holds
// and where each top-level comma sat, which is what lets a caller take the
// SECOND argument's own text rather than guessing at where the call ends.
//
// COMMENTS ARE SKIPPED ON BOTH SETTINGS, and that is not cosmetic. A comment
// inside an argument list holds commas, brackets and apostrophes, and a scanner
// that reads them counts `f(p /* second operand omitted */)` as two arguments
// and lets a lone apostrophe in prose flip its quote state for the rest of the
// file: both are false passes, in the accepting direction, which is the one
// direction a guard's own check must not fail in.
//
// QUOTES ARE TRACKED ONLY WHEN THE CALLER ASKS. A call written into a generated
// driver program lives inside string literals, and its brackets are still
// balanced there while its quote state is nonsense (the literals' own delimiters
// interleave with the driver's), so the caller that has to read such a call
// turns quote tracking off and matches brackets alone. The cost of that setting
// is stated where it is used: a string literal holding an unbalanced bracket
// inside the region would be misread.
function bracketRegion(source, open, trackQuotes) {
    let depth = 0;
    let args = 1;
    let empty = true;
    const commas = [];
    for (let i = open; i < source.length; i += 1) {
        const ch = source[i];
        const next = source[i + 1];
        if (ch === '/' && next === '/') {
            const nl = source.indexOf('\n', i);
            i = nl === -1 ? source.length : nl;
            continue;
        }
        if (ch === '/' && next === '*') {
            const close = source.indexOf('*/', i + 2);
            i = close === -1 ? source.length : close + 1;
            continue;
        }
        if (trackQuotes && (ch === "'" || ch === '"' || ch === '`')) {
            empty = false;
            i += 1;
            for (; i < source.length; i += 1) {
                if (source[i] === '\\') { i += 1; continue; }
                if (source[i] === ch) break;
            }
            continue;
        }
        if (ch === '(' || ch === '[' || ch === '{') {
            depth += 1;
            if (depth > 1) empty = false;
            continue;
        }
        if (ch === ')' || ch === ']' || ch === '}') {
            depth -= 1;
            if (depth === 0) return { end: i, args: empty ? 0 : args, commas };
            continue;
        }
        if (ch === ',' && depth === 1) { args += 1; commas.push(i); continue; }
        if (!/\s/.test(ch)) empty = false;
    }
    return { end: source.length, args: empty ? 0 : args, commas };
}

// Every place the source names the screen, as the call's top-level argument
// count or as a bare reference.
function screenInvocations(source) {
    const found = [];
    for (let i = source.indexOf(SCREEN_NAME); i !== -1; i = source.indexOf(SCREEN_NAME, i + 1)) {
        const before = source[i - 1];
        // A longer identifier that merely ends in these characters is not this
        // name. `.` and whitespace are what precede a real use.
        if (before !== undefined && /[A-Za-z0-9_$]/.test(before)) continue;
        const j = i + SCREEN_NAME.length;
        if (/[A-Za-z0-9_$]/.test(source[j] || '')) continue;
        const at = source.slice(0, i).split('\n').length;
        if (source[j] !== '(') { found.push({ line: at, args: null }); continue; }
        found.push({ line: at, args: bracketRegion(source, j, true).args });
    }
    return found;
}

// The check runs against this file's own source, which is the scope: every case
// in it that reaches the screen, directly or through a wrapper.
test('no case in this suite can reach the operator live ~/.claude through the state-root screen', (t) => {
    const source = fs.readFileSync(__filename, 'utf8');
    const found = screenInvocations(source);
    t.diagnostic(`state-root screen invocations in this file: ${found.length}, at lines `
        + `${found.map((c) => c.line).join(', ')}`);

    // The instrument speaks first, on an input built from the rule rather than
    // from anything this file spells: a one-argument call, a zero-argument call
    // and a bare reference, each on its own line, none of them a string any
    // real call site here uses. If the scan cannot see these it can see nothing.
    const control = [
        `const a = m.${SCREEN_NAME}(somewhereElse);`,
        `const b = ${SCREEN_NAME}();`,
        `wrap(m.${SCREEN_NAME});`,
        `const d = m.${SCREEN_NAME}(join(a, 'x,y'), aHome);`,
        // Two shapes a comment-blind scanner reads wrongly, the first of them in
        // the ACCEPTING direction: a comment holds commas, which counts a
        // one-operand call as two, and it holds apostrophes, which flip a quote
        // state that then swallows the operands after it.
        `const e = m.${SCREEN_NAME}(p /* the home operand, omitted */);`,
        `const f = m.${SCREEN_NAME}(p /* the operator's own home is not this */, aHome);`
    ].join('\n');
    assert.deepStrictEqual(screenInvocations(control).map((c) => c.args), [1, 0, null, 2, 1, 2],
        'the scan cannot read a call it was built to read, so its silence over this file proves nothing');

    const bare = found.filter((c) => c.args === null);
    assert.deepStrictEqual(bare.map((c) => c.line), [],
        `these lines name the state-root screen outside a call, so this check cannot read what home they `
            + `give it. In code, wrap it: (target, home) => battery.${SCREEN_NAME}(target, home). In prose, `
            + 'say "the state-root screen" instead');

    const homeless = found.filter((c) => c.args !== null && c.args < 2);
    assert.deepStrictEqual(homeless.map((c) => c.line), [],
        'these lines call the state-root screen with no home operand, so it falls back to os.homedir() and '
            + 'reads the operator live ~/.claude (Standing Brief Amendment 5). Pass a fixture home');

    // A floor under the scan itself. The two assertions above are satisfied by
    // finding nothing at all, which is what a scan pointed at the wrong bytes
    // or built on a broken match returns, and it reads exactly like a file with
    // no defect in it. The diagnostic above carries the count and the lines, so
    // the green is a reported result rather than a bare clean.
    assert.ok(found.length >= 10,
        `only ${found.length} invocations found in this file, which is fewer than it has: the scan is `
            + 'matching less than it should, so its two empty results say nothing');

    // THE RULE'S REACH IS WIDER THAN THIS FILE, so the scan runs where the rule
    // runs. The condition is about a screen call resolving its tree from ambient
    // state, and the calls that do that live in the two commands, which this
    // file reaches in process and never spells: an arity check scoped to one
    // test file returns the same green whether those sites carry an operand or
    // not. Only CALLS are read there. A bare reference is the ordinary shape in
    // a module that imports and re-exports the name, so the bare-reference half
    // of the rule is this file's own and is reported rather than asserted for
    // the callers.
    for (const rel of ['../sidecar/battery.js', '../sidecar/harvest.js']) {
        const callerSource = fs.readFileSync(path.join(__dirname, rel), 'utf8');
        const calls = screenInvocations(callerSource).filter((c) => c.args !== null);
        t.diagnostic(`state-root screen calls in ${rel}: ${calls.length}, at lines `
            + `${calls.map((c) => c.line).join(', ')}`);
        assert.ok(calls.length >= 2,
            `only ${calls.length} screen calls found in ${rel}, which is fewer than it has: the scan `
                + 'is matching less than it should, so its empty result says nothing');
        assert.deepStrictEqual(calls.filter((c) => c.args < 2).map((c) => c.line), [],
            `these lines in ${rel} call the state-root screen with one operand, so which tree the call `
                + 'screens against is decided by ambient state and is unreadable at the call site '
                + '(Standing Brief Amendment 9). Pass the home operand, even where its value is undefined');
    }

    // WHAT THIS PAIR OF SCANS STILL DOES NOT COVER, named rather than left to
    // read as clean: a call site in any module these three do not name, a call
    // through a reference this scan reports as bare, and the VALUE any of these
    // operands carries at run time, which no source predicate can read. The two
    // effect-observing cases at the end of this file are what cover the value,
    // one in this process and one in a child.
});

// ---------------------------------------------------------------- fixtures --

function makeDir(prefix) {
    return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

function rmDir(dir) {
    try { fs.rmSync(dir, { recursive: true, force: true }); } catch { /* best effort */ }
}

// A mock endpoint on an ephemeral port, on the same shape
// test/kit-sidecar-daemon.test.js uses: never a fixed port, so this file
// never serializes against a neighbour reaching for the same one.
// `handler(body)` returns the Ollama-shaped `response` string to send back.
function startServer(t, handler) {
    return new Promise((resolve) => {
        const server = http.createServer((req, res) => {
            let raw = '';
            req.on('data', (chunk) => { raw += chunk; });
            req.on('end', () => {
                let body = null;
                try { body = JSON.parse(raw); } catch { body = null; }
                const response = handler(body) || '';
                res.writeHead(200, { 'content-type': 'application/json' });
                res.end(JSON.stringify({ response }));
            });
        });
        server.listen(0, '127.0.0.1', () => {
            const url = `http://127.0.0.1:${server.address().port}`;
            const close = () => new Promise((done) => {
                server.closeAllConnections();
                server.close(() => done());
            });
            t.after(close);
            resolve({ url, close });
        });
    });
}

function isRecognitionBody(body) {
    return body !== null && typeof body === 'object' && body.format !== undefined
        && body.format.properties !== undefined && body.format.properties.applicable !== undefined;
}

function writeConfig(t, url) {
    const dir = makeDir('kit-sidecar-battery-cfg-');
    t.after(() => rmDir(dir));
    const file = path.join(dir, 'kit-endpoint.json');
    fs.writeFileSync(file, JSON.stringify({ url, model: 'test-model' }), 'utf8');
    return file;
}

function freshStateDir(t) {
    const dir = makeDir('kit-sidecar-battery-state-');
    t.after(() => rmDir(dir));
    return dir;
}

// -------------------------------------------------------------- fixtures ---

test('the frozen judgment fixture loads thirteen cases, each with an acceptable-verdicts list', () => {
    const cases = battery.loadJudgmentCases();
    assert.strictEqual(cases.length, 13);
    for (const c of cases) {
        assert.ok(Array.isArray(c.acceptableVerdicts) && c.acceptableVerdicts.length >= 1,
            `case ${c.n} carries no acceptable verdicts`);
        for (const v of c.acceptableVerdicts) assert.ok(['achieved', 'failed', 'diverged'].includes(v));
        assert.strictEqual(typeof c.intent, 'string');
        assert.strictEqual(typeof c.command, 'string');
        assert.strictEqual(typeof c.result, 'string');
    }
});

test('the frozen recognition fixture loads fifteen situations, twelve gold-labelled, plus its index', () => {
    const situations = battery.loadRecognitionSituations();
    assert.strictEqual(situations.length, 15);
    const goldBearing = situations.filter((s) => s.gold.length > 0);
    assert.strictEqual(goldBearing.length, 12);
    const text = battery.loadRecognitionIndexText();
    assert.ok(text.includes('- ['), 'the frozen index holds no record lines at all');
    // Every gold name across the battery must actually be in the frozen index,
    // as the real parser reads it. Asserting through memoryIndex.parseIndex
    // (rather than a bare string search for "(name.md)") pins the check to
    // the same parse the daemon's own recognition duty runs, so a change to
    // the index-line syntax the parser accepts is caught here too.
    const parsed = memoryIndex.parseIndex(text);
    for (const s of situations) {
        for (const g of s.gold) {
            assert.ok(parsed.names.has(g), `gold record ${g} is not in the frozen index as the real parser reads it`);
        }
    }
});

// -------------------------------------------------------- scoring: judgment --

// The mutation this pair proves: a scorer that ignored acceptableVerdicts and
// compared against a single string would pass case 2 on 'failed' alone and
// fail it on the allowed alternate 'diverged'. Both must score correct here,
// which only holds if the substance (list) rule is actually applied.
test('judgment scoring treats every listed acceptable verdict as correct, not just the first', () => {
    const cases = [
        { n: 1, acceptableVerdicts: ['failed', 'diverged'] }
    ];
    const asFailed = battery.scoreJudgment(cases, [
        { type: 'verdict', callId: battery.judgmentCallId(1, cases.length), verdict: 'failed', reason: 'r' }
    ]);
    const asDiverged = battery.scoreJudgment(cases, [
        { type: 'verdict', callId: battery.judgmentCallId(1, cases.length), verdict: 'diverged', reason: 'r' }
    ]);
    assert.strictEqual(asFailed.correct, 1);
    assert.strictEqual(asDiverged.correct, 1);
});

// The control: a verdict outside the acceptable list scores wrong. Without
// this case, a scorer that always returned "correct" would pass the two
// cases above for the wrong reason.
test('judgment scoring marks a verdict outside the acceptable list wrong, and reports the disagreement', () => {
    const cases = [{ n: 1, acceptableVerdicts: ['diverged'] }];
    const scored = battery.scoreJudgment(cases, [
        { type: 'verdict', callId: battery.judgmentCallId(1, cases.length), verdict: 'achieved', reason: 'looked fine to me' }
    ]);
    assert.strictEqual(scored.correct, 0);
    assert.strictEqual(scored.pass, false);
    const disagreement = scored.lines.find((l) => l.startsWith('#1'));
    assert.ok(disagreement.includes('expected=[diverged]'), disagreement);
    assert.ok(disagreement.includes('got=achieved'), disagreement);
    assert.ok(disagreement.includes('looked fine to me'), disagreement);
});

// CRITICAL 1's red/green pair, judgment side. A gapped case (no verdict
// record at all) must fail the battery even when every other case is
// correct, and removing the gap must green the identical battery: a scorer
// that only tracked the correct-count, never a separate measured-count, would
// print PASS on 12/13 correct with the 13th silently unmeasured.
test('judgment scoring fails on a gapped case even at floor, and passes once the gap is filled', () => {
    const cases = Array.from({ length: 13 }, (_, i) => ({ n: i + 1, acceptableVerdicts: ['achieved'] }));
    const record = (n, verdict) => ({ type: 'verdict', callId: battery.judgmentCallId(n, cases.length), verdict, reason: '' });
    const allButOne = Array.from({ length: 12 }, (_, i) => record(i + 1, 'achieved'));

    const gapped = battery.scoreJudgment(cases, allButOne);
    assert.strictEqual(gapped.correct, 12, 'twelve of thirteen scored correct, at the floor');
    assert.strictEqual(gapped.measured, 12);
    assert.strictEqual(gapped.unmeasured, 1);
    assert.strictEqual(gapped.pass, false, 'a gap must fail the battery even though correct >= the floor');
    assert.ok(gapped.lines.some((l) => l.includes('1 of 13 case(s) unmeasured')), gapped.lines.join('\n'));

    const filled = battery.scoreJudgment(cases, [...allButOne, record(13, 'achieved')]);
    assert.strictEqual(filled.unmeasured, 0);
    assert.strictEqual(filled.pass, true, 'the identical battery, gap filled, must pass');
});

test('judgment scoring reports a missing verdict record as cannot-measure, never as a silent zero', () => {
    const cases = [{ n: 1, acceptableVerdicts: ['achieved'] }];
    const scored = battery.scoreJudgment(cases, []);
    assert.strictEqual(scored.correct, 0);
    assert.ok(scored.lines[0].includes('CANNOT-MEASURE'), scored.lines[0]);
});

test('judgment scoring passes at the audition floor and fails one below it', () => {
    const cases = Array.from({ length: 13 }, (_, i) => ({ n: i + 1, acceptableVerdicts: ['achieved'] }));
    const record = (n, verdict) => ({ type: 'verdict', callId: battery.judgmentCallId(n, cases.length), verdict, reason: '' });
    const atFloor = battery.scoreJudgment(cases, [
        ...Array.from({ length: 12 }, (_, i) => record(i + 1, 'achieved')),
        record(13, 'failed')
    ]);
    assert.strictEqual(atFloor.correct, battery.JUDGMENT_MIN_CORRECT);
    assert.strictEqual(atFloor.pass, true);

    const belowFloor = battery.scoreJudgment(cases, [
        ...Array.from({ length: 11 }, (_, i) => record(i + 1, 'achieved')),
        record(12, 'failed'), record(13, 'failed')
    ]);
    assert.strictEqual(belowFloor.correct, battery.JUDGMENT_MIN_CORRECT - 1);
    assert.strictEqual(belowFloor.pass, false);
});

// ---------------------------------------------------------- scoring: recog --

test('recognition scoring counts a missed gold name and reports it, never silently', () => {
    const situations = [{ n: 1, gold: ['a-record'] }];
    const scored = battery.scoreRecognition(situations, [
        { type: 'recognition', callId: battery.recognitionCallId(1, situations.length), records: [], invented: [], reason: 'nothing bears on it' }
    ]);
    assert.strictEqual(scored.misses, 1);
    assert.strictEqual(scored.pass, false);
    assert.ok(scored.lines[0].includes('gold=[a-record]'));
    assert.ok(scored.lines[0].includes('got=[]'));
});

// The mutation this proves: a scorer comparing sets rather than gold-minus-got
// would treat an extra non-gold name as neutral. It is not; it must be
// counted so the extras ceiling can ever fire.
test('recognition scoring counts a non-gold name as an extra even when the gold name is also present', () => {
    const situations = [{ n: 1, gold: ['a-record'] }];
    const scored = battery.scoreRecognition(situations, [
        { type: 'recognition', callId: battery.recognitionCallId(1, situations.length), records: ['a-record', 'b-record'], invented: [], reason: 'r' }
    ]);
    assert.strictEqual(scored.misses, 0);
    assert.strictEqual(scored.extras, 1);
});

// CRITICAL 2's red/green pair. recognize.js splits a model's answer into
// `records` (names the index holds) and `invented` (names it does not); a
// scorer that only ever reads `records` is blind to a true negative answered
// with pure hallucination, which is exactly the axis the audition measured
// its false-positive rate on. This must red on invented names alone, with
// `records` clean.
test('recognition scoring counts invented (hallucinated) names as extras, not just non-gold records', () => {
    const situations = [{ n: 1, gold: [] }];
    const scored = battery.scoreRecognition(situations, [
        { type: 'recognition', callId: battery.recognitionCallId(1, situations.length), records: [], invented: ['not-a-real-record', 'also-invented'], reason: 'r' }
    ]);
    assert.strictEqual(scored.misses, 0);
    assert.strictEqual(scored.extras, 2, 'both invented names must be counted as extras');
});

test('recognition scoring fails once invented names push extras past the ceiling', () => {
    const situations = [{ n: 1, gold: [] }];
    const scored = battery.scoreRecognition(situations, [
        { type: 'recognition', callId: battery.recognitionCallId(1, situations.length), records: [], invented: ['x', 'y', 'z'], reason: 'r' }
    ]);
    assert.strictEqual(scored.extras, 3);
    assert.strictEqual(scored.pass, false);
});

test('recognition scoring passes at up to two extras and fails at three', () => {
    const situations = [
        { n: 1, gold: [] }, { n: 2, gold: [] }, { n: 3, gold: [] }
    ];
    const record = (n, records) => ({ type: 'recognition', callId: battery.recognitionCallId(n, situations.length), records, invented: [], reason: '' });
    const twoExtras = battery.scoreRecognition(situations, [record(1, ['x']), record(2, ['y']), record(3, [])]);
    assert.strictEqual(twoExtras.extras, 2);
    assert.strictEqual(twoExtras.pass, true);

    const threeExtras = battery.scoreRecognition(situations, [record(1, ['x']), record(2, ['y']), record(3, ['z'])]);
    assert.strictEqual(threeExtras.extras, 3);
    assert.strictEqual(threeExtras.pass, false);
});

// A gapped situation is a cannot-measure and its gold is counted apart, never
// as recall misses. This reds against the arithmetic that added a gapped
// situation's whole gold list to `misses`: fifteen situations against a dead
// endpoint printed "recall misses 12", which is the number a reader compares
// with the audition's own 12/12 recall, so an outage rendered as a regression
// on the one line that decides which of the two it was. scoreJudgment already
// refuses the same conflation, and `pass` is false through `unmeasured` either
// way, so the separation costs nothing.
test('recognition scoring reports a missing recognition record as cannot-measure and counts its gold apart from misses', () => {
    const situations = [{ n: 1, gold: ['a-record'] }];
    const scored = battery.scoreRecognition(situations, []);
    assert.strictEqual(scored.misses, 0, 'a name nobody was asked for is not a recall miss');
    assert.strictEqual(scored.unmeasuredGold, 1);
    assert.strictEqual(scored.unmeasured, 1);
    assert.strictEqual(scored.pass, false);
    assert.ok(scored.lines[0].includes('CANNOT-MEASURE'));
    assert.ok(scored.lines.some((l) => l.includes('recall misses 0')), scored.lines.join('\n'));
    assert.ok(scored.lines.some((l) => /1 gold name\(s\) sit in those unmeasured/.test(l)), scored.lines.join('\n'));
});

// The whole-battery shape of the same finding, and the control that the miss
// counter still counts a real miss: fifteen situations, none measured, must
// print zero recall misses and name the twelve gold labels as unmeasured, while
// one measured situation that genuinely dropped its gold name still counts one.
test('a dead endpoint prints zero recall misses across the whole recognition fixture, and a real miss still counts', () => {
    const situations = battery.loadRecognitionSituations();
    const goldTotal = situations.reduce((n, s) => n + s.gold.length, 0);
    const dead = battery.scoreRecognition(situations, []);
    assert.strictEqual(dead.misses, 0, 'an unmeasured situation must not be reported as a recall regression');
    assert.strictEqual(dead.unmeasuredGold, goldTotal);
    assert.strictEqual(dead.pass, false);

    const withGold = situations.find((s) => s.gold.length > 0);
    const maxN = battery.maxItemN(situations);
    const measured = battery.scoreRecognition(situations, [{
        type: 'recognition', callId: battery.recognitionCallId(withGold.n, maxN),
        records: [], invented: [], reason: 'the model answered and named nothing'
    }]);
    assert.strictEqual(measured.misses, withGold.gold.length,
        'a situation the model actually answered must still count its missed gold names');
});

// MINOR 2's control: `records` and `invented` are what a recognition record's
// answer IS, and CONTRACT.md admits a hand-written log line. A record whose
// lists are not lists says nothing about what the model answered, so reading it
// as an empty answer scores a true negative as a clean negative and contributes
// to PASS.
test('a recognition record whose name lists are not lists is unmeasured, never an answer of nothing', () => {
    const situations = [{ n: 1, gold: [] }];
    const id = battery.recognitionCallId(1, 1);
    for (const bad of [
        { type: 'recognition', callId: id, records: 'a-record', invented: [], reason: 'r' },
        { type: 'recognition', callId: id, records: [], invented: null, reason: 'r' },
        { type: 'recognition', callId: id, reason: 'r' }
    ]) {
        const scored = battery.scoreRecognition(situations, [bad]);
        assert.strictEqual(scored.measured, 0, `${JSON.stringify(bad)} was read as a measured answer`);
        assert.strictEqual(scored.pass, false);
        assert.ok(scored.lines[0].includes('CANNOT-MEASURE'), scored.lines[0]);
    }
    // The control: the same situation with two real lists is measured, and a
    // clean true negative passes, so the refusal above is the shape check and
    // not a scorer that refuses everything.
    const good = battery.scoreRecognition(situations, [
        { type: 'recognition', callId: id, records: [], invented: [], reason: 'nothing bears on it' }
    ]);
    assert.strictEqual(good.measured, 1);
    assert.strictEqual(good.pass, true);
});

// CRITICAL 1's red/green pair, recognition side, including the negative
// denominator: a gapped true negative (gold []) must still land in negTotal,
// so "clean negatives X/Y" can never overstate Y by leaving an unmeasured
// negative out of the count, and the gap alone must fail the battery.
test('recognition scoring fails on a gapped situation and counts a gapped negative into the denominator', () => {
    const situations = [{ n: 1, gold: [] }, { n: 2, gold: ['a-record'] }];
    const onlyTwo = [
        { type: 'recognition', callId: battery.recognitionCallId(2, situations.length), records: ['a-record'], invented: [], reason: '' }
    ];
    const scored = battery.scoreRecognition(situations, onlyTwo);
    assert.strictEqual(scored.unmeasured, 1);
    assert.strictEqual(scored.pass, false, 'a gapped situation must fail the battery even though the measured one is clean');
    // negTotal (the denominator) must count the gapped negative even though it
    // is unmeasured; cleanNegs (the numerator) must not, since a gap is not a
    // clean answer. "0/1" is that: zero measured clean, one in the
    // denominator.
    assert.ok(scored.lines.some((l) => l.includes('recognition:') && l.includes('clean negatives 0/1')),
        `the gapped negative must still count in the denominator: ${scored.lines.join('\n')}`);
});

// ------------------------------------------------------------------- CLI ---

test('an absent endpoint config is reported by name and refused, never scored as zero', async (t) => {
    const stateDir = freshStateDir(t);
    const missing = path.join(stateDir, 'nothing.json');
    const result = await runBattery(['judgment', '--config', missing, '--state-dir', stateDir]);
    assert.strictEqual(result.code, 1);
    assert.ok(result.stderr.includes(missing), result.stderr);
    assert.ok(/no endpoint/i.test(result.stderr), result.stderr);
});

test('an unknown battery name is a usage error, exit 2, distinct from a run that fell short', async () => {
    // Driven through the real CLI, not through parseArgs alone, so the
    // assertion is on the exit code the title actually names rather than on
    // a signal (parseArgs().ok) that a main() collapsing exit 2 into exit 1
    // would leave this case blind to.
    const result = await runBattery(['not-a-battery']);
    assert.strictEqual(result.code, 2);
});

// MAJOR 4's control: a --state-dir naming the daemon's own default state root
// must be refused, exit 1, never silently accepted and then printed as "not the
// live store".
//
// The child's HOME and USERPROFILE point at a fixture home, so
// config.defaultStateDir() and the screen's own live-tree operand both resolve
// there and the identical refusal is exercised against a path this suite owns.
// The one case that must see the REAL live path is a predicate call that makes
// no writes and spawns no child; it is below, beside the other predicate cases.
// Aiming the CLI at the operator's own ~/.claude would be safe only for as long
// as the guard under test keeps working, which is the argument against it.
test('a --state-dir naming the default state root or under it is refused, never silently accepted', async (t) => {
    const config = require('../sidecar/config.js');
    const home = fixtureHomeDir(t);
    const server = await startServer(t, () => JSON.stringify({ verdict: 'achieved', reason: 'r' }));
    const configPath = writeConfig(t, server.url);
    // The same spelling the code under test uses, computed against the fixture
    // home rather than assembled by hand here.
    const liveUnder = path.join(home, path.relative(os.homedir(), config.defaultStateDir()), 'spool');
    const result = await runBattery(['judgment', '--config', configPath, '--state-dir', liveUnder],
        { HOME: home, USERPROFILE: home });
    assert.strictEqual(result.code, 1, result.stdout + result.stderr);
    assert.ok(/refus/i.test(result.stderr), result.stderr);
    assert.ok(result.stderr.includes(liveUnder), result.stderr);
    // Named rather than left to the exit code: the rule that refused it is the
    // spelling comparison, the candidate path being under the live tree by name
    // with no link anywhere on it.
    assert.ok(/names a path inside the live/.test(result.stderr), result.stderr);
});

// A small end-to-end pass, judgment only, against a mock endpoint that always
// answers with each case's own first acceptable verdict: proves the whole
// wire (fixture -> spool -> daemon -> verdict log -> scorer -> exit code)
// without a live call, and gives the disagreement path below its true
// negative control.
test('a mock endpoint answering every case correctly drives the whole battery to PASS, exit 0', async (t) => {
    const cases = battery.loadJudgmentCases();
    const server = await startServer(t, (body) => {
        // Find which case this call is judging by its own fenced INTENT text.
        const c = cases.find((cc) => body.prompt.includes(cc.intent.slice(0, 40)));
        return JSON.stringify({ verdict: c ? c.acceptableVerdicts[0] : 'achieved', reason: 'matches the fixture' });
    });
    const configPath = writeConfig(t, server.url);
    const stateDir = freshStateDir(t);
    const result = await runBattery(['judgment', '--config', configPath, '--state-dir', stateDir]);
    assert.strictEqual(result.code, 0, result.stdout + result.stderr);
    assert.ok(result.stdout.includes('OVERALL: PASS'));
});

// The negative control on the same wire: a mock that answers every case
// WRONG must drive the same pipeline to FAIL and name every one of the
// disagreements. Without this case, the PASS case above could be passing
// because the scorer never actually reads the mock's answers.
//
// The exit code is 3, not 1: every case here was measured and the score fell
// below the floor, which is a different fact from the battery not having been
// able to measure, and the two now leave by different doors.
//
// Two mocks rather than one, because either alone leaves part of the fixture
// unexercised. Six of the thirteen cases accept `diverged` already (1, 2, 5,
// 6, 8 and 12), so the diverged mock can only disagree with seven; the
// achieved mock disagrees with exactly the other six. Between them every case
// in the fixture is named as a disagreement by one of the two runs.
for (const [verdict, label] of [['diverged', 'diverged'], ['achieved', 'achieved']]) {
    test(`a mock endpoint answering every case ${label} drives the whole battery to FAIL, exit 3, with every disagreeing case named`, async (t) => {
        const server = await startServer(t, () => JSON.stringify({ verdict, reason: 'deliberately wrong' }));
        const configPath = writeConfig(t, server.url);
        const stateDir = freshStateDir(t);
        const cases = battery.loadJudgmentCases();
        const result = await runBattery(['judgment', '--config', configPath, '--state-dir', stateDir]);
        assert.strictEqual(result.code, 3, result.stdout + result.stderr);
        const text = result.stdout;
        assert.ok(text.includes('OVERALL: FAIL'), text);
        assert.ok(text.includes('measured in full'), `a fully measured shortfall must say so: ${text}`);
        let named = 0;
        for (const c of cases) {
            if (c.acceptableVerdicts.includes(verdict)) continue;
            assert.ok(text.includes(`#${c.n} XX`), `case ${c.n} disagreement not reported:\n${text}`);
            named += 1;
        }
        assert.ok(named > 0, 'this mock disagreed with no case at all, so it controls nothing');
    });
}

test('a mock endpoint recognizing every gold record and nothing else drives the recognition battery to PASS', async (t) => {
    const situations = battery.loadRecognitionSituations();
    const server = await startServer(t, (body) => {
        if (!isRecognitionBody(body)) return JSON.stringify({ verdict: 'achieved', reason: 'not scored here' });
        const s = situations.find((ss) => body.prompt.includes(ss.situation.slice(0, 40)));
        return JSON.stringify({ applicable: s ? s.gold : [], reason: 'matches the fixture' });
    });
    const configPath = writeConfig(t, server.url);
    const stateDir = freshStateDir(t);
    const result = await runBattery(['recognition', '--config', configPath, '--state-dir', stateDir]);
    assert.strictEqual(result.code, 0, result.stdout + result.stderr);
    assert.ok(result.stdout.includes('OVERALL: PASS'));
});

// CRITICAL 2's end-to-end control: a mock that hallucinates two names on
// every true-negative situation must drive the recognition battery to FAIL,
// exit 1, even though every gold record is still recalled. Without this
// case, the PASS case above could be passing because the wire never actually
// carries `invented` through to the scorer.
test('a mock endpoint hallucinating names on true negatives drives the recognition battery to FAIL', async (t) => {
    const situations = battery.loadRecognitionSituations();
    const server = await startServer(t, (body) => {
        if (!isRecognitionBody(body)) return JSON.stringify({ verdict: 'achieved', reason: 'not scored here' });
        const s = situations.find((ss) => body.prompt.includes(ss.situation.slice(0, 40)));
        const gold = s ? s.gold : [];
        // On every true negative, answer with two names the frozen index does
        // not hold, so recall stays perfect and only invention can fail this.
        const applicable = gold.length === 0 ? ['not-a-real-record-one', 'not-a-real-record-two'] : gold;
        return JSON.stringify({ applicable, reason: 'hallucinated on a negative' });
    });
    const configPath = writeConfig(t, server.url);
    const stateDir = freshStateDir(t);
    const result = await runBattery(['recognition', '--config', configPath, '--state-dir', stateDir]);
    // Exit 3: every situation was measured and the extras ceiling was blown,
    // which is a regression rather than an outage.
    assert.strictEqual(result.code, 3, result.stdout + result.stderr);
    assert.ok(result.stdout.includes('OVERALL: FAIL'), result.stdout);
    assert.ok(result.stdout.includes('measured in full'), result.stdout);
});

// ---------------------------------------------------------------- harvest --

function writeTranscript(t, lines) {
    const dir = makeDir('kit-sidecar-harvest-');
    t.after(() => rmDir(dir));
    const file = path.join(dir, 'transcript.jsonl');
    fs.writeFileSync(file, lines.map((l) => JSON.stringify(l)).join('\n') + '\n', 'utf8');
    return { dir, file };
}

function bashLine(id, description, command) {
    return { message: { content: [{ type: 'tool_use', id, name: 'Bash', input: { description, command } }] } };
}

function resultLine(toolUseId, text, isError) {
    return { message: { content: [{ type: 'tool_result', tool_use_id: toolUseId, is_error: isError === true, content: text }] } };
}

test('harvest extracts a Bash pair as one judgeable triple, numbered by transcript position', async (t) => {
    const { file } = writeTranscript(t, [
        bashLine('t1', 'list the files', 'ls -la'),
        resultLine('t1', 'total 0', false)
    ]);
    const { pairs, unparsed, unpaired } = await harvest.extractPairs(file);
    assert.strictEqual(pairs.length, 1);
    assert.strictEqual(unparsed, 0);
    assert.strictEqual(unpaired, 0);
    assert.deepStrictEqual(pairs[0], { n: 1, intent: 'list the files', command: 'ls -la', result: 'total 0', isError: false });
});

// MAJOR 7's control: a line that is not JSON must be counted, not silently
// skipped, and a tool_use with no matching tool_result by end of file must be
// counted too. Without this case, a transcript in an unmatched shape prints
// "0 pairs found" indistinguishable from a session that ran no Bash.
test('harvest counts unparsed lines and unpaired tool_use calls rather than discarding them silently', async (t) => {
    const dir = makeDir('kit-sidecar-harvest-');
    t.after(() => rmDir(dir));
    const file = path.join(dir, 'transcript.jsonl');
    const lines = [
        'not json at all',
        JSON.stringify(bashLine('t1', 'paired', 'ls')),
        JSON.stringify(resultLine('t1', 'ok', false)),
        JSON.stringify(bashLine('t2', 'never gets a result', 'ls -la'))
    ];
    fs.writeFileSync(file, lines.join('\n') + '\n', 'utf8');
    const { pairs, unparsed, unpaired } = await harvest.extractPairs(file);
    assert.strictEqual(pairs.length, 1);
    assert.strictEqual(unparsed, 1);
    assert.strictEqual(unpaired, 1);
});

// The control for the error flag: a pair whose result is clean prose but
// whose is_error is true must still be flagged, proving the flag is read
// rather than inferred from the text.
test('harvest reads the harness error flag rather than guessing it from the result text', async (t) => {
    const { file } = writeTranscript(t, [
        bashLine('t1', 'a call the harness flagged', 'true'),
        resultLine('t1', 'perfectly ordinary output', true)
    ]);
    const { pairs } = await harvest.extractPairs(file);
    assert.strictEqual(pairs[0].isError, true);
});

test('harvest joins array-shaped tool_result content across its text blocks', async (t) => {
    const { file } = writeTranscript(t, [
        bashLine('t1', 'multi-block result', 'echo hi'),
        { message: { content: [{ type: 'tool_result', tool_use_id: 't1', is_error: false, content: [{ type: 'text', text: 'line one' }, { type: 'text', text: 'line two' }] }] } }
    ]);
    const { pairs } = await harvest.extractPairs(file);
    // Joined with a newline by resultTextOf and stored with that newline
    // intact: cut() strips the unsafe class and nothing else. A collapse here
    // would make the stored triple a rendering of the call rather than the
    // call, which is the thing the judge is scored on.
    assert.strictEqual(pairs[0].result, 'line one\nline two');
});

// MAJOR 2's control, and the one that would have caught the collapse before
// it shipped: a real harvested command is frequently multi-line (a heredoc, a
// chained pipeline) and a real result is frequently line-structured (`git
// status --porcelain`, a directory listing), and the frozen judgment fixture
// is scored on exactly that structure. This must be red against a cut() that
// runs the whitespace collapse: every newline below becomes a space.
test('harvest keeps the line structure of a multi-line command and result in the stored field', async (t) => {
    const command = "cat <<'EOF' > out.txt\nline one\nline two\nEOF";
    const result = ' M sidecar/battery.js\n?? sidecar/new.js\n';
    const { file } = writeTranscript(t, [
        bashLine('t1', 'write a heredoc', command),
        resultLine('t1', result, false)
    ]);
    const { pairs } = await harvest.extractPairs(file);
    assert.strictEqual(pairs[0].command, command, 'the command lost its line structure');
    assert.strictEqual(pairs[0].result, result, 'the result lost its line structure');
    // Tab survives for the same reason, and is the character a collapse would
    // eat most invisibly.
    const { file: tabbed } = writeTranscript(t, [
        bashLine('t2', 'print a tab', 'printf "a\\tb"'),
        resultLine('t2', 'a\tb', false)
    ]);
    const second = await harvest.extractPairs(tabbed);
    assert.strictEqual(second.pairs[0].result, 'a\tb');
});

// The frozen fixture is the standing evidence for the rule above: every one
// of its thirteen results carries a newline, so no case in it could have been
// produced by a harvest that collapsed whitespace. This is the cross-check
// between the command and the artifact it exists to produce.
test('every frozen judgment case carries a multi-line result, which a collapsing harvest could not produce', () => {
    const cases = battery.loadJudgmentCases();
    const flat = cases.filter((c) => !c.result.includes('\n'));
    assert.deepStrictEqual(flat.map((c) => c.n), [],
        'these frozen cases hold no newline, so the harvest that produced them cannot be pinned by this control');
});

// MAJOR 10's control: JSON.stringify escapes a C0 control character but
// passes a bidi override (U+202E) and a zero-width space (U+200B) through
// raw. neutralize() strips all three, so a harvested field carrying them must
// come back clean, proving cut() actually calls it rather than merely
// capping length.
//
// BUILT FROM ESCAPES, never typed as raw code points. This repository is
// public, and a forge flags any source file holding a bidirectional override as
// a trojan-source hazard: the characters are invisible in a diff and reorder
// what a reviewer sees without changing what the parser reads. An escape is
// inert in the file and identical after parse, so the case proves the same
// property and the file carries nothing a reader cannot see.
const BIDI_OVERRIDE = '\u202e';
const ZERO_WIDTH_SPACE = '\u200b';
test('harvest neutralizes a bidi override and a zero-width character out of every field', async (t) => {
    const poisoned = `safe${BIDI_OVERRIDE}reversed${ZERO_WIDTH_SPACE}hidden`;
    const { file } = writeTranscript(t, [
        bashLine('t1', `intent ${poisoned}`, `echo ${poisoned}`),
        resultLine('t1', `result ${poisoned}`, false)
    ]);
    const { pairs } = await harvest.extractPairs(file);
    for (const field of [pairs[0].intent, pairs[0].command, pairs[0].result]) {
        assert.ok(!field.includes(BIDI_OVERRIDE), `bidi override survived in: ${field}`);
        assert.ok(!field.includes(ZERO_WIDTH_SPACE), `zero-width space survived in: ${field}`);
    }
});

test('harvest selection prefers failure-shaped pairs and fills the remaining budget with clean ones', () => {
    const clean = { n: 1, intent: 'clean', command: 'ls', result: 'fine', isError: false };
    const failed = { n: 2, intent: 'failed', command: 'ls', result: 'error: not found', isError: false };
    const selected = harvest.selectTriples([clean, clean, failed], 2);
    assert.strictEqual(selected.triples.length, 2);
    assert.strictEqual(selected.triples[0].intent, 'failed');
});

// MAJOR 8's control: a transcript almost entirely failure-shaped must not
// starve the clean side of the budget out completely. At most half the limit
// is failure-shaped by design, so a transcript with far more interesting
// pairs than the limit must still surface at least one clean pair.
test('harvest selection reserves at most half the budget for failure-shaped pairs, even when far more are available', () => {
    const interesting = Array.from({ length: 20 }, (_, i) => ({ n: i + 1, intent: 'i', command: 'x', result: 'error: boom', isError: false }));
    const clean = Array.from({ length: 20 }, (_, i) => ({ n: 100 + i, intent: 'c', command: 'x', result: 'fine', isError: false }));
    const selected = harvest.selectTriples([...interesting, ...clean], 10);
    assert.strictEqual(selected.triples.length, 10);
    assert.ok(selected.interestingChosen <= 5, `interesting must not exceed half the budget: got ${selected.interestingChosen}`);
    assert.ok(selected.cleanChosen >= 5, `clean must fill at least half the budget when available: got ${selected.cleanChosen}`);
});

// MINOR 6's control: n is the pair's transcript position, assigned at
// extraction, so it does not move when --limit changes what gets shown.
test('harvest triple numbering (n) is stable across two different --limit values', () => {
    const pairs = Array.from({ length: 5 }, (_, i) => ({ n: i + 1, intent: `c${i}`, command: 'ls', result: 'ok', isError: false }));
    const small = harvest.selectTriples(pairs, 2);
    const large = harvest.selectTriples(pairs, 5);
    const nInSmall = small.triples.map((p) => p.n);
    for (const n of nInSmall) {
        const matchInLarge = large.triples.find((p) => p.n === n);
        assert.ok(matchInLarge, `n=${n} chosen at limit 2 must still carry the same n at limit 5`);
    }
});

// The control on --limit: without it, a large transcript's whole pair count
// would print in full every run.
test('harvest --limit bounds the printed output, never the found count', async (t) => {
    const lines = [];
    for (let i = 0; i < 5; i += 1) {
        lines.push(bashLine(`t${i}`, `call ${i}`, 'ls'));
        lines.push(resultLine(`t${i}`, 'ok', false));
    }
    const { file } = writeTranscript(t, lines);
    const { pairs } = await harvest.extractPairs(file);
    assert.strictEqual(pairs.length, 5);
    const selected = harvest.selectTriples(pairs, 2);
    assert.strictEqual(selected.triples.length, 2);
});

test('harvest requires a transcript argument and never scans a directory on its own', async () => {
    const result = await runHarvest([]);
    assert.strictEqual(result.code, 2);
    assert.ok(result.stderr.includes('required'), result.stderr);
});

// The control: passing a directory (which DOES exist and DOES hold a real
// transcript inside it) must be refused, never silently read as "scan this
// directory for a transcript". Without this case, a harvest command that
// quietly globbed *.jsonl under whatever path it was given would pass every
// other test here for the wrong reason.
test('harvest refuses a directory path rather than scanning it', async (t) => {
    const { dir } = writeTranscript(t, [bashLine('t1', 'x', 'ls'), resultLine('t1', 'ok', false)]);
    const result = await runHarvest([dir]);
    assert.strictEqual(result.code, 1);
    assert.ok(/not a real file/.test(result.stderr), result.stderr);
});

test('harvest with --out writes the JSON array and touches no other path', async (t) => {
    const { dir, file } = writeTranscript(t, [bashLine('t1', 'x', 'ls -la'), resultLine('t1', 'ok', false)]);
    const before = fs.readdirSync(dir).sort();
    const outPath = path.join(dir, 'harvested.json');
    const result = await runHarvest([file, '--out', outPath]);
    assert.strictEqual(result.code, 0, result.stdout + result.stderr);
    const after = fs.readdirSync(dir).sort();
    assert.deepStrictEqual(after, [...before, 'harvested.json'].sort());
    const written = JSON.parse(fs.readFileSync(outPath, 'utf8'));
    assert.strictEqual(written.length, 1);
    assert.strictEqual(written[0].command, 'ls -la');
});

// MAJOR 10's control: --out follows whatever path it is given, so a link
// planted at that path would be written through and whatever it points at
// overwritten. Section 2's review named the symlink half of a path guard with
// no case behind it as Standing Brief Amendment 2 landing on a security
// control; this is that case for this guard.
//
// On this platform a file symlink needs a privilege the suite does not hold,
// so the link is a junction to a directory holding the canary, and what it
// proves is that the guard fires and the canary survives. The POSIX branch
// points the link straight at the canary file, which is the stronger form.
test('harvest refuses to write --out through a planted link, and the canary is untouched', async (t) => {
    const { file } = writeTranscript(t, [bashLine('t1', 'x', 'ls'), resultLine('t1', 'ok', false)]);
    const linkDir = makeDir('kit-sidecar-harvest-link-');
    const target = makeDir('kit-sidecar-harvest-target-');
    t.after(() => { rmDir(linkDir); rmDir(target); });
    const canary = path.join(target, 'canary.txt');
    fs.writeFileSync(canary, 'do not overwrite me\n', 'utf8');
    const outPath = path.join(linkDir, 'harvested.json');
    if (process.platform === 'win32') {
        fs.symlinkSync(target, outPath, 'junction');
    } else {
        fs.symlinkSync(canary, outPath, 'file');
    }

    const result = await runHarvest([file, '--out', outPath]);
    assert.strictEqual(result.code, 1, result.stdout + result.stderr);
    assert.ok(/symlink/.test(result.stderr), result.stderr);
    assert.strictEqual(fs.readFileSync(canary, 'utf8'), 'do not overwrite me\n', 'the canary was written through the link');
    assert.deepStrictEqual(fs.readdirSync(target), ['canary.txt'], 'something was written into the link target');

    // The control: the same command at an unlinked path writes normally, so
    // the refusal above is the guard rather than a broken --out.
    const plain = path.join(linkDir, 'plain.json');
    const ok = await runHarvest([file, '--out', plain]);
    assert.strictEqual(ok.code, 0, ok.stdout + ok.stderr);
    assert.strictEqual(JSON.parse(fs.readFileSync(plain, 'utf8')).length, 1);
});

// MINOR 4's control on the odd-limit boundary: ceil put more than half the
// budget on the failure-shaped side at every odd limit, and at --limit 1 spent
// the whole budget there, which is the outcome the split exists to prevent.
test('harvest selection keeps failure-shaped pairs at or below half the budget at an odd limit', () => {
    const interesting = Array.from({ length: 10 }, (_, i) => ({ n: i + 1, intent: 'i', command: 'x', result: 'error: boom', isError: false }));
    const clean = Array.from({ length: 10 }, (_, i) => ({ n: 100 + i, intent: 'c', command: 'x', result: 'fine', isError: false }));
    const pairs = [...interesting, ...clean];
    for (const limit of [3, 5, 7, 9]) {
        const selected = harvest.selectTriples(pairs, limit);
        assert.strictEqual(selected.triples.length, limit);
        assert.ok(selected.interestingChosen <= Math.floor(limit / 2),
            `at limit ${limit} the failure-shaped side took ${selected.interestingChosen}, past half`);
    }
    const one = harvest.selectTriples(pairs, 1);
    assert.strictEqual(one.triples.length, 1);
    assert.strictEqual(one.interestingChosen, 0, 'at limit 1 the whole budget must not be failure-shaped');
    // The drain-back control: with no clean pair to spend it on, the single
    // slot still gets filled.
    const noClean = harvest.selectTriples(interesting, 1);
    assert.strictEqual(noClean.triples.length, 1);
    assert.strictEqual(noClean.interestingChosen, 1);
});

// The isError half of the interesting predicate, which the result-text half
// otherwise covers for: a pair whose output reads as perfectly clean but whose
// harness flag is set must still be selected as failure-shaped.
test('harvest selection treats the harness error flag as failure-shaped on its own', () => {
    const flagged = { n: 1, intent: 'i', command: 'x', result: 'perfectly ordinary output', isError: true };
    const clean = Array.from({ length: 5 }, (_, i) => ({ n: 10 + i, intent: 'c', command: 'x', result: 'fine', isError: false }));
    const selected = harvest.selectTriples([...clean, flagged], 4);
    assert.strictEqual(selected.interestingFound, 1, 'the flagged pair was not read as failure-shaped');
    assert.ok(selected.triples.some((p) => p.n === 1), 'the flagged pair was not chosen');
});

// MINOR 6's control: a multi-digit exit status is a failure shape exactly as a
// single-digit one is, and the single-digit pattern classified 127 and 130 as
// clean.
test('harvest reads a multi-digit exit status as failure-shaped', () => {
    for (const text of ['exit code 1', 'exit code 127', 'exit code 130']) {
        assert.ok(harvest.FAILURE_RE.test(text), `${text} must be failure-shaped`);
    }
    assert.ok(!harvest.FAILURE_RE.test('exit code 0'), 'the control: a clean exit is not failure-shaped');
});

// ------------------------------------------------- the live-store refusal ---

// CRITICAL A's control, and the one that discriminates the widened scope from
// the one it replaced. The old screen compared only against
// ~/.claude/kit-sidecar, so every path below except the last two was accepted
// by it: --state-dir ~/.claude was taken, and config.statePaths then had the
// daemon create spool/, inbox/ and logs/ in the operator's live home and write
// fabricated verdict and recognition records into them. Each accepted-then and
// refused-now path can only pass here if the screen reaches the whole tree.
//
// This case makes no writes at all: it calls the predicate, against a fixture
// home. Amendment 5 holds for reads as well as writes, and the screen takes the
// home directory it compares against as an operand, so the fixture exercises
// the same branches the operator's own home would.
test('the state-root screen refuses the whole live .claude tree, not just the sidecar directory inside it', (t) => {
    const home = fixtureHomeDir(t);
    const claude = path.join(home, '.claude');
    const refusedNow = [
        claude,
        path.join(claude, 'projects'),
        path.join(claude, 'kit-sidecar-2'),
        path.join(claude, 'kit-sidecar'),
        path.join(claude, 'kit-sidecar', 'x')
    ];
    for (const p of refusedNow) {
        assert.strictEqual(battery.screenStateDir(p, home).status, 'refused', `${p} must be refused`);
    }
    // The daemon's own default state root, taken from config rather than
    // spelled here so a move of it cannot leave this case testing a name
    // nothing uses, and rebased onto the fixture home the same way the CLI
    // cases rebase it. Spelling `kit-sidecar` here instead would leave the
    // default free to move out from under the refusal.
    const config = require('../sidecar/config.js');
    const defaultUnderFixture = path.join(home, path.relative(os.homedir(), config.defaultStateDir()));
    assert.strictEqual(battery.screenStateDir(defaultUnderFixture, home).status, 'refused',
        'the default state root must be refused by the real predicate');
    // The control on the instrument itself: an ordinary scratch path is still
    // accepted, so the refusals above are the screen answering rather than the
    // screen refusing everything.
    assert.strictEqual(
        battery.screenStateDir(path.join(os.tmpdir(), 'kit-sidecar-battery-ok'), home).status, 'ok');
});

// A name list cannot cover a class, and the refused set above is a name list:
// home root, a project directory, the sidecar directory and a sibling of it.
// The class those names sample is every path inside the live tree, and its
// members are generated by containment rather than by a vocabulary, so the case
// that matters is the one no name in that list suggests. A directory whose name
// merely begins with two dots is a genuine child of the live tree, and it stays
// one however the path to it is spelled: `..data`, `...` and `..d\spool` all
// name objects that sit under the live tree's own directory, so every write
// through them lands in the operator's store.
//
// The screen decides that on filesystem identity now, so these are refused
// because their nearest existing ancestor IS the live tree rather than because
// of anything about their names. They are kept as cases because the shape is
// worth pinning from the outside: a caller-supplied destination inside the live
// tree must be refused whatever its leaf is called, and a name that a lexical
// containment test would read as an escape is the leaf most likely to slip.
// The instances below are chosen for their shape rather than their spelling:
// each is a genuine child whose first relative segment is not `..`.
test('the state-root screen refuses a child whose name merely begins with two dots', (t) => {
    const fixtureHome = makeDir('kit-sidecar-battery-home-');
    t.after(() => { rmDir(fixtureHome); });
    fs.mkdirSync(path.join(fixtureHome, '.claude'), { recursive: true });
    for (const leaf of ['..data', '...', path.join('..d', 'spool')]) {
        const inside = path.join(fixtureHome, '.claude', leaf);
        assert.strictEqual(battery.screenStateDir(inside, fixtureHome).status, 'refused',
            `${inside} names a child inside the live tree and must be refused`);
    }
    // The controls on the instrument, in both directions, so a refusal above is
    // the predicate discriminating rather than the predicate refusing whatever
    // it is handed. A path that genuinely escapes through a `..` SEGMENT is
    // outside and stays accepted, and so does an ordinary sibling.
    assert.strictEqual(
        battery.screenStateDir(path.join(fixtureHome, '.claude', '..', 'elsewhere'), fixtureHome).status,
        'ok', 'a path escaping through a real `..` segment is outside the tree and must stay accepted');
    assert.strictEqual(battery.screenStateDir(path.join(fixtureHome, 'plain'), fixtureHome).status,
        'ok', 'an ordinary sibling of the live tree must stay accepted');
});

// ------------------------------------------- spelling invariance, by rule ---
//
// The generating rule of this screen's whole defect class is not "path
// spellings". It is that TWO SPELLINGS NAME THE SAME FILESYSTEM OBJECT, and
// the screen answered differently for two of them. Five instances have been
// found on this predicate, and each was found by somebody thinking of a
// spelling nobody had written down: a UNC admin share, an 8.3 alias, a child
// whose name begins with two dots. A control that is itself a list of
// spellings can only ever find the sixth by the same luck.
//
// So nothing below asserts a verdict for a spelling. It asserts INVARIANCE
// UNDER A SPELLING TRANSFORM: for each transform and each of two fixture
// paths, one inside a fixture live tree and one genuinely outside it, the
// screen's answer for the transformed spelling equals its answer for the
// original. A screen that is right about every spelling and a screen that is
// wrong about every spelling in the same direction both satisfy invariance, so
// the two baselines are asserted too (inside is refused, outside is ok), which
// is what makes a violation a defect rather than a difference.
//
// WHERE EACH SPELLING COMES FROM, per transform, because "all of them are
// derived" would be false and the difference is what tells coverage from
// sampling. The volume GUID is asked of `mountvol` and the 8.3 alias of the
// shell's own object model: those two are genuinely derived, nothing in this
// file could have predicted their text, and they are the transforms that found
// the fifth defect. The four UNC and extended-length forms are literal
// templates with one character taken from the fixture's own drive letter, so
// their text IS written here; what makes them class members rather than a
// spelling list is the id precondition below, which refuses to check any cell
// whose two spellings do not stat to one object. Case, separator, trailing
// punctuation and the redundant segments are rewrites of whatever path they are
// handed, and the link transforms are built out of the fixture at run time.
// Every one of them earns its place by naming the same object, measured, rather
// than by being a name somebody thought of.

const INVARIANCE_LINK_TYPE = process.platform === 'win32' ? 'junction' : 'dir';

// The transforms whose spellings the replaced string screen answers differently
// for. They are the win32 root and alias forms: `path.relative` returns an
// absolute path when two spellings have different root kinds, which
// short-circuits every comparison that screen makes, and it never expands an
// 8.3 alias. The red control below is gated on at least one of these having
// run, since on a platform where none of them names the same object the old
// screen and the new one agree everywhere and there is nothing to catch.
const WIN32_SPELLING_TRANSFORMS = [
    'unc admin share by host name',
    'unc admin share by loopback address',
    'extended-length prefix',
    'extended-length unc',
    'volume guid root',
    '8.3 short name'
];
const guidRootByDrive = new Map();

// A filesystem identity, read the way the screen reads it. `bigint: true`
// because the Number form rounds a large NTFS file id and makes neighbouring
// directories collide, and a zero dev or ino means not comparable rather than
// not equal.
function invStatId(p) {
    try {
        const st = fs.statSync(p, { bigint: true });
        if (st.dev === 0n || st.ino === 0n) return null;
        return `${st.dev}:${st.ino}`;
    } catch { return null; }
}

// The nearest existing ancestor, computed here rather than borrowed from the
// module under test: a precondition checked with the code being tested proves
// nothing about it.
function invNearestExisting(p) {
    let cur = path.resolve(p);
    for (;;) {
        if (invStatId(cur) !== null) return cur;
        const parent = path.dirname(cur);
        if (parent === cur) return null;
        cur = parent;
    }
}

function invDriveOf(p) {
    return /^[A-Za-z]:\\/.test(p) ? p[0] : null;
}

// The volume's own GUID root, asked of the OS.
function invVolumeGuidRoot(drive) {
    const key = drive.toUpperCase();
    if (guidRootByDrive.has(key)) return guidRootByDrive.get(key);
    let root = null;
    try {
        const out = execFileSync('mountvol', [`${key}:`, '/L'], { encoding: 'utf8' }).trim();
        const token = out.split(/\s+/).find((tk) => tk.startsWith('\\\\?\\Volume{'));
        if (token) root = token.endsWith('\\') ? token : `${token}\\`;
    } catch { root = null; }
    guidRootByDrive.set(key, root);
    return root;
}

// The 8.3 alias of an existing directory, asked of the shell's own object
// model. The path travels in an environment variable rather than inside the
// script text: a path interpolated into a command line comes back mangled on
// this shell, and a mangled path stats as absent, which reads exactly like a
// real finding while being a verdict about a directory that does not exist.
function invShortPathOf(dir) {
    if (process.platform !== 'win32') return null;
    try {
        const script = '$f = New-Object -ComObject Scripting.FileSystemObject; '
            + 'try { $f.GetFolder($env:KIT_SS_PROBE_PATH).ShortPath } catch { "" }';
        const out = execFileSync('powershell.exe',
            ['-NoProfile', '-NonInteractive', '-Command', script],
            { encoding: 'utf8', env: { ...process.env, KIT_SS_PROBE_PATH: dir } }).trim();
        return out === '' ? null : out;
    } catch { return null; }
}

// The transforms. Each names the rule that makes it a member of the class, per
// Standing Brief Amendment 6, so a later reader can tell coverage from
// sampling. A transform that cannot be built on the running platform returns
// null and its cases are skipped out loud.
function invarianceTransforms() {
    return [
        {
            name: 'identity',
            allowSame: true,
            rule: 'the path itself: the instrument control, which must reproduce the baseline',
            fn: (p) => p
        },
        {
            name: 'unc admin share by host name',
            rule: 'the same volume reached through its administrative share',
            fn: (p) => (invDriveOf(p) === null ? null : `\\\\localhost\\${invDriveOf(p)}$${p.slice(2)}`)
        },
        {
            name: 'unc admin share by loopback address',
            rule: 'the same share named by address rather than by host name',
            fn: (p) => (invDriveOf(p) === null ? null : `\\\\127.0.0.1\\${invDriveOf(p)}$${p.slice(2)}`)
        },
        {
            name: 'extended-length prefix',
            rule: 'the win32 extended-length spelling of a drive-letter path',
            fn: (p) => (invDriveOf(p) === null ? null : `\\\\?\\${p}`)
        },
        {
            name: 'extended-length unc',
            rule: 'the extended-length spelling of the administrative share',
            fn: (p) => (invDriveOf(p) === null ? null : `\\\\?\\UNC\\localhost\\${invDriveOf(p)}$${p.slice(2)}`)
        },
        {
            name: 'volume guid root',
            rule: 'the volume named by the GUID it carries rather than by the letter it is mounted at',
            fn: (p) => {
                const drive = invDriveOf(p);
                if (drive === null) return null;
                const root = invVolumeGuidRoot(drive);
                return root === null ? null : root + p.slice(3);
            }
        },
        {
            name: '8.3 short name',
            rule: 'the short alias the volume generates for a long segment',
            fn: (p) => {
                const anchor = invNearestExisting(p);
                if (anchor === null) return null;
                const short = invShortPathOf(anchor);
                if (short === null) return null;
                return short + path.resolve(p).slice(anchor.length);
            }
        },
        {
            name: 'case flip',
            rule: 'the same names in another case, which win32 folds and a macOS APFS volume folds too',
            fn: (p) => p.toUpperCase()
        },
        {
            name: 'separator flip',
            rule: 'the same path spelled with the other separator',
            fn: (p) => p.replace(/\\/g, '/')
        },
        {
            name: 'redundant . and x\\.. segments',
            rule: 'steps that cancel, which leave the path naming the same object',
            fn: (p) => {
                const dir = path.dirname(p);
                if (dir === p) return null;
                return `${dir}${path.sep}.${path.sep}zz${path.sep}..${path.sep}${path.basename(p)}`;
            }
        },
        {
            name: 'trailing dots and spaces',
            rule: 'names the Win32 path parser strips back onto the original, which Node deliberately '
                + 'does not, so class membership here is that canonicalization and not stat identity',
            // The one transform in this table whose two spellings are NOT one
            // object to this process. That is the whole point of it: the Win32
            // path parser strips trailing dots and spaces, so `~/.claude.`
            // opens `~/.claude` from cmd or Explorer, while Node's fs creates
            // and stats a literal `.claude.` beside the real one. Putting it
            // through the id precondition would skip it in exactly the case
            // that matters, so it declares its own: stripping the trailing
            // punctuation off each segment must recover the original path
            // exactly, which is checkable and is the rule itself.
            precondition: (original, spelled) => {
                const stripped = spelled.split(/([\\/])/).map((part) => (/^[\\/]$/.test(part)
                    ? part
                    : part.replace(/[. ]+$/, ''))).join('');
                return stripped === original
                    ? { ok: true }
                    : { ok: false, reason: `stripping trailing punctuation gives ${stripped}, not the original` };
            },
            fn: (p) => {
                const dir = path.dirname(p);
                if (dir === p) return null;
                // The punctuation goes on the DIRECTORY the leaf sits in, since
                // that is the object that can be renamed onto the live tree; a
                // leaf that does not exist yet is not the object in question.
                return `${path.dirname(dir)}${path.sep}${path.basename(dir)}.${path.sep}${path.basename(p)}`;
            }
        },
        {
            name: 'reparse point above the target',
            link: true,
            rule: 'a junction whose target is the directory the candidate sits under',
            fn: (p, ctx) => ctx.viaLinkAboveTarget(p)
        },
        {
            name: 'reparse point on a subdirectory',
            link: true,
            rule: 'a junction straight onto the deepest existing directory on the path',
            fn: (p, ctx) => ctx.viaLinkOnSubdirectory(p)
        },
        {
            name: 'reparse point on the live side',
            link: true,
            rule: 'the live tree is itself a junction and the candidate names what it points at, '
                + 'with no link on the candidate at all',
            fn: (p, ctx) => ctx.viaLiveSideLink(p)
        }
    ];
}

// One fixture per transform, because the link transforms mutate the tree they
// are transforming a path in. `mode` is whether the live `.claude` exists yet:
// absent is the fresh-machine shape, where the screen has a name segment to
// compare instead of an object.
let invFixtureSeq = 0;
function makeInvarianceFixture(base, mode, made) {
    invFixtureSeq += 1;
    const root = fs.mkdtempSync(path.join(base, `kit-ss-inv${invFixtureSeq}-`));
    made.push(root);
    const home = path.join(root, 'home');
    const live = path.join(home, '.claude');
    const outsideDir = path.join(home, 'outside');
    const linkRoot = path.join(root, 'links');
    fs.mkdirSync(outsideDir, { recursive: true });
    fs.mkdirSync(linkRoot, { recursive: true });
    if (mode === 'present') fs.mkdirSync(path.join(live, 'x'), { recursive: true });

    let links = 0;
    const ctx = {
        root,
        home,
        live,
        outsideDir,
        viaLinkAboveTarget(p) {
            const anchor = invNearestExisting(p);
            if (anchor === null) return null;
            const target = path.dirname(anchor);
            if (target === anchor) return null;
            links += 1;
            const link = path.join(linkRoot, `above${links}`);
            try { fs.symlinkSync(target, link, INVARIANCE_LINK_TYPE); } catch { return null; }
            return link + path.resolve(p).slice(target.length);
        },
        viaLinkOnSubdirectory(p) {
            const anchor = invNearestExisting(p);
            if (anchor === null) return null;
            links += 1;
            const link = path.join(linkRoot, `sub${links}`);
            try { fs.symlinkSync(anchor, link, INVARIANCE_LINK_TYPE); } catch { return null; }
            return link + path.resolve(p).slice(anchor.length);
        },
        viaLiveSideLink(p) {
            const resolved = path.resolve(p);
            const under = (dir) => {
                const d = path.resolve(dir);
                return resolved === d || resolved.startsWith(d + path.sep);
            };
            // The live tree for the inside path, and the sibling that plays its
            // part for the outside control, so both halves of the pair keep
            // meaning under this transform.
            const target = under(live) ? live : (under(outsideDir) ? outsideDir : null);
            if (target === null) return null;
            links += 1;
            const moved = path.join(root, `moved${links}`);
            try {
                fs.renameSync(target, moved);
                fs.symlinkSync(moved, target, INVARIANCE_LINK_TYPE);
            } catch { return null; }
            return fs.realpathSync(moved) + resolved.slice(path.resolve(target).length);
        }
    };
    return {
        ctx,
        // A leaf that does not exist yet, which is what both callers actually
        // hand this screen: they are naming a target they are about to create.
        inside: mode === 'present' ? path.join(live, 'x', 'state') : path.join(live, 'state'),
        outside: path.join(outsideDir, 'state')
    };
}

// The bases the table runs over. Two volumes where the machine has two,
// because 8.3 alias generation is a per-volume setting: a table run on one
// volume can skip that transform for the whole run and never say so.
function invarianceBases() {
    const bases = [os.tmpdir()];
    const local = process.env.LOCALAPPDATA ? path.join(process.env.LOCALAPPDATA, 'Temp') : null;
    if (local !== null && fs.existsSync(local)
        && path.parse(local).root !== path.parse(os.tmpdir()).root) bases.push(local);
    return bases;
}

// The table itself, run against whichever screen it is handed: the shipped one
// in the case below, and the string predicate this section replaced in the
// control after it.
// Whether a transform names the SAME OBJECT by a different name on a given
// base, measured on a purpose-built directory rather than inferred from the
// table's own cells. Measuring it independently is what lets the table assert
// coverage instead of reporting it: a transform available here and contributing
// no checked cell is a hole, and a transform available nowhere is a class this
// platform cannot exercise, which is a different statement and has to be made
// out loud rather than absorbed into a green.
function measureTransformAvailability(base, made) {
    const root = fs.mkdtempSync(path.join(base, 'kit-ss-avail-'));
    made.push(root);
    const available = new Map();
    for (const transform of invarianceTransforms()) {
        // Each probe gets its own directory pair, because the link transforms
        // mutate what they are handed.
        const probeHome = path.join(root, `p${available.size}`);
        const probeDir = path.join(probeHome, 'a-directory-with-a-long-name');
        fs.mkdirSync(probeDir, { recursive: true });
        const linkRoot = path.join(probeHome, 'links');
        fs.mkdirSync(linkRoot, { recursive: true });
        let links = 0;
        const ctx = {
            live: probeDir,
            outsideDir: probeDir,
            root: probeHome,
            viaLinkAboveTarget: (p) => makeProbeLink(path.dirname(invNearestExisting(p) || ''), p, linkRoot, links += 1),
            viaLinkOnSubdirectory: (p) => makeProbeLink(invNearestExisting(p) || '', p, linkRoot, links += 1),
            viaLiveSideLink: (p) => {
                const anchor = invNearestExisting(p);
                if (anchor === null) return null;
                const moved = path.join(probeHome, `moved${links += 1}`);
                try {
                    fs.renameSync(anchor, moved);
                    fs.symlinkSync(moved, anchor, INVARIANCE_LINK_TYPE);
                } catch { return null; }
                return fs.realpathSync(moved) + path.resolve(p).slice(anchor.length);
            }
        };
        const original = path.join(probeDir, 'leaf');
        let spelled = null;
        try { spelled = transform.fn(original, ctx); } catch { spelled = null; }
        const distinct = spelled !== null && (spelled !== original || transform.allowSame === true);
        available.set(transform.name,
            distinct && transformPrecondition(transform, original, spelled).ok);
    }
    return available;
}

// The precondition a cell must meet before its verdicts are compared. The
// default is stat identity: the two spellings must reach one object, or the
// cell is not a member of the class and a comparison of the two answers would
// be measuring the fixture rather than the screen. A transform may declare its
// own where its membership rests on a canonicalization this process does not
// perform; it may not waive one.
function transformPrecondition(transform, original, spelled) {
    if (typeof transform.precondition === 'function') return transform.precondition(original, spelled);
    const wasId = invStatId(invNearestExisting(original) || '');
    const isId = invStatId(invNearestExisting(spelled) || '');
    if (wasId === null || isId === null || wasId !== isId) {
        return { ok: false, reason: `the two spellings are not the same object (${wasId} against ${isId})` };
    }
    return { ok: true };
}

function makeProbeLink(target, p, linkRoot, n) {
    if (target === '' || target === null) return null;
    const link = path.join(linkRoot, `probe${n}`);
    try { fs.symlinkSync(target, link, INVARIANCE_LINK_TYPE); } catch { return null; }
    return link + path.resolve(p).slice(path.resolve(target).length);
}

// A row is one <transform, base> PAIR, never a transform on its own.
//
// Availability is a per-volume fact: 8.3 alias generation is a per-volume
// setting, and it is why the table runs over two bases at all. Unioning
// availability across bases while totalling cells across them lets a transform
// available on both volumes and producing cells on only one show `checked > 0`
// and pass the coverage floor, which is the absorption this floor exists to
// stop, one level down from where it was found before. Keyed by the pair, a
// hole on one volume is a row of its own with `available` true and `checked`
// zero, and the floor sees it.
function rowKey(transformName, base) {
    return `${transformName} under ${base}`;
}

function runInvarianceTable(screenFn, note) {
    const made = [];
    const violations = [];
    const byTransform = new Map();
    for (const base of invarianceBases()) {
        for (const transform of invarianceTransforms()) {
            byTransform.set(rowKey(transform.name, base), {
                name: transform.name,
                base,
                label: `${transform.name} on ${path.parse(base).root}`,
                checked: 0,
                unavailable: 0,
                notSameObject: 0,
                available: false
            });
        }
    }
    let checked = 0;
    let skipped = 0;
    try {
        for (const base of invarianceBases()) {
            const availability = measureTransformAvailability(base, made);
            for (const [name, ok] of availability) {
                if (ok) byTransform.get(rowKey(name, base)).available = true;
            }
        }
        for (const base of invarianceBases()) {
            for (const mode of ['present', 'absent']) {
                for (const transform of invarianceTransforms()) {
                    // A link transform needs a live tree to put a link on.
                    if (transform.link === true && mode !== 'present') continue;
                    const fixture = makeInvarianceFixture(base, mode, made);
                    const cells = [
                        ['inside the live tree', fixture.inside, 'refused'],
                        ['outside it', fixture.outside, 'ok']
                    ];
                    for (const [side, original, want] of cells) {
                        const label = `${path.parse(base).root} ${mode} live tree, ${side}, `
                            + `under ${transform.name}`;
                        let spelled = null;
                        try { spelled = transform.fn(original, fixture.ctx); } catch { spelled = null; }
                        // A transform whose precondition fails must not pass
                        // quietly: a skip that reads like a pass is how a table
                        // this size reports coverage it never had.
                        if (spelled === null || (spelled === original && transform.allowSame !== true)) {
                            skipped += 1;
                            byTransform.get(rowKey(transform.name, base)).unavailable += 1;
                            note(`SKIP ${label}: no distinct spelling on this platform or volume`);
                            continue;
                        }
                        const met = transformPrecondition(transform, original, spelled);
                        if (!met.ok) {
                            skipped += 1;
                            byTransform.get(rowKey(transform.name, base)).notSameObject += 1;
                            note(`SKIP ${label}: ${met.reason}`);
                            continue;
                        }
                        checked += 1;
                        byTransform.get(rowKey(transform.name, base)).checked += 1;
                        const baseline = screenFn(original, fixture.ctx.home).status;
                        const under = screenFn(spelled, fixture.ctx.home).status;
                        if (baseline !== want) {
                            violations.push(`${label}: the baseline answer is ${baseline}, wanted ${want}`);
                        }
                        if (under !== baseline) {
                            violations.push(`${label}: ${baseline} for the original spelling and `
                                + `${under} for the transformed one (${spelled})`);
                        }
                    }
                }
            }
        }
    } finally {
        for (const dir of made.reverse()) rmDir(dir);
    }
    return { checked, skipped, violations, byTransform };
}

// The case. Every generated pair is the same object under two names, so any
// difference in the answer is a defect by construction, whichever direction it
// falls in.
//
// The coverage floor is PER TRANSFORM and derived from what this platform can
// actually build, never a count. A total-cell floor fails in both directions: a
// number low enough for POSIX, where the whole drive-letter class returns
// nothing, is a number the win32 classes can all vanish under while the case
// still passes on their neighbours' cells, and a number high enough to notice
// that is one POSIX cannot reach, which reddens the confirmation run this
// screen's own POSIX claim is waiting on for a reason that has nothing to do
// with the screen. So availability is measured per transform per base on a
// purpose-built directory, and the assertion is that everything measured
// available here produced at least one checked cell. A transform available
// nowhere is named in the output as a class this run did not sweep, which is
// the honest report rather than a silent green.
test('the state-root screen answers the same for every spelling of one object', (t) => {
    // Wrapped rather than handed over as a bare value, so the home operand is
    // spelled at a call site the no-live-home check below can read. A reference
    // passed to another function carries no arity a text predicate can see, and
    // the whole point of that check is that it needs no list of which call
    // sites to trust.
    const result = runInvarianceTable(
        (target, home) => battery.screenStateDir(target, home),
        (line) => t.diagnostic(line));
    const rows = [...result.byTransform.values()];
    for (const row of rows) {
        t.diagnostic(`transform ${row.label}: ${row.checked} checked, ${row.unavailable} with no distinct `
            + `spelling, ${row.notSameObject} naming another object, available here: ${row.available}`);
    }
    t.diagnostic(`invariance table: ${result.checked} pairs checked, ${result.skipped} skipped`);

    // PER <TRANSFORM, VOLUME>, which is the grain availability is measured at.
    // A transform that names the same object on a volume and produced no
    // checked cell on that volume is a hole, whether or not its neighbour
    // volume covered it.
    assert.deepStrictEqual(availableButUnchecked(rows), [],
        'these transform-and-volume pairs name the same object on this machine and contributed no checked '
            + 'cell, so the table reports coverage it does not have');
    const notSwept = rows.filter((row) => !row.available).map((row) => row.label);
    if (notSwept.length > 0) {
        t.diagnostic(`NOT SWEPT here, no spelling of this kind names the same object on this volume: ${notSwept.join(', ')}`);
    }
    // The instrument must have swept something beyond the identity control, or
    // there is no evidence in this run at all.
    assert.ok(rows.some((row) => row.name !== 'identity' && row.checked > 0),
        `no transform beyond identity ran: ${JSON.stringify(rows)}`);

    assert.deepStrictEqual(result.violations, [],
        `the screen answers differently for two names of one object:\n${result.violations.join('\n')}`);
});

// The instrument control, and the durable form of watching this table go red.
// The predicate below is the string screen this section replaced, kept here and
// nowhere else. If the table above can go green against a screen with five
// known holes in it, the table is measuring nothing; this case fails unless the
// table catches it, and unless at least one of the differences it catches is a
// path INSIDE the live tree answered `ok`, which is the failing-open direction
// the whole class is made of.
function stringScreenAsReplaced(target, homeDir) {
    const live = path.resolve(homeDir, '.claude');
    const resolved = path.resolve(target);
    const realpathOf = (p) => {
        const start = path.resolve(p);
        let existing = start;
        const trailing = [];
        for (;;) {
            try {
                return { ok: true, path: path.resolve(fs.realpathSync(existing), ...trailing.slice().reverse()) };
            } catch {
                const parent = path.dirname(existing);
                if (parent === existing) return { ok: false, path: start };
                trailing.push(path.basename(existing));
                existing = parent;
            }
        }
    };
    const isAtOrUnder = (candidate, ancestor) => {
        if (candidate.toLowerCase() === ancestor.toLowerCase()) return true;
        const rel = path.relative(ancestor, candidate);
        if (rel === '') return true;
        if (path.isAbsolute(rel)) return false;
        return rel.split(/[\\/]/)[0] !== '..';
    };
    const candidateReal = realpathOf(resolved);
    const liveReal = realpathOf(live);
    if (!candidateReal.ok || !liveReal.ok) return { status: 'unscreened', resolved };
    const pairs = [
        [resolved, live], [candidateReal.path, live],
        [resolved, liveReal.path], [candidateReal.path, liveReal.path]
    ];
    for (const [candidate, ancestor] of pairs) {
        if (isAtOrUnder(candidate, ancestor)) return { status: 'refused', resolved };
    }
    return { status: 'ok', resolved };
}

test('the invariance table is red against the string screen it replaced', (t) => {
    const result = runInvarianceTable(stringScreenAsReplaced, () => {});
    const failedOpen = result.violations.filter((v) => /refused for the original spelling and ok for/.test(v));
    t.diagnostic(`the replaced screen: ${result.violations.length} differences over `
        + `${result.checked} pairs, ${failedOpen.length} of them failing open`);
    // The gate is which transforms actually ran, not a count. The differences
    // this control exists to catch all live in the win32 spelling class: on a
    // platform where none of those transforms names the same object, the
    // replaced screen and this one agree on every cell the table can build, and
    // demanding a difference there would fail the instrument for the platform's
    // reasons rather than the screen's.
    const sweptHere = [...result.byTransform.values()]
        .filter((row) => WIN32_SPELLING_TRANSFORMS.includes(row.name) && row.checked > 0)
        .map((row) => row.label);
    if (sweptHere.length === 0) {
        t.diagnostic('SKIP: none of the spelling transforms the replaced screen fails on names the same '
            + 'object on this platform, so there is no difference here to catch');
        return;
    }
    t.diagnostic(`gated on these transforms having run: ${sweptHere.join(', ')}`);
    assert.ok(result.violations.length > 0,
        'a table that cannot catch the screen this one replaced is measuring nothing');
    assert.ok(failedOpen.length > 0,
        'the table must catch the failing-open direction, not only cannot-measure differences:\n'
            + result.violations.join('\n'));
});

// The identity match is on an OBJECT, not on the volume it sits on. Every
// fixture path in the table above shares a device with the live tree, so a
// screen matching on `dev` alone would refuse the outside control too and every
// invariance assertion would still hold. This states the discrimination
// directly.
test('the state-root screen matches an object, not the volume it sits on', (t) => {
    const home = makeDir('kit-sidecar-battery-home-');
    t.after(() => rmDir(home));
    const live = path.join(home, '.claude');
    const sibling = path.join(home, 'sibling');
    fs.mkdirSync(live, { recursive: true });
    fs.mkdirSync(sibling, { recursive: true });
    const liveStat = fs.statSync(live, { bigint: true });
    const siblingStat = fs.statSync(sibling, { bigint: true });
    assert.strictEqual(liveStat.dev, siblingStat.dev,
        'this control needs both directories on one volume, or it proves nothing');
    assert.notStrictEqual(liveStat.ino, siblingStat.ino, 'two directories, two inodes');
    assert.strictEqual(battery.screenStateDir(path.join(sibling, 'state'), home).status, 'ok',
        'a same-volume sibling of the live tree is outside it and must be accepted');
    assert.strictEqual(battery.screenStateDir(path.join(live, 'state'), home).status, 'refused',
        'the live tree itself is refused, so the acceptance above is discrimination');
});

// The third answer, exercised rather than assumed. Both callers treat
// `unscreened` as a hard stop, so the branch that produces it is load-bearing:
// a home directory whose root does not resolve leaves the live tree with no
// object to compare against, and the screen must say it could not measure
// rather than fall back on `ok` to be helpful.
test('a live tree whose root does not resolve is unscreened, never accepted', (t) => {
    const unusable = process.platform === 'win32'
        ? 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').map((d) => `${d}:\\`).find((r) => invStatId(r) === null)
        : null;
    if (process.platform !== 'win32' || unusable === undefined || unusable === null) {
        t.diagnostic('SKIP: no unmounted drive root available to point a fixture home at');
        return;
    }
    const home = path.join(unusable, 'no-such-home');
    const outside = makeDir('kit-sidecar-battery-unscreened-');
    t.after(() => rmDir(outside));
    const answer = battery.screenStateDir(path.join(outside, 'state'), home);
    assert.strictEqual(answer.status, 'unscreened', JSON.stringify(answer));
    assert.match(answer.detail, /live ~\/\.claude path could be resolved/);
});

// The branch that carries the fresh-machine case, named rather than counted. On
// a machine where `~/.claude` does not exist yet there is no object to identify
// it by, so the screen matches the HOME directory's identity and then compares
// the one name below it. Only that branch can answer this case: the live tree
// has no realpath and no inode, and a UNC spelling defeats every string
// comparison the overlay makes, which is what the shipped screen failed open
// on. The spelling is derived from the fixture's own drive letter rather than
// written here, and the outside control under the same spelling must stay
// accepted, so the refusal is discrimination and not a blanket answer.
test('a path into a live tree that does not exist yet is refused by identity plus the name below it', (t) => {
    const home = makeDir('kit-sidecar-battery-home-');
    t.after(() => rmDir(home));
    fs.mkdirSync(path.join(home, 'outside'), { recursive: true });
    assert.ok(!fs.existsSync(path.join(home, '.claude')),
        'this case needs the live tree to be absent, or it exercises the other branch');
    const drive = /^[A-Za-z]:\\/.test(home) ? home[0] : null;
    if (drive === null) {
        t.diagnostic('SKIP: no drive-letter path to build an administrative share spelling from');
        return;
    }
    const uncOf = (p) => `\\\\localhost\\${drive}$${p.slice(2)}`;
    const inside = uncOf(path.join(home, '.claude', 'state'));
    const refused = battery.screenStateDir(inside, home);
    assert.strictEqual(refused.status, 'refused', `${inside}: ${JSON.stringify(refused)}`);
    assert.match(refused.detail, /same object as the directory the live ~\/\.claude tree sits in/,
        'the rule that refused this must be the identity match at the home directory plus the name tail');

    // The tail compare folds case on both platforms, deliberately: an exact
    // compare accepts `~/.CLAUDE/x` on a case-insensitive volume, which is the
    // live store.
    const flipped = battery.screenStateDir(uncOf(path.join(home, '.CLAUDE', 'state')), home);
    assert.strictEqual(flipped.status, 'refused', JSON.stringify(flipped));

    const outside = battery.screenStateDir(uncOf(path.join(home, 'outside', 'state')), home);
    assert.strictEqual(outside.status, 'ok',
        `the control: a sibling under the same spelling must still be accepted: ${JSON.stringify(outside)}`);
});

// The mirror of the case below, and the instance the link-on-the-candidate case
// cannot reach: the link sits on the LIVE side. `<fixtureHome>/.claude` is
// itself a junction to a directory elsewhere, and --state-dir names a path
// under that directory's own realpath, with no link anywhere on the candidate.
// A screen that resolves the candidate and compares it against the live tree's
// unresolved spelling accepts it, and every write then lands inside the live
// tree. This is a redirected profile or a `.claude` linked into a synced
// folder, which is an ordinary shape rather than an exotic one.
test('the state-root screen resolves the live tree too, so a path under a linked ~/.claude is refused', (t) => {
    const fixtureHome = makeDir('kit-sidecar-battery-home-');
    const elsewhere = makeDir('kit-sidecar-battery-elsewhere-');
    t.after(() => { rmDir(fixtureHome); rmDir(elsewhere); });
    // The live tree is a link; what it points at is where the writes land.
    const liveTree = path.join(fixtureHome, '.claude');
    fs.symlinkSync(elsewhere, liveTree, process.platform === 'win32' ? 'junction' : 'dir');

    // The candidate names the realpath of the live tree, spelled with no link
    // on it at all, which is what a caller reading the resolved path off their
    // own file manager would type.
    const throughLiveLink = battery.screenStateDir(path.join(fs.realpathSync(elsewhere), 'state'), fixtureHome);
    assert.strictEqual(throughLiveLink.status, 'refused',
        'a candidate naming the realpath of a linked live tree must be refused');
    // Which rule refused it, in words: the comparison of the candidate spelling
    // against the live tree's REALPATH, the operand a one-sided screen leaves
    // unresolved.
    assert.ok(/live ~\/\.claude tree resolves through a link/.test(throughLiveLink.detail), throughLiveLink.detail);
    assert.notStrictEqual(throughLiveLink.liveReal, throughLiveLink.live,
        'this control needs the live tree to actually resolve elsewhere, or it proves nothing');

    // The unlinked sibling, which must still be accepted: a screen that refused
    // everything would pass the assertion above.
    const sibling = makeDir('kit-sidecar-battery-sibling-');
    t.after(() => rmDir(sibling));
    assert.strictEqual(battery.screenStateDir(path.join(sibling, 'state'), fixtureHome).status, 'ok',
        'the control: an unlinked sibling path is still accepted');
});

// The link half, run entirely against a fixture home so nothing here touches
// the operator's own. A junction or symlink named on --state-dir is followed
// by the file system, so a screen that compares the spelling alone accepts it
// while every write lands in the live tree. The control is the same shape with
// no link on it, which must still be accepted: without it, a screen that
// refused everything would pass this case.
test('the state-root screen follows a link before it compares, so a junction into the live tree is refused', (t) => {
    const fixtureHome = makeDir('kit-sidecar-battery-home-');
    const linkDir = makeDir('kit-sidecar-battery-link-');
    t.after(() => { rmDir(linkDir); rmDir(fixtureHome); });
    const liveTree = path.join(fixtureHome, '.claude');
    fs.mkdirSync(liveTree, { recursive: true });
    const plain = path.join(linkDir, 'plain');
    fs.mkdirSync(plain, { recursive: true });

    const link = path.join(linkDir, 'looks-harmless');
    fs.symlinkSync(liveTree, link, process.platform === 'win32' ? 'junction' : 'dir');

    const through = battery.screenStateDir(path.join(link, 'state'), fixtureHome);
    assert.strictEqual(through.status, 'refused', 'a link resolving into the live tree must be refused');
    assert.ok(/link/.test(through.detail), through.detail);
    // The realpath is what was compared, and it is not the spelling.
    assert.notStrictEqual(through.real, through.resolved);

    const direct = battery.screenStateDir(path.join(plain, 'state'), fixtureHome);
    assert.strictEqual(direct.status, 'ok', 'the control: an unlinked sibling path is still accepted');
});

// A screen answers about the path it was handed, and every component created
// beneath that path afterwards is unscreened. mkdir -p follows a reparse point
// on any intermediate component, so a state root that screened `ok` licenses
// nothing below it: a junction planted at <state-dir>/memory-root sends the
// whole memory tree into the live store while the run prints the sentence
// saying the root was screened and accepted. The writer, not the screen, is
// what closes that, which is why logs.ensureDir takes the screened root and
// creates one component at a time below it.
//
// The unguarded call is the same test's red half rather than a second case.
// logs.ensureDir with no root is the code as it stood, mkdir -p and a leaf
// check, so the assertion that it lands inside the live tree is the pre-fix
// behaviour asserted rather than described: if the guarded call ever stops
// guarding, this case fails on the line above it, and if the unguarded call is
// ever silently made safe, it fails on the line below. The control that keeps
// the guarded half from being a blanket refusal is the same shape with no
// junction in it, which must still be created.
test('a junction planted below a screened state root is refused by name, not followed', (t) => {
    const root = makeDir('kit-sidecar-battery-a7-');
    t.after(() => rmDir(root));
    const home = path.join(root, 'home');
    const liveTree = path.join(home, '.claude');
    fs.mkdirSync(liveTree, { recursive: true });
    const stateDir = path.join(root, 'state');
    fs.mkdirSync(stateDir, { recursive: true });
    assert.strictEqual(battery.screenStateDir(stateDir, home).status, 'ok',
        'the premise: this root is outside the live tree and the screen says so');

    const captured = path.join(liveTree, 'captured');
    fs.mkdirSync(captured, { recursive: true });
    fs.symlinkSync(captured, path.join(stateDir, 'memory-root'),
        process.platform === 'win32' ? 'junction' : 'dir');
    const under = path.join(stateDir, 'memory-root', 'projects', 'seg', 'memory');

    const guarded = logs.ensureDir(under, stateDir);
    assert.strictEqual(guarded.ok, false, JSON.stringify(guarded));
    assert.ok(/is not a real directory/.test(guarded.reason), guarded.reason);
    assert.strictEqual(fs.existsSync(path.join(captured, 'projects')), false,
        'the guarded call must write nothing inside the live tree');

    // The red half: the same path with no root to guard from is the old
    // behaviour, and it goes straight through the junction.
    assert.strictEqual(logs.ensureDir(under).ok, true);
    assert.strictEqual(fs.existsSync(path.join(captured, 'projects', 'seg', 'memory')), true,
        'the unguarded call follows the junction, which is what the guarded call must not do');

    // The control: no junction, and the guarded call still creates the tree.
    const clean = path.join(root, 'state2');
    fs.mkdirSync(clean, { recursive: true });
    const cleanUnder = path.join(clean, 'memory-root', 'projects', 'seg', 'memory');
    assert.strictEqual(logs.ensureDir(cleanUnder, clean).ok, true);
    assert.strictEqual(fs.existsSync(cleanUnder), true,
        'the control: a guard is not a blanket refusal');
});

// The end-to-end half of the same finding, through the real CLI and against a
// path the old screen accepted: a sibling of kit-sidecar under `.claude`. Exit
// 1, and the path must not exist afterwards, which is the half that says
// nothing was written.
//
// The child's HOME and USERPROFILE point at a fixture home, so the `.claude`
// this case names, and the tree the screen compares against, are both inside a
// directory this suite created and removes. The earlier shape of this case
// built its control path inside the operator's own ~/.claude and registered a
// recursive remove on it; it never created anything, but only because the guard
// it exists to test was working, and ~/.claude/kit-sidecar/spool is the
// fleet-wide capture activation lever, so a regression there would switch
// plaintext capture on for every session on the machine.
test('a --state-dir naming a sibling of the sidecar directory under .claude is refused with nothing written', async (t) => {
    const home = fixtureHomeDir(t);
    const server = await startServer(t, () => JSON.stringify({ verdict: 'achieved', reason: 'r' }));
    const configPath = writeConfig(t, server.url);
    const control = path.join(home, '.claude', 'kit-sidecar-battery-refusal-control');
    assert.strictEqual(fs.existsSync(control), false, 'the control path must not exist before the run');

    const result = await runBattery(['judgment', '--config', configPath, '--state-dir', control],
        { HOME: home, USERPROFILE: home });
    assert.strictEqual(result.code, 1, result.stdout + result.stderr);
    assert.ok(/refus/i.test(result.stderr), result.stderr);
    // The rule that refused it, named: the candidate spelling sits inside the
    // live tree's spelling, with no link on either side.
    assert.ok(/names a path inside the live/.test(result.stderr), result.stderr);
    assert.strictEqual(fs.existsSync(control), false, 'the refused run created a directory in the .claude tree');
    // The control on the instrument: the identical command against a scratch
    // root under the same fixture home runs, so the refusal above is the screen
    // and not a broken --state-dir.
    const okRoot = path.join(home, 'scratch-state');
    const ok = await runBattery(['judgment', '--config', configPath, '--state-dir', okRoot],
        { HOME: home, USERPROFILE: home });
    // It ran and scored: this mock answers one constant verdict, so the score
    // itself is beside the point and the exit code is 3. What this control
    // establishes is that the screen accepted the root and the run proceeded.
    assert.notStrictEqual(ok.code, 1, ok.stdout + ok.stderr);
    assert.ok(ok.stdout.includes('== judgment battery =='), ok.stdout + ok.stderr);
});

// The reassurance line is composed from the screen's own answer rather than
// printed over it: a run that prints it has run the check that earns it, and it
// names the comparisons the screen recorded making rather than a literal, so an
// implementation that resolved one operand and left the other lexical cannot
// print a sentence naming four.
test('the state-root line names the comparisons the screen recorded making', async (t) => {
    const server = await startServer(t, () => JSON.stringify({ verdict: 'achieved', reason: 'r' }));
    const configPath = writeConfig(t, server.url);
    const stateDir = freshStateDir(t);
    const result = await runBattery(['judgment', '--config', configPath, '--state-dir', stateDir]);
    const line = result.stdout.split('\n').find((l) => l.startsWith('state root ('));
    assert.ok(line, result.stdout);
    // THE TREE IS COMPOSED TOO, not only the comparison list. The screen's tree
    // is now whatever its home operand named, and the child here resolves its
    // home from the fixture the launcher gave it, so a line carrying a fixed
    // `~/.claude` would be describing a comparison against the operator's store
    // that this run never made. Naming the fixture tree is what a composed
    // sentence does and what an asserted one cannot.
    assert.ok(line.includes(`screened against ${path.join(suiteHome(), '.claude')} and outside it`),
        `the state-root line names a tree the screen did not compare against:\n${line}`);
    assert.ok(!/screened against the live ~\/\.claude tree/.test(line),
        `the state-root line asserts the operator live store over a fixture comparison:\n${line}`);
    // Every comparison the screen recorded, and the line is rendered from the
    // screen's own list, so this is the same list a caller of the predicate
    // gets back. The identity comparison must be among them: it is the one that
    // decides the answer, and a line naming only the four string comparisons
    // would describe the weaker half of the screen as though it were the whole
    // of it.
    // The SAME home the child resolved its live tree from (runBin gives every
    // child suiteHome() as HOME and USERPROFILE), so this in-process screen and
    // the child's are the same comparison. Passing no home would compare
    // against the operator's real ~/.claude, which reads it, and would couple
    // this assertion to whether that tree happens to be readable: with it
    // unreadable, liveViews returns nothing, the answer is `unscreened` with
    // four comparisons, and the floor below fails for a reason that has nothing
    // to do with the code under test.
    const screened = battery.screenStateDir(stateDir, suiteHome());
    assert.ok(screened.compared.length >= 5, JSON.stringify(screened));
    assert.ok(screened.compared.some((c) => /filesystem identity/.test(c)), JSON.stringify(screened));
    // The four spelling and realpath comparisons are still made and still
    // named, so nothing dropped out when the identity walk arrived.
    for (const operand of ['the candidate spelling against the live spelling',
        'the candidate realpath against the live spelling',
        'the candidate spelling against the live realpath',
        'the candidate realpath against the live realpath']) {
        assert.ok(screened.compared.includes(operand), `${operand} is missing from ${JSON.stringify(screened.compared)}`);
    }
    for (const comparison of screened.compared) {
        assert.ok(line.includes(comparison), `${comparison} is missing from: ${line}`);
    }
});

// ------------------------------------------- a run scores only its own run ---

// CRITICAL B's control. Both session ids carry a per-run token, so the log a
// run scores is a file no earlier run wrote to. Under fixed session ids the
// verdict log accumulates and readJsonl returns the whole of it, so this
// second run, whose endpoint answers nothing at all, would resolve every case
// against the first run's thirteen verdicts and print PASS. A case using a
// fresh state dir cannot discriminate the fix, because the mkdtemp default
// makes a new directory every time and hides the defect.
test('a second run against the same state dir scores nothing the first run produced', async (t) => {
    const cases = battery.loadJudgmentCases();
    const server = await startServer(t, (body) => {
        const c = cases.find((cc) => body.prompt.includes(cc.intent.slice(0, 40)));
        return JSON.stringify({ verdict: c ? c.acceptableVerdicts[0] : 'achieved', reason: 'matches the fixture' });
    });
    const configPath = writeConfig(t, server.url);
    const stateDir = freshStateDir(t);

    const first = await runBattery(['judgment', '--config', configPath, '--state-dir', stateDir]);
    assert.strictEqual(first.code, 0, first.stdout + first.stderr);
    assert.ok(first.stdout.includes('OVERALL: PASS'), first.stdout);

    await server.close();

    const second = await runBattery(['judgment', '--config', configPath, '--state-dir', stateDir]);
    assert.strictEqual(second.code, 1, `a run whose endpoint answered nothing must be a cannot-measure:\n${second.stdout}`);
    assert.ok(second.stdout.includes('CANNOT-MEASURE'), second.stdout);
    assert.ok(second.stdout.includes('cannot measure'), second.stdout);
    assert.ok(!second.stdout.includes('OVERALL: PASS'), second.stdout);
});

// The instance the sequential case above cannot reach, and the one the per-run
// token does nothing about: a FOREIGN PRODUCER filing records under this run's
// own log while this run is in flight.
//
// The daemon routes each verdict to the session id it reads off the SPOOL
// ENTRY, never its own, so another run draining this run's spool lines writes
// those verdicts into this run's token-stamped log and leaves this run's pass
// with nothing to consume. Every case then resolves, nothing is unmeasured, and
// the run prints PASS having made no endpoint call at all. Standing that up
// needs three things this case forces rather than waits for: the run token
// (through main's own deps seam, the shape the state-root screen's homeDir seam
// and daemon.runOnce's deps already use), the records the other producer filed, and
// the offsets file that producer's own pass left behind, which is what makes
// this run read nothing where the concurrent case reads nothing.
test('a run whose spool lines another pass consumed is a cannot-measure, not a PASS off that pass records', async (t) => {
    const daemon = require('../sidecar/daemon.js');
    const token = 'f0f0f0f0';
    const sessions = battery.runSessions(token);
    const { home, stateDir } = inProcessRoots(t);
    const cases = battery.loadJudgmentCases();

    // The foreign producer: the identical fixture, drained by its own daemon
    // pass against an endpoint that answers every case correctly. Its verdicts
    // land in logs/verdicts-<slug>.jsonl under THIS token, because that is the
    // session id on the spool lines it read.
    const server = await startServer(t, (body) => {
        const c = cases.find((cc) => body.prompt.includes(cc.intent.slice(0, 40)));
        return JSON.stringify({ verdict: c ? c.acceptableVerdicts[0] : 'achieved', reason: 'the other run judged this' });
    });
    const configPath = writeConfig(t, server.url);
    const fixture = battery.buildFixture(stateDir, 'judgment', sessions);
    await daemon.runOnce({ once: true, stateDir, configPath, memoryRoot: fixture.memoryRoot }, { report: () => {} });

    // The writer's own day file, taken from the fixture it built rather than
    // recomputed here: a run that crosses UTC midnight between the two reads
    // would otherwise look for a file the writer never wrote.
    const spoolFile = fixture.spoolFile;
    const producedBytes = fs.statSync(spoolFile).size;
    const verdictLog = logs.sessionLogFile(path.join(stateDir, 'logs'), sessions.judgment);
    assert.strictEqual(fs.readFileSync(verdictLog, 'utf8').trim().split('\n').length, cases.length,
        'this control needs the other pass to have filed a verdict for every case under this run token');

    // The offsets that pass left, advanced over the lines the run under test is
    // about to append: the state a concurrent producer leaves behind when it
    // drains this run's lines a moment after they are written. The two blocks
    // are byte-for-byte the same length, the same fixture through the same
    // writer with a fixed-width timestamp, so twice the first block is exactly
    // the end of the second.
    const stateFile = path.join(stateDir, 'logs', 'offsets.json');
    const held = logs.loadState(stateFile);
    held.state.offsets[path.basename(spoolFile)] = producedBytes * 2;
    assert.ok(logs.saveState(stateFile, held.state), 'the control could not seed the offsets it needs');

    await server.close();

    // The run under test, same token forced, endpoint gone. It writes its
    // thirteen lines, its pass consumes none of them, and every case resolves
    // against the other producer's records.
    const printed = [];
    const code = await battery.main(['judgment', '--config', configPath, '--state-dir', stateDir], {
        newRunToken: () => token,
        write: (text) => printed.push(text),
        warn: () => {},
        homeDir: home
    });
    const out = printed.join('');
    assert.strictEqual(fs.statSync(spoolFile).size, producedBytes * 2,
        'the second fixture block is not the length this control assumed, so the seeded offset means nothing');
    assert.strictEqual(code, 1, `a run that consumed none of its own lines must be a cannot-measure:\n${out}`);
    assert.ok(/wrote 13 fixture spool line\(s\) and its own daemon pass consumed 0/.test(out), out);
    assert.ok(!out.includes('OVERALL: PASS'), out);
});

// ------------------------------------------------ the daemon's own counters --

// MAJOR 8's control. A spool line the daemon rejects as malformed produces
// neither a verdict nor a gap record, so the case it carried renders as
// CANNOT-MEASURE pointing a reader at gap ranges that were never written. The
// counter is the only surface that says so, and a run that never reads it
// exits 0 with a clean-looking report. Here the malformed line is planted in
// the day file the fixture will append to, so every real case still scores
// correct and only the counter can fail the run.
test('a spool line the daemon rejected is surfaced from its own counters and fails the run', async (t) => {
    const cases = battery.loadJudgmentCases();
    const server = await startServer(t, (body) => {
        const c = cases.find((cc) => body.prompt.includes(cc.intent.slice(0, 40)));
        return JSON.stringify({ verdict: c ? c.acceptableVerdicts[0] : 'achieved', reason: 'matches the fixture' });
    });
    const configPath = writeConfig(t, server.url);
    const stateDir = freshStateDir(t);
    const day = new Date().toISOString().slice(0, 10);
    fs.mkdirSync(path.join(stateDir, 'spool'), { recursive: true });
    fs.writeFileSync(path.join(stateDir, 'spool', `${day}.jsonl`), '{not json at all\n', 'utf8');

    const result = await runBattery(['judgment', '--config', configPath, '--state-dir', stateDir]);
    assert.ok(/the daemon reports .*malformed spool line/.test(result.stdout), result.stdout);
    assert.strictEqual(result.code, 1, `a dropped line is a cannot-measure, not a shortfall:\n${result.stdout}`);
    assert.ok(result.stdout.includes('cannot measure'), result.stdout);
});

// The reader's half of the same rule: a log that could not be read is not a
// log that held nothing. Both return zero records, and only one of them is a
// measurement.
test('an unreadable log reads as unreadable and an absent one as absent, never both as empty', (t) => {
    const dir = makeDir('kit-sidecar-battery-read-');
    t.after(() => rmDir(dir));
    const absent = battery.readJsonl(path.join(dir, 'nothing.jsonl'));
    assert.strictEqual(absent.missing, true);
    assert.strictEqual(absent.unreadable, null);

    // A directory in the file's place: readable as a path, unreadable as a
    // file, which is the shape a real unreadable log takes here.
    const asDir = path.join(dir, 'verdicts.jsonl');
    fs.mkdirSync(asDir);
    const unreadable = battery.readJsonl(asDir);
    assert.strictEqual(unreadable.missing, false);
    assert.ok(typeof unreadable.unreadable === 'string' && unreadable.unreadable !== '',
        'an unreadable log must carry its reason');
    assert.deepStrictEqual(unreadable.records, []);
});

// ------------------------------------------------ disclosure before egress --

// A child process whose accumulating stderr can be read while it still runs,
// which is what lets a case ask what the command had already disclosed at the
// moment its first endpoint call was in flight.
function runBinWatched(bin, args, env) {
    const state = { stdout: '', stderr: '' };
    const child = spawnPinned(bin, args, env);
    child.stdout.on('data', (d) => { state.stdout += d; });
    child.stderr.on('data', (d) => { state.stderr += d; });
    state.done = new Promise((resolve, reject) => {
        child.on('error', reject);
        child.on('close', (code) => resolve({ code, stdout: state.stdout, stderr: state.stderr }));
    });
    return state;
}

function waitFor(predicate, ms) {
    return new Promise((resolve) => {
        const started = Date.now();
        const tick = () => {
            if (predicate()) { resolve(true); return; }
            if (Date.now() - started > ms) { resolve(false); return; }
            setTimeout(tick, 10);
        };
        tick();
    });
}

// MAJOR 7's control. The daemon composes its startup reports ahead of the
// first call precisely so a reader learns where the data is going before it
// goes; a runner that collects them into an array and prints them after
// runOnce returns prints them only after every fixture command, its output and
// the whole frozen memory index have already been POSTed off this machine. The
// window is bounded and the run is still in flight while it is open, so a
// buffered implementation cannot satisfy it: the line is looked for while the
// child is mid-drain, not after it exits.
test('a startup report reaches stderr while the run is still in flight, not after it', async (t) => {
    const dir = makeDir('kit-sidecar-battery-cfg-');
    t.after(() => rmDir(dir));
    const server = await startServer(t, () => JSON.stringify({ verdict: 'achieved', reason: 'r' }));
    const configFile = path.join(dir, 'kit-endpoint.json');
    // timeoutMs below the accepted floor: the config load warns, and startup
    // reports that warning before any call is made.
    fs.writeFileSync(configFile, JSON.stringify({ url: server.url, model: 'test-model', timeoutMs: 5 }), 'utf8');
    const stateDir = freshStateDir(t);

    const watched = runBinWatched(BATTERY_BIN, ['judgment', '--config', configFile, '--state-dir', stateDir]);
    const early = await waitFor(() => /timeoutMs ignored/.test(watched.stderr), 5000);
    const finished = await watched.done;
    assert.strictEqual(early, true,
        `the startup warning was not printed while the run was still in flight:\n${finished.stderr}`);
});

// ----------------------------------------------------- the shared spellings --

// MAJOR 5's pin. sidecar/ cannot require across the packaging boundary into
// plugins/claude-kit/, and Chapter 6 records why, so battery.js carries its own
// copy of the capture hook's field cap, line cap, surrogate trim and field
// cutter. Section 3 set the precedent for exactly that shape: two
// implementations in separate processes are pinned equal by a test rather than
// shared by a require. This is that pin, and it is red if either side moves
// alone.
test('the battery spool writer and the capture hook agree on every cap and cut they both carry', () => {
    const hook = require('../plugins/claude-kit/hooks/kit-sidecar-capture.js');
    assert.strictEqual(battery.FIELD_CAP, hook.FIELD_CAP, 'field cap drifted');
    assert.strictEqual(battery.LINE_CAP_BYTES, hook.LINE_CAP_BYTES, 'line byte cap drifted');
    const probes = [
        '',
        'plain',
        'a'.repeat(hook.FIELD_CAP - 1),
        'a'.repeat(hook.FIELD_CAP),
        'a'.repeat(hook.FIELD_CAP + 50),
        // A surrogate pair straddling the cap, which is the one input the trim
        // exists for: the slice lands between the two halves.
        `${'a'.repeat(hook.FIELD_CAP - 1)}\u{1f600}tail`,
        'ends in a lone high half\ud800'
    ];
    for (const probe of probes) {
        assert.strictEqual(battery.trimLoneSurrogate(probe), hook.trimLoneSurrogate(probe),
            `trimLoneSurrogate drifted on a ${probe.length}-character probe`);
        assert.strictEqual(battery.textField(probe, battery.FIELD_CAP), hook.textField(probe),
            `textField drifted on a ${probe.length}-character probe`);
        // The third producer on the same channel. harvest.js cuts a transcript
        // field at the same cap and its output is later replayed into a real
        // spool line, so a cut of its own that left an orphan surrogate half
        // would put one there. Every probe above is free of the unsafe class,
        // which is the only thing harvest.cut removes that the hook does not,
        // so the two must agree character for character on all of them.
        assert.strictEqual(harvest.cut(probe), hook.textField(probe),
            `the harvest field cutter drifted on a ${probe.length}-character probe`);
    }
    assert.strictEqual(battery.textField(42, battery.FIELD_CAP), hook.textField(42), 'a non-string drifted');
    assert.strictEqual(harvest.cut(42), hook.textField(42), 'a non-string drifted in the harvest cutter');
    assert.strictEqual(harvest.FIELD_CAP, hook.FIELD_CAP, 'the harvest field cap drifted');
});

// MAJOR 4's cross-component pin: the battery writes the frozen index and the
// daemon's own resolver reads it back. Both ask sidecar/memory-index.js the
// same question, so a change to how a project resolves to an index path moves
// the writer and the reader together. The coverage limit is stated rather than
// glossed: the inputs the two spellings diverge on (a UNC path, a worktree
// checkout) cannot be built under a temp directory here, so what this pins is
// that the writer and the real reader agree, and the shared spelling is what
// carries the rest.
test('the fixture index is written where the daemon own resolver reads it', (t) => {
    const stateDir = freshStateDir(t);
    const fixture = battery.buildFixture(stateDir, 'recognition', battery.runSessions('pin'));
    const cwd = path.join(stateDir, 'recognition-cwd');
    const loaded = memoryIndex.loadIndex(cwd, { memoryRoot: fixture.memoryRoot });
    assert.strictEqual(loaded.status, 'ok', `the daemon resolver could not read the fixture index: ${JSON.stringify(loaded)}`);
    const parsed = memoryIndex.parseIndex(battery.loadRecognitionIndexText());
    assert.strictEqual(loaded.records, parsed.names.size, 'the index the reader saw is not the one the writer wrote');
});

// MAJOR 6's control, POSIX only: Node maps a mode to the read-only attribute
// alone on Windows, so the assertion cannot speak there and is skipped with
// its reason rather than asserted into a green that means nothing.
test('the fixture state is created at the same modes the daemon own writer uses', {
    skip: process.platform === 'win32' ? 'file modes are not honoured on this platform' : false
}, (t) => {
    const stateDir = freshStateDir(t);
    // The writer's own day file rather than a day recomputed here, which would
    // name a different file across UTC midnight.
    const fixture = battery.buildFixture(stateDir, 'judgment', battery.runSessions('modes'));
    const spoolDir = path.join(stateDir, 'spool');
    assert.strictEqual(fs.statSync(spoolDir).mode & 0o777, 0o700, 'the fixture spool directory is world-traversable');
    assert.strictEqual(fs.statSync(fixture.spoolFile).mode & 0o777, 0o600,
        'the fixture spool file is world-readable');
});

// The day file's name and the day its own records are stamped with are one
// value, and the pin is that they agree. They came from two clock reads before:
// the file name from a constant evaluated when this module was first loaded and
// the stamp from the moment each line was written, so a run that crossed UTC
// midnight between the two filed records for one day into a file named for
// another, and every reader that derives a day from the current clock then
// looked in the wrong place. buildFixture reads the day once and hands it back,
// which is what makes this assertable at all.
test('the fixture spool day file is named for the day its own records are stamped with', (t) => {
    const stateDir = freshStateDir(t);
    const fixture = battery.buildFixture(stateDir, 'judgment', battery.runSessions('daypin'));
    assert.strictEqual(path.basename(fixture.spoolFile), `${fixture.day}.jsonl`,
        'the fixture day file is not named for the day the fixture reports');
    const lines = fs.readFileSync(fixture.spoolFile, 'utf8').trim().split('\n');
    assert.ok(lines.length > 0, 'the fixture wrote no spool lines, so this case measures nothing');
    for (const line of lines) {
        assert.strictEqual(JSON.parse(line).ts.slice(0, 10), fixture.day,
            `a record stamped for another day sits in ${path.basename(fixture.spoolFile)}`);
    }
});

// ------------------------------------------------- harvest into the fixture --

// MAJOR 1's control. harvest.js assigns n as a pair's position in the whole
// transcript and its header calls that the triple's identity, so a set
// harvested at a --limit below the transcript's pair count carries numbers
// past its own length. The old loader validation required 1..length, so
// battery.js refused every such set and the composition the two commands
// describe to each other did not work. This is red against that validation.
test('a harvested set numbered past its own length loads and scores, since n is the triple identity', () => {
    const pairs = Array.from({ length: 30 }, (_, i) => ({
        n: i + 1, intent: 'i', command: 'c', result: i % 3 === 0 ? 'error: boom' : 'fine', isError: false
    }));
    const selected = harvest.selectTriples(pairs, 20);
    const ns = selected.triples.map((p) => p.n);
    assert.ok(Math.max(...ns) > selected.triples.length,
        'this control needs a selection whose numbering runs past its own length, or it proves nothing');

    const cases = selected.triples.map((p) => ({ n: p.n, acceptableVerdicts: ['achieved'] }));
    assert.doesNotThrow(() => battery.assertNumbering(cases, 'harvested.json', 'case'));
    const maxN = battery.maxItemN(cases);
    const scored = battery.scoreJudgment(cases, cases.map((c) => ({
        type: 'verdict', callId: battery.judgmentCallId(c.n, maxN), verdict: 'achieved', reason: ''
    })));
    assert.strictEqual(scored.unmeasured, 0, 'a sparse numbering must still resolve every callId');
    assert.strictEqual(scored.pass, true);
});

test('every callId a sparse numbering mints is still exactly sixteen hex characters', () => {
    for (const [n, maxN] of [[1, 13], [28, 28], [255, 255], [256, 300], [4095, 4096], [1, 0xffffff]]) {
        for (const id of [battery.judgmentCallId(n, maxN), battery.recognitionCallId(n, maxN)]) {
            assert.match(id, /^[0-9a-f]{16}$/, `callId ${id} is not a spool-legal id`);
        }
    }
    assert.strictEqual(battery.callIdWidth(255), 2);
    assert.strictEqual(battery.callIdWidth(256), 3, 'past 255 the width must grow or the id is malformed');
    assert.notStrictEqual(battery.judgmentCallId(1, 255), battery.judgmentCallId(1, 256));
});

test('the fixture loader refuses a non-object, an out-of-range n and a duplicate n, each by name', () => {
    assert.throws(() => battery.assertNumbering([null], 'f.json', 'case'), /is not an object/);
    assert.throws(() => battery.assertNumbering([{ n: 0 }], 'f.json', 'case'), /not a whole number/);
    assert.throws(() => battery.assertNumbering([{ n: 1.5 }], 'f.json', 'case'), /not a whole number/);
    assert.throws(() => battery.assertNumbering([{ n: battery.MAX_ITEM_N + 1 }], 'f.json', 'case'), /not a whole number/);
    assert.throws(() => battery.assertNumbering([{ n: 2 }, { n: 2 }], 'f.json', 'case'), /is duplicated/);
    assert.doesNotThrow(() => battery.assertNumbering([{ n: 7 }, { n: 900 }], 'f.json', 'case'));
});

// The refusal the header promises: a fixture line this command cannot write
// faithfully stops the run loudly rather than being quietly reshaped by a
// scaled multi-field cut this file does not carry a copy of.
test('a fixture case too large for the whole-line byte cap is refused rather than silently shortened', () => {
    const wide = '。'.repeat(battery.FIELD_CAP);
    assert.throws(() => battery.spoolLine({
        callId: 'a'.repeat(16), sessionId: 's', cwd: 'c', tool: 'Bash',
        intent: wide, command: wide, result: wide, isError: false
    }), /over the 8192-byte spool line cap/);
    assert.doesNotThrow(() => battery.spoolLine({
        callId: 'a'.repeat(16), sessionId: 's', cwd: 'c', tool: 'Bash',
        intent: 'small', command: 'ls', result: 'ok', isError: false
    }));
});

// MINOR 5's control: a field that never reached the cap but ends in an
// unpaired surrogate comes back one character shorter, so a truncated flag
// derived from the returned length says the cut fired when it did not.
test('the truncated flag records whether the cap fired, not whether a surrogate was trimmed', () => {
    const short = JSON.parse(battery.spoolLine({
        callId: 'a'.repeat(16), sessionId: 's', cwd: 'c', tool: 'Bash',
        intent: 'ends in a lone high half\ud800', command: 'ls', result: 'ok', isError: false
    }));
    assert.strictEqual(short.truncated, false, 'a surrogate trim below the cap is not a truncation');
    const long = JSON.parse(battery.spoolLine({
        callId: 'a'.repeat(16), sessionId: 's', cwd: 'c', tool: 'Bash',
        intent: 'x'.repeat(battery.FIELD_CAP + 1), command: 'ls', result: 'ok', isError: false
    }));
    assert.strictEqual(long.truncated, true, 'a field over the cap must set the flag');
});

// ------------------------------------------------------ the rest of the CLI --

test('the usage argument errors are each their own message, and --help prints the usage at exit 0', async () => {
    for (const args of [['--config'], ['--state-dir'], ['--config', '--state-dir', 'x']]) {
        const result = await runBattery(args);
        assert.strictEqual(result.code, 2, `${args.join(' ')}: ${result.stderr}`);
        assert.ok(/needs a path/.test(result.stderr), result.stderr);
    }
    const unknown = await runBattery(['--nope']);
    assert.strictEqual(unknown.code, 2);
    assert.ok(/unknown argument/.test(unknown.stderr), unknown.stderr);

    const help = await runBattery(['--help']);
    assert.strictEqual(help.code, 0);
    assert.ok(help.stdout.includes('regression battery runner'), help.stdout);
    assert.strictEqual(help.stderr, '');
});

// The default target end to end: no battery name on the command line runs both
// of them. Every other CLI case here names one, so without this the `all` path
// and the two-battery report it prints are a branch no case reaches. It also
// carries MAJOR 9's control, the report naming the prompt id behind each
// battery, because sidecar/logs.js states that an answer is comparable only to
// one produced by the same prompt against the same model and cross-run
// comparability is this instrument's whole product.
test('the default target runs both batteries and the report names both prompt versions', async (t) => {
    const cases = battery.loadJudgmentCases();
    const situations = battery.loadRecognitionSituations();
    const server = await startServer(t, (body) => {
        if (isRecognitionBody(body)) {
            const s = situations.find((ss) => body.prompt.includes(ss.situation.slice(0, 40)));
            return JSON.stringify({ applicable: s ? s.gold : [], reason: 'matches the fixture' });
        }
        const c = cases.find((cc) => body.prompt.includes(cc.intent.slice(0, 40)));
        return JSON.stringify({ verdict: c ? c.acceptableVerdicts[0] : 'achieved', reason: 'matches the fixture' });
    });
    const configPath = writeConfig(t, server.url);
    const stateDir = freshStateDir(t);
    const result = await runBattery(['--config', configPath, '--state-dir', stateDir]);
    assert.strictEqual(result.code, 0, result.stdout + result.stderr);
    assert.ok(result.stdout.includes('== judgment battery =='), result.stdout);
    assert.ok(result.stdout.includes('== recognition battery =='), result.stdout);
    assert.ok(result.stdout.includes('OVERALL: PASS'), result.stdout);
    assert.ok(result.stdout.includes('judgment-v2'), `the judgment prompt id is missing:\n${result.stdout}`);
    assert.ok(result.stdout.includes('recognition-v1'), `the recognition prompt id is missing:\n${result.stdout}`);
});

// ------------------------------------------------------- rendered log text --

// MAJOR 3's control. Every field rendered below came out of a log line, and
// sidecar/CONTRACT.md says a log line can be hand-written by anything running
// as this user, so a reader trusts no producer's character set. A bidi
// override in a model's reason, or in a record name it invented, would
// otherwise repaint the terminal of whoever is reading the disagreement
// report. The payload is written as escapes rather than as raw bytes so this
// file stays plain text a line-printing sweep can read, the same reasoning
// kit-endpoint-lib.js gives for its own character class.
test('every model-derived field the report renders is neutralized on the way to stdout', () => {
    const BIDI = '\u202e';
    const ZERO_WIDTH = '\u200b';
    const ESCAPE = '\u001b';
    const poison = `before${BIDI}reversed${ZERO_WIDTH}hidden${ESCAPE}[2J`;
    const judged = battery.scoreJudgment([{ n: 1, acceptableVerdicts: ['achieved'] }], [
        { type: 'verdict', callId: battery.judgmentCallId(1, 1), verdict: `diverged${poison}`, reason: poison }
    ]);
    const recognized = battery.scoreRecognition([{ n: 1, gold: ['a-record'] }], [
        {
            type: 'recognition', callId: battery.recognitionCallId(1, 1),
            records: [`b-record${poison}`], invented: [`c-record${poison}`], reason: poison
        }
    ]);
    for (const line of [...judged.lines, ...recognized.lines]) {
        assert.ok(!line.includes(BIDI), `a bidi override reached stdout: ${JSON.stringify(line)}`);
        assert.ok(!line.includes(ZERO_WIDTH), `a zero-width character reached stdout: ${JSON.stringify(line)}`);
        assert.ok(!line.includes(ESCAPE), `a control character reached stdout: ${JSON.stringify(line)}`);
    }
    // The control: the surrounding text still arrives, so the screen is
    // stripping the class rather than dropping the field.
    assert.ok(judged.lines.some((l) => l.includes('reversed')), judged.lines.join('\n'));
    assert.ok(recognized.lines.some((l) => l.includes('c-record')), recognized.lines.join('\n'));
});

// ------------------------------------------------------- the scaling floor --

test('the judgment floor is the audition rate carried to the fixture size, not an absolute count', () => {
    assert.strictEqual(battery.judgmentFloor(13), battery.JUDGMENT_MIN_CORRECT);
    // A fixture grown to fourteen must not pass at the same twelve, which is
    // below the rate the constant claims to reproduce.
    assert.strictEqual(battery.judgmentFloor(14), 13);
    assert.strictEqual(battery.judgmentFloor(26), 24);
    const cases = Array.from({ length: 14 }, (_, i) => ({ n: i + 1, acceptableVerdicts: ['achieved'] }));
    const record = (n, verdict) => ({ type: 'verdict', callId: battery.judgmentCallId(n, 14), verdict, reason: '' });
    const twelve = battery.scoreJudgment(cases, [
        ...Array.from({ length: 12 }, (_, i) => record(i + 1, 'achieved')),
        record(13, 'failed'), record(14, 'failed')
    ]);
    assert.strictEqual(twelve.correct, 12);
    assert.strictEqual(twelve.pass, false, 'twelve of fourteen is below the audition rate and must not pass');
});

// --------------------------------------------- what the pass says about itself --

// The counters that actually produce a call with neither a record nor a gap,
// each put in front of the reporting rule on its own. Driving them through a
// live pass would need a memq that fails, a generation lane held busy by
// another tenant and a concurrent second run; the rule is a function of numbers
// so each mechanism has a case that can only pass if that branch works.
test('the pass report names the recognition counters, the held lane and the offset resets, each for its own reason', () => {
    const healthy = {
        parsed: 28, malformed: 0, unknownVersion: 0, oversized: 0, offsetResets: 0,
        recognitionSkipped: 13, recognitionUnavailable: 0
    };
    const base = {
        counters: healthy, laneHeld: false, writeFailures: 0,
        judgmentCount: 13, situationCount: 15, recognitionScored: true
    };
    // The control, and the one that keeps every case below from passing for the
    // wrong reason: a healthy run says nothing at all, including about the
    // thirteen skips the fixture produces by design, one per judgment line
    // captured under a working directory with no memory index.
    assert.deepStrictEqual(battery.passFindings(base), [], 'a healthy pass must report nothing');

    const unavailable = battery.passFindings({ ...base, counters: { ...healthy, recognitionUnavailable: 2 } });
    assert.strictEqual(unavailable.length, 1);
    assert.ok(/2 call\(s\) whose memory index could not be loaded/.test(unavailable[0]), unavailable[0]);

    const skipped = battery.passFindings({ ...base, counters: { ...healthy, recognitionSkipped: 13 + 15 } });
    assert.strictEqual(skipped.length, 1);
    assert.ok(/15 recognition situation\(s\) whose project had no readable index/.test(skipped[0]), skipped[0]);

    // The other direction of the same subtraction, which used to be absorbed by
    // construction: clamping at zero read a count BELOW the expectation as the
    // expectation met, so a pass that skipped fewer lines than the fixture makes
    // certain reported nothing at all, and the excess every recognition
    // situation is scored against was then measured off a premise the pass had
    // just contradicted. It is as loud as the excess now.
    const shortfall = battery.passFindings({ ...base, counters: { ...healthy, recognitionSkipped: 11 } });
    assert.strictEqual(shortfall.length, 1, JSON.stringify(shortfall));
    assert.ok(/2 short of what the fixture makes certain/.test(shortfall[0]), shortfall[0]);
    assert.ok(/cannot-measure/.test(shortfall[0]), shortfall[0]);
    // The same shortfall says nothing when the recognition battery is out of
    // scope, on the gate the excess and the unavailable count already take.
    assert.deepStrictEqual(
        battery.passFindings({
            ...base, situationCount: 0, recognitionScored: false,
            counters: { ...healthy, parsed: 13, recognitionSkipped: 0 }
        }), [],
        'a judgment-only run must not fail on a skip shortfall it scores nothing from');

    // The same excess is not read at all when the recognition battery is out of
    // scope, since nothing this run scores depends on it.
    assert.deepStrictEqual(
        battery.passFindings({
            ...base, situationCount: 0, recognitionScored: false, counters: { ...healthy, parsed: 13, recognitionSkipped: 99 }
        }), [],
        'a judgment-only run must not read a recognition counter it scores nothing from');

    // MAJOR 4 (round 4): recognitionUnavailable takes the same gate. The daemon
    // counts one per judgment line when memq cannot load at all, so on a
    // judgment-only run it says nothing about any case this run scores, and
    // ungated it turned a fully measured judgment-only run into a
    // cannot-measure, the outage-versus-regression conflation the exit-code
    // split exists to prevent. The `unavailable` case above is the control that
    // the counter still fails a run that DOES score recognition.
    assert.deepStrictEqual(
        battery.passFindings({
            ...base, situationCount: 0, recognitionScored: false,
            counters: { ...healthy, parsed: 13, recognitionSkipped: 13, recognitionUnavailable: 13 }
        }), [],
        'a judgment-only run must not fail on a recognition-unavailable count it scores nothing from');

    const lane = battery.passFindings({ ...base, laneHeld: true });
    assert.strictEqual(lane.length, 1);
    assert.ok(/busy generation lane/.test(lane[0]), lane[0]);

    // The offset reset gets its own sentence, and it does NOT claim missing
    // records: a reset re-reads from the start, so it produces duplicates.
    const reset = battery.passFindings({ ...base, counters: { ...healthy, offsetResets: 1 } });
    assert.strictEqual(reset.length, 1);
    assert.ok(/re-reads a spool file from the start/.test(reset[0]), reset[0]);
    assert.ok(!/neither a record nor a gap record/.test(reset[0]),
        'an offset reset produces duplicate records, so it must not be filed under the missing-record sentence');

    // MINOR 2 (round 4): a failed write gets its own sentence for the same
    // reason the reset does. Four of the daemon's eight writeFailures sites
    // lose no record at all (an inbox alert item, an inbox memory pointer, a
    // findings line beside a verdict that did land, the persisted offset), so
    // filing the count under the missing-record sentence states a false reason.
    const wf = battery.passFindings({ ...base, writeFailures: 2 });
    assert.strictEqual(wf.length, 1);
    assert.ok(/2 failed log or inbox write\(s\)/.test(wf[0]), wf[0]);
    assert.ok(!/neither a record nor a gap record/.test(wf[0]),
        'a failed write is not always a missing record, so it must not ride the missing-record sentence');

    // And the reconciliation of what was written against what was consumed,
    // printing both numbers.
    const short = battery.passFindings({ ...base, counters: { ...healthy, parsed: 0 } });
    assert.strictEqual(short.length, 1);
    assert.ok(/wrote 28 fixture spool line\(s\) and its own daemon pass consumed 0/.test(short[0]), short[0]);
});

// ------------------------------------------------- a frozen field cut at replay --

// MAJOR 2's control. Case 9's command is longer than the field cap, so the
// judge sees a cut version of it; that is exactly what a real capture of the
// same call would have written, and it is still named, because four cases in
// this fixture carry a corrected verdict precisely because a cut removed the
// evidence the first adjudication turned on.
test('the run names every frozen field it cut at replay, and a within-cap battery names none', async (t) => {
    const cases = battery.loadJudgmentCases();
    const overCap = cases.filter((c) => [c.intent, c.command, c.result].some((f) => f.length > battery.FIELD_CAP));
    assert.ok(overCap.length > 0, 'this control needs at least one frozen field past the cap, or it proves nothing');

    const server = await startServer(t, (body) => {
        if (isRecognitionBody(body)) {
            const situations = battery.loadRecognitionSituations();
            const s = situations.find((ss) => body.prompt.includes(ss.situation.slice(0, 40)));
            return JSON.stringify({ applicable: s ? s.gold : [], reason: 'matches the fixture' });
        }
        const c = cases.find((cc) => body.prompt.includes(cc.intent.slice(0, 40)));
        return JSON.stringify({ verdict: c ? c.acceptableVerdicts[0] : 'achieved', reason: 'matches the fixture' });
    });
    const configPath = writeConfig(t, server.url);

    const judgment = await runBattery(['judgment', '--config', configPath, '--state-dir', freshStateDir(t)]);
    assert.strictEqual(judgment.code, 0, judgment.stdout + judgment.stderr);
    for (const c of overCap) {
        const line = judgment.stdout.split('\n').find((l) => l.startsWith(`frozen field cut at replay: judgment #${c.n} `));
        assert.ok(line, `case ${c.n} was cut at replay and the report does not say so:\n${judgment.stdout}`);
        assert.ok(line.includes(`${battery.FIELD_CAP}-character field cap`), line);
        const cut = battery.fieldCuts('judgment', c)[0];
        assert.ok(line.includes(`${cut.from} characters cut to ${cut.to}`), line);
    }

    // MAJOR 1 (round 4): the judgment prompt cuts ACTION again below the field
    // cap, so for a command field the line must state the number of characters
    // the judge actually saw, derived here from the prompt module exactly as
    // the report must derive it rather than duplicated as a literal.
    const judgePrompt = require('../sidecar/prompts/judgment-v2.js');
    const commandCuts = overCap.flatMap((c) => battery.fieldCuts('judgment', c)
        .filter((f) => f.field === 'command').map((f) => ({ n: c.n, ...f })));
    assert.ok(commandCuts.length > 0, 'this control needs a frozen command past the field cap, or it proves nothing');
    for (const cut of commandCuts) {
        const line = judgment.stdout.split('\n').find((l) => l.startsWith(`frozen field cut at replay: judgment #${cut.n} command`));
        assert.ok(line, judgment.stdout);
        const seen = Math.min(cut.to, judgePrompt.COMMAND_PROMPT_CAP);
        assert.ok(seen < cut.to, 'this control needs the prompt cap below the replay cut, or it proves nothing');
        assert.ok(line.includes(`the model sees the first ${seen}`),
            `the report does not state the evidence the judge actually saw (${seen} characters):\n${line}`);
    }

    // The regression pin for a field BETWEEN the two caps, which is the half of
    // this report that said nothing at all. A frozen command of 1,555
    // characters is under the 2,000-character field cap, so the replayed spool
    // line holds it whole and a cut list keyed on the field cap emits no entry
    // for it; the judgment prompt then cuts it at 1,500 and the judge scores a
    // case on evidence 55 characters shorter than the fixture, with the run
    // report silent, while sidecar/batteries/README.md states that every such
    // cut is named per case. The assertion is on the report TEXT rather than on
    // the cut record, because the defect is that the report says nothing.
    const betweenCaps = cases.flatMap((c) => battery.fieldCuts('judgment', c)
        .filter((f) => f.from <= battery.FIELD_CAP && f.seen < f.from)
        .map((f) => ({ n: c.n, ...f })));
    assert.ok(betweenCaps.length > 0,
        'this pin needs a frozen field under the field cap and over the prompt cap, or it proves nothing');
    for (const cut of betweenCaps) {
        const line = judgment.stdout.split('\n')
            .find((l) => l.startsWith(`frozen field cut at replay: judgment #${cut.n} ${cut.field}`));
        assert.ok(line, `case ${cut.n}'s ${cut.field} is cut by the prompt and the report does not say so:\n`
            + judgment.stdout);
        assert.ok(line.includes(`${cut.from} characters cut to ${cut.seen}`), line);
        assert.ok(line.includes(`${cut.promptCap}-character cap`),
            `the line must name the cap that actually fired:\n${line}`);
        // And it must not claim the field cap did it, which for this field
        // would be a number nothing in the run produced.
        assert.ok(!line.includes(`cut to ${cut.to} at the ${battery.FIELD_CAP}-character field cap`),
            `the field cap did not fire on this field and the line says it did:\n${line}`);
    }

    // The third branch of the cut sentence, driven directly because the frozen
    // fixture cannot reach it: promptEvidenceCap is Infinity for a judgment
    // intent and result, and the fixture's longest are 57 and 350 characters,
    // so no case in it cuts at the field cap without ALSO cutting at a prompt
    // cap. A branch with no case that can only pass if it works is not tested,
    // so this one is put in front of the function directly.
    const overFieldCapOnly = battery.fieldCuts('judgment', { result: 'r'.repeat(battery.FIELD_CAP + 25) });
    assert.strictEqual(overFieldCapOnly.length, 1, JSON.stringify(overFieldCapOnly));
    const only = overFieldCapOnly[0];
    assert.strictEqual(only.fieldCapFired, true);
    assert.strictEqual(only.seen, only.to, 'this branch needs no prompt cap below the field cap');
    assert.strictEqual(only.to, battery.FIELD_CAP);
    assert.strictEqual(only.from, battery.FIELD_CAP + 25);
    // The sentence itself, since the record is not what a reader of the report
    // sees. It must name the field cap as the cause, say how many characters
    // the model saw, and say nothing about a prompt cap that did not fire.
    const onlySentence = battery.cutSentence({ battery: 'judgment', n: 4, ...only });
    assert.ok(onlySentence.includes(`judgment #4 result, ${battery.FIELD_CAP + 25} characters`),
        onlySentence);
    assert.ok(onlySentence.includes(`cut to ${battery.FIELD_CAP} at the ${battery.FIELD_CAP}-character field cap`),
        onlySentence);
    assert.ok(onlySentence.includes('the cut the capture hook itself would have made on this call'),
        onlySentence);
    assert.ok(!onlySentence.includes("prompt's own"), onlySentence);
    assert.ok(!onlySentence.includes('prompt cuts this field again'),
        `no prompt cap fired on this field and the sentence claims one did:\n${onlySentence}`);

    // And the shortening textField does that is NOT the field cap. A field one
    // character inside the cap ending in an unpaired surrogate half comes back
    // shorter, and reporting that as a cut would name the field cap as the
    // cause of a cut the field cap never made.
    const loneHalf = `${'r'.repeat(battery.FIELD_CAP - 1)}\ud800`;
    assert.strictEqual(loneHalf.length, battery.FIELD_CAP);
    assert.deepStrictEqual(battery.fieldCuts('judgment', { result: loneHalf }), [],
        'a field inside the cap is not a cut, however much the surrogate trim shortens it');

    // The same shortening in the ONE place it reaches a sentence: a field of
    // exactly the field cap ending in an unpaired half, in a field the prompt
    // ALSO cuts, so an entry is emitted and the third branch renders it. The
    // field cap genuinely did not fire, and the clause that used to follow that
    // fact ("the replayed spool line holds it whole") is false anyway, because
    // the trim dropped a character. The clause is read off the two lengths now,
    // and this is the case that can only pass if it is.
    const trimmedAtCap = battery.fieldCuts('judgment', { command: loneHalf });
    assert.strictEqual(trimmedAtCap.length, 1, JSON.stringify(trimmedAtCap));
    assert.strictEqual(trimmedAtCap[0].fieldCapFired, false);
    assert.strictEqual(trimmedAtCap[0].from, battery.FIELD_CAP);
    assert.strictEqual(trimmedAtCap[0].to, battery.FIELD_CAP - 1,
        'this case needs the surrogate trim to have shortened the field, or it measures nothing');
    const trimmedSentence = battery.cutSentence({ battery: 'judgment', n: 7, ...trimmedAtCap[0] });
    assert.ok(!trimmedSentence.includes('holds it whole'),
        `the replayed line is a character short and the sentence says it is whole:\n${trimmedSentence}`);
    assert.ok(trimmedSentence.includes(`holds ${battery.FIELD_CAP - 1} of them`), trimmedSentence);
    // The control on the other side of the same clause: a field the trim did
    // not shorten still reads as held whole, so the assertion above is the
    // length compare and not the clause having been dropped.
    const wholeAtPromptCap = battery.fieldCuts('judgment', { command: 'c'.repeat(battery.FIELD_CAP) });
    assert.strictEqual(wholeAtPromptCap.length, 1, JSON.stringify(wholeAtPromptCap));
    assert.ok(battery.cutSentence({ battery: 'judgment', n: 7, ...wholeAtPromptCap[0] })
        .includes('holds it whole'), 'the whole-line clause no longer renders at all');

    // The control: the recognition fixture holds no field past either cap, so
    // its run must name none. Without it, a report that printed the line for
    // every case would pass the assertions above.
    const situations = battery.loadRecognitionSituations();
    assert.ok(situations.every((s) => battery.fieldCuts('recognition', { intent: s.situation }).length === 0),
        'this control needs a fixture inside BOTH caps, since either one firing is now named');
    const recognition = await runBattery(['recognition', '--config', configPath, '--state-dir', freshStateDir(t)]);
    assert.strictEqual(recognition.code, 0, recognition.stdout + recognition.stderr);
    assert.ok(!recognition.stdout.includes('frozen field cut at replay'), recognition.stdout);
});

// ---------------------------------------------------- disclosure of the egress --

// MAJOR 6's control, on the branch that is blind today. The daemon's own
// disclosure is composed by remoteEndpointWarning, which answers null for a
// loopback or private-network host, and this fleet's endpoint is a private
// address, so on the machines this command actually runs on that line never
// prints. The mock endpoint here is 127.0.0.1, which is that same branch: the
// egress sentence must still be there, it must name the machine boundary and
// the transport, and it must not carry the address.
test('the run discloses the machine boundary and the transport even for a private endpoint address', async (t) => {
    const server = await startServer(t, () => JSON.stringify({ verdict: 'achieved', reason: 'r' }));
    const configPath = writeConfig(t, server.url);
    const stateDir = freshStateDir(t);
    const result = await runBattery(['judgment', '--config', configPath, '--state-dir', stateDir]);
    // The run reached the endpoint and reported; this mock answers one constant
    // verdict, so it scores short (exit 3) and the score is beside the point.
    assert.ok(result.stdout.includes('== judgment battery =='), result.stdout + result.stderr);

    const line = result.stdout.split('\n').find((l) => l.startsWith('egress:'));
    assert.ok(line, `no egress disclosure was printed at all:\n${result.stdout}`);
    assert.ok(/off this machine/.test(line), line);
    assert.ok(/network/.test(line) && /cleartext HTTP/.test(line), line);
    assert.ok(/memory index/.test(line) && /command/.test(line), line);
    // The address never reaches any surface; the fingerprint identifies it.
    const port = new URL(server.url).port;
    assert.ok(!result.stdout.includes(server.url) && !result.stdout.includes(`:${port}`),
        `the endpoint address reached stdout:\n${result.stdout}`);
    // Before the run's own report of the endpoint it used, which is the only
    // ordering a reader can check from the output: the fingerprint is not known
    // until startup has read the config, so a disclosure printed ahead of it is
    // one composed before the first call.
    assert.ok(result.stdout.indexOf(line) < result.stdout.indexOf('endpoint: '), result.stdout);
});

// ------------------------------------------------- the plaintext this leaves --

// MINOR 12 and 13. The concentration of real captured commands and their output
// is the same whoever named the directory, and the shape most likely to leave
// it somewhere durable is the one that names one: a repository working tree, a
// synced folder, a shared mount. The screen refuses ~/.claude and nothing else.
test('the plaintext warning prints for a named state dir too, and the removal hint stays with the temp default', async (t) => {
    const server = await startServer(t, () => JSON.stringify({ verdict: 'achieved', reason: 'r' }));
    const configPath = writeConfig(t, server.url);
    const stateDir = freshStateDir(t);
    const named = await runBattery(['judgment', '--config', configPath, '--state-dir', stateDir]);
    assert.ok(named.stdout.includes('== judgment battery =='), named.stdout + named.stderr);
    assert.ok(named.stdout.includes('real captured commands and their output in plaintext'), named.stdout);
    assert.ok(named.stdout.includes(stateDir), named.stdout);
    // The removal hint belongs to the temp default alone, since that is the
    // only path the command chose on the caller's behalf.
    assert.ok(!named.stdout.includes('remove it when done'), named.stdout);

    // The default path. MINOR 9 (round 4): the hint is the path itself, never a
    // composed shell command, because a directory name may legally hold a quote
    // character, so a planted TMPDIR yields a hint that breaks its own quoting
    // when pasted.
    const fallback = await runBattery(['judgment', '--config', configPath]);
    assert.ok(fallback.stdout.includes('== judgment battery =='), fallback.stdout + fallback.stderr);
    const hint = fallback.stdout.split('\n').find((l) => l.includes('remove it when done'));
    assert.ok(hint, fallback.stdout);
    assert.ok(!/rm -rf|rmdir/.test(hint), `the hint composes a shell command again: ${hint}`);
    const created = hint.slice(hint.indexOf('remove it when done: ') + 'remove it when done: '.length);
    t.after(() => rmDir(created));
    assert.ok(fs.existsSync(created), `the hint does not name the directory the run created: ${hint}`);
});

// ------------------------------------------------- the fixture's own writes --

// MINOR 11's control. Both files this command writes sit at a predictable name
// under a caller-supplied --state-dir. A link planted at either leaf would be
// written through, and sidecar/harvest.js carries exactly this file-level check
// for its own single write.
test('a link planted at either fixture write path is refused rather than written through', (t) => {
    for (const which of ['spool', 'index']) {
        const stateDir = freshStateDir(t);
        const target = makeDir('kit-sidecar-battery-canary-');
        t.after(() => rmDir(target));
        const canary = path.join(target, 'canary.txt');
        fs.writeFileSync(canary, 'do not overwrite me\n', 'utf8');

        let planted;
        if (which === 'spool') {
            fs.mkdirSync(path.join(stateDir, 'spool'), { recursive: true });
            planted = path.join(stateDir, 'spool', `${new Date().toISOString().slice(0, 10)}.jsonl`);
        } else {
            const memoryRoot = path.join(stateDir, 'memory-root');
            const segment = memoryIndex.projectSegment(path.join(stateDir, 'recognition-cwd'));
            planted = memoryIndex.indexFileFor(memoryRoot, segment);
            fs.mkdirSync(path.dirname(planted), { recursive: true });
        }
        // A directory junction rather than a file symlink: a file symlink needs
        // a privilege this suite does not hold on win32, and lstat answers
        // "symbolic link" for a junction, which is the check under test.
        fs.symlinkSync(target, planted, process.platform === 'win32' ? 'junction' : 'dir');

        assert.throws(
            () => battery.buildFixture(stateDir, which === 'spool' ? 'judgment' : 'recognition', battery.runSessions('link')),
            /is not a real file, so nothing is written through it/,
            `the ${which} write followed a planted link`);
        assert.strictEqual(fs.readFileSync(canary, 'utf8'), 'do not overwrite me\n');
        assert.deepStrictEqual(fs.readdirSync(target), ['canary.txt'], 'something was written into the link target');
    }

    // The control: with nothing planted, both writes go through, so the
    // refusals above are the guard and not a broken writer.
    const clean = freshStateDir(t);
    assert.doesNotThrow(() => battery.buildFixture(clean, 'all', battery.runSessions('clean')));
});

// ------------------------------------------------ the fixture's own validation --

// MINOR 4's control. A gold name absent from the frozen index is a permanent
// miss AND an extra, because recognize.js drops any name the index does not
// hold into `invented`: a fixture defect that renders as a model recall
// regression, after fifteen endpoint calls have been spent on it.
test('a gold name the frozen index does not hold is refused at the fixture stage, before any call', () => {
    const situations = battery.loadRecognitionSituations();
    const index = battery.loadRecognitionIndexText();
    const withGold = situations.find((s) => s.gold.length > 0);
    assert.throws(
        () => battery.assertGoldInIndex(
            [{ n: 99, gold: ['not-in-the-frozen-index'] }], index, 'situations.json'),
        /the frozen index does not hold/);
    // The control on both halves: the shipped fixture passes, and a gold name
    // the index does hold passes, so the refusal is the membership test rather
    // than a check that refuses everything.
    assert.doesNotThrow(() => battery.assertGoldInIndex(situations, index, 'situations.json'));
    assert.doesNotThrow(() => battery.assertGoldInIndex([{ n: 1, gold: withGold.gold }], index, 'situations.json'));
});

// MINOR 14's control. Gold labels are rendered raw beside model-derived names
// on the report's own lines, on the same channel the model's names are screened
// for, so a refreshed fixture carrying an escape run or a bidi override in a
// label would repaint the reader's terminal from the one column nothing
// screened.
test('a gold label outside the record-name set is refused at load, and a gold label never reaches stdout unscreened', () => {
    // Written as escapes rather than raw bytes so this file stays plain text a
    // line-printing sweep can read, the same reasoning kit-endpoint-lib.js
    // gives for its own character class.
    const poison = 'a-record\u202ereversed\u200bhidden\u001b[2J';
    assert.throws(() => battery.assertSituations(
        [{ n: 1, situation: 's', gold: [poison] }], 'situations.json'), /not a record name/);
    assert.throws(() => battery.assertSituations(
        [{ n: 1, situation: 's', gold: ['has a space'] }], 'situations.json'), /not a record name/);
    // The control: the shipped fixture loads, and an ordinary record name is
    // accepted, so the refusal is the pattern rather than a blanket one.
    assert.doesNotThrow(() => battery.assertSituations(battery.loadRecognitionSituations(), 'situations.json'));
    assert.doesNotThrow(() => battery.assertSituations(
        [{ n: 1, situation: 's', gold: ['a-real.record-name'] }], 'situations.json'));

    // The print side, which is what carries the property if a fixture ever
    // reaches the scorer without passing through the loader.
    const scored = battery.scoreRecognition([{ n: 1, gold: [poison] }], []);
    for (const line of scored.lines) {
        for (const bad of ['\u202e', '\u200b', '\u001b']) {
            assert.ok(!line.includes(bad),
                `an unsafe character reached stdout from a gold label: ${JSON.stringify(line)}`);
        }
    }
    assert.ok(scored.lines[0].includes('reversed'), 'the screen must strip the class, not drop the field');
});

// MINOR 9's control: padStart never truncates, so an n past maxN mints a
// seventeen-character id that spool.parseLine rejects as malformed, and a maxN
// past the hex width the scheme reserves asks 'a'.repeat() for a negative
// count, which is a RangeError deep inside a fixture build.
test('a callId is refused rather than minted malformed when n runs past maxN or maxN past the reserved width', () => {
    for (const [n, maxN] of [[2, 1], [256, 255], [1, battery.MAX_ITEM_N + 1], [0, 5], [1.5, 5]]) {
        assert.throws(() => battery.judgmentCallId(n, maxN), /must be a whole number/, `judgment ${n}/${maxN}`);
        assert.throws(() => battery.recognitionCallId(n, maxN), /must be a whole number/, `recognition ${n}/${maxN}`);
    }
    // The control: the boundary values on the legal side still mint a
    // spool-legal id.
    for (const [n, maxN] of [[1, 1], [255, 255], [256, 256], [battery.MAX_ITEM_N, battery.MAX_ITEM_N]]) {
        assert.match(battery.judgmentCallId(n, maxN), /^[0-9a-f]{16}$/);
        assert.match(battery.recognitionCallId(n, maxN), /^[0-9a-f]{16}$/);
    }
});

// ------------------------------------------------------ harvest, the rest of it --

// MINOR 6's control. A transcript that starts mid-session, or a resumed or
// truncated one, holds tool_results whose calls are not in the file; they fall
// out of the pairing loop, so without a count of them such a file reports a
// complete-looking extraction while the header claims nothing is silently
// discarded.
test('harvest counts a tool_result whose call is not in the file, and does not count another tool own results', async (t) => {
    const { file } = writeTranscript(t, [
        // The head-truncated shape: a result with no call anywhere in the file.
        resultLine('gone-with-the-head', 'output of a call this file does not hold', false),
        bashLine('t1', 'paired', 'ls'),
        resultLine('t1', 'ok', false),
        // The control on the same counter: an ordinary non-Bash call and its
        // result, both present, which is the common case and not an orphan.
        { message: { content: [{ type: 'tool_use', id: 't2', name: 'Read', input: { file_path: 'x' } }] } },
        resultLine('t2', 'file contents', false)
    ]);
    const { pairs, orphanResults, unpaired } = await harvest.extractPairs(file);
    assert.strictEqual(pairs.length, 1);
    assert.strictEqual(unpaired, 0);
    assert.strictEqual(orphanResults, 1, 'exactly the result whose call is absent counts as an orphan');
});

test('harvest reports the orphan count on its own summary line', async (t) => {
    const { file } = writeTranscript(t, [
        resultLine('gone-with-the-head', 'output of a call this file does not hold', false),
        bashLine('t1', 'paired', 'ls'),
        resultLine('t1', 'ok', false)
    ]);
    const result = await runHarvest([file]);
    assert.strictEqual(result.code, 0, result.stderr);
    assert.ok(/1 tool_result\(s\) whose call is not in this file/.test(result.stderr), result.stderr);
});

// MINOR 7's control: --out follows whatever path it is given, and a directory
// there arrives as an EISDIR out of an unguarded write, which the command
// reports as "stopped on an unhandled error" rather than as the refusal it is.
test('harvest refuses a --out that is not a regular file, by name rather than as an unhandled error', async (t) => {
    const { dir, file } = writeTranscript(t, [bashLine('t1', 'x', 'ls'), resultLine('t1', 'ok', false)]);
    const asDir = path.join(dir, 'out-dir');
    fs.mkdirSync(asDir);
    const result = await runHarvest([file, '--out', asDir]);
    assert.strictEqual(result.code, 1, result.stdout + result.stderr);
    assert.ok(/not a regular file, refusing to write through it/.test(result.stderr), result.stderr);
    assert.ok(!/unhandled error/.test(result.stderr), result.stderr);
    assert.deepStrictEqual(fs.readdirSync(asDir), [], 'the refused write reached inside the directory');

    // The control: the same command at an ordinary path writes, so the refusal
    // is the guard rather than a broken --out.
    const plain = path.join(dir, 'harvested.json');
    const ok = await runHarvest([file, '--out', plain]);
    assert.strictEqual(ok.code, 0, ok.stdout + ok.stderr);
    assert.strictEqual(JSON.parse(fs.readFileSync(plain, 'utf8')).length, 1);
});

// The hard-link route, which is the one way into the live store the live-tree
// screen cannot close and the reason this guard is a link-count test rather
// than a screen rule. Two names for one inode: the screen resolves the outside
// name, walks its identity up through directories nowhere near the live tree,
// and correctly answers `ok`, and the write then replaces the bytes every other
// name for that file reads. A link count is a fact about a file that already
// exists, so it belongs here beside the symlink and the not-a-regular-file
// cases rather than in a predicate over a path that usually does not exist yet.
//
// The canary here stands in for the file the second name would be inside the
// live tree; this case creates nothing under the operator's own store.
test('harvest refuses a --out with a second hard link, and the other name is untouched', async (t) => {
    const { dir, file } = writeTranscript(t, [bashLine('t1', 'x', 'ls'), resultLine('t1', 'ok', false)]);
    const canary = path.join(dir, 'the-other-name');
    fs.writeFileSync(canary, 'the bytes the other name reads\n', 'utf8');
    const outPath = path.join(dir, 'harvested.json');
    try {
        fs.linkSync(canary, outPath);
    } catch (err) {
        t.diagnostic(`SKIP: this file system will not create a hard link (${err.code})`);
        return;
    }
    assert.strictEqual(fs.lstatSync(outPath).nlink, 2, 'this control needs two names for one file');
    // The screen accepts it, which is the point: the refusal below has to come
    // from the link count, because nothing about the path is inside the live
    // tree.
    // Against the fixture home the harvest child below runs under, not the
    // operator's own: this call needs a home the screen can compare against and
    // any home it accepts the path under will do, and reaching for the live one
    // would read it.
    assert.strictEqual(battery.screenStateDir(outPath, suiteHome()).status, 'ok',
        'this control needs a path the live-tree screen accepts, or it proves nothing');

    const result = await runHarvest([file, '--out', outPath]);
    assert.strictEqual(result.code, 1, result.stdout + result.stderr);
    assert.ok(/has 2 hard links/.test(result.stderr), result.stderr);
    assert.ok(/refusing to write through it/.test(result.stderr), result.stderr);
    assert.strictEqual(fs.readFileSync(canary, 'utf8'), 'the bytes the other name reads\n',
        'the refused write reached the file through its other name');

    // The control: a single-named file at an ordinary path is still written, so
    // the refusal above is the link count and not a broken --out.
    const plain = path.join(dir, 'plain.json');
    const ok = await runHarvest([file, '--out', plain]);
    assert.strictEqual(ok.code, 0, ok.stdout + ok.stderr);
    assert.strictEqual(JSON.parse(fs.readFileSync(plain, 'utf8')).length, 1);
});

// One spelling for the whole of --out. The screen judges a path, and the lstat,
// the write, the chmod, the disclosure and the summary must all name that same
// path: judging one spelling and reporting another tells a reader the plaintext
// landed somewhere the command never screened. A relative --out is where the
// two spellings visibly differ, so it is what this case hands in.
test('harvest names the resolved --out everywhere it reports on it', async (t) => {
    const { dir, file } = writeTranscript(t, [bashLine('t1', 'x', 'ls'), resultLine('t1', 'ok', false)]);
    const workdir = makeDir('kit-sidecar-harvest-cwd-');
    t.after(() => rmDir(workdir));
    const relative = 'harvested.json';
    const resolved = path.resolve(workdir, relative);
    assert.notStrictEqual(relative, resolved, 'this case needs the two spellings to differ');
    // Through the shared launcher, with the working directory as an option:
    // the child needs a cwd of its own, and it needs a fixture home for the
    // same reason every other child here does.
    const result = await runBin(HARVEST_BIN, [file, '--out', relative], undefined, { cwd: workdir });
    assert.strictEqual(result.code, 0, result.stdout + result.stderr);
    assert.strictEqual(JSON.parse(fs.readFileSync(resolved, 'utf8')).length, 1);
    assert.ok(result.stderr.includes(`in plaintext: ${resolved}`),
        `the disclosure must name the resolved path:\n${result.stderr}`);
    assert.ok(result.stderr.includes(`written to ${resolved}`),
        `the summary must name the same path the disclosure did:\n${result.stderr}`);
    assert.ok(!result.stderr.includes(`written to ${relative}`),
        `the summary names a path that depends on a working directory the reader cannot see:\n${result.stderr}`);
});

// The mode is applied rather than requested: `mode` on a write applies only
// when the write creates the file, so re-writing an existing world-readable
// path would otherwise leave this plaintext at that path's own mode. POSIX
// only, for the same reason the fixture-mode case above is: Node maps a mode to
// the read-only attribute alone on Windows.
test('harvest re-writing an existing --out file restricts it rather than keeping its mode', {
    skip: process.platform === 'win32' ? 'file modes are not honoured on this platform' : false
}, async (t) => {
    const { dir, file } = writeTranscript(t, [bashLine('t1', 'x', 'ls'), resultLine('t1', 'ok', false)]);
    const out = path.join(dir, 'harvested.json');
    fs.writeFileSync(out, 'stale\n', { encoding: 'utf8', mode: 0o644 });
    fs.chmodSync(out, 0o644);
    const result = await runHarvest([file, '--out', out]);
    assert.strictEqual(result.code, 0, result.stdout + result.stderr);
    assert.strictEqual(fs.statSync(out).mode & 0o777, 0o600, 'the re-written file kept its world-readable mode');
});

// --------------------------------------------- provenance of the scored records --

// MAJOR 2 (round 4). Every verdict and recognition record carries the promptId,
// model and endpoint fingerprint that produced it (sidecar/logs.js), and a
// concurrent run against the same --state-dir can carry a different --config,
// so a record matching a case's callId can still be another config's
// measurement; in a full interleave the foreign pass can have produced ALL of
// this run's records, so the report's endpoint fingerprint, model and prompt
// lines would name a config that produced none of them. The scorers screen each
// record against this run's own provenance, and a record another config
// produced is a cannot-measure, never a scored case.
test('a verdict record carrying another run provenance is a cannot-measure, never a scored case', () => {
    const run = { promptId: 'judgment-v2', model: 'test-model', endpoint: 'fingerprint-aa' };
    const cases = [{ n: 1, acceptableVerdicts: ['achieved'] }];
    const record = (over) => [{
        type: 'verdict', callId: battery.judgmentCallId(1, 1), verdict: 'achieved', reason: 'r',
        promptId: run.promptId, model: run.model, endpoint: run.endpoint, ...over
    }];
    for (const over of [{ promptId: 'judgment-v9' }, { model: 'someone-elses-model' }, { endpoint: 'fingerprint-bb' }]) {
        const scored = battery.scoreJudgment(cases, record(over), run);
        assert.strictEqual(scored.measured, 0,
            `a record differing on ${Object.keys(over)[0]} was scored as this run's own`);
        assert.strictEqual(scored.pass, false);
        assert.ok(scored.lines[0].includes('CANNOT-MEASURE'), scored.lines[0]);
        assert.ok(/provenance/.test(scored.lines[0]), scored.lines[0]);
    }
    // The control: the identical record under this run's own provenance is
    // measured and passes, so the refusal above is the comparison rather than
    // a screen that refuses everything.
    const own = battery.scoreJudgment(cases, record({}), run);
    assert.strictEqual(own.measured, 1);
    assert.strictEqual(own.pass, true);
});

test('a recognition record carrying another run provenance is a cannot-measure, never an answer', () => {
    const run = { promptId: 'recognition-v1', model: 'test-model', endpoint: 'fingerprint-aa' };
    const situations = [{ n: 1, gold: [] }];
    const record = (over) => [{
        type: 'recognition', callId: battery.recognitionCallId(1, 1), records: [], invented: [], reason: 'r',
        promptId: run.promptId, model: run.model, endpoint: run.endpoint, ...over
    }];
    for (const over of [{ promptId: 'recognition-v9' }, { model: 'someone-elses-model' }, { endpoint: 'fingerprint-bb' }]) {
        const scored = battery.scoreRecognition(situations, record(over), run);
        assert.strictEqual(scored.measured, 0,
            `a record differing on ${Object.keys(over)[0]} was scored as this run's own`);
        assert.strictEqual(scored.pass, false);
        assert.ok(scored.lines[0].includes('CANNOT-MEASURE'), scored.lines[0]);
        assert.ok(/provenance/.test(scored.lines[0]), scored.lines[0]);
    }
    const own = battery.scoreRecognition(situations, record({}), run);
    assert.strictEqual(own.measured, 1);
    assert.strictEqual(own.pass, true);
});

// MAJOR 1 (round 4), the prompt side of the pin: the run report derives its
// evidence number from judgmentPrompt.COMMAND_PROMPT_CAP, so that number is
// honest only while formatTriple actually cuts ACTION at that same constant.
// This is red if the prompt's own slice ever drifts from the constant the
// report reads.
test('the judgment prompt embeds exactly COMMAND_PROMPT_CAP characters of an over-cap command', () => {
    const judgePrompt = require('../sidecar/prompts/judgment-v2.js');
    const long = 'c'.repeat(battery.FIELD_CAP + 100);
    const triple = judgePrompt.formatTriple({ intent: 'i', command: long, result: 'r', isError: false });
    const fenced = /<<<ACTION ([0-9a-f]+)>>>\n([\s\S]*?)\n<<<END ACTION \1>>>/.exec(triple);
    assert.ok(fenced, `no fenced ACTION block found:\n${triple.slice(0, 200)}`);
    assert.strictEqual(fenced[2].length, judgePrompt.COMMAND_PROMPT_CAP,
        'the ACTION the judge sees is not the length the exported constant claims');
    assert.ok(judgePrompt.COMMAND_PROMPT_CAP < battery.FIELD_CAP,
        'this pin matters because the prompt cap sits below the field cap; if that flips, the report clause must move too');
});

// ---------------------------------------- disclosure survives a failed start --

// MAJOR 3 (round 4). buildFixture writes the fixture spool (thirteen real
// production commands with their output) and the frozen index to disk before
// the endpoint config is ever read, so a run that cannot start has already
// left the plaintext behind; a disclosure printed only on the success path
// tells the operator about it on every path except the ones where they most
// need telling. Both lines print before buildFixture runs, so every later exit
// has already disclosed them.
test('a run that cannot start still discloses the plaintext its fixture already wrote, with the removal hint', async (t) => {
    const cfgDir = makeDir('kit-sidecar-battery-cfg-');
    t.after(() => rmDir(cfgDir));
    const missing = path.join(cfgDir, 'nothing.json');
    // No --state-dir: the temp default is the one path the command chose on
    // the caller's behalf, so this path must carry the removal hint too.
    const result = await runBattery(['judgment', '--config', missing]);
    assert.strictEqual(result.code, 1, result.stdout + result.stderr);
    assert.ok(/no endpoint/i.test(result.stderr), result.stderr);
    const plaintext = result.stdout.split('\n').find((l) => l.includes('real captured commands and their output in plaintext'));
    assert.ok(plaintext, `the failed run never disclosed the plaintext it wrote:\n${result.stdout}${result.stderr}`);
    const hint = result.stdout.split('\n').find((l) => l.includes('remove it when done'));
    assert.ok(hint, `the failed run never printed the removal hint:\n${result.stdout}`);
    const created = hint.slice(hint.indexOf('remove it when done: ') + 'remove it when done: '.length);
    assert.ok(created, hint);
    t.after(() => rmDir(created));
    // The spool the disclosure is about really is there: the failed run left
    // the plaintext the lines name.
    // The day file is named by the CHILD's clock, so this reads the directory
    // rather than recomputing a day that can differ from the child's across UTC
    // midnight.
    const spooled = fs.readdirSync(path.join(created, 'spool')).filter((n) => /^\d{4}-\d{2}-\d{2}\.jsonl$/.test(n));
    assert.strictEqual(spooled.length, 1,
        `no fixture spool under the disclosed state root ${created}: ${JSON.stringify(spooled)}`);
});

// ----------------------------------------------------- the report's own reads --

// MINOR 1 (round 4): JSON.parse accepts `null`, a number, a string and an
// array, and `null` in the records list crashes the scorers' type filter with
// a TypeError into the generic catch. A parsed value that is not a non-array
// object says nothing a record says, so it counts as malformed.
test('a log line parsing to null or any non-object counts as malformed, never into the records list', (t) => {
    const dir = makeDir('kit-sidecar-battery-read-');
    t.after(() => rmDir(dir));
    const file = path.join(dir, 'log.jsonl');
    fs.writeFileSync(file, 'null\n42\n"a string"\n[]\n{"type":"verdict","callId":"x"}\n', 'utf8');
    const read = battery.readJsonl(file);
    assert.strictEqual(read.malformed, 4, `null, 42, a string and an array must all count: ${JSON.stringify(read)}`);
    assert.strictEqual(read.records.length, 1);
    assert.doesNotThrow(() => read.records.filter((r) => r.type === 'verdict'));
});

// MINOR 4 (round 4): a case that loaded fine but cannot be serialized within
// the whole-line cap is not a fixture that cannot be loaded, and the file's own
// stage comment states that distinction as the reason stages exist.
test('the over-the-line-cap refusal carries its own serialize stage, not the fixture-load stage', () => {
    const wide = '。'.repeat(battery.FIELD_CAP);
    let err = null;
    try {
        battery.spoolLine({
            callId: 'a'.repeat(16), sessionId: 's', cwd: 'c', tool: 'Bash',
            intent: wide, command: wide, result: wide, isError: false
        });
    } catch (e) { err = e; }
    assert.ok(err, 'the oversized line must still be refused');
    assert.strictEqual(err.stage, 'serialize', `the refusal rode the wrong stage: ${err.stage}`);
});

// MINOR 3 (round 4): truncateForReport and the gap-note render cut at a cap in
// the same file whose shared trim exists because a JavaScript slice can land
// between the halves of a surrogate pair; without the trim, the report itself
// ships the orphan half the rest of this tree screens out.
test('a report field cut mid-surrogate-pair is trimmed, never rendered with an orphan half', () => {
    const lonePattern = /[\ud800-\udbff](?![\udc00-\udfff])/;
    // 199 characters then an emoji: truncateForReport cuts the reason at 200,
    // which lands exactly between the two halves.
    const reason = `${'r'.repeat(199)}\u{1f600}gets cut`;
    const scored = battery.scoreJudgment([{ n: 1, acceptableVerdicts: ['achieved'] }], [
        { type: 'verdict', callId: battery.judgmentCallId(1, 1), verdict: 'failed', reason }
    ]);
    for (const line of scored.lines) {
        assert.ok(!lonePattern.test(line), `an orphan surrogate half reached stdout: ${JSON.stringify(line)}`);
    }
    assert.ok(scored.lines[0].includes('r'.repeat(50)), 'the control: the reason text itself still renders');
});

test('a gap note cut mid-surrogate-pair at the text cap is trimmed on its way to stdout', async (t) => {
    const { TEXT_MAX_CHARS } = require('../sidecar/text.js');
    const lonePattern = /[\ud800-\udbff](?![\udc00-\udfff])/;
    const cases = battery.loadJudgmentCases();
    const server = await startServer(t, (body) => {
        const c = cases.find((cc) => body.prompt.includes(cc.intent.slice(0, 40)));
        return JSON.stringify({ verdict: c ? c.acceptableVerdicts[0] : 'achieved', reason: 'r' });
    });
    const configPath = writeConfig(t, server.url);
    const { home, stateDir } = inProcessRoots(t);
    const token = 'abcd1234';
    const sessions = battery.runSessions(token);
    // A hand-written gap record, which CONTRACT.md admits, whose note runs past
    // the render cap with a surrogate pair straddling it.
    const note = `${'n'.repeat(TEXT_MAX_CHARS - 1)}\u{1f600}tail`;
    const logsDir = path.join(stateDir, 'logs');
    fs.mkdirSync(logsDir, { recursive: true });
    fs.writeFileSync(logs.sessionLogFile(logsDir, sessions.judgment),
        JSON.stringify({ v: 1, type: 'gap', note }) + '\n', 'utf8');

    const printed = [];
    const code = await battery.main(['judgment', '--config', configPath, '--state-dir', stateDir], {
        newRunToken: () => token,
        write: (text) => printed.push(text),
        warn: () => {},
        homeDir: home
    });
    const out = printed.join('');
    assert.ok(out.includes('gap record(s)'), `the planted gap record never rendered:\n${out}`);
    assert.ok(!lonePattern.test(out), 'an orphan surrogate half reached the report');
    assert.strictEqual(code, 0, `a rendered gap note must not change the score of a fully measured run:\n${out}`);

    // And the sentence beside it says only what this branch knows. The gap
    // record planted here belongs to no call this run scored, the run is a
    // measured pass, and a line flatly calling the run a cannot-measure would
    // be printing that beside OVERALL: PASS and an exit code of 0. It points at
    // the lines that decide the run-level answer instead.
    const gapLine = out.split('\n').find((l) => l.includes('gap record(s)'));
    assert.ok(/whether this run is a cannot-measure is the CANNOT-MEASURE lines below and the exit code/
        .test(gapLine), `the gap line asserts a run-level answer this branch has not made:\n${gapLine}`);
    assert.ok(out.includes('OVERALL: PASS'),
        `this case needs the passing report to be the one carrying the gap line:\n${out}`);
});

// ------------------------------------------------ harvest, round 4's findings --

// MINOR 5 (round 4): a Bash tool_use whose input is absent or whose command is
// not a string enters seenCallIds but never pending, so it was counted in
// neither `unpaired` nor `orphanResults`: a silent discard in the one reader
// whose header claims there are none.
test('harvest counts a Bash tool_use carrying no string command, and its result is not an orphan', async (t) => {
    const { file } = writeTranscript(t, [
        { message: { content: [{ type: 'tool_use', id: 't1', name: 'Bash' }] } },
        { message: { content: [{ type: 'tool_use', id: 't2', name: 'Bash', input: { command: 42 } }] } },
        resultLine('t1', 'output of the commandless call', false),
        bashLine('t3', 'paired', 'ls'),
        resultLine('t3', 'ok', false)
    ]);
    const { pairs, commandless, orphanResults, unpaired } = await harvest.extractPairs(file);
    assert.strictEqual(pairs.length, 1);
    assert.strictEqual(commandless, 2, 'the absent-input call and the non-string-command call must both count');
    assert.strictEqual(orphanResults, 0, 'its call IS in the file, so its result is not an orphan');
    assert.strictEqual(unpaired, 0);
});

test('harvest reports the commandless count on its summary line', async (t) => {
    const { file } = writeTranscript(t, [
        { message: { content: [{ type: 'tool_use', id: 't1', name: 'Bash' }] } },
        bashLine('t2', 'paired', 'ls'),
        resultLine('t2', 'ok', false)
    ]);
    const result = await runHarvest([file]);
    assert.strictEqual(result.code, 0, result.stderr);
    assert.ok(/1 Bash tool_use\(s\) carrying no string command/.test(result.stderr), result.stderr);
});

// MINOR 6 (round 4): --out took no live-tree screen while --state-dir builds a
// four-way one in the same section, so --out naming a real capture day file
// would overwrite it with a JSON array. The resolved --out goes through the
// same shared screen, so the pair has one posture. The fixture home is what
// makes the red state safe: a broken screen writes into a directory this suite
// owns rather than the operator's own store.
test('harvest --out into the live .claude tree is refused by the screen with nothing written', async (t) => {
    const home = fixtureHomeDir(t);
    const { file } = writeTranscript(t, [bashLine('t1', 'x', 'ls'), resultLine('t1', 'ok', false)]);
    const spoolDir = path.join(home, '.claude', 'kit-sidecar', 'spool');
    fs.mkdirSync(spoolDir, { recursive: true });
    const dayFile = path.join(spoolDir, '2026-01-01.jsonl');
    fs.writeFileSync(dayFile, '{"a":"real capture line"}\n', 'utf8');
    const result = await runHarvest([file, '--out', dayFile], { HOME: home, USERPROFILE: home });
    assert.strictEqual(result.code, 1, result.stdout + result.stderr);
    assert.ok(/refus/i.test(result.stderr), result.stderr);
    // Which rule refused it, in words: the spelling comparison, the candidate
    // sitting inside the live tree by name with no link anywhere on it.
    assert.ok(/names a path inside the live/.test(result.stderr), result.stderr);
    // And the refusal names the tree the screen actually compared against,
    // which here is this fixture home's, composed from the screen's own answer.
    // A fixed `the live store` in that sentence would describe the operator's
    // real store over a comparison made against this one.
    assert.ok(result.stderr.includes(`never writes into ${path.join(home, '.claude')}`),
        `the refusal names a tree the screen did not compare against:\n${result.stderr}`);
    assert.strictEqual(fs.readFileSync(dayFile, 'utf8'), '{"a":"real capture line"}\n', 'the day file was overwritten');
    // The control: a path under the same home but outside .claude still
    // writes, so the refusal is the screen rather than a broken --out.
    const plain = path.join(home, 'harvested.json');
    const ok = await runHarvest([file, '--out', plain], { HOME: home, USERPROFILE: home });
    assert.strictEqual(ok.code, 0, ok.stdout + ok.stderr);
    assert.strictEqual(JSON.parse(fs.readFileSync(plain, 'utf8')).length, 1);
});

// MINOR 7 (round 4): the harvest emits the same class of material the battery
// prints its plaintext-concentration line for, verbatim captured commands and
// their output, so the same statement prints on both branches; on stderr, so
// the stdout branch's JSON payload stays parseable.
test('harvest disclosure names the plaintext concentration on both the stdout and --out branches', async (t) => {
    const { dir, file } = writeTranscript(t, [bashLine('t1', 'x', 'ls'), resultLine('t1', 'ok', false)]);
    const toStdout = await runHarvest([file]);
    assert.strictEqual(toStdout.code, 0, toStdout.stderr);
    assert.ok(toStdout.stderr.includes('real captured commands and their output in plaintext'), toStdout.stderr);
    assert.doesNotThrow(() => JSON.parse(toStdout.stdout), 'the disclosure must not corrupt the JSON payload');
    const outPath = path.join(dir, 'harvested.json');
    const toFile = await runHarvest([file, '--out', outPath]);
    assert.strictEqual(toFile.code, 0, toFile.stderr);
    assert.ok(toFile.stderr.includes('real captured commands and their output in plaintext'), toFile.stderr);
});

// =============================================================================
// The write-target guard at the boundary every writer in this tree shares, the
// per-component guard's refusal of a target outside its own root, the harvest
// reader's collision count, the re-screen at the moment of the write, and the
// fixture spool's line boundary.
//
// sidecar/inbox.js is exercised from this file rather than from one of its own
// because its writing half now holds no guard of its own: it appends through
// logs.appendJsonLine, and this is where that function's guard is pinned.
// =============================================================================

// Whether this file system will make a second name for one inode here. A hard
// link is the route no containment screen can close, so a case built on one
// says out loud when the platform cannot build it rather than passing quietly.
function makeHardLink(existing, second) {
    try {
        fs.linkSync(existing, second);
        return fs.lstatSync(second).nlink === 2;
    } catch {
        return false;
    }
}

// MAJOR 3's control. The daemon's verdict logs and the shared findings file sit
// at FIXED names under a caller-supplied --state-dir (sidecar/config.js spells
// them), so a link planted at one of them is waiting before the write rather
// than racing it. An append reaches every name for an inode, and what these
// records carry is the working directory, the stated intent, a command preview
// and the model's reason for each diverged call.
//
// The refusing rule is guardWriteTarget's link-count test: the canary and the
// log name are one inode with nlink 2, and the append must not reach the canary
// through its other name.
test('appendJsonLine refuses a log name carrying a second hard link, and the other name is untouched', (t) => {
    const dir = makeDir('kit-sidecar-battery-append-');
    t.after(() => rmDir(dir));
    const canary = path.join(dir, 'the-other-name');
    fs.writeFileSync(canary, 'the bytes the other name reads\n', 'utf8');
    const target = path.join(dir, 'findings.jsonl');
    if (!makeHardLink(canary, target)) {
        t.diagnostic('SKIP: this file system will not create a hard link');
        return;
    }
    assert.strictEqual(logs.appendJsonLine(target, { v: 1, preview: 'a command preview' }), false,
        'the append landed, so nothing refused a second name for one inode');
    assert.strictEqual(fs.readFileSync(canary, 'utf8'), 'the bytes the other name reads\n',
        'the refused append reached the file through its other name');

    // The control: an ordinary single-named path still takes the append, so the
    // refusal above is the link count and not a broken writer.
    const plain = path.join(dir, 'plain.jsonl');
    assert.strictEqual(logs.appendJsonLine(plain, { v: 1, ok: true }), true);
    assert.strictEqual(JSON.parse(fs.readFileSync(plain, 'utf8').trim()).ok, true);
});

// The same guard against the other shape a fixed name can wear. The refusing
// rule here is guardWriteTarget's symlink test, a different branch from the
// link count above and so its own case: a run that only ever planted a hard
// link could not tell a guard testing both from one testing one.
test('appendJsonLine refuses a log name that is a symlink', (t) => {
    const dir = makeDir('kit-sidecar-battery-appendlink-');
    t.after(() => rmDir(dir));
    const canary = path.join(dir, 'pointed-at.jsonl');
    fs.writeFileSync(canary, '', 'utf8');
    const target = path.join(dir, 'findings.jsonl');
    try {
        fs.symlinkSync(canary, target, 'file');
    } catch {
        t.diagnostic('SKIP: this file system or account will not create a symlink');
        return;
    }
    assert.strictEqual(logs.appendJsonLine(target, { v: 1, preview: 'a command preview' }), false);
    assert.strictEqual(fs.readFileSync(canary, 'utf8'), '',
        'the refused append was written through the link');
});

// MAJOR 3, the state file's half. saveState writes a sibling and renames over
// the target, so the sibling is the path that takes the bytes, and it is a
// fixed name because the target is one. It is also the only write here that
// REPLACES rather than appends, so a second name for that inode has its bytes
// overwritten rather than added to.
//
// The refusing rule is again guardWriteTarget's link count, read on the .tmp
// sibling rather than on the state file.
test('saveState refuses when its temporary sibling carries a second hard link', (t) => {
    const dir = makeDir('kit-sidecar-battery-savestate-');
    t.after(() => rmDir(dir));
    const canary = path.join(dir, 'the-other-name');
    fs.writeFileSync(canary, 'the bytes the other name reads\n', 'utf8');
    const stateFile = path.join(dir, 'offsets.json');
    if (!makeHardLink(canary, stateFile + '.tmp')) {
        t.diagnostic('SKIP: this file system will not create a hard link');
        return;
    }
    assert.strictEqual(logs.saveState(stateFile, logs.emptyState()), false,
        'the state write landed, so nothing refused a second name for the sibling it writes');
    assert.strictEqual(fs.readFileSync(canary, 'utf8'), 'the bytes the other name reads\n',
        'the refused write replaced the bytes the other name reads');
    assert.ok(!fs.existsSync(stateFile), 'nothing should have been renamed into place');

    // The control: with the sibling free, the same call lands.
    fs.unlinkSync(stateFile + '.tmp');
    assert.strictEqual(logs.saveState(stateFile, logs.emptyState()), true);
    assert.strictEqual(JSON.parse(fs.readFileSync(stateFile, 'utf8')).v, logs.LOG_VERSION);
});

// MAJOR 3, the inbox's half, and the reason inbox.js holds no guard of its own.
// Its private variant tested symlink and irregular only: a second hard link at
// a session's inbox file passed it, and a failed lstat read as ABSENT rather
// than as a refusal. Appending through the shared writer is what gives it the
// link count, so the refusing rule here is guardWriteTarget's nlink test
// reached from inbox.writeItem.
test('inbox.writeItem refuses a session file carrying a second hard link', (t) => {
    const dir = makeDir('kit-sidecar-battery-inbox-');
    t.after(() => rmDir(dir));
    const canary = path.join(dir, 'the-other-name');
    fs.writeFileSync(canary, 'the bytes the other name reads\n', 'utf8');
    const item = { v: 1, kind: 'alert', sessionId: 'a-session', intent: 'i', reason: 'r' };
    const target = path.join(dir, logs.sessionSlug(item.sessionId) + '.jsonl');
    if (!makeHardLink(canary, target)) {
        t.diagnostic('SKIP: this file system will not create a hard link');
        return;
    }
    assert.strictEqual(inbox.writeItem(dir, item), false);
    assert.strictEqual(fs.readFileSync(canary, 'utf8'), 'the bytes the other name reads\n');

    // The control: a session whose file is free still takes its item, so the
    // refusal above is the link count and not a broken inbox.
    assert.strictEqual(inbox.writeItem(dir, { ...item, sessionId: 'another-session' }), true);
});

// MINOR 1. ensureDir called WITH a guardFrom is a caller asking for the
// per-component walk. A target outside that root cannot be covered by it, and
// answering that case with the permissive recursive create is the shape where
// a guard becomes no guard without saying so.
//
// The refusing rule is ensureDir's own containment test on the relative path: a
// parent-directory segment, or a relative path that came back absolute because
// the two spellings have different roots.
test('ensureDir refuses a target outside the root it was told to guard from, and creates nothing', (t) => {
    const dir = makeDir('kit-sidecar-battery-ensure-');
    t.after(() => rmDir(dir));
    const root = path.join(dir, 'root');
    fs.mkdirSync(root);
    const escaped = path.join(dir, 'sibling', 'deep');

    const answer = logs.ensureDir(escaped, root);
    assert.strictEqual(answer.ok, false, JSON.stringify(answer));
    assert.ok(/is not under/.test(answer.reason), answer.reason);
    assert.ok(!fs.existsSync(path.join(dir, 'sibling')),
        'the refused call created the directory anyway, so the refusal is only a return value');

    // Two controls, both drawn from the rule rather than from a spelling. A
    // target UNDER the root is created, so the refusal above is containment and
    // not a broken creator; and the root itself is accepted, since an empty
    // relative path is not an escape.
    const inside = path.join(root, 'a', 'b');
    assert.strictEqual(logs.ensureDir(inside, root).ok, true);
    assert.ok(fs.statSync(inside).isDirectory());
    assert.strictEqual(logs.ensureDir(root, root).ok, true);
});

// MINOR 4. A repeated tool_use id displaces the earlier call, and the displaced
// call is counted by none of the other five: it never reaches pairs, it is gone
// from pending before the file ends so it is not unpaired, and its own result
// is in the file so it is not an orphan. The header claims nothing is silently
// discarded, and this count is what keeps that true.
test('harvest counts a Bash tool_use repeating an id still awaiting its result', async (t) => {
    const { file } = writeTranscript(t, [
        bashLine('t1', 'the first call', 'echo first'),
        bashLine('t1', 'the second call under the same id', 'echo second'),
        resultLine('t1', 'only one result', false)
    ]);
    const extracted = await harvest.extractPairs(file);
    assert.strictEqual(extracted.collidingIds, 1, JSON.stringify(extracted));
    assert.strictEqual(extracted.pairs.length, 1);
    assert.strictEqual(extracted.unpaired, 0);
    assert.strictEqual(extracted.orphanResults, 0);

    // The control: two calls under DISTINCT ids, otherwise identical, count no
    // collision. The discriminator is the id being repeated, not the transcript
    // holding two Bash calls.
    const { file: clean } = writeTranscript(t, [
        bashLine('t1', 'the first call', 'echo first'),
        bashLine('t2', 'the second call under its own id', 'echo second'),
        resultLine('t1', 'one result', false),
        resultLine('t2', 'another result', false)
    ]);
    assert.strictEqual((await harvest.extractPairs(clean)).collidingIds, 0);
});

test('the harvest summary line names the id collisions it counted', async (t) => {
    const { dir, file } = writeTranscript(t, [
        bashLine('t1', 'the first call', 'echo first'),
        bashLine('t1', 'the second call under the same id', 'echo second'),
        resultLine('t1', 'only one result', false)
    ]);
    const result = await runHarvest([file, '--out', path.join(dir, 'harvested.json')]);
    assert.strictEqual(result.code, 0, result.stderr);
    assert.ok(/1 Bash tool_use\(s\) repeating an id still awaiting a result/.test(result.stderr), result.stderr);
});

// MINOR 5, and Standing Brief Amendment 7 applied to a window rather than to a
// path. The --out screen runs before the transcript is opened and the write
// runs after it is read, and a transcript read is of unbounded duration. A
// reparse point planted on an INTERMEDIATE directory of --out inside that
// window is unscreened by the first screen, and the write-target guard cannot
// see it: its lstat resolves through the junction and answers absent, which is
// ok.
//
// The window is driven through main's own readPairs seam rather than by racing
// a large transcript, so the case is deterministic. What it plants is a link
// into a FIXTURE live tree, and the fixture home reaches the screen two ways:
// as HOME and USERPROFILE on the child, and as main's own homeDir operand. The
// operand is the one that carries, since os.homedir() is read inside the
// process that calls the screen and an environment redirect only reaches it
// because that process happens to be a child here. The operator's store is not
// an operand of this case either way.
//
// The refusing rule is the re-screen: the live-tree screen run on the directory
// the file lands in, immediately before the write.
test('harvest re-screens the directory --out lands in at the moment of the write', async (t) => {
    const home = fixtureHomeDir(t);
    const { dir, file } = writeTranscript(t, [bashLine('t1', 'x', 'ls'), resultLine('t1', 'ok', false)]);
    const outDir = path.join(dir, 'out-dir');
    fs.mkdirSync(outDir);
    const outPath = path.join(outDir, 'harvested.json');
    const liveInside = path.join(home, '.claude', 'planted');
    fs.mkdirSync(liveInside, { recursive: true });

    const driver = path.join(dir, 'driver.js');
    fs.writeFileSync(driver, [
        "'use strict';",
        'const fs = require(' + JSON.stringify('fs') + ');',
        'const harvest = require(' + JSON.stringify(HARVEST_BIN) + ');',
        'const [transcript, out, plantAt, target, home] = process.argv.slice(2);',
        'harvest.main([transcript, ' + JSON.stringify('--out') + ', out], {',
        '    homeDir: home,',
        '    readPairs: async (f) => {',
        '        fs.rmSync(plantAt, { recursive: true, force: true });',
        "        fs.symlinkSync(target, plantAt, process.platform === 'win32' ? 'junction' : 'dir');",
        '        return harvest.extractPairs(f);',
        '    }',
        '}).then((code) => { process.exitCode = code; });'
    ].join('\n'), 'utf8');

    const result = await runBin(driver, [file, outPath, outDir, liveInside, home],
        { HOME: home, USERPROFILE: home });
    if (/EPERM|EACCES|ENOSYS|ENOTSUP/.test(result.stderr)) {
        t.diagnostic('SKIP: this account cannot create a directory link: ' + result.stderr.trim());
        return;
    }
    assert.strictEqual(result.code, 1, result.stdout + result.stderr);
    assert.ok(/the directory --out lands in/.test(result.stderr), result.stderr);
    assert.ok(!fs.existsSync(path.join(liveInside, 'harvested.json')),
        'the write landed inside the live tree through the link planted mid-read');

    // The control: the same driver, planting a link to a directory OUTSIDE the
    // live tree, still writes. The refusal above is the re-screen's containment
    // answer and not the re-screen refusing every mid-read change.
    const elsewhere = path.join(dir, 'elsewhere');
    fs.mkdirSync(elsewhere);
    const okDir = path.join(dir, 'out-dir-2');
    fs.mkdirSync(okDir);
    const ok = await runBin(driver, [file, path.join(okDir, 'harvested.json'), okDir, elsewhere, home],
        { HOME: home, USERPROFILE: home });
    assert.strictEqual(ok.code, 0, ok.stdout + ok.stderr);
    assert.strictEqual(JSON.parse(fs.readFileSync(path.join(elsewhere, 'harvested.json'), 'utf8')).length, 1);
});

// MINOR 6. A JSONL appender owns the line boundary it starts on.
// sidecar/CONTRACT.md names a torn write as an expected state of a day file, so
// against a re-used --state-dir whose day file ends mid-line, an append
// starting at the cursor concatenates the first fixture line onto the partial
// one and loses both as a single malformed record.
test('the fixture spool starts on a line boundary against a day file that ends mid-line', (t) => {
    const stateDir = freshStateDir(t);

    // Build once to learn which day file this run writes, then tear that file
    // and build again into the same root.
    battery.buildFixture(stateDir, 'judgment', battery.runSessions('probe-a'));
    const spoolDir = path.join(stateDir, 'spool');
    const names = fs.readdirSync(spoolDir).filter((n) => n.endsWith('.jsonl'));
    assert.strictEqual(names.length, 1, JSON.stringify(names));
    const dayFile = path.join(spoolDir, names[0]);

    const torn = '{"v":1,"callId":"torn","command":"a line cut off by a cra';
    fs.writeFileSync(dayFile, torn, 'utf8');
    battery.buildFixture(stateDir, 'judgment', battery.runSessions('probe-b'));

    const lines = fs.readFileSync(dayFile, 'utf8').split('\n').filter((l) => l !== '');
    assert.strictEqual(lines[0], torn, 'the partial line must survive as its own line');
    // Every line after the torn one is a whole record. Without the boundary
    // check the first fixture line is glued onto the torn one and both are lost
    // as one unparseable line.
    const unparseable = lines.slice(1).filter((l) => {
        try { JSON.parse(l); return false; } catch { return true; }
    });
    assert.deepStrictEqual(unparseable, [],
        'a fixture line was concatenated onto the partial line the day file ended with');
    assert.ok(lines.length > 1, 'the second build wrote nothing');

    // The control: against a day file ending ON a boundary, no blank line is
    // introduced, so the fix does not pay for itself with an empty record on
    // every ordinary append.
    fs.writeFileSync(dayFile, lines.slice(1).join('\n') + '\n', 'utf8');
    battery.buildFixture(stateDir, 'judgment', battery.runSessions('probe-c'));
    assert.ok(!fs.readFileSync(dayFile, 'utf8').includes('\n\n'),
        'a leading newline was written onto a file that already ended on a boundary');
});

// MINOR 9's control, and the shape of the absorption it closes. The coverage
// floor is keyed by the <transform, volume> PAIR, because availability is a
// per-volume fact: 8.3 alias generation is a per-volume setting, and it is why
// the table runs over two bases at all.
//
// The holed table below is built from that rule rather than from a spelling: a
// transform available on BOTH volumes that produced cells on only one. Keyed by
// transform alone it is one row reading available and checked, which passes;
// keyed by the pair it is two rows, one of them available with nothing checked,
// which is the hole.
function availableButUnchecked(rows) {
    return rows.filter((row) => row.available && row.checked === 0).map((row) => row.label);
}

test('the per-transform coverage floor is per volume, so a hole on one volume is not absorbed by the other', () => {
    const holed = [
        { name: 'a transform', base: 'volume one', label: 'a transform on volume one', available: true, checked: 4 },
        { name: 'a transform', base: 'volume two', label: 'a transform on volume two', available: true, checked: 0 }
    ];
    assert.deepStrictEqual(availableButUnchecked(holed), ['a transform on volume two'],
        'a transform available on a volume and checked on none of its cells there is a hole');

    // Unioned across volumes the same two rows collapse into one that reads
    // available and checked, which is the absorption this keying removes.
    const unioned = [{
        name: 'a transform',
        label: 'a transform',
        available: holed.some((r) => r.available),
        checked: holed.reduce((n, r) => n + r.checked, 0)
    }];
    assert.deepStrictEqual(availableButUnchecked(unioned), [],
        'the unioned form must be the one that misses it, or this case is not measuring the keying');

    // The real table's own rows go through this same function, in the invariance
    // case above, so the floor asserted here and the floor the table runs are
    // one predicate rather than two spellings of one. The table is not re-run
    // here: it builds directories on every volume and shells out to probe 8.3
    // aliases, and a third run of it buys nothing this case is about.
});

// MAJOR 2's control, and the sharpest shape the divergence takes: TWO READERS
// OF ONE RECORD. sidecar/battery.js prints a gap note in its report and
// sidecar/rollup.js prints the same gap note in its own, both cutting at
// sidecar/text.js's channel cap. A cut counts UTF-16 code units, so a note whose
// cut lands between the halves of a surrogate pair leaves an orphan half, and a
// trim carried by one reader and not the other means one report prints the
// orphan and the other does not, with no case inside either able to see it.
//
// The note is built from the rule rather than from a spelling: filler up to one
// character short of the cap, then an astral character whose two halves
// therefore straddle it. The pin is that the two readers agree, and the property
// each must have is that no rendered note ends in a lone high surrogate.
test('the battery report and the rollup render one gap note identically at the cap', (t) => {
    const stateDir = freshStateDir(t);
    const logsDir = path.join(stateDir, 'logs');
    fs.mkdirSync(logsDir, { recursive: true });

    const astral = String.fromCharCode(0xd83d, 0xde00);
    const note = 'x'.repeat(text.TEXT_MAX_CHARS - 1) + astral + 'tail';
    assert.strictEqual(note.charCodeAt(text.TEXT_MAX_CHARS - 1), 0xd83d,
        'this control needs the cap to fall between the two halves of one character');

    const record = {
        v: logs.LOG_VERSION,
        type: 'gap',
        ts: new Date(0).toISOString(),
        sessionId: 'a-session',
        reason: 'the endpoint could not answer',
        count: 1,
        firstCallId: 'c1',
        lastCallId: 'c1',
        detail: '',
        note
    };
    fs.writeFileSync(path.join(logsDir, 'verdicts-a-session.jsonl'),
        JSON.stringify(record) + '\n', 'utf8');

    const rolled = rollup.computeRollup(stateDir);
    assert.strictEqual(rolled.ok, true, JSON.stringify(rolled));
    assert.strictEqual(rolled.gapRanges.length, 1, JSON.stringify(rolled.gapRanges));
    const fromRollup = rolled.gapRanges[0].note;

    // The battery report's own spelling of the same rendering, which is the
    // expression at its gap-note line.
    const fromBattery = text.trimLoneSurrogate(text.neutralize(note).slice(0, text.TEXT_MAX_CHARS));

    assert.strictEqual(fromRollup.length, text.TEXT_MAX_CHARS - 1,
        'the cut must drop the orphan half rather than keep it');
    const lastCode = fromRollup.charCodeAt(fromRollup.length - 1);
    assert.ok(!(lastCode >= 0xd800 && lastCode <= 0xdbff),
        'the rollup printed a lone high surrogate at the end of a gap note');
    assert.strictEqual(fromRollup, fromBattery,
        'the two readers of one gap record render it differently at the cap');
});

// ---------------------------- the suite's own no-live-home rule, part two ---

// THE RULE THE SCAN ABOVE CANNOT SEE, stated as the class rather than as the
// instance that produced it.
//
// That scan's subject is a call this file spells. The dangerous class is wider:
// ANY code path in this suite that reaches a one-argument screen call
// IN PROCESS, and that call site can sit in production code this file never
// spells. sidecar/battery.js's main screens its --state-dir and the OS temp
// directory, and sidecar/harvest.js's main screens --out twice, all of them with
// one operand, which is CORRECT for a shipped run: a shipped run should screen
// against the operator's real store, and sidecar/state-screen.js says so. What
// is not correct is a case driving those functions in process with no way to
// substitute a fixture home, because os.homedir() is read inside this process
// and no environment a case sets on a child reaches it.
//
// So the closing rule is: every invocation of a command main originating in
// this file passes a deps object whose homeDir names a fixture home.
//
// THREE THINGS THE FIRST VERSION OF THIS SCAN GOT WRONG, each of them a false
// pass on precisely the defect shape, and each fixed here by building the check
// from the condition rather than from what the last defect happened to look
// like.
//
//   THE CALL'S OWN END, not the next `});` in the file. Finding the deps region
//     by searching forward for a close-of-object-in-call runs straight past a
//     call written with NO deps object, which is exactly the defect shape, and
//     lands in the NEXT call's deps object: the homeless call then reports the
//     neighbour's key as its own. The region is the call's own argument list,
//     matched bracket by bracket, and a call carrying fewer than two arguments
//     is homeless by construction rather than by what its region happens to
//     hold.
//   THE VALUE, not the key. The seam on the far side (sidecar/battery.js and
//     sidecar/harvest.js both) takes homeDir only when it is a non-empty string
//     and coerces anything else to undefined, which the screen then resolves
//     with os.homedir(). So a present key carrying `undefined` passes a
//     presence test and reads the operator's store anyway, measured rather than
//     argued. What is checked here is the value's text.
//   THE BINDING, not two spellings. Keying the scan on the two module names
//     followed by a dot and the entry point answers about two spellings, and the
//     class is every call that arrives at those functions: a destructured
//     `const { main } = require(...)`
//     and a `const run = battery.main` are not those spellings and are not
//     matched at all, while the floor under the scan is satisfied by the real
//     calls regardless, so nothing speaks. The names are resolved from the
//     file's own requires of the three sidecar modules instead, destructured and
//     aliased forms included, so a call through a binding nobody listed is still
//     found.
//
// WHAT REMAINS UNPROVEN, stated rather than left to be assumed. A source
// predicate answers about text: a call through a computed property, a call
// through a reference passed to another function, and a homeDir whose value is
// an identifier that happens to hold undefined at run time are all outside what
// this can see, and so are call sites in any other file. The two cases below
// this one are what cover those, because they measure the effect rather than
// the spelling: one in this process and one across the process boundary.
//
// The scan reads the RAW file text, string literals included, deliberately. One
// of these invocations is written into a driver program this file generates for
// a child, and a scanner that skipped string literals would not see it at all
// while returning the same green. That is why the bracket match runs with quote
// tracking OFF here: inside a generated driver the brackets are balanced and the
// quote state is not. The stated cost of that setting is that a string literal
// holding an unbalanced bracket inside a main call's argument list would be
// misread; comments are skipped either way.

// The sidecar modules whose main this rule is about. Spelled as basenames
// because that is what a require's argument text and a path constant both carry.
const MAIN_MODULE_FILES = ['battery.js', 'harvest.js', 'state-screen.js'];

// Every local name in `source` through which one of those modules' `main` can
// be called. Resolved from the requires rather than assumed, in three forms:
// a whole-module binding (`x.main(`), a destructured one (`main(`, under
// whatever local name the destructuring gave it), and a reference bound out of
// a whole-module binding (`const run = x.main`).
function mainCallNames(source) {
    const pathConsts = [];
    for (const m of source.matchAll(/\bconst\s+([A-Za-z_$][\w$]*)\s*=\s*([^;\n]*)/g)) {
        if (MAIN_MODULE_FILES.some((f) => m[2].includes(f))) pathConsts.push(m[1]);
    }
    const names = [];
    const modules = [];
    for (const m of source.matchAll(/\bconst\s+(\{[^}]*\}|[A-Za-z_$][\w$]*)\s*=\s*require\(([^)]*)\)/g)) {
        const arg = m[2];
        const namesTheModule = MAIN_MODULE_FILES.some((f) => arg.includes(f))
            || pathConsts.some((c) => new RegExp(`\\b${c}\\b`).test(arg));
        if (!namesTheModule) continue;
        const binding = m[1];
        if (!binding.startsWith('{')) {
            modules.push(binding);
            names.push(`${binding}.main`);
            continue;
        }
        for (const part of binding.slice(1, -1).split(',')) {
            const [key, alias] = part.split(':').map((s) => s.trim());
            if (key === 'main') names.push(alias === undefined ? key : alias);
        }
    }
    for (const mod of modules) {
        const re = new RegExp(`\\bconst\\s+([A-Za-z_$][\\w$]*)\\s*=\\s*${mod}\\.main\\b`, 'g');
        for (const m of source.matchAll(re)) names.push(m[1]);
    }
    // One entry per name: the same module is bound under the same name twice
    // here (once in this file, once inside the generated driver it writes), and
    // scanning for it twice would report every call site twice.
    return [...new Set(names)];
}

// A homeDir value that cannot reach the screen as a fixture home. The seam
// takes only a non-empty string, so every one of these coerces back to
// undefined and the screen falls back to os.homedir().
const UNUSABLE_HOME_VALUES = ['undefined', 'null', 'false', '0', "''", '""', '``'];

function mainInvocations(source) {
    const found = [];
    for (const name of mainCallNames(source)) {
        const re = new RegExp(`(?:^|[^\\w$.])${name.replace('.', '\\.')}\\s*\\(`, 'g');
        for (const m of source.matchAll(re)) {
            const open = m.index + m[0].length - 1;
            const region = bracketRegion(source, open, false);
            let home = null;
            if (region.args >= 2) {
                const deps = source.slice(region.commas[0] + 1, region.end);
                const key = /\bhomeDir\s*:\s*([^,\n}]*)/.exec(deps);
                if (key !== null) home = key[1].trim();
            }
            found.push({
                line: source.slice(0, open).split('\n').length,
                call: name,
                args: region.args,
                home,
                // The value, not the key: present, non-empty, and not one of the
                // spellings the seam coerces away.
                hasHomeDir: home !== null && home !== '' && !UNUSABLE_HOME_VALUES.includes(home)
            });
        }
    }
    return found.sort((a, b) => a.line - b.line);
}

test('every in-process command main call in this suite hands the screen a fixture home', (t) => {
    const source = fs.readFileSync(__filename, 'utf8');
    const found = mainInvocations(source);
    t.diagnostic('main invocations in this file: ' + found.length + ', at lines '
        + found.map((c) => c.line).join(', '));

    // THE INSTRUMENT SPEAKS FIRST, on a source built from the rule's own
    // boundary cases rather than from anything this file spells. Six shapes, and
    // four of them are shapes the previous version of this scan passed or never
    // saw at all:
    //
    //   1 a compliant call, the only true in the expected list;
    //   2 a call with NO deps object, followed immediately by a compliant
    //     neighbour: the shape whose region used to run past its own end and
    //     borrow the neighbour's key;
    //   3 the compliant neighbour itself;
    //   4 a call whose homeDir key is PRESENT carrying a value the seam coerces
    //     away, which a presence test passes;
    //   5 a call through a destructured binding, which no spelling in the old
    //     pattern named;
    //   6 a call through a reference bound out of the module, likewise.
    //
    // Shapes 5 and 6 are the coverage evidence rather than instrument evidence:
    // the local names they use appear nowhere in this check, which resolves them
    // from the control's own requires, so the scan finds them by the shape of the
    // binding and not by a string it was handed.
    //
    // Every invocation in the control is ASSEMBLED from fragments rather than
    // spelled, for the reason SCREEN_NAME above is assembled: this scan reads its
    // own file, so a control written whole would be found by the file-wide scan as
    // a real homeless invocation and the case would fail against itself.
    const mainOf = (receiver) => receiver + '.' + 'main';
    const requireOf = (binding, file) => 'const ' + binding + ' = require(\'../sidecar/' + file + '\');';
    const control = [
        requireOf('bat', 'battery.js'),
        requireOf('{ main: driveHarvest }', 'harvest.js'),
        'const boundRun = ' + mainOf('bat') + ';',
        'await ' + mainOf('bat') + '([a], { warn: w, homeDir: aFixtureHome });',
        'await ' + mainOf('bat') + '([q, r, s]);',
        'await ' + mainOf('bat') + '([a], { warn: w, homeDir: anotherFixtureHome });',
        'await ' + mainOf('bat') + '([a], { warn: w, homeDir: undefined });',
        'await driveHarvest([a], { warn: w });',
        'await boundRun([a], { warn: w });'
    ].join('\n');
    const spoke = mainInvocations(control);
    assert.deepStrictEqual(spoke.map((c) => c.hasHomeDir), [true, false, true, false, false, false],
        'the scan cannot read the six shapes it was built to read, so its result over this file '
            + 'says nothing: ' + JSON.stringify(spoke));

    const homeless = found.filter((c) => !c.hasHomeDir);
    assert.deepStrictEqual(homeless.map((c) => c.line), [],
        'these lines drive a command main in process with no usable homeDir in its deps, so the '
            + 'live-tree screen inside it falls back to os.homedir() and reads the operator real '
            + '~/.claude (Standing Brief Amendment 5). Add a fixture homeDir to the deps object');

    assert.ok(found.length >= 4,
        'only ' + found.length + ' main invocations found, which is fewer than this file has: the '
            + 'scan is matching less than it should, so its empty result says nothing');
});

// THE CONSEQUENCE, measured rather than argued. The two scans above are about
// the SPELLING of a call; this case is about what the process actually does,
// and it is the one that would have caught the in-process path both scans were
// added after.
//
// WHAT IT WRAPS IS THE MODULE, not a list of entry points. The first version
// wrapped the three calls the screen itself makes (fs.realpathSync,
// fs.realpathSync.native and fs.statSync), which is complete for the screen and
// not for the sentence the case's own title makes: a run pointed at the real
// state root would read, write, create and DELETE under the operator's live
// tree through readFileSync, mkdirSync, unlinkSync and the rest, and a recorder
// that watches three names reports clean through all of it. So the wrap is
// derived from the module rather than enumerated: every function fs exports
// whose name does not begin with a capital (the classes and constructors, which
// are not called with a path) is wrapped, and any first argument that is a
// string is noted. A function that turns out to take something else in that
// position notes a value no watched tree can match, which is the harmless
// direction; a function nobody thought to list is the direction that is not,
// and this construction has none.
//
// WHAT IS STILL UNPROVEN, named rather than assumed. This recorder is bounded
// by its own process, so it is blind to anything a child does, which is why the
// case after it measures the same question across the process boundary. It is
// also blind to a path reached through a file descriptor opened before the wrap,
// through a native addon, or through an fs export this process cannot reassign.
//
// os.homedir() is read here for the STRING it returns and never as a path to
// open, the same standing the two uses this file's header accounts for have: it
// is what the recorder compares operands against.
//
// THE CONTROL IS A SIBLING SUBJECT, not this one put into the failing state.
// The honest control for an absence check is to watch the instrument speak, and
// making THIS subject speak would mean shipping a case that reads the
// operator's store, which Standing Brief Amendment 5 bars outright. So the
// recorder is asked the same question about the FIXTURE live tree over the same
// run. That tree is the one the screen was pointed at, so a sound recorder must
// record hits on it; an empty answer there would mean the recorder sees nothing
// at all and the zero on the real tree would prove nothing.
function recordFsPaths() {
    const seen = [];
    const note = (p) => { if (typeof p === 'string' && p !== '') seen.push(p); };
    const originals = [];
    const wrappedNames = [];

    for (const name of Object.keys(fs)) {
        if (/^[A-Z]/.test(name)) continue;
        const original = fs[name];
        if (typeof original !== 'function') continue;
        const wrapper = function (first, ...rest) { note(first); return original.call(fs, first, ...rest); };
        // A function hung off a function (fs.realpathSync.native is the one
        // that matters here) is a call site of its own, so it is wrapped in
        // place rather than copied across unwrapped.
        for (const key of Object.getOwnPropertyNames(original)) {
            if (key === 'length' || key === 'name' || key === 'prototype') continue;
            const sub = original[key];
            try {
                wrapper[key] = typeof sub === 'function'
                    ? function (first, ...rest) { note(first); return sub.call(original, first, ...rest); }
                    : sub;
            } catch { /* a non-writable property stays as the wrapper found it */ }
        }
        try {
            fs[name] = wrapper;
            originals.push([name, original]);
            wrappedNames.push(name);
        } catch { /* an export this process cannot reassign stays unwrapped */ }
    }

    return {
        seen,
        wrappedNames,
        restore() {
            for (const [name, original] of originals) {
                try { fs[name] = original; } catch { /* best effort */ }
            }
        }
    };
}

function atOrUnder(operand, tree) {
    const a = path.resolve(operand).toLowerCase();
    const b = path.resolve(tree).toLowerCase();
    return a === b || a.startsWith(b.endsWith(path.sep) ? b : b + path.sep);
}

test('a battery run driven in process with a fixture home makes no fs call against the operator live tree', async (t) => {
    const cases = battery.loadJudgmentCases();
    const server = await startServer(t, (body) => {
        const c = cases.find((cc) => body.prompt.includes(cc.intent.slice(0, 40)));
        return JSON.stringify({ verdict: c ? c.acceptableVerdicts[0] : 'achieved', reason: 'r' });
    });
    const configPath = writeConfig(t, server.url);
    const { home, stateDir } = inProcessRoots(t);

    const recorder = recordFsPaths();
    t.after(() => recorder.restore());
    let code = null;
    try {
        code = await battery.main(['judgment', '--config', configPath, '--state-dir', stateDir], {
            newRunToken: () => 'aabbccdd',
            write: () => {},
            warn: () => {},
            homeDir: home
        });
    } finally {
        recorder.restore();
    }
    assert.strictEqual(code, 0, 'the run must have completed, or it never reached the screen at all');

    const liveTree = path.join(os.homedir(), '.claude');
    const fixtureTree = path.join(home, '.claude');
    const onLive = recorder.seen.filter((p) => atOrUnder(p, liveTree));
    const onFixture = recorder.seen.filter((p) => atOrUnder(p, fixtureTree));
    t.diagnostic('fs entry points wrapped: ' + recorder.wrappedNames.length
        + '; paths inspected during the run: ' + recorder.seen.length
        + '; at or under the fixture live tree: ' + onFixture.length
        + '; at or under the operator live tree: ' + onLive.length);

    // The wrap is the module, so a run that reached the live tree through any
    // of its path-taking calls is seen and not only through the three the
    // screen itself makes. The floor is here because a wrap that silently
    // failed to install would leave the same empty match list a clean run does.
    assert.ok(recorder.wrappedNames.length > 50,
        'only ' + recorder.wrappedNames.length + ' fs entry points were wrapped, which is fewer than '
            + 'the module exports: the recorder did not install, so its empty result says nothing');

    // The instrument control, on the sibling tree the screen WAS pointed at.
    assert.ok(onFixture.length > 0,
        'the recorder saw nothing at all under the fixture live tree, so its zero on the operator '
            + 'tree is the instrument being deaf rather than the run being clean');

    // The subject, reported as a predicate over a scope with its matches: the
    // predicate is an operand at or under os.homedir() joined with .claude, the
    // scope is every realpath and stat this run made, and the match list must be
    // empty. The paths themselves ride in the failure message rather than in a
    // diagnostic, so a green prints none of them.
    assert.deepStrictEqual(onLive, [],
        'this run inspected paths inside the operator real ~/.claude, which Standing Brief '
            + 'Amendment 5 bars, so a home operand is not reaching one of the screen calls inside '
            + 'the battery command');
});

// -------------------------- the suite's own no-live-home rule, route two ---

// THE OTHER ROUTE INTO THE CONDITION, and the one twelve rounds of checks were
// silent about while reporting on the class.
//
// The condition is that the screen resolves the tree it screens against from
// ambient state. An absent home operand falls back to os.homedir(), and
// os.homedir() itself resolves from HOME and USERPROFILE. Everything above this
// line closes the first route, an unpinned ARGUMENT in this process. This is the
// second: an unpinned ENVIRONMENT, out of process. A child is given
// process.env unless its launcher hands it one, this process's environment is
// the operator's, and the shipped screen inside that child then reads the
// operator's real store while every source predicate above returns the same
// green, because there is no argument anywhere for them to look at.
//
// THE PREDICATE IS OVER THE INTERPRETER, not over the launch function. A child
// reaches this repository's code only by running a Node interpreter over a file
// in it, and every launch in this file names that interpreter the same way. So
// the rule is: the token naming the interpreter appears only inside the one
// launcher that pins HOME and USERPROFILE to a fixture home. That is decided
// without knowing which of child_process's seven launch functions was used, or
// whether the launch is synchronous, or what the case is about, which is what
// makes it a rule about the class rather than a list of the sites somebody
// walked.
//
// The name is assembled from fragments for the reason SCREEN_NAME above is:
// this check reads its own file, so a control spelling the token whole would be
// found by the file-wide scan as a real unpinned launch.
const INTERPRETER_TOKEN = 'process.' + 'execPath';
const LAUNCHER_NAME = 'spawn' + 'Pinned';

// The source range of one function declaration, header to matching close brace.
function functionRange(source, name) {
    const at = source.indexOf('function ' + name + '(');
    if (at === -1) return null;
    const params = bracketRegion(source, source.indexOf('(', at), true);
    const open = source.indexOf('{', params.end);
    if (open === -1) return null;
    return { start: at, end: bracketRegion(source, open, true).end };
}

function unpinnedLaunches(source) {
    const range = functionRange(source, LAUNCHER_NAME);
    const found = [];
    for (let i = source.indexOf(INTERPRETER_TOKEN); i !== -1; i = source.indexOf(INTERPRETER_TOKEN, i + 1)) {
        const inside = range !== null && i > range.start && i < range.end;
        found.push({ line: source.slice(0, i).split('\n').length, inside });
    }
    return { range, found };
}

test('every child this suite launches is given a fixture home by the one launcher that starts it', (t) => {
    const source = fs.readFileSync(__filename, 'utf8');

    // THE INSTRUMENT SPEAKS FIRST, on sources built from the rule. The second
    // control instance is the coverage evidence rather than instrument
    // evidence: it launches through a function whose name appears nowhere in
    // this check, synchronously, and it is caught anyway, because what the check
    // matches is the interpreter and not the caller. A predicate built from a
    // list of launch functions would return the same green on it.
    const launcher = [
        'function ' + LAUNCHER_NAME + '(bin, args, env, options) {',
        '    const home = suiteHome();',
        '    return spawn(' + INTERPRETER_TOKEN + ', [bin, ...args], {',
        '        env: { ...process.env, HOME: home, USERPROFILE: home, ...env }',
        '    });',
        '}'
    ];
    const clean = unpinnedLaunches(launcher.join('\n'));
    assert.deepStrictEqual(clean.found.map((c) => c.inside), [true],
        'the check cannot see a launch inside the launcher, so its result over this file says nothing');
    const dirty = unpinnedLaunches(launcher.concat([
        'const out = execFileSync(' + INTERPRETER_TOKEN + ', [bin], { encoding: aString });'
    ]).join('\n'));
    assert.deepStrictEqual(dirty.found.map((c) => c.inside), [true, false],
        'the check cannot see a launch made through a function it does not name, which is the only '
            + 'kind of launch it exists to catch');

    const { range, found } = unpinnedLaunches(source);
    assert.ok(range !== null, 'this file no longer declares the launcher the whole rule rests on');
    t.diagnostic('interpreter launches in this file: ' + found.length
        + ', at lines ' + found.map((c) => c.line).join(', '));

    const outside = found.filter((c) => !c.inside);
    assert.deepStrictEqual(outside.map((c) => c.line), [],
        'these lines start a child outside the shared launcher, so the child inherits this process '
            + 'environment, os.homedir() inside it resolves the operator real home, and the shipped '
            + 'screen there reads the operator real ~/.claude (Standing Brief Amendment 5). Start it '
            + 'through the launcher instead');

    assert.ok(found.length >= 1,
        'no interpreter launch found at all, so this check is pointed at the wrong bytes and its '
            + 'empty result says nothing');

    // The launcher earns the exemption by pinning both names, from the suite's
    // own fixture home rather than from anything a caller supplies: an `env`
    // override composed AFTER these would let a caller drop them.
    const body = source.slice(range.start, range.end);
    assert.ok(/const home = suiteHome\(\);/.test(body), body);
    assert.ok(/HOME: home/.test(body) && /USERPROFILE: home/.test(body), body);
    assert.ok(body.indexOf('HOME: home') < body.indexOf('...env'),
        'the caller override is composed before the fixture home, so a caller can drop it');
});

// THE CONSEQUENCE ON ROUTE TWO, measured across the process boundary because
// that is the only place it can be measured. The in-process recorder above is
// bounded by its own process and cannot see a single call a child makes, which
// is exactly how the ninth instance of this class survived a round that built
// its checks correctly under every earlier amendment.
//
// THE WATCHED TREES ARE FIXED BY THIS PROCESS and handed to the child in the
// environment. That ordering is the whole point: the child's own home is
// redirected, so a child that decided for itself what to watch would move the
// target along with it and report clean by construction.
//
// THE CONTROL IS A SIBLING SUBJECT, for the reason the in-process case's is:
// making this subject speak would mean shipping a case that reads the
// operator's store, which Standing Brief Amendment 5 bars. So the same child,
// on the same run, is asked about the FIXTURE live tree it WAS pointed at,
// which a sound recorder must record hits on.
//
// The recorder wraps the fs module the same way the in-process one does, and
// carries the same unproven edge: a path reached through a native addon or an
// export the child cannot reassign is outside it.
const CHILD_RECORDER_SOURCE = [
    "'use strict';",
    "const fs = require('fs');",
    "const path = require('path');",
    'const trees = JSON.parse(process.env.KIT_WATCHED_TREES);',
    'const hits = trees.map(() => []);',
    'const note = (p) => {',
    "    if (typeof p !== 'string' || p === '') return;",
    '    let resolved;',
    '    try { resolved = path.resolve(p).toLowerCase(); } catch { return; }',
    '    trees.forEach((tree, i) => {',
    '        const t = path.resolve(tree).toLowerCase();',
    '        if (resolved === t || resolved.startsWith(t.endsWith(path.sep) ? t : t + path.sep)) hits[i].push(p);',
    '    });',
    '};',
    'let wrapped = 0;',
    'for (const name of Object.keys(fs)) {',
    '    if (/^[A-Z]/.test(name)) continue;',
    '    const original = fs[name];',
    "    if (typeof original !== 'function') continue;",
    '    const wrapper = function (first, ...rest) { note(first); return original.call(fs, first, ...rest); };',
    '    for (const key of Object.getOwnPropertyNames(original)) {',
    "        if (key === 'length' || key === 'name' || key === 'prototype') continue;",
    '        const sub = original[key];',
    "        try { wrapper[key] = typeof sub === 'function'",
    '            ? function (first, ...rest) { note(first); return sub.call(original, first, ...rest); }',
    '            : sub; } catch { /* non-writable */ }',
    '    }',
    '    try { fs[name] = wrapper; wrapped += 1; } catch { /* not reassignable */ }',
    '}',
    "process.on('exit', () => {",
    '    try {',
    '        fs.writeFileSync(process.env.KIT_WATCHED_OUT, JSON.stringify({ wrapped, hits }), "utf8");',
    '    } catch { /* best effort: an unwritten report reads as a deaf instrument below */ }',
    '});'
].join('\n');

test('a child this suite launches makes no fs call against the operator live tree', async (t) => {
    const dir = makeDir('kit-sidecar-battery-childwatch-');
    t.after(() => rmDir(dir));
    const preload = path.join(dir, 'recorder.js');
    fs.writeFileSync(preload, CHILD_RECORDER_SOURCE, 'utf8');
    const report = path.join(dir, 'report.json');

    // The trees, both named HERE. The first is the operator's real one, read
    // for the string os.homedir() returns and never opened by this process; the
    // second is the fixture home the launcher gives every child, which is the
    // sibling subject the control rests on.
    const operatorTree = path.join(os.homedir(), '.claude');
    const fixtureTree = path.join(suiteHome(), '.claude');

    const { file } = writeTranscript(t, [bashLine('t1', 'x', 'ls'), resultLine('t1', 'ok', false)]);
    const out = path.join(dir, 'harvested.json');
    const result = await runBin(HARVEST_BIN, [file, '--out', out], {
        NODE_OPTIONS: '--require ' + JSON.stringify(preload),
        KIT_WATCHED_TREES: JSON.stringify([operatorTree, fixtureTree]),
        KIT_WATCHED_OUT: report
    });
    assert.strictEqual(result.code, 0, result.stdout + result.stderr);

    assert.ok(fs.existsSync(report),
        'the child wrote no recorder report, so nothing here is a measurement:\n'
            + result.stdout + result.stderr);
    const { wrapped, hits } = JSON.parse(fs.readFileSync(report, 'utf8'));
    const [onOperator, onFixture] = hits;
    t.diagnostic('fs entry points wrapped in the child: ' + wrapped
        + '; at or under the fixture live tree: ' + onFixture.length
        + '; at or under the operator live tree: ' + onOperator.length);

    assert.ok(wrapped > 50,
        'only ' + wrapped + ' fs entry points were wrapped in the child, so the recorder did not '
            + 'install and its empty result says nothing');

    // The instrument control, on the sibling tree the child WAS pointed at.
    assert.ok(onFixture.length > 0,
        'the child recorder saw nothing at all under the fixture live tree, so its zero on the '
            + 'operator tree is the instrument being deaf rather than the child being clean');

    // The subject: the predicate is an operand at or under os.homedir() joined
    // with .claude, the scope is every fs call the child made through a wrapped
    // entry point, and the match list must be empty. The paths ride in the
    // failure message rather than in a diagnostic, so a green prints none.
    assert.deepStrictEqual(onOperator, [],
        'a child of this suite touched paths inside the operator real ~/.claude, which Standing '
            + 'Brief Amendment 5 bars: the launcher is not reaching this child with a fixture HOME '
            + 'and USERPROFILE');
});

// ------------------- the operands route one threads, each with its own pin --

// Three of the four home operands the commands thread through to the screen had
// no case that could only pass if the threading worked, which is Standing Brief
// Amendment 2's whole subject. The battery run above exercises exactly one of
// them, the --state-dir screen, because every in-process call it makes passes a
// --state-dir. These three cover the rest.

// The OS temp directory screen on the --state-dir-absent branch. It runs before
// mkdtemp, so it is the first thing a default-rooted run screens, and no case
// above reaches it.
test('a battery run with no --state-dir screens the temp root against the fixture home, not the operator one', async (t) => {
    const server = await startServer(t, () => JSON.stringify({ verdict: 'achieved', reason: 'r' }));
    const configPath = writeConfig(t, server.url);
    const home = fixtureHomeDir(t);

    const printed = [];
    const recorder = recordFsPaths();
    t.after(() => recorder.restore());
    let code = null;
    try {
        code = await battery.main(['judgment', '--config', configPath], {
            newRunToken: () => 'aabbccdd',
            write: (line) => printed.push(line),
            warn: () => {},
            homeDir: home
        });
    } finally {
        recorder.restore();
    }
    const hint = printed.join('').split('\n').find((l) => l.includes('remove it when done: '));
    assert.ok(hint, 'this run never chose a temp state root, so it never reached the screen on one');
    const created = hint.slice(hint.indexOf('remove it when done: ') + 'remove it when done: '.length);
    t.after(() => rmDir(created));
    assert.notStrictEqual(code, 1, 'the run refused its own temp root:\n' + printed.join(''));

    const onLive = recorder.seen.filter((p) => atOrUnder(p, path.join(os.homedir(), '.claude')));
    const onFixture = recorder.seen.filter((p) => atOrUnder(p, path.join(home, '.claude')));
    t.diagnostic('paths inspected: ' + recorder.seen.length + '; fixture tree: ' + onFixture.length
        + '; operator tree: ' + onLive.length);
    assert.ok(onFixture.length > 0,
        'the recorder saw nothing under the fixture live tree, so its zero on the operator tree is '
            + 'the instrument being deaf');
    assert.deepStrictEqual(onLive, [],
        'the temp-root screen on the no-state-dir branch is not getting the home operand, so it '
            + 'resolved the operator real ~/.claude (Standing Brief Amendment 5)');
});

// The harvest --out screen, before the transcript is opened. The pin is a
// refusal that can only happen if the operand carries: --out inside the FIXTURE
// home's .claude is an ordinary temp path to a screen resolving the operator's
// home, and the live store to a screen resolving this one.
test('the harvest --out screen refuses a path inside the fixture live tree, so its home operand carries', async (t) => {
    const home = fixtureHomeDir(t);
    const { file } = writeTranscript(t, [bashLine('t1', 'x', 'ls'), resultLine('t1', 'ok', false)]);
    const inside = path.join(home, '.claude', 'harvested.json');

    const code = await harvest.main([file, '--out', inside], { homeDir: home });
    assert.strictEqual(code, 1, 'the screen accepted a path inside the home it was handed');
    assert.strictEqual(fs.existsSync(inside), false, 'the refused write happened anyway');

    // The control, on the other side of the same screen: a sibling path outside
    // that .claude is still written, so the refusal above is containment and
    // not a broken --out.
    const outside = path.join(home, 'harvested.json');
    const ok = await harvest.main([file, '--out', outside], { homeDir: home });
    assert.strictEqual(ok, 0, 'the control path was refused too, so the refusal proves nothing');
    assert.strictEqual(JSON.parse(fs.readFileSync(outside, 'utf8')).length, 1);
});

// The harvest re-screen, run on the directory --out lands in immediately before
// the write. The child-driven case above proves the re-screen refuses; this one
// proves the re-screen is looking at the home the caller named, since a
// re-screen resolving the operator's home would find a link into a fixture
// .claude perfectly acceptable and write through it.
test('the harvest re-screen resolves the home operand, not the operator home', async (t) => {
    const home = fixtureHomeDir(t);
    const { dir, file } = writeTranscript(t, [bashLine('t1', 'x', 'ls'), resultLine('t1', 'ok', false)]);
    const outDir = path.join(dir, 'out-dir');
    fs.mkdirSync(outDir);
    const target = path.join(home, '.claude', 'planted');
    fs.mkdirSync(target, { recursive: true });

    let planted = true;
    const plant = () => {
        try {
            fs.rmSync(outDir, { recursive: true, force: true });
            fs.symlinkSync(target, outDir, process.platform === 'win32' ? 'junction' : 'dir');
        } catch (err) {
            planted = false;
            t.diagnostic('SKIP: this account cannot create a directory link: ' + err.code);
        }
    };

    const code = await harvest.main([file, '--out', path.join(outDir, 'harvested.json')], {
        homeDir: home,
        readPairs: async (f) => { plant(); return harvest.extractPairs(f); }
    });
    if (!planted) return;
    assert.strictEqual(code, 1, 'the re-screen followed a link into the home it was handed');
    assert.strictEqual(fs.existsSync(path.join(target, 'harvested.json')), false,
        'the write landed inside the fixture live tree through the link planted mid-read');
});
