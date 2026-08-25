#!/usr/bin/env node
// PostToolUse hook (Agent|TaskOutput|Bash|PowerShell matcher): the deferral nudge.
//
// The PreCompact gate defers an auto-compaction offer until a boundary
// checkpoint is open, and it announces every deferral on stderr, which reaches
// the operator only and never the model. So a leashed run that never declares a
// boundary is held silently, offer after offer, until the gate's own safety
// valve fires near the context limit and lands the compaction at the worst
// point in the section. The deny happens at a turn boundary the model sees
// nothing of; the first thing it reads afterwards is a tool result. That is
// where this directive goes.
//
// The tools it rides are the ones whose results follow a wait: a dispatched
// agent, a task's output, a shell command. Edit, MultiEdit and Write belong to
// chapter-boundary-nudge.js, which detects the boundary being written rather
// than the hold that precedes it.
//
// It is a detector plus a directive, deliberately not an auto-open, on the
// reasoning the boundary nudge carries: the checkpoint belongs after the board
// entry is written and the section's commit model honored, and a hook that
// opened one at a tool return would admit a compaction before either. A
// reminder can misfire at the cost of a sentence; an auto-open cannot.
//
// The output channel is one form and one form only: JSON on stdout at exit 0
// whose hookSpecificOutput object carries hookEventName 'PostToolUse' and
// additionalContext set to the reminder. A TOP-LEVEL additionalContext key is
// inert on this harness (the hooks documentation shows it, but the harness
// parses the payload and discards that field), so this hook never emits one:
// an inert "compatibility" copy would read as working while reaching nothing.
//
// The reminder carries exactly two values out of state, the count of offers
// held and the whole minutes since the episode opened, both integers rendered
// by the library's own clamped phrase. No path, no session id, nothing else read
// from disk: the state file is user-writable, and this text lands in the model's
// context, so it holds the same provenance bound the gate's stderr notes hold.
// The one other composed value is this hook's own installed directory, module
// state rather than input, and it is gated by a path grammar before it is
// rendered as a runnable command (see CHECKPOINT_CLI).
//
// Eight guards, in order, every one failing toward a silent exit 0:
//   1. The payload parses and tool_name is exactly Agent, TaskOutput, Bash, or
//      PowerShell. The hooks.json matcher already scopes this; the in-code
//      check makes a later matcher edit unable to silently widen the hook.
//   2. KIT_EXTERNAL_ENGINE is not '1'. An external engine's workers are fresh
//      per section, so there is no boundary ritual to remind them of (same
//      marker as the sibling hooks).
//   3. The payload carries no TRUTHY agent-identity key: agent_id, or any of
//      the four agent-type spellings the sibling subagent detectors defend
//      (agent_type, agentType, subagent_type, subagentType, per
//      readonly-agent-guard.js and docs-write-guard.js, whose breadth is the
//      repo's evidence that the spelling varies across harness versions). Any
//      of them marks a subagent's tool call, and the directive belongs to the
//      main session, which is the only one that can write a board entry or open
//      a checkpoint. Truthiness rather than key presence, matching those two
//      detectors: a harness version that put a null or empty agent_id on a
//      main-session payload would otherwise stand this hook down on every call
//      and kill the feature outright, with every hand-built test payload still
//      passing.
//      This guard is load-bearing on its own rather than belt-and-braces: a
//      subagent's PostToolUse payload carries the PARENT session's own
//      session_id, so the bound-session check in guard 5 passes for a
//      subagent's tool call and never stands one down. Every dispatched agent
//      runs Bash constantly, so this is the guard that keeps the nudge out of
//      dozens of contexts that cannot act on it. Its fail direction is noise
//      AND silence together, which is why nothing here is belt-and-braces: on a
//      harness that stops sending these keys, every dispatched agent's Bash
//      return both emits and stamps, and the stamp lands on the parent
//      binding's episode while the delivery lands in the agent's own context.
//      The agents consume nearly every interval between them, and the main
//      session's own long returns arrive inside a window one of them just
//      silenced. So the feature would die in the one context that can act on
//      it. No read of the keys can repair that, since the premise is that they
//      are not sent, and this is stated rather than defended.
//   4. cwd is a usable string and does not name a network share (two leading
//      separators, the UNC and //server forms). The project the payload names
//      is the only project this hook reads, since a shell command's own
//      working directory is not this process's. Opening a path on an
//      unreachable share blocks for the SMB timeout, and a stalled tool loop is
//      the one failure this hook must never cause. What this check buys is that
//      one case, for every read that follows; each reader still answers for the
//      path it opens, and kit-goal-lib.js applies the same rejection to its own
//      stat paths.
//   5. A kit goal is armed (readGoal from kit-goal-lib.js, the same read the
//      gate uses) and goal.boundSession equals the payload's session id
//      (sameSessionId, over session_id or sessionId, the pair the gate and the
//      Stop hook both accept). Bound sessions only, since claiming a binding
//      stays the business of the gate and the Stop hook, and an unbound or
//      foreign session has no boundary of this run's to declare. Nothing here
//      compares transcript paths: the goal's boundTranscript and a payload's
//      transcript_path come from different producers (the CLI composes its own
//      path, a claim-point bind stores the harness's verbatim value), so any
//      spelling difference between them (a short name, a substituted drive, a
//      symlinked home) would be a permanent total stand-down with no log line
//      and nothing in any status surface. Its only failure direction is
//      silence. Guard 3 is the subagent stand-down.
//   6. The gate state shows a deferral episode open FOR THIS BINDING
//      (gateEpisodeOpen with checkpointOwner's answer, which is an explicit
//      null for an unbound goal rather than the undefined that would let any
//      bystander's hold fire this run's nudge). No episode means no offer is
//      being held, and there is nothing to act on.
//   7. No matching checkpoint is open (readCheckpoint plus checkpointMatches,
//      given pendingOfferCorroborated's answer as its fourth argument, from
//      the same state read guard 6 used). A matching checkpoint means the
//      boundary is already declared and the next turn lands the compaction
//      there, so the directive would be false. The corroboration argument is
//      not optional: omitted, the match rule falls back to the ten-minute
//      bound, and a boundary declared under a pending offer during a long tool
//      call is exactly the case this hook exists to serve, so the fallback
//      would make this guard wrong precisely there.
//   8. The episode's nudgedAt is absent, unparseable, dated in the future, or
//      older than NUDGE_INTERVAL_MS. The three illegible readings all fire,
//      which is the fail-open direction here and self-healing: the stamp
//      written on this fire replaces the illegible value, so the interval takes
//      hold from the next tool return onward.
//
// On all eight the episode is stamped through recordEpisodeNudge FIRST, and the
// reminder is emitted only when that stamp landed. The ordering is the rate
// limit: nudgedAt is not diagnostic, it is the only cross-process carrier guard
// 8 has, so emitting without it would mean emitting with no rate limit at all,
// after every covered tool return for the life of the episode, into a context
// that is by definition already past the compaction trigger. Silence is exactly
// the pre-hook status quo and that unbounded repeat is worse than it, so a
// stamp that cannot land yields silence.
//
// What that buys is once per interval per TOOL BATCH, not per turn. Several
// covered tool calls returning together each run their own process, all read
// nudgedAt as it stood before any of them, and all emit; the stamp-first
// ordering narrows the window to one read-modify-write but does not close it.
// The stamp does carry a compare-and-set, but over the fields the GATE owns,
// and it narrows the window to the rename itself rather than closing it: what
// it catches is a stamp about to write back an episode a decision just cleared.
// The interval race between siblings in one batch is deliberately left open,
// since no lock is worth taking on a path that runs after every covered tool
// return.
// So a deferral held across a hundred turns costs a handful of sentences rather
// than a hundred.
//
// One residue this hook cannot see, kept and named rather than coded around: a
// manual /compact ends a deferral without the gate ever learning of it, since
// the PreCompact matcher is auto-only, so an orphaned episode can stand for up
// to the gate's four-hour idle bound and this hook will repeat a directive
// whose premise is no longer true, on a 30-minute cadence. Its cost is more
// than a boundary declared early: the CLI's open reads that same orphaned
// episode as a live hold, so the checkpoint it writes stores pendingOffer true,
// and pendingOfferCorroborated then vouches for it out of the very episode that
// is orphaned. The boundary therefore carries the LONG lease (the episode's
// remaining idle life, up to about four hours) rather than the ten-minute one,
// so a compaction admitted late in that window lands further from the boundary
// than the short lease could ever put it. Guard 7 stands this hook down the
// moment that checkpoint matches, so the repeat stops at the first open. The
// obvious fix, gating guard 6 on a short freshness bound on the episode's
// lastDeniedAt, is refused: that field
// advances only at an assistant turn, and the long tool call this hook exists
// to serve has none, so a 73-minute Agent return carries a 73-minute-stale
// lastDeniedAt by construction and the bound would silence the nudge in
// precisely the case it was built for while leaving it loud in the short-call
// case that never needed it.
//
// Fail-open everywhere, matching the gate's posture: the hook never exits
// non-zero, never exits 2 (the tool already ran, and an error-framed reminder
// after every shell command is noise), and any internal error exits 0 silently.
// The kit library requires are deferred into the guard that uses them so a
// damaged or missing lib in an installed plugin cache degrades to the same
// silent exit 0 instead of a require-time crash on every tool call. A missed
// nudge degrades to the pre-hook status quo; a thrown hook would degrade the
// tool loop itself, which is strictly worse.

