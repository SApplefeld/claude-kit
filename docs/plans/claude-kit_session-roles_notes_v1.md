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

## Related

- `claude-kit_dispatch-authority_spec_v1.md` builds the authority rail roles must not duplicate.
- The coordinator brainstorm (not yet a plan) is where these questions land as design; this document is its intake.
