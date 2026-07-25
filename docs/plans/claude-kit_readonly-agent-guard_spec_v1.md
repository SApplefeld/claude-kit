# Read-Only Agent Guard

Status: In Progress
Commit Model: Commit-and-Push
Fable Spend: spec authorship only (Opus-led execution)
Created: 2026-07-24

## Goal

The kit's five judgment agents (adversarial-reviewer, blind-reviewer, security-reviewer, council-member, design-facilitator) hold full Bash while their own prose declares them read-only, and nothing enforces the declaration: a reviewer edited a tracked test file mid-review during the bUnit effort, and a tree-mutating red/green probe has run on the shared tree with nothing preventing an in-flight agent from reading the mutated state. When this plan is done, the read-only contract is mechanical (a plugin PreToolUse hook denies write-shaped shell commands per agent class), a cheap tree-state check in executing-work catches what the heuristic misses, and the doctrine-endorsed mutation probe carries an explicit isolation rule. Reviewers keep the read capability that makes their findings evidence-backed: git diff, git grep, and running the gate all still work.

## Approach

**Enforcement locus: a plugin PreToolUse hook keyed on `agent_type`.** Confirmed against the Claude Code docs and the kit's own shipped code: hook payloads carry `agent_type` for subagent tool calls, plugin hooks fire inside subagents, and `hooks/docs-write-guard.js` already keys on exactly this field in production. The alternatives fail the constraints: agent frontmatter has no command-pattern syntax (`tools:` is exact tool names only), `settings.json` permission patterns are machine-local while the kit ships to more than one machine, and `isolation: "worktree"` branches from a ref and never carries staged or unstaged working-tree changes, so a worktree reviewer cannot see the diff under review (fatal for Review-Only efforts, which live entirely in uncommitted state).

**Two-class policy map** (decided 2026-07-24):

- **Strict** (adversarial-reviewer, blind-reviewer, security-reviewer, council-member, design-facilitator): deny git-state mutations, redirects and file edits into the repo, package-manager installs, and formatters. Test runners and builds remain allowed by construction (a denylist blocks only what it names); running the gate is part of what makes a finding evidence rather than assertion.
- **Gate-runner** (qa-verifier): deny only git-state mutations and in-repo file edits (redirect, tee, sed -i into repo paths outside `.kit/`). Builds and suites write `bin/`, `obj/`, and test state as their normal operation, so the stricter file heuristics would false-positive on its core job.
- **Everyone else** (main session, background `claude`, implementers, docs-curator, unknown agent types): allowed, untouched.

The invariant being protected is the repo tree under review, not the filesystem: qa-verifier writing build output is fine; a reviewer changing one tracked file is the whole incident.

**Denylist, fail-open** (decided 2026-07-24, over allowlist fail-closed): identical safety stance to docs-write-guard. The hook exits 2 only when positively certain, and any parse failure, unknown payload shape, or unidentifiable agent allows. A fail-closed guard that misjudges one legitimate read command silently weakens every future review until the next kit release; a fail-open miss is caught by the backstop below. Known misses (python one-liners, paths passed through variables, exotic writers) are accepted and backstopped, exactly as docs-write-guard documents for its own heuristics.

**Backstop: a tree-state check around review rounds.** executing-work captures `git status --porcelain` before dispatching a review round and compares after it returns. Any delta is an incident: restore, record, suspect the round's findings. This is the check that would have caught the bUnit edit, and it covers every write shape no heuristic can see.

**Probe serialization is prose, not mechanics.** No hook can know which agents are in flight, so the rule lives where orchestration lives: a tree-mutating red/green probe runs only with no agents reading the tree (finish or TaskStop them first, probe, restore, verify restoration, then dispatch). One operational rule in executing-work, one sentence in the doctrine's make-the-test-earn-its-green bullet so the technique carries its isolation requirement outside plan runs too.

**The denial teaches.** The guard's stderr message names the agent, the invariant, and the correct moves: findings go in the final message, scratch goes to `.kit/`, and a needed mutation probe is the orchestrator's to run. An agent that understands the denial does not fight the guard.

Out of scope by design: host-state mutations outside the repo (ACLs, junctions, spawned processes) stay governed by brief prose; this plan protects the tree under review.

## Sections of Work

### 1. The readonly-agent-guard hook
Model: opus

New `plugins/claude-kit/hooks/readonly-agent-guard.js`, registered in `plugins/claude-kit/hooks/hooks.json` as a PreToolUse hook on `Bash|PowerShell` beside the existing three guards, with `test/readonly-agent-guard.test.js` mirroring the docs-write-guard test's structure. Follow docs-write-guard's conventions throughout: `subagentType()` with suffix matching for plugin-namespaced ids, no child processes (pure stdin to verdict), exit 2 with a teaching stderr message on deny, exit 0 everywhere else, top-level try/catch failing open.

Policy map:

- Strict class (`adversarial-reviewer`, `blind-reviewer`, `security-reviewer`, `council-member`, `design-facilitator`), deny:
  - git mutating subcommands: `add`, `commit`, `checkout`, `switch`, `restore`, `reset`, `stash`, `clean`, `rm`, `mv`, `merge`, `rebase`, `cherry-pick`, `revert`, `apply`, `am`, `push`, `pull`. The implementer finalizes the exact list within this intent (a mutation of repo or remote state is denied; a pure read like `diff`, `log`, `show`, `grep`, `status`, `blame`, `branch --list` is allowed), escalating only if a command is genuinely both.
  - Redirects, `tee`, heredoc-into-file, and `sed -i` whose target is an in-repo path outside `.kit/`. A relative path is an in-repo path (the subagent's cwd is the repo); an absolute path outside the payload's `cwd` and any `.kit/` path are allowed (scratch reports are legitimate).
  - File-mutation commands (`rm`, `mv`, `cp`, `touch`, `chmod`) with an in-repo operand outside `.kit/`.
  - Package-manager mutations (`npm|pnpm|yarn` `install|add|update|ci`) and formatters (`dotnet format`, `prettier` with `-w`/`--write`).
  - PowerShell equivalents: the docs-write-guard cmdlet heuristic generalized to in-repo targets (`Out-File`, `Set-Content`, `Add-Content`, `Tee-Object`), plus `Remove-Item`, `Move-Item`, `Copy-Item`, `New-Item` with in-repo targets, and the same git subcommand list.
- Gate-runner class (`qa-verifier`), deny: the git mutating subcommands, and redirect/`tee`/`sed -i` into in-repo paths outside `.kit/`. Everything else allowed.
- Any other agent type, no agent type, or unparseable payload: allow.

Acceptance criteria: a strict-class agent's `git checkout`, `git commit`, `sed -i` on a repo file, and `echo x > src/file` are denied while its `git diff`, `git log -p`, `rg`, `node --test test/x.test.js`, and `echo x > .kit/report.md` are allowed; qa-verifier's `dotnet build`, `dotnet test`, and `npm test` are allowed while its `git commit` and redirect into a repo file are denied; a namespaced id (`claude-kit:blind-reviewer`) resolves to its class; an implementer, the bare `claude` type, an absent `agent_type`, and malformed JSON all allow. Tests run green via `node --test test/readonly-agent-guard.test.js` (name the file explicitly; a bare directory run misfires on Node 24).

Tests: lock both directions for both classes (each denied shape denied, each allowed shape allowed), and lock the fail-open edges (unknown agent, missing type, parse failure); a guard that traps legitimate review work is the expensive failure in one direction, and a silent pass-through of a git mutation is the expensive failure in the other.

### 2. executing-work: tree-state check and probe serialization
Model: opus

Edits to `plugins/claude-kit/skills/executing-work/SKILL.md` only. Two additions, written per the writing-skills bar (rules that hold under pressure, not aspirations):

- **Step 3 (Review):** before dispatching a review round, capture `git status --porcelain`; when the round returns, re-run and compare before acting on findings. A delta is an incident: restore the tree, record the delta and the offending agent in the Chapter, treat that agent's findings as suspect pending re-review, and jot a kaizen note (a delta means the guard missed a shape worth adding).
- **Step 2 (Verify with evidence):** a tree-mutating red/green probe is exclusive. Run one only with no subagents in flight: await or TaskStop them first, probe, restore, verify restoration (`git status --porcelain` matches the pre-probe capture), then dispatch. When the state under test is committed, a worktree is the alternative that skips the exclusivity dance.

Acceptance criteria: both rules present at the named anchor points; the review-round rule states the capture-compare-restore sequence and the suspect-findings consequence; the probe rule states the stop-first ordering and the restoration verification; no other step of the skill is reworded.

### 3. Doctrine line and agent alignment
Model: sonnet

Exact edits, no judgment calls:

- `home/claude-kit-doctrine.md`, "Make the test earn its green" bullet: append the sentence "A tree-mutating probe (the red/green edit itself) is exclusive: never run one while any agent is reading the tree - finish or stop the agents first, then restore and verify the tree before dispatching the next."
- Each of the five strict-class agent files (`plugins/claude-kit/agents/adversarial-reviewer.md`, `blind-reviewer.md`, `security-reviewer.md`, `council-member.md`, `design-facilitator.md`): in the paragraph already stating the read-only constraint, append the sentence "A kit hook enforces this mechanically: write-shaped shell commands are denied. A denial is the guard working - report the need in your final message instead of routing around it."
- `plugins/claude-kit/agents/qa-verifier.md`: in the opening role paragraph, append the sentence "A kit hook denies git-state mutations and in-repo file edits mechanically; running builds and suites is unaffected."
- `docs/architecture.md`: add the new hook to the hooks inventory, one entry in the established format.

Acceptance criteria: the doctrine sentence and all six agent sentences present verbatim; the architecture entry matches the sibling entries' format; no other content changed.

## Out of Scope

- The review roster and the adversarial/blind pairing.
- Host-state mutations outside the repo (ACLs, junctions, spawned processes): brief-prose governance stands.
- A Write/Edit/MultiEdit guard for the judgment agents: their frontmatter does not grant those tools, so there is nothing to guard.
- An allowlist (fail-closed) posture, and any logging of unrecognized command shapes.
- Machine-local `settings.json` permission patterns.
- Forensics on the bUnit repo's history (the motivating incident is Scott-reported; the design does not depend on its exact mechanics).
- kit-doctor changes: the hook loads from the plugin cache like its three siblings and needs no install-time validation.

## Open Questions

None. The implementer's only latitude is finalizing the git deny list within Section 1's stated intent.

## Related

- Builds on `../archive/claude-kit_docs-write-guard_spec_v1.md`: same enforcement pattern (plugin PreToolUse hook keyed on `agent_type`, fail-open, taught denial), widened from one path invariant (docs/ writes) to the read-only contract of the judgment agents.
- Motivating evidence recorded during the execution of `claude-kit_compaction-unwind_spec_v1.md` (reviewer Bash grants confirmed in the agent frontmatter; a main-thread mutation probe ran unserialized) plus the bUnit effort's reported mid-review edit.

## Chapters

(Appended by executing-work as sections complete.)
