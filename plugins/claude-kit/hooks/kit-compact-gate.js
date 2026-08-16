#!/usr/bin/env node
// PreCompact hook (auto matcher): boundary-gated compaction.
//
// Native auto-compaction lands wherever context happens to fill, which on a
// leashed plan run means mid-section, at the point of maximum lost state. The
// only native lever is this hook's power to veto a pending compaction (a
// denied auto attempt is re-tried once per assistant turn, indefinitely), so
// the kit uses the veto as a scheduler: deny auto-compaction mid-chapter,
// stand aside once the chapter-close ritual has written a boundary checkpoint
// (.kit/compact-checkpoint.json, via kit-compact-checkpoint.js), and the
// compaction lands on the first attempt after the boundary. The kit summarizes
// nothing itself; re-grounding after the compaction is the existing
// SessionStart plan-doc recovery.
//
// The verdict mechanics are exit-code only, a harness fact pinned to a
// version because it can change upstream: on Claude Code 2.1.233 the harness
// honors an exit-code-2 deny (observed live against the real harness: 19
// consecutive auto-compaction attempts denied by this gate, no compaction
// landing, and a matching checkpoint then landing one with the session id
// preserved across it), while the JSON {"decision":"deny"} form is inert for
// PreCompact on that version (the compaction proceeds as if allowed, with no
// error anywhere), so nothing here is built on it. Every allow is a plain
// exit 0, and the allow path emits
// nothing at all: everything this hook reads (the payload, the goal state, the
// checkpoint, the transcript) is untrusted data, and the cheapest way to keep
// it out of a model's context is to print none of it. The deny path writes one
// fixed string to stderr, carrying no data from any input.
//
// The gate is a strict no-op (allow) in every state except one. It denies only
// when ALL of these hold, evaluated cheapest first:
//   1. The payload's trigger is 'auto'. The hooks.json matcher already scopes
//      this; the in-code check makes a later matcher edit unable to silently
//      widen the gate. Manual /compact is never gated.
//   2. KIT_EXTERNAL_ENGINE is not '1'. An external engine spawns a fresh
//      worker per section, so there is no mid-chapter context to protect:
//      stand down (same marker as branch-reaper-nudge.js and hook-canary.js).
//   3. A kit goal is armed for the project (.kit/goal-state.json has a plan).
//   4. The compacting session IS the leash-bound session: payload session_id
//      equals the goal's boundSession, compared as opaque case-insensitive
//      trimmed strings. An armed-but-unbound goal is not a match: a bystander
//      session is never gated, and the bound session keeps matching across a
//      compaction because the harness preserves the session id.
//   5. No boundary checkpoint is open. A checkpoint matches only when its
//      recorded plan equals the armed goal's plan, its recorded boundSession
//      equals the goal's current boundSession, AND it is fresh (opened within
//      CHECKPOINT_MAX_AGE_MS, which lives with the shared match rule in
//      kit-compact-lib.js); anything else is treated as absent. The plan
//      match retires a stale file from a prior run, and the session match
//      retires an orphan from a crashed run: a checkpoint written just before
//      a crash names the same plan, but the resumed session re-binds under a
//      new id, so the orphan must not open the gate for its first mid-chapter
//      compaction. The normal path keeps matching because the harness
//      preserves the session id across a compaction. The age bound retires
//      the ordinary same-run leftover the other two cannot: the chapter-close
//      ritual opens a checkpoint at EVERY boundary, and a boundary reached
//      below the trigger has no compaction offer to catch, so its checkpoint
//      would otherwise sit open until the NEXT chapter crossed the trigger
//      mid-section and be honored there, landing the compaction mid-chapter
//      (the exact placement the gate exists to prevent) on every cycle after
//      the first. A boundary reached above the trigger needs only seconds:
//      past the trigger the harness re-offers a compaction every assistant
//      turn, so a real boundary checkpoint is consumed almost immediately and
//      the age bound never touches it. A checkpoint with no boundSession
//      field or no legible openedAt (written by an older version, or
//      hand-made) is a mismatch, the fail-open-toward-status-quo direction.
//      When a MATCHING checkpoint is
//      open the hook allows and consumes (deletes) it before exiting, so the
//      next mid-chapter attempt is denied again: consumption is single-shot,
//      and it happens only on this checkpoint-driven allow. Allowing for any
//      other reason (no goal, bystander, external engine, valve) leaves the
//      file alone, because those allows are not the boundary firing and
//      consuming there would burn a checkpoint the run still needs. The
//      checkpoint check runs before the valve read (it is the cheaper of the
//      two, and a boundary that has been reached should land the compaction
//      and retire its checkpoint whatever the token count says).
//   6. The consumed-token reading from the transcript is legible AND strictly
//      below SAFETY_CEILING_TOKENS. This is the safety valve: a denied auto
//      attempt retries forever, so sustained denial with a chapter that never
//      closes would otherwise climb to the model's hard limit and kill the
//      session with "Prompt is too long". At or above the ceiling the gate
//      allows regardless of the checkpoint. The PreCompact payload carries no
//      usage field, so the reading comes from the transcript at the payload's
//      transcript_path: the newest main-thread assistant usage row, summed as
//      input_tokens + cache_creation_input_tokens + cache_read_input_tokens
//      (monotonic across a session, so a rising-signal ceiling check is
//      sound).
//
// Any other state, any read error, any ambiguity: allow. This is the same
// fail-open posture as kit-goal-stop.js. A forgotten checkpoint degrades to
// "compaction lands late, mid-chapter" (the pre-gate status quo); an
// unreadable transcript, an unparseable payload, a missing goal file, or a
// filesystem error must never wedge a session against the context limit. A
// bug anywhere allows, so the hook never converts a scheduling nicety into a
// dead run.

