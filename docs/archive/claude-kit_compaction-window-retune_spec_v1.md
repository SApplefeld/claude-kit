# Compaction window re-tune: size the gate for the window it actually runs on

Status: Complete
Commit Model: Commit-and-Push
Fable Spend: none needed; the design is settled and the work is constants, prose, and tests
Created: 2026-08-15

## Related

- `claude-kit_boundary-gated-compaction_spec_v1.md` (archived): built the gate this plan re-tunes. Its mechanism is unchanged and its Chapters carry the live-probe evidence the design rests on. What that plan got wrong was the size of the window it was sizing for. (One-way pointer; that plan is archived and immutable.)

## Context

Decided 2026-08-15 with Scott, immediately after the parent plan closed, from his review of the shipped numbers.

The parent effort probed the harness on haiku, measured a 200,000-token context window, and wrote "a 200,000-token model window" into the code, the docs, and the spec as the design's standing assumption. Three review passes examined that assumption and correctly flagged that nothing detects a violation of it. None of them, and not the author, asked whether it was true of the model that actually runs plan sessions.

It is not. Plan sessions run `claude-opus-5` on a window near 1,000,000. The evidence is the archived `claude-kit_compaction-tuning_spec_v1.md`'s measured corpus (sessions coasting at 500-560k average context on the 1M window, production compactions firing at 500-650k) and Scott's own operating experience: context sits near 100,000 once tools and a plan doc have loaded, chapters rarely close below 200,000, and quality holds until roughly 400,000, degrading noticeably in the 700,000-800,000 range.

Every constant is therefore mis-sized by roughly 5x, and two of them are actively wrong rather than merely conservative:

- `autoCompactWindow: 135,000` fires a compaction near 100,000 consumed, which a real session reaches during setup. It would compact immediately and repeatedly.
- The safety ceiling of 140,000 sits at 14 percent of the real window. The valve allows any compaction offered at or above the ceiling, so past 140,000 the gate stands aside for everything, and since chapters rarely close below 200,000 the gate would essentially never place a compaction. The feature would be inert in exactly the conditions it was built for.

A second defect surfaced while re-measuring, independent of the sizing. On an assistant message carrying a multi-entry `usage.iterations` array, the top-level `usage` object sums `cache_creation_input_tokens` and `cache_read_input_tokens` across iterations rather than reporting the final request. Verified on this repo's own session transcript: a row reporting a top-level sum of 710,223 is three iterations of roughly 355,000 each, and its top-level `cache_read` of 708,291 is exactly the sum of the iterations' 353,812, 0, and 354,479. The valve reads that top-level sum, so on such a row it reads roughly double the true context. 27 of 430 main-thread rows in one session carried three iterations, so about 6 percent of readings are inflated.

The error direction is fail-open (overstating consumption makes the valve allow earlier, never deny longer), so nothing unsafe shipped. But an inflated reading trips the valve at roughly half the intended point, which reproduces the inertness problem in milder form, and it makes the ceiling unreliable as a number.

Superseded by this plan: the parent's claim that a session was observed surviving 951,556 tokens. That figure was itself an inflated three-iteration reading; the true peak in that session was near 477,000. No session has been observed at 951,000, and nothing here relies on one.

## Goal

The gate's constants describe the window plan sessions actually run on, and the valve reads the true current context rather than an aggregate that can double. After this, a real unattended run can be judged on whether compaction lands at chapter boundaries, rather than on constants that guarantee it cannot.

## Decisions taken (Scott, 2026-08-15)

