#!/usr/bin/env node
// CLI entry for the boundary-compaction checkpoint and the release markers.
//
// Subcommands:
//   kit-compact-checkpoint.js open      open a checkpoint for the armed plan
//   kit-compact-checkpoint.js clear     remove any open checkpoint
//   kit-compact-checkpoint.js status    report the checkpoint, the release
//                                       markers, the gate state, and any
//                                       hold stamps refusing the deferral nudge
//   kit-compact-checkpoint.js boundary [--cancel]
//                                       open the role-boundary marker for the
//                                       calling session (no goal required), or
//                                       retract the one it opened
//   kit-compact-checkpoint.js consent [--session <id>] [--project <path>]
//                                       record the operator's release for the
//                                       caller's session, or the named one, in
//                                       the caller's directory or a named one
//
// `open` is invoked by the executing-work chapter-close ritual after a
// Chapter is appended and the section's commit model has been honored. An
// open checkpoint tells the PreCompact gate (kit-compact-gate.js) that a
// chapter boundary has been reached: the gate allows the next auto-compaction
// attempt and consumes the checkpoint, so each open lands exactly one
// compaction. Opening requires an armed kit goal, because the checkpoint
// records the armed plan path and the gate treats a checkpoint naming any
// other plan as absent: with no goal armed there is nothing the file could
// ever match, so the open refuses rather than writing a dead checkpoint.
//
// `boundary` is the goalless seats' analogue of `open`: it opens the
// role-boundary marker for a role session (coordinator, expert, admin) at its
// own banked-and-empty moment, scoped by session rather than by plan, so no
// armed goal is required and the no-goal refusal stays the leashed mode's
// alone. The ordinary writer of that marker is the seat-stop.js Stop hook,
// which opens it at a turn end off the seat's own registry status push; this
// subcommand writes the same file the hook does, and it serves the two seats
// the hook cannot: one the machine's session registry does not carry, and a
// registered one whose project tree holds work it does not own, which the
// hook's clean-tree test refuses. Where the caller does have a registry entry,
// the run stamps that entry's `Banked:` line, a record of the declaration
// rather than a precondition for it: an absent directory or entry is a silent
// no-op and the marker opens either way. What this verb writes is stamped as a
// declaration, and that field is what puts it under the gate's moment rule,
// where the hook's turn-end marker stands on its age bound alone.
// `boundary --cancel` retracts this session's own marker; nothing depends on it
// being run, since the gate stops honoring a declared marker the moment a new
// turn begins in the session it names.
// `consent`
// writes the operator-release marker; the rule for WHEN it may be run (only
// on the operator's explicit word over a warranted channel, never on the
// session's own judgment) is the role skills' prose, while this CLI bounds
// only what one run of it can do: one session, one release, one age window.
// Its `--project` names the directory the marker is written at, for the
// ordinary case of an operator releasing a session that is not the one their
// shell stands in; a named project the session left no transcript under is
// refused, since a marker written there would be read by nobody.
// Both markers are consumed by the gate on the allow they cause, single-shot.
//
// All filesystem work is delegated to kit-compact-lib.js; this file is only
// argument parsing and output formatting, matching kit-goal.js.

'use strict';

const os = require('os');
const path = require('path');
// The kit libraries this CLI is written against, bound here and LOADED inside
// the guarded region at the foot of this file rather than required at module
// scope. A require that throws (a damaged or partially written plugin cache)
// throws before any guard this file installs, and what Node prints for it is its
// own trace, whose `Require stack:` lines carry the absolute module path of
// every file on that stack, home-anchored on an installed plugin. Loading them
// inside the try is what puts that failure back on this file's own channel. The
// sibling hook compact-deferral-nudge.js defers its kit requires into the guards
// that use them for the same failure mode.
let readGoal, recordExecutionTree, sessionHoldsLeash;
let readCheckpointResult, writeCheckpoint, clearCheckpoint, checkpointMatches,
    checkpointAdoptable, storableCheckpointOwner,
    readGateStateResult, gateStatePath, gateEpisodeOpen, pendingOfferCorroborated, checkpointOwner,
    readHoldNudgesResult, holdNudgePath, HOLD_NUDGE_HEALABLE,
    episodePhrase, wholeMinutesSince, gateCount,
    CHECKPOINT_MAX_AGE_MS, CHECKPOINT_PENDING_MAX_AGE_MS,
    readRoleBoundaryResult, roleBoundarySessionsResult, readConsentResult,
    writeRoleBoundary, writeConsent, clearRoleBoundary, sameSessionId,
    markerMatches, markerMomentHolds, markerDeclaresMoment, stampRegistryBanked,
    projectHoldsSessionTranscript, sessionTranscriptPath, usableSessionId,
    ROLE_BOUNDARY_MAX_AGE_MS, CONSENT_MAX_AGE_MS;

// The age bounds as an operator reads them, derived from the constants rather
// than written out so a sentence here cannot drift from the rule it describes.
// The rounding is exact only while the constants stay whole minutes and whole
// hours respectively: a 90-minute pending bound would print as "2 hours" against
// a rule enforcing one and a half, so a change to either constant that leaves
// whole units is what keeps these honest. The two marker bounds both render in
// hours because both are the same quantity: rendering one of them in minutes
// would print two different-looking figures for one window in a single `status`
// report, which reads as two rules rather than one. They are derived with the
// libraries loaded rather than at module scope, the constants arriving with
// them.
let ORDINARY_MINUTES, PENDING_HOURS, BOUNDARY_HOURS, CONSENT_HOURS;

function loadKitLibraries() {
    ({ readGoal, recordExecutionTree, sessionHoldsLeash } = require('./kit-goal-lib.js'));
    ({
        readCheckpointResult, writeCheckpoint, clearCheckpoint, checkpointMatches,
        checkpointAdoptable, storableCheckpointOwner,
        readGateStateResult, gateStatePath, gateEpisodeOpen, pendingOfferCorroborated, checkpointOwner,
        readHoldNudgesResult, holdNudgePath, HOLD_NUDGE_HEALABLE,
        episodePhrase, wholeMinutesSince, gateCount,
        CHECKPOINT_MAX_AGE_MS, CHECKPOINT_PENDING_MAX_AGE_MS,
        readRoleBoundaryResult, roleBoundarySessionsResult, readConsentResult,
        writeRoleBoundary, writeConsent, clearRoleBoundary, sameSessionId,
        markerMatches, markerMomentHolds, markerDeclaresMoment, stampRegistryBanked,
        projectHoldsSessionTranscript, sessionTranscriptPath, usableSessionId,
        ROLE_BOUNDARY_MAX_AGE_MS, CONSENT_MAX_AGE_MS
    } = require('./kit-compact-lib.js'));
    ORDINARY_MINUTES = Math.round(CHECKPOINT_MAX_AGE_MS / (60 * 1000));
    PENDING_HOURS = Math.round(CHECKPOINT_PENDING_MAX_AGE_MS / (60 * 60 * 1000));
    BOUNDARY_HOURS = Math.round(ROLE_BOUNDARY_MAX_AGE_MS / (60 * 60 * 1000));
    CONSENT_HOURS = Math.round(CONSENT_MAX_AGE_MS / (60 * 60 * 1000));
}

// What the gate's state says about this goal's binding, as the three facts the
// report and the open need. Read once per call, so a single call cannot
// contradict itself.
//
//   readable  the state file could be read at all. A file locked by a scanner
//             is not an absent one, and every surface here takes the
//             conservative bound either way, but only an answered question may
//             be printed as an answer.
//   held      a deferral episode owned by this binding is open now. This is
//             what `open` records, because a record written now cannot predate
//             a hold that is already standing.
//   state     the state itself, for the corroboration test the match rule
//             needs, which additionally requires the episode to predate the
//             record on disk (pendingOfferCorroborated owns that whole rule).
//
// The owner is the leash holder, because that is whose offers the gate holds:
// the goal's binding where it has one (checkpointOwner, which answers with an
// explicit null rather than undefined, for the reason stated there), and
// otherwise the calling session where it holds the leash by the other route the
// claim points act on. Without that second leg the question is scoped to null
// while a goal is unbound, no episode matches a null id, and a boundary opened
// in that window records no pending offer while the gate is holding this run's
// offers under its own session id: the adopted record then takes the short age
// bound, and a long tool call after the Chapter expires the boundary the flag
// exists to keep alive.
//
// The test is sessionHoldsLeash rather than armingSessionClaims, so this site
// answers "does this session hold the leash" in the one spelling the nudges use
// and cannot drift from them when that rule next changes; it also gates the
// fallback, so a caller that holds no leash scopes the question to nobody
// rather than to itself. Where no id is derivable from the environment at all,
// the predicate answers false and the owner stays null, which is the same
// conservative reading the unbound case had before.
function pendingHold(cwd, goal) {
    const bound = checkpointOwner(goal);
    const caller = callerSessionId();
    const owner = bound !== null ? bound : (sessionHoldsLeash(goal, caller) ? caller : null);
    const result = readGateStateResult(cwd);
    return {
        readable: result.ok,
        held: result.ok && gateEpisodeOpen(result.state, Date.now(), owner) !== null,
        state: result.state,
        owner
    };
}

