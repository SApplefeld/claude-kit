#!/usr/bin/env node
// hook-dispatch.js - one process per tool-call event.
//
// hooks.json wires this file alone on PreToolUse and PostToolUse, as
//     node "${CLAUDE_PLUGIN_ROOT}/hooks/hook-dispatch.js" <event>
// and dispatch-table.json, in hooks.json's own shape, names the hooks each
// event routes to and the matcher each is scoped by. The dispatcher reads the
// payload once, selects the hooks the table matches to the payload's tool, runs
// each unmodified hook file in its own worker thread, and answers the harness
// once with the merged result.
//
// Why threads around unmodified files: a hook launched by the harness costs a
// shell, a second shell, a node process and a console host, and a Bash call
// matches nine of them. A hook's own logic is a few milliseconds; the launch is
// the cost. A worker thread gives a hook its own process.exit, its own
// uncaught-exception boundary and its own module cache, so no guard's file
// changes and one hook's failure cannot reach another.
//
// Exit codes, which are the harness's own:
//   2  at least one hook blocked. stderr carries the blocking hooks' stderr.
//   0  no hook blocked. stdout carries the merged answer, when there is one.
//   1  a hook failed without blocking and nothing else had anything to say,
//      or the routing table could not be read.
//
// A failure of the dispatcher's own machinery never silences a guard: a thread
// that ends without a whole answer, an answer too large for its buffer, a
// thread that cannot start, and any throw in here all send the affected hooks
// through a child process, which is the behaviour this file replaces.
// KIT_HOOK_DISPATCH=legacy forces that path for every hook.

'use strict';

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const HOOKS_DIR = __dirname;
const TABLE_PATH = path.join(HOOKS_DIR, 'dispatch-table.json');
const BOOT_PATH = path.join(HOOKS_DIR, 'hook-dispatch-boot.js');

const HEADER_BYTES = 16;
const RESULT_BYTES = 1024 * 1024;

// Under the harness's own sixty seconds, so a hung hook costs itself rather
// than every answer the dispatcher was about to give.
const HOOK_DEADLINE_MS = 50000;

const DECISION_RANK = { deny: 3, ask: 2, allow: 1 };

function isObject(v) {
    return v !== null && typeof v === 'object' && !Array.isArray(v);
}

// The harness's own reading of a matcher: absent, empty or '*' reaches every
// tool, and anything else is a regular expression that must match the whole
// tool name. A matcher that does not compile matches nothing.
function matches(matcher, toolName) {
    if (matcher === undefined || matcher === null || matcher === '' || matcher === '*') return true;
    if (typeof toolName !== 'string') return false;
    try {
        return new RegExp('^(?:' + matcher + ')$').test(toolName);
    } catch {
        return false;
    }
}

// The table's entries for one event, as [{ matcher, names }], in table order.
// Throws on a table that is absent, unparseable or not in the documented shape,
// so the caller reports it rather than routing on part of one.
function readTable(tablePath, event) {
    const parsed = JSON.parse(fs.readFileSync(tablePath, 'utf8').replace(/^﻿/, ''));
    if (!isObject(parsed) || !isObject(parsed.hooks)) throw new Error('no hooks object');
    const entries = parsed.hooks[event];
    if (entries === undefined) return [];
    if (!Array.isArray(entries)) throw new Error('event ' + event + ' is not an array');
    return entries.map((entry) => {
        if (!isObject(entry) || !Array.isArray(entry.hooks)) throw new Error('malformed entry under ' + event);
        const names = [];
        for (const h of entry.hooks) {
            const m = /hooks[\\/]([\w.-]+\.js)/.exec(String((h && h.command) || ''));
            if (!m) throw new Error('a command under ' + event + ' names no hook file');
            names.push(m[1]);
        }
        return { matcher: entry.matcher, names };
    });
}

// The hook filenames to run, in table order, each once. toolName undefined
// means the payload could not be read, and then every hook for the event runs:
// each one already fails open on a payload it cannot parse, and running too
// many is the safe direction for a set of guards.
function selectHooks(entries, toolName) {
    const selected = [];
    for (const entry of entries) {
        if (toolName !== undefined && !matches(entry.matcher, toolName)) continue;
        for (const name of entry.names) {
            if (!selected.includes(name)) selected.push(name);
        }
    }
    return selected;
}