'use strict';

const fs = require('fs');
const { readGoal } = require('./kit-goal-lib.js');
const { readCheckpoint, clearCheckpoint, checkpointMatches, sameSessionId } = require('./kit-compact-lib.js');

// The valve ceiling, in consumed tokens.
//
// ASSUMPTION, named because it is the one direction of this design that is
// not fail-open: this is an absolute token count sized for the roughly
// 1,000,000-token window the models that run leashed plan sessions carry. The
// PreCompact payload provides no model field (only SessionStart does), so the
// window cannot be derived at fire time. On a model with a SMALLER window the
// ceiling sits above the hard limit, the valve never fires, and sustained
// denial kills the bound session outright. Nothing detects that state; the
// doctor's window check reads the configured autoCompactWindow, which says
// nothing about the running model's real window.
//
// Arithmetic. The ceiling has two jobs and the tighter one sets the value.
// Its hard job is preventing a dead run: a denied attempt is re-offered every
// turn and never forced, so without a valve the context climbs to the model's
// limit and the session dies with "Prompt is too long", which was observed
// live. Its softer job is landing the compaction before a run gets bad, and
// quality is observed degrading through the 700,000 to 800,000 band. Sitting
// at the bottom of that band satisfies both with roughly 200,000 tokens of
// headroom under the limit, which absorbs the two mechanics that compound
// against the margin: the reading is one turn STALE (the newest usage row
// reflects the previous turn's request), and a denied attempt is re-evaluated
// only once per turn, so the true margin from a deny decision to the limit is
// two turns of growth rather than one.
const SAFETY_CEILING_TOKENS = 800000;

function readStdin() {
    try { return fs.readFileSync(0, 'utf8'); } catch { return ''; }
}

// Read the transcript's tail with a size cap. The valve only needs the newest
// usage row, which sits within a few lines of the file's end, so unlike
// kit-goal-stop's head+tail read this one takes the tail alone. Returns '' on
// any error or a non-regular file (a blocking read on a FIFO would hang,
// which no try/catch can rescue).
function readTranscriptTail(transcriptPath) {
    try {
        const st = fs.statSync(transcriptPath);
        if (!st.isFile()) return '';
        const CAP = 1024 * 1024;
        if (st.size <= CAP) {
            return fs.readFileSync(transcriptPath, 'utf8');
        }
        const fd = fs.openSync(transcriptPath, 'r');
        try {
            const buf = Buffer.alloc(CAP);
            const bytes = fs.readSync(fd, buf, 0, CAP, st.size - CAP);
            return buf.toString('utf8', 0, bytes);
        } finally {
            try { fs.closeSync(fd); } catch { /* already closed */ }
        }
    } catch {
        return '';
    }
}

