// The judge daemon's two machine-local locations: the endpoint config it reads
// and the state root it owns.
//
// The endpoint config is `~/.claude/kit-endpoint.json`, operator-authored per
// machine, holding `{ "url", "model" }`, an optional `"timeoutMs"`, and an optional
// `"api"` naming the wire protocol (`ollama`, the default, or `openai`). Its
// ABSENCE is the normal case on most machines and means "no endpoint here":
// every component treats that as a reason to stand down quietly, never as an
// error. Nothing in this repository holds the address; it exists only in that
// file and in the operator's own memory tier, and it is read at run time so no
// copy of it lands in a comment, a log line, or a test. What does travel is a
// truncated hash of the host: a startup line and every verdict record carry it,
// so a reader can see that the endpoint changed without the address being
// written down anywhere.
//
// The read itself lives in plugins/claude-kit/scripts/kit-endpoint-lib.js and
// is re-exported here, because memq reads the same file for its own model-judged
// channel and only the plugin tree ships. What stays here is the daemon's
// policy over that read, which is one number: the default request timeout.
//
// The state root is `~/.claude/kit-sidecar/`, holding `spool/` (written by the
// capture hook, read here), `logs/` (verdict logs, findings and the persisted
// offsets) and `inbox/` (the delivery valve's). Every path under it is derived
// from one root so a caller can point the whole daemon at a scratch directory:
// the tests and any replay run do exactly that, which is what keeps them off
// the live store.
//
// Nothing here throws on a bad config. A missing, unreadable, malformed or
// incomplete file all return a described refusal that the caller reports and
// stands down on. A stack trace out of a daemon that simply has no endpoint on
// its machine would be a false alarm dressed as a fault.

'use strict';

const os = require('os');
const path = require('path');

const lib = require('../plugins/claude-kit/scripts/kit-endpoint-lib.js');

// The request timeout when the config names none.
//
// Ninety seconds is long on purpose. The endpoint's lane is serial and carries
// a standing second tenant, the operator's own agent harness running full
// sessions, so a judgment call queues behind somebody else's generation and a
// wait of a minute is normal rather than a fault. An uncontended verdict runs
// 0.7 to 1.5 seconds; the timeout is not sized for the call, it is sized for
// the queue. A tight one would gap-mark constantly and the instrument would be
// reporting its own impatience as unmeasurable data. It is this daemon's policy
// and not the channel's: memq's own model-judged call is interactive and runs
// on a budget three orders of magnitude shorter.
const DEFAULT_TIMEOUT_MS = 90000;

function defaultStateDir() {
    return path.join(os.homedir(), '.claude', 'kit-sidecar');
}

// The paths under a state root. One function so every consumer spells them the
// same way and `--state-dir` moves all of them together.
function statePaths(stateDir) {
    return {
        root: stateDir,
        spoolDir: path.join(stateDir, 'spool'),
        inboxDir: path.join(stateDir, 'inbox'),
        logsDir: path.join(stateDir, 'logs'),
        stateFile: path.join(stateDir, 'logs', 'offsets.json'),
        findingsFile: path.join(stateDir, 'logs', 'findings.jsonl')
    };
}

// The endpoint config, or a described refusal, under this daemon's timeout
// policy. The refusal reasons and the validation are the shared client's.
function loadEndpointConfig(file) {
    return lib.loadEndpointConfig(file, DEFAULT_TIMEOUT_MS);
}

module.exports = {
    DEFAULT_TIMEOUT_MS,
    MIN_TIMEOUT_MS: lib.MIN_TIMEOUT_MS,
    MAX_TIMEOUT_MS: lib.MAX_TIMEOUT_MS,
    FINGERPRINT_CHARS: lib.FINGERPRINT_CHARS,
    hostFingerprint: lib.hostFingerprint,
    hostIsLocal: lib.hostIsLocal,
    remoteEndpointWarning: lib.remoteEndpointWarning,
    defaultConfigPath: lib.defaultConfigPath,
    defaultStateDir,
    statePaths,
    loadEndpointConfig
};
