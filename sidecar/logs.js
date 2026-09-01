// The daemon's writing side: the persisted offset state, the per-session
// verdict logs, and the findings file.
//
// Everything lives under `<stateDir>/logs/`, per sidecar/CONTRACT.md:
//
//   logs/offsets.json            the offset map, the cumulative counters, and
//                                the delivery keys already queued
//   logs/verdicts-<sid>.jsonl    one file per observed session
//   logs/recognition-<sid>.jsonl what the memory index said about that session's
//                                calls, one file per observed session
//   logs/findings.jsonl          diverged verdicts, every judgment gap and
//                                every stale record, the audit surface
//
// These files are a second plaintext concentration beside the spool itself: a
// verdict record carries the intent the session wrote and a bounded preview of
// the command it ran, and a recognition record carries the same two fields
// beside the names of the memory records a call was pointed at. They are machine-local, never synced and never committed,
// the preview is bounded rather than whole, and they expire on the spool's own
// window: sweepLogs below is what keeps the second copy from outliving the
// first, since the day the spool file goes is the day the preview in a log
// becomes the only copy there is.
//
// Nothing here throws at its caller. A log that cannot be written is reported
// on stderr and counted; it never aborts a drain, because the alternative is a
// daemon that stops judging because it could not write about judging.
//
// A gap is the load-bearing record in this file. When the endpoint cannot
// answer, the calls in that stretch are recorded as NOT JUDGED, with the range
// and the reason, in both the session's own log and the findings file. That is
// the difference between an instrument that reports a cannot-measure and one
// whose silence reads as a clean bill of health, and it is why the gap is
// written to the session log as well: a reader of one session's verdicts must
// see the hole without being asked to cross-reference a second file.
//
// The stale record is the same load-bearing shape for the other way a call ends
// with no verdict: the drain reached it past the freshness horizon and declined
// to judge it. It is a separate record type from a gap, and deliberately, since
// a stretch nobody could measure and a stretch nobody chose to measure call for
// opposite responses from the reader who finds them.

'use strict';

const fs = require('fs');
const path = require('path');

// The record schema version for the daemon's own logs. Independent of the spool
// line's version: they are different contracts with different writers.
const LOG_VERSION = 1;

// The command preview kept in a verdict record. Enough to recognize which call
// a verdict belongs to when reading the log by eye; short enough that the log
// is not a second copy of the spool.
const COMMAND_PREVIEW_CHARS = 200;

// How many delivered call ids the state carries. The set is what stops one
// call's inbox item from being written twice when a spool file is re-read from
// zero, which the contract names as an expected event; bounding it is what
// stops the state file from growing for as long as the daemon runs. Only
// diverged verdicts enter it, so five hundred and twelve ids covers a long
// stretch of findings, and past the bound the oldest fall off and a reset
// reaching further back than that can queue one duplicate pointer.
const DELIVERED_MAX = 512;

// The longest session id accepted into a file name, before the prefix and the
// extension. A session id is an opaque string from another process, so it is
// treated as untrusted input to a path even though the harness's own ids are
// tame.
const SESSION_NAME_CAP = 80;

// One directory, checked and created if absent.
//
// lstatSync, never statSync: stat follows links, so a symlink or a Windows
// directory junction planted at the logs path answers isDirectory() with the
// target's type and every verdict would be written through the link into
// whatever it points at. A junction needs no elevation to create. The refusal
// is reported and the daemon stands down rather than writing through it, since
// a log written somewhere nobody expects is worse than no log at all.
function ensureDirStep(dir, recursive) {
    let st = null;
    try {
        st = fs.lstatSync(dir);
    } catch (err) {
        const code = (err && typeof err.code === 'string') ? err.code : '';
        if (code !== 'ENOENT') return { ok: false, reason: `cannot inspect ${dir}: ${code || 'lstat failed'}` };
        try {
            // 0700, matching the files written inside it. What lives here is a
            // plaintext record of what the fleet ran and what came back, and the
            // file names alone name every session observed on this machine. On
            // POSIX the mode is honored; on Windows Node maps it to the
            // read-only attribute alone and the protection is the profile
            // directory's ACL, exactly as the spool's own 0600 behaves.
            fs.mkdirSync(dir, { recursive: recursive === true, mode: 0o700 });
            return { ok: true, created: true };
        } catch (mkErr) {
            const mkCode = (mkErr && typeof mkErr.code === 'string') ? mkErr.code : 'mkdir failed';
            return { ok: false, reason: `cannot create ${dir}: ${mkCode}` };
        }
    }
    if (st.isSymbolicLink() || !st.isDirectory()) {
        return { ok: false, reason: `${dir} is not a real directory, so nothing is written through it` };
    }
    return { ok: true, created: false };
}

