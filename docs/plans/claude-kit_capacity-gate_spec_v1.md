# A fable dispatch checks the meter before it pays the ladder

Status: Ready
Commit Model: Commit-and-Push
Created: 2026-08-31

Session model: any executor session in the kit repo; three sections, tiers per section. Authored by the KIT: Expert seat from NEO-CLAUDE's kaizen note (committed at 6aab3dd) and the operator's design ruling in the same evening's dialog, 2026-08-31. Anchors are authoring-time; re-locate every hit by content, since earlier plans in both queues edit the same skills.

## Dispatch Authorization

Authorized 2026-08-31 by the operator at the keyboard in the expert seat's session: the pre-dispatch capacity gate end to end, ruled to ride last on the main queue ("This should probably ride behind the main queue, it's heavier"), with the per-dispatch re-read mandated in the operator's own words in the same exchange. For any session holding this plan. Per the trace rule, this section is a warrant only for a citing session that did not author it.

## Goal

A fable-override dispatch under an exhausted weekly allotment discovers the exhaustion by timing out into finishing-work's never-started ladder: the five-minute first-turn window plus the five-minute probe window, then both again for the ladder's same-model retry, roughly twenty minutes per gate, re-paid at every gate in every session for as long as the exhaustion lasts, because the trigger's fact is deliberately per-gate rather than cached. On a machine running claude-swap (the operator's account rotator), the measured answer already sits on disk: claude-swap polls the usage endpoint on its own cadence and writes `~/.claude-swap-backup/cache/usage.json` (per-account five-hour, seven-day, and per-model scoped windows, Fable among them, plus a `last429At` stamp per account) beside `~/.claude-swap-backup/sequence.json` (`activeAccountNumber`). This plan gives dispatch a read-only meter over those two files, so a downgrade is recorded as measured rather than discovered, and the ladder stays live behind the gate as the backstop for everything the meter cannot see.

Four principles, settled in the design dialog and binding on every section:

