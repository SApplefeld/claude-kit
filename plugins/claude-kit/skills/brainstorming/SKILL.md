---
name: brainstorming
description: "Collaborative design conversation for any new feature, project, or non-trivial change. Use when I want to think through a problem before building. Phrases like 'let's think through', 'help me design', 'spec this out', 'how should we approach', or any substantial new effort without an existing spec."
---

# Brainstorming

Explore the problem with me in conversation, then capture the agreement as a spec for the executing-work skill to run. Never delegate the conversation itself to a subagent.

## Process

1. **Understand before proposing.** Open with `memq recall`, which returns the whole memory store as one bounded digest. The memory-system skill owns what it contains and how to act on it. Read it against the problem and pull what bears on it. When a recalled record changes the design, stamp it that turn with `memq touch <name> --applied`. Next read `docs/backlog.md` where it exists. Surface any item bearing on the problem, with its date, and name in the spec any item this effort covers, so the close-out prune retires it. Then read the relevant code, using the built-in Explore subagent for broad reconnaissance so the main context stays lean. Never design against guessed signatures or imagined architecture. A write-up or case study forwarded into the design is read for its diagnosis, and its remedy is set aside before the sketch.

2. **Scope check.** Gauge the request's size before drilling into questions. A request spanning independent subsystems is too big for one spec. An independent subsystem has its own data and lifecycle and is useful alone. Name the pieces, how they relate and the build order, then split into sub-project specs. Brainstorm the first through this process, and give each its own spec and its own execute and finish cycle.

3. **One question at a time.** Ask the question whose answer most changes the design, and wait for the answer before the next. This is how route (c) of the doctrine's intake gap check is asked here, rather than in the batch its mid-run and close-out asks use. It is no license to skip the enumeration. Routes (a) and (b) are answered by the session and declared, not asked.

4. **Feel out the corners.** Edge cases, failure modes, integration points, performance characteristics, who consumes the output, what happens on re-run (idempotency matters in this codebase), what already exists that solves a similar shape.

5. **Present options with tradeoffs** when a real decision exists. State a recommendation and the reason. Disagree openly with my framing when warranted; I want the arguments, not agreement. The answer is usually somewhere in the middle.

6. **Offer the design council at a hard fork.** When step 5 surfaces a hard or material decision with more than one defensible approach, offer the `design-council` skill before settling it 1:1. Such a fork is an architecture or schema choice, build-vs-buy, a migration direction, or a tradeoff expensive or awkward to undo. Err toward offering, and lower the bar to offer, never the bar to run. Make the offer in the turn you recognize the fork, not a later one you control. Do not auto-run it, and name the cost so I can authorize the spend. If I decline, stay in the 1:1 conversation.

7. **Derive the files in scope from the tree.** Where the design changes a contract or a shared surface, one scout sweep runs before the sketch and returns every surface that speaks that contract. Such a surface is anything more than one site has to agree on, such as a schema, an event shape, a rule stated on several surfaces or a shared vocabulary. The sections' "Files in scope" lists are written from what the sweep returns.

   The trigger is decided without the sweep: a name, rule, or shape the change touches appears in more than one file. Unsure counts as yes.

   The sweep is its own second pass, reading for coverage, never step 1's reconnaissance recalled. It runs even where Explore already mapped the area.

   Band it and state its return contract per `executing-work/SKILL.md`'s "Band the scout by question shape, and state its return contract", which owns both. The vehicle is the built-in Explore subagent carrying that band's explicit model override.

   Cite its return in the spec's Approach: the searches run and the surfaces they found. Where those surfaces span independent subsystems, they go back through step 2's split check before any sketch.

8. **Plan sketch before full spec.** Present a short sketch first: goal, approach, the sections of work. Iterate on it until agreed. The sketch, and every later recap I approve, carries an `Assumptions` block naming the route (a) and route (b) items in plain words, and my approval covers them. Beside that block the sketch carries a one-line summary of the `## Intent` record the spec will hold. A recap that omits the block has not shown the plan.

