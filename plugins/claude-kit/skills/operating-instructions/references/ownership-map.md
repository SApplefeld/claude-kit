# Ownership map

The rule this map serves is the doctrine's "One owner per moment, and the map names it" bullet (`skills/operating-instructions/SKILL.md` under the kit plugin root), which states it whole.

The doctrine's "Which text governs" section states the ranking this map serves. The map answers the one question the ranking leaves open: which skill owns the moment.

How to read a row: the moment is the situation a session is in; the owner is the document whose text is the rule there; the third column names the surfaces that point at the owner or carry a pinned copy, so a reader who met the rule somewhere else knows where the whole of it lives. "Doctrine" means the operating-instructions skill body and its mirror, which are one text. A hook, script or test named in the owner column is the mechanical enforcement of a rule the named prose owns.

How to amend: a row changes when ownership moves. The move lands in the same change as the prose that moves. A new skill adds its rows. A retired skill's rows leave with it. A moment found governed by two documents with no stated precedence goes under Unowned or contested below, never silently into one owner's column, because assigning an owner is the operator's ruling.

## Intake and design

| Moment | Owner | Points at it or copies it |
|---|---|---|
| A design conversation for a new feature or non-trivial change: scope check, the questions asked, the spec written | `brainstorming` | doctrine (The execution loop), README |
| A plan's `## Intent` record: its parts, the register it takes, its byte bound, who writes it and where a ruling made after the spec ships lands | `brainstorming` (step 9, and the freeze paragraph for a later ruling) | `curating-docs`, `executing-work`, `finishing-work`, `consult`, the `plan-reviewer`, `scope-adjudicator`, `consultant`, `adversarial-reviewer` and `security-reviewer` charters, `docs/architecture.md`, `docs/security-model.md` |
| Which model tier executes a section, and the tier bands | `brainstorming` | doctrine (Orchestrating fan-out work), `executing-work` (routing) |
| The scout sweep that derives a section's files in scope where a design changes a contract or a shared surface | `brainstorming` | `executing-work` |
| A spec read against its own Goal before it is armed, and the adjudication of what that read returns, the `[unrefusable-frame]` question on the plan's `## Intent` record among them | `brainstorming` (step 10, plan review) | the `plan-reviewer` charter |
| The Jev coverage check over a spec in the self-review: where it runs, what the author does with the ranking, the closing line the handoff recap records and its by-hand not-run form, and that no score reaches the blind reader or the plan reviewer | `brainstorming` (step 10, the coverage check) | `docs/architecture.md`'s restatement of step 10, `docs/security-model.md` for what the tool sends |
| A hard-to-reverse architecture fork pressure-tested by several lenses | `design-council` | `brainstorming` (offers it) |
| A verdict on a decision whose framing carries the operator's own preference | doctrine (Match my precision) | none |
| What a prompt, brief, spec, or handoff does not state, and how each gap is routed | doctrine (Enumerate the gaps at intake) | `executing-work`, `brainstorming` |
| A plan doc's name, format, `Status` lifecycle, the admissible `Commit Model` values, and the `docs/` taxonomy | `curating-docs` | doctrine (Keep `docs/` as a curated library), `brainstorming`, `executing-work`, `finishing-work`, `docs/plans/README.md` |
| Archiving a completed plan, pruning the backlog, refreshing indexes and cross-references | `curating-docs` | doctrine, `finishing-work`, `docs-curator` charter |

## Execution

