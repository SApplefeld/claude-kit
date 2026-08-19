# Cap the per-section reviewer bump at Opus, and bring the security reviewer under the same rule

Status: In Progress
Commit Model: Commit-and-Push
Disjoint: yes
Created: 2026-08-19

## Goal

Per-section reviewers stop drawing on the Fable allotment for sections written at Opus or below, and the security reviewer's per-section model is set by the section's tier rather than by whichever model the session happens to run. The whole-effort finishing gate is untouched and stays at Fable. When this is done, the rule reads in one place with one exception, every restatement of it in the kit agrees, and the change is folded into the open reviewer-tier experiment with a recorded baseline to diff against.

## Approach

**The rule today.** `plugins/claude-kit/skills/executing-work/SKILL.md` step 3 runs each per-section reviewer pair (adversarial + blind; the document pair by reference) one model tier above the section's writer tier: haiku at sonnet, sonnet at opus, opus at fable, fable at fable. An inline section's writer tier is the session model, so an Opus-led session's inline work reviews at fable. The security-reviewer sits out the bump and takes the session's model, which on an Opus-led session is opus at `xhigh` by the effort table's second row.

**The rule wanted.** The same bump, capped at opus, for every per-section reviewer (code pair, document pair, security-reviewer): haiku at sonnet, sonnet at opus, opus at opus, fable at fable. Inline on an Opus-led session reviews at opus. After a tier escalation the escalated tier is the writer tier and the cap applies to the result. One stated exception: the security-reviewer never runs at fable per-section; a fable-tier section's security review runs at opus, and its top-model coverage is the finishing security pass, which stays at fable. The document pair follows the pair rule as it does today by reference.

**Effort.** An Opus reviewer that no longer sits above the writer runs at `max`. The reviewer-effort table is rewritten so one question generates its rows: does the reviewer's model sit above the writer's tier? Yes: that model's own level (fable `high`, opus `xhigh`). No, and the model is opus: `max`. That single row covers a capped review of an opus-tier or Opus-inline section, the security-reviewer over a fable-tier section, and an Opus standing in for an unreachable Fable, so no new row is added; the existing `max` row is reworded and the "on a dispatch taking no bump" clause is deleted, since no per-section reviewer sits out the rule any more. Fable stays `high` always. The compensation-rationale paragraph gains one sentence so its ground covers the capped path: the notch buys back tier headroom the reviewer no longer has over the writer, not only an unreachable model. Any non-default effort still goes through the Workflow dispatch route already described in the same step; nothing about that route changes.

**Why.** The Fable allotment is the binding constraint on the operator's fleet, and per-section review over opus-tier work is its largest discretionary draw. Separately, the operator has observed in transcripts that Fable-targeted dispatches on security-sensitive material are silently substituted with Opus mid-run; pointing the per-section security-reviewer at opus from the start removes that swap and the tokens spent before it. Whether the same substitution reaches the finishing security pass is not established; `finishing-work/SKILL.md` step 3's unavailability rule already requires recording the model a finishing pass actually ran at, and that Metrics line is the datum for any later decision about it. This effort does not move the finishing pass.

**Why the security exception is opus rather than fable.** Pinning the security-reviewer to the pair rule verbatim would send fable-tier sections' security review to fable, which today runs at opus on an Opus-led session. Brainstorming's tier bands send security-sensitive surfaces to the fable tier, so the pure rule would increase Fable draw on precisely the sections that fire the security reviewer. The exception keeps today's Opus-led behaviour, makes it section-determined instead of session-dependent, and names the finishing security pass at fable as the same-lens backstop. Reversal is one clause.

**What it costs, argued.** Across the 138 sections in this repo's `docs/archive/`, tiers run fable 64, opus 45, sonnet 26, inline 2, haiku 1 (`docs/archive/claude-kit_reviewer-effort-compensation_spec_v1.md:53`). The cap moves the 45 opus-tier and 2 inline sections off Fable review and leaves the 64 fable-tier sections on it, so it removes roughly 40 percent of the per-section Fable reviewer draw rather than all of it. The Fable pairs it would have downgraded on two live NEO plans found real defects (a missing route-registration pin that would have let an authorization policy regress to bare authentication, a silent NVARCHAR truncation, an unreachable shipped surface); whether an Opus pair at `max` would have found them is not established, which is why this ships as a measured change inside the open experiment. Spend relocates to Opus reasoning tokens rather than disappearing: on an Opus-led session the security reviewer's observable change is `xhigh` to `max` on opus- and fable-tier sections, and haiku sections drop to sonnet.

