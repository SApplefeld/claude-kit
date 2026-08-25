#!/usr/bin/env node
// The kit-goal status-line widget: one line describing the goal armed by
// /kit-goal for the current project, for a status-line tool such as
// ccstatusline's Custom Command widget. Prints nothing (exit 0) when no goal
// is armed, so the widget simply stays blank.
//
//   🎯 <plan> · Sections: <done>/<total> (Next §N) · Plans: <i>/<n>
//
// Input is the status-line JSON Claude Code pipes to a status-line command on
// stdin; only the working directory is read from it (workspace.current_dir,
// then cwd), falling back to the process's own cwd when stdin carries no
// JSON. The goal state is read from <cwd>/.kit/goal-state.json, the file the
// kit-goal CLI and Stop hook maintain, through that library's own reader
// (hooks/kit-goal-lib.js), so this widget applies the same kind check, size cap
// and plan-path re-validation the hooks do. The Plans segment appears only when
// a queue of more than one plan is armed, and a state whose queue disagrees with
// its current plan reads as the queue of one that reader normalizes it to.
//
// The Sections segment is read from the armed plan doc under the plan-doc
// machine contract the curating-docs skill freezes: a section is a
// "### N. Title" heading inside "## Sections of Work", and it is complete
// when a Chapter's first "Completed:" line starts with its number followed
// by a period or a space, or equals its title exactly. So this count agrees
// with the external engine's reading of the same doc, and a section that
// never turns green here is a Completed line the engine will not register
// either. One known divergence, on a heading no plan doc should carry: a
// "### N." whose title is whitespace alone is not counted as a section here,
// where the engine's own parser may count it. A titleless heading names
// nothing an operator could act on, so the count is one lower rather than
// pointing at a section that does not exist. The "Next §N" pointer is read from
// the last Chapter's first
// "Next:" line, which is free-form: the first section number it opens with
// ("2. Title", "Section 2", "Sections 2 and 4", "§2") is taken, a line
// opening with "finishing" reads as "Next finishing", and any other shape
// yields no pointer. A plan with no Chapters yet points at its first
// section. A plan doc that is missing, unreadable, not a regular file, or past
// the read cap drops the Sections segment and keeps the rest.
//
// Loaded as a module (the test suite) this only exports its internals; run
// as a CLI it reads stdin and prints.

'use strict';

const fs = require('fs');
const path = require('path');

const LABEL_SECTIONS = 'Sections';
const LABEL_PLANS = 'Plans';
const MARKER = '\u{1F3AF}';

// The working directory named by the status-line JSON, or the fallback.
function cwdFromInput(raw, fallback) {
    try {
        const data = JSON.parse(raw);
        if (data && typeof data === 'object') {
            if (data.workspace && typeof data.workspace.current_dir === 'string' && data.workspace.current_dir) {
                return data.workspace.current_dir;
            }
            if (typeof data.cwd === 'string' && data.cwd) return data.cwd;
        }
    } catch { /* no JSON on stdin: fall back */ }
    return fallback;
}

// The hooks library, or null when this payload does not carry it. The widget
// reads the goal state through that library rather than parsing the file itself,
// so the kind check, the size cap and the plan-path re-validation the hooks
// apply are the ones this reader applies too, and the widget and the hooks
// cannot disagree about what an armed goal is. The require is lazy and
// defensive, the way kit-goal-lib.js itself requires memq: a payload missing the
// hooks directory costs a blank status line, never a crash in the operator's
// prompt. Node caches the module, so this costs one resolution per process.
function goalLib() {
    try {
        return require('../hooks/kit-goal-lib.js');
    } catch {
        return null;
    }
}

// The armed goal state, or null when none is armed, the file is unreadable, or
// the library that reads it is not there.
function readGoalState(cwd) {
    const lib = goalLib();
    if (!lib || typeof lib.readGoal !== 'function') return null;
    const state = lib.readGoal(cwd);
    if (!state || typeof state.plan !== 'string' || state.plan === '') return null;
    return state;
}

// What may not reach a terminal, whatever it came from: the C0 controls and DEL,
// the 8-bit C1 block (where a raw 0x9B is CSI and 0x9D is OSC, so a single byte
// opens an escape sequence), the bidirectional formatting characters (an
// override reverses everything printed after it, which is how a name is made to
// read as something else), the common zero-width characters (ZWSP, ZWNJ, ZWJ,
// the word joiner, the invisible operators and the BOM), the line and paragraph
// separators (a status line is one line), and both halves of a surrogate pair,
// which removes astral-plane characters and, with them, the lone surrogate that
// would otherwise leave this process as invalid UTF-8. The class is not
// unicode-aware on purpose: that is what lets the last item match each half on
// its own.
//
// This is that list and not the category "invisible characters", which is wider
// than what is here: U+180E, the Hangul filler block, U+FFA0 and the variation
// selectors all render as nothing and all survive this. They are a display
// oddity in a plan name rather than a way to act on a terminal, which is what
// this class is drawn against.
const UNSAFE_FOR_TERMINAL = /[\x00-\x1F\x7F-\x9F\u061C\u200B-\u200F\u2028\u2029\u202A-\u202E\u2060-\u2064\u2066-\u2069\uFEFF\uD800-\uDFFF]/g;

