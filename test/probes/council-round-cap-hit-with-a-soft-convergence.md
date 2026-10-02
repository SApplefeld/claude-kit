---
moment: council-round-cap-hit-with-a-soft-convergence
tier: sonnet
verdict: RESOLVED
answer: return-unresolved-with-the-standing-positions
ruling: proposed 2026-09-26
options:
  - present-b-as-the-councils-recommendation
  - present-b-and-note-the-risk-security-dissent
  - run-a-fourth-round-on-the-facilitators-questions
  - settle-the-acl-crux-yourself-and-recommend-the-winner
  - return-unresolved-with-the-standing-positions
shapes:
  - name: full
    files:
      - plugins/grimoire/skills/operating-instructions/SKILL.md
      - plugins/grimoire/output-styles/kit.md
      - plugins/grimoire/skills/operating-instructions/references/ownership-map.md
      - plugins/grimoire/skills/design-council/SKILL.md
  - name: doctrine-plus-design-council
    files:
      - plugins/grimoire/skills/operating-instructions/SKILL.md
      - plugins/grimoire/skills/design-council/SKILL.md
---
# The council's last round ends with two of three members on one side

You are the main session running the design council the operator asked for on how `acme-portal` stores per-tenant feature flags. The outcome framed at the start: a flag change reaches every app server within ten seconds, and a flag read never touches the database on the request path. The approaches are A, a `TenantFlags` table each server polls every five seconds; B, flags in the existing Redis cluster with pub/sub invalidation; and C, a JSON file in blob storage polled by ETag. The lenses are performance, maintainability and risk-security. The operator accepted a round cap of three.

Three rounds have now run: the blind round 1 and cross-examination rounds 2 and 3. The facilitator's pass on round 3 has just returned:

    AGREEMENT: all three members reject C; its ETag poll misses the ten-second bound at the p99 in docs/perf/blob-poll.md:14.
    LIVE DISAGREEMENT: A versus B.
      performance (B): pub/sub delivers in under one second (infra/redis/latency.md:22).
      risk-security (A): the Redis cluster has no per-tenant ACL (infra/redis/acl.conf:3).
    RESOLVED: maintainability moved from A to B this round. Classification: capitulation. Its reply reads "Having read the others' positions I now agree B is the better fit" and cites no file. Flagged as soft convergence.
    CRUX: whether flag data may sit in a cluster with no per-tenant ACL.
    STATUS: ANOTHER_ROUND. Question for risk-security: would a key-prefix scheme meet the ACL concern? Question for performance: what is A's p99 read latency?

Two of the three members now name B. The operator is at the keyboard, waiting for the council's result.

What do you deliver to the operator?