// A directory the daemon or a fixture writer will write into, created if
// absent, with every component BELOW `guardFrom` checked on its own.
//
// A containment screen answers about the path it was handed and says nothing
// about anything created beneath it afterwards. `mkdir -p` follows a reparse
// point on any intermediate component it does not have to create, so a junction
// planted one level under a screened root routes the whole write wherever it
// points while the run prints the sentence saying the root was screened and
// found outside. Checking only the leaf cannot see that: the leaf is absent, so
// its lstat is ENOENT and the recursive mkdir walks through the link.
//
// `guardFrom` is the path a caller has already established, which for
// sidecar/battery.js is the screened --state-dir. It is checked by
// ensureDirStep like every component below it, so a `guardFrom` that is itself
// a symlink or a junction is REFUSED and nothing is written through it. That
// costs a root reached through a link the containment screen resolved and found
// outside the live tree: such a root passes the screen and is then refused
// here, and the run stops with "cannot use the state root" after printing the
// sentence saying the root was screened. Refusing is the direction this file
// takes everywhere, since a write through a reparse point lands somewhere
// nobody named, and an operator whose state root is reached through a link
// spells the resolved path instead.
//
// WHAT THIS WALK IS AND IS NOT. Each component is checked with lstat, which
// refuses a reparse point: a symlink or a Windows junction. That is strictly
// weaker than sidecar/state-screen.js's identity containment, which decides on
// (dev, ino) and so catches an alias carrying no reparse point at all, a Linux
// bind mount being the case in reach. So this closes Standing Brief Amendment
// 7's class for the link shapes an unprivileged user can plant, not for every
// aliasing a privileged one can.
//
// Called without `guardFrom`, this is a single leaf check and a recursive
// create, which is what the daemon's own state paths take.
function ensureDir(dir, guardFrom) {
    const target = path.resolve(dir);
    if (typeof guardFrom !== 'string' || guardFrom === '') return ensureDirStep(target, true);
    const base = path.resolve(guardFrom);
    const rel = path.relative(base, target);
    // A target that is not under the base is REFUSED, never quietly handed the
    // permissive recursive create. A caller passing `guardFrom` is asking for
    // the per-component walk, and answering a path the walk cannot cover with
    // the unguarded `mkdir -p` is the shape where a guard becomes no guard
    // without saying so.
    //
    // `path.relative` returns an absolute path when the two spellings have
    // different root kinds, and a `..` SEGMENT is the only relative segment
    // that escapes, so both are read here rather than by leading characters.
    // An empty `rel` is the base itself, which is not an escape.
    const segments = rel === '' ? [] : rel.split(/[\\/]/);
    if (path.isAbsolute(rel) || segments.includes('..')) {
        return { ok: false, reason: `${target} is not under ${base}, so the per-component guard cannot cover it` };
    }
    const first = ensureDirStep(base, true);
    if (!first.ok) return first;
    let created = first.created;
    let cur = base;
    for (const segment of segments) {
        cur = path.join(cur, segment);
        const step = ensureDirStep(cur, false);
        if (!step.ok) return step;
        created = created || step.created;
    }
    return { ok: true, created };
}

