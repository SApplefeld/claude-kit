#!/usr/bin/env node
// Harvest fresh INTENT/ACTION/RESULT triples from one named transcript file.
//
// READ-ONLY, and scoped to exactly the file named on the command line. This
// never scans a directory looking for a recent session on its own, and on its
// own it writes nowhere at all: it reads the one file it was given and prints
// what it found. The one path it ever writes is the one --out names, and --out
// follows whatever path it is given EXCEPT into the live ~/.claude tree: the
// resolved path goes through sidecar/state-screen.js's screen, the same
// predicate sidecar/battery.js runs its --state-dir through, because
// ~/.claude/kit-sidecar/spool holds real capture day files and an --out
// naming one would overwrite live capture state with a JSON array. The caller
// decides which transcript to name and what to do with the output; a harvest
// that reached for "the most recent session" by itself would be picking a
// session on the operator's behalf, silently, which is a decision this
// command has no business making.
//
// WHAT A TRIPLE IS. One captured Bash tool_use paired with its tool_result, in
// the same shape the capture hook writes to the spool and the daemon reads
// from it: `intent` (the tool call's `description` field), `command` (its
// `command` field) and `result` (the paired tool_result's text, joined across
// content blocks), plus `isError` from the result's own error flag, and `n`,
// the pair's own position among every pair this file extracted (1-based, in
// the order results arrived), which stays the same for a given transcript
// regardless of --limit: it is a triple's identity, not its rank in what got
// printed. sidecar/battery.js accepts any unique positive `n` and derives a
// case's callId width from the largest one in the set, so a triple set
// harvested at a --limit below the transcript's own pair count freezes into a
// fixture exactly as it came out of here, gaps in the numbering included.
// A triple also carries `harvestCut`, a per-field record of whether THIS
// command's own cap cut that field. It has to, because the cut is frozen INTO
// the field: a cut field keeps its head and its tail around an in-band marker,
// so its stored length is inside the cap and no later reader can rediscover
// that anything was lost by measuring it. sidecar/battery.js sets a replayed
// line's `truncated` from this, and without it a genuine marker would replay
// into a triple that opens with no capture-cut notice, where the judgment
// prompt tells the judge to read a line of that shape as ordinary data.
//
// A pair too large to replay as ONE spool line is not frozen at all, and the
// count of those rides in the summary. Three fields at the field cap exceed the
// whole-line byte cap, so a triple that is legal field by field can be
// impossible as a line, and the fixture writer's answer to one is to abort the
// whole battery run. A transcript is an unbounded supply of pairs, so the
// cheapest place to refuse is here, where the next pair simply takes its slot.
//
// This is the shape sidecar/CONTRACT.md's line schema names, and it is what
// makes a harvested triple "judgeable end to end": handed to sidecar/judge.js
// or fed into a spool line for the real daemon, it needs no further
// translation. This command does not call the endpoint itself; producing the
// triples is its whole job, and judging them is the daemon's or
// sidecar/battery.js's.
//
// EVERY FIELD IS STRIPPED OF THE UNSAFE CLASS, AND NOTHING ELSE. `intent`,
// `command` and `result` all come from a transcript this command does not own
// the writer of, so every one of them has the control, bidi and zero-width
// class removed before it is stored (cut() below, over sidecar/text.js's own
// UNSAFE_PATTERN, the same character class judge.js and recognize.js
// screen model output against): a captured command carrying a bidi override
// would otherwise render on a hand-adjudicator's terminal as something the
// bytes do not say, and a wrong gold label learned from that display is frozen
// into a fixture this section's whole design rule depends on being
// trustworthy. What is NOT applied is neutralize()'s whitespace collapse. A
// triple is a REPLAYABLE record, not a rendered line: the judgment prompt
// embeds `command` and `result` verbatim, and a multi-line heredoc or a
// `git status --porcelain` result collapsed to one line is no longer the call
// that ran, which is the thing the judge is being scored on. Tab, newline and
// carriage return therefore survive into the stored field, and the print
// boundary is safe without the collapse because the only rendering this
// command does is JSON.stringify, which escapes all three on the way to a
// terminal. The cap that follows the strip carries the same surrogate trim
// sidecar/battery.js's fixture writer and the capture hook both carry, shared
// from sidecar/text.js rather than copied a third time: a cut landing between
// the halves of a surrogate pair would otherwise leave an orphan half in a
// field that is later replayed into a real spool line.
//
// SELECTION. A busy session's transcript can hold thousands of Bash pairs, so
// this command bounds what it prints (--limit, default 20) rather than
// dumping the whole transcript. At most half the limit, rounded DOWN, is
// filled with failure-shaped pairs (the harness error flag, or a result
// matching a small set of failure words), because a harvest that returned only
// failure-shaped triples would score a judge that answers "diverged" to
// everything at ceiling; rounding down is what keeps that true at an odd
// limit, and at --limit 1 it means the single slot goes to a clean pair when
// one exists. The rest of the budget, in transcript order, is clean pairs, and
// only drains back into failure-shaped ones if clean pairs run short. This is
// a bound on what is SHOWN, never a rewrite of what was found: the summary
// line reports pairs found, how many were unparsed or left unpaired, and the
// interesting/clean split actually chosen, on every run.
//
// Usage:
//   node sidecar/harvest.js <transcript.jsonl> [--limit <n>] [--out <path>]
//                            [--help]
//
//   <transcript.jsonl>  the one transcript file to read; required
//   --limit             at most this many triples in the output (default 20)
//   --out               write the JSON array here instead of stdout
//   --help              print this usage and exit

