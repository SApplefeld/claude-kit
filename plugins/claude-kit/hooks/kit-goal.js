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
// arm runs inside the arming session's own shell, so it binds the goal to that
// session at arm time: CLAUDE_CODE_SESSION_ID names the session, and the
// harness writes that session's transcript under ~/.claude/projects. Both are
// required to bind (kit-goal-lib.js's SESSION_ID_SHAPE states why), so a
// session id naming no transcript on this machine arms unbound. The variable is
// undocumented, so it can change shape or vanish upstream without notice; an
// absent or non-UUID value arms unbound too, and the Stop hook's and compaction
// gate's claim points bind the goal instead. Every arm reports which of the two
// happened, because an armed-but-unbound goal is otherwise silent.

'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');
const {
    armGoal, appendGoal, clearGoal, readGoal, planHead, lastActivePhrase, isSessionIdShaped, goalPath,
    planPathState, pathErrnoClass, safeForAuthorization, GOAL_STATE_MAX_BYTES
} = require('./kit-goal-lib.js');

// Repo-controlled strings (a plan path) are sanitized to printable ASCII and
// length-capped before they reach stdout/stderr, matching the sibling hooks'
// convention for any repo data entering a trusted output channel. The cap is
// sized for a path and for the short fields beside one; a recorded authorization
// sentence is prose that runs past it and goes through safeForAuthorization
// instead, the same screen the value was stored under.
function sanitize(s) {
    return String(s).replace(/[^\x20-\x7E]/g, '').slice(0, 120);
}

function usage() {
    process.stderr.write('usage: kit-goal.js arm [--append] <planPath>... | clear | status\n');
    process.exitCode = 1;
}

// The transcript file of a session id, or null when it cannot be located. The
// harness stores each session's transcript as <sessionId>.jsonl inside a
// per-project directory under ~/.claude/projects, and that directory's name is
// a munged form of the project path, so the directories are listed and the
// first existing candidate wins rather than reproducing the munging here. The
// whole body is wrapped, and an absent or unreadable projects directory yields
// null.
//
// The shape test runs before any filesystem work, so arbitrary environment
// content never drives a directory scan. The id is then used as a bare file
// name, and a value carrying a path separator is refused rather than joined
// into a path it could steer: a shape-passed id cannot carry one, and the
// check is kept so this function is safe on its own terms whatever calls it.
//
// A null result is what makes the arm unbound: a session id naming no local
// transcript is not corroborated as a real session on this machine, and
// armGoal writes the binding and the transcript together or not at all.
function findTranscript(sessionId) {
    try {
        if (!isSessionIdShaped(sessionId) || path.basename(sessionId) !== sessionId) {
            return null;
        }
        const root = path.join(os.homedir(), '.claude', 'projects');
        for (const entry of fs.readdirSync(root)) {
            const candidate = path.join(root, entry, sessionId + '.jsonl');
            // A regular file, not mere existence: the stored path's one use is
            // an fs.stat liveness hint, and the corroboration this scan
            // provides is that a session's transcript FILE exists, which is
            // what the security model states.
            try {
                if (fs.statSync(candidate).isFile()) return candidate;
            } catch { /* no candidate in this project directory */ }
        }
        return null;
    } catch {
        return null;
    }
}

// Add plans to the armed queue, leaving everything already armed where it is.
// The binding is the state file's own, never this shell's: an append is what a
// running session's operator reaches for when a new plan arrives mid-run, and
// re-deriving the binding from whatever shell ran the CLI would move the leash
// off the session doing the work. That is why no bind is passed here.
function cmdAppend(planArgs) {
    const result = appendGoal(process.cwd(), planArgs);
    if (!result.ok) {
        process.stderr.write('kit-goal: ' + sanitize(result.reason) + '\n');
        process.exitCode = 1;
        return;
    }
    process.stdout.write('kit goal queue extended with ' + result.appended.map(sanitize).join(', ')
        + ' (now ' + result.queue.length + ' plans; working ' + sanitize(result.plan) + ')'
        + (result.boundSession ? ' (binding unchanged)' : ' (still unbound)')
        + '\n');
    process.exitCode = 0;
}

