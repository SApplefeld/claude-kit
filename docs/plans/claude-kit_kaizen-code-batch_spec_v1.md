# Kaizen code batch, 2026-09-02: ten instruments stop lying or start existing

Status: Ready
Commit Model: Commit-and-Push
Created: 2026-09-02

Session model: any executor session in the kit repo; ten sections, tiers per section, each independent of the others so they may run in any order or in parallel where the box allows. Authored by the KIT: Expert seat as the apply-now slate of the 2026-09-02 kaizen pass, restricted to code and tests; the prose slate is `claude-kit_kaizen-prose-batch_spec_v1.md`. Anchors are authoring-time; re-locate every hit by content.

## Dispatch Authorization

Authorized 2026-09-02 by the operator, first-hand on the allowlisted relay thread, to be appended to the kit worker's armed queue: the nine code-and-test sections of the 2026-09-02 kaizen pass's code slate as designed here, eighth in the queue. The operator's word was the answer to a decision batch the KIT: Expert seat put on the relay, choosing the recommended option of appending the pass's four code-and-design specs to the worker's queue in the order code batch, liveness, claim writer, provenance; that seat recorded it here and ran the append. Per the peer-sessions trace rule this section is a warrant only for a citing session that did not author it, and the receiving session performs its own trace: the grant is the operator's message on the Expert session's relay thread, and the plan arms only by the operator's word or the Expert seat's append under it.

## Goal

Ten inbox notes describe a code surface that either reports something false with confidence or lacks a check whose absence is silent. Each is small, each has a test that can be watched red first, and none touches behavior-shaping prose, so they ride together as one plan the worker can clear quickly. When this plan is done: the goal CLI's status render hides no queue row; an arm run from a directory the session does not work in is refused or loudly warned; the doctrine refresh hook cannot write an older payload's text over a newer one and the file it writes says who owns it; the session-start backlog scanner reads an item as the record it is; the judgment sidecar stops reading the harness's own cwd-reset footer as a failed command; the doctor grades a history-only hit on a lock-file path as the untrack-and-move-on it is and places its declined-prompt line under the check that asked; three pins exist that the docs and the payload have needed (markdown marker parity, the archive index chain, and line-ending-normalized prose pins); the docs-curator charter names the guard its output lands behind; and a Chapter whose `Completed:` line registers nothing is named at the stop that reads it.

## Evidence

Each section cites its note in `kaizen/notes-*.md` at the pass's capture commit and the code it read.

## Decisions

Decided 2026-09-02 by the Expert seat under standing adjudication; reversible at arming.

1. **One plan, ten independent sections.** Grouped for queue economy; nothing in one section is a precondition for another.
2. **Every section carries a red-first test.** A section whose test cannot be watched red against the pre-section code is not done, whatever the diff looks like.
3. **The sidecar's truncated-input direction is not in this plan.** That decision (tell the judge its input is partial) went to the operator on 2026-09-01 and waits on his word; section 5 touches only the footer class.

## Sections of Work

### 1. The goal status render hides no row. Model: sonnet

`plugins/claude-kit/hooks/kit-goal.js` collapses the queue render past five rows to a bare "and N more" (`:236`, `:490` at HEAD `d09d099`), which hides the paths a consumer's subtraction needs. Render every row, or keep the collapse and name every hidden path on the collapsed line; the first is the recommendation since a nine-row queue costs nine lines. Test: a seven-plan queue's status names all seven paths.

Acceptance: test green, watched red first; `node --test test/kit-goal*.test.js` green with delta named against a recorded baseline.

### 2. An arm reconciles its directory against the session's own. Model: opus

`kit-goal.js arm` resolves state from `process.cwd()` while the Stop hook and the compaction gate resolve from the harness payload's cwd, and nothing compares the two, so an arm from a worktree parent binds a session whose hooks then read a directory holding no state (`kaizen/notes-NEO-CLAUDE.md` 2026-08-28). The arm already corroborates the binding against the session's transcript under the harness projects directory (`kit-goal.js:109-131`), whose parent directory name is the flattened spelling of the session's own working directory. Compare the flattened spelling of the resolved goal root against that directory name; on a mismatch refuse the arm naming both directories, with a `--here` flag to override for the deliberate case. Apply the same comparison in `kit-compact-checkpoint.js boundary` and `open`, as a loud stderr warning rather than a refusal, since a marker written elsewhere is never read. Tests: an arm from a subdirectory of the session's project passes (the transcript names the project, and the goal root resolves to it); an arm from an unrelated directory refuses; `--here` overrides; the checkpoint verbs warn.

