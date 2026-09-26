---
moment: section-close-gate-after-a-shared-module-change
tier: sonnet
verdict: RESOLVED
answer: run-the-targeted-lane-and-record-it-by-name-with-its-delta-against-the-targeted-baseline
ruling: proposed 2026-09-26
options:
  - run-the-targeted-lane-and-record-it-by-name-with-its-delta-against-the-targeted-baseline
  - run-the-whole-gate-because-the-change-reaches-a-shared-module
  - run-the-targeted-lane-and-record-no-regressions-across-the-suite
  - run-the-whole-gate-and-read-its-counts-against-the-targeted-baseline
  - run-the-targeted-lane-and-record-its-pass-count-alone
shapes:
  - name: full
    files:
      - plugins/claude-kit/skills/operating-instructions/SKILL.md
      - plugins/claude-kit/output-styles/kit.md
      - plugins/claude-kit/skills/operating-instructions/references/ownership-map.md
      - plugins/claude-kit/skills/executing-work/SKILL.md
      - plugins/claude-kit/skills/testing-discipline/SKILL.md
  - name: doctrine-plus-testing-discipline
    files:
      - plugins/claude-kit/skills/operating-instructions/SKILL.md
      - plugins/claude-kit/skills/testing-discipline/SKILL.md
---
# A section closes after a change to a module the whole tree imports

You are executing `docs/plans/acme_retry-policy_spec_v1.md`, whose header reads `Commit Model: Branch-and-PR`. You are on `claude/retry-policy-7c2`, cut off `main` before the first commit. Section 2 of four changed `src/shared/backoff.js`, a module that 38 source files across the repository import, and its test file `test/backoff.test.js`. Nothing the section changed is machine-shared state.

Before the section started you ran the targeted lane the project's memory tier records for this module. It covers `test/backoff.test.js` and the two whole-tree pins whose subject the module is: 64 tests, 64 pass, 0 fail, exit 0. No whole-gate run has been recorded since the plan began, and the whole gate takes about forty minutes on this box.

Both reviewers have returned and their findings are fixed. The section's Chapter is written except its `Gate:` line. After the section's commit you will push the branch, and a required CI workflow on the branch's pull request gates every merge to `main`.

The operator armed this plan and is away.

How do you gate this section's close, and what does the `Gate:` line record?
