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
// Two sessions are held by this gate and neither can see it, so there are two
// directives here rather than one. The LEASHED run is held on a boundary deny,
// under an open deferral episode, and is told to close its chapter and open a
// checkpoint. The HANDS-ON session is held on an interactive deny, because the
// project's goal belongs to another session or nothing is armed here at all; it
// has no chapter to close and no checkpoint to open, and its only release is the
// role-boundary marker the checkpoint CLI's boundary verb writes, so it is told
// to judge whether everything it holds is durable and to declare it if so. The
// two are mutually exclusive by construction, since the gate reaches the
// interactive leg only for a session that does not hold the leash, and the
// second directive is the only one that ever reaches a bystander seat.
//
// The episode reminder carries exactly two values out of state, the count of
// offers held and the whole minutes since the episode opened, both integers
// rendered by the library's own clamped phrase. The hold reminder carries none
// at all: its prose is fixed, and the one figure that decides whether it speaks,
// the denied decision's consumed token reading, is compared against the floor
// and never rendered. No session id, no project path, nothing else read
// from disk: the state file is user-writable, and this text lands in the model's
// context, so it holds the same provenance bound the gate's stderr notes hold.
// The one other composed value is this hook's own installed directory, module
// state rather than input. It is rendered as a runnable command through two
// guards, a path grammar and a home elision (see CHECKPOINT_CLI and
// commandClausePath); an installed kit sits under the home directory, so the
// elision is what keeps the OS account name out of a text the model reads, on
// the floor the checkpoint CLI holds its own output to. The grammar is why the
// installed directory is read from __dirname here rather than from
// CLAUDE_PLUGIN_ROOT the way the version nudge and the doctrine refresh read
// theirs: both texts name a command the reader is meant to run, but those two
// print a diagnostic about the plugin the harness says is loaded, while this one
// hands over a line to execute, and an environment value can name a directory
// this hook was never installed in. The grammar refuses metacharacters, not a
// wrong directory.
//
// Guards 1 to 4 decide whether anything is said at all, guard 5 forks to one of
// two paths, and guards 6 to 8 belong to the episode path alone; the hold path
// has its own three, numbered 5H to 7H in the section after this list. Every
// guard fails toward a silent exit 0:
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
//      stat paths. The same screen runs a second time over the directory
//      kit-compact-lib's scratch resolver answers for that project, which for a
//      project directory under ~/.claude is home-anchored rather than a child of
//      cwd, so the state and stamp reads on both paths below inherit the guard
//      rather than the cwd screen alone standing for them.
//   5. A kit goal is armed (readGoal from kit-goal-lib.js, the same read the
//      gate uses) and this session holds its leash (sessionHoldsLeash, over
//      session_id or sessionId, the pair the gate and the Stop hook both
//      accept): the bound session, or the session the state records as having
//      armed a goal still unbound. Claiming stays the gate's and the Stop
//      hook's business and this hook only reads the answer. Two states put an
//      unbound goal beside a standing deferral episode, and they are what the
//      second leg reaches: a claim whose best-effort bind write failed, which
//      leaves the run held under an episode it opened while the state still
//      reads unbound, and a re-arm that lands unbound while an episode is
//      already standing. An episode is opened by a boundary deny alone, and the
//      claim points bind before they take that verdict, so the ordinary
//      self-armed first deferral is already bound and the first leg answers it.
//      The user's typed arming text is NOT a leg here: it is a claim route the
//      two hooks act on and this hook does not read transcripts, so an arm made
//      outside any session, which records no arming id, leaves this hook silent
//      for the session that will claim on that text. A foreign session has
//      no boundary of this run's to declare. Nothing here
//      compares transcript paths: the goal's boundTranscript and a payload's
//      transcript_path come from different producers (the CLI composes its own
//      path, a claim-point bind stores the harness's verbatim value), so any
//      spelling difference between them (a short name, a substituted drive, a
//      symlinked home) would be a permanent total stand-down with no log line
//      and nothing in any status surface. Its only failure direction is
//      silence. Guard 3 is the subagent stand-down.
//      This guard is the fork rather than a stand-down: a session holding no
//      leash in this project takes the hold path below, whose guards are
//      numbered 5H to 7H, and reaches no part of guards 6, 7 or 8. Those three
//      therefore decide exactly what they always decided, for exactly the
//      sessions they always decided it for. The fork carries one stand-down of
//      its own, and it is here rather than at 5H because it is a fact about the
//      goal: an ARMED goal with no binding, met by a session this guard has
//      just found does not hold its leash, takes neither path. Such a goal is
//      claimable by whichever session's arming text names it, out of a
//      transcript this hook never opens, so the session in front of it may be
//      the leash holder unrecognizably, and the hold directive would tell a
//      leash holder it holds no leash and point it at a marker the gate's
//      boundary leg never reads.
//      The fork carries a second stand-down on the same reasoning, and it is
//      about the READ rather than about the goal: readGoal answers null both
//      for a state no surface in the kit can act on and for one that is there
//      and could not be read, and those are opposite answers here, a project
//      with no reachable goal against a project whose leash holder cannot be
//      identified right now. So the null is discriminated by the KIND at the
//      path (goalPathKind, against SETTLED_GOAL_STATE_KINDS below), which
//      recognizes the three settled readings rather than absence alone, and
//      every other kind takes the silence rather than the directive.
//   6. The gate state shows a deferral episode open FOR THIS RUN'S LEASH
//      (gateEpisodeOpen scoped to the holder guard 5 identified: the goal's
//      binding where it has one, and otherwise this session's own id, which is
//      what the gate recorded its denials under while the leash sat
//      unclaimed). The scoping is always an explicit id rather than an
//      omission, since an omitted one lets any bystander's hold fire this run's
//      nudge. No episode means no offer is being held, and there is nothing to
//      act on.
//   7. No matching checkpoint is open (readCheckpoint plus checkpointMatches,
//      given pendingOfferCorroborated's answer as its fourth argument, from
//      the same state read guard 6 used). A matching checkpoint means the
//      boundary is already declared and the next turn lands the compaction
//      there, so the directive would be false. The corroboration argument is
//      not optional: omitted, the match rule falls back to the ten-minute
//      bound, and a boundary declared under a pending offer during a long tool
//      call is exactly the case this hook exists to serve, so the fallback
//      would make this guard wrong precisely there. A record opened before the
//      leash was claimed carries no owner, and the match is asked as the next
//      offer's claim will leave it (that claim binds the leash and adopts such
//      a record), so a boundary already banked in that window stands this hook
//      down exactly as a bound run's does.
//   8. The episode's nudgedAt is absent, unparseable, dated in the future, or
//      older than NUDGE_INTERVAL_MS. The three illegible readings all fire,
//      which is the fail-open direction here and self-healing: the stamp
//      written on this fire replaces the illegible value, so the interval takes
//      hold from the next tool return onward.
//
// The hold path, taken when guard 5 finds no leash for this session here. Three
// guards, each the same question asked of a different record:
//   5H. This session's own newest interactive deny is a hold that still stands:
//      it carries one of the two hands-on reasons (bystander, or nothing armed)
//      and is dated inside the same four-hour idle bound and future-skew
//      allowance an episode's newest denial is held to (interactiveHoldOpen).
//      A record rather than an episode is what is read, and that is forced by
//      the gate rather than chosen here: an interactive deny records its
//      decision and leaves the episode slot untouched (nextGateState), so a
//      bystander and a session in an unarmed project never own an episode at
//      all, and a nudge keyed on one could never speak to either. The record is
//      read from the gate state's per-session hold list, so the directive is
//      keyed on this session's own hold: on the shared checkout this whole path
//      exists for, several seats are held at once and every gate process
//      overwrites the single newest-decision slot, so a hold read from there
//      would be refused whenever another seat decided last.
//   6H. The decision's consumed token reading is at or above the floor
//      (compactNudgeFloor in the machine-local signpost, default
//      NUDGE_FLOOR_DEFAULT). Deferral itself is free and the gate keeps doing it
//      at any count; what the floor buys is that the directive arrives only when
//      a compaction is close enough that declaring a boundary is worth a turn's
//      attention. A record whose consumed reading is absent or illegible is
//      below every floor, which is the right direction: the figure is the only
//      evidence this hook has that the hold is near the ceiling, and speaking
//      without it would be guessing.
//   7H. The interval since this session was last spoken to about a hold, read
//      from the stamps beside the gate state (holdNudgedAt) and applied by the
//      same intervalElapsed rule guard 8 uses, illegible-fires included. It is a
//      separate file for a reason stated at recordHoldNudge: the state file's
//      writers would erase a stamp kept there within minutes, and this hold owns
//      no episode to carry one. The two intervals are independent by
//      construction, one per episode and one per session, and neither can
//      silence the other.
// They are evaluated 5H, 7H, 6H, which is an evaluation order rather than a
// renumbering: 6H reads the machine-local signpost in the home directory while
// 7H reads a small file in the project this payload already named. What the
// order buys is bounded to one regime and worth stating exactly, because the
// dominant regime is the other one. Above the floor a fired directive leaves a
// stamp, so 7H answers no for the throttle interval and the home read is
// skipped for that half hour. Below the floor no stamp is ever written, so 7H
// answers yes on every covered tool return and both reads happen every time,
// throughout exactly the suppression window the floor exists to create. No
// ordering can change that half: 6H IS the home read, so establishing that a
// hold is below the floor requires it. No guard's answer depends on another's,
// so the order changes what is read and never what is decided.
// On all three the stamp lands first and the directive is emitted only when it
// landed, which is guard 8's ordering and it is the rate limit for the same
// reason.
//
// One bound on the no-goal shape, stated rather than fixed. The whole hold path
// starts at a decision the gate recorded, and the gate records nothing in a
// project that carries no .kit/ directory unless a goal is armed there
// (gateScratchTarget in kit-compact-lib.js refuses to create one otherwise). So
// in a project that has never carried a .kit/, no interactive deny is written
// down, 5H finds no hold, and this directive never fires for the no-goal shape
// at all. The refusal is deliberate and is not removed for this: lifting it
// would have the kit create a .kit/ in every unarmed project a held session
// happens to stand in, which is the exact cost that refusal exists to prevent.
// What it leaves is that the no-goal directive serves a project that already
// carries a .kit/, which is every project that has ever armed a goal or run the
// boundary verb, and the bystander shape is unaffected, since an armed goal is
// what makes a session a bystander in the first place.
//
// There is deliberately no stand-down on the seat's own release marker, which is
// a decision rather than an omission. The record read at 5H IS the gate's answer
// to whether a release was honored, since the marker legs run before the deny,
// so a deny means no honorable marker stood at that decision. Reading the marker
// file here would add a failure mode rather than remove one: markerMatches
// answers on age and session alone, so a declaration whose moment has lapsed
// still matches for four hours, and a check on it would silence the directive
// for that whole window in exactly the case the seat needs to declare again.
// What that leaves is a repeat whose real ceiling is worth stating plainly,
// because it is wider than one sentence. 5H honors an interactive deny for the
// gate's four-hour idle bound and 7H spaces the directive by 30 minutes, so a
// hold that ENDS without the gate recording anything newer can draw the
// directive about eight times on a premise that is no longer true. Two things
// end a hold that way: a manual /compact, which the auto-only PreCompact
// matcher never sees, and a session that simply stops taking offers. In the
// live case the repeat is far tighter, since during a hold the harness re-offers
// every few tens of seconds, so a declaration is consumed almost immediately
// and the allow that consumes it drops this session's own hold record
// (nextGateState), which 5H then reads as no hold at all.
// There is no guard on the state's own lastAllow to shorten that, and its
// absence is a fact about the state rather than a gap: an allow already ends
// the allower's hold in the list 5H reads, and another session's allow says
// nothing about this session's hold, so a test on that field would decide
// nothing.
//
// On the EPISODE path, and there alone, the episode is stamped through
// recordEpisodeNudge FIRST, and the reminder is emitted only when that stamp
// landed. The hold path never touches that function and stamps through
// recordHoldNudge instead, which is a correctness bound rather than a tidiness
// one: an interactive deny opens no episode, so minting one from a hold nudge
// would hand a bystander's hold to pendingOfferCorroborated as a vouching
// episode for someone else's checkpoint. The ordering is the rate
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
const os = require('os');
const path = require('path');

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
//
// The grammar is not the whole of what this value takes on its way out.
// __dirname on an installed kit is home-anchored, so the account name in it is
// elided before the path is rendered, at commandClausePath below, which also
// owns the second reading that drops the clause.
const CHECKPOINT_CLI = __dirname.split('\\').join('/') + '/kit-compact-checkpoint.js';

