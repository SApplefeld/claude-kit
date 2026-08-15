#!/usr/bin/env node
// CLI entry for the boundary-compaction checkpoint.
//
// Subcommands:
//   kit-compact-checkpoint.js open     open a checkpoint for the armed plan
//   kit-compact-checkpoint.js clear    remove any open checkpoint
//   kit-compact-checkpoint.js status   report whether a checkpoint is open
//
// Invoked by the executing-work chapter-close ritual after a Chapter is
// appended and the section's commit model has been honored. An open checkpoint
// tells the PreCompact gate (kit-compact-gate.js) that a chapter boundary has
// been reached: the gate allows the next auto-compaction attempt and consumes
// the checkpoint, so each open lands exactly one compaction. Opening requires
// an armed kit goal, because the checkpoint records the armed plan path and
// the gate treats a checkpoint naming any other plan as absent: with no goal
// armed there is nothing the file could ever match, so the open refuses
// rather than writing a dead checkpoint. All filesystem work is delegated to
// kit-compact-lib.js; this file is only argument parsing and output
// formatting, matching kit-goal.js.

'use strict';

const { readGoal } = require('./kit-goal-lib.js');
const { readCheckpoint, writeCheckpoint, clearCheckpoint } = require('./kit-compact-lib.js');

// Repo-controlled strings (a plan path, a timestamp read back from disk) are
// sanitized to printable ASCII and length-capped before they reach
// stdout/stderr, matching the sibling hooks' convention for any repo data
// entering a trusted output channel.
function sanitize(s) {
    return String(s).replace(/[^\x20-\x7E]/g, '').slice(0, 120);
}

function usage() {
    process.stderr.write('usage: kit-compact-checkpoint.js open | clear | status\n');
    process.exitCode = 1;
}

function cmdOpen() {
    const goal = readGoal(process.cwd());
    if (!goal || typeof goal.plan !== 'string' || goal.plan === '') {
        process.stderr.write('kit-compact-checkpoint: no kit goal is armed, so a checkpoint would never match; nothing written\n');
        process.exitCode = 1;
        return;
    }
    // The checkpoint records the goal's current boundSession alongside the
    // plan: the gate requires both to match, so a checkpoint orphaned by a
    // crash cannot open the gate for the re-bound session that resumes the
    // plan. An unbound goal writes null, which the gate never matches; the
    // open still succeeds because binding is the Stop hook's job and may
    // simply not have happened yet in an unusual arming order.
    const result = writeCheckpoint(process.cwd(), goal.plan, goal.boundSession);
    if (result.ok) {
        // File-derived values print indented, never at column zero, keeping
        // sanitized untrusted data visually subordinate in a channel a model
        // reads.
        process.stdout.write('  compact checkpoint open for ' + sanitize(result.plan)
            + ' (the next auto-compaction lands here)\n');
        process.exitCode = 0;
    } else {
        process.stderr.write('kit-compact-checkpoint: ' + sanitize(result.reason) + '\n');
        process.exitCode = 1;
    }
}

function cmdClear() {
    const result = clearCheckpoint(process.cwd());
    if (!result.ok) {
        // The file exists but could not be deleted: the checkpoint is still
        // open and will admit the next auto-compaction, so this must not read
        // as a successful clear.
        process.stderr.write('kit-compact-checkpoint: ' + sanitize(result.reason) + ' (the checkpoint is still open)\n');
        process.exitCode = 1;
        return;
    }
    process.stdout.write((result.cleared ? 'compact checkpoint cleared' : 'no compact checkpoint was open') + '\n');
    process.exitCode = 0;
}

function cmdStatus() {
    const cp = readCheckpoint(process.cwd());
    if (!cp || typeof cp.plan !== 'string') {
        process.stdout.write('no compact checkpoint is open\n');
        process.exitCode = 0;
        return;
    }
    // File-derived values print indented, never at column zero (see cmdOpen).
    let line = '  compact checkpoint open for ' + sanitize(cp.plan)
        + ' (opened ' + sanitize(cp.openedAt) + ')';
    // A checkpoint the gate would read as absent is worth flagging here: the
    // file exists but gates nothing, which status alone would misreport.
    const goal = readGoal(process.cwd());
    if (!goal || goal.plan !== cp.plan) {
        line += ' - does not match the armed goal, so the gate treats it as absent';
    }
    process.stdout.write(line + '\n');
    process.exitCode = 0;
}

function main() {
    const [cmd] = process.argv.slice(2);
    if (cmd === 'open') cmdOpen();
    else if (cmd === 'clear') cmdClear();
    else if (cmd === 'status') cmdStatus();
    else usage();
}

main();
