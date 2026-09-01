// Which project a captured call belongs to, and that project's memory index.
//
// The recognition duty asks one question of the model: does a stored memory
// bear on what this session is doing right now. Answering it needs the index of
// the right project, which is what this module resolves from the `cwd` the
// spool line carries.
//
// WHERE THE RESOLUTION COMES FROM. The store's own layout is not restated here.
// The harness derives a project's state directory name from its absolute cwd,
// git worktrees file their memories under the main checkout rather than under
// the worktree, and a pointer that claims a main checkout has to close a
// two-way handshake before it is believed. All of that lives in
// plugins/claude-kit/scripts/memq.js and is reached through its exports, the
// same way plugins/claude-kit/hooks/memory-recognition-nudge.js and
// kit-compact-lib.js reach it for the same question. A second spelling of the
// worktree or flattening rules here would send this daemon looking in a
// directory the store is not using, silently, on exactly the machines where a
// worktree makes the two answers differ.
//
// One leg of memq's own resolution is deliberately not taken. memq also
// consults the transcript filing of the session in ITS environment (the
// session leg), so a session working from a subdirectory of its filed project
// resolves the filed project's tier. This daemon resolves the project of
// another session's captured call, and a session id in the daemon's own
// environment, if one is set at all, never names that session, so the leg
// would answer the wrong session's question. The accepted cost: for a call
// captured in a subdirectory of the caller's project, the caller reads the
// filed tier in-session while this resolution derives the subdirectory's
// segment. Where no orphaned per-subdirectory store directory remains, that
// derivation finds no index and undercounts recognition rather than
// misdirecting it. Where one does remain, the derivation lands on the
// orphan and recognizes against records the store no longer serves, which
// is misdirection, and the store's own resolver calls those directories the
// common case on a box that had the split, since nothing moves their
// records. The quiet direction is this module's own contract either way.
//
// One part is composed rather than called: the tier path under a store root,
// `projects/<segment>/memory/MEMORY.md`. memq resolves that against its own
// root, which is the live store or an environment override, and this daemon
// needs it against whatever root it was pointed at, so the join is spelled here
// and a test pins it equal to memq's own for the default root.
//
// THE PIN IS NOT CONSULTED, deliberately. memq's projectSegment honors
// KIT_MEMORY_PROJECT, which names the project directory THAT process files its
// own memories under. This daemon files nothing: it resolves the project of
// another session's captured call, and a pin in the daemon's environment would
// point every observed session's recognition at one store segment. So the
// segment here is always the cwd derivation.
//
// READ ONLY. Nothing in this module writes anything, and no path outside the
// resolved index file is opened. The store is the operator's; the daemon is a
// reader of one file in it.
//
// Nothing here throws at its caller. An absent memq, a missing export, a
// network-shaped working directory, an absent or unreadable index: each is a
// described reason the caller counts and reports, because a project with no
// memories is the ordinary case on most machines and is not a fault.

'use strict';

const fs = require('fs');
const path = require('path');

// A record name as the delivery side will accept it, from the module that owns
// that question. A line whose name falls outside it is left out of the prompt
// and out of the name set alike, so it can never become a pointer the kit's
// hook would drop unread.
const { RECORD_NAME_RE, isRecordName } = require('./record-name.js');

// The memq exports recognition depends on, each with the typeof it is used
// through. A plugin tree one version behind can supply a memq that requires
// cleanly while lacking one of them, and a throw out of it inside the drain is
// the failure this list turns into a stand-down. Checked once, before any of
// them is used.
//
// `projectMemoryDirFor` is on the list without being called: it is the store's
// own composition of the tier path this module composes by hand, so its absence
// says the layout that join was written against has moved and the join can no
// longer be trusted. The suite pins the two compositions equal.
const MEMQ_SYMBOLS = [
    ['sanitizeProjectPath', 'function'],
    ['worktreeMainRoot', 'function'],
    ['namesNetworkShare', 'function'],
    ['memoryRoot', 'function'],
    ['projectMemoryDirFor', 'function'],
    ['INDEX_FILE', 'string']
];

const MEMQ_PATH = path.join(__dirname, '..', 'plugins', 'claude-kit', 'scripts', 'memq.js');

// The most of an index file that is read. A project index is one line per
// record and a large one is a few tens of kilobytes, so this bounds a file
// something else wrote at that path rather than cutting an honest index.
const INDEX_READ_CAP = 1024 * 1024;

// The most index lines carried into a prompt. Bounds the work a directory
// nothing here controls would otherwise set.
const INDEX_LINES_MAX = 512;

// The projects whose index this module remembers between calls. The fleet works
// in a handful of checkouts at a time, and the bound is what stops a daemon
// left running for weeks from holding every project it ever saw.
const CACHE_MAX = 64;

// The index line shape the store writes: `- [Title](name.md) - description`.
// Only these lines are read, which is what the measured recognition run was
// scored against; a heading or a note in the same file is not a record.
const INDEX_LINE_RE = /^- \[/;
const INDEX_NAME_RE = /^- \[[^\]]*\]\(([^)]+)\)/;

