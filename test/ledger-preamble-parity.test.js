// Every skill under plugins/claude-kit/skills/ that carries a
// references/rationale-ledger.md opens it with one preamble: the purpose
// paragraph, the entry-format paragraph, and the authoring paragraph that
// carries the ledger-authoring lessons. The copies are meant to be identical
// up to two per-skill substitutions, the skill's own name and the
// provenance-source list (the executing-work ledger names "plan doc" among its
// sources where the other ledgers do not), and nothing but this test holds them
// so: the corpus rewrite's own copies drifted under review alone, which is the
// failure this pin exists to catch.
//
// The executing-work ledger is the source copy. Each other ledger is read
// against it, and a mismatch is reported with the file, the substitutions the
// comparison allowed, and the first differing run of text, so the reader lands
// on the drift rather than on a bare inequality.
//
// Comparison unit: the authoring paragraph first, which is the unit the plan
// that landed it names, and then the whole preamble, every line before the
// first document heading, since the two paragraphs above it are the same
// deliberate copy and drift there is the same defect. Line endings are
// normalized to \n before comparing, as the doctrine parity pin does, so a
// CRLF/LF checkout difference can never fail a parity the content holds.
// Everything else is byte-exact.

'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const SKILLS = path.join(__dirname, '..', 'plugins', 'claude-kit', 'skills');
const SOURCE_SKILL = 'executing-work';

// The authoring paragraph is found by its opening sentence rather than by its
// position, so a preamble that gains a paragraph elsewhere does not move the
// pin, and a ledger whose authoring paragraph lost its lead reports that
// rather than a mismatch deep inside the text.
const AUTHORING_LEAD = 'The rules below bind every entry written from now on.';

