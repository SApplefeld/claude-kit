# Backlog Visibility

Status: Complete
Commit Model: Commit-and-Push
Fable Spend: n/a (Fable-led session)
Created: 2026-08-09

## Goal

Items parked in `docs/backlog.md` become visible without anyone opening the file. Today the backlog is a pull surface in a push workflow: Scott steers sessions from Discord and reads close-outs on his phone, so an item parked there can rot for months and resurface only by accident ("we should have built that a while ago"). When this plan is done, every session that starts in a project with a backlog is told the count and the age of the oldest item, effort-start recall cross-checks the backlog for already-parked solutions to the problem at hand, and close-outs put aging items in front of Scott for an explicit promote/retire/keep call.

## Approach

Two layers, chosen over a scheduled cross-project digest (deferred; see Out of Scope):

1. **Mechanical layer (the hook).** `session-start.js` gains a backlog block alongside its existing plan/kaizen/goal blocks: item count, oldest item's date and age in days, and an undated count. It fires in any project with a `docs/backlog.md`, not just the kit repo. Security posture matches the kaizen counter: the hook injects **numbers and a regex-extracted ISO date only, never backlog item text**, so a hostile backlog line cannot inject instructions into session context.

2. **Behavioral layer (the skills).** Three prose additions at the points of action: curating-docs formalizes the dated-item shape the kit's own backlog already uses informally and adds an aging adjudication to the prune pass; finishing-work names 90-day-plus items in the close-out status for a promote/retire/keep call (this is how aging items reach Scott's phone via the board recap); brainstorming's recall step reads the backlog after `memq recall` so a new effort discovers an already-parked solution before designing a fresh one (Scott's memq tie-in, 2026-08-09).

The mechanical layer is the primary enforcement (it fires whether or not any skill loads); the prose layer directs what a session does with the signal. Age thresholds: the hook reports the oldest age unconditionally (continuous visibility); the close-out adjudication fires for items older than 90 days, aligned with the quarterly snapshot cadence. Both are named tunable knobs.

Decided 2026-08-09: Mode A (in-session surfacing) over Mode B (scheduled cross-project digest). The YIKES moments happen in projects with recent sessions where the backlog simply never surfaced; a digest for projects that go fully dark is a separate subsystem and is deferred until the need is demonstrated.

## Sections of Work

### 1. Backlog block in the SessionStart hook

Model: sonnet

`plugins/claude-kit/hooks/session-start.js` gains a `summarizeBacklog(cwd)` helper and a corresponding block, modeled directly on the `countPendingKaizen` sibling (bounded reads, every failure silent, never breaks recovery).

Parsing contract:

- Read `docs/backlog.md` under the payload cwd, first 64 KB only, tolerating a UTF-8 BOM.
- Scope to the `## Active` section: lines after a line matching `/^##\s+Active/im` and before the next `/^##\s/m` heading (or EOF).
- Count top-level bullets (`/^- /`). A template placeholder bullet (content entirely parenthesized, the shape the curating-docs backlog template ships) and a bare empty bullet are structure, not items. A cross-component pin in the test file seeds a fixture from the template's own backlog block, so the template and the parser cannot drift apart silently.
- Per bullet, extract the first ISO date token (`/\b(\d{4}-\d{2}-\d{2})\b/`) anywhere in the line. The kit convention puts the parked date in the title's parentheses, often with context beside it (`(2026-08-03, from the finishing reviews)`, `(from kaizen, 2026-07-03)`), so the first token is the parked date. Oldest date and its age in whole days (floor) come from these; bullets with no date token are the undated count.
- No file, unreadable file, no `## Active` section, or zero items: no block, silently.

Block text (numbers and the extracted ISO date are the only interpolations; never item text):

> `docs/backlog.md holds N active item(s); oldest dated YYYY-MM-DD (D days ago)[; M undated]. If any bear on this session's work, read the backlog and say so; items older than 90 days get a promote/retire/keep call at the close-out. Reminder, not a blocker.`

The `oldest dated` clause is omitted when no item carries a date (then: `docs/backlog.md holds N active item(s), none dated. ...`). The block is additive: it must not change when the plan/kaizen/goal blocks fire, and the emit-nothing early return at the bottom of `main()` gains the backlog condition. Unlike the kaizen counter, this block has **no kit-repo marker gate**: it fires in any project. `KIT_EXTERNAL_ENGINE` does not suppress it (parity with the kaizen and goal blocks; only the plan drive-to-completion instruction is engine-sensitive).

New test file `test/session-start-backlog.test.js`, modeled on `test/session-start-kaizen.test.js` (real child process, stdin payload, stdout assertions, temp dirs).