Acceptance: tests green, watched red first; `node --test test/kit-goal*.test.js test/kit-compact-checkpoint*.test.js` green with delta named.

### 3. The doctrine refresh is version-aware and the file names its owner. Model: opus

`plugins/claude-kit/hooks/doctrine-refresh.js` writes the installed skill body over `~/.claude/claude-kit-doctrine.md` on any difference, with no notion of which side is newer, so a long-lived session on a superseded plugin cache rewrites the file backward at each of its own start or compact events (`kaizen/notes-SCOTT-CLAUDE.md` 2026-08-30, measured as a two-minute reversion window). Write a stamp beside the file naming the payload that wrote it (the plugin cache directory's build identity, or its write time where no identity exists), overwrite only when the writer's own stamp is newer or equal, and emit one session-start line when a stale writer declines. Add one header line inside the written file naming the generating hook and the source of truth, so a hand edit meets the owner rather than an expropriation. Tests: a newer writer overwrites; an older writer declines and says so; the header survives a refresh; a hand-edited file with no stamp is overwritten once and stamped.

Acceptance: tests green, watched red first; the session-start line reaches context on the decline path; targeted lane green with delta named.

### 4. The backlog scanner reads items, not lines. Model: sonnet

`plugins/claude-kit/hooks/session-start.js` `summarizeBacklog` reads a date per line, so a wrapped item whose date sits on a continuation line counts as undated (two notes, 2026-08-30 and 2026-09-01, one measuring 47 undated where a per-item read gives 31). Read a bullet as its own line plus its continuation lines, take the first ISO token anywhere in the item, and state the predicate beside the figure ("undated by first ISO token per item"). Add to the `curating-docs` aging check one sentence: where the repository's first commit is younger than the threshold, no item can be past it and the pass collapses to that one reading. Tests: a wrapped dated item counts as dated; an item with no date anywhere counts as undated; the emitted line names the predicate.

Acceptance: tests green, watched red first; `node --test test/session-start*.test.js` green with delta named; the curating-docs sentence present with no em dashes.

### 5. The sidecar strips the harness footer before judging. Model: sonnet

The harness appends "Shell cwd was reset to <dir>" after any Bash call whose cwd moved, and the judge reads it as evidence the command failed to run where intended (three false alerts across two sessions on 2026-09-02, per `kaizen/notes-SCOTT-CLAUDE.md`). In `plugins/claude-kit/hooks/kit-sidecar-capture.js` `resultText` (`:468`), strip a trailing footer of that exact shape before the judged fields are built, counting it under neither the cap nor `truncated`. Test: a result carrying the footer judges the same text as one without it; a result whose body legitimately contains the phrase mid-text is not cut.

Acceptance: tests green, watched red first; `node --test test/kit-sidecar*.test.js` green with delta named.

### 6. The doctor grades a history hit by path class and places its declined-prompt line. Model: opus

`plugins/claude-kit/doctor/doctor.ps1` reports a since-excluded coordinator claim path in committed history with the same FAIL and the same rewrite-history-and-rotate remedy it uses for a credential (`:753-761`), so every machine that ever synced a claims file fails the doctor forever unless it rewrites the store (three notes, two machines). Grade a history-only hit on the coordinator claims path class as WARN with the remedy "untrack and move on", keeping FAIL for every other class, and have the remediation text state the mechanical fact separately from the unverified class hazard. Separately, the `-Fix` declined-prompt line prints under the memq shim heading after that check's FIXED text while the check that asked prints a bare FAIL (`:85`); route the line under the check that asked and have that FAIL say a prompt was declined. Tests in the doctor's Pester or script-test lane as the repo has them: a claims-path history hit grades WARN, a credential-path hit grades FAIL, and the declined line appears under the asking check.

Acceptance: tests green, watched red first; the doctor's own run over this checkout reads as before except the graded line; delta named.

### 7. Three pins the docs and payload have needed. Model: sonnet

(a) A marker-parity lint over the payload's markdown: per line, the count of `**` is even, skipping fenced code blocks and inline code spans, with the test's own documentation written marker-free. (b) An archive-chain pin: every file under `docs/archive/*.md` is named in both `docs/README.md` and `docs/plans/README.md` (the memory `archiving-a-plan-touches-two-indexes-not-three` names which two), watched red against a deliberately dropped name. (c) `test/doctrine-parity.test.js` `readRepoFile` (`:2626`) normalizes line endings before matching, and one sentence lands in `plugins/claude-kit/skills/testing-discipline/SKILL.md` stating that a pin over shipped prose normalizes line endings before matching, since an LF-authored anchor is red on every autocrlf checkout.

Acceptance: each pin green and watched red against a planted failure; the whole suite's delta against a recorded whole-gate baseline named, since (a) and (b) read files no targeted lane derives.

### 8. The docs-curator charter names the guard its output lands behind. Model: haiku

`plugins/claude-kit/agents/docs-curator.md` describes a deliverable under `docs/`, which `docs-write-guard` bars subagents from writing, and does not say so, so every dispatcher re-derives the constraint and a dispatch that forgets sends the agent to a mid-run denial (`kaizen/notes-SCOTT-CLAUDE.md` 2026-09-02, KIT: Worker). Add the constraint to the charter in one paragraph naming the guard and the sanctioned route the executing-work skill already gives (the curator returns its edits for the orchestrator to land, or is dispatched with the guard's sanctioned path). Self-surfacing gate: the existing charter parity test, if one reads this file, else a grep asserting the guard's name appears in the charter.

Acceptance: the paragraph present; the gate green; no em dashes.

### 9. A non-registering Chapter is loud at the moment it is written. Model: sonnet

A Chapter's first `Completed:` line registers a section only in two exact forms (project memory `chapter-completed-line-is-machine-read`), and a line that registers nothing leaves its section permanently open with no warning on any surface the writer watches (`kaizen/notes-NEO-CLAUDE.md` 2026-08-29; eight non-registering Chapters in one leashed run). In `kit-goal-stop.js`, at a stop under a leash, read the armed plan's newest Chapter; where it carries a `Completed:` line that registers no section of the plan's own list, ride one sentence on the stop's block reason (or on the allow, where the stop is otherwise allowed) naming the line and the two forms it takes. Never block on it. Test: a Chapter closing `Completed: Section 1 (title)` produces the sentence; `Completed: 1. title` does not.

Acceptance: tests green, watched red first; `node --test test/kit-goal*.test.js` green with delta named.

### 10. The stamp audit resolves the board where a seat does, and names an unscanned leg. Model: opus

`plugins/claude-kit/hooks/kit-registry-stamp.js audit` reads the board at the directory contract's literal `board.md` and, where nothing is there, reports the board absent (`kaizen/notes-NEO-CLAUDE.md` 2026-09-02, re-captured at `8229041`). A machine whose operator sited the board elsewhere by an operator-tier location record gets no board leg at all, and the summary's phrase is the same one the coordinator runbook's no-board rule makes a decision state, under which a seat stands itself down; two seats on that machine have already concluded no-board from the literal path and the audit is a third instrument producing the sentence from the same cause. Resolve the board through the same operator-tier location record a seat resolves it through, falling back to the contract path; where neither yields a file, report "no board at <path>, board leg not run" and count the leg as unscanned in the coverage line rather than folding it into a clean scan. Tests: a board at a relocated path recorded in a fixture operator tier is scanned; a missing board produces the unscanned wording and never the word absent; the contract path still works with no record.

Acceptance: tests green, watched red first; `node --test test/kit-registry-stamp*.test.js` green with delta named.

## Out of Scope

- Any change to behavior-shaping prose beyond the two single sentences sections 4 and 7 name; the prose slate is its own plan.
- The sidecar's partial-input prompt direction, pending with the operator.

## Related

- `claude-kit_kaizen-prose-batch_spec_v1.md`: the prose slate of the same pass.
- Kaizen triage record `kaizen/archive/2026-09-02-pass-triage.md`.