'use strict';

const fs = require('fs');

// The tools whose results follow a wait, which is where a model first reads
// anything after a deferral it never saw.
const COVERED_TOOLS = ['Agent', 'TaskOutput', 'Bash', 'PowerShell'];

// How long a fired nudge silences the next one while the same episode stands.
// The hold this speaks about is measured in turns and can span hours, and the
// directive is the same sentence every time, so a per-turn repeat would be
// noise the model learns to skip; half an hour is long enough that a session
// that ignored the first has had a real chance to reach a clean point.
const NUDGE_INTERVAL_MS = 30 * 60 * 1000;

// The checkpoint CLI as a command the session can run. This hook ships as a
// plugin and runs in every project, so a repo-relative path would resolve only
// where the kit is dogfooded in its own checkout; __dirname is this module's
// installed location, never a payload, transcript, or repo value. Forward
// slashes because node accepts them on Windows and a backslash path does not
// survive every shell.
//
// Provenance is not the whole answer here, and this is where this note departs
// from the identically built one in kit-compact-gate.js: that one reaches the
// operator's stderr, while this one lands in the model's context as a command
// to run. Double quotes do not neutralize $(...) or backticks, both of which
// are legal in a POSIX directory name, so an install path carrying either would
// compose a line that executes something else when run. The repo's own
// precedent is to gate a composed runnable command rather than rest on the
// sanitizer around it (the doctor's git branch -m remedy, docs/security-model.md).
// So the path is held to a conservative grammar, and where it fails, the
// command clause is dropped and the rest of the reminder still ships: the
// session is told what to do in prose and can find the CLI itself.
const CHECKPOINT_CLI = __dirname.split('\\').join('/') + '/kit-compact-checkpoint.js';

