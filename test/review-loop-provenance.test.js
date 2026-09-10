// A cross-component pin over the review-loop provenance mechanism: the
// trace: field two reviewer charters carry on their output line and one
// omits, the executing-work Chapter template's Metrics: line that reports
// provenance, the "five review rounds" backstop lead's single occurrence,
// the scope-adjudicator seat's classification and its consult trigger's
// wording, and the five hand-copied rosters that must all know the new
// seat. Each of the six checks below is a pure function over file text (or a
// small text map), returning null on success or a string naming the file and
// the defect; subject 4 is the one exception, taking the loaded identity
// module rather than its text, since the class is what the module resolves.
// Each has a mutation control that runs the same function over a copy, one
// written under a temp directory or an in-memory copy of the real text, never
// against the tree, and asserts the failure names the mutated subject.
//
// Node's built-in test runner, no framework (Node v24). Every raw read tolerates
// CRLF (`\r?\n`), since every file this pin reads is CRLF on this checkout.

'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const REPO = path.join(__dirname, '..');
const ADVERSARIAL_FILE = path.join(REPO, 'plugins', 'claude-kit', 'agents', 'adversarial-reviewer.md');
const SECURITY_FILE = path.join(REPO, 'plugins', 'claude-kit', 'agents', 'security-reviewer.md');
const BLIND_FILE = path.join(REPO, 'plugins', 'claude-kit', 'agents', 'blind-reviewer.md');
const EXECUTING_WORK_FILE = path.join(REPO, 'plugins', 'claude-kit', 'skills', 'executing-work', 'SKILL.md');
const IDENTITY_LIB_FILE = path.join(REPO, 'plugins', 'claude-kit', 'hooks', 'kit-agent-identity-lib.js');
const CONSULT_FILE = path.join(REPO, 'plugins', 'claude-kit', 'skills', 'consult', 'SKILL.md');
const READONLY_GUARD_TEST_FILE = path.join(REPO, 'test', 'readonly-agent-guard.test.js');
const MEMORY_NUDGE_TEST_FILE = path.join(REPO, 'test', 'memory-recognition-nudge.test.js');

// A fresh temp directory per control, removed in `finally`, so a mutated copy
// never touches the tree. path.join is used on every value this file owns
// (the directory and the fixed basename); nothing derived from probe or file
// text is ever joined into a path.
function withTempCopy(basename, mutatedText, fn) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rlp-'));
    try {
        const file = path.join(dir, basename);
        fs.writeFileSync(file, mutatedText, 'utf8');
        return fn(file);
    } finally {
        fs.rmSync(dir, { recursive: true, force: true });
    }
}

// ---------------------------------------------------------------------------
// Subject 1: the output line's trace: field.
//
// The three reviewer charters each print their finding format inside a fenced
// code block whose first line begins `[CRITICAL|MAJOR|MINOR]`. The adversarial
// and security charters' output line carries a trace: field; the blind
// charter's does not, since the blind lens never sees the plan. The check
// locates that specific line rather than searching the whole file, because
// the sighted charters also carry a prose sentence that mentions `trace:` on
// its own line, which a whole-file search would wrongly credit.

function findOutputLine(text) {
    const lines = text.split(/\r?\n/);
    return lines.find((l) => l.trim().startsWith('[CRITICAL|MAJOR|MINOR]')) || null;
}

function checkOutputLineTrace(text, label, expectTrace) {
    const line = findOutputLine(text);
    if (line === null) return `${label}: no output line found (a line starting "[CRITICAL|MAJOR|MINOR]")`;
    const hasTrace = /\btrace:/.test(line);
    if (expectTrace && !hasTrace) return `${label}: output line carries no trace: field`;
    if (!expectTrace && hasTrace) return `${label}: output line unexpectedly carries a trace: field`;
    return null;
}

test('the adversarial and security output lines carry trace:, the blind output line does not', () => {
    assert.strictEqual(checkOutputLineTrace(fs.readFileSync(ADVERSARIAL_FILE, 'utf8'), 'adversarial-reviewer.md', true), null);
    assert.strictEqual(checkOutputLineTrace(fs.readFileSync(SECURITY_FILE, 'utf8'), 'security-reviewer.md', true), null);
    assert.strictEqual(checkOutputLineTrace(fs.readFileSync(BLIND_FILE, 'utf8'), 'blind-reviewer.md', false), null);
});

