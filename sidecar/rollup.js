// A read-only rollup over the judge daemon's own logs: verdict logs,
// recognition logs, findings (including its rotated generation), the daemon's
// own persisted skip counters, and the delivery inbox, per sidecar/CONTRACT.md.
// It writes nothing and it never talks to the endpoint; it only counts what is
// already on disk under `<stateDir>/logs/` and `<stateDir>/inbox/` and prints
// plain text a status round can quote. `node sidecar/rollup.js [--state-dir
// <path>] [--help]`.
//
// THREE SOURCES, ONE DEDUP DECISION. A judgment gap is written twice by the
// daemon: once to the session's own verdict log (so a reader of one session's
// verdicts sees the hole without cross-referencing) and once to findings.jsonl
// (the fleet-wide audit surface), and the two writes are independent, so either
// can fail alone. This rollup counts gap RANGES from the verdict logs only,
// because that is where a session's own gaps are all guaranteed to land even if
// the findings write failed; the findings file's own gap lines are counted
// separately as "gap echoes" so the two numbers can be compared rather than
// silently summed into one, which would double the count on the common case
// where both writes succeeded. `diverged` findings, by contrast, exist ONLY in
// findings.jsonl (a verdict log holds the same event as a `verdict` record with
// `verdict: "diverged"`), so the findings count is reported as its own line, a
// cross-check against the verdict tally rather than an addition to it.
//
// FINDINGS HAS TWO GENERATIONS. logs.sweepLogs rotates findings.jsonl to
// findings.jsonl.1 at FINDINGS_MAX_BYTES and keeps that one generation; this
// command reads both, so a rotation never makes a finding vanish from a
// rollup. The two are read as one merged tally and the report says so when the
// rotated generation was present. Past retention, findings.jsonl.1 itself
// expires while the session verdict logs it was echoing follow the same
// window: a "gap echo" count that now exceeds the verdict-log gap count is not
// a bug, it is the session log having expired while its echo in findings
// (rotated more slowly, since it is a fleet-wide file rather than a per-session
// one) had not yet. The totals line below reports the comparison rather than
// asserting a match, for exactly that reason.
//
// MISSING VS EMPTY. A state dir or logs dir that does not exist means this
// command never ran there and prints nothing, exiting 1 with the path it
// looked for: a human reading a rollup needs to tell "the instrument was never
// engaged" from "the instrument ran and saw nothing", and a column of zeros
// cannot carry that distinction on its own. A logs dir that exists and holds
// nothing real logs a legitimate all-zero rollup and exits 0. The inbox and the
// findings file are each optional even when the logs dir is real (recognition
// with no findings yet, or a machine whose delivery valve was never turned on)
// and are reported as absent rather than as a failure.
//
// A CANNOT-MEASURE NEVER RENDERS AS CLEAN. A log file, an inbox queue file, the
// inbox directory itself, or an offset file that lstat or readFileSync refuses
// (permission, EBUSY, a directory or a symlink in its place, past a string
// ceiling) contributes NOTHING to the counts below it would have fed, exactly
// like an absent one, but unlike an absent one it is a file this command could
// not read rather than one that was never written. Silently treating the two
// the same would make the worst kind of gap in this report, the one that looks
// like a clean zero, so every such refusal is counted into
// "file(s) refused or unreadable" in the totals block. This is the same
// discipline the header on `parseLogFile` states for a malformed LINE, one
// level up: a whole FILE that could not be read is the file-level version of
// the same lie, and it is reported rather than swallowed.
//
// EVERY LOG FILE, THE INBOX DIRECTORY, EACH QUEUE FILE AND EACH OFFSET FILE IS
// LSTAT-SCREENED. Every sibling in this codebase that touches these paths
// refuses a link (logs.js's ensureDir and sweepLogs, inbox.js's writeItem and
// sweepInbox), and docs/security-model.md states that both sides of this
// contract refuse one. A reader that skipped the screen would be the one path
// left where a planted link is followed instead of refused, silently narrowing
// that document's claim.
//
// MALFORMED LINES ARE COUNTED, NEVER SKIPPED IN SILENCE. Per CONTRACT.md, a
// concurrent write can tear a line and a hand-written line can be anything at
// all; both are expected events this command must make visible rather than
// quietly drop, so every line that fails to parse as a v1 record of a known
// shape adds to a reported count. A schema-version mismatch and a v1 record of
// an unrecognized `type` are counted apart from each other, since they are
// different events with different repairs: the first is a record from a
// different contract version, the second is a record this file's own writer
// would never produce.
//
// A TRAILING PARTIAL LINE IS NEVER COUNTED. CONTRACT.md names an unterminated
// final line as a write in flight; this command drops it uncounted rather than
// treating it as malformed, which would otherwise inflate the very number that
// signals the interleave mitigation breaking every time this command runs
// beside a live daemon.
//
// THE DAEMON'S OWN COUNTERS ARE READ TOO, from logs/offsets.json, and rendered
// apart from this command's own per-file parse counts: they answer a different
// question. This command's counts describe what it could read just now; the
// daemon's counters describe what the daemon itself skipped while writing,
// spool lines this command never sees because they never became a log line at
// all. A nonzero `writeFailures` there means this rollup's own totals are
// incomplete for a reason no amount of re-reading the logs directory can
// recover.
//
// EVERY RENDERED FREE-TEXT FIELD IS NEUTRALIZED AND CAPPED (sidecar/text.js). A
// gap's reason and detail, and a recognition-gap's note, all ride in records
// this command trusts to read but not to print: CONTRACT.md's own tamper
// limits say a log line can be hand-written by anything running as this user,
// so a rendered field carries the same escape-sequence and invisible-character
// risk as the spool content the daemon guards against, and an unbounded one
// could be a hand-written megabyte. The gap-range and recognition-gap and
// per-day LISTS are separately capped in item count, for the same reason one
// level up: a hand-written log can inflate how many distinct lines there are
// to print, not only how long one of them is. This command never prints
// `intent` or a command preview at all, which keeps it inside the same
// pointer-not-body discipline the delivery valve holds to.
//
// PER-DAY BUCKETS USE THE CALL'S OWN CLOCK WHERE ONE EXISTS. `record.ts` is the
// moment the DAEMON wrote the record, not the moment the call ran; verdict and
// recognition records carry `capturedAt` for exactly that distinction, and a
// daemon that is manually started (v1's posture) ordinarily judges a backlog,
// so bucketing on write time would file a whole morning's backlog under the
// day the daemon happened to run. Gap, stale and recognition-gap records
// describe a stretch rather than one call, so they bucket by write time of
// necessity; the per-day header says so. A stale record does carry the captured
// range of its ends, which the stale-skip list prints, so how old the dropped
// calls were is readable even though the day bucket cannot use it.
//
// DELIVERED/QUEUED PARSED BY THE HOOK'S OWN RULES, MIRRORED. The inbox
// `.offset` file names how far one session's valve has read; this command
// mirrors kit-sidecar-capture.js's readOffset exactly (lstat-screened,
// size-capped, `Number(raw.trim())` under `Number.isSafeInteger`), reading the
// offset as 0 for every case CONTRACT.md's "The delivered offset" section names
// as a 0: absent, unreadable, unparseable, oversized, or past the queue file's
// own length. "Delivered" itself is the valve's own word for what it means: the
// offset advances before a batch is emitted and past malformed lines, unknown
// kinds and empty batches, so the column counts what the valve CONSUMED, not
// what a session actually saw on its screen. This is READ-ONLY throughout: the
// command never writes an offset and never touches a `.lock` file.

