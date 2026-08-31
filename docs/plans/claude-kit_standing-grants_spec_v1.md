# A standing grant gets a surface: the record is the switch, the skill is the scope

Status: Ready
Commit Model: Commit-and-Push
Created: 2026-08-31

Session model: any executor session in the kit repo; four sections, tiers per section. Authored by the KIT: Expert seat from the operator's request, 2026-08-31. Anchors are authoring-time; re-locate every hit by content, since the standing-lines and board-routing plans edit the same skills elsewhere in the queue.

## Dispatch Authorization

Authorized 2026-08-31 by the operator at the keyboard in the expert seat's session ("Can we adjust this?", relaying the NEO-CLAUDE seat's structural finding and asking for the fix): the standing-grant rail generalized from the delegation model, the coordinator store-git carve-out, the doctrine clause, and the record consolidation, appended to the armed queue, for any session holding this plan. Per the trace rule, this section is a warrant only for a citing session that did not author it.

## Goal

The kit gives the operator no durable way to hold a standing operational grant, so every grant decays to a per-session one and every new seat re-asks. The NEO-CLAUDE seat's live instance: the operator granted store-push authority on 2026-08-29, the grant sits in the operator tier in the operator's own words (`memory-store-pushes-need-no-permission`), and the seat still re-asked twice in one day, correctly, because the coordinator runbook says the seat "runs no git in the store", its board-write rule says "no staging, no commit, no push", both unconditional, and the only durable authorization the doctrine names is a plan header, which a store is not. The structural reading is right in effect and wrong in one particular: the kit already ships the needed shape. The role skill's standing-delegation model is a working standing-grant rail, the skill body defining the model's scope and exclusions while an operator-tier record is only the on-switch, the record's body data that can neither widen nor narrow, the ceiling stated as provenance rather than credential. This plan generalizes that rail, names the store's sanctioned sync path as its second instance, and gives the flat prohibitions their carve-out, so a grant the operator has already given stops being re-asked.

Two principles, binding on every section:

1. **The record is only ever a switch.** A standing-grant record turns on a mechanism whose entire scope, exclusions, and procedure a shipped skill states; the record's body is data. What the rail can never reach, stated as the rail's own exclusion list: it extends no warranted channel (the coordinator skill's closed list of three stands), it establishes no privacy precondition (the role skill's Workdir readership bar stands verbatim, deliberately record-proof), it lifts no harness floor and no no-laundering rule, and it widens no grant past what its owning skill spells out. A countersignature clause was considered and rejected: a countersignature is more text in a record any local session can write, so it adds nothing a dishonest writer could not also type, while the rail's security property, scope living in the operator-controlled repo rather than in the record, needs no signature to hold.
2. **The first generalized instance must be blast-radius-neutral.** The store-push grant switches on nothing this machine does not already do unattended: the memory-system SessionStart hook spawns the store sync in the background on Windows, and that sync commits and pushes through the allowlist gate on its own. The grant only lets a seat invoke the same sanctioned path (the doctor's fix pass, then a push, never a bare `git add`, which bypasses the allowlist leak probes) at moments of its own choosing.

## Evidence

- The structural finding and its live instance: kaizen note at commit `eafbdfc` (`kaizen/notes-NEO-CLAUDE.md`, 2026-08-31), reported by the NEO-CLAUDE seat and re-verified at this repo's own passages before this plan was written; this plan is that note's disposition. The two jointly-closing rules verify at `plugins/claude-kit/skills/coordinator/SKILL.md` (the warranted-channels paragraph's "records and never establishes") and `plugins/claude-kit/skills/role/SKILL.md` (the Workdir precondition's "no memory record establishes it or stands in for it"); both are deliberately scoped bars, not a general ban, and both stay verbatim under this plan.
- The flat prohibitions needing the carve-out, verified at the file: the coordinator skill's store-override bullet ("the seat writes the file and runs no git in the store") and its board-write rule ("no staging, no commit, no push").
- The grant record exists in the operator's own terms with its date and mechanism (`memory-store-pushes-need-no-permission`, operator tier, granted 2026-08-29, read at authoring): push any time, the store is private and meant to sync, route commits through the doctor fix pass, verify committed and pushed as two facts, confirm currency rather than presence. The NEO seat reports two further records carrying the same grant, unverified from here; section 4 reconciles.
- The working rail this plan generalizes: the role skill's standing-delegation model, resolved by `/role` at claim time on this very machine (operator-tier record `scott-claude-standing-delegation-granted`), with the on-switch, hostname-keying, body-is-data, and provenance-not-credential ceiling all already stated and exercised.
- The re-ask cost: the NEO seat put the same settled question to the operator twice in one day, and the operator asked how to convey the grant more strongly; the answer is that no wording could, the gap being structural.

## Approach

Prose contract end to end; no code ships. The role skill gains the generalized rail with delegation as its first instance; the coordinator skill gains the store-git carve-out keyed on the grant record; the doctrine's authorization sentence gains the rail as a second named exception, in the three parity copies; a sweep reconciles remaining flat statements and consolidates the grant records. Skill amendments are reviewed whole-file per the recorded amendment defect mode.

## Decisions

- Decided 2026-08-31 (expert seat's ruling on the operator's request, rationale in Goal principle 1): the rail, not the countersignature clause. The NEO note offered both; the countersignature is strictly weaker and invites trust in a forgeable line.
- Decided 2026-08-31: the two "never establishes" bars stay verbatim. They guard a channel list and a privacy precondition, which are exactly what the rail's exclusion list keeps out of reach; the fix is a rail beside them, not a softening of them.
- Decided 2026-08-31: the existing record name `memory-store-pushes-need-no-permission` becomes the named switch rather than being reshaped to a canonical new key. It already carries the grant in the operator's words with its date; the skill naming it is what makes it establishing, and a rename would spend a delete and a re-grant to buy nothing.
- Scoping note for the rail: delegation is machine-scoped by hostname keying; the store-push grant is store-scoped (one store, one remote, the grant's own terms are about the store), so the rail states that each grant's owning skill declares its scoping, hostname-keyed or store-wide, and the resolution rule for each.

## Sections of Work

### 1. The role skill generalizes the delegation model into the standing-grant rail. Model: fable

The standing-delegation passage (authoring-time anchor: the bold lead "`/role` is how a seat comes up already holding the operator's standing delegation") is joined by the rail stated once and generally: a standing operational grant is a mechanism whose scope, exclusions, and procedure a shipped skill states, switched on by one operator-tier record the owning skill names, the record's body data that can neither widen nor narrow, revoked by deleting the record, with the ceiling stated (provenance rather than credential: any local session can run the CLI, and the record narrows an honest writer without authenticating one). The rail's own exclusion list from Goal principle 1 rides in the same passage: no channel extension, no privacy-precondition establishment, no harness-floor or no-laundering relief, no widening past the owning skill's text. Each grant declares its scoping (hostname-keyed like delegation, or store-wide like the store push) and how a seat resolves it. Delegation is then restated as the rail's first instance rather than a one-off, with its chain, scope, and exclusions untouched; the store-push grant is named as the second with a pointer to the coordinator skill as its owning contract. Whole-file review; grep for pins over the passage before editing.

Acceptance: the rail present and general, its exclusion list complete, delegation reading as its first instance with no semantic change (the delegation model's own tests and pins green), the store-push grant named with its owner; whole-file review; suite delta against a recorded baseline.

### 2. The coordinator skill carves out the sanctioned store path under the grant. Model: opus

The store-override bullet's "runs no git in the store" and the board-write rule's "no staging, no commit, no push" each gain the carve-out, stated at the point of the prohibition: where the store-push grant record resolves (`memory-store-pushes-need-no-permission`, operator tier), the seat may run the sanctioned path and only it, the doctor's fix pass to commit (which routes through the allowlist leak probes a bare `git add` bypasses, and from a tool shell needs its consent flag), then a push, then the two-fact verification in the grant's own terms: worktree clean AND branch level with the remote, currency confirmed by diffing a changed record against the remote copy rather than by presence. The prohibition's original reason, a seat's git racing the sync's own fetch and rebase, is resolved from the code rather than assumed away: the implementer reads whether the sync runner and the fix pass hold a lock or tolerate concurrent invocation, states the answer in the carve-out (or the ordering rule that substitutes for one), and does not ship a carve-out that reintroduces the race the prohibition existed to prevent. The board-write rule's surrounding lag description (visibility rides the sync's triggers) is updated to note that a granted seat can close the lag itself by the sanctioned path.

Acceptance: both prohibitions carry the carve-out keyed on the named record with the sanctioned path and two-fact verification stated; the concurrency answer present and sourced from the code; no bare-git path opened anywhere; whole-file review; suite delta against a recorded baseline.

### 3. The doctrine's authorization sentence names the rail. Model: sonnet

In the doctrine bullet led **Name the rollback and stop for a yes before any irreversible or outward action.**, replace exactly this sentence:

> By default, commit and push only when asked - but a plan header marked Commit-and-Push is that authorization for that plan's sections.

with exactly this text, verbatim, no redrafting:

> By default, commit and push only when asked - but a plan header marked Commit-and-Push is that authorization for that plan's sections, and a standing-grant record resolved under the role skill's rail is that authorization for the operational surface its owning skill names, the memory store's sanctioned sync path being the standing instance.

Every other sentence of the bullet is untouched. The three parity copies are `~/.claude/claude-kit-doctrine.md` (source), `plugins/claude-kit/claude-kit-doctrine.md` (build staging), and `plugins/claude-kit/skills/operating-instructions/SKILL.md`; `test/doctrine-parity.test.js` is the self-surfacing gate, red-first (edit one copy, watch the pin red, land the other two, watch it green).

Acceptance: the replacement byte-identical in all three copies, parity pin green, diff exactly one sentence per file; suite delta against a recorded baseline.

### 4. The sweep and the record consolidation. Model: sonnet

Two halves. First, the prose sweep: tree-wide grep for the flat phrasings this plan carves out or coexists with (`runs no git in the store`, `no staging, no commit, no push`, `records and never establishes`, `no memory record establishes`), each pattern's control run first against the pre-change passage it is known to match, then every live-document hit dispositioned: the two carved-out sites confirmed changed by sections 1 and 2, the two deliberately-verbatim bars confirmed unchanged, and any other live hit reconciled or reported. Append-only surfaces stay. Second, the record consolidation, run against the live store: resolve every operator-tier record carrying the store-push grant (the NEO note reports three; `memq find` over push and store terms, plus the named record read whole), keep `memory-store-pushes-need-no-permission` as the named switch, and retire redundant ones through the CLI only (`memq delete-operator <name> --confirm-shared`), per the single-record convention the delegation grant already follows, with each deletion named in the chapter. A deletion is destructive and shared-tier: the section runs it only for records whose whole content the kept record already carries, and reports rather than deletes anything that carries more.

Acceptance: sweep patterns clean on live documents with controls spoken; the named record confirmed present and the redundant set enumerated with each disposition (deleted with its content confirmed subsumed, or kept with the reason); chapter carries the store-state change per the name-what-you-changed rule; suite delta against a recorded baseline.

## Out of Scope

- The NEO seat's board phrase ("re-confirmed rather than re-derived"): that seat's own board, its own cleanup; the general lesson (an inherited board line nothing exercises) is the board-routing plan's territory.
- The warranted-channels list and the Workdir readership precondition: verbatim by decision.
- Any new grant beyond delegation and the store push: the rail admits them, this plan ships only these two.
- The NEO note's two sibling kaizen entries (mechanical sweep-set derivation; the wedge-reading zero-byte path): separate findings, left to the kaizen inbox.

## Related

- Kaizen note at commit `eafbdfc` (`kaizen/notes-NEO-CLAUDE.md`): the finding this plan dispositions.
- `plugins/claude-kit/skills/role/SKILL.md`: the delegation model this plan generalizes; `plugins/claude-kit/skills/coordinator/SKILL.md`: the prohibitions this plan carves out.
- Operator-tier records `memory-store-pushes-need-no-permission` (the switch) and `scott-claude-standing-delegation-granted` (the first instance's switch).
- `docs/plans/claude-kit_standing-lines-and-honest-reports_spec_v1.md` and `docs/plans/claude-kit_board-routing-and-homing_spec_v1.md`: edit the same skills elsewhere in the queue; anchors re-locate by content.

## Chapters
