'use strict';

// The endpoint client's wire-protocol seam: the `api` config key, the
// translation between the callers' Ollama-shaped request and a chat-completions
// server, and the transport posting to the path each protocol names. The
// callers' own tests (daemon, battery, memq) cover the default protocol end to
// end; this file is where the second protocol is proven without touching them.

const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const http = require('http');
const os = require('os');
const path = require('path');

const lib = require('../plugins/claude-kit/scripts/kit-endpoint-lib.js');

function writeConfig(t, body) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'kit-endpoint-'));
    t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
    const file = path.join(dir, 'kit-endpoint.json');
    fs.writeFileSync(file, JSON.stringify(body));
    return file;
}

// A mock endpoint on an ephemeral port that records what it was sent and
// answers with whatever `handler(body, url)` returns.
function startServer(t, handler) {
    return new Promise((resolve) => {
        const requests = [];
        const server = http.createServer((req, res) => {
            let raw = '';
            req.on('data', (chunk) => { raw += chunk; });
            req.on('end', () => {
                let body = null;
                try { body = JSON.parse(raw); } catch { body = null; }
                requests.push({ url: req.url, body });
                const out = handler(body, req.url) || {};
                res.writeHead(out.status || 200, { 'content-type': 'application/json' });
                res.end(JSON.stringify(out.body === undefined ? {} : out.body));
            });
        });
        server.listen(0, '127.0.0.1', () => {
            const url = `http://127.0.0.1:${server.address().port}`;
            t.after(() => new Promise((done) => {
                server.closeAllConnections();
                server.close(() => done());
            }));
            resolve({ url, requests });
        });
    });
}

const SCHEMA = {
    type: 'object',
    properties: { verdict: { type: 'string', enum: ['achieved', 'failed'] }, reason: { type: 'string' } },
    required: ['verdict', 'reason']
};

function callerRequest() {
    return {
        model: 'judge-model-x',
        system: 'You judge.',
        prompt: 'INTENT: list files\nACTION: ls',
        stream: false,
        think: false,
        format: SCHEMA,
        options: { num_predict: 220, temperature: 0 }
    };
}

// ------------------------------------------------------------- the config --

test('a config without an api key means the protocol every older config meant', (t) => {
    const config = lib.loadEndpointConfig(writeConfig(t, { url: 'http://127.0.0.1:1', model: 'm' }), 5000);
    assert.strictEqual(config.ok, true);
    assert.strictEqual(config.api, lib.DEFAULT_API);
    assert.strictEqual(config.api, 'ollama');
    assert.deepStrictEqual(config.warnings, []);
});

test('api: openai is read, case and whitespace forgiven', (t) => {
    const config = lib.loadEndpointConfig(writeConfig(t, { url: 'http://127.0.0.1:1', model: 'm', api: ' OpenAI ' }), 5000);
    assert.strictEqual(config.ok, true);
    assert.strictEqual(config.api, 'openai');
    assert.deepStrictEqual(config.warnings, []);
});

test('an unknown api is ignored with a warning, and the endpoint is not stood down', (t) => {
    for (const bad of ['grpc', 7, null, '']) {
        const config = lib.loadEndpointConfig(writeConfig(t, { url: 'http://127.0.0.1:1', model: 'm', api: bad }), 5000);
        assert.strictEqual(config.ok, true, `api ${JSON.stringify(bad)} still loads`);
        assert.strictEqual(config.api, 'ollama');
        assert.strictEqual(config.warnings.length, 1);
        assert.ok(config.warnings[0].startsWith(lib.API_WARNING_PREFIX + ':'), config.warnings[0]);
        assert.match(config.warnings[0], /ollama, openai/);
    }
});

test('each protocol posts to its own path, and an unknown one to the default', () => {
    assert.strictEqual(lib.generatePath('ollama'), '/api/generate');
    assert.strictEqual(lib.generatePath('openai'), '/v1/chat/completions');
    assert.strictEqual(lib.generatePath('nonsense'), '/api/generate');
    assert.strictEqual(lib.generatePath(undefined), '/api/generate');
});

// --------------------------------------------------------- the translation --

test('the callers\' request becomes a chat-completions request field for field', () => {
    const out = lib.toChatCompletionsRequest(callerRequest());
    assert.deepStrictEqual(out, {
        model: 'judge-model-x',
        messages: [
            { role: 'system', content: 'You judge.' },
            { role: 'user', content: 'INTENT: list files\nACTION: ls' }
        ],
        stream: false,
        temperature: 0,
        max_tokens: 220,
        response_format: { type: 'json_schema', json_schema: { name: 'answer', schema: SCHEMA } },
        chat_template_kwargs: { enable_thinking: false }
    });
});

