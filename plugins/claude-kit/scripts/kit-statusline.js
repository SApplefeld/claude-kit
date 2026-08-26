#!/usr/bin/env node
// kit-statusline launcher: the stable entry point for the kit's status-line
// widget. Doctor -Fix copies this file to ~/.claude/bin/kit-statusline.js
// beside memq-shim.js, and a status-line tool (ccstatusline's Custom Command
// widget) runs it by that path:
//
//   node "%USERPROFILE%\.claude\bin\kit-statusline.js"
//
// The widget itself (scripts/kit-goal-statusline.js) stays inside the
// installed plugin payload, whose cache path carries the release version and
// so rots at the next kit update if baked into a durable setting. This file
// bakes in nothing: it resolves the installed payload through memq-shim.js's
// resolver on every invocation, and runs the widget from there, so a kit
// update needs no doctor re-run. The status-line JSON arrives on stdin and is
// handed to the widget's own reader of it.
//
// The widget is loaded in-process rather than spawned: this process is already
// one node start per status-line refresh, and a second one costs a second
// interpreter start on a box the operator is saturating with sessions, which
// is where the segment was seen to stop drawing.
//
// The render itself is cached in the project, at <cwd>/.kit/statusline-cache.json,
// because this process is born and dies per refresh and nothing in memory
// survives it. The cache holds the last line drawn, the armed plan doc's path,
// and the modification times of the two files that line was rendered from, the
// goal state and that plan doc. A refresh stats those two, and on an unchanged
// pair prints the cached line, which is what skips the plan doc's read and the
// parse of it, while a Chapter landing in that doc still moves the Sections
// count at the next refresh. The stored plan path is a stat target and never
// opened here, and it is stat'ed only when it names something inside the
// project; anything else unexpected in the file simply misses and re-renders.
//
// Not every render is written there. The widget's Plans segment can name a
// position derived from a plan doc other than the two files above (an
// archived sibling of the armed plan, on a corrected position, or one this
// walk could not resolve at all), and neither of those other docs'
// modification times sits in the key: a doc archived after such a line was
// cached would leave both stats unchanged and this launcher would serve that
// stale line forever. The widget answers whether a render is safe to cache
// (renderState's cacheable field), and this launcher honors that answer at
// every write, so a corrected or unresolvable Plans segment is never stored
// and so never served from here; only a render the widget itself vouches for
// reaches this file. A payload whose renderState predates the field is read
// as cacheable, the two-mtime behavior this cache always had.
//
// Blank output is the widget's own "nothing armed" answer, so this launcher
// prints nothing on the failures a status line cannot act on either (no
// installed payload, a payload from before the widget existed, a payload whose
// widget will not load): a status line is no place for an error message, and
// exit 0 keeps the tool from reporting one. Those are answers about what is
// installed. A failure inside a widget that DID load is not, and there the last
// line drawn is printed instead of nothing, since a segment that vanishes under
// load is the failure this caching exists to prevent and a slightly stale line
// is not. A refresh that is already slow takes the same branch before it starts
// the render, so a host that kills this command on its own timeout still has a
// line (see RENDER_BUDGET_MS).

'use strict';

const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { resolveMemq } = require('./memq-shim.js');

const WIDGET_REL = 'kit-goal-statusline.js';
const CACHE_REL = path.join('.kit', 'statusline-cache.json');

// When this process began, for the budget below. It is taken at module load,
// which is after node's own start and before any of this launcher's work.
const START_MS = Date.now();

// How long this launcher may spend before it starts a render. Everything ahead
// of that point (the stdin read, the payload resolution, the widget require,
// the cache read and its stats) is tens of milliseconds on an unloaded box, so
// a refresh that has already spent three quarters of a second is one whose box
// is saturated, and the plan doc's read and parse still lie ahead of it. Past
// the budget the cached line is printed and the render is skipped, because a
// status-line host that kills this command on its own timeout draws whatever
// arrived before the kill, and a stale line is worth more there than a blank
// one. The bound is deliberately an order of magnitude above the healthy cost,
// so an ordinary refresh never trips it and never goes stale for it.
const RENDER_BUDGET_MS = 750;

// The cap on the cache file this launcher reads back. One line, one path and
// two timestamps sit far inside it, so a larger file is not one this launcher
// wrote.
const CACHE_MAX_BYTES = 8 * 1024;

