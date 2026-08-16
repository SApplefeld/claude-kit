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

const fs = require('fs');
const { armGoal, clearGoal, readGoal, planHead } = require('./kit-goal-lib.js');

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

// How long ago the bound session's transcript was last written, as a coarse
// phrase, or null when the path is absent or unreadable. This is a hint about
// whether the leash holder is still working, never a verdict: a session can be
// alive and quiet, and only the number and its unit reach the output.
function livenessHint(transcriptPath) {
    if (!transcriptPath) return null;
    let mtimeMs;
    try {
        mtimeMs = fs.statSync(transcriptPath).mtimeMs;
    } catch {
        return null;
    }
    const minutes = Math.max(0, Math.round((Date.now() - mtimeMs) / 60000));
    if (minutes < 1) return 'last active under a minute ago';
    if (minutes < 120) return 'last active about ' + minutes + ' minute' + (minutes === 1 ? '' : 's') + ' ago';
    return 'last active about ' + Math.round(minutes / 60) + ' hours ago';
}

function cmdStatus() {
    const cwd = process.cwd();
    const state = readGoal(cwd);
    if (!state) {
        process.stdout.write('no kit goal armed\n');
        process.exitCode = 0;
        return;
    }

    const hint = livenessHint(state.boundTranscript);
    const binding = state.boundSession
        ? 'bound to session ' + sanitize(state.boundSession) + (hint ? ', ' + hint : '')
        : 'unbound';
    const out = ['kit goal armed for ' + sanitize(state.plan)
        + ' (armed ' + sanitize(state.armedAt) + '; ' + binding + ')'];

    out.push('queue: plan ' + (state.queueIndex + 1) + ' of ' + state.queue.length);
    state.queue.forEach((plan, i) => {
        const head = planHead(cwd, plan);
        const status = head.exists ? head.status : 'missing';
        out.push('  ' + (i === state.queueIndex ? '>' : ' ') + ' ' + sanitize(plan) + ' [' + status + ']');
    });

    if (state.history.length > 0) {
        out.push('finished:');
        for (const entry of state.history) {
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

main();