function cmdArm(planArgs, append) {
    if (planArgs.length === 0) {
        usage();
        return;
    }
    try {
        if (append) {
            cmdAppend(planArgs);
            return;
        }
        // The environment of this process is the only source of the binding:
        // no argument, no file, and no repo data can bind the goal, and the
        // transcript is located rather than supplied. armGoal owns the gate
        // that decides whether the pair is usable, so this output answers to
        // what was actually written rather than to a second copy of the rule.
        const sessionId = process.env.CLAUDE_CODE_SESSION_ID;
        const result = armGoal(process.cwd(), planArgs, {
            sessionId,
            transcriptPath: findTranscript(sessionId)
        });
        if (result.ok) {
            // Arming replaces the queue, so a plan that was armed and is not
            // named again has quietly stopped being armed. That is the one
            // failure this warning exists to make loud, and it stays a warning:
            // the replace itself is unchanged. Silent when the replacement drops
            // nothing, so the line means something when it appears.
            if (result.dropped.length > 0) {
                process.stderr.write('kit-goal: this arm replaced the armed queue and these plans are no'
                    + ' longer armed: ' + result.dropped.map(sanitize).join(', ')
                    + ' (arm --append adds to a queue instead of replacing it)\n');
            }
            process.stdout.write('kit goal armed for ' + sanitize(result.plan)
                + (result.queue.length > 1
                    ? ' (1 of ' + result.queue.length + '; then '
                        + result.queue.slice(1).map(sanitize).join(', ') + ')'
                    : '')
                + (result.boundSession
                    ? ' (bound to this session)'
                    : " (unbound; the leash binds at the arming session's first stop"
                        + ' or auto-compaction offer)')
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

// What is at the goal-state path: 'file', 'oversized' (a regular file past the
// bound every reader of it enforces), 'other' (something that is not a regular
// file), 'unresolvable' (a path that can never resolve to a file),
// 'unreadable' (a kind that could not be read at all) or 'absent'. The kind rule
// every reader of that file applies, plus the size cap they apply with it, asked
// here so the two surfaces that would otherwise print plain absence do not say
// "nothing armed" about a path with something sitting at it that a later arm will
// fail on with a raw errno. The errno split is pathErrnoClass's, the rule every
// caller of this question in the kit answers to.
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
    const binding = state.boundSession
        ? 'bound to session ' + sanitize(state.boundSession) + (phrase ? ', last active ' + phrase : '')
        : 'unbound';
    const out = ['kit goal armed for ' + sanitize(state.plan)
        + ' (armed ' + sanitize(state.armedAt) + '; ' + binding + ')'];

    out.push('queue: plan ' + (state.queueIndex + 1) + ' of ' + state.queue.length);
    // The rendering is capped at five entries from the current position, with
    // the rest as a count, matching the SessionStart notice's queue clause:
    // this stdout is echoed into the session by the /kit-goal skill, and each
    // rendered entry costs a file open (planHead), so an oversized state file
    // must not become an unbounded context flood or an open per line. Entries
    // behind the current position are not rendered here: each plan the leash
    // advanced past is reported under finished below.
    const window = state.queue.slice(state.queueIndex, state.queueIndex + 5);
    window.forEach((plan, i) => {
        const head = planHead(cwd, plan);
        // planHead answers the same 'no' for three states, and this is the
        // surface an operator reads first when debugging an armed queue, so the
        // three get three tokens rather than all printing as missing: a
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
        // It is screened by safeForAuthorization, the rule it was stored under,
        // rather than by sanitize: the sentences plans carry run well past
        // sanitize's 120-character path cap, and a claim about who authorized
        // arming that is cut mid-clause reads as the whole recorded claim, which
        // is the one thing this line exists to let a reader judge.
        const authorization = state.authorizations[plan];
        out.push('  ' + (i === 0 ? '>' : ' ') + ' ' + sanitize(plan) + ' [' + status + ']'
            + ' (authorization: ' + (authorization ? safeForAuthorization(authorization) : 'none recorded') + ')');
    });
    const more = state.queue.length - state.queueIndex - window.length;
    if (more > 0) out.push('  ... and ' + more + ' more');

    if (state.history.length > 0) {
        out.push('finished:');
        // The five most recent outcomes, newest last, with the rest as a
        // count: the same bound as the queue above and for the same reason.
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
    // --append is read wherever it sits among the plan paths and removed from
    // them, so an operator typing it after the paths gets an append rather than
    // an arm over a plan doc named --append, which no repository has.
    if (cmd === 'arm') cmdArm(args.filter((a) => a !== '--append'), args.includes('--append'));
    else if (CLEAR_ALIASES.has(cmd)) cmdClear();
    else if (cmd === 'status') cmdStatus();
    else usage();
}

// Wrapped so an unexpected defect prints one sanitized line and a nonzero
// exit instead of a stack trace: this CLI's output is echoed into a session's
// context by the /kit-goal skill invocation, and a stack dump is noise there.
try {
    main();
} catch (err) {
    process.stderr.write('kit-goal: ' + sanitize(err && err.message ? err.message : String(err)) + '\n');
    process.exitCode = 1;
}
