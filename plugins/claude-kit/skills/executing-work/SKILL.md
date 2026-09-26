---
name: executing-work
description: "Autonomous execution of an approved spec or plan from docs/plans/. Use when I say to proceed, implement, build, or continue an agreed plan, or when resuming a session that has an In Progress plan doc."
---

# Executing Work

Once the spec is approved, execute it under the completion contract below: no per-step check-ins, no "should you continue?", no gating individual edits. Interrupt me only for a member of the blocker set below.

## Completion Contract

The spec is the goal. Once execution starts, run every remaining unblocked section to completion in this session. A section boundary is not a stopping point. A long-running gate is not a stopping point. Context pressure is not a stopping point.

An externally-driven worker (the External-engine stand-down) finishes its directed section and stops, and that is completion, never an early stop.

**Do not end your turn** to:

- report progress between sections. Close the section and start the next.
- wait on a build, test suite, or Live gate. Background it, poll a readiness signal (`until` on a marker or exit code), and continue.
- manage context. The Chapter and the SessionStart resume hook make a fresh session lossless, and starting one is my call.
- await a subagent on a bare turn-end. End on a `WAITING:` lead instead.
  - End on `WAITING:` once a background dispatch (`run_in_background: true`, the Agent-tool default) is the only remaining work, whatever its class, an agent resumed over SendMessage and a model-override dispatch included. Under an armed leash the hook blocks a bare turn-end.
  - A dispatch is the only remaining work when every next step reads its result. Do work that needs no result first, and read every returned result before ending.
  - The `WAITING:` line names each still-pending task by its id and expected wake, the completion notification and any armed timer, as the registry the post-wake turn reads. Arm a timer first where you have the means, on the window finishing-work's cadence paragraph sets.
  - The one in-turn option is a synchronous dispatch (`run_in_background: false`), chosen per step 1's leash bullet.
  - Read completion from task status, never from transcript-file quiescence, since a mid-run pause reads as done. Only the wedge hallmark, which finishing-work's unavailability rule owns with its wakes and growth readings, makes a stall out of silence.
  - Never clear the leash to escape a block.

| The excuse | Why it is wrong |
|---|---|
| "This is a clean boundary to pause at." | Boundaries are for resuming, not for stopping with work left. |
| "Holding for the gate." | A wait is not a stop. Poll it in-turn. |
| "It is the tail of a long run, safer to stop." | The Chapter and resume hook protect you. Context is my call. |
| "Let me confirm before continuing." | The approved spec is the confirmation. |
| "I'll hold the turn open until the agent finishes so I can watch it." | An open turn queues inbound messages and gains nothing the wake does not give. End on `WAITING:`. |
| "I don't have enough context left to review the next round properly." | Compaction gives a fresh window. The choice is compact-and-review versus abandon. |

The table is instances, not the boundary. Any stop with unblocked work left, for a reason outside the blocker set, is wrong the same way.

Red flags that you are about to stop wrongly: "say the word and continue", "holding for", "paused here", "at the tail of", "ready to continue when you are". With unblocked work remaining, do not write them. Keep going.

**Stop only for a true blocker, and make it loud.** The blocker set:

- an external dependency only I can satisfy (a GUI action, a cloud resource that must be provisioned, a credential or secret you cannot reach),
- a contradiction inside the spec, or a material decision the spec does not cover,
- an act the doctrine's stop-for-a-yes rule gates and no proceed-ahead covers,
- a systematic-debugging dead end.

The set is closed, and capacity is never on it. Compaction keeps the leash and the plan doc keeps the state, so a stop reasoned from context is a stop dressed as a blocker. The two `WAITING:` occasions below, a turn awaiting only dispatched background subagents and a park taken on a request, are not on it either. Each ends a turn with the leash armed and no work stranded.

**Before any BLOCKED at all, the expert ask goes out, and it goes ahead of the consult.** Where the repo has a live expert seat, send it the blocker on the route the peer-sessions skill owns, with its seats and bounds. The ask never gates: keep working, and declare exactly when you would have without it.

An answer prevents a declaration only where it hands you something you verify yourself, a traced existing source or a diagnosis you can reproduce. A peer's say-so is a claim to check. The consult still runs on any decision that survives the ask. Neither instrument discharges a blocker that only my yes can clear. With no live expert seat, go straight to the consult.

On declaring, notify this machine's live coordinator seat, which routes rather than resolves, and the expert where the ask went unanswered. The ask and the notice carry the same public-board cap the first-line paragraph below puts on the declaration's first line, as a standard rather than a reading of where either lands. `docs/security-model.md` carries the readership analysis, and the coordinator skill owns the precondition it names, which bounds what that seat lands rather than what you send. Land a resolved ask in the plan doc that turn, or a post-compaction session re-hits the blocker.

**Before any BLOCKED that turns on a decision, the consult runs too, after the ask and before the declaration.** An external dependency only I can satisfy, and an act the stop-for-a-yes rule gates and no proceed-ahead covers, go straight up. A spec gap is mine only where it turns on preference, cost, or risk appetite, and rulable where it turns on facts about the system. Rule a mixed question first so only the small real fork reaches me, and carry the ruling in the brief. The consult skill owns the mechanics. Step 4's review-round backstop states the one case where a design stop's ruling stands in for this consult.

When you stop, the message's very first characters are `BLOCKED: <exactly what you need from me>`, with no summary, bold or heading above it, and any shipped-work recap after the BLOCKED paragraph. The body is a decision brief in the doctrine's client-briefing register, decidable from the brief alone on my phone with no session context. The Stop hook releases only on the leading prefix, so quoting the convention mid-message never releases the leash. It refuses a capacity reason (context, compaction, a fresh session). Never write a progress update as a stop.

**The first line carries only what you would put on a public board, because it travels further than the rest of the message.** On a mid-queue advance the Stop hook records it into the plan's outcome note, which the coordinator seat reads onto an operator brief and its board. So compose that one line for a public board and keep it inside 120 printable-ASCII characters, since what runs past is dropped mid-clause. The cap is a standard, stated against a public board so that moving the board somewhere quieter never reads as relaxing it. `docs/security-model.md` carries the readership analysis, and the coordinator skill owns the precondition it names, which bounds what that seat lands rather than what you send.

Spell any path in that line repo-relative. The cap holds at any queue position, since the coordinator notice carries the line even where the last plan records no note. The peer-sessions skill states the same cap for its route, restated here because a leashed worker may never load that skill.

Waiting is the third stop shape, and it has two occasions. The first is a turn whose only remaining work is dispatched background subagents. Never hold the turn open on a foreground wait or dress the pause as a blocker. End it with `WAITING:` as the very first characters, naming the pending dispatch per the completion contract's dispatch row. Take the first-turn reading at the first wake at or after its window closes, per finishing-work's cadence paragraph. On the wake, evaluate the hallmark at the first re-block, before anything else with that dispatch.

The second is a park: a stop at the next safe boundary taken on a request, never on the run's own judgment. An operator-declared update window ordinarily produces one. The receiver acts on the request itself. The window's operator-initiated condition sits with the coordinator that declares it, the party that can establish it. A stop request from the operator, direct or relayed by the coordinator, is honored at the next safe boundary under the ordinary rules: the interim board entry where a section is mid-flight, the commit the recorded commit model directs, and the compaction checkpoint opened, or on an unleashed run the boundary declared with step 8's unleashed branch.

A leashed session leads its stop message, and every later turn it ends while parked, with `WAITING:`, since the armed leash pushes a bare turn back into the work. That line names the park and its ground only, never capacity in any form. Once every dispatch is finished or explicitly stopped, answer a relayed request with one line naming the parked state, as the turn's last act. The ground is the window the operator declared to this session directly, else the operator's own instruction, else the request itself, named as the request.

Where a dispatch's growth or first-turn window has already closed at parking time, run the hallmark check through its probe before writing that line. A synthetic-only pair, whose transcript holds no assistant line but the harness's placeholder for an API error, goes through its TaskStop instead. Both windows read from the dispatch record, the growth window in its elapsed-since-dispatch form. Finishing-work's unavailability rule owns both readings and their windows.

Where a dispatch's first-turn reading is still pending, hold the park, or that window closes with nobody looking. Until every first-turn reading is resolved, end turns on the dispatch occasion's `WAITING:` line, taking each reading at the first wake at or after its window closes. Probe a both-zero pair, and TaskStop a synthetic-only pair at the window's close, per finishing-work's reading of each pair. A turn ending on the dispatch occasion then re-dispatches and waits on the successor's own first-turn reading. A parking session instead stops the agent, records in the interim board entry what it was asked and that it never started, and leaves the re-dispatch to the resuming session. Park only on what survives.

Nothing in the kit wakes a parked session on a timer, save a parked coordinator seat's own reconciliation wake, whose conduct the coordinator skill states. The leash bounds a leashed park instead: the armed goal stays surfaced at session start and to the doctor, and the operator's typed `/kit-goal` in a new session recovers it.

A `WAITING:` stop keeps the leash armed, and a dispatch's completion notification re-invokes the session under it. BLOCKED's leading-prefix mechanics and capacity refusal apply to `WAITING:` too.

**The goal template.** A plan run's completion leash is armed in one line by the operator typing `/kit-goal docs/plans/<plan>.md` in an interactive session, and by nothing else. The kit-goal skill owns the canonical condition and the Stop hook that enforces it.

The leash's state is a file under `.kit/` and compaction keeps the session id, so an armed run rides its own compactions. A session the hook cannot tie to the bound one is a bystander and may stop. A run that finds no leash, or one bound to another session, never arms or re-arms one. It proceeds unleashed, the way a supervised persona runs its plans, kept moving by its supervisor, and takes the remedy step 0 of the section loop states. Any other session leaves the goal alone.

**A plan arriving mid-run is itself the trigger to take it on, once its standing holds.** The peer-sessions skill owns that gate, settled before the plan is taken on: the message's own standing, and the trace of a `## Dispatch Authorization` grant to the operator, which is mandatory and which no tool performs for you. A plan whose standing does not establish is held rather than taken on. One that holds is taken on and never armed, since only the operator's typed `/kit-goal` arms a leash.

Take it on at the earliest boundary this tree allows, and run it after everything the run already holds: the whole queue on a leashed run, since the Stop hook advances through it regardless, and the plan in flight otherwise. An unleashed run records it in its plan doc and runs it next. A leashed run asks the operator, in a reply opening with an `ASK:` line, to type `/kit-goal --append <inbound plan>`, since the bare form replaces the queue and drops the plans in flight. Until then it records the plan in the in-flight plan's doc. Where no append lands by the queue's end, the last leashed plan's close-out status names it as next to run. Each record goes in the interim board entry where no Chapter is being written this turn, else the Chapter.

A worktree is pinned to the commit it was cut from, so a plan committed later is unreachable from it, and the sender cannot see the gap. Where this tree predates the plan's commit, take the plan on at the next safe tree advance. Re-check the tree against the sender's named anchor at each boundary the run already takes, a section close or a pull it owes anyway.

Tell the sender which state the plan reached, in the reply vocabulary the peer-sessions skill owns. The handoff stays open until a reply arrives, and only the accepted acknowledgment converts it. A held plan goes to the plan doc in the same turn and the same place, naming what the hold waits on. An arriving plan is never a blocker or a reason to end the turn. Record it and continue into the next section.

**Handoff.** When execution begins in a conversation that was just brainstorming, say so in one line ("Spec approved, switching to autonomous execution of all N sections"), so I can scope it down.

## Before Starting or Resuming

Read the plan doc in full, **including all Chapters**, which are the state. After a compaction, before touching any file, re-invoke `executing-work` through the Skill tool, re-read the plan doc from disk, and re-load through ToolSearch any deferred tool schema the work ahead needs. A visible truncation notice inside a loaded skill or a tool result is the same trigger.

