# Process-rule repairs: amendments reach every path, wedges get a liveness predicate, outlines before whole files

Status: In Progress
Commit Model: Commit-and-Push
Created: 2026-08-22

## Goal

Three process rules in the kit's skills and doctrine have observed gaps, two captured as kaizen notes from the shared-tier authoring run and one adopted from the Warden-AI evaluation (candidate 1, decided 2026-08-22). When this plan is done: a plan doc's Standing Brief Amendments block binds every execution path including the one that takes no dispatch; a dispatch that wedges silently (running forever, writing nothing) has a defined detection and exit instead of an indefinite stall; and sessions everywhere open large files through a cheap outline instead of reading thousands of lines to find one function.

## Approach

All three sections are behavior-shaping prose edits to skills and doctrine, so every section runs inline under the writing-skills discipline (the main session's judgment is the tool; there is no code to dispatch). A contract-surface sweep ran 2026-08-22 before this spec was written; each section's Files in scope is derived from it. Line anchors below are as of commit 872089b and may drift; re-locate by content, not by number.

**Section 1 evidence.** The friction, verbatim from the kaizen note it promotes: "A plan doc's `Standing Brief Amendments` block reaches implementers only, because `executing-work` folds it into dispatch briefs and nothing puts it in front of the orchestrator. So a section running `Locus: inline`, which the same skill routes to the main thread whenever it writes under `docs/`, executes without ever reading the amendments its own plan carries. The shared-tier authoring plan's section 3 reproduced Amendment 7's exact class, an absolute that overreaches, in four consecutive review rounds, with the amendment sitting unread a few hundred lines up the same file. The general shape is that any plan-doc block delivered only through a dispatch is invisible on the one path that takes no dispatch, and the orchestrator is the reader most likely to assume it has already absorbed the document it is executing." The sweep found the mechanism's surfaces: the read side is `executing-work/SKILL.md:113` (the dispatch-brief slot: "Standing Brief Amendments: every entry from the plan doc's block, when one exists") and the four implementer charters (`implementer-sonnet.md:13`, `implementer-opus.md:13`, `implementer-fable.md:12`, `implementer-haiku.md:12`); the write side is `executing-work/SKILL.md:225`. Two scoping facts the sweep established: the block has no row in curating-docs' plan-doc machine contract, so changing its delivery needs no engine-side coordination; and `finishing-work/SKILL.md` never mentions amendments at all, which stays out of scope here (see Out of Scope).

**Section 2 evidence.** The friction, verbatim from the kaizen note it promotes: "The `finishing-work` unavailability rule keys the whole compensation path on an error: it says to confirm a model is unreachable 'from an actual dispatch failure', to 'attempt the override and read the error', and it names a quiet model substitution as the one silent variant to watch for. Exhausting an account's Fable allotment mid-run produces neither. The dispatch is created and wedges waiting on a usage-credit authorization, writing nothing, while `TaskOutput` reports `running` indefinitely, which is exactly what a healthy long review reports; three finishing-gate reviewers held that state for 4.7 hours with 0-byte transcripts before the operator named the hallmark. Because no error ever arrives, the rule's compensated re-dispatch never triggers and the run has no defined exit. The general shape is that a rule keyed on a failure *signal* is blind to the failure mode that produces silence, so the kit needs a liveness predicate a wedged dispatch actually fails, transcript byte growth being the one that discriminated here, rather than a harness status that reads identically either way." Corroboration: the outcome journal holds `kit.review.fable-dispatch` (fail: "Fable exhaustion wedges a dispatch: 0-byte transcript, status running for hours; TaskStop and redispatch at opus/max") and the operator tier holds `fable-limit-can-exhaust-mid-run`. The sweep found the rule's owner and its restatements: `finishing-work/SKILL.md:14` (owner, exact trigger wording), `:16` (compensation mechanics), `:18` (bare fallback), `:20` (recording); restated or pointed at from `executing-work/SKILL.md:172` and `:203` and `consult/SKILL.md:37`; summarized at `docs/architecture.md:21` ("two states rather than one"). No test pins exist for this rule.

**Section 3 evidence.** The outline-first rule was validated against three codebases on 2026-08-22 before adoption. NEO (`D:\Neuro-Evolution-Operations`): `ApiClient.cs` (4,347 lines) yields 24 semantic `#region` labels carrying spec cross-references plus 202 member signatures; `GenerationAdvancer.cs` (2,128 lines) yields 15 narrative regions. The kit's own `memq.js` (8,700 lines, no regions): 157 named top-level declarations, 1.8 percent of the file's bulk. ASR (`D:\Temp\ASR.Eleos`): `GeotabService.cs` (3,290 lines) yields 20 regions (mixed generic and semantic) plus 106 signatures; the 1,303-line `ELEOS.usp_ProcessTmsForm.sql` outlines on banner comments whose label rides the line after the border; `Reference.cs` (11,756 lines) self-identifies as `<auto-generated>` in its header; a 71k-line vendor install script yields 201 object anchors under an indent-tolerant pattern. Three pattern refinements came out of the ASR probe and are folded into the rule below: filter C# field-initializer noise, capture the SQL banner label from the border's next line where the border line carries no text, and detect the auto-generated header. The sweep found the rule's home and neighbors: the doctrine's "Don't waste your own moves" bullet (`operating-instructions/SKILL.md:164` and its byte-identical mirror `home/claude-kit-doctrine.md:159`, whole-body identity pinned by `test/doctrine-parity.test.js:58`); the implementer charters' file-reading slot ("Read the files in scope and their nearest siblings", `implementer-sonnet.md:19`, `implementer-opus.md:19`, `implementer-fable.md:18`; haiku's variant reads one named sibling and is exempt); `executing-work/SKILL.md:91` (the lightweight in-session read) and `:98` (the brief's Files in scope slot). The output style deliberately does not carry this doctrine neighborhood (confirmed: no "waste your own moves" in `output-styles/kit.md`), so the style is not a surface here.

## Sections of Work

### 1. The Standing Brief Amendments block binds every execution path

Model: opus
Locus: inline

Amend `executing-work/SKILL.md` so the orchestrator itself reads the plan's Standing Brief Amendments block, not only folds it into briefs. The rule to add, placed in step 1 immediately after the lightweight in-session read paragraph (:91) and above the tier and locus material (:164), so it precedes both loci: before writing anything for a section, whatever its locus, re-read the plan doc's Standing Brief Amendments block and hold every entry as binding on this section's work; an inline section has no brief for the block to fold into, so this read is the only delivery that path gets. Word it per the writing-skills bar (state the rule once, at the moment it fires, naming the failure it prevents: the orchestrator is the reader most likely to assume it has already absorbed the document it is executing). The existing dispatch-brief slot at :113 and the write-side rule at :225 stay; add a cross-pointer from :225 so the write side names both deliveries (folded into briefs, and re-read by the orchestrator at each section open).

Acceptance: `executing-work/SKILL.md` states the orchestrator-read rule at the section-open point; the inline-locus path is explicitly named as covered; :113 and :225 remain consistent with it; no other surface contradicts it (grep `Standing Brief Amendments` across the tree and read each hit).

Files in scope: `plugins/claude-kit/skills/executing-work/SKILL.md`.

### 2. A liveness predicate for the silently wedged dispatch

Model: opus
Locus: inline

Amend the unavailability rule so its trigger covers the failure mode that produces silence. In `finishing-work/SKILL.md` (the owner, :14): unavailability is confirmed from an actual dispatch failure, or from the wedge hallmark, which is a dispatch whose status reads `running` while its transcript or output artifact shows no growth across an observation window; a dispatch that never wrote a byte and one that wrote and then froze fail the predicate alike. The hallmark is general to every dispatch class; the window is per class: 15 minutes for reviewer-class dispatches (the reviewers, the readers, the consultant; a healthy one writes within minutes of starting), and for other classes a bound the session sets from the work's expected cadence, erring long, because a single long inference produces no transcript growth until it returns and an implementer mid-thought is not a wedge. On the hallmark: probe the agent with a message first (the doctrine's probe-before-kill rule; a starved agent answers at once and a wedged one cannot), and only when silence survives the probe, TaskStop the dispatch and take the compensated route exactly as an error-confirmed unavailability does. The recording rule at :20 extends to name which trigger fired, error or hallmark. Update the restatement sites to match: `consult/SKILL.md:37` and `executing-work/SKILL.md:172` and `:203` currently restate the error-only trigger verbatim; reduce each to a pointer at the owner where the surrounding sentence allows, or update the trigger phrase to "a dispatch failure, or the liveness hallmark finishing-work defines" where a pointer alone would leave the sentence unreadable. Check `docs/architecture.md:21` for contradiction (its "two states" sentence describes the compensation, not the trigger; touch it only if it now reads false).

