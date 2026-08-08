---
name: executing-work
description: "Autonomous execution of an approved spec or plan from docs/plans/. Use when I say to proceed, implement, build, or continue an agreed plan, or when resuming a session that has an In Progress plan doc."
---

# Executing Work

The contract: once the spec is approved, proceed autonomously to completion. No per-step check-ins, no "should you continue?", no gating individual edits. The spec is the agreement; execute it.

Interrupt me only for: a contradiction inside the spec, a decision the spec does not cover with material consequences, a destructive or irreversible action, or a systematic-debugging dead end (per that skill's stop-and-report rule). Everything else is yours to resolve and record.

## The completion contract

The spec is the goal. Once execution starts, run every remaining unblocked section to completion in this session. A section boundary is not a stopping point. A long-running gate is not a stopping point. Context pressure is not a stopping point. The only reason to stop mid-spec is a true blocker, and when you hit one you make it impossible to miss.

For an externally-driven worker (the External-engine stand-down), the directed section is the whole goal: finishing that one section and stopping is completion under this contract, never an early stop, because the engine verifies the section and spawns the next worker itself.

This is the rule that fails most often under the pressure of a long run, so it is stated as a hard prohibition, not a preference.

**Do not end your turn** to:

- report progress between sections ("§3 done, say the word and start §4"). Close the section and start the next.
- wait on a build, test suite, or Live gate ("holding for the gate, ~2 min"). Wait on it in-turn: background it and poll a readiness signal (`until` on a marker or exit code), then continue when it returns.
- manage context ("pausing here rather than open §7 at the tail of a long run"). The Chapter plus the SessionStart resume hook make a fresh session lossless; starting one is my call, never your reason to halt.
- await a dispatched subagent ("holding while the implementer builds §3.1b"). A background agent (`run_in_background: true`, the Agent-tool default) ends your turn to await its completion notification, and under an armed leash that turn-end is a stop the hook blocks and re-bills your whole context on. A wait is not a stop here either: keep the turn alive. Dispatch a single critical-path implementer synchronously (`run_in_background: false`) so its whole run is one in-turn call; for any other live agent (a parallel fan-out member, or an agent continued via SendMessage, which always resumes in the background), wait in-turn on real task status: `TaskOutput(task_id, block: true)` blocks until the run completes, resumed runs included, so loop the call past its 10-minute per-call cap until status reads completed. A call that times out mid-run returns a raw truncated slice of the agent's JSONL transcript inline (thinking blocks and tool payloads, not the report); only a call whose status reads completed yields the final message, so treat a timeout's payload as the expected cost of an overrun and call again, never as the result and never as a stall. Never infer completion from transcript-file quiescence: a mid-run pause reads as done, and an agent task's output file is that same transcript, unsafe to Read whole. Never end the turn on a completion notification while a leash is armed, and never clear the leash to escape the block: that abandons the very continuity it exists to hold.

Rationalization table (the excuse, and why it is wrong):

| The excuse | Why it is wrong |
|---|---|
| "This is a clean boundary to pause at." | Clean boundaries are for resuming, not for stopping with work left. Continue. |
| "Holding for the gate." | A wait is not a stop. Poll the gate in-turn and continue. |
| "It is the tail of a long run, safer to stop." | The Chapter plus resume hook protect you. Context is my call, not a stop condition. |
| "Let me confirm before continuing." | The approved spec is the confirmation. Continue unless a true blocker hits. |
| "I'll end the turn to await the dispatched agent's notification." | Awaiting is a wait, and a wait is not a stop. Foreground the dispatch (`run_in_background: false`) or block on `TaskOutput` in-turn; do not end the turn, and do not clear the leash to get out of the block. |
| "I don't have enough context left to review the next round properly." | Compaction gives you a fresh window and the plan doc carries the state. The choice is not stop-versus-ship-unreviewed; it is compact-and-review versus abandon. Continue. |

The table is instances, not the boundary: any reason to stop with unblocked work remaining that is not in the blocker set below is wrong the same way, whether or not a row names it.

Red flags that you are about to stop wrongly: "say the word and continue", "holding for", "paused here", "at the tail of", "ready to continue when you are", "holding while the agent builds", "awaiting the notification". If you are about to write one of these with unblocked work remaining, do not. Keep going.

**Stop only for a true blocker, and make it loud.** The blocker set:

- an external dependency only I can satisfy (a GUI action like a Docker memory bump, a cloud resource that must be provisioned, a credential or secret you cannot reach),
- a contradiction inside the spec, or a material decision the spec does not cover,
- a destructive or irreversible action that needs my yes,
- a systematic-debugging dead end.

The set is closed. Capacity is never on it: native compaction gives a fresh window with the leash intact, and the plan doc plus its Chapters carry the state, so a stop reasoned from context is a stop dressed as a blocker.

When you stop, the message's very first characters are `BLOCKED: <exactly what you need from me>`, so I see it in seconds rather than discovering a silent halt hours later. The body under the prefix is a decision brief in the doctrine's client-briefing register (situation, decision, stakes, options with trade-offs, argued recommendation, what happens while it goes unanswered, evidence references at the end): a BLOCKED lands on my phone hours later with no session context, so it must be decidable from the brief alone. The bare prefix opens the message: no close-out summary above it, no bold or heading wrapping it; put any shipped-work recap after the BLOCKED paragraph. The Stop hook releases only on that exact leading prefix and deliberately ignores a `BLOCKED:` sitting mid-message (quoting the convention must never release the leash), so a summary-first stop bounces and costs an extra turn. A release whose BLOCKED line gives capacity as its reason (context, compaction, a fresh session) is refused the same way: capacity is not in the set, so that stop bounces too. A progress update is not a stop and must not be written as one. The `/goal` Stop hook is a backstop, not the mechanism; this contract is the mechanism.

Waiting is the third stop shape. When the turn's only remaining work is background subagents already dispatched, do not hold the turn open with a foreground wait, and do not dress the pause as a blocker: end the turn with `WAITING:` as the very first characters, naming what is pending. The leash allows that stop without releasing (the goal stays armed), the completion notification re-invokes the session, and the run continues under the same leash. The same literal-leading-prefix mechanics as BLOCKED apply, and a WAITING whose reason is capacity is refused the same way.

**The goal template.** A plan run's completion leash is armed in one line with `/kit-goal docs/plans/<plan>.md`. The kit-goal skill owns the canonical condition and enforces it with a deterministic kit Stop hook; the condition is met when (a) every section is complete and closed out, or (b) you are BLOCKED on a decision only I can make and have documented what you need from me and how I can provide it.

Arming costs nothing on a long run because the state outlives the session. The kit hook's state is a file in the project (`.kit/`), which no session boundary can delete, and native compaction preserves the session id, so an armed run rides its own auto-compactions with the leash intact. A session the hook cannot tie to the bound one is treated as a bystander and allowed to stop, so if a run is ever left unheld, re-arming with `/kit-goal <plan path>` is the one-line recovery and resets the binding.

**Handoff.** When execution begins inside a conversation that was just brainstorming, say so in one line ("Spec approved, switching to autonomous execution of all N sections") so I see the mode change and can scope it down ("just §1") if I want. I should never have to set an external goal to get full execution.

## Before starting (or resuming)

Read the plan doc in full, **including all Chapters**. The Chapters are the state: they record what is done, what surprised us, and the commit model in effect. After a compaction, this re-read is mandatory before touching any file.

**Then run `memq recall`, once, before the first section.** It returns the whole memory store as one bounded digest; the memory-system skill owns what the digest contains and how to act on it. The plan doc carries the effort's own state, and the digest carries what earlier efforts learned the hard way, which a plan written days ago cannot cite because nobody had recorded it yet. Read it against the sections ahead and carry forward what bears on them. On a resume, run it again rather than trusting a recollection of an earlier pass, and when a recalled record changes what you build, stamp it in that turn with `memq touch <name> --applied`.

Run it from the main checkout. `memq` resolves the store from the cwd unless an external engine pinned it, so a worktree at a different path resolves a different, empty store, and the tell is a digest whose coverage lines all read zero on a project you know has memories.

**External-engine stand-down.** When the driving directive states that an external engine owns continuation by spawning a fresh worker per section (Spine's Dispatch pump is one), or the environment carries `KIT_EXTERNAL_ENGINE` (the marker such an engine sets at spawn), the engine is the supervisor and this session is its worker. Run the section loop for the directed section only. The marker is a directive to you, not a mechanism: treat it exactly as you would the driving directive's own words. The **worker runs this skill** - it orchestrates, dispatches implementers, and writes Chapters exactly as any session would; it does not absorb implementation inline just because it is headless.

**Branch check.** Nothing is committed to main or master without my explicit permission. Commit-and-Push is that permission for its own repos; in a shared repo without it, treat the work as Branch-and-PR and note the substitution in the Chapter. If concurrency put you in a worktree on a feature branch, that is your workspace; integration and any teardown happen in finishing-work. Expect sibling sessions to touch the same repo, so own a disjoint set of files and never stage another session's work.

## Section loop

For each Section of Work, in order:

1. **Confirm the approach, then implement.** Before writing a section whose mechanism the spec assumed without reading the code, do a quick in-session read of the files it touches and confirm the planned approach holds. A spec written during brainstorming can be fictional about code nobody had open yet. This is a lightweight read, not a fan-out; if the real shape differs materially, adjust and note it in the Chapter (raise it to me only if it changes design intent). Then implement per the section's model tier, which is a dispatch instruction rather than a hint: a section carrying a `Model:` tier goes to that tier's implementer, and the doctrine's standing dispatch request covers it, including where a session-prompt line makes dispatch conditional on my having requested it.
   - **A section that writes under `docs/` goes to the main thread regardless of the tier it carries.** The docs-write-guard denies any non-curator subagent a write into `docs/`, so a dispatched implementer is blocked mid-section; doc authoring is also design-entangled (voice, structure, cross-references). An implementer may still draft the prose and return it in its final message for the main thread to place, but the `docs/` write itself is always the main thread's. (This is a routing override, not a tier change: record `Locus: inline` under the section's `Model:` line so the override is visible up front, and leave the `Model:` value the bare tier it earned.)
   - **Tier `haiku` / `sonnet` / `opus` / `fable`:** dispatch the matching `implementer-haiku` / `implementer-sonnet` / `implementer-opus` / `implementer-fable` agent with a complete brief built from the Dispatch Brief template:

     ```
     Dispatch Brief (all REQUIRED unless marked):
     - Spec path + section name
     - Files in scope
     - Acceptance criteria (verifiable)
     - Rich references: the section's References: line when the spec has one,
       plus any mockup, rubric, or reference implementation its acceptance
       leans on, by path
     - Tests: the section's Tests: line verbatim when the spec has one (a floor:
       extend with what implementation reveals, never shrink, flag amendments);
       else the test-worthiness call and what a test should lock
     - Sibling pattern to mirror, when one exists: name it AND require mirrored
       failure-mode breadth (catch scope, regex generality)
     - Error and delete semantics to preserve (throw vs truncate, hard vs soft
       delete, explicit NULL vs column default); the happy path is not the
       contract
     - Pin tests + new expected values, when the section changes a counted
       cross-cutting set
     - Standing Brief Amendments: every entry from the plan doc's block, when one exists
     - Workspace constraints the agent cannot see from the tree, when any are
       in effect: state a sibling session, the leash, or the environment owns
       (a shared stash, another session's worktree files, a process holding
       binaries) and the operations that state puts off-limits (a bare
       `git stash`, a reset or checkout reaching beyond its own files)
     - Every load-bearing technical assertion you make marked confirmed or
       inferred: a confirmed one names its evidence (file:line, the command you
       ran), an inferred one says so and says to verify it before relying on it.
       An unmarked assertion reads as settled fact and gets obeyed instead of
       checked, which is how a wrong premise in a brief becomes a wrong
       implementation that passes its own gate
     - Workaround bar: a workaround needing a paragraph to justify means fix the
       code or escalate
     - Style-skill file paths (agents inherit no skills): resolve the plugin
       root at brief-writing time by the same ladder `kit-doctor/SKILL.md`
       uses - `CLAUDE_PLUGIN_ROOT` when the harness provides it (a session's
       own shell does not see this variable; it reaches a process only
       through a hook's command environment), else this skill's own base
       directory's grandparent (a session is told its skill's base
       directory when the skill loads, and the plugin root is one level
       above `skills/executing-work/`) - then write the resulting absolute
       path, `<root>/skills/<name>/SKILL.md` (plus its references/ file when
       one exists), into the brief. It only needs to resolve for the life of
       the agents this brief dispatches. The resolved root can legitimately
       look like a versioned cache path (`plugins/cache/.../<hash>/`) under
       a marketplace install - that is correct, because it was resolved this
       session rather than copied from an old one. What this replaces is
       hardcoding either shape as a literal in this file: a marketplace-clone
       literal does not exist at all under an external engine's
       `--plugin-dir` payload, and a cache-path literal stops existing at
       the next kit update. Resolve fresh every time; never write either
       shape into this bullet as a literal
     - Build + test commands
     - [haiku only] The exact sibling to clone and the self-surfacing gate command;
       if either cannot be named, dispatch at sonnet
     - [below-fable session, fable tier] The explicit fable model override; the
       spec's tier assignment is the spend authorization
     ```

     Every dispatch includes every REQUIRED field, and the conditional fields when their condition holds. A spec that predates the `Fable Spend` header changes nothing: the tier assignments still authorize, and you add the header line the first time you touch the spec. The orchestrator stays lean: do not pre-read the files for it, do not re-implement its work, do not read its full diff unless adjudicating.
   - **`Locus: inline` (or no tier recorded):** implement in the main thread, which runs at the session's own model whatever tier the section carries. Inline is for sections the plan marked unbriefable (a spec likely to evolve in contact with the code) or too small to be worth a brief; if an untiered section is clearly briefable, dispatch it at the tier it would have earned. A plan predating the locus line may spell this as a decorated `Model:` value (`fable (inline)`); read it as `Locus: inline` at the tier named, and correct the line while you are in the file, since the decorated form silently downgrades a section for the external engine that parses it. Follow the csharp-style and sql-style skills, honoring each style skill's precedence rule. Surgical changes only.
   - **Handle the implementer's status:** NEEDS_CONTEXT, answer from the spec or conversation context and re-dispatch at the same tier; escalate to me only if the question is material and uncovered. BLOCKED, fix the environment and re-dispatch. DONE_WITH_CONCERNS, read the concern, resolve a correctness or scope concern yourself or hand it to the adversarial-reviewer as a question (never as a pre-rated finding, and never to the blind-reviewer, whose input contract excludes intent), and record a bare observation in the Chapter.
   - **Tier escalation:** a `haiku`-tier section gets one round, not two: a review with Critical findings, or a second NEEDS_CONTEXT, re-dispatches at `implementer-sonnet` immediately with the failure evidence in the brief - a Critical from a transcription section means it was mis-banded, and review rounds cost more than the tier delta saved. From `sonnet` up: if a dispatched section fails review twice with Critical findings (a review round is the full set of reviewers dispatched for the section, security included when it ran, and a round fails when any of them returns a Critical that survives adjudication), or returns NEEDS_CONTEXT twice on the same question, escalate, and carry the failure evidence forward: the failed attempt's report and the review findings ride in the escalated brief so the next tier does not rediscover them. That escalation is the repeating-findings path, and it must be earned: before any bump off a second failed round, compare the two rounds' surviving Criticals and name the comparison's result in the Chapter. If any finding class repeats, the implementer is missing something and the tier is the lever: escalate as written here. If no class repeats - the first round's fixes held and the new Criticals land on new ground - the spec's premise is the generator, and a stronger implementer cannot fix a brief that is itself wrong: do not spend the bump; raise the section to me as a decision brief instead (the spec claim under doubt, both rounds' findings as evidence, the options including revising or abandoning the section). This is the intra-section form of step 4's fix-the-generator rule; NEEDS_CONTEXT twice on the same question is the repeating class by definition. In a Fable-led session, take the section over in the main thread. In a session on a lower model: a section tiered below fable gets one re-dispatch to `implementer-fable` with the `fable` model override (the failure earns the spend), and moves to the main thread only if that attempt also fails; a section already tiered fable has exhausted its tier after the second failed review, so raise the stall to me or hand it to a Fable-led session rather than downgrading it into a lower-model main thread. Under a recorded `Fable Spend: none (cost hold)`, stay at the session model and raise the stall to me instead. Never re-dispatch a third time at the same tier, and never downgrade a tier mid-effort. Record the escalation in the Chapter, and if the kit's own under-specification caused it, jot a kaizen note. Repeated escalations mean the section was under-specified, a brainstorming lesson, not an implementer failure.
   - **Subagents neither commit nor stage.** Implementers leave their work as unstaged edits whatever the commit model (an empty index by default means a pathspec-less commit mechanically cannot sweep a half-finished section into an unrelated commit). The controller stages what it accepts - the explicit `git add <paths>` after review is the scope check - and before every commit reads `git diff --cached --name-only` and commits without a pathspec only when that list is exactly the target; the doctrine's Scope and safety rule owns the two git pathspec semantics that make this the safe order. Commits happen only in the main session, after review.
   - **A quiet agent is a working agent.** The transcript goes silent for the full length of any long tool call; the completion notification is the only liveness signal. Under an armed completion leash, do not end your turn to await that notification: the completion contract's wait-is-not-a-stop rule covers dispatch too, so run the critical-path implementer synchronously (`run_in_background: false`) or wait on it in-turn per the contract's `TaskOutput` pattern, review-fix resumes via SendMessage included. Never dispatch a second implementer at the same files on a suspicion of stalling - if an agent must be replaced, TaskStop it first. The same stop-first rule applies when a decision changes a brief mid-flight: an in-flight agent faithfully executing the old contract is invalidated by the new one, so kill it and re-dispatch with the corrected brief rather than briefing the change around it.

