// Tests for plugins/claude-kit/hooks/kit-goal-stop.js (the goal-leash Stop hook).
//
// Node's built-in test runner, no framework (Node v24). The hook is spawned as a
// real child process, fed a Stop payload on stdin, and asserted on by its stdout:
// a block emits {"decision":"block", reason}; an allow emits nothing. Each case
// builds a fresh temp cwd (with its own .kit/goal-state.json and a fake JSONL
// transcript) plus a second temp dir holding that case's event sink: pinning
// KIT_EVENTS_PATH inside it is the isolation, so no release a case fires
// appends to the real ~/.claude/kit-events.jsonl. KIT_EVENTS_PATH is honored
// only alongside KIT_EVENTS_PATH_ALLOW=1, so every spawn sets both; leaving
// the allow signal off would make the redirect inert and route every case's
// events into the real sink instead of the temp one. Every spawn also points
// LOCALAPPDATA at the temp root as belt-and-suspenders (the hook reads no
// LOCALAPPDATA path today; the pin costs nothing and guards a future one).
// All temp state is cleaned up in a finally block.

'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const { spawn, spawnSync } = require('node:child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

const HOOK = path.join(__dirname, '..', 'plugins', 'claude-kit', 'hooks', 'kit-goal-stop.js');
const { armGoal, bindSession } = require('../plugins/claude-kit/hooks/kit-goal-lib.js');

// The goal-event sink for a case, always inside a temp root that case cleans up,
// never the real ~/.claude/kit-events.jsonl that a release fired by any spawn
// would append to. Every spawn supplies its own root, so no sink is shared
// across cases and none outlives the case that wrote it; a missing root is a
// fixture error rather than a silent fall back to a shared path.
function eventsPath(root) {
    if (root === undefined) throw new Error('eventsPath requires a temp root');
    return path.join(root, 'kit-goal-stop-events.jsonl');
}

// The events a case's spawns emitted, newest last; an empty list when nothing
// was written.
function readEvents(root) {
    const sink = eventsPath(root);
    if (!fs.existsSync(sink)) return [];
    return fs.readFileSync(sink, 'utf8')
        .split('\n')
        .filter((line) => line.trim() !== '')
        .map((line) => JSON.parse(line));
}

// Drop the run-scoped variables from a child's environment. This suite runs
// inside fleet workers too, where the engine sets all three, and an inherited
// KIT_RUN_ID would attach a `run` field to every emitted event, breaking the
// exact-shape assertions the byte-identical cases make. Keys are matched
// case-insensitively, the same care memq.test.js's scrubRunEnv takes with a
// Windows environment block's key casing.
function scrubRunEnv(env) {
    for (const k of Object.keys(env)) {
        if (/^KIT_(RUN_ID|SPAWN_VECTOR|RUN_SECTION)$/i.test(k)) delete env[k];
    }
    return env;
}

function makeDir(prefix) {
    return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

function rmDir(dir) {
    try { fs.rmSync(dir, { recursive: true, force: true }); } catch { /* best effort */ }
}

function writeFile(full, contents) {
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, contents, 'utf8');
}

// Build a JSONL transcript from an array of assistant text turns. Each turn
// becomes one assistant line with a single text content block; a genuine
// arming-invocation user line (the plan path inside a <command-args> span) is
// prepended so the scoping predicate claims this session, matching the real
// shape the /kit-goal skill produces.
function writeTranscript(full, planRel, assistantTexts) {
    const lines = [];
    lines.push(JSON.stringify({
        type: 'user',
        message: {
            role: 'user',
            content: '<command-name>/kit-goal</command-name>\n            '
                + '<command-message>kit-goal</command-message>\n            '
                + '<command-args>' + planRel + '</command-args>'
        }
    }));
    for (const t of assistantTexts) {
        lines.push(JSON.stringify({
            type: 'assistant',
            message: { role: 'assistant', content: [{ type: 'text', text: t }] }
        }));
    }
    writeFile(full, lines.join('\n') + '\n');
}

// Run the hook with the given payload, isolating it from real machine state:
// LOCALAPPDATA and the goal-event sink are pinned to the caller's temp root, so
// a case sees only the fixtures it builds and writes only inside them. Returns
// the spawnSync result (stdout, stderr, status). Clause-(b) retries are disabled
// by default so block-path tests stay fast and an ambient KIT_GOAL_STOP_RETRY_MS
// cannot warp the suite's timing; pass extraEnv to exercise a real schedule.
//
// The ambient copy is scrubbed before extraEnv is merged in, not after: a case
// that opts into a real KIT_RUN_ID (or the vector/section pair) via extraEnv
// must see it survive, or this suite could never host an end-to-end case for
// a field this section adds to the stream.
function runHook(payload, localAppData, extraEnv) {
    const env = {
        ...scrubRunEnv({ ...process.env }),
        KIT_GOAL_STOP_RETRY_MS: '0',
        KIT_EVENTS_PATH: eventsPath(localAppData),
        KIT_EVENTS_PATH_ALLOW: '1',
        ...(extraEnv || {})
    };
    if (localAppData !== undefined) env.LOCALAPPDATA = localAppData;
    return spawnSync(process.execPath, [HOOK], {
        input: JSON.stringify(payload),
        env,
        encoding: 'utf8'
    });
}

// Arm a goal in a fresh repo with an In-Progress plan, and lay down a transcript
// that references the plan. Returns { repo, planRel, transcript, local }.
function armedRepo(assistantTexts, planStatus) {
    const repo = makeDir('kit-goal-stop-repo-');
    const local = makeDir('kit-goal-stop-local-');
    const planRel = 'docs/plans/example.md';
    const planFull = path.join(repo, planRel);
    // Arm against an In-Progress plan (armGoal refuses a Complete one), then
    // rewrite the plan header to the requested status so the hook's clause-(a)
    // check sees the intended live state.
    writeFile(planFull, 'Status: In Progress\n\nbody\n');
    const armed = armGoal(repo, planRel);
    assert.strictEqual(armed.ok, true, 'test setup: goal should arm');
    if (planStatus && planStatus !== 'Status: In Progress') {
        writeFile(planFull, planStatus + '\n\nbody\n');
    }
    const transcript = path.join(repo, 'transcript.jsonl');
    writeTranscript(transcript, planRel, assistantTexts || ['Working on it.']);
    return { repo, planRel, transcript, local };
}

test('no goal armed: empty stdout (allow)', () => {
    const repo = makeDir('kit-goal-stop-repo-');
    const local = makeDir('kit-goal-stop-local-');
    try {
        const transcript = path.join(repo, 'transcript.jsonl');
        writeTranscript(transcript, 'docs/plans/example.md', ['Working.']);
        const res = runHook({ cwd: repo, transcript_path: transcript }, local);
        assert.strictEqual(res.stdout, '');
        assert.strictEqual(res.status, 0);
    } finally {
        rmDir(repo);
        rmDir(local);
    }
});

test('goal armed, transcript names plan, In Progress, no BLOCKED: block', () => {
    const { repo, planRel, transcript, local } = armedRepo(['Making progress.']);
    try {
        const res = runHook({ cwd: repo, transcript_path: transcript }, local);
        assert.strictEqual(res.status, 0);
        const out = JSON.parse(res.stdout);
        assert.strictEqual(out.decision, 'block');
        assert.ok(out.reason.includes(path.basename(planRel)), 'reason names the plan basename');
        assert.ok(out.reason.includes('subagent dispatch and Workflows'),
            "the block reason restates the user's per-run parallelization request");
    } finally {
        rmDir(repo);
        rmDir(local);
    }
});