// The length a repo-controlled string is printed within. One number, so the
// value and the mark that says it was shortened cannot be decided against two.
const PRINT_CAP = 120;

// Repo-controlled strings (a timestamp read back from disk, a session id, a
// verdict word) are sanitized to printable ASCII and length-capped before they
// reach stdout/stderr, matching the sibling hooks' convention for any repo data
// entering a trusted output channel. A value that is a PATH takes displayPath
// below instead.
//
// Both ways of DISCARDING text are marked, because both leave the reader
// looking at something that is not the value. The cap takes the tail off. The
// strip deletes characters from the middle of an accented or CJK name and
// leaves a plausible-looking shorter one, which is the worse of the two on the
// legs that hand the operator a path and tell them to remove that file: a name
// altered without a mark sends them after something that is not on disk. A
// value can take both marks, so the two are decided separately and read
// together. The third alteration, the channel's home elision, shortens a value
// too and carries no mark of its own; scrub below states why it needs none.
//
// Three steps in one order, and the order is what both marks rest on. The strip
// runs first, so the cut is decided on what is actually
// EMITTED rather than on the string before sanitizing: a value carried past the
// cap only by characters the strip removes is not cut at all, and marking it as
// cut would name a truncation that did not happen. The channel's home elision
// runs next, for that same reason and for a second one that is not cosmetic. A
// value carried past the cap only by a home prefix the channel takes out is not
// cut either; and eliding after the cap is eliding a home spelling the cut may
// have taken in half, which no pattern built from the whole spelling can match,
// so the account name reaches the channel in a fragment on exactly the machines
// whose home directory is long. The cap runs last, over the text the reader
// will see.
function printableAscii(s) {
    return String(s).replace(/[^\x20-\x7E]/g, '');
}

function sanitize(s) {
    const raw = String(s);
    const stripped = printableAscii(raw);
    const elided = scrub(stripped);
    const shown = elided.slice(0, PRINT_CAP);
    const marks = [];
    if (stripped.length !== raw.length) marks.push('characters removed');
    if (shown.length < elided.length) marks.push('cut to fit');
    return shown + (marks.length === 0 ? '' : ' [' + marks.join('; ') + ']');
}

// A filesystem path for the operator's eye. The home prefix is elided to `~`,
// because the OS account name is in it and this output is read by a model.
// Eliding is what keeps a realistic path inside the cap, so the cut mark
// sanitize appends is the rare case rather than the ordinary one.
//
// This is the renderer for a value KNOWN to be a path, and it runs beside the
// channel's own floor rather than instead of it: sanitize elides every value it
// is handed and emitOut and emitErr elide whatever text a caller composed, path
// or sentence, and a value elided here passes through both unchanged. The two
// are aimed at different problems. The containment test here is boundary-aware
// and answers on components, so it reaches a spelling the text of the home
// directory does not appear in at all (a path routed through `..`, or one
// differing only in letter case on win32); the elision the channel applies is
// textual, which is what a path embedded in the middle of an error sentence
// allows.
//
// Containment is decided by path.relative rather than by a prefix test on the
// text, because a prefix test is wrong in both directions once the input is not
// home-composed. It over-elides a sibling whose name merely starts with the home
// directory's (home /home/ad, project /home/admin/repo prints as ~min/repo), and
// on win32 it under-elides a path differing from the home directory only in
// letter case, printing the OS account name raw into a channel a model reads.
// path.relative answers on components rather than characters and is
// case-insensitive on win32, which is both directions at once; kitScratchDir in
// the library decides the same question the same way. A relative result that is
// absolute, or that escapes upward, means the path is somewhere else; the empty
// result means the path IS the home directory and elides to `~` alone, which is
// the one reading where the account name would otherwise be the whole output.
//
// A RELATIVE input is never elided, which is what keeps a repo-relative plan
// path printing as itself. path.relative would otherwise resolve it against the
// process's own cwd first, so `docs/plans/x.md` in a checkout under the home
// directory would come back rewritten as an absolute ~-anchored path: a longer,
// stranger rendering of a value that carried no home prefix to elide.
function displayPath(full) {
    const text = String(full);
    let home = '';
    try { home = os.homedir(); } catch { home = ''; }
    let shown = text;
    if (home !== '' && path.isAbsolute(text)) {
        const rel = path.relative(home, text);
        if (!path.isAbsolute(rel) && !/^\.\.(?:[\\/]|$)/.test(rel)) {
            shown = rel === '' ? '~' : '~' + path.sep + rel;
        }
    }
    // The marks the sanitize appends are what say the name on the line is not
    // the name on disk, in both directions: a cut tail and a stripped middle.
    return sanitize(shown);
}

// The home directory in the spellings this CLI's output can carry it in, as the
// patterns the channel elides it by, beside an explicit reading of whether a
// home directory is knowable at all.
//
// The two are separated because one empty list would otherwise answer both, and
// they are opposite news for a channel whose floor is this elision. Nothing to
// elide is the floor standing. No knowable home directory is the floor OFF, and
// os.homedir() can throw and follows USERPROFILE and HOME, so a stripped
// environment turns the whole guard off silently: the emitters state that case
// out loud rather than passing values through unmarked.
//
// The flattened spelling is what a transcript path carries: a session's
// transcript is filed under a directory named by the whole project path with
// each non-alphanumeric character turned to a dash (sanitizeProjectPath in
// scripts/memq.js), so for a checkout under the home directory the account name
// sits in the MIDDLE of that path, inside one component, where eliding a
// leading prefix cannot reach it.
//
// A match has to end at a boundary rather than mid-name, which is the bug a raw
// substring replace reproduces: home C:\Users\a against C:\Users\admin\repo
// renders as ~dmin\repo, a path that is nowhere on disk, on legs whose purpose
// is naming a file to act on. Both edges of the literal are therefore DENY-lists
// of the characters that would make the text a different name, never allow-lists
// of the characters that may stand beside it. That direction is what the two
// failure costs decide: over-elision prints a path nowhere on disk, while
// under-elision prints the OS account name into a channel a model reads, and an
// allow-list leaks on every neighbour nobody thought to name, an equals sign, a
// comma, a colon, an angle bracket, a parenthesis. So the trailing edge refuses
// an alphanumeric, a dot, an underscore and a dash, which are the characters
// that would make this another name (<home>-sib and <home>X keep their own
// names), and admits everything else, a separator and a quote and a bracket and
// a comma alike; sanitize's own marks ride on that, since it appends them as
// ` [cut to fit]` and a home directory at the end of a marked value is followed
// by a space and then a bracket.
//
// The leading edge refuses the same characters and a separator besides. Without
// a leading edge at all the match floats: POSIX home /home/admin turns
// /mnt/backup/home/admin/repo/.kit/x.json into /mnt/backup~/repo/.kit/x.json,
// and win32 is not immune by design, only by its home spelling starting with a
// drive letter. Refusing an alphanumeric in front is what kills that case, the
// candidate /home/admin there being preceded by the p of backup; refusing a
// separator additionally refuses a doubled-separator spelling of some other
// path.
//
// In the flattened spelling the separator is a dash and so is the character a
// dash was made from, so a child and a sibling are indistinguishable there and
// any non-alphanumeric character ends the match: where the flattened form cannot
// tell the two apart, eliding is the direction that keeps the account name off
// the channel. It takes no leading boundary at all, deliberately: it rides
// inside one component by construction, which is the whole reason it is elided
// separately from the leading prefix.
//
// Each spelling is built TWICE, from the raw home directory and from its
// printable-ASCII form, because the text this elides has already been stripped:
// sanitize strips before it elides, so on a home directory carrying an accented
// or CJK character the raw spelling is one no emitted line can ever contain, and
// C:\Users\Jose with an accent on the e reaches the channel as C:\Users\Jos.
// Building the same patterns from printableAscii(home) covers the text as it
// will actually be emitted. On an all-ASCII home the two are identical and the
// duplicates are dropped. What that costs is a real sibling directory spelled
// like the stripped home being elided too, which is the flattened spelling's own
// trade taken for the same reason: where the strip has made two names
// indistinguishable, eliding keeps the account name off the channel.
//
// A home directory AT A FILESYSTEM ROOT yields no patterns at all. C:\ reduces
// to C:, which carries an alphanumeric and would otherwise elide the drive
// prefix of every path on this channel, printing `removing ~\proj\.kit\x.json`
// for a file at C:\proj. A root holds no account name, so there is nothing here
// to take out of it. The same refusal covers a spelling the strip SHORTENED by a
// whole component, which the root test alone does not reach: a home whose final
// component is wholly non-ASCII strips to C:\Users\, and a pattern for C:\Users
// elides every account's paths on this channel, other accounts' included, into
// paths that are nowhere on disk. A spelling that names fewer path components
// than the home directory itself is a different directory, so it is skipped.
//
// The literal's separators match either slash, since a path can arrive in
// either spelling, and win32 matches without regard to letter case, as its
// filesystem does.
function homeElisions() {
    let home = '';
    try { home = os.homedir(); } catch { home = ''; }
    home = String(home);
    if (home === '') return { known: false, elisions: [] };
    const root = String(path.parse(home).root).replace(/[\\/]+$/, '');
    const escape = (s) => s.replace(/[^A-Za-z0-9]/g, (ch) => '\\' + ch);
    const flags = process.platform === 'win32' ? 'gi' : 'g';
    const lead = '(?<![A-Za-z0-9\\\\/._-])';
    const trail = '(?![A-Za-z0-9._-])';
    // How many path components a spelling names, which is the measure the guard
    // below compares the stripped spelling against.
    const depth = (s) => s.split(/[\\/]+/).filter((part) => part !== '').length;
    const homeDepth = depth(home.replace(/[\\/]+$/, ''));
    const elisions = [];
    const seen = new Set();
    for (const spelling of [home, printableAscii(home)]) {
        const named = spelling.replace(/[\\/]+$/, '');
        if (!/[A-Za-z0-9]/.test(named) || named === root) continue;
        // A spelling naming fewer components than the home directory is some
        // ancestor of it rather than it, and eliding an ancestor takes every
        // account's paths off the channel rather than this account's name.
        if (depth(named) < homeDepth) continue;
        const literal = Array.from(named)
            .map((ch) => (ch === '\\' || ch === '/' ? '[\\\\/]' : escape(ch)))
            .join('');
        const flattened = escape(named.replace(/[^A-Za-z0-9]/g, '-'));
        for (const [source, shown] of [
            [lead + literal + trail, '~'],
            [flattened + '(?![A-Za-z0-9])', 'flattened-home']
        ]) {
            if (seen.has(source)) continue;
            seen.add(source);
            elisions.push({ pattern: new RegExp(source, flags), shown });
        }
    }
    return { known: true, elisions };
}

