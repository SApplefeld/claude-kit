# Doctrine Rightsizing for the Claude 5 Baseline

Status: In Progress
Commit Model: Commit-and-Push (kit repo). Section 5 runs Branch-and-PR to `develop` in D:\personal\Neuro-Evolution-Operations (branch-protected; Scott approves the PR).
Fable Spend: S1 audit and adjudication in-session (n/a, Fable-led session); implementers at opus/sonnet; finishing reviews at session model.
Created: 2026-07-25

## Goal

The always-loaded doctrine (`plugins/claude-kit/skills/operating-instructions/SKILL.md` and its byte-identical body copy `home/claude-kit-doctrine.md`, ~6,340 words) carries only content that is general, earned, and not already guaranteed by the Claude 5-generation harness baseline. Everything else relocates to the surface that owns it: skill bodies (progressive disclosure), the csharp-style skill, or the Neuro-Evolution-Operations project CLAUDE.md. Motivated by Anthropic's context-engineering guidance for Claude 5-generation models (judgment over rules, progressive disclosure, single source of truth, rich references).

## Approach

Three streams, all approved by Scott 2026-07-25:

1. **Baseline-redundancy trim.** The 5-gen Claude Code system prompt and tool descriptions now cover ground the doctrine also covers (lead-with-the-outcome, code-comment discipline, autonomy defaults, faithful reporting, PowerShell 5.1 encoding traps in the tool description). Trim exact duplicates, keep the Scott-specific deltas. Every cut is proposed as before/after and approved item-by-item before any edit (S1 produces the list; S2 applies it).
2. **Progressive disclosure.** Move the "Orchestrating fan-out work" section (~1,100 words) out of the always-on doctrine into the skills that own those moments (executing-work, brainstorming), leaving a strong one-line pointer. Risk accepted: ad-hoc orchestration outside a skill invocation relies on the pointer triggering the skill load.
3. **One-codebase example sweep.** Generalize or relocate examples that came from a single codebase (verdicts recorded below). Rich-references guidance is added to brainstorming/executing-work in the same pass.

Doctrine sync mechanism (confirmed): the skill file is the single source; `home/claude-kit-doctrine.md` is kept body-identical by hand (see commit ea95530); the doctrine-refresh hook propagates the installed plugin's skill body to `~/.claude/claude-kit-doctrine.md` on session start, and `doctor.ps1` (line ~475) verifies freshness. Repo edits ship inert to live sessions until the next kit update (plugin cache is a commit-prefix snapshot).

### Approved one-codebase verdicts (2026-07-25)

- **A (relocate + generalize):** "Nothing untrue ships" bullet. Doctrine keeps one generalized line: "Nothing untrue ships. Never publish invented metrics, testimonials, or claims about behavior the code doesn't have; a promise made on a public surface must be honored in code. Where a project defines honesty or privacy gates, treat a violation as a defect and sweep the whole tree, not just your diff." The product-specific rules (zero-customer framing; no owner name, location, state of incorporation, or entity name; the gate-test contract) move to a new root CLAUDE.md in Neuro-Evolution-Operations (repo currently has none), citing its real gates: `tests/NeuroEvolutionOperations.Web.Tests/HonestyGuardrailTests.cs` and `EnterpriseFramingGateTests.cs`. Both edits land in the same effort so no session falls in the gap.
- **B (generalize):** training/serving sentence becomes "When one consumer of shared data is degenerate while another is healthy, suspect the contract at the boundary, not the data."
- **C (generalize wording):** Blazor vocabulary in "What the test suite can't see" becomes "live-connection or streaming behavior"; the anecdote becomes "A large suite can pass while an error page never renders and a live connection hangs." The real-browser-walk rule is untouched.
- **D (generalize):** "Live" test taxonomy becomes "Run one integration-test process at a time per shared resource, ordered fast -> integration -> end-to-end; a solution-wide parallel run collides shared fixtures."
- **E (relocate to csharp-style):** "Resolve options lazily at request time..." and "order middleware by cost (rate-limit before auth)" leave the doctrine; both land in the csharp-style skill.
- **F (genericize):** "canon strings" becomes "canonical constants" in the single-sourcing rule.
- **G (keep):** the 20s/60s observation-window parenthetical and the subagent bug-example list stay as-is (judgment-teaching examples that generalize).

