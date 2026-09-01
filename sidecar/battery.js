#!/usr/bin/env node
// The regression battery runner: on-demand evaluation of the shipped judge and
// recognize prompts against frozen fixtures, over the live endpoint.
//
// NOT CI. Every case here needs a real model call, so this never runs in the
// test suite (test/kit-sidecar-battery.test.js pins this file's own harness,
// the scoring arithmetic and the substance-versus-enum rule against a mock,
// never a live call) and it is not part of the kit's build: sidecar/ sits
// outside plugins/claude-kit/, the only tree build.ps1 packages, so this
// command and its fixtures never ship.
//
// WHAT IT REPRODUCES. sidecar/batteries/README.md states the provenance of
// each fixture in full. Every expected verdict and every gold label began as a
// hand adjudication made before the daemon or the shipped prompt existed, per
// the plan's Chapter 2 account of why an expected set derived from a model run
// proves nothing about the pattern it would be scoring. Four of the thirteen
// judgment cases (1, 5, 8 and 12) carry a revision made after a live replay
// disagreed with that first adjudication, so four of thirteen expected values
// sit on the same derivation path as the pattern being scored, against a floor
// of twelve. What keeps those four sound is that the evidence is in the frozen
// case itself and needs no model to re-check: each was scored `achieved` on a
// result the 350-character harvest cap had cut before the adjudicator read it,
// and the cut is visible in the frozen result text, which ends mid-line. That
// is the whole bound: an expected value is revisable on evidence a reader can
// see in the fixture, never on a verdict's say-so. This command never
// regenerates one: a case whose expected value it cannot read is a reason to
// stop, never a reason to invent one. (The 350-character cap was the scratch
// harvester's, .kit/harvest-cases.mjs; sidecar/harvest.js cuts at 2000.)
//
// FIXTURE STATE ONLY. Every run uses a state root and a memory root this
// command creates under the OS temp directory; neither ever falls back to
// this daemon's own live defaults (~/.claude/kit-sidecar,
// ~/.claude/kit-endpoint.json's store side), because a throwaway battery run
// writing fake verdicts into a real capture log, or reading a real memory
// store's index, is exactly the live-store touch Standing Brief Amendment 5
// forbids. Every state root this run will use, the caller's and this command's
// own temp default alike, goes through screenStateDir before anything is
// created under it, and the screen is against the whole of ~/.claude rather
// than the sidecar subtree inside it: the daemon derives spool/, inbox/ and
// logs/ from whatever root it is handed, so --state-dir ~/.claude puts
// fabricated verdict records and inbox items straight into the operator's live
// home without ever naming the sidecar directory. The screen decides
// containment on FILESYSTEM IDENTITY rather than on spellings: it resolves the
// candidate to the deepest directory that exists and walks upward comparing
// (dev, ino) against the live tree's own, which is one test that covers every
// spelling of one directory and a link on either side at once, on the candidate
// (a --state-dir aimed into the live tree through a junction) or on the live
// tree itself (a redirected profile, a ~/.claude linked into a synced folder).
// The four spelling-and-realpath string comparisons it used to decide on are
// still made, as a refusal-only second opinion: their `refused` is kept and
// their `ok` discarded, so a defect in them cannot accept anything. Where the
// candidate or the live tree cannot be resolved to a readable identity the
// answer is `unscreened` rather than `ok`.
//
// A SCREEN ANSWERS ABOUT THE PATH IT WAS HANDED. Nothing created beneath a
// screened root is covered by it, and `mkdir -p` follows a reparse point on
// any intermediate component, so every directory this command creates under
// the state root goes through logs.ensureDir WITH that root, which checks
// each component below it in turn rather than walking through them; each file
// it opens takes the shared write-target guard as well. The reassurance line
// the run prints is composed from the screen's own answer, naming the
// comparisons the screen actually made, rather than printed unconditionally,
// because a sentence asserting a check that never ran is the failure this
// whole instrument exists to refuse. What DOES reach the live world by design
// is the endpoint:
// this command needs a real judge and a real recognizer, so --config defaults
// to the daemon's own default config path and an absent or invalid one is
// reported and refused rather than answered with a column of zeros, per the
// section-5 rollup's own precedent for a missing prerequisite.
//
// SCORING IS SUBSTANCE, NOT EXACT-ENUM. Each judgment case carries a list of
// acceptable verdicts (one or two of achieved/failed/diverged); a verdict in
// that list scores correct. Each recognition situation carries a gold set;
// recall is a miss for every gold name absent from the model's raw answer.
// Extras count every non-gold name in that same raw answer AND every name the
// daemon's own parse marked invented (absent from the index it was shown),
// because the audition's own recall and false-positive numbers were measured
// against everything the model actually said, hallucinated names included, not
// the narrower quantity left after a known-record filter. A single answer can
// name at most sidecar/prompts/recognition-v1.js's MAX_RECORDS names, so a
// model that hallucinates more than that fills the answer and its true rate of
// invention is undercounted here exactly as it would be by the shipped prompt
// itself; the summary line says so.
//
// A GAP NEVER SCORES AS A PASS, AND A RUN SCORES ONLY WHAT IT PRODUCED. Both
// scorers below track how many cases and situations actually got a record,
// separately from how many scored correct, and the printed pass/fail line
// reflects an unmeasured case exactly like a wrong one: a battery that ran
// short of every one of its own fixtures is not the same claim as a battery
// that ran all of them and scored well on fewer than the floor, and this
// instrument does not let the first read as the second. That arithmetic is
// only worth anything if the records it reads are this run's, so two things
// hold it. Each run mints a token and stamps it into both session ids, which
// closes sequential re-use: under fixed session ids the logs accumulate, and a
// second run against the same --state-dir whose endpoint answered nothing would
// score the FIRST run's verdicts and print PASS. And the run reconciles the
// lines it wrote against the lines its own daemon pass consumed, because the
// token closes nothing against a CONCURRENT writer: the daemon files each
// verdict under the session id it reads off the spool entry, so another run
// draining this run's spool lines files those verdicts under this run's own
// token-stamped log and leaves this pass with nothing to consume. One line
// written per case and per situation, one parse counted per line, and a run
// whose pass consumed a different number than it wrote is a cannot-measure
// that prints both numbers. What that equality does NOT close is an interleave
// where the counts happen to match while some of this run's cases were judged
// by another run's process, and a concurrent run can carry a different
// --config, so the scorers close the cross-config half of it: every record
// carries the promptId, model and endpoint fingerprint that produced it, and
// a scored record whose provenance is not this run's own is a cannot-measure
// rather than a scored case. What remains is an interleave under the
// IDENTICAL config, whose records are real measurements of the same frozen
// content by the same prompt, model and endpoint, so nothing the report
// claims about them is false. Two further readings feed the same rule: the
// daemon's own skip counters are printed and fail the run, because a spool
// line it rejected as malformed leaves a case with no verdict AND no gap
// record, and an unreadable log is reported as unreadable rather than read as
// an empty one.
//
// EVERY DISAGREEMENT IS NAMED, per case, with the expected value, the
// received value and the model's own reason: a bare aggregate cannot tell a
// later prompt change which case moved.
//
// SYNTHETIC SPOOL LINES. The lines this command writes into its own fixture
// spool are not the capture hook's output, but they carry the same per-field
// 2000-character cap and the same lone-surrogate trim as a real capture would
// (mirrored here rather than required from plugins/claude-kit/hooks/
// kit-sidecar-capture.js, since this tree does not depend on hooks/ as a
// library), and `truncated` is set from whether that cut actually fired rather
// than hardcoded, so a fixture line never claims a shape the daemon could not
// have captured for real. A frozen field longer than the field cap is
// therefore CUT at replay rather than refused: the cut reproduces exactly what
// a real capture of that call would have written, and refusing would refuse
// correct behaviour. It is named per case in the run report, with the length
// before and after, because this instrument's own corrected cases exist
// precisely because a cut removed the evidence a verdict turned on, and a cut
// nobody is told about is the same defect one layer down. What is NOT
// reproduced is the capture hook's
// whole-line 8192-byte scaled cut: none of this battery's frozen cases needs
// it, and a fixture line that would need it is refused outright (loud) rather
// than silently shortened by an algorithm this file does not carry a copy of.
//
// WHERE THE DATA GOES, SAID BEFORE IT GOES. A run POSTs every fixture command
// and its output, and the whole frozen memory index, over the network to the
// configured endpoint, which is another machine, in cleartext HTTP. That
// sentence is printed unconditionally and before the first call, never from
// the daemon's remote-host warning alone: that warning is silent for a
// loopback or private-network endpoint (plugins/claude-kit/scripts/
// kit-endpoint-lib.js), which is the ordinary configuration on this fleet, so
// a run leaning on it discloses nothing on exactly the machines it runs on.
// The address is never printed on any surface; the fingerprint identifies it.
//
// Usage:
//   node sidecar/battery.js [judgment|recognition|all] [--config <path>]
//                           [--state-dir <path>] [--help]
//
//   judgment|recognition|all  which battery to run (default: all)
//   --config                  endpoint config (default: ~/.claude/kit-endpoint.json)
//   --state-dir               fixture state root for this run (default: a
//                              fresh directory under the OS temp dir, printed
//                              and left in place so its logs can be read;
//                              refused if it is ~/.claude or anything under it)
//   --help                    print this usage and exit
//
// Exit codes, and the split between 1 and 3 is the distinction this instrument
// exists to hold, put on the signal a wrapper reads: 0 the battery ran, every
// applicable case was measured and met its threshold; 1 CANNOT MEASURE, which
// is the battery failing to run (no endpoint, a refused --state-dir, an
// unloadable fixture, an unreadable log) or running with any case left
// unmeasured by a gap or dropped by the daemon's own skip counters; 3 MEASURED
// AND SHORT, every applicable case measured and the score below the frozen
// threshold; 2 a bad command line. A wrapper that cannot tell 1 from 3 cannot
// tell an outage from a regression, which is the same conflation a gap scored
// as a pass makes one level down.

'use strict';

const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');

const daemon = require('./daemon.js');
const config = require('./config.js');
const logs = require('./logs.js');
const memoryIndex = require('./memory-index.js');
const judgmentPrompt = require('./prompts/judgment-v2.js');
const recognitionPrompt = require('./prompts/recognition-v1.js');
const recordName = require('./record-name.js');
const { screenStateDir } = require('./state-screen.js');
const { neutralize, TEXT_MAX_CHARS, trimLoneSurrogate } = require('./text.js');