// The grammar: letters, digits, space, and the punctuation a real install path
// needs (dot, dash, underscore, colon for a drive letter, forward slash, tilde
// for an 8.3 short name, parentheses for "Program Files (x86)", plus). Every
// metacharacter that survives double-quoting is outside it, the dollar sign and
// the backtick above all, and so is every non-ASCII byte; the path renders
// inside double quotes, where the parentheses, tilde and space this admits are
// inert. The length is bounded so no pathological path reaches the context.
const SAFE_CLI_PATH = /^[A-Za-z0-9 _.:/~()+-]{1,256}$/;

function safeCommandPath(cliPath) {
    return typeof cliPath === 'string' && SAFE_CLI_PATH.test(cliPath);
}

// The reminder, fixed prose around one library-rendered phrase carrying the two
// integers. It names the hook, states the hold, says the deferral is the
// mechanism rather than a fault, gives the clean-point ritual in order, says
// what to do mid-step, forbids the two shortcuts that would defeat the gate,
// and routes a session whose skill body an earlier compaction dropped back to
// executing-work. The test suite pins fragments of it, so a reword is a
// deliberate double-edit. cliPath is a parameter so both directions of the
// grammar gate are testable as a unit.
function buildReminder(phrase, cliPath) {
    const cli = (cliPath === undefined) ? CHECKPOINT_CLI : cliPath;
    const open = safeCommandPath(cli)
        ? 'then run node "' + cli + '" open from the project directory'
        : 'then open a boundary checkpoint by running the kit\'s kit-compact-checkpoint.js '
            + 'with the open argument, from the project directory';
    return 'compact-deferral-nudge: the compaction gate has ' + phrase + ' in this deferral episode, '
        + 'waiting for a boundary to land the compaction at. This is the kit scheduling the compaction, '
        + 'not an error. If this is a clean point (a review round adjudicated, a section closed, a '
        + 'finishing step done), append the interim board entry or the Chapter per executing-work, honor '
        + 'the section\'s commit model, ' + open + '; the next turn lands the compaction there. If you '
        + 'are mid-step, finish the step and act at its end. Never clear the goal or the checkpoint to '
        + 'get past a deferral. If the boundary ritual is not in context, an earlier compaction may have '
        + 'dropped the executing-work body: load that skill again before acting.';
}

