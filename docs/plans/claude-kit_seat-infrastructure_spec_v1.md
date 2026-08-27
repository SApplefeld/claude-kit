# The seats run on artifacts, at the cheapest sufficient tier, and compact at their own boundaries

Status: Draft
Commit Model: Commit-and-Push
Created: 2026-08-27

**Design round settled 2026-08-27; full section briefs are the authoring seat's next pass, so this draft is not yet executable.** The operator accepted all six marked recommendations as binding proceeds, with one clarification on Fork 3 and both named inputs answered; The settled round below is the record. The Draft status stays until the sections carry full briefs, keeping the plan out of the SessionStart resume inventory meanwhile; the kit's Ready-status work (the plan-lifecycle spec of this slate) will give the authored-and-parked state a proper name. Slate position: priority 2, decided by the operator 2026-08-27 (relayed by the machine coordinator; recorded here by reference, never by quotation, per the authorization-format convention).

Session model: Opus, in a clean session opened in the kit repo, once the briefs land. Authored by the KIT: Expert seat from the 2026-08-26 seat-coordination kaizen cluster plus the operator's 2026-08-27 cost addendum.

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
- **F. The `/role` skill.** One command runs the takeover: check the session already carries the machine-form seat name and stop with the exact launch invocation when it does not (the launch alias owns the name, since a rename cannot follow the channels flag that bakes it into a relay thread); load the seat's runbook; resolve the home directory from the operator tier and ask where none is recorded; arm the seat's loop at the seat's cadence; read the ledger or inbox; write the registry entry; announce the takeover; open the boundary marker. `/role Admin` prepares and asks rather than self-authorizes, the arming staying the operator's act.
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

## Candidate Sections of Work

Skeleton with the round settled; the authoring seat's next pass turns each into a full briefed section (acceptance, Tests lines, exact anchors) and flips the header. Sequence: A before B (history), B before C-F (the directory must exist), the compaction work (Forks 1-2) parallel-safe with C-F, G last as prose.

1. The allowlist and drift reporting admit `coordinator/` (element A). Provisional: opus.
2. The board's home migration and the coordinator skill's home-repo, visibility, and push paragraphs (element B; folds the backlog's coordinator cold-start restructure, 2026-08-26, whose parity pins are re-derived red-then-green as that entry directs). Provisional: opus.
3. The registry, the claim file, and the `/role` skill (elements C, E, F). Provisional: fable, the skill being new cross-cutting behavior-shaping surface.
4. The push-status plumbing per Fork 3's resolution (element D plus the fork). Provisional: opus.
5. The compaction fixes per Forks 1-2, with the role-boundary test. Provisional: opus. Folds the backlog's `consent --project` ergonomics entry (2026-08-26), the cross-repo release being this cluster's own surface.
6. The Admin inbox and the elevated-seat documentation per Fork 5. Provisional: sonnet.
7. Seat-tier guidance per Fork 4, and report shape (element G). Provisional: sonnet.

## Out of Scope

- The operator's capacity and billing specifics. They shaped the priority and stay in the message layer; this repository is public and carries none of them.
- Real-time cross-machine coordination. The per-machine directory reaches every box through the store's own sync at sync cadence, and that is the designed scope.
- Verifying the cache TTL fleet-wide inside this plan. It is a named input above, taken per machine by whoever tunes that machine's cadence.
- The memq-hardening backlog items: parked by default 2026-08-27, no countermand; revisit at slate close.

## Related

- `docs/plans/claude-kit_testing-discipline_spec_v1.md`: slate priority 1, in execution; its box check composes with element E's claim file and neither plan touches the other's files.
- `docs/archive/claude-kit_compact-boundaries_spec_v1.md`: created the two release markers Forks 1-2 amend.
- `docs/archive/claude-kit_coordinator-and-roles_spec_v1.md`: created the seat vocabulary and the board this plan re-homes.
- `docs/plans/claude-kit_session-roles_notes_v1.md`: the design dialogue's fact base behind the seat vocabulary.
- `kaizen/notes-SCOTT-CLAUDE.md`, the seven 2026-08-26 seat-cluster notes: the origin, cleared into this draft at authoring.
- `docs/backlog.md`: the two folded entries (the `consent --project` flag, 2026-08-26; the coordinator cold-start restructure, 2026-08-26).

## Chapters
