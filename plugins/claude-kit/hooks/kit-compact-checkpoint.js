#!/usr/bin/env node
// CLI entry for the boundary-compaction checkpoint and the release markers.
//
// Subcommands:
//   kit-compact-checkpoint.js open      open a checkpoint for the armed plan
//   kit-compact-checkpoint.js clear     remove any open checkpoint
//   kit-compact-checkpoint.js status    report the checkpoint, the release
//                                       markers, and the gate state
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
const { readGoal, recordExecutionTree, sessionHoldsLeash } = require('./kit-goal-lib.js');
const {
    readCheckpointResult, writeCheckpoint, clearCheckpoint, checkpointMatches,
    checkpointAdoptable, storableCheckpointOwner,
    readGateStateResult, gateStatePath, gateEpisodeOpen, pendingOfferCorroborated, checkpointOwner,
    episodePhrase, wholeMinutesSince, gateCount,
    CHECKPOINT_MAX_AGE_MS, CHECKPOINT_PENDING_MAX_AGE_MS,
    readRoleBoundaryResult, readConsentResult, writeRoleBoundary, writeConsent,
    clearRoleBoundary, sameSessionId,
    markerMatches, markerMomentHolds, markerDeclaresMoment, stampRegistryBanked,
    projectHoldsSessionTranscript, sessionTranscriptPath, usableSessionId,
    ROLE_BOUNDARY_MAX_AGE_MS, CONSENT_MAX_AGE_MS
} = require('./kit-compact-lib.js');

// The two age bounds as an operator reads them, derived from the constants
// rather than written out so a sentence here cannot drift from the rule it
// describes. The rounding is exact only while the constants stay whole minutes
// and whole hours respectively: a 90-minute pending bound would print as "2
// hours" against a rule enforcing one and a half, so a change to either
// constant that leaves whole units is what keeps these honest.
const ORDINARY_MINUTES = Math.round(CHECKPOINT_MAX_AGE_MS / (60 * 1000));
const PENDING_HOURS = Math.round(CHECKPOINT_PENDING_MAX_AGE_MS / (60 * 60 * 1000));

// The marker age bounds as an operator reads them, on the same derive-or-drift
// rule as the two above, with the same whole-unit caveat. Both render in hours
// because both bounds are the same quantity: rendering one of them in minutes
// would print two different-looking figures for one window in a single
// `status` report, which reads as two rules rather than one.
const BOUNDARY_HOURS = Math.round(ROLE_BOUNDARY_MAX_AGE_MS / (60 * 60 * 1000));
const CONSENT_HOURS = Math.round(CONSENT_MAX_AGE_MS / (60 * 60 * 1000));

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

// Repo-controlled strings (a plan path, a timestamp read back from disk) are
// sanitized to printable ASCII and length-capped before they reach
// stdout/stderr, matching the sibling hooks' convention for any repo data
// entering a trusted output channel.
function sanitize(s) {
    return String(s).replace(/[^\x20-\x7E]/g, '').slice(0, 120);
}

// A filesystem path for the operator's eye. Two things a bare sanitize does
// wrong to one. The home prefix is elided to `~`, because the OS account name
// is in it and this output is read by a model; and a path the cap would cut is
// marked as cut, because a silently shortened path reads as the whole name of
// the file that answered. Eliding is what keeps a realistic path inside the
// cap, so the mark is the rare case rather than the ordinary one.
function displayPath(full) {
    const text = String(full);
    let home = '';
    try { home = os.homedir(); } catch { home = ''; }
    const shown = (home !== '' && text.startsWith(home)) ? '~' + text.slice(home.length) : text;
    return sanitize(shown) + (shown.length > 120 ? ' [path cut to fit]' : '');
}

