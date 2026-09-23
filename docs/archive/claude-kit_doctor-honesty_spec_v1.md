# The doctor names the payload it judged against, redacts the store remote, reads loudly and refuses an oversized goal

Status: Complete
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

Rulings after the spec shipped: on 2026-09-23 the operator widened the installed-copy reading to the embedder, on the ground that the doctor is a one-stop shop that fixes anything broken in an install or at least reports it as inactive. On a clone run the embedder step, where the checkout reads it absent or unusable, also probes the installed copy the memq shim's resolver names, and where that copy reads ready it reports INFO trailing and `-Fix` offers no install. On the same ground, a memq FAIL whose named remedy `-Fix` cannot perform names the repair that can.

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
2. On a clone, the two checks whose expected value is a file the doctor derives from the payload and installs on the machine, the memq shim and the sync allowlist, also read the installed copy's expected value where an installed copy exists. The embedder's absent and unusable readings are judged against this payload's `memory-index.js`, the package it names and the model files it expects, so under the ruling recorded in Intent the embedder takes the installed-copy reading too, probing the installed copy only where the checkout's probe reads absent or unusable. The installed copy is the one the memq shim's own resolver returns, `installed_plugins.json` first and then the marketplace-restricted cache scan at `scripts/memq-shim.js:110-180`, reached by requiring the checkout's own `scripts/memq-shim.js` under node as a module and printing its exported `resolveMemq()`, never the copy at `~/.claude/bin` and with the shim file itself unchanged, since the shim check hashes its bytes; the allowlist is derived by the same code path pointed at that root. A machine matching the install and not the checkout reports INFO with the text `trails the checkout in hand: <installed path>` and no FAIL, one matching both reports PASS, and one matching neither reports FAIL as today. No installed copy found reads as today. The clone-only installs at 406-472 write git hooks and a signpost into the checkout itself rather than onto the machine, so they take no comparison.
3. `-Fix` is unchanged where a step reports FAIL or PASS. On a trailing INFO the memq shim's install at 638 and the embedder's at 1249 do not fire because no FAIL fired them, and the sync step skips its `Install-MemorySyncRepo` call at 978 whole, printing that the commit of pending memory changes runs from the installed copy's doctor, since that installer restores any managed file against the checkout's derivation and would perform the install the INFO exists to avoid. Where the machine matches neither copy the installs run from the checkout as today, which is the repair the operator asked for by running that copy with the flag. The remedy line at 663, 680, 1052 and 1062 names the copy it would install from.
4. Redaction is one function in `sanitize-line.ps1` that removes a URL's userinfo and keeps scheme, host, port and path, applied at every site that prints a remote. It is the channel's guard, so it is exported beside the sanitizer rather than inlined at the `$syncStatus.Remote` print. `docs/security-model.md`'s paragraph at 106 on the origin URL is rewritten to state the redaction as the channel's property.
5. Every doctor file read stops on error inside its `try`, and the `catch` reports the file as unreadable with the error's message, at the severity the step reports today (FAIL at the two `hooks.json` reads, WARN elsewhere), distinct from the wrong-answer text that step prints today. The two `ReadAllText` calls take the same shape. The doctrine-import read's `SilentlyContinue` inside an `-and` chain becomes a `try` of the same shape. At the goal-state read the read and the parse take separate `try` blocks, so an unreadable file reports as unreadable and an unparseable one keeps its parse WARN.
6. The goal step reads the file's length before parsing. Over the cap, it reports WARN "hooks read it as absent (N bytes over the 65,536-byte cap)" and still prints the plan the file names, so the operator sees both readings. The cap is spelled once, inside the `if ($isClone)` goal-state block the harness at `test/doctor-goal-state.test.js:103-127` lifts, and pinned to the hooks' constant by a test that reads both.

## Approach

**Coverage sweep.** One sweep ran on 2026-09-23 over `8005c9b5` for `pluginRoot`, `Report "FAIL"`, `Report "WARN"`, `-Fix`, `Get-SanitizedLine`, `Remote`, `Get-Content`, `ReadAllText`, `goal-state.json` and `GOAL_STATE_MAX_BYTES` over `plugins/claude-kit/doctor/`, `plugins/claude-kit/hooks/kit-goal-lib.js` and `test/`. Surfaces found are the ones the Evidence lists; every one is placed in a section below or under Out of Scope.

**Order.** Section 1 is the design-bearing one and runs first. Sections 2 to 4 are one-concern edits that run after it, and sections 3 and 4 run one after the other rather than concurrently, since both edit the goal-state read.

**Tests.** Each section's case runs the doctor section it changes through the existing PowerShell harness shape in `test/doctor-goal-state.test.js` and `test/doctor-encoding.test.js`, on Windows, skipped elsewhere as those suites are. Section 1 rewrites sections two other harnesses lift, so its lane includes `test/embedder-install.test.js`, `test/memory-sync.test.js` and `test/memq-shim.test.js`, and those harnesses define whatever the rewritten sections newly read.

**Anchors.** Section 1 runs first and moves every line below it, so sections 2 to 4 name their sites by identifier: `$syncStatus.Remote`, the six `Get-Content` reads and two `ReadAllText` calls the Evidence lists by their purpose, and `$goalStatePath`.

## Standing Brief Amendments

Binding on every dispatch made after the entry's date, and read as acceptance bullets beside the sections' own.

1. Under `-Fix`, a signpost the doctor could not read is left as found, and the report names the refusal rather than a `Wrote` line.
2. The remedy lines of the memq shim and Memory sync drift FAILs, and the Memory sync not-a-repository WARN, name the copy the repair installs from.
3. `install-memory-sync.ps1` loads `sanitize-line.ps1` only where that file is present, so the installer still loads without its sibling.

