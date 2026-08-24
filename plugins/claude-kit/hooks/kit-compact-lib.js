// Shared library for the boundary-gated compaction checkpoint, and for the
// transcript reading its consumers share.
//
// The checkpoint is a small project-scoped JSON file (.kit/compact-checkpoint.json,
// gitignored territory) recording the plan path a chapter boundary was reached
// for. It is the signal between two programs that must agree on its path and
// shape: the checkpoint CLI (kit-compact-checkpoint.js) writes it at the
// chapter-close ritual, and the PreCompact gate (kit-compact-gate.js) reads it
// to decide whether a pending auto-compaction may land, consuming (deleting) it
// on the allow so the next mid-chapter attempt is denied again. Single-sourcing
// the path, the read/write/clear operations, and the match rule
// (checkpointMatches, with its age constants) here is what keeps the writer,
// the gate, and the status report from drifting apart.
//
// The gate's decision record (.kit/compact-gate.json and its .jsonl log) is
// here for the same single-sourcing reason: the gate writes it and the
// checkpoint CLI's status report reads it, so its paths and its shape belong in
// one place.
//
// The transcript helpers (readTranscriptCapped, stripLocalCommandOutput, and
// the automation detection) live here for the same reason: the goal-leash Stop
// hook (kit-goal-stop.js) and the PreCompact gate both read transcript text
// and both must neutralize local-command echoes, and two near-duplicate copies
// of the greedy stripping semantics would drift apart.
//
// Node core modules only, CommonJS, zero dependencies. Every exported function
// that touches the filesystem is wrapped so it never throws: a filesystem
// hiccup degrades to a null/refusal result instead of trapping the caller,
// matching kit-goal-lib.js.

'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { normalizePlanArg } = require('./kit-goal-lib.js');

// Path to the checkpoint file for a given repo root.
function checkpointPath(cwd) {
    return path.join(cwd, '.kit', 'compact-checkpoint.json');
}

// How long an open checkpoint stays honorable. A checkpoint opened at a
// boundary that is already past the compaction trigger is consumed within
// seconds (the harness re-offers a compaction every assistant turn once past
// the trigger), so ten minutes is generous for the case that matters. A
// checkpoint opened BELOW the trigger has no offer to catch and must age out
// instead: honoring it later, when the next chapter crosses the trigger
// mid-section, would land the compaction mid-chapter, which is the exact
// placement the gate exists to prevent, and self-sustainingly so (the landed
// compaction resets consumption, the next boundary opens another
// below-trigger checkpoint, and the cycle repeats). When the bound misfires,
// the cost is one mid-chapter compaction, the pre-gate status quo, so the
// failure direction stays fail-open.
//
// The floor on this value is a long dispatched tool call: a chapter close
// followed immediately by a multi-minute implementer run delays the next
// assistant turn, and therefore the next compaction offer, past the open.
// Implementers have run 6 to 12 minutes, so a bound much under ten minutes
// would start discarding boundaries that were about to be honored. The
// ceiling on it is how long a below-trigger checkpoint can linger before the
// next chapter crosses the trigger, which at the recommended trigger the
// doctor derives is far longer than either number. That figure is deliberately
// not restated here: the doctor computes every displayed number from its own
// window and reserve values, and a copy in this comment would strand the
// moment either changes.
const CHECKPOINT_MAX_AGE_MS = 10 * 60 * 1000;

// Skew allowance for a checkpoint whose openedAt sits in the future: a small
// clock adjustment between the write and the read is tolerated, but a far-
// future timestamp is treated as illegible rather than honored, so a clock
// change can never mint an effectively immortal checkpoint.
const CHECKPOINT_FUTURE_SKEW_MS = 2 * 60 * 1000;

// Compare two session ids as opaque, case-insensitive strings (session UUIDs
// are surfaced in mixed case across the harness). Shared by the checkpoint
// match rule, the PreCompact gate, and the goal-leash Stop hook, which must
// all agree on session identity. False when either side is missing, which is
// exactly the treat-as-absent handling an unbound goal or an old-format
// checkpoint needs.
function sameSessionId(a, b) {
    if (!a || !b) return false;
    return String(a).trim().toLowerCase() === String(b).trim().toLowerCase();
}

// The one checkpoint match rule, shared by its two consumers so they cannot
// drift: the PreCompact gate uses the verdict to decide whether a pending
// auto-compaction may land (and the checkpoint be consumed), and the CLI's
// status report uses the reason to say why a checkpoint on disk gates
// nothing. A checkpoint counts only when its recorded plan equals the armed
// goal's plan, its recorded boundSession equals the goal's current
// boundSession, and its openedAt is fresh (parseable, within
// CHECKPOINT_MAX_AGE_MS of nowMs, and no further than
// CHECKPOINT_FUTURE_SKEW_MS into the future).
//
// Returns { ok:true, reason:null } on a match, else { ok:false, reason } with
// reason naming the first failed clause in evaluation order:
//   'no-checkpoint'  cp is missing or carries no plan string
//   'no-goal'        goal is missing or carries no plan string
//   'wrong-plan'     the plans differ (a stale file from a prior run)
//   'wrong-session'  the bound sessions differ (an orphan from a crashed run,
//                    or an unbound side on either record)
//   'no-timestamp'   openedAt is missing or does not parse as a date
//   'expired'        openedAt is older than CHECKPOINT_MAX_AGE_MS
//   'future'         openedAt is beyond the future skew allowance
// Never throws on JSON-derived input: every access is guarded and Date.parse
// returns NaN on garbage. nowMs exists so a caller can pin the clock; an
// absent or illegible value means the current time.
function checkpointMatches(cp, goal, nowMs) {
    const now = (typeof nowMs === 'number' && Number.isFinite(nowMs)) ? nowMs : Date.now();
    if (!cp || typeof cp !== 'object' || typeof cp.plan !== 'string') {
        return { ok: false, reason: 'no-checkpoint' };
    }
    if (!goal || typeof goal !== 'object' || typeof goal.plan !== 'string' || goal.plan === '') {
        return { ok: false, reason: 'no-goal' };
    }
    if (cp.plan !== goal.plan) return { ok: false, reason: 'wrong-plan' };
    if (!sameSessionId(cp.boundSession, goal.boundSession)) return { ok: false, reason: 'wrong-session' };
    if (typeof cp.openedAt !== 'string') return { ok: false, reason: 'no-timestamp' };
    const opened = Date.parse(cp.openedAt);
    if (!Number.isFinite(opened)) return { ok: false, reason: 'no-timestamp' };
    const age = now - opened;
    if (age > CHECKPOINT_MAX_AGE_MS) return { ok: false, reason: 'expired' };
    if (age < -CHECKPOINT_FUTURE_SKEW_MS) return { ok: false, reason: 'future' };
    return { ok: true, reason: null };
}

// Read and parse the checkpoint file. Returns the parsed object, or null if
// the file is absent, unreadable, or not valid JSON. The content is untrusted
// data (the file is user-writable): callers compare its plan against the armed
// goal's and must never surface its values unsanitized.
function readCheckpoint(cwd) {
    try {
        const raw = fs.readFileSync(checkpointPath(cwd), 'utf8');
        return JSON.parse(raw);
    } catch {
        return null;
    }
}

// Write the checkpoint atomically (tmp file + rename), recording the plan it
// belongs to and the session the goal is currently bound to. Returns
// { ok:true, plan } or { ok:false, reason }; never throws.
//
// The plan path is validated through kit-goal-lib's normalizePlanArg, the same
// gate every stored plan path passes: it rejects control characters and any
// path that escapes cwd, and the NORMALIZED form is what gets stored. For a
// plan armGoal wrote, normalization is idempotent, so the stored value equals
// the goal's and the gate's equality check matches; a hand-edited goal state
// carrying a value armGoal would never have written either refuses here or
// stores a normalized form the gate reads as absent, both of which degrade to
// the status quo rather than opening the gate on untrusted input.
//
// boundSession pins the checkpoint to the run that opened it: the gate treats
// a checkpoint whose recorded boundSession does not match the goal's as
// absent, so a checkpoint orphaned by a crash cannot open the gate for the
// re-bound session that resumes the plan. The value is copied from the goal
// state, so it is held to bindSession's own storage rules (a string, capped
// length, no control characters); null is stored as null (an unbound goal),
// which the gate likewise never matches.
//
// The tmp name is unique per writer and unpredictable (see atomicTmpPath), and
// a failed rename unlinks its tmp so orphans do not accumulate in .kit/.
// The temporary path an atomic write renames from, shared by every writer in
// this file. The pid keeps two writers off one name; the random suffix keeps
// the name from being predictable, because a link pre-planted at a guessable
// tmp path would be followed by the write that creates it. The exclusive flag
// each caller passes at the open is the actual defense (a pre-planted path
// fails the create outright); the unguessable name is what keeps an attacker
// from winning that race repeatedly.
function atomicTmpPath(target) {
    return target + '.tmp.' + process.pid + '.' + crypto.randomBytes(6).toString('hex');
}

