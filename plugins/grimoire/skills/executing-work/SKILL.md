---
name: executing-work
description: "Autonomous execution of an approved spec or plan from docs/plans/. Use when I say to proceed, implement, build, or continue an agreed plan, or when resuming a session that has an In Progress plan doc."
---

# Executing Work

Once the spec is approved, execute it under the completion contract below: no per-step check-ins, no "should you continue?", no gating individual edits. Interrupt me only for a member of the blocker set below.

## Completion Contract

The spec is the goal. Once execution starts, run every remaining unblocked section to completion in this session. A section boundary, a long-running gate and context pressure are not stopping points. An externally-driven worker (the External-engine stand-down) finishes its directed section and stops, and that is completion, never an early stop.

**Do not end your turn** to:

- report progress between sections. Close the section and start the next.
- wait on a build, test suite, or Live gate. Background it, poll a readiness signal (`until` on a marker or exit code), and continue.
- manage context. The Chapter and the SessionStart resume hook make a fresh session lossless, and starting one is my call.
- await a subagent on a bare turn-end. End on a `WAITING:` lead instead.
  - End on `WAITING:` once a background dispatch (`run_in_background: true`, the Agent-tool default) is the only remaining work, an agent resumed over SendMessage and a model-override dispatch included. A dispatch is the only remaining work when every next step reads its result, so do work that needs no result first, and read every returned result before ending.
  - The `WAITING:` line names each pending task's id and expected wake, the registry the post-wake turn reads. Arm a timer first where you can, on the window finishing-work's cadence paragraph sets.
  - Under an armed leash the hook blocks a bare turn-end. Never clear the leash to escape a block.
  - The one in-turn option is a synchronous dispatch (`run_in_background: false`), chosen per step 1's leash bullet.
  - Read completion from task status, never transcript quiescence, since a mid-run pause reads as done. Only finishing-work's wedge hallmark makes a stall out of silence.

Any stop with unblocked work left, for a reason outside the blocker set, is wrong. Red flags that you are about to stop wrongly: "say the word and continue", "holding for", "paused here", "at the tail of", "ready to continue when you are". With unblocked work remaining, do not write them. Keep going.

**Stop only for a true blocker, and make it loud.** The blocker set:

- an external dependency only I can satisfy (a GUI action, a cloud resource that must be provisioned, a credential or secret you cannot reach),
- a contradiction inside the spec, or a material decision the spec does not cover,
- an act the doctrine's stop-for-a-yes rule gates and no proceed-ahead covers,
- a systematic-debugging dead end.

The set is closed, and capacity is never on it. Compaction keeps the leash and the plan doc keeps the state, so a stop reasoned from context is a stop dressed as a blocker. The two `WAITING:` occasions below are not on it either, since each ends a turn with the leash armed and no work stranded.

**Before any BLOCKED at all, the expert ask goes out, and it goes ahead of the consult.** Send the blocker to the repo's live expert seat, and on declaring notify this machine's live coordinator seat, on the route, bounds and record rule the peer-sessions skill's Worker seat bullet states. The ask never gates: keep working, and declare exactly when you would have without it. With no live expert seat, go straight to the consult. The ask and the notice carry the same public-board cap as the declaration's first line. `docs/security-model.md` carries the readership analysis, and the coordinator skill owns the precondition it names.

**Before any BLOCKED that turns on a decision, the consult runs too, after the ask and before the declaration.** The consult skill owns the mechanics, and its trigger (b) owns which blockers go straight up instead, what reaches me, and the one substitution step 4's review-round backstop grants.

When you stop, the message's very first characters are `BLOCKED: <exactly what you need from me>`, with no summary, bold or heading above it, and any shipped-work recap after the BLOCKED paragraph. The body is a decision brief in the doctrine's client-briefing register, decidable from the brief alone on my phone with no session context. The Stop hook releases only on the leading prefix, so quoting the convention mid-message never releases the leash. It refuses a capacity reason (context, compaction, a fresh session). Never write a progress update as a stop.

**The first line carries only what you would put on a public board, because it travels further than the rest of the message.** On a mid-queue advance the Stop hook records it into the plan's outcome note, which the coordinator seat reads onto its brief and board, and the coordinator notice carries it at any queue position. So compose that one line for a public board and keep it inside 120 printable-ASCII characters, since what runs past is dropped mid-clause. Spell any path in that line repo-relative. The cap is a standard, stated against a public board so that moving the board somewhere quieter never reads as relaxing it. `docs/security-model.md` carries the readership analysis, and the coordinator skill owns the precondition it names, which bounds what that seat lands rather than what you send.

Waiting is the third stop shape, and it has two occasions. The first is the completion contract's dispatch bullet: a turn whose only remaining work is dispatched background subagents ends with `WAITING:` as its very first characters, naming the pending dispatch, never a foreground wait or a pause dressed as a blocker. Take the first-turn reading at the first wake at or after its window closes, per finishing-work's cadence paragraph. On the wake, evaluate the hallmark at the first re-block, before anything else with that dispatch.

The second is a park: a stop at the next safe boundary taken on a request, never on the run's own judgment. A stop request from the operator, direct or relayed by the coordinator, is honored at the next safe boundary under the ordinary rules: the interim board entry where a section is mid-flight, the commit the recorded commit model directs, and the compaction checkpoint opened, or on an unleashed run the boundary declared with step 8's unleashed branch.

A leashed session leads its stop message, and every later turn it ends while parked, with `WAITING:`, since the armed leash pushes a bare turn back into the work. That line names the park and its ground only, never capacity in any form. Once every dispatch is finished or explicitly stopped, answer a relayed request with one line naming the parked state, as the turn's last act. The ground is the window the operator declared to this session directly, else the operator's own instruction, else the request itself, named as the request.

Before that line, settle each dispatch under finishing-work's unavailability rule, which owns both readings and their windows. A dispatch whose growth or first-turn window has closed takes the hallmark check through its probe, or its TaskStop for a synthetic-only pair. One whose first-turn reading is pending holds the park, ending turns on the dispatch occasion's `WAITING:` line until a wake at or after its window's close takes the reading. A parking session stops a never-started agent, records in the interim board entry what it was asked and that it never started, and leaves the re-dispatch to the resuming session. Park only on what survives.

Nothing in the kit wakes a parked session on a timer, save a parked coordinator seat's own reconciliation wake, whose conduct the coordinator skill states. A `WAITING:` stop keeps the leash armed, and a dispatch's completion notification re-invokes the session under it. BLOCKED's leading-prefix mechanics and capacity refusal apply to `WAITING:` too.

**The goal template.** Only the operator, typing `/kit-goal docs/plans/<plan>.md` in an interactive session, arms a plan run's completion leash. A run that finds no leash, or one bound to another session, never arms or re-arms one, and proceeds unleashed under step 0's remedy. The kit-goal skill owns the leash, its condition and the Stop hook that enforces it.

**A plan arriving mid-run is itself the trigger to take it on, once its standing holds.** The peer-sessions skill owns that gate, settled before the plan is taken on: the message's own standing, and the trace of a `## Dispatch Authorization` grant to the operator, which is mandatory and which no tool performs for you. A plan whose standing does not establish is held. One that holds is taken on, never armed, at the earliest boundary this tree allows, and runs after everything the run already holds.

An unleashed run records it in its plan doc and runs it next. A leashed run asks the operator, in a reply opening with an `ASK:` line, to type `/kit-goal --append <inbound plan>`, since the bare form drops the plans in flight. Until then it records the plan in the in-flight plan's doc, and where no append lands, the last leashed plan's close-out status names it as next to run. A tree older than the plan's commit takes the plan on at the next safe tree advance, re-checking against the sender's named anchor at each boundary the run already takes.

Tell the sender which state the plan reached, in the reply vocabulary the peer-sessions skill owns. Each record, and a held plan's note of what the hold waits on, goes in the interim board entry where no Chapter is being written that turn, else the Chapter. An arriving plan is never a blocker or a reason to end the turn. Record it and continue into the next section.

**Handoff.** When execution begins in a conversation that was just brainstorming, say so in one line ("Spec approved, switching to autonomous execution of all N sections"), so I can scope it down.

## Before Starting or Resuming

Read the plan doc in full, **including all Chapters**, which are the state. After a compaction or a visible truncation notice, and before touching any file, take the reload the doctrine's durable-artifacts bullet states, re-invoking `executing-work` through the Skill tool.

**Never stop to ask whether a plan handed to you was approved.** On an armed run the kit-goal skill's arming-is-approval rule answered it. A plan handed on the operator's own channel, or by a chain handoff inside the bounds the peer-sessions skill states, is approved as written, leash or none. A plan past those bounds holds for the operator's word. Set a `Status:` header reading anything but `In Progress` or `Complete` to `In Progress` on starting, and record any change, old value and new, in the run's first Chapter, since the header sits inside the approval fingerprint. Never flip `Complete`, which would overwrite a close-out's record: a run starting a plan marked finished takes the blocker set's contradiction path. The curating-docs skill's machine contract owns the `Status:` values. A worker under an external engine (the stand-down below) leaves the header to its engine.

**Then run the intake gap check on the plan doc.** List what each section leaves unstated that its implementer needs. Route each gap after the memory recall below, which is one of its sources, and before its section is dispatched. A material gap, the spec-does-not-cover decision, is a `BLOCKED:` on an armed run and a decision ask on an attended one. A non-material gap, answered under route (a) from a cited source or under route (b) by a declared low-blast reversible default, goes on that section's Chapter `Assumptions:` line in brainstorming's declared-assumption format, dated today with `, section N` in the parenthetical. The dispatch brief carries the answer, not the gap. Never append it to the plan doc's `## Assumptions` section, which freezes at approval inside the fingerprint the external engine reads.

