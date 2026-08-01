# Claude-Kit Instance Store Pin

Status: Complete
Commit Model: Commit-and-Push
Fable Spend: finishing reviews
Created: 2026-08-01

## Goal

One instance of the AI OS gets one memory tier, whatever working directory the worker that wrote a memory happened to run in. Today the kit files every store surface under a segment derived from the worker's cwd, so a single instance store fragments into as many isolated stores as the engine has spawn shapes, and a memory promoted out of a plan-execution run lands where no later run and no reviewer ever looks. The compounding memory the OS is built for would not compound.

## Approach

`projectMemoryDir` (`plugins/claude-kit/scripts/memq.js:222-224`) is `<root>/projects/<sanitizeProjectPath(cwd)>/memory`, and it is the root of everything: the `MEMORY.md` index, the memories themselves, the pending tier, the outcomes journal, the usage sidecar, and the decay stamp. That derivation is correct for attended use, where one checkout is one project, and wrong for an engine instance, where three spawn shapes carry three cwds: the reviewer and the phone-driven worker run in the instance directory, while a plan-executing worker runs inside the repository it is working on, or inside a per-branch copy of it. The engine cannot resolve this by choosing a cwd, because a plan worker must run in its repo, so the fix belongs in the kit.

The mechanism is a pin: an environment variable that replaces the cwd-derived segment with a fixed one. It selects a subdirectory *within* an already-gated store rather than redirecting a path of its own, so by the discipline the fleet-integration effort made uniform it is honored only alongside `KIT_MEMORY_ROOT` with `KIT_MEMORY_ROOT_ALLOW_DATA=1`, and carries no second signal of its own. The value becomes a directory name, so it answers to the same conservative grammar and the same Windows directory-name hazards `KIT_RUN_ID` already answers to, single-sourced rather than restated.

The consequence to state rather than discover: under a pin, every run in that instance shares one project tier, so a memory learned while working repo A is recalled by a run working repo B. That is the intent (the instance is the entity that compounds, not the repository), and it makes the security model's existing "the store is not a security boundary between projects" line load-bearing in a new way, which section 2 records.

Test harness: Node's built-in runner, Node v24. The gate is `node --test "test/*.test.js"` from the repo root, quoted; the bare directory forms discover no files and produce a synthetic false red. Editing a hook or `hooks.json` invalidates the build stamp `test/hook-canary.test.js` asserts against, so `powershell -File ./build.ps1` runs before the gate after any such edit.

Baseline at the plan commit: 429 tests, 429 pass, 0 fail.

## Standing Brief Amendments

- The gate is `node --test "test/*.test.js"`, quoted. Never the bare directory form.
- After editing any hook or `hooks.json`, run `powershell -File ./build.ps1` before the gate.
- Never write under `docs/`: the docs-write-guard denies a non-curator subagent that write (`plugins/claude-kit/hooks/docs-write-guard.js:87-106`). Return doc prose in the final message for the main thread to place.
- Do not write to real user state. Point any store at a temp root via `KIT_MEMORY_ROOT` plus `KIT_MEMORY_ROOT_ALLOW_DATA=1`, and sandbox `HOME`/`USERPROFILE` before exercising anything that defaults to the home directory.

## Sections of Work

### 1. KIT_MEMORY_PROJECT pins the store's project segment
Model: opus

When `KIT_MEMORY_PROJECT` is set and the `KIT_MEMORY_ROOT` pair is present, `projectMemoryDir` uses its value as the `projects/<segment>` directory name in place of `sanitizeProjectPath(cwd)`. Every surface that hangs off `projectMemoryDir` follows automatically, which is the point: index, memories, pending tier, journal, usage sidecar, and decay stamp all land in the one directory.