function usage() {
    process.stderr.write('usage: kit-compact-checkpoint.js open | clear | status'
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
        process.stderr.write('kit-compact-checkpoint: no kit goal is armed, so a checkpoint would never match; nothing written\n');
        // The goal family resolves its state from the current directory, and a
        // linked worktree is a directory of its own, so a goal armed in
        // another checkout or another worktree of this repository is invisible
        // here however live it is. Naming that makes the refusal
        // self-explaining, since from such a tree the goal looks armed and
        // this looks like a defect.
        process.stderr.write('kit-compact-checkpoint: the goal may be armed in another checkout: this CLI reads'
            + ' the goal state from the current directory (a linked worktree holds its own), so arm'
            + ' where you run\n');
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
        process.stdout.write('  compact checkpoint open for ' + sanitize(result.plan)
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
            process.stdout.write('the compaction gate state could not be read, so this checkpoint records no'
                + ' pending offer and keeps the ' + ORDINARY_MINUTES + '-minute bound\n');
        }
        // The goal state's executionTree record, kept as this call for the
        // checkpoint boundary that would own it. It records nothing: goal
        // state is co-located with the tree that holds it, so the tree a
        // boundary is opened from is always the tree whose state it would be
        // written to, which is the one case the field was never for
        // (kit-goal-lib.js's recordExecutionTree states the whole contract,
        // and this is its one call site). The call is best-effort and
        // display-trust only either way, so nothing here can cost the
        // checkpoint just opened.
        recordExecutionTree(process.cwd());
        process.exitCode = 0;
    } else {
        process.stderr.write('kit-compact-checkpoint: ' + sanitize(result.reason) + '\n');
        process.exitCode = 1;
    }
}

