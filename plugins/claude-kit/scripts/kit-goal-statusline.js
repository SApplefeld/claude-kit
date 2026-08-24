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
// kit-goal CLI and Stop hook maintain (see hooks/kit-goal-lib.js). The
// Plans segment appears only when a queue of more than one plan is armed.
//
// The Sections segment is read from the armed plan doc under the plan-doc
// machine contract the curating-docs skill freezes: a section is a
// "### N. Title" heading inside "## Sections of Work", and it is complete
// when a Chapter's first "Completed:" line starts with its number followed
// by a period or a space, or equals its title exactly. So this count agrees
// with the external engine's reading of the same doc, and a section that
// never turns green here is a Completed line the engine will not register
// either. The "Next §N" pointer is read from the last Chapter's first
// "Next:" line, which is free-form: the first section number it opens with
// ("2. Title", "Section 2", "Sections 2 and 4", "§2") is taken, a line
// opening with "finishing" reads as "Next finishing", and any other shape
// yields no pointer. A plan with no Chapters yet points at its first
// section. A missing or unreadable plan doc drops the Sections segment and
// keeps the rest.
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

// The armed goal state, or null when none is armed or the file is unreadable.
function readGoalState(cwd) {
    try {
        const state = JSON.parse(fs.readFileSync(path.join(cwd, '.kit', 'goal-state.json'), 'utf8'));
        if (!state || typeof state !== 'object' || typeof state.plan !== 'string' || state.plan === '') return null;
        return state;
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
    for (const line of text.replace(/^﻿/, '').split(/\r?\n/)) {
        if (/^##\s/.test(line)) {
            const heading = line.replace(/^##\s+/, '').trim();
            block = heading === 'Sections of Work' ? 'sections' : heading === 'Chapters' ? 'chapters' : null;
            chapter = null;
            continue;
        }
        if (block === 'sections') {
            const m = /^###\s+(\d+)\.\s+(.+?)\s*$/.exec(line);
            if (m) sections.push({ num: m[1], title: m[2] });
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

// Whether a Completed line registers a section, per the contract's three forms.
function completes(completed, section) {
    return completed === section.title
        || completed.startsWith(section.num + '.')
        || completed.startsWith(section.num + ' ');
}

// The pointer text from a Next line, or '' when it names no section.
function pointerFrom(next) {
    if (/^finishing/i.test(next)) return 'finishing';
    const m = /^(?:sections?\s*|§)?(\d+)/i.exec(next);
    return m ? '§' + m[1] : '';
}

// { done, total, pointer } for a plan doc's text, or null when it has no sections.
function sectionProgress(text) {
    const { sections, chapters } = parsePlan(text);
    if (sections.length === 0) return null;
    const done = new Set();
    for (const ch of chapters) {
        if (!ch.completed) continue;
        for (const s of sections) {
            if (completes(ch.completed, s)) done.add(s.num);
        }
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
    const parts = [MARKER + ' ' + path.basename(state.plan).replace(/\.md$/i, '')];

    let planText = null;
    try { planText = fs.readFileSync(path.join(cwd, state.plan), 'utf8'); } catch { /* segment dropped */ }
    const progress = planText === null ? null : sectionProgress(planText);
    if (progress) {
        const next = progress.pointer ? ' (Next ' + progress.pointer + ')' : '';
        parts.push(LABEL_SECTIONS + ': ' + progress.done + '/' + progress.total + next);
    }

    if (Array.isArray(state.queue) && state.queue.length > 1 && Number.isInteger(state.queueIndex)) {
        parts.push(LABEL_PLANS + ': ' + (state.queueIndex + 1) + '/' + state.queue.length);
    }
    return parts.join(' · ');
}

function main() {
    let raw = '';
    try { raw = fs.readFileSync(0, 'utf8'); } catch { /* no stdin */ }
    const line = render(cwdFromInput(raw, process.cwd()));
    if (line) process.stdout.write(line);
}

if (require.main === module) main();

module.exports = { cwdFromInput, parsePlan, sectionProgress, pointerFrom, render };
