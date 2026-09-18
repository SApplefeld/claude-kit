#!/usr/bin/env node
// hook-dispatch-boot.js - the thread side of hook-dispatch.js.
//
// Runs one unmodified hook script as this thread's main module and hands its
// answer back through a SharedArrayBuffer. A hook reads its payload with
// fs.readFileSync(0), writes to stdout or stderr, and ends through
// process.exit or a natural return. Inside a worker thread process.exit ends
// the thread alone, so the hook keeps its own exit-code meaning and its own
// uncaught-exception boundary without its file changing.
//
// The result is written from the thread's 'exit' handler, which runs on
// process.exit and on a natural end alike. The write is synchronous and the
// buffer is shared, so the parent reads a complete answer or none: a state
// word of 0 means this thread never reached the handler, 1 means the answer
// is whole, and 2 means it did not fit. The parent sends the last two cases
// other than 1 through a child process instead.
//
// Layout: Int32[0] state, Int32[1] exit code, Int32[2] stdout byte length,
// Int32[3] stderr byte length, then stdout bytes followed by stderr bytes.

'use strict';

const { workerData, isMainThread } = require('worker_threads');

if (isMainThread) {
    process.stderr.write('hook-dispatch-boot.js runs only as a worker thread of hook-dispatch.js\n');
    process.exit(1);
}

const fs = require('fs');
const Module = require('module');

const HEADER_BYTES = 16;
const { sab, payload, hookPath } = workerData;
const head = new Int32Array(sab, 0, 4);
const body = new Uint8Array(sab, HEADER_BYTES);

const out = [];
const err = [];

// File descriptor 0 belongs to the dispatcher, which has already read it. The
// hook is handed the same text under the one spelling every kit hook uses.
const realReadFileSync = fs.readFileSync;
fs.readFileSync = function readFileSync(target, ...rest) {
    if (target === 0) return payload;
    return realReadFileSync.call(this, target, ...rest);
};

function collector(sink) {
    return function write(chunk, encoding, callback) {
        sink.push(Buffer.isBuffer(chunk)
            ? chunk
            : Buffer.from(String(chunk), typeof encoding === 'string' ? encoding : 'utf8'));
        if (typeof encoding === 'function') encoding();
        else if (typeof callback === 'function') callback();
        return true;
    };
}
process.stdout.write = collector(out);
process.stderr.write = collector(err);

// Several hooks answer with fs.writeSync(1, ...) or report with
// fs.writeSync(2, ...), which reaches the real descriptor and never touches
// the stream objects above. Descriptors 1 and 2 are the dispatcher's, so a
// write to either is collected here instead. Every other descriptor is the
// hook's own file and passes through.
const realWriteSync = fs.writeSync;
fs.writeSync = function writeSync(fd, data, ...rest) {
    if (fd !== 1 && fd !== 2) return realWriteSync.call(this, fd, data, ...rest);
    let bytes;
    if (typeof data === 'string') {
        // (fd, string, position, encoding)
        bytes = Buffer.from(data, typeof rest[1] === 'string' ? rest[1] : 'utf8');
    } else {
        // (fd, buffer, offset, length, position)
        const view = Buffer.from(data.buffer, data.byteOffset, data.byteLength);
        const offset = typeof rest[0] === 'number' ? rest[0] : 0;
        const length = typeof rest[1] === 'number' ? rest[1] : view.length - offset;
        bytes = Buffer.from(view.subarray(offset, offset + length));
    }
    (fd === 1 ? out : err).push(bytes);
    return bytes.length;
};

process.on('exit', (code) => {
    const o = Buffer.concat(out);
    const e = Buffer.concat(err);
    if (o.length + e.length > body.length) {
        Atomics.store(head, 0, 2);
        return;
    }
    body.set(o, 0);
    body.set(e, o.length);
    Atomics.store(head, 1, code | 0);
    Atomics.store(head, 2, o.length);
    Atomics.store(head, 3, e.length);
    Atomics.store(head, 0, 1);
});

// A hook spawned as a child process sees its own path at argv[1] and is
// require.main. Both hold here.
process.argv[1] = hookPath;
try {
    Module._load(hookPath, null, true);
} catch (x) {
    // What node itself does with an uncaught throw in a main module: the stack
    // on stderr and exit code 1.
    process.stderr.write(String((x && x.stack) || x) + '\n');
    process.exitCode = 1;
}