test('what the caller did not state is not invented on its behalf', () => {
    const out = lib.toChatCompletionsRequest({ model: 'm', prompt: 'hello' });
    assert.deepStrictEqual(out, { model: 'm', messages: [{ role: 'user', content: 'hello' }], stream: false });
    assert.ok(!('chat_template_kwargs' in out), 'no think key, no thinking switch');
    assert.ok(!('response_format' in out), 'no format, no response format');
    assert.ok(!('max_tokens' in out) && !('temperature' in out));
});

test('the string format json asks for a json object rather than a schema', () => {
    const out = lib.toChatCompletionsRequest({ model: 'm', prompt: 'p', format: 'json' });
    assert.deepStrictEqual(out.response_format, { type: 'json_object' });
});

test('a chat-completions answer reads back as the answer the callers parse', () => {
    const stop = lib.fromChatCompletionsResponse({
        model: 'served-name',
        choices: [{ index: 0, finish_reason: 'stop', message: { role: 'assistant', content: '{"verdict":"achieved"}' } }],
        usage: { completion_tokens: 9 }
    });
    assert.deepStrictEqual(stop, { model: 'served-name', response: '{"verdict":"achieved"}', done: true, done_reason: 'stop' });

    const cut = lib.fromChatCompletionsResponse({
        choices: [{ finish_reason: 'length', message: { content: '{"verdict":"ach' } }]
    });
    assert.strictEqual(cut.done_reason, 'length');
    assert.strictEqual(cut.response, '{"verdict":"ach');

    const wordless = lib.fromChatCompletionsResponse({ choices: [{ finish_reason: 'stop', message: {} }] });
    assert.strictEqual(wordless.response, '');
});

test('an OpenAI-style error object becomes the error string the transport classifies', () => {
    const out = lib.fromChatCompletionsResponse({ error: { code: 500, message: 'model is loading', type: 'unavailable_error' } });
    assert.deepStrictEqual(out, { error: 'model is loading' });
});

test('a body that is not a chat-completions answer passes through untouched', () => {
    const odd = { something: 'else' };
    assert.strictEqual(lib.fromChatCompletionsResponse(odd), odd);
    assert.strictEqual(lib.fromChatCompletionsResponse(null), null);
    assert.strictEqual(lib.fromChatCompletionsResponse('text'), 'text');
});

// ------------------------------------------------------------ the transport --

test('under api: openai the transport posts the translated request to the chat path and hands back the translated answer', async (t) => {
    const server = await startServer(t, () => ({
        body: { choices: [{ finish_reason: 'stop', message: { role: 'assistant', content: '{"verdict":"achieved","reason":"r"}' } }] }
    }));
    const sent = await lib.postGenerate(callerRequest(), { url: server.url, model: 'judge-model-x', api: 'openai', timeoutMs: 5000 });
    assert.strictEqual(sent.status, 'ok', JSON.stringify(sent));
    assert.strictEqual(sent.body.response, '{"verdict":"achieved","reason":"r"}');
    assert.strictEqual(sent.body.done_reason, 'stop');
    assert.strictEqual(server.requests.length, 1);
    assert.strictEqual(server.requests[0].url, '/v1/chat/completions');
    const body = server.requests[0].body;
    assert.strictEqual(body.messages[0].role, 'system');
    assert.strictEqual(body.messages[1].content, 'INTENT: list files\nACTION: ls');
    assert.strictEqual(body.max_tokens, 220);
    assert.deepStrictEqual(body.chat_template_kwargs, { enable_thinking: false });
    assert.ok(!('prompt' in body) && !('options' in body) && !('format' in body), 'nothing Ollama-shaped leaks onto the wire');
});

test('under the default protocol the request goes to /api/generate exactly as built', async (t) => {
    const server = await startServer(t, () => ({ body: { response: '{"verdict":"achieved","reason":"r"}', done_reason: 'stop' } }));
    const request = callerRequest();
    const sent = await lib.postGenerate(request, { url: server.url, model: 'judge-model-x', timeoutMs: 5000 });
    assert.strictEqual(sent.status, 'ok');
    assert.strictEqual(server.requests[0].url, '/api/generate');
    assert.deepStrictEqual(server.requests[0].body, request);
    assert.strictEqual(sent.body.response, '{"verdict":"achieved","reason":"r"}');
});

test('a 2xx chat-completions error body is a refusal carrying the server\'s sentence', async (t) => {
    const server = await startServer(t, () => ({ body: { error: { code: 503, message: 'Loading model', type: 'unavailable_error' } } }));
    const sent = await lib.postGenerate(callerRequest(), { url: server.url, model: 'm', api: 'openai', timeoutMs: 5000 });
    assert.strictEqual(sent.status, 'refused');
    assert.strictEqual(sent.detail, 'Loading model');
});

