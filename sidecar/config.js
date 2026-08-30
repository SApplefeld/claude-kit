// The judge daemon's two machine-local locations: the endpoint config it reads
// and the state root it owns.
//
// The endpoint config is `~/.claude/kit-endpoint.json`, operator-authored per
// machine, holding `{ "url", "model" }` and an optional `"timeoutMs"`. Its
// ABSENCE is the normal case on most machines and means "no endpoint here":
// every component treats that as a reason to stand down quietly, never as an
// error. Nothing in this repository holds the address; it exists only in that
// file and in the operator's own memory tier, and this module reads it at run
// time so no copy of it lands in a comment, a log line, or a test. What does
// travel is a truncated hash of the host: a startup line and every verdict
// record carry it, so a reader can see that the endpoint changed without the
// address being written down anywhere.
//
// The state root is `~/.claude/kit-sidecar/`, holding `spool/` (written by the
// capture hook, read here), `logs/` (verdict logs, findings and the persisted
// offsets) and `inbox/` (the delivery valve's, not this section's). Every path
// under it is derived from one root so a caller can point the whole daemon at a
// scratch directory: the tests and any replay run do exactly that, which is
// what keeps them off the live store.
//
// Nothing here throws on a bad config. A missing, unreadable, malformed or
// incomplete file all return a described refusal that the caller reports and
// stands down on. A stack trace out of a daemon that simply has no endpoint on
// its machine would be a false alarm dressed as a fault.

'use strict';

const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');

// The request timeout when the config names none.
//
// Ninety seconds is long on purpose. The endpoint's lane is serial and carries
// a standing second tenant, the operator's own agent harness running full
// sessions, so a judgment call queues behind somebody else's generation and a
// wait of a minute is normal rather than a fault. An uncontended verdict runs
// 0.7 to 1.5 seconds; the timeout is not sized for the call, it is sized for
// the queue. A tight one would gap-mark constantly and the instrument would be
// reporting its own impatience as unmeasurable data.
const DEFAULT_TIMEOUT_MS = 90000;

// The range a configured timeout is accepted in. Outside it the configured
// value is ignored and the default stands, with a warning the caller reports:
// a typo in one optional key is no reason to stand a working endpoint down.
const MIN_TIMEOUT_MS = 1000;
const MAX_TIMEOUT_MS = 600000;

// The characters of the host hash kept as the endpoint's fingerprint. Enough to
// tell one endpoint from another across a startup line and a log full of verdict
// records; far too little to be a reversible copy of the address.
const FINGERPRINT_CHARS = 8;

// A stable, non-identifying name for the endpoint a record was judged against.
//
// The address itself is never written anywhere: not into a record, not into a
// log line, not into this repository, which is public. What a reader needs is
// the ability to notice that today's verdicts were judged somewhere other than
// yesterday's, and a truncated hash of the host answers exactly that question
// and no other. It is a change detector, not a secret: the space of plausible
// hosts is small enough to enumerate, so this is a fingerprint and never an
// authentication.
function hostFingerprint(host) {
    const text = typeof host === 'string' ? host : '';
    return crypto.createHash('sha256').update(text, 'utf8').digest('hex').slice(0, FINGERPRINT_CHARS);
}

// Whether a host sits on this machine or on this machine's private network.
//
// Prevention is not on the table: anything running as this user can rewrite the
// config file, and an actor with write access to ~/.claude is already past every
// control this daemon has. Detection is, and it is what was missing. A host that
// is neither loopback nor RFC1918 means every captured command and its output is
// being posted to a public address, so the daemon says so loudly on stderr at
// startup rather than exporting in silence. It does not refuse: the operator may
// have a private endpoint reached by a name this function cannot classify, and a
// daemon that refused to run would be worked around rather than heeded.
function hostIsLocal(host) {
    const name = (typeof host === 'string' ? host : '').toLowerCase().replace(/^\[|\]$/g, '');
    if (name === 'localhost' || name === '::1' || name === '0:0:0:0:0:0:0:1') return true;
    const v4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(name);
    if (v4 === null) return false;
    const octets = v4.slice(1).map(Number);
    if (octets.some((n) => !Number.isInteger(n) || n > 255)) return false;
    if (octets[0] === 127) return true;
    if (octets[0] === 10) return true;
    if (octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31) return true;
    if (octets[0] === 192 && octets[1] === 168) return true;
    return false;
}

