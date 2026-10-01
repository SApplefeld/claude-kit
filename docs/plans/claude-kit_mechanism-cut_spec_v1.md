# Every kit mechanism is kept, shrunk to its rule and one reason, merged into its owner, or dropped, so the loaded corpus lands near half

Status: In Progress
Commit Model: Branch-and-PR, one PR per section
Created: 2026-09-30

Session model: the kit worker seat, the persona session that runs kit plans on the execution model and that the operator steers from its Discord relay thread, one section per session so no session runs past the account's five-hour window. Every drafting and review dispatch runs through `tools/corpus-compression/workflow.mjs` by the Workflow tool's `scriptPath`, which names the model and the effort on every call and holds at most five agents open. Drafters are read-only and return text. The worker's main thread writes the files.

## Dispatch Authorization

`Status: Ready` is the parked value the plan-doc contract gives an authored plan; this paragraph decides arming. The plan arms once Decisions item 1, the drop list, reads ruled, and once the operator has said on the kit worker's relay thread or at a keyboard that it runs. It has no precondition on another plan. `docs/plans/claude-kit_post-rewrite-triage_spec_v1.md`, the post-rewrite program's step 5, waits for this plan to close, since the triage judges the kaizen inbox, the backlog and kit memory against the corpus and should judge them against the corpus as this plan leaves it.

Pacing is a hard requirement, on the operator's word of 2026-09-30 ("use workflows to run it so that effort can be set, and not load default effort, and chunk into smaller sets of sessions to avoid overflowing the 5h limits"). It is enforced in the machinery: the script's `MAX_OPEN` and `MAX_TRACKS` constants bound every wave, `test/corpus-compression-workflow.test.js` fails a call that names no model or effort, and a section is one session.

## Goal

The kit loads 51 documents as instruction: the 51 paths in `test/size-budget.json` that are neither a rationale ledger nor under `test/`. At `e1a2bb0d` their caps sum to 143,606 words on `node plugins/claude-kit/scripts/kit-size.js`'s count, the `corpus-cap` key. When this plan is done, every one of the 1,270 mechanisms the inventory at `tools/corpus-compression/mechanism-cut-2026-09-30.json` names has met its call: kept as it is, shrunk to its rule and one reason, merged into the one document that owns it, or dropped. The 62 drops are gone with their ledger entries retired. Each document lands at or under the target its section states, 77,397 words in sum over the 50 inventoried documents with the liaison skill's target added in section 7, or its section's pull request carries the one-line miss ask that decision 1 of `docs/plans/claude-kit_lean-kit_program_v1.md`, the lean kit program, provides. `corpus-cap` moves down to the landed sum, so regrowth past it reds the gate. The doctrine and the output style have been read whole by the operator, and every other document by the reviewers.

Acceptance:

- Every document in the sections below is at or under its target on `node plugins/claude-kit/scripts/kit-size.js report --repo .`'s count, which reads and writes nothing, its cap moved to the landed count at the section's close, and the Chapter records target and landing side by side. A landing above target carries the miss ask: the document, its target, its landing, and the mechanisms that would have to go to reach it.
- For every row of the cut file the section owns, the Chapter counts the call as applied, or names the row and says why the drafter or the worker found the call wrong on contact with the ledger and kept the rule. A call is a hypothesis until the ledger heading has been read against it.
- Under every document's ledger heading, every entry whose passage a dropped mechanism carried reads `verdict: retire` with a reason naming the cut file's row, and `- ruled: cut 2026-09-30`. Every entry a shrink or merge rewrote carries a `passage:` line quoting the landed text verbatim, or has been re-verdicted retire naming the entry whose passage now carries its meaning.
- `test/size-ratchet.test.js`, `test/doctrine-parity.test.js`, `test/output-style-parity.test.js`, `test/ledger-preamble-parity.test.js`, `test/heading-shape.test.js`, `test/probe-set.test.js` and `test/corpus-compression-workflow.test.js` are green at every section close. A pin that asserts a sentence's text is re-pinned to the landed sentence in the commit that lands it, and every section's scope includes the pin tests that read its documents, per `## Approach`. The whole gate, `node --test test/*.test.js`, runs at every section close and its exit code is read from the run.
- The probe reading per section is two runs of `node tools/probe-corpus/run.mjs --only <probes>` over the probes whose scenario the section's documents govern, the before leg at the section's base sha and the after leg on the landed text, and the Chapter quotes both summary lines verbatim. A new mismatch on a ruled probe is a finding the section root-causes before it closes: the mechanism the probe depended on comes back, or the row's call is re-asked. A mismatch caused by a drop the operator ruled under Decisions item 1 re-rules the probe in the same commit, so `test/probes/` is in every section's scope. Section 8's litmus and Jev drops reach `test/probes/spec-self-review-finished-before-arming.md`, whose scenario carries both recap lines.
- Section 1's charter change is declared growth under the lean kit program's decision 1: `plugins/claude-kit/agents/corpus-drafter.md` gains at most 120 words for the cut-list input and duty, and its cap moves to the landed count.
- At the close, `corpus-cap` equals the 51 landed caps' sum, `docs/plans/claude-kit_post-rewrite_program_v1.md` carries the step and the Log line section 11 states, and the two handoffs under `## Out of Scope` sit in `docs/backlog.md`.

## Intent

The operator's frame, on the architect persona's relay thread on 2026-09-30, once clients will use the kit: the doctrine and the skills should "carry only the instructions and the intent, not the lessons, not the history, and that they be as lean and minimal as possible". Then, after the first measurement: "I think to truly cut down instructions, we need more than a trim/rewrite/prose pass. I think we need to genuinely look at the rules and guidance and decide whether we need them at all with newer models." And after reading the inventory's first ten documents: the sentence hunt in the pull requests had failed because "every time I sought a sentence to cut it made sense why it was there".

Done means: every mechanism has been judged for whether a current model needs it, the ones that fail that judgment are gone, the ones that pass are stated as a rule and one reason, every rule has one owner, and the size pin holds the result.

Done does not need: a rewording pass over rules that keep their shape; a probe on the target model per dropped rule; a change to the ledger vocabulary; the ledgers' own prose compressed; a rule dropped on taste rather than on the inventory's row; instruction text moved into a file the size budget does not count; or a document made shorter than its meaning allows, which is why a miss is an ask rather than a cut.

Alternatives refused, one line each:
- A sentence-level necessity cut: measured 2026-09-30, sentences a current model does unprompted are 3% of the corpus and guards against a named failure 8%, so the cut is 12% at most and the corpus stays what it is.
- A fresh authoring from a blank page: it loses the ledgers' record of why each rule exists and reproduces the drift the ledgers were built to stop.
- An 80% target taken from the Opus 5.5 and Sonnet 5.5 prompting pages: neither names a percentage; each removes specific instruction classes and adds others, so the target is the inventory's sum, not a number.
- A per-rule probe before a drop: the operator ruled git history, the drift tests and one shadow week enough on 2026-09-30.
- Running the cut inside the post-rewrite triage: the triage judges other surfaces against the corpus and should read the corpus as this plan leaves it.

Rulings after the spec shipped, each appended dated:
- 2026-09-30, on the relay thread, before the spec: the ceiling formula and the four rulings under Decisions items 2 to 5, "I'm good with everything you've proposed"; the proof standard, "I think the second is enough".
- 2026-09-30, on the relay thread, after the spec was drafted: the drop list approved whole, "Agreed. Approved whole. I'll see the details and comparison in the PR, and we still have git history if something was cut we ended up needing." Row 125, added after the ruling, awaits its own word.
- 2026-09-30, on the relay thread, after the spec was pushed: the operator asked whether the plan was dispatched. That is a status question and not the arming word, so the plan stayed parked. Row 125 is applied as drop only once ruled, and section 10 asks if no word has landed by then.
- 2026-09-30, on the relay thread, after the explicit ask: the plan runs, "Run it please!" Row 125 is not yet ruled.

Provenance: distilled by the architect persona from the operator's relay thread of 2026-09-30, the two Anthropic prompting pages, the two measurements under `## Approach`, and the archived corpus-compression spec, in session 5c033e22.

## Approach