test('unbound goal: the plan path in a LATER <command-args> span still claims (every span searched)', () => {
    // Pins the all-spans search in userCommandArgsInclude: an invocation can
    // carry more than one <command-args> span, and the plan path counts
    // wherever it rides. A first-span-only read would miss this claim, leave
    // the session unleashed, and pass every single-span case silently.
    const repo = makeDir('kit-goal-stop-repo-');
    const local = makeDir('kit-goal-stop-local-');
    try {
        const planRel = 'docs/plans/example.md';
        writeFile(path.join(repo, planRel), 'Status: In Progress\n\nbody\n');
        const armed = armGoal(repo, planRel);
        assert.strictEqual(armed.ok, true, 'test setup: goal should arm');
        const transcript = path.join(repo, 'transcript.jsonl');
        writeFile(transcript, [
            JSON.stringify({
                type: 'user',
                message: {
                    role: 'user',
                    content: '<command-name>/kit-goal</command-name>\n'
                        + '<command-message>kit-goal</command-message>\n'
                        + '<command-args>status</command-args>\n'
                        + '<command-args>' + planRel + '</command-args>'
                }
            }),
            JSON.stringify({
                type: 'assistant',
                message: { role: 'assistant', content: [{ type: 'text', text: 'Working on it.' }] }
            })
        ].join('\n') + '\n');
        const res = runHook({ cwd: repo, transcript_path: transcript, session_id: 'ses-claimer' }, local);
        assert.strictEqual(res.status, 0);
        const out = JSON.parse(res.stdout);
        assert.strictEqual(out.decision, 'block', 'the claim binds and the leash enforces');
    } finally {
        rmDir(repo);
        rmDir(local);
    }
});

test('goal armed but transcript does NOT name the plan: empty stdout (scoping allow)', () => {
    const { repo, local } = armedRepo(['Making progress.']);
    try {
        const other = path.join(repo, 'unrelated.jsonl');
        writeFile(other, JSON.stringify({
            type: 'assistant',
            message: { role: 'assistant', content: [{ type: 'text', text: 'Different work entirely.' }] }
        }) + '\n');
        const res = runHook({ cwd: repo, transcript_path: other }, local);
        assert.strictEqual(res.stdout, '');
        assert.strictEqual(res.status, 0);
    } finally {
        rmDir(repo);
        rmDir(local);
    }
});

test('goal armed, plan Status: Complete: empty stdout AND goal auto-cleared', () => {
    const { repo, transcript, local } = armedRepo(['Done all sections.'], 'Status: Complete');
    try {
        assert.ok(fs.existsSync(path.join(repo, '.kit', 'goal-state.json')), 'setup: goal armed');
        const res = runHook({ cwd: repo, transcript_path: transcript }, local);
        assert.strictEqual(res.stdout, '');
        assert.strictEqual(res.status, 0);
        assert.ok(!fs.existsSync(path.join(repo, '.kit', 'goal-state.json')), 'goal auto-cleared on Complete');
    } finally {
        rmDir(repo);
        rmDir(local);
    }
});

test('goal armed, plan file deleted (archived): empty stdout AND goal auto-cleared', () => {
    const { repo, planRel, transcript, local } = armedRepo(['Still going.']);
    try {
        fs.rmSync(path.join(repo, planRel));
        const res = runHook({ cwd: repo, transcript_path: transcript }, local);
        assert.strictEqual(res.stdout, '');
        assert.strictEqual(res.status, 0);
        assert.ok(!fs.existsSync(path.join(repo, '.kit', 'goal-state.json')), 'goal auto-cleared when plan is gone');
    } finally {
        rmDir(repo);
        rmDir(local);
    }
});

test('goal armed, last assistant turn leads with BLOCKED: empty stdout (allow); only the last turn counts', () => {
    // An earlier turn without BLOCKED proves the scan reads the LAST assistant
    // turn, not the first match.
    const { repo, transcript, local } = armedRepo([
        'Investigating the failure.',
        'BLOCKED: this needs a decision only Scott can make.'
    ]);
    try {
        const res = runHook({ cwd: repo, transcript_path: transcript }, local);
        assert.strictEqual(res.stdout, '');
        assert.strictEqual(res.status, 0);
    } finally {
        rmDir(repo);
        rmDir(local);
    }
});

test('goal armed, an EARLIER turn had BLOCKED but the last did not: block (only the last counts)', () => {
    const { repo, transcript, local } = armedRepo([
        'BLOCKED: was blocked earlier.',
        'Now unblocked and back to work.'
    ]);
    try {
        const res = runHook({ cwd: repo, transcript_path: transcript }, local);
        const out = JSON.parse(res.stdout);
        assert.strictEqual(out.decision, 'block');
    } finally {
        rmDir(repo);
        rmDir(local);
    }
});

test('self-injection: plan named only in a hook attachment or tool_result does NOT leash: allow', () => {
    // The scoping guard's worst case: session-start surfacing injects the armed
    // plan path into EVERY session's transcript as a hook_additional_context
    // attachment. An unrelated session whose genuine user/assistant text never
    // names the plan must not be leashed by that self-injection (or by a
    // tool_result that merely echoes the path).
    const { repo, planRel, local } = armedRepo(['unused']);
    try {
        const tx = path.join(repo, 'unrelated-session.jsonl');
        // The real SessionStart injection is a top-level type:"attachment" with
        // the plan path nested in attachment.stdout (attachment.type
        // "hook_success"); mirror that shape so the fixture pins the real carrier.
        const lines = [
            JSON.stringify({ type: 'user', message: { role: 'user', content: 'Fix the CSS on the login page.' } }),
            JSON.stringify({ type: 'attachment', attachment: { type: 'hook_success', stdout: 'A kit goal is armed for ' + planRel + ' in this project.' } }),
            JSON.stringify({ type: 'user', message: { role: 'user', content: [{ type: 'tool_result', content: 'grep hit: ' + planRel }] } }),
            JSON.stringify({ type: 'assistant', message: { role: 'assistant', content: [{ type: 'text', text: 'The login CSS is fixed.' }] } })
        ];
        writeFile(tx, lines.join('\n') + '\n');
        const res = runHook({ cwd: repo, transcript_path: tx }, local);
        assert.strictEqual(res.stdout, '', 'an unrelated session must not be leashed by the self-injected plan name');
        assert.strictEqual(res.status, 0);
    } finally {
        rmDir(repo);
        rmDir(local);
    }
});

test('assistant text alone naming the plan does NOT leash: allow', () => {
    // The scoping predicate reads genuine USER-side command-args text only, so
    // an assistant echo of the plan path (e.g. quoting the session-start goal
    // surfacing back to the user) must never bind the leash.
    const { repo, planRel, local } = armedRepo(['unused']);
    try {
        const tx = path.join(repo, 'assistant-echo.jsonl');
        const lines = [
            JSON.stringify({ type: 'user', message: { role: 'user', content: 'Help me with an unrelated task.' } }),
            JSON.stringify({ type: 'assistant', message: { role: 'assistant', content: [{ type: 'text', text: 'A kit goal is armed for ' + planRel + ' in this project.' }] } })
        ];
        writeFile(tx, lines.join('\n') + '\n');
        const res = runHook({ cwd: repo, transcript_path: tx, session_id: 'bystander-sess' }, local);
        assert.strictEqual(res.stdout, '', 'an assistant self-quote of the plan path must not leash the session');
        assert.strictEqual(res.status, 0);
    } finally {
        rmDir(repo);
        rmDir(local);
    }
});

