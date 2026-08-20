# Store sync: a state writer that cannot write and a push destination nobody checks

Status: In Progress
Commit Model: Review-Only
Created: 2026-08-20

## Goal

The memory store's background sync runner cannot record its own outcome, and
the doctor cannot see the one misconfiguration that silently disables the
runner's push. Both were confirmed live on NEO-CLAUDE on 2026-08-20 while
repairing that machine's store sync. Together they produce the worst shape a
sync can have: every visible surface reads healthy while the automated leg is
dead, and the one file that would say otherwise is frozen.

A third section corrects `docs/backlog.md`'s existing entry on this symptom,
whose stated root cause and open question are both answered by Defect A.

## Design

### Defect A: `Write-SyncState` can only ever write once

`plugins/claude-kit/doctor/sync-store.ps1:309` calls

    [System.IO.File]::Replace($temp, $statePath, $null)

PowerShell marshals `$null` into that method's third parameter, typed
`string`, as the **empty string** rather than as a null reference, and
`File.Replace` rejects an empty backup path. Confirmed by direct probe on
NEO-CLAUDE, both editions:

| Edition | `Replace(..., $null)` | `Replace(..., [NullString]::Value)` |
|---|---|---|
| Windows PowerShell 5.1.26100.9168 | `ArgumentException: The path is not of a legal form` | succeeds |
| PowerShell 7.6.5 | `ArgumentException: The path is empty. (Parameter 'path')` | succeeds |

Windows PowerShell 5.1 is the edition `hooks/memory-session.js` spawns, so the
shipped path is the failing one.

The call sits inside `Write-SyncState`'s own `try`/`catch`, whose catch deletes
the temp file and returns. The failure is therefore silent by construction:
no error, no leftover temp, and the function appears to run.

The consequence is that `kit-sync-state.json` is only ever written by the
`File.Move` branch, which runs when no state file exists. Every later write is
dropped, so the file freezes at its first-ever content:

- `lastOk` never sets, even after a successful push.
- `lastResult` and `reason` freeze at whatever was current at the first write.
- `firstFailSince` never clears, so `hooks/memory-session.js`'s seven-day
  failure-streak nudge eventually fires on a healthy store and then never
  stops.
- A genuine later failure is never recorded at all, which is the more
  expensive direction: the file's whole purpose is to carry a stand-down
  across sessions.

The fix is one token: `[NullString]::Value`. The atomic-replace property the
surrounding comment protects is preserved, which is why this is not swapped
for a `Move-Item -Force`.

### Defect B: the destination check never checks the name pair

`Get-MemorySyncDestinationLines` in `plugins/claude-kit/doctor/doctor.ps1`
verifies three things: that HEAD is not detached, that the branch has an
upstream, and that the upstream is on origin. It never verifies that
`push.default` will accept the local-to-upstream branch **name pair**.

The push leg in `sync-store.ps1` is a bare `git push --quiet`, and git's
default `push.default` of `simple` fatally refuses a push whose local branch
name differs from its upstream's name. So a store whose local branch is
`master` tracking `origin/main` reads as a perfectly healthy destination while
the runner's push exits 128 on every single run.

Observed on NEO-CLAUDE on 2026-08-20 before the repair: doctor exit 0, every
line PASS, `Memory sync PASS`, `Destination: master tracks origin/main, the
only branch on origin`, an intact allowlist, and an automated push leg that
could never have succeeded. `git push --dry-run` in the store root named the
cause in one line.

