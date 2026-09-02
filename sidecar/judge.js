// One judgment call to the model endpoint, and the classification of what came
// back.
//
// WHERE THE DATA GOES. sidecar/endpoint.js is the module that puts this content
// on the wire and its header states the posture in full: every judgment POSTs
// the observed session's stated intent, the full text of the shell command it
// ran, and that command's output off this VM to the Hyper-V host across the
// virtual switch, over plain HTTP with no authentication in the fleet's default
// configuration, to a model service shared with other tenants of that host.
// Nothing redacts.
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
// The first four are the transport's and come from endpoint.js. The fifth is
// this module's own, because whether an answer is a verdict is a question about
// the schema this module asked for. Collapsing unusable into refused would
// point a reader at the server when the repair is the model or the prompt.
//
// The response is SCHEMA-CONSTRAINED. The request carries the response schema
// as its `format`, which is what makes the verdict word an enum member rather
// than a sentence to parse. Prose output breaks its contract on non-achieved
// verdicts; a constrained decode eliminates that failure class. What it does
// not eliminate is composition past the cap, so the reason is cut to the budget
// here as well and the record says it was cut.

'use strict';

const prompt = require('./prompts/judgment-v4.js');
const endpoint = require('./endpoint.js');
const { neutralize } = require('./text.js');

// The generation ceiling. A JSON object holding an enum word and a reason
// inside the character budget fits well under this; it is a bound on a model
// that will not stop, not a target.
const NUM_PREDICT = 220;

// The most of the model's `response` string that is parsed as a verdict. The
// object the schema describes is under 400 characters; a string past this is
// something else and is refused without being parsed.
const MAX_ANSWER_CHARS = 8192;

// The gap reason recorded for each non-ok outcome of a judgment. The three
// transport reasons come from endpoint.js so every instrument spells them the
// same way; the fourth names what the answer failed to be, which is this
// instrument's own sentence.
const GAP_REASONS = {
    ...endpoint.GAP_REASONS,
    unusable: 'endpoint returned an unusable verdict'
};

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
    // the line the valve delivers back into a session. It is model output
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
        options: { num_predict: NUM_PREDICT, temperature: endpoint.TEMPERATURE }
    };
}

// Judge one entry. Exactly one attempt: the retry policy is the daemon's,
// because whether a failure earns a retry depends on the run's history and not
// on this call. Never throws.
async function judgeOnce(entry, config, deps) {
    const sent = await endpoint.postGenerate(buildRequest(entry, config), config, deps);
    if (sent.status !== 'ok') return sent;
    return { ...parseAnswer(sent.body), latencyMs: sent.latencyMs };
}

module.exports = {
    NUM_PREDICT,
    MAX_ANSWER_CHARS,
    GAP_REASONS,
    // Re-exported from endpoint.js, which owns them: the transport's bounds and
    // its throw classification are one implementation shared by both callers,
    // and a consumer that reached past this file for them would be reading a
    // second spelling of the same thing.
    TEMPERATURE: endpoint.TEMPERATURE,
    MAX_BODY_BYTES: endpoint.MAX_BODY_BYTES,
    MAX_DETAIL_CHARS: endpoint.MAX_DETAIL_CHARS,
    CONNECTION_CODES: endpoint.CONNECTION_CODES,
    SLOW_CODES: endpoint.SLOW_CODES,
    classifyThrow: endpoint.classifyThrow,
    parseAnswer,
    buildRequest,
    judgeOnce
};