// What this file replaces, kept as the fallback and the rollback.
function runChild(hookPath, payloadText) {
    const r = spawnSync(process.execPath, [hookPath], {
        input: payloadText,
        encoding: 'utf8',
        timeout: HOOK_DEADLINE_MS,
        windowsHide: true,
        maxBuffer: 16 * 1024 * 1024
    });
    if (r.error) {
        return { code: 1, stdout: r.stdout || '', stderr: (r.stderr || '') + String(r.error.message || r.error) + '\n' };
    }
    return { code: r.status === null ? 1 : r.status, stdout: r.stdout || '', stderr: r.stderr || '' };
}

// Resolves to the hook's answer, or to null when the thread machinery failed
// to deliver one and the caller should fall back to a child process.
function runThreaded(hookPath, payloadText, deadlineMs) {
    return new Promise((resolve) => {
        let Worker;
        let sab;
        let worker;
        try {
            ({ Worker } = require('worker_threads'));
            sab = new SharedArrayBuffer(HEADER_BYTES + RESULT_BYTES);
            worker = new Worker(BOOT_PATH, {
                workerData: { sab, payload: payloadText, hookPath },
                stdout: true,
                stderr: true
            });
        } catch {
            resolve(null);
            return;
        }
        let settled = false;
        const settle = (value) => {
            if (settled) return;
            settled = true;
            clearTimeout(timer);
            resolve(value);
        };
        const timer = setTimeout(() => {
            worker.terminate().catch(() => {});
            settle({ code: 1, stdout: '', stderr: path.basename(hookPath) + ': no answer within ' + deadlineMs + ' ms\n' });
        }, deadlineMs);
        // An uncaught throw from a callback still runs the thread's exit handler
        // and still ends it with code 1, as it would a process. What differs is
        // where the stack goes: node prints it for a process and hands it to
        // this event for a thread, so it is put back on stderr below.
        let uncaught = '';
        worker.on('error', (x) => { uncaught = String((x && x.stack) || x) + '\n'; });
        worker.on('exit', () => {
            const head = new Int32Array(sab, 0, 4);
            if (Atomics.load(head, 0) !== 1) {
                settle(null);
                return;
            }
            const outLen = Atomics.load(head, 2);
            const errLen = Atomics.load(head, 3);
            const body = Buffer.from(sab, HEADER_BYTES);
            settle({
                code: Atomics.load(head, 1),
                stdout: body.subarray(0, outLen).toString('utf8'),
                stderr: body.subarray(outLen, outLen + errLen).toString('utf8') + uncaught
            });
        });
    });
}

// results: [{ name, code, stdout, stderr }] in table order.
// Returns { exitCode, stdout, stderr }.
function merge(event, results) {
    const blockers = results.filter((r) => r.code === 2);
    if (blockers.length > 0) {
        return { exitCode: 2, stdout: '', stderr: blockers.map((r) => r.stderr).join('') };
    }

    const failures = results.filter((r) => r.code !== 0);
    const stderr = failures.map((r) => r.stderr).join('');
    const spoke = results.filter((r) => r.code === 0 && r.stdout.trim() !== '');

    if (spoke.length === 0) {
        return { exitCode: failures.length > 0 ? 1 : 0, stdout: '', stderr };
    }
    // One hook with something to say and nothing else to report: its bytes
    // are the answer, exactly as the harness would have read them.
    if (spoke.length === 1 && failures.length === 0) {
        return { exitCode: 0, stdout: spoke[0].stdout, stderr };
    }

    const objects = [];
    for (const r of spoke) {
        let parsed;
        try { parsed = JSON.parse(r.stdout); } catch { parsed = undefined; }
        if (isObject(parsed)) objects.push(parsed);
    }
    if (objects.length === 0) {
        return { exitCode: 0, stdout: spoke[0].stdout, stderr };
    }

    const merged = {};
    const specific = { hookEventName: event };
    const contexts = [];
    let decision;
    let reasons = [];
    for (const obj of objects) {
        for (const key of Object.keys(obj)) {
            if (key === 'hookSpecificOutput') continue;
            if (!(key in merged)) merged[key] = obj[key];
        }
        const hso = obj.hookSpecificOutput;
        if (!isObject(hso)) continue;
        for (const key of Object.keys(hso)) {
            if (key === 'hookEventName' || key === 'additionalContext'
                || key === 'permissionDecision' || key === 'permissionDecisionReason') continue;
            if (!(key in specific)) specific[key] = hso[key];
        }
        if (typeof hso.additionalContext === 'string' && hso.additionalContext !== '') {
            contexts.push(hso.additionalContext);
        }
        const rank = DECISION_RANK[hso.permissionDecision];
        if (rank === undefined) continue;
        const reason = typeof hso.permissionDecisionReason === 'string' ? hso.permissionDecisionReason : '';
        if (decision === undefined || rank > DECISION_RANK[decision]) {
            decision = hso.permissionDecision;
            reasons = reason ? [reason] : [];
        } else if (rank === DECISION_RANK[decision] && reason) {
            reasons.push(reason);
        }
    }
    if (decision !== undefined) {
        specific.permissionDecision = decision;
        if (reasons.length > 0) specific.permissionDecisionReason = reasons.join('\n\n');
    }
    if (contexts.length > 0) specific.additionalContext = contexts.join('\n\n');
    merged.hookSpecificOutput = specific;
    if (failures.length > 0) {
        const note = 'kit hook failure, not blocking: '
            + failures.map((r) => r.name + ' (exit ' + r.code + ')').join(', ');
        merged.systemMessage = typeof merged.systemMessage === 'string'
            ? merged.systemMessage + '\n' + note
            : note;
    }
    return { exitCode: 0, stdout: JSON.stringify(merged), stderr };
}

