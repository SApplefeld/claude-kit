// Shared predicate: does a working directory name a network share (a UNC
// path, \\host\share, or a //server/share form)? Both are the shapes a
// synchronous open can hang on for the SMB timeout when the host is
// unreachable, rather than failing fast the way a missing local path does.
//
// This is its own module, holding nothing else, because scripts/memq.js is
// 11,880 lines and a hot hook path cannot afford to pay to load it just to
// answer this one question: the warm require cost of the whole file measures
// 8.7-11.4ms, and hooks/compact-deferral-nudge.js's guard 4 runs on every
// covered PostToolUse return, so a lazy require of memq.js there for this
// predicate alone would pay that cost on that same hot path. This module is
// cheap enough to require there instead.
//
// scripts/memq.js requires this module and re-exports the predicate under
// its own name, so a caller that already holds memq for other reasons
// (hooks/memory-session.js, hooks/memory-frontmatter-guard.js) keeps calling
// memq.namesNetworkShare unchanged. A caller that does not otherwise need
// memq (hooks/compact-deferral-nudge.js, hooks/chapter-boundary-nudge.js)
// requires this module directly instead.
//
// Exactly one expression decides the question, here (Standing Amendment 2):
// every caller above reaches this file's answer rather than re-deriving it.
// hooks/kit-goal-lib.js carries its own independent copy of the same
// leading-separator test for a different subject, a stored transcript path
// rather than a working directory, so it is not folded into this module.
//
// A non-string answers true (refuse) rather than false: false is the
// checked-and-clean value this predicate exists to gate a walk behind, and a
// caller that passes something other than the path it means to walk is a
// call this predicate cannot make sense of, not evidence the path is safe.
// Answering false there would be a coercion handing back the
// checked-and-clean value for an input nothing checked, which is the defect
// class this one type guard exists to keep out of every caller.
'use strict';

function namesNetworkShare(cwd) {
    if (typeof cwd !== 'string') return true;
    return /^[\\/]{2}/.test(cwd);
}

module.exports = { namesNetworkShare };
