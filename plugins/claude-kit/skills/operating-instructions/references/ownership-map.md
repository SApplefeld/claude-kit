# Ownership Map

This map serves the doctrine's "One owner per moment, and the map names it" bullet (`skills/operating-instructions/SKILL.md` under the kit plugin root), which states the rule whole.

The doctrine's "Which Text Governs" section states the ranking. The map answers the one question it leaves open: which skill owns the moment.

Reading a row: the moment is the situation a session is in, and the owner is the document whose text is the rule there. The third column names surfaces that point at the owner or carry a pinned copy. "Doctrine" means the operating-instructions skill body and its mirror, one text. A hook, script or test in the owner column enforces a rule the named prose owns.

Amending: a row changes when ownership moves. The move lands in the same change as the prose that moves. A new skill adds its rows. A retired skill's rows leave with it. A moment two documents govern with no stated precedence goes under Unowned or contested, never silently into one owner's column, because assigning an owner is the operator's ruling.

## Intake and Design

| Moment | Owner | Points at it or copies it |
|---|---|---|
| Designing a feature or non-trivial change: scope check, questions, spec | `brainstorming` | doctrine (Execution Loop), README |
| A plan's `## Intent` record: parts, register, byte bound, author, and where a ruling after the spec ships lands | `brainstorming` (step 9, and the freeze paragraph for a later ruling) | `curating-docs`, `executing-work`, `finishing-work`, `consult`, the `plan-reviewer`, `scope-adjudicator`, `consultant`, `adversarial-reviewer` and `security-reviewer` charters, `docs/architecture.md`, `docs/security-model.md` |
| A section's model tier, and the tier bands | `brainstorming` | doctrine (Orchestrating Fan-Out Work), `executing-work` (routing) |
| The scout sweep deriving a section's files in scope when a design changes a contract or shared surface | `brainstorming` | `executing-work` |
| Reading a spec against its Goal before arming, and adjudicating the result, the `[unrefusable-frame]` question on the `## Intent` record included | `brainstorming` (step 10, plan review) | the `plan-reviewer` charter |
| The Jev coverage check in self-review: where it runs, the author's use of the ranking, the recap's closing line and its by-hand not-run form, and no score reaching the blind reader or plan reviewer | `brainstorming` (step 10, the coverage check) | `docs/architecture.md`'s restatement of step 10, `docs/security-model.md` for what the tool sends |
| A hard-to-reverse architecture fork tested by several lenses | `design-council` | `brainstorming` (offers it) |
| A verdict on a decision framed with the operator's own preference | doctrine (Match my precision) | none |
| What an intake does not state, and how each gap is routed | doctrine (Enumerate the gaps at intake) | `executing-work`, `brainstorming` |
| A plan doc's name, format, `Status` lifecycle and admissible `Commit Model` values, and the `docs/` taxonomy | `curating-docs` | doctrine (Keep `docs/` as a curated library), `brainstorming`, `executing-work`, `finishing-work`, `docs/plans/README.md` |
| Archiving a plan, pruning the backlog, refreshing indexes and cross-references | `curating-docs` | doctrine, `finishing-work`, `docs-curator` charter |

## Execution

