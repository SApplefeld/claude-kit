// Tests for tools/prose-shape.mjs, the prose-shape diagnostic.
//
// Node's built-in test runner, no framework. The tool is ESM and this suite is
// CommonJS like its neighbours, so the module is loaded with a dynamic import.
//
// Two layers. The counting core (measure, splitParagraphs, splitSentences) is
// asserted directly on in-memory markdown strings, because a miscount is silent:
// every later Chapter carries the tool's numbers, and nothing downstream would
// notice a splitter that drifted. The locked units are the backtick mask, a
// fixture with a known sentence count, one paragraph per list item, the four
// skipped block kinds, the bold lead as its own sentence, and the rule that a
// semicolon or colon never ends a sentence. The CLI layer spawns the script with
// an argument array against fixtures written under a fresh os.tmpdir() directory
// and asserts the table shape, the --json shape, and the refusal of unreadable
// paths.
//
// Every case owns its temp state and opens no port, so the file is
// parallel-safe by construction.

'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawnSync } = require('node:child_process');
const { pathToFileURL } = require('node:url');

const SCRIPT = path.join(__dirname, '..', 'tools', 'prose-shape.mjs');

function load() {
    return import(pathToFileURL(SCRIPT).href);
}

function words(n, word) {
    return Array.from({ length: n }, () => word || 'word').join(' ');
}

test('a period inside a backtick span does not end a sentence', async () => {
    const { splitSentences } = await load();
    const sentences = splitSentences('Call `foo. Bar` now. Then stop.');
    assert.deepStrictEqual(sentences, ['Call `foo. Bar` now.', 'Then stop.']);
    const doubled = splitSentences('Run ``a. B `c`. D`` here. Next one.');
    assert.deepStrictEqual(doubled, ['Run ``a. B `c`. D`` here.', 'Next one.']);
});

test('a period before an opening backtick still ends a sentence', async () => {
    const { splitSentences } = await load();
    assert.deepStrictEqual(splitSentences('It ends. `code` starts the next.'),
        ['It ends.', '`code` starts the next.']);
});

test('a fixture with a known sentence count reads exactly that count', async () => {
    const { measure } = await load();
    const fixture = [
        '# Heading here',
        '',
        'First sentence is here. Second one asks why? Third one shouts! Fourth uses e.g. lowercase',
        'after a period and stays one. Fifth ends (with a paren.) and continues. Sixth ends.',
        '',
        '- **Bold lead.** Body sentence one. Body two.',
        '- Item without punctuation',
        '1. Numbered item. With two sentences.',
        '',
        'Ends here. (Parenthetical opens.) Next.',
        ''
    ].join('\n');
    const row = measure(fixture);
    // Heading 1, prose paragraph 6, bold-lead item 3, bare item 1, numbered
    // item 2, parenthetical paragraph 2 ("opens.)" has a closing parenthesis,
    // not whitespace, after its period). The per-paragraph reading keeps two
    // opposite miscounts from cancelling in the total.
    assert.strictEqual(row.sentences, 15);
    assert.strictEqual(row.paragraphs, 6);
    const perParagraph = fixture.split('\n\n').flatMap((block) => block.split(/\n(?=- |\d+\. )/))
        .map((block) => measure(block).sentences);
    assert.deepStrictEqual(perParagraph, [1, 6, 3, 1, 2, 2]);
});

test('list markers and heading hashes are structure, not words', async () => {
    const { measure } = await load();
    assert.strictEqual(measure('- one two three').words, 3);
    assert.strictEqual(measure('## Two words').words, 2);
    assert.strictEqual(measure('1. alpha beta').words, 2);
    const item = measure('12. Numbered item. With two sentences.');
    assert.strictEqual(item.sentences, 2);
    assert.strictEqual(item.longestSentence, 3);
    const nested = measure('  - **Lead text.** Body here.\n    continuation words');
    assert.strictEqual(nested.words, 6);
    assert.strictEqual(measure('Plain - dash and #hash and 3. mid').words, 8);
});

test('a paragraph with no ending punctuation is one sentence', async () => {
    const { splitSentences } = await load();
    assert.deepStrictEqual(splitSentences('no punctuation at all here'), ['no punctuation at all here']);
});

