// Tests for plugins/claude-kit/hooks/kit-sidecar-capture.js (the judgment
// sidecar's PostToolUse capture hook).
//
// Node's built-in test runner, no framework (Node v24). The hook is spawned as
// a real child process, fed a PostToolUse payload on stdin, and asserted on by
// its EXIT CODE (always 0; there is no deny path in that file) and its EXACT
// stdout, which is the empty string on every path in the capture duty. Exact
// rather than "no such substring": a weaker check passes on a crashed hook,
// which is the one outcome this hook exists never to produce.
//
// Each case builds its own temp home directory and points the child's HOME and
// USERPROFILE at it, which is what os.homedir() reads, so no case touches the
// real ~/.claude/kit-sidecar. The spool root's presence is the hook's activation
// switch, so a case that wants dormancy simply does not create it, and a case
// that wants capture creates it and nothing else. All temp state is removed in
// finally blocks.
//
// A case that expects NOTHING to be captured asserts on the spool root's own
// directory listing, never on a parse of the day file. A reader that answers
// "no lines" for an absent file answers the same for a hook that wrote to a
// name or a directory nobody expected, which is the one failure a negative
// case is there to catch.
//
// The day file's name is the UTC date, read once for the whole run rather than
// at each assertion: a run that straddles UTC midnight would otherwise read a
// name the hook never wrote. Cases that read spool content read every file in
// the root, so a straddling run still sees its lines.
//
// The latency case measures COLD SPAWNS, which is the path production takes: a
// PostToolUse hook is a fresh Node process every time, and an in-process
// measurement after a warm-up cannot see a module load or a first write at all.

'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const { spawnSync } = require('node:child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

const HOOK = path.join(__dirname, '..', 'plugins', 'claude-kit', 'hooks', 'kit-sidecar-capture.js');
const HOOKS_JSON = path.join(__dirname, '..', 'plugins', 'claude-kit', 'hooks', 'hooks.json');
const hook = require('../plugins/claude-kit/hooks/kit-sidecar-capture.js');

const SESSION = 'ses-11112222-aaaa-bbbb-cccc-333344445555';

// The UTC day this run belongs to, captured once. See the header.
const RUN_DAY = new Date().toISOString().slice(0, 10);