// Open the role-boundary marker for the calling session: the goalless seats'
// analogue of `open`. The marker is scoped by session rather than by plan, so
// no armed goal is required and the no-goal refusal above stays the leashed
// mode's alone. The refusal here is loud and names the variable, because the
// alternative, an unscoped marker whichever session's offer arrived first
// would consume, is the one shape the design forbids.
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
        process.stderr.write('usage: kit-compact-checkpoint.js boundary [--cancel] (no other arguments:'
            + ' the marker is scoped to the calling session; consent is the mode that takes'
            + ' --session)\n');
        process.exitCode = 1;
        return;
    }
    const session = callerSessionId();
    if (session === null) {
        process.stderr.write('kit-compact-checkpoint: no usable session id in this shell'
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
            process.stderr.write('kit-compact-checkpoint: the registry entry for this session id names a'
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
        process.stdout.write('  role-boundary marker open for session ' + sanitize(session)
            + ' (that session\'s next deferred auto-compaction lands at this boundary,'
            + ' until a new turn begins there; it ages out in ' + BOUNDARY_HOURS + ' hours)\n');
        // A declaration the gate cannot position is one it will never honor, so
        // it is said here rather than left to look like a marker that works.
        // The ordinary cause is a run from a directory this session's own
        // transcript is not filed under, which is the same working-directory
        // mistake the marker's own path can make.
        if (result.positioned === false) {
            process.stderr.write('kit-compact-checkpoint: no transcript for this session could be measured'
                + ' from this directory, so the gate has nothing to read the moment against and will'
                + ' treat this marker as lapsed; run the verb from the session\'s own project directory\n');
        }
        process.exitCode = 0;
    } else {
        process.stderr.write('kit-compact-checkpoint: ' + sanitize(result.reason) + '\n');
        process.exitCode = 1;
    }
}

// Retract this session's own declaration. The marker file is per project
// directory and names one session, so the scope is read before anything is
// removed: a marker naming another session is that session's declaration and
// is left standing, exactly as the gate leaves one it does not match. Nothing
// in the design depends on this being run, the moment rule above retiring a
// marker that outlived its lull with no act from anyone; this is the explicit
// retraction, for an operator at a shell and for a session withdrawing a
// declaration it has just made.
//
// A marker whose owner cannot be read is not removed either, and it is the
// leg worth stating: an illegible or oversized file reads as no marker at all,
// so a clear that ran on it would delete whatever a peer had written there and
// report it as this session's own retraction. The scope guard can only protect
// a scope it can see, so where it cannot see one the answer is to leave the
// file alone and say what is there.
function cancelBoundary(session) {
    const read = readRoleBoundaryResult(process.cwd());
    const marker = read.marker;
    if (marker === null && read.reason !== 'absent') {
        process.stderr.write('kit-compact-checkpoint: a role-boundary marker file is present here that'
            + ' cannot be read (' + sanitize(read.reason) + '), so whose declaration it is cannot be'
            + ' established and it is left in place; move it aside by hand (nothing was retracted)\n');
        process.exitCode = 1;
        return;
    }
    if (marker !== null && typeof marker.session !== 'string') {
        process.stderr.write('kit-compact-checkpoint: the role-boundary marker file here names no session,'
            + ' so whose declaration it is cannot be established and it is left in place; the next'
            + ' boundary write replaces it (nothing was retracted)\n');
        process.exitCode = 1;
        return;
    }
    if (marker && typeof marker.session === 'string' && !sameSessionId(marker.session, session)) {
        process.stdout.write('  a role-boundary marker for session ' + sanitize(marker.session)
            + ' is open here and is left in place: this session declared no boundary to retract\n');
        process.exitCode = 0;
        return;
    }
    const result = clearRoleBoundary(process.cwd());
    if (!result.ok) {
        // Nothing was removed, so this must not read as a successful retraction,
        // and what is left behind is not asserted: cmdClear's own wording at the
        // same leg of the same question.
        process.stderr.write('kit-compact-checkpoint: ' + sanitize(result.reason)
            + ' (nothing was retracted)\n');
        process.exitCode = 1;
        return;
    }
    process.stdout.write((result.cleared
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
            process.stderr.write('usage: kit-compact-checkpoint.js consent'
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
            process.stderr.write('kit-compact-checkpoint: no usable session id in this shell'
                + ' (CLAUDE_CODE_SESSION_ID is unset or not id-shaped); name one with'
                + ' --session <id>; nothing written\n');
            process.exitCode = 1;
            return;
        }
    } else {
        session = usableSessionId(flags['--session']);
        if (session === null) {
            process.stderr.write('kit-compact-checkpoint: --session needs one value that starts'
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
        process.stderr.write('kit-compact-checkpoint: no transcript for session '
            + sanitize(session) + ' under the project at ' + sanitize(target)
            + ', so a marker written there would never be read; check the path and the'
            + ' session id; nothing written\n');
        process.exitCode = 1;
        return;
    }
    const result = writeConsent(target, session);
    if (result.ok) {
        process.stdout.write('  operator-consent marker recorded for session ' + sanitize(session)
            + ' (releases that session\'s next deferred auto-compaction once, within '
            + CONSENT_HOURS + ' hours)\n');
        process.exitCode = 0;
    } else {
        process.stderr.write('kit-compact-checkpoint: ' + sanitize(result.reason) + '\n');
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
        process.stderr.write('kit-compact-checkpoint: ' + sanitize(result.reason) + ' (nothing was cleared)\n');
        process.exitCode = 1;
        return;
    }
    process.stdout.write((result.cleared ? 'compact checkpoint cleared' : 'no compact checkpoint was open') + '\n');
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
            process.stdout.write('an illegible checkpoint file is present (the gate treats it as absent); clear removes it\n');
        } else if (reason === 'oversized') {
            // A regular file, so clear unlinks it, and past the read cap, so it
            // never becomes legible on its own.
            process.stdout.write('a checkpoint file past the size the reader accepts is present '
                + '(the gate treats it as absent); clear removes it\n');
        } else if (reason === 'kind') {
            process.stdout.write('something that is not a checkpoint file is sitting at the checkpoint path '
                + '(the gate treats it as absent); clear cannot remove it, so move it aside by hand\n');
        } else if (reason === 'unreadable' || reason === 'lstat') {
            // Scoped to now: a lock lifts, and a checkpoint the gate ignores this
            // second can be the one it honors the next. Saying none is in effect
            // either way would be the same false absence this report exists to
            // stop printing, and naming a remedy over it would name one that
            // fails for the reason the read already failed.
            process.stdout.write('the checkpoint path cannot be read right now, so the gate treats '
                + 'it as absent while that lasts\n');
        } else {
            process.stdout.write('no compact checkpoint is open\n');
        }
        return;
    }
    // File-derived values print indented, never at column zero (see cmdOpen).
    // A missing openedAt is stated as missing rather than stringified (the
    // literal "undefined" would read as a value the file carries).
    let line = '  compact checkpoint open for ' + sanitize(cp.plan);
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
    process.stdout.write(line + '\n');
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

// One marker kind's half of the status report, mirroring reportCheckpoint's
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
// operator can judge the scoping half themselves.
//
// `momentCwd` is the project directory the moment rule is read at, passed for
// the marker kind that can carry a declaration (a role-boundary marker) and
// null for the one that cannot (a consent is the operator's word rather than a
// seat's moment). Within that kind the rule still applies only to the boundary
// verb's declared marker, which markerDeclaresMoment decides. A marker the
// moment rule has retired is reported as lapsed rather than as live: it is
// still on disk, the gate ignores it, and its age bound is what eventually
// removes it, which is exactly the state an operator has no other way to see.
function reportMarker(read, label, verb, maxAgeMs, boundPhrase, momentCwd) {
    const marker = read.marker;
    if (!marker || typeof marker !== 'object' || Array.isArray(marker)
        || typeof marker.session !== 'string') {
        const reason = marker === null ? read.reason : 'illegible';
        if (reason === 'illegible') {
            process.stdout.write('an illegible ' + label + ' marker file is present '
                + '(the gate treats it as absent); the next ' + label + ' write replaces it\n');
        } else if (reason === 'oversized') {
            process.stdout.write('a ' + label + ' marker file past the size the reader accepts '
                + 'is present (the gate treats it as absent); the next ' + label + ' write replaces it\n');
        } else if (reason === 'kind') {
            process.stdout.write('something that is not a ' + label + ' marker file is sitting '
                + 'at its path (the gate treats it as absent); move it aside by hand\n');
        } else if (reason === 'unreadable' || reason === 'lstat') {
            // Scoped to now, exactly as reportCheckpoint scopes its own lock
            // leg: a lock lifts, and absence must not be asserted over it.
            process.stdout.write('the ' + label + ' marker path cannot be read right now, '
                + 'so the gate treats it as absent while that lasts\n');
        } else {
            process.stdout.write('no ' + label + ' marker is ' + verb + '\n');
        }
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
    process.stdout.write(line + '\n');
    // Which transcript answered the moment question, named rather than left to
    // be assumed. This report derives the path from the directory it is run in;
    // the gate reads the path its own PreCompact payload carries. The two are
    // the same file for a session working the directory this report is run
    // from, and a session that is not makes them differ, so a verdict here that
    // disagrees with the gate's is readable as the different subject it is
    // rather than as a contradiction.
    if (reads) {
        process.stdout.write('    moment read against ' + (transcript === null
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
        // inspect a file that is not there.
        const statePath = gateStatePath(cwd);
        if (result.reason === 'oversized') {
            // Worded as reportCheckpoint words its own oversized leg: the file
            // is legible and was refused on size, which is not the same fact as
            // a read that failed, and one refusal answered two ways is what the
            // shared-spelling rule exists to stop.
            process.stdout.write('a compaction gate state file past the size the reader accepts is present, '
                + 'so the gate is recording nothing; removing ' + statePath + ' lets the next '
                + 'decision rebuild it\n');
        } else if (result.reason === 'kind') {
            process.stdout.write('something that is not the gate state file is sitting at '
                + statePath + ', so the gate is recording nothing; move it aside by hand '
                + '(a delete cannot remove it)\n');
        } else {
            process.stdout.write('the compaction gate state file cannot be read right now, so the gate '
                + 'is recording nothing while that lasts; try again once whatever holds it lets go\n');
        }
        return;
    }
    const state = result.state;
    const last = state && state.lastDecision;
    if (!last) {
        process.stdout.write('the compaction gate has recorded no decisions in this project\n');
    } else {
        // File-derived values print indented, never at column zero (see cmdOpen).
        let line = '  last compaction gate decision: ' + sanitize(last.verdict);
        if (last.reason) line += ' (' + sanitize(last.reason) + ')';
        // Clamped exactly as episodePhrase clamps its own two integers: `at`
        // comes out of a file anyone can write, and an unclamped one renders a
        // twelve-digit minute count on a surface a model reads.
        const age = gateCount(wholeMinutesSince(last.at));
        if (age !== null) line += ', ' + age + (age === 1 ? ' minute ago' : ' minutes ago');
        process.stdout.write(line + '\n');
    }

    const phrase = episodePhrase(gateEpisodeOpen(state));
    process.stdout.write(phrase === null
        ? 'no deferral episode is open\n'
        : '  the compaction gate has ' + phrase + ' since this deferral episode opened\n');
}

function cmdStatus() {
    const cwd = process.cwd();
    reportCheckpoint(cwd);
    reportMarker(readRoleBoundaryResult(cwd), 'role-boundary', 'open',
        ROLE_BOUNDARY_MAX_AGE_MS, BOUNDARY_HOURS + '-hour', cwd);
    reportMarker(readConsentResult(cwd), 'operator-consent', 'present',
        CONSENT_MAX_AGE_MS, CONSENT_HOURS + '-hour', null);
    reportGateState(cwd);
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

main();
