// Tests for plugins/claude-kit/hooks/kit-read-lib.js, the shared bounded reader
// every kit hook read of a repository-supplied file runs through.
//
// Node's built-in test runner, no framework. The subject is the contract a
// caller summarizing what it read depends on: the kind and the size both come
// off the open descriptor rather than off the name, the read fills its buffer
// however many calls that takes, a result that is not the whole file says so
// whichever bound stopped it and names which one did, an opt-in caller's link
// refusal holds on both the platforms it is spelled for, a bounded result
// carries whole lines only, and a listing says the same of a directory.
// containedRealPath, the containment judgment the reader leaves to its callers,
// is here too.
//
// The short-read cases drive fs.readSync through a wrapper that hands back
// fewer bytes than asked for, which is behavior the syscall is allowed to show
// and no fixture on a local disk reliably produces. Each is paired with a
// control on the same fixture read normally, since a case that cannot tell a
// filled buffer from a short one would pass either way.

'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const os = require('os');

const LIB = path.join(__dirname, '..', 'plugins', 'claude-kit', 'hooks', 'kit-read-lib.js');
const { readFully, readFileBounded, containedRealPath, listBoundedNames } = require(LIB);

function makeDir() {
    return fs.mkdtempSync(path.join(os.tmpdir(), 'kit-read-lib-test-'));
}

function rmDir(dir) {
    try { fs.rmSync(dir, { recursive: true, force: true }); } catch { /* best effort */ }
}

function writeFile(dir, name, content) {
    const p = path.join(dir, name);
    fs.writeFileSync(p, content, 'utf8');
    return p;
}

// Run fn with fs.readSync capped at maxBytes per call, which is what a short
// read looks like from the caller's side. The original is restored whatever fn
// does, since every other case in this suite reads through it.
function withCappedReads(maxBytes, fn) {
    const real = fs.readSync;
    fs.readSync = function cappedReadSync(fd, buffer, offset, length, position) {
        return real.call(fs, fd, buffer, offset, Math.min(length, maxBytes), position);
    };
    try {
        return fn();
    } finally {
        fs.readSync = real;
    }
}

test('a file inside the ceiling comes back whole, and says it is whole', () => {
    const dir = makeDir();
    try {
        const content = 'alpha\nbeta\ngamma\n';
        const file = writeFile(dir, 'plain.txt', content);
        const res = readFileBounded(file, 64 * 1024);
        assert.deepStrictEqual(res, { text: content, bounded: false, bytesRead: content.length, boundedBy: null });
    } finally { rmDir(dir); }
});

test('a file past the ceiling is bounded, and carries whole lines only', () => {
    const dir = makeDir();
    try {
        // The ceiling lands inside the third line, so a reader that kept the
        // fragment would see a line that does not exist in the file.
        const file = writeFile(dir, 'big.txt', 'aaaa\nbbbb\ncccc\ndddd\n');
        const res = readFileBounded(file, 12);
        assert.strictEqual(res.bounded, true);
        assert.strictEqual(res.text, 'aaaa\nbbbb\n');
        assert.strictEqual(res.bytesRead, 12);
    } finally { rmDir(dir); }
});

test('a bounded read holding no line break at all comes back empty', () => {
    const dir = makeDir();
    try {
        // Every byte inside the ceiling belongs to a line the cut severed, so
        // there is no whole line to report and the text is empty rather than a
        // fragment.
        const file = writeFile(dir, 'oneline.txt', 'a single very long line with no break until here\n');
        const res = readFileBounded(file, 10);
        assert.strictEqual(res.bounded, true);
        assert.strictEqual(res.text, '');
    } finally { rmDir(dir); }
});

test('a cut inside a multi-byte character leaves no replacement codepoint behind', () => {
    const dir = makeDir();
    try {
        // The ceiling falls between the two bytes of the second copyright sign,
        // which decodes to U+FFFD. It sits after the last newline, so the tail
        // drop takes it with the rest of the severed line.
        const file = writeFile(dir, 'utf8.txt', 'first\n©©©\n');
        const res = readFileBounded(file, 9);
        assert.strictEqual(res.bounded, true);
        assert.strictEqual(res.text, 'first\n');
        assert.ok(!res.text.includes('�'));
    } finally { rmDir(dir); }
});