function makeDir(prefix) {
    return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

function rmDir(dir) {
    try { fs.rmSync(dir, { recursive: true, force: true }); } catch { /* best effort */ }
}

// A temp home, with the spool root created unless the case is testing dormancy.
function makeHome(opts) {
    const o = opts || {};
    const home = makeDir('kit-sidecar-home-');
    if (!o.dormant) fs.mkdirSync(spoolRoot(home), { recursive: true });
    return home;
}

function spoolRoot(home) {
    return path.join(home, '.claude', 'kit-sidecar', 'spool');
}

function dayFile(home) {
    return path.join(spoolRoot(home), RUN_DAY + '.jsonl');
}

// Everything in the spool root, whatever it is named. Not caught: a root that
// cannot be listed is a failure of the case, not an empty spool.
function spoolFiles(home) {
    return fs.readdirSync(spoolRoot(home)).sort();
}

// Every whole line in every spool file, parsed. A read or parse error throws
// rather than reading as no lines.
function readSpool(home) {
    const out = [];
    for (const name of spoolFiles(home)) {
        const raw = fs.readFileSync(path.join(spoolRoot(home), name), 'utf8');
        assert.ok(raw.endsWith('\n'), 'every spool line must be newline terminated');
        for (const line of raw.split('\n')) {
            if (line !== '') out.push(JSON.parse(line));
        }
    }
    return out;
}

// The negative assertion: the hook wrote no file at all, anywhere in the root.
function assertNothingSpooled(home, label) {
    assert.deepStrictEqual(spoolFiles(home), [], label + ': the spool root must hold no file');
}

function runHook(home, payload, extraEnv) {
    const env = { ...process.env, HOME: home, USERPROFILE: home, ...(extraEnv || {}) };
    return spawnSync(process.execPath, [HOOK], {
        input: typeof payload === 'string' ? payload : JSON.stringify(payload),
        env,
        cwd: process.cwd(),
        encoding: 'utf8'
    });
}

// Silence is the whole output contract of the capture duty, on every path.
function assertSilent(res, label) {
    assert.strictEqual(res.status, 0, label + ': exit code must be 0');
    assert.strictEqual(res.stdout, '', label + ': stdout must be exactly empty');
    assert.strictEqual(res.stderr, '', label + ': stderr must be exactly empty');
}

// A directory link at linkPath pointing at target. On Windows a junction is the
// unprivileged form, which is what makes this the cheap attack rather than a
// theoretical one: a directory symlink there needs a privilege a normal account
// does not hold, and a junction needs none.
function linkDir(target, linkPath) {
    fs.symlinkSync(target, linkPath, process.platform === 'win32' ? 'junction' : 'dir');
}

// Make one module's require fail inside the spawned hook, standing in for the
// damaged or incomplete plugin cache the guarded require exists for. Node parses
// NODE_OPTIONS with backslash as an escape character, so the preload path is
// passed forward-slashed. Borrowed from test/compact-deferral-nudge.test.js,
// which uses the same fixture for the same class of failure.
function requireRefusingPreload(dir, moduleFile) {
    const shim = path.join(dir, 'refuse-require-' + moduleFile);
    fs.writeFileSync(shim, [
        "'use strict';",
        "const Module = require('module');",
        'const realLoad = Module._load;',
        'Module._load = function (request) {',
        "    if (String(request).endsWith('" + moduleFile + "')) {",
        "        throw new Error('the fixture refuses this require');",
        '    }',
        '    return realLoad.apply(Module, arguments);',
        '};'
    ].join('\n') + '\n', 'utf8');
    return '--require "' + shim.replace(/\\/g, '/') + '"';
}

// The baseline payload: a realistic completed Bash call, as the harness shapes
// one. Each case overrides exactly what it exercises.
function bashPayload(overrides) {
    return {
        session_id: SESSION,
        cwd: 'D:\\claude-kit',
        tool_name: 'Bash',
        hook_event_name: 'PostToolUse',
        tool_input: {
            command: 'git status --porcelain',
            description: 'Show working tree status'
        },
        tool_response: { stdout: ' M README.md\n', stderr: '', exit_code: 0 },
        ...overrides
    };
}

// A record shaped like buildRecord's output, for the cases that assert on the
// serializer directly. The byte-cap arithmetic is exact this way, where an
// end-to-end case would have to guess at the skeleton's own size.
function record(fields) {
    return {
        v: 1,
        callId: 'a'.repeat(16),
        ts: '2026-08-30T00:00:00.000Z',
        sessionId: 's',
        cwd: 'c',
        tool: 'Bash',
        intent: 'i',
        command: 'm',
        result: 'r',
        truncated: false,
        isError: false,
        ...fields
    };
}

// Does the string carry a surrogate code unit that is not part of a pair? A
// lone one is not a character: it serializes as a six-byte escape and decodes
// to a replacement character in whatever reads the spool.
function hasLoneSurrogate(text) {
    return /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?:^|[^\uD800-\uDBFF])[\uDC00-\uDFFF]/.test(text);
}

test('a realistic Bash call produces one schema-complete spool line', () => {
    const home = makeHome();
    try {
        const res = runHook(home, bashPayload());
        assertSilent(res, 'capture');

        const lines = readSpool(home);
        assert.strictEqual(lines.length, 1, 'exactly one line should be appended');
        const rec = lines[0];

        assert.deepStrictEqual(Object.keys(rec).sort(), [
            'callId', 'command', 'cwd', 'intent', 'isError', 'result',
            'sessionId', 'tool', 'truncated', 'ts', 'v'
        ], 'the line carries exactly the schema keys');

        assert.strictEqual(rec.v, 1);
        assert.match(rec.callId, /^[0-9a-f]{16}$/, 'callId is 16 lowercase hex chars');
        assert.match(rec.ts, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/, 'ts is ISO 8601 UTC');
        assert.ok(Math.abs(Date.parse(rec.ts) - Date.now()) < 60000, 'ts is the moment of capture');
        assert.strictEqual(rec.sessionId, SESSION);
        assert.strictEqual(rec.cwd, 'D:\\claude-kit');
        assert.strictEqual(rec.tool, 'Bash');
        assert.strictEqual(rec.intent, 'Show working tree status');
        assert.strictEqual(rec.command, 'git status --porcelain');
        assert.strictEqual(rec.result, ' M README.md\n');
        assert.strictEqual(rec.truncated, false);
        assert.strictEqual(rec.isError, false);
    } finally {
        rmDir(home);
    }
});

