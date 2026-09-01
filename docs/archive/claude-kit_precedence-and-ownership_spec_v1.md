# Which text governs: a ranking for disagreeing surfaces and a map of who owns each moment

Status: Complete
Commit Model: Commit-and-Push
Created: 2026-09-01

Session model: a single Fable session at the operator's keyboard, executing inline with no dispatch; the change is prose and one pin. Authored and executed 2026-09-01 on branch `claude/kit-doctrine-conflicts-uzdv54`.

## Dispatch Authorization

Authorized 2026-09-01 by the operator, first-hand in this session: "Can you help put that together directly yourself in this session? Can you commit and push that to the repo?", on the precedence rule and ownership map this session had recommended in the same dialog. The commit and the push are the operator's word in the session; the header above records the model that word matches.

## Goal

The kit's behavior-shaping prose has no stated rule for what wins when two surfaces disagree at a moment, and no single place that says which document owns which moment. Roughly forty sentences of the form "the X skill owns Y" are scattered through the doctrine and the skills, one general precedence statement exists (house style against a formatter config), and every other conflict is re-derived by the session that hits it. A cautious model resolves an unranked "stop or go" toward stop, which is how sessions came to believe they were barred from commits and pushes their plan header had authorized. When this plan is done: the doctrine carries a ranking of surfaces, a rule that a stop met on a non-owning surface is a pointer rather than a bar, a rule that authorization for an outward act is positional, and a one-owner-per-moment rule; a map of moments to owners ships beside the skill; the parity suite pins the section and the map together; and the moments the corpus leaves contested are listed in the map as state, awaiting the operator's ruling, rather than resolved silently by whichever session meets them next.

## Evidence

- One Opus extraction pass over the sixteen documents governing git acts (about eighty thousand words) produced 170 distinct instructions and 20 conflicts or ungoverned situations. Four were verified at the file before this plan was written: the output style carries the pre-send stop-and-ask line and has no mention of the Commit-and-Push carve-out; the doctrine's authorization sentence names Commit-and-Push alone while executing-work directs pushes under Branch-and-PR; three documents give three answers for when a Branch-and-PR pull request opens; branch-hygiene licenses and forbids the same delete four lines apart.
- A cold Sonnet probe handed the full governing file set reached the right answer for the commit-and-push-after-section-close case and listed six passages that made it hesitate. The false bars therefore arise when a reader holds a subset of the corpus, a copy that dropped the exception or a brief that omitted the header, rather than from any single contradictory sentence.
- Twelve-word shingle overlap across the 41 shipped prose files: the three implementer charters are 99 to 100 percent identical to each other, the output style is 66 percent doctrine, the adversarial and prose reviewer charters share about a third. The doctrine-parity suite pins copies one incident at a time and had reached 53 tests and 212 kilobytes before this plan.
- The standing-grants plan's own diagnosis of the NEO seat's repeated store-push re-ask, that "no wording could" convey the grant more strongly and the fix had to be a rail, is the case for stating authorization as positional rather than adding prose.
- A before-and-after probe at Sonnet, three scenarios on frozen copies of the governing files, is recorded in the Chapter.

## Decisions

Decided 2026-09-01 by this session under the operator's request, each reversible by editing the section:

1. **The ranking lives in the doctrine, as a section of its own, placed after Defaults.** A rule for reading every other rule is needed before any skill has loaded, which is the always-on test the architecture states, and it sits beside the one precedence statement the doctrine already carried.
2. **Six ranks: harness, the operator's live word, a positional grant for its assigned scope, the doctrine for principles and authorization scope, the owning skill for mechanics, every other surface as a pointer or a whole copy.** The doctrine and the owning skill split by subject rather than by strict rank, because the architecture already assigns principles to the doctrine and mechanics to the skill, and a strict rank in either direction would falsify one of the two.
3. **A positional grant governs exactly the scope the doctrine or the owning skill assigns that form.** A plan header reaches its plan's sections; a standing-grant record switches on the mechanism its owning skill states and nothing else. This keeps the standing-grants plan's rail intact: a record still cannot widen a skill, so the coordinator's flat store-git prohibition still holds until that plan's carve-out lands.
4. **The stop-for-a-yes rule is subordinate to ranking, not replaced by it.** Ranking runs first; the stop remains for an outward act the ranking leaves genuinely unresolved. The asymmetry the corpus-audit plan states (a gate wrongly retired removes a safety property, a gate wrongly kept costs one round trip) is preserved.
5. **Two prose grants are named and closed: the standing dispatch request and kaizen capture.** Both already live in the doctrine by design; naming them closes the list so no later sentence reads as a third.
6. **The map is a reference file beside the skill, not a table in the doctrine.** The doctrine grows by one section and points; the map's forty-odd rows are a lookup a session performs once, and a single copy carries no parity burden.
7. **Contested moments ship in the map as state.** Assigning an owner to a moment two documents govern is the operator's ruling; the map lists the tension and the doctrine's intake-gap rule governs until the ruling lands. Five such moments ship in this version, all from the pilot.
8. **The doctrine's authorization sentence is untouched.** The standing-grants plan's section 3 replaces that exact sentence verbatim and is pending; editing it here would break that section's anchor. The Branch-and-PR authorization gap is listed as contested and routed to the backlog for sequencing behind that section.