**Then run `memq recall`, once, before the first section.** It returns the whole memory store as one bounded digest, and the memory-system skill owns how to read and act on it. Carry forward what bears on the sections ahead. Re-run it on a resume and at a boundary taking that skill's hand walk, never trusting a recollection of an earlier pass. When a recalled record changes what you build, stamp it that turn with `memq touch <name> --applied`.

Run it from the project root, a worktree of it, or any directory inside the project. The memory-system skill's resolver rule (`skills/memory-system/SKILL.md` under the kit plugin root) says which store resolves. Two tells mean a different, empty store resolved: a `git worktree repair` note on stderr, and coverage lines all reading zero on a project you know has memories.

**External-engine stand-down.** Where a driving directive says an external engine owns continuation by spawning a fresh worker per section, or the environment carries `KIT_EXTERNAL_ENGINE`, run the section loop for the directed section only. The marker binds as the directive's own words, not as a mechanism. The **worker runs this skill**, orchestrating, dispatching implementers and writing Chapters as any session would, never absorbing implementation inline for being headless.

**Workspace and siblings.** A worktree on a feature branch that concurrency put you in is your workspace, and finishing-work handles integration and teardown. Own a disjoint set of files from sibling sessions in the same repo. Their uncommitted work takes the doctrine's Scope and Safety rules, so never stage it or carry it in a commit of yours.

## Section Loop

Run each Section of Work in order. Sections run concurrently only where the disjoint-files rule in "Delegating to Subagents" permits.

0. **Close the previous boundary.** On a leashed run, clear any compaction checkpoint the last boundary left open, since work is resuming:

   ```
   node <plugin-root>/hooks/kit-compact-checkpoint.js clear
   ```

   Resolve `<plugin-root>` the same way the Dispatch Brief template's style-skill bullet does. Run the verb from the session's own shell, so it resolves the caller's session id. It is a no-op when nothing is open. It refuses at exit 1 over another session's boundary or a state it cannot read, and prints the remedy. The usual refusal is a resumption under a new session id against a goal still bound to its dead predecessor. That resumed run arms nothing for itself: it proceeds unleashed until the operator types `/kit-goal` with the whole queue in it, which rebinds the goal there, while any other session leaves the goal alone.

1. **Confirm the approach, then implement.** Where the spec assumed a section's mechanism without reading the code, first read the files it touches and confirm the approach holds, in a lightweight read, never a fan-out. A file opened to find one mechanism takes the doctrine's rule on hunting in a large file, usually over more than one range. Where the real shape differs materially, adjust and note it in the Chapter. Raise it to me only if design intent changes. Then implement per the section's model tier: a section carrying a `Model:` tier goes to that tier's implementer. The doctrine's standing dispatch request covers this, even where a session-prompt line makes dispatch conditional on my request.

   **At each section open, grep the plan doc for its `Standing Brief Amendments` block and hold every entry as binding.** Step 4 writes to the block mid-run, so an earlier read is stale. A grep that finds nothing is still the read. On the dispatch path the entries ride into the brief, and an inline section has only the grep. The same open writes the add-decision line for the section as a whole to the scratch file step 4 names. Step 4 owns the line's five parts, and this one fires no stop.

   **The same open writes the section's promises file, `.kit/scratch/<plan-slug>/promises-section-<n>.json`.** It holds one `{ id, promise }` entry per acceptance bullet and per sentence naming a behavior the section builds. A dispatched implementer runs it through the brief's `Promise check:` field.

   - **A section that writes under `docs/` goes to the main thread whatever its tier.** An implementer may draft the prose and return it in its final message, but the `docs/` write is the main thread's. This overrides routing, not tier. Record `Locus: inline` under the `Model:` line, which keeps the bare tier the section earned.
   - **Tier `haiku` / `sonnet` / `opus` / `fable`:** dispatch the matching `implementer-<tier>` agent with a complete brief built from the Dispatch Brief template. A `fable` override dispatch takes the capacity reading below first.

     ```
     Dispatch Brief (all REQUIRED unless marked):
     - Spec path + section name
     - Files in scope
     - Acceptance criteria (verifiable)
     - Rich references: the section's References: line when the spec has one,
       plus any mockup, rubric, or reference implementation its acceptance
       leans on, by path
     - Tests: the section's Tests: line verbatim when the spec has one, a floor
       over the named contracts, extended with what implementation reveals and
       amendable on contact with the code where a named contract proves to be
       a choice, with either delta flagged in your report; else the
       test-worthiness call per the testing-discipline skill's litmus, its
       absolute path resolved by the same ladder as the Style-skill file paths
       bullet below, and what a test should lock
     - Sibling pattern to mirror, when one exists: name it AND require mirrored
       failure-mode breadth (catch scope, regex generality)
     - Error and delete semantics to preserve (throw vs truncate, hard vs soft
       delete, explicit NULL vs column default)
     - The standing hostile-boundary reuse step: before writing a call at a
       hostile boundary, grep the tree for its other callers and reuse a
       correct one's guard rather than matching its protections by hand. One
       grep, and no new capability. A spawned process, a child environment,
       text bound for a trusted channel and a clamped bound are instances and
       not the boundary: the class is any call whose safety rests on what the
       far side is protected against. Where the guard's file sits in Files in
       scope, export the guard and call it. Where it does not, name that file,
       the guard, and the export it needs in the report and leave it unedited,
       for step 4's out-of-scope route. The guard at a boundary is a property
       of the channel rather than of the caller that first needed it, so a
       hand-written second caller drops the protections it cannot see and
       fails only on the input the guard was there for
     - Pin tests + new expected values, when the section changes a counted
       cross-cutting set
     - Standing Brief Amendments: every entry from the plan doc's block, when one exists
     - The standing whole-worktree prohibition, in every brief: no git
       operation reaching past the agent's own files, a bare `git stash`, a
       reset or a checkout among them. No `git checkout -- <file>` at all, own
       files included, since it restores to HEAD rather than to the state
       before the agent's unstaged edits. A pristine baseline is
       `git show HEAD:<path>` under the `.kit/` scratch path. A restore point is
       a filesystem copy under that path, taken before the first mutation
     - Workspace constraints the agent cannot see from the tree, when any are
       in effect: each state a sibling session, the leash, or the environment
       owns (a shared stash, a process holding binaries), and the operations
       it puts off-limits. These bind, and override the box-budget clause's
       wait-or-proceed discretion over the same state
     - Every load-bearing technical assertion you make marked confirmed,
       naming its evidence (file:line, the command run); inferred, saying to
       verify it before relying on it; or reported, naming the peer session
       and saying the same. A claim about what a tool prints is confirmed only
       by a run of it or by the source line that emits it, the source
       preferred where in reach, since a run exercises one branch, and never
       by document agreement, however many documents agree
     - The standing absence-check clause: a green alone reports neither of
       its two classes. Name in words which rule refused each case of a check
       whose acceptance is a refusal, such as a guard's deny or an error path,
       since the class is any check whose acceptance is a refusal, because a
       check that records only that something refused reports the same green
       whether the rule it was meant to exercise refused it or another rule
       refused it first. For a check whose acceptance is an absence, such as a
       clean sweep, an empty grep or a contention gate reading clear, name the
       predicate, the scope and what it matched, an empty match stated against
       both, since the class is any check whose acceptance is an absence,
       because a predicate narrower than the class it guards reports the same
       clear verdict whether the state it was meant to detect is absent or
       merely unnamed. Report each site a sweep reached and left unchanged with
       the rule that exempts it. A control on an instance the pattern's own
       literals name proves only that the instrument runs, while one on an
       instance withheld from those literals, matched on its shape rather than
       a string the pattern was handed, is coverage evidence too. A check
       whose subject is a class states what would catch a member you did not
       name, a structural pattern over the class's shape where one exists.
       Where the class can be neither enumerated nor shaped, report the named
       members swept and the class not, never a clean sweep. Build the control
       under the `.kit/` scratch path. A control that must touch the tree under
       review is a tree-mutating probe, carried here because an agent holds no
       skills: no other agent reads the tree while it runs, and it restores
       from copies taken before the first mutation
     - Workaround bar: a workaround needing a paragraph to justify means fix the
       code or escalate
     - [optional] Promise check: the promises file's path and the command
       `node <root>/scripts/kit-jev-check.js promises <that file> <your changed
       source files>`, run before you report, with its closing line and every
       promise over 0.6 carried in the report
     - When returning NEEDS_CONTEXT on a hard question, state it consult-shaped:
       the decision, the options you see, the evidence, and your lean
     - Style-skill file paths (agents inherit no skills): resolve the plugin
       root at brief-writing time by the ladder `kit-doctor/SKILL.md` uses:
       `CLAUDE_PLUGIN_ROOT` where the harness provides it, which a session's
       own shell does not see, else this skill's own base directory's
       grandparent. Write `<root>/skills/<name>/SKILL.md`, plus its
       references/ file where one exists, into the brief as an absolute path.
       A versioned cache path under a marketplace install is correct when
       resolved this session. Resolve fresh every time, and never write a
       resolved root into this bullet as a literal
     - Build + test commands
     - [any section whose work may spawn a suite, build, or embedding pass]
       The standing box-budget clause, an act at the spawn step rather than a
       preamble constraint, because a brief is minutes stale by its first
       spawn. Immediately before spawning any suite, build or embedding pass,
       poll the process list for a foreign test runner or build, whatever its
       engine, then wait on it or name the contention in the report. The rule
       is the doctrine's bullet whose lead reads "One heavy process at a time
       is a per-machine budget, not a per-directory one."
     - [section whose files in scope include a settings permissions block, a
       hook that emits an allow or deny decision, or any other surface that
       composes or widens a command grant] The two-question grant audit, copied
       verbatim from `<root>/agents/security-reviewer.md` by the same ladder. A
       grant failing either screen is narrowed, or returned to the main thread
       with the reason, rather than written
     - [haiku only] The exact sibling to clone and the self-surfacing gate command;
       if either cannot be named, dispatch at sonnet
     - [below-fable session, fable tier] The explicit fable model override,
       passed only after step 1's capacity reading; the spec's tier
       assignment is the authorization
     ```

     Every dispatch includes every REQUIRED field, and each conditional field when its condition holds. An older spec may carry a legacy spend-authorization line in its header block (an expected Fable surface, a Fable-led-session marker, or a hold at the session model). That line is inert: read past it, note it in the first Chapter that touches the spec, and honor nothing it says. The orchestrator stays lean. Read no files beyond the approach-confirmation read above, and never re-implement the agent's work. Read its diff to verify and adjudicate it, never to redo it.
   - **Before any dispatch that passes a `fable` model override, take the capacity reading.** Run `node <plugin-root>/hooks/capacity-read.js`, resolving `<plugin-root>` as step 0 does, and act on the one line it prints. `-> dispatch` proceeds unchanged. `-> ladder governs`, or a run printing no verdict line whatever its exit code, proceeds under the never-started rules of finishing-work's unavailability rule. `-> downgrade` measures the fable tier exhausted for this dispatch. A reviewer, judge or consultant site then takes the effort table's compensation row where finishing-work's ladder leaves it open, the plan review waits for fable per brainstorming, and an implementer site takes the escalation bullet's stall raise rather than a lower model, its first line quoting the reader's line. Quote the reader's line verbatim in the dispatch record and the Chapter. Take the reading immediately before each dispatch and never reuse it, because the machine's account rotator can change the active seat between any two dispatches.
   - **`Locus: inline` (or no tier recorded):** implement in the main thread at the session's own model. Inline is for sections the plan marked unbriefable or too small to brief. Dispatch a clearly briefable untiered section at the tier it would have earned. Read an older decorated `Model:` value (`fable (inline)`) as `Locus: inline` at that tier, and correct the line while in the file. Follow the csharp-style and sql-style skills and each one's precedence rule. Surgical changes only.
   - **Handle the implementer's status.** A NEEDS_CONTEXT whose add-decision line names a mechanism no Goal sentence, Intent clause or acceptance bullet names goes to step 4's design stop and its judge. A question the spec or the conversation answers is answered, and the section re-dispatched at the same tier. A genuinely hard one, the spec silent because nobody foresaw it, convenes a consult. The adopted ruling goes to the plan doc's `Standing Brief Amendments` block under step 4's adoption trigger, then into the re-dispatch brief. A preference fork that survives the ruling comes to me, ruling attached.
     - BLOCKED: fix the environment and re-dispatch.
     - DONE_WITH_CONCERNS: a material concern re-routes to NEEDS_CONTEXT handling. A "spec ambiguity you resolved" is a route (b) assumption for the Chapter's `Assumptions:` line, with the section number. Resolve a correctness or scope concern yourself, or put it to the adversarial-reviewer as a question, never as a pre-rated finding and never to the blind-reviewer, whose input contract excludes intent. Record a bare observation in the Chapter.
     - **A surface outside the section's Files in scope is never a bare observation.** Any report can name one, whatever its status, and it takes step 4's out-of-scope route.
   - **Tier escalation.** A `haiku`-tier section gets one round: a correctness-lens Critical or a second NEEDS_CONTEXT re-dispatches it at `implementer-sonnet` at once. From `sonnet` up, escalate after two failed review rounds or two NEEDS_CONTEXT returns on the same question. A round fails when a correctness lens in step 3's roster returns a Critical that survives adjudication. The failed attempt's report and the review findings ride in the escalated brief.
     - Before any bump off a second failed round, compare the two rounds' surviving correctness-lens Criticals and name the result in the Chapter. A repeating finding class, NEEDS_CONTEXT twice on the same question included, means the implementer is missing something, so escalate. No repeat means the spec's premise is the generator, which a stronger implementer cannot fix. Spend no bump. Convene a consult on the premise with the claim under doubt and both rounds' findings, and bring me only the preference fork that survives it, ruling attached. Step 4's design stop is a different stop: it fires on one fix whose add-decision adds a mechanism no clause names, and goes to the judge.
     - A Fable-led session takes the section over in the main thread. In a lower-model session, a section tiered below fable gets one capacity-gated re-dispatch to `implementer-fable` with the `fable` override, then the main thread, and a `-> downgrade` reading takes the stall raise instead. A fable-tier section exhausted after its second failed review goes to me as a stall raise or to a Fable-led session, never to a lower-model main thread. **An implementer never takes the reviewer's compensation notch.** A fable-tier section run lower keeps its pinned effort, and step 3's reviewer-effort rule says why.
     - A dispatch stopped on the wedge hallmark, or faulted synthetic-only, is an environment fault rather than a failed round, counted against neither the two-failure ladder nor the third-dispatch bar. It gets one re-attempt, for a synthetic-only fault the same-model retry finishing-work's rule spends. Where that also stops, record the chain and each dispatch's shape in the Chapter, and leave to finishing-work whether the tier can run here. A fable-tier section then takes the stall raise, any other tier escalates one tier, and a section already at the strongest tier this session can reach raises the stall.
     - Never re-dispatch a third time at the same tier, and never downgrade a tier mid-effort. Record the escalation in the Chapter.
   - **Subagents neither commit nor stage.** Implementers leave unstaged edits under every commit model. You stage what you accept, and that explicit `git add <paths>` after review is the scope check. Before every commit, take the staged-list read the doctrine's Scope and safety rule states. Commits happen only in the main session, after review or at a first-green commit, and step 7 says which commit models allow the second.
   - **A quiet agent is a working agent, short of the wedge hallmark.** Transcripts go silent through long tool calls, so wait for the completion notification. Load finishing-work's unavailability rule, which owns the hallmark and its windows, at the section's first dispatch, since a rule loaded at suspicion arrives after the multi-hour wait it exists to end.
   - **The first-turn reading catches the never-started shape within minutes.** Take the reading at the first wake at or after the first-turn window closes, per finishing-work's rule. A dispatch carrying a model override takes it at that wake, whatever woke the session.
   - **Under an armed completion leash, this bullet chooses between the wait shapes the completion contract's dispatch bullet states.** The synchronous call is wedge-blind, since no probe or status read fits inside it and a wedged call never returns, so take it only for a short single critical-path dispatch whose turn continuity is worth that price. Every other dispatch takes the `WAITING:` turn end, as does a dispatch carrying a model override, whatever its length. `TaskOutput` is read for status and never blocked on. A wake without a completion, from a peer message, an operator redirect or a timer, takes the reading it allows, answers what woke you, and ends the turn again on `WAITING:` naming the ids still pending. Never hold the turn open for a window to close, since that queues the next message behind it.
   - **Stop first.** Never dispatch a second implementer at the same files on a suspicion of stalling. TaskStop an agent before replacing it. The same applies when a decision changes a brief mid-flight: the in-flight agent executes a contract the new brief invalidates, so kill it and re-dispatch with the corrected brief.

