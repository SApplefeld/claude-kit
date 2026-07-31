# Kit Memory Recall and Reinforcement

Status: In Progress
Commit Model: Review-Only
Fable Spend: S2, S4, S5 implementers; the per-section review pairs on those three sections (dispatch with the explicit fable override); finishing reviews
Created: 2026-07-31

Precondition: the memory-extension close-out commit (staged as of 2026-07-31) lands before execution starts, so this effort's changeset stays separable from its parent's.

## Goal

The memory store gains its recall half: `memq recall` emits a complete, budgeted, deterministic digest of every store surface (project tier, type tier, archive, outcomes journal) at effort-start, so the session's own semantic attention ranks the whole store against the current task instead of a search term guessing at it. Simultaneously the decay lifecycle gains reinforcement: frequency of application mechanically extends a memory's decay thresholds (capped, never permanent), a judgment-set `pinned` marker covers the rare must-never-age case, and the usage prune preserves the distinct-day evidence both mechanisms read. When this is done, a memory nobody thought to search for still surfaces at the moment of need, a heavily-used memory survives long idle stretches in proportion to its record of use, and archived memories remain scoreable and fetchable rather than invisible.

## Approach

The design was settled in a design-council run (three lenses plus neutral facilitator, two rounds, converged 2026-07-30) followed by one user-directed revision (2026-07-31). Decisions and their reasoning:

**Recall is a no-query digest the model scores; code never ranks (decided 2026-07-30).** `memq recall` takes no search term. Code's job is assembling a complete, cheap, deterministic digest: one summary line per record across all four surfaces, ordered by recency of last sign of life, inside a fixed line budget with counted, announced truncation. Ranking happens in the model reading the digest with the task in context, which is the only semantic scorer available with embeddings out of scope, and it is free. Lexical scoring was rejected by all three council lenses: substring matching misses synonyms (the exact flaw that motivated the tag registry), and a lexical miss is silent, the expensive failure shape. This is the ArkVale transfer (see References): cheap per-record digest, every digest scored against the current step, top-k recalled within a fixed budget, never a relevance threshold.

**The digest spends its budget on what the session has not seen (decided 2026-07-30).** The harness injects the project `MEMORY.md` verbatim into every session, and the session hook emits the type index at a 30-line cap. So the digest's marginal value is the dark surfaces: the outcomes journal, the archive, and the type tier beyond the hook cap. Project-tier records appear as ultra-compact lines (name, applied tally, last-alive age, no description) plus an explicit coverage line ("project tier: N records, already in session context"), a deliberate hedge: the harness injection is an upstream contract the kit does not own, so the digest keeps a floor of presence for every surface rather than silently depending on it. When the budget binds, truncation is coarse and tier-ordered, project-tier compact lines cut first, and every cut is announced with a counted remainder. Budget seed: 200 lines, named constant.

**The recall trigger is procedural, not remembered (decided 2026-07-30).** The executing-work and brainstorming skills gain an effort-start step that runs `memq recall`, the same mechanism that loads operating-instructions by rule rather than recollection. No ambient per-prompt hook: it pays context and latency on every prompt for a worse query, and the user rejected relying on model initiative.

**Frequency extends decay; it never confers permanence (decided 2026-07-31, revising the council's converged pin-primary design on the user's explicit call that permanent exemption is too extreme).** Each distinct calendar day on which a memory was applied extends both decay thresholds by a named constant, capped:

```
extension          = min(distinctAppliedDays * EXTEND_PER_APPLIED_DAY, EXTEND_CAP_DAYS)
summarize candidate = SUMMARIZE_AFTER_DAYS + extension idle days
archive candidate   = ARCHIVE_AFTER_DAYS  + extension idle days
```

Seeds: `EXTEND_PER_APPLIED_DAY = 30`, `EXTEND_CAP_DAYS = 365`. Linear-with-cap over multiplicative scaling deliberately: doubling reaches effective permanence within a handful of reinforcements (the outcome the user declined), and a linear one-liner is statable verbatim in both the code and the skill, which answers the council's strongest surviving objection to any formula (two surfaces, one truth). Distinct days, not raw counts, so one busy afternoon is one reinforcement. The seeds are invented, not calibrated (zero live applied stamps exist; the stamp hook has never run in a live session), so the edges are provisional the way the haiku implementer band's are: tune on real tallies, do not widen speculatively. The retention gradient has three nets and no cliff: mechanical extension, then judgment candidacy (crossing a threshold only nominates; the scan line shows the tally so the judgment is never blind), then the recallable archive (demotion, not amnesia).

