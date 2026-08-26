# Compaction Boundaries for Role Seats, and the Operator's Release

Status: In Progress
Commit Model: Commit-and-Push
Created: 2026-08-26

## Dispatch Authorization

Authorized by the operator, 2026-08-26, at the keyboard ("Agreed, lets land that"). Any session holding this plan may arm and run it; the delivering message is a pointer, not the authority.

## Goal

Give goalless role sessions (coordinator, expert, admin) the same clean compaction landings leashed workers already have, and give the operator a deterministic release for a deferred compaction. Two release paths land on the compaction gate: a session-scoped role-boundary marker a goalless session opens at its own banked-and-empty moments, honored by the gate's hands-on leg ahead of the safety ceiling; and an operator-consent marker written only on the operator's explicit word, honored once for the session it names on any leg. When this is done, a long-resident role session compacts at the first natural boundary after the harness starts offering (roughly the 250K threshold) instead of riding to the 800K force-landing, the post-compaction re-read stays cache-cheap, every release is journaled with its reason, and the operator-release kaizen note is consumed with this spec as its record.

## Approach

Design source: the "Context boundaries for role seats" section of `docs/plans/claude-kit_session-roles_notes_v1.md` (the banked dialogue sketch), restated here so sections build from this spec alone.

**The invariant, which is the whole design: compact wherever context holds nothing the disk does not.** A chapter boundary is the leashed worker's instance (Chapter appended, commit landed, checkpoint open). The goalless seats have exact analogues: the coordinator at the end of a reconciliation pass with its ledger updated, board committed, and no interrupt in flight; the expert at a deliverable handoff (spec committed, blind read adjudicated, dispatch acked) or a consult answered and banked; the admin at an action completed and reported. The mechanism generalizes the worker pattern without a goal: the seat opens a boundary marker at every such moment as cheap routine, the harness only offers compaction past its threshold, so the compaction lands at the first boundary after offers begin, with no timer and no self-token-counting.

**Trust calculus, stated because the gate's design history demands it.** The gate takes no model input on its verdict legs because model-visible state is untrusted for preventing a HOSTILE landing. A self-declared earlier compaction is the opposite risk shape: the ceiling force-landing is already the worst case, the gate exists to prevent mid-work landings rather than compaction itself, a session's own banked-and-empty declaration is the best boundary signal available, and leashed workers' checkpoints already extend exactly this trust. The operator-consent marker is asserted rather than authenticated (single-principal machine, the AI-OS ceiling sentence), and the prose half of this spec binds when a session may write it: only on the operator's explicit instruction over a warranted channel (keyboard, allowlisted relay, dispatch-authority artifact), never on the session's own judgment.

**Mechanics settled at design time:**

