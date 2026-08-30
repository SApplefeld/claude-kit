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

module.exports = {
    UNSAFE_PATTERN: lib.UNSAFE_PATTERN,
    TEXT_MAX_CHARS,
    neutralize: lib.neutralize
};