let memqModule = null;
// The latched failure: a fact about the installation, answered once.
let memqFailure = null;
// The most recent failure of any kind, latched or not. What the caller reports.
let memqLastFailure = null;

// memq, or null when this tree cannot supply one this daemon can use.
//
// Two failures, remembered differently. A tree with no plugin beside it, or one
// whose memq lacks an export this depends on, is a settled fact about the
// installation: it is remembered, and recognition stands down for the life of
// the process rather than paying a failing require per captured call. Anything
// else (a descriptor exhaustion, a file locked mid-update) is a moment rather
// than a fact, and is left unremembered so the next captured call tries again;
// latching one of those would stand recognition down until the daemon was
// restarted over a condition that cleared in seconds.
function loadMemq() {
    if (memqModule !== null || memqFailure !== null) return memqModule;
    let loaded = null;
    try {
        loaded = require(MEMQ_PATH);
    } catch (err) {
        const code = (err && typeof err.code === 'string') ? err.code : 'require failed';
        memqLastFailure = `memq could not be loaded (${code})`;
        if (code === 'MODULE_NOT_FOUND') memqFailure = memqLastFailure;
        return null;
    }
    for (const [name, kind] of MEMQ_SYMBOLS) {
        if (loaded === null || typeof loaded !== 'object' || typeof loaded[name] !== kind) {
            memqFailure = `memq does not export ${name} as a ${kind}`;
            memqLastFailure = memqFailure;
            return null;
        }
    }
    memqModule = loaded;
    memqLastFailure = null;
    return memqModule;
}

// The reason recognition has no memq to resolve through, or null while it has
// one. A latched reason answers every later call; an unlatched one describes
// the attempt this call just made.
function memqStandDown() {
    loadMemq();
    return memqLastFailure;
}

// The default store root: memq's own, which is the live store unless the
// environment overrides it under memq's data gate.
function defaultMemoryRoot() {
    const memq = loadMemq();
    return memq === null ? null : memq.memoryRoot();
}

// The project directory segment for one working directory, or null when the
// question cannot be asked of that path.
//
// The network screen is why this is not a bare call to memq: resolving a
// segment reaches worktreeMainRoot's stat of `<cwd>/.git`, and a working
// directory on an unreachable share blocks there for the SMB timeout. The
// daemon consumes lines written by every session on this machine, so the cwd it
// is handed is not one it chose, and the screen is memq's own.
function projectSegment(cwd) {
    const memq = loadMemq();
    if (memq === null) return null;
    if (typeof cwd !== 'string' || cwd.trim() === '') return null;
    if (memq.namesNetworkShare(cwd)) return null;
    let main = null;
    try {
        main = memq.worktreeMainRoot(cwd);
    } catch {
        // A working directory that cannot be examined is an ordinary checkout
        // as far as this is concerned; the cwd derivation stands.
        main = null;
    }
    // The sanitizer refuses a value the store will not name a project by (a
    // relative spelling among them) by throwing, and the spool validates cwd
    // only as a capped string, so a line any local process wrote can carry
    // one. This module's own contract is that nothing here throws at its
    // caller: the refusal reads as no project, the same answer an empty cwd
    // gives, and the daemon counts it rather than dying on it.
    try {
        return memq.sanitizeProjectPath(main === null ? cwd : main);
    } catch {
        return null;
    }
}

// The memory index file for one project segment under one store root.
function indexFileFor(memoryRoot, segment) {
    const memq = loadMemq();
    if (memq === null) return null;
    return path.join(memoryRoot, 'projects', segment, 'memory', memq.INDEX_FILE);
}

// The memory index file a captured call's cwd resolves to, or null.
function indexFileForCwd(cwd, memoryRoot) {
    const root = (typeof memoryRoot === 'string' && memoryRoot !== '') ? memoryRoot : defaultMemoryRoot();
    if (root === null) return null;
    const segment = projectSegment(cwd);
    if (segment === null) return null;
    return indexFileFor(root, segment);
}

// The record lines of an index, and the names they name.
//
// Only `- [` lines are kept, which is the shape the measured run was scored
// against. One line and one name are the same decision: a line whose name is
// outside RECORD_NAME_RE, or that names nothing at all, is left out of BOTH the
// text and the name set. Shown to the model and then refused on the way back,
// such a record would arrive as an invented name for answering exactly as the
// index asked, and a rising invented count is the signal that the prompt or the
// model has drifted. What the model is shown and what it may answer with are
// one list.
//
// `truncated` says the answer is being formed against less than the store
// holds, which the prompt states rather than hiding: a model told the list is
// complete when it is not answers about records it was never shown.
function parseIndex(text, readCut) {
    const lines = [];
    const names = new Set();
    let truncated = readCut === true;
    for (const raw of String(text).split('\n')) {
        const line = raw.replace(/\r$/, '');
        if (!INDEX_LINE_RE.test(line)) continue;
        const match = INDEX_NAME_RE.exec(line);
        if (match === null) continue;
        const name = match[1].replace(/\.md$/i, '');
        if (!isRecordName(name)) continue;
        lines.push(line);
        names.add(name);
        if (lines.length >= INDEX_LINES_MAX) { truncated = true; break; }
    }
    return { text: lines.join('\n'), lines: lines.length, names, truncated };
}