- Both markers ride the existing `.kit/` checkpoint-state family, which the doctor's exposure probe already covers whole. The role-boundary marker records the opening session's id; the consent marker records the session it releases. Session identity: the gate reads `session_id` from its own hook payload (established), and the CLI derives the caller's id from the environment per the operator memory `claude-code-session-id-in-shell-env`, with the implementer verifying which variable the tool shell actually carries before trusting it; where no id is derivable, the CLI refuses to write a scoped marker rather than writing an unscoped one, and says so.
- The role-boundary marker takes a staleness bound (seed 30 minutes, a named constant tuned later on evidence like the store's other constants) so a marker from a dead boundary cannot land a compaction into later work; it is consumed on use, one allow per marker. The consent marker takes the same consumption and a longer bound (seed 4 hours, matching the deferral episode's idle bound), since an operator's word may precede the next offer by a while.
- The gate's verdict journal (`.kit/compact-gate.jsonl`) gains two reason values, `role-boundary` and `operator-consent`, so a run's compaction history states which release landed it. Operator visibility beyond the journal is prose-side (the coordinator's board and relay reporting), not gate code.
- Reader enumeration is required, per the dispatch-authority precedent: every reader of the checkpoint and gate state files (the gate, the checkpoint CLI's `status`, the doctor's `.kit/` probe and any state validation it performs, the chapter-boundary and deferral nudges if they read checkpoint state) is enumerated and verified to tolerate or surface the new marker kinds, each named with its disposition in the section report.
- Sequencing: this plan runs fourth on the executing session's leash, after `claude-kit_coordinator-and-roles_spec_v1.md`, so the coordinator skill and the peer-sessions roles section this spec amends exist before §2 opens.

## Sections of Work

### 1. The two release paths in the gate and checkpoint CLI
Model: fable

In `plugins/claude-kit/hooks/kit-compact-checkpoint.js`: a goalless boundary mode (open a session-scoped role-boundary marker with no armed goal required, refusing with the existing no-goal message only for the leashed mode; a consent mode writing the operator-release marker for the caller's session or an explicitly named one) with the id-derivation and refusal behavior from the Approach; `status` reports both marker kinds. In `plugins/claude-kit/hooks/kit-compact-gate.js`: the hands-on leg checks for a live, unconsumed, unstale role-boundary marker matching the offering session before deferring to the ceiling, and every leg checks the consent marker the same way; an allow consumes the marker and journals its reason value. Staleness bounds and consumption per the Approach. Enumerate every reader of the state files per the Approach and name each disposition in the section report. Also settle by reading the gate's code, and record in the section report: whether a manual keyboard /compact reaches the gate at all and how each leg treats it (currently inferred to pass from the gate's auto-offer scope; the consumed kaizen note flagged it for confirmation at exactly this moment). Dispatch the security-reviewer on this section (the gate is the surface that decides when context dies).
Acceptance: red-first tests in `test/kit-compact-gate.test.js` for both paths in both directions (marker present and offer pending allows with the right journaled reason; absent defers as today; stale does not allow; consumed does not allow twice; a consent naming another session does not release this one; the leashed legs' existing behavior is byte-unchanged where no new marker exists, pinned by the existing suite staying green); full suite matches the baseline captured before the first edit, expecting concurrent sessions' state in the shared checkout.
Files in scope: the two hooks, `test/kit-compact-gate.test.js`.
Tests: at minimum, lock that no new marker means no behavior change on any leg (the silent regression of the leash machinery is the expensive failure), and that neither marker ever releases a session it does not name.

### 2. The boundary ritual in the role skills
Model: opus

In `plugins/claude-kit/skills/coordinator/SKILL.md` (shipped by the coordinator-and-roles plan): the reconciliation pass ends by banking (ledger, board commit) and opening the boundary marker as routine, with the invariant sentence carried verbatim: compact wherever context holds nothing the disk does not. In `plugins/claude-kit/skills/peer-sessions/SKILL.md` roles section: each seat's named boundary moments (expert at deliverable handoff or banked consult; admin at completed-and-reported action), the same routine, and the operator-consent rule: the consent marker is written only on the operator's explicit instruction over a warranted channel, never on the session's own judgment, with the warranted-channel list already in the skill. Workers change nothing; their chapter checkpoint is already this invariant's instance, and the text says so in one sentence.
Acceptance: both amendments in the files' voice, whole-file reviewer reads per the standing collision memory; suite matches baseline.
Files in scope: the two skill files.

### 3. The library docs
Model: opus
Locus: inline

`docs/architecture.md`: the gate's description gains the two release paths and their reason values. `docs/security-model.md`: the trust-calculus paragraph (self-release earlier-is-low-harm with its reasoning; the consent marker asserted-not-authenticated with the write-rule that bounds it). Inline because the docs-write-guard denies non-curator subagents writes under `docs/`. Counts and only-sentences on the touched surfaces re-derived from the code after the final merge, per the integration-is-a-writer rule.
Acceptance: current-state voice; suite matches baseline.
Files in scope: `docs/architecture.md`, `docs/security-model.md`.

## Out of Scope

- Any change to leashed-worker behavior, the checkpoint's existing goal-bound modes, the safety valve, or the ceiling: the new paths are additive and the no-marker case is pinned byte-identical.
- Automatic boundary detection: the seat opens its marker deliberately; nothing infers a boundary from silence.
- The operator-side UX for granting consent remotely beyond what exists (relay instruction to a session, which then writes the marker under the prose rule); broker or harness changes are other repos' work.
- The pre-compaction banking ritual's content per seat: the skills name the moments; what to bank is each seat's own discipline, already taught by their sections.

## Assumptions

- assumed 2026-08-26 (source: the operator's "Agreed, lets land that" at the keyboard, and the banked sketch he approved): the notes-doc design is the agreed sketch; reversal: a redirect before execution costs nothing built.
- assumed 2026-08-26 (default): Commit Model Commit-and-Push, the repo norm; reversal: edit the header.
- assumed 2026-08-26 (source: `claude-code-session-id-in-shell-env` operator memory, unverified in this session's own tool shell): the CLI can derive the caller's session id from the environment; reversal is designed in, the CLI refusing scoped writes where it cannot, so a wrong assumption degrades loudly rather than silently.
- assumed 2026-08-26 (default): staleness seeds of 30 minutes (boundary) and 4 hours (consent); reversal: two named constants.

## Operator Verification

- After the plugin update, in a long-running goalless session: bank state, open the boundary marker, and observe the next auto-compaction land at that boundary with reason `role-boundary` in `.kit/compact-gate.jsonl`, instead of a ceiling landing. A mid-work landing or a ceiling ride with a live marker reopens §1.
- The consent path: instruct a session over the relay to release its deferred compaction, and observe the landing journaled as `operator-consent`. The Escape-at-console fallback remains unchanged.

## Open Questions

- None at spec time; the blind read may add entries.

## Chapters

