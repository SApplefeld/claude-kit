// One judgment call to the model endpoint, and the classification of what came
// back.
//
// WHERE THE DATA GOES. This module is the point at which spool content leaves
// this machine. Every call POSTs the observed session's stated intent, the full
// text of the shell command it ran, and that command's output to the endpoint
// named in `~/.claude/kit-endpoint.json`. That endpoint does not run on this
// VM: it runs on the Hyper-V host, reached across the virtual switch, over
// plain HTTP with no authentication in the fleet's default configuration, and
// it is shared with other tenants of that host including the operator's own
// agent harness. So each call is unredacted command output crossing a machine
// boundary in cleartext to a multi-tenant service, and anything a command
// printed, tokens and keys among them, crosses with it. sidecar/CONTRACT.md
// states that posture in full and nothing here redacts.
//
// FIVE OUTCOMES, NOT TWO. The caller's resilience policy differs by outcome, so
// this module never collapses them:
//
//   ok           a verdict came back and validated
//   timeout      the request outran its own clock; the lane is serial and has a
//                standing second tenant, so this is a queue, not a fault
//   unreachable  the connection itself failed; the runner may be restarting,
//                which is the one outcome that earns a retry
//   refused      the endpoint answered and said no: a non-2xx status, an error
//                body, or a body that could not be read
//   unusable     the endpoint answered with something that is not a verdict:
//                not JSON, not an object, or a word outside the enum
//
// Collapsing unreachable into timeout would lose the retry, collapsing refused
// into unreachable would spend a seven-second wait on a server that is answering
// perfectly well, and collapsing unusable into refused would point a reader at
// the server when the repair is the model or the prompt.
//
// The response is SCHEMA-CONSTRAINED. The request carries the response schema
// as its `format`, which is what makes the verdict word an enum member rather
// than a sentence to parse. Prose output breaks its contract on non-achieved
// verdicts; a constrained decode eliminates that failure class. What it does
// not eliminate is composition past the cap, so the reason is cut to the budget
// here as well and the record says it was cut.

'use strict';

const prompt = require('./prompts/judgment-v2.js');
const { neutralize } = require('./text.js');

// The generation ceiling. A JSON object holding an enum word and a reason
// inside the character budget fits well under this; it is a bound on a model
// that will not stop, not a target.
const NUM_PREDICT = 220;

// The most of a response body this module will hold. The endpoint is off this
// machine and shared with other tenants, so the size of what comes back is not
// this daemon's to assume: an answer to a schema-constrained verdict is a few
// hundred bytes, and anything past this is not one. Reading it in bounded
// chunks is what keeps a wrong or hostile answer from being a memory fault in
// the process that is supposed to be watching for wrong answers.
const MAX_BODY_BYTES = 256 * 1024;

// The most of the model's `response` string that is parsed as a verdict. The
// object the schema describes is under 400 characters; a string past this is
// something else and is refused without being parsed.
const MAX_ANSWER_CHARS = 8192;

// How much of an endpoint-supplied error string reaches a record or a report.
const MAX_DETAIL_CHARS = 200;

// Sampling is deterministic. Two runs over the same spool should differ because
// the fleet differed, not because the sampler did.
const TEMPERATURE = 0;

