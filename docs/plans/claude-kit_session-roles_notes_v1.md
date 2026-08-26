# Session Roles: Notes for the Design Dialogue

Status: Notes (non-executable; no Sections of Work, no Commit Model, by design)
Created: 2026-08-25

The fact base and open questions for a deeper design conversation about session roles in the multi-session mesh, written at the operator's request ahead of a deliberate compaction so the dialogue resumes from this document rather than from summarized context. The reader is the post-compaction session (or any session joining the design conversation).

## The proposal (the operator's, verbatim in substance)

Define Roles per repo and/or machine. At least: an **organizer/coordinator** (a session that orchestrates), a **worker** for a particular repo, and an **expert**. The split largely follows model: Fable should always be the expert or organizer/coordinator; Opus or Sonnet can be workers.

## The position taken so far (open to revision in the dialogue)

- The 2026-08-25 experiment ran this taxonomy without declaring it: one Fable organizer (the kit session), Opus workers (the kit executor, the channels executor), a Fable expert seat per repo (the channels planner called itself "holding the coordinator seat"; the kit session served as the kit's expert for an AI-OS consult). Codifying names what proved itself.
- **A role is a mandate shape plus etiquette defaults, never a privilege.** Session names are free text, so a role that grants anything makes self-declaration a privilege escalation. Authority stays entirely on the dispatch-authority rail (artifact grants plus operator confirmations over warranted channels). What a role legitimately changes: which messages a session answers now versus at boundaries, what it hands up, whether it holds a board.
- **The registry already exists in miniature:** the `PROJECT: Role` naming convention makes `ListAgents` the minimal role directory. The durable registry, if names prove insufficient (they are context-mortal and unverified), is the parked coordination-spine ledger.
- **Organizer and expert are seats, not sessions.** One session held both in the experiment. One Fable session per repo covering both seats is the economical shape; split only when board work crowds out consulting.
- **The model split is already doctrine** (Fable-led sessions design; execution models execute), independently re-derived by the mesh, which is the strongest signal it is right.

## Open questions for the deeper dialogue

1. Vocabulary: are organizer, worker, expert complete? Candidates observed but unnamed: a relay/communications seat (this session's role during the fleet poll), a standing-watch seat (the standing-watch skill's babysitter), the AI-OS Warden as an organ-shaped role. Does coordinator differ from organizer?
2. Declaration mechanism: name-only (cheap, unverified), a goal-state field (arm-time, durable per run), or the coordination-spine ledger (durable, machine-wide)? What happens when a name lies or goes stale?
3. Which peer-sessions etiquette rules parameterize by role, and what are each role's defaults (interrupt thresholds, reply timing, board obligations)?
4. Model-role binding: guidance or enforced? What is the rule when a Fable session must execute (current answer: hand off) or a worker must adjudicate (current answer: escalate)? Who checks?
5. Cardinality: one organizer per machine, per repo, or per effort? How does the organizer seat hand off between sessions (the context-mortal standing-grant problem generalized)?
6. Expert seats: standing warm sessions per repo (cost: machine slots and attention) versus on-demand consultation? The experiment's warm consults were high-value; would a cold expert have served?
7. Cross-repo dispatch: the channels repo's Fable planner dispatched its own repo's Opus executor successfully; formalize organizer-dispatches-within-repo versus organizer-of-organizers across repos? Where does the Fable-on-/loop coordinator sit relative to per-repo organizers?
8. The engine boundary: engine-spawned workers are unmessageable by design; roles apply to the interactive mesh only. Does the role vocabulary need to say so, and does the Warden's organ model (argues, never rules; schema-separated recommendation versus ruling) inform the organizer's shape?
9. Failure modes: what does a wrong role claim cost, who notices a role-less session, and is there a role-audit surface (the fleet poll was manual; the coordinator design would make it periodic)?

## The experiment's evidence inventory (pointers, all durable)

- The shipped skill: `plugins/claude-kit/skills/peer-sessions/SKILL.md` (standing rule, record rule, four patterns, etiquette, delivery honesty; hardened by its executor: harness-delivered-only standing, subagent carve-outs).
- The dispatch-authority spec: `docs/plans/claude-kit_dispatch-authority_spec_v1.md` (artifact-borne authority, `--append`, arm-on-receipt on the receiver's tree, receiver ack and boundary re-check, shared-checkout detection; armed second on the kit executor's leash).
- The kaizen batch: `docs/plans/claude-kit_kaizen-batch_spec_v1.md` (executing; grew 7 to 10 sections as recorded drift).
- The kaizen inbox: 7 pending notes in `kaizen/notes-SCOTT-CLAUDE.md`, all from the experiment (authority-collision and holding state, channel-guard single-sourcing, the where-rots-silently anchor lesson, gate-numbers-belong-to-trees, the roles proposal itself, broker fleet-freeze detection, plus the discord-routed one).
- Backlog: the three-repo comparative retrospective (signal: all efforts Complete), coordination-spine (signal: coordinator brainstorm), both in `docs/backlog.md`.
- Operator memory: `usage-pause-survives-a-cswap-account-switch` (the frozen-fleet trap and the Escape cure).
- The archived first plan: `docs/archive/claude-kit_peer-sessions-skill_spec_v1.md` with its Chapters.
- Journal: `memq get kit.mesh.peer-experiment` for the one-line outcome record.

## Board as of writing (staleness expected; verify by poll, not by this list)

Kit executor ("KIT: Shared Messages"): kaizen batch late sections plus finishing, then dispatch-authority, one leash, its worktree. Kit sibling ("KIT: Opus Updates"): memory-anchors mid-run, then verification-artifacts, main checkout. AI-OS ("AI-OS: Opus Plans"): Work Board final section, then Operator Window (merge-gated on security-model steering verbs), then spawn-surface pinning. Channels ("CHANNEL: Fable" planner/coordinator seat, "CHANNEL: Opus" executor): two-plan queue, was blocked on the broker orphan (operator action; likely cleared, unverified). Standing grants: the operator's groom-to-spec-to-handoff pipeline authorization to this session; the executor's arm-anything-from-this-session grant (its project memory).

## The operator's second pass (2026-08-25, extracted from a relay brain-dump)

- **Roles are for coordination, not obligation.** Not rigid, not locks on the session; seats taken "at the time" and shared so others can coordinate against them.
- **The contention theory: a role is a stewardship claim on a function-times-resource pair.** The failures roles prevent are concurrent stewardship: two sessions deciding what work should be done, two sessions writing code in one tree. Coordinate a role AND a resource (a repo, a function within it).
- **The mesh's whole value, in the operator's words:** multiple sessions holding warm, separate context with live knowledge, communicating to coordinate, "allows us to load a whole lot more information in at once and coordinate how it all gets done." Roles are the partition map of that loaded knowledge: knowing who holds what means asking instead of loading.
- **The slate grows to four: coordinator, expert, worker, admin.** Examples given: a Fable session in a root repo is the facilitator/organizer taking information in; a Fable session over the kit is the kit expert, receiving and logging friction from every other session; an Opus or Sonnet session in the kit is a worker receiving dispatched plans and monitored to completion; and an admin is a session running with administrator privileges for machine-wide management, such as the elevated broker repair that blocked two plans for hours, unblocking sessions that need elevation.
- **The requirement:** the ability to specify, infer, or declare the role being taken, so it is coordinated across sessions; each session understands its expected role at the time and shares it; the coordination lines get drawn explicitly.

## Working synthesis after the second pass (positions, not settled)

- Role stewardship is semantic concurrency control: the planning-level fix for every mechanical collision the experiment hit (the swept index, the backlog races, the same-worktree HEAD moves). The git discipline patches collisions; role claims prevent them.
- Per-role stewardship and exclusivity: a **coordinator** stewards the work-decision function (backlog, priorities, dispatch) and is exclusive per scope; a **worker** stewards mutation of a tree and is exclusive per checkout/worktree (AI-OS's tree lease is the prior art); an **expert** stewards knowledge of a resource and is a service role where exclusivity is economics rather than safety; an **admin** stewards machine state, exclusive per machine, and is the one role that IS about privilege, so its mandate must be the narrowest: an operator-blessed runbook allowlist, every action reported to the operator thread, never repo work. The permission-laundering boundary is the admin role's central design problem: the legitimate version is distinguished by authorization provenance (the dispatch-authority rail) and by acting on machine state rather than doing work a session was denied.
- Declaration in three layers, adopted in order of need: the session NAME advertises (ListAgents as directory, zero infrastructure); a contact-time HANDSHAKE confirms (the peer-sessions who-you-are line becomes a role declaration); the coordination-spine LEDGER makes it durable when names and handshakes prove insufficient at scale.
- Scope shape implied by the operator's examples: coordinator is machine- or portfolio-scoped (the root-repo seat); experts are repo-scoped; workers are checkout-scoped; admin is machine-scoped.

## The operator's third pass (2026-08-25, extracted)

- The four roles are offhand, not a finalized list; the real object is the underlying decomposition into seams, the specific sub-areas of ownership and exclusivity.
- The coordinator decomposes into two seams. One faces the operator: a project-manager session that simplifies his communication with the machine as a whole, gathers status (by involvement or by polling), and protects his attention, which is the scaling constraint. The other coordinates the work itself: deciding and sequencing, writing and structuring plans, which arguably belongs to an expert session.
- The hard open question in his words: with a worker and an expert per repo able to self-coordinate (his example: a worker's kaizen friction goes to the kit expert, who validates it, writes the plan, and hands it to the worker), is a separate oversight session necessary at all, or should the expert own plan-writing and sequencing?
- Admin, with a new fact that changes the design frame: the whole installation is a sandbox with disarmed access and a separate GitHub identity, minimal blast radius by construction, deliberately built so the interior needs no fear. The sandbox is the perimeter and the restriction. His call: no allowlist; an open-ended admin session on the strongest frontier model, capable of adjudicating and performing any support action needed to fix workspaces, files, permissions, services.

## Adjudications and synthesis after the third pass

- **Admin allowlist: conceded on the new fact, out loud.** The allowlist recommendation was grounded in blast-radius control, and the sandbox perimeter is that control, held at the boundary where it is cheaper and stronger than interior restriction. Two residuals survive as design lines rather than restrictions, because they guard something the perimeter does not: (1) report-everything, every admin action lands on the operator thread, which is observability rather than permission; (2) the support-not-work mandate line, the admin fixes the environment (processes, permissions, services, workspaces) and never produces or bypasses work product, because the perimeter protects the world from the sandbox while this line protects the work from shortcut pressure, the review gates and merge discipline being exactly the inside-the-perimeter value an unrestricted fixer could erode.
- **Coordinator: the irreducible core is the seam between repos and toward the operator, not oversight within a repo.** The experiment ran the operator's own kaizen example (worker friction to expert to plan to worker) with no oversight seat and no loss; per-repo planning and sequencing belong to the repo's expert, riding the dispatch-authority rail for the handoffs. What no per-repo session can hold, and where a machine-wide coordinator earns its single seat: (1) the operator interface, one voice toward the operator, status aggregation, escalation routing, the fleet poll made periodic; (2) cross-repo dependency and portfolio sequencing (merge gates spanning plans, the three-repo retrospective trigger); (3) machine-resource arbitration, the one-heavy-process budget and suite-slot contention that the wall-clock kaizen notes prove nobody stewards today. Oversight is not necessary; interfacing is.
- Implied cardinality, consistent with the operator's examples: one machine-wide coordinator; one expert seat per repo (owning plan authorship and within-repo sequencing); workers per checkout; one admin per machine, open-mandate, report-everything.

## The operator's fourth pass (2026-08-25): approval, and the AI-OS convergence

The settled shape is approved ("that nails it") and the spec is authorized. His mapping of the shape onto AI-OS, banked for the combined-shape adjudication the three-repo retrospective owns: the Warden is what AI-OS calls the admin; Ask/Reach are the coordinator's operator-facing seam; the warm ops thread is shared across several roles rather than being one; spawned workers are the workers; and AI-OS has no expert, which he judges a gap worth filling with expert-style mechanics. His frame: the kit's mesh is more reactive and easier to restructure than AI-OS, so the two experiments teach each other and settle on a combined long-term shape. Executor assignment for the spec deliberately deferred ("we can figure out who should run it").

## Context boundaries for role seats (2026-08-26 dialogue, design sketch awaiting the operator's nod)

The problem, the operator's framing: a leashed worker compacts at chapter checkpoints and never runs away, but the goalless seats (coordinator, expert, admin) ride the hands-on deferral to the 800K ceiling and get force-compacted at arbitrary moments, invisibly to the operator, with the cache economics of a huge context making the post-compaction re-read expensive.

The design answer, one invariant generalizing the chapter boundary: **compact wherever context holds nothing the disk does not.** A chapter boundary is the worker's instance of banked-and-empty; each seat has its own: the coordinator at the end of a reconciliation pass with the ledger updated, board committed, and no interrupt in flight; the expert at a deliverable handoff (spec committed, blind-read adjudicated, dispatch acked) or a consult answered and banked; the admin at an action completed and reported. The pre-compaction ritual the operator and this session performed by hand on 2026-08-25 (bank the learnings durably, then compact) is this invariant executed manually; the design mechanizes it.

Mechanism: extend `kit-compact-checkpoint` with a goalless mode (a role-boundary marker, session-scoped, under `.kit/`), and teach the gate's hands-on leg to honor it before deferring to the ceiling. The seat opens the marker at every natural boundary as cheap routine; the harness only offers compaction past its threshold, so compaction lands at the first boundary after the offer begins, exactly the worker pattern without a goal. No new timer, no self-token-counting.

Security calculus, distinct from the operator-release note's: a self-declared EARLIER compaction is low-harm by construction, since the ceiling force-compaction is already the worst case and the gate's whole purpose is preventing mid-work landings; a session's own banked-and-empty declaration is the best available boundary signal, and leashed workers' checkpoints already extend exactly this trust. The operator-release path (the fd19940 kaizen note: a consent marker for a deferred compaction the operator wants now) is the same gate surface and should ship in the same spec.

Operator visibility rides along: the gate already journals verdicts to `.kit/compact-gate.jsonl`; a compaction event line to the coordinator's board or the relay makes resets legible without console-watching.

Scope if specced: gate code (the hands-on leg's marker check), checkpoint CLI goalless mode, tests red-first both directions, and prose amendments to the coordinator and peer-sessions role sections shipping in plan 3. Natural home: a fourth spec on the same leash, consuming the fd19940 note.

## Related

- `claude-kit_dispatch-authority_spec_v1.md` builds the authority rail roles must not duplicate.
- `claude-kit_coordinator-and-roles_spec_v1.md` is the executable spec this dialogue produced; this document is its intake and design record.
- [`claude-kit_compact-boundaries_spec_v1.md`](../archive/claude-kit_compact-boundaries_spec_v1.md) is the second executable spec this dialogue produced, taking the context-boundaries section into the compaction gate as a role seat's own boundary declaration and an operator release.