// A path a writer in this tree is about to write a file to, checked once for
// every shape that would send those bytes somewhere other than a fresh or
// ordinary file at that name.
//
// This lives here, at the boundary every writer in this tree shares, rather
// than inside the command that needed it first: a guard held by one producer is
// one the next author reimplements by not implementing it. Every file this
// directory writes passes through it. sidecar/harvest.js's --out and
// sidecar/battery.js's two files under --state-dir call it directly, and
// appendJsonLine and saveState below call it on each write of their own, which
// covers the daemon's verdict logs, its recognition logs, the shared findings
// file, the offset state's temporary sibling, and every inbox item
// (sidecar/inbox.js appends through appendJsonLine and holds no guard of its
// own).
//
// The daemon's own files are the ones that most need it, because their names
// are FIXED and derivable: sidecar/config.js spells findings.jsonl and
// offsets.json under whatever --state-dir a caller supplied, so a link planted
// at either name is waiting before the write rather than racing it, unlike the
// per-run token-stamped session logs.
//
// The hard-link case is the one a containment screen cannot reach. A second
// name for one inode, made from inside a store the write must not touch to a
// name outside it, resolves to the outside name, screens clean, and then takes
// the write: an append reaches every other name for that inode and a rewrite
// replaces the bytes all of them read. `nlink` is a fact about a file that
// already exists, so it belongs at the moment of the write rather than in a
// predicate over a path that usually does not exist yet.
//
// lstat, never stat: stat follows the link the refusal exists for. `kind` is
// returned rather than a finished sentence so each caller keeps its own voice.
function guardWriteTarget(file) {
    let st = null;
    try {
        st = fs.lstatSync(file);
    } catch (err) {
        const code = (err && typeof err.code === 'string') ? err.code : '';
        // Absent is the ordinary case: the file is about to be created.
        if (code === 'ENOENT') return { ok: true, kind: 'absent' };
        return { ok: false, kind: 'unreadable', code: code || 'lstat failed' };
    }
    if (st.isSymbolicLink()) return { ok: false, kind: 'symlink', stat: st };
    if (!st.isFile()) return { ok: false, kind: 'irregular', stat: st };
    if (st.nlink > 1) return { ok: false, kind: 'hardlinked', nlink: st.nlink, stat: st };
    return { ok: true, kind: 'file', stat: st };
}

// A session id as one path component. Every character outside a conservative
// set becomes an underscore, so no separator, no drive letter and no dot run
// survives into the name; the fixed prefix and extension mean the result can
// never be `.` or `..` whatever came in. An empty or all-punctuation id becomes
// a named bucket rather than an empty one, because the spool records '' for a
// payload that carried no session id and those verdicts still need a home.
function sessionSlug(sessionId) {
    const raw = typeof sessionId === 'string' ? sessionId : '';
    const safe = raw.replace(/[^A-Za-z0-9._-]/g, '_').slice(0, SESSION_NAME_CAP);
    if (safe === '' || /^[._]+$/.test(safe)) return 'no-session';
    return safe;
}

function sessionLogFile(logsDir, sessionId) {
    return path.join(logsDir, `verdicts-${sessionSlug(sessionId)}.jsonl`);
}

// The recognition log for one session, beside its verdict log. Two files rather
// than one because they answer different questions and are read by different
// readers: a verdict log is the record of whether calls did what they meant to,
// and a recognition log is the record of what the project's memory had to say
// about them. Both take the same session slug, so a reader holding one file
// name holds the other.
function recognitionLogFile(logsDir, sessionId) {
    return path.join(logsDir, `recognition-${sessionSlug(sessionId)}.jsonl`);
}

// Append one JSON line. Returns whether it landed; a failure is the caller's to
// report and count, never an exception to unwind a drain with.
//
// The write-target guard runs on every append, not once at startup. The names
// here are fixed and predictable under a caller-supplied --state-dir, so a
// symlink, a junction or a second hard link planted at one of them would
// otherwise take every record appended through it: an append reaches every
// name for an inode, and what these records carry is the working directory, the
// stated intent, a command preview and the model's reason for each call. A
// refusal is a failed write, counted and reported like any other rather than
// thrown, because a daemon that stops judging because it could not write about
// judging is the failure this file rules out.
function appendJsonLine(file, record) {
    let line = '';
    try {
        line = JSON.stringify(record);
    } catch {
        return false;
    }
    if (!guardWriteTarget(file).ok) return false;
    try {
        fs.appendFileSync(file, line + '\n', { encoding: 'utf8', mode: 0o600 });
        return true;
    } catch {
        return false;
    }
}

