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
// JSON. The goal state, the .kit/goal-state.json the kit-goal CLI and Stop
// hook maintain, is read through that library's own reader
// (hooks/kit-goal-lib.js), which also resolves where the file lives: under
// the project root, with a linked worktree resolving to its main checkout. So
// this widget reads the same file the hooks read wherever it renders, and
// applies the same kind check, size cap and plan-path re-validation. The
// Plans segment appears only when a queue of more than one plan is armed, and
// a state whose queue disagrees with its current plan reads as the queue of
// one that reader normalizes it to.
//
// The position it names is read from the plan docs through the library's own
// queuePosition (hooks/kit-goal-lib.js), never taken from the stored index
// alone: the index only moves at a clean stop of the bound session, so a run
// that died at its close-out can leave it naming a plan already finished and
// archived, and this segment would otherwise repeat that stale claim beside
// the corrected one the SessionStart advisory and `kit-goal.js status` both
// already report. On a healthy queue, where the two agree, the segment reads
// exactly as it always has, "Plans: <i>/<n>". Where a missed advance leaves
// them apart, the marker above still names the STORED plan (the run bound to
// this queue is still working the plan it was armed for), so this segment
// also names the plan the derived position points at, beside the stored
// index it moved past: "Plans: 2/2 b_spec_v1 (stored 1)". An entry the plan
// docs cannot resolve at all keeps its position and names why rather than
// being silently skipped, "Plans: 2/2 (unresolvable: <cause>)", and a
// position whose own entry reads finished adds a clause of its own, "Plans:
// 2/2 (all complete)", since a leash about to release rather than advance is
// not visible from the bare numbers. A missed advance onto an unresolvable or
// finished entry combines the two clauses in that order, "Plans: 2/2
// b_spec_v1 (stored 1, unresolvable: <cause>)" or "Plans: 2/2 b_spec_v1
// (stored 1, all complete)"; unresolvable and finished never combine with
// each other, since an entry reads as exactly one of pending, complete or
// unresolvable. A payload whose library does not answer, whose call throws,
// or whose answer does not carry the shape this reader trusts, renders the
// stored index alone, exactly as it did before this segment read
// queuePosition at all.
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
// WHICH copy of the plan doc the SECTIONS segment counts from follows the
// goal state. When it records an execution tree (the worktree a chapter
// boundary was last opened from, judged by the library's planDisplayRoot rule
// before anything under it is opened), both the count and its render-cache
// key come from that tree's copy, because the live doc sits on the executing
// branch while this cwd's copy may be a stale one from whatever branch it has
// checked out. Otherwise, and whenever the recorded tree cannot be trusted,
// lacks the doc, or holds a copy past this widget's read cap, both come from
// the cwd's own copy: the cap rides into the root election itself, so an
// oversized tree copy falls back rather than electing a root whose doc the
// read then refuses. A render resolves that root once and hands it to both
// readers, so the key and the text cannot come from different copies.
//
// The PLANS segment's walk follows a different rule, deliberately: it hands
// this widget's bare cwd to queuePositionFor, and queueEntryState inside it
// reads cwd and goalRoot(cwd) (the main checkout, for a worktree session),
// never the recorded execution tree. The direction is the safe one: a branch
// whose plan doc reads Complete is invisible to a walk that never opens that
// branch's copy, so main's still-pending copy is what the walk reads instead,
// and the reported position under-reports rather than jumping ahead of work
// only the execution tree has finished. The widget still agrees with the
// SessionStart advisory and `kit-goal.js status` about where the queue
// stands, because both of those resolve the position through the same
// goalRoot/cwd rule rather than through planDisplayRoot.
//
// Loaded as a module (the launcher and the test suite) this only exports its
// internals, among them the render entry scripts/kit-statusline.js calls
// in-process; run as a CLI it reads stdin and prints.

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

