// Tests for plugins/claude-kit/hooks/kit-tool-payload-lib.js, the shared
// error-flag predicate over a PostToolUse payload.
//
// The predicate is pure and in-process, so there is no child here. What these
// cases are for is the reason the module exists: two hooks read this one
// answer for different purposes, and a disagreement between a hook's own copy
// and this one would be invisible on both surfaces. Every branch is asserted
// on this file's own export rather than through either hook, so a hook that
// stops delegating cannot keep these green.
//
// The negative cases carry as much weight as the positive ones. A predicate
// that answers true too readily sends the recognition nudge's matcher over the
// output of calls that succeeded, and marks a clean spool line as a failure
// for the judge.

'use strict';

const { test } = require('node:test');
const assert = require('node:assert');

const lib = require('../plugins/claude-kit/hooks/kit-tool-payload-lib.js');
const nudge = require('../plugins/claude-kit/hooks/memory-recognition-nudge.js');

test('the payload-level error flag is a failure whatever the response is', () => {
    assert.strictEqual(lib.callFailed({ is_error: true, tool_response: 'boom' }), true);
    assert.strictEqual(lib.callFailed({ is_error: true }), true);
    assert.strictEqual(lib.callFailed({ is_error: false, tool_response: { stdout: 'ok' } }), false);
    assert.strictEqual(lib.callFailed({ is_error: 'true', tool_response: { stdout: 'ok' } }), false,
        'the flag is read as a boolean, not for truthiness');
});

test('a response that is not a plain object answers false', () => {
    for (const response of ['boom', ['boom'], null, undefined, 7]) {
        assert.strictEqual(lib.callFailed({ tool_response: response }), false,
            'a ' + JSON.stringify(response) + ' response carries no error indicator this reads');
    }
});

test('each error flag key on the response is read, booleans as booleans', () => {
    assert.strictEqual(lib.callFailed({ tool_response: { is_error: true } }), true);
    assert.strictEqual(lib.callFailed({ tool_response: { isError: true } }), true);
    assert.strictEqual(lib.callFailed({ tool_response: { is_error: 'yes' } }), false);
    assert.strictEqual(lib.callFailed({ tool_response: { isError: 1 } }), false);
    assert.deepStrictEqual(lib.ERROR_FLAG_KEYS, ['is_error', 'isError', 'error'],
        'the spellings are the contract; a reader of a spool line depends on the breadth');
});

test('an error key present at all is a failure, and an absent or null one is not', () => {
    assert.strictEqual(lib.callFailed({ tool_response: { error: 'boom' } }), true);
    assert.strictEqual(lib.callFailed({ tool_response: { error: { message: 'boom' } } }), true);
    assert.strictEqual(lib.callFailed({ tool_response: { error: '' } }), true,
        'an empty error string is still an error key present');
    assert.strictEqual(lib.callFailed({ tool_response: { error: false } }), true,
        'presence decides, not the value');
    assert.strictEqual(lib.callFailed({ tool_response: { error: null } }), false);
    assert.strictEqual(lib.callFailed({ tool_response: { stdout: 'ok' } }), false);
});

test('success false and interrupted true are failures', () => {
    assert.strictEqual(lib.callFailed({ tool_response: { success: false } }), true);
    assert.strictEqual(lib.callFailed({ tool_response: { success: true } }), false);
    assert.strictEqual(lib.callFailed({ tool_response: { success: 0 } }), false,
        'success is read as exactly false');
    assert.strictEqual(lib.callFailed({ tool_response: { interrupted: true } }), true);
    assert.strictEqual(lib.callFailed({ tool_response: { interrupted: false } }), false);
});

test('a non-zero numeric exit code under any spelling is a failure', () => {
    for (const key of lib.EXIT_CODE_KEYS) {
        assert.strictEqual(lib.callFailed({ tool_response: { [key]: 1 } }), true, key + ' 1 is a failure');
        assert.strictEqual(lib.callFailed({ tool_response: { [key]: -1 } }), true, key + ' -1 is a failure');
        assert.strictEqual(lib.callFailed({ tool_response: { [key]: 0 } }), false, key + ' 0 is not');
    }
    assert.deepStrictEqual(lib.EXIT_CODE_KEYS,
        ['exit_code', 'exitCode', 'code', 'returnCode', 'status'],
        'the spellings are the contract');
    assert.strictEqual(lib.callFailed({ tool_response: { exit_code: '1' } }), false,
        'a string code is not read: a status of "ok" would answer true on truthiness');
    assert.strictEqual(lib.callFailed({ tool_response: { exit_code: NaN } }), false,
        'a non-finite code is not a code');
});

test('a successful call writing progress to stderr is not a failure', () => {
    // The case the whole predicate exists for: git and npm write progress to
    // stderr on success, and reading the channel's name rather than an error
    // indicator is what would turn every one of those into a failed call.
    assert.strictEqual(lib.callFailed({
        tool_response: { stdout: 'done', stderr: 'Cloning into...', exit_code: 0 }
    }), false);
});

test('the recognition nudge answers with this module rather than a copy of it', () => {
    // Not a pin of the predicate (those are above, on the module itself): a pin
    // that the delegation is live, so a hook that grew its own second
    // normalization fails here instead of drifting quietly.
    const cases = [
        { tool_response: { exit_code: 1 } },
        { tool_response: { error: false } },
        { tool_response: { stdout: 'ok', stderr: 'progress' } },
        { is_error: true, tool_response: 'boom' }
    ];
    for (const payload of cases) {
        assert.strictEqual(nudge.callFailed(payload), lib.callFailed(payload),
            'the nudge and the library must answer alike for ' + JSON.stringify(payload));
    }
});