const BATTERIES_DIR = path.join(__dirname, 'batteries');

// The audition's own recorded floor for the judgment battery: 12 to 13 of 13
// on substance. Reproducing "at least the audition scores" means meeting the
// low end of that range, which is a RATE rather than a count: an absolute 12
// printed as "12/N" would let a fixture grown to 14 cases pass at 12/14, below
// the score the constant claims to reproduce.
const JUDGMENT_MIN_CORRECT = 12;
const JUDGMENT_MIN_OF = 13;

// The floor for a fixture of `count` cases, at the audition's own rate. Equal
// to JUDGMENT_MIN_CORRECT exactly at the frozen thirteen.
function judgmentFloor(count) {
    const n = Number.isInteger(count) && count > 0 ? count : 1;
    return Math.min(n, Math.ceil((n * JUDGMENT_MIN_CORRECT) / JUDGMENT_MIN_OF));
}

// The amended section-4 acceptance: zero gold misses, and at most 2 non-gold
// pointers across the 15 situations (the shipped prompt measures 1, case
// 11's own affirmed false positive).
const RECOGNITION_MAX_EXTRAS = 2;

// The UTC day the fixture spool is filed under, read at the moment the fixture
// is built rather than once at module load. A day file's name and the `ts` a
// spool line carries have to name the same day, and a spool line is stamped
// when it is written: a process loaded before UTC midnight and building its
// fixture after it would file records timestamped for the new day into a file
// named for the old one, and every reader that derives the day from the current
// clock would then look in the wrong file. buildFixture hands the value it used
// back to its caller, so a reader takes the writer's own day rather than
// recomputing one that can differ.
function fixtureDay() {
    return new Date().toISOString().slice(0, 10);
}

// The same field cap and whole-line cap sidecar/CONTRACT.md states for a real
// captured spool line, mirrored (not imported) into this fixture writer.
const FIELD_CAP = 2000;
const LINE_CAP_BYTES = 8192;

// The freshness horizon this command hands the daemon for a replay: a hundred
// days, which is far past the fourteen-day retention window that deletes a
// spool file anyway, so no fixture line this command writes can ever fall
// outside it. Spelled as a wide window rather than as a switch because the
// daemon takes a window and a magic "off" value would be a second meaning for
// one number. See the call site for why a replay has no freshness to lose.
const REPLAY_STALE_HORIZON_MS = 100 * 24 * 60 * 60 * 1000;

function parseArgs(argv) {
    const options = { target: 'all', configPath: null, stateDir: null, help: false };
    const rest = [];
    for (let i = 0; i < argv.length; i += 1) {
        const arg = argv[i];
        const value = argv[i + 1];
        if (arg === '--help' || arg === '-h') { options.help = true; continue; }
        if (arg === '--config') {
            if (typeof value !== 'string' || value === '' || value.startsWith('-')) {
                return { ok: false, error: '--config needs a path' };
            }
            options.configPath = value; i += 1; continue;
        }
        if (arg === '--state-dir') {
            if (typeof value !== 'string' || value === '' || value.startsWith('-')) {
                return { ok: false, error: '--state-dir needs a path' };
            }
            options.stateDir = value; i += 1; continue;
        }
        if (arg.startsWith('-')) return { ok: false, error: `unknown argument: ${arg}` };
        rest.push(arg);
    }
    if (rest.length > 1) return { ok: false, error: `unexpected argument: ${rest[1]}` };
    if (rest.length === 1) {
        if (!['judgment', 'recognition', 'all'].includes(rest[0])) {
            return { ok: false, error: `unknown battery: ${rest[0]} (want judgment, recognition or all)` };
        }
        options.target = rest[0];
    }
    return { ok: true, options };
}

const USAGE = [
    'kit judgment sidecar: regression battery runner',
    '',
    'usage: node sidecar/battery.js [judgment|recognition|all] [--config <path>]',
    '                               [--state-dir <path>] [--help]',
    '',
    '  judgment|recognition|all  which battery to run (default: all)',
    '  --config                  endpoint config (default: ~/.claude/kit-endpoint.json)',
    '  --state-dir               fixture state root (default: a fresh temp dir;',
    '                            refused if it is ~/.claude or under it, by',
    '                            spelling or through a link)',
    '  --help                    print this usage and exit'
].join('\n');

// One field, capped and surrogate-safe, the same shape a real capture would
// have produced. The trim itself is sidecar/text.js's, shared with
// sidecar/harvest.js rather than copied, and pinned equal to the capture
// hook's own copy across the process boundary by a test.
function textField(value, cap) {
    if (typeof value !== 'string' || value === '') return '';
    return trimLoneSurrogate(value.slice(0, cap));
}

// Which frozen fields this run cuts, and by how much. A cut here is CORRECT
// behaviour, since the capture hook cuts at the same cap and a fixture holding
// a longer field is replayed exactly as a real capture of that call would have
// been written; what would not be correct is making it silently. The caller
// names every entry of this in the run report.
//
// EITHER CAP COUNTS, which is why this needs the battery name. A field is cut
// twice on its way to the model: once by the spool writer at FIELD_CAP, and
// again by the prompt at its own per-field cap, which is BELOW the field cap
// for every field the prompts cut. A field between the two caps (the judgment
// battery's 1,555-character command, against the judgment prompt's own 1,500)
// is therefore cut with nothing over 2,000 characters anywhere in sight, and a
// cut list keyed on the field cap alone emits no entry for it at all, while
// sidecar/batteries/README.md states that every such cut is named per case.
// `to` is what the replayed spool line holds and `seen` is what the model is
// actually given; the report says which cap produced which.
function fieldCuts(batteryName, fields) {
    const cuts = [];
    for (const field of ['intent', 'command', 'result']) {
        const value = fields[field];
        if (typeof value !== 'string') continue;
        const to = textField(value, FIELD_CAP).length;
        const promptCap = promptEvidenceCap(batteryName, field);
        const seen = Math.min(to, promptCap);
        // WHETHER THE FIELD CAP FIRED IS A QUESTION ABOUT THE CAP, NOT ABOUT
        // THE RESULTING LENGTH. textField also drops a lone surrogate half left
        // at the cut, so a 1,999-character field ending in an unpaired high
        // half comes back at 1,998 with the cap never reached; reading the
        // shortening as a cut would print "cut to 1998 at the 2000-character
        // field cap, which is the cut the capture hook itself would have made",
        // a false cause in the one line whose job is saying how much evidence
        // the judge saw. spoolLine computes its own `truncated` flag from the
        // raw length for this reason, and these two lines of one run must not
        // contradict each other.
        const fieldCapFired = value.length > FIELD_CAP;
        if (fieldCapFired || to > seen) {
            cuts.push({ field, from: value.length, to, seen, promptCap, fieldCapFired });
        }
    }
    return cuts;
}

// One cut, said as the sentence the run report prints. A function of the cut
// record alone, so each of its three branches can be put in front of a case
// directly: the frozen fixture can only reach two of them, since
// promptEvidenceCap is Infinity for a judgment intent and result and no frozen
// field of those kinds comes near the field cap, and a branch with no case that
// can only pass if it works is not tested.
function cutSentence(cut) {
    const fieldCapFired = cut.fieldCapFired === true;
    const promptCapFired = cut.seen < cut.to;
    let sentence = `frozen field cut at replay: ${cut.battery} #${cut.n} ${cut.field}, `
        + `${cut.from} characters`;
    if (fieldCapFired) {
        sentence += ` cut to ${cut.to} at the ${FIELD_CAP}-character field cap, `
            + 'which is the cut the capture hook itself would have made on this call';
        if (promptCapFired) {
            sentence += `; the ${cut.battery} prompt cuts this field again at its own `
                + `${cut.promptCap}-character cap, so the model sees the first ${cut.seen} of them`;
        }
        return sentence;
    }
    // WHAT THE REPLAYED LINE HOLDS IS A QUESTION ABOUT ITS LENGTH, not about
    // which cap fired. The field cap not firing does not make the line whole:
    // textField also drops a lone surrogate half left at the cut, so a field of
    // exactly FIELD_CAP characters ending in an unpaired high half comes back
    // one character shorter with the cap never reached, and the clause is read
    // off the two lengths rather than off the cap's own flag.
    const heldWhole = cut.to === cut.from;
    return `${sentence} cut to ${cut.seen} at the ${cut.battery} prompt's own `
        + `${cut.promptCap}-character cap, so that is what the model sees; the `
        + `${FIELD_CAP}-character field cap did not fire on this field, and the replayed `
        + (heldWhole
            ? 'spool line holds it whole'
            : `spool line holds ${cut.to} of them, an unpaired surrogate half having been dropped at the cut`);
}

// The prompt's own per-field cut, on top of the spool's. The spool cap is not
// the last cut a frozen field takes: the judgment prompt cuts ACTION at its
// COMMAND_PROMPT_CAP and the recognition prompt cuts all three sides at its
// own caps, each BELOW the field cap, so a cut report that named only the
// field cap would state a number false by the difference, in the one line
// whose purpose is to say how much evidence the model actually saw. Read from
// the prompt modules rather than duplicated as literals, so this report cannot
// drift from the prompts it describes; Infinity where the prompt embeds the
// field whole.
function promptEvidenceCap(batteryName, field) {
    if (batteryName === 'judgment') {
        return field === 'command' ? judgmentPrompt.COMMAND_PROMPT_CAP : Infinity;
    }
    return {
        intent: recognitionPrompt.INTENT_PROMPT_CAP,
        command: recognitionPrompt.COMMAND_PROMPT_CAP,
        result: recognitionPrompt.RESULT_PROMPT_CAP
    }[field] || Infinity;
}

// The largest `n` a fixture may carry. The bound is on the hex width, not on
// the case count: judgmentCallId pads `n` into a 16-character id and needs
// room for its own leading marker, and six hex digits leave ten. Nothing this
// battery will ever hold comes near it.
const MAX_ITEM_N = 0xffffff;

