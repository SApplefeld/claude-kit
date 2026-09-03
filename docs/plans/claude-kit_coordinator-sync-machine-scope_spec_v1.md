# The store sync writes only this machine's coordinator directory and refuses an upstream write into it

Status: Ready
Commit Model: Branch-and-PR
Created: 2026-09-03

Session model: any executor session in the kit repo; three sections in order, since section 2 pins the helper section 1 introduces and section 3 rewrites the paragraphs that today state the gap as accepted. Authored by the KIT: Expert seat on a finding the SCOTT-CLAUDE machine coordinator seat routed on the operator's keyboard instruction. Anchors are authoring-time and named by function rather than line; re-locate every hit by content.

## Goal

The memory store's sync allowlist admits `coordinator/<machine>/**/*.md` from every direction with no machine axis: the outbound add stages any machine's coordinator markdown this machine happens to have modified, and the inbound screen admits an upstream tree that rewrites this machine's own board, registry entries or inbox. Both sides run one predicate, `Test-MemorySyncPathAllowed` in `plugins/claude-kit/doctor/install-memory-sync.ps1`, and the inbound screen in `plugins/claude-kit/doctor/sync-store.ps1` (`Test-SyncIncomingAllowed`) reads the whole upstream tree by that predicate rather than the change it is about to replay. So the board's single-writer contract, which the role skill states and which a cold successor seat resumes the whole machine from, holds today by the accident that no machine edits another's files, and the role skill's directory-contract paragraph says exactly that. When this plan is done: a sync from this machine can stage nothing under another machine's coordinator directory; an upstream change under this machine's own coordinator directory stands the intake down loudly with its own reason code, the same fail-closed shape an inbound leak already takes; the doctor and the sync state name the path and the direction; and the three documents that state the absence as accepted state the control instead.

## Evidence

- `Get-MemorySyncIgnoreText` and `Get-MemorySyncAllowedLeafPatterns` in `install-memory-sync.ps1`: the coordinator block re-includes `.md` at any depth under `/coordinator/` and excludes only `claims/` and the transient forms. No machine segment appears.
- `Test-MemorySyncPathAllowed`, same file: the coordinator branch returns true for any `coordinator/<anything>/...` leaf matching `*.md`, and the comment beside the claims refusal states that the outgoing add and the inbound screen share this one answer.
- `Test-SyncIncomingAllowed` in `sync-store.ps1`: screens every entry of `ls-tree -r <upstream sha>` and returns `leak` on the first disallowed one; it never reads which entries changed, so a rewrite of an admitted path is invisible to it by construction.
- `plugins/claude-kit/skills/role/SKILL.md`, the paragraph opening "The directory sits deliberately outside": states that nothing scopes a machine's directory to that machine's own writers, that the inbound screen runs the same predicate, and that a bounded audit is the whole compensating control. This plan changes the fact that paragraph describes, so section 3 rewrites it.
- The coordinator seat's report, 2026-09-03, read from the store's tracked `.gitignore`: lines 49 through 52 admit the coordinator tree, line 60 excludes claims, no machine segment anywhere. The claims exclusion's landing commit is reported by that seat and not re-verified here.
- Machine identity on this box: Node's `os.hostname()`, `[System.Net.Dns]::GetHostName()` and `$env:COMPUTERNAME` all return `SCOTT-CLAUDE`. That agreement is one machine's reading, so section 2 pins it rather than assuming it.

## Approach

The machine is the axis, and its spelling is the one the directory contract already keys on: the role skill names the machine's directory as `coordinator/<os.hostname()>/`, so the PowerShell side reads the same identity and a pin holds the two runtimes' spellings equal. Outbound, the add path stages a coordinator path only where its machine segment is this machine's own; every other coordinator path is reported as foreign rather than staged, in the same list the doctor already uses for a disallowed path. Inbound, the screen keeps its whole-tree read for the leak axis and gains a second, diff-shaped read for this one: the entries that differ between the merge base and the upstream commit, filtered to `coordinator/<self>/`, and any entry there refuses the intake with a new fixed reason code, `inbound-foreign-write`, standing the run down exactly as `inbound-leak` does, with no merge and no push. Refusal rather than silent revert is deliberate: the existing gate's direction is that a store whose contents the machine cannot vouch for is not rebased into the live root, and a foreign write to this machine's board is the same class, whose repair is the operator's to make with the offending commit named.

Two things this plan does not do. It does not authenticate a writer: a local session can still write any file in the directory directly, which the role skill states and the security model accepts, and the machine axis narrows the sync channel only. And it does not scope reads: every machine still receives every other machine's coordinator directory, since reading a peer machine's board is what the directory exists for.

## Decisions

