#!/usr/bin/env node
// CLI entry for the boundary-compaction checkpoint and the release markers.
//
// Subcommands:
//   kit-compact-checkpoint.js open      open a checkpoint for the armed plan
//   kit-compact-checkpoint.js clear     remove any open checkpoint
//   kit-compact-checkpoint.js status    report the checkpoint, the release
//                                       markers, and the gate state
//   kit-compact-checkpoint.js boundary  open the role-boundary marker for the
//                                       calling session (no goal required)
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
// subcommand is the fallback for a seat the machine's session registry does
// not carry, and it writes the same file the hook does. `consent`
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

const { readGoal, recordExecutionTree, sessionHoldsLeash } = require('./kit-goal-lib.js');
const {
    readCheckpointResult, writeCheckpoint, clearCheckpoint, checkpointMatches,
    checkpointAdoptable, storableCheckpointOwner,
    readGateStateResult, gateStatePath, gateEpisodeOpen, pendingOfferCorroborated, checkpointOwner,
    episodePhrase, wholeMinutesSince, gateCount,
    CHECKPOINT_MAX_AGE_MS, CHECKPOINT_PENDING_MAX_AGE_MS,
    readRoleBoundaryResult, readConsentResult, writeRoleBoundary, writeConsent,
    markerMatches, projectHoldsSessionTranscript, usableSessionId,
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

function usage() {
    process.stderr.write('usage: kit-compact-checkpoint.js open | clear | status | boundary'
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
        // The goal family resolves its state from the current directory, with
        // a linked worktree resolving to its main checkout, so a goal armed in
        // a checkout this directory does not resolve to (a separate clone, a
        // worktree of a bare repository, or a worktree whose .git pointer no
        // longer closes the handshake, which the lib notes on stderr) is
        // invisible here however live it is. Naming that makes the refusal
        // self-explaining, since from such a tree the goal looks armed and
        // this looks like a defect.
        process.stderr.write('kit-compact-checkpoint: the goal may be armed in another checkout: this CLI reads'
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
    // never asked for. The boundary marker is the calling session's own
    // declaration, so this mode takes no arguments at all.
    if (rest.length !== 0) {
        process.stderr.write('usage: kit-compact-checkpoint.js boundary (no arguments: the marker is'
            + ' scoped to the calling session; consent is the mode that takes --session)\n');
        process.exitCode = 1;
        return;
    }
    const session = callerSessionId();
    if (session === null) {
        process.stderr.write('kit-compact-checkpoint: no usable session id in this shell'
            + ' (CLAUDE_CODE_SESSION_ID is unset or not id-shaped), so a session-scoped'
            + ' marker cannot be written; nothing written\n');
        process.exitCode = 1;
        return;
    }
    const result = writeRoleBoundary(process.cwd(), session);
    if (result.ok) {
        // Environment-derived values print indented and sanitized, the same
        // handling cmdOpen gives the plan path; the duration comes from the
        // constant, so the sentence cannot promise what the rule does not do.
        process.stdout.write('  role-boundary marker open for session ' + sanitize(session)
            + ' (that session\'s next deferred auto-compaction lands at this boundary;'
            + ' it ages out in ' + BOUNDARY_HOURS + ' hours)\n');
        process.exitCode = 0;
    } else {
        process.stderr.write('kit-compact-checkpoint: ' + sanitize(result.reason) + '\n');
        process.exitCode = 1;
    }
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
function reportMarker(read, label, verb, maxAgeMs, boundPhrase) {
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
    if (!verdict.ok) {
        line += ' - ' + (verdict.reason === 'expired'
            ? 'expired (past the ' + boundPhrase + ' bound), so the gate treats it as absent'
            : (MARKER_DEAD_REASONS[verdict.reason] || 'the gate treats it as absent'));
    } else {
        line += ' - the gate honors it once for that session\'s next deferred auto-compaction, '
            + 'within the ' + boundPhrase + ' bound';
    }
    process.stdout.write(line + '\n');
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
        ROLE_BOUNDARY_MAX_AGE_MS, BOUNDARY_HOURS + '-hour');
    reportMarker(readConsentResult(cwd), 'operator-consent', 'present',
        CONSENT_MAX_AGE_MS, CONSENT_HOURS + '-hour');
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
