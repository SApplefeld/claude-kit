# Backlog Snapshot 2026 Q2

Completed cross-effort items moved out of `../backlog.md` during this quarter. Append-only within the quarter.

- 2026-06-19: Decided whether to add a same-session Stop-hook variant. Decision: yes. Implemented `stop-docs-hygiene.js`, a Stop hook that blocks once (loop-guarded on `stop_hook_active`) when a `Status: Complete` plan still sits in `docs/plans/`, registered under the Stop event in `hooks.json`. Source: the docs library lifecycle effort.
