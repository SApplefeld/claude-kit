// Shared library for the kit-native goal continuity mechanism.
//
// Goal state is a small project-scoped JSON file (.kit/goal-state.json,
// gitignored) that survives a session swap because it lives in the repo, not
// in any one session's transcript. It belongs to the repository rather than to
// any one checkout of it, so a linked git worktree reads and writes the main
// checkout's file (goalPath below owns the resolution). This module is the
// single owner of the
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

// The main checkout a git worktree belongs to, or null when the working
// directory is not a worktree of one.
//
// A goal armed in the main checkout must hold a session working in one of its
// worktrees: the leash is the repository's, and a worktree that resolves goal
// state against its own directory mints a second, unread .kit/goal-state.json
// the main checkout's sessions never see, so its checkpoints cannot open and
// its gate defers to the ceiling. The resolver follows the link git itself
// maintains: the worktree's .git pointer file out to
// <main>/.git/worktrees/<name>, and that directory's own gitdir file back.
//
// This is a second spelling of worktreeMainRoot in ../scripts/memq.js, which
// files a worktree's memories under its main checkout for the same reason. It
// is spelled here rather than imported because readGoal runs where a require
// must not be able to fail or cost anything (the PreCompact gate before any
// verdict, the Stop hook while holding a stop), and pulling the whole CLI
// module onto those paths for three functions is neither minimal nor safe
// against a damaged copy. The two implementations are pinned together by
// test/kit-goal-worktree.test.js over shared fixtures, benign and refused
// alike (ordinary checkout, closing handshake, bare-repo worktree, submodule,
// a non-pointer .git file, pointers past the read and path caps, and on win32
// a network-spelled pointer), so a change that moves one spelling and not the
// other fails the pin. The win32 spelling fold is the one shared behavior
// outside it: the pin's fixtures are already canonical, so no mintable fixture
// can catch a resolver that dropped the fold.
//
// The two-way handshake is the security boundary, not a validity check. The
// .git pointer file is on-disk data in a directory the session cd'd into, so a
// pointer alone must never redirect goal-state reads and writes to a path of
// its author's choosing. What a planted pointer cannot supply is the other
// half: <gitdir>/gitdir naming this directory back, beside the commondir file
// and under a real .git directory, all of it inside the administrative
// directory of the checkout being claimed. What that proves is bounded: whoever
// made the claim could already write a git-shaped administrative directory at
// the path now named as the main checkout. The reason a clone alone cannot
// arrange it is git's own refusal to check out any path whose components
// include .git, so the far half has to be planted by something with write
// access there, not by content that merely arrived.
//
// Only <cwd>/.git is consulted, never an upward walk: a subdirectory of a
// checkout resolves its own goal state today and stays that way. Submodules
// are excluded by construction rather than by a test of their own, since their
// gitdir names .git/modules/<name> and only the worktrees form is accepted. A
// bare repository's worktree fails the same shape check (the segment above
// worktrees is not a .git directory), which is right: there is no main
// checkout to resolve to.
//
// Every failure answers null and the working directory stands, because a
// worktree pointer is ambient filesystem state: an unreadable or unrecognized
// one means an ordinary checkout far more often than it means a problem. The
// one failure worth saying out loud is a worktree-shaped pointer whose
// handshake does not close, since there the operator meant to share the main
// checkout's leash and is silently getting a second one.
//
// Memoized per working directory: every goal-state read and write resolves the
// root, and each resolution would otherwise stat and read several files.
const worktreeMainRoots = new Map();
let worktreeHandshakeNoted = false;
let worktreeOrphanNoted = false;

// forDisplay marks a resolution asked for display trust rather than for
// goal-state resolution: planDisplayRoot probing a recorded execution tree,
// where a failed handshake is the ordinary, silent fallback and the operator
// notes below would be false (they assert where goal state is read, which a
// display probe never decides) and would recur at every status-line refresh,
// since each refresh is a fresh process. A display probe therefore resolves
// in silence. The suppression rides only on the resolving call: a memoized
// answer carries no note either way, and in every consumer the goal-state
// resolution of a directory precedes any display probe of it, so a note owed
// for the working directory itself is never spent by the quiet path.
function worktreeMainRoot(cwd, forDisplay) {
    const key = String(cwd);
    if (worktreeMainRoots.has(key)) return worktreeMainRoots.get(key);
    const main = resolveWorktreeMainRoot(key, forDisplay);
    worktreeMainRoots.set(key, main);
    return main;
}

// A .git pointer file is one line git writes, so a fixed-size prefix reads all
// of one; the cap keeps a directory whose .git happens to be some arbitrary
// large file from being pulled into memory on a path every goal read crosses.
const GIT_POINTER_READ_CAP = 4096;

// Characters of a path a .git pointer file may name. A working directory is
// bounded by what the OS will hand back; pointer content is not.
const GIT_POINTER_PATH_CAP = 2048;

// A .git pointer file's first bytes, or '' when the path does not answer as a
// regular file. The fstat is taken on the open descriptor rather than on the
// name, so what is measured is the file that was opened: a name checked and
// then swapped for something else between the check and the open is the
// classic way a read is steered somewhere it was never meant to go. Off win32
// the open itself is non-blocking, because opening a fifo for reading
// otherwise waits for a writer that a planted one will never provide, and this
// call sits on the path every goal read crosses. Throws on an unopenable path;
// the resolver's own try is the catch.
function readGitPointer(file) {
    const flags = process.platform === 'win32'
        ? fs.constants.O_RDONLY
        : fs.constants.O_RDONLY | (fs.constants.O_NONBLOCK || 0);
    const fd = fs.openSync(file, flags);
    try {
        if (!fs.fstatSync(fd).isFile()) return '';
        const buf = Buffer.alloc(GIT_POINTER_READ_CAP);
        const n = fs.readSync(fd, buf, 0, GIT_POINTER_READ_CAP, 0);
        return buf.toString('utf8', 0, n);
    } finally {
        fs.closeSync(fd);
    }
}

// Path and filename fragments compare the way the platform's filesystem
// compares them, so one physical file cannot pass one check here and fail
// another. Only win32 folds case. Off win32 the comparison is exact even
// where the filesystem folds (macOS's default APFS is case-insensitive and
// case-preserving), so two spellings of one file can fail to match there;
// that errs toward not resolving, and it matches memq's fsEq, the agreement
// the cross-implementation pin depends on.
function fsEq(a, b) {
    return process.platform === 'win32'
        ? String(a).toLowerCase() === String(b).toLowerCase()
        : a === b;
}

function resolveWorktreeMainRoot(cwd, forDisplay) {
    const dotGit = path.join(cwd, '.git');
    let gitdir;
    try {
        // A directory is the ordinary checkout, an absent entry is no
        // repository at all, and both take the cwd derivation untouched.
        if (!fs.statSync(dotGit).isFile()) return null;
        // Anchored at the start of the file, not at any line of it: git writes
        // the pointer as the first and only line, and a gitdir: line found
        // somewhere inside an arbitrary file is that file's content rather
        // than a pointer.
        const line = /^[ \t]*gitdir:[ \t]*([^\r\n]+?)[ \t]*\r?(?:\n|$)/.exec(readGitPointer(dotGit));
        if (line === null) return null;
        gitdir = path.resolve(cwd, line[1]);
    } catch {
        return null;
    }
    // Every rejection below this point is decided on the path text alone,
    // before anything touches the filesystem at the pointer's target, because
    // for the two shapes that follow the touch is itself the harm.
    //
    // A pointer naming a UNC or device path from a checkout that is not itself
    // on that share is refused outright: opening a path under \\host\share is
    // an outbound SMB connection that authenticates automatically as the
    // logged-in account, so a single planted file in any directory a session
    // cd's into would hand an attacker-named host a credential exchange, and
    // hooks resolve this on their own at every session start and stop. Reading
    // the target to find out whether the pointer is honest is exactly the
    // operation being guarded against, so the shape is judged first and never
    // opened.
    if (process.platform === 'win32' && path.parse(gitdir).root.startsWith('\\\\')
        && !fsEq(path.parse(gitdir).root, path.parse(path.resolve(cwd)).root)) {
        return null;
    }
    if (gitdir.length > GIT_POINTER_PATH_CAP) return null;
    // The shape is read by walking path segments rather than by matching the
    // raw text, so a pointer spelled with either separator, as git spells them
    // with forward slashes on Windows too, is the same shape.
    const worktrees = path.dirname(gitdir);
    const mainDotGit = path.dirname(worktrees);
    const main = path.dirname(mainDotGit);
    if (!fsEq(path.basename(worktrees), 'worktrees') || !fsEq(path.basename(mainDotGit), '.git')) {
        return null;
    }
    try {
        // The far half of the handshake, in the order that reads cheapest:
        // the claimed main checkout carries a real .git directory, that
        // worktree's administrative directory carries the commondir file git
        // keeps beside every one of them, and its gitdir file names this
        // working directory's own .git back.
        if (!fs.statSync(mainDotGit).isDirectory()) throw new Error('no .git directory');
        if (!fs.statSync(path.join(gitdir, 'commondir')).isFile()) throw new Error('no commondir');
        const back = readGitPointer(path.join(gitdir, 'gitdir')).replace(/\s+$/, '');
        if (back !== '' && fsEq(path.resolve(gitdir, back), path.resolve(dotGit))) {
            return acceptedWorktreeMain(cwd, main, forDisplay);
        }
    } catch {
        // An unreadable or absent half is a handshake that did not close, the
        // same answer as one naming somewhere else.
    }
    // The note names the handshake generically rather than any one half of it,
    // because every failed leg lands here: a missing or unreadable commondir, a
    // claimed main whose .git is not a directory, and a back-pointer naming
    // somewhere else all read the same from this side. It fires once per
    // process, and every hook consumer is a fresh process, so across a session
    // it recurs by design; the flag only keeps one process from repeating it.
    // A display probe stays silent instead: fired over a recorded execution
    // tree, the sentence below would be false (that probe never decides where
    // goal state is read) and would repaint at every status-line refresh.
    if (!forDisplay && !worktreeHandshakeNoted) {
        worktreeHandshakeNoted = true;
        try {
            process.stderr.write('kit-goal: the .git file in the working directory points at a worktree '
                + 'whose handshake with the main checkout it names does not close (a missing or '
                + 'unreadable administrative file, or a back-pointer naming somewhere else), so goal '
                + 'state is read from the working directory rather than the main checkout (git '
                + 'worktree repair is the usual remedy)\n');
        } catch { /* the note is best-effort; a failed write changes nothing */ }
    }
    return null;
}

