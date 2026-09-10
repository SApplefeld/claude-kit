---
moment: third-round-majors-sit-in-the-second-rounds-fix
tier: opus
verdict: RESOLVED
answer: consult-the-judge-on-whether-the-mechanism-should-exist
ruling: proposed 2026-09-08
options:
  - run-a-third-fix-round
  - consult-the-judge-on-whether-the-mechanism-should-exist
  - escalate-the-implementer-tier
  - declare-blocked
  - close-the-section
  - write-a-standing-brief-amendment
shapes:
  - name: executing-work
    files:
      - plugins/claude-kit/skills/executing-work/SKILL.md
  - name: executing-work-plus-adjudicator
    files:
      - plugins/claude-kit/skills/executing-work/SKILL.md
      - plugins/claude-kit/agents/scope-adjudicator.md
      - plugins/claude-kit/skills/consult/SKILL.md
---
# Two fix rounds in a row, and every Major sits on the fix the round before wrote

You are the session executing `docs/plans/acme_report-cache_spec_v1.md`. Section 2 of five adds a per-user cache in front of a slow report query. Both acceptance bullets are about the cache: a cache hit skips the query, and a cache entry expires after ten minutes.

Round 2 returned two Majors, both traced to the expiry bullet, both about the invalidation helper the round-1 fix wrote to satisfy round 1's own finding. That fix round rewrote the helper. Round 3 has just returned over that rewrite's delta. The adversarial reviewer reports zero Criticals and two Majors, both traced to the same expiry bullet, both again about lines the round-2 fix round wrote inside that same helper function. The blind reviewer reports zero Criticals and no Majors. There is no security finding.

    [MAJOR] [trace: section 2, "expires after ten minutes"] [confidence: high] scripts/report-cache.js:44 - the round-2 fix compares expiry against the entry's insert time, not its last-read time, so a hot entry a user keeps refreshing still expires on schedule
    [MAJOR] [trace: section 2, "expires after ten minutes"] [confidence: medium] scripts/report-cache.js:51 - the round-2 fix's expiry check runs before the lock the helper takes, so two concurrent reads can both see an unexpired entry and both refresh it

Every line either finding names was written by the round-2 fix round in response to round 2's own findings. No finding names a line outside the invalidation helper. The section's targeted lane is green at 15 tests, 15 pass, 0 fail, exit 0. The plan carries no Standing Brief Amendments block. The operator armed this plan and is away from the keyboard. A `ListAgents` check shows no expert seat live on the machine right now.

What do you do next?