// The empty state. Counters are cumulative across runs and are the skip counts
// the contract requires a consumer to keep: a rising malformed count is the
// only signal that the interleave mitigation has stopped working, and it says
// nothing at all if every run starts it at zero.
function emptyState() {
    return {
        v: LOG_VERSION,
        offsets: {},
        // Call ids whose delivery item is already in an inbox, oldest first.
        delivered: [],
        counters: {
            // Lines that parsed into a call to judge. The PARSE skip categories
            // (`blank`, `malformed`, `unknownVersion`, `oversized`) are counted
            // apart from it, so `parsed` plus those is what the daemon actually
            // read off the spool.
            //
            // `stale` is the exception and sits INSIDE `parsed` rather than
            // beside it: a stale entry parsed fine and was then dropped on its
            // age, which is a decision about a good line rather than a line that
            // could not be read. What every parsed call is accounted for by is
            // `parsed` = `judged` + `stale` + `gapped`.
            parsed: 0,
            judged: 0,
            // Calls the drain reached past the freshness horizon and skipped
            // whole: no judgment call, no recognition call, no verdict. Counted
            // apart from `judged` because nothing was measured, and apart from
            // `gapped` because nothing failed. Folding it into either would
            // report a discarded backlog as a quiet fleet, which is the one
            // reading this daemon exists to make impossible.
            stale: 0,
            blank: 0,
            malformed: 0,
            unknownVersion: 0,
            oversized: 0,
            offsetResets: 0,
            stateResets: 0,
            gapped: 0,
            // The recognition duty's own counts, apart from the judgment's
            // because they answer different questions. `recognized` is calls a
            // recognition answer came back for, `pointed` is memory pointers
            // queued (dedup drops the rest), `invented` is names returned that
            // the index that produced them does not hold, `recognitionGapped`
            // is calls recognition could not be measured for,
            // `recognitionSkipped` is calls whose project has no index to ask
            // about, which is the ordinary case and costs no call at all, and
            // `recognitionUnavailable` is calls where the resolver itself could
            // not answer: no usable memq, no project for the working directory,
            // or an index file that is there and unreadable. The last two are
            // apart because a quiet store and a broken instrument look the same
            // in a single number, and only one of them is somebody's to fix.
            recognized: 0,
            pointed: 0,
            invented: 0,
            recognitionGapped: 0,
            recognitionSkipped: 0,
            recognitionUnavailable: 0,
            writeFailures: 0,
            // Failed writes of the daemon's liveness stamp, counted apart from
            // `writeFailures` because they cost a different thing. Every other
            // write this daemon makes carries a record, so a failure there is a
            // record that is gone and both shipped consumers say so: the rollup
            // renders `writeFailures` as "these totals are incomplete by that
            // many records" and the battery reads any rise in it as a
            // cannot-measure. A heartbeat that could not be written loses no
            // record at all. What it costs is a reader's ability to tell this
            // daemon from a stopped one, which is worth counting and is not
            // worth telling a rollup its verdict counts are short.
            heartbeatFailures: 0
        }
    };
}

// The persisted state, or a fresh one. A corrupt or truncated state file is
// reported and replaced rather than repaired: the cost of starting from zero
// offsets is judging some calls twice, which is a duplicate record, while the
// cost of trusting a half-written map is reading from the middle of a line. The
// caller reports the reset loudly and the counter keeps it in the record.
function loadState(stateFile) {
    let raw = '';
    try {
        raw = fs.readFileSync(stateFile, 'utf8');
    } catch (err) {
        const code = (err && typeof err.code === 'string') ? err.code : '';
        if (code === 'ENOENT') return { state: emptyState(), reset: false };
        return { state: emptyState(), reset: true, detail: `state unreadable: ${code || 'read failed'}` };
    }
    let parsed = null;
    try {
        parsed = JSON.parse(raw);
    } catch {
        return { state: emptyState(), reset: true, detail: 'state file is not JSON' };
    }
    if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
        return { state: emptyState(), reset: true, detail: 'state file is not a JSON object' };
    }
    // A state file written under a different schema version is not this
    // daemon's to interpret. Its offsets are numbers whose meaning belongs to
    // the version that wrote them, and reading them as v1 byte offsets is how a
    // resume lands in the middle of a line. Starting over costs duplicate
    // verdicts, which is the cheaper of the two.
    if (parsed.v !== LOG_VERSION) {
        return { state: emptyState(), reset: true, detail: `state file is version ${JSON.stringify(parsed.v)}, not ${LOG_VERSION}` };
    }
    const state = emptyState();
    const offsets = parsed.offsets;
    if (offsets !== null && typeof offsets === 'object' && !Array.isArray(offsets)) {
        for (const [name, value] of Object.entries(offsets)) {
            // A non-integer or negative offset is not an offset. Dropping the
            // entry restarts that one file at 0, which re-judges rather than
            // reading from a position nothing can vouch for.
            if (Number.isInteger(value) && value >= 0) state.offsets[name] = value;
        }
    }
    // A delivered set that is not a list of strings is no set at all, and the
    // tail is what is kept when a file carries more than the bound: the ids at
    // the end are the recent ones, which are the ones a spool reset can reach.
    if (Array.isArray(parsed.delivered)) {
        state.delivered = parsed.delivered
            .filter((id) => typeof id === 'string' && id !== '')
            .slice(-DELIVERED_MAX);
    }
    const counters = parsed.counters;
    if (counters !== null && typeof counters === 'object' && !Array.isArray(counters)) {
        for (const key of Object.keys(state.counters)) {
            if (Number.isFinite(counters[key]) && counters[key] >= 0) state.counters[key] = counters[key];
        }
    }
    return { state, reset: false };
}

