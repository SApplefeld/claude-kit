# Intake Gap Check

Status: In Progress
Commit Model: Commit-and-Push
Created: 2026-08-18

## Goal

Every input the kit takes in (a prompt, a handoff, a spec, a dispatch brief) gets its gaps enumerated before anything is built on it, and every gap the session fills itself is declared on a surface the operator actually reads, never only in a document. When this is done: a session lists what an input does not state, routes each gap (resolve it from doctrine, memory, the plan doc, or the code; pick a default when the gap is low-blast and reversible; ask when it is material and the operator's to decide), and the assumptions it proceeded on ride in the recap the operator approves during brainstorming, in a `BLOCKED:` when a material one appears mid-run, and in the close-out status at the end. A spec also gets a fresh-eyes read before handoff, since the reader who already filled a gap while reading cannot see it. The operator dialogues about plans and approves them from the recap without reading the doc; an assumption that lives only in a Chapter is one they never see, so the doc is the record and the dialog is the surface.

## Approach

**Enumerate always, ask selectively, declare the rest.** Models patch gaps by default, and the patched answer is often not the operator's; the fix is not to ask every gap back (a questionnaire, which the doctrine already forbids: one question at a time, pause only for a true blocker) but to make the enumeration a step and the ask a routing decision. Three routes: (a) answerable from an existing source (doctrine, memory, the plan doc, the code's conventions, a house style): resolve it and cite the source; (b) low-blast and reversible with a conventional default: pick it, and declare it; (c) material and the operator's: ask, batched, with a recommendation, in the decision-ask register the doctrine already defines. Routes (a) and (b) produce declared assumptions; route (c) produces a question.

**The surface rule.** A declared assumption is never left only in a document. It reaches the operator on one of three surfaces, by phase: during brainstorming, in the plan sketch and the pre-handoff recap the operator approves, as its own block; during execution, a material gap the spec does not cover is a `BLOCKED:` on an armed run (the leash's `goal-blocked` event reaches the operator's phone) or a decision ask on an attended one, and a non-material one is appended to the plan doc's `## Assumptions` section and carried in the section's Chapter; at close-out, the finishing status lists every assumption added since approval, verbatim, so the ones made while the operator was away reach the surface they read. The plan doc's `## Assumptions` section is the durable record that lets each surface be computed rather than recalled.

**Fresh eyes on the spec.** The model that read a spec and silently filled a gap sees knowledge, not an assumption; a self-check catches the obvious holes and misses the filled ones. So the brainstorming self-review gains a blind read: the `blind-reader` from the document review battery, dispatched on the spec as an implementer with no session context, whose questions are adjudicated before handoff (answered in the spec, declared as an assumption, or put to the operator). This is the same lens the battery points at customer documents, pointed at the kit's own handoff artifact.

**Where the pieces already exist, wire them; do not duplicate.** Implementers already carry the ask branch (`NEEDS_CONTEXT`) and a declare branch (`DONE_WITH_CONCERNS`, "a spec ambiguity you resolved"); what is missing is where a declared concern goes after the Chapter. Brainstorming already asks one question at a time and batches decisions; what is missing is the assumptions block in the recap and the fresh read. The doctrine already says "state your assumption or ask your question at the right time"; what is missing is the enumeration step, the three routes, and the surface rule.

**Doctrine mechanics.** The doctrine ships as three byte-identical copies (`plugins/claude-kit/skills/operating-instructions/SKILL.md` body, `plugins/claude-kit/claude-kit-doctrine.md`, `home/claude-kit-doctrine.md`), pinned by `test/doctrine-parity.test.js`; the register core the output style mirrors is untouched, so `test/output-style-parity.test.js` is unaffected. The `## Assumptions` heading sits outside `## Sections of Work` and outside `## Chapters`, so the plan-doc machine contract is unchanged.

## Sections of Work

### 1. Doctrine bullet
Model: fable