test('a read that comes back a few bytes at a time still returns the whole file', () => {
    const dir = makeDir();
    try {
        const content = 'one\ntwo\nthree\nfour\nfive\n';
        const file = writeFile(dir, 'short-reads.txt', content);
        const capped = withCappedReads(3, () => readFileBounded(file, 64 * 1024));
        assert.deepStrictEqual(capped, { text: content, bounded: false, bytesRead: content.length, boundedBy: null });
        // The control: the same fixture read normally. Without it a fill loop
        // that never ran would be indistinguishable from one that worked.
        const plain = readFileBounded(file, 64 * 1024);
        assert.deepStrictEqual(plain, capped);
    } finally { rmDir(dir); }
});

test('readFully fills its window however many reads that takes', () => {
    const dir = makeDir();
    try {
        const file = writeFile(dir, 'window.txt', '0123456789abcdef');
        const fd = fs.openSync(file, 'r');
        try {
            assert.strictEqual(withCappedReads(2, () => readFully(fd, 4, 8)), '456789ab');
            assert.strictEqual(readFully(fd, 4, 8), '456789ab');
            // A window running past the end of the file stops at the end
            // rather than looping on a read that returns nothing.
            assert.strictEqual(withCappedReads(3, () => readFully(fd, 12, 16)), 'cdef');
        } finally {
            fs.closeSync(fd);
        }
    } finally { rmDir(dir); }
});

test('a read that ends short of the file size is bounded', () => {
    const dir = makeDir();
    try {
        // A read returning zero before the buffer is full is what a file
        // truncated under the reader, or a device that stopped answering,
        // looks like: the text is not the whole file and says so, which the
        // size test alone would never notice.
        const file = writeFile(dir, 'shrinks.txt', 'kept\nkept\nlost\nlost\n');
        const real = fs.readSync;
        let calls = 0;
        fs.readSync = function stoppingReadSync(fd, buffer, offset, length, position) {
            calls += 1;
            if (calls > 1) return 0;
            return real.call(fs, fd, buffer, offset, Math.min(length, 10), position);
        };
        let res;
        try {
            res = readFileBounded(file, 64 * 1024);
        } finally {
            fs.readSync = real;
        }
        assert.strictEqual(res.bounded, true);
        assert.strictEqual(res.text, 'kept\nkept\n');
        assert.strictEqual(res.bytesRead, 10);
        // The control: read normally the same file is whole and unbounded.
        assert.deepStrictEqual(readFileBounded(file, 64 * 1024).bounded, false);
    } finally { rmDir(dir); }
});

test('a bounded result says WHICH bound stopped it', () => {
    const dir = makeDir();
    try {
        // The two facts behind the flag are one answer to "was this partial"
        // and two different answers to "could this file be mine": a ceiling that
        // bound says the file is larger than the caller's cap, while a fill loop
        // that ended short says the file was truncated under the read or a
        // device stopped answering, which any file at all can do. A caller whose
        // two directions differ in cost (the deferral nudge's stamp writer heals
        // one and refuses the other) needs them apart, so the result names the
        // bound rather than only reporting that there was one.
        const file = writeFile(dir, 'lines.txt', 'aaaa\nbbbb\ncccc\ndddd\n');
        assert.strictEqual(readFileBounded(file, 64 * 1024).boundedBy, null,
            'a whole file is bounded by nothing');
        assert.strictEqual(readFileBounded(file, 12).boundedBy, 'ceiling',
            'a file past the ceiling names the ceiling');

        const real = fs.readSync;
        function stoppingAfter(bytes, ceiling) {
            let calls = 0;
            fs.readSync = function stoppingReadSync(fd, buffer, offset, length, position) {
                calls += 1;
                if (calls > 1) return 0;
                return real.call(fs, fd, buffer, offset, Math.min(length, bytes), position);
            };
            try { return readFileBounded(file, ceiling === undefined ? 64 * 1024 : ceiling); }
            finally { fs.readSync = real; }
        }
        assert.strictEqual(stoppingAfter(10).boundedBy, 'short-fill',
            'a fill loop that ended short names the fill');
        // Both at once: the ceiling binds AND the fill ends short of it. The
        // fill is what the result names, because it is the reading a caller
        // must not treat as a file too large to be its own.
        assert.strictEqual(stoppingAfter(5, 15).boundedBy, 'short-fill',
            'a short fill under a binding ceiling still names the fill');
    } finally { rmDir(dir); }
});