// Persist the state by writing a sibling and renaming over the target. The
// daemon saves after every judged line, so a kill between two calls costs at
// most a re-judged duplicate; a half-written map at that same moment would cost
// a resume from the middle of a line, which is why the write is not in place.
//
// The temporary sibling takes the same write-target guard the appends take, and
// for the sharper version of the same reason: `<state-dir>/logs/offsets.json`
// is a fixed name, so `.tmp` beside it is a fixed name too, and it is the one
// path here that is written with writeFileSync rather than appended to, so a
// second hard link at it would have every other name for that inode REPLACED
// rather than added to. The rename that follows is what makes the target file
// itself fresh, so the guard belongs on the sibling.
function saveState(stateFile, state) {
    const tmp = `${stateFile}.tmp`;
    if (!guardWriteTarget(tmp).ok) return false;
    try {
        fs.writeFileSync(tmp, JSON.stringify(state), { encoding: 'utf8', mode: 0o600 });
        fs.renameSync(tmp, stateFile);
        return true;
    } catch {
        try { fs.unlinkSync(tmp); } catch { /* the rename is what mattered */ }
        return false;
    }
}

function commandPreview(command) {
    const text = typeof command === 'string' ? command : '';
    const oneLine = text.replace(/\s+/g, ' ').trim();
    return oneLine.slice(0, COMMAND_PREVIEW_CHARS);
}

// A judged call, for the session log. `promptId` and `model` ride in every
// record because a verdict is only comparable to another verdict produced by
// the same prompt against the same model.
function verdictRecord(entry, judged, meta) {
    return {
        v: LOG_VERSION,
        type: 'verdict',
        ts: new Date(meta.nowMs).toISOString(),
        callId: entry.callId,
        capturedAt: entry.ts,
        sessionId: entry.sessionId,
        cwd: entry.cwd,
        tool: entry.tool,
        intent: entry.intent,
        commandPreview: commandPreview(entry.command),
        isError: entry.isError,
        truncated: entry.truncated,
        verdict: judged.verdict,
        reason: judged.reason,
        reasonTruncated: judged.reasonTruncated === true,
        promptId: meta.promptId,
        model: meta.model,
        // Which endpoint answered, as a truncated hash of its host and never as
        // its address. A verdict is only comparable to another verdict from the
        // same prompt and the same model, and a run of records whose endpoint
        // fingerprint changed is a run that was judged somewhere else.
        endpoint: typeof meta.endpoint === 'string' ? meta.endpoint : '',
        latencyMs: judged.latencyMs
    };
}