Add one bullet to the doctrine under "How we work", immediately after "Surface decisions in batches, each with a marked recommendation." Bold lead: **Enumerate the gaps at intake, ask selectively, declare the rest.** Body, in the doctrine's register: at any intake (a prompt, a handoff, a spec, a dispatch brief), list what it does not state before building on it; route each gap to a source that answers it, a low-blast default, or a decision ask; the routed answers are declared assumptions and are never left only in a document: they ride in the recap the operator approves, in a `BLOCKED:` or decision ask when material mid-run, and in the close-out status when made while the operator was away, since the plan doc is the record and the dialog is the surface. State the reason: a model fills gaps silently and cannot see the ones it filled, and the operator approves plans from the recap without reading the doc. Keep it to one bullet of the length its neighbors carry. Land the identical text in all three copies.

Acceptance: `node --test test/doctrine-parity.test.js test/output-style-parity.test.js` passes; the bullet is present in all three files with identical bytes; no em dash in the bullet.

Files: `plugins/claude-kit/skills/operating-instructions/SKILL.md`, `plugins/claude-kit/claude-kit-doctrine.md`, `home/claude-kit-doctrine.md`.

### 2. Brainstorming: assumptions block, template section, fresh read
Model: fable

Three edits to `plugins/claude-kit/skills/brainstorming/SKILL.md`.

- **Spec format.** Add `## Assumptions` between `## Out of Scope` and `## Operator Verification`, with a one-line instruction: one bullet per assumption the session proceeded on, in the form `- assumed YYYY-MM-DD (<route: source | default>): <the assumption>; reversal: <what changing it costs>`, and the note that an assumption first shown to the operator in the recap is recorded here, never the reverse. Add the heading to the machine-contract note's list of headings that sit outside the parsed blocks (it is inert to the parser and must stay outside `## Sections of Work`).
- **Steps 7 and 9.** Step 7 (plan sketch): the sketch and every later recap the operator approves carries an `Assumptions` block listing route (a) and (b) items in plain words, and the approval covers them; a recap that omits the block has not shown the plan. Step 9 (spec self-review): after the inline read, dispatch `blind-reader` on the spec with `Reader: an implementer with no session context, engineer persona, may open the repository`, adjudicate its questions three ways (answer it in the spec; declare it under `## Assumptions` and in the recap; put it to the operator with a recommendation), and record `blind read: <n> questions, <a> answered, <b> assumed, <c> asked` in the handoff recap. Name the cost (one dispatch per spec) and the skip condition (a trivial spec of one or two sections may skip it, saying so).
- **Step 3.** One sentence: the one-question-at-a-time rule is how route (c) is asked; it is not license to skip the enumeration, and routes (a) and (b) are answered by the session and declared, not asked.

Acceptance: the template carries the section with the format line; steps 3, 7, and 9 carry the edits; the machine-contract note names the new heading as outside the parsed blocks; `curating-docs/SKILL.md`'s machine-contract table is unchanged (grep confirms no edit).

Files: `plugins/claude-kit/skills/brainstorming/SKILL.md`.

### 3. Executing-work and finishing-work: intake, mid-run routing, close-out surface
Model: fable