test('scoping matches the full plan path, not just the basename: a same-name file in another dir does not leash', () => {
    const { repo, local } = armedRepo(['unused']); // goal armed for docs/plans/example.md
    try {
        const tx = path.join(repo, 'other-example.jsonl');
        // Genuine user/assistant text names docs/ARCHIVE/example.md (same basename,
        // different dir) but never the armed docs/plans/example.md.
        const lines = [
            JSON.stringify({ type: 'user', message: { role: 'user', content: 'Review docs/archive/example.md for me.' } }),
            JSON.stringify({ type: 'assistant', message: { role: 'assistant', content: [{ type: 'text', text: 'Reviewed docs/archive/example.md; looks fine.' }] } })
        ];
        writeFile(tx, lines.join('\n') + '\n');
        const res = runHook({ cwd: repo, transcript_path: tx }, local);
        assert.strictEqual(res.stdout, '', 'a same-basename file in another directory must not leash the session');
        assert.strictEqual(res.status, 0);
    } finally {
        rmDir(repo);
        rmDir(local);
    }
});

function readBoundSession(repo) {
    return JSON.parse(fs.readFileSync(path.join(repo, '.kit', 'goal-state.json'), 'utf8')).boundSession;
}

test('unbound goal, a plain prose mention of the plan does NOT claim: allow, still unbound', () => {
    // A bystander that merely types or discusses the plan path in ordinary
    // prose (not as a slash-command argument) must not steal the binding: only
    // the genuine arming invocation (see the command-args test below) claims.
    const { repo, planRel, local } = armedRepo(['unused']);
    try {
        const tx = path.join(repo, 'prose-mention.jsonl');
        writeFile(tx, JSON.stringify({
            type: 'user',
            message: { role: 'user', content: 'Please work ' + planRel + ' to completion.' }
        }) + '\n');
        const res = runHook({ cwd: repo, transcript_path: tx, session_id: 'sess-bystander' }, local);
        assert.strictEqual(res.stdout, '', 'a plain prose mention must not claim the binding');
        assert.strictEqual(res.status, 0);
        assert.strictEqual(readBoundSession(repo), null, 'the goal stays unbound');
    } finally {
        rmDir(repo);
        rmDir(local);
    }
});

test('bound to another session: a plan-naming bystander is not leashed: allow', () => {
    // The transcript carries the arming invocation, so this also pins the order:
    // an existing binding gates before the command-args claim, and a session that
    // is not the bound one is allowed even when its text would otherwise claim.
    const { repo, transcript, local } = armedRepo(['Working hard, mentioning docs/plans/example.md often.']);
    try {
        assert.strictEqual(bindSession(repo, 'sess-owner').ok, true);
        const res = runHook({ cwd: repo, transcript_path: transcript, session_id: 'sess-bystander' }, local);
        assert.strictEqual(res.stdout, '', 'only the bound session is leashed');
        assert.strictEqual(res.status, 0);
        assert.strictEqual(readBoundSession(repo), 'sess-owner', 'the bystander does not steal the binding');
    } finally {
        rmDir(repo);
        rmDir(local);
    }
});

test('bound to this session (case-insensitive): a non-BLOCKED turn still blocks (a case-sensitive compare would misread this as a bystander and allow)', () => {
    const { repo, transcript, local } = armedRepo(['Making progress.']);
    try {
        assert.strictEqual(bindSession(repo, 'sess-me').ok, true);
        // The stopping session_id differs only in case from the bound value. A
        // case-sensitive compare would fail to recognize it as the bound session,
        // fall through to "some other session", and allow (empty stdout) - the
        // same outcome a correct compare produces on a genuine BLOCKED lead, which
        // is why that shape cannot tell the two implementations apart. A non-
        // BLOCKED last turn can: only the correct case-insensitive match reaches
        // enforcement and blocks.
        const res = runHook({ cwd: repo, transcript_path: transcript, session_id: 'SESS-ME' }, local);
        assert.strictEqual(res.status, 0);
        const out = JSON.parse(res.stdout);
        assert.strictEqual(out.decision, 'block', 'the case-differing bound session is still enforced');
    } finally {
        rmDir(repo);
        rmDir(local);
    }
});

test('the /kit-goal arming invocation (command-args) binds the leash and enforces', () => {
    const { repo, planRel, local } = armedRepo(['unused']);
    try {
        const tx = path.join(repo, 'arming.jsonl');
        // Real slash-command invocation shape: a user entry whose string content
        // carries <command-name>/<command-args>; the plan path the user typed as
        // the argument is the deliberate arming signal.
        const invocation = '<command-name>/kit-goal</command-name>\n            '
            + '<command-message>kit-goal</command-message>\n            '
            + '<command-args>' + planRel + '</command-args>';
        writeFile(tx, JSON.stringify({ type: 'user', message: { role: 'user', content: invocation } }) + '\n');
        const res = runHook({ cwd: repo, transcript_path: tx, session_id: 'arming-sess' }, local);
        const out = JSON.parse(res.stdout);
        assert.strictEqual(out.decision, 'block', 'the arming invocation leashes and enforces');
        assert.strictEqual(readBoundSession(repo), 'arming-sess');
    } finally {
        rmDir(repo);
        rmDir(local);
    }
});

test('a non-kit-goal command (/graphify) carrying the plan path in its args does NOT claim: allow', () => {
    // /graphify legitimately takes a path argument; a plan path in ITS
    // command-args must not steal the binding from the arming session. Only a
    // kit-goal invocation's command-args counts as an arming claim.
    const { repo, planRel, local } = armedRepo(['unused']);
    try {
        const tx = path.join(repo, 'graphify.jsonl');
        writeFile(tx, JSON.stringify({
            type: 'user', isSidechain: false,
            message: {
                role: 'user',
                content: '<command-message>graphify</command-message>\n'
                    + '<command-name>/graphify</command-name>\n'
                    + '<command-args>' + planRel + '</command-args>'
            }
        }) + '\n');
        const res = runHook({ cwd: repo, transcript_path: tx, session_id: 'graphify-sess' }, local);
        assert.strictEqual(res.stdout, '', 'a non-kit-goal command must not claim the binding');
        assert.strictEqual(res.status, 0);
        assert.strictEqual(readBoundSession(repo), null, 'the goal stays unbound');
    } finally {
        rmDir(repo);
        rmDir(local);
    }
});

test('the real namespaced /kit-goal arming record (backtick-wrapped args) binds the leash', () => {
    const repo = makeDir('kit-goal-stop-repo-');
    const local = makeDir('kit-goal-stop-local-');
    const planRel = 'docs/plans/claude-kit_goal-continuity_spec_v1.md';
    try {
        writeFile(path.join(repo, planRel), 'Status: In Progress\n\nbody\n');
        assert.strictEqual(armGoal(repo, planRel).ok, true);
        const tx = path.join(repo, 'arming.jsonl');
        // Verbatim real arming record: namespaced command-name (/claude-kit:kit-goal),
        // no isMeta field, backtick-wrapped args value. The substring match tolerates
        // the backticks, and the command-name gate accepts the ':kit-goal' suffix.
        writeFile(tx, JSON.stringify({
            type: 'user', isSidechain: false,
            message: {
                role: 'user',
                content: '<command-message>claude-kit:kit-goal</command-message>\n'
                    + '<command-name>/claude-kit:kit-goal</command-name>\n'
                    + '<command-args>`' + planRel + '`</command-args>'
            }
        }) + '\n');
        const res = runHook({ cwd: repo, transcript_path: tx, session_id: 'arming-sess' }, local);
        const out = JSON.parse(res.stdout);
        assert.strictEqual(out.decision, 'block', 'the namespaced arming invocation leashes and enforces');
        assert.strictEqual(readBoundSession(repo), 'arming-sess');
    } finally {
        rmDir(repo);
        rmDir(local);
    }
});