test('the link refusal rides the open where the platform has O_NOFOLLOW',
    { skip: process.platform === 'win32' }, () => {
        const dir = makeDir();
        try {
            // Off win32 the refusal is a flag on the OPEN, so there is no window
            // between a verdict about a name and an open of that name. The
            // observation is both halves: a real link at the final component is
            // refused, and the flag the open carries says why.
            const target = writeFile(dir, 'target.txt', 'floor\n');
            const link = path.join(dir, 'link.txt');
            fs.symlinkSync(target, link);
            assert.strictEqual(readFileBounded(link, 64 * 1024).text, 'floor\n',
                'the control: the same link is followed when nothing asks for the refusal');
            assert.strictEqual(readFileBounded(link, 64 * 1024, { refuseLink: true }), null,
                'and refused when a caller asks');
            // The control on the option itself: a regular file is not refused by
            // it, so the case above is about the link and not about an option
            // that refuses everything.
            assert.strictEqual(readFileBounded(target, 64 * 1024, { refuseLink: true }).text, 'floor\n',
                'a regular file reads exactly as it did');

            const realOpen = fs.openSync;
            const flags = [];
            fs.openSync = function recordingOpenSync(p, flag, ...rest) {
                flags.push(flag);
                return realOpen.call(fs, p, flag, ...rest);
            };
            try {
                readFileBounded(target, 64 * 1024, { refuseLink: true });
            } finally {
                fs.openSync = realOpen;
            }
            assert.strictEqual(flags.length, 1);
            assert.ok((flags[0] & fs.constants.O_NOFOLLOW) === fs.constants.O_NOFOLLOW,
                'the refusal rides the open rather than a stat on the name');
            // And nothing stats the name here: the lstat leg is the win32
            // fallback alone.
            const realLstat = fs.lstatSync;
            let lstats = 0;
            fs.lstatSync = function countingLstatSync() {
                lstats += 1;
                return realLstat.apply(fs, arguments);
            };
            try {
                readFileBounded(target, 64 * 1024, { refuseLink: true });
            } finally {
                fs.lstatSync = realLstat;
            }
            assert.strictEqual(lstats, 0, 'no name is judged ahead of the open on this platform');
        } finally { rmDir(dir); }
    });

test('the link refusal is an lstat ahead of the open where the platform has no O_NOFOLLOW',
    { skip: process.platform !== 'win32' }, () => {
        const dir = makeDir();
        try {
            // win32 has no O_NOFOLLOW and no way to reach
            // FILE_FLAG_OPEN_REPARSE_POINT through fs, so the refusal is an
            // lstat before the open, which narrows the window rather than
            // closing it. A file symlink needs a privilege this suite must not
            // require, so the link kind is put in front of the reader by
            // shimming the one syscall that decides it; the file underneath is
            // an ordinary regular one, which is what the control reads back.
            const file = writeFile(dir, 'signpost.json', '{"floor":1}\n');
            assert.strictEqual(readFileBounded(file, 64 * 1024, { refuseLink: true }).text, '{"floor":1}\n',
                'the control: a regular file is read with the option on');
            const realLstat = fs.lstatSync;
            fs.lstatSync = function reportingLstatSync(p) {
                const st = realLstat.apply(fs, arguments);
                if (String(p) === file) {
                    return { size: st.size, isFile: () => false, isDirectory: () => false, isSymbolicLink: () => true };
                }
                return st;
            };
            try {
                assert.strictEqual(readFileBounded(file, 64 * 1024, { refuseLink: true }), null,
                    'a path reported as a link is refused rather than opened');
                // The option is opt-in: the same reading without it follows the
                // link exactly as it always did, which is what keeps the callers
                // that never asked for this unchanged.
                assert.strictEqual(readFileBounded(file, 64 * 1024).text, '{"floor":1}\n',
                    'and a caller that did not ask is not made to pay for it');
            } finally {
                fs.lstatSync = realLstat;
            }
        } finally { rmDir(dir); }
    });