**What stays fixed.** `finishing-work/SKILL.md` (Fable floor at `high` with the recorded Opus-at-`max` fallback, for the security pass too), `consult/SKILL.md`, and `agents/security-reviewer.md` (the pin lives in the dispatch rule, not the frontmatter) are not edited.

**Close condition.** `docs/backlog.md` carries the open experiment "effort dials and reviewer tiering in flight" whose stated close is to judge the levels on Chapter Metrics against the pre-change baseline (review rounds, NEEDS_CONTEXT, escalations, findings quality). This change folds into that item with a dated line; it does not open a second experiment. The baseline is captured before any edit lands and recorded in Chapter 1.

**Revert.** One commit restores the step 3 sentences, the table, the brainstorming enumeration, and the architecture clause. No runtime state, no migration.

## Sections of Work

### 1. Reword the rule, the effort table, and the two restatements
Model: opus

Load the `writing-skills` skill before editing: this is a rule-parameter change to behavior-shaping skills, so let that skill decide whether a behavior test is needed (none is expected) and record its call in the Chapter. Reviewers for this section run under the rule in force at dispatch, which is the pre-change rule; say so in the Chapter.

**Baseline first, before any file is edited.** Dispatch a scout (executing-work owns the scout banding and return contract) to build one table from the Chapter Metrics lines of the kit plans archived since 2026-08-11 in `docs/archive/` (the date the tiering rule shipped): plan, section, writer tier, reviewer tier, review rounds, surviving Criticals. Metrics lines are free-form; a cell the record does not state is written `not recorded`, never inferred. Record the table verbatim in Chapter 1. Also record the `node --test test/` pass and fail counts and the names of any failing tests before the edit.

**Edit exactly these, and keep them saying one thing:**