// A path folded to the volume's own spelling on win32 (an 8.3 short form, a
// junction, a subst drive, and a re-cased segment all fold to one spelling),
// and the path unchanged off win32, where resolving the real path would
// silently follow symlinks. A path the fold cannot resolve keeps its lexical
// spelling, which errs toward whatever the caller's comparison already did
// with the unfolded form. One spelling of the fold serves both places a root
// is compared: acceptedWorktreeMain folds the accepted main, and
// planDisplayRoot folds the caller's own root before comparing the two.
function nativeSpelling(p) {
    if (process.platform !== 'win32') return p;
    try {
        return fs.realpathSync.native(p);
    } catch {
        return p;
    }
}

// The accepted main checkout, plus the one note a successful resolution can
// owe the operator.
//
// On win32 the spelling is folded to the volume's own (nativeSpelling above),
// so the resolved root reads the same however the pointer spelled it; the
// filesystem would land every spelling on one file regardless, but the path
// is compared and surfaced by tests and reports, and the memq resolver folds
// the same way (an agreement the pin's fixtures, already canonical, cannot
// themselves exercise). A fold that fails keeps the lexical spelling: the
// handshake already closed, so the resolution stands either way.
//
// A goal-state file already standing at the worktree's own .kit/ is worth a
// stderr note, because it is now unread: nothing here moves or merges a leash
// armed before the resolution existed, and a file that quietly stops being
// consulted is the kind of loss that is noticed months later. The note fires
// once per process, and every hook consumer is a fresh process, so it recurs
// across a session for as long as the orphan stands. A display probe stays
// silent for worktreeMainRoot's reasons: its subject is a recorded execution
// tree, about which the sentence would be false.
function acceptedWorktreeMain(cwd, main, forDisplay) {
    const root = nativeSpelling(main);
    if (!forDisplay && !worktreeOrphanNoted) {
        try {
            if (fs.statSync(path.join(cwd, '.kit', 'goal-state.json')).isFile()) {
                worktreeOrphanNoted = true;
                process.stderr.write('kit-goal: this worktree reads and writes the main checkout\'s '
                    + 'goal state, and a goal-state file left under the worktree\'s own .kit/ is '
                    + 'no longer read; clear it by hand if it is stale\n');
            }
        } catch {
            // No such file is the ordinary case and the quiet one.
        }
    }
    return root;
}

// The directory .kit/ resolves against: the main checkout when cwd is a linked
// worktree, and cwd itself otherwise. Reaching for worktreeMainRoot directly
// is the mistake this exists to prevent, since that function answers null for
// an ordinary checkout, which is most of them, and null is not a root.
function goalRoot(cwd) {
    const main = worktreeMainRoot(cwd);
    return main === null ? cwd : main;
}

// Path to the goal-state file for a given working directory. Every read/write
// helper in this file resolves through here, so every consumer of this module
// inherits the worktree resolution without an edit of its own. What resolves
// is only where the STATE file lives: plan docs stay resolved against the
// caller's own cwd, because the live plan doc belongs to the execution tree's
// branch while the leash belongs to the repository. Three readers reach past
// that cwd for a plan doc, and none replaces it. planDisplayRoot runs the
// other way, letting a progress-rendering surface prefer the recorded
// execution tree's copy; nothing that decides a hold or a release resolves
// through it. queueEntryState and the Stop hook's 'gone' cross-check are the
// other two: each takes the same shape over goalRoot, asking BOTH trees and
// acting only where they agree, which is a second opinion rather than a second
// resolution. Where the two disagree, the answer is the conservative one and no
// position moves. The pair ask different underlying questions (whether an entry
// reads finished, and whether an armed plan's doc is gone) and so stay two
// predicates rather than one.
function goalPath(cwd) {
    return path.join(goalRoot(cwd), '.kit', 'goal-state.json');
}

// The cap on a stored transcript path. Long enough for a real harness
// transcript path, short enough that no caller can pad the state file.
const TRANSCRIPT_MAX = 512;

// The clamp every stored path field routes through: a non-empty string within
// the caller's cap, free of control characters, and not network-shaped (two
// leading separators: a UNC path, a //server form, or the \\?\ device
// namespace, whose root spells the same way). The channel is the goal-state
// file, hand-editable and surfaced by the hooks, so these rules belong to the
// channel rather than to whichever producer first needed them; both stored
// path fields below route through this one spelling, so a hardening applied
// here reaches every field at once where a hand copy would drift.
//
// requireAbsolute is the one leg not every field takes. Where it is on, the
// value must name a place independent of the reader. On win32 that means a
// drive-qualified root (letter, colon, separator), because path.isAbsolute
// also admits a drive-relative rooted form (a single leading separator),
// which resolves against whichever drive the reading process happens to be
// on, the very ambiguity the leg exists to exclude; the network-shape leg
// above already refuses the UNC and device roots that are also absolute. Off
// win32, path.isAbsolute is the whole question.
function storablePathValue(value, cap, requireAbsolute) {
    if (typeof value !== 'string' || value === '' || value.length > cap) return false;
    if (/[\x00-\x1F]/.test(value) || /^[\\/]{2}/.test(value)) return false;
    if (!requireAbsolute) return true;
    return process.platform === 'win32' ? /^[A-Za-z]:[\\/]/.test(value) : path.isAbsolute(value);
}

// Whether a value is storable as boundTranscript: storablePathValue at the
// transcript cap, absoluteness not required. The path is machine-local and
// lives in a gitignored file; it is only ever fs.stat'ed, never executed, and
// never surfaced raw. The control-character leg is a sanitize-before-store
// guard (a newline would smuggle text into a file the hooks surface into the
// model's context). The network-path leg narrows the hang surface of the
// stat, which runs synchronously at every SessionStart and blocks for the SMB
// timeout on an unreachable share: it rejects the doubled-separator forms,
// and only those. A path on a mapped network drive letter is
// indistinguishable from a local disk without a syscall, so it passes this
// check and can still hang the stat; that residual takes a hand-edited state
// file to reach, since the harness produces transcript paths under the local
// user profile.
function validTranscript(value) {
    return storablePathValue(value, TRANSCRIPT_MAX, false);
}

// Whether a value is storable and followable as executionTree: the absolute
// path of the linked worktree a chapter boundary was last opened from
// (recordExecutionTree below is the field's one writer), judged by
// storablePathValue at the pointer-path cap with absoluteness required. The
// shared legs matter here for validTranscript's reasons: the value sits in a
// hand-editable state file, a display reader stats under it at every
// status-line refresh, and a network-shaped path would turn each of those
// stats into an outbound connection with an SMB timeout on it. Absoluteness
// is required on top, because the value's whole meaning is a tree somewhere
// else: a relative one would silently resolve against whichever directory the
// reader happens to run in. The cap is the pointer-path cap rather than the
// transcript's, since this is the same kind of value a .git pointer names, a
// working directory.
//
// This screen is lexical only. Whether the path really is a worktree of the
// repository whose state carries it is planDisplayRoot's question, answered by
// the same handshake goal-state resolution trusts, at the one moment the
// value is about to be followed.
function validExecutionTree(value) {
    return storablePathValue(value, GIT_POINTER_PATH_CAP, true);
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
    // executionTree is optional and display-trust only (recordExecutionTree
    // states the whole contract), so a value the screen refuses is removed
    // rather than nulled: absent is the field's ordinary state, and no reader
    // tells the two apart.
    if (!validExecutionTree(state.executionTree)) delete state.executionTree;
    state.authorizations = normalizeAuthorizations(state.authorizations, state.queue);
    return state;
}

// The authorization map as every reader may rely on it: an object with NO
// prototype, keyed by the plan paths the queue actually holds, each value either
// a printable-ASCII sentence within safeForAuthorization's cap or null for none
// recorded. Anything else (absent, an array, a scalar, a hand-edited value
// carrying escape sequences or padded to kilobytes) is repaired here rather than
// propagated, matching the repair the queue and the history already get on every
// read.
//
// The value is quoted plan-doc content, so it is re-screened at read and not
// only at write: it is written back verbatim by every advance and bind, and it
// reaches a terminal through the CLI's status report, so a hand edit that never
// went through the writer must not survive one round trip into the file the
// readers trust. A string with nothing printable left in it records as none,
// since an empty quote asserts a section that said nothing.
//
// The keys answer to the same rule: this is the one field keyed by untrusted,
// hand-editable strings, and it is both built and read by key. So the map is
// walked from the queue rather than from the file's own key list, which does
// three things at once. It prunes a key naming no queued plan, so a hand edit
// cannot park a claim about a plan this state does not carry and a plan dropped
// by a re-arm does not leave its authorization behind. It re-validates the keys
// against the containment rule, since every queue entry has already round-tripped
// normalizePlanArg above. And it reads each entry as an OWN property, which
// matters because a plain object answers a key it never recorded with whatever
// Object.prototype carries under that name: a plan path of 'toString' would
// otherwise render a native function as the authorization that plan recorded.
// The absent prototype closes that direction for every later reader too, none of
// which can know the key it is about to look up came from a file.
function normalizeAuthorizations(value, queue) {
    const clean = Object.create(null);
    if (!value || typeof value !== 'object' || Array.isArray(value)) return clean;
    for (const rel of queue) {
        if (!Object.prototype.hasOwnProperty.call(value, rel)) continue;
        const entry = value[rel];
        if (typeof entry !== 'string') {
            clean[rel] = null;
            continue;
        }
        const safe = safeForAuthorization(entry);
        clean[rel] = safe === '' ? null : safe;
    }
    return clean;
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
// what planHeadText, armGoal, the CLI's queue rendering, the Stop hook's hold,
// the queue-position walk's treeEntryState, the SessionStart hook's plan
// inventory and the status-line widget all call: a reader that answered
// differently would open a path another one refused, which is the disagreement
// this file's section exists to close.
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
    return resolvePlanLink(cwd, full).size;
}

// The link-resolution half of planFileSize's rule, spelled once so the two
// questions asked of it cannot answer differently: the size when the link
// resolves, inside the repo, to a regular file, and otherwise how the refusal
// was reached. planFileSize takes the size and discards the rest, which is why
// its contract is unchanged by this split; planPathState needs the rest, because
// a refusal it must hold a stop over forever and one that may clear on its own
// look identical from a bare null.
//
// A dangling link raises ENOENT from realpathSync, which pathErrnoClass calls
// 'absent'. That is the wrong word here and is mapped to a determinate refusal
// instead: something IS at the plan path, it simply cannot be opened as a plan
// doc, and it will not start being openable without a hand fixing it.
function resolvePlanLink(cwd, full) {
    try {
        const real = fs.realpathSync(full);
        if (normalizePlanArg(fs.realpathSync(cwd), real) === null) return { size: null, cls: 'determinate' };
        const st = fs.statSync(real);
        return st.isFile() ? { size: st.size, cls: null } : { size: null, cls: 'determinate' };
    } catch (err) {
        const cls = pathErrnoClass(err && err.code);
        return { size: null, cls: cls === 'transient' ? 'transient' : 'determinate' };
    }
}