function writeCheckpoint(cwd, planRel, boundSession) {
    const normalized = normalizePlanArg(cwd, planRel);
    if (normalized === null) {
        return { ok: false, reason: 'plan path is invalid or outside the repo' };
    }
    let session = null;
    if (boundSession !== undefined && boundSession !== null) {
        if (typeof boundSession !== 'string' || boundSession === '' || boundSession.length > 128
            || /[\x00-\x1F]/.test(boundSession)) {
            return { ok: false, reason: 'bound session is invalid' };
        }
        session = boundSession;
    }
    const cp = checkpointPath(cwd);
    const state = { plan: normalized, boundSession: session, openedAt: new Date().toISOString() };
    try {
        fs.mkdirSync(path.dirname(cp), { recursive: true });
        const tmp = atomicTmpPath(cp);
        try {
            fs.writeFileSync(tmp, JSON.stringify(state, null, 2) + '\n', { encoding: 'utf8', flag: 'wx' });
            fs.renameSync(tmp, cp);
        } catch (err) {
            try { fs.unlinkSync(tmp); } catch { /* nothing to remove, or it is the unwritable path itself */ }
            throw err;
        }
    } catch (err) {
        return { ok: false, reason: 'could not write checkpoint: ' + (err && err.message ? err.message : String(err)) };
    }
    return { ok: true, plan: normalized };
}

// Delete the checkpoint file if present. Returns { ok:true, cleared:true } when
// a file was removed, { ok:true, cleared:false } when none was open, and
// { ok:false, cleared:false, reason } when the file exists but the delete
// failed. Never throws. The gate calls this to consume a matching checkpoint;
// a failed delete there degrades to the gate standing open (compaction lands
// mid-chapter, the pre-gate status quo), never to a wedged session.
function clearCheckpoint(cwd) {
    const cp = checkpointPath(cwd);
    try {
        if (!fs.existsSync(cp)) {
            return { ok: true, cleared: false };
        }
        fs.unlinkSync(cp);
        return { ok: true, cleared: true };
    } catch (err) {
        return {
            ok: false,
            cleared: false,
            reason: 'could not clear checkpoint: ' + (err && err.message ? err.message : String(err))
        };
    }
}

// ---------------------------------------------------------------------------
// The gate's decision record.
//
// The PreCompact gate takes a verdict on every auto-compaction offer and, until
// it writes one down, leaves no trace: a run held for a whole section, a
// checkpoint that expired seconds before the agent returned, and a safety-valve
// fire are indistinguishable afterwards. Two project-local files under .kit/
// carry that record. The STATE (compact-gate.json) is the newest decision plus
// the deferral episode currently standing, read by the checkpoint CLI's status
// report; it is rewritten in place, so it stays one small file. The LOG (compact-gate.jsonl) is append-only, one JSON line per
// decision, and is what an operator reads to answer "how often, and why" across
// a whole run.
//
// Both are written after the verdict is already announced (the gate sets its
// exit code and writes its note first) and neither can change it:
// recordGateDecision swallows every failure and returns nothing a caller could
// branch on, so a full disk or a read-only .kit degrades to a gate that decides
// exactly as it did before, silently. That asymmetry is deliberate. The record
// is diagnostic; the verdict is the product. The ordering matters as much as
// the swallowing: a path that could block (a FIFO planted at either file)
// cannot delay a verdict that has already been emitted.
//
// The record is written only in a project that is ALREADY kit-governed: an
// existing .kit/ directory is the precondition, and neither the directory nor
// its parents are ever created here. The gate runs on every auto-compaction
// offer on the machine, including in repositories that have nothing to do with
// the kit, and creating an untracked directory of session ids and token
// readings in someone's unrelated checkout is a cost the diagnostic does not
// earn. An armed project always has .kit/goal-state.json, so the record stays
// complete exactly where the feature is for.
//
// Both files must be regular files, and .kit/ itself must be a real directory
// rather than a link to one. A symlink, junction, or FIFO planted at any of the
// three is refused rather than followed: appending through a link writes into
// its target on every assistant turn, trimming through one lands a megabyte of
// an arbitrary readable file inside .kit/, and a FIFO blocks a read or a write
// forever where no try/catch can rescue it. Each check is an lstat, so a link
// is judged as a link rather than as whatever it points at.
//
// A HARDLINK is the member of that class these checks admit: it is a regular
// file and passes, so a hardlink planted at either path receives the record's
// writes. That is left open on purpose, matching the posture the kit already
// takes for its goal-event sink, and the exposure is bounded by what lands
// there: this file's own JSON, in a project the actor can already write to.
//
// Those checks NARROW the window rather than closing it, the same honest
// account readTranscriptCapped gives of its own isFile() check: the path is
// re-resolved by the open that follows, so a swap landing between the two is
// still possible. Closing it needs a single open plus an fstat on the
// descriptor, a restructure this diagnostic does not earn, and what rides
// through the residual window is well-formed JSON appended to a path the actor
// already controls. The temporary files both writers rename through are created
// exclusively (O_EXCL) under an unpredictable name, so the one path an attacker
// could otherwise pre-plant is not guessable and would fail the open anyway.
//
// Every value stored here that came from outside (the harness's session id, the
// checkpoint file's own contents, and a prior state file, which is user-writable
// like every other file under .kit/) is rebuilt field by field on the way in and
// on the way out, so neither a forged state file nor an odd payload can grow the
// file without bound or push control characters into an operator's terminal.
// ---------------------------------------------------------------------------

// Path to the gate's decision state for a given repo root.
function gateStatePath(cwd) {
    return path.join(cwd, '.kit', 'compact-gate.json');
}

// Path to the gate's append-only decision log for a given repo root.
function gateLogPath(cwd) {
    return path.join(cwd, '.kit', 'compact-gate.jsonl');
}

// The log's bound. A decision line runs a few hundred bytes and the gate fires
// at most once per assistant turn, so 2 MB is months of dense use; past it the
// writer keeps the newest 1 MB and drops the rest. Trimming to half the cap
// rather than to the cap itself is what keeps the rewrite rare: at a 1-byte
// margin every subsequent append would rewrite the whole file.
const GATE_LOG_MAX_BYTES = 2 * 1024 * 1024;
const GATE_LOG_KEEP_BYTES = 1 * 1024 * 1024;

// How long a deferral episode stands without a new denial before a reader
// treats it as finished rather than as the hold currently in force.
//
// The episode's whole claim is about right now: "the gate is holding offers,
// and has been for M minutes" is what makes an operator or a nudge act. Nothing
// on disk marks the end of one, because the events that end an episode without
// an allow reaching this file leave no trace to write: a manual /compact (the
// PreCompact matcher is auto-only, so the gate never runs), a session that
// simply ends, an offer that never comes again. So the newest denial's age is
// the only evidence of whether the hold is still real, and past this window the
// count is history rather than state.
//
// The floor is the longest gap there can be between two denials of one genuine
// episode, which is one assistant turn, which is the longest tool call a
// session makes: dispatched implementer and reviewer runs have been measured at
// 22, 27, 67 and 73 minutes. Four hours clears the longest of those by better
// than three times, so no real hold is ever cut short. The ceiling is that a
// count must not survive a break long enough to make it a different working
// session: four hours does not survive a night, a morning off, or a day spent
// in another project, which is where a stale "held 16 offers over 1387 minutes"
// would read as a missed boundary and push an operator into forcing a
// checkpoint open mid-chapter, the exact mis-scheduling the gate exists to
// prevent. This is deliberately not CHECKPOINT_MAX_AGE_MS: that bound answers
// how long a declared boundary stays honorable, a different question.
const GATE_EPISODE_MAX_IDLE_MS = 4 * 60 * 60 * 1000;

