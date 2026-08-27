# The seats run on artifacts, at the cheapest sufficient tier, and compact at their own boundaries

Status: Draft
Commit Model: Commit-and-Push
Created: 2026-08-27

**Sections fully briefed 2026-08-27; parked awaiting the operator's arming as slate priority 2.** The operator accepted all six marked recommendations as binding proceeds, with one clarification on Fork 3 and both named inputs answered; The settled round below is the record. The Draft status is deliberate: it keeps this parked plan out of the SessionStart resume inventory until armed, and the run that starts it normalizes the header to In Progress per executing-work; the plan-lifecycle spec of this slate gives the authored-and-parked state its proper name. Slate position: priority 2, decided by the operator 2026-08-27 (relayed by the machine coordinator; recorded here by reference, never by quotation, per the authorization-format convention).

Session model: Opus, in a clean session opened in the kit repo. Sections run in order: 1 through 3 are strictly sequential (history, then the board's new home, then the directory contract the later sections read), 4 through 6 each assume their predecessors, 7 is prose and runs last. The start condition, as one named check: this plan starts when both plans of the armed queue ahead of it, `docs/plans/claude-kit_testing-discipline_spec_v1.md` and `docs/plans/claude-kit_memq-network-cwd-resolver_spec_v1.md`, read `Status: Complete` or sit in `docs/archive/`, readable from `/kit-goal` with no arguments or the SessionStart notice; the shared `test/doctrine-parity.test.js` (edited by the testing plan and by Sections 2 and 3 here) is that ordering's reason, not a second gate. Authored by the KIT: Expert seat from the 2026-08-26 seat-coordination kaizen cluster plus the operator's 2026-08-27 cost addendum. Anchors as of commit `73e3aaf`; re-read at implementation per Standing Amendment 1.

## Dispatch Authorization

Authorized 2026-08-27 by the operator: arming and execution of this plan by a worker session in this repository on this machine, in slate order (seat-infrastructure, then review-and-record-discipline, then plan-lifecycle-and-diagnostics), behind or after the armed testing-discipline and memq-network queue, honoring this plan's own recorded start condition. The grant was given at the keyboard of the SCOTT-CLAUDE: Coordinator session and is mirrored on that session's account-allowlisted relay thread, which is the artifact holding the operator's words; it is recorded here by reference rather than quotation, per the public-repository convention. One grant covers the three remaining slate plans, each carrying its own section pointing at it. The queue it stands behind is the one armed 2026-08-27: `docs/plans/claude-kit_testing-discipline_spec_v1.md`, then `docs/plans/claude-kit_memq-network-cwd-resolver_spec_v1.md`; its state is readable from `/kit-goal` with no arguments or the SessionStart notice, and it is passed when both plans read `Status: Complete` or sit in `docs/archive/`. This section was authored by the KIT: Expert seat on the operator's relayed instruction of the same date; per the peer-sessions trace rule it is a warrant only for a citing session that did not author it, and the receiving session performs its own trace of the grant before arming. That trace takes the form the peer-sessions rule states, provenance rather than credential: it reads this section's recorded claim, the commit that landed it, and the grant's scope against the action in front of it; the relay thread is the operator's own audit surface, not a surface the trace requires opening.

## Goal

Seat coordination today is message-first, top-tier, and timer-paced: the coordinator learns who is running by messaging each session and waiting for a boundary reply, the seat ran on the strongest model for work dominated by reads and relays, its loop woke every 60 to 90 minutes against a 1-hour prompt cache TTL so overnight wakes paid cold-read rates on the heaviest contexts for mostly no-change answers, and a looping seat that never compacts cold-re-reads an ever-growing principal. One day of live seats produced: a worker's board row written wrong because its leash lived in a worktree's own `.kit`, two suite gates launched blind to each other, and an elevated Admin unreachable by any peer.

When this plan is done: sessions register by file and the coordinator reconciles a roster-versus-registry diff instead of polling; worker status derives from artifacts a pass reads for free; heavy work announces itself on a claim file before it starts; taking a seat is one `/role` command instead of a hand-assembled ritual across three skills; each seat runs at the cheapest tier that does its job; every seat compacts at its own declared boundary instead of riding to the safety ceiling; the board lives in the memory store and reaches every machine without its own push ritual; and an elevated Admin seat is reachable through an artifact inbox. Cost-efficiency is a first-class design goal, not a nicety: this coordination model must run affordably on machines with far less model bandwidth than the one it was developed on, which is the operator's stated reason for the slate position.

## Evidence

- The compaction gate reads only a typed `/loop` as automation: `automationInEffect` in `plugins/claude-kit/hooks/kit-compact-lib.js` keys on a user entry whose command-name is exactly `/loop` (confirmed from the installed gate, per the 2026-08-26 note), so a seat driven by a timer it armed itself is a hands-on session in the gate's eyes.
- Across roughly 1,800 gate verdicts in the two journals on this machine (`.kit/compact-gate.jsonl` in claude-kit and ai-os), zero allows carry reason `role-boundary` or `operator-consent` (reported, 2026-08-26 journal read): the goalless-seat boundary is prose with no production green.
- The boundary marker ages out at about 30 minutes while the coordinator skill arms its heartbeat hourly (`plugins/claude-kit/skills/coordinator/SKILL.md`, cold-start paragraph), so the one release that skill prescribes can be stale at every wake.
- An elevated-console session is one-way on the messaging surface: its sends arrive, but `ListAgents` in a non-elevated session never lists it and `SendMessage` to it fails unreachable (reported; probed from the coordinator seat against the first Admin seat; Windows integrity levels on the session pipe is the inferred cause).
- The prompt-cache economics (from the operator discussion of 2026-08-27, relayed): the coordinator's harness states a 1-hour prompt cache TTL for its session (confirmed for that session; fleet-wide TTL unverified, and one per-machine check is a named input below); a 60-to-90-minute wake cadence lands just past it, paying roughly 10x cached rates per wake; a long-context seat's spend is input-token dominated (inferred, not measured), so model tier and wake shape are the levers and effort reduction is a half-measure.
- The store's `.gitignore` is doctor-derived and excludes everything but the memory tiers: `Get-MemorySyncIgnoreText` in `plugins/claude-kit/doctor/install-memory-sync.ps1` (re-include entries near :97) is the canonical allowlist, `Get-MemorySyncFileState` (:188, :337) reports drift, and a hand edit reads as a Foreign file failure, so a `coordinator/` directory cannot exist in the store until the allowlist admits it.
- Operator decisions of record, all recorded by reference: the board and its files live in the memory store repo under a per-machine directory (decided 2026-08-26); registration-by-file and artifact-first status is the operator's own design (2026-08-26); the `/role` command is an operator request (2026-08-26); priority 2 with cost as a first-class goal (2026-08-27, relayed by the machine coordinator).

## Design goals

1. **Cheap by construction.** Routine coordination costs artifact reads, not model wakes: status is pushed at boundaries the workers already have, urgent wakes are event-driven, any surviving timer is rare (hours, not minutes) and lands its cold read on the cheapest seat. Compaction boundaries are part of the cost design, since an uncompacted looping seat re-reads a growing principal at every wake.
2. **Artifact-first.** A message is spent only on what no artifact carries to the party that needs it in time, which is the peer-sessions skill's own stance applied to the seats' plumbing.
3. **Reachable or self-reporting.** Every seat is either on the roster and pollable, or proves life through the registry it writes.
4. **Authority unchanged.** Registration, the board, and every file this plan adds confer legibility and nothing more; the dispatch-authority rail and the warranted-channels list are untouched.

## The settled elements

These carry operator design or decision already and need the round only for sequencing confirmation.

- **A. The allowlist admits `coordinator/`.** `Get-MemorySyncIgnoreText` gains the re-include; the doctor's drift reporting follows automatically. Sequenced first, because files the allowlist excludes have no history.
- **B. The board moves home.** `~/.claude/coordinator/<machine>/` in the memory store holds `board.md`, `admin-requests.md`, and the session registry; the coordinator skill's home-repo paragraph learns that the home repo may be the store itself, one directory per machine because the store reaches every box; the board's visibility line reads the store's own remote; the seat's separate commit-and-push ritual and push authorization go away, replaced by the store's own sync.
- **C. The session registry.** Written by `/role` at takeover: name, role, repo, working directory or worktree, session id, started-at, and a heartbeat stamp for seats that cannot appear on the roster. The registry is the one place a working directory may live, readable across the elevation boundary; the board's own ban on working directories stands unchanged.
- **D. Reconciliation is a diff.** Registered-and-absent is exited; present-and-unregistered is listed once and never polled; an elevated seat proves life by its heartbeat stamp. Worker status derives from artifacts only: the goal state read through the goal CLI, the plan doc's latest Chapter, `kit-events.jsonl`, and the branch tip on origin.
- **E. The claim file.** Heavy work announces itself before it starts: repo, session, started-at, expected seconds, in the machine's registry directory. The suite slot is read, never asked; the testing-discipline skill's engine-agnostic box check composes with it and needs no change.
- **F. The `/role` skill.** One command runs the takeover: check the session already carries the machine-form seat name and stop with the exact launch invocation when it does not (the launch alias owns the name, since a rename cannot follow the channels flag that bakes it into a relay thread); load the seat's runbook; resolve the home directory from the operator tier and ask where none is recorded (superseded by Fork 3's clarification: the directory derives from the home directory and the hostname, and Section 3 states the surviving ritual); arm the seat's loop at the seat's cadence; read the ledger or inbox; write the registry entry; announce the takeover; open the boundary marker. `/role Admin` prepares and asks rather than self-authorizes, the arming staying the operator's act.
- **G. Report shape.** Operator reports are deltas against the last board state, capped, never full tables; every relayed message leads with its audience, because relayed traffic reading as though addressed to the operator was a measured reading friction (2026-08-27).

