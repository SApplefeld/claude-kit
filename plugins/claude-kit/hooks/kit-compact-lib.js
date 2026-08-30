// Shared library for the boundary-gated compaction checkpoint, and for the
// transcript reading its consumers share.
//
// The checkpoint is a small project-scoped JSON file (compact-checkpoint.json
// in the scratch directory kitScratchDir resolves below, gitignored territory
// for an ordinary project) recording the plan path a chapter boundary was reached
// for. It is the signal between two programs that must agree on its path and
// shape: the checkpoint CLI (kit-compact-checkpoint.js) writes it at the
// chapter-close ritual, and the PreCompact gate (kit-compact-gate.js) reads it
// to decide whether a pending auto-compaction may land, consuming (deleting) it
// on the allow so the next mid-chapter attempt is denied again. Single-sourcing
// the path, the read/write/clear operations, and the match rule
// (checkpointMatches, with its age constants) here is what keeps the writer,
// the gate, and the status report from drifting apart.
//
// The gate's decision record (compact-gate.json and its .jsonl log, in that
// same resolved scratch directory) is
// here for the same single-sourcing reason: the gate writes it and the
// checkpoint CLI's status report reads it, so its paths and its shape belong in
// one place.
//
// The transcript helpers (readTranscriptCapped, stripLocalCommandOutput, and
// the automation detection) live here for the same reason: the goal-leash Stop
// hook (kit-goal-stop.js) and the PreCompact gate both read transcript text
// and both must neutralize local-command echoes, and two near-duplicate copies
// of the greedy stripping semantics would drift apart.
//
// Node core modules only, CommonJS, zero dependencies. Every exported function
// that touches the filesystem is wrapped so it never throws: a filesystem
// hiccup degrades to a null/refusal result instead of trapping the caller,
// matching kit-goal-lib.js.

'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { normalizePlanArg, pathErrnoClass, readGoal } = require('./kit-goal-lib.js');
// The gate-log tail read below goes through the shared bounded reader: a
// single readSync may legally return fewer bytes than asked for, and the fill
// loop that closes it belongs to every hook read rather than to this one.
const { readFully } = require('./kit-read-lib.js');

// The directory every file in this library lives in, for a given project
// directory. Two branches, and the second exists because one project
// directory the kit itself creates is inside a replicated tree.
//
// Ordinarily the answer is the project's own `.kit/`, gitignored territory
// beside the work it describes. But the memory store at ~/.claude is a git
// repository the sync pushes to a remote that reaches every machine, and a
// seat whose project directory is the store's coordinator directory would
// otherwise drop its gate state, its journal, and its markers into that
// replicated tree. None of these files is meaningful on another machine: they
// name a session id, a local plan path, and a local clock, and a journal that
// replicates carries one box's decisions into every other box's copy. So a
// project directory lying inside the store resolves instead to a home-
// anchored directory outside it, which nothing syncs, keeping the store-
// relative shape below it so two store-backed project directories cannot
// collide.
//
// The store root is the home directory's .claude, read at call time so a
// fixture home redirects it. One resolver serves every writer here and the
// gate's own reader, which is what keeps a marker's writer and its reader
// agreeing on where it lives.
function kitScratchDir(cwd) {
    const storeRoot = path.join(os.homedir(), '.claude');
    const rel = path.relative(storeRoot, path.resolve(cwd));
    const underStore = !path.isAbsolute(rel) && !/^\.\.(?:[\\/]|$)/.test(rel);
    return underStore
        ? path.join(os.homedir(), '.kit', 'store', rel)
        : path.join(cwd, '.kit');
}

// Path to the checkpoint file for a given repo root.
function checkpointPath(cwd) {
    return path.join(kitScratchDir(cwd), 'compact-checkpoint.json');
}

// How long an open checkpoint stays honorable. There are two bounds, and which
// one applies is decided by the checkpoint's own pendingOffer flag, because the
// two kinds of checkpoint fail in opposite directions.
//
// The TEN-MINUTE leg governs a checkpoint opened with no offer pending, which
// is a boundary reached BELOW the compaction trigger. It has no offer to catch
// and must age out: honoring it later, when the next chapter crosses the
// trigger mid-section, would land the compaction mid-chapter, which is the
// exact placement the gate exists to prevent, and self-sustainingly so (the
// landed compaction resets consumption, the next boundary opens another
// below-trigger checkpoint, and the cycle repeats). The floor on the value is a
// long dispatched tool call: a chapter close followed immediately by a
// multi-minute implementer run delays the next assistant turn, and therefore
// the next compaction offer, past the open, so a bound much under ten minutes
// would start discarding boundaries that were about to be honored. The ceiling
// on it is how long a below-trigger checkpoint can linger before the next
// chapter crosses the trigger, which at the recommended trigger the doctor
// derives is far longer than either number. That figure is deliberately not
// restated here: the doctor computes every displayed number from its own window
// and reserve values, and a copy in this comment would strand the moment either
// changes.
//
// The PENDING leg governs a checkpoint opened while the gate was already
// holding auto-compaction offers, which the checkpoint CLI reads from the
// gate's own state at the open. That boundary has an offer waiting for it, and
// the only thing between the two is the current tool call: past the trigger the
// harness re-offers every assistant turn, so the checkpoint is consumed at the
// first turn after the call returns, with nothing else having run in between.
// The ten-minute leg is the wrong bound for it, and measurably so: dispatched
// implementer and reviewer steps have run 22, 27, 67 and 73 minutes, each of
// which discards a boundary that was about to be honored and lands the
// compaction mid-chapter instead.
//
// Twenty-four hours is an outer sanity cap, not the operational window. What
// actually ends the long leg first is the deferral episode that corroborates
// it: pendingOfferCorroborated needs an OPEN episode, and gateEpisodeOpen
// retires one whose newest denial has aged past GATE_EPISODE_MAX_IDLE_MS, four
// hours. lastDeniedAt advances only on a denial, which happens only at an
// assistant turn, and during the long tool call this leg exists to cover there
// are no turns. So a call outrunning four hours retires the episode and drops
// its checkpoint back to ten minutes. Four hours is the honest ceiling, and the
// measured steps above sit roughly three times inside it rather than an order
// of magnitude. The cap earns its place on the other axis: it bounds a
// hand-made or clock-skewed record that no episode would otherwise retire, and
// the future-skew check below applies to this leg exactly as it does to the
// other.
//
// The flag alone never buys the long leg, and neither does an episode alone:
// the hold must also be owned by this binding and must predate the record.
// pendingOfferCorroborated states why each of those is required.
//
// One residue that corroboration does not close, named rather than engineered
// away: ANY compaction that lands without clearing the episode leaves a hold
// standing that no longer has an offer behind it. Two produce it. A manual
// /compact is never seen at all (the PreCompact matcher is auto-only, so the
// gate does not run). And an allow whose payload carries no session id does run
// but cannot clear the episode, because clearing is scoped to the allower and a
// record with no session owns nothing. In both, an episode that genuinely
// predates a later record vouches for it, so a boundary opened in that shadow
// takes the long leg with nothing waiting for it, and if the context re-crosses
// the trigger before the episode goes idle, one compaction lands mid-chapter.
// The discriminator that would close it, whether a compaction landed by some
// other route, is not observable to a hook that either never ran or never
// learned whose turn it was. The cost is bounded at one mistimed compaction,
// which is the pre-gate status quo.
//
// When either bound misfires the cost is one mid-chapter compaction, the
// pre-gate status quo, so the failure direction stays fail-open.
const CHECKPOINT_MAX_AGE_MS = 10 * 60 * 1000;
const CHECKPOINT_PENDING_MAX_AGE_MS = 24 * 60 * 60 * 1000;

// Skew allowance for a checkpoint whose openedAt sits in the future: a small
// clock adjustment between the write and the read is tolerated, but a far-
// future timestamp is treated as illegible rather than honored, so a clock
// change can never mint an effectively immortal checkpoint.
const CHECKPOINT_FUTURE_SKEW_MS = 2 * 60 * 1000;

// Compare two session ids as opaque, case-insensitive strings (session UUIDs
// are surfaced in mixed case across the harness). Shared by the checkpoint
// match rule, the PreCompact gate, and the goal-leash Stop hook, which must
// all agree on session identity. False when either side is missing, which is
// exactly the treat-as-absent handling an unbound goal or an old-format
// checkpoint needs.
function sameSessionId(a, b) {
    if (!a || !b) return false;
    return String(a).trim().toLowerCase() === String(b).trim().toLowerCase();
}

// The one checkpoint match rule, shared by its two consumers so they cannot
// drift: the PreCompact gate uses the verdict to decide whether a pending
// auto-compaction may land (and the checkpoint be consumed), and the CLI's
// status report uses the reason to say why a checkpoint on disk gates
// nothing. A checkpoint counts only when its recorded plan equals the armed
// goal's plan, its recorded boundSession equals the goal's current
// boundSession, and its openedAt is fresh (parseable, within the age bound that
// applies to it, and no further than CHECKPOINT_FUTURE_SKEW_MS into the
// future).
//
// Which age bound applies takes TWO facts, not one. The record's own
// pendingOffer flag says an offer was being held when the boundary was
// declared; pendingCorroborated says a hold that predates the record is still
// standing at the moment of the decision. Both must be true for the long bound;
// otherwise the ten-minute bound applies. Callers get the second from
// pendingOfferCorroborated, which owns the rule and the reasons the flag alone
// cannot carry it.
//
// This rule stays pure: it is told the answer rather than reading any state, so
// the CLI's report and the gate's decision cannot diverge on it. An absent or
// non-true pendingCorroborated falls back to the ten-minute bound, which is the
// fail-safe direction and is deliberate: a caller that forgets the argument, or
// cannot read the state to answer it, narrows the window rather than widening
// it.
//
// Returns { ok:true, reason:null } on a match, else { ok:false, reason } with
// reason naming the first failed clause in evaluation order:
//   'no-checkpoint'  cp is missing or carries no plan string
//   'no-goal'        goal is missing or carries no plan string
//   'wrong-plan'     the plans differ (a stale file from a prior run)
//   'wrong-session'  the bound sessions differ (an orphan from a crashed run,
//                    or an unbound side on either record)
//   'no-timestamp'   openedAt is missing or does not parse as a date
//   'expired'        openedAt is older than the bound that applied:
//                    CHECKPOINT_PENDING_MAX_AGE_MS when the record claims
//                    pendingOffer AND the caller corroborates that offers are
//                    still being held, CHECKPOINT_MAX_AGE_MS in every other
//                    case, an uncorroborated pending record included
//   'future'         openedAt is beyond the future skew allowance
// Never throws on JSON-derived input: every access is guarded and Date.parse
// returns NaN on garbage. nowMs exists so a caller can pin the clock; an
// absent or illegible value means the current time.
function checkpointMatches(cp, goal, nowMs, pendingCorroborated) {
    const now = (typeof nowMs === 'number' && Number.isFinite(nowMs)) ? nowMs : Date.now();
    if (!cp || typeof cp !== 'object' || typeof cp.plan !== 'string') {
        return { ok: false, reason: 'no-checkpoint' };
    }
    if (!goal || typeof goal !== 'object' || typeof goal.plan !== 'string' || goal.plan === '') {
        return { ok: false, reason: 'no-goal' };
    }
    if (cp.plan !== goal.plan) return { ok: false, reason: 'wrong-plan' };
    if (!sameSessionId(cp.boundSession, goal.boundSession)) return { ok: false, reason: 'wrong-session' };
    if (typeof cp.openedAt !== 'string') return { ok: false, reason: 'no-timestamp' };
    const opened = Date.parse(cp.openedAt);
    if (!Number.isFinite(opened)) return { ok: false, reason: 'no-timestamp' };
    const age = now - opened;
    // Both legs are tested for a literal true, so an older three-field record,
    // a hand-edited one carrying a truthy value of some other shape, and a
    // caller that passed nothing all take the ten-minute leg.
    const maxAge = (cp.pendingOffer === true && pendingCorroborated === true)
        ? CHECKPOINT_PENDING_MAX_AGE_MS
        : CHECKPOINT_MAX_AGE_MS;
    if (age > maxAge) return { ok: false, reason: 'expired' };
    if (age < -CHECKPOINT_FUTURE_SKEW_MS) return { ok: false, reason: 'future' };
    return { ok: true, reason: null };
}

// The size of the REGULAR file at this path: 0 when nothing is there, and null
// when the path cannot be safely written through, either because something
// other than a regular file is sitting on it (a symlink or junction, a
// directory, a FIFO) or because its kind could not be determined at all. The
// check is an lstat, so a link is judged as a link rather than as whatever it
// points at.
//
// Only ENOENT reads as "nothing there, go ahead". Every other lstat failure
// (EACCES, EPERM, EBUSY: a permission, a lock, a scanner holding the file) is
// an unknown answer, and answering an unknown with the go-ahead value is the
// mistake readGateStateResult exists to avoid. Every caller decides what an
// unknown means for itself: endsOnLineBoundary turns this null into false, its
// own fail-safe, so a transient failure yields a spare blank line rather than
// the fused record a go-ahead answer would produce.
function regularFileSize(target) {
    let st;
    try {
        st = fs.lstatSync(target);
    } catch (err) {
        return (err && err.code === 'ENOENT') ? 0 : null;
    }
    return st.isFile() ? st.size : null;
}

// The checkpoint's read cap. The writer produces four short fields, a couple of
// hundred bytes, and never grows. Anything past 64 KB is not something this
// wrote, and reading it whole on a hook path that runs before any verdict is
// emitted is cost with nothing to gain.
const CHECKPOINT_MAX_BYTES = 64 * 1024;

// Read and parse the checkpoint file. Returns the parsed object, or null if
// the file is absent, refused, unreadable, or not valid JSON. The content is
// untrusted data (the file is user-writable): callers compare its plan against
// the armed goal's and must never surface its values unsanitized.
//
// The path must be a regular file of sane size before it is opened, judged by
// an lstat, which is the same preamble the gate-state reader
// applies and is here for the same reason: three of this function's callers run
// on paths where blocking is not recoverable. The PreCompact gate reads the
// checkpoint before any verdict is emitted, the goal-leash Stop hook reads it
// while holding a stop, and the deferral nudge reads it inside the tool loop,
// on a covered tool return while a deferral episode stands, which is the most
// frequent of the three. (The checkpoint CLI is the fourth caller and the only
// one a human is waiting on.)
// A FIFO planted at THIS path would block any of them
// inside readFileSync forever, where no try/catch can rescue it, and a link
// would be followed into whatever it names. Being an lstat, the check judges a
// link as a link rather than as its target.
//
// What this covers is this one path, and nothing else those callers touch. It
// narrows rather than closes even here, since the open below re-resolves the
// path, the same honest account the readers beside it give of their own; and
// the callers reach other files by other readers, each of which answers for
// itself. A path is safe because the reader that opens it checks, so this
// comment claims that guard and no more.
function readCheckpoint(cwd) {
    try {
        return readCheckpointResult(cwd).cp;
    } catch {
        return null;
    }
}

