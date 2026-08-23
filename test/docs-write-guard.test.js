// Tests for plugins/claude-kit/hooks/docs-write-guard.js (the docs/ write guard).
//
// Node's built-in test runner, no framework (Node v24). The guard is spawned as
// a real child process, fed a PreToolUse payload on stdin, and asserted on by
// its exit code: 2 is a deny, 0 is an allow. These cases pin the guard's access
// model per agent type - main session (no type), the bare "claude" type a
// background job's main session presents, the docs-curator, and every governed
// named type - so a regex edit that widens or re-closes a role fails red here.

'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const { spawnSync } = require('node:child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');

const GUARD = path.join(__dirname, '..', 'plugins', 'claude-kit', 'hooks', 'docs-write-guard.js');

function runGuard(payload) {
    return spawnSync(process.execPath, [GUARD], {
        input: JSON.stringify(payload),
        encoding: 'utf8',
        // A guard that never returns must fail rather than hang: node:test's own
        // per-test timeout is Infinity, so this is the only bound on a
        // catastrophically backtracking regex, and it turns one into a red.
        timeout: 20000,
    });
}

function writePayload(agentType, filePath) {
    const p = { tool_name: 'Write', tool_input: { file_path: filePath } };
    if (agentType !== null) p.agent_type = agentType;
    return p;
}

const DOCS_PATH = 'D:\\repo\\docs\\plans\\some_spec_v1.md';

test('main session (no agent type) may write docs/', () => {
    const r = runGuard(writePayload(null, DOCS_PATH));
    assert.strictEqual(r.status, 0);
});

test('bare "claude" (background-job main session) may write docs/', () => {
    const r = runGuard(writePayload('claude', DOCS_PATH));
    assert.strictEqual(r.status, 0);
});

test('bare "claude" matches case-insensitively (fail-open direction)', () => {
    const r = runGuard(writePayload('Claude', DOCS_PATH));
    assert.strictEqual(r.status, 0);
});

test('docs-curator may write docs/, including plugin-namespaced', () => {
    assert.strictEqual(runGuard(writePayload('docs-curator', DOCS_PATH)).status, 0);
    assert.strictEqual(runGuard(writePayload('claude-kit:docs-curator', DOCS_PATH)).status, 0);
});

