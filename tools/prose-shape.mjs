#!/usr/bin/env node
// The prose-shape diagnostic: it reads markdown files and prints, per file, how
// long its paragraphs and sentences run, so a prose rewrite can report the same
// numbers at its base ref and at its head. It is a reading, never a gate, and
// its units are fixed so every report counts the same way.
//
// Usage:
//   node tools/prose-shape.mjs [--json] <path>...
//
// One row per path, in the order given, as an aligned table on stdout, or under
// --json as one JSON object per line with these keys: file (the path as given),
// words, paragraphs, paragraphsOver120, paragraphsOver200, longestParagraph,
// sentences, sentencesOver30, sentencesOver45, longestSentence. "Over N" means
// strictly more than N words; the longest columns are word counts. Every path is
// read before anything prints: an unreadable one prints its reason on stderr,
// the run prints no rows and exits 1, and a usage error exits 2.
//
// The units. A paragraph is a run of non-blank lines between blank lines, except
// that a list item, a line opening after optional indentation with "- " or with
// digits and ". ", starts a paragraph of its own, and the lines directly under it
// belong to it. Fenced code blocks (``` or ~~~, fence lines included), table
// rows (first non-space character "|"), a frontmatter block (a "---" first line
// through the next "---") and HTML comments are skipped; a skipped line reads as
// a blank line, and a comment written inside a backtick span is prose. Headings
// are ordinary paragraphs. A word is a whitespace-separated token, except that
// the marker opening a paragraph, a list item's "-" or "<digits>." and a
// heading's run of "#", is structure: it is removed before words and sentences
// are counted, so it is neither a word nor a sentence of its own. A sentence
// ends at ".", "?" or "!", with any closing quotes, parentheses or brackets
// directly after it kept in the sentence, followed by whitespace and then an
// uppercase letter, a digit, "*", "_", a backtick, an opening parenthesis or
// bracket, or an opening quote. It also ends at ".**", "?**" or "!**" followed
// by whitespace, whatever comes next, which makes a bold lead its own sentence
// and splits a bold phrase closing mid-sentence the same way. A semicolon or colon
// never ends one,
// backtick spans are masked first so punctuation inside them never ends one, and
// a paragraph with no such ending is one sentence.
//
// Zero dependencies and no network: Node built-ins only.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const COLUMNS = [
    ['file', 'file'],
    ['words', 'words'],
    ['paragraphs', 'paras'],
    ['paragraphsOver120', 'paras>120'],
    ['paragraphsOver200', 'paras>200'],
    ['longestParagraph', 'longest para'],
    ['sentences', 'sentences'],
    ['sentencesOver30', 'sent>30'],
    ['sentencesOver45', 'sent>45'],
    ['longestSentence', 'longest sent']
];