function defaultConfigPath() {
    return path.join(os.homedir(), '.claude', 'kit-endpoint.json');
}

function defaultStateDir() {
    return path.join(os.homedir(), '.claude', 'kit-sidecar');
}

// The paths under a state root. One function so every consumer spells them the
// same way and `--state-dir` moves all of them together.
function statePaths(stateDir) {
    return {
        root: stateDir,
        spoolDir: path.join(stateDir, 'spool'),
        logsDir: path.join(stateDir, 'logs'),
        stateFile: path.join(stateDir, 'logs', 'offsets.json'),
        findingsFile: path.join(stateDir, 'logs', 'findings.jsonl')
    };
}

// The endpoint config, or a described refusal. Refusal reasons, all of which
// the caller reports and stands down on:
//
//   absent      no file at that path: no endpoint on this machine
//   unreadable  the file is there and could not be read (permissions, a
//               directory in its place)
//   malformed   not JSON, or JSON that is not an object
//   invalid     an object missing or mis-typing a key the daemon needs
//
// A URL is required to be http or https because the daemon posts to it. The
// scheme check is not security (the fleet's own endpoint is plain HTTP across
// the virtual switch to the Hyper-V host); it is a type check that catches a
// bare host name before it becomes a confusing fetch failure on every call.
function loadEndpointConfig(file) {
    const target = (typeof file === 'string' && file !== '') ? file : defaultConfigPath();
    let raw = '';
    try {
        raw = fs.readFileSync(target, 'utf8');
    } catch (err) {
        const code = (err && typeof err.code === 'string') ? err.code : '';
        if (code === 'ENOENT') return { ok: false, reason: 'absent', path: target };
        return { ok: false, reason: 'unreadable', path: target, detail: code || 'read failed' };
    }

    let parsed = null;
    try {
        parsed = JSON.parse(raw);
    } catch {
        return { ok: false, reason: 'malformed', path: target, detail: 'not JSON' };
    }
    if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
        return { ok: false, reason: 'malformed', path: target, detail: 'not a JSON object' };
    }

    // Trailing slashes are stripped so the caller's `${url}/api/generate` never
    // doubles one. A doubled slash is accepted by most servers and by no rule.
    const url = typeof parsed.url === 'string' ? parsed.url.trim().replace(/\/+$/, '') : '';
    if (!/^https?:\/\/[^\s/]+/.test(url)) {
        return { ok: false, reason: 'invalid', path: target, detail: 'url must be an http or https address' };
    }
    const model = typeof parsed.model === 'string' ? parsed.model.trim() : '';
    if (model === '') {
        return { ok: false, reason: 'invalid', path: target, detail: 'model must be a non-empty string' };
    }

    const warnings = [];
    let timeoutMs = DEFAULT_TIMEOUT_MS;
    if (parsed.timeoutMs !== undefined) {
        const wanted = typeof parsed.timeoutMs === 'number' ? parsed.timeoutMs : NaN;
        if (!Number.isFinite(wanted) || wanted < MIN_TIMEOUT_MS || wanted > MAX_TIMEOUT_MS) {
            warnings.push(`timeoutMs ignored: expected a number between ${MIN_TIMEOUT_MS} and ${MAX_TIMEOUT_MS}`);
        } else {
            timeoutMs = Math.round(wanted);
        }
    }

    // The host is parsed off the url rather than taken from a separate key, so
    // the fingerprint and the locality reading are both about the address the
    // daemon will actually post to.
    let host = '';
    try {
        host = new URL(url).hostname;
    } catch {
        host = '';
    }

    return {
        ok: true,
        path: target,
        url,
        model,
        timeoutMs,
        warnings,
        endpointFingerprint: hostFingerprint(host),
        endpointIsLocal: hostIsLocal(host)
    };
}

module.exports = {
    DEFAULT_TIMEOUT_MS,
    MIN_TIMEOUT_MS,
    MAX_TIMEOUT_MS,
    FINGERPRINT_CHARS,
    hostFingerprint,
    hostIsLocal,
    defaultConfigPath,
    defaultStateDir,
    statePaths,
    loadEndpointConfig
};
