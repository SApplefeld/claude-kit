// The fleet memory block's judge: the policy that sits between the shared
// memory database's search shortlist and the block session start and `memq
// recall` print. It composes the situation the judge reads, asks TypeSafe's
// Jev one question per candidate through the shared client, selects what the
// block shows, and records what it judged so a later `memq get` can be keyed
// to it. The block itself (the database query, the hit shape and the line
// rendering) stays in memq.js, which calls the pieces here in order.
//
// WHERE THE DATA GOES. One call sends the composed situation as state, and each
// candidate's name, description and status inside its question, to the
// endpoint the shared client reads from `~/.claude/kit-jev.json`. Record bodies
// never ride: a candidate is built from three fields of a search row and
// nothing else, and the question shape is the one the recognition battery
// measured the floors with. The situation is assembled from files and never
// from a model: the in-progress plan's Goal, its Intent where it has one, and
// the full text of the section its latest Chapter's `Next:` line names; on a
// resume or a compaction the operator's last message from the transcript joins
// it; with no plan in progress the branch name and the last three commit
// titles stand in; and a `memq recall` may pass its own one-line situation.
//
// THE POLICY LIVES HERE AND NOT IN THE CLIENT. The fetch limit, the two floors,
// the budget edge and the retry delay are this module's constants. The shared
// client holds no caller's policy, so a coverage check that waits twenty
// seconds and this judge that must answer inside a session start share one
// wire and two policies.
//
// EVERY FAILURE IS A STAND-DOWN, NEVER A THROW. A judge that cannot answer
// resolves to a reason and the sentence the block prints beside the vector
// list it shows instead; a judge that is not configured resolves to a reason
// and no sentence, since a machine with no config hears nothing about one.
// No sentence here is built from a runtime error's message, on the client's
// own rule: a thrown call is named as a failed call and nothing more.
//
// THE KEY. This module never reads `TYPESAFE_API_KEY`. The client reads it
// inside the call and returns no object that carries it, so nothing here can
// write it: not the shown file, not a stand-down line, not a thrown error.

'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const client = require('./jev-client.js');
const goalLib = require('../hooks/kit-goal-lib.js');
const gitLib = require('../hooks/kit-git-lib.js');
const readLib = require('../hooks/kit-read-lib.js');
const compact = require('../hooks/kit-compact-lib.js');

// memq loads this module in its fixed sibling block, and this module reaches
// back to memq for one helper, the shared-write lock, so the require is
// deferred to the call that needs it: a top-level require here would run
// while memq is still evaluating and hand this module memq's empty export
// object, the cycle memory-database.js defers its own require for.
function memqLib() {
    return require('./memq.js');
}

// ------------------------------------------------------------- constants --

// How many candidates stage 1 fetches for the judge to read. The block shows
// five or ten; thirty gives the judge headroom past the procedure's own order.
const FETCH_LIMIT = 30;

// The two floors, in probability. The top-scoring candidate shows where its
// score reaches FIRST_FLOOR, and every further candidate where its score
// reaches SECOND_FLOOR. Both are the values the recognition battery measured
// on this fleet's store and the operator ruled.
const FIRST_FLOOR = 0.70;
const SECOND_FLOOR = 0.75;

// The judge's edge inside the block's 2,000 ms budget, measured from the
// block's start. Past it the block falls back to the vector list, leaving the
// render its margin.
const BUDGET_EDGE_MS = 1500;

// One retry on a 429 or 529, this long after the first answer, and only where
// the client can fit it before the deadline.
const RETRY_DELAY_MS = 200;

// The composed situation's cap in characters, since a plan section can run
// long and the operator's concern is cost and wait time. The section text is
// trimmed first, then the Intent, never the Goal.
const STATE_CAP = 6000;

// The operator's last message is trimmed to this before it joins the
// situation, so one pasted document does not spend the whole cap.
const MESSAGE_CAP = 1000;

// A trimmed part ends in this marker, so the judge reads a cut as a cut.
const CUT_MARK = ' [cut]';