// Why the plan doc at a repo-relative plan path could not be read, judged by the
// same rule planFileSize applies, so the callers of one question cannot answer
// differently. Asked only where planHead has already reported the path
// unreadable, and one of:
//
//   'gone'        nothing is there; archiving a finished plan is the expected
//                 cause, but this state alone cannot tell that from a deletion
//                 or a path that never held a doc
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
    // than the kind, which is the transient answer. A resolution that did not
    // finish splits the same way the lstat above splits: a transient errno
    // (a scanner holding the target, a descriptor exhaustion) says nothing
    // permanent about the path and fails open, where the determinate refusals
    // (out of the repo, dangling, cyclic, not a regular file) hold the stop.
    const link = resolvePlanLink(cwd, path.join(cwd, planRel));
    if (link.size !== null) return 'unreadable';
    return link.cls === 'transient' ? 'unreadable' : 'unusable';
}

// The directory a DISPLAY of the armed plan doc resolves planRel against: the
// recorded execution tree when the goal state names one this reader can
// trust, and the caller's own cwd otherwise, which is the resolution every
// display reader applies where no tree is recorded.
//
// DISPLAY TRUST ONLY, like the field it reads: this answers where to render
// progress from, and nothing gate-deciding or leash-deciding may call it. The
// asymmetry is deliberate and is the reason the answer is not goalPath's: the
// STATE belongs to the repository and resolves worktree-to-main, while the
// live PLAN DOC belongs to the executing branch and so may sit in the
// worktree the state's own checkout cannot see.
//
// The trust test runs three legs, plus the caller's optional cap below,
// judged before anything under the tree is opened. The value must pass the
// lexical screen (validExecutionTree) even
// though readGoal already applied it, because this is the one leg the
// ordinary read does not guarantee: normalizeState returns early for a state
// whose plan is absent or non-string, so a caller handing this function such
// a state, or a state built by other means, could otherwise make the
// resolver below touch a network-shaped path. The tree must then prove it is
// what it claims to be, a linked worktree of the repository whose state
// carries it: worktreeMainRoot's two-way handshake must close FROM the tree
// (probed as a display resolution, so a broken handshake falls back in
// silence rather than firing the goal-state repair note at every status-line
// refresh) and land on the same root this cwd's goal state resolves to, so a
// hand-edited field naming an arbitrary directory, or a worktree of some
// other repository, falls back rather than being followed. The accepted main
// arrives folded to the volume's own spelling on win32, while goalRoot
// answers an ordinary checkout with the caller's literal cwd, so the cwd
// side is folded the same way before the compare: unfolded, a cwd spelled
// through an 8.3 segment, a junction, or a subst drive would miss and
// silently keep the stale copy, the defect this resolver exists to fix. And
// the tree must hold planRel as a readable plan doc by planFileSize's own
// kind rule, so a FIFO or an out-of-repo link planted at the tree's copy is
// refused exactly as it would be at the checkout's own. planRel itself is
// round-tripped through normalizePlanArg first, the same guard every reader
// of a stored plan path applies, kept here so this function is safe on its
// own terms whatever calls it.
//
// capBytes is the caller's own read cap, optional: a display reader that
// bounds how large a plan doc it will read whole passes that bound, and a
// tree copy past it is a tree that cannot be trusted, so the answer falls
// back to the checkout's copy. Elected instead, the caller's own read would
// refuse the tree copy and drop its segment entirely, when the checkout's
// readable copy was there to fall back on.
//
// state is optional: a caller that has already read the goal state passes it
// and spends no second read; one holding only a path (the status-line
// launcher's cache-freshness probe) leaves it undefined and the state is read
// here. Never throws; every failure answers cwd, the resolution display
// readers apply with no tree recorded.
function planDisplayRoot(cwd, planRel, state, capBytes) {
    try {
        const goal = state === undefined ? readGoal(cwd) : state;
        if (!goal || !validExecutionTree(goal.executionTree)) return cwd;
        if (typeof planRel !== 'string' || normalizePlanArg(cwd, planRel) !== planRel) return cwd;
        const tree = goal.executionTree;
        const main = worktreeMainRoot(tree, true);
        if (main === null || !fsEq(main, nativeSpelling(goalRoot(cwd)))) return cwd;
        const size = planFileSize(tree, planRel);
        if (size === null || size === 0) return cwd;
        if (typeof capBytes === 'number' && size > capBytes) return cwd;
        return tree;
    } catch {
        return cwd;
    }
}

// The goal state's read cap. The writer produces a plan path, the armed queue of
// plan paths, one condition sentence, a bound session id, a transcript path
// capped at TRANSCRIPT_MAX, one authorization entry per queued plan holding a
// sentence capped at AUTHORIZATION_MAX_CHARS (the largest per-plan contributor
// of the lot), and one short history entry per finished plan: a few kilobytes
// for the largest queue anyone arms. Anything past 64 KB is not something this
// wrote, and reading it whole on the paths readGoal runs on is cost with nothing
// to gain.
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

// What is at the goal-state path: 'file', 'oversized' (a regular file past the
// bound every reader of it enforces), 'other' (something that is not a regular
// file), 'unresolvable' (a path that can never resolve to a file), 'unreadable'
// (a kind that could not be read at all) or 'absent'. The kind rule every reader
// of that file applies, plus the size cap they apply with it, asked here because
// it is the one question readGoal above cannot answer: readGoal returns null for
// a state file that is not there and for one that is there and could not be read
// alike, and a surface that tells an operator no goal is armed on the second of
// those is guessing rather than reading.
//
// Every surface that needs the distinction takes it from here. The CLI turns
// each non-file kind into its own sentence, so the two places it would otherwise
// print plain absence do not say "nothing armed" about a path with something
// sitting at it that a later arm will fail on with a raw errno; goalStateAbsent
// below is the boolean face, for the surfaces that only choose between speaking
// and staying silent.
//
// The errno split is pathErrnoClass's, the rule every caller of this question in
// the kit answers to. 'unresolvable' is what its 'determinate' leg produces, and
// that leg holds three codes: ENOTDIR, a regular file standing where a parent
// directory belongs; ELOOP, a link cycle above the final component; and
// ENAMETOOLONG.
//
// A regular file standing where the .kit directory belongs therefore reads two
// ways, by platform, and both readings are the platform's own. On POSIX the
// lstat through that file answers ENOTDIR, so the kind is 'unresolvable',
// goalStateAbsent is false, and every surface gated on it stays silent. On win32
// the same lstat answers ENOENT, so the kind is 'absent' and the state reads as
// plain absence. The win32 residual is loud rather than silent: the write an arm
// would then attempt fails on its own mkdir, so what the operator meets there is
// an arm that errors, never a surface claiming an arm landed.
//
// Never throws.
function goalPathKind(cwd) {
    let st;
    try {
        st = fs.lstatSync(goalPath(cwd));
    } catch (err) {
        const cls = pathErrnoClass(err && err.code);
        if (cls === 'absent') return 'absent';
        return cls === 'determinate' ? 'unresolvable' : 'unreadable';
    }
    if (!st.isFile()) return 'other';
    return st.size > GOAL_STATE_MAX_BYTES ? 'oversized' : 'file';
}

// Whether nothing at all is at the goal-state path: the boolean face of
// goalPathKind, true for its 'absent' answer alone. Every other kind, a file of
// any kind, an oversized one and one whose kind could not be read included, is
// false, so a surface gated on this one stays silent wherever its reading is
// uncertain. Never throws.
function goalStateAbsent(cwd) {
    return goalPathKind(cwd) === 'absent';
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
// the queue finishes: boundSession and boundTranscript from a bind,
// blockedAdvanceKey from a blocked advance, and executionTree from a chapter
// boundary opened in a linked worktree (recordExecutionTree), with their keys,
// quoting and indentation. Reserved once rather than per plan: each is a
// single field that is overwritten, never appended to (executionTree is also
// deleted by every advance, but between boundaries it stands in the state
// every later write is measured against, so it takes the same reservation).
// It is unconditional headroom rather than a per-field derivation, because an
// arm that binds its own session writes boundSession and boundTranscript at
// arm time, so those two are already inside the serialized state this budget
// is measured against and the reservation is then simply spare.
//
// Every term is in BYTES, and the caps the writers enforce are in UTF-16 CODE
// UNITS: bindSession caps sessionId at 128 units, validTranscript caps a
// transcript path at 512, and validExecutionTree caps the tree path at the
// 2048-unit pointer-path cap. A BMP code unit is up to 3 UTF-8 bytes (a
// surrogate pair is 2 units for 4 bytes, so 3 per unit is the worst case), and
// JSON escapes a quote or a backslash to two characters, so each capped field
// is budgeted at 6 bytes per code unit. blockedAdvanceKey is printable ASCII
// by its own gate, so it takes 1 byte per unit doubled. That is 128 x 6 = 768,
// plus 512 x 6 = 3072, plus 2048 x 6 = 12288, plus 128 x 2 = 256, plus 320 for
// the five keys, their quoting and the indentation. blockedAdvancePlan holds
// one of the queue's own paths and is reserved beside the queue below, where
// the paths are measured.
const POST_ARM_MAX_BYTES = 16704;

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
// Returns { exists, status } where status is 'complete', 'in progress',
// 'ready', or 'unknown'. exists is false when the file cannot be opened at all.
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
    const readings = planStatusReadings(cwd, planRel);
    return { exists: readings.exists, status: readings.status };
}

// Both readings of a plan doc's Status row, from one head read:
//
//   { exists, status, terminal }
//
// status is classifyPlanStatus's loose reading, the one the leash acts on, and
// terminal is planReadsTerminal's strict frozen-contract reading, the one the
// queue-position walk acts on. The two answer different questions and are
// allowed to disagree ('Complete (archived)' is complete and not terminal),
// which is exactly why a surface rendering both must take them from one call
// over one set of bytes: read separately, a screen can print a position walked
// under one rule beside a per-entry token classified under the other, with no
// way for its reader to tell which sentence used which. Never throws.
function planStatusReadings(cwd, planRel) {
    const head = planHeadText(cwd, planRel);
    if (!head.exists || head.text === null) {
        return { exists: head.exists, status: 'unknown', terminal: false };
    }
    return { exists: true, status: classifyPlanStatus(head.text), terminal: planReadsTerminal(head.text) };
}