| Moment | Owner | Points at it or copies it |
|---|---|---|
| The section loop: implement, verify, review, Chapter, and the completion contract that keeps it running | `executing-work` | doctrine (Close each section with a Chapter), `kit-goal` |
| The add-decision written before a section or a fix is built, and the design stop it fires where no Goal sentence, Intent clause or acceptance bullet names the mechanism that line proposes | `executing-work` (step 1's open and step 4) | doctrine (Write the minimum), the implementer charters, `finishing-work`, `consult`, `scope-adjudicator`, `docs/architecture.md` |
| A dispatch brief's fields, which are standing and which conditional, and the standing directives forwarded verbatim | `executing-work` | doctrine (Before you send), `docs/architecture.md` |
| Scouts: banding, the return contract, and what a scout may and may not do | `executing-work` | doctrine (Act on found work) |
| The review roster for a section: the four code lenses run in two tiers, the correctness tier and the advisory tier, the document pair an `Audience:` line summons, the reviewer-model rule and the effort table | `executing-work` (step 3 for the roster, step 4's advisory paragraph for how an advisory finding is weighed and dispositioned) | doctrine (Dispatch is requested standing), reviewer charters |
| The review-round backstop: the bound at which a section whose loop is still open stops on the BLOCKED path, the ladder a continue buys, and the classes that never freeze with it | `executing-work` (step 4's backstop paragraph, which owns both of the ladder's numbers) | doctrine (Pause only for a true blocker), `finishing-work`, `docs/architecture.md`, `test/review-loop-provenance.test.js` (the parity pin holding both numbers to one carrier) |
| Whether a fix delta owes a review round of its own: the sufficient triggers and the below-bar judgment under them | `executing-work` (step 4's fix-delta bar for the triggers, step 3's trivial-section clause for the below-bar judgment, which that bar defers to) | `finishing-work`, `docs/architecture.md` |
| What a Critical of the security lens must cite from a project's `## Threat model` section, and what citing it buys a finding | `executing-work` (step 4's advisory paragraph) | `security-reviewer` (carries the `threat:` field on every Critical), `scope-adjudicator` (the relevance ruling that confirms or refuses the citation), `docs/security-model.md` (copies the blocking rule whole under its own `## Threat model` heading), `README.md`, `docs/README.md`, `docs/architecture.md` (all three point) |
| The `## Threat model` section's own four required parts, and what the security lens does where a project has written none | `security-reviewer` (its threat-model and absent-model paragraphs) | `executing-work` (step 4's advisory paragraph reads `threat: absent` as a citation and points here for the shape), `docs/security-model.md` (carries the kit's own model in that shape) |
| A section's `Standing Brief Amendments` block and its re-read at every section open | `executing-work` | `docs/architecture.md` |
| Which surfaces a subagent may write, and that `docs/` is the curator's and the main session's alone | `executing-work` (routing), enforced by `hooks/docs-write-guard.js` | reviewer and implementer charters |
| Killing or replacing a dispatched agent for a reason other than a stall | `executing-work` | doctrine (No completion notification is not a stall signal) |
| Awaiting a background dispatch: the `WAITING:` turn end or the synchronous call | `executing-work` (the dispatch row, step 1's leash bullet) | doctrine (No completion notification is not a stall signal), `kit-goal` |
| A dispatched agent gone quiet: the probe, the wedge hallmark, the cadence, the wakes it is evaluated at, and the windows per dispatch shape | `finishing-work` (Unavailability is the gate failing to run at full strength) | doctrine (Probe a dispatched agent), `executing-work` |
| The chapter checkpoint that lets a leashed run compact at a section boundary | `executing-work` (step 8, opening the compaction checkpoint) | doctrine (Close each section with a Chapter), `kit-goal`, `hooks/kit-compact-gate.js` |
| A reasoning dead end or a decision the spec does not cover: the consult triggers and mechanics | `consult` | doctrine (Orchestration mechanics live in the skills), `executing-work`, `finishing-work` |
| Weighing a review finding or an operator correction before acting on it | `responding-to-review` | `executing-work` (its review step), `README.md` |
| Root-causing a failure before proposing a fix | `systematic-debugging` | doctrine (Root-cause from the real state) |
| Whether a change earns a test, what retires one already in the tree, the shape it takes, the cost it spawns, the lane mechanics, and the red protocol | `testing-discipline` | doctrine (Write tests independent by construction; Make the test earn its green; After each step, run the lane) |
| Which lane each gate moment takes and how the delta is reported against its baseline | doctrine (After each step, run the lane the moment calls for) | `testing-discipline`, `executing-work` |
| Starting a heavy process on a shared machine: the poll and the box budget | doctrine (One heavy process at a time is a per-machine budget) | `testing-discipline`, `executing-work` (brief clause) |
| Reading a large file to find one thing: the outline principle | doctrine (When you are hunting for something in a large file) | `csharp-style`, `sql-style` (the recipes) |
| C# and T-SQL house style, and the outline recipes for each | `csharp-style`, `sql-style` | doctrine (Defaults) |
| A document written in the operator's voice | `scott-writing-style` | `prose-reviewer` charter |

## Finishing

| Moment | Owner | Points at it or copies it |
|---|---|---|
| The whole-effort finishing pass: QA verification, the finishing reviews, the goal read, docs curation, memory close, drift routing, close-out | `finishing-work` | doctrine (Finish deliberately, then bank what you learned) |
| The pull request at finishing: opened where none is open for the branch, marked ready for review, auto-merge armed, and integration per commit model at the close | `finishing-work` | `executing-work` (points forward), `curating-docs` (the Commit Model row), `hooks/pr-docs-guard.js` (docs committed before the PR) |
| A record that lives only on a merged PR branch: the strand-check, and invoking the reap of the plan's own merged branch and clean worktree once it runs clean | `finishing-work` (the check at the close and the reap's invocation, with its three routes) and `branch-hygiene` (the check at session start and the reap's mechanics) | doctrine (Pushed is not merged) |
| Reaping merged branches, recovering stranded commits, what may be deleted without asking | `branch-hygiene` | `hooks/branch-reaper-nudge.js` |
| What the store recorded during the effort, the after-query, decay, and the applied-stamp ledger | `memory-system` | `finishing-work` (calls it), doctrine (The kit memory store has an extension layer) |

## Git acts

| Moment | Owner | Points at it or copies it |
|---|---|---|
| Whether this session may commit or push at all, and what form an authorization takes | doctrine (Name the rollback and stop for a yes; Which text governs) | `executing-work` (step 7, applying the commit model), `role` (delegation exclusions), the output style checklist |
| The admissible `Commit Model` header values and the parked state an unknown value produces | `curating-docs` | `executing-work`, `kit-goal` |
| Where in the section loop the commit and the push land under each commit model | `executing-work` | doctrine (Treat durable artifacts as the recovery mechanism), implementer charters |
| Staging on a checkout another session may commit to: stage only your files, read the staged list, hold the index window narrow | doctrine (Stay in scope; On a checkout another session may commit to) | `executing-work` (the whole-worktree prohibition, in its brief field), implementer charters (no commit, no stage) |
| The commit message's three layers and the `-F <file>` write | doctrine (A commit title is the index line; Write commit messages via `git commit -F`) | implementer charters |
| The memory store's own commits and pushes: the sync path, the allowlist, the lock | `memory-system` | `kit-doctor`, `coordinator`, `role` |
| Deleting a stranded branch once its commits are recovered: the one `git branch -D` licensed outside the merged set, on its two conditions | `branch-hygiene` (Hard rules) | `finishing-work` (the strand-check's recovery pointer) |

## Coordination and seats

| Moment | Owner | Points at it or copies it |
|---|---|---|
| Reading the roster, messaging a peer session, and acting on a message one sent: whose word it is, what it directs without the operator's confirmation, and which acts still go to the operator | `peer-sessions` | doctrine (Peer sessions are a coordination surface, not a record); `role` (the chain and the delegation exclusions); `coordinator` (the quoted relay of an operator decision); `kit-goal` (the chain handoff that arms a plan) |
| The standing of a `## Dispatch Authorization` section and the trace a citing session performs | `peer-sessions` (the trace) and `kit-goal` (the section's format) | `coordinator`, `executing-work` |
| A peer handing a leashed session work: by a plan artifact only, a traced grant or a chain handoff, never by the message alone | `peer-sessions` | `kit-goal` |
| Taking a seat with `/role`, the registry entry, the coordinator-directory contract | `role` | `peer-sessions`, `coordinator`, README |
| A warranted-channel message the harness delivers inside a tool result: whose word it is and when it is taken up | doctrine (A relay message delivered inside a tool result is my word deferred to the turn boundary) | `coordinator` (the closed list of warranted channels) |
| A standing operational grant: the rail, its on-switch record, its exclusions, and each grant's owning skill | `role` | doctrine (Which text governs), `coordinator` |
| The machine coordinator's runbook, the board, and every bar on what a board line may carry | `coordinator` | `role`, `peer-sessions`, `standing-watch` |
| A seat running git in the memory store: exactly as any other session on this machine may, with a read of the store's own history routed rather than performed | `coordinator` (the ledger section, on a seat running git in the store) | `role` (the standing-grant rail's exclusions), `memory-system` (the sync path) |
| A repeating watch over a live system: the tick order, the ledger, the wake prompt | `standing-watch` | `coordinator` (its named overrides) |
| Parking a session at its next safe point when the operator or a relayed drain window asks, with everything durable committed | `executing-work` (the `WAITING:` stop shape) | `coordinator` (the update window), `kit-goal`, `peer-sessions` |
| Arming a completion leash, the canonical condition, and the Stop hook that enforces it | `kit-goal` | `executing-work`, `peer-sessions`, `hooks/kit-goal-stop.js` |
| Dispatching this session's own subagents, and the standing request that covers it | doctrine (Dispatch is requested standing) | `executing-work`, `finishing-work`, `consult` (where and how, never wider) |

## Memory, self-improvement, and the kit's own prose

| Moment | Owner | Points at it or copies it |
|---|---|---|
| Recall, the outcome journal, applied stamps, tags, decay, the shared tiers, `memq`, and the four remedies for a record gone bad | `memory-system` | doctrine (The kit memory store has an extension layer; A recalled memory contradicted by evidence) |
| Project-tier memory frontmatter | `memory-system`, enforced by `hooks/memory-frontmatter-guard.js` | `finishing-work` |
| Capturing kit friction, the capture bar, the adjudication pass, how an accepted lesson lands (the owning passage rewritten with the lesson in mind, never appended to), briefs | `kaizen` | doctrine (When the kit itself creates friction, capture it), `coordinator`, `role`, `writing-skills` (What a sentence has to earn) |
| Validating and repairing the machine's kit install | `kit-doctor` | `memory-system`, README |
| Writing or amending a skill, a charter, the output style, or any curated prose the kit ships, and proving a wording change moves behavior (how an accepted lesson lands in that prose is `kaizen`'s, its row above) | `writing-skills` | doctrine (Match a document's length to its job), `kaizen`, `docs/architecture.md` |
| A file growing, and who moves its cap | `writing-skills` (The size budget is a ledger rather than a ceiling), enforced by `scripts/kit-size.js` and, at the repository root rather than the plugin root, `test/size-ratchet.test.js` | `docs/architecture.md` (the size-ratchet paragraph) |
| The prose register: every piece of prose a session writes, in three layers, with the decision ask, the close-out status and the board recap inside it | doctrine for the rule (Directness and register, where the sentence layer is the plain-prose bullet and the structure layer is the structure bullets after it; Craft and communication; Write every decision ask to the client-briefing register), and `prose-register` for the recipe, the scaling and the voice layer | the output style (a pinned copy of the register core), `prose-register` (points at the rule) |
| Pushback carrying no new fact, a bare "are you sure?": the one re-check of the evidence before the read is restated or downgraded | doctrine (Disagree up front) | none |
| Shell encoding, background-run markers, readiness waits, and the harness's isolation screen | doctrine (Environment and tooling discipline) | the active shell's tool description (the specifics) |

## Unowned or contested

A moment listed here has two documents speaking to it with no stated precedence, or none at all. A session that meets one declares the reading it takes under the intake gap check. It reports the gap in its close-out. It does not resolve the contest by editing either document, since the assignment is the operator's ruling. A row leaves this section when the ruling lands and the losing text is brought current.

| Moment | The surfaces in tension |
|---|---|
| A commit model that commits locally and never pushes | No such value exists; Review-Only forbids the commit as well as the push, so a session asked to commit without pushing has no header to stand on |