'use strict';

const fs = require('fs');
const path = require('path');
const readline = require('readline');

const logs = require('./logs.js');
const { UNSAFE_PATTERN, cutToCap } = require('./text.js');
const { screenStateDir } = require('./state-screen.js');

// `exit code 127` and `exit code 130` are failure shapes exactly as `exit code
// 1` is, so the digit run is matched whole rather than as one digit: a
// single-digit pattern classifies every multi-digit status as clean, which is
// the half of the transcript this selection exists to reach.
const FAILURE_RE = /error|fail|refus|reject|not found|no such|denied|warn|exit code [1-9][0-9]*|timed? ?out/i;

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 500;

// The same per-field cap sidecar/CONTRACT.md states for a real captured spool
// line. This is a field cap only: a harvested triple is a JSON array entry,
// not a spool line, so the contract's separate 16384-byte whole-line cap (a
// property of one serialized spool record) has no triple-shaped analogue
// here. sidecar/battery.js is what turns a frozen case into an actual spool
// line, and it carries and enforces that cap itself when it does.
const FIELD_CAP = 6000;

function parseArgs(argv) {
    const options = { transcript: null, limit: DEFAULT_LIMIT, outPath: null, help: false };
    const rest = [];
    for (let i = 0; i < argv.length; i += 1) {
        const arg = argv[i];
        const value = argv[i + 1];
        if (arg === '--help' || arg === '-h') { options.help = true; continue; }
        if (arg === '--limit') {
            const n = Number(value);
            if (!Number.isInteger(n) || n < 1 || n > MAX_LIMIT) {
                return { ok: false, error: `--limit needs a whole number between 1 and ${MAX_LIMIT}` };
            }
            options.limit = n; i += 1; continue;
        }
        if (arg === '--out') {
            if (typeof value !== 'string' || value === '' || value.startsWith('-')) {
                return { ok: false, error: '--out needs a path' };
            }
            options.outPath = value; i += 1; continue;
        }
        if (arg.startsWith('-')) return { ok: false, error: `unknown argument: ${arg}` };
        rest.push(arg);
    }
    if (rest.length > 1) return { ok: false, error: `unexpected argument: ${rest[1]}` };
    if (rest.length === 1) options.transcript = rest[0];
    return { ok: true, options };
}

const USAGE = [
    'kit judgment sidecar: harvest',
    '',
    'usage: node sidecar/harvest.js <transcript.jsonl> [--limit <n>] [--out <path>] [--help]',
    '',
    '  <transcript.jsonl>  the one transcript file to read (required)',
    `  --limit             at most this many triples in the output (default ${DEFAULT_LIMIT})`,
    '  --out               write the JSON array here instead of stdout; a path',
    '                      at or under the live ~/.claude tree is refused, by',
    '                      spelling or through a link, and a planted symlink at',
    '                      the path is refused rather than followed',
    '  --help              print this usage and exit'
].join('\n');

