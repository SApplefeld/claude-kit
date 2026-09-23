# The doctor names the payload it judged against, redacts the store remote, reads loudly and refuses an oversized goal

Status: In Progress
Commit Model: Branch-and-PR
Created: 2026-09-23

Session model: the kit worker persona, on the steward's handoff by name; four sections, one at opus and three at sonnet. Authored by the architect persona on ASR-CLAUDE from the kit worker's backlog round of 2026-09-23.

## Dispatch Authorization

The kit worker persona sent five ranked backlog candidates to the steward on 2026-09-23. The operator approved all five and the steward relayed the ruling to the architect as coordinator record `ARCHITECT-8d67c288-dd78-478d-a565-e390d50027b0-18`. This plan carries the worker's item 3, the one it ranked highest in value, on its own as the worker recommended. The implementer is the kit worker persona, a session that runs this plan under the kit's executing-work skill; the steward is the session that hands it the plan, and the architect is the session that wrote it.

The steward hands this plan to the kit worker persona by name, and that handoff is the assignment. It runs on `origin/main` as it stands and waits on no other plan. It shares `docs/security-model.md` with two other Ready plans, `claude-kit_capacity-gate_spec_v1.md` and `claude-kit_jev-recollection-judge_spec_v1.md`, in different paragraphs, so whichever lands later rebases on what merged.

## Goal

The kit doctor's verdict tells the operator which copy of the kit it was derived from and whether a mismatch is a machine that is unsafe or a checkout that merely leads the install, so a fix pass run from a checkout against a healthy install has nothing to install. Its report never prints a credential embedded in the memory store's remote URL. A file it cannot read is reported as unreadable rather than as a wrong answer, at the severity that step reports today. A goal state larger than the size every hook honours is reported as one the hooks read as absent, beside what the file itself says.

## Intent

The operator's frame, in the kit worker's words he approved: the doctor stops raising false alarms during kit work and stops leaking a credential.

Done means four things the operator can see on one run. The banner's copy is named on every FAIL or WARN whose expected value the doctor derived from that copy, and a checkout run that differs from the installed build says so as a lead rather than a FAIL where the machine matches the install, so the fix pass, which acts on a FAIL, installs nothing there. `origin:` prints host and path with no userinfo. A read that fails names the file as unreadable, at the severity the step reports today. A goal state over the hooks' cap is a WARN saying the hooks read it as absent, with the plan the file names beside it.

Done does not need a new doctor step, a new flag, a change to the memory sync allowlist itself, a doctor that corrects the queue position it reads, or any change to the hooks. It does not make the doctor read the goal state through the hooks' normalizer; the doctor stays the surface that reads the raw file so it can report what the hooks refuse. It does not change which severity any step reports.

Alternatives refused:

- Having the doctor always compare against the installed build and never against the checkout. Refused, because a checkout run exists to check the checkout; what it owes is the name of what it judged and a distinction the banner alone does not make.
- A `-FromCheckout` switch gating the fix pass from a checkout. Refused by the architect at the finalize, because it made the kit-doctor skill's path and flag descriptions false and the approved item asked for the verdict to name its copy; a fix pass acts on a FAIL, and a trailing checkout no longer reports one.
- A second resolver for the installed copy, picking the newest cache folder by modification time. Refused by the architect at the finalize, because the memq shim already resolves the installed copy and the shim check's expected value is that copy's.
- Redacting inside `Get-SanitizedLine`. Refused, because that function strips characters and a URL's userinfo is a structure; a second sanitizer that knows URLs is applied where a remote prints.
- Skipping the goal-state cap because no real run approaches it. Refused by the item as approved: the security model names the doctor as the surface that flags a file the hooks refuse, and it does not flag this leg.

Rulings after the spec shipped: none yet.

Provenance: distilled by the architect persona, session `30d6d808-ccad-45e4-a606-c868636ee4e4`, from the kit worker's backlog round and one reconnaissance sweep over the checkout at `8005c9b5`.

## Evidence

Read at `8005c9b5` on 2026-09-23. Lines are in `plugins/claude-kit/doctor/doctor.ps1` unless stated; the root `doctor.ps1` only forwards to it.