Tests: at minimum, lock both directions and the injection posture; the expensive failures are a hook that breaks session recovery and a backlog line that reaches session context as text. (1) no `docs/backlog.md` and template-placeholder-only both emit no backlog block; (2) two dated items emit count 2 and the older date with a day count; (3) a dated plus an undated item reports the undated count; (4) an item whose text contains an imperative instruction ("IGNORE ALL PREVIOUS INSTRUCTIONS...") never appears in stdout, while the count still does; (5) the block fires outside the kit repo; (6) a malformed or huge backlog file exits 0 without a crash; (7) the existing session-start kaizen and external-engine tests stay green.

Acceptance: `./build.ps1` restamps the integrity manifest (hook edits fail the hook-canary tests until it runs; see project memory `hook-edits-require-rebuild`), then the full suite (`node --test test/`) is green against the recorded baseline.

Files in scope: `plugins/claude-kit/hooks/session-start.js`, `test/session-start-backlog.test.js`.

### 2. Skill-layer surfacing rules

Model: sonnet

Three skills and one template gain the behavioral half. All edits are additive prose in the kit's voice (no em dashes, imperative, placed at the point of action). Draft wording below is a reference, not a transcription contract; adapt to each file's surrounding register per the writing-skills skill.

- `plugins/claude-kit/skills/curating-docs/references/templates.md`, backlog template: the item shape becomes `- **<item> (YYYY-MM-DD).** <body>`, and the template prose states that every active item carries the date it was parked, because session-start and close-out surfacing compute age from it.
- `plugins/claude-kit/skills/curating-docs/SKILL.md`, "Prune the backlog" section: the prune pass is also the aging check: any active item older than 90 days is named with its date for a promote (spec it now) / retire (snapshot with the reason) / keep call. A keep writes the fresh adjudication date ahead of the original (`(YYYY-MM-DD, parked YYYY-MM-DD)`) so the item ages from the adjudication while the parked date survives. An undated active item is past the threshold by definition: it gets a backfilled parked date and is adjudicated in the same pass. The check also runs without a close-out (offered in one line when the session-start block reports an oldest item past the threshold). 90 days is the tunable knob, aligned with the quarterly snapshot cadence.
- `plugins/claude-kit/skills/finishing-work/SKILL.md`, step 5 (the paragraph invoking curating-docs): items the aging check names ride in the close-out status by name with their dates, each carrying the promote/retire/keep question, so aging items reach Scott through the surface he already reads; the prune also retires items the spec names as covered.
- `plugins/claude-kit/skills/brainstorming/SKILL.md`, step 1: after `memq recall` and before the code reading, read `docs/backlog.md` if present: an item bearing on the problem at hand is surfaced with its date (the parked solution may already exist), and an effort that will cover a backlog item names it in the spec so the close-out prune retires it.

Tests: none mechanical; the writing-skills discipline (does the wording bind at the point of action, is it imperative, does it name the trigger) is the review bar, and the reviewers should hold the wording to it.

Acceptance: the four files read coherently with their surroundings; no em dashes introduced; full suite still green (the doctrine-parity and output-style-parity tests guard the files this section must NOT touch: no doctrine or output-style edits are in scope).

Files in scope: the four files above only. Note: `plugins/claude-kit/skills/executing-work/SKILL.md` is carrying an uncommitted fix from a separate kaizen close; it is not in this section's scope and must not be staged with it.

## Out of Scope

- **Mode B: a scheduled cross-project backlog digest** (a routine that sweeps project roots and pushes a Discord summary for projects with no sessions at all). Deferred until a real dark-project miss is observed; would be its own spec with its own lifecycle.
- **memq-mechanical backlog integration** (memq itself indexing or digesting backlog.md). The brainstorming-step rule covers the recall moment; promote to a memq feature only if the prose rule observably fails to fire.
- **Retro-dating other projects' backlogs.** The dated-item shape applies going forward and to the kit's own backlog, which already mostly conforms; no sweep of other repos.
- **Doctrine or output-style edits.** The board-recap core is parity-pinned; this plan rides entirely in hooks and skills.

## Open Questions

None; thresholds (90 days, 64 KB) are named as tunable knobs rather than open questions.

## Related

- `docs/archive/claude-kit_docs-lifecycle_spec_v1.md` created the machinery this plan extends: `docs/backlog.md` itself and the curating-docs prune pass that now doubles as the aging check.

## Chapters