// The grammar: letters, digits, space, and the punctuation a real install path
// needs (dot, dash, underscore, colon for a drive letter, forward slash, tilde
// for an 8.3 short name, parentheses for "Program Files (x86)", plus). Every
// metacharacter that survives double-quoting is outside it, the dollar sign and
// the backtick above all, and so is every non-ASCII byte; the path renders
// inside double quotes, where the parentheses, tilde and space this admits are
// inert. The length is bounded so no pathological path reaches the context.
//
// Its subject is the part of the rendered command composed out of a VALUE. The
// `$HOME` reference commandClausePath puts in front of a home-anchored install
// path is this file's own fixed text rather than anything read from anywhere, so
// holding it to a grammar that refuses a dollar sign would be refusing the
// guard's own output.
const SAFE_CLI_PATH = /^[A-Za-z0-9 _.:/~()+-]{1,256}$/;

function safeCommandPath(cliPath) {
    return typeof cliPath === 'string' && SAFE_CLI_PATH.test(cliPath);
}

// The installed CLI as the text of a runnable command, or null where no such
// text can be composed and the directive falls back to naming the tool in prose.
//
// The home prefix is elided because an installed kit lives under
// ~/.claude/plugins/cache/, so the composed command carries the OS account name
// into the model's context on every fire otherwise. That is the floor the
// checkpoint CLI this command names holds its own output to, and this is a
// second producer on the same channel: the grammar above is a metacharacter
// screen rather than an elision and admits an account name in full.
//
// The elision is `$HOME` rather than `~` because this clause promises a line to
// RUN. The composed line, run in either the POSIX shell or PowerShell a seat has
// in front of it, reaches the directory os.homedir() names, while a tilde inside
// double quotes is expanded by neither shell and would hand over a command that
// cannot work.
// Containment is decided by path.relative, on components rather than characters
// and case-insensitively on win32, which is how the checkpoint CLI's own display
// guard decides the same question.
//
// The grammar then runs over the TAIL alone, which is the whole of what is
// composed here out of a value. A home directory carrying a metacharacter
// therefore renders a safe command rather than dropping the clause, the elision
// having already taken that text out of the line.
//
// A home directory that cannot be read at all answers null and drops the clause.
// "This path is not under the home directory" and "no home directory is
// knowable" are different facts, and only the first licenses printing an
// absolute path into this channel; the prose fallback costs the reader a lookup
// and costs nobody an account name.
function commandClausePath(cliPath) {
    if (typeof cliPath !== 'string' || cliPath === '') return null;
    let home = '';
    try { home = os.homedir(); } catch { home = ''; }
    if (typeof home !== 'string' || home === '') return null;
    let tail = cliPath;
    let prefix = '';
    if (path.isAbsolute(cliPath)) {
        const rel = path.relative(home, cliPath);
        if (path.isAbsolute(rel) || /^\.\.(?:[\\/]|$)/.test(rel)) {
            // Somewhere else on disk, so the path carries no home prefix and is
            // rendered as itself.
        } else if (rel === '') {
            // The CLI path IS the home directory, which no install produces;
            // there is no tail to render and nothing worth guessing at.
            return null;
        } else {
            prefix = '$HOME/';
            tail = rel.split('\\').join('/');
        }
    }
    return safeCommandPath(tail) ? prefix + tail : null;
}

