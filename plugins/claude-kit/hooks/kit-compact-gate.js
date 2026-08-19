#!/usr/bin/env node
// PreCompact hook (auto matcher): boundary-gated compaction, and interactive
// deferral.
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
// The autoCompactWindow that makes the early trigger possible is
// machine-global, so a hands-on session with no automation driving it
// inherits the same early trigger and would be compacted mid-discussion. The
// interactive-deferral path below is the counterweight: when no kit goal
// covers this session and no native automation instrument (/goal or /loop)
// shows in the transcript, the gate holds auto-compaction back until the
// safety ceiling, so an interactive session keeps its context roughly three
// times longer.
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
// it out of a model's context is to print none of it. Each deny path writes
// its own fixed string to stderr, carrying no data from any input, distinct
// per deferral kind so a transcript reader can tell which one fired.
//
// The gate is a three-state classifier evaluated per offer, cheapest check
// first, with two deny states. The BOUNDARY deny holds an armed-and-bound
// plan run to its chapter boundaries; it fires only when ALL of these hold:
//   1. The payload's trigger is 'auto'. The hooks.json matcher already scopes
//      this; the in-code check makes a later matcher edit unable to silently
//      widen the gate. Manual /compact is never gated.
//   2. KIT_EXTERNAL_ENGINE is not '1'. An external engine spawns a fresh
//      worker per section, so there is no mid-chapter context to protect:
//      stand down (same marker as branch-reaper-nudge.js and hook-canary.js).
//   3. A kit goal is armed for the project (.kit/goal-state.json has a plan).
//   4. The compacting session HOLDS the leash, by either of two routes. It is
//      already bound: payload session_id equals the goal's boundSession,
//      compared as opaque case-insensitive trimmed strings (the bound session
//      keeps matching across a compaction because the harness preserves the
//      session id). Or the goal is UNBOUND and this session's transcript
//      shows the user typing the arming command against the armed plan
//      (userCommandArgsClaimPlan in kit-compact-lib.js, the same predicate
//      and the same anti-steal exclusions the Stop hook claims a binding
//      with). That session claims the binding here, best-effort via
//      bindSession, and is boundary-gated for this offer whether or not the
//      write landed, mirroring bindSession's own posture that enforcement
//      never depends on it. Claiming at the first compaction offer, rather
//      than only at the first stop, is what makes the gate reachable at all:
//      executing-work's completion contract forbids stopping with unblocked
//      work remaining, so a run behaving correctly never stops and a
//      stop-only claim never fires. A goal bound to a DIFFERENT session, or
//      unbound with no claim in this transcript (a bystander either way), is
//      never boundary-gated; it falls through to the interactive path below,
//      the same as no goal at all. A payload carrying no session id can be
//      neither compared nor bound, so it allows outright.
//      Two windows are widened rather than opened by claiming here, both
//      pre-existing at the stop-point claim and both bounded by the same
//      last-writer-wins posture bindSession already documents. A session
//      whose transcript carries a superseded arming of the same plan can
//      claim a freshly re-armed goal, and a clear landing between the bind's
//      read and its write can be resurrected by it. What changes is the
//      cadence: past the compaction trigger the harness re-offers every
//      assistant turn, so an unbound armed goal in a claiming session
//      attempts the write far more often than it would at stops alone. Both
//      recover by clearing or re-arming again; a compare-and-swap on the
//      bind, matching the one the advance carries, is backlogged.
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
// The INTERACTIVE deny is the second deny state. When no kit goal covers this
// session (none armed, an unparseable goal state, a goal bound to another
// session, or an unbound goal this session's transcript makes no claim on),
// the session is either a human interacting directly or one driven
// by a native automation instrument, and the transcript at the payload's
// transcript_path tells the two apart (transcriptShowsAutomation in
// kit-compact-lib.js, which owns the evidence shapes and their exclusions).
// Native /goal or /loop in effect: allow, the native early trigger governs.
// Neither in effect: the operator is mid-conversation and an early compaction
// costs the discussion its context, so deny while the same valve reading as
// clause 6 is legible AND strictly below SAFETY_CEILING_TOKENS, and allow at
// or above the ceiling or on an illegible reading. No allow on this path ever
// consumes a checkpoint: consumption is the boundary firing, exclusive to the
// clause-5 allow, and burning one here would rob the bound run of a boundary
// it still needs. A detection miss in either direction is safe-cheap: a
// missed instrument defers a session that would rather compact early (it
// still compacts at the ceiling), and an unreadable transcript yields no
// valve reading either, so the verdict on it is allow, the early-trigger
// status quo.
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
const { readGoal, bindSession } = require('./kit-goal-lib.js');
const {
    readCheckpoint, clearCheckpoint, checkpointMatches, sameSessionId,
    transcriptShowsAutomation, userCommandArgsClaimPlan
} = require('./kit-compact-lib.js');

