# The kit plugin is renamed from `claude-kit` to `grimoire`, so Claude Code 2.1.287's validator passes it and every host migrates itself on its next session

Status: In Progress
Commit Model: Branch-and-PR
Created: 2026-10-02

## Dispatch Authorization

The ARCHITECT persona wrote this plan on 2026-10-02 on the operator's rulings, given on the ARCHITECT's channel that day after the kit worker relayed his words from its thread: the kit is renamed rather than the validator tolerated, the name is Grimoire from his list of four, the GitHub repository is renamed to match, and the doctor and the session-start hook migrate each machine's files. It is the second of the rename's four plans and has two preconditions, on dispatch: the persona repository's `agent_persona_kit-name-tolerance_spec_v1.md` has merged, and the operator has confirmed on the ARCHITECT's channel or the coordinator's that the persona plugin is updated on every fleet host. Until both hold, a host's kit auto-update under the new name would cost every running persona its memory calls and its kit skills. The coordinator queues it for the kit's worker once both hold. The plan on branch `plans/validate-reserved-name`, which tolerated the validator's error instead, closes unrun by its own Dispatch Authorization, and this plan supersedes it.

## Goal

The kit plugin's name is `grimoire` everywhere the name is read: the manifest, the marketplace entry, the plugin folder `plugins/grimoire/`, the skill and agent prefixes a session types, the install id `grimoire@applefeld`, the output style `grimoire:Kit`, the doctrine file `~/.claude/grimoire-doctrine.md` with its import line, stamp and signpost, and the build, hook, doctor and setup scripts that spell any of them. `claude plugin validate` passes the plugin and the marketplace on 2.1.287, so the pre-commit hook lets a plugin commit land again. The marketplace carries a `renames` map, so Claude Code rewrites each host's settings on its own. On a host that still carries the old files, the session-start hook renames the doctrine file, its stamp and the signpost and swaps the import line, and the doctor reads the same four, the output style and the install under the new name, repairing each under `-Fix`. The test suite is green under the new paths, and a search for the old token outside history finds only the renames map, the migration code that must spell it, and this plan.

## Intent

The frame, in the operator's words of 2026-10-02. On the choice: "Kit feels incomplete and short to me. Let's choose one of: Matrix, Substrate, Doctrine, or Grimoire. Pick what you feel is best." On the repository: "Agreed, I'll rename to match." On the machine files: "Agreed, Doctor renames them too." The ARCHITECT chose Grimoire because Substrate already names the kit's PIANO direction note, Doctrine names the document the kit installs on every machine, Matrix collides with build matrices, and Grimoire appears nowhere in the three repositories, which makes the sweep checkable both ways. Both candidate names were run through the installed 2.1.287 validator on the kit's own payload and passed.

What done needs to do. Every tracked file outside history carries `grimoire` where it carried `claude-kit`, and the two paths spelling the token move. The marketplace renames the entry and maps the old name to the new. The session-start hook and the doctor migrate a host's four files, the doctor also the output style and the cache, so an operator runs nothing by hand beyond the doctor on a host it reports. The in-flight branches get a recipe the Chapter records, so each can take the rename before merging trunk.

What done does not need to do. It does not rename the skills `kit-goal` and `kit-doctor`, the output style `Kit`, or the word "kit" in prose, which the operator's ruling did not reach. It does not rewrite archived plans, the kaizen archive, the dated mechanism-cut artifact or the kaizen inbox notes, which are history. It does not rename the active plans' files, whose `claude-kit_` prefix is the handle in-flight worktrees and the goal leash hold. It does not rename the GitHub repository, which is the operator's act, nor rewrite the marketplace's repository pointer in settings, since GitHub redirects the old name. It does not build the public marketplace, which is the fourth plan.

Alternatives refused. Tolerating the validator's error in the pre-commit hook: refused by the operator, who chose the rename. Renaming the active plan files too: refused, since every branch in flight and the kit worker's parked commit hold those names, and the thousand lines that cite plan files by name would point at nothing. A tree-wide replace that includes history: refused, since the archive is immutable by the docs taxonomy and a renamed archive would read as if it had always said so. Leaving the machine files under the old name: refused by the operator.

Rulings after the spec shipped: none yet.

Provenance: written by the ARCHITECT persona, session 57239bb8, on 2026-10-02, with the validator runs made on this machine's installed 2.1.287 build and the renames mechanism read from the Claude Code host-marketplace documentation the same day.

## Approach