test('two identical calls are two records with distinct identities', () => {
    // The identical payload twice, which is the invariant the code names: two
    // identical commands in one session are two calls, and delivery dedups on
    // callId, so an id derived from the payload would silence the second one's
    // finding. A case sending two DIFFERENT commands would pass on a payload
    // hash and prove nothing.
    const home = makeHome();
    try {
        const payload = bashPayload();
        assertSilent(runHook(home, payload), 'first');
        assertSilent(runHook(home, payload), 'second');

        const lines = readSpool(home);
        assert.strictEqual(lines.length, 2, 'the spool is append-only JSONL');
        assert.notStrictEqual(lines[0].callId, lines[1].callId,
            'each call gets its own identity even when the payload is byte-identical');
        assert.strictEqual(lines[0].command, lines[1].command);
    } finally {
        rmDir(home);
    }
});

test('the day file is named by UTC date', () => {
    const home = makeHome();
    try {
        assertSilent(runHook(home, bashPayload()), 'capture');
        assert.deepStrictEqual(spoolFiles(home), [RUN_DAY + '.jsonl']);
    } finally {
        rmDir(home);
    }
});

test('the error flag is read across response shapes', () => {
    const home = makeHome();
    try {
        assertSilent(runHook(home, bashPayload({
            tool_response: { stdout: '', stderr: 'fatal: not a git repository', exit_code: 128 }
        })), 'failing call');
        assertSilent(runHook(home, bashPayload({ is_error: true })), 'payload flag');
        assertSilent(runHook(home, bashPayload({ tool_response: { error: 'boom' } })), 'error key');

        const lines = readSpool(home);
        assert.strictEqual(lines[0].isError, true, 'a non-zero exit code is an error');
        assert.strictEqual(lines[0].result, 'fatal: not a git repository',
            'a failing call still spools its output');
        assert.strictEqual(lines[1].isError, true, 'the payload-level flag is an error');
        assert.strictEqual(lines[2].isError, true, 'an error key is an error');
    } finally {
        rmDir(home);
    }
});

// --- The response shapes the contract promises a consumer. Every one of them
// is a branch of resultText, and every one is reachable from the harness.

test('resultText reads a bare string response', () => {
    assert.strictEqual(hook.resultText({ tool_response: 'plain output' }), 'plain output');
    assert.strictEqual(hook.resultText({ tool_response: '' }), '');
});

test('resultText reads a top-level array of content blocks', () => {
    assert.strictEqual(hook.resultText({
        tool_response: [
            { type: 'text', text: 'first' },
            'second',
            { type: 'image', data: 'ignored' },
            null,
            { type: 'text', text: '' }
        ]
    }), 'first\nsecond', 'text blocks and bare strings join; everything else is skipped');
});

test('resultText joins stdout before stderr', () => {
    // Both channels non-empty, which is the only shape that can see the order.
    // With one of them empty the join is the same string either way, so
    // OUTPUT_KEYS could be reversed and nothing would notice.
    assert.strictEqual(hook.resultText({
        tool_response: { stdout: 'out', stderr: 'err', exit_code: 1 }
    }), 'out\nerr');
});

test('resultText reads both error shapes and a nested content array', () => {
    assert.strictEqual(hook.resultText({ tool_response: { stdout: 'out', error: 'boom' } }),
        'out\nboom', 'a string error is text');
    assert.strictEqual(hook.resultText({ tool_response: { error: { message: 'nested boom' } } }),
        'nested boom', 'an object error answers with its message');
    assert.strictEqual(hook.resultText({ tool_response: { error: { code: 7 } } }), '',
        'an error object with no message contributes nothing');
    assert.strictEqual(hook.resultText({
        tool_response: { stdout: 'out', content: [{ type: 'text', text: 'block' }, 'raw'] }
    }), 'out\nblock\nraw', 'response.content is read after the channels');
    assert.strictEqual(hook.resultText({ tool_response: { stdout: '', stderr: '' } }), '',
        'empty channels contribute nothing');
    assert.strictEqual(hook.resultText({ tool_response: null }), '');
    assert.strictEqual(hook.resultText({}), '');
});