2. **Verify with evidence.** The build must pass; run it yourself even when an implementer reported DONE, since trust-but-verify is one cheap command. Run targeted tests, and a claim of "done" or "passing" carries the command output that proves it. For delegated work, read the implementer's diff (`git diff` - their work arrives unstaged) and spot-check the reported evidence rather than re-running everything (re-run anything that looks off). **Hunt the fail-dangerous patterns specifically:** a delete-everything-not-in-this-set with no empty-set guard, a destructive loop under one outer try/catch, a hardening change that turns a benign path into a throw without auditing its callers. Implementer-written code reliably introduces call-site bugs that pass "no suites failed": a parameter name or type that does not match the callee, a silently changed error semantic (truncate instead of hard-fail), a hard-delete flipped to soft, an explicit NULL overriding a column default. Settle the test question: if the behavior is worth locking against regression (a business rule, an edge case, a bug that could recur), leave a durable test and show it passing, watching it fail first where practical. If no test was warranted, say so and why. Use the temporary repro-script discipline from the global rules for debugging, not as the home for new behavior. **A tree-mutating probe is exclusive.** The red/green edit mutates the shared tree, so run one only with no subagents in flight: await or TaskStop them first, capture `git status --porcelain` and a filesystem copy of every file the probe will touch (to the `.kit/` scratch path), probe, restore from those copies, verify the restoration against the status capture, and only then dispatch, since an agent that reads a half-mutated tree takes the probe for a phantom cause and defends against it for hours. Never restore with `git checkout -- <file>`: it resets the file to HEAD, not to the pre-probe worktree, and the section work in flight is unstaged by the commit-model rule above, so checkout destroys the section along with the probe. When the state under test is already committed, run the probe in a separate worktree, which skips the exclusivity dance entirely.