9. **Write the spec** to `docs/plans/<project>_<content-type>_v<n>.md` (increment the version if the name exists; never overwrite a prior version). Then run the `curating-docs` skill's create path (index entry, cross-references, backlog next-steps).

   The `## Intent` section is written here, while the design conversation is still in the window. It carries what and why, never how, which is the Approach's. Its parts, in order: the frame in my words where the session has them; what done does and does not need to do; the alternatives refused, each on one line with its reason; the rulings I make after the spec ships, each dated and appended the same turn; and a provenance line naming the session it was distilled from. An empty refusals or rulings part says so rather than being left out, and that sentence is its content, not a placeholder for step 10 to remove. The not-done half still has to refuse something. The record takes the client-briefing register the doctrine's decision-ask bullet names, since I read and approve it. It is bounded to about 4,000 bytes, roughly one screen, read with `wc -c` over the section at the write. A ruling appended later may carry it past the bound and is never cut to fit, per the freeze paragraph under `## Assumptions`.

   One class of sentence is written against its exclusions rather than its paraphrase: the gating definition. A gating definition is a phrase deciding what a bounded artifact admits, where a bounded artifact is a thing that holds content, keeps other content out, and cannot grow without limit, so a class of actions or of conditions is not one however cleanly it divides. A document, a ledger, a board and a spec's own scope lists are instances of that class rather than its boundary, and an artifact none of them names is covered wherever it meets the definition.

   A gating definition either closes its set in the repo's idiom (`the set is closed at`, `a closed list of`), or names in place at least three things it excludes. An enumeration followed by a trailing general clause says whether the clause summarizes the examples or extends past them.

   Where a definition resists both forms, ask what a reader would do differently if the line were deleted. A line that changes nothing is decoration, and one that changes behavior the author did not intend is the defect this rule catches.

   The rule does not reach a sentence deciding no membership, prose about a bounded artifact that is not itself a definition, or a definition whose artifact carries no bound.

10. **Spec self-review.** Before handing the spec to executing-work, read it once with fresh eyes and fix inline: placeholders (TBD, TODO, "handle appropriately"), sections that contradict each other, scope that drifted past the goal, and requirements readable two ways, which take one reading made explicit.

    Coverage is checked here: every surface step 7's sweep returned appears in some section's Files in scope or under `## Out of Scope`, and one appearing in neither is placed before the spec ships. Every claim the Goal makes is owned by some section's acceptance criteria. A Goal sentence no section delivers is given a section, recorded under `## Operator Verification` where only my action can deliver it, or struck from the Goal.

    Read the `## Intent` record's not-done half, with the refused alternatives beside it, and name one mechanism it would refuse. Where you can name none, rewrite the record before the blind read. The inline pass gets no second inline pass: fix and move on.

    **The Jev coverage check sits between the inline pass and the blind read.** Run `node <plugin-root>/scripts/kit-jev-check.js spec <spec path>`, resolving the plugin root by the ladder in executing-work's Dispatch Brief style-skill paragraph. It prints the sections thinnest first, each with its three lowest topics. Re-read the thinnest against those topics, and change the spec only where you agree the text owes something. A low score is a pointer to re-read, never a finding, and the check gates nothing. Record the tool's closing line in the handoff recap beside the blind-read line, in whichever of its three forms it printed: `jev coverage: <n> sections, thinnest <N> at <mean>`, `jev coverage: not checked (<reason>)`, or `jev coverage: not configured`. A not-checked or not-configured line is recorded as it printed and never retried into a pass. Where the tool printed no closing line, because the session could not run it or it refused its arguments, write the fourth form by hand: `jev coverage: not run (<why>)`. No score reaches the blind reader or the plan reviewer. A spec that skips the blind read may still run this check.

    The blind read that follows is separate and is not optional. Before dispatching it, record which phrases in the spec you count as gating definitions, their locations and nothing more. Dispatch the `blind-reader` agent with the spec itself as the document under review and `Reader: an implementer with no session context, engineer persona, may open the repository`. Adjudicate each question it returns one of three ways: answer it in the spec, declare it under `## Assumptions` and in the recap, or put it to me with a recommendation. Record `blind read: <n> questions, <a> answered, <b> assumed, <c> asked` in the handoff recap. A trivial spec of one or two sections may skip the blind read, saying so.

    The reader's charter, not the dispatch, has it return three pairs per gating definition: a thing the rule admits, the nearest thing it keeps out, and the feature separating them. First compare the two sets of definitions. Rewrite a phrase only one side counted, before the spec ships, until it either reads as a rule or plainly decides nothing. Then place all six members of each shared definition against your own reading: in, out, or cannot place, with the clause that decides it. Then ask whether your rule turns on each pair's separating feature. Four results follow.

    - Crossed: a member you place opposite the reader, or a separating feature your rule does not turn on. Rewrite the definition before the spec ships.
    - Unplaced: a member you cannot place, or place only without a clause to cite. Place it by intent and rewrite the definition until its own text places it too. An immaterial member is recorded instead as excluded under `## Assumptions` and in the recap, in the spec format's bullet form, so doubt falls out rather than in.
    - Under-length: fewer than three pairs with the reader's stated stopper. Rewrite the definition.
    - Pass: all six placed as the reader placed them, clauses cited and features matched. It is the ordinary result and costs nothing.

    Record `gating litmus: <n> definitions, <s> one-sided, <x> crossed, <p> unplaced, <u> under-length` in the handoff recap beside the blind-read line. A spec carrying no gating definition records `gating litmus: none`.

    **The plan review follows the litmus and precedes the handoff recap.** Dispatch the `plan-reviewer` agent with the spec path alone, never the design conversation, at fable and effort high through Workflow's `agent()` on executing-work's Reviewer Dispatch template, after executing-work's capacity reading. Without Workflow, use the Agent tool at `model: 'fable'` and the charter's frontmatter effort, `low`, and record the review as run at lower effort. Where fable cannot run at all, or that reading returned `-> downgrade`, wait rather than substitute a lower model, and record the wait.

    On a `NEEDS_CONTEXT` return, repair the Goal it could not read against and dispatch again. Adjudicate each finding the same three ways as a blind-read question. A Critical rewrites the spec before it ships, and one re-dispatch after that rewrite is the author's call rather than a loop. Record `plan review: <n> findings, <a> fixed, <b> assumed, <c> asked` beside the blind-read line.

    A spec that skipped the blind read skips the gating litmus and the plan review with it, and says so. A session that cannot dispatch (a worker under an external engine) records the skip under `## Assumptions`, and that engine's own review stands in.