test('governed named agents are denied docs/ writes', () => {
    for (const t of ['claude-kit:adversarial-reviewer', 'claude-kit:implementer-opus', 'general-purpose', 'Explore']) {
        const r = runGuard(writePayload(t, DOCS_PATH));
        assert.strictEqual(r.status, 2, `expected deny for agent type ${t}`);
        assert.match(r.stderr, /may not write into docs\//);
    }
});

test('a namespaced id ending in "claude" does not ride the bare-claude allowance', () => {
    const r = runGuard(writePayload('some-plugin:claude', DOCS_PATH));
    assert.strictEqual(r.status, 2);
});

test('governed agents may still write outside docs/', () => {
    const r = runGuard(writePayload('claude-kit:implementer-opus', 'D:\\repo\\.kit\\report.md'));
    assert.strictEqual(r.status, 0);
});

test('governed agents are denied shell redirects into docs/', () => {
    const r = runGuard({
        tool_name: 'Bash',
        agent_type: 'claude-kit:implementer-opus',
        tool_input: { command: 'echo hi > docs/notes.md' },
    });
    assert.strictEqual(r.status, 2);
});

test('unparseable payload fails open', () => {
    const r = spawnSync(process.execPath, [GUARD], { input: 'not json', encoding: 'utf8' });
    assert.strictEqual(r.status, 0);
});

// Containment: with a cwd in the payload, the guard judges targets against the
// git root above it, so a docs/ segment outside the project tree (a session
// scratchpad, a fixture repo, a sibling checkout) is out of scope, while
// in-tree docs/ writes stay denied whatever form the path takes. Payloads with
// no cwd keep the shape-only judgment the earlier cases pin.
function makeTree() {
    const base = fs.mkdtempSync(path.join(os.tmpdir(), 'dwg-'));
    const repo = path.join(base, 'repo');
    fs.mkdirSync(path.join(repo, '.git'), { recursive: true });
    fs.mkdirSync(path.join(base, 'scratch', 'docs', 'plans'), { recursive: true });
    return { base, repo };
}

test('with a cwd, an absolute docs/ path outside the project tree is allowed', () => {
    const { base, repo } = makeTree();
    try {
        const target = path.join(base, 'scratch', 'docs', 'plans', 'report.md');
        const r = runGuard({
            tool_name: 'Write',
            agent_type: 'claude-kit:qa-verifier',
            cwd: repo,
            tool_input: { file_path: target },
        });
        assert.strictEqual(r.status, 0, r.stderr);
    } finally { fs.rmSync(base, { recursive: true, force: true }); }
});

test('with a cwd, in-tree docs/ writes are still denied, absolute and relative', () => {
    const { base, repo } = makeTree();
    try {
        for (const fp of [path.join(repo, 'docs', 'plans', 'x.md'), 'docs/plans/x.md']) {
            const r = runGuard({
                tool_name: 'Write',
                agent_type: 'claude-kit:qa-verifier',
                cwd: repo,
                tool_input: { file_path: fp },
            });
            assert.strictEqual(r.status, 2, `expected deny for ${fp}`);
        }
    } finally { fs.rmSync(base, { recursive: true, force: true }); }
});

test('with a cwd, a shell redirect to an out-of-tree docs/ path is allowed, an in-tree one denied', () => {
    const { base, repo } = makeTree();
    try {
        const outPath = path.join(base, 'scratch', 'docs', 'notes.md').replace(/\\/g, '/');
        const out = runGuard({
            tool_name: 'Bash',
            agent_type: 'claude-kit:implementer-opus',
            cwd: repo,
            tool_input: { command: 'echo hi > ' + outPath },
        });
        assert.strictEqual(out.status, 0, out.stderr);
        const inTree = runGuard({
            tool_name: 'Bash',
            agent_type: 'claude-kit:implementer-opus',
            cwd: repo,
            tool_input: { command: 'echo hi > docs/notes.md' },
        });
        assert.strictEqual(inTree.status, 2);
    } finally { fs.rmSync(base, { recursive: true, force: true }); }
});

// Command heuristic, exercised under both tool names: the guard never reads
// tool_name, so each case pins the same regex against the two shells' own
// redirect/cmdlet syntax. deny = expect a 2 (blocked).
const COMMAND_AGENT = 'general-purpose';

function commandPayload(toolName, command, cwd) {
    return { tool_name: toolName, agent_type: COMMAND_AGENT, tool_input: { command }, cwd };
}

const commandCases = [
    { name: 'bash redirect into docs/', cmd: 'echo hi > docs/x.txt', deny: true },
    { name: 'Set-Content positional docs\\', cmd: "'hi' | Set-Content docs\\x.txt", deny: true },
    { name: 'Out-File -FilePath docs/', cmd: "'hi' | Out-File -FilePath docs/x.txt", deny: true },
    { name: 'Add-Content -Path docs\\', cmd: 'Add-Content -Path docs\\a.md -Value hi', deny: true },
    { name: 'Tee-Object -FilePath docs/', cmd: 'Tee-Object -FilePath docs/log.txt', deny: true },
    // Path reached across intervening parameters, and colon-joined -FilePath.
    { name: 'Out-File -Append docs/', cmd: 'Out-File -Append docs/x.md', deny: true },
    { name: 'Out-File -Encoding utf8 docs/', cmd: 'Out-File -Encoding utf8 docs/x.md', deny: true },
    { name: 'Set-Content -Value hi -Path docs/', cmd: 'Set-Content -Value hi -Path docs/x.md', deny: true },
    { name: 'Out-File -FilePath:docs/ (colon)', cmd: 'Out-File -FilePath:docs/x.md', deny: true },
    { name: 'Set-Content into .kit/', cmd: "'hi' | Set-Content .kit\\x.txt", deny: false },
    { name: 'Set-Content into mydocs/', cmd: 'Set-Content mydocs\\x.txt', deny: false },
    // Embedded cmdlet name (set-Content inside Reset-Content) is not a write.
    { name: 'Reset-Content docs/ (embedded name)', cmd: 'Reset-Content docs/x.md', deny: false }
];

for (const c of commandCases) {
    for (const tool of ['Bash', 'PowerShell']) {
        test((c.deny ? 'deny' : 'allow') + ' ' + c.name + ' [' + tool + ']', () => {
            const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'dwg-cmd-'));
            try {
                const r = runGuard(commandPayload(tool, c.cmd, cwd));
                if (c.deny) {
                    assert.strictEqual(r.status, 2, 'expected deny; stderr=' + r.stderr);
                    assert.match(r.stderr, /Blocked:/);
                } else {
                    assert.strictEqual(r.status, 0, 'expected allow; stderr=' + r.stderr);
                }
            } finally { fs.rmSync(cwd, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 }); }
        });
    }
}

// The command heuristics must stay linear-time: a ~1MB adversarial command that
// never contains a docs/ path should return promptly (no catastrophic
// backtracking), and allow. Wall time includes node startup; the bound is loose
// and only trips on a runaway regex, which would take many seconds or time out.
test('command heuristic stays fast on adversarial input (ReDoS sanity)', () => {
    const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'dwg-redos-'));
    try {
        const bomb = 'Set-Content -x ' + 'a/'.repeat(500000);
        const start = Date.now();
        const r = runGuard(commandPayload('PowerShell', bomb, cwd));
        const elapsed = Date.now() - start;
        assert.strictEqual(r.status, 0, 'adversarial input has no docs/ path; expected allow');
        assert.ok(elapsed < 15000, 'heuristic took ' + elapsed + 'ms; expected < 15000ms');
    } finally { fs.rmSync(cwd, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 }); }
});