**Never stop to ask whether a plan handed to you was approved.** On an armed run the kit-goal skill's arming-is-approval rule answered it. A plan handed on the operator's own channel, or by a chain handoff inside the bounds the peer-sessions skill states, is approved as written, leash or none. A plan past those bounds holds for the operator's word. Set a `Status:` header reading anything but `In Progress` or `Complete` to `In Progress` on starting. Never flip `Complete`, which would overwrite a close-out's record: a run starting a plan marked finished takes the blocker set's contradiction path. The curating-docs skill's machine contract owns the `Status:` values. The header sits inside the approval fingerprint, so the run's first Chapter records any change, old value and new, to mark it deliberate rather than drift. A worker under an external engine (the stand-down below) leaves the header to its engine.

**Then run the intake gap check on the plan doc.** List what each section leaves unstated that its implementer needs. Route each gap after the memory recall below, which is one of its sources, and before its section is dispatched. A material gap, the spec-does-not-cover decision, is a `BLOCKED:` on an armed run and a decision ask on an attended one. A non-material gap, answered under route (a) from a cited source or under route (b) by a declared low-blast reversible default, goes on that section's Chapter `Assumptions:` line in brainstorming's declared-assumption format, dated today with `, section N` in the parenthetical. The dispatch brief carries the answer, not the gap. Never append it to the plan doc's `## Assumptions` section, which freezes at approval inside the fingerprint the external engine reads.

**Then run `memq recall`, once, before the first section.** It returns the whole memory store as one bounded digest, and the memory-system skill owns how to read and act on it. Carry forward what bears on the sections ahead. Re-run it on a resume and at a boundary taking that skill's hand walk, never trusting a recollection of an earlier pass. When a recalled record changes what you build, stamp it that turn with `memq touch <name> --applied`.

Run it from the project root, a worktree of it, or any directory inside the project. The memory-system skill's resolver rule (`skills/memory-system/SKILL.md` under the kit plugin root) says which store resolves. Two tells mean a different, empty store resolved: a `git worktree repair` note on stderr, and coverage lines all reading zero on a project you know has memories.

**External-engine stand-down.** Where a driving directive says an external engine owns continuation by spawning a fresh worker per section, or the environment carries `KIT_EXTERNAL_ENGINE`, run the section loop for the directed section only. The marker is a directive to you, binding as the directive's own words, not a mechanism. The **worker runs this skill**, orchestrating, dispatching implementers and writing Chapters as any session would. Being headless is no reason to absorb implementation inline.

**Workspace and siblings.** A worktree on a feature branch that concurrency put you in is your workspace, and finishing-work handles integration and teardown. Own a disjoint set of files from sibling sessions in the same repo, and never stage another session's uncommitted work or carry it in a commit of yours.

## Section Loop

Run each Section of Work in order. Sections run concurrently only where the disjoint-files rule in "Delegating to Subagents" permits.

0. **Close the previous boundary.** On a leashed run, clear any compaction checkpoint the last boundary left open, since work is resuming:

   ```
   node <plugin-root>/hooks/kit-compact-checkpoint.js clear
   ```

   Resolve `<plugin-root>` the same way the Dispatch Brief template's style-skill bullet does. Run the verb from the session's own shell, so it resolves the caller's session id. It is a no-op when nothing is open. It refuses at exit 1 over another session's boundary or a state it cannot read, and prints the remedy. The usual refusal is a resumption under a new session id against a goal still bound to its dead predecessor. That resumed run arms nothing for itself: it proceeds unleashed until the operator types `/kit-goal` with the whole queue in it, which rebinds the goal there, while any other session leaves the goal alone.