// Withheld control: a temp copy of a sighted charter with trace: stripped
// from the output line alone, leaving the prose sentence below it (which
// also says "trace:") untouched. A check that searched the whole file for
// the string "trace:" would wrongly pass this copy; the real check must fail
// it because it reads the output line specifically.
test('control: a sighted charter missing trace: on its output line fails, even though its prose still says trace:', () => {
    const original = fs.readFileSync(ADVERSARIAL_FILE, 'utf8');
    const lines = original.split(/\r?\n/);
    const idx = lines.findIndex((l) => l.trim().startsWith('[CRITICAL|MAJOR|MINOR]'));
    assert.ok(idx >= 0, 'test fixture assumption: adversarial-reviewer.md carries an output line');
    lines[idx] = lines[idx].replace(/\[trace:[^\]]*\]\s?/, '');
    assert.doesNotMatch(lines[idx], /\btrace:/, 'test fixture assumption: the trace bracket was removable from the output line');
    const proseLine = lines.find((l) => l.includes('The `trace:` field is required'));
    assert.ok(proseLine, 'test fixture assumption: the prose sentence naming trace: must still be present');
    const mutated = lines.join('\r\n');

    withTempCopy('adversarial-reviewer.md', mutated, (file) => {
        const result = checkOutputLineTrace(fs.readFileSync(file, 'utf8'), 'adversarial-reviewer.md', true);
        assert.ok(result, 'a sighted charter with no trace: on its output line must fail the check');
        assert.match(result, /adversarial-reviewer\.md/, 'the failure must name the mutated file');
    });
});

// Second control: a blind copy with trace: inserted onto its output line
// must fail the absence half of the check.
test('control: a blind charter with trace: inserted on its output line fails the absence check', () => {
    const original = fs.readFileSync(BLIND_FILE, 'utf8');
    const lines = original.split(/\r?\n/);
    const idx = lines.findIndex((l) => l.trim().startsWith('[CRITICAL|MAJOR|MINOR]'));
    assert.ok(idx >= 0, 'test fixture assumption: blind-reviewer.md carries an output line');
    lines[idx] = lines[idx].replace('[CRITICAL|MAJOR|MINOR]', '[CRITICAL|MAJOR|MINOR] [trace: none]');
    const mutated = lines.join('\r\n');

    withTempCopy('blind-reviewer.md', mutated, (file) => {
        const result = checkOutputLineTrace(fs.readFileSync(file, 'utf8'), 'blind-reviewer.md', false);
        assert.ok(result, 'a blind charter with trace: inserted on its output line must fail the check');
        assert.match(result, /blind-reviewer\.md/, 'the failure must name the mutated file');
    });
});

// ---------------------------------------------------------------------------
// Subject 2: the Chapter format's Metrics: template line carries the
// provenance tokens beside the round count it always carried.

const METRICS_TOKENS = ['provenance', 'spec-traceable', 'fix-introduced', 'new-requirement', 'consults <n>'];

function checkMetricsLine(text, label) {
    const line = (text.split(/\r?\n/)).find((l) => l.startsWith('Metrics:'));
    if (line === undefined) return `${label}: no Metrics: template line found`;
    const missing = METRICS_TOKENS.filter((tok) => !line.includes(tok));
    if (missing.length > 0) return `${label}: Metrics: line is missing ${missing.join(', ')}`;
    return null;
}

test('the Chapter format\'s Metrics: line carries the four provenance tokens and still consults <n>', () => {
    assert.strictEqual(checkMetricsLine(fs.readFileSync(EXECUTING_WORK_FILE, 'utf8'), 'executing-work/SKILL.md'), null);
});

test('control: a Metrics: line missing one provenance token fails, naming the token', () => {
    const original = fs.readFileSync(EXECUTING_WORK_FILE, 'utf8');
    const lines = original.split(/\r?\n/);
    const idx = lines.findIndex((l) => l.startsWith('Metrics:'));
    assert.ok(idx >= 0, 'test fixture assumption: executing-work/SKILL.md carries the Metrics: template line');
    assert.ok(lines[idx].includes('fix-introduced'), 'test fixture assumption: the line carries fix-introduced');
    lines[idx] = lines[idx].replace('fix-introduced', 'fix-INTRODUCED-MUTATED');
    const mutated = lines.join('\r\n');

    withTempCopy('SKILL.md', mutated, (file) => {
        const result = checkMetricsLine(fs.readFileSync(file, 'utf8'), 'executing-work/SKILL.md');
        assert.ok(result, 'a Metrics: line missing a provenance token must fail the check');
        assert.match(result, /fix-introduced/, 'the failure must name the missing token');
    });
});

