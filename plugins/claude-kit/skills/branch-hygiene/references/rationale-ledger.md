# Rationale ledger: branch-hygiene

This file is the rationale ledger for the documents the `branch-hygiene` skill owns. Rule text says what happens; this ledger says why; git says when. Nobody loads it by default. A session about to change a rule in one of the documents below reads the entry for the claim it is changing first, so the reason a rule holds is not re-litigated at the next review.

Each document sits under its own heading, which opens with its inventory line (what the document is for, which moments it owns, and when a session loads it) and then carries one entry per claim, retired claims included so the next audit does not re-find them. An entry is keyed by the claim's imperative sentence and carries its class (rule, mechanic, pointer, or rationale-example), its source as file and line, its provenance (the commit, incident, memory or kaizen note that installed it, or `no provenance found`), and its verdict (keep, rewrite, or retire) with the reason. A `C` entry's source line is read at the extraction commit `6bc07fb`; an `R` entry is a claim re-extracted from a hunk the Section 5 merge changed, and its source line is read at the merged commit `d9540ad`. Claim numbers restart under every document heading, and inside a document read in chunks they restart per chunk, so an entry id is unique only under its heading and a chunked document carries the chunk in the id (`c2.C001` is claim C001 of the second chunk); a claim named inside a reason or provenance line of such a document carries the same prefix. A `C` entry whose source hunk the Section 5 merge rewrote reads `retire` and carries a `superseded-by:` line naming the `R` entry that holds the passage at the merged commit; the passage's own verdict is that entry's, so a count of retirements over this ledger leaves those records out. A reason may name the form the judge ruled toward (a pointer at the owner, a split, a fold into a neighbour), because that form is why the verdict is rewrite rather than keep or retire; what a passage becomes is the rewrite plan's to decide, and where the two differ the rewrite plan governs. The target wording a judge proposed rides on the entry's `proposed:` line, one line per distinct proposal, on rewrite and retire entries that retire a passage; a proposal that pointed at another ruling by id carries the resolved text marked `(via Annn)`. A rewrite or retire the judge flagged as behavior-shaping carries `baseline-test: yes`, which is what the rewrite plan's RED and GREEN step keys on. What a passage becomes is the rewrite plan's to decide (`claude-kit_corpus-rewrite_spec_v1.md` under `docs/plans/`), and where it and a proposal differ the rewrite plan governs.

## plugins/claude-kit/skills/branch-hygiene/SKILL.md

This document is the kit's branch-hygiene procedure: it tells a session how to sweep local branches and worktrees left over after Branch-and-PR efforts, and how to recover branches whose commits never reached the trunk. It owns three moments: deciding which local branches and Claude Code worktrees may be auto-deleted (the safe set and the protected set), running the reap-and-report procedure itself, and recovering a stranded post-merge branch onto a fresh recovery branch with a new PR before any delete. It also owns the optional remote-side companion setting. A session loads it as a `named-trigger`: the frontmatter says to use it when cleaning up leftover branches or worktrees, or when the SessionStart nudge flags reapable or stranded branches, with triggers listed for branch cleanup, reaping or pruning merged branches, recovering stranded post-merge commits, and worktree cleanup.

Extracted at `6bc07fb`: whole document (`skills.branch-hygiene.SKILL.md`).

### C001
- key: Sweep only branches and worktrees whose work has already landed, and leave everything else untouched.
- class: rule
- source: plugins/claude-kit/skills/branch-hygiene/SKILL.md:8
- provenance: 971042a 2026-06-23, the branch-hygiene plan (docs/archive/claude-kit_branch-hygiene_spec_v1.md), whose root cause was that finishing-work's Branch-and-PR teardown never fires because the merge lands on the platform after the session ends.
- verdict: rewrite
- reason: The lead paragraph restates the safe set and the hard rules that follow; it compresses to one sentence pointing at them, and the why-they-pile-up sentence lives here: in a strict-PR shop the merge happens outside the session, so cleanup must be a later reaper keyed on the merge having happened.
- proposed: Compress line 8 to one lead sentence that names the sweep and points at The safe set and Hard rules for the conditions; drop the restated conditions from the lead.
- proposed: Move the why-they-pile-up sentence to the ledger and merge the remainder into A001's one-sentence lead.
- proposed: Folded into A001's lead sentence.
- baseline-test: yes

