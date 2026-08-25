# Session Roles and the Machine Coordinator

Status: In Progress
Commit Model: Commit-and-Push
Created: 2026-08-25

## Dispatch Authorization

Authorized by the operator, 2026-08-25, over the allowlisted relay ("You absolutely have my approval. Let's proceed and write that spec, and then we can figure out who should run it"). Any session holding this plan may arm and run it; the executor choice is deliberately open and the peer message delivering this plan carries a pointer, not the authority.

## Goal

Codify session roles as the mesh's coordination vocabulary and stand up the machine-coordinator seat as a skill. When this is done: the peer-sessions skill teaches roles as stewardship seams (an open set starting at coordinator, expert, worker, admin) with declaration, handshake, per-role etiquette defaults, and collision routing; a new `coordinator` skill carries the machine-wide seat's runbook (operator interface, cross-repo dependencies, machine-resource arbitration) on the standing-watch chassis with a committed ledger that survives session death; and the parked coordination-spine backlog item is consumed with this spec as its answer. The design source is `claude-kit_session-roles_notes_v1.md`, the banked four-pass dialogue; this spec turns its settled conclusions into shipped text and invents nothing beyond them.

## Approach

Execution shape: prose-only (no code sections, no new tests; the suite gate proves no collateral damage). The writing-skills skill governs every section; project memory `skill-amendments-collide-with-neighbours` applies (reviewers read whole files). Surface sweep: route (a), answered by this session's prior scout over the same surface class, current at head: adding a skill directory touches no manifest, build script, or test, and the README payload map is the one companion surface; the peer-sessions doctrine bullet already defers to the skill, so no doctrine copy changes and both parity tests must pass untouched.

The settled design (from the notes doc, restated here so sections build from this spec alone):

- **A role is a stewardship claim on a function-times-resource pair, for coordination, never a privilege.** Authority stays on the dispatch-authority rail; a role changes only mandate shape and etiquette defaults. Any session can name itself anything, so a claim confers nothing except legibility.
- **The starter seats and their exclusivity, an open set:** the **coordinator** stewards the seam between repos and toward the operator, one per machine, exclusive; the **expert** stewards a repo's knowledge and plan authorship (writes specs, sequences within-repo work, receives friction, answers warm consults), one seat per repo, exclusivity economic rather than safety-critical; the **worker** stewards mutation of one checkout, exclusive per tree, leashed, defers non-plan messages to boundaries and hands work requests up; the **admin** stewards machine state, one per machine, open mandate by the operator's sandbox-perimeter decision (the perimeter is the restriction; recorded with its reason), with two design lines that are not restrictions: every action reported to the operator thread, and support-not-work (fixes processes, permissions, services, workspaces; never produces or bypasses work product, because process integrity is inside-the-perimeter value the perimeter cannot protect).
- **Declaration in layers:** the session name advertises (`REPO: Role`, ListAgents as the directory); the first-contact handshake confirms (the peer-sessions who-you-are line gains the role and scope claim); the coordinator's ledger is the durable registry. A claim on an exclusive seam that collides with a standing claim routes to the coordinator, or to the operator where the coordinator seat is empty or party to the collision; never assumed resolved by silence.
- **The coordinator's three functions and only those:** (1) operator interface: one voice toward the operator, status aggregation (the fleet poll made periodic), escalation routing, decision asks batched with recommendations; (2) cross-repo dependency and portfolio sequencing: merge gates spanning plans, retrospective triggers, handoff brokering between repos; (3) machine-resource arbitration: the one-heavy-process budget, suite-slot contention, the shared-surface claims nobody stewards today. Oversight within a repo is explicitly not a coordinator function; the expert owns it.
- **The coordinator runs on the standing-watch chassis:** a wake-check-intervene-sleep loop (`/loop` or self-paced), each pass a reconciliation from durable state (roster, plan docs and their Status headers, `~/.claude/kit-events.jsonl`, the kaizen inboxes, its own ledger), with messages as interrupts only and nothing load-bearing held in loop context. It dispatches nothing directly: it writes specs and backlog entries, asks the operator to arm over a warranted channel, and hands artifact-authorized plans per dispatch-authority.
- **The ledger** is the seat's committed board in its home repo (`docs/coordinator-board.md` where the seat lives): the fleet roster with role claims, active efforts per repo with plan paths and anchors, pending handoffs with their protocol state (armed, holding-for-authority, deferred-pending-tree), standing operator grants quoted with dates (curing the context-mortality of conversation-held grants), machine-resource claims, and open operator escalations. Updated each pass; a successor session takes the seat by reading the ledger and announcing the takeover on the roster, which is the seat-handoff answer. This design is the coordination-spine backlog item's answer, generalized: any session holding cross-session commitments records them durably in its repo; the coordinator's ledger is the machine-wide instance.