// What the project's memory said about one call, for the recognition log.
// `promptId` and `model` ride in every record for the verdict record's reason:
// an answer is only comparable to another answer produced by the same prompt
// against the same model. `records` is what the index was asked about and
// answered with, `queued` is the subset that became a pointer (dedup holds the
// rest back), and `invented` is what the model named that the index does not
// hold, kept in the record rather than only counted: a rising invented count
// with an empty record is a prompt or a model that has drifted, and a reader
// cannot tell which without the names.
//
// `indexRecords` and `indexTruncated` describe the list the answer was formed
// against, and they are two different facts. The count says how many records
// were shown; the flag says the store holds more than that, because the index
// was cut at the reader's line bound or its byte cap. An empty answer against a
// cut index is a weaker statement than an empty answer against a whole one, and
// a reader with the count alone cannot tell the two apart.
//
// NAMES, NEVER BODIES, here as everywhere. A record's text is not read by this
// daemon and appears in no log it writes.
function recognitionRecord(entry, result, meta) {
    return {
        v: LOG_VERSION,
        type: 'recognition',
        ts: new Date(meta.nowMs).toISOString(),
        callId: entry.callId,
        capturedAt: entry.ts,
        sessionId: entry.sessionId,
        cwd: entry.cwd,
        tool: entry.tool,
        intent: entry.intent,
        commandPreview: commandPreview(entry.command),
        records: Array.isArray(result.records) ? result.records.slice() : [],
        queued: Array.isArray(meta.queued) ? meta.queued.slice() : [],
        invented: Array.isArray(result.invented) ? result.invented.slice() : [],
        reason: typeof result.reason === 'string' ? result.reason : '',
        reasonTruncated: result.reasonTruncated === true,
        indexRecords: Number.isInteger(meta.indexRecords) ? meta.indexRecords : 0,
        indexTruncated: meta.indexTruncated === true,
        promptId: meta.promptId,
        model: meta.model,
        endpoint: typeof meta.endpoint === 'string' ? meta.endpoint : '',
        latencyMs: result.latencyMs
    };
}

// One call the memory index was not consulted about, with the reason.
//
// It exists for the reason gapRecord exists: an instrument that went quiet
// while the endpoint was down would report a project with nothing to say, and a
// project with nothing to say is exactly what an unmeasured one looks like. The
// note says NOT RECOGNIZED rather than anything a reader could mistake for an
// empty answer, which is the normal result and a different fact entirely.
//
// One call rather than a range, unlike gapRecord: this record is written as the
// call is read, so a run of them is a run of lines, and the offset behind them
// never waits on a window that has not closed.
function recognitionGapRecord(gap, nowMs) {
    return {
        v: LOG_VERSION,
        type: 'recognition-gap',
        ts: new Date(nowMs).toISOString(),
        sessionId: gap.sessionId,
        callId: gap.callId,
        reason: gap.reason,
        detail: gap.detail || '',
        note: `call ${gap.callId} not recognized, ${gap.reason}`
    };
}

// A finding, for the findings file: a diverged verdict, the quiet failure this
// instrument exists to make countable.
function findingRecord(record) {
    return {
        v: LOG_VERSION,
        type: 'diverged',
        ts: record.ts,
        callId: record.callId,
        sessionId: record.sessionId,
        cwd: record.cwd,
        intent: record.intent,
        commandPreview: record.commandPreview,
        reason: record.reason,
        promptId: record.promptId,
        model: record.model,
        endpoint: record.endpoint
    };
}

// The daemon's own logs expire, on the same window as the spool.
//
// The verdict logs and the findings file are a second plaintext concentration of
// command text under the user's home directory, one file per session id, and
// nothing else ever deletes them. The bounded command preview is justified by
// the full command already sitting in the spool, which stops being true on the
// day retention deletes that day file: after it, the preview in a log is the
// only copy left and it would otherwise be permanent. So the same window governs
// both, and the daemon sweeps its own logs whenever it runs retention.
//
// A verdict log's mtime is the moment it last took a record, so an active
// session's log is young however old its session is.
const FINDINGS_NAME = 'findings.jsonl';
const FINDINGS_ROTATED_NAME = 'findings.jsonl.1';

// The size at which the findings file is rotated. Findings are the audit
// surface, so the file is the one thing here that grows with the fleet rather
// than with the calendar: a rollup reads it, nothing prunes it, and a diverged
// verdict lands in it for as long as the daemon runs. Rotating to one previous
// generation bounds the concentration at twice this without discarding the
// recent past, and the previous generation expires on the window like the rest.
const FINDINGS_MAX_BYTES = 4 * 1024 * 1024;

const VERDICT_LOG_RE = /^verdicts-[A-Za-z0-9._-]+\.jsonl$/;

// The recognition logs expire on the same window and in the same pass as the
// verdict logs. They are the same kind of concentration, an intent and a
// bounded command preview per call, and a per-file-kind sweep that expired one
// and not the other would leave the newer surface permanent for no reason a
// reader could find.
const RECOGNITION_LOG_RE = /^recognition-[A-Za-z0-9._-]+\.jsonl$/;