- The banner at 214-219 prints `repo clone: $repoRoot` or `installed plugin: $pluginRoot`. Every derived comparison takes its expected value from `$pluginRoot`: the doctrine at 344 and 353, `hooks.json` at 514-515 and 550-551, the memq shim at 632 with its "differs from this payload's copy" detail at 657, the sync allowlist "this doctor derives" at 1010, the embedder at 1207, the gate ceiling at 1788. The summary at 1965-1976 exits 1 on any FAIL. The `-Fix` paths that install from `$pluginRoot` are the memq shim at 638, the sync repository at 978, the embedder at 1249, and the signpost and git hooks at 406-472, the last clone-only. The remedy line "re-run doctor with -Fix" prints at 663, 680, 1052 and 1062.
- The origin line at 1083 prints `Get-SanitizedLine $syncStatus.Remote 200`; `Remote` is filled from `git remote get-url` at `install-memory-sync.ps1:559`. `Get-SanitizedLine` in `doctor/sanitize-line.ps1:15-38` removes characters outside printable ASCII and caps length; nothing strips `user:token@`.
- Six `Get-Content` reads carry no `-ErrorAction Stop`: 345 (doctrine import, `SilentlyContinue`), 401 and 494 (signpost, clone and installed), 521 and 557 (`hooks.json`, goal hook and canary, whose existing `catch` at 527 reports FAIL), 1331 (goal state). Three do: 1443, 1788, 1808. Two `[System.IO.File]::ReadAllText` calls at 329 and 354 sit in no `try`.
- The installed copy has one resolver already: `plugins/claude-kit/scripts/memq-shim.js:110-180` reads `installed_plugins.json` first and then scans the cache restricted to the manifest's marketplace, exported as `resolveMemq` at 227, and the memq shim check's expected value is that copy's; `install-memq-shim.ps1:186-193` hashes the shim file's bytes against the installed copy, so an edit to the shim file reports FAIL on every installed machine until its next fix. `Install-MemorySyncRepo` at `install-memory-sync.ps1:848-874` restores any managed file that reads drifted against the dot-sourced checkout's derivation and commits pending memory changes only where both read canonical.
- `test/embedder-install.test.js:371-428` and `test/memory-sync.test.js:1803-1820` lift the embedder and memory-sync sections of the doctor into their own harnesses, defining `Report`, `Get-SanitizedLine`, `$claudeDir`, `$pluginRoot` and `$Fix` only. `test/size-budget.json:83-84` caps `test/doctor-encoding.test.js` at 278 lines and `test/doctor-goal-state.test.js` at 586, their current counts, and `test/size-ratchet.test.js` reds a file past its cap.
- `docs/security-model.md:106` states that the report prints the origin URL as configured and that the backlog carries the redaction item. `plugins/claude-kit/skills/kit-doctor/SKILL.md:15-27` describes the doctor's paths and its two flags. `README.md:174` and `183` describe `-Fix`.
- The goal step at 1324-1497 runs only on a clone and reads `$repoRoot\.kit\goal-state.json` at 1331 with no size check, warning at 1332-1333 only when the file will not parse or has no `plan`. The hooks' cap is `GOAL_STATE_MAX_BYTES = 64 * 1024` at `plugins/claude-kit/hooks/kit-goal-lib.js:626`, honoured by `readGoal` at 649-658.
- Tests: `test/doctor-goal-state.test.js` runs the goal step with `Report` stubbed; `test/doctor-encoding.test.js` covers the six reads' encoding and not their failure; no test pins the `origin:` line. Doctor suites launch `powershell.exe` and skip off Windows.

## Decisions