'use strict';

const fs = require('fs');
const path = require('path');

const config = require('./config.js');
const logs = require('./logs.js');
const inboxModule = require('./inbox.js');
const { neutralize, TEXT_MAX_CHARS, trimLoneSurrogate } = require('./text.js');

const KNOWN_VERDICTS = ['achieved', 'failed', 'diverged'];

// The offset file's own size ceiling, mirroring
// kit-sidecar-capture.js's OFFSET_FILE_MAX_BYTES exactly (m10): the two halves
// of the contract cannot share a module across the hook/daemon process
// boundary, so the bound is restated here rather than read from there, the
// same reason sidecar/CONTRACT.md gives for the duplicated neutralize
// implementation.
const OFFSET_FILE_MAX_BYTES = 64;

// How many rows a gap-shaped list (judgment gap ranges, recognition gaps, per
// day) prints before it switches to an "N more" line. A hand-written log line
// can inflate how many distinct entries there are to print as easily as it can
// inflate one field's length, and neither is this command's to render without
// a bound.
const MAX_LIST_ROWS = 200;

const TOOL_SCOPE_LINE = 'tool scope: Bash only. The capture hook registers on '
    + 'PostToolUse with the matcher "Bash" alone, while the sibling shell-facing '
    + 'hooks in hooks.json match "Bash|PowerShell", so a call this fleet makes '
    + 'through PowerShell leaves no spool line and no record here: a count below '
    + 'is never coverage of everything the fleet ran.';

const TAMPER_LINE = 'evidence, not a guarantee: capture can be switched off '
    + 'silently, a log line can be hand-written by anything running as this '
    + 'user, and the intent field is authored by the session under judgment '
    + '(sidecar/CONTRACT.md, "What the spool is not: it is not tamper-evident").';

const DELIVERED_LINE = '"delivered" below means bytes the valve has CONSUMED '
    + 'past its offset: the offset advances before a batch is emitted and past '
    + 'malformed lines, unknown kinds and empty batches, so this is not a count '
    + 'of what a session actually saw.';

// One log-record field on its way onto this report. Neutralized, capped at the
// channel's own bound, and trimmed of a lone surrogate half the cap may have
// left, the same three steps in the same order sidecar/battery.js's
// truncateForReport takes.
//
// The trim rides with the cut because it is a property of the rendered channel
// rather than of the producer, and this command and battery.js are two readers
// of the SAME record: a gap note whose 2000-character cut lands between the
// halves of a surrogate pair has to print identically here and there, or one
// reader of a log line shows an orphan half the other does not.
function renderText(text) {
    return trimLoneSurrogate(neutralize(text).slice(0, TEXT_MAX_CHARS));
}