1. `plugins/claude-kit/skills/executing-work/SKILL.md` step 3, the review paragraph: the bold rule sentence ("The reviewer pair runs one model tier above the section's writer tier ... the security-reviewer is not part of the bump and stays at its default") and its dependents in the same paragraph: the inline-section sentence ending "fable on the Opus-led session execution belongs to"; "A fable-tier or untiered section reviews at fable too ..." (an untiered section now takes the inline rule); "On a below-fable session the fable reviewer overrides are standing and expected ..." (they remain standing for fable-tier sections' code and document pairs and for finishing; reword rather than delete); the unreachability sentence ("A fable that is unreachable in this environment ..."); and the document-pair sentence ("The document pair takes the same one-tier-above-the-writer model rule ..."). The clause excluding the security-reviewer is deleted and replaced by the exception stated in the Approach.
2. The same file's **Reviewer effort** block: the intro sentence ("the security-reviewer included even though it takes no model bump"), the table rows, and the "Two questions generate every row" paragraph, rewritten per the Approach. "The rule never produces Fable at `max`" survives.
3. The same file's compensation-rationale paragraph ("The compensation notch belongs to gate-shaped work ..."): add the headroom sentence.
4. `plugins/claude-kit/skills/brainstorming/SKILL.md`, the Fable Spend paragraph: "the per-section reviewer pairs that the one-tier-above-the-writer bump puts at Fable" becomes the fable-tier sections' pairs only.
5. `docs/architecture.md`, the orchestration-mechanics paragraph: the ownership clause "the rule that runs each per-section reviewer pair one model tier above the section's writer tier" is reworded to name the cap and the security-reviewer's exception.
6. `docs/backlog.md`, the "effort dials and reviewer tiering in flight" item: append one dated line naming this change and pointing at this plan's Chapter 1 for the baseline.

**Acceptance:**

- A repo-wide grep over `plugins/` and `docs/` excluding `docs/archive/` for `opus at fable`, `one-tier-above`, `one model tier above`, `not part of the bump`, `taking no bump`, `puts at Fable`, and `fable on the Opus-led session` returns no hits.
- Step 3 states the four-row enumeration (haiku at sonnet, sonnet at opus, opus at opus, fable at fable), the inline rule, that the document pair takes the same rule, and the security-reviewer's exception with its reason (the finishing security pass at fable is its top-model coverage).
- The effort table's Opus `max` row is conditioned on the reviewer having no tier headroom over the writer and names the three cases it covers; the Opus `xhigh` row is conditioned on the reviewer sitting one tier above the writer and no longer names a no-bump dispatch; the compensation-rationale paragraph names the headroom ground.
- `git diff 7e6b0e1 -- plugins/claude-kit/skills/finishing-work/SKILL.md plugins/claude-kit/skills/consult/SKILL.md plugins/claude-kit/agents/security-reviewer.md` is empty.
- `node --test test/` reports the same pass and fail counts and the same failing names as the recorded baseline (no test reads these files; a delta is a surprise to root-cause, not to explain away).
- Chapter 1 carries the baseline table, the writing-skills call, and the reviewer tiers this section's own reviews ran at.

Files in scope: `plugins/claude-kit/skills/executing-work/SKILL.md`, `plugins/claude-kit/skills/brainstorming/SKILL.md`, `docs/architecture.md`, `docs/backlog.md`.

Tests: none added; the change is prose. The gate is `node --test test/` against the recorded baseline.

References: `docs/archive/claude-kit_reviewer-effort-compensation_spec_v1.md` (the effort table's origin and the 138-section tier census at :53); `docs/archive/claude-kit_backlog-sweep_spec_v1.md:64` (where the security-reviewer's exclusion from the bump was introduced, as a wording gap closed without an argued reason).

## Out of Scope

- The finishing gate. `finishing-work/SKILL.md` steps 2 and 3 keep the Fable floor with the recorded Opus-at-`max` fallback; the only reason to open that file is a cross-reference to the per-section rule that needs rewording, and none is known.
- `agents/security-reviewer.md` frontmatter. The model pin lives in the dispatch rule.
- Deployment. The running NEO engine carries a deployed kit payload; this change reaches it only through a payload refresh (`D:/ai-os/deploy/Deploy-Upgrade.ps1 -KitRepo`), which is the operator's call.
- Measuring the experiment. This effort records the baseline and folds the change into the open backlog item; judging the levels is that item's close, in a later session with post-change Chapters to read.

## Assumptions

- assumed 2026-08-19 (operator, in the design conversation): capped Opus reviewers run at `max`, not `xhigh`; reversal: one word in the table's `max` row and the sentence that grounds it.
- assumed 2026-08-19 (default): the document pair (blind-reader, prose-reviewer) follows the code pair's capped rule, as it inherits by reference today; reversal: one sentence in step 3 giving document review its own tier rule.
- assumed 2026-08-19 (operator, in the design conversation): the security-reviewer never runs at fable per-section, taking opus at `max` on a fable-tier section, because the finishing security pass at fable is its same-lens backstop and the pure pair rule would raise Fable draw on the sections that fire it; reversal: delete the exception clause, and fable-tier security review then follows the pair to fable.
- assumed 2026-08-19 (default): the baseline covers kit plans archived since 2026-08-11 only; the two NEO plans live outside this repo and are not required; reversal: none, a later session may append their rows to the same table.
- assumed 2026-08-19 (default): Commit-and-Push to `main`, matching recent kit history; reversal: none.
- assumed 2026-08-19 (writing-skills, to be confirmed by the executing session): a rule-parameter change needs no RED/GREEN behavior test; reversal: the session runs one if the skill's bar says so, and records the call either way.

## Operator Verification

- After a kit payload refresh reaches the NEO engine: on the next plan with a security-surface section, the per-section security dispatch starts and ends on Opus with no mid-run substitution in the transcript. A substitution still appearing on that dispatch reopens the "why" paragraph, not the rule.

## Open Questions

- Whether the mid-run Fable-to-Opus substitution also reaches the finishing security pass. Owner: the open experiment's Metrics; `finishing-work` already records the model each finishing pass actually ran at, and a run of finishing security passes landing on Opus is the fact that would move that pass. Not blocking.

## Related

- `docs/backlog.md`, "Open experiment: effort dials and reviewer tiering in flight": the experiment this change folds into.
- `docs/archive/claude-kit_reviewer-effort-compensation_spec_v1.md`: the effort table this effort re-grounds.
- `docs/archive/claude-kit_backlog-sweep_spec_v1.md`: where the one-tier-above rule and the security-reviewer's exclusion from it shipped.

## Chapters