- Honored only alongside `KIT_MEMORY_ROOT` and `KIT_MEMORY_ROOT_ALLOW_DATA=1`. Set without them it is ignored, the cwd derivation stands, and a note goes to stderr once per process, in the shape `memoryRoot()` already uses for its own ungated case.
- The value becomes a directory name. Validate it with the same predicate `KIT_RUN_ID` answers to (dots-only names, trailing dots, Windows reserved device stems, the token charset, the length cap), single-sourced: extract the shared grammar into one predicate both call rather than writing a second copy, since two surfaces holding their own copy of a path-segment rule is the drift this repo has already paid for twice.
- A value that fails the grammar is refused loudly, exactly as a bad run id is, rather than falling back to the cwd derivation. A silent fallback would scatter an instance's memories back across per-cwd directories, which is the defect this section exists to close.
- Unset: behavior byte-identical to today. The existing suite is that pin.

Files: `plugins/claude-kit/scripts/memq.js`, tests in `test/`.
Acceptance: `node --test "test/*.test.js"` green. With the pin and the store pair set, two processes run from two different working directories resolve the same project tier, write memories the other can `find`, `get`, and `recall`, and share one journal and one decay stamp. Without the pin, two different cwds resolve two tiers as they do today.
Tests: both directions (pin set collapses two cwds to one tier; pin unset keeps them separate and byte-identical), the pin ignored without the store pair, hostile values refused, and the pin composing with `KIT_RUN_ID` so a pending tier under a pin is `<pinned project>/memory/pending/<run-id>/`.

### 2. Document the pin and what it changes about the store
Model: opus
Locus: inline

The docs-write-guard makes every `docs/` write the main thread's, so this section is inline by routing rather than by tier.

- `docs/security-model.md`: the pin joins the environment-override section with its gate reasoning, and the per-tier section records that under a pin one project tier serves every repository an instance works on, which turns the existing "the store is not a security boundary between projects" line from a caveat into the operating condition.
- `docs/architecture.md`: the memory-store section states that the project segment is cwd-derived by default and pinnable under the engine's gated store.
- `docs/fleet-integration.md`: the pin joins the environment contract, with the reason an engine needs it (three spawn shapes, three cwds, one instance) and the warning that omitting it silently fragments the instance's memory rather than failing.

Files: `docs/security-model.md`, `docs/architecture.md`, `docs/fleet-integration.md`.
Acceptance: each of the three documents names `KIT_MEMORY_PROJECT`, its gate, and the fragmentation it prevents; the security model states the cross-repository consequence rather than implying per-project separation still holds.

## Out of Scope

- The engine setting the variable, and choosing the instance's segment value. OS-side.
- Promotion, adjudication, and the review episode: engine lifecycle, unchanged by this plan.
- Any change to how an attended session resolves its store. Unpinned behavior is byte-identical.
- Migrating memories already written under a cwd-derived segment. No store exists on any instance yet, so there is nothing to migrate.

## Open Questions

None. The fork (one shared tier per instance) was settled with Scott on 2026-08-01; the mechanism follows the gated-override discipline the fleet-integration effort established.

## Related

- Builds on `claude-kit_fleet-integration_spec_v1.md`, a sibling in this archive directory, which created the gated store, the pending tier, and the two-signal override rule this pin follows.
- Consumed by the `sapplefeld-ai-os` repo's `ai-os-kit-integration_spec_v1.md`, whose section 2 builds the per-instance store and the promotion into it.

## Chapters

### Chapter 1 - 2026-08-01
Completed: 1. KIT_MEMORY_PROJECT pins the store's project segment
Implemented By: implementer-opus (no escalation)
Metrics: 1 review round plus 3 fix rounds via SendMessage; adversarial + blind at fable and security-reviewer at default; 0 NEEDS_CONTEXT; 0 escalations; advisor opus
Gate: 429 pass / 0 fail at section start; 444 pass / 0 fail at close, +15, none lost.