// ---------------------------------------------------------------------------
// Subject 3: the backstop's two numbers each have one carrier in the kit's
// skill text. The opening bound is the phrase "five review rounds", which
// occurs exactly once across every skill file and sits in executing-work,
// in a paragraph whose lead ordinal ("fifth") moves with it. The
// post-continue bound is the one backticked word before "further rounds"
// in that paragraph's restart sentence, which likewise occurs exactly once
// across every skill file. The scan reads every plugins/claude-kit/skills/
// */SKILL.md and every skills/*/references/*.md rather than executing-work
// alone, since a restatement in a sibling skill or in a reference file is
// exactly what the single-carrier contract forbids: kit-size.js classes
// both as skill corpus.

const SKILLS_DIR = path.join(REPO, 'plugins', 'claude-kit', 'skills');
const EXECUTING_WORK_KEY = 'executing-work/SKILL.md';

// Returns a map of "<skill>/SKILL.md" and "<skill>/references/<file>" to its
// text, over every skill directory and every markdown file under its
// references/ directory.
function readSkillTexts() {
    const texts = {};
    for (const name of fs.readdirSync(SKILLS_DIR)) {
        const file = path.join(SKILLS_DIR, name, 'SKILL.md');
        if (fs.existsSync(file)) texts[name + '/SKILL.md'] = fs.readFileSync(file, 'utf8');
        const refs = path.join(SKILLS_DIR, name, 'references');
        if (!fs.existsSync(refs)) continue;
        for (const ref of fs.readdirSync(refs)) {
            if (!ref.endsWith('.md')) continue;
            texts[name + '/references/' + ref] = fs.readFileSync(path.join(refs, ref), 'utf8');
        }
    }
    return texts;
}

// Counts a carrier pattern across the skill map and requires exactly one
// occurrence, sitting in executing-work. pattern is a global regex.
function checkSingleCarrier(texts, pattern, label) {
    const hits = [];
    let total = 0;
    for (const [key, text] of Object.entries(texts)) {
        const n = (text.match(pattern) || []).length;
        if (n > 0) { hits.push(key + ' x' + n); total += n; }
    }
    if (total !== 1) return label + ': occurs ' + total + ' time(s) across the skill tree (' + (hits.join(', ') || 'nowhere') + '), expected exactly 1';
    if (!hits[0].startsWith(EXECUTING_WORK_KEY)) return label + ': the one occurrence sits in ' + hits[0] + ', not in ' + EXECUTING_WORK_KEY;
    return null;
}

const OPENING_BOUND = /five review rounds/g;
const POST_CONTINUE_BOUND = /`[a-z0-9]+` further rounds/g;

function checkFiveReviewRoundsOnce(texts) {
    const carrier = checkSingleCarrier(texts, OPENING_BOUND, '"five review rounds"');
    if (carrier) return carrier;
    // The lead ordinal shares the paragraph with the count, so the two move
    // together: find the paragraph (one markdown line) carrying the phrase
    // and require "fifth" on the same line.
    const line = texts[EXECUTING_WORK_KEY].split(/\r?\n/).find((l) => l.includes('five review rounds'));
    if (!line.includes('fifth')) return EXECUTING_WORK_KEY + ': the paragraph carrying "five review rounds" no longer carries the lead ordinal "fifth"';
    return null;
}

function checkPostContinueBoundOnce(texts) {
    return checkSingleCarrier(texts, POST_CONTINUE_BOUND, 'the post-continue carrier (a backticked word before "further rounds")');
}

test('"five review rounds" occurs exactly once across the skill tree, in executing-work, beside its lead ordinal', () => {
    assert.strictEqual(checkFiveReviewRoundsOnce(readSkillTexts()), null);
});

test('the post-continue bound\'s backticked carrier occurs exactly once across the skill tree, in executing-work', () => {
    assert.strictEqual(checkPostContinueBoundOnce(readSkillTexts()), null);
});

// The controls mutate the in-memory map rather than a file on disk, since the
// check reads a map; each is built from the real texts and changed in one
// place, so what the check reads is the tree as it stands but for the one
// mutation.
test('control: removing the phrase drops the count to 0 and fails', () => {
    const texts = readSkillTexts();
    const mutated = texts[EXECUTING_WORK_KEY].replace('five review rounds', 'REMOVED-MUTATED');
    assert.notStrictEqual(mutated, texts[EXECUTING_WORK_KEY], 'test fixture assumption: the phrase must be present and replaceable');
    texts[EXECUTING_WORK_KEY] = mutated;
    const result = checkFiveReviewRoundsOnce(texts);
    assert.ok(result, 'a tree with the phrase removed must fail the check');
    assert.match(result, /occurs 0 time/, 'the failure must report the count as 0');
});