// Text this widget is about to print, rendered safe for the operator's terminal
// and capped. Both segments below carry file-derived content: the plan name
// comes from a state file a repository can carry and a hand can edit, and the
// Sections figures come from the plan doc, which is committed content, so a
// clone carries whatever it holds.
//
// This is deliberately not kit-goal-lib.js's safeForReason, which the widget
// could import as readily as it imports planFileSize. The two answer
// different questions: a reason string enters the model's context as trusted
// text and is held to printable ASCII precisely because a name is not worth a
// smuggled instruction, while this line is a name shown to a person, so an
// ordinary non-ASCII filename must survive it and render as itself. A kind check
// may not be respelled, since two spellings would disagree about one path; a
// sanitizer that answers a different question is a different function.
//
// A value that sanitizes away entirely still needs a segment, or the line
// renders a bare marker with a doubled separator after it.
function safeSegment(value) {
    const cleaned = String(value).replace(UNSAFE_FOR_TERMINAL, '').slice(0, 120);
    return cleaned === '' ? '(unprintable)' : cleaned;
}

// The cap on the plan doc this widget reads whole. A plan doc is prose with a
// few hundred lines; a megabyte is far past any real one, and the read happens
// on every status-line refresh, so an unbounded one would be re-read whole each
// time.
const PLAN_MAX_BYTES = 1024 * 1024;

// The armed plan doc's text, or null when it is absent, refused, or oversized.
// The kind check is the library's own planFileSize, imported rather than
// respelled: the plan path is a stored value, so a FIFO at an otherwise
// well-formed in-repo path would block this process, which the harness respawns
// at every refresh, and a link resolving to an in-repo plan doc is a plan doc
// every other reader of that path opens, so this widget must not be the one
// surface that drops its Sections segment over one.
//
// The check narrows rather than closes, the same residual readGoal and
// readCheckpoint state of their own: the open below re-resolves the path, so
// what is opened is not provably what was lstat'ed, and the size is the one read
// at lstat time rather than at the read. What this guard buys is that the
// ordinary case, and every case a planted kind produces, is refused before any
// open happens.
function planText(cwd, planRel) {
    const lib = goalLib();
    if (!lib || typeof lib.planFileSize !== 'function') return null;
    const size = lib.planFileSize(cwd, planRel);
    if (size === null || size > PLAN_MAX_BYTES) return null;
    try {
        return fs.readFileSync(path.join(cwd, planRel), 'utf8');
    } catch {
        return null;
    }
}