test('a path that is not a regular file is refused before it is opened', () => {
    const dir = makeDir();
    try {
        fs.mkdirSync(path.join(dir, 'a-directory'));
        assert.strictEqual(readFileBounded(path.join(dir, 'a-directory'), 64 * 1024), null);
        assert.strictEqual(readFileBounded(path.join(dir, 'absent.txt'), 64 * 1024), null);
    } finally { rmDir(dir); }
});

test('the open is the non-blocking one off win32, which is what a FIFO at the path needs', () => {
    const dir = makeDir();
    try {
        // A FIFO's open waits for a writer, and no try around it can return
        // from that wait; O_NONBLOCK is what makes the open answer instead, and
        // the fstat below it is what then refuses the kind. A FIFO cannot be
        // created on every platform this suite runs on, so the observation here
        // is the flag the open actually carries. win32 has neither O_NONBLOCK
        // nor a path-named FIFO, so there the flag is the plain read-only one.
        const file = writeFile(dir, 'plain.txt', 'x\n');
        const realOpen = fs.openSync;
        const flags = [];
        fs.openSync = function recordingOpenSync(target, flag, ...rest) {
            flags.push(flag);
            return realOpen.call(fs, target, flag, ...rest);
        };
        try {
            readFileBounded(file, 64 * 1024);
        } finally {
            fs.openSync = realOpen;
        }
        assert.strictEqual(flags.length, 1);
        const expected = process.platform === 'win32'
            ? fs.constants.O_RDONLY
            : fs.constants.O_RDONLY | fs.constants.O_NONBLOCK;
        assert.strictEqual(flags[0], expected);
    } finally { rmDir(dir); }
});

test('the kind verdict is taken from the open descriptor, not from the name', () => {
    const dir = makeDir();
    try {
        // A name judged and then opened leaves the window a local process swaps
        // the file inside, so the verdict has to come off the descriptor. The
        // observation is that a stat of the name is never what decides: with
        // statSync made to answer for a regular file at every path, a directory
        // is still refused.
        fs.mkdirSync(path.join(dir, 'a-directory'));
        const realStat = fs.statSync;
        fs.statSync = function lyingStatSync() {
            return { isFile: () => true, size: 16 };
        };
        try {
            assert.strictEqual(readFileBounded(path.join(dir, 'a-directory'), 64 * 1024), null);
        } finally {
            fs.statSync = realStat;
        }
        // The control: the same refusal with nothing shimmed, so the case above
        // is measuring the descriptor rather than a broken fixture.
        assert.strictEqual(readFileBounded(path.join(dir, 'a-directory'), 64 * 1024), null);
    } finally { rmDir(dir); }
});

test('the size that bounds the read is the descriptor\'s own', () => {
    const dir = makeDir();
    try {
        // A size read off the name describes whatever stood there then, so a
        // file that grew between that reading and the open comes back short
        // while calling itself whole, which is a partial reading reaching a
        // caller as a total. Here the name answers with a stale, smaller size
        // and with a refusal; the read is the whole file both times, because
        // nothing consults the name.
        const content = 'aaaa\nbbbb\ncccc\ndddd\n';
        const file = writeFile(dir, 'grew.txt', content);
        const realStat = fs.statSync;
        fs.statSync = function staleStatSync() {
            return { isFile: () => true, size: 5 };
        };
        let stale;
        try {
            stale = readFileBounded(file, 64 * 1024);
        } finally {
            fs.statSync = realStat;
        }
        assert.deepStrictEqual(stale, { text: content, bounded: false, bytesRead: content.length, boundedBy: null });
        fs.statSync = function refusingStatSync() {
            const err = new Error('ENOENT: the fixture refuses this stat');
            err.code = 'ENOENT';
            throw err;
        };
        let refused;
        try {
            refused = readFileBounded(file, 64 * 1024);
        } finally {
            fs.statSync = realStat;
        }
        assert.deepStrictEqual(refused, stale);
        // The bound the descriptor's own size does set: a ceiling under it.
        assert.strictEqual(readFileBounded(file, 10).bounded, true);
    } finally { rmDir(dir); }
});