**The token and its exclusions.** The token is `claude-kit` not followed by an underscore. `claude-kit_` is the project prefix on every plan file name, archived and active, and those names do not change, so the 1,823 lines across the tree at 3551ed71 that cite a plan file by name, in `docs/README.md`, `docs/backlog.md`, `docs/plans/README.md`, the active plans, `docs/rationale-ledgers.md` and every skill's rationale ledger, keep their citations. The sweep replaces the token with `grimoire` in every tracked file except: `docs/archive/`, `kaizen/archive/`, `kaizen/notes-*.md`, `tools/corpus-compression/mechanism-cut-2026-09-30.json`, and this plan. The one other spelling, `claudekit.memorysync` at `plugins/claude-kit/doctor/install-memory-sync.ps1:58`, `hooks/memory-session.js:696` and `:929` and four test sites, is a git config key written into every host's memory store repository, so it stays, named under `## Out of Scope`. The counts at origin/main 3551ed71: 409 tracked files carry the token, 237 of them outside `docs/`; the plugin folder holds 170 files; `plugins/claude-kit/` and `home/claude-kit-doctrine.md` are the two tracked paths that spell it outside `docs/`. The recipe, run from the repository root under Git Bash, is `git mv plugins/claude-kit plugins/grimoire`, `git mv home/claude-kit-doctrine.md home/grimoire-doctrine.md`, then `git ls-files -z | grep -zv -e '^docs/archive/' -e '^kaizen/archive/' -e '^kaizen/notes-' -e '^tools/corpus-compression/mechanism-cut-2026-09-30.json$' -e '^docs/plans/claude-kit_grimoire-rename_spec_v1.md$' | xargs -0 sed -i -E 's/claude-kit([^_]|$)/grimoire\1/g'`. The same token rule is the acceptance's grep, `git grep -n -P 'claude-kit(?!_)'`. The worker reads `git ls-files --eol` before the sed, since Git Bash `sed -i` strips every carriage return from a CRLF file, and restores any file whose line endings it changed. The Chapter records the exact commands, since every branch cut before this plan merges applies the same recipe at its own tip before merging trunk, and identical hunks merge clean.

**The marketplace, `.claude-plugin/marketplace.json`.** The entry's `name` and `source` become `grimoire` and `./plugins/grimoire`, and the file gains a top-level key beside `plugins`, `"renames": { "claude-kit": "grimoire" }`, a map from each former name to the current one. The documentation read on 2026-10-02 states what that does on a host: Claude Code loads the plugin under the new name, shows `Renamed to "grimoire" in the "applefeld" marketplace` once, and rewrites the old key to the new in `enabledPlugins` and `pluginConfigs`, both keys of `~/.claude/settings.json` and of the project and local settings files. Nothing in this tree carries the map today, so the shape here is the documentation's and the validator's check of the chain is the proof. For a marketplace added from a git repository, the renamed plugin reports `Plugin "grimoire" not cached` until the host runs `claude plugin install grimoire@applefeld` once, which the doctor does under `-Fix`. The map is append-only history and never shrinks. `claude plugin validate .` checks the chain.

**The plugin folder and the scripts.** `plugins/grimoire/.claude-plugin/plugin.json` carries `"name": "grimoire"`. `.githooks/pre-commit` at `:16` and `:23` watches and validates `plugins/grimoire/`, and the message at `:29` and the zip name follow. `build.ps1` at `:21` and `:83`, `build.sh` at `:11` and `:88`, `.gitignore` at `:11`, `:16` and `:17`, `setup.sh` at `:21`, `:22`, `:60`, `:110` and `:111`, `doctor.ps1` at `:5`, and `home/CLAUDE.md:2` take the sweep. In the payload, the sweep reaches `hooks/doctrine-refresh.js:48` to `:52`, `compact-deferral-nudge.js:471`, `hook-canary.js:306` to `:359`, `kit-goal.js:98` to `:100`, `kit-read-lib.js:174`, `kit-version-nudge.js:60` and `:104`, `memory-recognition-nudge.js:1164`, `session-start.js:152`, `:977` and `:1453`, `scripts/kit-size.js:271` to `:286`, `scripts/memq-shim.js:75`, `doctor/doctor.ps1:210`, `:227`, `:351`, `:363`, `:368`, `:399`, `:410`, `:437`, `:897`, `:898` and `:923`, `doctor/install-memq-shim.ps1:215`, and the agents, skills and rationale ledgers, whose hits are path citations and prefixed agent ids. The cache the engine writes for an installed plugin is `~/.claude/plugins/cache/<marketplace>/<plugin>/<sha>/`, so `memq-shim.js`, `kit-goal.js` and `session-start.js` read the new folder name once the host has installed under it.

