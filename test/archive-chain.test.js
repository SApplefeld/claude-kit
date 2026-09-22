// A plan archived through curating-docs prepends one entry to two indexes,
// docs/README.md and docs/plans/README.md, and drops the oldest from each.
// The two updates are separate edits to separate files, so a session that
// makes one and misses the other leaves the indexes disagreeing about what
// the four most recent archived plans are, with nothing short of reading
// both side by side to catch it, which an archival that updates one index
// and misses the other is the drift this pin exists to catch. This file
// pins the chain each index carries on the line opening "Completed plans
// are in": that it names exactly four entries, and that the two chains
// name the same four plans in the same order.
//
// The pin runs no git and hardcodes no plan name, so it stays meaningful
// after every future archival: what it checks is the shape (four entries,
// agreement between the two files), never today's four filenames. The core,
// chainEntries, is a function over text, so every defect shape below (a
// dropped name, a fifth entry, two names swapped, one index differing) is
// driven on a fixture string and never by mutating docs/.
//
// The chain line in docs/plans/README.md sits directly above a per-file
// list of every archived plan, each line opening with a bulleted,
// backtick-quoted plan name. This pin reads no entry from that list:
// isolating the single line opening "Completed plans are in" is what keeps
// the two readings apart, proven below on a fixture shaped like that file.

'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const REPO = path.join(__dirname, '..');

// A marker is the label "Most recent:" or "Before it:", matched with a word
// boundary at its start and a colon at its end so free prose carrying the
// same words with no colon ("used before it.", "before its own release",
// "most recently renamed") never reads as a marker. An entry is that marker
// plus the first backtick-quoted token after it whose content has a plan
// filename's shape: it ends `_v<digits>.md` and holds no slash, which a
// skill name or any other backticked token the chain's own prose carries
// never does. The search for that token is unbounded past the marker's own
// end, since nothing about the class requires the qualifying token to be
// the very next one.
const MARKER = /\b(most recent|before it)\s*:/gi;
const PLAN_NAME = /^[^/]+_v\d+\.md$/;

function chainEntries(line) {
    const entries = [];
    for (const match of line.matchAll(MARKER)) {
        const rest = line.slice(match.index + match[0].length);
        for (const nameMatch of rest.matchAll(/`([^`]+)`/g)) {
            if (PLAN_NAME.test(nameMatch[1])) {
                entries.push(nameMatch[1]);
                break;
            }
        }
    }
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

test('chainEntries reads a marker in any case and takes the first plan-shaped backtick after it', () => {
    const line = 'Completed plans are in `archive/`. MOST RECENT: `a_v1.md`, text. '
        + 'before it: `b_v2.md`, text. Before It: `c_v3.md`, text.';
    assert.deepStrictEqual(chainEntries(line), ['a_v1.md', 'b_v2.md', 'c_v3.md']);
});

test('marker-shaped prose with no colon and a non-plan backtick does not register a phantom entry', () => {
    const line = 'Completed plans are in `archive/`. Most recent: `a_v1.md`, which fixed the checker '
        + '`skill-name` used before it. The change works before its `sibling.js` counterpart ships, '
        + 'and was renamed most recently as `renamed-tool.js`. Before it: `b_v2.md`, text. '
        + 'Before it: `c_v3.md`, text. Before it: `d_v4.md`, text.';
    assert.deepStrictEqual(chainEntries(line), ['a_v1.md', 'b_v2.md', 'c_v3.md', 'd_v4.md']);
});

test('a dropped entry reds the four-long check', () => {
    const short = buildChainLine(['a_v1.md', 'b_v2.md', 'c_v3.md']);
    const full = buildChainLine(['a_v1.md', 'b_v2.md', 'c_v3.md', 'd_v4.md']);
    assert.throws(() => assertChainsAgree(short, 'chain A', full, 'chain B'), /names 3 entries/);
});

test('a fifth entry reds the four-long check', () => {
    const full = buildChainLine(['a_v1.md', 'b_v2.md', 'c_v3.md', 'd_v4.md']);
    const five = buildChainLine(['a_v1.md', 'b_v2.md', 'c_v3.md', 'd_v4.md', 'e_v5.md']);
    assert.throws(() => assertChainsAgree(five, 'chain A', full, 'chain B'), /names 5 entries/);
});

test('two names swapped between chains reds the agreement check although both stay four long', () => {
    const a = buildChainLine(['a_v1.md', 'b_v2.md', 'c_v3.md', 'd_v4.md']);
    const b = buildChainLine(['a_v1.md', 'c_v3.md', 'b_v2.md', 'd_v4.md']);
    assert.strictEqual(chainEntries(a).length, 4);
    assert.strictEqual(chainEntries(b).length, 4);
    assert.throws(() => assertChainsAgree(a, 'chain A', b, 'chain B'), /name different plans/);
});

test('one index differing between two otherwise-matching chains reds the agreement check', () => {
    const a = buildChainLine(['a_v1.md', 'b_v2.md', 'c_v3.md', 'd_v4.md']);
    const b = buildChainLine(['a_v1.md', 'b_v2.md', 'x_v9.md', 'd_v4.md']);
    assert.throws(() => assertChainsAgree(a, 'chain A', b, 'chain B'), /name different plans/);
});

// The control for the isolation itself: a chain line sitting above a
// per-file list shaped like docs/plans/README.md's, with a list entry
// deliberately carrying a real marker, "Before it:", and a plan-shaped
// backtick name of its own. A reader that scanned the whole document
// instead of isolating the single chain line would pick up that phantom
// entry as a fifth, so the chain staying four long is the isolation working
// rather than the list being silent by accident.
test('a per-file list below the chain line is not read into the chain, even where a list entry carries a marker and a plan-shaped name', () => {
    const doc = [
        buildChainLine(['a_v1.md', 'b_v2.md', 'c_v3.md', 'd_v4.md']),
        '',
        '1. **`a_v1.md`** shipped first.',
        '2. **`b_v2.md`** shipped. Before it: `claude-kit_phantom_spec_v1.md` shipped too, in an unrelated per-file entry.',
        '3. **`c_v3.md`** shipped third.',
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