test('control: a second occurrence in a sibling skill raises the count to 2 and fails, naming the sibling', () => {
    const texts = readSkillTexts();
    const sibling = Object.keys(texts).find((k) => k !== EXECUTING_WORK_KEY);
    assert.ok(sibling, 'test fixture assumption: the tree holds at least one other skill');
    texts[sibling] = texts[sibling] + '\r\nfive review rounds\r\n';
    const result = checkFiveReviewRoundsOnce(texts);
    assert.ok(result, 'a tree with a second occurrence must fail the check');
    assert.match(result, /occurs 2 time/, 'the failure must report the count as 2');
    assert.ok(result.includes(sibling), 'the failure must name the sibling skill carrying the restatement');
});

// The class the scan claims is the skill corpus, SKILL.md files and their
// reference files alike; the sibling-SKILL.md control above plants its
// instance in the set the directory walk names by construction, so this one
// plants it in a reference file, the member a SKILL.md-only walk misses.
test('control: a second occurrence in a reference file raises the count to 2 and fails, naming the file', () => {
    const texts = readSkillTexts();
    const ref = Object.keys(texts).find((k) => k.includes('/references/'));
    assert.ok(ref, 'test fixture assumption: the tree holds at least one skill reference file');
    texts[ref] = texts[ref] + '\r\nfive review rounds\r\n';
    const r1 = checkFiveReviewRoundsOnce(texts);
    assert.ok(r1 && /occurs 2 time/.test(r1) && r1.includes(ref), 'a restated count in a reference file must fail naming the file and the count 2');
    const again = readSkillTexts();
    again[ref] = again[ref] + '\r\na continue buys `three` further rounds\r\n';
    const r2 = checkPostContinueBoundOnce(again);
    assert.ok(r2 && /occurs 2 time/.test(r2) && r2.includes(ref), 'a restated post-continue bound in a reference file must fail naming the file and the count 2');
});

test('control: the lead ordinal dropped from the backstop paragraph fails, with the count still 1', () => {
    const texts = readSkillTexts();
    const lines = texts[EXECUTING_WORK_KEY].split(/\r?\n/);
    const idx = lines.findIndex((l) => l.includes('five review rounds'));
    assert.ok(idx >= 0 && lines[idx].includes('fifth'), 'test fixture assumption: the paragraph carries both the count and the ordinal');
    lines[idx] = lines[idx].replace(/fifth/g, 'ORDINAL-MUTATED');
    texts[EXECUTING_WORK_KEY] = lines.join('\r\n');
    const result = checkFiveReviewRoundsOnce(texts);
    assert.ok(result, 'a paragraph whose ordinal no longer matches its count must fail the check');
    assert.match(result, /lead ordinal "fifth"/, 'the failure must name the ordinal');
});

test('control: a restated post-continue bound in a sibling skill fails, and a removed one fails', () => {
    const texts = readSkillTexts();
    const sibling = Object.keys(texts).find((k) => k !== EXECUTING_WORK_KEY);
    const restated = { ...texts, [sibling]: texts[sibling] + '\r\na continue buys `three` further rounds\r\n' };
    const r1 = checkPostContinueBoundOnce(restated);
    assert.ok(r1 && /occurs 2 time/.test(r1) && r1.includes(sibling), 'a restatement must fail naming the sibling and the count 2');
    const removed = { ...texts, [EXECUTING_WORK_KEY]: texts[EXECUTING_WORK_KEY].replace(POST_CONTINUE_BOUND, 'REMOVED-MUTATED') };
    assert.notStrictEqual(removed[EXECUTING_WORK_KEY], texts[EXECUTING_WORK_KEY], 'test fixture assumption: the carrier must be present and replaceable');
    const r2 = checkPostContinueBoundOnce(removed);
    assert.ok(r2 && /occurs 0 time/.test(r2), 'a removed carrier must fail with the count 0');
});

// ---------------------------------------------------------------------------
// Subject 4: reviewAgentClass resolves the namespaced scope-adjudicator to
// 'strict' and a merely-containing name to null. The control re-requires a
// temp copy of the library file with scope-adjudicator removed from the
// alternation, so Node's per-path module cache never masks the mutation.