// The unsafe class removed, and nothing else touched. This is neutralize()
// minus its whitespace collapse and its end trim: same character class, over
// the same UNSAFE_PATTERN, so the two can never screen for different things,
// but the line structure of what a command printed survives into the stored
// field. See the header for why a replayable record cannot take the collapse.
// The `u` flag is load-bearing wherever this pattern is compiled: the class
// names the tag block with `\u{...}`, which a non-unicode regular expression
// cannot express and refuses to compile.
const UNSAFE_RE = new RegExp(UNSAFE_PATTERN, 'gu');

// Stripped, capped and surrogate-safe: the three duties every field crossing
// out of this transcript reader carries, in that order, matching judge.js's and
// recognize.js's own order of screen-then-cap on model output. The cut is
// sidecar/text.js's own, the same spelling sidecar/battery.js's fixture writer
// cuts with and pinned equal to the capture hook's: past the cap it keeps the
// field's head and its tail with the in-band marker between them, and it trims
// a surrogate orphan at either cut point. A cut copied per producer is one the
// next producer gets wrong by omission, and a harvested field is replayed into
// a real spool line later, so a shape that differs here is a shape the battery
// measures the judge against and production never writes.
function cut(s) {
    const stripped = (typeof s === 'string' ? s : '').replace(UNSAFE_RE, '');
    return cutToCap(stripped, stripped.length, FIELD_CAP).text;
}

// Whether that cut LOST anything, which is the state a frozen case has to carry
// beside the text. A field this command cuts is frozen WITH its in-band marker
// in it, and its stored length is then inside the cap, so nothing downstream
// can rediscover that a cut happened by measuring it. sidecar/battery.js reads
// this to set a replayed line's `truncated`, and without it a genuine marker
// replays into a triple that opens with no capture-cut notice, where the judge
// is told to read a line of that shape as ordinary data.
function cutLost(s) {
    const stripped = (typeof s === 'string' ? s : '').replace(UNSAFE_RE, '');
    return cutToCap(stripped, stripped.length, FIELD_CAP).lost;
}

// The whole-line byte cap the fixture writer replays under, mirrored here for
// the same reason FIELD_CAP is and pinned equal to the capture hook's by the
// same test, which is why it is exported. A triple is not a spool line, so this
// file does not serialize one; what it needs the number for is the refusal
// below. The pin has to be a strict equality in both directions: a copy left
// stale HIGH would freeze a case the fixture writer then throws on, aborting a
// whole battery run, which is the failure the refusal exists to prevent.
const LINE_CAP_BYTES = 16384;

// What sidecar/battery.js's own record costs around the three fields when it
// turns a case into a spool line: the schema version, the call id, a timestamp,
// the session id, the fixture cwd, the tool name, the two booleans and every
// key. Measured generously rather than derived, because this file cannot
// require the fixture writer and a bound that is a little tight only ever
// refuses a case that would have fitted, while one that is too loose lets
// through the case that aborts a whole run.
const SPOOL_SKELETON_BYTES = 1024;

// Whether a harvested triple can be replayed as one spool line at all.
//
// Three fields at the field cap are 18,000 characters against a 16,384-byte
// line, so a triple that is legal field by field can be impossible as a line;
// the fixture writer refuses such a case by throwing, which kills the whole
// battery run rather than the one case. The refusal belongs here, where a
// candidate can simply not be selected: a transcript is an unbounded supply of
// pairs and there is nothing to lose by taking the next one.
function fitsSpoolLine(triple) {
    const fields = Buffer.byteLength(
        JSON.stringify({ intent: triple.intent, command: triple.command, result: triple.result }),
        'utf8'
    );
    return fields + SPOOL_SKELETON_BYTES <= LINE_CAP_BYTES;
}

// The tool_result's text channels, joined the way sidecar/CONTRACT.md states
// for the spool: a bare string is used as-is, an array of content blocks
// contributes its text blocks.
function resultTextOf(content) {
    if (typeof content === 'string') return content;
    if (Array.isArray(content)) {
        return content.filter((c) => c && c.type === 'text' && typeof c.text === 'string')
            .map((c) => c.text).join('\n');
    }
    return '';
}