### C002
- key: Auto-remove only what you can verify is merged.
- class: rule
- source: plugins/claude-kit/skills/branch-hygiene/SKILL.md:8
- provenance: 971042a 2026-06-23, the branch-hygiene plan, Chapter 1's tightening of the auto-delete trigger to verified-merged membership only.
- verdict: retire
- reason: Duplicate of C006 (the safe-set condition) and C030 (the membership test); both owners carry the rule whole with the ref and the command, so the lead's copy adds nothing a session needs.
- proposed: Delete the "auto-removes only what it can verify is merged" clause from line 8; C006 and C030 carry it.
- proposed: (via A005) Delete the "auto-removes only what it can verify is merged" clause from line 8; C006 and C030 carry it.
- baseline-test: yes

### C003
- key: Never force-delete an unmerged branch or a dirty worktree.
- class: rule
- source: plugins/claude-kit/skills/branch-hygiene/SKILL.md:8
- provenance: 971042a 2026-06-23, the branch-hygiene plan, Chapter 1 and Chapter 3 (the `-d` and `worktree remove` refusal paths verified on a fixture).
- verdict: retire
- reason: Duplicate of C030 and C031, which name the commands the prohibition applies to and the report as the alternative; the lead's copy carries neither.
- proposed: Delete the "never force-deletes an unmerged branch or a dirty worktree" clause from line 8; C030 and C031 carry it.
- proposed: (via A007) Delete the "never force-deletes an unmerged branch or a dirty worktree" clause from line 8; C030 and C031 carry it.
- baseline-test: yes

### C004
- key: Recover stranded branches before sweeping anything else.
- class: rule
- source: plugins/claude-kit/skills/branch-hygiene/SKILL.md:10
- provenance: c800e05 2026-06-26, whose message does not narrate it; the diff adds the stranded intake paragraph and the recovery section as the after-the-fact net for the merge-strand-guard incident (post-merge doc commits on a branch whose remote was deleted), which the nudge hook detects.
- verdict: keep
- reason: The nudge invites a reap at session start and a stranded branch pruned in that reap loses commits the trunk never received; this ordering is what keeps the sweep from running first. It orders recovery against the sweep, where C022 orders it against the single delete, so the two are not one rule twice.

### C005
- key: Treat stranded branches as a data-loss risk, so give them priority over reapable ones.
- class: rationale-example
- source: plugins/claude-kit/skills/branch-hygiene/SKILL.md:10
- provenance: c800e05 2026-06-26, with the merge-strand-guard plan (docs/archive/claude-kit_merge-strand-guard_spec_v1.md) as the incident: records written after a fast merge stranded off the integration branch with no signal.
- verdict: retire
- reason: The priority rule (C004) is obeyable without the data-loss clause, which is its why: a stranded branch holds commits nowhere else, so deleting it is the one unrecoverable act in this skill, and that is why recovery precedes any sweep.
- proposed: Drop "are a data-loss risk and" from line 10, leaving the priority rule and its ordering; the reason lives in this ledger.
- baseline-test: yes

### C006
- key: Auto-reap a local branch only if it is verified merged into the integration branch.
- class: rule
- source: plugins/claude-kit/skills/branch-hygiene/SKILL.md:14
- provenance: 971042a 2026-06-23, the branch-hygiene plan, Chapter 1: the spec's "upstream gone OR ancestor" trigger was tightened at build to verified-merged only, since a gone-but-unmerged branch may be squash-merged elsewhere or abandoned.
- verdict: rewrite
- reason: The rule stays; the paragraph splits one mechanic per sentence and its parenthetical moves here: `git branch --merged` is reliable because the kit's repos use regular merges, under which a landed branch's tip is an ancestor of the integration ref; a squash-merge repo would defeat it, which the merge-strand-guard plan lists as out of scope.
- proposed: Split line 14 into one sentence per condition (branch, integration ref, worktree) and move the regular-merges parenthetical to the ledger.
- baseline-test: yes

### C007
- key: Take the integration branch as `origin/develop` if it exists, else `origin/main`, else `origin/master`.
- class: mechanic
- source: plugins/claude-kit/skills/branch-hygiene/SKILL.md:14
- provenance: 971042a 2026-06-23, the branch-hygiene plan, Approach paragraph 3: in NEO a feature branch lands via PR into `develop` and `develop` reaches `main` later behind a full test run, so `develop` is the integration target where it exists.
- verdict: keep
- reason: The fallback order encodes a real repo topology (develop ahead of main) and the nudge hook resolves the same order; the safe set owns the definition and step 2 points at it after the rewrite.

