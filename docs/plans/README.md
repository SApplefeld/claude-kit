# Active Plans

This folder holds active plans only: specs that are open or in progress. A plan is the single source of truth for one effort's intent and state, and a fresh or post-compaction session resumes from it.

## Rules

- A plan lives here while it is being worked. When it reaches `Status: Complete` or is abandoned, it moves to `../archive/` in the same close-out that finished it. The `curating-docs` skill does the move with `git mv` so history is preserved.
- Naming follows the kit convention: `<project>_<content-type>_v<n>.md` (for example `claude-kit_docs-lifecycle_spec_v1.md`). Increment the version rather than overwriting a prior one.
- The `Status` header drives the lifecycle. `session-start.js` scans this folder: `In Progress` plans are surfaced for resume, and `Complete` plans still sitting here are flagged as unarchived.
- A plan doc's header and structure are a frozen v1 machine contract, not only kit convention: an external engine parses nine shapes out of every plan here, case-sensitively and anchored to the start of a line, and four of them carry a value rule it enforces silently. The `curating-docs` skill holds the table; reword nothing in a header without reading it.
- When a plan relates to or supersedes another, cross-reference it in a `## Related` section so the library stays navigable.

## Current

- [Claude-Kit Fleet Integration](claude-kit_fleet-integration_spec_v1.md) is **In Progress**: the kit-side seams the AI OS fleet integration consumes (hook stand-down under the external-engine marker, memq's run-scoped pending tier with provenance, the gated-vector memq grant hook, `CLAUDE_PLUGIN_ROOT`-resolved style paths in briefs, the gated events sink, and the frozen plan-doc header contract). The OS repo's `ai-os-kit-integration_spec_v1.md` depends on it; execute this spec first.

Completed plans are in `../archive/` (most recent: `claude-kit_compact-session-removal_spec_v1.md`, which removed the compact-session skill, its engine, and every piece of machinery that served only them, leaving the kit Node-only with native-compaction recovery untouched).