1. **Confirm the approach, then implement.** Where the spec assumed a section's mechanism without reading the code, first read the files it touches and confirm the approach holds. A file opened to find one mechanism takes the doctrine's rule on hunting in a large file. A file that is itself the mechanism is read whole. An outline usually means reading more than one of its ranges. Keep this read lightweight, never a fan-out. Where the real shape differs materially, adjust and note it in the Chapter. Raise it to me only if design intent changes. Then implement per the section's model tier: a section carrying a `Model:` tier goes to that tier's implementer. The doctrine's standing dispatch request covers this, even where a session-prompt line makes dispatch conditional on my request.

   **At each section open, grep the plan doc for its `Standing Brief Amendments` block and hold every entry as binding.** Step 4 writes to the block mid-run, so an earlier read is stale. A grep that finds nothing is still the read. On the dispatch path the entries ride into the brief, and an inline section has only the grep. The same open writes the add-decision line for the section as a whole to the scratch file step 4 names. Step 4 owns the line's five parts, and this one fires no stop.

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
       a choice, with either delta flagged in your report, which the Chapter
       then carries and the adversarial reviewer checks against the plan;
       else the test-worthiness call per the
       testing-discipline skill's litmus,
       its absolute path resolved by the same ladder as the Style-skill file
       paths bullet below, and what a test should lock
     - Sibling pattern to mirror, when one exists: name it AND require mirrored
       failure-mode breadth (catch scope, regex generality)
     - Error and delete semantics to preserve (throw vs truncate, hard vs soft
       delete, explicit NULL vs column default)
     - The standing hostile-boundary reuse step: before writing a call at a
       hostile boundary, grep the tree for its other callers and reuse a
       correct one's guard rather than matching its protections by hand. One
       grep, and no new capability. Spawning a process, building a child
       environment, sanitizing text bound for a trusted channel and clamping
       a bound are instances and not the boundary: the class is any call
       whose safety rests on what the far side is protected against. Where
       the guard's file sits in Files in scope, export the guard and call it.
       Where it does not, name that file, the guard, and the export it needs
       in the report and leave it unedited, for step 4's out-of-scope route.
       The guard at a boundary is a property of the channel rather than of
       the caller that first needed it, so a hand-written second caller
       drops the protections it cannot see and fails only on the input the
       guard was there for
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
       preferred where in reach, since a run exercises one branch. Document
       agreement never suffices, however many documents agree
     - The standing absence-check clause. It covers two classes, which
       fail differently and are reported differently, and the run's green
       alone reports neither. A check whose acceptance is a refusal (a pin
       asserting a guard denied a command with the reason it names, a test
       asserting the error path threw, a hook pin asserting a deny
       decision) is reported by naming, in words, which rule refused each
       case, since a green says something refused it while naming the rule
       says the thing meant refused it. Those are instances and not the
       boundary: the class is any check whose acceptance is a refusal,
       because a check that records only that something refused reports
       the same green whether the rule it was meant to exercise refused it
       or another rule refused it first. A check whose acceptance is an
       absence (a sweep expected to come back clean, a grep whose
       acceptance is empty output, a box-free readiness poll, a contention
       gate that reads clear, a pre-flight sweep) is reported by naming
       the predicate you ran, the scope you ran it over, and what it
       matched; where it matched nothing at all, that empty result stated
       against that predicate and that scope is the report, since there
       are no cases to attribute and a bare green is the one form this
       clause refuses. Those are instances and not the boundary: the class
       is any check whose acceptance is an absence, because a predicate
       narrower than the class it guards reports the same clear verdict
       whether the state it was meant to detect is absent or merely
       unnamed. A sweep's dispositions include the unchanged: a site the
       sweep found and left unchanged is reported with the rule that
       exempts it. A referring document, a call
       site, an archived copy are instances; the class is any site the
       sweep reached and the change did not touch. And what a control
       proves depends on what it was handed: one run against an instance
       the pattern's own literals already name proves the instrument
       functions and says nothing about its coverage, while one run
       against an instance withheld from those literals, matched on its
       shape rather than a string the pattern was handed, is coverage
       evidence too. A check whose subject is a class owes the coverage
       answer either way, so it states what would catch a member you did
       not name, a structural pattern over the class's shape where one
       exists; where the class can be neither enumerated nor shaped, the
       report is that the named members are swept and the class is not,
       never that the sweep is clean. Build the control under the
       `.kit/` scratch path. A control that must touch the tree under
       review is a tree-mutating probe and takes this skill's exclusivity
       rule for one, carried here because an agent holds no skills to
       resolve a pointer through: no other agent reading the tree while it
       runs, and a restore from copies taken before the first mutation
     - Workaround bar: a workaround needing a paragraph to justify means fix the
       code or escalate
     - When returning NEEDS_CONTEXT on a hard question, state it consult-shaped:
       the decision, the options you see, the evidence, and your lean
     - Style-skill file paths (agents inherit no skills): resolve the plugin
       root at brief-writing time by the ladder `kit-doctor/SKILL.md` uses.
       Take `CLAUDE_PLUGIN_ROOT` where the harness provides it, which a
       session's own shell does not see. Else take this skill's own base
       directory's grandparent. Write `<root>/skills/<name>/SKILL.md`, plus its
       references/ file where one exists, into the brief as an absolute path.
       A versioned cache path under a marketplace install is correct when
       resolved this session. Resolve fresh every time, and never write a
       resolved root into this bullet as a literal
     - Build + test commands
     - [any section whose work may spawn a suite, build, or embedding pass]
       The standing box-budget clause, beside the build and test commands
       because that is the spawn step. It is an act at the spawn rather than
       a preamble constraint, because a brief is minutes stale by its first
       spawn. Immediately before spawning any suite, build or embedding pass,
       poll the process list for a foreign test runner or build, whatever its
       engine, then wait on it or name the contention in the report. The rule
       is the doctrine's bullet whose lead reads "One heavy process at a time
       is a per-machine budget, not a per-directory one."
     - [section whose files in scope include a settings permissions block, a
       hook that emits an allow or deny decision, or any other surface that
       composes or widens a command grant] The two-question grant audit, copied
       verbatim from `<root>/agents/security-reviewer.md` (same resolution
       ladder as the style-skill paths above). A grant failing either screen
       is narrowed, or returned to the main thread with the reason, rather
       than written
     - [haiku only] The exact sibling to clone and the self-surfacing gate command;
       if either cannot be named, dispatch at sonnet
     - [below-fable session, fable tier] The explicit fable model override,
       passed only after step 1's capacity reading; the spec's tier
       assignment is the authorization
     ```

     Every dispatch includes every REQUIRED field, and each conditional field when its condition holds. An older spec may carry a legacy spend-authorization line in its header block (an expected Fable surface, a Fable-led-session marker, or a hold at the session model). That line is inert: read past it, note it in the first Chapter that touches the spec, and honor nothing it says. The orchestrator stays lean. Read no files beyond the approach-confirmation read above, and never re-implement the agent's work. Read its diff to verify and adjudicate it, never to redo it.
   - **Before any dispatch that passes a `fable` model override, take the capacity reading.** Run `node <plugin-root>/hooks/capacity-read.js`, resolving `<plugin-root>` as step 0 does, and act on the one line it prints. The line ends on one of three verdicts. `-> dispatch` proceeds unchanged. `-> ladder governs` proceeds under the never-started rules of finishing-work's unavailability rule. A run that prints no verdict line, whatever its exit code, reads as `-> ladder governs`. `-> downgrade` means the reader measured the fable tier exhausted for this dispatch. What follows depends on the site, because the compensation notch belongs to gate-shaped work and never to plan-following work. A reviewer, judge or consultant site goes straight to the effort table's compensation row, where finishing-work's ladder leaves that route open. The plan review waits for fable instead, per brainstorming's plan-review rule. A re-aim at fable where that ladder leaves the route closed ends ungated, as step 3's model rule states. An implementer site takes the stall raise to me that the escalation bullet below names. It neither pays the ladder first nor downgrades into a lower model. The raise's first line quotes the reader's line, since the leash refuses a first line that reads as a handoff. At every site, quote the reader's line verbatim in the dispatch record and the Chapter, so the downgrade reads as measured rather than as a discovered timeout. Take the reading immediately before each dispatch and never reuse it, because the machine's account rotator can change the active seat between any two dispatches.
   - **`Locus: inline` (or no tier recorded):** implement in the main thread at the session's own model. Inline is for sections the plan marked unbriefable or too small to brief. Dispatch a clearly briefable untiered section at the tier it would have earned. Read an older decorated `Model:` value (`fable (inline)`) as `Locus: inline` at that tier, and correct the line while in the file. Follow the csharp-style and sql-style skills and each one's precedence rule. Surgical changes only.
   - **Handle the implementer's status.** A NEEDS_CONTEXT whose add-decision line names a mechanism no Goal sentence, Intent clause or acceptance bullet names goes to step 4's design stop and its judge. A question the spec or the conversation answers is answered, and the section re-dispatched at the same tier. A genuinely hard one, the spec silent because nobody foresaw it, convenes a consult. The adopted ruling goes to the plan doc's `Standing Brief Amendments` block under step 4's adoption trigger, then into the re-dispatch brief. A preference fork that survives the ruling comes to me, ruling attached.
     - BLOCKED: fix the environment and re-dispatch.
     - DONE_WITH_CONCERNS: a material concern re-routes to NEEDS_CONTEXT handling. A "spec ambiguity you resolved" is a route (b) assumption for the Chapter's `Assumptions:` line, with the section number. Resolve a correctness or scope concern yourself, or put it to the adversarial-reviewer as a question. Never hand it over as a pre-rated finding, and never to the blind-reviewer, whose input contract excludes intent. Record a bare observation in the Chapter.
     - **A surface outside the section's Files in scope is never a bare observation.** Any report can name one, whatever its status, and answering the question settles nothing about the surface. It takes step 4's out-of-scope route.
   - **Tier escalation.** A `haiku`-tier section gets one round: a correctness-lens Critical or a second NEEDS_CONTEXT re-dispatches it at `implementer-sonnet` at once. From `sonnet` up, escalate after two failed review rounds or two NEEDS_CONTEXT returns on the same question. A round fails when a correctness lens in step 3's roster returns a Critical that survives adjudication. The failed attempt's report and the review findings ride in the escalated brief.
     - Before any bump off a second failed round, compare the two rounds' surviving correctness-lens Criticals and name the result in the Chapter. A repeating finding class means the implementer is missing something, so escalate. NEEDS_CONTEXT twice on the same question is a repeating class by definition, the intra-section form of step 4's recurrence rule. No repeat means the spec's premise is the generator, which a stronger implementer cannot fix. Spend no bump. Convene a consult on the premise with the claim under doubt and both rounds' findings, and bring me only the preference fork that survives it, ruling attached. Step 4's design stop is a different stop: it fires on one fix whose add-decision adds a mechanism no clause names, and goes to the judge.
     - In a Fable-led session, take the section over in the main thread. In a lower-model session, a section tiered below fable gets one re-dispatch to `implementer-fable` with the `fable` override, gated by the capacity reading. It moves to the main thread only if that also fails. A re-dispatch the reading measures as `-> downgrade` takes the stall raise instead. A fable-tier section is exhausted after its second failed review: raise the stall to me or hand it to a Fable-led session, never to a lower-model main thread. **An implementer never takes the reviewer's compensation notch.** A fable-tier section run lower keeps its pinned effort, and step 3's reviewer-effort rule says why. An environment that cannot run a section at fable has no Fable-led session either, so its exit is the stall raise, and such a run should budget for one.
     - A dispatch stopped on the wedge hallmark, or faulted synthetic-only, is an environment fault rather than a failed round. It counts against neither the two-failure ladder nor the third-dispatch bar. It gets one re-attempt, which for a synthetic-only fault is the same-model retry finishing-work's rule spends. Where that attempt also stops, in any shape, the section stops waiting on that tier and records the chain and each dispatch's shape in the Chapter.
     - Whether two stopped dispatches establish that this gate could not be run at this tier in this environment is finishing-work's question. A wedge bears on the tier its dispatch record requested, which for the never-started shape is the only reading there is. A fable-tier section then takes the stall raise. Any other tier escalates one tier with the wedge in the Chapter, and a section already at the strongest tier this session can reach raises the stall.
     - Never re-dispatch a third time at the same tier, and never downgrade a tier mid-effort. Record the escalation in the Chapter.
   - **Subagents neither commit nor stage.** Implementers leave unstaged edits under every commit model. You stage what you accept, and that explicit `git add <paths>` after review is the scope check. Before every commit, take the staged-list read the doctrine's Scope and safety rule states. Commits happen only in the main session, after review or at a first-green commit, and step 7 says which commit models allow the second.
   - **A quiet agent is a working agent, short of the wedge hallmark.** Transcripts go silent through long tool calls, so wait for the completion notification. Finishing-work's unavailability rule owns the hallmark, its observations and its windows. Load that rule at the section's first dispatch. It runs on a cadence from the first wake, and a rule loaded at suspicion arrives after the multi-hour wait it exists to end.
   - **The first-turn reading catches the never-started shape within minutes.** That shape is a dispatch holding both of the never-started reading's counts at zero. Take the reading at the first wake at or after the first-turn window closes, per finishing-work's rule. A dispatch carrying a model override takes it at that wake, whatever woke the session.
   - **Under an armed completion leash, this bullet chooses between the wait shapes the completion contract's dispatch row states.** They are the `WAITING:` turn end and the synchronous call. The synchronous call is wedge-blind: no probe can be sent or status read inside it, and a wedged call never returns. Take it only for a short single critical-path dispatch whose turn continuity is worth that price. Every other dispatch takes the `WAITING:` turn end, as does a dispatch carrying a model override, whatever its length. `TaskOutput` is read for status and never blocked on. A peer message, an operator redirect or a timer can wake the session without a completion. Take the reading the wake allows, answer what woke you, and end the turn again on `WAITING:`, naming the ids still pending. Never hold the turn open for a window to close, since that queues the next message behind it. Without a timer, a window is observed only at a chance wake, so a wedge there surfaces at session start.
   - **Stop first.** Never dispatch a second implementer at the same files on a suspicion of stalling. TaskStop an agent before replacing it. The same applies when a decision changes a brief mid-flight: the in-flight agent executes a contract the new brief invalidates, so kill it and re-dispatch with the corrected brief.

2. **Verify with evidence.** Run the build yourself and require it to pass, even when an implementer reported DONE. Run targeted tests, and a claim of "done" or "passing" carries the command output that proves it. Report every gate number with the state of the tree it was measured on, such as a clean worktree at sha X or the main checkout with N foreign dirty files. A gate number in a journal-layer artifact carries its moment in the form the moment-pin bullet of `skills/testing-discipline/SKILL.md` under the kit plugin root states. For delegated work, read the implementer's diff (`git diff`, since their work arrives unstaged) and spot-check the reported evidence rather than re-running everything. Re-run anything that looks off. A delta in that diff a guard should have refused takes step 3's incident path.

   **Hunt the fail-dangerous patterns specifically:** a delete-everything-not-in-this-set with no empty-set guard, a destructive loop under one outer try/catch, a hardening change that turns a benign path into a throw without auditing its callers. Hunt too the call-site bugs implementer code introduces that pass "no suites failed": a parameter name or type that does not match the callee, a silently changed error semantic (truncate instead of hard-fail), a hard-delete flipped to soft, an explicit NULL overriding a column default. Settle the test question per `skills/testing-discipline/SKILL.md` under the kit plugin root, whose litmus decides what earns a durable test: leave a durable test and show it passing, watching it fail first. If no test was warranted, say so and why. Use the temporary repro-script discipline from the global rules for debugging, never as the home for new behavior.

   **A tree-mutating probe is exclusive.** Run one only with no subagents in flight, awaiting or TaskStopping them first. Capture `git status --porcelain` and a copy of every file the probe will touch to the `.kit/` scratch path. Probe, restore from those copies, verify the restoration against the status capture, and only then dispatch. Never restore with `git checkout -- <file>`. It resets the file to HEAD rather than to the pre-probe worktree, and the section work in flight is unstaged, so checkout destroys the section with the probe. When the state under test is already committed, run the probe in a separate worktree, which needs no exclusivity.

3. **Review.** On round 1, dispatch two reviewers in parallel with each other, overlapping no run of yours. Step 2's targeted run has finished before this step opens, and under Branch-and-PR its first-green commit has already landed at step 7. Their fixes land in step 4, which runs the section's close gate after them, so the gate that closes the section covers what the round changed (the lanes and their moments are owned by the operating doctrine's gate bullet). The two are the `adversarial-reviewer` agent and the `blind-reviewer` agent. The adversarial-reviewer gets the spec path, the base git ref or changed-file list, the section name, and a REQUIRED `Amendments in effect:` line filled from the plan doc's `Standing Brief Amendments` block or explicitly `none`. When the section touched C# or T-SQL, it also gets the csharp-style or sql-style absolute paths, resolved by the Dispatch Brief template's style-skill ladder.

   Every sentence of the blind-reviewer's brief passes one test: would it read identically for every diff in this repository? So it gets the base git ref or changed-file list, never a captured diff. It never gets the spec path, the plan, the section name, or a line on what the change adds or where to focus. Omit docs/ paths from the changed-file list, since their hunks carry the intent story. The withheld items are the common leaks, not the rule. A brief that withholds every one of them and still says what the section was for has failed the test. The blind boilerplate carries one line telling the reviewer not to read under `.kit/`, since that scratch path sits inside the tree it greps.

   **A section carrying an `Audience:` line is a deliverable document, and the document pair is added to whatever the section's own content earns, never subtracted from it.** It replaces the code pair only where the section's changed files are all documents. Dispatch `blind-reader` once per persona the `Audience:` line names, carrying the document paths and its `Reader:` line only, under the same property test. Dispatch `prose-reviewer` once with the full Document Review Brief (template below). Where the section also changed code, the code pair reviews its non-document files in the same round.

   Where omitting the docs/ paths empties the list on a section with no `Audience:` line, skip the blind dispatch, run the adversarial-reviewer alone, and record `blind: no code diff` on the Chapter's review line. If the section touched input handling, authentication or authorization, SQL construction, secrets or configuration, shell or process execution, a command permission grant it composes or widens, a hook that emits an allow or deny decision, or an external boundary, also dispatch the `security-reviewer` agent alongside them. If the section's delta spawns a process, runs on a per-tool-call path, walks the tree, holds a lock, waits on another process, or queries a store, also dispatch the `performance-reviewer` agent alongside them.

   **The four code lenses run in two tiers, ranked adversarial, blind, performance, security.** The correctness tier is the adversarial-reviewer and the blind-reviewer. Its findings drive the fix round, the provenance read, the design stop and the round backstop at step 4. The advisory tier is the performance-reviewer and the security-reviewer. Its Criticals and Majors take step 4's advisory disposition and carry no automatic route. Tier is keyed on the lens and never on the finding. So an adversarial finding about an injection is a correctness finding, rated on that charter's own ladder and routed on its provenance, while a security-lens finding about the same line is advisory. Both advisory lenses ride round 1's roster where their triggers above hold, ride a re-raised round on the same triggers, and join no decayed round.

   **The `Amendments in effect:` line is sighted-only.** Every sighted dispatch in the round carries it: the security-reviewer's and the performance-reviewer's as the adversarial-reviewer's does, and the prose-reviewer's as a Document Review Brief field. It never reaches the blind-reviewer or the blind-reader.

   **The adversarial lens, the security lens, the performance lens and the scope adjudicator carry a `Trace target:` line, and no other dispatch does.** The line names the spec's Goal, its `## Intent` record where the plan carries one, and its acceptance bullets as amended by any `Standing Brief Amendments` entry. Where an amendment moved a bullet, quote the target into the dispatch, since a by-path read returns the unamended bullets. The relevance shape is the one exception, and it narrows: that brief carries the Goal, the `## Intent` record and only the acceptance bullet a performance finding quotes, since the adjudicator's charter refuses the bullet set. The prose-reviewer's Document Review Brief carries the spec path and no `Trace target:` line, since the document pair sits outside the provenance read. The scope adjudicator carries the trace target and never the `Amendments in effect:` line, whose contents its charter refuses.

   **No run of this session's is in flight during the round, so any contention left is somebody else's.** A reviewer that builds or runs anything blocks while another process holds the repo's one shared resource. Answer the predicate before dispatching: does this repo have exactly one such resource, and is anything holding it, a sibling session's suite or build among them? Where both hold, carry the Dispatch Brief's workspace-constraint line into every reviewer brief, naming the process holding the resource and the operations it puts off-limits.

   **A section's first review round runs every reviewer one tier up from the section's writer tier, Fable the ceiling.** Every later round runs one lens at the writer's tier. Round 1 is the full roster: the code pair, the document pair, or both where the Audience rule above summons both, plus each advisory lens whose trigger holds. Over a cheap-tier writer, an advisory lens's Fable coverage is finishing-work's advisory pass over the whole changeset. A later round is one dispatch carrying what its round 1 brief carried: the adversarial-reviewer where the fix delta touched anything but a deliverable document the Audience rule names, the prose-reviewer where it touched those alone.

   A Critical from a correctness lens that survives adjudication re-raises the next round to round 1's roster and tier, the tier re-read against the writer tier in force when the re-raised round dispatches. Such a Critical from any later round, a re-raised round included, does the same. A re-raised round that returns no such Critical hands the next round back to one lens. A re-raised round takes round 1's rows below. After a tier escalation the escalated tier is the writer tier. A later round over a haiku writer runs at sonnet, the reviewer floor.

   An inline section's writer tier is the session's model, which built it, and an untiered section takes whatever tier built it. The reviewer's tier rides as the model override on every dispatch, named explicitly on the Workflow route whatever the session model, and a `fable` override takes step 1's capacity reading first. The one inheriting case is a Fable reviewer on a Fable-led session, which passes no override and so takes no capacity reading. A first-aim gate that could not be run at its fable tier here is confirmed per finishing-work's unavailability rule or measured by step 1's capacity reading, compensated per the effort table below, and recorded. A per-section reviewer below Fable whose tier could not run, confirmed per the same rule, re-aims one tier up at `high` through `Workflow`, one dispatch at a time, each with the ladder's one retry, Fable the ceiling. A re-aim is no compensation dispatch, as finishing-work's ladder says. A chain whose re-aim at fable is itself ruled out ends that dispatch's gate ungated. A re-aim and an ungated end go on the Chapter's review line in the template's form, as neither pass nor failure for step 1's escalation ladder, and so does the document pair with its readers count.

   **Never pre-judge the review:** do not tell a reviewer what to flag, what to ignore, or how to rate a finding ("treat as Minor", "the plan chose this"). Let each reviewer surface it and adjudicate per responding-to-review. **A repo-wide defect class is neither pre-judging nor contamination.** The test is the blind-reviewer's own: would the sentence read identically for every diff in this repository? A standing property passes and may ride in any dispatch, the blind one included. A sentence that would change with the section is barred from the blind dispatch, and barred everywhere as pre-judging when it carries a rating.

   **Bracket every round with a tree-state capture.** Run `git status --porcelain` before you dispatch and again when the round returns, and compare the two before acting on a single finding. Porcelain lines are name-level only, so neither of the two non-incident classes below is established from them alone. A delta in a concurrent section's declared files is staggered progress only while a live dispatch for that section covers those files. Check that against the live dispatches you track, which the interim board entry records with what each was asked, where one has been written. A delta in a declared file no live dispatch covers is an incident, since a guard-escaping write there would otherwise wear the sibling's name.

   A delta this session made is not an incident either. Those are the writes steps 4 through 8 and the interim-board ritual direct mid-round. Establish authorship by reading the delta's content and recognizing it as yours, never by recognizing the path. An agent's write to the plan doc produces the same porcelain line as your own append, so content you do not recognize in a file you also write takes the incident path.

   Any other delta is an incident: restore the tree, record the delta and the agent that produced it in the Chapter, treat that agent's findings as suspect pending a re-review against the restored tree, and jot a kaizen note. For a genuinely trivial, self-contained section (a rename, a comment, a one-line change with no logic), the per-section reviews are optional as a pair, since finishing-work still covers it.

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

   **Reviewer effort.** The model rule above sets each reviewer's model, and this table sets its effort and route for every reviewer dispatch in the round, the advisory lenses included. Every fable dispatch takes step 1's capacity reading first. Answer the route question first: whether the reviewer is Fable decides between the Agent tool and `Workflow`, and only then does the lens set the effort.

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

   A Fable reviewer carries its agent's frontmatter effort, so its round rides the Agent tool. That effort is set by lens: `low` for the blind, adversarial and prose lenses, `medium` for the security and performance lenses, and `high` for the scope adjudicator. The adjudicator's `high` is its charter's own pin and never a compensation notch. A reviewer below Fable runs at `high` in every lens. A frontmatter effort is one value per agent whatever model runs it, so only the per-call route lifts Sonnet and Opus without lifting Fable. The finishing pass reads the whole changeset for cohesion, so `high`. That row and the compensation row are finishing-work's to specify.

   The compensation row serves only a Fable gate that could not run here or that step 1's capacity reading measured exhausted, reached through the unavailability rule or a `-> downgrade` from that reading. A below-Fable reviewer ruled out takes the re-aim row instead. Unavailability is confirmed and recorded per finishing-work's unavailability rule, which owns its triggers. Every per-section row keys on the model rule's writer tier, the re-aim row on the tier ruled out, and the scope adjudicator's row on neither, since that seat is not a per-section reviewer and its tier is its charter's. The rule never produces Fable at `max`, and a below-Fable reviewer's `high` never climbs there.

   **Dispatching a reviewer above its frontmatter default.** On v2.1.205 the Agent tool takes a model override but has no effort parameter. So any dispatch whose row names an effort other than the frontmatter default goes through `Workflow`'s `agent()` instead. Every such call fills this template:

   ```
   Reviewer Dispatch (all REQUIRED):
   - agentType: the agent's scoped name (claude-kit:adversarial-reviewer,
     claude-kit:blind-reviewer, claude-kit:blind-reader, claude-kit:prose-reviewer,
     claude-kit:security-reviewer, claude-kit:performance-reviewer,
     claude-kit:consultant, claude-kit:plan-reviewer, claude-kit:scope-adjudicator).
     Omitting it yields a workflow-subagent, a type readonly-agent-guard does not
     govern, which hands the tree under review to an agent free to rewrite it
   - model: named explicitly, never left to inherit. A call carrying an effort but no
     model runs the session's model at that effort, which on a below-fable session is
     a weak model at maximum effort: the downgrade this rule exists to prevent
   - effort: named explicitly, never left to inherit. An unnamed effort resolves
     to no dependable default
   ```

   A dispatch on this route carries the `Amendments in effect:` and `Trace target:` lines the rules above give it, beside the template rather than in it.

   The doctrine's standing-dispatch bullet carries the operator's request for this route, so it needs no per-session ask. This skill states the mechanics, never the authorization. The round stays one round: mixed Agent-tool and Workflow dispatches go out together under the single tree-state capture, and a Workflow round is awaited by the `WAITING:` turn end exactly as an Agent-tool dispatch is, its completion being a wake. Every input contract above still binds on this route. A script assembling several dispatches authors each blind prompt as its own literal: the blind boilerplate plus its contract inputs (the base ref or changed-file list, or the document paths and `Reader:` line) and nothing else. That literal shares no brief-building constant, helper, or template variable with any sighted dispatch. The property test judges the assembled string each agent will actually receive, never the ingredient list.

   Where the Workflow route is unavailable in a session, the dispatch and any re-aim of it take the Agent tool at the row's own model override and the agent's frontmatter effort. That model is sonnet or opus below Fable, fable for the finishing reviews, and opus for compensation per finishing-work's bare fallback. The Chapter records the review as run at reduced effort against its row's effort.

   **The compensation notch belongs to gate-shaped work and never to plan-following work**, and this is the ground for the rule step 1 states. Compensation belongs to the gate with no backstop, so it reaches the consultant and the scope adjudicator and never an implementer: a shallow ruling there steers the section with nothing downstream re-asking the question. A below-Fable reviewer's `high`, first-aim or re-aimed, is the rule's own level rather than this notch.