// How much of a plan doc any header question here reads. A plan's header rows
// sit at the top by the machine contract the curating-docs skill freezes, so a
// fixed head answers every one of them, and the bound is what keeps a plan doc
// from ever being pulled into memory whole on a path the Stop hook crosses
// while holding a stop.
const PLAN_HEAD_MAX_BYTES = 2048;

// The head bytes of a plan doc at a repo-relative path, decoded and with a
// leading UTF-8 BOM stripped (PowerShell Set-Content writes one, and every
// header anchor below is line-start anchored, so an unstripped BOM would hide
// the first row). One read site for every question asked of a plan doc's Status
// row, so two readings of that row cannot disagree about which bytes they were
// asked of. It is not the file's only read of a plan doc: planAuthorization
// takes a far wider window for a different question, and states its own bound.
//
// { exists, text }, and the pair carries three outcomes rather than two, which
// is the distinction callers act on: exists false is a path that is not a
// readable plan doc at all (planFileSize's kind rule, or an open that failed),
// while exists true with a null text is a plan doc whose read failed after the
// open, which says nothing about the plan and must not read as an answer about
// its header. Never throws.
function planHeadText(cwd, planRel) {
    const full = path.join(cwd, planRel);
    // The path must read as a plan doc before it is opened, judged by
    // planFileSize's kind rule, because the plan path arrives from the
    // goal-state file: a FIFO at a well-formed in-repo plan path passes every
    // other check and would block a POSIX open until a writer appears.
    if (planFileSize(cwd, planRel) === null) {
        return { exists: false, text: null };
    }
    let fd;
    try {
        fd = fs.openSync(full, 'r');
    } catch {
        return { exists: false, text: null };
    }
    try {
        const buf = Buffer.alloc(PLAN_HEAD_MAX_BYTES);
        const bytes = fs.readSync(fd, buf, 0, PLAN_HEAD_MAX_BYTES, 0);
        let head = buf.toString('utf8', 0, bytes);
        if (head.charCodeAt(0) === 0xFEFF) head = head.slice(1);
        return { exists: true, text: head };
    } catch {
        return { exists: true, text: null };
    } finally {
        try { fs.closeSync(fd); } catch { /* already closed or invalid */ }
    }
}

// The Stop hook's reading of a plan doc's Status header: 'complete', 'in
// progress', 'ready', or 'unknown'. Deliberately looser than the frozen machine
// contract planReadsTerminal below answers to, and the two are separate
// because they decide different things. This one decides whether a leash
// releases or advances, where a header carrying trailing text after Complete
// ("Complete (archived)") is a plan whose author called it finished, and
// holding every stop of a finished run over the parenthetical is the more
// expensive error. planReadsTerminal decides whether a queue entry a reporting
// surface is standing on may be counted as finished on the filesystem's
// evidence alone, with no author in the loop, so it takes the strict contract:
// the position walk evaluates the entry at the stored index FIRST and then
// everything forward of it, so the strict rule governs the current plan and its
// successors rather than anything already behind the leash.
//
// The consequence of the two rules meeting on one plan is worth naming, because
// it is a state an operator will see: a current plan whose header reads
// 'Status: Complete (archived)' is finished to the leash, which advances or
// releases on it, and unfinished to both reporting surfaces, which keep
// reporting it as the current position until the stop that moves the index.
function classifyPlanStatus(head) {
    // A non-string head has no header to classify, the same guard the strict
    // twin below takes. Every caller today reads through planHeadText and
    // checks for text first, so this is the shape of the contract rather than
    // a live path.
    if (typeof head !== 'string') return 'unknown';
    // Classify from the Status header only: anchored to a line start (m flag)
    // so body prose cannot match, and the value must sit on the same line as
    // the header ([^\S\r\n]* is horizontal whitespace only, never a newline),
    // so a bare "Status:" line above a line beginning "Complete" or "in
    // progress" does not misclassify the plan. A leading UTF-8 BOM (PowerShell
    // Set-Content writes one) is stripped by the reader so the anchor sees the
    // header. The Status header sits on its own line near the top by convention.
    //
    // Ready is the value of a plan that is authored and deliberately parked
    // before any run starts. It is a value of its own rather than an
    // unrecognized one so a reporting surface can list such a plan as parked
    // instead of not listing it at all, which is what hides finished, ready
    // work from every recovery surface. It ranks below the two started
    // readings: a doc carrying Ready alongside In Progress or Complete is one
    // somebody began, and reporting a run in flight as parked is the more
    // expensive error.
    //
    // Ready is the one leg that does not take its siblings' bare prefix match.
    // It must be the whole value, optionally followed by a parenthetical
    // ("Ready (parked pending the design round)"), because unlike Complete and
    // In Progress this word has ordinary English continuations that reverse
    // what it claims: "Ready for review", "Ready to merge" and "Ready to
    // archive" all name work somebody already did, and classifying them as
    // parked would have every reporting surface assert of them that the plan
    // is written and not started. Those fall through to 'unknown', the same
    // answer any other unrecognized value gets.
    const inProgress = /^status:[^\S\r\n]*in[^\S\r\n]*progress/im.test(head);
    const complete = /^status:[^\S\r\n]*complete/im.test(head) && !inProgress;
    const ready = /^status:[^\S\r\n]*ready[^\S\r\n]*(?:\([^)\r\n]*\)[^\S\r\n]*)?\r?$/im.test(head);
    if (complete) return 'complete';
    if (inProgress) return 'in progress';
    if (ready) return 'ready';
    return 'unknown';
}

// The directory a plan is armed from, and the one a close-out files it under.
// The move between them is the second of the two pieces of evidence a queue
// entry can be read as finished on; the first is the entry's own Status row.
const PLANS_DIR = 'docs/plans/';
const ARCHIVE_DIR = 'docs/archive/';

// Where a queued plan path's doc lands when a close-out files it, or null when
// there is no archive location to ask about. A goal may be armed over any
// in-repo path, and an entry outside docs/plans/ has no archived counterpart:
// such an entry carries no archived evidence, so it is reported at its position
// rather than counted finished behind the reader's back.
//
// The derived path is round-tripped through normalizePlanArg before it is
// returned, the same guard every reader of a stored plan path applies, so this
// function is safe on its own terms whatever calls it. The slice alone is a
// text operation over a value that reached the caller from a JSON file: an
// entry spelled docs/plans/../../../evil.md passes the bare prefix test and
// would yield an archive target outside the repository, which the callers would
// then stat and open. Containment is this function's own to prove rather than
// its callers' to promise.
function archivePathFor(cwd, planRel) {
    if (typeof planRel !== 'string' || !planRel.startsWith(PLANS_DIR)) return null;
    const tail = planRel.slice(PLANS_DIR.length);
    if (tail === '') return null;
    const filed = ARCHIVE_DIR + tail;
    return normalizePlanArg(cwd, filed) === filed ? filed : null;
}

// Whether a plan doc's head reads terminal under the machine contract the
// curating-docs skill freezes: the first Status row above the first '##'
// heading is the one read, and its value must be exactly Complete as a whole
// string, case-insensitively. 'Complete (archived)' does not terminate, in the
// contract's own words, because trailing text makes a different claim (where
// the doc has been filed) from the one being read here (that the work is
// finished).
//
// Three legs sit beyond the value compare, each closing a way this could
// answer yes on something that is not the header. Only the text above the
// first '##' heading is searched, so a Status row quoted inside a Chapter
// cannot answer for the document. The FIRST such row wins, so a later one
// cannot override the header. And the row must be terminated by a newline
// inside the head window, so a header pushed to the window's own bound never
// reads terminal on a value the window cut in half.
function planReadsTerminal(head) {
    if (typeof head !== 'string') return false;
    const heading = /^##/m.exec(head);
    const front = heading ? head.slice(0, heading.index) : head;
    const row = /^status:([^\r\n]*)\r?\n/im.exec(front);
    return row !== null && row[1].trim().toLowerCase() === 'complete';
}

// Note a path a position walk is about to read, on the walk's own record of
// what it consulted, when a caller asked for that record.
//
// The record exists for a caller that caches a render keyed on ONE plan doc
// and must know whether the position in it came from anywhere else: the walk
// crosses two trees for a worktree session, falls through to a plan's archived
// copy, and advances through finished entries, and none of those other files
// is in such a key. Reported rather than re-derived, because a caller that
// re-derived it would be spelling this file's branch rules a second time and
// the two spellings would part at the next input this walk learns to read.
//
// A pair is recorded where the read happens rather than where a branch is
// chosen, so a path a branch considered and never opened is not in the record.
// The list is bounded by the walk itself: each scanned queue entry reads at
// most two paths, the plans path and the archived copy, in at most two trees,
// so QUEUE_POSITION_MAX_SCAN x 2 x 2 pairs. It is one pair long for the
// healthy single-tree case that dominates.
function recordConsulted(consulted, root, rel) {
    if (Array.isArray(consulted)) consulted.push({ root, rel });
}

// What one checkout's filesystem says about a queued plan entry:
//
//   'complete'  the doc's own header reads terminal, or the doc has moved to
//               docs/archive/ with nothing left at the plans path AND the
//               archived copy's own header reads terminal too
//   'live'      a readable plan doc stands at the plans path and does not read
//               terminal
//   'absent'    neither path holds anything
//   'unknown'   something this tree cannot settle right now stands at one of
//               the paths: a kind that is not a plan doc, or a stat refused by
//               a lock, a permission or a scanner
//
// The fourth state is the one worth spelling out, because collapsing it into
// 'absent' is how a transient errno becomes a claim that a plan was archived.
// It is evidence of neither finished nor missing, so every caller here reads
// it as an entry that is present and unfinished, the direction that
// under-reports progress rather than reporting past live work. Never throws.
//
// consulted is the optional record every path this reading actually opened is
// noted in (recordConsulted states what it is for). It is written to rather
// than returned because the paths are read at two depths here, the plans path
// and the archived copy, and a caller that had to infer which of them ran
// would be re-deriving this function's own branches.
function treeEntryState(root, planRel, consulted) {
    try {
        recordConsulted(consulted, root, planRel);
        const head = planHeadText(root, planRel);
        if (head.exists) {
            if (head.text === null) return 'unknown';
            return planReadsTerminal(head.text) ? 'complete' : 'live';
        }
        // planHeadText refuses on the kind rule as well as on absence, so the
        // cases are parted by planPathState, the classification every reader of
        // a plan path here answers to.
        if (planPathState(root, planRel) !== 'gone') return 'unknown';
        const filed = archivePathFor(root, planRel);
        if (filed === null) return 'absent';
        recordConsulted(consulted, root, filed);
        // planFileSize answers 0 for an absent path and null for one that
        // cannot be read as a plan doc. A zero-byte file standing at the
        // archive path answers 0 too and so reads as absent: it is
        // indistinguishable from nothing here, and an empty file is no record
        // of a finished plan anyway.
        const size = planFileSize(root, filed);
        if (size === null) return 'unknown';
        if (size === 0) return 'absent';
        // The archived copy is HELD TO THE SAME BAR as a doc still in
        // docs/plans/: its header must read terminal. Presence alone is not
        // evidence, because the two paths carry the same name and nothing ties
        // the file under docs/archive/ to this plan beyond that name. A plan doc
        // DELETED rather than filed, with a same-named doc from an earlier
        // effort already in the archive, would otherwise read finished in every
        // tree and move the reported position past live work in silence, which
        // is the one outcome this function's agreement rule exists to prevent.
        const filedHead = planHeadText(root, filed);
        if (!filedHead.exists || filedHead.text === null) return 'unknown';
        // Present and not terminal is the same answer a live doc at the plans
        // path gives: something stands for this entry and it does not read
        // finished, so the walk stops on it rather than counting it either way.
        return planReadsTerminal(filedHead.text) ? 'complete' : 'live';
    } catch {
        return 'unknown';
    }
}