// The goal-state file this widget renders from, or null when this payload does
// not carry the library that owns that path. The launcher keys its render cache
// on this file's modification time, and asks for the path here rather than
// joining one of its own, so the two cannot disagree about where the state
// lives.
function goalStatePath(cwd) {
    const lib = goalLib();
    if (!lib || typeof lib.goalPath !== 'function') return null;
    return lib.goalPath(cwd);
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

// The queue position queuePosition reports, or null when this payload does not
// carry the library, the library does not export queuePosition, the call
// throws, or the answer does not carry the shape this widget trusts (see the
// validation below). queuePosition never throws and always returns that shape
// by its own contract, but this widget prints to the operator's prompt on
// every refresh, so this call alone is wrapped rather than trusted to keep
// that contract, unlike the reads above it (readGoalState, planDocRoot,
// planText, planKeyMtime), which rely on main()'s outer catch: a payload that
// cannot answer here, or answers with something this reader does not
// recognize, renders the Plans segment exactly as it did before this segment
// read a derived position at all.
function queuePositionFor(cwd, state) {
    const lib = goalLib();
    if (!lib || typeof lib.queuePosition !== 'function') return null;
    try {
        const pos = lib.queuePosition(cwd, state);
        // A malformed answer is treated exactly as no answer. index and
        // stored are the two fields this widget does arithmetic on directly
        // (a non-integer index would print "Plans: NaN/2"), and positional is
        // the flag that decides whether the segment renders at all (a truthy
        // pos missing it would fall through the caller's `if (pos.positional)`
        // as false and silently drop a segment a healthy multi-plan queue
        // should show, the exact silent-drop outcome this reader exists to
        // prevent). None of the three may be trusted from a call this widget
        // cannot itself verify.
        if (!pos || !Number.isInteger(pos.index) || !Number.isInteger(pos.stored)
            || typeof pos.positional !== 'boolean') {
            return null;
        }
        return pos;
    } catch {
        return null;
    }
}

// The base name a plan path renders as: the file name with its extension
// stripped, the treatment the marker above applies to the armed plan. Shared
// rather than respelled, so a plan named beside the marker and one named
// inside the Plans segment cannot render two different ways.
function planBaseName(rel) {
    return path.basename(rel).replace(/\.md$/i, '');
}

// The Plans segment's text, from queuePosition's derived position rather than
// the stored index alone. On a healthy queue the two agree and this reads
// exactly as the stored index always has; where a missed advance leaves them
// apart, the stored index rides along beside the corrected one, so a reader
// is never told the stored plan is current when the plan docs themselves
// report otherwise. An entry the plan docs cannot resolve at all keeps its
// position and names why, rather than being folded into the count in
// silence: a status line that renumbers around a missing plan is the failure
// this segment exists to close. A position whose own entry reads finished
// adds a clause naming that, since a leash about to release rather than
// advance is not visible from the bare numbers either.
function plansSegmentText(state, pos) {
    const clauses = [];
    if (pos.healed > 0) clauses.push('stored ' + (pos.stored + 1));
    if (pos.unresolvable) clauses.push('unresolvable: ' + (pos.cause || 'unknown'));
    if (pos.finished) clauses.push('all complete');
    const suffix = clauses.length ? ' (' + clauses.join(', ') + ')' : '';
    // On a corrected position the marker above still names the STORED plan (a
    // corrected line does not re-point it: the run bound to this queue is
    // still working the plan it was armed for), so this segment names the
    // plan actually at the derived position beside its own number. Left
    // unnamed, "Plans: 2/2" would read as a claim about the plan the marker
    // names, which is false of it.
    const correctedName = pos.healed > 0 ? ' ' + planBaseName(state.queue[pos.index]) : '';
    return LABEL_PLANS + ': ' + (pos.index + 1) + '/' + state.queue.length + correctedName + suffix;
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
// The list is written once, as the body of a character class, because two
// regexes are built from it: the one below, which every segment goes through,
// and the line-level one beside safeLine, which differs in exactly one place and
// says so there. Two spellings of this list would be two answers to what may
// reach a terminal.
const UNSAFE_BMP_CLASS = '\\x00-\\x1F\\x7F-\\x9F\\u061C\\u200B-\\u200F\\u2028\\u2029'
    + '\\u202A-\\u202E\\u2060-\\u2064\\u2066-\\u2069\\uFEFF';

const UNSAFE_FOR_TERMINAL = new RegExp('[' + UNSAFE_BMP_CLASS + '\\uD800-\\uDFFF]', 'g');

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

// The cap on a whole line. The widest line renderState can build is the marker
// and its space plus three segments at safeSegment's 120-character cap, joined
// by two separators, which is 369 characters, so this holds every line this
// widget produces and bounds one that came from anywhere else.
const LINE_MAX_CHARS = 400;

// A whole status line rendered safe for the operator's terminal, through the
// same character list as the segments above rather than a second spelling of it.
// The launcher prints its render cache through this: that cache is a file inside
// a repository, so its line is file-derived exactly as the segments are, and it
// arrives already joined, which is why it is capped as a line rather than re-run
// through the segment cap.
//
// One difference from the segment rule, and it is why this regex is built rather
// than shared: a surrogate PAIR survives here, and only a lone surrogate is
// removed. The marker this widget opens every line with is an astral character,
// so a line held to the segment rule would come back with its marker stripped.
// What the surrogate leg is for is still covered: a lone surrogate would leave
// this process as invalid UTF-8, and both halves of the pattern below refuse
// one. An astral character that is not the marker rides through, which is a
// display oddity in a plan name rather than a way to act on a terminal.
//
// A line that sanitizes away entirely comes back empty, and empty is what the
// launcher prints for nothing armed, so there is no placeholder here: a blank
// segment is the right answer for a cached line with nothing printable left in
// it, where safeSegment's placeholder exists to keep a joined line from
// rendering a bare marker with a doubled separator after it.
const UNSAFE_FOR_TERMINAL_LINE = new RegExp('[' + UNSAFE_BMP_CLASS + ']'
    + '|[\\uD800-\\uDBFF](?![\\uDC00-\\uDFFF])|(?<![\\uD800-\\uDBFF])[\\uDC00-\\uDFFF]', 'g');

function safeLine(value) {
    const cleaned = String(value).replace(UNSAFE_FOR_TERMINAL_LINE, '').slice(0, LINE_MAX_CHARS);
    // The cap counts UTF-16 units, so it can fall between the halves of a pair
    // this rule just admitted and leave the high half alone at the end, which is
    // the invalid UTF-8 the lone-surrogate legs above refuse.
    return /[\uD800-\uDBFF]$/.test(cleaned) ? cleaned.slice(0, -1) : cleaned;
}

// The cap on the plan doc this widget reads whole. A plan doc is prose with a
// few hundred lines; a megabyte is far past any real one, and the read happens
// on every status-line refresh, so an unbounded one would be re-read whole each
// time.
const PLAN_MAX_BYTES = 1024 * 1024;

// The directory the plan doc is read from, for both the text and its cache
// key: the library's display-root answer, which is the recorded execution
// tree when the goal state names one it can trust, and the cwd otherwise.
// Asked through the library so this widget and any other display reader
// cannot judge that field by a spelling of their own; a payload whose library
// does not answer resolves to the cwd, the same answer the library gives with
// no tree recorded. state passes through when the caller holds one, so a
// render spends no second read of the goal state. The widget's own read cap
// rides into the election, so a tree copy planText below could never read is
// a tree that is not elected, and the fallback is the cwd's readable copy
// rather than a dropped segment.
function planDocRoot(cwd, planRel, state) {
    const lib = goalLib();
    if (!lib || typeof lib.planDisplayRoot !== 'function') return cwd;
    return lib.planDisplayRoot(cwd, planRel, state, PLAN_MAX_BYTES);
}

// The armed plan doc's text, or null when it is absent, refused, or oversized.
// root is the caller's resolved doc directory (planDocRoot's answer, which
// renderState resolves once and hands to this read and the cache key both, so
// the two cannot come from different copies). The size check here is against
// whichever copy that root holds; for a recorded tree the election already
// refused an oversized copy, so this leg is what bounds the cwd's own. The
// kind check is the library's own planFileSize, imported rather than
// respelled: the plan path is a stored value, so a FIFO at an otherwise
// well-formed in-repo path would block this process, which the harness
// respawns at every refresh, and a link resolving to an in-repo plan doc is a
// plan doc every other reader of that path opens, so this widget must not be
// the one surface that drops its Sections segment over one.
//
// The check narrows rather than closes, the same residual readGoal and
// readCheckpoint state of their own: the open below re-resolves the path, so
// what is opened is not provably what was lstat'ed, and the size is the one read
// at lstat time rather than at the read. What this guard buys is that the
// ordinary case, and every case a planted kind produces, is refused before any
// open happens.
function planText(root, planRel) {
    const lib = goalLib();
    if (!lib || typeof lib.planFileSize !== 'function') return null;
    const size = lib.planFileSize(root, planRel);
    if (size === null || size > PLAN_MAX_BYTES) return null;
    try {
        return fs.readFileSync(path.join(root, planRel), 'utf8');
    } catch {
        return null;
    }
}

// The modification time of the armed plan doc, or null when there is no regular
// file to read one from. This is the launcher's cache key for that doc, and it
// lives here, beside the read it keys, for three reasons.
//
// It is taken BEFORE the read, in renderState below, so the time stored with a
// line is never newer than the text that line was rendered from. Taken after,
// a write landing between the read and the stat would store the post-write time
// beside the pre-write line, and the key would then match forever: the stale
// count would stay on screen until the next write to the doc. Taken first, that
// same race stores a time older than the text, the key misses at the next
// refresh, and the cost is one re-render.
//
// It resolves the doc's directory through planDocRoot, the same answer the
// read takes, because this number is the freshness key FOR that read: a key
// taken from the checkout's copy while the text came from the execution
// tree's would hold whatever line was cached until the checkout's copy moved,
// and for a doc living on the executing branch that copy may never move.
// root is that directory when the caller already resolved it: renderState
// resolves once per render and passes it to this key and the text read both,
// so a tree doc appearing or vanishing mid-render cannot pair a key from one
// root with text from the other. The launcher reaches this with neither
// state nor root in hand, so both parameters are optional and are derived
// here when absent.
//
// It also applies the containment rule every reader of a stored plan path in
// this codebase applies, through the library's own normalizer rather than a
// second spelling of it, because the launcher calls this with the path out of
// its cache file, which is repo-carried and hand-editable: a value naming
// something outside the project is refused rather than stat'ed.
//
// The stat follows links, unlike the lstat kind checks around it. planFileSize,
// which the read below goes through, resolves a link that lands on a regular
// file inside the project rather than refusing it, so keying on the link's own
// time would hold a stale count while the doc it names moved. Nothing is opened
// through this stat: what it produces is a number for a cache key.
function planKeyMtime(cwd, planRel, state, root) {
    const lib = goalLib();
    if (!lib || typeof lib.normalizePlanArg !== 'function') return null;
    if (typeof planRel !== 'string' || lib.normalizePlanArg(cwd, planRel) === null) return null;
    const docRoot = root === undefined ? planDocRoot(cwd, planRel, state) : root;
    try {
        const st = fs.statSync(path.join(docRoot, planRel));
        return st.isFile() ? st.mtimeMs : null;
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

// The widget line for a cwd together with the plan doc it was rendered from,
// that doc's modification time, and whether this render is safe to cache:
// { line, plan, planMtimeMs, cacheable }. With nothing armed the line is
// empty, the plan is null, the time is null, and the render is cacheable
// (there is nothing in it that could go stale outside the two files the
// launcher already keys on). Otherwise plan is the armed plan doc's path as
// stored, whether or not that doc was readable, since a doc that appears
// later changes the line, and planMtimeMs is null for the same unreadable
// doc.
//
// cacheable is false exactly when the Plans segment named a position derived
// from a plan doc other than the armed plan's own: a corrected position
// (queuePositionFor's healed > 0) reads an archived sibling of the armed
// plan, and an unresolvable one keeps naming an entry whose doc this walk
// could not find in any tree. Neither of those docs' modification times is in
// the launcher's cache key, so a line built from one could go stale in a way
// the key can never detect, and the launcher must not store it. Every other
// render, a healthy Plans segment and one with no Plans segment at all alike,
// is cacheable: the goal state and the armed plan doc are the only inputs
// that can move it, and both are already keyed on.
//
// The launcher caches the line and re-renders when either of the two files it
// was rendered from changes, for every render this field marks cacheable, so
// it needs the plan the line describes, and taking both from the same render
// costs one stat and cannot name a different plan, or a later moment, than
// the line does.
function renderState(cwd) {
    const state = readGoalState(cwd);
    if (!state) return { line: '', plan: null, planMtimeMs: null, cacheable: true };
    const parts = [MARKER + ' ' + safeSegment(planBaseName(state.plan))];

    // The doc's directory is resolved once and handed to both readers, so the
    // key and the text come from one election rather than two that a tree doc
    // appearing or vanishing mid-render could split. The key is taken before
    // the read, never after it: see planKeyMtime.
    const docRoot = planDocRoot(cwd, state.plan, state);
    const planMtimeMs = planKeyMtime(cwd, state.plan, state, docRoot);
    const text = planText(docRoot, state.plan);
    const progress = text === null ? null : sectionProgress(text);
    if (progress) {
        // The whole segment goes through the sanitizer, not just the plan name
        // above it: the pointer is a capture from the plan doc's own Next line,
        // and everything printed here is file-derived.
        const next = progress.pointer ? ' (Next ' + progress.pointer + ')' : '';
        parts.push(safeSegment(LABEL_SECTIONS + ': ' + progress.done + '/' + progress.total + next));
    }

    // The position is read from the plan docs through queuePosition rather
    // than trusted from the stored index, so this segment cannot disagree
    // with the SessionStart advisory or `kit-goal.js status` about where the
    // queue actually stands. positional is queuePosition's own answer to
    // whether this queue holds more than one plan; it is read rather than
    // re-derived from state.queue.length so this surface and those two
    // cannot answer that question two different ways. A payload the library
    // cannot answer for falls back to the stored index alone, unchanged from
    // before this segment read a derived position.
    //
    // The call itself is skipped for a queue of one, the common case: it
    // costs at least one plan-doc walk (queueEntryState), and pos.positional
    // is always false for a queue this short whatever queuePosition would
    // answer, so a single-plan render would pay that walk only to discard it.
    // This is a cheap precondition on making the call, not a second
    // derivation of the positional question: when the call does run,
    // pos.positional is still what decides whether the segment renders, so
    // this surface and the two hook surfaces that also call queuePosition
    // still cannot answer that question two different ways.
    let cacheable = true;
    const pos = Array.isArray(state.queue) && state.queue.length > 1 ? queuePositionFor(cwd, state) : null;
    if (pos) {
        if (pos.positional) {
            parts.push(safeSegment(plansSegmentText(state, pos)));
            if (pos.healed > 0 || pos.unresolvable) cacheable = false;
        }
    } else if (Array.isArray(state.queue) && state.queue.length > 1 && Number.isInteger(state.queueIndex)) {
        parts.push(safeSegment(LABEL_PLANS + ': ' + (state.queueIndex + 1) + '/' + state.queue.length));
    }
    return { line: parts.join(' · '), plan: state.plan, planMtimeMs, cacheable };
}

// The widget line for a cwd, or '' when nothing is armed there.
function render(cwd) {
    return renderState(cwd).line;
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

module.exports = { cwdFromInput, goalStatePath, planKeyMtime, parsePlan, safeLine, sectionProgress, pointerFrom, render, renderState, PLAN_MAX_BYTES };
