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

// Same reasoning as above, and load-bearing for a second reason: the
// executing-work and finishing-work skills both point at this bullet as the
// authorization for their Workflow reviewer dispatch. A symmetric deletion of
// the Workflow grant would pass whole-body identity while silently falsifying
// both of those committed pointers, so the grant's presence is pinned here
// rather than left to the bodies matching each other.
test('the standing-dispatch bullet is present once in each copy, identical, and carries the Workflow grant', () => {
    const lead = '- **Dispatch is requested standing';
    const inSkill = skillBody().split('\n').filter((l) => l.startsWith(lead));
    const inMirror = mirrorBody().split('\n').filter((l) => l.startsWith(lead));
    assert.strictEqual(inSkill.length, 1,
        'expected exactly one standing-dispatch bullet in the skill body');
    assert.strictEqual(inMirror.length, 1,
        'expected exactly one standing-dispatch bullet in the doctrine mirror');
    assert.strictEqual(inMirror[0], inSkill[0]);
    assert.match(inSkill[0], /covers the Workflow tool/,
        'the standing-dispatch bullet no longer grants the Workflow tool, but '
        + 'executing-work and finishing-work both cite it as the authorization '
        + 'for their reviewer-effort dispatch; restore the grant or remove those '
        + 'pointers');
    // Matched on the requiring phrase rather than the bare field name: a rewrite
    // that mentions agentType while making it optional would pass /agentType/ and
    // still drop the condition, and this assertion is the only mechanical trace
    // over a requirement nothing else enforces (no hook matches the Workflow tool).
    assert.match(inSkill[0], /naming an `agentType` the read-only guard governs/,
        'the Workflow grant no longer requires an agentType the read-only guard '
        + 'governs, which is the condition that keeps a Workflow-dispatched '
        + 'reviewer from holding write access to the tree under review');
});

// Whole-body identity would pass with the checkpoint sentence deleted from
// BOTH copies, and three shipped surfaces lean on the doctrine carrying it:
// the chapter-boundary nudge hook, the Stop hook's hold reasons, and the
// compaction gate's operator note each reinforce a rule that the
// always-loaded layer would no longer state. A symmetric deletion would
// leave those three pointing at nothing while the suite stayed green, so the
// sentence's presence inside the chapter-close bullet is pinned here.
test('the chapter-close bullet names the compaction checkpoint in each copy', () => {
    const lead = '- **Close each section with a Chapter.**';
    for (const [label, body] of [['skill body', skillBody()], ['doctrine mirror', mirrorBody()]]) {
        const lines = body.split(/\r?\n/).filter((l) => l.startsWith(lead));
        assert.strictEqual(lines.length, 1,
            'expected exactly one chapter-close bullet in the ' + label);
        assert.ok(lines[0].includes('the compaction checkpoint is opened'),
            'the chapter-close bullet in the ' + label + ' must name the compaction '
            + 'checkpoint as part of closing a section on a leashed run');
        assert.ok(lines[0].includes('kit-compact-checkpoint.js open'),
            'the chapter-close bullet in the ' + label + ' must name the command, '
            + 'because its audience is a session that never loaded executing-work '
            + 'and so cannot follow a pointer to it');
    }
});

// The two liveness bullets defer their whole operative content to
// finishing-work: the wedge hallmark, the cadence, and the windows all live
// there, and standing-watch:69 makes a committed pointer back at the doctrine
// for the probe habit. Whole-body identity would pass with either bullet
// deleted from BOTH copies, leaving that pointer aimed at nothing and the
// always-on layer silent on the one rule that keeps a session from killing a
// working agent. The deferral is what earns the pin: a rule carrying its own
// content fails visibly when deleted, where this one fails by going quiet.
test('the liveness bullets defer to finishing-work in each copy', () => {
    const leads = [
        '- **Probe a dispatched agent with a message',
        '- **No completion notification is not a stall signal',
    ];
    for (const [label, body] of [['skill body', skillBody()], ['doctrine mirror', mirrorBody()]]) {
        for (const lead of leads) {
            const lines = body.split(/\r?\n/).filter((l) => l.startsWith(lead));
            assert.strictEqual(lines.length, 1,
                'expected exactly one bullet leading "' + lead + '" in the ' + label);
            assert.ok(lines[0].includes('finishing-work'),
                'the bullet leading "' + lead + '" in the ' + label + ' must name '
                + 'finishing-work as the owner of the wedge hallmark it defers to, '
                + 'because the bullet carries none of that rule\'s content itself');
        }
    }
});

// Same green-passing deletion path as the liveness pin above, one step further
// out, and it has two ends. The outline bullet keeps only the principle and
// routes every language anchor to the style skill that owns that language's
// idioms. Four surfaces carry the rule with it: executing-work's approach read
// names the doctrine bullet outright, and the three non-haiku implementer
// charters restate it locally and route to the same style skills, because a
// subagent inherits the doctrine only where the machine's CLAUDE.md carries
// the kit import. A symmetric deletion at either end passes the whole-body
// identity check while the chain goes quiet, so both ends are asserted: the
// bullet routes, the routed-to sections exist, and the four surfaces still
// carry their clause.
test('the outline bullet routes to the style skills in each copy', () => {
    const lead = '- **When you are hunting for something in a large file';
    for (const [label, body] of [['skill body', skillBody()], ['doctrine mirror', mirrorBody()]]) {
        const lines = body.split(/\r?\n/).filter((l) => l.startsWith(lead));
        assert.strictEqual(lines.length, 1,
            'expected exactly one outline bullet in the ' + label);
        for (const skill of ['csharp-style', 'sql-style']) {
            assert.ok(lines[0].includes('skills/' + skill + '/SKILL.md'),
                'the outline bullet in the ' + label + ' must route to ' + skill
                + ' by path, because the bullet carries no language anchors of '
                + 'its own and that skill is where they live');
        }
    }
});

test('the style skills the outline bullet routes to still carry a recipe', () => {
    for (const skill of ['csharp-style', 'sql-style']) {
        const p = path.join(__dirname, '..', 'plugins', 'claude-kit', 'skills',
            skill, 'SKILL.md');
        assert.ok(fs.existsSync(p), skill + ' is routed to by the doctrine\'s '
            + 'outline bullet and must exist');
        assert.match(fs.readFileSync(p, 'utf8'), /^## Outlining a large file$/m,
            skill + ' must carry its Outlining section: the doctrine points at '
            + 'it by path and carries no anchors of its own, so deleting the '
            + 'section leaves that pointer aimed at nothing');
    }
});

test('the surfaces that defer to the outline bullet still say so', () => {
    const deferring = [
        [['agents', 'implementer-sonnet.md'], /hunting for one thing in a file past roughly 1,000 lines/],
        [['agents', 'implementer-opus.md'], /hunting for one thing in a file past roughly 1,000 lines/],
        [['agents', 'implementer-fable.md'], /hunting for one thing in a file past roughly 1,000 lines/],
        [['skills', 'executing-work', 'SKILL.md'], /rule on hunting in a large file/],
    ];
    for (const [parts, phrase] of deferring) {
        const p = path.join(__dirname, '..', 'plugins', 'claude-kit', ...parts);
        const body = fs.readFileSync(p, 'utf8');
        assert.match(body, phrase, parts.join('/') + ' must still carry its '
            + 'outline clause. Matched on the clause\'s own phrase rather than '
            + 'the bare word outline, which any later unrelated mention would '
            + 'satisfy: a deletion here breaks the chain from the far end while '
            + 'the identity check stays green');
    }
});