// Whether a queue entry is finished, asked of every tree that has a say, as
// { state, cause }. state is 'complete', 'pending', or 'unresolvable' (nothing
// can be read about the entry at all), and cause names WHY an unresolvable one
// is unresolvable, so a reporting surface can say something true about it:
//
//   'unreadable-path'  the entry does not round-trip the plan-path normalizer,
//                      so no reader here will resolve it against any tree
//   'unarchivable'     the entry is not armed from docs/plans/, so its own path
//                      is the only place it could be, and nothing is there
//   'neither'          its doc is in neither docs/plans/ nor docs/archive/ of
//                      any tree
//
// cause is null for the two resolvable states. Naming it here rather than at
// each surface is what keeps a message from describing the wrong directories:
// the sentence "in neither docs/plans/ nor docs/archive/" is false of an entry
// that was never armed from either.
//
// The entry is re-validated against the normalizer before any tree is asked,
// the same round-trip readGoal applies, kept here so this function is safe on
// its own terms whatever calls it: the entries arrive from a JSON file, and a
// caller that passed a raw state rather than a normalized one would otherwise
// have this walk stat and open paths outside the repository.
//
// A worktree session reads goal state from the main checkout while plan docs
// resolve against its own cwd, so the two trees can genuinely disagree about
// whether an entry's doc exists or reads terminal: a plan finished on a branch
// is Complete in the worktree and In Progress on main until the merge lands.
// An entry counts as finished only where every tree agrees, and a disagreement
// reports it pending. That asymmetry is deliberate and matches the one the
// Stop hook's 'gone' branch already takes: a wrongly-finished entry moves the
// reported position PAST live work, silently, while a wrongly-unfinished one
// only under-reports progress, where an operator can see it. Unresolvable
// takes the same agreement rule, so an entry standing in either tree is
// reported from that tree rather than as missing. Never throws.
//
// consulted is the walk's optional record of the paths actually read, passed
// through to the per-tree readings that do the reading. The early return above
// it opens nothing and so records nothing.
function queueEntryState(cwd, planRel, consulted) {
    if (normalizePlanArg(cwd, planRel) !== planRel) {
        return { state: 'unresolvable', cause: 'unreadable-path' };
    }
    const root = goalRoot(cwd);
    const here = treeEntryState(cwd, planRel, consulted);
    const votes = root === cwd ? [here] : [here, treeEntryState(root, planRel, consulted)];
    if (votes.every((v) => v === 'complete')) return { state: 'complete', cause: null };
    if (votes.every((v) => v === 'absent')) {
        return {
            state: 'unresolvable',
            cause: archivePathFor(cwd, planRel) === null ? 'unarchivable' : 'neither'
        };
    }
    return { state: 'pending', cause: null };
}

// How many queue entries a position walk will settle before it stops asking.
// Each entry costs a file open or two, on paths that run at every session start
// and at every status report, so the walk is bounded rather than proportional
// to a queue an operator may have armed dozens of plans into.
//
// A walk that exhausts the bound has read every one of those entries as
// finished and reports the NEXT one, which it never evaluated. That is the
// conservative end of the evidence rather than a claim about the entry: naming
// the last entry it did read would report a plan it just established is
// finished. Nothing was read about the reported entry either way, so such a
// walk reports no unresolvable label and no finished flag, and the position it
// gives is the earliest one the evidence leaves open.
const QUEUE_POSITION_MAX_SCAN = 16;

// The queue position a reporting surface shows: the first entry from the
// stored index onward that the plan docs themselves do not report as finished.
//
// The stored index only ever moves at a clean stop of the bound session (the
// Stop hook is advanceGoal's one caller), so a run that dies at its close-out,
// or one whose bound session never stops again, leaves the index frozen on a
// plan that is finished and archived, with no path in the system that repairs
// it. Every surface that reported the stored index at face value then told the
// operator, and the next session, that the run sits on a plan it finished
// yesterday. So position is READ from the world here rather than trusted from
// the file.
//
// The walk only ever moves FORWARD from the stored index, and that is a rule
// rather than an implementation detail: an entry behind the stored position
// may be unfinished for a reason the leash already adjudicated (a blocked
// advance moves past a plan that never went Complete), and reporting a
// position behind the leash's own would re-open work the operator decided to
// leave. Reading forward can only ever agree with the leash or catch it up.
//
// Returns { index, stored, healed, positional, unresolvable, cause, finished,
// consulted }:
//
//   index         the position to report
//   stored        the stored index the walk started from, clamped into the
//                 queue, which a surface names beside a corrected position so
//                 the gap between the two is visible rather than papered over
//   healed        how many finished entries the walk moved past (0 on every
//                 healthy state, where the first entry read is the current plan
//                 and it is not finished)
//   positional    whether this queue holds more than one plan, and so whether a
//                 claim ABOUT a position among several says anything at all.
//                 Spelled once here rather than at each surface, because two
//                 surfaces that answered it differently would report the same
//                 queue of one two different ways
//   unresolvable  whether the entry AT the reported position is one no tree can
//                 resolve
//   cause         queueEntryState's cause for that unresolvable entry, or null
//   finished      whether the entry AT the reported position itself reads
//                 finished, which is the whole-queue-finished state: the walk
//                 pins at the last entry and the leash RELEASES at the bound
//                 session's next stop rather than advancing, so a surface that
//                 reported the position alone would describe work remaining
//                 where none does
//   consulted     every { root, rel } pair this walk actually read, in the
//                 order it read them, so a surface caching a render keyed on
//                 one plan doc can tell whether the position in it came from
//                 anywhere else (recordConsulted states the whole rule and the
//                 bound). A walk that threw keeps the pairs it had already
//                 read, since it did read them
//
// An unresolvable entry stops the walk and keeps its position, never being
// skipped: skipping it would renumber the queue around a plan whose absence is
// the very thing the operator needs told. Nothing here writes: this reports the
// truth over a stale file rather than repairing it. Never throws.
function queuePosition(cwd, state) {
    let stored = 0;
    let index = 0;
    let entry = null;
    let positional = false;
    const consulted = [];
    try {
        if (!state || typeof state.plan !== 'string' || state.plan === '') {
            return empty();
        }
        const queue = Array.isArray(state.queue) ? state.queue : [];
        if (queue.length === 0) return empty();
        positional = queue.length > 1;
        stored = Number.isInteger(state.queueIndex) && state.queueIndex >= 0
            && state.queueIndex < queue.length ? state.queueIndex : 0;
        index = stored;
        const last = queue.length - 1;
        for (let scanned = 0; scanned < QUEUE_POSITION_MAX_SCAN; scanned++) {
            entry = queueEntryState(cwd, queue[index], consulted);
            if (entry.state !== 'complete' || index === last) break;
            index++;
            entry = null;
        }
    } catch {
        // A walk that threw has no evidence for the ground it covered, so it
        // keeps none of it: the stored index is still a position, and reporting
        // it is exactly today's behavior.
        index = stored;
        entry = null;
    }
    return {
        index,
        stored,
        healed: index - stored,
        positional,
        unresolvable: entry !== null && entry.state === 'unresolvable',
        cause: entry !== null && entry.state === 'unresolvable' ? entry.cause : null,
        finished: entry !== null && entry.state === 'complete',
        consulted
    };
}

// The answer for a state carrying no queue to have a position in. Nothing was
// read to reach it, so its record of consulted paths is empty.
function empty() {
    return {
        index: 0, stored: 0, healed: 0, positional: false,
        unresolvable: false, cause: null, finished: false, consulted: []
    };
}

// How much of a plan doc the authorization scan reads. A Dispatch Authorization
// section sits in a plan's front matter, above the sections of work, but the
// header, the goal and the approach can precede it, so the window is far wider
// than planHead's 2 KB Status window and still a fixed bound rather than the
// whole file: this read happens once per plan at arm time, and a plan doc is
// prose no reader of this file ever needs whole.
const AUTHORIZATION_SCAN_MAX_BYTES = 16 * 1024;

// The Dispatch Authorization heading, anchored to a line start so body prose
// naming the section cannot match, with the value required to be the whole line
// ([^\S\r\n] is horizontal whitespace only, never a newline).
const AUTHORIZATION_HEADING = /^##[^\S\r\n]*Dispatch Authorization[^\S\r\n]*$/im;

// The sections-of-work heading, which bounds where an authorization may be
// asserted. The section is front matter: a plan states who authorized arming it
// above the work, and a heading of this name below the sections is prose about
// the format rather than a claim. Any heading level matches, since the level a
// plan writes its sections at is a formatting choice and the ordering is the
// point.
const SECTIONS_HEADING = /^#{1,6}[^\S\r\n]*Sections of Work[^\S\r\n]*$/im;

// A heading line, as the section body's terminator. It matches exactly what
// AUTHORIZATION_HEADING matches structurally, hashes then optional horizontal
// whitespace then content, because the two answer the same question about the
// same syntax: where they disagreed about a heading written with no space after
// its hashes, the body ran on past the next heading and the FOLLOWING section's
// first sentence was recorded as this plan's authorization, a claim the plan
// never made. The content character excludes '#' so a rule line of seven or more
// hashes, which is no heading, does not read as one.
const HEADING_LINE = /^#{1,6}[^\S\r\n]*[^\s#]/m;

