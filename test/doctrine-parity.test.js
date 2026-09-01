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
// The Gate duty is stated in the doctrine and discharged in the Chapter
// template, two surfaces that were pinned by two independently hand-copied
// literals linked by no shared phrase, so a reword of either left them stating
// different requirements with both assertions green. This is the one phrase
// both surfaces must word alike, and both pins below read it from here: the
// doctrine's requirement is this string in its own sentence, and the template
// asks the writer for the same thing in the same words.
const exitCodeDuty = 'the exit code read from the run itself';

// The plural is the second phrase both surfaces must word alike, for the same
// reason the exit-code duty is: a section close can run the contention lane
// beside the targeted one, so a surface admitting one lane and a surface
// admitting several state different requirements while both read as coverage.
const lanePluralDuty = 'the lane or lanes';

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
        assert.ok(lines[0].includes(lanePluralDuty + ' that gated it with their '
            + 'counts and ' + exitCodeDuty),
            'the chapter-close bullet in the ' + label + ' must require the '
            + 'Chapter to name every lane that gated the section. Section close '
            + 'runs the targeted lane, with the contention lane beside it where '
            + 'the delta touched machine-shared state, so a Chapter that reports '
            + 'a bare green, or one lane where two ran, says nothing about how '
            + 'much of the tree that green covered, which is what a later '
            + 'collateral-red diagnosis reads');
    }
});

// The gate bullet is the third surface stating the section-close lane duty,
// and it was the one surface no pin read, which is how it kept the singular
// while the chapter-close bullet and the Chapter template both moved to the
// plural. A section close runs the targeted lane, with the contention lane
// beside it where the delta touched machine-shared state, so a bullet
// admitting one lane asks for less than the two surfaces that discharge it.
test('the gate bullet admits every lane a section close runs, in each copy', () => {
    const lead = '- **After each step, run the lane the moment calls for, and report the delta.**';
    for (const [label, body] of [['skill body', skillBody()], ['doctrine mirror', mirrorBody()]]) {
        const lines = body.split(/\r?\n/).filter((l) => l.startsWith(lead));
        assert.strictEqual(lines.length, 1,
            'expected exactly one gate bullet in the ' + label);
        assert.ok(lines[0].includes('names ' + lanePluralDuty + ' that ran'),
            'the gate bullet in the ' + label + ' no longer admits more than '
            + 'one lane at a section close, while the chapter-close bullet and '
            + 'the Chapter template both do, so the three surfaces state '
            + 'different requirements and a Chapter naming both lanes '
            + 'over-reports against this bullet while one naming a single lane '
            + 'under-reports against the other two');
    }
});

// The duty above is stated in the doctrine and discharged in the Chapter
// template, which is the field list an executing session actually fills. A
// template missing the field yields Chapters that satisfy the template and
// violate the doctrine, and nothing else in this file reads the template. The
// match is anchored to a line-leading field name so a passing mention of the
// word gate elsewhere in the skill cannot stand in for the template slot.
test('the Chapter template carries the gate field the doctrine requires', () => {
    const executingWork = fs.readFileSync(path.join(__dirname, '..', 'plugins',
        'claude-kit', 'skills', 'executing-work', 'SKILL.md'), 'utf8');
    const field = executingWork.split(/\r?\n/).find((l) => l.startsWith('Gate: <'));
    assert.ok(field, 'the Chapter template in executing-work no longer carries '
        + 'a Gate field, so a Chapter written from it records no lane and the '
        + 'chapter-close bullet\'s requirement has no carrier at the point of '
        + 'writing');
    assert.ok(field.includes(lanePluralDuty + ' that ran'),
        'the Chapter template\'s Gate field no longer admits more than one '
        + 'lane, while the contention lane runs beside the targeted one at a '
        + 'section close whose delta touched machine-shared state, so a '
        + 'Chapter filled from it reports one of the two runs and reads as '
        + 'though the other never happened');
    assert.ok(field.includes(exitCodeDuty),
        'the Chapter template\'s Gate field no longer asks for ' + exitCodeDuty
        + ', the phrase the doctrine\'s chapter-close bullet states the duty '
        + 'in. The two surfaces are pinned on this one shared string so a '
        + 'reword of either reddens rather than leaving them asking for '
        + 'different things');
    assert.ok(field.includes('the code itself rather than a statement that it '
        + 'was read'),
        'the Chapter template\'s Gate field asks for an attestation rather '
        + 'than a value, so a Chapter filled from it records no exit code and '
        + 'the doctrine\'s requirement goes undischarged by its only carrier');
});