// The same read, with why it produced no checkpoint. Returns { ok, cp, reason }:
//
//   { ok: true,  cp }                     a parsed checkpoint
//   { ok: true,  cp: null, 'absent' }     nothing is at the path
//   { ok: true,  cp: null, 'illegible' }  a regular file that is not JSON
//   { ok: false, cp: null, 'kind' }       something that is not a regular file
//   { ok: false, cp: null, 'oversized' }  a regular file past the read cap
//   { ok: false, cp: null, 'unreadable' } the read itself was refused
//   { ok: false, cp: null, 'lstat' }      the path's own kind could not be read
//
// The gate and the two hooks take readCheckpoint above, because all seven mean
// the same thing to them: no checkpoint gates anything. The status report takes
// this, because the seven do not mean the same thing to an operator, and because
// the reasons an operator acts on differently cannot be recovered by re-asking
// with a second syscall: an lstat run afterwards reports an ordinary regular
// file for the 'unreadable' leg, which is how a locked file comes to be
// described as illegible and offered a remedy that will fail.
function readCheckpointResult(cwd) {
    const target = checkpointPath(cwd);
    let st;
    try {
        st = fs.lstatSync(target);
    } catch (err) {
        if (err && err.code === 'ENOENT') return { ok: true, cp: null, reason: 'absent' };
        return { ok: false, cp: null, reason: 'lstat' };
    }
    if (!st.isFile()) return { ok: false, cp: null, reason: 'kind' };
    if (st.size > CHECKPOINT_MAX_BYTES) return { ok: false, cp: null, reason: 'oversized' };
    let raw;
    try {
        raw = fs.readFileSync(target, 'utf8');
    } catch (err) {
        if (err && err.code === 'ENOENT') return { ok: true, cp: null, reason: 'absent' };
        return { ok: false, cp: null, reason: 'unreadable' };
    }
    try {
        return { ok: true, cp: JSON.parse(raw), reason: null };
    } catch {
        return { ok: true, cp: null, reason: 'illegible' };
    }
}

// The temporary path an atomic write renames from, shared by every writer in
// this file. The pid keeps two writers off one name; the random suffix keeps
// the name from being predictable, because a link pre-planted at a guessable
// tmp path would be followed by the write that creates it. The exclusive flag
// each caller passes at the open is the actual defense (a pre-planted path
// fails the create outright); the unguessable name is what keeps an attacker
// from winning that race repeatedly.
//
// The unguessable name carries a second property, and it is load-bearing: the
// writers unlink their tmp on failure, so a name an attacker could predict
// would let them aim that unlink at a file of their choosing inside .kit/.
// Each writer therefore gates its cleanup on whether its own exclusive create
// returned, not on the errno of whatever failed: a create refused because the
// path was occupied deletes nothing, while every failure after a create that
// did return removes the file this writer made. Reading an errno instead would
// rest on a platform mapping, and a post-create failure reporting EEXIST would
// leak the temp file. The two defenses are independent: making this name
// predictable again, for testability or anything else, reopens an aimed delete
// that nothing else here would catch.
function atomicTmpPath(target) {
    return target + '.tmp.' + process.pid + '.' + crypto.randomBytes(6).toString('hex');
}

// Write the checkpoint atomically (tmp file + rename), recording the plan it
// belongs to, the session the goal is currently bound to, and whether an
// auto-compaction offer was already being held when the boundary was declared.
// Returns { ok:true, plan } or { ok:false, reason }; never throws.
//
// The plan path is validated through kit-goal-lib's normalizePlanArg, in
// putCheckpoint below, where every writer of this file inherits it: it rejects
// control characters and any path that escapes cwd, and the NORMALIZED form is
// what gets stored, so the returned plan is that form rather than the argument
// as given. For a
// plan armGoal wrote, normalization is idempotent, so the stored value equals
// the goal's and the gate's equality check matches; a hand-edited goal state
// carrying a value armGoal would never have written either refuses here or
// stores a normalized form the gate reads as absent, both of which degrade to
// the status quo rather than opening the gate on untrusted input.
//
// boundSession pins the checkpoint to the run that opened it: the gate treats
// a checkpoint whose recorded boundSession does not match the goal's as
// absent, so a checkpoint orphaned by a crash cannot open the gate for the
// re-bound session that resumes the plan. The value is copied from the goal
// state, so it is held to bindSession's own storage rules (a string, capped
// length, no control characters); null is stored as null (an unbound goal),
// which no binding equals, and such a record is given an owner by
// adoptCheckpoint at the moment a claim point binds one.
//
// pendingOffer records whether an auto-compaction offer was already being held
// when this boundary was declared, which is one of the two facts that select
// the age bound the match rule holds the record to (see CHECKPOINT_MAX_AGE_MS;
// the other is corroboration at the moment of the decision). Every caller reads
// it from the gate's own decision state at the moment it writes. Anything other
// than true stores false, so a caller with no answer records the conservative
// one.
//
// The atomic write, the unpredictable tmp name and the cleanup that removes
// only what this writer created are writeJsonAtomic's, reached through
// putCheckpoint below, which owns every field this file stores.
function writeCheckpoint(cwd, planRel, boundSession, pendingOffer) {
    return putCheckpoint(cwd, {
        plan: planRel,
        boundSession,
        openedAt: new Date().toISOString(),
        pendingOffer: pendingOffer === true
    });
}

// The storage rules the checkpoint's owner field is held to, as { ok, value }:
// a string, non-empty, within the 128-character cap and free of control
// characters, which is the shape bindSession stores a binding under, or an
// explicit null for an unbound goal. Absent and null are the same answer, so a
// caller with no owner records null rather than a coerced string. One
// definition, because two writers store the field (an open and an adoption) and
// a rule spelled twice is a rule one of them ends up spelling loosely.
function storableCheckpointOwner(value) {
    if (value === undefined || value === null) return { ok: true, value: null };
    if (typeof value !== 'string' || value === '' || value.length > 128
        || /[\x00-\x1F]/.test(value)) {
        return { ok: false, value: null };
    }
    return { ok: true, value };
}

// Put a composed record at the checkpoint path, atomically. The sole writer of
// that file, and the one gate every stored field passes: its callers supply the
// plan, the owner, the timestamp and the flag, and this validates and writes
// them, so a second writer cannot store a path or an owner the first one would
// have refused. The plan goes through kit-goal-lib's normalizePlanArg (control
// characters and any path escaping cwd are refused, and the NORMALIZED form is
// what gets stored), and the owner through the storage rules above.
//
// verify is optional and is handed straight to writeJsonAtomic, which runs it in
// the last moment before the rename with the temporary file already written:
// returning anything but true abandons the write. A caller whose record is a
// rewrite of something it read passes one; a caller publishing a record of its
// own passes none.
//
// Returns { ok:true, plan } with the stored path, or { ok:false, reason }, and
// never throws.
function putCheckpoint(cwd, state, verify) {
    const plan = normalizePlanArg(cwd, state && state.plan);
    if (plan === null) {
        return { ok: false, reason: 'plan path is invalid or outside the repo' };
    }
    const owner = storableCheckpointOwner(state.boundSession);
    if (!owner.ok) {
        return { ok: false, reason: 'bound session is invalid' };
    }
    const target = checkpointPath(cwd);
    try {
        fs.mkdirSync(path.dirname(target), { recursive: true });
        const published = writeJsonAtomic(target, {
            plan,
            boundSession: owner.value,
            openedAt: state.openedAt,
            pendingOffer: state.pendingOffer === true
        }, verify);
        if (!published) {
            return { ok: false, reason: 'the checkpoint on disk changed under this write, so it was left alone' };
        }
    } catch (err) {
        return { ok: false, reason: 'could not write checkpoint: ' + (err && err.message ? err.message : String(err)) };
    }
    return { ok: true, plan };
}

// Delete the checkpoint file if present. Returns { ok:true, cleared:true } when
// a file was removed, { ok:true, cleared:false } when none was open, and
// { ok:false, cleared:false, reason } when a file is there and the delete failed
// or its kind could not be read. Never throws. The gate calls this to consume a
// matching checkpoint; a failed delete there degrades to the gate standing open
// (compaction lands mid-chapter, the pre-gate status quo), never to a wedged
// session.
//
// Presence is judged by the same lstat kind rule readCheckpoint applies, not by
// fs.existsSync, which follows a link: a junction or a link at this path reads
// as no checkpoint open to the gate and to status, so a clear that followed it
// would report a checkpoint consumed that nothing ever read as open. A failed
// lstat is routed by pathErrnoClass, the classification clearGoal takes at the
// same leg of the same question: a determinate code means nothing is at the path
// and nothing can be, so there is nothing to clear and nothing to wait out,
// while a transient one is a failed clear, because reporting a locked file as
// absent tells the caller a thing was released that is still sitting there.
function clearCheckpoint(cwd) {
    const cp = checkpointPath(cwd);
    try {
        let st;
        try {
            st = fs.lstatSync(cp);
        } catch (err) {
            if (pathErrnoClass(err && err.code) !== 'transient') {
                return { ok: true, cleared: false };
            }
            throw err;
        }
        if (!st.isFile()) {
            return { ok: true, cleared: false };
        }
        fs.unlinkSync(cp);
        return { ok: true, cleared: true };
    } catch (err) {
        // A delete that finds nothing there is the gate having consumed the
        // checkpoint between the kind check above and this call: nothing was
        // cleared here, and the consumer that removed it is the one that acted.
        // It is the "none open" answer, not a failed clear, which is what
        // clearGoal's own racing-ENOENT leg says about the same shape.
        if (err && err.code === 'ENOENT') {
            return { ok: true, cleared: false };
        }
        return {
            ok: false,
            cleared: false,
            reason: 'could not clear checkpoint: ' + (err && err.message ? err.message : String(err))
        };
    }
}

// Whether a record on disk is one a claim would take over, as
// { ok, reason }: the record-side half of the adoption rule, pure and doing no
// IO, so the CLI's status report can describe a record's fate by the same rule
// that decides it rather than by a second copy of the conditions.
//
// Each clause bounds what an adoption can reach:
//   'no-checkpoint' nothing legible is there
//   'no-goal'       no armed plan to adopt it for
//   'wrong-plan'    the record names another plan, so a leftover from a prior
//                   plan (or from a queue position already advanced past) is
//                   never taken
//   'owned'         the record already names a session, judged by the same
//                   storage rule the writer stores owners under, so a value
//                   that rule cannot support ('' and its neighbours) reads as
//                   no owner rather than as an owner nothing can ever match
//   'no-timestamp'  no parseable openedAt, which no reader could use anyway
//
// What it does NOT answer is whether a claim is still coming, which is the
// goal's business rather than the record's: the claim points call this with a
// goal whose binding they have just set, so a binding test here would decline
// every real adoption. A caller asking "will anything ever adopt this" tests
// the goal's own binding beside this answer.
function checkpointAdoptable(cp, goal) {
    if (!cp || typeof cp !== 'object' || typeof cp.plan !== 'string') {
        return { ok: false, reason: 'no-checkpoint' };
    }
    if (!goal || typeof goal.plan !== 'string' || goal.plan === '') {
        return { ok: false, reason: 'no-goal' };
    }
    if (cp.plan !== goal.plan) return { ok: false, reason: 'wrong-plan' };
    if (storableCheckpointOwner(cp.boundSession).value !== null) {
        return { ok: false, reason: 'owned' };
    }
    if (typeof cp.openedAt !== 'string' || !Number.isFinite(Date.parse(cp.openedAt))) {
        return { ok: false, reason: 'no-timestamp' };
    }
    return { ok: true, reason: null };
}

// Give an ownerless checkpoint the owner of the leash, at the moment a claim
// point binds one. A goal that is unbound when a chapter boundary is declared
// records no owner on the checkpoint it opens, because the record copies the
// goal's binding and there is none to copy; the match rule then reads that
// record and the now-bound goal as two different sessions, so the boundary the
// run banked is discarded under a reason naming a session mismatch that never
// happened. Adopting the record at the claim keeps the match rule comparing two
// concrete owners, which is the one comparison every other verdict runs.
//
// checkpointAdoptable owns which records may be taken. What this adds is the
// owner to write and the write itself, and the write carries over openedAt
// VERBATIM, so the record ages from the boundary it was opened at: an adoption
// grants no freshness, a record already past its bound stays expired, and the
// pending flag is copied as recorded rather than raised.
//
// The write is abandoned rather than published if the record on disk moved
// between the read and the rename, which is not the single-writer case the gate
// assumes elsewhere: that serialization runs through the one bound session, and
// this runs precisely while there is none, so a checkpoint CLI open racing this
// adoption is a real ordering. The verify runs in writeJsonAtomic's last moment
// before the rename, and comparing the three fields that identify the record is
// enough, because every writer of this file writes all four at once: a record
// whose plan, opened timestamp and ownerlessness are unchanged is the record
// that was read. The verify narrows the window rather than closing it: there is
// no lock, so a newer boundary landing before the verify reads survives, and one
// landing between that read and the rename is overwritten. The residual is
// bounded and fail-open, costing one further deferral rather than a lost plan.
//
// Returns { ok, adopted, reason } and never throws. adopted is true only when a
// record was rewritten; every other outcome, an absent checkpoint included, is
// { ok: true, adopted: false } with the reason naming the clause that declined,
// since a claim with no checkpoint open is the ordinary case rather than a
// failure. A failed write is { ok: false }: the caller's claim stands either
// way, and the boundary is lost to a deferral, which is the pre-adoption
// behavior and the same degradation a .kit/ refusing checkpoint writes gives.
function adoptCheckpoint(cwd, goal, sessionId) {
    const owner = storableCheckpointOwner(sessionId);
    if (!owner.ok || owner.value === null) return { ok: true, adopted: false, reason: 'no-session' };
    const cp = readCheckpoint(cwd);
    const adoptable = checkpointAdoptable(cp, goal);
    if (!adoptable.ok) return { ok: true, adopted: false, reason: adoptable.reason };
    const written = putCheckpoint(cwd, {
        plan: goal.plan,
        boundSession: owner.value,
        openedAt: cp.openedAt,
        pendingOffer: cp.pendingOffer === true
    }, () => {
        const now = readCheckpoint(cwd);
        return !!now && now.plan === cp.plan && now.openedAt === cp.openedAt
            && storableCheckpointOwner(now.boundSession).value === null;
    });
    if (!written.ok) return { ok: false, adopted: false, reason: written.reason };
    return { ok: true, adopted: true, reason: null };
}