**The tests, `test/`.** 77 test files outside `test/probes/` carry the token, as paths into the payload, as the doctrine file name, as the signpost name, or as a prefixed agent id, and `test/size-budget.json` keys 74 paths. All take the sweep. The probes under `test/probes/` are prose scenarios and take it too. The suite is `node --test test/*.test.js`, per `docs/architecture.md:21`, and the size ratchet's caps are line counts, so no cap moves.

**The machine migration, in the session-start hook.** `hooks/doctrine-refresh.js` runs at every session start under the kit's hook registration and already owns the doctrine file, its stamp and the import line. Before its refresh step at `:120`, a migration step reads `~/.claude`: where `grimoire-doctrine.md` is absent and `claude-kit-doctrine.md` present, it renames the file, renames `claude-kit-doctrine.stamp.json` to `grimoire-doctrine.stamp.json` where that exists and the new name is absent, and renames `claude-kit.local.json` to `grimoire.local.json` on the same two conditions. Where `~/.claude/CLAUDE.md` holds a line that is exactly `@claude-kit-doctrine.md`, it rewrites that one line to `@grimoire-doctrine.md`, preserving the file's line endings, and reports the rewrite in its session-start lines, since the file is the user's own and the hook today only offers to add the import. A line carrying the old token with anything else on it is left, and the existing offer at `:168` then fires for the new token. Each rename is a `fs.renameSync` that gives up quietly on error, as the hook's writes do. The migration constants are the one place in the payload that still spells the old names, and a comment says why.

**The machine migration, in the doctor.** `doctor/doctor.ps1`'s Doctrine import section at `:351` to `:410` and the signpost section at `:437` read the new names. A migration check before them reports FAIL where any of the four old files or the old import line is present and the new is absent, naming each, and `-Fix` performs the same four renames and the one-line rewrite the hook performs. A check on the output style reads `~/.claude/settings.json`'s top-level `outputStyle`: FAIL where it is `claude-kit:Kit`, and `-Fix` rewrites it to `grimoire:Kit`. The doctor's one settings writer is `Set-AutoCompactWindow -Path -Value` in `doctor/install-compact-window.ps1:25`, which writes one fixed key; this section lifts its read-modify-write into `Set-UserSettingKey -Path -Key -Value` in the same file, has `Set-AutoCompactWindow` call it, and calls it for `outputStyle`, so the file keeps every other key byte for byte and there is still one writer. A check on the install reads `~/.claude/plugins/installed_plugins.json`, whose shape is `{ "version": 2, "plugins": { "<name>@<marketplace>": [ { "installPath": ..., "lastUpdated": ... } ] } }`: where `enabledPlugins` in settings carries `grimoire@applefeld` and that file has no `grimoire@applefeld` key, FAIL naming `claude plugin install grimoire@applefeld`, which `-Fix` runs. The doctor reads neither file today, so both reads are new and take the doctor's existing JSON read of `settings.json` at `:2346` as their shape. The memq shim check at `:897` to `:923` already fails where the installed shim differs from the payload's, and `-Fix` already reinstalls it, so the shim's `PLUGIN_NAME` reaches every host through the existing repair. The doctor's settings pointer for the marketplace stays, since GitHub redirects a renamed repository.

**The README and the install text.** `README.md` takes the sweep, and its install step at `:168` to `:191` gains one sentence, written in section 1 and spelling no old token: a machine that installed the plugin under its former name sees Claude Code rename it once and then needs the one install command, which the doctor runs. `docs/plans/README.md:8`'s naming example stays, since the active plans keep their prefix. `setup.sh:110` and `:111` print the new install id and import line.

**The sweep's control.** After the sweep, `git grep -n -P 'claude-kit(?!_)'` outside the sweep's own five exclusions must find only `.claude-plugin/marketplace.json`'s renames line, and after section 2 also the migration constants and their comment in `doctrine-refresh.js`, the doctor's migration check and the tests pinning those two. The control for the silence is a file carrying the token, written under `plugins/grimoire/skills/` and added to the index so `git ls-files` lists it, before the sweep is re-run; the sweep must change it, and the worker removes it before the commit. The Chapter records both.

**Branches cut before the merge.** Every branch on origin under `plans/` and `backlog/` at the merge, the kit worker's `plans/jev-code-checks` with its parked plugin commit among them, was cut before this plan. Each owner runs the recipe above at its own tip, commits, then merges trunk; a file the branch added under `plugins/claude-kit/` moves with the `git mv`. The worker posts the recipe to the coordinator at the section close, with `git branch -r` read at that moment.

## Standing Brief Amendments