- **executing-work step 1 (Read the plan doc):** after the full read, run the intake gap check on the plan doc: list what a section does not state that its implementer would need, route each, and treat a material gap on an armed run as the `BLOCKED:` the leash already handles (name the reason: the `goal-blocked` event is the surface that reaches the operator while they are away) or, on an attended run, a decision ask. A non-material gap is appended to `## Assumptions` (same line format as brainstorming's, dated today, with the section number) before the section is dispatched, so the brief carries the resolved answer rather than the gap.
- **executing-work, implementer status handling (the `DONE_WITH_CONCERNS` line at step 3's status paragraph):** a "spec ambiguity you resolved" concern is a route (b) assumption made by the implementer: append it to `## Assumptions` with the section number, and carry it in the Chapter; a concern that reads as material re-routes to `NEEDS_CONTEXT` handling rather than being accepted as a concern.
- **executing-work Chapter format (the `## Chapter format` block):** an `Assumptions:` line, after `Decisions / Surprises:`, naming the entries added during the section (or `none`), so the close-out can compute its list from the Chapters and the section rather than re-reading the run.
- **finishing-work step 5 (close and archive) and the close-out status it delivers:** the status carries an `Assumptions made during execution` block listing every `## Assumptions` entry dated after the plan's approval, verbatim, and the same block rides the finishing Chapter. When the block is empty, say `none`, so silence is a stated fact and not an omission. Under a leash, this status is the closing message the `goal-complete` event points the operator at, so it is the surface for a run they walked away from.

Acceptance: all four edits present and consistent with their neighbors; the doctrine-parity and output-style-parity tests still pass (these files are not doctrine copies; the gate proves the edits leaked into none); `grep -n "Assumptions" plugins/claude-kit/skills/executing-work/SKILL.md plugins/claude-kit/skills/finishing-work/SKILL.md` shows the intake, status-handling, Chapter, and close-out sites.

Files: `plugins/claude-kit/skills/executing-work/SKILL.md`, `plugins/claude-kit/skills/finishing-work/SKILL.md`.

### 4. Proof run
Model: opus
Locus: inline

Prove the doctrine bullet changes behavior, per the writing-skills RED/GREEN discipline, and confirm the surface. RED: with the pre-change doctrine (use `git stash` on the three copies or a fixture copy in the scratchpad passed explicitly; never edit the deployed `~/.claude/claude-kit-doctrine.md` by hand, since the refresh hook rewrites it), give a fresh subagent a deliberately under-specified brief (a small function with an unstated error-handling behavior and an unstated naming choice) and record whether it declared or asked about either gap, or built silently. GREEN: same brief with the new bullet in the doctrine the subagent inherits; it should enumerate both gaps and either declare a default or ask. Record both transcripts' relevant lines verbatim in the Chapter. Then dry-run the brainstorming surface on this plan itself: read `## Assumptions` below and confirm each entry appeared in the recap the operator approved (the session that wrote this spec is the evidence; the Chapter records the check as done or names the entry that did not).

Acceptance: RED shows the silent fill or the missing declaration; GREEN shows enumeration plus declare-or-ask; the Chapter carries both verbatim; the surface dry-run is recorded.

Files: none shipped; fixtures are transient.

## Out of Scope

- An arming-time echo of `## Assumptions` in `/kit-goal` (the arm command reading the section and listing unreviewed entries). The operator prefers the brainstorming surface and fires `/kit-goal` to walk away; add the echo if close-out blocks start carrying assumptions that should have been asked at approval.
- Changing the implementer agents' status protocol. `NEEDS_CONTEXT` and `DONE_WITH_CONCERNS` already carry the ask and declare branches; only the orchestrator's handling of them changes.
- A gap check inside the reviewer agents. Reviewers judge outputs; the check is for inputs.
- The output-style register core. The bullet is a "How we work" rule, not a communication-register bullet, so the style's core stays byte-identical.

## Assumptions

- assumed 2026-08-18 (default): the fresh read in brainstorming step 9 uses the battery plan's `blind-reader` with an engineer persona that may open the repository, since a spec's audience is an implementer who will; reversal: one line in step 9.
- assumed 2026-08-18 (source: operator, this session): the primary surface is the brainstorming recap, and the `/kit-goal` arming echo is deferred; reversal: the Out of Scope item above becomes a section.
- assumed 2026-08-18 (default): under a leash, the close-out status is the surface for execution-time assumptions rather than a per-section Discord message, because routine progress stays on the status card and the phone is for decisions and failures; reversal: one line in executing-work's Chapter routing.

## Related

Depends on `claude-kit_document-review-battery_spec_v1.md` (Section 2 dispatches its `blind-reader`); run the battery plan first when both are queued. Extends the doctrine's "Surface decisions in batches" and "state your assumption or ask your question at the right time" rules rather than replacing them.

## Chapters
