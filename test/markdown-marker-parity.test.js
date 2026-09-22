// A bold marker left open in shipped markdown, "one asterisk pair with no
// close", reads as bold from its own line to wherever the next pair happens
// to land, which can be the next heading or the end of the file. No renderer
// in this kit's review path catches it: a diff-blind pass over prose text
// sees the same words either way. This file pins the one property a marker
// count can check without parsing markdown at all: on every line outside a
// fenced code block and outside an inline code span, the count of `**` is
// even, since a marker left open by itself is what an odd count on a line
// means.
//
// The scope is the payload rather than the whole tree: every markdown file
// shipped under plugins/claude-kit/, read by the same walker
// test/doctrine-parity.test.js already uses for a shipped-surface sweep,
// with the same two exclusions and for the same reasons. The gitignored
// doctrine copy at the plugin root is build output the doctrine-refresh hook
// regenerates from the operating-instructions skill body, not a file anyone
// authors, and a rationale ledger under a skill's references/ directory is a
// journal-layer audit record that quotes retired passages verbatim rather
// than a document a session loads as instruction.

'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const PLUGIN_ROOT = path.join(__dirname, '..', 'plugins', 'claude-kit');

// A fence line toggles the state rather than being matched by content, since
// a fence's own line never carries a marker pair worth counting either way.
// Three or more backticks is the only fence spelling this payload's markdown
// uses; a tilde fence is not part of the class this pin has evidence for.
const FENCE = /^\s*`{3,}/;

// Skip every inline code span before counting, so a marker sitting inside a
// literal example (`this ** is not bold`) never reads as an open marker. The
// payload carries no double-backtick-delimited span (one that itself
// contains a backtick), so a single-backtick match is sufficient for the
// class this pin has evidence for; a wider span would be a small addition to
// this one line when a payload file first needs one.
const INLINE_CODE = /`[^`]*`/g;

// Returns one entry per line whose marker count, outside fenced code and
// inline code, is odd: the shape a marker left open on that line produces.
// A pure function over text, so the case below can drive it on fixture
// strings without touching a shipped file.
function unbalancedMarkerLines(text) {
    const lines = text.split(/\r\n|\n/);
    let inFence = false;
    const failures = [];
    lines.forEach((line, idx) => {
        if (FENCE.test(line)) { inFence = !inFence; return; }
        if (inFence) return;
        const stripped = line.replace(INLINE_CODE, '');
        const count = (stripped.match(/\*\*/g) || []).length;
        if (count % 2 !== 0) failures.push({ line: idx + 1, text: line });
    });
    return failures;
}

// Every markdown file the payload ships, walked the way
// test/doctrine-parity.test.js's shippedKitMarkdown walks it: recursively
// under plugins/claude-kit/, past the two exclusions this file's header
// names. Restated here rather than imported because doctrine-parity.test.js
// is a test file with no module.exports, not a shared library.
function payloadMarkdown() {
    const files = [];
    const walk = (dir) => {
        for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
            const full = path.join(dir, entry.name);
            if (entry.isDirectory()) { walk(full); continue; }
            if (entry.name === 'claude-kit-doctrine.md' && dir === PLUGIN_ROOT) continue;
            if (entry.name === 'rationale-ledger.md' && path.basename(dir) === 'references') continue;
            if (entry.name.endsWith('.md')) files.push(full);
        }
    };
    walk(PLUGIN_ROOT);
    return files;
}

test('a line with a closed marker pair is balanced, and one with an open marker is not', () => {
    assert.deepStrictEqual(unbalancedMarkerLines('This is a closed pair on its own line.\n'), []);
    const open = unbalancedMarkerLines('An opened marker with no close on this line.\n'.replace('An opened', 'An **opened'));
    assert.strictEqual(open.length, 1);
    assert.strictEqual(open[0].line, 1);
    // Two pairs on one line stay even.
    assert.deepStrictEqual(unbalancedMarkerLines('One pair here and a second pair there, both closed.\n'
        .replace('One pair', 'One **pair**').replace('a second pair', 'a **second pair**')), []);
});

test('an odd marker count inside a fenced code block is not flagged, and the same text outside one is', () => {
    const fenced = '```\na line an open marker inside a fence, unmatched on purpose\n```\n'
        .replace('a line an open marker', 'a line with **an open marker');
    assert.deepStrictEqual(unbalancedMarkerLines(fenced), []);
    // The control, withheld from the fence by removing its delimiters: the
    // identical line outside a fence does red, so the pass above is the
    // fence skip working rather than the predicate never firing.
    const unfenced = fenced.split('\n').filter((l) => !FENCE.test(l)).join('\n') + '\n';
    assert.strictEqual(unbalancedMarkerLines(unfenced).length, 1);
});

test('an odd marker count inside an inline code span is not flagged, and the same text outside one is', () => {
    const spanned = 'Run `this ** has an open marker` in a shell.\n';
    assert.deepStrictEqual(unbalancedMarkerLines(spanned), []);
    // The control, withheld from the span by dropping the backticks: the
    // same words with no code delimiter do red.
    const unspanned = spanned.replace(/`/g, '');
    assert.strictEqual(unbalancedMarkerLines(unspanned).length, 1);
});

test('the walker enumerates the payload past a floor, and every file it returns is balanced', () => {
    const files = payloadMarkdown();
    // The floor guards against a walker that silently returned few or no
    // files: an empty or near-empty result would pass the loop below
    // vacuously and read exactly like a clean sweep. 48 files were counted
    // at authoring; the floor sits under that so retiring one file is not a
    // red.
    assert.ok(files.length >= 40, 'the payload markdown walker enumerated only '
        + files.length + ' files, fewer than this kit ships, so a clean result '
        + 'below would mean the sweep barely ran');
    const failing = [];
    for (const file of files) {
        const rel = path.relative(path.join(__dirname, '..'), file).split(path.sep).join('/');
        for (const bad of unbalancedMarkerLines(fs.readFileSync(file, 'utf8'))) {
            failing.push(rel + ':' + bad.line + ': ' + bad.text.trim());
        }
    }
    assert.deepStrictEqual(failing, [], 'a shipped markdown file carries an '
        + 'unbalanced bold marker outside any fence or code span:\n' + failing.join('\n'));
});
