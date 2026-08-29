// Tests for plugins/claude-kit/hooks/stop-docs-hygiene.js (the docs-library Stop hook).
//
// Node's built-in test runner (Node v24), no framework. The hook is spawned as a
// real child process, fed a Stop payload on stdin, and asserted on by its stdout:
// a block emits {"decision":"block", reason}; an allow emits nothing. Each case
// builds a fresh temp cwd with its own docs/ tree and cleans it up in a finally.

'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const { spawnSync } = require('node:child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

const HOOK = path.join(__dirname, '..', 'plugins', 'claude-kit', 'hooks', 'stop-docs-hygiene.js');

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

// Spawn the hook against a fixture cwd. process.env is spread rather than
// rebuilt so the child keeps its real PATH (a rebuilt env object loses the
// Windows `Path` key); extra is where a case adds the external-engine marker.
function spawnHook(cwd, extra) {
    return spawnSync(process.execPath, [HOOK], {
        input: JSON.stringify({ cwd, hook_event_name: 'Stop' }),
        env: { ...process.env, ...(extra || {}) },
        encoding: 'utf8'
    });
}

// The block verdict, reduced: { blocked, reason }.
function runHook(cwd) {
    const res = spawnHook(cwd);
    const out = (res.stdout || '').trim();
    if (!out) return { blocked: false, reason: '' };
    let parsed;
    try { parsed = JSON.parse(out); } catch { return { blocked: false, reason: '' }; }
    return { blocked: parsed.decision === 'block', reason: parsed.reason || '' };
}

const IN_PROGRESS = '# Title\n\nStatus: In Progress\nCommit Model: Commit-and-Push\n';
const COMPLETE = '# Title\n\nStatus: Complete\nCommit Model: Commit-and-Push\n';

// The over-match this hook must not commit: a legitimate plan spec whose project
// or topic name embeds a word from the SCRATCH_NAME set (security, qa, blind, ...).
test('a legit spec whose name embeds a review-ish word is not flagged as scratch', () => {
    const cwd = makeDir('sdh-spec-');
    try {
        writeFile(path.join(cwd, 'docs', 'plans', 'neo_security-packet_spec_v1.md'), IN_PROGRESS);
        const { blocked, reason } = runHook(cwd);
        assert.strictEqual(blocked, false,
            'a _spec_v file named ..._security-packet_... must not be flagged as scratch; reason was: ' + reason);
    } finally { rmDir(cwd); }
});

test('the spec exemption generalizes across the SCRATCH_NAME set (qa in a spec name)', () => {
    const cwd = makeDir('sdh-qa-');
    try {
        writeFile(path.join(cwd, 'docs', 'plans', 'neo_qa-harness_spec_v1.md'), IN_PROGRESS);
        const { blocked } = runHook(cwd);
        assert.strictEqual(blocked, false);
    } finally { rmDir(cwd); }
});

// The header-contract fallback: a curated doc identified by its plan headers is
// exempt even when its name does not match the _spec_v naming contract.
test('a header-bearing plan doc with a scratch-ish name is exempted via the header contract', () => {
    const cwd = makeDir('sdh-header-');
    try {
        writeFile(path.join(cwd, 'docs', 'plans', 'neo_security_v2.md'), IN_PROGRESS);
        const { blocked } = runHook(cwd);
        assert.strictEqual(blocked, false);
    } finally { rmDir(cwd); }
});

// The detection the exemption must not weaken: a genuine leaked report, and any
// file physically inside a scratch dir, stay caught.
test('a genuine scratch report (no _spec_v) is still flagged', () => {
    const cwd = makeDir('sdh-report-');
    try {
        writeFile(path.join(cwd, 'docs', 'plans', 'phase1_security.md'), '# leaked review\n');
        const { blocked, reason } = runHook(cwd);
        assert.strictEqual(blocked, true);
        assert.match(reason, /scratch leaked/);
        assert.match(reason, /phase1_security\.md/);
    } finally { rmDir(cwd); }
});

test('a spec-named file physically inside a reviews/ dir is still caught by SCRATCH_DIR', () => {
    const cwd = makeDir('sdh-dir-');
    try {
        writeFile(path.join(cwd, 'docs', 'reviews', 'neo_thing_spec_v1.md'), IN_PROGRESS);
        const { blocked, reason } = runHook(cwd);
        assert.strictEqual(blocked, true,
            'location-based SCRATCH_DIR detection is independent of the name exemption');
        assert.match(reason, /scratch leaked/);
    } finally { rmDir(cwd); }
});

// The exemption touches only the scratch check, never the completed-unarchived one.
test('a Complete spec still sitting in docs/plans/ is flagged as unarchived', () => {
    const cwd = makeDir('sdh-complete-');
    try {
        writeFile(path.join(cwd, 'docs', 'plans', 'neo_security-packet_spec_v1.md'), COMPLETE);
        const { blocked, reason } = runHook(cwd);
        assert.strictEqual(blocked, true);
        assert.match(reason, /unarchived/);
    } finally { rmDir(cwd); }
});

// Two pins, not reds: the Status question here is kit-goal-lib's
// classifyPlanStatus, and a Ready plan is neither complete nor scratch, so
// this hook leaves it alone on both counts. A parked plan is not a missed
// close-out, and a header value is not what marks a file as leaked scratch.
const READY = '# Title\n\nStatus: Ready\nCommit Model: Commit-and-Push\n';

