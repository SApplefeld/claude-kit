# Claude-Kit Reviewer Effort Compensation

Status: Complete
Commit Model: Commit-and-Push
Fable Spend: finishing reviews
Created: 2026-08-11

## Goal

A review pass holds its quality when the model tier under it drops. Today the kit compensates for an unreachable or exhausted Fable by falling back to the session model at whatever effort the agent definition happens to pin, which is a silent downgrade of the strongest gate in the system. When this is done, every reviewer dispatch carries an effort chosen for the model it runs at and for whether that model is the intended tier or a stand-in: Fable reviews at `high`, Opus reviews at `xhigh` when Opus is the tier we aimed at, and Opus reviews at `max` when it is covering for a Fable that is gone. A session that has run out of Fable gets a compensated gate instead of a quietly weaker one.

The same pass settles effort on four agent definitions: two that carried no effort field at all and therefore inherited whatever the session was set to (the security reviewer and the top implementer tier), and two whose pinned value moves (the per-section reviewer pair). Five definitions carried no effort field before this change; three still do, deliberately.

## Related

- Revises `docs/archive/claude-kit_backlog-sweep_spec_v1.md`, which shipped the original six effort dials and the rule that a reviewer pair runs one model tier above the section's writer. That rule stands; this plan pairs an effort with whatever model it lands on, and retires the note's own flagged-as-most-likely-wrong claim that the finishing gate riding fable-at-medium was acceptable.
- Depends on `docs/archive/claude-kit_readonly-agent-guard_spec_v1.md`. That guard keys its policy class on the agent type in the PreToolUse payload, which is exactly what makes a Workflow dispatch safe when it names an `agentType` and unsafe when it does not. The whole Workflow route rests on that keying.

## Approach

### The compensation rule

Effort is a function of two inputs: the model the reviewer actually runs at, and whether that model is the tier the work was aimed at or a substitute standing in for a higher one.

Every model has a standard judgment-work effort, the level at which open-ended evaluation is worth paying for. Well-scoped work runs below it, which is where the implementers already sit at `medium`.

| Reviewer dispatch | Model | Effort | How it is set |
|---|---|---|---|
| Fable, as the intended tier | fable | `high` | frontmatter default, no override |
| Opus, as the intended tier (a sonnet-written section bumped one tier) | opus | `xhigh` | per-dispatch override |
| Opus, substituting for an unreachable Fable | opus | `max` | per-dispatch override |
| Any model capped by a recorded `Fable Spend: none (cost hold)` | session model | frontmatter default | no override |
| Any other pairing | as the model rules set it | frontmatter default | no override |

**Amended during section 2's review, and this table is the as-built one.** The first draft carried a fifth row reading "Sonnet, as the intended tier | sonnet | `high`", which was invented rather than derived and broke the calibration principle: it made a weaker model take less effort than a stronger one, leaving a reader no rule to derive an unnamed pairing from. It also carried no cost-hold row, which is the defect both reviewers found independently, and whose only readable interpretation raised effort above the uncapped path. Both are corrected above and in the shipped rule.

The third row is the compensation, and it is why this is not a plain model-to-effort lookup. Standard Opus judgment work is `xhigh`. Opus standing in for Fable climbs one further notch to `max`, because `max` is the closest this account can reach to Fable-at-`high` once Fable is gone. The tier drop costs review depth; the extra notch buys back what it can.

Note what the rule never produces: **Fable at `max`**. Fable's own judgment level is `high`, and `max` exists here only as the substitution notch for the model one tier below it.

### The compensation notch is scoped to judgment work

The substitution notch applies to reviewers and other judgment-heavy dispatches, never to implementation. A section tiered `fable` whose implementer runs at Opus because Fable is unreachable stays at `implementer-fable`'s pinned `high`. It climbs to neither `xhigh` nor `max`.

Two reasons, and the first is the load-bearing one.

**The failure modes surface differently.** An under-powered reviewer fails silently: the finding it never raises leaves no trace, nothing downstream catches the miss, and the gate reports green either way. An under-powered implementer fails loudly into a review round that already exists, and `executing-work` step 1 already carries the ladder for it, up to the rule that a fable-tier section which has exhausted its tier is raised to Scott rather than quietly downgraded into a weaker main thread. Compensation belongs to the gate that has no backstop; implementation already has one.

**The direction of the error is opposite.** Effort above what the work needs makes an implementer deviate from a settled plan and chase problems that are not there, which is the observation behind pinning the orchestrator and the sub-fable implementers at `medium`. For a reviewer, surplus effort buys recall on an open-ended search. For a plan-following implementer, it buys tangents. So the notch that helps one actively harms the other, and a rule that applied it uniformly would degrade exactly the dispatches it was meant to protect.

### Why the static default sits at `high`

Across the 138 sections in `docs/archive/`, tier assignments run fable 64, opus 45, sonnet 26, inline 2, haiku 1. Applying the existing tier-bump rule (the reviewer pair runs one model tier above the writer, fable reviewing fable) yields roughly 111 fable-model reviewer dispatches against 26 opus-model ones on a Fable-reachable session. The common case therefore wants `high`, which frontmatter can supply for free, and the `xhigh` case is the exception that carries an override. When Fable is exhausted every one of those 111 becomes an Opus dispatch and takes the override, which is precisely the situation this plan exists to serve.