4. **Address findings.** These routes are the correctness tier's, the adversarial and blind lenses'. An advisory lens's Critical or Major takes the advisory paragraph below instead. A Major is read for its provenance first, per the paragraph below. Then it is fixed, bucketed, or recorded in the Chapter with why it is not fixed. A Minor is read at adjudication and upgraded only on a stated consequence. Otherwise it goes on the section's Minor list, fixed in one pass at section close. Claim findings take the split the terminal condition below states, and the accumulating ones join this list. A Minor outside the section's scope takes the out-of-scope route below.

   The Minor list is `.kit/scratch/<plan-slug>/minors-section-<n>.md`. Create it at the section's first Minor with the file tool, never on a command line. It holds one line per Minor as the lens printed it, prefixed with the round number. The close pass reads it, and nothing deletes it, since `.kit/` is gitignored scratch.

   The close pass runs after the terminal condition below is met and before the close gate, and no review round follows it. A Minor whose fix would meet the fix-delta bar below, by either trigger or its judgment clause, is left with the reason. So the pass never owes a round. Its delta takes step 5's below-bar author re-read, recorded in the Chapter as an author re-read rather than a round.

   **An advisory lens's Critical or Major is weighed and dispositioned, never routed.** This paragraph is the whole route for a performance-reviewer or security-reviewer finding. Each Critical and Major an advisory lens returns gets one line in the section's advisory list, `.kit/scratch/<plan-slug>/advisory-section-<n>.md`, kept as the Minor list is. The line carries the finding as printed and one disposition with its reason: fix now, defer (naming the backlog entry), or refuse (why it does not apply to this project's stated requirements and deployment). A fix-now fix joins the fix round the correctness findings open. With none open, a fix meeting the fix-delta bar below opens its own round before the terminal condition is read, and a fix below the bar joins the close pass. A fix-now lean takes one relevance ruling from the `scope-adjudicator` before the fix is written: does this finding apply to this project's stated requirements and deployment? A refuse or a defer of a Major or an uncited Critical needs no ruling. The seat is dispatched as the held-finding paragraph below dispatches it, on the fixed relevance brief its charter states. That brief carries the finding verbatim, the plan's `## Goal` and `## Intent` record, and one item by lens. For a security finding it is the finding's `threat:` field and the project's `## Threat model` section, or the line `threat model: absent`. For a performance finding it is the requirement the finding names, quoted from the plan or stated as assumed, and the acceptance bullet it quotes where it quotes one. Nothing else rides. The ruling returns `CONFIRM`, `REFUSE` or `ASK`. The orchestrator adopts it rather than re-deriving it, and checks on its own surface that its `GROUNDS` names a positive ground rather than a bare absence, as the design-stop paragraph below checks a bucket's. On this shape that ground may be a quoted sentence of the project's `## Threat model` section. Where the model is absent it may be the deployment sentence the Intent record and the Goal state. A residual `ASK` passes by naming the sentences it read and what none of them settled. The one blocking case is a security Critical carrying a `threat:` citation, `threat: absent` counting as one. It takes the ruling whatever the lean, since the citation is a claim about this project. Where the ruling confirms a cited security Critical, the finding takes a correctness Critical's route: fixed before the section closes or raised to me, and never frozen by the round backstop below. Where the ruling refuses, the finding is dispositioned refuse on the judge's ground. A security Critical carrying no citation is read as an advisory Major. An `ASK` on a Major or an uncited Critical dispositions it defer, with the judge's recommendation as the backlog entry's reason. An `ASK` on a cited Critical takes the raise branch, as an item under the plan's `## Operator Verification` rather than a BLOCKED hold. A security-lens finding that a security document or a security-boundary comment states something the code does not do takes fix now, or a Chapter line naming the sentence and why the finding fails. It never takes defer, since a false sentence left standing breaks the doctrine's nothing-untrue-ships rule. The claim-class region below binds the two correctness lenses alone, so a security-lens finding on any surface, a published contract included, is advisory by lens. A fix-now advisory fix still takes the add-decision line and the design stop below, because the two rulings ask different questions. Relevance asks whether the finding applies here, and a confirmed finding says nothing about whether a guard no clause names is the right fix. Where that stop rules on a confirmed cited Critical's fix, a negative-half refuse or an ask takes the raise branch rather than justified-not-fixed. That Critical never closes unfixed and unraised. An advisory finding on its own never opens a round, enters the provenance read, or fires the design stop or the round backstop. A fix round its fix's delta owes counts toward the backstop like any fix round, since the orchestrator opened it. An advisory copy of a defect a correctness lens also reported is dispositioned as covered by that finding. An advisory Minor joins the Minor list. The Chapter's `Metrics:` line carries the tally, `advisory: <v> findings, <w> fixed, <d> deferred, <e> refused`, beside the provenance tokens, which count correctness findings only.

   <!-- KIT-CLAIM-CLASS:BEGIN -->
   A behavior finding states a failure scenario: an input or a state where the code does the wrong thing on a reachable path, or a test exercises the wrong thing. Its fix changes what runs or what a test exercises. A claim finding states none, no input the sentence names failing today. Its fix changes a sentence and nothing that runs: a comment, a header, a docstring, a test's because-string or title, a test instrument's stated reach.

   One exception holds a claim finding to a behavior finding's bar. It is a claim on a published contract surface: a README, a skill, a charter, a document under `docs/`. It is owed in two cases. One is a sentence in the section's own delta contradicting an acceptance bullet, a Goal sentence or an Intent clause of the `Trace target:`, which the finding's `trace:` quotes, the orchestrator making that trace for the blind lens as the provenance paragraph has it do. The other is a pointer that delta left aimed at nothing, wherever it sits. Every other claim there rates as a claim finding. A claim finding whose trace names no such clause rates Minor whatever severity it arrived with, and the adjudication downgrade is recorded on the Chapter's Minors line as an upgrade is.
   <!-- KIT-CLAIM-CLASS:END -->

   **A Major enters a fix round on its provenance, never on its severity alone.** Provenance is read at adjudication, before any fix exists, from the finding's trace and the diff, never from the repair. It takes one of three values, exclusive by precedence. A finding tracing to no acceptance bullet, no Goal sentence and no Intent clause is new-requirement, wherever its lines sit. A traced finding in lines a fix round of this section wrote is fix-introduced. Every other traced finding is spec-traceable. One subject is exempt from new-requirement whatever its trace. A Major reporting that the delta built what the plan's `## Out of Scope` list keeps out, what the Intent record says done need not do, or an alternative that record refused, or that it contradicts a recorded decision, is spec-traceable. It asks for a removal the plan already ordered.

   Fix-introduced needs a per-round record, since under two of the three commit models nothing this section wrote is committed yet. So capture the section's delta when each review round returns, before its adjudication and any fix round it owes, with `git diff <base> -- <the section's Files in scope> ':(exclude)docs/plans/**' ':(exclude)docs/archive/**' ':(exclude)kaizen/**' > .kit/scratch/<plan-slug>/<section>/fix-round-<n>.diff`. That command lists tracked paths only. So append each in-scope path absent from the index, as `git ls-files --error-unmatch <path>` failing establishes, with `git diff --no-index -- /dev/null <path> >> <capture>`, one call per path. Run it from the repository root with the path repo-relative and carrying no `..` segment, since `--no-index` reads any path it is handed, outside the worktree included. Skip a path under the three excluded roots, since `--no-index` honors no exclusion pathspec. The call exits 1 whether or not it read the file, so its exit code is no reading. The reading is that the capture grew, and an append that grew nothing names a path the section did not create as spelled. Never use `git add -N <path>` instead. It puts the path in the index, which the staged-list read reads and the subagents-neither-stage rule keeps empty until the scope check.

   Capture n is taken at review round n's return, so one capture alone is the delta as that round found it. Round n's fix lines are what capture n+1 holds and capture n does not, and that difference is the fix-introduced read. A judge's brief names the latest capture alone, read whole for the finding's lines. Keep the project's `.gitignore` covering `.kit/`, per the Delegating section's rule, or the capture is a tracked file carrying the fix narrative into the next commit.

   The adversarial, security and performance lenses get the spec path and carry a `trace:` field on every Critical and Major. The blind lens gets no spec by design, so the orchestrator traces its Criticals and Majors at adjudication, and the Chapter records that trace as orchestrator-made. A `trace: unsupplied`, returned only by a lens dispatched with no spec path, is no trace rather than a trace of none. The orchestrator traces that finding the same way and records it as orchestrator-made. The reader and prose lenses' comprehension and prose findings sit outside the provenance read, so no trace is asked of them or made for them.

   A trace is a reviewer's assertion, so check it both ways. Before reading provenance off a cited bullet, Goal sentence or Intent clause, confirm it exists in the `Trace target:` and covers the finding's subject. Existence alone passes any real bullet quoted at an unasked mechanism. Before holding anything on a `trace: none`, re-trace it against that target, or a missed bullet costs a hold, a judge and a ruling on asked-for work. Either re-trace is recorded as orchestrator-made.

   A Critical from a correctness lens governs ahead of all of this. It keeps the route the out-of-scope route below gives it: fixed before the section closes or raised to me. Its provenance is read for the Metrics line alone, so it is never held and never bucketed. A spec-traceable or fix-introduced Major takes the add-decision below, then the fix round. A new-requirement Major never enters one. It is held, and the section continues on every other finding.

   The held finding goes to a judge. That is the repo's live Expert seat where the `ListAgents` roster the peer-sessions skill owns shows one, reached through the completion contract's expert-ask paragraph above. Otherwise it is the `scope-adjudicator`, dispatched through the Agent tool with the fable model override after step 1's capacity reading, at its charter's frontmatter effort. It goes through `Workflow` only as the compensation route above directs, where its fable tier could not be run. Its fixed brief's contents and forbidden inputs are the charter's to state. The brief carries no `Amendments in effect:` line, since that block holds rulings the charter refuses. So an amendment that moved the acceptance bullets reaches the judge by refreshing the what its brief quotes, the plan's what being its Goal, its `## Intent` record, its acceptance bullets and its `## Out of Scope` list.

   The asker adopts a bucket as a ruling and records it, never re-deriving the scope call, since the question is scope rather than fact. What it checks on its own surface is the ruling's `GROUNDS`, for a positive ground rather than an absence. A refusal resting only on the missing bullet quotes back the fact that sent the finding to the judge, and would pass every time. So a refuse names the Goal reading, the Intent clause or the `## Out of Scope` entry that keeps the finding out, and the check confirms that entry exists and reaches this finding. For that, the check reads the plan's `## Out of Scope` list beside the `Trace target:`. An accept-and-declare names the Goal sentence or Intent clause it serves and the bound it stays inside. The check confirms that sentence or clause exists and that the declared work adds no mechanism the trace target does not already carry. Wherever a bullet is quoted, the check confirms it exists in the target and covers the finding's subject.

   This paragraph widens the expert paragraph's bound. There an answer is a lead the asker verifies, and it may never suppress an escalation. Here a refuse does suppress one, on the operator's recorded decision that a scope call is a ruling to adopt rather than a fact to re-derive. The `GROUNDS` check is all that adoption rests on. So a ruling whose `GROUNDS` fails the check is a lead rather than a ruling, and the finding falls to the adjudicator as an unanswered ask does.

   A `NEEDS_CONTEXT` return from the adjudicator is a brief defect, not a ruling. Correct what the charter names missing or forbidden, and re-dispatch once before the close gate, as the first dispatch ran. A second `NEEDS_CONTEXT` takes the ask bucket's route to me with both returns in the brief. Its first line is fixed, `BLOCKED: section <n> holds a new-requirement Major; the judge returned NEEDS_CONTEXT twice`, since the bucket literal names a recommendation the judge never made. The Chapter records the ruling with the seat that gave it.

   The expert paragraph states no answer window, so this one does. An ask still unanswered when the section's other work is ready for the close gate falls to the adjudicator, dispatched then and before that gate runs. No section closes with a finding still held. A seat's answer arriving after that dispatch is late, and the adjudicator's ruling stands, recorded with the late answer beside it. Record a held finding on the Chapter's `Review Findings:` field with what it waits on, since a hold kept only in context dies at the next compaction.

   The judge returns one of three buckets, a set closed at three: refuse, accept-and-declare, and ask. A finding meeting neither of the first two tests is an ask.

   Refuse is for a finding off the goal path the Goal, the `## Intent` record and the acceptance bullets draw, or inside what the plan excludes: its `## Out of Scope` list, what the Intent record says done need not do, or an alternative that record refused. It is recorded in the plan doc's `Standing Brief Amendments` block as its ground, never its verdict. The ground is the Goal reading, the Intent clause or the `## Out of Scope` entry, written as a rule the next round judges against and never as a finding named and rated refused. That block rides on every sighted `Amendments in effect:` line, where a named disposition would be the pre-judging step 3 bars. A refusal moves no bullet, so it refreshes no quoted what.

   Accept-and-declare is for a finding that serves the Goal, is bounded and adds no new mechanism. It re-enters as spec-traceable, so it takes a fix round and the close gate like any other. Its one home is the same `Standing Brief Amendments` block, written at adoption, since step 3 rebuilds the `Trace target:` from that block. It is one appended acceptance bullet stating the declared behaviour and nothing else, carrying no lens, round, seat, bucket or ruling provenance. That block is quoted into a later judge's trace target, and a bullet carrying its ruling's history hands that judge a prior ruling its charter refuses. The Chapter's approval-drift line and the next board recap record the adoption, and neither is a second home.

   Ask is for a new mechanism, a changed recorded decision, a reopened accepted risk or section-sized work. It goes to me on the BLOCKED path with the judge's recommendation folded into the brief's own. Its first line is fixed rather than composed: `BLOCKED: section <n> holds a new-requirement Major; the judge recommends an ask`. Where the review-round backstop below fires on the same adjudication, its line leads and carries this ask in its body, on that paragraph's precedence rule. The finding, the recommendation and the evidence ride in the body, under the public-board cap that path carries. An ask disposes of nothing. It holds the section at this step: the section does not close and steps 5 through 8 do not run until the answer arrives, and that answer closes the section rather than the round.

   **Every Major entering a fix round gets one line before anything is built, and so does every section at its open.** That line is the add-decision, written to `.kit/scratch/<plan-slug>/add-decisions-section-<n>.md` and kept as the Minor list is. It names five things: what the fix changes; the Goal sentence, Intent clause or acceptance bullet it serves; whether it adds a mechanism; its size as a number where one exists, lines, branches or states for code and bytes for prose; and what not building it costs. A mechanism is a unit of behavior that runs and that no such clause names. A fallback, a retry, a special case and a guard are instances, not the boundary. A renamed identifier, a moved line or a changed message is not one, since nothing new runs.

   The line step 1 writes at a section's open fires no stop. A mechanism no clause names there is an intake gap, routed under the intake gap check. A line an implementer's report carries mid-work is appended when the orchestrator adjudicates that report. On an inline section the orchestrator writes both lines and takes the stop itself on a mid-work line naming an unnamed mechanism. A Critical from a correctness lens takes no line at all, since it cannot fire this stop and is fixed before the close.

   **A fix whose add-decision adds a mechanism no clause names is a design stop, not a fix round.** The trigger is that line, never severity, provenance or a round count. The stop fires at the adjudication that wrote the line, before the fix round opens and before anything is built.

   It asks whether the proposed mechanism should exist, and if so, what its design is. That is on the consult skill's trigger floor, a premise question answered on fresh context before the repair is written. The judge the paragraph above names convenes rather than the `consultant`, because that judge must never receive the querent's lean. The design half is answered in the bucket, since the judge rules on scope rather than design.

   The brief is the `scope-adjudicator` charter's fixed one. For this shape it carries the add-decision line's first four parts, the finding verbatim, and the latest capture as the state of the tree. It never carries the line's cost clause or the account of a round. Where an implementer's report raised the stop, that report's line stands in for the finding, and the capture is taken at that adjudication and named `add-decision.diff`. The paragraph above's one re-dispatch, double-`NEEDS_CONTEXT` exit and `GROUNDS` check apply whole. On this shape a refuse names the clause the finding traced to, or the one the add-decision line says it would serve, and the form that clause asks for. The check confirms that the proposed mechanism departs from that form. It does not confirm the clause exists, which is already settled and would pass every time. An `## Out of Scope` ground passes as the paragraph above states. The inherited exit's BLOCKED takes this shape's own first line, `BLOCKED: section <n> hit a design stop; the judge returned NEEDS_CONTEXT twice`, since the judge recommended nothing there.

   The section continues on every finding the proposed mechanism does not touch. The answer window is the paragraph above's. Where no other finding is in flight, the window is zero and the adjudicator is dispatched at once.

   The same three buckets return. A refuse is recorded as the paragraph above records one. On a Goal-reading or form ground the fix is still owed, written within the form the named clause asks for, with the add-decision line rewritten to say so before that round opens. On a negative-half ground, the `## Out of Scope` entry or the Intent clause that keeps the thing out, no fix is written and the Major is justified-not-fixed on the quoted ground. A declare here moves no bullet, since the charter returns it only where the bullets already asked for the mechanism. Its record is the Chapter's `Review Findings:` field, naming the mechanism, the bucket and the seat, and the next board recap. The fix then enters the round it was held out of, as proposed. On the implementer-raised shape, with no finding or fix round, the ruling rides into the re-dispatch brief and the section resumes at step 1's re-dispatch. There a form ground names the form the work is written within, a negative-half ground bars the mechanism, and a declare releases it. An ask holds the section at this step and goes to me on the BLOCKED path under the first line `BLOCKED: section <n> hit a design stop; the judge recommends an ask`. Where the review-round backstop below fires on the same adjudication, its line leads and carries this ask in its body.

   Step 1's tier-escalation ladder keys on surviving Criticals and this stop on the add-decision, so neither stands in for the other. Where both fire on one round both run, and the escalated brief marks the held mechanism off-limits until the ruling lands. On the ladder's main-thread branch, which has no brief, the orchestrator holds it off-limits itself. The ladder's premise consult, its exit where no Critical class repeats, carries the querent's lean this judge must never receive. So on a round firing both, this stop convenes first and that consult waits on the ruling, as the second-reversal consult below does.

   Where the reversing Major's own fix fired this stop, the loop-end paragraph's second reversal meets it. This stop then convenes first, and no consultant is dispatched on the reversal before its ruling. A refuse moots the reversal, the fix being rewritten within the clause's form. A declare sends the fix into its round, with the loop-end consult run before that round. An ask takes the completion contract's pre-BLOCKED consult.

   **The fifth review round is the operator's backstop.** A section whose adjudication after five review rounds still leaves the terminal condition below unmet stops on the BLOCKED path, rather than opening the fix round that adjudication owed. Where the round's only owed work is a fix that would owe no further round, under the fix-delta bar's prose-only clause or its below-bar judgment, the section takes the fix and closes. Where that fix, once written, owes a round after all, the exemption lapses. The round is taken and counted, and its adjudication meets this bound one count higher.

   The count is of rounds, a round being step 1's tier-escalation bullet's: the roster step 3's round rule dispatched, advisory lenses included, a round the fix-delta bar owed among them. A round counts once its roster returns. A lens re-dispatched after the wedge hallmark completes its own set rather than opening another. The ladder's two numbers each have one carrier, which `test/review-loop-provenance.test.js` holds single across the skill tree: this stop's lead ordinal, and the backticked word in the restart paragraph.

   The stop is a decision ask, never a kill. It ends no dispatch, discards no work and closes nothing. The stopping round's fixes stay unrun until I answer, save the two classes below. The count restarts at my answer, or, where an ask bucket's declaration rode with this one, at the answer that settles both.

   A continue past the opening bound buys the section `three` further rounds. From the third of those on, each adjudication leaving the terminal condition unmet declares again. The interim board entry named below carries the ladder's stage and the restarted count at every firing, so a section resuming after a re-arm reads them there. The stop never fires on a round whose adjudication met the terminal condition. It puts no ceiling on the rounds beneath it, which the terminal condition alone ends.

   Two classes never freeze with the rest: a Critical from a correctness lens, and the cited Critical the advisory disposition paragraph above sends here once the relevance ruling confirms it. Each keeps the out-of-scope route's fix-before-close rule. Since this stop closes no section, such a finding is fixed before the declaration goes out, or raised unfixed where its fix needs the answer this stop waits on. A round that fix's delta owes under the fix-delta bar is named owed-and-unrun and taken first on the re-arm. A fix a design stop's refuse sent back is named the same way.

   An owed round left unrun is written to the plan doc with its reason before the declaration goes out, never to the body alone. The Stop hook records only the first line and appends nothing to the doc, and the section resumes from the doc. The record is an interim board entry, not the Chapter's `Review Findings:` field, since the Chapter does not exist until step 6. A Chapter written early carries a `Completed:` line that registers the section complete to the external engine. So the entry takes the closure-drought ritual's shape: appended below `## Chapters`, with no `Completed:` line. If the section later closes, its Chapter's `Review Findings:` field carries the same record.

   The stop is a member of the completion contract's closed blocker set, a material decision the spec does not cover: whether the mechanism under repair should continue. So the pre-BLOCKED expert ask and consult both run. A design stop that already ruled in this section on the mechanism the phase analysis names stands as that consult, and no second one is dispatched. That is this step's only substitution. A judge that ruled on another mechanism, or returned NEEDS_CONTEXT twice, leaves the consult owed. Without such a ruling, the completion contract's consult runs. An ask bucket keeps its own consult, and no other ruling here, a new-requirement Major's bucket included, stands in for it.

   Where one adjudication fires this stop and the design stop, the design stop convenes first and this declaration waits on its ruling, which then serves as its consult. A consultant dispatched beside a judge still out on the same mechanism would hand it the querent's lean, so none is.

   The wait has a closing edge, since this stop reaches no close gate for the provenance paragraph's window. One window rule covers every hold this stop carries. This stop freezes the round's fixes, so the window is zero. The live seat's ask still goes out under the never-gates rule. The adjudicator is dispatched at once, before the declaration, and its ruling is the consult in force. A later seat answer is recorded beside it. Where an adjudicator is already in flight on the same mechanism, the window is that dispatch's return instead. A new-requirement Major still held takes the same window: its adjudicator is dispatched first, and its ruling rides in the declaration's body.

   Where one adjudication also fires step 1's tier-escalation ladder, the order reverses. The ladder's remedy is a fix round, which this stop declines to open. So the declaration goes out, naming the escalation as owed in its body, and my answer releases the escalated re-dispatch. Neither count moves while the section waits, since a round nobody ran is a round no ladder counts.

   The declaration's first line is fixed: `BLOCKED: section <n> hit the review-round backstop; phase analysis attached`, `<n>` being the section's number and nothing more. It sits inside the public-board cap the completion contract's first-line paragraph sets. Where an ask bucket's declaration is owed on the same adjudication, this line leads and the ask rides in the body, since the Stop hook releases on one leading line.

   The body is the phase analysis, in the client-briefing register. It groups the rounds by what generated each: the spec, a fix delta, or a reviewer's new requirement. It names each round's Majors with their provenance counts and which were fix-introduced. It closes with the orchestrator's read of any cause the kit's rules missed that the grouping shows. Before declaring, log `memq log kit.review.cap fail "<plan slug> section <n>: <rounds> rounds"`, the slug being the plan file's stem rather than a path. Under `--detail` go the provenance totals alone, within the memory-system skill's caps. Finishing-work's pass form uses `BLOCKED: the finishing pass hit the review-round backstop; phase analysis attached` and the summary `"<plan slug>: <rounds> rounds"`.

   **The loop ends on the class of what remains, never on a count or a rating:** it ends at the first round whose adjudicated findings, each read at its class, meet every condition below. A Critical so re-read is the adjudication downgrade the Chapter names.

   - The round carries no Critical from a correctness lens.
   - It leaves no owed Major, a behavior finding or a claim an exception holds to that bar, undisposed. A Major is disposed when fixed, routed out of scope, recorded in the Chapter as justified-not-fixed, or bucketed refuse with its record placed per the provenance paragraph. A design stop's refuse is disposed by the fix written within the clause's form, or as justified-not-fixed on a negative-half ground. An accept-and-declare re-enters and owes the fix like any spec-traceable Major. An ask holds the section here until I answer.
   - The round's fix delta owes no round under the fix-delta bar below.

   A held new-requirement Major neither keeps the loop open nor rides into a closed section, on the provenance paragraph's answer window.

   A finding's class is read at adjudication, before any fix exists, from whether it states a failure scenario. Whether the loop ends is read after the fix round. The fix follows the class, and the Chapter records the choice where a finding could close either way. A sentence-fix on a scenario finding leaves a Major justified-not-fixed or a Critical unfixed, never a claim dispositioned. Claim findings an exception holds to the behavior bar are dispositioned in the same fix round. Every other claim finding joins the Minors for the close pass, whatever its rating. A claim finding takes one of four forms: delete the false sentence, add a cheap mechanical check where the claim earns keeping, write a Chapter line naming the sentence left standing and why the finding does not hold, or take the out-of-scope route where the sentence sits outside the section's files. Nothing else disposes of it, and none is silently dropped. A sentence stating something the code does not do is still fixed at the close, under the doctrine's nothing-untrue-ships rule.

   A fix delta whose every hunk changes prose alone owes no round under the bar, whatever finding it dispositions. Prose is a comment, a header, a docstring, a README or `docs/` sentence, a test's title or because-string, a test instrument's stated reach, or a rule's sentence in a skill or charter. Such a delta takes step 5's below-bar author re-read, recorded in the Chapter like the close pass's. For a claim held to the behavior bar, the re-read checks the sentence against the clause, boundary or pointer the finding named. A round the below-bar judgment adds by choice takes this condition like any round. An owed Major's second reversal on one passage, round N+2 undoing N+1's change to N's fix, is the consult skill's trigger (a), and the consult's adopted ruling closes the passage. Where the reversing fix fired the design stop, that stop's ruling comes first. Weigh each finding per the responding-to-review skill before acting on it.

   A fix correcting a claim in curated prose, a deletion included, takes the paragraph as its edit unit rather than the sentence, and carries the claim's other carriers with it, per the writing-skills skill (`skills/writing-skills/SKILL.md` under the kit plugin root). A carrier in a file outside `Files in scope:` takes the out-of-scope route, since the scope check never sees an edit there.

   **The recurrence rule:** when a review surfaces a finding class an earlier section's review already surfaced, fix the instance and amend the plan's `Standing Brief Amendments` block, which step 1 delivers on both paths, so every later section inherits the guard. Only a behavior class takes an amendment. A claim an exception holds to the behavior bar counts as behavior here. Any other second instance of a claims class takes a mechanical check or a deletion sweep. A sibling already in flight takes the amendment at its next review round. Where the plan has no block, create it as its own `##` heading above `## Sections of Work`, never inside it. Record the amendment in the Chapter as approval drift, since the block sits inside the approval-scoped fingerprint.

   **This step runs the section's close gate, once the fixes, the folds and the Minor pass are in.** It is the section-close lane the doctrine's gate bullet names, with the contention lane where that bullet says so, and its counts and exit code go to the Chapter's `Gate:` line. That run is what the fold predicate below means by the gate you are about to run.

   **The adoption trigger is the block's second writer, and it fires on an event rather than a count:** any change to what a section's dispatches are built from, such as an adopted escalation, an operator decision or a spec amendment, is written to the `Standing Brief Amendments` block when adopted, before the next dispatch. An operator decision made mid-run also lands in the plan's `## Intent` section, per brainstorming's freeze paragraph. Where the plan has no such section, add the heading between `## Goal` and `## Approach` and record it as the same drift. The block still carries judge rulings and declared bullets to every sighted dispatch. The intake gap check's route (a) and (b) resolutions stay out of it, their home being the Chapter's `Assumptions:` line.

   **A fix delta can owe a review round of its own.** A round over a fix delta is owed, never optional, on either of two triggers. The first is that the delta touches an outward action: a network call, a process spawn, a write outside the tree. The second is that it adds a module the section did not have before. Tests exercising the delta directly waive neither trigger. A round is also owed where the delta's subject is something the area's tests are liable to route around rather than exercise. That judgment reads hunks that change what runs, so a prose-only delta sits below it. Below the bar, step 3's trivial-section judgment decides, weighing a round in step 1's tier-escalation sense, so a Critical surviving adjudication inside one counts toward that ladder.

   **The out-of-scope route.** A surface the section's `Files in scope:` never listed takes this route, whatever its shape and however it reached you. Another site stating the rule this section changed and a caller of the contract it altered are instances, not the boundary.

   **A Critical from a correctness lens never takes this route.** It is fixed before the section closes, whatever its scope, or raised to me. It is never parked, deferred into an appended section, or carried past this section. Parked under Commit-and-Push, it would reach origin as a written-up open defect. Only findings below that bar reach the destinations below. One that reaches them by an adjudication downgrade from Critical is named in the Chapter as downgraded, with its destination.

   Adjudicate every remaining surface before the section's next step begins, confirming each against the code first under the doctrine's a-finding-is-a-hypothesis rule. The goal question comes next: a surface serving another goal leaves this plan, and inside the goal the fold predicate below decides.

   - **Fold it into this section** when the fix lands in a file in the same directory as one the section changed, needs no acceptance criterion the section lacks, and the gate you are about to run covers it. Add the file to the section's `Files in scope:` line and name the folded surface in the Chapter.
   - **Add it to the plan as a new section** in every other case inside the goal. The one carve-out is a surface needing a material decision the spec never made, a completion-contract blocker that takes the consult-then-leading-`BLOCKED:` path rather than a self-written section. Needing its own brief or acceptance is not that case. Append at the end of the `## Sections of Work` block, immediately above the next `##` heading, with the section-heading and `Model:` shapes `curating-docs`' machine contract freezes. The append is approval drift by construction, so make it deliberately and record it in the Chapter, naming the section whose execution surfaced it.

     An appended section runs in this session, in the loop's order, and takes the intake gap check before dispatch like any section. The close-out status names it as a scope change. Under Commit-and-Push, also name it to me when appended, through the relay channel where one is connected. A surface contradicting a section already written is a contradiction inside the spec and earns the loud leading `BLOCKED:`, never a quiet amendment.

   - **Route it out of this plan** when it serves another goal. The primary form is a handoff, a fresh spec or prompt written now to the bar the doctrine's found-work rule sets. The floor, for a surface earning no handoff, is `docs/backlog.md` with the reason it is not done here, in the format `curating-docs` owns.

   **A surface is never left only in the agent's report.** The three destinations above are the whole set, and the one standing carve-out is step 5's.

5. **Update the plan doc.** Mark the section complete. Where the implementation deviated from the spec, update the spec section to match and flag the deviation in the Chapter. Where the deviation changes design intent, raise it to me rather than silently rewriting the spec.

   **A behavior this section changed re-opens the document an earlier section wrote about it.** Where a document in any completed section's `Files in scope:` describes a behavior this section changed, re-read its describing passages against the new behavior and correct them. Do it once the change is settled, usually at step 2 and at step 5 at the latest, so the correction rides this section's own review and staging. A correction landing after the round is a post-review delta and takes step 4's owed-round bar. Under Commit-and-Push, whose commit goes straight to main, one at or above the bar takes its round. One below it takes the orchestrator's re-read of the delta against the changed behavior before the commit, recorded in the Chapter as an author re-read rather than a round. Name any section state whose only reader was its writer in the close-out status as well as the Chapter.

   The document is a step 4 surface and that route's one standing carve-out: it neither folds nor becomes a section. Name it on this section's `Files in scope:` line and in the Chapter, since widening that line is approval drift as a fold's widening is. The closing section owns the check.

6. **Adjudicate the applied stamps, then append a Chapter** (format below). Carry the section's add-decision lines onto its `Decisions / Surprises` field verbatim from the scratch file step 4 names, the section's own open first. Where a Decision or Surprise traced to the kit itself fighting the work, also jot it to the kaizen inbox per the global capture rule.

   Before writing the Chapter, run `memq unstamped --since <n>d` (or `<n>h`; the flag takes a duration, never a date) over the time since the previous Chapter, else the 1d default. Stamp each record it lists (`memq touch <name> --applied`, with `--type` or `--operator` where its tier needs it) or skip it, and record the outcome on the Chapter's `Stamps:` field. Stamp on the generous bar the memory-system skill owns.

   **A report is not a swept boundary on its own, listed or empty.** The memory-system skill owns how to read one: its verdict, per-tier floors, the counts behind the zeros, and the hand walk a boundary owes. Where that reading leaves the window owing a hand walk, take it before writing the Chapter and say so on the `Stamps:` line, naming the window, why it was owed and what the walk found.

   Run the stamp adjudication at every section boundary rather than at the close-out. A trivially-small section that skips its reviews does not skip it.

   **Do not widen the unstamped window past the previous Chapter, on the theory that more is safer:** widening pulls applied stamps into range, masks a record this section freshly read, and returns a shorter list.

7. **Apply the commit model** recorded in the spec header:
   - **Review-Only:** stage the section's changes (`git add`); never commit. Accumulate a running changed-files summary in the Chapter for the final walkthrough. `git diff --staged` is my review surface.
   - **Branch-and-PR:** commit the section's code with its Chapter (step 6's plan doc update) to the feature branch, cutting that branch before the first commit where the checkout sits on a trunk. A section's verified state commits at first green, the first-green commit: the moment it passes step 2 verification, before the step 3 round is dispatched. Review fixes layer on as follow-up commits. Step 1's staging discipline holds whichever moment the commit lands at. Finishing-work owns the pull request: it opens one where none is open, marks it ready and arms auto-merge. The first-green push and the close push land on a PR branch rather than on a trunk consumers install from, so neither fires the pre-push whole gate. The whole gate this branch owes is the merge's, and finishing-work runs it there.
   - **Commit-and-Push:** commit the section and push to origin. Direct to main, the commit lands only here at close, never at first green, because main must never carry an unreviewed section state. On a worktree branch that concurrency put you on, take Branch-and-PR's first-green commits and lanes, and leave the merge to main and the teardown to finishing-work. **Where the push lands on main it is this step's own gate moment, and step 4's targeted close gate does not stand in for it:** where main is a trunk consumers install from directly with no CI gating the merge, the push is itself the install surface, so the whole gate runs before that push, with the contention lane beside it. Run it before the plan doc is staged, since its counts and exit code go on the Chapter's `Gate:` line beside the close gate's. Where a peer session may commit on this checkout, say so on the coordination surface before the gate starts, since the doctrine's index-window bullet names this window as declared. Then stage the plan doc with the counts on it, so only the staged-list read sits between that add and this commit. Writing that line is the one edit permitted after the gate: it records a run that already happened and changes nothing that run read.

   Under every model, a `docs/backlog.md` entry written under step 4's out-of-scope route rides with the Chapter, staged with it under Review-Only and committed with it under the other two. Where the file carries uncommitted content you did not author, the ride is off and this step states no substitute. The disposition belongs to the doctrine's shared-file hold rule and peer-overlap bullet, the Workspace and siblings check above, and, where a live sibling may hold the file, peer-sessions' bilateral option. The section is not held with the entry. Its files and Chapter ride their carrier on schedule, and the held entry and the foreign lines are named on the Chapter's `Decisions / Surprises` line and again in the close-out.