// The verdicts a record may carry, and the only values recordGateDecision
// accepts: an unrecognized verdict is not written at all, because a state file
// the CLI and the nudge read has to be legible to both.
const GATE_VERDICTS = ['allow', 'deny-boundary', 'deny-interactive'];

// The reasons a record may carry: the gate clause that decided, plus the
// checkpoint match rule's own codes, which are what a boundary deny reports.
// The vocabulary is closed and this library is the only thing that writes it,
// so a value outside it came from a hand-edited state file rather than from the
// gate. Reason reaches the CLI's status report, a channel a model reads, and
// the charset and length caps alone would let arbitrary prose through; checking
// the value against the list it is drawn from costs nothing and bounds it to
// this file's own words.
const GATE_REASONS = [
    'not-auto', 'external-engine', 'no-session', 'no-goal', 'bystander',
    'automation', 'checkpoint', 'valve', 'illegible',
    'no-checkpoint', 'wrong-plan', 'wrong-session', 'no-timestamp', 'expired', 'future'
];

// A string safe to store and to print back: printable ASCII, length-capped,
// null for anything else (an empty string included, which reads as absent
// everywhere here). Applied to every string field on the way in and again on
// the way out, so a state file hand-edited between the two still cannot carry
// control characters into a terminal or megabytes into the next write.
function gateText(value) {
    if (typeof value !== 'string') return null;
    const clean = value.replace(/[^\x20-\x7E]/g, '').slice(0, 128);
    return clean === '' ? null : clean;
}

// A count safe to store and to print back: a non-negative integer, clamped.
// The clamp is what keeps the "two integers and nothing else" bound the stderr
// note and the status report claim: a planted denials of 1e308 is a finite
// number, and JavaScript renders it as "1e+308", which is neither an integer
// nor anything an operator can read as a count of offers. A billion is past
// every real reading (offers are counted per assistant turn, tokens per
// context) and still renders in full digits.
const GATE_COUNT_MAX = 1000000000;

function gateCount(value) {
    if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) return null;
    return Math.min(Math.floor(value), GATE_COUNT_MAX);
}

// Rebuild a decision record from an arbitrary object, or null when it is not
// one. The shape is the whole contract between the gate (writer) and the CLI
// and nudge (readers): `at` when it was taken, `verdict`, `reason` naming the
// clause that decided, `consumed` the token reading behind it or null,
// `checkpoint` the facts of the checkpoint file that was on disk or null, and
// `session` the harness's id for the compacting session.
function gateRecord(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
    if (!GATE_VERDICTS.includes(value.verdict)) return null;
    let checkpoint = null;
    const cp = value.checkpoint;
    if (cp && typeof cp === 'object' && !Array.isArray(cp)) {
        checkpoint = {
            ageSeconds: (typeof cp.ageSeconds === 'number' && Number.isFinite(cp.ageSeconds))
                ? Math.round(cp.ageSeconds) : null,
            pendingOffer: cp.pendingOffer === true
        };
    }
    const reason = gateText(value.reason);
    return {
        at: gateText(value.at),
        verdict: value.verdict,
        reason: GATE_REASONS.includes(reason) ? reason : null,
        consumed: gateCount(value.consumed),
        checkpoint,
        session: gateText(value.session)
    };
}

// Rebuild a deferral episode: the run of denials standing with no allow after
// it. `session` is the session being held, `since` dates the first denial,
// `denials` counts them, `lastDeniedAt` dates the newest, and `nudgedAt` is when
// the deferral nudge last spoke, so it can hold its interval across processes.
//
// Null unless the episode is genuinely open, which means every field an episode
// is read FOR is legible: an owning session, a count of at least one, and two
// timestamps that parse. A half-written or hand-edited record ({} being the
// easy case) reads as no episode rather than as an open one holding zero offers
// since no time at all, so no consumer has to re-derive openness with a guard
// of its own.
//
// The session requirement is what keeps an unownable episode off the disk: every
// writer here records one, so a record without it is hand-made or from an older
// version, and honoring it would let a record nobody can clear hold the single
// slot for its whole idle window.
//
// nothing writes nudgedAt today. It is carried through every rebuild so that a
// writer has one place to land.
function gateEpisode(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
    const session = gateText(value.session);
    const since = gateText(value.since);
    const lastDeniedAt = gateText(value.lastDeniedAt);
    const denials = gateCount(value.denials) || 0;
    if (!session) return null;
    if (denials < 1) return null;
    if (!since || !Number.isFinite(Date.parse(since))) return null;
    if (!lastDeniedAt || !Number.isFinite(Date.parse(lastDeniedAt))) return null;
    return {
        session,
        since,
        denials,
        lastDeniedAt,
        nudgedAt: gateText(value.nudgedAt)
    };
}

// The deferral episode a state has open RIGHT NOW, or null: the one predicate
// for that question, so no reader has to re-derive it. Its readers are the
// gate's stderr note and the checkpoint CLI's status report. An episode whose
// newest denial has aged past GATE_EPISODE_MAX_IDLE_MS is finished, not open.
// nowMs exists so a caller can pin the clock; an absent or illegible value
// means the current time.
//
// sessionId is optional and answers a different question than omitting it does.
// Supplied, an episode belonging to any other session reads as NOT open, which
// is what every decision-shaped question wants: one session must never act on
// a hold another session is under. Omitted, any open episode counts, which is
// what a human reading `status` wants, since the question there is whether this
// project is holding offers at all. An explicit null is a session id that
// exists and matches nothing, not an omission: a decision carrying no session
// id can own no episode.
//
// The gate's note supplies the deciding session's id; status omits it. A caller
// asking whether to act on a hold supplies one, and an unbound goal supplies an
// explicit null, which matches nothing.
function gateEpisodeOpen(state, nowMs, sessionId) {
    const episode = state ? gateEpisode(state.episode) : null;
    if (!episode) return null;
    const now = (typeof nowMs === 'number' && Number.isFinite(nowMs)) ? nowMs : Date.now();
    const last = Date.parse(episode.lastDeniedAt);
    if (now - last > GATE_EPISODE_MAX_IDLE_MS) return null;
    // The other direction needs a bound too, and for the reason the checkpoint
    // rule already states: a denial dated into the future (a hand-edited file, a
    // restored VM snapshot, a backward clock correction) has a negative age that
    // no idle bound can ever exceed, so the episode would stand forever while
    // reporting itself as zero minutes old. The same skew allowance the
    // checkpoint uses applies here, rather than a second constant answering the
    // same question.
    if (last - now > CHECKPOINT_FUTURE_SKEW_MS) return null;
    if (sessionId !== undefined && !sameSessionId(episode.session, sessionId)) return null;
    return episode;
}

// Whole minutes between an ISO timestamp and now, or null when it does not
// parse. Negative ages (a clock adjustment, a hand-edited file) floor at zero:
// every surface that reports one states it as an elapsed duration, and a
// negative duration is not a thing an operator can act on.
function wholeMinutesSince(iso, nowMs) {
    const at = typeof iso === 'string' ? Date.parse(iso) : NaN;
    if (!Number.isFinite(at)) return null;
    const now = (typeof nowMs === 'number' && Number.isFinite(nowMs)) ? nowMs : Date.now();
    return Math.max(0, Math.floor((now - at) / 60000));
}

function countPhrase(n, singular) {
    return n + ' ' + singular + (n === 1 ? '' : 's');
}

// "held 3 offers over 12 minutes": the count of offers held in this episode and
// its age, as one phrase, single-sourced because two surfaces report the same
// two integers (the gate's stderr note and the checkpoint CLI's status) and an
// operator reading both should not have to reconcile two phrasings. Two integers and nothing else, which is what
// keeps a user-writable state file off those channels. Null when the episode's
// age cannot be read, so a caller says nothing rather than guessing.
function episodePhrase(episode, nowMs) {
    if (!episode) return null;
    const minutes = wholeMinutesSince(episode.since, nowMs);
    if (minutes === null) return null;
    return 'held ' + countPhrase(episode.denials, 'offer') + ' over ' + countPhrase(minutes, 'minute');
}

