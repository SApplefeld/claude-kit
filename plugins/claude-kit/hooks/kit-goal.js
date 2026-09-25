#!/usr/bin/env node
// CLI entry for the kit-native goal continuity mechanism.
//
// Subcommands:
//   kit-goal.js arm <planPath>...  arm a goal against one plan doc or an
//                                  ordered queue of them, replacing whatever
//                                  was armed before and naming on stderr any
//                                  plans that replacement takes off the leash
//   kit-goal.js arm --append <planPath>...
//                                  add plans to the end of the armed queue,
//                                  under the binding it already carries
//   kit-goal.js arm --here <planPath>...
//                                  arm the directory this shell stands in even
//                                  where the session's transcript records
//                                  another as the session's working directory
//   kit-goal.js clear              clear any armed goal
//   kit-goal.js status             report whether a goal is armed
//
// Invoked by the /kit-goal skill. Goal-state work is delegated to
// kit-goal-lib.js, which takes the binding as an argument; this file reads the
// session-id variable, plus argument parsing and output formatting. It is not
// the variable's only reader: the compaction checkpoint CLI's release verbs
// read it too, to name the session a release marker is scoped to, and they
// gate it on shape alone where this file also corroborates it against a real
// transcript before binding anything.
//
// A leash is armed only by the operator's typed /kit-goal in this session. So
// arm, bare and --append alike, runs a gate before anything is written: it
// reads the calling session's own transcript, located from
// CLAUDE_CODE_SESSION_ID under ~/.claude/projects, and proceeds only where a
// user entry the operator typed there invokes /kit-goal naming every plan the
// arm names (armGate states the matching rule). A missing session id, a
// transcript that cannot be located or read, or a plan no typed /kit-goal
// names refuses with exit 1, one line naming the cause and the rule, and no
// write. The variable is undocumented, so it can change shape or vanish
// upstream without notice, and an arm then refuses rather than arming unbound.
//
// A bare arm that passes the gate binds the goal to this session at arm time,
// because the gate has already corroborated the id against a transcript file
// on this machine, which is the second key the bind requires (kit-goal-lib.js's
// SESSION_ID_SHAPE states why both are). The arm reports the binding either
// way, because an armed-but-unbound goal is otherwise silent.

'use strict';

const fs = require('fs');
const path = require('path');

// The kit libraries are bound inside the guarded region at the bottom of this
// file rather than at module scope, so a require that throws prints one elided
// line instead of Node's own trace: every module path on a `Require stack:` is
// home-anchored on an installed plugin, and this CLI's output is echoed into a
// session's context.
let armGoal, appendGoal, clearGoal, readGoal, planStatusReadings, lastActivePhrase,
    findTranscript, sessionDirectoryCheck, normalizePlanArg, userCommandArgTexts,
    goalPathKind, planPathState, planArmedBy, queuePosition,
    GOAL_STATE_MAX_BYTES, AUTHORIZATION_MAX_CHARS, QUEUE_LINE_BOUND;

// Repo-controlled strings (a plan path) are sanitized before they reach
// stdout/stderr, matching the sibling hooks' convention for any repo data
// entering a trusted output channel. It is the shared library's renderer under
// this file's own name: the refusal reasons this CLI prints embed absolute plan
// paths, so the channel's home elision is what keeps the OS account name out of
// them, and the library's cap of 120 is the cap this file already used. A
// recorded authorization sentence is prose that runs past that cap, so it takes
// the same renderer at the cap the store screened it under
// (AUTHORIZATION_MAX_CHARS): one renderer for everything this file prints, and
// the sentence still reaches the reader whole.
let sanitize;

function loadKitLibraries() {
    ({
        armGoal, appendGoal, clearGoal, readGoal, planStatusReadings, lastActivePhrase,
        findTranscript, sessionDirectoryCheck, normalizePlanArg, goalPathKind, planPathState,
        planArmedBy, queuePosition, GOAL_STATE_MAX_BYTES, AUTHORIZATION_MAX_CHARS, QUEUE_LINE_BOUND
    } = require('./kit-goal-lib.js'));
    ({ sanitizeForOutput: sanitize, userCommandArgTexts } = require('./kit-compact-lib.js'));
}