// How long an abandoned temporary file may sit in .kit/ before a later write
// removes it, matching the goal state's own writer.
const TMP_SWEEP_AGE_MS = 5 * 60 * 1000;

// A regular file's modification time, or null for a missing path or anything
// that is not a regular file.
function mtimeOf(target) {
    try {
        const st = fs.statSync(target);
        return st.isFile() ? st.mtimeMs : null;
    } catch {
        return null;
    }
}

// The cache entry for a project, or null when there is none to trust. Every
// field is checked because this file is on disk in a repository, and a shape
// that surprises this reader must cost a re-render rather than a throw.
function readCache(cwd) {
    try {
        const file = path.join(cwd, CACHE_REL);
        const st = fs.lstatSync(file);
        if (!st.isFile() || st.size > CACHE_MAX_BYTES) return null;
        const data = JSON.parse(fs.readFileSync(file, 'utf8'));
        if (!data || typeof data !== 'object' || typeof data.line !== 'string') return null;
        return {
            line: data.line,
            goalMtimeMs: typeof data.goalMtimeMs === 'number' ? data.goalMtimeMs : null,
            plan: typeof data.plan === 'string' && data.plan !== '' ? data.plan : null,
            planMtimeMs: typeof data.planMtimeMs === 'number' ? data.planMtimeMs : null
        };
    } catch {
        return null;
    }
}

// Where the render cache may be written, or null when this project has no place
// for it. Both legs are lstats, so a link is judged as a link rather than as
// whatever it points at: .kit itself must be a real directory, and anything
// already at the cache path must be a regular file, with nothing there at all
// the ordinary first case. A symlink, junction or FIFO at either is refused
// rather than followed, because a write through a link truncates its target and
// a write into a FIFO blocks forever where no try/catch can rescue it, in a
// process the operator's status line is waiting on. Only ENOENT reads as
// "nothing there, go ahead"; any other lstat failure has told this writer
// nothing about the path and is refused, which is the rule the compaction gate's
// recorder applies to the files it keeps under .kit/ (kit-compact-lib.js's
// gateStateTarget).
//
// The directory is never created here: .kit belongs to the project, and a
// project without one has no armed goal for this launcher to draw.
function cacheTarget(cwd) {
    try {
        const kit = path.join(cwd, '.kit');
        if (!fs.lstatSync(kit).isDirectory()) return null;
        const file = path.join(cwd, CACHE_REL);
        try {
            if (!fs.lstatSync(file).isFile()) return null;
        } catch (err) {
            if (!err || err.code !== 'ENOENT') return null;
        }
        return file;
    } catch {
        return null;
    }
}

// Remove temporary files an earlier write abandoned. The write below cleans up
// after every failure it can catch; a process the status-line host kills between
// the create and the rename catches nothing, and the random suffix means no
// later run can recognize that file by name, so age is the only signal left.
// Any regular file in .kit/ carrying this writer's prefix and older than
// TMP_SWEEP_AGE_MS is removed, whatever wrote it. Best-effort throughout: a
// sweep that cannot run leaves an orphan, which costs the project one small file.
function sweepStaleTmp(file) {
    try {
        const dir = path.dirname(file);
        const prefix = path.basename(file) + '.tmp.';
        const cutoff = Date.now() - TMP_SWEEP_AGE_MS;
        for (const name of fs.readdirSync(dir)) {
            if (!name.startsWith(prefix)) continue;
            const full = path.join(dir, name);
            try {
                const st = fs.lstatSync(full);
                if (!st.isFile() || st.mtimeMs > cutoff) continue;
                fs.unlinkSync(full);
            } catch { /* raced by another writer, or not ours to remove */ }
        }
    } catch { /* no directory, or it cannot be listed: nothing to sweep */ }
}