function parseArgs(argv) {
    const options = { stateDir: null, help: false };
    for (let i = 0; i < argv.length; i += 1) {
        const arg = argv[i];
        const value = argv[i + 1];
        if (arg === '--help' || arg === '-h') { options.help = true; continue; }
        if (arg === '--state-dir') {
            // A value that starts with `-` is almost always the NEXT flag,
            // swallowed because this one expected an argument: without this
            // check `--state-dir --help` silently takes the literal string
            // "--help" as a path and never prints usage (m6).
            if (typeof value !== 'string' || value === '' || value.startsWith('-')) {
                return { ok: false, error: '--state-dir needs a path' };
            }
            options.stateDir = value; i += 1; continue;
        }
        return { ok: false, error: `unknown argument: ${arg}` };
    }
    return { ok: true, options };
}

const USAGE = [
    'kit judgment sidecar: rollup',
    '',
    'usage: node sidecar/rollup.js [--state-dir <path>] [--help]',
    '',
    '  --state-dir  sidecar state root (default: ~/.claude/kit-sidecar)',
    '  --help       print this usage and exit'
].join('\n');

function emptySessionStats() {
    return {
        verdict: { achieved: 0, failed: 0, diverged: 0, other: 0 },
        gaps: 0,
        gappedCalls: 0,
        // Stale stretches and the calls they cover, counted apart from the gap
        // numbers above rather than summed into them. A gap is a call the
        // instrument COULD NOT judge and a stale stretch is one it DECLINED to
        // judge for age, so a reader acts on the first and reads the second as
        // the horizon working; one number for both would put an outage and a
        // policy in the same column. Kept per session and per day because a
        // machine-wide count alone cannot say whose backlog was dropped or on
        // which day, which is exactly what those two sections are read for.
        staleStretches: 0,
        staleCalls: 0,
        recognition: { calls: 0, pointed: 0, invented: 0 },
        recognitionGaps: 0
    };
}

function emptyTotals() {
    return {
        verdict: { achieved: 0, failed: 0, diverged: 0, other: 0 },
        gaps: 0,
        gappedCalls: 0,
        staleStretches: 0,
        staleCalls: 0,
        recognition: { calls: 0, pointed: 0, invented: 0 },
        recognitionGaps: 0,
        findingsDiverged: 0,
        findingsGapEchoes: 0,
        // The findings file's copy of a stale record, tracked apart from the
        // gap echoes for the reason the header gives about those: the two
        // writes can fail independently, so the echo count is a cross-check
        // against the verdict-log count rather than something to add to it.
        findingsStaleEchoes: 0,
        malformed: 0,
        // Unrecognized schema version (a record whose `v` this command does
        // not know) and unrecognized record `type` (a v1 record this file's
        // writer would never produce) are different events and are counted
        // apart (m4-minor), per source file.
        verdictSchemaUnknown: 0,
        verdictTypeUnknown: 0,
        recognitionSchemaUnknown: 0,
        recognitionTypeUnknown: 0,
        findingsSchemaUnknown: 0,
        findingsTypeUnknown: 0,
        // Whole files (or the inbox directory, a queue file, an inbox
        // directory listing) this command lstat-screened away or failed to
        // read: a link, a non-regular file, or a genuine read failure. See the
        // header's "A CANNOT-MEASURE NEVER RENDERS AS CLEAN" note.
        unreadableFiles: 0
    };
}

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

// The UTC calendar day a timestamp names, or 'unknown-date' for anything that
// is not a plausible ISO date prefix. Validated rather than merely sliced
// (M2): the un-validated form used to slice the first 10 characters of
// whatever string arrived and print it verbatim inside `[...]` on every gap
// line, and CONTRACT.md's own tamper limits say that string can be
// hand-written by anything running as this user, so ten characters is enough
// room for an ANSI run or a bidi override. Validating also bounds how many
// distinct buckets a hand-written log can force into the `days` Map: every
// value that is not a real `YYYY-MM-DD` prefix collapses into the single
// 'unknown-date' bucket rather than minting a new one.
function dayOf(ts) {
    if (typeof ts !== 'string' || ts.length < 10) return 'unknown-date';
    const candidate = ts.slice(0, 10);
    return DAY_RE.test(candidate) ? candidate : 'unknown-date';
}

// The day a CALL happened, for a verdict or recognition record: `capturedAt`
// when it is a usable string, `ts` (the daemon's write time) otherwise. See
// the header's "PER-DAY BUCKETS USE THE CALL'S OWN CLOCK" note (M6).
function callDay(record) {
    return dayOf(typeof record.capturedAt === 'string' ? record.capturedAt : record.ts);
}

// The day a record was WRITTEN, for a gap or recognition-gap record, which
// carries no `capturedAt` at all.
function writeDay(record) {
    return dayOf(record.ts);
}

function slugFromLogName(name, prefix) {
    return name.slice(prefix.length, name.length - '.jsonl'.length);
}

// The call count a gap record states, defaulted the same way logs.gapNote
// defaults it: 1, never 0, for a record missing or mistyping `count`. Using
// the same default as the note builder is what keeps the tallied call count
// and the printed range from disagreeing on a hand-written or stripped record
// (m8).
function gapCount(record) {
    return (Number.isInteger(record.count) && record.count > 0) ? record.count : 1;
}

