# Claude-Kit Instance Store Pin

Status: In Progress
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

- Builds on `../archive/claude-kit_fleet-integration_spec_v1.md`, which created the gated store, the pending tier, and the two-signal override rule this pin follows.
- Consumed by the `sapplefeld-ai-os` repo's `ai-os-kit-integration_spec_v1.md`, whose section 2 builds the per-instance store and the promotion into it.

## Chapters