// Record what was just drawn, through a temporary file and a rename so a reader
// sees either the whole old entry or the whole new one. The temporary name
// carries this process's id and six random bytes, the shape kit-goal-lib.js's
// atomicTmpPath uses for the goal state: the pid keeps two refreshes off one
// name, and the random suffix keeps the name from being predictable, since a
// link pre-planted at a guessable temporary path would be followed by the write
// that creates it. The create is exclusive, so an occupied name fails the write
// instead of being written through.
//
// A cache that cannot be written costs the next refresh a re-render and nothing
// else, so every failure here is silent.
function writeCache(cwd, entry) {
    const file = cacheTarget(cwd);
    if (file === null) return;
    sweepStaleTmp(file);
    let tmp = null;
    let created = false;
    try {
        tmp = file + '.tmp.' + process.pid + '.' + crypto.randomBytes(6).toString('hex');
        const fd = fs.openSync(tmp, 'wx');
        created = true;
        try {
            fs.writeFileSync(fd, JSON.stringify(entry), 'utf8');
        } finally {
            // Allowed to throw: a close is the last point at which the OS can
            // report a deferred write error, and a rename past one would publish
            // a torn entry. Reaching the catch below instead removes it.
            fs.closeSync(fd);
        }
        fs.renameSync(tmp, file);
    } catch {
        if (created) {
            try { fs.unlinkSync(tmp); } catch { /* already gone, or the path is not writable */ }
        }
    }
}

// Drop the cache. This runs when a render succeeds with no key to store it
// under, which is what a cleared goal produces: the state file is gone, so
// nothing keys the entry, and an entry left behind would have no age bound on it
// and would draw a retired plan's line at the next failure. Best-effort, and the
// kind check is the write path's, so a link parked at the cache path is refused
// rather than unlinked.
function removeCache(cwd) {
    const file = cacheTarget(cwd);
    if (file === null) return;
    try { fs.unlinkSync(file); } catch { /* nothing there, or not removable */ }
}

// The modification time to key a cache entry on for a stored plan path, through
// the widget's own answer to that question, which applies the containment rule
// every reader of a stored plan path applies before touching it. Null when there
// is no plan stored, when this payload's widget does not answer, or when nothing
// readable is there: an entry that cannot produce its key misses and re-renders.
function planMtimeOf(widget, cwd, planRel) {
    if (planRel === null || !widget || typeof widget.planKeyMtime !== 'function') return null;
    try {
        return widget.planKeyMtime(cwd, planRel);
    } catch {
        return null;
    }
}

// Whether the cached line still describes what is on disk. Both files must
// answer as they did at render time, and a goal state that cannot be stat'ed
// leaves nothing to key on, so it renders.
function cacheIsCurrent(widget, cwd, cached, goalMtimeMs) {
    if (cached === null || goalMtimeMs === null) return false;
    if (cached.goalMtimeMs !== goalMtimeMs) return false;
    return cached.planMtimeMs === planMtimeOf(widget, cwd, cached.plan);
}

// Whether a render carries a key its line can be stored under: the plan doc it
// was rendered from, that doc's modification time as the render itself read
// it, and the render's own say that nothing in its line came from outside
// those two files. A payload whose renderState predates the timestamp reports
// no time, and an entry stored without one would key on the goal state alone,
// which no plan-doc edit moves, so the line would hold a stale Sections count
// until the next arm or advance. Nothing stored is better than a key that
// cannot detect the change the key exists for.
//
// state.cacheable false is the same rule reaching a third input: a corrected
// or unresolvable Plans segment reads a plan doc the two stat targets above
// do not cover, so no key built from them can ever notice that doc changing,
// and the line must not be stored under one that cannot. A payload whose
// renderState predates the field carries no cacheable property at all, and a
// missing flag reads as cacheable, the two-file rule this cache always had:
// an older widget paired with a newer launcher behaves exactly as it did
// before this field existed.
function cacheKeyable(state) {
    return typeof state.plan === 'string' && state.plan !== ''
        && (typeof state.planMtimeMs === 'number' || state.planMtimeMs === null)
        && state.cacheable !== false;
}

// The project directory the status-line JSON names. The widget's own reader of
// that JSON answers it whenever the widget loaded, so the two cannot disagree
// about which project is on screen. With no widget the same two fields are read
// here, in the same order, because the JSON is in hand on exactly that path:
// this process's own cwd is the answer for no JSON at all, and taking it while
// the JSON names a project would point every path below, the cache read among
// them, at some other project's .kit.
function projectCwd(widget, raw) {
    try {
        if (widget && typeof widget.cwdFromInput === 'function') return widget.cwdFromInput(raw, process.cwd());
    } catch { /* answer it here instead */ }
    try {
        const data = JSON.parse(raw);
        if (data && typeof data === 'object') {
            if (data.workspace && typeof data.workspace.current_dir === 'string' && data.workspace.current_dir) {
                return data.workspace.current_dir;
            }
            if (typeof data.cwd === 'string' && data.cwd) return data.cwd;
        }
    } catch { /* no JSON on stdin: fall back */ }
    return process.cwd();
}