// ---------------------------------------------------------------------------
// The gate's decision record.
//
// The PreCompact gate takes a verdict on every auto-compaction offer and, until
// it writes one down, leaves no trace: a run held for a whole section, a
// checkpoint that expired seconds before the agent returned, and a safety-valve
// fire are indistinguishable afterwards. Two project-local files under .kit/
// carry that record. The STATE (compact-gate.json) is the newest decision plus
// the deferral episode currently standing, read by the checkpoint CLI's status
// report; it is rewritten in place, so it stays one small file. The LOG
// (compact-gate.jsonl) is append-only and is what an operator reads to answer
// "how often, and why" across a whole run.
//
// Each file has TWO writers and the log carries TWO record classes. The gate
// records a decision (recordGateDecision, from the PreCompact hook); the
// deferral nudge stamps the episode and journals that it spoke
// (recordEpisodeNudge, from the tool loop). A decision line carries `verdict`
// and a nudge line carries `event`, which is how a reader partitions the log
// without guessing. A consumer folding every line through gateRecord() sees
// only decisions, since that rebuilder returns null for a record with no
// recognized verdict: that is a correct decision-only reading, not a whole-log
// one.
//
// Both files are written after the verdict, or after the emission decision, is
// already made, and a failure to write cannot change it. recordGateDecision
// swallows every failure and returns nothing a caller branches on, so a full
// disk or a read-only .kit degrades to a gate that decides exactly as it did
// before, silently. The nudge is the one exception and it is deliberate: its
// `nudgedAt` is not diagnostic, it IS the interval, and its stamp is the only
// cross-process carrier that interval has, so recordEpisodeNudge returns a
// boolean its caller gates the emission on, and a failed stamp yields silence.
// The journal line stays diagnostic on both writers. The ordering matters as
// much as the swallowing: a path that could block (a FIFO planted at either
// file) cannot delay a verdict that has already been emitted.
//
// The record is written only in a project that is ALREADY kit-governed. An
// existing .kit/ directory is the ordinary evidence: the gate runs on every
// auto-compaction offer on the machine, including in repositories that have
// nothing to do with the kit, and creating an untracked directory of session
// ids and token readings in someone's unrelated checkout is a cost the
// diagnostic does not earn. The one .kit/ these writers do create is a
// directory an armed goal resolves for that has none of its own, and only
// then: goal state lives in the main checkout, so a leashed run in a linked
// worktree arrives with no local .kit/ at all, and refusing there would take
// every deny unrecorded and silence the deferral nudge in exactly the place
// the record exists for. An armed goal is the same already-governed evidence
// an existing .kit/ is, so a stranger's checkout still gets nothing. Only
// .kit itself is ever created, never its parents.
//
// Both files must be regular files, and .kit/ itself must be a real directory
// rather than a link to one. A symlink, junction, or FIFO planted at any of the
// three is refused rather than followed: appending through a link writes into
// its target on every assistant turn, trimming through one lands a megabyte of
// an arbitrary readable file inside .kit/, and a FIFO blocks a read or a write
// forever where no try/catch can rescue it. Each check is an lstat, so a link
// is judged as a link rather than as whatever it points at.
//
// A HARDLINK is the member of that class these checks admit: it is a regular
// file and passes, so a hardlink planted at either path receives the record's
// writes. That is left open on purpose, matching the posture the kit already
// takes for its goal-event sink, and the exposure is bounded by what lands
// there: this file's own JSON, in a project the actor can already write to.
//
// Those checks NARROW the window rather than closing it, the same honest
// account readTranscriptCapped gives of its own isFile() check: the path is
// re-resolved by the open that follows, so a swap landing between the two is
// still possible. Closing it needs a single open plus an fstat on the
// descriptor, a restructure this diagnostic does not earn, and what rides
// through the residual window is well-formed JSON appended to a path the actor
// already controls. The temporary files both writers rename through are created
// exclusively (O_EXCL) under an unpredictable name, so the one path an attacker
// could otherwise pre-plant is not guessable and would fail the open anyway.
//
// That acceptance now has to cover a caller in the TOOL LOOP as well as the
// PreCompact one, since the nudge journals from there and a stalled tool loop
// is the one failure that hook must never cause. It still holds, on a narrower
// argument. Reaching the window needs a hostile writer already inside .kit/ in
// this project, racing a path that opens for a few microseconds per fire; the
// blocking shapes are refused by the lstat legs above; and the harness's own
// hook timeout bounds anything that does slip through, so the worst case is one
// dropped journal line or one timed-out hook process, never a wedged loop.
//
// Every value stored here that came from outside (the harness's session id, the
// checkpoint file's own contents, and a prior state file, which is user-writable
// like every other file under .kit/) is rebuilt field by field on the way in and
// on the way out, so neither a forged state file nor an odd payload can grow the
// file without bound or push control characters into an operator's terminal.
// ---------------------------------------------------------------------------

// Path to the gate's decision state for a given repo root.
function gateStatePath(cwd) {
    return path.join(kitScratchDir(cwd), 'compact-gate.json');
}

// Path to the gate's append-only decision log for a given repo root.
function gateLogPath(cwd) {
    return path.join(kitScratchDir(cwd), 'compact-gate.jsonl');
}

// The log's bound. Both record classes run a few hundred bytes or less, and
// both writers are rare: the gate fires at most once per assistant turn, and
// the nudge at most once per NUDGE_INTERVAL_MS per tool batch while a hold
// stands. Their sum is still well inside 2 MB for months of dense use; past it
// the writer keeps the newest 1 MB and drops the rest. Trimming to half the cap
// rather than to the cap itself is what keeps the rewrite rare: at a 1-byte
// margin every subsequent append would rewrite the whole file.
const GATE_LOG_MAX_BYTES = 2 * 1024 * 1024;
const GATE_LOG_KEEP_BYTES = 1 * 1024 * 1024;

// How long a deferral episode stands without a new denial before a reader
// treats it as finished rather than as the hold currently in force.
//
// The episode's whole claim is about right now: "the gate is holding offers,
// and has been for M minutes" is what makes an operator or a nudge act. Nothing
// on disk marks the end of one, because the events that end an episode without
// an allow reaching this file leave no trace to write: a manual /compact (the
// PreCompact matcher is auto-only, so the gate never runs), a session that
// simply ends, an offer that never comes again. So the newest denial's age is
// the only evidence of whether the hold is still real, and past this window the
// count is history rather than state.
//
// The floor is the longest gap there can be between two denials of one genuine
// episode, which is one assistant turn, which is the longest tool call a
// session makes: dispatched implementer and reviewer runs have been measured at
// 22, 27, 67 and 73 minutes. Four hours clears the longest of those by better
// than three times, so no real hold is ever cut short. The ceiling is that a
// count must not survive a break long enough to make it a different working
// session: four hours does not survive a night, a morning off, or a day spent
// in another project, which is where a stale "held 16 offers over 1387 minutes"
// would read as a missed boundary and push an operator into forcing a
// checkpoint open mid-chapter, the exact mis-scheduling the gate exists to
// prevent.
//
// This value also bounds how long a declared boundary stays honorable, which it
// did not when it was first written. The long checkpoint age leg needs a
// standing episode to corroborate it (see pendingOfferCorroborated), and this
// is what retires one, so a pending checkpoint dies when its episode goes idle
// here, well before CHECKPOINT_PENDING_MAX_AGE_MS caps it. The two constants
// answer different questions and are deliberately separate, but they are no
// longer independent: shortening this one shortens the pending leg with it.
// Both release markers' windows are defined as this value outright,
// CONSENT_MAX_AGE_MS and ROLE_BOUNDARY_MAX_AGE_MS alike, so tuning this
// constant retunes two windows and not one: how long an operator-consent
// marker stays honorable, and how long a seat's declared role boundary does.
// Those are the windows in the release design bounded by code rather than
// prose; the derivations and their reasoning live at those constants.
const GATE_EPISODE_MAX_IDLE_MS = 4 * 60 * 60 * 1000;

// The verdicts a record may carry, and the only values recordGateDecision
// accepts: an unrecognized verdict is not written at all, because a state file
// the CLI and the nudge read has to be legible to both.
const GATE_VERDICTS = ['allow', 'deny-boundary', 'deny-interactive'];

// The reasons a record may carry: the gate clause that decided, the
// checkpoint match rule's own codes, which are what a boundary deny reports,
// and the two release reasons a marker-driven allow journals (role-boundary,
// operator-consent), which are how a run's compaction history states which
// release landed it. The vocabulary is closed and this library is the only
// thing that writes it, so a value outside it came from a hand-edited state
// file rather than from the gate. Reason reaches the CLI's status report, a
// channel a model reads, and the charset and length caps alone would let
// arbitrary prose through; checking the value against the list it is drawn
// from costs nothing and bounds it to this file's own words.
const GATE_REASONS = [
    'not-auto', 'external-engine', 'no-session', 'no-goal', 'bystander',
    'automation', 'checkpoint', 'valve', 'illegible',
    'role-boundary', 'operator-consent',
    'no-checkpoint', 'wrong-plan', 'wrong-session', 'no-timestamp', 'expired', 'future'
];

// A string safe to store and to print back: printable ASCII, length-capped,
// null for anything else (an empty string included, which reads as absent
// everywhere here). Applied to every string field on the way in and again on
// the way out, so a state file hand-edited between the two still cannot carry
// control characters into a terminal or megabytes into the next write.
function gateText(value) {
    if (typeof value !== 'string') return null;
    const clean = value.replace(/[^\x20-\x7E]/g, '').slice(0, 128);
    return clean === '' ? null : clean;
}

// A count safe to store and to print back: a non-negative integer, clamped.
// The clamp is what keeps the "two integers and nothing else" bound the stderr
// note and the status report claim: a planted denials of 1e308 is a finite
// number, and JavaScript renders it as "1e+308", which is neither an integer
// nor anything an operator can read as a count of offers. A billion is past
// every real reading (offers are counted per assistant turn, tokens per
// context) and still renders in full digits.
const GATE_COUNT_MAX = 1000000000;

function gateCount(value) {
    if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) return null;
    return Math.min(Math.floor(value), GATE_COUNT_MAX);
}

// Rebuild a decision record from an arbitrary object, or null when it is not
// one. The shape is the whole contract between the gate (writer) and the CLI
// and nudge (readers): `at` when it was taken, `verdict`, `reason` naming the
// clause that decided, `consumed` the token reading behind it or null,
// `checkpoint` the facts of the checkpoint file that was on disk or null, and
// `session` the harness's id for the compacting session.
function gateRecord(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
    if (!GATE_VERDICTS.includes(value.verdict)) return null;
    let checkpoint = null;
    const cp = value.checkpoint;
    if (cp && typeof cp === 'object' && !Array.isArray(cp)) {
        checkpoint = {
            ageSeconds: (typeof cp.ageSeconds === 'number' && Number.isFinite(cp.ageSeconds))
                ? Math.round(cp.ageSeconds) : null,
            pendingOffer: cp.pendingOffer === true,
            // Whether the flag was vouched for at the moment of the decision.
            // Without it the log cannot tell the three expiries apart, and they
            // mean different things to whoever reads it: an ordinary
            // below-trigger leftover aging out, a boundary the operator really
            // did open being discarded for want of a standing hold, and the
            // outer sanity cap firing. The middle one is the defect this
            // section exists to make visible, and it reads as either of the
            // others without this field.
            corroborated: cp.corroborated === true
        };
    }
    const reason = gateText(value.reason);
    return {
        at: gateText(value.at),
        verdict: value.verdict,
        reason: GATE_REASONS.includes(reason) ? reason : null,
        consumed: gateCount(value.consumed),
        checkpoint,
        session: gateText(value.session)
    };
}

// Rebuild a deferral episode: the run of denials standing with no allow after
// it. `session` is the session being held, `since` dates the first denial,
// `denials` counts them, `lastDeniedAt` dates the newest, and `nudgedAt` is when
// the deferral nudge last spoke, so it can hold its interval across processes.
//
// Null unless the episode is genuinely open, which means every field an episode
// is read FOR is legible: an owning session, a count of at least one, and two
// timestamps that parse. A half-written or hand-edited record ({} being the
// easy case) reads as no episode rather than as an open one holding zero offers
// since no time at all, so no consumer has to re-derive openness with a guard
// of its own.
//
// The session requirement is what keeps an unownable episode off the disk: every
// writer here records one, so a record without it is hand-made or from an older
// version, and honoring it would let a record nobody can clear hold the single
// slot for its whole idle window.
//
// nudgedAt is stamped by recordEpisodeNudge below, the one writer of a nudgedAt
// VALUE (nextGateState carries the field through on an extension and nulls it
// when a fresh boundary deny opens an episode), and read by the deferral nudge
// hook, which uses it as the cross-process carrier for its own interval. It is
// carried through every rebuild so a hold spoken to once is not spoken to again
// on the next tool return.
function gateEpisode(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
    const session = gateText(value.session);
    const since = gateText(value.since);
    const lastDeniedAt = gateText(value.lastDeniedAt);
    const denials = gateCount(value.denials) || 0;
    if (!session) return null;
    if (denials < 1) return null;
    if (!since || !Number.isFinite(Date.parse(since))) return null;
    if (!lastDeniedAt || !Number.isFinite(Date.parse(lastDeniedAt))) return null;
    return {
        session,
        since,
        denials,
        lastDeniedAt,
        nudgedAt: gateText(value.nudgedAt)
    };
}

// The deferral episode a state has open RIGHT NOW, or null: the one predicate
// for that question, so no reader has to re-derive it. Its readers are the
// gate's stderr note, the checkpoint CLI's status report and hold test, the
// Stop hook's queue advance, and the deferral nudge's own guard. An episode whose
// newest denial has aged past GATE_EPISODE_MAX_IDLE_MS is finished, not open.
// nowMs exists so a caller can pin the clock; an absent or illegible value
// means the current time.
//
// sessionId is optional and answers a different question than omitting it does.
// Supplied, an episode belonging to any other session reads as NOT open, which
// is what every decision-shaped question wants: one session must never act on
// a hold another session is under. Omitted, any open episode counts, which is
// what a human reading `status` wants, since the question there is whether this
// project is holding offers at all. An explicit null is a session id that
// exists and matches nothing, not an omission: a decision carrying no session
// id can own no episode.
//
// The gate's note supplies the deciding session's id; status omits it. A caller
// asking whether to act on a hold supplies one, and an unbound goal supplies an
// explicit null, which matches nothing.
function gateEpisodeOpen(state, nowMs, sessionId) {
    const episode = state ? gateEpisode(state.episode) : null;
    if (!episode) return null;
    const now = (typeof nowMs === 'number' && Number.isFinite(nowMs)) ? nowMs : Date.now();
    const last = Date.parse(episode.lastDeniedAt);
    if (now - last > GATE_EPISODE_MAX_IDLE_MS) return null;
    // The other direction needs a bound too, and for the reason the checkpoint
    // rule already states: a denial dated into the future (a hand-edited file, a
    // restored VM snapshot, a backward clock correction) has a negative age that
    // no idle bound can ever exceed, so the episode would stand forever while
    // reporting itself as zero minutes old. The same skew allowance the
    // checkpoint uses applies here, rather than a second constant answering the
    // same question.
    if (last - now > CHECKPOINT_FUTURE_SKEW_MS) return null;
    if (sessionId !== undefined && !sameSessionId(episode.session, sessionId)) return null;
    return episode;
}

