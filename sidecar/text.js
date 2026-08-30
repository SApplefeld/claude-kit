// The one place text from outside this daemon is made safe to put on a surface
// a person or another program reads.
//
// Three sources feed it, and none of them is trusted: the model endpoint's
// answers (off this VM, multi-tenant, and derived from text the judged session
// controls), the endpoint's error strings, and the spool itself, which holds
// whatever a command printed. All three reach stderr, a scrollback, a redirected
// log, a JSONL record and, through later sections, a rollup and a line delivered
// back into a session.
//
// It lives in its own module rather than in whichever consumer needed it first.
// A neutralizing guard is a property of the output channel, and every writer on
// that channel needs the same one: a guard sitting in the module that happened
// to need it first is one the next writer reimplements by not implementing it.
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
//
// The class is built from a string of escapes rather than written as a literal
// character class, so this file stays plain text that a line-printing sweep can
// read. A source file holding the raw bytes it screens for drops out of every
// grep the repository's hygiene passes run.

'use strict';

// Control characters (C0 and C1, DEL among them), the bidi controls, overrides
// and isolates, the zero-width set, the invisible operators, and the byte-order
// mark. Everything else is left exactly as it came, because this is a guard on
// the channel and not a transliteration of the content.
const UNSAFE_PATTERN = [
    '[',
    '\\u0000-\\u0008',
    '\\u000B-\\u000C',
    '\\u000E-\\u001F',
    '\\u007F-\\u009F',
    '\\u200B-\\u200F',
    '\\u202A-\\u202E',
    '\\u2060-\\u2064',
    '\\u2066-\\u206F',
    '\\uFEFF',
    ']'
].join('');

const UNSAFE_RE = new RegExp(UNSAFE_PATTERN, 'g');

// Text safe to print or to record: whitespace collapsed, invisible and
// terminal-controlling characters removed, ends trimmed. A non-string is an
// empty string rather than a coerced one, since the callers pass values that
// arrived as JSON and may be anything at all.
function neutralize(text) {
    if (typeof text !== 'string') return '';
    return text.replace(UNSAFE_RE, '').replace(/\s+/g, ' ').trim();
}

module.exports = {
    UNSAFE_PATTERN,
    neutralize
};