3. **Review.** Dispatch two reviewers in parallel, ahead of the slow suites so the reviews work that idle time and their fixes fold into a single gate run: the `adversarial-reviewer` agent with the spec path, the base git ref (or list of changed files), the name of the section under review, and, when the section touched C# or T-SQL, the csharp-style and/or sql-style absolute paths (resolved by the same ladder as the Dispatch Brief template's style-skill-path bullet) so its house-style pass has something to read; and the `blind-reviewer` agent with the base git ref (or changed-file list) only - never the spec path, the plan, or the section name, and with any docs/ paths omitted from the changed-file list (the plan doc's and the doc indexes' own hunks are the intent story arriving through the diff), because reviewing without the intent story is that lens. If the section touched input handling, authentication or authorization, SQL construction, secrets or configuration, or an external boundary, also dispatch the `security-reviewer` agent alongside them. **The idle-time overlap assumes the reviewers and your suite can run at once.** Where one shared resource serves the whole repo (a single test binary or build output path, one integration database), they cannot: a reviewer that builds or runs anything contends for the same locked binaries or the same rows and blocks until your suite lets go, spending the idle time it was dispatched to use and then some. Answer the predicate before dispatching, since it is a property of the repo and not a judgment call: does this repo have exactly one such resource? When it does, take one of two exits rather than the overlap. Either run the suite to completion first and dispatch the reviewers after it, or keep the parallel dispatch and carry the Dispatch Brief's workspace-constraint line into every reviewer brief, naming the process holding the resource and the operations it puts off-limits (no build, no test run; read the diff and the code instead). The second exit is the default, since it keeps the idle-time win and the reviewers' own charter already forbids builds. This is the Delegating section's serialize-what-the-environment-cannot-share rule at its most common point of action. **The reviewer pair runs one model tier above the section's writer tier** (a haiku section reviews at sonnet, sonnet at opus, opus at fable; after a tier escalation, the escalated tier is the writer tier), passed as the model override on both of the pair's dispatches; the security-reviewer is not part of the bump and stays at its default. An inline section's writer tier is the session's own model, since that is what actually built it, so it reviews one tier above that: fable on the Opus-led session execution belongs to. A fable-tier or untiered section reviews at fable too, which on a Fable-led session is the inherited default and needs no override. On a below-fable session the fable reviewer overrides are standing Fable spend like the finishing reviews (the brainstorming skill's expected-surface enumeration names both; a spec predating that enumeration changes nothing); under `Fable Spend: none (cost hold)`, cap the reviewers at the session model. **Never pre-judge the review:** do not tell a reviewer what to flag, what to ignore, or how to rate a finding ("treat as Minor", "the plan chose this"). Pre-rating defeats the review; let each reviewer surface it and adjudicate per responding-to-review. **A repo-wide defect class is neither pre-judging nor contamination.** Telling either reviewer to hunt a class this codebase keeps producing (unguarded empty-set deletes, a locale-sensitive comparison, a disposal order this framework gets wrong) names what to look for without naming what this change did, so it is fair to send and fair to act on. One test separates the two, and it is the same test the blind-reviewer applies to its own inbox: would the sentence read identically for every diff in this repository? A standing property passes and may ride in any dispatch, the blind one included. A sentence that would change with the section fails, and diff-describing framing is exactly that shape: what the change adds, which files matter, what to focus on, what the author was trying to accomplish. Barred from the blind dispatch outright, and barred everywhere as pre-judging when it carries a rating. **Bracket every round with a tree-state capture.** Run `git status --porcelain` before you dispatch and again when the round returns, and compare the two before acting on a single finding. A delta is an incident: restore the tree, record the delta and the agent that produced it in the Chapter, treat that agent's findings as suspect pending a re-review against the restored tree, and jot a kaizen note, since a delta means either a write-shaped command got past the guard or an allowance the guard grants is wider than the invariant. For a genuinely trivial, self-contained section (a rename, a comment, a one-line change with no logic), the per-section reviews are optional as a pair, since finishing-work still covers it.