Decided 2026-09-03 by the Expert seat; reversible at arming.

1. **Fail closed on an inbound foreign write, matching the leak gate.** A silent local-wins revert would rebase over the foreign commit and leave a store whose history carries a write the machine never saw. The refusal names the commit and the path, and the operator repairs the upstream.
2. **The Admin request inbox is inside the scope, not exempted.** The role skill contemplates two machines appending to one `admin-requests.md` across a sync window and names that as an unresolved concurrency gap; under this plan a machine writes only its own inbox, so the cross-machine append is refused outbound and the gap closes by construction rather than by a merge rule. A request for another machine's Admin seat goes to that machine's coordinator over messaging, which the peer-sessions skill already routes. This is the one decision the operator may want to reverse at arming, since it removes a path the contract text currently entertains; the exemption, if taken, is `admin-requests.md` alone with the union merge the journals already use.
3. **Case-exact matching on the machine segment.** Git paths are case-sensitive and the directory is written by `os.hostname()`; the PowerShell reading is compared byte-exact rather than case-folded, and the pin in section 2 is what makes a divergent spelling loud instead of silently foreign.

## Sections of Work

### 1. The sync channel gains the machine axis on both sides. Model: opus

In `install-memory-sync.ps1`, add `Get-MemorySyncMachineName` (one reading, `[System.Net.Dns]::GetHostName()`, which is what `os.hostname()` returns on the platforms the kit runs) and `Test-MemorySyncCoordinatorPathIsOwn -RelativePath -Machine`, true only where the path's second segment equals the machine byte-exact; the claims refusal stays in `Test-MemorySyncPathAllowed` untouched. Route the add path through the new predicate so a foreign coordinator path lands in the doctor's disallowed list with the word `foreign` and the machine segment it carries. In `sync-store.ps1`, after `Test-SyncIncomingAllowed` returns `ok`, run `git diff --name-only --diff-filter=ACDMRT <merge-base> <upstream sha> -- coordinator/<self>/` with the same fixed sha the screen used; any line refuses with `inbound-foreign-write`, recorded through `Write-SyncGateState` with the path list and the upstream sha, and the run ends before the rebase. A merge base that cannot be resolved defers the run as the existing unreadable states do rather than passing. Tests in `test/memory-sync.test.js` on its existing harness, each watched red first: an add over a fixture store carrying a modified file under a foreign machine's directory stages nothing there and reports it; the same under the own machine's directory stages; an upstream fixture commit touching `coordinator/<self>/board.md` refuses with the new code and leaves the tree at the pre-sync commit; one touching `coordinator/<other>/board.md` rebases as before; one touching `coordinator/<self>/claims/` is refused by the leak screen first, so the ordering is pinned.

Acceptance: tests green, watched red first; `node --test test/memory-sync.test.js` green with delta named against a recorded baseline; the doctor's own run over this checkout reads as before.

### 2. The two runtimes' machine spellings are pinned against each other. Model: sonnet

One test asserts that the PowerShell reading `Get-MemorySyncMachineName` returns and Node's `os.hostname()` return the same string byte-exact on the running box, skipping with a named reason where `pwsh` is absent, so a platform whose two readings diverge fails the suite on that platform rather than syncing every one of its own files as foreign. A second test plants a directory whose name differs from the machine's only by case and asserts it reads as foreign on both sides.

Acceptance: both tests green, the first watched red against a deliberately wrong constant; delta named.

### 3. The documents state the control. Model: sonnet

Rewrite the role skill's directory-contract paragraph so it states the machine axis as the sync channel's rule and keeps the direct-write and audit statements it already makes; rewrite its inbox concurrency sentence per decision 2; state the new reason code beside `inbound-leak` in the security model's sync section and in the doctor skill where reason codes are listed; and add one sentence to `docs/architecture.md` where the coordinator directory's sync is described. Every edit is present tense and states what is true now, never the change. `test/doctrine-parity.test.js` pins whichever of these paragraphs it already reads; where it reads one this section changes, update the pin in the same section with the red watched first.

Acceptance: doctrine-parity lane green with delta named; whole-file review of each touched document; no em dashes.

## Out of Scope

- Authenticating a writer at any point in the channel; the security model's accepted risk on direct writes stands.
- The machine-local claims directory, already excluded and unchanged.
- The Node-side git calls the `store-git-channel-guard` plan hardens; the two plans touch the same files and neither depends on the other, so they order by whichever arms first.

## Related

- `claude-kit_store-git-channel-guard_spec_v1.md`: the same sync path, a different axis.
- `plugins/claude-kit/skills/role/SKILL.md`, the coordinator directory contract.
- `docs/security-model.md`, the memory store's sync section.
