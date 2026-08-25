// Shared library for the kit-native goal continuity mechanism.
//
// Goal state is a small project-scoped JSON file (.kit/goal-state.json,
// gitignored) that survives a session swap because it lives in the repo, not
// in any one session's transcript. This module is the single owner of the
// canonical condition text (composeCondition) and the read/write/clear
// operations on that file, and of the machine-readable event stream
// (emitGoalEvent), which carries the releases the Stop hook itself observes; a
// manual clear through the CLI releases the leash without an event, since the
// user is already there for it. Consumed by kit-goal.js (the CLI), the
// /kit-goal skill, and the Stop hook that enforces the armed goal.
//
// Node core modules only, CommonJS, zero dependencies. Every exported
// function that touches the filesystem or parses data is wrapped so it never
// throws; a filesystem hiccup degrades to a null/false/default result instead
// of trapping the caller (the CLI and, eventually, the Stop hook, must never
// crash a session over a goal-state read).

'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');

// Path to the goal-state file for a given repo root.
function goalPath(cwd) {
    return path.join(cwd, '.kit', 'goal-state.json');
}

// The cap on a stored transcript path. Long enough for a real harness
// transcript path, short enough that no caller can pad the state file.
const TRANSCRIPT_MAX = 512;

// Whether a value is storable as boundTranscript: a non-empty string, within
// the cap, free of control characters, and not network-shaped (two leading
// separators: a UNC path or a //server form). The path is machine-local and
// lives in a gitignored file; it is only ever fs.stat'ed, never executed, and
// never surfaced raw. The control-character check is a sanitize-before-store
// guard (a newline would smuggle text into a file the hooks surface into the
// model's context). The network-path check narrows the hang surface of the
// stat, which runs synchronously at every SessionStart and blocks for the SMB
// timeout on an unreachable share: it rejects the UNC and //server forms, and
// only those. A path on a mapped network drive letter is indistinguishable
// from a local disk without a syscall, so it passes this check and can still
// hang the stat; that residual takes a hand-edited state file to reach, since
// the harness produces transcript paths under the local user profile.
function validTranscript(value) {
    return typeof value === 'string' && value !== '' && value.length <= TRANSCRIPT_MAX
        && !/[\x00-\x1F]/.test(value)
        && !/^[\\/]{2}/.test(value);
}

// The shape a harness session id has: a lowercase-or-uppercase UUID. This is
// the first of the two keys armGoal's arm-time bind requires, and it is only a
// shape: it cannot authenticate an id, since any 36-character UUID passes it.
// The second key is a transcript file on this machine that the id names (see
// armGoal), which is the evidence that the id belongs to a real local session.
// Both are required because an arm-time bind is not recoverable from the wrong
// value: a goal bound to a session that never stops is one the real run can
// never claim, because both fallback claim points (the first stop, the first
// auto-compaction offer) act only on an unbound goal, so the real run stays a
// bystander for the goal's whole life. Arming unbound costs nothing by
// comparison: the claim points bind it at the run's first stop. The residual
// the two keys leave is a stale id that still names a real local transcript
// (an id from an earlier session on this machine); that binds, and the operator
// re-arms to correct it.
//
// A value passing this gate is 36 printable ASCII characters, so it satisfies
// bindSession's storage rules (string, within the 128-character cap, no control
// characters) by construction, and carries no path separator.
const SESSION_ID_SHAPE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Whether a value has the shape of a harness session id. Exported so the CLI
// can test the shape before doing any filesystem work on the value, without a
// second copy of the grammar: one definition decides what both the CLI's
// transcript lookup and armGoal's bind answer to.
function isSessionIdShaped(value) {
    return typeof value === 'string' && SESSION_ID_SHAPE.test(value);
}

// Normalize a parsed goal state to the current shape, so every reader can rely
// on queue, queueIndex, history, and boundTranscript being present and on
// queue[queueIndex] === plan. Path fields are re-validated on every read, not
// only at write time: planHead joins plan (and the status report joins each
// queue entry) onto cwd and opens the result, so a hand-edited value that
// traverses out of the repo, or names a FIFO outside it, must never reach a
// reader. A plan that does not round-trip normalizePlanArg (that is, was not
// the product of armGoal's own normalization) makes the whole state
// malformed: readGoal returns null, every reader sees no armed goal, and the
// doctor, which reads the raw file, is the surface that flags the damage. A
// state file carrying no queue is a queue of one: plan is the authority on
// what is current, so a queue that is absent, malformed, carrying an entry
// that fails the same path rule, or disagreeing with plan is replaced by
// [plan] at index 0. Applied inside readGoal, so no caller sees the
// un-normalized shape.
function normalizeState(cwd, state) {
    if (!state || typeof state !== 'object' || typeof state.plan !== 'string' || state.plan === '') {
        return state;
    }
    if (normalizePlanArg(cwd, state.plan) !== state.plan) {
        return null;
    }
    const queue = state.queue;
    const index = state.queueIndex;
    const usable = Array.isArray(queue) && queue.length > 0
        && queue.every((p) => typeof p === 'string' && normalizePlanArg(cwd, p) === p)
        && Number.isInteger(index) && index >= 0 && index < queue.length
        && queue[index] === state.plan;
    if (!usable) {
        state.queue = [state.plan];
        state.queueIndex = 0;
    }
    if (!Array.isArray(state.history)) state.history = [];
    if (!validTranscript(state.boundTranscript)) state.boundTranscript = null;
    return state;
}

// The kind-and-size preamble the hardened readers in kit-compact-lib.js apply,
// and the temp-path helper its atomic writers share, spelled locally in this
// file.
//
// They are local copies rather than imports because the dependency runs the
// other way: kit-compact-lib.js destructures this module at its own load
// (`const { normalizePlanArg } = require('./kit-goal-lib.js')`), so a require
// back would be a genuine cycle, and because that destructure runs at load time
// one load order hands kit-compact-lib.js a half-built exports object with
// normalizePlanArg undefined. Every hook is its own entry point, so such a
// breakage follows load order rather than logic and appears in one hook and not
// another.
//
// The obligation covers those two helpers and nothing wider: regularFileSize and
// atomicTmpPath answer questions both files ask about their own state files, so
// a change to either copy belongs in both. It does not reach the writers around
// them, which answer to their own cadences: sweepStaleTmp below exists because
// this file's writers run often enough for an abandoned temp to matter, and a
// directory listing on every checkpoint write is a cost those cadences do not
// earn. The residual that leaves is real and named rather than dismissed: two
// legs still orphan a temp there (a process killed between the create and the
// rename, and a cleanup unlink that itself throws), the temp names are
// unguessable by design, and with no sweep on that side nothing reclaims one.
//
// readGoal calls the one definition below over the goal state file. Every
// question about an armed PLAN path goes through planFileSize and planPathState
// instead, which add the one resolution rule a plan doc needs, and those two are
// what planHead, armGoal, the CLI's queue rendering, the Stop hook's hold and the
// status-line widget all call: a reader that answered differently would open a
// path another one refused, which is the disagreement this file's section exists
// to close.
//
// emitGoalEvent spells the same lstat-and-isFile shape inline over a different
// file, and deliberately with the opposite posture: an lstat that fails for any
// reason there leaves the sink unjudged and the append proceeds, because a
// missing event costs observability while a refused read costs a verdict. That
// is a different question about a different file, so it is not a fourth copy of
// this rule.