function usage() {
    process.stderr.write('usage: kit-goal.js arm [--append] [--here] <planPath>... | clear | status\n');
    process.exitCode = 1;
}

// The rule every arm refusal names, worded once.
const ARM_RULE = "a leash is armed only by the operator's typed /kit-goal in this session";

// The build identity of the plugin this CLI is running from. The build stamps
// its short git hash into `.claude-plugin/build-info.json` under the plugin
// root, which is the one surface that carries a version at all: the root is
// CLAUDE_PLUGIN_ROOT where the host provides it, else this file's own parent
// directory. kit-version-nudge.js's installedBuildInfo() reads the same stamp
// for the session-restart nudge; this is a second reader of the file rather
// than a shared helper, since that hook exports nothing.
//
// The fallback is the root's own directory name, taken only when it is
// sha-shaped, which is what the installed cache layout spells
// (...<separator>claude-kit<separator><commit-sha>). Any other basename is a
// directory name and not a build identity (a dev checkout and a marketplace
// clone both spell it `claude-kit`), so it yields 'unknown' rather than being
// printed as a version. Either way the refusal still names the token itself.
function pluginVersion() {
    const root = process.env.CLAUDE_PLUGIN_ROOT || path.join(__dirname, '..');
    try {
        // Strip a leading BOM: a UTF-8-with-BOM stamp would otherwise fail JSON.parse.
        const stamp = JSON.parse(
            fs.readFileSync(path.join(root, '.claude-plugin', 'build-info.json'), 'utf8')
                .replace(/^\uFEFF/, '')
        );
        if (stamp && typeof stamp.hash === 'string' && stamp.hash) return stamp.hash;
    } catch { /* unstamped or unreadable: fall back to the root's own name */ }
    const base = path.basename(root);
    return /^[0-9a-f]{7,40}$/.test(base) ? base : 'unknown';
}

// A leading-dash token on an arm invocation that is not a recognized flag. It
// is refused here rather than passed to armGoal as a plan argument, which
// would answer a misleading "plan not found" for what is actually an
// unrecognized flag, most often an older CLI running a build without the flag
// a newer session expects. Naming the CLI's own build identity is what makes
// that case self-diagnosing.
//
// --self-armed is refused here as one such token, and its line adds the rule,
// because it is the flag a run once used to arm a leash for itself and the
// rule is what replaced it.
function usageBadArmFlag(token) {
    process.stderr.write('kit-goal: unrecognized flag ' + sanitize(token)
        + ' (kit-goal.js version ' + sanitize(pluginVersion()) + ')'
        + (token === '--self-armed' ? '; ' + ARM_RULE + ', and no run arms one for itself' : '')
        + '\n');
    usage();
}

// Whether an arm may write state under this shell's directory, answered from
// the session's own transcript. An arm writes under process.cwd(), while the
// Stop hook and the compaction gate read state under the directory the harness
// payload names, which is the session's working directory; an arm from any
// other directory therefore binds a leash no hook ever reads. The newest `cwd`
// the transcript records is that directory (sessionDirectoryCheck owns the read
// and the comparison), so a mismatch refuses and names both, and --here is the
// override for the case where this directory is meant.
//
// Where the session's directory cannot be read, no transcript located or no
// usable `cwd` in its tail, the arm goes ahead and one line says the directory
// was not checked, so a pass is never mistaken for a match.
function armDirectoryAllowed(transcriptPath) {
    const cwd = process.cwd();
    const check = sessionDirectoryCheck(transcriptPath, cwd);
    if (!check.checked) {
        process.stderr.write('kit-goal: the session\'s working directory could not be read from its'
            + ' transcript, so this arm\'s directory was not checked against it\n');
        return true;
    }
    if (check.same) return true;
    process.stderr.write('kit-goal: this shell is in ' + sanitize(cwd) + ', but the session works in '
        + sanitize(check.sessionCwd) + ' (the newest working directory its transcript records), and'
        + ' the goal hooks read state under the session\'s directory, so a leash armed here would'
        + ' never be read; nothing armed (arm from the session\'s directory, or pass --here to arm'
        + ' this one deliberately)\n');
    process.exitCode = 1;
    return false;
}