// The gap reason recorded for each non-ok outcome, in the words a rollup
// prints. One map, so the sentence in a findings file and the branch in the
// daemon cannot drift apart.
const GAP_REASONS = {
    timeout: 'lane busy',
    unreachable: 'endpoint down',
    refused: 'endpoint refused the call',
    unusable: 'endpoint returned an unusable verdict'
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
function classifyThrow(err) {
    const name = (err && typeof err.name === 'string') ? err.name : '';
    if (name === 'AbortError' || name === 'TimeoutError') {
        return { status: 'timeout', detail: 'request exceeded its timeout' };
    }
    const code = errorCode(err);
    if (SLOW_CODES.has(code)) return { status: 'timeout', detail: code };
    if (CONNECTION_CODES.has(code)) return { status: 'unreachable', detail: code };
    const message = (err && typeof err.message === 'string') ? err.message : String(err);
    return { status: 'unreachable', detail: code === '' ? neutralize(message).slice(0, MAX_DETAIL_CHARS) : code };
}

// The endpoint's answer as a verdict, or a described refusal. The verdict word
// is compared against the enum rather than trusted: the schema constrains the
// decode and the caller still validates, because a schema the server ignored
// and a schema it honored produce the same shaped HTTP 200.
function parseAnswer(body) {
    const raw = (body !== null && typeof body === 'object' && typeof body.response === 'string')
        ? body.response : '';
    if (raw.length > MAX_ANSWER_CHARS) {
        return { status: 'unusable', detail: `response past ${MAX_ANSWER_CHARS} characters` };
    }
    const text = raw.trim();
    if (text === '') return { status: 'unusable', detail: 'empty response' };

    let answer = null;
    try {
        answer = JSON.parse(text);
    } catch {
        return { status: 'unusable', detail: 'response is not JSON' };
    }
    if (answer === null || typeof answer !== 'object' || Array.isArray(answer)) {
        return { status: 'unusable', detail: 'response is not a JSON object' };
    }

    const verdict = typeof answer.verdict === 'string' ? answer.verdict.trim().toLowerCase() : '';
    if (!prompt.VERDICTS.includes(verdict)) {
        return { status: 'unusable', detail: `verdict is not one of ${prompt.VERDICTS.join(', ')}` };
    }

    // The reason is neutralized HERE, at the point of parse, so every consumer
    // inherits it: the verdict log, the findings file, a rollup over them, and
    // the line a later section delivers back into a session. It is model output
    // derived from text the judged party controls, which makes an escape run or
    // a bidi override in it an ordinary thing to expect rather than an exotic
    // one, and a guard placed in one consumer leaves every record already
    // written unprotected.
    const rawReason = neutralize(answer.reason);
    const reason = rawReason.slice(0, prompt.REASON_MAX_CHARS);
    return {
        status: 'ok',
        verdict,
        reason,
        reasonTruncated: reason.length < rawReason.length
    };
}

// The request body. Built here rather than inline so a test can assert on the
// exact shape that goes over the wire, which is the only place the schema, the
// prompt id and the model come together.
function buildRequest(entry, config) {
    return {
        model: config.model,
        system: prompt.SYSTEM,
        prompt: prompt.formatTriple(entry),
        stream: false,
        think: false,
        format: prompt.responseSchema(),
        options: { num_predict: NUM_PREDICT, temperature: TEMPERATURE }
    };
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

// Judge one entry. Exactly one attempt: the retry policy is the daemon's,
// because whether a failure earns a retry depends on the run's history and not
// on this call. Never throws.
async function judgeOnce(entry, config, deps) {
    const fetchImpl = (deps && typeof deps.fetchImpl === 'function') ? deps.fetchImpl : fetch;
    const started = Date.now();
    const controller = new AbortController();
    const timer = setTimeout(() => { controller.abort(); }, config.timeoutMs);

    let res = null;
    try {
        res = await fetchImpl(`${config.url}/api/generate`, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify(buildRequest(entry, config)),
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
        return { ...parseAnswer(body), latencyMs: Date.now() - started };
    } catch (err) {
        // Reading the body can abort too, and an abort here is still this
        // module's own clock rather than a fault of the endpoint's.
        return { ...classifyThrow(err), latencyMs: Date.now() - started };
    } finally {
        clearTimeout(timer);
    }
}

module.exports = {
    NUM_PREDICT,
    TEMPERATURE,
    MAX_BODY_BYTES,
    MAX_ANSWER_CHARS,
    MAX_DETAIL_CHARS,
    GAP_REASONS,
    CONNECTION_CODES,
    SLOW_CODES,
    classifyThrow,
    parseAnswer,
    buildRequest,
    judgeOnce
};