// The size of the REGULAR file at this path: 0 when nothing is there, and null
// when the path cannot be safely read through, either because something other
// than a regular file is sitting on it (a symlink or junction, a directory, a
// FIFO) or because its kind could not be determined at all. The check is an
// lstat, so a link is judged as a link rather than as whatever it points at.
//
// Only ENOENT reads as "nothing there, go ahead". Every other lstat failure
// (EACCES, EPERM, EBUSY: a permission, a lock, a scanner holding the file) is an
// unknown answer, and answering an unknown with the go-ahead value would hand
// the caller the open this check exists to withhold.
function regularFileSize(target) {
    let st;
    try {
        st = fs.lstatSync(target);
    } catch (err) {
        return (err && err.code === 'ENOENT') ? 0 : null;
    }
    return st.isFile() ? st.size : null;
}

// What an errno from a stat of a path settles, for every caller here and in
// kit-goal-stop.js that has to tell an operator what to do about it:
//
//   'absent'       ENOENT: nothing is at the path
//   'determinate'  ENOTDIR (a regular file standing where a parent directory
//                  belongs), ELOOP (a link cycle above the final component) and
//                  ENAMETOOLONG (a path no filesystem call accepts, and
//                  normalizePlanArg imposes no length bound of its own). No lock
//                  produces any of these and waiting resolves none of them
//   'transient'    every other code, EACCES, EPERM and EBUSY above all: a
//                  permission, a lock, a scanner or an indexer holding the path.
//                  The answer is unknown rather than settled, and it may lift on
//                  its own
//
// One classification, four callers, and each turns it into its own wording:
// armGoal's three refusals, clearGoal's release-or-not, planPathState's three
// states, and the CLI's goal-state note. Spelled per site instead, two callers
// of one rule routed ENOTDIR to opposite answers.
function pathErrnoClass(code) {
    if (code === 'ENOENT') return 'absent';
    if (code === 'ENOTDIR' || code === 'ELOOP' || code === 'ENAMETOOLONG') return 'determinate';
    return 'transient';
}

// The size of the plan doc at a repo-relative plan path: 0 when nothing is
// there, and null when nothing at that path can be read as a plan doc. The
// plan-doc counterpart of regularFileSize, and the one answer every reader of an
// armed plan path takes.
//
// A regular file and an absent path answer exactly as regularFileSize does. The
// difference is the one non-regular kind that is genuinely readable: a link
// whose target resolves, still inside the repo, to a regular file is a plan doc.
// Refusing it would leave a checkout that links a plan doc unable to arm, and a
// goal already armed over such a path holding every stop for the life of the
// run, over a file the operator can open by hand.
//
// The link is resolved with realpathSync and the result held to
// normalizePlanArg's own containment rule, so a link out of the repo is refused
// exactly as a plan argument naming that path would be. The repo root is
// resolved too, so a checkout reached through a link of its own is not judged
// foreign to itself. The resolved path is then stat'ed rather than lstat'ed, so
// a chain ending anywhere but a regular file is refused. A dangling link, a link
// cycle, and a resolution that fails for any other reason all keep the refusal.
//
// A directory, a junction, a FIFO or a device at the plan path stays refused
// too: none can ever be opened as a plan doc, and those are the kinds the Stop
// hook's hold is written for.
//
// The size is returned rather than judged here because the callers hold
// different bounds: planHead reads a fixed 2 KB head and needs none, and the
// status-line widget applies its own plan-doc cap to what this returns.
//
// The lstat is spelled here rather than borrowed from regularFileSize because
// this function needs the distinction that helper erases, the same one clearGoal
// needs: regularFileSize answers null both for a kind that is not a regular file
// and for an lstat that failed. Only the first of those may be resolved through,
// since a failed lstat has told us nothing about the path and following it would
// hand back the very open the check exists to withhold.
function planFileSize(cwd, planRel) {
    const full = path.join(cwd, planRel);
    let st;
    try {
        st = fs.lstatSync(full);
    } catch (err) {
        return (err && err.code === 'ENOENT') ? 0 : null;
    }
    if (st.isFile()) return st.size;
    try {
        const real = fs.realpathSync(full);
        if (normalizePlanArg(fs.realpathSync(cwd), real) === null) return null;
        const st = fs.statSync(real);
        return st.isFile() ? st.size : null;
    } catch {
        return null;
    }
}

// Why the plan doc at a repo-relative plan path could not be read, judged by the
// same rule planFileSize applies, so the callers of one question cannot answer
// differently. Asked only where planHead has already reported the path
// unreadable, and one of:
//
//   'gone'        nothing is there: the plan was moved to the archive
//   'unusable'    the path cannot be opened as a plan doc now or later, either
//                 because something that is not a readable plan doc is at it (a
//                 directory, a junction, a FIFO, a link resolving out of the repo
//                 or to no file at all) or because the path itself can never
//                 resolve to one
//   'unreadable'  a readable kind whose read did not succeed, or a path whose
//                 kind could not be determined by a transient errno
//
// The kind leg is why this is an lstat rather than fs.accessSync. accessSync
// follows a link and succeeds on a directory, so it reports "present" for
// exactly the paths planHead refuses, and the Stop hook's absent branch would
// then take neither the archived branch nor any other: no block, no advance, no
// clear and no event, at every stop for as long as the path stays that way, with
// the goal still armed and the status line still showing it. A leash that allows
// every stop while looking armed is the one outcome that hook exists to prevent.
//
// The three wordings the callers give these states are their own: armGoal
// refuses an arm, the Stop hook holds a stop, and the CLI prints a queue token.
function planPathState(cwd, planRel) {
    let st;
    try {
        st = fs.lstatSync(path.join(cwd, planRel));
    } catch (err) {
        const cls = pathErrnoClass(err && err.code);
        if (cls === 'absent') return 'gone';
        return cls === 'determinate' ? 'unusable' : 'unreadable';
    }
    if (st.isFile()) return 'unreadable';
    // A non-regular kind that resolves to an in-repo regular file is a plan doc
    // planHead reads, so reaching here over one means the read failed rather
    // than the kind, which is the transient answer.
    return planFileSize(cwd, planRel) === null ? 'unusable' : 'unreadable';
}

// The goal state's read cap. The writer produces a plan path, the armed queue of
// plan paths, one condition sentence, a bound session id, a transcript path
// capped at TRANSCRIPT_MAX, and one short history entry per finished plan: a few
// kilobytes for the largest queue anyone arms. Anything past 64 KB is not
// something this wrote, and reading it whole on the paths readGoal runs on is
// cost with nothing to gain.
const GOAL_STATE_MAX_BYTES = 64 * 1024;