- A literal that names state outside this repository keeps the old spelling, since a rename there is its own migration, as `## Out of Scope` already rules for `claudekit.memorysync`. The class: the memory-sync allowlist marker in `doctor/install-memory-sync.ps1`, the sidecar daemon's scheduled task name in `sidecar/install-daemon-task.ps1`, a host directory path (a drive path, a `/d/` path, a `D--` project segment such as `D--claude-kit`), a memory record's name, and the GitHub repository slug, which GitHub redirects once the operator renames the repository. A predicate over memory record content, such as the post-rewrite triage plan's operator-tier grep, matches both spellings, since records written before the rename keep the old one. The marker and the task name each carry a one-line comment saying why they keep it. Every acceptance grep in sections 1 and 2 lists these lines beside the lines it already names.
- The sidecar batteries' captured data, `sidecar/batteries/*/cases.json`, `sidecar/batteries/*/situations.json` and `sidecar/batteries/recognition-v1/index.md`, is history and a sixth sweep exclusion. Their runners and READMEs take the sweep where they spell the plugin's folder.
- `.gitignore` keeps the three former build-output lines beside the new ones, so a clone that still holds build output under the old folder stays clean after the merge.
- The sweep is the byte-preserving node script the section 1 Chapter records, never `sed -i`, which strips CR from the tree's CRLF files under Git Bash. Its keep rules encode every exclusion above, so a run over the merged tree changes nothing.
- A branch cut before the merge takes the rename by merging trunk first and then running that script over the whole tree, which renames only the branch's own new lines. This replaces `## Approach`'s run-the-recipe-at-your-tip step. A sweep run before the merge would rewrite every line trunk restored by hand.

## Sections of Work

### 1. The tree carries the new name, and the validator and the suite pass under it

Model: sonnet

Acceptance:
- `claude plugin validate ./plugins/grimoire` and `claude plugin validate .` both end `Validation passed`, exit 0, on 2.1.287.
- `node --test test/*.test.js` is green against the baseline recorded before the section's first edit, with the pass and fail counts and any failing names in the Chapter.
- `git grep -n -P 'claude-kit(?!_)'` over the tree, outside the sweep's five exclusions, `docs/archive/`, `kaizen/archive/`, `kaizen/notes-*.md`, `tools/corpus-compression/mechanism-cut-2026-09-30.json` and this plan, finds only the marketplace renames line, listed in the Chapter.
- `git ls-files --eol` reads the same line endings per file before and after the sweep, both reads in the Chapter.
- A commit staging one file under `plugins/grimoire/` passes the pre-commit hook on this host and rebuilds `plugins/grimoire.zip`, the hook's output in the Chapter.
- The planted-file control changed under the sweep, recorded in the Chapter.
- The Chapter carries the exact commands run, as the recipe for in-flight branches.

Files in scope: `plugins/claude-kit/` moved whole to `plugins/grimoire/`, `home/claude-kit-doctrine.md` moved to `home/grimoire-doctrine.md`, `.claude-plugin/marketplace.json`, `.githooks/pre-commit`, `.gitignore`, `build.ps1`, `build.sh`, `setup.sh`, `doctor.ps1`, `README.md`, `home/CLAUDE.md`, `docs/README.md`, `docs/plans/README.md`, `docs/*.md`, `docs/plans/*.md` other than this plan, `sidecar/`, `tools/` other than the dated artifact, `kaizen/README.md`, `test/`.
Tests: the whole suite under the new paths, since every path pin is a reader of the token; the validator on both manifests, since the validator is the gate the rename exists to pass.

### 2. Each host migrates itself: the session-start hook renames the four files, and the doctor reads and repairs the rest

Model: opus

Acceptance:
- `node --test test/doctrine-refresh.test.js` passes with new cases: a home holding the four old files and an import line that is exactly the old token ends with the four new files, no old file, and the new import line, with the file's line endings kept; a home holding only new files is untouched; a home holding both the old and the new doctrine file leaves both; a `CLAUDE.md` whose old-token line carries other text keeps that line and gets the wiring offer for the new token. The four-old-files case is red before the hook's edit and green after, both runs in the Chapter.
- A new `test/doctor-rename-migration.test.js`, built on the technique `test/doctor-goal-state.test.js` established and `doctrine-refresh.test.js` and `kaizen-signpost.test.js` use, lifting the new doctor sections as source text into a harness that stubs `Report`, passes with these cases: a home in the four-old-files state reads FAIL naming each, and `-Fix` leaves it in the migrated state; a settings file with `outputStyle` `claude-kit:Kit` reads FAIL, and `-Fix` rewrites that one key and leaves the rest of the file byte for byte; a settings file enabling `grimoire@applefeld` beside an install file without that key reads FAIL naming the install command, with the command invocation stubbed in the harness.
- The hook run by hand as `node plugins/grimoire/hooks/doctrine-refresh.js` with `HOME` and `USERPROFILE` pointed at a temporary home seeded in the four-old-files state leaves the four new files and the new import line, the listings before and after in the Chapter. The worker's own host is not touched: the new install id exists in no marketplace until this plan merges, and the doctor's `-Fix` would rewrite the session's own settings file, which the doctrine bars. The real-host run is the operator's, under `## Operator Verification`.
- `git grep -n -P 'claude-kit(?!_)'` outside the sweep's five exclusions finds only the marketplace renames line, the migration constants and their comment in `doctrine-refresh.js`, the doctor's migration check, and the two test files, each listed in the Chapter.
- `node --test test/*.test.js` is green against the section 1 baseline.