// Read once: this is a CLI process whose home directory does not move under it,
// and the patterns are compiled rather than rebuilt per line.
const HOME_ELISIONS = homeElisions();

// A text as the channel prints it, with the home directory's name taken out of
// it in every spelling wherever in the text it sits. Two callers: sanitize,
// which hands it one repo-controlled value before the cap is applied, and the
// two emitters below, which hand it a whole composed line. The value the second
// catches that displayPath cannot is a path the library embedded in an error
// reason: fs errors name the file the syscall was refused on, and a caller
// printing that reason is printing a sentence rather than a path.
//
// The substitution is not marked the way sanitize marks its cut and its strip,
// and it needs no mark: both replacements say for themselves that the text was
// altered and what was taken out. `~` is the operator's own shorthand for the
// home directory, and `flattened-home` is not a spelling any component on disk
// carries, so a reader who needs the real path can put their home directory back
// where the mark is. A cut tail and a stripped middle have no such self-evident
// spelling, which is why those two are marked and this is not.
function scrub(text) {
    let shown = String(text);
    for (const elision of HOME_ELISIONS.elisions) shown = shown.replace(elision.pattern, elision.shown);
    return shown;
}

// Whether this run has already said that its floor is not standing, so the
// sentence is spent once rather than on every line.
let floorStated = false;

// The one-time note that no home directory is knowable here, or the empty string
// where one is. An empty elision list on its own answers two facts, and only one
// of them is news: nothing to elide is ordinary, while no knowable home
// directory means every path on the lines that follow carries whatever the OS
// account name is, with nothing else on this channel saying so. So the uncertain
// reading speaks rather than passing values through unmarked, which is the
// direction a floor has to fail in. It rides whichever descriptor is written to
// first, since both are read by the same reader and the fact is about neither
// one in particular.
function floorNote() {
    if (floorStated || HOME_ELISIONS.known) return '';
    floorStated = true;
    return 'kit-compact-checkpoint: no home directory is knowable in this shell, so nothing'
        + ' below is elided and any path on these lines carries the OS account name as it stands\n';
}

// The two writes this CLI makes to its output descriptors. Each routes its
// argument through the scrub above, so a line composed anywhere in this file
// carries the guard by reaching the channel here rather than by its author
// having remembered it. What keeps a print site from reaching a descriptor
// directly is the source-side pin in test/kit-compact-gate.test.js, which reads
// this file's own text; a sentence here could not.
function emitOut(text) {
    process.stdout.write(floorNote() + scrub(text));
}

function emitErr(text) {
    process.stderr.write(floorNote() + scrub(text));
}

function usage() {
    emitErr('usage: kit-compact-checkpoint.js open | clear | status'
        + ' | boundary [--cancel]'
        + ' | consent [--session <id>] [--project <path>]\n');
    process.exitCode = 1;
}

// The calling session's own id, from the environment the harness sets for a
// session's tool shell, or null when nothing usable is there. The variable is
// an undocumented harness detail that can change or vanish upstream, and
// inside a dispatched subagent's shell what it holds is unpinned (it may name
// the subagent's session rather than the seat that dispatched it); the
// refusal at the call sites is the designed degradation for both: where no id
// is derivable, this CLI refuses to write a scoped marker rather than
// writing an unscoped one.
function callerSessionId() {
    return usableSessionId(process.env.CLAUDE_CODE_SESSION_ID);
}

function cmdOpen() {
    const goal = readGoal(process.cwd());
    if (!goal || typeof goal.plan !== 'string' || goal.plan === '') {
        emitErr('kit-compact-checkpoint: no kit goal is armed, so a checkpoint would never match; nothing written\n');
        // The goal family resolves its state from the current directory, with
        // a linked worktree resolving to its main checkout, so a goal armed in
        // a checkout this directory does not resolve to (a separate clone, a
        // worktree of a bare repository, or a worktree whose .git pointer no
        // longer closes the handshake, which the lib notes on stderr) is
        // invisible here however live it is. Naming that makes the refusal
        // self-explaining, since from such a tree the goal looks armed and
        // this looks like a defect.
        emitErr('kit-compact-checkpoint: the goal may be armed in another checkout: this CLI reads'
            + ' the goal state from the current directory (a linked worktree resolves to its main'
            + ' checkout), so arm where you run\n');
        process.exitCode = 1;
        return;
    }
    // The checkpoint records the goal's current boundSession alongside the
    // plan: the gate requires both to match, so a checkpoint orphaned by a
    // crash cannot open the gate for the re-bound session that resumes the
    // plan. An unbound goal writes null, which no session's binding equals;
    // the record gains its owner when a claim point binds one and adopts the
    // ownerless record (adoptCheckpoint in the lib), which is how a run that
    // armed a plan for itself keeps the boundary it declared before its leash
    // reached it. The open therefore succeeds while unbound rather than
    // refusing: the binding is claimed at a stop or at an auto-compaction
    // offer, either of which may simply not have happened yet.
    // Whether an auto-compaction offer is already being held is recorded in the
    // checkpoint, because it is one of the two facts that decide which age
    // bound the gate holds it to (see CHECKPOINT_MAX_AGE_MS in the lib; the
    // other is corroboration at the moment the gate decides). The gate's own
    // decision state is where the fact lives: an open deferral episode is a
    // recorded deny with no allow after it, and past the trigger the harness
    // re-offers every assistant turn, so the offers recur until one is allowed.
    const hold = pendingHold(process.cwd(), goal);
    const result = writeCheckpoint(process.cwd(), goal.plan, goal.boundSession, hold.held);
    if (result.ok) {
        // File-derived values print indented, never at column zero, keeping
        // sanitized untrusted data visually subordinate in a channel a model
        // reads. Which of the two checkpoints was opened is stated, because the
        // two behave differently for the rest of their lives: one waits for an
        // offer that is already pending, the other ages out in minutes. Both
        // durations come from the constants, so neither sentence can promise
        // what the rule does not do.
        // The plan is a path, so it takes the path renderer rather than the
        // plain sanitize: this one is repo-relative by construction (the goal
        // library's normalizer refuses anything else), so nothing is elided here
        // and the value prints as itself, but reportCheckpoint prints the same
        // field back out of a user-writable file, where it is whatever a hand
        // edit made it.
        emitOut('  compact checkpoint open for ' + displayPath(result.plan)
            + (hold.held
                ? ' (the compaction gate is holding offers, so this waits for the next one rather than'
                    + ' aging out in ' + ORDINARY_MINUTES + ' minutes: for as long as the gate keeps'
                    + ' deferring, and never past ' + PENDING_HOURS + ' hours)'
                : ' (the next auto-compaction lands here)')
            + '\n');
        // A state file that could not be read is not an absent one, and the
        // bound taken above is the conservative one either way. Saying so is
        // what keeps the confident sentence above from being the whole story:
        // an operator who expected a held offer learns the question went
        // unanswered rather than being told there was no hold.
        if (!hold.readable) {
            emitOut('the compaction gate state could not be read, so this checkpoint records no'
                + ' pending offer and keeps the ' + ORDINARY_MINUTES + '-minute bound\n');
        }
        // A boundary opened from a linked worktree records that tree in the
        // goal state, and one opened from the resolved checkout drops any
        // standing record (recordExecutionTree is the field's ONLY writer, and
        // this is its one call site): display surfaces then prefer the
        // executing tree's copy of the plan doc for progress. The field is
        // display-trust only and the record is best-effort, so a failure here
        // costs a possibly stale Sections count, never the checkpoint just
        // opened.
        recordExecutionTree(process.cwd());
        process.exitCode = 0;
    } else {
        emitErr('kit-compact-checkpoint: ' + sanitize(result.reason) + '\n');
        process.exitCode = 1;
    }
}

