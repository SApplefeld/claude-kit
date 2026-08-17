# Kaizen brief: docs-write-guard containment

Friction: `targetsDocs()` in `plugins/claude-kit/hooks/docs-write-guard.js` (line 61) matches any path containing a `docs/` segment anywhere on disk, so a governed subagent writing to an out-of-repo path (a session scratchpad report, a fixture repo, a dependency checkout) is blocked, with denial text about a repo the path was never in. A QA verifier hit it mid-effort writing a report to a scratchpad path. Same shape as the parked backlog item dated 2026-07-31; this is the bite that unparks it.

Change: add containment against the project root, the way `readonly-agent-guard.js` already does: resolve the target path and block only when it sits inside the session project's own tree. Out-of-tree paths become structurally out of scope rather than incidentally matching. Update the guard's header comment and the relevant `docs/security-model.md` passage. Retire the matching `docs/backlog.md` item with a receipt.

Acceptance: new test in `test/docs-write-guard.test.js` covering a governed subagent's write to an absolute out-of-repo path containing a `docs/` segment, watched red before the fix (currently blocks) and green after (allows); all existing docs-write-guard tests still green; `./build.ps1` run before the gate so the hook manifest matches.

Discipline: follow writing-skills; baseline-test any behavior-shaping wording.

## Outcome (2026-08-16): applied

Containment shipped in `docs-write-guard.js` (repoRoot + resolve + relative-containment, mirroring readonly-agent-guard); three regression tests watched red then green, file suite 12/12; `docs/security-model.md` updated; the matching backlog item moved to the Q3 snapshot with its receipt.