Files in scope: `plugins/grimoire/hooks/doctrine-refresh.js`, `plugins/grimoire/doctor/doctor.ps1`, `plugins/grimoire/doctor/install-compact-window.ps1`, `test/doctrine-refresh.test.js`, `test/doctor-rename-migration.test.js`.
Tests: the rename of each file both ways, since a hook that renames over an existing new file would discard a newer write; the import line swap only on an exact-token line, since the file is the user's; the output style rewrite leaving every other key, since the settings file holds permissions; the install command named and not run outside `-Fix`, since a read-only doctor run must change nothing.

## Out of Scope

- The persona repository's kit lookup and priming text, which `agent_persona_kit-name-tolerance_spec_v1.md` covers before this plan and the persona rename plan finishes after it.
- The public marketplace, the publish jobs and the privatizing: the fourth plan.
- The git config key `claudekit.memorysync`, written into every host's memory store repository by `install-memory-sync.ps1` and read by `memory-session.js`: a rename of a key in other repositories is its own migration and is not the plugin's name.
- Archived plans, the kaizen archive, the kaizen inbox notes and `tools/corpus-compression/mechanism-cut-2026-09-30.json`, which are history, and the active plans' file names, which are handles in flight.
- The skills `kit-goal` and `kit-doctor`, the output style file `Kit`, and the word "kit" in prose.
- The GitHub repository rename and the marketplace pointer in settings, under `## Operator Verification`.
- The tolerate-the-validator plan on branch `plans/validate-reserved-name`, closed unrun; its branch may be deleted.

## Assumptions