// Open the role-boundary marker for the calling session: the goalless seats'
// analogue of `open`. The marker is scoped by session rather than by plan, so
// no armed goal is required and the no-goal refusal above stays the leashed
// mode's alone. The refusal here is loud and names the variable, because the
// alternative, an unscoped marker whichever session's offer arrived first
// would consume, is the one shape the design forbids.
//
// The scope is the file itself: the marker's name carries the session id, so
// several seats held in one checkout each declare into their own file and this
// write can replace nothing but this session's own previous declaration.
function cmdBoundary(rest) {
    // The parse is strict for the same reason cmdConsent's is: `boundary
    // --session <id>` is the natural misreading of the consent form, and a
    // parser that ignored the tail would do two wrong things at once, denying
    // the named session its release and handing the ambient session one it
    // never asked for. Exactly one argument form is accepted, --cancel, and
    // it takes no value: the boundary marker is the calling session's own
    // declaration, whether it is being made or retracted.
    const cancel = rest.length === 1 && rest[0] === '--cancel';
    if (rest.length !== 0 && !cancel) {
        emitErr('usage: kit-compact-checkpoint.js boundary [--cancel] (no other arguments:'
            + ' the marker is scoped to the calling session; consent is the mode that takes'
            + ' --session)\n');
        process.exitCode = 1;
        return;
    }
    const session = callerSessionId();
    if (session === null) {
        emitErr('kit-compact-checkpoint: no usable session id in this shell'
            + ' (CLAUDE_CODE_SESSION_ID is unset or not id-shaped), so a session-scoped'
            + ' marker cannot be ' + (cancel ? 'retracted' : 'written') + '; nothing written\n');
        process.exitCode = 1;
        return;
    }
    if (cancel) {
        cancelBoundary(session);
        return;
    }
    // Written as a declaration, which is the field the gate's moment rule is
    // scoped by: this verb is a seat's deliberate word about one instant, where
    // the seat-stop hook's turn-end marker is a standing window it rewrites
    // every turn. The tool writes the field; nothing asks a model to.
    const result = writeRoleBoundary(process.cwd(), session, true);
    if (result.ok) {
        // The registry record of the declaration, best-effort and after the
        // marker: a seat the registry does not carry declares exactly as well
        // as one it does, so an absent directory or entry is a silent no-op
        // and nothing about the marker turns on it.
        //
        // One refusal is not silent. An entry that exists at this session's own
        // path while naming a different session is a state nobody should meet
        // by accident: either the id this shell carries is not this session's,
        // or a peer's entry is sitting at it, and both are worth a word to the
        // operator. The declaration still stands, so this is a note on stderr
        // rather than a failure, and it names neither the entry's session nor
        // its path, since the point is that neither is this caller's.
        const stamp = stampRegistryBanked(session);
        if (!stamp.stamped && stamp.reason === 'the entry at that path names a different session') {
            emitErr('kit-compact-checkpoint: the registry entry for this session id names a'
                + ' different session, so it is not this session\'s to stamp and was left untouched;'
                + ' the boundary itself is declared\n');
        }
        // Environment-derived values print indented and sanitized, the same
        // handling cmdOpen gives the plan path; the duration comes from the
        // constant, so the sentence cannot promise what the rule does not do.
        // The moment clause is stated beside the age bound because the two
        // bound the marker together, and the shorter one is the one a seat
        // will meet: the gate stops honoring this marker the moment a new turn
        // begins in this session.
        emitOut('  role-boundary marker open for session ' + sanitize(session)
            + ' (that session\'s next deferred auto-compaction lands at this boundary,'
            + ' until a new turn begins there; it ages out in ' + BOUNDARY_HOURS + ' hours)\n');
        // A declaration the gate cannot position is one it will never honor, so
        // it is said here rather than left to look like a marker that works.
        // The ordinary cause is a run from a directory this session's own
        // transcript is not filed under, which is the same working-directory
        // mistake the marker's own path can make.
        if (result.positioned === false) {
            emitErr('kit-compact-checkpoint: no transcript for this session could be measured'
                + ' from this directory, so the gate has nothing to read the moment against and will'
                + ' treat this marker as lapsed; run the verb from the session\'s own project directory\n');
        }
        process.exitCode = 0;
    } else {
        emitErr('kit-compact-checkpoint: ' + sanitize(result.reason) + '\n');
        process.exitCode = 1;
    }
}

// Retract this session's own declaration, at this session's own file: a peer's
// declaration lives at a name this verb never composes, so nothing here can
// reach one. What the file at this session's name holds is still read before
// anything is removed, since the name is composed from an environment variable
// nothing authenticates and whatever sits there may be a peer's: a record naming
// another session is left standing, exactly as the gate leaves one it does not
// match. Nothing in the design depends on this being run, the moment rule above
// retiring a marker that outlived its lull with no act from anyone; this is the
// explicit retraction, for an operator at a shell and for a session withdrawing
// a declaration it has just made.
//
// A marker whose owner cannot be read is not removed either, and it is the
// leg worth stating: an illegible or oversized file reads as no marker at all,
// so a clear that ran on it would delete whatever was written there and
// report it as this session's own retraction. The scope guard can only protect
// a scope it can see, so where it cannot see one the answer is to leave the
// file alone and say what is there.
function cancelBoundary(session) {
    const read = readRoleBoundaryResult(process.cwd(), session);
    const marker = read.marker;
    if (read.reason === 'no-session') {
        // No file name composes from this id, so nothing was read and no file is
        // being asserted to exist: the refusal names the id rather than a marker
        // that cannot be read, which is the opposite fact. The caller charset-
        // gates before it reaches here, so this is the floor rather than the
        // path an operator meets.
        emitErr('kit-compact-checkpoint: this session id is not one a marker file name'
            + ' composes from, so no declaration of its own can be open here'
            + ' (nothing was retracted)\n');
        process.exitCode = 1;
        return;
    }
    if (marker === null && read.reason !== 'absent') {
        emitErr('kit-compact-checkpoint: a role-boundary marker file is present here that'
            + ' cannot be read (' + sanitize(read.reason) + '), so whose declaration it is cannot be'
            + ' established and it is left in place; move it aside by hand (nothing was retracted)\n');
        process.exitCode = 1;
        return;
    }
    if (marker !== null && typeof marker.session !== 'string') {
        emitErr('kit-compact-checkpoint: the role-boundary marker file here names no session,'
            + ' so whose declaration it is cannot be established and it is left in place; the next'
            + ' boundary write replaces it (nothing was retracted)\n');
        process.exitCode = 1;
        return;
    }
    if (marker && typeof marker.session === 'string' && !sameSessionId(marker.session, session)) {
        emitOut('  a role-boundary marker for session ' + sanitize(marker.session)
            + ' is open here and is left in place: this session declared no boundary to retract\n');
        process.exitCode = 0;
        return;
    }
    const result = clearRoleBoundary(process.cwd(), session);
    if (!result.ok) {
        // Nothing was removed, so this must not read as a successful retraction,
        // and what is left behind is not asserted: cmdClear's own wording at the
        // same leg of the same question.
        emitErr('kit-compact-checkpoint: ' + sanitize(result.reason)
            + ' (nothing was retracted)\n');
        process.exitCode = 1;
        return;
    }
    emitOut((result.cleared
        ? 'role-boundary marker retracted'
        : 'no role-boundary marker was open') + '\n');
    process.exitCode = 0;
}