// The state file's read cap. The writer produces a few hundred bytes and never
// grows: it holds two records and one episode, each rebuilt field by field with
// capped strings. Anything past a quarter megabyte is not something this wrote,
// and reading it whole on a per-offer hook path is cost with nothing to gain.
const GATE_STATE_MAX_BYTES = 256 * 1024;

// Read the gate state, distinguishing a file that is not there from one that
// cannot be read right now. Returns { ok, state }:
//
//   { ok: true,  state }        legible, rebuilt (state is null when the file is
//                               absent, unparseable, or not an object: none of
//                               those carries an episode to lose)
//   { ok: false, state: null }  the answer is unknown, so no caller may act as
//                               though the file were absent
//
// The distinction is load-bearing on the write path. A file locked by an
// indexer or an antivirus scanner (EBUSY, EPERM) is not an absent file, and
// treating it as one would rewrite a live episode as a fresh count of one,
// destroying exactly the reading this record exists to produce. The gate's note
// wants the same distinction: it says nothing rather than reporting a projected
// count of one on the fiftieth deny of a section.
//
// The refusal legs come first and cover this file's own hazards: a non-regular
// path (a FIFO here blocks the read forever, with no verdict emitted, since
// every caller of this runs on the gate's critical path) and an oversized one.
function readGateStateResult(cwd) {
    const target = gateStatePath(cwd);
    let st;
    try {
        st = fs.lstatSync(target);
    } catch (err) {
        if (err && err.code === 'ENOENT') return { ok: true, state: null };
        return { ok: false, state: null };
    }
    if (!st.isFile() || st.size > GATE_STATE_MAX_BYTES) return { ok: false, state: null };
    let raw;
    try {
        raw = fs.readFileSync(target, 'utf8');
    } catch (err) {
        if (err && err.code === 'ENOENT') return { ok: true, state: null };
        return { ok: false, state: null };
    }
    let parsed;
    try { parsed = JSON.parse(raw); } catch { return { ok: true, state: null }; }
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return { ok: true, state: null };
    return {
        ok: true,
        state: {
            lastDecision: gateRecord(parsed.lastDecision),
            episode: gateEpisode(parsed.episode),
            lastAllow: gateRecord(parsed.lastAllow)
        }
    };
}

// The gate state, or null when it is absent, refused, unreadable, or not JSON.
// The reading surfaces take this shape because they act the same way on all
// four: a null state and a state whose fields are null both mean no decision
// recorded and no episode open. A caller that must not confuse "not there" with
// "cannot tell" takes readGateStateResult instead.
function readGateState(cwd) {
    return readGateStateResult(cwd).state;
}

// The state that follows a prior state and a new record. Pure: it writes
// nothing, so the gate can project the episode its note will report before it
// attempts the write that stores it.
//
// The episode belongs to the LEASH, not to whichever session denied last, and
// that is what makes one slot enough. The two deny classes have disjoint
// producers: a boundary deny is reachable only behind the gate's own
// armed-and-bound test (or the bind-claim that immediately follows it), so only
// the bound session can produce one and it always carries a session id, while
// an interactive deny is the only deny on the bystander and nothing-armed
// fall-through. So:
//
//   deny-boundary     extends the standing episode when it owns it, and
//                     otherwise opens a fresh one at one. Replacing a foreign
//                     incumbent is right on this path rather than harmful: the
//                     binding is exclusive, so a foreign owner here can only be
//                     a dead binding (a crash, then a re-arm), never a rival.
//   deny-interactive  records the decision and carries the standing episode
//                     through untouched. A bystander, or a project with nothing
//                     armed, never opens, extends, inflates, or destroys one.
//   allow             clears the episode only when the allower owns it. An
//                     allow lands a compaction in the allower's own context;
//                     a bystander's compaction says nothing about the offers
//                     the bound session is still being denied.
//
// A decision carrying no session id never opens or extends an episode. The
// partition above makes that unreachable on the boundary path, and the rule
// stays as a floor so no unownable record can reach the disk.
//
// What this costs, taken deliberately: an interactive hold has no episode
// aggregate. In a project holding a hands-on session, status reports the last
// decision's recency but no count and no duration, and says no episode is open.
// The .jsonl log still carries every one of those denials.
//
// The one contention left: two sessions whose transcripts both claim the same
// unbound goal (the superseded-arming window the gate's header documents) can
// alternate boundary denies and reset each other's count. It is self-limiting,
// because each offer re-reads the goal and whichever bind landed last takes the
// boundary path; the tell is a note whose count never grows during a run you
// believe is singly leashed. Every failure direction here is an UNDERCOUNT,
// which degrades to the pre-plan status quo (a compaction landing mid-chapter),
// never to a checkpoint honored longer than it should be.
//
// So an open episode means "this session has been denied, with no allow since,
// recently", which is the pending-offer signal the checkpoint rule and the
// nudge read: past the compaction trigger the harness re-offers every assistant
// turn, so once a deny has landed the offers recur until one is allowed.
function nextGateState(prior, record) {
    const lastAllow = prior ? gateRecord(prior.lastAllow) : null;
    const standing = gateEpisodeOpen(prior, Date.parse(record.at));
    const mine = !!standing && sameSessionId(standing.session, record.session);
    if (record.verdict === 'allow') {
        return {
            lastDecision: record,
            episode: mine ? null : standing,
            lastAllow: record
        };
    }
    if (record.verdict === 'deny-boundary' && record.session) {
        if (mine) {
            return {
                lastDecision: record,
                episode: {
                    session: standing.session,
                    since: standing.since,
                    denials: standing.denials + 1,
                    lastDeniedAt: record.at,
                    nudgedAt: standing.nudgedAt
                },
                lastAllow
            };
        }
        return {
            lastDecision: record,
            episode: {
                session: record.session,
                since: record.at,
                denials: 1,
                lastDeniedAt: record.at,
                nudgedAt: null
            },
            lastAllow
        };
    }
    // An interactive deny, or the session-less boundary deny the partition
    // makes unreachable: the decision is recorded and the slot is left alone.
    return { lastDecision: record, episode: standing, lastAllow };
}

// The episode this decision's OWN session will stand under once the decision is
// recorded, computed without writing anything. The gate's note has to report
// the hold including the decision it is announcing, and it has to be composed
// before the write is attempted, so a write that fails, or blocks, cannot make
// the note report a prior state as if it were current.
//
// Null when there will be no open episode belonging to this session, and null
// whenever the record cannot land at all (gateRecordTargets owns that whole
// set: an unreadable state, a refused path, an unwritable file). Projecting
// over a state that will never advance is what produces a fresh count of one on
// the fiftieth deny of a section, a stuck number that reads exactly like the
// mechanism working, and it puts two operator-facing surfaces in contradiction:
// stderr claiming a hold that status says was never recorded.
function projectGateEpisode(cwd, decision) {
    try {
        const record = gateRecord(decision);
        if (!record) return null;
        record.at = new Date().toISOString();
        const targets = gateRecordTargets(cwd);
        if (!targets.ok) return null;
        const at = Date.parse(record.at);
        return gateEpisodeOpen(nextGateState(targets.prior, record), at, record.session);
    } catch {
        return null;
    }
}

// The size of the REGULAR file at this path: 0 when nothing is there, and null
// when the path cannot be safely written through, either because something
// other than a regular file is sitting on it (a symlink or junction, a
// directory, a FIFO) or because its kind could not be determined at all. The
// check is an lstat, so a link is judged as a link rather than as whatever it
// points at.
//
// Only ENOENT reads as "nothing there, go ahead". Every other lstat failure
// (EACCES, EPERM, EBUSY: a permission, a lock, a scanner holding the file) is
// an unknown answer, and answering an unknown with the go-ahead value is the
// mistake readGateStateResult exists to avoid. It matters concretely here:
// endsOnLineBoundary reads this, and a zero from a transient failure would tell
// it the log ends on a line boundary without a byte having been read, producing
// exactly the fused record its guard exists to prevent.
function regularFileSize(target) {
    let st;
    try {
        st = fs.lstatSync(target);
    } catch (err) {
        return (err && err.code === 'ENOENT') ? 0 : null;
    }
    return st.isFile() ? st.size : null;
}