// Loader validation shared by both fixtures: every `n` is a unique positive
// integer inside MAX_ITEM_N, which is what keeps judgmentCallId and
// recognitionCallId's hex width (derived from the largest `n` in the set) from
// ever being asked to encode an `n` it cannot hold.
//
// What is deliberately NOT required is that the numbers fill 1..length.
// sidecar/harvest.js assigns `n` as a pair's position in the whole transcript
// and its header states that as the triple's identity, so a set harvested at a
// --limit below the transcript's pair count carries gaps in its numbering by
// design. Requiring a dense range would have made every such set unloadable
// here, which is the composition the two commands' headers describe to each
// other; the identity claim is the one worth keeping, since renumbering on
// freeze would silently break the correspondence between a frozen case and the
// transcript pair it came from.
function assertNumbering(items, file, label) {
    const seen = new Set();
    for (const item of items) {
        if (item === null || typeof item !== 'object') {
            throw new Error(`${file}: a ${label} is not an object`);
        }
        if (!Number.isInteger(item.n) || item.n < 1 || item.n > MAX_ITEM_N) {
            throw new Error(`${file}: ${label} n=${JSON.stringify(item.n)} is not a whole number in 1..${MAX_ITEM_N}`);
        }
        if (seen.has(item.n)) throw new Error(`${file}: ${label} n=${item.n} is duplicated`);
        seen.add(item.n);
    }
}

// The largest `n` in a loaded set, which is what the callId width is derived
// from. An empty set is never passed here; both loaders refuse one first.
function maxItemN(items) {
    let max = 1;
    for (const item of items) if (item.n > max) max = item.n;
    return max;
}

const VERDICTS = ['achieved', 'failed', 'diverged'];

// The frozen fixtures. Never regenerated, never edited by this command; a
// missing, unreadable or malformed one is a reason to stop before the first
// endpoint call, never a reason to invent one or to fail deep inside scoring
// after every call has already been spent.
function loadJudgmentCases() {
    const file = path.join(BATTERIES_DIR, 'judgment-v1', 'cases.json');
    const raw = fs.readFileSync(file, 'utf8');
    const cases = JSON.parse(raw);
    if (!Array.isArray(cases) || cases.length === 0) throw new Error(`${file} holds no cases`);
    assertNumbering(cases, file, 'case');
    for (const c of cases) {
        for (const field of ['intent', 'command', 'result']) {
            if (typeof c[field] !== 'string') throw new Error(`${file}: case ${c.n} is missing a string ${field}`);
        }
        if (!Array.isArray(c.acceptableVerdicts) || c.acceptableVerdicts.length === 0
            || !c.acceptableVerdicts.every((v) => VERDICTS.includes(v))) {
            throw new Error(`${file}: case ${c.n} carries no valid acceptableVerdicts`);
        }
    }
    return cases;
}

// The shape every situation must have. Gold entries are held to
// sidecar/record-name.js's own predicate rather than to "is a string": a gold
// label is rendered raw beside model-derived names on the report's own lines,
// and a refreshed fixture carrying an escape run or a bidi override in a label
// would repaint the terminal of whoever reads it on the one channel the
// model's own names are screened for. It is also the same set the delivery
// valve will accept, so a gold name outside it could never be a real pointer.
function assertSituations(situations, file) {
    assertNumbering(situations, file, 'situation');
    for (const s of situations) {
        if (typeof s.situation !== 'string' || s.situation === '') {
            throw new Error(`${file}: situation ${s.n} is missing situation text`);
        }
        if (!Array.isArray(s.gold)) {
            throw new Error(`${file}: situation ${s.n} carries no gold list`);
        }
        for (const g of s.gold) {
            if (!recordName.isRecordName(g)) {
                throw new Error(`${file}: situation ${s.n} carries a gold entry that is not a record name: ${JSON.stringify(String(g).slice(0, 60))}`);
            }
        }
    }
}

// Every gold name is a name the frozen index actually holds, AS THE REAL PARSER
// READS IT. sidecar/recognize.js drops any name absent from the index it was
// shown into `invented`, so a gold label missing from index.md is a permanent
// miss and an extra at once: a fixture defect rendered as a model recall
// regression. Checked at the fixture stage, before the first endpoint call,
// because the alternative is discovering it after fifteen calls have been spent.
function assertGoldInIndex(situations, indexText, file) {
    const known = memoryIndex.parseIndex(indexText).names;
    for (const s of situations) {
        for (const g of s.gold) {
            if (!known.has(g)) {
                throw new Error(`${file}: situation ${s.n} names gold record ${g}, which the frozen index does not hold as the daemon's own parser reads it`);
            }
        }
    }
}

function loadRecognitionSituations() {
    const file = path.join(BATTERIES_DIR, 'recognition-v1', 'situations.json');
    const raw = fs.readFileSync(file, 'utf8');
    const situations = JSON.parse(raw);
    if (!Array.isArray(situations) || situations.length === 0) throw new Error(`${file} holds no situations`);
    assertSituations(situations, file);
    return situations;
}

function loadRecognitionIndexText() {
    const file = path.join(BATTERIES_DIR, 'recognition-v1', 'index.md');
    return fs.readFileSync(file, 'utf8');
}

// A deterministic hex callId per fixture case, so a case's identity is stable
// across runs of this command: 'a' for the judgment battery, 'b' for the
// recognition one, so the two batteries can share one spool file with no id
// collision. The width is derived from `maxN`, the largest `n` in the fixture
// this id is being generated for, so `n` never overflows into a 17th
// character: spool.parseLine requires exactly 16 hex characters, and a fixture
// numbering a case past 255 (2 hex digits) would silently mint a malformed id
// under a fixed-width scheme. It is the largest `n` rather than the item count
// because assertNumbering deliberately allows a sparse set, so the count says
// nothing about how wide the largest number is.
function callIdWidth(maxN) {
    const n = Number.isInteger(maxN) && maxN > 0 ? maxN : 1;
    return Math.max(2, n.toString(16).length);
}

// The two bounds the id scheme rests on, asserted rather than assumed. padStart
// never truncates, so an `n` past `maxN` mints a 17-character id that
// spool.parseLine rejects as malformed, and a `maxN` past MAX_ITEM_N leaves the
// marker no room in the 16-character id: the hex width grows with `maxN` and
// the prefix is what gets squeezed out, so the ids stop being distinguishable
// from one another's shape long before any arithmetic misbehaves. Both loaders
// establish these through assertNumbering and maxItemN; these functions are
// exported, so they establish it for themselves too.
function assertCallIdRange(n, maxN) {
    if (!Number.isInteger(n) || n < 1 || !Number.isInteger(maxN) || maxN > MAX_ITEM_N || n > maxN) {
        throw new Error(`callId n=${JSON.stringify(n)} must be a whole number in 1..maxN and maxN=${JSON.stringify(maxN)} at most ${MAX_ITEM_N}`);
    }
}
function judgmentCallId(n, maxN) {
    assertCallIdRange(n, maxN);
    const width = callIdWidth(maxN);
    return 'a'.repeat(16 - width) + n.toString(16).padStart(width, '0');
}
function recognitionCallId(n, maxN) {
    assertCallIdRange(n, maxN);
    const width = callIdWidth(maxN);
    return 'b'.repeat(16 - width) + n.toString(16).padStart(width, '0');
}

// The session ids are per RUN, not per battery.
//
// Both session logs accumulate: the daemon appends to
// logs/verdicts-<slug>.jsonl and never truncates it, and a run reads that file
// whole to score itself. With a fixed slug, a second run against the same
// --state-dir reads the first run's verdicts, so every case resolves, nothing
// is unmeasured, and a run whose endpoint answered nothing at all prints PASS
// off records it did not produce. The per-run token closes that SEQUENTIAL
// re-use: four random bytes, so the file a run scores is one an earlier run
// could have written to only by collision. It closes nothing against a run
// happening at the same time, because the daemon files a verdict under the
// session id it reads off the SPOOL ENTRY rather than its own, so a concurrent
// run draining this run's spool lines writes its verdicts into this token's own
// log. What carries the property there is main()'s reconciliation of the lines
// this run wrote against the lines its own pass consumed.
const JUDGMENT_SESSION_PREFIX = 'battery-judgment';
const RECOGNITION_SESSION_PREFIX = 'battery-recognition';

function newRunToken() {
    return crypto.randomBytes(4).toString('hex');
}

function runSessions(token) {
    return {
        judgment: `${JUDGMENT_SESSION_PREFIX}-${token}`,
        recognition: `${RECOGNITION_SESSION_PREFIX}-${token}`
    };
}

// One synthetic spool line, capped and surrogate-safe field by field the way
// a real capture would be, with `truncated` computed from whether that cut
// actually fired rather than asserted. Refuses (throws) rather than silently
// writing a line past the whole-line byte cap: this command does not carry a
// copy of the capture hook's scaled multi-field cut, so a line that would
// need one is a fixture this command cannot faithfully replay, not a fixture
// it quietly reshapes.
function spoolLine(fields) {
    const intent = textField(fields.intent, FIELD_CAP);
    const command = textField(fields.command, FIELD_CAP);
    const result = textField(fields.result, FIELD_CAP);
    // Whether the CAP fired, measured against the cap rather than against the
    // returned length. textField also drops a trailing unpaired surrogate, and
    // it does so whether or not the slice cut anything, so comparing lengths
    // would set `truncated` on a short field that merely ended in an orphan
    // half and make this flag say something it does not mean.
    const overCap = (value) => (typeof value === 'string' ? value.length : 0) > FIELD_CAP;
    const truncated = overCap(fields.intent) || overCap(fields.command) || overCap(fields.result);
    const record = {
        v: 1,
        ts: new Date().toISOString(),
        callId: fields.callId,
        sessionId: fields.sessionId,
        cwd: fields.cwd,
        tool: fields.tool,
        intent,
        command,
        result,
        truncated,
        isError: fields.isError === true
    };
    const line = JSON.stringify(record);
    const bytes = Buffer.byteLength(line, 'utf8') + 1;
    if (bytes > LINE_CAP_BYTES) {
        // The `serialize` stage, not `fixture`: this case loaded fine, and
        // "cannot load a frozen fixture" would point its reader at
        // sidecar/batteries/ when the problem is that no faithful spool line
        // exists for what loaded.
        throw stageError('serialize', `callId ${fields.callId} would serialize to ${bytes} bytes, over the ${LINE_CAP_BYTES}-byte spool line cap even after the per-field cut; this fixture cannot be replayed faithfully as written`);
    }
    return line;
}