### Approved baseline-trim verdicts (decided 2026-07-26, all as recommended)

- **H1 (rewrite, low priority):** "Lead with the answer" retitles to its delta: "Skip the preamble. No 'great question,' no 'you're right.' Name the fork and give the recommendation first." (Baseline owns lead-with-the-outcome.)
- **H2 (merge):** delete the standalone "Comment the current state, not the change" bullet (baseline owns comment discipline); the "Documents ship the current state" bullet opens with "Code comments and every shipped artifact document the current state, never the change-narrative; the journey lives in git."
- **H3 (trim):** autonomy bullet keeps only the deltas: interrupt conditions and the unprompted close-out ritual.
- **H4 (cut to habit line):** PowerShell 5.1 bullet becomes one line (commit via `git commit -F`, source files via Edit tool or explicit UTF-8; the active shell's tool description owns per-host encoding/quoting traps). Removes the Out-File UTF-16 claim, which contradicts this harness's tool description (UTF-8 with BOM here; Set-Content is the ANSI default).
- **H5 (light trim):** "Route around the harness" drops the blocked-sleep explanation (Bash tool description owns it); curl.exe tip and permission-file boundary stay.
- **H6 (trim):** agent-liveness bullet keeps "no completion notification means alive" plus kill-then-redispatch; drops the explanation the Agent tool description now owns.
- **H7 (keep):** "Name the rollback" stays as-is; the Verify section and "Disagree up front" were checked and left alone.

### Lesson-not-incident capture rule (added 2026-07-26)

Scott's addition, built in this effort rather than jotted to kaizen: lessons are captured one level more general than the incident that taught them ("state the lesson, not the incident" - a hot stove teaches hot metal, not one stove at a time). Placement: one sentence in the doctrine's Kaizen capture section (it governs capture); the fuller rule with the hot-stove framing goes in the kaizen skill, which owns the capture bar. Applies to kaizen notes, memory writes, and doctrine additions alike.

## Sections of Work

### 1. Rightsizing design: baseline audit + orchestration coverage map + final edit texts
Model: fable (inline)
In-session design work. (a) Present the baseline-redundancy before/after list to Scott for item-by-item approval; (b) read executing-work and brainstorming in full and map which "Orchestrating fan-out work" content is already covered there, what moves where, and the doctrine pointer wording; (c) produce the exact final edit texts for S2-S4 (including the rich-references bullets and csharp-style additions) so those sections are transcription. Output: approved edit list appended to this spec under "S1 Edit List" before S2 starts.

### 2. Doctrine edits
Model: sonnet
Apply the S1 edit list (baseline trims + verdicts A-G + orchestration pointer) to `plugins/claude-kit/skills/operating-instructions/SKILL.md`, and mirror the body into `home/claude-kit-doctrine.md`. Exact replacement texts come from the S1 list; no editorial judgment. No em dashes anywhere.
Acceptance: `diff <(tail -n +5 SKILL.md-with-frontmatter) home-copy` is empty (frontmatter is the only difference; verify the actual frontmatter line count before trusting the tail offset); `node --test test/hook-canary.test.js` still passes (it references the doctrine; check what it pins); doctor's doctrine check logic unaffected.
Tests: the two-surface sync is the risk; lock it with the diff gate above, run both directions (pre-edit diff empty, post-edit diff empty).

### 3. executing-work + brainstorming updates
Model: opus
Absorb the orchestration content per the S1 coverage map (add only what those skills do not already state; no duplication) and add the rich-references guidance: acceptance criteria as runnable checks or rubrics where possible; prefer a mockup or reference implementation over a prose description for UI/visual work. Follow the writing-skills skill when editing skill bodies.
Files: `plugins/claude-kit/skills/executing-work/SKILL.md`, `plugins/claude-kit/skills/brainstorming/SKILL.md`.
Acceptance: every orchestration rule from the removed doctrine section is either present in an owning skill or named in the S1 map as intentionally dropped; word-count delta reported.

### 4. csharp-style and kaizen skill additions
Model: sonnet
Add the two relocated .NET lessons (options resolved lazily at request time; middleware ordered by cost) to `plugins/claude-kit/skills/csharp-style/SKILL.md`, and the lesson-not-incident capture rule to `plugins/claude-kit/skills/kaizen/SKILL.md`, each in the target skill's register, using the exact texts from the S1 list.

### 5. Neuro-Evolution-Operations CLAUDE.md + PR
Model: opus
In D:\personal\Neuro-Evolution-Operations: branch from `develop`, create a root `CLAUDE.md` carrying the relocated product rules (verdict A) plus the "Live" suite naming note (verdict D), citing the two gate-test files. Open a PR to `develop` for Scott's approval. Leave the untracked concurrent work (`src/NeuroEvolutionOperations.AdminPortal/Properties/`) alone; stage only CLAUDE.md.
Acceptance: PR open against `develop`; branch contains exactly one new file.

### 6. Finishing
Model: fable (inline, main session orchestrates)
Re-run gates (kit tests, doctor), dispatch finishing reviews per finishing-work (all-prose changeset; apply the security waiver if it qualifies), docs curation, close-out Chapter, archive via curating-docs, memory writes.

## Out of Scope

- Rewriting rule-dense doctrine sections into pure "judgment" prose beyond the approved items (Scott declined the blanket version).
- Any tool-interface or hook behavior changes; auto-memory changes (already aligned with the article).
- Cutting doctrine content whose baseline "coverage" lives only in this session's system prompt variant without a Scott-approved before/after.

## Open Questions

- None blocking. S1's baseline-trim items await Scott's item-by-item verdicts (the in-conversation gate this spec plans for).

## S1 Edit List (final, 2026-07-26)

All doctrine edits apply to `plugins/claude-kit/skills/operating-instructions/SKILL.md`, mirrored byte-identically (minus frontmatter) into `home/claude-kit-doctrine.md`. OLD anchors are from the live doctrine body; if an OLD string does not match exactly, locate the bullet by its bolded lead-in, apply the replacement semantically, and flag the mismatch in the report. No em dashes anywhere.

### Doctrine edits (S2)

**E1 (H1).** Replace the "Lead with the answer" bullet with:
`- **Skip the preamble.** No "great question," no "you're right." Name the fork and give the recommendation first.`

**E2 (H2).** Delete the entire "**Comment the current state, not the change.**" bullet. Then replace the opening of the documents bullet, OLD: `- **Documents ship the current state; the journey lives in git.** The current-state rule for code comments extends to every shipped artifact: curated docs, server instructions, skill references, READMEs.` NEW: `- **Documents ship the current state; the journey lives in git.** Code comments and every shipped artifact - curated docs, server instructions, skill references, READMEs - document what is true now, never the change-narrative.`

**E3 (H3).** Replace the "Default to high autonomy" bullet with:
`- **Pause only for a true blocker.** Once we've agreed on a spec or plan, run it to completion, and invoke the close-out ritual unprompted when the work is done. Interrupt me only for a contradiction in the spec, a decision with material consequences the spec doesn't cover, or a destructive/irreversible action.`

**E4 (H4).** Replace the entire "Windows PowerShell 5.1 corrupts commits" bullet with:
`- **Write commit messages via git commit -F <file> and source files via the Edit tool or explicit UTF-8,** never shell redirection or inline quoting; the active shell's tool description owns the per-host encoding and quoting traps.` (Keep the bolded lead-in through "UTF-8,"; backtick-format the commands as the surrounding bullets do.)

**E5 (H5).** In "Route around the harness", replace: OLD `Don't gate on a fixed sleep - long sleeps are blocked and sleep-probes are unreliable; wait on a real readiness signal (\`until curl ...\` / \`until grep -q 'marker' logfile\` backgrounded, or repeated UI waits) and resume on the completion notification.` NEW `Wait on a real readiness signal (\`until curl ...\` / \`until grep -q 'marker' logfile\` backgrounded), never a fixed sleep.` The curl.exe and permission-file sentences stay.

**E6 (H6).** Replace the "An agent's silence is not death" bullet with:
`- **No completion notification means a dispatched agent is alive; act on that.** When a decision change or a failed attempt requires replacing one, kill it explicitly first (TaskStop) and only then dispatch the successor; racing a rival into the same files converts a false stall diagnosis into hours of real damage.`

**E7 (A).** Replace the "Nothing untrue ships, and the honesty constraints are hard" bullet with:
`- **Nothing untrue ships.** Never publish invented metrics, testimonials, or claims about behavior the code doesn't have; a promise made on a public surface must be honored in code. Where a project defines honesty or privacy gates, treat a violation as a defect and sweep the whole tree for the banned pattern, not just your diff.`

**E8 (B).** Replace: OLD `When a serving path is degenerate but training is healthy, suspect an input/contract mismatch, not stale data.` NEW `When one consumer of shared data is degenerate while another is healthy, suspect the contract at the boundary, not the data.`

**E9 (C).** Replace: OLD `real-circuit or streaming behavior` NEW `live-connection or streaming behavior`. Replace: OLD `A suite of hundreds of tests can pass while a 404 page never renders and a circuit hangs for thirty seconds.` NEW `A large suite can pass while an error page never renders and a live connection hangs.`

**E10 (D).** Replace: OLD `Run one integration ("Live") test process at a time, per project, in order (fast/non-Live → integration → end-to-end)` NEW `Run one integration-test process at a time per shared resource, in order (fast → integration → end-to-end)`

**E11 (E).** Delete from "Don't waste your own moves": ` Resolve options lazily at request time - an eager startup read bakes in defaults and silently bypasses test overrides - and order middleware by cost (rate-limit before auth).` The bullet ends at `...(rate-limit before auth).` today; after the cut it ends at the sentence before.

**E12 (F).** Replace: OLD `(vocabulary, canon strings, column lists, shared helpers)` NEW `(shared vocabulary, canonical constants, column lists, shared helpers)`

**E13 (orchestration).** Replace the entire `## Orchestrating fan-out work` section (header plus all eight bullets, ending with the bullet whose last sentence is about keeping `.gitignore` covering `.kit/`) with:

```
## Orchestrating fan-out work

- **Orchestration mechanics live in the skills; load them before dispatching.** Implementation defaults to dispatch - the main thread is the most expensive place to write code - and the brainstorming skill (tier bands, Fable spend, who executes) and executing-work skill (dispatch briefs, scouts, gates, reviews) own the mechanics. Before fanning out scouts, implementers, or reviewers outside a skill-driven run, or deciding which session model executes what, load executing-work.
```

**E14 (lesson-not-incident).** In the Kaizen capture bullet, after the sentence `The \`kaizen\` skill owns the bar and the mechanics.` insert: `Capture any lesson - kaizen note, memory entry, doctrine line - one level more general than the incident that taught it: state the lesson, not the incident.`

### Orchestration coverage map (S3 input)

Disposition of the eight removed doctrine bullets:
- "Implementation defaults to dispatch" - covered: brainstorming step 11 (tiers, briefability), executing-work section loop step 1 (dispatch, inline, escalation ceiling). No action.
- "The session model is the mode" - partially covered (brainstorming step 11 has Fable Spend authorization and cost hold). Gap: the Fable-led-sessions-design, hand-execution-to-Opus-led rule. Block 4 below lands it in brainstorming.
- "The split is measured" - the mode rule rides in Block 4; the measurement numbers (2.3x, 150k, 11%) are intentionally dropped from live surfaces; the archived fable-metering plan is the record.
- "Spend the parallelism" - gaps: scout banding, scout return contract (executing-work cites "the doctrine's scout return contract" - a reference that dangles after E13), serialize-shared-resource rule. Blocks 1 and 3 land them in executing-work; the dangling citation gets repointed.
- "Lock the contract" - covered: executing-work (stop-first on brief change; lock contracts, disjoint files); doctrine Verify section keeps "a finding is a hypothesis" for scout leads. No action.
- "Subagents inherit the catalog" - partially covered (brief template: style paths, sibling breadth, pin tests). Gap: the implementer bug-pattern list. Block 2 lands it in executing-work.
- "The controller owns the gate" - covered in frame (steps 2-3). Gaps: fail-dangerous pattern hunt list, reviewers-before-slow-suites timing. Block 2 lands both.
- "Subagent reports are working artifacts" - fully covered in executing-work "Delegating to subagents". No action.

### S3 content blocks (placement judgment belongs to the implementer, per writing-skills)

**Block 1 (executing-work, Delegating to subagents):** Scout dispatches are banded by question shape: a closed fact-check (does X contain Y, confirm a value, verify a checklist item) rides the harness default, because the mandatory confirmation of load-bearing leads makes a wrong answer self-surfacing; open discovery (map a surface, find every call site) gets an explicit sonnet override, because the failure confirmation cannot catch is the miss, and a missed site silently narrows the design. Top-model recon is pure burn either way, and a "simple check" that comes back with more than a couple of leads was mis-banded: re-run it as discovery. Every scout dispatch states its return contract: each lead comes back as a file:line reference with a one-sentence fact and why the site matters, never pasted file contents; bulky evidence goes to the gitignored `.kit/` scratch path, read on demand. Also repoint the existing "per the doctrine's scout return contract" citation to this in-skill statement.

**Block 2 (executing-work, steps 2-3 area):** Hunt the fail-dangerous patterns specifically: a delete-everything-not-in-this-set with no empty-set guard, a destructive loop under one outer try/catch, a hardening change that turns a benign path into a throw without auditing its callers. Implementer-written code reliably introduces call-site bugs that pass "no suites failed": a parameter name or type that does not match the callee, a silently changed error semantic (truncate instead of hard-fail), a hard-delete flipped to soft, an explicit NULL overriding a column default. Expect most raw findings to be coverage and polish and a few to be real bugs. Dispatch the reviewers before the slow suites so they use the idle time and their fixes fold into a single gate run.

**Block 3 (executing-work, Delegating to subagents):** Serialize what the environment cannot share: implementation stays single-agent-per-worktree when it touches shared state, and long integration suites run through one controller; two concurrent runs against a single shared database collide, fail in a heap, and orphan test state. The single-shared-resource constraint dominates orchestration design more than any parallelize-by-default instinct.

**Block 4 (brainstorming, near step 11):** A Fable-led session is for design: brainstorming, specs, adjudication, and the finishing pass of a high-stakes effort. Execution belongs to a session on the execution model (Opus-led today): the premium meter runs on every call of the session that follows, not on the plan's size, so "Fable can jump straight into a small plan" is the tempting exception that is not one. When a Fable-led session is asked to execute, the move is a handoff (the spec plus a fresh execution-model session), not a favor. Keep execution mains on the execution model and leave the review tiers as rostered.

**Block 5 (brainstorming, spec format guidance):** Prefer rich references over prose in a spec: acceptance criteria as runnable checks or rubrics where possible; for UI or visual work, a mockup or reference implementation over a description.

**Block 6 (executing-work, Dispatch Brief template, optional field):** `- Rich references when they exist: the mockup, rubric, or reference implementation the section's acceptance leans on, by path`

### S4 texts

**csharp-style:** (1) Resolve configuration options lazily at request time; an eager startup read bakes in defaults and silently bypasses test overrides. (2) Order middleware by cost: cheap rejection before expensive work (rate limiting before authentication).

**kaizen skill:** State the lesson, not the incident. Capture every note one level more general than the incident that taught it: the incident is the evidence, the lesson is the note. A hot stove teaches "watch out for hot metal," not "this one stove is hot." A note phrased at incident level produces a narrow rule that fires once; the generalized lesson applies everywhere the pattern recurs.

## Related

- `../archive/claude-kit_fable-metering_spec_v1.md` wrote the "Orchestrating fan-out work" doctrine content this plan relocates into the owning skills.
- `../archive/claude-kit_doctrine-delivery_spec_v1.md` built the doctrine delivery mechanism this plan works within (skill as single source, hand-mirrored `home/` copy, doctrine-refresh hook, doctor freshness check).

## Chapters

(Appended by executing-work as sections complete.)
