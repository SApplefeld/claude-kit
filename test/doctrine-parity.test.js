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
//
// A second class of test lives below the doctrine-copy pins: presence-and-
// tracking checks that do not start from a doctrine bullet at all, but from
// a committed pointer in one file (a README map entry, a skill's own prose)
// naming another. Those close the same gap the doctrine pins close, a
// deletion or drift that a diff-blind review pass would not catch, for
// pointers that live outside the doctrine copies.

'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

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

// The failure this check exists to catch is a commit that omits a newly
// created file: git ls-files --error-unmatch asserts the path sits in the
// index, so an ordinary pathspec-less commit taken from this state carries
// it, and the never-added case, a file created and forgotten, reddens here
// on the machine that wrote it rather than only on some later fresh
// checkout, and this repo runs no CI to be that checkout. What it cannot
// see: a `git commit <pathspec>` that stages other paths and excludes this
// already-added one leaves the path in the index and out of HEAD, and
// nothing local catches that. Asserting against HEAD instead would close
// that gap but would also redden during the section that creates the file,
// before its commit lands, which is the normal shape of every skill-adding
// section in this repo, so the check stays scoped to the index.
function assertTrackedInIndex(relPath) {
    execFileSync('git', ['ls-files', '--error-unmatch', '--', relPath],
        { cwd: path.join(__dirname, '..'), stdio: 'pipe' });
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

// The gate bullet and the authoring bullet are the outline bullet's shape
// applied to testing: each keeps the principle it alone owns and routes the
// mechanics to the testing-discipline skill. That deferral is what earns a pin
// beyond whole-body identity, since a symmetric deletion from both copies
// passes identity while the standing rule stops being stated anywhere and the
// skill it routed to becomes a file nothing points at.
//
// The gate bullet is the near end for the lane rule: the doctrine names the
// moments (after a fix, at section close, at finishing, before a push) and
// carries none of the lane mechanics itself, so the pointer is the only path
// from the always-loaded layer to them.
test('the gate bullet routes its lanes to the testing-discipline skill in each copy', () => {
    const lead = '- **After each step, run the lane the moment calls for';
    const inSkill = skillBody().split('\n').filter((l) => l.startsWith(lead));
    const inMirror = mirrorBody().split('\n').filter((l) => l.startsWith(lead));
    assert.strictEqual(inSkill.length, 1,
        'expected exactly one gate bullet in the skill body');
    assert.strictEqual(inMirror.length, 1,
        'expected exactly one gate bullet in the doctrine mirror');
    assert.strictEqual(inMirror[0], inSkill[0]);
    assert.ok(inSkill[0].includes('skills/testing-discipline/SKILL.md'),
        'the gate bullet must route to testing-discipline by path, because it '
        + 'names the gate moments and carries none of the lane mechanics itself');
    // The moments are the bullet's own content rather than the skill's, so a
    // rewrite that keeps the pointer while dropping one of them leaves the
    // always-loaded layer silent on the moment it dropped: without the targeted
    // lane every fix round is priced at the whole gate again, and without one of
    // the whole-gate moments a section closes, a push lands, or a finishing pass
    // runs on a lane too narrow to support the claim it makes.
    for (const [phrase, why] of [
        [/targeted lane/, 'name the targeted lane as what a fix takes'],
        [/section close/, 'name section close as a whole-gate moment'],
        [/at finishing/, 'name finishing as a whole-gate moment'],
        [/before a push/, 'name before a push as a whole-gate moment'],
        [/shared module/, 'state the shared-module condition, which is the only '
            + 'thing that pulls a fix round up to the whole gate'],
    ]) {
        assert.match(inSkill[0], phrase, 'the gate bullet must ' + why
            + '; the pointer does not carry the moments, so a reader who never '
            + 'opens the skill has only this bullet to run a gate from');
    }
    // The contention lane is named here rather than left to the skill because a
    // session reading only the always-loaded layer would otherwise run the whole
    // gate before a push, skip every test whose subject is machine-shared state,
    // and report green over the one area no other lane covers.
    assert.match(inSkill[0], /contention lane/,
        'the gate bullet no longer names the contention lane beside the whole '
        + 'gate, so a doctrine-only reader pushes on a gate that skipped the '
        + 'tests covering machine-shared state');
    // Lane-scoped baselines: a delta is only a delta against the same lane, and
    // this is the assertion standing between a 12-test targeted run and a "no
    // regressions" claim diffed against a whole-gate baseline.
    assert.match(inSkill[0], /baseline recorded on that same lane/,
        'the gate bullet no longer scopes the baseline to the lane that produced '
        + 'it, which licenses diffing a targeted run against a whole-gate '
        + 'baseline and reporting the difference as no regressions');
});

// Same shape at the authoring end: the bullet keeps independence-by-
// construction and routes the cost shapes, the wall-clock capture, and the
// comparable-contention rule to the skill that owns them.
test('the authoring bullet routes its cost shapes to the testing-discipline skill in each copy', () => {
    const lead = '- **Write tests independent by construction';
    const inSkill = skillBody().split('\n').filter((l) => l.startsWith(lead));
    const inMirror = mirrorBody().split('\n').filter((l) => l.startsWith(lead));
    assert.strictEqual(inSkill.length, 1,
        'expected exactly one test-authoring bullet in the skill body');
    assert.strictEqual(inMirror.length, 1,
        'expected exactly one test-authoring bullet in the doctrine mirror');
    assert.strictEqual(inMirror[0], inSkill[0]);
    assert.ok(inSkill[0].includes('skills/testing-discipline/SKILL.md'),
        'the test-authoring bullet must route to testing-discipline by path: the '
        + 'spawn pricing, the wall-clock capture, and the comparable-contention '
        + 'rule live in that skill and in no clause of this bullet');
});

// The box-check rule is stated in full in both the doctrine and the skill, on
// purpose: it must be reachable by a session that never loads the skill, and a
// point-of-action restatement of a doctrine-adjacent rule is sanctioned. What
// the duplication costs is drift, so the two statements are pinned together
// here, at the sentence that does the work. The class sentence is the whole
// rule: a session that read the old engine list as the boundary checked the box
// exactly as written and started its suite beside a live gate in an engine the
// list did not name.
test('the box-check bullet states the class in each copy and in the skill', () => {
    const lead = '- **One heavy process at a time is a per-machine budget';
    const inSkill = skillBody().split('\n').filter((l) => l.startsWith(lead));
    const inMirror = mirrorBody().split('\n').filter((l) => l.startsWith(lead));
    assert.strictEqual(inSkill.length, 1,
        'expected exactly one box-check bullet in the skill body');
    assert.strictEqual(inMirror.length, 1,
        'expected exactly one box-check bullet in the doctrine mirror');
    assert.strictEqual(inMirror[0], inSkill[0]);
    assert.match(inSkill[0], /instances, not the boundary/,
        'the box-check bullet no longer closes its engine list with the class, '
        + 'so `testhost`, `dotnet`, and `node --test` read as the boundary and a '
        + 'runner in an unnamed engine is licensed to run beside your suite');
    assert.match(inSkill[0], /whatever its engine/,
        'the box-check bullet no longer states the check engine-agnostically');

    // The skill's own box-check bullet is the same rule at the point of action.
    // Both halves of the ownership condition are pinned: it covers a process
    // owned by another session and one owned by a running engine, which is the
    // half a restatement drops first, since an engine holding the box is not a
    // session anyone thinks to look for.
    const skillPath = path.join(__dirname, '..', 'plugins', 'claude-kit',
        'skills', 'testing-discipline', 'SKILL.md');
    const boxLead = '- **Check the box before any suite.**';
    const inTesting = fs.readFileSync(skillPath, 'utf8').split(/\r?\n/)
        .filter((l) => l.startsWith(boxLead));
    assert.strictEqual(inTesting.length, 1,
        'expected exactly one box-check bullet in the testing-discipline skill');
    assert.match(inTesting[0], /whatever its engine/,
        'the testing-discipline skill\'s box check no longer states the check '
        + 'engine-agnostically, while the doctrine\'s copy of the same rule does');
    assert.match(inTesting[0], /running engine/,
        'the testing-discipline skill\'s box check no longer covers a process '
        + 'owned by a running engine, which the doctrine\'s copy of the same rule '
        + 'covers; the two are the same rule at two points of action and a '
        + 'session that loads only one of them must get the same check');
});

// The far end of both pointers above, in the shape the style-skill pin uses:
// the file exists, sits in the index, and still carries what each bullet defers
// to. The index check is what keeps the pointer honest across machines, since a
// target present but never added passes on the machine that wrote it and is
// absent on a fresh checkout.
//
// Headings alone are too coarse a far end: the near-end bullets promise named
// contents (a contention lane, a wall clock captured with the baseline, a
// contention figure beside it), and deleting any one of those leaves its
// heading standing and this pin green while the doctrine promises what the
// skill no longer carries. So the leads are pinned beside the headings.
test('the testing-discipline skill still carries what the doctrine routes to it', () => {
    const parts = ['plugins', 'claude-kit', 'skills', 'testing-discipline', 'SKILL.md'];
    const target = path.join(__dirname, '..', ...parts);
    assert.ok(fs.existsSync(target),
        'the doctrine\'s gate and test-authoring bullets both route to a skill '
        + 'that is not on disk: ' + parts.join('/'));
    const body = fs.readFileSync(target, 'utf8');
    for (const heading of [/^## Price the shape at authoring$/m, /^## The lanes$/m,
        /^## The clock and the box$/m]) {
        assert.match(body, heading, 'the doctrine bullets route their lane '
            + 'mechanics, cost shapes, wall-clock capture, and contention rule '
            + 'here and carry none of that content themselves, so deleting this '
            + 'section leaves the pointer aimed at nothing: ' + heading);
    }
    for (const [lead, promised] of [
        ['- **The contention lane**', 'the contention lane the gate bullet runs '
            + 'beside the whole gate'],
        ['- **Capture the clock with the baseline.**', 'the wall-clock capture '
            + 'the test-authoring bullet defers here'],
        ['- **Record the contention beside the clock.**', 'the '
            + 'comparable-contention rule the test-authoring bullet defers here'],
    ]) {
        assert.ok(body.split(/\r?\n/).some((l) => l.startsWith(lead)),
            'the testing-discipline skill no longer carries ' + promised
            + ', so the doctrine promises content the skill has dropped while its '
            + 'section heading still stands: ' + lead);
    }
    assertTrackedInIndex(parts.join('/'));
});

// The peer-sessions bullet defers its whole operative content to the
// peer-sessions skill (it names the contracts, patterns, and etiquette rather
// than restating them), which is exactly the class whose deletion the
// whole-body parity test above cannot catch: a symmetric deletion from both
// copies would pass identity while leaving the standing rule unstated. The
// presence pin closes that gap.
test('the peer-sessions bullet is present once in each copy and identical', () => {
    const lead = '- **Peer sessions are a coordination surface, not a record.**';
    const inSkill = skillBody().split('\n').filter((l) => l.startsWith(lead));
    const inMirror = mirrorBody().split('\n').filter((l) => l.startsWith(lead));
    assert.strictEqual(inSkill.length, 1,
        'expected exactly one peer-sessions bullet in the skill body');
    assert.strictEqual(inMirror.length, 1,
        'expected exactly one peer-sessions bullet in the doctrine mirror');
    assert.strictEqual(inMirror[0], inSkill[0]);
    // Presence alone closes only half the gap: the half where the bullet
    // vanishes. A bullet still present but pointing at a skill that was
    // renamed, deleted, emptied to a stub, or never committed leaves the
    // always-on layer aiming at nothing with the suite green, so the far end
    // is pinned too, the way the outline bullet's pin asserts its own
    // routed-to skills.
    assert.ok(inSkill[0].includes('`peer-sessions` skill'),
        'the peer-sessions bullet no longer names the skill it defers to');
    const parts = ['plugins', 'claude-kit', 'skills', 'peer-sessions', 'SKILL.md'];
    const target = path.join(__dirname, '..', ...parts);
    assert.ok(fs.existsSync(target),
        'the peer-sessions bullet defers to a skill that is not on disk: '
        + parts.join('/'));
    // Existence is the weaker sibling of the outline pin, which asserts
    // routed-to content rather than a routed-to file. The bullet defers three
    // named things, so all three are pinned: a stub passing existence would
    // otherwise satisfy a pointer that promises contracts, patterns, and
    // etiquette. The Naming heading rides along for a different pointer,
    // the coordinator skill's seat-handoff paragraph and its "the peer-sessions Naming section owns", which is the
    // reverse direction of the same skill-to-skill pointer pair; it belongs
    // here rather than in a pin of its own because it is the same defect
    // class against the same file.
    const body = fs.readFileSync(target, 'utf8');
    for (const heading of [/^## The messaging surface$/m,
        /^## The sanctioned patterns$/m, /^## Etiquette$/m, /^## Naming$/m]) {
        assert.match(body, heading, 'the peer-sessions bullet defers to the '
            + 'skill\'s contracts, sanctioned patterns, and etiquette, and the '
            + 'coordinator skill separately defers to its Naming section, so '
            + 'deleting one of those sections leaves a pointer promising what '
            + 'the skill no longer carries: ' + heading);
    }
    assertTrackedInIndex(parts.join('/'));
});

// README's payload map and the peer-sessions Roles section both point at
// the coordinator skill. Asserting only the far end (the skill on disk,
// carrying what it promises) would stay green after the pointer itself was
// deleted, since nothing would then depend on the coordinator skill
// existing at all, so the near end is pinned first: the committed
// pointers still name the coordinator skill.
test('README and peer-sessions still point at the coordinator skill', () => {
    const readme = fs.readFileSync(path.join(__dirname, '..', 'README.md'), 'utf8');
    const mapLine = readme.split(/\r?\n/).find((l) => /^\s*coordinator\//.test(l));
    assert.ok(mapLine, 'README\'s payload map no longer carries a coordinator/ '
        + 'entry; the coordinator pin below reads this line as its near end');
    // Anchored on the words the entry promises rather than the whole line,
    // since the map's column alignment is cosmetic and will be reflowed
    // someday; a reflow that keeps the words would still pass this.
    for (const word of ['operator interface', 'cross-repo', 'resource arbitration']) {
        assert.ok(mapLine.toLowerCase().includes(word),
            'README\'s coordinator/ map entry no longer mentions "' + word
            + '", one of the three functions it promises the skill carries');
    }

    const peerSessions = fs.readFileSync(path.join(__dirname, '..', 'plugins',
        'claude-kit', 'skills', 'peer-sessions', 'SKILL.md'), 'utf8');
    assert.match(peerSessions, /the coordinator skill names the file/,
        'peer-sessions\' Roles section no longer names the coordinator skill as '
        + 'the ledger\'s owner; that clause is the near end of the pointer the '
        + 'next pin closes at its far end, and losing it here would leave that '
        + 'pin asserting a premise nothing in the tree depends on');
});

// The far end of the pointer pinned above: the coordinator skill on disk,
// tracked, and carrying what README and peer-sessions each promise it does.
test('the coordinator skill is tracked and carries what it is pointed at for', () => {
    const parts = ['plugins', 'claude-kit', 'skills', 'coordinator', 'SKILL.md'];
    const target = path.join(__dirname, '..', ...parts);
    assert.ok(fs.existsSync(target),
        'the README payload map and the peer-sessions Roles section both '
        + 'point at a coordinator skill that is not on disk: ' + parts.join('/'));
    const body = fs.readFileSync(target, 'utf8');

    // README's map line promises three named functions, not the heading text
    // "three": a fourth function added under the unchanged "## The three
    // functions" heading (kept as-is, since the skill states the set closed
    // at three as a design invariant) would pass heading presence while
    // breaking the closed-at-three promise the map line makes, so each
    // function's own lead is pinned instead of the heading.
    for (const lead of ['- **Operator interface.**',
        '- **Cross-repo dependency and portfolio sequencing.**',
        '- **Machine-resource arbitration.**']) {
        assert.ok(body.includes(lead),
            'README\'s payload map promises the coordinator\'s three functions '
            + '(operator interface, cross-repo sequencing, resource arbitration), '
            + 'and the skill no longer carries the function lead "' + lead + '"');
    }

    // peer-sessions' Roles section says the coordinator skill "names the file";
    // the file is coordinator/<machine>/board.md in the memory store. A
    // "## The ledger" heading kept while the path inside it is renamed or
    // dropped would pass heading presence while leaving that pointer aimed at a
    // name the skill no longer states, so the literal path is pinned instead of
    // the heading.
    assert.match(body, /coordinator\/<machine>\/board\.md/,
        'peer-sessions defers to the coordinator skill to name the ledger file '
        + 'as coordinator/<machine>/board.md in the memory store, and the skill '
        + 'no longer states that path anywhere in its body');

    // peer-sessions prices the status round at "no oftener than the
    // coordinator's heartbeat cadence, which that skill states". The seat's
    // paced wake is a reconciliation timer every 4 hours, stated once in the
    // cold-start opening above the "## The three functions" heading. No other
    // assertion here pins that figure: the function leads above pin other
    // paragraphs outright, and the path assertion above matches the opening
    // among several occurrences, so it stays green off the ledger's own
    // occurrence with the opening gone. Dropping the opening would take the
    // cadence with it and redden nothing without this assertion, which is why
    // it is separate. Matched loosely enough to survive ordinary rewording of the
    // sentence around it and tightly enough to redden when the figure is gone.
    assert.match(body, /reconciliation timer[^\n]{0,60}every 4 hours/i,
        'peer-sessions defers the status round\'s pricing to "the coordinator\'s '
        + 'heartbeat cadence, which that skill states", and the coordinator '
        + 'skill no longer states its paced cadence, a reconciliation timer '
        + 'every 4 hours, anywhere in its body');

    // The far end of that same deferral is the word it defers to: peer-sessions
    // prices against a "heartbeat cadence", so the timer has to be readable as
    // the seat's heartbeat and not only as a timer, or the clause points at a
    // cadence under a name this skill never uses. The window is 90 characters
    // because the sentence that names the timer as the heartbeat spans 68 of
    // them, which leaves room for rewording and is short enough that the two
    // words have to be making one claim rather than sitting in neighbouring
    // sentences about different things; the skill's paragraphs are one line
    // each, so a window wide enough to cross a sentence boundary twice would
    // go green off an unrelated pair.
    assert.match(body,
        /heartbeat[^\n]{0,90}reconciliation timer|reconciliation timer[^\n]{0,90}heartbeat/i,
        'peer-sessions prices the status round against "the coordinator\'s '
        + 'heartbeat cadence", and the coordinator skill no longer names its '
        + 'reconciliation timer as that heartbeat, leaving the deferral aimed '
        + 'at a cadence under a name this skill does not state');

    assertTrackedInIndex(parts.join('/'));
});

// The three pins below cover one drift class rather than three deletions: an
// amendment correct in itself falsifies an unchanged sentence in a file the
// changeset never opened, so no diff shows the falsification and every review
// lens reading the diff is blind to it. Each pin reads only the copies that
// make the claim, never the whole tree, so a document that quotes a retired
// phrasing while explaining it stays green.

// finishing-work states the never-started condition on the transcript's own
// assistant-line counts, because a transcript holding only the harness's
// <synthetic> placeholder satisfies a bare "no turn at all" literally while
// being the shape that rule routes to its own re-dispatch. Every copy that
// describes the first-turn reading therefore names the shape and defers the
// condition, and this pin is what makes the withdrawn spelling loud wherever
// it reappears.
//
// The match is anchored on the condition's own noun phrase rather than on the
// verb that introduces it. The verb is the part that varies (took, taken,
// takes, holding), so a tense-bound pattern goes quiet on the next spelling of
// the same claim, and an interposed noun ("no transcript turn at all") is that
// claim too. The bounded word run is what keeps the phrase a phrase: it spans
// the qualifiers a writer puts between "no" and "turn" without reaching across
// a sentence to pair an unrelated "no" with an unrelated "at all".
test('no copy spells the first-turn condition as a bare absence of turns', () => {
    const withdrawn = /no (?:[\w-]+ ){0,3}turns? at all/i;
    const describing = [
        ['home/claude-kit-doctrine.md', MIRROR],
        ['plugins/claude-kit/skills/operating-instructions/SKILL.md', SKILL],
        ['plugins/claude-kit/skills/finishing-work/SKILL.md',
            path.join(__dirname, '..', 'plugins', 'claude-kit', 'skills',
                'finishing-work', 'SKILL.md')],
        ['plugins/claude-kit/skills/executing-work/SKILL.md',
            path.join(__dirname, '..', 'plugins', 'claude-kit', 'skills',
                'executing-work', 'SKILL.md')],
    ];
    for (const [label, p] of describing) {
        const lines = fs.readFileSync(p, 'utf8').split(/\r?\n/);
        lines.forEach((line, i) => {
            const hit = line.match(withdrawn);
            if (!hit) return;
            // The matched text rides in the message rather than one fixed
            // spelling of it, so the report names the phrase actually on the
            // line whichever variant the pattern caught.
            assert.fail(label + ':' + (i + 1) + ' states the first-turn condition '
                + 'as "' + hit[0] + '", which a transcript holding only the '
                + '<synthetic> placeholder satisfies literally; name the '
                + 'never-started shape and defer the condition to finishing-work\'s '
                + 'unavailability rule instead');
        });
    }
});

// The doctrine's probe bullet carries no window of its own, which is what
// keeps it from drifting out of step with finishing-work's figures, and the
// deferral has to name the right owner: the growth window is the class's,
// while the window a first-turn reading earns is set by the dispatch's shape
// and is shared by every class. A bullet that sends a first-turn-earned probe
// to the class's probe window reads as correct and points at the wrong figure.
test('the probe bullet defers its first-turn probe window to the dispatch shape in each copy', () => {
    const copies = [
        ['plugins/claude-kit/skills/operating-instructions/SKILL.md', skillBody()],
        ['home/claude-kit-doctrine.md', mirrorBody()],
    ];
    const lead = '- **Probe a dispatched agent with a message';
    for (const [label, body] of copies) {
        const lines = body.split(/\r?\n/).filter((l) => l.startsWith(lead));
        assert.strictEqual(lines.length, 1,
            'expected exactly one probe bullet in ' + label);
        assert.ok(!/class'?s probe window/i.test(lines[0]),
            'the probe bullet in ' + label + ' sends the reader to "the '
            + 'class\'s probe window", which is the window a growth reading earns; '
            + 'the window a first-turn reading earns is the one the dispatch\'s '
            + 'shape sets, and finishing-work owns both');
        assert.match(lines[0], /probe window[^.;]{0,40}shape sets/,
            'the probe bullet in ' + label + ' must defer its probe window to '
            + 'the dispatch\'s shape, since the bullet carries no window of its own');
    }
});

// The unavailability rule concludes a fact about the gate (this gate could not
// be run at this tier in this environment) rather than about the model, since
// first-turn latency is correlated across a dispatch and its retry and two
// closed windows cannot separate an exhausted allotment from a brownout. The
// skills that route on that conclusion restate it in one clause each, so a
// clause still spelling it as a model being unreachable asserts what its own
// destination rule refuses to conclude. Scoped to the routing line at each
// site, because finishing-work and executing-work both discuss reachability
// elsewhere in prose that is true as written.
test('the hand-off copies route on the gate-level conclusion, not on a model being unreachable', () => {
    // Four sites make the hand-off, each named by its own text because line
    // numbers move. Three restate the conclusion in one clause and are pinned
    // to its gate-level spelling. The fourth, executing-work's
    // reviewer-effort-table line, defers to finishing-work's rule by name and
    // restates no conclusion of its own; that is the shape that cannot drift,
    // so its pin holds the deferral in place rather than demanding a
    // restatement, which would create a second copy of the conclusion for
    // every later amendment to sweep.
    const conclusion = /(?:could not|cannot) be run at (?:the|its) fable tier/;
    const deferral = /per finishing-work's unavailability rule/;
    const sites = [
        [['skills', 'consult', 'SKILL.md'],
            /the stand-in is Opus at `max`/, conclusion],
        [['skills', 'executing-work', 'SKILL.md'],
            /compensated per the effort table below/, conclusion],
        [['skills', 'executing-work', 'SKILL.md'],
            /Unavailability is confirmed and recorded/, deferral],
        [['skills', 'finishing-work', 'SKILL.md'],
            /the compensated re-dispatch that rule defines/, conclusion],
    ];
    for (const [parts, locator, expected] of sites) {
        const label = 'plugins/claude-kit/' + parts.join('/');
        const p = path.join(__dirname, '..', 'plugins', 'claude-kit', ...parts);
        const lines = fs.readFileSync(p, 'utf8').split(/\r?\n/);
        const hits = lines
            .map((line, i) => [line, i + 1])
            .filter(([line]) => locator.test(line));
        assert.strictEqual(hits.length, 1, 'expected exactly one line matching '
            + locator + ' in ' + label + '; the pin below reads that line, so a '
            + 'reworded or duplicated route leaves the conclusion unpinned');
        const [line, lineNo] = hits[0];
        assert.ok(!/unreachable/i.test(line), label + ':' + lineNo + ' routes on a '
            + 'model being "unreachable", which the unavailability rule declines to '
            + 'conclude: two closed windows establish only that this gate could not '
            + 'be run at this tier in this environment');
        assert.match(line, expected,
            label + ':' + lineNo + ' must carry ' + expected + ': the rule\'s own '
            + 'gate-level conclusion where the line restates one, or the deferral '
            + 'to finishing-work\'s rule where it routes without restating, since '
            + 'the line carries none of that rule\'s evidence itself');
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

// Section 3 of the testing-discipline plan added five pointers: three in
// executing-work (the settle-the-test-question paragraph, the Dispatch Brief
// template's Tests: field, and the review step's close-gate reference),
// one in brainstorming's Tests:-line paragraph, and one in README's payload
// map. None of the five sits inside the doctrine's two parity copies, so
// none of the pins above sees a symmetric deletion here: a fold that removed
// any one clause would pass every other test in this file while leaving
// that surface silent again, which is the same drift-by-duplication this
// whole section exists to remove. Each is matched on the clause's own
// distinguishing phrase, never on the bare string "testing-discipline",
// which a later unrelated mention would also satisfy. Whitespace is
// collapsed before matching because three of the five clauses wrap across
// lines in their source file (a fenced template, a long paragraph), so a
// reflow that keeps the words would still pass this.
function collapseWhitespace(text) {
    return text.replace(/\s+/g, ' ');
}

test('the five Section 3 pointers to testing-discipline are still present', () => {
    const executingWork = collapseWhitespace(fs.readFileSync(path.join(__dirname,
        '..', 'plugins', 'claude-kit', 'skills', 'executing-work', 'SKILL.md'), 'utf8'));
    const brainstormingBody = collapseWhitespace(fs.readFileSync(path.join(__dirname,
        '..', 'plugins', 'claude-kit', 'skills', 'brainstorming', 'SKILL.md'), 'utf8'));

    assert.ok(executingWork.includes('Settle the test question per '
        + '`skills/testing-discipline/SKILL.md` under the kit plugin root, '
        + 'whose litmus decides what earns a durable test'),
        'executing-work\'s step 2 no longer points the settle-the-test-question '
        + 'duty at the testing-discipline skill\'s litmus, so a reader is left '
        + 'with the paragraph\'s own words and no way to reach the four classes '
        + 'that actually earn a test');

    assert.ok(executingWork.includes('else the test-worthiness call per the '
        + 'testing-discipline skill\'s litmus, its absolute path resolved by '
        + 'the same ladder as the Style-skill file paths bullet below'),
        'the Dispatch Brief template\'s Tests: field no longer points the '
        + 'test-worthiness call at the testing-discipline skill\'s litmus, or '
        + 'dropped the resolved-path qualifier a dispatched agent needs since '
        + 'it inherits no skills and cannot follow a bare relative path');

    assert.ok(executingWork.includes('ahead of the slow suites the close gate '
        + 'runs (timing owned by the operating doctrine\'s gate bullet)'),
        'step 3\'s review dispatch no longer points at the operating '
        + 'doctrine\'s gate bullet for when the close gate runs, which is the '
        + 'single owner of that moment since Section 2 amended it');

    assert.ok(brainstormingBody.includes('the behaviors that earn one per the '
        + 'testing-discipline skill\'s litmus '
        + '(`skills/testing-discipline/SKILL.md` under the kit plugin root)'),
        'the brainstorming skill\'s Tests:-line paragraph no longer points '
        + 'what a Tests: line names at the testing-discipline skill\'s litmus');

    const readme = fs.readFileSync(path.join(__dirname, '..', 'README.md'), 'utf8');
    const mapLine = readme.split(/\r?\n/).find((l) => /^\s*testing-discipline\//.test(l));
    assert.ok(mapLine, 'README\'s payload map no longer carries a '
        + 'testing-discipline/ entry');
    for (const phrase of ['Litmus for what earns a test', 'priced at authoring',
        'gate\'s lanes', 'red protocol', 'contention rule']) {
        assert.ok(mapLine.includes(phrase), 'README\'s testing-discipline/ map '
            + 'entry no longer mentions "' + phrase + '", one of the things it '
            + 'promises the skill owns');
    }
});

// The adversarial reviewer's Tests bullet is the same drift class one surface
// later: that charter adjudicates every future section review, so a litmus
// restated there outlives every deletion the Section 3 fold performed. Both
// halves are pinned: the bullet still routes to the testing-discipline skill's
// litmus, and the three-instance list the fold deleted has not resurfaced,
// because a pointer bolted onto a surviving restatement presents two
// authorities and the reader takes the nearest list.
test('the adversarial reviewer judges test-worthiness by the testing-discipline litmus, not a local list', () => {
    const charter = collapseWhitespace(fs.readFileSync(path.join(__dirname, '..',
        'plugins', 'claude-kit', 'agents', 'adversarial-reviewer.md'), 'utf8'));
    assert.ok(charter.includes('testing-discipline skill\'s litmus'),
        'the adversarial reviewer\'s Tests bullet no longer routes '
        + 'test-worthiness to the testing-discipline skill\'s litmus, so the '
        + 'agent adjudicating every section review is back to its own words');
    assert.ok(!charter.includes('(a business rule, an edge case, a bug fix)'),
        'the three-instance test-worthiness list has resurfaced in the '
        + 'adversarial reviewer\'s charter; the litmus lives in the '
        + 'testing-discipline skill, and a local restatement is what drifts');
});

// The targeted-lane definition and the contention-lane schedule are stated in
// full in both the doctrine's gate bullet and the testing-discipline skill, on
// purpose: the duplication was adjudicated for doctrine-only-reader
// visibility. What duplication costs is drift (the box-check pair had exactly
// that, the skill's copy dropping the running-engine case), so the shared text
// is pinned here at the phrases that do the work: the targeted lane's
// definition, the contention lane's schedule, and the schedule's
// touched-delta condition.
test('the lane text agrees between the doctrine gate bullet and the testing-discipline skill', () => {
    const testingSkill = fs.readFileSync(path.join(__dirname, '..', 'plugins',
        'claude-kit', 'skills', 'testing-discipline', 'SKILL.md'), 'utf8');
    const copies = [
        ['the skill-body doctrine copy', skillBody()],
        ['the doctrine mirror', mirrorBody()],
        ['the testing-discipline skill', testingSkill],
    ];
    for (const [phrase, what] of [
        ['the changed files\' tests plus any whole-tree pin whose subject those files are',
            'the targeted lane\'s definition'],
        ['at finishing, before a push, and at section close whenever',
            'the contention lane\'s schedule'],
        ['section\'s delta touched',
            'the schedule\'s touched-delta condition'],
    ]) {
        for (const [label, body] of copies) {
            assert.ok(body.includes(phrase), label + ' no longer carries ' + what
                + ' ("' + phrase + '"); the lane text is deliberately stated in '
                + 'full on both surfaces, so the copies must keep saying the '
                + 'same thing');
        }
    }
});