// Record the operator's release for the caller's session, or an explicitly
// named one. The rule for WHEN this may be run is the role skills' prose (the
// operator's explicit word over a warranted channel, never the session's own
// judgment); what this parser owns is the strictness of the write: --session
// demands exactly one value, and a value is never taken from anything
// dash-led (usableSessionId's leading-character rule), so a missing value
// cannot swallow the next flag and be recorded as a session name.
function cmdConsent(rest) {
    const flags = { '--session': null, '--project': null };
    for (let i = 0; i < rest.length; i += 2) {
        if (!Object.prototype.hasOwnProperty.call(flags, rest[i])
            || flags[rest[i]] !== null || i + 1 >= rest.length) {
            emitErr('usage: kit-compact-checkpoint.js consent'
                + ' [--session <id>] [--project <path>]'
                + ' (each flag at most once, each with one value)\n');
            process.exitCode = 1;
            return;
        }
        flags[rest[i]] = rest[i + 1];
    }

    let session;
    if (flags['--session'] === null) {
        session = callerSessionId();
        if (session === null) {
            emitErr('kit-compact-checkpoint: no usable session id in this shell'
                + ' (CLAUDE_CODE_SESSION_ID is unset or not id-shaped); name one with'
                + ' --session <id>; nothing written\n');
            process.exitCode = 1;
            return;
        }
    } else {
        session = usableSessionId(flags['--session']);
        if (session === null) {
            emitErr('kit-compact-checkpoint: --session needs one value that starts'
                + ' with a letter or digit and uses only letters, digits, dot, underscore or'
                + ' hyphen; nothing written\n');
            process.exitCode = 1;
            return;
        }
    }

    // Without --project the marker lands where the caller stands, which is the
    // operator's own session's project and needs no corroboration. With it the
    // target directory is a value the caller supplied, so it is corroborated
    // before anything is written: the named session must have a transcript
    // filed under that project. A marker written anywhere else is inert and
    // says nothing about it, which is the failure this flag exists to end, so
    // the miss is an error here rather than a successful-looking write.
    const target = flags['--project'] === null ? process.cwd() : flags['--project'];
    if (flags['--project'] !== null && !projectHoldsSessionTranscript(target, session)) {
        emitErr('kit-compact-checkpoint: no transcript for session '
            + sanitize(session) + ' under the project at ' + displayPath(target)
            + ', so a marker written there would never be read; check the path and the'
            + ' session id; nothing written\n');
        process.exitCode = 1;
        return;
    }
    const result = writeConsent(target, session);
    if (result.ok) {
        emitOut('  operator-consent marker recorded for session ' + sanitize(session)
            + ' (releases that session\'s next deferred auto-compaction once, within '
            + CONSENT_HOURS + ' hours)\n');
        process.exitCode = 0;
    } else {
        emitErr('kit-compact-checkpoint: ' + sanitize(result.reason) + '\n');
        process.exitCode = 1;
    }
}

function cmdClear() {
    const result = clearCheckpoint(process.cwd());
    if (!result.ok) {
        // Nothing was removed, so this must not read as a successful clear. What
        // is left behind is not asserted: the lstat leg fires with existence
        // unproven, and while a lock stands every reader treats the path as
        // absent, so the checkpoint is not necessarily open either. This is the
        // goal CLI's own wording at the same leg of the same question.
        emitErr('kit-compact-checkpoint: ' + sanitize(result.reason) + ' (nothing was cleared)\n');
        process.exitCode = 1;
        return;
    }
    emitOut((result.cleared ? 'compact checkpoint cleared' : 'no compact checkpoint was open') + '\n');
    process.exitCode = 0;
}

// Why a checkpoint on disk gates nothing, per checkpointMatches reason code.
// Every message states plainly that the gate treats the file as absent, so a
// reader never mistakes an open-but-dead checkpoint for a live one. The
// 'no-checkpoint' code has no entry because cmdStatus reports that state
// before consulting the rule; an unknown future code falls back to the bare
// treats-as-absent clause rather than printing nothing.
const ABSENT_REASONS = {
    'no-goal': 'no kit goal is armed, so the gate treats it as absent',
    'wrong-plan': 'does not match the armed goal, so the gate treats it as absent',
    'no-timestamp': 'its opened timestamp is missing or unreadable, so the gate treats it as absent',
    'future': 'its opened timestamp is in the future, so the gate treats it as absent'
};

// Why a record the match rule refused on its session leg gates nothing, which
// is three states rather than one. That rule compares the record's owner against
// the goal's and reports one code whether the record names another session or
// names none at all, and the two are opposite news for an operator: a record
// with no owner is the boundary a run banked before anything held its leash,
// which the next claim adopts rather than discards, so calling it another
// session's would send an operator to clear or re-open the one record that needs
// neither. A record with no owner beside a leash already held is genuinely dead,
// because an adoption rides on a claim and a held leash is claimed.
//
// The report stays in step with the gate by asking the gate's own predicates
// rather than a second copy of them: the verdict above is still checkpointMatches',
// and the two questions here are storableCheckpointOwner's (does the record name
// an owner, by the rule the writer stores one under) and checkpointAdoptable's
// (would a claim take this record), which is the step the claim points run
// between the match and the next verdict.
function unmatchedSessionReason(cp, goal) {
    if (storableCheckpointOwner(cp.boundSession).value !== null) {
        return 'names a session that does not hold the armed goal\'s leash, so the gate treats it as absent';
    }
    if (checkpointOwner(goal) !== null) {
        return 'records no session while the leash is held, so the gate treats it as absent;'
            + ' a boundary opened now records the binding';
    }
    return checkpointAdoptable(cp, goal).ok
        ? 'records no session, no session holding the leash when it opened; the claim that binds one'
            + ' adopts this record, and the gate honors it from then, within the age bound it already carries'
        : 'records no session and carries no opened timestamp a claim could adopt it by,'
            + ' so the gate treats it as absent';
}

// Why a record carrying the pending-offer flag was judged by the ordinary bound
// anyway, as a clause. Null when it was not, so a caller says nothing.
//
// Three things send a flagged record to the short bound, and an operator
// debugging a boundary that went unhonored needs to know which. The wording is
// scoped to this session's binding on purpose: the gate-state report two lines
// below answers the unscoped question (is this PROJECT holding offers), and
// without the qualifier the two lines read as a contradiction when a bystander
// is being held and this binding is not.
function shortBoundBecause(cp, hold, corroborated) {
    if (cp.pendingOffer !== true || corroborated) return null;
    if (!hold.readable) {
        return 'the compaction gate state could not be read, so the longer bound could not be confirmed';
    }
    if (hold.held) {
        return 'the hold now standing began after this checkpoint opened, so it does not vouch for it';
    }
    return 'no offer is being held for this session\'s binding, so the longer bound does not apply';
}

// Why an EXPIRED checkpoint expired, which is the one reason code with more
// than one story behind it: three different fixtures print the same word, and
// the one an operator is debugging (a boundary that should have been honored
// and was not) is the middle one. So the sentence names the bound that actually
// applied and, where they differ, why it was not the other. This is the only
// producer of an expired message, so the two spellings cannot drift.
function expiredReason(cp, hold, corroborated) {
    if (corroborated) {
        return 'expired (opened under a pending offer, and past even the ' + PENDING_HOURS
            + '-hour bound for one), so the gate treats it as absent';
    }
    const why = shortBoundBecause(cp, hold, corroborated);
    return 'expired (past the ' + ORDINARY_MINUTES + '-minute checkpoint age bound)'
        + (why === null ? '' : ': ' + why) + ', so the gate treats it as absent';
}