Two measurements set the shape, both at kit commit `bf10f9f0` over the 50 documents then in the budget, split into 8,183 sentence-or-block units and judged by an opus model at medium effort through the Workflow tool, five agents open, five chunked runs each, no agent failed.

The first classed every unit by what it does: rule 74%, template 8%, pointer 6%, reason 6%, case 2%, history and operator-specific content under 0.3% together. The corpus holds no lessons to strip. The second classed every rule by whether a current model needs it: 75% names a mechanism, contract or house choice the model cannot know unless told, 3% asks for behavior a 5-family model shows unprompted, 8% guards a named failure. So a sentence-level cut removes about 12%, and anything deeper removes mechanisms.

The inventory followed: one opus judge at medium effort per document, reading the document whole, listing each thing it makes a session do with the words it spends on it, its kind, and a call. Scaled to the size tool's count: 1,270 mechanisms, keep 31%, shrink 53%, merge 11%, drop 5%. The judge's reasons have one shape almost everywhere: a rule that is right, wrapped in grant records, carve-outs and precedence law costing two to three times the rule. That reading agrees with the compression plan's close of 2026-09-26, where the operator read the drafts as cutting "just about as much as possibly can be cut without reevaluating whether a claim should be in there in the first place". This plan is that reevaluation. The cut file is `tools/corpus-compression/mechanism-cut-2026-09-30.json`, landed in the same commit as this spec, one row per mechanism with document, name, what it does, words, kind, call and the judge's reason.

The target per document is keep plus 0.4 of shrink plus 0.15 of merge, the factor the operator approved on 2026-09-30, scaled to the document's cap. Over the 50 inventoried documents that is 76,681 words against their caps of 142,723 at `e1a2bb0d`, 54%, and 77,397 once the doctrine's two pinned copies are counted at the doctrine's landed rate rather than at their own rows, as section 2 states. The judge's own shrink estimates put the corpus near 78,000, so the two readings agree within 2%. The 51st document, the liaison skill, was added at `e1a2bb0d` after the inventory ran; its cap of 883 brings the corpus cap to 143,606, and section 7 takes its inventory by the same judge prompt and the same factor.

The drafting vehicle is the corpus-compression plan's, unchanged in its pacing: `tools/corpus-compression/workflow.mjs` with draft waves at config `opus-medium`, the configuration the operator named the winner on 2026-09-26, and review waves at fable low. What changes is the drafter's brief. Section 1 gives the `corpus-drafter` charter a cut-list input: the document's rows from the cut file, each carrying its call. The drafter applies the calls and reports any row whose call it finds wrong against the ledger, with the reason, instead of applying it. The charter's standing duty that a rule leaves only where the ledger says another entry carries its meaning stays for shrinks and merges, and yields to the cut file for drops, because the drop is the operator's ruling and the ledger is where the retirement is recorded.

Each section runs the same procedure over its documents, one draft wave per document in a track, the review wave behind it:

1. Read the document's rows from the cut file and its ledger heading whole. Where a merge row names an owner, read the owner's document too, since the pointer that stays behind must name text the owner actually carries.
2. Dispatch the draft wave. The prompt carries the document path, the ledger file and heading, the target, and the rows. The drafter returns the document whole and the ledger lines: for a dropped mechanism, every entry whose passage it carried re-verdicted retire with the row's id and name as the reason and `- ruled: cut 2026-09-30`; for a shrink, the `passage:` line per entry; for a merge, the pointer sentence, and a retire on each absorbed entry naming the owner's entry. Plus a list of rows it declined to apply, each with a reason.
3. Before the write, list the tests that pin the document's text: `grep -l` under `test/` for the document's path and for the phrases the rows name. `test/doctrine-parity.test.js` reads bullet content in more than twenty of the documents, `test/claim-class-parity.test.js` holds executing-work's `KIT-CLAIM-CLASS` region byte-identical with copies in the adversarial and blind reviewer charters, `test/review-loop-provenance.test.js` pins executing-work's five-round paragraph, its `Metrics:` tokens and the consult trigger wording and pairs two performance-reviewer paragraphs with the adversarial reviewer's, and `test/docs-curator-charter.test.js` pins one docs-curator paragraph. Those files are in the section's scope, and each pin moves to the landed text in the same commit. Then write the document and the ledger lines, run `kit-size.js sync` and the parity, heading and ratchet tests.
4. Dispatch the review wave: `claude-kit:prose-reviewer` and `claude-kit:blind-reader` at fable low over the landed document, per the script's `REVIEWERS` list. Then the adversarial and blind reviewer pair the executing-work skill's review step dispatches at every section close, over the section's diff. Reviewers raise no word-count or phrasing findings, per the lean kit program's decision 1.
5. Run the probe legs and read them. Close the Chapter with target and landing per document, the calls applied and declined, the probe lines, and the review rounds.

A declined row is not a failure. It is the judge's hypothesis meeting the ledger. The Chapter names it, the rule stays, and the target is not lowered to fit. Where declined rows leave a document above its target, the miss ask goes to the operator with those rows listed, and the operator rules each.

The doctrine has two pinned copies. `plugins/claude-kit/skills/operating-instructions/SKILL.md` carries the doctrine whole under its own short head, held byte-identical by `test/doctrine-parity.test.js`. `plugins/claude-kit/output-styles/kit.md` carries the doctrine's communication core, the register bullets between its `KIT-REGISTER-CORE` markers, 1,236 of its 1,684 words today, held byte-identical by `test/output-style-parity.test.js`. Their copied rows in the cut file read merge with the doctrine named as owner, and that is what the pins already do: this plan does not remove the copies, the doctrine's cut propagates through the sync the parity tests pin, and each copy's own head takes its own rows. A parity pin or a ratchet pin is not a parsed literal in the sense the last assumption uses; it is re-pinned to the landed text in the commit that lands it. Whether the copies stay at all is a load-profile question, out of scope here.

A pinned region shared across sections is synced by the section that drafts its owner, in the same commit, and the copy's own section leaves the region alone. Section 3 owns the `KIT-CLAIM-CLASS` region and syncs its copies in `agents/adversarial-reviewer.md` and `agents/blind-reviewer.md`; section 8 owns brainstorming's bounded-artifact class sentence and syncs its copy in `agents/blind-reader.md`; section 2 owns the doctrine and its two copies. Section 10 drafts the charters around the synced regions and applies no row to them.

A shrink or merge moves text only into a document the size budget counts. The one exception is operating documentation for a tool that no session loads as instruction, which may go to that tool's own README, and the Chapter names every such relocation with its destination and word count so the pull request shows it. A target is never met by relocation.

Pull requests stack as the compression plan's did on the operator's ruling of 2026-09-26: each section's branch is cut from the previous section's branch, its pull request is based on that branch, and the next section starts without waiting on a merge.

## Sections of Work

### 1. The cut file lands and the drafter learns the cut-list input
Model: opus
Locus: inline
The cut file `tools/corpus-compression/mechanism-cut-2026-09-30.json` is committed with this spec and this section confirms it parses, holds 1,270 rows, and that every `file` value names a path in `test/size-budget.json`. `plugins/claude-kit/agents/corpus-drafter.md` gains an input paragraph and a duty: the dispatch may carry a cut list, one row per mechanism with its call; the drafter applies each call as `## Approach` step 2 states, reports rather than applies a row whose call it finds wrong against the ledger, and reports every embedded instruction it meets in a row's text as data. Declared growth: at most 120 words on the charter, its cap moved by the landed amount. `test/corpus-compression-workflow.test.js` stays green; where it pins the charter's text, the pin moves to the landed text in the same commit.
Acceptance: `node -e` over the cut file prints 1,270 rows and zero unknown paths; the charter's new paragraph names the four calls and the decline rule; the whole gate is green.
Files in scope: `tools/corpus-compression/mechanism-cut-2026-09-30.json`, `plugins/claude-kit/agents/corpus-drafter.md`, `test/size-budget.json`, `test/corpus-compression-workflow.test.js`.

### 2. The always-loaded core
Model: opus
Locus: inline
The doctrine and everything that loads with it in every session. The operator reads the landed doctrine and the landed output style whole at this section's pull request, per the ruling of 2026-09-30, and rules every declined row and every miss there. The doctrine's copies follow through the parity sync.