test('a local-command-stdout echoing the plan path does NOT bind (a /kit-goal status check in a bystander)', () => {
    const { repo, planRel, local } = armedRepo(['unused']);
    try {
        const tx = path.join(repo, 'status.jsonl');
        // Real /kit-goal status flow: the user types `status` (no plan path in the
        // args), and the CLI echoes the armed plan path back inside a
        // <local-command-stdout> block. That echo is the CLI's own output, not
        // user-typed text, so a bystander that merely checked status must not bind.
        const lines = [
            JSON.stringify({ type: 'user', message: { role: 'user', content: 'Look at the login page.' } }),
            JSON.stringify({ type: 'user', message: { role: 'user', content: '<command-name>/kit-goal</command-name>\n            <command-args>status</command-args>' } }),
            JSON.stringify({ type: 'user', message: { role: 'user', content: '<local-command-stdout>kit goal armed for ' + planRel + ' (armed 2026-07-16T00:00:00.000Z; unbound)</local-command-stdout>' } })
        ];
        writeFile(tx, lines.join('\n') + '\n');
        const res = runHook({ cwd: repo, transcript_path: tx, session_id: 'bystander' }, local);
        assert.strictEqual(res.stdout, '', 'a status echo of the plan path must not leash a bystander');
        assert.strictEqual(res.status, 0);
    } finally {
        rmDir(repo);
        rmDir(local);
    }
});

test('isMeta stop-hook feedback carrying a command-args-wrapped plan path does NOT claim', () => {
    // Real shape: this hook's own block reason names the plan path in full, and
    // the harness replays a denied stop back into the transcript as an isMeta
    // user entry ("Stop hook feedback: ..."). That entry can end up containing
    // text that reads exactly like a genuine <command-args> claim; isMeta must
    // win regardless, since none of it is something the user typed.
    const { repo, planRel, local } = armedRepo(['unused']);
    try {
        const tx = path.join(repo, 'stop-feedback.jsonl');
        const feedback = 'Stop hook feedback:\n[Implement `<command-name>/kit-goal</command-name>'
            + '<command-args>' + planRel + '</command-args>` and continue.]';
        writeFile(tx, JSON.stringify({
            type: 'user',
            isMeta: true,
            message: { role: 'user', content: feedback }
        }) + '\n');
        const res = runHook({ cwd: repo, transcript_path: tx, session_id: 'bystander-fed-back' }, local);
        assert.strictEqual(res.stdout, '', 'an isMeta entry must not claim even when it carries a command-args-shaped span');
        assert.strictEqual(res.status, 0);
        assert.strictEqual(readBoundSession(repo), null, 'the goal stays unbound');
    } finally {
        rmDir(repo);
        rmDir(local);
    }
});

test('a stray closing tag of a different name inside local-command output does not leave a fake command-args claimable', () => {
    // Realistic in this very repo: a user cats or greps a file whose content
    // includes literal tag-like text (e.g. a fixture in this test suite). The
    // CLI echoes that content inside <local-command-stdout>, which coincidentally
    // contains a mismatched closing tag before the block's true close, followed
    // by an embedded fake <command-args> wrapping the real plan path. The strip
    // must follow the backreferenced close (skipping the stray mismatched one)
    // to the true </local-command-stdout>, removing the whole block, so the
    // embedded fake claim never surfaces as ordinary user text.
    const { repo, planRel, local } = armedRepo(['unused']);
    try {
        const tx = path.join(repo, 'stray-tag.jsonl');
        const content = '<local-command-stdout>noise before </local-command-caveat> '
            + '<command-args>' + planRel + '</command-args> more noise</local-command-stdout> '
            + 'Genuine unrelated user text.';
        writeFile(tx, JSON.stringify({ type: 'user', message: { role: 'user', content } }) + '\n');
        const res = runHook({ cwd: repo, transcript_path: tx, session_id: 'bystander-cat' }, local);
        assert.strictEqual(res.stdout, '', 'the embedded fake command-args inside CLI-echoed output must not claim');
        assert.strictEqual(res.status, 0);
        assert.strictEqual(readBoundSession(repo), null, 'the goal stays unbound');
    } finally {
        rmDir(repo);
        rmDir(local);
    }
});

test('an unclosed local-command opener (a truncated CLI echo) is stripped to end-of-text and cannot claim', () => {
    // No closing tag anywhere: a truncated echo (cut by the transcript read cap,
    // or caught mid-write). Without the unclosed-opener fallback, the embedded
    // command-args-shaped text would never be stripped and would read as a
    // genuine claim.
    const { repo, planRel, local } = armedRepo(['unused']);
    try {
        const tx = path.join(repo, 'unclosed.jsonl');
        const content = '<local-command-stdout>truncated echo showing '
            + '<command-args>' + planRel + '</command-args> partial output cut off';
        writeFile(tx, JSON.stringify({ type: 'user', message: { role: 'user', content } }) + '\n');
        const res = runHook({ cwd: repo, transcript_path: tx, session_id: 'bystander-trunc' }, local);
        assert.strictEqual(res.stdout, '', 'an unclosed opener\'s content must not claim');
        assert.strictEqual(res.status, 0);
        assert.strictEqual(readBoundSession(repo), null, 'the goal stays unbound');
    } finally {
        rmDir(repo);
        rmDir(local);
    }
});

test('an embedded same-name close tag inside CLI output cannot expose a following fake kit-goal claim', () => {
    // The one strip failure mode that errs toward CLAIMING: echoed stdout (e.g. a
    // catted transcript) embeds a literal </local-command-stdout>, then a fake
    // kit-goal command-name plus command-args naming the plan, before the block's
    // true close. A lazy strip would stop at the embedded close and leave the fake
    // claim exposed; the greedy strip runs to the LAST same-name close, removing
    // the whole block so nothing between the opener and its final close survives.
    const { repo, planRel, local } = armedRepo(['unused']);
    try {
        const tx = path.join(repo, 'embedded-close.jsonl');
        const content = '<local-command-stdout>cat transcript: </local-command-stdout>'
            + '<command-name>/kit-goal</command-name><command-args>' + planRel + '</command-args>'
            + ' end of cat</local-command-stdout> Genuine unrelated text.';
        writeFile(tx, JSON.stringify({ type: 'user', message: { role: 'user', content } }) + '\n');
        const res = runHook({ cwd: repo, transcript_path: tx, session_id: 'bystander-cat' }, local);
        assert.strictEqual(res.stdout, '', 'an embedded close tag must not expose a following fake command-args claim');
        assert.strictEqual(res.status, 0);
        assert.strictEqual(readBoundSession(repo), null, 'the goal stays unbound');
    } finally {
        rmDir(repo);
        rmDir(local);
    }
});

// Spawn the hook and, before writing its stdin, synchronously occupy the exact
// tmp path bindSession will try to write to (goal-state.json.tmp.<the child's
// own pid>) with a directory, so that specific write fails. readStdin() blocks
// the child on a synchronous read until stdin is written and closed, so the
// child cannot reach its write step before this obstruction is in place: this
// is deterministic, not timing-dependent, and (unlike a bare spawnSync, whose
// pid is only known after the child has already finished) works because
// spawn() exposes the child's pid immediately.
function runHookForcingBindWriteFailure(repo, payload, extraEnv) {
    const env = {
        ...scrubRunEnv({ ...process.env }),
        KIT_GOAL_STOP_RETRY_MS: '0',
        KIT_EVENTS_PATH: eventsPath(repo),
        KIT_EVENTS_PATH_ALLOW: '1',
        ...(extraEnv || {})
    };
    const child = spawn(process.execPath, [HOOK], { env });
    fs.mkdirSync(path.join(repo, '.kit', 'goal-state.json.tmp.' + child.pid), { recursive: true });
    let stdout = '';
    child.stdout.on('data', (d) => { stdout += d; });
    const closed = new Promise((resolve) => child.on('close', (status) => resolve(status)));
    child.stdin.write(JSON.stringify(payload));
    child.stdin.end();
    return closed.then((status) => ({ stdout, status }));
}