const LIST_ITEM = /^\s*(?:- |\d+\. )/;
const STRUCTURE_MARKER = /^\s*(?:- |\d+\. |#+(?=\s|$))/;
const BACKTICK_SPAN = /(`+)(?:[^`]|[^`][\s\S]*?[^`])\1(?!`)/g;
const SENTENCE_END = /[.?!](?:\*\*(?=\s)|["')\]”’]*(?=\s+[\p{Lu}\d*_`(\["'“‘]))/gu;

// Replaces every character inside a backtick span, delimiters kept, with a
// filler of the same length, so indices in the masked text are indices in the
// original and no punctuation or comment marker inside a span is seen.
function maskBackticks(text) {
    return text.replace(BACKTICK_SPAN, (span, ticks) =>
        ticks + span.slice(ticks.length, span.length - ticks.length).replace(/\S/g, 'x') + ticks);
}

function wordCount(text) {
    const trimmed = text.trim();
    return trimmed === '' ? 0 : trimmed.split(/\s+/).length;
}

// Removes the parts of one line that sit inside an HTML comment. inComment is
// whether the line opens inside a comment carried over from an earlier line; the
// result carries the state the next line opens in.
function stripComments(line, inComment) {
    const masked = maskBackticks(line);
    let out = '';
    let at = 0;
    let state = inComment;
    while (at < line.length) {
        if (state) {
            const close = masked.indexOf('-->', at);
            if (close === -1) return { text: out, inComment: true };
            at = close + 3;
            state = false;
        } else {
            const open = masked.indexOf('<!--', at);
            if (open === -1) {
                out += line.slice(at);
                break;
            }
            out += line.slice(at, open);
            at = open + 4;
            state = true;
        }
    }
    return { text: out, inComment: state };
}

// Returns the counted text as lines, with every skipped line replaced by an
// empty one so it separates paragraphs the way a blank line does.
function countedLines(text) {
    const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/);
    const out = [];
    let start = 0;
    if (lines[0] !== undefined && lines[0].trimEnd() === '---') {
        const close = lines.findIndex((line, i) => i > 0 && line.trimEnd() === '---');
        if (close !== -1) {
            for (let i = 0; i <= close; i++) out.push('');
            start = close + 1;
        }
    }
    let fence = null;
    let inComment = false;
    for (let i = start; i < lines.length; i++) {
        const line = lines[i];
        const lead = line.trimStart();
        if (fence) {
            const closer = /^(`{3,}|~{3,})\s*$/.exec(lead);
            if (closer && closer[1][0] === fence[0] && closer[1].length >= fence.length) fence = null;
            out.push('');
            continue;
        }
        if (!inComment) {
            const opener = /^(`{3,}|~{3,})/.exec(lead);
            if (opener) {
                fence = opener[1];
                out.push('');
                continue;
            }
            if (lead.startsWith('|')) {
                out.push('');
                continue;
            }
        }
        const stripped = stripComments(line, inComment);
        inComment = stripped.inComment;
        out.push(stripped.text.trim() === '' ? '' : stripped.text);
    }
    return out;
}

export function splitParagraphs(text) {
    const paragraphs = [];
    let current = null;
    for (const line of countedLines(text)) {
        if (line.trim() === '') {
            if (current) paragraphs.push(current.join('\n'));
            current = null;
        } else if (current === null || LIST_ITEM.test(line)) {
            if (current) paragraphs.push(current.join('\n'));
            current = [line];
        } else {
            current.push(line);
        }
    }
    if (current) paragraphs.push(current.join('\n'));
    return paragraphs;
}

export function splitSentences(paragraph) {
    const masked = maskBackticks(paragraph);
    const sentences = [];
    let from = 0;
    for (const match of masked.matchAll(SENTENCE_END)) {
        const end = match.index + match[0].length;
        const sentence = paragraph.slice(from, end).trim();
        if (sentence !== '') sentences.push(sentence);
        from = end;
    }
    const rest = paragraph.slice(from).trim();
    if (rest !== '') sentences.push(rest);
    return sentences;
}

export function measure(text) {
    const row = {
        words: 0, paragraphs: 0, paragraphsOver120: 0, paragraphsOver200: 0, longestParagraph: 0,
        sentences: 0, sentencesOver30: 0, sentencesOver45: 0, longestSentence: 0
    };
    for (const paragraph of splitParagraphs(text).map((raw) => raw.replace(STRUCTURE_MARKER, ''))) {
        const paragraphWords = wordCount(paragraph);
        row.words += paragraphWords;
        row.paragraphs += 1;
        if (paragraphWords > 120) row.paragraphsOver120 += 1;
        if (paragraphWords > 200) row.paragraphsOver200 += 1;
        row.longestParagraph = Math.max(row.longestParagraph, paragraphWords);
        for (const sentence of splitSentences(paragraph)) {
            const sentenceWords = wordCount(sentence);
            row.sentences += 1;
            if (sentenceWords > 30) row.sentencesOver30 += 1;
            if (sentenceWords > 45) row.sentencesOver45 += 1;
            row.longestSentence = Math.max(row.longestSentence, sentenceWords);
        }
    }
    return row;
}

function formatTable(rows) {
    const cells = [COLUMNS.map(([, label]) => label)]
        .concat(rows.map((row) => COLUMNS.map(([key]) => String(row[key]))));
    const widths = COLUMNS.map((_, c) => Math.max(...cells.map((line) => line[c].length)));
    return cells.map((line) => line.map((cell, c) =>
        c === 0 ? cell.padEnd(widths[c]) : cell.padStart(widths[c])).join('  ')).join('\n') + '\n';
}

function main(args) {
    const json = args.includes('--json');
    const unknown = args.filter((arg) => arg.startsWith('--') && arg !== '--json');
    const paths = args.filter((arg) => !arg.startsWith('--'));
    if (unknown.length > 0 || paths.length === 0) {
        for (const arg of unknown) process.stderr.write(`unknown option: ${arg}\n`);
        process.stderr.write('usage: node tools/prose-shape.mjs [--json] <path>...\n');
        return 2;
    }
    const rows = [];
    let failed = false;
    for (const file of paths) {
        try {
            rows.push({ file, ...measure(fs.readFileSync(file, 'utf8')) });
        } catch (err) {
            process.stderr.write(`${file}: ${err && err.message ? err.message : err}\n`);
            failed = true;
        }
    }
    if (failed) return 1;
    process.stdout.write(json
        ? rows.map((row) => JSON.stringify(row)).join('\n') + '\n'
        : formatTable(rows));
    return 0;
}

// Windows paths compare case-insensitively, so a drive letter spelled in a
// different case still reads as this script rather than printing nothing.
function realPathOrResolved(filePath) {
    let resolved;
    try {
        resolved = fs.realpathSync(filePath);
    } catch {
        resolved = path.resolve(filePath);
    }
    return process.platform === 'win32' ? resolved.toLowerCase() : resolved;
}

const invokedDirectly = process.argv[1]
    && realPathOrResolved(process.argv[1]) === realPathOrResolved(fileURLToPath(import.meta.url));
if (invokedDirectly) {
    process.exitCode = main(process.argv.slice(2));
}
