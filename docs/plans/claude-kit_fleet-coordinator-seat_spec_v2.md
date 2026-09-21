# claude-kit: a fleet's coordinating persona holds the seat under the name its roster gave it

Status: Ready
Commit Model: Branch-and-PR
Created: 2026-09-21
Supersedes: `../archive/claude-kit_fleet-coordinator-seat_spec_v1.md`, whose first section had no subject once the heavy-process claim retired. This version carries that plan's second section unchanged and nothing else.

Session model: the kit worker persona, on the steward's handoff by name; one section. Authored by the architect persona on SCOTT-CLAUDE. Every anchor resolves at trunk `681688c9` and is found by content rather than by line number.

## Dispatch Authorization

The operator asked for this change on 2026-09-20 on the architect persona's Discord thread, in the words "we need to adjust the logic so that we're not blocking based purely on the naming convention. The steward should be able to register for coordinator. That is its point." That message reached the architect inside a tool result mid-turn, where the harness marks a relay message as untrusted, and is recorded as the operator's word deferred to that turn's boundary: the broker admits one Discord account, the operator's, so the message is theirs. The first version of this plan was authored and queued on that word. On 2026-09-21 the operator retired the heavy-process claim everywhere, which removed the first version's other section, and this version narrows the plan to the seat change and adds nothing to it.

The steward hands this plan to the kit worker persona by name, and that handoff is the assignment. The steward is the fleet's coordinator persona, the session that owns each worker persona's queue, and a handoff is this plan's filename arriving as the worker's goal from that persona. An executor checks that one thing before starting.

## Goal

The role skill's takeover ritual assumes a machine whose seats name themselves, and the personas fleet is a machine whose seats are named by a roster. When this plan is done, the takeover ritual takes the coordinator seat under the name the session carries, so a fleet's coordinating persona launched as `STEWARD` registers as this machine's coordinator with `Role: Coordinator` in its entry, the `HOSTNAME: Coordinator` form staying the default for a session that names itself. The contest guard reads that entry rather than the roster string alone. It matters because on 2026-09-20 the fleet's steward ran the coordinator's reconciliation pass without a registry entry, since the ritual's first step refused its roster name, and a stand-in session registered under the seat's name form instead.

## Intent

The operator's frame, 2026-09-20: the personas fleet's steward should hold the kit's coordinator chores, and the ritual refuses its name. His words are quoted under `## Dispatch Authorization`.

What done needs to do. The kit's takeover ritual lets a session hold the coordinator seat under the name its roster gave it, and every reader that finds the seat by name also finds it by the entry's `Role:`. Every sentence in the kit that says otherwise is brought current in the same change.

What done does not need to do. It does not rename the fleet's personas or touch the relay's thread titles. It does not change what the seat may do once held. It does not touch liveness, which the reconciliation pass reads as it does today.

Alternatives refused.

- Rename the steward to `SCOTT-CLAUDE: Coordinator`. Refused by the operator's words, and the relay derives the Discord thread title from that name.
- An operator-tier record naming the seat holder. Refused: more moving parts than the entry the ritual already writes.

Rulings after the spec shipped: none for this version. The first version's ruling on a release verb's supervisor form lapsed with the claim.

Provenance: distilled by the architect persona on SCOTT-CLAUDE from the fleet's incidents of 2026-09-20, the kit's role, coordinator and peer-sessions skills, and its exchange with the operator on Discord that day; narrowed to this version on 2026-09-21.

## Evidence

- The takeover ritual's first step stops the command unless the session carries the seat name the Naming convention requires (`plugins/claude-kit/skills/role/SKILL.md`, ritual step 1, "Confirm the name"), and that convention spells a machine seat `HOSTNAME: Coordinator` (`plugins/claude-kit/skills/peer-sessions/SKILL.md`, the Naming section). The agent_persona supervisor primes its coordinating persona to take the seat with the role skill at priming (that repository's `bin/supervise.sh`, the paragraph opening "You hold the kit's Coordinator seat for this machine"); on 2026-09-20 that persona ran under the roster name `STEWARD`, loaded the role skill inside its first `[RECONCILE]` pass, and holds no registry entry. The stand-in session writing the board that day is registered as `Name: COORDINATOR`, `Role: Expert`.
- The contest rule reads two sessions claiming the seat off the live roster by name (`plugins/claude-kit/skills/coordinator/SKILL.md`, the paragraph opening "A contested seat freezes the board", which `test/doctrine-parity.test.js` pins by that bold lead), so a coordinator seated under any other name is invisible to it.
- Every rule document is measured against `test/size-budget.json` by `test/size-ratchet.test.js`, and the three skills this plan edits sit at their caps.