test('a bind write failure still enforces that stop (fail-open on persistence, not enforcement)', async () => {
    const { repo, transcript, local } = armedRepo(['Making progress.']);
    try {
        // The goal-state.json itself is still readable (unbound), so the session
        // resolves via the arming-invocation claim and must still be enforced.
        const res = await runHookForcingBindWriteFailure(
            repo, { cwd: repo, transcript_path: transcript, session_id: 'sess-x' });
        const out = JSON.parse(res.stdout);
        assert.strictEqual(out.decision, 'block', 'enforcement proceeds even when the bind write fails');
        assert.strictEqual(readBoundSession(repo), null, 'the failed bind did not persist');
    } finally {
        rmDir(repo);
        rmDir(local);
    }
});

test('a sidechain (sub-agent) BLOCKED turn does not count; the last main-thread turn decides: block', () => {
    const { repo, planRel, local } = armedRepo(['unused']);
    try {
        const tx = path.join(repo, 'sidechain.jsonl');
        const lines = [
            JSON.stringify({ type: 'user', message: { role: 'user', content: '<command-name>/kit-goal</command-name><command-args>' + planRel + '</command-args>' } }),
            JSON.stringify({ type: 'assistant', message: { role: 'assistant', content: [{ type: 'text', text: 'Dispatching a reviewer.' }] } }),
            JSON.stringify({ type: 'assistant', isSidechain: true, message: { role: 'assistant', content: [{ type: 'text', text: 'BLOCKED: the sub-agent is blocked.' }] } })
        ];
        writeFile(tx, lines.join('\n') + '\n');
        const res = runHook({ cwd: repo, transcript_path: tx }, local);
        const out = JSON.parse(res.stdout);
        assert.strictEqual(out.decision, 'block', 'a sidechain BLOCKED must not release the main-thread leash');
    } finally {
        rmDir(repo);
        rmDir(local);
    }
});

test('stop_hook_active true: still blocks (the leash re-evaluates every stop attempt)', () => {
    // The harness's own consecutive-block cap (CLAUDE_CODE_STOP_HOOK_BLOCK_CAP)
    // is the loop backstop; the hook itself must keep holding inside a stop
    // continuation, or the leash is one-shot per turn.
    const { repo, transcript, local } = armedRepo(['Making progress.']);
    try {
        const res = runHook({ cwd: repo, transcript_path: transcript, stop_hook_active: true }, local);
        assert.strictEqual(res.status, 0);
        const out = JSON.parse(res.stdout);
        assert.strictEqual(out.decision, 'block', 'a stop-hook continuation must not release the leash');
    } finally {
        rmDir(repo);
        rmDir(local);
    }
});

test('a mid-append partial final line makes the last turn indeterminate: allow', () => {
    // The harness appends the turn's final entries (assistant text, stop-time
    // metadata) around the same moment the Stop hook runs. A read that lands
    // mid-append sees a truncated JSON fragment as the last line; the last turn
    // is then indeterminate and the stop must be allowed, not answered from the
    // previous turn's text. The file is far below the 1MB tail cap, so this
    // exercises the mid-write guard, not the cap-truncation guard.
    const { repo, transcript, local } = armedRepo(['Making progress.']);
    try {
        fs.appendFileSync(transcript,
            '{"type":"assistant","message":{"role":"assistant","content":[{"type":"te');
        const res = runHook({ cwd: repo, transcript_path: transcript }, local);
        assert.strictEqual(res.stdout, '', 'a mid-write tail must be indeterminate (allow), not read as the prior turn');
        assert.strictEqual(res.status, 0);
    } finally {
        rmDir(repo);
        rmDir(local);
    }
});

test('clause (b) tolerates the stop-time flush race: a BLOCKED entry landing just after the stop still allows', async () => {
    // Live-observed race: the hook can evaluate before the harness's append of
    // the final assistant text entry is readable, so a genuine 'BLOCKED:' exit
    // was answered from the previous turn and blocked. The hook re-reads after
    // a short delay; an entry that lands inside that window must be honored.
    // Probabilistic pin: if child spawn plus first read ever exceeds the 250ms
    // append delay, the first read already sees the entry and the retry path is
    // not exercised that run; the test can green vacuously on a slow machine
    // but can never falsely fail (any ordering yields an allow).
    const { repo, transcript, local } = armedRepo(['Working; about to surface a blocker.']);
    try {
        const env = scrubRunEnv({
            ...process.env,
            KIT_GOAL_STOP_RETRY_MS: '900',
            KIT_EVENTS_PATH: eventsPath(local),
            KIT_EVENTS_PATH_ALLOW: '1'
        });
        const child = spawn(process.execPath, [HOOK], { env });
        let stdout = '';
        child.stdout.on('data', (d) => { stdout += d; });
        const closed = new Promise((resolve) => child.on('close', resolve));
        child.stdin.write(JSON.stringify({ cwd: repo, transcript_path: transcript }));
        child.stdin.end();
        // Land the BLOCKED entry after the hook's first read, inside its retry window.
        await new Promise((resolve) => setTimeout(resolve, 250));
        fs.appendFileSync(transcript, JSON.stringify({
            type: 'assistant',
            message: { role: 'assistant', content: [{ type: 'text', text: 'BLOCKED: needs a supervised step.' }] }
        }) + '\n');
        await closed;
        assert.strictEqual(stdout, '', 'the late-landing BLOCKED entry must be seen by the clause-(b) re-read');
    } finally {
        rmDir(repo);
        rmDir(local);
    }
});

test('a partial final line that completes into a non-BLOCKED entry inside the retry window: block', async () => {
    // The other half of the mid-append guard: a partial tail is retried, not
    // allowed on first sighting, so when the in-flight append resolves to an
    // ordinary (non-BLOCKED) turn inside the window, the leash correctly holds.
    const { repo, transcript, local } = armedRepo(['Making progress.']);
    try {
        const full = JSON.stringify({
            type: 'assistant',
            message: { role: 'assistant', content: [{ type: 'text', text: 'Just progress, not a blocker.' }] }
        });
        fs.appendFileSync(transcript, full.slice(0, 40));
        const env = scrubRunEnv({
            ...process.env,
            KIT_GOAL_STOP_RETRY_MS: '900',
            KIT_EVENTS_PATH: eventsPath(local),
            KIT_EVENTS_PATH_ALLOW: '1'
        });
        const child = spawn(process.execPath, [HOOK], { env });
        let stdout = '';
        child.stdout.on('data', (d) => { stdout += d; });
        const closed = new Promise((resolve) => child.on('close', resolve));
        child.stdin.write(JSON.stringify({ cwd: repo, transcript_path: transcript }));
        child.stdin.end();
        // Complete the in-flight entry inside the hook's retry window.
        await new Promise((resolve) => setTimeout(resolve, 250));
        fs.appendFileSync(transcript, full.slice(40) + '\n');
        await closed;
        const out = JSON.parse(stdout);
        assert.strictEqual(out.decision, 'block', 'a partial tail resolving to a non-BLOCKED turn must still block');
    } finally {
        rmDir(repo);
        rmDir(local);
    }
});

test('KIT_GOAL_STOP_RETRY_MS parsing fails open and never throws: 0, garbage, and mixed junk all still block promptly', () => {
    // The env boundary of the retry schedule: a disable ('0'), pure garbage, and
    // a mixed junk list must all degrade to "no retries" (or sane clamped
    // delays), never to a throw, which the top-level catch would turn into a
    // silent allow on every leashed stop.
    const { repo, transcript, local } = armedRepo(['Making progress.']);
    try {
        for (const raw of ['0', 'garbage', '-5,abc']) {
            const res = runHook({ cwd: repo, transcript_path: transcript }, local,
                { KIT_GOAL_STOP_RETRY_MS: raw });
            assert.strictEqual(res.status, 0, `retry env '${raw}' must not crash the hook`);
            const out = JSON.parse(res.stdout);
            assert.strictEqual(out.decision, 'block', `retry env '${raw}' must still block`);
        }
    } finally {
        rmDir(repo);
        rmDir(local);
    }
});