// The checkpoint half of the status report: whether one is open, and why the
// gate would ignore it if it is.
function reportCheckpoint(cwd) {
    const read = readCheckpointResult(cwd);
    const cp = read.cp;
    if (!cp || typeof cp.plan !== 'string') {
        // The read answers with no checkpoint for a genuinely absent file, for
        // one that exists and did not parse, and for three refusals. The gate
        // treats all of them as absent, but an operator does not: each names a
        // different remedy, so status prints the one that works rather than
        // reporting absence over a file that is sitting right there.
        //
        // Which leg it was comes from the reader itself rather than from a second
        // lstat here. An lstat asked afterwards cannot see the 'unreadable' leg
        // at all: it succeeds and reports an ordinary regular file, so the report
        // would call a locked checkpoint illegible and promise a clear that is
        // failing for the same reason the read did.
        const reason = cp === null ? read.reason : 'illegible';
        if (reason === 'illegible') {
            emitOut('an illegible checkpoint file is present (the gate treats it as absent); clear removes it\n');
        } else if (reason === 'oversized') {
            // A regular file, so clear unlinks it, and past the read cap, so it
            // never becomes legible on its own.
            emitOut('a checkpoint file past the size the reader accepts is present '
                + '(the gate treats it as absent); clear removes it\n');
        } else if (reason === 'kind') {
            emitOut('something that is not a checkpoint file is sitting at the checkpoint path '
                + '(the gate treats it as absent); clear cannot remove it, so move it aside by hand\n');
        } else if (reason === 'unreadable' || reason === 'lstat') {
            // Scoped to now: a lock lifts, and a checkpoint the gate ignores this
            // second can be the one it honors the next. Saying none is in effect
            // either way would be the same false absence this report exists to
            // stop printing, and naming a remedy over it would name one that
            // fails for the reason the read already failed.
            emitOut('the checkpoint path cannot be read right now, so the gate treats '
                + 'it as absent while that lasts\n');
        } else {
            emitOut('no compact checkpoint is open\n');
        }
        return;
    }
    // File-derived values print indented, never at column zero (see cmdOpen).
    // A missing openedAt is stated as missing rather than stringified (the
    // literal "undefined" would read as a value the file carries).
    // The plan takes the path renderer rather than the plain sanitize. It is
    // read back out of the checkpoint file with no per-field validation of its
    // own, and that file is user-writable like everything under .kit/, so an
    // absolute value planted there is a home prefix on this line and a long one
    // is a truncation that would read as the whole name of the plan were it not
    // marked. The ordinary value is repo-relative and prints unchanged.
    let line = '  compact checkpoint open for ' + displayPath(cp.plan);
    line += (typeof cp.openedAt === 'string')
        ? ' (opened ' + sanitize(cp.openedAt) + ')'
        : ' (no opened timestamp recorded)';
    // A checkpoint the gate would read as absent is worth flagging here, with
    // the reason: the file exists but gates nothing, which status alone would
    // misreport. The verdict comes from the same checkpointMatches rule the
    // gate itself decides by, and the one refusal whose meaning depends on what
    // happens after that rule runs, the session leg, is worded by the adoption's
    // own predicates (see unmatchedSessionReason), so this report cannot drift
    // from the gate's effective answer either.
    const goal = readGoal(cwd);
    const hold = pendingHold(cwd, goal);
    // The same corroboration the gate applies, from the same predicate, so this
    // report cannot describe a checkpoint the gate would judge differently.
    const corroborated = pendingOfferCorroborated(cp, hold.state, Date.now(), hold.owner);
    const verdict = checkpointMatches(cp, goal, Date.now(), corroborated);
    if (!verdict.ok) {
        let why;
        if (verdict.reason === 'expired') why = expiredReason(cp, hold, corroborated);
        else if (verdict.reason === 'wrong-session') why = unmatchedSessionReason(cp, goal);
        else why = ABSENT_REASONS[verdict.reason] || 'the gate treats it as absent';
        line += ' - ' + why;
    } else {
        // A live checkpoint stands on one of two age bounds, and an operator
        // asking why one is still honored an hour in (or why another died in
        // minutes) is asking which. The flag alone does not answer it, so the
        // clause names the bound that actually applies and, for a flagged
        // record on the short one, why.
        const why = shortBoundBecause(cp, hold, corroborated);
        if (corroborated) {
            line += ' - the gate honors it: offers are being held, so it waits for the pending one';
        } else {
            line += ' - the gate honors it, within the ordinary checkpoint age bound'
                + (why === null ? '' : '; ' + why);
        }
    }
    emitOut(line + '\n');
}

// Why a marker on disk gates nothing, per markerMatches reason code, worded
// as ABSENT_REASONS words the checkpoint's: every message states plainly that
// the gate treats the file as absent. The 'no-marker' and 'wrong-session'
// codes have no entry because this report all but never produces them (a
// shapeless file takes the illegible leg below, and the marker is judged
// for the session it itself names). One hand-made shape reaches
// 'wrong-session' anyway: an empty-string session passes the shape guard
// below, being a string, and then compares unequal to itself. That code and
// any unknown future one fall back to the bare treats-as-absent clause
// rather than printing nothing, which is why the fallback is here rather
// than an assertion. 'expired' is built at
// the call site, because it names the bound that applied and the two marker
// kinds carry different bounds.
const MARKER_DEAD_REASONS = {
    'consumed': 'already consumed, so the gate treats it as absent',
    'no-timestamp': 'its written timestamp is missing or unreadable, so the gate treats it as absent',
    'future': 'its written timestamp is in the future, so the gate treats it as absent'
};

// Why a live marker no longer describes the moment it declared, per
// markerMomentHolds reason code. A declaration is about a moment, so a marker
// lapses the instant a new turn begins in the session it names, and every
// question the rule cannot answer lapses it too, which is the direction that
// keeps the gate deferring rather than landing a compaction mid-turn. An
// unknown future code falls back to the bare lapsed clause.
const MARKER_LAPSED_REASONS = {
    'inbound': 'lapsed: a message arrived in that session after it was declared',
    'no-position': 'lapsed: the declaration records no place in that session\'s transcript, so nothing can vouch for the moment',
    'unreadable': 'lapsed: that session\'s transcript cannot be read, so nothing can vouch for the moment',
    'replaced': 'lapsed: that session\'s transcript no longer matches what was there when the boundary was declared',
    'too-long': 'lapsed: that session\'s transcript has grown past what the read covers, so what arrived since is unknown',
    'torn': 'lapsed: a line of that session\'s transcript cannot be read, so what arrived since is unknown'
};