test('a huge response is bounded before it is joined', () => {
    // The peak, not the outcome: the caller cuts to the field cap either way.
    // An unbounded intermediate allocates the whole of a multi-megabyte stdout
    // and a joined copy of it on the observed session's turn, to keep 2000
    // characters.
    const huge = 'x'.repeat(4 * 1024 * 1024);
    const text = hook.resultText({ tool_response: { stdout: huge, stderr: huge } });
    assert.ok(text.length <= 2 * (hook.FIELD_CAP + 1) + 1,
        'the intermediate stays a small multiple of the cap, was ' + text.length);
    assert.ok(text.length > hook.FIELD_CAP,
        'it stays over the cap so the caller can still see that something was cut');

    const home = makeHome();
    try {
        assertSilent(runHook(home, bashPayload({
            tool_response: { stdout: huge, stderr: '', exit_code: 0 }
        })), 'huge stdout');
        const rec = readSpool(home)[0];
        assert.strictEqual(rec.result.length, hook.FIELD_CAP, 'the field cap still holds');
        assert.strictEqual(rec.truncated, true, 'a response cut in resultText still reads as truncated');
    } finally {
        rmDir(home);
    }
});

// --- Dormancy and the paths this hook refuses to write through.

test('dormant when the spool root is absent: nothing runs and nothing is created', () => {
    const home = makeHome({ dormant: true });
    try {
        const before = fs.readdirSync(home);
        const res = runHook(home, bashPayload());
        assertSilent(res, 'dormant');
        assert.deepStrictEqual(fs.readdirSync(home), before,
            'the hook must create nothing under a home with no spool root');
        assert.strictEqual(fs.existsSync(path.join(home, '.claude')), false,
            'the spool root is the daemon\'s to create, never the hook\'s');
    } finally {
        rmDir(home);
    }
});

test('dormant when the spool root is a file rather than a directory', () => {
    const home = makeHome({ dormant: true });
    try {
        fs.mkdirSync(path.join(home, '.claude', 'kit-sidecar'), { recursive: true });
        fs.writeFileSync(spoolRoot(home), 'not a spool root', 'utf8');
        const res = runHook(home, bashPayload());
        assertSilent(res, 'file at the root path');
        assert.strictEqual(fs.readFileSync(spoolRoot(home), 'utf8'), 'not a spool root',
            'the hook must not write through a non-directory root');
    } finally {
        rmDir(home);
    }
});

test('a link at the spool root is refused rather than written through', () => {
    // stat follows a link and would answer isDirectory() with the TARGET's
    // type, so every command and its output would land in whatever the link
    // points at: a synced folder, a repo working tree, a share. The target here
    // is a real directory, so the refusal cannot be a missing path.
    const home = makeHome({ dormant: true });
    const target = makeDir('kit-sidecar-target-');
    try {
        fs.mkdirSync(path.join(home, '.claude', 'kit-sidecar'), { recursive: true });
        linkDir(target, spoolRoot(home));
        assert.ok(fs.statSync(spoolRoot(home)).isDirectory(),
            'test setup: through stat the link reads as a directory, which is the hazard');

        assertSilent(runHook(home, bashPayload()), 'linked root');
        assert.deepStrictEqual(fs.readdirSync(target), [],
            'nothing may be written through a linked spool root');
    } finally {
        rmDir(home);
        rmDir(target);
    }
});

test('a link at the day file path is refused rather than written through', () => {
    // The same hazard one level down: a link planted inside a legitimate root
    // reaches the same place as one planted at the root.
    //
    // The screen is asserted directly as well as end to end, because the two
    // platforms admit different links. On POSIX the link points at a FILE, and
    // an unscreened append would write the spool line into it, so the decoy's
    // content is the end-to-end proof. On Windows the unprivileged form is a
    // junction, which points at a directory, and an unscreened append would
    // fail at the open with EISDIR for a reason that has nothing to do with
    // the link: there the direct assertion is what proves the refusal is the
    // screen's.
    const home = makeHome();
    const target = makeDir('kit-sidecar-target-');
    const decoy = path.join(target, 'decoy.txt');
    try {
        if (process.platform === 'win32') {
            linkDir(target, dayFile(home));
        } else {
            fs.writeFileSync(decoy, 'decoy\n', 'utf8');
            fs.symlinkSync(decoy, dayFile(home), 'file');
        }
        assert.strictEqual(hook.dayFileWritable(dayFile(home)), false,
            'a link at the day file path is not a file this hook appends to');

        assertSilent(runHook(home, bashPayload()), 'linked day file');
        if (process.platform === 'win32') {
            assert.deepStrictEqual(fs.readdirSync(target), [],
                'nothing may be written through a linked day file');
        } else {
            assert.strictEqual(fs.readFileSync(decoy, 'utf8'), 'decoy\n',
                'nothing may be written through a linked day file');
        }
    } finally {
        rmDir(home);
        rmDir(target);
    }
});