// The session a checkpoint question is scoped to, from an armed goal: its bound
// session, or an explicit null when it has none.
//
// Null and undefined are different answers downstream, which is the whole
// reason this exists rather than reading goal.boundSession at each site. An
// explicit null is a session id that matches nothing, so an unbound goal
// corroborates nothing, which is right: its checkpoint records boundSession
// null and the gate never matches one. Undefined, passed to gateEpisodeOpen,
// means "any open episode counts", so a bystander's hold would answer a
// question about this run's boundary. Four callers need that distinction
// (the PreCompact gate, the checkpoint CLI, the goal-leash Stop hook's queue
// advance, and the deferral nudge), and four hand-written copies of it is how
// one of them silently ends up asking the wrong question.
function checkpointOwner(goal) {
    return (goal && typeof goal.boundSession === 'string' && goal.boundSession !== '')
        ? goal.boundSession
        : null;
}

// Does a standing deferral episode corroborate this checkpoint's pendingOffer
// flag? This is the second of the two facts checkpointMatches needs before it
// grants the long age bound, and it is single-sourced here because all four
// callers of the match rule (the PreCompact gate, the checkpoint CLI's status
// report, the goal-leash Stop hook's queue advance, and the deferral nudge's
// guard 7) must answer it identically.
//
// Three things must hold. The record must claim the flag. An episode must be
// open for the given owner, which is gateEpisodeOpen's question, including its
// idle and future-skew bounds. And the episode must PREDATE the record.
//
// That last test is what keeps the gate from corroborating itself. A boundary
// deny writes an episode owned by the denying session, dated at the deny. So
// without it: an offer arrives against a six-hour-old pending checkpoint, is
// denied on the short leg (no episode yet), and that denial's own record mints
// an episode; the next offer, one assistant turn later, reads that episode,
// corroborates, and honors the very checkpoint just rejected. The record is
// never consumed on a deny, so it is still sitting there to be honored. Since
// an extending deny keeps the standing episode's `since`, an episode minted
// this way stays too young forever rather than aging into eligibility.
//
// A real deferral is unaffected: the deny comes first, the boundary is declared
// after it, and the record's openedAt is therefore later than the episode's
// since. Equal timestamps count as predating, since a record opened in the same
// millisecond as a denial is the legitimate ordering at its limit.
//
// Both timestamps must parse. A NaN on either side yields NOT corroborated
// rather than a silent true, which is the fail-safe direction: an unparseable
// openedAt already fails checkpointMatches upstream, and gateEpisode refuses an
// episode whose since does not parse, so neither is reachable through this
// file's own writers, and the guard costs one comparison.
//
// An undefined owner is NOT corroboration, and that is worth stating because
// gateEpisodeOpen reads the same value the other way: there, omitting the
// argument asks whether any session is held, which is what a human running
// status wants. Here the answer feeds a decision, and the two defaults in this
// API would otherwise point in opposite directions, with checkpointMatches
// reading a missing argument as not corroborated (fail-safe) and this one
// turning it into a bystander's hold granting the long lease (fail-open). Every
// caller today passes a string or an explicit null; this keeps the next one
// from inheriting the permissive reading by omission. Use checkpointOwner to
// derive the value from a goal.
function pendingOfferCorroborated(cp, state, nowMs, ownerSessionId) {
    if (!cp || typeof cp !== 'object' || cp.pendingOffer !== true) return false;
    if (ownerSessionId === undefined) return false;
    const episode = gateEpisodeOpen(state, nowMs, ownerSessionId);
    if (!episode) return false;
    const since = Date.parse(episode.since);
    const opened = typeof cp.openedAt === 'string' ? Date.parse(cp.openedAt) : NaN;
    if (!Number.isFinite(since) || !Number.isFinite(opened)) return false;
    return since <= opened;
}

// Whole minutes between an ISO timestamp and now, or null when it does not
// parse. Negative ages (a clock adjustment, a hand-edited file) floor at zero:
// every surface that reports one states it as an elapsed duration, and a
// negative duration is not a thing an operator can act on.
function wholeMinutesSince(iso, nowMs) {
    const at = typeof iso === 'string' ? Date.parse(iso) : NaN;
    if (!Number.isFinite(at)) return null;
    const now = (typeof nowMs === 'number' && Number.isFinite(nowMs)) ? nowMs : Date.now();
    return Math.max(0, Math.floor((now - at) / 60000));
}

function countPhrase(n, singular) {
    return n + ' ' + singular + (n === 1 ? '' : 's');
}

// "held 3 offers over 12 minutes": the count of offers held in this episode and
// its age, as one phrase, single-sourced because two surfaces report the same
// two integers (the gate's stderr note and the checkpoint CLI's status) and an
// operator reading both should not have to reconcile two phrasings. Two
// integers and nothing else, which is what keeps a user-writable state file off
// those channels. Null when the episode's age cannot be read, so a caller says
// nothing rather than guessing.
//
// BOTH integers are clamped by the same helper, and for the same reason. The
// count comes from a user-writable file and so does the timestamp the duration
// is measured from: a `since` of the year 1 renders a nine-figure minute count,
// and a date near the floor of the type renders a twelve-figure one, neither of
// which an operator can read as a duration. The clamp bounds what reaches those
// two channels without misreporting any real episode, since a genuine hold is
// minutes to hours and nothing near the bound.
function episodePhrase(episode, nowMs) {
    if (!episode) return null;
    const minutes = gateCount(wholeMinutesSince(episode.since, nowMs));
    if (minutes === null) return null;
    return 'held ' + countPhrase(episode.denials, 'offer') + ' over ' + countPhrase(minutes, 'minute');
}

// The state file's read cap. The writer produces a few hundred bytes and never
// grows: it holds two records and one episode, each rebuilt field by field with
// capped strings. Anything past a quarter megabyte is not something this wrote,
// and reading it whole on a per-offer hook path is cost with nothing to gain.
const GATE_STATE_MAX_BYTES = 256 * 1024;

// Read the gate state, distinguishing a file that is not there from one that
// cannot be read right now. Returns { ok, state, reason }:
//
//   { ok: true,  state }        legible, rebuilt (state is null when the file is
//                               absent, unparseable, or not an object: none of
//                               those carries an episode to lose)
//   { ok: false, state: null }  the answer is unknown, so no caller may act as
//                               though the file were absent
//
// reason names which refusal produced an { ok: false }: 'kind' (something that is
// not a regular file), 'oversized' (past the read cap), 'unreadable' (the read
// itself was refused) or 'lstat' (the path's own kind could not be read). Every
// decision path treats the four alike; the status report does not, because the
// remedy it prints differs by leg and only one of the four is permanent. The
// reason is carried out of here rather than re-derived because it cannot be
// re-derived: an lstat run afterwards succeeds and reports an ordinary regular
// file for the 'unreadable' leg, so a reporter re-asking that way describes a
// scanner's lock as a corrupt file and tells the operator to delete the standing
// deferral episode.
//
// The distinction is load-bearing on the write path. A file locked by an
// indexer or an antivirus scanner (EBUSY, EPERM) is not an absent file, and
// treating it as one would rewrite a live episode as a fresh count of one,
// destroying exactly the reading this record exists to produce. The gate's note
// wants the same distinction: it says nothing rather than reporting a projected
// count of one on the fiftieth deny of a section.
//
// The refusal legs come first and cover this file's own hazards: a non-regular
// path (a FIFO here blocks the read forever, with no verdict emitted, since
// every caller of this runs on the gate's critical path) and an oversized one.
function readGateStateResult(cwd) {
    const target = gateStatePath(cwd);
    let st;
    try {
        st = fs.lstatSync(target);
    } catch (err) {
        if (err && err.code === 'ENOENT') return { ok: true, state: null };
        return { ok: false, state: null, reason: 'lstat' };
    }
    if (!st.isFile()) return { ok: false, state: null, reason: 'kind' };
    if (st.size > GATE_STATE_MAX_BYTES) return { ok: false, state: null, reason: 'oversized' };
    let raw;
    try {
        raw = fs.readFileSync(target, 'utf8');
    } catch (err) {
        if (err && err.code === 'ENOENT') return { ok: true, state: null };
        return { ok: false, state: null, reason: 'unreadable' };
    }
    let parsed;
    try { parsed = JSON.parse(raw); } catch { return { ok: true, state: null }; }
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return { ok: true, state: null };
    return {
        ok: true,
        state: {
            lastDecision: gateRecord(parsed.lastDecision),
            episode: gateEpisode(parsed.episode),
            lastAllow: gateRecord(parsed.lastAllow)
        }
    };
}

// The gate state, or null when it is absent, refused, unreadable, or not JSON.
// The reading surfaces take this shape because they act the same way on all
// four: a null state and a state whose fields are null both mean no decision
// recorded and no episode open. A caller that must not confuse "not there" with
// "cannot tell" takes readGateStateResult instead.
function readGateState(cwd) {
    return readGateStateResult(cwd).state;
}

// The state that follows a prior state and a new record. Pure: it writes
// nothing, so the gate can project the episode its note will report before it
// attempts the write that stores it.
//
// The episode belongs to the LEASH, not to whichever session denied last, and
// that is what makes one slot enough. The two deny classes have disjoint
// producers: a boundary deny is reachable only behind the gate's own
// armed-and-bound test (or the bind-claim that immediately follows it), so only
// the bound session can produce one and it always carries a session id, while
// an interactive deny is the only deny on the bystander and nothing-armed
// fall-through. So:
//
//   deny-boundary     extends the standing episode when it owns it, and
//                     otherwise opens a fresh one at one. Replacing a foreign
//                     incumbent is right on this path rather than harmful: the
//                     binding is exclusive, so a foreign owner here can only be
//                     a dead binding (a crash, then a re-arm), never a rival.
//   deny-interactive  records the decision and carries the standing episode
//                     through untouched. A bystander, or a project with nothing
//                     armed, never opens, extends, inflates, or destroys one.
//   allow             clears the episode only when the allower owns it. An
//                     allow lands a compaction in the allower's own context;
//                     a bystander's compaction says nothing about the offers
//                     the bound session is still being denied.
//
// A decision carrying no session id never opens or extends an episode. The
// partition above makes that unreachable on the boundary path, and the rule
// stays as a floor so no unownable record can reach the disk.
//
// What this costs, taken deliberately: an interactive hold has no episode
// aggregate. In a project holding a hands-on session, status reports the last
// decision's recency but no count and no duration, and says no episode is open.
// The .jsonl log still carries every one of those denials.
//
// The one contention left: two sessions whose transcripts both claim the same
// unbound goal (the superseded-arming window the gate's header documents) can
// alternate boundary denies and reset each other's count. It is self-limiting,
// because each offer re-reads the goal and whichever bind landed last takes the
// boundary path; the tell is a note whose count never grows during a run you
// believe is singly leashed. That contention's failure direction is an
// UNDERCOUNT, which degrades to the pre-plan status quo (a compaction landing
// mid-chapter), never to a checkpoint honored longer than it should be.
//
// One direction does run the other way, and it is stated rather than claimed
// away. This writer has no compare-and-set, unlike the nudge stamp, so a
// bystander session's deny-interactive carries `standing` through from a read
// taken before the bound session's allow, and writing it back restores the
// episode that allow had just cleared. A pending checkpoint the allow left
// standing is then vouched for once more. It needs two gate processes in the
// same project inside the same few milliseconds, and its cost is bounded by the
// same one-mistimed-compaction ceiling as everything else here, so it is carried
// as a residual rather than closed; the fix, if it is ever worth its complexity,
// is the gateOwnedFingerprint verify the nudge stamp already uses.
//
// So an open episode means "this session has been denied, with no allow since,
// recently", which is the pending-offer signal the checkpoint rule and the
// nudge read: past the compaction trigger the harness re-offers every assistant
// turn, so once a deny has landed the offers recur until one is allowed.
function nextGateState(prior, record) {
    const lastAllow = prior ? gateRecord(prior.lastAllow) : null;
    const standing = gateEpisodeOpen(prior, Date.parse(record.at));
    const mine = !!standing && sameSessionId(standing.session, record.session);
    if (record.verdict === 'allow') {
        return {
            lastDecision: record,
            episode: mine ? null : standing,
            lastAllow: record
        };
    }
    if (record.verdict === 'deny-boundary' && record.session) {
        if (mine) {
            return {
                lastDecision: record,
                episode: {
                    session: standing.session,
                    since: standing.since,
                    denials: standing.denials + 1,
                    lastDeniedAt: record.at,
                    nudgedAt: standing.nudgedAt
                },
                lastAllow
            };
        }
        return {
            lastDecision: record,
            episode: {
                session: record.session,
                since: record.at,
                denials: 1,
                lastDeniedAt: record.at,
                nudgedAt: null
            },
            lastAllow
        };
    }
    // An interactive deny, or the session-less boundary deny the partition
    // makes unreachable: the decision is recorded and the slot is left alone.
    return { lastDecision: record, episode: standing, lastAllow };
}

// The episode this decision's OWN session will stand under once the decision is
// recorded, computed without writing anything. The gate's note has to report
// the hold including the decision it is announcing, and it has to be composed
// before the write is attempted, so a write that fails, or blocks, cannot make
// the note report a prior state as if it were current.
//
// Null when there will be no open episode belonging to this session, and null
// whenever the record cannot land at all (gateRecordTargets owns that whole
// set: an unreadable state, a refused path, an unwritable file). Projecting
// over a state that will never advance is what produces a fresh count of one on
// the fiftieth deny of a section, a stuck number that reads exactly like the
// mechanism working, and it puts two operator-facing surfaces in contradiction:
// stderr claiming a hold that status says was never recorded.
function projectGateEpisode(cwd, decision) {
    try {
        const record = gateRecord(decision);
        if (!record) return null;
        record.at = new Date().toISOString();
        const targets = gateRecordTargets(cwd);
        if (!targets.ok) return null;
        const at = Date.parse(record.at);
        return gateEpisodeOpen(nextGateState(targets.prior, record), at, record.session);
    } catch {
        return null;
    }
}