// Sections and Chapters of a plan doc, by the machine contract.
function parsePlan(text) {
    const sections = [];
    const chapters = [];
    let block = null;
    let chapter = null;
    for (const line of text.replace(/^\uFEFF/, '').split(/\r?\n/)) {
        if (/^##\s/.test(line)) {
            const heading = line.replace(/^##\s+/, '').trim();
            block = heading === 'Sections of Work' ? 'sections' : heading === 'Chapters' ? 'chapters' : null;
            chapter = null;
            continue;
        }
        if (block === 'sections') {
            // The title is captured greedily and trimmed in JS rather than by a
            // lazy capture with a trailing \s*$. A lazy group expands one
            // character at a time and the trailing whitespace class re-scans the
            // rest of the line at every expansion, which is quadratic in the
            // length of a line shaped '### 1. x<whitespace run>y': measured in
            // seconds at 200 KB and minutes at the 1 MB cap this file reads
            // under, on repo-carried content, in a process the harness respawns
            // at every status-line refresh. Greedy-plus-trim is one pass.
            const m = /^###\s+(\d+)\.\s+(.*)$/.exec(line);
            if (m) {
                const title = m[2].trim();
                if (title) sections.push({ num: m[1], title });
            }
        } else if (block === 'chapters') {
            if (/^###\s+Chapter\s+\d+/.test(line)) {
                chapter = { completed: null, next: null };
                chapters.push(chapter);
                continue;
            }
            if (!chapter) continue;
            const c = /^Completed:\s*(.*)$/.exec(line);
            if (c && chapter.completed === null) chapter.completed = c[1].trim();
            const n = /^Next:\s*(.*)$/.exec(line);
            if (n && chapter.next === null) chapter.next = n[1].trim();
        }
    }
    return { sections, chapters };
}

// The sections indexed for lookup, by the contract's three forms: a Completed
// line registers a section when it equals the title exactly, or opens with the
// section number followed by a period or a space. Titles map to every number
// carrying them (two sections may share a title), and the numbers are a set.
//
// The index is what keeps the count linear. Asking each Completed line about
// each section is O(chapters x sections), which a plan doc can drive as far as
// its byte cap allows: a 1 MB doc of headings reaches hundreds of millions of
// inner iterations and seconds of CPU, on every status-line refresh, in a
// process the harness respawns continuously. Reading a Completed line's own
// leading number instead makes each line two lookups.
//
// The title map holds an array because two sections may carry one title, and
// that array is the one place the product can come back: see the consuming
// delete in sectionProgress, which is what keeps a document of identically
// titled sections linear.
function indexSections(sections) {
    const byTitle = new Map();
    const byNum = new Set();
    for (const s of sections) {
        const nums = byTitle.get(s.title);
        if (nums) nums.push(s.num);
        else byTitle.set(s.title, [s.num]);
        byNum.add(s.num);
    }
    return { byTitle, byNum };
}

// The pointer text from a Next line, or '' when it names no section. The digit
// run is bounded at four: a section number has one or two digits, and the line
// is repo-carried text that reaches a terminal, where an unbounded capture is a
// plan doc's free choice of how long this status line is. A longer run is
// declined rather than truncated: it names no section anyone wrote, and the
// first four digits of it would name a different section nobody wrote either.
function pointerFrom(next) {
    if (/^finishing/i.test(next)) return 'finishing';
    const m = /^(?:sections?\s*|§)?(\d{1,4})(?!\d)/i.exec(next);
    return m ? '§' + m[1] : '';
}

// { done, total, pointer } for a plan doc's text, or null when it has no sections.
function sectionProgress(text) {
    const { sections, chapters } = parsePlan(text);
    if (sections.length === 0) return null;
    const { byTitle, byNum } = indexSections(sections);
    const done = new Set();
    for (const ch of chapters) {
        if (!ch.completed) continue;
        const titled = byTitle.get(ch.completed);
        if (titled) {
            for (const num of titled) done.add(num);
            // Each title's numbers are consumed once. Without this the numbers
            // under one title are walked again for every Completed line naming
            // it, which is the section-by-chapter product the index exists to
            // close, reached by a document whose sections all share a title: a
            // doc inside the 1 MB cap measured in seconds that way. Re-adding is
            // idempotent because done is a Set, so dropping the key after the
            // first line that claims it loses nothing and makes the whole pass
            // linear in sections plus chapters whatever the titles are.
            byTitle.delete(ch.completed);
        }
        const numbered = /^(\d+)[. ]/.exec(ch.completed);
        if (numbered && byNum.has(numbered[1])) done.add(numbered[1]);
    }
    let pointer = '';
    if (chapters.length === 0) pointer = '§' + sections[0].num;
    else {
        const last = chapters[chapters.length - 1];
        if (last.next) pointer = pointerFrom(last.next);
    }
    return { done: done.size, total: sections.length, pointer };
}

// The widget line for a cwd, or '' when nothing is armed there.
function render(cwd) {
    const state = readGoalState(cwd);
    if (!state) return '';
    const parts = [MARKER + ' ' + safeSegment(path.basename(state.plan).replace(/\.md$/i, ''))];

    const text = planText(cwd, state.plan);
    const progress = text === null ? null : sectionProgress(text);
    if (progress) {
        // The whole segment goes through the sanitizer, not just the plan name
        // above it: the pointer is a capture from the plan doc's own Next line,
        // and everything printed here is file-derived.
        const next = progress.pointer ? ' (Next ' + progress.pointer + ')' : '';
        parts.push(safeSegment(LABEL_SECTIONS + ': ' + progress.done + '/' + progress.total + next));
    }

    if (Array.isArray(state.queue) && state.queue.length > 1 && Number.isInteger(state.queueIndex)) {
        parts.push(safeSegment(LABEL_PLANS + ': ' + (state.queueIndex + 1) + '/' + state.queue.length));
    }
    return parts.join(' · ');
}

function main() {
    let raw = '';
    try { raw = fs.readFileSync(0, 'utf8'); } catch { /* no stdin */ }
    // Nothing this function can throw belongs on the operator's prompt. The
    // launcher propagates this process's exit code and its stdio is inherited, so
    // an escaping error would print a stack trace into the status line and exit
    // nonzero; a status line has one failure mode, which is to say nothing.
    //
    // A host that has closed the pipe is caught two ways, because one is not
    // enough on every platform. Where stdout is a synchronous pipe (Windows and
    // Linux) the write throws EPIPE and the try below catches it; on macOS a pipe
    // is asynchronous, the failure surfaces as an 'error' event on the stream,
    // and no try can see it, so the handler is what keeps it from ending the
    // process as an uncaught exception.
    process.stdout.on('error', () => { /* a closed status-line pipe is silence, not a crash */ });
    try {
        const line = render(cwdFromInput(raw, process.cwd()));
        if (line) process.stdout.write(line);
    } catch { /* the widget stays blank */ }
}

if (require.main === module) main();

module.exports = { cwdFromInput, parsePlan, sectionProgress, pointerFrom, render, PLAN_MAX_BYTES };