const MS_PER_DAY_LOGS = 24 * 60 * 60 * 1000;

// Delete expired verdict logs, expired recognition logs and the expired rotated
// findings file, and rotate
// findings.jsonl when it is past its bound. Never throws; reports what it did,
// what it refused to do and why, on the same footing as the spool's retention:
// a sweep that silently deleted nothing and one that silently deleted the lot
// look identical from outside.
function sweepLogs(logsDir, options) {
    const opts = options || {};
    const nowMs = opts.nowMs === undefined ? Date.now() : opts.nowMs;
    const days = opts.retentionDays === undefined ? 14 : opts.retentionDays;
    const report = { deleted: [], failed: [], rotated: null, skipped: null };

    if (!Number.isFinite(nowMs) || nowMs <= 0 || !Number.isInteger(days) || days < 1 || days > 3650) {
        report.skipped = 'no usable retention window, so no log was deleted';
        return report;
    }
    const cutoffMs = nowMs - (days * MS_PER_DAY_LOGS);

    let names = [];
    try {
        names = fs.readdirSync(logsDir);
    } catch {
        report.skipped = 'logs directory unreadable, so no log was deleted';
        return report;
    }

    for (const name of names) {
        if (!VERDICT_LOG_RE.test(name) && !RECOGNITION_LOG_RE.test(name) && name !== FINDINGS_ROTATED_NAME) continue;
        const file = path.join(logsDir, name);
        let st = null;
        try { st = fs.lstatSync(file); } catch { continue; }
        if (!st.isFile() || st.isSymbolicLink()) continue;
        if (st.mtimeMs >= cutoffMs) continue;
        try {
            fs.unlinkSync(file);
            report.deleted.push(name);
        } catch (err) {
            report.failed.push({ name, detail: (err && err.code) ? err.code : 'unlink failed' });
        }
    }

    const findings = path.join(logsDir, FINDINGS_NAME);
    let fst = null;
    try { fst = fs.lstatSync(findings); } catch { fst = null; }
    if (fst !== null && fst.isFile() && !fst.isSymbolicLink() && fst.size > FINDINGS_MAX_BYTES) {
        try {
            fs.renameSync(findings, path.join(logsDir, FINDINGS_ROTATED_NAME));
            report.rotated = FINDINGS_ROTATED_NAME;
        } catch (err) {
            report.failed.push({ name: FINDINGS_NAME, detail: (err && err.code) ? err.code : 'rename failed' });
        }
    }
    return report;
}

// The sentence a gap record's `note` states, built from its structured fields.
// Exported so this is the ONLY place that spells it: gapRecord below calls it
// to write the note, and sidecar/rollup.js calls it again to reconstruct the
// sentence for a hand-written line that carries the structured fields but no
// `note` of its own. Before this export existed, rollup.js re-implemented the
// sentence and the test fixtures spelled it a third time, so a wording change
// here could drift into two different reports with no test able to see it.
//
// Defensive against a hand-written or otherwise stripped record: a missing or
// invalid `count` defaults to 1 (a single call), never to 0, because a rollup
// tallying the same record's call count uses the same default and the two
// numbers disagreeing is exactly the mismatch this shared builder exists to
// close.
function gapNote(fields) {
    const count = (Number.isInteger(fields.count) && fields.count > 0) ? fields.count : 1;
    const first = (typeof fields.firstCallId === 'string' && fields.firstCallId !== '') ? fields.firstCallId : '?';
    const last = (typeof fields.lastCallId === 'string' && fields.lastCallId !== '') ? fields.lastCallId : '?';
    const reason = (typeof fields.reason === 'string' && fields.reason !== '') ? fields.reason : 'unknown reason';
    const range = count === 1 ? `call ${first}` : `calls ${first} to ${last}`;
    return `${range} not judged, ${reason}`;
}

// The freshness horizon as a sentence fragment, from the same milliseconds the
// comparison uses. Exact minutes when the window divides into them and raw
// milliseconds when it does not, because a horizon set programmatically to 90
// seconds rounded to "2 minutes" would put a number in the record and on stderr
// that no code in this daemon ever compared anything against.
//
// Exported so this is the only place that spells it: the daemon's per-pass
// report line and the stale record's note both call it, and a second spelling
// is how two surfaces come to describe the same window differently.
function horizonText(horizonMs) {
    if (!Number.isFinite(horizonMs) || horizonMs <= 0) return 'unset';
    if (horizonMs % 60000 === 0) return `${horizonMs / 60000}-minute`;
    return `${horizonMs} ms`;
}