### C008
- key: Reap a worktree only if it lives under `.claude/worktrees/`, sits on a reapable branch, and has a clean working tree.
- class: mechanic
- source: plugins/claude-kit/skills/branch-hygiene/SKILL.md:14
- provenance: 971042a 2026-06-23, the branch-hygiene plan: `.claude/worktrees/` is Claude Code's own convention observed in the NEO session, and worktrees elsewhere may be the operator's own.
- verdict: keep
- reason: The path bound keeps the reaper off hand-made worktrees and the clean bound keeps it off uncommitted work; the safe set owns these conditions and step 4 keeps only the commands after the rewrite.

### C009
- key: Never touch `develop`, `main`, `master`, the current branch, or the repo's default branch.
- class: rule
- source: plugins/claude-kit/skills/branch-hygiene/SKILL.md:16
- provenance: 971042a 2026-06-23, the branch-hygiene plan, Approach and Section 1 (the protected set by name).
- verdict: rewrite
- reason: This list and Hard rule 3 each name a member the other omits (the default branch here, a worktree outside `.claude/worktrees/` there); this line becomes the one whole protected list and Hard rule 3 points at it, so a session reading either surface sees every member.
- proposed: The safe set's protected line (C009) gains the outside-worktree member; Hard rule 3 (C032) becomes a pointer at that line.
- proposed: (via A017) The safe set's protected line (C009) gains the outside-worktree member; Hard rule 3 (C032) becomes a pointer at that line.
- baseline-test: yes

### C010
- key: Run `git fetch --prune` first so the integration ref and remote-tracking refs are current.
- class: mechanic
- source: plugins/claude-kit/skills/branch-hygiene/SKILL.md:20
- provenance: 971042a 2026-06-23, the branch-hygiene plan, Chapter 4: a no-fetch pass stayed silent because the local `origin/develop` was stale while the merge had landed on the platform.
- verdict: keep
- reason: No finding. The merged set is only as true as the last fetch, and the recorded incident is exactly a stale ref hiding a landed merge.

### C011
- key: Stop and report, deleting nothing, if the fetch fails or no integration ref resolves.
- class: rule
- source: plugins/claude-kit/skills/branch-hygiene/SKILL.md:20
- provenance: 971042a 2026-06-23, the branch-hygiene plan, Section 1 acceptance ("a non-repo or git failure is reported, not fatal") and Chapter 4's stale-ref incident.
- verdict: keep
- reason: A blast-radius gate: with stale or absent merge state the sweep cannot tell merged from unmerged, and the delete it would run is unrecoverable for an unmerged branch. No hook enforces it; the nudge hook fails open and never deletes.

### C012
- key: Resolve the integration ref as the first of `origin/develop`, `origin/main`, `origin/master` that exists.
- class: mechanic
- source: plugins/claude-kit/skills/branch-hygiene/SKILL.md:21
- provenance: 971042a 2026-06-23, the branch-hygiene plan, installed with C007 in the same commit.
- verdict: rewrite
- reason: Step 2 restates C007's list with no command of its own; it becomes a pointer at the safe set's definition, which is safe because the list survives whole in C007 and the nudge hook.

### C013
- key: Compute the merged set with `git branch --merged <integration-ref>`, then drop the protected names and the current branch's `*` line.
- class: mechanic
- source: plugins/claude-kit/skills/branch-hygiene/SKILL.md:22
- provenance: 971042a 2026-06-23, the branch-hygiene plan, Chapter 1 (the merged set as the only trigger) and Chapter 3 (the set verified to drop `develop` and `main` on a fixture).
- verdict: keep
- reason: No finding. This is the mechanical test the whole safe set rests on, and the nudge hook computes the same set (`branch --merged <integ>`).

### C014
- key: Record each merged branch's tip SHA with `git rev-parse <name>` before removing anything.
- class: mechanic
- source: plugins/claude-kit/skills/branch-hygiene/SKILL.md:23
- provenance: 971042a 2026-06-23, the branch-hygiene plan, Approach: every removal reports its restore command because the commits are already on the integration branch.
- verdict: keep
- reason: No finding. The SHA is what makes `git branch -D` recoverable and is the rollback line the doctrine's stop rule asks for; after the rewrite this step and C018 are the only statements of it.

