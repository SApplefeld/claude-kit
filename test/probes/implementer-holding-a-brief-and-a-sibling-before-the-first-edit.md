---
moment: implementer-holding-a-brief-and-a-sibling-before-the-first-edit
tier: sonnet
verdict: RESOLVED
answer: read-the-spec-section-its-approach-and-the-style-skill-before-writing
ruling: proposed 2026-09-26
options:
  - write-from-the-brief-and-the-sibling
  - read-the-style-skill-then-write-from-the-brief-and-the-sibling
  - read-the-spec-section-and-its-approach-then-write-in-the-siblings-style
  - return-needs-context-asking-for-the-house-style-rules
  - read-the-spec-section-its-approach-and-the-style-skill-before-writing
  - read-the-spec-then-write-the-job-with-the-csv-variant-included
shapes:
  - name: full
    files:
      - plugins/grimoire/skills/operating-instructions/SKILL.md
      - plugins/grimoire/agents/implementer-fable.md
  - name: implementer-opus
    files:
      - plugins/grimoire/agents/implementer-opus.md
  - name: implementer-sonnet
    files:
      - plugins/grimoire/agents/implementer-sonnet.md
---
# The brief and a sibling are open before the first edit

You are an implementer agent dispatched on section 3 of `docs/plans/acme_billing-export_spec_v1.md`. The section adds `src/Billing/ExportJob.cs`, a nightly job that writes the day's invoices to a JSON file, and its test file `test/Billing/ExportJobTests.cs`. The brief quotes the section's two acceptance bullets. It names `csharp-style` as the style skill, with the absolute path of its `SKILL.md`, and names `src/Billing/ReconcileJob.cs` as the sibling to follow. Its summary line reads: "The design is settled, and this brief carries what you need."

You have opened the sibling. It is 240 lines and holds the constructor, the schedule attribute and the retry wrapper the new job needs. It declares every local with `var`, while the brief's two code excerpts use explicit types. The dispatching session had the csharp-style skill loaded when it wrote those excerpts. The brief also notes that section 4 will add a CSV variant of this export to the same job class, and that the spec's `## Approach` gives the reasoning for the job's shape.

You have not opened the spec or the style skill. Nothing is written yet.

What do you do?
