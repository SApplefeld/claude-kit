---
moment: one-box-fact-learned-inside-a-project
tier: sonnet
verdict: RESOLVED
answer: add-an-operator-record-scoped-to-this-machine
ruling: proposed 2026-09-26
options:
  - add-an-operator-record-scoped-to-this-machine
  - add-an-operator-record-with-no-machine-scope
  - write-the-record-into-memory-operator-with-the-write-tool
  - add-a-type-record-for-dotnet
  - write-a-project-memory-in-this-checkout
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
# A fact about this machine, learned inside one project

You are working in `D:/acme`, whose memory `MEMORY.md` declares `Project-Type: dotnet`. The machine's hostname, as `os.hostname()` reports it, is `SCOTT-DEV`.

The project's `docker compose up` failed because port 1433 was already bound. You traced it: this box runs a machine-wide SQL Server Express service on 1433, installed by hand last year. So any project on this box that maps 1433 in a compose file will fail the same way, whatever its type. Your other two machines have no such service, and the same compose file starts cleanly there.

You want the next session that meets this failure to recognize it without re-tracing it. `memq find 1433` returns no lexical hit and no semantic hit above the overlap floor.

Where and how do you record this fact?
