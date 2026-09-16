# The post-rewrite program

Program, non-executable: no `Status:` header, no leash, never armed. It is the map of the six steps the operator ordered on 2026-09-13, at the close of the corpus rewrite's rulings batch, for everything that happens between the rewritten corpus and the resumption of ordinary plan work. Each step is its own plan with its own spec; this document names them, their order, the gate between them, and where each step's decisions are recorded. Update it when a step changes state. The seat that closes a step writes the next Log line here in the same pull request.

This program refines the lean kit program (`claude-kit_lean-kit_program_v1.md`) between its stage 3 and its stage 5. That program's stage 3a is this program's step 5, and its stage 5 is this program's step 6. Its stage 4, the lean tree, is not one of the six steps and keeps the place that program gives it, between step 5 and step 6, unless the operator moves it. The seven decisions that bind every stage of the lean kit program bind every step here.

## Why

The rulings batch closed on 2026-09-13 with 27 rulings recorded on `docs/backlog.md` (the item opening "The corpus rewrite's four operator decision batches"). Its last ruling carried the operator's diagnosis of how the kit went off the rails: every takeaway was appended as an incident's details onto existing prose, where the intended process was to jot the higher-level lesson, re-read the passage it touches, and rework that passage with the lesson in mind. The six steps below are that process applied to the kit as a whole: land the rulings, remove what is not needed, fix the prose shape, read every section with the operator for intent, judge what was written against the old corpus, and only then resume.

## The order, and why it holds

Retirement precedes polish because a sentence polished in a skill that is then deleted is work thrown away. The prose pass precedes the read-and-intent review because the operator reads by hand and long paragraphs were what made the corpus hard to read. The triage precedes resumption because every parked plan, pending kaizen note, backlog item and kit memory was written against the old corpus and some of them now ask for what the corpus already says.

## Steps

Each step is a plan under `docs/plans/`. The filename is the handle. The gate is what must be true before the next step starts. Every plan here is Branch-and-PR, since `main` takes changes only through a pull request with one approving review that is not the pusher's own (the `protect-main` ruleset, 2026-09-13).

**Step 1. Land the rulings.** `claude-kit_corpus-rewrite-follow-up_spec_v1.md`. The edits the 27 rulings order, under one plan: the implementer charters aligned to one true text, every restatement of an amended rule brought current or reduced to a pointer, the stop-for-a-yes rule reframed as a consequence test with its ordained channels, the pull request lifecycle steps at finishing-work's close (ready, auto-merge, reap the merged branch) and the freeze rule narrowed to a merged branch, the memory store sync freed of its go-ahead, the lesson-landing rule at kaizen's disposition step, the ledger tidy and the ledger-authoring paragraph, the small charter and template text calls, the retroactive RED and GREEN probe set with the new debugging-dead-end probe. Gate: plan Complete and merged; the operator has reviewed the reframed wording in the pull request.

**Step 2. Retire the skills the kit does not need.** `claude-kit_skill-retirement_spec_v1.md`. Its first section is the one the post-rewrite triage plan carried as its section 7 until 2026-09-13: `cold`, `recap` and `park` leave the tree with every live pointer to them, on the operator's ruling of that date. Further skills join it as their own sections only on the operator's word, and the plan's Open Questions name that the list is his. Gate: plan Complete and merged, then `claude plugin update` and a restart on every machine, since a retired skill still loads from a stale install.

**Step 3. The sentence-shape and paragraph-length pass.** `claude-kit_prose-pass_spec_v1.md`, written 2026-09-15 by the KIT: Expert seat and merged in pull request 28. Ruling batch 3 orders it as a full pass under a new spec: doctrine and output style first, then executing-work, finishing-work, coordinator, role, standing-watch, peer-sessions, memory-system, the reviewer charters, responding-to-review, curating-docs and brainstorming (recap is retired by step 2 and leaves the list). Ruling 20 flags the kit-goal skill's four long passages for it, and ruling 23 hands it the ai-tells respell and, where `cold` is gone before it runs, drops the two cold respells. Gate: plan Complete and merged, plugin update, restart.

**Step 4. The shared read-and-intent review.** `claude-kit_read-and-intent-review_spec_v1.md`, not yet written. Section by section and skill by skill, worked with the operator in the one-ruling-at-a-time shape the rulings batch used, because some sections need his word on whether they mean what they say. Its plan is written after step 3 closes, against the prose the pass produced. Gate: every section and skill in scope carries a recorded read.

**Step 5. The triage.** `claude-kit_post-rewrite-triage_spec_v1.md`, written 2026-09-11 and parked. Every parked plan, pending kaizen note, active backlog item and kit memory record is re-read whole by a Fable judge against the corpus as steps 1 to 4 leave it, and each carries a verdict. Ruling 14 adds a precondition to what survives: every parked plan written before the plan reviewer existed gets the three-part spec review (self-review, blind read, plan review) before it is armed. Gate: the triage plan's own, every item on the four surfaces carrying a verdict and the surviving plans sitting in a queue the operator has ordered.

**Step 6. Resume.** No plan of its own. The stored queue step 5 regenerates is re-armed in the order the operator ruled, per the lean kit program's stage 5. `claude-kit_end-the-turn-on-a-dispatch_spec_v1.md`, written 2026-09-13, slots here unless the operator says earlier.

## Where the state is

- This document: the step list, each step's gate, and the Log below. A step's own plan doc carries its Chapters.
- `docs/backlog.md`, the item opening "The corpus rewrite's four operator decision batches": the 27 rulings verbatim, which step 1's spec is written from and which stays the record of what was ruled.
- `docs/backlog.md`, the item opening "The post-rewrite program": the operator's original six-step order, in his words.
- `claude-kit_lean-kit_program_v1.md`: the decisions that bind every step, and the stages around this program.

A session picking this up after a compaction reads this document, then the plan doc of the step that is In Progress, in that order.

## Log

- 2026-09-13: program written by the KIT: Expert seat on the operator's word after the plugin-update restart. Step 1's spec and step 2's spec are written in the same pull request; the triage plan's section 7 moves to step 2's plan; the eight parked plans carrying `Commit Model: Commit-and-Push` are flipped to Branch-and-PR.
- 2026-09-14: step 2's Open Question 1 re-decided by the operator on the relay thread, superseding the 2026-09-13 Decision that moved the park skill's receiver-side content whole into executing-work. The park drain is cut. What survives is two sentences in executing-work's `WAITING:` stop shape: a stop request from the operator, direct or relayed by the coordinator, is honored at the next safe boundary under the ordinary rules (interim board if mid-section, commit as the plan's model directs, checkpoint open), and a leashed session leads its stop message with `WAITING:` so the Stop hook does not bounce it, with a relayed request answered by one line naming the parked state. Everything else the park skill stated leaves with it: the four drain steps, the commit-nothing carve-out (the operator's live word to commit durably outranks a plan header, and a Review-Only stage is already durable on disk), the bounds, the cancel weighing, the reply-borne path rule, the registry flip to parked, and the parked seat's wake conduct. The coordinator skill's update-window paragraphs point at the `WAITING:` shape and rest their report on the reply line; kit-goal condition (c) and peer-sessions point at the same shape; ownership-map row 82's owner is executing-work's `WAITING:` shape. The step-2 plan's Standing Brief Amendment on re-homing whole is superseded for its section 2, whose owed fix round becomes the removal. The operator's reason: the drain restated durability rules every session already runs, and its one live carve-out had drawn five review rounds.
- 2026-09-14: step 1 closed and merged in pull request 22.
- 2026-09-15: step 2 closed and merged in pull request 26.