Acceptance: finishing-work states both triggers, the no-growth predicate in its general form, the probe step, the per-class window rule with the reviewer-class number, and the extended recording rule; no surface still states the error-only trigger as the whole rule (grep `actual dispatch failure` and read each hit); the single-owner discipline holds (restatements reduced to pointers or updated in the same round).

Files in scope: `plugins/claude-kit/skills/finishing-work/SKILL.md`, `plugins/claude-kit/skills/executing-work/SKILL.md`, `plugins/claude-kit/skills/consult/SKILL.md`, `docs/architecture.md` (verify-only unless false).

### 3. Outline-first reading of large files

Model: opus
Locus: inline

Add the rule to the doctrine's "Don't waste your own moves" neighborhood, landing byte-identically in both copies (`operating-instructions/SKILL.md` and `home/claude-kit-doctrine.md`; `test/doctrine-parity.test.js` enforces the identity, so an edit to one alone is a red). The rule, compressed to one doctrine-sized bullet carrying: for a file over roughly 1,000 lines, grep an outline first, declarations and region or banner labels with their line numbers, then read the named range; and the two guardrails, verbatim in substance: an outline chooses where to read first and never proves absence, so a not-found after an outline-guided read still gets a whole-file search for the symbol before any absence claim; and an implausibly thin outline for the file's size, or an `<auto-generated>` header in the first lines, means the file does not fit the pattern, so read it directly or grep for the member. The pattern set rides inside the bullet, compact, transcribed in substance from the validated patterns in this section's References rather than re-derived: C# member signatures excluding property and field-initializer noise, plus `#region` labels verbatim (they carry author intent and spec cross-references); SQL banner comments, taking the label from the border's next line where the border line carries no text, plus indent-tolerant `CREATE`/`ALTER` and `GO`; JS/TS top-level `function`/`class`/`const` declarations. The patterns are tunable on evidence: the first codebase where an outline misleads extends the pattern set, not the rule. Then attach the habit at the two reading slots the sweep found: one clause in the three non-haiku implementer charters' "Read the files in scope and their nearest siblings" line (outline first for large files, per the doctrine rule), and one clause in `executing-work/SKILL.md:91`'s lightweight-read framing. The haiku charter is exempt (it mirrors one named sibling and reads nothing else).