test('the day file stops taking appends past its size bound', () => {
    const home = makeHome();
    try {
        // The control: a pre-existing small day file takes the append, so the
        // refusal below is the bound and not the file's mere existence.
        fs.writeFileSync(dayFile(home), '', 'utf8');
        assertSilent(runHook(home, bashPayload()), 'under the bound');
        assert.strictEqual(readSpool(home).length, 1, 'a small day file still takes appends');

        fs.truncateSync(dayFile(home), hook.DAY_FILE_MAX_BYTES + 1);
        const before = fs.statSync(dayFile(home)).size;
        assertSilent(runHook(home, bashPayload()), 'past the bound');
        assert.strictEqual(fs.statSync(dayFile(home)).size, before,
            'a day file past the bound takes no more bytes: the daemon that should '
                + 'have consumed it is gone');
    } finally {
        rmDir(home);
    }
});

test('malformed payloads exit 0 and spool nothing', () => {
    const cases = [
        ['non-JSON stdin', 'this is not json {'],
        ['empty stdin', ''],
        ['a JSON array', '[1,2,3]'],
        ['a payload missing tool_input', JSON.stringify({
            session_id: SESSION, cwd: 'D:\\x', tool_name: 'Bash'
        })],
        ['a payload whose tool_input has no command', JSON.stringify({
            session_id: SESSION, cwd: 'D:\\x', tool_name: 'Bash',
            tool_input: { description: 'no command here' }
        })],
        ['a payload with no tool name', JSON.stringify({
            session_id: SESSION, cwd: 'D:\\x', tool_input: { command: 'ls' }
        })]
    ];
    for (const [label, input] of cases) {
        const home = makeHome();
        try {
            assertSilent(runHook(home, input), label);
            assertNothingSpooled(home, label);
        } finally {
            rmDir(home);
        }
    }
});

test('a shared library that will not load leaves the hook silent and captures nothing', () => {
    // The error flag's normalization is one shared module, and a damaged
    // installed cache is the state this guard exists for. Capture standing down
    // whole is deliberate: a line whose isError is wrong is worse than a line
    // that was never written. What may not happen is the hook throwing, since
    // an unguarded require at module scope escapes the entry point's catch and
    // would end this process non-zero with a stack on stderr, after every
    // single shell command the session runs.
    const home = makeHome();
    try {
        assertSilent(runHook(home, bashPayload(), {
            NODE_OPTIONS: requireRefusingPreload(home, 'kit-tool-payload-lib.js')
        }), 'damaged kit-tool-payload-lib.js');
        assertNothingSpooled(home, 'damaged kit-tool-payload-lib.js');
    } finally {
        rmDir(home);
    }
});

test('a failed write exits 0 and disturbs nothing', () => {
    const home = makeHome();
    try {
        // The day file's own path made a directory: the hook refuses it as a
        // non-file, and appendFileSync would raise EISDIR on every platform if
        // it ever got there.
        fs.mkdirSync(dayFile(home));
        const res = runHook(home, bashPayload());
        assertSilent(res, 'failed write');
        assert.deepStrictEqual(fs.readdirSync(dayFile(home)), [],
            'the blocked path is left as it was');
    } finally {
        rmDir(home);
    }
});

// --- The caps.

test('oversized command and result are cut and the flag is set', () => {
    const home = makeHome();
    try {
        const command = 'echo ' + 'c'.repeat(5000);
        const stdout = 'r'.repeat(9000);
        assertSilent(runHook(home, bashPayload({
            tool_input: { command, description: 'Print a lot' },
            tool_response: { stdout, stderr: '', exit_code: 0 }
        })), 'oversized');

        const rec = readSpool(home)[0];
        assert.strictEqual(rec.truncated, true, 'a cut sets the flag');
        assert.strictEqual(rec.command.length, hook.FIELD_CAP, 'command is cut to the field cap');
        assert.strictEqual(rec.result.length, hook.FIELD_CAP, 'result is cut to the field cap');
        assert.ok(rec.command.startsWith('echo ccc'), 'the head of the command is kept');
        assert.ok(rec.result.startsWith('rrr'), 'the head of the result is kept');
    } finally {
        rmDir(home);
    }
});