function checkReviewAgentClass(lib) {
    if (lib.reviewAgentClass('claude-kit:scope-adjudicator') !== 'strict') {
        return 'kit-agent-identity-lib.js: reviewAgentClass("claude-kit:scope-adjudicator") did not resolve to "strict"';
    }
    if (lib.reviewAgentClass('scope-adjudicator-helper') !== null) {
        return 'kit-agent-identity-lib.js: reviewAgentClass("scope-adjudicator-helper") did not resolve to null';
    }
    return null;
}

test('reviewAgentClass resolves claude-kit:scope-adjudicator to strict and scope-adjudicator-helper to null', () => {
    const lib = require(IDENTITY_LIB_FILE);
    assert.strictEqual(checkReviewAgentClass(lib), null);
});

test('control: a copy with scope-adjudicator removed from the alternation fails to resolve it', () => {
    const original = fs.readFileSync(IDENTITY_LIB_FILE, 'utf8');
    assert.match(original, /\|scope-adjudicator\)/, 'test fixture assumption: scope-adjudicator sits in the strict alternation');
    const mutated = original.replace('|scope-adjudicator)', ')');

    withTempCopy('kit-agent-identity-lib-mutated.js', mutated, (file) => {
        delete require.cache[require.resolve(file)];
        const lib = require(file);
        const result = checkReviewAgentClass(lib);
        assert.ok(result, 'a library with scope-adjudicator removed from the alternation must fail the check');
        assert.match(result, /did not resolve to "strict"/, 'the failure must report the strict resolution as broken');
    });
});

// ---------------------------------------------------------------------------
// Subject 5: consult/SKILL.md's trigger (a) names "design stop" within its
// own bullet, not merely somewhere in the file.

function checkTriggerANamesDesignStop(text, label) {
    const lines = text.split(/\r?\n/);
    const idx = lines.findIndex((l) => l.trim().startsWith('- **(a)'));
    if (idx === -1) return `${label}: no "- **(a)" trigger bullet found`;
    if (!lines[idx].includes('design stop')) return `${label}: trigger (a) does not name "design stop"`;
    return null;
}

test('consult/SKILL.md\'s trigger (a) names "design stop"', () => {
    assert.strictEqual(checkTriggerANamesDesignStop(fs.readFileSync(CONSULT_FILE, 'utf8'), 'consult/SKILL.md'), null);
});

test('control: replacing "design stop" inside trigger (a) fails', () => {
    const original = fs.readFileSync(CONSULT_FILE, 'utf8');
    const lines = original.split(/\r?\n/);
    const idx = lines.findIndex((l) => l.trim().startsWith('- **(a)'));
    assert.ok(idx >= 0, 'test fixture assumption: consult/SKILL.md carries the (a) trigger bullet');
    assert.ok(lines[idx].includes('design stop'), 'test fixture assumption: the (a) bullet names design stop');
    lines[idx] = lines[idx].replace(/design stop/g, 'DESIGN-STOP-MUTATED');
    const mutated = lines.join('\r\n');

    withTempCopy('SKILL.md', mutated, (file) => {
        const result = checkTriggerANamesDesignStop(fs.readFileSync(file, 'utf8'), 'consult/SKILL.md');
        assert.ok(result, 'a trigger (a) bullet with "design stop" replaced must fail the check');
        assert.match(result, /does not name "design stop"/);
    });
});

// ---------------------------------------------------------------------------
// Subject 5b: consult/SKILL.md's trigger (b) points at the review-round
// backstop's substitution and at the step 4 paragraph that owns its
// conditions, within its own bullet, so the two surfaces governing that
// moment cannot fall out of step silently in either direction.

function checkTriggerBPointsAtBackstop(text, label) {
    const lines = text.split(/\r?\n/);
    const idx = lines.findIndex((l) => l.trim().startsWith('- **(b)'));
    if (idx === -1) return label + ': no "- **(b)" trigger bullet found';
    if (!/review-round backstop/.test(lines[idx])) return label + ': trigger (b) does not name the review-round backstop';
    if (!/step 4/.test(lines[idx])) return label + ': trigger (b) does not point at step 4';
    if (!/substitution/.test(lines[idx])) return label + ': trigger (b) does not name the substitution';
    return null;
}

test('consult/SKILL.md\'s trigger (b) points at the backstop substitution and its step 4 paragraph', () => {
    assert.strictEqual(checkTriggerBPointsAtBackstop(fs.readFileSync(CONSULT_FILE, 'utf8'), 'consult/SKILL.md'), null);
});

