# The seats run on artifacts, at the cheapest sufficient tier, and compact at their own boundaries

Status: In Progress
Commit Model: Commit-and-Push
Created: 2026-08-27

**Sections fully briefed 2026-08-27; parked awaiting the operator's arming as first of the remaining queue.** The operator accepted all six marked recommendations as binding proceeds, with one clarification on Fork 3 and both named inputs answered; The settled round below is the record. The Draft status is deliberate: it keeps this parked plan out of the SessionStart resume inventory until armed, and the run that starts it normalizes the header to In Progress per executing-work; the plan-lifecycle spec of this slate gives the authored-and-parked state its proper name. Slate position: first of the remaining queue, ahead of memq-network-cwd-resolver, decided by the operator 2026-08-27 at the keyboard of this repo's expert session (recorded here by reference, never by quotation, per the authorization-format convention; the Dispatch Authorization section below is the grant of record).

Session model: Opus, in a clean session opened in the kit repo. Sections run in order: 1 through 3 are strictly sequential (history, then the board's new home, then the directory contract the later sections read), 4 through 6 each assume their predecessors, 7 is prose and runs last. The start condition, as one named check: this plan starts when `docs/plans/claude-kit_testing-discipline_spec_v1.md` reads `Status: Complete` or sits in `docs/archive/`, readable from `/kit-goal` with no arguments or the SessionStart notice; the shared `test/doctrine-parity.test.js` (edited by the testing plan and by Sections 2 and 3 here) is that ordering's reason, not a second gate. `claude-kit_memq-network-cwd-resolver_spec_v1.md` runs behind this plan, not ahead of it, per the Dispatch Authorization section below. Authored by the KIT: Expert seat from the 2026-08-26 seat-coordination kaizen cluster plus the operator's 2026-08-27 cost addendum. Anchors as of commit `73e3aaf`; re-read at implementation per Standing Amendment 1.

## Dispatch Authorization

Authorized 2026-08-27 by the operator: arming and execution of the four remaining queue plans by a worker session in this repository on this machine, in order: seat-infrastructure, then memq-network-cwd-resolver, then review-and-record-discipline, then plan-lifecycle-and-diagnostics, each plan honoring its own recorded start condition. This grant supersedes the same date's earlier grant, which placed a three-plan slate behind an armed testing-discipline and memq-network queue: the operator promoted seat-infrastructure ahead of memq-network-cwd-resolver, and the earlier queue's leash did not survive the session that held it, so memq-network-cwd-resolver now carries its own section rather than riding an armed goal. The grant was given at the keyboard of the KIT: Expert session in this repository and is mirrored on that session's account-allowlisted relay thread, which is the artifact holding the operator's words; it is recorded here by reference rather than quotation, per the public-repository convention. One grant covers the four plans, each carrying its own section pointing at it. This section was authored by the KIT: Expert seat on that keyboard instruction; per the peer-sessions trace rule it is a warrant only for a citing session that did not author it, and the receiving session performs its own trace of the grant before arming. That trace takes the form the peer-sessions rule states, provenance rather than credential: it reads this section's recorded claim, the commit that landed it, and the grant's scope against the action in front of it; the relay thread is the operator's own audit surface, not a surface the trace requires opening.

## Goal

Seat coordination today is message-first, top-tier, and timer-paced: the coordinator learns who is running by messaging each session and waiting for a boundary reply, the seat ran on the strongest model for work dominated by reads and relays, its loop woke every 60 to 90 minutes against a 1-hour prompt cache TTL so overnight wakes paid cold-read rates on the heaviest contexts for mostly no-change answers, and a looping seat that never compacts cold-re-reads an ever-growing principal. One day of live seats produced: a worker's board row written wrong because its leash lived in a worktree's own `.kit`, two suite gates launched blind to each other, and an elevated Admin unreachable by any peer.

When this plan is done: sessions register by file and the coordinator reconciles a roster-versus-registry diff instead of polling; worker status derives from artifacts a pass reads for free; heavy work announces itself on a claim file before it starts; taking a seat is one `/role` command instead of a hand-assembled ritual across three skills; each seat runs at the cheapest tier that does its job; every seat compacts at its own declared boundary instead of riding to the safety ceiling; the board lives in the memory store and reaches every machine without its own push ritual; and an elevated Admin seat is reachable through an artifact inbox. Cost-efficiency is a first-class design goal, not a nicety: this coordination model must run affordably on machines with far less model bandwidth than the one it was developed on.

## Evidence

- The compaction gate reads only a typed `/loop` as automation: `automationInEffect` in `plugins/claude-kit/hooks/kit-compact-lib.js` keys on a user entry whose command-name is exactly `/loop` (confirmed from the installed gate, per the 2026-08-26 note), so a seat driven by a timer it armed itself is a hands-on session in the gate's eyes.
- Across roughly 1,800 gate verdicts in the two journals on this machine (`.kit/compact-gate.jsonl` in claude-kit and ai-os), zero allows carry reason `role-boundary` or `operator-consent` (reported, 2026-08-26 journal read): the goalless-seat boundary is prose with no production green.
- The boundary marker ages out at about 30 minutes while the coordinator skill arms its heartbeat hourly (`plugins/claude-kit/skills/coordinator/SKILL.md`, cold-start paragraph), so the one release that skill prescribes can be stale at every wake.
- An elevated-console session is one-way on the messaging surface: its sends arrive, but `ListAgents` in a non-elevated session never lists it and `SendMessage` to it fails unreachable (reported; probed from the coordinator seat against the first Admin seat; Windows integrity levels on the session pipe is the inferred cause).
- The prompt-cache economics (from the operator discussion of 2026-08-27, relayed): the coordinator's harness states a 1-hour prompt cache TTL for its session (confirmed for that session; fleet-wide TTL unverified, and one per-machine check is a named input below); a 60-to-90-minute wake cadence lands just past it, paying roughly 10x cached rates per wake; a long-context seat's spend is input-token dominated (inferred, not measured), so model tier and wake shape are the levers and effort reduction is a half-measure.
- The store's `.gitignore` is doctor-derived and excludes everything but the memory tiers: `Get-MemorySyncIgnoreText` in `plugins/claude-kit/doctor/install-memory-sync.ps1` (re-include entries near :97) is the canonical allowlist, `Get-MemorySyncFileState` (:188, :337) reports drift, and a hand edit reads as a Foreign file failure, so a `coordinator/` directory cannot exist in the store until the allowlist admits it.
- Operator decisions of record, all recorded by reference: the board and its files live in the memory store repo under a per-machine directory (decided 2026-08-26); registration-by-file and artifact-first status is the operator's own design (2026-08-26); the `/role` command is an operator request (2026-08-26); priority 2 with cost as a first-class goal (2026-08-27, relayed by the machine coordinator), superseded the same date by promotion to first of the remaining queue (operator, at the expert session's keyboard; the Dispatch Authorization section is the grant of record).

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
7. A check whose acceptance is that it finds nothing is reported by naming the check that refuses each case, never by reporting the run green. This binds a pin whose subject is a refusal, a sweep expected to come back clean, and a grep whose acceptance is empty output. Such a check reads identically whether it refuses a case for the reason intended or for an earlier, unrelated one, so an axis can sit untested while reading as covered, with no wrong answer anywhere to notice it by. Section 1 produced exactly that: every transient-shaped name under the coordinator tier was refused by the leaf-form check before the transient rules were reached, so the transient axis was never exercised and its pin was green. An implementer states which rule produces each refusal, and a reviewer that cannot get that account treats the axis as unproven rather than as covered. The same bar reaches a sweep's dispositions: a referrer left unchanged is reported with the rule that exempts it, since "I updated the ones that needed it" and "I missed some" produce the same clean grep afterward.

8. A paragraph is the edit unit for a curated document, never the sentence. Where a change falsifies a claim that sits inside a paragraph, the whole paragraph is re-read and rewritten as one; a sentence-level replacement that leaves its neighbours unread is Amendment 2's recorded defect mode arriving in a document rather than in skill prose, and it fails the same way: the replaced sentence is right, and a clause beside it describing the same retired mechanism in different words survives and now contradicts it inside one paragraph. Amendment 2 binds what a reviewer is briefed to read; this binds what a writer edits, and it reaches every curated surface rather than skill files alone. A sweep's dispositions take the same unit, which is what makes this more than style: a referrer is settled by reading the paragraph that holds it, never by reading the grep line, because the grep line is exactly the sentence whose neighbours the miss lives in.

9. When a review retires or repairs a mechanism, every sibling mechanism resting on the same warrant is enumerated and dispositioned in the same round, never only the site the finding named. A finding arrives as one location, and a fix aimed at that location leaves untouched every other rule written from the same reasoning, which then reads as reviewed precisely because the round that examined its twin reported itself closed. Section 4 produced the case twice over: the reconciliation sweep was retired because its corroboration ran through the registry entry an attacker writes, and the registry prune one paragraph away kept the identical warrant, shipping two rounds later still claiming to rest on corroboration it does not have. The unit of disposition is the warrant rather than the paragraph, the file, or the finding's own coordinates: name the reasoning the repaired rule rested on, enumerate every rule this changeset's files state on that same reasoning, and give each one a disposition with the rule that settles it, per Amendment 7. A sibling left as it stands is named as such with its reason, because a round that repairs one of two twins and reports itself clean reads exactly like a round that checked both.

10. The plan document's own body is part of every changeset that changes shipped text, and it is re-read against that text in the same round rather than at the section's closing pass. Amendment 8 already says a paragraph is the edit unit; what kept failing is that nothing named the plan body as a surface the round has to visit at all, so a repair landed in the payload and the body one file away kept instructing the retired mechanism. Section 4 produced that three rounds running, each time in the hands that had just written the fix. The trigger is a change to shipped text rather than a review finding, because the body goes stale at the edit and not at the report: after a fix round, grep the body for the mechanism the round changed, read whole every paragraph the grep lands in, and rewrite or confirm each one, naming in the round's record which paragraphs were confirmed unchanged and why. The body is the recovery spine a post-compaction session executes from and the source later sections are briefed out of, so a body still describing a retired mechanism schedules that mechanism to be rebuilt by a session that never saw the round which retired it, which is a defect with a longer reach than the one the round was called for.

## Sections of Work

### 1. The allowlist and drift reporting admit `coordinator/` (element A)

Model: opus

`Get-MemorySyncIgnoreText` (`plugins/claude-kit/doctor/install-memory-sync.ps1:81`) gains a `coordinator` block through the existing `$tierRules` helper, placed with the tier blocks so the trailing transient exclusions (`*.lock`, `*.bak`, `*.tmp.*`) still land last and refuse those forms under `coordinator/` by the same last-match-wins design the tiers use. The path predicate (`Test-MemorySyncPathAllowed`, `:202`) and any probe enumeration (`Get-MemorySyncProbePaths`, `:235`) are extended so every reader of the allowlist answers identically for coordinator paths; the installer's own comment at `:58` states that single-definition rule and this section honors it. `Get-MemorySyncAttributesText` is untouched: every file the directory contract (Section 3) defines is single-writer, so no union merge is needed.

The rollout constraint, stated here because this section creates it: `sync-store.ps1` screens every incoming tree entry against the allowlist and refuses the whole intake as inbound-leak on any disallowed path, and its mutation bar requires both managed files Canonical against the current installer's text. So a fleet machine on the old plugin refuses intake of any pushed `coordinator/` file, and a machine on the new plugin whose store `.gitignore` has not been re-derived reads Drift and stops mutating. Deployment order, the operator's ritual at adoption: every fleet machine takes `claude plugin update` and then `doctor -Fix` before the first write lands in `coordinator/`.

That order is a precondition rather than a ceremony, and what makes it one is that the failure it prevents is total and silent. The refusal is of the whole intake rather than of the offending path (`sync-store.ps1:52`, `:498`, which writes state `gate` with reason `inbound-leak` and stops), so a machine still on the old plugin does not skip the coordinator files, it stops syncing memory at all, with no merge and no push. And the script never prints, always exits 0, and runs detached with its streams ignored (`:16`), so its state file is the only report: an un-updated machine is indistinguishable from a healthy one from the operator's chair until something else surfaces it. The store is not single-machine: it has a real private remote, the operator tier records three `machine:` values, and a second machine's own committer identity appears in the store's history, so at least one machine beyond the adopting one writes rather than merely existing. The third recorded machine carries no committer identity in the recent history and its sync state is not readable from the adopting box, which is the point rather than a gap in it: the refusal binds every machine that fetches at all, and a machine dormant long enough to be invisible here is exactly the one nobody remembers to update. The machine census is not derivable from anything in this repository, and the close-out is not built as though it were. The enumerations here disagree and neither is a census: the operator tier records three `machine:` values while `kaizen/` carries note files for five, and a machine appears in either only by having done the particular thing that writes there, so the shorter set is not a subset of the truth and the longer one is not the truth either. The operator answered it directly, which is the only source that can, and the answer is recorded in the operator tier as `only-two-machines-sync-the-kit-memory-store`: two machines sync, the other syncing machine first, then this one. Nothing else is on the list.

One of the machines that does not sync is why the predicate above is every machine that FETCHES rather than every machine running the kit. One live VM in the fleet receives this plugin and has no access to the store's private remote at all, so it can never fetch and the refusal can never bind it. A rollout reasoned from kit installs would put a machine on the list that no amount of updating changes, and would do it while still being able to miss one that syncs, since neither error is visible from the other's evidence. The close-out hands the operator that order and states the silence beside it, because "update the other machines first" reads as tidiness while the behavior it prevents is a machine that quietly stops receiving memory; per Amendment 5 no section of this plan performs it.

Tests, red first, extending `test/memory-sync.test.js`: a `coordinator/<machine>/board.md` path is refused by today's ignore text and path predicate (red), admitted after (green); `coordinator/**/*.lock`, `*.bak`, and `*.tmp.*` are refused both before and after (pin); the ignore text and the path predicate agree on all of the above; the existing exclusion probes (credentials, settings, transcripts) stay green untouched (pin).

Files in scope: `plugins/claude-kit/doctor/install-memory-sync.ps1`, `test/memory-sync.test.js`, and `plugins/claude-kit/doctor/doctor.ps1` (folded during execution: the `-Fix` consent prompts name "the memory tiers" while the commit they authorize now also carries the coordinator directory, which is a security finding of Major weight and so is fixed in this section rather than deferred; the prompts' wording is pinned in `test/memory-sync.test.js`, already in scope, so the fix moves both. Section 8 edits a different region of the same file, and the two run serially in one session).

### 2. The board moves home, and the cold start becomes a tick order (element B, folding the cold-start backlog entry)

Model: opus

The coordinator skill's board surgery, in `plugins/claude-kit/skills/coordinator/SKILL.md`:

- The board's path becomes `coordinator/<machine>/board.md` in the memory store (`~/.claude`), `<machine>` the hostname as the peer-sessions Naming section spells machine-scoped seats. The home-repo concept dissolves with it: no operator-tier home-repo record, no per-session home confirmation, no checkout question, and the whole board-absent branch family (absent-from-checkout, absent-from-origin, unpushed-predecessor) collapses to one state, since the store is on every machine by the doctor's own install. What that one state is deviated from this text during execution and the text now matches what shipped: an absent directory does not mean no board yet, because the seat cannot establish absence from evidence it can reach. The sync's state file records a run's outcome and never what the run exchanged, a store whose branch tracks nothing and a store with no remote at all both reach the same recorded success, and a real fetch only fixes some past time the seat cannot compare against a predecessor's write without running git, which this design forbids it. So the single state is that absence is never the seat's to conclude: a cold start finding no board reports to the operator and holds, and the operator's answer over a warranted channel licenses the first write. That is the conservative direction and it is the only one the available evidence supports, at the cost of one operator round per new machine, paid once rather than at every session.
- The publication machinery retires: the visibility read (`gh repo view`), the publication-clearance ask, the awaiting-clearance stub form, and the per-subject clearance asks all go. What replaces them deviated from this bullet's original wording during execution, and the text now matches what shipped. This bullet said the store's remote is the operator's own private remote by the sync's design; it is not, and the second recorded deviation of this section is that the private-store premise ships as a named precondition of one installation rather than as a design fact. The kit configures no remote, the sync pushes to whatever is configured, and nothing in the kit reads a remote's visibility, so no seat can derive its own readership; a repository host's privacy flag does not answer it either, since that reports who can find the repository rather than who can read it. The premise is therefore unestablished until the operator answers who reads the remote, and until then the seat writes the board as a public surface. Amending this bullet back to a private-store fact is the move Section 9 exists to prevent, and it would relax the cap while appearing to correct it. What survives, restated on the new premise with its own reason: the board confers no authority; the operator's quoted words never appear on a board line; the commitment records and the stub-for-detail form survive (the board never silently drops a commitment it is the only record of); and the board still carries no working directory, the registry being the one place one lives.
- The push ritual retires: the seat writes the file and never runs git in the store; `sync-store.ps1`, spawned by `memory-session.js` at session starts, is the store's only committer, and cross-machine visibility rides sync cadence, which Out of Scope already names as the designed scope.
- The cold-start paragraph (the backlog's restructure entry, 2026-08-26) becomes a numbered tick order in the chassis's own style, shorter than today's because the dissolved branches take most of its 430 words with them: arm the seat's wake first (a crash mid-read leaves no timer behind), then read the board at the store path. The seat's cadence is restated here as event-driven wakes (the blocker funnel's messages, operator pings) plus a reconciliation timer every 4 hours, the figure Section 5 aligns the boundary marker to; the fixed hourly heartbeat retires with the push model. The practice the round inputs record, the loop being off while the operator is at the keyboard, is this section's third recorded deviation and it did not ship: no predicate available to the seat reads attendance, and the chassis's own mechanic defers a timer only for as long as a turn runs rather than for as long as an operator is present, so the heartbeat fires in both states and the skill says so rather than claiming a suppression nothing delivers. What that costs is one re-derivation of a board the operator is already reading, and what it buys is an arm that survives them leaving, which is the state the reconciliation pass exists for.

Two parity pins redden by design and are re-derived red-then-green, per the backlog entry's own direction: `test/doctrine-parity.test.js:402` pins the literal `docs/coordinator-board.md` in the skill body and re-pins to the store path; `:414` pins the hourly heartbeat wording and re-pins to the new cadence statement. Two must stay green untouched: peer-sessions' near-end clause "the coordinator skill names the file" (`:365`), which stays true at the new path, and the pricing deferral "no oftener than the coordinator's heartbeat cadence, which that skill states", which requires the restructured skill to still state a cadence. A repo-wide grep for `coordinator-board` closes the sweep; the implementer enumerates every referrer it surfaces in the Chapter and updates each.

This section restructures existing content only; Section 3 adds its registry ticks to the restructured cold start afterward, so the two edits to this file never contend.

Tests: the two re-derived pins red then green; the peer-sessions four-heading pin (`:332`) green untouched; suite delta per Amendment 3.

Files in scope: `plugins/claude-kit/skills/coordinator/SKILL.md`, `test/doctrine-parity.test.js`, plus the referrers the sweep surfaces, which during execution resolved to `plugins/claude-kit/agents/docs-curator.md` and `plugins/claude-kit/skills/curating-docs/SKILL.md` (edited by the implementer), and `docs/security-model.md`, `docs/architecture.md`, `README.md` and `docs/README.md` (written in the main thread, since the docs-write-guard denies a non-curator subagent any write under `docs/`). `docs/README.md` is a fold made at the second review round: its `architecture.md` and `security-model.md` entries described the retired clearance model as current, and they sit under **Documents about the solution** rather than in an archive index, so the exemption below does not reach them. The `docs/security-model.md` write is this section's `## The coordinator board` section only, a different region from the allowlist boundary Section 8 owns in the same file; the two run serially in one session.

The mandated grep is `coordinator-board`, and it is under-inclusive for this change, which is worth stating because the sweep's own acceptance is that nothing is left: a referrer can describe the board without naming its path, and three did (`docs/architecture.md`'s "the ledger commit" and "hourly heartbeat", `README.md`'s "committed ledger"). The sweep therefore also runs on `hourly`, `clearance`, `home repo`, and `committed board|ledger|state`. Per Amendment 7 the sweep reports a disposition per referrer with the rule that settles it, and two classes are exempt rather than missed: the archive-index entries in `docs/README.md` and `docs/plans/README.md`, whose own preambles state that their entries record what a plan delivered when it shipped, and the three referrers under `docs/archive/`, both exempt under the append-only-history rule, since repointing either class would falsify a record rather than update a reference.

### 3. The registry, the claim file, and the `/role` skill (elements C, E, F)

Model: fable

A new skill, `plugins/claude-kit/skills/role/SKILL.md`, invoked as `/role <Seat>`, owns the coordinator-directory contract and the takeover ritual. One owner, and owning is precedence rather than sole spelling: peer-sessions and the coordinator skill are bound to this contract wherever the two are read against each other and this contract governs, while the coordinator's runbook still restates the parts of the directory contract a pass cannot be run without, and the dispatch-brief clause in the executing-work skill is a deliberate second copy of the claim protocol, the only copy a dispatched subagent ever receives, an agent inheriting no skills to read the contract through. A curation pass that finds one of those restatements is reading a designed copy, never drift to delete.

The directory contract the skill states: `~/.claude/coordinator/<machine>/` holds `board.md` (the coordinator's, Section 2), `registry/<session-id>.md` (one per registered session; written by that session, plus the one `Heartbeat:` line the seat-stop hook stamps in Section 5), `claims/heavy-process.md` (the machine's one-heavy-process slot, element E), and `admin-requests.md` (Section 6). The writer rule is stated per file rather than as one rule over the four, which is this section's first recorded deviation and the text now matches what shipped: this bullet originally read that every file is single-writer with the claim file as the one exception, and that was false for two of the four forms at once, since the claim file is written by every session and subagent on the box and the inbox exists to take appends from any session needing to reach the Admin seat. An accepted risk whose stated precondition does not hold is worse than a named one, and the guard exemption below rested on exactly that precondition. So: the board and each session's registry entry are single-writer, another session's registry file never yours to write and only the coordinator writing the board; the claim file and the inbox are multi-writer by design, each under its own protocol, the claim scoping its delete to the writer's own session so a completing writer cannot erase a live foreign claim. All file forms stay inside the sync allowlist's admitted leaves (`*.md`, `*.jsonl`). The directory is deliberately outside `memory-frontmatter-guard.js`'s tier set, and this contract states that exemption so it reads as design rather than oversight: the guard's rule is CLI-authored-only, and this directory exists for direct writes by seats, a Stop hook, and claim-writing subagents, so guarding it on the memory tiers' terms would refuse the contract's own writer classes, while a shape-checking guard would need a schema this contract does not state and a carve-out per writer class, each carve-out re-admitting the accident it exists to stop. What holds the contract is the per-file writer rule above plus audit rather than prevention, and this section's fourth recorded deviation is that both legs ship at their real strength rather than rounded up, where this paragraph originally rounded both. The readership premise cannot carry it: the store's remote being private is a precondition of one installation rather than a property of the design, unestablished until the operator answers who reads it, which is what Section 2 established for the board and what Section 9 exists to stop a later pass undoing. The audit leg is conditional in its turn, because the kit sets no git identity in the store at all, so the sync's history attributes a change to a machine only where the operator has established a per-machine committer identity, and to a sync window alone otherwise. An empty guard path here is the design and not a gap: nothing validates a coordinator file at write time on any machine the sync reaches, nothing scopes a machine's directory to that machine's own writers either, and the live board predates this contract and was written the unguarded way, the normal case rather than the exception.

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

An absolute `Workdir` is gated rather than simply allowed, which is this section's second recorded deviation and the text now matches what shipped. This bullet originally rested it on the store being private; that premise is a precondition of one installation rather than a property of the design, exactly as Section 2 established for the board and exactly the move Section 9 exists to stop a later pass making, and an absolute worktree path embeds the OS username. So the absolute form is gated on the coordinator skill's readership precondition being established, and the default state is unestablished: until the operator answers, `Workdir:` takes a degraded form (the repo name, or a worktree-relative name, or omitted). The registry remains the one place peer-sessions lets a working directory live at all, readable across the elevation boundary, and the board's own ban stands unchanged. The push moments (Fork 3's material-change enumeration, closed with its class): every banked boundary the seat's own runbook defines, and any of a Chapter close, a BLOCKED declaration, a suite or gate baseline change, a claim write or release, a seat takeover or handoff; the class is any event that changes what the coordinator's next board would say about this session.

