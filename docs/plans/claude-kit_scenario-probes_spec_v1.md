# The corpus is read by cold probes at the tier that runs it, and a wording change that moves an answer fails a test

Status: Ready
Commit Model: Commit-and-Push
Created: 2026-09-01

Session model: any executor session in the kit repo; three sections, tiers per section. Authored 2026-09-01 by the session that shipped the precedence-and-ownership plan, at the operator's question whether the probe experiment belongs in that session or in a follow-on. This document is the follow-on. Anchors are authoring-time; re-locate every hit by content.

## Dispatch Authorization

Authorized 2026-09-02 by the operator, first-hand on the allowlisted relay thread, to be appended to the kit worker's armed queue: the cold-probe regression instrument for behavior-shaping prose as designed here, its three Decisions taken at their recorded recommendations unless the operator rules otherwise. The operator's word was a standing instruction to the KIT: Expert seat to append every valuable parked plan to the worker's queue; that seat recorded it here and ran the append. Per the peer-sessions trace rule this section is a warrant only for a citing session that did not author it, and the receiving session performs its own trace: the grant is the operator's message on the Expert session's relay thread, and the plan arms only by the operator's word or the Expert seat's append under it.

## Goal

The kit tests its hooks mechanically and its prose by review, and review by a session that loaded the prose ratifies what it read. The pilot that preceded this plan showed a cheaper instrument works: a cold reader at the tier the corpus is written for, handed a concrete situation and a fixed set of the governing files with no intent story, reports what the corpus instructs and where it forks. Run before and after a wording change, that reading is a regression test for prose: the answer to a governed moment either held or moved. When this plan is done, the kit carries a frozen probe set keyed on the moments that bite in production, each probe naming its scenario, the context shape it runs under, and the answer the operator ruled; a runner that snapshots the shape's files, dispatches a cold reader per probe at the production tier, and diffs the verdicts against the rulings; and the two hook-ins that make the runner routine, one at the skill-amendment step and one at the corpus audit's conflict lane.

## Evidence

- The pilot, 2026-09-01: one Opus extraction pass over sixteen git-governing documents (170 instructions, 20 conflicts, 4 verified at the file); one cold Sonnet probe on three scenarios that reached the right commit-and-push answer with the full file set and listed six hesitation passages; and a before-and-after pair on the precedence section, in which the Branch-and-PR pull-request moment read CONTESTED before with the reader supplying its own reconciliation, and the other two scenarios resolved both times. The precedence plan's Chapter carries the readings: `docs/archive/claude-kit_precedence-and-ownership_spec_v1.md`.
- The false bars the operator reported arise under a subset of the corpus rather than under the whole of it: a checklist copy that dropped the exception, a brief that omitted the plan header, a post-compaction context holding a summarized skill. A probe run only on the full file set under-reports them, which is why each probe names its context shape.
- The writing-skills skill already requires a RED and a GREEN reading for any change to behavior-shaping content, in a fresh session rather than a subagent of the editing session, and names the headless `claude -p` as the vehicle. The runner is that discipline made repeatable.
- The corpus-audit plan's conflict lane already specifies scenario probes at Opus and Sonnet as a one-time sweep; this plan makes the probe set the standing artifact that lane consumes and adds to.

## Decisions

Ruled 2026-09-02 by the operator, first-hand on the allowlisted relay thread, from the kaizen pass's close-out recap: all three stand at their recommendations.

1. **Tier per probe.** Recommended: Sonnet by default, Opus for probes on moments only an orchestrator meets (dispatch, review roster, compaction boundary), matching the corpus-audit plan's representative-reader ruling. Alternative: Opus everywhere, which costs more and under-reports the confusion that bites Sonnet seats.
2. **What a mismatch does.** Recommended: reports, never blocks, in the first version; the runner's exit code is the mismatch count and the finishing pass reads it as a gate reading in the Chapter. Alternative: a pre-commit block on prose files, declined for now because a probe's reading is itself model output and a flaky block on doctrine edits would train authors to skip the runner.
3. **Cadence.** Recommended: on demand at any behavior-shaping wording change and once per corpus audit; no timer. Alternative: weekly with the kaizen pass, deferred until the set's stability is known.