test('control: dropping the backstop pointer from trigger (b) fails naming what went, and a pointer moved out of the bullet fails too', () => {
    const original = fs.readFileSync(CONSULT_FILE, 'utf8');
    const lines = original.split(/\r?\n/);
    const idx = lines.findIndex((l) => l.trim().startsWith('- **(b)'));
    assert.ok(idx >= 0, 'test fixture assumption: consult/SKILL.md carries the (b) trigger bullet');
    for (const [needle, expect] of [['review-round backstop', /review-round backstop/], ['step 4', /step 4/], ['substitution', /substitution/]]) {
        assert.ok(lines[idx].includes(needle), 'test fixture assumption: the (b) bullet carries ' + needle);
        const mutated = lines.slice();
        mutated[idx] = mutated[idx].split(needle).join('POINTER-MUTATED');
        withTempCopy('SKILL.md', mutated.join('\r\n'), (file) => {
            const result = checkTriggerBPointsAtBackstop(fs.readFileSync(file, 'utf8'), 'consult/SKILL.md');
            assert.ok(result, 'a (b) bullet without "' + needle + '" must fail the check');
            assert.match(result, expect, 'the failure must name what went');
        });
    }
    // The pointer sitting in a neighbouring bullet rather than in (b) is the
    // same failure: the check reads the (b) line alone.
    const moved = lines.slice();
    const clause = moved[idx].slice(moved[idx].indexOf(" Executing-work's review-round backstop"));
    assert.ok(clause.length > 0, 'test fixture assumption: the pointer clause opens with the backstop');
    moved[idx] = moved[idx].slice(0, moved[idx].length - clause.length);
    moved[idx + 1] = moved[idx + 1] + clause;
    withTempCopy('SKILL.md', moved.join('\r\n'), (file) => {
        const result = checkTriggerBPointsAtBackstop(fs.readFileSync(file, 'utf8'), 'consult/SKILL.md');
        assert.ok(result && /does not name the review-round backstop/.test(result), 'a pointer moved out of the (b) bullet must fail the check');
    });
});

// ---------------------------------------------------------------------------
// Subject 6: the hand-copied rosters know every strict seat. Five lists in
// two test files enumerate the strict seats by name, and each is located by
// the test title it sits under, never by line number. The roster is not a
// literal here: it is derived from the strict alternation in
// kit-agent-identity-lib.js, the one source the guard and the nudge both
// classify from, so a seat added there and forgotten in a roster reddens
// this pin rather than passing green. Three of the lists enumerate the whole
// class and take every derived name; the other two are partial by their
// nature (a containing-name control list and an effort-pin map that pins
// only the seats the skills cite an effort for) and take the one name this
// section added. The deny list carries each seat in two spellings, bare and
// namespaced, and both are asserted as quoted literals, since a substring
// match would read the bare entry off the tail of the namespaced one.

const STRICT_ALTERNATION = /\(\?:([a-z-|]+)\)\$\/i\.test\(type\)\) return 'strict'/;

function strictSeatsFrom(libText) {
    const m = STRICT_ALTERNATION.exec(libText);
    if (!m) return null;
    return m[1].split('|');
}

const DENY_LIST_TITLE = 'all ten judgment agents resolve to the strict class, namespaced or bare';
const CONTAINING_NAME_TITLE = 'a type that merely contains a judgment agent name is not governed';
const NO_WRITE_TOOL_TITLE = 'the governed agents are granted no file-writing tool';
const EFFORT_PIN_TITLE = 'the reviewers, the consultant and the scope adjudicator pin the effort the skills cite as their frontmatter default';
const STAND_DOWN_TITLE = 'a dispatch of a read-only judgment seat receives no pointer, where a gate and an implementer do';

// Locates the test('<title>', () => { ... }); call by its title line and
// reads forward to the matching top-level }); tracking brace depth so a
// nested }); inside the body never ends the scan early. Returns the split
// line array together with the start and end (inclusive) line indices, so a
// caller can both read the body and splice a mutated replacement back into
// the same array without a string-search-and-replace that a CRLF/LF mismatch
// between the split and the original text could silently miss.
function findTestBodyRange(text, title) {
    const lines = text.split(/\r?\n/);
    const startIdx = lines.findIndex((l) => l.includes("test('" + title + "'") || l.includes('test("' + title + '"'));
    if (startIdx === -1) return null;
    let depth = 0;
    let started = false;
    let endIdx = startIdx;
    for (let i = startIdx; i < lines.length; i++) {
        for (const ch of lines[i]) {
            if (ch === '{') { depth++; started = true; }
            else if (ch === '}') depth--;
        }
        endIdx = i;
        if (started && depth <= 0) break;
        // A brace inside a string, a template or a regex is counted as
        // structure, so a column-zero "});" bounds the scan whatever the
        // count says: no test body in these files runs past its own close.
        if (i > startIdx && /^\}\);\s*$/.test(lines[i])) break;
    }
    return { lines, startIdx, endIdx };
}

