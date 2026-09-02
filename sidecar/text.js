// The one place text from outside this daemon is made safe to put on a surface
// a person or another program reads.
//
// Three sources feed it, and none of them is trusted: the model endpoint's
// answers (off this VM, multi-tenant, and derived from text the judged session
// controls), the endpoint's error strings, and the spool itself, which holds
// whatever a command printed. All three reach stderr, a scrollback, a redirected
// log, a JSONL record, a rollup and a line delivered back into a session.
//
// The screen itself lives in plugins/claude-kit/scripts/kit-endpoint-lib.js and
// is re-exported here, because the endpoint client applies it to the endpoint's
// own error strings and that client ships in the plugin tree while this
// directory does not. A neutralizing guard is a property of the output channel,
// and every writer on that channel needs the same one: a guard sitting in the
// module that happened to need it first is one the next writer reimplements by
// not implementing it.
//
// What it removes:
//
//   - C0 and C1 control characters, which carry ANSI escape sequences. An escape
//     run repaints a terminal, rewrites a line already printed, or hides text
//     from a reader who is looking straight at it.
//   - The Unicode bidirectional overrides and isolates, which reorder what a
//     reader sees without changing what a program compares.
//   - Zero-width and invisible formatting characters, which hide content inside
//     a string that looks shorter than it is.
//
// Tab, newline and carriage return are NOT in the removed class even though they
// are control characters. They separate words, so removing them would run two
// words together; they are left for the whitespace collapse that follows, which
// turns each of them into a single space. The collapse runs second for the same
// reason in reverse: an escape run removed from between two words would
// otherwise leave the double space it sat in.

'use strict';

const lib = require('../plugins/claude-kit/scripts/kit-endpoint-lib.js');

// The longest a neutralized field is let ride onto a rendered surface: a
// terminal, a status round, the Discord relay. Every producer that reaches
// this module first caps its own output privately (judge.js's
// REASON_MAX_CHARS, the endpoint client's MAX_DETAIL_CHARS, inbox.js's
// ITEM_TEXT_CAP), but a READER of a log line trusts no producer's cap, because
// CONTRACT.md says a line can be hand-written by anything running as this user:
// nothing stops a hand-written `note` or `detail` field from being a megabyte
// long. A cap is a property of the output channel and belongs here beside
// neutralize, not reimplemented by whichever reader needed it first.
const TEXT_MAX_CHARS = 2000;

// A string with a trailing unpaired high surrogate removed.
//
// This belongs to the CUT rather than to whichever producer cuts first. A
// JavaScript slice counts UTF-16 code units, so a cut landing between the two
// halves of a surrogate pair leaves an orphan half, and every consumer
// downstream (JSON.stringify, a terminal, another process's parser) then
// carries a character that is not a character.
//
// The trim is a property of the RENDERED CHANNEL, so every cut in this
// directory that puts text where a person or another program reads it carries
// it, and they carry this one spelling rather than a copy: sidecar/battery.js's
// fixture spool writer, its per-field report render (truncateForReport) and the
// gap-note lines it re-prints; sidecar/harvest.js's transcript reader;
// sidecar/rollup.js's gap note, gap detail and recognition-gap note; and
// sidecar/inbox.js's item text. The capture hook holds the other
// implementation, across the process boundary it cannot require across
// (plugins/claude-kit/hooks/kit-sidecar-capture.js, pinned equal by a test).
//
// The cuts that do NOT carry it are the ones whose output is a prompt or a
// stored field rather than a rendered one: sidecar/judge.js's and
// sidecar/recognize.js's per-field prompt caps, and sidecar/spool.js's line
// caps. Text cut there reaches a reader only through one of the rendered sites
// above, which cuts and trims it again, so an orphan half made by a prompt cap
// cannot reach a surface without passing this function on the way.
//
// This list is what shares the trim, not an inventory of every slice in the
// repository. A new rendered surface joins it; a producer whose output is
// re-cut at a rendered surface does not need to.
function trimLoneSurrogate(text) {
    if (typeof text !== 'string' || text === '') return '';
    const last = text.charCodeAt(text.length - 1);
    if (last >= 0xd800 && last <= 0xdbff) return text.slice(0, text.length - 1);
    return text;
}