Acceptance: both doctrine copies carry the identical bullet and `node --test test/doctrine-parity.test.js` passes; the three charters and executing-work carry the attachment clause; the guardrail sentences and the pattern guidance appear in the doctrine bullet in substance, matching the References patterns; the output style is untouched.

Files in scope: `plugins/claude-kit/skills/operating-instructions/SKILL.md`, `home/claude-kit-doctrine.md`, `plugins/claude-kit/agents/implementer-sonnet.md`, `plugins/claude-kit/agents/implementer-opus.md`, `plugins/claude-kit/agents/implementer-fable.md`, `plugins/claude-kit/skills/executing-work/SKILL.md`, `test/doctrine-parity.test.js` (run, not edit).

References: the validated outline patterns, as run on 2026-08-22 against NEO, ASR.Eleos, and the kit's own memq.js. C# regions: `^\s*#region` with the label being the rest of the line. C# members: `^\s*(public|private|protected|internal).*\(` excluding lines containing `= ` before the paren and lines containing `{ get`. SQL structure: `^\s*(-{3,}|/\*{3,}|CREATE |ALTER |GO\s*$)` with `CREATE`/`ALTER` matched indent-tolerantly, and a banner border line carrying no prose taking its label from the following line. JS/TS: `^(function|async function|class|const) `. Generated-file detection: `<auto-generated>` within a file's first five lines.

## Out of Scope

- Finishing-work handling of a plan's open amendments (the sweep found the absence; it is adjacent to section 1's gap, not the same gap, and finishing reviewers already read the plan doc whole).
- Any propagation of the outline rule into the output style (the bullet's neighborhood is deliberately outside the register core the style carries).
- Any new tool, CLI, or index for outlines (the Warden candidate's expensive shape was parked 2026-08-22 on the NEO evidence; see `claude-kit_warden-adoption-candidates_notes_v1.md`).
- A mechanical watcher for wedged dispatches (section 2 is a judgment rule for the session, not new machinery).
- The curating-docs machine contract (the amendments block is deliberately outside it).

## Assumptions

- assumed 2026-08-22 (default): the wedge bound is 15 minutes at zero transcript growth for reviewer-class dispatches; reversal: one number in finishing-work.
- assumed 2026-08-22 (source: the 2026-08-22 contract sweep; curating-docs' machine contract carries no amendments row): changing amendment delivery needs no engine-side coordination; reversal: none, the block is kit-only convention.
- assumed 2026-08-22 (default): the outline trigger threshold is roughly 1,000 lines; reversal: one number in the doctrine bullet.
- assumed 2026-08-22 (default): all sections inline, because behavior-shaping skill and doctrine wording wants the session's own judgment under the writing-skills discipline rather than a briefed dispatch; reversal: add a dispatch locus per section.

## Open Questions

None. Both kaizen notes were promoted whole; their inbox lines were cleared when this spec landed.

## Related

- `claude-kit_warden-adoption-candidates_notes_v1.md` (candidate 1's evidence and disposition; candidate 2 parked).
- `../archive/claude-kit_shared-tier-authoring_spec_v1.md` (the run that produced both kaizen notes; its Chapter 4 records the wedge incident).

## Chapters