function findTestBody(text, title) {
    const range = findTestBodyRange(text, title);
    return range === null ? null : range.lines.slice(range.startIdx, range.endIdx + 1).join('\n');
}

// Asserts each quoted spelling in spellings appears in the named test's
// body. label names the list for the failure message.
function checkRosterCarries(text, title, label, spellings) {
    const body = findTestBody(text, title);
    if (body === null) return label + ': test titled "' + title + '" not found';
    const missing = spellings.filter((s) => !body.includes(s));
    if (missing.length > 0) return label + ': ' + missing.join(', ') + ' not found in the test body';
    return null;
}

// The whole-class check over the three lists that enumerate the class: every
// seat the alternation names, in the spellings each list quotes.
function checkRostersCarryEverySeat(libText, guardTestText, nudgeTestText) {
    const seats = strictSeatsFrom(libText);
    if (seats === null) return 'kit-agent-identity-lib.js: the strict alternation was not found';
    const quoted = seats.map((n) => "'" + n + "'");
    const namespaced = seats.map((n) => "'claude-kit:" + n + "'");
    return checkRosterCarries(guardTestText, DENY_LIST_TITLE, 'readonly-agent-guard.test.js: the per-name deny list', [...quoted, ...namespaced])
        || checkRosterCarries(guardTestText, NO_WRITE_TOOL_TITLE, 'readonly-agent-guard.test.js: the no-file-writing-tool list', quoted)
        || checkRosterCarries(nudgeTestText, STAND_DOWN_TITLE, 'memory-recognition-nudge.test.js: the stand-down list', quoted);
}

// The one-name check over the two partial lists.
function checkPartialRostersCarryTheSeat(guardTestText) {
    return checkRosterCarries(guardTestText, CONTAINING_NAME_TITLE, 'readonly-agent-guard.test.js: the containing-name control list', ["'scope-adjudicator-helper'"])
        || checkRosterCarries(guardTestText, EFFORT_PIN_TITLE, 'readonly-agent-guard.test.js: the effort-pin map', ["'scope-adjudicator': 'high'"]);
}

test('every seat in the strict alternation appears, in both spellings where the list quotes both, in the three whole-class rosters', () => {
    const seats = strictSeatsFrom(fs.readFileSync(IDENTITY_LIB_FILE, 'utf8'));
    assert.ok(seats && seats.includes('scope-adjudicator'), 'test fixture assumption: the alternation names scope-adjudicator');
    assert.strictEqual(checkRostersCarryEverySeat(
        fs.readFileSync(IDENTITY_LIB_FILE, 'utf8'),
        fs.readFileSync(READONLY_GUARD_TEST_FILE, 'utf8'),
        fs.readFileSync(MEMORY_NUDGE_TEST_FILE, 'utf8')), null);
});

test('the containing-name control list and the effort-pin map carry scope-adjudicator', () => {
    assert.strictEqual(checkPartialRostersCarryTheSeat(fs.readFileSync(READONLY_GUARD_TEST_FILE, 'utf8')), null);
});

// Withheld control: a seat the rosters were never handed. A temp copy of the
// library gains a name no roster carries, and the check over the real
// rosters must fail naming that seat, which is what proves the derivation
// reaches a member nobody named rather than the one this section added.
test('control: a seat added to the alternation and to no roster fails, naming the seat and the first list missing it', () => {
    const lib = fs.readFileSync(IDENTITY_LIB_FILE, 'utf8');
    assert.match(lib, /\|scope-adjudicator\)/, 'test fixture assumption: scope-adjudicator closes the alternation');
    const mutatedLib = lib.replace('|scope-adjudicator)', '|scope-adjudicator|zz-withheld-seat)');
    const result = checkRostersCarryEverySeat(mutatedLib,
        fs.readFileSync(READONLY_GUARD_TEST_FILE, 'utf8'),
        fs.readFileSync(MEMORY_NUDGE_TEST_FILE, 'utf8'));
    assert.ok(result, 'an alternation naming a seat no roster carries must fail the check');
    assert.match(result, /'zz-withheld-seat'/, 'the failure must name the withheld seat');
    assert.match(result, /per-name deny list/, 'the failure must name the first list missing it');
});