// Build the fixture state this run needs: a spool holding the requested
// battery's lines, and, for the recognition battery, a memory root seeded
// with the frozen index under the project the recognition cwd resolves to.
// Nothing here reads or writes anything outside the state root this command
// created for itself.
//
// Every failure carries a stage, because the caller reports one sentence per
// stage rather than one sentence for all of them: a fixture that will not load
// is a different repair from a directory that cannot be created and from a
// case too large to serialize, and one message covering all three points every
// reader at the wrong one.
function stageError(stage, message) {
    const err = new Error(message);
    err.stage = stage;
    return err;
}

// A frozen-fixture read, with everything it can throw carrying the `fixture`
// stage: an unreadable file, a JSON syntax error and a failed validation are
// all the same repair, which is to look at what is in sidecar/batteries/.
function loadFixture(fn) {
    try {
        return fn();
    } catch (err) {
        if (err !== null && typeof err === 'object' && typeof err.stage === 'string') throw err;
        throw stageError('fixture', (err && err.message) ? err.message : String(err));
    }
}

// A directory this command creates under the screened state root, with every
// component below that root checked on its own.
//
// The live-tree screen answers about the path it was handed and licenses
// nothing about what is created beneath it. A recursive mkdir follows a reparse
// point on any intermediate component, so a junction planted at
// `<state-dir>/memory-root` sends the frozen index and the fixture spool
// wherever it points while this run prints the sentence saying the state root
// was screened and found outside the live tree. Handing logs.ensureDir the
// screened root makes it check `memory-root`, `projects` and the segment
// directory each in turn instead of walking through them.
function makeFixtureDir(dir, stateDir) {
    const made = logs.ensureDir(dir, stateDir);
    if (!made.ok) throw stageError('state', made.reason);
}

// A file this command is about to write, checked through the guard shared with
// sidecar/harvest.js. Both paths this command writes sit at a predictable name
// under a caller-supplied --state-dir, so a link planted at either would be
// written through, a pre-existing file at its own mode would receive real
// captured commands and their output at that mode, and a second hard link would
// carry this run's fixture lines into every other name for the same inode. The
// spool write APPENDS, so it reaches those other names without replacing
// anything, and the index write replaces the bytes all of them read.
function guardFixtureFile(file, what) {
    const guard = logs.guardWriteTarget(file);
    if (guard.ok) return;
    if (guard.kind === 'unreadable') {
        throw stageError('write', `cannot inspect the ${what} at ${file}: ${guard.code}`);
    }
    if (guard.kind === 'hardlinked') {
        throw stageError('write', `the ${what} at ${file} has ${guard.nlink} hard links, so writing it `
            + 'would reach every other name for the same file');
    }
    throw stageError('write', `the ${what} at ${file} is not a real file, so nothing is written through it`);
}

// The mode, applied rather than requested. `mode` on a write applies only when
// the write CREATES the file, so an existing world-readable file at the same
// path keeps its own mode and takes the plaintext anyway. What the mode buys
// is platform-bound: on POSIX it restricts the file to its owner, while on
// Windows Node maps a mode to the read-only attribute alone and 0o600 carries
// write permission, so no attribute is set and the file inherits the
// containing tree's ACL (docs/security-model.md records the same bound for
// the live spool).
function restrictFixtureFile(file, what) {
    try {
        fs.chmodSync(file, 0o600);
    } catch (err) {
        const code = (err && typeof err.code === 'string') ? err.code : 'chmod failed';
        throw stageError('write', `cannot restrict the ${what} at ${file} to its owner: ${code}`);
    }
}

function buildFixture(stateDir, target, sessions) {
    const spoolDir = path.join(stateDir, 'spool');
    makeFixtureDir(spoolDir, stateDir);
    const lines = [];
    const cuts = [];

    const judgmentCwd = path.join(stateDir, 'judgment-cwd');
    let judgmentCases = [];
    if (target === 'judgment' || target === 'all') {
        judgmentCases = loadFixture(loadJudgmentCases);
        const maxN = maxItemN(judgmentCases);
        for (const c of judgmentCases) {
            for (const cut of fieldCuts('judgment', c)) cuts.push({ battery: 'judgment', n: c.n, ...cut });
            lines.push(spoolLine({
                callId: judgmentCallId(c.n, maxN),
                sessionId: sessions.judgment,
                cwd: judgmentCwd,
                tool: 'Bash',
                intent: c.intent,
                command: c.command,
                result: c.result,
                isError: c.isError === true
            }));
        }
    }

    const recognitionCwd = path.join(stateDir, 'recognition-cwd');
    let recognitionSituations = [];
    let memoryRoot = null;
    if (target === 'recognition' || target === 'all') {
        recognitionSituations = loadFixture(loadRecognitionSituations);
        const maxN = maxItemN(recognitionSituations);
        memoryRoot = path.join(stateDir, 'memory-root');
        // The project segment and the index path are asked of
        // sidecar/memory-index.js, the same module the daemon will answer the
        // same question with when it reads this index back. One question, one
        // spelling: a hand-assembled path here would miss the network-share
        // refusal and the worktree-main-root resolution that module carries,
        // and the failure would be silent, the daemon finding no index, making
        // no call, and every situation rendering CANNOT-MEASURE as if the
        // model had regressed.
        const segment = memoryIndex.projectSegment(recognitionCwd);
        if (segment === null) {
            const stand = memoryIndex.memqStandDown();
            throw stageError('state', stand !== null
                ? `the recognition fixture needs memq to resolve a project segment and it is unavailable: ${stand}`
                : `no project segment resolves for the fixture working directory ${recognitionCwd}`);
        }
        const indexFile = memoryIndex.indexFileFor(memoryRoot, segment);
        if (indexFile === null) {
            throw stageError('state', 'memq is unavailable, so the recognition index has no path to be written at');
        }
        const indexText = loadFixture(loadRecognitionIndexText);
        loadFixture(() => assertGoldInIndex(recognitionSituations, indexText,
            path.join(BATTERIES_DIR, 'recognition-v1', 'situations.json')));
        makeFixtureDir(path.dirname(indexFile), stateDir);
        guardFixtureFile(indexFile, 'frozen recognition index');
        try {
            fs.writeFileSync(indexFile, indexText, { encoding: 'utf8', mode: 0o600 });
        } catch (err) {
            const code = (err && typeof err.code === 'string') ? err.code : 'write failed';
            throw stageError('write', `cannot write the frozen recognition index to ${indexFile}: ${code}`);
        }
        restrictFixtureFile(indexFile, 'frozen recognition index');
        for (const s of recognitionSituations) {
            for (const cut of fieldCuts('recognition', { intent: s.situation })) {
                cuts.push({ battery: 'recognition', n: s.n, ...cut });
            }
            lines.push(spoolLine({
                callId: recognitionCallId(s.n, maxN),
                sessionId: sessions.recognition,
                cwd: recognitionCwd,
                tool: 'Bash',
                intent: s.situation,
                // result is empty rather than a battery-specific idiom: the
                // recognition prompt already renders an empty result as "(the
                // call produced no output)" on its own
                // (sidecar/prompts/recognition-v1.js). command cannot be
                // empty the same way: spool.parseLine refuses a line whose
                // command is '' as malformed ("no command to judge"), and the
                // prompt has no built-in idiom for an absent one either, so
                // it gets a short, neutral placeholder instead. Neither
                // string says "battery" or "replayed": that would tell the
                // model under test it is inside a battery, which is exactly
                // the condition this instrument exists to reproduce
                // faithfully rather than name.
                command: '(no command)',
                result: '',
                isError: false
            }));
        }
    } else {
        // An empty memory root, present so the daemon has something to point
        // --memory-root at even when this run never reads it.
        memoryRoot = path.join(stateDir, 'memory-root');
        makeFixtureDir(memoryRoot, stateDir);
    }

    const day = fixtureDay();
    const spoolFile = path.join(spoolDir, `${day}.jsonl`);
    guardFixtureFile(spoolFile, 'fixture spool');
    // Whether the day file already on disk ends on a line boundary. A JSONL
    // appender owns the boundary it starts on: sidecar/CONTRACT.md names a torn
    // write as an expected state of a day file, and against a re-used
    // --state-dir whose file ends mid-line an append starting at the cursor
    // concatenates the first fixture line onto that partial one, which the
    // daemon reads as a single malformed record and this run scores as a
    // missing case. One byte read is what tells the two apart.
    let leadingNewline = '';
    try {
        const size = fs.statSync(spoolFile).size;
        if (size > 0) {
            const fd = fs.openSync(spoolFile, 'r');
            try {
                const tail = Buffer.alloc(1);
                fs.readSync(fd, tail, 0, 1, size - 1);
                if (tail[0] !== 0x0a) leadingNewline = '\n';
            } finally {
                fs.closeSync(fd);
            }
        }
    } catch (err) {
        // ENOENT is the ordinary case: the file is about to be created and
        // starts on a boundary by construction. Any other code means the file
        // is there and its last byte could not be read, which is a
        // cannot-measure about the boundary, so the newline goes in: a blank
        // line between two records is skipped and counted as blank by every
        // reader in this tree, while a concatenation loses a record.
        const code = (err && typeof err.code === 'string') ? err.code : '';
        if (code !== 'ENOENT') leadingNewline = '\n';
    }
    try {
        // 0600, matching sidecar/logs.js's own writes: these lines are real
        // captured commands and their real output in plaintext, whatever the
        // mode of the directory a caller pointed --state-dir at. POSIX only:
        // on Windows the mode maps to the read-only attribute alone and 0o600
        // sets none, so the file inherits the containing tree's ACL
        // (restrictFixtureFile's comment carries the full account).
        fs.appendFileSync(spoolFile, leadingNewline + lines.join('\n') + '\n', { encoding: 'utf8', mode: 0o600 });
    } catch (err) {
        const code = (err && typeof err.code === 'string') ? err.code : 'append failed';
        throw stageError('write', `cannot write the fixture spool at ${spoolFile}: ${code}`);
    }
    restrictFixtureFile(spoolFile, 'fixture spool');
    return { judgmentCases, recognitionSituations, memoryRoot, cuts, day, spoolFile };
}