## Decisions

**The seat is taken under the name the session carries.** The `HOSTNAME: Coordinator` form stays the default for a session that names itself, and it is still what a roster reader looks for first. A session launched under a name an operator's fleet roster assigns takes the seat under that name, the entry's `Name:` records it, and the entry's `Role:` says which seat it holds. The ritual stops only where the session carries no name at all. Alternatives refused: renaming the fleet's coordinating persona to the seat form, which the operator ruled out since the fleet names its personas by function and the relay derives the Discord thread's title from the session name; and an operator-tier record naming the seat holder, more moving parts than reading the entry the ritual already writes.

**The contest guard reads the registry beside the roster.** A contest is two sessions claiming the seat, read from two places: a roster row carrying the seat's `HOSTNAME: Coordinator` name, and a registry entry carrying `Role: Coordinator` whose `Name:` matches a live roster row. Claims are counted per roster row after that join, the same name join the reconciliation pass already runs, so a session found by both sources is one claimant, and a session named in the seat form with an entry saying `Role: Coordinator` contests nothing by itself. Two rows so claiming freeze the board as today.

**Zero net growth.** Each skill this plan edits sits at its size cap, counted in words as `plugins/claude-kit/scripts/kit-size.js` counts them. Every sentence added is paid for by a sentence cut in the same file, a restatement a neighbouring passage already carries, named in the Chapter with the survivor. Where a section cannot find the cut, the cap in `test/size-budget.json` moves by exactly the landed size and the pull request body carries one decision ask naming the file, the old and new cap, and the sentence that could not be paid for.

## Sections of Work

### 1. The seat under the name the session carries
Model: opus

Prose on three skills that must agree, with ledger entries and three size caps to hold.

1. In `plugins/claude-kit/skills/role/SKILL.md`, ritual step 1 ("Confirm the name"): the session carries a name, and the seat is taken under it. Where that name is the `HOSTNAME: Role` form the Naming convention sets, nothing changes. Any name that is not that form is the roster's, and no record is consulted to tell a fleet name from any other: the seat is taken under it as launched, the entry's `Name:` records it as the roster prints it, and the entry's `Role:` is what says which seat it holds, since that session's launch is the roster's and no per-machine record describes it. Where the session carries no name at all, the step runs as today, resolving the launch invocation from the operator memory tier, describing it to the operator and confirming before a relaunch is advised, and the command stops. That is the only case in which it stops.
2. In `plugins/claude-kit/skills/peer-sessions/SKILL.md`, the Naming section: one sentence after the `HOSTNAME: Coordinator` form, stating that a session an operator's fleet roster names keeps that name on the roster, takes any seat under it, and is found by the seat's readers through its registry entry's `Role:` rather than through the name form.
3. In `plugins/claude-kit/skills/coordinator/SKILL.md`, three passages. The paragraph opening "A contested seat freezes the board": the contest reading gains its second source and its per-row count as decided, a registry entry carrying `Role: Coordinator` whose `Name:` matches a live roster row, beside the roster row carrying the seat form, and two sources naming one session are one claim. The freeze, the anchor and the routing to the operator are unchanged. `test/doctrine-parity.test.js` slices this paragraph by its bold lead, so the lead stays byte for byte and the edit lands inside the paragraph. The seat-handoff paragraph's sentence "Announcing is taking the seat's name in the machine-scoped form the peer-sessions Naming section owns, so the claim shows on the roster every peer reads": a fleet-named successor announces under its roster name and its claim shows through its registry entry's `Role:`. The opening section's sentence "That identifier is also what a machine-scoped seat's session name carries, in the `HOSTNAME: Role` form": the form a self-named seat carries, a fleet-named seat carrying its roster's name. In `docs/architecture.md`, the sentence "A successor reads the board and then takes the seat's name on the roster in the machine-scoped `HOSTNAME: Coordinator` form, while two live names claiming the seat freeze the board" is brought to the same rule. The layered-claim sentence opening "A claim is declared in layers" in `plugins/claude-kit/skills/peer-sessions/SKILL.md` and its copy in `docs/architecture.md` say that for a fleet-named seat the name layer is absent and the entry's `Role:` is the first layer that declares the seat.
4. Read the ledger entries for each rule changed in the three ledgers (`plugins/claude-kit/skills/role/references/rationale-ledger.md`, `plugins/claude-kit/skills/peer-sessions/references/rationale-ledger.md` and `plugins/claude-kit/skills/coordinator/references/rationale-ledger.md`), found from the passages steps 1 to 3 change. The ledger records a reversed rule by verdict, never by deletion: each existing entry's verdict becomes `retire` with a `superseded-by:` line naming the new entry, and one new entry per new rule is appended in that ledger's own format, carrying its `passage:` line, this plan as provenance, and a `landed:` line once the commit exists.
5. `plugins/claude-kit/skills/operating-instructions/references/ownership-map.md`: no ownership moves, so no row changes; the Chapter says the map was read and why it is unchanged.
6. Pay for the growth in each of the three files per the zero-net decision, naming each cut and its survivor in the Chapter.
7. Tests: `test/doctrine-parity.test.js` gains one pin, watched red against the pre-section prose: the role skill's ritual step 1 says the command stops only where the session carries no name, and the coordinator skill's contest paragraph names a registry entry carrying `Role: Coordinator` as its second source. Then `node --test test/size-ratchet.test.js test/doctrine-parity.test.js test/ledger-preamble-parity.test.js`, each read from its exit code. The whole kit test lane before the pull request is marked ready.