// The cache, keyed on the resolved index path. Each entry remembers the mtime
// and the size the text was read at, so an index edited while the daemon runs
// is re-read on the next captured call rather than held stale for the life of
// the process. The stat is taken on every call and the read only when it moved:
// one lstat per captured call is nothing beside the model call it precedes.
const cache = new Map();

function remember(file, entry) {
    cache.delete(file);
    cache.set(file, entry);
    while (cache.size > CACHE_MAX) {
        const oldest = cache.keys().next();
        if (oldest.done) break;
        cache.delete(oldest.value);
    }
}

// The index a captured call should be recognized against.
//
// Statuses, each of which the caller counts and none of which is a fault:
//
//   ok           an index was read (or served from the cache) and holds records
//   nomemq       this tree cannot supply a usable memq, so nothing resolves
//   noproject    the cwd is empty, network-shaped, or resolves to no segment
//   noindex      the project has no index file: no memories here yet
//   unreadable   the path is there and is not a readable regular file
//   empty        the index exists and names no records
//
// Only `ok` earns a model call. The plan's acceptance requires exactly that: a
// session in a project with no memory index produces no recognition calls, not
// an empty one.
function loadIndex(cwd, options) {
    const opts = options || {};
    const stand = memqStandDown();
    if (stand !== null) return { status: 'nomemq', detail: stand };

    const file = indexFileForCwd(cwd, opts.memoryRoot);
    if (file === null) return { status: 'noproject' };

    let st = null;
    try {
        st = fs.lstatSync(file);
    } catch (err) {
        const code = (err && typeof err.code === 'string') ? err.code : '';
        if (code === 'ENOENT') return { status: 'noindex', file };
        return { status: 'unreadable', file, detail: code || 'lstat failed' };
    }
    // lstat rather than stat, and a link is refused rather than followed: the
    // index is read into a prompt that leaves this machine, and a link planted
    // at that path would send whatever it points at across the wire.
    if (st.isSymbolicLink() || !st.isFile()) {
        return { status: 'unreadable', file, detail: 'not a regular file' };
    }

    const cached = cache.get(file);
    if (cached !== undefined && cached.mtimeMs === st.mtimeMs && cached.size === st.size) {
        return cached.names.size === 0
            ? { status: 'empty', file, cached: true }
            : { status: 'ok', file, text: cached.text, names: cached.names, records: cached.names.size, truncated: cached.truncated, cached: true };
    }

    let raw = '';
    let readCut = false;
    let fd = null;
    try {
        fd = fs.openSync(file, 'r');
        // The check that matters is on the open descriptor, not on the path:
        // between the lstat above and this open, the path can be replaced by a
        // link to anything, and the bytes this reads go into a prompt that
        // leaves the machine. What is read is what was opened.
        const opened = fs.fstatSync(fd);
        if (!opened.isFile() || (st.ino !== 0 && opened.ino !== st.ino)) {
            return { status: 'unreadable', file, detail: 'the path changed between the check and the read' };
        }
        const want = Math.min(INDEX_READ_CAP, opened.size);
        readCut = opened.size > want;
        const buf = Buffer.allocUnsafe(want);
        const got = fs.readSync(fd, buf, 0, want, 0);
        raw = buf.toString('utf8', 0, got);
        // A cut at a byte count can land inside a multi-byte character, which
        // decodes to a replacement character in the middle of a record name.
        // The last line of a cut read is dropped rather than decoded: it is
        // partial by construction.
        if (readCut) raw = raw.slice(0, raw.lastIndexOf('\n') + 1);
    } catch (err) {
        const code = (err && typeof err.code === 'string') ? err.code : '';
        return { status: 'unreadable', file, detail: code || 'read failed' };
    } finally {
        if (fd !== null) { try { fs.closeSync(fd); } catch { /* the read is what mattered */ } }
    }

    const parsed = parseIndex(raw, readCut);
    remember(file, { mtimeMs: st.mtimeMs, size: st.size, text: parsed.text, names: parsed.names, truncated: parsed.truncated });
    if (parsed.names.size === 0) return { status: 'empty', file, cached: false };
    return { status: 'ok', file, text: parsed.text, names: parsed.names, records: parsed.names.size, truncated: parsed.truncated, cached: false };
}

// Forget every remembered index. For a caller that wants a cold read; the
// daemon never calls it, and the suite does.
function clearCache() {
    cache.clear();
}

module.exports = {
    MEMQ_PATH,
    MEMQ_SYMBOLS,
    INDEX_READ_CAP,
    INDEX_LINES_MAX,
    CACHE_MAX,
    RECORD_NAME_RE,
    memqStandDown,
    defaultMemoryRoot,
    projectSegment,
    indexFileFor,
    indexFileForCwd,
    parseIndex,
    loadIndex,
    clearCache
};