// One log file, read whole. Three outcomes rather than two, because a file
// that could not be read and a file that holds nothing are the same zero and
// only one of them is a measurement: `unreadable` carries the reason and the
// caller reports it as a cannot-measure rather than letting every case
// downstream render as a gap that was never recorded.
function readJsonl(file) {
    let raw = '';
    try {
        raw = fs.readFileSync(file, 'utf8');
    } catch (err) {
        const code = (err && typeof err.code === 'string') ? err.code : 'read failed';
        if (code === 'ENOENT') return { records: [], malformed: 0, missing: true, unreadable: null };
        return { records: [], malformed: 0, missing: false, unreadable: code };
    }
    const records = [];
    let malformed = 0;
    for (const line of raw.split('\n')) {
        if (line.trim() === '') continue;
        // A parse that succeeds is not yet a record: `null`, a number, a string
        // and an array are all valid JSON, and `null` in this list crashes the
        // scorers' type filter with a TypeError into the generic catch. A value
        // that is not a non-array object says nothing a record says, so it
        // counts with the lines that did not parse at all.
        let value;
        try {
            value = JSON.parse(line);
        } catch {
            malformed += 1;
            continue;
        }
        if (value === null || typeof value !== 'object' || Array.isArray(value)) {
            malformed += 1;
            continue;
        }
        records.push(value);
    }
    return { records, malformed, missing: false, unreadable: null };
}

// One field on its way to stdout. Neutralized first and capped second, the
// order judge.js and recognize.js use, because everything rendered here came
// out of a log line and sidecar/CONTRACT.md says a log line can be hand
// written by anything running as this user: a reader trusts no producer's cap
// and no producer's character set. The caller's own `n` is honoured as the
// tighter of the two cuts. The cut carries sidecar/text.js's surrogate trim,
// because a slice can land between the halves of a surrogate pair and a
// report shipping the orphan half is the defect that trim exists for.
//
// ONE CUT, at the tighter of the two bounds, with the ellipsis decided against
// the length before it. Cutting at TEXT_MAX_CHARS first and then comparing that
// result against the tighter bound cannot mark a truncation the outer cut made:
// at an `n` of TEXT_MAX_CHARS or above the two bounds are equal, so the compare
// is never true and a 2000-character truncation renders as though the field
// were whole. Both shipped callers pass an `n` far below the cap, so the
// arithmetic is right here for the next caller rather than for a live defect.
function truncateForReport(text, n) {
    const s = neutralize(text);
    const cut = Math.min(n, TEXT_MAX_CHARS);
    // The trim on the untruncated branch is not redundant. The source is a log
    // line this reader trusts no producer of, so it can arrive already ending
    // in an orphan half that no cut here made.
    return s.length > cut ? `${trimLoneSurrogate(s.slice(0, cut))}...` : trimLoneSurrogate(s);
}

// A list of names out of a log record, each screened the same way.
function namesForReport(list) {
    return list.map((name) => truncateForReport(name, 200)).join(',');
}

// A record is scored only under this run's own provenance. Every verdict and
// recognition record carries the promptId, model and endpoint fingerprint that
// produced it (sidecar/logs.js), and a concurrent run against the same
// --state-dir can carry a different --config, so a record matching a case's
// callId can still be another config's measurement; in a full interleave the
// foreign pass can have produced ALL of this run's records, and the report's
// endpoint fingerprint, model and prompt lines would then name a config that
// produced none of them. When the caller names this run's provenance (`run`),
// a record whose promptId, model or endpoint differs is a cannot-measure
// rather than a scored case. A caller that passes no `run` (the arithmetic
// tests) gets no screen, which is a statement about its records' shape, not a
// shipped path: main() always passes one.
function foreignProvenance(rec, run) {
    if (run === null || typeof run !== 'object') return false;
    return rec.promptId !== run.promptId || rec.model !== run.model || rec.endpoint !== run.endpoint;
}

// Score the judgment battery. `measured` is tracked apart from `correct`
// because a case with no verdict record is neither correct nor wrong, it is
// unmeasured, and `pass` below refuses to read an unmeasured case as a clean
// result: correct alone reaching the floor is not enough while any case in
// the fixture never got a record at all.
function scoreJudgment(cases, records, run) {
    const byId = new Map(records.filter((r) => r.type === 'verdict').map((r) => [r.callId, r]));
    const maxN = maxItemN(cases);
    const floor = judgmentFloor(cases.length);
    const lines = [];
    let correct = 0;
    let measured = 0;
    for (const c of cases) {
        const id = judgmentCallId(c.n, maxN);
        const rec = byId.get(id);
        if (rec === undefined) {
            lines.push(`#${c.n} CANNOT-MEASURE (no verdict record; check the gap ranges above) expected=[${c.acceptableVerdicts.join('|')}]`);
            continue;
        }
        if (foreignProvenance(rec, run)) {
            lines.push(`#${c.n} CANNOT-MEASURE (the verdict record carries another run's provenance: its prompt id, model or endpoint is not this run's config, so this run's own pass did not produce it) expected=[${c.acceptableVerdicts.join('|')}]`);
            continue;
        }
        measured += 1;
        // rec.verdict and rec.reason are model-derived and reach this stdout
        // out of a log line, so both take the same screen the gap notes take.
        const verdict = truncateForReport(rec.verdict, 40);
        const ok = c.acceptableVerdicts.includes(rec.verdict);
        if (ok) {
            correct += 1;
            lines.push(`#${c.n} OK   got=${verdict}`);
        } else {
            lines.push(`#${c.n} XX   expected=[${c.acceptableVerdicts.join('|')}] got=${verdict} reason="${truncateForReport(rec.reason, 200)}"`);
        }
    }
    const unmeasured = cases.length - measured;
    const pass = unmeasured === 0 && correct >= floor;
    lines.push('');
    if (unmeasured > 0) {
        lines.push(`${unmeasured} of ${cases.length} case(s) unmeasured (gap): a gap is never scored as a pass, so this alone fails the battery`);
    }
    lines.push(`judgment: ${correct}/${cases.length} correct on substance (floor ${floor}/${cases.length}, `
        + `the audition's own ${JUDGMENT_MIN_CORRECT}/${JUDGMENT_MIN_OF} rate carried to this fixture's size)`
        + `${unmeasured > 0 ? `, ${unmeasured} unmeasured` : ''} -> ${pass ? 'PASS' : 'FAIL'}`);
    return { lines, pass, correct, measured, unmeasured, floor };
}

// Score the recognition battery. Recall and extras are measured against the
// model's raw answer (`records`) plus everything its parse marked `invented`,
// never the daemon's post-dedup `queued` list and never a known-records-only
// reading, because the audition's own numbers were measured against
// everything the model said. A single answer can name at most
// recognitionPrompt.MAX_RECORDS names total (known and invented together), so
// `extras` here is itself a floor on the true rate of invention whenever a
// model fills the answer with more hallucinated names than that; the summary
// line says so rather than leaving it to be discovered. `measured` is tracked
// the same way scoreJudgment tracks it, and a gapped situation with an empty
// gold set (a true negative) still counts into the negative denominator
// below, so "clean negatives X/Y" can never overstate Y by leaving an
// unmeasured negative out of the count.
//
// A GAP DOES NOT RUN IN EITHER DIRECTION. An unmeasured situation's gold names
// are counted apart, in `unmeasuredGold`, and never into `misses`: a miss is a
// name the model was asked for and did not give, and folding fifteen gapped
// situations' gold into that number prints "recall misses 12" against a dead
// endpoint, which is the number a reader compares with the audition's own
// 12/12. scoreJudgment already refuses the same conflation, and `pass` is
// false through `unmeasured` regardless, so the separation costs nothing.
//
// A record whose `records` or `invented` is not a list is UNMEASURED, not an
// empty answer. sidecar/CONTRACT.md admits a hand-written log line, and reading
// a malformed one as "the model named nothing" scores it as a clean negative
// and contributes to PASS.
function scoreRecognition(situations, records, run) {
    const byId = new Map(records.filter((r) => r.type === 'recognition').map((r) => [r.callId, r]));
    const maxN = maxItemN(situations);
    const lines = [];
    let misses = 0;
    let unmeasuredGold = 0;
    let extras = 0;
    let cleanNegs = 0;
    let negTotal = 0;
    let measured = 0;
    for (const s of situations) {
        const id = recognitionCallId(s.n, maxN);
        const rec = byId.get(id);
        const gold = s.gold;
        // Gold labels are frozen fixture text, held to the record-name pattern
        // at load, and they still take the report screen: they are rendered on
        // the same line as model-derived names, and one channel takes one screen.
        const goldText = namesForReport(gold);
        // The same provenance screen scoreJudgment applies, for the same
        // reason: a record another config produced is not an answer this run's
        // report can describe.
        const foreign = rec !== undefined && foreignProvenance(rec, run);
        const malformed = rec !== undefined && !foreign && !(Array.isArray(rec.records) && Array.isArray(rec.invented));
        if (rec === undefined || foreign || malformed) {
            const why = rec === undefined
                ? 'no recognition record; check the gap ranges above'
                : foreign
                    ? "the recognition record carries another run's provenance: its prompt id, model or endpoint is not this run's config, so this run's own pass did not produce it"
                    : 'the recognition record holds no name lists, so it says nothing about what the model answered';
            lines.push(`#${s.n} CANNOT-MEASURE (${why}) gold=[${goldText}]`);
            unmeasuredGold += gold.length;
            if (gold.length === 0) negTotal += 1;
            continue;
        }
        measured += 1;
        const got = rec.records;
        const invented = rec.invented;
        const gotSet = new Set(got);
        const goldSet = new Set(gold);
        const miss = gold.filter((g) => !gotSet.has(g));
        const nonGoldKnown = got.filter((g) => !goldSet.has(g));
        const extraNames = [...nonGoldKnown, ...invented];
        misses += miss.length;
        extras += extraNames.length;
        if (gold.length === 0) { negTotal += 1; if (extraNames.length === 0) cleanNegs += 1; }
        const clean = miss.length === 0 && extraNames.length === 0;
        const tag = clean ? 'OK  ' : 'XX  ';
        if (clean) {
            lines.push(`#${s.n} ${tag}gold=[${goldText}] got=[${namesForReport(got)}]`);
        } else {
            lines.push(`#${s.n} ${tag}gold=[${goldText}] got=[${namesForReport(got)}] extras=[${namesForReport(extraNames)}] reason="${truncateForReport(rec.reason, 200)}"`);
        }
    }
    const unmeasured = situations.length - measured;
    const pass = unmeasured === 0 && misses === 0 && extras <= RECOGNITION_MAX_EXTRAS;
    lines.push('');
    if (unmeasured > 0) {
        lines.push(`${unmeasured} of ${situations.length} situation(s) unmeasured (gap): a gap is never scored as a pass, so this alone fails the battery`);
        lines.push(`${unmeasuredGold} gold name(s) sit in those unmeasured situation(s) and are counted here rather than as recall misses: `
            + 'a name nobody was asked for is not a name the model failed to give');
    }
    lines.push(`recognition: recall misses ${misses} of the measured situations (floor 0), extras ${extras} (ceiling ${RECOGNITION_MAX_EXTRAS}; `
        + `the answer schema allows at most ${recognitionPrompt.MAX_RECORDS} names, known and invented together, and the parse `
        + `bounds only the known half, so this is a floor on the true invention rate whenever a model fills the answer), `
        + `clean negatives ${cleanNegs}/${negTotal}${unmeasured > 0 ? `, ${unmeasured} unmeasured holding ${unmeasuredGold} gold name(s)` : ''} -> ${pass ? 'PASS' : 'FAIL'}`);
    return { lines, pass, misses, unmeasuredGold, extras, measured, unmeasured };
}

