// The operating doctrine ships as two repo copies: the source,
// plugins/claude-kit/skills/operating-instructions/SKILL.md, and the mirror,
// home/claude-kit-doctrine.md. Every doctrine edit must land in both, and a
// review pass is how the copies have historically drifted, so parity is
// enforced here mechanically.
//
// Comparison unit: the skill's body after its YAML frontmatter block, against
// the mirror's whole content. The frontmatter strip has the same semantics as
// the doctrine-refresh hook's stripFrontmatter and the doctor's
// Get-DoctrineBody (drop a leading '---'-fenced block and one blank line
// after it); it is restated here rather than imported because those two run
// against the installed machine copies and neither is loadable from a test
// (the hook module runs main() and exits on load; the doctor is PowerShell).
// This test compares the repo copies, a pair neither of them checks.
//
// Line endings are normalized to \n and trailing newlines trimmed before
// comparing, so a CRLF/LF checkout difference can never fail a parity the
// content holds. Everything else is byte-exact.

'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const SKILL = path.join(__dirname, '..', 'plugins', 'claude-kit', 'skills',
    'operating-instructions', 'SKILL.md');
const MIRROR = path.join(__dirname, '..', 'home', 'claude-kit-doctrine.md');

function stripFrontmatter(text) {
    const lines = text.split('\n');
    if ((lines[0] || '').trim() !== '---') return text;
    let end = -1;
    for (let i = 1; i < lines.length; i++) {
        if (lines[i].trim() === '---') { end = i; break; }
    }
    if (end === -1) return text;
    return lines.slice(end + 1).join('\n').replace(/^\r?\n/, '');
}

function normalize(text) {
    // \n* rather than \n+: with \n+ the substitution only fires when a
    // trailing newline exists, so a copy saved without a final newline would
    // fail parity against identical content, which is the line-ending noise
    // this normalization exists to remove.
    return text.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').replace(/\n*$/, '\n');
}

function skillBody() {
    return normalize(stripFrontmatter(fs.readFileSync(SKILL, 'utf8').replace(/^\uFEFF/, '')));
}

function mirrorBody() {
    return normalize(fs.readFileSync(MIRROR, 'utf8'));
}

test('the two doctrine copies are byte-identical (skill body vs mirror)', () => {
    assert.strictEqual(mirrorBody(), skillBody(),
        'home/claude-kit-doctrine.md has drifted from the operating-instructions '
        + 'skill body; the skill is the source, so sync the mirror to it');
});

// Whole-body identity would still pass with the memory-extension pointer
// bullet deleted from both copies, so its presence is pinned separately:
// exactly one line in each copy opens with the bullet's lead, and the two
// lines match byte for byte.
test('the memory-extension pointer bullet is present once in each copy and identical', () => {
    const lead = '- **The kit memory store has an extension layer';
    const inSkill = skillBody().split('\n').filter((l) => l.startsWith(lead));
    const inMirror = mirrorBody().split('\n').filter((l) => l.startsWith(lead));
    assert.strictEqual(inSkill.length, 1,
        'expected exactly one memory-extension bullet in the skill body');
    assert.strictEqual(inMirror.length, 1,
        'expected exactly one memory-extension bullet in the doctrine mirror');
    assert.strictEqual(inMirror[0], inSkill[0]);
});