// Read and parse the goal-state file, normalized to the current shape (see
// normalizeState). Returns the parsed object, or null if the file is absent,
// refused, unreadable, not valid JSON, or carrying a plan path the normalizer's
// path re-validation refuses.
//
// The path must be a regular file of sane size before it is opened, judged by
// regularFileSize's lstat, because this reader runs where blocking is not
// recoverable: the PreCompact gate calls it before any verdict is emitted and
// ahead of both hardened readers there, the goal-leash Stop hook calls it while
// holding a stop, and the deferral nudge calls it inside the tool loop, at the
// return of every covered Bash, PowerShell, Agent and TaskOutput call. A FIFO
// planted at this path would block any of them inside readFileSync forever,
// where no try/catch can rescue it, and a link would be followed into whatever
// it names.
//
// What this covers is this one path. It narrows rather than closes even here,
// since the open below re-resolves the path, and the callers reach other files
// through other readers, each of which answers for itself.
//
// Every refusal returns the same null an absent file returns, so this stays
// fail-open: every caller already reads null as no goal armed.
function readGoal(cwd) {
    try {
        const target = goalPath(cwd);
        const size = regularFileSize(target);
        if (size === null || size > GOAL_STATE_MAX_BYTES) return null;
        return normalizeState(cwd, JSON.parse(fs.readFileSync(target, 'utf8')));
    } catch {
        return null;
    }
}

// The temporary path an atomic write in this file renames from, the local copy
// of kit-compact-lib.js's atomicTmpPath (see regularFileSize above for why it is
// a copy). The pid keeps two writers off one name (a CLI arm racing a Stop
// hook's bind); the random suffix keeps the name from being predictable, because
// a link pre-planted at a guessable tmp path would be followed by the write that
// creates it. The exclusive flag the write passes is what refuses an occupied
// path (the create fails with EEXIST rather than writing through it); the
// unguessable name is what keeps an attacker from winning that race repeatedly.
//
// The name carries a second property: the cleanup inside writeState deletes the
// tmp path on a failure, so an aimed name would be an aimed delete. That cleanup
// runs only for a tmp this process actually created, and unguessability is what
// keeps it from being pointed at anything in the first place. sweepStaleTmp
// below deletes on different terms and states them itself: any regular file in
// .kit/ carrying this writer's prefix and older than TMP_SWEEP_AGE_MS, whatever
// created it, since an orphan's creator is exactly what no later run can
// establish.
//
// What unpredictability costs is the one property the old pid-only name had: a
// process killed hard between the create and the rename leaves an orphan no
// later run can recognize as reclaimable by name, where a recycled pid used to
// take the same name and overwrite it. The sweep in writeState below is what
// replaces that, on age rather than on name.
function atomicTmpPath(target) {
    return target + '.tmp.' + process.pid + '.' + crypto.randomBytes(6).toString('hex');
}

// The room one history record can take, beyond the plan path it names: the JSON
// keys and indentation, an ISO timestamp, an outcome word, and a recorded
// blocker at safeForReason's 120-CHARACTER cap, which is 240 bytes once every
// character is a quote or a backslash and JSON escapes each to two. armGoal
// reserves this much per queued plan so a queue cannot arm within one advance of
// the writer's bound.
const HISTORY_RECORD_MAX_BYTES = 400;

// The room the fields written after the arm can take, all of which land before
// the queue finishes: boundSession and boundTranscript from a bind, and
// blockedAdvanceKey from a blocked advance, with their keys, quoting and
// indentation. Reserved once rather than per plan: each is a single field that
// is overwritten, never appended to. It is unconditional headroom rather than a
// per-field derivation, because an arm that binds its own session writes
// boundSession and boundTranscript at arm time, so those two are already inside
// the serialized state this budget is measured against and the reservation is
// then simply spare.
//
// Every term is in BYTES, and the caps the writers enforce are in UTF-16 CODE
// UNITS: bindSession caps sessionId at 128 units and validTranscript caps a
// transcript path at 512. A BMP code unit is up to 3 UTF-8 bytes (a surrogate
// pair is 2 units for 4 bytes, so 3 per unit is the worst case), and JSON
// escapes a quote or a backslash to two characters, so each capped field is
// budgeted at 6 bytes per code unit. blockedAdvanceKey is printable ASCII by its
// own gate, so it takes 1 byte per unit doubled. That is 128 x 6 = 768, plus
// 512 x 6 = 3072, plus 128 x 2 = 256, plus 256 for the four keys, their quoting
// and the indentation. blockedAdvancePlan holds one of the queue's own paths and
// is reserved beside the queue below, where the paths are measured.
const POST_ARM_MAX_BYTES = 4352;

// How old an abandoned temp file must be before a later write reclaims it. Far
// longer than any write takes (a single serialize, create and rename), with room
// for a writer suspended mid-write by a slow disk or a scanner. The residual it
// leaves is a writer stalled past this age: its in-flight temp is reclaimed by
// another process's sweep and its rename then fails ENOENT, which turns a very
// slow write into a reported failure rather than a silent one, and the caller
// retries at the next stop.
//
// What the sweep does not do is run on a schedule: it runs from writeState, so
// an orphan is reclaimed at the next goal-state write in that repo, and the
// orphan left by a run's last write survives until something arms, binds or
// advances there again.
const TMP_SWEEP_AGE_MS = 5 * 60 * 1000;

// How many directory entries one sweep may examine. The sweep runs on paths
// where cost is not free: the PreCompact gate reaches this writer before any
// verdict is emitted, and the Stop hook reaches it while holding a stop. A .kit/
// directory holds a handful of files, so this ceiling is never reached in
// practice; it is here so that a directory someone has filled cannot turn every
// goal-state write into a walk of it. The listing is read incrementally through
// opendirSync rather than readdirSync for the same reason: readdirSync
// materializes the whole directory before the first entry can be judged, so a
// ceiling on the loop alone would bound nothing.
const TMP_SWEEP_MAX_ENTRIES = 256;

// Remove temp files a previous write abandoned. Cleanup inside writeState covers
// every failure it can catch; a process killed between the create and the rename
// catches nothing, and the random suffix means no later run recognizes that file
// by name, so age is the only signal left (see atomicTmpPath). What that costs
// is the creator test: any regular file in .kit/ carrying this writer's prefix
// and older than TMP_SWEEP_AGE_MS is removed, whatever wrote it. The prefix is
// this file's own name plus '.tmp.', a name nothing else has reason to take, and
// the kind is judged by the same lstat rule every reader here uses, so a link or
// a directory someone parked in .kit/ is passed over rather than followed or
// removed.
//
// Wholly best-effort: it never throws and its result is never read. A sweep that
// cannot run leaves orphans, which is where the code stood before it existed.
function sweepStaleTmp(target) {
    let dir = null;
    try {
        const prefix = path.basename(target) + '.tmp.';
        const cutoff = Date.now() - TMP_SWEEP_AGE_MS;
        dir = fs.opendirSync(path.dirname(target));
        for (let seen = 0; seen < TMP_SWEEP_MAX_ENTRIES; seen += 1) {
            const entry = dir.readSync();
            if (entry === null) break;
            if (!entry.name.startsWith(prefix)) continue;
            const full = path.join(path.dirname(target), entry.name);
            try {
                const st = fs.lstatSync(full);
                if (!st.isFile() || st.mtimeMs > cutoff) continue;
                fs.unlinkSync(full);
            } catch { /* raced by another writer, or not ours to remove */ }
        }
    } catch { /* no directory yet, or it cannot be listed: nothing to sweep */ }
    if (dir) {
        try { dir.closeSync(); } catch { /* already closed, or never opened cleanly */ }
    }
}