// Every Bash tool_use/tool_result pair in one transcript, in the order their
// results arrived, plus what did not turn into a pair. Never throws: a line
// that is not JSON is skipped AND COUNTED (`unparsed`), the same posture
// sidecar/spool.js and sidecar/CONTRACT.md require of a consumer toward a line
// it cannot parse, applied here to a transcript this command does not own the
// writer of either, and every tool_use still waiting for its result when the
// file ends is counted too (`unpaired`), rather than silently discarded,
// because a transcript in a shape this reader does not match would otherwise
// print "0 pairs found" indistinguishable from a session that ran no Bash.
//
// The third count is the mirror of `unpaired`: a tool_result whose tool_use_id
// was never seen (`orphanResults`), which is what a transcript truncated at the
// head, resumed, or rotated mid-session hands this reader. Without it such a
// file reports a complete-looking extraction, since the results whose calls are
// missing simply fall out of the loop, and the claim above that nothing is
// silently discarded would be false for the one input that produces it.
//
// The fourth (`commandless`) is a Bash tool_use whose `input` is absent or
// whose `input.command` is not a string: it enters seenCallIds but never
// `pending`, so without its own count it lands in neither `unpaired` nor
// `orphanResults` and is discarded silently, which the paragraph above rules
// out. Its later tool_result is deliberately NOT an orphan, since the call IS
// in the file; what was unusable is the call's own shape.
//
// The sixth (`collidingIds`) is a second Bash tool_use carrying an id already
// pending. The map is keyed by that id, so the second call displaces the first
// and the displaced call is counted by none of the five above: it never reaches
// `pairs`, it is gone from `pending` before the file ends so it is not
// `unpaired`, and its own tool_result is in the file so it is not an orphan. A
// resumed or replayed transcript is what produces one. The count is what keeps
// the claim above true; it is not a repair, since which of two calls sharing an
// id a result belongs to is not a question this file can answer.
//
// The fifth (`unrecognized`) is the one the other four cannot see, because all
// four count things found INSIDE an envelope this reader matched. A line that
// is valid JSON but carries no `message.content` array is a line whose envelope
// itself is not the shape this reader knows, and every count above stays at
// zero for it: a transcript written in a later format would report "0 pairs
// found (0 unparsed, 0 unpaired, 0 orphans, 0 commandless)", byte-identical to
// a session that genuinely ran no Bash. That is the exact confusion the header
// above claims these counters prevent, so the envelope gets a counter of its
// own.
async function extractPairs(file) {
    const pending = new Map();
    const pairs = [];
    let unparsed = 0;
    let orphanResults = 0;
    let commandless = 0;
    let unrecognized = 0;
    let collidingIds = 0;
    let unreplayable = 0;
    // Every tool_use id this file showed, whatever the tool. It is what tells a
    // result belonging to some other tool (the ordinary case, and not an
    // orphan) from a result whose call is not in this file at all.
    const seenCallIds = new Set();
    // The stream is held in a name of its own and torn down in a finally,
    // because an exception raised inside the loop leaves it open otherwise: a
    // for-await that runs to completion closes the interface, and one that
    // throws does not, so the descriptor lives until the garbage collector
    // reaches it. That is inconsequential for the one-shot command, which exits
    // on the way out, and not for this suite, which drives this exported seam
    // repeatedly inside one process.
    const input = fs.createReadStream(file, { encoding: 'utf8' });
    const rl = readline.createInterface({ input, crlfDelay: Infinity });
    try {
        for await (const raw of rl) {
            if (raw.trim() === '') continue;
            let obj = null;
            try { obj = JSON.parse(raw); } catch { unparsed += 1; continue; }
            const content = obj && obj.message && obj.message.content;
            if (!Array.isArray(content)) { unrecognized += 1; continue; }
            for (const item of content) {
                if (item && item.type === 'tool_use') seenCallIds.add(item.id);
                if (item && item.type === 'tool_use' && item.name === 'Bash' && !(item.input && typeof item.input.command === 'string')) {
                    commandless += 1;
                } else if (item && item.type === 'tool_use' && item.name === 'Bash') {
                    if (pending.has(item.id)) collidingIds += 1;
                    pending.set(item.id, {
                        intent: typeof item.input.description === 'string' ? item.input.description : '',
                        command: item.input.command
                    });
                } else if (item && item.type === 'tool_result' && pending.has(item.tool_use_id)) {
                    const p = pending.get(item.tool_use_id);
                    pending.delete(item.tool_use_id);
                    const rawResult = resultTextOf(item.content);
                    const triple = {
                        n: pairs.length + 1,
                        intent: cut(p.intent),
                        command: cut(p.command),
                        result: cut(rawResult),
                        // What this command's own cut lost, per field, so the
                        // fixture writer can flag a replayed line the way a real
                        // capture of the same call would have been flagged.
                        harvestCut: {
                            intent: cutLost(p.intent),
                            command: cutLost(p.command),
                            result: cutLost(rawResult)
                        },
                        isError: item.is_error === true
                    };
                    // A triple no spool line can carry is not frozen at all. The
                    // count is reported beside the other skips, because a
                    // transcript whose long pairs all dropped out here and one
                    // that held none look identical from the summary otherwise.
                    if (fitsSpoolLine(triple)) pairs.push(triple);
                    else unreplayable += 1;
                } else if (item && item.type === 'tool_result' && !seenCallIds.has(item.tool_use_id)) {
                    orphanResults += 1;
                }
            }
        }
    } finally {
        rl.close();
        input.destroy();
    }
    return { pairs, unparsed, unpaired: pending.size, orphanResults, commandless, unrecognized, collidingIds, unreplayable };
}