// The reminder, fixed prose around one library-rendered phrase carrying the two
// integers. It names the hook, states the hold, says the deferral is the
// mechanism rather than a fault, gives the clean-point ritual in order, says
// what to do mid-step, forbids the two shortcuts that would defeat the gate,
// and routes a session whose skill body an earlier compaction dropped back to
// executing-work. The test suite pins fragments of it, so a reword is a
// deliberate double-edit. cliPath is a parameter so both directions of the
// command clause are testable as a unit.
function buildReminder(phrase, cliPath) {
    const shown = commandClausePath((cliPath === undefined) ? CHECKPOINT_CLI : cliPath);
    const open = shown !== null
        ? 'then run node "' + shown + '" open from the project directory'
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

// The context reading at or above which the hold directive speaks, in tokens,
// when the machine-local signpost names none. The floor is on the VOICE and
// never on the gate's verdict: the gate keeps silently deferring an unmarked
// offer at any count, because deferral is free, so below this figure there is no
// prompt, no declaration and no marker traffic at all. The default is the
// recommended context WINDOW rather than a consumed reading, and it sits about
// one auto-compact reserve above the reading at which offers begin: the doctor
// recommends a 285000 window with a 35000 reserve, which puts the first held
// offer near 250000 consumed (doctor.ps1, $recommendedWindow and
// $autoCompactReserve). So a held seat hears the directive after roughly that
// much holding rather than at its first offer, which is the deliberate
// suppression the design asks for.
//
// The bound this figure has to be read against is the SEAT'S OWN CONTEXT WINDOW
// rather than the gate's safety ceiling. The reading compared against it is a
// hold's `consumed`, which traces to sumUsageFields over one assistant request's
// input, cache-creation and cache-read token counts, so it cannot exceed the
// window that request was made in. On a seat whose window is below this figure
// the directive therefore never fires at all, and the floor is reachable only on
// a seat whose window exceeds it. The default is the recommended window for that
// reason and not by coincidence.
const NUDGE_FLOOR_DEFAULT = 285000;

// The signpost's read cap. It holds a handful of short settings, so anything
// past 64 KB is not the file this reads, on readCheckpoint's own reasoning.
const SIGNPOST_MAX_BYTES = 64 * 1024;

// The hold directive's floor, from the signpost, with the default for every
// reading that is not a usable number. It is the read this hook COMPOSES a path
// for out of the home directory rather than out of the payload, which is what
// makes the home-directory screen below its own: every other read here is
// resolved from the project the payload names, and lands outside it only where
// kitScratchDir sends it there, under ~/.kit/store/ for a project directory
// lying inside the memory store, so a store-backed seat's hold is read from the
// home directory too without any path being built here. The reader is
// deliberately total: an absent HOME, an
// absent or unreadable file, a path that is not a regular file, an oversized
// one, unparseable JSON, JSON that is not an object, a missing key, and a key
// whose value is a string, a null, a NaN or a negative all mean the default.
// This hook runs after every covered tool return, so a reader that could throw
// here is a hook that dies constantly; the value is a threshold, so guessing the
// default is a defensible answer for every one of those readings and there is
// nothing a failure could usefully report to.
//
// Three hostile-boundary guards ride the read rather than being matched by hand.
// The home directory is refused when it names a network share, through the same
// predicate guard 4 applies to the payload's cwd: a roaming profile really can
// put HOME on a UNC path, and an open on an unreachable share blocks for the SMB
// timeout, which is the one failure this hook must never cause. And the bytes
// come through kit-read-lib's shared bounded reader, which settles the kind on
// the OPEN DESCRIPTOR rather than on the name: judging a name with lstat and
// then opening that same name leaves a window a local process can swap the file
// inside, and a swap to a FIFO in that window blocks the open forever, which is
// the same stalled tool loop the share check exists to prevent. That reader
// also bounds the read to the ceiling and reports a result it had to cut short,
// which is refused here rather than parsed: a truncated settings file is not
// the file this reads.
//
// The third is that reader's opt-in link refusal, and what it rests on is what
// the refusal DOES rather than any property of the file's writers. This read is
// scoped to one path under the home directory, and refusing a link at that final
// component is what holds it there: a link planted at the path cannot aim this
// read at a file elsewhere on disk, so the floor is read from ~/.claude/ or not
// at all, and the open cannot be handed a target on a dead network mount, which
// would stall a hook that runs after every covered tool return exactly as the
// share check above exists to prevent. Refusing means the default floor, which
// is this reader's answer for every other unusable reading.
//
// A leading BOM is stripped as defensive cover rather than for a writer that
// emits one: neither installer of this file does (setup.sh writes plain bytes
// and doctor.ps1 writes through a UTF8Encoding constructed with no byte-order
// mark), but the file is hand-editable on a platform whose editors add one, and
// a BOM left in front of the JSON makes the parse throw and silently costs an
// operator the floor they set.
//
// The require is deferred like every other kit library require in this file, so
// a damaged installed cache degrades to the default rather than to a throw on
// every covered tool return.
function nudgeFloor() {
    try {
        const home = os.homedir();
        if (typeof home !== 'string' || home === '') return NUDGE_FLOOR_DEFAULT;
        if (namesNetworkShare(home)) return NUDGE_FLOOR_DEFAULT;
        const signpost = path.join(home, '.claude', 'claude-kit.local.json');
        const read = require('./kit-read-lib.js')
            .readFileBounded(signpost, SIGNPOST_MAX_BYTES, { refuseLink: true });
        if (read === null || read.bounded) return NUDGE_FLOOR_DEFAULT;
        const raw = read.text;
        const parsed = JSON.parse(raw.charCodeAt(0) === 0xFEFF ? raw.slice(1) : raw);
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return NUDGE_FLOOR_DEFAULT;
        const floor = parsed.compactNudgeFloor;
        if (typeof floor !== 'number' || !Number.isFinite(floor) || floor < 0) return NUDGE_FLOOR_DEFAULT;
        return floor;
    } catch {
        return NUDGE_FLOOR_DEFAULT;
    }
}

// The hold directive: fixed prose interpolating nothing but the command, which
// is the same __dirname value the episode reminder renders and takes the same
// two guards, so a path the grammar refuses and a shell with no knowable home
// each cost the runnable clause and nothing else.
//
// It states the hold, names the one release a session with no leash has, puts
// the durability judgment in front of the model as a question it answers rather
// than a step it performs, and says what a no answer means. The judgment is the
// mechanism here: nothing can detect on the seat's behalf whether the worktree
// dirt around it is durable, so the directive asks for the three facts that
// settle it and leaves the call where it belongs. The moment sentence is not
// decoration either, because a declaration is honored only while no new turn has
// begun in the declaring session since it was written, so declaring mid-step
// spends the declaration on whatever the session does next.
//
// cliPath is a parameter so both directions of the command clause are testable
// as a unit, exactly as they are for the episode reminder.
function buildHoldReminder(cliPath) {
    const shown = commandClausePath((cliPath === undefined) ? CHECKPOINT_CLI : cliPath);
    const declare = shown !== null
        ? 'run node "' + shown + '" boundary from the project directory'
        : 'declare it by running the kit\'s kit-compact-checkpoint.js with the boundary argument, '
            + 'from the project directory';
    return 'compact-deferral-nudge: the compaction gate is holding this session\'s auto-compaction '
        + 'offers, and this session holds no kit goal leash in this project, so it has no chapter '
        + 'boundary for the gate to land them at. Unheld, they ride to the safety valve near the '
        + 'context limit, which lands the compaction at whatever this session happens to be doing '
        + 'then. At the end of this turn, answer the durability question: are your own worktree '
        + 'edits none or handed to a named owner, is every decision from this stretch on disk, and '
        + 'are the messages you owe sent? If all three are yes, ' + declare + ', and the next offer '
        + 'lands there. If any is no, finish it first and declare at that point: the declaration '
        + 'covers this moment only and lapses the moment new work arrives.';
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

// Guard 3: the subagent marker, read as truthiness the way the sibling
// detectors read theirs, and returning WHICH identity was seen.
//
// The key set lives in hooks/kit-agent-identity-lib.js rather than here, on the
// same reasoning as guard 4's network predicate below: four hooks ask this
// question on a per-tool-call boundary, and a hand-copied set that gains a
// spelling in three places out of four leaks silently, because the site that
// kept the old set simply keeps answering. A cache too damaged to supply the
// module answers "a subagent", which stands the nudge down: a deferral reminder
// spent inside a subagent is spent on a context that cannot act on it, so
// refusing is the cheaper error here exactly as it is for guard 4.
function agentIdentity(payload) {
    try {
        return require('./kit-agent-identity-lib.js').agentIdentity(payload);
    } catch {
        return 'unknown-agent';
    }
}

// Guard 4, the scratch-path screen beside it, and guard 6H: the UNC and
// //server forms, which are what a synchronous open can hang on for the SMB
// timeout. Exported so the suite can pin the predicate
// directly: the spawned end-to-end case can only prove the refusal where an
// SMB stack exists, and on a POSIX runner a doubled-slash path is an ordinary
// missing file that produces the same silence for another reason.
//
// The canonical definition lives in hooks/kit-network-lib.js rather than
// here (Standing Amendment 2): a module of a few lines, required directly by
// this hook, by scripts/memq.js (which re-exports it for
// hooks/memory-session.js's drift pass and hooks/memory-frontmatter-guard.js,
// both of which already hold memq for other reasons), and by
// hooks/chapter-boundary-nudge.js, which like this hook does not otherwise
// need memq. The require is deferred to inside this function rather than
// hoisted to module scope, on the same fail-toward-silence reasoning every
// other kit library require in this file carries: a damaged or missing
// installed cache must not crash a hook that runs after every covered tool
// return.
//
// A require failure answers true, refusing the call, not false: false is the
// checked-and-clean value this predicate exists to gate a synchronous open
// behind, and a damaged cache that cannot even supply this small module is a
// state this predicate cannot make sense of, not evidence the path is safe to
// open. Falling through on a network share can cost the tool call itself, and
// that is the same at both call sites.
//
// What the refusal COSTS differs between the call sites, and it is worth stating
// because only some of those costs are a silence. At guard 4 the subject is the
// payload's cwd and the gated read is guard 5's readGoal, so refusing stands the
// hook down for this tool return: one best-effort nudge. At the scratch-path
// screen the subject is the directory kit-compact-lib's resolver answers for
// this project, which is where the gate state and the hold stamps sit, and the
// cost is the same one nudge. At guard 6H the subject is the HOME directory and
// the gated read is the machine-local signpost, so refusing means the floor
// falls back to NUDGE_FLOOR_DEFAULT rather than to silence, and an operator who
// set a floor LOWER than the default gets a quieter hook while one who set a
// higher floor gets a louder one. That is the same answer this reader gives for
// every other unusable signpost reading, and a threshold is a figure the default
// is a defensible guess at, which is why the fail direction stays refusal at all
// three.
function namesNetworkShare(cwd) {
    try {
        return require('./kit-network-lib.js').namesNetworkShare(cwd);
    } catch {
        return true;
    }
}

// Guards 8 and 7H: has the interval elapsed since this stamp was written? An
// absent, unparseable or future-dated stamp reads as not-yet-nudged, per the
// header.
//
// One rule, two subjects, which is why the parameter is a stamp rather than a
// record. Guard 8 passes the open EPISODE's own nudgedAt out of the gate state,
// so its subject is the episode and every session under that episode shares the
// one interval. Guard 7H passes this SESSION's hold stamp out of the separate
// per-session file (holdNudgedAt), so its subject is the session and a hold owns
// no episode to carry a stamp for it. The two intervals are independent by
// construction and neither can silence the other; what they share is the length
// and this fail-open direction, which is self-healing at both because the fire's
// own stamp replaces the illegible value.
function intervalElapsed(nudgedAt, nowMs) {
    if (typeof nudgedAt !== 'string') return true;
    const at = Date.parse(nudgedAt);
    if (!Number.isFinite(at)) return true;
    const elapsed = nowMs - at;
    return elapsed < 0 || elapsed >= NUDGE_INTERVAL_MS;
}

// The hold path's three guards (5H to 7H in the header), for a session that
// holds no leash in this project. Stamps the hold's clock and returns the
// directive when the stamp landed; null on every other path, and never throws on
// its own account.
//
// It takes the library rather than requiring one of its own, so the deferred
// require in main() stays the single point where a damaged installed cache
// degrades this hook to silence.
function holdDirective(lib, cwd, sessionId, toolName, nowMs) {
    // Guard 5H: this session's own newest interactive deny, from the gate
    // state's per-session hold list, still inside the idle bound. A bystander
    // and a session in an unarmed project own no episode at all, so that record
    // IS the hold.
    const hold = lib.interactiveHoldOpen(lib.readGateState(cwd), nowMs, sessionId);
    if (!hold) return null;
    // The stamp guards below key on the spelling the records STORE rather than
    // on the raw payload id: every session field in these files goes in through
    // gateText, so a stored spelling and a raw one are what the two sides of a
    // lookup would otherwise be. This is a trap removed rather than a bug fixed,
    // and it is unreachable today from either end, since the guard above matches
    // the two before anything here reads a stamp and the library's own readers
    // apply the same rule to whatever they are handed. What it removes is the
    // asymmetry a later caller could inherit, by making the id this path carries
    // the canonical one from the record itself.
    const held = hold.session;

    // Guard 7H before 6H, which is an ordering rather than a renumbering: 7H
    // reads a small file inside the project this payload already named, while
    // 6H reads the machine-local signpost in the home directory. The saving is
    // real in one regime only. A hold at or above the floor is stamped when the
    // directive fires, so 7H answers no for the throttle interval and the home
    // read is skipped there. Below the floor nothing is ever stamped, so 7H
    // answers yes on every covered tool return and both reads happen, for the
    // whole stretch the floor is keeping this hook quiet; that is inherent
    // rather than an artefact of the order, since 6H is the home read and
    // nothing else can establish that the hold is below the floor. Neither
    // guard's answer depends on the other, so the order changes what is read and
    // never what is decided.
    //
    // Guard 7H: the interval since this session was last spoken to about a hold,
    // by the same rule and the same illegible-fires direction guard 8 applies to
    // an episode's own stamp.
    if (!intervalElapsed(lib.holdNudgedAt(cwd, held, nowMs), nowMs)) return null;

    // Guard 6H: the floor is on the voice, not on the verdict. An absent or
    // illegible consumed reading (null, which is what the library's own rebuild
    // leaves for every unusable value) is below every floor.
    if (typeof hold.consumed !== 'number' || hold.consumed < nudgeFloor()) return null;

    // The rate limit before the emission, never after it, for the reason the
    // header gives for guard 8: this stamp is the only cross-process carrier the
    // hold interval has, so a directive emitted without it is one with no rate
    // limit at all, repeating after every covered tool return into a context
    // already near the ceiling.
    if (!lib.recordHoldNudge(cwd, held, nowMs, toolName)) return null;

    return buildHoldReminder();
}

// The readings of the goal-state path that SETTLE the fork's question when
// readGoal has answered null, which are the only ones the hold path speaks over.
// goalPathKind's own words, and the three of its six that mean the same thing
// here: no goal any surface in this kit can act on is at that path, and nothing
// about the reading resolves on its own.
//
//   absent        nothing is at the path, which is the unarmed project the
//                 no-goal shape exists to serve.
//   unresolvable  the path can never resolve to a file (a regular file where a
//                 parent directory belongs, a link cycle above the final
//                 component, a name past the length limit), so there is no state
//                 to read and no arm can write one until it is cleared.
//   oversized     a regular file past the cap every reader of that file
//                 enforces, so no surface in the kit reads it: not this hook,
//                 not the gate deciding the deny in front of the session, and
//                 not the checkpoint CLI that would open a chapter boundary
//                 instead. What the file says about a leash is unreachable
//                 everywhere at once rather than here alone.
//
// The other three are stand-downs and each has its own reason. 'unreadable' is
// the uncertain reading proper: the kind could not be established at all, which
// a lock or a scanner produces and which lifts on its own. 'file' is a regular
// file within the cap that readGoal still answered null for, and that is two
// facts this hook cannot tell apart, a read that was refused (uncertain, and it
// lifts) and content that is not an armed goal (settled); telling them apart
// needs a discriminator on the READ, which the goal library does not export, so
// the pair takes the silent direction together. 'other' is a kind that is not a
// regular file, held here by the suite's own pin as an uncertain reading.
//
// Speaking over a reading that has NOT settled is what this list exists to
// prevent: the directive tells the session it holds no leash and points it at
// the role-boundary marker, so said to a session whose leash is merely
// unreadable this second it spends a declaration on a marker the gate's boundary
// leg never reads, and displaces the chapter checkpoint that session should have
// opened instead.
const SETTLED_GOAL_STATE_KINDS = ['absent', 'unresolvable', 'oversized'];

// Evaluate the four common guards, then the path guard 5 forks to, and return
// the reminder when that path's stamp landed; null on every other path. Never
// throws on its own account; the entry-point wrapper turns any escape into a
// silent exit 0.
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

    // Guard 5: a kit goal is armed for that project and this session holds its
    // leash, by either route a claim point acts on. This is the fork: a session
    // that holds no leash here takes the hold path instead of falling silent,
    // and reaches none of guards 6, 7 or 8.
    // The lib requires are deferred to here so a damaged installed cache
    // degrades to silence rather than a crash (see the header).
    let readGoal, sessionHoldsLeash, goalPathKind, lib;
    try {
        ({ readGoal, sessionHoldsLeash, goalPathKind } = require('./kit-goal-lib.js'));
        lib = require('./kit-compact-lib.js');
    } catch { return null; }
    const goal = readGoal(cwd);
    // Both spellings, because the gate and the Stop hook both accept both: a
    // harness emitting camelCase would otherwise keep opening episodes this
    // hook could never speak about.
    const sessionId = payload.session_id || payload.sessionId;
    const leashed = !!goal && typeof goal.plan === 'string' && goal.plan !== ''
        && sessionHoldsLeash(goal, sessionId);

    // Guard 4 again, over the answer the shared scratch-path resolver gives for
    // this project rather than over the payload's cwd. The two are ordinarily
    // the same directory, and for one project they are not: kit-compact-lib's
    // resolver sends a project directory lying under ~/.claude to a home-
    // anchored path outside the store, which is where a coordinator seat's gate
    // state and hold stamps live. A roaming profile really can put HOME on a UNC
    // path, and every read below opens one of those files synchronously after a
    // covered tool return, which is the stall the cwd screen exists to prevent.
    // Screening the resolver's own answer is what gives that guard to every
    // reader here, the episode path's state read and the hold path's stamp read
    // alike, rather than to the one caller a review happened to open;
    // nudgeFloor's home screen is the same guard on the third of these reads.
    // The directory is the subject rather than any one file, since every file
    // this hook reads through that library sits in it.
    if (namesNetworkShare(path.dirname(lib.gateStatePath(cwd)))) return null;

    // One clock for whichever path runs, so no path's guards can answer as of
    // different moments.
    const now = Date.now();
    if (!leashed) {
        // readGoal answers null for two different facts: no goal state at the
        // path, and a goal state that is there and could not be read (a lock, a
        // permission, a torn write, a kind that is not a regular file). The two
        // are opposite answers to the question this fork asks, so the null alone
        // decides nothing here. Only the first is an unarmed project, where the
        // hold directive is exactly right; on the second the session in front of
        // this may be the leash holder, and telling it that it holds no leash
        // points it at a marker the gate's boundary leg never reads, spending
        // the declaration on nothing and displacing the chapter checkpoint it
        // should have opened.
        //
        // What discriminates them is the KIND at that path, asked of the goal
        // library's own goalPathKind and answered against the settled list
        // above. A boolean absence test is not the discriminator this fork
        // wants: absence is one settled reading among three, and the other two
        // (a path that can never resolve, and a file past the cap every reader
        // of it enforces) are equally determinate and equally permanent, so a
        // test that only recognizes absence leaves this hook permanently silent
        // on a session the gate is actively holding. Every kind outside the list
        // is either uncertain or undiscriminated here, and takes the silence
        // this path is allowed to fail in.
        if (!goal && !SETTLED_GOAL_STATE_KINDS.includes(goalPathKind(cwd))) return null;
        // An ARMED goal with no binding is the one shape the hold directive
        // must not be spoken over, and the reason is the directive's own first
        // sentence: it tells the session it holds no leash in this project and
        // points it at the boundary marker. An unbound goal is claimable by
        // whichever session's arming text names it, read from a transcript this
        // hook deliberately never opens, so the session in front of it may be
        // the one that holds the leash and simply cannot be recognized from
        // here. That session's release is the checkpoint rather than the
        // marker, since the claim it is about to make routes it to the gate's
        // boundary leg, which never reads the role-boundary marker at all, so
        // the declaration would be spent on nothing. Standing down costs a
        // genuine bystander its directive for as long as the goal stays
        // unbound, which is the silent direction and the one this path is
        // allowed to fail in.
        if (goal && typeof goal.plan === 'string' && goal.plan !== '' && !goal.boundSession) return null;
        return holdDirective(lib, cwd, sessionId, payload.tool_name, now);
    }

    // One state read for guards 6, 7 and 8, so the three cannot answer as of
    // different files.
    // The session the three checkpoint questions below are scoped to: the
    // goal's binding where it has one, and otherwise this session, which the
    // guard above has just established holds a leash no claim point has written
    // down yet and which the gate recorded its own denials under. Always a
    // concrete id, never undefined, which those readers take as "any session's
    // hold counts".
    const owner = lib.checkpointOwner(goal) || sessionId;
    const state = lib.readGateState(cwd);

    // Guard 6: this binding is under a deferral episode right now.
    const episode = lib.gateEpisodeOpen(state, now, owner);
    if (!episode) return null;

    // Guard 7: no checkpoint of this run's is already matching.
    const cp = lib.readCheckpoint(cwd);
    const corroborated = lib.pendingOfferCorroborated(cp, state, now, owner);
    // The question is the one the NEXT offer answers rather than the one a
    // reader of the file would ask right now, because that offer carries the
    // claim: it binds the leash to this session and adopts an ownerless record
    // for it, so a boundary already banked in this window is honored there and
    // a directive to bank one would be false. Both substitutions are the
    // claim's own, the goal as it will be bound and the record as
    // adoptCheckpoint would leave it, the second taken only where
    // checkpointAdoptable says a claim would take it and only while no binding
    // exists to claim over. With a binding in place, owner IS that binding and
    // neither substitution changes anything, so a bound run asks exactly what
    // it always asked.
    const claimed = { ...goal, boundSession: owner };
    const banked = (lib.checkpointOwner(goal) === null && lib.checkpointAdoptable(cp, goal).ok)
        ? { ...cp, boundSession: owner }
        : cp;
    if (lib.checkpointMatches(banked, claimed, now, corroborated).ok) return null;

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

module.exports = {
    buildReminder, buildHoldReminder, nudgeFloor,
    NUDGE_INTERVAL_MS, NUDGE_FLOOR_DEFAULT, namesNetworkShare
};