// One log file's lines: parsed v1 records, and the two ways a line can fail to
// become one. `malformed` is a line that is not valid JSON, or is JSON that is
// not an object; `unknown` is an object whose schema version this command does
// not recognize. Both are counted and neither is skipped in silence.
// `readFailed` is a third, file-level outcome: the file could not even be
// opened (M3). It is distinct from "the file holds zero valid lines," which is
// what an empty `records`/`malformed`/`unknown` triple means on its own; a
// caller must check `readFailed` before trusting a zeroed result to mean the
// file was empty rather than unreadable.
function parseLogFile(file) {
    let raw = '';
    try {
        raw = fs.readFileSync(file, 'utf8');
    } catch {
        return { records: [], malformed: 0, unknown: 0, readFailed: true };
    }
    const lines = raw.split('\n');
    // The last element of the split is either '' (the file ended in `\n`, the
    // ordinary case) or a trailing partial line with no terminating `\n` (a
    // write in flight, per CONTRACT.md). Both are dropped uncounted: an empty
    // string carries nothing to parse, and a partial line is not this
    // command's to judge malformed just because it caught the file mid-write
    // (m5).
    lines.pop();

    const records = [];
    let malformed = 0;
    let unknown = 0;
    for (const rawLine of lines) {
        const line = rawLine.replace(/\r$/, '');
        let parsed = null;
        try {
            parsed = JSON.parse(line);
        } catch {
            malformed += 1;
            continue;
        }
        if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
            malformed += 1;
            continue;
        }
        if (parsed.v !== logs.LOG_VERSION) {
            unknown += 1;
            continue;
        }
        records.push(parsed);
    }
    return { records, malformed, unknown, readFailed: false };
}

function tallyVerdictFile(name, records, sessions, days, gapRanges, staleRanges, totals) {
    const slug = slugFromLogName(name, 'verdicts-');
    if (!sessions.has(slug)) sessions.set(slug, emptySessionStats());
    const sessionStats = sessions.get(slug);

    for (const record of records) {
        if (record.type === 'verdict') {
            const day = callDay(record);
            if (!days.has(day)) days.set(day, emptySessionStats());
            const dayStats = days.get(day);
            const v = KNOWN_VERDICTS.includes(record.verdict) ? record.verdict : 'other';
            sessionStats.verdict[v] += 1;
            dayStats.verdict[v] += 1;
            totals.verdict[v] += 1;
        } else if (record.type === 'gap') {
            const day = writeDay(record);
            if (!days.has(day)) days.set(day, emptySessionStats());
            const dayStats = days.get(day);
            sessionStats.gaps += 1;
            dayStats.gaps += 1;
            totals.gaps += 1;
            const count = gapCount(record);
            sessionStats.gappedCalls += count;
            dayStats.gappedCalls += count;
            totals.gappedCalls += count;
            const noteSource = (typeof record.note === 'string' && record.note !== '') ? record.note : logs.gapNote(record);
            const detail = (typeof record.detail === 'string' && record.detail !== '') ? renderText(record.detail) : '';
            gapRanges.push({ slug, day, note: renderText(noteSource), detail });
        } else if (record.type === 'stale') {
            // Bucketed by the day the record was WRITTEN, like a gap, since the
            // day it covers is a range rather than a point. The captured range
            // rides in the rendered row instead, where it says how old the
            // dropped calls actually were.
            const day = writeDay(record);
            if (!days.has(day)) days.set(day, emptySessionStats());
            const dayStats = days.get(day);
            sessionStats.staleStretches += 1;
            dayStats.staleStretches += 1;
            totals.staleStretches += 1;
            const count = gapCount(record);
            sessionStats.staleCalls += count;
            dayStats.staleCalls += count;
            totals.staleCalls += count;
            const noteSource = (typeof record.note === 'string' && record.note !== '') ? record.note : logs.staleNote(record);
            // Both ends of the captured range are spool content, so they are
            // neutralized on the way out exactly as a gap's detail is.
            const first = typeof record.firstCapturedAt === 'string' ? renderText(record.firstCapturedAt) : '';
            const last = typeof record.lastCapturedAt === 'string' ? renderText(record.lastCapturedAt) : '';
            const captured = (first === '' && last === '') ? '' : (first === last ? first : `${first} to ${last}`);
            staleRanges.push({ slug, day, note: renderText(noteSource), captured });
        } else {
            totals.verdictTypeUnknown += 1;
        }
    }
}

function tallyRecognitionFile(name, records, sessions, days, recognitionGapEntries, totals) {
    const slug = slugFromLogName(name, 'recognition-');
    if (!sessions.has(slug)) sessions.set(slug, emptySessionStats());
    const sessionStats = sessions.get(slug);

    for (const record of records) {
        if (record.type === 'recognition') {
            const day = callDay(record);
            if (!days.has(day)) days.set(day, emptySessionStats());
            const dayStats = days.get(day);
            sessionStats.recognition.calls += 1;
            dayStats.recognition.calls += 1;
            totals.recognition.calls += 1;
            const pointed = Array.isArray(record.queued) ? record.queued.length : 0;
            const invented = Array.isArray(record.invented) ? record.invented.length : 0;
            sessionStats.recognition.pointed += pointed;
            dayStats.recognition.pointed += pointed;
            totals.recognition.pointed += pointed;
            sessionStats.recognition.invented += invented;
            dayStats.recognition.invented += invented;
            totals.recognition.invented += invented;
        } else if (record.type === 'recognition-gap') {
            const day = writeDay(record);
            if (!days.has(day)) days.set(day, emptySessionStats());
            const dayStats = days.get(day);
            sessionStats.recognitionGaps += 1;
            dayStats.recognitionGaps += 1;
            totals.recognitionGaps += 1;
            const callId = typeof record.callId === 'string' ? record.callId : '';
            const reason = typeof record.reason === 'string' ? record.reason : 'unknown reason';
            const noteSource = (typeof record.note === 'string' && record.note !== '') ? record.note : `call ${callId} not recognized, ${reason}`;
            recognitionGapEntries.push({ slug, day, note: renderText(noteSource) });
        } else {
            totals.recognitionTypeUnknown += 1;
        }
    }
}

