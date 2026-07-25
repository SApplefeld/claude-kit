# Read-Only Agent Guard

Status: Complete
Commit Model: Commit-and-Push
Fable Spend: spec authorship; the finishing pass's security and adversarial reviews; one escalated implementer round on Section 1, earned when two review rounds returned Criticals
Created: 2026-07-24

## Goal

The kit's five judgment agents (adversarial-reviewer, blind-reviewer, security-reviewer, council-member, design-facilitator) hold full Bash while their own prose declares them read-only, and nothing enforces the declaration: a reviewer edited a tracked test file mid-review during the bUnit effort, and a tree-mutating red/green probe has run on the shared tree with nothing preventing an in-flight agent from reading the mutated state. When this plan is done, the read-only contract is mechanical (a plugin PreToolUse hook denies write-shaped shell commands per agent class), a cheap tree-state check in executing-work catches what the heuristic misses, and the doctrine-endorsed mutation probe carries an explicit isolation rule. Reviewers keep the read capability that makes their findings evidence-backed: git diff, git grep, and running the gate all still work.

## Approach

**Enforcement locus: a plugin PreToolUse hook keyed on `agent_type`.** Confirmed against the Claude Code docs and the kit's own shipped code: hook payloads carry `agent_type` for subagent tool calls, plugin hooks fire inside subagents, and `hooks/docs-write-guard.js` already keys on exactly this field in production. The alternatives fail the constraints: agent frontmatter has no command-pattern syntax (`tools:` is exact tool names only), `settings.json` permission patterns are machine-local while the kit ships to more than one machine, and `isolation: "worktree"` branches from a ref and never carries staged or unstaged working-tree changes, so a worktree reviewer cannot see the diff under review (fatal for Review-Only efforts, which live entirely in uncommitted state).

**Two-class policy map** (decided 2026-07-24):