// One marker's line in the status report, mirroring reportCheckpoint's
// legs: the read refusals are told apart by the reader's own reason (a second
// lstat here could not see the 'unreadable' leg at all), a present marker is
// judged by the same markerMatches rule the gate decides by, and a dead one
// is flagged with why, so the file's presence is never misreported as a live
// release. `verb` is how presence is phrased ("open" for a declared boundary,
// "present" for a recorded consent), and `boundPhrase` names the age bound
// that applies to this kind.
//
// The marker is judged for the session it itself names, deliberately: a shell
// running status is not the offering session, so the wrong-session leg is not
// this report's question to answer. What it answers is whether the marker
// would release the session it names, and it prints that session so the
// operator can judge the scoping half themselves. One call is one marker, so
// the boundary kind takes a call per open declaration in the project and the
// consent kind, one file per project, takes exactly one.
//
// `momentCwd` is the project directory the moment rule is read at, passed for
// the marker kind that can carry a declaration (a role-boundary marker) and
// null for the one that cannot (a consent is the operator's word rather than a
// seat's moment). Within that kind the rule still applies only to the boundary
// verb's declared marker, which markerDeclaresMoment decides. A marker the
// moment rule has retired is reported as lapsed rather than as live: it is
// still on disk, the gate ignores it, and the next write in that project sweeps
// it once it passes its age bound, which is exactly the state an operator has no
// other way to see.
//
// `named` is the session the marker's own FILE NAME carries, for the kind whose
// files are listed rather than resolved from a caller's id, and null where the
// report has no name to hold the record against. Two things turn on it. It names
// whose file a refusal is about, which with several files open is the difference
// between a legible report and an unattributable one. And it is checked against
// the record inside, because the gate resolves a marker by name and then
// requires the record to agree: a file at one session's name recording another
// releases neither, and reporting it as live for the session it records would
// describe a marker the gate can never reach.
function reportMarker(read, label, verb, maxAgeMs, boundPhrase, momentCwd, named) {
    const marker = read.marker;
    const whose = (typeof named === 'string' && named !== '')
        ? ' for session ' + sanitize(named)
        : '';
    if (!marker || typeof marker !== 'object' || Array.isArray(marker)
        || typeof marker.session !== 'string') {
        const reason = marker === null ? read.reason : 'illegible';
        if (reason === 'illegible') {
            emitOut('an illegible ' + label + ' marker file is present' + whose + ' '
                + '(the gate treats it as absent); the next ' + label + ' write replaces it\n');
        } else if (reason === 'oversized') {
            emitOut('a ' + label + ' marker file past the size the reader accepts '
                + 'is present' + whose + ' (the gate treats it as absent); the next ' + label
                + ' write replaces it\n');
        } else if (reason === 'kind') {
            emitOut('something that is not a ' + label + ' marker file is sitting '
                + 'at its path' + whose + ' (the gate treats it as absent); move it aside by hand\n');
        } else if (reason === 'unreadable' || reason === 'lstat') {
            // Scoped to now, exactly as reportCheckpoint scopes its own lock
            // leg: a lock lifts, and absence must not be asserted over it.
            emitOut('the ' + label + ' marker path' + whose + ' cannot be read right now, '
                + 'so the gate treats it as absent while that lasts\n');
        } else if (reason === 'no-session') {
            // The resolver composed no path, so no file was read and nothing is
            // being asserted about the directory: its own fact, said as itself
            // rather than folded into either an absence or a bad file.
            emitOut('no ' + label + ' marker file name composes from that session id'
                + whose + ', so none was read\n');
        } else if (whose !== '') {
            // Absent, for a file that WAS listed a moment ago: the project-wide
            // none-open line would contradict the open markers this report has
            // just printed beside it.
            emitOut('the ' + label + ' marker file' + whose + ' is no longer there '
                + '(it was listed and then removed)\n');
        } else {
            emitOut('no ' + label + ' marker is ' + verb + '\n');
        }
        return;
    }
    if (whose !== '' && !sameSessionId(marker.session, named)) {
        // The gate finds a marker by name and then holds the record to the same
        // session, so this file releases neither: not the session naming it,
        // whose read of this path finds a record for someone else, and not the
        // session recorded, whose own offer resolves a different path entirely.
        emitOut('  a ' + label + ' marker file' + whose + ' records session '
            + sanitize(marker.session) + ', so the gate reaches it for neither session; '
            + 'move it aside by hand\n');
        return;
    }
    // File-derived values print indented, never at column zero (see cmdOpen).
    let line = '  ' + label + ' marker ' + verb + ' for session ' + sanitize(marker.session);
    line += (typeof marker.writtenAt === 'string')
        ? ' (written ' + sanitize(marker.writtenAt) + ')'
        : ' (no written timestamp recorded)';
    const verdict = markerMatches(marker, marker.session, Date.now(), maxAgeMs);
    // The moment rule governs a declared marker only, so a hook-written one is
    // reported on its age bound alone and no transcript is read for it.
    const declares = markerDeclaresMoment(marker) && momentCwd !== null && momentCwd !== undefined;
    // The moment is read only where the match rule has already passed, since a
    // marker the gate treats as absent is not one any transcript can speak for,
    // and the line below reports the read rather than the marker's provenance:
    // one condition governs the call and the report of it, so the report can
    // never assert a read that did not happen.
    const reads = declares && verdict.ok;
    const transcript = reads ? sessionTranscriptPath(momentCwd, marker.session) : null;
    const moment = reads
        ? markerMomentHolds(marker, transcript)
        : { ok: true, reason: null };
    if (!verdict.ok) {
        line += ' - ' + (verdict.reason === 'expired'
            ? 'expired (past the ' + boundPhrase + ' bound), so the gate treats it as absent'
            : (MARKER_DEAD_REASONS[verdict.reason] || 'the gate treats it as absent'));
    } else if (!moment.ok) {
        line += ' - ' + (MARKER_LAPSED_REASONS[moment.reason] || 'lapsed')
            + ', so the gate treats it as absent; declare again at the next real boundary';
    } else {
        line += ' - the gate honors it once for that session\'s next deferred auto-compaction, '
            + 'within the ' + boundPhrase + ' bound';
    }
    emitOut(line + '\n');
    // Which transcript answered the moment question, named rather than left to
    // be assumed. This report derives the path from the directory it is run in;
    // the gate reads the path its own PreCompact payload carries. The two are
    // the same file for a session working the directory this report is run
    // from, and a session that is not makes them differ, so a verdict here that
    // disagrees with the gate's is readable as the different subject it is
    // rather than as a contradiction.
    if (reads) {
        emitOut('    moment read against ' + (transcript === null
            ? '(no transcript path derives from this directory and that session id)'
            : displayPath(transcript))
            + ', this directory\'s transcript for that session\n');
    }
}

// The compaction gate's own record: what it decided last, and whether it is
// currently holding auto-compaction offers back. An operator reads this to tell
// a gate that is working (a short episode mid-section) from a boundary that was
// never opened (a long one), which is the question the state file exists to
// answer; the full history is the .jsonl log beside it.
//
// The two halves are reported independently: a state file whose newest decision
// is illegible can still hold a live episode, and that episode is the half an
// operator acts on. The open-episode test and the phrasing of its two integers
// are the lib's (gateEpisodeOpen, episodePhrase), shared with the gate's own
// note so the two surfaces cannot disagree about one episode.
//
// One reading to expect: an episode belongs to the leashed run, so a project
// holding a hands-on session with no goal armed reports its last decision but
// no episode. The deferral is real and the .jsonl log carries every offer of
// it; the aggregate is the leash's alone.
//
// No session id is passed to gateEpisodeOpen, deliberately: an operator running
// status is asking whether this project is holding offers at all, not whether
// any particular session owns the hold. A decision-shaped question would pass
// the armed goal's boundSession instead, since acting on another session's hold
// is the mistake the argument exists to prevent.
function reportGateState(cwd) {
    const result = readGateStateResult(cwd);
    if (!result.ok) {
        // A state file the reader refuses is not an absent one, and reporting it
        // as absent would describe a project recording nothing as a fresh one.
        // The refusal legs do not all mean the same thing, though, and the
        // message names a remedy: removing the file discards the standing
        // deferral episode and the corroboration that selects the checkpoint's
        // long bound, so it is advice worth giving over a file that will never
        // resolve and worth withholding over a scanner's lock that lifts in
        // seconds.
        //
        // Which leg it was comes from the reader's own refusal, the way
        // reportCheckpoint takes its own. Re-asking with an lstat here cannot see
        // the leg where the read was refused: that lstat succeeds and reports an
        // ordinary regular file, so the destructive advice would print over
        // exactly the transient case it is withheld for.
        //
        // Both remedies name the file at the path the reader itself used rather
        // than at a spelling written out here: the scratch directory is
        // resolved (kitScratchDir in kit-compact-lib.js), and a project
        // directory inside the memory store keeps its gate state outside the
        // project, so a hard-coded `.kit/` remedy would send an operator to
        // inspect a file that is not there. It is a value known to be a path, so
        // it takes displayPath, since a project under the operator's home carries
        // the OS account name into a channel a model reads.
        const statePath = displayPath(gateStatePath(cwd));
        if (result.reason === 'oversized') {
            // Worded as reportCheckpoint words its own oversized leg: the file
            // is legible and was refused on size, which is not the same fact as
            // a read that failed, and one refusal answered two ways is what the
            // shared-spelling rule exists to stop.
            emitOut('a compaction gate state file past the size the reader accepts is present, '
                + 'so the gate is recording nothing; removing ' + statePath + ' lets the next '
                + 'decision rebuild it\n');
        } else if (result.reason === 'kind') {
            emitOut('something that is not the gate state file is sitting at '
                + statePath + ', so the gate is recording nothing; move it aside by hand '
                + '(a delete cannot remove it)\n');
        } else {
            emitOut('the compaction gate state file cannot be read right now, so the gate '
                + 'is recording nothing while that lasts; try again once whatever holds it lets go\n');
        }
        return;
    }
    const state = result.state;
    const last = state && state.lastDecision;
    if (!last) {
        emitOut('the compaction gate has recorded no decisions in this project\n');
    } else {
        // File-derived values print indented, never at column zero (see cmdOpen).
        let line = '  last compaction gate decision: ' + sanitize(last.verdict);
        if (last.reason) line += ' (' + sanitize(last.reason) + ')';
        // Clamped exactly as episodePhrase clamps its own two integers: `at`
        // comes out of a file anyone can write, and an unclamped one renders a
        // twelve-digit minute count on a surface a model reads.
        const age = gateCount(wholeMinutesSince(last.at));
        if (age !== null) line += ', ' + age + (age === 1 ? ' minute ago' : ' minutes ago');
        emitOut(line + '\n');
    }

    const phrase = episodePhrase(gateEpisodeOpen(state));
    emitOut(phrase === null
        ? 'no deferral episode is open\n'
        : '  the compaction gate has ' + phrase + ' since this deferral episode opened\n');
}