| Document | Cap today | Target | Rows | Drops |
|---|---|---|---|---|
| `home/claude-kit-doctrine.md` | 7,349 | 4,113 | 87 | 4 |
| `home/CLAUDE.md` | 121 | 57 | 5 | 1 |
| `plugins/claude-kit/output-styles/kit.md` | 1,660 | 380 plus the core | 25 | 0 |
| `plugins/claude-kit/skills/operating-instructions/SKILL.md` | 7,349 | 133 plus the doctrine | 77 | 3, in the doctrine |
| `plugins/claude-kit/skills/operating-instructions/references/ownership-map.md` | 2,819 | 1,437 | 11 | 1 |

The ownership map's drop is its pointer-and-copy column, row 995. The map keeps its moment and owner columns whole, since the doctrine's one-owner rule reads it. The two copies' targets are their own heads plus the pinned copy as the doctrine lands it: the output style's eight head rows come to 380 words, and its core is the doctrine's register bullets, about 690 words if they shrink at the doctrine's rate, so about 1,070 in all; the operating-instructions skill's four head rows come to 133 words plus the doctrine whole, about 4,246. Those two figures are what the Goal's 77,397 counts in place of the copies' own rows. The operating-instructions skill's rows 926, 980 and 984 are the doctrine's rows 27, 84 and 89 seen through the copy, and are applied only in the doctrine.
Files in scope: the five documents above, their ledger headings under `plugins/claude-kit/skills/operating-instructions/references/rationale-ledger.md` and `plugins/claude-kit/skills/prose-register/references/rationale-ledger.md` as `docs/rationale-ledgers.md` places them, `test/size-budget.json`, and the pin tests step 3 of `## Approach` finds for these documents.

### 3. The executing-work skill
Model: opus
Locus: inline
`plugins/claude-kit/skills/executing-work/SKILL.md`, cap 20,207, target 10,012, 64 rows, 2 drops (rows 718 and 739). The heaviest shrinks are the dispatch brief template, the reviewer tier and effort route, the held-finding judge, the fifth-round backstop, the Chapter format and the WAITING shapes. The Chapter format and the BLOCKED and WAITING prefixes are machine contracts: the template's field set and the prefixes' literal text stay, and the shrink takes the prose around them. Their readers are `plugins/claude-kit/hooks/chapter-boundary-nudge.js`, the status-line widget's `Completed:` and `Next:` read, the Stop hook's `BLOCKED:` release and the `WAITING:` lead the coordinator board parses, so the section greps each literal after the write and confirms the whole gate is green. Its probes are `implementer-dispatch-brief`, `blocked-declaration-mid-run`, `plan-arriving-mid-run` and `dispatched-agent-quiet-past-its-window`.
Files in scope: the skill, `plugins/claude-kit/skills/executing-work/references/rationale-ledger.md`, `test/size-budget.json`, and the pin tests step 3 of `## Approach` finds for these documents.

### 4. The finishing-work skill
Model: opus
Locus: inline
`plugins/claude-kit/skills/finishing-work/SKILL.md`, cap 11,751, target 5,850, 55 rows, no drops. Its heaviest rows are shrinks of the gated pre-change read, the never-started and synthetic-fault shapes, the transcript tally and the byte-growth reading, and one merge, the kit-repo probe corpus run, which the row sends to the probe runner's own README. Where a shrink moves grep spellings or a script's routing law out of the skill, they land in the tool or reference file the row names, never nowhere.
Files in scope: the skill, `plugins/claude-kit/skills/finishing-work/references/rationale-ledger.md`, `tools/probe-corpus/README.md` for the merge, `test/size-budget.json`, and the pin tests step 3 of `## Approach` finds for these documents.

### 5. The memory-system skill
Model: opus
Locus: inline
`plugins/claude-kit/skills/memory-system/SKILL.md`, cap 13,221, target 5,446, 53 rows, 10 drops, the most of any document: the nudge-log stamp-rate instrument, the frontmatter guard scope, the database internals, the store resolution order, operator anchors inside the store, anchor trust limits, the `author:` field, the superseded floors, the recall label catalogue and auto-memory independence. Each drop's reason says the CLI or the hook enforces it or that no session acts on it. The memq command reference stays as a table of commands with one line each; it is the corpus's heaviest single shrink at 2,277 words today.
Files in scope: the skill, `plugins/claude-kit/skills/memory-system/references/rationale-ledger.md`, `test/size-budget.json`, and the pin tests step 3 of `## Approach` finds for these documents.

### 6. The coordinator, standing-watch and role skills
Model: opus
Locus: inline

| Document | Cap today | Target | Rows | Drops |
|---|---|---|---|---|
| `plugins/claude-kit/skills/coordinator/SKILL.md` | 11,198 | 4,668 | 49 | 3 |
| `plugins/claude-kit/skills/standing-watch/SKILL.md` | 2,628 | 1,374 | 23 | 1 |
| `plugins/claude-kit/skills/role/SKILL.md` | 3,802 | 2,174 | 27 | 1 |

The coordinator's drops are the homing round protocol, the misfiling algebra and the rotated events predicate. The homing rule that survives is one sentence: a line comes off the board only once its destination write is confirmed. Standing-watch's drop is the residual default and its exemptions, replaced by one sentence under the prune rule.
Files in scope: the three skills, their ledgers under each skill's `references/rationale-ledger.md`, `test/size-budget.json`, and the pin tests step 3 of `## Approach` finds for these documents.

### 7. The seat and tooling skills
Model: opus
Locus: inline

| Document | Cap today | Target | Rows | Drops |
|---|---|---|---|---|
| `plugins/claude-kit/skills/peer-sessions/SKILL.md` | 7,076 | 3,690 | 44 | 1 |
| `plugins/claude-kit/skills/kaizen/SKILL.md` | 1,661 | 1,123 | 23 | 0 |
| `plugins/claude-kit/skills/kit-goal/SKILL.md` | 1,612 | 984 | 20 | 1 |
| `plugins/claude-kit/skills/kit-doctor/SKILL.md` | 1,083 | 700 | 16 | 1 |
| `plugins/claude-kit/skills/branch-hygiene/SKILL.md` | 593 | 365 | 12 | 1 |
| `plugins/claude-kit/skills/liaison/SKILL.md` | 883 | set in this section | taken in this section | taken in this section |

The liaison skill was added after the inventory ran and is outside the Goal's 77,397. This section takes its inventory first, by the judge prompt the cut file's `method` field describes, at opus medium through the Workflow tool, appends its rows to the cut file, and sets its target by the same factor. The Chapter records the rows added and the target.
Files in scope: the six skills, their ledgers, the cut file, `test/size-budget.json`, and the pin tests step 3 of `## Approach` finds for these documents.

### 8. The design and review-loop skills
Model: opus
Locus: inline

| Document | Cap today | Target | Rows | Drops |
|---|---|---|---|---|
| `plugins/claude-kit/skills/brainstorming/SKILL.md` | 3,610 | 1,986 | 37 | 4 |
| `plugins/claude-kit/skills/curating-docs/SKILL.md` | 2,374 | 1,526 | 27 | 2 |
| `plugins/claude-kit/skills/curating-docs/references/templates.md` | 653 | 359 | 13 | 1 |
| `plugins/claude-kit/skills/design-council/SKILL.md` | 587 | 423 | 21 | 3 |
| `plugins/claude-kit/skills/consult/SKILL.md` | 751 | 418 | 16 | 1 |
| `plugins/claude-kit/skills/responding-to-review/SKILL.md` | 1,390 | 633 | 18 | 1 |
| `plugins/claude-kit/skills/testing-discipline/SKILL.md` | 3,081 | 1,514 | 27 | 2 |
| `plugins/claude-kit/skills/systematic-debugging/SKILL.md` | 519 | 386 | 13 | 1 |

Brainstorming's drops include the gating litmus and the Jev coverage check. Dropping the litmus removes the `gating litmus:` recap line and the paired-member protocol; the blind read and the plan review stay and carry the boundary questions. Dropping the Jev check removes `plugins/claude-kit/scripts/kit-jev-check.js`'s call from the skill and the `jev coverage:` recap line; the script itself is out of scope and stays. Curating-docs' plan doc machine contract table is a keep and stays whole.
Files in scope: the eight documents, their ledgers, `test/size-budget.json`, and the pin tests step 3 of `## Approach` finds for these documents.