// Up to `limit` triples, `n` untouched: each carries the position extractPairs
// gave it, so a triple's identity is stable across two runs at different
// --limit values, which matters because `n` is what sidecar/battery.js derives
// a case's callId from when a harvested set is later frozen into a fixture.
//
// What `n` counts, precisely, because two readings are available and only one
// is true: it is the position among the pairs this command KEPT, contiguous
// from 1, and it is not the transcript's own ordinal for that call. A pair
// refused as unreplayable consumes no number, so a reader counting Bash pairs
// in the source transcript to find `judgment #9` lands on the ninth kept pair
// rather than the ninth pair in the file. Contiguity is what the stability
// claim above needs (--limit changes what is SELECTED, never what was
// extracted), and it is what a fixture's callId derivation needs; transcript
// position is a different property this command has never carried.
//
// At most half the budget is failure-shaped (`interestingBudget`), rounded
// down so the bound holds at an odd limit too, so a transcript with more
// failure-shaped pairs than the whole limit cannot crowd every clean pair out;
// a limit not fully spent by that split falls back to filling the rest from
// whatever failure-shaped pairs are left, so a limit larger than a mixed
// transcript can otherwise fill is not an error. At --limit 1 the budget is
// zero, which is the same rule rather than a special case: the one slot goes
// to a clean pair when the transcript holds one, and drains back to a
// failure-shaped pair only when it does not. If a different ratio ever proves
// wrong for this section, the fix is this function's own interestingBudget
// line and this header's SELECTION paragraph, kept in agreement.
function selectTriples(pairs, limit) {
    const interesting = pairs.filter((p) => p.isError || FAILURE_RE.test(p.result));
    const clean = pairs.filter((p) => !(p.isError || FAILURE_RE.test(p.result)));
    const interestingBudget = Math.floor(limit / 2);
    const firstInteresting = interesting.slice(0, interestingBudget);
    const chosenClean = clean.slice(0, limit - firstInteresting.length);
    const stillOwed = limit - firstInteresting.length - chosenClean.length;
    const secondInteresting = stillOwed > 0
        ? interesting.slice(firstInteresting.length, firstInteresting.length + stillOwed)
        : [];
    const chosenInteresting = [...firstInteresting, ...secondInteresting];
    return {
        triples: [...chosenInteresting, ...chosenClean],
        interestingChosen: chosenInteresting.length,
        cleanChosen: chosenClean.length,
        interestingFound: interesting.length,
        cleanFound: clean.length
    };
}

// The tree a screen answer was actually compared against, for the sentences
// that name one. A fixed `the live store` was true only while the screen had
// one operand to resolve its tree from; with a home operand on the seam the
// tree is whatever that operand named, and a refusal describing a fixture tree
// as the operator's live store asserts a check that did not run. `live` is
// absent on exactly one branch, the one where the calling process has no home
// to resolve a tree from and nothing was compared.
function screenedTree(screen) {
    return typeof screen.live === 'string' ? screen.live : 'a live store this process cannot locate';
}