// Write the goal state atomically (tmp file + rename), matching writeCheckpoint
// in kit-compact-lib.js: the tmp name is unique per writer and unpredictable
// (see atomicTmpPath), the create is exclusive so an existing path at that name
// fails the write instead of being written through, and a failed rename unlinks
// its tmp so orphans do not accumulate in .kit/. Returns { ok } or
// { ok:false, reason }: a filesystem failure is reported, never thrown, keeping
// the whole exported surface non-throwing.
//
// The reader's cap is enforced here too, on the bytes about to be written, so
// GOAL_STATE_MAX_BYTES bounds what this writer can produce rather than only what
// a reader will accept. Without it a long enough queue or history writes
// successfully, the CLI reports the goal armed, and every reader then refuses
// the file as oversized and reports no armed goal, with no error anywhere in
// between. Refusing at the write keeps a reader's refusal meaning one thing:
// the file is not ours.
//
// The cleanup deletes the tmp path only when this process created it, tracked by
// a flag set the moment the exclusive create returns rather than by the error's
// code. The catch spans both the create and the rename, and the two failures
// need opposite answers: an EEXIST from the create says the file was already
// there, so it is not this process's to remove, while a rename onto a non-empty
// directory reports EEXIST or ENOTEMPTY too, with this process's own freshly
// created tmp sitting there. Gating on the code would skip that one and orphan a
// full copy of the goal state, boundSession and boundTranscript included, under a
// new random name on every retry. The flag answers what the code cannot: who
// made the file. kit-compact-lib.js's writeCheckpoint carries the same gate for
// the same reason.
function writeState(cwd, state) {
    const gp = goalPath(cwd);
    try {
        const body = JSON.stringify(state, null, 2) + '\n';
        const bytes = Buffer.byteLength(body, 'utf8');
        if (bytes > GOAL_STATE_MAX_BYTES) {
            return {
                ok: false,
                reason: 'could not write goal state: the state is ' + bytes + ' bytes, past the '
                    + GOAL_STATE_MAX_BYTES + '-byte bound every reader of this file enforces'
            };
        }
        fs.mkdirSync(path.dirname(gp), { recursive: true });
        sweepStaleTmp(gp);
        const tmp = atomicTmpPath(gp);
        let created = false;
        try {
            // The create is its own call so the flag can mean what it says. A
            // single writeFileSync with the exclusive flag creates, writes and
            // closes together, so a failure in its write leg (a full disk, a
            // quota, an IO error) leaves the flag false with the file already on
            // disk, and the cleanup below then skips the partial copy of the goal
            // state it was written to remove.
            const fd = fs.openSync(tmp, 'wx');
            created = true;
            let wrote = false;
            try {
                fs.writeFileSync(fd, body, 'utf8');
                wrote = true;
            } finally {
                // The close is reached in two states and the flag tells them
                // apart. With the write already failed, a throwing close would
                // replace the error in flight and the reported reason would name
                // the close rather than the cause, so it is swallowed. With the
                // write returned, the close is the last point at which the OS can
                // report a deferred write error (a network volume, a quota), so it
                // is allowed to throw: swallowing it would publish a torn or
                // unflushed file while telling the caller the write succeeded.
                try {
                    fs.closeSync(fd);
                } catch (closeErr) {
                    if (wrote) throw closeErr;
                }
            }
            fs.renameSync(tmp, gp);
        } catch (err) {
            if (created) {
                try { fs.unlinkSync(tmp); } catch { /* already gone, or the path itself is unwritable */ }
            }
            throw err;
        }
    } catch (err) {
        return { ok: false, reason: 'could not write goal state: ' + (err && err.message ? err.message : String(err)) };
    }
    return { ok: true };
}

// Read the first 2KB of a plan file and classify its Status header.
// Returns { exists, status } where status is 'complete', 'in progress', or
// 'unknown'. exists is false when the file cannot be opened at all.
//
// The path must read as a plan doc before it is opened, judged by
// planFileSize's kind rule, because the plan path arrives from the goal-state
// file and the Stop hook reaches this function while holding a stop.
// normalizeState's re-validation constrains where that path may point (inside
// the repo, no control characters), never what kind of thing sits there, so a
// FIFO at a perfectly well-formed in-repo plan path passes every check above and
// blocks a POSIX open until a writer appears. The size is not capped here
// because the read is a fixed 2 KB head, never the whole file.
//
// A refused path takes the existing absent-file return, which is the same shape
// an absent plan produces but NOT the same case, and a caller that acts on the
// difference asks planPathState, which parts the three.
function planHead(cwd, planRel) {
    const full = path.join(cwd, planRel);
    if (planFileSize(cwd, planRel) === null) {
        return { exists: false, status: 'unknown' };
    }
    let fd;
    try {
        fd = fs.openSync(full, 'r');
    } catch {
        return { exists: false, status: 'unknown' };
    }
    try {
        const buf = Buffer.alloc(2048);
        const bytes = fs.readSync(fd, buf, 0, 2048, 0);
        let head = buf.toString('utf8', 0, bytes);
        if (head.charCodeAt(0) === 0xFEFF) head = head.slice(1);
        // Classify from the Status header only: anchored to a line start (m flag)
        // so body prose cannot match, and the value must sit on the same line as
        // the header ([^\S\r\n]* is horizontal whitespace only, never a newline),
        // so a bare "Status:" line above a line beginning "Complete" or "in
        // progress" does not misclassify the plan. A leading UTF-8 BOM (PowerShell
        // Set-Content writes one) is stripped above so the anchor sees the header.
        // The Status header sits on its own line near the top by convention.
        const inProgress = /^status:[^\S\r\n]*in[^\S\r\n]*progress/im.test(head);
        const complete = /^status:[^\S\r\n]*complete/im.test(head) && !inProgress;
        let status = 'unknown';
        if (complete) status = 'complete';
        else if (inProgress) status = 'in progress';
        return { exists: true, status };
    } catch {
        return { exists: true, status: 'unknown' };
    } finally {
        try { fs.closeSync(fd); } catch { /* already closed or invalid */ }
    }
}

// The single source of the canonical goal condition text. planRel is the
// repo-relative forward-slash plan path already validated by armGoal. This
// text is descriptive: it is surfaced for a human reading goal-state.json. The
// deterministic Stop hook enforces via file and transcript signals, not by
// parsing this string, so its clause (a) wording need not mirror the hook's
// exact Complete-or-archived check. The text also carries the user's per-run
// parallelization request (subagent dispatch and Workflows), so the request
// rides with the goal state across session swaps; the /kit-goal skill owns
// the full statement of what arming requests, and the Stop hook's enforcement
// block restates it at the point of action.
//
// queue and queueIndex are optional and describe the armed sequence this plan
// belongs to. When plans remain after this one, the text gains the queue
// context: the position, the plans still to come, and that each runs to
// Complete or a recorded BLOCKED: before the next begins. A single plan, or
// the last plan of a queue, has nothing remaining and reads exactly as a solo
// arming does.
function composeCondition(planRel, queue, queueIndex) {
    const remaining = Array.isArray(queue) && Number.isInteger(queueIndex)
        ? queue.slice(queueIndex + 1)
        : [];
    const tail = remaining.length === 0 ? '' : ' This plan is ' + (queueIndex + 1)
        + ' of ' + queue.length + ' in an armed queue; still to come after it: '
        + remaining.join(', ') + '. Each plan runs to Complete or a recorded '
        + "'BLOCKED:' before the next begins, and the leash advances to the next "
        + 'plan on its own: no re-arming, and the run continues in this session.';
    return 'Work ' + planRel + ' to completion using executing-work. Arming is '
        + "Scott's request for this run: reduce wall-clock time by parallelizing "
        + 'work that can run simultaneously, via subagent dispatch and via '
        + 'Workflows. Met when (a) every section is complete and closed out, or '
        + '(b) you are BLOCKED on a decision only Scott can make and have said so. '
        + 'Capacity is never a blocker: auto-compaction rides through with the '
        + 'leash intact. Waiting on dispatched background work is a pause, not a '
        + "stop: lead with 'WAITING:' and what you await; the leash stays armed "
        + 'and the completion notification resumes the run.' + tail;
}

