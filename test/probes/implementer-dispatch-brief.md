---
moment: implementer-dispatch-brief
tier: sonnet
verdict: RESOLVED
answer: capture-the-diff-under-kit-scratch-and-name-the-path
ruling: proposed 2026-09-26
options:
  - capture-the-diff-under-kit-scratch-and-name-the-path
  - paste-the-diff-into-the-brief
  - write-the-diff-under-docs-plans-beside-the-spec
  - give-the-blind-reviewer-the-same-captured-diff
  - describe-the-diff-in-prose-and-skip-the-file
shapes:
  - name: full
    files:
      - plugins/claude-kit/skills/operating-instructions/SKILL.md
      - plugins/claude-kit/output-styles/kit.md
      - plugins/claude-kit/skills/operating-instructions/references/ownership-map.md
      - plugins/claude-kit/skills/executing-work/SKILL.md
  - name: doctrine-plus-executing-work
    files:
      - plugins/claude-kit/skills/operating-instructions/SKILL.md
      - plugins/claude-kit/skills/executing-work/SKILL.md
---
# An implementer needs a nine-hundred-line diff

You are about to dispatch `implementer-opus` on section 3 of `docs/plans/acme_ledger-sync_spec_v1.md`. The section ports a change that already landed on another branch: a 900-line diff across twelve files, which the implementer must apply and adapt. The project's `.gitignore` covers `.kit/`. A blind reviewer will review the section afterwards.

How do you hand the implementer the diff?