// An opening or closing code fence, allowing markdown's three spaces of indent.
const FENCE_LINE = /^ {0,3}(`{3,}|~{3,})/;

// The text with every fenced code block's content replaced by spaces, one
// character for one character so every offset and line break is where it was.
//
// A plan doc that ILLUSTRATES the authorization format carries the heading
// inside a fence, and a purely lexical match reads that illustration as the
// plan's own claim: the state file then records an authorization the plan never
// asserted, and every surface that prints it presents it as one. Masking rather
// than skipping keeps the rest of this function's arithmetic unchanged.
//
// A fence opened and never closed inside the scan window masks everything after
// it. That is the conservative direction: what is inside an unterminated fence
// cannot be told from what follows it, and an authorization is a claim worth
// refusing when its context is unreadable.
function maskFencedRegions(text) {
    let fence = null;
    return text.split('\n').map((line) => {
        const open = FENCE_LINE.exec(line);
        if (fence === null) {
            if (open === null) return line;
            fence = open[1];
            return ' '.repeat(line.length);
        }
        if (open !== null && open[1][0] === fence[0] && open[1].length >= fence.length) fence = null;
        return ' '.repeat(line.length);
    }).join('\n');
}

// The first sentence of a plan doc's Dispatch Authorization section, screened
// for storage, or null when the plan carries no such section or nothing
// printable under it.
//
// The sentence is the plan's own claim about who authorized arming it, and it is
// stored as provenance rather than as a credential: nothing here authenticates
// the writer, and the file's content is taken at its word for the audit trail
// the status report and the doctor surface. Git history is what makes the claim
// traceable.
//
// The heading is matched structurally rather than lexically: it must sit outside
// every fenced code block (see maskFencedRegions) and above the plan's sections
// of work. Both conditions exist for one reason: a plan doc that shows what the
// section looks like, in a fence or in a section about the format, asserts
// nothing, and recording its example would put a grant in the state file that no
// plan ever made.
//
// The section body runs to the next heading of any level, its first sentence
// ends at the first period, question mark or exclamation mark followed by
// whitespace or the end of the body, and the whitespace inside it is flattened,
// because the stored value is a single line in a file whose readers print it.
// Every scan is a bounded search or a literal replace rather than a pattern
// spanning the untrusted text, so a plan doc cannot cost this more than its own
// length. The masked text is what every search runs against, including the
// sentence itself, so a section whose body is only a fence reads as nothing
// printable under the heading rather than as a quoted code block.
//
// truncated says whether text is a cut head of the plan doc rather than the
// whole of it, which its caller knows and this function cannot see. It answers
// one question: whether the end of the body in hand is the end the plan wrote.
// Three things have to hold at once for the answer to be no. The text is cut, no
// heading follows the section inside it, and the body carries no sentence
// terminator, which together say the body ran to the window's edge and its end
// is simply unseen. Such a body is a fragment, and recording it would store part
// of a sentence as the plan's whole claim, exactly what the storage cap's own
// mark exists to prevent one step later, so it records nothing.
//
// A following heading is what settles the ordinary case, because it is the
// evidence that the section ended inside the window: the body is bounded by
// something the scan actually saw, so it is whole whatever its punctuation, and
// a terminator-less line there is the section's own claim rather than a cut one.
// A plan doc past the scan window is otherwise ordinary, and refusing every
// terminator-less section in one would drop grants those plans really made. The
// same reasoning covers a plan doc read whole, where nothing was cut at all.
//
// safeForAuthorization is what screens it: the same printable-ASCII rule every
// other caller-supplied string stored in this file answers to, at its own cap,
// which that constant states its reason for. It is the stricter of the two
// screens in the kit (the status line's terminal sanitizer admits ordinary
// non-ASCII text, which a name shown to a person needs and a quoted sentence
// entering a model's context does not), and the strictness is what this value
// earns: it is untrusted file content on its way into a state file several
// surfaces print.
function authorizationSentence(text, truncated) {
    const scanned = maskFencedRegions(text);
    const heading = AUTHORIZATION_HEADING.exec(scanned);
    if (heading === null) return null;
    const sections = SECTIONS_HEADING.exec(scanned);
    if (sections !== null && sections.index < heading.index) return null;
    let body = scanned.slice(heading.index + heading[0].length);
    const next = body.search(HEADING_LINE);
    if (next !== -1) body = body.slice(0, next);
    body = body.replace(/^\s+/, '');
    if (body === '') return null;
    const stop = body.search(/[.!?](\s|$)/);
    if (stop === -1 && next === -1 && truncated) return null;
    const sentence = (stop === -1 ? body : body.slice(0, stop + 1)).replace(/\s+/g, ' ').trim();
    const safe = safeForAuthorization(sentence);
    return safe === '' ? null : safe;
}

// The authorization provenance recorded for a plan at the moment it is queued,
// or null when the plan records none. Every failure to read the plan answers
// null too: the field is an audit trail, and a plan that could not be read for
// it has recorded no authorization, which is exactly what null says. The arm
// itself is refused elsewhere over an unreadable plan, so a null here never
// stands in for a plan the caller was told was fine.
//
// The open is guarded by planFileSize's kind rule, as every read of a plan path
// in this file is, so a FIFO or a link out of the repo at a queued plan path is
// refused before any open. The read is spelled here rather than shared with
// planHead because the two answer differently to a read that fails: planHead
// reports the file present with an unknown status, where an unread section is
// simply no authorization.
function planAuthorization(cwd, planRel) {
    if (planFileSize(cwd, planRel) === null) return null;
    let fd;
    try {
        fd = fs.openSync(path.join(cwd, planRel), 'r');
    } catch {
        return null;
    }
    try {
        const buf = Buffer.alloc(AUTHORIZATION_SCAN_MAX_BYTES);
        const bytes = fs.readSync(fd, buf, 0, AUTHORIZATION_SCAN_MAX_BYTES, 0);
        let head = buf.toString('utf8', 0, bytes);
        if (head.charCodeAt(0) === 0xFEFF) head = head.slice(1);
        // A read that filled the buffer is a plan doc with more of itself past
        // the window, so what the scan holds may end mid-sentence. This is the
        // only place that fact is known, and authorizationSentence needs it to
        // tell a section's own short line from a sentence cut by the window.
        return authorizationSentence(head, bytes === AUTHORIZATION_SCAN_MAX_BYTES);
    } catch {
        return null;
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

// The room an authorization sentence gets, which is deliberately not
// safeForReason's. That cap is sized for a path named inside an error line,
// where 120 characters is generous; an authorization sentence is prose written
// to be read, and the sentences plans actually carry run past 120 (the first
// plan to carry one records 268 characters, quoting the operator's own words).
// A sentence cut mid-clause is worse than none, because it reads as whole: the
// value's entire job is to let a reader judge a claim about who authorized
// arming, and half a claim cannot be judged. 320 leaves headroom above the
// observed length without inviting a paragraph.
//
// Nothing else changes: the printable-ASCII rule is the same one, and this is
// still the stricter of the kit's two screens, since the status line's terminal
// sanitizer admits ordinary non-ASCII where a quoted sentence entering a
// model's context does not. The cap is what differs, because the two values
// differ.
const AUTHORIZATION_MAX_CHARS = 320;

// What a value cut by the cap ends in, so a reader sees the cut. A sentence
// stopped at the cap and stored bare reads as the whole claim, which is the
// failure the cap's own derivation names one line up: a claim that is judged
// whole and is not is worse than none at all.
//
// The mark is written INSIDE the cap, replacing the last of the content rather
// than being added past it, so a marked value measures exactly
// AUTHORIZATION_MAX_CHARS. That is what keeps the screen idempotent, which it
// has to be: normalizeAuthorizations re-applies it to the stored value on every
// read of the state file, and a mark the next read cut off would turn a marked
// truncation back into a silent one.
const AUTHORIZATION_TRUNCATION_MARK = ' ...[truncated]';

function safeForAuthorization(value) {
    const printable = String(value).replace(/[^\x20-\x7E]/g, '');
    if (printable.length <= AUTHORIZATION_MAX_CHARS) return printable;
    return printable.slice(0, AUTHORIZATION_MAX_CHARS - AUTHORIZATION_TRUNCATION_MARK.length)
        + AUTHORIZATION_TRUNCATION_MARK;
}

// The key two plan paths are compared as for the purpose of deciding whether a
// queue already holds one. Case-folded on Windows, where the filesystem is
// case-insensitive and two casings of one path name one file: a queue holding
// both would advance past the plan once and stall on the repeat, which is the
// shape both duplicate refusals exist to stop. One definition, so an arm and an
// append cannot disagree about what a duplicate is.
function queueKey(rel) {
    return process.platform === 'win32' ? rel.toLowerCase() : rel;
}

// One plan argument validated for a queue, as { ok:true, rel } or
// { ok:false, reason }. Shared by arming and appending, so a path that cannot
// enter a queue one way cannot enter it the other: the containment rule, the
// three unreadable states parted by planPathState, and the refusal of a plan
// already Complete are one rule at one site.
function validatePlanArg(cwd, arg) {
    const rel = normalizePlanArg(cwd, arg);
    if (rel === null) {
        return { ok: false, reason: 'plan path is invalid or outside the repo: ' + safeForReason(arg) };
    }
    const head = planHead(cwd, rel);
    if (!head.exists) {
        // planHead answers the same 'no' for three states an operator would act
        // on differently: nothing is at the path, something that is not a plan
        // doc is at it, or the path is there and could not be read right now (a
        // scanner or an indexer holding it, which lifts on its own).
        // planPathState parts them by the shared rule, and these are its three
        // wordings: reporting a locked plan doc as one that does not hold a plan
        // file sends the operator to fix a file that is fine, and reporting a
        // path that can never resolve as one to retry names a condition no
        // amount of waiting resolves.
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
    return { ok: true, rel };
}

// Whether a queue's own progress fits the writer's bound, judged on the state
// about to be written plus room for every record that queue can still produce.
//
// Each advance appends a history record while the condition's remaining tail
// sheds one path, a net growth, so a queue that fits exactly today crosses the
// bound on an advance: writeState would then refuse deterministically, the Stop
// hook would block at every stop reporting that the advance could not be
// recorded, and the run could neither advance nor release without a manual
// clear. That failure is permanent rather than degrading, so the room is
// reserved at the one moment a person is present to read the refusal, which is
// the arm or the append that grows the queue.
//
// Every term is counted in BYTES, the unit the budget is in: a path is measured
// with Buffer.byteLength and doubled, because JSON escapes a quote or a
// backslash in a filename to two bytes each, and the same doubling is already
// inside HISTORY_RECORD_MAX_BYTES for the note. The fields a bind or a blocked
// advance add after the arm are reserved once in POST_ARM_MAX_BYTES, which
// states its own derivation; the one such field that carries a plan path,
// blockedAdvancePlan, is reserved here instead, against the longest path in the
// queue, because that is where the paths are measured.
//
// The reservation runs where a queue grows, so a queue armed before it existed
// carries none: such a state reads back fine under the cap and can still meet
// writeState's refusal on a later advance. That takes a standing queue in the
// low hundreds of plans, a bound rather than a figure because the count follows
// the plan paths' own lengths and the blockers the advances record. Such a state
// predates the authorization map too, so it reads back with an empty one and its
// growth is the history records alone; a state arming a queue today carries a
// recorded sentence per plan, which queueFits measures as part of the serialized
// state below. The recovery is /kit-goal clear followed by a fresh arm, which the
// refusal's own wording points at.
function queueFits(state) {
    let reserved = POST_ARM_MAX_BYTES;
    let longest = 0;
    for (const rel of state.queue) {
        const bytes = Buffer.byteLength(rel, 'utf8');
        reserved += 2 * bytes + HISTORY_RECORD_MAX_BYTES;
        if (bytes > longest) longest = bytes;
    }
    reserved += 2 * longest;
    return Buffer.byteLength(JSON.stringify(state, null, 2) + '\n', 'utf8') + reserved <= GOAL_STATE_MAX_BYTES;
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
//
// dropped rides on the success result: the plans a previously armed queue still
// had ahead of it that this queue does not name, which the caller warns about.
// Arming replaces the queue rather than growing it, and appendGoal below is the
// spelling that grows one.
function armGoal(cwd, planArgs, bind) {
    const args = Array.isArray(planArgs) ? planArgs : [planArgs];
    if (args.length === 0) {
        return { ok: false, reason: 'no plan path given' };
    }

    const queue = [];
    const seen = new Set();
    // No prototype, for the reason normalizeAuthorizations states: the keys are
    // plan paths, and a repository is free to hold a plan named after one of
    // Object.prototype's own members. Assigning '__proto__' on a plain object
    // invokes the prototype setter rather than recording a key, so the entry for
    // such a plan would simply never be written.
    const authorizations = Object.create(null);
    for (const arg of args) {
        const checked = validatePlanArg(cwd, arg);
        if (!checked.ok) return checked;
        const rel = checked.rel;
        if (seen.has(queueKey(rel))) {
            return { ok: false, reason: 'plan appears twice in the queue: ' + rel };
        }
        seen.add(queueKey(rel));
        authorizations[rel] = planAuthorization(cwd, rel);
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
        history: [],
        // What each queued plan doc says about who authorized arming it: the
        // first sentence of its Dispatch Authorization section, or null where it
        // carries none. Derived from the artifact at the moment the plan is
        // queued, never asserted by the caller, and asserted rather than
        // authenticated: it is the provenance trail a status report or the
        // doctor can surface, and it grants nothing.
        authorizations
    };
    // What the literal above deliberately omits: executionTree. An arm
    // replaces whatever state stood before, so a tree recorded for a previous
    // goal dies with the replace by construction, and only the checkpoint CLI
    // (recordExecutionTree) can put one back, at a chapter boundary of the
    // goal armed here.

    // Refuse a queue whose own progress would grow the state past the writer's
    // bound. queueFits states the whole derivation.
    if (!queueFits(state)) {
        return {
            ok: false,
            reason: 'the armed queue is too long: ' + queue.length + ' plans and the records their '
                + 'advances would add do not fit the goal state file. Arm fewer plans, and queue the rest '
                + 'when they come up.'
        };
    }

    // What this arm takes off the leash: the plans still ahead of the current
    // position in whatever was armed before, minus the ones this queue names
    // again. Arming replaces the queue outright, which is the compatible
    // behavior and stays so, and the one thing standing between an operator and
    // a plan that quietly stopped being armed is the caller naming these. Plans
    // behind the current position are not dropped: the leash finished them.
    const dropped = [];
    const prior = readGoal(cwd);
    if (prior && typeof prior.plan === 'string' && prior.plan !== '') {
        const kept = new Set(queue.map(queueKey));
        for (const rel of prior.queue.slice(prior.queueIndex)) {
            if (!kept.has(queueKey(rel))) dropped.push(rel);
        }
    }

    const written = writeState(cwd, state);
    if (!written.ok) return written;

    return { ok: true, plan: queue[0], queue, boundSession, dropped };
}

// Append plans to the armed queue under the binding it already carries, in one
// atomic rewrite: the new paths land at the end of the queue, the current plan
// and queueIndex do not move, the condition is recomposed so it names what is
// now still to come, and boundSession, boundTranscript, armedAt and the history
// are preserved untouched.
//
// Preserving armedAt is load-bearing rather than tidy: it is half of
// advanceGoal's compare-and-swap, so an append that refreshed it would make
// every advance decided from a snapshot older than the append refuse, and a run
// whose queue grew mid-flight would stop advancing. Preserving the binding is
// the other half of the point: a plan handed to a running session is appended
// from whatever shell is at hand, and re-deriving the binding there would move
// the leash to that shell.
//
// Every path is validated exactly as arming validates it, and a duplicate is
// refused for the reason arming refuses one: a queue that visits a plan twice
// would advance past it the first time and stall the second. A path already
// anywhere in the queue counts, the finished positions included, and so does a
// repeat among the appended paths themselves. Any failure refuses the whole
// invocation before anything is written, so a partial append cannot reach the
// state file.
//
// The write is guarded by a compare-and-swap against the state this call decided
// from, in the spirit of the one advanceGoal takes from its caller. This is a
// read-modify-write over a file another process writes: an append is typed into
// whatever shell is at hand while the leashed session runs, and its validation
// opens a plan doc per path, so a Stop hook's advance or bind has a real window
// to land in between. Written blind, the append would put its own pre-advance
// snapshot back: queueIndex and plan would walk back to the finished plan and
// the advance's history record would be gone, with the run then working a plan
// it already closed. So the state is re-read immediately before the write and
// the append is refused unless the progress markers it read are still the ones
// on disk. armedAt alone would not do it, because an advance preserves armedAt
// by design (it is half of advanceGoal's own guard); the position, the current
// plan, the queue length and the history length are what an advance moves.
//
// What is written is that re-read state with the append applied to it, never the
// snapshot the validation ran against. The compare answers for the fields it
// names and for nothing else, and a state carries fields an append has no
// opinion about: a stop claiming an unbound leash writes boundSession and
// boundTranscript, and a blocked advance writes the blockedAdvance pair. Writing
// the snapshot back would revert every one of them, for the whole width of the
// call rather than for the narrow window below, and an unbound leash is how a
// bystander session comes to claim a goal already being worked. Rebasing keeps
// them because it keeps whatever the re-read holds, a field added later
// included, where a compare widened to name them is a list that goes stale.
//
// The residual is the window between that re-read and the rename, which no
// unlocked writer here closes: a writer landing inside it still wins last, the
// same last-writer-wins posture bindSession states for its own rewrite. What the
// guard converts is the ordinary case, from a silent revert into a refusal the
// operator reads and retries.
//
// Returns { ok:true, plan, queue, appended, boundSession } on success, where
// plan is the unchanged current plan and appended is what this call added, or
// { ok:false, reason } when no goal is armed, a path fails, a duplicate is
// named, the grown queue would not fit, the state moved under the append, or
// the write fails. Never throws.
function appendGoal(cwd, planArgs) {
    const args = Array.isArray(planArgs) ? planArgs : [planArgs];
    if (args.length === 0) {
        return { ok: false, reason: 'no plan path given' };
    }
    const state = readGoal(cwd);
    if (!state || typeof state.plan !== 'string' || state.plan === '') {
        // Three readings reach this refusal and they do not call for the same
        // advice, so the path is asked about rather than assumed. readGoal
        // answers null for a state file that is absent and for one sitting there
        // unreadable alike (a lock or a scanner holding it, an oversized one, a
        // kind no reader opens, JSON that does not parse), and it answers a
        // parsed object carrying no plan for a file that is there, is JSON, and
        // is not a goal state, which normalizeState returns unchanged and which
        // may carry a queue and a history. The bare arm this reason would
        // otherwise name replaces whatever queue is on disk. Named over either
        // of the two readings where something is at the path, it would overwrite
        // a live leash, its queue, its history and its binding, with armGoal's
        // own dropped-plan warning defeated by the same file and so unable to
        // say what went.
        //
        // So the guard is the path's own emptiness rather than the shape of what
        // readGoal returned, and the pointer rides only where nothing is there
        // to lose, which is where the way forward is genuinely a first arming:
        // the state a caller that reached for --append with nothing armed is in,
        // and what rescues a session that loaded neither the kit-goal skill nor
        // the executing-work paragraph naming both spellings. Every other
        // reading takes the reason that names no command, which asserts nothing
        // about what is at the path because one of the kinds it covers,
        // 'unresolvable', is a path with nothing at it at all. Both fit inside
        // the 120-character cap the CLI sanitizes every reason to, so what an
        // operator reads on stderr is a whole clause rather than a cut one.
        if (!goalStateAbsent(cwd)) {
            return {
                ok: false,
                reason: '.kit/goal-state.json could not be read as a goal state,'
                    + ' so what is armed is unknown'
            };
        }
        return {
            ok: false,
            reason: 'no goal is armed, so there is no queue to append to;'
                + ' arm without --append is the first arming'
        };
    }

    // The progress this append was decided from, which the re-read below is
    // compared against.
    const decidedFrom = {
        armedAt: state.armedAt,
        plan: state.plan,
        queueIndex: state.queueIndex,
        queueLength: state.queue.length,
        historyLength: state.history.length
    };

    const seen = new Set(state.queue.map(queueKey));
    const appended = [];
    for (const arg of args) {
        const checked = validatePlanArg(cwd, arg);
        if (!checked.ok) return checked;
        const rel = checked.rel;
        if (seen.has(queueKey(rel))) {
            return { ok: false, reason: 'plan is already in the armed queue: ' + rel };
        }
        seen.add(queueKey(rel));
        appended.push(rel);
    }

    // Derived ahead of the re-read because deriving one opens a plan doc, and
    // the re-read's whole value is that nothing slow sits between it and the
    // write.
    const added = Object.create(null);
    for (const rel of appended) {
        added[rel] = planAuthorization(cwd, rel);
    }

    const now = readGoal(cwd);
    if (!now || now.armedAt !== decidedFrom.armedAt || now.plan !== decidedFrom.plan
        || now.queueIndex !== decidedFrom.queueIndex || now.queue.length !== decidedFrom.queueLength
        || now.history.length !== decidedFrom.historyLength) {
        return {
            ok: false,
            reason: 'goal state changed while this append was validated, so nothing was appended. '
                + 'Read the state and append again.'
        };
    }

    for (const rel of appended) {
        now.authorizations[rel] = added[rel];
    }
    now.queue = now.queue.concat(appended);
    now.condition = composeCondition(now.plan, now.queue, now.queueIndex);
    // Judged on the object that is about to be written, so the answer is about
    // the state that will exist rather than about a snapshot of it.
    if (!queueFits(now)) {
        return {
            ok: false,
            reason: 'the armed queue is too long: ' + now.queue.length + ' plans and the records their '
                + 'advances would add do not fit the goal state file. Append fewer plans, and queue the rest '
                + 'when they come up.'
        };
    }

    const written = writeState(cwd, now);
    if (!written.ok) return written;

    return { ok: true, plan: now.plan, queue: now.queue, appended, boundSession: now.boundSession };
}

// Record the current plan's outcome and move the leash to the next plan in the
// queue, in one atomic rewrite: the history entry is appended, queueIndex and
// plan move together, the condition is recomposed for the new current plan,
// and boundSession and boundTranscript are preserved, so one binding rides the
// whole queue.
//
// outcome is 'complete', 'archived', or 'blocked'; note is the optional
// recorded blocker, sanitized and capped here because it originates in
// transcript text. attributedPlan is the optional plan the history record is
// filed under, for a caller whose own reading of where the run stands differs
// from the stored pointer (the Stop hook's blocked clause reads the position
// walk and emits an event under it, and the record has to agree with that
// event); it is honored only when the armed queue holds it, and it reaches the
// history record alone, never the guards below or the position the leash
// moves to. expectedPlan and expectedArmedAt are an optional
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

    // The plan the record is filed under is attributedPlan where the caller
    // supplied one the queue actually holds, otherwise the stored pointer. The
    // two differ when the pointer lags the position the plan docs put the run
    // at, and the caller that supplies one emits an event for the same
    // incident, so this keeps the persisted record and that event naming one
    // plan. Nothing else moves: every enforcement read below, the
    // compare-and-swap above included, is the stored pointer's.
    const attributed = typeof entry.attributedPlan === 'string' && state.queue.includes(entry.attributedPlan)
        ? entry.attributedPlan
        : finished;
    const record = { plan: attributed, outcome: entry.outcome, at: new Date().toISOString() };
    if (entry.note) record.note = safeForReason(entry.note);
    state.history.push(record);
    state.queueIndex = next;
    state.plan = state.queue[next];
    state.condition = composeCondition(state.plan, state.queue, next);
    // The execution tree recorded for the finished plan (recordExecutionTree)
    // says where THAT plan's chapter boundaries were opened, which is no claim
    // about the plan the leash moves to, so it does not survive the advance: a
    // stale tree path must not outlive the plan it described, and the
    // checkpoint CLI re-records one at the new plan's first boundary if the
    // run is still in a worktree.
    delete state.executionTree;
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
// The two binding fields are set on a state re-read immediately before the
// write, never on the state the caller's decision was made from, because
// everything else in the file belongs to another writer: an append typed while
// this session runs grows the queue and the authorization map, and writing an
// older whole snapshot over it drops an armed plan with no trace that it was
// ever queued. Only the fields this function owns are set, so what the re-read
// holds is what is written for every other field. The residual is the window
// between that re-read and the rename, which the last-writer-wins posture above
// covers.
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
    // The base for the write is a second read taken here rather than the one the
    // gate above answered from, so the fields this function does not own are the
    // newest ones on disk. A goal cleared or made unreadable in between is
    // refused rather than resurrected from the older copy.
    const now = readGoal(cwd);
    if (!now || !now.plan) {
        return { ok: false, reason: 'no goal is armed' };
    }
    now.boundSession = sessionId;
    now.boundTranscript = validTranscript(transcriptPath) ? transcriptPath : null;
    const written = writeState(cwd, now);
    if (!written.ok) return written;
    return { ok: true };
}

// Record in the goal state the execution tree a chapter boundary was opened
// from, or drop the record when the boundary shows execution back in the
// checkout that holds the state. cwd is the caller's literal working
// directory; the field is written only where goalRoot resolves that directory
// to a main checkout elsewhere, and what it holds is the worktree itself.
//
// The compaction checkpoint CLI's `open` is this function's ONLY caller, and
// stays so deliberately: chapter boundaries are where a worktree run already
// calls that CLI, and one boundary-timed writer beats several racing ones.
// Every other goal-family surface only reads the field, and reads it for
// DISPLAY TRUST ONLY: it steers which copy of a plan doc a progress-rendering
// surface opens (planDisplayRoot), and nothing gate-deciding or leash-deciding
// may ever read it, because it is a hand-editable on-disk value asserting
// where work happens, not evidence that it does.
//
// Lifetime: the field dies with the state file when a clear unlinks it
// (clearGoal deletes rather than rewrites, so no drop is needed there), a
// re-arm never carries it (armGoal builds its state from nothing), and an
// advance drops it explicitly (advanceGoal), so a stale tree path cannot
// outlive the plan it described. A boundary opened from the resolved checkout
// itself drops a standing record for the same reason: the field holds the
// latest boundary's observation, and keeping an older tree past it is exactly
// the staleness the drops exist to prevent.
//
// Best-effort by design: a failed record costs a possibly stale Sections
// count on a status line, never the checkpoint that occasioned it. Returns
// { ok:true, recorded } or { ok:false, reason }; never throws. The write base
// is a re-read taken immediately before the write, as bindSession's is, so
// every field this function does not own is the newest one on disk and a goal
// cleared in between is refused rather than resurrected. The re-read is also
// compared against the first read's plan and arming timestamp, the guard
// advanceGoal takes over the same window: a Stop-hook advance or a re-arm
// landing between the reads is refused rather than having the finished
// plan's tree re-attached to the state that replaced it, which would undo
// the very delete advanceGoal performs so that a stale tree path cannot
// outlive the plan it described. The no-write early returns are judged on
// the re-read for the same reason, so a success reported here is a claim
// about the state on disk rather than about the snapshot the decision was
// made from.
function recordExecutionTree(cwd) {
    try {
        const state = readGoal(cwd);
        if (!state || typeof state.plan !== 'string' || state.plan === '') {
            return { ok: false, reason: 'no goal is armed' };
        }
        const root = goalRoot(cwd);
        const resolved = root === cwd ? null : path.resolve(cwd);
        // A tree the read-time screen would drop is not worth writing: the
        // record degrades to none rather than to a field every later read
        // erases.
        const tree = resolved !== null && validExecutionTree(resolved) ? resolved : null;
        const now = readGoal(cwd);
        if (!now || typeof now.plan !== 'string' || now.plan === '') {
            return { ok: false, reason: 'no goal is armed' };
        }
        if (now.plan !== state.plan || now.armedAt !== state.armedAt) {
            return {
                ok: false,
                reason: 'goal state changed while this record was decided, so nothing was recorded'
            };
        }
        if (tree === null && !('executionTree' in now)) return { ok: true, recorded: false };
        if (tree !== null && now.executionTree === tree) return { ok: true, recorded: true };
        if (tree === null) delete now.executionTree;
        else now.executionTree = tree;
        const written = writeState(cwd, now);
        if (!written.ok) return written;
        return { ok: true, recorded: tree !== null };
    } catch (err) {
        return {
            ok: false,
            reason: 'could not record the execution tree: ' + (err && err.message ? err.message : String(err))
        };
    }
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
// safeForAuthorization rides along for the same single-rule reason: the CLI
// prints the stored sentence, and a printer applying a shorter cap than the store
// hands a reader half a claim and presents it as the whole recorded one.
// goalRoot rides along for the Stop hook's release clauses: a plan path that
// reads as gone from the working directory releases or advances the leash only
// when it is gone from the checkout the goal state lives in too, and that
// checkout is this resolution's answer, never a second spelling of it.
// planDisplayRoot rides along for the display readers of the executionTree
// field, so no surface judges that field by a spelling of its own, and
// recordExecutionTree for the checkpoint CLI, the field's one writer; both
// state their display-trust bound where they are defined.
// queuePosition rides along for the surfaces that report where a queue stands:
// the SessionStart notice, the CLI status report, the status-line widget's
// Plans segment, and the Stop hook's blocked clause, which files its event and
// its history record under the plan the walk puts current. The stored index
// moves only at a clean stop of the bound session, so what a queue entry's own
// plan doc says is the evidence those surfaces read, and one spelling of that
// evidence is what keeps four reports of one queue from disagreeing. The Stop
// hook reads it for attribution alone: the leash's own position, and every
// enforcement decision taken from it, stays the stored index's. A fifth
// surface reports the position and deliberately does not read this: the doctor
// renders the raw stored index,
// because it is the reporting control for a state file the hooks correct or
// refuse, and a doctor that silently corrected too would have nothing left to
// report the defect with.
// classifyPlanStatus and planStatusReadings ride along for the same
// single-rule reason one level down. Three surfaces ask the loose Status
// question and none of them spells it. The SessionStart hook's plan inventory
// asks it of docs/plans/ entries and would otherwise carry a second spelling
// of the regex in the same hook whose queue clause reads the strict one; the
// Stop hook's docs-hygiene check asks it of the same directory to find plans
// left unarchived, at every turn end; and the CLI's queue rendering asks both
// questions of one entry and must show which reading each of its lines used.
// A value the classifier learns reaches all three at once, which is the whole
// point of naming them here: a fourth surface spelling its own regex is the
// drift this export exists to prevent.
// treeEntryState rides along for the same single-rule reason at the tree
// level: the CLI's queue rendering must read the same per-tree state the
// position walk itself votes on, so the note explaining a [missing] token and
// the position it sits beside cannot drift apart from reading two spellings
// of the same archive check.
module.exports = { goalPath, goalRoot, goalPathKind, goalStateAbsent, readGoal, armGoal, appendGoal, advanceGoal, bindSession, clearGoal, composeCondition, planHead, planStatusReadings, classifyPlanStatus, emitGoalEvent, normalizePlanArg, lastActivePhrase, isSessionIdShaped, planFileSize, planHeadText, planPathState, planDisplayRoot, recordExecutionTree, pathErrnoClass, safeForAuthorization, queuePosition, treeEntryState, GOAL_STATE_MAX_BYTES };