test('each list item is its own paragraph and continuation lines join their item', async () => {
    const { splitParagraphs, measure } = await load();
    const text = [
        'Intro line directly above the list.',
        '- one',
        '- two',
        '  continuation of two',
        '3. three',
        '   12. nested numbered'
    ].join('\n');
    const paras = splitParagraphs(text);
    assert.deepStrictEqual(paras, [
        'Intro line directly above the list.',
        '- one',
        '- two\n  continuation of two',
        '3. three',
        '   12. nested numbered'
    ]);
    assert.strictEqual(measure(text).paragraphs, 5);
});

test('a line that only looks like a list marker without the space is not a list item', async () => {
    const { splitParagraphs } = await load();
    assert.deepStrictEqual(splitParagraphs('Some text\n-not an item\n2.5 is a number'),
        ['Some text\n-not an item\n2.5 is a number']);
});

test('fenced code, table rows, frontmatter and HTML comments contribute nothing', async () => {
    const { measure } = await load();
    const prose = 'Alpha sentence one. Beta sentence two.\n\nGamma paragraph here.\n';
    const baseline = measure(prose);
    const withSkips = [
        '---',
        'name: fixture frontmatter. With Sentences.',
        'description: more words here',
        '---',
        'Alpha sentence one. Beta sentence two.',
        '',
        '```js',
        'const x = 1. Y = 2;',
        '```',
        '',
        '~~~',
        'tilde fenced. Text here.',
        '~~~',
        '<!-- a single-line comment. With Sentences. -->',
        '| Col | Other. Col |',
        '| --- | --- |',
        '  | indented row | here |',
        '',
        '<!--',
        'a multi-line comment. With Sentences.',
        '-->',
        'Gamma <!-- inline. Comment. --> paragraph here.',
        ''
    ].join('\n');
    assert.deepStrictEqual(measure(withSkips), baseline);
    assert.deepStrictEqual(baseline, {
        words: 9, paragraphs: 2, paragraphsOver120: 0, paragraphsOver200: 0, longestParagraph: 6,
        sentences: 3, sentencesOver30: 0, sentencesOver45: 0, longestSentence: 3
    });
});

test('the same lines outside a skip construct are counted, so the skip is what removed them', async () => {
    const { measure } = await load();
    assert.strictEqual(measure('const x = 1. Y = 2;').words, 7);
    assert.strictEqual(measure('Col Other. Col').sentences, 2);
    assert.strictEqual(measure('Text\n---\nname: not frontmatter\n---\n').words, 6);
});

test('an unclosed fence skips to the end of the file', async () => {
    const { measure } = await load();
    assert.strictEqual(measure('Kept words.\n\n```\nlost words. Here.\n\nMore lost.\n').words, 2);
});

test('an HTML comment written inside a backtick span is prose, not a comment', async () => {
    const { measure } = await load();
    const row = measure('Write `<!-- slot 1 -->` markers. Then stop.');
    assert.strictEqual(row.words, 8);
    assert.strictEqual(row.sentences, 2);
});

test('a bold lead ending in a period is its own sentence', async () => {
    const { splitSentences } = await load();
    assert.deepStrictEqual(splitSentences('**Lead text.** Rest of the paragraph.'),
        ['**Lead text.**', 'Rest of the paragraph.']);
    assert.deepStrictEqual(splitSentences('- **Ask first?** then act here.'),
        ['- **Ask first?**', 'then act here.']);
});

test('a semicolon or colon never ends a sentence', async () => {
    const { splitSentences } = await load();
    assert.deepStrictEqual(splitSentences('One clause; Another clause: Third clause. Fourth.'),
        ['One clause; Another clause: Third clause.', 'Fourth.']);
});

test('a period followed by a lowercase letter or a closing mark does not end a sentence', async () => {
    const { splitSentences } = await load();
    assert.deepStrictEqual(splitSentences('See e.g. this one. And "quoted." then more.'),
        ['See e.g. this one.', 'And "quoted." then more.']);
});

