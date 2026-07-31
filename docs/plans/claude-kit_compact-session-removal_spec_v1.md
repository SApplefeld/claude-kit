# Remove compact-session: the skill, the engine, and the machinery that serves only it

Status: In Progress
Commit model: Commit-and-Push
Fable Spend: session is Fable-led; tier assignments below authorize dispatch spend

## Related

- `claude-kit_compaction-unwind_spec_v1.md` (archived): removed the compaction *automation* (relay, tripwire, chain mode), leaving manual compact-session. This plan completes the direction it set by removing the manual remainder. (Pointer runs one way; that plan is archived and immutable.)
- `claude-kit_backlog-sweep_spec_v1.md` (archived): the 200k-gate close-out that recorded ride-native-plus-plan-doc-recovery as the accepted default, and the field observation that an armed kit-goal leash survives native compaction - the two facts this removal stands on.

## Context

Decided 2026-07-31: option A, full removal. Scott's operative rationale, recorded verbatim in substance: usage is zero and he has found no use for it; native auto-compaction plus `/clear` between chapters plus plan-doc recovery is the working default; Anthropic guidance moved to filesystem-state recovery; git history is the just-in-case (`git revert` restores everything); the kit should stay clean and light. The engine is also the kit's largest untested in-repo surface (~2,280 lines of TypeScript with no in-repo tests) and the sole reason for the Bun runtime dependency and three doctor check blocks.

**The load-bearing distinction: engine support goes, native-compaction support stays.** The harness's own compaction still fires on long sessions, and the kit's recovery from it is untouched: the `startup|resume|compact` matchers in hooks.json, session-start.js's plan-doc recovery (including its `source === 'compact'` branch), kit-version-nudge.js's compact trigger, executing-work's post-compaction re-read rule and Chapters-as-recovery discipline, and the incidental prose in operating-instructions, writing-skills, and curating-docs templates that says plan docs survive compaction. None of those are touched by this plan. memq.js's three "compact" hits are the journal rollup's own vocabulary, unrelated; untouched.

**Machine-state residue, deliberately left:** `~/.claude/magic-compact/` on machines that ran compactions (ledger, omission caches, debug output) is inert data once nothing reads it. No doctor cleanup is added; the omission caches can hold tool output verbatim, so an automated sweep deleting them is riskier than leaving them, and the dirs are user-deletable at will. Old `[UNCOMPACTED]`-labeled sessions and their compacted successors likewise stay as ordinary transcripts.

**The leash after removal:** kit-goal-stop's compaction-genealogy ledger route exists solely to recognize a successor session the engine's CLI recorded. Native compaction preserves the session id (field-confirmed 2026-07-31: an armed overnight run auto-compacted, kept pursuing its goal, and released correctly), and with the engine gone nothing ever writes a ledger row, so the route is dead code in an enforcement hook and comes out.

## Sections of Work

### 1. Delete the skill and engine; prune the skill prose that points at them (inline, fable)