## The settled round

The design round of 2026-08-27 decided every fork: the operator accepted each marked recommendation as a binding proceed (relayed by the machine coordinator; recorded by reference). The decisions, with the options each was weighed against preserved below it:

- **Fork 1 decided:** the push model first, marker-age lengthening for the residue, gate-trust widening held in reserve.
- **Fork 2 decided:** the Stop-or-idle hook opens the goalless seat's boundary, with the test driving the release path.
- **Fork 3 decided, with the operator's clarification:** per-session status files with the coordinator as sole board writer, and the registry directory lives under the memory store's home (`~/.claude/coordinator/<machine>/`, the same placement the board takes), so it rides the store's private repo and sync and is discoverable by any session on any machine. The material-change enumeration lands in the section brief.
- **Fork 4 decided:** the seat-tier table in the peer-sessions Roles section: coordinator at Opus with an observation-gated step to Sonnet, Expert top-tier, Worker per its plan's section tiers, Admin cheap.
- **Fork 5 decided:** the `admin-requests.md` inbox with the registry heartbeat; per-command elevation stays the named fallback.
- **Fork 6 decided:** the remaining-time estimate lives in the registry status file; the Chapter format's frozen contract is untouched.

The weighed options, kept as the decision record:

**Fork 1: the gate versus a seat's own timer.** The gate defers compaction for a hands-on session, and a self-armed heartbeat looks hands-on to it. Options: (i) the gate accepts a seat's own automation on evidence a seat can honestly write (a cron entry the transcript records, or a marker form declaring driven-by-timer); (ii) the seat cadence aligns to the marker's 30-minute window, which doubles wake cost and runs against design goal 1; (iii) the goalless-seat marker takes an age of at least one heartbeat interval; (iv) the push model of Fork 3 removes fixed short loops entirely, making the conflict rare, with (iii) covering what survives. Lean: (iv) first and (iii) for the residue, holding (i) as the structural fix only if observation still shows seats riding to the ceiling, because widening what the gate reads as automation moves a trust boundary the security model prices.