- assumed 2026-10-02 (source: the Claude Code host-marketplace documentation, read that day): a top-level `renames` map migrates `enabledPlugins` and `pluginConfigs` on 2.1.193 and later, and a git-hosted marketplace's renamed plugin needs one install command per host; reversal: a host where the rename notice never shows, which moves the settings rewrite into the doctor's `-Fix`. The installed 2.1.287 binary carries a step named `renamePluginInstallations` beside the notice, so the install command may prove unneeded on this build; the doctor's install check then reads PASS and runs nothing.
- assumed 2026-10-02 (source: this host's cache at `~/.claude/plugins/cache/applefeld/claude-kit/<sha>/`): the engine names the cache folder after the plugin, so the installed copy lands under `applefeld/grimoire/`; reversal: a folder under another name, which moves `memq-shim.js`'s resolver to read `installed_plugins.json` instead of the folder name.
- assumed 2026-10-02 (default): the migration lives in `doctrine-refresh.js` rather than a new hook, since that hook already owns three of the four files and runs at every session start; reversal: none needed.
- assumed 2026-10-02 (default): the doctor's settings rewrite widens the one existing writer in `install-compact-window.ps1` to take a key name, rather than adding a second writer; reversal: none needed, since the widened function is the same read-modify-write with the key as a parameter.
- assumed 2026-10-02 (default): in-flight branches migrate by re-running the recipe at their tips rather than by a committed script; reversal: a script under `tools/`, if two branch owners report conflicts the recipe did not clear.

## Operator Verification

- Rename the GitHub repository `SApplefeld/claude-kit` to `SApplefeld/grimoire` after this merges. GitHub redirects the old name, so no host's settings need to change for it.
- On each fleet host, after the kit updates: start one session and read the rename notice, then run the doctor with `-Fix` from the host's clone and read PASS on the migration, the output style, the memq shim and the install. On a host with no clone the doctor ships inside the payload the install caches, so where a session there reports the plugin not cached, run `claude plugin install grimoire@applefeld` by hand first. A host still reading FAIL on the install after `-Fix` reopens the doctor's install repair. One session start on this machine after the merge, with `~/.claude` listed before and after, is the real-host check of the hook's migration, and reopens section 2 where any of the four files or the import line is left under the old name.
- Confirm on the ARCHITECT's channel that every host runs the persona plugin at or past the tolerance plan's merge before the coordinator dispatches this plan.

## Open Questions

- None.

## Related

- `agent_persona_kit-name-tolerance_spec_v1.md` in the persona repository: the first plan, which this one waits on.
- Branch `plans/validate-reserved-name`, `claude-kit_validate-reserved-name_spec_v1.md`: the tolerated-error alternative, closed unrun by the operator's ruling and superseded by this plan.

## Chapters

### Chapter 1 - 2026-10-02
Completed: 1. The tree carries the new name, and the validator and the suite pass under it
Implemented By: implementer-sonnet (the sweep), then the main session (both fix rounds and the close pass, which were mechanical restores and partly under `docs/`)
Metrics: review rounds 3, closed clean; provenance 9 spec-traceable, 0 fix-introduced, 0 new-requirement, rulings (0 refused, 0 declared, 0 asked); advisory: 0 findings, 0 fixed, 0 deferred, 0 refused; NEEDS_CONTEXT 0; escalations 0; consults 0
Decisions / Surprises: The section-open add-decision and the round 1 and 2 add-decisions, verbatim from the scratch file:
- section 1 open: changes the plugin's name token across the tree, moves two paths, adds the marketplace renames map and one README sentence; serves the Goal's first two sentences and section 1's acceptance; adds no mechanism (a rename, a data key, a sentence); size 409 tracked files at 3551ed71 per the plan; not building it leaves the pre-commit validator refusing every plugin commit.
- r1 Critical (frozen battery fixtures rewritten): restores sidecar/batteries data files whole from b4f98711; serves Intent's "does not rewrite ... history"; no mechanism; 5 files; not fixing mis-scores battery situation 3 and falsifies the provenance claims.
- r1 Major (host paths swept): restores the token where it names a host directory; serves the Goal and Out of Scope's host-state class; no mechanism; about 15 lines outside the battery data; not fixing sends the Ready triage plan to a nonexistent memory directory.
- r1 Major (acceptance grep 5 hits): writes a Standing Brief Amendments block; no mechanism; not fixing leaves both grep bullets unmeetable as written.
- r1 Major (.gitignore dropped old lines): keeps the three old ignore lines beside the new ones; no mechanism; 3 lines; not fixing dirties every existing clone after the merge.
- r1 Major (plan index reads from grimoire to grimoire): rewrites two index sentences; no mechanism; 2 lines.
- r2 Major (triage plan memory-file predicate swept): the predicate matches both spellings in prose and grep; no mechanism; 1 line; not fixing undercounts the triage inventory from 11 records to 0 on this host.
- r2 Major (memq test project segment and the GitHub slug swept): restores both; no mechanism; 6 lines.
- r2 Major (in-flight recipe cannot reproduce trunk): replaces sweep-at-tip with merge-then-sweep, and the script gains keep rules for every exclusion; no mechanism in the shipped tree; not fixing silently undoes trunk's restores on every pre-merge branch.
Three intake gaps went to the ARCHITECT, which agreed on 2026-10-02 (record DEV-PLUGIN-e57cef63, answering ARCHITECT-1ca002ff-1). The memory-sync allowlist marker and the sidecar daemon's scheduled task name keep the old spelling, as host state written outside the repository. The plan's literal `sed -i` recipe was replaced by a byte-preserving node script, since 558 tracked files are CRLF in the worktree and Git Bash `sed -i` strips every CR. Both review rounds then found that the sweep, case-blind to meaning, renamed more outside state and history than the plan's five exclusions named: captured battery data, host directory paths, a memory record's name, the repository slug and a memory-record predicate. Approval drift: the `## Standing Brief Amendments` block was created as its own heading above `## Sections of Work`, recording the host-state class, the battery exclusion, the kept `.gitignore` lines, the byte-preserving script, and the merge-then-sweep recipe. That recipe replaces `## Approach`'s run-the-recipe-at-your-tip step. Status moved from Ready to In Progress on starting. Both validators end `Validation passed with warnings`, exit 0: the one warning is the missing `version` field, which `plugin.json` omits by design, so the acceptance bullet's `Validation passed` reads as met. In the kit's own repository the writing-skills probe pair reading was not taken, since no probe scenario turned on a rename of path strings.
Failed approaches: tried the plan's literal sweep-then-merge recipe for in-flight branches, failed because trunk's hand restores make a pre-merge sweep rewrite them (a replayed sweep merged against this branch conflicted in 8 files), learned that a recipe for other branches must be idempotent on trunk rather than a replay of trunk's first step. Tried a host-path restore regex with escaped backslash alternations, failed because a heredoc through the Bash tool collapsed the doubled backslash and the pattern silently missed `D:/` paths, learned to use a character class `[\\/]` and to give every absence check a control.
Assumptions: assumed 2026-10-02 (source: the ARCHITECT's agreement, record DEV-PLUGIN-e57cef63; section 1): literals naming host state outside the repository keep the old spelling; reversal: an operator ruling to migrate them, which is its own migration. assumed 2026-10-02 (default; section 1): the per-session temp names `claude-kit-recognition` and `claude-kit-session-*.json` take the new name as a one-time cache reset, costing one lost dedup per host; reversal: restore both names with a comment.
Review Findings: review: code pair at opus, Workflow (round 1, round 2, re-raised by round 1's surviving Critical); review: adversarial at sonnet, Workflow (round 3). Round 1: 1 Critical fixed (battery fixtures), 5 Majors fixed (host paths, grep amendment, `.gitignore`, plan index, and the blind lens's battery Major, which duplicates the Critical). Round 2: 3 Majors fixed (triage predicate, memq segment and slug, recipe). Majors justified, each delivered by section 2 before any merge, with the pull request held as a draft until then: the doctrine import and file never migrated (blind, round 1 Major and round 2 Critical, the Critical downgraded at adjudication to justified-not-fixed on that ground), the signpost renamed without migration (blind, rounds 1 and 2), and README's "which the doctor runs" (blind claim, rounds 1 and 2, true once section 2 adds the doctor's install repair). The blind round 2 Major that the `renames` key is unverified was refuted: `claude plugin validate .` passes with it, and the round 1 blind lens found the key in the installed binary's marketplace schema. The traces on the blind lens's findings are orchestrator-made. Minors: 9 fixed in the fix rounds and the close pass (title-case spellings, duplicate comment, test comment, README tree padding, rationale-ledger segment, jev handoff slug, index status word, script header order, head-tree suite run); 1 routed to `docs/backlog.md` (memory records whose triggers name the former folder); 4 left with the reason: the temp-cache names (the assumption above), memq-shim staleness (the doctor's existing shim check repairs it), a live dev-clone session losing hook files on the move (sessions run from the plugin cache), and the role skill's `Repo:` example (true once the operator renames the repository).
Stamps: adjudicated 20, stamped 5: project `suite-baseline-is-not-zero-fail` and `the-whole-gate-reds-one-sidecar-test-from-a-linked-worktree` (read the baseline's one red as the linked-worktree property), operator `git-bash-sed-i-strips-cr` and `gitbash-sed-strips-cr-in-text-mode` (replaced the sed recipe), operator `bash-tool-heredoc-collapses-backslashes` (explained the restore regex's miss); the 15 others were read through nudges and did not change the work.
Gate: whole suite `node --test test/*.test.js` at 27ff95ab plus two uncommitted index lines under `docs/`, worktree `.kit/wt-grimoire`, 2026-10-02 16:57-17:05Z, SCOTT-CLAUDE, process poll clear: 4338/4327/1, skipped 10, exit 1; baseline on the same lane at b4f98711, 15:54-16:03Z, clean worktree: 4338/4327/1, skipped 10, exit 1; delta none, the one failure in both `loadIndex answers a status, never a throw, for a cwd the store refuses to name` (`test/kit-sidecar-memory-index.test.js`, the linked-worktree property). Targeted lanes in the fix rounds: 1504/1500/0 exit 0 over the touched and battery-reading files after b8625b34; `test/memq.test.js` 806/806/0 after b257896b. Tests added 0, retired 0; edited to stay green on the section's own change: `test/size-ratchet.test.js` (the case-variant root `plugins/Grimoire/` pins that a case variant of the plugin root is not the root) and the path pins across the suite the sweep rewrote. Spawning tests added 0. Wall clock 498 s against the baseline's 548 s on the same lane. Validators: `claude plugin validate ./plugins/grimoire` and `claude plugin validate .` both `Validation passed with warnings`, exit 0, on 2.1.287 at bc6f0e57. Pre-commit hook on bc6f0e57: `[pre-commit] plugin sources changed - rebuilding plugins/grimoire.zip`, `Built ...plugins\grimoire.zip (174 files, 2846 KB)`, commit exit 0. Line endings: `git ls-files --eol` before and after the sweep identical across 565 files once the two moved paths are mapped. Planted control: `plugins/grimoire/skills/zz-sweep-control.md` reading `the claude-kit plugin` and `~/.claude/claude-kit.local.json` became `the grimoire plugin` and `~/.claude/grimoire.local.json`, its `claude-kit_` prefix and CR untouched, then removed. Acceptance grep `git grep -n -P 'claude-kit(?!_)'` outside the six exclusions at 27ff95ab: the `renames` line in `.claude-plugin/marketplace.json`, the three kept `.gitignore` lines, the memory-sync marker (`install-memory-sync.ps1:55`), the task name (`sidecar/install-daemon-task.ps1:23,29`), and the host-state class: host paths and project segments in `docs/backlog.md`, the triage plan, the operating-instructions rationale ledger, the batteries' two READMEs and four tests, the triage plan's both-spellings predicate, and the repository slug in README.md, setup.sh, `docs/backlog.md` and the jev handoff. Recipe idempotence: the script below, run over the whole tree at 27ff95ab with one planted file carrying the token in a shape its literals do not name, changed that file only (`changed 1`).
Next: 2. Each host migrates itself: the session-start hook renames the four files, and the doctor reads and repairs the rest. Its migration constants spell the old names, so the script below gains a keep rule for those lines and is re-proved idempotent on the merged tree.
Commit Model: Branch-and-PR
Delta: moment 2026-10-02 ~16:58Z, SCOTT-CLAUDE, worktree `.kit/wt-grimoire` at 27ff95ab with two uncommitted index lines under `docs/`, alongside the close gate.

```
repository: wt-grimoire
words: 14149 of cap 14192 across 48 curated files
test lines: 142497 of cap 142505 across 80 test files
tests: 4087
changed paths under no measured root: 2 (2 differing from HEAD, 0 untracked), which this tool does not measure and which no row above names; named-exclusion paths in the changeset: none
corpus: 6530 words of cap 105304
```

The recipe for a branch cut before this plan merges. The trunk run, from the repository root under Git Bash:

```
git mv plugins/claude-kit plugins/grimoire
git mv home/claude-kit-doctrine.md home/grimoire-doctrine.md
git ls-files -z | node rename-sweep.js
```

A branch cut before the merge does not repeat those steps at its own tip. Its owner merges trunk first, which carries every renamed file and moves a file the branch added under the former plugin folder into `plugins/grimoire/` (git's directory-rename detection may report that move as a conflict to `git add`), then runs `git ls-files -z | node rename-sweep.js` from the repository root, which renames only the branch's own new lines, and reads the diff. `rename-sweep.js`, verbatim at this section's close:

```js
// The grimoire rename's token sweep. On trunk it ran once, after the two git mv
// commands. A branch cut before the rename merges trunk first, then runs it from
// the repository root:   git ls-files -z | node rename-sweep.js
// Over trunk's merged tree it changes nothing, so it renames only the branch's own lines.
// Replaces `claude-kit` not followed by `_` with `grimoire`, byte for byte, so
// CRLF files keep their endings. It leaves alone what names state outside the
// repository or is history: the excluded paths, the two host-state lines, and a
// token that is a host directory (drive path, /d/ path, D--<dir> project
// segment), a GitHub repository slug, or the triage plan's memory-file predicate.
const fs = require('fs');
const EXCLUDED = /^(docs\/archive\/|kaizen\/archive\/|kaizen\/notes-|tools\/corpus-compression\/mechanism-cut-2026-09-30\.json$|docs\/plans\/claude-kit_grimoire-rename_spec_v1\.md$|sidecar\/batteries\/[^/]+\/(cases|situations)\.json$|sidecar\/batteries\/recognition-v1\/index\.md$)/;
const KEEP_LINE = /\$script:MemorySyncMarker = "# claude-kit memory sync allowlist\."|claude-kit-sidecar-daemon/;
const KEEP_LINE_IN = {
  'docs/plans/claude-kit_post-rewrite-triage_spec_v1.md': /memory-operator/,
  '.claude-plugin/marketplace.json': /"renames"/,
  '.gitignore': /^plugins\/claude-kit/
};
const TOKEN = /([A-Za-z]:[\\/]+|\/[a-z]\/|\b[A-Z]--[\w-]*?|SApplefeld\/|<your-github-username>\/|sapplefeld-)?claude-kit(?!_)/g;
let changed = 0;
for (const f of fs.readFileSync(0, 'latin1').split('\0').filter(Boolean)) {
  if (EXCLUDED.test(f) || /\.zip$/.test(f) || !fs.existsSync(f)) continue;
  const buf = fs.readFileSync(f);
  if (buf.includes(0)) continue;
  const text = buf.toString('latin1');
  const out = text.replace(/[^\n]*\n|[^\n]+$/g, (line) => {
    if (KEEP_LINE.test(line) || (KEEP_LINE_IN[f] && KEEP_LINE_IN[f].test(line))) return line;
    return line.replace(TOKEN, (m, host) => host ? m : 'grimoire');
  });
  if (out !== text) { fs.writeFileSync(f, Buffer.from(out, 'latin1')); changed++; }
}
console.log('changed', changed);
```