test('malformed stdin: empty stdout, exit 0 (never throws)', () => {
    // This payload never resolves a project, so it cannot reach an emit; the
    // sink is still pinned into a temp root of this case's own, so the spawn
    // has no path to the real event stream at all.
    const local = makeDir('kit-goal-stop-local-');
    try {
        const env = scrubRunEnv({ ...process.env, KIT_EVENTS_PATH: eventsPath(local), KIT_EVENTS_PATH_ALLOW: '1' });
        const res = spawnSync(process.execPath, [HOOK], { input: 'not json', env, encoding: 'utf8' });
        assert.strictEqual(res.stdout, '');
        assert.strictEqual(res.status, 0);
    } finally {
        rmDir(local);
    }
});

test('goal armed but transcript path absent: empty stdout (cannot scope, so allow)', () => {
    const { repo, local } = armedRepo(['Working.']);
    try {
        const res = runHook({ cwd: repo }, local);
        assert.strictEqual(res.stdout, '');
        assert.strictEqual(res.status, 0);
    } finally {
        rmDir(repo);
        rmDir(local);
    }
});

test('release event: a Complete plan emits exactly one goal-complete/plan-complete line with the full schema', () => {
    const { repo, planRel, transcript, local } = armedRepo(['Done all sections.'], 'Status: Complete');
    try {
        const res = runHook({ cwd: repo, transcript_path: transcript, session_id: 'sess-releaser' }, local);
        assert.strictEqual(res.stdout, '');
        const events = readEvents(local);
        assert.strictEqual(events.length, 1, 'a release emits exactly one event');
        const ev = events[0];
        assert.deepStrictEqual(Object.keys(ev), ['ts', 'event', 'project', 'plan', 'session', 'detail']);
        assert.strictEqual(ev.event, 'goal-complete');
        assert.strictEqual(ev.project, repo, 'project is the absolute project path from the payload');
        assert.strictEqual(ev.plan, planRel, 'plan is the repo-relative plan path');
        assert.strictEqual(ev.session, 'sess-releaser');
        assert.strictEqual(ev.detail, 'plan-complete');
        assert.ok(!Number.isNaN(Date.parse(ev.ts)));
    } finally {
        rmDir(repo);
        rmDir(local);
    }
});

test('release event: a real KIT_RUN_ID reaches the stream through the actual producer, in the fleet configuration the field exists for', () => {
    // The field's only other coverage is in-process against kit-goal-lib.js
    // directly (kit-goal-lib.test.js); this exercises it through the real
    // Stop-hook release path, spawned, the shape a fleet worker actually
    // produces. extraEnv survives scrubRunEnv here because runHook scrubs the
    // ambient copy before merging extraEnv in, not after.
    const { repo, planRel, transcript, local } = armedRepo(['Done all sections.'], 'Status: Complete');
    try {
        const res = runHook({ cwd: repo, transcript_path: transcript, session_id: 'sess-releaser' }, local,
            { KIT_RUN_ID: 'fleet-run-1' });
        assert.strictEqual(res.stdout, '');
        const events = readEvents(local);
        assert.strictEqual(events.length, 1);
        const ev = events[0];
        assert.deepStrictEqual(Object.keys(ev), ['ts', 'event', 'project', 'plan', 'session', 'detail', 'run']);
        assert.strictEqual(ev.run, 'fleet-run-1');
    } finally {
        rmDir(repo);
        rmDir(local);
    }
});

test('release event: an archived plan (file gone) emits goal-complete with detail plan-archived', () => {
    const { repo, planRel, transcript, local } = armedRepo(['Still going.']);
    try {
        fs.rmSync(path.join(repo, planRel));
        const res = runHook({ cwd: repo, transcript_path: transcript, session_id: 'sess-archiver' }, local);
        assert.strictEqual(res.stdout, '');
        const events = readEvents(local);
        assert.strictEqual(events.length, 1);
        assert.strictEqual(events[0].event, 'goal-complete');
        assert.strictEqual(events[0].detail, 'plan-archived', 'the archived release is distinguishable from a Complete one');
        assert.strictEqual(events[0].plan, planRel);
        assert.strictEqual(events[0].session, 'sess-archiver');
    } finally {
        rmDir(repo);
        rmDir(local);
    }
});

test('release event: a BLOCKED lead emits goal-blocked and carries no detail', () => {
    const { repo, planRel, transcript, local } = armedRepo([
        'Investigating the failure.',
        'BLOCKED: this needs a decision only Scott can make.'
    ]);
    try {
        const res = runHook({ cwd: repo, transcript_path: transcript, session_id: 'sess-blocked' }, local);
        assert.strictEqual(res.stdout, '');
        const events = readEvents(local);
        assert.strictEqual(events.length, 1);
        assert.deepStrictEqual(Object.keys(events[0]), ['ts', 'event', 'project', 'plan', 'session']);
        assert.strictEqual(events[0].event, 'goal-blocked');
        assert.strictEqual(events[0].plan, planRel);
        assert.strictEqual(events[0].session, 'sess-blocked');
    } finally {
        rmDir(repo);
        rmDir(local);
    }
});

test('a capacity-shaped BLOCKED reason releases nothing: block, no event', () => {
    // Capacity is excluded from the completion contract (auto-compaction keeps
    // the session id, so the leash rides through), and a refused release is not
    // a release, so the events file stays untouched.
    const { repo, transcript, local } = armedRepo([
        "BLOCKED: I'm at my context limit and need to hand off to a fresh session."
    ]);
    try {
        const res = runHook({ cwd: repo, transcript_path: transcript, session_id: 'sess-capacity' }, local);
        assert.strictEqual(res.status, 0);
        assert.notStrictEqual(res.stdout, '', 'a capacity-shaped BLOCKED must not release the leash');
        const out = JSON.parse(res.stdout);
        assert.strictEqual(out.decision, 'block');
        assert.ok(out.reason.includes('Capacity is never a blocker'),
            'the block quotes the contract clause it is enforcing');
        assert.deepStrictEqual(readEvents(local), [], 'a refused release emits nothing');
    } finally {
        rmDir(repo);
        rmDir(local);
    }
});

test('the capacity deny-list is case-insensitive: an upper-case reason is refused too', () => {
    const { repo, transcript, local } = armedRepo(['BLOCKED: OUT OF CONTEXT, pausing here.']);
    try {
        const res = runHook({ cwd: repo, transcript_path: transcript, session_id: 'sess-caps' }, local);
        assert.strictEqual(res.status, 0);
        assert.notStrictEqual(res.stdout, '', 'casing must not carry a capacity reason past the deny-list');
        const out = JSON.parse(res.stdout);
        assert.strictEqual(out.decision, 'block');
        assert.ok(out.reason.includes('Capacity is never a blocker'));
        assert.deepStrictEqual(readEvents(local), [], 'a refused release emits nothing');
    } finally {
        rmDir(repo);
        rmDir(local);
    }
});

test('a WAITING lead allows the stop with the goal intact and no event (clause b2)', () => {
    // Parked on dispatched background work: the completion notification is the
    // wake, so the stop is allowed, the leash stays armed for the first stop
    // after the wake, and nothing is emitted (a waiting session is a running
    // session to an outside watcher).
    const { repo, transcript, local } = armedRepo([
        'WAITING: on the section 2 implementer and its reviewer pair, dispatched in the background.'
    ]);
    try {
        const res = runHook({ cwd: repo, transcript_path: transcript, session_id: 'sess-waiting' }, local);
        assert.strictEqual(res.stdout, '');
        assert.strictEqual(res.status, 0);
        assert.ok(fs.existsSync(path.join(repo, '.kit', 'goal-state.json')),
            'a waiting stop must NOT clear the goal: the leash re-enters enforcement after the wake');
        assert.deepStrictEqual(readEvents(local), [], 'waiting is not a release and emits nothing');
    } finally {
        rmDir(repo);
        rmDir(local);
    }
});

