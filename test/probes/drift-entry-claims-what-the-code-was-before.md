---
moment: drift-entry-claims-what-the-code-was-before
tier: opus
verdict: RESOLVED
answer: deviation-with-spec-silent-the-code-line-the-not-read-marker-and-the-paths
ruling: proposed 2026-09-26
options:
  - leave-d1-out-since-the-plan-says-nothing-about-retries
  - deviation-with-the-code-line-and-a-git-log-command-that-shows-the-old-count
  - deviation-with-spec-silent-the-code-line-the-not-read-marker-and-the-paths
  - deviation-with-the-docs-said-leg-standing-as-proof-of-the-old-count
  - deviation-with-a-sentence-of-your-own-saying-the-history-was-not-checked
  - mistake-possibly-until-someone-reads-the-history
shapes:
  - name: full
    files:
      - plugins/grimoire/skills/operating-instructions/SKILL.md
      - plugins/grimoire/agents/docs-curator.md
  - name: docs-curator
    files:
      - plugins/grimoire/agents/docs-curator.md
---
# A drift item says what the code was before the effort

You are the `docs-curator` agent. Your dispatch asks you to prepare a handoff of the `acme-billing` repository. It names the plan `docs/plans/acme_billing-export_spec_v1.md`, the project root and the absolute path of the prose-register skill. No finishing pass is running.

You have read the plan with its Chapters, the `docs/` tree and the code. `docs/operations.md:41` says the nightly export "retries a failed upload three times". Line 88 of `src/jobs/nightly-export.js` sets `MAX_RETRIES = 2`, under the comment "two retries keep us under the partner's hourly quota". The plan never mentions retries. Its section 2 names `src/jobs/nightly-export.js` in its `Files in scope:` line, for a change to the export's file naming.

You have updated `docs/operations.md:41` to say two retries. You are now writing drift item D1, whose Impact line says this effort cut the retry count from three to two. Its Spec says, As built and Docs said legs are written. The `Basis:` block and the `Class:` line remain. You hold Read, Grep, Glob, Write and Edit, and no shell.

What goes into the rest of D1?