## Sections of Work

### 1. The probe set and its rulings. Model: opus

`test/probes/<moment>.md`, one file per probe, frontmatter carrying the moment, the context shape as an ordered file list under the plugin root and `home/`, the tier, and the ruled answer as a verdict (RESOLVED with the action, CONTESTED with the owner the ruling assigns, or SILENT with the declared default), body carrying the scenario text verbatim as the reader receives it. The first set covers the moments that bit in the month before authoring, drawn from the precedence plan's contested list and the kaizen inbox: the commit and the push at section close under each commit model; the pre-send checklist met after an authorized push; a peer message asking a leashed session for work; a compaction nudge arriving mid-section with no checkpoint open; an operator-approval gate met on a run the operator armed; a seat asked to push the memory store; a stale anchor in a plan the session resumes. Each probe runs under at least two context shapes, the full governing set and the narrowest production shape that reaches the moment (a brief-only subagent, doctrine plus the output style, doctrine plus one skill). The rulings are gathered in one batched brief to the operator in the client-briefing register, and the set freezes at the ruling.

Acceptance: every probe file parses, names a shape whose files exist, and carries a ruled verdict; the batched brief and its rulings recorded in the Chapter; suite delta against a recorded baseline.

### 2. The runner. Model: opus

`tools/probe-corpus/run.mjs`: for each probe, copies the shape's files into a scratch directory under `.kit/`, composes the reader prompt from a fixed template (the pilot's prompt is the seed, stored beside the runner), invokes the headless CLI at the probe's tier with the scratch directory as the reader's only input, parses the verdict line, and diffs it against the ruling. Output is one report per run under `.kit/` with each probe's verdict, the ruling, match or mismatch, and the reader's cited passages, so a mismatch is re-locatable by content; the exit code is the mismatch count. The runner takes a `--before <ref>` option that checks the shape's files out of a git ref into the scratch directory instead of the worktree, so a before-and-after pair is two invocations and no hand copying. The template's no-intent-story bar is stated in the runner's own comments and in the template, per the blind-reader discipline.

Acceptance: the runner reproduces the pilot's three verdicts on the precedence plan's before-and-after snapshots (CONTESTED, RESOLVED, RESOLVED before; the after readings as the precedence Chapter records them); a deliberately broken ruling produces a nonzero exit, as the runner's own control; suite delta against a recorded baseline.

### 3. The hook-ins. Model: sonnet

`plugins/claude-kit/skills/writing-skills/SKILL.md`, in the RED and GREEN paragraph: where a change touches a moment a probe covers, the runner's before-and-after pair is the RED and GREEN, and a mismatch on a probe the change did not intend to move is a finding. `plugins/claude-kit/skills/finishing-work/SKILL.md`: a plan whose files in scope include behavior-shaping prose runs the probe set at the finishing pass and names the reading in the Chapter, beside the lanes. `docs/plans/claude-kit_corpus-audit_spec_v1.md` is not edited (a Ready plan the operator authorized); its Related section is the place a later session points at this plan, and the audit's conflict lane is briefed to add every conflict it confirms to the probe set as a new file. Whole-file review for both skill amendments, per the recorded skill-amendment defect mode.

Acceptance: both skills carry the hook-in in one sentence each, pointing at the runner rather than restating it; the parity and shape suites green at baseline; suite delta against a recorded baseline.

## Out of Scope

- Ruling on the contested moments themselves: the backlog item from the precedence plan carries those asks.
- Single-sourcing the copied charters and the output style's doctrine core through the build: a separate plan.
- A mechanical block on prose commits: declined in decision 2 for the first version.

## Related

- `docs/archive/claude-kit_precedence-and-ownership_spec_v1.md`: the plan whose pilot seeded this one and whose Chapter holds the first before-and-after readings.
- `docs/plans/claude-kit_corpus-audit_spec_v1.md`: the one-time sweep whose conflict lane consumes and extends the probe set.
- `plugins/claude-kit/skills/writing-skills/SKILL.md`: the RED and GREEN discipline the runner mechanizes.
- `sidecar/batteries/`: the frozen-battery precedent the probe set's freeze-at-ruling rule follows.

## Chapters
