# Kit-goal is interactive-only: only the operator's typed /kit-goal arms a leash

Status: Ready
Commit Model: Branch-and-PR
Disjoint: yes
Created: 2026-09-24

Session model: any executor session in the kit repo, run without a kit-goal leash; three sections in order. Authored 2026-09-24 by the DEV-PLUGIN supervisor session on SCOTT-CLAUDE, anchored at trunk `eb2c4e1a`. Every line number below reads at that commit; re-locate every hit by content.

## Dispatch Authorization

The operator approved this plan on 2026-09-24 on the DEV-PLUGIN session's relay thread ("Fascinating. Okay, let's do that, I can get behind that pattern. We'll draw the line where `/kit-goal` is just for interactive, and you rely on the Supervisor/Keeper/Personas framework to run plans. Please proceed!"), to run after the sidecar verdict split, and only once the ARCHITECT persona session has reviewed it and given its blessing. This section records the approval; under the rule this plan ships it is not an arming authority, and no session arms this plan for itself.

## Intent

The frame, in the operator's words on 2026-09-24: "When I type `/kit-goal` to arm a plan, we stamp those plans *and that Session ID* into the Leash. That is the **only** thing that should Stamp a Session ID. If that session crashes, or stops running, a new session needs to be started, and I need to type `/kit-goal` into that one to arm it. As long as you are in a directory, where there is an armed leash, and your session matches it, the stop hook should fire. If the leash is armed for anyone else, it should be ignored." And: "`/kit-goal` is just for interactive, and you rely on the Supervisor/Keeper/Personas framework to run plans." On enforcing it in code: "agreed, let's enforce in code. It won't let me arm in Discord that way, but that is the point, I'm saving this for Interactive sessions only."

The gap: the kit's own skills tell a running session to arm a leash for itself (`arm --self-armed`) from a plan's `## Dispatch Authorization`, to re-arm itself after a restart, and to append inbound plans. Supervised personas did exactly that without the operator knowing, and a self-armed leash held by a dead session is what left a relaunched persona idle for four hours on 2026-09-16.

**What done needs.** The goal CLI's arm, in both its bare and append forms, refuses unless the calling session's own transcript shows the operator typed `/kit-goal` naming each plan being armed. The `--self-armed` flag is gone. Every skill, doc and hook message that tells a session to arm, re-arm or append for itself says instead that a leash comes only from the operator's typed `/kit-goal`, and that a run without one proceeds unleashed.

**What done does not need.** A takeover or any other recovery that binds a session the operator did not type in, because the operator ruled none is wanted. Removal of the claim routes that bind the arming session at its first stop or compaction offer, because with the arm gated they can only bind the session the operator typed in. A gate on `clear` or `status`, because neither stamps a session. Removal of the `## Dispatch Authorization` format or its extraction at arm time, because plans still record approvals with it.

**Alternatives refused.** Rewriting the prose only, refused because a rule no mechanism holds is the one that failed silently before: any session can run the arm without the flag and be recorded as the operator. Removing only the `--self-armed` flag, refused for the same reason. The leash takeover plan, abandoned the same day on this ruling.

**Rulings after the spec shipped.** None yet. The ARCHITECT persona session's blessing, when given, is appended here as a dated ruling, and the plan does not start until that line exists.

Provenance: distilled from the DEV-PLUGIN session's relay thread with the operator on 2026-09-24, and that session's read-only scout sweep at `eb2c4e1a`.

## Goal

When this is done, only the operator's typed `/kit-goal` stamps a session into a kit-goal leash. The goal CLI's `arm` and `arm --append` read the calling session's own transcript and proceed only where a user entry the operator typed there invokes `/kit-goal` with each named plan in its arguments; otherwise they refuse, naming the rule, and write nothing. The `--self-armed` flag no longer exists: the CLI refuses it as an unrecognized flag with a line naming the rule. Every surface that told a session to arm, re-arm or append a leash for itself, in the skills, their rationale ledgers, the hook messages, `docs/architecture.md`, `docs/security-model.md` and `README.md`, instead states that a leash comes only from the operator's typed `/kit-goal` in an interactive session, that a session whose leash is bound elsewhere ignores it, and that a supervised persona runs plans unleashed, kept moving by its supervisor. It matters because a self-armed leash outlives the session that armed it, and the kit's own instructions to self-arm are what stranded a relaunched persona for four hours.