// The deferral ceiling, in consumed tokens, shared by both deny paths: the
// armed run's safety valve (clause 6) and the interactive deferral's bound.
//
// ASSUMPTION, named because it is the one direction of this design that is
// not fail-open: this is an absolute token count sized for the roughly
// 1,000,000-token window current models carry. The PreCompact payload
// provides no model field (only SessionStart does), so the window cannot be
// derived at fire time. On a model with a SMALLER window the ceiling sits
// above the hard limit, the valve never fires, and sustained denial kills
// the session outright. The interactive path applies this ceiling to every
// hands-on session on the machine, on whatever model it happens to run, so
// that blast radius is machine-wide, no longer confined to leashed plan
// runs. Two facts bound it: the gate can only deny an offer the harness
// already made, so a model whose window sits below the compaction trigger
// never reaches this path at all; and the hazard therefore needs a model
// whose hard limit falls between the trigger and this ceiling. One shared
// ceiling is the decided design (per-mode ceilings are out of scope).
// Nothing detects the small-window state; the doctor's window check reads
// the configured autoCompactWindow, which says nothing about the running
// model's real window.
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

// Clauses 5 and 6 for a session that holds the leash: the boundary-gated
// verdict. `goal` must carry the boundSession the checkpoint is expected to
// name, which for a session that just claimed the binding is its own id.
//
// Clause 5: a matching open checkpoint is the boundary firing. The match rule
// (plan equals the goal's, boundSession equals the goal's, openedAt fresh; see
// the header for why each leg exists) is checkpointMatches in
// kit-compact-lib.js, single-sourced there because the CLI's status report
// answers from the same rule and the two must never drift. Allow and consume
// on a match, single-shot; a non-matching checkpoint reads as absent and is
// left in place (the next CLI write replaces it, and the expired case in
// particular must NOT be consumed: an expiry deny is not the boundary firing).
// A checkpoint opened while the goal was still unbound records boundSession
// null and so does not match the session that has now claimed the binding: the
// compaction defers one more chapter, and the next checkpoint, written bound,
// opens the gate. The read here and the delete below are not atomic: this
// assumes the single-writer reality, where the CLI writer and this gate
// serialize through the one bound session, so no checkpoint can land between
// them and be consumed by an allow the previous one earned. A future
// concurrent writer breaks that assumption and needs a compare-before-delete
// or an atomic take.
//
// Clause 6: the safety valve. Illegible reads allow rather than denying blind.
function boundaryVerdict(cwd, goal, transcriptPath) {
    const cp = readCheckpoint(cwd);
    if (checkpointMatches(cp, goal, Date.now()).ok) {
        clearCheckpoint(cwd); // best-effort: a failed delete degrades to an open gate, never a wedged run
        return 'allow';
    }

    const consumed = latestConsumedTokens(transcriptPath);
    if (consumed === null || consumed >= SAFETY_CEILING_TOKENS) return 'allow';

    return 'deny-boundary';
}