function tallyFindings(records, totals) {
    for (const record of records) {
        if (record.type === 'diverged') {
            totals.findingsDiverged += 1;
        } else if (record.type === 'gap') {
            // Already counted from the session verdict log above; see the
            // header comment on why this is tracked apart rather than summed.
            totals.findingsGapEchoes += 1;
        } else if (record.type === 'stale') {
            totals.findingsStaleEchoes += 1;
        } else {
            totals.findingsTypeUnknown += 1;
        }
    }
}

// One findings generation, findings.jsonl or its rotated predecessor
// findings.jsonl.1: lstat-screened (M7) before it is opened, and its read
// failure is a counted refusal (M3) rather than a silent empty tally. Returns
// `exists: false` for a genuinely absent generation, which is not a refusal at
// all: a machine whose findings file has never rotated has no `.1`, and that
// is the ordinary case.
function readFindingsGeneration(file, totals) {
    let st = null;
    try {
        st = fs.lstatSync(file);
    } catch {
        return { exists: false, refused: false };
    }
    if (st.isSymbolicLink() || !st.isFile()) {
        totals.unreadableFiles += 1;
        return { exists: true, refused: true };
    }
    const parsed = parseLogFile(file);
    if (parsed.readFailed) {
        totals.unreadableFiles += 1;
        return { exists: true, refused: true };
    }
    totals.malformed += parsed.malformed;
    totals.findingsSchemaUnknown += parsed.unknown;
    tallyFindings(parsed.records, totals);
    return { exists: true, refused: false };
}

function countNewlineBytes(buf, end) {
    const limit = end === undefined ? buf.length : Math.min(end, buf.length);
    let n = 0;
    for (let i = 0; i < limit; i += 1) {
        if (buf[i] === 0x0A) n += 1;
    }
    return n;
}

// The delivered offset, read exactly the way
// kit-sidecar-capture.js's readOffset reads it (m10), so the two halves of the
// contract can never report different delivered/queued splits for the same
// directory: lstat-screened, size-capped at OFFSET_FILE_MAX_BYTES, and parsed
// with `Number(raw.trim())` under `Number.isSafeInteger`, never the looser
// regex the two used to disagree by. Every failure reads as 0, per
// CONTRACT.md's "The delivered offset": this is the contract's own defined
// behavior for an absent, unreadable, unparseable or oversized offset file,
// not a refusal to report (a LINK at the offset file's position is refused and
// counted instead; see the caller).
function readDeliveredOffset(file) {
    let st = null;
    try {
        st = fs.lstatSync(file);
    } catch {
        return { value: 0, linked: false };
    }
    if (st.isSymbolicLink()) return { value: 0, linked: true };
    if (!st.isFile() || st.size > OFFSET_FILE_MAX_BYTES) return { value: 0, linked: false };
    let raw = '';
    try {
        raw = fs.readFileSync(file, 'utf8');
    } catch {
        return { value: 0, linked: false };
    }
    const value = Number(raw.trim());
    if (!Number.isSafeInteger(value) || value < 0) return { value: 0, linked: false };
    return { value, linked: false };
}

// Delivered vs queued line counts per session inbox, mirroring
// CONTRACT.md's "The delivered offset" rules exactly (m10). Every path this
// touches is lstat-screened (M7): the inbox directory itself, each queue file,
// and each offset file. A link or a non-regular file at any of those positions
// is refused and counted into `totals.unreadableFiles`, on the same footing as
// a log file this command could not read (M3); an ordinary absent or
// unreadable OFFSET file is not counted, because CONTRACT.md itself defines
// that as reading as 0, the same silent degrade the hook's own valve performs.
// Read-only throughout: no offset, lock or queue file is written.
function inboxCounts(inboxDir, totals) {
    const result = { present: true, sessions: [], totalDelivered: 0, totalQueued: 0 };

    let dirStat = null;
    try {
        dirStat = fs.lstatSync(inboxDir);
    } catch {
        result.present = false;
        return result;
    }
    if (dirStat.isSymbolicLink() || !dirStat.isDirectory()) {
        result.present = false;
        totals.unreadableFiles += 1;
        return result;
    }

    let names = [];
    try {
        names = fs.readdirSync(inboxDir);
    } catch {
        result.present = false;
        totals.unreadableFiles += 1;
        return result;
    }

    const bases = new Map();
    for (const name of names) {
        const parsed = inboxModule.inboxBaseName(name);
        if (parsed === null || parsed.temp || parsed.kind === 'lock') continue;
        if (!bases.has(parsed.base)) bases.set(parsed.base, { jsonl: null, offset: null });
        const entry = bases.get(parsed.base);
        if (parsed.kind === 'jsonl') entry.jsonl = name;
        if (parsed.kind === 'offset') entry.offset = name;
    }

    for (const [base, entry] of bases) {
        if (entry.jsonl === null) continue;
        const queueFile = path.join(inboxDir, entry.jsonl);
        let qst = null;
        try {
            qst = fs.lstatSync(queueFile);
        } catch {
            totals.unreadableFiles += 1;
            continue;
        }
        if (qst.isSymbolicLink() || !qst.isFile()) {
            totals.unreadableFiles += 1;
            continue;
        }
        let buf;
        try {
            buf = fs.readFileSync(queueFile);
        } catch {
            totals.unreadableFiles += 1;
            continue;
        }

        let offsetVal = 0;
        if (entry.offset !== null) {
            const offset = readDeliveredOffset(path.join(inboxDir, entry.offset));
            if (offset.linked) totals.unreadableFiles += 1;
            offsetVal = offset.value;
        }
        const effective = (offsetVal <= buf.length) ? offsetVal : 0;
        const totalLines = countNewlineBytes(buf);
        const deliveredLines = countNewlineBytes(buf, effective);
        const queuedLines = totalLines - deliveredLines;
        result.sessions.push({ slug: base, delivered: deliveredLines, queued: queuedLines });
        result.totalDelivered += deliveredLines;
        result.totalQueued += queuedLines;
    }
    result.sessions.sort((a, b) => a.slug.localeCompare(b.slug));
    return result;
}