## Sections of Work

### 1. The verdict names its payload, and a checkout run separates unsafe from trailing
Model: opus

Decisions 1 to 3 in `doctor.ps1`: the clause helper on the six derived checks, the installed-copy comparison on the memq shim and the sync allowlist through the shim's resolver, the sync step's skipped fix on a trailing INFO, and the remedy lines naming the copy. The kit-doctor skill's Interpret bullets for `Memory sync` and the memq shim name the trailing INFO reading, and its path-2 sentence says a clone run reads the installed copy on those two steps. Opus because the installed-copy lookup and the three-way verdict are a design inside a 1,976-line script with no sibling.

Tests: lock that a derived FAIL names the copy in the banner's words and an underived WARN in the same check does not; that a clone run where the machine matches the installed copy and not the checkout records no FAIL for that step, red against the unchanged doctor; that one matching both records PASS; that a machine matching neither still FAILs; and that `-Fix` on the trailing case runs no install at the shim or the allowlist and skips the sync installer with the printed line, while `-Fix` on the neither case still installs, in both directions.

Acceptance:
- Each FAIL or WARN at the six derived checks whose expected value was read from `$pluginRoot` ends with a clause naming `repo clone: <path>` or `installed plugin: <path>`; the other branches of those checks are unchanged.
- On a clone with an installed copy present, the memq shim and sync allowlist steps read the installed copy the shim's resolver names and report INFO where the machine matches it alone and PASS where it matches both; `scripts/memq-shim.js` is byte-identical to `8005c9b5`.
- `-Fix` on a trailing INFO runs no install at the memq shim or the allowlist, skips the `Install-MemorySyncRepo` call and prints the line naming the installed copy's doctor for the commit; on a FAIL it installs as today.
- On a clone where the embedder reads absent or unusable against this checkout and ready against the installed copy, the step reports INFO naming the installed copy, and `-Fix` offers no install there.
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

Files in scope: `plugins/claude-kit/doctor/sanitize-line.ps1`, `plugins/claude-kit/doctor/doctor.ps1`, `plugins/claude-kit/doctor/install-memory-sync.ps1` for the redaction of the origin its not-own-repository note quotes and nothing else, `docs/security-model.md`, `test/doctor-encoding.test.js` or a sibling suite of the same shape, `test/memory-sync.test.js`, whose sync harness at 1800-1826 defines the new function beside its `Get-SanitizedLine` stub and drives the `origin:` print at 1845-1850, `test/size-budget.json` where a suite's cap moves.

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
- `install-memory-sync.ps1`'s derivation against the dot-sourced checkout, which is why the sync step skips it on a trailing INFO rather than calling it with another root. Section 2 redacts the one remote that file prints and changes nothing else in it.

## Assumptions