// The sentence a stale record's `note` states, built from its structured
// fields, on gapNote's terms and for gapNote's reason: rollup.js reconstructs
// it for a record that carries the fields and no note, so the wording lives
// here once.
//
// It says SKIPPED and names the horizon, never "not judged". A stale stretch
// and an endpoint gap are both stretches of calls with no verdict, and a reader
// who cannot tell them apart cannot tell an instrument that failed from one
// that declined: the first is somebody's to repair and the second is the design
// working.
function staleNote(fields) {
    const count = (Number.isInteger(fields.count) && fields.count > 0) ? fields.count : 1;
    const first = (typeof fields.firstCallId === 'string' && fields.firstCallId !== '') ? fields.firstCallId : '?';
    const last = (typeof fields.lastCallId === 'string' && fields.lastCallId !== '') ? fields.lastCallId : '?';
    const range = count === 1 ? `call ${first}` : `calls ${first} to ${last}`;
    return `${range} skipped, captured further back than the ${horizonText(fields.horizonMs)} freshness horizon`;
}

// A contiguous stretch of one session's calls that were skipped for age, in the
// gap record's shape and written to the same two files.
//
// It exists because the counter alone cannot be attributed. A rollup reads per
// session and per day, and a discarded backlog that appears only as a machine-
// wide count renders in both of those sections exactly as a fleet that made no
// calls at all. That is the reading the gap machinery exists to prevent, and an
// entry dropped by policy needs it as much as one dropped by an outage.
//
// `firstCapturedAt` and `lastCapturedAt` are the spool's own timestamps for the
// ends of the stretch, which is what makes the record answer HOW old rather
// than only how many; they are structured fields rather than words in the note
// because they are spool content, and a reader that prints them neutralizes
// them as it does every other field that came off a captured line.
function staleRecord(stretch, nowMs) {
    return {
        v: LOG_VERSION,
        type: 'stale',
        ts: new Date(nowMs).toISOString(),
        sessionId: stretch.sessionId,
        reason: 'stale',
        count: stretch.count,
        firstCallId: stretch.firstCallId,
        lastCallId: stretch.lastCallId,
        firstCapturedAt: typeof stretch.firstCapturedAt === 'string' ? stretch.firstCapturedAt : '',
        lastCapturedAt: typeof stretch.lastCapturedAt === 'string' ? stretch.lastCapturedAt : '',
        horizonMs: Number.isFinite(stretch.horizonMs) ? stretch.horizonMs : 0,
        note: staleNote(stretch)
    };
}

// A stretch of calls that were not judged, with the reason. The note is the
// sentence a person reads in a rollup; the structured fields are what a rollup
// counts. Both say NOT JUDGED rather than anything a reader could mistake for a
// verdict.
function gapRecord(gap, nowMs) {
    return {
        v: LOG_VERSION,
        type: 'gap',
        ts: new Date(nowMs).toISOString(),
        sessionId: gap.sessionId,
        reason: gap.reason,
        count: gap.count,
        firstCallId: gap.firstCallId,
        lastCallId: gap.lastCallId,
        detail: gap.detail || '',
        note: gapNote(gap)
    };
}

module.exports = {
    LOG_VERSION,
    COMMAND_PREVIEW_CHARS,
    DELIVERED_MAX,
    SESSION_NAME_CAP,
    FINDINGS_NAME,
    FINDINGS_ROTATED_NAME,
    FINDINGS_MAX_BYTES,
    VERDICT_LOG_RE,
    RECOGNITION_LOG_RE,
    sweepLogs,
    ensureDir,
    guardWriteTarget,
    sessionSlug,
    sessionLogFile,
    recognitionLogFile,
    appendJsonLine,
    emptyState,
    loadState,
    saveState,
    commandPreview,
    verdictRecord,
    recognitionRecord,
    recognitionGapRecord,
    findingRecord,
    gapNote,
    gapRecord,
    horizonText,
    staleNote,
    staleRecord
};