1. **The reading is good only for the dispatch it was taken for.** claude-swap rebalances the active seat as often as every 60 seconds, so within a minute the machine can go from a nearly exhausted fable window to a fresh one, or the reverse. Both files are read at every fable dispatch, the account identity is never memoized, and nothing shortens the read to once per session or once per plan.
2. **Sessions never poll the usage endpoint.** The endpoint has its own request budget that cumulative polling across surfaces saturates, and a bearer token in a tool call lands in the session transcript in the clear. The meter reads claude-swap's cache and nothing else; where the cache is absent or stale, the answer is no reading, never a fetch.
3. **The reader inherits the broker's posture verbatim.** Plaintext OAuth material sits in the credentials directory beside the cache, and the cache itself carries account emails and organization identifiers. So: exactly two files read, at fixed paths under the home directory, byte-capped, with no content logged or echoed beyond the numeric fields and timestamps the verdict needs, and the reader's output pinned to carry no email, organization identifier, or claim identifier.
4. **The gate is advisory and the ladder is the backstop.** A passing meter does not guarantee the dispatch lands (a swap can move the seat mid-dispatch; the cache's usage figures are up to a poll interval old even when the seat identity is current), so the never-started ladder stays exactly as finishing-work states it, catching transient faults and everything the meter mispredicts.

## Evidence

- The cost arithmetic: `finishing-work/SKILL.md` states the "five-minute first-turn window plus the five-minute probe window" pair; paid twice through the same-model retry gives the note's roughly twenty minutes per gate. Read in the installed skill 2026-08-31.
- The cache shape, confirmed on SCOTT-CLAUDE 2026-08-31 by a keys-only read (no values beyond the scope name): `usage.json` holds `schemaVersion` and `accounts`, each account carrying `fetchedAt`, `nextPollAt`, `pollIntervalS`, `last429At`, `backoffUntil`, `lastError`, `consecutiveFailures`, and `lastGood` with `five_hour.pct`, `seven_day.pct` (plus `resets_at`, `countdown`, `clock` where present), and `scoped`, an array of `{name, pct, resets_at, countdown, clock}` whose observed `name` is `Fable` with numeric `pct`. `sequence.json` holds numeric `activeAccountNumber` and `lastUpdated`. Fields observed absent on some accounts (`spend`, `resets_at` on some windows) are optional to every reader this plan ships.
- The privacy hazard, confirmed in the same read: account records carry `email` and `organizationUuid`, and the `credentials` directory sits beside the cache.
- Reported by NEO-CLAUDE's note and unverifiable from this repo: the broker's existing read-only mirror (`broker/usage/cache.ts` in the discord-channels repo) with its two-file allowlist and byte caps; the 84-98% weekly fable consumption that made the cost live; claude-swap's own documentation of the endpoint's request budget. The posture claims are adopted as design constraints regardless, since the local read above independently confirms the hazard they answer.
- The rotation cadence, the operator's own description 2026-08-31: claude-swap switches to the best available seat as often as every 60 seconds, balancing across accounts. This is what makes principle 1 load-bearing rather than hygiene.

## Approach

One read-only CLI, then the two skill amendments that consume it, then the sweep. No claude-swap file is ever written; no network is ever touched.

## Decisions

- Decided 2026-08-31 (operator): the plan rides last on the main queue, behind board-routing-and-homing; it is heavier than the worktree batch's skill fixes.
- Decided 2026-08-31 (operator): re-check at every fable dispatch, because the 60-second rebalance means capacity measured a minute ago describes a seat that may no longer be active.
- Decided at authoring (expert seat, declared assumption): the downgrade floor defaults to 90 (percent) and reads from `capacityGateFloor` in `~/.claude/claude-kit.local.json`, tolerantly, on the signpost pattern the compaction nudge floor uses. 90 rather than 100 because a large review dispatch started at 95% plausibly exhausts the window mid-run and lands the 429 the gate exists to avoid; the operator can move it with one config line.
- Decided at authoring (expert seat): the verdict considers the worst of the active account's scoped Fable window and its general five-hour and seven-day windows, per the note's second design catch: an account can hold fable headroom while its seven-day window is nearly exhausted, and a fable dispatch spends both.
- Decided at authoring (expert seat): the never-started-window shortening the note carries as a secondary item is out of scope; the note itself conditions it on re-measuring the first-turn tail per tier, which is a measurement task, not a section here.

## Sections of Work

### 1. The capacity reader. Model: opus

`plugins/claude-kit/hooks/capacity-read.js`, a CLI with no arguments and no configuration beyond the floor signpost. It reads exactly two fixed paths, `~/.claude-swap-backup/sequence.json` and `~/.claude-swap-backup/cache/usage.json`, each with a byte cap (refuse past 1 MB rather than parse), touching nothing else under that directory. From `sequence.json` it takes `activeAccountNumber` and `lastUpdated`; from `usage.json` the active account's `fetchedAt`, `last429At`, `backoffUntil`, and `lastGood` windows (`five_hour.pct`, `seven_day.pct`, and the `scoped` entry whose `name` is `Fable`, matched case-insensitively). Every field is read tolerantly: a missing account, window, or field degrades the verdict, never throws.

The verdict, one line on stdout, in exactly one of three shapes:

- `fable capacity: scoped N%, 7d N%, 5h N% (account <n>, fetched <age>s ago) -> dispatch` where the worst window sits below the floor and no recent-429 signal holds;
- the same reading with `-> downgrade` where the worst window is at or above the floor, `backoffUntil` is in the future, or `last429At` is newer than the scoped window's `resets_at` (absent `resets_at`, newer than one hour);
- `fable capacity: no reading (<reason>) -> ladder governs` where either file is absent, unparseable, over the cap, `activeAccountNumber` resolves to no account, or the reading is stale, meaning `fetchedAt` older than three times the account's `pollIntervalS` (absent that field, older than 30 minutes) or `sequence.json`'s `lastUpdated` older than 30 minutes, which is the claude-swap-not-running shape.

The floor is `capacityGateFloor` in `~/.claude/claude-kit.local.json`, read tolerantly, default 90. The output never carries an email, an organization identifier, a claim identifier, or any string field from either file beyond the fixed vocabulary above and the numeric readings; the no-reading reason is from a fixed set, never an error message quoting file content. Exit code 0 for all three shapes (the verdict is the text; a caller branching on exit code would collapse no-reading into one of the others).

Tests red-first, on a redirected-HOME fixture per the suite's house pattern: each verdict shape from a planted cache; the worst-of-three-windows rule (fable low but seven-day at the floor downgrades); the 429 and backoff branches; each staleness branch; each degrade branch (absent directory, absent file, oversized file, unknown account, missing scoped entry); the floor read from the signpost with the default on absence; and the privacy pin, a planted cache whose email and organizationUuid values are distinctive strings asserted absent from stdout and stderr in every verdict shape. The privacy pin's control: plant those strings, break the redaction deliberately in a fixture-local copy or assert the planted values appear in the raw file read, so the pin is proven able to speak before its silence is trusted.

Acceptance: all three verdict shapes produced from fixtures and watched red first; the privacy pin green with its control spoken; no write ever issued under `~/.claude-swap-backup` (the fixture directory's mtimes unchanged across a run, asserted); suite delta against a recorded baseline.

### 2. The dispatch sites consume the meter. Model: opus

Two skill amendments, each whole-file-reviewed per the recorded amendment defect mode, each preceded by a tree-wide grep for pins over the passages touched (`test/doctrine-parity.test.js` pins skill prose by content and by tree-walk, so enumerate structurally, not by filename).

`executing-work/SKILL.md`, at the dispatch-site prose where a fable-tier section or a fable model override is dispatched: before any fable-override dispatch, run the reader and act on its line. `-> dispatch` proceeds unchanged. `-> downgrade` dispatches at the compensation tier directly, recording the downgrade as measured in the dispatch record and the Chapter, quoting the reader's own line (the "fable at N% per claude-swap cache fetched Xs ago" form the kaizen note prescribes), never as a discovered timeout. `-> ladder governs` proceeds with the fable dispatch under the existing never-started rules, unchanged. The re-read rule is stated with its reason: the reading is taken per dispatch, immediately before it, because the machine's account rotator can change the active seat between any two dispatches.

`finishing-work/SKILL.md`, at the reviewer-defaults and ladder prose: the same three-way consumption at the reviewer dispatch sites that default to fable, and one sentence at the ladder stating its relationship to the meter: the ladder is unchanged and stays live behind a passing gate, because a passing reading is a prediction and the ladder is the observation. No window, cadence, or trigger in the ladder's own rules changes.

Acceptance: both skills state the three-way consumption with the per-dispatch reason and the measured-downgrade record form; the ladder's own rules byte-unchanged in their tests where pinned; pin sweep run before editing with its findings dispositioned in the chapter; suite delta against a recorded baseline.

### 3. The document sweep and the note's disposition. Model: sonnet

`docs/architecture.md` gains the meter where it describes dispatch tiering, in that document's register (state, not journey). Tree-wide sweep for prose stating that tier exhaustion is discovered only by timeout or that no measured capacity source exists, patterns derived at sweep time from the shipped text with a control run against the pre-change finishing-work passage first. The kaizen note that fed this plan (2026-08-31, dispatch re-discovers tier exhaustion, committed at 6aab3dd) is dispositioned by pointer to this plan in the chapter, not edited.

Acceptance: architecture current against the shipped reader (checked by reading the code fresh); sweep clean on live documents with controls spoken; suite delta against a recorded baseline.

## Out of Scope

- Shortening the never-started windows (the note's secondary item): conditioned on re-measuring the first-turn tail per tier; a measurement task for a later plan.
- Polling `api.anthropic.com/api/oauth/usage` from any session surface: barred by principle 2, permanently, not deferred.
- Any write under `~/.claude-swap-backup`, and any read there beyond the two named files.
- The broker's own mirror and the discord-channels repo: the posture source, not a surface this plan touches.
- Gating non-fable dispatches: the cost case is the fable override; a general per-tier meter can cite this plan's reader if one is ever wanted.

## Related

- `kaizen/notes-NEO-CLAUDE.md`, the 2026-08-31 tier-exhaustion note (committed at 6aab3dd): the finding and candidate design this plan executes; its three design catches are principles 1 and 3 and the worst-of-windows decision.
- `plugins/claude-kit/skills/finishing-work/SKILL.md`: the never-started ladder this plan leaves as the backstop.
- `docs/plans/claude-kit_standing-lines-and-honest-reports_spec_v1.md`: edits `executing-work/SKILL.md` in the worktree batch and runs long before this plan; re-anchor section 2's edit sites by content.
- `docs/plans/claude-kit_durable-boundary_spec_v1.md`: the signpost-config pattern (`compactNudgeFloor`) the floor here mirrors.

## Chapters