8. **Open the compaction checkpoint.** Once the Chapter is appended and the section's commit model has been honored, this is a chapter boundary, where a compaction costs nothing. Tell the gate so:

   ```
   node <plugin-root>/hooks/kit-compact-checkpoint.js open
   ```

   Resolve `<plugin-root>` the same way the Dispatch Brief template's style-skill bullet does. With no kit goal armed the command is a harmless no-op refusal. It refuses at exit 1 to a caller the checkpoint would not bless. The case a run meets is the same resumption under a new session id that step 0 names, with the same remedy and the same bound: the resumed run proceeds unleashed until the operator types `/kit-goal` in it, and any other session leaves the goal alone. It writes the calling session's id from its own environment, so run it from the session's shell rather than an operator's. The CLI's open message and the gate hook's header state what the checkpoint admits and how long it lives.

   Where no goal is armed, the run declares the boundary instead of opening a checkpoint: once the Chapter is appended and the commit model honored, run `node <plugin-root>/hooks/kit-compact-checkpoint.js boundary`, from whatever directory the run works in, a linked worktree included. The marker is keyed by session and the moment read from the session's own transcript, so the working directory does not matter. The peer-sessions banking rule owns the verb and its preconditions. A declaration says context holds nothing the disk does not, so make it at banked moments only. A dispatch `WAITING:` stop, a `BLOCKED:` stop and a mid-section turn end each leave work in flight and declare nothing.

