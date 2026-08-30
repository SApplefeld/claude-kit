# KIT: Messaging — Seat Handoff

Written 2026-08-26 for a deliberate session restart. The reader is the fresh session taking over this seat. Consume it, run the first moves, then archive it per curating-docs at the next natural close-out. This is a notes/handoff doc, not a plan: it has no sections of work and no leash.

## The seat

- Name yourself `KIT: Messaging` (the roster convention is `PROJECT: Role`). This is the Fable-led design and coordination seat for the kit repository. It does not execute plans; the executor sessions hold the leashes.
- Standing duties: answer executor questions over SendMessage; capture kaizen notes under the operator's standing grant (given 2026-08-26 at the operator's keyboard in this seat's session; it covers kaizen capture for this experiment, extending to items that apply to other repos; recorded here by reference per the public-repository convention, never by quotation); relay milestones to the operator; run fleet status rounds when the /loop is armed; hold dispatched handoffs open until an `armed` acknowledgment converts them.
- Load `claude-kit:peer-sessions` before reading the roster or messaging anyone, and `claude-kit:memory-system` before any memq write.

## First moves on wake

1. `memq recall` from the kit repository root.
2. `memq get kit.kaizen.pass` and `memq get kit.mesh.peer-experiment` — the round-by-round record of the peer experiment, the status rounds, and the open handoff.
3. `git fetch origin`. The shared main checkout runs well behind origin and a sibling session (KIT: Opus Updates) holds dirty files in it. Never pull, stage, or commit in this tree. Land any file via a temp worktree: `git worktree add --detach "$HOME/<name>" origin/main`, edit there, `git -C <wt> add <paths>`, read `git -C <wt> diff --cached --name-only` as its own step, `git -C <wt> commit -F <msgfile>`, `git -C <wt> push origin HEAD:main`, then `git worktree remove` from outside the worktree (removing from inside fails with Permission denied).
4. `ListAgents` for the live roster; poll rather than trust this doc's board, which ages fast.

## Open items

1. **Blocked-escalation handoff** (`docs/plans/claude-kit_blocked-escalation_spec_v1.md`, on origin at `e8a856d`): dispatched to KIT: Shared Messages, which holds it deferred and arms it at its kaizen-batch-2 finishing merge. The hold is written into that plan's Chapter 3 `Next:` line on the executor's side. Sender-side rule: only an `armed` reply converts the handoff; re-send at your own next boundary if no acknowledgment has arrived.
2. **Kaizen inbox** (`kaizen/notes-SCOTT-CLAUDE.md` on origin) holds seven notes. A pass runs only on the operator's explicit authorization; do not start one unasked.
3. **Round close-out sequence** once all leashes drain: finishing passes, then update plugins fleet-wide, then restart every session. The restart is what activates the newly shipped skills, including the auto-compaction boundary markers.
4. **The status /loop died with the predecessor session.** The operator re-arms it by typing `/loop` with the cadence he wants.

## Board at handoff (all three sessions polled 2026-08-26 ~13:00 local; re-verify before relying)

- **KIT: Shared Messages** — kaizen-batch-2 (`docs/plans/claude-kit_kaizen-batch-2_spec_v1.md`), section 3 of 4 in flight (queue-position self-heal, opus-tier); sections 4, 1, 2 closed and pushed (`156b688`, `07737e3`, `ee2031f` on `origin/worktree-kaizen-batch`). Self-estimate to full leash drain: 2.5–4 hours (wide end = one tier escalation or one extra fix round on section 3). Then the finishing merge, at which the blocked-escalation plan arms and runs. Nothing waits on the operator.
- **KIT: Opus Updates** (bound session 8efaf29e) — memory-anchors (`docs/plans/claude-kit_memory-anchors-and-frontmatter-guard_spec_v1.md`), section 7 of 7, fix round 2 against ~18 findings from a triple CHANGES_REQUIRED review round. Self-estimate: plan drained in 2.5–3 hours. Plan 3 on its leash, verification-artifacts, is explicitly unsized; it will size it in ~10 minutes after plan 2 closes. Two operator commitments ride to its close: a walk-through of the merge back to origin/main, and the already-ruled pinned-record hatch. Its goal queue's `queueIndex` reads 0 but plan 1 (compaction-deferral-signal) is Complete and archived; the index advances at the next stop attempt.
- **AI-OS: Opus Plans** — operator-window plan DELIVERED and archived; PR #51 open and awaiting the operator's merge/iterate/discard call, with two deliberate residuals in the PR body and a pushed commit whose defective subject it recommends leaving. Now on spawn-surface-pinning (`ai-os-spawn-surface-pinning_spec_v1.md`), section 1 of 3, self-estimate 3–4 hours, dominated by its ~15-minute full gates.
- **Waiting on the operator:** the PR #51 call; kaizen-pass authorization when he wants it; the /loop re-arm.

## Facts that bite

- Goal-state queue displays go stale until kaizen-batch-2 section 3 lands: an archived plan can still show as "plan 1 of N" in a session-start block. Verify against `docs/archive/` before reporting any plan as new or current.
- Two known flakes while the fleet runs hot: the memq type-lock contention test (machine-global store, any sibling's memq flips it; parked in `docs/backlog.md` as a test-independence defect) and AI-OS's GitTempWorld family under full-suite load. Diff a single red against these before calling it a regression. Suite wall clocks under fleet contention run 2x+ their uncontended numbers.
- Counted claims (plan counts, "only" sentences) are re-derived from the tree after the last merge, never restated from prose.
- The operator reads plain language over technical, even on ground he knows (operator memory `scott-reads-plain-language-over-technical`). Decision asks go in the client-briefing register.
- Five dirty files in the shared checkout (`docs/backlog.md`, `hooks/readonly-agent-guard.js`, `skills/executing-work/SKILL.md`, `skills/finishing-work/SKILL.md`, `test/readonly-agent-guard.test.js`) belong to no live session that claims them; leave them unstaged and unclaimed.
