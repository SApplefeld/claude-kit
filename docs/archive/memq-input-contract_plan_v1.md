# memq input contract: visible caps, shared-tier refusal, repair path

Status: Complete
Commit model: Commit-and-Push (authorized 2026-08-08: "Absolutely want this fixed through whatever means you think are best... please proceed")
Model: Fable inline (main session), reviewer trio dispatched per doctrine

## Problem

A kaizen note from another session, verified in this one, identified two faces of one friction: memq's input contract is invisible at the moment of writing.

1. **Silent truncation with no repair path.** `memq log` truncates summary at `SUMMARY_CAP` (120) and `--detail` at `DETAIL_CAP` (500); `add-type`/`add-operator` truncate the description at 120 and the body at `BODY_CAP` (65536). All warn on stderr and exit 0 with a success line on stdout. On the shared tiers (type, operator) the damage is permanent: the duplicate guard refuses a rewrite, and hand edits are barred by design (the code's own comment at the index-unwind path says no lawful writer of the index exists to repair it). Two live operator index lines on this machine are truncated mid-phrase: `claude-code-hook-payload-facts` and `claude-code-mcp-tool-timeouts`. The skill reference states no caps, so there is nothing to compose against.
2. **PowerShell 5.1 quote mangling with a misleading error.** An argument containing a literal `"` is split into several arguments by PowerShell 5.1 before memq runs (reproduced: 2 args in, 3 mangled args out). memq then reports a wrong positional count, naming arguments that were supplied correctly and saying nothing about quoting. The skill's quoting paragraph is injection-framed and reassures about the PowerShell path.

Verification evidence: `plugins/claude-kit/scripts/memq.js:212-213` (caps), `1229-1232` (truncate-and-warn), `1565/1569/4941/5107` (call sites), `5143-5147` (duplicate refusal), `5170-5174` (no-lawful-writer comment), `SKILL.md:80` (quoting paragraph); empirical PS 5.1 argv test in-session.

## Design

The journal and the shared tiers get different treatment because they fail differently: the journal is append-only and self-repairing (log again), so it keeps truncate-and-warn but surfaces the cut on the stdout success line; the shared-tier index is permanent, so over-cap input is refused before anything is written.

## Sections of work

### 1. memq.js: contract enforcement and repair path

- `boundedFreeText` returns `{ text, cut, length }` so callers can act on the truncation (5 call sites, all in-file).
- `cmdLog`: keep truncate-and-warn; when a field was cut, the stdout success line says so (`logged <key> pass (summary truncated to 120 of N characters)`).
- `cmdAddType` / `cmdAddOperator`: an over-cap description (after sanitize) or over-cap body is refused with a usage error naming the cap and the actual length. Nothing shared-tier is ever silently shortened.
- `--update` flag on both commands: rewrites the index description of an existing record under the tier lock, touching nothing else. Missing name under `--update` is refused (drop `--update` to create); `--body`, `--tag`, `--machine` alongside `--update` are refused (update is description-only by design; body damage is now impossible going forward). Index line is replaced in position via `rewriteWithBackup`; if the line is missing (drifted index), it is appended.
- Quote-mangle hint: when a positional-count check fails in `log`, `add-type`, or `add-operator` and any raw argument contains a literal `"`, a second stderr line names the real cause (shell splitting, not the caller's argument order) and the fix (compose without double quotes; stored text drops them anyway).

### 2. Skill reference (memory-system SKILL.md)

- State the caps where authoring is taught: 120 for summary/description, 500 for detail, 65536 for body; journal truncates the tail with an announced cut, shared tiers refuse.
- Document `--update` in the command table rows for `add-type`/`add-operator`.
- Fix the quoting paragraph: the PowerShell path is injection-safe but PowerShell 5.1 mangles embedded double quotes before memq runs; compose memq arguments without `"` (stored text strips them regardless).

### 3. Tests (red first, in test/memq.test.js)

- add-operator/add-type refuse over-cap description (currently truncate at exit 0: red before the fix).
- `--update` rewrites the index description in place, preserves the memory file byte-for-byte and the other index lines.
- `--update` on a missing name refused; `--update` with `--body`/`--tag` refused.
- log with over-cap summary still logs and the stdout line announces the cut.
- Wrong positional count with a quote-carrying argument emits the quoting hint; without quotes it does not.

### 4. Repair the damaged records (real store)

Compose faithful ≤120-char descriptions from the two healthy bodies and run `memq add-operator <name> "<desc>" --update` against the real operator tier for `claude-code-hook-payload-facts` and `claude-code-mcp-tool-timeouts`. No type tiers exist on this machine; no other damaged lines found.

### 5. Reviews, close-out

Adversarial + blind reviewers over the changeset (base 4f9cc99), security reviewer (CLI input handling). Address findings, chapter, archive, commit and push. Memory store: run kit doctor -Fix per the standing sync nudge, then sync the store remote.

## Out of scope

Raising the 120 cap (remedy 5 of the note): it is also the display cap and index lines feed recall's fixed line budget; needs its own design round. Logged here so it is not re-litigated: deliberately deferred, not rejected.

## Chapters

### Chapter 1 - 2026-08-08
Completed: all sections (1 memq.js enforcement and --update, 2 skill reference, 3 tests, 4 live-store repair, 5 reviews and close-out)
Implemented By: main session (Fable, inline; single cohesive changeset over one file cluster)
Metrics: 1 review round (adversarial + blind + security in parallel, all at session model fable) + QA verify; 0 NEEDS_CONTEXT; 0 escalations; advisor off
Decisions / Surprises:
- The journal keeps truncate-and-warn (it is append-only and self-repairing) but the cut now rides the stdout success line with the original length; the shared tiers refuse over-cap input outright. Split by failure mode, per the plan's design note.
- `--update` is description-only by design; `--body`, `--tag`, `--machine` alongside it are refused. It replaces the index line in place, collapses drifted duplicates (create-path self-healing), and refuses before the lock when the tier directory is absent, so a typo'd repair mints no ghost directory (acquireLock creates the directory as a side effect).
- The `--update` exclusivity check runs before the cap gates so a doomed command is refused for its flag set, not for a field it would never write.
- The quote-mangle hint scans all of argv, not positionals only: PowerShell 5.1 mangling can land the stray quote in a flag-value fragment, and the message hedges with "usual cause". Reviewer suggestion to narrow it was declined for that reason.
- The body-cap refusal branch cannot be executed on Windows: the platform argv ceiling (~32KB, bisected by QA to between 32000 and 32700 chars) sits below the 65536-char cap, so the branch is verified by inspection plus its mirror-image tested description path, and carries no test. An in-process test would break the suite's no-env-mutation convention; noted as accepted coverage debt, live on non-Windows boxes where argv can carry 64KB.
- Verified pre-existing and unrelated: the two memq-shim.test.js failures on this machine reproduce on a clean HEAD worktree (8.3 short-path TEMP mismatch) and were already filed in docs/backlog.md (2026-08-06 env-failure item).
- docs claim sweep ran inline instead of a docs-curator dispatch (single-clause drift): docs/architecture.md's locked-rewriters clause now names the authoring commands and their --update repair. Archive docs untouched (append-only history). Tree-state note: the architecture.md edit is the session's own, made inside the QA bracket window deliberately; no agent produced a tree delta in any round.
Review Findings: security CLEAR (no findings; charset closure, lock discipline, and emission sanitization all verified). Adversarial Major fixed (SKILL.md now states the 65536 body cap and its refusal). Minors fixed: update-path duplicate collapse, ghost-dir refusal, exclusivity-check ordering, each with a pinning test. Minors adjudicated without code change: body-refusal test gap (platform ceiling, above), hint scope (declined, above).
Stamps: adjudicated 2, stamped 2 (claude-code-hook-payload-facts, claude-code-mcp-tool-timeouts, both --operator: their bodies are what the repair descriptions were composed from)
QA: PASS. Full suite 676 tests, 674 pass, 2 fail = exactly the pre-existing shim pair; memq.test.js alone 230/230, run twice, stable. Baseline before the work: 675 tests, 673 pass, same 2 failures. Live-store repair verified read-only by QA: both operator index lines whole, 114 and 119 chars.
Next: finishing-work (completed in the same delivery: archive via curating-docs, commit and push, store sync)
Commit Model: Commit-and-Push
