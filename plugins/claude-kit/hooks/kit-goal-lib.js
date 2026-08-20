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

// Read and parse the goal-state file, normalized to the current shape (see
// normalizeState). Returns the parsed object, or null if the file is absent,
// unreadable, not valid JSON, or carrying a plan path the normalizer's
// path re-validation refuses.
function readGoal(cwd) {
    try {
        const raw = fs.readFileSync(goalPath(cwd), 'utf8');
        return normalizeState(cwd, JSON.parse(raw));
    } catch {
        return null;
    }
}

// Write the goal state atomically (tmp file + rename). The tmp name carries
// this process's pid so two writers (e.g. a CLI arm racing a Stop hook's bind)
// never collide on the same tmp path, and a failed rename unlinks its tmp so
// orphans do not accumulate in .kit/, matching writeCheckpoint in
// kit-compact-lib.js. Returns { ok } or { ok:false, reason }: a filesystem
// failure is reported, never thrown, keeping the whole exported surface
// non-throwing.
function writeState(cwd, state) {
    const gp = goalPath(cwd);
    try {
        fs.mkdirSync(path.dirname(gp), { recursive: true });
        const tmp = gp + '.tmp.' + process.pid;
        try {
            fs.writeFileSync(tmp, JSON.stringify(state, null, 2) + '\n', 'utf8');
            fs.renameSync(tmp, gp);
        } catch (err) {
            try { fs.unlinkSync(tmp); } catch { /* nothing to remove, or it is the unwritable path itself */ }
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
function planHead(cwd, planRel) {
    const full = path.join(cwd, planRel);
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
            return { ok: false, reason: 'plan not found: ' + rel };
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
        // The current plan of the queue. Every other reader of this file
        // (the compaction gate, the stop-failure watcher) answers to this
        // field and to boundSession, so both keep their meaning as the queue
        // advances: plan is what is being worked now.
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
// { ok:false, cleared:false, reason } when the file exists but the delete
// failed (e.g. permissions): the leash is still armed and the caller must not
// report it released. Never throws.
function clearGoal(cwd) {
    const gp = goalPath(cwd);
    try {
        if (!fs.existsSync(gp)) {
            return { ok: true, cleared: false };
        }
        fs.unlinkSync(gp);
        return { ok: true, cleared: true };
    } catch (err) {
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

module.exports = { goalPath, readGoal, armGoal, advanceGoal, bindSession, clearGoal, composeCondition, planHead, emitGoalEvent, normalizePlanArg, lastActivePhrase, isSessionIdShaped };
