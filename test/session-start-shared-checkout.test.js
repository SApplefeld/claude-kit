// Tests for the shared-checkout advisory in
// plugins/claude-kit/hooks/session-start.js.
//
// Node's built-in test runner, no framework. The hook is spawned as a real
// child process, fed a SessionStart payload on stdin, and asserted on by its
// stdout: a foreign session transcript written recently in this project's
// transcript directory emits the advisory inside
// {"hookSpecificOutput":{additionalContext}}; this session's own transcript
// alone, or a foreign one older than the recency window, emits nothing.
//
// Every case redirects the home directory (USERPROFILE/HOME, what os.homedir()
// reads) at an empty fixture, so no test ever reads the real transcript store
// and a silence is never the real store's answer. Each case builds a fresh
// project dir carrying no docs/ and no kaizen inbox, so the advisory is the
// only block the hook can emit and stdout is either that block or empty.

'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const { spawnSync } = require('node:child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

const HOOK = path.join(__dirname, '..', 'plugins', 'claude-kit', 'hooks', 'session-start.js');

const OWN_ID = '11111111-2222-3333-4444-555555555555';
const FOREIGN_ID = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';

function makeTemp(prefix) {
    return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

function rmDir(dir) {
    try { fs.rmSync(dir, { recursive: true, force: true }); } catch { /* best effort */ }
}

// A transcript file with an mtime a chosen number of minutes in the past.
function writeTranscript(dir, name, ageMinutes) {
    const file = path.join(dir, name);
    fs.writeFileSync(file, '{"type":"summary"}\n');
    const when = new Date(Date.now() - ageMinutes * 60000);
    fs.utimesSync(file, when, when);
    return file;
}

function runHook(cwd, payload, home) {
    const env = { ...process.env };
    for (const k of Object.keys(env)) {
        if (/^(USERPROFILE|HOME)$/i.test(k)) delete env[k];
    }
    env.USERPROFILE = home;
    env.HOME = home;
    return spawnSync(process.execPath, [HOOK], {
        input: JSON.stringify({ cwd, ...payload }),
        encoding: 'utf8',
        env
    });
}

// The context block the hook injected, or null when it stayed silent.
function context(res) {
    if (!res.stdout) return null;
    return JSON.parse(res.stdout).hookSpecificOutput.additionalContext;
}

// A project, an empty home, and a transcript directory holding this session's
// own transcript, written now.
function fixture() {
    const project = makeTemp('shared-checkout-project-');
    const home = makeTemp('shared-checkout-home-');
    const transcripts = makeTemp('shared-checkout-transcripts-');
    const own = writeTranscript(transcripts, `${OWN_ID}.jsonl`, 0);
    return {
        project,
        home,
        transcripts,
        own,
        run: () => runHook(project, { session_id: OWN_ID, transcript_path: own }, home),
        clean: () => { rmDir(project); rmDir(home); rmDir(transcripts); }
    };
}

test('a foreign transcript written just now emits the shared-checkout advisory', () => {
    const f = fixture();
    try {
        writeTranscript(f.transcripts, `${FOREIGN_ID}.jsonl`, 1);
        const r = f.run();
        assert.strictEqual(r.status, 0);
        const text = context(r);
        assert.ok(text, 'a recent foreign transcript emits a block');
        assert.match(text, /As a hint and not a verdict/);
        assert.match(text, /1 other session/);
        assert.match(text, /about 1 minute ago/);
        // The advisory names counts and an age only: no session id and no
        // machine-local path reach the model.
        assert.doesNotMatch(text, new RegExp(FOREIGN_ID, 'i'));
        assert.ok(!text.includes(f.transcripts));
    } finally { f.clean(); }
});

test('two foreign transcripts report the count and the most recent age', () => {
    const f = fixture();
    try {
        writeTranscript(f.transcripts, `${FOREIGN_ID}.jsonl`, 8);
        writeTranscript(f.transcripts, '99999999-8888-7777-6666-555555555555.jsonl', 3);
        const r = f.run();
        assert.strictEqual(r.status, 0);
        const text = context(r);
        assert.ok(text);
        assert.match(text, /2 other session/);
        assert.match(text, /about 3 minutes ago/);
    } finally { f.clean(); }
});

test('this session\'s own transcript alone emits nothing', () => {
    const f = fixture();
    try {
        const r = f.run();
        assert.strictEqual(r.status, 0);
        assert.strictEqual(r.stdout, '');
        // Control: the same directory with a foreign transcript beside it does
        // speak, so the silence above is the own-id exclusion and not a
        // detector that never fires.
        writeTranscript(f.transcripts, `${FOREIGN_ID}.jsonl`, 1);
        assert.match(context(f.run()), /1 other session/);
    } finally { f.clean(); }
});

test('an own transcript named in the other case is still excluded', () => {
    const f = fixture();
    try {
        // Harness session ids surface in mixed case; the own-id exclusion
        // answers to the shared comparison rule, not to a byte compare.
        const r = runHook(f.project, { session_id: OWN_ID.toUpperCase(), transcript_path: f.own }, f.home);
        assert.strictEqual(r.status, 0);
        assert.strictEqual(r.stdout, '');
    } finally { f.clean(); }
});

test('a foreign transcript older than the recency window emits nothing', () => {
    const f = fixture();
    try {
        writeTranscript(f.transcripts, `${FOREIGN_ID}.jsonl`, 45);
        const r = f.run();
        assert.strictEqual(r.status, 0);
        assert.strictEqual(r.stdout, '');
        // Control: the same file, freshly touched, does speak, so the silence
        // above is the recency window and not an unreadable fixture.
        writeTranscript(f.transcripts, `${FOREIGN_ID}.jsonl`, 1);
        assert.match(context(f.run()), /1 other session/);
    } finally { f.clean(); }
});

test('a recent non-transcript file in the directory emits nothing', () => {
    const f = fixture();
    try {
        fs.writeFileSync(path.join(f.transcripts, 'notes.txt'), 'recent but not a transcript');
        const r = f.run();
        assert.strictEqual(r.status, 0);
        assert.strictEqual(r.stdout, '');
        // Control: a real transcript beside it does speak, so the silence above
        // is the extension filter and not a detector that never fires.
        writeTranscript(f.transcripts, `${FOREIGN_ID}.jsonl`, 1);
        assert.match(context(f.run()), /1 other session/);
    } finally { f.clean(); }
});

test('a file named exactly .jsonl emits nothing', () => {
    const f = fixture();
    try {
        // The stem is empty, and an empty string is not this session's id, so
        // nothing about the own-session exclusion keeps a stray file out: the
        // name has to be judged as a name.
        writeTranscript(f.transcripts, '.jsonl', 1);
        const r = f.run();
        assert.strictEqual(r.status, 0);
        assert.strictEqual(r.stdout, '');
        // Control: a real transcript in the same directory does speak.
        writeTranscript(f.transcripts, `${FOREIGN_ID}.jsonl`, 1);
        assert.match(context(f.run()), /1 other session/);
    } finally { f.clean(); }
});

test('a recent subdirectory named like a transcript emits nothing', () => {
    const f = fixture();
    try {
        // The real store keeps a per-session subdirectory beside the
        // transcripts; only regular files count.
        fs.mkdirSync(path.join(f.transcripts, `${FOREIGN_ID}.jsonl`));
        const r = f.run();
        assert.strictEqual(r.status, 0);
        assert.strictEqual(r.stdout, '');
        // Control: a regular transcript of another id in the same directory does
        // speak, so the silence above is the kind filter and not a fixture the
        // detector could no longer find.
        writeTranscript(f.transcripts, '99999999-8888-7777-6666-555555555555.jsonl', 1);
        assert.match(context(f.run()), /1 other session/);
    } finally { f.clean(); }
});

test('a live sibling is found past the entries a crowded store lists ahead of it', () => {
    const f = fixture();
    try {
        // The store keeps a per-session subdirectory beside each transcript, so
        // a long-lived project lists far more entries than it holds transcripts.
        // Those entries count against the scan's entry ceiling and are then
        // discarded, so the ceiling has to sit far above them: a sibling behind
        // hundreds of them is the case the advisory exists for.
        for (let i = 0; i < 300; i++) {
            fs.mkdirSync(path.join(f.transcripts, `0000-session-noise-${String(i).padStart(4, '0')}`));
        }
        writeTranscript(f.transcripts, `${FOREIGN_ID}.jsonl`, 1);
        const r = f.run();
        assert.strictEqual(r.status, 0);
        assert.match(context(r), /1 other session/);
    } finally { f.clean(); }
});

test('a transcript store that will not answer is reported as no reading, not as no sibling', () => {
    // The scan's silence carries a claim: that no other session of this
    // checkout wrote recently. A directory that could not be listed at all
    // establishes nothing of the kind, so what the session gets is the absence
    // of a reading and the coordination advice that rides with it.
    const f = fixture();
    try {
        const notADirectory = path.join(f.transcripts, 'a-file');
        fs.writeFileSync(notADirectory, 'not a directory\n');
        const r = runHook(f.project,
            { session_id: OWN_ID, transcript_path: path.join(notADirectory, `${OWN_ID}.jsonl`) },
            f.home);
        assert.strictEqual(r.status, 0);
        const text = context(r);
        assert.ok(text, 'a store that would not answer is not silence');
        assert.match(text, /could not be listed in full, so this session has no reading/);
        assert.doesNotMatch(text, /other session\(s\) of this project wrote/);
    } finally { f.clean(); }
});

test('a payload carrying no session id emits nothing', () => {
    const f = fixture();
    try {
        writeTranscript(f.transcripts, `${FOREIGN_ID}.jsonl`, 1);
        const r = runHook(f.project, { transcript_path: f.own }, f.home);
        assert.strictEqual(r.status, 0);
        assert.strictEqual(r.stdout, '');
    } finally { f.clean(); }
});

test('a transcript_path naming a directory that does not exist emits nothing', () => {
    const f = fixture();
    try {
        writeTranscript(f.transcripts, `${FOREIGN_ID}.jsonl`, 1);
        const absent = path.join(f.transcripts, 'gone', `${OWN_ID}.jsonl`);
        const r = runHook(f.project, { session_id: OWN_ID, transcript_path: absent }, f.home);
        assert.strictEqual(r.status, 0);
        assert.strictEqual(r.stdout, '');
    } finally { f.clean(); }
});

test('a transcript_path naming another session\'s file is not trusted as this session\'s directory', () => {
    const f = fixture();
    try {
        const foreign = writeTranscript(f.transcripts, `${FOREIGN_ID}.jsonl`, 1);
        const r = runHook(f.project, { session_id: OWN_ID, transcript_path: foreign }, f.home);
        assert.strictEqual(r.status, 0);
        assert.strictEqual(r.stdout, '');
    } finally { f.clean(); }
});

test('with no transcript_path the directory is found under the home transcript store', () => {
    const f = fixture();
    try {
        const projects = path.join(f.home, '.claude', 'projects', 'D--some--flattened--path');
        fs.mkdirSync(projects, { recursive: true });
        writeTranscript(projects, `${OWN_ID}.jsonl`, 0);
        writeTranscript(projects, `${FOREIGN_ID}.jsonl`, 2);
        const r = runHook(f.project, { session_id: OWN_ID }, f.home);
        assert.strictEqual(r.status, 0);
        assert.match(context(r), /1 other session/);
    } finally { f.clean(); }
});

test('with no transcript_path and no transcript store the hook stays silent', () => {
    const f = fixture();
    try {
        const r = runHook(f.project, { session_id: OWN_ID }, f.home);
        assert.strictEqual(r.status, 0);
        assert.strictEqual(r.stdout, '');
    } finally { f.clean(); }
});

test('KIT_EXTERNAL_ENGINE does not suppress the shared-checkout advisory', () => {
    const f = fixture();
    try {
        writeTranscript(f.transcripts, `${FOREIGN_ID}.jsonl`, 1);
        const env = { ...process.env, USERPROFILE: f.home, HOME: f.home, KIT_EXTERNAL_ENGINE: '1' };
        const r = spawnSync(process.execPath, [HOOK], {
            input: JSON.stringify({ cwd: f.project, session_id: OWN_ID, transcript_path: f.own }),
            encoding: 'utf8',
            env
        });
        assert.strictEqual(r.status, 0);
        assert.match(context(r), /1 other session/);
    } finally { f.clean(); }
});