The claim file (element E): one file models the one-per-machine heavy-process budget. Before a suite, build, or embedding pass, write `claims/heavy-process.md` with `Name:`, `Repo:`, `Session:`, `Started:`, `Expected-seconds:`; delete it at completion. The `Name:` is the claimant's session name as the roster prints it, and it is what the coordinator's probe addresses: this rule binds every heavy spawner, sessions that never took a seat included, and for an unregistered writer no registry entry exists through which an id could be resolved to an addressable name, so a claim carrying only its id would be one nobody could probe. The enforcement point is whoever spawns the process, never only the seat that dispatched it: the box's heavy processes are mostly subagents' (an implementer's targeted run, a build's leftover worker processes), so a protocol honored at seat granularity is violated at subagent granularity while the file reads clean. Accordingly the dispatch-brief template in `executing-work/SKILL.md` gains a standing box-budget clause for any brief whose work may spawn a suite, build, or embedding pass, and the clause is an obligation rather than a reading, because a brief bakes in a snapshot and cannot be amended mid-flight: the subagent checks the live claim file immediately before spawning, waits or names the contention on a live foreign claim rather than proceeding silently, writes the claim on its dispatching session's behalf, and deletes it at completion. The template places that clause at the spawn step itself, phrased as an act the agent performs at that moment, never as a constraint stated in preamble: a brief is a static document, minutes stale by the time its first heavy process spawns, and a constraint read once at the top is forgotten by gate time. A claim written by a subagent carries the dispatching session's id, which is what the claim file's multi-writer protocol turns on: a second writer class writing its principal's name, so that a delete scoped to the writer's own session still resolves correctly when the writer was a subagent rather than the seat. The claim buys legibility, never a guarantee, at every granularity: nothing enforces it in either direction, and an empty claims directory means nobody has claimed the box rather than that the box is free. What backstops a claim is its holder, never a process poll (amended 2026-08-28 on the coordinator seat's measured finding, dispositioned under its standing kaizen authority and adjudicated by the expert seat; recorded by reference per Amendment 4): a sampling instrument cannot see work whose lifetime is shorter than its interval, so no cadence repairs it, absence hides in-process agent fan-out, and presence is routinely an idle build server reading identically to a live one, so a single poll returns no direction of answer a release decision can stand on. The claim's lifecycle is therefore declaration plus an authority decision, the kit's wedge protocol applied to a shared resource rather than a new concept: the claim carries its holder's declared expected duration; past it the coordinator probes the claimant, a message being delivered at the claimant's next tool round so a live session answers and a wedged one cannot; unanswered past a stated window, and only where a roster reading agrees the claimant is not live, the coordinator releases the claim as a recorded decision rather than a measured fact, the window and the decider named, reversible because it can be wrong. The second leg is not redundancy: a session holding the slot is by construction inside one long-running tool call and so cannot take the round a message is delivered at, which makes silence strongest exactly where releasing is most costly, so a claimant the seat could not reach at all is never released and becomes an untracked hold reported to the operator instead. Reconciliation carries no second path to a foreign claim: a pass that believes a claim stale refers to this protocol rather than deleting on the strength of a diff, the join from a session id to a roster name running through a registry entry any local session writes directly and any machine on the store's remote writes through replication, so a rule deleting on that artifact's say-so would be deleting on its writer's say-so. A session finding a live claim waits or names the contention, unchanged. What retires is the process list as this protocol's verdict, not the pre-start box check: that check remains the testing-discipline skill's own, engine-agnostic by its own design and unchanged by this plan, and its instrument's limits are that skill's record rather than this contract's. A seat's arithmetic that its dispatched agent will not touch the box inside a window is a prediction rather than a guarantee, so a window negotiation rests on claims and the claimant's own declarations and probe answers, never on a poll. Two dispositions the claim contract carries were added at Section 4's enumeration round and belong to this contract rather than to that runbook. An affirming answer to a probe is the claimant side's own unauthenticated assertion, delivered by whichever session wears the claim's `Name:` at the send, so honouring it restarts the declared duration under the same bound with no ceiling on the chain: the contract states that plainly, substitutes a record for the ceiling it cannot have, and reports a claim past its first renewal as a hold outliving its declaration, which withholds nothing and refuses no renewal. And the file's fields are a disclosure beside its churn, all five rather than the two the sentence first dispositioned: `Name:` is the one that carries a hostname, a machine-scoped seat's name being the `HOSTNAME: Role` form, and it cannot be degraded because it is the address the probe is put to, so the disclosure is stated with its bound rather than screened away.

The `/role` ritual, in order: confirm the session carries the seat name the peer-sessions Naming convention requires, and stop with the relaunch instruction where it does not. The exact launch invocation is a per-machine operator fact the public skill cannot carry: it lives in the operator memory tier, one record per machine written at adoption (the close-out lists seeding it), the skill resolves it with `memq` and falls back to stating the required name and asking the operator where no record answers, and a relaunch rather than a rename is required because the relay-channel flag bakes the session's name into its thread at process start. The resolved text is confirmed at each resolution rather than once per machine, since the record is rewritable between resolutions and nothing on this machine records what was confirmed, so a confirmation covers exactly the text it was paid on and nothing later; load the seat's runbook (the coordinator skill for that seat, the peer-sessions Roles bullet otherwise); arm the seat's wake BEFORE any read, which is this section's third recorded deviation and the text now matches what shipped, since this clause originally armed after the board read and so inverted the cold-start order Section 2 shipped with its own recorded rationale, that a crash mid-read leaves no timer behind, and a ritual citing that order while inverting it is worse than one that never cited it; then read the board, and for Admin the inbox; write the registry entry; the wake's cadence is the one the seat's own runbook states, and the reconciliation cadence the coordinator skill states where the runbook states none, which is every seat whose runbook is a peer-sessions Roles bullet, those bullets stating no cadence, so the ritual resolves its cadence from surfaces this plan already ships and points at no unwritten table; announce the takeover per the coordinator skill's handoff rules where a predecessor is live; and push the first status, opening the compaction boundary at it per the peer-sessions banking rule, which splits on the leash: an unleashed seat opens the marker the CLI writes, nothing installed converting a status push into a boundary on its own, and a leashed seat lands its compaction through its chapter checkpoint and opens no marker. `/role Admin` prepares and asks rather than self-arming: the arming stays the operator's act. Element F's home-directory resolution step dissolves with Section 2's migration: the directory derives from the home directory and the hostname, and nothing per-machine needs recording first.

**Standing delegation (operator scope amendment, 2026-08-28, decided at the keyboard of this repo's expert session; recorded by reference per Amendment 4).** The skill's second charge: `/role` is how a seat comes up already holding the operator's standing delegation, replacing the pre-authorization paragraph the operator otherwise types into every new session by hand. The skill body defines the delegation model and never the grant. The model: the chain (Coordinator to Expert to Worker; a seat acts on scoped direction from the seats above it in this chain as carrying the operator's authority), the scope language (delegated direction covers planning, scoping, sequencing, and dispatching execution of sections of plans whose arming the dispatch-authority rail covers; a seat acting on delegation states the bound it is holding), and the exclusions, stated in the skill rather than left to inference: delegation never covers a push beyond a plan's recorded commit model, a deploy, a delete outside a plan's own scope, a message to an external service, an edit to permissions, settings, or CLAUDE.md (the harness floor no kit rule can lift), or doing work another session was denied (no-laundering binds unchanged). What turns the model on is a per-machine operator opt-in: one record in the operator memory tier, written at adoption on the operator's instruction (this machine's is seeded at close-out beside the launch-invocation records, per Amendment 5 never by a section), which `/role` resolves with `memq` at claim time. Where the record answers, the seat announces itself as delegated and treats scoped direction per the chain from then on; where none answers, the seat announces it came up undelegated and the operator's per-session paragraph remains the path. An install on another machine therefore changes nothing until that machine's operator writes the record: the grant is operator-scoped and machine-scoped where the skill body is neither, which is why the skill carries the model and cannot carry the grant. The skill states its own ceiling in so many words: the opt-in record narrows an honest writer without authenticating one, since any local session can run the CLI; it is provenance rather than credential, the dispatch-authority trace's standing exactly. The three refusal rules it composes with (a peer message carries no authority, a role claim confers nothing, a seat cannot warrant a grant it authored) stay in force verbatim, because a delegated seat's warrant is the record it reads on its own surface, never the message that pointed at it. Peer-sessions' Roles bullets gain the pointer to this model; the role skill is the single owner and peer-sessions never restates it, the same one-owner rule this section sets for the directory contract. The same peer-sessions edit clarifies the authorization-trace exclusion whose wording two honest readers parsed oppositely at a live arming decision (kaizen-folded 2026-08-28, operator-approved): the clause names its roles explicitly, author, citer, and receiver, and states the separation requirement structurally, that a grant's chain passes through at least one artifact or keyboard outside the authoring session, rather than as a sentence a reader must parse for it. The model's reach is bounded by charter, and the skill states the boundary: a relayed request carries an authority question only when it asks a seat for work outside that seat's own charter, while inside the charter a relay is a prompt, the seat having been entitled to the work unprompted, so no trace or delegation question arises at all. In-charter is defined by what the seat would have been right to do unprompted, never by what it is willing to do or finds reasonable, which is the test's stated failure mode. A prompt triggers work without supplying its conclusions: what the seat produces stays its own judgment, and a message that dictates conclusions is weighed as a peer claim under peer-sessions' standing rules unchanged. The delegation machinery therefore has a narrow job, making the out-of-charter asks traceable, not every message from a senior seat.