test('an under-cap call sets the flag false', () => {
    const home = makeHome();
    try {
        assertSilent(runHook(home, bashPayload({
            tool_input: { command: 'x'.repeat(hook.FIELD_CAP), description: 'At the cap' },
            tool_response: { stdout: 'y'.repeat(hook.FIELD_CAP), stderr: '', exit_code: 0 }
        })), 'exactly at the cap');

        const rec = readSpool(home)[0];
        assert.strictEqual(rec.command.length, hook.FIELD_CAP);
        assert.strictEqual(rec.result.length, hook.FIELD_CAP);
        assert.strictEqual(rec.truncated, false, 'a field exactly at the cap was not cut');
    } finally {
        rmDir(home);
    }
});

test('an oversized cwd and tool name are cut rather than dropping the record', () => {
    // CUT_ORDER cannot reach either field, so an uncapped one makes serialize
    // return null and the whole call goes unrecorded with no signal anywhere.
    // A Windows long path reaches this in ordinary use.
    const home = makeHome();
    try {
        assertSilent(runHook(home, bashPayload({
            cwd: 'D:\\' + 'd'.repeat(9000),
            tool_name: 'B'.repeat(9000)
        })), 'oversized cwd and tool');

        const lines = readSpool(home);
        assert.strictEqual(lines.length, 1, 'the record is kept');
        assert.strictEqual(lines[0].cwd.length, hook.FIELD_CAP, 'cwd is cut to the field cap');
        assert.strictEqual(lines[0].tool.length, hook.FIELD_CAP, 'tool is cut to the field cap');
        assert.strictEqual(lines[0].truncated, true, 'cutting either one sets the flag');
        assert.strictEqual(lines[0].command, 'git status --porcelain',
            'the fields CUT_ORDER does reach are untouched');
    } finally {
        rmDir(home);
    }
});

test('the line byte cap holds when every field is enormous', () => {
    const home = makeHome();
    try {
        assertSilent(runHook(home, bashPayload({
            tool_input: {
                command: '\u00e9'.repeat(60000),
                description: 'd'.repeat(60000)
            },
            tool_response: { stdout: '"\\\n'.repeat(30000), stderr: 's'.repeat(30000), exit_code: 0 }
        })), 'enormous');

        const raw = fs.readFileSync(dayFile(home), 'utf8');
        assert.ok(Buffer.byteLength(raw, 'utf8') <= hook.LINE_CAP_BYTES,
            'the whole line including its newline is within the byte cap, was '
                + Buffer.byteLength(raw, 'utf8'));
        const rec = readSpool(home)[0];
        assert.strictEqual(rec.truncated, true);
        assert.ok(rec.result.length > 0 && rec.result.length < hook.FIELD_CAP,
            'result is cut first, and only as far as the byte cap needs: its characters '
                + 'cost two bytes each escaped, so emptying it is six times the cut this '
                + 'line called for. Kept ' + rec.result.length);
        assert.strictEqual(rec.command.length, hook.FIELD_CAP,
            'command is untouched while result still has room to give');
        assert.strictEqual(rec.intent.length, hook.FIELD_CAP,
            'intent is cut last and is not reached here');
    } finally {
        rmDir(home);
    }
});

test('cutting walks CUT_ORDER: result empty, command cut, intent untouched', () => {
    // Sized so that emptying result alone CANNOT bring the line under the cap,
    // which is what makes stage 2 run. The two-byte characters are what get it
    // there: three fields at the character cap are well under the byte cap in
    // ASCII, so an ASCII fixture returns after stage 1 and stages 2 and 3 never
    // execute. Reordering CUT_ORDER fails this case.
    const home = makeHome();
    try {
        assertSilent(runHook(home, bashPayload({
            tool_input: {
                command: '\u00e9'.repeat(hook.FIELD_CAP),
                description: '\u00e9'.repeat(hook.FIELD_CAP)
            },
            tool_response: { stdout: 'r'.repeat(hook.FIELD_CAP), stderr: '', exit_code: 0 }
        })), 'staged cut');

        const raw = fs.readFileSync(dayFile(home), 'utf8');
        assert.ok(Buffer.byteLength(raw, 'utf8') <= hook.LINE_CAP_BYTES,
            'the line is within the byte cap, was ' + Buffer.byteLength(raw, 'utf8'));
        const rec = readSpool(home)[0];
        assert.strictEqual(rec.result, '', 'result is emptied first');
        assert.ok(rec.command.length > 0 && rec.command.length < hook.FIELD_CAP,
            'command is cut but not emptied, was ' + rec.command.length);
        assert.strictEqual(rec.intent.length, hook.FIELD_CAP,
            'intent is never touched while command still has room to give');
        assert.strictEqual(rec.truncated, true);
    } finally {
        rmDir(home);
    }
});