// Write JSON atomically (tmp file plus rename), on writeCheckpoint's discipline
// and for the same reasons: a failed rename unlinks its tmp so orphans do not
// accumulate in .kit/. The containing directory is a precondition, never
// created here (see the section header; the marker writer creates its own
// directory before calling). Throws on failure; every caller catches.
//
// verifyBeforeRename is optional and runs in the last moment before the rename,
// with the tmp file already written: returning false abandons the write and
// unlinks the tmp, and this function returns false rather than throwing. It sits
// here rather than in the caller because this is the only point where "still
// true" and "now published" are adjacent; a check the caller ran before calling
// would leave the whole tmp write inside the window it is trying to close.
function writeJsonAtomic(target, value, verifyBeforeRename) {
    const tmp = atomicTmpPath(target);
    let created = false;
    try {
        // Create and write are separate calls so created can mean "the exclusive
        // create returned": spelled as one call, a failure in the write leg
        // leaves the flag false with the file already on disk and the cleanup
        // below skips it.
        const fd = fs.openSync(tmp, 'wx');
        created = true;
        let wrote = false;
        try {
            fs.writeFileSync(fd, JSON.stringify(value, null, 2) + '\n', 'utf8');
            wrote = true;
        } finally {
            // Swallowed while the write's own error is in flight, rethrown once
            // the write has returned: at that point the close is where a deferred
            // write error surfaces, and dropping it publishes a torn file behind a
            // success. Same split as writeCheckpoint's.
            try {
                fs.closeSync(fd);
            } catch (closeErr) {
                if (wrote) throw closeErr;
            }
        }
        if (typeof verifyBeforeRename === 'function' && verifyBeforeRename() !== true) {
            try { fs.unlinkSync(tmp); } catch { /* nothing to remove */ }
            return false;
        }
        fs.renameSync(tmp, target);
        return true;
    } catch (err) {
        // Only what this writer created is this writer's to remove (see
        // atomicTmpPath).
        if (created) {
            try { fs.unlinkSync(tmp); } catch { /* nothing to remove, or it is the unwritable path itself */ }
        }
        throw err;
    }
}

// The gate-owned part of a state, as one comparable string: the newest
// decision's timestamp and the episode identity the gate maintains. nudgedAt is
// deliberately absent, since that field is the nudge's own and a concurrent
// nudge overwriting it costs nothing.
//
// This exists for the stamp's compare-and-set. Every gate write goes through
// nextGateState, which rebuilds lastDecision from a record whose `at` this
// writer stamps at write time, and an episode is only ever opened, extended or
// replaced with a new lastDeniedAt or denials, so a gate write between two reads
// moves one of these in the ordinary case. `at` alone would not be enough: it is
// an ISO string at millisecond resolution, and a deny-interactive carries the
// episode through untouched, so two distinct decisions inside one millisecond
// would fingerprint identically. The decision's verdict, reason and session ride
// along, which narrows that case rather than closing it: the tuple leaves out
// consumed, the checkpoint block and lastAllow, so two deny-interactive
// decisions in one millisecond carrying the same reason and session still
// fingerprint the same. What that costs is one unstamped nudge, which is the
// undercount this file prefers everywhere.
function gateOwnedFingerprint(state) {
    const decision = state ? state.lastDecision : null;
    const episode = state ? state.episode : null;
    return JSON.stringify([
        decision ? decision.at : null,
        decision ? decision.verdict : null,
        decision ? decision.reason : null,
        decision ? decision.session : null,
        episode ? episode.session : null,
        episode ? episode.since : null,
        episode ? episode.denials : null,
        episode ? episode.lastDeniedAt : null
    ]);
}

// Rewrite the log to its newest GATE_LOG_KEEP_BYTES. The tail is taken at a
// byte offset, which lands mid-line and possibly mid-character, so everything
// up to and including the first newline is discarded: what survives is whole
// lines only, which is what lets a reader parse every line it finds. The
// rewrite goes through a tmp file and a rename, so a failure leaves the old log
// intact rather than truncated.
//
// A rewrite that would keep NOTHING is refused: the file is left exactly as it
// is. That is the degenerate case of a line longer than the keep bound, which
// nothing here writes but a hand-edited or foreign file can hold, and it
// arrives in two shapes: a tail with no line break in it at all, and one whose
// only break is the terminator at its very end. Both would trade the whole log
// for an empty file, and an oversized log is a far smaller problem than a
// destroyed one. The append that follows still lands.
function trimGateLog(logPath, size) {
    const fd = fs.openSync(logPath, 'r');
    let text;
    try {
        text = readFully(fd, size - GATE_LOG_KEEP_BYTES, GATE_LOG_KEEP_BYTES);
    } finally {
        try { fs.closeSync(fd); } catch { /* already closed */ }
    }
    const nl = text.indexOf('\n');
    const kept = nl === -1 ? '' : text.slice(nl + 1);
    if (kept === '') return;
    const tmp = atomicTmpPath(logPath);
    let created = false;
    try {
        // Create and write are separate calls so created can mean "the exclusive
        // create returned": spelled as one call, a failure in the write leg
        // leaves the flag false with the file already on disk and the cleanup
        // below skips it, stranding up to a megabyte of trimmed gate journal.
        const outFd = fs.openSync(tmp, 'wx');
        created = true;
        let wrote = false;
        try {
            fs.writeFileSync(outFd, kept, 'utf8');
            wrote = true;
        } finally {
            // Swallowed while the write's own error is in flight, rethrown once
            // the write has returned: at that point the close is where a deferred
            // write error surfaces, and dropping it publishes a torn log behind a
            // success. Same split as writeCheckpoint's. The descriptor is named
            // apart from the read descriptor above it, since a leaked or
            // mis-closed one is this writer's own failure mode.
            try {
                fs.closeSync(outFd);
            } catch (closeErr) {
                if (wrote) throw closeErr;
            }
        }
        fs.renameSync(tmp, logPath);
    } catch (err) {
        // Only what this writer created is this writer's to remove (see
        // atomicTmpPath).
        if (created) {
            try { fs.unlinkSync(tmp); } catch { /* nothing to remove, or it is the unwritable path itself */ }
        }
        throw err;
    }
}

// Is this path writable, or absent? Absent is fine: the write creates it. Any
// other refusal (a read-only file, a permission, a lock) is not, and is the
// case a caller must be able to see BEFORE it promises anything about a record
// landing.
function writableOrAbsent(target) {
    try {
        fs.accessSync(target, fs.constants.W_OK);
        return true;
    } catch (err) {
        return !!(err && err.code === 'ENOENT');
    }
}

// Everything that must hold before the gate STATE can be rewritten: the directory
// exists and is writable (an absent one is created only under the armed-goal
// condition the section header states), the state path is a regular file this
// process may write, and the state as it stands right now is legible.
//
// Returns { ok:true, statePath, prior } or { ok:false }.
//
// It is its own function because two writers need different amounts of it and
// neither may spell it by hand. The decision recorder also appends to the log, so
// it takes this plus the log legs (gateRecordTargets below). The deferral nudge
// stamps the state and then appends one journal line best-effort, after the fact
// and answering for its own path, so the log legs are not its preconditions at
// all: gating the stamp on the log would make a locked or read-only .jsonl
// silently disable the nudge's interval, and the nudge would then repeat after
// every covered tool return for the life of the episode.
function gateStateTarget(cwd) {
    try {
        const kit = kitScratchDir(cwd);
        let dir;
        try {
            dir = fs.lstatSync(kit);
        } catch (err) {
            // An absent .kit/ refuses unless an armed goal resolves for this
            // directory, which is the one case the section header licenses
            // creating it: a leashed worktree run has no local .kit/ of its
            // own. Only ENOENT reads as absent; any other failure is an
            // unknown answer and stays a refusal. The mkdir is recursive
            // because the store-backed branch of the resolver names a
            // directory several levels below a root that need not exist yet,
            // and the armed-goal condition above is what bounds it: a goal
            // resolves only for a directory that is already there. A failure
            // (a racing creator included) lands in the outer catch as
            // { ok: false }, degrading exactly as an unreadable directory
            // does.
            if (!err || err.code !== 'ENOENT') return { ok: false };
            const goal = readGoal(cwd);
            if (!goal || !goal.plan) return { ok: false };
            fs.mkdirSync(kit, { recursive: true });
            dir = fs.lstatSync(kit);
        }
        if (!dir.isDirectory() || !writableOrAbsent(kit)) return { ok: false };
        const statePath = gateStatePath(cwd);
        if (regularFileSize(statePath) === null || !writableOrAbsent(statePath)) return { ok: false };
        const prior = readGateStateResult(cwd);
        if (!prior.ok) return { ok: false };
        return { ok: true, statePath, prior: prior.state };
    } catch {
        return { ok: false };
    }
}

// Everything that must hold before a DECISION can be recorded: the state legs
// above plus the log the recorder appends to. Two callers need this full answer:
// the writer, which refuses to write, and the projection behind the gate's stderr
// note, which refuses to promise a count that will never be stored. Split, they
// drift, and the drift has a specific shape: the note reporting "held 1 offer
// over 0 minutes" on the fifth deny and the five hundredth, because the state
// never advanced and each projection re-derived the same first step from the
// same unchanged file. A stuck number reads exactly like a mechanism working.
//
// Returns { ok:true, statePath, logPath, logSize, prior } or { ok:false }.
//
// It cannot promise the write will succeed, only that nothing already known
// stops it: a disk that fills between here and the rename still throws, and
// that residual is caught and swallowed like any other. What it does cover is
// every condition that PERSISTS across offers, which is the set that turns one
// wrong sentence into the same wrong sentence forever.
function gateRecordTargets(cwd) {
    try {
        const state = gateStateTarget(cwd);
        if (!state.ok) return { ok: false };
        const logPath = gateLogPath(cwd);
        const logSize = regularFileSize(logPath);
        if (logSize === null || !writableOrAbsent(logPath)) return { ok: false };
        return { ok: true, statePath: state.statePath, logPath, logSize, prior: state.prior };
    } catch {
        return { ok: false };
    }
}

// Record one gate decision: rewrite the state and append one line to the log.
//
// Returns nothing, and that is the design rather than an omission. The gate
// calls this once its verdict is already announced, and a caller able to see
// whether the write landed is a caller able to decide differently because of
// it; the record must never be in a position to move a compaction. Every
// failure is swallowed for the same reason, so an unwritable .kit/ leaves the
// verdict, the exit code, and the stderr note exactly as they would have been.
//
// Every refusal is gateRecordTargets', shared with the projection behind the
// gate's note so the two cannot disagree about whether a record can land.
//
// The state is authoritative and the log is the journal. The state is written
// first, and a refusal or a failure there abandons the line too, so the log
// never counts a denial the state does not know about. The reverse is NOT
// guarded: once the state has advanced, a throw from the trim or the append
// loses that line, so the log can undercount what the state has counted. That
// asymmetry is deliberate, and this is the direction to prefer, because an
// operator reading the log to answer "how often" can survive a missing line,
// while a state that disagrees with its own journal about an open episode is
// what every consumer decides from.
//
// Concurrency: two gate processes in one project both read a count and both
// write its successor, so a denial can be lost from the count as well as from
// the log. There is no lock. The failure is an undercount, and a diagnostic does
// not earn a lock file. The log has the matching residual: a trim keeps the tail
// ending at a size read moments earlier and renames the result over the file, so
// a line appended in between is dropped. The nudge is now a second trimmer, so
// two writers can reach that path rather than one. Same conclusion, same reason.
//
// The state has a second writer, recordEpisodeNudge, and it can fire more often
// than this one, though not on every tool return: it is behind an open episode
// and behind its own interval, so its ceiling is one write per NUDGE_INTERVAL_MS
// per tool batch while a hold stands. It carries the last decision and the last
// allow through verbatim, so a gate write landing between its read and its
// rename would be clobbered. Its compare-and-set narrows that window to the
// rename itself rather than closing it, and what it does catch leaves an
// unstamped nudge (a silence) rather than a lost denial. The residual direction
// is the same undercount this file already prefers everywhere: the count reads
// low, the episode stays open, and nothing is honored longer than it should be.
//
// This writer has no compare-and-set of its own, and the other direction is the
// residual: its read-modify-write carries the episode through from its own
// earlier read, so a decision whose read predates a nudge's rename writes the
// pre-stamp nudgedAt back and that episode loses its interval. The whole cost is
// one extra nudge on the next tool return, which is why this stays a stated
// residual rather than a second lock on the path the gate decides from.
function recordGateDecision(cwd, decision) {
    try {
        const record = gateRecord(decision);
        if (!record) return;
        // The writer stamps the time, never the caller: `at` is what every age
        // in the status report and the deferral note is measured from, so it
        // has to come from one clock rather than from a value passed in.
        record.at = new Date().toISOString();

        const targets = gateRecordTargets(cwd);
        if (!targets.ok) return;
        const { statePath, logPath, logSize, prior } = targets;

        writeJsonAtomic(statePath, nextGateState(prior, record));
        if (logSize > GATE_LOG_MAX_BYTES) trimGateLog(logPath, logSize);
        // One append of one line: a line is written whole or not at all, so a
        // reader never meets a half-written record. A log that does not already
        // end on a line boundary (hand-edited, or truncated by a crash) gets the
        // break first, so the append cannot fuse two records into one line that
        // parses as neither.
        const prefix = endsOnLineBoundary(logPath) ? '' : '\n';
        fs.appendFileSync(logPath, prefix + JSON.stringify(record) + '\n', 'utf8');
    } catch { /* diagnostic only: a decision that cannot be recorded is still taken */ }
}