// `deps` is a test seam, the same shape sidecar/battery.js's main and
// sidecar/daemon.js's runOnce carry. `readPairs` is the transcript read, and it
// is here because that read is what opens the window this command's two screens
// bracket: the --out screen runs before it and the write runs after it, and the
// duration between them is the duration of a file read this command does not
// bound. A case supplies a reader that mutates the tree mid-read and drives the
// same window a slow transcript opens on its own. `homeDir` is the live-tree
// screen's own operand, which an in-process caller has no other way to
// substitute: os.homedir() is read inside the calling process, so an
// environment set on a child does not reach it. The shipped path passes none of
// them, and with `homeDir` absent both screen calls below still pass it, as
// `undefined`, which the screen resolves with os.homedir() exactly as a
// one-operand call would have. The operand stays at the call site rather than
// being dropped there because it is what makes each site say which tree it
// screens against, and a site that says nothing is the shape this defect class
// wore eight times.
async function main(argv, deps) {
    const d = (deps !== null && typeof deps === 'object') ? deps : {};
    const readPairs = typeof d.readPairs === 'function' ? d.readPairs : extractPairs;
    // The home the live-tree screen resolves ~/.claude from, on the seam
    // sidecar/battery.js's main carries for the same reason. Undefined on the
    // shipped path, so a shipped run screens against the operator's real store.
    // It is here ahead of an in-process caller rather than after one: os.homedir()
    // is read inside whatever process calls this, so a caller that drives this
    // function directly has no other way to point the screen at a fixture tree,
    // and the caller who needs it will not think to ask for it first.
    const homeDir = (typeof d.homeDir === 'string' && d.homeDir !== '') ? d.homeDir : undefined;

    const parsed = parseArgs(argv);
    if (!parsed.ok) {
        process.stderr.write(`kit-sidecar-harvest: ${parsed.error}\n\n${USAGE}\n`);
        return 2;
    }
    if (parsed.options.help) {
        process.stdout.write(`${USAGE}\n`);
        return 0;
    }
    if (parsed.options.transcript === null) {
        process.stderr.write(`kit-sidecar-harvest: a transcript file is required\n\n${USAGE}\n`);
        return 2;
    }

    // ONE SPELLING, resolved once, for every operation --out is the subject of:
    // the screen, the lstat guard, the write, the chmod, the disclosure line
    // and the summary. A path is judged and then acted on, and judging one
    // spelling while acting on another means the screen answered about a path
    // this command never touches. It is also the spelling a reader is owed,
    // since a relative --out disclosed as a relative path names a destination
    // that depends on a working directory the reader cannot see.
    const outPath = parsed.options.outPath === null ? null : path.resolve(parsed.options.outPath);

    // The live-tree screen on --out, before the transcript is even opened: the
    // same shared predicate battery.js runs its --state-dir through, so the
    // section's two caller-supplied destinations hold one posture. Without it,
    // --out naming a capture day file under ~/.claude/kit-sidecar/spool would
    // overwrite live capture state with a JSON array. An unscreened answer is
    // refused like a refusal: a path this command cannot compare against the
    // live store is not one it writes plaintext to.
    if (outPath !== null) {
        const screen = screenStateDir(outPath, homeDir);
        if (screen.status === 'refused') {
            process.stderr.write(`kit-sidecar-harvest: refusing --out ${screen.resolved}: ${screen.detail}, `
                + `and this command never writes into ${screenedTree(screen)}\n`);
            return 1;
        }
        if (screen.status !== 'ok') {
            process.stderr.write(`kit-sidecar-harvest: cannot screen --out ${screen.resolved} against `
                + `${screenedTree(screen)} (${screen.detail}), so nothing is written there\n`);
            return 1;
        }
    }

    const file = path.resolve(parsed.options.transcript);
    let st = null;
    try {
        st = fs.lstatSync(file);
    } catch (err) {
        const code = (err && typeof err.code === 'string') ? err.code : 'lstat failed';
        process.stderr.write(`kit-sidecar-harvest: cannot read ${file}: ${code}\n`);
        return 1;
    }
    if (st.isSymbolicLink() || !st.isFile()) {
        process.stderr.write(`kit-sidecar-harvest: ${file} is not a real file, so nothing is read through it\n`);
        return 1;
    }

    let extracted;
    try {
        extracted = await readPairs(file);
    } catch (err) {
        process.stderr.write(`kit-sidecar-harvest: cannot read ${file}: ${(err && err.message) ? err.message : String(err)}\n`);
        return 1;
    }
    const { pairs, unparsed, unpaired, orphanResults, commandless, unrecognized, collidingIds, unreplayable } = extracted;

    const selected = selectTriples(pairs, parsed.options.limit);
    const payload = JSON.stringify(selected.triples, null, 2) + '\n';

    // The refused pairs are counted OUTSIDE the parenthetical, and before it.
    // Everything in that list is a thing that never became a pair; a pair too
    // large to replay was found and then turned down, and `pairs.length`
    // excludes it. Reported inside the same list, "7 found (... 3 too large
    // ...)" leaves a reader unable to tell whether the transcript held seven
    // pairs or ten.
    const summary = `kit-sidecar-harvest: ${pairs.length + unreplayable} Bash pair(s) found in ${file}, `
        + `${unreplayable} of them refused as too large to replay as one spool line, `
        + `so ${pairs.length} kept `
        + `(${unparsed} unparsed line(s) skipped, ${unpaired} tool_use(s) left unpaired at end of file, `
        + `${orphanResults} tool_result(s) whose call is not in this file, `
        + `${commandless} Bash tool_use(s) carrying no string command, `
        + `${unrecognized} line(s) whose envelope this reader does not recognize, `
        + `${collidingIds} Bash tool_use(s) repeating an id still awaiting a result, whose earlier call `
        + 'is displaced and unrecoverable), '
        + `${selected.triples.length} chosen (${selected.interestingChosen} of ${selected.interestingFound} `
        + `failure-shaped, ${selected.cleanChosen} of ${selected.cleanFound} clean)`;

    // The same statement sidecar/battery.js prints for the identical class of
    // material, on both branches: what leaves this command is verbatim
    // captured commands and their output, a concentration a reader piping to a
    // file or naming an --out inside a synced folder is owed before deciding
    // where it lands. stderr on both, so the stdout branch's JSON payload
    // stays parseable.
    // The one spelling, which is the resolved one: this is the line whose whole
    // job is telling a reader where the plaintext lands, and it is also the
    // spelling the screen above judged and the write below uses.
    const plaintextLine = outPath !== null
        ? 'kit-sidecar-harvest: the file --out names receives real captured commands and their output '
            + `in plaintext: ${outPath}\n`
        : 'kit-sidecar-harvest: what follows is real captured commands and their output in plaintext\n';

    if (outPath !== null) {
        // The shared write-target guard, the same one sidecar/battery.js runs
        // its two files under --state-dir through: this is one output channel
        // with two producers, and the guard belongs at the boundary rather than
        // in whichever command needed it first.
        //
        // A directory or a device at the path is refused by name for the same
        // reason a symlink is: --out follows whatever it is given, and the only
        // thing this command will overwrite is an ordinary file. Left to the
        // write, a directory arrives as an unhandled EISDIR. A second hard link
        // is the route the live-tree screen cannot close: two names for one
        // inode, one of them inside ~/.claude, and the outside name screens
        // clean and then takes the write.
        //
        // A failed lstat is a refusal rather than a shrug. Swallowing every
        // error here would leave the guard's own answer unknown and skip all
        // three refusals at once, which is the opposite of what a guard is for;
        // the transcript lstat above refuses on any code for the same reason.
        // THE SCREEN IS RUN AGAIN HERE, on the directory the file lands in.
        //
        // The screen above ran before the transcript was opened, and reading a
        // transcript takes as long as the transcript is large. A screen answers
        // about the path it was handed at the moment it was handed it, so a
        // reparse point planted on an INTERMEDIATE directory of --out during
        // that read is unscreened by it, and the guard below cannot see one: an
        // lstat on the leaf resolves through the junction above it and answers
        // 'absent' or 'file', both of which are ok. Standing Brief Amendment 7
        // is this re-screen; it costs three syscalls against a read of
        // unbounded duration.
        //
        // The dirname rather than the leaf, because the leaf is the file about
        // to be written and the screen walks upward from the deepest existing
        // component: handing it the leaf when the leaf does not exist walks the
        // same directories anyway, and handing it the directory says what is
        // being asked plainly.
        const outDir = path.dirname(outPath);
        const rescreen = screenStateDir(outDir, homeDir);
        if (rescreen.status !== 'ok') {
            process.stderr.write(`kit-sidecar-harvest: the directory --out lands in, ${rescreen.resolved}, `
                + `${rescreen.status === 'refused' ? `is inside ${screenedTree(rescreen)}` : `cannot be screened against ${screenedTree(rescreen)}`} `
                + `at the moment of the write (${rescreen.detail}), so nothing is written there\n`);
            return 1;
        }
        const guard = logs.guardWriteTarget(outPath);
        if (!guard.ok) {
            const said = {
                symlink: 'is a symlink',
                irregular: 'is not a regular file',
                hardlinked: `has ${guard.nlink} hard links, so writing it would overwrite every other `
                    + 'name for the same file',
                unreadable: `cannot be inspected: ${guard.code}`
            }[guard.kind];
            process.stderr.write(`kit-sidecar-harvest: ${outPath} ${said}, refusing to write through it\n`);
            return 1;
        }
        // Disclosure before the act, the posture battery.js takes for the same
        // material: the reader learns what the path receives before it does.
        process.stderr.write(plaintextLine);
        try {
            // 0600, the mode sidecar/logs.js gives the identical class of
            // content: this file holds real captured commands and their output
            // in plaintext, and it is written wherever --out points, which may
            // be a directory with no protective mode of its own. The chmod is
            // separate because `mode` applies only when the write CREATES the
            // file, so re-writing an existing world-readable path would
            // otherwise leave this plaintext at that path's own mode. What the
            // mode buys is POSIX-only: on Windows Node maps a mode to the
            // read-only attribute alone, and 0o600 carries write permission,
            // so no attribute is set and the file inherits the containing
            // tree's ACL.
            fs.writeFileSync(outPath, payload, { encoding: 'utf8', mode: 0o600 });
        } catch (err) {
            // Described like every other failure in both commands rather than
            // left to the top-level catch, which prints "stopped on an
            // unhandled error" for a full disk or a read-only directory.
            const code = (err && typeof err.code === 'string') ? err.code : ((err && err.message) ? err.message : 'write failed');
            process.stderr.write(`kit-sidecar-harvest: cannot write ${outPath}: ${code}\n`);
            return 1;
        }
        // The chmod is its own step with its own sentence, because by the time
        // it runs the payload is already on disk. Sharing the write's try would
        // report "cannot write <path>" for a chmod failure and exit 1 with the
        // plaintext sitting there at the pre-existing file's own mode, which
        // tells a reader the opposite of what happened. What is true here is
        // that the file was written and could not be restricted.
        try {
            fs.chmodSync(outPath, 0o600);
        } catch (err) {
            const code = (err && typeof err.code === 'string') ? err.code : 'chmod failed';
            process.stderr.write(`kit-sidecar-harvest: ${outPath} was written and could not be restricted `
                + `to its owner: ${code}\n`);
            return 1;
        }
        process.stderr.write(`${summary}, written to ${outPath}\n`);
    } else {
        process.stderr.write(`${summary}, printed below\n`);
        process.stderr.write(plaintextLine);
        process.stdout.write(payload);
    }
    return 0;
}

if (require.main === module) {
    main(process.argv.slice(2)).then((code) => {
        process.exitCode = code;
    }).catch((err) => {
        process.stderr.write(`kit-sidecar-harvest: stopped on an unhandled error: ${(err && err.message) ? err.message : String(err)}\n`);
        process.exitCode = 1;
    });
}

module.exports = {
    DEFAULT_LIMIT,
    MAX_LIMIT,
    FIELD_CAP,
    LINE_CAP_BYTES,
    FAILURE_RE,
    USAGE,
    parseArgs,
    cut,
    resultTextOf,
    extractPairs,
    selectTriples,
    main
};