**Fork 2: the structural boundary for goalless seats.** Today the boundary marker is opened by skill prose, and the two journals hold zero role-boundary allows. Options: a Stop-or-idle hook opens the boundary for a goalless seat whose tree is clean and whose last turn ended banked; or the `/role`-armed loop ends every pass with the marker open (prose again, but now in one place a single skill owns). Either way, a test drives the interactive path with a live marker so the role-boundary allow has at least one recorded green. Lean: the hook, because the leashed worker's checkpoint is structural and the seats' boundary should be the same kind of thing; the test is non-negotiable under either option.

**Fork 3: who writes what, in the push model.** Status is pushed at warm boundaries instead of pulled by messages. The settled half is the direction; the fork is the writing topology. Options: workers write material-change lines directly to the board file (one shared file, contention and a trust question, since the board is the seat's record); or each session writes its own status file in the registry directory and only the coordinator writes the board, aggregating at its pass. Lean: per-session status files with a single board writer, because a shared-writer board reopens the exact one-record-one-writer discipline the coordinator skill's ledger rules exist for. A sub-question rides here: what counts as a material change worth a push (a Chapter close, a BLOCKED, a gate baseline change, a claim-file write), which the round should enumerate and close with its class.

**Fork 4: seat tiers.** The coordinator's work is reads, relays, and reporting; it does not need the top model routinely. Options for where the guidance lives: the peer-sessions Roles section gains one tier line per seat, or the coordinator skill carries its own and each future seat skill follows. Proposed starting assignments for the round: coordinator at Opus with Sonnet as the observation-gated step down; Expert at Fable, since spec authorship is the work the top tier exists for; Worker per its plan's own section tiers, unchanged; Admin at the cheap tier, its work being process and config actions. Lean: peer-sessions Roles owns the table, one owner for all seats, and the tier line states the step-down condition observably (a review-adjudicated month of boards, not a feel).

**Fork 5: the elevated Admin.** Its messages arrive but nothing reaches it. Options: (i) document the one-way property and have the seat push its own state through the registry heartbeat; (ii) an artifact inbox, `admin-requests.md` in the machine's coordinator directory, that the Admin polls on its own loop, with the registry heartbeat proving life; (iii) run the seat non-elevated and elevate per command (gsudo or RunAs), which keeps it on the roster at the price of a UAC prompt per action. Lean: (ii), because it is the artifact-first answer, the directory already exists in this design, and the same loop that polls the inbox is the loop that opens the seat's compaction boundary; (iii) stays the fallback where per-action interactivity turns out to matter.

**Fork 6: where the worker's remaining-time estimate lives.** The artifact-first design wants a `Remaining:` wall-clock estimate readable per worker. Options: the Chapter format gains a line, which edits a frozen machine contract (`curating-docs`' table) and every parser of it; or the estimate lives in the session's registry status file, leaving the Chapter contract untouched. Lean: the registry status file, because a frozen contract is expensive to version and the estimate is transient coordination state, exactly what the registry is for and exactly what a curated plan record is not.