// Stamp the deferral nudge's clock onto the open episode. This is the one writer
// of a nudgedAt VALUE, the field nextGateState carries through on an extension
// and nulls when a fresh boundary deny opens an episode. It is called by
// compact-deferral-nudge.js BEFORE it emits and gates that emission: the hook
// speaks only when this returns true (see the boolean below). The stamp is what
// makes the nudge's interval survive the separate hook processes that enforce
// it, since each tool return runs a fresh process and the episode record is the
// only place a "last spoke at" can live between them.
//
// Nothing is written unless an episode is genuinely open for this owner, which
// is gateEpisodeOpen's question including its idle and future-skew bounds, so a
// nudge can neither resurrect a finished episode nor mint one no denial
// produced. An owner that is not a usable session id writes nothing either:
// gateEpisodeOpen reads a missing argument as "any open episode counts", which
// is the right default for a human running status and the wrong one for a
// writer, since it would let one session's nudge stamp another's hold.
//
// Every other field is carried through untouched, `since` above all. An
// episode's start is preserved across every extension, so a stamp that re-dated
// it would shorten the age both operator-facing surfaces report and would move
// the predate comparison pendingOfferCorroborated turns on.
//
// Returns true when the stamp is on disk and false on every other path, and never
// throws. The boolean is the whole point: this field is not diagnostic, it IS the
// nudge's rate limit, and the only cross-process carrier the interval has. A
// caller that emitted without it would have no rate limit at all, so the hook
// emits only when this returns true. Silence is the pre-hook status quo; an
// unbounded repeat into a context already past the compaction trigger is worse
// than that status quo, so the failure direction is silence.
//
// The refusal preconditions are gateStateTarget's, shared with the recorder rather
// than spelled a second time: .kit/ must exist (an absent one is created only for
// a directory an armed goal resolves for, per the section header), the state file
// must be a regular file this process may write, and the state must be legible
// right now. The log legs are deliberately NOT among them, even though
// this writer does append one journal line: that line comes after the stamp and
// answers for its own path, so a locked or read-only log costs a log line and never
// the interval.
//
// The written object is derived from what was read rather than enumerated field by
// field, so the state's shape is single-sourced at readGateStateResult for this
// writer exactly as it is for the recorder: a field added there rides through here
// untouched instead of being dropped by a stale literal.
//
// The write carries a compare-and-set over the gate-owned fields, re-read in the
// last moment before the rename. It NARROWS the window to the rename itself and
// closes nothing: the re-read and the rename are adjacent statements, so a gate
// write landing in that gap is still clobbered. It is not a general lock either,
// and the interval race across a parallel tool batch is deliberately uncovered
// (the hook header states that bound). What it narrows is a real inversion of
// this file's own rule that nothing is honored longer than it should be. An
// allow at the valve, or on an illegible reading, clears the episode without
// consuming the checkpoint, since the gate consumes only on a match. A stamp
// whose read predates that allow would write the episode back, with its original
// `since`; pendingOfferCorroborated would vouch for the standing checkpoint
// again, checkpointMatches would grant it the 24-hour bound instead of ten
// minutes, and a compaction would land against a boundary declared hours
// earlier, mid-chapter. Failing closed here costs one silent nudge.
//
// After the stamp lands, one line goes to the log, best-effort and outside every
// precondition above. An operator asking whether the mechanism spoke can then
// tell a nudge that never fired from one that fired five times and was ignored,
// which is the question the plan puts to that log. It is kept outside the stamp
// preconditions on purpose: a locked or read-only .jsonl must never be able to
// disable the interval, which is what the state-only precondition split buys.
//
// toolName is the tool whose return triggered the nudge, carried into the record
// for one reading it makes possible: the nudge is delivered per context, while
// the interval lives on one shared episode, so a run whose nudge lines are all
// Bash while the main session's covered returns are predominantly Agent and
// TaskOutput is a dispatched agent consuming the interval the main session
// needed. A bare count cannot show that. It is a signal to read, not a proof.
function recordEpisodeNudge(cwd, sessionId, nowMs, toolName) {
    let stampedAt = null;
    try {
        if (typeof sessionId !== 'string' || sessionId === '') return false;
        const at = (typeof nowMs === 'number' && Number.isFinite(nowMs)) ? nowMs : Date.now();
        const target = gateStateTarget(cwd);
        if (!target.ok) return false;
        const prior = target.prior;
        const episode = gateEpisodeOpen(prior, at, sessionId);
        if (!episode) return false;
        const basis = gateOwnedFingerprint(prior);
        const iso = new Date(at).toISOString();
        const landed = writeJsonAtomic(target.statePath, {
            ...prior,
            episode: { ...episode, nudgedAt: iso }
        }, () => {
            const current = readGateStateResult(cwd);
            return current.ok && gateOwnedFingerprint(current.state) === basis;
        });
        if (!landed) return false;
        stampedAt = iso;
    } catch { /* an unstamped episode is a silent one: the caller emits nothing */ }
    if (stampedAt === null) return false;
    logEpisodeNudge(cwd, sessionId, stampedAt, toolName);
    return true;
}

// One journal line for a nudge that fired. Never throws and returns nothing.
// It answers for the log file itself, which must be a regular file this process
// can write, and applies the same trim bound and line-boundary discipline the
// decision recorder uses, so a reader still meets whole lines only. What it
// does not re-check is the .kit directory leg (a real directory rather than a
// link to one): that is established by gateStateTarget, which the single caller
// runs first on the same repo, and this function is written for that caller
// rather than as a standalone entry point.
//
// The record is distinguishable from a decision by shape rather than by absence:
// it carries `event` where a decision carries `verdict`, so a reader folding the
// log can partition it without guessing. Three fields of provenance and nothing
// else: the time, the session the hold belongs to, and the tool whose return
// triggered it. Each is rebuilt through gateText, so a forged or odd value
// cannot push control characters into an operator's terminal or grow the line.
function logEpisodeNudge(cwd, sessionId, atIso, toolName) {
    try {
        const logPath = gateLogPath(cwd);
        const logSize = regularFileSize(logPath);
        if (logSize === null || !writableOrAbsent(logPath)) return;
        if (logSize > GATE_LOG_MAX_BYTES) trimGateLog(logPath, logSize);
        const record = {
            at: atIso,
            event: 'nudge',
            session: gateText(sessionId),
            tool: gateText(toolName)
        };
        const prefix = endsOnLineBoundary(logPath) ? '' : '\n';
        fs.appendFileSync(logPath, prefix + JSON.stringify(record) + '\n', 'utf8');
    } catch { /* the journal is diagnostic: a line that cannot be written is dropped */ }
}

// Does this file end on a line boundary? True for an empty or absent file,
// which needs no separator. False when the answer cannot be established: a
// path whose kind or size could not be read (regularFileSize's null) gets the
// fail-safe answer rather than the go-ahead one, since a spare blank line in
// the journal costs nothing while a fused record parses as neither of the two
// records it ran together. Reads the final byte alone: the answer is one byte
// long and the file can be megabytes.
function endsOnLineBoundary(target) {
    const size = regularFileSize(target);
    if (size === null) return false;
    if (size === 0) return true;
    const fd = fs.openSync(target, 'r');
    try {
        const buf = Buffer.alloc(1);
        const read = fs.readSync(fd, buf, 0, 1, size - 1);
        return read !== 1 || buf[0] === 0x0A;
    } finally {
        try { fs.closeSync(fd); } catch { /* already closed */ }
    }
}

// ---------------------------------------------------------------------------
// Release markers. Two session-scoped files beside the checkpoint give the
// gate its release paths for sessions the checkpoint cannot serve: the
// role-boundary marker, which a goalless session (a coordinator, expert or
// admin seat) opens at a banked-and-empty moment so the hands-on deferral can
// land the next offer there instead of riding to the safety ceiling; and the
// operator-consent marker, written only on the operator's explicit word,
// which releases one deferred compaction for the session it names on either
// deny leg. Both release SCHEDULING denials only, the verdicts that mean
// "not at this moment": no marker touches an allow clause, an integrity
// refusal, or the leashed checkpoint rule, and the no-marker case leaves
// every leg exactly as it was.
//
// The trust shape mirrors the checkpoint's. A session's own banked-and-empty
// declaration is the best boundary signal available, and the ceiling
// force-landing is already the worst case, so honoring a self-declared
// boundary can only move a compaction earlier onto a cleaner spot. The
// consent marker is asserted rather than authenticated (a single-principal
// machine); what bounds its writing is prose in the role skills, and what
// bounds its effect is here: one session, one release, one age window.
// ---------------------------------------------------------------------------

// Path to the role-boundary marker for a given repo root.
function roleBoundaryPath(cwd) {
    return path.join(kitScratchDir(cwd), 'compact-role-boundary.json');
}

// Path to the operator-consent marker for a given repo root.
function consentPath(cwd) {
    return path.join(kitScratchDir(cwd), 'compact-consent.json');
}

// A session id a caller may scope a marker to, or null. The gate is charset
// plus a leading-character rule, not charset alone: a value that opens with a
// dash reads as an option to any parser that meets it later, so the first
// character must be alphanumeric however clean the rest is. Session ids as
// the harness mints them are UUID-shaped and pass untouched; anything else
// degrades to the refusal at the call sites, never to an unscoped write. The
// rule also carries a path-safety property two callers depend on, since a
// passing value is a single path component: it holds no separator, is not a
// dots-only name, and is inside the storage cap the marker writer enforces.
// One definition serves the checkpoint CLI's marker verbs and the seat Stop
// hook's registry lookup, so the value one of them refuses is not a value the
// other joins onto a path.
function usableSessionId(value) {
    return (typeof value === 'string' && /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/.test(value))
        ? value
        : null;
}

// Whether the harness holds a transcript for this session under this project
// directory, which is the corroboration a marker written at a directory the
// caller named rather than stood in has to pass. A marker landing in a
// project the named session never ran in is inert and silently so, and this
// turns that miss into a refusal.
//
// The harness files a session's transcript as <session-id>.jsonl under
// ~/.claude/projects/<flattened project path>, and the flattening is memq's
// own sanitizeProjectPath, imported rather than restated so the two cannot
// disagree about a directory name. memq is required lazily because this is
// the only path here that needs it and the gate's own hot path must not pay
// for loading it.
//
// Anything unresolvable reads as no transcript: the caller's refusal is the
// conservative answer, and a marker not written costs one re-run at the right
// directory while one written at the wrong one costs a release nothing reads.
function projectHoldsSessionTranscript(projectDir, sessionId) {
    try {
        if (usableSessionId(sessionId) === null) return false;
        const { sanitizeProjectPath } = require(path.join(__dirname, '..', 'scripts', 'memq.js'));
        const dir = path.join(os.homedir(), '.claude', 'projects',
            sanitizeProjectPath(path.resolve(projectDir)));
        return fs.statSync(path.join(dir, sessionId + '.jsonl')).isFile();
    } catch {
        return false;
    }
}

// How long each marker stays honorable. Both are the deferral episode's idle
// bound rather than numbers of their own, because all three answer one
// question: how long a moment's word still describes the same working
// session. A seat opens the boundary marker at a banked moment its runbook
// defines, and the invariant that moment carries is that context holds
// nothing the disk does not, so a compaction anywhere inside the window costs
// a re-read and never state; what the window has to cover is the seat's own
// quiet gap between banked moments, which is the same order as the idle bound
// and far longer than one tool call. The consent marker covers the same gap
// from the other side, an operator's release preceding the next offer by a
// while (the offer only recurs while the context sits past the trigger).
// Derived rather than restated so the three cannot drift; evidence that ever
// tunes one apart turns that one's derivation into its own literal.
const ROLE_BOUNDARY_MAX_AGE_MS = GATE_EPISODE_MAX_IDLE_MS;
const CONSENT_MAX_AGE_MS = GATE_EPISODE_MAX_IDLE_MS;

// The one marker match rule, shared by its two consumers (the gate's release
// legs and the CLI's status report) so they cannot drift, exactly as
// checkpointMatches is shared for the checkpoint. A marker counts only for
// the session it names, only while unconsumed, and only within the age bound
// the caller passes: the two marker kinds differ in nothing but that bound.
// Like checkpointMatches, this rule stays pure: it is told the subject
// session and the clock rather than reading any state.
//
// Returns { ok:true, reason:null } on a match, else { ok:false, reason } with
// reason naming the first failed clause in evaluation order:
//   'no-marker'      marker is missing, not an object, or carries no session
//                    string (a hand-made or torn file; the writer always
//                    records one)
//   'consumed'       consumed is anything but a literal false. An absent flag
//                    reads as consumed too: the writer always records false,
//                    so a record without it is not one of ours, and the
//                    conservative reading is the dead one.
//   'wrong-session'  the marker names a different session than the subject,
//                    or the subject itself is unusable (sameSessionId is
//                    false when either side is missing, which is exactly the
//                    treat-as-absent handling a payload without an id needs)
//   'no-timestamp'   writtenAt is missing or does not parse as a date
//   'expired'        writtenAt is older than maxAgeMs, or maxAgeMs itself is
//                    not a finite number: a caller that forgot the bound
//                    narrows the window to nothing rather than widening it
//   'future'         writtenAt is beyond the same skew allowance the
//                    checkpoint tolerates (one constant, one question)
// Never throws on JSON-derived input: every access is guarded and Date.parse
// returns NaN on garbage. nowMs pins the clock as it does elsewhere here.
function markerMatches(marker, sessionId, nowMs, maxAgeMs) {
    const now = (typeof nowMs === 'number' && Number.isFinite(nowMs)) ? nowMs : Date.now();
    if (!marker || typeof marker !== 'object' || Array.isArray(marker)
        || typeof marker.session !== 'string') {
        return { ok: false, reason: 'no-marker' };
    }
    if (marker.consumed !== false) return { ok: false, reason: 'consumed' };
    if (!sameSessionId(marker.session, sessionId)) return { ok: false, reason: 'wrong-session' };
    if (typeof marker.writtenAt !== 'string') return { ok: false, reason: 'no-timestamp' };
    const written = Date.parse(marker.writtenAt);
    if (!Number.isFinite(written)) return { ok: false, reason: 'no-timestamp' };
    if (typeof maxAgeMs !== 'number' || !Number.isFinite(maxAgeMs)) {
        return { ok: false, reason: 'expired' };
    }
    const age = now - written;
    if (age > maxAgeMs) return { ok: false, reason: 'expired' };
    if (age < -CHECKPOINT_FUTURE_SKEW_MS) return { ok: false, reason: 'future' };
    return { ok: true, reason: null };
}

// Read and parse a marker file, mirroring readCheckpointResult leg for leg
// and for the same reasons: the gate reads these on its deny paths before any
// verdict is emitted, so the path must be a regular file of sane size before
// it is opened (a FIFO planted here would block forever inside readFileSync,
// where no try/catch can rescue it, and being an lstat the check judges a
// link as a link rather than as its target), and the status report needs the
// refusal legs told apart because they name different remedies and cannot be
// recovered by re-asking with a second syscall. The checkpoint's own read cap
// applies: the writer produces three short fields and never grows. The
// outcome vocabulary is readCheckpointResult's, with `marker` in place of
// `cp`.
function readMarkerResult(target) {
    let st;
    try {
        st = fs.lstatSync(target);
    } catch (err) {
        if (err && err.code === 'ENOENT') return { ok: true, marker: null, reason: 'absent' };
        return { ok: false, marker: null, reason: 'lstat' };
    }
    if (!st.isFile()) return { ok: false, marker: null, reason: 'kind' };
    if (st.size > CHECKPOINT_MAX_BYTES) return { ok: false, marker: null, reason: 'oversized' };
    let raw;
    try {
        raw = fs.readFileSync(target, 'utf8');
    } catch (err) {
        if (err && err.code === 'ENOENT') return { ok: true, marker: null, reason: 'absent' };
        return { ok: false, marker: null, reason: 'unreadable' };
    }
    try {
        return { ok: true, marker: JSON.parse(raw), reason: null };
    } catch {
        return { ok: true, marker: null, reason: 'illegible' };
    }
}

function readRoleBoundaryResult(cwd) {
    return readMarkerResult(roleBoundaryPath(cwd));
}