test('a WAITING line mid-message does not release: block (the literal leading prefix rule)', () => {
    const { repo, transcript, local } = armedRepo([
        'Section 2 is dispatched.\nWAITING: on the background implementers.'
    ]);
    try {
        const res = runHook({ cwd: repo, transcript_path: transcript, session_id: 'sess-waiting-mid' }, local);
        const out = JSON.parse(res.stdout);
        assert.strictEqual(out.decision, 'block');
    } finally {
        rmDir(repo);
        rmDir(local);
    }
});

test('an EARLIER WAITING turn with a non-lead last turn: block (only the last counts)', () => {
    // The wake after a waiting stop lands new turns; the leash must re-enter
    // enforcement from the post-wake turn, not keep honoring the stale WAITING.
    const { repo, transcript, local } = armedRepo([
        'WAITING: on the background reviewers.',
        'Reviewers are back; folding in their findings.'
    ]);
    try {
        const res = runHook({ cwd: repo, transcript_path: transcript, session_id: 'sess-waiting-stale' }, local);
        const out = JSON.parse(res.stdout);
        assert.strictEqual(out.decision, 'block');
    } finally {
        rmDir(repo);
        rmDir(local);
    }
});

test('a capacity-shaped WAITING reason is refused: block naming WAITING, no event', () => {
    // Without this, WAITING becomes the escape hatch the clause-(b) capacity
    // refusal exists to close: the same deny-list judges both prefixes.
    const { repo, transcript, local } = armedRepo([
        'WAITING: for a fresh session to pick this up, my context is nearly full.'
    ]);
    try {
        const res = runHook({ cwd: repo, transcript_path: transcript, session_id: 'sess-waiting-cap' }, local);
        assert.strictEqual(res.status, 0);
        assert.notStrictEqual(res.stdout, '', 'a capacity-shaped WAITING must not release the leash');
        const out = JSON.parse(res.stdout);
        assert.strictEqual(out.decision, 'block');
        assert.ok(out.reason.includes('the WAITING line gives'),
            'the refusal names the prefix it is refusing');
        assert.ok(out.reason.includes('Capacity is never a blocker'));
        assert.deepStrictEqual(readEvents(local), [], 'a refused release emits nothing');
    } finally {
        rmDir(repo);
        rmDir(local);
    }
});

test('only the first line is judged: a genuine blocker mentioning context further down still releases', () => {
    // The deny-list reads the stated reason, which is the first line. A body
    // that happens to mention context pressure is commentary, not the reason,
    // so a real decision blocker below it must still release.
    const { repo, planRel, transcript, local } = armedRepo([
        'BLOCKED: need your call on the migration direction: A or B.\n'
        + 'For what it is worth I am also running low on context, but the decision is the blocker.'
    ]);
    try {
        const res = runHook({ cwd: repo, transcript_path: transcript, session_id: 'sess-decision' }, local);
        assert.strictEqual(res.status, 0);
        assert.strictEqual(res.stdout, '', 'a body mention of capacity must not trip the deny-list');
        const events = readEvents(local);
        assert.strictEqual(events.length, 1, 'the release emits exactly one event');
        assert.strictEqual(events[0].event, 'goal-blocked');
        assert.strictEqual(events[0].plan, planRel);
    } finally {
        rmDir(repo);
        rmDir(local);
    }
});

test('a session token, not a session handoff: "the new session token" still releases', () => {
    // The word pair "new session" inside a domain noun phrase is not a capacity
    // reason, so the deny-list requires a direction word (in/to/from) ahead of it.
    const { repo, planRel, transcript, local } = armedRepo([
        'BLOCKED: the new session token for staging expired, need you to re-auth.'
    ]);
    try {
        const res = runHook({ cwd: repo, transcript_path: transcript, session_id: 'sess-token' }, local);
        assert.strictEqual(res.status, 0);
        assert.strictEqual(res.stdout, '', 'a domain "new session token" must not read as a capacity reason');
        const events = readEvents(local);
        assert.strictEqual(events.length, 1);
        assert.strictEqual(events[0].event, 'goal-blocked');
        assert.strictEqual(events[0].plan, planRel);
    } finally {
        rmDir(repo);
        rmDir(local);
    }
});

test('a domain handoff with no session or context talk still releases', () => {
    // "handoff" alone names a real decision here (who owns a deployment), which
    // is why the ambiguous tier needs a pairing word before it denies.
    const { repo, transcript, local } = armedRepo([
        'BLOCKED: choose the deployment handoff owner: platform or app team?'
    ]);
    try {
        const res = runHook({ cwd: repo, transcript_path: transcript, session_id: 'sess-owner-call' }, local);
        assert.strictEqual(res.status, 0);
        assert.strictEqual(res.stdout, '', 'an unpaired handoff must not read as a capacity reason');
        const events = readEvents(local);
        assert.strictEqual(events.length, 1);
        assert.strictEqual(events[0].event, 'goal-blocked');
    } finally {
        rmDir(repo);
        rmDir(local);
    }
});

test('a copula-free capacity claim ("context exhausted") is refused', () => {
    const { repo, transcript, local } = armedRepo(['BLOCKED: context exhausted, handing this off.']);
    try {
        const res = runHook({ cwd: repo, transcript_path: transcript, session_id: 'sess-exhausted' }, local);
        assert.strictEqual(res.status, 0);
        assert.notStrictEqual(res.stdout, '', 'a capacity claim without a copula must still be refused');
        assert.ok(JSON.parse(res.stdout).reason.includes('Capacity is never a blocker'));
        assert.deepStrictEqual(readEvents(local), [], 'a refused release emits nothing');
    } finally {
        rmDir(repo);
        rmDir(local);
    }
});

test('a handoff aimed at a fresh session is refused', () => {
    const { repo, transcript, local } = armedRepo([
        'BLOCKED: need to hand this off to a fresh session to finish the plan.'
    ]);
    try {
        const res = runHook({ cwd: repo, transcript_path: transcript, session_id: 'sess-handoff' }, local);
        assert.strictEqual(res.status, 0);
        assert.notStrictEqual(res.stdout, '', 'a session-directed handoff must be refused');
        assert.ok(JSON.parse(res.stdout).reason.includes('Capacity is never a blocker'));
        assert.deepStrictEqual(readEvents(local), [], 'a refused release emits nothing');
    } finally {
        rmDir(repo);
        rmDir(local);
    }
});

test('bystander allows emit nothing (another session holds the leash; an unbound prose mention)', () => {
    // The expensive failure this pins: an emit placed before the scoping gate
    // would turn every stop in every kit repo into an event, so the watcher sees
    // a stream of releases that never happened.
    const { repo, planRel, transcript, local } = armedRepo(['Working on docs/plans/example.md.']);
    try {
        assert.strictEqual(bindSession(repo, 'sess-owner').ok, true);
        let res = runHook({ cwd: repo, transcript_path: transcript, session_id: 'sess-bystander' }, local);
        assert.strictEqual(res.stdout, '', 'setup: the bystander is allowed, not leashed');
        assert.deepStrictEqual(readEvents(local), [], 'an other-session bystander emits nothing');

        const { repo: repo2, local: local2 } = armedRepo(['unused']);
        try {
            const tx = path.join(repo2, 'prose-mention.jsonl');
            writeFile(tx, JSON.stringify({
                type: 'user',
                message: { role: 'user', content: 'Please work ' + planRel + ' to completion.' }
            }) + '\n');
            res = runHook({ cwd: repo2, transcript_path: tx, session_id: 'sess-prose' }, local2);
            assert.strictEqual(res.stdout, '', 'setup: the prose mention does not claim the unbound goal');
            assert.deepStrictEqual(readEvents(local2), [], 'an unbound-goal bystander emits nothing');
        } finally {
            rmDir(repo2);
            rmDir(local2);
        }
    } finally {
        rmDir(repo);
        rmDir(local);
    }
});

