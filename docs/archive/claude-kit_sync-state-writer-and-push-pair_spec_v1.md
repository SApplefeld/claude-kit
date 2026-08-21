# Store sync: a state writer that cannot write and a push destination nobody checks

Status: Complete
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
(git's default since 2.0). The comparison is ordinal, over the raw
`branch.<name>.merge` value against `refs/heads/<local branch>`, because that
is git's own comparison byte for byte.

What a differing pair costs depends on the configured value, so the finding
does too, and Section 2 carries the full table. Three values leave the
automated push dead while every check above reads clean, so they add a
**blocking** line naming the rename remedy: `simple` refuses the push
fatally, `matching` publishes nothing while exiting 0, and an unrecognized
value makes git refuse every push as malformed. `nothing` blocks
unconditionally, names or not. `current` is advisory instead, because the
push succeeds and merely lands on a branch no other machine pulls from.
`upstream` and `tracking` are not findings at all. Blocking rather than
advisory for the first group, because it belongs to the same class as the
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
`lastOk` being empty. The first write does set `lastOk` when it lands on the
success path, but no write after it lands at all, so an empty `lastOk` proves
only that the first write was not a success and is not evidence of one never
happening. Section 3 establishes the answer from a different artifact: the
store reflog, which records the runner completing its fetch, rebase and push
four times on 2026-08-21 against a state file frozen at 2026-08-19. After
Defect A is fixed the field itself becomes trustworthy for the first time.

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
`firstFailSince`. The seven-day nudge reads `lastResult` and
`firstFailSince`; `lastOk` is `Write-SyncState`'s own success stamp and is
the field the backlog entry's refuted claim rested on.

### 2. The doctor's push-destination name-pair check

Model: opus

Files in scope: `plugins/claude-kit/doctor/doctor.ps1`,
`plugins/claude-kit/doctor/install-memory-sync.ps1`,
`test/memory-sync.test.js`.

Extend the destination status with the effective `push.default` and with the
raw `branch.<name>.merge` value, then add the blocking lines per the Design
section. `Get-MemorySyncStatus` in `install-memory-sync.ps1` already reads the
branch and the upstream and is the right place for the new reads, so
`Get-MemorySyncDestinationLines` stays a pure formatter over a status
hashtable, matching how every other line in that function is built.

The name comparison is ordinal over the raw ref, `refs/heads/<local branch>`
against the raw `merge` value, because that is git's own comparison byte for
byte. PowerShell's default string comparison is case-insensitive, so a local
`Main` tracking `origin/main` is refused by git on every push and would
otherwise read as a matching pair.

The finding is a function of `push.default`, matched case-sensitively because
git parses it that way and rejects anything it does not recognize:

- `upstream` and `tracking` push to the upstream ref whatever the names are,
  so a differing pair is not a finding.
- `simple` refuses a differing pair fatally: blocking.
- `matching` updates only branches carrying the same name on both ends, so a
  differing pair matches nothing, publishes nothing, and exits 0, which the
  runner records as a success: blocking, and the quietest of the set.
- `nothing` errors out on any bare push whatever the names are: blocking
  unconditionally.
- `current` publishes to a branch on origin named after the local branch, so
  the push succeeds and lands where no other machine pulls from. The push is
  not dead, so this is advisory rather than blocking.
- Anything else is a malformed value git refuses every push over: blocking.

The rename remedy is printed as a runnable `git branch -m` command only behind
a four-clause gate: the raw merge ref starts with `refs/heads/`, both names
match `^[A-Za-z0-9][A-Za-z0-9._/-]*$`, and neither is altered or truncated by
`Get-SanitizedLine`. Two different escapes are being closed. The sanitizer
guarantees printable ASCII, which is the character set shell metacharacters
live in, and git permits `;`, `&&`, `|`, `$()` and quotes in a branch name, so
a store branch named `main;calc` would otherwise render a remedy that runs
`calc` when pasted. Separately, a leading `-` carries no shell meaning at all
but git reads it as an option, so a branch named `-f` would render
`git branch -m -f <upstream>`, which git executes as a forced rename that
clobbers an existing ref rather than the rename the line advertises. Git's own
porcelain refuses to create such a name, `--` included, but plumbing and a
hostile origin both reach the state, so the charset must open on an
alphanumeric. Where the names fail that gate the finding is still reported, in
prose, without a runnable command.

The report's own trailing remedy, `put HEAD on the sync branch and give it an
upstream`, is emitted only for the three findings it repairs: a detached HEAD,
a branch tracking nothing, and a branch tracking a remote other than origin.
Running it against a branch whose upstream on origin is already correct
creates a second branch there and repoints the upstream at it, which is the
silent cross-machine divergence the advisory check in the same function
exists to report.

Keep the existing failure ordering: this is a destination finding, so it must
not preempt any leak probe. A store with a name mismatch and a leak still
reports the leak first.

Tests: a mismatched pair yields the blocking line and names the rename
remedy; a matching pair yields no such line; a case-only mismatch yields the
blocking line; `upstream` yields no line on a mismatched pair; `current` on a
mismatched pair reports an advisory without failing the doctor; `matching` on
a mismatched pair blocks; `nothing` blocks even on a matching pair; an unset
`push.default` is treated as `simple`; a branch name carrying a shell
metacharacter is reported without a pasteable command; a branch name git would
read as an option is too; `tracking` reaches the same arm as `upstream` rather
than the malformed-value one; and the trailing generic remedy appears for a
missing upstream and for an upstream off origin while being withheld from a
name-pair finding.

A malformed `push.default` is unreachable through the doctor against git
2.55: git rejects the value on nearly every command, so the leak probes
cannot answer and the report fails through its unproven-negative path before
any destination line is formatted. The formatter keeps its default arm
anyway, because an unrecognized value falling silently through to no finding
is the defect class this plan exists to close, and the test pins the
observable behavior rather than the unreachable line.

### 3. Backlog correction

Model: sonnet
Locus: inline

Files in scope: `docs/backlog.md`.

Rewrite the entry opening `The store's auto-sync stands down` per the Design
section: retire its open question (2) with the answer and the refutation of
the `@{upstream}` ordering hypothesis, and correct its "never once succeeded"
claim, which the store reflog refutes outright. Retire its one-time
cross-machine reconcile item too, with the reflog receipt showing the hand
reconcile it asked for happened on 2026-08-20, and leave the entry opening
`Silent store auto-sync` untouched. What stays live is the post-fix
deployment check: each machine runs the installed plugin copy rather than this
clone, so confirm on each that the state file starts moving once the fix
ships, before the seven-day nudge fires on a healthy store.

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

## Standing Brief Amendments

Folded into every dispatch brief this plan issues from the point each was added.

- **Verify every cited line number and every cross-file claim by opening the file** (added 2026-08-21, after Section 1's review). Do not carry a line number or a claim about another file forward from a brief, from this spec, or from a code comment without reading the line yourself, and say so in the report when the brief or the spec turns out to contradict the file. Two instances earned this: Section 3's first draft cited the runner's fetch and `@{upstream}` resolve one line off each, and Section 1's spec text and dispatch brief both asserted that `hooks/memory-session.js`'s seven-day nudge reads `lastOk`, which it never has. Both were caught in review rather than by the person writing them, which is the tell that the workflow rather than the writer is generating them.

## Chapters

### Chapter 1 - 2026-08-21
Completed: 3. Backlog correction
Implemented By: main session (Locus: inline, the docs-write-guard routing override; the section carries Model: sonnet but a dispatched implementer cannot write under docs/)
Metrics: 1 review round; NEEDS_CONTEXT 0; escalations 0; consults 0
Decisions / Surprises: the review turned up evidence that changed the section's conclusion rather than its wording. Reading the memory store's own reflog shows the runner completing its signature sequence (a `fetch --quiet` fast-forward, a rebase, an `update by push`) at 2026-08-21 00:29:58 through 00:30:01 and again at 09:26:12 through 09:26:16, with two further commit-and-push cycles at 10:05 and 10:08, while `~/.claude/kit-sync-state.json` still carries an mtime of 2026-08-19 18:00:05 and reads `lastResult: transient`, `reason: push-failed`, `lastOk` empty. `git fetch` and `git push` each appear exactly once in the whole `plugins/claude-kit/doctor/` tree, both in `sync-store.ps1` (lines 459 and 548), so nothing else the kit runs produces that trio. Three consequences follow. First, the entry's central claim that the shipped runner has never once succeeded is not merely unsupported, it is false, so the section refutes it outright rather than downgrading its evidence as the spec directed. Second, Defect A is now confirmed on SCOTT-CLAUDE and not only on NEO-CLAUDE, which discharges this plan's first design-time assumption by a stronger route than the two-edition probe that assumption named: a working runner against a frozen file. The `## Assumptions` section is left frozen at approval per the execution-time rule, and this Chapter is the record of the discharge. Third, the entry's one-time cross-machine reconcile item is retired rather than kept as the live half the spec expected, because the reflog shows it happened by hand on 2026-08-20 20:45:43 through 20:46:50 by exactly the remedy it named, and the store now reads `main` tracking `origin/main` at 0 ahead / 0 behind. What replaces it as the live half is a deployment check: `firstFailSince` still reads `2026-08-19T22:00:05`, so the seven-day nudge in `hooks/memory-session.js` fires on a demonstrably healthy store around 2026-08-26 unless the fixed script reaches both machines first, and each machine runs the installed plugin copy rather than this clone. Two spec edits ride with this section, both flagged here as the approval drift they are: the Design section's claim that a file which can only be written once cannot record a success was overbroad, since the `File.Move` first-write branch does set `lastOk` when that first write lands on the success path, so an empty `lastOk` proves only that the first write was not a success; and Section 3's own text is updated to match what was delivered (refute rather than downgrade, retire the reconcile item, install the deployment check as the live half). A third, smaller correction: the entry is cited three times in this spec by its opening phrase, so the rewrite keeps that phrase intact rather than reflowing it, which an intermediate draft had broken. Separately, a wrong premise in Section 1's dispatch brief was corrected mid-flight rather than left to stand: the brief asserted, unmarked and as settled fact, that PowerShell 7 is not installed on this machine, and it is, with `pwsh` resolving and reporting 7.6.5. The operator memory carrying the absence claim already records its own supersession and the recall surfaced it. Nothing about Section 1 changes, since the fix is correct on both editions and the test harness deliberately spawns `powershell.exe`, the edition `hooks/memory-session.js` itself spawns.
Assumptions: none.
Review Findings: one adversarial round at opus/max, dispatched through the Workflow route because that effort sits above the agent's frontmatter default. Verdict CHANGES_REQUIRED, three Major and five Minor, every one verified against the code and the store before acting and every one addressed. The two Majors that mattered: both cited line numbers in `sync-store.ps1` were off by one (the fetch is at 459 and the `@{upstream}` resolve at 469, not 458 and 468), and the newly installed live half was stale on arrival because the reflog already answered it. The third Major asked for the confirmed-versus-inferred marking that the reflog receipt now supplies. Minors addressed: the overbroad write-once reasoning (fixed in both the entry and the spec), a retirement receipt that did not discriminate a reconcile from a `reset --hard` (it now cites the `pull --rebase` reflog line), an internal tense contradiction, the dangling opening-phrase anchor, and a backticked quotation that did not match the file's actual JSON. Recorded per the review step: blind: no code diff, since omitting `docs/` paths empties this section's changed-file list. No security reviewer, since the section changes no code and touches no boundary.
Stamps: adjudicated 3, stamped 3 (powershell-null-to-dotnet-string-param-becomes-empty, kit-sync-runner-pushes-bare-so-branch-names-must-match, pwsh-absent-on-scott-claude).
Next: Section 1, in flight; then Section 2.
Commit Model: Review-Only

### Chapter 2 - 2026-08-21
Completed: 1. The state writer's null marshalling
Implemented By: implementer-sonnet, no escalation
Metrics: 1 review round; NEEDS_CONTEXT 0; escalations 0; consults 0
Decisions / Surprises: the change itself is the single token the spec named, and the class sweep is genuinely closed. `[System.IO.File]::Replace` occurs once in the tree, and every other `$null` in a `.ps1` is a comparison, an assignment, or a `2>$null` redirection rather than an argument crossing into a .NET string parameter; the main thread established that before dispatch and both reviewers re-established it independently. The section's real content is the test, because a single-write test passes on the broken script and proves nothing, which is how the defect survived. The shape that discriminates is a first run that gates (a detached HEAD, so the state file is created by the `File.Move` branch) followed by a second run that succeeds, since only the second write goes through `File.Replace`. The blind reviewer went further than reasoning and probed the binding directly on this machine's PowerShell 5.1.26100.9168: `[System.IO.File]::Replace($src,$dst,$null)` throws `ArgumentException: The path is not of a legal form`, and the `[NullString]::Value` form succeeds, which confirms Defect A on SCOTT-CLAUDE by the two-edition probe route the plan's first assumption named, independently of the reflog evidence recorded in Chapter 1. One deliberate non-change: the section's own test-count duplication. The two new cases share a fixture and two sync runs and differ only in which fields they read, which both reviewers flagged as four PowerShell spawns where three would do. They stay separate, because Section 1's Tests line is a floor and merging them would shrink it; the cost is roughly three seconds on a four-minute suite.
Assumptions: none.
Review Findings: one round, adversarial and blind together at opus/xhigh through the Workflow route, both APPROVED_WITH_CONCERNS with no Critical and no Major. No security reviewer: the section changes one file-write call and touches no input handling, no process execution, no boundary, and the finishing pass covers the changeset anyway. Both reviewers independently found the same Minor and it was the one worth fixing: a new code comment asserted that `hooks/memory-session.js`'s seven-day nudge reads `lastOk`, and it does not. `lastOk` appears nowhere outside `sync-store.ps1` and the tests; the nudge reads `lastResult`, `firstFailSince`, and `lastAttempt`. The comment is corrected, and so is the spec's Section 1 text, which carried the same false claim and is where the dispatch brief inherited it. Two further Minors fixed: `assert.notStrictEqual(x, '')` also passes when a field is absent, so both success-stamp assertions now parse the value instead, and the tests gained the `lastAttempt` pin the blind reviewer argued for, which is the strongest available regression signal because `lastAttempt` must move on every write whatever the outcome and a frozen one is what makes the hook report a broken sync chain. One Minor routed out rather than fixed: `Write-SyncState`'s catch still swallows any write failure silently, which is the reason this defect lived as long as it did, and it is now a `docs/backlog.md` entry with the reason it is not fixed here, since Section 1 explicitly directed the catch stay as it is and the remedy is a design question about what channel a silent runner can report through at all.
Stamps: adjudicated 1, stamped 1 (crlf-per-file-in-windows-checkouts).
Next: Section 2, in flight; then finishing-work.
Commit Model: Review-Only

### Chapter 3 - 2026-08-21
Completed: 2. The doctor's push-destination name-pair check
Implemented By: implementer-opus, two rounds at the same tier (the second applying the adjudicated review), plus one main-session fix
Metrics: 1 review round; NEEDS_CONTEXT 0; escalations 0; consults 0
Decisions / Surprises: the section as specified was too narrow, and the review is what showed it. Three things it got wrong, all in the silent direction the plan's Goal names. First, the comparison used PowerShell's `-ne`, which is case-insensitive, where git compares byte for byte: a local `Main` tracking `origin/main` is refused on every push and the doctor printed PASS. Confirmed by probe in the main session (`'Main' -ne 'main'` is False, `-cne` is True) and reproduced end to end by the implementer against git 2.55. The comparison is now ordinal over the raw `branch.<name>.merge` value against `refs/heads/<local>`, which is git's comparison verbatim and needs no prefix parsing. Second, the check fired only for `push.default simple`, leaving `matching` and `nothing` unreported: `matching` on a differing pair matches nothing, publishes nothing, and exits 0, so the runner records a success for a push that did nothing, which is the quietest failure in the whole set. The check now dispatches case-sensitively over every value, with `current` on a differing pair demoted to advisory rather than blocking, because there the push genuinely succeeds and simply lands on a branch no other machine pulls from. The implementer probe-verified all seven rows against real git rather than accepting the table from the brief. Third, and this reverses a call recorded in Interim board 1, the report's fixed trailing remedy (`put HEAD on the sync branch and give it an upstream`) was routed a new condition by this section: a branch that already has a correct upstream. Following it there creates a second branch on origin and repoints the upstream at it, which is exactly the silent cross-machine divergence the advisory check in the same function exists to report, and the report printed two contradictory Fix lines at once. The earlier call had it as a wording nit; it was wrong advice with a data-divergence outcome, and it is now emitted only for the three findings it repairs. The main session widened that guard by one clause after the implementer flagged, correctly, that the literal acceptance criterion would have stripped the remedy from the foreign-upstream finding, where `push -u origin <branch>` is the right repair; that widening was probe-verified red first with a snapshot-and-restore against the worktree, never `git checkout --`. This section's scope therefore grew well past what the spec wrote, which is approval drift by construction: Section 2's spec text and the Design section's Defect B are rewritten to match what shipped, and the close-out names it as a scope change. Two premises in the fix brief turned out wrong and were reported rather than implemented around: a short-form `merge = main` never reaches the name-pair comparison at all, because `rev-parse @{u}` fails first and the existing tracks-no-upstream line already blocks with the right remedy; and a malformed `push.default` is unreachable through the doctor on git 2.55, because git rejects the value on nearly every command, so the leak probes cannot answer and the report fails through its unproven-negative path first. The formatter keeps its default arm regardless, since an unrecognized value falling silently through to no finding is the defect class this plan exists to close, and the test pins the observable behavior instead of the unreachable line. That leaves one code branch with no test, recorded here rather than papered over.
Assumptions: none.
Review Findings: one round of three reviewers at opus/max through the Workflow route, adversarial and blind both CHANGES_REQUIRED, security CONCERNS with nothing above Minor. Four Majors across the two correctness reviewers, deduplicating to three defects, all fixed: the case-insensitive comparison, the harmful trailing remedy, and the push.default values left uncovered. Minors fixed: the raw-ref comparison subsuming the short-form case, and a test precondition that read the merged local-global-system config scope while the doctor under test read an isolated one, which would have gone red on any machine whose operator sets `push.default` globally. The security reviewer's one actionable finding is fixed: the blocking output composed a runnable `git branch -m` command from two untrusted branch names, and git permits `;`, `&&`, `|`, `$()` and quotes in a branch name, so a store branch named `main;calc` rendered a remedy that runs `calc` when pasted. The command is now printed only when both names are charset-safe and survive sanitization unaltered; otherwise the finding is reported in prose with no runnable command. It also confirmed the sanitizer itself is sufficient for a terminal surface, stripping ESC, the 8-bit introducers, CR, LF and DEL, and that the new git invocations pass an argv array with no shell, so a hostile branch name cannot escape into a second command or reach a config key like `credential.helper`. Four findings were routed out of the section to `docs/backlog.md` with their reasons: the `Output[0]` read off a stderr-merged stream, which covers five reads including three this section did not write, so fixing only the new two would leave half a class fixed; a triangular push remote making the name-pair finding a false positive; the absence of an unproven-read flag for the new reads, which would mean changing an existing WARN line the spec said not to touch; and a pre-existing credential disclosure where the doctor prints the origin URL verbatim.
Stamps: adjudicated 0, none surfaced.
Next: finishing-work.
Commit Model: Review-Only

### Interim board 1 - 2026-08-21
Section 1, the state writer's null marshalling: dispatched to implementer-sonnet, in flight, no report yet. Its brief carries the closed class sweep (line 309 is the kit's only instance, confirmed in the main thread), the red-first two-write test requirement, and the PowerShell-edition correction above. Files in scope: `plugins/claude-kit/doctor/sync-store.ps1`, `test/memory-sync.test.js`.

Section 2, the doctor's push-destination name-pair check: not started, and deliberately serialized behind Section 1 because both sections declare `test/memory-sync.test.js`. Its approach read is done and the spec's premise holds: `Get-MemorySyncStatus` reads the branch at `install-memory-sync.ps1:353-359` and the upstream at `:365-366`, and `Get-MemorySyncDestinationLines` at `doctor.ps1:1067-1092` is a pure formatter over that hashtable, so the new reads belong in the status function exactly as the spec says.

Section 3, backlog correction: closed, Chapter 1 above.

Gate baseline, captured this session on base commit `04277e1` with `node --test test/*.test.js`: 1041 tests, 1039 pass, 2 fail, both in `test/memq-shim.test.js` and both environment-driven (a Windows 8.3 short-path versus long-path mismatch). A full run takes roughly four minutes.

Rulings adopted since the last boundary: none, no consult was convened.

Next action per section: await Section 1's report and review it, then dispatch Section 2 at opus with its reviewers at opus/max. Section 3 needs nothing further before the finishing pass.

One Section 2 question decided and declared rather than asked: the FAIL branch at `doctor.ps1:1276-1279` appends a fixed remedy line telling the operator to put HEAD on the sync branch and give it an upstream, which reads oddly for a name-pair mismatch on a branch that already has one. The new blocking line carries its own rename remedy per the spec, and that trailing generic line is left as it is, because making it conditional across four different blocking conditions widens the section well past its stated acceptance criteria. Reversal is one edit if it grates in practice.
### Chapter 4 - 2026-08-21
Completed: the finishing pass, and with it the whole effort
Implemented By: main session, over a qa-verifier, a security-reviewer and an adversarial-reviewer both at fable, and a docs-curator
Metrics: 1 finishing review round; NEEDS_CONTEXT 0; escalations 0; consults 0
Decisions / Surprises: the finishing gate earned its cost, because the fable security pass found a real defect in this plan's own security fix and three rounds of opus reviewers had not. Section 2's charset gate, `^[A-Za-z0-9._/-]+$`, admits a leading `-`, and the character class was written to exclude shell metacharacters, which a `-` is not. So a store whose local branch is named `-f` composed the line `Fix: rename the local branch to match its upstream (git branch -m -f master) in the store root.`, and git executes that as `git branch -m --force master`, a forced rename of the current branch onto the existing local `master`, clobbering it. The remedy the report prints to repair a store is the thing that damages it. Reproduced red first: the failing assertion's output is that exact line, quoted here because it is the whole finding. Two parts of the reviewer's write-up the probe corrected rather than inherited. Its suggested `git branch -m -- <local> <upstream>` form does not work: git 2.55 refuses a dash-leading branch name even after `--` (`fatal: '-f' is not a valid branch name`), so the end-of-options marker buys nothing here, and the fix taken instead requires each name to open on an alphanumeric, `^[A-Za-z0-9][A-Za-z0-9._/-]*$`. And its reachability read was right for the wrong reason: porcelain cannot create the state, so the test builds it with `update-ref` plus `symbolic-ref`, which is also how a store reaches it in life, by a hostile origin publishing `refs/remotes/origin/-f` or a direct ref write. This is a scope change past a closed section, recorded here and reconciled into Section 2's text, which the docs curator independently flagged as drift D1. Two adversarial Minors were also worth fixing. The `matching` finding asserted the push "exits successfully while publishing nothing", which is false on a store whose origin also carries a branch named after the local one, which is exactly the state the sibling advisory in the same function reports, so a doubly-misconfigured store got a line contradicting the one above it; it now reads "publishing nothing to the branch this store pulls from" and the test pins the new clause rather than a prefix of it. And `tracking`, the one enumerated `push.default` value with no test, now has one. One Minor is accepted rather than fixed, with its reason: the trailing remedy guard uses culture-sensitive `StartsWith("origin/")` where this section's own discipline is ordinal, but it deliberately mirrors the pre-existing check at `doctor.ps1:1080`, fixing only the new site would create the asymmetry the finding objects to, and fixing both edits pre-existing code outside this plan. The practical risk is nil, since `origin/` carries no character with a culture-sensitive casing or collation rule. Last, the adversarial reviewer did something the section rounds asserted but never demonstrated: it traced revert-the-fix for each keystone test and confirmed all four go red, including that reverting `[NullString]::Value` leaves the second run's state at `gate` where the test demands `ok`.
Assumptions: none, and none on any earlier Chapter either, so the effort's assumptions block is empty rather than unreported.
Review Findings: QA verification PASS, and it re-ran the suite itself rather than accepting the reported numbers, confirming the failing set is the same two tests by name and not merely the same count. Security review at fable: CONCERNS, one Minor, fixed as above. Final adversarial review at fable: APPROVED_WITH_CONCERNS, four Minors, two fixed, one accepted with the reason recorded, and the fourth was this Chapter's own missing Status flip. No Critical and no Major from any finishing reviewer. Both fable dispatches ran at fable with no dispatch failure, so no compensation and no bare fallback was taken and the gate ran at full strength. The adversarial pass also answered the question it was asked to test rather than inherit: it diffed Section 2's rewritten spec text against the original and found every original acceptance item survives, with the one directional change, `current` moving from no finding to an advisory, being a strengthening that Chapter 3 already named. Docs curator: three drift items, all `Class: deviation`, no `Class: mistake`, so nothing stopped. D1 is the gate widening above, reconciled into the spec. D3 is that no shipped doc had ever described the sync state writer at all, now three paragraphs in `docs/architecture.md` and one in `docs/security-model.md`. D2 is the library index, which the curator was barred from touching and reported instead, placed by the main session.
Gate: 1057 tests, 1055 pass, 2 fail, against the 1041 / 1039 / 2 baseline captured on `04277e1`. The two failures are the same two `test/memq-shim.test.js` cases by name in both runs, environment-driven by a Windows 8.3 short-path mismatch and recorded in the project memory `suite-baseline-is-not-zero-fail`. Net +16 tests, +16 passing, zero new failures.
Operator-pending: one item, carried in `docs/backlog.md` as the live half of the rewritten auto-sync entry. Each machine runs the installed plugin copy rather than this clone, so the fix reaches a machine only when the plugin updates there. On each of SCOTT-CLAUDE and NEO-CLAUDE, confirm after the update that `~/.claude/kit-sync-state.json` starts moving (its `lastAttempt` advancing between sessions is the signal) and that `firstFailSince` clears. On SCOTT-CLAUDE that field currently reads `2026-08-19T22:00:05`, so the seven-day nudge in `hooks/memory-session.js` fires on a demonstrably healthy store around 2026-08-26 if the fix has not landed there first. A state file still frozen after the update reopens this work as a new round.
Stamps: adjudicated 0, none surfaced. `memq unstamped` returned zero records in both tiers across the finishing span, which is the expected result of the three section boundaries having each run their own sweep.
Next: Complete. The armed leash advances to `docs/plans/claude-kit_boundary-ritual-reinforcement_spec_v1.md`.
Commit Model: Review-Only
