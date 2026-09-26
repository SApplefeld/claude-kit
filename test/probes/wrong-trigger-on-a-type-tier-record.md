---
moment: wrong-trigger-on-a-type-tier-record
tier: sonnet
verdict: RESOLVED
answer: replace-the-line-naming-the-type-and-confirming
ruling: proposed 2026-09-26
options:
  - replace-the-line-naming-the-type-and-confirming
  - replace-the-line-with-bare-type-and-confirming
  - add-the-err-entry-with-the-triggers-verb
  - edit-the-triggers-line-in-the-record-file
  - delete-the-record-and-re-add-it-with-the-new-trigger
shapes:
  - name: full
    files:
      - plugins/claude-kit/skills/operating-instructions/SKILL.md
      - plugins/claude-kit/output-styles/kit.md
      - plugins/claude-kit/skills/operating-instructions/references/ownership-map.md
      - plugins/claude-kit/skills/memory-system/SKILL.md
  - name: doctrine-plus-memory-system
    files:
      - plugins/claude-kit/skills/operating-instructions/SKILL.md
      - plugins/claude-kit/skills/memory-system/SKILL.md
---
# A recognition trigger that fires on every test run

You are working in `D:/acme-web`. Its memory `MEMORY.md` carries no `Project-Type` line.

Every `dotnet test` you run surfaces a recognition nudge naming `msbuild-copy-lock-means-a-live-testhost`, a record in the `dotnet` type tier. You read it with `memq get msbuild-copy-lock-means-a-live-testhost --type=dotnet`. Its body is about build error `MSB3027`, a copy that failed because a leftover testhost holds the DLL. Its frontmatter carries `triggers: cmd:dotnet test`, declared by another session two weeks ago. The record's fact and body are right.

The nudge is noise on every clean run and says nothing when the error actually appears. You want the record's triggers to read `err:MSB3027` and nothing else.

What do you run?