// The payload is read and parsed whole, with no size cap, which is the house
// convention for a hook payload (chapter-boundary-nudge.js reads its own the
// same way). What differs here is the wiring rather than the reader: the
// siblings ride Edit, Write, MultiEdit and PreToolUse, whose payloads are small
// or carry no tool_response at all, while this one rides the four tools whose
// results are the large case. A cap would truncate the JSON, the parse would
// fail, and the hook would go silent on precisely the long calls a deferral is
// most likely to be standing behind, so none is taken. Nothing read here is
// retained past the guards, and none of it reaches the reminder.
function readStdin() {
    try { return fs.readFileSync(0, 'utf8'); } catch { return ''; }
}

// Guard 3: the subagent marker, read as truthiness the way the two sibling
// detectors read theirs.
function agentIdentity(payload) {
    return payload.agent_id || payload.agent_type || payload.agentType
        || payload.subagent_type || payload.subagentType || null;
}

// Guard 4: the UNC and //server forms, which are what a synchronous open can
// hang on for the SMB timeout. Exported so the suite can pin the predicate
// directly: the spawned end-to-end case can only prove the refusal where an
// SMB stack exists, and on a POSIX runner a doubled-slash path is an ordinary
// missing file that produces the same silence for another reason.
function namesNetworkShare(cwd) {
    return /^[\\/]{2}/.test(cwd);
}

// Guard 8: has the interval elapsed since this episode was last spoken to? An
// absent, unparseable or future-dated stamp reads as not-yet-nudged, per the
// header.
function intervalElapsed(nudgedAt, nowMs) {
    if (typeof nudgedAt !== 'string') return true;
    const at = Date.parse(nudgedAt);
    if (!Number.isFinite(at)) return true;
    const elapsed = nowMs - at;
    return elapsed < 0 || elapsed >= NUDGE_INTERVAL_MS;
}

