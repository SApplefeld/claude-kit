---
moment: decay-pass-archiving-across-three-tiers
tier: sonnet
verdict: RESOLVED
answer: split-by-tier-rollup-once-type-call-unconfirmed-first
ruling: proposed 2026-09-26
options:
  - split-by-tier-rollup-once-type-call-unconfirmed-first
  - one-call-with-every-archive-flag-and-confirm-shared
  - split-by-tier-with-rollup-on-every-call
  - project-call-then-one-confirmed-call-for-both-shared-tiers
  - archive-the-project-record-and-leave-the-shared-tiers
shapes:
  - name: full
    files:
      - plugins/claude-kit/skills/operating-instructions/SKILL.md
      - plugins/claude-kit/output-styles/kit.md
      - plugins/claude-kit/skills/operating-instructions/references/ownership-map.md
      - plugins/claude-kit/skills/finishing-work/SKILL.md
      - plugins/claude-kit/skills/memory-system/SKILL.md
  - name: doctrine-plus-memory-system
    files:
      - plugins/claude-kit/skills/operating-instructions/SKILL.md
      - plugins/claude-kit/skills/memory-system/SKILL.md
---
# Archiving three records from three tiers in one decay pass

You are at the memory step of the finishing pass for `docs/plans/acme_invoice-dedupe_spec_v1.md`, in `D:/acme`, whose memory `MEMORY.md` declares `Project-Type: dotnet`. The unstamped sweep is done. `memory/decay-stamp` is 19 days old, so the decay pass is due.

`memq decay-scan` printed three archive candidates, and you have judged that each should be archived:

1. `acme-legacy-invoice-path`, a project-tier record.
2. `dotnet-sdk-7-pin`, a type-tier record under `dotnet`. `D:/acme-web` on this machine also declares `Project-Type: dotnet`.
3. `old-vpn-split-tunnel`, an operator-tier record with no `machine:` field.

None of the three is pinned. The journal has not been rolled up since the last pass.

How do you shape the `memq decay-prune` calls for this pass?
