# claude-kit: sweep stale plugin cache folders

Status: Abandoned
Commit Model: Branch-and-PR
Created: 2026-09-15

Session model: any executor session in the kit repo on the execution model. Three sections in order, since section 2 reads the module section 1 ships and section 3 documents both. Authored 2026-09-15 by the coordinator persona on the operator's word over the relay thread. Re-anchored against trunk `5e51f266` by the architect persona under the post-rewrite program's ruling that a parked plan takes the three-part spec review before it is armed.

## Dispatch Authorization

The operator queued this plan on 2026-09-15 on the coordinator persona's relay thread, which the header of the original plan records. On 2026-09-24 the operator released the six parked kit plans to the kit worker on that worker's own relay thread, with the words the worker reported to the architect: run all six in whatever order is most logical. The worker holding the kit repository arms this plan first in that order once this re-anchor merges, and records the departure in the post-rewrite program's Log. That program, `docs/plans/claude-kit_post-rewrite_program_v1.md`, orders every plan written before the kit's corpus rewrite behind a triage step, and its Log is where a plan released ahead of that step is recorded, as its 2026-09-21 entry does for three earlier plans.

## Goal

The branch hygiene sweep also reclaims the plugin cache. Claude Code installs a plugin into a folder under `~/.claude/plugins/cache/<marketplace>/<plugin>/` on every install and update, names the folder after the plugin's version or its commit hash, and never deletes the previous one. On the operator's machine the kit's own cache holds 34 folders at 288 megabytes and the agentic plugin's holds 24 folders at 849 megabytes, both measured on 2026-09-24, and each count grows by one at every update. When this is done, one command lists every cache folder with its age, its size and whether it is kept or stale, deletes the stale ones only on an explicit flag, and the session-start nudge that already counts reapable branches names the stale-folder count beside them.

## Intent

The operator asked for the plugin cache to stop growing without bound, and for the sweep to live inside a hygiene step the operator already runs rather than a new ritual. Done means: a command a session can run from the branch hygiene skill, a dry run that shows the whole table before anything is removed, a delete that touches only the folders the table called stale, and a session-start line that says how many stale folders are waiting so the operator sees the pile before asking.

Done does not need: a sweep that runs on its own at session start, because a delete with nobody reading the table is the failure the dry-run rule exists to prevent. It does not need a size figure at session start, because a size is a recursive walk over a gigabyte of small files on every session start across the fleet, and the count alone says whether to run the sweep. It does not need to read what a running session has loaded, because that is not readable from outside the session, and the age floor stands in for it.

Alternatives refused. A new skill is refused because the operator already runs branch hygiene when the session-start nudge flags it, and a second sweep to remember is the cost the operator named. Reading the transcript folder or the process list to find live sessions is refused as unreliable on this machine and out of proportion to a seven-day floor.

Rulings after the spec shipped. 2026-09-24: the operator released this plan to run first among the six parked kit plans, on the kit worker's relay thread, as the Dispatch Authorization records. No other ruling has been made. One scoping decision changed in the re-anchor without a ruling: the 2026-09-15 scoping named a PowerShell script, and the re-anchor makes it a Node module, because the session-start count has to apply the same keep rule inside a Node hook and two implementations of one rule drift. That change is the architect's, declared under Assumptions with its reversal, and the operator's approval of this plan is what ratifies it.

Provenance: distilled from the coordinator persona's 2026-09-15 scoping and the architect persona's 2026-09-24 re-anchor, which read the live cache, the installed-plugins file, the branch hygiene skill and the session-start branch nudge on this machine.

## Approach

**One module holds the keep rule; two callers read it.** `plugins/claude-kit/scripts/plugin-cache-sweep.js` exports a classifier that takes the cache root, the parsed installed-plugins file and a clock, and returns one record per candidate folder. The same file is the command: run under node it prints the table, and with `--delete` it removes the stale set. The session-start hook `branch-reaper-nudge.js` requires the module and reads the count of stale records. So the rule that decides what is kept is written once and pinned once.