### C015
- key: Remove a merged branch's worktree with `git worktree remove <path>` and no `--force`.
- class: mechanic
- source: plugins/claude-kit/skills/branch-hygiene/SKILL.md:23
- provenance: 971042a 2026-06-23, the branch-hygiene plan, Chapter 3 and Chapter 4 (the operator chose to auto-remove worktrees too; dirty ones are skipped and git refuses them without `--force`).
- verdict: rewrite
- reason: The command and the `status --porcelain` test stay; the restated location and branch conditions leave, since the safe set (C008) owns them. Without `--force` git itself refuses a dirty tree, which is the safety this step rests on.

### C016
- key: Delete the branch with `git branch -D <name>` after the worktree step.
- class: mechanic
- source: plugins/claude-kit/skills/branch-hygiene/SKILL.md:23
- provenance: 971042a 2026-06-23, the branch-hygiene plan, Chapter 1: `-D` is safe only because the trigger was tightened to verified-merged membership.
- verdict: keep
- reason: The doctrine's stop-for-a-yes does not bar this delete: the ownership map assigns what may be deleted without asking to this skill, the operator's Chapter 4 ruling licensed the auto-reap, the SHA from step 4 is the rollback, and test/probes/merged-plan-branch-delete-on-an-armed-run.md resolves the moment to delete without asking. The `-D` (not `-d`) is deliberate: the worktree removal has already happened and the merged check was done in step 3.

### C017
- key: Report in two parts: what was reaped, and what was left for the operator with the reason.
- class: mechanic
- source: plugins/claude-kit/skills/branch-hygiene/SKILL.md:24
- provenance: 971042a 2026-06-23, the branch-hygiene plan, Goal ("reporting what it removed with an undo and listing anything unmerged or dirty for Scott to decide").
- verdict: keep
- reason: The two-part report is the blast-radius gate's shape: the left-for-you half hands every non-verified delete to the operator, and no hook produces this report.

### C018
- key: In the Reaped part, list each branch and worktree removed with `restore: git branch <name> <sha>`.
- class: mechanic
- source: plugins/claude-kit/skills/branch-hygiene/SKILL.md:25
- provenance: 971042a 2026-06-23, the branch-hygiene plan, Approach (`git branch <name> <sha>` brings a reaped branch back).
- verdict: keep
- reason: This is the report's owner of the restore line; Hard rule 4 (C033) retires as its third statement. The why, kept here: a reaped branch's commits are already on the integration branch, so recreating the ref at the recorded SHA restores it fully.

