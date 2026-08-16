#!/usr/bin/env node
// CLI entry for the kit-native goal continuity mechanism.
//
// Subcommands:
//   kit-goal.js arm <planPath>...  arm a goal against one plan doc or an
//                                  ordered queue of them
//   kit-goal.js clear              clear any armed goal
//   kit-goal.js status             report whether a goal is armed
//
// Invoked by the /kit-goal skill. All filesystem work is delegated to
// kit-goal-lib.js; this file is only argument parsing and output formatting.

'use strict';

const { armGoal, clearGoal, readGoal, planHead, lastActivePhrase } = require('./kit-goal-lib.js');

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

function cmdArm(planArgs) {
    if (planArgs.length === 0) {
        usage();
        return;
    }
    try {
        const result = armGoal(process.cwd(), planArgs);
        if (result.ok) {
            process.stdout.write('kit goal armed for ' + sanitize(result.plan)
                + (result.queue.length > 1
                    ? ' (1 of ' + result.queue.length + '; then '
                        + result.queue.slice(1).map(sanitize).join(', ') + ')'
                    : '')
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