**The keep set is closed at two members.** A folder is kept when it is an `installPath` some entry of `~/.claude/plugins/installed_plugins.json` names, or when its own modification time is younger than the age floor. Everything else the sweep enumerates is stale. The install-path match compares both sides after `path.resolve`, case-insensitively on Windows and exactly elsewhere, since the file carries absolute paths whose separators and case need not match what the walk returns. The age floor is seven days, one exported constant, and the comparison is on milliseconds, so a folder exactly seven days old is stale and one a millisecond younger is kept. It stands in for the one fact the sweep cannot read, which session is still running on which folder: a session started before the newest update loads a folder the file no longer names, and seven days is longer than any session on this machine has lived. The installed-plugins file is read, never written. On this machine it is a version 2 document whose `plugins` object is keyed `<plugin>@<marketplace>` and holds an array of entries, each carrying `scope`, `installPath`, `version`, `installedAt`, `lastUpdated` and `gitCommitSha`. Every `installPath` in every entry of every array is kept, whatever its key, so a plugin installed at two scopes keeps both folders. A `version` field other than `2`, or a shape that is not an object of arrays, is a refusal: the sweep prints the reason on stderr, prints no table, and deletes nothing.

**The subject is a real directory at depth three under the cache root, and nothing else.** The sweep enumerates `<cache root>/<marketplace>/<plugin>/<folder>` at exactly that depth. It never descends into a candidate except to size it. Three things at that depth are outside the subject and are never classified or deleted. A file is not listed at all. A link, which is any entry whose `fs.lstatSync` reports `isSymbolicLink()`, and on Windows that reading covers a junction too, is listed as `skipped-link`, because a recursive delete through a link reaches outside the cache. A directory whose real path, read with `fs.realpathSync`, is not under the cache root's own real path is listed as `skipped-outside`, and a run that listed one exits 2 after the rest of the stale set is removed. The sweep never touches `~/.claude/plugins/marketplaces/`, `installed_plugins.json` or `known_marketplaces.json`, and never a file or folder directly under the cache root or a marketplace folder.

**Dry run is the default, and the delete is one flag.** Without `--delete` nothing is removed. With it the stale set is removed and each removal printed. The command's exit code carries three values, so a caller reads the verdict from the code rather than from the text: 0 for a clean run, whether or not anything was stale; 1 for a refusal, under which nothing was deleted; 2 for a run that completed and listed at least one `skipped-outside` folder, so the operator learns of it even from a script that reads only the code.

**The installed-plugins file is read through the reader the tree already has.** `hooks/kit-read-lib.js` exports `readFileBounded`, which `session-start.js` uses on this same file with a one-mebibyte ceiling and a BOM strip, because a special file at that path blocks a bare open forever. The module reads the file through it with the same ceiling, so the session-start hook cannot hang on a file the existing hook already reads safely.

**The nudge counts and points.** At session start the branch nudge already stands down under `KIT_EXTERNAL_ENGINE=1` and stays silent when nothing needs the operator. It gains one more read: the stale count, computed without sizing, taken right after the stand-down and held. A count above zero adds one sentence naming the count and the sweep command. The count is machine-level rather than repository-level, so every return the hook takes after the stand-down, the missing integration ref and the failed `--merged` read among them, prints the cache sentence when the count is above zero before it returns. The one exception is the stdin parse failure, which stays silent because a hook with no payload prints nothing by contract. The cache sentence comes last, after the branch sentences, and the closing line about refreshed refs prints only when a branch sentence printed. A cache root or installed-plugins file that cannot be read leaves the count at zero and the hook silent on it, since the hook is fail-open by contract.

