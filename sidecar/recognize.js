// One recognition call to the model endpoint, and the classification of what
// came back.
//
// The question is the one a human colleague answers without being asked: does
// something this project already learned bear on what the session is doing
// right now. The index of the project's memory store goes over with the
// situation, and what comes back is record NAMES, never bodies, capped at three.
//
// WHERE THE DATA GOES. sidecar/endpoint.js is the module that puts this content
// on the wire and its header states the posture in full. Recognition sends one
// thing the judgment call does not: the project's memory index, one line per
// record with its title and description. That index crosses the same boundary
// as everything else, off this VM to the Hyper-V host across the virtual
// switch, over plain HTTP with no authentication in the fleet's default
// configuration, to a model service shared with other tenants of that host. The
// record BODIES never travel; the index line is title and description.
//
// FIVE OUTCOMES, on the same terms as sidecar/judge.js: the transport's four
// from endpoint.js, plus `unusable` for an answer that is not a list of record
// names.
//
// ZERO INVENTION IS ENFORCED HERE, not asked for. The prompt tells the model
// not to invent relevance and the measured run showed it does not, but a name
// that is not in the index that produced the answer is dropped, counted and
// reported rather than queued: a pointer naming a record the index never listed
// is worse than no pointer, and the check costs a set lookup.
//
// The index is the authority, not the store directory. A name is checked
// against the lines that went into this call's prompt, and no record file is
// opened: recognition reads one file in the operator's store and stats nothing
// else in it. What that leaves open is an index line naming a record whose file
// has since been deleted, which reaches a session as a pointer `memq get`
// answers with "no such record". That is a store inconsistency the kit's own
// doctor is the instrument for, and it is the same answer the session would get
// by reading the index by hand.

'use strict';

const prompt = require('./prompts/recognition-v1.js');
const endpoint = require('./endpoint.js');
const { neutralize } = require('./text.js');

// The generation ceiling. A JSON object holding at most three short names and a
// reason inside the character budget fits well under this; it is a bound on a
// model that will not stop, not a target. This is the measured run's own value.
const NUM_PREDICT = 250;

// The most of the model's `response` string that is parsed. The object the
// schema describes is under 700 characters; a string past this is something
// else and is refused without being parsed.
const MAX_ANSWER_CHARS = 8192;

// The most of one returned name that is compared against the index. A record
// name is at most 121 characters by the delivery side's own pattern, so this
// bounds a "name" that is a paragraph before it reaches a set lookup or a
// report line.
const MAX_NAME_CHARS = 200;

// The gap reason recorded for each non-ok outcome of a recognition call. The
// three transport reasons come from endpoint.js so every instrument spells them
// the same way; the fourth names what the answer failed to be, which is this
// instrument's own sentence.
const GAP_REASONS = {
    ...endpoint.GAP_REASONS,
    unusable: 'endpoint returned an unusable recognition answer'
};

// The endpoint's answer as a set of record names, or a described refusal.
//
// `names` is the name set of the index this call was made against, and it is
// required: a caller with no index made no call, and validating against an
// absent set would accept anything. Every returned name is checked against it,
// which is what makes a hallucinated record a counted drop rather than a
// pointer a session cannot follow.
function parseAnswer(body, names) {
    const known = (names instanceof Set) ? names : new Set();
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
    // An absent list is not an empty one. Empty is the normal answer and says
    // the model read the index and found nothing; a missing key says the answer
    // did not have the shape the schema asked for, and reading it as "no
    // records bear on this" would turn a broken decode into a clean result.
    if (!Array.isArray(answer.applicable)) {
        return { status: 'unusable', detail: 'applicable is not a list' };
    }

    const records = [];
    const invented = [];
    for (const item of answer.applicable) {
        if (typeof item !== 'string') {
            invented.push('(not a string)');
            continue;
        }
        // The `.md` is stripped because the prompt asks for the basename
        // without it and a model that includes it is naming the right record.
        const name = item.trim().slice(0, MAX_NAME_CHARS).replace(/\.md$/i, '');
        if (name === '') continue;
        if (!known.has(name)) {
            // Reported and counted, never queued. The name reaches a stderr
            // line, so it is neutralized: it is model output and the only thing
            // established about it here is that the index does not hold it.
            invented.push(neutralize(name).slice(0, MAX_NAME_CHARS));
            continue;
        }
        if (!records.includes(name)) records.push(name);
        if (records.length >= prompt.MAX_RECORDS) break;
    }

    // The reason is neutralized HERE, at the point of parse, so every consumer
    // inherits it: the recognition log, a rollup over it, and the pointer the
    // valve delivers back into a session. It is model output derived from text
    // the observed session controls and from the store's own descriptions.
    const rawReason = neutralize(answer.reason);
    const reason = rawReason.slice(0, prompt.REASON_MAX_CHARS);
    return {
        status: 'ok',
        records,
        invented,
        reason,
        reasonTruncated: reason.length < rawReason.length
    };
}

// The request body. Built here rather than inline so a test can assert on the
// exact shape that goes over the wire, which is the only place the schema, the
// prompt id, the index and the model come together.
function buildRequest(entry, indexText, config, indexCut) {
    return {
        model: config.model,
        system: prompt.SYSTEM,
        prompt: prompt.formatSituation(entry, indexText, indexCut),
        stream: false,
        think: false,
        format: prompt.responseSchema(),
        options: { num_predict: NUM_PREDICT, temperature: endpoint.TEMPERATURE }
    };
}

// Recognize against one entry and one index. Exactly one attempt: the retry
// policy is the daemon's. Never throws.
async function recognizeOnce(entry, index, config, deps) {
    const sent = await endpoint.postGenerate(buildRequest(entry, index.text, config, index.truncated === true), config, deps);
    if (sent.status !== 'ok') return sent;
    return { ...parseAnswer(sent.body, index.names), latencyMs: sent.latencyMs };
}

module.exports = {
    NUM_PREDICT,
    MAX_ANSWER_CHARS,
    MAX_NAME_CHARS,
    GAP_REASONS,
    parseAnswer,
    buildRequest,
    recognizeOnce
};