**Kaizen becomes a named seat function, with the routing duty reciprocal (operator scope amendment, 2026-08-28, given at the operator's keyboard in the machine coordinator's session and dispatched to this plan under the coordinator's standing kaizen authority; recorded by reference per Amendment 4).** Two clauses. One lands on files already in this section's scope; the other widens it by one, `plugins/claude-kit/skills/kaizen/SKILL.md`, which owns the capture bar the carve-out amends, and the files-in-scope line below records the widening. The coordinator seat gains kaizen capture, dispositioning, and dispatch as a named function carrying the operator's standing authority for it, and the coordinator skill's function enumeration amends in the same change: the set closed at three is now closed at four ("The seat holds three functions, and the set is closed at three", `plugins/claude-kit/skills/coordinator/SKILL.md:20` at amendment time; re-read at implementation per Amendment 1). Every other seat's definition, the role skill's runbooks and the peer-sessions Roles bullets alike, gains the reciprocal duty stated explicitly rather than left to the doctrine's ownerless capture bullet: captured kit friction routes to the coordinator and the seat carries on, never actioned inline, never shelved. The reason rides with the rule because it is the rule's boundary: a responsibility that names no owner is discharged by whichever party is least busy, which in a fleet is reliably the party least likely to have seen the friction, so the duty inverts against the evidence. Timing within the section is the worker's call, made to avoid racing a second writer into held files: fold into a follow-up dispatch after the current implementer returns, or into the section's own fix round. Two bars ride the duty, both added at Section 4's enumeration round because the capture bar the kaizen skill owns is a worth-a-note test and screens nothing about disclosure. The routing message takes the same public-board cap every message on this route takes, since a note's text is composed by the routing seat and read by another. And the landing is a re-disclosure act performed by a party that did not compose the text: folding a peer-composed note into a repository that may be public is bounded at the landing rather than at the capture, the composer's own cap not travelling with the note, and friction a seat cannot state inside that bar goes up to the operator as a decision ask rather than landing narrowed.

A new cross-file pin lands in `test/doctrine-parity.test.js`, following that file's own near-end/far-end pattern (`:343-:420`): near end, peer-sessions names the role skill as the directory contract's owner; far end, the role skill on disk carrying the registry-shape and standing-delegation sections. Red first on the far end: write the pin before the skill file exists, watch it fail, land the skill, watch it green. README's payload map gains the role skill's line.

Tests: the new pin red then green; suite delta per Amendment 3.

Files in scope: `plugins/claude-kit/skills/role/SKILL.md` (new), `plugins/claude-kit/skills/peer-sessions/SKILL.md`, `plugins/claude-kit/skills/coordinator/SKILL.md`, `plugins/claude-kit/skills/executing-work/SKILL.md` (the brief template's box-budget clause), `README.md`, `test/doctrine-parity.test.js`, and `docs/architecture.md` (folded during execution, written in the main thread since the docs-write-guard denies a non-curator subagent any write under `docs/`: the kaizen amendment falsified that file's statement of the coordinator's function set, and the four-layer claim declaration falsified its three-layer restatement, neither reachable by the fold's own file scope. The write is this section's function-enumeration and claim-layers regions only, a different region from the allowlist boundary sentence at `:194` that Section 8 owns and holds red-first; the two run serially in one session), `plugins/claude-kit/skills/kaizen/SKILL.md` (folded during execution: the kaizen amendment's carve-out grants the coordinator seat standing authority for dispositioning routed items, and the bar it carves out of is that skill's own, so it can be stated nowhere else), and `docs/README.md` and `docs/security-model.md` (folded during execution, written in the main thread for the same docs-write-guard reason: the first restates the coordinator's function count, which the kaizen amendment falsified, and the second restated the single-writer rule that this section's per-file writer rule replaced). The three folds are recorded here because the post-review `git add` scope check and the spec-matches-reality rule both read this line, so a list short of what the section changed silently narrows both.

### 4. Reconciliation becomes a diff, and the status round becomes the residue (element D and Fork 3)

Model: opus

The coordinator skill's reconciliation pass gains the registry as a source and the diff as its shape: the pass diffs the live roster against `registry/`. A session both surfaces answer for is the ordinary live case, its state read from its own entry. A session the registry carries that no roster row resolves to is a candidate rather than a verdict, because the join between the two runs through a registry entry any local session writes, so what the pass's readings buy is refusal rather than corroboration: the heartbeat reading is what decides it, a stamp that advanced past the entry's start and has since gone stale past twice the seat's stated cadence reading as exited and taking the prune, which is the one write the coordinator makes under `registry/`, a prune and never an edit. Every other reachable state of that field reads as unknown and prunes nothing: an absent stamp, the `none` the takeover shape writes, a stamp that will not parse, a stamp in the future, and a stamp present but not past the entry's start. The direction is deliberate, an entry kept being re-derivable next pass where an entry pruned is gone, and the honest statement of today's reach rides with it: no installed writer advances the field, so no entry reaches the exited reading by the kit's own action, while the field is directly writable and a hand-written past stamp reaches it, which is the prune's stated basis rather than a hole beneath it. The elevated seat is decided by that same stamp rather than by an exemption, since being off the roster is the exited leg's own trigger and an exemption asserted there would not hold. A roster row the registry does not answer for is marked unregistered and never polled in the status round, the mark scoped to local non-subagent rows so the board does not accrue a line per dispatched agent per pass; the claim probe is carved out of that mark by name, because an unregistered heavy spawner is exactly the population the claim's address field was added for, and a mark that swallowed the probe would hold the machine's one slot for good. The carve-out is stated at both never-poll sentences rather than at the one the finding named: the sibling covering other machines' sessions reads broader and took none at first, so a claim whose name resolves only to a foreign-machine row was unprobeable, which is exactly the state the first carve-out exists to prevent. The unit of disposition is the warrant rather than the sentence, and this pair is the recorded instance of that rule inside this section. Reconciliation carries no path to a foreign claim at all: a claim the pass believes stale is the claim protocol's to adjudicate on that protocol's own clock, no artifact on this machine independently attesting that a session id is dead.

The pass also operationalizes the claim protocol Section 3 hands it, which that section's review round established is otherwise assigned to this runbook and performed by nothing in it: the pass reads `claims/heavy-process.md` as a source alongside the registry, and it states by name, as figures rather than as a feel, exactly the two the contract defers to it, the probe window and the bound past which a claimant's own declared duration stops being honoured, carried in this skill on the precedent Section 2's cadence pin already set rather than re-invented at each pass. A third figure is what the runbook does not invent, and naming the count here is the guard: the release turns on the probe window this pass already states, so a release window is a name for a quantity that does not exist. Past the bounded declared duration the pass probes the claimant, and the release takes two legs rather than one, both required: the probe's send returned no failure and went unanswered past the probe window, and a roster reading agrees the claimant is not live. Together they license a recorded, reversible decision that notifies the claimant, the release being an authority act rather than a measured fact. Either leg alone leaves the claim standing as an untracked hold reported to the operator, and the second leg is not redundancy: a session holding the slot is by construction inside one long-running tool call and so cannot take the round a message is delivered at, which makes silence strongest exactly where releasing is most costly. What the review round then established about those two legs, and what the runbook now states at its real width, is that both are read off one board line rather than one of them: the banked roster reading the probe line carries is what the second leg compares against, the send time the same line carries is what the first leg's probe window counts against, and the only record an answer leaves is written beside that same line, which a forger writes none of. So a single forged line, a send time already past the window beside a banked idle pair, satisfies both legs by construction, and no test in the runbook or the contract refuses it. The screen at that point of use is therefore neither leg's own test but the release's shape, the recorded, notified, reversible decision under which a wrong release is seen by its holder and undone by a re-claim rather than standing silent; it bounds the act and never the line, and nothing in it establishes that a probe was ever sent, or sent when the line says. One case is named so a release does not read as its exception: a probe line the acting session did not write is a commitment no watched system re-derives, so a successor seat, or the same seat after a compaction, confirms it with the operator before releasing on it, which is the reconciliation guard already applied rather than a new rule. Where that decision is recorded is part of the rule rather than left to the seat, and the reason is that the alternative degrades silently: a release recorded only in a message dies with the session that sent it, leaving the next pass unable to tell a claim somebody adjudicated from one nobody ever looked at, which is the phantom hold arriving by a second route. So the release is written to the board, the coordinator's own single-writer surface, naming the claim, the elapsed window, and the decider; the deletion of the released claim file cites that board line, so the artifact that disappears points at the record that outlives it; and a seat with no board to record it on releases nothing, exactly as it prunes nothing. This is recorded as approval drift: Section 3's execution surfaced that the role skill assigns claim duties to a runbook whose source list named neither the claim file nor the registry, and a contract whose only designated performer never performs it leaves a crashed session's claim standing as a phantom hold until an operator notices.

Worker status derives from artifacts only, now stated as the pass's default rather than the funnel's aside: the goal CLI, plan-doc Chapters, `kit-events.jsonl`, the branch tip, and the registry status file (`Remaining:` and the Status lines). The operator-interface function bullet rewrites to match: status aggregation is the registry-and-artifact read, and a message goes out only for what no artifact carries to the party that needs it in time, which is the peer-sessions stance the skill already defers to. The aggregation's own disclosure route is screened where it is read rather than left to a bar stated for another surface: the `Status:` and `Remaining:` lines a session writes into its own registry entry reach the operator on two routes, the board's and the direct answer's, and the board's two line bars are applied at the aggregation and at the peer-sessions fold alike, since the board-line bars are board-line bars and the BLOCKED brief's path bar is the brief's. That screens the disclosure and nothing else: it establishes nothing about the line's writer and cannot reach what the writing session chose to put in the line. In peer-sessions, the status round's paragraph in the sanctioned-patterns section takes one amendment: the round is the residue for what no registry file or artifact carries, at its existing pricing; the pricing deferral to the coordinator's stated cadence stays as pinned in Section 2.

Fork 3's writing topology is stated where the readers look: sessions write status only to their own registry file, only the coordinator writes the board, and the role skill (Section 3) already owns that contract, so both runbook mentions are bound to it and it governs where they are read against each other. They are not bare pointers: a runbook restates the parts of the contract a pass cannot be run without, which is a designed copy rather than drift, and the contract's precedence is what keeps the two from disagreeing.

Tests: prose section; the Section 2 and 3 pins stay green; suite delta per Amendment 3. One pin is strengthened rather than added: the cross-file pin holding the dispatch-brief box-budget clause to the role skill's claim contract carried its own hardcoded list of the claim fields, a third literal drifting with neither surface, so a field added to one side alone read green against it. It now derives the field set from each surface and compares the two, which is what catches a one-sided addition or removal, and each of its three assertions is taken to red by its own ablation. A second pin is added at the enumeration fix round rather than strengthened: it derives the goal event's field set from the `emitGoalEvent` call sites in `kit-goal-stop.js` and from the emitter body in `kit-goal-lib.js`, compares the two surfaces to each other, and asserts every shipped field carries a backticked disposition in the disposition clause of the coordinator's BLOCKED funnel, the clause rather than the whole paragraph because a field named in the record enumeration beside it is not a disposition and a pin reading the paragraph passes on that mention, each assertion taken to red by its own ablation; it is the mechanical guard against the defect class the enumeration surfaced, a contract defining a field and routing no reader of it through a screen.

Files in scope: `plugins/claude-kit/skills/coordinator/SKILL.md`, `plugins/claude-kit/skills/peer-sessions/SKILL.md`, and `plugins/claude-kit/skills/role/SKILL.md` (folded during execution: this section's pass prunes a registry file, and the role skill is the owning contract, which names the coordinator's foreign-delete carve-outs explicitly for the claim file and not for the registry, so the prune as shipped would be a destructive power over a peer's single-writer artifact asserted only in the acting seat's own runbook. All three review lenses found it independently. The carve-out lands in the owning contract; the fold began as one narrow addition to that contract's registry writer rule and widened at the second review round to the claim protocol itself, because both files agree this contract governs where the two are read against each other and the release fixes had landed only in the runbook, which by that rule loses: a ruling implemented only in the losing file is not implemented. The security Critical at the launch-invocation screen is fixed here too, being a finding of a weight this plan never parks. All of it stays clear of the admitted-leaves parenthetical Section 10 owns in the same file). `plugins/claude-kit/skills/executing-work/SKILL.md` and `test/doctrine-parity.test.js` folded at the third round: the claim contract gained a `Name:` field so an unregistered writer's claim carries the address the probe needs, and the dispatch-brief clause is the only copy of that rule a spawning subagent ever receives, so a contract requiring a field its sole writer never writes would have left every subagent claim unaddressable. The pin that exists to hold those two surfaces to each other could not catch it, naming the fields in a list of its own, and is strengthened in the same fold. `docs/security-model.md` and `docs/architecture.md` carry counted claims this section falsifies and are routed to Section 8, which already owns both files, rather than folded here.

### 5. The boundary becomes structural, and the marker survives the gap (Forks 1 and 2, folding the consent ergonomics backlog entry)

Model: opus

Three mechanical changes and the prose that rides them:

- `ROLE_BOUNDARY_MAX_AGE_MS` (`plugins/claude-kit/hooks/kit-compact-lib.js:1621`) rises from 30 minutes to 4 hours, spelled as the same `GATE_EPISODE_MAX_IDLE_MS` expression `CONSENT_MAX_AGE_MS` already takes (`:1622`), so the three quantities bounding a seat's quiet gap share one constant and a marker opened at a pass's end is still live when the harness's auto-offer arrives anywhere inside the 4-hour cadence. The longer window is safe for the sessions this marker serves because it is written only at moments a seat's runbook defines as banked, and a seat's stated invariant is that context holds nothing the disk does not, so a compaction anywhere in the window costs a re-read, never state. Fork 1's reserve (the gate reading a seat's own timer as automation) stays unbuilt: it moves a trust boundary the security model prices, and the push model plus this change removes the case that motivated it. The checkpoint CLI's derived reporting (`BOUNDARY_MINUTES`, `kit-compact-checkpoint.js:61`) follows the constant.
- A new Stop hook, `plugins/claude-kit/hooks/seat-stop.js`, wired third in `hooks.json`'s Stop array, reading the same stdin payload shape `kit-goal-stop.js` consumes (`session_id`, `cwd`). It resolves `~/.claude/coordinator/<hostname>/registry/<session-id>.md`; absent, it exits silently, so the whole cost for every unregistered session on the machine is one stat. Present: it stamps `Heartbeat:` (throttled to one write per 10 minutes), and where the file's `Status-updated:` stamp is fresher than 10 minutes, meaning the session pushed status this turn, which is the seat's own banked declaration, and the cwd's tree is clean (`git status --porcelain` empty; a non-git cwd or a failing git reads as clean, fail-open, since the marker's worst case is a compaction at a declared boundary), it writes the role-boundary marker via `writeRoleBoundary` (`kit-compact-lib.js:1771`). The status push is the boundary declaration; the hook is what makes it structural, which is Fork 2's decided shape. The CLI's `boundary` verb survives as the manual path for an unregistered session.
- `kit-compact-checkpoint.js consent` gains `--project <path>` (the backlog fold): the marker resolves against the named directory instead of the cwd, and the command refuses loudly when the named session has no transcript under that project, turning the recorded silent-miss failure into an error; the transcript-path derivation reuses the flattening the kit already applies, and the implementer names the helper in the Chapter.
- Folded 2026-08-28 beside the appended Section 10, this bullet fixing the cause where that section fixes the replication: the `.kit` scratch resolution in `kit-compact-lib.js` gains a store-backed-cwd branch, so a session whose project directory lies inside the memory store (the coordinator seat's normal state once Section 2's board home is adopted) resolves its gate state to an unsynced per-machine location rather than dropping `.kit/` into a replicated tree. One resolver serves every writer and the gate's reader alike, which is what keeps the marker's writer and its reader agreeing on where it lives; red-first against a fixture store cwd, the marker written and the gate reading it from the resolved location, plus a pin that no `.kit` path under a fixture store root is written by any path this section touches.
- The prose that rides: the coordinator skill's pass-end boundary paragraph and peer-sessions' "Each seat banks at its own moments" paragraph rewrite to the new shape (a seat ends its banked moment by pushing status to its registry file; the hook opens the boundary; the CLI command is the fallback), each a one-paragraph edit reviewed whole-file per Amendment 2. The leashed worker's chapter checkpoint is untouched: leashed sessions land compaction through it exactly as today.

Tests, red first, in a new `test/seat-stop.test.js` plus the compact suite files the implementer extends: the hook is silent for an unregistered session; stamps and throttles the heartbeat; opens the marker only on fresh `Status-updated:` plus clean tree (dirty tree: no marker; stale stamp: no marker; non-git cwd: marker); the age-boundary tests pinning 30 minutes go red then green at 4 hours; `consent --project` writes at the target and refuses a session with no transcript there, with a control run proving the happy path; and the role-boundary allow gets its recorded green as a full path, marker written by the hook at a fixture cwd and the gate then journaling an `allow` with reason `role-boundary`, the test Fork 2 called non-negotiable. The two end-to-end operator observations in the backlog stay operator work and ride the close-out list. Amendment 6 applies: this section edits hooks, so the build stamp is rebuilt before the gate.

Files in scope: `plugins/claude-kit/hooks/kit-compact-lib.js`, `plugins/claude-kit/hooks/kit-compact-checkpoint.js`, `plugins/claude-kit/hooks/seat-stop.js` (new), `plugins/claude-kit/hooks/hooks.json`, `plugins/claude-kit/skills/coordinator/SKILL.md`, `plugins/claude-kit/skills/peer-sessions/SKILL.md`, `test/seat-stop.test.js` (new), `test/kit-compact-gate.test.js`, `test/compact-deferral-nudge.test.js`, and any further file a grep for the constant name surfaces (three test files reference it at authoring; the section re-runs the grep).

### 6. The Admin inbox (Fork 5)

Model: sonnet

`admin-requests.md` in the machine's coordinator directory: a dated checklist, one line per request, appended by the coordinator routing an operator ask or by the operator's own session; the Admin seat polls it on its own loop at the cadence its tier row states, acts within its two binding constraints unchanged (every action reported; support, never work product), and flips the handled line with a one-line outcome. The role skill's directory contract gains the file's shape as its owner. The peer-sessions Admin bullet gains the reachability statement as a pointer rather than as a restatement, which is a correction Section 4's execution earned: that section landed the unreachable send in the same file's own messaging-surface contract, as a fourth receiving outcome with the Windows-integrity-level cause marked inferred there, so the one-way property now has a home and a second statement of it in the Admin bullet would put two accounts of one property in one file for a later editor to drift apart, which is the seam Amendment 2 names and this is the section that would open it. The bullet cites that contract line for the property and carries only what is the seat's own: the inbox is how work reaches the seat, the registry heartbeat is how it proves life, and per-command elevation (gsudo or RunAs) stays the named fallback where per-action interactivity matters. The coordinator skill's routing line points at the inbox.

Tests: prose section; pins green; suite delta per Amendment 3.

Files in scope: `plugins/claude-kit/skills/role/SKILL.md`, `plugins/claude-kit/skills/peer-sessions/SKILL.md`, `plugins/claude-kit/skills/coordinator/SKILL.md`.

### 7. Seat tiers and report shape (Fork 4 and element G)

Model: sonnet

The peer-sessions Roles section gains the tier-and-cadence table, one row per starter seat, one owner for every number except the coordinator's cadence, which stays the coordinator skill's own statement per Section 2's pin: Coordinator at Opus, cadence per its own skill, stepping down to Sonnet when a month of review-adjudicated boards shows no judgment miss (an observable gate, not a feel); Expert at the top tier, no loop, waking on demand for authoring and consults; Worker at whatever its plan's section tiers name, per executing-work's routing, no loop of its own; Admin at Sonnet with a 4-hour inbox poll, Haiku named as the step-down once a month of inbox traffic shows the work mechanical. The table closes with its class: a new seat takes the cheapest tier its judgment surface allows and states its own observable step-down gate. Amendment 4 rides this section hardest: tier names only, no capacity or billing figures.

Element G lands in the coordinator skill's Etiquette section: operator reports are deltas against the last board state, capped, never full tables; and every relayed message leads with its audience, because relayed traffic reading as though addressed to the operator was a measured reading friction (Evidence above).

Tests: prose section; the peer-sessions four-heading pin and Section 3's role-skill pin stay green; suite delta per Amendment 3.

Files in scope: `plugins/claude-kit/skills/peer-sessions/SKILL.md`, `plugins/claude-kit/skills/coordinator/SKILL.md`.

### 8. The documented security boundary catches up with the widened allowlist

Model: opus
Locus: inline

Appended during Section 1's execution, and it is approval drift recorded as such: Section 1 widened the store's allowlist, which made a sentence false on four shipped surfaces that no section of this plan had in scope. Both the adversarial and the security reviewer found it independently, and the security reviewer established the part that decides the routing: `docs/security-model.md` appears in no section's files-in-scope across all seven sections, so unrouted the plan ships a security document describing a boundary narrower than the code enforces.

Four surfaces state that the store's `.gitignore` excludes everything and re-includes only the memory tiers, or that the repository there admits only the memory tiers: `docs/security-model.md` (the sentence stating the boundary, the counted claim that three tiers are versioned, and the accepted-risk paragraph whose stated precondition is that a probe proves a path sits inside a memory tier), `docs/architecture.md`, `plugins/claude-kit/skills/kit-doctor/SKILL.md`, and the section comment in `plugins/claude-kit/doctor/doctor.ps1`. Each is restated as memory tiers plus the coordinator directory. The accepted-risk paragraph needs more than a name added: its sole named control is the `memory-system` skill's instruction to the model, which governs the writers of the memory tiers and does not reach the coordinator directory's writers, so the paragraph states what governs coordinator content or states plainly that nothing does.

The last surface is the one that keeps this from recurring. `test/doctrine-parity.test.js` carries no pin over any of these phrases, which is why a widening shipped with the suite green and four documents wrong: this is the kit's own recorded "a count restated on a second surface is an invariant nothing checks" shape, in prose rather than in numbers. A new pin ties the boundary sentence to the tier list `Get-MemorySyncIgnoreText` actually emits, so the next widening reddens the suite instead of quietly falsifying the security model. The pin's far end reads the installer's generated text rather than a hand-copied list, since a pin against a second literal is the same invariant unchecked.

Tests, red first: the new parity pin fails against the current documents, passes once they are corrected; a control confirms it would also fail against a document naming the tiers without the coordinator directory, so its green is not the vacuous kind. Suite delta per Amendment 3.

A fifth surface joined the four during Section 2's execution, found by the main thread's own reading of the installer rather than by a sweep: the sync's commit message is the fixed literal `kit memory sync: allowlist and memory tiers` (`plugins/claude-kit/doctor/install-memory-sync.ps1:761`), which names only the tiers while the commit it labels now also carries the coordinator directory. That is the same misnaming class Section 1 fixed in the `-Fix` consent prompts, one surface further down: a commit message is the record a later reader reconstructs the change from, so a message narrower than its own commit misdescribes what was published. It lands here rather than as a fold in Section 2, whose files are the skill and the docs, and it is a literal a test can pin against the same generated tier list this section's new pin already reads.

Two privileged surfaces this plan creates join the list, routed here at Section 4's fourth review round rather than folded there, because this section already owns the document and exists for exactly this shape, a security document narrower than the payload it describes. The takeover ritual resolves a launch invocation from the operator memory tier and puts it in front of the operator, and that tier is writable by any local session and reachable from every machine the store syncs, so the document states the surface, states that the resolved text is presented as prose for the operator to confirm rather than as a command the kit marks runnable, and states why an allowlist was not the answer: the admitted flag has no literal spelling this repository holds, so a list naming it decides membership on the untrusted record's own say-so. The standing-delegation opt-in is the second: a per-machine record flips a seat's default treatment of peer direction, so the document states the record's ceiling and that its body is read as data rather than as instructions. Neither is covered by the accepted-risk paragraph's already-has-code-execution reasoning, both being reachable from a machine that syncs the store rather than from this one alone, which is the distinction that paragraph already refuses to collapse.

Three more claims in these two documents join the list, routed here at Section 4's sixth review round on the same ground: the section that owns the document is the one that repairs it. Two are counted claims and were already inside this section's routing, and both are falsified by Section 4's payload: `docs/architecture.md` enumerates the kit's durable sources at a count the registry and the claim file have since grown past, and it states a count of the sanctioned uses of the messaging surface that the peer-sessions skill has since exceeded. The third is not counted and so was routed by nothing at all, which is the gap this paragraph closes as much as the claim itself: `docs/security-model.md` states the blocker funnel's path screen in its retired, weaker form, matching a path against a repo the seat already knows, where the shipped screen now requires a repo the operator named or the seat resolved from disk and flatly refuses the roster and the board as placement sources. A qualitative claim falsifies a security document exactly as a counted one does, and an auditor reading the model gets the weaker control either way, so this section's routing is read as covering both from here rather than counted claims alone.

Files in scope: `docs/security-model.md`, `docs/architecture.md`, `plugins/claude-kit/skills/kit-doctor/SKILL.md`, `plugins/claude-kit/doctor/doctor.ps1`, `plugins/claude-kit/doctor/install-memory-sync.ps1`, `test/doctrine-parity.test.js`.

### 9. The public-board cap keeps its force after its reason stops being true

Model: opus

Three sentences outside Section 2's scope justify the cap on a worker's `BLOCKED:` first line by where the board lives: `peer-sessions/SKILL.md` and `executing-work/SKILL.md` (twice) each price the cap as "what the sender would put on a public board", reasoning from "a board a public repository may carry". Section 2 moves the board into the memory store, so that reason is false and a worker following the reasoning rather than the rule concludes the cap has lapsed. Section 2's own review surfaced it; the sentences carry doctrine parity mirrors and need whole-file review, so they are a section rather than a fold.

The cap survives and its force is unchanged; only its ground moves. The new ground is that the store replicates to every machine on the operator's remote, so a board line crosses the account, machine and person boundaries the security model's Principals section records, and a line already replicated cannot be unwritten on the machines that pulled it. State the ground so that it does not rest on the store's remote being private: that premise is a precondition of an installation rather than a property of the kit, and this cap is the last screen standing between a worker's own sentence and that replication, blocker text being the least bounded payload the funnel carries. A later pass "correcting" these sentences to a private-store premise would remove the screen while appearing to update it, which is why the cap is written to be independent of where the board sits rather than re-pegged to its new home.

Tests: a parity pin over each of the three sites asserting the cap and its ground, re-derived red then green; the existing four-heading and bullet-identity pins green untouched. Per Amendment 7 each pin names the axis it refuses and is observed red against the unedited text, an ablation standing in where an earlier assertion aborts the case.

Files in scope: `plugins/claude-kit/skills/peer-sessions/SKILL.md`, `plugins/claude-kit/skills/executing-work/SKILL.md`, their doctrine mirrors, and `test/doctrine-parity.test.js`.

### 10. The store's re-includes match what each tier's contract owns, and a foreign journal stops riding an extension

Model: opus

Appended 2026-08-28 from the coordinator seat's kaizen finding under the operator's standing kaizen grant, verified on this machine's store by the expert seat before appending (`git check-ignore -v` answers `.gitignore:48:/coordinator/**` for `coordinator/<machine>/.kit/compact-gate.json` and `.gitignore:51:!/coordinator/**/*.jsonl` for the journal beside it): the coordinator seat's own mandated last act, the boundary command run from its project directory, writes `.kit/compact-gate.json` and `compact-gate.jsonl` under `coordinator/<machine>/` when that seat's project directory is the store, and the tier's extension-form re-include ships the journal to every machine on the remote. Nothing has shipped: the finding's seat staged only its board and left the directory untracked. The general form is the defect rather than the incident: a re-include written as an extension admits every tool that writes that extension anywhere under the tier, tools with no relationship to the store included, and the next such component leaks with nobody looking. The fix lands in the derivation source and never the store copy, which the doctor re-derives and would revert then flag (`Get-MemorySyncIgnoreText` in `plugins/claude-kit/doctor/install-memory-sync.ps1`; the shared leaf-form list near `:61` returns `*.md`, `*.jsonl`, `decay-stamp` at appending time; re-read per Amendment 1). Section 5's store-backed-cwd resolver bullet removes this incident's cause; this section removes the class.

- The coordinator tier's re-includes narrow to the forms its directory contract defines, which today is `*.md` alone: no file in Section 3's directory contract is a `.jsonl`, so the tier's `.jsonl` re-include goes, and the role skill's admitted-leaves parenthetical follows in the same change (a one-line consequence edit to `plugins/claude-kit/skills/role/SKILL.md`, committed by then with Section 3). A future coordinator `.jsonl` widens the allowlist deliberately, by name, at the moment its contract defines one.
- The memory tiers' `.jsonl` re-includes narrow to the sidecar names the memq contract owns, enumerated from the owning surface (the memq CLI's own file set) rather than from observation of the store; where that enumeration cannot be closed from an owning surface, the extension form stays for that tier and the section records why, per Amendment 7's disposition discipline.
- Tests, red first, extending `test/memory-sync.test.js`: `coordinator/<machine>/.kit/compact-gate.jsonl` is admitted by today's text (red) and refused after (green, the refusing rule named); the board, registry, claims, and admin-requests forms stay admitted (pin); each owned memory-tier sidecar stays admitted (pin, one per name); a foreign `stray.jsonl` under a memory tier is refused where that tier's enumeration closed; the existing exclusion probes stay green untouched. Amendment 7 binds throughout: every refusal names the rule that produces it.
- Section 1's rollout constraint applies unchanged and by reference: the fleet order is plugin update then `doctor -Fix` per machine before the narrowed text is live anywhere, and the close-out's operator list gains one line, removing the untracked `.kit/` residue from the live store's coordinator directory (the operator's act per Amendment 5, never a section's).

Files in scope: `plugins/claude-kit/doctor/install-memory-sync.ps1`, `test/memory-sync.test.js`, `plugins/claude-kit/skills/role/SKILL.md` (the parenthetical consequence).

## Out of Scope

- The operator's capacity and billing specifics. They shaped the priority and stay in the message layer; this repository is public and carries none of them.
- Real-time cross-machine coordination. The per-machine directory reaches every box through the store's own sync at sync cadence, and that is the designed scope.
- Verifying the cache TTL fleet-wide inside this plan. It is a named input above, taken per machine by whoever tunes that machine's cadence.
- The memq-hardening backlog items: parked by default 2026-08-27, no countermand; revisit at slate close.
- The adoption itself: the fleet rollout (per-machine `claude plugin update` plus `doctor -Fix`), the live board's migration off any existing home repo, and the first `/role` takeovers are the operator's steps, listed at the close-out, never sections here (Amendment 5).

## Related

- `docs/archive/claude-kit_testing-discipline_spec_v1.md` (complete and archived; it ran as `docs/plans/claude-kit_testing-discipline_spec_v1.md`): run and completed ahead of this queue; its box check composes with element E's claim file. The two plans share exactly one file, `test/doctrine-parity.test.js`, which is why the start condition above sequences this plan behind it.
- `docs/archive/claude-kit_compact-boundaries_spec_v1.md`: created the two release markers Forks 1-2 amend.
- `docs/archive/claude-kit_coordinator-and-roles_spec_v1.md`: created the seat vocabulary and the board this plan re-homes.
- `docs/plans/claude-kit_session-roles_notes_v1.md`: the design dialogue's fact base behind the seat vocabulary.
- `kaizen/notes-SCOTT-CLAUDE.md`, the seven 2026-08-26 seat-cluster notes: the origin, cleared into this draft at authoring.
- `docs/backlog.md`: the two folded entries (the `consent --project` flag, 2026-08-26; the coordinator cold-start restructure, 2026-08-26).

## Chapters

### Interim board 1 - 2026-08-27

Run opened; no section has made a tree edit yet. Recorded here because the
compaction gate was holding offers at a point where nothing is half-finished.

**Section stages.** Section 1 (allowlist admits `coordinator/`): briefed and
held, not started. Sections 2 through 7: not started. The plan's `Status:`
header was normalized `Draft` to `In Progress` at run start per executing-work,
which is the run's first approval-scoped edit and is recorded as deliberate
rather than drift.

**Live dispatches.** None. One backgrounded wait is running on a box-clear
marker; it is not a dispatch and holds no files.

**Gate baseline.** Not captured, and this is what the run waits on. Amendment 3
gates each section's first edit on a full-suite baseline, so Section 1 opens
with a suite run rather than closing with one. The machine's one-heavy-process
slot is held by a sibling repository's measurement run, granted to this plan as
a standing block for its duration once that lands. Every wall clock recorded on
this box before the 2026-08-27 20:17 local reboot is a different machine's
number (4 logical processors where there were 6, 20 GB where there were 16,
Defender exclusions added), so the baseline is taken fresh and no pre-reboot
figure is comparable to it. The tree's own enumerated test count is unsettled:
two figures are in circulation, 1,870 and 1,850, neither traceable to a run
anyone here read, and the first clean post-reboot run settles it.

**Rulings adopted since the last boundary.**

1. *Execution stays on `main` in the shared checkout rather than a worktree.*
   Commit-and-Push against a worktree run routes onto Branch-and-PR with an
   integration merge, and Section 5 edits `plugins/claude-kit/hooks/`, where a
   merge re-stales the build stamp with no conflict (project memory
   `merging-hook-edits-staleness-the-build-stamp`) - the exact artifact
   Amendment 6 exists to keep fresh. The expert seat sharing this checkout holds
   a commit freeze and moves to a worktree itself if its authoring collides.
2. *Section 1 gains a security review the spec does not call for.* Its file is
   the allowlist deciding what leaves a store holding `.credentials.json`,
   `settings.json`, and full session transcripts, and the section widens that
   allowlist, which is executing-work's secrets-and-configuration trigger. A
   widening defect there leaks the store rather than reddening a test.
3. *`Get-MemorySyncProbePaths` is assumed to need no change* (route (b),
   declared). The spec directs extending "any probe enumeration" so every reader
   answers identically for coordinator paths; that function enumerates paths
   proven **ignored** and there is no positive-probe enumeration in the file, so
   the two readers that must agree are the ignore text and
   `Test-MemorySyncPathAllowed`. The implementer is briefed to contradict this
   if it finds a positive enumeration.

**Next action per section.** Section 1: capture the suite baseline the moment
the box clears, then dispatch `implementer-opus` from the held brief. Sections 2
through 7: unchanged, in order, each gated on its own baseline.

### Chapter 1 - 2026-08-27

Completed: 1. The allowlist and drift reporting admit `coordinator/` (element A)
Implemented By: implementer-opus (build), implementer-opus (review-fix round). No escalations.
Metrics: review rounds 1 (adversarial, blind and security, all opus at `max` effort through Workflow, the Agent tool having no effort parameter); NEEDS_CONTEXT 0; escalations 0; consults 0.

Decisions / Surprises:

- The baseline settled a figure two sessions were carrying wrongly. The tree enumerates **1,875 tests over 34 test files**, measured with `node --test "test/*.test.js"` at `939c75d`. Two other figures were in circulation: 1,870, a real but superseded pre-reboot run, and 1,850, which traced to no run at all. The unusable-run check reads its threshold against this number, so armed at 1,850 it would have waved through a run that had lost 25 tests, which is the contaminated-denominator failure that check exists to catch.
- The baseline carries one failure that is not a regression and never was. `test/memory-session.test.js` > `a pinned directory too long to name faithfully stands the session down` pads a fixture path with 200 characters and depends on the host's temp prefix to carry the total past the `PATH_EMIT_CAP = 260` guard in `plugins/claude-kit/hooks/memory-session.js`. Both lengths were computed rather than inferred: this machine's `TEMP` is seven characters, landing the fixture at 254 so the guard is never reached, where a default Windows prefix lands it at 280 and it fires. The test asserts a property of the host rather than of the code. Routed to `docs/backlog.md` rather than fixed here, since it serves test soundness rather than this plan's goal.
- **A security finding rated Critical was downgraded to Major, and the argument that carries the downgrade is not the one it was first made on.** The finding is real and was verified independently rather than accepted: `~/.claude/coordinator/SCOTT-CLAUDE/board.md` already exists at 65,502 bytes, is ignored today by the live store's `.gitignore:9:/*`, and becomes committable and pushable once this section is installed. The first argument for downgrading was that the plan sequences the fleet rollout after every section, so Section 2's clearance model would land first. That argument is wrong: the operator runs the doctor whenever something is broken, for reasons unrelated to this plan, and neither this run nor the coordinator controls when. The machine coordinator supplied the refutation. What carries the downgrade instead is that the store's remote is private (verified with `gh repo view`, which answers `"visibility":"PRIVATE"`), so the exposure is replication across the operator's own machines rather than publication, and the coordinator has since audited and pruned the live board. The corrected rationale is recorded here rather than the original, because a session inheriting the sequencing argument would inherit a wrong one.
- What did not survive the downgrade is recorded as a fix rather than a concession. The `-Fix` consent prompts named "the memory tiers" while the commit they authorize now also carries the coordinator directory. A consent question that misnames what it commits is a defect at any severity and at any ordering, so it was fixed in this section rather than deferred, which widened this section's files in scope to include `plugins/claude-kit/doctor/doctor.ps1`.
- **A fixture invented a file the contract does not define, and it manufactured agreement between two independent reviewers.** The first implementer planted `coordinator/<machine>/registry/heartbeats.jsonl`, a name that reads as a multi-writer append journal. The Section 3 directory contract defines no such file. The blind and the adversarial reviewer independently concluded from it that the tier needs a `merge=union` attribute, one of them rating it Major. The evidence they agreed on was an artifact this run had authored. The fixture is now contract-shaped, and the episode is the circular-corroboration trap in artifact form rather than in messages.
- **A pin can be green because it never reaches the code it is named for.** Every transient-shaped name previously tested under this tier (`board.lock`, `board.md.bak`, `board.md.tmp.77`) is refused by the allowed-leaf-form check before the per-segment transient loop is ever evaluated, so the transient axis was untested under `coordinator/` while reading as covered. There was no wrong answer to notice: the tests passed and were about the right subject. `board.tmp.md` and `registry/session-a.tmp.jsonl`, an allowed extension carrying a transient shape, now exercise it. The counter-practice adopted here and worth reusing: require the implementer to state in words which check refuses each case rather than to report a green. A green says the assertion held; naming the mechanism says the assertion was about the thing you meant.
- Duration on this box is not usable as evidence tonight, so this Chapter does not diff it. A sibling repository ran one tree at one commit three times, and its slowest run was the one on a hard-serialised box with zero competing processes and zero read-only agents, 18 percent slower than a run that had been discarded for contamination, with per-class factors scattering from 0.513x to 2.270x (reported by the machine coordinator from that repository's measurements; not reproduced here). The wall clocks are therefore recorded as data with their contention rows and never as a trend: baseline 238.5 s (0 dotnet, 0 testhost, 0 msbuild, 8 claude, 27 node, 15,320 MB commit free), close gate 279.3 s (0 dotnet, 0 testhost, 0 msbuild, 8 claude, 25 node, 14,349 MB commit free). The baseline's box no longer exists in the sense that matters: resident agent sessions hold memory while idle rather than draining, and the machine's fleet grew across the evening.
- The blind reviewer's strongest finding, that widening the predicate also widens the inbound screen and so wedges any fleet machine still on the old payload, is correct in mechanism and is not a defect: this section's own text states that rollout constraint and its deployment order. The blind lens could not see the spec, which is the lens working rather than failing.

Assumptions: `Get-MemorySyncProbePaths` needs no change (route (b), declared 2026-08-27, section 1). It enumerates paths proven *ignored*, and there is no positive-probe enumeration in the file, so the two readers that must agree are the ignore text and `Test-MemorySyncPathAllowed`. The implementer was briefed to contradict this if it found a positive enumeration, and confirmed the reading against the whole file instead.

Review Findings:

- Critical 1, downgraded to Major and named as downgraded above; its non-deferrable part, the consent prompts, fixed in this section.
- Majors addressed: the consent prompts, and the invented fixture.
- Majors adjudicated as not defects, with the reason recorded: the inbound-screen backward compatibility, covered by this section's stated rollout order; and the absent `merge=union` rule, since per-machine directories are single-writer and the fixture that suggested otherwise is gone.
- Major routed out of this section: four shipped surfaces, `docs/security-model.md` among them, state a security boundary this change makes false, and no section of this plan had them in scope. Appended as Section 8 rather than parked, because a false security claim is load-bearing for a reader deciding what to put in a store. Named to the operator on the relay thread at the moment of the append, per the commit model.
- Major routed to the expert seat: `coordinator/` sits outside `memory-frontmatter-guard`'s tier set, so it would be the only synced-and-shared directory in the store with no write guard. That is the Section 3 directory contract's question rather than the allowlist's. The expert ruled for a stated exemption and landed it in `3b22169`.
- Minors addressed: two stale contract comments in the changed file, and three coverage holes (the transient axis, the status reader over coordinator paths, an inbound symlink at a coordinator path).
- Minors routed to `docs/backlog.md`: the traversal guard being private to one caller, `-match` case-insensitivity, and the unconstrained machine-name segment. All three predate this section across all four tier prefixes; the first acquires a second producer when Section 5 lands its hook, which is the recorded signal.

Stamps: adjudicated 1, stamped 1. `suite-baseline-is-not-zero-fail` steered the decision not to read the baseline's red as a regression and supplied the denominator discipline that settled 1,875. The window is this section's own span and its account comes out, so no hand walk was owed. That record was also corrected in the same session on three counts this run contradicted, with its `MEMORY.md` index line updated alongside it.

Gate: baseline 1,875 tests / 1,872 pass / 1 fail / 2 skipped at `939c75d`; close 1,878 / 1,875 / 1 fail / 2 skipped, exit 1. Delta +3 tests, +3 passes, no regressions, and the one failure is the same case by name in both runs.

Next: 2. The board moves home, and the cold start becomes a tick order (element B)
Commit Model: Commit-and-Push

### Interim board 2 - 2026-08-28

Section 2 is mid-fix-round; this entry exists because the compaction gate reached 16 held offers over 30 minutes with no section closing, and the run's state lives only in context until it is written here.

In-flight sections: Section 2 only. Sections 1 closed at `77462a5`; 3 through 9 not started.

Live dispatches: one, `implementer-opus` on Section 2's fix round, resumed rather than re-dispatched, holding `plugins/claude-kit/skills/coordinator/SKILL.md`, `test/doctrine-parity.test.js`, `plugins/claude-kit/agents/docs-curator.md` and `plugins/claude-kit/skills/curating-docs/SKILL.md`. It was asked for eight fixes plus two minors, enumerated in the resume message: the private-remote premise restated as a precondition rather than a fact; the sensitivity screen restored at the what-rides paragraph; the durability claim qualified to the platform where the committer actually runs; the chassis seam where the unchanged paragraph still claims pacing and tick order ride unchanged; the heartbeat's unobservable attendance predicate; the predecessor guard the no-board-yet collapse dropped; the local leg missing from the sync-lag statement; and the contested-seat freeze's lost citable anchor.

Gate baseline: 1,878 tests, 1,875 pass, 1 fail, 2 skipped, 315.8 s, exit 1 read from the run's own marker, captured at `75d208b` on a box carrying 0 dotnet, 0 testhost, 19 node, 8 claude and 14,884 MB free commit. The one failure is the known short-`TEMP` path-length case at `test/memory-session.test.js:865`, identical by name and line to both Section 1 readings. The close gate has not run: it is deliberately held until the fix round returns, because reviewer briefs carrying no no-build constraint plus a live suite is the contention that forges a result rather than merely slowing one.

The wall clock is recorded as data rather than diffed, and it is the first comparable pair this effort has had: Section 1's close gate ran 279.3 s at node 25 / claude 8 / 14,349 MB free, and this baseline ran 315.8 s at node 19 / claude 8 / 14,884 MB free. Fewer runners and more free memory, and 13 percent slower. That is not a controlled comparison and node count at launch is not node count during the run, but it does establish that the naive runner-count story fails its first honest test.

Rulings adopted since the last boundary:

- The review round returned three verdicts, adversarial CHANGES_REQUIRED, security BLOCK, blind CHANGES_REQUIRED, all at opus with effort max through the Workflow route. The tree-state bracket was clean at both ends, so no finding is an artifact of a reviewer writing to the tree.
- Two Criticals were adjudicated as real and non-deferrable, and both trace to this orchestrator rather than to the implementer. The referrer sweep did not close on `docs/security-model.md`, whose `## The coordinator board` section documented the retired clearance apparatus as current and named as a live control the `docs-curator` bullet this changeset deletes; the section is rewritten on the store premise, and it shrank, because most of what it documented no longer exists. And `docs/architecture.md` carried four falsified current-state claims, three of which the mandated `coordinator-board` grep cannot surface at all because they describe the board without naming its path. Both files were routed to the main thread at dispatch, correctly, because the docs-write-guard denies a non-curator subagent any write under `docs/`; the defect is that the routing was recorded and then not executed before review.
- The mandated sweep pattern is under-inclusive for this change and Section 2's text now says so, with the additional patterns named. This is the sweep-dispositions half of Amendment 7 applied to the amendment's own author: the brief's referrer table was short by three, the implementer reported it short rather than treating the table as the boundary, and the reviewers then found three more the grep could not reach.
- Section 9 is appended, which is approval drift recorded as such: three sentences in `peer-sessions` and `executing-work` justify the worker's public-board cap by where the board lives, and Section 2 falsifies that ground. The cap keeps its force and only its ground moves. It is a section rather than a fold because the sentences carry doctrine parity mirrors and need whole-file review, and because the security lens' warning is load-bearing: that cap is now the last screen between a worker's own sentence and replication to every machine on the store's remote, so a later pass re-pegging it to a private-store premise would remove the screen while appearing to update it.
- Deferred with reasons rather than silently: the boundary marker's 30-minute ageing against a 4-hour pass, which Section 5 owns and which this section makes worse in the interval, so Section 5 stays tightly sequenced; and pins over the four surviving board bars, which no test covers today and which Section 8 is the natural home for, since it already plans a pin whose far end reads generated text.

Next action per section: Section 2 awaits the fix round, then a re-review of the changed surfaces, then the close gate alone on a quiet box, then the Chapter. Section 3 is next in the running order.

### Chapter 2 - 2026-08-28

Completed: 2. The board moves home, and the cold start becomes a tick order (element B, folding the cold-start backlog entry)
Implemented By: implementer-opus (build), implementer-opus (three review-fix rounds, each dispatched fresh). The `docs/` and spec writes ran inline in the main thread throughout, per the routing override this section's files-in-scope line records: the docs-write-guard denies a non-curator subagent any write under `docs/`.
Metrics: review rounds 4 (rounds 1-3 the full three lenses, round 4 a single adversarial convergence check, all opus at `max` effort through the Workflow route since the Agent tool has no effort parameter); NEEDS_CONTEXT 0; escalations 0; consults 0.

Decisions / Surprises:

- **Four review rounds, and the same defect class produced a Critical in three of them, always on the same side of the section.** Rounds 1, 2 and 4 each surfaced a Critical in curated prose the main thread had written and no lens had yet read; the implementer produced zero Criticals across all four. The class was one shape every time: an edit corrected a claim while a neighbouring clause in the same paragraph, or the same claim on a sibling document, went on saying the old thing. Round 2 found `docs/architecture.md` still licensing publication by an operator clearance in the very paragraph whose first half had been rewritten to the store premise. Round 4 found the rewrite of `docs/security-model.md` had dropped the machine-identity disclosure entirely, `hostname` falling from one occurrence to zero, at the same time the skill began naming it as the one disclosure no line-level bar reaches. The move to a per-machine directory is what makes that disclosure stronger rather than weaker, since the hostname becomes the directory's own name on every machine that pulls the store.
- **The generator was named and fixed rather than the outputs.** Standing Brief Amendment 8 was added mid-section: a paragraph is the edit unit for a curated document, never the sentence. Amendment 2 already carried this defect mode but bound only skill prose and only what a reviewer is briefed to read; 8 binds the writer and reaches every curated surface. The amendment then convicted its own author twice, which is the useful part: round 4 caught a sentence-level edit to `docs/README.md` that left two neighbouring clauses in the same paragraph stale, and a self-read caught a dangling antecedent an insertion had created in `docs/security-model.md`.
- **No tier escalation, and the comparison the rule requires is what settles it.** Two failed rounds with Criticals normally bumps the tier. The two rounds' surviving Criticals do repeat as a class, but every instance sits in main-thread writing rather than in the implementer's, so a stronger implementer could not have fixed one of them and the bump was not spent.
- **Three deviations from the spec are recorded in the section text, not only here.** First, the board-absent branch: an absent directory does not mean no board yet, because the sync's state file records a run's outcome and never what it exchanged, a store whose branch tracks nothing and a store with no remote both reach the same recorded success, and freshness cannot be compared against a predecessor's write without running git, which this design forbids the seat. Absence is therefore never the seat's to conclude; a cold start finding no board reports and holds. Second, the private-store premise ships as a named precondition of one installation rather than as a design fact, which is the opposite of what the section's second bullet originally said. Third, the operator-stated practice of the loop being off while they are at the keyboard did not ship: no predicate available to the seat reads attendance, and the chassis's mechanic defers a timer only for the length of a turn, so the heartbeat fires in both states and the skill says so rather than claiming a suppression nothing delivers.
- **A carried reading was corrected by the machine coordinator, and it ran in the direction that cost this session something.** Chapter 1's security downgrade is recorded as resting on `gh repo view` answering PRIVATE. That query answers who can find a repository, not who can read it; the collaborator list is the query that answers readership, and it returns two principals. The rating does not move and the recorded reason for it does, because a session inheriting "PRIVATE, therefore fine" inherits the same wrong query. The distinction now sits in `docs/security-model.md` at the point where a reader is most likely to reach for the flag and stop, and in the runbook at the point where the seat establishes its own premise. Whether the second principal is the operator's own machine identity is an inference from a name and an email and is with the operator.
- **The same generator-versus-generated distinction failed in both directions inside one night.** This session ruled against two Section 1 reviewers who read "installer changed, derived file unchanged" as a gap, correctly, on the ground that it is the designed end state. Hours later it reasoned from the installer's new state straight to the derived file's behaviour and told the coordinator the live board could push at the next session start. `git check-ignore -v` returns `.gitignore:9:/*` for that file: only a `doctor -Fix` re-derives it. Holding a distinction in the direction that costs something is not the same as knowing it.
- **The live board was pruned by its owner during this section, and the standing property is what carries forward rather than the prune.** The board had grown from 65,502 bytes at Chapter 1's downgrade to 169,543, re-crossing the path bar by ordinary writing. It re-crosses that way rather than by anyone deciding to stop maintaining it, which is why the close-out carries the property and not a one-time task.
- Wall clock recorded as data with its contention row, never diffed as a trend: close gate 282.1 s at 0 dotnet, 0 testhost, 19 node, 11 claude, 10,719 MB available. This section's baseline ran 315.8 s at 19 node, 8 claude, 14,884 MB free. Resident session count is not the story either, since claude rose from 8 to 11 while the run got faster.

Assumptions: none beyond the three deviations recorded above, each written into the section text rather than left standing as an assumption.

Review Findings:

- Round 1 (adversarial CHANGES_REQUIRED, security BLOCK, blind CHANGES_REQUIRED): two Criticals, both main-thread. `docs/security-model.md` documented the retired clearance apparatus as current and named as a live control a `docs-curator` bullet this changeset deletes; `docs/architecture.md` carried four falsified current-state claims, three of which the mandated `coordinator-board` grep cannot reach because they describe the board without naming its path. Eight implementer fixes plus two minors closed alongside.
- Round 2 (all three CHANGES_REQUIRED): one Critical, the surviving clearance clause in `docs/architecture.md`, found independently by two lenses. Six Majors on the documented-versus-enforced boundary: the justification for an unguarded directory deferred to a `/role` skill that does not exist yet; the store's history over-claimed as attributing every change, when it commits under one fixed message and one identity and so attributes a machine and a sync window; writership framed as machine-local when the allowlist predicate is `^coordinator/.+` with no machine scoping and the inbound screen runs that same predicate; a counted claim of three bars enumerating two; and both documents claiming the board's procedures were never performed while a live board exists.
- Round 3 (all three CHANGES_REQUIRED): two Criticals. `docs/architecture.md` asserted the boundary marker's ageing as already aligned to the 4-hour cadence when `ROLE_BOUNDARY_MAX_AGE_MS` is still 30 minutes and Section 5 owns that alignment; and the skill reversed the operator-stated attendance practice with no recorded deviation. Majors: the durability-gap predicate fired on a healthy fresh Windows box, since the doctor's fix path commits the store and writes no state file; and deleting the curator's `docs/coordinator-board.md` exclusion left a live redirect stub in the predecessor board repo belonging to no zone. Two lenses disagreed on that last one and the adversarial reading was adopted, because it found the actual file on disk while the security lens' counter-argument addressed a different guard than the deleted charter bullet.
- Round 4, a single adversarial convergence check: one Critical, the dropped machine-identity disclosure above. Three Majors: the two curated plan indexes left contradicting each other on slate position and go state; Section 2's second bullet still stating the retired private-store premise as design fact, which is precisely the move Section 9 exists to stop a later pass making; and the attendance claim asserting a suppression its named mechanism does not deliver. All fixed.
- Routed rather than fixed here, with the rule that settles each: the public-board cap's stated ground on three surfaces is Section 9's, appended for it during this section. `docs/security-model.md:68` and `docs/architecture.md:194` still read "re-includes only the memory tiers", which is Section 8's, and this section deliberately leaves them, because Section 8's pin is red-first against exactly those sentences and correcting them here would spend the evidence proving that pin is not vacuous. The cost is named rather than absorbed: until Section 8 lands, `docs/security-model.md` ships carrying a claim its own new text contradicts. That claim was already false at HEAD; this section makes the falseness visible from inside the file rather than creating it.
- Round 4's own fixes are unreviewed, stated here rather than left to be discovered. The ladder stopped at four because each round's cost had moved from defect class to prose refinement, and finishing-work's whole-changeset pass, with a fable-tier security lens, is the designed backstop this section will meet.
- Folded into scope during execution, each with its reason: `docs/README.md`, whose `architecture.md` and `security-model.md` entries described the retired clearance model as current and sit under Documents about the solution rather than in an archive index, so this section's stated exemption does not reach them; and `docs/plans/README.md`, which round 4 found contradicting its sibling on slate position, go state, and section count. A fifth surface went to Section 8 rather than folding here: the sync's commit message is the fixed literal naming only the tiers, while the commit it labels now carries the coordinator directory, which is Section 1's consent-prompt misnaming class one surface further down.
- Sweep dispositions (Amendment 7). `coordinator-board`, `hourly`, `clearance`, `home repo` and `committed board|ledger|state` return nothing in tracked live payload or curated docs. What refuses each surviving hit: `docs/README.md:41` and `docs/plans/README.md:24` are archive-index entries whose own preambles state their entries record what a plan delivered when it shipped, exempt under the append-only-history rule; the referrers under `docs/archive/` are exempt on that same rule; the spec's own hits are its instructions to this section. A positive control ran before that clean was trusted: the identical pattern against `docs/archive/` returns hits across five files, so the empty live result is the pattern working rather than a pattern aimed wrong.

Stamps: adjudicated 5, stamped 5, over a 2-hour window covering this section's span since Chapter 1 closed at 23:06 and deliberately not widened past it. `suite-baseline-is-not-zero-fail` steered reading the one red as the host-dependent case rather than a regression; `two-sessions-one-checkout-commit-freeze` steered the bilateral staging window held with the expert seat; `resident-fleet-not-runner-count-drives-suite-duration` steered recording both wall clocks as data with contention rows rather than diffing them; `only-two-machines-sync-the-kit-memory-store` steered the fleet reasoning in the coordinator exchange; `utf16-logs-make-grep-report-a-false-clean` is the marginal one, stamped on the generous bar for the control-cutting habit it feeds rather than for a decision it visibly changed. The window's account comes out, so no hand walk was owed.

Gate: baseline 1,878 tests / 1,875 pass / 1 fail / 2 skipped at `75d208b`, exit 1 read from the run's own marker; close 1,878 / 1,875 / 1 fail / 2 skipped, exit 1, 282.1 s. Delta zero, and the one failure is the same case by name in both runs, `a pinned directory too long to name faithfully stands the session down` in `test/memory-session.test.js`, the host-dependent short-`TEMP` red routed to `docs/backlog.md` in Section 1. `node --test test/doctrine-parity.test.js` was re-run by the orchestrator after every implementer round rather than taken from the report: 21 tests / 21 pass / 0 fail, exit 0 read from the run itself, at each of four checkpoints.

Next: 3. The registry, the claim file, and the `/role` skill (elements C, E, F)
Commit Model: Commit-and-Push

### Interim board 3 - 2026-08-28

Section 3 is complete in the tree and waiting on one thing: a re-run of the whole
gate. The compaction gate had held 29 offers over 30 minutes and two review
adjudications had closed with no section closing, so this entry banks the run's
state rather than leaving it in context.

**Why the gate is being re-run rather than reported.** The close gate ran clean
(1,882 tests / 1,879 pass / 1 fail / 2 skipped, exit 1 from the run's own marker,
241.2 s). A convergence check dispatched afterwards returned CHANGES_REQUIRED with
two Criticals, and fixing them changed eight files. The gate in hand therefore
describes a tree that is no longer the one being shipped, and a number measured on
different bytes is not this section's number. The machine's heavy slot is held by
another repository's suite (9 engine-class processes including `testhost`, read
directly rather than taken on report), so the re-run waits on that slot.

**In-flight sections.** Section 3 only. Sections 1 and 2 closed at `77462a5` and
`ebf5ee0`; 4 through 9 not started. Base commit moved under this session from
`5edb448` to `8118e4f` when the coordinator seat committed its own kaizen file,
which is the shared-checkout behaviour project memory
`two-sessions-one-checkout-commit-freeze` records; nothing was lost because this
section's work was unstaged throughout.

**Live dispatches.** None. Four have returned: an adversarial and a blind reviewer
at fable and a security reviewer at opus/max through the Workflow route (round 1),
one `implementer-fable` on a 21-fix round, one `implementer-fable` on the kaizen
fold, and one `implementer-fable` adversarial convergence check.

**Gate baseline.** 1,879 tests / 1,876 pass / 1 fail / 2 skipped, 286.3 s, exit 1
read from the run's own marker, captured at `5edb448` with the dead predecessor's
Section 3 work already in the tree. That last clause is the reading that matters:
the true pre-section baseline is Chapter 2's close of 1,878/1,875/1/2, and the
+1 between them is the predecessor's own parity pin, which is why this section's
whole-gate delta of +3 reconciles against a parity file that grew by +4 from the
base commit. No test left the suite. The one red is the standing host-dependent
short-`TEMP` case, matched between runs by name, enclosing line, assertion and
mechanism rather than by count.

**Rulings adopted since the last boundary.**

1. *The inherited work was treated as a hypothesis, not as progress.* A dead
   predecessor left Section 3 complete-looking and uncommitted. It had passed no
   review and no gate, and its new parity pin was green with no record that it had
   ever been observed red. Two ablations supplied that evidence: removing the skill
   file is refused by the `fs.existsSync` assertion, and deleting the `Remaining:`
   line is refused by the ordered field loop. The first ablation also showed the
   existence check firing before any content assertion, so a single ablation would
   have proven only the axis it happened to reach, which is Amendment 7's own trap.
2. *The security lens' Critical on the delegation model did not become a BLOCKED.*
   Its headline finding, that a delegated seat acts on an unauthenticated peer
   message, restates a ceiling the spec already accepts in writing (provenance
   rather than credential). What was a genuine defect independent of that design
   call is that five unchanged peer-sessions paragraphs still said an inbound
   message authorizes nothing, and those were fixed. Two further findings were
   straight defects rather than design questions and were fixed as such: the grant
   claimed to be machine-scoped while the operator tier replicates fleet-wide with
   no hostname check, and the takeover ritual read the board before arming the
   wake, inverting a safety order Section 2 shipped with recorded rationale.
   Weighing all three, the model ships OFF: no opt-in record exists in the operator
   tier, verified by `memq`, so no install is delegated until an operator writes one.
3. *The kaizen amendment was folded rather than made a section, and its provenance
   is named rather than assumed.* All three surfaces it touches were already inside
   this section's file scope and seat duties are the section's own subject. It
   reached this session as a relayed operator instruction through two peer seats,
   which is a peer's claim rather than the operator speaking; what makes it
   actionable is a standing grant the operator gave this session directly at the
   keyboard. Without that grant it would have routed to the operator instead.
4. *A positive control proves a pattern speaks, not that it is aimed right.* The
   three-to-four sweep was reported clean on a control that passed, and the
   convergence check then found `docs/README.md` saying "three closed functions",
   a spelling the pattern family could not see. The sweep now runs a wider family
   with its own control on the variant. The general lesson is the one worth
   carrying past this section: a control establishes that the check can speak, and
   leaves entirely open whether it was pointed at the right words.

**Next action.** Take the heavy slot when the coordinator releases it, re-run the
whole gate, read failures by name rather than by count, then Chapter 3 and one
commit carrying the section, the spec reconciliation and the Chapter together.

### Interim board 4 - 2026-08-28

Section 3 is fix-round complete and waits on one thing: the close gate, which
waits on the machine's heavy-process slot. A review round and a fix round have
both adjudicated since Interim board 3 with no section closing, and the
compaction gate is holding offers, so this entry banks the state rather than
leaving it in context.

**In-flight sections.** Section 3 only. Sections 1 and 2 closed at `77462a5` and
`ebf5ee0`; 4 through 10 not started. Base is `c9d0709`, in sync with origin.

**Live dispatches.** None. Four have returned this round: an adversarial and a
blind reviewer at fable, a security reviewer at opus/max through the Workflow
route, and one `implementer-fable` on a fifteen-item fix round. First-turn
readings were taken on all four as per-line assistant-model tallies, every turn
resolving at the requested alias with zero substitution.

**Gate baseline.** 1,879 / 1,876 pass / 1 fail / 2 skipped at `5edb448`. Two
whole gates have run since: 1,882 / 1,879 / 1 / 2 at 216.8 s with no agents on
the box, and the same counts at 304.3 s with three concurrent in-process
reviewers. Both exits read 1 from the run's own marker while the harness
notification reported the wrapper's exit as 0, twice out of two. Neither gate is
this section's close, because the fix round changed five files after the second.

**Rulings adopted since the last boundary.**

1. *The process list retires as the claim protocol's verdict, and the reason
   ships with the rule.* A sampling instrument cannot see work whose lifetime is
   shorter than its interval, so no cadence repairs it; absence hides in-process
   agent fan-out; presence is routinely an idle build server. Measured on this
   box: three resident `dotnet` processes accumulated 0.00 CPU-seconds across 45
   seconds while five others and a `testhost` started and exited inside the same
   minute. The line between waiting and starting is drawn on cost rather than on
   evidence: presence licenses waiting at bounded cost, absence never licenses
   starting or releasing at unbounded cost.
2. *A guard's reach is read from the guard, never from the sentence citing it.*
   The dispatch-brief clause claimed the readonly-agent-guard made the claim
   writes impossible for a read-only agent. The guard denies a write into the
   tree under review, keyed on the repo root, and a destination outside the git
   root is an explicit positive allow; the claim file sits outside every repo.
   The split now rests on accountability, the dispatching session owning the id
   and being the party still alive to delete it, rather than on a mechanism that
   does not exist.
3. *A control proves a check fires; it does not prove its pattern list is
   complete.* The Amendment 4 close was first run as a sweep for identifier
   strings already known, which cannot surface a name its author never listed.
   It was re-run as a class sweep over absolute-path, hostname, email and UUID
   shapes, whose control finds an out-of-scope instance by shape rather than by
   literal. This is the deepening of Interim board 3's ruling 4, and the general
   form is that a coverage control and a firing control are different
   instruments.
4. *An unverified premise in a brief is the briefer's defect.* The brief
   asserted that memq lowercases operator-record names at write, taken from a
   reviewer's citation without opening the code. The implementer could not
   confirm it, declined to write the mechanism into a shipped skill, and
   grounded the fix on what it did verify. A dispatched agent refusing its
   brief's premise is the marking rule producing the behaviour it exists for.
5. *A shared plan doc is staged bilaterally or not at all.* The doc carries this
   session's reconciliation and Chapter alongside five regions authored by the
   expert seat, and git cannot split a file. The expert confirmed its regions
   complete and consented to them riding in this section's commit with
   attribution, under a freeze bounded by a stated expiry rather than held
   open-ended.

**Next action.** Take the heavy slot when the coordinator releases it, run the
close gate, then Chapter 3 and one commit carrying the section, the spec
reconciliation, the expert's five regions and the Chapter together.

### Chapter 3 - 2026-08-28

Completed: 3. The registry, the claim file, and the `/role` skill (elements C, E, F)
Implemented By: implementer-fable (build, by a predecessor session that died before review or gate), implementer-fable (21-fix round), implementer-fable (kaizen fold), implementer-fable (convergence check), implementer-fable (15-item review-fix round). The `docs/` and spec writes ran inline in the main thread throughout, per the routing override this section's files-in-scope line records. No escalations.
Metrics: review rounds 3 (round 1 adversarial and blind at fable with security at opus/max through the Workflow route; round 2 a single adversarial convergence check; round 3 the full three lenses again over both scope amendments as one delta); NEEDS_CONTEXT 0; escalations 0; consults 0.

Decisions / Surprises:

- **The section was inherited complete-looking from a dead session and was treated as a hypothesis rather than as progress.** It had passed no review and no gate, and its new parity pin was green with no record of ever having been observed red. Two ablations supplied that evidence, and the first of them showed the existence check firing before any content assertion, so a single ablation would have proven only the axis it happened to reach.
- **A control proves a check fires; it does not prove its pattern list is complete, and those are different instruments.** Interim board 3 recorded the first half of this after a sweep reported clean on a control that passed while `docs/README.md` said "three closed functions", a spelling the pattern family could not see. The Amendment 4 close then repeated the shape one level up: it swept for identifier strings already known, which cannot surface a name its author never listed, and the machine coordinator found the same blind spot in its own fleet sweep independently. The close was re-run as a class sweep over absolute-path, hostname, email and UUID shapes, whose control tests coverage rather than firing: the same shape-based pattern finds a hostname in an out-of-scope file having never been given the string. Zero across all seven in-scope files on that stronger reading.
- **The process list retires as the claim protocol's verdict, on measurement rather than on argument.** Three `dotnet` processes resident on this box accumulated 0.00 CPU-seconds across a 45-second interval while five others and a `testhost` started and exited inside the same minute, and a single `VBCSCompiler` sample called static had in fact gained roughly 26 CPU-seconds in the preceding 65 seconds. So the instrument is degenerate in identity and in time both: absence hides in-process agent fan-out, presence is routinely idle residue, and the CPU-delta repair only reads processes that survive long enough to sample twice. The line that survives is drawn on cost rather than on evidence, presence licensing waiting at bounded cost and absence never licensing starting or releasing at unbounded cost.
- **The gate-3 versus gate-4 pair measures that blindness with a control on the other side.** Same tree shape, 216.8 s with no agents on the box against 304.3 s with three concurrent in-process reviewers, roughly 40 percent slower. A poll by process name during the slower run would have reported a quieter box than during the faster one, which is an inverted reading rather than an incomplete one. The close gate then ran 220.1 s with two foreign read-only reviewers resident, so the cost is not linear in agent count and none of these clocks is diffed as a trend.
- **A guard's reach is read from the guard, never from the sentence citing it.** The dispatch-brief clause asserted that the readonly-agent-guard made the claim writes impossible for a read-only agent. It denies a write into the tree under review, keyed on the repo root, and a destination outside the git root is an explicit positive allow; the claim file sits outside every repo. The split now rests on accountability, the dispatching session owning the id the claim carries and being the party still alive to delete it, rather than on a mechanism that does not exist. This retired a premise the machine coordinator had authored and the expert seat had adjudicated, and both accepted the correction.
- **An unverified premise in a brief is the briefer's defect, and the dispatched agent caught it.** The fix-round brief asserted that memq lowercases operator-record names at write, taken from a reviewer's citation without opening the code. The implementer went to the function, could not confirm it, declined to write the mechanism into a shipped skill, and grounded the case-insensitivity fix on what it could verify instead. That is the marking rule producing the behaviour it exists for, in the direction that costs the orchestrator something.
- **The harness's completion notification disagreed with the run's own exit code on every gate this section ran, three out of three.** Twice it reported the wrapper's exit as 0 against a marker reading 1, and once it reported a run complete while that run was still executing. The doctrine states the wrapper-versus-run distinction as a rule; this section has it as an observation with two numbers.
- **A volatile fact belongs at the step that consumes it, never in the preamble, and the design was watched absorbing a real staleness.** The fix-round brief told its implementer the box was free, which was true when written and false ninety seconds later. No correction was sent, because the box-budget clause states the check as an act performed at the spawn step rather than as a fact asserted in preamble. The machine coordinator arrived at the same rule independently from its slot grants, which are issued provisional on the holder's own re-check.

Assumptions: none beyond the recorded deviations, each written into the section text rather than left standing.

Review Findings:

- Round 3 returned adversarial CHANGES_REQUIRED with one Critical, blind CHANGES_REQUIRED, and security CONCERNS. The tree-state bracket was clean at both ends of every round, so no finding is an artifact of a reviewer writing to the tree.
- **All three lenses independently found the same Critical**, the strongest convergence this effort has had: the dispatch-brief clause in `executing-work` still carried the retired process-list verdict while the role skill's own text was correct. That clause is copied verbatim into every heavy-work brief and a subagent inherits no skills, so the retired rule was the only version reaching the agent actually spawning the process. Fixed in the main thread before the fix round dispatched.
- Criticals and Majors fixed: the retired verdict; the false guard premise; an Amendment 4 hostname in a public payload; the over-claimed audit leg, the kit setting no git identity in the store at all, so attribution is conditional on a per-machine committer identity the operator establishes; the claim protocol's two foreign-claim deletes reconciled into one closed carve-out set with the release's window, mechanic, record and claimant notification stated; data-never-instructions extended from two file forms to all four and restated inline in the brief clause, since the claim file is the widest-writer form and is read by agents holding Write, Edit and Bash; the delegation record bounded to its on-switch with its body read as data; the `Workdir` precondition stated as establishable only by an operator answer on a warranted channel, no memory record standing in; the hostname comparison stated case-insensitive; the kaizen routing duty reconciled across three files so a non-coordinator seat routes by message rather than appending, which the unchanged capture bar would otherwise have made impossible in an unattended fleet; the `Session:` delete scope corrected to discriminate sessions and nothing finer; and the `claims/` sync-churn conflict exposure named.
- Majors routed to later sections with the rule that settles each, all four being forward references the plan already schedules rather than defects: the coordinator runbook not yet performing the claim sweep, probe and release is Section 4, and that duty is now written into Section 4's text as recorded approval drift so it cannot be dropped; the dangling seat-tier cadence pointer is Section 7; the seat-stop hook is Section 5; the Admin inbox shape is Section 6.
- Routed out of this plan: the Amendment 4 residue across the rest of the public payload, 65 hostname hits across 22 files plus an account name, a session-transcript path and private-repo disk layouts. The machine coordinator raised the scope question to the operator, who ruled it hygiene-grade at payload-plus-live-docs scope, and the expert seat authored `docs/plans/claude-kit_public-surface-hygiene_spec_v1.md` for it, now armed at queue position 5. Widening this section to 22 files would have mixed two efforts into one commit.
- Every new parity pin carries its own observed red with the rule that refused each case, never a reported green. `assert` throws on the first failure, so a test carrying several new assertions gets one red proving only the first; each pin was therefore taken to red by its own ablation, with pre-probe copies and byte-diff-verified restores, and the surfaces the implementer could not mutate were driven against ablated copies of the exact predicates, 16 of 16 flipping red.

Stamps: adjudicated 3, stamped 2, over a window covering this section's span since Chapter 2 closed at 05:40:54Z. `a-model-override-the-account-cannot-serve-never-runs` steered taking first-turn readings as per-line assistant-model tallies on all four override-carrying dispatches; `memq-puts-its-diagnostic-on-line-one-so-never-tail-it` steered reading memq's refusals off line one rather than tailing. `neo-claude-is-the-operator-bot-contributor-identity` was skipped as a Chapter 2-era read bearing on the store's second principal, which steered nothing here. The window is worth recording because the two spellings disagreed: `--since 3h` returned zero while `--since 4h` returned the three, the reads sitting at about 3h against a 3h32m span, so the narrower window would have reported a clean sweep over a stretch it could not actually see.

Gate: baseline 1,879 tests / 1,876 pass / 1 fail / 2 skipped at `5edb448`, exit 1; close 1,883 / 1,880 / 1 fail / 2 skipped, exit 1 read from the run's own marker, 220.1 s at a contention row of 3 idle `dotnet`, 13 node, 5 claude and 8,804 MB available, with two foreign read-only reviewers resident. Delta +4 tests, +4 passes, no regressions. The one failure is the same case by name, enclosing line, assertion and mechanism in both runs, `a pinned directory too long to name faithfully stands the session down` at `test/memory-session.test.js:854` asserting at `:865`, the host-dependent short-`TEMP` red routed to `docs/backlog.md` in Section 1; its `actual` is a domain value rather than a process-level one, and the two skips carry their own guard-emitted reasons, so the run passes every contention-forgery screen. `node --test test/doctrine-parity.test.js` was re-run by the orchestrator after each implementer round rather than taken from a report: 26 tests / 26 pass / 0 fail, exit 0 from the run itself.

Next: 4. Reconciliation becomes a diff, and the status round becomes the residue (element D and Fork 3)
Commit Model: Commit-and-Push

### Interim board 5 - 2026-08-28

Section 4's first review round has adjudicated with the section not closing, and
the compaction gate is holding offers, so this entry banks the run's state rather
than leaving it in context. All three lenses returned against the section and the
security lens returned BLOCK, so the section goes to a fix round rather than to a
close gate.

**In-flight sections.** Section 4 only. Sections 1, 2 and 3 closed at `77462a5`,
`ebf5ee0` and `fb0f194`; 5 through 10 not started. Base is `7f02b65`, which moved
under this session when the expert seat committed its three plan files after its
freeze was released; nothing was lost, this section's work being unstaged
throughout.

**Live dispatches.** None. Four have returned: one `implementer-opus` on the
build, and an adversarial, a blind and a security reviewer, all three at opus with
effort `max` through the Workflow route. First-turn readings were taken as
per-line assistant-model tallies on the two transcripts that existed at the
five-minute mark, 24 and 17 assistant lines, every line resolving at the requested
alias with zero synthetic. The third had no transcript and no journal entry at
that reading, which is the runtime's own scheduling rather than a fault: the
workflow ran two agents concurrently and started the security lens as the blind
lens finished, and it then completed normally. The tree-state bracket is
byte-identical at both ends of the round, so no finding is an artifact of a
reviewer writing to the tree.

**Gate baseline.** 1,883 tests / 1,880 pass / 1 fail / 2 skipped, exit 1 read from
the run's own marker, 213.8 s, captured at `fb0f194` on a box carrying 0 dotnet, 0
testhost, 0 msbuild, 12 node, 5 claude and 9,120 MB available. The counts are
identical to Section 3's close, and that identity is the evidence rather than a
coincidence: no tree edit landed between the two runs. The one red is the standing
host-dependent short-`TEMP` case, matched by name, enclosing line, assertion and
mechanism; both skips carry guard-emitted reasons read rather than counted; the
failure's `actual` is a domain value rather than a process-level one. The run
clears every contention-forgery clause. `node --test test/doctrine-parity.test.js`
was re-run by the orchestrator rather than taken from the implementer's report: 26
tests / 26 pass / 0 fail, exit 0 from the run itself.

**Rulings adopted since the last boundary.**

1. *The probe is degenerate for the population it governs, which is the finding of
   the round and it lands on this section's own instrument.* A session holding the
   heavy-process slot is by construction sitting inside one long-running build or
   suite tool call, and a message is delivered at the claimant's next tool round,
   so a live holder cannot answer and the pass would release a live claim and put a
   second heavy process on the box. The section retired the process poll for being
   degenerate and then rested the replacement on an instrument degenerate for the
   same population in a different way. The repair is not a longer window: an
   unanswered probe conflates a dead claimant with held-and-expired, queue
   overflow, an unreachable elevated seat and a claimant that cannot be addressed
   at all, so the release takes a roster liveness reading beside the unanswered
   probe, and refuses to fire on a claimant it could not reach.
2. *A destructive act may not rest on an unauthenticated artifact, and the sweep
   did.* The sweep's whole warrant is a registry file that nothing validates at
   write time, that any local session writes directly, and that another machine can
   write through store replication. Writing a registry entry whose name appears on
   no roster row is enough to make the next pass delete a live foreign claim, with
   no probe, no board record and no notification on that leg. The sweep takes the
   release's discipline: corroboration, a record, and a notification.
3. *The heartbeat prune would fire on every install today.* Its writer is Section
   5's seat-stop hook, which does not exist yet, and the contract's own documented
   value at takeover is `Heartbeat: none`. So the one seat the paragraph exempts,
   the elevated Admin, reads as exited on the first pass and has its entry pruned
   and its claim swept while being structurally unable to be told. An absent or
   `none` stamp reads as unknown, never as stale, and the prune leg waits on an
   explicit elevation marker.
4. *The diff's join has no key, and the file already said so.* The roster prints a
   name and a `[ref]` where the registry is keyed by session id, names collide by
   construction, and the roster carries classes with no entry in this machine's
   registry at all, other machines' sessions, cloud sessions, and the seat's own
   in-process subagents. The unchanged funnel paragraph states as fact that no
   surface matches the two. The join key is stated explicitly, the diff is scoped
   to this machine's registered sessions, and an ambiguous match resolves to
   present rather than exited, because only one direction of that error deletes
   anything.
5. *The section changed a trigger it was only asked to give figures to.* The role
   skill defers exactly one window and releases on it; the runbook invented a
   second, conjunctive one, which put the contract and the runbook four hours
   apart and left the 30-minute figure gating nothing, a dead conjunct no wrong
   value could ever surface. The release fires at the single deferred window.
6. *The probe time has no durable home, which the file's own rules forbid.* Every
   board line is situational or a commitment; a situational line is re-derived from
   the claim file, which carries no probe field, and the commitment set was closed
   without one. So the probe time lives only in loop context, which this same file
   forbids for anything load-bearing. A probed claim becomes a named commitment
   line.
7. *`docs/security-model.md` and `docs/architecture.md` are routed to Section 8
   rather than folded here.* Both carry counted claims this section falsifies, six
   durable sources now eight, and a claim-protocol description stating that a
   completing writer cannot erase a live foreign claim with no mention of the
   coordinator's carve-outs. Section 8 already owns both files and already exists
   for exactly this shape, so folding them here would mix two efforts and spend the
   red-first evidence Section 8's own pin depends on.
8. *`plugins/claude-kit/skills/role/SKILL.md` is folded into this section's scope.*
   All three lenses found that the pass grants itself a prune the owning contract
   does not admit, that contract naming coordinator carve-outs explicitly for the
   claim file and conspicuously not for the registry. A seat asserting a
   destructive power over a peer's single-writer artifact in its own runbook is the
   authority model's own cannot-warrant-a-grant-it-authored shape, so the carve-out
   lands in the owning contract. The section's files-in-scope line records the
   widening.

**Next action.** One fix round to `implementer-opus` over the three files, then a
re-review of the changed surfaces by all three lenses, then the close gate on a
quiet box, then Chapter 4. The box is free and uncontended as of 09:44:53Z by the
AI-OS worker's own release; this seat holds no suite slot while the fix round runs.

### Interim board 6 - 2026-08-28

Section 4's second review round has adjudicated with the section again not
closing. All three lenses returned against it, the security lens returning BLOCK
for the second consecutive round, and the tree-state bracket is byte-identical at
both ends, so no finding is an artifact of a reviewer writing to the tree.

**In-flight sections.** Section 4 only. Sections 1, 2 and 3 closed at `77462a5`,
`ebf5ee0` and `fb0f194`; 5 through 10 not started. Base is `aee3457`.

**Live dispatches.** None at the time of writing. Four returned since the last
board: one `implementer-opus` fix round resumed once by message for a single
correction, and an adversarial, a blind and a security reviewer, all three at
opus with effort `max` through the Workflow route. First-turn readings were taken
as per-line assistant-model tallies on all four, 16, 55, 32 and 28 assistant
lines, every line resolving at `claude-opus-5` with zero synthetic. The reading
had to be taken at `subagents/agent-<id>.jsonl`, because on this machine the
`tasks/<id>.output` path the tool result advertises is zero bytes for every local
agent dispatch, and a tally run against that path returns zero assistant lines,
which is indistinguishable from the never-started shape the reading exists to
detect.

**Gate baseline.** Unchanged at 1,883 tests / 1,880 pass / 1 fail / 2 skipped,
exit 1, 213.8 s, captured at `fb0f194`; no whole-suite run since, the section
having taken no close gate. `node --test test/doctrine-parity.test.js` was re-run
by the orchestrator after each implementer round rather than taken from a report:
26 tests / 26 pass / 0 fail, exit 0 from the run itself, twice.

**The tier comparison, run before the bump the ladder allows.** Round 1's findings
and round 2's are compared, and one class repeats: the sweep's warrant. Round 1
found the sweep resting on a registry file nothing validates at write time. Round
2's security lens found that the corroboration ordered in response resolves the
claim's `Session:` through that same registry entry, so the primitive survived one
field larger and the corroborating evidence is still drawn from the surface the
corroboration exists to distrust. A repeating class makes the tier the lever, so
round 3 dispatches to `implementer-fable` with the explicit fable override. The
comparison also names what the ladder does not cover: the repeat is this
orchestrator's ruling rather than the implementer's execution, the implementer
having built exactly what ruling 2 specified. Both repairs are therefore made, the
tier bump and the generator fix below, rather than the bump alone.

**Rulings adopted since the last boundary.**

1. *The sweep stops existing as a separate act.* No surface independently
   corroborates a session id: the join from an id to a roster name runs through the
   registry entry, which any local session writes and which another machine can
   write through store replication. So a reconciliation-driven sweep cannot be made
   sound at any level of care, and the repair is not a better corroboration but the
   removal of the cheaper path. A foreign claim is reclaimed exactly one way, the
   probe, the window, the roster reading, the record and the notification, and
   reconciliation refers to that one rule rather than carrying a second. This
   dissolves three round-2 findings with it: the sweep trigger that cancelled
   itself, the prune-then-sweep ordering that destroyed the evidence the sweep
   needed, and the unknown gate that protected only the paragraph the sweep had
   been decoupled from. The cost is that reclaiming a dead session's claim is slower
   by one probe window, which is the correct side of this protocol's own cost
   asymmetry.
2. *The join default is narrowed back to what ruling 4 licensed.* The shipped text
   resolves to present where the key matches no roster row "ambiguously or not at
   all", and the not-at-all half is the exited leg's own trigger, so the prune
   became unreachable while the neighbouring paragraph still prunes on it. All three
   lenses found the contradiction. Ambiguity, meaning two or more rows, resolves to
   present; zero rows is a candidate the heartbeat leg then decides; and the role
   skill states the same, since it currently says an unresolved reading leaves the
   file in place.
3. *Rulings 1 and 2 land in the owning contract, which widens this section's fold.*
   Both files agree the role skill's contract governs where the two are read against
   each other, and that contract still states the release on one leg, unanswered
   past the probe window and released, with no roster reading and no unreachable
   exemption, and still gives record-and-notification to the release alone. A ruling
   implemented only in the file its own precedence rule says loses is not
   implemented. The fold in the role skill therefore widens from the one narrow
   prune carve-out to the claim protocol itself.
4. *The launch-invocation screen is a security Critical and is fixed here whatever
   its scope.* The role skill admits a resolved invocation as runnable where it is
   one line of printable ASCII reading as the launcher, its flags, and the seat
   name, with no separator, substitution or redirection. The screen is
   metacharacter-shaped and the payload class that matters is flag-shaped, so a
   permission-disarming launcher flag passes every clause and is presented to the
   operator as runnable with the kit's imprimatur. The record body comes from the
   operator memory tier, which the same paragraph states is writable by any local
   session and reachable from every machine the store syncs, so this is
   cross-machine reachable and the security model's already-has-code-execution
   acceptance does not cover it. This is Section 3 text surfaced by Amendment 2's
   whole-file read rather than a regression of this round, and a security finding of
   Critical weight is never parked. The screen becomes an allowlist of admitted
   flags rather than a scan for metacharacters.
5. *A probe's board line is written when the probe is sent, not when it is
   adjudicated.* Ruling 6 required the probe time to have a durable home and did not
   name the moment it becomes durable, which leaves the latest moment as the natural
   reading, and that is the moment a compaction between send and adjudication has
   already passed. The general form is worth carrying: a durability requirement that
   does not name the moment of writing defaults to the moment a failure has already
   gone by. Raised by the coordinator seat and adopted.
6. *The inversion is stated in the section text, because it is what makes the probe
   defect dangerous rather than merely wrong.* The instrument's error is perfectly
   correlated with the harm: the holder deepest inside a long run is the one most
   certainly unable to answer and the most costly to release. That is the same shape
   as the process-poll inversion Chapter 3's gate-3 and gate-4 pair measured, 216.8
   s against 304.3 s on the same tree shape, where a poll by process name during the
   slower run would have reported a quieter box than during the faster one. Two
   instruments, one failure shape, and the second was adopted to replace the first,
   so the pair is cited together.
7. *Six evaluability defects are fixed rather than routed, each being a predicate
   with no value on today's surfaces.* The staleness test reads twice a seat's
   stated cadence, which only the coordinator and admin rows will state, so an entry
   whose seat states none takes the coordinator's own 4-hour cadence as the default.
   A future start stamp is read as now, since otherwise a claim dated forward is
   never past its duration and holds the slot permanently. The unregistered mark is
   scoped to local non-subagent roster rows, since as written it accumulates a board
   line per dispatched subagent per pass. A claim written by a session that never
   took a seat has no address at all, the claim carrying a session id and no
   registry entry existing to resolve it, so the claim file gains a name field and
   the probe addresses that. An unparseable or absent duration field takes the same
   bound and the same report as an over-long one. And the malformed label is
   separated from the bound, an honest six-hour pass being over the bound without
   being a malformed file.
8. *The path screen is narrowed to the sources that can actually bear it.* The
   shipped accept leg matches a path against a repo known from the roster, the board,
   or the operator, and neither of the first two can carry one: a roster row's repo
   name is the self-chosen half of a session name, and the board is the same
   unauthenticated cross-machine artifact the screen exists to distrust. A path is
   placed only against a repo the operator named or the seat resolved from disk, it
   is normalized before matching, and a residual parent-directory segment is refused.
9. *Three consistency repairs ride with the round.* A prune gains its own commitment
   class, both files requiring the prune to be recorded in a board shape the ledger
   never defined, which is ruling 6's defect fixed for the probe and left standing
   for the prune. The re-derive field on a board line is stated as a label rather
   than a command to run, the board replicating across machines. And the reason given
   for excluding the idle subscription from the claim probe is restated as a latency
   argument, a 12-hour expiry against a 4-hour window, rather than as the claim that
   the peer is neither idle nor exited, which the same file contradicts by naming
   exit as one of the subscription's two triggers.

**Recorded approval drift.** Section 6's text was edited during Section 4's
execution to make the elevation reachability statement a pointer to the messaging
contract rather than a second full statement of it, Section 4 having landed that
property in the contract this round. The adversarial lens correctly noted the edit
was unrecorded, and this entry is that record. The same lens noted the coordinator
skill states the same property twice while the spec edit argues for one home; both
mentions become pointers in round 3.

**Next action.** One fix round to `implementer-fable` with the explicit fable
override, over the same three files with the role skill's fold widened to the
claim protocol, then a re-review by all three lenses, then the close gate on a
quiet box, then Chapter 4.

### Interim board 7 - 2026-08-28

Section 4's third fix round and fourth review round have both landed, and the
section is close but not closed. The round returned adversarial CHANGES_REQUIRED,
blind CHANGES_REQUIRED and security CONCERNS, with no Critical on any lens and the
security verdict off BLOCK for the first time in three rounds. The tree-state
bracket was byte-identical at both ends.

**In-flight sections.** Section 4 only. Sections 1, 2 and 3 closed at `77462a5`,
`ebf5ee0` and `fb0f194`; 5 through 10 not started. Base is `9a06dcb`.

**Live dispatches.** One: an `implementer-fable` fix round over the three skill
files and the parity test, carrying the fourth round's seam findings. Its
first-turn reading is pending at the time of writing.

**What the fourth round established.** Every ruling from boards 5 and 6 has a
shipped implementation, located and named by the adversarial lens rather than
asserted: the sweep is gone from all three skill files with a grep run against a
positive control, the join default agrees across the runbook and the contract, the
claim protocol sits whole in the owning contract with both figures deferred and
stated once, the probe records at send, the launch-flag screen is an allowlist,
all six evaluability fixes are present, the path screen disqualifies the roster
and the board as sources, the prune has its commitment class, and both elevation
mentions are pointers. The security lens confirmed independently that no second
path to a foreign claim survives anywhere in the three files, naming the rule that
refuses each candidate path rather than reporting a green.

**Gate baseline.** Unchanged at 1,883 tests / 1,880 pass / 1 fail / 2 skipped,
exit 1, 213.8 s at `fb0f194`; the section has taken no close gate yet.
`node --test test/doctrine-parity.test.js` was re-run by the orchestrator after
every implementer round rather than taken from a report: 26 of 26, exit 0 from the
run itself, on each of four occasions.

**Rulings adopted since the last boundary.**

1. *The launch-invocation screen stops presenting anything as runnable, because an
   allowlist this repository cannot close is not an allowlist.* Two lenses found
   independently that the admitted flag has no literal spelling anywhere in the
   shipped payload, so a screen admitting it by name decides membership on the
   untrusted record's own say-so, and the launcher token was admitted by role
   rather than by value while a flag's value was unaccounted for. Naming the flag
   was refused rather than guessed: an unverified external literal written into a
   public skill is worse than the hole it closes. So the resolved invocation is
   always presented as prose for the operator to confirm, never marked runnable,
   the metacharacter screen staying on as an independent second catcher. The cost
   is one operator confirmation per machine, paid once.
2. *A successful send does not establish delivery, and the contract says so.* The
   release's first leg turned on a delivered result while the messaging contract
   defines delivered, held and refused as receiving outcomes, and the same
   paragraph already conceded that a held probe expires with no failure returned to
   the sender. The predicate was therefore unimplementable. It is restated on what
   a sender can observe, a send that returned a failure against one that did not,
   with the residual ambiguity stated plainly: held-and-expired and a full queue
   both look like success from the sender's side, and that ambiguity is precisely
   why the release takes a second leg rather than resting on silence.
3. *Two dead-claimant paths get honest statements.* The cost claim that a dead
   session's claim comes free one probe window late is false for the common case: a
   session that died before the probe cannot return a delivery and resolves to no
   roster row, so it ends as a permanent untracked hold rather than a self-healing
   release, and a coordinator reading the optimistic version under-escalates. And a
   probe answered by a party that denies holding the box had no disposition at all,
   the probe addressing by name while the delete is scoped by session id, which
   routinely resolve to different parties once a session relaunches under the same
   roster name; that answer also permanently defeated the first leg, which needs an
   unanswered probe. It now routes to the operator as an untracked hold with the
   answer recorded.
4. *The plan doc itself still instructed the retired sweep, which is the finding
   with the longest reach.* Section 4's body still read that the pass sweeps any
   claim a dead session held, and Section 3's body still pointed forward to that
   sweep, while all three skill files had stopped doing it. Section 8 is chartered
   to rewrite the security model's claim-protocol description from these bodies and
   sections 5 through 10 are unstarted, so the primitive two BLOCK rounds removed
   was scheduled to be re-documented and re-implemented from the plan that is meant
   to be the source of truth. Both paragraphs are rewritten to the
   probe-and-release-only rule, and Section 3's field list gains the address field
   with the two-legged release, in the main thread since the guard denies a
   subagent any write under `docs/`. The two surviving mentions of a sweep in this
   document are named rather than reported clean, and both are exempt as
   append-only history: Chapter 3's account of a different sweep entirely, the
   referrer sweep, and board 5's ruling as it stood when it was written.
5. *Two privileged surfaces this plan creates are routed to Section 8.* The
   takeover ritual resolving a launch invocation from a cross-machine-writable tier
   and putting it in front of the operator, and the standing-delegation opt-in
   record that flips a seat's default treatment of peer direction, have no entry in
   the security model. Neither is covered by that document's already-has-code-
   execution acceptance, both being reachable from any machine that syncs the
   store rather than from this one alone. Section 8 already owns the document and
   exists for this exact shape.
6. *The strengthened pin is itself narrowed after review.* Deriving the claim's
   field set from a whole section reads every backticked field token in it, so a
   field dropped from the shape-bearing sentence but still mentioned incidentally
   nearby leaves the two sets equal, which is a false green on the very
   one-sided-removal class the pin was built to catch. It derives from the
   shape-bearing sentence on each side instead, and the change earns its own
   red-first ablation.
7. *Eight seam defects are fixed rather than routed*, each a paragraph whose
   neighbour was not re-read: a probe window figure restated in a file that
   declares it restates neither figure, a pointer attributing to another skill a
   mechanism that skill does not state, a single-owner claim contradicted by two
   deliberate restatements one of which is a subagent's only copy, an idle reading
   that inverts the messaging contract's own busy semantics, a duration bound with
   no anchor when its start stamp is absent, a claim with no address and no stated
   disposition, a boardless refusal stated for one destructive act and not the
   other, and a told-not-derived board line class that satisfies neither of the two
   rules that reach it.

**Next action.** The fix round returns, then a fifth review round over the changed
surfaces, then the close gate on a quiet box, then Chapter 4. The section has now
run three fix rounds and four review rounds; the tier escalated once, at the
second round, on a repeating finding class.

### Interim board 8 - 2026-08-28

Section 4's fourth fix round and fifth review round have both landed, and the
section is still open. The round returned adversarial APPROVED_WITH_CONCERNS,
blind CHANGES_REQUIRED and security CONCERNS, with no Critical on any lens for
the second consecutive round. The tree-state bracket was byte-identical at both
ends, and the parity lane was re-run by the orchestrator itself at every step:
26 of 26, exit 0 read from the run's own exit code, on each of three occasions
this boundary.

**In-flight sections.** Section 4 only. Sections 1, 2 and 3 closed at `77462a5`,
`ebf5ee0` and `fb0f194`; 5 through 10 not started. Base is `09b9db3`.

**Live dispatches.** One: an `implementer-fable` fix round over the three skill
files, the dispatch-brief clause and the parity test, carrying fifteen
adjudicated items. Its first-turn reading is taken and clean, 16 non-synthetic
assistant lines on the requested model with no synthetic placeholder.

**Gate baseline.** Unchanged at 1,883 tests / 1,880 pass / 1 fail / 2 skipped,
exit 1, 213.8 s at `fb0f194`; the section has taken no close gate yet.

**What the fifth round established, and what it did not.** Every ruling from
boards 5, 6 and 7 was located in shipped text by the adversarial lens, by file
and line, rather than asserted, with one exception it named as partial: board 7
ruling 4's rewrite of the plan's own body reached two paragraphs of three. The
security lens answered both of its round questions by naming the rule that
refuses each candidate path rather than by reporting a sweep clean, and found no
second path to a foreign claim and no unmarked untrusted content. What the round
did not establish is any Critical, on any lens, for the second round running.

**Rulings adopted since the last boundary.**

1. *A repair is aimed at the warrant, never at the finding's coordinates, and
   that is now Standing Amendment 9.* The prune's paragraph still claimed to
   rest on corroboration rather than on the registry entry, while both of the
   readings it names are taken from that same entry. This is the identical
   defect the sweep was retired for two rounds earlier, surviving one paragraph
   away because the fix was aimed at the site the finding named. Two instances
   of one class means the generator is at fault rather than the output, so the
   amendment makes the unit of disposition the reasoning a rule rests on:
   enumerate every rule in the changeset stated on that same reasoning and give
   each one a disposition with the rule that settles it, naming any sibling left
   as it stands. The overclaim grants nobody a new ability, since a session able
   to write a peer's entry can already delete it; what it costs is the accuracy
   of the audit line the same file calls the whole of the compensating control.
2. *The never-polled sentence forecloses the claim probe against exactly the
   population the address field was added for.* An unregistered heavy spawner is
   both a marked roster row and a claimant the pass must probe, and the two
   dispositions sit two paragraphs apart in one file with neither carving out
   the other. Left as written, an unregistered writer's overdue claim can never
   satisfy the release's first leg and the machine's one slot is held for good,
   which is the stuck hold this section exists to close arriving through a seam.
3. *A confirmation paid once does not cover text that can change afterwards.*
   The launch-invocation screen correctly stopped presenting anything as
   runnable, and then bounded its remaining control to one confirmation per
   machine over a record any local session can rewrite and every syncing machine
   reaches. The confirmation becomes per-resolution, or the seat records what it
   confirmed and re-asks when the resolved text differs; no flag literal is
   introduced either way, the earlier refusal to guess one standing.
4. *The contract defines a path-bearing field and routes no reader of it through
   the path screen.* The working-directory field is gated for writing and
   ungated for reading, while the two files that do carry the screen apply it at
   their own points of use. This is the second-producer shape: a sanitizing
   guard is a property of the channel, so it belongs at the shared boundary the
   moment a second producer appears. The registry filename's own session
   identifier is named as a disclosure in the same edit, the privacy paragraph
   having gated the field beside it at length and said nothing about the name.
5. *An unverifiable transport behaviour is marked unverified rather than
   asserted.* The dead-claimant branch rested on a send to an unresolvable name
   returning a failure, which the messaging contract that owns sender-observable
   outcomes never states and which that file's own rule therefore leaves
   unverified. The contract says so plainly, and the branch is rewritten to hold
   whichever way the send resolves, rather than the convenient direction.
6. *Three more evaluability repairs.* The blocker funnel's corroboration leg
   gains its three readings explicitly, with one vocabulary across the paragraph
   and a stated disposition for the case that currently has none. The
   forward-dated start stamp anchors at the first observing pass, since read as
   the reading pass's own now it makes elapsed time zero forever and delivers
   precisely the never-probed outcome it was written to prevent. And the release
   window, a name for a figure no surface defines, becomes the probe window at
   both sites.
7. *The plan's own body carried the defect it was rewritten to remove.* Section
   4's second paragraph still described a one-legged release, named the window
   that does not exist, and restated a count of the claim duties. Board 7's
   rewrite reached the section's opening paragraph and Section 3's body and
   stopped one paragraph short, which is Amendment 8's own edit unit failing in
   the hands that wrote it. Rewritten whole, with the count dropped rather than
   corrected, since a restated count is an invariant nothing checks.
8. *A dispatch stopped by a model safeguard is an environment fault, and its
   accounting is recorded rather than absorbed.* The first round-6 dispatch
   terminated on an API safeguard flag before writing anything, its transcript
   holding the synthetic-only shape: zero non-synthetic assistant lines beside
   one placeholder, with the payload files verified untouched. The error names a
   deterministic content trigger rather than a capacity fault, so re-sending the
   same brief would have reproduced it and spent the one same-model retry on a
   certain repeat. The retry went out at the same tier with the threat narrative
   stripped and every technical requirement intact, and started cleanly. The
   pair rule is therefore not met and the tier stands; had the second stop
   landed, this fable-tier section would have taken its stall raise.

**Next action.** The fix round returns, then a sixth review round over the
changed surfaces, then the close gate on a quiet box, then Chapter 4. The
section has now run four fix rounds and five review rounds; the tier escalated
once, at the second round, on a repeating finding class, and has had no
Critical on either of the last two rounds.

### Interim board 9 - 2026-08-28

Section 4 ran two more fix rounds and two more review rounds since the last
boundary and is still open. Round 6 returned adversarial CHANGES_REQUIRED, blind
APPROVED_WITH_CONCERNS and security CONCERNS; round 8 returned adversarial
CHANGES_REQUIRED, blind CHANGES_REQUIRED and security CONCERNS. No Critical on
any lens across either round, which is four consecutive rounds without one. Both
rounds were bracketed by a tree-state capture that was byte-identical at each
end, so no reviewer touched the tree. The parity lane was re-run by the
orchestrator itself at every step rather than taken from any report: 26 of 26,
exit 0 read from the run's own exit code, on each of four occasions this
boundary.

**In-flight sections.** Section 4 only. Sections 1, 2 and 3 closed at `77462a5`,
`ebf5ee0` and `fb0f194`; 5 through 10 not started. Base is `e18f7b9`.

**Live dispatches.** One: a `consultant` at fable, asked to rule on whether the
round-by-round fix loop is the right instrument for finishing this section or
whether the section needs an exhaustive sweep instead, and told to test that
framing rather than ratify it. Its first-turn reading is not yet taken. No
implementer is in flight.

**Gate baseline.** Unchanged at 1,883 tests / 1,880 pass / 1 fail / 2 skipped,
exit 1, 213.8 s at `fb0f194`; the section has still taken no close gate.

**What the two rounds established.** Round 7's six Majors and ten Minors all
landed and were located in shipped text by the round-8 adversarial lens, by file
and line, with the repairs judged sound at their sites by the security lens too.
The strengthened claim-field pin had all three of its discriminating ablations
reproduced by the orchestrator's own hand rather than accepted from the
implementer's report, each restore verified byte-identical against a pre-probe
copy. What the rounds did not establish is convergence: round 8 returned roughly
seven Majors, and the yield is not falling.

**Rulings adopted since the last boundary.**

1. *An event's identifier is matched against an enumeration, never composed into
   a path.* The blocker funnel resolved a registry entry named for a session
   identifier carried by a machine-wide stream any session on the box can write,
   while the screen the paragraph invoked is shaped for the event's project path
   and constrains no filename component. The join is now a string match against
   the listing the reconciliation diff already reads.
2. *A reading taken through an unauthenticated artifact buys refusal, not
   corroboration, wherever it is taken.* The funnel's first leg still called its
   registry-mediated reading corroboration one file from the paragraph that had
   just downgraded the identical reading. The leg is restated at refusal
   strength in one vocabulary with the contract, which narrows output as well as
   wording: an event the plan-doc leg does not corroborate is now reported to
   the operator as unresolvable rather than briefed as an incident, so nothing
   goes unreported and only the register changes.
3. *A contract does not assert a bound it has no text for.* The prune
   paragraph's inbox sentence cited a section of its own file that does not
   exist and claimed each multi-writer form is bounded by its stated protocol.
   The contract now says plainly that the inbox's write protocol is not stated,
   that no rule bounds a rewrite or truncation of another's request there, and
   where the discipline will arrive.
4. *A category whose members lose their only record is not the category whose
   drop costs a re-derivation.* The ledger swept held claims wholesale into the
   re-derivable side while two paragraphs below defined the told-not-derived
   lines as having no file behind them. The split is scoped to the one held
   claim with a file, and the told-not-derived lines gain the sensitivity
   disposition they had none of.
5. *Every reachable state of a field that gates a delete gets a licensed
   reading, and the unresolvable ones never destroy.* The prune predicate read
   only two states of the heartbeat stamp, leaving an unparseable, future, or
   not-past-start stamp with no reading at all. All three now read unknown and
   prune nothing, mirroring the claim protocol's own structure, and the
   paragraph's today's-kit claim is corrected: no writer the kit ships reaches
   the exited reading, while a hand-written stamp does.
6. *The plan's own body is a surface every round has to visit, and that is now
   Standing Amendment 10.* Four body paragraphs still instructed mechanisms this
   section retired, the third such recurrence, and Amendment 8's edit unit kept
   failing because nothing named the body as a surface a round must visit at
   all. The amendment makes a change to shipped text the trigger rather than a
   review finding, since the body goes stale at the edit and not at the report.
   It was then violated in the same round that added it, by the session that
   wrote it, which is recorded here as the fact it is.
7. *Two defect classes are not converging, and the instrument is the suspect.*
   Round 8's Majors fall almost entirely into the two classes every prior round
   produced: untrusted input acted on at a resolved target with no screen named
   at the point of use, now found on a fourth surface, the claim's own `Name:`
   used as a message address and as the release's second-leg key, where an
   absent name is fail-closed and a present unresolvable one is fail-open; and a
   warrant repaired at one site while its siblings keep the retired reasoning. A
   round examines what the previous round's findings point at, so it finds a
   class's next instance rather than its last. The consult named above is
   convened on that reading rather than on any single finding.
8. *A pre-existing disclosure was routed by an existing source rather than
   re-decided.* The security lens reported account names, a username-bearing
   absolute path and session identifiers across tracked files of this public
   repository. The finding is confirmed against the tracked tree with a positive
   control, and the queued public-surface-hygiene plan already carries the class
   and records the operator's own ruling on it, the archive included, so it is
   routed rather than reopened.

**Next action.** The consult returns and its ruling decides the shape of the next
round; the confirmed Majors from round 8 are fixed either way, the event's plan
path and the claim's forgeable name among them. Then the close gate on a quiet
box, then Chapter 4. The section has now run five fix rounds and eight review
rounds, with no Critical on any lens across the last four.

### Interim board 10 - 2026-08-28

Section 4 stopped being reviewed by sampling. The consult convened at the last
boundary ruled that the round-by-round loop was the wrong instrument, and the
section ran an exhaustive two-table enumeration, one fix round driven by it, and
one review round briefed to falsify the tables. The section is still open, and it
is open at a defined stopping rule rather than at another round's discretion.

**In-flight sections.** Section 4 only. Sections 1, 2 and 3 closed at `77462a5`,
`ebf5ee0` and `fb0f194`; 5 through 10 not started. Base moved to `07bd40c` during
the round: this checkout is shared with the repo's expert seat, whose one-file
kaizen commit advanced HEAD under this session with both indexes read and agreed
across the window, nothing of either side swept, and this session's six dirty
files riding untouched on top.

**Live dispatches.** None. Two enumerators, one implementer and three review
lenses all returned within this boundary.

**Gate baseline.** Targeted lane re-run by this session rather than taken from a
report: 27 pass, 0 fail, exit 0 read from the run's own exit code, against a
26-test baseline, the added test being the round's new pin. Whole gate as run by
the implementer: 1,884 tests, 1,881 pass, 1 fail, 2 skipped, exit 1, 223 s, a
delta of one test and one pass against the 1,883 / 1,880 / 1 / 2 baseline at
`fb0f194` with the same single known machine-specific path-length red. The
section has still taken no close gate of this session's own.

**The ruling that changed the instrument.** The consult was asked whether the fix
loop was the right instrument and told to test the framing rather than ratify it.
It ruled that the sweep dominates, and sharpened why: not that rounds sample in
general, but that both defect classes are closed and mechanically enumerable from
schemas the contracts themselves state, which is the specific condition under
which enumeration beats iteration. It named the yield trajectory as the
discriminator, three Majors at round 6 against roughly seven at round 8, since a
converging process shows declining yield while a fixed population under sampling
shows steady-to-rising yield as reviewers learn the class. It refused three of the
four alternatives put to it, declined to let an eleventh amendment be written on
the ground that the amendment layer had two demonstrated failures at holding
sweep obligations, and set a falsifiable stopping rule rather than a feel.

**Rulings adopted since the last boundary.**

1. *The section closes on an enumeration that survives falsification, never on a
   quiet round.* The stopping rule adopted: the section closes when one full
   review round returns zero findings that add a row to either table. A
   post-sweep round returning an in-class Major repairs the table first, then the
   text, and one more round runs. Two consecutive post-sweep rounds each
   returning in-class Majors falsifies the enumeration diagnosis itself, and the
   question goes to the operator as a design question about the medium.
2. *The eight prior rounds are a labeled validation set, and the enumeration is
   checked against it before it is trusted.* The confirmed instances of boards 3
   through 9 were written down as a control before the tables landed, and the
   enumerators were briefed on none of it, an enumerator anchored on prior
   findings reproducing the sampling disease inside the sweep. The control
   discriminated exactly as intended between two failures that look alike from
   outside: the enumeration missing an instance, which would require re-running
   it, and the enumeration containing the instance while rating it wrong, which
   needs only a re-rating pass. Both tables passed on rows and failed on ratings.
3. *A rating rubric that lets a general clause elsewhere count as a screen
   records defects as ambiguities.* Class A's first pass returned zero rows rated
   a defect across 78 rows, against a validation set holding confirmed unfixed
   ones. The repair was to the rubric rather than the enumeration: a screen counts
   only where the reading site's own paragraph names it as applying to that field,
   and a general clause inferred to reach it is itself the defect. Re-rated, the
   same unchanged row set returned six column-four defects.
4. *A hostile-value disposition is derived from the act's harm direction, never
   from the field.* The first pass evaluated every hostile case in the direction
   that preserves the artifact, which is why a destructive act's fail-open went
   unseen. Re-rated on the direction that licenses the act, and split into three
   cases per row rather than one, the table returned 22 rows whose absent and
   unresolvable branches are fail-closed while the hostile-but-well-formed branch
   is fail-open, and 22 decision legs a single forged value satisfies by
   construction. The shape matters because a contract reads defended to anyone
   checking only the absent branch.
5. *Warrant strength and routed act are two enumerations, and strength alone is
   blind to the higher-yield one.* Class B's first pass rated each site on the
   strength of the warrant it states and nothing on what it then routes to, so a
   site read correct on strength while a sentence seven sentences downstream in
   its own paragraph still routed on the retired reading. A routed-act column was
   added across all 158 sites.
6. *The fix round's repairs were the honest three rather than a manufactured
   guarantee.* There is no authentication anywhere in this design and the
   contracts say so deliberately, so a fail-open is repaired by naming a screen
   at the point of use, by stating the absence with its bound in the contract's
   own idiom, or by giving the hostile case a licensed reading that never
   destroys. All three review lenses were told that asserting a guarantee the
   design cannot deliver is worse than leaving the gap, and each walked the
   stated absences for exactly that cheat; the adversarial and security lenses
   both reported the bounds genuine.
7. *The tables are falsified, which is the round working rather than the round
   failing.* The review round returned reads and warrants absent from both
   tables. The precedence warrant is the sharpest omission, resting on ten sites
   and absent from the warrant table entirely, which matters because Section 4's
   own fold history turned on it: a ruling implemented only in the losing file is
   not implemented. The coordinator's release-adjudication paragraph appears under
   no warrant at all. Also absent: the probe answer's renewal act, by which a
   session wearing a claimant's name renews a dead claim indefinitely with no
   operator report; the board's own pass evidence time, which gates a recovery
   read and whose forged-future branch silently narrows the dead-worker backstop;
   and the kaizen landing, a re-disclosure act that folds peer-written text into
   a public repository with the disclosure direction unexamined.
8. *A never-poll carve-out was repaired at one sentence and a broader sibling
   kept the retired scope.* The claim probe was carved out by name from the
   status round's never-poll sentence, while a second sentence covering other
   machines' sessions reads broader and took no carve-out, so a claim whose name
   resolves only to a foreign-machine row is unprobeable, which is precisely the
   state the first repair exists to prevent. This is the same warrant-sibling
   class the validation set already held, recurring at a new sentence, and it is
   the reason the stopping rule is stated on table growth rather than on severity.
9. *The instrument that decides a dispatch is dead was itself broken, and the
   check now carries a control.* The first-turn reading taken at the path the
   dispatch tool returns reported zero assistant lines and zero synthetic for
   two healthy agents, the never-started shape exactly. A positive control run
   against a dispatch known to have completed returned the same zero, proving the
   path rather than the agents. The real transcript lives beside the session's
   own record, the reading is taken there, and it now always runs a control,
   because a wrong path and a dead agent are indistinguishable without one. Banked
   to project memory, since a false never-started licenses killing working agents.

**Next action.** The tables are repaired first and the text second, per the
stopping rule's own ordering, then one more review round. This is post-sweep
round one of the two the rule allows: if the next round also returns in-class
Majors, the diagnosis is falsified by its own terms and the medium question goes
to the operator rather than into another round. Then the close gate on a quiet
box, then Chapter 4.

### Interim board 11 - 2026-08-28

The stopping rule fired. Post-sweep review round two returned in-class Majors, as
round one did, so by the rule's own terms the enumeration diagnosis is falsified
and the medium question goes to the operator rather than into another round. The
section is open, the tables are repaired, the text repair the tables drove has
landed, and what is now in front of the operator is a design question rather than
a defect list.

**In-flight sections.** Section 4 only. Sections 1, 2 and 3 closed at `77462a5`,
`ebf5ee0` and `fb0f194`; 5 through 10 not started. Base is `2794710`, this
session's own; no peer commit landed inside this boundary.

**Live dispatches.** None. Two table-repair implementers, one fix implementer and
three review lenses all returned within this boundary, each read on a first-turn
count taken beside a positive control.

**Gate baseline.** Targeted lane re-run by this session rather than taken from a
report: 27 pass, 0 fail, exit 0 read from the run's own exit code, unchanged
against the 27-test baseline the last boundary recorded. No whole gate and no
close gate of this session's own since that boundary.

**Rulings adopted since the last boundary.**

1. *The tables were repaired first and the text second, and the ordering earned
   itself.* Both enumerations were falsified rather than merely extended. Class A
   went from 78 rows across 14 artifacts to 90 across 15; Class B from 29
   warrants and 158 site cells to 33 and 221. One reported gap was refuted on its
   evidence, the branch tip's screen being the every-category board bar rather
   than the appositive-scoped one the finding named, and one was confirmed larger
   than reported, the claim file's disclosure sentence dispositioning two of five
   fields rather than four of five. A round that could only confirm would not be
   a falsification.
2. *The precedence warrant rests on twenty sites, not the ten the round reported,
   and it was absent from the warrant table entirely.* That is the warrant this
   section's own fold history turned on, a ruling implemented only in the losing
   file being not implemented, and the enumeration built to catch that class did
   not carry it. The table now does.
3. *A repair may overclaim in the direction of candour, and one did.* The fix
   round wrote that a single forged board line satisfies both release legs by
   construction. The blind lens established that the second leg also requires a
   live roster reading taken at the releasing pass, which no board text supplies,
   so the true statement is that the forged line carries the first leg and the
   banked half of the second. The sentence then retires both legs' own tests on
   the strength of the overstatement. Recorded because the honesty bar cuts both
   ways: a stated absence wider than the real one is as wrong as a guarantee
   narrower than the real gap, and only the second is usually looked for.
4. *One prose clause states the compaction gate's condition backwards, against
   the shipped code.* The runbook says the hands-on leg bites a seat only where a
   `/loop` drives the watch. The gate returns allow on automation before the
   boundary marker is ever read, so the leg bites where no `/loop` drives it,
   which is the seat's ordinary state. The clause contradicts its own next
   sentence and the file it names as governing. Confirmed at the gate source by
   this session rather than taken from the lens.
5. *A contract names a writer the kit does not ship.* The registry heartbeat is
   presented as stamped by a stop hook that does not exist, Section 5 being the
   section that creates it, so the prune the contract grants is reachable today
   only by a hand-written stamp. One file states that reach honestly and the
   owning contract does not, which is the losing-file pattern again, now running
   in the direction that leaves the contract overclaiming.
6. *The claim protocol's duration anchor has no durable home.* A first-seen time
   for a future or unparseable `Started:` lives in loop context until a probe
   line banks it, and the probe is sent only after the bound elapses, while the
   same runbook states that nothing load-bearing lives in loop context. A claim
   dated far enough ahead is therefore never probed and never released.
7. *The stopping rule is honoured rather than reinterpreted.* Two consecutive
   post-sweep rounds returned in-class Majors, which is the condition the rule
   names, and the rule's consequence is an operator question about the medium
   rather than a third round. Adopting a falsifiable rule and then explaining
   away its trigger is the failure the rule exists to prevent, so it is recorded
   as fired here before any argument about what to do next is made.

**Next action.** The two Criticals are never parked and are fixed whatever the
medium question's answer, since neither turns on it. The pre-declaration expert
ask goes to this repo's expert seat and the consult convenes on the framing, per
the blocker path; the declaration that follows carries the ruling. Then the close
gate on a quiet box, then Chapter 4.

### Interim board 12 - 2026-08-28

The stopping rule's trigger was honoured and the conclusion drawn from it was
wrong. Board 11 recorded the rule as fired and named the medium as the question
to send up. An expert ask and a fresh consult, run in that order, both refuted
that framing on evidence this session then verified by its own hand. The medium
was never the variable. What goes to the operator is one narrow risk-appetite
fork about two destructive acts, and the section's remaining work is now defined
against a repaired instrument rather than against another round.

**In-flight sections.** Section 4 only. Sections 1, 2 and 3 closed at `77462a5`,
`ebf5ee0` and `fb0f194`; 5 through 10 not started.

**Live dispatches.** None. One consult returned within this boundary.

**Gate baseline.** Targeted lane re-run by this session after each fix batch: 27
pass, 0 fail, exit 0 read from the run's own exit code, unchanged against the
27-test baseline. The banned-punctuation gate reads zero across all five payload
files with a control returning one, so the silence is a refusal rather than a
pattern that cannot speak.

**Rulings adopted since the last boundary.**

1. *The medium question is withdrawn, and it was already decided.* The repo's
   expert seat answered the pre-declaration ask inside minutes, and every
   citation it gave was verified here rather than taken on its word. Prose as
   the contract medium is decided and its ceiling is stated in words: an
   authorization section "narrows an honest writer without authenticating one",
   which `peer-sessions/SKILL.md:35` carries in this worktree's own copy, and
   `docs/security-model.md` records the same acceptance mechanically at `:234`
   and `:270`. The reason the kit chose prose here is recorded in this plan's
   own Section 3 paragraph at `:141`: guarding the directory on the memory
   tiers' terms would refuse the contract's own writer classes, and a
   shape-checking guard would need a schema this contract does not state plus a
   carve-out per writer class, "each carve-out re-admitting the accident it
   exists to stop". Neither queued plan behind this one rules on the medium;
   both were read here and both assume it.
2. *The kit's decided line is accident inside a priced perimeter for prose, and
   structural where a duty must fire.* This is the expert's synthesis, marked by
   the sender as its inference and adopted here on the evidence rather than on
   the claim: Fork 2 of this plan at `:65` moved the goalless-seat boundary from
   prose to a hook precisely because "the two journals hold zero role-boundary
   allows" and "the boundary should be structural". So the question a Class A
   site raises is never prose-versus-not, which is settled, but whether that
   site crosses from accident to adversary or from stated to must-fire.
3. *Both enumeration tables encode a one-directional harm model, and that is why
   two rounds could not close the class.* The consult found it and this session
   confirmed both rubric texts at the artifacts. Class A's column-5 rule reads
   "the harmful direction chosen from the act (destructive act: the value that
   makes it fire)"; Class B's W2 reads "every ambiguous reading resolves in the
   non-destructive direction". Neither prices a destructive act that never
   fires. For a lease over the machine's one heavy-process slot that is the
   primary harm, and `role/SKILL.md:53` says so in its own words, "a declaration
   honoured unbounded is the phantom hold with a longer arm". So the section's
   contract knew a harm direction its two review instruments structurally could
   not see.
4. *The instrument converted this round's Critical into a pass, in writing.* The
   Class A row for `Started:` rates the exact site of the confirmed security
   Critical as a screen at its point of use, fail-closed, "never hastens", and
   the Class B row for the same paragraph rates its warrant as already matching.
   Never-hastens is the failure for this act. A rating rubric that cannot
   express the harm records the defect as a pass, which is the same failure mode
   board 10 ruling 3 already found once in the screen rubric and did not
   generalise.
5. *A stable defect count under total population turnover is a fixed-budget
   detector, and this run wrote that tell down without reading it.* The Class A
   table's own summary reads "The defect count is therefore unchanged at six and
   the population is entirely different, which is what the round bought". Six
   before and six after with no overlap is the signature of a detector spending
   a fixed budget, never of a population that is failing to converge. The
   inference from "the enumeration is not closing the class" to "the medium
   cannot hold this" is the error, and it is recorded as this session's rather
   than the rule's.
6. *The residual population is mostly neither class, so no repair to either
   table would have reached it.* Of round 2's Criticals and Majors, six are a
   different kind of thing entirely: prose contradicting shipped code, a forward
   reference to machinery no build ships, a constant disagreeing with a stated
   cadence, a missing protocol branch, and a guard predicate that excludes the
   case its own sentence enumerates. No medium fixes a forward reference to a
   hook that does not exist.
7. *The stopping rule's predicate is replaced rather than relaxed.* It counted
   in-class Majors, which measures the detector's budget rather than the
   population. It now counts findings the state model has no cell for: a round
   returning only cell-fillers is convergence, and a round returning an
   unrepresentable finding is the real falsification signal. Replacing a
   predicate that fired correctly is not explaining away its trigger, because
   the trigger is accepted and the conclusion drawn from it is what is retired.
8. *Both Criticals are fixed, and one of the fixes created a sibling defect this
   round caught rather than the next.* The compaction-gate clause at
   `coordinator/SKILL.md:53` stated the gate's condition backwards; the gate
   allows on automation before it ever reads the marker, so the marker matters
   where no `/loop` drives the watch, which is the seat's ordinary state. The
   claim-duration anchor at `role/SKILL.md:53` had no durable home, which
   re-instated by another road the exact reading its own sentence forbids; it is
   now banked as a told-not-derived board line and an un-bankable anchor is an
   operator report rather than a fresh anchor. Banking it added a sixth
   commitment category, and the board's two enumerations of that set did not
   carry it, which is the warrant-sibling class arriving inside the repair
   itself. Both enumerations were extended in the same round.
9. *Three further code-confirmed defects are repaired on the same terms.* The
   claim write now states that naming a contention and proceeding never includes
   writing the claim, there being one claim file and one holder. The registry
   prune now states what its bound costs where nothing stamps the heartbeat: the
   exited verdict is unreachable, no entry is ever pruned, and the registry
   accretes, which is the correct direction stated rather than left to be met at
   a pass. And the boundary marker's age bound is stated against this seat's own
   cadence, the bound being far the shorter, so a seat is markerless for most of
   the interval and a compaction offered there rides to the safety ceiling.

**The one fork that survives, and it is the operator's.** Section 4's claim lease
depends on machinery Section 5 ships, and no coordinator seat has yet run a real
reconciliation pass against this protocol. The question is whether the two
destructive acts, the release of a foreign heavy-process claim and the prune of a
foreign registry entry, ship armed or stated-but-disarmed until that machinery
exists and one real pass has been observed. It is risk appetite rather than fact,
which is why it is the only thing that goes up. The disarmed path is already
written in both files as the untracked-hold report.

**Next action.** The declaration carries that fork. Held behind it is the repair
of the instrument itself: one state model keyed on claim state, transition, and
both harm directions, moved out of scratch into shipped payload and pinned in the
suite, which is the mechanical leg ruling 2's line prescribes and the thing that
would have caught this round's Critical. Its most defect-dense half is the two
transitions the fork governs, so it is built once the fork is answered rather
than built twice. Then the close gate on a quiet box, then Chapter 4.

### Operator ruling on the Section 4 fork - 2026-08-28

Ruled by the operator at the keyboard of this repo's expert session, mirrored
on that session's account-allowlisted relay thread, recorded here by reference
per Amendment 4: the coordinator's release of a foreign heavy-process claim
and its prune of a foreign registry entry ship ARMED in Section 4. This
supersedes the disarmed recommendation board 12 records from both the worker
and the expert, and it supersedes on new fact rather than on preference: the
manual clearing path the disarmed option priced as the fallback does not
exist on this fleet, because the operator does not operate the VMs directly
and the coordinator seat is the operator's hands on the machine, so a
disarmed release leaves a phantom hold with no one positioned to clear it.
The exposure window is bounded on the operator's own read: Section 5's
machinery is expected within hours, and no fleet install is expected between
the sections, so the armed text is unlikely to reach an installed payload
ahead of the probe fabric that grounds it. The receiving session performs its
own trace of this record per the peer-sessions rule; the relay thread is the
operator's audit surface for it.

### Chapter 4 - 2026-08-28

Completed: 4. Reconciliation becomes a diff, and the status round becomes the residue (element D and Fork 3)
Implemented By: implementer-opus (build), implementer-opus (three fix rounds), implementer-opus (the enumeration fix round). Two enumerators built the defect tables; three review lenses ran each round, the security lens at opus with effort max through the Workflow route. One consultant ruled at the round-8 boundary and a second at the round-11 boundary. The Criticals, the security Majors and every plan-doc write ran inline in the main thread. One escalation, ruled by the operator.
Metrics: review rounds 11 plus two post-sweep rounds; interim boards 3 through 12; consults 2; escalations 1; enumeration tables 2, both falsified and both extended.
Gate: whole gate run by this session over the settled tree and read from the run's own exit code: 1,893 tests, 1,890 pass, 1 fail, 2 skipped, exit 1, 245 s. Delta against this session's own 1,884 / 1,881 / 1 / 2 baseline is nine added tests, all green, with the same single known machine-specific path-length red at `test/memory-session.test.js:854`. The nine come from the memq plan's Section 1 running concurrently in this tree, not from this section, which adds no test. Box configuration at the run: 16 GB physical, 4 logical processors, two in-process agents resident. The configuration is recorded because this machine dropped from 20 GB tonight, so counts stay comparable against earlier baselines and durations do not.

Decisions / Surprises:

- **The operator ruled the section's one escalated fork, and it superseded both seats' recommendation on new fact rather than on preference.** The coordinator's release of a foreign heavy-process claim and its prune of a foreign registry entry ship armed. The worker and the expert had independently recommended disarmed, and the record at the ruling above states why that lost. What is worth adding here as this round's own account is the mechanism of the error, because it is reusable: both recommendations priced the disarmed failure as one bounded operator report, and that pricing silently assumed an operator positioned to act on the report. He is not on the VMs and the coordinator seat is his hands on the machine, so the disarmed failure is not a bounded report at all but an indefinite hold with nobody able to clear it. The recommendation was not overruled, it was refuted: an option's cost was computed against a fallback that does not exist on this fleet. A recommendation that names its fallback names a thing that can be checked, and this one was never checked.
- **The section's review method was replaced once and then diagnosed as still wrong, and the second diagnosis was the right one.** Eight rounds sampled the section and kept finding new instances of two defect classes with rising rather than falling yield. A consult ruled the loop was the wrong instrument and set an exhaustive two-table enumeration with a falsifiable stopping rule. Two post-sweep rounds then returned in-class Majors, which is that rule's own falsification trigger, and it was recorded as fired before any argument about what to do next.
- **The conclusion drawn from that trigger was wrong, and the correction is the section's most transferable finding.** The trigger established that the enumeration was not closing the class. This session inferred from it that prose could not hold these contracts and escalated the medium as an operator question. Both instruments sent to test that framing refuted it. The medium was decided long ago and its ceiling is stated in words in `docs/security-model.md` and in this plan's own Section 3. The actual cause is that both enumeration tables encode a one-directional harm model in writing: Class A prices the harmful direction as the value that makes a destructive act fire, Class B resolves every ambiguity in the non-destructive direction, and neither prices a destructive act that never fires. For a lease over the machine's one heavy-process slot that is the primary harm, which `role/SKILL.md` names in its own words as the phantom hold with a longer arm. So both tables rated the exact site of this round's confirmed security Critical as fail-closed, never hastens, which for that act is the failure rather than the defence. Two rounds could not close the class because one instrument with a documented blind spot ran twice.
- **The tell was already written down in this run's own artifact and was read as a result rather than as a signal.** The Class A table's summary records the defect count unchanged at six with the population entirely different. A stable count under total population turnover is the signature of a detector spending a fixed budget, never of a population failing to converge. The stopping rule's predicate is replaced accordingly: it now counts findings the state model has no cell for, so a round of cell-fillers is convergence and an unrepresentable finding is real falsification.
- **A repair to a Critical produced a fresh instance of the section's own recurring defect class, inside the same round.** Banking the claim-duration anchor as a board line added a sixth commitment category, and the board's two enumerations of that category set did not carry it. That is the warrant-sibling class arriving in the fix rather than in the text being fixed, and it was caught and repaired in the same round only because the round re-read the whole file rather than the diff. It is the strongest evidence available that the class is live in this section's edits and not merely in its history.
- **Arming the two destructive acts raised the bar on findings that were about to be parked, and the standing rule decided it rather than a judgment call.** Round 2 left three security Majors open in exactly the two acts the ruling armed. A security Major is never parked past a section close, and arming makes each of them reachable rather than theoretical, so all three were repaired before the armed payload was committed: the probe line's send time now takes the same future, unparseable and absent readings the registry heartbeat takes, so a planted line cannot open a window that never elapses and hold the slot forever; the Admin inbox now states that no inbox line is the operator's request whatever it claims, the inbox not being on the warranted-channels list; and the registry entry's `Name:` and `Repo:` now take the readership route the claim file's own enumeration already gives them.
- **Two peer seats materially improved this section and neither was taken on its word.** The expert seat answered the pre-declaration ask inside minutes with four citations, every one of which was verified here at the artifact before adoption, and one of its negative claims was checked by reading both queued plans rather than accepting the assertion. The machine coordinator corroborated the containment claim on its own surfaces with its own positive control before briefing the operator. The record is stronger for the ruling having arrived independently on two warranted surfaces, the operator's relay thread in this session and the expert's own, rather than through a single relay.
- **What this section still owes, now unblocked by the ruling.** The instrument itself is unrepaired: one state model keyed on claim state, transition, and both harm directions, moved out of scratch into shipped payload and pinned in the suite. It is the mechanical leg the kit's own line prescribes wherever a duty must fire, and it is the thing that would have caught this section's Critical. It was held behind the fork because its densest half is the two transitions the fork governs; that hold is now released.

Next: 5. The boundary becomes structural, and the marker survives the gap (Forks 1 and 2, folding the consent ergonomics backlog entry). It carries the seat-stop hook, which is the machinery the armed acts rest on and which the operator's own bounding of the exposure window turns on.