// The live-tree screen itself lives in sidecar/state-screen.js, shared with
// sidecar/harvest.js's --out rather than reached by requiring this file: both
// commands take a caller-supplied destination that would land real plaintext
// in the operator's live store if aimed there, and a predicate a second
// consumer needs is extracted to a shared module (Standing Brief Amendment 1).
// This file re-exports screenStateDir unchanged, so
// the screen's callers and its tests read one implementation.

// Everything this run's own pass says about itself that is not a score: the
// daemon's skip counters, the lane it stopped on, and the reconciliation of the
// lines written against the lines consumed. Each entry is one paragraph the
// caller prints, and one entry is enough to make the run a cannot-measure.
//
// It is a function of numbers alone so a case can put each mechanism in front
// of it directly. Driving all of these through a live pass would need a memq
// that fails, a generation lane held busy by another tenant and a concurrent
// second run, none of which a test can stand up honestly, and a reporting rule
// nothing exercises is the shape Standing Brief Amendment 2 rules out.
//
// WHAT EACH COUNTER MEANS HERE, since three of them are read for reasons that
// are not obvious from the name:
//
//   - recognitionUnavailable and recognitionSkipped are the counters that
//     actually produce a call with neither a record nor a gap: recognizeEntry
//     returns without writing anything at all when the index status is not ok.
//     Without them a recognition battery prints fifteen CANNOT-MEASURE lines
//     pointing at gap ranges that were never written, while the daemon had
//     already counted the reason. Both are read only when the recognition
//     battery is in scope: on a judgment-only run the daemon still counts one
//     per judgment line (no index resolves for the fixture cwd, or memq cannot
//     load at all), and neither count touches any case that run scores, so
//     failing on one would render a fully measured judgment-only run as an
//     outage, the exact conflation the exit-code split exists to prevent.
//   - the skip count is not read flat. Every judgment line is captured under a
//     working directory this command gives no memory index, on purpose, so one
//     skip per judgment line is the fixture working as built; only the excess
//     is a situation that lost its record.
//   - laneHeld is not a counter but the same fact: the pass stopped where it
//     stood and left the rest of the spool unread, with no record and no gap.
//   - the stale count gets its own paragraph, because a stale skip leaves a
//     record (so the shared sentence is false about it) while still leaving the
//     case unscoreable, and because reaching it at all means the wide replay
//     horizon this command passes did not take effect.
//   - offsetResets gets its OWN paragraph, because a reset re-reads a file from
//     the start and so produces DUPLICATE records rather than missing ones. The
//     shared sentence would state a false reason for it.
//   - writeFailures gets its own paragraph for the offsetResets reason: four of
//     the sites that raise it lose no record at all (an inbox alert item, an
//     inbox memory pointer, a findings line beside a verdict line that did
//     land, the offset persist), so the shared sentence's "neither a record nor
//     a gap record" would state a false reason for those. The count still fails
//     the run, since every other site that raises it does lose a record and the
//     counter does not say which fired.
//   - the daemon's liveness stamp is NOT among those sites and is not in that
//     counter: it rises `heartbeatFailures` instead
//     (sidecar/logs.js). It is the one write here that can never cost a record,
//     since nothing about a call passes through it, so a run whose only write
//     failure was the stamp is a complete measurement of a complete set of
//     logs. It is reported below as a note rather than a finding, because a
//     reader of a replay should still know the daemon could not stamp itself
//     while it ran.
function passFindings(input) {
    const c = input.counters;
    const out = [];
    const expectedSkips = input.judgmentCount;
    const unexpectedSkips = input.recognitionScored ? Math.max(0, c.recognitionSkipped - expectedSkips) : 0;
    // THE SHORTFALL IS AS LOUD AS THE EXCESS. Clamping the subtraction at zero
    // reads a count BELOW the expectation as the expectation met, and the two
    // are not the same fact: one skip per judgment line is the fixture working
    // as built, so fewer than that means the daemon did not do to this run's
    // spool what the number the excess is measured against assumes it did, and
    // the excess computed off it is then measured against a premise this run
    // has just falsified. It is a cannot-measure for the same reason a gap is,
    // and the reason it is reported apart from the dropped-record paragraph is
    // that nothing was necessarily dropped: what is unknown is the arithmetic.
    const skipShortfall = input.recognitionScored ? Math.max(0, expectedSkips - c.recognitionSkipped) : 0;
    if (skipShortfall > 0) {
        out.push(`the daemon reports ${c.recognitionSkipped} recognition skip(s) where this fixture's `
            + `${expectedSkips} judgment line(s) account for ${expectedSkips} of them: the count is `
            + `${skipShortfall} short of what the fixture makes certain, so the excess this run scores `
            + 'its recognition situations against is measured from a premise this pass has contradicted, '
            + 'and this run is a cannot-measure');
    }
    const dropped = [
        ['malformed spool line(s)', c.malformed],
        ['spool line(s) at an unknown schema version', c.unknownVersion],
        ['oversized spool line(s)', c.oversized],
        ['call(s) whose memory index could not be loaded at all', input.recognitionScored ? c.recognitionUnavailable : 0],
        ['recognition situation(s) whose project had no readable index', unexpectedSkips]
    ].filter(([, n]) => n > 0);
    if (dropped.length > 0) {
        out.push(`the daemon reports ${dropped.map(([label, n]) => `${n} ${label}`).join(', ')}: `
            + 'every one of those is a call with neither a record nor a gap record, so this run is a cannot-measure');
    }
    // The stale count gets its own paragraph, for the reason offsetResets and
    // writeFailures get theirs: the shared sentence above would state a false
    // reason. A stale skip DOES leave a record, the coalesced stale record in
    // the session log and the findings file, so "neither a record nor a gap
    // record" is wrong about it. What it costs this run is the same, though:
    // the case has no verdict and cannot be scored. Reaching this at all means
    // the horizon this command passes did not take effect, since a hundred-day
    // window cannot expire a fixture built minutes ago, so the sentence names
    // that rather than the age.
    if (c.stale > 0) {
        out.push(`the daemon skipped ${c.stale} spool line(s) as stale despite the ${REPLAY_STALE_HORIZON_MS} ms `
            + 'horizon this replay passes it: those calls have a stale record and no verdict, so the cases they '
            + 'carry cannot be scored, and a frozen fixture crossing any freshness window means the horizon this '
            + 'command set did not reach the pass');
    }
    if (input.writeFailures > 0) {
        out.push(`the daemon reports ${input.writeFailures} failed log or inbox write(s): depending on the site, what was `
            + 'lost is a verdict, gap or recognition record, or only an inbox item, a findings line beside a verdict '
            + 'that did land, or the persisted offset; the counter does not say which, so the logs this run scores '
            + 'may be incomplete and this run is a cannot-measure');
    }
    if (c.offsetResets > 0) {
        out.push(`the daemon reports ${c.offsetResets} offset reset(s): a reset re-reads a spool file from the start, `
            + 'so this run judged lines an earlier pass had already judged, and its arithmetic is not a measurement '
            + 'of one pass over one fixture');
    }
    if (input.laneHeld === true) {
        out.push('the daemon stopped this pass on a busy generation lane, so the spool lines after that point were '
            + 'left unread with neither a record nor a gap record');
    }

    // THIS RUN SCORES ONLY WHAT THIS RUN'S PASS PRODUCED, by one integer
    // equality rather than a lock. buildFixture writes exactly one spool line
    // per judgment case and one per recognition situation and nothing else, and
    // the daemon counts `parsed` once per well-formed entry its pass consumed,
    // so the two numbers are equal for a run that drained its own fixture and
    // nothing else. A concurrent run against the same --state-dir drains these
    // lines into its own pass and files each verdict under the session id it
    // read off the entry, which is THIS run's token-stamped log: this pass then
    // consumes nothing, every case resolves against records it did not produce,
    // and the run would otherwise print PASS having made no call at all. Both
    // numbers are printed, because "the counts disagree" without them sends a
    // reader to the wrong half.
    //
    // What it does not close: an interleave whose counts happen to match while
    // some or all of this run's cases were judged by the other run's process.
    // The scorers close the cross-config half of that, treating any record
    // whose promptId, model or endpoint is not this run's own as a
    // cannot-measure, so what is left is an interleave under the identical
    // config: real measurements of the same frozen content by the same prompt,
    // model and endpoint, about which nothing this report claims is false.
    const expectedLines = input.judgmentCount + input.situationCount;
    if (c.parsed !== expectedLines) {
        out.push(`this run wrote ${expectedLines} fixture spool line(s) and its own daemon pass consumed ${c.parsed}: `
            + "the records scored below are not this run's own pass, so this run is a cannot-measure. Another run "
            + 'against this same --state-dir at the same time is the ordinary cause: its pass drains these lines and '
            + "files the verdicts under this run's own log name");
    }
    return out;
}

// The temp state root this command minted for itself, removed on an exit that
// never got to name it. Where no --state-dir was given the root is created before
// the screen that answers about it, because the screen needs a real directory
// to resolve an identity for, and the disclosure line that tells a reader where
// it is and how to remove it prints only after that screen passes. So a refusal
// or an unscreenable answer would otherwise return 1 having left a directory
// behind that nothing on the way out ever mentions. rmdir rather than a
// recursive remove, deliberately: it fails on a directory holding anything at
// all, which is the safe direction for a path this command is about to stop
// reasoning about. A caller-supplied root is never touched.
function cleanUpUnusedTempRoot(stateDirGiven, dir) {
    if (stateDirGiven) return;
    try {
        fs.rmdirSync(dir);
    } catch {
        // Best effort. The run is already returning a failure, and a temp
        // directory that could not be removed is not a second failure to
        // report over the first.
    }
}