**Sweep for surfaces that speak the cache path shape**, run at re-anchor on trunk `5e51f266` with `git grep -n -i 'plugins/cache'` over `plugins/claude-kit`, `docs` and `test`. Found: `docs/harness-assumptions.md:148`, which states the cache path shape this sweep depends on and is read, not changed; `plugins/claude-kit/skills/executing-work/SKILL.md:274`, `plugins/claude-kit/hooks/kit-compact-lib.js:144` and `plugins/claude-kit/scripts/memq-shim.js:11`, which resolve or describe the installed root and are unchanged; `test/compact-deferral-nudge.test.js` and `test/probes/`, which pin a composed command carrying the path and are unchanged; and the two plan indexes plus this plan. The branch hygiene surfaces: `plugins/claude-kit/skills/branch-hygiene/SKILL.md`, its `references/rationale-ledger.md`, `plugins/claude-kit/hooks/branch-reaper-nudge.js`, `test/branch-reaper-nudge.test.js`, and the hook's `startup|resume` registration in `hooks/hooks.json`, which is unchanged because the nudge stays one hook. `docs/architecture.md:91` lists the SessionStart hooks and `docs/backlog.md:19` carries a 2026-09-23 experiment about reinstalling over a damaged cache folder, which this plan does not cover and leaves in place.

## Sections of Work

### 1. The classifier and the sweep command
Model: opus

`plugins/claude-kit/scripts/plugin-cache-sweep.js`, zero-dependency CommonJS like its siblings in that folder. It exports the classifier, the age-floor constant and the reader of the installed-plugins file, and runs as a command when invoked directly. The reader opens the file through `readFileBounded` from `hooks/kit-read-lib.js`. Two platform facts the implementation rests on: Node reports a Windows junction as a symbolic link under `lstat`, and `os.homedir()` reads `USERPROFILE` on Windows and `HOME` elsewhere, so a scratch home in a test is set through both.

The classifier returns one record per candidate: marketplace, plugin, folder name, absolute path, age in whole days from the folder's own modification time, size in bytes where sized, and a verdict of `kept-install-path`, `kept-age`, `stale`, `skipped-link` or `skipped-outside`. The command prints one row per record with those columns, then a line with the stale count and the reclaimable total in megabytes. Every path and folder name it prints passes through `scrub` exported by `hooks/kit-compact-lib.js`, which `kit-size.js` requires under the local alias `scrubLine`, so a folder name that carries a control character cannot render as a terminal instruction. Sizing happens only in the command, never in the classifier the hook reads. A folder the walk cannot fully size, because an entry inside it is unreadable, prints its size as unknown and keeps its verdict, since the verdict never depends on the size.

Acceptance:
- `node plugins/claude-kit/scripts/plugin-cache-sweep.js` against the real cache prints a row for every folder the shell lists at depth three under `~/.claude/plugins/cache`, exits 0, and deletes nothing, confirmed by the folder count before and after. No acceptance step in this plan runs `--delete` against the real cache; that delete is the operator's, under Operator Verification, since a running session may depend on a folder there and the executor cannot undo the removal.
- Against a scratch root under `--root`, the command with `--delete` removes exactly the rows the dry run called `stale`, prints each removal, and exits 0.
- `--root <path>` points the command at another cache root and `--installed <path>` at another installed-plugins file. Each is independent of the other and each defaults to the real location under the home directory. Both are read only. The tests drive the command through them.
- An unreadable or unparseable installed-plugins file, a `version` other than 2, or a `plugins` value that is not an object of arrays exits 1 with the reason on stderr, prints no table, and deletes nothing, with or without `--delete`.
- A candidate that is a link is reported `skipped-link` and never sized, classified or deleted.
- A candidate whose real path resolves outside the cache root's real path is reported `skipped-outside` and never deleted, and a run that met one exits 2, after removing the rest of the stale set where `--delete` was given.

Files in scope: `plugins/claude-kit/scripts/plugin-cache-sweep.js` (new), `test/plugin-cache-sweep.test.js` (new), `test/size-budget.json` (the new test file takes a cap).

Tests: at minimum, lock both directions of the keep rule, a folder kept by install path and one kept by age against one stale, on a scratch root with one versioned and two hash-named plugins; lock that a dry run removes nothing and a `--delete` run removes only the stale set; lock each refusal the acceptance names, with a control that shows the delete path does run when nothing refuses; lock the link skip on each platform that can plant a link, and record the skip where none can. A silent pass over a scratch root that holds nothing stale is not evidence, so every case plants at least one stale folder.