// Normalize a plan argument (relative or absolute) to a repo-relative,
// forward-slash path. Returns null if the argument carries control characters
// or the resolved path escapes cwd.
function normalizePlanArg(cwd, planArg) {
    // Reject any control character up front: the plan path is written into
    // goal-state.json, which the hooks surface back into the model's context, so
    // a path carrying newlines or control bytes could smuggle instructions into
    // a trusted channel. Windows filenames cannot hold these; this closes the
    // POSIX case and matches the sibling hooks' sanitize-before-trust rule.
    if (typeof planArg !== 'string' || /[\x00-\x1F]/.test(planArg)) {
        return null;
    }
    const abs = path.resolve(cwd, planArg);
    const rel = path.relative(cwd, abs);
    // Reject a path that resolves to cwd itself, escapes it via a real `..` path
    // segment (not merely a name beginning with two dots, e.g. `..notes.md`), or
    // lands on another drive (path.relative yields an absolute path when no
    // relative route exists).
    if (rel === '' || rel === '..' || rel.startsWith('..' + path.sep) || path.isAbsolute(rel)) {
        return null;
    }
    return rel.split(path.sep).join('/');
}

// A caller-supplied path rendered safe for a reason string: printable ASCII,
// capped. Reason strings reach stderr and, through the Stop hook, the model's
// context, so an offending path is named in a form that cannot carry more than
// its own characters.
function safeForReason(value) {
    return String(value).replace(/[^\x20-\x7E]/g, '').slice(0, 120);
}

// Validate the plan arguments, then write the goal-state file atomically.
// planArgs is one plan path or an ordered array of them (the armed queue).
//
// bind is optional, { sessionId, transcriptPath }: the session doing the
// arming, so an in-session arm holds the leash from the moment it is written
// rather than waiting for a claim point. The bind takes two keys together, and
// writes boundSession and boundTranscript as a pair: sessionId must be
// session-id shaped, and transcriptPath must pass validTranscript, which the
// CLI supplies only from a transcript file it found on this machine under the
// harness's own projects tree. The shape alone cannot authenticate an id (see
// SESSION_ID_SHAPE), so the transcript on disk is what corroborates that the id
// names a real local session: a stale, mistyped, or planted value that matches
// no local transcript arms unbound instead of leashing the goal to a session
// that will never stop. A bound goal therefore always carries its transcript,
// and the liveness hint every reader renders from it is never stranded null.
//
// Anything short of both keys arms unbound exactly as an arm with no bind does:
// that is a silent fallback, not a failure, because the stop and
// auto-compaction-offer claim points still bind the goal, recording the hook
// payload's own authoritative transcript path. The binding rides in the same
// single atomic write as the rest of the state, so arming never becomes a
// read-modify-write and cannot race one.
// Every path is validated before anything is written and the whole arm is
// refused if any one fails, so a partial queue can never reach the state file;
// the reason names the offending path. Duplicates are refused for the same
// reason: a queue that visits a plan twice would advance past it the first
// time and stall the second. Returns { ok:true, plan, queue, boundSession } on
// success (boundSession is the id that was written, or null when the arm is
// unbound, so the CLI reports the binding without restating the gate) or
// { ok:false, reason } on any failure: a bad path, a missing or Complete plan,
// a duplicate, or an unexpected filesystem error, which is caught and reported
// rather than thrown. This keeps the whole exported surface non-throwing.
function armGoal(cwd, planArgs, bind) {
    const args = Array.isArray(planArgs) ? planArgs : [planArgs];
    if (args.length === 0) {
        return { ok: false, reason: 'no plan path given' };
    }

    const queue = [];
    const seen = new Set();
    for (const arg of args) {
        const rel = normalizePlanArg(cwd, arg);
        if (rel === null) {
            return { ok: false, reason: 'plan path is invalid or outside the repo: ' + safeForReason(arg) };
        }
        // The dedupe key is case-folded on Windows, where the filesystem is
        // case-insensitive and two casings of one path name one file: a queue
        // holding both would advance past the plan once and stall on the
        // repeat, the exact shape this refusal exists to stop.
        const dupKey = process.platform === 'win32' ? rel.toLowerCase() : rel;
        if (seen.has(dupKey)) {
            return { ok: false, reason: 'plan appears twice in the queue: ' + rel };
        }
        seen.add(dupKey);
        const head = planHead(cwd, rel);
        if (!head.exists) {
            // planHead answers the same 'no' for three states an operator would
            // act on differently: nothing is at the path, something that is not a
            // plan doc is at it, or the path is there and could not be read right
            // now (a scanner or an indexer holding it, which lifts on its own).
            // planPathState parts them by the shared rule, and these are its
            // three wordings: reporting a locked plan doc as one that does not
            // hold a plan file sends the operator to fix a file that is fine, and
            // reporting a path that can never resolve as one to retry names a
            // condition no amount of waiting resolves.
            const state = planPathState(cwd, rel);
            if (state === 'gone') {
                return { ok: false, reason: 'plan not found: ' + rel };
            }
            if (state === 'unusable') {
                return { ok: false, reason: 'plan path does not hold a plan file: ' + rel };
            }
            return { ok: false, reason: 'plan path could not be read right now: ' + rel };
        }
        if (head.status === 'complete') {
            return { ok: false, reason: 'plan is already Complete: ' + rel };
        }
        queue.push(rel);
    }

    const requested = bind || {};
    // Both keys or neither: an id of the right shape whose transcript is
    // absent or unusable arms unbound rather than failing the arm.
    const bindable = isSessionIdShaped(requested.sessionId) && validTranscript(requested.transcriptPath);
    const boundSession = bindable ? requested.sessionId : null;

    const state = {
        // The current plan of the queue. Every other reader of this state
        // answers to this field and to boundSession, so both keep their
        // meaning as the queue advances: plan is what is being worked now.
        plan: queue[0],
        condition: composeCondition(queue[0], queue, 0),
        armedAt: new Date().toISOString(),
        // Which session currently holds the leash, or null when unclaimed. An
        // arm carrying a usable bind (the CLI supplies the arming session's
        // id) holds the leash from this write, a crash-recovery re-arm
        // included, which rebinds to the re-arming session here; an arm with
        // no usable bind (none supplied, or one the CLI could not
        // corroborate) starts unbound, and the next stop that resolves to a
        // leashed session claims it, so re-arm is always a clean rebind
        // opportunity either way.
        boundSession,
        // The bound session's transcript path, used as a liveness hint for a
        // session other than the leash holder and, at arm time, as the
        // corroboration that the bound id names a real local session. It is
        // written with the binding or not at all, so an unbound arm records
        // none and a bound one always has it.
        boundTranscript: bindable ? requested.transcriptPath : null,
        queue,
        queueIndex: 0,
        // One entry per finished plan: { plan, outcome, at } and, for a
        // blocked plan, the recorded blocker.
        history: []
    };

    // Refuse a queue whose own progress would grow the state past the writer's
    // bound. Each advance appends a history record while the condition's
    // remaining tail sheds one path, a net growth, so a queue armed just under
    // the bound crosses it on an advance: writeState would then refuse
    // deterministically, the Stop hook would block at every stop reporting that
    // the advance could not be recorded, and the run could neither advance nor
    // release without a manual clear. That failure is permanent rather than
    // degrading, so the room for every record this queue can produce is
    // reserved here, at the one moment a person is present to read the refusal.
    //
    // Every term is counted in BYTES, the unit the budget is in: a path is
    // measured with Buffer.byteLength and doubled, because JSON escapes a quote
    // or a backslash in a filename to two bytes each, and the same doubling is
    // already inside HISTORY_RECORD_MAX_BYTES for the note. The fields a bind or
    // a blocked advance add after the arm are reserved once in
    // POST_ARM_MAX_BYTES, which states its own derivation; the one such field
    // that carries a plan path, blockedAdvancePlan, is reserved here instead,
    // against the longest path in this queue, because that is where the paths are
    // measured.
    //
    // The reservation runs at arm time only, so a queue armed before it existed
    // carries none: such a state reads back fine under the cap and can still meet
    // writeState's refusal on a later advance. Reaching that needs a standing
    // queue of roughly 150 plans, and the recovery is /kit-goal clear followed by
    // a fresh arm, which the refusal's own wording points at.
    let reserved = POST_ARM_MAX_BYTES;
    let longest = 0;
    for (const rel of queue) {
        const bytes = Buffer.byteLength(rel, 'utf8');
        reserved += 2 * bytes + HISTORY_RECORD_MAX_BYTES;
        if (bytes > longest) longest = bytes;
    }
    reserved += 2 * longest;
    if (Buffer.byteLength(JSON.stringify(state, null, 2) + '\n', 'utf8') + reserved > GOAL_STATE_MAX_BYTES) {
        return {
            ok: false,
            reason: 'the armed queue is too long: ' + queue.length + ' plans and the records their '
                + 'advances would add do not fit the goal state file. Arm fewer plans, and queue the rest '
                + 'when they come up.'
        };
    }

    const written = writeState(cwd, state);
    if (!written.ok) return written;

    return { ok: true, plan: queue[0], queue, boundSession };
}

