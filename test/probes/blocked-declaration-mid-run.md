---
moment: blocked-declaration-mid-run
tier: sonnet
verdict: RESOLVED
answer: lead-with-a-blocked-line-then-the-brief
ruling: proposed 2026-09-26
options:
  - lead-with-a-blocked-line-then-the-brief
  - recap-the-shipped-work-then-the-blocked-line
  - end-on-a-waiting-line-naming-the-certificate
  - keep-working-until-the-operator-notices
  - lead-with-a-blocked-line-giving-context-limits-as-the-reason
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
# A section needs a certificate only the operator can install

You are running `docs/plans/acme_invoice-signing_spec_v1.md` under an armed completion leash. Sections 1 and 2 are closed, committed and pushed. Section 3 signs invoices with the company's code-signing certificate, which lives in the operator's hardware token and is not on this machine. Sections 4 and 5 both call section 3's signer, so no section can move until the certificate is installed.

No expert seat and no coordinator seat is live on this machine. The operator is away and reads the relay thread on a phone.

How does the message that ends your turn begin?