2. **Verify with evidence.** Run the build yourself and require it to pass, even when an implementer reported DONE. Run targeted tests, and a claim of "done" or "passing" carries the command output that proves it. Report every gate number with the state of the tree it was measured on, such as a clean worktree at sha X or the main checkout with N foreign dirty files. A gate number in a journal-layer artifact carries its moment in the form the moment-pin bullet of `skills/testing-discipline/SKILL.md` under the kit plugin root states. For delegated work, read the implementer's diff (`git diff`, since their work arrives unstaged) and spot-check the reported evidence rather than re-running everything. Re-run anything that looks off. A delta in that diff a guard should have refused takes step 3's incident path.

   **Hunt the fail-dangerous patterns specifically:** a delete-everything-not-in-this-set with no empty-set guard, a destructive loop under one outer try/catch, a hardening change that turns a benign path into a throw without auditing its callers. Hunt too the call-site bugs implementer code introduces that pass "no suites failed": a parameter name or type that does not match the callee, a silently changed error semantic (truncate instead of hard-fail), a hard-delete flipped to soft, an explicit NULL overriding a column default. Settle the test question per `skills/testing-discipline/SKILL.md` under the kit plugin root, whose litmus decides what earns a durable test: leave a durable test and show it passing, watching it fail first. If no test was warranted, say so and why. Use the temporary repro-script discipline from the global rules for debugging, never as the home for new behavior.

   **A tree-mutating probe is exclusive.** Run one under the doctrine's rule for it in Tests and Their Blind Spots, awaiting or TaskStopping every subagent first. When the state under test is already committed, run the probe in a separate worktree, which needs no exclusivity.

   **Then run the promises check before step 3:** `node <plugin-root>/scripts/kit-jev-check.js promises .kit/scratch/<plan-slug>/promises-section-<n>.json <the section's changed source files> --record .kit/scratch/<plan-slug>/promises-section-<n>.record.json`. Re-read each promise over 0.6 against the code, then fix it or record one `Decisions / Surprises:` line. After a fix, re-run once without `--record`. Step 3 dispatches whatever the reading, and no reading enters a review brief. A `not checked` or `not configured` line is recorded as printed and never retried into a pass.