test('a non-2xx refusal names the status, the path it posted to and the dialect it chose',
    async (t) => {
        // The default is in the table beside the two named dialects because the
        // detail reports the dialect the transport resolved, and a config that
        // names none resolves to the default: that is the reading a caller gets
        // against a gateway serving the other dialect's path, and the one the
        // bare status could not be placed by.
        // The unrecognized row is here because the transport resolves the
        // dialect and the path through two independent fallbacks, so a value
        // outside the flavor list is the one input where they could disagree
        // and name a dialect the transport never spoke.
        for (const [api, posted, dialect] of [[undefined, '/api/generate', 'ollama'],
            ['ollama', '/api/generate', 'ollama'],
            ['openai', '/v1/chat/completions', 'openai'],
            ['grpc', '/api/generate', 'ollama']]) {
            const server = await startServer(t, () => ({ status: 404, body: { error: 'no such path' } }));
            const sent = await lib.postGenerate(callerRequest(),
                { url: server.url, model: 'm', api, timeoutMs: 5000 });
            assert.strictEqual(sent.status, 'refused', JSON.stringify(sent));
            assert.strictEqual(sent.detail, `HTTP 404 from ${posted} (${dialect} dialect)`);
            assert.strictEqual(server.requests[0].url, posted,
                'the detail names the path the request actually reached');
            assert.ok(Number.isFinite(sent.latencyMs), 'a refusal is still timed');
            assert.ok(!('body' in sent), 'and carries no body');
        }
    });

test('a refusal names the doubled path a url carrying its own path produces', async (t) => {
    // The OpenAI convention is a base url ending in /v1, and the config
    // loader accepts one: its check is unanchored at the end. So the request
    // reaches /v1/v1/chat/completions, and the detail has to say so, since a
    // detail naming the dialect's suffix alone reports the exact
    // misconfiguration it exists to expose as a path that reads correct.
    const server = await startServer(t, () => ({ status: 404, body: { error: 'no such path' } }));
    const sent = await lib.postGenerate(callerRequest(),
        { url: server.url + '/v1', model: 'm', api: 'openai', timeoutMs: 5000 });
    assert.strictEqual(sent.status, 'refused', JSON.stringify(sent));
    assert.strictEqual(sent.detail, 'HTTP 404 from /v1/v1/chat/completions (openai dialect)');
    assert.strictEqual(server.requests[0].url, '/v1/v1/chat/completions',
        'and that is the path the request actually reached');
});

test('a length-cut chat answer keeps the reason memq acts on', async (t) => {
    const server = await startServer(t, () => ({ body: { choices: [{ finish_reason: 'length', message: { content: '{"ranking":[' } }] } }));
    const sent = await lib.postGenerate(callerRequest(), { url: server.url, model: 'm', api: 'openai', timeoutMs: 5000 });
    assert.strictEqual(sent.status, 'ok');
    assert.strictEqual(sent.body.done_reason, 'length');
});

// ----------------------------------------------------------------- the probe --

test('the probe reads any answer as liveness, a non-2xx on the base url included', async (t) => {
    // The probe answers whether a transport is there, which is why it fetches
    // the base url and not a dialect's own path: a gateway that serves chat
    // completions and no model listing is up, and a probe that read a status
    // code as a verdict would stand a working endpoint down. The generation
    // call is what reports a wrong dialect, in its refusal's own detail.
    const server = await startServer(t, () => ({ status: 503, body: { error: 'busy' } }));
    const probe = await lib.probeEndpoint({ url: server.url, timeoutMs: 5000 });
    assert.strictEqual(probe.status, 'ok', JSON.stringify(probe));
    assert.strictEqual(probe.httpStatus, 503, 'the status is reported rather than judged');
    assert.strictEqual(server.requests[0].url, '/', 'the base url, no dialect path appended');
    assert.ok(Number.isFinite(probe.latencyMs));
});

test('the probe stays blind to a dialect the config declares', async (t) => {
    // A dialect-aware probe is barred rather than merely absent, so the
    // config that would make one visible is what this pins: a probe handed
    // `api: openai` still fetches the base url. Without the declaration in
    // the argument the pin above would stay green if the probe ever learned
    // to read one, which is the whole failure this forbids.
    const server = await startServer(t, () => ({ body: { ok: true } }));
    const probe = await lib.probeEndpoint({ url: server.url, api: 'openai', timeoutMs: 5000 });
    assert.strictEqual(probe.status, 'ok', JSON.stringify(probe));
    assert.deepStrictEqual(server.requests.map((r) => r.url), ['/'],
        'one request, at the base url, whatever the config declares');
});