Files in scope: `plugins/claude-kit/skills/role/SKILL.md`, `plugins/claude-kit/skills/peer-sessions/SKILL.md`, `plugins/claude-kit/skills/coordinator/SKILL.md`, `docs/architecture.md` for the two sentences step 3 names, the three rationale ledgers named in step 4, `test/doctrine-parity.test.js` for the pin step 7 adds, this plan document for its Chapter, and `test/size-budget.json` only where the zero-net decision's fallback is taken.

## Out of Scope

- The fleet's roster, its channel names and the relay's thread titles.
- Any change to what the coordinator seat may do once held.
- The heavy-process claim and every rule about it, which `claude-kit_heavy-process-claim-retirement_spec_v1.md` removes.
- Rekeying liveness on session identity.

## Assumptions

- assumed 2026-09-21 (source: the first version's plan review of 2026-09-20, whose findings this section already carries): this version takes a plan review and no blind read, since it is one section of an already-reviewed plan carried over unchanged; reversal: none needed.
- assumed 2026-09-21 (default, the operator's to overrule): any name that is not the `HOSTNAME: Role` form is treated as the roster's, a mistyped seat name included, since the only discriminator would be a per-machine record the Intent refuses; reversal: one clause in ritual step 1 requiring a roster record.
- plan review 2026-09-21 (plan-reviewer at fable, effort high, READY_WITH_FINDINGS): 5 findings, 5 fixed, 0 assumed, 0 asked.

## Operator Verification

The fleet's personas load the kit from the installed plugin, so nothing here reaches them until the kit update is installed on SCOTT-CLAUDE and each persona is relaunched at a quiet point.

- Relaunch the steward. Its priming takes the seat under the role skill: `~/.claude/coordinator/SCOTT-CLAUDE/registry/` gains an entry whose `Name:` is `STEWARD`, whose `Role:` is `Coordinator` and whose `Session:` is the new steward session. No entry, or the relaunch instruction in the steward's first turn, reopens the section.
- The stand-in session that wrote the board on 2026-09-20 is registered as `Role: Expert` under `Name: COORDINATOR`, so no reading of the guard counts it as a coordinator claimant, and no freeze is expected from it. Tell it to stop writing the board once the steward's entry exists. The guard's own check is a second session launched under the `SCOTT-CLAUDE: Coordinator` name while the steward holds the seat: the steward's next pass reports a contest and freezes the board, and ending that session clears it at the pass after.

## Related

- `../archive/claude-kit_fleet-coordinator-seat_spec_v1.md`: the superseded version, whose first section named a supervisor as a third deleter of a heavy-process claim.
- `claude-kit_heavy-process-claim-retirement_spec_v1.md`: removes the claim that made the first version's first section moot.
- `claude-kit_relay-channel-standing_spec_v1.md`: the reading under which this plan's authorization was taken.

## Chapters