4. **Address findings.** Expect most raw findings to be coverage and polish, with a few real bugs among them. Critical: must be fixed before the section closes. Major: fix, or record the justification for not fixing in the Chapter. Minor: note in the Chapter; fix only if trivial and in-scope. Weigh each finding per the responding-to-review skill before acting on it. **The recurrence rule:** when a review surfaces a finding of the same class an earlier section's review already surfaced (same defect pattern, different site), do not just fix the new instance: amend the standing dispatch-brief content - a `Standing Brief Amendments` block in the plan doc that step 1 folds into every later dispatch brief - so every later section's implementer inherits the guard, and record the amendment in the Chapter. Two instances of a finding class means the workflow is generating the bug; fix the generator, not only the output.

5. **Update the plan doc.** Mark the section complete. If the implementation deviated from the spec, update the spec section to match reality and flag the deviation in the Chapter; if the deviation changes design intent, raise it to me rather than silently rewriting the spec.

6. **Adjudicate the applied stamps, then append a Chapter** (format below). If a Decision or Surprise traced to the kit itself fighting the work (an ambiguous rule, a contradictory step), also jot it to the kaizen inbox per the global capture rule.

   Before writing the Chapter, run `memq unstamped --since <n>d` (or `<n>h`; the flag takes a duration, never a date) over a window covering the section's span, which is the elapsed time since the previous Chapter, else the 1d default. It lists the memories this stretch's sessions opened and never reported applying. Walk the list and, for each, either stamp it (`memq touch <name> --applied`, with `--type` or `--operator` where the hit's tier needs it) or skip it, then record the outcome in the Chapter's `Stamps:` field. Stamp on the generous bar the memory-system skill owns: did it plausibly steer what you did, and when in doubt, stamp.

   This runs at every section boundary rather than waiting for the close-out, because the judgment is only cheap while it is fresh: a compaction or a session handoff can land between Chapters, and by the close-out of a long run nobody can say which of forty records changed a decision. The trivially-small section that skips its reviews does not skip this; the command is one line and the answer is a recognition question over a list the machine already built.

   **Do not widen the window past the previous Chapter, on the theory that more is safer.** Widening pulls applied stamps into range as well as reads, so an earlier section's stamp on a record this section freshly read masks it, and the new use is never asked about. A wider window returns a shorter list, and the records it drops are exactly the ones a boundary sweep exists to catch.

7. **Apply the commit model** recorded in the spec header:
   - **Review-Only:** stage the section's changes (`git add`); never commit. Accumulate a running changed-files summary in the Chapter for the final walkthrough. `git diff --staged` is my review surface.
   - **Branch-and-PR:** commit the section's code together with its Chapter (the plan doc update from step 6) to the feature branch, so the record rides with the change into the eventual merge. The PR happens in finishing-work. Pushing here is not merging: nothing is final until that merge.
   - **Commit-and-Push:** commit the section and push to origin. (If concurrency put you on a worktree branch, the merge to main and teardown happen in finishing-work, not here.)

Compaction is the harness's own: native auto-compaction may fire mid-run on a long session, and the plan doc plus its Chapters are the recovery spine. Context pressure never stops or pauses a run, and is never a reason to end a turn.

Then continue to the next section. Do not stop here.

## The advisor

An `opus` advisor is the standing default on every session: set once with `/advisor opus`, it persists in settings and gives the session - and every below-opus model it dispatches - a quick Opus check at decision points, with no spec line needed to authorize it. It composes with the tier system rather than replacing it: the advisor shares the session's conversation (and its blind spots), so it is for orchestration judgment - adjudicating a DONE_WITH_CONCERNS, weighing an escalation, a recurring error - never a substitute for the fresh-context reviewers, whose value is exactly that they never saw the session's reasoning. The advisor is not Fable spend: no `Fable Spend` header names it, and `none (cost hold)` does not touch it.

Three properties to plan around, on v2.1.205: the advisor is **session-wide and inherited by every dispatched subagent** - there is no per-agent override; a subagent whose pinned model outranks the advisor **silently drops it** (no error); and the setting **persists in settings**, which is what makes the default self-sustaining across sessions rather than something to re-set each time. Each consultation re-reads the transcript at the advisor's rates, uncached. On an Opus-led or Fable-led session the main thread gains nothing from it (an equal or lower rank), but every below-opus dispatch still inherits the consult; that inheritance is what the standing default buys.

## Delegating to subagents

Tokens absorbed into the main context are re-billed on every later turn; a subagent's churn (file reads, build output, failed attempts) is paid once, and only its report comes back. The orchestrator stays the designer: it writes dispatch prompts, judges findings, reads implementer diffs, and writes Chapters. Keep a task in the main session only when it is design-entangled (its shape is still being discovered in contact with the code), tiny (the prompt would cost more than the work), or session-state-dependent (an in-flight debugging chain).

A subagent loads the auto-memory index and the skill catalog (one-line descriptions), not the skill bodies, the conversation, or your in-flight directives; forward every standing directive verbatim (the cost hold, the style contract, the exact constraint). **Write the dispatch prompt from the actual current code,** assuming a skilled engineer with zero context for this codebase: exact file paths, the signatures and types they will touch, the absolute path to each style skill it must follow, what done looks like, whether the change earns a durable test, what NOT to touch, and how to verify. **Hand bulky inputs over as files,** not pasted inline: the spec, or a diff captured with `git diff > .kit/scratch/<name>.diff` (gitignored, never `docs/`; keep the project's `.gitignore` covering `.kit/`). The blind-reviewer is the standing exception to the diff-file handoff: it gets the base ref or changed-file list per step 3's contract, never a captured diff, because the capture's filename (usually the section name) and any docs/ hunks inside it are the intent story arriving through a side door. **A subagent's report comes back in its final message, not as a committed file.** The implementer's status protocol and the reviewers' findings lists are terse by design, so have each return its report inline and distill the durable outcome into the Chapter. A large review can still use the summary-plus-file pattern: return the verdict, the Critical/Major/Minor counts, and the top finding inline, and write the full findings to a file the orchestrator reads only when adjudicating. The tell that you are repeating the old failure is a dispatch line like `write your full findings to docs/reviews/...` or `docs/plans/_impl_reports/...`: a report is a transient working artifact and the Chapter is the curated record, so route those to `.kit/` or take them inline. The same discipline applies to read-only scouts, whose return contract is below. Parallelize only when tasks touch non-overlapping files; lock shared contracts first and assign disjoint files.

**A brief grants nothing a mechanical guard denies.** Where a PreToolUse guard keys on agent type, widening the agent's file scope in the brief text is inert: the write is blocked whatever the brief says, and the round is spent discovering the denial. Route around the guard at dispatch time instead: send an agent type the guard admits, keep the guarded write in the main thread, or tell the agent up front to return the text in its report for the main thread to place. The `docs/` routing override in step 1 is this rule's standing instance.

**Band the scout by question shape, and state its return contract.** A closed fact-check (does X contain Y, confirm a value, verify a checklist item) rides the harness default, because the mandatory confirmation of load-bearing leads makes a wrong answer self-surfacing; open discovery (map a surface, find every call site) gets an explicit sonnet override, because the failure confirmation cannot catch is the miss, and a missed site silently narrows the design. Top-model recon is pure burn either way, and a "simple check" that comes back with more than a couple of leads was mis-banded: re-run it as discovery. Every scout dispatch states its return contract in the prompt, so the report lands lean by construction: each lead comes back as a file:line reference with a one-sentence fact and why the site matters, never pasted file contents, and bulky evidence goes to the gitignored `.kit/` scratch path, read on demand.

**Serialize what the environment cannot share.** Implementation stays single-agent-per-worktree when it touches shared state, and the long integration suites run through one controller: two concurrent runs against a single shared database collide, fail in a heap, and orphan test state. The single-shared-resource constraint dominates orchestration design more than any parallelize-by-default instinct.

## Chapter format

Append to the `## Chapters` section of the plan doc:

```markdown
### Chapter N - YYYY-MM-DD
Completed: <section name>
Implemented By: <main session | implementer-haiku | implementer-sonnet | implementer-opus | implementer-fable, plus any escalation>
Metrics: <review rounds; NEEDS_CONTEXT count; escalations; advisor <model | off>>
Decisions / Surprises: <anything resolved or discovered; "none" is acceptable>
Review Findings: <Critical/Major addressed; Majors justified; Minors noted>
Stamps: <adjudicated N, stamped M; "none surfaced" is acceptable>
Next: <next section, or "finishing-work">
Commit Model: <Review-Only | Branch-and-PR | Commit-and-Push>
```

Chapters exist so that a compacted or fresh session can recover full working state from the plan doc alone. Write them for that reader. The Metrics line doubles as the data feed for the kit's open experiments (the tier-band and advisor questions in `docs/backlog.md`), so record it even when every count is zero.

The Chapter heading and its `Completed:`/`Next:` lines are a machine contract read by external tooling, not just kit convention; see `curating-docs/SKILL.md`'s machine contract section for the frozen shape and which values register a section complete.

## When all sections are complete

Invoke the finishing-work skill. Do not declare the effort done without it. This holds under Review-Only: finishing-work still flips the plan to Complete, archives it, and stages it with the code. Review-Only defers the commit to me, never the doc's finalization, so the plan is never left open for me to close.
