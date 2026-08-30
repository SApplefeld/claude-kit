// Tests for doctor.ps1's "Kit goal state" section: the report an operator
// reads for the leash a kit goal arming holds on this clone's sessions.
//
// Node's built-in test runner, no framework, no install (Node v24). Every
// case builds its own fake repo root under a short temp directory and passes
// it explicitly, so nothing here reads or writes the real repo's .kit/. The
// cases spawn Windows PowerShell and are skipped off Windows, where the
// doctor itself does not run.
//
// The section is lifted as source text and executed (Invoke-Expression)
// inside a harness that stubs Report (captures each call instead of
// printing) and Get-SanitizedLine (identity, since sanitizing is not this
// suite's subject) and sets $isClone, $repoRoot and $pluginRoot. This is real
// doctor.ps1 code, run rather than re-implemented, against a real
// .kit\goal-state.json and a real plan doc on disk, the technique
// embedder-install.test.js's runEmbedderSection established for the sibling
// section immediately above this one in the file.

'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const { spawnSync } = require('node:child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

const REPO = path.join(__dirname, '..');
const PLUGIN_ROOT = path.join(REPO, 'plugins', 'claude-kit');
const DOCTOR = path.join(PLUGIN_ROOT, 'doctor', 'doctor.ps1');
const GOAL_LIB = path.join(PLUGIN_ROOT, 'hooks', 'kit-goal-lib.js');
// A copy of doctor.ps1 as it stood before this round's ordinal-comparison
// fix, saved to gitignored scratch so the red-then-green cases below can
// prove themselves against the code they are meant to catch. Absent when
// this file runs outside that fix round; those cases skip rather than fail,
// since the copy is not a fixture this suite owns.
const DOCTOR_PREFIX = path.join(REPO, '.kit', 'scratch', 'doctor-prefix.ps1');
const isWin = process.platform === 'win32';
const hasPrefix = isWin && fs.existsSync(DOCTOR_PREFIX);

const PLAN_REL = 'docs/plans/fake_plan_v1.md';
const SH = '­'; // soft hyphen: collation-ignorable, invisible when printed.

// Single-quoted PowerShell literal, any embedded quote doubled.
const q = (s) => "'" + String(s).replace(/'/g, "''") + "'";

function pwsh(script, extraEnv) {
    return spawnSync('powershell.exe',
        ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', script],
        { encoding: 'utf8', env: { ...process.env, ...(extraEnv || {}) } });
}

function write(file, text) {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, text, 'utf8');
}