Decisions / Surprises:
- The pin invalidated the reason project-tier content is served unfenced, which the security review caught and which is the finding that mattered. `docs/security-model.md` justifies the raw posture with "the project that wrote it is the project reading it", and under a pin that is false by design: a memory written while working repo A is served raw into a session working repo B. The same document already fences the pending tier "because the writer is a spawned worker rather than the attended session reading it back", which under a pin applies verbatim to the project tier. Pinned project bodies and pinned digest records are now fenced, keyed on whether a pin is in effect rather than on the tier's name, since the name is exactly what stopped being a reliable signal. Unpinned output is unchanged, because there writer and reader really are the same project.
- Two seams where memories still landed where nothing reads, both closed. A gated pin with no `KIT_RUN_ID` left the hook silent, so a reviewer or a phone-driven worker (the shapes that write without a run id) would have written into the cwd-derived directory the pinned store never reads: that state now gets a destination block naming the pinned tier, and unlike the run-scoped block it says an index line in `MEMORY.md` is correct there, because a pinned project tier is the instance's ordinary adjudicated record. And a hostile gated pin made the hook throw before emitting anything, including the stand-down that exists to tell a fleet session not to write memories at all; that is the fail-open-into-the-shared-record shape the previous effort spent a Major closing, arriving through a different door.
- The implementer corrected my own reasoning on the last decision and was right. I approved carrying descriptions on pinned project lines partly on the ground that the type tier already carries them; it does not, and no live-record surface in `recall` did. The decision stands on the ground that survives: the omission's stated justification is that the harness already injects the project index into session context, which is false under a pin, and the pinned reviewer is the consumer that decides it. The honest consequence is that the change makes the digest correct rather than consistent, and the pinned project tier is now the only live-record surface carrying a description.
- Self-initiated and correct: `recall`'s project coverage line claimed "already in session context", which under a pin is false, and it was shipping into model-visible output. Now it names the pinned tier instead. Nothing untrue ships, including a coverage line.
- Unpinned byte-identity was established by more than the suite: the implementer ran seven read-command shapes against `git show HEAD:` and the current file on parallel fixtures with normalized paths and a fixed timestamp, all identical in stdout, stderr, and status. The stated edge is that the harness covers read commands only, so the mutating paths rest on the 444-test suite.
- Ratified, no change: the gate-first ordering (an ungated pin is ignored whatever its value, so a stray shell-profile variable cannot take memq away from an attended session, and only a gated hostile value refuses); the pin not being case-folded, since the run-id fold is win32-only and the behavior already matches; and `find` taking no fence, since it emits bounded charset-closed one-liners and never a body.
- Left for the backlog rather than ridden here: by the same argument that earned pinned project lines their descriptions, the type tier is also a surface a session has seen only through a capped index emission, so its live lines arguably earn them too. That is a fresh decision about an unpinned surface and sits outside this section's byte-identity constraint.

Review Findings: 2 Major, 8 Minor across three reviewers, no Critical. Both Majors fixed (the fence, and the effectively-single-variable residual inside a worker, which is a documentation obligation section 2 carries). Minors fixed: the declarer-listing fallback naming a directory the store lacks under a pin, two catches wider than their purpose (one able to blame the grammar for a stderr failure, one able to degrade a pin throw into "untyped"), and exact-case store-pair deletes in the new tests. Minors noted and left: the same exact-case deletes in the pre-existing run-id tests, and the run-id versus pin asymmetry on an ungated malformed value, which now carries a comment saying the shared grammar is not a shared policy.

Next: Section 2, Document the pin and what it changes about the store (inline, main thread)
Commit Model: Commit-and-Push