Compaction is the harness's own and may fire mid-run. The plan doc and its Chapters are the recovery spine.

**On a gated run, compaction lands at chapter and interim boundaries by design.** With a kit goal armed and this session holding the leash, the kit's PreCompact gate defers auto-compaction mid-chapter until step 8 or the interim ritual below opens a checkpoint. A deferral noticed mid-section is the gate working, never a fault: do not clear the goal, do not touch the checkpoint other than through the interim ritual below, and do not treat it as context pressure. A safety valve allows compaction once consumption nears the model's limit, assuming a window of roughly 1,000,000 tokens. On a smaller window the valve sits above the hard limit and never fires, and nothing detects that. So a run climbing toward its limit while compaction is still deferred is the one case to surface to me.

**A closure drought earns an interim boundary.** Its floor is two consecutive review-round adjudications with no section closing, and a run that sees one forming may act earlier. The other trigger, and the more reliable, is `compact-deferral-nudge.js`, which reports at the return of a long tool call how many offers it is holding and for how long. At either, append an interim board entry below `## Chapters` and honor the commit model for the doc, then open the checkpoint with the same CLI call step 8 names, or, where no goal is armed, declare the boundary with step 8's unleashed branch after that entry. The checkpoint's own expiry bounds an interim boundary no compaction consumes, since step 0's clear runs only when a section starts. The entry supplements step 8 and never replaces it. It is not a Chapter and carries no `Completed:` line. Head it `### Interim board N - YYYY-MM-DD`, N counting the plan's interim entries, a shape curating-docs' Chapter-heading contract never matches. It carries, in order: each in-flight section's stage, the live dispatches and what each was asked, the current gate baseline, the rulings adopted since the last boundary, and the next action per section. That baseline carries the moment the moment-pin bullet of `skills/testing-discipline/SKILL.md` under the kit plugin root requires. Under Review-Only the entry is staged like everything else and the checkpoint still opens.