function readConsentResult(cwd) {
    return readMarkerResult(consentPath(cwd));
}

// The swallowing forms the gate takes, because every refusal leg means the
// same thing to it: no marker releases anything. Same split as readCheckpoint
// over readCheckpointResult.
function readRoleBoundary(cwd) {
    try {
        return readRoleBoundaryResult(cwd).marker;
    } catch {
        return null;
    }
}

function readConsent(cwd) {
    try {
        return readConsentResult(cwd).marker;
    } catch {
        return null;
    }
}

// Write a marker atomically, on writeCheckpoint's discipline via
// writeJsonAtomic (exclusive create, atomic rename, failure cleanup gated on
// the create having returned). Returns { ok:true, session } or
// { ok:false, reason }; never throws.
//
// The session id is held to bindSession's own storage rules, the same bound
// writeCheckpoint holds boundSession to (a string, capped length, no control
// characters); the CLI additionally charset-gates what it accepts before this
// is reached, so this guard is the floor, not the whole gate. There is no
// unscoped form: a marker without a session would release whichever session's
// offer arrived first, which is the one shape the design forbids, so a caller
// with no usable id gets a refusal rather than a wildcard. consumed is
// written as a literal false, the only value the match rule reads as live.
// Unlike the gate's own record targets, the directory is created here: the
// CLI's marker modes are the .kit/ writers that must work with no goal ever
// armed, boundary and consent alike, exactly as writeCheckpoint creates it
// for the leashed mode.
function writeMarkerFile(target, sessionId) {
    if (typeof sessionId !== 'string' || sessionId === '' || sessionId.length > 128
        || /[\x00-\x1F]/.test(sessionId)) {
        return { ok: false, reason: 'session id is invalid' };
    }
    const state = {
        session: sessionId,
        writtenAt: new Date().toISOString(),
        consumed: false
    };
    try {
        fs.mkdirSync(path.dirname(target), { recursive: true });
        writeJsonAtomic(target, state);
    } catch (err) {
        return { ok: false, reason: 'could not write marker: ' + (err && err.message ? err.message : String(err)) };
    }
    return { ok: true, session: sessionId };
}

function writeRoleBoundary(cwd, sessionId) {
    return writeMarkerFile(roleBoundaryPath(cwd), sessionId);
}

function writeConsent(cwd, sessionId) {
    return writeMarkerFile(consentPath(cwd), sessionId);
}

// Delete a marker file if present, on clearCheckpoint's exact rule: presence
// judged by the lstat kind check rather than existsSync (a link at the path
// reads as no marker to every reader here, so a clear that followed it would
// report consuming something nothing read as open), a failed lstat routed by
// pathErrnoClass, and a racing ENOENT reported as none-open rather than as a
// failure. Returns clearCheckpoint's own shape. The gate calls these to
// consume a marker on the allow it caused, best-effort: a failed delete
// degrades to the gate standing open, never to a wedged session. The risk
// that choice takes is the checkpoint's own, deliberately: a consume that
// fails to delete releases again on every later offer inside the marker's
// age bound, with no cap here on the count, which costs an extra compaction
// at a declared boundary (or under a standing consent), while the opposite
// choice, refusing the allow when the delete fails, would convert a locked
// file into a session riding to the ceiling,
// the exact failure the release paths exist to end.
function clearMarkerFile(target) {
    try {
        let st;
        try {
            st = fs.lstatSync(target);
        } catch (err) {
            if (pathErrnoClass(err && err.code) !== 'transient') {
                return { ok: true, cleared: false };
            }
            throw err;
        }
        if (!st.isFile()) {
            return { ok: true, cleared: false };
        }
        fs.unlinkSync(target);
        return { ok: true, cleared: true };
    } catch (err) {
        if (err && err.code === 'ENOENT') {
            return { ok: true, cleared: false };
        }
        return {
            ok: false,
            cleared: false,
            reason: 'could not clear marker: ' + (err && err.message ? err.message : String(err))
        };
    }
}

function clearRoleBoundary(cwd) {
    return clearMarkerFile(roleBoundaryPath(cwd));
}

function clearConsent(cwd) {
    return clearMarkerFile(consentPath(cwd));
}

// ---------------------------------------------------------------------------
// Shared transcript reading.
// ---------------------------------------------------------------------------

// Read a transcript with a size cap: for a large file, the head plus tail. The
// evidence each consumer scans for can land near either end of a long-running
// session: the arming invocation and any re-arm for the goal leash, and for
// the gate's automation scan a /loop invocation's first user line (head)
// beside the newest goal_status record (tail). It is the goal leash's reader
// and the automation scan's above-ceiling fallback (see
// readTranscriptForAutomation, which owns why the fallback is not that scan's
// primary read). Returns '' on any error or a non-regular file, whatever the
// size. The isFile check narrows, without closing, the window in which the
// path could be swapped for a FIFO between the stat and the open (a blocking
// read on a FIFO hangs, which no try/catch can rescue): both read branches
// re-resolve the path after the stat. The residual is accepted because
// exploiting it needs write access to the transcript's directory, which
// already implies control of the transcript contents themselves.
function readTranscriptCapped(transcriptPath) {
    try {
        const st = fs.statSync(transcriptPath);
        if (!st.isFile()) return '';
        const HEAD = 384 * 1024;
        const TAIL = 128 * 1024;
        if (st.size <= 512 * 1024) {
            return fs.readFileSync(transcriptPath, 'utf8');
        }
        const fd = fs.openSync(transcriptPath, 'r');
        try {
            const head = Buffer.alloc(HEAD);
            const hb = fs.readSync(fd, head, 0, HEAD, 0);
            const tail = Buffer.alloc(TAIL);
            const tb = fs.readSync(fd, tail, 0, TAIL, st.size - TAIL);
            return head.toString('utf8', 0, hb) + '\n' + tail.toString('utf8', 0, tb);
        } finally {
            try { fs.closeSync(fd); } catch { /* already closed */ }
        }
    } catch {
        return '';
    }
}

// Remove local-command output and caveat blocks from user-slot text. When a user
// runs a slash command the CLI echoes its stdout (and a caveat) back into the
// user turn inside <local-command-stdout>/<local-command-caveat> wrappers; that
// is the CLI's own output, not something the user typed, so it must not bind the
// leash (e.g. /kit-goal status prints the armed plan path, and a catted file or
// grep hit can echo a literal <command-args> string as data). The deliberate
// slash-command invocation record (<command-name>/<command-args>) is NOT
// stripped: the plan path a user types as a command argument is exactly how the
// arming session claims the binding. A close tag counts only when it names the
// same wrapper as its opener, so a coincidental mismatched-name closing tag
// inside real output cannot terminate the strip early and leave the rest of that
// output, or content past it, looking like ordinary typed text. The paired strip
// is greedy: it runs to the LAST same-name close tag in the entry, so echoed
// output that embeds a literal same-name close tag followed by a fake
// <command-name>/<command-args> claim cannot end the strip early and expose that
// claim. The accepted trade-off is that genuine typed text sitting between two
// same-name blocks in one entry is over-stripped, which errs toward NOT claiming
// (the safe direction). An opener with no matching closer anywhere in the
// (possibly capped) text is a truncated echo (cut by the read cap, or caught
// mid-write); it is stripped to end-of-text rather than left holding whatever it
// happened to contain.
//
// The implementation is a linear scan (one pass recording the last close tag
// per wrapper name, one pass over the openers) rather than a backtracking
// regex: this runs on user-slot text on per-turn hook paths, and a crafted
// entry dense with unmatched openers must cost milliseconds, not seconds (a
// greedy-with-backreference regex restarts an O(n) backtrack at every such
// opener, which is quadratic). The gate test suite pins both the semantics
// (differentially, against the regex form as a reference) and the bound.
function stripLocalCommandOutput(text) {
    // One forward pass records the LAST close tag per wrapper name, so the
    // opener loop below never rescans the text. Tags are matched
    // case-insensitively and pair across case, hence the case-folded map key;
    // the emitted text is always sliced from the original.
    const lastClose = new Map();
    const closeRe = /<\/local-command-([a-z]+)>/gi;
    let c;
    while ((c = closeRe.exec(text))) {
        lastClose.set(c[1].toLowerCase(), { start: c.index, end: c.index + c[0].length });
    }
    const openRe = /<local-command-([a-z]+)>/gi;
    let out = '';
    let pos = 0;
    for (;;) {
        openRe.lastIndex = pos;
        const m = openRe.exec(text);
        if (!m) return out + text.slice(pos);
        out += text.slice(pos, m.index) + ' ';
        const close = lastClose.get(m[1].toLowerCase());
        if (close && close.start >= m.index + m[0].length) {
            // Paired: strip to the LAST same-name close (greedy). Anything
            // between two same-name blocks, openers of other names included,
            // goes with the span, exactly as the greedy pairing implies.
            pos = close.end;
        } else {
            // Unmatched: stripped to end-of-text.
            return out;
        }
    }
}

// Every <command-args>...</command-args> span in the given text, in order:
// each span runs from an opener to the FIRST close after it, and scanning
// resumes past that close, the same non-overlapping enumeration a global lazy
// regex produces, but as linear literal scans (a lazy [\s\S]*? span restarts
// an O(n) walk at every unclosed opener, which is quadratic on crafted text
// and measured in whole seconds at the transcript read cap). Tags match
// case-insensitively. Spans are returned raw: callers own their
// normalization. An unclosed trailing opener contributes no span. Shared by
// userCommandArgsInclude below (which searches every span) and the gate's
// automation detection (which reads the first span only); the two must
// enumerate identically, which is why there is exactly one scanner.
function commandArgsSpans(text) {
    const spans = [];
    const openRe = /<command-args>/gi;
    const closeRe = /<\/command-args>/gi;
    let pos = 0;
    for (;;) {
        openRe.lastIndex = pos;
        const o = openRe.exec(text);
        if (!o) return spans;
        closeRe.lastIndex = o.index + o[0].length;
        const c = closeRe.exec(text);
        if (!c) return spans;
        spans.push(text.slice(o.index + o[0].length, c.index));
        pos = c.index + c[0].length;
    }
}

// Extract genuine user-typed text from a user message (a string content, or
// {type:'text'} blocks), strip local-command output, and test whether it is a
// kit-goal invocation that carries the needle. Two shapes count, checked in
// order on the same stripped text:
//   1. Harness markup: a <command-args> span carries the needle, and the same
//      content carries a <command-name> whose value is exactly '/kit-goal' or
//      ends with ':kit-goal' (the plugin-namespaced form, e.g.
//      '/claude-kit:kit-goal'), so another command that legitimately takes a
//      path argument (e.g. /graphify docs/plans/<plan>.md) cannot steal the
//      binding from the arming session.
//   2. Typed lead: the message's first non-whitespace characters are the
//      /kit-goal command token (optionally plugin-namespaced, any number of
//      ':'-joined segments, agreeing with the markup path's ':kit-goal'
//      suffix rule) followed by a token boundary, and the needle sits inside
//      the argument block that follows the token: the text up to the first
//      line that is blank (whitespace-only), or whose first non-whitespace
//      character is a backtick or '<'. A blank line ends a typed argument
//      list; a fence or tag line opens quoted or injected material, which
//      must never supply the needle; the one-plan-per-line arming shape
//      stays fully inside the block. The harness writes the markup shape
//      only when the command and its arguments share the message's first
//      line; a multi-line /kit-goal with one plan path per line lands as
//      plain prose, and this shape is what makes that arming claimable. The
//      lead anchor plus the block boundary are the anti-steal control: a
//      prose or code-fence lead never anchors, and a mention of the armed
//      plan behind a blank line, a fence, or a tag line inside a lead-token
//      message never supplies the needle. The shape is deliberately looser
//      than the harness's own parsing in exactly two ways, both confined to
//      hand-typed text: the token is case-insensitive (case variance in
//      typing is plausible and harmless), and the block spans lines (the
//      multi-line arming is this shape's whole reason to exist); the harness
//      itself would take only the first line and the exact case.
// Separators are normalized to '/' so a Windows-style reference matches the
// forward-slash plan path. tool_use and tool_result blocks are ignored: they
// carry tool I/O, which can echo the plan path outside any command invocation.
function userCommandArgsInclude(message, needle) {
    if (!message) return false;
    const c = message.content;
    let text = '';
    if (typeof c === 'string') {
        text = c;
    } else if (Array.isArray(c)) {
        // A tool block discards the WHOLE entry rather than being filtered out of
        // it, taking userTypedText's whole-entry reading in this file and going one
        // step stricter: that one discards on a tool_result, this one on either
        // tool block. A claim is an authorization
        // decision, so an entry mixing genuine user text with tool output is one
        // where planted markup could ride beside a real turn, and the stricter
        // of the two readings is the one that belongs on the deciding side.
        for (const b of c) {
            if (b && (b.type === 'tool_result' || b.type === 'tool_use')) return false;
        }
        for (const b of c) {
            if (b && b.type === 'text' && typeof b.text === 'string') text += '\n' + b.text;
        }
    } else {
        return false;
    }
    const strippedRaw = stripLocalCommandOutput(text);
    // Markup shape, on the separator-normalized whole: command-args spans are
    // matched by substring and the needle is a forward-slash path. EVERY span
    // is searched, not just the first: a real invocation can carry more than
    // one <command-args> span, and the plan path counts wherever it rides.
    // The enumeration is this file's linear scanner (commandArgsSpans).
    const stripped = strippedRaw.replace(/\\/g, '/');
    const nameMatch = /<command-name>([^<]*)<\/command-name>/i.exec(stripped);
    if (nameMatch) {
        const name = nameMatch[1].trim();
        if (name === '/kit-goal' || name.endsWith(':kit-goal')) {
            for (const span of commandArgsSpans(stripped)) {
                if (span.includes(needle)) return true;
            }
        }
    }
    // Typed-lead shape, evaluated only when the markup shape did not match.
    // Anchored against the stripped but UN-normalized text: the token is a
    // command, not a path, so a literal '\kit-goal' lead (which the harness
    // would never execute) must not normalize into a claiming '/kit-goal'.
    // The lookahead is the token boundary, so /kit-goal-notes.md never
    // matches; the (?:[\w-]+:)* prefix accepts the plugin-namespaced form,
    // multi-segment included, agreeing with the markup path's ':kit-goal'
    // suffix rule. Case-insensitive, unlike the markup path's exact name
    // comparison: this shape matches hand-typed text, where case variance is
    // plausible and harmless, while the markup name is harness-written and
    // exact.
    const lead = strippedRaw.trimStart();
    const leadMatch = /^\/(?:[\w-]+:)*kit-goal(?=\s|$)/i.exec(lead);
    if (!leadMatch) return false;
    // The needle counts only inside the argument block: the text from just
    // after the token up to the first line that is blank (whitespace-only),
    // or whose first non-whitespace character is a backtick or '<'. A blank
    // line ends a typed argument list; a fence or tag line opens quoted or
    // injected material, which must never supply the needle; the
    // one-plan-per-line arming shape stays fully inside the block. The
    // array-content path above concatenates every text block with '\n'
    // separators, so an appended second text block continues the argument
    // block only if nothing terminates it first: the '<' terminator is what
    // cuts an injected tag-shaped block. The token line's own tail is part
    // of the block even when empty (a token followed directly by a newline
    // is the multi-line arming's normal head); only a terminator character
    // ends the block there. Separator normalization applies to the block
    // alone, for the path comparison.
    const restLines = lead.slice(leadMatch[0].length).split('\n');
    let block = '';
    for (let i = 0; i < restLines.length; i++) {
        const t = restLines[i].trim();
        if (i > 0 && t === '') break;
        if (t !== '' && (t[0] === '`' || t[0] === '<')) break;
        block += restLines[i] + '\n';
    }
    return block.replace(/\\/g, '/').includes(needle);
}

