# Claude-Kit Reviewer Effort Compensation

Status: In Progress
Commit Model: Commit-and-Push
Fable Spend: finishing reviews
Created: 2026-08-11

## Goal

A review pass holds its quality when the model tier under it drops. Today the kit compensates for an unreachable or exhausted Fable by falling back to the session model at whatever effort the agent definition happens to pin, which is a silent downgrade of the strongest gate in the system. When this is done, every reviewer dispatch carries an effort chosen for the model it runs at and for whether that model is the intended tier or a stand-in: Fable reviews at `high`, Opus reviews at `xhigh` when Opus is the tier we aimed at, and Opus reviews at `max` when it is covering for a Fable that is gone. A session that has run out of Fable gets a compensated gate instead of a quietly weaker one.

The same pass pins the effort of the three agent definitions that currently have none, so the top implementer tier and the security reviewer stop inheriting whatever the session is set to.

## Approach

### The compensation rule

Effort is a function of two inputs: the model the reviewer actually runs at, and whether that model is the tier the work was aimed at or a substitute standing in for a higher one.

Every model has a standard judgment-work effort, the level at which open-ended evaluation is worth paying for. Well-scoped work runs below it, which is where the implementers already sit at `medium`.

| Reviewer dispatch | Model | Effort | How it is set |
|---|---|---|---|
| Fable, as the intended tier | fable | `high` | frontmatter default, no override |
| Opus, as the intended tier (a sonnet-written section bumped one tier) | opus | `xhigh` | per-dispatch override |
| Opus, substituting for an unreachable Fable | opus | `max` | per-dispatch override |
| Sonnet, as the intended tier (a haiku-written section bumped one tier) | sonnet | `high` | frontmatter default, no override |

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

The kit runs from an installed plugin cache, not from this repo's working tree, so an edit to `plugins/claude-kit/agents/*.md` does not change live dispatch behavior until the plugin is rebuilt and the cache carries it. Any acceptance criterion that claims a live effort value must name the build/install step that made the cache current, or be recorded as verified-by-file-content only. No test in `test/` reads the `agents/` directory, so the frontmatter edits are not expected to move the gate; capture the baseline anyway and diff against it.

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

- The effort table from the Approach, stated as a function of two inputs: the reviewer's model, and whether that model is the intended tier or a substitute for a higher one. A dispatch that cannot answer the second question has not finished deciding what it is dispatching.
- The dispatch mechanics for both override cases: `Workflow`'s `agent()` with `agentType` set to the kit reviewer, `model: 'opus'`, and `effort: 'xhigh'` when Opus is the intended tier or `effort: 'max'` when Opus is substituting for an unreachable Fable.
- **Both `agentType` and `effort` are named explicitly on every workflow dispatch, always.** Omitting `agentType` produces a `workflow-subagent` the read-only guard does not govern, so the tree under review loses its protection. Omitting `effort` inherits a value that is not reliably the session's: an unspecified workflow agent has been observed running at `xhigh` on a session whose agents were expected at `medium`, cause unresolved. An inherited effort is exactly the silent wrong-effort failure this rule exists to remove, so it is never left to the default.
- A sentence establishing that this skill's instruction is itself the Workflow opt-in authorization, so the dispatch needs no per-session request from Scott.
- Confirmation that the existing contracts survive the route change: the blind-reviewer still receives the base ref or changed-file list only and never a captured diff, the tree-state capture still brackets the round, and the reviewers are still never pre-judged.

Files: `plugins/claude-kit/skills/executing-work/SKILL.md`.
Acceptance: step 3 carries the model-to-effort table, the mandatory-`agentType`-and-`effort` rule, and the opt-in authorization sentence; the blind-reviewer input contract and the tree-state bracketing are unchanged. Gate green.
Tests: RED/GREEN per `writing-skills`, which is the behavioral evidence. Before the edit, a probe session given a sonnet-tier section must fail to produce an `xhigh` reviewer dispatch; after it, it must produce one naming both `agentType` and `effort`. Capture both runs.

### 3. The unavailability rewrite in finishing-work
Model: opus
Locus: inline

Load the `writing-skills` skill first; this is behavior-shaping prose.

`plugins/claude-kit/skills/finishing-work/SKILL.md` carries the fable-override default for steps 2 and 3 and the "Unavailable is not a cost hold" paragraph. Both change:

- The fable-override default gains its effort pairing (`high` at fable), so the finishing gate's dispatch is fully specified.
- The unavailability paragraph keeps its two load-bearing parts unchanged: attempt the override and read the actual dispatch error rather than assuming, and never file an unavailable Fable as a cost hold. What changes is the fallback itself. Instead of dropping to the session model at frontmatter effort and recording *reduced oversight*, it re-dispatches through Workflow at `model: 'opus', effort: 'max'` and records a *compensated* fallback: the tier dropped, the effort climbed the full substitution notch to cover it, and the Chapter and close-out say so with the verbatim error that triggered it. This is the Approach table's third row, and it is the only path in the kit that produces `max`.
- The recorded `Fable Spend: none (cost hold)` path is untouched: a cost hold still holds the reviews at the session model, because that is a decision Scott made rather than a gate failing to run. A cost hold therefore does not buy the compensation notch either, which is correct: nothing failed, so nothing needs covering.

Files: `plugins/claude-kit/skills/finishing-work/SKILL.md`.
Acceptance: a fresh session whose fable override errors re-dispatches the finishing adversarial and security reviews at Opus/`max` through Workflow and records a compensated fallback naming the verbatim error; the same session under a recorded cost hold does not. Gate green.
Tests: RED/GREEN per `writing-skills`, driven with a simulated dispatch failure. Prove it three directions, since the two Opus cases differ: an intended-tier Opus reviewer gets `xhigh`, an unavailable-Fable substitution gets `max`, and a recorded cost hold gets the session model with no Workflow dispatch at all.