Then continue to the next section. Do not stop here.

## Consult

The consult is a single read-only fresh-context agent convened to rule on a question the session could not settle. It is the `consultant` at every shape but the design stop, whose judge step 4 names. The consult skill (`consult/SKILL.md`) owns its triggers and mechanics: when to convene it, what the brief carries, the model rule, and how a ruling is adjudicated. Use the consult for a question whose framing may be wrong, the expert ask for an answer that may already exist, and the reviewers for a diff.

## Delegating to Subagents

The orchestrator stays the designer: it writes dispatch prompts, judges findings, reads implementer diffs, and writes Chapters. Keep a task in the main session only when it is design-entangled, tiny, or session-state-dependent. Design-entangled means its shape is still being discovered in contact with the code. Tiny means the prompt would cost more than the work. Session-state-dependent means an in-flight debugging chain.

A subagent loads the skill catalog and, where the machine's CLAUDE.md imports the kit doctrine, the global doctrine. It loads no skill bodies, no conversation, none of your in-flight directives and none of the kit's memory context. SessionStart memory blocks never reach it, the harness's auto-memory index arrives only where that feature is enabled, and the memory-system recognition nudge hands a dispatch at most a pointer, where an `agent:` trigger names its type. So assume no memory arrived, and carry any memory bearing on the section in the brief. Forward every standing directive verbatim, the style contract and the exact constraint among them.