## Approach

**The gate reuses the detector the claim routes already trust.** `userCommandArgsClaimPlan(transcriptPath, planRel)` in `plugins/claude-kit/hooks/kit-compact-lib.js:4518`, over `userCommandArgsInclude` (`:4402`), already decides whether a session's transcript shows the operator typing `/kit-goal` with a plan path: it reads only non-sidechain, non-meta, non-compact-summary user entries, discards any entry carrying a tool block, strips local-command output, and accepts either the harness's `<command-name>/kit-goal</command-name>` markup with the path inside a `<command-args>` span, or a message whose first non-whitespace characters are the `/kit-goal` token with the path inside the argument block after it. Assistant text, tool output, attachments and injected records never count. A relay message arrives wrapped in a `<channel>` tag, so its first character is `<` and it never anchors (inferred from the anchor rule at `:4453`; section 1's tests confirm it). The Stop hook (`kit-goal-stop.js:753-805`) and the compaction gate (`kit-compact-gate.js:596-649`) use this detector to claim an unbound goal for the session the operator typed in. The arm gate calls the same function, once per plan, against the transcript `cmdArm` already locates (`kit-goal.js`, `findTranscript(sessionId)`), so the rule has one reader, not two.

**The needle is the plan's repo-relative path, then its basename, and the shared detector does not change.** `normalizePlanArg` (`kit-goal-lib.js:1642`) resolves each plan argument against the working directory into a repo-relative path and does no filename lookup, so where the operator types a bare filename the model expands it to `docs/plans/<file>` before it runs the CLI, and the repo-relative path is then absent from what the operator typed. The gate therefore calls `userCommandArgsClaimPlan` with the plan's repo-relative path and, where that fails, again with its basename. The basename is safe here though the claim routes refuse it, because the detector only ever reads it inside the argument block of a typed `/kit-goal`, never in prose. `userCommandArgsClaimPlan` and `userCommandArgsInclude` are called as they stand; the Stop hook's and the compaction gate's claims accept exactly what they accept today. A multi-plan arm passes when each plan is named in some typed `/kit-goal` in this session, in one invocation or several.

**What the gate refuses, and why the refusal writes nothing.** No session id, no transcript the CLI can locate, an unreadable transcript, or a plan the transcript's typed `/kit-goal` does not name: each refuses before `armGoal` or the append runs, naming the cause and the rule, because a refused arm that wrote a partial state would be a stamp by another name. The failure direction is the unleashed run the operator ruled is the persona's normal state, so a refusal costs a session nothing it was entitled to. The detector reads the transcript through `readTranscriptCapped` (`kit-compact-lib.js:4254`), which on a file over 512 KiB reads its first 384 KiB and its last 128 KiB. The kit-goal skill runs the arm in the turn the operator typed `/kit-goal`, so the typed entry sits in the tail; a typed entry that has fallen into the unread middle refuses, and the remedy the refusal names is typing `/kit-goal` again.

**What stays.** The claim routes stay: `armingSessionClaims` and the typed-command claim in the Stop hook and the compaction gate, with `sessionHoldsLeash` and its consumers in the checkpoint CLI and the deferral nudge. With the arm gated, the arming session is always the session the operator typed in, so these routes bind nothing else. `armedBy` stays in the state. The state's readers (`normalizeState`, `composeCondition` and the status report) keep accepting a stored `self` value, so a goal state armed before this change reads correctly. `armedByArg` (`kit-goal-lib.js:401`), which validates the authority `armGoal` and the append are handed rather than anything stored, accepts only `operator`. `bindSession`, `clear`, `status` and the session-start notices do not change behavior; the notice's existing sentence that a typed `/kit-goal` re-arms is already the rule.

**The sweep.** A read-only Explore scout at sonnet ran 2026-09-24 over `eb2c4e1a` with the question "every surface that lets a session other than the one the operator typed `/kit-goal` in stamp or claim a session into the leash, and every prose surface that tells a session to arm, re-arm, append to, or claim a leash on its own", over `plugins/claude-kit/` code, skills, agents, commands, `docs/` outside the archive, `README.md`, and `test/`. A follow-up count of `self-armed`/`selfArmed` and of `re-arm` per file, with the kit-goal skill as the known-positive control, widened it. Code: `hooks/kit-goal.js` (usage banner `:5-18`, `cmdArm` `:257-285`, `unauthorizedWarning`, the flag parser `:581-585`), `hooks/kit-goal-lib.js` (`armedByArg` `:401-416`, `armGoal` `:1889-2014`, the append's `armedBy` write `:2149-2189`, `composeCondition`'s self-armed text), `hooks/kit-compact-checkpoint.js` (`REARM_REMEDY`, `BOUNDARY_VERB_REMEDY` `:794-811`), `hooks/compact-deferral-nudge.js`, and the re-arm prose in `hooks/kit-goal-stop.js`, `kit-compact-gate.js`, `kit-compact-lib.js` and `session-start.js`. Prose: the kit-goal, executing-work, peer-sessions, coordinator, finishing-work, curating-docs and standing-watch skills and the rationale ledgers under the kit-goal, executing-work, coordinator, finishing-work, peer-sessions and standing-watch skills; `docs/architecture.md` (`:286`, `:292`, and the leash narrative), `docs/security-model.md`, `README.md:217`. `docs/architecture.md:320`'s "self-armed timer" names the coordinator's native `/loop` wake, not the leash, and is left alone. Tests: `test/kit-goal-lib.test.js`, `kit-goal-stop.test.js`, `kit-compact-gate.test.js`, `compact-deferral-nudge.test.js`, `chapter-boundary-nudge.test.js`.

## Sections of Work

### 1. The arm refuses without the operator's typed /kit-goal, and --self-armed is gone
Model: opus

In `plugins/claude-kit/hooks/kit-goal.js`, `cmdArm` gates both forms (bare and `--append`) before any write: it locates the caller's transcript as today, and for each plan argument it asks `userCommandArgsClaimPlan` (exported from `kit-compact-lib.js`; export it if it is not) whether the operator typed `/kit-goal` naming that plan in this session, per the Approach's matching rule. Any plan it does not name, a missing session id, an unlocatable or unreadable transcript each refuse with exit 1, one stderr line naming the cause and the rule ("a leash is armed only by the operator's typed /kit-goal in this session"), and no write: nothing created or changed under `.kit/`, and no goal event emitted. A bare `arm` with no plan argument prints usage as today. The `--self-armed` flag is removed from the flag set, the usage banner and `unauthorizedWarning`'s caller; passing it refuses as an unrecognized flag, with the refusal line naming the rule rather than only the flag. `armGoal` and the append always record `operator`; the state's readers keep accepting a stored `self`, per the Approach. The two remedy constants in `kit-compact-checkpoint.js` and any hook message that tells a session to re-arm for itself (in `kit-goal-stop.js`, `kit-compact-gate.js`, `kit-compact-lib.js`, `compact-deferral-nudge.js` and `session-start.js`, found by grepping those files for `re-arm` and `self-armed`) instead name the operator's typed `/kit-goal` as the only arming, and where no leash is armed, that the run proceeds unleashed. Rebuild (`build.ps1`) before gating, since this edits hooks.

Acceptance:
- A CLI arm, bare and `--append`, whose session transcript holds a typed `/kit-goal` naming the plan (markup shape and typed-lead shape) arms as today and records `operator`.
- A CLI arm whose typed `/kit-goal` names the plan by its bare filename arms; a multi-plan arm whose plans are named across two typed invocations arms.
- A CLI arm whose transcript holds no typed `/kit-goal`, or one naming a different plan, or the plan only in assistant text, tool output, a sidechain entry, an `isMeta` entry, or a relay message wrapped in a `<channel>` tag, refuses with exit 1 and leaves the goal state byte-identical, creates nothing under `.kit/`, and emits no goal event.
- A CLI arm with no session id, or with no locatable transcript, refuses with exit 1 and writes nothing.
- On a transcript over 512 KiB, a typed `/kit-goal` in the last 128 KiB arms, and one only in the unread middle refuses with a line naming the remedy (type `/kit-goal` again).
- `arm --self-armed` refuses with exit 1, naming the rule, and writes nothing.
- A goal state recorded before this change with `armedBy` `self` still reads, advances and reports as it did.
- The remedy text the checkpoint CLI, the Stop hook, the compaction gate and the deferral nudge print names the operator's typed `/kit-goal` and never tells a session to arm for itself.
- The lane runs green on its own exit code: `node --test test/kit-goal-lib.test.js test/kit-goal-stop.test.js test/kit-compact-gate.test.js test/compact-deferral-nudge.test.js test/chapter-boundary-nudge.test.js test/session-start-goal.test.js test/hook-canary.test.js test/size-ratchet.test.js`, after `build.ps1`.

Files in scope: `plugins/claude-kit/hooks/kit-goal.js`, `plugins/claude-kit/hooks/kit-goal-lib.js`, `plugins/claude-kit/hooks/kit-compact-lib.js` (the export, and its re-arm comments), `plugins/claude-kit/hooks/kit-compact-checkpoint.js`, `plugins/claude-kit/hooks/compact-deferral-nudge.js`, `plugins/claude-kit/hooks/kit-goal-stop.js`, `plugins/claude-kit/hooks/kit-compact-gate.js`, `plugins/claude-kit/hooks/session-start.js` (message text only), the five test files the Approach's sweep names plus `test/session-start-goal.test.js`, and `test/size-budget.json`.

Tests: the existing typed-command claim tests in `test/kit-goal-stop.test.js` and `test/kit-compact-gate.test.js` build both transcript shapes and are the fixture model. Lock both directions of the gate: a typed `/kit-goal` naming the plan arms, and each excluded source (no invocation, another plan, assistant text, tool output, sidechain, isMeta, a `<channel>`-wrapped relay message) refuses and writes nothing; lock `--self-armed` refused; lock a stored `self` still read. The expensive failure is a gate that passes a session the operator did not type in, which reads exactly like today's self-arming.

### 2. The skills, ledgers and docs say a leash comes only from the operator's typed /kit-goal
Model: opus
Locus: inline

Rewrite every prose surface the Approach's sweep names so it states the rule as it now runs: a leash comes only from the operator's typed `/kit-goal` in an interactive session; a session whose leash is bound elsewhere ignores it; a supervised persona runs a plan unleashed, kept moving by its supervisor; and a run that finds no leash neither arms nor re-arms one for itself, but proceeds. In the kit-goal skill: the `--self-armed` paragraphs (`:22`, `:34-42`, `:50`, `:52`, `:54-64`, `:66`, `:100`) are rewritten or cut, and the `## Dispatch Authorization` passage says a plan's committed grant records approval and never arms. In executing-work: the re-arm remedy (`:85`, step 0 `:127`, step 8's remedy sentence), the mid-run arming trigger (`:87-93`) and the park paragraph's re-arm recovery (`:79`) are rewritten so a run without a leash proceeds unleashed and an inbound plan is run, not armed. In peer-sessions: the arming-on-a-grant passage (`:39-53`) and `## Leashed peers` (`:157-169`). The coordinator, finishing-work, curating-docs and standing-watch skills' re-arm mentions are read and rewritten where they tell a session to arm for itself. The rationale ledgers under those skills follow `docs/rationale-ledgers.md`: an entry whose key states only the self-arming rule takes `verdict: retire`; an entry whose passage was rewritten, a compound key that also states a surviving rule included, keeps its key and takes `verdict: rewrite`; each flipped entry owes `- landed: <commit> section 2` at the close pass; and the new rule, that only the operator's typed `/kit-goal` arms a leash, takes one new entry in the kit-goal skill's ledger under the letter Y. `docs/architecture.md` (`:286`, `:292`, the leash narrative), `docs/security-model.md` (a sentence on what the arm now trusts: the calling session's own transcript, the one the harness writes under the projects tree) and `README.md:217` follow. Resync `test/size-budget.json` for every row the rewrite moves.

Acceptance:
- No surface under `plugins/claude-kit/` outside the rationale ledgers' retired entries, none under `docs/` outside `docs/archive/` and `docs/plans/`, and not `README.md`, tells a session to arm, re-arm or append a leash for itself, or names `--self-armed` as a live flag. The check is a grep for `self-armed`, `selfArmed`, `re-arm` and `arm --append` over those roots, each remaining hit read and named with the reason it stays; the kit-goal skill at `eb2c4e1a` is the control that the grep speaks.
- The kit-goal skill states the rule in the operator's frame: typed `/kit-goal`, interactive sessions, a bound-elsewhere leash ignored, personas unleashed.
- Every ledger entry the rewrite reaches carries its flipped verdict, and the kit-goal ledger carries the one new Y entry, per `docs/rationale-ledgers.md`, and `test/docs-curator-charter.test.js` and the parity tests pass.
- The docs lane runs green on its own exit code: `node --test test/doctrine-parity.test.js test/output-style-parity.test.js test/claim-class-parity.test.js test/markdown-marker-parity.test.js test/docs-curator-charter.test.js test/docs-write-guard.test.js test/stop-docs-hygiene.test.js test/session-start-backlog.test.js test/size-ratchet.test.js`.

Files in scope: `plugins/claude-kit/skills/kit-goal/SKILL.md`, `plugins/claude-kit/skills/executing-work/SKILL.md`, `plugins/claude-kit/skills/peer-sessions/SKILL.md`, `plugins/claude-kit/skills/coordinator/SKILL.md`, `plugins/claude-kit/skills/finishing-work/SKILL.md`, `plugins/claude-kit/skills/curating-docs/SKILL.md`, `plugins/claude-kit/skills/standing-watch/` (its SKILL.md where it states the rule), the `references/rationale-ledger.md` of the kit-goal, executing-work, coordinator, finishing-work, peer-sessions and standing-watch skills, `docs/architecture.md`, `docs/security-model.md`, `README.md`, `test/size-budget.json`.

### 3. The memory record and the backlog match the shipped rule
Model: sonnet
Locus: inline

The operator-tier memory record `kit-goal-is-for-interactive-sessions-only` (the store-wide tier of the kit memory store, outside the repository, read with `memq get kit-goal-is-for-interactive-sessions-only --operator`) says the skill text is stale until this plan lands. Rewrite its last two paragraphs to state the rule as shipped, naming the arm gate, with `memq add-operator kit-goal-is-for-interactive-sessions-only "<description>" --update --body-file <path> --confirm-shared`; a memory write is standing-authorized for any session. `docs/backlog.md`'s 2026-08-27 item that no kit goal is armed for this project reads against the new rule and is retired or rewritten with the reason, per the curating-docs skill; any other item the close-out prune finds this plan settled takes the same treatment. Too small to brief.

Acceptance:
- `memq get kit-goal-is-for-interactive-sessions-only --operator` reads the shipped rule with no sentence calling the skills stale.
- Each backlog item the plan settles is moved to the quarter's snapshot or rewritten, with the reason, per the curating-docs skill.

Files in scope: `docs/backlog.md`, `docs/archive/backlog-2026-Q3.md`, the operator-tier memory record (outside the repository).

## Out of Scope

- Removing `armingSessionClaims`, the typed-command claim, `sessionHoldsLeash` or any claim route in the Stop hook and the compaction gate (Intent, what done does not need).
- Any takeover or recovery that binds a session the operator did not type in.
- Gating `clear` or `status`.
- Removing the `## Dispatch Authorization` format, its extraction at arm time, or the `armedBy` field from the state.
- The supervisor's goal tree and its nudges, which live in the agentic plugin.
- `docs/architecture.md:320`'s "self-armed timer", which is the coordinator's native `/loop` wake.
- The compaction checkpoint's `boundary` verb refusing from both a worktree and its project root for a session that moved into a worktree; a separate friction, sent to the kaizen inbox.

## Assumptions

- assumed 2026-09-24 (the goal library and hooks at `eb2c4e1a`): the claim routes stay, since with the arm gated they bind only the session the operator typed in; reversal: a further section removing `armingSessionClaims` from the Stop hook, the compaction gate, the checkpoint CLI and the deferral nudge.
- assumed 2026-09-24 (default): a stored `armedBy` value `self` from before this change keeps reading, and the arm writes only `operator`; reversal: a migration that rewrites stored values, which no requirement names.
- assumed 2026-09-24 (`docs/rationale-ledgers.md` and the ledger letters in use at `eb2c4e1a`, C F P R S T U V W X): this plan's ledger entries take the letter Y; reversal: the next free letter if another plan takes Y first.

## Operator Verification

- After the plan lands and the plugin is updated, in an interactive session type `/kit-goal <a plan path>` and confirm it arms; then in a persona session have the model run `kit-goal.js arm <plan path>` without a typed `/kit-goal` and confirm it refuses naming the rule. An arm that proceeds without a typed invocation reopens section 1.

## Open Questions

None. The operator decided the code gate on 2026-09-24 on the relay thread, knowing it rules out arming from Discord. The ARCHITECT persona session reviews the plan before it runs, per the Dispatch Authorization.

## Related

- `docs/archive/claude-kit_leash-takeover_spec_v1.md`: the plan abandoned on the ruling this plan ships.

## Chapters