// The daemon's own skip counters, read from logs/offsets.json apart from this
// command's own per-file parse counts (M4): they answer what the DAEMON itself
// dropped while writing, spool lines that never became a log line at all and
// so are invisible to every count above. `present` distinguishes a state file
// this command never found (a daemon that has not run yet) from one that
// exists; `reset` and `detail` (from logs.loadState) carry forward when the
// state file was corrupt or from an unrecognized schema version, since the
// zeroed counters that follow such a reset are not evidence nothing happened.
//
// Lstat-screened like every other path this command opens (M7): logs.loadState
// itself reads with `fs.readFileSync`, which follows a link, so a symlink
// planted at this position would otherwise be read through by this new call
// path while every sibling read in this file refuses one.
function readDaemonState(stateFile) {
    let st = null;
    try {
        st = fs.lstatSync(stateFile);
    } catch {
        return { present: false, reset: false, detail: '', counters: logs.emptyState().counters };
    }
    if (st.isSymbolicLink() || !st.isFile()) {
        return { present: false, reset: false, detail: 'a link or a non-regular file, refused', counters: logs.emptyState().counters, refused: true };
    }
    const loaded = logs.loadState(stateFile);
    return {
        present: true,
        reset: loaded.reset === true,
        detail: loaded.detail || '',
        counters: loaded.state.counters
    };
}

// Read the three log sources under one state dir and return either a described
// refusal (state dir or logs dir missing or unreadable) or the full tally. This
// is the only function that touches the filesystem for the verdict and
// recognition side; `inboxCounts` above is the inbox side and
// `readDaemonState` is the daemon-state side.
function computeRollup(stateDir) {
    let rootStat = null;
    try {
        rootStat = fs.lstatSync(stateDir);
    } catch (err) {
        const code = (err && typeof err.code === 'string') ? err.code : 'lstat failed';
        return { ok: false, reason: `state dir not found: ${stateDir} (${code})` };
    }
    if (!rootStat.isDirectory()) {
        return { ok: false, reason: `state dir is not a directory: ${stateDir}` };
    }

    const paths = config.statePaths(stateDir);
    let logsStat = null;
    try {
        logsStat = fs.lstatSync(paths.logsDir);
    } catch (err) {
        const code = (err && typeof err.code === 'string') ? err.code : 'lstat failed';
        return { ok: false, reason: `no logs directory: ${paths.logsDir} (${code})` };
    }
    if (!logsStat.isDirectory()) {
        return { ok: false, reason: `logs path is not a directory: ${paths.logsDir}` };
    }

    let names = [];
    try {
        names = fs.readdirSync(paths.logsDir);
    } catch (err) {
        const code = (err && typeof err.code === 'string') ? err.code : 'readdir failed';
        return { ok: false, reason: `logs directory unreadable: ${paths.logsDir} (${code})` };
    }

    const sessions = new Map();
    const days = new Map();
    const gapRanges = [];
    const staleRanges = [];
    const recognitionGapEntries = [];
    const totals = emptyTotals();

    const verdictFiles = names.filter((n) => logs.VERDICT_LOG_RE.test(n)).sort();
    for (const name of verdictFiles) {
        const file = path.join(paths.logsDir, name);
        let st = null;
        try {
            st = fs.lstatSync(file);
        } catch {
            totals.unreadableFiles += 1;
            continue;
        }
        if (st.isSymbolicLink() || !st.isFile()) {
            totals.unreadableFiles += 1;
            continue;
        }
        const parsed = parseLogFile(file);
        if (parsed.readFailed) {
            totals.unreadableFiles += 1;
            continue;
        }
        totals.malformed += parsed.malformed;
        totals.verdictSchemaUnknown += parsed.unknown;
        tallyVerdictFile(name, parsed.records, sessions, days, gapRanges, staleRanges, totals);
    }

    const recognitionFiles = names.filter((n) => logs.RECOGNITION_LOG_RE.test(n)).sort();
    for (const name of recognitionFiles) {
        const file = path.join(paths.logsDir, name);
        let st = null;
        try {
            st = fs.lstatSync(file);
        } catch {
            totals.unreadableFiles += 1;
            continue;
        }
        if (st.isSymbolicLink() || !st.isFile()) {
            totals.unreadableFiles += 1;
            continue;
        }
        const parsed = parseLogFile(file);
        if (parsed.readFailed) {
            totals.unreadableFiles += 1;
            continue;
        }
        totals.malformed += parsed.malformed;
        totals.recognitionSchemaUnknown += parsed.unknown;
        tallyRecognitionFile(name, parsed.records, sessions, days, recognitionGapEntries, totals);
    }

    const findingsMain = readFindingsGeneration(paths.findingsFile, totals);
    const findingsRotatedFile = path.join(paths.logsDir, logs.FINDINGS_ROTATED_NAME);
    const findingsRotated = readFindingsGeneration(findingsRotatedFile, totals);
    const findingsPresent = findingsMain.exists || findingsRotated.exists;
    const findingsRefused = findingsMain.refused || findingsRotated.refused;
    const findingsRotatedIncluded = findingsRotated.exists && !findingsRotated.refused;

    const daemonState = readDaemonState(paths.stateFile);
    if (daemonState.refused) totals.unreadableFiles += 1;

    return {
        ok: true,
        stateDir,
        logsDir: paths.logsDir,
        findingsFile: paths.findingsFile,
        findingsPresent,
        findingsRefused,
        findingsRotatedIncluded,
        sessions,
        days,
        gapRanges,
        staleRanges,
        recognitionGapEntries,
        totals,
        daemonState,
        inbox: inboxCounts(paths.inboxDir, totals)
    };
}