**`pinned:` is a rare judgment override, and the tally is evidence for it, never its trigger (decided 2026-07-30/31).** A `pinned: YYYY-MM-DD` frontmatter field (inline form) makes a memory never a summarize or archive candidate. It is set by in-session judgment, proactively in the turn a memory proves out or at a decay pass, revoked by deleting the field, and every `decay-scan` lists pinned memories as a labeled, counted class so the pinned population can never grow silently. It survives the user's rejection of earned permanence because it was never count-triggered: it exists for the structural under-reporting case (system-reminder recalls never pass the Read tool, so stamps undercount true use and the formula under-extends for exactly the most ambient memories) and it is immune to sidecar loss because it travels in the memory file. Computed consolidation (a count that auto-grants exemption) is out of scope: rejected by the council as keyed to a signal with no data-generating process and silently revocable by a torn sidecar.

**The usage prune preserves the evidence the formula reads (decided 2026-07-30, all three council lenses convergent).** `usageStep` today keeps only the newest stamp per (file, kind), which destroys distinct-day history at the first `decay-prune --rollup`. It instead folds applied stamps into one per-file rollup record carrying `{distinctDays, firstApplied, lastApplied}`, the symmetric twin of the journal rollup preserving pass/fail tallies. The fold's invariant: re-running it never double-counts a calendar day and never loses one; a raw stamp on an already-counted day adds nothing. `firstApplied`/`lastApplied` ride along so future policy (interval tuning, a spacing criterion) stays computable from pruned data. Read stamps keep today's newest-only prune.

**Evidence absence is loud, never silent (decided 2026-07-30, facilitator finding).** `readUsage` fail-opens to an empty list, so a lost `usage.jsonl` today silently reads every memory as never-applied, and under this design it would additionally zero every extension. `decay-scan` therefore always prints a standing evidence line reporting what it read ("usage evidence: 14 stamps across 5 files" / "usage evidence: none (no usage.jsonl)"), unconditional rather than a heuristic warning, so a fresh store and a lost sidecar are both legible and neither alarms falsely.

**The archive becomes scoreable and fetchable; these fixes gate recall (decided 2026-07-30, facilitator ruling).** Three as-built facts would otherwise reduce the digest's marginal value to the journal alone: `archiveStep` destroys the index line (the archived memory's description) at eviction; `memq get` resolves project then type tier and can never reach `memory/archive/`; and `memq get` stamps nothing, so a digest-driven workflow would thin the read-evidence floor exactly as the store matures. The fixes: archiving appends the retiring index line to an archive-side index (`memory/archive/MEMORY.md`), `get` falls through to the archive with the hit labeled on stderr like a type-tier hit, and `get` appends a `read` stamp on memory-file hits in any tier.

**Repo constraints honored.** `session-start.js` stays untouched. The doctrine copies need no change: the parent effort's pointer bullet already routes memory mechanics to the memory-system skill, which this effort extends. New behavior-shaping skill text takes the writing-skills RED/GREEN check. All shared predicates (the distinct-day tally computation, the last-sign-of-life clock) are single-sourced functions, per the parent's standing amendment.

## Standing Brief Amendments

Carried verbatim from the parent effort (`claude-kit_memory-extension_spec_v1.md`); folded into every dispatch brief.

- **No subagent writes anywhere under `~/.claude/`.** Implementers build and test exclusively against the test-only env override pointed at a temp directory; every live write to the real store is the main thread's, so it can be named in the close-out with its undo line.
- **Bound every value at the write boundary, not only at display.** Any value that reaches a JSONL line gets its length and charset enforced before serialization.
- **A comment claiming single-sourcing must be true, and a shared predicate lives in one place.** When two components decide the same question, export one function and have both call it.
- New for this effort: **spec code citations are anchors, not gospel.** Sites are cited by function name with line numbers as of 2026-07-31; verify against the working tree before editing.

## Sections of Work