**Write the dispatch prompt from the actual current code,** assuming a skilled engineer with zero context for this codebase. The Dispatch Brief template in step 1 names the fields.

**Hand bulky inputs over as files,** not pasted inline: the spec, or a diff captured with `git diff > .kit/scratch/<name>.diff`. Keep the project's `.gitignore` covering `.kit/`. The blind-reviewer is the standing exception: it takes the base ref or changed-file list per step 3's contract, never a captured diff.

**A subagent's report comes back in its final message, not as a committed file.** Have each return its report inline, and distill the durable outcome into the Chapter. A large review may return the verdict, the Critical/Major/Minor counts and the top finding inline, with the full findings in a `.kit/` file the orchestrator reads only when adjudicating. The same discipline applies to read-only scouts, whose return contract is below.

**Parallelize only when tasks touch non-overlapping files.** Lock shared contracts first and assign disjoint files.

**Stagger concurrent sections; lockstep is the anti-pattern.** Advance them offset: one being briefed, one implementing, one in review. Run steps 4 through 8 for a section the moment a round's step 4 ends with nothing blocking its close, which is a fixes-then-re-review cycle clearing at its final round's adjudication, and never batched with siblings. A step 8 close reached while siblings are in flight appends an interim board entry beside its Chapter, carrying the closure-drought rule's content list.

**A brief grants nothing a mechanical guard denies.** Where a PreToolUse guard keys on agent type, widening the agent's file scope in the brief is inert: the write is blocked whatever the brief says. Route around the guard at dispatch time. Send an agent type the guard admits, keep the guarded write in the main thread, or have the agent return the text in its report for the main thread to place. Step 1's `docs/` routing override is this rule's standing instance.

**A brief forbids nothing the guard does not govern.** The readonly-agent-guard binds only the types its own classifier names. So a scout dispatched as Explore or general-purpose, or a Workflow `agent()` call naming no `agentType`, carries Bash the guard never reads, and its brief's read-only instruction is a request, not a control. Bracket every read-only-intent dispatch under an ungoverned type with `git status --porcelain` before dispatch and again at return, any delta taking step 3's round-bracket incident path. The named types are instances, not the boundary, so a type you cannot place as governed gets the bracket.

**Band the scout by question shape, and state its return contract.** A closed fact-check (does X contain Y, confirm a value) rides the harness default. Open discovery (map a surface, find every call site) gets an explicit sonnet override. Never dispatch top-model recon. A "simple check" that returns more than a couple of leads was mis-banded, so re-run it as discovery. Every scout prompt states its return contract. Each lead comes back as a file:line reference with a one-sentence fact and why the site matters, never pasted file contents, and bulky evidence goes to the gitignored `.kit/` scratch path, read on demand.

**Serialize what the environment cannot share.** Implementation stays single-agent-per-worktree when it touches shared state, and the long integration suites run through one controller, per the doctrine's sequencing bullet.

## Chapter Format

Append to the plan doc's `## Chapters` section:

```markdown
### Chapter N - YYYY-MM-DD
Completed: <N. section title, the bare section number leading; one section per Chapter>
Implemented By: <main session | implementer-haiku | implementer-sonnet | implementer-opus | implementer-fable, plus any escalation>
Metrics: <review rounds <n>, closed <clean | claim-exit | major-closed>; provenance <s> spec-traceable, <f> fix-introduced, <r> new-requirement, rulings (<a> refused, <b> declared, <c> asked); advisory: <v> findings, <w> fixed, <d> deferred, <e> refused; NEEDS_CONTEXT count; escalations; consults <n>>
Recap: <omitted from a section Chapter, carried on the finishing Chapter alone; the plain-language recap whose parts and order finishing-work's step 6 owns>
Decisions / Surprises: <the section's add-decision lines, carried verbatim and line by line from `.kit/scratch/<plan-slug>/add-decisions-section-<n>.md`, the section's own open first, or on the finishing Chapter from the interim board entry `finishing-work` writes them to; then anything resolved or discovered; "none" is acceptable for that second part; in the kit's own repository, one line for the probe pair reading writing-skills' RED and GREEN step calls for, or the state that step names instead, or that no scenario turned on so no pair ran, or that the change named no shape file, none of which is recorded as clean, with its moment-pin where a pair ran>
Failed approaches: <each as "tried X, failed because Y, learned Z"; "none" is acceptable>
Assumptions: <the declared-assumption entries recorded during this section; "none" is acceptable>
Review Findings: <held: <finding> awaiting <seat>; design stop: <mechanism>, ruling <bucket> by <seat>; `review: <pair or lens>[ (<n> readers)] at <model>, <route>[ (<chain>)]`, per dispatch where a pair split, the reader's line quoted verbatim as the `<chain>` of a round step 1's capacity reading downgraded, or `review: <pair or lens> ungated (<chain>)`, `blind: no code diff` beside it where the blind lens was skipped; then Critical/Major addressed, a Major whose trace the orchestrator made rather than a lens named as orchestrator-made; Majors justified; Minors: <n> fixed in the close pass, <m> upgraded on a stated consequence, <k> left with the reason; on the finishing Chapter alone, `goal read: <b> built-but-unasked (<a> refused, <d> declared, <c> asked), <u> asked-but-unbuilt`>
Stamps: <adjudicated N, stamped M; "none surfaced" is acceptable where the stretch was accounted for; a window that owed a hand walk says so, why, and what the walk found>
Gate: <the lane or lanes that ran: the targeted lane at every section close; the contention lane beside it where the section's delta touched machine-shared state; the whole gate where step 7's push lands on an install-surface trunk; and the contention lane again beside that whole gate, which is a second trigger rather than the same one; their counts as tests/pass/fail and the exit code read from the run itself, the code itself rather than a statement that it was read; the delta against the baseline recorded on that same lane, or that no baseline exists on it; the section's test delta: tests added, tests retired, and tests edited to stay green on the section's own change, with one line per added or edited test naming the requirement it pins; the count of added tests that spawn a process, directly or through a shared helper, a generated site counted once with its instance count beside it; the run's wall clock and its contention reading in the form testing-discipline's clock-and-box bullets state, as a delta against the baseline recorded on that same lane; a retired test's retire class, and for a retired guard, grant, refusal-path or designed-copy test its surviving cover or the `docs/security-model.md` sentence amended to record that none stands; any contention the run carried; and, in the kit's own repository and on a final Chapter alone, the probe set's reading where finishing-work's step 6 calls for one: for each invocation of each leg that step calls for, the summary line the runner prints to stdout, whose fields the runner's own README owns, quoted verbatim except that a path it printed in full, there or in a quoted refusal reason, is respelled repo-relative or left out on the Delta line's rule, with the process exit code beside it where the two differ, the warning lines of the run's report.md beside it where any printed, the mismatched moments by name with each row's status, and its moment-pin as the Delta line below carries its own; or the state that step names instead, or that the changeset named no shape file so no run was called for, none of which is recorded as clean, a before leg the after leg gave no moments for being none of them, a `(partial)` line marked as the leg its re-run replaced, and the exit code marked unreadable where the doctrine's fallback path left none; a reading that reports and never blocks>
Next: <next section, or "finishing-work">
Commit Model: <Review-Only | Branch-and-PR | Commit-and-Push>
Delta: <the moment-pin for the reading below, in the form this format's own paragraph requires of every measured figure a Chapter records, since the verb's output carries no machine and no contention of its own; then the reading `node <plugin-root>/scripts/kit-size.js report --repo <the project's root>` prints, quoted in a fenced block below this line exactly as it prints it, whatever rows, totals or non-output line it holds>
```

Chapters exist so that a compacted or fresh session can recover full working state from the plan doc alone. Write them for that reader.

The Metrics line feeds the kit's open experiments (the tier-band question and the consult-adoption watch in `docs/backlog.md`), so record it even when every count is zero. Read its `closed` off the last round that carried findings: `major-closed` where that round carried an owed Major, `claim-exit` where it carried a claim finding and no such Major, and `clean` otherwise, a section with no round included. Its `consults <n>` counts consultant dispatches alone. A judge's ruling on a new-requirement Major or a design stop, the Expert seat's and the scope adjudicator's alike, counts under the provenance tokens instead, so the consult-adoption series keeps measuring one thing.

The provenance tokens count every Critical and Major from a correctness lens that survived adjudication, a correctness Critical included, though it is never held. An advisory lens's Criticals and Majors count on the `advisory` tally alone, which step 4's advisory disposition paragraph defines. The `rulings` parenthetical counts every bucketed ruling, not only the new-requirement findings beside it, since a design stop's ruling buckets a proposed fix and has nowhere else on the line. A relevance ruling is the one bucketed ruling counted nowhere here. Its buckets are `CONFIRM`, `REFUSE` and `ASK`, a `CONFIRM` maps to none of this parenthetical's three, and the advisory tally has no slot for one. A finishing goal read's buckets count on its own `goal read:` field, never here. A double-`NEEDS_CONTEXT` exit counts under `<c>` on either paragraph's route, since the finding reached me whether or not a judge recommended it. A design stop counts once, as the single ruling it is. The Major whose fix it held, where a finding raised it, still counts under its own provenance value. So `<a> + <b> + <c>` runs short of `<r>` by the correctness Criticals that read as new-requirement and were fixed on their own route, and long by one per design stop. Neither difference is a defect, and the `Review Findings:` field names each design stop and its ruling for a reader reconciling them. A declared finding counts once, under `<b>`, never again under `<s>` when its fix round comes.

The Assumptions line is where the intake gap check under Before Starting or Resuming sends an execution-time assumption.

The Gate line's test delta is a record, not a review finding at the section, since the Chapter is written after review. The modelled price of a spawning test goes in the Chapter body under testing-discipline's price paragraph, never on the Gate line. At the finishing pass the verifier reads the plan's Gate lines against the whole changeset. A test the changeset adds that no Gate line names with the requirement it pins is a finding there, once per plan.

The Delta line resolves `<plugin-root>` the same way the Dispatch Brief template's style-skill bullet does. It names the repository outright, because the reading's default root derives from where the script sits, which under a marketplace install is inside the plugin payload. It quotes the verb and states no condition of its own. `scripts/kit-size.js` answers which rows the output holds, which it omits, whether this project is measured at all, and what each of its three non-output lines means. Any path those lines carry is spelled relative to the project's root or left out, as the BLOCKED first line already is, since an absolute checkout path carries the operator's user name into a tracked document.

The Delta output sits after every line the Chapter heading's machine contract reads rather than between them. No line an author adds to any Chapter field, quoted or free, the finishing Chapter's assumptions block among them, opens with `Completed:`, `Next:` or `#`. A recorded text that would is respelled there, with the respelling noted. The runner's summary line opens `probe-corpus:` and the report's warning lines `- WARNING:`, which is what lets both be quoted verbatim.

The reading compares the worktree against HEAD. Where HEAD stays put through the plan it reports every section's accumulated delta, and where the section commit lands before the Chapter it covers only the delta since that commit. On a shared checkout it also carries other sessions' uncommitted edits under the measured roots, so read the row list rather than only the totals.

A Chapter is a journal-layer artifact, so every measured figure it records carries its moment in the form the moment-pin bullet of `skills/testing-discipline/SKILL.md` under the kit plugin root states. The deep evidence behind a figure keeps the home that bullet gives it, and the Chapter cites the analysis rather than restating it.

The Chapter heading and its `Completed:`/`Next:` lines are a machine contract read by external tooling. `curating-docs/SKILL.md`'s machine contract section gives the frozen shape and which values register a section complete.

## Finishing Handoff

Invoke the finishing-work skill; the effort is not done without it. This holds under Review-Only, which defers only the commit: finishing-work still flips the plan to Complete, archives it and stages it with the code.