1. Naming the copy rides on the `Report` lines rather than on a new banner: each FAIL or WARN whose expected value was read from `$pluginRoot` carries a trailing clause naming that copy in the banner's own words, and the other branches of those checks, the doctrine import's missing-line WARNs at 346-350 and the shim's `NoPayload` and `ShadowedBy` branches at 666-690 among them, are unchanged. One helper composes the clause so the derived checks say it one way. The checks, closed at this list by their `Report` names: the doctrine import, `Kit goal hook`, `Hook canary`, the memq shim, `Memory sync` and the embedder. The gate ceiling read at 1788 reports INFO only and takes no clause.
2. On a clone, the two checks whose expected value is a file the doctor derives from the payload and installs on the machine, the memq shim and the sync allowlist, also read the installed copy's expected value where an installed copy exists. The embedder step compares no payload content, since its probe at 1272-1310 reads machine state, so it takes the naming clause and no comparison. The installed copy is the one the memq shim's own resolver returns, `installed_plugins.json` first and then the marketplace-restricted cache scan at `scripts/memq-shim.js:110-180`, reached by requiring the checkout's own `scripts/memq-shim.js` under node as a module and printing its exported `resolveMemq()`, never the copy at `~/.claude/bin` and with the shim file itself unchanged, since the shim check hashes its bytes; the allowlist is derived by the same code path pointed at that root. A machine matching the install and not the checkout reports INFO with the text `trails the checkout in hand: <installed path>` and no FAIL, one matching both reports PASS, and one matching neither reports FAIL as today. No installed copy found reads as today. The clone-only installs at 406-472 write git hooks and a signpost into the checkout itself rather than onto the machine, so they take no comparison.
3. `-Fix` is unchanged where a step reports FAIL or PASS. On a trailing INFO the memq shim's install at 638 and the embedder's at 1249 do not fire because no FAIL fired them, and the sync step skips its `Install-MemorySyncRepo` call at 978 whole, printing that the commit of pending memory changes runs from the installed copy's doctor, since that installer restores any managed file against the checkout's derivation and would perform the install the INFO exists to avoid. Where the machine matches neither copy the installs run from the checkout as today, which is the repair the operator asked for by running that copy with the flag. The remedy line at 663, 680, 1052 and 1062 names the copy it would install from.
4. Redaction is one function in `sanitize-line.ps1` that removes a URL's userinfo and keeps scheme, host, port and path, applied at every site that prints a remote. It is the channel's guard, so it is exported beside the sanitizer rather than inlined at the `$syncStatus.Remote` print. `docs/security-model.md`'s paragraph at 106 on the origin URL is rewritten to state the redaction as the channel's property.
5. Every doctor file read stops on error inside its `try`, and the `catch` reports the file as unreadable with the error's message, at the severity the step reports today (FAIL at the two `hooks.json` reads, WARN elsewhere), distinct from the wrong-answer text that step prints today. The two `ReadAllText` calls take the same shape. The doctrine-import read's `SilentlyContinue` inside an `-and` chain becomes a `try` of the same shape. At the goal-state read the read and the parse take separate `try` blocks, so an unreadable file reports as unreadable and an unparseable one keeps its parse WARN.
6. The goal step reads the file's length before parsing. Over the cap, it reports WARN "hooks read it as absent (N bytes over the 65,536-byte cap)" and still prints the plan the file names, so the operator sees both readings. The cap is spelled once, inside the `if ($isClone)` goal-state block the harness at `test/doctor-goal-state.test.js:103-127` lifts, and pinned to the hooks' constant by a test that reads both.

## Approach

**Coverage sweep.** One sweep ran on 2026-09-23 over `8005c9b5` for `pluginRoot`, `Report "FAIL"`, `Report "WARN"`, `-Fix`, `Get-SanitizedLine`, `Remote`, `Get-Content`, `ReadAllText`, `goal-state.json` and `GOAL_STATE_MAX_BYTES` over `plugins/claude-kit/doctor/`, `plugins/claude-kit/hooks/kit-goal-lib.js` and `test/`. Surfaces found are the ones the Evidence lists; every one is placed in a section below or under Out of Scope.

**Order.** Section 1 is the design-bearing one and runs first. Sections 2 to 4 are one-concern edits that run after it, and sections 3 and 4 run one after the other rather than concurrently, since both edit the goal-state read.

**Tests.** Each section's case runs the doctor section it changes through the existing PowerShell harness shape in `test/doctor-goal-state.test.js` and `test/doctor-encoding.test.js`, on Windows, skipped elsewhere as those suites are. Section 1 rewrites sections two other harnesses lift, so its lane includes `test/embedder-install.test.js`, `test/memory-sync.test.js` and `test/memq-shim.test.js`, and those harnesses define whatever the rewritten sections newly read.

**Anchors.** Section 1 runs first and moves every line below it, so sections 2 to 4 name their sites by identifier: `$syncStatus.Remote`, the six `Get-Content` reads and two `ReadAllText` calls the Evidence lists by their purpose, and `$goalStatePath`.

## Sections of Work

### 1. The verdict names its payload, and a checkout run separates unsafe from trailing
Model: opus

Decisions 1 to 3 in `doctor.ps1`: the clause helper on the six derived checks, the installed-copy comparison on the memq shim and the sync allowlist through the shim's resolver, the sync step's skipped fix on a trailing INFO, and the remedy lines naming the copy. The kit-doctor skill's Interpret bullets for `Memory sync` and the memq shim name the trailing INFO reading, and its path-2 sentence says a clone run reads the installed copy on those two steps. Opus because the installed-copy lookup and the three-way verdict are a design inside a 1,976-line script with no sibling.

Tests: lock that a derived FAIL names the copy in the banner's words and an underived WARN in the same check does not; that a clone run where the machine matches the installed copy and not the checkout records no FAIL for that step, red against the unchanged doctor; that one matching both records PASS; that a machine matching neither still FAILs; and that `-Fix` on the trailing case runs no install at the shim or the allowlist and skips the sync installer with the printed line, while `-Fix` on the neither case still installs, in both directions.