| Moment | Owner | Points at it or copies it |
|---|---|---|
| The section loop (implement, verify, review, Chapter) and its completion contract | `executing-work` | doctrine (Close each section with a Chapter), `kit-goal` |
| The add-decision written before building, and the design stop it fires when no Goal sentence, Intent clause or acceptance bullet names its mechanism | `executing-work` (step 1's open and step 4) | doctrine (Write the minimum), the implementer charters, `finishing-work`, `consult`, `scope-adjudicator`, `docs/architecture.md` |
| A dispatch brief's standing and conditional fields, and the directives forwarded verbatim | `executing-work` | doctrine (Before You Send), `docs/architecture.md` |
| Scouts: banding, return contract, and limits | `executing-work` | doctrine (Act on found work) |
| A section's review roster: four code lenses in correctness and advisory tiers, the `Audience:` document pair, the reviewer-model rule, the effort table | `executing-work` (step 3 for the roster, step 4's advisory paragraph for how an advisory finding is weighed and dispositioned) | doctrine (Dispatch is requested standing), reviewer charters |
| The review-round backstop: the bound where an open loop stops BLOCKED, the ladder a continue buys, and the classes that never freeze | `executing-work` (step 4's backstop paragraph, which owns both of the ladder's numbers) | doctrine (Pause only for a true blocker), `finishing-work`, `docs/architecture.md`, `test/review-loop-provenance.test.js` (the parity pin holding both numbers to one carrier) |
| Whether a fix delta owes its own review round: the triggers and the below-bar judgment | `executing-work` (step 4's fix-delta bar for the triggers, step 3's trivial-section clause for the below-bar judgment, which that bar defers to) | `finishing-work`, `docs/architecture.md` |
| What a security Critical must cite from a project's `## Threat model`, and what citing buys | `executing-work` (step 4's advisory paragraph) | `security-reviewer` (carries the `threat:` field on every Critical), `scope-adjudicator` (the relevance ruling that confirms or refuses the citation), `docs/security-model.md` (copies the blocking rule whole under its own `## Threat model` heading), `README.md`, `docs/README.md`, `docs/architecture.md` (all three point) |
| The `## Threat model` section's four required parts, and the security lens's conduct where none exists | `security-reviewer` (its threat-model and absent-model paragraphs) | `executing-work` (step 4's advisory paragraph reads `threat: absent` as a citation and points here for the shape), `docs/security-model.md` (carries the kit's own model in that shape) |
| A section's `Standing Brief Amendments` block and its re-read at each section open | `executing-work` | `docs/architecture.md` |
| Which surfaces a subagent may write, and that `docs/` is the curator's and main session's alone | `executing-work` (routing), enforced by `hooks/docs-write-guard.js` | reviewer and implementer charters |
| Killing or replacing a dispatched agent for a reason other than a stall | `executing-work` | doctrine (No completion notification is not a stall signal) |
| Awaiting a background dispatch: `WAITING:` turn end or synchronous call | `executing-work` (the dispatch row, step 1's leash bullet) | doctrine (No completion notification is not a stall signal), `kit-goal` |
| A quiet dispatched agent: probe, wedge hallmark, cadence, the wakes it is evaluated at, windows per dispatch shape | `finishing-work` (Unavailability is the gate failing to run at full strength) | doctrine (Probe a dispatched agent), `executing-work` |
| The capacity reading before a fable-override dispatch: reader, three-way use of its verdict, per-dispatch re-read | `executing-work` (step 1's capacity-reading paragraph, Before any dispatch that passes a `fable` model override) | `finishing-work` (its reviewer defaults, its final adversarial review and its goal read), `consult` (the consultant's dispatch), `brainstorming` (the plan review's dispatch and its wait), `docs/architecture.md`, `README.md` |
| The chapter checkpoint letting a leashed run compact at a section boundary | `executing-work` (step 8, opening the compaction checkpoint) | doctrine (Close each section with a Chapter), `kit-goal`, `hooks/kit-compact-gate.js` |
| Consult triggers and mechanics at a dead end or a decision the spec does not cover | `consult` | doctrine (Orchestration mechanics live in the skills), `executing-work`, `finishing-work` |
| Weighing a review finding or operator correction before acting on it | `responding-to-review` | `executing-work` (its review step), `README.md` |
| Root-causing a failure before proposing a fix | `systematic-debugging` | doctrine (Root-cause from the real state) |
| Whether a change earns a test, which tests retire, test shape and spawned cost, lane mechanics, the red protocol | `testing-discipline` | doctrine (Write tests independent by construction; Make the test earn its green; After each step, run the lane) |
| Which lane each gate moment takes, and reporting the delta against its baseline | doctrine (After each step, run the lane the moment calls for) | `testing-discipline`, `executing-work` |
| Starting a heavy process on a shared machine: the poll and the box budget | doctrine (One heavy process at a time is a per-machine budget) | `testing-discipline`, `executing-work` (brief clause) |
| The outline principle for hunting one thing in a large file | doctrine (When you are hunting for something in a large file) | `csharp-style`, `sql-style` (the recipes) |
| C# and T-SQL house style and their outline recipes | `csharp-style`, `sql-style` | doctrine (Defaults) |
| A document for a named reader, in any voice | doctrine for the register's rule, and `prose-register` for the recipe, the scaling and the voice layer, as the prose register row below states | `prose-reviewer` charter |

## Finishing

| Moment | Owner | Points at it or copies it |
|---|---|---|
| The finishing pass: QA, finishing reviews, goal read, docs curation, memory close, drift routing, close-out | `finishing-work` | doctrine (Finish deliberately, then bank what you learned) |
| The pull request at finishing: opened if none is open, marked ready, auto-merge armed, integrated per commit model at the close | `finishing-work` | `executing-work` (points forward), `curating-docs` (the Commit Model row), `hooks/pr-docs-guard.js` (docs committed before the PR) |
| A record only on a merged PR branch: the strand-check, and invoking the reap of the plan's merged branch and clean worktree once it runs clean | `finishing-work` (the check at the close and the reap's invocation, with its three routes) and `branch-hygiene` (the check at session start and the reap's mechanics) | doctrine (Pushed is not merged) |
| Reaping merged branches, recovering stranded commits, what may be deleted without asking | `branch-hygiene` | `hooks/branch-reaper-nudge.js` |
| The store's record of the effort, the after-query, decay, the applied-stamp ledger | `memory-system` | `finishing-work` (calls it), doctrine (The kit memory store has an extension layer) |

## Git Acts

| Moment | Owner | Points at it or copies it |
|---|---|---|
| Whether this session may commit or push, and the form an authorization takes | doctrine (Name the rollback and stop for a yes; Which Text Governs) | `executing-work` (step 7, applying the commit model), `role` (delegation exclusions), the output style checklist |
| `Commit Model` header values, and the parked state an unknown value produces | `curating-docs` | `executing-work`, `kit-goal` |
| Where in the section loop the commit and the push land under each commit model | `executing-work` | doctrine (Treat durable artifacts as the recovery mechanism), implementer charters |
| Staging on a shared checkout: only your files, read the staged list, keep the index window narrow | doctrine (Stay in scope; On a checkout another session may commit to) | `executing-work` (the whole-worktree prohibition, in its brief field), implementer charters (no commit, no stage) |
| The commit message's three layers | doctrine (A commit title is the index line) | implementer charters |
| The memory store's own commits and pushes: sync path, allowlist, lock | `memory-system` | `kit-doctor`, `coordinator`, `role` |
| Deleting a stranded branch after recovery: the one `git branch -D` outside the merged set, on two conditions | `branch-hygiene` (Hard Rules) | `finishing-work` (the strand-check's recovery pointer) |

## Coordination and Seats

| Moment | Owner | Points at it or copies it |
|---|---|---|
| Reading the roster, messaging a peer, acting on a peer's message: whose word it is, what it directs without the operator, what still goes to the operator | `peer-sessions` | doctrine (Peer sessions are a coordination surface, not a record); `role` (the chain and the delegation exclusions); `coordinator` (the quoted relay of an operator decision); `kit-goal` (the chain handoff that carries a plan's approval) |
| A `## Dispatch Authorization` section's standing, and a citing session's trace | `peer-sessions` (the trace) and `kit-goal` (the section's format) | `coordinator`, `executing-work` |
| A peer handing a leashed session work: only by plan artifact, traced grant or chain handoff, never the message alone | `peer-sessions` | `kit-goal` |
| Taking a seat with `/role`, the registry entry, the coordinator-directory contract | `role` | `peer-sessions`, `coordinator`, README |
| A warranted-channel message inside a tool result: whose word it is, and when it is taken up | doctrine (A relay message delivered inside a tool result is my word deferred to the turn boundary) | `coordinator` (the closed list of warranted channels) |
| A standing operational grant: the rail, its on-switch record, its exclusions, each grant's owning skill | `role` | doctrine (Which Text Governs), `coordinator` |
| The machine coordinator's runbook, the board, and every bar on a board line | `coordinator` | `role`, `peer-sessions`, `standing-watch` |
| A seat running git in the memory store: run as any session on this machine may, with a read of the store's history routed rather than performed | `coordinator` (the ledger section, on a seat running git in the store) | `role` (the standing-grant rail's exclusions), `memory-system` (the sync path) |
| A repeating watch over a live system: tick order, ledger, wake prompt | `standing-watch` | `coordinator` (its named overrides) |
| Parking a session at its next safe point when the operator or a relayed drain window asks, everything durable committed | `executing-work` (the `WAITING:` stop shape) | `coordinator` (the update window), `kit-goal`, `peer-sessions` |
| Arming a completion leash, the canonical condition, and its enforcing Stop hook | `kit-goal` | `executing-work`, `peer-sessions`, `hooks/kit-goal-stop.js` |
| Dispatching this session's own subagents, and the standing request covering it | doctrine (Dispatch is requested standing) | `executing-work`, `finishing-work`, `consult` (where and how, never wider) |

## Memory and Kit Prose

| Moment | Owner | Points at it or copies it |
|---|---|---|
| Recall, outcome journal, applied stamps, tags, decay, shared tiers, `memq`, and the four remedies for a bad record | `memory-system` | doctrine (The kit memory store has an extension layer; A recalled memory contradicted by evidence) |
| Project-tier memory frontmatter | `memory-system`, enforced by `hooks/memory-frontmatter-guard.js` | `finishing-work` |
| Capturing kit friction: the bar, the adjudication pass, how an accepted lesson lands (the owning passage rewritten, never appended to), briefs | `kaizen` | doctrine (When the kit itself creates friction, capture it), `coordinator`, `role`, `writing-skills` (What a Sentence Must Earn) |
| Validating and repairing the machine's kit install | `kit-doctor` | `memory-system`, README |
| Writing or amending any curated prose the kit ships, a skill, charter or the output style, and proving a wording change moves behavior (landing an accepted lesson is `kaizen`'s, above) | `writing-skills` | doctrine (Match a document's length to its job), `kaizen`, `docs/architecture.md` |
| A file growing, and who moves its cap | `writing-skills` (The size budget is a ledger rather than a ceiling), enforced by `scripts/kit-size.js` and, at the repository root rather than the plugin root, `test/size-ratchet.test.js` | `docs/architecture.md` (the size-ratchet paragraph) |
| The prose register: all session prose, in three layers, the decision ask, close-out status and board recap included | doctrine for the rule (Directness and Register, where the sentence layer is the plain-prose bullet and the structure layer is the bullets following the one that names the three layers; Craft and Communication; Write every decision ask to the client-briefing register), and `prose-register` for the recipe, the scaling and the voice layer | the output style (a pinned copy of the register core), `prose-register` (points at the rule) |
| Recipe and scaling: how a writer applies and a reviewer checks each structure bullet, the marketing override's mechanics, what each combination of a piece's two readings takes | `prose-register` (Recipe; Scaling) | doctrine (the register bullet and the scaling bullet under Directness and Register point at the skill) |
| The voice layer: which reference a `Voice:` value names, a voice reference's admission, adding one for a new name | `prose-register` (Voice Layer, and `references/voice-scott.md` for the operator's voice) | doctrine (the register bullet) |
| The machine-prose tells catalog: patterns avoided and hunted by name in any voice, each with its legitimate-form licence | `prose-register` (`references/ai-tells.md`) | `prose-reviewer` charter, `docs/architecture.md` |
| Pushback with no new fact, a bare "are you sure?": the one re-check before the read is restated or downgraded | doctrine (Disagree up front) | none |
| Shell encoding, background-run markers, readiness waits, the harness's isolation screen | doctrine (Environment and Tooling Discipline) | the active shell's tool description (the specifics) |

## Unowned or contested

A moment here has two documents speaking to it with no stated precedence, or none. A session that meets one declares the reading it takes under the intake gap check. It reports the gap in its close-out. It does not resolve the contest by editing either document, since the assignment is the operator's ruling. A row leaves this section when the ruling lands and the losing text is brought current.

| Moment | The surfaces in tension |
|---|---|
| A commit model that commits locally and never pushes | No such value exists; Review-Only forbids the commit as well as the push, so a session asked to commit without pushing has no header to stand on |