// Decide the verdict: 'allow', 'deny-boundary' (the armed-and-bound run held
// mid-chapter), or 'deny-interactive' (a hands-on session held below the
// ceiling). The clauses run cheapest first (see the header for why each
// exists), and only the checkpoint-driven allow consumes the checkpoint.
// Never throws on its own account; the entry-point wrapper turns any escape,
// including an unrecognized return value, into an allow.
function main() {
    let payload;
    try { payload = JSON.parse(readStdin() || '{}'); } catch { return 'allow'; }
    if (!payload || typeof payload !== 'object') return 'allow';

    // Clause 1: only the auto trigger is ever gated.
    if (payload.trigger !== 'auto') return 'allow';

    // Clause 2: external-engine workers are fresh per section; stand down.
    if (process.env.KIT_EXTERNAL_ENGINE === '1') return 'allow';

    const cwd = payload.cwd || process.cwd();
    const transcriptPath = payload.transcript_path || payload.transcriptPath;

    // Clauses 3 and 4: an armed goal held by THIS session, whether already
    // bound to it or claimed here from its transcript, takes the
    // boundary-gated path; an armed goal bound to ANOTHER session or unbound
    // with no claim in this transcript (a bystander either way), or no armed
    // goal at all, falls through to the interactive path.
    const goal = readGoal(cwd);
    const armed = !!(goal && typeof goal.plan === 'string' && goal.plan !== '');
    const sessionId = payload.session_id || payload.sessionId;
    // An armed goal beside a payload carrying no session id is ambiguous: the
    // harness normally always sends session_id, so its absence is an anomaly,
    // not evidence of a bystander, and the offer may belong to the bound
    // session itself. A bind is impossible without an id either, and an id
    // that is not a string is the same anomaly one step further on: it would
    // reach the checkpoint compare only through a String() coercion, so the
    // shape is checked here rather than relied on downstream. Ambiguity
    // allows rather than risking an interactive deny against the bound run.
    if (armed && (typeof sessionId !== 'string' || !sessionId)) return 'allow';
    if (armed && sameSessionId(goal.boundSession, sessionId)) {
        return boundaryVerdict(cwd, goal, transcriptPath);
    }
    // An unbound goal whose arming command this session's transcript shows the
    // user typing is this run: claim the binding now, so the gate reaches a
    // run that holds the completion contract and therefore never stops to
    // claim it. The write is best-effort and the verdict does not wait on it;
    // a bind that never lands leaves the run deferring to the safety ceiling,
    // which is where a .kit/ that rejects this write also leaves checkpoint
    // placement anyway.
    if (armed && !goal.boundSession && userCommandArgsClaimPlan(transcriptPath, goal.plan)) {
        bindSession(cwd, sessionId, transcriptPath);
        goal.boundSession = sessionId;
        return boundaryVerdict(cwd, goal, transcriptPath);
    }

    // The interactive path (see the header): no kit goal covers this session,
    // so the transcript decides whether a native automation instrument is
    // driving it. Automation in effect: allow, the native early trigger
    // governs. Neither instrument in effect: a hands-on session, deferred to
    // the same ceiling the valve enforces, under the same illegible-reading
    // allow. No checkpoint is touched on this path.
    if (transcriptShowsAutomation(transcriptPath)) return 'allow';
    const consumed = latestConsumedTokens(transcriptPath);
    if (consumed === null || consumed >= SAFETY_CEILING_TOKENS) return 'allow';
    return 'deny-interactive';
}

// Run as the PreCompact hook only when invoked directly, so a require() of
// this file can never fire the gate as a side effect. Nothing in the kit
// requires it today: hook-canary's load check covers files wired in
// hooks.json via node --check, which is syntax-only and proves nothing about
// whether the lib requires above resolve; resolution is exercised by this
// hook's own test suite, which spawns the real file. Either deny is exit code
// 2 via process.exitCode rather than process.exit(), so the stderr note can
// drain before the process ends; each note is a fixed string carrying no
// input data, distinct per deny kind so a transcript reader can tell which
// deferral fired, there so a watcher (or the model, if the harness surfaces
// it) reads a deferral, not a failure. Any exception, and any verdict value
// that is not a recognized deny, allows: fail-open on every axis.
const BOUNDARY_NOTE = 'kit-compact-gate: auto-compaction deferred to the next chapter boundary; '
    + 'this is the kit scheduling the compaction, not an error. Keep working.\n';
const INTERACTIVE_NOTE = 'kit-compact-gate: auto-compaction deferred to the context safety ceiling; '
    + 'this is the kit holding compaction out of an interactive session, not an error. Keep working.\n';

if (require.main === module) {
    let verdict = 'allow';
    try { verdict = main(); } catch { verdict = 'allow'; }
    const note = verdict === 'deny-boundary' ? BOUNDARY_NOTE
        : verdict === 'deny-interactive' ? INTERACTIVE_NOTE
        : null;
    if (note) {
        try {
            process.stderr.write(note);
        } catch { /* the note is best-effort; the exit code is the verdict */ }
        process.exitCode = 2;
    } else {
        process.exitCode = 0;
    }
}