test('the cut is scaled by what the field\'s characters cost in bytes', () => {
    // The deficit is in bytes and a slice takes characters. A control character
    // serializes to six bytes, so treating the deficit as a character count
    // over-cuts by six to one and empties a field where cutting a fraction of
    // it would have done. Asserted on the serializer, where the arithmetic is
    // exact.
    const line = hook.serialize(record({
        intent: 'i'.repeat(hook.FIELD_CAP),
        command: 'm'.repeat(hook.FIELD_CAP),
        result: '\u0001'.repeat(hook.FIELD_CAP)
    }));
    assert.ok(line !== null, 'the record fits once result is cut');
    assert.ok(Buffer.byteLength(line, 'utf8') + 1 <= hook.LINE_CAP_BYTES,
        'the byte cap holds, was ' + (Buffer.byteLength(line, 'utf8') + 1));
    const rec = JSON.parse(line);
    assert.ok(rec.result.length >= 500,
        'most of a six-byte-per-character field survives a cut it only needed a '
            + 'fraction of, kept ' + rec.result.length);
    assert.strictEqual(rec.result, '\u0001'.repeat(rec.result.length),
        'what survives is the head of the field');
    assert.strictEqual(rec.command.length, hook.FIELD_CAP, 'stage 2 was not needed');
    assert.strictEqual(rec.truncated, true);
});

test('no cut leaves a lone surrogate behind', () => {
    // Cutting a surrogate pair in half leaves an orphan that is not a
    // character: JSON.stringify emits it as a six-byte escape where the pair
    // was four UTF-8 bytes, so a cut can make the line LONGER, and a consumer
    // decoding the field gets a replacement character.
    assert.strictEqual(hook.trimLoneSurrogate('ok\ud83d'), 'ok');
    assert.strictEqual(hook.trimLoneSurrogate('ok\ud83d\ude00'), 'ok\ud83d\ude00');
    assert.strictEqual(hook.trimLoneSurrogate(''), '');

    // The field cap landing mid-pair.
    const capped = hook.textField('a'.repeat(hook.FIELD_CAP - 1) + '\ud83d\ude00' + 'b');
    assert.strictEqual(capped.length, hook.FIELD_CAP - 1, 'the half pair is dropped, not kept');
    assert.ok(!hasLoneSurrogate(capped), 'the capped field carries no lone surrogate');

    // The byte-cap loop landing mid-pair. The pair is two code units, so
    // whether a cut splits one is a matter of parity, and the parity is set by
    // the byte deficit: the uncut part of the line is grown one BYTE at a time
    // here, through cwd, so the cuts below land on both sides of a pair. A
    // single fixture is a coin toss that reports nothing when it lands even.
    let cut = 0;
    for (let pad = 0; pad < 12; pad += 1) {
        const line = hook.serialize(record({
            cwd: 'c'.repeat(1 + pad),
            intent: 'i'.repeat(hook.FIELD_CAP),
            command: '\u00e9'.repeat(hook.FIELD_CAP),
            result: '\ud83d\ude00'.repeat(hook.FIELD_CAP / 2)
        }));
        assert.ok(line !== null, 'the record still fits at pad ' + pad);
        const rec = JSON.parse(line);
        if (rec.result.length < hook.FIELD_CAP) cut += 1;
        assert.ok(!hasLoneSurrogate(rec.result),
            'a cut field carries no lone surrogate at pad ' + pad + ': '
                + JSON.stringify(rec.result.slice(-4)));
        assert.ok(!/\\ud[89ab][0-9a-f]{2}/i.test(line),
            'no half pair is escaped into the line at pad ' + pad);
    }
    assert.strictEqual(cut, 12, 'every pad above must actually reach a cut');
});

