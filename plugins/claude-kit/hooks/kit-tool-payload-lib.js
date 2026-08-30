// Shared predicate: did a completed tool call fail? The answer is read off the
// PostToolUse payload and off the response it carries, across every response
// shape the harness has been seen to produce.
//
// This is its own module, holding nothing else, because two hooks need the one
// answer and hooks/memory-recognition-nudge.js is 1,600 lines. A hot hook path
// that required that file for this predicate alone would pay the whole module
// load on every covered tool return, the cost hooks/kit-network-lib.js exists
// to keep off the same paths (8.7 to 11.4 ms measured there for a warm require
// of the file it replaced). The second cost is worse than the first: a sibling
// hook that fails to load takes its borrower down with it, so a damaged plugin
// cache anywhere in that 1,600 lines would silently disable a caller that has
// nothing to do with recognition nudges.
//
// hooks/memory-recognition-nudge.js requires this module and re-exports the
// predicate under its own name, so its failureOutput and its suite keep
// calling one function rather than two copies drifting apart.
//
// Exactly one expression decides the question, here: a second normalization of
// the error indicator is the drift this module exists to prevent, and the two
// callers read the answer for different purposes (one matches err: triggers
// against a failed call's output, one records the flag in the judgment spool)
// where a disagreement between them would be invisible on both surfaces.
//
// The reading is deliberately broad. An `error` key present at all is a
// failure whatever its value; the boolean flags are read as booleans; a
// `success` of exactly false is one; an interrupted call is one; and an exit
// code that is a non-zero number is one, which is what a failing shell call
// carries when nothing else about the response says so.
'use strict';

// The keys that mark a call as having failed, read off the response and off
// the payload. An `err:` pattern is matched against a FAILED call's output,
// so what makes a channel failure output is one of these rather than the
// channel's name: a successful `git` or `npm` call writes progress to stderr,
// and a trigger firing on that is the noise the recognition nudge cannot
// afford. A non-zero exit code counts, which is what a failing shell call
// carries when nothing else about the response says so.
const ERROR_FLAG_KEYS = ['is_error', 'isError', 'error'];
const EXIT_CODE_KEYS = ['exit_code', 'exitCode', 'code', 'returnCode', 'status'];

function callFailed(payload) {
    if (payload.is_error === true) return true;
    const response = payload.tool_response;
    if (response === null || typeof response !== 'object' || Array.isArray(response)) return false;
    for (const key of ERROR_FLAG_KEYS) {
        if (key === 'error' ? response[key] !== undefined && response[key] !== null : response[key] === true) {
            return true;
        }
    }
    if (response.success === false) return true;
    if (response.interrupted === true) return true;
    for (const key of EXIT_CODE_KEYS) {
        const value = response[key];
        if (typeof value === 'number' && Number.isFinite(value) && value !== 0) return true;
    }
    return false;
}

module.exports = { callFailed, ERROR_FLAG_KEYS, EXIT_CODE_KEYS };