// Scoping predicate for an unbound goal: does this session's transcript show the
// user typing the armed plan path as a /kit-goal argument? Matches the full
// repo-relative plan path (e.g. docs/plans/foo.md), separator-normalized, and
// only in one of userCommandArgsInclude's two invocation shapes of a USER entry
// (the arming invocation, including a re-arm after a crash): inside a
// <command-args>...</command-args> span of a kit-goal invocation, or inside
// the argument block of a typed /kit-goal lead (the block boundary is
// userCommandArgsInclude's; never past it). A plain prose mention of the path never claims:
// without this, any bystander session that happens to type or discuss the path
// (or that echoes it back, e.g. reading the session-start goal surfacing aloud)
// could steal the binding from the session actually working the plan.
// Deliberate exclusions:
//   - Assistant entries are skipped entirely: an assistant echo of the plan path
//     must never self-leash the session.
//   - isMeta entries are skipped: harness-injected records (e.g. the Stop
//     hook's own block reason, replayed back as "Stop hook feedback: ...") land
//     in the transcript as a user-type entry but are not something the user
//     typed, and the Stop hook's reason text names the plan path in full.
//   - Attachment and tool_result entries are skipped: the session-start
//     surfacing injects the plan path into EVERY session's transcript as an
//     attachment, and tool output can echo it, neither of which is the user
//     working the plan.
//   - Local-command output inside a user turn is stripped before the
//     <command-args> scan (the CLI's own echo of a slash command's stdout could
//     otherwise carry a literal, fake <command-args> string as quoted data),
//     and sub-agent (sidechain) turns do not count.
//   - The typed-lead shape anchors at the message's first non-whitespace
//     characters and reads the needle only from the argument block that
//     follows the token: a mid-message or quoted /kit-goal (prose before it,
//     a code fence around it) never claims, and a mention of the armed plan
//     behind a blank line, a fence, or a tag line inside a lead-token
//     message never claims either, so quoting or discussing an arming
//     command, or arming a DIFFERENT plan while mentioning this one, is not
//     arming this plan.
//   - It matches the dir-qualified path, not just the basename, so a session
//     that merely names a same-basename file is not leashed.
// False if there is no path or it is unreadable: a session we cannot scope is
// never leashed.
function userCommandArgsClaimPlan(transcriptPath, planRel) {
    try {
        if (!transcriptPath || !planRel) return false;
        const needle = String(planRel).replace(/\\/g, '/');
        const content = readTranscriptCapped(transcriptPath);
        if (!content) return false;
        const lines = content.split('\n');
        for (const line of lines) {
            const t = line.trim();
            if (!t) continue;
            let entry;
            try { entry = JSON.parse(t); } catch { continue; }
            if (!entry || entry.type !== 'user' || entry.isSidechain || entry.isMeta === true
                || entry.isCompactSummary === true) continue;
            if (userCommandArgsInclude(entry.message, needle)) return true;
        }
        return false;
    } catch {
        return false;
    }
}

// ---------------------------------------------------------------------------
// Automation detection for the PreCompact gate's interactive-deferral clause.
//
// The gate defers auto-compaction to the safety ceiling only when the session
// is a human interacting directly; a session driven by native /goal or /loop
// keeps the harness's early trigger. The transcript is the detection surface,
// and the shapes read here are undocumented harness output, the same class as
// the gate's other version-pinned facts: real-transcript observations, except
// the /goal clear argument shape, which follows from the invariant command
// markup and fails safe if wrong (an unrecognized clear leaves the newest
// evidence at met:false and the session on the early trigger). Detection
// errs toward "automated" only via absent evidence never arriving (a loop
// that stops being continued classifies automated indefinitely); every read
// or parse defect classifies as no evidence, and the gate turns that into a
// verdict whose failure direction is the early-trigger status quo.
// ---------------------------------------------------------------------------

// The literal command-name tags a typed /goal or /loop invocation writes. The
// FULL tag is load-bearing: a continuing ScheduleWakeup carries the loop's
// prompt verbatim, so a bare '/loop' substring appears in every wakeup and
// would read each one as a fresh invocation.
const GOAL_COMMAND_TAG = '<command-name>/goal</command-name>';
const LOOP_COMMAND_TAG = '<command-name>/loop</command-name>';

// Extract the genuinely user-typed text of a user entry's message: a string
// content, or the concatenated {type:'text'} blocks of an array content.
// Returns null when there is none, and null for an array carrying any
// tool_result block: tool output is the observed source of quoted command
// markup (a file containing the literal tags, read back into the session),
// and the harness's own /loop detector excludes exactly this shape, so the
// whole entry is discarded rather than trusting its text blocks.
function userTypedText(message) {
    if (!message) return null;
    const c = message.content;
    if (typeof c === 'string') return c;
    if (!Array.isArray(c)) return null;
    let text = '';
    for (const b of c) {
        if (b && b.type === 'tool_result') return null;
        if (b && b.type === 'text' && typeof b.text === 'string') text += '\n' + b.text;
    }
    return text;
}

// Scan transcript text for evidence that native /goal or /loop is driving the
// session. Returns true when either is in effect by the NEWEST evidence of
// its kind: transcripts are append-ordered, so a single forward pass letting
// the last match of each kind win reads newest-wins for free (the real
// end-of-loop sequence is /loop lines followed by a terminal stop, after
// which the session continues as ordinary interactive work).
//
// Evidence, per instrument:
//   /goal, surface 1: a goal_status attachment (type 'attachment', its
//     attachment.type 'goal_status'), which the goal system writes at arming
//     and at every stop evaluation. met === false means in effect; met ===
//     true means satisfied and auto-cleared, so not. Only a strict boolean
//     met decides; sentinel and reason are carried but decide nothing (a
//     real record carries met:true beside sentinel:true).
//   /goal, surface 2: a user command line whose <command-name> is exactly
//     /goal. <command-args> trimmed and lowercased equal to 'clear' means
//     not in effect; any other non-empty argument means in effect; a bare
//     /goal (empty args) reads state and decides nothing.
//   /loop: a user command line whose <command-name> is exactly /loop means
//     in effect; an assistant ScheduleWakeup tool_use whose input.stop is
//     strictly true means the loop ended. A continuing wakeup (delaySeconds,
//     prompt, ...) decides nothing: every iteration of a dynamic loop
//     re-writes its own /loop command line, so the positive evidence
//     refreshes without it.
//
// Tag order in a command line is not fixed (/loop writes <command-message>
// before <command-name>, /goal the other way), so each tag is matched by its
// own independent regex, first tag of each kind winning within the entry.
//
// Exclusions, adopted from the harness's own /loop detector, each defeating
// an observed false positive (quoted markup rides in tool output whenever a
// file containing the tags is read into a session):
//   - a raw line containing the quoted JSON form "tool_result" (quotes
//     included, the same discriminator the harness's detector uses) is never
//     a command line; the bare substring would also skip a genuine typed
//     command whose argument text merely mentions tool_result;
//   - a command line must be entry.type 'user', the wakeup entry.type
//     'assistant';
//   - isMeta, isCompactSummary, and sidechain entries are skipped;
//   - array content holding any tool_result block discards the entry
//     (userTypedText above);
//   - local-command output is stripped before the tag scan (a /goal
//     invocation's own stdout is echoed back inside <local-command-stdout>
//     carrying the full goal condition text);
//   - the ScheduleWakeup check is structural, never a substring (the tool
//     listing rides in system-prompt-shaped entries, so the bare name
//     appears in transcripts with no real invocation).
//
// String prefilters run before any JSON.parse so a multi-megabyte scan costs
// milliseconds; an unparseable line is skipped, no evidence.
function automationInEffect(text) {
    let goalInEffect = null;
    let loopInEffect = null;
    const lines = text.split('\n');
    for (const line of lines) {
        const t = line.trim();
        if (!t) continue;
        const rawToolResult = t.includes('"tool_result"');
        const mayGoalStatus = t.includes('"goal_status"');
        const mayGoalLine = !rawToolResult && t.includes(GOAL_COMMAND_TAG);
        const mayLoopLine = !rawToolResult && t.includes(LOOP_COMMAND_TAG);
        const mayWakeup = t.includes('tool_use') && t.includes('ScheduleWakeup');
        if (!mayGoalStatus && !mayGoalLine && !mayLoopLine && !mayWakeup) continue;
        let entry;
        try { entry = JSON.parse(t); } catch { continue; }
        if (!entry || typeof entry !== 'object') continue;
        if (entry.isSidechain || entry.isMeta === true || entry.isCompactSummary === true) continue;

        if (mayGoalStatus && entry.type === 'attachment'
                && entry.attachment && typeof entry.attachment === 'object'
                && entry.attachment.type === 'goal_status') {
            if (entry.attachment.met === false) goalInEffect = true;
            else if (entry.attachment.met === true) goalInEffect = false;
            continue;
        }

        if ((mayGoalLine || mayLoopLine) && entry.type === 'user') {
            const typed = userTypedText(entry.message);
            if (typed === null) continue;
            const stripped = stripLocalCommandOutput(typed);
            const nameMatch = /<command-name>([^<]*)<\/command-name>/i.exec(stripped);
            if (!nameMatch) continue;
            const name = nameMatch[1].trim();
            if (name === '/loop') {
                loopInEffect = true;
            } else if (name === '/goal') {
                // The first <command-args> span decides (first tag wins, the
                // convention every command-line reader here follows); no span
                // at all, an unclosed opener included, decides nothing.
                const spans = commandArgsSpans(stripped);
                const args = spans.length > 0 ? spans[0].trim().toLowerCase() : '';
                if (args === 'clear') goalInEffect = false;
                else if (args !== '') goalInEffect = true;
            }
            continue;
        }

        if (mayWakeup && entry.type === 'assistant') {
            const content = entry.message && entry.message.content;
            if (!Array.isArray(content)) continue;
            for (const b of content) {
                if (b && b.type === 'tool_use' && b.name === 'ScheduleWakeup'
                        && b.input && typeof b.input === 'object'
                        && b.input.stop === true) {
                    loopInEffect = false;
                }
            }
        }
    }
    return goalInEffect === true || loopInEffect === true;
}

// The byte ceiling on reading a transcript whole for the automation scan.
//
// Newest-evidence-wins only holds over bytes actually read, so the scan wants
// the whole file: a head-plus-tail read leaves an unread middle, and a loop
// whose terminating stop lands there shows its opening /loop line and nothing
// that retires it, classifying a session that has been hands-on for hours as
// automation-driven. That is the exact case the deferral exists to serve, and
// it is the common one, because a session keeps working for as long as it
// likes after its loop ends.
//
// 64 MB scans a whole multi-day session (the largest transcripts observed run
// to 57 MB) with headroom, and the cost is linear and bounded: at that size
// the read plus classification is roughly 150 ms and 175 MB of peak resident
// memory in this short-lived hook process, which runs only when the harness
// is already offering a compaction. Past the ceiling the head-plus-tail
// reader takes over, so a runaway or hostile file costs the same 512 KB it
// always did; the unread middle comes back with it, and the misread it can
// produce degrades to the early trigger, never to a wedged session.
const AUTOMATION_READ_MAX_BYTES = 64 * 1024 * 1024;

// Read a transcript for the automation scan: the whole file at or below
// AUTOMATION_READ_MAX_BYTES, the head-plus-tail read above it. Returns '' on
// any error or a non-regular file, which classifies as no evidence. The
// isFile check narrows the same FIFO-swap window readTranscriptCapped
// documents, and on the same accepted residual: a blocking read on a FIFO
// hangs where no try/catch can rescue it, and the path is re-resolved after
// the stat either way.
function readTranscriptForAutomation(transcriptPath) {
    try {
        const st = fs.statSync(transcriptPath);
        if (!st.isFile()) return '';
        if (st.size > AUTOMATION_READ_MAX_BYTES) return readTranscriptCapped(transcriptPath);
        return fs.readFileSync(transcriptPath, 'utf8');
    } catch {
        return '';
    }
}

// Does the transcript at this path show a native automation instrument
// driving the session? A missing path, an unreadable or non-regular file, or
// any escape reads as no evidence (false); the caller's valve leg reads the
// same file, so an unreadable transcript also yields no consumed-token
// reading and the gate's verdict on it is allow.
function transcriptShowsAutomation(transcriptPath) {
    try {
        if (!transcriptPath) return false;
        const text = readTranscriptForAutomation(transcriptPath);
        if (!text) return false;
        return automationInEffect(text);
    } catch {
        return false;
    }
}

module.exports = {
    checkpointPath, readCheckpoint, readCheckpointResult, writeCheckpoint, clearCheckpoint,
    adoptCheckpoint, checkpointAdoptable, storableCheckpointOwner, checkpointMatches, sameSessionId,
    CHECKPOINT_MAX_AGE_MS, CHECKPOINT_PENDING_MAX_AGE_MS, CHECKPOINT_FUTURE_SKEW_MS,
    roleBoundaryPath, consentPath, ROLE_BOUNDARY_MAX_AGE_MS, CONSENT_MAX_AGE_MS,
    markerMatches, readRoleBoundary, readConsent, readRoleBoundaryResult, readConsentResult,
    writeRoleBoundary, writeConsent, clearRoleBoundary, clearConsent,
    projectHoldsSessionTranscript, usableSessionId,
    gateStatePath, gateLogPath, readGateState, readGateStateResult, recordGateDecision,
    gateEpisodeOpen, pendingOfferCorroborated, checkpointOwner, recordEpisodeNudge,
    projectGateEpisode, episodePhrase, wholeMinutesSince, gateCount,
    readTranscriptCapped, stripLocalCommandOutput, commandArgsSpans,
    userCommandArgsClaimPlan,
    automationInEffect, transcriptShowsAutomation
};