11. **Record the commit model in the spec header:** Commit-and-Push unless I name another, and the sketch approval covers it.
   - **Review-Only:** changes accumulate staged as sections complete, and `git diff --staged` is my review surface before anything is committed. Common for smaller changesets in big existing projects.
   - **Branch-and-PR:** work happens on a feature branch and finishing-work opens a pull request. It suits a trunk whose merges are gated by review.
   - **Commit-and-Push:** "land it on main and leave no mess." Commit and push to origin as sections complete. It is the default when authoring a plan, and the header records it. Another model needs a header or a direction that names it.

12. **Assign a model tier to each Section of Work.** Tier picks the model. Briefability picks the locus (dispatch versus main thread).
   - **haiku:** pure transcription: an exact sibling to clone with substitutions, single-responsibility scope, and a self-surfacing gate, a build or existing test that fails loudly on wrong output. Renames and sweeps, config or DTO additions mirroring a named sibling, test data, pin-test count updates. Assign it only where the section text names both the sibling and the gate. A section that leaves either to be found, or holds any judgment call, is `sonnet`.
   - **sonnet:** mechanical or well-bounded: a clear contract, an existing sibling pattern, single-responsibility scope, low integration risk. New procs or services on an established shape, mappings, DTOs, tests, CRUD surfaces.
   - **opus:** moderate complexity: multi-file coordination, nuanced refactors, performance-sensitive logic, mild ambiguity within a clear design.
   - **fable:** the strongest model: novel logic, security-sensitive surfaces, cross-cutting architecture, subtle correctness. Dispatches to `implementer-fable`, which inherits the session model or takes an explicit `fable` override from a below-fable session.

   **Locus rides on its own line, never on the `Model:` line.** A section that cannot be briefed at any tier carries `Locus: inline` beneath its `Model:` line. A section cannot be briefed where the spec is likely to evolve in contact with the code, or where it is so small the brief would cost more than the work. Absent that line, the section is dispatched. Inline is the deliberate exception and the escalation ceiling, never the comfortable default.

   `Model:` names the model that will actually run, so an inline section on the execution session is `Model: opus`. `fable` plus `inline` is a combination to question rather than write, since a Fable main thread exists only on a design session. Keep the value a bare token and put the reasoning in the section body.

   A section earns a cheap tier only if an implementer with no conversation context could build it from the section text alone. Write to that standard or assign a higher tier. Tiers are planning-time recommendations. Executing-work may upgrade one after a failed attempt or an environment fault, and owns which, but never downgrades one mid-effort.

   Where a section carries real behavioral risk, give it a `Tests:` line naming the behaviors that earn one per the testing-discipline skill's litmus (`skills/testing-discipline/SKILL.md` under the kit plugin root), and the risk driving each, in both directions where a guard or flag is involved. It states **intent, never design**: what to lock, never fixtures, seams or structure, which the plan does not know. A paragraph's phrasing is design too. So a `Tests:` line or an acceptance bullet names the direction, token or agreement a pin holds, never the sentence that carries it. It is a **floor over the named contracts, and a ceiling on neither which behaviors are covered nor how much coverage each takes**, and testing-discipline's shape bar governs coverage past it. It is **amendable on contact with the code** like any other spec claim, with the delta flagged in the Chapter.

   Where a section's deliverable is a document for a reader, its body carries the review inputs: an `Audience:` line naming each persona and its knowledge level, the questions the document must answer for each, a `Voice:` line (`scott` | `company` | other), and the fact-base paths its claims are checked against. The `Voice:` value names a voice reference in the `prose-register` skill, or names none. When any persona is outside the operator and the operator's own sessions, the body also carries a `Disclosure:` list of what the documents must not reveal. All of these ride in the section body. A docs-only section that names no audience, such as a plan doc edit or an index refresh, carries none of them.

   A tier answers which model should do the work, never whether to spend. Fable is included in the plan's allotment, and an exhausted allotment yields no work rather than a bill. Executing-work's capacity reading and finishing-work's unavailability rule state how a session detects exhaustion and what it does to a dispatch. A normal effort's Fable surface is standing and expected, and which dispatches draw it is stated by executing-work's reviewer rule, finishing-work's finishing reviews and the consult skill's model rule.

   A Fable-led session is for design: brainstorming, specs, adjudication, and the finishing pass of a high-stakes effort. Execution belongs to a session on the execution model (Opus-led today), whatever the plan's size. When a Fable-led session is asked to execute, the move is a handoff, not a favor: the spec plus a fresh execution-model session, with the plan doc carrying the context. Leave the review tiers as rostered.