// Rebuilds the whole file with one test's body lines replaced by the result
// of applying transformLine to each of them, rejoined with \r\n throughout so
// the mutated copy matches this checkout's own line-ending convention.
function withMutatedTestBody(text, title, transformLine) {
    const range = findTestBodyRange(text, title);
    assert.ok(range, 'test fixture assumption: a test titled "' + title + '" must be found');
    const mutatedLines = range.lines.slice();
    for (let i = range.startIdx; i <= range.endIdx; i++) {
        mutatedLines[i] = transformLine(mutatedLines[i]);
    }
    return mutatedLines.join('\r\n');
}

test('control: deleting only the bare deny-list entry fails naming the bare spelling, the namespaced entry still present', () => {
    const original = fs.readFileSync(READONLY_GUARD_TEST_FILE, 'utf8');
    const mutated = withMutatedTestBody(original, DENY_LIST_TITLE,
        (line) => line.replace(/'scope-adjudicator',\s*/, ''));
    assert.notStrictEqual(mutated, original, 'test fixture assumption: the bare entry was present and removable');
    assert.match(mutated, /'claude-kit:scope-adjudicator'/, 'test fixture assumption: the namespaced entry survives');
    withTempCopy('readonly-agent-guard.test.js', mutated, (file) => {
        const result = checkRostersCarryEverySeat(fs.readFileSync(IDENTITY_LIB_FILE, 'utf8'),
            fs.readFileSync(file, 'utf8'), fs.readFileSync(MEMORY_NUDGE_TEST_FILE, 'utf8'));
        assert.ok(result, 'a deny list missing the bare spelling must fail the check');
        assert.match(result, /per-name deny list: 'scope-adjudicator' not found/, 'the failure must name the bare spelling and the list');
    });
});

test('control: removing scope-adjudicator from the no-file-writing-tool list fails naming that list', () => {
    const original = fs.readFileSync(READONLY_GUARD_TEST_FILE, 'utf8');
    const mutated = withMutatedTestBody(original, NO_WRITE_TOOL_TITLE,
        (line) => line.replace(/,\s*'scope-adjudicator'/, ''));
    assert.notStrictEqual(mutated, original, 'test fixture assumption: the entry was present and removable');
    withTempCopy('readonly-agent-guard.test.js', mutated, (file) => {
        const result = checkRostersCarryEverySeat(fs.readFileSync(IDENTITY_LIB_FILE, 'utf8'),
            fs.readFileSync(file, 'utf8'), fs.readFileSync(MEMORY_NUDGE_TEST_FILE, 'utf8'));
        assert.ok(result, 'a no-file-writing-tool list missing a seat must fail the check');
        assert.match(result, /no-file-writing-tool list: 'scope-adjudicator' not found/, 'the failure must name the list');
    });
});

test('control: removing scope-adjudicator from the memory-recognition-nudge stand-down list fails', () => {
    const original = fs.readFileSync(MEMORY_NUDGE_TEST_FILE, 'utf8');
    const mutated = withMutatedTestBody(original, STAND_DOWN_TITLE,
        (line) => line.replace(/,\s*'scope-adjudicator'/, ''));
    assert.notStrictEqual(mutated, original, 'test fixture assumption: the entry was present and removable');
    withTempCopy('memory-recognition-nudge.test.js', mutated, (file) => {
        const result = checkRostersCarryEverySeat(fs.readFileSync(IDENTITY_LIB_FILE, 'utf8'),
            fs.readFileSync(READONLY_GUARD_TEST_FILE, 'utf8'), fs.readFileSync(file, 'utf8'));
        assert.ok(result, 'a stand-down list missing a seat must fail the check');
        assert.match(result, /stand-down list: 'scope-adjudicator' not found/, 'the failure must name the stand-down list');
    });
});

test('control: removing scope-adjudicator from the effort-pin map fails naming that map', () => {
    const original = fs.readFileSync(READONLY_GUARD_TEST_FILE, 'utf8');
    const mutated = withMutatedTestBody(original, EFFORT_PIN_TITLE,
        (line) => line.replace(/,\s*'scope-adjudicator': 'high'/, ''));
    assert.notStrictEqual(mutated, original, 'test fixture assumption: the map entry was present and removable');
    withTempCopy('readonly-agent-guard.test.js', mutated, (file) => {
        const result = checkPartialRostersCarryTheSeat(fs.readFileSync(file, 'utf8'));
        assert.ok(result, 'an effort-pin map missing the seat must fail the check');
        assert.match(result, /effort-pin map/, 'the failure must name the map');
    });
});