// Write JSON atomically (tmp file plus rename), on writeCheckpoint's discipline
// and for the same reasons: a failed rename unlinks its tmp so orphans do not
// accumulate in .kit/. The containing directory is a precondition, never
// created here (see the section header). Throws on failure; the one caller
// catches.
function writeJsonAtomic(target, value) {
    const tmp = atomicTmpPath(target);
    try {
        fs.writeFileSync(tmp, JSON.stringify(value, null, 2) + '\n', { encoding: 'utf8', flag: 'wx' });
        fs.renameSync(tmp, target);
    } catch (err) {
        try { fs.unlinkSync(tmp); } catch { /* nothing to remove, or it is the unwritable path itself */ }
        throw err;
    }
}

// Read `length` bytes from `position`, looping until the buffer is full or the
// file ends: a single readSync may legally return fewer bytes than asked for,
// and treating a short read as the whole tail would cut the NEWEST line in half
// and then append onto the fragment.
function readFully(fd, position, length) {
    const buf = Buffer.alloc(length);
    let filled = 0;
    while (filled < length) {
        const n = fs.readSync(fd, buf, filled, length - filled, position + filled);
        if (n <= 0) break;
        filled += n;
    }
    return buf.toString('utf8', 0, filled);
}

// Rewrite the log to its newest GATE_LOG_KEEP_BYTES. The tail is taken at a
// byte offset, which lands mid-line and possibly mid-character, so everything
// up to and including the first newline is discarded: what survives is whole
// lines only, which is what lets a reader parse every line it finds. The
// rewrite goes through a tmp file and a rename, so a failure leaves the old log
// intact rather than truncated.
//
// A rewrite that would keep NOTHING is refused: the file is left exactly as it
// is. That is the degenerate case of a line longer than the keep bound, which
// nothing here writes but a hand-edited or foreign file can hold, and it
// arrives in two shapes: a tail with no line break in it at all, and one whose
// only break is the terminator at its very end. Both would trade the whole log
// for an empty file, and an oversized log is a far smaller problem than a
// destroyed one. The append that follows still lands.
function trimGateLog(logPath, size) {
    const fd = fs.openSync(logPath, 'r');
    let text;
    try {
        text = readFully(fd, size - GATE_LOG_KEEP_BYTES, GATE_LOG_KEEP_BYTES);
    } finally {
        try { fs.closeSync(fd); } catch { /* already closed */ }
    }
    const nl = text.indexOf('\n');
    const kept = nl === -1 ? '' : text.slice(nl + 1);
    if (kept === '') return;
    const tmp = atomicTmpPath(logPath);
    try {
        fs.writeFileSync(tmp, kept, { encoding: 'utf8', flag: 'wx' });
        fs.renameSync(tmp, logPath);
    } catch (err) {
        try { fs.unlinkSync(tmp); } catch { /* nothing to remove, or it is the unwritable path itself */ }
        throw err;
    }
}

// Is this path writable, or absent? Absent is fine: the write creates it. Any
// other refusal (a read-only file, a permission, a lock) is not, and is the
// case a caller must be able to see BEFORE it promises anything about a record
// landing.
function writableOrAbsent(target) {
    try {
        fs.accessSync(target, fs.constants.W_OK);
        return true;
    } catch (err) {
        return !!(err && err.code === 'ENOENT');
    }
}

// Everything that must hold before a decision can be recorded, in one place,
// because two callers need the same answer: the writer, which refuses to write,
// and the projection behind the gate's stderr note, which refuses to promise a
// count that will never be stored. Split, they drift, and the drift has a
// specific shape: the note reporting "held 1 offer over 0 minutes" on the fifth
// deny and the five hundredth, because the state never advanced and each
// projection re-derived the same first step from the same unchanged file. A
// stuck number reads exactly like a mechanism working.
//
// Returns { ok:true, statePath, logPath, logSize, prior } or { ok:false }.
//
// It cannot promise the write will succeed, only that nothing already known
// stops it: a disk that fills between here and the rename still throws, and
// that residual is caught and swallowed like any other. What it does cover is
// every condition that PERSISTS across offers, which is the set that turns one
// wrong sentence into the same wrong sentence forever.
function gateRecordTargets(cwd) {
    try {
        const kit = path.join(cwd, '.kit');
        let dir;
        try { dir = fs.lstatSync(kit); } catch { return { ok: false }; }
        if (!dir.isDirectory() || !writableOrAbsent(kit)) return { ok: false };
        const statePath = gateStatePath(cwd);
        const logPath = gateLogPath(cwd);
        if (regularFileSize(statePath) === null || !writableOrAbsent(statePath)) return { ok: false };
        const logSize = regularFileSize(logPath);
        if (logSize === null || !writableOrAbsent(logPath)) return { ok: false };
        const prior = readGateStateResult(cwd);
        if (!prior.ok) return { ok: false };
        return { ok: true, statePath, logPath, logSize, prior: prior.state };
    } catch {
        return { ok: false };
    }
}

// Record one gate decision: rewrite the state and append one line to the log.
//
// Returns nothing, and that is the design rather than an omission. The gate
// calls this once its verdict is already announced, and a caller able to see
// whether the write landed is a caller able to decide differently because of
// it; the record must never be in a position to move a compaction. Every
// failure is swallowed for the same reason, so an unwritable .kit/ leaves the
// verdict, the exit code, and the stderr note exactly as they would have been.
//
// Every refusal is gateRecordTargets', shared with the projection behind the
// gate's note so the two cannot disagree about whether a record can land.
//
// The state is authoritative and the log is the journal. The state is written
// first, and a refusal or a failure there abandons the line too, so the log
// never counts a denial the state does not know about. The reverse is NOT
// guarded: once the state has advanced, a throw from the trim or the append
// loses that line, so the log can undercount what the state has counted. That
// asymmetry is deliberate, and this is the direction to prefer, because an
// operator reading the log to answer "how often" can survive a missing line,
// while a state that disagrees with its own journal about an open episode is
// what every consumer decides from.
//
// Concurrency: two gate processes in one project both read a count and both
// write its successor, so a denial can be lost from the count as well as from
// the log. There is no lock. The single-writer reality (one bound session
// producing boundary denies) makes it rare, the failure is an undercount, and a
// diagnostic does not earn a lock file.
function recordGateDecision(cwd, decision) {
    try {
        const record = gateRecord(decision);
        if (!record) return;
        // The writer stamps the time, never the caller: `at` is what every age
        // in the status report and the deferral note is measured from, so it
        // has to come from one clock rather than from a value passed in.
        record.at = new Date().toISOString();

        const targets = gateRecordTargets(cwd);
        if (!targets.ok) return;
        const { statePath, logPath, logSize, prior } = targets;

        writeJsonAtomic(statePath, nextGateState(prior, record));
        if (logSize > GATE_LOG_MAX_BYTES) trimGateLog(logPath, logSize);
        // One append of one line: a line is written whole or not at all, so a
        // reader never meets a half-written record. A log that does not already
        // end on a line boundary (hand-edited, or truncated by a crash) gets the
        // break first, so the append cannot fuse two records into one line that
        // parses as neither.
        const prefix = endsOnLineBoundary(logPath) ? '' : '\n';
        fs.appendFileSync(logPath, prefix + JSON.stringify(record) + '\n', 'utf8');
    } catch { /* diagnostic only: a decision that cannot be recorded is still taken */ }
}

// Does this file end on a line boundary? True for an empty or absent file,
// which needs no separator. Reads the final byte alone: the answer is one byte
// long and the file can be megabytes.
function endsOnLineBoundary(target) {
    const size = regularFileSize(target);
    if (size === null || size === 0) return true;
    const fd = fs.openSync(target, 'r');
    try {
        const buf = Buffer.alloc(1);
        const read = fs.readSync(fd, buf, 0, 1, size - 1);
        return read !== 1 || buf[0] === 0x0A;
    } finally {
        try { fs.closeSync(fd); } catch { /* already closed */ }
    }
}

// ---------------------------------------------------------------------------
// Shared transcript reading.
// ---------------------------------------------------------------------------