The fix adds a name-pair comparison to the same function. Read `push.default`
with `git config --get push.default` and treat an empty result as `simple`
(git's default since 2.0). When the effective value is `simple` and the local
branch name differs from the upstream's branch name, add a **blocking** line
naming the remedy (`git branch -m <local> <upstream-name>` in the store root).
Blocking rather than advisory, because it belongs to the same class as the
existing "tracks no upstream, so the close-out's pull and push have no
destination" line: the automated push is dead, not merely ambiguous.

Do not implement this by running a live `git push --dry-run`. That contacts
the network, and the doctor runs on every repair pass.

### Section 3's subject: what the backlog entry gets wrong

The `docs/backlog.md` entry opening `The store's auto-sync stands down`
records this symptom on SCOTT-CLAUDE and attributes it to a cross-machine
content conflict. Two of its claims do not survive Defect A.

**Its open question (2) is answered.** It asks why the recorded reason is
`push-failed` rather than `pull-conflict`, and hypothesizes that the runner may
resolve `@{upstream}` to a fixed commit before the fetch, making the rebase a
no-op against a stale base. That hypothesis is refuted by the code: the fetch
runs before the `@{upstream}` resolve in the same block, so the resolve reads a
fresh ref. The real answer is Defect A. The state file cannot be updated after
its first write, so the recorded reason is whichever reason happened to be
current at that first write, and every later reason, `pull-conflict` included,
was silently dropped.

**Its central inference rests on an artifact that cannot support it.** "The
shipped `doctor/sync-store.ps1` has never once succeeded" is drawn from
`lastOk` being empty. A file that can only be written once cannot record a
success, so an empty `lastOk` is not evidence of one never happening. The
claim may still be true; it needs different evidence, and after Defect A is
fixed the field becomes trustworthy for the first time.

One further observation, which is data rather than a finding: `origin/main`
carries commits authored by Claude Bot (`scott+claude@applefeld.com`) dated
2026-08-20, so the ahead-4 / behind-31 divergence that entry describes as of
2026-08-19 is reconciled on origin's side. Whether that happened through the
runner or through a hand or `doctor -Fix` push is not established from
NEO-CLAUDE.

## Assumptions

- Defect A is confirmed on NEO-CLAUDE only. It sits in the shipped script with
  no machine-specific branch, so it applies to any Windows host running it,
  but SCOTT-CLAUDE was not observed (declared 2026-08-20; reversal: run the
  two-edition probe on that box).
- `push.default` is unset on NEO-CLAUDE, so git's built-in `simple` applies. A
  machine setting `upstream` or `current` would not hit the refusal, which is
  why Section 2 reads the config rather than assuming the default.
- The installed plugin cache copy and the clone copy of `sync-store.ps1` were
  diffed on 2026-08-20 and are byte-identical, so line numbers taken from
  either transfer.
- Every line number in this spec was verified against base commit `502d9f1`.
  The two `docs/backlog.md` entries are cited by their opening phrase rather
  than by line, because that file is pruned live and its numbering moves; the
  source-file line numbers are stable enough to cite directly but should still
  be confirmed by the anchor text around them.

## Sections of Work

### 1. The state writer's null marshalling

Model: sonnet

Files in scope: `plugins/claude-kit/doctor/sync-store.ps1`,
`test/memory-sync.test.js`.

Replace the `$null` third argument at line 309 with `[NullString]::Value`.
Nothing else in `Write-SyncState` changes: the temp-then-rename shape, the
UTF-8-without-BOM encoding, the `File.Move` first-write branch, and the
catch-and-clean behavior all stay as they are.

Sweep the rest of the kit for the same construct before closing: any
`[System.IO.File]::Replace`, or any other .NET call passing `$null` where the
parameter is typed `string` and the API treats null as meaningful. This is a
class, not an instance, and the sweep is the point of doing it here.

Tests (a floor, and the first one must go red before the fix): write state
twice against the same store root and assert the second write landed, by
reading back a field only the second write would set. A single-write test
passes today and proves nothing, which is how this survived. Add one asserting
that a run reaching the success path sets `lastOk` non-empty and clears
`firstFailSince`, since those two fields are what the seven-day nudge reads.

### 2. The doctor's push-destination name-pair check

Model: opus

Files in scope: `plugins/claude-kit/doctor/doctor.ps1`,
`plugins/claude-kit/doctor/install-memory-sync.ps1`,
`test/memory-sync.test.js`.

Extend the destination status with the effective `push.default` and the
upstream's bare branch name, then add the blocking line per the Design
section. `Get-MemorySyncStatus` in `install-memory-sync.ps1` already reads the
branch and the upstream and is the right place for the new reads, so
`Get-MemorySyncDestinationLines` stays a pure formatter over a status
hashtable, matching how every other line in that function is built.

Keep the existing failure ordering: this is a destination finding, so it must
not preempt any leak probe. A store with a name mismatch and a leak still
reports the leak first.

Tests: a redirected store root whose local branch name differs from its
upstream's yields the blocking line and names the rename remedy; a matching
pair yields no such line; `push.default` set to `upstream` or `current`
yields no such line even on a mismatched pair; an unset `push.default` is
treated as `simple`.

### 3. Backlog correction

Model: sonnet

Files in scope: `docs/backlog.md`.

Rewrite the entry opening `The store's auto-sync stands down` per the Design
section: retire its open question (2) with the answer and the refutation of
the `@{upstream}` ordering hypothesis, and mark its "never once succeeded"
claim as resting on an artifact that cannot carry it, with what would actually
establish it. Keep the entry's still-live half, the one-time cross-machine
reconcile, and leave the entry opening `Silent store auto-sync` untouched.

Retire with receipts rather than deleting: the entry is the record of why the
runner was believed to be conflict-blocked, and a later session hitting a
`push-failed` reading needs to know the reading is unreliable before the fix.

## Related

- `docs/archive/claude-kit_worktree-store-and-autosync_spec_v1.md` shipped the
  background runner and its state file. Both defects here are in that
  changeset's surface area.
- `docs/backlog.md`, its `The store's auto-sync stands down` entry (rewritten
  by Section 3) and its `Silent store auto-sync` entry (untouched).
- Operator-tier memories written 2026-08-20 while diagnosing this:
  `kit-sync-runner-pushes-bare-so-branch-names-must-match` and
  `powershell-null-to-dotnet-string-param-becomes-empty`.

## Out of Scope

- The five fail-safe residuals in the `docs/backlog.md` entry opening `Silent
  store auto-sync`.
- Auto-resolving cross-machine index and add-add conflicts, which is the
  parent spec's own Out-of-Scope item 3.
- NEO-CLAUDE's branch rename from `master` to `main`. Already done on
  2026-08-20 outside this plan; Section 2 makes the condition detectable
  rather than performing it.
- Any change to `hooks/memory-session.js`'s nudge thresholds. Once Defect A is
  fixed the fields it reads become trustworthy, and whether the seven-day
  figure is right is a separate judgment on real data.

## Chapters

None yet.