function makeRepoRoot(prefix) {
    return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

function rmRepoRoot(repoRoot) {
    fs.rmSync(repoRoot, { recursive: true, force: true });
}

function writePlanDoc(repoRoot, status, rel) {
    write(path.join(repoRoot, rel || PLAN_REL), 'Status: ' + status + '\n\nFake plan body.\n');
}

// Writes .kit\goal-state.json verbatim from a JS value (or, when goalState is
// already a string, verbatim as text, which is what the unparseable-state
// case needs to plant invalid JSON). withBom is for a fixture carrying a
// non-ASCII character: doctor.ps1 reads the file with a plain Get-Content
// and no -Encoding, and Windows PowerShell 5.1's default for a BOM-less file
// is the system codepage, not UTF-8, which would otherwise turn the single
// soft hyphen these fixtures plant into two mismatched codepage characters
// before the comparison under test ever sees it. A leading UTF-8 BOM makes
// Get-Content decode the file as UTF-8, isolating the ordinal-vs-culture
// comparison this suite is testing from that separate, unrelated encoding
// behavior. kit-goal-lib.js itself never writes a BOM and never places a
// non-ASCII character in a plan path, so this is a property of the fixture,
// not of what the doctor is fed in production.
function writeGoalState(repoRoot, goalState, withBom) {
    const text = typeof goalState === 'string' ? goalState : JSON.stringify(goalState);
    const payload = withBom ? '﻿' + text : text;
    write(path.join(repoRoot, '.kit', 'goal-state.json'), payload);
}

// Lifts the doctor's "Kit goal state" section as source text between the
// guard comment above it (the one forbidding an insertion in that gap) and
// the ".kit/ exposure" section that follows, and runs it against a real
// repoRoot. doctorPath defaults to the shipped doctor.ps1; a case that needs
// to run the same harness against a different file (a saved pre-fix copy,
// to prove a test fails on the code it is meant to catch) passes one, which
// is how the red-then-green cases below exercise this parameter for real.
function runGoalStateSection(repoRoot, doctorPath) {
    const script = [
        '$src = [System.IO.File]::ReadAllText(' + q(doctorPath || DOCTOR) + ')',
        '$guardMarker = "# --- Nothing may be inserted between the embedder section above"',
        '$guardAt = $src.IndexOf($guardMarker)',
        'if ($guardAt -lt 0) { throw "guard comment not found in doctor.ps1" }',
        '$startMarker = "`nif (`$isClone) {"',
        '$start = $src.IndexOf($startMarker, $guardAt)',
        'if ($start -lt 0) { throw "goal-state if (`$isClone) not found after the guard comment" }',
        '$endMarker = "# --- .kit/ exposure."',
        '$end = $src.IndexOf($endMarker, $start)',
        'if ($end -lt 0) { throw "end marker not found after the goal-state block" }',
        '$section = $src.Substring($start + 1, $end - $start - 1)',
        '',
        '$script:Reports = @()',
        'function Get-SanitizedLine { param($Value, $MaxLength = 120) return [string]$Value }',
        'function Report {',
        '    param([string]$Status, [string]$Name, [string[]]$Detail = @())',
        '    $script:Reports += @{ Status = $Status; Name = $Name; Detail = ($Detail -join "`n") }',
        '}',
        '',
        '$isClone = $true',
        '$repoRoot = ' + q(repoRoot),
        '$pluginRoot = ' + q(PLUGIN_ROOT),
        '',
        'Invoke-Expression $section',
        '',
        '@{ Reports = @($script:Reports) } | ConvertTo-Json -Compress -Depth 6'
    ].join('\n');
    const res = pwsh(script);
    assert.strictEqual(res.status, 0, res.stdout + res.stderr);
    const parsed = JSON.parse(res.stdout);
    // A section that reported zero Reports must fail this assertion loudly
    // rather than be coerced into a one-element array holding undefined,
    // which would let the count assertion below pass and then die on
    // .Detail with an unreadable TypeError.
    assert.ok(Array.isArray(parsed.Reports), 'Reports must be an array: ' + res.stdout);
    return parsed.Reports;
}

// A wording matcher for the three-way armedByLine text, used by the mutual-
// exclusion cases below so each case can assert its own wording is present
// and both of the other two are absent from the same Detail string.
const SELF_WORDING = /recorded as a run's own arming \(armedBy: self\)/;
const OPERATOR_WORDING = /recorded as the operator's arming \(armedBy: operator\)/;
const ABSENT_WORDING = /nothing recorded, which reads as the operator's arming/;
const REARM_NOTE = /Re-arming records the arming of whoever runs it/;

test('active plan armed by the run itself: self wording present, both other wordings absent', { skip: !isWin }, () => {
    const repoRoot = makeRepoRoot('doctor-goal-self-');
    try {
        writePlanDoc(repoRoot, 'In Progress');
        writeGoalState(repoRoot, { plan: PLAN_REL, queue: [PLAN_REL], queueIndex: 0, armedBy: { [PLAN_REL]: 'self' } });
        const reports = runGoalStateSection(repoRoot);
        assert.strictEqual(reports.length, 1, JSON.stringify(reports));
        assert.strictEqual(reports[0].Status, 'PASS');
        assert.match(reports[0].Detail, SELF_WORDING, reports[0].Detail);
        assert.doesNotMatch(reports[0].Detail, OPERATOR_WORDING, reports[0].Detail);
        assert.doesNotMatch(reports[0].Detail, ABSENT_WORDING, reports[0].Detail);
    } finally {
        rmRepoRoot(repoRoot);
    }
});

test('active plan armed by the operator: operator wording present, both other wordings absent', { skip: !isWin }, () => {
    const repoRoot = makeRepoRoot('doctor-goal-operator-');
    try {
        writePlanDoc(repoRoot, 'In Progress');
        writeGoalState(repoRoot, { plan: PLAN_REL, queue: [PLAN_REL], queueIndex: 0, armedBy: { [PLAN_REL]: 'operator' } });
        const reports = runGoalStateSection(repoRoot);
        assert.strictEqual(reports.length, 1, JSON.stringify(reports));
        assert.strictEqual(reports[0].Status, 'PASS');
        assert.match(reports[0].Detail, OPERATOR_WORDING, reports[0].Detail);
        assert.doesNotMatch(reports[0].Detail, SELF_WORDING, reports[0].Detail);
        assert.doesNotMatch(reports[0].Detail, ABSENT_WORDING, reports[0].Detail);
    } finally {
        rmRepoRoot(repoRoot);
    }
});

test('no armedBy map at all reads as nothing recorded, both named wordings absent', { skip: !isWin }, () => {
    const repoRoot = makeRepoRoot('doctor-goal-noarmedby-');
    try {
        writePlanDoc(repoRoot, 'In Progress');
        writeGoalState(repoRoot, { plan: PLAN_REL, queue: [PLAN_REL], queueIndex: 0 });
        const reports = runGoalStateSection(repoRoot);
        assert.strictEqual(reports.length, 1, JSON.stringify(reports));
        assert.match(reports[0].Detail, ABSENT_WORDING, reports[0].Detail);
        assert.doesNotMatch(reports[0].Detail, SELF_WORDING, reports[0].Detail);
        assert.doesNotMatch(reports[0].Detail, OPERATOR_WORDING, reports[0].Detail);
    } finally {
        rmRepoRoot(repoRoot);
    }
});

test('a differently-cased entry ("Self") reads as the operator\'s arming', { skip: !isWin }, () => {
    const repoRoot = makeRepoRoot('doctor-goal-wrongcase-');
    try {
        writePlanDoc(repoRoot, 'In Progress');
        writeGoalState(repoRoot, { plan: PLAN_REL, queue: [PLAN_REL], queueIndex: 0, armedBy: { [PLAN_REL]: 'Self' } });
        const reports = runGoalStateSection(repoRoot);
        assert.strictEqual(reports.length, 1, JSON.stringify(reports));
        assert.match(reports[0].Detail, /armedBy: operator/);
        assert.doesNotMatch(reports[0].Detail, /armedBy: self/);
    } finally {
        rmRepoRoot(repoRoot);
    }
});

test('a non-string entry reads as the operator\'s arming', { skip: !isWin }, () => {
    const repoRoot = makeRepoRoot('doctor-goal-wrongtype-');
    try {
        writePlanDoc(repoRoot, 'In Progress');
        writeGoalState(repoRoot, { plan: PLAN_REL, queue: [PLAN_REL], queueIndex: 0, armedBy: { [PLAN_REL]: 1 } });
        const reports = runGoalStateSection(repoRoot);
        assert.strictEqual(reports.length, 1, JSON.stringify(reports));
        assert.match(reports[0].Detail, /armedBy: operator/);
        assert.doesNotMatch(reports[0].Detail, /armedBy: self/);
    } finally {
        rmRepoRoot(repoRoot);
    }
});

test('a stalled advance armed by self names the arming and warns that a re-arm would flip it', { skip: !isWin }, () => {
    const repoRoot = makeRepoRoot('doctor-goal-stalled-self-');
    try {
        writePlanDoc(repoRoot, 'Complete');
        const other = 'docs/plans/fake_other_v1.md';
        writeGoalState(repoRoot, {
            plan: PLAN_REL, queue: [PLAN_REL, other], queueIndex: 0,
            armedBy: { [PLAN_REL]: 'self', [other]: 'self' }
        });
        const reports = runGoalStateSection(repoRoot);
        assert.strictEqual(reports.length, 1, JSON.stringify(reports));
        assert.strictEqual(reports[0].Status, 'WARN');
        assert.match(reports[0].Detail, /stalled advance|remain in the queue/i);
        assert.match(reports[0].Detail, SELF_WORDING, reports[0].Detail);
        assert.doesNotMatch(reports[0].Detail, OPERATOR_WORDING, reports[0].Detail);
        assert.match(reports[0].Detail, REARM_NOTE, 'a self arming must warn that a re-arm records the operator\'s: ' + reports[0].Detail);
    } finally {
        rmRepoRoot(repoRoot);
    }
});

test('a stalled advance armed by the operator names the arming and adds no re-arm warning', { skip: !isWin }, () => {
    const repoRoot = makeRepoRoot('doctor-goal-stalled-operator-');
    try {
        writePlanDoc(repoRoot, 'Complete');
        const other = 'docs/plans/fake_other_v1.md';
        writeGoalState(repoRoot, {
            plan: PLAN_REL, queue: [PLAN_REL, other], queueIndex: 0,
            armedBy: { [PLAN_REL]: 'operator', [other]: 'operator' }
        });
        const reports = runGoalStateSection(repoRoot);
        assert.strictEqual(reports.length, 1, JSON.stringify(reports));
        assert.strictEqual(reports[0].Status, 'WARN');
        assert.match(reports[0].Detail, OPERATOR_WORDING, reports[0].Detail);
        assert.doesNotMatch(reports[0].Detail, SELF_WORDING, reports[0].Detail);
        assert.doesNotMatch(reports[0].Detail, REARM_NOTE, 'an operator arming has no attribution to flip, so no warning is added: ' + reports[0].Detail);
    } finally {
        rmRepoRoot(repoRoot);
    }
});

test('a stale goal (complete plan, nothing left queued) still names the arming', { skip: !isWin }, () => {
    const repoRoot = makeRepoRoot('doctor-goal-stale-');
    try {
        writePlanDoc(repoRoot, 'Complete');
        writeGoalState(repoRoot, { plan: PLAN_REL, queue: [PLAN_REL], queueIndex: 0, armedBy: { [PLAN_REL]: 'operator' } });
        const reports = runGoalStateSection(repoRoot);
        assert.strictEqual(reports.length, 1, JSON.stringify(reports));
        assert.strictEqual(reports[0].Status, 'WARN');
        assert.match(reports[0].Detail, /Complete or archived/);
        assert.match(reports[0].Detail, /armedBy: operator/);
        assert.doesNotMatch(reports[0].Detail, /armedBy: self/);
    } finally {
        rmRepoRoot(repoRoot);
    }
});

test('a plan path containing ".." is refused before any plan reading, and names no arming', { skip: !isWin }, () => {
    const repoRoot = makeRepoRoot('doctor-goal-traversal-');
    try {
        const traversing = '../outside/plan.md';
        writeGoalState(repoRoot, { plan: traversing, queue: [traversing], queueIndex: 0, armedBy: { [traversing]: 'self' } });
        const reports = runGoalStateSection(repoRoot);
        assert.strictEqual(reports.length, 1, JSON.stringify(reports));
        assert.strictEqual(reports[0].Status, 'WARN');
        assert.match(reports[0].Detail, /refusing to inspect it/);
        assert.doesNotMatch(reports[0].Detail, /armedBy: self/);
        assert.doesNotMatch(reports[0].Detail, /armedBy: operator/);
    } finally {
        rmRepoRoot(repoRoot);
    }
});

test('unparseable state names no arming', { skip: !isWin }, () => {
    const repoRoot = makeRepoRoot('doctor-goal-unparseable-');
    try {
        writeGoalState(repoRoot, '{ not json');
        const reports = runGoalStateSection(repoRoot);
        assert.strictEqual(reports.length, 1, JSON.stringify(reports));
        assert.strictEqual(reports[0].Status, 'WARN');
        assert.match(reports[0].Detail, /unparseable/);
        assert.doesNotMatch(reports[0].Detail, /armedBy: self/);
        assert.doesNotMatch(reports[0].Detail, /armedBy: operator/);
    } finally {
        rmRepoRoot(repoRoot);
    }
});

test('no goal-state.json at all names no arming', { skip: !isWin }, () => {
    const repoRoot = makeRepoRoot('doctor-goal-absent-');
    try {
        const reports = runGoalStateSection(repoRoot);
        assert.strictEqual(reports.length, 1, JSON.stringify(reports));
        assert.strictEqual(reports[0].Status, 'INFO');
        assert.doesNotMatch(reports[0].Detail, /armedBy: self/);
        assert.doesNotMatch(reports[0].Detail, /armedBy: operator/);
    } finally {
        rmRepoRoot(repoRoot);
    }
});

test('a mixed-arming queue names the reported plan\'s own arming, not the other plan\'s', { skip: !isWin }, () => {
    const repoRoot = makeRepoRoot('doctor-goal-mixed-');
    try {
        writePlanDoc(repoRoot, 'In Progress');
        const other = 'docs/plans/fake_other_v1.md';
        writeGoalState(repoRoot, {
            plan: PLAN_REL, queue: [PLAN_REL, other], queueIndex: 0,
            armedBy: { [PLAN_REL]: 'operator', [other]: 'self' }
        });
        const reports = runGoalStateSection(repoRoot);
        assert.strictEqual(reports.length, 1, JSON.stringify(reports));
        assert.strictEqual(reports[0].Status, 'PASS');
        assert.match(reports[0].Detail, new RegExp('Arming of .*' + PLAN_REL.replace('.', '\\.') + '.*recorded as the operator'), reports[0].Detail);
        assert.doesNotMatch(reports[0].Detail, SELF_WORDING, reports[0].Detail);
        assert.match(reports[0].Detail, /Remaining after it/, reports[0].Detail);
    } finally {
        rmRepoRoot(repoRoot);
    }
});

// --- The ordinal-comparison cases below (defect class fixed this round).
// The soft-hyphen cases prove their direction two ways: red against the
// saved pre-fix copy of doctor.ps1 (DOCTOR_PREFIX, which used -ceq and the
// plain member indexer), green against the shipped one. Both halves skip
// together when the pre-fix copy is not present, since the red half has
// nothing to run against. Their fixtures carry a UTF-8 BOM (see
// writeGoalState) so the soft hyphen they plant survives doctor.ps1's plain,
// no-encoding Get-Content read intact, isolating the comparison this suite
// targets from that separate encoding behavior.

test('a key differing from the plan path only by case reads as nothing recorded', { skip: !isWin }, () => {
    const repoRoot = makeRepoRoot('doctor-goal-casekey-');
    try {
        writePlanDoc(repoRoot, 'In Progress');
        const wrongCaseKey = PLAN_REL.toUpperCase();
        writeGoalState(repoRoot, { plan: PLAN_REL, queue: [PLAN_REL], queueIndex: 0, armedBy: { [wrongCaseKey]: 'self' } });

        const reports = runGoalStateSection(repoRoot);
        assert.strictEqual(reports.length, 1, JSON.stringify(reports));
        assert.match(reports[0].Detail, ABSENT_WORDING, reports[0].Detail);
        assert.doesNotMatch(reports[0].Detail, SELF_WORDING, reports[0].Detail);

        // -ceq is already case-sensitive (confirmed: 'Self' -ceq 'self' is
        // False on Windows PowerShell 5.1), so this exact fixture already
        // read correctly under the pre-fix code too; the pre-fix copy's
        // defect is culture sensitivity (a collation-ignorable character),
        // not case, which the soft-hyphen cases below cover. This case
        // guards against a future regression to a case-insensitive compare
        // (-eq or the plain member indexer), not the defect this round fixed.
    } finally {
        rmRepoRoot(repoRoot);
    }
});

test('a collation-ignorable decoy key (soft hyphen) placed before the real key does not shadow it', { skip: !isWin }, () => {
    const repoRoot = makeRepoRoot('doctor-goal-decoybefore-');
    try {
        writePlanDoc(repoRoot, 'In Progress');
        const decoyKey = 'docs/plans/fake_plan' + SH + '_v1.md';
        // JSON.stringify preserves insertion order for non-integer keys, so
        // the decoy, written first, is the first property PSObject.Properties
        // enumerates.
        const armedBy = {};
        armedBy[decoyKey] = 'self';
        armedBy[PLAN_REL] = 'operator';
        writeGoalState(repoRoot, { plan: PLAN_REL, queue: [PLAN_REL], queueIndex: 0, armedBy }, true);

        const reportsGreen = runGoalStateSection(repoRoot);
        assert.strictEqual(reportsGreen.length, 1, JSON.stringify(reportsGreen));
        assert.match(reportsGreen[0].Detail, OPERATOR_WORDING, 'the ordinal search must skip the decoy and read the real key\'s own value: ' + reportsGreen[0].Detail);
        assert.doesNotMatch(reportsGreen[0].Detail, SELF_WORDING, reportsGreen[0].Detail);

        if (hasPrefix) {
            const reportsRed = runGoalStateSection(repoRoot, DOCTOR_PREFIX);
            assert.match(reportsRed[0].Detail, /armedBy: self/, 'pre-fix doctor.ps1 must let the -ceq-matching decoy break the search before the real key is reached: ' + reportsRed[0].Detail);
        }
    } finally {
        rmRepoRoot(repoRoot);
    }
});

test('a collation-ignorable decoy key (soft hyphen) with no real key present reads as nothing recorded', { skip: !isWin }, () => {
    const repoRoot = makeRepoRoot('doctor-goal-decoyonly-');
    try {
        writePlanDoc(repoRoot, 'In Progress');
        const decoyKey = 'docs/plans/fake_plan' + SH + '_v1.md';
        writeGoalState(repoRoot, { plan: PLAN_REL, queue: [PLAN_REL], queueIndex: 0, armedBy: { [decoyKey]: 'self' } }, true);

        const reportsGreen = runGoalStateSection(repoRoot);
        assert.strictEqual(reportsGreen.length, 1, JSON.stringify(reportsGreen));
        assert.match(reportsGreen[0].Detail, ABSENT_WORDING, reportsGreen[0].Detail);
        assert.doesNotMatch(reportsGreen[0].Detail, SELF_WORDING, reportsGreen[0].Detail);

        if (hasPrefix) {
            const reportsRed = runGoalStateSection(repoRoot, DOCTOR_PREFIX);
            assert.match(reportsRed[0].Detail, /armedBy: self/, 'pre-fix doctor.ps1 must read the collation-ignorable decoy as a match for the real key: ' + reportsRed[0].Detail);
        }
    } finally {
        rmRepoRoot(repoRoot);
    }
});

test('a value spelled with an embedded soft hyphen ("se\\u00adlf") reads as the operator\'s arming', { skip: !isWin }, () => {
    const repoRoot = makeRepoRoot('doctor-goal-decoyvalue-');
    try {
        writePlanDoc(repoRoot, 'In Progress');
        const decoyValue = 'se' + SH + 'lf';
        writeGoalState(repoRoot, { plan: PLAN_REL, queue: [PLAN_REL], queueIndex: 0, armedBy: { [PLAN_REL]: decoyValue } }, true);

        const reportsGreen = runGoalStateSection(repoRoot);
        assert.strictEqual(reportsGreen.length, 1, JSON.stringify(reportsGreen));
        assert.match(reportsGreen[0].Detail, OPERATOR_WORDING, reportsGreen[0].Detail);
        assert.doesNotMatch(reportsGreen[0].Detail, SELF_WORDING, reportsGreen[0].Detail);

        if (hasPrefix) {
            const reportsRed = runGoalStateSection(repoRoot, DOCTOR_PREFIX);
            assert.match(reportsRed[0].Detail, /armedBy: self/, 'pre-fix doctor.ps1 must read the collation-ignorable value as self (the -ceq defect): ' + reportsRed[0].Detail);
        }
    } finally {
        rmRepoRoot(repoRoot);
    }
});

test('the outer field spelled "ArmedBy" (wrong case) reads as nothing recorded', { skip: !isWin }, () => {
    const repoRoot = makeRepoRoot('doctor-goal-outercase-');
    try {
        writePlanDoc(repoRoot, 'In Progress');
        const state = { plan: PLAN_REL, queue: [PLAN_REL], queueIndex: 0 };
        state['ArmedBy'] = { [PLAN_REL]: 'self' };
        writeGoalState(repoRoot, state);

        const reportsGreen = runGoalStateSection(repoRoot);
        assert.strictEqual(reportsGreen.length, 1, JSON.stringify(reportsGreen));
        assert.match(reportsGreen[0].Detail, ABSENT_WORDING, reportsGreen[0].Detail);
        assert.doesNotMatch(reportsGreen[0].Detail, SELF_WORDING, reportsGreen[0].Detail);

        if (hasPrefix) {
            const reportsRed = runGoalStateSection(repoRoot, DOCTOR_PREFIX);
            assert.match(reportsRed[0].Detail, /armedBy: self/, 'pre-fix doctor.ps1 must resolve the wrong-cased field through the case-insensitive member indexer: ' + reportsRed[0].Detail);
        }
    } finally {
        rmRepoRoot(repoRoot);
    }
});

test('a map holding an entry only for a different plan reads as nothing recorded for the reported plan', { skip: !isWin }, () => {
    const repoRoot = makeRepoRoot('doctor-goal-otherplan-');
    try {
        writePlanDoc(repoRoot, 'In Progress');
        const other = 'docs/plans/fake_other_v1.md';
        writeGoalState(repoRoot, { plan: PLAN_REL, queue: [PLAN_REL], queueIndex: 0, armedBy: { [other]: 'self' } });

        const reports = runGoalStateSection(repoRoot);
        assert.strictEqual(reports.length, 1, JSON.stringify(reports));
        assert.match(reports[0].Detail, ABSENT_WORDING, reports[0].Detail);
        assert.doesNotMatch(reports[0].Detail, SELF_WORDING, reports[0].Detail);
    } finally {
        rmRepoRoot(repoRoot);
    }
});

// --- Cross-file pin: the doctor's PowerShell reads the same literal
// ('self') that kit-goal-lib.js's normalizeArmedBy and planArmedBy compare
// against, so a JS-side rename of that literal is caught here rather than
// silently making the doctor report every self-arming as the operator's.

function extractFunctionBody(src, name, nextName) {
    const marker = 'function ' + name + '(';
    const start = src.indexOf(marker);
    assert.ok(start >= 0, name + ' not found in kit-goal-lib.js');
    const nextMarker = 'function ' + nextName + '(';
    const end = src.indexOf(nextMarker, start);
    assert.ok(end >= 0, nextName + ' not found after ' + name + ' in kit-goal-lib.js');
    return src.slice(start, end);
}

test('cross-file pin: kit-goal-lib.js compares armedBy entries against the literal the doctor accepts (self)', () => {
    const src = fs.readFileSync(GOAL_LIB, 'utf8');
    const normalizeBody = extractFunctionBody(src, 'normalizeArmedBy', 'armedByFor');
    const planArmedByBody = extractFunctionBody(src, 'planArmedBy', 'armedByArg');
    const selfLiteral = /===\s*'self'/;
    assert.match(normalizeBody, selfLiteral, 'normalizeArmedBy must compare against the literal \'self\': ' + normalizeBody);
    assert.match(planArmedByBody, selfLiteral, 'planArmedBy must compare against the literal \'self\': ' + planArmedByBody);
});

test('cross-file pin control: the self-literal assertion can fail on a re-spelled literal', () => {
    // Proves the assertion above is not vacuous: a body that compares
    // against a different literal ('selfx') does not match the exact
    // pattern the real pin uses, so that pattern is capable of going red
    // rather than passing because it matches nothing in particular.
    const respelled = "function normalizeArmedBy(value, queue) {\n" +
        "    clean[rel] = usable && value[rel] === 'selfx' ? 'yes' : 'operator';\n" +
        "}\n";
    const selfLiteral = /===\s*'self'/;
    assert.throws(() => {
        assert.match(respelled, selfLiteral, respelled);
    });
});