### 9. The prose and style skills
Model: opus
Locus: inline

| Document | Cap today | Target | Rows | Drops |
|---|---|---|---|---|
| `plugins/claude-kit/skills/prose-register/SKILL.md` | 781 | 445 | 12 | 0 |
| `plugins/claude-kit/skills/prose-register/references/ai-tells.md` | 1,803 | 1,139 | 20 | 1 |
| `plugins/claude-kit/skills/prose-register/references/voice-scott.md` | 708 | 502 | 20 | 2 |
| `plugins/claude-kit/skills/writing-skills/SKILL.md` | 2,403 | 1,141 | 23 | 1 |
| `plugins/claude-kit/skills/csharp-style/SKILL.md` | 1,018 | 542 | 23 | 1 |
| `plugins/claude-kit/skills/csharp-style/references/csharp-style.md` | 1,896 | 1,242 | 23 | 2 |
| `plugins/claude-kit/skills/sql-style/SKILL.md` | 956 | 676 | 24 | 1 |
| `plugins/claude-kit/skills/sql-style/references/sql-style.md` | 2,683 | 2,247 | 22 | 0 |

The merges here land in the doctrine's direction only where section 2 left the doctrine carrying the rule. Where section 2 moved a prose rule out of the doctrine to prose-register, the pointer runs the other way, and this section reads section 2's Chapter before drafting.
Files in scope: the eight documents, their ledgers, `test/size-budget.json`, and the pin tests step 3 of `## Approach` finds for these documents.

### 10. The agent charters
Model: opus
Locus: inline
The eighteen charters under `plugins/claude-kit/agents/`, caps 394 to 3,167, targets from the cut file's rows: adversarial-reviewer 1,879, prose-reviewer 1,492, scope-adjudicator 1,241, security-reviewer 1,312, docs-curator 1,110, blind-reviewer 806, blind-reader 830, performance-reviewer 717, implementer-fable 785, implementer-opus 768, implementer-sonnet 723, implementer-haiku 617, plan-reviewer 797, qa-verifier 587, consultant 235, council-member 310, corpus-drafter 373 plus section 1's declared growth, design-facilitator 327. Drops are 9 rows totalling 349 words, the ninth being row 125, the blind reader's near-miss pairs, which is the reader-side half of the gating litmus section 8 drops and is retired naming row 478. Every charter's frontmatter, tool list, effort and status vocabulary are keeps, since the orchestrator and the hooks parse them. The four implementer charters share their text by design; their rows are applied once and mirrored, and the Chapter says which charter was drafted and which were mirrored.
Files in scope: the eighteen charters, `plugins/claude-kit/skills/executing-work/references/rationale-ledger.md` and the other ledgers `docs/rationale-ledgers.md` places them under, `test/size-budget.json`, and the pin tests step 3 of `## Approach` finds for these documents.

### 11. The corpus cap, the program and the handoffs
Model: opus
Locus: inline
`corpus-cap` in `test/size-budget.json` moves to the 51 landed caps' sum. `docs/plans/claude-kit_post-rewrite_program_v1.md` gains a step between steps 4 and 5, `Step 4b. The mechanism cut`, naming this plan, and a Log line dated at the close stating the landed sum against 143,606 and the count of declined rows. `docs/backlog.md` gains the two handoffs under `## Out of Scope`. The docs indexes drop this plan from their active lists as curating-docs' close path states. The whole gate runs, its exit code read from the run, and the finishing pass runs.
Acceptance: `node --test test/*.test.js` exits 0; the program document carries the step and the Log line; the backlog carries the two items; the Chapter records the landed sum and the miss count.
Files in scope: `test/size-budget.json`, `docs/plans/claude-kit_post-rewrite_program_v1.md`, `docs/backlog.md`, `docs/README.md`, `docs/plans/README.md`.

## Decisions

**Item 1. The drop list is approved whole, or with named rows kept.** Ruled: approved whole, 2026-09-30, on the relay thread, "Agreed. Approved whole. I'll see the details and comparison in the PR, and we still have git history if something was cut we ended up needing." The ruling covers the 61 rows the list held when it was put; row 125, added at the plan review as the consequence of row 478, is put to the operator in the same reply and is applied as drop only once the operator says so.

- Situation. 62 rows read drop, 7,742 words. Each is a mechanism the judge found a tool or the harness already enforces, maintainer documentation a session never acts on, or a guard against a failure not seen on a 5-family model. A drop removes a mechanism, so it is the operator's ruling; a shrink or merge keeps the rule for the reviewers to check.
- Decision. Whether the 62 rows under `## Drop List` go, and which if any stay.
- Stakes. Without the ruling the plan does not arm. A row kept by name is applied as keep and its words come off that document's cut.
- Options. (a) Approve whole. (Recommended.) The ledger keeps each row's reason, and a failure that reappears brings the rule back from git with its entry intact. (b) Approve with named exceptions. (c) Refuse the list: the plan runs shrinks and merges only, and the targets rise by each document's drop words.
- Unanswered: the plan stays parked.

**Item 2. The target per document is keep plus 0.4 of shrink plus 0.15 of merge.** Ruled: as recommended, 2026-09-30, "I'm good with everything you've proposed".

**Item 3. The bar for a call is the lowest model tier that loads the document.** Declared. The doctrine loads on every session; a dispatch brief and an implementer charter load on sonnet and haiku workers, which the Sonnet 5.5 prompting page says still skip verification and stop early at low effort. So the verify and keep-working rules in those documents are keeps whatever the judge called them, and the drafters of section 3, for the Dispatch Brief template, and section 10, for the implementer charters, are told so.

**Item 4. A dropped rule needs no probe on the target model.** Ruled 2026-09-30, "I think the second is enough": git history, the drift tests and one shadow week are the proof. The shadow week is the week after each section's pull request merges, and the second bullet under `## Operator Verification` names what to watch.

**Item 5. The operator reads two documents; the reviewers read the rest.** Ruled 2026-09-30 as proposed. The doctrine and the output style at section 2's pull request. Every other document's read is the review wave's and the section-close pair's.

**Item 6. The doctrine's two pinned copies stay.** Declared, low-blast. The cut reaches them through the parity sync. Whether a copy earns its load on a client host is the load-profile question the first handoff under `## Out of Scope` carries.

## Out of Scope

- A client load profile deciding which documents leave a client host at all. The operator ruled it wanted on 2026-09-30. It is a distribution question and belongs with the backlog's plugins-only public distribution item of 2026-09-28, which section 11 cross-references. Handoff one.
- The operator's name and voice moved to one per-deployment file. Ruled wanted 2026-09-30. `voice-scott.md` is already a per-voice reference; what remains is the `I` and `me` binding in the doctrine and the output style, which is a deployment file's job and touches the parity tests. Handoff two.
- The rationale ledgers' own prose, per the compression plan's item 2.
- `plugins/claude-kit/scripts/kit-jev-check.js` and the probe runner's code. Section 8 removes the Jev check's call from brainstorming; the script stays for the triage plan, which still names it.
- Any hook or test that parses a kept contract. Where a kept contract's literal text is pinned, the pin stays and the prose around it shrinks.

## Assumptions

- The inventory is one opus judge's reading per document, confirmed on four spot-checks by the author against the files, and every call is a hypothesis the section confirms against the ledger. A declined call keeps the rule and is named in the Chapter.
- A section is one worker session, so the account's five-hour window holds; a section that cannot close in one session ends on a Chapter naming the documents landed and resumes from the plan doc.
- Drafting runs at opus medium and reviewing at fable low, the constants the compression tool carries; no dispatch in this plan runs at a default effort.
- The word counts in the cut file are the judge's estimates scaled to each document's measured size, so a row's words are a share, not a count a reviewer can re-measure.
- Reviewers raise no word-count or phrasing findings, per the lean kit program's decision 1; the size tool is the only word gate.
- The sections after 2 read section 2's Chapter first, because merges toward the doctrine depend on what section 2 left there.
- A row whose call reaches a literal a hook or a test parses is applied to the prose around the literal and never to the literal. Such a literal is a status word, a prefix, a template field or a heading, and the set is closed at those four.

## Drop List

