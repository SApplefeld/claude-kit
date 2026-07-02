# Fable Metering: Two-Mode Sessions and Deliberate Fable Spend

Status: Complete
Commit Model: Commit-and-Push
Fable Spend: n/a (Fable-led design session; effort predates July 7 metering)
Created: 2026-07-02

## Goal

On July 7, 2026, Fable moves to per-call API billing with no plan coverage; observed worst case is ~$100/hour of Fable-led work against a $2K/month budget (~20 Fable-hours). The kit gains a two-mode operating doctrine that makes every Fable token a deliberate purchase: Fable-led sessions for design, spec-writing, and adjudication; Opus-led sessions for plan-covered execution, with Fable entering by default at exactly the judgment moments that constitute oversight (fable-tier sections, tier escalation, finishing reviews), and an explicit, never-silent cost-hold opt-out. Alongside the mode doctrine: two agents that never needed the top model get pinned to opus, recon dispatches get a cheap-model default, the implementer brief template gains the sibling-breadth line that would have prevented both first-round Majors in the fitness-elicitation effort, and the Sonnet tier-widening experiment gets a recorded protocol.

## Approach

**The session model is the mode; /model is the toggle.** No new config. A Fable-led session behaves as today (dispatch-by-default already treats the main thread as the most expensive locus, now literally true in dollars). An Opus-led session executes an approved spec plan-covered, and reaches Fable only by explicit per-call model override on Agent dispatches.

**Spec tier = spend authorization.** A section tiered `fable` in an approved spec is standing authorization to dispatch it to `implementer-fable` with the `fable` model override from a lower-model session, mirroring the Commit-and-Push pattern (the header authorizes, execution never stops to ask). The spec header carries a `Fable Spend:` line naming the expected Fable surface so the purchase is visible at approval time.