// The close gate's place in the section loop is a cross-step invariant inside
// one file, and nothing else pins it. Step 2 runs its targeted lane, step 3
// dispatches the reviewers over the state that run verified, step 4 lands
// their fixes and runs the close gate,
// and step 4's fold predicate spends that gate ("the gate you are about to run
// covers it"). A rewrite that moves the gate back beside the review round
// reads fine in isolation while leaving every review fix and every folded
// surface outside the only gate the section runs, and the fold predicate with
// no gate left that could satisfy it.
test('executing-work runs the section close gate after the review fixes', () => {
    const executingWork = fs.readFileSync(path.join(__dirname, '..', 'plugins',
        'claude-kit', 'skills', 'executing-work', 'SKILL.md'), 'utf8');
    assert.ok(executingWork.includes('**This step runs the section\'s close '
        + 'gate, once the fixes and the folds are in.**'),
        'executing-work step 4 no longer names itself as the step that runs '
        + 'the section\'s close gate, so the loop schedules that gate nowhere '
        + 'and the section closes on step 2\'s pre-review run');
    assert.ok(executingWork.includes('That run is what the fold predicate '
        + 'below means by the gate you are about to run'),
        'step 4 no longer ties its close gate to the fold predicate that '
        + 'spends it, so "the gate you are about to run" has no antecedent in '
        + 'the step that states it');
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
// moments (the targeted lane after a fix and at section close, the whole gate
// at finishing before the plan's handoff, at an install-surface push, and
// after a merge) and carries none of the lane mechanics itself, so the pointer
// is the only path from the always-loaded layer to them.
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
    // the whole-gate moments a plan hands off, a push lands on the surface its
    // consumers install from, or a finishing pass runs on a lane too narrow to
    // support the claim it makes.
    for (const [phrase, why] of [
        [/targeted lane/, 'name the targeted lane, which a fix round and a '
            + 'section close alike take'],
        [/take the targeted lane, whatever the delta touched/,
            'state the invariant that a section close and a fix round alike '
            + 'take the targeted lane whatever their delta touched, which is '
            + 'the whole of what keeps those two moments off the whole gate'],
        [/at section close whenever the section's delta touched/,
            'name section close as the contention lane\'s own moment, run '
            + 'there whenever the section\'s delta touched machine-shared '
            + 'state'],
        [/at finishing/, 'name finishing, which is one half of the whole-gate '
            + 'moment the handoff phrase below names: this half says where '
            + 'that gate runs'],
        [/before the plan's handoff/,
            'name the plan\'s handoff, the other half of that same moment, '
            + 'which says what the gate is for. Finishing and the handoff are '
            + 'one moment rather than two, and it is the one that reads the '
            + 'whole tree on every plan whatever its trunk'],
        [/before a push/, 'name a push as a whole-gate moment, bounded by the '
            + 'install-surface condition'],
        [/only where that push lands on a trunk consumers install from directly with no CI gating the merge/,
            'state the install-surface condition that bounds the pre-push whole '
            + 'gate, without which every push is priced at the whole gate again'],
        [/merge takes the whole gate/,
            'name a merge as a whole-gate moment, since the redness a clean '
            + 'merge produces sits in files neither parent changed and the '
            + 'bullet\'s closing default would otherwise price a merge at a '
            + 'lane derived from its own diff, which cannot read that redness'],
    ]) {
        assert.match(inSkill[0], phrase, 'the gate bullet must ' + why
            + '; the pointer does not carry the moments, so a reader who never '
            + 'opens the skill has only this bullet to run a gate from');
    }
    // The pins above are presence-only, and a bullet that carries both cadences
    // at once satisfies every one of them: re-adding a section-close whole gate
    // or the shared-module condition beside the sentences that replaced them
    // reads as green while the always-loaded layer names two lanes for one
    // moment, and a reader takes the wider. The two moments therefore carry
    // absence assertions as well, since their removal is the change itself.
    for (const [phrase, why] of [
        [/whole gate at section close/i,
            'section close is a targeted-lane moment, so a bullet naming it as '
            + 'a whole-gate moment prices every section close at a full suite '
            + 'again'],
        [/shared module/,
            'a fix round takes the targeted lane whatever its delta touched, so '
            + 'a shared-module condition on the bullet reinstates the clause '
            + 'that fires on essentially every fix round in a repo with widely '
            + 'imported modules'],
    ]) {
        assert.doesNotMatch(inSkill[0], phrase, 'the gate bullet states a lane '
            + 'the cadence does not have: ' + why);
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

    // The instrument limit itself, which the substrings above cannot reach:
    // a surface can carry the engine-agnostic class in full and still
    // present the poll as the whole check, which is the divergence that
    // leaves one copy calling sufficient what the other calls insufficient.
    // The two carriers word the limit in their own registers, so each leg is
    // pinned on the shape both hold rather than on a literal one of them
    // happens to use, and every leg carries its own negating token: a
    // pattern matching `a sample and therefore a clearance`, or matching the
    // fan-out noun in a sentence saying the poll sees it, goes quiet on the
    // one rewrite that inverts the rule it is pinning. The spellings differ
    // per file, so the neighbour leg accepts both rather than forcing one
    // carrier onto the other's house spelling. The role skill states the
    // same blind spots and is deliberately not a third carrier here: it
    // words the limit as a property of the claim protocol rather than of a
    // pre-suite check, so it shares the fan-out leg and neither of the other
    // two, and its own pins sit below.
    for (const [label, pattern] of [
        ['the poll is a sample rather than a clearance',
            /poll is a sample[^.]*(rather than|never|not) a clearance/],
        ['a poll cannot see in-process agent fan-out',
            /cannot see in-process agent fan-out/],
        ['a poll cannot see a neighbour that starts after the sample',
            /cannot see a neighbou?r that starts after the sample and before/],
        ['a clean read licenses a spawn only alongside the claim protocol',
            /licenses a spawn only alongside the claim protocol/],
    ]) {
        assert.match(inSkill[0], pattern,
            'the doctrine box-check bullet no longer states that ' + label
            + ', so a session that loads only the doctrine performs exactly '
            + 'the check the skill calls insufficient');
        assert.match(inTesting[0], pattern,
            'the testing-discipline skill\'s box check no longer states that '
            + label + ', while the doctrine\'s copy of the same rule does');
    }

    // The cost asymmetry is the doctrine's alone and cannot ride the loop
    // above, which can only pin what both carriers already share. It is the
    // leg that says what to do with each reading, so a bullet that lost it
    // would state the limit and leave a reader to price it, and the two
    // readings price out in opposite directions: waiting on residue costs
    // bounded minutes, where starting into work the poll could not see costs
    // an unbounded collision. The role skill owns the line and the doctrine
    // states it here because the doctrine is the surface a session has
    // loaded when it decides whether to start.
    assert.match(inSkill[0], /drawn on cost rather than on evidence/,
        'the box-check bullet no longer prices its two readings against each '
        + 'other, so a clean poll reads as evidence for starting rather than '
        + 'as the sample the sentence before it says it is');
    assert.match(inSkill[0], /never a basis for starting/,
        'the box-check bullet no longer states that a clean read is never a '
        + 'basis for starting, which is the half the role skill calls '
        + 'unbounded in cost and the half a reader in a hurry drops first');
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

// The far end of the box-check bullet's claim-protocol pointer, pinned on the
// one leg the role skill's other far-end pins below do not take: the near end
// still naming this target. What the target carries, and that it sits in the
// index, are pinned once below rather than restated here, so a reworded
// sentence has one site to move and the index coverage for this path does not
// hang on a prose pointer surviving.
test('the box-check bullet\'s claim-protocol pointer resolves and is tracked', () => {
    const lead = '- **One heavy process at a time is a per-machine budget';
    const bullets = skillBody().split('\n').filter((l) => l.startsWith(lead));
    assert.strictEqual(bullets.length, 1,
        'expected exactly one box-check bullet to read the pointer from');
    assert.ok(bullets[0].includes('`skills/role/SKILL.md` under the kit plugin root'),
        'the box-check bullet no longer points at the role skill for the claim '
        + 'protocol, so either it restates the protocol it is supposed to defer '
        + 'or it defers to nothing');
    const parts = ['plugins', 'claude-kit', 'skills', 'role', 'SKILL.md'];
    assert.ok(fs.existsSync(path.join(__dirname, '..', ...parts)),
        'the box-check bullet routes its claim protocol to a skill that is not '
        + 'on disk: ' + parts.join('/'));
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
            + '", one of the functions it promises the skill carries');
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

    // README's map line promises named functions, not the heading's count, so
    // each promised function's own lead is pinned instead of the heading. The
    // count itself, stated closed at four with kaizen the fourth, is pinned by
    // the four-functions test below, which is what reddens a surface left
    // stating the retired closed-at-three set.
    for (const lead of ['- **Operator interface.**',
        '- **Cross-repo dependency and portfolio sequencing.**',
        '- **Machine-resource arbitration.**']) {
        assert.ok(body.includes(lead),
            'README\'s payload map promises the coordinator\'s functions '
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
    // cold-start opening above the "## The four functions" heading. No other
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

// One number on two surfaces. The coordinator skill's banked-pass paragraph
// rests its coverage argument on an equality: the role-boundary marker's age
// bound is the seat's own reconciliation cadence, so a marker opened at the end
// of one pass is still live when the paced wake fires. The bound lives in code
// as ROLE_BOUNDARY_MAX_AGE_MS; the cadence lives in that skill's prose as a
// figure. Nothing else reads the two together, so shortening the constant would
// leave the skill arguing coverage it no longer has, silently and with the
// suite green. The assertion above pins the prose figure at a literal 4 for the
// status round's own pricing; this one pins the same figure against the
// constant, which is what reddens when the constant moves.
test('the coordinator\'s stated cadence is the role-boundary marker\'s own age bound', () => {
    const { ROLE_BOUNDARY_MAX_AGE_MS } = require(path.join(__dirname, '..',
        'plugins', 'claude-kit', 'hooks', 'kit-compact-lib.js'));
    const hours = ROLE_BOUNDARY_MAX_AGE_MS / (60 * 60 * 1000);
    assert.ok(Number.isInteger(hours) && hours > 0,
        'the role-boundary marker\'s age bound is no longer a whole number of '
        + 'hours, so the coordinator skill cannot state it as one: give the '
        + 'skill\'s cadence a spelling that matches and pin that spelling here');
    const body = fs.readFileSync(path.join(__dirname, '..', 'plugins',
        'claude-kit', 'skills', 'coordinator', 'SKILL.md'), 'utf8');
    assert.match(body,
        new RegExp('reconciliation timer[^\\n]{0,60}every ' + hours + ' hours', 'i'),
        'the coordinator skill\'s banked-pass paragraph argues that a marker '
        + 'opened at the end of one pass is still live when the next paced wake '
        + 'fires, which holds only while the seat\'s reconciliation cadence and '
        + 'the role-boundary marker\'s age bound (ROLE_BOUNDARY_MAX_AGE_MS, '
        + hours + ' hours) are the same figure; the skill no longer states that '
        + 'cadence as every ' + hours + ' hours');
});

// The coordinator's function count is a counted claim stated on two surfaces
// of its own file, the enumeration heading and the closed-set sentence, and
// restated on four sibling surfaces: one peer-sessions clause, README's
// payload map, docs/README.md's architecture summary, and
// docs/architecture.md's runbook overview. A count restated on a sibling
// surface is an invariant nothing checks, which git merges clean and no
// diff-reading review catches, so every restating surface is read here (the
// docs/ surfaces are read, never written). The set is closed at four, kaizen
// the fourth, so the count surfaces are pinned at four, the kaizen bullet is
// pinned on its own load-bearing words, and the retired count is pinned
// absent, scoped to the coordinator-count spellings rather than the bare
// word "three", which the warranted-channels list carries legitimately.
test('the coordinator holds four functions, kaizen among them, and no surface still states three', () => {
    const body = fs.readFileSync(path.join(__dirname, '..', 'plugins',
        'claude-kit', 'skills', 'coordinator', 'SKILL.md'), 'utf8');
    assert.ok(body.includes('## The four functions'),
        'the coordinator skill\'s enumeration heading no longer states the set '
        + 'at four; the heading and the closed-set sentence are two surfaces '
        + 'of one count and must move together');
    assert.ok(body.includes('The seat holds four functions, and the set is closed at four.'),
        'the coordinator skill\'s closed-set sentence no longer states four; '
        + 'the heading and this sentence are two surfaces of one count and '
        + 'must move together');
    const kaizenLines = body.split(/\r?\n/).filter((l) => l.startsWith('- **Kaizen.**'));
    assert.strictEqual(kaizenLines.length, 1,
        'expected exactly one Kaizen function bullet in the coordinator skill; '
        + 'the fourth function is kaizen capture, dispositioning, and dispatch');
    assert.ok(kaizenLines[0].includes('dispositioning')
        && kaizenLines[0].includes('standing authority'),
        'the coordinator\'s Kaizen bullet no longer carries dispositioning '
        + 'under the operator\'s standing authority, which is the substance '
        + 'that separates the seat\'s function from the capture-and-route duty '
        + 'every other seat holds');
    for (const retired of ['## The three functions',
        'The seat holds three functions', 'the set is closed at three']) {
        assert.ok(!body.includes(retired),
            'the coordinator skill still carries the retired count spelling "'
            + retired + '" while the set is closed at four');
    }
    const peerSessions = fs.readFileSync(path.join(__dirname, '..', 'plugins',
        'claude-kit', 'skills', 'peer-sessions', 'SKILL.md'), 'utf8');
    assert.ok(!/coordinator's three/.test(peerSessions),
        'peer-sessions still restates the coordinator\'s function count as '
        + 'three; the count is single-sourced in the coordinator skill, and a '
        + 'sibling surface names no number, so a future count change cannot '
        + 'strand one');

    // The sibling restatements outside the plugin payload. README's payload
    // map enumerates the functions rather than counting them, so its pin is
    // that kaizen stays in the enumeration; the two docs surfaces state the
    // closed count outright, so each is pinned on its own count-plus-kaizen
    // spelling, and the retired three-count spellings are pinned absent on
    // all three.
    const readme = fs.readFileSync(path.join(__dirname, '..', 'README.md'), 'utf8');
    const mapLine = readme.split(/\r?\n/).find((l) => /^\s*coordinator\//.test(l));
    assert.ok(mapLine, 'README\'s payload map no longer carries a coordinator/ '
        + 'entry; this test reads that line as a count-restating surface');
    assert.ok(mapLine.toLowerCase().includes('kaizen'),
        'README\'s coordinator/ map entry no longer names kaizen among the '
        + 'seat\'s functions, so the map enumerates the retired three-function '
        + 'set while the skill holds four');
    const docsReadme = fs.readFileSync(path.join(__dirname, '..', 'docs',
        'README.md'), 'utf8');
    assert.match(docsReadme, /four closed functions[^.]{0,80}kaizen/i,
        'docs/README.md no longer states the coordinator seat\'s four closed '
        + 'functions with kaizen among them; it is a count-restating surface '
        + 'and must move with the coordinator skill\'s own count');
    const architecture = fs.readFileSync(path.join(__dirname, '..', 'docs',
        'architecture.md'), 'utf8');
    assert.match(architecture, /functions are closed at four[^.]{0,200}kaizen/i,
        'docs/architecture.md no longer states the coordinator\'s functions '
        + 'closed at four with kaizen in the enumeration; it is a '
        + 'count-restating surface and must move with the skill\'s own count');
    for (const [label, sibling] of [['README.md', readme],
        ['docs/README.md', docsReadme], ['docs/architecture.md', architecture]]) {
        // The banned spellings are read against this pin's own subject rather
        // than against the file: "three functions" is a phrase another
        // subject may legitimately take, and a bare substring test would
        // redden on a sentence that has nothing to do with the seat. An
        // occurrence counts only where the coordinator is named inside the
        // window around it, which is the count this pin is about.
        const lower = sibling.toLowerCase();
        for (const retired of ['three closed functions', 'closed at three',
            "coordinator's three", 'three functions']) {
            for (let at = lower.indexOf(retired); at !== -1;
                at = lower.indexOf(retired, at + 1)) {
                const window = lower.slice(Math.max(0, at - 200),
                    at + retired.length + 200);
                assert.ok(!window.includes('coordinator'),
                    label + ' still states the coordinator count with the '
                    + 'retired spelling "' + retired + '" while the set is '
                    + 'closed at four');
            }
        }
    }
});

// README's payload map and two peer-sessions clauses point at the role skill:
// the map entry promises the takeover ritual, the directory contract, the
// claim, and the standing delegation, and the peer-sessions Roles section
// names the role skill as the coordinator-directory contract's owner and the
// standing-delegation model's owner. Asserting only the far end would stay
// green after the pointers were deleted, so the near ends are pinned first,
// on the words each pointer promises rather than the whole line, since
// column alignment and sentence order are cosmetic and a reflow should not
// redden the suite. The far end then pins the skill on disk carrying what
// the pointers promise: the registry entry's own field lines, in the
// contract's order, rather than a heading, because a heading survives while
// the shape under it is renamed; the directory contract's four file forms
// and its single-writer rule; and the delegation model's own load-bearing
// phrases. The index-tracking assertion is taken here, once for this path,
// because this pin reaches the file through its own path constant rather
// than through a prose pointer: a target present in a worktree but never
// added passes on the machine that wrote it and resolves to nothing on a
// fresh install, and that coverage should not end because some bullet
// elsewhere was reworded.
test('the role skill is pointed at by README and peer-sessions and carries what the pointers promise', () => {
    const readme = fs.readFileSync(path.join(__dirname, '..', 'README.md'), 'utf8');
    const mapLine = readme.split(/\r?\n/).find((l) => /^\s*role\//.test(l));
    assert.ok(mapLine, 'README\'s payload map no longer carries a role/ '
        + 'entry; this pin reads that line as its near end');
    for (const word of ['takeover', 'directory contract', 'claim',
        'standing delegation']) {
        assert.ok(mapLine.toLowerCase().includes(word),
            'README\'s role/ map entry no longer mentions "' + word
            + '", one of the things it promises the skill owns');
    }

    const peerSessions = fs.readFileSync(path.join(__dirname, '..', 'plugins',
        'claude-kit', 'skills', 'peer-sessions', 'SKILL.md'), 'utf8');
    assert.match(peerSessions, /the role skill owns the coordinator-directory contract/,
        'peer-sessions\' Roles section no longer names the role skill as the '
        + 'coordinator-directory contract\'s owner; the role skill is that '
        + 'contract\'s single owner and this clause is the pointer that keeps '
        + 'peer-sessions from restating it');
    assert.match(peerSessions, /owns the standing-delegation model/,
        'peer-sessions\' Roles section no longer names the role skill as the '
        + 'standing-delegation model\'s owner, so the seats\' one pointer to '
        + 'the delegation model is gone and a seat reading this file cannot '
        + 'reach it');

    const parts = ['plugins', 'claude-kit', 'skills', 'role', 'SKILL.md'];
    const target = path.join(__dirname, '..', ...parts);
    assert.ok(fs.existsSync(target),
        'README\'s payload map and the peer-sessions Roles section both '
        + 'point at a role skill that is not on disk: ' + parts.join('/'));
    const body = fs.readFileSync(target, 'utf8');

    // The directory contract the pointers promise: the four file forms, each
    // matched on its own name rather than a section heading.
    for (const promised of ['board.md', 'registry/<session-id>.md',
        'claims/heavy-process.md', 'admin-requests.md']) {
        assert.ok(body.includes(promised),
            'the role skill no longer carries "' + promised + '", which the '
            + 'coordinator-directory contract it owns has to name');
    }

    // The writer contract, pinned on its rule sentence's own lead rather than
    // on the bare token "single-writer": other sentences in the file carry
    // that token (the rule's board-and-registry half, the guard-exemption
    // paragraph), so a whole-body includes on the token stays green off a
    // residual mention after the contract's actual rule sentence is deleted.
    // Both halves are pinned, because the rule is per file and a rewrite that
    // keeps one half has silently re-imposed one rule on all four forms.
    assert.ok(body.includes('The writer rule is per file'),
        'the role skill no longer opens the per-file writer contract with its '
        + 'rule sentence; the board/registry and claim/inbox halves have no '
        + 'home without it');
    assert.ok(body.includes('multi-writer by design'),
        'the role skill no longer states that the claim file and the inbox '
        + 'are multi-writer by design, so the contract reads as one '
        + 'single-writer rule over forms that mechanically cannot obey it');

    // The registry entry shape: every field line, in the contract's order.
    // Matched as line leads so the fenced block's own lines are what is
    // pinned, and matched in order so a reordering reddens rather than
    // passing on bare presence.
    const bodyLines = body.split(/\r?\n/);
    let lastIdx = -1;
    for (const field of ['Name:', 'Role:', 'Repo:', 'Workdir:', 'Session:',
        'Started:', 'Status-updated:', 'Remaining:', 'Heartbeat:', 'Banked:',
        'Status:']) {
        const idx = bodyLines.findIndex((l, i) => i > lastIdx && l.startsWith(field));
        assert.ok(idx !== -1,
            'the role skill\'s registry entry shape no longer carries the '
            + 'field "' + field + '" after its predecessor, so the shape has '
            + 'dropped a field or reordered the contract');
        lastIdx = idx;
    }

    // The standing-delegation model, pinned on its own load-bearing phrases
    // rather than its heading: the chain, and the model-versus-grant line
    // that keeps a public skill from carrying an operator grant.
    assert.match(body, /Coordinator to Expert to Worker/,
        'the role skill no longer states the delegation chain, Coordinator '
        + 'to Expert to Worker, which is the model\'s spine');
    assert.match(body, /defines the delegation model and never the grant/,
        'the role skill no longer separates the delegation model from the '
        + 'grant; the skill body ships to every machine, so carrying the '
        + 'grant would turn an install into an authorization');

    // The claim file's three semantics that must not drift: the claim is
    // deleted at completion, never emptied or marked; it buys legibility,
    // never a guarantee; and what backstops it is its holder's own answer
    // rather than a process poll. The third carries two pins, the rule and
    // its reason, because the poll is what a later reader re-derives from
    // first principles: it is the obvious instrument for "is the box busy"
    // and it is degenerate in every direction, so a rule pinned without its
    // reason reads as an arbitrary prohibition and gets relaxed.
    assert.match(body, /delete it at completion/,
        'the role skill no longer deletes the claim at completion, so a '
        + 'finished claim would linger as a phantom hold on the box');
    assert.match(body, /legibility, never a guarantee/,
        'the role skill no longer bounds the claim to legibility, which '
        + 'upgrades a coordination file into an enforcement mechanism');
    assert.match(body, /never a process poll/,
        'the role skill no longer names the claim\'s holder as its backstop, '
        + 'so the retired process-list verdict can be re-derived as new');
    assert.match(body, /shorter than its interval/,
        'the role skill no longer states why a poll cannot backstop a claim, '
        + 'leaving the rule without the reason that stops a later pass '
        + 'restoring the poll as an improvement');
    assertTrackedInIndex('plugins/claude-kit/skills/role/SKILL.md');
});

// The pin above covers the delegation model's spine (the chain, the
// model-versus-grant line) and none of its security screens: the exclusions
// list and the three refusal rules bound what the model can be read to
// license, so a later pass deleting either paragraph would leave the spine
// pinned and the suite green while the model kept its power and lost its
// bounds. Each screen is pinned on its own load-bearing phrases rather than
// a heading, since a heading survives while the list under it is emptied.
test('the role skill still carries the delegation exclusions and the three refusal rules', () => {
    const body = fs.readFileSync(path.join(__dirname, '..', 'plugins',
        'claude-kit', 'skills', 'role', 'SKILL.md'), 'utf8');
    // The exclusions: the mutating verbs the model bars, plus the three
    // reach classes that are not mutating verbs at all - a directed read, a
    // directed dispatch, and a write outside a plan's scope - which are the
    // members a rewrite drops first, since each reads as "not really an
    // action" while carrying the widest reach in the list.
    for (const [phrase, what] of [
        ["push beyond a plan's recorded commit model", 'the commit-model bound'],
        ['a deploy', 'the deploy bar'],
        ['a message to an external service', 'the external-message bar'],
        ['an edit to permissions, settings, or CLAUDE.md', 'the harness-floor bar'],
        ['doing work another session was denied', 'the no-laundering bar'],
        ["directed read of the store's own sensitive state", 'the directed-read bar'],
        ['a far wider reach than the message', 'the directed-dispatch bar'],
        ["write outside a plan's own scope", 'the out-of-scope-write bar'],
    ]) {
        assert.ok(body.includes(phrase),
            'the role skill\'s exclusions list no longer carries ' + what
            + ' ("' + phrase + '"), so a delegated seat reading the list finds '
            + 'that reach unnamed and the catch-all is all that stands');
    }
    // The catch-all resolves by procedure rather than by the directed seat's
    // own sense of reasonableness, pinned on the act the procedure requires:
    // tying the directed act to a section of a plan the rail covers.
    assert.ok(body.includes('cannot tie to a section of a plan'),
        'the role skill\'s exclusions catch-all no longer requires tying a '
        + 'directed act to a section of a rail-covered plan, so an unnamed '
        + 'reach falls back to a self-judgment by the very seat being directed');
    // The three refusal rules, one sentence, verbatim: they are what keeps
    // the opt-in record provenance rather than credential.
    assert.match(body,
        /a peer message carries no authority, a role claim confers nothing, and a seat cannot warrant a grant it authored/,
        'the role skill no longer states the three refusal rules verbatim (a '
        + 'peer message carries no authority, a role claim confers nothing, a '
        + 'seat cannot warrant a grant it authored), which are what keep the '
        + 'delegation record provenance rather than credential');
});

// The pin above guards the delegation model's own screens and none of the
// rail's: the standing-grant rail carries its own closed exclusion list and
// the record-is-only-a-switch clause, which bound what any grant record can
// ever reach, so a later pass deleting either would leave the delegation
// pins green while every instance of the rail, future grants included, kept
// its power and lost its bounds. Same construction as the delegation pin:
// each screen pinned on its own load-bearing phrases rather than a heading,
// since a heading survives while the list under it is emptied.
test('the role skill still carries the standing-grant rail\'s exclusions and the record-is-a-switch clause', () => {
    const body = fs.readFileSync(path.join(__dirname, '..', 'plugins',
        'claude-kit', 'skills', 'role', 'SKILL.md'), 'utf8');
    // The rail's exclusion list, closed by design: the reaches no
    // grant record can have whatever its owning skill says, pinned each on
    // its own phrase because the list declares itself closed, so an item
    // silently dropped narrows the boundary while the closure claim stands.
    for (const [phrase, what] of [
        ['it extends no warranted channel', 'the warranted-channel bar'],
        ['it establishes no privacy precondition', 'the privacy-precondition bar'],
        ['it lifts no harness floor and no no-laundering rule', 'the harness-floor and no-laundering bar'],
        ['it widens no grant past what its owning skill spells out', 'the no-widening bar'],
    ]) {
        assert.ok(body.includes(phrase),
            'the role skill\'s standing-grant rail no longer carries ' + what
            + ' ("' + phrase + '"), so a grant record reaching for it finds '
            + 'the reach unnamed while the list still claims to be closed');
    }
    // The record-is-only-a-switch clause, the rail's core: without it a
    // record's body reads as carrying the grant's scope, which is exactly
    // the unauthenticated-widening the rail exists to refuse.
    assert.match(body, /The record is only ever the switch/,
        'the role skill no longer states that a standing-grant record is '
        + 'only ever the switch, so a record\'s body can be read as carrying '
        + 'the grant\'s scope');
    assert.match(body, /neither widen nor narrow/,
        'the role skill no longer states that a record\'s body can neither '
        + 'widen nor narrow the mechanism, which is the clause that makes '
        + 'the body data rather than authority');
    // The lead-in that scopes the list, pinned on its own because the
    // bars above read identically under a narrower one: re-scoping this
    // sentence to the delegation model alone would confine the closed
    // boundary to a single instance and leave every other grant
    // unbounded, with every phrase above still present and every
    // assertion above still green. The closure sentence rides with it,
    // since a list that stops declaring itself closed is one a later
    // pass may add reaches to.
    for (const [phrase, what] of [
        ['What the rail can never reach, stated as its own exclusion list',
            'the lead-in scoping the exclusion list to the rail rather than to one instance'],
        ['The list is the rail\'s boundary and it is closed by design',
            'the closure sentence that makes the list a boundary rather than examples'],
        ['Three refusal rules bind every instance of the rail',
            'the clause binding the refusal rules to every instance rather than to delegation alone'],
    ]) {
        assert.ok(body.includes(phrase),
            'the role skill\'s standing-grant rail no longer carries '
            + what + ' ("' + phrase + '"), so the screens below it hold '
            + 'for one grant while the rail admits others unbounded');
    }
    // The one-bit clause: where a grant's scope is a single act there is
    // nothing for the body-is-data rule to narrow, so without this the
    // switch and the authorization are the same object and the record's
    // presence is the whole grant.
    assert.match(body, /the record's presence is never by itself the authorization/,
        'the role skill no longer states that a one-bit grant\'s record is '
        + 'never by itself the authorization, so a grant whose scope is a '
        + 'single act is authorized by the existence of its own switch');
});

// The store-push grant's owning contract: the role skill's rail assigns the
// coordinator skill the sanctioned path, its bounds and its verification, and
// fails closed on any of the three going unstated, so the rail's own pins say
// nothing about whether this side of the assignment still stands. What is
// pinned is the exception's scoping sentence and not only the path's words: a
// carve-out re-scoped from the named record to the seat's own judgment would
// leave every phrase of the path, the bounds and the verification in place and
// convert a bounded exception into a general licence to run git in the store.
// The two prohibitions are read as paragraphs rather than as a whole-file
// match, since each paragraph of that skill is one line: a carve-out that
// drifted out of the paragraph holding its prohibition would still satisfy
// every literal below while a seat reading the prohibition never reaches it.
test('the coordinator skill still keys its store-git carve-out on the named grant record', () => {
    const body = fs.readFileSync(path.join(__dirname, '..', 'plugins',
        'claude-kit', 'skills', 'coordinator', 'SKILL.md'), 'utf8');
    const paragraphs = body.split(/\r?\n/);
    const paragraphHolding = (needle, what) => {
        const hits = paragraphs.filter((line) => line.includes(needle));
        assert.equal(hits.length, 1, 'the coordinator skill no longer carries '
            + what + ' in exactly one paragraph ("' + needle + '" matched '
            + hits.length + '), so the prohibition this pin reads has moved '
            + 'or been reworded and the carve-out beside it is unscreened');
        return hits[0];
    };

    // Both prohibitions still read as prohibitions: the carve-out is an
    // exception keyed on a record, so the flat rule has to survive it whole
    // for a seat holding no grant.
    const durability = paragraphHolding(
        'The seat writes the file and runs no git in the store',
        'the durability override\'s no-git rule');
    const boardWrite = paragraphHolding('no staging, no commit, no push',
        'the board-write rule\'s staging, commit and push prohibition');

    // Each prohibition carries the carve-out at its own point of use, keyed
    // on the record the rail names and pointing at the rail for the grant's
    // shape: a carve-out stated once in a distant paragraph is one the seat
    // reading the prohibition never reaches.
    for (const [paragraph, where] of [
        [durability, 'the durability override'],
        [boardWrite, 'the board-write rule'],
    ]) {
        assert.ok(paragraph.includes('memory-store-pushes-need-no-permission'),
            where + ' in the coordinator skill no longer names the record its '
            + 'store-git carve-out is keyed on, so the exception reads as a '
            + 'standing relaxation any seat may take');
        assert.ok(paragraph.includes('standing-grant rail'),
            where + ' in the coordinator skill no longer points at the role '
            + 'skill\'s standing-grant rail, so the grant\'s switch, scoping, '
            + 'provenance and resolution moment are sourced nowhere');
    }

    // The scoping sentences, pinned apart from the path's own words: these
    // are what make the carve-out an exception rather than a relaxation, and
    // what state the ungranted reading that the prohibition still has.
    // Each is read in the paragraph that owns it rather than in the file, on
    // the same reasoning the paragraph slices above carry: a scoping sentence
    // that drifted out of the prohibition it scopes satisfies a whole-file
    // match while the seat reading the prohibition never reaches it.
    for (const [paragraph, phrase, what] of [
        [durability, 'an exception keyed on a named record rather than a relaxation',
            'the durability override\'s scoping sentence'],
        [durability, 'where that record does not resolve the rule above holds whole',
            'the durability override\'s ungranted reading'],
        [boardWrite, 'That is an exception keyed on a record and never a relaxation of this rule',
            'the board-write rule\'s scoping sentence'],
        [boardWrite, 'where the record does not resolve, a pass rewrites the board file and does nothing else with it',
            'the board-write rule\'s ungranted reading'],
    ]) {
        assert.ok(paragraph.includes(phrase), 'the coordinator skill no longer '
            + 'carries ' + what + ' ("' + phrase + '"), so a seat holding no '
            + 'grant reads the carve-out as licence rather than as an '
            + 'exception it does not have');
    }

    // The path, its bounds and its verification: the rail's assignment fails
    // closed on any of the three, so a carve-out that lost one names a path
    // the seat may not run at all while reading as though it were granted.
    for (const [phrase, what] of [
        ['doctor/sync-store.ps1 -StoreRoot <home>/.claude`',
            'the sanctioned invocation spelled whole, the sync script with the '
            + 'root it refuses to default and that the seat may not choose'],
        ['one invocation and never a sequence of git the seat assembles',
            'the path as a single run, which is what keeps the seat out of assembling git of its own'],
        ['no bare-git commit path is on offer', 'the bar on a bare `git add`, which bypasses the leak probes'],
        ['The bounds are that single run', 'the path\'s bounds'],
        ['The verification is two facts and never one', 'the two-fact verification'],
        ['Currency is the third read and it is a diff rather than a lookup',
            'the currency read, which a presence check cannot stand in for'],
    ]) {
        assert.ok(durability.includes(phrase), 'the coordinator skill\'s '
            + 'store-push carve-out no longer states ' + what + ' ("' + phrase
            + '"), which the role skill\'s rail fails closed without');
    }

    // The preconditions the invocation is bounded to, asserted as a set and
    // not only as three items: the sentence scoping them to the unattended
    // caller's own screens, each item, and the sentence closing the set and
    // stating what a seat does where one fails. They are the hook's own
    // screens restated as the carve-out's bounds, which is what a seat can
    // check the invocation against; they are not an equivalence between the
    // two runs, and the carve-out says so, since the hook spawns the script
    // under an environment it strips and the script scrubs nothing itself.
    // A dropped item still widens the grant past the bound this file states:
    // a seat-chosen or environment-overridden root (KIT_MEMORY_ROOT is a
    // supported configuration), a repository the kit does not own, or a
    // platform the script's atomicity reasoning does not cover.
    for (const [phrase, what] of [
        ['they are the hook\'s own rather than this file\'s invention',
            'the sentence scoping the preconditions to the unattended caller\'s '
            + 'own screens rather than to a set this file chose'],
        ['the root is the store root the kit resolves, the default `<home>/.claude`, '
            + 'never a seat-chosen one and never an environment-overridden one',
            'the default-root bound, which is what keeps a seat from pointing the '
            + 'run at a directory the operator merely steered a session to'],
        ['the store carries the kit\'s own ownership marker, the `claudekit.memorysync` '
            + 'local config key',
            'the ownership precondition, the marker the hook reads before it spawns '
            + 'this script at all'],
        ['which is the hook\'s own gate and not one the hand run performs',
            'that the ownership marker is the hook\'s gate rather than a screen the '
            + 'hand run carries, without which a seat reads a guard into a path that '
            + 'does not perform it'],
        ['so this precondition is a bound the seat is held to rather than a screen '
            + 'the hand run performs',
            'that the ownership precondition binds the seat rather than naming a '
            + 'screen the hand run carries, without which a seat reads a guard into '
            + 'a path that does not perform it'],
        ['and the platform is Windows, which is where the unattended runner exists '
            + 'and, on its own account, the only platform the script\'s atomicity '
            + 'reasoning covers',
            'the platform bound and the reason that stands on its own, the script\'s '
            + 'serializing property being argued on NTFS semantics'],
        ['The set is closed at three, and where any of them does not hold the seat '
            + 'runs nothing',
            'the sentence closing the set and stating the refusal, without which a '
            + 'later reader reads three examples rather than a boundary'],
        ['a grant over a PowerShell interpreter authorizes whatever it is pointed at',
            'the bar on asking for an interpreter rule, which no companion deny '
            + 'could carve a single script back out of'],
        ['the lock is taken before the ownership gate is ever reached',
            'the wrong-root residue, a lock written into a directory the run has '
            + 'not yet established is the store'],
    ]) {
        assert.ok(durability.includes(phrase), 'the coordinator skill\'s '
            + 'store-push carve-out no longer states ' + what + ' ("' + phrase
            + '"), so the grant loses a bound this file states and reaches a '
            + 'root, a store, or a platform the carve-out does not cover');
    }

    // The neutrality claim and the residue that qualifies it, pinned together
    // because they are one argument: the grant enlarges nothing measured
    // against what the same seat can already do by hand, which is a documented
    // bare-git pull and push into this same store, and not measured against
    // the hook that spawns this script under a stripped environment. A later
    // editor restoring the equivalence would be restoring a false claim, and
    // one deleting the residue would leave a bound-sounding paragraph that
    // hides what the hand path actually inherits. The scoping sentence of the
    // residue is pinned beside its items, since a residue re-scoped to this
    // grant alone reads as a defect the grant introduced rather than as a
    // property of every hand path into the store, with every item in place.
    for (const [phrase, what] of [
        ['What makes the grant enlarge nothing is the comparison against what the '
            + 'same seat can already do by hand',
            'the baseline the neutrality claim is measured against, the seat\'s own '
            + 'existing reach rather than the best-guarded caller of the script'],
        ['`git -C ~/.claude pull --rebase` and then `git -C ~/.claude push` into '
            + 'this very store, and both the memory-system skill and the '
            + 'finishing-work skill document that pair as the store\'s manual push',
            'the baseline path spelled with the two skills that document it, without '
            + 'which the comparison names no surface a reader can check'],
        ['stating them here holds the hand run to the same three rather than '
            + 'asserting that the two runs are alike, which they are not',
            'the refusal of the equivalence the preconditions would otherwise be '
            + 'read as asserting'],
        ['The residue is a property of every hand path into the store rather than '
            + 'of this grant',
            'the sentence scoping the residue to every hand path, which is what '
            + 'keeps it a property of the store rather than a defect of the grant'],
        ['a run started by hand inherits the invoking session\'s environment whole '
            + 'and carries its `GIT_CONFIG_*`, `GIT_SSH_COMMAND` and '
            + '`GIT_PROXY_COMMAND` into the fetch and the push',
            'the environment residue itself, the half the documented bare-git push '
            + 'shares, which no precondition above screens'],
        ['its `GIT_DIR`, `GIT_COMMON_DIR` and `GIT_WORK_TREE` besides',
            'the residue keys that re-aim the run at another repository, without '
            + 'which the disclosure names only the keys that steer a run already '
            + 'pointed at the store'],
        ['The documented bare-git push shares that half exactly',
            'that the residue is shared with the weaker documented path, without '
            + 'which the disclosure reads as a cost the grant adds'],
        ['`<plugin-root>` in the invocation spelled above resolves from the '
            + 'harness\'s `CLAUDE_PLUGIN_ROOT`, an environment value, so the seat\'s '
            + 'run is pointed by the environment and the hook\'s is not',
            'the script-path residue, the half the documented path does not share, '
            + 'where the hook resolves from its own directory precisely so that '
            + 'nothing the environment carries can steer it'],
        ['Nothing above screens either half, which is why both are stated as '
            + 'residue and not as bounds',
            'the sentence closing the residue against being read as a screen, '
            + 'without which a seat counts it among the preconditions'],
    ]) {
        assert.ok(durability.includes(phrase), 'the coordinator skill\'s '
            + 'store-push carve-out no longer states ' + what + ' ("' + phrase
            + '"), so the grant\'s neutrality is claimed against a baseline the '
            + 'seat\'s own path cannot deliver, or the environment a hand run '
            + 'carries into the fetch and the push goes undisclosed');
    }

    // The one exclusion in the bounds below that a careful reader hits as a
    // contradiction: the bounds bar a read the seat runs for its own purposes
    // while the verification requires two reads only git can answer. The
    // reconciliation is pinned rather than left to the reader, since a seat
    // that resolved it the other way would skip the verification the grant's
    // own terms require.
    assert.ok(durability.includes('The two verification reads below are inside those '
        + 'bounds and are not what that last exclusion bars'),
        'the coordinator skill\'s store-push carve-out no longer reconciles its '
        + 'two verification reads with the exclusion barring a read the seat '
        + 'runs for its own purposes, so the paragraph reads as barring the '
        + 'very reads the grant\'s two-fact verification is made of');

    // The bounds are a closed set, so what is asserted is the set and not
    // only its members: the quantifier that shuts the grant to one path, the
    // sentence that closes the list, and the exclusion list whole. A screen
    // over the items alone is defeated by editing the quantifier, and that
    // edit leaves every item in place: dropping "and only it", or softening
    // "and nothing further", widens a bounded exception into a general licence
    // to run git in the store while every phrase above still reads as though
    // it bounded something.
    // Each literal below spans the junction past the phrase it is named for,
    // because the quantifier is defeated by an insertion as readily as by a
    // deletion: a screen ending exactly where the bounded phrase ends is
    // cleared by a widening clause appended after it ("and no read the seat
    // runs for its own purposes outside the store root"), with every asserted
    // string still in place. So each literal runs to its sentence terminator,
    // or into the literal that follows it, rather than stopping where the
    // bounded phrase does: a pin ending mid-sentence leaves its own far edge
    // as the insertion point, which is the one place a widening clause reads
    // as though it belonged.
    for (const [phrase, what] of [
        ['the sanctioned store path this bullet defines and only it, and where '
            + 'that record does not resolve the rule above holds whole, the seat '
            + 'writing the file and running no git in the store at all.',
            'the quantifier shutting the grant to that one path, joined through '
            + 'its own sentence terminator to the ungranted reading it hands back'],
        ['The bounds are that single run and the verification reads over the '
            + 'change the seat itself made, and nothing further: the carve-out '
            + 'opens no bare-git commit',
            'the sentence closing the bounds against anything the run does not '
            + 'name, joined to the exclusion list it opens'],
        ['no bare-git commit, no history rewrite, no checkout '
            + 'or restore of an earlier version of any file, and no read the seat '
            + 'runs for its own purposes, the fetch inside the run being the '
            + 'push\'s own precondition rather than a licensed look at the store.',
            'the bounds\' exclusion list, asserted whole and through its closing '
            + 'clause to the sentence terminator rather than at one member'],
    ]) {
        assert.ok(durability.includes(phrase), 'the coordinator skill\'s '
            + 'store-push carve-out no longer closes its bounds at ' + what
            + ' ("' + phrase + '"), so a seat reads the sanctioned path as one '
            + 'instance of what the grant permits rather than as the whole of it');
    }

    // The concurrency answer, which is the script's own rather than a rule the
    // seat keeps: the prohibition existed to stop a seat's git racing the
    // sync's fetch and rebase, and what answers it is the lock the sanctioned
    // path sits inside and the mid-operation deferral beside it. The refusal
    // list is pinned at its scoping sentence as well as its members, since a
    // list re-scoped to one operation leaves every member in place.
    for (const [phrase, what] of [
        ['takes `kit-sync.lock` in the store root by an atomic exclusive create '
            + 'and holds it for its whole length',
            'the single-flight lock the run itself takes, which is what serializes '
            + 'a hand run against the background one'],
        ['What a live lock refuses is the second run whole',
            'what a live lock refuses, the whole of the losing run rather than part of it'],
        ['A store mid-operation is refused on the same footing',
            'the sentence scoping the mid-operation refusal to any paused operation '
            + 'rather than to one of them'],
        ['a paused merge, cherry-pick, revert, rebase or `git am`, and any unmerged '
            + 'index entry no marker file names, defer the whole run before anything '
            + 'is staged',
            'the refusal list\'s own members, joined to the deferral they earn: the '
            + 'scoping sentence above says a list exists and says nothing about which '
            + 'operations are in it, so a member dropped from the prose leaves a seat '
            + 'told the store is guarded against a case it is not'],
        ['a live process that started after the lock was written holds a reused pid',
            'the reused-pid staleness, which with the age horizon beside it is how '
            + 'a hand run\'s own lock can be taken while it is still running'],
    ]) {
        assert.ok(durability.includes(phrase), 'the coordinator skill\'s '
            + 'store-push carve-out no longer states ' + what + ' ("' + phrase
            + '"), so a granted seat races the store sync with nothing ordering '
            + 'them or commits over an operation it did not start');
    }

    // Every one of those refusals exits 0 with nothing printed, so the reading
    // is the one failure mode the sanctioned path introduces: a seat that took
    // the exit code for a verdict would report a publication that never
    // happened. What the seat reads instead is pinned at the distinction the
    // script's own code makes, because the two classes of refusal leave the
    // state file differently: the lock refusals touch nothing, while the
    // mid-operation and unproven deferrals write a transient result with a
    // last attempt stamped at the moment they gave up. A pin over the last
    // attempt alone would carry the reading that a fresh stamp means a run
    // happened for this seat, which the shared stamp does not support, so the
    // recorded result is pinned as part of the read and the attribution
    // ceiling with it. The no-upstream case is the last of them, a store that
    // cannot answer the second of the two facts at all and records `ok`
    // anyway.
    for (const [phrase, what] of [
        ['A zero exit is therefore not a verdict',
            'that the exit code is no verdict, which is what a seat would otherwise read as success'],
        ['it reads the recorded result beside the last attempt rather than the attempt alone',
            'the recorded result as part of the read, without which a fresh stamp '
            + 'from a deferral reads as a publication'],
        ['The lock refusals leave it exactly as they found it',
            'the class of refusal that is silent, scoped to the lock refusals rather '
            + 'than asserted of every refusal'],
        ['The mid-operation and unproven deferrals write it, recording a `transient` '
            + 'result with an `unproven` reason and stamping the last attempt at the '
            + 'moment they gave up',
            'the class of refusal that writes, which is the fact a seat reading the '
            + 'attempt time alone would be misled by'],
        ['The stamp attributes to no particular run besides',
            'the attribution ceiling on the stamp, since one file carries one attempt '
            + 'for the whole store and a concurrent run\'s stamp reads as this seat\'s'],
        ['an absent upstream is not a branch level with a remote',
            'the no-upstream case, where the second of the two facts is not there to be read'],
        ['`ok` beside no upstream is a commit and not a publication',
            'the one recorded result that overstates what happened, a commit-only run '
            + 'recording success having pushed nothing'],
    ]) {
        assert.ok(durability.includes(phrase), 'the coordinator skill\'s '
            + 'store-push carve-out no longer states ' + what + ' ("' + phrase
            + '"), so a seat reads a silent run as a publication that landed');
    }

    // The contested-seat anchor reasons from what the seat cannot produce,
    // and the carve-out is what would otherwise contradict it. Read in the
    // paragraph that holds the freeze rather than in the file, on the same
    // reasoning the slices above carry: a reconciliation that drifted out of
    // the freeze paragraph satisfies a whole-file match while the seat
    // reading the freeze never reaches it.
    const contested = paragraphHolding('A contested seat freezes the board',
        'the contested-seat freeze');
    assert.ok(contested.includes('and the store-push carve-out the durability override above states does not change that'),
        'the coordinator skill\'s contested-seat freeze no longer reconciles '
        + 'the store-push carve-out, so it reasons from a seat that runs no '
        + 'git six paragraphs after saying a granted seat may');
});

// The box-budget brief clause in executing-work's Dispatch Brief template is
// a deliberate second copy of the role skill's claim contract: the clause is
// the only copy a dispatched subagent receives, since an agent inherits no
// skills, so the two surfaces can drift while every pin above stays green,
// every claim pin above reading the role skill alone. This pin holds the two
// copies to each other at the phrases that do the work: the claim's field
// set, derived from the shape-bearing sentence on each surface and compared
// as sets rather than listed here, the session-scoped delete, and the poll
// stated as a sample rather than a clearance, with the process list named
// nowhere in the clause, since a process-list verdict in the brief is the
// one instruction that licenses a subagent to start a suite beside a live
// foreign gate. The clause region is sliced by its own landmarks rather
// than matched against the whole file, so role-contract language elsewhere
// in executing-work cannot satisfy a pin about what the brief actually says.
test('the box-budget brief clause agrees with the role skill\'s claim contract and carries no process-list verdict', () => {
    const executingWork = fs.readFileSync(path.join(__dirname, '..', 'plugins',
        'claude-kit', 'skills', 'executing-work', 'SKILL.md'), 'utf8');
    const start = executingWork.indexOf('The standing box-budget clause');
    const end = executingWork.indexOf('The two-question grant audit');
    assert.ok(start !== -1, 'executing-work\'s Dispatch Brief template no '
        + 'longer carries the standing box-budget clause lead, so the brief a '
        + 'heavy-spawning subagent receives has lost the claim protocol');
    assert.ok(end !== -1 && end > start, 'executing-work\'s Dispatch Brief '
        + 'template no longer carries the grant-audit bullet that bounds the '
        + 'box-budget clause, so the slice this pin reads has no far edge');
    const clause = collapseWhitespace(executingWork.slice(start, end));
    const roleBody = collapseWhitespace(fs.readFileSync(path.join(__dirname,
        '..', 'plugins', 'claude-kit', 'skills', 'role', 'SKILL.md'), 'utf8'));

    // The claim's field set, derived from each surface rather than named
    // here: a pin carrying its own list of the fields is a third literal
    // that drifts with neither surface, so a field added to one side alone
    // reads green against it. The derivation reads the shape-bearing
    // sentence on each side, never the whole region, because both regions
    // mention fields incidentally (the probe addresses `Name:`, the delete
    // is scoped by `Session:`): a whole-region read stays green when a
    // field is dropped from the shape sentence but still mentioned
    // elsewhere in the region, and reddens spuriously when a non-shape
    // sentence gains a field mention, both misfires on the one-sided-drift
    // class this comparison exists to catch. Set equality over the two
    // shape sentences catches a one-sided addition, and a one-sided
    // removal by the same comparison. The clause is what the subagent
    // copies into the claim and the role skill is the contract the
    // coordinator probes and releases against, so a field on one side
    // only is a claim the other side cannot parse.
    const roleClaimStart = roleBody.indexOf('## The claim file');
    const roleClaimEnd = roleBody.indexOf('## The takeover ritual');
    assert.ok(roleClaimStart !== -1 && roleClaimEnd > roleClaimStart,
        'the role skill no longer carries a claim-file section between its '
        + 'own headings, so the slice this pin derives the claim fields '
        + 'from has no edges');
    const roleSection = roleBody.slice(roleClaimStart, roleClaimEnd);
    const roleShapeStart = roleSection.indexOf(
        'write `claims/heavy-process.md` carrying');
    const roleShapeEnd = roleSection.indexOf(
        'delete it at completion', roleShapeStart);
    assert.ok(roleShapeStart !== -1 && roleShapeEnd > roleShapeStart,
        'the role skill\'s claim-file section no longer carries its '
        + 'shape-bearing sentence ("write `claims/heavy-process.md` '
        + 'carrying ... delete it at completion"), so the contract side of '
        + 'the field-set comparison has no sentence to derive from');
    const clauseShapeStart = clause.indexOf('write the claim with its');
    const clauseShapeEnd = clause.indexOf(
        'at completion delete only a claim', clauseShapeStart);
    assert.ok(clauseShapeStart !== -1 && clauseShapeEnd > clauseShapeStart,
        'the box-budget brief clause no longer carries its shape-bearing '
        + 'sentence ("write the claim with its ... fields" through the '
        + 'completion delete), so the clause side of the field-set '
        + 'comparison has no sentence to derive from');
    // The token class admits a digit and a lowercase tail after the leading
    // letter, wider than today's field names on purpose: a derivation
    // narrower than the tokens it must see is how a future field such as
    // `Retry2:` goes invisible to BOTH sides at once, a one-sided addition
    // of it then passing green, which is the class this comparison exists
    // to catch.
    const claimFieldSet = (text) => [...new Set(
        text.match(/`[A-Za-z][A-Za-z0-9-]*:`/g) || [])].sort();
    const roleFields = claimFieldSet(
        roleSection.slice(roleShapeStart, roleShapeEnd));
    const clauseFields = claimFieldSet(
        clause.slice(clauseShapeStart, clauseShapeEnd));
    assert.ok(roleFields.length > 0,
        'the role skill\'s shape-bearing sentence names no claim fields at '
        + 'all, so this pin would compare two empty sets and pass on a '
        + 'contract that describes no claim');
    assert.strictEqual(clauseFields.join(', '), roleFields.join(', '),
        'the box-budget brief clause and the role skill\'s claim contract '
        + 'name different claim fields (clause: ' + clauseFields.join(', ')
        + '; contract: ' + roleFields.join(', ') + '), so a subagent briefed '
        + 'from the clause writes a claim the contract does not describe, or '
        + 'omits a field the coordinator needs');
    // The count lives here rather than in either surface's prose: a numeral
    // in the brief clause is a copy nothing checks, staying green while a
    // field lands correctly on both shape sentences and the numeral goes
    // false in the one copy a dispatched agent ever receives. Asserted
    // against the derived set, a shape change reddens this line and forces
    // a deliberate update instead of a silent drift.
    assert.strictEqual(roleFields.length, 5,
        'the claim shape no longer carries exactly five fields (now: '
        + roleFields.join(', ') + '); if the shape grew or shrank on both '
        + 'surfaces deliberately, update this expected count with it');
    // Set equality is blind to a symmetric rename: `Name:` becoming
    // `Address:` on both shape sentences leaves the sets equal and the
    // count at five, so both assertions above stay green, while `Name:` is
    // the address the coordinator's probe uses and the field that makes the
    // release's first leg satisfiable at all. (A symmetric removal is
    // already caught by the count assertion above, which runs first.) Same
    // idiom as the presence pins above: the load-bearing member is asserted
    // by name on each surface beside the whole-set comparison.
    for (const [label, fields] of [['role contract', roleFields],
        ['brief clause', clauseFields]]) {
        assert.ok(fields.includes('`Name:`'),
            'the ' + label + '\'s claim shape no longer names `Name:`, the '
            + 'field that addresses the coordinator\'s probe; without it no '
            + 'probe can be put, the release\'s first leg is never '
            + 'satisfiable, and every claim ends as an untracked hold');
    }

    // The session-scoped delete, on both surfaces, each in its own spelling:
    // the unscoped delete-at-completion is the defect the scoping exists to
    // stop, a finished writer erasing a live foreign claim.
    assert.ok(clause.includes('delete only a claim whose `Session:` line '
        + 'carries that same substituted id'),
        'the box-budget brief clause no longer scopes the completion delete '
        + 'to the substituted session id, so a briefed subagent finishing '
        + 'first erases whatever claim is there, a live foreign one included');
    assert.ok(roleBody.includes('a writer deletes only a claim whose '
        + '`Session:` line is its own'),
        'the role skill no longer scopes the completion delete to the '
        + 'writer\'s own session id while the brief clause still states the '
        + 'session-scoped delete');

    // The contention branch, on both surfaces: naming a contention and
    // proceeding writes no claim. The field-set comparison above is blind to
    // this by construction, comparing what a claim carries and never whether
    // one is written at all, so the two surfaces can agree on the shape while
    // disagreeing on the branch, which is the drift this leg exists for. The
    // clause is the only copy a dispatched subagent receives, so a clause
    // that chains the write onto the contention branch has that subagent
    // overwrite a live holder's claim on the machine's one slot, the failure
    // the contract's own sentence names.
    for (const [label, text] of [['role contract', roleBody],
        ['brief clause', clause]]) {
        assert.ok(text.includes('the contention and proceeding never '
            + 'includes writing the claim'),
            'the ' + label + ' no longer states that naming a contention and '
            + 'proceeding writes no claim, so a session that proceeds under a '
            + 'named contention writes over the live holder\'s claim and the '
            + 'box ends up holding two heavy processes under one claim naming '
            + 'only the second');
    }

    // The poll's standing in the clause: a sample that grounds waiting and
    // never licenses starting or releasing. These two phrases are the
    // anti-verdict statement, and the absence assertion below is its negative
    // half.
    assert.ok(clause.includes('a clean process poll is a sample rather than '
        + 'a clearance'),
        'the box-budget brief clause no longer states the process poll as a '
        + 'sample rather than a clearance, so a clean reading is back to '
        + 'reading as permission');
    assert.ok(clause.includes('absence never licenses starting or releasing'),
        'the box-budget brief clause no longer bars starting or releasing on '
        + 'an absence reading, which is the direction a poll is degenerate in');
    assert.ok(!/process list/i.test(clause),
        'the box-budget brief clause names the process list, which the claim '
        + 'protocol retired as a verdict: the clause instructs on claims and '
        + 'contention naming only, and a process-list instruction in the '
        + 'brief is a poll-as-clearance reading arriving by another name');
});

// The hostile-boundary reuse step in executing-work's Dispatch Brief template
// is a deliberate copy of the guard-siting rule the operating instructions
// state, copied for the reason the box-budget clause above is copied: it is
// the only carrier a dispatched implementer receives, an agent inheriting no
// skills and holding no pointer it could resolve. What a deliberate copy owes
// is a pin, since a divergence survives a parity suite whose assertions never
// touch the diverging text. The two surfaces are held at the proposition
// rather than at a shared string, because they differ in spelling and in
// reach on purpose: the doctrine addresses a session that owns the whole
// tree, while the brief addresses an agent bound to a Files in scope list, so
// the brief carries a scope fallback the doctrine has no reason to state.
// Both halves are asserted, the shared proposition and the divergence,
// because dropping either is how the copy stops being a rule an implementer
// can act on. The clause region is sliced by its own landmarks rather than
// matched against the whole file, so guard language elsewhere in
// executing-work cannot satisfy a pin about what the brief actually says.
test('the hostile-boundary brief clause agrees with the guard-siting rule and carries its scope fallback', () => {
    const executingWork = fs.readFileSync(path.join(__dirname, '..', 'plugins',
        'claude-kit', 'skills', 'executing-work', 'SKILL.md'), 'utf8');
    const start = executingWork.indexOf('The standing hostile-boundary reuse step');
    assert.ok(start !== -1, 'executing-work\'s Dispatch Brief template no '
        + 'longer carries the hostile-boundary reuse step, so the guard-siting '
        + 'rule reaches no dispatched implementer at the moment it is acted '
        + 'on, which is the reach failure this clause exists to close');
    const end = executingWork.indexOf('Pin tests + new expected values', start);
    assert.ok(end !== -1 && end > start, 'executing-work\'s Dispatch Brief '
        + 'template no longer carries the pin-tests bullet that bounds the '
        + 'hostile-boundary clause, so the slice this pin reads has no far edge');
    const clause = collapseWhitespace(executingWork.slice(start, end));
    const doctrine = collapseWhitespace(fs.readFileSync(SKILL, 'utf8'));

    // The source side, asserted rather than assumed, because this pin's whole
    // purpose is to hold a copy to a rule: where the rule is retired, the copy
    // is a standing instruction with nothing behind it, and that is a decision
    // to take deliberately rather than to discover from a brief.
    assert.ok(doctrine.includes('A sanitizing or clamping guard is a property '
        + 'of the output channel, not of the producer that first needed it'),
        'the operating instructions no longer state the guard-siting rule '
        + 'while the Dispatch Brief still carries its implementer copy: either '
        + 'the rule moved and this pin moves with it, or the copy is now the '
        + 'only carrier and rests on no authority');
    assert.ok(doctrine.includes('the guard moves to the shared boundary as an '
        + 'exported helper'),
        'the operating instructions no longer name the exported helper as the '
        + 'remedy, which is the half the brief clause instructs an implementer '
        + 'to carry out');

    // The shared proposition, in the brief's own spelling: the guard belongs
    // to the channel and not to the caller that first needed it. That is what
    // makes reuse an instruction rather than a preference, so a clause keeping
    // the grep and dropping this reads as a style note.
    assert.ok(clause.includes('The guard at a boundary is a property of the '
        + 'channel rather than of the caller that first needed it'),
        'the hostile-boundary brief clause no longer states the guard as a '
        + 'property of the channel, so an implementer reads a suggestion to '
        + 'look around rather than the rule that makes hand-matching wrong');
    assert.ok(clause.includes('export the guard and call it'),
        'the hostile-boundary brief clause no longer names exporting the guard '
        + 'as the in-scope form of reuse, so it states the rule and no act '
        + 'that satisfies it');

    // The divergence, which is why this ships as a copy rather than a pointer:
    // the brief's reader is bound to a Files in scope list, so the clause
    // routes an out-of-scope guard to the report instead of editing it.
    // Dropping this leaves the clause directing an edit the scope check never
    // stages, which is the failure the out-of-scope route exists to prevent.
    assert.ok(clause.includes('leave it unedited'),
        'the hostile-boundary brief clause no longer bars editing a guard '
        + 'whose file sits outside Files in scope, so it directs an '
        + 'implementer into an edit that is never staged and a committed tree '
        + 'calling a symbol that exists only in an unstaged worktree');
    assert.ok(clause.includes('out-of-scope route'),
        'the hostile-boundary brief clause no longer routes the out-of-scope '
        + 'guard to step 4\'s out-of-scope route, so the surface it has the '
        + 'implementer name in the report reaches no disposition');

    // The class framing this file carries wherever it enumerates: an
    // implementer standing at a boundary the list omits has to read itself as
    // covered rather than exempt, and a bare list of four says the opposite.
    assert.ok(clause.includes('are instances and not the boundary'),
        'the hostile-boundary brief clause states its boundary examples '
        + 'without the class framing, so an implementer at a boundary the '
        + 'list omits reads itself as outside the rule');
});

// The goal event is the BLOCKED funnel's machine-wide input: any session on
// the box writes the stream, so a field the emitter ships that the funnel
// never dispositions is an unscreened writer-controlled value, the defect
// class an enumeration round found live instances of (the `plan` path and
// the `ts` dedup key among them). The field set is derived from the two hook
// surfaces rather than listed here, in the box-budget pin's own idiom: a pin
// carrying its own field list is a third literal that drifts with neither
// surface, so a field added to one side alone reads green against it.
// Surface one is the emitGoalEvent call sites in kit-goal-stop.js, the keys
// callers pass; surface two is the emitter body in kit-goal-lib.js, both the
// keys it reads off its argument and the record keys it actually ships,
// `ts` and `run` being emitter-generated and appearing in no call site. The
// funnel's disposition sentence names every shipped field in backticks,
// which is what the final loop reads: a field named nowhere in the funnel
// slice is a field the contract routes no reader of through any screen.
test('the coordinator\'s BLOCKED funnel dispositions every field the goal event ships', () => {
    const stopSrc = fs.readFileSync(path.join(__dirname, '..', 'plugins',
        'claude-kit', 'hooks', 'kit-goal-stop.js'), 'utf8');
    const libSrc = fs.readFileSync(path.join(__dirname, '..', 'plugins',
        'claude-kit', 'hooks', 'kit-goal-lib.js'), 'utf8');

    // Surface one: the keys the call sites pass. The object literals are
    // flat today; a nested brace would end the lazy match early and drop
    // keys, which the set comparison below reddens on rather than passing.
    const calls = stopSrc.match(/emitGoalEvent\(\{[\s\S]*?\}\)/g) || [];
    assert.ok(calls.length > 0, 'kit-goal-stop.js no longer calls '
        + 'emitGoalEvent, so the goal event this pin derives its field set '
        + 'from is emitted nowhere and the funnel paragraph describes a '
        + 'stream nothing writes');
    // A key is an identifier opening an object entry, so it is anchored to the
    // `{` or `,` (or line start) that precedes one. An unanchored identifier
    // followed by a colon also matches a ternary's middle arm, `x ? a : b`,
    // which would enter the field set as `a` and make this pin demand a
    // disposition for a field the emitter never ships.
    const keyOf = /(?:^|[{,])\s*([A-Za-z_$][\w$]*)\s*:/gm;
    const callKeys = new Set();
    for (const c of calls) {
        for (const m of c.matchAll(keyOf)) callKeys.add(m[1]);
    }

    // Surface two: the emitter body, sliced from its declaration to the
    // next top-level declaration or the exports line, whichever follows.
    const emitterStart = libSrc.indexOf('function emitGoalEvent(');
    assert.ok(emitterStart !== -1, 'kit-goal-lib.js no longer declares '
        + 'emitGoalEvent, so the emitter half of the field-set derivation '
        + 'has no body to read');
    let emitterEnd = libSrc.indexOf('\nfunction ', emitterStart);
    if (emitterEnd === -1) {
        emitterEnd = libSrc.indexOf('\nmodule.exports', emitterStart);
    }
    assert.ok(emitterEnd > emitterStart, 'the emitGoalEvent body has no '
        + 'following declaration or exports line to bound the slice this '
        + 'pin reads');
    const emitter = libSrc.slice(emitterStart, emitterEnd);
    // The keys the emitter reads off its argument object: the caller-facing
    // contract, compared against what the callers actually pass.
    const argKeys = new Set(
        [...emitter.matchAll(/\bd\.([A-Za-z_$][\w$]*)/g)].map((m) => m[1]));
    // The keys the emitter ships: the record literal's own keys plus the
    // conditional record.<key> assignments; `ts` and `run` live only here.
    const recordLiteral = emitter.match(/const record = \{[\s\S]*?\};/);
    assert.ok(recordLiteral, 'the emitGoalEvent body no longer builds its '
        + 'record object literal, so the shipped field set cannot be '
        + 'derived from it');
    const shipped = new Set();
    for (const m of recordLiteral[0].matchAll(keyOf)) shipped.add(m[1]);
    for (const m of emitter.matchAll(/\brecord\.([A-Za-z_$][\w$]*)\s*=/g)) {
        shipped.add(m[1]);
    }

    // The two derivations must agree with each other before either is read
    // against the funnel: a call site passing a key the emitter never reads
    // is a field that silently ships nowhere, and the emitter reading a key
    // no call site passes is a contract field nothing exercises.
    const sorted = (s) => [...s].sort().join(', ');
    assert.strictEqual(sorted(callKeys), sorted(argKeys),
        'the emitGoalEvent call sites in kit-goal-stop.js and the keys the '
        + 'emitter reads in kit-goal-lib.js name different field sets (call '
        + 'sites: ' + sorted(callKeys) + '; emitter reads: ' + sorted(argKeys)
        + '), so one surface gained or lost a field the other cannot see');
    assert.ok(shipped.size > callKeys.size,
        'the emitter ships no field of its own beyond what callers pass '
        + '(shipped: ' + sorted(shipped) + '); `ts` at least is '
        + 'emitter-generated, so an equal set means the record derivation '
        + 'went blind');

    // Every shipped field has a backticked disposition in the funnel
    // paragraph, sliced by its own landmarks so a mention elsewhere in the
    // coordinator skill cannot satisfy a pin about what the funnel says.
    const coordinator = fs.readFileSync(path.join(__dirname, '..', 'plugins',
        'claude-kit', 'skills', 'coordinator', 'SKILL.md'), 'utf8');
    const funnelStart = coordinator.indexOf('**The BLOCKED funnel.**');
    const funnelEnd = coordinator.indexOf('**A blocker\'s answer never returns');
    assert.ok(funnelStart !== -1 && funnelEnd > funnelStart,
        'the coordinator skill no longer carries the BLOCKED funnel '
        + 'paragraph between its own landmarks, so the disposition side of '
        + 'this pin has no slice to read');
    const funnel = coordinator.slice(funnelStart, funnelEnd);
    // Narrower than the funnel slice: the disposition clause itself, which
    // runs from the sentence's own colon to the clause that closes it. The
    // paragraph also enumerates the record's fields a few words earlier, so a
    // pin reading the whole slice passes on that enumeration alone and stays
    // green when a field's disposition is dropped while the field survives in
    // the list of what the record carries.
    const dispStart = funnel.indexOf('stated so no field rides without one:');
    const dispEnd = funnel.indexOf('A mid-queue advance does record');
    assert.ok(dispStart !== -1 && dispEnd > dispStart,
        'the BLOCKED funnel paragraph no longer carries its per-field '
        + 'disposition clause between its own landmarks, so this pin has no '
        + 'clause to read and would otherwise fall back to the record '
        + 'enumeration, which names the fields without dispositioning them');
    const dispositions = funnel.slice(dispStart, dispEnd);
    for (const field of shipped) {
        assert.ok(dispositions.includes('`' + field + '`'),
            'the BLOCKED funnel\'s disposition clause gives no disposition to '
            + 'the goal event\'s `' + field + '` field, which the emitter '
            + 'ships and any session on the box can write: a field with no '
            + 'named reader or screen at its point of use is the defect class '
            + 'this pin exists to keep out, and naming it in the record '
            + 'enumeration beside the clause is not a disposition');
    }
});

// The capture half of the kaizen function under the standing grant: every
// seat carries the duty to append captured kit friction to the kaizen inbox
// itself and carry on, never actioning it inline and never shelving it, with
// capture standing-authorized so no per-note approval and no routing leg
// stands between the friction and the inbox. The reason is the rule's
// boundary and is pinned with the rule, because a responsibility that names
// no owner is discharged by whichever party is least busy, in a fleet
// reliably the party least likely to have seen the friction; standing
// capture answers it by making the owner whoever met the friction, and a
// rewrite keeping the duty and dropping the reason reopens exactly that
// reading. Both stating surfaces are pinned together, the role skill and the
// peer-sessions Roles section, since one surface amended while a sibling
// goes on saying the old thing is the drift class this file exists to catch.
test('every seat carries the kaizen capture duty as a direct append, with its reason, on both surfaces', () => {
    for (const skill of ['role', 'peer-sessions']) {
        const label = 'plugins/claude-kit/skills/' + skill + '/SKILL.md';
        const body = fs.readFileSync(path.join(__dirname, '..', 'plugins',
            'claude-kit', 'skills', skill, 'SKILL.md'), 'utf8');
        assert.match(body, /kit friction[^.]{0,200}kaizen inbox/i,
            label + ' no longer states that captured kit friction goes to the '
            + 'kaizen inbox, so the duty has lost its destination on this '
            + 'surface and the ownerless reading is back');
        assert.match(body, /standing-authorized/i,
            label + ' no longer states that capture is standing-authorized, '
            + 'the grant that replaced the per-note nod and the routing leg; '
            + 'without it this surface reads as requiring an approval that no '
            + 'longer exists');
        assert.match(body, /never action\w*[^.]{0,40}inline/,
            label + ' no longer bars actioning a captured note inline, which '
            + 'is half of carry-on: the capturing seat appends the note and '
            + 'returns to its mandate');
        assert.match(body, /never shelv/,
            label + ' no longer bars shelving a captured note, which is the '
            + 'other half of carry-on: appended now, not parked');
        assert.ok(body.includes('least likely to have seen the friction'),
            label + ' no longer carries the rule\'s reason, that an ownerless '
            + 'duty is discharged by the least busy party, in a fleet reliably '
            + 'the one least likely to have seen the friction; the reason is '
            + 'the rule\'s boundary and rides with it');
    }
    const peerSessions = fs.readFileSync(path.join(__dirname, '..', 'plugins',
        'claude-kit', 'skills', 'peer-sessions', 'SKILL.md'), 'utf8');
    for (const lead of ['- **Expert.**', '- **Worker.**', '- **Admin.**']) {
        const lines = peerSessions.split(/\r?\n/).filter((l) => l.startsWith(lead));
        assert.strictEqual(lines.length, 1,
            'expected exactly one ' + lead + ' bullet in peer-sessions\' Roles '
            + 'section; the capture-duty pin below reads that bullet');
        assert.match(lines[0], /kit friction[^.]{0,160}kaizen inbox/i,
            'the peer-sessions ' + lead + ' bullet no longer carries the '
            + 'capture duty; the duty lands in each seat\'s own definition, '
            + 'not only in the shared capture paragraph');
    }
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

    assert.ok(executingWork.includes('which runs the section\'s close gate '
        + 'after them, so the gate that closes the section covers what the '
        + 'round changed (the lanes and their moments are owned by the '
        + 'operating doctrine\'s gate bullet)'),
        'step 3\'s review dispatch no longer points at the operating '
        + 'doctrine\'s gate bullet for the lanes, or no longer places the '
        + 'close gate after the review fixes. Both halves are load-bearing: '
        + 'the doctrine is the single owner of the moment, and a close gate '
        + 'running beside the round instead of after it leaves every review '
        + 'fix and every folded surface outside the only gate the section '
        + 'runs, which also makes step 4\'s fold predicate unsatisfiable');

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
// definition, the contention lane's schedule, the schedule's touched-delta
// condition, and the whole-gate moments the three surfaces word alike.
// The condition that bounds the pre-push whole gate is stated on more surfaces
// than the three the loop below compares: the two skills that perform a push
// state it at their own points of action. It is one condition on one property
// of a trunk, and it dissolves the day that trunk gains branch protections, so
// every surface asserting it has to move together or the ones left behind
// assert a condition that no longer holds anywhere.
const INSTALL_SURFACE_CONDITION = 'a trunk consumers install from directly with no CI gating the merge';

function readRepoFile(relPath) {
    return fs.readFileSync(path.join(__dirname, '..', ...relPath.split('/')), 'utf8');
}

// The carriers are keyed by path rather than by content, so the membership
// leg below can compare a file the tree holds against this list. Both doctrine
// copies are read from their own paths here: the frontmatter the skill copy
// carries is immaterial to a substring check.
const INSTALL_SURFACE_CARRIERS = [
    ['the skill-body doctrine copy',
        'plugins/claude-kit/skills/operating-instructions/SKILL.md'],
    ['the doctrine mirror', 'home/claude-kit-doctrine.md'],
    ['the testing-discipline skill',
        'plugins/claude-kit/skills/testing-discipline/SKILL.md'],
    ['executing-work\'s Commit-and-Push bullet',
        'plugins/claude-kit/skills/executing-work/SKILL.md'],
    ['finishing-work\'s Commit-and-Push bullet',
        'plugins/claude-kit/skills/finishing-work/SKILL.md'],
    ['kaizen\'s applied-brief push and its capture exemption',
        'plugins/claude-kit/skills/kaizen/SKILL.md'],
    ['docs/architecture.md\'s cadence paragraph', 'docs/architecture.md'],
];

// A surface stating the condition in some other wording is the drift this
// pin exists to catch, and a list of names cannot see one that was never
// added to it. So the condition's own shape is swept over the live surfaces
// and every hit has to be a listed carrier: a file describing the same trunk
// property under different words reddens here, and the wording loop above
// then reddens on it too. Journey surfaces are outside the sweep by the
// spec's own exemption, since a plan doc and an archive quote the retired and
// the current wording alike as a record.
const INSTALL_SURFACE_SHAPE = /trunk consumers install from|no CI gating/i;

function installSurfaceCandidates() {
    const files = shippedKitMarkdown().map((f) => 'plugins/claude-kit/'
        + path.relative(path.join(__dirname, '..', 'plugins', 'claude-kit'), f)
            .replace(/\\/g, '/'));
    return files.concat(['home/claude-kit-doctrine.md', 'README.md',
        'docs/README.md', 'docs/architecture.md']);
}

test('every surface stating the install-surface condition words it alike', () => {
    for (const [label, relPath] of INSTALL_SURFACE_CARRIERS) {
        assert.ok(readRepoFile(relPath).includes(INSTALL_SURFACE_CONDITION),
            label + ' (' + relPath + ') no longer '
            + 'states the install-surface condition in the shared wording ("'
            + INSTALL_SURFACE_CONDITION + '"). The condition keys on a property '
            + 'of the trunk rather than on a repo name, so a reword that reaches '
            + 'some surfaces and not others leaves the rest gating on a '
            + 'condition the reworded ones no longer describe');
    }

    // The instrument leg, so the membership sweep's silence is readable: the
    // shape has to select a carrier stating the condition in wording the
    // shared literal does not supply.
    assert.match('main is a trunk consumers install from with nothing gating '
        + 'the merge', INSTALL_SURFACE_SHAPE, 'the install-surface shape no '
        + 'longer selects a paragraph describing the trunk property in its own '
        + 'words, so the membership sweep below cannot see an unlisted carrier');

    const listed = new Set(INSTALL_SURFACE_CARRIERS.map(([, p]) => p));
    for (const relPath of installSurfaceCandidates()) {
        if (!INSTALL_SURFACE_SHAPE.test(readRepoFile(relPath))) continue;
        assert.ok(listed.has(relPath), relPath + ' describes the trunk property '
            + 'the install-surface condition keys on and is not among the '
            + 'carriers above, so a reword through the shared wording leaves it '
            + 'asserting a condition no other surface describes. Add it to '
            + 'INSTALL_SURFACE_CARRIERS, or state the property somewhere that '
            + 'is a carrier');
    }
});

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
        ['beside the whole gate wherever the whole gate runs, and at section close whenever',
            'the contention lane\'s schedule, both of its clauses'],
        ['section\'s delta touched',
            'the schedule\'s touched-delta condition'],
        ['before a push only where that push lands on ' + INSTALL_SURFACE_CONDITION,
            'the install-surface condition that bounds the pre-push whole gate'],
        ['before the plan\'s handoff',
            'the handoff moment, which is finishing\'s own gate rather than a '
            + 'second one after it'],
        ['merge takes the whole gate',
            'the post-merge moment, the one whole-gate moment no lane derived '
            + 'from a diff can stand in for'],
    ]) {
        for (const [label, body] of copies) {
            assert.ok(body.includes(phrase), label + ' no longer carries ' + what
                + ' ("' + phrase + '"); the lane text is deliberately stated in '
                + 'full on both surfaces, so the copies must keep saying the '
                + 'same thing');
        }
    }
    // Finishing and the handoff are one moment, not two, and the skill that
    // owns lane mechanics is where that reading is stated rather than left to a
    // reader. Without the sentence a reader takes "at finishing, before the
    // plan's handoff" as two moments and looks for a second gate that no
    // procedure runs.
    assert.match(testingSkill, /Finishing and the handoff are one moment/,
        'the testing-discipline skill no longer states that finishing and the '
        + 'handoff are one moment, so the moments list reads as naming a gate '
        + 'between finishing and the handoff that nothing implements');
});

// Section 7's own Tests: line called for no new test, written before the
// section existed; the section's own fix round created a cross-file
// invariant that line could not anticipate, so this pin extends that floor
// rather than honoring it as written. The peer-sessions Roles table is the
// Admin seat's cadence's one home (the admin-requests.md bullet's own former
// copy was retired in the same round), and the coordinator's staleness leg
// prunes a registry entry on twice that figure, so a row deleted or reshaped
// here leaves two skills pointing at a figure that no longer exists with the
// suite green. The figure is derived from the table row rather than
// restated as a literal in this test, which is what makes the pin sensitive
// to the row moving rather than to one hand-copied number agreeing with
// another.
test('the Admin seat\'s cadence is single-sourced in the peer-sessions tier table, and the role and coordinator skills resolve against it rather than copy it', () => {
    const peerSessions = fs.readFileSync(path.join(__dirname, '..', 'plugins',
        'claude-kit', 'skills', 'peer-sessions', 'SKILL.md'), 'utf8');
    const adminRow = peerSessions.split(/\r?\n/).find((l) => l.startsWith('| Admin |'));
    assert.ok(adminRow, 'the peer-sessions Roles table no longer carries an '
        + 'Admin row; this pin reads that row as the cadence\'s one source');
    const hourMatch = adminRow.match(/A (\d+)-hour inbox poll of `admin-requests\.md`/);
    assert.ok(hourMatch, 'the peer-sessions Admin row no longer states its '
        + 'inbox-poll cadence in the "A <N>-hour inbox poll of '
        + '`admin-requests.md`" shape this pin derives the figure from');
    const hours = Number(hourMatch[1]);
    assert.ok(Number.isInteger(hours) && hours > 0,
        'the peer-sessions Admin row\'s cadence figure is not a positive '
        + 'whole number of hours');

    // The role skill's admin-requests.md bullet: the far end that must point
    // at the table rather than restate the figure.
    const roleBody = fs.readFileSync(path.join(__dirname, '..', 'plugins',
        'claude-kit', 'skills', 'role', 'SKILL.md'), 'utf8');
    const roleLine = roleBody.split(/\r?\n/)
        .find((l) => l.includes('admin-requests.md`: the Admin seat\'s artifact inbox'));
    assert.ok(roleLine, 'the role skill no longer carries the admin-requests.md '
        + 'directory-contract bullet this pin reads for the cadence pointer');
    assert.match(roleLine,
        /the Admin seat polls it on its own loop, at the cadence the peer-sessions Roles table states/,
        'the role skill\'s admin-requests.md bullet no longer resolves the '
        + 'Admin seat\'s poll cadence through the peer-sessions Roles table; a '
        + 'reader following this bullet alone has no source for the figure');
    assert.ok(!/\d+-hour/.test(roleLine),
        'the role skill\'s admin-requests.md bullet carries its own '
        + '<N>-hour figure again, a second copy of what the peer-sessions '
        + 'Roles table already states, which is exactly the drift this pin '
        + 'exists to catch');

    // The coordinator skill's staleness leg: the second far end, read from
    // its own paragraph rather than the whole file, so a stray hardcoded
    // figure elsewhere in the skill cannot hide behind this pin passing.
    const coordinator = fs.readFileSync(path.join(__dirname, '..', 'plugins',
        'claude-kit', 'skills', 'coordinator', 'SKILL.md'), 'utf8');
    const staleStart = coordinator.indexOf(
        'An off-roster entry is not by itself a dead session');
    const staleEnd = coordinator.indexOf('A claim on the heavy-process slot');
    assert.ok(staleStart !== -1 && staleEnd > staleStart,
        'the coordinator skill\'s staleness-leg paragraph no longer sits '
        + 'between its own landmarks, so this pin has no slice to read');
    const staleness = coordinator.slice(staleStart, staleEnd);
    const adminLead = 'The peer-sessions Roles table names a cadence for the Admin seat, which takes that stated figure';
    const adminIdx = staleness.indexOf(adminLead);
    assert.ok(adminIdx !== -1,
        'the coordinator skill\'s staleness leg no longer resolves the Admin '
        + 'seat\'s twice-cadence prune bound through the peer-sessions Roles '
        + 'table by name, so a reader of this skill alone cannot tell which '
        + 'bound an off-roster Admin entry takes');
    const adminWindow = staleness.slice(adminIdx, adminIdx + 250);
    assert.ok(!/\d+-hour/.test(adminWindow),
        'the coordinator skill\'s Admin-cadence sentence carries its own '
        + '<N>-hour figure again rather than resolving through the '
        + 'peer-sessions Roles table alone, which is the same drift the '
        + 'role-skill half of this pin catches on its own surface');
});


// The sync allowlist's admitted roots, read from the installer's own
// generator rather than from a list this file keeps. Get-MemorySyncIgnoreText
// builds each root's rules by calling $tierRules with the root's prefix, so
// the prefixes it passes are the allowlist's own statement of what the store
// publishes. A root added there appears here with no edit to this file, which
// is the point: the boundary sentences below are prose restating that set,
// and a restated claim nothing checks is exactly how the widening that
// created this pin shipped with the suite green and four documents wrong.
//
// The slice is bounded at the next function header rather than run to end of
// file, so a $tierRules call in some later function cannot be read as an
// admitted root.
function admittedSyncRoots(installer) {
    const start = installer.indexOf('function Get-MemorySyncIgnoreText');
    assert.ok(start !== -1, 'install-memory-sync.ps1 no longer defines '
        + 'Get-MemorySyncIgnoreText, which is the generated text this pin '
        + 'derives the admitted roots from');
    const rest = installer.slice(start + 1);
    const next = rest.indexOf('\nfunction ');
    const body = next === -1 ? rest : rest.slice(0, next);
    const roots = [];
    const call = /&\s*\$tierRules\s*'([^']+)'/g;
    let m;
    while ((m = call.exec(body)) !== null) roots.push(m[1]);
    assert.ok(roots.length >= 2, 'Get-MemorySyncIgnoreText no longer builds '
        + 'its roots through $tierRules calls carrying a literal prefix, so '
        + 'this pin can no longer read what the allowlist admits');
    return roots;
}

// The same set read off the path predicate the probes and the inbound screen
// share. Two code surfaces state the admitted roots, and this pin reddens
// when either drifts from the other: the generator alone would let the
// predicate widen silently, and that predicate is what actually decides
// whether a path is published.
function predicateSyncRoots(installer) {
    const start = installer.indexOf('function Test-MemorySyncPathAllowed');
    assert.ok(start !== -1, 'install-memory-sync.ps1 no longer defines '
        + 'Test-MemorySyncPathAllowed, the predicate half of this pin');
    const rest = installer.slice(start + 1);
    const next = rest.indexOf('\nfunction ');
    const body = next === -1 ? rest : rest.slice(0, next);
    const roots = [];
    const branch = /\$p -match '\^([^']+)'/g;
    let m;
    while ((m = branch.exec(body)) !== null) roots.push(m[1]);
    assert.ok(roots.length >= 2, 'Test-MemorySyncPathAllowed no longer tests '
        + 'its roots with anchored -match branches, so this pin can no longer '
        + 'read the predicate half');
    return roots;
}

// Both spellings reduced to the root name a document would say: the leading
// segment, with a wildcard segment in either vocabulary written as '*'.
function rootName(prefix) {
    return prefix.replace(/^\//, '').replace(/\/.*$/, '')
        .replace(/\[\^\/\]\+/g, '*');
}

// Roots whose content the phrase "memory tiers" already covers. This list is
// itself a restatement, and the direction it fails in is the safe one: a new
// memory tier reddens every boundary sentence for not naming its prefix,
// which is a loud review prompt rather than a silent pass.
// The shapes below are ordinary English and match sentences with nothing to
// do with the store ("admits only printable ASCII"), so a match counts only
// where the run-up to it names the sync repository. The subject word sits
// before the match rather than inside it, which is why the window is read
// rather than the claim.
const BOUNDARY_SUBJECT = /allowlist|gitignore|the repository there|sync repo|store root/i;
const SUBJECT_WINDOW = 240;

const MEMORY_TIER_ROOTS = ['projects', 'memory-types', 'memory-operator'];

// The three sentence shapes a surface uses to state the allowlist narrowly.
// A new shape is outside this pin, which is why the sweep below names the
// surfaces it already knows about rather than trusting its own count.
const BOUNDARY_SHAPES = [
    /re-includes only[^.]*\./g,
    /admits only[^.]*\./g,
    /only memory files inside[^.]*\./g,
];

// Comment markers stripped so a claim wrapped across a comment block reads as
// one sentence, then whitespace collapsed through this file's own helper.
function flattenForBoundary(raw) {
    return collapseWhitespace(raw
        .replace(/^[ \t]*(#[ \t]*(---[ \t]*)?|\/\/[ \t]?)/gm, ''));
}

function boundaryClaims(raw) {
    const flat = flattenForBoundary(raw);
    const out = [];
    for (const shape of BOUNDARY_SHAPES) {
        shape.lastIndex = 0;
        let m;
        while ((m = shape.exec(flat)) !== null) {
            const runUp = flat.slice(Math.max(0, m.index - SUBJECT_WINDOW), m.index);
            if (BOUNDARY_SUBJECT.test(runUp)) out.push(m[0]);
        }
    }
    return out;
}

function assertNamesEveryRoot(claim, extraRoots, where) {
    assert.ok(/memory tier/i.test(claim), where + ' states the sync boundary '
        + 'without naming the memory tiers: "' + claim + '"');
    for (const root of extraRoots) {
        assert.ok(claim.toLowerCase().includes(root), where + ' states the sync '
            + 'boundary without naming the "' + root + '" root the allowlist '
            + 'admits, so the document describes a boundary narrower than the '
            + 'code enforces: "' + claim + '"');
    }
}

// The shipped surfaces this sweep reads: the repo-root and docs/ markdown,
// and everything under the plugin payload. Two directories are deliberately
// out, docs/plans/ and docs/archive/, which are the journal layer and quote
// retired wordings as their subject, and so is this test file, whose control
// below is a retired sentence by construction.
function shippedBoundaryFiles() {
    const root = path.join(__dirname, '..');
    const files = [];
    const walk = (dir, depth) => {
        for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
            const full = path.join(dir, entry.name);
            if (entry.isDirectory()) {
                if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue;
                if (depth > 0) walk(full, depth - 1);
                continue;
            }
            if (/\.(md|ps1|js)$/.test(entry.name)) files.push(full);
        }
    };
    for (const f of fs.readdirSync(root)) {
        if (/\.md$/.test(f)) files.push(path.join(root, f));
    }
    for (const f of fs.readdirSync(path.join(root, 'docs'))) {
        if (/\.md$/.test(f)) files.push(path.join(root, 'docs', f));
    }
    walk(path.join(root, 'plugins', 'claude-kit'), 6);
    return files;
}

test('every shipped sentence stating the sync allowlist narrowly names every root the allowlist admits', () => {
    const installer = fs.readFileSync(path.join(__dirname, '..', 'plugins',
        'claude-kit', 'doctor', 'install-memory-sync.ps1'), 'utf8');

    const generated = admittedSyncRoots(installer).map(rootName);
    const predicate = predicateSyncRoots(installer).map(rootName);
    assert.deepStrictEqual([...generated].sort(), [...predicate].sort(),
        'the roots Get-MemorySyncIgnoreText re-includes and the roots '
        + 'Test-MemorySyncPathAllowed admits are no longer the same set, so '
        + 'the ignore file and the probes disagree about what the store '
        + 'publishes: generated ' + JSON.stringify(generated) + ' vs '
        + 'predicate ' + JSON.stringify(predicate));

    const extraRoots = generated.filter((r) => !MEMORY_TIER_ROOTS.includes(r));
    assert.ok(extraRoots.length > 0, 'the allowlist admits nothing beyond the '
        + 'memory tiers, so the boundary sentences this pin checks now name a '
        + 'root the allowlist does not publish; the drift is real and runs '
        + 'the other way');

    let checked = 0;
    const seen = [];
    for (const file of shippedBoundaryFiles()) {
        if (file === __filename) continue;
        const claims = boundaryClaims(fs.readFileSync(file, 'utf8'));
        if (claims.length === 0) continue;
        const rel = path.relative(path.join(__dirname, '..'), file);
        seen.push(rel);
        for (const claim of claims) {
            assertNamesEveryRoot(claim, extraRoots, rel);
            checked++;
        }
    }

    // Non-vacuity, and the one thing a sweep cannot prove about itself. A
    // sweep that matched nothing reads exactly like a clean one, so the
    // surfaces already known to state the boundary are named here: if a
    // rewording takes one out of the sweep's grammar, this fails rather than
    // going quiet.
    const known = [
        ['docs', 'security-model.md'],
        ['docs', 'architecture.md'],
        ['plugins', 'claude-kit', 'skills', 'kit-doctor', 'SKILL.md'],
        ['plugins', 'claude-kit', 'doctor', 'doctor.ps1'],
        ['plugins', 'claude-kit', 'doctor', 'install-memory-sync.ps1'],
        ['plugins', 'claude-kit', 'scripts', 'memory-index.js'],
    ];
    for (const parts of known) {
        const want = path.join(...parts);
        assert.ok(seen.includes(want), want + ' no longer states the sync '
            + 'boundary in any shape this sweep recognizes, so it has dropped '
            + 'out of coverage silently; either the sentence was reworded out '
            + 'of the grammar or the claim was removed');
    }
    assert.ok(checked >= known.length, 'the boundary sweep matched only '
        + checked + ' sentences, fewer than the surfaces known to carry one');

    // The commit message is the surface a later reader reconstructs the
    // change from, so a message narrower than its own commit misdescribes
    // what was published. It states no sentence the sweep's grammar reaches.
    const msg = installer.match(/"kit memory sync:[^"]*"/);
    assert.ok(msg, 'install-memory-sync.ps1 no longer carries the '
        + '"kit memory sync: ..." commit message literal this pin reads');
    assertNamesEveryRoot(msg[0], extraRoots,
        'the sync commit message in install-memory-sync.ps1');

    // The control, derived from a live claim rather than written out, so a
    // later sweep that "corrects" a retired literal in this file cannot
    // disarm it. The failure this pin exists against is a sentence naming the
    // tiers and stopping there, which is what stripping the extra roots out
    // of a live claim produces.
    const live = boundaryClaims(fs.readFileSync(path.join(__dirname, '..',
        'docs', 'security-model.md'), 'utf8'))[0];
    assert.ok(live, 'docs/security-model.md carries no boundary claim to '
        + 'build the control from');
    let ablated = live;
    for (const root of extraRoots) {
        ablated = ablated.replace(new RegExp('\\s*(and\\s+)?(the\\s+)?(machine\\s+)?'
            + root + '(\\s+directory)?', 'gi'), '');
    }
    assert.throws(
        () => assertNamesEveryRoot(ablated, extraRoots, 'the control'),
        /without naming the "/,
        'the control passed: a boundary sentence with every admitted root '
        + 'beyond the memory tiers stripped out of it was accepted, so a '
        + 'green from this pin proves nothing');

    // What this pin does not refuse, stated rather than left to be assumed:
    // it tests that a root's name appears in the sentence, not that the
    // sentence admits it, so "re-includes only the memory tiers, excluding
    // the coordinator directory" would pass. No check here reads prose sense.
});

// The public-board cap on a worker's blocker traffic is stated at three
// sites: executing-work's expert-ask paragraph, its first-line paragraph, and
// peer-sessions' Worker seat bullet. The cap prices what the ask, the
// coordinator notice, and the declaration's own first line may carry, and
// each site states the footing it stands on. These pins hold both, because
// the footing is the part that has already gone false once: it read as a
// board file a public repository may carry, and the coordinator's board sits
// in the memory store, so a worker reasoning from the footing rather than
// obeying the rule would conclude the cap had lapsed.
//
// The footing each site now states is that the cap is a standard rather than
// a derivation. It is stated against a public board so that moving the board
// somewhere quieter never reads as relaxing it, which is the framing
// docs/security-model.md carries, and no fact about where the board sits,
// what remote is configured, whether anything replicates at all, or who reads
// it can be reasoned into relaxing it. Each site resolves to
// docs/security-model.md for the readership analysis and to the coordinator
// skill for the readership precondition, rather than restating either.
//
// Each pin refuses three named axes and asserts the footing is stated.
//
//   axis 1, the retired footing: the site grounding the cap in a repository
//   carrying the board. The refusing rule is assertFootingNotRetired, which
//   throws on a "board"/container-noun adjacency inside one sentence, in
//   either order. Its reach and its one known misfire are stated at the rule
//   itself.
//
//   axis 2, the re-pegged footing: the site grounding the cap in a fact about
//   the store's remote, either the remote being private or the store's own
//   replication standing as the warrant. The first is the "correction" a
//   later pass would make while appearing to update the paragraph, and it
//   would remove the screen, since a private remote is a precondition of one
//   installation rather than a property of the kit. The second is the
//   re-derivation this section was rewritten to retire, and it passes a
//   refusal aimed at the replacement case when it is added beside the
//   standard rather than put in its place, so the rule reaches it in either
//   position. The refusing rule is assertFootingNotRepegged. Its reach and
//   what it misses are stated at the rule itself.
//
//   axis 3, the cap relaxed while still being named: text that keeps the
//   cap's vocabulary and drops its force, by conditioning the cap or its
//   footing on something ("only until the operator has answered the
//   readership question, after which the seat's own judgement replaces the
//   cap"). It is what a pin over a standard needs, since a standard has no
//   derivation left to falsify: the only way to disarm it in prose is to make
//   it contingent. The refusing rule is assertCapNotConditioned. Its window
//   covers the cap's own statement and its footing's, so a footing made
//   contingent ("where a remote is configured") is refused by this axis and
//   needs no separate one. What it reads is a relaxation vocabulary rather
//   than force itself, which is a real limit and is stated at the rule.
//
// A fourth refusal is not an axis but a boundary: assertNoBoundaryTriple
// keeps these paragraphs from restating which boundaries a board line
// crosses. Two shipped surfaces name different triples, the coordinator skill
// naming machine, account and session and docs/security-model.md naming
// account, machine and person, so a restatement here picks a side in a
// disagreement these paragraphs have no mandate to settle. They point at
// docs/security-model.md instead. Its residual is stated at the rule.
//
// The ablations below are standalone constructed strings that never reference
// the slice, and they prove exactly one thing: that each refusing rule fires
// on that axis's offending shape. They prove nothing about the slice, and no
// arrangement of them could, since each ablation matches on its own and the
// assert.throws would succeed whatever the slice held. What keeps the slice
// itself honest is the positive assertions in assertFootingStated and the
// far-end assertions in assertFootingSourcesCarryIt, which read the live text
// and nothing else.
//
// The far end is the other half of this design. Each site stops carrying its
// own ground and delegates it, so a pin that only reads the pointer goes
// green while the pointed-at standard is reworded or deleted, which is the
// cross-file-invariant-nothing-checks shape these paragraphs refuse to
// create. assertFootingSourcesCarryIt reads the two delegated surfaces and
// runs inside all three site pins, so a far end that moves reddens at every
// site that leans on it rather than nowhere.

function sentencesOf(text) {
    // A period is a sentence break only where whitespace or the end follows,
    // so `board.md` and `docs/security-model.md` stay inside their sentence
    // rather than splitting it. Splitting on a bare period is what let the
    // most likely re-introduction spelling, the coordinator skill's own
    // `board.md`, slip past an adjacency check.
    return text.split(/[.;:](?=\s|$)/);
}

// The container nouns a re-introduced premise would spell. The list is wider
// than the two spellings the retired text used, since the premise reads the
// same with any of them, and it is still a list rather than a rule: a
// re-introduction spelling a container this alternation does not name goes
// unrefused, and that residual is the honest limit of this axis. What the
// list does cover is every spelling on the surfaces this repository ships,
// which is where a copy-forward would come from.
const CONTAINER_NOUN
    = '(?:repo|repos|repository|repositories|project|projects|marketplace|marketplaces|forge|forges|host|hosts|GitHub|git remote)';
// The gap between the two words spans anything but a sentence break, and a
// period is a break only where whitespace or the end follows it. A gap that
// broke on every period was cut by the period inside `board.md`, which is how
// the coordinator skill spells the board and so the most likely spelling a
// re-introduced premise would carry.
const SAME_SENTENCE_GAP = '(?:[^.;:]|[.;:](?!\\s|$)){0,80}';
// `board` is anchored on both sides. Unanchored it matched inside keyboard,
// billboard and boards, and "the operator's keyboard" is standing vocabulary
// in these files, so an ordinary sentence pairing it with a repo would have
// reddened the suite claiming a retired premise that was not there. The
// anchor costs nothing the axis needs: a period is a word boundary, so the
// `board.md` spelling still matches.
const RETIRED_FOOTING = new RegExp(
    '\\bboard\\b' + SAME_SENTENCE_GAP + '\\b' + CONTAINER_NOUN + '\\b|\\b'
    + CONTAINER_NOUN + '\\b' + SAME_SENTENCE_GAP + '\\bboard\\b', 'i');

// Axis 2 is two patterns, because the footing can be re-pegged to the store
// in two directions and only one of them was ever written here.
//
// PRIVATE_PREMISE refuses the literal word "private" beside a remote, a store
// or a board. That covers the primary copy-forward risk, since the
// coordinator skill's own precondition is worded "the store's remote is
// private", so a pass that pulls that premise down into these paragraphs is
// caught. What it misses is the same premise said without the word: "only the
// operator's own machines pull the store", "the remote is the operator's own
// and its principals are theirs alone", "the store is never published, so the
// readership is bounded". Those are refused by nothing here and are left to
// review, which is why each site states the footing as a standard rather than
// leaving a reader to infer one.
//
// REPLICATION_PREMISE refuses a replication-shaped warrant beside a remote or
// a store. That premise is the one this section retired, and refusing only
// the absence of the standard would miss it: added beside the standard
// sentence rather than in its place ("the store's sync replicates that line
// to every machine the configured remote serves, which is why the line is
// capped"), it leaves every other rule green while restoring the derivation a
// worker on a box that replicates nowhere reads as absent. What it misses is
// a replication premise that names neither the remote nor the store ("every
// machine that pulls it sees the line"), and a description of replication
// that is not offered as a warrant, since no pattern here reads a sentence's
// argumentative role. The second cuts the other way and is the reason these
// paragraphs describe no replication at all rather than describing it
// carefully: a site that needs the fact points at docs/security-model.md,
// which carries it.
const PRIVATE_PREMISE
    = /\bprivate\b[^.;:]{0,80}\b(remote|store|board)\b|\b(remote|store|board)\b[^.;:]{0,80}\bprivate\b/i;
const REPLICATION_VERB = '(?:replicat\\w+|sync\\w*|propagat\\w+|pushe[sd]|pulls?)';
const REPLICATION_PREMISE = new RegExp(
    REPLICATION_VERB + SAME_SENTENCE_GAP + '\\b(remote|store)\\b|\\b(remote|store)\\b'
    + SAME_SENTENCE_GAP + REPLICATION_VERB, 'i');

// The relaxation vocabulary. A cap that is named and then made contingent
// reads as a cap to a skimming reader and to any check that matches the cap's
// own words, which is the shape the security lens constructed: the pins are
// satisfied by text that names the cap and no longer imposes it. "Only what"
// and "only when it holds" are not here: the first is how every one of these
// sites states the cap itself, and the second is unrelated prose in the
// Worker bullet.
//
// The residual is the honest limit of this axis and is larger than the other
// two: a relaxation written outside this vocabulary is not refused. Measured
// non-refusals, all of which say what the ablation below says: "the cap binds
// until the operator answers", "where the readership is settled the seat's
// own judgement governs", "at the seat's discretion once the store's
// readership is known". A rule that read force rather than words would catch
// those, and nothing here reads force; what this rule buys is that the
// cheapest spellings of a relaxation, the ones a pass "correcting" these
// paragraphs would reach for first, cannot be written silently.
const RELAXATION
    = /\bonly (?:where|while|until|once|if|so long as|for so long)\b|\bunless\b|\bonce the operator\b|\bmay be relaxed\b|\bno longer applies\b|\bneed not\b|\bceases to\b|\blapses\b|\bis lifted\b|\bdoes not apply\b|\bstops applying\b|\bown judge?ment replaces\b|\bwhere a remote is\b|\bwhere the store's remote\b/i;

const CAP_PHRASE = /public[- ]board cap|put on a public board/i;
const FOOTING_PHRASE = /a standard rather than/i;
const CAP_MENTION = /\bthe cap\b/i;

function assertFootingNotRetired(slice, where) {
    // \brepo\b matches inside "repo-relative", which two of these three
    // slices already contain, so a future sentence putting "board" and
    // "repo-relative" in one clause reddens wrongly. That direction is the
    // acceptable one, a loud false alarm rather than a silent pass, and it is
    // named here so the next author reads the failure rather than guessing at
    // it: reword the sentence or split the clause.
    const hit = slice.match(RETIRED_FOOTING);
    assert.ok(!hit, where + ' grounds the public-board cap in a repository '
        + 'carrying the board, which is the retired footing: the '
        + 'coordinator\'s board sits in the memory store, so a worker reading '
        + 'this reasons from a false premise and concludes the cap has '
        + 'lapsed. Offending text: "' + (hit ? hit[0] : '') + '"');
}

function assertFootingNotRepegged(slice, where) {
    const priv = slice.match(PRIVATE_PREMISE);
    assert.ok(!priv, where + ' grounds the public-board cap in the store\'s '
        + 'remote being private, which is a precondition of one installation '
        + 'rather than a property of the kit: pegging the cap to a private '
        + 'remote removes the screen while appearing to update the paragraph. '
        + 'Offending text: "' + (priv ? priv[0] : '') + '"');
    const repl = slice.match(REPLICATION_PREMISE);
    assert.ok(!repl, where + ' grounds the public-board cap in the store '
        + 'replicating, which is the derivation this section retired: a store '
        + 'with no remote, or a branch that tracks nothing, replicates '
        + 'nowhere, so a worker on that box reads the stated ground as empty '
        + 'and concludes the cap has lapsed. The cap is a standard; the '
        + 'replication belongs to docs/security-model.md, which these '
        + 'paragraphs point at. Offending text: "' + (repl ? repl[0] : '')
        + '"');
}

function assertCapNotConditioned(slice, where) {
    // The window is every sentence that states the cap, its footing, or
    // speaks of the cap at all, plus the sentence after each, since a
    // relaxation is as often written as the following clause as inside the
    // one it relaxes. The bare "the cap" trigger is what reaches these
    // paragraphs' operative cap sentences, which name no cap phrase of their
    // own: "So compose that one line for a public board and keep it inside
    // 120 characters", "The cap holds whatever the queue position", "A path
    // under the cap is spelled repo-relative". A relaxation written into one
    // of those was outside the window while reading as squarely inside the
    // rule.
    const units = sentencesOf(slice);
    for (let i = 0; i < units.length; i++) {
        if (!CAP_PHRASE.test(units[i]) && !FOOTING_PHRASE.test(units[i])
            && !CAP_MENTION.test(units[i])) continue;
        for (const unit of [units[i], units[i + 1] || '']) {
            const hit = unit.match(RELAXATION);
            assert.ok(!hit, where + ' conditions the public-board cap or its '
                + 'footing rather than stating it: the cap is a standard, so '
                + 'no fact about the store, its remote, or who has answered '
                + 'the readership question relaxes it. Text that names the '
                + 'cap and drops its force reads as a cap to every check that '
                + 'matches the cap\'s own words. Offending text: "'
                + (hit ? hit[0] : '') + '" in: "' + unit.trim() + '"');
        }
    }
}

function assertNoBoundaryTriple(slice, where) {
    // It reaches the two orderings the shipped surfaces actually use, both of
    // which lead with account and machine in one order or the other. The
    // residual: a triple ordered otherwise ("machine, session and account",
    // "account, person and machine") passes, and so does a degenerate shape
    // like "account, account and person", since the rule matches an ordering
    // pattern rather than parsing a list. It is a copy-forward refusal, not a
    // proof that no triple can be written here.
    const hit = slice.match(/\b(account|machine),\s*(account|machine)\s+and\s+(person|session)\b/i);
    assert.ok(!hit, where + ' restates which boundaries a board line crosses, '
        + 'which picks a side in a disagreement between two shipped surfaces: '
        + 'the coordinator skill names machine, account and session, '
        + 'docs/security-model.md names account, machine and person. These '
        + 'paragraphs point at docs/security-model.md rather than carrying a '
        + 'triple of their own. Offending text: "' + (hit ? hit[0] : '') + '"');
}

function assertCapStated(slice, where) {
    assert.match(slice, CAP_PHRASE,
        where + ' no longer prices the blocker traffic at what the sender '
        + 'would put on a public board, so the cap itself is gone rather '
        + 'than its footing');
}

// The footing's three parts: the cap is a standard, the standard does not
// move when the board does, and the analysis behind it lives on the two
// surfaces that own it. The pointer is asserted as the path rather than as a
// phrase, since "the security model" is ambiguous in peer-sessions, which
// uses that wording for the AI-OS security model.
function assertFootingStated(slice, where) {
    assert.match(slice, FOOTING_PHRASE, where + ' no longer states the cap as '
        + 'a standard rather than a derivation, so a reader is left to derive '
        + 'it from wherever the board happens to sit');
    assert.match(slice, /stated against a public board/, where + ' no longer '
        + 'states that the cap is held against a public board, which is what '
        + 'makes it independent of where the board lives');
    assert.match(slice, /never reads as relaxing it/, where + ' no longer '
        + 'says that moving the board somewhere quieter does not relax the '
        + 'cap, which is the whole point of stating it against a public board');
    assert.match(slice, /docs\/security-model\.md/, where + ' no longer '
        + 'resolves to docs/security-model.md for the readership analysis, so '
        + 'the paragraph either carries that analysis itself or drops it');
    assert.match(slice, /coordinator skill/, where + ' no longer resolves the '
        + 'readership precondition to the coordinator skill, which owns it; a '
        + 'copy of that precondition here would be a cross-file invariant '
        + 'nothing checks');
    assert.match(slice, /precondition/, where + ' no longer names the '
        + 'readership question as a precondition, so the pointer at the '
        + 'coordinator skill no longer says what is being pointed at');
}

function assertAxesRefuseHere(slice, where) {
    assertFootingNotRetired(slice, where);
    assertFootingNotRepegged(slice, where);
    assertCapNotConditioned(slice, where);
    assertNoBoundaryTriple(slice, where);

    assert.throws(() => assertFootingNotRetired(
        'The seat writes board.md, a file a public repository may carry.',
        where + '\'s retired-footing ablation'),
    /retired footing/, where + '\'s retired-footing ablation passed: the '
        + 'retired premise spelled with the board\'s own filename was '
        + 'accepted, so this axis\'s green proves nothing');
    assert.throws(() => assertFootingNotRetired(
        'What it briefs reaches a board a public GitHub project may carry.',
        where + '\'s retired-footing synonym ablation'),
    /retired footing/, where + '\'s retired-footing synonym ablation passed: '
        + 'the retired premise spelled with a container noun other than '
        + '"repository" was accepted, so this axis reaches only the two '
        + 'spellings the retired text happened to use');
    assert.throws(() => assertFootingNotRepegged(
        'The cap holds because the store\'s remote is private.',
        where + '\'s re-pegged-footing ablation'),
    /remote being private/, where + '\'s re-pegged-footing ablation passed: a '
        + 'private-remote premise was accepted, so this axis\'s green proves '
        + 'nothing');
    assert.throws(() => assertCapNotConditioned(
        'The first line carries what you would put on a public board only '
        + 'until the operator has answered the readership question for this '
        + 'store. Once they have, the seat\'s own judgement replaces the cap.',
        where + '\'s conditioned-cap ablation'),
    /conditions the public-board cap/, where + '\'s conditioned-cap ablation '
        + 'passed: text naming the cap and then making it contingent on the '
        + 'readership answer was accepted, so the relaxation vocabulary is '
        + 'not being read at all');
    // The second half of the window, exercised on its own. The ablation above
    // puts its relaxation in the same sentence as the cap, so it throws
    // before the following-sentence half is ever inspected and would stay
    // green if that half were deleted. Here the cap sentence is clean and the
    // relaxation sits only in the sentence after it, which is how a
    // "correction" to a paragraph of argued prose would most naturally be
    // written: the rule is left standing and a sentence is added beside it.
    assert.throws(() => assertCapNotConditioned(
        'The first line carries only what you would put on a public board. '
        + 'The cap does not apply once the operator has answered the '
        + 'readership question for this store.',
        where + '\'s following-sentence conditioned-cap ablation'),
    /conditions the public-board cap/, where + '\'s following-sentence '
        + 'conditioned-cap ablation passed: a clean cap sentence followed by '
        + 'a sentence relaxing it was accepted, so this axis reads only the '
        + 'sentence the cap sits in');
    assert.throws(() => assertFootingNotRepegged(
        'The store\'s sync replicates that line to every machine the '
        + 'configured remote serves, which is why the line is capped.',
        where + '\'s replication-premise ablation'),
    /grounds the public-board cap in the store replicating/, where
        + '\'s replication-premise ablation passed: a replication-shaped '
        + 'warrant was accepted, so the derivation this section retired could '
        + 'be added back beside the standard with the suite green');
    assert.throws(() => assertNoBoundaryTriple(
        'The line crosses the account, machine and person boundaries recorded '
        + 'there.', where + '\'s boundary-triple ablation'),
    /restates which boundaries/, where + '\'s boundary-triple ablation '
        + 'passed: a restated triple was accepted');
}

// The far end of the delegation. Each site names two surfaces and carries
// neither's content: docs/security-model.md for why readership is never what
// makes a board line safe, and the coordinator skill for the readership
// precondition and its unestablished default. Asserting the pointer's words
// and stopping there is the near end alone, and it goes green with the
// pointed-at standard reworded or gone, leaving three skills delegating to a
// surface that no longer answers. The fragments are distinctive rather than
// whole sentences, so ordinary editing of the surrounding prose does not
// redden them while a rewrite of the claim itself does.
function assertFootingSourcesCarryIt(where) {
    const root = path.join(__dirname, '..');
    const model = fs.readFileSync(path.join(root, 'docs', 'security-model.md'), 'utf8');
    assert.match(model, /independent of where the board lives/, 'docs/'
        + 'security-model.md no longer states that the public-board cap is '
        + 'independent of where the board lives, and ' + where + ' delegates '
        + 'its footing to that statement, as do the other two cap sites');
    assert.match(model, /moving the board somewhere quieter/, 'docs/'
        + 'security-model.md no longer states why the cap is put against a '
        + 'public board, that moving the board somewhere quieter never reads '
        + 'as relaxing it, and ' + where + ' delegates its footing to that '
        + 'statement, as do the other two cap sites');
    assert.match(model, /Readership is therefore never the thing that makes a board line safe/,
        'docs/security-model.md no longer carries the readership analysis '
        + 'the three cap sites point at, so each of them points at a document '
        + 'that no longer answers the question it sends a reader there with');

    const coordinator = fs.readFileSync(path.join(root, 'plugins',
        'claude-kit', 'skills', 'coordinator', 'SKILL.md'), 'utf8');
    assert.match(coordinator, /the board is written as a public surface/,
        'the coordinator skill no longer states what a seat does while the '
        + 'readership precondition is unestablished, and ' + where + ' names '
        + 'that skill as the owner of the precondition, as do the other two '
        + 'cap sites');
    assert.match(coordinator, /unestablished/, 'the coordinator skill no '
        + 'longer names the unestablished state of the readership '
        + 'precondition, which is the default state the three cap sites send '
        + 'a reader there to find');
    assertTrackedInIndex('docs/security-model.md');
    assertTrackedInIndex('plugins/claude-kit/skills/coordinator/SKILL.md');
}

function sliceBetween(body, startMark, endMark, where) {
    const start = body.indexOf(startMark);
    assert.ok(start !== -1, where + ' no longer opens with the lead this pin '
        + 'reads ("' + startMark + '"), so the slice has no near edge');
    const end = body.indexOf(endMark, start);
    assert.ok(end > start, where + ' is no longer followed by the landmark '
        + 'this pin bounds it with ("' + endMark + '"), so the slice has no '
        + 'far edge and would run past the paragraph it is about');
    return collapseWhitespace(body.slice(start, end));
}

function executingWorkBody() {
    return fs.readFileSync(path.join(__dirname, '..', 'plugins', 'claude-kit',
        'skills', 'executing-work', 'SKILL.md'), 'utf8');
}

function peerSessionsBody() {
    return fs.readFileSync(path.join(__dirname, '..', 'plugins', 'claude-kit',
        'skills', 'peer-sessions', 'SKILL.md'), 'utf8');
}

test('the expert-ask paragraph holds the cap as a standard, not as a reading of where the board sits', () => {
    const where = 'executing-work\'s expert-ask paragraph';
    const slice = sliceBetween(executingWorkBody(),
        '**Before any BLOCKED at all, the expert ask goes out',
        '**Before any BLOCKED that turns on a decision', where);
    assertCapStated(slice, where);
    assertAxesRefuseHere(slice, where);
    assertFootingStated(slice, where);
    assertFootingSourcesCarryIt(where);
});

test('the first-line paragraph holds the cap as a standard, not as a reading of where the board sits', () => {
    const where = 'executing-work\'s first-line paragraph';
    const slice = sliceBetween(executingWorkBody(),
        '**The first line carries only what you would put on a public board',
        'Waiting is the third stop shape', where);
    assertCapStated(slice, where);
    assertAxesRefuseHere(slice, where);
    assertFootingStated(slice, where);
    assertFootingSourcesCarryIt(where);
});

test('the Worker seat bullet holds the cap as a standard, not as a reading of where the board sits', () => {
    const where = 'peer-sessions\' Worker seat bullet';
    const slice = sliceBetween(peerSessionsBody(), '- **Worker.**',
        '- **Admin.**', where);
    assertCapStated(slice, where);
    assertAxesRefuseHere(slice, where);
    assertFootingStated(slice, where);
    assertFootingSourcesCarryIt(where);
});

// The absence-check clause is a deliberate three-surface restatement: the
// Dispatch Brief carries the implementer half, and both sighted charters carry
// the lens half, because an agent inherits no skills and cannot resolve a
// pointer. What a deliberate copy owes is a pin, which is the lesson Section 12
// of the review-and-record plan exists to record: a divergence survives a
// parity suite whose assertions never touch the diverging text. Both class
// sentences are pinned rather than one, because the clause closes two
// enumerations and an edit that reprices either class on one surface alone is
// exactly the drift this asserts against. The comparison runs on collapsed
// whitespace for a mechanical reason, not a stylistic one: the brief copy sits
// inside a fenced template that wraps it across lines at a 7-space indent, so a
// raw includes finds two of the three copies and would pass while the third
// said something else.
test('the absence-check clause states the same two classes on all three surfaces', () => {
    const surfaces = [
        ['skills', 'executing-work', 'SKILL.md'],
        ['agents', 'adversarial-reviewer.md'],
        ['agents', 'prose-reviewer.md'],
    ];
    const classSentences = [
        'the class is any check whose acceptance is a refusal, because a check '
            + 'that records only that something refused reports the same green '
            + 'whether the rule it was meant to exercise refused it or another '
            + 'rule refused it first',
        'the class is any check whose acceptance is an absence, because a '
            + 'predicate narrower than the class it guards reports the same clear '
            + 'verdict whether the state it was meant to detect is absent or '
            + 'merely unnamed',
    ];
    for (const parts of surfaces) {
        const rel = ['plugins', 'claude-kit', ...parts].join('/');
        const body = collapseWhitespace(fs.readFileSync(path.join(__dirname, '..',
            'plugins', 'claude-kit', ...parts), 'utf8'));
        for (const sentence of classSentences) {
            const hits = body.split(sentence).length - 1;
            assert.strictEqual(hits, 1, `${rel} carries the class sentence '`
                + `${sentence.slice(0, 60)}...' ${hits} times, not once; the `
                + 'absence-check clause is a deliberate three-surface copy, so '
                + 'either every surface states both classes identically or the '
                + 'copies have drifted');
        }
    }
});

// The fixture-evidence clause is a deliberate multi-surface restatement, and its
// two sentences have two different reaches on purpose. The diagnosis sentence is
// a reviewer duty, so it sits on the two sighted charters and deliberately not on
// the skill, whose job is counting independence rather than weighing a contract.
// The class sentence is the boundary itself and sits on all three, because a
// boundary stated two ways is exactly the drift this asserts against: the review
// round that produced this clause found the charters bounding the class at what
// the work "carries" while the skill bounded it at what the run "authored", which
// are different sets. Compared on collapsed whitespace for the same reason the
// absence-check pin below uses it, since both sentences wrap across lines.
test('the fixture-evidence clause states the same class across its surfaces', () => {
    const diagnosis = 'A fixture is an assertion by its author about what the '
        + 'code should do, never in itself a statement of a contract, and where '
        + 'no owning surface states the contract the fixture claims, the contract '
        + 'is unstated and the fixture is a proposal rather than the source.';
    const classSentence = 'Fixtures, stubs, golden files, sample payloads, and '
        + 'generated files are instances rather than the boundary: the class is '
        + 'any artifact this effort authored, cited as evidence of a fact the '
        + 'effort does not own.';
    const charters = [
        ['agents', 'adversarial-reviewer.md'],
        ['agents', 'prose-reviewer.md'],
    ];
    const allThree = charters.concat([['skills', 'responding-to-review', 'SKILL.md']]);
    const bodyOf = (parts) => collapseWhitespace(fs.readFileSync(path.join(
        __dirname, '..', 'plugins', 'claude-kit', ...parts), 'utf8'));
    for (const parts of charters) {
        const rel = ['plugins', 'claude-kit', ...parts].join('/');
        const hits = bodyOf(parts).split(diagnosis).length - 1;
        assert.strictEqual(hits, 1, rel + ' states the fixture diagnosis sentence '
            + hits + ' times, not once; both sighted charters carry it verbatim, '
            + 'so either they agree or one reviewer half has drifted');
    }
    for (const parts of allThree) {
        const rel = ['plugins', 'claude-kit', ...parts].join('/');
        const hits = bodyOf(parts).split(classSentence).length - 1;
        assert.strictEqual(hits, 1, rel + ' states the fixture class sentence '
            + hits + ' times, not once; the class boundary is single-sourced '
            + 'across all three surfaces, and a surface stating it differently is '
            + 'the reviewer and the orchestrator disagreeing about what counts as '
            + 'evidence this effort authored');
    }
});

// The index-window bullet is a two-copy restatement like every doctrine bullet,
// and the byte-identity assertion above already holds the two copies together.
// What identity cannot see is both copies losing the same leg at once, which is
// the shape any later amendment to the staging rule would take. Two legs are
// pinned rather than the whole bullet: the lead, which carries the claim that the
// index is a window rather than a resting place, and the merge clause, whose
// plain-form command under-reports on a merge commit and so goes quiet for the
// wrong reason at exactly the point a swept peer file would land.
test('the index-window bullet keeps both of its legs in each doctrine copy', () => {
    const legs = [
        ['the window lead', 'On a checkout another session may commit to, the '
            + 'index is a window rather than a resting place.'],
        ['the merge-listing clause', 'and `git show --first-parent --name-only` '
            + 'for a merge, whose plain form shows the combined diff and omits '
            + 'every path that merged cleanly from one side'],
    ];
    const copies = [
        ['home/claude-kit-doctrine.md',
            path.join(__dirname, '..', 'home', 'claude-kit-doctrine.md')],
        ['plugins/claude-kit/skills/operating-instructions/SKILL.md',
            path.join(__dirname, '..', 'plugins', 'claude-kit', 'skills',
                'operating-instructions', 'SKILL.md')],
    ];
    for (const [rel, abs] of copies) {
        const body = collapseWhitespace(fs.readFileSync(abs, 'utf8'));
        for (const [name, leg] of legs) {
            const hits = body.split(leg).length - 1;
            assert.strictEqual(hits, 1, rel + ' carries ' + name + ' ' + hits
                + ' times, not once; both doctrine copies state the index-window '
                + 'rule, and the byte-identity assertion cannot see both copies '
                + 'dropping the same leg together');
        }
    }
});

// The owning-surface enumeration is the third deliberate three-surface copy this
// clause carries, and it is pinned because its drift is demonstrated rather than
// hypothetical: the review round that produced this clause found the list shipped
// documents-only on all three surfaces, with the tool leg missing, which put it in
// direct conflict with the tool-printed-claims rule sitting one bullet above it on
// both charters. The class sentence is pinned rather than the member list, since
// the members are instances by their own admission and the boundary is the thing
// two surfaces must not state differently.
test('the owning-surface class sentence is one sentence on all three surfaces', () => {
    const classSentence = 'Those surfaces are instances rather than the boundary: '
        + 'the owning surface is wherever the fact\'s own producer defines it, '
        + 'never a copy that restates it.';
    const surfaces = [
        ['agents', 'adversarial-reviewer.md'],
        ['agents', 'prose-reviewer.md'],
        ['skills', 'responding-to-review', 'SKILL.md'],
    ];
    for (const parts of surfaces) {
        const rel = ['plugins', 'claude-kit', ...parts].join('/');
        const body = collapseWhitespace(fs.readFileSync(path.join(__dirname, '..',
            'plugins', 'claude-kit', ...parts), 'utf8'));
        const hits = body.split(classSentence).length - 1;
        assert.strictEqual(hits, 1, rel + ' states the owning-surface class '
            + 'sentence ' + hits + ' times, not once; the list of owning surfaces '
            + 'is instances and this sentence is its boundary, so a surface that '
            + 'drops or reworks it is the one that will quietly lose a leg, as the '
            + 'tool leg was lost from the enumeration itself');
    }
});

// The coverage-answer clause is a deliberate five-surface rule in three
// registers, so this pins each surface's own wording rather than byte-identity.
// Two registers carry it: the skill and the two doctrine copies share the
// operative phrases verbatim, and the two sighted charters state the same duty
// in the reviewer's voice. Four legs run, because the rule has parts that
// drift separately. The operative leg holds the coverage answer in the
// register the skill and the doctrine share, and the charter leg holds the
// same duty in the reviewer's voice. The discriminator leg spans all five,
// because the phrase it carries decides the rule's outcome rather than how a
// surface says it: what the pattern was handed is what separates a control
// that proved the instrument from one that proved coverage. The verdict leg
// carries that phrase through to what it concludes, over the three surfaces
// that share a spelling for it, because a presence pin greens on a rewrite
// that keeps the phrase and inverts its verdict. The downgrade gate rides on
// the charter leg rather than the five-surface one: it fires on a class that
// can be neither enumerated nor shaped rather than on a missing shape alone,
// and a charter stating it one clause narrower than the surfaces that own it
// would have a reviewer flag work that followed the doctrine exactly. What
// makes the pin necessary is that the doctrine copies joined the set last and a
// key-phrase grep run from the charters would have missed them: the review round
// that produced this clause found the doctrine copies shipping "neither listed
// nor shaped" and "a member you could not have listed" against the three
// surfaces' "neither enumerated nor shaped" and "a member you did not name",
// with both parity suites green, because they compare the doctrine copies only
// to each other and never to the skill that owns the rule.
test('the coverage-answer clause reaches every surface carrying the absence-check duty', () => {
    const operative = [
        'what would catch a member you did not name',
        'a structural pattern over the class\'s shape where one exists',
        'neither enumerated nor shaped',
    ];
    const paths = [
        ['plugins/claude-kit/skills/executing-work/SKILL.md',
            path.join(__dirname, '..', 'plugins', 'claude-kit', 'skills',
                'executing-work', 'SKILL.md')],
        ['home/claude-kit-doctrine.md',
            path.join(__dirname, '..', 'home', 'claude-kit-doctrine.md')],
        ['plugins/claude-kit/skills/operating-instructions/SKILL.md',
            path.join(__dirname, '..', 'plugins', 'claude-kit', 'skills',
                'operating-instructions', 'SKILL.md')],
    ];
    for (const [rel, p] of paths) {
        const body = collapseWhitespace(fs.readFileSync(p, 'utf8'));
        for (const phrase of operative) {
            const hits = body.split(phrase).length - 1;
            assert.strictEqual(hits, 1, rel + ' carries the '
                + 'coverage-answer phrase \'' + phrase + '\' ' + hits + ' times, '
                + 'not once; the skill and both doctrine copies state this duty '
                + 'in one shared wording on purpose, so a surface that drops it '
                + 'or restates it in its own words has drifted from the owner');
        }
    }

    const charterDuty = [
        'a structural pattern over that class\'s shape where one exists',
    ];
    for (const charter of ['adversarial-reviewer.md', 'prose-reviewer.md']) {
        const body = collapseWhitespace(fs.readFileSync(path.join(__dirname, '..',
            'plugins', 'claude-kit', 'agents', charter), 'utf8'));
        for (const phrase of charterDuty) {
            const hits = body.split(phrase).length - 1;
            assert.strictEqual(hits, 1, charter + ' carries the reviewer-register '
                + 'coverage duty \'' + phrase.slice(0, 50) + '...\' ' + hits
                + ' times, not once; a reviewer that stops asking whether a '
                + 'control proved coverage is the backstop this rule leans on');
        }
    }

    const discriminator = ['a string the pattern was handed'];
    const charterPaths = [
        ['plugins/claude-kit/agents/adversarial-reviewer.md',
            path.join(__dirname, '..', 'plugins', 'claude-kit', 'agents',
                'adversarial-reviewer.md')],
        ['plugins/claude-kit/agents/prose-reviewer.md',
            path.join(__dirname, '..', 'plugins', 'claude-kit', 'agents',
                'prose-reviewer.md')],
    ];
    for (const [rel, p] of paths.concat(charterPaths)) {
        const body = collapseWhitespace(fs.readFileSync(p, 'utf8'));
        for (const phrase of discriminator) {
            const hits = body.split(phrase).length - 1;
            assert.strictEqual(hits, 1, rel + ' carries the discriminator '
                + 'phrase \'' + phrase + '\' ' + hits + ' times, not once; '
                + 'all five surfaces decide the same two questions, so one that '
                + 'drops a phrase is licensing the opposite call from its '
                + 'siblings: crediting a control the others discount, or '
                + 'downgrading a class a complete enumeration already swept');
        }
    }

    for (const [rel, p] of charterPaths) {
        const body = collapseWhitespace(fs.readFileSync(p, 'utf8'));
        const phrase = 'neither enumerated nor shaped';
        const hits = body.split(phrase).length - 1;
        assert.strictEqual(hits, 1, rel + ' gates the honest downgrade on '
            + '\'' + phrase + '\' ' + hits + ' times, not once; a charter that '
            + 'gates it on a missing shape alone downgrades a class a complete '
            + 'enumeration already swept, and flags as unproven the work that '
            + 'followed the surfaces owning this rule');
    }

    const verdict = 'a string the pattern was handed, is coverage evidence too';
    for (const [rel, p] of [paths[0]].concat(charterPaths)) {
        const body = collapseWhitespace(fs.readFileSync(p, 'utf8'));
        const hits = body.split(verdict).length - 1;
        assert.strictEqual(hits, 1, rel + ' carries the discriminator through '
            + 'to its verdict ' + hits + ' times, not once; pinning the phrase '
            + 'alone greens on a rewrite that keeps it and concludes the opposite, '
            + 'so the token and the call it licenses are pinned together');
    }
});

// The paragraph-edit-unit rule has one owner and one operational residue, and
// the residue is what a fix round actually reads, since executing-work is loaded
// at that moment and writing-skills may not be. Both halves are pinned, and so
// is the pointer's path shape: the round that landed this shipped the residue
// carrying a repo-root-relative literal, which resolves only inside this
// checkout and names nothing under a marketplace install or an external engine's
// payload, and no existing assertion could see it.
test('the paragraph-edit-unit rule keeps its owner and its pointer, and the pointer resolves', () => {
    const writingSkills = collapseWhitespace(fs.readFileSync(path.join(__dirname,
        '..', 'plugins', 'claude-kit', 'skills', 'writing-skills', 'SKILL.md'), 'utf8'));
    const owner = 'When an amendment corrects a claim a curated document states, '
        + 'the edit unit is the paragraph, never the sentence.';
    assert.strictEqual(writingSkills.split(owner).length - 1, 1,
        'writing-skills no longer states the paragraph-edit-unit rule exactly '
        + 'once; it is the owning surface, so a second copy or none at all both '
        + 'leave the residue in executing-work pointing at nothing');

    const executingWork = collapseWhitespace(fs.readFileSync(path.join(__dirname,
        '..', 'plugins', 'claude-kit', 'skills', 'executing-work', 'SKILL.md'), 'utf8'));
    assert.ok(executingWork.includes('takes the paragraph as its edit unit rather '
        + 'than the sentence, and carries the claim\'s other carriers with it, per '
        + 'the writing-skills skill (`skills/writing-skills/SKILL.md` under the kit '
        + 'plugin root)'),
        'executing-work\'s fix-round step no longer carries the paragraph-edit-unit '
        + 'residue pointing at the writing-skills skill by its plugin-root path, so '
        + 'an orchestrator correcting curated prose between review rounds gets the '
        + 'rule from nowhere');

    assert.ok(!executingWork.includes('plugins/claude-kit/skills/writing-skills/'),
        'executing-work names the writing-skills skill by a repo-root-relative '
        + 'path, which resolves only inside this checkout: under a marketplace '
        + 'install or an external engine\'s --plugin-dir payload the plugin root '
        + 'holds skills/ directly and that path names nothing');
});

// session-start.js composes its Additional Context payload from a fixed set of
// blocks, and that set's size is restated on two surfaces outside the code that
// produces it: the hook's own file header and docs/architecture.md's
// SessionStart bullet. A count restated on a sibling surface is an invariant
// nothing checks, which git merges clean and no diff-reading review catches, so
// both restatements are read here against the source (docs/ is read, never
// written).
//
// The count is derived rather than asserted at a literal. The emitters are the
// blocks.push sites; two pairs of them are the mutually exclusive if/else
// branches of one block each, the backlog block (a full reading or the bound it
// hit) and the shared-checkout advisory (the sibling count or a transcript
// store that could not be listed), so the blocks number two fewer than the
// emitters. The pairing is the one figure a reader has to re-derive when this
// reddens: a new emitter moves the emitter assertion first, and its message
// says what to re-derive before the prose is touched.
const SESSION_START_BLOCK_PAIRS = 2;
const NUMBER_WORDS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven',
    'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen',
    'sixteen', 'seventeen', 'eighteen', 'nineteen', 'twenty'];

test('session-start.js\'s block count is stated the same by the code, its header, and docs/architecture.md', () => {
    const hookPath = path.join(__dirname, '..', 'plugins', 'claude-kit', 'hooks', 'session-start.js');
    const hook = fs.readFileSync(hookPath, 'utf8');

    const emitters = (hook.match(/\bblocks\.push\(/g) || []).length;
    assert.strictEqual(emitters, 14,
        'session-start.js now holds ' + emitters + ' blocks.push sites rather than 14. '
        + 'Re-derive how many distinct blocks that is (an emitter pair that is the '
        + 'if/else of one block counts once), then move this pin, the hook\'s file '
        + 'header, and docs/architecture.md\'s SessionStart bullet together');
    const blocks = emitters - SESSION_START_BLOCK_PAIRS;
    const word = NUMBER_WORDS[blocks];
    assert.ok(word, 'the derived block count ' + blocks + ' is past this pin\'s number words');

    // The control for the two absence-shaped reads below: the same word lookup
    // over the count the source actually derives is what each surface is
    // searched for, so a surface that fails is one stating a different count
    // rather than one this pin cannot read.
    assert.strictEqual(word, NUMBER_WORDS[12],
        'the derived count is no longer twelve, so the two prose surfaces below '
        + 'state a stale figure until they are moved with it');

    // The header is a comment block, so it is read with its line markers
    // stripped and its whitespace collapsed: the two figures below wrap across
    // lines, and a raw substring test would read a wrap as a stale count.
    const header = collapseWhitespace(hook.split(/\r?\n/).slice(0, 40)
        .filter((l) => l.startsWith('//'))
        .map((l) => l.replace(/^\/\/ ?/, ''))
        .join(' '));
    assert.ok(header.includes('composes ' + word + ' blocks in all'),
        'session-start.js\'s own file header no longer states its payload at '
        + word + ' blocks, which is what the source composes');
    assert.ok(header.includes('the emitters number ' + NUMBER_WORDS[emitters]),
        'session-start.js\'s file header no longer states its emitter count at '
        + NUMBER_WORDS[emitters] + ', the number of blocks.push sites in the file');

    const architecture = fs.readFileSync(path.join(__dirname, '..', 'docs', 'architecture.md'), 'utf8');
    const bullet = architecture.split(/\r?\n/).find((l) => l.includes('runs `session-start.js`'));
    assert.ok(bullet, 'docs/architecture.md no longer carries a SessionStart bullet naming '
        + 'session-start.js; this pin reads that line as a count-restating surface');
    assert.ok(bullet.includes('(' + word + ' blocks:'),
        'docs/architecture.md\'s SessionStart bullet states a block count other than '
        + word + ', which is what session-start.js composes: ' + bullet.slice(0, 200));
});

// The gate cadence prices each moment at a lane, and the failure mode it
// produces is a procedural step that performs a gate-earning action while
// naming no lane at the point of action: the reader executes the step, the
// closing default hands it the targeted lane by silence, and a moment that
// earns the whole gate is skipped with nothing to redden. The pins below carry
// that duty for the surfaces that perform those actions, rather than for the
// surfaces that describe the cadence, which the doctrine pins above already
// cover.
//
// The first is structural over a family rather than over a list of names: the
// commit-model bullets under each skill's "Apply the commit model" step are
// found by their shape, so a commit model added later is pinned the day it is
// written, without anyone remembering this file exists. A bullet that pushes
// is what the cadence prices, so that is the predicate; a bullet that stages
// and stops (Review-Only) performs no push and is exempt by the same reading
// rather than by an exception list.
const COMMIT_MODEL_LEAD = /^\s*\d+\.\s+\*\*Apply the commit model/;
// A push, not the commit model's own name: "Commit-and-Push" and "pre-push"
// both carry the substring, and a bullet selected or cleared by its own label
// is selected or cleared by nothing.
const PUSH_ACTION = /(?<![-\w])push/i;
const LANE_NAMED = /whole gate|targeted lane|contention lane|install surface/i;

// The extractor reports nothing rather than reporting the wrong block, which
// is the only failure mode a caller can act on: an empty array is truthy, so a
// null guard over one never fires, and a scan that runs on past the step it
// was anchored to asserts over prose that has nothing to do with commit
// models. So it returns null both when the anchor is gone and when the scan
// reaches the next numbered step without finding a bullet.
//
// It also joins a bullet's continuation lines before returning it. Markdown
// wraps a long bullet across physical lines as an ordinary authoring shape, so
// an extractor keeping only each bullet's first line drops any bullet whose
// push sits on the continuation, and a dropped bullet is silently exempt from
// every assertion below.
function commitModelBullets(relPath) {
    const lines = readRepoFile(relPath).split(/\r?\n/);
    const lead = lines.findIndex((l) => COMMIT_MODEL_LEAD.test(l));
    if (lead === -1) return null;
    const bullets = [];
    for (let i = lead + 1; i < lines.length; i++) {
        const line = lines[i];
        if (/^\s*- \*\*/.test(line)) { bullets.push(line.trim()); continue; }
        if (!bullets.length) {
            if (/^\s*\d+\.\s+\*\*/.test(line)) return null;
            continue;
        }
        if (line.trim() === '') break;
        bullets[bullets.length - 1] += ' ' + line.trim();
    }
    return bullets.length ? bullets : null;
}

test('every commit-model bullet that pushes names the lane that push takes', () => {
    for (const relPath of [
        'plugins/claude-kit/skills/executing-work/SKILL.md',
        'plugins/claude-kit/skills/finishing-work/SKILL.md',
    ]) {
        const bullets = commitModelBullets(relPath);
        assert.ok(bullets, relPath + ' yields no commit-model bullets: either the '
            + 'step led "Apply the commit model" is gone, which is the anchor this '
            + 'pin finds them by, or the step no longer carries bullets under it. '
            + 'Move the pin with the step rather than dropping it');
        // The instrument leg: three commit models ship, so an extractor that
        // silently found none or one would otherwise pass by having nothing to
        // assert over, which reads exactly like a clean sweep.
        assert.ok(bullets.length >= 3, relPath + ' yields ' + bullets.length
            + ' commit-model bullets rather than the three that ship, so this '
            + 'pin is reading the wrong block and its silence means nothing');
        const pushing = bullets.filter((b) => PUSH_ACTION.test(b));
        assert.ok(pushing.length >= 2, relPath + ' yields ' + pushing.length
            + ' commit-model bullets that push, where Branch-and-PR and '
            + 'Commit-and-Push both do, so the predicate no longer selects the '
            + 'bullets it exists to check');
        for (const bullet of pushing) {
            const name = (bullet.match(/- \*\*([^:*]+)/) || [, bullet.slice(0, 40)])[1];
            // The lane has to sit in the same sentence as the push, not merely
            // somewhere in the bullet. A bullet is several hundred words long,
            // so a presence check over the whole of one passes on a lane named
            // for an entirely different action: "the whole gate already ran
            // earlier, so tag the release and push the tag to origin" carries
            // both words and gates nothing. What this pairing still cannot
            // decide is whether a lane named in the push's own sentence is the
            // lane for that push, since prose can claim a gate ran elsewhere;
            // what it catches is the lane word floating in another sentence.
            const paired = sentencesOf(bullet).some((s) => PUSH_ACTION.test(s)
                && LANE_NAMED.test(s));
            assert.ok(paired, 'the ' + name.trim() + ' bullet in ' + relPath
                + ' performs a push and no sentence of it names that push\'s '
                + 'lane, so a session reading it takes the closing default and '
                + 'pushes on the targeted lane. A push to a trunk consumers '
                + 'install from earns the whole gate, and a push to a PR branch '
                + 'does not: whichever it is, the bullet says so in the sentence '
                + 'where the push happens');
        }
    }
});

// The contention lane sits apart from the main gate and runs serially, so a
// full-suite run does not contain it. The finishing pass runs every whole gate
// the cadence names and had no surface saying so, which is a green suite
// handing off with the machine-shared tests unrun.
test('the finishing pass names the contention lane at the gates it runs', () => {
    const finishing = fs.readFileSync(path.join(__dirname, '..', 'plugins',
        'claude-kit', 'skills', 'finishing-work', 'SKILL.md'), 'utf8');
    assert.match(finishing, /contention lane runs beside each of them, and beside every other whole gate this pass runs/,
        'finishing-work no longer states that the contention lane runs beside '
        + 'the handoff gate and every other whole gate the pass runs, so the '
        + 'pass reads a green full suite as covering tests it never ran');
    // Per bullet rather than by a count over the file: a count is satisfied by
    // the phrase appearing anywhere, so adding it in one paragraph while
    // deleting it from a bullet holds the total and the guard goes quiet for
    // the wrong reason. The subject is the bullets, so the assertion is over
    // the bullets, the way the sibling pin above already reads them.
    const bullets = commitModelBullets('plugins/claude-kit/skills/finishing-work/SKILL.md');
    assert.ok(bullets, 'finishing-work yields no commit-model bullets, so this '
        + 'pin is asserting over nothing rather than over the gates its commit '
        + 'models run');
    for (const bullet of bullets.filter((b) => /whole gate/i.test(b))) {
        const name = (bullet.match(/- \*\*([^:*]+)/) || [, bullet.slice(0, 40)])[1];
        assert.match(bullet, /contention lane beside it/, 'the ' + name.trim()
            + ' bullet in finishing-work runs a whole gate and does not name the '
            + 'contention lane beside it. That lane sits apart from the main gate '
            + 'and runs serially, so a full-suite run does not contain it and the '
            + 'bullet hands off with the machine-shared tests unrun');
    }
    const verifier = fs.readFileSync(path.join(__dirname, '..', 'plugins',
        'claude-kit', 'agents', 'qa-verifier.md'), 'utf8');
    assert.match(verifier, /^CONTENTION LANE:/m,
        'the qa-verifier\'s report format no longer carries a contention-lane '
        + 'line, so the agent that runs the handoff gate has nowhere to report '
        + 'the lane it was asked to run and the omission reads as a clean pass');
});

// The handoff gate is the one run that reads the whole tree: every section
// closed on a lane scoped to its own files. Its counts therefore have exactly
// one carrier, and the final Chapter is it.
test('the final Chapter records the handoff gate the way a section Chapter records its own', () => {
    const finishing = readRepoFile('plugins/claude-kit/skills/finishing-work/SKILL.md');
    const step = sliceBetween(finishing, '5. **Close and archive the plan doc.**',
        '6. **Apply the commit model.**', 'finishing-work\'s step 5');
    assert.match(step, /carries a `Gate:` line/,
        'the step that writes the final Chapter no longer asks it for a Gate '
        + 'line, so the one gate covering the whole tree leaves no counts behind '
        + 'and a later collateral-red diagnosis has nothing to read');
    // The shape is asked for by pointing at the section Chapter's template
    // rather than by a copy here, because the copy this step shipped dropped
    // three qualifiers the template carries, the no-baseline-exists escape
    // among them, which is the one the handoff gate needs first.
    assert.match(step, /same shape a section Chapter's does[^.]{0,200}Chapter template/,
        'finishing-work\'s step 5 no longer routes the final Chapter\'s Gate '
        + 'shape to executing-work\'s Chapter template. A restatement here is a '
        + 'second authority that drifts, and the drift lands as a shorter list '
        + 'than the template asks for');
    // The ordering is the pin's real subject: this step rewrites the plan doc,
    // archives it, prunes the backlog and refreshes the index, all of which a
    // repo's suite may read, so a Chapter carrying counts written before those
    // edits reports a gate that never saw the shipped tree, and amending it
    // after the gate makes the tree one edit newer than its evidence.
    assert.match(step, /`Gate:` line left open/,
        'finishing-work\'s step 5 no longer says the final Chapter is written '
        + 'with its Gate line left open. Without that order the Chapter carries '
        + 'counts from a run that has not happened, since this step changes the '
        + 'tree after the Chapter is appended');
    assert.match(step, /one edit permitted after the gate/,
        'finishing-work\'s step 5 no longer names filling the Gate line as the '
        + 'one edit permitted after the gate, so any other post-gate edit reads '
        + 'as equally allowed and the shipped tree ends up newer than the run '
        + 'that cleared it');
    assert.ok(step.includes('records a run that has already happened and changes nothing that run read'),
        'finishing-work\'s step 5 no longer states why the Gate-line fill is '
        + 'the safe exception. The reason is the rule: an edit that adds a '
        + 'record of the run is safe where one that changes what the run read '
        + 'is not, and without it the exception reads as an arbitrary carve-out');
});

// The section Chapter's template is where that shape lives, so the duty
// phrases the two surfaces once shared are asserted there instead: this is the
// same drift the exitCodeDuty constant exists to catch, moved to the surface
// that still states the shape.
test('the Chapter template still states the Gate shape both Chapters are written to', () => {
    const template = executingWorkBody().split(/\r?\n/)
        .find((l) => l.startsWith('Gate: <'));
    assert.ok(template, 'executing-work\'s Chapter template no longer carries a '
        + 'Gate line, which finishing-work\'s final Chapter now points at for '
        + 'its own shape rather than restating it');
    for (const [phrase, why] of [
        [exitCodeDuty, 'the exit code read from the run itself, which is what '
            + 'keeps the field a value rather than an attestation'],
        [lanePluralDuty, 'more than one lane, while the contention lane runs '
            + 'beside the targeted one and a whole gate can run beside both'],
        ['no baseline exists on it', 'the escape hatch a writer hits first, '
            + 'since the run covering the whole tree is the one least likely to '
            + 'have a prior baseline on its lane'],
    ]) {
        assert.ok(template.includes(phrase), 'the Chapter template\'s Gate line '
            + 'no longer asks for ' + why + ' ("' + phrase + '"). '
            + 'finishing-work\'s step 5 points at this line for the final '
            + 'Chapter\'s shape, so what drops here drops from both');
    }
});

// The contention lane's counts have two ends and both are pinned, because
// either one alone produces a report that reads clean: the agent that runs the
// lane cannot discover it (the lane's commands are per-repo facts in a memory
// tier no subagent is given), and the dispatch that knows it has to say so.
test('the contention lane reaches the qa-verifier from the dispatch, and the charter says how to run it', () => {
    const finishing = readRepoFile('plugins/claude-kit/skills/finishing-work/SKILL.md');
    const step = sliceBetween(finishing, '1. **QA verification.**',
        '2. **Security review.**', 'finishing-work\'s step 1');
    assert.match(step, /brief carries the contention lane's own command, or states that this repo defines none/,
        'finishing-work\'s step 1 no longer passes the contention lane\'s '
        + 'command, or its absence, to the qa-verifier. The agent has no way to '
        + 'discover the lane, so an omitted one comes back as NONE DEFINED and '
        + 'reads exactly like a repo that defines no such lane');

    const verifier = readRepoFile('plugins/claude-kit/agents/qa-verifier.md');
    assert.match(verifier, /^CONTENTION LANE:/m,
        'the qa-verifier\'s report format no longer carries a contention-lane '
        + 'line, so the agent that runs the handoff gate has nowhere to report '
        + 'the lane it was asked to run and the omission reads as a clean pass');
    // The format alone is not the duty: a report line with no process behind
    // it is filled from whatever the agent did, so deleting the instruction
    // leaves the format green and the lane unrun.
    assert.match(verifier, /after the suite has completed, never concurrently with it/,
        'the qa-verifier\'s Tests step no longer tells the agent to run the '
        + 'contention lane after the suite completes. Run concurrently, the two '
        + 'reproduce the contention the lane exists to avoid, and the charter is '
        + 'the only surface that says so');
    assert.match(verifier, /`NONE DEFINED` carries its evidence/,
        'the qa-verifier\'s Tests step no longer requires evidence behind a '
        + 'NONE DEFINED, so the report\'s default answer is indistinguishable '
        + 'from a genuine no-lane repo, which is the clean pass this line exists '
        + 'to prevent');
});

// The pins above read the surfaces this plan already knew about. This one is
// the generator fix: it derives the family from the tree rather than from a
// list of names, so the next procedure that grows a gate-earning git
// integration action reddens when it is written instead of waiting for a
// reviewer to notice it.
//
// The unit is the physical line, which in these files is a paragraph or a
// bullet. The predicate is a git integration action reaching a remote or a
// trunk: the verb next to its object, or the plumbing spelled out, rather than
// a list of the phrasings that happen to ship today, so a step written in
// vocabulary this file never saw is still selected on its shape. What the
// predicate cannot see is an action phrased without any of those objects
// ("publish the branch upstream"), so the sweep covers the shape rather than
// the class of every possible spelling, and it says so here rather than
// reporting a clean sweep it has not earned.
//
// The duty is a lane named, or an exemption stated, in the same paragraph. The
// exemptions below are paragraphs that describe an action rather than perform
// one, or whose action is performed and gated elsewhere; each carries its rule
// so a later reader can tell an exemption from an oversight, and a stale entry
// reddens rather than going quiet, since an entry matching nothing is asserted
// against.
const INTEGRATION_ACTION = new RegExp([
    '\\bgit (?:push|merge|pull|cherry-pick)\\b',
    '(?<![-\\w])(?:push|pushes|pushing|merge|merges|merging|cherry-pick|cherry-picks|cherry-picking)'
        + '\\b[^.`]{0,50}?\\b(?:to origin|to main|to master|to the trunk|the branch|the recovery branch|the tag|onto)\\b',
    '(?<![-\\w])(?:committed and pushed|commit and push|push and open)\\b',
    '\\b(?:is|runs|takes) Commit-and-Push\\b',
].join('|'), 'i');
// A lane named, and never a paragraph's assertion that it owes none. A
// no-gate claim is exactly the thing this sweep exists to adjudicate, so it
// clears only through INTEGRATION_EXEMPT, where the paragraph is anchored and
// its rule is written down beside it. Read as a clearing phrase instead, the
// claim certifies itself: any line performing an integration passes by
// carrying the words, with no rule stated anywhere and nothing to redden.
// What stays honest about the rest of the list is stated rather than implied:
// these are lane words, so a match is presence of the words in the line and
// never proof that the lane named is the one that action takes.
const GATE_STATED = /whole gate|targeted lane|contention lane|install surface/i;

const INTEGRATION_EXEMPT = [
    ['skills/brainstorming/SKILL.md', 'land it on main and leave no mess',
        'names the commit model for a plan header; the push it describes is '
        + 'executing-work step 7\'s, which names that push\'s lane where it happens'],
    ['skills/branch-hygiene/SKILL.md', 'Branch fresh from the current integration ref',
        'the stranded-recovery path\'s gate is an open operator decision in '
        + 'docs/backlog.md: a cherry-pick onto a fresh base produces a tree '
        + 'neither parent had, and whether that is the cadence\'s merge moment '
        + 'is a change to the cadence rather than a carrier repair'],
    ['skills/branch-hygiene/SKILL.md', 'Bring the commits over',
        'same recovery path, same open decision'],
    ['skills/branch-hygiene/SKILL.md', 'Push the recovery branch',
        'same recovery path; the push lands on a recovery branch rather than on '
        + 'an install-surface trunk, so only the cherry-pick\'s own status is open'],
    ['skills/coordinator/SKILL.md', 'never a seat-chosen one and never an environment-overridden one',
        'the durability override defines the carve-out rather than performing an '
        + 'integration: the words the predicate selects sit in the precondition '
        + 'stating which root a background process was ever authorized to commit '
        + 'and push, which is a bound on an act rather than a step that performs '
        + 'one. The act itself is the store sync\'s, exempted with its gate at the '
        + 'board-write entry below'],
    ['skills/coordinator/SKILL.md', 'A seat that resolves the store-push grant can close the first of those two itself',
        'the commit and push are the store-push carve-out\'s, and they land in '
        + 'the kit memory store, a repository of its own that no suite reads '
        + 'and that nobody installs from, so the pre-push condition cannot fire '
        + 'on it. What gates that push is the store\'s own screen rather than a '
        + 'lane: the durability override states the path as the sync script run '
        + 'by hand, whose one run commits through the allowlist and its leak '
        + 'probes, screens every inbound tree entry before the rebase, and, '
        + 'where that fetch brought commits in, re-derives the whole bar before '
        + 'it pushes; with nothing incoming the push rides the bar derived at '
        + 'the top of the run, one fetch older and otherwise the same bar. That '
        + 'is why the carve-out opens no bare-git commit that would route '
        + 'around them'],
    ['skills/executing-work/SKILL.md', 'pushes the section to origin with no later human gate',
        'a subordinate clause about notifying the operator, referring to step '
        + '7\'s push; step 7 names that push\'s lane'],
    ['skills/finishing-work/SKILL.md', 'Then report the store\'s sync state',
        'the push lands in the kit memory store, a repository of its own that '
        + 'no suite reads and that nobody installs from, so the pre-push '
        + 'condition cannot fire on it'],
    ['skills/kaizen/SKILL.md', 'Per-machine files mean three workstations',
        'describes the sync mechanism; the pull is performed at step 1 of the '
        + 'pass, which names its lane'],
    ['skills/kaizen/SKILL.md', 'the rule is what the push can break rather than the path it lands on',
        'the capture push runs no gate, and the exemption is the one class of '
        + 'claim this sweep adjudicates rather than clears: it holds only while '
        + 'the branch delta is the note commit alone, an appended line to an '
        + 'inbox no test takes as a subject, and the paragraph states that '
        + 'condition and the check that establishes it. A delta carrying '
        + 'anything else is a different push and takes the lane its own surface '
        + 'earns'],
    ['skills/operating-instructions/SKILL.md', 'the index is a window rather than a resting place',
        'a doctrine bullet on staging and the commit window rather than a '
        + 'procedure that pushes; the lane a push takes is the gate bullet\'s, '
        + 'in this same document'],
    ['skills/operating-instructions/SKILL.md', 'Name the rollback and stop for a yes',
        'a doctrine bullet on authorization for outward actions, same document '
        + 'and same gate bullet'],
];

function shippedKitMarkdown() {
    const root = path.join(__dirname, '..', 'plugins', 'claude-kit');
    const files = [];
    const walk = (dir) => {
        for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
            const full = path.join(dir, entry.name);
            if (entry.isDirectory()) { walk(full); continue; }
            // claude-kit-doctrine.md at the plugin root is gitignored build
            // output regenerated by the doctrine-refresh hook, not a shipped
            // surface anyone edits.
            if (entry.name === 'claude-kit-doctrine.md' && dir === root) continue;
            if (entry.name.endsWith('.md')) files.push(full);
        }
    };
    walk(root);
    return files;
}

test('every kit procedure performing a git integration names that action\'s lane or states its exemption', () => {
    // The instrument's controls, run before its silence is read. Two positives
    // built on the predicate's shape rather than on a phrasing the tree
    // already carries, one of them in vocabulary these literals do not name;
    // one negative, so a pin that simply matched any git prose would fail here
    // rather than certifying itself.
    for (const control of [
        '4. **Ship the fleet manifest.** Once the manifest is written, commit and push to origin.',
        'Then bring the fix across by cherry-picking it onto the release ref.',
    ]) {
        assert.ok(INTEGRATION_ACTION.test(control), 'the sweep\'s predicate no '
            + 'longer selects a gate-earning integration step ("' + control
            + '"), so its silence over the tree means nothing');
        assert.ok(!GATE_STATED.test(control), 'the sweep\'s control paragraph '
            + 'names a lane, so it cannot show that an unnamed one is caught');
    }
    assert.ok(INTEGRATION_ACTION.test('Ship it: run the whole gate with the '
        + 'contention lane beside it, then push to origin.')
        && GATE_STATED.test('run the whole gate with the contention lane beside it'),
        'the sweep no longer passes a paragraph that performs an integration '
        + 'and names its lane, so it cannot tell a named action from an unnamed one');
    assert.ok(!INTEGRATION_ACTION.test('A local branch is auto-reaped only if '
        + 'it is verified merged into the integration branch.'),
        'the sweep\'s predicate now selects a paragraph that describes a merged '
        + 'branch without performing an integration, so its hits are git prose '
        + 'rather than gate-earning actions');
    // The self-exempting control, in the shape the clearing branch is most
    // easily widened back into: a paragraph that performs an integration and
    // asserts its own exemption in the same breath. It is selected and not
    // cleared, so it reaches the unnamed list and reddens unless a maintainer
    // anchors it in INTEGRATION_EXEMPT with its rule. A clearing phrase that
    // admitted such a claim would let every paragraph in the tree exempt
    // itself by saying so.
    const selfExempting = 'Then commit and push to origin; that push takes no gate.';
    assert.ok(INTEGRATION_ACTION.test(selfExempting)
        && !GATE_STATED.test(selfExempting),
        'a paragraph asserting its own exemption now clears the sweep in '
        + 'content, so the one claim this sweep exists to adjudicate certifies '
        + 'itself: the exemption belongs in INTEGRATION_EXEMPT, anchored on the '
        + 'paragraph and carrying its rule, where a later reader can tell it '
        + 'from an oversight and a stale entry reddens');

    const exemptHits = new Map(INTEGRATION_EXEMPT.map(([f, anchor]) => [f + '|' + anchor, 0]));
    const unnamed = [];
    for (const file of shippedKitMarkdown()) {
        const rel = path.relative(path.join(__dirname, '..', 'plugins', 'claude-kit'), file)
            .replace(/\\/g, '/');
        readRepoFile('plugins/claude-kit/' + rel).split(/\r?\n/).forEach((line, i) => {
            if (!INTEGRATION_ACTION.test(line)) return;
            const exempt = INTEGRATION_EXEMPT.find(([f, anchor]) => f === rel && line.includes(anchor));
            if (exempt) { exemptHits.set(rel + '|' + exempt[1], exemptHits.get(rel + '|' + exempt[1]) + 1); return; }
            if (GATE_STATED.test(line)) return;
            unnamed.push(rel + ':' + (i + 1) + ' ' + line.trim().slice(0, 120));
        });
    }
    assert.deepStrictEqual(unnamed, [], 'a kit procedure performs a git '
        + 'integration and its paragraph names no lane and states no exemption, '
        + 'so a session executing it takes the closing default and gates a merge '
        + 'or an install-surface push at the targeted lane. Name the lane where '
        + 'the action happens, or state the exemption with its rule and add it '
        + 'to INTEGRATION_EXEMPT above:\n' + unnamed.join('\n'));
    for (const [key, count] of exemptHits) {
        assert.ok(count > 0, 'the exemption for ' + key + ' matches nothing in '
            + 'the tree, so it is a stale entry silently widening what this '
            + 'sweep skips. Remove it, or point it at the paragraph it means');
    }
});