// `deps` is a test seam, the same shape sidecar/daemon.js's runOnce carries and
// for the same reason: `newRunToken` is what a case forces to stand a foreign
// producer's records up under this run's own log name, and `write`/`warn` let a
// case drive this function in process without reassigning process.stdout, which
// Node's own test runner reports through, and `homeDir` is the live-tree
// screen's own operand.
//
// `homeDir` is the one of the four a case cannot work around. The other three
// have alternatives: a case can spawn the CLI and read its real output instead
// of capturing writes. But the screen resolves the operator's home with
// os.homedir() INSIDE this process, which no environment a caller sets on a
// child can reach, so an in-process run without this key screens against the
// operator's real store no matter where its own state root points. The shipped
// path passes none of the four, and with `homeDir` absent the screen calls
// below still pass it, as `undefined`, which the screen resolves with
// os.homedir() exactly as a one-operand call would have. The operand stays at
// the call site rather than being dropped there because it is what makes each
// site say which tree it screens against, and a site that says nothing is the
// shape this defect class wore eight times.
async function main(argv, deps) {
    const d = (deps !== null && typeof deps === 'object') ? deps : {};
    const write = typeof d.write === 'function' ? d.write : (t) => process.stdout.write(t);
    const warn = typeof d.warn === 'function' ? d.warn : (t) => process.stderr.write(t);
    const mintRunToken = typeof d.newRunToken === 'function' ? d.newRunToken : newRunToken;
    // The home the live-tree screen resolves ~/.claude from. Undefined on the
    // shipped path, which is what makes that path screen against the operator's
    // real store, exactly as sidecar/state-screen.js's own note requires of a
    // shipped caller. It is a seam because the screen's operand is the ONLY way
    // an in-process caller can substitute a fixture tree: os.homedir() is read
    // inside this process, so a child's HOME redirect does not reach it, and a
    // case driving this function without the seam reads the operator's store
    // however careful its own paths are.
    const homeDir = (typeof d.homeDir === 'string' && d.homeDir !== '') ? d.homeDir : undefined;

    const parsed = parseArgs(argv);
    if (!parsed.ok) {
        warn(`kit-sidecar-battery: ${parsed.error}\n\n${USAGE}\n`);
        return 2;
    }
    if (parsed.options.help) {
        write(`${USAGE}\n`);
        return 0;
    }

    const target = parsed.options.target;
    const configPath = (typeof parsed.options.configPath === 'string' && parsed.options.configPath !== '')
        ? parsed.options.configPath : config.defaultConfigPath();

    // The fixture state root: a fresh directory under the OS temp dir unless
    // the caller named one. Both go through the same screen, because the
    // question is what the path resolves to and not who chose it, and the
    // screen runs BEFORE anything is created under the root.
    const stateDirGiven = typeof parsed.options.stateDir === 'string' && parsed.options.stateDir !== '';
    let requestedStateDir;
    if (stateDirGiven) {
        requestedStateDir = path.resolve(parsed.options.stateDir);
    } else {
        // The temp root is screened before mkdtemp runs, so the default path
        // creates nothing until the screen has answered for the tree it would
        // create it in; the result is screened again below on its own account.
        const tmpScreen = screenStateDir(os.tmpdir(), homeDir);
        if (tmpScreen.status !== 'ok') {
            warn(`kit-sidecar-battery: the OS temp directory ${tmpScreen.resolved} cannot serve as a fixture state root (${tmpScreen.detail})\n`);
            return 1;
        }
        try {
            requestedStateDir = fs.mkdtempSync(path.join(os.tmpdir(), 'kit-sidecar-battery-'));
        } catch (err) {
            // Described like every other failure in this file rather than
            // thrown into the generic catch, which prints "stopped on an
            // unhandled error" and sends a reader looking for a bug in this
            // command instead of at a full or unwritable temp directory.
            const code = (err && typeof err.code === 'string') ? err.code : 'mkdtemp failed';
            warn(`kit-sidecar-battery: cannot create a fixture state root under the OS temp directory ${os.tmpdir()}: ${code}\n`);
            return 1;
        }
    }
    const screen = screenStateDir(requestedStateDir, homeDir);
    // The tree the screen actually compared against, for the sentences that
    // name one. `live` is absent on exactly one branch, the one where this
    // process has no home to resolve a tree from and nothing was compared.
    const screenedTree = typeof screen.live === 'string' ? screen.live : 'a live store this process cannot locate';
    if (screen.status === 'refused') {
        warn(`kit-sidecar-battery: refusing the state root ${screen.resolved}: ${screen.detail}, and this instrument never writes fabricated calls into ${screenedTree}\n`);
        cleanUpUnusedTempRoot(stateDirGiven, requestedStateDir);
        return 1;
    }
    if (screen.status !== 'ok') {
        // A cannot-measure, reported as one: with no home directory, or with an
        // operand that would not resolve, there is nothing this run can compare
        // its state root against, and a run that cannot establish that the root
        // is outside the live store does not get to print the sentence claiming
        // it.
        warn(`kit-sidecar-battery: cannot screen the state root ${screen.resolved} against ${screenedTree} (${screen.detail}), so this run does not start\n`);
        cleanUpUnusedTempRoot(stateDirGiven, requestedStateDir);
        return 1;
    }
    const stateDir = screen.resolved;
    // The one sentence about the state root, composed from the screen's own
    // answer. The comparisons are named from the list the screen recorded
    // making, never from a literal: a screen that resolved one operand and
    // compared it against the other's spelling cannot render a sentence
    // claiming four.
    //
    // Printed HERE, with the plaintext-concentration line and the removal
    // hint, before buildFixture runs, because buildFixture writes the fixture
    // spool (real production commands with their output) and the frozen index
    // to disk before the endpoint config is ever read: this file's own
    // principle is disclosure before the act, and a disclosure printed only on
    // the success path is silent on exactly the exits (absent config,
    // unreadable config, invalid url, a daemon state failure) that leave the
    // plaintext behind with nobody told. Printing ahead of buildFixture covers
    // every later exit at once.
    // The TREE is named from the screen's own answer too, not just the
    // comparisons. `~/.claude` as a fixed literal was true only while the screen
    // had one operand to resolve it from; with a home operand on the seam the
    // tree compared against is whatever that operand named, and a line asserting
    // the operator's live store over a comparison made against a fixture is the
    // composed-not-asserted rule broken by this file's own new seam.
    write(`state root (screened against ${screenedTree} and outside it, comparing `
        + `${screen.compared.join(', ')}): ${stateDir}\n`);
    // Unconditional, because the shape most likely to leave this plaintext
    // somewhere durable is the one that NAMES a directory: a repository working
    // tree, a synced folder, a shared mount. The screen refuses ~/.claude and
    // nothing else, so a --state-dir inside a public checkout is accepted and
    // is exactly where a reader most needs to be told what lands there. The
    // removal hint stays with the temp default, since that is the only path
    // this command chose on the caller's behalf.
    write(`this state root receives real captured commands and their output in plaintext: ${stateDir}\n`);
    if (!stateDirGiven) {
        // The hint is the path itself, never a composed shell command: a
        // directory name may legally hold a quote character, so a command
        // interpolating it can break its own quoting when pasted.
        write(`this is a temporary directory this command created; remove it when done: ${stateDir}\n`);
    }

    const made = logs.ensureDir(stateDir);
    if (!made.ok) {
        warn(`kit-sidecar-battery: cannot use the state root: ${made.reason}\n`);
        return 1;
    }

    const sessions = runSessions(mintRunToken());

    let fixture;
    try {
        fixture = buildFixture(stateDir, target, sessions);
    } catch (err) {
        const stage = (err !== null && typeof err === 'object' && typeof err.stage === 'string') ? err.stage : 'fixture';
        const what = {
            fixture: 'cannot load a frozen fixture',
            state: 'cannot build the fixture state directories',
            write: 'cannot write the fixture state',
            serialize: 'cannot serialize a frozen case into a replayable spool line'
        }[stage] || 'cannot build the fixture';
        warn(`kit-sidecar-battery: ${what}: ${(err && err.message) ? err.message : String(err)}\n`);
        return 1;
    }

    // The persisted write-failure count as it stands BEFORE this run. It is
    // the one daemon counter that is cumulative on disk rather than per pass,
    // so a run against a re-used state root would otherwise report an earlier
    // run's failures as its own, which is the same class of misattribution as
    // scoring an earlier run's verdicts.
    // The liveness stamp's count rides in the same read, kept apart from
    // writeFailures rather than added to it: a failed stamp costs no record
    // and so decides nothing about whether this run measured what it set out
    // to.
    const countersBefore = logs.loadState(config.statePaths(stateDir).stateFile).state.counters;
    const writeFailuresBefore = countersBefore.writeFailures;
    const heartbeatFailuresBefore = countersBefore.heartbeatFailures;

    // Where this run's data is going, printed BEFORE the first call and
    // unconditionally.
    //
    // The daemon's own disclosure is composed by remoteEndpointWarning, which
    // answers null for a loopback or private-network host, so on a fleet whose
    // endpoint is a private address the daemon prints a fingerprint and nothing
    // about egress. That silence is right for the daemon's judgement of the
    // host's reachability and wrong as this command's only account of what it
    // does: a run POSTs thirteen real production commands with their output, and
    // the whole frozen memory index, to a service on another machine, and
    // "against the live endpoint" is a role word that reads as either side of
    // the machine boundary. So the boundary and the transport are named here on
    // every run, at the one moment naming them is worth anything, which is
    // before the bytes leave. The address is never printed; the fingerprint the
    // report carries below is what identifies it.
    write('egress: this run sends every fixture command and its output, and the whole frozen memory index, '
        + 'off this machine over the network to the configured endpoint service, as cleartext HTTP request '
        + 'bodies (the endpoint address is never printed; its fingerprint is below)\n');

    // Each report line is printed AS IT ARRIVES, never collected and printed
    // after the run. The daemon composes its remote-endpoint disclosure at
    // startup, ahead of the first call, precisely so a reader sees where the
    // data is about to go before it goes; holding that line until runOnce
    // returns prints it after every fixture command, its output and the whole
    // frozen memory index have already been POSTed off this machine, which is
    // the disclosure arriving too late to be one.
    // THE FRESHNESS HORIZON IS SWITCHED OFF FOR A REPLAY, by naming a window
    // nothing can fall outside of rather than by trusting the default. A frozen
    // fixture has no freshness to lose: its lines are stamped when this command
    // builds them and every one of them is a case this run must score. The
    // daemon drains serially against a live endpoint at about a second a call,
    // so a battery of any size eventually crosses a fifteen-minute window while
    // it runs, and the cases at the tail would be dropped for an age that is an
    // artifact of this command's own pace. That would print CANNOT-MEASURE
    // lines pointing at gap ranges no pass ever wrote.
    const out = await daemon.runOnce(
        {
            once: true,
            stateDir,
            configPath,
            memoryRoot: fixture.memoryRoot,
            staleHorizonMs: REPLAY_STALE_HORIZON_MS
        },
        { report: (t) => warn(`kit-sidecar-battery: ${t}\n`) }
    );

    if (!out.ok) {
        // Per the section-5 rollup's own precedent: a missing prerequisite
        // prints what it looked for and exits non-zero, rather than a column
        // of zeros a human cannot tell from "ran and saw nothing".
        const st = out.startup;
        if (st.standDown) {
            warn(`kit-sidecar-battery: no endpoint config at ${st.path}, so there is no live endpoint to score this battery against.\n`);
        } else {
            warn(`kit-sidecar-battery: cannot start: ${st.reason}${st.detail ? ` (${st.detail})` : ''}\n`);
        }
        return 1;
    }

    write(`endpoint: ${out.ctx.config.endpointFingerprint}; model ${out.ctx.config.model}\n`);
    // The prompt ids belong on the same line as the model and the endpoint,
    // because sidecar/logs.js states this repository's rule that an answer is
    // comparable only to one produced by the same prompt against the same
    // model, and cross-run comparability is this instrument's whole product.
    write(`prompts: ${judgmentPrompt.PROMPT_ID} (judgment), ${recognitionPrompt.PROMPT_ID} (recognition)\n`);
    write(`run: ${sessions.judgment} / ${sessions.recognition}\n`);
    // Every frozen field this run cuts, named per case, with WHICH CAP FIRED
    // and how many characters the model was actually given. The replay cut is
    // what a real capture of the same call would have written, so it is correct
    // and it is still stated: four cases in this fixture carry a corrected
    // verdict precisely because a cut removed the evidence the first
    // adjudication turned on, and a reader scoring one of them is owed the
    // number the judge saw.
    //
    // Both caps are named because either can fire alone. A field over 2,000
    // characters is cut by the spool writer and then again by the prompt; a
    // field between the prompt's cap and the field cap is cut only by the
    // prompt, and a sentence that named the field cap for it would state a
    // number nothing in this run produced. Every cap here is read from the
    // prompt modules rather than restated, so this report cannot drift from the
    // prompts it describes.
    for (const cut of fixture.cuts) write(`${cutSentence(cut)}\n`);
    write('\n');

    let measuredShort = false;
    const findings = passFindings({
        counters: out.pass.counters,
        laneHeld: out.pass.laneHeld === true,
        writeFailures: Math.max(0, out.ctx.state.counters.writeFailures - writeFailuresBefore),
        judgmentCount: fixture.judgmentCases.length,
        situationCount: fixture.recognitionSituations.length,
        recognitionScored: target === 'recognition' || target === 'all'
    });
    let cannotMeasure = findings.length > 0;
    for (const finding of findings) write(`${finding}\n\n`);

    // Said out loud and deliberately not a finding. The stamp carries no part
    // of any call, so a run that could not write it still read every line,
    // judged every case and wrote every record: the scores below are a
    // measurement. What the reader loses is the daemon's own liveness trace
    // over the replay, which is worth a line and is not worth voiding a run.
    const heartbeatFailureDelta = Math.max(0,
        out.ctx.state.counters.heartbeatFailures - heartbeatFailuresBefore);
    if (heartbeatFailureDelta > 0) {
        write(`note: the daemon could not write its liveness stamp ${heartbeatFailureDelta} time(s) during this run. `
            + 'No record is lost by that and this run is still a measurement; what is missing is the stamp a reader '
            + 'dates the daemon by.\n\n');
    }

    const logsDir = out.ctx.paths.logsDir;

    const reportLog = (label, file, read, gapType) => {
        write(`== ${label} battery ==\n`);
        if (read.unreadable !== null) {
            cannotMeasure = true;
            write(`(the ${label} log at ${file} could not be read: ${read.unreadable}; `
                + 'every case below reads as unmeasured for that reason and not for a gap)\n');
        } else if (read.missing) {
            cannotMeasure = true;
            write(`(no ${label} log was written at ${file}: this run recorded nothing at all, `
                + 'which is not the same as recording that nothing applied)\n');
        }
        if (read.malformed > 0) {
            cannotMeasure = true;
            write(`(${read.malformed} malformed log line(s) skipped and counted, never silently)\n`);
        }
        const gaps = read.records.filter((r) => r.type === gapType);
        if (gaps.length > 0) {
            // What the sentence may say is bounded by what this branch knows. A
            // gap record is a cannot-measure FOR THE CALLS IT NAMES, and those
            // calls need not be any of the ones this run scored: a log is
            // re-used across runs and CONTRACT.md admits a hand-written record,
            // so a gap left by an earlier pass sits in the same file. Whether
            // THIS run is a cannot-measure is decided by the CANNOT-MEASURE
            // lines and the exit code, and a sentence here that said so flatly
            // would print beside OVERALL: PASS and exit 0, which is the shape a
            // report exists to refuse rather than to produce.
            write(`(${gaps.length} gap record(s) in this log: each is a recorded cannot-measure for the `
                + 'calls it names, never a clean result for them; whether this run is a cannot-measure is '
                + 'the CANNOT-MEASURE lines below and the exit code)\n');
            // The same trim truncateForReport carries, for the same reason: the
            // cap cut can land between the halves of a surrogate pair.
            for (const g of gaps) write(`  ${trimLoneSurrogate(neutralize(g.note).slice(0, TEXT_MAX_CHARS))}\n`);
        }
        // Stale records print beside the gaps, on the same bounded claim. They
        // are the other way a call in this log ends with no verdict, and a
        // report that printed one kind and dropped the other would leave a
        // reader of a re-used log to read a dropped stretch as a log that
        // simply had nothing in it. A stale record appears in a judgment log
        // only, so this stays quiet in the recognition report by having nothing
        // to match rather than by a second gate.
        const staleStretches = read.records.filter((r) => r.type === 'stale');
        if (staleStretches.length > 0) {
            write(`(${staleStretches.length} stale record(s) in this log: each names calls the daemon declined to `
                + 'judge for age, which is the freshness horizon working rather than an instrument that failed; a '
                + 'replay passes a horizon no fixture can cross, so a record here belongs to an earlier pass over '
                + 'this log unless the findings above say otherwise)\n');
            for (const s of staleStretches) write(`  ${trimLoneSurrogate(neutralize(s.note).slice(0, TEXT_MAX_CHARS))}\n`);
        }
    };

    // This run's own provenance, which every scored record must carry: a
    // record filed under this run's log by a concurrent run at a different
    // --config is a cannot-measure, not a scored case.
    const runProvenance = (promptId) => ({
        promptId,
        model: out.ctx.config.model,
        endpoint: out.ctx.config.endpointFingerprint
    });

    if (target === 'judgment' || target === 'all') {
        const file = logs.sessionLogFile(logsDir, sessions.judgment);
        const read = readJsonl(file);
        reportLog('judgment', file, read, 'gap');
        const scored = scoreJudgment(fixture.judgmentCases, read.records, runProvenance(judgmentPrompt.PROMPT_ID));
        write(`${scored.lines.join('\n')}\n\n`);
        if (scored.unmeasured > 0) cannotMeasure = true;
        else if (!scored.pass) measuredShort = true;
    }

    if (target === 'recognition' || target === 'all') {
        const file = logs.recognitionLogFile(logsDir, sessions.recognition);
        const read = readJsonl(file);
        reportLog('recognition', file, read, 'recognition-gap');
        const scored = scoreRecognition(fixture.recognitionSituations, read.records, runProvenance(recognitionPrompt.PROMPT_ID));
        write(`${scored.lines.join('\n')}\n\n`);
        if (scored.unmeasured > 0) cannotMeasure = true;
        else if (!scored.pass) measuredShort = true;
    }

    if (cannotMeasure) {
        write('OVERALL: FAIL (cannot measure: part of this run produced no record at all, which is never scored as a pass)\n');
        return 1;
    }
    if (measuredShort) {
        write('OVERALL: FAIL (measured in full and below the frozen threshold)\n');
        return 3;
    }
    write('OVERALL: PASS\n');
    return 0;
}

