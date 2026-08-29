# A parked plan gets a name, a stale session view gets a line, and the CLI stops misreading its own flags

Status: In Progress
Commit Model: Commit-and-Push
Created: 2026-08-27

Session model: Opus, in a clean session opened in the kit repo. The running order, recorded in each plan's header and in `docs/plans/README.md`: seat-infrastructure (1), memq-network-cwd-resolver (2), review-and-record-discipline (3), this plan (4), with testing-discipline complete and archived ahead of the whole queue. Its files are disjoint from every other slate plan's except `plugins/claude-kit/skills/executing-work/SKILL.md`, which Section 5 adds and which the seat-infrastructure and review-and-record plans edit first in queue order, so its sequencing constraints are the machine's one-suite-at-a-time budget and that ordering, with every quoted anchor re-read at implementation. Authored by the KIT: Expert seat from three kaizen notes (2026-08-26/27) plus one backlog fold. Anchors as of commit `6a928f7`; re-locate by content.

## Dispatch Authorization

Authorized 2026-08-27 by the operator: arming and execution of the four remaining queue plans by a worker session in this repository on this machine, in order: seat-infrastructure, then memq-network-cwd-resolver, then review-and-record-discipline, then plan-lifecycle-and-diagnostics, each plan honoring its own recorded start condition. This grant supersedes the same date's earlier grant, which placed a three-plan slate behind an armed testing-discipline and memq-network queue: the operator promoted seat-infrastructure ahead of memq-network-cwd-resolver, and the earlier queue's leash did not survive the session that held it, so memq-network-cwd-resolver now carries its own section rather than riding an armed goal. The grant was given at the keyboard of the KIT: Expert session in this repository and is mirrored on that session's account-allowlisted relay thread, which is the artifact holding the operator's words; it is recorded here by reference rather than quotation, per the public-repository convention. One grant covers the four plans, each carrying its own section pointing at it. This section was authored by the KIT: Expert seat on that keyboard instruction; per the peer-sessions trace rule it is a warrant only for a citing session that did not author it, and the receiving session performs its own trace of the grant before arming. That trace takes the form the peer-sessions rule states, provenance rather than credential: it reads this section's recorded claim, the commit that landed it, and the grant's scope against the action in front of it; the relay thread is the operator's own audit surface, not a surface the trace requires opening.

## Goal

Three diagnostics lie to their reader today, each in the direction that reads as healthy. A plan authored and deliberately parked has no `Status:` value of its own: `Draft` conflates it with mid-authoring and hides it from every recovery surface, which on another VM left two finished drafts unreadable as ready work (relayed, operator-nodded 2026-08-27). A session's plugin view freezes at session start, so a day-old session reports the machine's install stale when only its own view trails, a false machine-level claim that was a true session-level one (live instance 2026-08-26: an `arm --append` failing on a session-view CLI hours after the install advanced). And the goal CLI parses an unknown leading-dash token as a plan path, answering "plan not found: --append" when the real cause was an older CLI without the flag, a misdiagnosis every not-yet-updated session repeats on every future flag. A fourth, from the backlog: the SessionStart backlog block counts only what fits in its 64 KB head read and announces neither the bound nor the truncation, so both figures it hands a session can disagree with the file they summarize. And a fifth, operator-routed 2026-08-28 after a dispatched effort ran entirely unleashed with every surface silent: the leash's "nothing to enforce" state is byte-identical to its "never engaged" state on every surface that would notice, session start holds the in-progress plan list and the unarmed goal in one process without ever stating their conjunction, and the mid-run arming trigger names a spelling that refuses in the very state that most often precedes an arming. And a sixth, coordinator-routed 2026-08-28 from a worker reading its own plan worktree: the queue rendering's per-entry `[missing]` token reads only this working directory's `docs/plans/` by design while the position walk consults the archive in both trees, and the note that reconciles the two readings on one screen covers only one of the two directions a worktree can split from the main checkout, so a plan archived in the worktree alone prints a bare unexplained `[missing]` beneath a position that still counts it pending.

