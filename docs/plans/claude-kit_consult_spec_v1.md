# The Consult: a fresh-context ruling instrument, and the Fable cost-hold retirement

Status: In Progress
Commit Model: Commit-and-Push
Fable Spend: S2-S7 fable tiers, per-section fable reviewers, finishing reviews. (S1 retires this header from the kit's spec format; this line is for the pre-S1 reader and is inert once S1 lands.)
Created: 2026-08-15

## Goal

Long execution runs get a standing reasoning-escalation path to match their model-escalation path: the **consult**, a single read-only fresh-context agent at Fable-high, convened whenever a decision is difficult or carries weight - a second failed attempt, a BLOCKED about to be written, a debugging dead end, a weighty spec gap - which rules on the question (rather than surveying it), tests the querent's framing (rather than ratifying it), and hands back an implementable recommendation. The built-in `/advisor` is decommissioned in its favor. Independently but in the same changeset, the `Fable Spend` header and its cost-hold machinery are retired kit-wide: Fable is included in plan allotments, an exhausted allotment blocks rather than bills, and Opus-at-max is the universal stand-in.

## Approach

**Why the consult exists (decided 2026-08-15).** Long Opus sessions burn multiple rounds stuck on problems discovered mid-implementation that the plan never foresaw, escalating late and sometimes on wrong premises. The tier ladder answers "who should write this code"; nothing answers "who should think about this problem." The incident that surfaced this (the sapplefeld-ai-os seven-section run, captured in the 2026-08-15 kaizen note): a section failed two review rounds, the orchestrator correctly diagnosed a spec gap, and the operator BLOCKED it shipped rested on a premise a single fresh-context Fable council member falsified in one read - after which that same member produced the mechanism nobody had named. The built-in advisor was consulted at the right moment during that incident and *confirmed* the wrong framing, because it shares the session's transcript and therefore its blind spots. Heavy advisor usage on this machine coexists with the stuck-burning-rounds failure mode, which is the structural prediction: shared context is good at "check my step," structurally unable to check "is my frame right."

**Why the advisor goes off entirely (decided 2026-08-15).** Three reasons, in weight order: it is unmeasurable (it runs as a server-side tool on this build - `[AdvisorTool] Server-side tool enabled` in `~/.claude/debug/` - and consultations persist in no local transcript, debug log, or metric, so it cannot participate in the kit's evidence discipline); it plausibly suppresses consult adoption (a free in-context second opinion satisfies the urge the consult triggers depend on, and confirms rather than challenges at the moments that matter); and its consultations re-read the transcript at Opus rates for something that cannot materially redirect the session. Sequencing: the flip is the operator's, after the consult ships (Operator Verification below), so the long runs never have zero instruments.

**Why Route A: orchestrator-dispatched, escalation-reached (decided 2026-08-15).** Subagents carry no Agent tool, so implementers cannot convene a consultant. Rather than a headless `claude -p` consult script callable from Bash at any depth (ungoverned execution surface, invisible to the task system and the readonly guard, contends with usage limits inside an implementer's Bash call), the consultant is dispatched only by the main session, and reach goes all the way down semantically: implementers return NEEDS_CONTEXT with the question stated consult-shaped, and the orchestrator's NEEDS_CONTEXT handling forks on spec-answerable versus rulable. The headless route stays a data-driven follow-up, out of scope here.

**Why static Fable-at-high, never dynamic (decided 2026-08-15).** The consult fires at exactly the moment the session's judgment is compromised, so any rule requiring the stuck session to choose a tier correctly fails precisely when needed. The consultant joins the reviewer-effort table's family (executing-work step 3): it aims at fable at `high` (frontmatter default, plain Agent-tool dispatch with the fable model override); where fable is unreachable, Opus at `max` is the stand-in via the Workflow route with `agentType`, `model`, and `effort` all named. The compensation-notch rationale transfers because the consultant is gate-shaped: a shallow ruling gets adopted and steers the section with nothing downstream re-asking the question.

**Why the cost hold dies (decided 2026-08-15, operator ruling).** Anthropic rolled Fable into all plans; it does not bill money. An exhausted allotment blocks the dispatch rather than spilling to usage credits, and the fall-back is exactly the Opus-at-max stand-in the kit already built. So `Fable Spend: none (cost hold)` no longer models anything real, and every cost-hold branch in the kit is dead weight. The header's authorization purpose dies with it: a `fable` tier is no longer a spend decision. What survives, re-grounded: the Fable-led-session-is-for-design guidance (a Fable-led execution session burns the shared allotment fastest where it adds least, and cannot fall back mid-session because the session model is the session), and finishing-work's unavailability rule (attempt the override, read the error, compensate rather than merely fall back, record which happened) - now the *only* discriminator, since its cost-hold sibling is gone.

**Why one spec, not two.** The retirement and the consult rewrite the same lines (executing-work's reviewer table and escalation ladder, finishing-work's review defaults, brainstorming's tier guidance); two concurrent plans would collide file-by-file. S1 runs first so every later section writes against the simplified ground.

**Consult versus its siblings, the discriminator set the prose must carry:** advisor (retired) was "check my step," shared context, zero briefing cost; the **consult** is "check my frame," fresh context, the briefing cost is the mechanism (writing the brief forces the problem outside the session's own reasoning loop); **design-council** is multi-lens divergence at design time with the operator present to adjudicate; **cold** is fresh judgment where the *operator's* preference contaminates the framing; the **reviewers** judge diffs, not questions. The consult's mandate is what made the incident's ruling work: rule, don't survey; end implementable; every stated instinct (operator's or querent's) is flagged as to-be-tested, not ratified.

**Trigger philosophy.** Stuck sessions don't feel stuck - they feel almost done. So the triggers are a counted floor (recognizable by a re-reader, not dependent on felt difficulty) plus a general license on top: (a) a second failed attempt at the same problem, whatever its shape - implementation round, debugging hypothesis, review round; (b) any BLOCKED about to be written - consult first, and only the surviving preference/cost/risk-appetite fork goes to the operator, with the ruling attached; (c) a systematic-debugging dead end, before the stop-and-report; (d) the general license: a decision that is hard to reverse or load-bearing, not covered by the spec, where you would otherwise be guessing. The preference-versus-facts discriminator governs (b): a spec gap is the operator's to answer only where the answer turns on preference, cost, or risk appetite; where it turns on facts about the system it is rulable, and a mixed question is ruled first so what reaches the operator is the small real fork. The floor may widen later on real-run evidence; widening is a wording change, not a redesign.

## Sections of Work

### 1. Retire the cost hold and the Fable Spend header
Model: opus

Remove the `Fable Spend` header and every cost-hold branch from the kit, replacing the underlying availability model with: Fable is included allotment; exhaustion blocks the dispatch; Opus at `max` is the standing stand-in (the substitution notch); unavailability is confirmed from an actual dispatch failure, compensated, and recorded (finishing-work's existing rule, now the only branch).

Files and the change in each, all confirmed by grep this session:
- `plugins/claude-kit/skills/brainstorming/SKILL.md`: drop the `Fable Spend:` line from the spec format (line 61) and rewrite the spend-authorization paragraph (line 48): tiers are no longer spend authorization; keep and re-ground the Fable-led-session-is-for-design guidance per the Approach; the paragraph's advisor sentence ("An Opus advisor is the standing default...") is removed outright, since the advisor is decommissioned - a forward reference to the consult skill is fine, the whole changeset lands together.
- `plugins/claude-kit/skills/executing-work/SKILL.md`: the predates-the-header sentence (line 147), the escalation ladder's cost-hold branch (line 150), the reviewer-table cost-hold row and its never-a-substitution paragraph (lines 165, 168), the reviewer-dispatch cost-hold mentions (line 156), the advisor section's cost-hold sentence (line 222; S4 rewrites the whole section afterward - here just remove the clause), and the Delegating section's standing-directive example list "(the cost hold, the style contract, the exact constraint)" (line 230), which loses its dead first example.
- `plugins/claude-kit/skills/finishing-work/SKILL.md`: lines 12, 14, 20, 32 - remove the cost-hold state everywhere (the finishing reviews' three states become two: fable at `high`, or the compensated stand-in), keep the unavailability rule intact as the sole discriminator.
- `plugins/claude-kit/hooks/session-start.js` (line 263): the resume-push text names "the Fable Spend header makes visible" - reword to the tier assignment alone. This is a hook edit: rebuild the hash manifest and rerun the hook tests per the project memory `hook-edits-require-rebuild`.
- Doctrine, all three copies (`plugins/claude-kit/claude-kit-doctrine.md`, `home/claude-kit-doctrine.md`, `plugins/claude-kit/skills/operating-instructions/SKILL.md`): the standing-dispatch bullet's sentence "Every other rule still binds, the plan's `Fable Spend` header included" loses the header clause. (The covered-class widening in the same bullet is S6's, not this section's; if S6 lands first the sentence is already edited - coordinate via the Chapter.) The orchestration bullet's "the brainstorming skill owns tier bands, Fable spend, and which session model executes what" drops "Fable spend".
- Legacy tolerance, stated in executing-work: a spec predating this change may carry a `Fable Spend:` header line; it is inert - read past it, note it in the first Chapter that touches the spec, honor nothing it says (a legacy `none (cost hold)` included, since the state it modeled no longer exists).

Acceptance: `grep -ri "cost hold\|fable spend" plugins/` returns zero hits outside append-only history; the doctrine-parity suite and the full test suite pass against a recorded baseline; the machine contract in `curating-docs/SKILL.md` is confirmed untouched (Fable Spend was never a contract row - verified this session).
Tests: the doctrine-parity test pins the standing-dispatch bullet across copies - all three copies must move together or the suite goes red; treat a parity red as the gate working. Capture the full-suite baseline before the first edit (two failing memq-shim tests are the standing machine baseline per `docs/backlog.md`).

### 2. The consultant agent
Model: fable

New agent definition `plugins/claude-kit/agents/consultant.md`. Frontmatter: read-only tools (Read, Grep, Glob, Bash), `effort: high`. The description must surface mid-execution to a stuck orchestrator (this is the filing failure that hid design-council during the incident): name the triggers ("second failed attempt", "about to write a BLOCKED", "a debugging dead end", "a weighty decision the spec does not cover") and the mandate in the description itself. The body carries the charter: rule, don't survey; ground every load-bearing claim in evidence actually read (file:line, schema, real data - a finding is a hypothesis until confirmed); test the querent's stated framing and any stated operator instinct rather than ratify them, and say explicitly when the right answer is that the question itself is wrong; end with an implementable recommendation, the confidence level, and exactly what would change it; flag any genuine preference/cost/risk-appetite fork as the operator's, cleanly separated from what was ruled.

Guard coverage: the readonly-agent-guard keys on agent type (inferred from the reviewer-effort effort's records; verify the mechanism in `hooks/readonly-agent-guard.js` before editing). Add `consultant` to the governed class so a Workflow-dispatched consultant stays read-only, mirroring how the reviewers are covered. Hook edit: rebuild the manifest, extend the guard tests both directions (a write-shaped Bash command from a consultant is denied; its read commands pass).
Tests: at minimum, lock both guard directions for the new agent type; a silent write allowance is the expensive failure.

### 3. The consult skill
Model: fable

New skill `plugins/claude-kit/skills/consult/SKILL.md`. The catalog description is a trigger surface: it must fire for a stuck orchestrator mid-execution and for the operator directly ("get a consult on X", "second opinion on this problem"). Contents:
- The trigger floor and the general license, verbatim from the Approach, plus the preference-versus-facts discriminator and the rule that a mixed question is ruled first.
- The brief template: the decision stated plainly; the evidence (for a review-failure consult, both rounds' surviving findings; for a debugging consult, the hypothesis history); the repo paths worth reading; the querent's current lean, explicitly labeled as an instinct to test; what an implementable answer looks like. Bulky evidence goes to `.kit/` scratch, referenced by path.
- The model rule: fable at `high` (the agent's frontmatter default) via a plain Agent-tool dispatch with the fable model override; where fable is unreachable (confirmed from an actual dispatch failure, per finishing-work's rule), Opus at `max` via the Workflow route with `agentType`, `model`, and `effort` all named - the same template executing-work's reviewer-dispatch block carries.
- Adjudication: the ruling is a hypothesis until the orchestrator checks it against the real code; adopt what holds, record the ruling and what was discarded in the Chapter, and when the ruling leaves a preference fork, that fork goes to the operator as the BLOCKED, with the ruling attached.
- The sibling discriminators (consult / design-council / cold / reviewers) from the Approach, one line each, and the advisor's retirement noted as present-tense fact (the kit uses no in-context advisor; the consult is the escalation instrument) - the history lives in this plan, not the skill.
- The standing-authorization sentence (the doctrine's dispatch request covers convening a consult autonomously, no per-plan ask) is S6's to add here, after the doctrine amendment it depends on lands; this section leaves the slot with no placeholder.

### 4. Executing-work: the consult replaces the advisor
Model: fable

In `plugins/claude-kit/skills/executing-work/SKILL.md`:
- Replace the "The advisor" section (lines 220-224) with "The consult": what it is, the pointer to the consult skill as owner of triggers and mechanics, the discriminator line, and the note that the kit runs with no in-context advisor.
- The completion contract's blocker path: before any BLOCKED is written, the consult runs first (unless the question is pure preference); the BLOCKED that survives carries the ruling. This amends the "Stop only for a true blocker" block, not the blocker set itself.
- The fix-the-generator rung (line 150): the no-class-repeats branch's terminal changes from "raise the section to me as a decision brief" to "convene a consult on the spec's premise; escalate only the preference fork that survives, ruling attached." The class-repeats branch (tier is the lever) is untouched.
- NEEDS_CONTEXT handling (line 149) gains the fork: answerable from the spec or conversation, answer and re-dispatch as today; genuinely hard (the spec is silent because nobody foresaw it), convene a consult and fold the ruling into the re-dispatch brief.
- Chapter format: the Metrics line's `advisor <model | off>` field becomes `consults <n>` (count of consults this section, zero included); the data-feed sentence (line 254) re-points from the advisor experiment to consult adoption. The Metrics line is not in the frozen machine contract (verified this session: only the Chapter heading, `Completed:`, and `Next:` are parsed).
- The Dispatch Brief template gains one line: when returning NEEDS_CONTEXT on a hard question, state it consult-shaped (the decision, the options you see, the evidence, your lean).
Tests: covered by S7's probes; no code changes in this section.

### 5. Reach: implementer agents, systematic-debugging, design-council
Model: opus

- The four implementer agents (`implementer-{haiku,sonnet,opus,fable}.md`, the NEEDS_CONTEXT bullet in each): remove the advisor sentences (the advisor no longer exists to be handed); add the consult-shaped question guidance - a hard uncovered decision is still NEEDS_CONTEXT, never a guess, and stating it as decision/options/evidence/lean lets the orchestrator route it to a consult without a round-trip of clarification. Haiku's variant keeps its mis-banding rule (a decision-shaped question in a transcription section means the section was mis-banded).
- `plugins/claude-kit/skills/systematic-debugging/SKILL.md`: the dead-end stop-and-report rule gains the consult as the step before the report - a dead end is trigger (c), and the report that still goes out carries the ruling.
- `plugins/claude-kit/skills/design-council/SKILL.md`: description gains one line distinguishing the consult (single seat, ruling mandate, mid-execution, auto-convenable) from the council (multi-lens, design-time, operator-present, never auto-run), so the next stuck orchestrator's catalog read finds the right instrument.

### 6. Doctrine: widen the covered class
Model: fable

In all three doctrine copies: the standing-dispatch bullet's covered class widens from "a covered dispatch is a reviewer dispatch" to cover the consultant on identical terms - a read-only, guard-governed `agentType` needing its effort set per call (the Opus-at-max stand-in path is the only consult dispatch that needs the Workflow route). Keep the bullet's lapsing logic intact and extend it: the grant lapses for both classes if the Agent tool gains a per-dispatch effort parameter. Check `test/doctrine-parity.test.js` for how the third parity test pins this bullet (literal text versus cross-copy comparison) and update it in the same change if it pins a literal. One additional doctrine sentence, in the orchestration bullet or beside it: the consult is part of the standing dispatch expectation, like the reviewer pair. With the doctrine amended, add the standing-authorization sentence to the consult skill (the slot S3 left open): the doctrine's dispatch request covers convening a consult autonomously, no per-plan or per-session ask.
Tests: doctrine-parity suite green with the new wording across all three copies.

### 7. Probes: RED/GREEN on the trigger wording
Model: fable

Per the writing-skills skill, the behavior-shaping changes (S3's triggers, S4's pre-BLOCKED and fix-the-generator wording) get probes: a stuck-session scenario where correct behavior is consult-before-third-attempt (RED against the pre-change wording, GREEN after), and a spec-gap scenario where correct behavior is consult-then-BLOCKED-with-ruling rather than bare BLOCKED (failure signature: a BLOCKED with no ruling attached, or a third same-tier attempt). Probe mechanics per the operator memory `probe-scripts-scratchpad-and-controls`, and heed the journal note: doctrine-refresh reverts hand-deployed doctrine at session start, so stage probe wording in the plugin cache, not `~/.claude`.
References: `plugins/claude-kit/skills/writing-skills/SKILL.md`.

### 8. Docs and decommission
Model: opus
Locus: inline

- `docs/backlog.md`: retire the "Open experiment: Opus advisor on execution sessions" item to a dated snapshot with the closing evidence recorded: the advisor runs as a server-side tool on this build (debug-log enablement lines, zero consultation records anywhere local), consultations were observed firing frequently on live Opus sessions by the operator, and the feature is decommissioned in favor of the measurable consult, superseded rather than disproven. Note in the same entry that the Chapter Metrics `advisor` field is retired with it.
- `docs/backlog.md`: add one item: "Consult adoption watch" - judge the trigger floor on the first real long run (consult counts in Chapters, BLOCKEDs arriving with rulings attached, rounds-burned-before-consult), and widen or tighten the floor on that evidence.
- `kaizen/notes-SCOTT-CLAUDE.md`: the 2026-08-15 fix-the-generator note is applied by this plan; clear it per the kaizen skill's mechanics. The 2026-08-12 register note is untouched and stays.
- `docs/README.md`: the index entry moves from Active to the archive narrative at close-out (curating-docs owns the ritual).

## Out of Scope

- Route B: the headless `claude -p` consult script. Revisit only if the adoption watch shows implementers stalling on questions that never reach the orchestrator.
- Doctor automation of the advisor settings change (it is one operator action; automating a one-time removal fails the minimum-that-solves-it bar).
- Brainstorming-time consult offers beyond the design-council cross-reference; the council remains the design-stage instrument.
- Any AI OS (Spine) change: the machine contract is untouched, and the Metrics field it never parsed stays unparsed.
- Widening the trigger floor speculatively; the adoption-watch backlog item owns that.

## Operator Verification

- Turn the advisor off after the plugin update lands on this machine: `/advisor off` (or remove the `advisorModel` line from `~/.claude/settings.json`). The kit never edits live machine settings. If long-run quality visibly degrades with no consults firing, that outcome reopens S3/S4's trigger wording rather than the decommission.
- After the first real long run: read the run's Chapters for `consults <n>` counts and check any BLOCKED that reached you carried a ruling. A BLOCKED with no ruling and no consult in the Metrics is the failure signature that reopens S4.

## Related

- Builds on `archive/claude-kit_reviewer-effort-compensation_spec_v1.md` (the effort table, the Workflow dispatch route, the compensation-notch rationale the consultant inherits).
- Consumes the 2026-08-15 kaizen note in `kaizen/notes-SCOTT-CLAUDE.md` (the fix-the-generator rung) and retires the `docs/backlog.md` advisor experiment.

## Open Questions

None material. The trigger floor's width is deliberately deferred to the adoption-watch backlog item rather than held open here.

## Chapters