// Record the current plan's outcome and move the leash to the next plan in the
// queue, in one atomic rewrite: the history entry is appended, queueIndex and
// plan move together, the condition is recomposed for the new current plan,
// and boundSession and boundTranscript are preserved, so one binding rides the
// whole queue.
//
// outcome is 'complete', 'archived', or 'blocked'; note is the optional
// recorded blocker, sanitized and capped here because it originates in
// transcript text. expectedPlan and expectedArmedAt are an optional
// compare-and-swap guard: the caller decided to advance from a snapshot,
// another writer (a CLI re-arm or clear) can land between that snapshot and
// this function's own re-read, and a state that no longer matches either
// value is refused rather than advanced over. The plan alone cannot tell a
// re-arm that put the same plan back at the head (/kit-goal <currentPlan>
// <newTail>, the ordinary crash-recovery spelling) from the state the caller
// saw, which is why the arming timestamp rides with it: a fresh arm writes a
// fresh armedAt. leadKey is the optional identity of the transcript entry
// whose 'BLOCKED:' lead drove this advance; a usable value (printable ASCII,
// capped) is stored as blockedAdvanceKey, together with the plan this advance
// moves to as blockedAdvancePlan, so the Stop hook can refuse consuming the
// same entry twice. An unusable leadKey is dropped rather than stored, the
// same bar every stored field answers to, and no advance ever deletes a
// standing pair: the hook retires it by queue position instead (honored only
// while the recording plan is the current or the immediately previous
// position), so a keyless advance slotting in between two reads of the same
// entry cannot make that entry consumable again.
//
// Returns { ok:true, advanced:true, finished, plan } when the leash moved,
// { ok:true, advanced:false, finished } on the last plan of the queue (nothing
// is written: the caller releases the goal, and the session's own closing
// summary is the operator-facing record), and { ok:false, reason } when no
// goal is armed, the outcome is unusable, the expected plan no longer
// matches, or the write fails. Never throws.
function advanceGoal(cwd, outcomeEntry) {
    const entry = outcomeEntry || {};
    if (!['complete', 'archived', 'blocked'].includes(entry.outcome)) {
        return { ok: false, reason: 'outcome must be complete, archived, or blocked' };
    }
    // The plan must be a string, matching every other reader's guard, not
    // merely truthy: a hand-edited non-string plan returns from the
    // normalizer without the queue fields it otherwise guarantees, so a
    // truthiness check here would dereference an absent queue below and break
    // this surface's never-throws contract.
    const state = readGoal(cwd);
    if (!state || typeof state.plan !== 'string' || state.plan === '') {
        return { ok: false, reason: 'no goal is armed' };
    }
    if (typeof entry.expectedPlan === 'string' && entry.expectedPlan !== state.plan) {
        return {
            ok: false,
            reason: 'goal state changed: the current plan is no longer ' + safeForReason(entry.expectedPlan)
        };
    }
    if (typeof entry.expectedArmedAt === 'string' && entry.expectedArmedAt !== state.armedAt) {
        return {
            ok: false,
            reason: 'goal state changed: the goal was re-armed after this advance was decided'
        };
    }

    const finished = state.plan;
    const next = state.queueIndex + 1;
    if (next >= state.queue.length) {
        return { ok: true, advanced: false, finished };
    }

    const record = { plan: finished, outcome: entry.outcome, at: new Date().toISOString() };
    if (entry.note) record.note = safeForReason(entry.note);
    state.history.push(record);
    state.queueIndex = next;
    state.plan = state.queue[next];
    state.condition = composeCondition(state.plan, state.queue, next);
    if (typeof entry.leadKey === 'string' && entry.leadKey !== '' && entry.leadKey.length <= 128
        && !/[^\x20-\x7E]/.test(entry.leadKey)) {
        state.blockedAdvanceKey = entry.leadKey;
        // The plan this advance moved to, stored beside the key. The Stop
        // hook honors the pair only while this plan is the current or the
        // immediately previous queue position, which is as far as a stale
        // transcript re-read of the consumed entry can plausibly reach, and
        // an advance carrying no key (clause (a)'s Complete or archived, or
        // a lead whose identity could not be derived) leaves the pair
        // standing rather than deleting it. Retiring by position closes both
        // failure directions at once: a keyless advance in between cannot
        // resurrect the consumed entry, and a stale text-digest key in a
        // uuid-less transcript cannot collide with a genuinely new,
        // identically worded blocker beyond that neighbourhood.
        state.blockedAdvancePlan = state.plan;
    }
    const written = writeState(cwd, state);
    if (!written.ok) return written;

    return { ok: true, advanced: true, finished, plan: state.plan };
}