### 4. Record the finding and close the parked backlog item
Model: opus
Locus: inline (routing, not sizing: both deliverables are files under `docs/`, and `docs-write-guard.js` denies any governed subagent a write to a path carrying a `docs/` segment, so the write is the main thread's whatever tier the section would otherwise earn)

- `docs/security-model.md`: record that a kit agent dispatched through `Workflow`'s `agent({agentType})` retains the identity `readonly-agent-guard.js` keys on and is governed exactly as under an Agent-tool dispatch, and that a workflow agent dispatched without `agentType` is not governed. This is a property of the access model, so it belongs beside the guard's other invariants rather than in a plan Chapter.
- `docs/backlog.md`: the "effort dials and reviewer tiering in flight" item states that the per-section-versus-finishing effort split is blocked until a per-dispatch effort override appears on the Agent tool. That is still true of the Agent tool and beside the point: the override exists on Workflow. Update the item with the finding, mark the parts this plan closes, and leave the measurement question (do the new effort levels actually improve review quality) open against Chapter Metrics.

Files: `docs/security-model.md`, `docs/backlog.md`.
Acceptance: the security model states the governed and ungoverned Workflow dispatch shapes; the backlog item no longer claims the split is unreachable. Gate green.
Tests: none warranted; both files are curated prose with no mechanism behind them.

## Decisions

- **Security-reviewer pins `high`, not a flat `xhigh` (decided 2026-08-11).** It is a Fable-model reviewer at the finishing gate (where `finishing-work` dispatches it with the fable override) and an Opus-model one per-section (where it sits out the tier bump and takes the session model). Pinning `high` and letting the section-2 rule raise it to `xhigh` when it actually runs at Opus applies the effort function consistently instead of carving out an exception for one agent.
- **`implementer-fable` pins `high` (decided 2026-08-11).** Deliberately above the `medium` that well-scoped implementation work takes, because the fable tier is reserved for novel logic, security-sensitive surfaces, and subtle correctness rather than transcription against a settled pattern. Nothing in the kit runs an implementer above `high`.
- **`max` is reserved for substitution (decided 2026-08-11).** Standard Opus judgment work is `xhigh`; the extra notch to `max` is bought only by a tier drop. No path produces Fable at `max`.

## Open Questions

1. **Commit model.** Set to Review-Only pending Scott's call. Flipping the header to Commit-and-Push is the authorization to push each section as it lands.
2. **Whether these levels deliver.** The chosen levels are judgment against Scott's observations, not measurement: `high` for Fable judgment work, `xhigh` for Opus, `max` for the substitution. The measurement surface is Chapter Metrics (review rounds, findings quality, NEEDS_CONTEXT counts, escalations) diffed against the pre-change baseline, which is the same instrument the parked "effort dials and reviewer tiering" backlog item already watches. Revert is one frontmatter line per agent plus the table rows.

## Gate Baseline

Captured at execution start, before any edit, on `aeffbb2`: **692 tests, 690 pass, 2 fail, exit 1**. Both failures are in `test/memq-shim.test.js` (`PowerShell resolves memq.ps1, and that is what keeps an argument from starting a second command` and `a foreign memq winning name resolution is reported, never read as on-PATH`), and both are the pre-existing environment failure `docs/backlog.md` records under "Env failure: memq-shim PATH-resolution tests fail", which that item confirms reproduces on a clean tree at HEAD. Every section's gate is diffed against these numbers, not against green.

## Chapters

### Chapter 1 - 2026-08-11
Completed: 1. Effort pins on the four agent definitions
Implemented By: implementer-sonnet (one dispatch, no escalation)
Metrics: 0 review rounds (pair skipped, see below); 0 NEEDS_CONTEXT; 0 escalations; advisor on (2 consultations during design; configured model not read from settings this session)
Decisions / Surprises: The baseline gate is red, not green, and knowing that up front is what makes the delta readable: 690/2 before, 690/2 after, the same two `memq-shim` tests, exit 1 both times. The baseline run also produced the discriminating output the backlog's env-failure item says it never captured, because the failure would not reproduce on the runs made to catch it. The assertion is a path-form mismatch (`C:\Users\LocalAdmin\...` returned where `C:\Users\LOCALA~1\...` was expected), which points at 8.3-short-name normalization rather than the PATHEXT or execution-policy causes that item speculates. Routed to section 4 as a backlog update rather than chased here, since it is unrelated scope. Separately, section 2's skill edits were applied while this section's gate was still running; safe and deliberate, because `output-style-parity` and `doctrine-parity` are the only tests that read any skill file and both read `operating-instructions/SKILL.md` alone, so nothing in the suite reads `executing-work/SKILL.md`.
Review Findings: None. The per-section reviewer pair was skipped under executing-work step 3's explicit exemption for a genuinely trivial, self-contained section: four one-line YAML frontmatter changes with no logic, whose entire risk surface (wrong value, wrong file) is exhausted by reading the diff, which the orchestrator did in full. finishing-work's whole-changeset adversarial and security passes still cover it.
Stamps: adjudicated 4, stamped 4 (`fable-limit-can-exhaust-mid-run` and `docs-write-guard-blocks-subagent-doc-writes` from the operator tier, both of which shaped the spec's approach and its standing amendments; `per-dispatch-effort-only-via-workflow` from the project tier, which is the finding this plan is built on; `hook-edits-require-rebuild`, which is why the dispatch brief told the implementer its section touches no hook and needs no rebuild)
Next: 2. The compensation rule in executing-work
Commit Model: Commit-and-Push