References: `plugins/claude-kit/scripts/kit-size.js` for the command shape, the `--budget`-style path override and the `scrubLine` screen; `test/branch-reaper-nudge.test.js` for spawning a script as a child with a spread environment.

### 2. The session-start nudge counts the pile
Model: sonnet

`plugins/claude-kit/hooks/branch-reaper-nudge.js` requires the classifier from section 1 and computes the stale count over the real cache root under `os.homedir()`, without sizing. Every case in the hook's test file, the existing ones included, runs under a scratch home, because a case that reads the developer's real cache reds on a machine that holds stale folders and greens on a clean one. A scratch home whose cache is meant to be read carries a version-2 `installed_plugins.json` naming no folder under it, since an unreadable file leaves the count at zero by design. The read sits after the external-engine stand-down and before the git passes, and its result is carried to the output step, which now fires when any of reapable, stranded or stale is above zero. The sentence it adds names the count and the command: `<n> stale plugin cache folder(s) sit under ~/.claude/plugins/cache. Run the branch-hygiene skill's cache sweep to list and remove them.` Any error in the cache read leaves the count at zero and the rest of the hook unchanged.

Acceptance:
- With a scratch home whose cache holds one stale folder and a repository with no reapable branch, the hook prints the cache sentence and no branch sentence.
- With the same scratch home and a working directory that is not a git repository, the hook still prints the cache sentence, so the early return on a missing integration ref no longer swallows the count.
- With a scratch home whose cache holds nothing stale, the hook's output is byte-identical to its output on the same repository with a scratch home that has no cache root at all, captured in the same test run.
- Under `KIT_EXTERNAL_ENGINE=1` the hook prints nothing, stale folders or not.
- With no cache root under the scratch home the hook prints today's output.
- `node --test test/branch-reaper-nudge.test.js` exits 0.

