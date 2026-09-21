#!/usr/bin/env node
// kit-jev-check: the command a skill runs to ask TypeSafe's Jev model about
// the kit's own work. Its one verb is `spec <path>`, which reads which
// sections of a plan document leave the most unstated, against the fixed
// topic list in jev-coverage-topics.json beside this file. The reading is
// advice: it ranks the plan's sections thinnest first, each with its lowest
// topics, and holds no threshold, no pass and no fail. A low score is a
// pointer to re-read the section against those topics, never a finding.
//
// WHAT ONE REQUEST CARRIES. One request per section, in document order,
// through jev-client.js, which owns the wire, the config read and the key.
// The request body is exactly `{ state: { spec: <section text> }, model,
// questions }`. The section text runs from its `### N.` heading line to the
// line before the next line outside a code fence that opens with `## ` or
// `### `, so a `####` heading stays inside its section, a fenced `### N.`
// line starts nothing, and the document's header lines and the `## Sections
// of Work` heading sit outside every section. A fence opens on a line of
// three or more backticks or tildes and closes only on a line of the same
// character at least as long and carrying nothing else, each with up to three
// leading spaces. A plan
// whose fence is still open at its end is a usage refusal, since that fence
// would carry every later section inside one request. The questions are one per
// topic, keyed `c_<topic id>`. A topic's family serves the local means and is
// never sent. Nothing else rides: not the path, not the plan's title, not
// another section's text, not any environment value.
//
// ALL OR NOTHING. The topic file and every section's length are checked
// before the first request. Output is buffered and printed only once every
// section answered. The first refused request stops the run, and nothing
// partial prints.
//
// THREE CLOSING LINES, THREE EXIT CODES.
//
//   jev coverage: <n> sections, thinnest <N> at <mean>   exit 0
//   jev coverage: not checked (<reason>)                 exit 2
//   jev coverage: not configured                         exit 2
//
// The report above the closing line opens with `model <m>, input tokens <n>`,
// so the closing line is the only stdout line that opens with `jev coverage:`.
// The model name comes from the one config read this tool makes, before the
// first send. The not-checked reason is the client's, or this tool's own
// `section too long` for a section past 60,000 UTF-16 code units, counted as
// JavaScript's String.length. A usage refusal (a missing verb or path, a path
// that is not a plan document, a topic file that cannot be used) is one line
// on stderr naming the usage, exit 1, and sends nothing. The tool writes no
// file and keeps no state.

'use strict';

const fs = require('fs');
const path = require('path');

const { askJev, loadJevConfig } = require('./jev-client.js');

const TOPICS_PATH = path.join(__dirname, 'jev-coverage-topics.json');

// The caller's policy for the client: one deadline over each section's call,
// retries included, and two retries at these delays.
const TIMEOUT_MS = 20000;
const RETRY_DELAYS_MS = [1000, 4000];

// A section longer than this many UTF-16 code units (String.length) is not
// sent.
const MAX_SECTION_CHARS = 60000;

const FAMILIES = new Set(['code', 'prose']);

const USAGE = 'usage: node kit-jev-check.js spec <path-to-plan.md>';

const CLOSING_SENTENCE = 'A low score is a pointer to re-read the section against its lowest topics, never a finding.';

// ------------------------------------------------------------------ topics --

// The topic list, read field by field, or a described refusal. Every entry
// must carry a non-empty `id` no other entry carries, a `family` of `code` or
// `prose`, and a non-empty `text`. A repeated id would key two questions to
// one answer. The tool asks whatever well-formed topics the file holds and
// does not count them.
function readTopics(file) {
    let raw = '';
    try {
        raw = fs.readFileSync(file, 'utf8');
    } catch {
        return { ok: false, detail: 'topic file could not be read' };
    }
    let parsed = null;
    try {
        parsed = JSON.parse(raw);
    } catch {
        return { ok: false, detail: 'topic file is not JSON' };
    }
    if (!Array.isArray(parsed) || parsed.length === 0) {
        return { ok: false, detail: 'topic file is not a non-empty array' };
    }
    const topics = [];
    const seen = new Set();
    for (const entry of parsed) {
        if (entry === null || typeof entry !== 'object' || Array.isArray(entry)) {
            return { ok: false, detail: 'a topic is not an object' };
        }
        if (typeof entry.id !== 'string' || entry.id === '') {
            return { ok: false, detail: 'a topic has no id' };
        }
        if (seen.has(entry.id)) {
            return { ok: false, detail: 'a topic id is repeated' };
        }
        seen.add(entry.id);
        if (typeof entry.family !== 'string' || !FAMILIES.has(entry.family)) {
            return { ok: false, detail: 'a topic has no family of code or prose' };
        }
        if (typeof entry.text !== 'string' || entry.text === '') {
            return { ok: false, detail: 'a topic has no text' };
        }
        topics.push({ id: entry.id, family: entry.family, text: entry.text });
    }
    return { ok: true, topics };
}

