# Kit Output Style

Status: Complete
Commit Model: Commit-and-Push
Fable Spend: n/a (Fable-led session)
Created: 2026-08-01

## Goal

The kit ships a custom Claude Code output style, `Kit`, that makes the communication register harness-enforced: the style rides the system prompt and is re-asserted after every tool result, so the register binds at turn 200 the way CLAUDE.md prose cannot. The style carries two layers: a style-owned shell (reader definition, teaching posture, the ★ Insight and ⚖ Decision block mechanics) and a register core that is byte-identical with the operating doctrine, pinned by a new parity test. It activates automatically wherever the kit plugin is enabled.

## Approach

Decided by design council, 2026-08-01 (three blind lenses: behavior-shaping, maintainability, operational risk; facilitator verdict CONVERGED). The full verdict lives in this session's record; the operative conclusions:

- **Scoped Option C won.** The register core exists byte-identically on both surfaces: the doctrine (which subagents inherit via CLAUDE.md and which survives every style-deactivation trigger) and the style (the only surface that binds late in a long session). Option A (style as sole owner, doctrine slimmed to pointers) lost on coverage: subagents and style-less surfaces would receive pointers to content they cannot load, and the style has at least five silent deactivation triggers (plugin update lag, force flag ignored by an older harness, non-Code surfaces, future deprecation, safe mode disabling non-builtin styles). Option B (additive-only) lost on the outcome: it keeps the register solely on the fading surface and creates untestable paraphrase adjacency.
- **Whole bullets, no sentence splitting.** Blended register-plus-process bullets ride whole into the style; splitting manufactures unpinnable paraphrase halves, the drift class the 2026-07-14 audit documented. Redundant process clauses on the main thread are harmless under `keep-coding-instructions: true`.
- **No doctrine edits.** The core is extracted from the doctrine by bullet lead (the existing doctrine-parity per-bullet pin idiom, generalized), so the doctrine files carry no region markers. The style alone carries BEGIN/END markers delimiting its core region. Sync direction: operating-instructions skill (source) to doctrine mirror to style core.
- **Style-owned shell content never enters the doctrine** (subagents inherit the doctrine; block mechanics in a worker's context would reshape its reports).
- **`keep-coding-instructions: true` is mandatory.** Verified in the installed binary: without it, the style silently removes Claude Code's built-in software-engineering instructions from every kit session.
- **`force-for-plugin: true`, decided 2026-08-01.** Scott: one less setting to drift per machine; the style subsumes the built-in Explanatory style he currently pins, so the override costs nothing he values. Rollback is removing the flag; safe mode is the always-available escape hatch.
- **Shell tweaks, decided 2026-08-01:** no named expert domains in the reader definition (assume intelligent outsider until Scott's own words in the effort demonstrate depth), and a second block type, ⚖ Decision, for calls reached within the assistant's remit.

## Sections of Work

### 1. Ship the style and its gates
Model: opus

Create two files, test first.

**`test/output-style-parity.test.js`** (write first, watch it fail for the right reason: style file absent). Node built-in test runner, conventions of `test/doctrine-parity.test.js` (line-ending normalization, BOM strip, frontmatter handling). It must assert:

1. **Frontmatter pins:** the style file's YAML frontmatter contains exactly `name: Kit`, a non-empty quoted `description`, `keep-coding-instructions: true`, and `force-for-plugin: true`.
2. **Core extraction and parity:** the style body contains exactly one `KIT-REGISTER-CORE:BEGIN` / `:END` marker pair. Between them, in order: the seven core bullets, then the Before-you-send section, then nothing else (containment: after removing the named elements and blank lines, the region is empty). Each core bullet is located by lead in BOTH doctrine copies (`plugins/claude-kit/skills/operating-instructions/SKILL.md` body and `home/claude-kit-doctrine.md`), must appear exactly once in each, and must byte-equal the style's copy. The Before-you-send segment is compared as the doctrine's `## Before you send` header through end-of-body against the style's corresponding region segment.
3. **Both directions:** a probe test is not required in the file, but the implementer must verify red/green by hand once (mutate one core line in the style, watch parity fail, restore, watch it pass) and report both observations.

The seven core bullet leads, in order (each a single line in the doctrine starting with the lead):

1. `- **Skip the preamble.**`
2. `- **Disagree up front.**`
3. `- **No false certainty, no flattery.**`
4. `- **Teach the why; treat design as a dialog.**`
5. `- **Write every decision ask to the client-briefing register.**`
6. `- **Narrate the cadence, and close with the state.**`
7. `- **Close with the board when plans are pending, and never assume I remember a plan.**`

**`plugins/claude-kit/output-styles/kit.md`**: frontmatter plus shell exactly as given in References below, with the core region assembled by copying the seven bullet lines and the `## Before you send` section verbatim (byte-identical, blank line between elements) from `plugins/claude-kit/skills/operating-instructions/SKILL.md` (the canonical source). Do not retype; copy.

Acceptance: the new test fails before the style file exists and passes after; full suite `node --test test/*.test.js` green (baseline 477 pass, 0 fail; expect baseline plus the new tests, with the two hook-canary stale-stamp failures acceptable only if hooks were touched, which this section does not do).

Tests: at minimum, lock the parity in both directions (a mutated core line fails, restored passes) and the two frontmatter flags exactly (`keep-coding-instructions` absent or false is the expensive silent failure).

References: the verbatim shell content below.

```markdown
---
name: Kit
description: "Scott's register: teaching depth, insight and decision blocks, on the kit doctrine's communication core."
keep-coding-instructions: true
force-for-plugin: true
---

# The reader

You are writing for Scott. He is a deep expert in some of what you touch and an intelligent outsider in the rest, and the mix changes by task. Assume the intelligent outsider until his own words in the effort at hand demonstrate depth in a domain; where he has spoken its language, answer at that depth. He often reads on his phone, sometimes hours after the session ended, with no terminal and no session context in front of him.

Err toward overexplaining. He skims past what he already knows at no cost; what he cannot recover is a judgment made on an explanation that was too thin. When in doubt: one more sentence of why, one more concrete example.

# Teaching

Teach while you work. Scott should finish each effort understanding the system better than he started, not just holding a result. Explanations are about this codebase, this decision, this failure, never generic programming lessons; prefer a concrete example from the work at hand over an abstract statement of the principle. When explaining or giving insights, you may exceed normal conciseness expectations; stay focused and relevant.

Before and after significant work, add a brief insight block:

`★ Insight ─────────────────────────────────────`
[2-3 points: what is non-obvious about this specific choice, codebase, or result: the constraint that shaped the design, the trap avoided, the pattern worth reusing]
`─────────────────────────────────────────────────`

When you weigh options and reach a call inside the work (a design choice, an approach, a root-cause conclusion), show the reasoning in a decision block:

`⚖ Decision ────────────────────────────────────`
[the fork you faced, the options weighed, why the winner won and what it cost]
`─────────────────────────────────────────────────`

Decision blocks explain calls already made within your remit; a decision that is Scott's to make still goes to him as a decision ask per the communication core below. Skip either block when there is genuinely nothing non-obvious; an empty ritual teaches nothing.

# The communication core

In the core below, "I" and "me" are Scott.

<!-- KIT-REGISTER-CORE:BEGIN (byte-identical with the operating doctrine; edit the doctrine, sync here; pinned by test/output-style-parity.test.js) -->
<!-- KIT-REGISTER-CORE:END -->
```

(The core content rides between the markers; the block above shows them empty only to define the shell.)

## Out of Scope

- Any edit to the doctrine copies or other skills (the extraction-by-lead design requires none).
- The `On craft and visual work` bullet (workflow, not ambient register; revisit on evidence).
- Settings-sync automation across machines (separate idea, backlogged separately if wanted).
- kit-doctor reporting of the active style (add later if a silent-deactivation trigger actually bites).

## Open Questions

None.

## Related

- `claude-kit_doctrine-delivery_spec_v1.md`: how the doctrine reaches each surface; this effort adds the third register surface on top of that delivery.
- `claude-kit_doctrine-rightsizing_spec_v1.md`: what earns always-on space; the register core is the subset that earned a second always-on carrier.
- `claude-kit_fleet-integration_spec_v1.md`: the engine contract whose workers inherit the doctrine but never the style; that reader split is why the core lives byte-identical on both surfaces.

## Chapters

### Chapter 1 - 2026-08-01

Completed: 1. Ship the style and its gates
Implemented By: implementer-opus
Metrics: 1 review round (adversarial APPROVED_WITH_CONCERNS; blind APPROVED_WITH_CONCERNS); NEEDS_CONTEXT 0; escalations 0
Review Findings: adversarial 1 Major (the spec's quoted-description pin was unenforced) plus 3 Minor, all fixed or satisfied; blind 1 Major (the two harness flag keys are unverifiable from the repo, answered by the out-of-repo verifications and recorded as a constraint comment beside the pins) plus 4 Minor, 3 fixed, 1 accepted as-is (the mirror-vs-skill parity legs are redundant with doctrine-parity's whole-body check; kept for self-containment).
Decisions and surprises: the core is extracted by bullet lead, so the doctrine files needed no edits and carry no markers; the Before-you-send comparison runs from its header to end of body by design (it is the doctrine's last section) and its failure message states that assumption; the doctrine copies are CRLF while the style and tests are LF, normalized exactly as the sibling parity test does; the frontmatter is pinned as a closed set of four keys with an exactly-once duplicate-key guard layered beneath (both layers probe-verified independently red). Red-first held throughout: 11 named-test failures before the style file existed, green after, and both-direction mutation probes restored by digest.
Gate: 488 tests, 488 pass, 0 fail (baseline 477/477 before the section).
Verification limit: live activation (force-for-plugin superseding the machine's outputStyle setting) is observable only in a session loaded after the next plugin update; output-styles/ discovery is confirmed from current docs and the installed binary, not yet from a live session.
Next: finishing pass (QA verification, docs curation, close-out and archive).
Commit Model: Commit-and-Push

### Chapter 2 - 2026-08-01

Completed: 1. Ship the style and its gates
Finishing pass: QA PASS (488/488; every criterion evidenced, and the readonly-agent-guard correctly blocked the verifier's one mutation-probe attempt). Security review CLEAR, scoped to the one non-prose file; its Minor (the flag pins accepted a quoted true) is fixed: the name and both flag pins now compare the raw bare token, and the description carries a two-character floor. Final adversarial APPROVED: machine contract, cross-file cohesion, and debris all clean; two degenerate-input Minors fixed alongside the security Minor, the colon-less-line diagnostic garble accepted (fails loud, ugly message), and the block-width finding declined because the opening rules' dash counts differ precisely to equalize total width against the differing label lengths. Docs curation: three deviations, no mistakes; architecture.md gained a register-surfaces subsection and its payload and prose enumerations now include the style, security-model.md now names the style as unhashed model-facing payload (the build manifest hashes hooks only), and whether to widen the build stamp to cover model-facing prose is surfaced as Scott's decision rather than resolved here. Cross-references added per the curator's gap note. Gate after the finishing fixes: 488 tests, 488 pass, 0 fail.
Verification limit standing: live activation (force-for-plugin superseding a machine's outputStyle, output-styles/ discovery, per-tool-result re-assertion) is confirmed from current docs and the installed binary; a live session loaded after the next plugin update is the observation that closes it.
Next: none; effort complete, delivered in this changeset.
Commit Model: Commit-and-Push

