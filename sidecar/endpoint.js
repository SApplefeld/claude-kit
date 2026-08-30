// One request to the model endpoint, and the classification of what came back.
//
// WHERE THE DATA GOES. This module is the point at which content leaves this
// machine. Every request POSTs whatever its caller built to the endpoint named
// in `~/.claude/kit-endpoint.json`. That endpoint does not run on this VM: it
// runs on the Hyper-V host, reached across the virtual switch, over plain HTTP
// with no authentication in the fleet's default configuration, and it is shared
// with other tenants of that host including the operator's own agent harness.
// Two callers send two different payloads across that boundary and both are
// unredacted: sidecar/judge.js sends the observed session's stated intent, the
// full text of the shell command it ran and that command's output, and
// sidecar/recognize.js sends the same situation text together with the project
// memory index, one line per record with its title and description. Nothing
// here redacts, and sidecar/CONTRACT.md states the posture in full.
//
// It lives in its own module rather than in the caller that needed it first.
// The transport, the timeout, the bounded body read and the five-way outcome
// classification are properties of the channel, and the second caller reaching
// into the first for them would make the recognition duty fail whenever the
// judgment module failed to load, for no reason a reader could see.
//
// FOUR TRANSPORT OUTCOMES, NOT TWO. The caller's resilience policy differs by
// outcome, so this module never collapses them:
//
//   ok           the endpoint answered 2xx with a JSON body and no error key
//   timeout      the request outran its own clock; the lane is serial and has a
//                standing second tenant, so this is a queue, not a fault
//   unreachable  the connection itself failed; the runner may be restarting,
//                which is the one outcome that earns a retry
//   refused      the endpoint answered and said no: a non-2xx status, an error
//                body, or a body that could not be read
//
// The fifth outcome the daemon acts on, `unusable`, is the caller's: whether an
// answer is a verdict or a list of record names is a question about the schema
// that caller asked for, and this module never sees it.
//
// Collapsing unreachable into timeout would lose the retry, and collapsing
// refused into unreachable would spend a seven-second wait on a server that is
// answering perfectly well.

'use strict';

const { neutralize } = require('./text.js');

// The most of a response body this module will hold. The endpoint is off this
// machine and shared with other tenants, so the size of what comes back is not
// this daemon's to assume: an answer to a schema-constrained call is a few
// hundred bytes, and anything past this is not one. Reading it in bounded
// chunks is what keeps a wrong or hostile answer from being a memory fault in
// the process that is supposed to be watching for wrong answers.
const MAX_BODY_BYTES = 256 * 1024;

// How much of an endpoint-supplied error string reaches a record or a report.
const MAX_DETAIL_CHARS = 200;

// Sampling is deterministic. Two runs over the same spool should differ because
// the fleet differed, not because the sampler did.
const TEMPERATURE = 0;

// The gap reason recorded for each transport outcome, in the words a rollup
// prints. One map, so the sentence in a findings file, the sentence in a
// recognition log and the branch in the daemon cannot drift apart.
//
// The `unusable` reason is deliberately NOT here. It names what the answer
// failed to be, which is a different sentence for a verdict and for a list of
// record names, so each caller states its own beside these three.
const GAP_REASONS = {
    timeout: 'lane busy',
    unreachable: 'endpoint down',
    refused: 'endpoint refused the call'
};

// Error codes that mean the connection never carried a request, as opposed to
// one that was carried and outran its clock.
const CONNECTION_CODES = new Set([
    'ECONNREFUSED', 'ECONNRESET', 'EHOSTUNREACH', 'ENETUNREACH', 'ENETDOWN',
    'ENOTFOUND', 'EAI_AGAIN', 'EPIPE', 'ETIMEDOUT', 'ECONNABORTED',
    'UND_ERR_SOCKET', 'UND_ERR_CONNECT_TIMEOUT'
]);

// Error codes from a connection that was made and then ran out of patience.
const SLOW_CODES = new Set(['UND_ERR_HEADERS_TIMEOUT', 'UND_ERR_BODY_TIMEOUT']);

function errorCode(err) {
    let cursor = err;
    for (let depth = 0; depth < 4 && cursor !== null && typeof cursor === 'object'; depth += 1) {
        if (typeof cursor.code === 'string') return cursor.code;
        cursor = cursor.cause;
    }
    return '';
}

// A thrown fetch failure as one of the outcome names. An abort is this module's
// own clock firing. Anything else that threw did so before a response existed,
// which is a connection failure however the runtime spelled it, so the default
// is `unreachable` rather than a fifth outcome nobody has a policy for.
//
// THE NO-CODE CASE NEVER USES `err.message`. A malformed `config.url` (a
// credential embedded in it, among other shapes) makes the runtime's own URL
// constructor throw a TypeError whose message spells the request URL back out
// in full, with no `.code` anywhere in its cause chain for the coded branches
// above to catch. `config.url` is loaded from `~/.claude/kit-endpoint.json`,
// and config.js's own header and docs/security-model.md both state that the
// endpoint address reaches no log line, record or report; this detail string
// is written into a gap record and rendered by sidecar/rollup.js, so a message
// carrying the address would break that promise. A fixed sentence is used
// instead, which loses only the fact that this specific shape of failure
// happened; the coded branches above still name every failure this daemon can
// usefully act on.
function classifyThrow(err) {
    const name = (err && typeof err.name === 'string') ? err.name : '';
    if (name === 'AbortError' || name === 'TimeoutError') {
        return { status: 'timeout', detail: 'request exceeded its timeout' };
    }
    const code = errorCode(err);
    if (SLOW_CODES.has(code)) return { status: 'timeout', detail: code };
    if (CONNECTION_CODES.has(code)) return { status: 'unreachable', detail: code };
    return { status: 'unreachable', detail: code === '' ? 'connection failed before a response, no error code' : code };
}