// { line, plan, planMtimeMs } from the widget, or null when this payload exposes
// neither entry. render alone is what a payload older than the cache carries:
// this file reaches a machine through the doctor and the payload through a
// plugin update, so the two versions are independent and a launcher that
// required the newer entry would blank the segment until the payload caught up.
function renderWith(widget, cwd) {
    if (widget && typeof widget.renderState === 'function') return widget.renderState(cwd);
    if (widget && typeof widget.render === 'function') return { line: widget.render(cwd), plan: null, planMtimeMs: null };
    return null;
}

// Put a line the widget just composed on the operator's terminal, as the widget
// composed it. The widget owns what its own line may contain and renders every
// segment of it safe for a terminal; this launcher passes that answer through,
// as it did when the widget ran as a separate process and wrote to the inherited
// terminal directly.
function print(line) {
    if (!line) return;
    try {
        process.stdout.write(line);
    } catch { /* a closed status-line pipe is silence, not a crash */ }
}

// Put a line READ BACK FROM THE CACHE on the terminal. That line came off disk,
// from a file inside a repository, so a clone or a hand can have put anything in
// it since: the control bytes that open an escape sequence, the separators that
// would turn one status line into several, a length no status line has room for.
// It is not the widget's answer any more, so it goes through the widget's
// sanitizer first, which is the one place that character class is spelled.
//
// A payload whose widget did not load, or predates the sanitizer, leaves no way
// to make a stored line safe, and an unsanitized one is not written to a
// terminal: that refresh stays blank, and the next one that reaches the widget
// draws normally.
function printCached(widget, line) {
    if (!line || !widget || typeof widget.safeLine !== 'function') return;
    let safe = '';
    try {
        safe = widget.safeLine(line);
    } catch {
        return;
    }
    print(safe);
}

function main() {
    let raw = '';
    try { raw = fs.readFileSync(0, 'utf8'); } catch { /* no stdin */ }
    // Where stdout is a synchronous pipe (Windows and Linux) a closed pipe
    // throws EPIPE and print catches it; on macOS the failure surfaces as an
    // 'error' event on the stream instead, which no try can see, so the handler
    // is what keeps it from ending this process as an uncaught exception.
    process.stdout.on('error', () => { /* a closed status-line pipe is silence, not a crash */ });

    const memqPath = resolveMemq();
    if (memqPath === null) return;
    const widgetPath = path.join(path.dirname(memqPath), WIDGET_REL);
    if (!fs.existsSync(widgetPath)) return;

    let widget = null;
    try { widget = require(widgetPath); } catch { /* nothing left to render or to sanitize: see printCached */ }

    const cwd = projectCwd(widget, raw);
    const cached = readCache(cwd);
    // Whether this refresh has already decided what to draw. The fallback at the
    // bottom is for a refresh that reached nothing, so a throw after the decision
    // (an unwritable cache file, a removal that raced something) must not put a
    // second line into the same refresh.
    let answered = false;
    try {
        const goalFile = widget && typeof widget.goalStatePath === 'function' ? widget.goalStatePath(cwd) : null;
        const goalMtimeMs = typeof goalFile === 'string' ? mtimeOf(goalFile) : null;
        if (cacheIsCurrent(widget, cwd, cached, goalMtimeMs)) {
            printCached(widget, cached.line);
            return;
        }
        if (cached !== null && Date.now() - START_MS > RENDER_BUDGET_MS) {
            printCached(widget, cached.line);
            return;
        }
        const state = renderWith(widget, cwd);
        if (state !== null) {
            print(state.line);
            answered = true;
            if (goalMtimeMs !== null && cacheKeyable(state)) {
                writeCache(cwd, {
                    line: state.line,
                    goalMtimeMs,
                    plan: state.plan,
                    planMtimeMs: state.planMtimeMs
                });
            } else if (goalFile !== null && goalMtimeMs === null) {
                removeCache(cwd);
            }
            return;
        }
    } catch { /* stale-but-drawn */ }
    if (!answered && cached !== null) printCached(widget, cached.line);
}

if (require.main === module) main();