- assumed 2026-09-23 (source: the repository's plans): the commit model is Branch-and-PR; reversal: one header line.
- assumed 2026-09-23 (the architect): the worker runs under the kit on Windows, since the doctor suites skip elsewhere.
- assumed 2026-09-23 (source: `scripts/memq-shim.js:110-180`): the installed copy is the one the shim's resolver returns; reversal: one line, pointing the lookup at another resolver.

## Operator Verification

- After the pull request merges and the plugin update is installed, run the doctor from the installed copy and from a checkout on one machine within a minute. The installed run's banner and the checkout run's derived lines each name their copy. A checkout at the merged main matches the install, so its memq shim, allowlist and embedder steps read PASS. A checkout that leads a healthy install reads INFO trailing rather than FAIL on each step it leads: shim files or allowlist text that differ from the installed build's, or an embedder the checkout reads absent while the installed copy reads ready. `-Fix` from that checkout installs nothing.
- On a store whose remote carries a token, run the doctor and confirm the `origin:` line prints host and path only.

## Related

- `docs/backlog.md` entries retired by this plan at its finalize, now in `docs/archive/backlog-2026-Q3.md`: the doctor's relative verdict (2026-08-30), the origin URL disclosure (2026-08-21), the six reads (2026-08-30) and the oversized goal state (2026-08-24).
- The backlog entry of 2026-08-26 on the doctor's queue position stays. Decision 6 prints both the file's reading and the hooks' reading and says when they differ, which is the shape that entry proposes for the queue position.
- `claude-kit_leash-status-truth_spec_v1.md`: reads the doctor's goal step, which this plan owns.
- `claude-kit_kit-scratch-self-ignore_spec_v1.md`: makes the `.kit/` exposure step, which this plan leaves as it stands, less necessary.

## Chapters

### Interim board 1 - 2026-09-23
- Section 1 (opus, implementer-opus): implemented at 3dc8e1d6 (first green) and fix round 1 at 88d5963a, both pushed to feat/doctor-honesty. Round 1 ran adversarial, blind, security and performance at fable through the Agent tool. Its two correctness Majors were fixed in round 1: the installed-copy memq reading judged the wrapper texts against the checkout's helper, and a copied file absent from the installed copy counted as a match. Round 2 (adversarial at opus, effort high, Workflow run wf_35137b31-531, task wrgej8wwb) is in flight over the fix delta, owed because the fix touches a process spawn.
- Advisory dispositions so far: security Major on loading install-memory-sync.ps1 from an unvalidated resolver root, deferred: the containment guard goes to docs/backlog.md at close, and the security model's KIT_PLUGINS_ROOT entry naming the doctor as a second consumer rides section 2, which already edits docs/security-model.md. Security Major on absent installed files, covered by the correctness fix.
- Section 1 Minors and add-decisions are held in .kit/scratch/doctor-honesty/ (minors-section-1.md, advisory-section-1.md, add-decisions-section-1.md) for the close pass and Chapter 1.
- Gate baseline (section 1 lane: node --test test/doctor-*.test.js test/embedder-install.test.js test/memory-sync.test.js test/memq-shim.test.js), 2026-09-23 on this machine, clean worktree at d79ceb8e, no foreign runner: 144 tests, 144 pass, 0 fail, exit 0, 178 s. The implementer's post-fix run with test/size-ratchet.test.js added reported 246 of 246, exit 0 (reported, re-run owed at the close gate).
- Rulings adopted since the start: the embedder takes the copy clause only and no trailing reading (Decision 2 governs; the Operator Verification bullet naming the embedder as INFO trailing is corrected at finishing).
- Next: adjudicate round 2, run the close pass on the Minors, run the section 1 close gate, write Chapter 1, then section 2 (sonnet, with the docs/security-model.md part inline).

### Interim board 2 - 2026-09-23

- Section 1 commits: 3dc8e1d6 (first green), 88d5963a (fix 1), ae5d7eed (fix 2: a checkout that grows the shim set no longer reads a matching install as FAIL; trailing judged wholly inside the installed copy's own module), cb58a494 (fix 3: trailing requires the shim to resolve; missing-only memq FAIL takes the clause; tests pin the copy token, not the clause sentence). Round 4 (opus, high) returned APPROVED_WITH_CONCERNS. Adjudications: .kit/scratch/doctor-honesty/s1/round3-adjudication.md and round4-adjudication.md.
- Operator ruling 2026-09-23 (relay): widen the installed-copy reading to the embedder. Recorded in Intent's rulings line, Decision 2 corrected, and one acceptance bullet added to section 1. On the operator's same ground (the doctor fixes what is broken or reports it truthfully), round 4's Major, a pre-existing "did not reach memq's usage banner" FAIL whose -Fix remedy never runs, is fixed in this effort rather than backlogged.
- Section 1 fix round 4 is dispatched (opus, brief .kit/scratch/doctor-honesty/s1/fix-round-4-brief.md): the embedder trailing reading, the honest health-run remedy, and round 4's six Minors.
- Record correction for Chapter 1: cb58a494's message says every new case was watched red with the fix reverted; missing-both and missing-both-fix went red only against the control that deletes the installed-copy Missing clause (ctl2).
- Section 2 commits: 1b266d5c (first green: Get-RedactedRemote, origin print, docs/security-model.md:106 and the KIT_PLUGINS_ROOT second-consumer line), 823d38f5 (fix 1: the installer's origin note redacted at its producer, every scheme:// URL stripped, stderr read by the leak test). Round 1: adversarial Critical downgraded to Major after reachability read (the installer runs only for an adoptable store), blind APPROVED_WITH_CONCERNS, security CLEAR (3 Minor: 2 fixed, 1 refused, the query-string credential). Round 2 (sonnet, high) is in flight. Adjudication: .kit/scratch/doctor-honesty/s2/round1-adjudication.md.
- Backlog at finishing: the KIT_PLUGINS_ROOT containment guard for the doctor's installed-copy load (with a pointer from docs/security-model.md:629); the Memory sync trailing judgment's Drift-only gate and fixed managed-file count; the Foreign-marker case.
- Local state: stopped two orphaned wait-loop shells of this session's (PIDs 3360, 15472) from the Jev plan.
- Next: adjudicate section 1 fix round 4 and section 2 round 2, re-review section 1's fix round 4, then section 1 and 2 close passes, close gates and Chapters 1 and 2, then section 3.

### Interim board 3 - 2026-09-23

- Section 1: fix rounds 4 (dec7c2cc), 5 (bce3abbc) and 6 (6da9c19d) landed; round 7 is in flight with an implementer-opus. Rounds 5 to 7 kept finding fault with one remedy, the memq not-resolving FAIL. A consultant ruled on it: name no folder to delete, drop the installed-copy lookup on that path, say "the shim or the payload it ran", on a clone name the checkout's scripts/memq-shim.js first with its own repair, and keep one Fix: line naming a plugin reinstall and a doctor re-run. Round 7 implements that ruling, plus the Installed-copy header naming the embedder as a third caller and README step 7's embedder FAIL list. A round 8 review follows it.
- Section 1 round 4 added the embedder's trailing reading under the operator's widening ruling, and the not-resolving FAIL now carries the -Fix notes and the payload clause.
- Section 2: closed on code. Round 2 review's Major (install-memory-sync.ps1 outside Files in scope) was a record gap, fixed by the scope amendment in 1865eca8; the guard test landed in 95da152e, watched red against an unguarded copy loaded inside try.
- Section 3: first green 5a6d443b, fix round 1 c803a156 (an unreadable signpost is refused under -Fix, a failed rename is reported rather than claimed, both hooks.json parse errors sanitized), round 2 test 563f8177. Refused: a test of the parse-error sanitizing (no observed defect; the harness stub is a pass-through), and a double-failure .tmp note.
- Section 4: not started; it follows section 1's round 7, since both edit doctor.ps1.
- Backlog at finishing, added: whether a same-version plugin reinstall replaces a damaged cache folder (one experiment on a real install settles it; until then the doctor names no folder); the embedder is a third consumer of the resolver root in the containment-guard entry.
- Lanes run by the orchestrator this stretch: section lane 251/251 (dec7c2cc tree), 252/252 (bce3abbc), 255/255 (6da9c19d), all exit 0; doctor suites plus size-ratchet 141/141 (5a6d443b) and 144/144 (c803a156), exit 0; memory-sync plus size-ratchet 179/179 (95da152e), exit 0.

### Chapter 1 - 2026-09-23
Completed: 1. The verdict names its payload, and a checkout run separates unsafe from trailing
Implemented By: implementer-opus (first green, fix rounds 1-7), main session (round 8 author fixes in e53dfe35)
Metrics: review rounds 8, closed major-closed; provenance reconstructed from the round adjudication records, since per-round counts were not tallied as the rounds ran: at least 15 spec-traceable, 1 new-requirement (round 4's health-run remedy Major, trace none, taken into scope on the operator's 2026-09-23 widening ground rather than by a judge), 0 fix-introduced counted, rulings (0 refused, 0 declared, 0 asked); advisory: 2 findings, 0 fixed, 1 deferred, 0 refused, 1 covered by the correctness fix; NEEDS_CONTEXT 0; escalations 0; consults 1 (round 7, the memq not-running remedy)
Decisions / Surprises: Section open: a copy-naming clause helper on six doctor checks, an installed-copy lookup through the shim's own resolver, and a three-way verdict (PASS, INFO trailing, FAIL) on the memq shim and sync allowlist steps with the fix pass skipped on INFO; serves the Goal's first sentence and Intent's first Done item; adds the installed-copy comparison, which Decisions 2 and 3 name; size unknown before build, estimated under 150 lines in doctor.ps1; not building it leaves a checkout run reporting FAIL on a healthy install and -Fix from that checkout overwriting the installed shim and allowlist.
Fix round 1: the installed-copy memq comparison runs the installed copy's own Get-MemqShimStatus inside a dynamic module, plus a presence check on every copied file under the installed root; serves section 1's acceptance bullet 2 (INFO only where the machine matches the installed copy); adds no mechanism beyond the installed-copy reading Decision 2 names, reusing the sync step's module form; about 20 lines in doctor.ps1; not building it leaves a wrapper-text change reading FAIL with -Fix overwriting the install, and a file the install lacks reading as a match.
The review-round backstop was missed. Round 5's fix delta (the embedder's trailing reading loads the installed copy's memory-index.js under node) owed a sixth round, so the fifth adjudication should have stopped on the BLOCKED path with a phase analysis. Rounds 6 to 8 ran without that stop, and no kit.review.cap journal entry was logged. The operator was told on the relay once the miss was seen, after round 8 met the terminal condition. The section closes on that condition, not on an answer. Phase reading: rounds 1-4 were spec-generated (the three-way reading's reach across wrapper texts, a growing shim set, resolution, and the copy clause). Round 4's operator widening added the embedder. Rounds 5-8 circled one remedy, the memq not-running FAIL, until the round 7 consult ruled it.
Operator ruling 2026-09-23 widened the installed-copy reading to the embedder and brought the memq health-run remedy into scope. Decision 2 and section 1's acceptance were amended then (interim board 2).
Consultant ruling adopted at round 7: the not-running FAIL names no folder to delete and makes no installed-copy lookup. On a clone the checkout's scripts\memq-shim.js is named first. One Fix: line names the plugin reinstall and a doctor re-run. Whether a same-version reinstall replaces a damaged cache folder is open and goes to the backlog as one experiment.
Record correction: cb58a494's message says every new case was watched red with the fix reverted. Missing-both and missing-both-fix went red only against the control that deletes the installed-copy Missing clause.
Round 7's brief supplied a suspect-line pattern its own line 3a could never match. The implementer kept the line and changed the pattern, a Tests-floor delta. Round 8 then moved the match to the scripts\memq-shim.js path.
Assumptions: none
Review Findings: review: round 1 adversarial, blind, security, performance at fable, Agent tool; rounds 2-8 adversarial at opus, effort high, Workflow. Round 1's two correctness Majors (wrapper texts judged against the checkout's helper; a copied file absent from the install read as a match) fixed in fix round 1. Round 3's four Majors (trailing ignored Resolves; missing-both untested; the missing-only FAIL lacked the clause; a clause-sentence pin) fixed in fix round 3. Round 4's Major (a health-run FAIL promising a -Fix that never runs) fixed across rounds 4-7 under the consultant's ruling. Rounds 5-6 findings all accepted and fixed. Round 7 CHANGES_REQUIRED, fixed per the ruling. Round 8 APPROVED_WITH_CONCERNS: the suspect test's sentence pin fixed in e53dfe35. Justified-not-fixed: the reinstall-only remedy has no next step if a same-version reinstall reuses the damaged folder, on the adopted consultant ruling, with the experiment backlogged. Advisory: the security Major on loading install-memory-sync.ps1 from an unvalidated resolver root is deferred to the backlog (containment guard); the security Major on absent installed files is covered by the correctness fix. Minors: 5 fixed (lazy resolver, wrapper texts, absent copied file, resolver stderr surfaced, installed-shim wording), 0 upgraded, 6 left with the reason (a bin rehash with no measurable cost; the inherited spawnSync shape; the spec-mandated "trails" literal; leak probes and .gitattributes drift when trailing, folded into the Memory sync trailing backlog entry; "first suspect" unconditional and the persists-check keying, both on the consultant's ruling).
Stamps: adjudicated 0, stamped 0. memq was not run: the operator's standing constraint for this run bars running memq against the real ~/.claude. Hand walk over the stretch: one record bore on the work, a-pin-derived-from-its-own-constant-cannot-detect-a-change-to-it, read from its file and applied to section 4's parity-test brief. It goes unstamped under the same constraint.
Gate: close gate `node --test test/doctor-*.test.js test/embedder-install.test.js test/memory-sync.test.js test/memq-shim.test.js test/size-ratchet.test.js`, 2026-09-23 on this machine, clean worktree at c0f81dd8, no foreign runner: 266 tests, 266 pass, 0 fail, exit code 0, 180 s. Baseline on the same lane without size-ratchet at d79ceb8e: 144/144, 178 s. The lane grew by the size-ratchet suite and this plan's added cases, and wall clock is flat. Tests added in doctor-payload.test.js and embedder-install.test.js pin the three-way reading per step (trailing INFO installs nothing, observed by an unchanged bin snapshot; neither-copy FAIL; -Fix installs only off-INFO), the copy clause on every remedy (the copy token, not the sentence), the not-running remedy's shape (no folder named, the suspect line on clones only and ahead of Fix:), and the embedder's trailing leg with its not-trailing control. All run inside existing per-suite PowerShell spawns. The one retired case, damaged-unresolved, tested an answer the not-running path no longer reads.
Next: 2. The store remote prints with no userinfo
Commit Model: Branch-and-PR
Delta: 2026-09-23 on this machine, clean worktree at c0f81dd8, no foreign runner. The reading compares the worktree against HEAD, which carries every section's commits, so it shows totals and no rows.
```
repository: doctor-honesty
words: 939236 of cap 939299 across 88 curated files
test lines: 136265 of cap 136265 across 76 test files
tests: 3911
changed paths under no measured root: none; named-exclusion paths in the changeset: none, so every path this changeset touches is measured above
```

### Chapter 2 - 2026-09-23
Completed: 2. The store remote prints with no userinfo
Implemented By: implementer-sonnet (first green, fix round 1), main session (the docs/security-model.md edits, the scope amendment, the sanitizer header, the guard test)
Metrics: review rounds 2, closed major-closed; provenance 3 spec-traceable (round 1's Critical, downgraded to Major; round 1's whole-output test Major; round 2's guard-test Major), 0 fix-introduced, 0 new-requirement (round 2's out-of-scope Major was a record gap, resolved by the scope amendment), rulings (0 refused, 0 declared, 0 asked); advisory: 3 findings (security Minors), 2 fixed, 0 deferred, 1 refused; NEEDS_CONTEXT 0; escalations 0; consults 0
Decisions / Surprises: No add-decision scratch file was kept for this section, so the line is recorded here from the commits: the section adds Get-RedactedRemote in sanitize-line.ps1 and redacts the one remote install-memory-sync.ps1 prints, at its producer; serves section 2's acceptance; no mechanism beyond the redaction the section names; not building it prints a tokened origin URL into the doctor's report.
Round 1's adversarial Critical (the installer's foreign-repo note printed the raw origin) was downgraded to Major after a reachability read, since the installer runs only for an adoptable store. It was then fixed in fix round 1 at the producer.
Approval drift: section 2's Files in scope gained install-memory-sync.ps1 for the one redaction, and the Out of Scope bullet was rewritten to say section 2 changes nothing else in that file (1865eca8).
A dot-source of a missing file at a script's top level is non-terminating in Windows PowerShell 5.1, so the guard test loads inside try and asserts empty stderr. Its first draft passed against unguarded code.
Assumptions: none
Review Findings: review: round 1 adversarial, blind, security at opus, effort high, Workflow (writer sonnet); round 2 adversarial at sonnet, effort high, Workflow. Critical downgraded to Major and fixed (producer-side redaction, every scheme:// userinfo stripped). Major (the whole-output test could not reach the -Fix foreign branch) fixed. Round 2's Major (a file outside scope) fixed as a record amendment. Round 2's guard negative test added in 95da152e. Minors: 4 fixed (stdout plus stderr read, every scheme:// stripped with scp-style left alone, the no-path case, the stale sanitizer header), 0 upgraded, 2 left with the reason (a whole-doctor test of the installer note, reachable only through a race; the query-string credential, with the wording narrowed to the userinfo position instead). The KIT_PLUGINS_ROOT backlog pointer rides the finishing backlog entry.
Stamps: as Chapter 1; no record bore on this section.
Gate: the close gate named in Chapter 1 covers this section's suites (memory-sync.test.js and the doctor suites): 266/266, exit code 0, at c0f81dd8. Tests added pin the redaction of every scheme:// userinfo form, the whole-output leak test over stdout and stderr including the -Fix foreign branch, and the installer loading without its sibling (red against an unguarded copy: "threw"). Each runs in the suite's existing PowerShell spawn.
Next: 3. Every file read stops on error and names the file
Commit Model: Branch-and-PR
Delta: the reading in Chapter 1 covers this section.

### Chapter 3 - 2026-09-23
Completed: 3. Every file read stops on error and names the file
Implemented By: implementer-sonnet (first green, fix round 1), main session (the no-Fix advice test, the .tmp cleanup guard in e53dfe35)
Metrics: review rounds 3, closed clean; provenance 3 spec-traceable (the -Fix overwrite of an unreadable signpost; the false FIXED on a failed rename; the untested no-Fix advice), 0 fix-introduced, 0 new-requirement, rulings (0 refused, 0 declared, 0 asked); advisory: 0 findings; NEEDS_CONTEXT 0; escalations 0; consults 0
Decisions / Surprises: No add-decision scratch file was kept for this section, so the line is recorded here: all eight read sites take -ErrorAction Stop inside a try and report "<file> is unreadable: <message>"; serves section 3's acceptance; the refusal to write over an unreadable signpost under -Fix is the only branch added, serving the Goal's no-claimed-repair aim; not building it lets -Fix replace an operator's signpost with a two-key template.
Two read sites had no catch at all before this section (Get-DoctrineBody's ReadAllText and the doctrine file read), so an unreadable file there aborted the whole run.
Section 1's round 8 review surfaced a section 3 defect: the signpost write's catch removed whatever sat at claude-kit.local.json.tmp, a directory included, against the README's "it deletes nothing". It was fixed in e53dfe35 and reviewed in round 3, since a write outside the tree owes a round.
The unreadable-file tests hold an exclusive FileStream lock rather than changing permissions, per the run's constraint against ACL changes.
Assumptions: none
Review Findings: review: round 1 adversarial and blind at opus, effort high, Workflow; round 2 adversarial at sonnet, effort high, Workflow; round 3 adversarial at sonnet, effort high, Workflow (APPROVED, no findings). Round 1's confirmed Major (-Fix overwrote an unreadable signpost; Move-Item's failure reported FIXED) fixed in c803a156. Round 2's Major (the no-Fix advice untested) fixed in 563f8177, red against 6da9c19d's doctor. Round 2's second Major (the parse-error sanitizing untested) justified-not-fixed: no defect was observed and the harness stub is a pass-through, so a test there would pin the stub. Minors: 5 fixed (both hooks.json parse messages sanitized, the lock setup throws when not taken, two header over-claims narrowed, the .tmp cleanup guard), 0 upgraded, 1 left with the reason (a double-failure .tmp note).
Stamps: as Chapter 1; no record bore on this section.
Gate: the close gate named in Chapter 1 covers doctor-encoding.test.js: 266/266, exit code 0, at c0f81dd8. Red runs: the no-Fix advice test failed against 6da9c19d's doctor, which printed the bare "Fix: re-run doctor with -Fix." for an unreadable signpost. The pre-existing-.tmp test failed against 4272097d's doctor with ENOENT on the .tmp directory, which the old catch had deleted. Tests added pin each read site's unreadable report (a locked file per site), the -Fix refusal over an unreadable signpost with its bytes unchanged, the failed rename reported and cleaned up, the no-Fix advice to make the signpost readable, and a pre-existing item at the .tmp path surviving a failed write. Each spawns PowerShell through the suite's helpers, one spawn per case.
Next: 4. An oversized goal state is reported as one the hooks refuse
Commit Model: Branch-and-PR
Delta: the reading in Chapter 1 covers this section.

### Chapter 4 - 2026-09-23
Completed: 4. An oversized goal state is reported as one the hooks refuse
Implemented By: implementer-sonnet (first green 4272097d, fix round 1 c0f81dd8)
Metrics: review rounds 1, closed major-closed; provenance 3 spec-traceable, 0 fix-introduced, 0 new-requirement, rulings (0 refused, 0 declared, 0 asked); advisory: 0 findings; NEEDS_CONTEXT 0; escalations 0; consults 0
Decisions / Surprises: Section 4 open: adds a size read and a WARN line in the goal step; serves Decision 6 and section 4's acceptance; no mechanism beyond the clause; about 30 lines doctor.ps1; not building it leaves an unenforced leash reading PASS.
Fix round 1: over-cap branches swap their hook-behaviour sentences for one naming that no hook reads or advances the state; serves Decision 6 "says when they differ"; no new mechanism (a wording branch); about 10 lines; not building it tells the operator to wait for an advance that cannot happen.
Fix round 1: size read through System.IO.FileInfo; serves section 4 "Over the cap: WARN"; no new mechanism; 1 line; not building it lets a hidden oversized state read PASS.
Get-Item without -Force throws on a Hidden file while Test-Path and Get-Content see it. A throwaway probe on a temp file confirmed it: Get-Item threw and FileInfo read 102 bytes.
Assumptions: none
Review Findings: review: round 1 adversarial and blind at opus, effort high, Workflow. Majors fixed in c0f81dd8: over the cap, three branches kept sentences the absent line made false (a stalled queue called "normal mid-turn"); the size read missed a hidden file; the test pinned the whole report sentence. The fix delta rewrites wording branches, each pinned by a test, and touches no outward action or module, so no further round was owed. Minors: 4 fixed (other branches untested over the cap, line-number citations, "1 bytes", the fall-through comment), 0 upgraded, 3 left with the reason (a symlinked goal state, which predates this section and sits outside Decision 6, and the unbounded read of an oversized file, which Decision 6's print-the-plan requires, both to the backlog; the scratch-dependent red half, which mirrors the sibling DOCTOR_PREFIX cases and whose comment states the skip).
Stamps: as Chapter 1. a-pin-derived-from-its-own-constant-cannot-detect-a-change-to-it shaped the parity test: it pins the doctor's constant to the hooks' exported one, while the "65,536" in the over-cap assertion pins the value.
Gate: the close gate named in Chapter 1 covers doctor-goal-state.test.js: 266/266, exit code 0, at c0f81dd8. The section lane alone (doctor-goal-state plus size-ratchet) read 127/127, exit code 0. Red runs: one byte over the cap read PASS "(active)" against the pre-section doctor, and the stalled-advance over-cap case printed "Stop hook advances" against 4272097d. Tests added pin one byte over reading WARN with both readings (tokens: absent, "1 byte over", 65,536), exactly at the cap reading as before, the parity of the two constants by name, and the stalled-advance and unparseable branches over the cap with an at-cap control. Each spawns one PowerShell process through runGoalStateSection.
Next: finishing-work
Commit Model: Branch-and-PR
Delta: the reading in Chapter 1 covers this section.

### Interim board 4 - 2026-09-23

- State: finishing pass. Base ref 61a45842 (merge-base with origin/main). QA, then the review wave, have returned. The goal read is next, then one fix round, then the Minor pass, docs curation and the close.
- QA (qa-verifier, whole gate at ba698c1b): 4071 tests, 4061 pass, 2 fail, 8 skipped, exit 1, 469 s. One fail is the standing linked-worktree case in test/kit-sidecar-memory-index.test.js. The other was a regression this plan caused: test/doctrine-refresh.test.js lifts the doctor's doctrine section alone, and that section now calls Get-PayloadClause, defined outside the slice (`0 !== 1` at :333). Fixed in 51461dae with a stub, as test/doctor-encoding.test.js's harness already has; lane doctrine-refresh plus size-ratchet 111 of 111, exit 0. The file joins section 1's scope as a harness of doctor.ps1. Every other acceptance bullet passed; the two operator checks stay with the operator.
- Review wave (Workflow, fable, effort high; security, performance, adversarial over 61a45842..51461dae): adversarial APPROVED_WITH_CONCERNS, security ADVISORY, performance CLEAR.
- Advisory dispositions:
  - security Major, docs/security-model.md:104 says any allowlist drift is a FAIL, while a clone run now reads a store matching the installed copy as INFO: fix now, qualify the sentence (the leak probes still gate a FAIL).
  - security Minor, the security model's KIT_PLUGINS_ROOT entry omits memory-index.js as a third consumer and carries no backlog pointer: fix now, with the containment entry landing in docs/backlog.md at the close.
  - security Minor, the embedder trailing INFO prints four installed-copy fields unsanitized: fix now through Get-SanitizedLine.
  - security Minor, a regular file already at the signpost's .tmp path is overwritten and then removed on a failed rename: left, the unconditional write predates this plan and the blast is one stray temp file.
  - performance Minors (the unbounded over-cap read, the resolver spawn without a timeout, four small rehashes): left; the first is a backlog entry at the close, the second matches the health run's existing shape, the third has no measurable cost.
- Add decisions (owed Majors): adversarial Major 1, two sentence pins in test/doctor-payload.test.js:455 and :458, provenance fix-introduced, fix now by pinning tokens. Adversarial Major 2, the kit-doctor rationale ledger has no entries for section 1's four new skill claims and seven entries now cite shifted lines, provenance spec-traceable (section 1's scope names the ledger), fix now. Adversarial Major 3, the Chapters' finishing backlog entries and the security-model pointer are not yet written, provenance spec-traceable, fixed at the close with the drafted entries.
- Minors to the one pass: the over-cap active and unreadable branches lack the clear-or-re-arm line; the parity regex pins the `64 * 1024` spelling; a test comment cites a commit hash; the embedder test pins install-embedder.ps1's index sentence; README step 7 has a sentence over sixty words. Left: the Chapters' gate lines name no hostname, since Chapters are append-only history.
- Next: the goal read (scope-adjudicator at fable), then the fix round.

### Interim board 5 - 2026-09-23

- State: finishing pass, fix round committed at 4174e131 and pushed. Docs curation (docs-curator) is running. The close is next: backlog entries, the final Chapter, the whole gate, the archive, then the pull request.
- Goal read (scope-adjudicator at fable, 25 turns, all claude-fable-5-1): RULED, asked-but-unbuilt empty. Built-but-unasked: the security-model edits are inside section 2's Files in scope; three bounded additions are accepted and declared in the new Standing Brief Amendments block; the signpost write-failure guard goes to the operator as an ask in the close-out, with the judge recommending acceptance as declared drift.
- Fix round (implementer-sonnet; the two security-model edits applied by the orchestrator, since the docs-write guard refuses an implementer's docs/ write): every Major and Minor on interim board 4 marked fix-now is fixed in 4174e131. Red then green for the goal-state remedy line in the active branch (28 pass, 1 fail, then 29 of 29) and the unreadable branch (29 pass, 1 fail, then 30 of 30). The fix delta touches no spawn, network or outside write and adds no module, so no further review round is owed.
- Lane at 4174e131: doctor, embedder-install, memory-sync, memq-shim, doctrine-refresh, size-ratchet, ledger-preamble-parity, doctrine-parity and review-loop-provenance suites, 416 of 416, exit 0, 183 s, 2026-09-23 on SCOTT-CLAUDE with no foreign test runner.
- Resolved models: security 47, performance 37, adversarial 47 turns, all claude-fable-5-1, no substitution.
- Next: take the curator's drift report, then the close.

### Chapter 5 - 2026-09-23
Completed: finishing pass over the whole plan
Implemented By: main session (the curation fix inline, the close); implementer-sonnet (the finishing fix round); reviewers, verifier, goal read and curator dispatched
Metrics: base ref 61a45842 (merge-base with origin/main before the close merge); finishing reviews 3 lenses at fable, effort high, Workflow, resolved claude-fable-5-1 on every turn (security 47, performance 37, adversarial 47 assistant turns), no substitution; goal read at fable, 25 turns, no substitution; QA at sonnet, 74 turns; fix rounds 2 (4174e131, 7988872b); advisory: 7 findings (security 1 Major and 3 Minor, performance 3 Minor), 4 fixed, 3 left with reasons; correctness: 3 Major and 5 Minor (adversarial), all 8 fixed, 1 Minor left; docs drift: 7 items, 1 mistake fixed, 6 deviations (3 documented as built, 1 claim narrowed, 1 index fix at the close, 1 to the backlog); NEEDS_CONTEXT 0; escalations 0; consults 0 in the finishing pass
Recap: Goal: "The kit doctor's verdict tells the operator which copy of the kit it was derived from and whether a mismatch is a machine that is unsafe or a checkout that merely leads the install, so a fix pass run from a checkout against a healthy install has nothing to install. Its report never prints a credential embedded in the memory store's remote URL. A file it cannot read is reported as unreadable rather than as a wrong answer, at the severity that step reports today. A goal state larger than the size every hook honours is reported as one the hooks read as absent, beside what the file itself says."
What the tree does now: the doctor names the kit copy behind every verdict it derived from a payload. On a checkout, the memq shim, memory sync and embedder steps read INFO trailing where the machine matches the installed build and not the checkout, and `-Fix` installs nothing there. The store remote prints with its userinfo removed. Every file the doctor reads reports unreadable when it cannot be opened, including the armed plan doc. A goal state over 65,536 bytes reads WARN, saying the hooks treat it as absent, with the plan it names beside that.
Refinements during the run: the operator widened the installed-copy reading to the embedder on 2026-09-23, on the ground that the doctor is a one-stop shop that fixes anything broken in an install or reports it inactive. A consultant ruled the memq not-running remedy at section 1's round 7. The Standing Brief Amendments block was added mid-run, an edit above Chapters recorded here as approval drift: it declares three bounded additions the goal read accepted.
Waiting on the operator: one decision (the signpost write-failure guard below) and the two Operator Verification checks.
Decisions / Surprises: The goal read found nothing asked and unbuilt. It found three bounded additions, accepted and declared in the Standing Brief Amendments, and one it sent to the operator: under `-Fix` the doctor leaves an unreadable signpost as found and reports the refusal, where no section bullet asked for a refusal branch. The judge recommends accepting it as declared drift, and the close-out asks.
The docs curator found one mistake. The goal step's read of the armed plan doc caught its error silently, so a plan doc the doctor could not open reported PASS "(active)". Decision 5 asks every read to report unreadable, and section 3's site list had left this one out; it was silent before this plan too. Fixed in 7988872b, red then green: the new locked-plan-doc test read PASS before the fix and WARN after, and the goal-state suite reads 31 of 31.
The curator also found that "-Fix deletes nothing" stopped being true in section 3, which added the removal of the temp file a failed signpost write leaves. The claim is narrowed to that one removal in README.md, the kit-doctor skill, its ledger entry C018 and the doctor's header, in 7988872b. The base doctor holds no Remove-Item (0 hits, against 10 Get-Content hits as the control).
Assumptions: none
Review Findings: `review: security, performance, adversarial at fable, effort high, Workflow`; `goal read at fable, effort high, Agent tool, scope-adjudicator`, 3 built-but-unasked accepted and declared, 1 asked (the signpost guard), 0 asked-but-unbuilt. QA's one regression, test/doctrine-refresh.test.js's lifted slice missing Get-PayloadClause, fixed in 51461dae. Fixed in 4174e131: security Major, docs/security-model.md said any allowlist drift is a FAIL; security Minors, the KIT_PLUGINS_ROOT entry lacked the embedder load and a backlog pointer, and the embedder trailing INFO printed four installed-copy fields unsanitized; adversarial Majors, two sentence pins in test/doctor-payload.test.js and the kit-doctor ledger's missing and shifted entries (C037-C043 re-pointed, C044-C047 added); adversarial Minors, the over-cap active and unreadable branches' missing remedy line, the parity regex, a commit hash in a test comment, a sentence pin in test/embedder-install.test.js, and a sixty-word README sentence. Adversarial Major 3, the backlog entries, is done at this close. Left with reasons: a regular file already at the signpost's .tmp path is overwritten, since that write predates this plan; the resolver spawn has no timeout, matching the health run's existing shape; four small rehashes cost nothing measurable; the Chapters' gate lines name no hostname, since Chapters are append-only history. Docs drift: the curator added a "The doctor" section to docs/architecture.md and corrected the launcher update order and the goal-state size reading; D7, the index calling the origin URL unredacted, is fixed in docs/README.md at this close; the security model's sync paragraph over-claims (older than this plan, plus this plan's new trailing command line) and its KIT_PLUGINS_ROOT entry omitting the status-line launcher go to the backlog.
Stamps: adjudicated 0, stamped 0. memq was not run: the operator's standing constraint for this run bars it against the real ~/.claude. Hand walk: no record bore on the finishing pass.
Gate: whole gate (`node --test test/*.test.js`) over the merge of origin/main with this close-out in the tree, 2026-09-23 on this machine with no foreign test runner: 4087 tests, 4074 pass, 5 fail, 8 skipped, exit 1, 466 s. One fail is the standing linked-worktree case, `loadIndex answers a status, never a throw, for a cwd the store refuses to name` in test/kit-sidecar-memory-index.test.js, which passes from the primary checkout. Three were test/hook-canary.test.js reading a stale build stamp: the merge brought the guards plan's hook edits and the build had not been re-run before the gate, as a merge touching hooks requires. One was test/archive-chain.test.js: this close had named five entries in the indexes' archive chain where the rule holds four. After `build.ps1` and dropping the oldest chain entry, those two suites read 71 of 71, exit 0. Baseline: the QA verifier's whole gate at ba698c1b read 4071 tests, 2 fail (the standing case and the doctrine-refresh regression fixed in 51461dae), 8 skipped.
Next: none; the plan is complete
Commit Model: Branch-and-PR
Delta: measured 2026-09-23 on this machine, doctor-honesty worktree against HEAD (the merge of origin/main over 7988872b), with this close-out's plan, index, backlog and ledger edits in the tree
```
repository: doctor-honesty
words: 939634 of cap 939697 across 88 curated files
test lines: 136641 of cap 136641 across 76 test files
tests: 3927
changed paths under no measured root: 6 (6 differing from HEAD, 0 untracked), which this tool does not measure and which no row above names; named-exclusion paths in the changeset: none
```