Delete `plugins/claude-kit/skills/compact-session/` entirely (SKILL.md, engine/*.ts, ATTRIBUTION.md, UPSTREAM-LICENSE.md) and `docs/compaction-engine.md`. Prose prunes, each preserving the surrounding rule's native-compaction half:

- `skills/executing-work/SKILL.md` line ~141: replace the manual-compaction offer sentence with the native stance: compaction is the harness's own; it may fire mid-run on a long session; the plan doc is the recovery spine; context pressure never stops or pauses a run and is never a reason to end a turn.
- `skills/brainstorming/SKILL.md` line ~48: the "compaction is deliberate, at my ask" clause becomes the native framing (a long stretch recovers from the plan doc; resting context stays lean by handing off, not by compacting).
- `skills/kit-goal/SKILL.md` lines ~8 and ~40: the leash outlives session swaps because native compaction preserves the session id; drop the engine-ledger inheritance language.
- `skills/kit-doctor/SKILL.md`: drop "compaction, summarizer" from the description's symptom list and remove the login-WARN paragraph (its check leaves in section 3).

Acceptance: the directory and doc are gone; a case-insensitive grep for `compact-session|compact-cli|magic-compact` across `plugins/` and `docs/` hits only kit-goal-stop.js (section 2's surface), doctor.ps1 (section 3's), and the native-support sites named in Context; full hook suite green at the 359/0 baseline (run `./build.ps1` first: hooks are untouched but the stamp must be current for the REAL_ROOT tests).

### 2. kit-goal-stop ledger-route surgery (dispatch, opus)

In `plugins/claude-kit/hooks/kit-goal-stop.js`: remove `ledgerChainReaches` and its call-site branch, the `KIT_GOAL_LEDGER_PATH` env override, and every genealogy/ledger mention in the header contract and inline comments, replacing the header's successor clause with the current fact: native compaction preserves `session_id`, so the bound session and the stopping session compare directly (field-confirmed 2026-07-31). In the test files (`test/kit-goal-stop.test.js`, and `test/kit-goal-lib.test.js` if it touches the ledger): remove the ledger-inheritance tests and any `KIT_GOAL_LEDGER_PATH` fixtures; keep every other leash behavior pinned, and the bound-vs-bystander distinction must retain both directions of coverage.

Tests: the removed tests are named in the report with the new suite count; the surviving kit-goal-stop tests still cover allow-on-complete, allow-on-BLOCKED, hold-otherwise, and bystander-allow. Acceptance: suite green with the count delta exactly the removed ledger tests; `./build.ps1` rerun so the canary manifest matches the edited hook; grep for `ledger` in hooks/ returns nothing.

### 3. Doctor, architecture, index, and backlog sweep (inline, fable)

- `plugins/claude-kit/doctor/doctor.ps1`: remove the Bun section (probe, PATH wiring, winget offer), the compact-session engine checks (`$engineDir`, engine load, `--check` layer), and the claude CLI presence/native-resolution and login probes (all engine-only; nothing else spawns the CLI); reword the ANTHROPIC_API_KEY warning to stand on its general ground (sessions on this machine silently switch to API-key billing) without the engine-scrub prose; update the header comment's capability list.
- `plugins/claude-kit/.claude-plugin/plugin.json`: description's "compaction-recovery hooks" becomes wording that cannot read as the engine (the hooks recover plan state after any session boundary, native compaction included).
- `docs/architecture.md`: remove the Compaction engine section and the engine-serving External integrations bullets (headless claude CLI, Bun, `magic-compact/` shared state); keep the native-recovery claims.
- `docs/README.md`: drop the `compaction-engine.md` bullet from Documents about the solution.
- `docs/backlog.md`: retire the three engine items (the stale-usage-fields fork, the sparse preserve-verbatim spot-check, the pre-2026-07-18 truncated-destinations audit) to a dated retirement snapshot `docs/archive/backlog-retired-2026-07-31.md` naming this effort, per the retired-because-removed convention; the audit item's closing rationale: no compacted session remains in use, and the `[UNCOMPACTED]` sources were never deleted, so nothing recoverable is lost.

Acceptance: doctor.ps1 parses and a check-mode run completes on this machine with no engine/bun/CLI-login sections in its output; the greps from section 1 now hit only the named native-support sites; the three backlog items are gone from Active and present in the retirement snapshot.

### 4. Close-out (finishing-work)

Finishing pass: qa-verifier, security review (the changeset touches an enforcement hook and the doctor script: not prose-waivable), final adversarial review, docs-curator, then curating-docs archival. Memory ledger check: the `external-engine-standdown-contract` memory references the kit's compaction machinery; verify what it claims against the post-removal kit and correct or annotate it. The kit-goal skill's own wording change (section 1) is behavior-shaping; the finishing reviews cover it.

## Chapters

(none yet)