| Setting | Was | Now | Reasoning |
|---|---|---|---|
| `autoCompactWindow` (doctor's recommendation) | 135,000 | **300,000** | The measured trigger is the configured value minus about 35,000, so this offers a compaction near 265,000 consumed, inside Scott's stated 250,000-300,000 target and clear of the setup-time floor near 100,000 |
| `SAFETY_CEILING_TOKENS` | 140,000 | **800,000** | Below the roughly 1,000,000 limit with real headroom, and at the bottom of the 700,000-800,000 band where Scott observes quality degrading, so the valve forces a compaction before a run gets bad rather than only before it dies |
| `CHECKPOINT_MAX_AGE_MS` | 15 minutes | **10 minutes** | The stale-checkpoint window that matters is a boundary closing below the trigger followed by the next chapter crossing it, which at a 265,000 trigger takes far longer than ten minutes. The floor is set by a long dispatched tool call straddling the expiry (implementers ran 6 to 12 minutes in the parent effort), so ten minutes is safe and five would be the practical floor |

The ceiling was questioned and kept deliberately. The reasoning that nearly removed it ("if we let a chapter run, it eventually auto-compacts anyway, so nothing is lost") does not hold: denying is refusing the compaction, the harness re-offers every turn and never forces, so without a ceiling the context climbs to the hard limit and the session dies outright with a prompt-is-too-long error. That was observed live in the parent effort's Section 1 probe. The ceiling's primary job is preventing a dead run; landing before the degraded band is the secondary benefit that set its exact value.

## Sections of Work

### 1. Constants, the iterations fix, and prose
Model: opus
Locus: inline

Code:
- `plugins/claude-kit/hooks/kit-compact-gate.js`: `SAFETY_CEILING_TOKENS` to 800,000, with the comment's arithmetic rewritten against the ~1,000,000 window and the degradation band rather than the retracted 951,000 observation.
- `plugins/claude-kit/hooks/kit-compact-lib.js`: `CHECKPOINT_MAX_AGE_MS` to 10 minutes, comment updated for the real trigger level.
- `plugins/claude-kit/hooks/kit-compact-gate.js`: the consumption reader takes the **last entry of `usage.iterations`** when that array is present and non-empty, and the top-level fields otherwise. The last iteration is the final request and therefore the true current context. Every existing guard holds: a non-finite, negative, or non-numeric field makes the reading illegible, and an illegible reading allows.
- `plugins/claude-kit/doctor/doctor.ps1`: `$recommendedWindow` to 300,000, with every displayed figure still derived rather than restated.

Prose, wherever the 200,000-token window assumption appears: the gate's constant comment, `docs/architecture.md`, `docs/security-model.md`, `README.md`, and `plugins/claude-kit/skills/executing-work/SKILL.md`. The assumption does not disappear, it changes value: the ceiling is still an absolute count that assumes a window, nothing detects a smaller one, and that stays disclosed. The parent plan's amended reasoning about why the doctor cannot detect it is unchanged and stays.

Tests: the pinned literals move with the constants, keeping the double-edit property (the test restates them deliberately so a constant change fails loudly). Add both directions of the iterations fix: a row with a multi-entry `iterations` array reads the last entry rather than the inflated top-level sum, and a row with no `iterations` array reads the top-level fields exactly as before. Pin the real shape observed in the wild, where the top-level `cache_read` is the sum across iterations while `input_tokens` is not.

Acceptance: `./build.ps1` before the suite; full suite green against the baseline captured at section start, with this machine's two standing memq-shim failures the only failures and the delta exactly the new tests. A doctor check-mode run on this machine shows the new recommended value and reads the new ceiling live from the hook.

### 2. Close-out
Finishing pass scaled to the changeset: a single combined adversarial-and-security review over the whole diff (it is small, one round, and the parent effort's per-section reviews cleared the surrounding code), then docs curation only if the prose sweep turns up drift beyond the files this plan names. Update the backlog's operator item to carry the new numbers. Archive per curating-docs.

## Out of Scope

- Any change to the gate's mechanism, the checkpoint contract, or the ritual. The parent plan's design is settled and live-verified; this plan changes numbers, one reader, and the prose that states them.
- Making the ceiling window-aware. The PreCompact payload carries no `model` field, so it cannot be derived at fire time. That remains a disclosed assumption rather than a detected condition, exactly as the parent plan amended it.
- Re-probing the harness. The parent effort's live evidence stands; only the window size it was generalized to was wrong.

## Operator Verification

- Unchanged from the parent plan and still the real gate: with the plugin updated and the window set, a multi-day unattended run should show compactions landing after Chapter commits rather than mid-section. What this plan buys is that the constants no longer guarantee the opposite.

## Chapters

### Chapter 1 - 2026-08-15
Completed: 1. Constants, the iterations fix, and prose
Implemented By: main session (Locus: inline)
Metrics: 1 combined review round (adversarial carrying security scope, at fable, effort high; the changeset is small and the surrounding code was cleared by the parent effort) plus 1 fix round; 0 NEEDS_CONTEXT; 0 escalations; advisor opus
Decisions / Surprises: see below.
Review Findings: 2 Major addressed, 5 Minor addressed (4 fixed here, 1 fixed as a flagged bonus outside the plan's scope).
Stamps: none surfaced
Next: 2. Close-out
Commit Model: Commit-and-Push

**Gate: 751 tests, 749 pass, 2 fail** against the 745/743/2 baseline at `aae2722`. The 2 are this machine's standing memq-shim short-path failures, unchanged. Delta is exactly the 6 new tests. Build clean. Doctor check-mode run shows the new values and reads the 800,000 ceiling live from the hook.

**The constants now describe the right window**, per the decisions table above: 300,000 recommended window (trigger near 265,000), an 800,000 ceiling, a 10-minute checkpoint bound, and a 50,000 minimum usable band in the doctor's warning, up from 20,000 which was sized against small-window turns.

**The iterations fix, and the correction the review forced.** The reader first took the LAST entry of `usage.iterations`. The review's second Major was that the rule and its evidence were not the same claim: every observed row had near-equal iterations, so "the last is the final request" was one session's coincidence standing in for a property. The two candidate rules fail in opposite directions, and the directions are not symmetric. Understating the context (a turn ending on a small internal call) keeps the gate denying a session that may be at its limit, which kills the run. Overstating trips the valve early, which costs a mistimed compaction, the pre-gate status quo. So the reader now takes the LARGEST iteration: identical on every observed row, fail-open on shapes nobody has seen. A malformed entry makes the whole reading illegible rather than being skipped, so a truncated array cannot narrow the set being maximized and pass off a smaller figure.

Verified against real harness data rather than fixtures alone: the real gate binary, run against a truncated copy of this repo's own session transcript whose newest row is a genuine three-iteration row, denies (exit 2) on a true context of 476,519 where the old reader saw the top-level aggregate of 951,556 and would have allowed.

**Bonus fix, outside the plan's scope, flagged as the review asked.** `tools/transcript-study/scan.mjs`, the corpus tool whose measurements this plan cites as evidence, read the same top-level fields and so spoke the contract the gate just abandoned. It now measures the largest iteration too, which stops the next corpus run from re-importing the inflation. Its `output_tokens` deliberately still reads the message's own figure, since only the input-side cache fields aggregate across iterations. To undo: revert that one hunk in `scan.mjs`; nothing else depends on it.

**Decisions / Surprises.**

- **The fourth instance of this effort's named defect class, in my own edit.** The operator backlog item's tail still said the ceiling assumes a 200,000-token window, contradicting the new values written into the same bullet by the same change. The Standing Brief Amendments block the parent effort added after Section 2 exists for exactly this, and it is now four for four at catching it. Fixed.
- **A retraction carried in from the parent effort.** Its Chapter 4 recorded a session observed surviving 951,556 tokens. That figure was itself the iterations artifact; the true peak was near 477,000. No session has been observed at 951,000, this plan relies on none, and the 1,000,000-token window rests instead on the archived corpus analysis and the operator's own experience.
- **An unmeasured claim hedged rather than asserted.** The doctor's no-window message said the default trigger sits above the safety ceiling. That was trivially true at a 140,000 ceiling and is an assertion at 800,000, since nothing has measured the default trigger on a 1,000,000-token window. It now reads as an expectation.
- **A restated figure removed.** The lib's comment quoted the derived trigger of 265,000, which the doctor computes from its own window and reserve. The comment now points at the derivation instead, so a future window change cannot strand it.

### Chapter 2 - 2026-08-15 (close-out)
Completed: 2. Close-out
Implemented By: main session
Metrics: finishing pass scaled to the changeset per the plan (one combined adversarial-and-security round, already recorded in Chapter 1); no separate docs-curation dispatch, since the prose sweep is this plan's own scope and the review audited it
Decisions / Surprises: none beyond Chapter 1
Review Findings: none outstanding
Stamps: none surfaced
Next: none, effort complete
Commit Model: Commit-and-Push

Backlog updated: the operator item carries the new numbers and points here. Cross-repo handoff filed and committed in `D:\sapplefeld-channels` (`docs/backlog.md`): its Discord status card computes context the same way the gate did and shows roughly double on multi-iteration turns, with the verified repro row and a pointer to this fix as a worked reference. Priority there is low by agreement, since the figure is informational on a status card where the kit's was load-bearing on a compaction decision.

Operator verification is unchanged and still the real gate: update the installed plugin first (the cache carries no compaction hooks yet), then set the window, then judge it on a multi-day unattended run.
