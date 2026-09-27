// The heading pin: every prose heading in the corpus, the 49 (now 50) documents
// test/size-budget.json names as neither a rationale ledger nor a test file, held
// to Decisions item 8's shape. A heading fails where it ends in a period, runs
// past five words, or opens with an article; it checks no case, per item 10. A
// heading inside a fenced block, a ledger's own entry heading and a machine-
// contract heading (the plan template's `### N. <Title>` and `### Chapter N`)
// are outside the rule and this pin, wherever they land.
//
// The corpus set is read from the budget at run time rather than carried as a
// list or a count here, so a document a later section adds to a measured root
// joins the sweep the moment its cap does, and the pin never drifts from the 49
// (or 50, or however many) documents the ratchet itself measures.

'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const REPO = path.join(__dirname, '..');
const BUDGET = path.join(REPO, 'test', 'size-budget.json');

const RATIONALE_LEDGER = /\/references\/rationale-ledger\.md$/;

// The corpus-wide cap's own key in the budget, kit-size.js's CORPUS_CAP_KEY.
// It names no file, so it is not a document this sweep can read, and it
// answers to neither the ledger shape nor a test/ prefix, so it is excluded by
// name rather than falling out of either pattern.
const CORPUS_CAP_KEY = 'corpus-cap';

// The corpus: every budget key that is neither a rationale ledger, under
// test/, nor the corpus-cap key itself, in the order the budget spells them.
function corpusPaths() {
    const budget = JSON.parse(fs.readFileSync(BUDGET, 'utf8'));
    return Object.keys(budget).filter((k) => k !== CORPUS_CAP_KEY && !RATIONALE_LEDGER.test(k) && !k.startsWith('test/'));
}

