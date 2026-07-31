# Backlog sweep: effort dials, reviewer tiering, guard detection, doc closes

Status: In Progress
Commit model: Commit-and-Push
Fable Spend: session is Fable-led; tier assignments below authorize dispatch spend

## Context

The 2026-07-31 backlog review session (KIT: Backlog Review) triaged the full backlog and Scott approved a batch. Two items already shipped ahead of this plan: the exit-after-stdout hook fix (commit 1916113, extended to both Stop hooks) and the 200k-gate close-out (commit 5290be8). This plan carries the rest.

Decisions recorded from that conversation, all decided 2026-07-31:

- **Effort dials.** The subagent frontmatter `effort` field is confirmed in the official Claude Code docs (code.claude.com/docs/en/sub-agents.md): `low`/`medium`/`high`/`xhigh`/`max`, overrides session effort, default inherits. Anthropic's guidance is start-high, step down where evals show quality holds; the kit's compensating structure (Fable-planned briefs, reviewer pair, Opus advisor on every below-fable dispatch) is the argued basis for stepping down. Approved dials: `medium` for implementer-sonnet, implementer-opus, qa-verifier, docs-curator, adversarial-reviewer, blind-reviewer. No field for implementer-haiku (Haiku 4.5 does not support effort), implementer-fable, security-reviewer, council-member, design-facilitator (inherit). Judgment protocol: Chapter Metrics (review rounds, NEEDS_CONTEXT, escalations, findings quality) against the pre-dial baseline; revert is one frontmatter line per agent.
- **Reviewer model tier rule.** Per-section reviewers ride one tier above the section's writer tier (haiku -> sonnet, sonnet -> opus, opus -> fable, fable -> fable), passed as the model override on each reviewer dispatch; the finishing adversarial review always runs fable. Today the reviewers inherit the session model, so on a Fable-led session this is a cost cut for below-opus sections, and on a below-fable session the fable overrides are Fable spend under the existing header semantics (`none (cost hold)` caps at the session model). The finishing gate is deliberately never stepped down.
- **Guard integrity detection over prevention.** For the writable-guard-executables exposure (plugin cache is user-writable; a governed agent with Bash can disarm all four PreToolUse guards silently, confirmed reachable), the decision is detection: the build stamps a hash manifest of the hooks, and the canary compares the executing cache against it at session start, warning loudly on drift. Prevention was rejected because the same-principal actor is out of scope by docs/security-model.md's own analysis; the threat is a model misstep or rationalization, not an attack, and detection converts a permanent silent disarm into a bounded loud one. Honest limit, to be stated in the docs: the manifest lives in the same writable cache, so a deliberate two-file rewrite evades it; that actor was already out of scope.
- **Kit-goal leash across native compaction: field-confirmed holding.** Scott observed an armed kit-goal carry through an overnight session that native-auto-compacted, continue pursuing the goal, and end with the proper blocked/completion messaging next morning. That is the probe the backlog item was waiting for; retired to the Q3 snapshot on that evidence.

## Sections of Work

### 1. Effort dials and reviewer tier rule (inline, fable)

Add `effort: medium` to the frontmatter of: `plugins/claude-kit/agents/implementer-sonnet.md`, `implementer-opus.md`, `qa-verifier.md`, `docs-curator.md`, `adversarial-reviewer.md`, `blind-reviewer.md`. No other agent files change.

In `plugins/claude-kit/skills/executing-work/SKILL.md` step 3 (Review), add the reviewer model rule: each per-section reviewer dispatch carries the model override one tier above the section's tier (haiku -> sonnet, sonnet -> opus, opus -> fable; fable-tier and inline sections review at fable, which on a Fable-led session is the inherited default and needs no override). On a below-fable session a fable reviewer override is Fable spend authorized by the section's tier assignment; under `Fable Spend: none (cost hold)`, cap the reviewer at the session model. In `plugins/claude-kit/skills/finishing-work/SKILL.md` step 3, the final adversarial review always dispatches with the fable model override (cost hold: session model). In `plugins/claude-kit/skills/brainstorming/SKILL.md`, the Fable Spend expected-surface enumeration names the per-section reviewer bumps alongside the finishing reviews, so a spec header approved under it forecasts the reviewer spend the rule incurs (review-driven amendment).