// Add plans to the armed queue, leaving everything already armed where it is.
// The binding is the state file's own, never this shell's: an append is what a
// running session's operator reaches for when a new plan arrives mid-run, and
// re-deriving the binding from whatever shell ran the CLI would move the leash
// off the session doing the work. That is why no bind is passed here, and the
// arming recorded is the operator's, the one arming the gate in cmdArm lets
// through.
function cmdAppend(planArgs) {
    const result = appendGoal(process.cwd(), planArgs, 'operator');
    if (!result.ok) {
        process.stderr.write('kit-goal: ' + sanitize(result.reason) + '\n');
        process.exitCode = 1;
        return;
    }
    process.stdout.write('kit goal queue extended with ' + result.appended.map((value) => sanitize(value)).join(', ')
        + ' (now ' + result.queue.length + ' plans; working ' + sanitize(result.plan) + ')'
        + (result.boundSession ? ' (binding unchanged)' : ' (still unbound)')
        + '\n');
    process.exitCode = 0;
}

// What an arm that passed the gate and still landed unbound says. The gate
// located and read this session's transcript, which is the second key the bind
// takes, so this is reachable only where armGoal's own screen refused that path
// or the id, a defect rather than an ordinary outcome. The shaped id is recorded
// as the arming session either way, so the claim points bind the goal at this
// session's next stop or auto-compaction offer. Fixed text carrying no value
// from the result, so there is nothing here to sanitize.
const UNBOUND_NOTE = ' (unbound, although this session\'s transcript was read to arm it; the'
    + ' Stop hook and the compaction gate bind it at this session\'s next stop or auto-compaction'
    + ' offer)';

// The key a plan name is compared under: separators normalized to '/', and
// case-folded on win32, where the filesystem is case-insensitive and two
// casings of one path name one file.
function planNameKey(value) {
    const forward = String(value).replace(/\\/g, '/');
    return process.platform === 'win32' ? forward.toLowerCase() : forward;
}