// Every ATX heading (`#` to `######` at line start) outside a fenced block, in
// the order they appear. A fence opens on a line, indented up to three spaces,
// of three or more backticks or tildes, and closes on a later line of the same
// character run at least as long and nothing else on it; anything between is
// prose or code rather than a heading this pin reads, which is what keeps a
// heading-shaped line inside a worked example from being read as one.
function headingsOutsideFences(text) {
    const lines = text.split(/\r?\n/);
    const headings = [];
    let fence = null;
    for (let i = 0; i < lines.length; i += 1) {
        const line = lines[i];
        const marker = line.match(/^ {0,3}(`{3,}|~{3,})/);
        if (fence) {
            const closes = marker && marker[1][0] === fence.char && marker[1].length >= fence.len
                && /^\s*$/.test(line.slice(marker[0].length));
            if (closes) fence = null;
            continue;
        }
        if (marker) {
            fence = { char: marker[1][0], len: marker[1].length };
            continue;
        }
        const heading = line.match(/^(#{1,6})\s+(.*?)\s*$/);
        if (heading) headings.push({ line: i + 1, level: heading[1].length, body: heading[2] });
    }
    return headings;
}

// The plan template's frozen heading shapes, exempt at whatever level and
// wherever they land, per the curating-docs contract table item 8 points at:
// a numbered section (`3. <Title>`) and a Chapter heading (`Chapter 12 - ...`).
function isMachineContract(body) {
    return /^\d+\.\s+\S/.test(body) || /^Chapter\s+\d+\b/.test(body);
}

// A word is a whitespace-separated token once an inline code span collapses to
// one, since a span reads as a single word to a reader scanning the heading. A
// bare number and a word carrying a colon are already their own token under a
// plain split, so the Assumption's naming them is a clarification of this
// count rather than a second rule it applies.
function wordCount(body) {
    const collapsed = body.replace(/`[^`]*`/g, 'X');
    return collapsed.trim().split(/\s+/).filter(Boolean).length;
}

const ARTICLE = /^(a|an|the)\b/i;

// Every reason a heading fails the pin, empty where it passes. A machine-
// contract heading passes whatever its shape, checked first so none of the
// three mechanical rules ever reaches one. Case is not among them, per item 10.
function headingReasons(body) {
    if (isMachineContract(body)) return [];
    const reasons = [];
    if (/\.$/.test(body)) reasons.push('period');
    if (wordCount(body) > 5) reasons.push('words');
    if (ARTICLE.test(body)) reasons.push('article');
    return reasons;
}

test('the heading pin fails a period, a six-word heading and a leading article, and passes a five-word label', () => {
    assert.deepStrictEqual(headingReasons('Restart the process.'), ['period']);
    assert.deepStrictEqual(headingReasons('One two three four five six'), ['words']);
    assert.deepStrictEqual(headingReasons('The One Two Three'), ['article']);
    assert.deepStrictEqual(headingReasons('One Two Three Four Five'), []);
    // A number, a section number and a word after a colon each count as a
    // word under the plain split the Assumption describes, and a code span
    // collapses to one word rather than splitting on the whitespace inside it.
    assert.deepStrictEqual(headingReasons('Store: Version 5'), []);
    assert.deepStrictEqual(headingReasons('Run `git commit --amend` Now'), []);
    assert.strictEqual(wordCount('Run `git commit --amend` Now'), 3);
});

test('the pin checks no case: an upper-case and a lower-case heading of the same shape read the same reasons', () => {
    assert.deepStrictEqual(headingReasons('ALL CAPS HEADING'), []);
    assert.deepStrictEqual(headingReasons('all caps heading'), []);
    assert.deepStrictEqual(headingReasons('ALL CAPS HEADING ENDS.'), ['period']);
    assert.deepStrictEqual(headingReasons('all caps heading ends.'), ['period']);
});

test('a machine-contract heading passes whatever its shape, and a heading inside a fenced block is not read at all', () => {
    // A numbered plan section and a Chapter heading, each shaped so every
    // mechanical rule but the exemption would fail it.
    assert.deepStrictEqual(headingReasons('3. The dispatch script, its pin and the read-only drafter charter, all one section'), []);
    assert.deepStrictEqual(headingReasons('Chapter 12 - 2026-09-26, closed with every gate green and the operator still reading'), []);

    const withFence = [
        '# A Heading',
        '',
        '```',
        '## A Six Word Heading Inside The Fence.',
        '```',
        '',
        '## Reader'
    ].join('\n');
    const found = headingsOutsideFences(withFence).map((h) => h.body);
    assert.deepStrictEqual(found, ['A Heading', 'Reader'],
        'a heading-shaped line inside a fenced block is prose here, not a heading: ' + JSON.stringify(found));
});

test('a fence closes only on a matching character and a run at least as long', () => {
    const text = [
        '## Before',
        '~~~~',
        '## Inside, not a heading',
        '```',
        '## Still inside: the fence needs a tilde run to close',
        '~~~~',
        '## After'
    ].join('\n');
    const found = headingsOutsideFences(text).map((h) => h.body);
    assert.deepStrictEqual(found, ['Before', 'After']);
});

// The corpus itself: the ratchet's own definition of a document, read at run
// time. Every document sits under one of the words-metric roots kit-size.js
// classifies, so every heading it holds is prose rather than generated text.
test('over the corpus every heading meets the pin, rewritten or exempted by name', () => {
    // A heading exempted rather than rewritten, because rewriting it would
    // break a byte-for-byte pin or a citation elsewhere: [file, exact heading
    // text as it appears after the `#` run, reason]. An entry that matches
    // nothing in the corpus reddens below, so a retired pin or a later rewrite
    // clears its own exemption rather than leaving a silent hole.
    const EXEMPT = [
        ['plugins/claude-kit/agents/scope-adjudicator.md', "The relevance shape's buckets",
            "pinned byte for byte as RELEVANCE_HEADING in test/review-loop-provenance.test.js:894"]
    ];
    const exemptHits = new Map(EXEMPT.map(([f, body]) => [f + '|' + body, 0]));
    const failures = [];
    let headingCount = 0;
    for (const relPath of corpusPaths()) {
        const text = fs.readFileSync(path.join(REPO, relPath), 'utf8');
        for (const heading of headingsOutsideFences(text)) {
            headingCount += 1;
            const reasons = headingReasons(heading.body);
            if (reasons.length === 0) continue;
            const exempt = EXEMPT.find(([f, body]) => f === relPath && body === heading.body);
            if (exempt) {
                exemptHits.set(relPath + '|' + exempt[1], exemptHits.get(relPath + '|' + exempt[1]) + 1);
                continue;
            }
            failures.push(relPath + ':' + heading.line + ' "' + heading.body + '" (' + reasons.join(', ') + ')');
        }
    }
    // The absence report this sweep owes: the predicate (headingReasons over
    // every ATX heading outside a fenced block), the scope (the corpusPaths()
    // set, named by count so a reader can tell a shrunk corpus from a clean
    // one), and what it matched (nothing, past the named exemption).
    assert.deepStrictEqual(failures, [], 'the heading pin swept ' + headingCount
        + ' headings across ' + corpusPaths().length + ' corpus documents and found a failing heading '
        + 'this sweep does not rewrite or exempt; rewrite it to item 8\'s rule or add it to EXEMPT '
        + 'above with its reason:\n' + failures.join('\n'));
    for (const [key, count] of exemptHits) {
        assert.ok(count > 0, 'the exemption for ' + key + ' matches no failing heading in the '
            + 'corpus, so it is a stale entry silently widening what this pin skips. Remove it, '
            + 'or point it at the heading it means');
    }
});