test('a Ready spec sitting in docs/plans/ is not flagged as unarchived', () => {
    const cwd = makeDir('sdh-ready-');
    try {
        writeFile(path.join(cwd, 'docs', 'plans', 'neo_public-api_spec_v1.md'), READY);
        const { blocked, reason } = runHook(cwd);
        assert.strictEqual(blocked, false,
            'a parked plan is not a missed close-out; reason was: ' + reason);
    } finally { rmDir(cwd); }
});

// The plan-shaped-file check asks whether a Status header is present at all,
// never what it says, so every value it does not classify still reads as a
// curated plan rather than as leaked scratch.
test('a Ready-headered doc with a scratch-ish name is exempted via the header contract', () => {
    const cwd = makeDir('sdh-ready-header-');
    try {
        writeFile(path.join(cwd, 'docs', 'plans', 'neo_security_v2.md'), READY);
        const { blocked, reason } = runHook(cwd);
        assert.strictEqual(blocked, false,
            'a Ready header is a plan header; reason was: ' + reason);

        // The control: the same name with no header contract is still caught,
        // so the allow above is the header being read rather than the scratch
        // check having gone quiet.
        writeFile(path.join(cwd, 'docs', 'plans', 'neo_security_v3.md'), '# leaked review\n');
        const second = runHook(cwd);
        assert.strictEqual(second.blocked, true);
        assert.match(second.reason, /neo_security_v3\.md/);
        assert.ok(!second.reason.includes('neo_security_v2.md'),
            'the header-bearing sibling stays exempt: ' + second.reason);
    } finally { rmDir(cwd); }
});

test('a clean docs/ tree (in-progress spec, no scratch) allows the stop', () => {
    const cwd = makeDir('sdh-clean-');
    try {
        writeFile(path.join(cwd, 'docs', 'plans', 'neo_public-api_spec_v1.md'), IN_PROGRESS);
        writeFile(path.join(cwd, 'docs', 'README.md'), '# index\n');
        const { blocked } = runHook(cwd);
        assert.strictEqual(blocked, false);
    } finally { rmDir(cwd); }
});

// Both directions of the external-engine marker, asserted on raw stdout rather
// than through the block-verdict reducer above: that reducer reads any
// non-block output as an allow, so it cannot tell an advisory apart from
// silence or from a crash, and the advisory shape has to be positively seen.
test('under KIT_EXTERNAL_ENGINE the same finding is advisory, not a block', () => {
    const cwd = makeDir('sdh-engine-');
    try {
        writeFile(path.join(cwd, 'docs', 'plans', 'neo_security-packet_spec_v1.md'), COMPLETE);
        writeFile(path.join(cwd, 'docs', 'plans', 'phase1_security.md'), '# leaked review\n');
        const res = spawnHook(cwd, { KIT_EXTERNAL_ENGINE: '1' });
        assert.strictEqual(res.status, 0);
        const parsed = JSON.parse(res.stdout);
        assert.ok(!('decision' in parsed),
            'the absence of a decision field is what allows the stop; got: ' + res.stdout);
        assert.match(parsed.systemMessage, /unarchived/);
        assert.match(parsed.systemMessage, /scratch leaked/);
    } finally { rmDir(cwd); }
});

test('the same fixture without the marker still blocks the stop', () => {
    const cwd = makeDir('sdh-attended-');
    try {
        writeFile(path.join(cwd, 'docs', 'plans', 'neo_security-packet_spec_v1.md'), COMPLETE);
        writeFile(path.join(cwd, 'docs', 'plans', 'phase1_security.md'), '# leaked review\n');
        const res = spawnHook(cwd);
        assert.strictEqual(res.status, 0);
        const parsed = JSON.parse(res.stdout);
        assert.strictEqual(parsed.decision, 'block');
        assert.match(parsed.reason, /unarchived/);
    } finally { rmDir(cwd); }
});

test('a marker value other than 1 still blocks', () => {
    const cwd = makeDir('sdh-marker-off-');
    try {
        writeFile(path.join(cwd, 'docs', 'plans', 'phase1_security.md'), '# leaked review\n');
        const res = spawnHook(cwd, { KIT_EXTERNAL_ENGINE: '0' });
        assert.strictEqual(res.status, 0);
        assert.strictEqual(JSON.parse(res.stdout).decision, 'block');
    } finally { rmDir(cwd); }
});

// The loop guard is upstream of the marker: a stop-hook continuation says
// nothing in either direction.
test('a stop-hook continuation stays silent under the marker too', () => {
    const cwd = makeDir('sdh-loop-');
    try {
        writeFile(path.join(cwd, 'docs', 'plans', 'phase1_security.md'), '# leaked review\n');
        const res = spawnSync(process.execPath, [HOOK], {
            input: JSON.stringify({ cwd, hook_event_name: 'Stop', stop_hook_active: true }),
            env: { ...process.env, KIT_EXTERNAL_ENGINE: '1' },
            encoding: 'utf8'
        });
        assert.strictEqual(res.status, 0);
        assert.strictEqual(res.stdout, '');
    } finally { rmDir(cwd); }
});