// How much of a transcript's end is read for the operator's last message. The
// newest human turn sits near the end, and a bounded read keeps a long
// session's transcript from becoming a whole-file read at a session start.
const TRANSCRIPT_TAIL_BYTES = 256 * 1024;

// The most a plan doc is read for its Goal, Intent and one section.
const PLAN_READ_BYTES = 1024 * 1024;

// How many plan docs the in-progress scan lists at most.
const PLANS_LISTED_MAX = 200;

// The directory plan docs live in, relative to the project root, and the
// file the judged candidates are recorded in under the project's scratch
// directory.
const PLANS_DIR = path.join('docs', 'plans');
const SHOWN_FILE = 'jev-shown.json';

// The question and its two criteria sentences, verbatim from the recognition
// battery (sidecar/batteries/jev-recognition-v1/run.js), whose measured floors
// hold for this wording and no other. The instructions object beside them is
// the battery's shape too: the question, then the record's title, description
// and status under the battery's own keys.
const QUESTION = 'The state describes what an AI coding agent is doing or just observed. '
    + 'Would reading the memory record below, right now, change what the agent does next? '
    + 'Most situations match zero or one records; do not invent relevance.';
const CRITERIA_TRUE = 'Reading this record now would change what the agent does next.';
const CRITERIA_FALSE = 'This record does not bear on the situation.';

// The line the block prints where the judge read the shortlist and nothing in
// it clears the first floor. A judged result rather than a stand-down.
const NO_RECORD_LINE = 'No fleet record bears on this project\'s recent work, as the shared'
    + ' memory database\'s judge read its nearest thirty.';

// --------------------------------------------------------------- the judge --

// Whether this machine has a Jev config at all, read through the client so
// the two cannot disagree about where the file is. An unconfigured machine
// takes the block as it was before the judge existed.
function judgeConfigured(deps) {
    const load = deps && typeof deps.loadJevConfig === 'function' ? deps.loadJevConfig : client.loadJevConfig;
    const config = load();
    return config !== null && typeof config === 'object' && config.ok === true;
}

// One search hit as the candidate the judge is asked about: the three fields
// the question carries, the hit's position in the thirty as the procedure
// ordered them, and nothing else of the record. Status is `archived` where the
// row's archived key is set, else `live`.
function candidateOf(hit, rank) {
    return {
        rank,
        name: typeof hit.name === 'string' ? hit.name : '',
        description: typeof hit.description === 'string' ? hit.description : '',
        status: hit.archived === true ? 'archived' : 'live'
    };
}

// The question set, one `noul` per candidate keyed `c1` to `cN` in the
// candidates' order, so an answer reads back positionally.
function questionsFor(candidates) {
    const questions = {};
    candidates.forEach((c, i) => {
        questions['c' + (i + 1)] = {
            type: 'noul',
            instructions: {
                question: QUESTION,
                record_title: c.name,
                record_description: c.description,
                record_status: c.status
            },
            criteria: { true: CRITERIA_TRUE, false: CRITERIA_FALSE }
        };
    });
    return questions;
}

// The sentence the block prints beside the vector list when the judge stood
// down, or null for a machine with no config, which hears nothing. The reason
// and detail are the client's own literals, never a runtime error's message.
function standDownLine(reason, detail) {
    if (reason === 'not configured') return null;
    if (reason === 'no key') {
        return 'The fleet judge stood down because TYPESAFE_API_KEY is not set in this process\'s'
            + ' environment, so these are the records nearest by vector rather than the ones it'
            + ' judged.';
    }
    const named = typeof detail === 'string' && detail !== '' ? reason + ': ' + detail : reason;
    return 'The fleet judge was unavailable (' + named + '), so these are the records nearest by'
        + ' vector rather than the ones it judged.';
}

function standDown(reason, detail) {
    return { ok: false, reason, detail, line: standDownLine(reason, detail) };
}