// Read a transcript with a size cap: for a large file, the head plus tail. The
// evidence each consumer scans for can land near either end of a long-running
// session: the arming invocation and any re-arm for the goal leash, and for
// the gate's automation scan a /loop invocation's first user line (head)
// beside the newest goal_status record (tail). It is the goal leash's reader
// and the automation scan's above-ceiling fallback (see
// readTranscriptForAutomation, which owns why the fallback is not that scan's
// primary read). Returns '' on any error or a non-regular file, whatever the
// size. The isFile check narrows, without closing, the window in which the
// path could be swapped for a FIFO between the stat and the open (a blocking
// read on a FIFO hangs, which no try/catch can rescue): both read branches
// re-resolve the path after the stat. The residual is accepted because
// exploiting it needs write access to the transcript's directory, which
// already implies control of the transcript contents themselves.
function readTranscriptCapped(transcriptPath) {
    try {
        const st = fs.statSync(transcriptPath);
        if (!st.isFile()) return '';
        const HEAD = 384 * 1024;
        const TAIL = 128 * 1024;
        if (st.size <= 512 * 1024) {
            return fs.readFileSync(transcriptPath, 'utf8');
        }
        const fd = fs.openSync(transcriptPath, 'r');
        try {
            const head = Buffer.alloc(HEAD);
            const hb = fs.readSync(fd, head, 0, HEAD, 0);
            const tail = Buffer.alloc(TAIL);
            const tb = fs.readSync(fd, tail, 0, TAIL, st.size - TAIL);
            return head.toString('utf8', 0, hb) + '\n' + tail.toString('utf8', 0, tb);
        } finally {
            try { fs.closeSync(fd); } catch { /* already closed */ }
        }
    } catch {
        return '';
    }
}

// Remove local-command output and caveat blocks from user-slot text. When a user
// runs a slash command the CLI echoes its stdout (and a caveat) back into the
// user turn inside <local-command-stdout>/<local-command-caveat> wrappers; that
// is the CLI's own output, not something the user typed, so it must not bind the
// leash (e.g. /kit-goal status prints the armed plan path, and a catted file or
// grep hit can echo a literal <command-args> string as data). The deliberate
// slash-command invocation record (<command-name>/<command-args>) is NOT
// stripped: the plan path a user types as a command argument is exactly how the
// arming session claims the binding. A close tag counts only when it names the
// same wrapper as its opener, so a coincidental mismatched-name closing tag
// inside real output cannot terminate the strip early and leave the rest of that
// output, or content past it, looking like ordinary typed text. The paired strip
// is greedy: it runs to the LAST same-name close tag in the entry, so echoed
// output that embeds a literal same-name close tag followed by a fake
// <command-name>/<command-args> claim cannot end the strip early and expose that
// claim. The accepted trade-off is that genuine typed text sitting between two
// same-name blocks in one entry is over-stripped, which errs toward NOT claiming
// (the safe direction). An opener with no matching closer anywhere in the
// (possibly capped) text is a truncated echo (cut by the read cap, or caught
// mid-write); it is stripped to end-of-text rather than left holding whatever it
// happened to contain.
//
// The implementation is a linear scan (one pass recording the last close tag
// per wrapper name, one pass over the openers) rather than a backtracking
// regex: this runs on user-slot text on per-turn hook paths, and a crafted
// entry dense with unmatched openers must cost milliseconds, not seconds (a
// greedy-with-backreference regex restarts an O(n) backtrack at every such
// opener, which is quadratic). The gate test suite pins both the semantics
// (differentially, against the regex form as a reference) and the bound.
function stripLocalCommandOutput(text) {
    // One forward pass records the LAST close tag per wrapper name, so the
    // opener loop below never rescans the text. Tags are matched
    // case-insensitively and pair across case, hence the case-folded map key;
    // the emitted text is always sliced from the original.
    const lastClose = new Map();
    const closeRe = /<\/local-command-([a-z]+)>/gi;
    let c;
    while ((c = closeRe.exec(text))) {
        lastClose.set(c[1].toLowerCase(), { start: c.index, end: c.index + c[0].length });
    }
    const openRe = /<local-command-([a-z]+)>/gi;
    let out = '';
    let pos = 0;
    for (;;) {
        openRe.lastIndex = pos;
        const m = openRe.exec(text);
        if (!m) return out + text.slice(pos);
        out += text.slice(pos, m.index) + ' ';
        const close = lastClose.get(m[1].toLowerCase());
        if (close && close.start >= m.index + m[0].length) {
            // Paired: strip to the LAST same-name close (greedy). Anything
            // between two same-name blocks, openers of other names included,
            // goes with the span, exactly as the greedy pairing implies.
            pos = close.end;
        } else {
            // Unmatched: stripped to end-of-text.
            return out;
        }
    }
}

// Every <command-args>...</command-args> span in the given text, in order:
// each span runs from an opener to the FIRST close after it, and scanning
// resumes past that close, the same non-overlapping enumeration a global lazy
// regex produces, but as linear literal scans (a lazy [\s\S]*? span restarts
// an O(n) walk at every unclosed opener, which is quadratic on crafted text
// and measured in whole seconds at the transcript read cap). Tags match
// case-insensitively. Spans are returned raw: callers own their
// normalization. An unclosed trailing opener contributes no span. Shared by
// userCommandArgsInclude below (which searches every span) and the gate's
// automation detection (which reads the first span only); the two must
// enumerate identically, which is why there is exactly one scanner.
function commandArgsSpans(text) {
    const spans = [];
    const openRe = /<command-args>/gi;
    const closeRe = /<\/command-args>/gi;
    let pos = 0;
    for (;;) {
        openRe.lastIndex = pos;
        const o = openRe.exec(text);
        if (!o) return spans;
        closeRe.lastIndex = o.index + o[0].length;
        const c = closeRe.exec(text);
        if (!c) return spans;
        spans.push(text.slice(o.index + o[0].length, c.index));
        pos = c.index + c[0].length;
    }
}