// The whole tokens of the typed /kit-goal argument texts, each keyed by
// planNameKey. A token is split on whitespace, loses any wrapping backticks or
// quotes, and loses trailing punctuation such as the comma after a plan in a
// multi-plan line.
function typedArgTokens(texts) {
    const tokens = new Set();
    for (const text of texts) {
        for (const raw of text.split(/\s+/)) {
            const token = raw.replace(/^[`'"]+/, '').replace(/[`'",;:.!?]+$/, '');
            if (token !== '') tokens.add(planNameKey(token));
        }
    }
    return tokens;
}

// Whether a typed token names a plan: it equals the plan's repo-relative path
// or its basename, or ends with the repo-relative path at a separator boundary
// (./docs/plans/x.md, or an absolute or Windows path to the plan). The
// comparison is by whole token rather than by substring, so a typed
// other-foo_spec_v1.md never names foo_spec_v1.md.
function tokensName(tokens, rel) {
    const key = planNameKey(rel);
    const base = planNameKey(path.posix.basename(rel));
    for (const token of tokens) {
        if (token === key || token === base || token.endsWith('/' + key)) return true;
    }
    return false;
}

// Write an arm refusal: one line naming the cause and the rule, and exit 1.
// Nothing is written anywhere. A refusal for a plan no typed /kit-goal names
// ends with the remedy, since the gate cannot tell an invocation the capped
// transcript read skipped from one never typed.
function refuseArm(cause, notNamed) {
    process.stderr.write('kit-goal: ' + cause + '; nothing armed (' + ARM_RULE + ')'
        + (notNamed ? '; type `/kit-goal` again' : '') + '\n');
    process.exitCode = 1;
}

// The arm gate, which both forms run before anything is written. It answers
// { sessionId, transcriptPath } where every plan argument is named by a typed
// /kit-goal in this session's own transcript, and null, having written the
// refusal, where anything short of that holds.
//
// The transcript is located by findTranscript, the lookup the bind has always
// used, and read by userCommandArgTexts, the reader behind the Stop hook's and
// the compaction gate's typed-command claims. So which entries count is
// decided in one place: a user entry the operator typed, never assistant text,
// tool output, a sidechain turn, an isMeta record or a compact summary. A relay
// message arrives wrapped in a <channel> tag, so its first character is '<'
// and it never anchors the typed-lead shape.
//
// A plan argument that does not resolve inside this directory is passed
// through, since armGoal and appendGoal refuse it by name with nothing written.
function armGate(planArgs) {
    const sessionId = process.env.CLAUDE_CODE_SESSION_ID;
    if (!sessionId) {
        refuseArm('no session id is set in this shell (CLAUDE_CODE_SESSION_ID), so this'
            + ' session\'s transcript cannot be read', false);
        return null;
    }
    const transcriptPath = findTranscript(sessionId);
    if (!transcriptPath) {
        refuseArm('no transcript for the session id in this shell could be located on this'
            + ' machine', false);
        return null;
    }
    const texts = userCommandArgTexts(transcriptPath);
    if (texts === null) {
        refuseArm('this session\'s transcript could not be read', false);
        return null;
    }
    const tokens = typedArgTokens(texts);
    const cwd = process.cwd();
    const unnamed = [];
    for (const arg of planArgs) {
        const rel = normalizePlanArg(cwd, arg);
        if (rel !== null && !tokensName(tokens, rel)) unnamed.push(rel);
    }
    if (unnamed.length > 0) {
        const shown = unnamed.slice(0, QUEUE_LINE_BOUND).map((value) => sanitize(value));
        const more = unnamed.length - shown.length;
        refuseArm('this session\'s transcript holds no typed /kit-goal naming '
            + shown.join(', ') + (more > 0 ? ', and ' + more + ' more' : ''), true);
        return null;
    }
    return { sessionId, transcriptPath };
}

function cmdArm(planArgs, append, here) {
    if (planArgs.length === 0) {
        usage();
        return;
    }
    try {
        const gate = armGate(planArgs);
        if (gate === null) return;
        // An append binds nothing to this shell, the binding being the state
        // file's own, so it makes no directory comparison.
        if (append) {
            cmdAppend(planArgs);
            return;
        }
        // The environment of this process is the only source of the binding:
        // no argument, no file, and no repo data can bind the goal, and the
        // transcript is located rather than supplied. armGoal owns the screen
        // that decides whether the pair is usable, so this output answers to
        // what was actually written rather than to a second copy of the rule.
        const { sessionId, transcriptPath } = gate;
        if (!here && !armDirectoryAllowed(transcriptPath)) return;
        const result = armGoal(process.cwd(), planArgs, {
            sessionId,
            transcriptPath
        }, 'operator');
        if (result.ok) {
            // Arming replaces the queue, so a plan that was armed and is not
            // named again has quietly stopped being armed. That is the one
            // failure this warning exists to make loud, and it stays a warning:
            // the replace itself is unchanged. Silent when the replacement drops
            // nothing, so the line means something when it appears.
            if (result.dropped.length > 0) {
                process.stderr.write('kit-goal: this arm replaced the armed queue and these plans are no'
                    + ' longer armed: ' + result.dropped.map((value) => sanitize(value)).join(', ')
                    + ' (arm --append adds to a queue instead of replacing it)\n');
            }
            process.stdout.write('kit goal armed for ' + sanitize(result.plan)
                + (result.queue.length > 1
                    ? ' (1 of ' + result.queue.length + '; then '
                        + result.queue.slice(1).map((value) => sanitize(value)).join(', ') + ')'
                    : '')
                + (result.boundSession ? ' (bound to this session)' : UNBOUND_NOTE)
                + '\n');
            process.exitCode = 0;
        } else {
            process.stderr.write('kit-goal: ' + sanitize(result.reason) + '\n');
            process.exitCode = 1;
        }
    } catch (err) {
        process.stderr.write('kit-goal: ' + sanitize(err.message) + '\n');
        process.exitCode = 1;
    }
}

// The sentence the two absence-reporting surfaces add when the goal-state path
// holds something no reader reads as a goal, or when its kind could not be read.
// Empty for the ordinary absent and regular-file cases.
function goalPathNote(kind) {
    if (kind === 'other') {
        return ' (something that is not a goal-state file is at .kit/goal-state.json;'
            + ' no reader treats it as a goal, and arming over it will fail until it is'
            + ' moved aside by hand)';
    }
    if (kind === 'oversized') {
        return ' (.kit/goal-state.json is past the ' + GOAL_STATE_MAX_BYTES + '-byte bound every'
            + ' reader of this file enforces, so no reader treats it as a goal; clear it and arm'
            + ' again)';
    }
    if (kind === 'unresolvable') {
        return ' (.kit/goal-state.json cannot resolve to a file at all, so nothing is armed and'
            + ' arming will fail until the path above it is a directory again)';
    }
    if (kind === 'unreadable') {
        return ' (.kit/goal-state.json could not be read right now, so whether anything is'
            + ' there is unknown; try again once whatever holds it lets go)';
    }
    return '';
}

function cmdClear() {
    const cwd = process.cwd();
    const result = clearGoal(cwd);
    if (!result.ok) {
        // Nothing was removed, so this must not read as a successful clear. What
        // is left behind is not asserted: the lstat leg fires with existence
        // unproven, and while a lock stands every reader treats the leash as
        // absent, so the goal is not necessarily enforcing either.
        process.stderr.write('kit-goal: ' + sanitize(result.reason) + ' (nothing was released)\n');
        process.exitCode = 1;
        return;
    }
    if (result.cleared) {
        process.stdout.write('kit goal cleared\n');
    } else {
        process.stdout.write('no kit goal was armed' + goalPathNote(goalPathKind(cwd)) + '\n');
    }
    process.exitCode = 0;
}

// How each state a queued plan path can be in prints in the queue rendering.
// 'missing' keeps its meaning (the plan is not there, which is what archiving a
// finished plan produces and what the leash advances on).
const QUEUE_TOKENS = { gone: 'missing', unusable: 'unusable', unreadable: 'unreadable' };

// How many of the status render's queue rows open their plan doc (through
// planStatusReadings) to show a status token, an arming and an authorization.
// A row past this still prints, but its path alone: opening every plan doc in
// a long queue is the cost this bound exists to prevent, and it is unrelated
// to QUEUE_LINE_BOUND in kit-goal-lib.js, which only caps how much text
// reaches context.
const QUEUE_OPEN_FILE_BOUND = 5;

// Where a queue entry's doc was looked for and not found, worded from
// queuePosition's own cause so the sentence cannot name directories the entry
// was never in: a plan armed from outside docs/plans/ has no archive location
// to check, and an entry that does not round-trip the plan-path normalizer was
// never resolved against any directory at all.
function unresolvableWhere(cause) {
    if (cause === 'unarchivable') {
        return 'is not at that path, and the plan is not armed from docs/plans/, so there is no'
            + ' archive location to look in either';
    }
    if (cause === 'unreadable-path') {
        return 'is at a path no reader here resolves, so it was looked for in no directory';
    }
    return 'is in neither docs/plans/ nor docs/archive/';
}

function cmdStatus() {
    const cwd = process.cwd();
    const state = readGoal(cwd);
    // A parseable state file with no usable plan string enforces nothing (the
    // Stop hook's hot path checks the same field before doing anything), so
    // it reads as unarmed here rather than being dereferenced into a crash;
    // the doctor is the surface that flags such a file as damage worth a
    // look. Only a state with a plan is normalized, so every field below is
    // guaranteed present past this guard.
    if (!state || typeof state.plan !== 'string' || state.plan === '') {
        process.stdout.write('no kit goal armed' + goalPathNote(goalPathKind(cwd)) + '\n');
        process.exitCode = 0;
        return;
    }

    // The liveness phrase is single-sourced in kit-goal-lib (lastActivePhrase),
    // shared with the SessionStart armed-goal notice, so the two surfaces
    // cannot answer the same mtime differently. It is a hint about whether
    // the leash holder is still working, never a verdict: a session can be
    // alive and quiet, and only the number and its unit reach the output.
    const phrase = lastActivePhrase(state.boundTranscript);
    // The two unbound states are named apart, because they are claimable by
    // different things and the arm's one-shot line that said which one this is
    // does not survive the arming session. This says what the state file holds
    // and stops there: whether any session still carries a recorded id is not
    // something this report can read. The field is the normalizer's, so it is
    // either a value bindSession's own acceptance rule would write or null
    // (normalizeState), and nothing here decides anything on it.
    const binding = state.boundSession
        ? 'bound to session ' + sanitize(state.boundSession) + (phrase ? ', last active ' + phrase : '')
        : state.armingSession
            ? 'unbound, arming session recorded'
            : 'unbound, no arming session recorded';

    // The position is read from the plan docs rather than taken from the
    // stored index (queuePosition states the whole rule): the index only moves
    // at a clean stop of the bound session, so a run that died at its close-out
    // leaves it naming a plan that is finished and archived, and this report is
    // where an operator goes to find out where the queue actually stands.
    const position = queuePosition(cwd, state);
    const correction = position.positional && position.healed > 0;
    // The first line names the plan the STATE says is armed, which on a
    // corrected position is not the plan the '>' marker below points at. Left
    // bare, the two would read as a contradiction on one screen, so the line
    // says which of the two it is naming and where the other one is.
    const out = ['kit goal armed for ' + sanitize(state.plan)
        + ' (armed ' + sanitize(state.armedAt) + '; ' + binding + ')'
        + (correction ? ' (that is the stored current plan; the queue line below names the plan the'
            + ' plan docs put current, and the > marker points at that one)' : '')];

    const current = sanitize(state.queue[position.index]);
    let queueLine = 'queue: plan ' + (position.index + 1) + ' of ' + state.queue.length
        + ', ' + current;
    if (correction) {
        // The stored index is named rather than quietly replaced: the gap
        // between it and the truth is what tells an operator an advance was
        // missed, and the leash still acts on the stored one until the bound
        // session's next stop moves it, one plan per stop.
        queueLine += ' (the stored position still says plan ' + (position.stored + 1) + ', '
            + sanitize(state.queue[position.stored]) + '; the plan docs report ' + position.healed
            + ' plan(s) from there on as Complete or archived, and the leash advances one plan per'
            + ' stop of the bound session until it catches up)';
    }
    if (position.positional && position.finished) {
        queueLine += ' (every plan in the queue reads Complete or is archived, this one included,'
            + " so the bound session's next stop releases the leash rather than advancing it)";
    }
    if (position.positional && position.unresolvable) {
        queueLine += ' (unresolvable: the doc for this plan ' + unresolvableWhere(position.cause)
            + ', so whether it is finished cannot be read; it keeps its position rather than being'
            + ' skipped)';
    }
    out.push(queueLine);
    // The rendering opens at most QUEUE_OPEN_FILE_BOUND plan docs from the
    // current position: this stdout is echoed into the session by the
    // /kit-goal skill, and each opened entry costs a file open
    // (planStatusReadings), so an oversized
    // state file must not become an open per line. A row past that bound
    // still names its path, read from the state file with no doc opened, up
    // to QUEUE_LINE_BOUND; a row past that is folded into the trailing count,
    // which bounds how much text the render carries into context.
    // Entries behind the reported position are not rendered here: each plan
    // the leash advanced past is reported under finished below, and any the
    // position walk moved past is counted in the queue line above.
    const openWindow = state.queue.slice(position.index, position.index + QUEUE_OPEN_FILE_BOUND);
    const pathOnlyWindow = state.queue.slice(
        position.index + QUEUE_OPEN_FILE_BOUND, position.index + QUEUE_LINE_BOUND);
    // Whether any rendered entry is one the two Status readings answer
    // differently about, which the divergent-token note below explains. Both
    // readings come from one call over one set of bytes (planStatusReadings),
    // so the token an entry prints and the position walked above cannot be
    // taken from different reads of the same row.
    let divergent = false;
    openWindow.forEach((plan, i) => {
        const head = planStatusReadings(cwd, plan);
        if (head.exists && head.status === 'complete' && !head.terminal) divergent = true;
        // planStatusReadings answers the same 'no' for three states, and this
        // is the surface an operator reads first when debugging an armed queue,
        // so the three get three tokens rather than all printing as missing: a
        // directory, a junction or a link out of the repo at a queued plan path
        // is not the same problem as a plan that was archived, and a locked one
        // is neither. The classification is planPathState's, the one every
        // reader of a plan path here answers to.
        const status = head.exists ? head.status : QUEUE_TOKENS[planPathState(cwd, plan)];
        // The authorization each plan recorded when it was queued, printed on
        // both directions rather than only when one is present: an audit trail
        // that showed nothing for a plan carrying no authorization would read
        // the same as one this surface simply did not render. It is quoted from
        // the plan doc and asserted rather than authenticated, which is why it
        // reads as what the plan says rather than as a grant.
        //
        // It goes through sanitize at the cap the store screened it under rather
        // than at sanitize's own 120-character path cap: the sentences plans
        // carry run well past that cap, and a claim about who authorized arming
        // that is cut mid-clause reads as the whole recorded claim, which is the
        // one thing this line exists to let a reader judge. The renderer is what
        // the sentence needs and the store's screen cannot give it: the sentence
        // is quoted from a plan doc and an author can write an absolute
        // home-anchored path into it, and this report is echoed into a session's
        // context, so the OS account name in such a path is what the channel's
        // home elision takes out. The store's screen is a printable-ASCII rule
        // and a cap, already applied to the stored value, so the renderer's own
        // strip and cap have nothing left to do here.
        const authorization = state.authorizations[plan];
        // The arming beside the authorization, on both directions for the reason
        // the authorization prints on both: a line rendered only for one reading
        // is indistinguishable from a line this surface did not render. They are
        // two facts and read as two: who ran the arming invocation, which the
        // caller declared, and what the doc records, which was read from it.
        const arming = planArmedBy(state, plan) === 'self'
            ? "recorded as this run's own arming"
            : 'typed by the operator';
        out.push('  ' + (i === 0 ? '>' : ' ') + ' ' + sanitize(plan) + ' [' + status + ']'
            + ' (armed: ' + arming + ')'
            + ' (authorization: '
            + (authorization ? sanitize(authorization, AUTHORIZATION_MAX_CHARS) : 'none recorded') + ')');
    });
    // A row past the open-file bound still names its path, so a consumer's
    // subtraction against this queue never has to guess at a hidden entry,
    // but it opens no plan doc: the status token, arming and authorization
    // the rows above carry all come from a read this row does not pay for.
    pathOnlyWindow.forEach((plan) => {
        out.push('    ' + sanitize(plan));
    });
    const more = state.queue.length - position.index - openWindow.length - pathOnlyWindow.length;
    if (more > 0) out.push('  ... and ' + more + ' more');
    if (divergent) {
        // One screen, two readings of one Status row, and without this line a
        // reader has no way to tell which line used which: a [complete] token
        // above a plan the queue line still reports as current looks like a
        // contradiction rather than the two rules meeting.
        out.push('  (a [complete] token above is the leash\'s reading of the Status row, under which'
            + ' trailing text after Complete still finishes a plan; the queue position above reads the'
            + ' frozen plan-doc contract instead, under which it does not, so an entry can be complete'
            + ' to the leash and current to this report)');
    }

    if (state.history.length > 0) {
        out.push('finished:');
        // The five most recent outcomes, newest last, with the rest as a
        // count, which bounds how much history this render carries into
        // context. The history opens no plan doc.
        const omitted = state.history.length - 5;
        if (omitted > 0) out.push('  ... ' + omitted + ' earlier omitted');
        for (const entry of state.history.slice(-5)) {
            out.push('  ' + sanitize(entry.plan) + ' ' + sanitize(entry.outcome) + ' at ' + sanitize(entry.at)
                + (entry.note ? ': ' + sanitize(entry.note) : ''));
        }
    }

    process.stdout.write(out.join('\n') + '\n');
    process.exitCode = 0;
}

// The /kit-goal skill documents these as clear aliases (matching native
// /goal); honoring them in the CLI too means a direct alias call is not a
// silent usage error.
const CLEAR_ALIASES = new Set(['clear', 'stop', 'off', 'reset', 'none', 'cancel']);

function main() {
    const [cmd, ...args] = process.argv.slice(2);
    // --append and --here are read wherever they sit among the plan paths and
    // removed from them, so an operator typing one after the paths gets the flag
    // rather than an arm over a plan doc named --append, which no repository
    // has. Any other leading-dash token is refused before it can reach armGoal
    // as a plan argument, rather than misread as a plan path that is merely
    // missing, and before the gate reads any transcript.
    if (cmd === 'arm') {
        const flags = new Set(['--append', '--here']);
        const badFlag = args.find((a) => a.startsWith('-') && !flags.has(a));
        if (badFlag) usageBadArmFlag(badFlag);
        else cmdArm(args.filter((a) => !flags.has(a)), args.includes('--append'), args.includes('--here'));
    }
    else if (CLEAR_ALIASES.has(cmd)) cmdClear();
    else if (cmd === 'status') cmdStatus();
    else usage();
}

// Wrapped so an unexpected defect prints one sanitized line and a nonzero
// exit instead of a stack trace: this CLI's output is echoed into a session's
// context by the /kit-goal skill invocation, and a stack dump is noise there.
// The library load is INSIDE the region because a require is the throw most
// likely to produce that trace, a damaged plugin cache being its ordinary cause.
try {
    loadKitLibraries();
    main();
} catch (err) {
    // A throw during the load leaves the renderer unbound, and it stays unbound
    // whichever library refused: the renderer lives in kit-compact-lib.js,
    // which requires kit-goal-lib.js itself, so a load that failed at either
    // cannot be recovered by requiring the renderer alone. Nothing here can then
    // take the OS account name out of the error text, whose module path and
    // `Require stack:` lines are home-anchored on an installed plugin, so that
    // reading names the failure and withholds the text. The error's CODE still
    // rides, since a Node error code is an upper-case identifier
    // (MODULE_NOT_FOUND, ERR_DLOPEN_FAILED) that names the failure's kind and
    // can carry no path; anything else in that field is dropped. It rides the
    // withheld leg alone, since a message that survived sanitize already opens
    // with its own code where it has one (ENOENT: no such file ...).
    const code = err && typeof err.code === 'string' && /^[A-Z0-9_]{1,40}$/.test(err.code)
        ? ' (' + err.code + ')' : '';
    process.stderr.write('kit-goal: ' + (sanitize === undefined
        ? 'a kit library could not be loaded' + code + ', and the renderer that takes the OS'
            + ' account name out of an error is in it, so the message itself is withheld'
        : sanitize(err && err.message ? err.message : String(err))) + '\n');
    process.exitCode = 1;
}