// The two substitutions the preambles carry by design. The skill's name appears
// in the title line and in the purpose paragraph's backticked reference; the
// provenance-source list is the parenthesis in the entry-format paragraph,
// which names "plan doc" in the executing-work ledger alone. Each is replaced
// by a placeholder before comparing, so the placeholder text is what the
// mismatch report shows where a substitution sat.
const SKILL_PLACEHOLDER = '<skill>';
const SOURCES_PLACEHOLDER = '<provenance sources>';
const PROVENANCE_LIST = /\(the commit, incident, (?:plan doc, )?memory or kaizen note that installed it/;

function normalize(text) {
    return text.replace(/^﻿/, '').replace(/\r\n/g, '\n');
}

// Every skill directory carrying a ledger, in directory order. The population
// is the tree's own listing rather than a count, so a skill added or retired
// moves the pin with it.
function ledgers() {
    return fs.readdirSync(SKILLS).sort()
        .map((skill) => ({
            skill,
            rel: 'plugins/claude-kit/skills/' + skill + '/references/rationale-ledger.md',
            file: path.join(SKILLS, skill, 'references', 'rationale-ledger.md'),
        }))
        .filter((l) => fs.existsSync(l.file));
}

// The preamble is everything before the first document heading, with trailing
// blank lines dropped, since the blank line before the heading is layout and
// not content.
function preambleOf(text) {
    const lines = normalize(text).split('\n');
    const heading = lines.findIndex((l) => l.startsWith('## '));
    const kept = heading === -1 ? lines : lines.slice(0, heading);
    return kept.join('\n').replace(/\n+$/, '');
}

function paragraphsOf(preamble) {
    return preamble.split(/\n{2,}/);
}

function canonical(text, skill) {
    return text
        .split('# Rationale ledger: ' + skill).join('# Rationale ledger: ' + SKILL_PLACEHOLDER)
        .split('`' + skill + '`').join('`' + SKILL_PLACEHOLDER + '`')
        .replace(PROVENANCE_LIST, '(' + SOURCES_PLACEHOLDER + ' that installed it');
}

function authoringParagraphOf(preamble, rel) {
    const hits = paragraphsOf(preamble).filter((p) => p.startsWith(AUTHORING_LEAD));
    assert.strictEqual(hits.length, 1, rel + ': expected exactly one preamble paragraph '
        + 'opening "' + AUTHORING_LEAD + '" before the first document heading, found '
        + hits.length + '; the authoring paragraph is the ledger-authoring lessons\' one '
        + 'home in this ledger, so none at all leaves this ledger without them and two '
        + 'leaves a reader with two versions to reconcile');
    return hits[0];
}

// The first differing run, as a window of each side around the first index at
// which they part, so the report names where the drift is rather than only that
// it exists.
function firstDifference(expected, actual) {
    let at = 0;
    const limit = Math.min(expected.length, actual.length);
    while (at < limit && expected[at] === actual[at]) at++;
    const from = Math.max(0, at - 40);
    return {
        at,
        expected: expected.slice(from, at + 80),
        actual: actual.slice(from, at + 80),
    };
}

function assertParity(rel, skill, unit, expected, actual) {
    if (expected === actual) return;
    const diff = firstDifference(expected, actual);
    assert.fail(rel + ': the ' + unit + ' differs from the ' + SOURCE_SKILL + ' ledger\'s '
        + 'after allowing the two substitutions (the skill name "' + skill + '" read as "'
        + SKILL_PLACEHOLDER + '", and the provenance-source list read as "'
        + SOURCES_PLACEHOLDER + '"); first differing run at character ' + diff.at
        + ': ' + SOURCE_SKILL + ' reads "' + diff.expected + '" and this ledger reads "'
        + diff.actual + '"');
}

function sourceLedger(all) {
    const source = all.find((l) => l.skill === SOURCE_SKILL);
    assert.ok(source, 'the ' + SOURCE_SKILL + ' ledger is missing, so there is no source '
        + 'copy to read the other ledgers against');
    return source;
}

test('the executing-work ledger carries exactly one authoring paragraph in its preamble', () => {
    const source = sourceLedger(ledgers());
    const preamble = preambleOf(fs.readFileSync(source.file, 'utf8'));
    const paragraph = authoringParagraphOf(preamble, source.rel);
    assert.ok(paragraph.length > AUTHORING_LEAD.length, source.rel + ': the authoring '
        + 'paragraph is its lead sentence alone, so it carries no lesson');
});

test('every other ledger carries the authoring paragraph identical to the executing-work ledger\'s', () => {
    const all = ledgers();
    const source = sourceLedger(all);
    const others = all.filter((l) => l.skill !== SOURCE_SKILL);
    assert.ok(others.length > 0, 'no ledger other than ' + SOURCE_SKILL + '\'s is on disk, '
        + 'so this pin has nothing to compare');
    const expected = canonical(authoringParagraphOf(
        preambleOf(fs.readFileSync(source.file, 'utf8')), source.rel), SOURCE_SKILL);
    for (const l of others) {
        const preamble = preambleOf(fs.readFileSync(l.file, 'utf8'));
        const actual = canonical(authoringParagraphOf(preamble, l.rel), l.skill);
        assertParity(l.rel, l.skill, 'authoring paragraph', expected, actual);
    }
});

// The whole preamble, not only the authoring paragraph: the purpose and
// entry-format paragraphs are the same deliberate copy, and a drift there is
// what this pin's history is about. The two substitutions are proved to carry
// weight on the way: the raw source preamble differs from at least one other
// raw preamble (the provenance list names "plan doc" in the source alone, and
// every title names its own skill), while the canonical forms agree.
test('every other ledger\'s whole preamble matches the executing-work ledger\'s up to the skill name and the provenance-source list', () => {
    const all = ledgers();
    const source = sourceLedger(all);
    const others = all.filter((l) => l.skill !== SOURCE_SKILL);
    assert.ok(others.length > 0, 'no ledger other than ' + SOURCE_SKILL + '\'s is on disk, '
        + 'so this pin has nothing to compare');
    const rawSource = preambleOf(fs.readFileSync(source.file, 'utf8'));
    const expected = canonical(rawSource, SOURCE_SKILL);
    let rawDiffers = 0;
    for (const l of others) {
        const raw = preambleOf(fs.readFileSync(l.file, 'utf8'));
        if (raw !== rawSource) rawDiffers++;
        assertParity(l.rel, l.skill, 'whole preamble', expected, canonical(raw, l.skill));
    }
    assert.strictEqual(rawDiffers, others.length, 'every other ledger\'s raw preamble should '
        + 'differ from the source\'s by its title alone, so a raw preamble equal to the '
        + 'source\'s means a ledger carries another skill\'s name in its title');
});

// The instrument itself: a drifted paragraph is reported with its file, the
// substitutions allowed, and the first differing run. The control runs on an
// in-memory copy of the source paragraph with one word changed, so the tree
// under test is never touched, and the changed word sits past the lead so the
// lead-based lookup still finds the paragraph.
test('a drifted authoring paragraph is reported with its file and the first differing run', () => {
    const source = sourceLedger(ledgers());
    const paragraph = authoringParagraphOf(
        preambleOf(fs.readFileSync(source.file, 'utf8')), source.rel);
    const drifted = paragraph.replace('verdict', 'ruling');
    assert.notStrictEqual(drifted, paragraph, 'the control found no "verdict" to alter, so '
        + 'it can prove nothing about the report');
    assert.throws(
        () => assertParity('plugins/claude-kit/skills/example/references/rationale-ledger.md',
            'example', 'authoring paragraph', canonical(paragraph, SOURCE_SKILL),
            canonical(drifted, 'example')),
        (err) => /skills\/example\/references\/rationale-ledger\.md: the authoring paragraph differs/.test(err.message)
            && /allowing the two substitutions/.test(err.message)
            && /first differing run at character \d+/.test(err.message)
            && /reads "[^"]*verdict[^"]*" and this ledger reads "[^"]*ruling[^"]*"/.test(err.message),
        'the mismatch report no longer names the file, the substitutions allowed and the '
        + 'first differing run of both sides');
});