**Fable oversight is the default in Opus-led mode, not a spec opt-in.** Finishing-pass adversarial and security reviews escalate to Fable by override; a section that fails review twice escalates through `implementer-fable` (override) before any main-thread takeover on a lower-model session. Per-section reviews and qa-verifier evidence-gathering stay at plan-covered models; the fresh-eyes strong-model verdict on the whole changeset is the high-leverage half (evidence: fitness-elicitation S4's Major was caught exactly there).

**The opt-out is explicit and visible.** On a "no Fable" cost hold: record `Fable Spend: none (cost hold)` in the spec header, run finishing reviews at the session model, build fable-tier sections at the session model with the downgrade flagged in the Chapter so a later Fable pass knows where to look. Never silently.

**Reviewer agents stay unpinned deliberately** (adversarial-reviewer, security-reviewer, council-member): they inherit the session model, which does the right thing in both modes, plus the finishing-pass override above. qa-verifier and docs-curator pin to opus: their work is disciplined evidence-gathering and doc-writing, not novel judgment, and should not ride the session model up to Fable prices.

### Decision record (decided 2026-07-02)

- D1: Mode toggle is the session model via /model, not a config flag.
- D2: Spec tier assignments are standing Fable-spend authorization in lower-model sessions; no per-dispatch asks.
- D3: Finishing-pass adversarial AND security reviews escalate to Fable by default in Opus-led mode.
- D4: Adopt the sibling-breadth brief line now; run the Sonnet experiment (next two S1-class sections to sonnet with the upgraded brief, count re-dispatch rounds vs the opus baseline of one round each); tier-boundary rewording stays kaizen-gated on that evidence.
- D5: Commit model for this effort is Commit-and-Push (matches this repo's direct-to-main history).
- Cost-hold semantics: downgrade-with-flag (build at session model, flag in Chapter), not deferral; chosen because the user's framing is "save cost," not "pause work." Reversal is cheap (one doctrine sentence) if flagged downgrades prove risky.
- Evidence basis: overnight fitness-elicitation session's self-report verified against its exported transcript by a sonnet-pinned scout (all seven load-bearing claims CONFIRMED; one nuance: S4's "finishing review 1 Major/1 Minor" aggregated adversarial-reviewer + qa-verifier findings).

## Sections of Work

### 1. Pin qa-verifier and docs-curator to opus
Model: fable (inline) - too small to brief.
Add `model: opus` to the frontmatter of `plugins/claude-kit/agents/qa-verifier.md` and `plugins/claude-kit/agents/docs-curator.md` (same placement as `implementer-opus.md`'s pin).
Acceptance: both files carry `model: opus` in frontmatter; no other frontmatter or body changes.

### 2. Recon dispatches cheap
Model: fable (inline) - too small to brief.
Append to the "Spend the parallelism on analysis and review" doctrine bullet, in BOTH mirrors (`home/claude-kit-doctrine.md` ~line 119 and `plugins/claude-kit/skills/operating-instructions/SKILL.md` ~line 124): a sentence establishing that recon/scout dispatches carry an explicit cheap model override (sonnet) by default, because scouts produce leads that are confirmed before anyone designs on them, so top-model recon is pure burn.
Acceptance: identical sentence in both mirrors; the two files' orchestration sections remain textually identical to each other.

### 3. Session-mode doctrine
Model: fable (inline) - doctrine prose evolving in contact with the existing text.
The core change, five files:
- **Doctrine mirror pair** (`home/claude-kit-doctrine.md`, `plugins/claude-kit/skills/operating-instructions/SKILL.md`): new bullet in "Orchestrating fan-out work," after the "Implementation defaults to dispatch" bullet, covering: session model = mode; Fable-led for design/adjudication/finishing of high-stakes efforts; Opus-led execution reaches Fable only by explicit override at the judgment moments (fable-tier sections per spec authorization, twice-failed escalation, finishing adversarial + security reviews by default); explicit cost-hold opt-out with downgrade-with-flag semantics.
- **brainstorming SKILL.md**: spec-format header gains the `Fable Spend:` line; step 11 gains one sentence making a `fable` tier assignment double as spend authorization named in that header line.
- **executing-work SKILL.md**: step-1 dispatch bullet notes the `fable` model override (the model parameter on the Agent dispatch) when the session model is lower, locates the standing authorization in the approved spec's tier assignment (the `Fable Spend` header is the visibility surface, not the authorization locus), and defines the legacy default (a spec predating the header is still authorized by its tiers; the header is added on first touch); tier-escalation bullet: after two failed reviews at the assigned tier, a Fable-led session takes the section into the main thread (unchanged); a lower-model session re-dispatches a below-fable section once to `implementer-fable` with the `fable` override and takes it into the main thread only if that also fails, while a fable-tier section that failed twice has exhausted its tier and raises the stall rather than downgrading; under a recorded cost hold the escalation stays at the session model and the stall is raised to me.
- **finishing-work SKILL.md**: steps 2 and 3 dispatch with the `fable` model override by default when the session model is lower, honoring a recorded cost hold.
- **session-start.js** resume instruction (~line 146): one clause so a resumed Opus-led session knows fable-tier dispatches carry the override under the spec's authorization.
Acceptance: both doctrine mirrors identical; each skill states the behavior above without contradicting the tier contract from b510edc; `node --check` passes on session-start.js.

### 4. Sibling-breadth brief line
Model: fable (inline) - too small to brief.
- Doctrine mirror pair, "Subagents inherit the catalog" bullet: extend the final briefing sentence so implementers are also briefed to name the sibling that already handles the failure mode and mirror its breadth (catch scope, regex generality); generalization gaps, not tier gaps, produced the recent first-round Majors.
- executing-work step-1 brief-contents list: add the sibling-pattern item.
Acceptance: identical doctrine sentence in both mirrors; executing-work brief list carries the item.

### 5. Kaizen note: Sonnet experiment protocol
Model: fable (inline) - trivial.
Extend the pending 2026-06-30 note in `kaizen/notes-SCOTT-DESKTOP.md` with the verified n=1 evidence (defect count tracked section complexity, not tier; opus's differentiator was brief-contradiction handling) and the protocol: dispatch the next two S1-class sections to sonnet with the upgraded brief template; count re-dispatch rounds against the opus baseline of one round each; widened-tier wording additionally requires verified anchors and a self-surfacing failure mode in the brief.
Acceptance: the note carries evidence + protocol + the anchors/failure-mode criterion; still one note, not a duplicate.

## Out of Scope

- Rewording the sonnet/opus tier boundary (kaizen-gated on the experiment's evidence).
- Pinning adversarial-reviewer, security-reviewer, or council-member (deliberately unpinned; see Approach).
- Any billing detection or automation; the mode is a human choice at session start.
- Design-council economics (already cost-authorized per run by its own skill).

## Open Questions

- **Mixed per-call billing (owner: Scott, before July 7).** The design assumes one session can mix plan-covered Opus/Sonnet calls with API-billed Fable calls, in both directions. Verify against the July 7 announcement. If billing routes per-session instead, the fallback is fully separate Fable sessions with handoff through the plan doc; the doctrine bullet would need its override language softened to "or a dedicated Fable session."
- **Sonnet experiment results (owner: next two S1-class efforts).** Feeds the kaizen-gated tier rewording.

## Related

No plan ancestry; builds directly on commits dc128d8 (dispatch-by-default doctrine) and b510edc (tier/locus split, implementer-fable).

## Chapters

### Chapter 1 - 2026-07-02
Completed: 1. Pin qa-verifier and docs-curator to opus
Implemented By: main session (fable (inline), too small to brief)
Decisions / Surprises: `model: opus` placed after the `tools:` line, matching implementer-opus. None else.
Review Findings: per-section review skipped (two-line frontmatter change); covered by the finishing pass.
Next: 2. Recon dispatches cheap
Commit Model: Commit-and-Push

### Chapter 2 - 2026-07-02
Completed: 2. Recon dispatches cheap
Implemented By: main session (fable (inline))
Decisions / Surprises: sentence appended to the "Spend the parallelism" bullet in both mirrors; mirror-identity gate (diff of the Orchestrating sections) passed.
Review Findings: per-section review skipped (one sentence, two mirrors); covered by the finishing pass.
Next: 3. Session-mode doctrine
Commit Model: Commit-and-Push

### Chapter 3 - 2026-07-02
Completed: 3. Session-mode doctrine
Implemented By: main session (fable (inline))
Decisions / Surprises: new doctrine bullet sits between "Implementation defaults to dispatch" and "Spend the parallelism" in both mirrors. finishing-work got one shared paragraph before Steps rather than per-step clauses (reads cleaner, same behavior). session-start.js resume clause extended; `node --check` green. Sections 2, 3, and 4 interleave in the same files (doctrine mirrors, executing-work), so they land in one consolidated commit; git cannot split a mixed file and the section boundaries are recorded here instead.
Review Findings: per-section review deferred to the finishing pass (combined whole-changeset adversarial + security), per the small-effort rule in finishing-work.
Next: 4. Sibling-breadth brief line
Commit Model: Commit-and-Push

### Chapter 4 - 2026-07-02
Completed: 4. Sibling-breadth brief line
Implemented By: main session (fable (inline))
Decisions / Surprises: doctrine sentence extends the existing briefing sentence in the "Subagents inherit the catalog" bullet; executing-work brief list gains the sibling-pattern item after acceptance criteria. Mirrors still identical (gate re-run green).
Review Findings: covered by the finishing pass.
Next: 5. Kaizen note: Sonnet experiment protocol
Commit Model: Commit-and-Push

### Chapter 5 - 2026-07-02
Completed: 5. Kaizen note: Sonnet experiment protocol
Implemented By: main session (fable (inline))
Decisions / Surprises: extended the existing 2026-06-30 note in place (one note, no duplicate), adding the transcript-verified n=1 evidence, the two-section sonnet experiment protocol, and the verified-anchors/self-surfacing-failure-mode criterion for the eventual tier rewording.
Review Findings: covered by the finishing pass.
Next: finishing-work
Commit Model: Commit-and-Push

### Chapter 6 (close-out) - 2026-07-02
Completed: finishing pass over the whole effort.
Implemented By: main session; qa-verifier and docs-curator dispatched with opus overrides (dogfooding S1's pins, since the installed plugin predates them), reviewers at session model.
QA: PASS on every gate and all five sections' criteria (hook syntax, mirror byte-identity, em-dash sweep, per-section content, clean tree at 6c925f9).
Security review: CLEAR, 2 Minors. (1) Resume-clause authorization wording hardened, then subsumed by the adversarial locus fix below. (2) The pre-commit-rebuilt plugin zip's build-info stamp inherently reads one commit behind with dirty:true; predates this effort, not fixed here, proposed as a kaizen note.
Adversarial review: APPROVED_WITH_CONCERNS, 4 Major / 3 Minor, all addressed. Majors: (1) escalation hole closed - a fable-tier section that fails twice in a below-fable session raises the stall instead of downgrading; (2) authorization locus unified - the approved spec's tier assignment authorizes, the Fable Spend header is the visibility surface, and a legacy spec without the header stays authorized by its tiers (header added on first touch); (3) the b510edc "inherits the session model" framing reconciled with the override contract at four sites (doctrine mirrors, brainstorming step 11, implementer-fable description, README MODEL TIERING); (4) the override mechanism is now named in executing-work: the model parameter on the Agent dispatch, confirmed working by three overridden dispatches in the delivering session. Minors: doctrine cost-hold sentence now covers the escalation moment; the Fable Spend template gained the n/a (Fable-led session) form; the previously uncommitted README/hook edits are recorded here and land in this close-out commit.
Docs curation: Drift Report was deviation-only. D1: root README MODEL TIERING had gone stale against the as-built tier contract; the curator rewrote it (verified faithful to the doctrine bullet, em-dash clean by two independent counts). D2 (finishing-work shared paragraph) and D3 (S2-S4 consolidated commit) were already recorded in Chapter 3. No mistakes; nothing blocked.
Decisions / Surprises: review fixes touched two files beyond the spec's original file list (implementer-fable.md, README.md), required by the reconciliation Major; spec S3 text updated to the corrected semantics. The spec itself carried the escalation hole the review found - the fresh-eyes finishing pass catching the spec author's own gap is the mode design working as intended.
Review Findings: all Criticals n/a, all Majors fixed, both security Minors adjudicated (one fixed, one justified to kaizen).
Delivered: commits 99d876c, 9f7f4b9, 00c340e, 6c925f9 plus this close-out commit on main.
Commit Model: Commit-and-Push