if (require.main === module) {
    main(process.argv.slice(2)).then((code) => {
        process.exitCode = code;
    }).catch((err) => {
        process.stderr.write(`kit-sidecar-battery: stopped on an unhandled error: ${(err && err.message) ? err.message : String(err)}\n`);
        process.exitCode = 1;
    });
}

module.exports = {
    JUDGMENT_MIN_CORRECT,
    JUDGMENT_MIN_OF,
    RECOGNITION_MAX_EXTRAS,
    MAX_ITEM_N,
    FIELD_CAP,
    LINE_CAP_BYTES,
    REPLAY_STALE_HORIZON_MS,
    USAGE,
    parseArgs,
    judgmentFloor,
    assertNumbering,
    maxItemN,
    textField,
    trimLoneSurrogate,
    fieldCuts,
    cutSentence,
    spoolLine,
    assertSituations,
    assertGoldInIndex,
    loadJudgmentCases,
    loadRecognitionSituations,
    loadRecognitionIndexText,
    judgmentCallId,
    recognitionCallId,
    callIdWidth,
    JUDGMENT_SESSION_PREFIX,
    RECOGNITION_SESSION_PREFIX,
    newRunToken,
    runSessions,
    screenStateDir,
    readJsonl,
    passFindings,
    buildFixture,
    scoreJudgment,
    scoreRecognition,
    main
};
