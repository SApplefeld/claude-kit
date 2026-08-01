# Active Plans

This folder holds active plans only: specs that are open or in progress. A plan is the single source of truth for one effort's intent and state, and a fresh or post-compaction session resumes from it.

## Rules

- A plan lives here while it is being worked. When it reaches `Status: Complete` or is abandoned, it moves to `../archive/` in the same close-out that finished it. The `curating-docs` skill does the move with `git mv` so history is preserved.
- Naming follows the kit convention: `<project>_<content-type>_v<n>.md` (for example `claude-kit_docs-lifecycle_spec_v1.md`). Increment the version rather than overwriting a prior one.
- The `Status` header drives the lifecycle. `session-start.js` scans this folder: `In Progress` plans are surfaced for resume, and `Complete` plans still sitting here are flagged as unarchived.
- A plan doc's header and structure are a frozen v1 machine contract, not only kit convention: an external engine parses nine shapes out of every plan here, case-sensitively and anchored to the start of a line, and four of them carry a value rule it enforces silently. The `curating-docs` skill holds the table; reword nothing in a header without reading it.
- When a plan relates to or supersedes another, cross-reference it in a `## Related` section so the library stays navigable.

## Current

None. Every plan is complete and archived.

Completed plans are in `../archive/` (most recent: `claude-kit_memq-session-recap_spec_v1.md`, which added `memq recent`, a read-only time-boxed digest of what the memory store recorded inside a window, grouped by write surface so the digest says whether a session exercised the memq extension layer or wrote plain memory files, and wired a close-out recap into `finishing-work` step 7. Before it, `claude-kit_instance-store-pin_spec_v1.md`, which gave one AI OS instance one memory tier whatever working directory a worker ran in: `KIT_MEMORY_PROJECT` pins the store's `projects/<segment>` directory, honored only alongside the gated store pair, and pinned content is fenced on the way into context because the worker that wrote it is not the session reading it back. Before it, `claude-kit_fleet-integration_spec_v1.md`, which made the kit a well-mannered passenger in engine-spawned sessions: hook stand-down under the external-engine marker, memq's run-scoped pending tier with provenance, the gated-vector memq grant hook, style-skill paths resolved from the session's own loaded kit root, the gated events sink with an `isRunId`-validated `run` field, and the plan-doc header declared a frozen machine contract).