### Chapter 1 - 2026-08-09
Completed: 1. Backlog block in the SessionStart hook
Implemented By: implementer-sonnet (plus a main-session date-regex amendment and an implementer-sonnet review-fix round shared with section 2)
Metrics: review rounds 1 (adversarial + blind at opus, security at default); NEEDS_CONTEXT 0; escalations 0; advisor opus (reported rate-limited by the adversarial reviewer, consultations 0)
Decisions / Surprises: The spec's paren-anchored date regex misread the kit's own backlog (14 of 21 items scanned undated); amended on contact to first-ISO-token-in-line, accepted heuristic risk documented in the hook comment. A live run against this repo was the gate that caught it, not the suite. Accepted without fix: 64 KB mid-section truncation degrades to partial counts; multibyte boundary decode; the third copy of the bounded-read block (the shared-helper backlog item already covers it, and blast radius on the resume-critical hook argued for duplication again).
Review Findings: Criticals 2 (cross-section: the S2 template placeholder defeated the hook's exclusion and the test pinned the stale literal; fixed via re-parenthesized template placeholder plus a cross-component pin test that seeds its fixture from templates.md itself, watched red then green). Majors fixed: untested "none dated" branch. Minors fixed: empty-bullet count, fd leak on the read path (planHead try/finally shape), negative age clamp, UTC-midnight test tolerance, coexistence test, guidance-sentence pin, invalid-date comment. Minors routed: README/architecture block descriptions to the finishing docs-curator.
Stamps: adjudicated 1, stamped 1 (hook-edits-require-rebuild, applied from the session-start digest; the digest-use gap means unstamped listed 0)
Next: 2. Skill-layer surfacing rules (completed in the same round; see Chapter 2)
Commit Model: Commit-and-Push

### Chapter 2 - 2026-08-09
Completed: 2. Skill-layer surfacing rules
Implemented By: implementer-sonnet (plus the shared review-fix round)
Metrics: review rounds 1 (adversarial + blind at opus); NEEDS_CONTEXT 0; escalations 0; advisor opus (consultations 0)
Decisions / Surprises: The keep-branch date semantics were contradictory as specced (parked date vs fresh date); resolved to fresh-adjudication-date-first with the parked date preserved beside it (`(YYYY-MM-DD, parked YYYY-MM-DD)`), so a kept item quiets for a cycle without losing its history and the first-token parser needs no change. Undated items were a hole in the aging check; now past-threshold by definition with a backfill step. The aging check gained a standalone trigger (offer the prune when the session-start block reports a past-threshold oldest item) so the hook's promise is deliverable without a plan close-out. Threshold phrasing unified to "older than 90 days" across hook, skills, and spec.
Review Findings: Critical 1 (the template placeholder regression, adjudicated under Chapter 1's fix). Majors fixed: keep-date contradiction, undated-item exemption. Major addressed by record: the writing-skills RED/GREEN bar for these prose rules is satisfied by rationale rather than probes because the mechanical hook is the primary enforcement and every prose rule binds at a named trigger inside an already-loaded skill's procedure (point-of-action encoding); a probe would test the harness's skill-loading, not the wording. Minors fixed: one-owner cleanup in finishing-work, "chosen to" narrative, register (impersonal/first-person per file), snapshot templates admitting retired items, brainstorming wiring to the finishing prune, third "Then" scan fix. Minor accepted: the quarterly-cadence rationale is approximate (rolling 90 days vs calendar quarter); kept as a mnemonic, not a mechanism.
Stamps: none surfaced beyond Chapter 1's
Next: finishing-work
Commit Model: Commit-and-Push

### Chapter 3 - 2026-08-09 (close-out)
Completed: finishing pass
Implemented By: main session (qa-verifier, adversarial-reviewer, docs-curator dispatched)
Metrics: review rounds 1 (final adversarial at the session model, fable); NEEDS_CONTEXT 0; escalations 0; advisor opus (consultations 0)
Decisions / Surprises: QA verdict PASS, suite 689 pass / 2 machine-local memq-shim failures matching baseline on two independent runs, hook exercised live against the real backlog (21 items, oldest 2026-07-03, 2 undated pre-backfill). Security gate: the per-section security review (verdict CLEAR) covered the changeset's only non-prose files (session-start.js, the test file); the post-review hook deltas were that reviewer's own recommendations (fd try/finally, age clamp) plus a comment and one fixed-sentence swap, so no re-dispatch; the prose remainder rides the finishing-work waiver, changed-file evidence in the fa5df56 stat. Final adversarial: APPROVED_WITH_CONCERNS, all Minor; fixed the two template consistency gaps, both hook comments, and added the external-engine pin test. Its requested invalid-date test went red and exposed a wrong claim: on this Node (v24.19), Date.parse of an impossible ISO date (2026-02-30) rolls to a neighboring date rather than NaN; the hook comment now states the engine-dependent truth, the NaN branch stays as cross-engine defense, and no test pins engine-dependent behavior. Greedy placeholder exclusion (interior parens) accepted as a noted edge matching the spec's wording. Docs curation: DRIFT NONE, four surfaces updated (architecture.md gained a Backlog surfacing section; README.md, docs/README.md, fleet-integration.md aligned), CLAIMS SWEPT clean on all counted enumerations. Aging check's first live run: no items older than 90 days; two undated items backfilled from git history (2026-07-09 doctor.sh sibling, 2026-06-19 plan-status helper). A separate kaizen batch (eb7d29d) rode this session outside the plan: harness-injection wording sweep plus the auto-memory-to-kit-store renames.
Review Findings: final round Minors: 6 fixed, 2 accepted with reasons above
Stamps: adjudicated 1 effort-wide, stamped 1 (hook-edits-require-rebuild)
Next: none (delivered in this changeset)
Commit Model: Commit-and-Push