test('a record that cannot fit the byte cap is dropped rather than written long', () => {
    // Reached only through the serializer now: buildRecord caps cwd, tool and
    // the session id, so no payload produces a skeleton this large.
    const dropped = hook.serialize(record({
        sessionId: 's'.repeat(20000), cwd: 'c'.repeat(20000)
    }));
    assert.strictEqual(dropped, null);

    const kept = hook.serialize(record({}));
    assert.ok(typeof kept === 'string' && JSON.parse(kept).command === 'm');
});

test('requiring the hook does not capture as a side effect', () => {
    const home = makeHome();
    try {
        const res = spawnSync(process.execPath, ['-e', 'require(process.argv[1])', HOOK], {
            input: JSON.stringify(bashPayload()),
            env: { ...process.env, HOME: home, USERPROFILE: home },
            encoding: 'utf8'
        });
        assert.strictEqual(res.status, 0, 'the require must not throw');
        assertNothingSpooled(home, 'a bare require');
    } finally {
        rmDir(home);
    }
});

test('the day file is owner-only where the platform honors it', { skip: process.platform === 'win32' }, () => {
    const home = makeHome();
    try {
        assertSilent(runHook(home, bashPayload()), 'capture');
        const mode = fs.statSync(dayFile(home)).mode & 0o777;
        assert.strictEqual(mode, 0o600, 'the spool holds command text and output');
    } finally {
        rmDir(home);
    }
});

// --- The wiring, pinned as a cross-surface fact rather than as a claim in a
// comment. Every case above spawns the hook by absolute path, so the whole
// suite stays green with the registration dropped and the fleet capturing
// nothing; hook-canary.js cannot see it either, since it load-checks the hooks
// hooks.json already names.

test('hooks.json wires the capture hook on PostToolUse for Bash', () => {
    const wiring = JSON.parse(fs.readFileSync(HOOKS_JSON, 'utf8'));
    const entries = wiring.hooks.PostToolUse || [];
    const wired = entries.filter((entry) => (entry.hooks || [])
        .some((h) => typeof h.command === 'string' && h.command.includes('kit-sidecar-capture.js')));
    assert.strictEqual(wired.length, 1, 'PostToolUse wires the capture hook exactly once');
    assert.strictEqual(wired[0].matcher, 'Bash',
        'the v1 tool scope is Bash alone, which sidecar/CONTRACT.md states as the '
            + 'instrument\'s scope; widening it widens what the spool holds');
    assert.strictEqual((wiring.hooks.PreToolUse || []).filter((entry) => (entry.hooks || [])
        .some((h) => typeof h.command === 'string' && h.command.includes('kit-sidecar-capture.js'))).length,
    0, 'capture is a post-boundary duty only');
});

test('one cold capture runs well inside the latency ceiling', () => {
    // A cold spawn, which is the path production takes: the hook is a fresh
    // Node process on every tool call, so an in-process measurement after a
    // warm-up cannot see a module load, a first write, or a require that grew.
    //
    // A bare wall-clock assertion is flake-prone on a contended 2-vCPU box, so
    // two things keep this honest. The MINIMUM of several runs is taken rather
    // than a mean, since one descheduled run says nothing about the hook, and
    // the minimum is the closest reading to the cost the hook actually imposes.
    // And the ceiling sits an order of magnitude above what the fixture
    // measures here (about 50 ms, most of it Node's own startup), so what fails
    // this case is a structural regression, a whole sibling module required
    // back in or a synchronous network call, rather than a busy machine.
    const home = makeHome();
    try {
        const payload = bashPayload();
        const runs = [];
        for (let i = 0; i < 5; i += 1) {
            const started = process.hrtime.bigint();
            const res = runHook(home, payload);
            runs.push(Number(process.hrtime.bigint() - started) / 1e6);
            assertSilent(res, 'timed run ' + i);
        }
        const best = Math.min(...runs);
        assert.ok(best < 1000, 'the fastest cold capture took ' + best.toFixed(1)
            + ' ms, ceiling is 1000 ms (runs: ' + runs.map((r) => r.toFixed(0)).join(', ') + ')');
        assert.strictEqual(readSpool(home).length, 5, 'every timed run captured');
    } finally {
        rmDir(home);
    }
});