Acceptance:
- Each FAIL or WARN at the six derived checks whose expected value was read from `$pluginRoot` ends with a clause naming `repo clone: <path>` or `installed plugin: <path>`; the other branches of those checks are unchanged.
- On a clone with an installed copy present, the memq shim and sync allowlist steps read the installed copy the shim's resolver names and report INFO where the machine matches it alone and PASS where it matches both; `scripts/memq-shim.js` is byte-identical to `8005c9b5`.
- `-Fix` on a trailing INFO runs no install at the memq shim or the allowlist, skips the `Install-MemorySyncRepo` call and prints the line naming the installed copy's doctor for the commit; on a FAIL it installs as today.
- The README's doctor section and the kit-doctor skill's Interpret bullets state the three-way reading.
- `node --test test/doctor-*.test.js test/embedder-install.test.js test/memory-sync.test.js test/memq-shim.test.js` exits 0 on Windows, with the baseline recorded first.

Files in scope: `plugins/claude-kit/doctor/doctor.ps1`, `plugins/claude-kit/skills/kit-doctor/SKILL.md` and its rationale ledger where the kit's skill rule asks one, `README.md`, `test/doctor-goal-state.test.js` or a sibling suite of the same shape, `test/embedder-install.test.js`, `test/memory-sync.test.js`, `test/memq-shim.test.js`, `test/size-budget.json` where a suite's or the skill's cap moves.

### 2. The store remote prints with no userinfo
Model: sonnet

Decision 4: one exported redaction function in `sanitize-line.ps1`, applied at the `$syncStatus.Remote` print, the one site in `doctor.ps1` that prints a remote at `8005c9b5`; the section's own search over `plugins/claude-kit/doctor/` for `Remote` and `get-url` confirms that count, and any further print site it finds takes the same function. The paragraph at `docs/security-model.md:106` is rewritten to state the redaction. Sonnet because the function is a few lines with the sanitizer as its sibling.

Tests: lock that a remote of the form `https://user:token@host/path` prints as `https://host/path` with the token absent from the whole doctor output, red against the unchanged line; that an SSH form and a plain HTTPS form print unchanged; and that a value that is not a URL passes through the sanitizer alone.

Acceptance:
- No line of doctor output contains the planted token, checked over the whole output rather than the `origin:` line.
- `sanitize-line.ps1` exports the function beside `Get-SanitizedLine`, and every remote print site calls it.
- `node --test test/doctor-*.test.js test/memory-sync.test.js` exits 0 on Windows.

Files in scope: `plugins/claude-kit/doctor/sanitize-line.ps1`, `plugins/claude-kit/doctor/doctor.ps1`, `docs/security-model.md`, `test/doctor-encoding.test.js` or a sibling suite of the same shape, `test/memory-sync.test.js`, whose sync harness at 1800-1826 defines the new function beside its `Get-SanitizedLine` stub and drives the `origin:` print at 1845-1850, `test/size-budget.json` where a suite's cap moves.

### 3. Every file read stops on error and names the file
Model: sonnet

Decision 5 at the six `Get-Content` sites and the two `ReadAllText` sites, found by identifier: the doctrine import, the two signpost reads, the two `hooks.json` reads, the goal-state read, and the two `ReadAllText` calls in and beside `Get-DoctrineBody`. Sonnet because the three reads carrying `-ErrorAction Stop` are the sibling shape.

Tests: lock that a present but unreadable `hooks.json` reports FAIL naming it unreadable rather than the "does not reference the goal hook" text, red against the unchanged read; and that a readable one still reaches the wiring check.

Acceptance:
- Every `Get-Content` in `doctor.ps1` carries `-ErrorAction Stop`, and each of the eight sites has a `catch` that reports the file as unreadable at the step's existing severity; an unparseable goal state still reports the parse WARN.
- The unreadable-file case is green and its red run is quoted in the Chapter.
- `node --test test/doctor-*.test.js` exits 0 on Windows.

Files in scope: `plugins/claude-kit/doctor/doctor.ps1`, `test/doctor-encoding.test.js`, `test/size-budget.json` where the suite's cap moves.

### 4. An oversized goal state is reported as one the hooks refuse
Model: sonnet

Decision 6 in the goal step, with the cap constant pinned to `GOAL_STATE_MAX_BYTES`. Sonnet because the step already has a harness and the read is one length check.

Tests: lock that a valid goal state one byte over the cap reports WARN naming the cap and the hooks' reading and still prints the plan, red against the unchanged step; that one at the cap reports as today; and that the doctor's constant equals the hooks' constant, read from both files.