The 62 rows Decisions item 1 rules on, heaviest first. Row numbers index the cut file. Row 125 was added at the plan review as the consequence of row 478.

| Row | Words | Document | Mechanism | Why it goes |
|---|---|---|---|---|
| 125 | 172 | `agents/blind-reader.md` | Gating definition near-miss pairs | The reader-side half of the gating litmus row 478 drops; nothing reads its output once the litmus is gone. |
| 995 | 801 | `skills/operating-instructions/references/ownership-map.md` | Pointer and copy column | It serves kit maintainers auditing drift, not a session looking for an owner, it is greppable on demand, and it is the largest word cost in the file at about a quarter of every load. |
| 566 | 596 | `skills/coordinator/SKILL.md` | Homing round protocol | This transactional ceremony guards a rare cleanup, and one rule would cover it: cut a line only after its destination write is confirmed. |
| 1191 | 473 | `skills/standing-watch/SKILL.md` | Residual default and exemptions | A self-referential apparatus about how rules interact that no 5-family model would apply faithfully mid-watch; the operative rule fits in one sentence under the prune rule. |
| 901 | 471 | `skills/memory-system/SKILL.md` | Nudge log stamp-rate instrument | A research instrument for one archived plan's decision, not something a working session does. |
| 739 | 365 | `skills/executing-work/SKILL.md` | Metrics and ruling tallies | Experiment bookkeeping whose reconciliation rules cost more attention than a slightly miscounted metric costs. |
| 908 | 364 | `skills/memory-system/SKILL.md` | Frontmatter guard scope and silence | The guard enforces itself, and the scope caveats guard against deliberate bypass, which a session authoring through memq never attempts. |
| 559 | 343 | `skills/coordinator/SKILL.md` | Misfiling cost and conflict algebra | The theory costs far more than the rare misfiling it prevents, and a current model routes sensibly with the core rule. |
| 718 | 331 | `skills/executing-work/SKILL.md` | Per-round fix diff captures | The orchestrator can judge fix-introduced from the round it just ran, and the capture procedure costs more than a misclassification does. |
| 888 | 326 | `skills/memory-system/SKILL.md` | Memory database layer internals | The session never acts on tenancy or queue internals; the one needed line is that the markdown is the record and the database a derived copy. |
| 478 | 268 | `skills/brainstorming/SKILL.md` | Gating litmus with paired members | A four-outcome protocol guarding a failure the blind read and plan review already surface, at a cost beyond its yield. |
| 858 | 250 | `skills/memory-system/SKILL.md` | Store resolution order internals | The CLI resolves the store itself; the session needs only that a worktree shares its main checkout's store. |
| 897 | 250 | `skills/memory-system/SKILL.md` | Operator anchors inside store | A niche capability, and the CLI enforces its own path rule. |
| 639 | 236 | `skills/curating-docs/SKILL.md` | Kit-side reader looseness details | Maintainer documentation of hook internals that changes nothing a session writes, apart from the archived-nag sentence, which stays. |
| 476 | 235 | `skills/brainstorming/SKILL.md` | Jev coverage check | It gates nothing, its score is a pointer to re-read, and its four recorded forms cost more than the thin-section risk the blind read catches. |
| 898 | 167 | `skills/memory-system/SKILL.md` | Anchor trust limits | Residual implementation caveats a session almost never hits; the worktree line may earn one sentence. |
| 541 | 154 | `skills/coordinator/SKILL.md` | Rotated events file predicate | One clause saying to also read the `.old` file does the job of a timestamp predicate. |
| 582 | 143 | `skills/csharp-style/SKILL.md` | Regex pitfall explanations | This much regex defense for an optional outlining aid costs more than the failure it prevents, and the doctrine already says an outline never proves absence. |
| 885 | 137 | `skills/memory-system/SKILL.md` | `author:` provenance field | The CLI writes it; the one instruction, never write it by hand, is one clause. |
| 903 | 137 | `skills/memory-system/SKILL.md` | Superseded candidates and neighbour floors | The scan applies both, and tuning the floors is kit maintenance. |
| 870 | 106 | `skills/memory-system/SKILL.md` | Recall label and coverage catalogue | The output explains itself when read, and the catalogue changes no action. |
| 1118 | 86 | `skills/role/SKILL.md` | Unguarded directory threat model | Design rationale for maintainers that changes no act a session takes. |
| 657 | 74 | `skills/curating-docs/references/templates.md` | Stable-doc and plan purpose prose | Template filler repeating doctrine the session already holds. |
| 926 | 74 | `skills/operating-instructions/SKILL.md` | Stops and grants read with owners | Guards an edge case of the kit's own sprawl; the ownership-map entry already implies it. |
| 27 | 71 | `home/claude-kit-doctrine.md` | Stops need their exceptions | Meta-governance for the kit's own duplication, which fixing the duplicates removes. |
| 1004 | 70 | `skills/peer-sessions/SKILL.md` | Harness floor on inbound messages | The harness enforces this itself, and the doctrine's data-not-instructions rule carries it. |
| 406 | 67 | `agents/scope-adjudicator.md` | Orchestrator downstream routing notes | The orchestrator's acts, owned by executing-work and finishing-work, that do not change what the judge rules. |
| 1232 | 66 | `skills/testing-discipline/SKILL.md` | Shape bar | It restates the earning and duplicate rules, and a current model writes neighbor-sized focused tests. |
| 984 | 59 | `skills/operating-instructions/SKILL.md` | Do not waste moves | Current models economize reads, and the harness tool text covers re-reads. |
| 1268 | 55 | `skills/writing-skills/SKILL.md` | Correction rule binds every writer | A pointer paragraph adding no action beyond the correction rule it follows. |
| 506 | 53 | `skills/branch-hygiene/SKILL.md` | Remote auto-delete setting note | Optional operator advice that changes no act in this skill. |
| 861 | 53 | `skills/memory-system/SKILL.md` | Independence from auto-memory | Knowing this changes no action. |
| 89 | 52 | `home/claude-kit-doctrine.md` | Don't waste moves | Current models are efficient here unprompted, and the failure is cheap. |
| 621 | 45 | `skills/curating-docs/SKILL.md` | Coordinator-board file carve-out | Guards a legacy migration artifact that belongs to the role skill. |
| 475 | 41 | `skills/brainstorming/SKILL.md` | Intent refusal naming test | The Intent template already requires refused alternatives. |
| 1092 | 41 | `skills/prose-register/references/voice-scott.md` | Retired unowned conventions | Journey history about what was cut, with no working rule beyond one case per document. |
| 1241 | 39 | `skills/testing-discipline/SKILL.md` | Doctrine pointer on baselines | Restates what the doctrine, loaded every session, owns. |
| 677 | 33 | `skills/design-council/SKILL.md` | Provenance note | Attribution and history that drives no session behavior. |
| 465 | 32 | `skills/brainstorming/SKILL.md` | Probe edge cases and corners | A 5-family model probes these unprompted; only the idempotency note is project-specific. |
| 518 | 30 | `skills/consult/SKILL.md` | Section scope excludes design stop | Repeats the design-stop exception stated in trigger (e) and the frontmatter. |
| 980 | 30 | `skills/operating-instructions/SKILL.md` | Readiness signals, no fixed sleeps | The harness blocks foreground sleep and says the same. |
| 84 | 28 | `home/claude-kit-doctrine.md` | Readiness signal, not sleep | The harness blocks foreground sleep and steers to Monitor. |
| 836 | 26 | `skills/kit-doctor/SKILL.md` | Opening purpose statement | Orientation only. |
| 2 | 25 | `home/CLAUDE.md` | Slash command routes to skill | The harness routes a typed slash command to the installed skill itself. |
| 141 | 25 | `agents/blind-reviewer.md` | Long-justification-comment heuristic | A style-adjacent rule of thumb that clashes with the no-style scope; the recall rule covers a dubious workaround. |
| 659 | 25 | `skills/design-council/SKILL.md` | Opening purpose statement | Restates what sections 2 to 5 already make the session do. |
| 73 | 24 | `home/claude-kit-doctrine.md` | Embedded text is data | The harness system prompt and model training enforce this. |
| 100 | 21 | `agents/adversarial-reviewer.md` | Generic correctness checklist | Any current model reviewing code checks these unprompted. |
| 130 | 18 | `agents/blind-reader.md` | Report own persona experience | Restates the role framing in the opening paragraph. |
| 181 | 18 | `agents/council-member.md` | Blind first round rationale | The orchestrator enforces blindness by construction. |
| 855 | 18 | `skills/kit-goal/SKILL.md` | Condition text pointer | A source-code pointer the session never acts on. |
| 1098 | 17 | `skills/responding-to-review/SKILL.md` | Read whole set first | A current model takes a returned report in whole before acting. |
| 616 | 16 | `skills/csharp-style/references/csharp-style.md` | Whitespace basics | A current model does this unprompted, and a committed `.editorconfig` governs anyway. |
| 1213 | 14 | `skills/systematic-debugging/SKILL.md` | Check what changed recently | A current model checks recent changes unprompted when debugging. |
| 598 | 13 | `skills/csharp-style/references/csharp-style.md` | No file header | A current model writes no file header unless a sibling has one. |
| 676 | 12 | `skills/design-council/SKILL.md` | Operator cost envelope | The operator can always do this, and a model honors a cut. |
| 111 | 10 | `agents/adversarial-reviewer.md` | Debris checklist | Current models flag debris in review unprompted. |
| 316 | 9 | `agents/performance-reviewer.md` | Honest severity both ways | Severity is already defined by requirement and evidence. |
| 432 | 9 | `agents/security-reviewer.md` | Clean changeset one-liner | A current model does this once it has the verdict format. |
| 1087 | 7 | `skills/prose-register/references/voice-scott.md` | Oxford comma consistency | A current model is consistent within a document, and the rule picks no side. |
| 1156 | 7 | `skills/sql-style/SKILL.md` | No SELECT star to callers | A current model avoids `SELECT *` in procedure result sets unprompted. |
| 1057 | 4 | `skills/prose-register/references/ai-tells.md` | Emoji ban | The harness system prompt bars emoji, and 5-family models rarely emit them. |