// Bind (or rebind) the armed goal to a session id, recording which session
// holds the leash. Reads the current goal state, sets boundSession, and
// rewrites the file atomically (tmp + rename, matching armGoal). Returns
// { ok:true } on success, or { ok:false, reason } when no goal is armed, the
// session id is unusable, or the write fails. Never throws. The session id is
// written into goal-state.json, which the hooks surface into the model's
// context, so a control character (a newline could smuggle instructions) is
// rejected, matching normalizePlanArg's sanitize-before-store rule; a length
// cap likewise rejects an oversized value, whatever caller produced it, so a
// session id padded to kilobytes never lands in the state file.
//
// Concurrency posture: this read-modify-write is not locked, so two stops
// resolving to different sessions at nearly the same moment are last-writer-
// wins; the loser simply reads the winner's binding at its own next stop and
// allows as a bystander.
// A clear that lands between this function's read and its write can be
// resurrected by this write, recoverable by clearing again. Enforcement never
// depends on this write succeeding: a failed bind still leashes the current
// stop and is retried at the next one.
//
// transcriptPath is optional: the binding session's transcript, recorded as
// boundTranscript so another session can read a liveness hint from its mtime.
// It travels with the binding, so a bind that carries no usable path clears
// any previous one rather than leaving the prior session's transcript standing
// for the new holder. An absent or invalid path never fails the bind: leashing
// the session is the load-bearing half, and the hint is decoration.
function bindSession(cwd, sessionId, transcriptPath) {
    if (typeof sessionId !== 'string' || sessionId === '' || sessionId.length > 128
        || /[\x00-\x1F]/.test(sessionId)) {
        return { ok: false, reason: 'session id is invalid' };
    }
    const state = readGoal(cwd);
    if (!state || !state.plan) {
        return { ok: false, reason: 'no goal is armed' };
    }
    state.boundSession = sessionId;
    state.boundTranscript = validTranscript(transcriptPath) ? transcriptPath : null;
    const written = writeState(cwd, state);
    if (!written.ok) return written;
    return { ok: true };
}

// Delete the goal-state file if present. Returns { ok:true, cleared:true } when
// a file was removed, { ok:true, cleared:false } when none was armed, and
// { ok:false, cleared:false, reason } when a delete failed or the path's own
// kind could not be read, which leaves existence unproven: either way nothing
// was released and the caller must not report one. Never throws.
//
// Presence is judged by an lstat rather than by fs.existsSync, which follows a
// link and would report a goal armed where every reader of this file reports
// none. Two spellings of one question are how a surface comes to say 'kit goal
// cleared' about a path no reader ever read as a goal. A path holding something
// other than a regular file therefore reads as nothing armed and is left where
// it is: there is no release to report, and what a repository parked at that
// path is not this function's to delete.
//
// The lstat is spelled here rather than borrowed from regularFileSize, which
// collapses two answers this caller has to keep apart: it returns null both for
// a kind that is not a regular file and for an lstat that failed for any other
// reason. A reader treating a locked file as absent costs one skipped read; this
// function telling the operator a leash is released while the file is still on
// disk and every reader still reads it as armed is the failure this whole file
// exists to prevent. So a failed lstat is routed by pathErrnoClass, the shared
// rule: a determinate code means nothing is at the path and nothing can be, so
// there is no release to report and nothing to wait out, and only a transient
// one (a lock, a permission, a scanner) is a failed clear, because that is the
// one leg where the file may be sitting there still. A kind that was read and is
// not a regular file is 'nothing armed' for the same reason as a determinate
// code. A zero-length regular file is a regular file: it is removed
// and reported cleared, since leaving it is a goal state no reader can parse
// and no CLI can delete.
//
// Where an arm over such a path gets named depends on what is sitting there. A
// directory, and on this platform a junction, refuses the rename and the arm
// says so. POSIX rename(2) replaces an existing file symlink, so on Linux and
// macOS an arm over one publishes normally and the path is never named; that
// half is reasoned from the specification and unverified here, since this box
// creates no file symlink without a privilege the suite must not require.
function clearGoal(cwd) {
    const gp = goalPath(cwd);
    try {
        let st;
        try {
            st = fs.lstatSync(gp);
        } catch (err) {
            if (pathErrnoClass(err && err.code) !== 'transient') {
                return { ok: true, cleared: false };
            }
            return {
                ok: false,
                cleared: false,
                reason: 'could not clear goal state: ' + (err && err.message ? err.message : String(err))
            };
        }
        if (!st.isFile()) {
            return { ok: true, cleared: false };
        }
        fs.unlinkSync(gp);
        return { ok: true, cleared: true };
    } catch (err) {
        // A delete that finds nothing there is a concurrent stop having removed
        // the file between the kind check above and this call: nothing was
        // released here, and the stop that did remove it reports the release. It
        // is the "nothing armed" answer, not a failure to clear.
        if (err && err.code === 'ENOENT') {
            return { ok: true, cleared: false };
        }
        return {
            ok: false,
            cleared: false,
            reason: 'could not clear goal state: ' + (err && err.message ? err.message : String(err))
        };
    }
}

// How long ago a transcript file was last written, as a coarse phrase
// ('less than a minute ago', 'about N minutes ago', 'about N hours ago'), or
// null when the path is absent, invalid per validTranscript, or unreadable.
// The single source of the liveness hint that the CLI's status report and the
// SessionStart armed-goal notice both render, so two surfaces cannot answer
// the same mtime differently. Only a number and a unit ever leave this
// function: the transcript path is machine-local (it typically embeds an OS
// username) and is never surfaced. Math.floor and the 60-minute crossover
// make the phrase err toward reading recent: the one decision this hint feeds
// is whether a bound sibling run is dead enough to re-arm over, and
// overstating liveness errs away from stealing a live run's leash.
function lastActivePhrase(transcriptPath) {
    if (!validTranscript(transcriptPath)) return null;
    let mtimeMs;
    try {
        mtimeMs = fs.statSync(transcriptPath).mtimeMs;
    } catch {
        return null;
    }
    if (!Number.isFinite(mtimeMs)) return null;
    const minutes = Math.max(0, Math.floor((Date.now() - mtimeMs) / 60000));
    if (minutes < 1) return 'less than a minute ago';
    if (minutes < 60) return 'about ' + minutes + ' minute' + (minutes === 1 ? '' : 's') + ' ago';
    const hours = Math.floor(minutes / 60);
    return 'about ' + hours + ' hour' + (hours === 1 ? '' : 's') + ' ago';
}

// Normalize one event field to printable ASCII, capped at max characters; an
// absent value stays absent. Field values cross into a consumer that treats the
// stream as kit-authored, so their content is normalized to a short printable
// form at this boundary rather than trusted downstream, matching the hook's
// sanitize-before-trust rule for the plan path it prints in a block reason.
function eventField(value, max) {
    if (value === undefined || value === null) return value;
    return String(value).replace(/[^\x20-\x7E]/g, '').slice(0, max);
}