## Sections of Work

### 1. Roles in the peer-sessions skill
Model: fable

Amend `plugins/claude-kit/skills/peer-sessions/SKILL.md` with a roles section carrying the design above: the stewardship definition and the never-a-privilege rule with its reason; the four starter seats with their scopes, exclusivity properties, and the admin's two design lines and recorded sandbox-perimeter rationale; declaration layers with the handshake amendment to the existing who-you-are etiquette line; per-role etiquette defaults (worker defers and hands up, expert answers consults, coordinator answers the operator immediately, admin acts on request and reports every action); and the collision routing rule. The section states the set is open and roles are seats taken at a time, not castes.
Acceptance: the section lands in the skill's voice; the existing rules and the who-you-are line are amended, not duplicated; no rule grants authority by role; both parity tests green untouched; `node --test test/*.test.js` matches the baseline captured before the first edit.
Files in scope: `plugins/claude-kit/skills/peer-sessions/SKILL.md`.

### 2. The coordinator skill
Model: fable

Create `plugins/claude-kit/skills/coordinator/SKILL.md`: the machine-coordinator seat's runbook on the standing-watch chassis, with frontmatter triggering on taking or resuming the coordinator seat, running a fleet loop, coordinating multiple sessions, and seat handoff. Content: the three functions and the explicit non-function (no within-repo oversight; the expert owns it); the reconciliation pass and its durable sources; the never-tasks-directly rule (specs, backlog entries, operator arm-requests over warranted channels, artifact-authorized handoffs per dispatch-authority); the ledger format and location with the seat-handoff procedure; the etiquette posture (answers the operator immediately, batches decision asks with recommendations, prices worker interrupts by the interrupt test); and the relationship to standing-watch (chassis) and dispatch-authority (rail), by pointer rather than restatement. Add the skill's one-line entry to the `README.md` payload map beside `peer-sessions/`.
Acceptance: the skill is self-contained for a fresh Fable session taking the seat cold (its first act is reading the ledger); every mechanism it names exists (standing-watch, dispatch-authority artifacts, kit-events, the relay) or is defined in the text; the README line lands in the map's style; suite matches baseline.
Files in scope: `plugins/claude-kit/skills/coordinator/SKILL.md` (new), `README.md`.

### 3. Library docs and the consumed backlog item
Model: opus
Locus: inline

`docs/architecture.md` gains the roles-and-coordinator paragraph where the peer-sessions surface is described (roles as coordination vocabulary, the coordinator seat and ledger, the admin's perimeter rationale in one sentence). `docs/backlog.md`: retire the coordination-needs-a-durable-spine item to the quarter snapshot with this spec's ledger design as the receipt (its stated signal, the first coordinator brainstorm, has fired). Inline because the docs-write-guard denies non-curator subagents writes under `docs/`.
Acceptance: current-state voice, no change-narrative; the backlog item moves to `docs/archive/backlog-2026-Q3.md` with the receipt naming this spec; suite matches baseline.
Files in scope: `docs/architecture.md`, `docs/backlog.md`, `docs/archive/backlog-2026-Q3.md`.

## Out of Scope

- Any code: the ledger is a convention this spec defines and the coordinator session maintains by hand; mechanical ledger tooling waits for evidence of need.
- The AI-OS convergence (warden/reach/expert mapping): banked in the notes doc for the three-repo retrospective; nothing here edits AI-OS.
- Standing up the actual coordinator or admin sessions: operator actions (starting sessions, elevation) after the skills ship.
- The kit-goal queue and worktree semantics: `claude-kit_dispatch-authority_spec_v1.md` owns them, already armed downstream.
- Doctrine copies and the output style: untouched; the existing peer-sessions bullet already defers to the skill.

## Assumptions

- assumed 2026-08-25 (source: the operator's relay approval quoted in the Dispatch Authorization section): the settled shape in the notes doc is the agreed sketch; reversal: a redirect reopens the design, and nothing is committed to code.
- assumed 2026-08-25 (default): Commit Model Commit-and-Push, the repo norm; reversal: edit the header before execution.
- assumed 2026-08-25 (source: the prior skill-surface scout, this session): adding a skill touches only the README map; reversal: the executor's suite gate catches any surface the assumption missed.
- assumed 2026-08-25 (source: operator's deferral "we can figure out who should run it"): executor unassigned at spec time; the Dispatch Authorization section covers any session, so assignment is a message, not an amendment.

## Operator Verification

- After the plugin update: a fresh session in any repo can read the coordinator skill and describe the seat's three functions and its ledger location; a session started as `REPO: Role` appears in ListAgents under that name. Either failing reopens the matching section.

## Open Questions

- None at spec time; the blind read may add entries.

## Chapters