- **Strict** (adversarial-reviewer, blind-reviewer, security-reviewer, council-member, design-facilitator): deny git and GitHub state mutations, redirects and file edits into the repo, package-manager installs, and formatters. Test runners and builds remain allowed by construction (a denylist blocks only what it names); running the gate is part of what makes a finding evidence rather than assertion.
- **Gate-runner** (qa-verifier): deny git and GitHub state mutations; writes and destructive file operations anywhere in the repo except a fixed set of build-output directories (`.kit`, `bin`, `obj`, `TestResults`, `node_modules`, `.vs`, matched at any depth); formatters; and the package-manager verbs that rewrite a lockfile or a tracked project file. Builds and suites write `bin/` and `obj/` as their normal operation, so a blanket file rule would false-positive on its core job, and a fixed writable set is what keeps the exemption from also covering the tree under review.
- Both classes lose the bulk delete idioms (`find -delete`, `xargs rm`, a PowerShell pipeline into a destructive cmdlet) and a PowerShell encoded command, since those reach a mutation without naming a path the simpler heuristics can classify.
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
  - git mutating subcommands, matched as whole tokens so a read sharing a prefix with a mutation (`merge-base`, `ls-files`) stays allowed: `add`, `am`, `apply`, `bisect`, `checkout`, `checkout-index`, `cherry-pick`, `clean`, `clone`, `commit`, `filter-branch`, `gc`, `init`, `merge`, `mergetool`, `mv`, `prune`, `pull`, `push`, `read-tree`, `rebase`, `reset`, `restore`, `revert`, `rm`, `sparse-checkout`, `stash`, `switch`, `update-index`, `update-ref`; plus `worktree`, `submodule`, and `bisect` in their mutating subverbs only, and `branch` and `tag` both in their mutating flags and when they name a ref to create (creating a ref leaves the worktree byte-identical, so the tree-state backstop cannot see it). Deliberately allowed: `fetch`, `remote`, `config`, `symbolic-ref` (a read `pr-docs-guard.js` runs in production), a `--help` or `-h` in the position git itself reads it (immediately after the subcommand, since later it can be an option's value and the command still acts), and every other read.
  - Redirects, `tee`, heredoc-into-file, and `sed -i` whose target is an in-repo path outside `.kit/`. A relative path is an in-repo path (the subagent's cwd is the repo); an absolute path outside the payload's `cwd` and any `.kit/` path are allowed (scratch reports are legitimate).
  - File-mutation commands with an in-repo operand outside `.kit/`, split by whether they destroy content: destructive (`rm`, `rmdir`, `mv`, `truncate`, and the `find -delete` / `xargs rm` bulk idioms) and creating (`cp`, `touch`, `chmod`). Both apply to the strict class; only the destructive half reaches the gate-runner.
  - Package-manager mutations: `npm|pnpm|yarn` `install|add|update|ci` under every verb alias (`i`, `up`, and a bare `pnpm`/`yarn`, which install), and the .NET equivalents `dotnet add|remove|new`, which rewrite a tracked project file or scaffold into the tree.
  - Formatters: `dotnet format`, `prettier` with `-w`/`--write`, and a package script that formats (`run format`, `run fmt`, a script named `*:fix`, or a run carrying `--fix`). Check-only invocations write nothing and are allowed, including `dotnet format --verify-no-changes`, `dotnet format --check`, `prettier --check`, and `npm run lint`.
  - Outward repo-state mutations via the GitHub CLI: `gh pr` with `merge|close|edit|comment|review|ready`, `gh release` with `create|delete|edit`, and `gh api` with a non-GET method. These are denied because the tree-state backstop structurally cannot see them: merging a PR leaves the worktree byte-identical.
  - PowerShell equivalents: the docs-write-guard cmdlet heuristic generalized to in-repo targets (`Out-File`, `Set-Content`, `Add-Content`, `Clear-Content`, `Tee-Object`), plus `Remove-Item`, `Move-Item`, `Rename-Item`, `Copy-Item`, `New-Item` with in-repo targets, their standard aliases, the `Get-ChildItem | Remove-Item` pipeline, and the same git subcommand list.
- Gate-runner class (`qa-verifier`), deny: the git mutating subcommands and the `gh` mutations; writes and destructive file operations whose target is in-repo and outside a fixed build-output list (`.kit`, `bin`, `obj`, `TestResults`, `node_modules`, `.vs`), matched at any path depth so `src/<project>/obj` counts; formatters; and package-manager `install|add|update`. Allowed: `npm ci` (it installs from the lockfile without rewriting a tracked file), the creating commands (`cp`, `touch`, `chmod`, `New-Item`) in their non-overwriting form, and builds and suites, which are its job. A creating command counts as destructive when its resolved target already exists or the invocation carries `-Force`, because overwriting an existing file destroys its content. The build-output list is a policy assumption, not a guarantee: a repo that tracks content under those directories gets no protection there.
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
- Each of the five strict-class agent files (`plugins/claude-kit/agents/adversarial-reviewer.md`, `blind-reviewer.md`, `security-reviewer.md`, `council-member.md`, `design-facilitator.md`): in the paragraph already stating the read-only constraint, append the sentence "A kit hook enforces the no-write half of this mechanically: write-shaped shell commands are denied, while builds and test runs are deliberately left open. A denial is the guard working - report the need in your final message instead of routing around it." The no-write half is named explicitly because the host paragraph also says "never run builds", which the hook deliberately allows; a sentence claiming the hook enforces the whole paragraph would teach a reviewer that anything the hook permits is permitted.
- `plugins/claude-kit/agents/qa-verifier.md`: in the opening role paragraph, append the sentence "A kit hook mechanically denies git and GitHub state mutations, deletes and writes outside the build-output directories, and formatter or package-install runs; building and running the suites is unaffected."
- `docs/architecture.md`: add the new hook to the hooks inventory, one entry in the established format, naming both policy classes so a reader learns the gate-runner is governed too.
- `plugins/claude-kit/skills/finishing-work/SKILL.md`: bracket its steps 1 to 3 with the same tree-state check, since the judgment agents are dispatched from the finishing pass as well as from the section loop. Without it the backstop is absent exactly where the whole-changeset reviews run.

Acceptance criteria: the doctrine sentence and all six agent sentences present verbatim; the architecture entry matches the sibling entries' format and names both classes; the finishing-work bracket present and consistent with its executing-work sibling; no other content changed.

## Out of Scope

- The review roster and the adversarial/blind pairing.
- Host-state mutations outside the repo (ACLs, junctions, spawned processes): brief-prose governance stands.
- A Write/Edit/MultiEdit guard for the judgment agents: their frontmatter does not grant those tools, so there is nothing to guard.
- An allowlist (fail-closed) posture, and any logging of unrecognized command shapes.
- Machine-local `settings.json` permission patterns.
- Forensics on the bUnit repo's history (the motivating incident is Scott-reported; the design does not depend on its exact mechanics).
- kit-doctor changes: the hook loads from the plugin cache like its three siblings and needs no install-time validation.

## Open Questions

None. The git deny list, the only latitude Section 1 left open, is settled above and in Chapter 1.

## Related

- Builds on `claude-kit_docs-write-guard_spec_v1.md`: same enforcement pattern (plugin PreToolUse hook keyed on `agent_type`, fail-open, taught denial), widened from one path invariant (docs/ writes) to the read-only contract of the judgment agents.
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

### Chapter 4 - 2026-07-25 (close-out)
Completed: the finishing pass, and the effort
Implemented By: implementer-fable (the escalated round), main session (the final round and every doc edit)
Metrics: 5 review rounds total across the effort (per-section adversarial + blind, per-section security, finishing QA, finishing security at fable, finishing adversarial at fable); 0 NEEDS_CONTEXT; 1 tier escalation; advisor opus, consulted twice (approach lock, and the scope calls the finishing security round forced)
Gate: 147 pass / 0 fail, real exit 0, against a recorded pre-effort baseline of 85 pass / 0 fail. 62 of the 147 are this effort's. Verified independently by the orchestrator and by a qa-verifier pass.

Review outcomes:
- **QA verification: PASS.** Every acceptance criterion in all three sections checked with evidence, the hook driven directly by payload rather than only through its own suite. The pass also cross-checked the payload field names against three guards already running in production (`docs-write-guard.js:38`, `pr-docs-guard.js:141`, `merged-pr-push-guard.js:116`), which is the check that would have caught a silently inert guard whose tests all feed it the shape it expects.
- **Finishing security review (fable): 4 Criticals, all confirmed by the orchestrator with real exit codes and all fixed.** An unresolvable `cd` target skipped the containment check entirely (`mkdir -p tmp && cd tmp && rm ../README.md` deleted its target in a scratch repo); `cmd /c "..."` and `iex '...'` were masked and never analyzed, on a PowerShell-primary host; the help-flag skip matched anywhere in a segment, so `git stash push -m "-h"` really stashed and `git clean -fd -e -h` really deleted; and the escape set omitted `'`, so a top-level `\'` blanked the rest of the command while bash ran it. Majors fixed: Git-Bash `/d/...` absolute paths (the form `pwd` prints inside the Bash tool, so it needs no evasion intent), `\\?\` prefixes, the creating set able to destroy (`cp` over an existing file, `New-Item -Force`), `gh api` field flags defaulting to POST, and `npm i` aliases.
- **Finishing adversarial review (fable): 4 Majors, all confirmed and fixed.** `segment()` did not cut at a newline, so a multi-line script's later lines became operands of an earlier command: the gate class's own `rm -rf obj` + `dotnet build` was denied with the reason "(rm dotnet)". Naming a ref to create (`git branch scratch`, `git tag v9.9.9`) was allowed, and like a `gh` merge it leaves the worktree byte-identical, so the backstop cannot see it. `dotnet add package` rewrote a tracked project file unguarded, the house stack's exact analogue of the denied `npm install`. And the spec had re-diverged from as-built after the escalated round.
- **Docs curation: 6 drift items, 1 tagged `mistake` and resolved.** The `mistake` (D4) was a real over-block: the `-EncodedCommand` check matched `-ec` anywhere, and `-ec` is also how bash bundles `-e -c`, so `bash -ec 'git diff | head'` was denied as an encoded command. Confirmed by payload run (the curator had no shell), fixed by scoping the check to a `pwsh`/`powershell` invocation, and pinned both directions; `bash -ec 'git commit -m x'` still denies, now via the nested-shell path, which is the correct reason. The five `deviation` items were the spec's Approach policy map lagging its own reconciled Section 1, the `gh` coverage being wider than the spec's list, the whole evasion-analysis layer (quote masking, nested-executor recursion, `cd` tracking, git-root containment) going unnamed in the spec, the qa-verifier sentence omitting its overwrite carve-out, and the root `README.md` hook inventory missing the new guard. All five are now reconciled in the spec or the docs.

Decisions / Surprises:
- **Deliberate scope extension, recorded rather than silently taken:** Section 2 scoped the tree-state bracket to `executing-work` only, but the judgment agents are dispatched from the finishing pass too, including the rounds that found these Criticals. Shipping a control whose stated precondition does not hold where it matters most is worse than a scope-line violation, so `finishing-work/SKILL.md` now brackets its steps 1 to 3 as well. Both skills were also narrowed to claim only what the check can see: every write that leaves a tracked-file delta, not every write shape.
- **Deliberately deferred, filed in `docs/backlog.md`:** a governed agent holding Bash can overwrite the guard's own file in the plugin cache, which permanently disarms all four guards on a path outside any git root. A denylist rule matching that path was considered and rejected, because it stops only the naive spelling of a mutation the fail-open posture already declines to chase (`node -e`, a variable-assembled path). The real question is whether the loader should read from a location the agents cannot write, which is a design fork, not a regex. Also filed: a written access model for the four guards, whose policies and accepted risks currently live only in their file headers.
- **Five rounds, each finding confirmed evasions of the last round's fixes, is itself the finding.** The honest framing: a fail-open denylist over model-authored shell strings converges slowly, and the hook raises the cost of an accidental mutation rather than closing the class. The tree-state comparison is what catches the general case, which is why it is wired into both dispatch paths and why its limits are now stated rather than implied. The finishing adversarial review's judgment, which matches the evidence, is that the design is converging (each fix landed inside the shared spine, and the newline fix was one character in the shared segment cutter that healed every heuristic at once) while the per-command operand grammars are where the remaining low-value tail lives.
- **Both rules were dogfooded before they shipped.** The two review rounds run after Section 2 landed were bracketed and showed no tree delta, and the one main-thread tree-mutating probe was run with no agents in flight, then restored and verified byte-identical.
- **A process failure worth recording, since it is the exact hazard these rules address:** a gate run against the tree while an implementer was still writing produced a phantom red and two phantom probe mismatches, all of which cleared on a settled tree. A 90-second mtime-stability window was too short to conclude an agent had finished. Separately, one probe script written to a Git-Bash `/tmp` path failed to load and every case read as "allow"; the deliberate controls in that probe caught it, which is the argument for putting known-answer controls in every probe.
- The hook is inert in the session that built it, because the plugin loads from a cache snapshot rather than the repo. Its behavior goes live on the next kit update, so the 62 tests plus direct payload runs are the whole of the evidence for this effort, and the first real-subagent denial is unobserved by construction.
Review Findings: all Criticals fixed and re-verified; no Major left unaddressed; the two deferred items are recorded above with their reasoning and filed in the backlog.
Next: none, the effort is complete.
Commit Model: Commit-and-Push