### Chapter 2 - 2026-08-01
Completed: 2. Document the pin and what it changes about the store
Implemented By: main session (inline by routing; the docs-write-guard makes every `docs/` write the main thread's)
Metrics: no dispatch, no review round of its own (the whole-changeset passes in the finishing Chapter cover it); advisor opus
Gate: 444 pass / 0 fail, unchanged. Prose only.

Decisions / Surprises:
- The security model's fence sentence needed rewriting rather than extending. It read "Project-tier output is unfenced: the project that wrote it is the project reading it", which states a conclusion and its entire justification in one line, so once the pin makes the justification false the conclusion has to move with it. It now says the raw posture holds exactly as far as its condition does, and names the pin as the case where it does not.
- Three counts and enumerations moved with the change, which is the drift class this session has now caught four times: the context-path list gained a fifth hop (the pinned destination block, environment-derived like the fourth), the fleet contract went from eight variables to nine, and the per-tier section gained the paragraph saying cross-repository sharing inside one instance is intended rather than tolerated.
- The residual the security review found is written into Not claimed rather than argued away: inside an engine worker the store pair is already true, so the pin is effectively a single inherited variable there. It is the `KIT_RUN_ID` residual widened from the pending tier to the project tier, bounded the same way (everything stays inside the instance's own root, which the engine allocates per instance, so the pin is never the separator between instances), and the mitigation is the engine's, to set the variable explicitly on every spawn so an explicit value beats an inherited one.
- `docs/fleet-integration.md` carries the operational half a reader actually needs: omitting the pin does not fail, it silently fragments, which is the property that makes it a deployment precondition rather than a nicety.

Review Findings: none of its own; the finishing pass covers the changeset.

Next: finishing-work
Commit Model: Commit-and-Push

### Chapter 3 - 2026-08-01
Completed: 3. Finishing pass
Implemented By: main session, with qa-verifier and a whole-changeset adversarial and security pair at fable
Metrics: QA PASS; adversarial APPROVED_WITH_CONCERNS; security CONCERNS; no code changed in this pass; advisor opus
Gate: 444 pass / 0 fail at close (429 at the pre-effort baseline, +15, none lost), verified by me and independently by the qa-verifier.

Both finishing reviewers found the same thing from opposite ends, and it is the lesson worth carrying: section 2's count-and-claim sweep stopped at the three files it edited. Every finding was a true statement elsewhere in the library that the pin had falsified, and no per-section pass could have seen them because none of them lives in the section's own files.

- The security document credited a governance control the pin makes structurally unreachable. `--confirm-shared` refuses a type-tier retirement that affects more than one declaring project, counted by enumerating `projects/` segments, and the pin collapses an instance to exactly one segment by design, so the count is always one and the gate never trips, while the type tier it guards is not collapsed and stays genuinely shared. The control was not removed; its precondition was replaced by the pin's purpose. Recorded in type-tier governance rather than quietly left.
- The fence claim overreached. Section 2 wrote "all five hops carry the fence", and `memq find` is a sixth content path that carries none: one bounded, charset-closed, quote-stripped line per hit at column zero. The earlier decision that `find` is not a fence surface still stands and I did not reverse it (a single sanitized line cannot forge a block), but the document had to stop implying coverage it does not have and instead name `find`'s narrower guard and the exposure it leaves.
- The pending tier's bound was overstated. Under a pin, a spawn with no run id is deliberately told to write memory files and index lines straight into the shared instance record, so the quarantine covers plan-execution runs rather than every write. Decided in Chapter 1, but the bullet claiming the bound was never qualified.
- `docs/fleet-integration.md` stated the pending path with the sanitized-cwd segment, false under the pin the same document mandates eleven lines earlier. That is the one wrong sentence that could have sent a promotion at the wrong directory, so it is the finding I would least have wanted to ship.
- Model-facing skill prose had gone stale in the way that matters most, because a pinned fleet worker loads it: `memory-system` told the reader the live tiers carry no descriptions because the harness injects the index, which is exactly the premise the pin invalidates, and two skills stated the cwd derivation unconditionally.
- Two counts in `docs/README.md` and one enumeration inside the override list itself ("unlike the other three") were stale. Fourth, fifth, and sixth instances of that class this session.

Also corrected: the mitigation sentence claiming an explicitly-set value beats a repository's own environment configuration. It beats an inherited parent environment, not configuration that runs inside the spawned session's shells afterwards, and the claim now says which.

Nothing in the code changed during the finishing pass. Both reviewers independently verified that every claim the rewritten documents make about the code is true of the code as built, including the fence keying on the pin rather than the tier name, the fifth context path, and the store-root containment.

Next: none, effort complete
Commit Model: Commit-and-Push
