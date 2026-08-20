#!/usr/bin/env node
// CLI entry for the kit-native goal continuity mechanism.
//
// Subcommands:
//   kit-goal.js arm <planPath>...  arm a goal against one plan doc or an
//                                  ordered queue of them
//   kit-goal.js clear              clear any armed goal
//   kit-goal.js status             report whether a goal is armed
//
// Invoked by the /kit-goal skill. Goal-state work is delegated to
// kit-goal-lib.js, which takes the binding as an argument; this file is the
// only reader of the session-id variable, plus argument parsing and output
// formatting.
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
    armGoal, clearGoal, readGoal, planHead, lastActivePhrase, isSessionIdShaped
} = require('./kit-goal-lib.js');

// Repo-controlled strings (a plan path) are sanitized to printable ASCII and
// length-capped before they reach stdout/stderr, matching the sibling hooks'
// convention for any repo data entering a trusted output channel.
function sanitize(s) {
    return String(s).replace(/[^\x20-\x7E]/g, '').slice(0, 120);
}

function usage() {
    process.stderr.write('usage: kit-goal.js arm <planPath>... | clear | status\n');
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

function cmdArm(planArgs) {
    if (planArgs.length === 0) {
        usage();
        return;
    }
    try {
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

function cmdClear() {
    const result = clearGoal(process.cwd());
    if (!result.ok) {
        // The state file exists but could not be deleted: the leash is still
        // armed and enforcing, so this must not read as a successful clear.
        process.stderr.write('kit-goal: ' + sanitize(result.reason) + ' (the goal is still armed)\n');
        process.exitCode = 1;
        return;
    }
    process.stdout.write((result.cleared ? 'kit goal cleared' : 'no kit goal was armed') + '\n');
    process.exitCode = 0;
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
        process.stdout.write('no kit goal armed\n');
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
        const status = head.exists ? head.status : 'missing';
        out.push('  ' + (i === 0 ? '>' : ' ') + ' ' + sanitize(plan) + ' [' + status + ']');
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
    if (cmd === 'arm') cmdArm(args);
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