### 1. Archive scoreability and get read-stamping
Model: opus
The three gating fixes, in `plugins/claude-kit/scripts/memq.js`:
- `archiveStep` (~1443-1468): when moving a memory file to `memory/archive/`, append the index line being pruned to `memory/archive/MEMORY.md` (create on first archive), so the description survives eviction and the digest scores the archive with one file read. Same tier-lock posture as the rest of the pass.
- `cmdGet` (~1045-1058): fall through project tier, then type tier, then `memory/archive/`; an archive hit is labeled on stderr the way a type-tier hit is. `tierDirFor`'s no-nesting rule (~216-231) stays for writes; the archive path is read-only resolution.
- `cmdGet` appends a `{ts, file, kind: "read"}` stamp to the resolved tier's `usage.jsonl` on memory-file hits (project, type, and archive tiers; archive stamps go to the project sidecar). Journal-key hits stamp nothing. Fail-open: a failed stamp never fails the `get`.
Acceptance: archive a memory via `decay-prune --archive`, then `recall`-shape data survives (its description line is present in `memory/archive/MEMORY.md`) and `memq get <name>` returns its body with the archive label; a `get` of a project memory and a type memory each append one read stamp; a `get` with an unwritable usage sidecar still returns the body.
Tests: both directions of the fallthrough (live name wins over archived same-name; archived-only name resolves), the stamp on each tier, and stamp failure not failing the read.

