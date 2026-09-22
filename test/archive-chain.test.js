// A plan archived through curating-docs prepends one entry to two indexes,
// docs/README.md and docs/plans/README.md, and drops the oldest from each.
// The two updates are separate edits to separate files, so a session that
// makes one and misses the other leaves the indexes disagreeing about what
// the four most recent archived plans are, with nothing short of reading
// both side by side to catch it (project memory
// archiving-a-plan-touches-two-indexes-not-three records the drift this pin
// exists to catch). This file pins the chain each index carries on the line
// opening "Completed plans are in": that it names exactly four entries, and
// that the two chains name the same four plans in the same order.
//
// The pin runs no git and hardcodes no plan name, so it stays meaningful
// after every future archival: what it checks is the shape (four entries,
// agreement between the two files), never today's four filenames. The core,
// chainEntries, is a function over text, so every defect shape below (a
// dropped name, a fifth entry, two names swapped, one index differing) is
// driven on a fixture string and never by mutating docs/.
//
// The chain line in docs/plans/README.md sits directly above a per-file
// numbered list of every archived plan (the list `docs/plans/README.md:41`
// starts under it). This pin reads no entry from that list: isolating the
// single line opening "Completed plans are in" is what keeps the two
// readings apart, proven below on a fixture shaped like that file.

'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const REPO = path.join(__dirname, '..');

// A marker is "most recent" or "before it" in any case, and an entry is that
// marker plus the first backtick-quoted name after it. The docs prose
// carries the marker and its filename adjacent ("Most recent: `x.md`,
// which..."), so the first backtick pair after each marker is that entry's
// name; nothing about the class requires them to be adjacent, so the search
// for the closing name is unbounded rather than anchored to the marker's own
// end.
const MARKER = /(most recent|before it)/gi;

function chainEntries(line) {
    const entries = [];
    let match;
    while ((match = MARKER.exec(line)) !== null) {
        const rest = line.slice(match.index + match[0].length);
        const name = rest.match(/`([^`]+)`/);
        if (name) entries.push(name[1]);
    }
    // A module-level regex with the global flag carries lastIndex across
    // calls; reset it so the next call starts at the beginning of its own
    // line rather than wherever this call's last match left off.
    MARKER.lastIndex = 0;
    return entries;
}

// The line this pin isolates each chain from, found by its opening text
// rather than by a fixed line number, so a line inserted above it does not
// move the read. Throws rather than returning nothing, since a document
// carrying no such line, or two, is not a shape this pin can read a chain
// from at all.
function isolateChainLine(text, label) {
    const lines = text.split(/\r\n|\n/);
    const matches = lines.filter((l) => l.startsWith('Completed plans are in'));
    assert.strictEqual(matches.length, 1, label + ' must carry exactly one line '
        + 'opening with "Completed plans are in", found ' + matches.length);
    return matches[0];
}

// What the real pin below calls: two chains, each checked for length and the
// pair checked for agreement. Every fixture case in this file drives this
// same function, so the fixture reds prove the function the real-file
// assertion trusts, not a stand-in for it.
function assertChainsAgree(lineA, labelA, lineB, labelB) {
    const entriesA = chainEntries(lineA);
    const entriesB = chainEntries(lineB);
    assert.strictEqual(entriesA.length, 4, labelA + ' names ' + entriesA.length
        + ' entries in its chain, not the four the archive rule holds: '
        + JSON.stringify(entriesA));
    assert.strictEqual(entriesB.length, 4, labelB + ' names ' + entriesB.length
        + ' entries in its chain, not the four the archive rule holds: '
        + JSON.stringify(entriesB));
    assert.deepStrictEqual(entriesA, entriesB, labelA + ' and ' + labelB
        + ' name different plans, or the same plans in a different order:\n'
        + JSON.stringify(entriesA) + '\n' + JSON.stringify(entriesB));
}

function buildChainLine(names) {
    let line = 'Completed plans are in `archive/`. Most recent: `' + names[0]
        + '`, which shipped the first thing.';
    for (let i = 1; i < names.length; i++) {
        line += ' Before it: `' + names[i] + '`, which shipped another thing.';
    }
    return line;
}

test('chainEntries reads a marker in any case and takes the first backticked name after it', () => {
    const line = 'Completed plans are in `archive/`. MOST RECENT: `a.md`, text. '
        + 'before it: `b.md`, text. Before It: `c.md`, text.';
    assert.deepStrictEqual(chainEntries(line), ['a.md', 'b.md', 'c.md']);
});

test('a dropped entry reds the four-long check', () => {
    const short = buildChainLine(['a.md', 'b.md', 'c.md']);
    const full = buildChainLine(['a.md', 'b.md', 'c.md', 'd.md']);
    assert.throws(() => assertChainsAgree(short, 'chain A', full, 'chain B'), /names 3 entries/);
});

test('a fifth entry reds the four-long check', () => {
    const full = buildChainLine(['a.md', 'b.md', 'c.md', 'd.md']);
    const five = buildChainLine(['a.md', 'b.md', 'c.md', 'd.md', 'e.md']);
    assert.throws(() => assertChainsAgree(five, 'chain A', full, 'chain B'), /names 5 entries/);
});

test('two names swapped between chains reds the agreement check although both stay four long', () => {
    const a = buildChainLine(['a.md', 'b.md', 'c.md', 'd.md']);
    const b = buildChainLine(['a.md', 'c.md', 'b.md', 'd.md']);
    assert.strictEqual(chainEntries(a).length, 4);
    assert.strictEqual(chainEntries(b).length, 4);
    assert.throws(() => assertChainsAgree(a, 'chain A', b, 'chain B'), /name different plans/);
});

test('one index differing between two otherwise-matching chains reds the agreement check', () => {
    const a = buildChainLine(['a.md', 'b.md', 'c.md', 'd.md']);
    const b = buildChainLine(['a.md', 'b.md', 'x.md', 'd.md']);
    assert.throws(() => assertChainsAgree(a, 'chain A', b, 'chain B'), /name different plans/);
});

// The control for the isolation itself: a chain line sitting above a
// per-file list shaped like docs/plans/README.md's, with a list entry
// deliberately carrying the word "before" so a reader that scanned past the
// isolated line would pick up a fifth, phantom entry. The chain stays four
// long, which is the isolation working rather than the list being silent by
// accident.
test('a per-file list below the chain line is not read into the chain', () => {
    const doc = [
        buildChainLine(['a.md', 'b.md', 'c.md', 'd.md']),
        '',
        '1. **`a.md`** shipped first.',
        '2. **`b.md`** shipped, the one right before `phantom.md` in an unrelated sentence.',
        '3. **`c.md`** shipped third.',
    ].join('\n');
    const isolated = isolateChainLine(doc, 'the fixture document');
    assert.strictEqual(chainEntries(isolated).length, 4);
});

test('each real archive chain names exactly four entries, and the two indexes agree', () => {
    const readmeText = fs.readFileSync(path.join(REPO, 'docs', 'README.md'), 'utf8');
    const plansText = fs.readFileSync(path.join(REPO, 'docs', 'plans', 'README.md'), 'utf8');
    const readmeLine = isolateChainLine(readmeText, 'docs/README.md');
    const plansLine = isolateChainLine(plansText, 'docs/plans/README.md');
    assertChainsAgree(readmeLine, 'docs/README.md', plansLine, 'docs/plans/README.md');
});