function formatSessionLine(label, s) {
    const otherPart = s.verdict.other > 0 ? ` other ${s.verdict.other}` : '';
    return `${label}: verdicts achieved ${s.verdict.achieved} failed ${s.verdict.failed} `
        + `diverged ${s.verdict.diverged}${otherPart}; gaps ${s.gaps} (${s.gappedCalls} call(s)); `
        + `stale ${s.staleStretches} (${s.staleCalls} call(s)); `
        + `recognition ${s.recognition.calls} call(s), pointed ${s.recognition.pointed}, `
        + `invented ${s.recognition.invented}; recognition gaps ${s.recognitionGaps}`;
}

// Print at most MAX_LIST_ROWS of `items` through `formatRow`, and an "N more"
// line past that. `emptyLine` is what prints when there is nothing at all.
function renderCappedList(lines, items, emptyLine, formatRow) {
    if (items.length === 0) {
        lines.push(emptyLine);
        return;
    }
    const shown = items.slice(0, MAX_LIST_ROWS);
    for (const item of shown) lines.push(formatRow(item));
    if (items.length > shown.length) {
        lines.push(`... ${items.length - shown.length} more`);
    }
}

function render(result) {
    const lines = [];
    lines.push(`kit sidecar rollup: ${result.stateDir}`);
    lines.push(`logs: ${result.logsDir}`);
    lines.push(TOOL_SCOPE_LINE);
    lines.push('');

    lines.push('== totals ==');
    const t = result.totals;
    const otherPart = t.verdict.other > 0 ? `, other ${t.verdict.other}` : '';
    lines.push(`verdicts: achieved ${t.verdict.achieved}, failed ${t.verdict.failed}, diverged ${t.verdict.diverged}${otherPart}`);
    lines.push(`judgment gaps: ${t.gaps} gap record(s) covering ${t.gappedCalls} call(s)`);
    // On its own line and never added to the gaps above: these calls have no
    // verdict because the daemon declined to judge them for age, which is the
    // horizon working rather than an instrument that failed.
    lines.push(`stale skips: ${t.staleStretches} stale record(s) covering ${t.staleCalls} call(s) `
        + 'dropped past the freshness horizon (declined, not unmeasurable)');
    lines.push(`recognition calls: ${t.recognition.calls}, pointed ${t.recognition.pointed}, invented ${t.recognition.invented}`);
    lines.push(`recognition gaps: ${t.recognitionGaps}`);

    if (!result.findingsPresent) {
        lines.push('findings file: not present (no findings yet)');
    } else {
        const rotatedNote = result.findingsRotatedIncluded ? ', including the rotated generation findings.jsonl.1' : '';
        const surplus = t.findingsGapEchoes - t.gaps;
        const surplusNote = surplus > 0
            ? ` (${surplus} more echo(es) than verdict-log gaps: the session log(s) that would confirm them have likely expired past retention)`
            : '';
        lines.push(`findings file: ${t.findingsDiverged} diverged entr${t.findingsDiverged === 1 ? 'y' : 'ies'} `
            + `(cross-check against the verdict tally above)${rotatedNote}, ${t.findingsGapEchoes} gap echo(es) `
            + `vs ${t.gaps} verdict-log gap(s)${surplusNote}, ${t.findingsStaleEchoes} stale echo(es) `
            + `vs ${t.staleStretches} verdict-log stale record(s)`);
        if (result.findingsRefused) {
            lines.push('some findings data could not be read (see "file(s) refused or unreadable" below)');
        }
    }

    lines.push(`this rollup's own log files: ${t.malformed} malformed line(s); unrecognized schema version `
        + `(verdict logs ${t.verdictSchemaUnknown}, recognition logs ${t.recognitionSchemaUnknown}, findings ${t.findingsSchemaUnknown}); `
        + `unrecognized record type (verdict logs ${t.verdictTypeUnknown}, recognition logs ${t.recognitionTypeUnknown}, findings ${t.findingsTypeUnknown})`);
    lines.push(`file(s) refused or unreadable (a link, a non-regular file, or a genuine read failure): ${t.unreadableFiles}`);
    lines.push('');

    lines.push("== daemon's own counters (logs/offsets.json, apart from this rollup's own parse counts above) ==");
    if (result.daemonState.refused) {
        lines.push('(the state file position could not be read: a link or a non-regular file, refused; see "file(s) refused or unreadable" above)');
    } else if (!result.daemonState.present) {
        lines.push('(no state file yet: the daemon has not run against this state dir)');
    } else {
        if (result.daemonState.reset) {
            lines.push(`note: this state file was reset on its last load (${result.daemonState.detail}); the counters below started over from zero at that point`);
        }
        const c = result.daemonState.counters;
        lines.push(`spool lines: parsed ${c.parsed}, judged ${c.judged}, stale ${c.stale}, blank ${c.blank}, malformed ${c.malformed}, `
            + `unknown version ${c.unknownVersion}, oversized ${c.oversized}, gapped ${c.gapped}`);
        lines.push(`recognition: recognized ${c.recognized}, pointed ${c.pointed}, invented ${c.invented}, `
            + `gapped ${c.recognitionGapped}, skipped (no index) ${c.recognitionSkipped}, unavailable ${c.recognitionUnavailable}`);
        lines.push(`resets: offset resets ${c.offsetResets}, state resets ${c.stateResets}`);
        lines.push(`write failures: ${c.writeFailures}${c.writeFailures > 0 ? ' (this rollup\'s own totals above are incomplete by that many records)' : ''}`);
    }
    lines.push('');

    lines.push('== per session ==');
    const slugs = Array.from(result.sessions.keys()).sort();
    if (slugs.length === 0) {
        lines.push('(no sessions observed)');
    } else {
        for (const slug of slugs) lines.push(formatSessionLine(slug, result.sessions.get(slug)));
    }
    lines.push('');

    lines.push('== per day (UTC; verdicts and recognition bucket by the call\'s own capturedAt, '
        + 'gaps, stale records and recognition-gaps bucket by when the daemon wrote the record, of necessity) ==');
    const dayKeys = Array.from(result.days.keys()).sort();
    renderCappedList(lines, dayKeys, '(no dated records)', (day) => formatSessionLine(day, result.days.get(day)));
    lines.push('');

    lines.push('== judgment gap ranges ==');
    renderCappedList(lines, result.gapRanges, '(none)',
        (g) => `[${g.day}] ${g.slug}: ${g.note}${g.detail ? ` (${g.detail})` : ''}`);
    lines.push('');

    lines.push('== stale skips (calls dropped past the freshness horizon, never judged) ==');
    renderCappedList(lines, result.staleRanges, '(none)',
        (s) => `[${s.day}] ${s.slug}: ${s.note}${s.captured ? ` (captured ${s.captured})` : ''}`);
    lines.push('');

    lines.push('== recognition gaps (per call, no range) ==');
    renderCappedList(lines, result.recognitionGapEntries, '(none)',
        (g) => `[${g.day}] ${g.slug}: ${g.note}`);
    lines.push('');

    lines.push('== delivered / queued pointers (inbox) ==');
    lines.push(DELIVERED_LINE);
    if (!result.inbox.present) {
        lines.push('inbox directory not present: the delivery valve is dormant on this state dir');
    } else if (result.inbox.sessions.length === 0) {
        lines.push('(no inbox queues)');
    } else {
        for (const s of result.inbox.sessions) {
            const note = s.slug === 'no-session'
                ? ' (undeliverable: the valve refuses to deliver this shared bucket to anyone, per CONTRACT.md)'
                : '';
            lines.push(`${s.slug}: delivered ${s.delivered}, queued ${s.queued}${note}`);
        }
        lines.push(`total: delivered ${result.inbox.totalDelivered}, queued ${result.inbox.totalQueued}`);
    }
    lines.push('');

    lines.push(TAMPER_LINE);
    return lines.join('\n');
}

function main(argv) {
    const parsed = parseArgs(argv);
    if (!parsed.ok) {
        process.stderr.write(`kit-sidecar-rollup: ${parsed.error}\n\n${USAGE}\n`);
        return 2;
    }
    if (parsed.options.help) {
        process.stdout.write(`${USAGE}\n`);
        return 0;
    }

    const stateDir = (typeof parsed.options.stateDir === 'string' && parsed.options.stateDir !== '')
        ? path.resolve(parsed.options.stateDir) : config.defaultStateDir();
    const result = computeRollup(stateDir);
    if (!result.ok) {
        process.stderr.write(`kit-sidecar-rollup: ${result.reason}\n`);
        return 1;
    }
    process.stdout.write(`${render(result)}\n`);
    return 0;
}

if (require.main === module) {
    process.exitCode = main(process.argv.slice(2));
}

module.exports = {
    TOOL_SCOPE_LINE,
    TAMPER_LINE,
    DELIVERED_LINE,
    OFFSET_FILE_MAX_BYTES,
    MAX_LIST_ROWS,
    parseArgs,
    USAGE,
    computeRollup,
    inboxCounts,
    render,
    main
};