// Extract genuine user-typed text from a user message (a string content, or
// {type:'text'} blocks), strip local-command output, and test whether it is a
// kit-goal invocation that carries the needle. Two shapes count, checked in
// order on the same stripped text:
//   1. Harness markup: a <command-args> span carries the needle, and the same
//      content carries a <command-name> whose value is exactly '/kit-goal' or
//      ends with ':kit-goal' (the plugin-namespaced form, e.g.
//      '/claude-kit:kit-goal'), so another command that legitimately takes a
//      path argument (e.g. /graphify docs/plans/<plan>.md) cannot steal the
//      binding from the arming session.
//   2. Typed lead: the message's first non-whitespace characters are the
//      /kit-goal command token (optionally plugin-namespaced, any number of
//      ':'-joined segments, agreeing with the markup path's ':kit-goal'
//      suffix rule) followed by a token boundary, and the needle sits inside
//      the argument block that follows the token: the text up to the first
//      line that is blank (whitespace-only), or whose first non-whitespace
//      character is a backtick or '<'. A blank line ends a typed argument
//      list; a fence or tag line opens quoted or injected material, which
//      must never supply the needle; the one-plan-per-line arming shape
//      stays fully inside the block. The harness writes the markup shape
//      only when the command and its arguments share the message's first
//      line; a multi-line /kit-goal with one plan path per line lands as
//      plain prose, and this shape is what makes that arming claimable. The
//      lead anchor plus the block boundary are the anti-steal control: a
//      prose or code-fence lead never anchors, and a mention of the armed
//      plan behind a blank line, a fence, or a tag line inside a lead-token
//      message never supplies the needle. The shape is deliberately looser
//      than the harness's own parsing in exactly two ways, both confined to
//      hand-typed text: the token is case-insensitive (case variance in
//      typing is plausible and harmless), and the block spans lines (the
//      multi-line arming is this shape's whole reason to exist); the harness
//      itself would take only the first line and the exact case.
// Separators are normalized to '/' so a Windows-style reference matches the
// forward-slash plan path. tool_use and tool_result blocks are ignored: they
// carry tool I/O, which can echo the plan path outside any command invocation.
function userCommandArgsInclude(message, needle) {
    if (!message) return false;
    const c = message.content;
    let text = '';
    if (typeof c === 'string') {
        text = c;
    } else if (Array.isArray(c)) {
        // A tool block discards the WHOLE entry rather than being filtered out of
        // it, taking userTypedText's whole-entry reading in this file and going one
        // step stricter: that one discards on a tool_result, this one on either
        // tool block. A claim is an authorization
        // decision, so an entry mixing genuine user text with tool output is one
        // where planted markup could ride beside a real turn, and the stricter
        // of the two readings is the one that belongs on the deciding side.
        for (const b of c) {
            if (b && (b.type === 'tool_result' || b.type === 'tool_use')) return false;
        }
        for (const b of c) {
            if (b && b.type === 'text' && typeof b.text === 'string') text += '\n' + b.text;
        }
    } else {
        return false;
    }
    const strippedRaw = stripLocalCommandOutput(text);
    // Markup shape, on the separator-normalized whole: command-args spans are
    // matched by substring and the needle is a forward-slash path. EVERY span
    // is searched, not just the first: a real invocation can carry more than
    // one <command-args> span, and the plan path counts wherever it rides.
    // The enumeration is this file's linear scanner (commandArgsSpans).
    const stripped = strippedRaw.replace(/\\/g, '/');
    const nameMatch = /<command-name>([^<]*)<\/command-name>/i.exec(stripped);
    if (nameMatch) {
        const name = nameMatch[1].trim();
        if (name === '/kit-goal' || name.endsWith(':kit-goal')) {
            for (const span of commandArgsSpans(stripped)) {
                if (span.includes(needle)) return true;
            }
        }
    }
    // Typed-lead shape, evaluated only when the markup shape did not match.
    // Anchored against the stripped but UN-normalized text: the token is a
    // command, not a path, so a literal '\kit-goal' lead (which the harness
    // would never execute) must not normalize into a claiming '/kit-goal'.
    // The lookahead is the token boundary, so /kit-goal-notes.md never
    // matches; the (?:[\w-]+:)* prefix accepts the plugin-namespaced form,
    // multi-segment included, agreeing with the markup path's ':kit-goal'
    // suffix rule. Case-insensitive, unlike the markup path's exact name
    // comparison: this shape matches hand-typed text, where case variance is
    // plausible and harmless, while the markup name is harness-written and
    // exact.
    const lead = strippedRaw.trimStart();
    const leadMatch = /^\/(?:[\w-]+:)*kit-goal(?=\s|$)/i.exec(lead);
    if (!leadMatch) return false;
    // The needle counts only inside the argument block: the text from just
    // after the token up to the first line that is blank (whitespace-only),
    // or whose first non-whitespace character is a backtick or '<'. A blank
    // line ends a typed argument list; a fence or tag line opens quoted or
    // injected material, which must never supply the needle; the
    // one-plan-per-line arming shape stays fully inside the block. The
    // array-content path above concatenates every text block with '\n'
    // separators, so an appended second text block continues the argument
    // block only if nothing terminates it first: the '<' terminator is what
    // cuts an injected tag-shaped block. The token line's own tail is part
    // of the block even when empty (a token followed directly by a newline
    // is the multi-line arming's normal head); only a terminator character
    // ends the block there. Separator normalization applies to the block
    // alone, for the path comparison.
    const restLines = lead.slice(leadMatch[0].length).split('\n');
    let block = '';
    for (let i = 0; i < restLines.length; i++) {
        const t = restLines[i].trim();
        if (i > 0 && t === '') break;
        if (t !== '' && (t[0] === '`' || t[0] === '<')) break;
        block += restLines[i] + '\n';
    }
    return block.replace(/\\/g, '/').includes(needle);
}

// Scoping predicate for an unbound goal: does this session's transcript show the
// user typing the armed plan path as a /kit-goal argument? Matches the full
// repo-relative plan path (e.g. docs/plans/foo.md), separator-normalized, and
// only in one of userCommandArgsInclude's two invocation shapes of a USER entry
// (the arming invocation, including a re-arm after a crash): inside a
// <command-args>...</command-args> span of a kit-goal invocation, or inside
// the argument block of a typed /kit-goal lead (the block boundary is
// userCommandArgsInclude's; never past it). A plain prose mention of the path never claims:
// without this, any bystander session that happens to type or discuss the path
// (or that echoes it back, e.g. reading the session-start goal surfacing aloud)
// could steal the binding from the session actually working the plan.
// Deliberate exclusions:
//   - Assistant entries are skipped entirely: an assistant echo of the plan path
//     must never self-leash the session.
//   - isMeta entries are skipped: harness-injected records (e.g. the Stop
//     hook's own block reason, replayed back as "Stop hook feedback: ...") land
//     in the transcript as a user-type entry but are not something the user
//     typed, and the Stop hook's reason text names the plan path in full.
//   - Attachment and tool_result entries are skipped: the session-start
//     surfacing injects the plan path into EVERY session's transcript as an
//     attachment, and tool output can echo it, neither of which is the user
//     working the plan.
//   - Local-command output inside a user turn is stripped before the
//     <command-args> scan (the CLI's own echo of a slash command's stdout could
//     otherwise carry a literal, fake <command-args> string as quoted data),
//     and sub-agent (sidechain) turns do not count.
//   - The typed-lead shape anchors at the message's first non-whitespace
//     characters and reads the needle only from the argument block that
//     follows the token: a mid-message or quoted /kit-goal (prose before it,
//     a code fence around it) never claims, and a mention of the armed plan
//     behind a blank line, a fence, or a tag line inside a lead-token
//     message never claims either, so quoting or discussing an arming
//     command, or arming a DIFFERENT plan while mentioning this one, is not
//     arming this plan.
//   - It matches the dir-qualified path, not just the basename, so a session
//     that merely names a same-basename file is not leashed.
// False if there is no path or it is unreadable: a session we cannot scope is
// never leashed.
function userCommandArgsClaimPlan(transcriptPath, planRel) {
    try {
        if (!transcriptPath || !planRel) return false;
        const needle = String(planRel).replace(/\\/g, '/');
        const content = readTranscriptCapped(transcriptPath);
        if (!content) return false;
        const lines = content.split('\n');
        for (const line of lines) {
            const t = line.trim();
            if (!t) continue;
            let entry;
            try { entry = JSON.parse(t); } catch { continue; }
            if (!entry || entry.type !== 'user' || entry.isSidechain || entry.isMeta === true
                || entry.isCompactSummary === true) continue;
            if (userCommandArgsInclude(entry.message, needle)) return true;
        }
        return false;
    } catch {
        return false;
    }
}

// ---------------------------------------------------------------------------
// Automation detection for the PreCompact gate's interactive-deferral clause.
//
// The gate defers auto-compaction to the safety ceiling only when the session
// is a human interacting directly; a session driven by native /goal or /loop
// keeps the harness's early trigger. The transcript is the detection surface,
// and the shapes read here are undocumented harness output, the same class as
// the gate's other version-pinned facts: real-transcript observations, except
// the /goal clear argument shape, which follows from the invariant command
// markup and fails safe if wrong (an unrecognized clear leaves the newest
// evidence at met:false and the session on the early trigger). Detection
// errs toward "automated" only via absent evidence never arriving (a loop
// that stops being continued classifies automated indefinitely); every read
// or parse defect classifies as no evidence, and the gate turns that into a
// verdict whose failure direction is the early-trigger status quo.
// ---------------------------------------------------------------------------

// The literal command-name tags a typed /goal or /loop invocation writes. The
// FULL tag is load-bearing: a continuing ScheduleWakeup carries the loop's
// prompt verbatim, so a bare '/loop' substring appears in every wakeup and
// would read each one as a fresh invocation.
const GOAL_COMMAND_TAG = '<command-name>/goal</command-name>';
const LOOP_COMMAND_TAG = '<command-name>/loop</command-name>';

// Extract the genuinely user-typed text of a user entry's message: a string
// content, or the concatenated {type:'text'} blocks of an array content.
// Returns null when there is none, and null for an array carrying any
// tool_result block: tool output is the observed source of quoted command
// markup (a file containing the literal tags, read back into the session),
// and the harness's own /loop detector excludes exactly this shape, so the
// whole entry is discarded rather than trusting its text blocks.
function userTypedText(message) {
    if (!message) return null;
    const c = message.content;
    if (typeof c === 'string') return c;
    if (!Array.isArray(c)) return null;
    let text = '';
    for (const b of c) {
        if (b && b.type === 'tool_result') return null;
        if (b && b.type === 'text' && typeof b.text === 'string') text += '\n' + b.text;
    }
    return text;
}