### Why the override has to go through Workflow

Three surfaces control a subagent's model and effort, and only one can set effort at dispatch time:

- The **Agent tool** takes a per-dispatch `model` override and has no effort parameter at all.
- **Subagent frontmatter** takes a static `effort`, so one definition cannot hold both `high` and `xhigh`.
- **`Workflow`'s `agent()`** takes `model`, `effort`, and `agentType` per call.

Confirmed by probe on 2026-08-11: dispatching `agent({agentType: 'claude-kit:adversarial-reviewer', model: 'opus', effort: 'max'})` runs `claude-opus-5` at effort `max` (read from the run's `agent-<id>.jsonl`, which records the resolved model and effort per turn) and remains fully governed by `readonly-agent-guard.js`, which blocked a `git stash list` with the standard message naming the agent type. The same agent dispatched with no overrides used its frontmatter `medium`, so frontmatter and per-call overrides compose rather than one clobbering the other. A workflow agent dispatched with no `agentType` presents as `workflow-subagent`, which the guard does not govern.

Two design consequences follow. Reviewer dispatches that need `xhigh` route through Workflow with an explicit `agentType`; and no reviewer is ever dispatched through Workflow without one, because that is the shape that leaves the tree unguarded.

### Rejected alternatives

- **Duplicate reviewer definitions pinned at opus/xhigh.** The read-only guard's agent-class regex is anchored at the end of the name, so `adversarial-reviewer-xhigh` resolves to no policy class and the strongest reviewer becomes the only one permitted to mutate the tree it reviews. Fixing that means editing a file under `hooks/`, which drags in the integrity-manifest rebuild. Rejected on blast radius.
- **Raising frontmatter to `xhigh` for everyone.** Correct for 26 dispatches and wrong for 111, and it puts Fable at an effort level with no observed benefit over `high`.
- **Routing every reviewer dispatch through Workflow.** Uniform and fully expressive, but it moves the tested common path (parallel pair dispatch, tree-state bracketing, the blind-reviewer's input restrictions) to serve a case frontmatter already covers.

### Verification constraint

The kit runs from an installed plugin cache, not from this repo's working tree, so an edit to `plugins/claude-kit/agents/*.md` does not change live dispatch behavior until the plugin is rebuilt and the cache carries it. Any acceptance criterion that claims a live effort value must name the build/install step that made the cache current, or be recorded as verified-by-file-content only. **Corrected during the finishing review, and the original claim was false:** `test/readonly-agent-guard.test.js:27` does read the `agents/` directory, and its case "the governed agents are granted no file-writing tool" parses every reviewer's and the qa-verifier's frontmatter from it. The conclusion drawn from the false premise happens to survive, because that assertion reads only the `tools:` line and these edits touch only `effort:`, but the premise was wrong and section 1's test-worthiness call rested on it. The honest statement: one test reads that directory and asserts on a field this changeset does not touch, so the edits are not expected to move the gate; capture the baseline anyway and diff against it.

## Standing Brief Amendments

- The gate is `node --test "test/*.test.js"`, quoted, from the repo root. Never the bare directory form, which discovers no files and produces a synthetic false red.
- Never write under `docs/`: the docs-write-guard denies a non-curator subagent that write. Return doc prose in the final message for the main thread to place, and do not route around the refusal with a shell copy, a redirect, or any other write path. A denial is the correct answer, not an obstacle.
- Editing any file under `plugins/claude-kit/hooks/` requires `./build.ps1` before the suite, or two hook-canary cases fail on a stale integrity manifest. No section here is expected to touch `hooks/`; if one turns out to need it, run the build before the gate.
- Behavior-shaping prose (skill text, agent descriptions) is changed under the `writing-skills` skill, RED/GREEN tested, never eyeballed.

## Sections of Work

### 1. Effort pins on the four agent definitions
Model: sonnet

Four one-line frontmatter changes in `plugins/claude-kit/agents/`:

- `adversarial-reviewer.md`: `effort: medium` becomes `effort: high`
- `blind-reviewer.md`: `effort: medium` becomes `effort: high`
- `security-reviewer.md`: gains `effort: high` (it has no effort line today and inherits the session)
- `implementer-fable.md`: gains `effort: high` (it has neither a `model:` nor an `effort:` line today, so the top implementer tier currently drifts with session effort)

`council-member.md` is deliberately left unpinned: it runs in-line during a brainstorm Scott is present for, so the session's own effort is the right call. `design-facilitator.md` and the sub-fable implementers are untouched.

Files: `plugins/claude-kit/agents/adversarial-reviewer.md`, `blind-reviewer.md`, `security-reviewer.md`, `implementer-fable.md`.
Acceptance: gate green against the baseline captured at execution start. The four files carry exactly the values above; `council-member.md`, `design-facilitator.md`, `implementer-opus.md`, `implementer-sonnet.md`, `implementer-haiku.md`, `qa-verifier.md`, and `docs-curator.md` are byte-identical to their pre-section state.
Tests: none warranted. The change is declarative frontmatter with no branch to lock, and no existing test reads `agents/`. Record that judgment rather than manufacturing a test.

### 2. The compensation rule in executing-work
Model: opus
Locus: inline

Load the `writing-skills` skill first; this is behavior-shaping prose.

`plugins/claude-kit/skills/executing-work/SKILL.md`, step 3 (Review), currently sets the reviewer pair's model one tier above the writer and says nothing about effort. It gains:

- A **markdown table** of the effort rows, placed after the model rules complete so nothing forward-references a case defined later. Prose carries the why; the table carries the lookup, per `writing-skills`' "tables for what gets scanned".
- The two generating questions stated under the table (which model does this reviewer actually run at, and is that model the tier we aimed at or a stand-in for one above it), plus the calibration principle that makes the rows derivable: effort matches the difficulty of the work under review, not model strength alone, because model and difficulty both come from the section's tier.
- **An explicit cost-hold row.** A model capped by a recorded `Fable Spend: none (cost hold)` takes its frontmatter default, never the substitution notch and never a Workflow dispatch. Without this row the function returns nothing for the kit's most common cost-control path, and its only readable interpretation raises effort above the uncapped path it replaced.
- The dispatch mechanics for the above-default cases, as a **REQUIRED-field template block** rather than a prose reminder, naming all three fields (`agentType`, `model`, `effort`) with the concrete failure each omission causes. `writing-skills`' form table says an omission failure takes a structural slot and that prose reminders backfire on exactly this shape.
- The harness-dependent claims pinned to `v2.1.205`, per `writing-skills`' antipattern against stating a harness fact unconditionally.
- A **pointer** to the doctrine's standing-dispatch bullet as the authorization, never a self-grant. Section 4 puts the grant in the doctrine, which is the operator's own instruction surface; a skill that granted itself a tool permission the doctrine scopes to the Agent tool alone would contradict the doctrine in two tracked files.
- Confirmation that the existing contracts survive the route change: `agentType` applies the named agent's frontmatter `tools:` list as well as its prompt, the blind-reviewer still receives the base ref or changed-file list only and never a captured diff, the tree-state capture still brackets the round, the round still dispatches in parallel, a Workflow round is awaited in-turn on `TaskOutput(task_id, block: true)`, and the reviewers are still never pre-judged.
- In step 1's tier-escalation bullet, a one-line prohibition that an implementer never takes the compensation notch, pointing at step 3 for the reasoning rather than restating it, and stating plainly that under an unreachable Fable the fable-tier ladder ends in a stall raise rather than implying coverage the ladder does not give.

Files: `plugins/claude-kit/skills/executing-work/SKILL.md`.
Acceptance: step 3 carries the effort table including its cost-hold row, the REQUIRED-field dispatch template, the version-pinned harness claims, and a pointer to the doctrine for the authorization; step 1 carries the implementer prohibition as a pointer; the blind-reviewer input contract and the tree-state bracketing are unchanged. Gate green against the recorded baseline.
Tests: RED/GREEN per `writing-skills`, which is the behavioral evidence, captured to `.kit/scratch/s2-redgreen.md`. RED: a probe given the pre-edit text must fail to produce any effort or dispatch route. GREEN: a probe given the shipped text must produce Opus/`xhigh` via Workflow for a sonnet-written section, the frontmatter default with no Workflow dispatch under a recorded cost hold, and Opus/`max` via Workflow when the fable dispatch errors. Several reps, since one sample lies.

### 3. The unavailability rewrite in finishing-work
Model: opus
Locus: inline

Load the `writing-skills` skill first; this is behavior-shaping prose.

`plugins/claude-kit/skills/finishing-work/SKILL.md` carries the fable-override default for steps 2 and 3 and the "Unavailable is not a cost hold" paragraph. Both change:

- The fable-override default gains its effort pairing (`high` at fable), so the finishing gate's dispatch is fully specified.
- The unavailability paragraph keeps its two load-bearing parts unchanged: attempt the override and read the actual dispatch error rather than assuming, and never file an unavailable Fable as a cost hold. What changes is the fallback itself. Instead of dropping to the session model at frontmatter effort and recording *reduced oversight*, it re-dispatches through Workflow at `model: 'opus', effort: 'max'` and records a *compensated* fallback: the tier dropped, the effort climbed the full substitution notch to cover it, and the Chapter and close-out say so with the verbatim error that triggered it. This is the Approach table's third row. It is **not** the only path that produces `max`: a per-section review round under an unreachable Fable reaches it by the same row, and Chapter 2 records that happening live. A uniqueness claim here would be the shape an agent uses to rule the notch out elsewhere, which is exactly the payload this plan installs, so the paragraph must not carry one. The bare fallback, which is what a session gets where the Workflow route itself is unavailable, is an Agent-tool dispatch at `model: 'opus'` carrying the reviewers' frontmatter effort: one tier down rather than two, since the Agent tool does take a model override and only the effort is out of reach.
- The recorded `Fable Spend: none (cost hold)` path is untouched: a cost hold still holds the reviews at the session model, because that is a decision Scott made rather than a gate failing to run. A cost hold therefore does not buy the compensation notch either, which is correct: nothing failed, so nothing needs covering.

Files: `plugins/claude-kit/skills/finishing-work/SKILL.md`.
Acceptance: a fresh session whose fable override errors re-dispatches the finishing adversarial and security reviews at Opus/`max` through Workflow and records a compensated fallback naming the verbatim error; the same session under a recorded cost hold does not. Gate green.
Tests: RED/GREEN per `writing-skills`, driven with a simulated dispatch failure. Prove it three directions, since the two Opus cases differ: an intended-tier Opus reviewer gets `xhigh`, an unavailable-Fable substitution gets `max`, and a recorded cost hold gets the session model with no Workflow dispatch at all.

### 4. Carry the Workflow authorization in the doctrine
Model: opus
Locus: inline

Load the `writing-skills` skill first; this is behavior-shaping prose, and it is the operator's own instruction surface rather than a skill's.

The doctrine's standing-dispatch bullet closes with "The request covers the Agent tool and nothing else; every other rule still binds." Section 2 needs a Workflow dispatch to be equally pre-authorized, and Scott granted exactly that on 2026-08-11 ("I think workflow is fine to utilize in this way, and it can have a standing authorization for it"). The grant belongs in the doctrine, not in the skill that benefits from it: a skill that widened its own tool permissions would contradict the doctrine in every tracked copy, and the scoping clause exists precisely to stop that expansion.

Amend the standing-dispatch bullet so the standing request covers the Workflow tool for the reviewer-effort dispatches that **both** the executing-work and finishing-work skills define, keeping the clause's shape: it still names what the request does and does not cover, and every other rule still binds. Scoping the grant to only one of the two skills was caught in section 3's review: finishing-work's compensated re-dispatch is a second site, and a grant naming only executing-work would leave the finishing gate with no visible authorization for the exact path this plan installs. A session may carry an injected `Do not use workflows or deep-research unless the user requested it` line, and this bullet is that request, exactly as it already is for the Agent tool.

The doctrine ships as two tracked copies that `test/doctrine-parity.test.js` pins byte-identical: `plugins/claude-kit/skills/operating-instructions/SKILL.md` (the source) and `home/claude-kit-doctrine.md` (the mirror). Both take the identical edit. `plugins/claude-kit/claude-kit-doctrine.md` is a gitignored build artifact and is not edited by hand. The amended bullet sits outside the `KIT-REGISTER-CORE` block, so `test/output-style-parity.test.js` and the output style are untouched; confirm that before editing rather than assuming it.

The grant's covered class is stated by this bullet, never delegated to skill content. A clause making the covered set equal to whatever the two skills say would re-open the self-grant path this section exists to close, since a later skill edit widening its own rule would then be authorized automatically instead of contradicting the doctrine. The skills say where and how; the doctrine says what is covered.

Files: `plugins/claude-kit/skills/operating-instructions/SKILL.md`, `home/claude-kit-doctrine.md`, `test/doctrine-parity.test.js`.
Acceptance: both copies carry the identical amended bullet; all three `doctrine-parity` tests pass; the `KIT-REGISTER-CORE` block is unchanged and `output-style-parity` passes; the skills' pointers resolve to a doctrine sentence that actually grants what they claim, and the granted class is defined by the doctrine's own predicate rather than by skill content. Gate green against the recorded baseline, adjusted for the added test.
Tests: **amended during execution, from section 4's own review.** The original line said the two existing parity tests were the mechanical gate and no new test was warranted. That was wrong in a way the review caught: `doctrine-parity`'s whole-body comparison passes a symmetric revert, so removing the Workflow grant from both copies would leave the suite green while two committed skills kept citing it. A third test pins the standing-dispatch bullet by its lead, asserting one occurrence per copy, cross-copy identity, and that the line still names both the Workflow grant and the `agentType` condition, following the precedent and the reasoning the file's existing memory-extension pin already documents. It is RED/GREEN proven: with the grant symmetrically removed the whole-body test still passes and the new pin fails. Full `writing-skills` RED/GREEN on the prose remains unwarranted for the reason originally given, and section 2's GREEN already exercises the dispatch the grant authorizes.

### 5. Record the findings and close the parked backlog item
Model: opus
Locus: inline (routing, not sizing: both deliverables are files under `docs/`, and `docs-write-guard.js` denies any governed subagent a write to a path carrying a `docs/` segment, so the write is the main thread's whatever tier the section would otherwise earn)

- `docs/security-model.md`: record that a kit agent dispatched through `Workflow`'s `agent({agentType})` retains the identity `readonly-agent-guard.js` keys on and is governed exactly as under an Agent-tool dispatch, and that a workflow agent dispatched without `agentType` is not governed. This is a property of the access model, so it belongs beside the guard's other invariants rather than in a plan Chapter.
- `docs/backlog.md`: the "effort dials and reviewer tiering in flight" item states that the per-section-versus-finishing effort split is blocked until a per-dispatch effort override appears on the Agent tool. That is still true of the Agent tool and beside the point: the override exists on Workflow. Update the item with the finding, mark the parts this plan closes, and leave the measurement question (do the new effort levels actually improve review quality) open against Chapter Metrics.
- `docs/backlog.md`, second item, a bonus carried out of band rather than left as a note: the "Env failure: memq-shim PATH-resolution tests fail" item asks for the two tests' full output to be captured before anyone touches them, and says the failure would not reproduce on the runs made to capture it. This effort's baseline run reproduced both and captured the assertion. Add the evidence to that item: the failure is a path-form mismatch, the long form of the user's home directory returned where that directory's 8.3 short name was expected, which points at short-name normalization rather than the PATHEXT or execution-policy causes the item currently speculates. Write it without the literal path: this repository is public, and a home directory spelling is environment recon that adds nothing to the diagnosis. Evidence only, no fix and no test change; undo is deleting the added sentences.

Files: `docs/security-model.md`, `docs/backlog.md`.
Acceptance: the security model states the governed and ungoverned Workflow dispatch shapes and that `agentType` carries the agent's tool restriction; the backlog's effort-dials item no longer claims the split is unreachable; the memq-shim item carries the captured assertion. Gate green against the recorded baseline.
Tests: none warranted; both files are curated prose with no mechanism behind them.

## Decisions

- **Security-reviewer pins `high`, not a flat `xhigh` (decided 2026-08-11).** It is a Fable-model reviewer at the finishing gate (where `finishing-work` dispatches it with the fable override) and an Opus-model one per-section (where it sits out the tier bump and takes the session model). Pinning `high` and letting the section-2 rule raise it to `xhigh` when it actually runs at Opus applies the effort function consistently instead of carving out an exception for one agent.
- **`implementer-fable` pins `high` (decided 2026-08-11).** Deliberately above the `medium` that well-scoped implementation work takes, because the fable tier is reserved for novel logic, security-sensitive surfaces, and subtle correctness rather than transcription against a settled pattern. Nothing in the kit runs an implementer above `high`.
- **`max` is reserved for substitution (decided 2026-08-11).** Standard Opus judgment work is `xhigh`; the extra notch to `max` is bought only by a tier drop. No path produces Fable at `max`.

## Open Questions

1. ~~**Commit model.**~~ **Answered 2026-08-11:** Commit-and-Push, on Scott's instruction ("commit and push please"). The header carries it, and every section commit landed on `main` and pushed as it closed.
2. **Whether these levels deliver.** The chosen levels are judgment against Scott's observations, not measurement: `high` for Fable judgment work, `xhigh` for Opus, `max` for the substitution. The measurement surface is Chapter Metrics (review rounds, findings quality, NEEDS_CONTEXT counts, escalations) diffed against the pre-change baseline, which is the same instrument the parked "effort dials and reviewer tiering" backlog item already watches. Revert is one frontmatter line per agent plus the table rows.

## Gate Baseline

Captured at execution start, before any edit, on `aeffbb2`: **692 tests, 690 pass, 2 fail, exit 1**. Both failures are in `test/memq-shim.test.js` (`PowerShell resolves memq.ps1, and that is what keeps an argument from starting a second command` and `a foreign memq winning name resolution is reported, never read as on-PATH`), and both are the pre-existing environment failure `docs/backlog.md` records under "Env failure: memq-shim PATH-resolution tests fail", which that item confirms reproduces on a clean tree at HEAD. Every section's gate is diffed against these numbers, not against green.

## Chapters

### Chapter 1 - 2026-08-11
Completed: 1. Effort pins on the four agent definitions
Implemented By: implementer-sonnet (one dispatch, no escalation)
Metrics: 0 review rounds (pair skipped, see below); 0 NEEDS_CONTEXT; 0 escalations; advisor on (2 consultations during design; configured model not read from settings this session)
Decisions / Surprises: The baseline gate is red, not green, and knowing that up front is what makes the delta readable: 690/2 before, 690/2 after, the same two `memq-shim` tests, exit 1 both times. The baseline run also produced the discriminating output the backlog's env-failure item says it never captured, because the failure would not reproduce on the runs made to catch it. The assertion is a path-form mismatch (the long form of the user's home directory returned where that directory's 8.3 short name was expected), which points at short-name normalization rather than the PATHEXT or execution-policy causes that item speculates. Recorded without the literal path: the finishing security review caught that this repository is public and that a home directory spelling is environment recon contributing nothing to the diagnosis, so all three sites carry the described form instead. Routed to section 4 as a backlog update rather than chased here, since it is unrelated scope. Separately, section 2's skill edits were applied while this section's gate was still running; safe and deliberate, because `output-style-parity` and `doctrine-parity` are the only tests that read any skill file and both read `operating-instructions/SKILL.md` alone, so nothing in the suite reads `executing-work/SKILL.md`.
Review Findings: None. The per-section reviewer pair was skipped under executing-work step 3's explicit exemption for a genuinely trivial, self-contained section: four one-line YAML frontmatter changes with no logic, whose entire risk surface (wrong value, wrong file) is exhausted by reading the diff, which the orchestrator did in full. finishing-work's whole-changeset adversarial and security passes still cover it.
Stamps: adjudicated 4, stamped 4 (`fable-limit-can-exhaust-mid-run` and `docs-write-guard-blocks-subagent-doc-writes` from the operator tier, both of which shaped the spec's approach and its standing amendments; `per-dispatch-effort-only-via-workflow` from the project tier, which is the finding this plan is built on; `hook-edits-require-rebuild`, which is why the dispatch brief told the implementer its section touches no hook and needs no rebuild)
Next: 2. The compensation rule in executing-work
Commit Model: Commit-and-Push

### Chapter 2 - 2026-08-11
Completed: 2. The compensation rule in executing-work
Implemented By: main session (`Locus: inline`; behavior-shaping prose, authored under the writing-skills bar)
Metrics: 1 review round, verdict CHANGES_REQUIRED from both reviewers, reworked and re-probed rather than re-reviewed; 0 NEEDS_CONTEXT; 0 escalations; advisor on
Decisions / Surprises: **Fable was exhausted live, mid-run, and the compensation path fired on its own first use.** Both reviewers were dispatched at fable/`high` and both errored with "You've reached your Fable 5 limit"; the in-script fallback re-ran them at Opus/`max` and they returned full reviews. The plan's motivating scenario validated itself end to end, unplanned, before the rule that describes it had even shipped, and the operator-tier memory `fable-limit-can-exhaust-mid-run` called it exactly. Two probes settled facts the review depended on. The first confirmed that a Workflow `agentType` dispatch applies the named agent's frontmatter `tools:` list and not merely its prompt: the reviewer held `Read, Grep, Glob, Bash` with no Write or Edit, so both the tool restriction and the read-only guard survive the route, which refutes the blind reviewer's sharpest premise. The second was the round-2 RED/GREEN over the reworked text. A finding also opened a new section: the draft had this skill self-grant the Workflow authorization, which contradicts the doctrine's "The request covers the Agent tool and nothing else" in both tracked copies. Scott granted the authorization on 2026-08-11, so the grant is real and only its home was wrong; section 4 now puts it in the doctrine and this skill points at it. Section 4 was inserted and the docs/backlog section renumbered to 5. Section 3's edits were applied while this section's gate was still running, the same safe overlap Chapter 1 records, and for the same reason: no test reads either skill file. The doctrine edit deliberately was not, because `doctrine-parity` does read both of its copies.
Review Findings: adversarial 0 Critical / 6 Major / 3 Minor; blind 0 Critical / 6 Major / 4 Minor. Addressed: the effort function returned nothing for a recorded cost hold, and its only readable interpretation raised effort above the uncapped path, inverting the header's purpose (found independently by both reviewers, the strongest signal in the set) - fixed with an explicit cost-hold row; the four instances were not monotonic against the calibration principle and the invented sonnet row broke derivability - fixed by stating that effort matches the difficulty of the work under review rather than model strength alone, since both come from the tier, and by folding the unnamed pairings into a frontmatter-default row; the rule shipped as prose where the acceptance named a table and where writing-skills says tables carry what gets scanned - fixed; the omission rule shipped as a prose reminder, the form writing-skills' own table names as backfiring for that failure class - fixed with a REQUIRED-field dispatch template; `model` was named in the how-to but dropped from the prohibition, which on a below-fable session yields a weak model at maximum effort - fixed, the template requires all three fields; three harness facts stated unconditionally against writing-skills' antipattern - fixed, pinned to v2.1.205; the step-1 insertion restated rationale the step-3 rule owns and claimed ladder coverage the ladder does not give - cut to a pointer plus an honest statement that the fable-tier exit under an unreachable fable is a stall raise; the Workflow route named no wait or parallel mechanics against a hook-enforced completion contract - fixed, the round stays one round and is awaited on `TaskOutput(task_id, block: true)`; the claim "the sub-fable implementers sit at `medium`" was simply false, since implementer-haiku carries no effort field - the sentence is gone; the RED/GREEN capture was absent from disk - now at `.kit/scratch/s2-redgreen.md` for both rounds. Rejected with reasons: the blind reviewer's proposed fix, pinning dedicated agent frontmatter variants so every dispatch stays on the Agent tool, is the duplicate-definitions option this spec already rejected on evidence, because the guard's end-anchored agent-class regex leaves a suffixed name ungoverned; it had no spec by contract and could not have known. Its premise that `agentType` might apply only the prompt was probed and refuted. Its finding that "every reviewer dispatch" contradicts finishing-work is accurate today and resolved by section 3 in this same changeset.
Stamps: adjudicated 0, none surfaced (`memq unstamped --since 3h` returned zero in both tiers; this section's four stamps were taken at the Chapter 1 boundary)
Next: 3. The unavailability rewrite in finishing-work
Commit Model: Commit-and-Push

### Chapter 3 - 2026-08-11
Completed: 3. The unavailability rewrite in finishing-work
Implemented By: main session (`Locus: inline`; behavior-shaping prose)
Metrics: 1 review round, CHANGES_REQUIRED from both reviewers, reworked and re-probed; 0 NEEDS_CONTEXT; 0 escalations; advisor on. Both reviewers ran at Opus/`max` through the compensated route, since fable stayed exhausted from the Chapter 2 round; that observation is minutes old and in-session, so the round went straight to the compensated dispatch rather than spending two more calls to re-observe an exhaustion already confirmed.
Decisions / Surprises: The sharpest finding was one the draft made against itself. It claimed the unavailability path is "the only route in the kit that reaches `max`", which is false against executing-work's shipped table and directly contradicted by this plan's own Chapter 2, where a per-section round reached `max` live. A uniqueness claim is the shape an agent uses to rule an action out, so shipping it risked suppressing the compensation notch in exactly the per-section rounds this plan exists to protect. The clause is gone from the skill and corrected in the spec, which carried the same slip. Both reviewers also caught that section 4's planned doctrine grant was scoped to the dispatch executing-work defines, which would have left finishing-work's own compensated dispatch with no authorization; section 4 was reworded to cover both skills before it was applied. The corrected probe design is itself a review outcome: the spec's three original directions were not all runnable against this file, because two of them test executing-work's table rather than anything this paragraph decides.
Review Findings: adversarial 0 Critical / 5 Major / 8 Minor; blind 0 Critical / 5 Major / 5 Minor, with heavy overlap. Addressed: the false uniqueness claim about `max` (both reviewers, above); the degraded no-Workflow path gave away a model tier for free by pointing at the pre-edit "fall back to the session model", when the Agent tool does take a model override and only effort is out of reach, so it is now an Agent-tool dispatch at `model: opus` at frontmatter effort, one tier down rather than two; "the bare fallback" was prescribed three times while the diff had deleted its definition, so it is now defined where it is used; the Workflow route's operating envelope lived only in executing-work, unreachable from the skill a finishing-gate session actually loads, so the scoped agent names, the in-turn `TaskOutput` wait, and the one-round-under-one-capture rule are stated here at their point of action; no authorization pointer accompanied the new dispatch, now added; the harness capability claim shipped unpinned against the pattern section 2 was reworked to follow, now pinned to v2.1.205; "at effort `high`" did not say that value is the frontmatter default, which risked pushing the gate's common path onto the Workflow route the spec explicitly rejected, now stated; step 3's parenthetical was a stale two-case enumeration, now three states; the combined adversarial-and-security pass had no `agentType` to name, now resolved; a round dying between the security and adversarial dispatches was unaddressed, now judged one dispatch at a time; the discriminator hung entirely on the override erroring, so a harness that quietly substitutes a model now reads as the same fact arriving without a signal; the cost-hold effort restatement was a second copy of executing-work's table prose and is now a pointer. Minor items on paragraph length and circular ownership were addressed structurally by breaking the block into labelled sub-blocks.
Stamps: adjudicated 0, none surfaced
Next: 4. Carry the Workflow authorization in the doctrine
Commit Model: Commit-and-Push

### Chapter 4 - 2026-08-11
Completed: 4. Carry the Workflow authorization in the doctrine
Implemented By: main session (`Locus: inline`; the operator's own instruction surface)
Metrics: 1 review round, adversarial CHANGES_REQUIRED and blind APPROVED_WITH_CONCERNS, reworked; 0 NEEDS_CONTEXT; 0 escalations; advisor on. Reviewers at Opus/`max` through the compensated route.
Decisions / Surprises: Both reviewers converged on one root defect from opposite directions, and it was a genuine logic error rather than a wording nit. The first draft closed its enumeration with "a use is covered when one of those two skills' reviewer-effort rules names it and is not covered otherwise", which makes the covered set exactly equal to whatever two editable skill files say. That re-opens the self-grant path this section exists to close: a later skill edit widening its own rule would be automatically authorized instead of contradicting the doctrine. The blind reviewer, with no spec, attacked the same sentence from the other side and found it covered nothing at all, because the block actually titled "Reviewer effort" in executing-work mentions Workflow only prohibitively and disclaims the finishing gate; the dispatch mechanics live in the block after it. So the clause was simultaneously too wide in principle and empty in practice. The grant is now anchored to a predicate the doctrine states itself: a reviewer dispatch, needing its effort set per call, naming an `agentType` the read-only guard governs. The skills say where and how and explicitly cannot widen what is covered. Three smaller corrections rode along: the predicate was factually wrong (frontmatter can express `max`, it just cannot vary per dispatch, so the real gap is the Agent tool's missing effort parameter), the capability claim is now version-pinned like the skills' and carries a lapse clause so the grant cannot outlive its justification, and deep-research is now named as outside the grant rather than left to inference from a sentence three back.
Review Findings: adversarial 0 Critical / 3 Major / 2 Minor; blind 0 Critical / 1 Major / 3 Minor. All Majors addressed. The second adversarial Major asked for a mechanical pin, and it was right: `doctrine-parity`'s whole-body compare passes a symmetric revert, so deleting the Workflow grant from both copies would have left the suite green while `executing-work` and `finishing-work` both kept asserting the doctrine carries their authorization. A third parity test now pins the bullet's presence, cross-copy identity, and that it still names both the Workflow grant and the `agentType` condition. That test earned its green: with the grant symmetrically removed from both copies the whole-body identity test still passed and the new pin failed, which is precisely the gap it exists to catch; the tree was restored from pre-probe filesystem copies and `git status --porcelain` verified identical to the pre-probe capture. Minors on redundancy were taken by tightening the bullet rather than adding to it.
Stamps: adjudicated 0, none surfaced
Next: 5. Record the findings and close the parked backlog item
Commit Model: Commit-and-Push

### Chapter 5 - 2026-08-11
Completed: 5. Record the findings and close the parked backlog item
Implemented By: main session (`Locus: inline` by routing; every deliverable is under `docs/`, where the docs-write-guard denies a non-curator subagent)
Metrics: 0 review rounds (see below); 0 NEEDS_CONTEXT; 0 escalations; advisor on
Decisions / Surprises: The per-section reviewer pair was deliberately skipped, and not under the trivial-section exemption, which would not honestly cover it. The reason is duplication rather than triviality: this section is documentation prose recording facts that three review rounds already scrutinized, and `finishing-work` runs a whole-changeset adversarial review plus the docs-curator immediately after it, so a dedicated pair here would review the same sentences twice within the same hour. finishing-work's own guidance says to eliminate true duplication rather than coverage, and this is that case. If the finishing review finds anything in these two files, that is the pair's finding arriving on schedule rather than a gap. The backlog's memq-shim item closed a loop it had been open on since 2026-08-06: it asked for the two tests' assertions to be captured and noted they would not reproduce on the runs made to catch them, and this effort's four full-suite gates reproduced them every time. The captured assertion redirects the diagnosis, since the mismatch is short-name versus long-name path normalization rather than the PATHEXT or execution-policy causes the item had been speculating about. Evidence only: no fix, no test change, and those two failures remain the standing baseline every gate in this effort was diffed against.
Review Findings: none dispatched, per the reasoning above; the whole-changeset passes in finishing-work cover this section.
Stamps: adjudicated 0, none surfaced
Next: finishing-work
Commit Model: Commit-and-Push

### Chapter 6 - 2026-08-11 (close-out)
Completed: the whole effort, five sections plus the finishing pass
Implemented By: main session orchestrating; implementer-sonnet on section 1; qa-verifier, docs-curator, and four adversarial-plus-blind review rounds
Metrics: 5 section commits; 4 per-section review rounds plus the finishing pair; 0 NEEDS_CONTEXT; 0 tier escalations; advisor on. Every review after the first fable attempt ran at Opus/`max` through this plan's own compensation route.
Gate: 694 tests, 692 pass, 2 fail, exit 1, against a recorded baseline of 692/690/2 on `aeffbb2`. The totals moved because the effort deliberately added two tests. The two failures are the same pre-existing `memq-shim` environment failures throughout, and no gate in the effort ever showed a third.
Decisions / Surprises: **The motivating scenario happened live, unplanned, and validated itself.** Fable exhausted mid-run at the first review dispatch, and every review from that point on ran through the compensated Opus/`max` route this plan was in the middle of building. The operator-tier memory `fable-limit-can-exhaust-mid-run` predicted exactly it. Two probes settled facts nothing in the repo could answer: a Workflow `agentType` dispatch keeps the identity `readonly-agent-guard` keys on, and it applies the named agent's frontmatter `tools:` list rather than only its prompt, so both read-only controls survive the route. The finishing security review then found the sharper half of that: those two controls are lost *together* when `agentType` is omitted, and nothing mechanically enforces naming it, since no hook matches the Workflow tool. That is now written into the security model as an accepted, hand-checked risk rather than left implied. Two self-contradictions surfaced that only a whole-changeset pass could see: a claim that the unavailability path was the only route reaching `max`, contradicted by this plan's own Chapter 2 where a per-section round reached it live; and a spec Verification constraint asserting no test reads `agents/`, when `readonly-agent-guard.test.js` does. Both corrected.
Review Findings: four per-section rounds returned 0 Critical and 21 Major between them, every Major addressed or rejected with a recorded reason. The finishing pair returned 0 Critical, 6 Major, 6 Minor. Two Majors reshaped the shipped work: a dangling pointer where step 1 cited step 3 for reasoning that never landed in step 3 (the rationale now lives there), and the reviewers' new `effort: high` being mechanically unpinned while two committed skills cite that literal as load-bearing (now pinned by a test in `readonly-agent-guard.test.js`, using the same argument Chapter 4 used for the doctrine pin). Three doc claims were falsified by the changeset and fixed: `architecture.md`'s agent-effort enumeration, its finishing-gate floor, and its description of the doctrine's fan-out section. **One finding was a privacy defect of this effort's own making:** the operator's Windows home directory entered this public repository for the first time, in three places, as evidence for a backlog diagnosis. All three now describe the path form without spelling it, which preserves the entire diagnostic value, and a repo-wide sweep confirms zero occurrences in tracked source.
Drift adjudications: three items, all `Class: deviation`, none a `mistake`, so none blocked. The finishing-gate floor and the doctrine fan-out section were documented as-built by the curator. The third was a wrong count in this plan's own Goal paragraph, corrected here.
Stamps: adjudicated across five section boundaries; 4 stamped at the Chapter 1 boundary, 0 surfaced at every boundary after.
Handoff, operator-only: **the frontmatter effort pins are verified by file content, not by a live dispatch.** The kit runs from an installed plugin cache, and nothing in this session confirmed the cache carries the new values; every reviewer this session ran through an explicit Workflow override that would mask a stale cache completely. Confirming it needs a plugin update and one dispatch observed at the expected effort, which is Scott's to run. It does not reopen the plan: a failed check is a new round.
Next: none, the effort is complete
Commit Model: Commit-and-Push