3. **Review.** On round 1, dispatch the `adversarial-reviewer` agent and the `blind-reviewer` agent in parallel with each other, overlapping no run of yours. Step 2's targeted run has finished before this step opens, and under Branch-and-PR its first-green commit has already landed at step 7. Their fixes land in step 4, which runs the section's close gate after them, so the gate that closes the section covers what the round changed (the lanes and their moments are owned by the operating doctrine's gate bullet). The adversarial-reviewer gets the spec path, the base git ref or changed-file list, the section name, and a REQUIRED `Amendments in effect:` line filled from the plan doc's `Standing Brief Amendments` block or explicitly `none`. When the section touched C# or T-SQL, it also gets the csharp-style or sql-style absolute paths, resolved by the Dispatch Brief template's style-skill ladder.

   Every sentence of the blind-reviewer's brief passes one test: would it read identically for every diff in this repository? So it gets the base git ref or changed-file list, never a captured diff. It never gets the spec path, the plan, the section name, or a line on what the change adds or where to focus. Omit docs/ paths from the changed-file list, since their hunks carry the intent story. The withheld items are the common leaks, not the rule. A brief that withholds every one of them and still says what the section was for has failed the test. The blind boilerplate carries one line telling the reviewer not to read under `.kit/`, since that scratch path sits inside the tree it greps.

   **A section carrying an `Audience:` line is a deliverable document, and the document pair is added to whatever the section's own content earns, never subtracted from it.** It replaces the code pair only where the section's changed files are all documents. Dispatch `blind-reader` once per persona the `Audience:` line names, carrying the document paths and its `Reader:` line only, under the same property test. Dispatch `prose-reviewer` once with the full Document Review Brief (template below). Where the section also changed code, the code pair reviews its non-document files in the same round.

   Where omitting the docs/ paths empties the list on a section with no `Audience:` line, skip the blind dispatch, run the adversarial-reviewer alone, and record `blind: no code diff` on the Chapter's review line. If the section touched input handling, authentication or authorization, SQL construction, secrets or configuration, shell or process execution, a command permission grant it composes or widens, a hook that emits an allow or deny decision, or an external boundary, also dispatch the `security-reviewer` agent alongside them. If the section's delta spawns a process, runs on a per-tool-call path, walks the tree, holds a lock, waits on another process, or queries a store, also dispatch the `performance-reviewer` agent alongside them.

   **The four code lenses run in two tiers, ranked adversarial, blind, performance, security.** The correctness tier, the adversarial-reviewer and the blind-reviewer, drives step 4's fix round, provenance read, design stop and round backstop. The advisory tier, the performance-reviewer and the security-reviewer, takes step 4's advisory disposition for its Criticals and Majors. Tier is keyed on the lens and never on the finding. Both advisory lenses ride round 1 and a re-raised round where their triggers above hold, and join no decayed round.

   **The `Amendments in effect:` line is sighted-only.** Every sighted dispatch in the round carries it, the prose-reviewer's as a Document Review Brief field, save the scope adjudicator's. It never reaches the blind-reviewer or the blind-reader.

   **The adversarial lens, the security lens, the performance lens and the scope adjudicator carry a `Trace target:` line, and no other dispatch does.** The line names the spec's Goal, its `## Intent` record where the plan carries one, and its acceptance bullets as amended by any `Standing Brief Amendments` entry. Quote any bullet an amendment moved into the dispatch, since a by-path read returns the unamended bullets. The adjudicator's relevance brief carries only the Goal, the `## Intent` record and the acceptance bullet a performance finding quotes.

   **No run of this session's is in flight during the round, so any contention left is somebody else's.** Where this repo has exactly one shared resource a reviewer's build or run would block on, and anything holds it, a sibling session's suite or build among them, carry the Dispatch Brief's workspace-constraint line into every reviewer brief. It names the process holding the resource and the operations it puts off-limits.

   **A section's first review round runs every reviewer one tier up from the section's writer tier, Fable the ceiling.** Round 1 is the full roster: the code pair, the document pair, or both where the Audience rule above summons both, plus each advisory lens whose trigger holds. Every later round is one dispatch at the writer's tier, carrying what its round 1 brief carried: the prose-reviewer where the fix delta touched only deliverable documents the Audience rule names, else the adversarial-reviewer.

   A Critical from a correctness lens that survives adjudication, in any round, re-raises the next round to round 1's roster, rows and tier, the tier re-read against the writer tier in force when it dispatches. A re-raised round that returns no such Critical hands the next round back to one lens. After a tier escalation the escalated tier is the writer tier. A later round over a haiku writer runs at sonnet, the reviewer floor.

   An inline section's writer tier is the session's model, which built it, and an untiered section takes whatever tier built it. The reviewer's tier rides as an explicit model override on every dispatch, and a `fable` override takes step 1's capacity reading first. The one inheriting case is a Fable reviewer on a Fable-led session, which passes no override and takes no reading. A first-aim gate that could not be run at its fable tier here is confirmed per finishing-work's unavailability rule or measured by step 1's capacity reading, compensated per the effort table below, and recorded. A per-section reviewer below Fable whose tier could not run, confirmed the same way, re-aims one tier up, Fable the ceiling, one dispatch at a time with the ladder's one retry. A chain whose re-aim at fable is itself ruled out ends that dispatch's gate ungated. A re-aim, an ungated end and the document pair with its readers count go on the Chapter's review line in the template's form. A re-aim or an ungated end is neither pass nor failure for step 1's escalation ladder.

   **Never pre-judge the review:** do not tell a reviewer what to flag, what to ignore, or how to rate a finding ("treat as Minor", "the plan chose this"). Let each reviewer surface it and adjudicate per responding-to-review. **A repo-wide defect class is neither pre-judging nor contamination.** The test is the blind-reviewer's own: would the sentence read identically for every diff in this repository? A standing property passes and may ride in any dispatch, the blind one included. A sentence that would change with the section is barred from the blind dispatch, and barred everywhere as pre-judging when it carries a rating.

   **Bracket every round with a tree-state capture.** Run `git status --porcelain` before you dispatch and again when the round returns, and compare the two before acting on a single finding. Two deltas are no incident. One is in a concurrent section's declared files while a live dispatch for that section covers them, checked against the live dispatches the interim board entry records with what each was asked, where one has been written. The other is a write this session made under steps 4 through 8 or the interim-board ritual, its authorship established by reading the delta's content, never by its path. Any other delta is an incident: restore the tree, record the delta and the agent that produced it in the Chapter, treat that agent's findings as suspect pending a re-review against the restored tree, and jot a kaizen note.

   For a genuinely trivial, self-contained section (a rename, a comment, a one-line change with no logic), the per-section reviews are optional as a pair, since finishing-work still covers it.

   **The Document Review Brief.** The document pair's dispatches fill this template. Add no field to the blind-reader's dispatch beyond what its input contract names.

   ```
   Document Review Brief:
   - blind-reader (one dispatch per persona the Audience: line names):
     - Document paths
     - Reader: the persona and its knowledge level
     - Nothing else that describes the documents' intent (a standing repo
       property may ride; anything that would change with the section may not)
   - prose-reviewer (one dispatch):
     - Spec path + document paths in scope
     - Amendments in effect: every entry from the plan doc's Standing Brief
       Amendments block, or explicitly "none"
     - Audience: each persona and its knowledge level, from the section
     - Voice: scott | company | other, naming a voice reference in the
       prose-register skill or naming none
     - Fact-base paths: the code, living docs, and the canonical numbers
       table where one exists
     - The prose-register skill's absolute path plus its
       references/ai-tells.md, resolved by the same ladder as the Dispatch
       Brief's style-skill bullet
     - The voice reference's absolute path where the Voice: value names
       one, resolved by the same ladder
   ```

   **Reviewer effort.** The model rule above sets each reviewer's model, and this table sets its effort and route for every reviewer dispatch in the round, the advisory lenses included. Answer the route question first, Fable or not, and only then does the lens set the effort.

   | The reviewer's dispatch | Model | Effort | Route |
   |---|---|---|---|
   | Round 1's code pair and document pair over a section whose writer tier is opus or fable | fable | `low` (frontmatter default) | Agent tool |
   | Round 1's security-reviewer over a section whose writer tier is opus or fable | fable | `medium` (frontmatter default) | Agent tool |
   | Round 1's performance-reviewer over a section whose writer tier is opus or fable | fable | `medium` (frontmatter default) | Agent tool |
   | The scope adjudicator, in every shape step 4 and finishing-work dispatch it | fable | `high` (frontmatter default) | Agent tool |
   | Round 1's reviewers one tier above a haiku- or sonnet-tier writer, whichever lens | sonnet or opus | `high` | `Workflow`, on the template below |
   | A later round's one lens over a fable writer | fable | `low` (frontmatter default) | Agent tool |
   | A later round's one lens over a haiku, sonnet or opus writer | the writer's tier, sonnet the floor | `high` | `Workflow`, on the template below |
   | A per-section reviewer re-aimed after its tier was ruled out | one tier up, fable the ceiling | `high` | `Workflow`, on the template below |
   | The finishing reviews over the whole changeset | fable | `high` | `Workflow`, per finishing-work |
   | Compensation for a Fable gate ruled out by finishing-work's unavailability rule or step 1's capacity reading | opus | `max` | `Workflow`, per finishing-work |

   A Fable reviewer carries its agent's frontmatter effort, so its round rides the Agent tool: `low` for the blind, adversarial and prose lenses, `medium` for the security and performance lenses, and `high` for the scope adjudicator. The adjudicator's `high` is its charter's own pin and never a compensation notch. A reviewer below Fable runs at `high` in every lens through the per-call route, since a frontmatter effort is one value per agent whatever model runs it.

   The compensation row serves only a Fable gate that could not run here or that step 1's capacity reading measured exhausted. A below-Fable reviewer ruled out takes the re-aim row instead. Unavailability is confirmed and recorded per finishing-work's unavailability rule, which owns its triggers. Per-section rows key on the writer tier, the re-aim row on the tier ruled out, and the scope adjudicator's row on neither. The rule never produces Fable at `max`, and a below-Fable reviewer's `high` never climbs there.

   **Dispatching a reviewer above its frontmatter default.** On v2.1.205 the Agent tool takes a model override but has no effort parameter. So any dispatch whose row names an effort other than the frontmatter default goes through `Workflow`'s `agent()` instead. Every such call fills this template:

   ```
   Reviewer Dispatch (all REQUIRED):
   - agentType: the agent's scoped name (grimoire:adversarial-reviewer,
     grimoire:blind-reviewer, grimoire:blind-reader, grimoire:prose-reviewer,
     grimoire:security-reviewer, grimoire:performance-reviewer,
     grimoire:consultant, grimoire:plan-reviewer, grimoire:scope-adjudicator).
     Omitting it yields a workflow-subagent, a type readonly-agent-guard does not
     govern, which hands the tree under review to an agent free to rewrite it
   - model: named explicitly, never left to inherit. A call carrying an effort but no
     model runs the session's model at that effort, which on a below-fable session is
     a weak model at maximum effort: the downgrade this rule exists to prevent
   - effort: named explicitly, never left to inherit. An unnamed effort resolves
     to no dependable default
   ```

   A dispatch on this route carries the `Amendments in effect:` and `Trace target:` lines the rules above give it, beside the template rather than in it.

   The doctrine's standing-dispatch bullet carries the operator's request for this route, so it needs no per-session ask. The round stays one round: mixed Agent-tool and Workflow dispatches go out together under the single tree-state capture, and a Workflow round is awaited by the `WAITING:` turn end like any dispatch. Every input contract above still binds on this route. A script assembling several dispatches authors each blind prompt as its own literal, the blind boilerplate plus its contract inputs and nothing else, sharing no brief-building constant, helper, or template variable with any sighted dispatch. The property test judges the assembled string each agent will actually receive, never the ingredient list.

   Where the Workflow route is unavailable in a session, the dispatch and any re-aim of it take the Agent tool at the row's own model override and the agent's frontmatter effort. The Chapter records the review as run at reduced effort against its row's effort.

   **The compensation notch belongs to gate-shaped work and never to plan-following work.** It reaches the consultant and the scope adjudicator, gates with no backstop, and never an implementer. A below-Fable reviewer's `high`, first-aim or re-aimed, is the rule's own level rather than this notch.

4. **Address findings.** These routes are the correctness tier's, the adversarial and blind lenses'. An advisory lens's Critical or Major takes the advisory paragraph below. A Major is read for its provenance first, per the paragraph below, then fixed, bucketed, or recorded in the Chapter with why it is not fixed. A Minor is upgraded at adjudication only on a stated consequence. Otherwise it goes on the section's Minor list for one pass at section close, or takes the out-of-scope route below where it lies outside the section's scope.

   The Minor list is `.kit/scratch/<plan-slug>/minors-section-<n>.md`, created with the file tool and never deleted, one line per Minor as the lens printed it, prefixed with its round number. The close pass runs after the terminal condition below is met and before the close gate, and no review round follows it. A Minor whose fix would meet the fix-delta bar below is left with the reason. The pass's delta takes step 5's below-bar author re-read, recorded in the Chapter as an author re-read rather than a round.

   **An advisory lens's Critical or Major is weighed and dispositioned, never routed.** Each Critical and Major the performance-reviewer or security-reviewer returns gets one line in the section's advisory list, `.kit/scratch/<plan-slug>/advisory-section-<n>.md`, kept as the Minor list is: the finding as printed, and fix now, defer (naming the backlog entry) or refuse (why it does not apply to this project's stated requirements and deployment), with the reason. A fix-now fix joins the open fix round. With none open, it opens its own round where it meets the fix-delta bar below, and joins the close pass where it does not. Only a fix-now lean takes a relevance ruling: one `scope-adjudicator` dispatch before the fix is written, sent as the held-finding paragraph below sends it, on the relevance brief its charter states. The ruling returns `CONFIRM`, `REFUSE` or `ASK`. The orchestrator adopts it, and checks on its own surface that its `GROUNDS` names a positive ground rather than a bare absence, as the held-finding paragraph below checks a bucket's. On this shape that ground may be a quoted sentence of the project's `## Threat model` section. Where the model is absent it may be the deployment sentence the Intent record and the Goal state. A residual `ASK` passes by naming the sentences it read and what none of them settled. The one blocking case is a security Critical whose `threat:` field cites the project's `## Threat model` section, `threat: absent` counting as a citation, and it takes the ruling whatever the lean. Where the ruling confirms a cited security Critical, it is fixed before the section closes or raised to me, and never frozen by the round backstop below. A refused one is dispositioned refuse on the judge's ground, and an uncited one is read as an advisory Major. An `ASK` defers a Major or an uncited Critical, with the judge's recommendation as the backlog entry's reason, and raises a cited Critical under the plan's `## Operator Verification` rather than as a BLOCKED hold. A security-lens finding that a document or a comment states something the code does not do takes fix now, or a Chapter line naming the sentence and why the finding fails, and never defer. The claim-class region below never binds an advisory lens. A fix-now fix still takes the add-decision line and the design stop below. Where that stop answers a confirmed cited Critical's fix with a negative-half refuse, one grounded on what the plan keeps out (its `## Out of Scope` list, or the Intent record's not-done clauses and refused alternatives), or an ask, the Critical is raised, never justified-not-fixed. An advisory finding on its own never opens a round, enters the provenance read, or fires the design stop or the round backstop, though a fix round its fix's delta owes counts toward the backstop. An advisory copy of a defect a correctness lens also reported is dispositioned as covered by it, and an advisory Minor joins the Minor list. The tally goes on the Chapter's `Metrics:` line as `advisory:`, never in the provenance tokens.

   <!-- KIT-CLAIM-CLASS:BEGIN -->
   A behavior finding states a failure scenario: an input or a state where the code does the wrong thing on a reachable path, or a test exercises the wrong thing. A claim finding states none, and its fix changes a sentence and nothing that runs: a comment, a header, a docstring, a test's because-string or title, a test instrument's stated reach.

   A claim on a published contract surface, a README, a skill, a charter or a document under `docs/`, is held to a behavior finding's bar in two cases. One is a sentence in the section's own delta contradicting an acceptance bullet, a Goal sentence or an Intent clause of the `Trace target:` that the finding's `trace:` quotes, the orchestrator making that trace for the blind lens. The other is a pointer that delta left aimed at nothing, wherever it sits. Any other claim finding rates Minor whatever severity it arrived with, and the downgrade is recorded on the Chapter's Minors line as an upgrade is.
   <!-- KIT-CLAIM-CLASS:END -->

   **A Major enters a fix round on its provenance, never on its severity alone.** Provenance is read at adjudication, before any fix exists, from the finding's trace and the diff, never from the repair, and takes the first value that fits. A finding tracing to no acceptance bullet, no Goal sentence and no Intent clause is new-requirement, wherever its lines sit. A traced finding in lines a fix round of this section wrote is fix-introduced. Every other traced finding is spec-traceable. A Major reporting that the delta built what the plan's `## Out of Scope` list or the Intent record's negative half keeps out, or that it contradicts a recorded decision, is spec-traceable whatever its trace.

   The adversarial, security and performance lenses get the spec path and put a `trace:` field on every Critical and Major. The orchestrator traces the blind lens's, and any finding reading `trace: unsupplied`, which is no trace rather than a trace of none. Reader and prose findings take no trace. A trace is a reviewer's assertion, so check it both ways. Confirm a cited bullet, Goal sentence or Intent clause exists in the `Trace target:` and covers the finding's subject before reading provenance off it, and re-trace a `trace: none` against that target before holding anything on it. The Chapter marks every trace the orchestrator made as orchestrator-made.

   A Critical from a correctness lens is fixed before the section closes or raised to me, its provenance read for the Metrics line alone, so it is never held and never bucketed. A spec-traceable or fix-introduced Major takes the add-decision below, then the fix round. A new-requirement Major never enters one. It is held, and the section continues on every other finding.

   The held finding goes to a judge: the repo's live Expert seat where the roster the peer-sessions skill owns shows one, asked through the completion contract's expert-ask paragraph, otherwise the `scope-adjudicator`, dispatched through the Agent tool with the fable model override after step 1's capacity reading, at its charter's effort, and through `Workflow` only on the compensation route above. Its charter states the brief, which carries no `Amendments in effect:` line, so an amendment that moved the acceptance bullets reaches the judge by refreshing the Goal, `## Intent` record, acceptance bullets and `## Out of Scope` list the brief quotes. Its provenance fact is the base ref with the fix commits where the section's work is committed, else a capture taken at the adjudication that holds the finding, `git diff <base> -- <the section's Files in scope> ':(exclude)docs/plans/**' ':(exclude)docs/archive/**' ':(exclude)kaizen/**' > .kit/scratch/<plan-slug>/<section>/fix-round-<n>.diff`, with each untracked in-scope path appended by `git diff --no-index -- /dev/null <path>` from the repository root and a path under those three roots skipped by hand, and the brief names that latest capture alone.

   Adopt a bucket as a ruling, never re-deriving the scope call, but check its `GROUNDS` on your own surface for a positive ground rather than an absence. So a refuse names the Goal reading, the Intent clause or the `## Out of Scope` entry that keeps the finding out, and the check confirms that entry exists and reaches this finding. An accept-and-declare names the Goal sentence or Intent clause it serves and its bound, and the check confirms the clause exists and the declared work adds no mechanism the trace target lacks. A quoted bullet must exist in the target and cover the finding's subject. A ruling failing the check is only a lead, since an adopted refuse suppresses an escalation, and the finding falls to the adjudicator as an unanswered ask does.

   A `NEEDS_CONTEXT` from the adjudicator is a brief defect: correct what the charter names and re-dispatch once, before the close gate. A second takes the ask bucket's route with both returns in the brief, under the fixed first line `BLOCKED: section <n> holds a new-requirement Major; the judge returned NEEDS_CONTEXT twice`. An expert ask still unanswered when the section is otherwise ready for its close gate falls to the adjudicator, dispatched before that gate runs, so no section closes with a finding held. A seat's later answer is recorded beside the adjudicator's ruling, which stands. The Chapter's `Review Findings:` field records each held finding with what it waits on, and each ruling with its seat.

   The judge returns one of three buckets, a closed set, and a finding meeting neither of the first two tests is an ask. Refuse is for a finding off the goal path the Goal, the `## Intent` record and the acceptance bullets draw, or inside what the plan excludes. Its ground, never its verdict, goes in the plan doc's `Standing Brief Amendments` block as a rule the next round judges against, and it refreshes no quoted what. Accept-and-declare is for a finding that serves the Goal, is bounded and adds no new mechanism. It re-enters as spec-traceable, and its one home is that block, written at adoption as one appended acceptance bullet carrying no lens, round, seat, bucket or ruling provenance. The Chapter's approval-drift line and the next board recap record the adoption without becoming homes. Ask is for a new mechanism, a changed recorded decision, a reopened accepted risk or section-sized work. It goes to me on the BLOCKED path, the finding, the evidence and the judge's recommendation in the body, under the fixed first line `BLOCKED: section <n> holds a new-requirement Major; the judge recommends an ask`, the backstop's line leading where both fire. It holds the section at this step, steps 5 through 8 unrun, until my answer closes the section.

   **Every Major entering a fix round gets one line before anything is built, and so does every section at its open.** That line is the add-decision, written to `.kit/scratch/<plan-slug>/add-decisions-section-<n>.md` and kept as the Minor list is. It names five things: what the fix changes; the Goal sentence, Intent clause or acceptance bullet it serves; whether it adds a mechanism; its size as a number where one exists; and what not building it costs. A mechanism is a unit of behavior that runs and that no such clause names, a guard being one instance, and never a rename, a moved line or a changed message. The section-open line fires no stop, an unnamed mechanism there being an intake gap. An implementer's mid-work line is appended when its report is adjudicated, and on an inline section the orchestrator writes both lines and takes the stop itself. A Critical from a correctness lens takes no line.

   **A fix whose add-decision adds a mechanism no clause names is a design stop, not a fix round.** It fires on that line alone, never on severity, provenance or a round count, at the adjudication that wrote it and before anything is built. It asks whether the mechanism should exist and, if so, in what design, and the bucket answers both. The held-finding judge rules, never the `consultant`, because that judge must never receive the querent's lean. Its brief is the charter's fixed one: the line's first four parts and the finding verbatim, or the implementer's line where a report raised the stop, never the cost clause or the account of a round. The held-finding paragraph's re-dispatch, `GROUNDS` check and double-`NEEDS_CONTEXT` exit apply, the exit under `BLOCKED: section <n> hit a design stop; the judge returned NEEDS_CONTEXT twice`. Here a refuse names the clause the finding traced to, or the one the line says it would serve, and that clause's form, and the check confirms the mechanism departs from that form rather than that the clause exists. The section continues on every finding the mechanism does not touch, and with no other finding in flight the adjudicator is dispatched at once.

   A refuse is recorded as the held-finding paragraph records one. On a Goal-reading or form ground the fix is still owed, written within the named form, its add-decision line rewritten first. On a negative-half ground, the `## Out of Scope` entry or the Intent clause that keeps the thing out, the Major is justified-not-fixed on the quoted ground. A declare moves no bullet: the Chapter's `Review Findings:` field and the next board recap record the mechanism, the bucket and the seat, and the fix enters its round as proposed. On the implementer-raised shape the ruling rides into step 1's re-dispatch brief, a form ground setting the form, a negative-half ground barring the mechanism and a declare releasing it. An ask holds the section and goes to me under `BLOCKED: section <n> hit a design stop; the judge recommends an ask`, the backstop's line leading where both fire.

   Where this stop fires with step 1's tier-escalation ladder or the loop-end second reversal, neither stands in for the other, and this stop convenes first. No consultant goes out on that mechanism before its ruling, since those consults carry the querent's lean. Until then the escalated brief, or the orchestrator on the ladder's main-thread branch, holds the mechanism off-limits. After it, a refuse moots a reversal, a declare runs the reversal's consult before the fix round, and an ask takes the completion contract's pre-BLOCKED consult.

   **The fifth review round is the operator's backstop.** A section whose adjudication after five review rounds still leaves the terminal condition below unmet stops on the BLOCKED path instead of opening its owed fix round. Where the only owed work is a fix owing no further round, under the fix-delta bar's prose-only clause or its below-bar judgment, the section takes the fix and closes, unless the written fix owes a round after all, which is then taken and counted against this bound.

   A round is step 1's tier-escalation unit, the roster step 3's round rule dispatched, advisory lenses and a round the fix-delta bar owed included, counted once its roster returns. A lens re-dispatched after the wedge hallmark completes its own round rather than opening another. The ladder's two numbers, this stop's lead ordinal and the backticked word below, each have one carrier, which `test/review-loop-provenance.test.js` holds single.

   The stop is a decision ask, never a kill: it ends no dispatch, discards no work and closes nothing, and the stopping round's fixes wait for my answer, save the two classes below. The count restarts at my answer, or at the answer settling both where an ask bucket's declaration rode with this one. A continue buys the section `three` further rounds, and from the third of those each adjudication leaving the terminal condition unmet declares again. The interim board entry carries the ladder's stage and the restarted count at every firing. The stop never fires on a round whose adjudication met the terminal condition.

   A Critical from a correctness lens, and the cited Critical the advisory paragraph sends here once confirmed, never freeze with the rest. Each is fixed before the declaration goes out, or raised unfixed where its fix needs my answer. A round that fix's delta owes, and a fix a design stop's refuse sent back, are named owed-and-unrun and taken first on the re-arm.

   Before declaring, write each owed round left unrun, with its reason, to the plan doc as an interim board entry in the closure-drought ritual's shape with no `Completed:` line, since the Stop hook records only the first line and a Chapter written early registers the section complete. If the section later closes, its Chapter's `Review Findings:` field carries the same record.

   The stop is a member of the completion contract's closed blocker set, so the pre-BLOCKED expert ask and consult both run. A design stop that already ruled in this section on the mechanism the phase analysis names stands as that consult, and that is this step's only substitution. Where both fire on one adjudication, the design stop convenes first and this declaration waits on its ruling, which then serves as its consult. A ruling on another mechanism, a double NEEDS_CONTEXT, or an ask bucket's ruling leaves the consult owed.

   Every hold this stop carries has a zero window. The live seat's ask still goes out under the never-gates rule, and the adjudicator is dispatched at once, before the declaration, unless one is already in flight on that mechanism, its ruling the consult in force and riding in the body, a later seat answer recorded beside it. Where step 1's tier-escalation ladder also fires, the declaration names the escalation owed and my answer releases it, and neither count moves while the section waits.

   The declaration's first line is fixed: `BLOCKED: section <n> hit the review-round backstop; phase analysis attached`, `<n>` being the section's number and nothing more. It leads any ask bucket's declaration owed on the same adjudication, which rides in the body. The body is the phase analysis, in the client-briefing register: the rounds grouped by what generated each, the spec, a fix delta or a reviewer's new requirement, each round's Majors with their provenance counts and which were fix-introduced, and the orchestrator's read of any cause the kit's rules missed. Before declaring, log `memq log kit.review.cap fail "<plan slug> section <n>: <rounds> rounds"`, the slug being the plan file's stem, with the provenance totals alone under `--detail`. Finishing-work's pass form uses `BLOCKED: the finishing pass hit the review-round backstop; phase analysis attached` and the summary `"<plan slug>: <rounds> rounds"`.

   **The loop ends on the class of what remains, never on a count or a rating:** it ends at the first round whose adjudicated findings, each read at its class, meet every condition below. A Critical so re-read is the adjudication downgrade the Chapter names.

   - The round carries no Critical from a correctness lens.
   - It leaves no owed Major, a behavior finding or a claim held to that bar, undisposed. A Major is disposed when fixed, routed out of scope, recorded in the Chapter as justified-not-fixed, or bucketed refuse with its record placed, a design stop's refuse only by the fix written within its form or on a negative-half ground. A declare still owes its fix, and an ask holds the section until I answer.
   - The round's fix delta owes no round under the fix-delta bar below.

   A held new-requirement Major neither keeps the loop open nor rides into a closed section. A finding's class is read at adjudication, before any fix exists, and whether the loop ends is read after the fix round. The fix follows the class, and the Chapter records the choice where a finding could close either way. A sentence-fix on a scenario finding leaves a Major justified-not-fixed or a Critical unfixed, never a claim dispositioned. A claim held to the behavior bar is dispositioned in the same fix round, and every other claim finding joins the Minors whatever its rating. A claim finding leaves only by one of four forms: deleting the false sentence, a cheap mechanical check where the claim earns keeping, a Chapter line naming the sentence left standing and why the finding does not hold, or the out-of-scope route where the sentence sits outside the section's files. None is silently dropped, and a sentence stating something the code does not do is still fixed at the close.

   A fix delta whose every hunk changes prose alone owes no round under the bar, whatever finding it dispositions. Prose is a comment, a header, a docstring, a README or `docs/` sentence, a test's title or because-string, a test instrument's stated reach, or a rule's sentence in a skill or charter. Such a delta takes step 5's below-bar author re-read, recorded in the Chapter like the close pass's, and for a claim held to the behavior bar the re-read checks the sentence against the clause or pointer the finding named. A round the below-bar judgment adds by choice takes this condition like any round. An owed Major's second reversal on one passage, round N+2 undoing N+1's change to N's fix, is the consult skill's trigger (a), and the consult's adopted ruling closes the passage, after the design stop's ruling where the reversing fix fired one. Weigh each finding per the responding-to-review skill before acting on it.

   A fix correcting a claim in curated prose, a deletion included, takes the paragraph as its edit unit rather than the sentence, and carries the claim's other carriers with it, per the writing-skills skill (`skills/writing-skills/SKILL.md` under the kit plugin root). A carrier in a file outside `Files in scope:` takes the out-of-scope route, since the scope check never sees an edit there.

   **The recurrence rule:** when a review surfaces a finding class an earlier section's review already surfaced, fix the instance and amend the plan's `Standing Brief Amendments` block, which step 1 delivers on both paths, so every later section inherits the guard. Only a behavior class takes an amendment. A claim held to the behavior bar counts as behavior here. Any other second instance of a claims class takes a mechanical check or a deletion sweep. A sibling already in flight takes the amendment at its next review round. Where the plan has no block, create it as its own `##` heading above `## Sections of Work`, never inside it. Record the amendment in the Chapter as approval drift, since the block sits inside the approval-scoped fingerprint.

   **After each fix round, re-run step 2's promises command with `--against` its record in place of `--record`.** Before the close gate, re-read every promise over 0.6 or whose doubt rose 0.3 or more.

   **This step runs the section's close gate, once the fixes, the folds and the Minor pass are in.** It is the section-close lane the doctrine's gate bullet names, with the contention lane where that bullet says so, and its counts and exit code go to the Chapter's `Gate:` line. That run is what the fold predicate below means by the gate you are about to run.

   **The adoption trigger is the block's second writer, and it fires on an event rather than a count:** any change to what a section's dispatches are built from, such as an adopted escalation, an operator decision or a spec amendment, is written to the `Standing Brief Amendments` block when adopted, before the next dispatch. An operator decision made mid-run also lands in the plan's `## Intent` section, per brainstorming's freeze paragraph. Where the plan has no such section, add the heading between `## Goal` and `## Approach` and record it as the same drift. The block still carries judge rulings and declared bullets to every sighted dispatch. The intake gap check's route (a) and (b) resolutions stay out of it, their home being the Chapter's `Assumptions:` line.

   **A fix delta can owe a review round of its own.** A round over a fix delta is owed, never optional, on either of two triggers: the delta touches an outward action, such as a network call, a process spawn or a write outside the tree, or it adds a module the section did not have before. Tests exercising the delta directly waive neither trigger. A round is also owed where the delta's subject is something the area's tests are liable to route around rather than exercise, a judgment over hunks that change what runs, so a prose-only delta sits below it. Below the bar, step 3's trivial-section judgment decides, and a Critical surviving adjudication inside such a round counts toward step 1's tier-escalation ladder.

   **The out-of-scope route.** A surface the section's `Files in scope:` never listed takes this route, whatever its shape and however it reached you. A caller of the contract the section altered is one instance, not the boundary.

   **A Critical from a correctness lens never takes this route.** It is fixed before the section closes, whatever its scope, or raised to me, and never parked, deferred into an appended section, or carried past this section. One that reaches the destinations below by an adjudication downgrade from Critical is named in the Chapter as downgraded, with its destination.

   Adjudicate every remaining surface before the section's next step begins, confirming each against the code first under the doctrine's a-finding-is-a-hypothesis rule. A surface serving another goal leaves this plan, and inside the goal the fold predicate below decides.

   - **Fold it into this section** when the fix lands in a file in the same directory as one the section changed, needs no acceptance criterion the section lacks, and the gate you are about to run covers it. Add the file to the section's `Files in scope:` line and name the folded surface in the Chapter.
   - **Add it to the plan as a new section** in every other case inside the goal, at the end of the `## Sections of Work` block, immediately above the next `##` heading, in the section-heading and `Model:` shapes `curating-docs`' machine contract freezes. Record the append in the Chapter as approval drift, naming the section that surfaced it. It runs in this session, in the loop's order, after the intake gap check. The close-out status names it as a scope change, and under Commit-and-Push it is named to me when appended, through the relay channel where one is connected. A surface needing a material decision the spec never made takes the consult-then-leading-`BLOCKED:` path instead, though needing its own brief or acceptance is not that case. A surface contradicting a section already written is a contradiction inside the spec and earns the loud leading `BLOCKED:`, never a quiet amendment.
   - **Route it out of this plan** when it serves another goal, as a handoff, a fresh spec or prompt written now to the bar the doctrine's found-work rule sets. The floor, for a surface earning no handoff, is `docs/backlog.md` with the reason it is not done here, in the format `curating-docs` owns.

   **A surface is never left only in the agent's report.** The three destinations above are the whole set, and the one standing carve-out is step 5's.

5. **Update the plan doc.** Mark the section complete. Where the implementation deviated from the spec, update the spec section to match and flag the deviation in the Chapter. Where the deviation changes design intent, raise it to me rather than silently rewriting the spec.

   **A behavior this section changed re-opens the document an earlier section wrote about it.** Where a document in any completed section's `Files in scope:` describes a behavior this section changed, re-read its describing passages against the new behavior and correct them. Do it once the change is settled, at step 5 at the latest, so the correction rides this section's own review and staging. A correction landing after the round is a post-review delta and takes step 4's owed-round bar. Under Commit-and-Push, one below that bar takes the orchestrator's re-read of the delta against the changed behavior before the commit, recorded in the Chapter as an author re-read rather than a round. Name any section state whose only reader was its writer in the close-out status as well as the Chapter.

   The document is step 4's one standing carve-out: it neither folds nor becomes a section. Name it on this section's `Files in scope:` line and in the Chapter, since widening that line is approval drift. The closing section owns the check.

6. **Adjudicate the applied stamps, then append a Chapter** (format below). Where a Decision or Surprise traced to the kit itself fighting the work, also jot it to the kaizen inbox per the global capture rule.

   Before writing the Chapter, at every section boundary, a section that skipped its reviews included, run `memq unstamped --since <n>d` (or `<n>h`, never a date) over the time since the previous Chapter, else the 1d default. Stamp each record it lists (`memq touch <name> --applied`, with `--type` or `--operator` where its tier needs it) or skip it, on the generous bar the memory-system skill owns, and record the outcome on `Stamps:`. That skill owns how to read the report and when a boundary owes a hand walk. Take an owed walk before writing the Chapter, and name on `Stamps:` its window, why it was owed and what it found. **Do not widen the unstamped window past the previous Chapter:** a wider window pulls applied stamps into range and returns a shorter list.

7. **Apply the commit model** recorded in the spec header:
   - **Review-Only:** stage the section's changes (`git add`); never commit. Keep a running changed-files summary in the Chapter for the final walkthrough. `git diff --staged` is my review surface.
   - **Branch-and-PR:** commit the section's code with its Chapter to the feature branch, cutting that branch first where the checkout sits on a trunk. The verified state commits at first green, the first-green commit: once it passes step 2 and before the step 3 round goes out, with review fixes following as further commits, and step 1's staging discipline holds at every one of them. Finishing-work opens the pull request where none is open, marks it ready and arms auto-merge. The first-green push and the close push land on a PR branch, not an install surface, so neither fires the pre-push whole gate.
   - **Commit-and-Push:** commit the section and push to origin. Direct to main, commit only at close, never at first green, since main must never carry an unreviewed section state. On a worktree branch that concurrency put you on, take Branch-and-PR's first-green commits and lanes, and leave the merge to main and the teardown to finishing-work. Where the push lands on main and main is a trunk consumers install from directly with no CI gating the merge, the push is the install surface, so the whole gate runs before that push with the contention lane beside it, and step 4's close gate does not stand in for it. Run it before staging the plan doc, since its counts and exit code go on the `Gate:` line. Where a peer session may commit on this checkout, declare that window on the coordination surface before the gate starts. Writing those counts is the one edit permitted after the gate, and only the staged-list read sits between staging the doc and this commit.

   Under every model, a `docs/backlog.md` entry from step 4's out-of-scope route rides with the Chapter, staged or committed as the Chapter is. Where that file holds uncommitted content you did not author, the ride is off: the doctrine's shared-file hold and peer-overlap bullets govern the entry, with peer-sessions' bilateral option where a live sibling may hold the file. The section still ships on schedule, naming the held entry and the foreign lines on the Chapter's `Decisions / Surprises` line and in the close-out.

8. **Open the compaction checkpoint.** Once the Chapter is appended and the commit model honored, this is a chapter boundary, where a compaction costs nothing. Tell the gate so:

   ```
   node <plugin-root>/hooks/kit-compact-checkpoint.js open
   ```

   Resolve `<plugin-root>` as step 0 does, and run it from the session's own shell, since it records the caller's session id. The CLI's open message and the gate hook's header state what the checkpoint admits and how long it lives. With no goal armed it is a harmless no-op refusal. Its exit-1 refusal of a caller it would not bless is step 0's resumption case, with the remedy and the leave-the-goal-alone bound step 0 states.

   On the unleashed branch, where no goal is armed, declare the boundary at the same moment instead, from any directory, a linked worktree included, since the marker is keyed by session: `node <plugin-root>/hooks/kit-compact-checkpoint.js boundary`. The peer-sessions banking rule owns the verb and its preconditions. Declare at banked moments only: a dispatch `WAITING:` stop, a `BLOCKED:` stop and a mid-section turn end leave work in flight and declare nothing.

**On a gated run, compaction lands at chapter and interim boundaries by design.** With a goal armed and this session holding the leash, the PreCompact gate defers auto-compaction until step 8 or the interim ritual below opens a checkpoint. A deferral noticed mid-section is the gate working: do not clear the goal, do not touch the checkpoint other than through the interim ritual below, and do not treat it as context pressure. A safety valve admits compaction near the model's limit but assumes a window of roughly 1,000,000 tokens, so it never fires on a smaller one. A run climbing toward its limit while compaction is still deferred is the one case to surface to me.

**A closure drought earns an interim boundary.** Its floor is two consecutive review-round adjudications with no section closing, and a run that sees one forming may act earlier. The other trigger, and the more reliable, is `compact-deferral-nudge.js`, which reports at the return of a long tool call how many offers it is holding and for how long. At either, append an interim board entry below `## Chapters` and honor the commit model for the doc, then open the checkpoint with the same CLI call step 8 names, or, where no goal is armed, declare the boundary with step 8's unleashed branch. The entry supplements step 8 and never replaces it. It is not a Chapter and carries no `Completed:` line. Head it `### Interim board N - YYYY-MM-DD`, N counting the plan's interim entries. It carries, in order: each in-flight section's stage, the live dispatches and what each was asked, the current gate baseline with the moment the moment-pin bullet of `skills/testing-discipline/SKILL.md` under the kit plugin root requires, the rulings adopted since the last boundary, and the next action per section. Under Review-Only the entry is staged like everything else and the checkpoint still opens.

Then continue to the next section. Do not stop here.

## Consult

The consult skill (`consult/SKILL.md`) owns the consult: its seat, triggers, brief, model rule and how a ruling is adjudicated. Use the consult for a question whose framing may be wrong, the expert ask for an answer that may already exist, and the reviewers for a diff.

## Delegating to Subagents

The orchestrator stays the designer: it writes dispatch prompts, judges findings, reads implementer diffs, and writes Chapters. Keep a task in the main session only when it is design-entangled, tiny, or session-state-dependent: its shape still being discovered in contact with the code, a prompt that would cost more than the work, or an in-flight debugging chain.

A subagent loads the skill catalog and, where the machine's CLAUDE.md imports it, the kit doctrine, but no skill bodies, no conversation, none of your in-flight directives and none of the kit's memory context. So assume no memory arrived, and carry any memory bearing on the section in the brief. Forward every standing directive verbatim, the style contract and the exact constraint among them.

**Write the dispatch prompt from the actual current code,** assuming a skilled engineer with zero context for this codebase. The Dispatch Brief template in step 1 names the fields.

**Hand bulky inputs over as files,** not pasted inline: the spec, or a diff captured with `git diff > .kit/scratch/<name>.diff`. Keep the project's `.gitignore` covering `.kit/`. The blind-reviewer is the standing exception: it takes the base ref or changed-file list per step 3's contract, never a captured diff.

**A subagent's report comes back in its final message, not as a committed file.** Have each return its report inline, and distill the durable outcome into the Chapter. A large review may return the verdict, the Critical/Major/Minor counts and the top finding inline, with the full findings in a `.kit/` file the orchestrator reads only when adjudicating. The same discipline applies to read-only scouts, whose return contract is below.

**Parallelize only when tasks touch non-overlapping files.** Lock shared contracts first and assign disjoint files.

**Stagger concurrent sections; lockstep is the anti-pattern.** Advance them offset: one being briefed, one implementing, one in review. Run steps 4 through 8 for a section the moment a round's step 4 ends with nothing blocking its close, which is a fixes-then-re-review cycle clearing at its final round's adjudication, and never batched with siblings. A step 8 close reached while siblings are in flight appends an interim board entry beside its Chapter, carrying the closure-drought rule's content list.

**A brief grants nothing a mechanical guard denies.** Where a PreToolUse guard keys on agent type, widening the agent's file scope in the brief is inert: the write is blocked whatever the brief says. Route around the guard at dispatch time. Send an agent type the guard admits, keep the guarded write in the main thread, or have the agent return the text in its report for the main thread to place. Step 1's `docs/` routing override is this rule's standing instance.

**A brief forbids nothing the guard does not govern.** The readonly-agent-guard binds only the types its own classifier names. So a scout dispatched as Explore or general-purpose, or a Workflow `agent()` call naming no `agentType`, carries Bash the guard never reads, and its brief's read-only instruction is a request, not a control. Bracket every read-only-intent dispatch under an ungoverned type with `git status --porcelain` before dispatch and again at return, any delta taking step 3's round-bracket incident path. The named types are instances, not the boundary, so a type you cannot place as governed gets the bracket.

**Band the scout by question shape, and state its return contract.** A closed fact-check (does X contain Y, confirm a value) rides the harness default. Open discovery (map a surface, find every call site) gets an explicit sonnet override. Never dispatch top-model recon. A "simple check" that returns more than a couple of leads was mis-banded, so re-run it as discovery. Every scout prompt states its return contract. Each lead comes back as a file:line reference with a one-sentence fact and why the site matters, never pasted file contents, and bulky evidence goes to the gitignored `.kit/` scratch path, read on demand.

**Serialize what the environment cannot share.** Implementation that touches shared state stays single-agent-per-worktree, and the long integration suites follow the doctrine's sequencing bullet.

## Chapter Format

Append to the plan doc's `## Chapters` section:

```markdown
### Chapter N - YYYY-MM-DD
Completed: <N. section title, the bare section number leading; one section per Chapter>
Implemented By: <main session | implementer-haiku | implementer-sonnet | implementer-opus | implementer-fable, plus any escalation>
Metrics: <review rounds <n>, closed <clean | claim-exit | major-closed>; provenance <s> spec-traceable, <f> fix-introduced, <r> new-requirement, rulings (<a> refused, <b> declared, <c> asked); advisory: <v> findings, <w> fixed, <d> deferred, <e> refused; NEEDS_CONTEXT count; escalations; consults <n>, counting consultant dispatches alone; `closed` is read off the last round that carried findings: `major-closed` where it carried an owed Major, `claim-exit` where it carried a claim finding and no such Major, else `clean`>
Recap: <finishing Chapter only: the plain-language recap whose parts and order finishing-work's step 6 owns>
Decisions / Surprises: <the section's add-decision lines, verbatim and line by line, from `.kit/scratch/<plan-slug>/add-decisions-section-<n>.md`, its own open first, or on the finishing Chapter from the interim board entry `finishing-work` writes them to; then anything resolved or discovered, or "none"; in the kit's own repository, one line for the probe pair reading writing-skills' RED and GREEN step calls for, with its moment-pin, or the state that step names instead, or that no scenario turned on or no shape file was named, none of which is recorded as clean>
Failed approaches: <each as "tried X, failed because Y, learned Z"; "none" is acceptable>
Assumptions: <the declared-assumption entries recorded during this section; "none" is acceptable>
Review Findings: <held: <finding> awaiting <seat>; design stop: <mechanism>, ruling <bucket> by <seat>; `review: <pair or lens>[ (<n> readers)] at <model>, <route>[ (<chain>)]`, per dispatch where a pair split, a capacity-downgraded round's reader line quoted verbatim as its `<chain>`, or `review: <pair or lens> ungated (<chain>)`; `blind: no code diff` beside it where the blind lens was skipped; then Critical/Major addressed, a Major the orchestrator traced named as orchestrator-made; Majors justified; Minors: <n> fixed in the close pass, <m> upgraded on a stated consequence, <k> left with the reason; on the finishing Chapter alone, `goal read: <b> built-but-unasked (<a> refused, <d> declared, <c> asked), <u> asked-but-unbuilt`>
Stamps: <adjudicated N, stamped M; "none surfaced" is acceptable where the stretch was accounted for; a window that owed a hand walk says so, why, and what the walk found>
Gate: <the lane or lanes that ran: the targeted lane at every section close, the contention lane beside it where the delta touched machine-shared state, and the whole gate with the contention lane again at step 7's install-surface push; their counts as tests/pass/fail and the exit code read from the run itself, the code itself rather than a statement that it was read; the delta against the baseline recorded on that same lane, or that no baseline exists on it; tests added, retired, and edited to stay green on the section's own change, one line per added or edited test naming the requirement it pins; how many added tests spawn a process, directly or through a shared helper, a generated site counted once with its instance count; the wall clock and contention reading in testing-discipline's clock-and-box form, against the same lane's baseline; each retired test's retire class, and for a retired guard, grant, refusal-path or designed-copy test its surviving cover or the `docs/security-model.md` sentence recording that none stands; any contention the run carried; in the kit's own repository on a final Chapter alone, the probe set's reading where finishing-work's step 6 calls for one, per leg invocation: the runner's summary line verbatim, any full path in it or in a quoted refusal reason respelled repo-relative or left out, the exit code where it differs, any report.md warning lines, the mismatched moments by name with each row's status, and its moment-pin; or the state that step names instead, or that no shape file was named, none of which is recorded as clean, a before leg the after leg gave no moments for being none of them; a `(partial)` line marked as the leg its re-run replaced; an exit code the doctrine's fallback path left unreadable marked so; a reading that reports and never blocks>
Next: <next section, or "finishing-work">
Commit Model: <Review-Only | Branch-and-PR | Commit-and-Push>
Delta: <the moment-pin for the reading below, since its output carries no machine or contention of its own; then what `node <plugin-root>/scripts/kit-size.js report --repo <the project's root>` prints, quoted whole and exactly in a fenced block below this line>
```

Chapters exist so that a compacted or fresh session can recover full working state from the plan doc alone. Write them for that reader.

A spawning test's modelled price goes in the Chapter body under testing-discipline's price paragraph, never on the Gate line.

The Delta line resolves `<plugin-root>` as step 0 does and names the repository outright, since under a marketplace install the default root sits inside the plugin payload. `scripts/kit-size.js` owns what the output holds and means, so the line adds no condition of its own. Spell any path the output carries repo-relative or leave it out, since an absolute checkout path carries the operator's user name into a tracked document. On a shared checkout the reading also carries other sessions' uncommitted edits, so read the row list rather than only the totals.

The Delta output sits after every line the Chapter heading's machine contract reads. No line an author adds to any Chapter field, quoted or free, the finishing Chapter's assumptions block among them, opens with `Completed:`, `Next:` or `#`. A recorded text that would is respelled there, with the respelling noted. The runner's summary line opens `probe-corpus:` and the report's warning lines `- WARNING:`, which is what lets both be quoted verbatim.

A Chapter is a journal-layer artifact, so every measured figure it records carries its moment in the form the moment-pin bullet of `skills/testing-discipline/SKILL.md` under the kit plugin root states. The deep evidence behind a figure keeps the home that bullet gives it, and the Chapter cites the analysis rather than restating it.

The Chapter heading and its `Completed:`/`Next:` lines are a machine contract read by external tooling. `curating-docs/SKILL.md`'s machine contract section gives the frozen shape and which values register a section complete.

## Finishing Handoff

Invoke the finishing-work skill; the effort is not done without it. This holds under Review-Only, which defers only the commit: finishing-work still flips the plan to Complete, archives it and stages it with the code.