### C019
- key: In the Left-for-you part, list with reasons any branch whose upstream is gone but is unmerged, any likely-stranded branch ahead of the integration ref whose PR merged, any unmerged branch, any dirty worktree, and any reapable-looking worktree outside `.claude/worktrees/`.
- class: mechanic
- source: plugins/claude-kit/skills/branch-hygiene/SKILL.md:26
- provenance: 971042a 2026-06-23 installed the list (Chapter 1's demotion of "upstream gone" to report-only); 9b562c0 2026-06-23 added the stranded case per the merge-strand-guard plan Section 2.
- verdict: keep
- reason: Each category is a class whose delete could lose commits (squash-merged elsewhere, abandoned, stranded, dirty, or the operator's own worktree), so each is reported and held; the gate is blast-radius and stays.

### C020
- key: List the left-for-you items and do not delete them.
- class: rule
- source: plugins/claude-kit/skills/branch-hygiene/SKILL.md:26
- provenance: 971042a 2026-06-23, the branch-hygiene plan, Chapter 1 and Out of Scope ("Reaping unmerged or abandoned branches automatically... may hold unsalvaged work").
- verdict: keep
- reason: A blast-radius gate on an unrecoverable delete; it governs the report while C030 governs the delete license, so the two are not one rule twice.

### C021
- key: Show a suspected stranded branch's commits with `git log origin/<integration>..origin/<branch>` and recover them via a new doc PR before deleting.
- class: mechanic
- source: plugins/claude-kit/skills/branch-hygiene/SKILL.md:26
- provenance: 9b562c0 2026-06-23, the merge-strand-guard plan Section 2 (flag an ahead-and-merged branch as a likely strand), written when the stranded remote branch still existed; c800e05 2026-06-26 then defined stranded at intake as remote-gone and added the recovery section.
- verdict: rewrite
- reason: The bullet's `origin/<branch>` form does not resolve for a branch whose remote is gone, which is the case the intake paragraph and the nudge hook define; the recovery section's `<integration-ref>..<branch>` form works either way, so the bullet keeps its detection condition and points at that section for the command and the route.
- proposed: Replace the parenthetical's command and abbreviated route on line 26 with a pointer at the recovery section, keeping "ahead of the integration ref and whose PR has already merged" as the detection condition.
- proposed: (via A029) Replace the parenthetical's command and abbreviated route on line 26 with a pointer at the recovery section, keeping "ahead of the integration ref and whose PR has already merged" as the detection condition.
- baseline-test: yes

### C022
- key: Recover a stranded branch's commits before deleting it.
- class: rule
- source: plugins/claude-kit/skills/branch-hygiene/SKILL.md:30
- provenance: c800e05 2026-06-26 (the diff, not the message), as the manual recovery the merge-strand-guard plan left out of scope ("Auto-recovering stranded commits... Scott releases it").
- verdict: keep
- reason: Branch-hygiene owns recovering stranded commits per the ownership map; the lead-in is three words and the executable condition is step 5, so there is nothing to compress. The delete of a stranded branch is the one act in this skill that destroys commits held nowhere else.

### C023
- key: Confirm the stranded commits with `git log --oneline <integration-ref>..<branch>`.
- class: mechanic
- source: plugins/claude-kit/skills/branch-hygiene/SKILL.md:32
- provenance: c800e05 2026-06-26; the nudge hook (plugins/claude-kit/hooks/branch-reaper-nudge.js line 151) names the same command.
- verdict: keep
- reason: The local-pair form is the one that works whether or not the remote branch survives, which is why the report bullet (C021) now points here rather than carrying its own.

### C024
- key: Branch fresh from the current integration ref with `git switch <integration-ref> && git switch -c <branch>-recover`, or cherry-pick onto a new branch off it.
- class: mechanic
- source: plugins/claude-kit/skills/branch-hygiene/SKILL.md:33
- provenance: c800e05 2026-06-26, applying the merge-strand-guard freeze rule (never reopen the merged branch) to recovery.
- verdict: keep
- reason: No finding. The phrase "Branch fresh from the current integration ref" is an INTEGRATION_EXEMPT anchor in test/doctrine-parity.test.js, whose note records an open backlog decision on the recovery path's gate; a rewording must move the anchor.

### C025
- key: Never reuse the merged branch, which is frozen.
- class: rule
- source: plugins/claude-kit/skills/branch-hygiene/SKILL.md:33
- provenance: c800e05 2026-06-26, restating the freeze rule the merge-strand-guard plan (9b562c0 2026-06-23, Section 1) installed in the doctrine and finishing-work: after a fast merge every later push to the branch strands with no signal.
- verdict: keep
- reason: The whole rule lives in the doctrine and finishing-work; this eight-word warning is the pointer-sized form a non-owner keeps, and step 2 is not safely executable without it. The push guard (plugins/claude-kit/hooks/merged-pr-push-guard.js) blocks the push but not the `git switch` back, so the prose still has work to do.

### C026
- key: Bring the commits over with `git cherry-pick <sha>...` per commit, or `git cherry-pick <integration-ref>..<branch>` for the range.
- class: mechanic
- source: plugins/claude-kit/skills/branch-hygiene/SKILL.md:34
- provenance: c800e05 2026-06-26.
- verdict: keep
- reason: No finding. "Bring the commits over" is a parity-test anchor (test/doctrine-parity.test.js INTEGRATION_EXEMPT); the cherry-pick produces new SHAs, which is why the original never enters the merged set afterward and why the contested delete row exists.

### C027
- key: Push the recovery branch and open a new PR against the integration branch.
- class: mechanic
- source: plugins/claude-kit/skills/branch-hygiene/SKILL.md:35
- provenance: c800e05 2026-06-26, applying the merge-strand-guard route (a separate doc PR against the current integration branch, the agent authors and the operator releases).
- verdict: keep
- reason: Branch-hygiene owns the recovery procedure; the push guard blocks the wrong push but performs none of this step, so no machinery supersedes it. "Push the recovery branch" is a parity-test anchor.

### C028
- key: Expect the push guard to allow the recovery branch push, because it has no merged PR, where re-pushing to the original would have been blocked.
- class: rationale-example
- source: plugins/claude-kit/skills/branch-hygiene/SKILL.md:35
- provenance: c800e05 2026-06-26, describing plugins/claude-kit/hooks/merged-pr-push-guard.js (installed 9b562c0 2026-06-23, merge-strand-guard Section 3).
- verdict: retire
- reason: Step 4 is complete without it and C025 already keeps a session off the blocked push. The fact, kept here: the guard denies a push only when the host CLI positively reports a MERGED PR for the target branch and fails open otherwise, so a fresh recovery branch always passes.
- proposed: Drop the push-guard sentence from line 35, keeping "Push the recovery branch and open a new PR against the integration branch." verbatim (a parity-test anchor); the guard's behavior lives in the ledger.
- baseline-test: yes

### C029
- key: Delete the stranded original only once its commits are safely on the recovery branch, ideally merged.
- class: rule
- source: plugins/claude-kit/skills/branch-hygiene/SKILL.md:36
- provenance: c800e05 2026-06-26.
- verdict: keep
- reason: The condition is the only thing between recovery and an unrecoverable delete. This step and Hard rule 1 are the two sides of the ownership map's contested row (the original is never in the merged set after a cherry-pick, so step 5 licenses a `-D` Hard rule 1 forbids); the operator rules that row, and no rewrite should settle it by editing either side.

### C030
- key: Auto-delete a branch only on membership in `git branch --merged <integration-ref>`, and never `git branch -D` one outside that set.
- class: rule
- source: plugins/claude-kit/skills/branch-hygiene/SKILL.md:40
- provenance: 971042a 2026-06-23, the branch-hygiene plan, Chapter 1: the spec's upstream-gone trigger was demoted to report-only at build because a gone-but-unmerged branch may be squash-merged elsewhere or abandoned.
- verdict: keep
- reason: All three sentences record that decision and no hook enforces it (the nudge hook never deletes). The second sentence is one side of the contested "Deleting a stranded branch once its commits are recovered" row in the ownership map, so it is kept unchanged until the operator rules the row.

### C031
- key: Never run `git worktree remove --force`; report a dirty worktree instead of removing it.
- class: rule
- source: plugins/claude-kit/skills/branch-hygiene/SKILL.md:41
- provenance: 971042a 2026-06-23, the branch-hygiene plan, Chapter 3 (dirty `git worktree remove` refused on the fixture).
- verdict: keep
- reason: Owner of the worktree half of the force-delete prohibition (C003 retires into it). Git refuses a dirty tree without `--force`, so this rule is what keeps a session from reaching for the flag that defeats that refusal.

### C032
- key: Never touch `develop`, `main`, `master`, the current branch, or a worktree outside `.claude/worktrees/`.
- class: rule
- source: plugins/claude-kit/skills/branch-hygiene/SKILL.md:42
- provenance: 971042a 2026-06-23, the branch-hygiene plan.
- verdict: rewrite
- reason: It omits the default branch that C009 names and adds the outside-worktree member C009 omits; C009 becomes the whole list and this line points at it, so no member is lost and each surface shows all of them.

### C033
- key: Always print the restore SHA for every removal.
- class: rule
- source: plugins/claude-kit/skills/branch-hygiene/SKILL.md:43
- provenance: 971042a 2026-06-23, the branch-hygiene plan, Approach.
- verdict: retire
- reason: The third in-document statement of the restore line, after step 4 (C014, record the SHA) and step 5 (C018, the report format), and the doctrine's rollback line is its general form. The why moves here: a reaped branch's commits are already on the integration branch, so every removal is recoverable by recreating the ref at the recorded SHA.
- proposed: (via A023) Delete Hard rule 4 (line 43); C014 and C018 carry the restore SHA, and the recoverability reason lives in the ledger.
- baseline-test: yes

### C034
- key: Enable "auto-delete head branch on merge" in the repo settings to keep the remote side tidy.
- class: rule
- source: plugins/claude-kit/skills/branch-hygiene/SKILL.md:47
- provenance: 971042a 2026-06-23, the branch-hygiene plan, Approach paragraph 3 and Out of Scope ("a one-time repo-settings change Scott makes").
- verdict: rewrite
- reason: The sentence addresses the operator, not the session, and the doctrine's stop on writes to shared state is therefore not in tension with it; the passage does not say so, and a session holding a host CLI could read the imperative as its own act, so the rewrite names the addressee.
- proposed: Reword line 47 so the setting is named as the operator's one-time repo-settings choice, not an act the session performs.
- baseline-test: yes

### C035
- key: Treat deleting the stranded original as safe once its commits are on the recovery branch, because the delete cannot strand anything.
- class: rationale-example
- source: plugins/claude-kit/skills/branch-hygiene/SKILL.md:36
- provenance: c800e05 2026-06-26.
- verdict: keep
- reason: This sentence is the licensing side of the ownership map's contested row against Hard rule 1 (C030); moving it to the ledger would settle the contest by omission, and the map reserves the ruling for the operator. It stays as written until that row is ruled, and the rewrite plan should carry the row to the operator as a decision ask.