// Sum one usage-shaped object into a consumed-token figure, or null when it is
// not a legible reading. Consumed = input_tokens + cache_creation_input_tokens
// + cache_read_input_tokens; an absent field counts as zero (a turn with no
// cache activity omits nothing load-bearing), but a present field that is not
// a finite non-negative number makes the whole reading illegible, and an object
// carrying none of the three fields is no reading at all. Illegible returns
// null, which the caller turns into an allow: guessing low here would keep the
// gate denying a session that may already be at the limit.
function sumUsageFields(usage) {
    const fields = ['input_tokens', 'cache_creation_input_tokens', 'cache_read_input_tokens'];
    let total = 0;
    let sawAny = false;
    for (const f of fields) {
        const v = usage[f];
        if (v === undefined || v === null) continue;
        if (typeof v !== 'number' || !Number.isFinite(v) || v < 0) return null;
        total += v;
        sawAny = true;
    }
    return sawAny ? total : null;
}

// The current context size a usage object describes.
//
// A message whose assistant turn took several internal iterations carries a
// usage.iterations array, and the object's TOP-LEVEL cache fields are summed
// across those iterations rather than describing the final request. Observed
// in the wild: a row whose top-level fields sum to 710,223 is three iterations
// of roughly 355,000 each, its top-level cache_read of 708,291 being exactly
// the iterations' 353,812 + 0 + 354,479. Reading the top level there overstates
// the real context by about a factor of two.
//
// So a single iteration is the reading when the array is present and non-empty,
// and the top-level fields are the reading otherwise, which is every
// single-iteration turn. Note the top level is not uniformly a sum
// (input_tokens is not aggregated the way the cache fields are), which is why
// this picks an iteration outright rather than trying to divide the aggregate.
//
// Which iteration: the LARGEST, not the last. The last entry is the final
// request and on every row observed so far it is also the largest, the
// iterations of a turn running within a percent of each other. But that is one
// session's evidence for a rule that has to hold on shapes nobody has seen, and
// the two candidates fail in opposite directions. If a turn ever ends on a
// small internal call, reading the last entry understates the context, the gate
// keeps denying a session that may be at its limit, and the run dies: the one
// outcome this whole design exists to prevent. Reading the largest can only
// overstate by comparison, which trips the valve early and costs a mistimed
// compaction, the pre-gate status quo. Identical on the observed shape, safe on
// the ones that are not.
//
// An unreadable entry makes the whole reading illegible rather than being
// skipped, so a malformed array cannot silently narrow the set being maximized.
// Illegible allows, per sumUsageFields.
//
// The error this corrects was fail-open (overstating consumption makes the
// valve allow earlier, never deny longer), but it tripped the valve at roughly
// half the intended ceiling on the affected rows, which is the same inertness
// the ceiling exists to avoid.
function consumedFromUsage(usage) {
    const iterations = usage.iterations;
    if (Array.isArray(iterations) && iterations.length > 0) {
        let largest = null;
        for (const entry of iterations) {
            if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return null;
            const sum = sumUsageFields(entry);
            if (sum === null) return null;
            if (largest === null || sum > largest) largest = sum;
        }
        return largest;
    }
    return sumUsageFields(usage);
}

// The newest main-thread consumed-token reading from the transcript, or null
// when none can be obtained. Scans the tail newest-first for an assistant
// entry carrying a usage object at message.usage; sidechain (sub-agent) rows
// are skipped because their usage measures the sub-agent's own context, not
// this session's. The tail's first line may be a partial entry (cut by the
// cap, or caught mid-append): an unparseable line is simply skipped. The
// NEWEST usage-bearing row decides alone: when it is illegible this returns
// null (allow) rather than falling back to an older row, because the signal
// is monotonic and an older reading can only understate, which is the
// dangerous direction (a deny near the hard limit).
function latestConsumedTokens(transcriptPath) {
    try {
        if (!transcriptPath) return null;
        const text = readTranscriptTail(transcriptPath);
        if (!text) return null;
        const lines = text.split('\n');
        for (let i = lines.length - 1; i >= 0; i--) {
            const t = lines[i].trim();
            if (!t) continue;
            let entry;
            try { entry = JSON.parse(t); } catch { continue; }
            if (!entry || entry.type !== 'assistant' || entry.isSidechain) continue;
            const usage = entry.message && entry.message.usage;
            if (!usage || typeof usage !== 'object') continue;
            return consumedFromUsage(usage);
        }
        return null;
    } catch {
        return null;
    }
}