Update the backlog's effort-levels experiment item: mechanism found (frontmatter, not per-dispatch), dials set, reviewer tier rule added, remaining work is the Chapter Metrics watch. Acceptance: frontmatters carry the field; both skills state the rule; backlog item reflects in-flight status; doctrine-parity test still green.

### 2. Guard integrity detection (dispatch, opus)

Build stamps a manifest of hook file hashes; the canary verifies the executing cache against it.

- `build.ps1` and `build.sh`: when stamping `.claude-plugin/build-info.json`, add a `hooks` map of `<filename>: <sha256>` for every `hooks/*.js` file, computed from the files as packaged.
- `plugins/claude-kit/hooks/hook-canary.js`: alongside the existing loadable-parse probe, hash each `hooks/*.js` in the executing `CLAUDE_PLUGIN_ROOT` and compare against the manifest. A mismatch or a manifest-listed file missing on disk is a failure reported through the canary's existing report path, naming the file(s). Absent manifest or absent `hooks` key: silent (older build, never a false alarm). The canary's fail-open discipline is unchanged: any error in the new probe stays silent.
- Tests in `test/hook-canary.test.js`: mismatch warns naming the file, match is silent, absent manifest is silent, and the canary's own file tampered also warns (self-check works because the manifest hash covers hook-canary.js as built; note the limit that a tamper of both canary and manifest is undetectable, which is accepted).

Acceptance: build produces the manifest; a byte-flipped guard in a cache copy triggers the warning in a test; all existing canary tests stay green; full hook suite green (baseline 352 pass / 0 fail).

### 3. Guard access model into the security model doc (inline, fable)

Fold the per-guard material into `docs/security-model.md`: the four guards and the invariant each enforces, the two-class agent policy (strict / gate-runner), the fail-open posture and what it costs, the compensating controls (tree-state bracket around review rounds, agents' frontmatter granting no write tools, the new hash-manifest detection from section 2) and the gap each control cannot see (a `gh` mutation leaves the worktree byte-identical; the cache is same-principal writable; manifest-plus-payload rewrite evades detection). Present-tense state only, per the doctrine's journey/state rule. Retire the backlog's access-model item and the writable-guards item (decision recorded here) to the Q3 snapshot.

Acceptance: security-model.md covers the guards' policy, accepted risks, and preconditions such that a security review would not need to reconstruct them from code; both backlog items retired.

### 4. RED/GREEN the backstop wording (inline, fable)

Baseline-test the two "completed plan unarchived" behavior-shaping texts (`session-start.js` nudge, `stop-docs-hygiene.js` block reason) per the writing-skills skill's protocol. Scott has observed the reminder firing live several times; the open question is only whether the wording reliably drives the archive pass. Run the writing-skills RED/GREEN check; record the result; adjust wording only on an observed failure. Retire the backlog item with the result. This section's probes mutate no tree state beyond scratch, but any probe that does mutate is exclusive per the executing-work rule.

Acceptance: a recorded RED/GREEN result for both texts; backlog item retired with the evidence.

### 5. Close-out (inline, fable)

Finishing pass per finishing-work (the changeset is code plus behavior-shaping prose; security review covers the canary/build changes). Retire remaining handled backlog items, flip this plan to Complete, archive via curating-docs, final Chapter, push.

## Chapters

### Chapter 1 - 2026-07-31
Completed: 1. Effort dials and reviewer tier rule
Implemented By: main session
Metrics: 1 review round (adversarial only; blind waived: a prose-and-frontmatter diff has no intent-free correctness surface, and the finishing pass covers it); NEEDS_CONTEXT 0; escalations 0; advisor opus (not consulted)
Decisions / Surprises: The review's Major held on verification: the new reviewer rule made brainstorming's Fable Spend expected-surface enumeration stale (it named only fable-tier sections and finishing reviews), so the enumeration now names the per-section reviewer bumps - a one-clause scope extension beyond the section's file list, folded into the spec text. Two Minor wording gaps closed in the same edit: after a tier escalation the escalated tier is the writer tier, and the security-reviewer is explicitly not part of the bump. The dials reach live sessions only at the next kit update (the plugin loads from a cache snapshot). blind-reviewer.md's worktree line endings are LF where siblings are CRLF (committed blob unaffected); left to self-heal.
Review Findings: 1 Major addressed (brainstorming enumeration), 2 Minors fixed (escalation clause, pair wording), 1 Minor noted without action (worktree eol).
Next: 2. Guard integrity detection
Commit Model: Commit-and-Push