test('past N means strictly more than N words, and the longest columns read the maximum', async () => {
    const { measure } = await load();
    const text = [
        words(30) + '.',
        '',
        words(31, 'Long') + '.',
        '',
        words(46, 'Longer') + '.',
        '',
        words(120, 'p') + ' end',
        '',
        words(200, 'q') + ' end'
    ].join('\n');
    const row = measure(text);
    assert.strictEqual(row.paragraphs, 5);
    assert.strictEqual(row.sentencesOver30, 4);
    assert.strictEqual(row.sentencesOver45, 3);
    assert.strictEqual(row.paragraphsOver120, 2);
    assert.strictEqual(row.paragraphsOver200, 1);
    assert.strictEqual(row.longestParagraph, 201);
    assert.strictEqual(row.longestSentence, 201);
    assert.strictEqual(row.words, 30 + 31 + 46 + 121 + 201);
});

test('CRLF line endings and a leading byte-order mark count the same as plain LF', async () => {
    const { measure } = await load();
    const lf = '---\nk: v\n---\n# Title\n\n- **Lead.** Body one.\n- Two\n\n```\nx\n```\n';
    assert.deepStrictEqual(measure(lf.replace(/\n/g, '\r\n')), measure(lf));
    assert.deepStrictEqual(measure(String.fromCharCode(0xFEFF) + lf), measure(lf));
    assert.strictEqual(measure(lf).words, 5);
});

function tempDir() {
    return fs.mkdtempSync(path.join(os.tmpdir(), 'prose-shape-'));
}

function run(args) {
    return spawnSync(process.execPath, [SCRIPT, ...args], { encoding: 'utf8' });
}

test('the CLI prints an aligned table with one row per file, or one JSON line per file', () => {
    const dir = tempDir();
    try {
        const a = path.join(dir, 'a.md');
        const b = path.join(dir, 'b.md');
        fs.writeFileSync(a, 'One sentence here. Two here.\n', 'utf8');
        fs.writeFileSync(b, '- item one\n- item two\n', 'utf8');

        const table = run([a, b]);
        assert.strictEqual(table.status, 0, table.stderr);
        const lines = table.stdout.trimEnd().split(/\r?\n/);
        assert.strictEqual(lines.length, 3);
        assert.ok(lines[1].startsWith(a));
        assert.ok(lines[2].startsWith(b));
        const width = lines[0].length;
        assert.ok(lines.every((line) => line.length === width), 'every table line has the same width');

        const json = run(['--json', a, b]);
        assert.strictEqual(json.status, 0, json.stderr);
        const rows = json.stdout.trimEnd().split(/\r?\n/).map((line) => JSON.parse(line));
        assert.deepStrictEqual(rows[0], {
            file: a, words: 5, paragraphs: 1, paragraphsOver120: 0, paragraphsOver200: 0,
            longestParagraph: 5, sentences: 2, sentencesOver30: 0, sentencesOver45: 0, longestSentence: 3
        });
        assert.strictEqual(rows[1].file, b);
        assert.strictEqual(rows[1].paragraphs, 2);
    } finally {
        fs.rmSync(dir, { recursive: true, force: true });
    }
});

test('the CLI refuses every unreadable path with a reason on stderr and no rows', () => {
    const dir = tempDir();
    try {
        const good = path.join(dir, 'good.md');
        fs.writeFileSync(good, 'Fine.\n', 'utf8');
        const missingA = path.join(dir, 'missing-a.md');
        const missingB = path.join(dir, 'missing-b.md');

        const result = run([good, missingA, dir, missingB]);
        assert.notStrictEqual(result.status, 0);
        assert.strictEqual(result.stdout, '');
        assert.ok(result.stderr.includes(missingA), result.stderr);
        assert.ok(result.stderr.includes(missingB), result.stderr);
        assert.ok(result.stderr.includes(dir + ':'), result.stderr);
    } finally {
        fs.rmSync(dir, { recursive: true, force: true });
    }
});

test('the CLI refuses a run with no paths or an unknown option', () => {
    const none = run([]);
    assert.notStrictEqual(none.status, 0);
    assert.match(none.stderr, /usage/i);
    const unknown = run(['--jsn', SCRIPT]);
    assert.notStrictEqual(unknown.status, 0);
    assert.match(unknown.stderr, /--jsn/);
});