// Decide the verdict: 'deny' or 'allow'. The clauses run cheapest first (see
// the header for why each exists), and only the checkpoint-driven allow
// consumes the checkpoint. Never throws on its own account; the entry-point
// wrapper turns any escape into an allow anyway.
function main() {
    let payload;
    try { payload = JSON.parse(readStdin() || '{}'); } catch { return 'allow'; }
    if (!payload || typeof payload !== 'object') return 'allow';

    // Clause 1: only the auto trigger is ever gated.
    if (payload.trigger !== 'auto') return 'allow';

    // Clause 2: external-engine workers are fresh per section; stand down.
    if (process.env.KIT_EXTERNAL_ENGINE === '1') return 'allow';

    // Clause 3: no armed goal means no run to protect (the hot path for every
    // ungated session everywhere: one cheap read).
    const cwd = payload.cwd || process.cwd();
    const goal = readGoal(cwd);
    if (!goal || typeof goal.plan !== 'string' || goal.plan === '') return 'allow';

    // Clause 4: only the leash-bound session is gated. Unbound (boundSession
    // null) is not a match: nothing has claimed the run yet.
    const sessionId = payload.session_id || payload.sessionId;
    if (!goal.boundSession || !sameSessionId(goal.boundSession, sessionId)) return 'allow';

    // Clause 5: a matching open checkpoint is the boundary firing. The match
    // rule (plan equals the goal's, boundSession equals the goal's, openedAt
    // fresh; see the header for why each leg exists) is checkpointMatches in
    // kit-compact-lib.js, single-sourced there because the CLI's status
    // report answers from the same rule and the two must never drift. Allow
    // and consume on a match, single-shot; a non-matching checkpoint reads as
    // absent and is left in place (the next CLI write replaces it, and the
    // expired case in particular must NOT be consumed: an expiry deny is not
    // the boundary firing). The read here and the delete below are not
    // atomic: this assumes the single-writer reality, where the CLI writer
    // and this gate serialize through the one bound session, so no checkpoint
    // can land between them and be consumed by an allow the previous one
    // earned. A future concurrent writer breaks that assumption and needs a
    // compare-before-delete or an atomic take.
    const cp = readCheckpoint(cwd);
    if (checkpointMatches(cp, goal, Date.now()).ok) {
        clearCheckpoint(cwd); // best-effort: a failed delete degrades to an open gate, never a wedged run
        return 'allow';
    }

    // Clause 6: the safety valve. Illegible reads allow rather than denying
    // blind.
    const consumed = latestConsumedTokens(payload.transcript_path || payload.transcriptPath);
    if (consumed === null || consumed >= SAFETY_CEILING_TOKENS) return 'allow';

    return 'deny';
}

// Run as the PreCompact hook only when invoked directly, so a require() of
// this file can never fire the gate as a side effect. Nothing in the kit
// requires it today: hook-canary's load check covers files wired in
// hooks.json via node --check, which is syntax-only and proves nothing about
// whether the lib requires above resolve; resolution is exercised by this
// hook's own test suite, which spawns the real file. The deny is exit code 2 via
// process.exitCode rather than process.exit(), so the stderr note can drain
// before the process ends; the note is a fixed string carrying no input data,
// there for the transcript so a watcher (or the model, if the harness surfaces
// it) reads a deferral, not a failure. Any exception allows: fail-open on
// every axis.
if (require.main === module) {
    let verdict = 'allow';
    try { verdict = main(); } catch { verdict = 'allow'; }
    if (verdict === 'deny') {
        try {
            process.stderr.write('kit-compact-gate: auto-compaction deferred to the next chapter boundary; '
                + 'this is the kit scheduling the compaction, not an error. Keep working.\n');
        } catch { /* the note is best-effort; the exit code is the verdict */ }
        process.exitCode = 2;
    } else {
        process.exitCode = 0;
    }
}