## Round inputs, answered 2026-08-27

- The prompt-cache TTL: 1 hour is the universal ceiling per the operator's reading of the vendor guidance, and expiry can come sooner, never later. Cadence tuning may assume TTL at most 1 hour on every machine, and warm-window tactics do not cut the window close, since sub-hour expiry is possible.
- The loop census, operator-stated for the whole fleet: the coordinator's loop was the only fixed loop in existence, and it is off while the operator is at the keyboard. An Admin seat ran for a stretch and had no work in 18-plus turns before being shut down, which is direct evidence for Fork 5's inbox model and the Admin tier's cheapness. The push model's payoff is therefore measured against that one loop's overnight cold-read bill plus the fleet replication the operator wants it for.

## Standing Brief Amendments

1. Every line anchor and quoted current-text phrase in these sections is authoring-time and is re-read from the file at implementation; a counted claim (test counts, wall clocks, pin counts) is measured by the section that states it, with the measuring command named beside the number, never copied forward.
2. A skill-prose amendment's reviewers are briefed on the whole file, never the diff, because this change class has a recorded defect mode: the new paragraph is right and an unchanged neighbour now contradicts it (project memory `skill-amendments-collide-with-neighbours`, read with `memq get`; the memory store lives outside the repo).
3. Each section captures the suite baseline before its first edit (`node --test "test/*.test.js"`; pass/fail counts, failing names, wall clock with the box's contention state beside it) and reports the delta at its close.
4. Nothing in this repository carries the operator's capacity or billing specifics, and every operator decision is recorded by reference, never by quotation. The repository is public.
5. No section writes the live store (`~/.claude`): every test runs on fixture stores and fixture home directories. The live `coordinator/` directory's first write is the operator's adoption ritual after the fleet rollout Section 1 states, listed at close-out, never a section step.
6. A section that edits anything under `plugins/claude-kit/hooks/` rebuilds the plugin build stamp before running its gate (the stamp hashes bytes while git merges lines; project memory `merging-hook-edits-staleness-the-build-stamp`), and compares build figures only against the same PowerShell host (`build-size-differs-by-powershell-host`). Both memories are read with `memq get`; the store lives outside the repo.

## Sections of Work

### 1. The allowlist and drift reporting admit `coordinator/` (element A)

Model: opus

`Get-MemorySyncIgnoreText` (`plugins/claude-kit/doctor/install-memory-sync.ps1:81`) gains a `coordinator` block through the existing `$tierRules` helper, placed with the tier blocks so the trailing transient exclusions (`*.lock`, `*.bak`, `*.tmp.*`) still land last and refuse those forms under `coordinator/` by the same last-match-wins design the tiers use. The path predicate (`Test-MemorySyncPathAllowed`, `:202`) and any probe enumeration (`Get-MemorySyncProbePaths`, `:235`) are extended so every reader of the allowlist answers identically for coordinator paths; the installer's own comment at `:58` states that single-definition rule and this section honors it. `Get-MemorySyncAttributesText` is untouched: every file the directory contract (Section 3) defines is single-writer, so no union merge is needed.

The rollout constraint, stated here because this section creates it: `sync-store.ps1` screens every incoming tree entry against the allowlist and refuses the whole intake as inbound-leak on any disallowed path, and its mutation bar requires both managed files Canonical against the current installer's text. So a fleet machine on the old plugin refuses intake of any pushed `coordinator/` file, and a machine on the new plugin whose store `.gitignore` has not been re-derived reads Drift and stops mutating. Deployment order, the operator's ritual at adoption: every fleet machine takes `claude plugin update` and then `doctor -Fix` before the first write lands in `coordinator/`. The close-out hands the operator that list; per Amendment 5 no section of this plan performs it.

Tests, red first, extending `test/memory-sync.test.js`: a `coordinator/<machine>/board.md` path is refused by today's ignore text and path predicate (red), admitted after (green); `coordinator/**/*.lock`, `*.bak`, and `*.tmp.*` are refused both before and after (pin); the ignore text and the path predicate agree on all of the above; the existing exclusion probes (credentials, settings, transcripts) stay green untouched (pin).

Files in scope: `plugins/claude-kit/doctor/install-memory-sync.ps1`, `test/memory-sync.test.js`.

### 2. The board moves home, and the cold start becomes a tick order (element B, folding the cold-start backlog entry)

Model: opus

The coordinator skill's board surgery, in `plugins/claude-kit/skills/coordinator/SKILL.md`:

- The board's path becomes `coordinator/<machine>/board.md` in the memory store (`~/.claude`), `<machine>` the hostname as the peer-sessions Naming section spells machine-scoped seats. The home-repo concept dissolves with it: no operator-tier home-repo record, no per-session home confirmation, no checkout question, and the whole board-absent branch family (absent-from-checkout, absent-from-origin, unpushed-predecessor) collapses to one state, since the store is on every machine by the doctor's own install and an absent directory means no board yet.
- The publication machinery collapses to the private-store premise: the store's remote is the operator's own private store remote by the sync's design (the same repository that carries the memory tiers), so the visibility read (`gh repo view`), the publication-clearance ask, the awaiting-clearance stub form, and the per-subject clearance asks retire. What survives, restated on the new premise with its own reason: the board confers no authority; the operator's quoted words never appear on a board line; the commitment records and the stub-for-detail form survive (the board never silently drops a commitment it is the only record of); and the board still carries no working directory, the registry being the one place one lives.
- The push ritual retires: the seat writes the file and never runs git in the store; `sync-store.ps1`, spawned by `memory-session.js` at session starts, is the store's only committer, and cross-machine visibility rides sync cadence, which Out of Scope already names as the designed scope.
- The cold-start paragraph (the backlog's restructure entry, 2026-08-26) becomes a numbered tick order in the chassis's own style, shorter than today's because the dissolved branches take most of its 430 words with them: arm the seat's wake first (a crash mid-read leaves no timer behind), then read the board at the store path. The seat's cadence is restated here as event-driven wakes (the blocker funnel's messages, operator pings) plus a reconciliation timer every 4 hours, the figure Section 5 aligns the boundary marker to; the fixed hourly heartbeat retires with the push model, and the timer keeps the practice the round inputs record: off while the operator is at the keyboard.

Two parity pins redden by design and are re-derived red-then-green, per the backlog entry's own direction: `test/doctrine-parity.test.js:402` pins the literal `docs/coordinator-board.md` in the skill body and re-pins to the store path; `:414` pins the hourly heartbeat wording and re-pins to the new cadence statement. Two must stay green untouched: peer-sessions' near-end clause "the coordinator skill names the file" (`:365`), which stays true at the new path, and the pricing deferral "no oftener than the coordinator's heartbeat cadence, which that skill states", which requires the restructured skill to still state a cadence. A repo-wide grep for `coordinator-board` closes the sweep; the implementer enumerates every referrer it surfaces in the Chapter and updates each.

This section restructures existing content only; Section 3 adds its registry ticks to the restructured cold start afterward, so the two edits to this file never contend.

Tests: the two re-derived pins red then green; the peer-sessions four-heading pin (`:332`) green untouched; suite delta per Amendment 3.

Files in scope: `plugins/claude-kit/skills/coordinator/SKILL.md`, `test/doctrine-parity.test.js`, plus the referrers the `coordinator-board` grep surfaces.

### 3. The registry, the claim file, and the `/role` skill (elements C, E, F)

Model: fable

A new skill, `plugins/claude-kit/skills/role/SKILL.md`, invoked as `/role <Seat>`, owns the coordinator-directory contract and the takeover ritual. One owner: peer-sessions and the coordinator skill point here for the directory's shape and never restate it.

The directory contract the skill states: `~/.claude/coordinator/<machine>/` holds `board.md` (the coordinator's, Section 2), `registry/<session-id>.md` (one per registered session; written by that session, plus the one `Heartbeat:` line the seat-stop hook stamps in Section 5), `claims/heavy-process.md` (the machine's one-heavy-process slot, element E), and `admin-requests.md` (Section 6). Every file is single-writer by this contract; another session's registry file is never yours to write, and only the coordinator writes the board. All file forms stay inside the sync allowlist's admitted leaves (`*.md`, `*.jsonl`).

The registry entry's shape, exactly:

```
Name: KIT: Worker
Role: Worker
Repo: claude-kit
Workdir: D:\repos\claude-kit
Session: <session-id>
Started: <ISO>
Status-updated: <ISO, rewritten by the session at each push>
Remaining: <wall-clock estimate, Fork 6's home; "none" where nothing is in flight>
Heartbeat: <ISO, hook-written>

Status: <a few lines, what a public board could carry>
```

An absolute `Workdir` is allowed here and only here: the store is private and the registry is the one place peer-sessions lets a working directory live, readable across the elevation boundary. The push moments (Fork 3's material-change enumeration, closed with its class): every banked boundary the seat's own runbook defines, and any of a Chapter close, a BLOCKED declaration, a suite or gate baseline change, a claim write or release, a seat takeover or handoff; the class is any event that changes what the coordinator's next board would say about this session.

The claim file (element E): one file models the one-per-machine heavy-process budget. Before a suite, build, or embedding pass, write `claims/heavy-process.md` with `Repo:`, `Session:`, `Started:`, `Expected-seconds:`; delete it at completion. The claim is advisory and the process list stays the verdict: the testing-discipline skill's box check is engine-agnostic by its own design and needs no change; a session finding a live claim waits or names the contention, and a claim whose session the reconciliation diff shows dead is swept by the coordinator (Section 4).

The `/role` ritual, in order: confirm the session carries the seat name the peer-sessions Naming convention requires, and stop with the relaunch instruction where it does not. The exact launch invocation is a per-machine operator fact the public skill cannot carry: it lives in the operator memory tier, one record per machine written at adoption (the close-out lists seeding it), the skill resolves it with `memq` and falls back to stating the required name and asking the operator where no record answers, and a relaunch rather than a rename is required because the relay-channel flag bakes the session's name into its thread at process start; load the seat's runbook (the coordinator skill for that seat, the peer-sessions Roles bullet otherwise); read the board, and for Admin the inbox; write the registry entry; arm the seat's wake at the cadence the seat's tier row states (Section 7's table; the pointer dangles for two sections inside this run, which the plan's own completion closes); announce the takeover per the coordinator skill's handoff rules where a predecessor is live; and push the first status, which the seat-stop hook converts into the compaction boundary (Section 5). `/role Admin` prepares and asks rather than self-arming: the arming stays the operator's act. Element F's home-directory resolution step dissolves with Section 2's migration: the directory derives from the home directory and the hostname, and nothing per-machine needs recording first.

A new cross-file pin lands in `test/doctrine-parity.test.js`, following that file's own near-end/far-end pattern (`:343-:420`): near end, peer-sessions names the role skill as the directory contract's owner; far end, the role skill on disk carrying the registry-shape section. Red first on the far end: write the pin before the skill file exists, watch it fail, land the skill, watch it green. README's payload map gains the role skill's line.

Tests: the new pin red then green; suite delta per Amendment 3.

Files in scope: `plugins/claude-kit/skills/role/SKILL.md` (new), `plugins/claude-kit/skills/peer-sessions/SKILL.md`, `plugins/claude-kit/skills/coordinator/SKILL.md`, `README.md`, `test/doctrine-parity.test.js`.

### 4. Reconciliation becomes a diff, and the status round becomes the residue (element D and Fork 3)

Model: opus

The coordinator skill's reconciliation pass gains the registry as a source and the diff as its shape: the pass diffs the live roster against `registry/`. Registered-and-absent means the session exited; the pass prunes its registry file (the one write the coordinator makes under `registry/`: prune, never edit) and sweeps any claim it held. Present-and-unregistered is listed on the board once as unregistered and never polled. An elevated seat, off the roster by the one-way property Section 6 documents, proves life by its `Heartbeat:` stamp; a heartbeat stale past twice the seat's stated cadence reads as exited and takes the same prune.

Worker status derives from artifacts only, now stated as the pass's default rather than the funnel's aside: the goal CLI, plan-doc Chapters, `kit-events.jsonl`, the branch tip, and the registry status file (`Remaining:` and the Status lines). The operator-interface function bullet rewrites to match: status aggregation is the registry-and-artifact read, and a message goes out only for what no artifact carries to the party that needs it in time, which is the peer-sessions stance the skill already defers to. In peer-sessions, the status round's paragraph in the sanctioned-patterns section takes one amendment: the round is the residue for what no registry file or artifact carries, at its existing pricing; the pricing deferral to the coordinator's stated cadence stays as pinned in Section 2.

Fork 3's writing topology is stated where the readers look: sessions write status only to their own registry file, only the coordinator writes the board, and the role skill (Section 3) already owns that contract, so both runbook mentions are pointers.

Tests: prose section; the Section 2 and 3 pins stay green; suite delta per Amendment 3.

Files in scope: `plugins/claude-kit/skills/coordinator/SKILL.md`, `plugins/claude-kit/skills/peer-sessions/SKILL.md`.

### 5. The boundary becomes structural, and the marker survives the gap (Forks 1 and 2, folding the consent ergonomics backlog entry)

Model: opus

Three mechanical changes and the prose that rides them:

- `ROLE_BOUNDARY_MAX_AGE_MS` (`plugins/claude-kit/hooks/kit-compact-lib.js:1621`) rises from 30 minutes to 4 hours, spelled as the same `GATE_EPISODE_MAX_IDLE_MS` expression `CONSENT_MAX_AGE_MS` already takes (`:1622`), so the three quantities bounding a seat's quiet gap share one constant and a marker opened at a pass's end is still live when the harness's auto-offer arrives anywhere inside the 4-hour cadence. The longer window is safe for the sessions this marker serves because it is written only at moments a seat's runbook defines as banked, and a seat's stated invariant is that context holds nothing the disk does not, so a compaction anywhere in the window costs a re-read, never state. Fork 1's reserve (the gate reading a seat's own timer as automation) stays unbuilt: it moves a trust boundary the security model prices, and the push model plus this change removes the case that motivated it. The checkpoint CLI's derived reporting (`BOUNDARY_MINUTES`, `kit-compact-checkpoint.js:61`) follows the constant.
- A new Stop hook, `plugins/claude-kit/hooks/seat-stop.js`, wired third in `hooks.json`'s Stop array, reading the same stdin payload shape `kit-goal-stop.js` consumes (`session_id`, `cwd`). It resolves `~/.claude/coordinator/<hostname>/registry/<session-id>.md`; absent, it exits silently, so the whole cost for every unregistered session on the machine is one stat. Present: it stamps `Heartbeat:` (throttled to one write per 10 minutes), and where the file's `Status-updated:` stamp is fresher than 10 minutes, meaning the session pushed status this turn, which is the seat's own banked declaration, and the cwd's tree is clean (`git status --porcelain` empty; a non-git cwd or a failing git reads as clean, fail-open, since the marker's worst case is a compaction at a declared boundary), it writes the role-boundary marker via `writeRoleBoundary` (`kit-compact-lib.js:1771`). The status push is the boundary declaration; the hook is what makes it structural, which is Fork 2's decided shape. The CLI's `boundary` verb survives as the manual path for an unregistered session.
- `kit-compact-checkpoint.js consent` gains `--project <path>` (the backlog fold): the marker resolves against the named directory instead of the cwd, and the command refuses loudly when the named session has no transcript under that project, turning the recorded silent-miss failure into an error; the transcript-path derivation reuses the flattening the kit already applies, and the implementer names the helper in the Chapter.
- The prose that rides: the coordinator skill's pass-end boundary paragraph and peer-sessions' "Each seat banks at its own moments" paragraph rewrite to the new shape (a seat ends its banked moment by pushing status to its registry file; the hook opens the boundary; the CLI command is the fallback), each a one-paragraph edit reviewed whole-file per Amendment 2. The leashed worker's chapter checkpoint is untouched: leashed sessions land compaction through it exactly as today.

Tests, red first, in a new `test/seat-stop.test.js` plus the compact suite files the implementer extends: the hook is silent for an unregistered session; stamps and throttles the heartbeat; opens the marker only on fresh `Status-updated:` plus clean tree (dirty tree: no marker; stale stamp: no marker; non-git cwd: marker); the age-boundary tests pinning 30 minutes go red then green at 4 hours; `consent --project` writes at the target and refuses a session with no transcript there, with a control run proving the happy path; and the role-boundary allow gets its recorded green as a full path, marker written by the hook at a fixture cwd and the gate then journaling an `allow` with reason `role-boundary`, the test Fork 2 called non-negotiable. The two end-to-end operator observations in the backlog stay operator work and ride the close-out list. Amendment 6 applies: this section edits hooks, so the build stamp is rebuilt before the gate.

Files in scope: `plugins/claude-kit/hooks/kit-compact-lib.js`, `plugins/claude-kit/hooks/kit-compact-checkpoint.js`, `plugins/claude-kit/hooks/seat-stop.js` (new), `plugins/claude-kit/hooks/hooks.json`, `plugins/claude-kit/skills/coordinator/SKILL.md`, `plugins/claude-kit/skills/peer-sessions/SKILL.md`, `test/seat-stop.test.js` (new), `test/kit-compact-gate.test.js`, `test/compact-deferral-nudge.test.js`, and any further file a grep for the constant name surfaces (three test files reference it at authoring; the section re-runs the grep).

### 6. The Admin inbox (Fork 5)

Model: sonnet

`admin-requests.md` in the machine's coordinator directory: a dated checklist, one line per request, appended by the coordinator routing an operator ask or by the operator's own session; the Admin seat polls it on its own loop at the cadence its tier row states, acts within its two binding constraints unchanged (every action reported; support, never work product), and flips the handled line with a one-line outcome. The role skill's directory contract gains the file's shape as its owner. The peer-sessions Admin bullet gains the reachability statement: an elevated session's sends arrive while nothing reaches it (`ListAgents` never lists it, `SendMessage` fails unreachable; the Windows-integrity-level cause stays marked inferred), the inbox is how work reaches the seat, the registry heartbeat is how it proves life, and per-command elevation (gsudo or RunAs) stays the named fallback where per-action interactivity matters. The coordinator skill's routing line points at the inbox.

Tests: prose section; pins green; suite delta per Amendment 3.

Files in scope: `plugins/claude-kit/skills/role/SKILL.md`, `plugins/claude-kit/skills/peer-sessions/SKILL.md`, `plugins/claude-kit/skills/coordinator/SKILL.md`.

### 7. Seat tiers and report shape (Fork 4 and element G)

Model: sonnet

The peer-sessions Roles section gains the tier-and-cadence table, one row per starter seat, one owner for every number except the coordinator's cadence, which stays the coordinator skill's own statement per Section 2's pin: Coordinator at Opus, cadence per its own skill, stepping down to Sonnet when a month of review-adjudicated boards shows no judgment miss (an observable gate, not a feel); Expert at the top tier, no loop, waking on demand for authoring and consults; Worker at whatever its plan's section tiers name, per executing-work's routing, no loop of its own; Admin at Sonnet with a 4-hour inbox poll, Haiku named as the step-down once a month of inbox traffic shows the work mechanical. The table closes with its class: a new seat takes the cheapest tier its judgment surface allows and states its own observable step-down gate. Amendment 4 rides this section hardest: tier names only, no capacity or billing figures.

Element G lands in the coordinator skill's Etiquette section: operator reports are deltas against the last board state, capped, never full tables; and every relayed message leads with its audience, because relayed traffic reading as though addressed to the operator was a measured reading friction (Evidence above).

Tests: prose section; the peer-sessions four-heading pin and Section 3's role-skill pin stay green; suite delta per Amendment 3.

Files in scope: `plugins/claude-kit/skills/peer-sessions/SKILL.md`, `plugins/claude-kit/skills/coordinator/SKILL.md`.

## Out of Scope

- The operator's capacity and billing specifics. They shaped the priority and stay in the message layer; this repository is public and carries none of them.
- Real-time cross-machine coordination. The per-machine directory reaches every box through the store's own sync at sync cadence, and that is the designed scope.
- Verifying the cache TTL fleet-wide inside this plan. It is a named input above, taken per machine by whoever tunes that machine's cadence.
- The memq-hardening backlog items: parked by default 2026-08-27, no countermand; revisit at slate close.
- The adoption itself: the fleet rollout (per-machine `claude plugin update` plus `doctor -Fix`), the live board's migration off any existing home repo, and the first `/role` takeovers are the operator's steps, listed at the close-out, never sections here (Amendment 5).

## Related

- `docs/plans/claude-kit_testing-discipline_spec_v1.md`: slate priority 1, in execution; its box check composes with element E's claim file. The two plans share exactly one file, `test/doctrine-parity.test.js`, which is why the start condition above sequences this plan behind that queue.
- `docs/archive/claude-kit_compact-boundaries_spec_v1.md`: created the two release markers Forks 1-2 amend.
- `docs/archive/claude-kit_coordinator-and-roles_spec_v1.md`: created the seat vocabulary and the board this plan re-homes.
- `docs/plans/claude-kit_session-roles_notes_v1.md`: the design dialogue's fact base behind the seat vocabulary.
- `kaizen/notes-SCOTT-CLAUDE.md`, the seven 2026-08-26 seat-cluster notes: the origin, cleared into this draft at authoring.
- `docs/backlog.md`: the two folded entries (the `consent --project` flag, 2026-08-26; the coordinator cold-start restructure, 2026-08-26).

## Chapters