// Runs the named hooks and merges them. opts exists for the tests: hooksDir
// points at stand-in hooks, legacy forces the child-process path, deadlineMs
// shortens the wait.
async function dispatch(event, names, payloadText, opts) {
    const o = opts || {};
    const dir = o.hooksDir || HOOKS_DIR;
    const legacy = o.legacy === true;
    const deadlineMs = o.deadlineMs || HOOK_DEADLINE_MS;
    const results = await Promise.all(names.map(async (name) => {
        const hookPath = path.join(dir, name);
        let answer = legacy ? null : await runThreaded(hookPath, payloadText, deadlineMs);
        if (answer === null) answer = runChild(hookPath, payloadText);
        return { name, code: answer.code, stdout: answer.stdout, stderr: answer.stderr };
    }));
    return merge(event, results);
}

function answer(result) {
    if (result.stderr) fs.writeSync(2, result.stderr);
    if (result.stdout) fs.writeSync(1, result.stdout);
    process.exitCode = result.exitCode;
}

async function main() {
    const event = process.argv[2];
    let payloadText = '';
    try { payloadText = fs.readFileSync(0, 'utf8'); } catch { payloadText = ''; }

    let entries;
    try {
        if (typeof event !== 'string' || event === '') throw new Error('no event argument');
        entries = readTable(TABLE_PATH, event);
    } catch (x) {
        // Without the table there is nothing to route to. This is loud and does
        // not block: a session that cannot make a tool call cannot repair its
        // own install, and the session-start canary reports the same break.
        answer({
            exitCode: 1,
            stdout: '',
            stderr: 'hook-dispatch: the routing table at ' + TABLE_PATH + ' is unusable ('
                + String((x && x.message) || x) + '), so no kit tool-use hook ran for this call\n'
        });
        return;
    }

    let toolName;
    try {
        const payload = JSON.parse(payloadText.replace(/^﻿/, ''));
        if (isObject(payload) && typeof payload.tool_name === 'string') toolName = payload.tool_name;
    } catch {
        toolName = undefined;
    }

    const names = selectHooks(entries, toolName);
    if (names.length === 0) return;

    const legacy = process.env.KIT_HOOK_DISPATCH === 'legacy';
    try {
        answer(await dispatch(event, names, payloadText, { legacy }));
    } catch {
        answer(await dispatch(event, names, payloadText, { legacy: true }));
    }
}

if (require.main === module) {
    main().catch((x) => {
        try { fs.writeSync(2, 'hook-dispatch: ' + String((x && x.stack) || x) + '\n'); } catch { /* nothing to do */ }
        process.exitCode = 1;
    });
}

module.exports = { matches, readTable, selectHooks, merge, dispatch, runChild, runThreaded, TABLE_PATH, HOOKS_DIR };