## Sections of Work

### 1. The doctrine section, in both parity copies. Model: fable

A "## Which text governs" section with four bullets (the ranking, the stop-is-a-pointer rule, positional authorization with the push as its worked case, one owner per moment with the map's path), inserted before "## How we work" in `home/claude-kit-doctrine.md` and in the body of `plugins/claude-kit/skills/operating-instructions/SKILL.md`, byte-identical. No em dashes; no journey narration.

### 2. The ownership map. Model: fable

`plugins/claude-kit/skills/operating-instructions/references/ownership-map.md`: how to read a row, how to amend, six tables of moments grouped by lifecycle (intake and design, execution, finishing, git acts, coordination and seats, memory and the kit's own prose), each row naming the moment, the owner, and the surfaces that point at it or carry a pinned copy, and an "Unowned or contested" table. Owners are drawn from the doctrine's own ownership sentences, the architecture document's always-on boundary section, and each skill's stated trigger.

### 3. The parity pins. Model: fable

`test/doctrine-parity.test.js` gains two tests: the section present once in each copy, identical, carrying its four leads and the map path; and the map tracked in the index, on disk, carrying its unowned section, and naming every shipped skill in its owner column at least once, so a skill added without a row reddens.

### 4. The pointers. Model: fable

`README.md`'s payload map entry for `operating-instructions/` names the map; `docs/architecture.md`'s always-on boundary section gains one paragraph describing the section and the map; `docs/backlog.md` gains one active item carrying the five contested moments with a recommendation each; the follow-on probe plan is written to `docs/plans/` as Ready and unauthorized.

## Out of Scope

- Ruling on any contested moment: the operator's, recorded in the backlog item.
- Editing the doctrine's authorization sentence: the standing-grants plan's section 3 owns that edit.
- Single-sourcing the implementer charters and the output style's doctrine core through the build: a separate plan, sized by the shingle numbers above.
- The standing probe instrument: `docs/plans/claude-kit_scenario-probes_spec_v1.md`.

## Related

- `docs/plans/claude-kit_corpus-audit_spec_v1.md`: the parked full sweep; its conflict lane consumes the contested list and the probe set.
- `docs/plans/claude-kit_standing-grants_spec_v1.md`: the rail the ranking's positional-grant tier generalizes, and the owner of the authorization-sentence edit this plan leaves alone.
- `docs/plans/claude-kit_gating-definitions_spec_v1.md`: the authoring-time check for the definition class the map's rows are.
- `docs/plans/claude-kit_scenario-probes_spec_v1.md`: the follow-on this plan's probe seeded.

## Chapters

### Chapter 1 - 2026-09-01
Completed: 1 through 4, inline in the authoring session.
Implemented By: the session itself (Fable), no dispatch; two cold Sonnet probes dispatched for the before-and-after reading, one Opus extraction pass and one Sonnet scenario probe dispatched earlier in the same dialog as the pilot the Evidence section cites.
Metrics: review rounds 0 (no reviewer pair: the change is doctrine prose the operator reads directly, and the operator asked for it in-session; recorded as a deliberate deviation from the section-review default, reversal cost one review dispatch); NEEDS_CONTEXT 0; escalations 0; consults 0.
Gate: `node --test` whole suite, baseline 2863 tests, 2617 pass, 20 fail, 226 skipped, run in a root container where the 20 failures are permission-shaped (unwritable and unreadable fixture cases) and predate the change; after the change 2865 tests, 2619 pass, 20 fail, 226 skipped, the failing set identical by name to the recorded baseline (the two added tests are the pins). Targeted lane: `test/doctrine-parity.test.js`, 53 before, 55 after, all green. Exit codes read from the runs themselves.
Probe: three scenarios at Sonnet on frozen copies of the eight governing files before the edit and the nine after (the map added). Before: the Branch-and-PR pull-request moment came back CONTESTED with the reader supplying its own reconciliation and saying so; the coordinator store-push moment RESOLVED as no push; the Commit-and-Push section-close moment RESOLVED as commit and push without asking. After: the pull-request moment still CONTESTED, and the reader now cites the map's row, declares the reading it takes, and reports the gap rather than reconciling on its own, which is the behavior the section asks for; the store-push moment lands on no push as before, the reader citing the rail's fail-closed clause; the section-close moment RESOLVED as before, the reader now naming the doctrine's stop-is-a-pointer bullet against the output style's checklist line. The RED reproduced on one of three scenarios; the other two stand on the structural rationale the Evidence section states, per the writing-skills rule for a rule whose RED did not reproduce.
Decisions / Surprises: The doctrine's authorization sentence could not be corrected here without breaking the standing-grants plan's section 3 anchor, so the Branch-and-PR gap ships as a contested row and a backlog item instead. The "commit model that commits and never pushes" the operator described in the dialog does not exist in the corpus; the set is closed at three, which is itself a ruling the operator owes and is listed as contested.
Assumptions: (2026-09-01) Route (b), low-blast and reversible: the section sits after Defaults rather than at the top of the doctrine, on the adjacency to the house-style precedence bullet. (2026-09-01) Route (b): the map lists owners at the skill level and names a hook only where it is the mechanical enforcement of a rule the named prose owns.
Next: none; the plan is complete. The follow-on probe instrument is its own plan.
Commit Model: Commit-and-Push
