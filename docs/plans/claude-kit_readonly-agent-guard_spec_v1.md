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
Model: sonnet, except the `docs/architecture.md` entry, which is inline (the docs-write-guard denies a subagent any write under `docs/`, so that one edit is the main thread's)

Exact edits, no judgment calls:

- `home/claude-kit-doctrine.md`, "Make the test earn its green" bullet: append the sentence "A tree-mutating probe (the red/green edit itself) is exclusive: never run one while any agent is reading the tree - finish or stop the agents first, then restore and verify the tree before dispatching the next."
- Each of the five strict-class agent files (`plugins/claude-kit/agents/adversarial-reviewer.md`, `blind-reviewer.md`, `security-reviewer.md`, `council-member.md`, `design-facilitator.md`): in the paragraph already stating the read-only constraint, append the sentence "A kit hook enforces this mechanically: write-shaped shell commands are denied. A denial is the guard working - report the need in your final message instead of routing around it."
- `plugins/claude-kit/agents/qa-verifier.md`: in the opening role paragraph, append the sentence "A kit hook mechanically denies git-state mutations, deletes and writes outside the build-output directories, and formatter or package-install runs; building and running the suites is unaffected."
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

### Chapter 1 - 2026-07-24
Completed: 1. The readonly-agent-guard hook
Implemented By: implementer-opus (three rounds: build, review-fix, security-fix), plus two orchestrator edits (the gate-class write allowance and its pin test)
Metrics: 3 review rounds (adversarial + blind, then security, the third round's fixes verified by orchestrator probe rather than a fourth dispatch); 0 NEEDS_CONTEXT; 0 escalations; advisor opus (consulted once, at approach lock)
Decisions / Surprises:
- The git deny list was settled up front rather than left to the implementer's latitude. Unconditional: `add`, `am`, `apply`, `bisect`, `checkout`, `checkout-index`, `cherry-pick`, `clean`, `clone`, `commit`, `filter-branch`, `gc`, `init`, `merge`, `mergetool`, `mv`, `prune`, `pull`, `push`, `read-tree`, `rebase`, `reset`, `restore`, `revert`, `rm`, `sparse-checkout`, `stash`, `switch`, `update-index`, `update-ref`. Subverb-gated: `branch`, `tag`, `worktree`, `submodule`, `bisect`. Deliberately allowed: `fetch`, `remote`, `config`, and every read. `symbolic-ref` is deliberately absent from the deny list because `pr-docs-guard.js:121` runs it as a read in production. Deliberate over-blocks, documented in the code: `git stash list`, `git clean -nd`, `git apply --check`.
- Subcommand matching is whole-token, never `\b`. `git merge-base main HEAD` is a read a reviewer runs constantly, and a `\b` alternation on `merge` matches it because `-` is a non-word character.
- The guard was simultaneously too loose and too tight from one root cause. It pattern-matched operators without tracking quote state, so `rm -rf .` was allowed (the repo root classified as "outside the repo", `path.relative` returning `''`) while `rg "=> handler" src` was denied. The fix classifies redirect and operand targets instead of matching operators, and masks quoted spans before finding positions.
- Deliberate deviations from the spec's literal gate-class text (spec line 49 lists only git mutations and redirects), all toward the Approach's stated invariant at line 22: destructive file operations (`rm`, `mv`, `Remove-Item`, `Move-Item`, `Rename-Item`, and the `find`/`xargs` bulk forms) now apply to qa-verifier as well, sparing a fixed build-output directory list (`bin`, `obj`, `TestResults`, `node_modules`, `.vs`, `.kit`); formatters deny for both classes; `npm install|add|update` deny for both classes while `npm ci` stays allowed for the gate class, because `ci` installs from the lockfile without rewriting a tracked file. Non-destructive creation (`cp`, `touch`, `chmod`, `New-Item`, `Copy-Item`) remains strict-class-only, since copying a fixture into place is plausible gate setup, is visible in `git status`, and is caught by Section 2's backstop. Reversal cost is low: each is one list membership.
- The build-output directory list is a policy assumption, stated as such in the code header rather than as a guarantee. A repo that tracks content under those directories gets no protection there. `dist` and `coverage` were dropped from the list for exactly that reason; `bin` was kept because this kit's default stack is C#/.NET, where `rm -rf bin obj` is the canonical clean and `bin/` is essentially never tracked.
- The hook is inert in the session that wrote it. The plugin loads from a cache snapshot (`~/.claude/plugins/cache/applefeld/claude-kit/<hash>/`), which is an independent copy rather than a link to the repo, so the guard goes live only after a kit update. The tests plus direct payload runs are the whole behavioral proof for this effort.
- Spec correction: Section 3's `Model:` line now records that the `docs/architecture.md` entry is inline. The docs-write-guard denies any non-curator subagent a write under `docs/`, so dispatching that edit would have died mid-section.
- Process miss worth naming: a gate run against the tree while the implementer was still writing produced a phantom red and two phantom probe mismatches, all of which cleared on a settled tree. A 90-second mtime-stability window was too short to conclude an agent was done. This is the same failure class Section 2's rules exist to prevent, encountered while implementing them.
Review Findings:
- Round 1 (adversarial + blind), 2 Criticals, both independently reproduced by the orchestrator before dispatch and both fixed: the repo root and its ancestors classified as outside the tree, so `rm -rf .`, `rm -rf ..`, and `Remove-Item -Recurse -Force .` all passed; and `mv`/`Move-Item` checked only their destination, so `mv src/tracked.cs .kit/keep.cs` deleted a tracked file, with a test pinning that as correct. Majors fixed: quote-blindness (denying routine greps while allowing `sh -c "git commit"`), `sed -i` operands lost to separator truncation, `find -delete` and `xargs rm`, missing `Clear-Content`/`Rename-Item`, and `Remove-Item` with a bare positional name. Minors fixed: `tee` multi-operand, five missing git subcommands, `gh` mutations, `~` misclassified as in-repo, `npm --prefix . install`, and a missing payload `cwd` silently substituting the process cwd.
- Round 2 (security), 0 Criticals, 4 Majors. `gh -R owner/name pr merge 1` was the one that mattered most, and not because of the regex: merging a PR leaves the worktree byte-identical, so Section 2's `git status --porcelain` backstop structurally cannot see it, making it the only bypass with no compensating control and an irreversible outward action. Also fixed: containment judged against the payload `cwd` rather than the git root (so `rm ../README.md` from a subdirectory passed), missing PowerShell aliases and the `Get-ChildItem | Remove-Item` pipeline, the gate-class writable-set assumptions, backslash-escape handling in quote masking, pathed and `.exe`-suffixed invocations, `claude -p`, here-strings, `-EncodedCommand`, `>|`, and over-blocks on `git submodule status` / `git bisect log` / `--help`.
- Majors accepted with reasons recorded rather than fixed: quadratic scan time on very long commands (measured 8.1s at 80KB; the agent authors the string that would block its own tool call, so there is no cross-principal denial of service, and the security review confirmed no catastrophic backtracking anywhere). Minors noted: an unreachable `xargs git` branch kept as an enumerated list member, and a residual false hit where an operand's final path element is exactly a governed command name.
- The security review's recommendation for a written access model across all four PreToolUse guards is out of scope here and is filed in `docs/backlog.md`.
Next: 2. executing-work: tree-state check and probe serialization
Commit Model: Commit-and-Push

### Chapter 2 - 2026-07-24
Completed: 2. executing-work: tree-state check and probe serialization
Implemented By: implementer-opus
Metrics: 0 review rounds (prose-only section, covered by the finishing pass); 0 NEEDS_CONTEXT; 0 escalations; advisor opus
Decisions / Surprises:
- The review-round rule is placed ahead of step 3's trivial-section exemption, so the exemption cannot scope the hard rule.
- The probe rule names the pre-probe capture as an explicit beat of the ordering. The spec said to "verify restoration (`git status --porcelain` matches the pre-probe capture)" without ever enumerating the capture itself, which would leave an executing agent nothing to compare against.
- Both rules were dogfooded during this effort before they were committed. The review round bracketing showed no tree delta, confirming the reviewers were read-only in practice and not just by declaration, and the one tree-mutating probe run in the main thread (breaking the gate-class write allowance to confirm its test goes red) was run with no agents in flight, then restored and verified byte-identical.
Review Findings: none dispatched; the whole-changeset reviews in the finishing pass cover this file.
Next: 3. Doctrine line and agent alignment
Commit Model: Commit-and-Push

### Chapter 3 - 2026-07-24
Completed: 3. Doctrine line and agent alignment
Implemented By: implementer-sonnet (the doctrine sentence and the six agent sentences), main session (the `docs/architecture.md` entry, which the docs-write-guard reserves to a non-subagent)
Metrics: 0 review rounds (verbatim sentence insertion, verified by the orchestrator against the literal text); 0 NEEDS_CONTEXT; 0 escalations; advisor opus
Decisions / Surprises:
- Spec correction: the qa-verifier sentence the spec originally dictated ("denies git-state mutations and in-repo file edits") had become inaccurate once the gate class also denied formatters and package installs, so the spec text was updated to match as-built before dispatch rather than shipping a sentence that misdescribes the hook.
- Each of the five judgment-agent files had exactly one paragraph making the read-only claim, so no placement judgment was needed.
- The frontmatter `tools:` lists are now pinned by test. The spec's Out of Scope justifies shipping no Write/Edit/MultiEdit guard on the grounds that those tools are not granted, and nothing enforced that; a change to any of the six frontmatter blocks now fails red instead of silently voiding the justification.
Review Findings: none dispatched. Orchestrator verification: seven files, one paragraph each, every sentence present character for character, no frontmatter line altered, and zero em dashes anywhere in the changeset.
Next: finishing-work
Commit Model: Commit-and-Push