### 2. Evidence layer: the usage fold and the loud evidence line
Model: fable
In `memq.js`:
- `usageStep` (~1400-1438): applied stamps fold into one per-file rollup record `{ts, file, kind: "applied-rollup", distinctDays, firstApplied, lastApplied}` (exact field names at implementer's discretion, bounded at the write boundary). Invariant: folding is idempotent across repeated prunes; a raw stamp on a calendar day already counted by the rollup adds nothing; a raw stamp on a later day increments `distinctDays` and advances `lastApplied`. Read stamps keep the newest-only prune. `isUsageStamp` accepts the rollup shape.
- The distinct-day tally computation (rollup plus unpruned raw stamps) is one exported function; S3's formula and S4's digest lines both call it.
- `decay-scan` always prints the standing usage-evidence line (count of stamps and files read, or "none" with the reason: no file vs. unreadable). Unreadable-but-present is distinguished from absent, matching `readUsage`'s (~566-576) existing ENOENT split.
Acceptance: a store pruned twice reports the same `distinctDays` as pruned once (idempotency); stamps on three distinct days across a prune boundary yield `distinctDays: 3`; two stamps the same day yield 1; the evidence line appears on every scan in both directions (populated and absent).
Tests: lock the fold invariant both directions (no double-count, no loss), the same-day rule, and the evidence line's absent/unreadable split. The Windows fs-failure preload pattern applies where fault injection is needed.

### 3. Frequency-extended thresholds and the pinned override
Model: opus
In `memq.js`, `tierDecayCandidates` (~1182-1223):
- New named constants beside `SUMMARIZE_AFTER_DAYS`/`ARCHIVE_AFTER_DAYS` (~127-128): `EXTEND_PER_APPLIED_DAY = 30`, `EXTEND_CAP_DAYS = 365`. Effective thresholds per memory: base plus `min(distinctDays * EXTEND_PER_APPLIED_DAY, EXTEND_CAP_DAYS)`, tally from S2's shared function. The scan stays write-free and deterministic.
- A `pinned: YYYY-MM-DD` frontmatter field (inline form, read by the existing frontmatter walk) makes a memory never a summarize or archive candidate; `decay-scan` still lists it, labeled, and prints the pinned class count.
- Scan candidate lines gain the tally: `applied <date> (<n>d distinct)`.
Acceptance: a memory with `distinctDays: 6` (extension 180, summarize boundary 30 + 180 = 210) is a summarize candidate at 210 idle days and not at 209; a zero-tally memory is a candidate at 30 idle days, matching as-built behavior; the cap holds: `distinctDays: 20` caps the extension at 365, so the summarize boundary is 395 idle days and does not grow with further tally; a pinned memory idle 400 days is listed with the pinned label and is not a candidate; removing the field restores candidacy.
Tests: both threshold directions at the boundary, the cap, and both pin directions.

### 4. memq recall
Model: fable
New subcommand in `memq.js`. No query argument. Output, in order, all deterministic formatted lines:
- Coverage header: one line per surface with its record count, including "project tier: N records, already in session context".
- Journal keys: `find`-style aggregated lines (key, pass/fail tally, last age, latest summary), reusing the existing per-key aggregation.
- Archive: name, tags, description (from `memory/archive/MEMORY.md`, per S1), archived age.
- Type tier: compact lines (name, tally, last-alive), full tier subject to budget.
- Project tier: ultra-compact lines (name, applied tally from S2's shared function, last-alive age, no description).
Ordering within each surface: last sign of life descending, name as tiebreak; byte-stable for identical store state within a coarse age bucket (the `find` posture). Total output capped at `RECALL_MAX_LINES = 200` (named constant); truncation is tier-ordered (project compact lines first, then type, then oldest archive; journal last) and every truncated surface prints a counted remainder naming the narrowing move (`... and N more archive lines; memq find <term> reaches them`). No lexical scoring anywhere.
Acceptance: a store populated across all four surfaces yields all four sections with correct counts; identical store state yields byte-identical output within an age bucket; with a test-lowered budget, truncation announces counted remainders per cut surface and journal lines survive; output for the real project store behaves.
Tests: section presence and ordering determinism, the budget trip with announced remainders, and the empty-surface case (a surface with zero records still prints its coverage line).
References: the converged council synthesis in this spec's Approach; ArkVale's budget-not-threshold lesson per References below.

### 5. Skill wiring and docs
Model: fable
- `plugins/claude-kit/skills/memory-system/SKILL.md`: `recall` joins the memq reference table; the reinforcement formula stated verbatim as the constants express it; the pin rule (a judgment act, set in the turn a memory proves out or at a decay pass, revocable, counted every scan; the tally is evidence for the pin, never its trigger); the standing evidence line; `get` now stamps reads (revise the Known Limits entry that says type bodies fetched through `get` stamp nothing); the recall-time applied-stamp rule (in the turn you act on a recalled record, `memq touch <name> --applied`).
- `plugins/claude-kit/skills/executing-work/SKILL.md` and `plugins/claude-kit/skills/brainstorming/SKILL.md`: an effort-start step running `memq recall` (one step each, at the point the effort's context is being assembled). Behavior-shaping text: writing-skills RED/GREEN applies.
- `docs/architecture.md`: the memory-store paragraph gains recall and reinforcement in one or two sentences.
Acceptance: the skill covers the six new areas; the formula prose matches the S3 constants verbatim (a drifted restatement is a defect); both effort-start steps present; RED/GREEN evidence recorded in the Chapter for the behavior-shaping additions.
Tests: none mechanical beyond the existing doctrine-parity suite staying green; the RED/GREEN check is the gate here.

### 6. Verification
Model: opus
Extend `test/memq.test.js` (or sibling files named explicitly in the runner invocation, per the kit's Node 24 convention). `node --check` on every touched file; full existing suite green against a baseline captured at execution start (record the counts before any change). Real-run gate, not suite-only: in this repo against the real store, a live `memq recall` showing all four coverage lines; a `memq get` of one memory followed by a read stamp visible in `usage.jsonl`; a `decay-scan` showing the evidence line and, after pinning one memory in a scratch store via the env override, the pinned class count. Live writes to the real store are the main thread's only, named in the close-out with their undo lines.
Acceptance: all new tests green; existing-suite delta zero against the captured baseline; the live round-trip behaves.

## Out of Scope

- Embeddings or vector search (unchanged from the parent spec).
- Computed consolidation: any rule where a tally automatically grants or extends a pin. The tally informs judgment and the formula only.
- An ambient per-prompt recall hook, or any change to when the harness injects `MEMORY.md`.
- Retroactive backfill of usage history (the stamp instrument starts accruing when this ships; the formula's seeds are tuned later on real data).
- Query arguments or filter flags on `recall` (add only on observed need; `find` remains the narrowing tool).

## Open Questions

- The formula seeds (`EXTEND_PER_APPLIED_DAY = 30`, `EXTEND_CAP_DAYS = 365`) and the recall budget (`RECALL_MAX_LINES = 200`) are invented constants with zero live observations behind them. Tuning is empirical, on the tallies the S2 fold starts preserving; revisit at the first decay pass that has real data. Owner: Scott, on evidence.

## References

- ArkVale: "ArkVale: Efficient Generative LLM Inference with Recallable Key-Value Eviction" (NeurIPS 2024); authors' implementation and paper artifacts at https://github.com/pku-liang/ArkVale. Carried by analogy: backup-not-discard with a cheap per-page digest, score everything against the current step, recall within a fixed budget. Carried lessons: importance is dynamic (eviction must stay reversible and the archive scoreable) and recall rides a budget, not a threshold. Not carried: the vector-geometry scoring mechanism.
- The design-council record (three lenses, neutral facilitator, two rounds, 2026-07-30) lives in the session journal; its converged synthesis and the user's 2026-07-31 revision are restated in full in this spec's Approach, which is the surviving record.

## Related

Builds directly on `archive/claude-kit_memory-extension_spec_v1.md`, which shipped the store this effort adds recall and reinforcement to: the `memq` CLI, the outcomes journal, the decay lifecycle, the usage sidecar, and the type tier. The parent's Standing Brief Amendments carry forward verbatim.

## Chapters

(Appended by executing-work as sections complete.)