// A string with a LEADING unpaired low surrogate removed, the same guard at the
// other end of a slice. A head-and-tail cut takes its tail out of the middle of
// a string, so that slice can begin with the second half of a pair whose first
// half stayed behind in the discarded middle. trimLoneSurrogate cannot see it:
// only a high half can be orphaned at the end of a prefix, and only a low half
// at the start of a suffix.
function trimLeadLoneSurrogate(text) {
    if (typeof text !== 'string' || text === '') return '';
    const first = text.charCodeAt(0);
    if (first >= 0xdc00 && first <= 0xdfff) return text.slice(1);
    return text;
}

// The in-band marker naming a capture cut at the point it fell, carrying the
// number of characters that went there.
//
// Two processes have to agree on this literal. The capture hook writes it into
// a spool field and the judgment prompt tells the judge how to read one, and
// the hook cannot require across the packaging boundary into this directory, so
// it carries its own copy and a test pins the two equal. Inside this process
// there is one definition, this one: sidecar/prompts/judgment-v4.js re-exports
// it, and the fixture writer and the transcript harvester both cut through the
// function below.
function captureCutMarker(count) {
    return `[...${count} characters cut at capture...]`;
}

// The share of a cut field's kept text that comes from its head. A cut field is
// read for two things: what the call was doing, which is stated at the top, and
// how it came out, which is at the bottom. The head takes the majority because
// an intent and a command are front-loaded; the tail is what a head-only cut
// threw away, and for tool output the exit summary, the error text and the FAIL
// lines all live there.
const HEAD_SHARE = 0.6;

// A field cut to `cap` characters, keeping its head and its tail with the
// marker between them, plus whether anything was lost.
//
// `given` is how many characters the field held before ANY cut on its way here,
// which is not always `text.length`: the capture hook bounds each part of a
// multi-part tool response before joining them, so the joined text can already
// be short of what the call printed. The count in the marker is `given` minus
// what survives, so it names the whole of what is missing from that field
// rather than only what this cut took. Every cut in this pipeline removes a
// MIDDLE, so everything missing really does sit between the kept head and the
// kept tail, which is what makes the marker's position a claim and not a guess.
//
// The marker's room is reserved against `given`, whose digit count can never be
// smaller than the count's, and the marker is then rendered from the true
// count. A count one digit narrower leaves the field a character or two under
// the cap, which is the direction to be wrong in: the cap is a promise made to
// every reader of the line, and the count is a fact about this field, so
// neither is traded for the other.
//
// A cap too small to hold the marker has no room to say anything, so it takes a
// plain head slice and the cut goes unmarked in the field. Nothing untrue is
// written there; what carries the loss is the entry-level `truncated` flag.
function cutToCap(text, given, cap) {
    if (typeof text !== 'string' || text === '') {
        return { text: '', lost: Number.isFinite(given) && given > 0 };
    }
    const total = (Number.isFinite(given) && given > text.length) ? given : text.length;
    const room = cap - captureCutMarker(total).length - 2;
    if (total <= cap) {
        const whole = trimLoneSurrogate(text);
        return { text: whole, lost: whole.length < total };
    }
    if (room < 2) {
        const head = trimLoneSurrogate(text.slice(0, Math.max(0, cap)));
        return { text: head, lost: head.length < total };
    }
    // The head and the tail are held to DISJOINT ranges of the text, and the
    // tail's start is clamped at zero. Neither is defensive dressing: `given`
    // is a free parameter, so a caller naming a loss larger than the text it
    // hands over (a field bounded to almost nothing before it got here) makes
    // room exceed the text's own length, and an unclamped slice takes a
    // negative start, which JavaScript counts from the END. That returns the
    // whole string as the tail beside the whole string as the head, so the
    // field carries its content twice around a marker whose count then
    // understates the loss by everything it duplicated.
    const headRoom = Math.ceil(room * HEAD_SHARE);
    const head = trimLoneSurrogate(text.slice(0, Math.min(headRoom, text.length)));
    const tailRoom = Math.min(room - headRoom, Math.max(0, text.length - head.length));
    const tail = tailRoom === 0
        ? ''
        : trimLoneSurrogate(trimLeadLoneSurrogate(text.slice(text.length - tailRoom)));
    return {
        text: `${head}\n${captureCutMarker(total - head.length - tail.length)}\n${tail}`,
        lost: true
    };
}

module.exports = {
    UNSAFE_PATTERN: lib.UNSAFE_PATTERN,
    TEXT_MAX_CHARS,
    HEAD_SHARE,
    neutralize: lib.neutralize,
    trimLoneSurrogate,
    trimLeadLoneSurrogate,
    captureCutMarker,
    cutToCap
};