## Spec Format

Prefer rich references over prose: acceptance criteria as runnable checks or rubrics, and for UI or visual work a mockup or reference implementation over a description. They ride on the `References:` line.

```markdown
# <Title>

Status: In Progress | Ready
Commit Model: Review-Only | Branch-and-PR | Commit-and-Push
Created: YYYY-MM-DD

## Goal
One paragraph. What exists when this is done, and why it matters.

## Intent
What I asked for and why, in my words where the session has them: the frame, what done does and does not need to do, the refused alternatives with their reasons, later rulings, and a provenance line. What and why only. Step 9 states the parts, the register and the bound.

## Approach
The agreed design, with key decisions and their reasoning, so a later or compacted session understands intent, not just steps.
Where step 7's sweep ran, its result: the searches run and the surfaces they found.

## Sections of Work
### 1. <Section name>
Model: haiku | sonnet | opus | fable
Locus: <omit to dispatch> | inline
What gets built. Acceptance criteria as verifiable statements.
Files in scope: <derived from the Approach's sweep where one ran>.
Tests: <optional> the behaviors this section must lock and the risk driving each.
References: <optional> the runnable check, rubric, mockup, or reference implementation the acceptance leans on, by path.
Audience: <deliverable documents only> each persona and its knowledge level, with the other review inputs step 12 names in the body.
### 2. ...

## Out of Scope
Explicitly excluded items, so drift is detectable.

## Assumptions
One bullet per assumption the session proceeded on, in this exact form:
`- assumed YYYY-MM-DD (<route: a source name | default>): <the assumption>; reversal: <what changing it costs>`.

An assumption is shown to me in the recap first and recorded here after, never the reverse.
This section freezes at approval, because everything above `## Chapters` falls inside the external engine's approval-scoped fingerprint.
The freeze bars the routine per-section append, never a deliberate spec amendment above that line when the design changes, which a Chapter records as drift.
`## Intent` is a section such an amendment reaches: a ruling I make after the spec ships is appended there the same turn, dated, on the same terms, recorded in the Chapter as drift.
An assumption made during execution rides the Chapter's `Assumptions:` line instead, in this form with `, section N` added inside the parenthetical.

## Operator Verification
(Optional.) Checks only I can run: a customer window, a production deploy, a real-device action. Each item names what I run or observe and what outcome reopens the work.
Never write one of these as a Section of Work. Finishing-work owns their completion semantics.

## Open Questions
Unresolved items and who owns the answer.

## Chapters
(Appended by executing-work as sections complete. Leave empty at creation.)
```

The `Status:` line is picked at authoring. A spec for a run that starts now is born `In Progress`, and one deliberately parked is born `Ready`, which session start surfaces as parked rather than offering for resume.

The header and structure above are a machine contract read by external tooling. `curating-docs/SKILL.md`'s machine contract section states the frozen shape and the values it accepts, including `Model:`. `## Assumptions` sits outside the parsed blocks and is inert to the external parser.

## When Not to Use

A trivial fix or a small obvious change needs no spec. Just fix it under the global rules. If I ask to brainstorm something that turns out to be trivial, say so and offer to just do it.