// Ask the judge about every candidate against the state, inside what remains
// of the budget edge measured from `options.startedMs`. Resolves to
// `{ ok: true, scores, inputTokens }` with one score per candidate in order,
// or to a stand-down `{ ok: false, reason, detail, line }`. Never throws and
// never rejects.
//
// `options.deps.askJev` and `options.deps.now` replace the client and the
// clock, which is how the tests drive every stand-down without a network.
async function judge(state, candidates, options) {
    const opts = options || {};
    const deps = opts.deps || {};
    const now = typeof deps.now === 'function' ? deps.now : Date.now;
    const ask = typeof deps.askJev === 'function' ? deps.askJev : client.askJev;
    const started = Number.isFinite(opts.startedMs) ? opts.startedMs : now();

    const remaining = BUDGET_EDGE_MS - (now() - started);
    if (remaining <= 0) return standDown('timeout', 'the budget edge passed before the judge was asked');

    const questions = questionsFor(candidates);
    let answered = null;
    try {
        answered = await ask(state, questions, remaining, [RETRY_DELAY_MS]);
    } catch {
        return standDown('unreachable', 'the call failed');
    }
    // An answer that arrives past the edge is one the block can no longer
    // spend its render margin on, so it is not read.
    if (now() - started > BUDGET_EDGE_MS) return standDown('timeout', 'the judge answered past the budget edge');
    if (answered === null || typeof answered !== 'object') return standDown('unusable answer', 'no answer object');
    if (answered.ok !== true) {
        const reason = typeof answered.reason === 'string' ? answered.reason : 'unusable answer';
        return standDown(reason, typeof answered.detail === 'string' ? answered.detail : undefined);
    }
    const answers = answered.answers;
    const scores = [];
    for (let i = 0; i < candidates.length; i += 1) {
        const answer = answers !== null && typeof answers === 'object' ? answers['c' + (i + 1)] : undefined;
        const p = answer !== null && typeof answer === 'object' ? answer.noul : undefined;
        if (typeof p !== 'number' || !(p >= 0 && p <= 1)) {
            return standDown('unusable answer', 'a candidate has no score from 0 to 1');
        }
        scores.push(p);
    }
    return { ok: true, scores, inputTokens: Number.isInteger(answered.inputTokens) ? answered.inputTokens : 0 };
}

// The candidates the block shows, from scored candidates (each carrying
// `score` and `rank`): ordered by judge score, the top one where it reaches
// the first floor, every further one where it reaches the second, capped at
// `limit`. A tie in score keeps the procedure's order. An empty answer is the
// judged no-record result rather than a stand-down.
function selectShown(scored, limit) {
    const ordered = scored.slice().sort((a, b) => (b.score - a.score) || (a.rank - b.rank));
    if (ordered.length === 0 || ordered[0].score < FIRST_FLOOR) return [];
    const shown = [ordered[0]];
    for (const c of ordered.slice(1)) {
        if (c.score >= SECOND_FLOOR) shown.push(c);
    }
    return shown.slice(0, Math.max(0, Math.floor(limit)));
}

// ----------------------------------------------------------- the composer --