When this plan is done: `Ready` is a recognized plan status meaning authored-and-parked, surfaced distinctly at session start, ignored by the unarchived-Complete nag, and normalized to In Progress by the run that starts it; the kit-repo session start prints one line when the session's plugin view trails the install or the checkout; the goal CLI refuses an unknown leading-dash token with a usage error that names its own version; the backlog block either counts the whole file or says its count is bounded; session start says when In Progress plans sit beside no armed goal, naming the bare-form command; the arming trigger and the append refusal both name the bare form where it is the right spelling; the status widget's unarmed quiet is affirmative rather than blank; and the queue rendering's tree-split note covers both directions, the archived-here-unlanded shape included.

## Evidence

- The status classifier: `classifyPlanStatus` at `plugins/claude-kit/hooks/kit-goal-lib.js:1125-1138` recognizes `in progress` and `complete` and returns `unknown` for everything else; `session-start.js:521` consumes it for the recovery inventory; `stop-docs-hygiene.js` still carries its own spelling of the Status predicate (:55-:58) over `planHeadText` reads, the residual half of the backlog's three-spellings item (parked 2026-08-26), which this plan folds because adding a vocabulary value would otherwise widen three predicates in three files.
- The strict twin: `planReadsTerminal` (at :1183; the classifier's own header comment at :1106-:1124 discusses it) answers the frozen machine contract; `curating-docs/SKILL.md` owns that contract's table, and `docs/plans/README.md:10` states that five parsed shapes carry value rules an external engine enforces silently, so a new Status value is a contract change to version there, bounded by the fact that a Ready plan is by definition unarmed and pre-execution.
- The normalization precedent: `executing-work/SKILL.md` already directs a run to set a non-vocabulary Status to In Progress as part of starting, naming `Draft` as the common invention; Ready slots into that sentence as the recognized parked value rather than an invention.
- The stale-view instance (reported, 2026-08-26 note): the install advanced at 05:40Z per `installed_plugins.json`, a day-old executor's `arm --append` still failed hours later on its session-view CLI, and it reported the machine stale, the second firing in two days in opposite directions.
- The parse shape: `cmdArm` at `plugins/claude-kit/hooks/kit-goal.js:117` receives already-split `planArgs`; the argv dispatch (at :421 it filters only `--append`) passes everything else through as plan arguments, so an unknown `--flag` reaches `armGoal` as a path. The operator tier holds the pattern this joins (the charset-gate-must-bar-a-leading-dash record; `memq find leading-dash` locates it; evidence-only, not load-bearing for the implementation): refuse an unknown leading-dash token with a usage error naming the CLI's version.
- The backlog block: `summarizeBacklog` at `plugins/claude-kit/hooks/session-start.js:107`, whose fixed 65,536-byte head read is the recorded cause (backlog entry of 2026-08-26, measured: 52 of 77 items inside the window on a 103 KB file); this session's own start notice reported 49 items against a file whose bullet count differed, the live symptom.
- The plugin-view surfaces (confirmed shapes, exact spellings the implementer verifies): the session's plugin root path embeds the cache directory named by the installed commit (this session's is `...\claude-kit\8d2ecd1fce26\...`), `~/.claude/plugins/installed_plugins.json` records the machine's installed version, and the kit checkout's HEAD is one `git rev-parse` away when the cwd is the kit repo.

## Approach

