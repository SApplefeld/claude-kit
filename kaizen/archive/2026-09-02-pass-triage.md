# Kaizen pass 2026-09-02: triage record

Run by the KIT: Expert seat under the kaizen skill's standing adjudication authority, attended by the operator over the relay thread, who asked for a comprehensive pass and for every valuable plan to be appended to the worker's queue. Notes are cited by file, date and lead phrase as they stood at the capture commit that precedes this pass in the repository's history; the inbox files are cleared in the commit that adds this record. Every "fixed" disposition names the artifact read, never the note's own claim.

Dispositions: **spec** (promoted into a plan under `docs/plans/`), **fixed** (already addressed at HEAD, receipt named), **in flight** (owned by an armed plan), **applied** (changed in this pass), **routed** (moved to another artifact), **parked** (backlog with a signal).

## notes-SCOTT-CLAUDE.md

- 08-29, the read that clears a shared file: **spec**, prose batch s1.
- 08-29, a lookup path without its override tier: **spec**, prose batch s11 and liveness s2.
- 08-29, an instrument that silently truncates its render: **spec**, code batch s1.
- 08-29, a machinery-owned surface that reverts a hand edit: **spec**, code batch s3.
- 08-29, remediation text stating the class hazard: **spec**, code batch s6.
- 08-29, a mid-span splice and marker parity: **spec**, code batch s7.
- 08-29, per-file safeguards and a per-branch push, with its 08-30 store-side refinement: **spec**, prose batch s1; the per-seat commit identity direction is carried by the provenance spec's `author:` field as its record-level sibling.
- 08-30, no per-record authorship stamp, its refinement and the expert seat's correction: **spec**, provenance s1.
- 08-30, a control sharing a derivation path: **spec**, prose batch s2.
- 08-30, the dash bar overstates the ruling: **spec**, prose batch s4.
- 08-30, a version-blind refresh hook: **spec**, code batch s3.
- 08-30, an insertion anchored on a block's tail, and 09-02 KIT: Expert, the anchor re-emit rule: **spec**, prose batch s7.
- 08-30, delete-on-completion with no audit leg: **spec**, claim writer s1 (the tombstone log).
- 08-30, a convention documented once and drifted in practice: **applied**, `kaizen/README.md` now states both note forms and the routed-note case.
- 08-30, a boundary gate keyed on shared state, with four refinements: **fixed**. The `boundary` verb of `kit-compact-checkpoint.js` banks a registered seat on a foreign-dirty tree, stamping `Banked:`; receipt is this seat's own takeover today, marker opened at 14:00:28Z on a tree carrying three foreign paths. Shipped by `docs/archive/claude-kit_durable-boundary_spec_v1.md`.
- 08-30, both legs of the blocked-work funnel gated on the leash: **spec**, liveness s2.
- 08-30, the board's closed content list and homing: **in flight**, `claude-kit_board-routing-and-homing_spec_v1.md` (plan 1 of 7 in the armed queue).
- 08-30, a model hand-writing ISO timestamps: **fixed**. `kit-registry-stamp.js push` stamps `Started:` and `Status-updated:`; receipt is this seat's entry stamped 2026-09-02T14:00:16.312Z. Shipped by `docs/archive/claude-kit_instruments-not-prose_spec_v1.md`.
- 08-30, the claim protocol specified from the arbiter's side only, both halves: **spec**, claim writer s2 and decision 4.
- 08-30, a brief template spelling a field as a value: **fixed**. `plugins/claude-kit/skills/executing-work/SKILL.md:300-306` at `d09d099` names `kit-registry-stamp.js now` as the source of `Started:`.
- 08-30, read-then-write with no primitive under it: **spec**, claim writer s1.
- 08-30, memq resolving the tier from the shell's cwd: **fixed**. The memory-system skill's resolver states the session-filing resolution ahead of the working directory; shipped by `docs/archive/claude-kit_memory-read-side_spec_v1.md`.
- 08-30, a leftover `.md.bak` answering as a record: **fixed** at the listing (the memory-system skill states `.md.bak` is outside the filename grammar); the untested shadow case is **spec**, provenance s3.
- 08-30, a citation from an uncommitted working copy: **spec**, prose batch s8.
- 08-30, a hook emitting a count, and the aging short-circuit: **spec**, code batch s4.
- 08-30, a mutual-exclusion protocol whose write is not the exclusion: **spec**, claim writer s1; its `Started:` half is fixed as above.
- 08-30, the leash scoped to a repository and a seat to a tree: **fixed**. `docs/archive/claude-kit_worktree-goals_spec_v1.md`; the kit-goal skill states a worktree is its own place.
- 08-31, the claim file as a tracked replicated artifact, two notes: **fixed**. Commit `67db614` excludes the claims directory from the allowlist in both directions and the role skill states the file stays home; the residue (the other machine's still-tracked file) is with the operator on the coordinator's board.
- 08-31, a review finding reporting an absence is a scope claim: **spec**, prose batch s6.
- 08-31, the archive chain with no instrument: **spec**, code batch s7.
- 08-31, a branch cut for a parallel queue with no signal: **parked**, `docs/backlog.md` with the coordinator's own caveat as the signal.
- 08-31, the claim rule as an entry check only: **spec**, claim writer decision 5.
- 08-31, `Expected-seconds` read as an expiry, with its confirmation: **spec**, claim writer s2.
- 08-31, the standing-watch ledger admitting a loop's journey: **fixed** for the admission test (`plugins/claude-kit/skills/standing-watch/SKILL.md:28` at `d09d099`, commit `3074425`); the homing half is **in flight** in board-routing-and-homing.
- 08-31, a machine-parsed field gaining an annotation: **fixed** by the stamp CLI writing the field; same receipt as the timestamp note.
- 08-31, a liveness join on a reusable label: **spec**, liveness s1.
- 08-31, a release predicate gated on silence: **spec**, liveness decision 4.
- 08-31, an incident record naming a path with a designed later move: **spec**, liveness s2.
- 08-31, a brief specifying a value rather than a command (AI-OS worker's): **fixed**, same receipt as the template note.
- 08-31, a delete scoped by a copied identifier: **spec**, claim writer s1 (the actor token).
- 08-31, a grant naming a program by path: **routed** already, `docs/backlog.md` line 291 carries it as structural; cleared with that pointer.
- 08-31, a tool signalling only through a state file: **spec**, prose batch s9.
- 08-31, a control validates the axis it varies: **spec**, prose batch s2.
- 09-01, the backlog scanner reading dates per line: **spec**, code batch s4.
- 09-01, the scratch path inside the blind reviewer's grep: **spec**, prose batch s10.
- 09-01, the tree-state bracket blind to empty directories: **spec**, prose batch s10.
- 09-01, a dispatched agent's claim indistinguishable from its dispatcher's: **spec**, claim writer s1.
- 09-01 KIT: Expert, claim and release in one execution unit: **spec**, claim writer s2.
- 09-02 KIT: Expert, a check that gates in its own control flow: **spec**, claim writer s2.
- 09-02 KIT: Worker, a charter naming the guard its output lands behind: **spec**, code batch s8.
- 09-02 merge session, a pin over shipped prose and line endings: **spec**, code batch s7.
- 09-02 doctor run, the history probe's grading: **spec**, code batch s6.
- 09-02 AI-OS: Expert, the sidecar and the cwd-reset footer: **spec**, code batch s5.

## notes-NEO-CLAUDE.md

- 08-28, two working directories and nothing reconciling them: **spec**, code batch s2.
- 08-28, a finding recorded is never verified: **spec**, prose batch s3.
- 08-29, the `Completed:` contract one reference away: **spec**, prose batch s10.
- 08-29, a loud check for a non-registering Chapter: **spec**, code batch s9.
- 08-29, the Status header's three-state contract unstated: **fixed**. `Ready` is a recognized status in `kit-goal-lib.js` (`classifyPlanStatus`, `:924`) and the curating-docs contract table names it; shipped by `docs/archive/claude-kit_plan-lifecycle-and-diagnostics_spec_v1.md`.
- 08-30, a control proves a pattern can speak, not that it spans the rule: **spec**, prose batch s2.
- 08-31, no durable standing operational grant: **fixed**. `docs/archive/claude-kit_standing-grants_spec_v1.md`; the role skill's Standing grants section, whose delegation record this seat resolved today.
- 08-31, the durability test cannot tell failed from never-invoked: **spec**, liveness s2.
- 08-31, a compact checkpoint closing within minutes: **routed** to `claude-kit_checkpoint-session-validation_spec_v1.md` as evidence, that plan's subject being a bystander's `clear` on a checkpoint it did not open.
- 08-31, the registry prune unreachable under stable names, and its general form: **spec**, liveness s1 and decision 4.
- 09-01, the one-heavy-process bullet's unnamed third act: **spec**, prose batch s5 and liveness s2.
- 09-02, the doctor's history probe grading, and the declined-prompt line placement: **spec**, code batch s6.

- 09-02, the registry-stamp audit reports the board absent on a machine whose board is sited elsewhere: **dropped by this pass** (the note stood in the file at the base commit and this record did not cover it; NEO-CLAUDE re-captured it at `8229041`), then **spec**, code batch s10, dispositioned 2026-09-02 in the same seat.
- 09-02, the judgment sidecar alerts on divergence-seeking checks, with NEO-CLAUDE's later qualifier that the fair alerts land inside that same class: **dropped by this pass** on the same terms, re-captured at `8229041`; **held in the inbox for the operator's attended pass**, since the remedy (score the route independently of the match) is a sidecar design direction that sits beside the partial-input direction already pending with the operator.
- 09-02, a pass that clears whole files drops what it never read: **spec**, prose batch s12, captured by NEO-CLAUDE at `8229041` after this pass's clear. Errata for this record: the pass removed sixteen NEO-CLAUDE notes and covered fourteen; the mechanism was not a note landing mid-pass (no commit touched the file between `d09d099` and `ade15e9`) but a whole-file clear with no reconciliation against this record.

## notes-ASR-CLAUDE.md

- 08-30, a re-derivation source list excluding record-sourced facts: **in flight**, board-routing-and-homing s4 (the operator tier joins the source list), with the general clause in prose batch s11.
- 08-30, drift detection scoped to tier rather than to the claim: **spec**, provenance s2.

## Outcome

Five plans authored under `docs/plans/`: `claude-kit_liveness-by-session-identity_spec_v1.md`, `claude-kit_claim-protocol-writer-side_spec_v1.md`, `claude-kit_memory-record-provenance_spec_v1.md`, `claude-kit_kaizen-code-batch_spec_v1.md`, `claude-kit_kaizen-prose-batch_spec_v1.md`. One README applied, one backlog park, one evidence route. Sixteen notes closed on receipts against HEAD `d09d099`. The queue decision for the five plans went to the operator in the pass's close-out; none was appended by this seat, whose authorship of them is what the trace rule excludes as a warrant.