test('the enforcement block emits nothing: only a release is an event', () => {
    const { repo, transcript, local } = armedRepo(['Making progress.']);
    try {
        const res = runHook({ cwd: repo, transcript_path: transcript, session_id: 'sess-held' }, local);
        assert.strictEqual(JSON.parse(res.stdout).decision, 'block', 'setup: the leash is holding');
        assert.deepStrictEqual(readEvents(local), [], 'a held stop is not a release');
    } finally {
        rmDir(repo);
        rmDir(local);
    }
});

test('an unwritable event sink leaves the release decision, output, and auto-clear unchanged', () => {
    // A directory occupying the sink path makes the emit fail. The emit is
    // observability hung off the release, never part of it: the stop still
    // allows, prints nothing, exits 0, and the goal is still cleared.
    const { repo, transcript, local } = armedRepo(['Done all sections.'], 'Status: Complete');
    try {
        const sink = path.join(local, 'unwritable-sink');
        fs.mkdirSync(sink, { recursive: true });
        const res = runHook({ cwd: repo, transcript_path: transcript, session_id: 'sess-releaser' }, local,
            { KIT_EVENTS_PATH: sink });
        assert.strictEqual(res.stdout, '', 'a failed emit does not alter the allow');
        assert.strictEqual(res.status, 0);
        assert.ok(!fs.existsSync(path.join(repo, '.kit', 'goal-state.json')),
            'the goal is still auto-cleared when the emit fails');
        assert.ok(fs.statSync(sink).isDirectory(), 'the obstruction is left as it was');
    } finally {
        rmDir(repo);
        rmDir(local);
    }
});

// Make the goal-state delete fail inside the spawned hook: a preload module
// patches fs.unlinkSync to refuse that one path, standing in for a delete the OS
// declines (a permission or a lock), which no portable fixture can stage here.
// Returns the NODE_OPTIONS value that loads it. Node parses NODE_OPTIONS with
// backslash as an escape character, so the preload path is passed forward-
// slashed; a backslashed path fails to resolve and the child dies before the
// hook runs.
function unlinkRefusingPreload(dir) {
    const shim = path.join(dir, 'refuse-unlink.js');
    writeFile(shim, [
        "'use strict';",
        "const fs = require('fs');",
        'const realUnlinkSync = fs.unlinkSync;',
        'fs.unlinkSync = function (target) {',
        "    if (String(target).endsWith('goal-state.json')) {",
        "        const err = new Error('EPERM: the fixture refuses this delete');",
        "        err.code = 'EPERM';",
        '        throw err;',
        '    }',
        '    return realUnlinkSync.apply(fs, arguments);',
        '};'
    ].join('\n') + '\n');
    return '--require "' + shim.replace(/\\/g, '/') + '"';
}

test('a Complete plan whose clear fails emits nothing: the stop still allows, but no release is reported', () => {
    // A goal that could not be cleared is still armed, so it was not released.
    // Emitting anyway would report a release that did not happen, and would do
    // it again at every later stop for as long as the delete keeps failing.
    const { repo, transcript, local } = armedRepo(['Done all sections.'], 'Status: Complete');
    try {
        const res = runHook({ cwd: repo, transcript_path: transcript, session_id: 'sess-releaser' }, local,
            { NODE_OPTIONS: unlinkRefusingPreload(local) });
        assert.strictEqual(res.status, 0, 'exit 0: a nonzero exit would mean the preload itself failed to load');
        assert.strictEqual(res.stdout, '', 'the stop is still allowed');
        assert.ok(fs.existsSync(path.join(repo, '.kit', 'goal-state.json')),
            'the clear genuinely failed, so the leash is still armed');
        assert.deepStrictEqual(readEvents(local), [], 'a release that did not happen is not reported');
    } finally {
        rmDir(repo);
        rmDir(local);
    }
});

test('an archived plan whose clear fails emits nothing (the same gate on the other goal-complete)', () => {
    const { repo, planRel, transcript, local } = armedRepo(['Still going.']);
    try {
        fs.rmSync(path.join(repo, planRel));
        const res = runHook({ cwd: repo, transcript_path: transcript, session_id: 'sess-archiver' }, local,
            { NODE_OPTIONS: unlinkRefusingPreload(local) });
        assert.strictEqual(res.status, 0, 'exit 0: a nonzero exit would mean the preload itself failed to load');
        assert.strictEqual(res.stdout, '', 'the stop is still allowed');
        assert.ok(fs.existsSync(path.join(repo, '.kit', 'goal-state.json')),
            'the clear genuinely failed, so the leash is still armed');
        assert.deepStrictEqual(readEvents(local), [], 'a release that did not happen is not reported');
    } finally {
        rmDir(repo);
        rmDir(local);
    }
});

// Make the goal-state file look already gone to the spawned hook: a preload
// patches fs.existsSync to answer false for that one path, which is what a stop
// sees when a concurrent stop removed the file a moment earlier. No portable
// fixture can time the real race. The NODE_OPTIONS shape matches
// unlinkRefusingPreload's: forward-slashed, because Node reads a backslash in
// NODE_OPTIONS as an escape character.
function alreadyClearedPreload(dir) {
    const shim = path.join(dir, 'already-cleared.js');
    writeFile(shim, [
        "'use strict';",
        "const fs = require('fs');",
        'const realExistsSync = fs.existsSync;',
        'fs.existsSync = function (target) {',
        "    if (String(target).endsWith('goal-state.json')) return false;",
        '    return realExistsSync.apply(fs, arguments);',
        '};'
    ].join('\n') + '\n');
    return '--require "' + shim.replace(/\\/g, '/') + '"';
}

test('a Complete plan whose goal another stop already cleared emits nothing (the release is exactly-once)', () => {
    // The emit belongs to the stop that actually removed the goal state. A racer
    // whose clear finds nothing left to remove has released nothing, and the stop
    // that did remove it has already reported the release, so a second report
    // would double-count one release.
    const { repo, transcript, local } = armedRepo(['Done all sections.'], 'Status: Complete');
    try {
        const res = runHook({ cwd: repo, transcript_path: transcript, session_id: 'sess-racer' }, local,
            { NODE_OPTIONS: alreadyClearedPreload(local) });
        assert.strictEqual(res.status, 0, 'exit 0: a nonzero exit would mean the preload itself failed to load');
        assert.strictEqual(res.stdout, '', 'the stop is still allowed');
        assert.deepStrictEqual(readEvents(local), [],
            'only the stop that removed the goal reports the release');
    } finally {
        rmDir(repo);
        rmDir(local);
    }
});

test('bound goal, Stop payload missing session_id entirely: empty stdout (the documented fail-open release)', () => {
    // Pins the shape loudly: if the harness ever stops sending session_id, a
    // bound goal must not silently start enforcing (or silently stop enforcing)
    // by accident. sameSessionId treats a missing id as "no match", so this
    // resolves as a bystander and allows.
    const { repo, transcript, local } = armedRepo(['Making progress.']);
    try {
        assert.strictEqual(bindSession(repo, 'sess-owner').ok, true);
        const res = runHook({ cwd: repo, transcript_path: transcript }, local);
        assert.strictEqual(res.stdout, '', 'a Stop payload with no session_id at all is treated as a bystander: allow');
        assert.strictEqual(res.status, 0);
        assert.strictEqual(readBoundSession(repo), 'sess-owner', 'the existing binding is untouched');
    } finally {
        rmDir(repo);
        rmDir(local);
    }
});