Acceptance:
- Over the cap: WARN, both readings printed, exit code unchanged from a WARN today.
- The parity case reads `GOAL_STATE_MAX_BYTES` out of `kit-goal-lib.js` by name, never by line, and compares it to the doctor's constant.
- `node --test test/doctor-goal-state.test.js` exits 0 on Windows.

Files in scope: `plugins/claude-kit/doctor/doctor.ps1`, `test/doctor-goal-state.test.js`, `test/size-budget.json` where the suite's cap moves.

## Out of Scope

The surfaces this plan changes are closed at the sections' Files in scope. Named exclusions:

- The hooks, `kit-goal-lib.js` included; the doctor reads the raw state file by design.
- The doctor's queue-position line at 1255, which the backlog entry of 2026-08-26 keeps as a decision of its own.
- The memory sync allowlist's content and `install-memory-sync.ps1`'s own installs.
- The `.kit/` exposure step, which the scratch self-ignore plan makes less necessary and this plan leaves as it stands.
- A `doctor.sh` sibling.
- `README.md:174`, which tells a fresh clone that `-Fix` sets up the shim, the sync repository and the embedder and stays true, since no flag is added and a fresh clone with no install reports FAIL.
- The severity any step reports.
- `install-memory-sync.ps1`, whose derivation against the dot-sourced checkout is why the sync step skips it on a trailing INFO rather than calling it with another root.

## Assumptions

- assumed 2026-09-23 (source: the repository's plans): the commit model is Branch-and-PR; reversal: one header line.
- assumed 2026-09-23 (the architect): the worker runs under the kit on Windows, since the doctor suites skip elsewhere.
- assumed 2026-09-23 (source: `scripts/memq-shim.js:110-180`): the installed copy is the one the shim's resolver returns; reversal: one line, pointing the lookup at another resolver.

## Operator Verification

- After the pull request merges and the plugin update is installed, run the doctor from the installed copy and from a checkout on one machine within a minute. The installed run's banner and the checkout run's derived lines each name their copy, and the checkout run reports the memq shim, allowlist and embedder as INFO trailing rather than FAIL where the install is healthy, so `-Fix` from that checkout installs nothing.
- On a store whose remote carries a token, run the doctor and confirm the `origin:` line prints host and path only.

## Related

- `docs/backlog.md` entries retired by this plan at its finalize, now in `docs/archive/backlog-2026-Q3.md`: the doctor's relative verdict (2026-08-30), the origin URL disclosure (2026-08-21), the six reads (2026-08-30) and the oversized goal state (2026-08-24).
- The backlog entry of 2026-08-26 on the doctor's queue position stays. Decision 6 prints both the file's reading and the hooks' reading and says when they differ, which is the shape that entry proposes for the queue position.

## Chapters

### Interim board 1 - 2026-09-23
- Section 1 (opus, implementer-opus): implemented at 3dc8e1d6 (first green) and fix round 1 at 88d5963a, both pushed to feat/doctor-honesty. Round 1 ran adversarial, blind, security and performance at fable through the Agent tool. Its two correctness Majors were fixed in round 1: the installed-copy memq reading judged the wrapper texts against the checkout's helper, and a copied file absent from the installed copy counted as a match. Round 2 (adversarial at opus, effort high, Workflow run wf_35137b31-531, task wrgej8wwb) is in flight over the fix delta, owed because the fix touches a process spawn.
- Advisory dispositions so far: security Major on loading install-memory-sync.ps1 from an unvalidated resolver root, deferred: the containment guard goes to docs/backlog.md at close, and the security model's KIT_PLUGINS_ROOT entry naming the doctor as a second consumer rides section 2, which already edits docs/security-model.md. Security Major on absent installed files, covered by the correctness fix.
- Section 1 Minors and add-decisions are held in .kit/scratch/doctor-honesty/ (minors-section-1.md, advisory-section-1.md, add-decisions-section-1.md) for the close pass and Chapter 1.
- Gate baseline (section 1 lane: node --test test/doctor-*.test.js test/embedder-install.test.js test/memory-sync.test.js test/memq-shim.test.js), 2026-09-23 on this machine, clean worktree at d79ceb8e, no foreign runner: 144 tests, 144 pass, 0 fail, exit 0, 178 s. The implementer's post-fix run with test/size-ratchet.test.js added reported 246 of 246, exit 0 (reported, re-run owed at the close gate).
- Rulings adopted since the start: the embedder takes the copy clause only and no trailing reading (Decision 2 governs; the Operator Verification bullet naming the embedder as INFO trailing is corrected at finishing).
- Next: adjudicate round 2, run the close pass on the Minors, run the section 1 close gate, write Chapter 1, then section 2 (sonnet, with the docs/security-model.md part inline).