// Evaluate the eight guards in order, stamp the episode, and return the
// reminder when the stamp landed; null on every other path. Never throws on its
// own account; the entry-point wrapper turns any escape into a silent exit 0.
function main() {
    // Guard 1: the payload parses and the tool is one this hook covers.
    let payload;
    try { payload = JSON.parse(readStdin() || '{}'); } catch { return null; }
    if (!payload || typeof payload !== 'object') return null;
    if (!COVERED_TOOLS.includes(payload.tool_name)) return null;

    // Guard 2: external-engine workers stand down.
    if (process.env.KIT_EXTERNAL_ENGINE === '1') return null;

    // Guard 3: a subagent's tool call stands down on the agent keys alone; its
    // session_id is the parent's, so guard 5 cannot tell it apart.
    if (agentIdentity(payload)) return null;

    // Guard 4: the project the payload names, and never a network share.
    const cwd = payload.cwd;
    if (typeof cwd !== 'string' || cwd === '') return null;
    if (namesNetworkShare(cwd)) return null;

    // Guard 5: a kit goal is armed for that project and bound to this session.
    // The lib requires are deferred to here so a damaged installed cache
    // degrades to silence rather than a crash (see the header).
    let readGoal, lib;
    try {
        ({ readGoal } = require('./kit-goal-lib.js'));
        lib = require('./kit-compact-lib.js');
    } catch { return null; }
    const goal = readGoal(cwd);
    if (!goal || typeof goal.plan !== 'string' || goal.plan === '') return null;
    // Both spellings, because the gate and the Stop hook both accept both: a
    // harness emitting camelCase would otherwise keep opening episodes this
    // hook could never speak about.
    const sessionId = payload.session_id || payload.sessionId;
    if (!lib.sameSessionId(goal.boundSession, sessionId)) return null;

    // One clock and one state read for guards 6, 7 and 8, so the three cannot
    // answer as of different moments or different files.
    const now = Date.now();
    const owner = lib.checkpointOwner(goal);
    const state = lib.readGateState(cwd);

    // Guard 6: this binding is under a deferral episode right now.
    const episode = lib.gateEpisodeOpen(state, now, owner);
    if (!episode) return null;

    // Guard 7: no checkpoint of this run's is already matching.
    const cp = lib.readCheckpoint(cwd);
    const corroborated = lib.pendingOfferCorroborated(cp, state, now, owner);
    if (lib.checkpointMatches(cp, goal, now, corroborated).ok) return null;

    // Guard 8: the interval since this episode was last spoken to.
    if (!intervalElapsed(episode.nudgedAt, now)) return null;

    // The two integers, rendered by the library so the nudge, the gate's note
    // and the CLI's status all phrase the same hold identically. Null when the
    // episode's age cannot be read, and then the reminder has no reading to
    // carry, so it says nothing rather than guessing.
    const phrase = lib.episodePhrase(episode, now);
    if (phrase === null) return null;

    // The rate limit before the emission, never after it: an unstamped nudge is
    // an unlimited one (see the header). What the ordering does NOT decide is
    // the stdout write throwing: that is swallowed either way with the stamp
    // already on disk, costing one interval of silence.
    // The tool name rides into the journal record: the interval lives on one
    // shared episode while delivery is per context, so a run whose nudge lines
    // are all Bash is a readable sign that dispatched agents are consuming the
    // interval the main session needed (see recordEpisodeNudge).
    if (!lib.recordEpisodeNudge(cwd, owner, now, payload.tool_name)) return null;

    return buildReminder(phrase);
}

// Run as the PostToolUse hook only when invoked directly, so a require() of
// this file (the test suite reads buildReminder through it) can never fire the
// nudge as a side effect. Exit is via process.exitCode rather than
// process.exit(), so stdout can drain before the process ends. Every path,
// success and internal error alike, exits 0.
if (require.main === module) {
    let reminder = null;
    try { reminder = main(); } catch { reminder = null; }
    if (reminder) {
        try {
            process.stdout.write(JSON.stringify({
                hookSpecificOutput: {
                    hookEventName: 'PostToolUse',
                    additionalContext: reminder
                }
            }));
        } catch { /* the nudge is best-effort; the exit code stays 0 */ }
    }
    process.exitCode = 0;
}

module.exports = { buildReminder, NUDGE_INTERVAL_MS, namesNetworkShare };