const FENCE = /^ {0,3}(`{3,}|~{3,})/;

// The parts of a plan doc the situation is built from: the title, the Goal and
// Intent text, every `### N. Title` section under `## Sections of Work` with
// its full text, and the latest Chapter's `Next:` line. A fence is tracked
// wherever it opens, so a heading inside one is text.
function planParts(text) {
    const lines = text.replace(/^﻿/, '').split(/\r?\n/);
    const parts = { title: null, goal: [], intent: [], sections: [], next: null };
    let block = null;
    let fence = null;
    let section = null;
    let chapter = null;
    const push = (line) => {
        if (block === 'goal') parts.goal.push(line);
        else if (block === 'intent') parts.intent.push(line);
        else if (block === 'sections' && section !== null) section.lines.push(line);
    };
    for (const line of lines) {
        const run = FENCE.exec(line);
        if (fence !== null) {
            if (run !== null && run[1][0] === fence.char && run[1].length >= fence.length
                && line.slice(run[0].length).trim() === '') fence = null;
            push(line);
            continue;
        }
        if (run !== null && !(run[1][0] === '`' && line.slice(run[0].length).includes('`'))) {
            fence = { char: run[1][0], length: run[1].length };
            push(line);
            continue;
        }
        if (parts.title === null && /^#\s+\S/.test(line)) {
            parts.title = line.replace(/^#\s+/, '').trim();
            continue;
        }
        const h2 = /^##\s+(.*)$/.exec(line);
        if (h2 !== null) {
            const name = h2[1].trim();
            block = name === 'Goal' ? 'goal' : name === 'Intent' ? 'intent'
                : name === 'Sections of Work' ? 'sections' : name === 'Chapters' ? 'chapters' : null;
            section = null;
            chapter = null;
            continue;
        }
        if (block === 'sections') {
            const heading = /^###\s+(\d+)\.\s+(.*)$/.exec(line);
            if (heading !== null) {
                section = { number: heading[1], title: heading[2].trim(), lines: [line] };
                parts.sections.push(section);
                continue;
            }
            if (/^###\s/.test(line)) {
                section = null;
                continue;
            }
            push(line);
        } else if (block === 'chapters') {
            if (/^###\s+Chapter\s+\d+/.test(line)) {
                chapter = { next: null };
                parts.next = null;
                continue;
            }
            if (chapter !== null && chapter.next === null) {
                const n = /^Next:\s*(.*)$/.exec(line);
                if (n !== null) {
                    chapter.next = n[1].trim();
                    parts.next = chapter.next;
                }
            }
        } else {
            push(line);
        }
    }
    return parts;
}

// The section a Chapter's `Next:` line names: by the number it opens with
// (`2. Title`, `Section 2`, `§2`), else by exact title; null where it names
// none, as `Next: finishing-work` does.
function sectionForNext(next, sections) {
    if (typeof next !== 'string' || next === '') return null;
    const m = /^(?:sections?\s*|§)?(\d{1,4})(?!\d)/i.exec(next);
    if (m !== null) {
        const found = sections.find((s) => s.number === m[1]);
        if (found !== undefined) return found;
    }
    return sections.find((s) => s.title === next.trim()) || null;
}

// A part cut to `allowed` characters with the marker on its end, or null
// where nothing legible would remain.
function cut(text, allowed) {
    if (allowed <= CUT_MARK.length) return null;
    return text.slice(0, allowed - CUT_MARK.length) + CUT_MARK;
}

// The situation text from a plan's parts and the operator's message, under
// STATE_CAP: the section is trimmed first, then the Intent, never the Goal or
// the message, which is already held to its own cap.
function assembleState(parts, message) {
    const goal = parts.goal.join('\n').trim();
    let intent = parts.intent.join('\n').trim();
    const named = sectionForNext(parts.next, parts.sections);
    let section = named === null ? '' : named.lines.join('\n').trim();
    const build = () => [
        'Plan: ' + parts.title,
        'Goal: ' + goal,
        intent === '' ? null : 'Intent: ' + intent,
        section === '' ? null : 'Next section: ' + section,
        message === null ? null : 'Operator\'s last message: ' + message
    ].filter((p) => p !== null).join('\n\n');
    let text = build();
    if (text.length > STATE_CAP && section !== '') {
        const trimmed = cut(section, STATE_CAP - (text.length - section.length));
        section = trimmed === null ? '' : trimmed;
        text = build();
    }
    if (text.length > STATE_CAP && intent !== '') {
        const trimmed = cut(intent, STATE_CAP - (text.length - intent.length));
        intent = trimmed === null ? '' : trimmed;
        text = build();
    }
    return text;
}

// The in-progress plan under the project root as `{ rel, text }`, or null.
// A plan is in progress where its header's Status row reads so under the goal
// library's reading, the one the leash acts on. Where several do, the one an
// armed kit goal names wins, else the most recently modified.
function inProgressPlan(cwd) {
    const dir = path.join(cwd, PLANS_DIR);
    const listing = readLib.listBoundedNames(dir, PLANS_LISTED_MAX,
        (entry) => entry.isFile() && entry.name.endsWith('.md'));
    const found = [];
    for (const name of listing.names) {
        const rel = 'docs/plans/' + name;
        const readings = goalLib.planStatusReadings(cwd, rel);
        if (!readings.exists || readings.status !== 'in progress') continue;
        let mtimeMs = 0;
        try { mtimeMs = fs.statSync(path.join(dir, name)).mtimeMs; } catch { /* listed a moment ago; ranks last */ }
        found.push({ rel, mtimeMs });
    }
    if (found.length === 0) return null;
    let chosen = null;
    if (found.length > 1) {
        const state = goalLib.readGoal(cwd);
        const armed = state !== null && typeof state.plan === 'string' ? state.plan : null;
        chosen = found.find((p) => p.rel === armed) || null;
    }
    if (chosen === null) chosen = found.reduce((a, b) => (b.mtimeMs > a.mtimeMs ? b : a));
    const read = readLib.readFileBounded(path.join(cwd, chosen.rel), PLAN_READ_BYTES);
    if (read === null) return null;
    return { rel: chosen.rel, text: read.text };
}

// Whether a parsed transcript line is a human turn: a `user` line the
// harness did not inject (the isMeta, isSidechain and isCompactSummary
// flags kit-compact-lib screens on), whose content is a plain string or an
// array of text blocks with no tool_result among them.
function humanTurnText(entry) {
    if (entry === null || typeof entry !== 'object') return null;
    if (entry.type !== 'user') return null;
    if (entry.isSidechain || entry.isMeta === true || entry.isCompactSummary === true) return null;
    const content = entry.message && entry.message.content;
    if (typeof content === 'string') return content;
    if (!Array.isArray(content)) return null;
    const texts = [];
    for (const block of content) {
        if (block === null || typeof block !== 'object') return null;
        if (block.type === 'tool_result') return null;
        if (block.type === 'text' && typeof block.text === 'string') texts.push(block.text);
    }
    return texts.length === 0 ? null : texts.join('\n');
}

// The operator's last message in the transcript's tail, held to MESSAGE_CAP,
// or null where the path is absent, unusable or holds no human turn in the
// tail. The read is bounded and from the end, never the whole file, and the
// first line of a tail that does not start at the file's head is skipped
// since the read may have begun inside it.
function lastOperatorMessage(transcriptPath) {
    if (!goalLib.storablePathValue(transcriptPath, 512, false)) return null;
    let fd = null;
    try {
        const st = fs.statSync(transcriptPath);
        if (!st.isFile()) return null;
        const length = Math.min(st.size, TRANSCRIPT_TAIL_BYTES);
        const start = st.size - length;
        fd = fs.openSync(transcriptPath, 'r');
        const text = readLib.readFully(fd, start, length);
        const lines = text.split('\n');
        if (start > 0) lines.shift();
        for (let i = lines.length - 1; i >= 0; i -= 1) {
            let entry = null;
            try { entry = JSON.parse(lines[i]); } catch { continue; }
            const found = humanTurnText(entry);
            if (found === null || found.trim() === '') continue;
            const message = found.trim();
            return message.length > MESSAGE_CAP ? cut(message, MESSAGE_CAP) : message;
        }
        return null;
    } catch {
        return null;
    } finally {
        if (fd !== null) {
            try { fs.closeSync(fd); } catch { /* already closed */ }
        }
    }
}

// The situation with no plan in progress: the branch name and the last three
// commit titles, through the hooks' guarded git runner. '' where the
// directory is not a repository git will answer about.
function gitSituation(cwd) {
    const branch = gitLib.gitOutput(cwd, ['rev-parse', '--abbrev-ref', 'HEAD']);
    const titles = gitLib.gitOutput(cwd, ['log', '-3', '--format=%s']);
    const parts = [];
    if (branch !== null && branch.trim() !== '') parts.push('Branch: ' + branch.trim());
    const lines = titles === null ? [] : titles.split('\n').map((t) => t.trim()).filter((t) => t !== '');
    if (lines.length > 0) parts.push('Recent commits:\n' + lines.map((t) => '- ' + t).join('\n'));
    return parts.join('\n\n');
}

// The situation text for a project root, from files and with no model call,
// or '' where nothing composes one. `options.source` is the session start's
// trigger, and on `resume` or `compact` the operator's last message from
// `options.transcriptPath` joins the plan's text.
function composeSituation(cwd, options) {
    const opts = options || {};
    const plan = inProgressPlan(cwd);
    if (plan === null) return gitSituation(cwd);
    const parts = planParts(plan.text);
    if (parts.title === null) parts.title = path.basename(plan.rel, '.md');
    const message = (opts.source === 'resume' || opts.source === 'compact')
        ? lastOperatorMessage(opts.transcriptPath) : null;
    return assembleState(parts, message);
}

// ---------------------------------------------------------- the shown file --

// The file the judged candidates are recorded in, under the project's scratch
// directory as kit-compact-lib resolves it. The directory is read off the
// checkpoint path, the one exported reader of that resolver, so a
// store-governed working directory redirects this file exactly as it
// redirects every other kit scratch file.
function shownFilePath(cwd) {
    return path.join(compact.kitScratchDir(cwd), SHOWN_FILE);
}

// One entry per judged candidate, for a session: the record name, a fresh
// recognition id, the judge's score, the stage-1 rank, whether the block
// showed it, the time, and `marked` null until a `memq get` keys it.
function shownEntries(sessionId, scored, shown, nowMs) {
    const shownSet = new Set(shown);
    const time = new Date(nowMs).toISOString();
    return scored.map((c) => ({
        session: sessionId,
        name: c.name,
        recognitionId: crypto.randomUUID(),
        score: c.score,
        rank: c.rank,
        shown: shownSet.has(c),
        time,
        marked: null
    }));
}

// Append entries to the shown file, under memq's shared-write lock, by a
// read of the whole list and an atomic replace, so a peer session's append
// landing beside this one truncates nothing. `{ ok: true }` or a named
// omission `{ ok: false, reason }`: no session id of the harness's shape, a
// lock held past the short wait, a file holding something other than a list,
// or a write that failed. Never throws.
function appendShown(cwd, sessionId, entries) {
    if (!goalLib.isSessionIdShaped(sessionId)) return { ok: false, reason: 'no session id' };
    if (!Array.isArray(entries) || entries.length === 0) return { ok: false, reason: 'nothing judged' };
    const file = shownFilePath(cwd);
    let lock;
    try {
        fs.mkdirSync(path.dirname(file), { recursive: true });
        lock = memqLib().acquireLock(file + '.lock', { waitMs: 250, staleMs: 5000 });
    } catch {
        return { ok: false, reason: 'lock failed' };
    }
    if (!lock.ok) return { ok: false, reason: 'lock held' };
    try {
        let existing = [];
        try {
            existing = JSON.parse(fs.readFileSync(file, 'utf8'));
        } catch (err) {
            if (!(err && err.code === 'ENOENT')) return { ok: false, reason: 'file unreadable' };
        }
        if (!Array.isArray(existing)) return { ok: false, reason: 'file is not a list' };
        const tmp = file + '.' + process.pid + '.tmp';
        fs.writeFileSync(tmp, JSON.stringify(existing.concat(entries), null, 2) + '\n', 'utf8');
        fs.renameSync(tmp, file);
        return { ok: true };
    } catch {
        return { ok: false, reason: 'write failed' };
    } finally {
        lock.release();
    }
}

module.exports = {
    FETCH_LIMIT,
    FIRST_FLOOR,
    SECOND_FLOOR,
    BUDGET_EDGE_MS,
    RETRY_DELAY_MS,
    STATE_CAP,
    MESSAGE_CAP,
    QUESTION,
    CRITERIA_TRUE,
    CRITERIA_FALSE,
    NO_RECORD_LINE,
    SHOWN_FILE,
    judgeConfigured,
    candidateOf,
    questionsFor,
    standDownLine,
    judge,
    selectShown,
    planParts,
    sectionForNext,
    assembleState,
    inProgressPlan,
    lastOperatorMessage,
    gitSituation,
    composeSituation,
    shownFilePath,
    shownEntries,
    appendShown
};