// The deferral nudge's hold stamps, reported only when the file is refusing the
// writer, which is the one thing about it an operator can neither see nor infer
// from anywhere else.
//
// The stamp file is that nudge's clock for a held session that owns no episode,
// and the directive is emitted only when the stamp lands, so a file the writer
// refuses is a session being held and never spoken to. Two of the five refusals
// end by themselves, since the next directive removes a file this writer cannot
// have produced (an oversized one, or a link at the path) and rebuilds it. The
// other three do not: a refused open, an lstat that could not answer, and a read
// that ended short of the file all leave the path exactly as it was, over
// contents that may be a real list of live stamps. They are worded apart on
// reportCheckpoint's
// rule, that a leg drawing destructive advice or promising self-repair must be
// one where that is true, and the promise of a replacement therefore rides
// membership in the library's own healable set rather than a reading's name.
//
// Two of those three are stated as of now rather than as a standing shape, and
// deliberately without a claim either way: a lock or a scanner lifts on its own,
// while something that is not a regular file at the path never does, and this
// report cannot tell them apart, since the reader answers both with the same
// refused open. So the line names the path to look at rather than promising the
// wait ends, which is what keeps it from telling an operator to wait out a
// directory.
//
// A reading that stands prints nothing, which is where this parts from the two
// reports above. What they answer is whether a checkpoint or an episode is in
// effect, which is a state an operator asks about; the stamps answer only when
// each held session was last spoken to, which is the nudge's own bookkeeping and
// carries session ids this report has no reason to put on a terminal.
//
// The reason comes from the reader's own refusal rather than from a second
// syscall here, for the reason reportGateState states: an lstat asked afterwards
// cannot see the leg where the READ was refused, so the two would be reported as
// one. The path is composed rather than written out, since a project inside the
// memory store keeps these files outside the project (kitScratchDir), and it
// rides this file's display guard on the way out; it is the only value
// interpolated, the five reasons being this library's own fixed words with
// nothing file-derived reaching the line.
//
// WHICH readings promise a replacement is not decided here. That authority is
// the library's HOLD_NUDGE_HEALABLE, the same list the writer heals by, so the
// two sides cannot come to disagree about one file: a reason added there gains
// the promise on this surface in the same edit, and one removed loses it.
// Spelling the reason names again here is what would let the writer start
// healing a file this verb still describes as standing.
function reportHoldStamps(cwd) {
    const result = readHoldNudgesResult(cwd, Date.now());
    if (result.ok) return;
    const stampPath = displayPath(holdNudgePath(cwd));

    // What was read, worded per reading, since the legs name different things
    // about the same path. The per-reason wordings below are genuinely
    // per-reason and are spelled by name for that reason. What is NOT decided by
    // name is the healable-versus-refusing split: the fallback that catches a
    // reading with no wording of its own forks on the same HOLD_NUDGE_HEALABLE
    // membership the remedy below rides, so a sixth healable reason added to the
    // library's set cannot land on the refusing wording and print "cannot be
    // read" beside a promise that the next directive replaces it. That
    // self-contradicting pair is exactly what spelling the set's members again
    // on this side would produce.
    let lead;
    if (result.reason === 'oversized') {
        lead = 'the deferral nudge\'s hold stamps at ' + stampPath
            + ' are past the size the reader accepts';
    } else if (result.reason === 'kind') {
        lead = 'something that is not the deferral nudge\'s hold stamp file is sitting at ' + stampPath;
    } else if (result.reason === 'short-fill') {
        // The reading that ended short of the file. Nothing here identifies the
        // file as one the nudge did not write, so nothing removes it.
        lead = 'the read of the deferral nudge\'s hold stamps at ' + stampPath + ' ended short of the file';
    } else if (HOLD_NUDGE_HEALABLE.includes(result.reason)) {
        // A healable reading with no wording of its own: the set says the writer
        // identified this file as one it could not have produced and removes it,
        // so the line says that much and leaves the shape unnamed rather than
        // borrowing the refusing leg's claim that nothing can be told about the
        // path. Nothing reaches this branch today, the set's two members both
        // having their own wording above; it is what a sixth member lands on.
        lead = 'the deferral nudge\'s hold stamp file at ' + stampPath
            + ' is not one that writer produced';
    } else {
        // 'unreadable' and 'lstat' together: both may be a lock over a file
        // holding live stamps, and both may equally be a directory or another
        // shape at the path that never lifts, so this leg claims nothing about
        // what is there. What the operator can act on is the path, which is
        // named.
        //
        // One shape lands here that the writer does in fact remove: a FIFO or a
        // socket, which the reader refuses on the descriptor and cannot tell
        // from a lock, while the writer's own lstat calls it a kind it unlinks.
        // readHoldNudgesResult states why the two sides are asked differently.
        // What that costs is bounded to this line being weaker than the truth
        // for those kinds rather than wrong about them, since it promises
        // neither a repair nor an end to the wait.
        lead = 'the deferral nudge\'s hold stamp file at ' + stampPath + ' cannot be read';
    }

    // What happens next, decided by membership in the healable set rather than
    // by the reason's name. The promise is CONDITIONAL because the repair it
    // names is: the heal is an unlink, which takes permission on the scratch
    // directory itself, so under a read-only .kit/ the next directive refuses
    // and the file stands. An unconditional promise there tells an operator to
    // wait out a replacement that never comes, which is the same failure the
    // refusing legs are worded to avoid.
    const remedy = HOLD_NUDGE_HEALABLE.includes(result.reason)
        ? 'the next hold directive replaces it, so long as the directory holding it is writable'
        : (result.reason === 'short-fill'
            ? 'the stamps are left as they are and a read that completes takes them again'
            : 'a lock or a scanner over it clears on its own, while anything else standing at '
                + 'that path does not');

    emitOut(lead + ', so a held session cannot be stamped and its directive stays '
        + 'silent; ' + remedy + '\n');
}

// Every role-boundary declaration open in this project, one line each. The
// question this report answers is what is open HERE rather than what is open
// for whoever is running it: an operator at a shell carries no session id, and a
// seat reading its own status is one of possibly several seats holding this
// checkout. So the sessions come from the files present rather than from the
// caller, and each is judged for the session it names, which is reportMarker's
// own rule.
//
// A directory that could not be listed is not an empty one, and saying so is
// what keeps the none-open line honest: with the listing refused, this report
// knows nothing about what is open here. The refusal is reported in the class
// the reader gives it, since a determinate one (something that is not a
// directory parked at the scratch path) is a state an operator has to act on,
// where a transient one is one to re-ask. A listing that was cut short is
// neither: what it found is reported and the report says it is partial, rather
// than a truncated set standing in for the whole picture.
//
// Each marker is judged against the session its own file name carries, which is
// what lets a file recording a different session be reported as one the gate
// cannot reach rather than as that session's live release.
function reportRoleBoundaryMarkers(cwd) {
    const listed = roleBoundarySessionsResult(cwd);
    if (!listed.ok) {
        emitOut('the scratch directory holding the role-boundary markers ' + (listed.reason === 'determinate'
            ? 'is not a directory that can be listed, so whether any marker is open here cannot be '
                + 'established; move aside whatever is standing at that path'
            : 'cannot be listed right now, so whether any is open here cannot be established')
            + '\n');
        return;
    }
    if (listed.sessions.length === 0 && !listed.bounded) {
        reportMarker({ ok: true, marker: null, reason: 'absent' }, 'role-boundary', 'open',
            ROLE_BOUNDARY_MAX_AGE_MS, BOUNDARY_HOURS + '-hour', cwd, null);
        return;
    }
    for (const session of listed.sessions) {
        reportMarker(readRoleBoundaryResult(cwd, session), 'role-boundary', 'open',
            ROLE_BOUNDARY_MAX_AGE_MS, BOUNDARY_HOURS + '-hour', cwd, session);
    }
    if (listed.bounded) {
        emitOut('that listing of the role-boundary markers was cut short by this tool\'s own '
            + 'per-call cap, so there may be more open here than the lines above\n');
    }
}

function cmdStatus() {
    const cwd = process.cwd();
    reportCheckpoint(cwd);
    reportRoleBoundaryMarkers(cwd);
    reportMarker(readConsentResult(cwd), 'operator-consent', 'present',
        CONSENT_MAX_AGE_MS, CONSENT_HOURS + '-hour', null, null);
    reportGateState(cwd);
    reportHoldStamps(cwd);
    process.exitCode = 0;
}

function main() {
    const [cmd] = process.argv.slice(2);
    if (cmd === 'open') cmdOpen();
    else if (cmd === 'clear') cmdClear();
    else if (cmd === 'status') cmdStatus();
    else if (cmd === 'boundary') cmdBoundary(process.argv.slice(3));
    else if (cmd === 'consent') cmdConsent(process.argv.slice(3));
    else usage();
}

// Wrapped so an unexpected defect prints one elided line and a nonzero exit
// instead of a stack trace, the guard kit-goal.js carries at the same place and
// for a reason that is stronger here: this CLI's output is echoed into a
// session's context, and an uncaught throw writes Node's own trace to stderr
// carrying the full module path of every file on the require stack, which is
// home-anchored on an installed plugin. That write is the runtime's rather than
// this file's, so it is a leg both the emitters' floor and the source-side pin
// are blind to; catching here is what puts it back on the channel.
//
// The kit-library loading is INSIDE the region for that reason: a require is the
// throw most likely to produce that trace, a damaged plugin cache being its
// ordinary cause. What remains outside is this file's own module-scope
// evaluation and the two Node built-in requires above it, neither of which
// carries a plugin path or reads anything off disk.
try {
    loadKitLibraries();
    main();
} catch (err) {
    emitErr('kit-compact-checkpoint: ' + sanitize(err && err.message ? err.message : String(err)) + '\n');
    process.exitCode = 1;
}
