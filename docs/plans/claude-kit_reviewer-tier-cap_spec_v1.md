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

**Baseline first, before any file is edited.** Dispatch a scout (executing-work owns the scout banding and return contract) to build one table from the Chapter Metrics lines of the kit plans archived since 2026-08-11 in `docs/archive/` (the date the tiering rule shipped): plan, section, writer tier, reviewer tier, review rounds, surviving Criticals. Metrics lines are free-form; a cell the record does not state is written `not recorded`, never inferred. Record the table verbatim in Chapter 1. Also record the `node --test test/*.test.js` pass and fail counts and the names of any failing tests before the edit.

**Edit exactly these, and keep them saying one thing:**

1. `plugins/claude-kit/skills/executing-work/SKILL.md` step 3, the review paragraph: the bold rule sentence ("The reviewer pair runs one model tier above the section's writer tier ... the security-reviewer is not part of the bump and stays at its default") and its dependents in the same paragraph: the inline-section sentence ending "fable on the Opus-led session execution belongs to"; "A fable-tier or untiered section reviews at fable too ..." (an untiered section now takes whichever tier actually built it: the inline rule when it ran inline, and its dispatched tier when step 1 sent it out as briefable, since step 1 dispatches a clearly-briefable untiered section at the tier it would have earned); "On a below-fable session the fable reviewer overrides are standing and expected ..." (they remain standing for fable-tier sections' code and document pairs and for finishing; reword rather than delete); the unreachability sentence ("A fable that is unreachable in this environment ..."); and the document-pair sentence ("The document pair takes the same one-tier-above-the-writer model rule ..."). The clause excluding the security-reviewer is deleted and replaced by the exception stated in the Approach.
2. The same file's **Reviewer effort** block: the intro sentence ("the security-reviewer included even though it takes no model bump"), the table rows, and the "Two questions generate every row" paragraph, rewritten per the Approach. "The rule never produces Fable at `max`" survives.
3. The same file's compensation-rationale paragraph ("The compensation notch belongs to gate-shaped work ..."): add the headroom sentence.
4. `plugins/claude-kit/skills/brainstorming/SKILL.md`, the Fable Spend paragraph: "the per-section reviewer pairs that the one-tier-above-the-writer bump puts at Fable" becomes the fable-tier sections' pairs only.
5. `docs/architecture.md`, the orchestration-mechanics paragraph: the ownership clause "the rule that runs each per-section reviewer pair one model tier above the section's writer tier" is reworded to name the cap and the security-reviewer's exception.
6. `docs/backlog.md`, the "effort dials and reviewer tiering in flight" item: append one dated line naming this change and pointing at this plan's Chapter 1 for the baseline.

**Acceptance:**

- A repo-wide grep over `plugins/` and `docs/` for `opus at fable`, `one-tier-above`, `one model tier above`, `not part of the bump`, `taking no bump`, `puts at Fable`, and `fable on the Opus-led session` returns no hits in live rule text. Three surfaces are outside that reach and do not count as hits: `docs/archive/`, and `docs/README.md`'s archive narrative, both being append-only records of what already-shipped plans delivered rather than statements of the rule; and this plan doc, which quotes the banned phrases as the strings to eliminate and leaves `docs/plans/` when it archives in this same delivery.
- Step 3 states the four-row enumeration (haiku at sonnet, sonnet at opus, opus at opus, fable at fable), the inline rule, that the document pair takes the same rule, and the security-reviewer's exception with its reason (the finishing security pass at fable is its top-model coverage).
- The effort table's Opus `max` row is conditioned on the reviewer having no tier headroom over the writer and names the three cases it covers; the Opus `xhigh` row is conditioned on the reviewer sitting one tier above the writer and no longer names a no-bump dispatch; the compensation-rationale paragraph names the headroom ground.
- `git diff 7e6b0e1 -- plugins/claude-kit/skills/finishing-work/SKILL.md plugins/claude-kit/skills/consult/SKILL.md plugins/claude-kit/agents/security-reviewer.md` is empty.
- `node --test test/*.test.js` reports the same pass and fail counts and the same failing names as the recorded baseline (no test reads these files; a delta is a surprise to root-cause, not to explain away).
- Chapter 1 carries the baseline table, the writing-skills call, and the reviewer tiers this section's own reviews ran at.

Files in scope: `plugins/claude-kit/skills/executing-work/SKILL.md`, `plugins/claude-kit/skills/brainstorming/SKILL.md`, `docs/architecture.md`, `docs/backlog.md`.

Tests: none added; the change is prose. The gate is `node --test test/*.test.js` against the recorded baseline.

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

### Chapter 1 - 2026-08-19
Completed: 1. Reword the rule, the effort table, and the two restatements
Implemented By: main session (Locus: inline, per executing-work step 1's docs-write routing override; the section writes `docs/architecture.md` and `docs/backlog.md`, which the docs-write-guard denies a dispatched implementer). The section's `Model: opus` tier is unchanged; only the locus is overridden.
Metrics: review rounds 1; NEEDS_CONTEXT 0; escalations 0; consults 0. Reviewers ran under the rule in force at dispatch, which is the pre-change rule: an inline section's writer tier is the session model (opus), so the pair ran at fable, effort `high` (frontmatter default), dispatched via the Agent tool with a `fable` model override. No security-reviewer: the changeset is prose across two skill files and two docs, touching no input handling, auth, SQL, secrets, shell, permission grant, or hook.

**Pre-change gate baseline (captured before any file was edited).** `node --test test/*.test.js`: 964 tests, 961 pass, 3 fail. The three failing tests, all pre-existing and all in `test/memq-shim.test.js`, are:

- `PowerShell resolves memq.ps1, and that is what keeps an argument from starting a second command` (:401) - asserts an 8.3 short-path form (`LOCALA~1`) against a long path (`LocalAdmin`).
- `the status check reports a content-swapped shim as stale, which is what makes -Fix reach it` (:475) - expects `memq-shim.js` among the stale names, gets only `memq.cmd` and `memq.ps1`.
- `a foreign memq winning name resolution is reported, never read as on-PATH` (:512) - expects true, gets false.

The spec's stated gate command, `node --test test/*.test.js`, does not run on this machine's Node (v24.19.0): it resolves the directory as a module and dies with `Cannot find module 'D:\claude-kit\test'` before running anything. The glob form `node --test test/*.test.js` is the working equivalent and is what the archive's `claude-kit_compact-gate-binding_spec_v1.md:138` also uses. Post-edit the gate reports 964 / 961 / 3 with the same three names: no delta.

**Pre-change reviewer-tiering baseline.** Chapter Metrics from every kit plan in `docs/archive/` whose Chapters are dated on or after 2026-08-11, the date the tiering rule shipped. 11 plan docs, 47 Chapters; no plan straddled the cutoff. A cell the record does not state reads `not recorded` and was never inferred.

| plan | section | writer tier | reviewer tier | review rounds | surviving Criticals |
|---|---|---|---|---|---|
| boundary-gated-compaction | Ch1: probe, PreCompact and threshold semantics | inline | not recorded (none dispatched) | 0 | 0 (none dispatched) |
| boundary-gated-compaction | Ch2: the gate, PreCompact hook, checkpoint CLI, tests | fable | fable (pair); default (security) | 1 | not recorded |
| boundary-gated-compaction | Ch3: threshold, doctor, and skill wiring | inline (prose) / fable (fix round) | fable (pair); default (security) | 1 | 3, all addressed, none survived |
| boundary-gated-compaction | Ch4: close-out | inline / fable (fix rounds) | fable (qa, security, adversarial; effort high) | not recorded ("2 fix rounds", no round count) | not recorded |
| compact-gate-binding | Ch1: share the claim predicate | sonnet | not recorded (none dispatched) | 0 | 0 (none dispatched) |
| compact-gate-binding | Ch2: claim the binding at the compaction gate | opus | fable (pair); default (security) | 1 | not recorded |
| compact-gate-binding | Ch3: contract text and backlog | inline | not recorded | 0 additional (rode Ch2's round) | not recorded (recorded in Ch2) |
| compact-gate-binding | Ch4: close-out over the whole changeset | inline, with qa / security / adversarial / docs-curator | fable | 1 | 0 ("zero Criticals across every round") |
| compaction-window-retune | Ch1: constants, the iterations fix, and prose | inline | fable (effort high) | 1 | not recorded |
| compaction-window-retune | Ch2: close-out | inline | not recorded (rode Ch1's round) | not recorded | not recorded |
| consult | Ch1: retire the cost hold and the Fable Spend header | opus | fable | 1 | not recorded |
| consult | Ch2: the consultant agent | fable | fable (pair); default (security) | 1 | not recorded |
| consult | Ch3: the consult skill; executing-work; reach | fable (S3,S4) / opus (S5) | fable | 1 | not recorded |
| consult | Ch4: doctrine widening; docs and decommission | fable (S6) / inline (S8) | not recorded (none dispatched) | 0 | 0 (none dispatched) |
| consult | Ch5: probes, RED/GREEN on the trigger wording | inline | not recorded (none dispatched) | 0 | 0 (none dispatched) |
| consult | Ch6: close-out, all eight sections | inline orchestrating; opus (S1,S5,S8) / fable (S2,S3,S4,S6) | fable | 5 per-section + 1 finishing | not recorded |
| document-review-battery | Ch1: sections 1 through 7 | opus (1,4,6) / fable (2,3,5) / inline (7, fixes, docs) | not recorded | 1 | count not stated; none survived adjudication |
| document-review-battery | Ch2: close-out | inline, with qa / security / adversarial / docs-curator | fable (security, adversarial) | 1 | 0 ("none, in either finishing pass") |
| intake-gap-check | Ch1: doctrine bullet; brainstorming; executing/finishing | fable x3 parallel / inline (fixes) | not recorded | 1 | 2, both addressed, none survived |
| intake-gap-check | Ch2: proof run | inline, with four general-purpose arms | not recorded (none dispatched) | 0 | 0 (none dispatched) |
| intake-gap-check | Ch3: close-out | inline, with fable qa / fable security / two fable adversarial / docs-curator | fable | 2 | not recorded |
| interactive-compact-deferral | Ch1: probe, /goal and /loop transcript shapes | inline | not recorded | 0 | 0 (none dispatched) |
| interactive-compact-deferral | Ch2: the gate, interactive deferral clause and tests | fable | fable (pair); session model (security) | 1 | 0 ("none reporting a Critical") |
| interactive-compact-deferral | Ch3: window retune, doctor, and docs | opus (doctor) / inline (docs, fixes) | fable (pair); session model (security) | 1 | 0 ("no Criticals") |
| interactive-compact-deferral | Ch4: close-out | qa / fable adversarial / docs-curator / fable (fix); inline (adjudication) | fable (adversarial); not recorded for qa and docs | 1 | 0 ("no Criticals across the effort") |
| kit-goal-queue | Ch1 through Ch8 (8 Chapters) | not recorded | not recorded | not recorded | not recorded |
| reviewer-effort-compensation | Ch1: effort pins on the four agent definitions | sonnet | not recorded (pair skipped) | 0 | 0 (pair skipped) |
| reviewer-effort-compensation | Ch2: the compensation rule in executing-work | inline | fable, escalated to opus/`max` (fable limit reached) | 1 | 0 (both reviewers) |
| reviewer-effort-compensation | Ch3: the unavailability rewrite in finishing-work | inline | opus/`max` (fable stayed exhausted) | 1 | 0 (both reviewers) |
| reviewer-effort-compensation | Ch4: carry the Workflow authorization in the doctrine | inline | opus/`max` (compensated route) | 1 | 0 (both reviewers) |
| reviewer-effort-compensation | Ch5: record findings, close the parked backlog item | inline | not recorded (none dispatched) | 0 | 0 (none dispatched) |
| reviewer-effort-compensation | Ch6: close-out, five sections plus finishing | inline orchestrating; sonnet (S1) | opus/`max` after the first fable attempt | 4 per-section + finishing pair | 0 across all rounds |
| standing-watch | Ch1: the standing-watch skill | opus | fable | 1 | not recorded |
| standing-watch | Ch2: four doctrine lines and one Before-you-send question | opus | fable | 1 | 0 ("no Criticals") |
| standing-watch | Ch3: the two-question grant audit | sonnet | opus, effort `xhigh`, via Workflow | 1 | not recorded |
| standing-watch | Ch4: close-out | inline, with fable qa / security / adversarial / docs-curator | fable | 1 | not recorded (uses "Gates:" not "Review Findings:") |
| stop-failure-recovery | Ch1 through Ch4 (4 Chapters) | not recorded | not recorded | not recorded | not recorded |

Two plans, `kit-goal-queue` and `stop-failure-recovery`, write free-form prose Chapters carrying only a `Completed:` line, with no `Implemented By:`, `Metrics:`, or `Review Findings:` fields at all, so all twelve of their metric cells are genuinely absent rather than missed. Their Chapter headings also use `### Chapter N: <title> (YYYY-MM-DD)` rather than the frozen `### Chapter N - YYYY-MM-DD` shape, which is what caused the scout's first pass to report their `Completed:` lines as absent too; the rows above are the corrected reading, confirmed by reading both files directly.

Decisions / Surprises: The writing-skills call, made before editing: no RED/GREEN behavior test. That skill's form table matches a test to a failure, and the failure here is not "knows the rule, skips it under pressure" - the bump rule is already obeyed - but a change to the rule's parameter values. A probe would re-measure compliance with a rule whose compliance was never in question, so it would tell us nothing about the change. The skill's one-owner-per-rule rule did bind and was applied: the rule is stated once in executing-work step 3, and `brainstorming`, `docs/architecture.md`, and `docs/backlog.md` carry pointers rather than second statements.

Two spec-vs-tree conflicts surfaced during the acceptance grep, both resolved without editing out of scope. First, `docs/README.md:31` contains `one-tier-above-the-writer` inside the archive-narrative index, an append-only record of what an already-shipped plan delivered; the doctrine exempts append-only history and the README's own preamble disclaims currency, pointing readers to `architecture.md` and the skills. Editing it would falsify a historical record, so it stands. The same entry also says reviewer effort "is now chosen per dispatch from two questions," which this change replaces with one; that is flagged for the docs curator at the finishing pass rather than fixed here. Second, the plan doc itself hits every banned phrase, because it quotes them as the strings to eliminate; that self-hit disappears when the plan archives in this same delivery.

The `node --test test/*.test.js` command the spec names as the gate does not run on this machine, as recorded in the baseline block above. Substituted with the glob form; no spec change needed since the spec names the gate by intent rather than pinning the invocation.

Assumptions: assumed 2026-08-19 (executing-work step 1, section 1): the section runs inline despite its `Model: opus` tier, because it writes under `docs/` and the docs-write-guard denies a dispatched implementer that write; reversal: none, the guard is mechanical. assumed 2026-08-19 (doctrine append-only exemption, section 1): `docs/README.md`'s archive narrative is out of the acceptance grep's reach as history rather than live rule text; reversal: one phrase in that entry if a later session decides the narrative should carry the current rule. assumed 2026-08-19 (default, section 1): the acceptance grep is read against the post-archive resting state, so the plan doc's own quotation of the banned phrases does not count as a hit; reversal: none, it self-resolves at archive.

Review Findings: 2 Critical, 1 Major, 6 Minor raised across the pair; 6 fixed, 4 rejected with reasons, none survived unaddressed.

Fixed: (1) the cap phrasing, flagged independently by both reviewers, was ambiguous as written - "one tier up, capped at opus" reads as `min(writer+1, opus)`, which yields opus for a fable-tier section and contradicts the rule's own "fable at fable" enumeration; reworded one-directionally in both executing-work and `docs/architecture.md` so the bump never lifts past opus and never pulls below the writer's own tier. (2) "An untiered section takes the inline rule" contradicted step 1, which dispatches a clearly-briefable untiered section at the tier it would have earned; reworded to take whichever tier actually built it. This is a deviation from the spec's edit item 1, which directed the inline rule flatly; the spec was written without noticing step 1's briefable-untiered path, and the fix preserves the spec's stated ground (the writer tier is what actually built the section) rather than changing design intent. (3) the one-question generator named a model's own level only for Fable and Opus, leaving the sonnet-over-haiku pairing underivable; the yes-branch now closes with the frontmatter default for any other model. (4) brainstorming's "stop at opus" read as "run at opus," false for haiku sections; now "climb no higher than opus." (5) the backlog item's untouched middle still described the retired aimed-at-versus-stand-in effort generator; the amendment now supersedes it explicitly. (6) the backlog amendment's pointer to Chapter 1 of the archived plan, flagged as pointing at nothing, is made true by this Chapter landing and the plan archiving in this same delivery.

Rejected, with reasons: the blind reviewer's Major, that a haiku-tier section's security review is force-overridden from the session default down to sonnet, is factually correct about the behavior but is a cost the spec states and accepts by name ("haiku sections drop to sonnet," in the "What it costs, argued" paragraph). The reviewer could not see that, by contract. Adding a haiku floor would be a second exception where the spec deliberately allows one, so it stands as specified; it is the finding most worth revisiting if the tier census ever shows haiku sections firing the security trigger, which it does not today (1 haiku section in 138). The related Minor, that a fable-tier section's security defect now survives to the finishing pass with later sections layered on it, is the same argued trade-off and is stated in the rule's own text. The two Criticals are the `docs/README.md` and plan-doc-self-hit conflicts resolved above; neither is a defect in the changeset.

Stamps: adjudicated 1, stamped 1. `memq unstamped --since 1d` surfaced one operator-tier record, `claude-code-usage-iterations-aggregate`, read by a hook rather than by this work and skipped as not steering it. Separately stamped `docs-write-guard-blocks-subagent-doc-writes`, which decided this section's inline routing.

Next: finishing-work
Commit Model: Commit-and-Push