// Scan transcript text for evidence that native /goal or /loop is driving the
// session. Returns true when either is in effect by the NEWEST evidence of
// its kind: transcripts are append-ordered, so a single forward pass letting
// the last match of each kind win reads newest-wins for free (the real
// end-of-loop sequence is /loop lines followed by a terminal stop, after
// which the session continues as ordinary interactive work).
//
// Evidence, per instrument:
//   /goal, surface 1: a goal_status attachment (type 'attachment', its
//     attachment.type 'goal_status'), which the goal system writes at arming
//     and at every stop evaluation. met === false means in effect; met ===
//     true means satisfied and auto-cleared, so not. Only a strict boolean
//     met decides; sentinel and reason are carried but decide nothing (a
//     real record carries met:true beside sentinel:true).
//   /goal, surface 2: a user command line whose <command-name> is exactly
//     /goal. <command-args> trimmed and lowercased equal to 'clear' means
//     not in effect; any other non-empty argument means in effect; a bare
//     /goal (empty args) reads state and decides nothing.
//   /loop: a user command line whose <command-name> is exactly /loop means
//     in effect; an assistant ScheduleWakeup tool_use whose input.stop is
//     strictly true means the loop ended. A continuing wakeup (delaySeconds,
//     prompt, ...) decides nothing: every iteration of a dynamic loop
//     re-writes its own /loop command line, so the positive evidence
//     refreshes without it.
//
// Tag order in a command line is not fixed (/loop writes <command-message>
// before <command-name>, /goal the other way), so each tag is matched by its
// own independent regex, first tag of each kind winning within the entry.
//
// Exclusions, adopted from the harness's own /loop detector, each defeating
// an observed false positive (quoted markup rides in tool output whenever a
// file containing the tags is read into a session):
//   - a raw line containing the quoted JSON form "tool_result" (quotes
//     included, the same discriminator the harness's detector uses) is never
//     a command line; the bare substring would also skip a genuine typed
//     command whose argument text merely mentions tool_result;
//   - a command line must be entry.type 'user', the wakeup entry.type
//     'assistant';
//   - isMeta, isCompactSummary, and sidechain entries are skipped;
//   - array content holding any tool_result block discards the entry
//     (userTypedText above);
//   - local-command output is stripped before the tag scan (a /goal
//     invocation's own stdout is echoed back inside <local-command-stdout>
//     carrying the full goal condition text);
//   - the ScheduleWakeup check is structural, never a substring (the tool
//     listing rides in system-prompt-shaped entries, so the bare name
//     appears in transcripts with no real invocation).
//
// String prefilters run before any JSON.parse so a multi-megabyte scan costs
// milliseconds; an unparseable line is skipped, no evidence.
function automationInEffect(text) {
    let goalInEffect = null;
    let loopInEffect = null;
    const lines = text.split('\n');
    for (const line of lines) {
        const t = line.trim();
        if (!t) continue;
        const rawToolResult = t.includes('"tool_result"');
        const mayGoalStatus = t.includes('"goal_status"');
        const mayGoalLine = !rawToolResult && t.includes(GOAL_COMMAND_TAG);
        const mayLoopLine = !rawToolResult && t.includes(LOOP_COMMAND_TAG);
        const mayWakeup = t.includes('tool_use') && t.includes('ScheduleWakeup');
        if (!mayGoalStatus && !mayGoalLine && !mayLoopLine && !mayWakeup) continue;
        let entry;
        try { entry = JSON.parse(t); } catch { continue; }
        if (!entry || typeof entry !== 'object') continue;
        if (entry.isSidechain || entry.isMeta === true || entry.isCompactSummary === true) continue;

        if (mayGoalStatus && entry.type === 'attachment'
                && entry.attachment && typeof entry.attachment === 'object'
                && entry.attachment.type === 'goal_status') {
            if (entry.attachment.met === false) goalInEffect = true;
            else if (entry.attachment.met === true) goalInEffect = false;
            continue;
        }

        if ((mayGoalLine || mayLoopLine) && entry.type === 'user') {
            const typed = userTypedText(entry.message);
            if (typed === null) continue;
            const stripped = stripLocalCommandOutput(typed);
            const nameMatch = /<command-name>([^<]*)<\/command-name>/i.exec(stripped);
            if (!nameMatch) continue;
            const name = nameMatch[1].trim();
            if (name === '/loop') {
                loopInEffect = true;
            } else if (name === '/goal') {
                // The first <command-args> span decides (first tag wins, the
                // convention every command-line reader here follows); no span
                // at all, an unclosed opener included, decides nothing.
                const spans = commandArgsSpans(stripped);
                const args = spans.length > 0 ? spans[0].trim().toLowerCase() : '';
                if (args === 'clear') goalInEffect = false;
                else if (args !== '') goalInEffect = true;
            }
            continue;
        }

        if (mayWakeup && entry.type === 'assistant') {
            const content = entry.message && entry.message.content;
            if (!Array.isArray(content)) continue;
            for (const b of content) {
                if (b && b.type === 'tool_use' && b.name === 'ScheduleWakeup'
                        && b.input && typeof b.input === 'object'
                        && b.input.stop === true) {
                    loopInEffect = false;
                }
            }
        }
    }
    return goalInEffect === true || loopInEffect === true;
}

// The byte ceiling on reading a transcript whole for the automation scan.
//
// Newest-evidence-wins only holds over bytes actually read, so the scan wants
// the whole file: a head-plus-tail read leaves an unread middle, and a loop
// whose terminating stop lands there shows its opening /loop line and nothing
// that retires it, classifying a session that has been hands-on for hours as
// automation-driven. That is the exact case the deferral exists to serve, and
// it is the common one, because a session keeps working for as long as it
// likes after its loop ends.
//
// 64 MB scans a whole multi-day session (the largest transcripts observed run
// to 57 MB) with headroom, and the cost is linear and bounded: at that size
// the read plus classification is roughly 150 ms and 175 MB of peak resident
// memory in this short-lived hook process, which runs only when the harness
// is already offering a compaction. Past the ceiling the head-plus-tail
// reader takes over, so a runaway or hostile file costs the same 512 KB it
// always did; the unread middle comes back with it, and the misread it can
// produce degrades to the early trigger, never to a wedged session.
const AUTOMATION_READ_MAX_BYTES = 64 * 1024 * 1024;

// Read a transcript for the automation scan: the whole file at or below
// AUTOMATION_READ_MAX_BYTES, the head-plus-tail read above it. Returns '' on
// any error or a non-regular file, which classifies as no evidence. The
// isFile check narrows the same FIFO-swap window readTranscriptCapped
// documents, and on the same accepted residual: a blocking read on a FIFO
// hangs where no try/catch can rescue it, and the path is re-resolved after
// the stat either way.
function readTranscriptForAutomation(transcriptPath) {
    try {
        const st = fs.statSync(transcriptPath);
        if (!st.isFile()) return '';
        if (st.size > AUTOMATION_READ_MAX_BYTES) return readTranscriptCapped(transcriptPath);
        return fs.readFileSync(transcriptPath, 'utf8');
    } catch {
        return '';
    }
}

// Does the transcript at this path show a native automation instrument
// driving the session? A missing path, an unreadable or non-regular file, or
// any escape reads as no evidence (false); the caller's valve leg reads the
// same file, so an unreadable transcript also yields no consumed-token
// reading and the gate's verdict on it is allow.
function transcriptShowsAutomation(transcriptPath) {
    try {
        if (!transcriptPath) return false;
        const text = readTranscriptForAutomation(transcriptPath);
        if (!text) return false;
        return automationInEffect(text);
    } catch {
        return false;
    }
}

module.exports = {
    checkpointPath, readCheckpoint, writeCheckpoint, clearCheckpoint,
    checkpointMatches, sameSessionId,
    CHECKPOINT_MAX_AGE_MS, CHECKPOINT_FUTURE_SKEW_MS,
    gateStatePath, gateLogPath, readGateState, readGateStateResult, recordGateDecision,
    gateEpisodeOpen, projectGateEpisode, episodePhrase, wholeMinutesSince,
    readTranscriptCapped, stripLocalCommandOutput, commandArgsSpans,
    userCommandArgsClaimPlan,
    automationInEffect, transcriptShowsAutomation
};