// Release a response body nobody is going to read. A fetch response holds its
// socket until the body is consumed or cancelled, so a run of non-2xx answers
// left unread pins one connection each until the pool notices.
async function discardBody(res) {
    const body = res && res.body;
    if (body && typeof body.cancel === 'function') {
        try { await body.cancel(); } catch { /* the socket is what mattered */ }
    }
}

// The response body as an object, read under a byte bound. Returns the parsed
// body or a described refusal; never throws.
//
// The bound is applied on the stream where there is one, which is the path
// production takes: `fetch` gives a web ReadableStream and this reads it in
// chunks, stopping and cancelling the moment the total passes the cap rather
// than buffering whatever the endpoint decided to send. A response object with
// no stream is a test double, and its `json()` is used as it stands.
async function readBoundedBody(res) {
    if (res.body && typeof res.body.getReader === 'function') {
        const reader = res.body.getReader();
        const parts = [];
        let size = 0;
        try {
            for (;;) {
                const step = await reader.read();
                if (step.done) break;
                const part = Buffer.from(step.value);
                size += part.length;
                if (size > MAX_BODY_BYTES) {
                    try { await reader.cancel(); } catch { /* the bound is what mattered */ }
                    return { ok: false, detail: `response body past ${MAX_BODY_BYTES} bytes` };
                }
                parts.push(part);
            }
        } catch (err) {
            return { ok: false, throwed: err };
        }
        try {
            return { ok: true, body: JSON.parse(Buffer.concat(parts).toString('utf8')) };
        } catch {
            return { ok: false, detail: 'response body is not JSON' };
        }
    }
    try {
        return { ok: true, body: await res.json() };
    } catch (err) {
        return { ok: false, detail: 'response body is not JSON', throwed: err };
    }
}

// POST one generation request. Exactly one attempt: the retry policy is the
// daemon's, because whether a failure earns a retry depends on the run's
// history and not on this call. Never throws.
async function postGenerate(request, config, deps) {
    const fetchImpl = (deps && typeof deps.fetchImpl === 'function') ? deps.fetchImpl : fetch;
    const started = Date.now();
    const controller = new AbortController();
    const timer = setTimeout(() => { controller.abort(); }, config.timeoutMs);

    let res = null;
    try {
        res = await fetchImpl(`${config.url}/api/generate`, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify(request),
            signal: controller.signal
        });
    } catch (err) {
        clearTimeout(timer);
        return { ...classifyThrow(err), latencyMs: Date.now() - started };
    }

    try {
        if (!res || typeof res.status !== 'number') {
            return { status: 'refused', detail: 'no response object', latencyMs: Date.now() - started };
        }
        if (res.status < 200 || res.status >= 300) {
            await discardBody(res);
            return { status: 'refused', detail: `HTTP ${res.status}`, latencyMs: Date.now() - started };
        }
        const read = await readBoundedBody(res);
        if (!read.ok) {
            // An abort while the body was being read is still this module's own
            // clock, so it stays a timeout rather than becoming a refusal the
            // caller would spend a different policy on.
            if (read.throwed !== undefined) {
                const thrown = classifyThrow(read.throwed);
                if (thrown.status === 'timeout') return { ...thrown, latencyMs: Date.now() - started };
            }
            return { status: 'refused', detail: read.detail || 'response body could not be read', latencyMs: Date.now() - started };
        }
        const body = read.body;
        if (body !== null && typeof body === 'object' && typeof body.error === 'string' && body.error !== '') {
            // The error text comes from an off-machine multi-tenant service and
            // reaches a report line on stderr unescaped, so it is neutralized
            // before it is anything but bytes.
            return { status: 'refused', detail: neutralize(body.error).slice(0, MAX_DETAIL_CHARS), latencyMs: Date.now() - started };
        }
        return { status: 'ok', body, latencyMs: Date.now() - started };
    } catch (err) {
        // Reading the body can abort too, and an abort here is still this
        // module's own clock rather than a fault of the endpoint's.
        return { ...classifyThrow(err), latencyMs: Date.now() - started };
    } finally {
        clearTimeout(timer);
    }
}

module.exports = {
    MAX_BODY_BYTES,
    MAX_DETAIL_CHARS,
    TEMPERATURE,
    GAP_REASONS,
    CONNECTION_CODES,
    SLOW_CODES,
    errorCode,
    classifyThrow,
    discardBody,
    readBoundedBody,
    postGenerate
};