test('a ceiling that is not a positive number is refused', () => {
    const dir = makeDir();
    try {
        const file = writeFile(dir, 'plain.txt', 'x\n');
        assert.strictEqual(readFileBounded(file, 0), null);
        assert.strictEqual(readFileBounded(file, -1), null);
        assert.strictEqual(readFileBounded(file, NaN), null);
        assert.strictEqual(readFileBounded(file, '64'), null);
        assert.strictEqual(readFileBounded('', 64), null);
    } finally { rmDir(dir); }
});

test('an empty file reads as empty and whole', () => {
    const dir = makeDir();
    try {
        const file = writeFile(dir, 'empty.txt', '');
        assert.deepStrictEqual(readFileBounded(file, 64 * 1024), { text: '', bounded: false, bytesRead: 0, boundedBy: null });
    } finally { rmDir(dir); }
});

test('containment answers on the resolved path, so a link out of the root is refused', (t) => {
    const root = makeDir();
    const outside = makeDir();
    try {
        const inside = writeFile(root, 'kept.md', 'kept\n');
        assert.strictEqual(containedRealPath(root, inside), fs.realpathSync(inside));
        assert.strictEqual(containedRealPath(root, path.join(root, 'absent.md')), null,
            'nothing at the path resolves to nothing');
        writeFile(outside, 'foreign.md', 'foreign\n');
        // A directory junction is the link kind this box creates without
        // privilege; a file symlink is the same rule reached by a different
        // kind, and the resolution both go through is what the check reads.
        try {
            fs.symlinkSync(outside, path.join(root, 'linked'), 'junction');
        } catch (err) {
            return t.skip('this box refuses a junction: ' + err.code);
        }
        assert.strictEqual(containedRealPath(root, path.join(root, 'linked', 'foreign.md')), null,
            'a path resolving out of the root is refused');
        // The control: the same shape resolving back inside is kept, so the
        // refusal above is about where the path landed and not about links.
        try {
            fs.symlinkSync(root, path.join(root, 'self'), 'junction');
        } catch (err) {
            return t.skip('this box refuses a second junction: ' + err.code);
        }
        assert.strictEqual(containedRealPath(root, path.join(root, 'self', 'kept.md')),
            fs.realpathSync(inside));
    } finally { rmDir(root); rmDir(outside); }
});

test('a listing states its bound when the cap binds or the directory will not answer', () => {
    const dir = makeDir();
    try {
        for (let i = 0; i < 5; i++) writeFile(dir, `f${i}.md`, 'x\n');
        const whole = listBoundedNames(dir, 10, (d) => d.name.endsWith('.md'));
        assert.strictEqual(whole.names.length, 5);
        assert.strictEqual(whole.bounded, false);
        const capped = listBoundedNames(dir, 3, (d) => d.name.endsWith('.md'));
        assert.strictEqual(capped.names.length, 3);
        assert.strictEqual(capped.bounded, true);
        // An absent directory is nothing to miss; a path that is not a
        // directory at all is a listing that never happened, and says so.
        assert.deepStrictEqual(listBoundedNames(path.join(dir, 'absent'), 10, () => true),
            { names: [], bounded: false });
        assert.deepStrictEqual(listBoundedNames(path.join(dir, 'f0.md'), 10, () => true),
            { names: [], bounded: true });
    } finally { rmDir(dir); }
});