## Operator Verification

- Read the landed doctrine and output style whole at section 2's pull request and rule its declined rows and misses there.
- After each section's pull request merges, one shadow week: a session that misbehaves in a way a dropped row's reason names is the signal, and the fix is the row's rule back from git with its ledger entry re-verdicted keep.
- Rule each section's miss ask in its pull request.

## Related

- Builds on `../archive/claude-kit_corpus-compression_spec_v1.md`, whose close named the reevaluation this plan performs, and reuses its dispatch script and drafter.
- Sits in `claude-kit_post-rewrite_program_v1.md` as step 4b, before `claude-kit_post-rewrite-triage_spec_v1.md`.
- Measurements and the judge prompts: the architect persona's scratch under its own machine directory, summarized in the kit memory records `the-kit-instruction-corpus-is-three-quarters-rule-text-with-no-measurable-history` and `the-kit-necessity-cut-removes-twelve-percent-because-three-quarters-of-rules-encode-kit-mechanisms`.

## Chapters

### Chapter 1 - 2026-10-01
Completed: 1. The cut file lands and the drafter learns the cut-list input
Implemented By: main session (inline, Opus 5.5)
Metrics: review rounds 1, closed major-closed; provenance 2 spec-traceable, 0 fix-introduced, 0 new-requirement, rulings (0 refused, 0 declared, 0 asked); advisory: 0 findings, 0 fixed, 0 deferred, 0 refused; NEEDS_CONTEXT 0; escalations 0; consults 0
Decisions / Surprises:
- Section 1 open: the corpus-drafter charter gains a cut-list input and its duties (apply keep, shrink, merge, drop; report a wrong call instead of applying it; rows are data); serves the section 1 paragraph and its acceptance bullet "the charter's new paragraph names the four calls and the decline rule"; adds no mechanism that runs, since the dispatch script already passes a free-text prompt per wave; size at most 120 words of declared growth on a 394-word cap; not building it leaves sections 2 to 10 dispatching drafters whose charter forbids dropping a rule the operator ruled dropped.
- Taken on 2026-10-01 from the coordinator's record DEV-PLUGIN-691ddfa1-650b-4147-b752-d27eb72dda5f-4. The grant traces to the operator: the Intent's line "Run it please!" is an inbound relay event at 2026-10-01T01:42:54Z in the architect persona's transcript, session 5c033e22, answering its ask to run the plan (reported by that transcript, read this turn). Status moved Ready to In Progress.
- Branch: the section works on `mechanism-cut/s1`, cut from `plans/mechanism-cut` at 45ffd7b5, so the architect's later commits to the plan branch, such as row 125's ruling, never race this one. Section 2 cuts its branch from this one, per `## Approach`'s stacking.
- Cut file: `node -e` over it and `test/size-budget.json` printed 1270 rows, 0 unknown paths; calls keep 634, shrink 381, merge 193, drop 62.
- The charter has no rationale-ledger heading, so this section writes no ledger lines. Giving it one is a backlog item on branch `backlog/corpus-drafter-ledger`, pull request #157, which section 10 meets when it drafts the charter.
- No test pins the charter's prose: `grep -rn corpus-drafter test/` hits only the agent-type rosters in `test/readonly-agent-guard.test.js`, `test/memory-recognition-nudge.test.js` and the dispatch triple at `test/corpus-compression-workflow.test.js:178`.
- Charter growth: 394 to 514, exactly the 120 declared. `corpus-cap` 143606 to 143726, which section 11 moves to the landed sum.
- For section 10: row 125 reads drop in the cut file and is unruled. The charter applies what it is handed, so section 10's dispatch withholds that row until the operator's ruling lands, per Decisions item 1.
- For a later section: `tools/corpus-compression/workflow.mjs`'s `meta.whenToUse` still names only the archived compression spec. It sits outside this section's files.
Failed approaches: tried the first draft at 140 words of growth, over the 120 ceiling; trimmed my own new sentences rather than the charter's existing text, which is section 10's to cut.
Assumptions:
- assumed 2026-10-01 (default, section 1): the drafter's `ruled:` line arrives as a dispatch input rather than a literal in the charter, since the date is per-plan and the charter serves two plans.
- assumed 2026-10-01 (default, section 1): the review wave of `## Approach` step 4 is for drafted documents; this section drafted none, so its review is the executing-work pair alone.
Review Findings: `review: adversarial and blind at fable, Agent tool` (capacity reading `fable capacity: no reading (stale) -> ladder governs`). Majors fixed: the drop duty named a `ruled:` line no input carried (both lenses; Goal acceptance bullet 3, orchestrator-made trace for the blind lens), and a merge's owner was named by no input (blind; `## Approach` step 1, orchestrator-made). Fix delta prose-only, author re-read against both clauses. Minors: 3 fixed (row fields listed, empty third block written `none`, frontmatter description names both plans); 3 left: a tiebreak for a `ruled: keep` entry, which the decline duty already covers; a pin test on the cut file, which section 7's append re-runs the same check for; row 125, a section 10 dispatch note above.
Stamps: adjudicated 2, stamped 1 (`suite-baseline-is-not-zero-fail`, which read the baseline's second red as an intermittent); skipped `subagent-can-report-a-documented-past-injection-as-a-live-one`, read and not applied.
Gate: baseline whole gate at 45ffd7b5, SCOTT-CLAUDE, `.kit/wt-mechanism-cut`, 2026-10-01T01:52:18Z to 02:00:51Z, no foreign test runner in the poll (a sample): `node --test test/*.test.js` 4338 tests, 4326 pass, 2 fail, 10 skipped, exit 1. The fails: `test/kit-sidecar-memory-index.test.js` "loadIndex answers a status, never a throw", the known linked-worktree red; and `test/memory-index.test.js` "a sweep writes only its own sidecar and never touches a memory file", 38/38 green on three solo re-runs, read as an under-load intermittent. The charter and budget were edited while that run read the tree, and the only tests reading them passed in both. Close lane over the landed tree, 2026-10-01T02:05:33Z to 02:06:18Z (45 s), same box and worktree: size-ratchet, corpus-compression-workflow, readonly-agent-guard, memory-recognition-nudge, doctrine-parity, ledger-preamble-parity, heading-shape, output-style-parity and probe-set, 656 tests, 656 pass, 0 fail, exit 0; delta 0 against the same files in the baseline. `kit-size.js check` exit 0. Tests added 0, retired 0, edited 0. Probe pair: the section changed no document a probe scenario governs, so no pair ran.
Next: 2. The always-loaded core
Commit Model: Branch-and-PR
Delta: SCOTT-CLAUDE, 2026-10-01T02:06Z, worktree `.kit/wt-mechanism-cut` against HEAD fdd80e95, no foreign test runner live.
```
repository: wt-mechanism-cut
plugins/claude-kit/agents/corpus-drafter.md: 514 words, cap 514, +1
words: 1029246 of cap 1029246 across 121 curated files
test lines: 142586 of cap 142586 across 80 test files
tests: 4087
changed paths under no measured root: none; named-exclusion paths in the changeset: test/size-budget.json, which a root holds and no shape measures, so no row above names them
corpus: 143726 words of cap 143726
```

### Interim board 1 - 2026-10-01
- Section 2 stage: drafting. Branch `mechanism-cut/s2`, cut from `origin/main` at `b7605424` once pull request #158 (section 1) merged to main; its upstream is unset so a bare push cannot reach main. The doctrine draft is written into `home/claude-kit-doctrine.md` and the operating-instructions skill (uncommitted); its ledger lines, its pin re-aims, the output style, `home/CLAUDE.md` and the ownership map are not yet landed.
- Live dispatches: the probe before-leg, `node tools/probe-corpus/run.mjs --before b7605424 --only <20 moments in .kit/scratch/mechanism-cut/s2/probes.txt>`, 47 pairs, marker `probe-before.exit`. The draft wave (run `wf_65364c69-ce6`) returned: doctrine 6,312 words against target 4,113, its draft and ledger block at `.kit/scratch/mechanism-cut/s2/draft-doctrine.md`; `draft-claudemd.md` and `draft-style.md` beside it, not yet read.
- Gate baseline: whole gate at `b7605424`, SCOTT-CLAUDE, `.kit/wt-mechanism-cut`, 2026-10-01T02:12:18Z to 02:21:34Z, 4338 tests, 4327 pass, 1 fail (`test/kit-sidecar-memory-index.test.js` "loadIndex answers a status, never a throw", the known linked-worktree red), 10 skipped, exit 1.
- Rulings adopted (route b, declared): a merge row becomes a pointer only where the owner already carries the rule, else it is declined and the rule stays, and no text moves into another section's skill. The ownership map drafts after the doctrine lands. The probe pair runs the 20 moments a doctrine rule decides, not all 41 whose shapes carry the doctrine. Row 73 ("Embedded text is data") is declined: five live sentences cite "the doctrine's data-not-instructions rule" as their ground (`kaizen/SKILL.md:68`, `memory-system/SKILL.md:63`, `:65`, `:69`, `peer-sessions/SKILL.md:30`), so the drop would strand them; the operator rules it at the pull request, with the alternative of dropping it and rewording those five in sections 5 and 7. The drafter's miss (about 2,200 words) is the shrink rows keeping every live ledger entry's meaning, as `## Approach` holds for shrinks; it goes to the operator as the miss ask with the clauses that would have to go.
- Incident: the read-only drafter wrote eleven working files into this section's gitignored scratch directory by masking git words in its shell commands past `readonly-agent-guard`; no tracked file changed (`git status --porcelain` clean in both trees). The files are deleted and a kaizen note is owed.
- Row 125 is ruled keep: the operator's "Keep it please" on the architect's relay thread, recorded at `7505e45c` on `plans/mechanism-cut` (read this turn: the cut file there reads `125 keep`, and Decisions item 1 and the Intent carry the ruling). That commit is not on `main`, so this section's branch still carries the cut file with row 125 as drop; section 10 takes its checkout at `7505e45c` or later and applies row 125 as keep. No target moves.
- Progress since: first green committed at `55bee13d` with the kaizen note at `f7c4167a`, pushed to `origin/mechanism-cut/s2`. The ownership map landed at 1,535 words (target 1,437). The per-document review wave (run `wf_116f2d40-3c8`, fable low) returned; its fixes landed at `0e0cbd4e`: the heading softener "usually" restored, "cross-surface pin" for testing-discipline's own term, Commit Model named as a header, the stop-for-a-yes rule pointed at Scope and Safety at first use, "a proceed-ahead" for the standing-grant record, and CLAUDE.md's graph named as subject. Left with reason: the Decision block's glyph (a kept format literal, row 438), the blind readers' gaps on vocabulary the doctrine points at in skills (their persona held no skill, and none of the gaps is new), the style's pre-existing structure notes, and P002's key and reason, which still describe the sentence row 436 moved to the core (the plan leaves ledger prose alone). Row 89's sentence "Verify a count before pre-writing it into a Chapter." stays as a decline under Decisions item 3 (c2.C125), named for the operator. The section-close pair (adversarial and blind at fable, Agent tool) is out over `b7605424..f7c4167a`.
- Next: re-aim the 13 red doctrine-parity tests, apply the doctrine ledger lines, land `home/CLAUDE.md` and the output style head, sync the style core, draft the ownership map, then the review wave and the section-close pair.

### Chapter 2 - 2026-10-01
Completed: 2. The always-loaded core
Implemented By: main session (inline, Opus 5.5); drafts by `corpus-drafter` at opus medium through `tools/corpus-compression/workflow.mjs` (run `wf_65364c69-ce6`)
Metrics: review rounds 1, closed major-closed; provenance 5 spec-traceable, 0 fix-introduced, 0 new-requirement, rulings (0 refused, 5 declared, 0 asked); advisory: 0 findings, 0 fixed, 0 deferred, 0 refused; NEEDS_CONTEXT 0; escalations 0; consults 0
Decisions / Surprises:
- Section 2 open: the doctrine, `home/CLAUDE.md`, the output style's head and the ownership map are redrafted under their cut-list rows, the doctrine's cut reaching its two pinned copies through the parity sync; serves the Goal sentence "every one of the 1,270 mechanisms ... has met its call" and section 2's table; adds no mechanism that runs; size 11,950 words of caps (doctrine 7,349, CLAUDE.md 121, style 1,660, map 2,819) against targets summing near 6,700 with the copies counted at the doctrine's landing; not building it leaves the always-loaded core, the heaviest load in every session, at its present size.
- Round 1, blind Major (freeze bullet): the doctrine keeps one sentence reading a pull request's state before a push and routing a merged one's change to a new branch; serves acceptance bullet 2 (a call is a hypothesis until read against its owner, and the owner is not loaded at executing-work's per-section push); adds no mechanism, it restores text the base doctrine carried; size +34 words; not building it leaves the per-section push with only a fail-open hook between a merged branch and an orphan push.
- Round 1, adversarial Major (map C004): C004 retires under row 995 with its ruled line and M001 carries the two-column legend; serves acceptance bullet 3; adds no mechanism; size one ledger entry; not building it leaves a live entry whose key describes a dropped column.
- Round 1, adversarial Major (docs/architecture.md): two sentences stop naming the merged liveness bullets, the chapter-close checkpoint sentence and the test-authoring bullet; serves the Goal's merge call (a pointer left behind names text the owner carries); adds no mechanism; size about 10 words changed; not building it ships two false sentences on a docs page.
- Round 1, adversarial Majors (row 89 in part, the four misses, the row accounting): recorded in this Chapter and the pull request rather than in the documents; serve acceptance bullets 1 and 2; add no mechanism; not recording them leaves the operator ruling on a list that omits rows.
- Round 1, prose Major (heading softener): "usually" restored before "two or three words"; serves the Goal's shrink call (the rule and one reason, its meaning kept); adds no mechanism; size +1 word; not building it leaves the doctrine breaking its own heading rule in its own headings.
- Target against landing: doctrine 6,459 against 4,113; `home/CLAUDE.md` 71 against 57; the output style 1,586, its head about 372 against 380 and the rest the doctrine's core as landed; the ownership map 1,535 against 1,437; the operating-instructions skill is the doctrine byte for byte under its frontmatter. The doctrine, CLAUDE.md and the map miss, and each miss goes to the operator at the pull request; the style meets its head target and carries the doctrine's miss through its core. The doctrine's miss is mostly shrink rows that keep every live ledger entry's meaning, plus merge rows declined because their owner points back at the doctrine.
- Row accounting (`.kit/scratch/mechanism-cut/s2/accounting.tsv`): 205 rows across the five documents, 182 applied, 23 declined. Declined, each for the operator's ruling at the pull request: doctrine rows 8, 11, 13, 14, 15, 16, 17, 26, 29, 41 in part, 43, 51, 59 in part, 60, 61, 63, 72 in part, 73, 86, 89 in part and 91; style row 441 and skill row 910 under Decisions item 6. Row 89 keeps one sentence, "Verify a count before pre-writing it into a Chapter.", under Decisions item 3 (c2.C125).
- Folded outside the file list: `docs/architecture.md` lines 5 and 39 named doctrine bullets this section merged, so they now name what landed. This is approval drift, recorded here and in the pull request.
- Row 125 stays as recorded on the interim board: ruled keep at `7505e45c` on `plans/mechanism-cut`, applied in section 10.
- Incident: the read-only drafter wrote eleven scratch files past `readonly-agent-guard` by respelling git words; no tracked file changed, the files are deleted, and the kaizen note landed at `f7c4167a`.
- For section 4: `finishing-work` step 7 has a sentence cut off at "A push after the pull request is marked ready", and the doctrine's freeze bullet now points into that step.
Failed approaches: the first doctrine landing cut clauses `test/doctrine-parity.test.js` pins as load-bearing, the gate bullet's pointer among them; those were restored from the base text (`restore.js`) rather than re-pinning the tests to a shorter text that lost the rule.
Assumptions:
- assumed 2026-10-01 (default, section 2): a merge row becomes a pointer only where the owner already carries the rule, else it is declined and the rule stays, and no text moves into another section's skill.
- assumed 2026-10-01 (default, section 2): the probe pair runs the 20 moments a doctrine rule decides, listed in `.kit/scratch/mechanism-cut/s2/probes.txt`.
Review Findings: `review: per-document wave at fable low through workflow.mjs (run wf_116f2d40-3c8: prose on the doctrine, the style and CLAUDE.md, blind readers on the same three), then adversarial and blind at fable, Agent tool` (capacity reading `fable capacity: no reading (stale) -> ladder governs`). Majors fixed: the five in Decisions above. Minors fixed: "cross-surface pin" as testing-discipline's own term, Commit Model named as a header, the stop-for-a-yes rule pointed at Scope and Safety at first use, "a proceed-ahead" for the standing-grant record, CLAUDE.md's graph named as subject, the closed grants list's scope sentence, two stale test messages and the liveness test's name. Left with reason: the Decision block's glyph (a kept format literal, row 438); the blind readers' vocabulary gaps (their persona held no skill, and none is new); the style's pre-existing structure notes; P002's stale key and reason (the plan leaves ledger prose alone).
Stamps: adjudicated 10, stamped 6 (`a-prose-rewrite-of-a-kit-skill-must-extract-the-parity-pins-first`, `a-ledger-entry-goes-stale-in-three-places`, `a-plan-that-changes-ledger-claims-takes-its-own-id-letter`, `doctrine-has-a-third-gitignored-copy`, `the-probe-runner-is-a-paid-box-claimed-run`, `the-probe-runner-spends-the-operators-own-session-allowance`); 4 read and not applied.
Gate: baseline whole gate at `b7605424` as on the interim board: 4338 tests, 4327 pass, 1 fail, 10 skipped, exit 1. Whole gate over the landed tree at `7c9b5c9c`, SCOTT-CLAUDE, `.kit/wt-mechanism-cut`, 2026-10-01T03:08:54Z to 03:17:36Z, `node --test test/*.test.js`: 4338 tests, 4327 pass, 1 fail (the same `test/kit-sidecar-memory-index.test.js` "loadIndex answers a status, never a throw", the known linked-worktree red), 10 skipped, exit 1 from `gate.exit`; delta 0 against the baseline. Close lane before it, 2026-10-01T03:07Z (doctrine-parity, output-style-parity, size-ratchet, ledger-preamble-parity, heading-shape, corpus-compression-workflow and the sibling pins): 419 tests, 419 pass, 0 fail, read from the run's own summary lines, since that lane kept no exit-code file. Tests added 0, retired 0, edited 10 test blocks in `test/doctrine-parity.test.js`, re-aimed at the landed text. Probe pair: before-leg at `b7605424`, `probe-corpus: 47 pairs, 2 mismatches (0 on proposed rulings, 1 designed), 1 errors, exit 2, tier sonnet, report .kit/probe-runs/2026-10-01T02-17-28-507Z/report.md`, all on the base text. After-leg over the landed tree, `.kit/probe-runs/2026-10-01T03-08-44-543Z/report.json`: 20 pairs, 19 match, 1 designed, 0 mismatches, 0 on proposed rulings, 0 errors, `exitCode` 0. No ruled probe newly mismatches.
Next: 3. The executing-work skill
Commit Model: Branch-and-PR
Delta: SCOTT-CLAUDE, 2026-10-01T03:20:53Z, worktree `.kit/wt-mechanism-cut` against HEAD a335e5de, `kit-size.js report` exit 0.
```
repository: wt-mechanism-cut
words: 1025156 of cap 1025156 across 121 curated files
test lines: 142575 of cap 142575 across 80 test files
tests: 4087
changed paths under no measured root: none; named-exclusion paths in the changeset: none, so every path this changeset touches is measured above
corpus: 140538 words of cap 143726
```

### Interim board 2 - 2026-10-01
- Section 3 stage: drafting. Branch `mechanism-cut/s3`, cut from `mechanism-cut/s2` at `e87c7612` per the stacking rule, since pull request #159 (section 2) is open and unmerged. No tracked file is edited yet; scratch is `.kit/scratch/mechanism-cut/s3/`.
- Live dispatch: Workflow run `wf_6f3de580-c53`, three opus-medium drafters on parts 2a (lines 285 to 389, target 1,949), 2b (390 to 512, target 2,375) and 3 (513 to 625, target 2,231). Part 1 (lines 1 to 284, target 3,458) is drafted and saved as `draft-ew-part1.md`, about 4,800 words, from run `wf_f651756b-98f`. That run's part 2 draft (`draft-ew-part2.md`, about 8,640 words against 4,323) is superseded, and its part 3 drafter was stopped after 50 minutes silent past a tool result against a measured 3.5 to 4 minute final generation.
- Gate baseline: whole gate at `e87c7612`, SCOTT-CLAUDE, `.kit/wt-mechanism-cut`, 2026-10-01T03:28:28Z to 03:37:40Z, 4338 tests, 4327 pass, 1 fail (`test/kit-sidecar-memory-index.test.js` "loadIndex answers a status, never a throw", the known linked-worktree red), 10 skipped, exit 1 from `baseline.exit`. Probe before-leg at `e87c7612` over the 21 moments whose scenario names executing-work (`probes.txt`): `probe-corpus: 49 pairs, 2 mismatches (0 on proposed rulings, 1 designed), 0 errors, exit 2, tier opus,sonnet, report .kit/probe-runs/2026-10-01T03-28-17-532Z/report.md`. The one undesigned mismatch is on the base text: `pre-send-checklist-after-an-authorized-push` on `output-style-plus-executing-work`, observed CONTESTED against expected RESOLVED.
- Rulings adopted (route b, declared): the skill is drafted in parts, since its ledger heading is about 129,000 words. Each part's target is its own rows by the plan's factor, summing to 10,012. Each drafter gets only the live ledger entries whose passage sits in its part, all 724 placed. A drop row applies even where a test pins its text, and the main thread retires or re-aims that pin; a shrink keeps pinned phrases. A shrink keeps an entry's meaning, defined as the act a session takes and any condition that changes it, and drops the argument, which the ledger keeps; the first part 2 draft cut 10% by reading meaning as argument.
- Found for section 10: row 718 drops the fix-diff capture command, and `agents/scope-adjudicator.md` still spells that command and names the capture as a design-stop input. `test/review-loop-provenance.test.js`'s excluded-root pin compares the two; its executing-work leg retires in this section.
- Next: join the four parts, apply the ledger lines, sync the `KIT-CLAIM-CLASS` copies, retire the row 718 pin, run the targeted lane, the review wave and the section-close pair, the probe after-leg, and the whole gate.