Files in scope: `plugins/claude-kit/hooks/branch-reaper-nudge.js`, `test/branch-reaper-nudge.test.js`, `test/size-budget.json` (the test file's cap moves).

Tests: lock the count in both directions and the external-engine stand-down over a stale cache, and lock that the existing branch cases still pass under a scratch home.

### 3. The skill and the documents state the sweep
Model: opus
Locus: inline

`plugins/claude-kit/skills/branch-hygiene/SKILL.md` gains a `## Plugin cache` section between `## Recovering a stranded branch` and `## Hard rules`. It states the keep set whole, closed at the two members the Approach names, the dry-run-then-delete shape with the exact command for each, written as `node <plugin-root>/scripts/plugin-cache-sweep.js` with the plugin root resolved by the ladder `executing-work/SKILL.md` states for its own scripts, the age floor as the one tunable and where it lives, and the three things the sweep never touches. Its frontmatter description gains the trigger `stale plugin cache folders`. `## Hard rules` gains one bullet: the cache sweep deletes only a folder the dry run's table called stale, and a reparse point or a folder outside the cache root is a report, never a delete. The rationale ledger `references/rationale-ledger.md` gains one entry per new claim under its existing document heading, in the entry shape its header binds, with `passage:` lines. Each new entry's verdict is `keep`, and its provenance names this plan by filename and section 3, since the landing commit does not exist when the entry is written.

`docs/architecture.md` names the sweep where it lists the SessionStart hooks, in that document's present-tense register. The repository `README.md` describes the hook's role and lists every file under `scripts/` with one line each, so its line for the hook gains the count and `scripts/` gains a line for the new module. The ownership map, `plugins/claude-kit/skills/operating-instructions/references/ownership-map.md`, gives the branch-hygiene skill its moments on one row, and that row gains the fourth moment: which plugin cache folders may be deleted. `docs/README.md` and `docs/plans/README.md` keep their rows for this plan until the close moves it to the archive, where curating-docs rewrites them. `test/size-budget.json` moves the caps for the skill file and the ledger.

Acceptance:
- The skill file's `## Plugin cache` section names both keep members, both commands and all three untouched surfaces.
- `node --test test/size-ratchet.test.js` exits 0 with the moved caps.
- The kit's whole gate, `node --test test/`, exits 0 against the baseline recorded at the section's start.

Files in scope: `plugins/claude-kit/skills/branch-hygiene/SKILL.md`, `plugins/claude-kit/skills/branch-hygiene/references/rationale-ledger.md`, `plugins/claude-kit/skills/operating-instructions/references/ownership-map.md`, `docs/architecture.md`, `README.md`, `test/size-budget.json`.

## Out of Scope

- Pruning anything under `~/.claude/plugins/marketplaces/`, or writing to `installed_plugins.json` or `known_marketplaces.json`.
- Changing how Claude Code names or chooses cache folders, and any read of a live session's loaded plugin root.
- Sweeping a cache on a machine other than the one the session runs on.
- A size figure in the session-start nudge.
- The backlog's 2026-09-23 experiment on whether a same-version reinstall replaces a damaged cache folder, which stays where it is.
- Adding the new script to the build's integrity manifest, which covers `hooks/` only and is a backlog item of its own.

## Assumptions

- assumed 2026-09-24 (default): the sweep is a Node module rather than the PowerShell script the 2026-09-15 scoping named, so the session-start hook and the command read one keep rule; reversal: rewrite section 1 as a PowerShell script under `plugins/claude-kit/doctor/` and give section 2 its own count in JavaScript, accepting two copies of the rule.
- assumed 2026-09-24 (the live installed-plugins file on SCOTT-CLAUDE): the file is version 2 with `plugins` keyed `<plugin>@<marketplace>` holding arrays of entries; reversal: a Claude Code release that changes the shape trips the refusal in section 1, and the reader is updated then.
- assumed 2026-09-24 (default): a folder's age is read from the folder's own modification time, not from any file inside it, because the kit's own cache copies file times from the marketplace clone; reversal: read the newest time among the folder's entries instead, which is a slower walk.
- assumed 2026-09-24 (default): a plugin folder whose marketplace or plugin no longer appears in the installed-plugins file is swept by the same rule, since no install path names it; reversal: add a third keep member for a plugin absent from the file.
- assumed 2026-09-24 (the rationale ledger's own header): a new claim in the skill file takes a ledger entry, because the ledger says it carries one entry per claim; reversal: skip the ledger and record the omission in the Chapter.
- excluded 2026-09-24: a file directly under a plugin folder, beside the hash-named folders, is neither kept nor stale; the sweep lists folders only and never names or removes it.

## Operator Verification

Run the branch hygiene skill once after this plan lands. The dry run lists the kit's and the agentic plugin's old folders as stale with their sizes, keeps the two folders `installed_plugins.json` names and every folder younger than seven days, and the delete run reclaims the rest. Every persona session that was running when the sweep ran keeps working. A session that breaks after the sweep because its plugin folder is gone reopens the age floor.

## Open Questions

None at re-anchor.

## Related

- `docs/plans/claude-kit_post-rewrite_program_v1.md`: the program whose step 5 gate this plan runs ahead of on the operator's 2026-09-24 word.
- `docs/harness-assumptions.md`, the cache path shape entry: the assumption this sweep's enumeration depth rests on.

## Chapters

### Interim board 1 - 2026-09-24

Written at the compaction gate's deferral signal after the plan was opened and before section 1's dispatch.

Opening: worktree `.kit/wt-cache-sweep` on branch `plugin-cache-sweep`, cut from origin/main at 9cf69e62. Status set from Ready to In Progress as part of starting. The kit goal is armed from this worktree with `--self-armed` on the operator's 2026-09-24 release recorded under Dispatch Authorization. The post-rewrite program's Log gains the arming line and the one departure from its order: the coordinator sync plan closed first, in pull request 114.

Section stages: 1 about to dispatch to implementer-opus; 2 and 3 not started. Live dispatches: none.

Gate baseline: not yet measured on this tree. The nearest reading is the whole gate over the coordinator sync branch merged with 9cf69e62, measured 2026-09-24T13:56Z to 14:07Z on SCOTT-CLAUDE from a linked worktree: tests 4146, pass 4137, fail 1, skipped 8, exit 1, the one red the standing linked-worktree sidecar test. Section 1 records its own targeted baseline before dispatch.

Intake gap check, resolved from sources: `scrub` is exported by `plugins/claude-kit/hooks/kit-compact-lib.js` and `kit-size.js` requires it as `scrubLine` (section 1's References name both); `readFileBounded` is exported by `plugins/claude-kit/hooks/kit-read-lib.js` (Approach); the scratch-home pattern for section 2 is `test/branch-reaper-nudge.test.js`'s spread-environment spawn (section 1's References). No material gap.

Rulings since the last boundary: none.

Next: dispatch section 1 to implementer-opus with the Dispatch Brief.

### Interim board 2 - 2026-09-24

Written at the compaction gate's deferral signal after section 1's review round 1 was adjudicated and its fixes committed.

Section 1 stage: first-green commit 1638c2cb, review round 1 (adversarial, blind, security and performance at fable), fix round 1 committed 9d4d87a5. The round carried one Critical from the blind lens: a link at the marketplace or plugin level pointing back inside the cache made a whole plugin folder, installed version included, one stale candidate. It is fixed, with three link-shape tests that went red against 1638c2cb. Round 2 is owed at round 1's roster and tier, since round 1 carried a correctness Critical. The section is held at step 4 on the design stop below. Sections 2 and 3 not started.

Live dispatches: one consultant, asked whether section 1 should refuse `--delete` unless the cache root's real path ends in `plugins/cache`, and where the security model's mutating-CLI roster entry for the script belongs.

Gate baseline: the targeted lane (branch-reaper-nudge and size-ratchet tests) read tests 104, pass 104, fail 0, exit 0, 46 s, measured 2026-09-24T14:55Z on SCOTT-CLAUDE on the clean worktree at 1fc5f4b2, beside another session's model-test run in D:\agent_persona-peer. The section's own test file reads tests 20, pass 19, fail 0, skipped 1, exit 0 at 9d4d87a5, measured by this session 2026-09-24 on SCOTT-CLAUDE.

Rulings since the last boundary:
- Relevance ruling (scope adjudicator, fable) on the security lens's advisory Major that `--delete` under an unbounded `--root` widens the accepted `node <script>` review-guard miss to a recursive delete at any root: CONFIRM, grounded on docs/security-model.md's Threat model lines 17 (the operator's working trees as an asset) and 19 (a document or diff carrying an instruction as an attacker class).
- Design stop (scope adjudicator, fable) on the proposed root-shape bound: ASK, since no Goal sentence, Intent clause or acceptance bullet names a root shape and the finding reopens an accepted risk. The section holds at step 4 until the operator answers; the consult above runs first.
- Exit code 3 for a failed removal is kept and declared rather than removed; the Approach's three-value sentence is corrected at section close.
- Operator decision 2026-09-24 over the relay, unrelated to this plan: the kit doctor keeps reporting FAIL on a blank machine name. Recorded in project memory; the backlog item is retired as keep once pull request 114 merges.

Next: read the consult's ruling, then send the operator one decision ask on the bound, fold the answer into section 1, and run review round 2 at fable over the section's delta since 1fc5f4b2.

### Interim board 3 - 2026-09-24

Written when section 1's design stop went to the operator.

Section 1 stage: unchanged since interim board 2. Fix round 1 is at 9d4d87a5 and review round 2 is still owed. The section holds at step 4 on the design stop's ASK, which is now with the operator as a BLOCKED.

Live dispatches: none.

Rulings since the last boundary:
- Pre-BLOCKED consult (consultant, fable) on the root-shape bound. Recommendation: take the gate, so `--delete` refuses unless the cache root's real path ends in `plugins/cache`, and declare it as an assumption. Its grounds are the plan's own subject, not security. A root one level too deep shifts the walk into a live install's own subfolders, which then read stale and get deleted. The security Major does not reopen an accepted risk: the read-only reviewer guard already allows a strict reviewer an out-of-tree `rm -rf`, per docs/security-model.md lines 742 to 752 and docs/backlog.md line 509. So record that Major as "not a defect of this plan". The mutating-CLI roster sentence goes in section 3, and `docs/security-model.md` joins that section's Files in scope. This session re-ran the guard probe at d9bae437: `rm -rf D:/some/tree` and the sweep with `--root D:/x --delete` exit 0 under the security-reviewer class, and the control `rm -rf docs` exits 2.
- The design stop's ASK bucket still holds the section (executing-work step 4). So the consult's recommendation goes to the operator as the brief's recommendation, and is not adopted in their place.

Next: on the operator's answer, fold it into section 1 through a fix dispatch, then run review round 2 at fable (adversarial, blind, security, performance) over the section's delta since 1fc5f4b2.

### Interim board 4 - 2026-09-24

Written when the plan's premise was found false.

Section 1 stage: unchanged since interim board 3. The section still holds at step 4.

Live dispatches: none.

Rulings since the last boundary:
- The Goal's premise is false. Claude Code marks a replaced plugin version orphaned and deletes it in a background sweep about 14 days later, per https://code.claude.com/docs/en/plugins-reference. On SCOTT-CLAUDE, 59 of 64 cached version folders carry `.orphaned_at`, the oldest marks are 14 days old, and nothing older remains. So the cache is bounded at about two weeks of updates. The sweep would shorten that to 7 days, inside the harness's deliberate grace window for sessions that loaded an old version.
- The operator approved the `plugins/cache` guardrail on the condition that the harness leaves old folders forever. That condition does not hold, so the approval does not settle the plan.
- Asked the operator over the relay whether to abandon the plan (recommended), keep a read-only listing, or keep it as planned with the guardrail.

Next: on the operator's answer, either abandon and archive the plan and close its branch unmerged, or resume section 1 on the chosen scope.

### Chapter 1 - 2026-09-24

Completed: none. The plan is abandoned with no section closed.

Abandoned on the operator's word over the relay thread on 2026-09-24: "We can just abandon this plan and drop it." The Goal's premise was false. The Goal says Claude Code never deletes a replaced plugin version. It does: https://code.claude.com/docs/en/plugins-reference states that an updated or uninstalled plugin's previous version is marked orphaned and removed in a background sweep roughly 14 days later. The delay is a grace period for sessions that already loaded the old version. On SCOTT-CLAUDE, 59 of 64 cached version folders carried `.orphaned_at`, the oldest marks were 14 days old, and no folder older than that remained. So the cache is bounded at about two weeks of updates, about 1.1 GB on this machine. The sweep would only have shortened retention to seven days, inside the harness's own grace window.

What shipped: nothing merged. Section 1 reached fix round 1 on branch `plugin-cache-sweep`, final commit cfebb054, and that branch is deleted after this lands. It held `plugins/claude-kit/scripts/plugin-cache-sweep.js`, `test/plugin-cache-sweep.test.js` and a size-budget cap. None of it reached main, and nothing in main referenced it.

Decisions and surprises: review round 1 found a Critical, a link inside the cache that made a whole plugin folder one stale candidate. It was fixed on the branch. A design stop on a `plugins/cache` root guard for `--delete` went to the operator. Their reply asked whether the harness cleans the cache at all, which surfaced the false premise. No re-anchor or plan review had checked the harness's own cleanup, because both read the cache and the installed-plugins file but not Claude Code's plugin reference.

Next: none. The kit worker moves to `claude-kit_leash-takeover_spec_v1.md`, the next plan in the operator's order.

Commit Model: Branch-and-PR.