// One `noul` question per topic, keyed by the topic's id. The family is not
// part of the question and never leaves the machine.
function questionsFor(topics) {
    const questions = {};
    for (const topic of topics) {
        questions[`c_${topic.id}`] = {
            type: 'noul',
            instructions: `Does the specification in \`spec\` explicitly state ${topic.text}?`,
            criteria: {
                true: 'Yes, the text states this explicitly.',
                false: 'No, the text is silent on this or only implies it.'
            }
        };
    }
    return questions;
}

// -------------------------------------------------------------------- plan --

const SECTIONS_HEADING = /^## Sections of Work\s*$/;
const SECTION_HEADING = /^### (\d+)\.\s+(.*)$/;
const FENCE = /^ {0,3}(`{3,}|~{3,})/;

// The plan's sections under `## Sections of Work`, in document order, each as
// `{ number, title, text }`, or a described refusal. Lines are read with
// their line endings stripped and a section's text is its lines joined by
// `\n`. A fence opens on a fence line and closes on a line of its own
// character at least as long as the opening run with nothing but spaces after
// it, and a heading inside a fence is text. The block opens at the first `## Sections of Work` line and closes
// at the next `## ` line. Inside it, a `### N.` line opens a section and any
// other `### ` line closes one without opening another. Fences are tracked to
// the end of the document, past the block, so a fence open at the end is
// refused wherever it opened.
function parsePlan(source) {
    const lines = source.split('\n').map((line) => line.replace(/\r$/, ''));
    const sections = [];
    let fence = null;
    let inBlock = false;
    let blockDone = false;
    let current = null;

    for (const line of lines) {
        const run = FENCE.exec(line);
        if (fence !== null) {
            if (run !== null && run[1][0] === fence.char && run[1].length >= fence.length && line.slice(run[0].length).trim() === '') fence = null;
            if (current !== null) current.lines.push(line);
            continue;
        }
        if (run !== null) {
            fence = { char: run[1][0], length: run[1].length };
            if (current !== null) current.lines.push(line);
            continue;
        }
        if (blockDone) continue;
        if (!inBlock) {
            if (SECTIONS_HEADING.test(line)) inBlock = true;
            continue;
        }
        if (line.startsWith('## ')) {
            blockDone = true;
            current = null;
            continue;
        }
        const heading = SECTION_HEADING.exec(line);
        if (heading !== null) {
            current = { number: heading[1], title: heading[2].trim(), lines: [line] };
            sections.push(current);
            continue;
        }
        if (line.startsWith('### ')) {
            current = null;
            continue;
        }
        if (current !== null) current.lines.push(line);
    }

    if (fence !== null) return { ok: false, detail: 'the plan has a code fence that never closes' };
    if (!inBlock) return { ok: false, detail: 'the plan carries no `## Sections of Work` heading' };
    if (sections.length === 0) return { ok: false, detail: 'the plan carries no `### N.` section under `## Sections of Work`' };
    return {
        ok: true,
        sections: sections.map((s) => ({ number: s.number, title: s.title, text: s.lines.join('\n') }))
    };
}

// The plan at the path, parsed, or a described refusal. The path must end
// in `.md` and the file must be readable.
function readPlan(file) {
    if (typeof file !== 'string' || file === '') return { ok: false, detail: 'no plan path was given' };
    if (!file.endsWith('.md')) return { ok: false, detail: 'the plan path must end in .md' };
    let source = '';
    try {
        source = fs.readFileSync(file, 'utf8');
    } catch {
        return { ok: false, detail: 'the plan could not be read' };
    }
    return parsePlan(source);
}

// ----------------------------------------------------------------- reading --

function mean(values) {
    return values.reduce((sum, v) => sum + v, 0) / values.length;
}

function fixed(value) {
    return value.toFixed(2);
}

// A section's scores from its answers: the mean over every topic, the two
// family means, and the topics from lowest value up, ties in topic-file order.
function scoreSection(topics, answers) {
    const scored = topics.map((topic) => ({ id: topic.id, family: topic.family, value: answers[`c_${topic.id}`].noul }));
    const byFamily = (family) => scored.filter((s) => s.family === family).map((s) => s.value);
    const code = byFamily('code');
    const prose = byFamily('prose');
    const lowest = scored.slice().sort((a, b) => a.value - b.value).slice(0, 3);
    return {
        mean: mean(scored.map((s) => s.value)),
        code: code.length === 0 ? null : mean(code),
        prose: prose.length === 0 ? null : mean(prose),
        lowest
    };
}

// The whole report as lines, thinnest section first, ties in document order.
function renderReport(model, inputTokens, results) {
    const ranked = results.slice().sort((a, b) => a.score.mean - b.score.mean);
    const lines = [`model ${model}, input tokens ${inputTokens}`];
    for (const r of ranked) {
        const family = (label, value) => `${label} ${value === null ? 'n/a' : fixed(value)}`;
        lines.push(`section ${r.number}. ${r.title}: mean ${fixed(r.score.mean)}, ${family('code', r.score.code)}, ${family('prose', r.score.prose)}`);
        lines.push(`  lowest: ${r.score.lowest.map((s) => `${s.id} ${fixed(s.value)}`).join(', ')}`);
    }
    const thinnest = ranked[0];
    lines.push(`jev coverage: ${results.length} sections, thinnest ${thinnest.number} at ${fixed(thinnest.score.mean)}`);
    lines.push(CLOSING_SENTENCE);
    return lines;
}

// --------------------------------------------------------------------- cli --

function refuseUsage(detail) {
    process.stderr.write(`kit-jev-check: ${detail}; ${USAGE}\n`);
    process.exitCode = 1;
}

function notChecked(reason) {
    process.stdout.write(reason === 'not configured' ? 'jev coverage: not configured\n' : `jev coverage: not checked (${reason})\n`);
    process.exitCode = 2;
}

async function spec(file) {
    const topics = readTopics(TOPICS_PATH);
    if (!topics.ok) return refuseUsage(topics.detail);
    const plan = readPlan(file);
    if (!plan.ok) return refuseUsage(plan.detail);

    // Every length is checked before any send, so a long third section stops
    // the run before the first request.
    if (plan.sections.some((s) => s.text.length > MAX_SECTION_CHARS)) return notChecked('section too long');

    // The config is read once here, for the header's model name, and a config
    // this read cannot use stops the run on the reasons the client gives the
    // same config: `absent` is not configured and any other is config
    // unusable. Each send still goes through the client, which reads the
    // config on its own.
    const config = loadJevConfig();
    if (!config.ok) return notChecked(config.reason === 'absent' ? 'not configured' : 'config unusable');

    const questions = questionsFor(topics.topics);
    const results = [];
    let inputTokens = 0;
    for (const section of plan.sections) {
        const answer = await askJev({ spec: section.text }, questions, TIMEOUT_MS, RETRY_DELAYS_MS);
        if (!answer.ok) return notChecked(answer.reason);
        inputTokens += answer.inputTokens;
        results.push({ number: section.number, title: section.title, score: scoreSection(topics.topics, answer.answers) });
    }

    process.stdout.write(renderReport(config.model, inputTokens, results).join('\n') + '\n');
    process.exitCode = 0;
}

async function main(argv) {
    const [verb, file, ...rest] = argv;
    if (verb === undefined) return refuseUsage('no verb was given');
    if (verb !== 'spec') return refuseUsage('the only verb is spec');
    if (rest.length > 0) return refuseUsage('spec takes one path');
    return spec(file);
}

module.exports = {
    TOPICS_PATH,
    readTopics,
    questionsFor,
    parsePlan,
    readPlan,
    scoreSection,
    renderReport
};

if (require.main === module) main(process.argv.slice(2));