- **Ready is a vocabulary addition, not a new mechanism.** The classifier gains the value; each consumer states what it does with it (session start lists a Ready plan as authored-and-parked with no resume directive; the unarchived-Complete nag ignores it; the leash and strict contract treat it as non-terminal exactly like unknown; executing-work's normalization sentence names it as the value a starting run flips). The three-spellings consolidation rides along because this is the moment the backlog item named: before the vocabulary widens, the predicate collapses to the library so it widens once. Red-first per consumer behavior, per that item's own condition.
- **The staleness line is kit-repo-scoped and one line.** Session start in the kit repo compares three readings (session plugin-view sha, installed sha, checkout HEAD) and prints one line when either trails, so the operator's update-and-restart ritual gets a trigger instead of a memory. Fail-open: any unreadable surface drops the line rather than guessing.
- **The CLI refusal names the version.** The misdiagnosis's sting was that the wrong cause pointed away from the real one (an old CLI); a usage error carrying the CLI's own version makes the next new flag self-diagnosing on every stale session.
- **The backlog count either reads whole or says it is bounded.** Cheapest honest form wins; the test fixture is deliberately larger than the window, since a fixture sized to today's file passes on either behavior.

## Standing Brief Amendments

1. Every quoted current-text phrase and line anchor in these sections is re-read from the file at implementation time; two slate plans land ahead of this one and the anchors above are authoring-time.

## Sections of Work

### 1. The goal CLI refuses unknown leading-dash tokens, naming its version

Model: sonnet

In `plugins/claude-kit/hooks/kit-goal.js`'s argument dispatch: a leading-dash token that is not a recognized flag exits with a usage error naming the token and the CLI's version, and never reaches `armGoal` as a plan argument. The version is the installed plugin's commit identifier as the running hook's own path spells it (the cache-directory sha, the same identifier Section 3's staleness line uses), read from the nearest surface the hook tree already reads; the implementer confirms which surface and names it in the Chapter. Known flags are untouched.

Tests, red first: `arm --bogus` today answers "plan not found"-shaped output; after, it exits non-zero with the usage error naming `--bogus` and the version, and a control run with a real plan path still arms. Extend the existing kit-goal test file's pattern.

Files in scope: `plugins/claude-kit/hooks/kit-goal.js`, `test/kit-goal-lib.test.js` or the CLI-level test file the existing arm tests live in (the implementer names it).

### 2. Ready joins the plan-status vocabulary, and the predicate collapses to one spelling

Model: opus

- `classifyPlanStatus` (`kit-goal-lib.js:1125`) recognizes `Ready` as its own value; `planReadsTerminal` continues to read it as non-terminal (prove by test, not assumption).
- `stop-docs-hygiene.js`'s own Status predicate collapses to the library's classifier (the backlog's three-spellings fold, red-first per behavior it decides: the unarchived-Complete listing and the plan-shaped-file check each pinned before and after the collapse).
- `session-start.js`'s recovery inventory lists a Ready plan on its own line as authored and parked, with no resume directive and no In Progress conflation; a Ready plan does not count toward the in-progress recovery block.
- The unarchived-Complete nag (session start `:634` and stop-docs-hygiene `:148`) ignores Ready.
- `executing-work/SKILL.md`'s normalization sentence names Ready as the recognized parked value a starting run sets to In Progress; `curating-docs/SKILL.md`'s machine-contract table versions the vocabulary addition, stating that Ready is a pre-arm value the external engine never meets on an armed plan.
- Where any plan in `docs/plans/` is authored-and-parked at this section's close, flip its header to Ready as live proof; where none is (the slate may all be running or done by then), the fixtures below are the whole proof and the Chapter says so.

Tests, split by what today's behavior actually is, because a red cannot be proven against behavior that already matches the target: red first where today is wrong (the classifier returns `unknown` for Ready; the session-start inventory omits a parked plan entirely, which is the recorded failure, so the red asserts the parked line and fails today), and a pin without a red where today already behaves as desired (the unarchived-Complete nags ignore Ready via `unknown` today and must keep ignoring it once Ready is recognized; the statusline position walk likewise), each pin named as a pin in the Chapter rather than claimed as a red.

Files in scope: `plugins/claude-kit/hooks/kit-goal-lib.js`, `plugins/claude-kit/hooks/stop-docs-hygiene.js`, `plugins/claude-kit/hooks/session-start.js`, `plugins/claude-kit/skills/executing-work/SKILL.md`, `plugins/claude-kit/skills/curating-docs/SKILL.md`, matching test files, plus the status header alone of any then-parked plan the live proof uses.

### 3. Session start says when this session's plugin view trails

Model: opus

In `session-start.js`, kit-repo sessions only (reusing whatever kit-repo detection the hook already carries; the implementer names it rather than inventing a second): read the session's own plugin-view version (the cache directory sha the running hook's path embeds), the machine's installed version (`installed_plugins.json`), and the checkout's HEAD; print one line when either comparison shows a lag, naming which side lags, so "restart the session" and "run claude plugin update" become triggered acts rather than remembered ones. Direction is defined per comparison, because shas are unordered and inequality alone has no direction. Session view versus install: the view is frozen at session start and only the install moves, so a difference means the session view is behind, stated as session-level ("this session's plugin view trails the install; restart to pick it up"). Install versus checkout HEAD: direction comes from ancestry, `git merge-base --is-ancestor <installed-sha> HEAD` meaning the install is behind the checkout ("the install trails this checkout; run claude plugin update"), the reverse ancestry meaning the checkout is behind the install (stated as such, no remedy prescribed), and neither ancestor, or an installed sha the checkout does not contain, stated as "differ, direction unknown". Fail-open on any unreadable surface or failing git read: no line, never a guess. The line states session-level versus machine-level explicitly, because the recorded failure was a true session-level fact reported as a false machine-level one.

Tests: fixture the three readings in each trailing combination plus the aligned case and each unreadable-surface case, on the session-start test pattern the suite already uses.

Files in scope: `plugins/claude-kit/hooks/session-start.js`, `test/session-start-*.test.js` (the implementer names the file, new or existing).

### 4. The backlog block stops counting a truncation as a total

Model: sonnet

`summarizeBacklog` (`session-start.js:107`) reads the whole file; the bound-stating fallback ("counted within the first 64 KB") is taken only if the whole read measurably regresses session start, which the implementer proves with a timing figure recorded in the Chapter before choosing it, not on a feel. Red first: a fixture backlog deliberately larger than the window shows today's silent undercount, then the honest behavior.

Files in scope: `plugins/claude-kit/hooks/session-start.js`, `test/session-start-backlog.test.js`.

### 5. An unleashed run reports itself, and the arming seam closes at both ends

Model: opus

Appended 2026-08-28, operator-routed for expert adjudication from two deliberately deduplicated arrivals of one incident report, the machine coordinator outside the incident and the ai-os worker inside it: a dispatched plan effort ran two sections, an implementer across multiple rounds, two whole gates, and two pushed commits entirely unleashed across four compactions, and no surface said so; the operator noticed only because the status widget was blank. Every mechanism claim below was re-verified on this repo's installed payload before appending. The trigger seam: executing-work's mid-run arming trigger names only the `arm --append` spelling (`executing-work/SKILL.md:65` at appending), which by design refuses on an empty queue, the state that most often precedes an arming, while the rescue sentence, that a first arming is always the bare form, lives at `kit-goal/SKILL.md:34`, a skill the triggered session has no reason to load. The silences: the Stop hook is a no-op with no goal armed, by design and stated in its own allow-order comment; `session-start.js` builds the in-progress inventory (`:493`) and the armed-goal notice that returns null when unarmed (`:273`) in one process and never states their conjunction; and the widget's blank covers a healthy unarmed state, a stale launcher payload, and an unleashed run alike. The refusal itself is honest and stays so: it exits 1 with reason "no goal is armed, so there is no queue to append to" (`kit-goal-lib.js:2023`), a reported exit-0 version having been measured dead with both controls speaking, so no exit-path repair ships; but the reason names only the problem, never the way forward. One fact is unrecovered and recorded as such rather than storied: whether the unleashed session attempted an arm and met the refusal, or never attempted one. The fixes close both paths, so nothing bets on the answer.

- The conjunction notice, the net for every cause: session-start, in any project, when at least one plan reads In Progress and no goal is armed there, prints one line naming the count, the fact, and the exact bare-form arming command. A Ready plan does not fire it, since parked-and-unarmed is Section 2's healthy state; fail-open per Section 3's discipline, any unreadable surface dropping the line rather than guessing. Red-first: an In Progress fixture beside no goal state shows the line; armed-goal, Ready-only, and no-plans fixtures stay silent as controls, each control named as a control.
- The seam, closed at both ends: executing-work's trigger sentence names both spellings with the discriminator in one clause, append extending an armed queue and the bare form being the first arming where none is armed, the amendment reviewed whole-file per the recorded skill-amendment defect mode; and the empty-queue refusal's reason gains the bare-form pointer, the point-of-use rescue that reaches even a session that loaded neither skill. Red-first on the refusal text; grep `test/` for pins over both edited sentences before editing.
- The widget's affirmative quiet: with a capable launcher payload and nothing armed, the widget renders an affirmative unarmed line rather than blank, and `kit-goal/SKILL.md:74`'s blank-state documentation follows, so blank narrows to the stale-payload and fault states, and the three-state reading is documented where the widget is.

Tests: per bullet; suite delta zero against this section's own baseline. Standing Amendment 1 binds hardest here: every anchor above is re-read at implementation, since two surfaces (`executing-work/SKILL.md`, `session-start.js`) are edited by earlier queue plans first.

Files in scope: `plugins/claude-kit/hooks/session-start.js`, `plugins/claude-kit/hooks/kit-goal-lib.js`, `plugins/claude-kit/skills/executing-work/SKILL.md`, `plugins/claude-kit/skills/kit-goal/SKILL.md`, the statusline widget's hook file (the implementer names it in the Chapter), matching `test/` files.

### 6. The queue rendering's tree-split note learns its second direction

Model: sonnet

Appended 2026-08-28, coordinator-routed for expert adjudication: a worker in a plan worktree read `goal status` and saw a plan it had archived in that same tree render `[missing]`, an observation whose obvious mechanism (the surface not searching the archive) the coordinator refuted at the installed library before routing. The adjudication, mechanism confirmed independently on this repo's source: the screen deliberately carries two readers, the position walk consulting `docs/plans/` and `docs/archive/` in both trees under an agreement vote (`queueEntryState`, `kit-goal-lib.js:1315`), and the per-entry token reading only `planPathState` of this working directory's plans path (`kit-goal.js:355`, with `:236-238` stating the design: missing "is what archiving a finished plan produces and what the leash advances on"). So `[missing]` beside an archived plan is designed, and the position correctly holds the entry pending until the main checkout the goal state lives in agrees. The gap is the explainer's coverage: the `wrongTree` note (`kit-goal.js:356-359`, text at `:388-393`) reconciles the two readings only in the present-in-main direction, so the mirror shape, a plan archived in the session's worktree while the main checkout answers gone at both paths, prints a bare `[missing]` on the current entry with nothing on screen saying why the queue does not advance. The worker's original readings are its tree's and stay reported; the mechanism and the note gap are confirmed at source and do not depend on which sub-shape it hit.

The fix: the current-entry check gains the mirror arm. When the current entry prints `[missing]`, the position counts it pending, and this tree's `docs/archive/` holds a copy whose header reads terminal while the main checkout answers gone at both paths, print a note naming the shape and the way forward: archived in this worktree only, land the archival in the main checkout for the queue to advance. Same fail-open discipline as the sibling note, and the same narrow trigger (asked only for the current entry, only when the split is live), so the healthy single-tree case pays nothing.

Tests, red first on the new note (worktree fixture: archived-terminal in the worktree, gone at both paths in main, note asserted and failing today), with the existing present-in-main note pinned as a control so the two directions cannot pass on each other's fixture, and a single-tree control staying silent.

Files in scope: `plugins/claude-kit/hooks/kit-goal.js`, the test file the existing status-rendering tests live in (the implementer names it).

## Out of Scope

- Any doctor-side reporting of the same staleness: the doctor already reports install state; this plan's surface is the session's own start.
- The external engine's parser: Ready is pre-arm by construction and the contract table documents it; no engine change ships here.
- The other two Status readers' deeper unification beyond the predicate collapse (the display-only readers keep their own decisions, per the backlog item's own design note).

## Related

- `docs/backlog.md`: the three-spellings item (parked 2026-08-26) and the 64 KB count item (2026-08-26), both folded here; the first retires on Section 2's landing, the second on Section 4's.
- `docs/plans/claude-kit_seat-infrastructure_spec_v1.md`: the plan whose parked state motivated the Ready value; Section 2 flips whichever plan is then parked as its live proof, this one where it still qualifies.
- `kaizen/notes-SCOTT-CLAUDE.md`, the three notes of 2026-08-26/27 (plugin-view staleness, leading-dash parse, Ready status): the origin, cleared into this spec at authoring.

## Chapters