// The event sink this process writes to.
//
// KIT_EVENTS_PATH is honored only when KIT_EVENTS_PATH_ALLOW=1 is also set;
// otherwise it is ignored with a once-per-process stderr note and the real
// sink is used. The same two-signal discipline as KIT_MEMORY_ROOT's gate in
// memq.js (memoryRoot(), read at call time there too): one innocuous-looking
// variable is settable from a committed file a repository already has
// (.vscode/settings.json's terminal env, devcontainer.json, an .envrc), and
// this variable chooses where a session's goal-release events are written,
// so it answers to the same bar as every other kit path override rather than
// to an argument specific to this one. The intended user of both signals is
// the repo test suite and the hook canary's own probe, which point the
// stream at a throwaway file.
let ungatedEventsOverrideNoted = false;
function eventsSink() {
    const override = process.env.KIT_EVENTS_PATH;
    if (override) {
        if (process.env.KIT_EVENTS_PATH_ALLOW === '1') return override;
        if (!ungatedEventsOverrideNoted) {
            ungatedEventsOverrideNoted = true;
            // A failed write here must not cost the fallback emit below: the
            // note is best-effort observability layered on top of a function
            // whose whole body is already best-effort.
            try {
                process.stderr.write('kit-goal: ignoring KIT_EVENTS_PATH (it redirects the goal-event '
                    + 'sink, so it is honored only with KIT_EVENTS_PATH_ALLOW=1)\n');
            } catch { /* the note is best-effort; a failed write changes nothing */ }
        }
    }
    return path.join(os.homedir(), '.claude', 'kit-events.jsonl');
}

// The run id this event correlates to, or undefined when none applies.
// Reuses memq's isRunId rather than restating the grammar, so the two
// producers that answer to a run id (this event stream, and memq's own
// pending-tier routing) cannot disagree about what a well-formed one looks
// like: memq's header states the rule for exactly this reason ("The hooks
// import them rather than restating them, so no two writers can disagree").
// A value memq would refuse (a dots-only name, a trailing dot, a reserved
// device stem, anything outside its token charset, or over its 40-character
// cap) is refused here too, rather than shipping a run label a correlator
// could join into a path memq itself would never create, and rather than the
// truthy-but-empty-after-normalization case a raw check would let through
// (KIT_RUN_ID=<a value that normalizes to nothing> would otherwise ship
// run:""). memq.js is required lazily and defensively, inside this function
// rather than at module load, so a damaged or missing copy costs only the run
// field: the rest of the event, and every other kit-goal-lib.js consumer that
// never touches events, stay unaffected.
//
// Presence of a well-formed run does NOT mean run-scoped memory was active
// for this session: memq additionally requires the KIT_MEMORY_ROOT pair
// before honoring the id for its own pending tier, a separate condition this
// event stream does not check. A consumer must not read run's presence as
// proof of that.
function runIdField() {
    const raw = process.env.KIT_RUN_ID;
    if (!raw) return undefined;
    let isRunId;
    try { ({ isRunId } = require('../scripts/memq.js')); } catch { return undefined; }
    if (typeof isRunId !== 'function' || !isRunId(raw)) return undefined;
    return eventField(raw, 40);
}

// Append one goal release event to the kit event stream, the well-known file an
// outside watcher reads to turn a release into a notification. One JSON object
// per line, { ts, event, project, plan, session, detail, run }: ts is ISO 8601,
// project the absolute project path, plan the repo-relative plan path, session
// the session id or null, detail is present only on a goal-complete, naming
// which release it was, and run is present only when KIT_RUN_ID names a
// well-formed run id per runIdField() above. JSON encoding escapes any
// newline inside a value, so an event is always exactly one line. See
// eventsSink() above for the sink and its override gate.
//
// Every field is sanitized display data: each is normalized to printable ASCII
// and capped, at 40 characters for event and detail, 120 for plan and session,
// and 260 for project (a Windows absolute path bound). The values carry caller
// data (a project path, repo data, a harness-supplied session id), and the
// contract holds at this boundary for the whole record, so no caller can widen
// what reaches the consumer.
//
// A sink that exists and is not a regular file is left untouched and nothing is
// written: opening a FIFO blocks, which no try/catch can rescue, the same guard
// the Stop hook applies to a transcript path. An absent sink is the ordinary
// case: its directory is created and the append starts the file.
//
// Rotation is best-effort, sized for the single writer this normally has: a sink
// already larger than 1 MB is renamed to <sink>.old, replacing any previous
// .old, and the append starts a fresh file. The stat, rename, and append are not
// atomic across processes, and a rename that keeps failing degrades to a sink
// that grows without bound rather than to lost events.
//
// Emitting is observability, never a decision input. The whole body is wrapped
// and nothing is returned, so an unwritable sink or a full disk can neither
// throw into a caller's control flow nor give it something to branch on: a
// missing event is the accepted cost of a hook whose verdict cannot shift.
function emitGoalEvent(details) {
    try {
        const d = details || {};
        const sink = eventsSink();
        const record = {
            ts: new Date().toISOString(),
            event: eventField(d.event, 40),
            project: eventField(d.project, 260),
            plan: eventField(d.plan, 120),
            session: eventField(d.session, 120) || null
        };
        // The key is present exactly when the caller supplied a detail, judged on
        // the value it passed rather than on what survives normalization.
        if (d.detail) record.detail = eventField(d.detail, 40);
        const run = runIdField();
        if (run !== undefined) record.run = run;
        // lstatSync, not statSync: a symlink or junction planted at the sink
        // path must not pass as a regular file. statSync follows the link, so
        // the isFile() guard below would see the target's type, the rotation
        // would rename the link (not the target) aside, and the append would
        // then write straight through the (unrotated, still-linked) path into
        // whatever it points at. A repo carrying both the link and an env
        // pointing KIT_EVENTS_PATH at it is a cheap way to plant a
        // destroy-the-target primitive; this closes that composition without
        // touching the ordinary regular-file path.
        let st = null;
        try { st = fs.lstatSync(sink); } catch { /* no sink yet: the append creates it */ }
        if (st) {
            if (!st.isFile()) return;
            if (st.size > 1024 * 1024) {
                try { fs.renameSync(sink, sink + '.old'); } catch { /* cannot rotate: append to the sink as it is */ }
            }
        }
        fs.mkdirSync(path.dirname(sink), { recursive: true });
        fs.appendFileSync(sink, JSON.stringify(record) + '\n', 'utf8');
    } catch { /* the event stream is best-effort; a failed emit changes nothing */ }
}

// The plan-path helpers are exported for the readers outside this file that ask
// the same questions of the same paths: the status-line widget reads the armed
// plan doc whole (planFileSize), the Stop hook decides whether to hold over one
// (planPathState), and the CLI prints a token per queued plan (planPathState).
// Each must answer to the one rule rather than to a spelling of its own.
// GOAL_STATE_MAX_BYTES rides along for the CLI's report of a state file past it.
module.exports = { goalPath, readGoal, armGoal, advanceGoal, bindSession, clearGoal, composeCondition, planHead, emitGoalEvent, normalizePlanArg, lastActivePhrase, isSessionIdShaped, planFileSize, planPathState, pathErrnoClass, GOAL_STATE_MAX_BYTES };
