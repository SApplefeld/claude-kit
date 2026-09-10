# Rationale ledger: recap

This file is the rationale ledger for the documents the `recap` skill owns. Rule text says what happens; this ledger says why; git says when. Nobody loads it by default. A session about to change a rule in one of the documents below reads the entry for the claim it is changing first, so the reason a rule holds is not re-litigated at the next review.

Each document sits under its own heading, which opens with its inventory line (what the document is for, which moments it owns, and when a session loads it) and then carries one entry per claim, retired claims included so the next audit does not re-find them. An entry is keyed by the claim's imperative sentence and carries its class (rule, mechanic, pointer, or rationale-example), its source as file and line, its provenance (the commit, incident, memory or kaizen note that installed it, or `no provenance found`), and its verdict (keep, rewrite, or retire) with the reason. A `C` entry's source line is read at the extraction commit `6bc07fb`; an `R` entry is a claim re-extracted from a hunk the Section 5 merge changed, and its source line is read at the merged commit `d9540ad`. Claim numbers restart under every document heading, and inside a document read in chunks they restart per chunk, so an entry id is unique only under its heading and a chunked document carries the chunk in the id (`c2.C001` is claim C001 of the second chunk); a claim named inside a reason or provenance line of such a document carries the same prefix. A `C` entry whose source hunk the Section 5 merge rewrote reads `retire` and carries a `superseded-by:` line naming the `R` entry that holds the passage at the merged commit; the passage's own verdict is that entry's, so a count of retirements over this ledger leaves those records out. A reason may name the form the judge ruled toward (a pointer at the owner, a split, a fold into a neighbour), because that form is why the verdict is rewrite rather than keep or retire; what a passage becomes is the rewrite plan's to decide, and where the two differ the rewrite plan governs. The target wording a judge proposed is recorded in the corpus audit plan's scratch adjudication log (the plan is `claude-kit_corpus-audit_spec_v1.md` under `docs/`), which is that plan's transient scratch: its rewrite section consumes the log, and the rewrite plan it writes under `docs/plans/` is the durable home of any target wording once written. The baseline-test flag on a behavior-shaping rewrite rides in the entry's reason line.

## plugins/claude-kit/skills/recap/SKILL.md

This document is the `recap` skill: it defines how a session produces a stable reading of where it stands without disturbing itself, for an operator who has been away, who is deciding whether the session is safe to park, or who no longer carries a long-running plan's details. It owns the moments of taking a pre-read restatement of the session's goal and current focus, running a read-only freshness pass over five sources (plan doc, git against origin, the kit-goal leash, background-run markers, the peer roster), composing the five-part report (goal and focus beside their record, where things stand, open waits, ordered next steps, the drift diff), delivering that report under the armed-leash and external-channel constraints, and holding the read-only bar that suspends every standing rule that would make the recap write. It explicitly does not own resuming or advancing work, the machine-wide coordinator status sweep, the close-with-the-state a turn already owes, or the act of parking. Load class: `named-trigger` - the skill's own description and its "When this fires" section say it is loaded when the operator invokes /recap or asks where a long-running session stands, and never unprompted.

Extracted at `6bc07fb`: whole document (`skills.recap.SKILL.md`).

### C001
- key: Make the recap reading precise enough to decide on and cheap enough to take at any moment.
- class: rule
- source: plugins/claude-kit/skills/recap/SKILL.md:10
- provenance: 5200f4e 2026-08-31, the recap spec's section 1 install; the two failure directions are the plan's Goal framing (a session drifting into new work, a session reporting nothing actionable).
- verdict: rewrite
- reason: Both failure directions stay because each names a real drift; only the gloss sentence and the second restatement of each direction go. No machinery calibrates a recap.

### C002
- key: Read paths written `skills/` or `hooks/` as under the kit plugin root, and `docs/plans/` as under the project.
- class: mechanic
- source: plugins/claude-kit/skills/recap/SKILL.md:12
- provenance: 5200f4e 2026-08-31, the section 1 install.
- verdict: keep
- reason: A reading convention no program applies; the document's paths are unreadable without it.

### C003
- key: Run this skill only when the operator invokes it, never on your own initiative.
- class: rule
- source: plugins/claude-kit/skills/recap/SKILL.md:16
- provenance: 5200f4e 2026-08-31, the recap spec's Out of Scope line "Any automatic invocation: /recap is the operator's verb".
- verdict: keep
- reason: An invocation trigger rather than an approval hold, so the loop-maintenance retirement precedent does not reach it; a self-invoked recap is the doctrine's close-with-the-state and would make the read-only override fire on every turn.

### C004
- key: Before touching any file, state in the session's own words the goal as it currently understands it and what it is working on right now.
- class: rule
- source: plugins/claude-kit/skills/recap/SKILL.md:20
- provenance: 5200f4e 2026-08-31, named in the commit as the design's load-bearing part; the ordering came from the same day's kaizen lesson that a control derived from the instrument tests its mechanism and not its coverage.
- verdict: keep
- reason: The rule is the whole reason part (e) can detect drift; C008's already-read clause folds into this sentence so the one case a session rationalizes past it sits beside the rule.

### C005
- key: Hold the restatement in the turn only and write nothing to disk.
- class: rule
- source: plugins/claude-kit/skills/recap/SKILL.md:20
- provenance: 5200f4e 2026-08-31, the section 1 install.
- verdict: keep
- reason: The read-only bound stated at the one step a session meets before reading line 34; writing the restatement to a scratch file "so it survives" is the tempting move there, and eight words head it off.

### C006
- key: Order the recap as restatement, then the freshness pass, then the report.
- class: mechanic
- source: plugins/claude-kit/skills/recap/SKILL.md:20
- provenance: 5200f4e 2026-08-31, "The design's load-bearing part is an ordering".
- verdict: keep
- reason: Nothing sequences a recap mechanically and the headings state sections, not order; the two fragments are the sequence part (e) depends on.

### C007
- key: Take the restatement first because a restatement composed after re-reading the plan doc is a paraphrase that agrees with its source and detects no drift.
- class: rationale-example
- source: plugins/claude-kit/skills/recap/SKILL.md:22
- provenance: 5200f4e 2026-08-31; the plan's Evidence records the lesson arriving through the kaizen pass in another costume.
- verdict: rewrite
- reason: The rationale stays in the document because re-reading first is the natural move and the rule is not obeyed reliably without the reason; four sentences compress to two with the paraphrase-agrees-by-construction argument intact.

### C008
- key: Take the pre-read restatement even when this session already read the record with no compaction since.
- class: rule
- source: plugins/claude-kit/skills/recap/SKILL.md:22
- provenance: 5200f4e 2026-08-31, the section 1 install.
- verdict: rewrite
- reason: Merged into C004's sentence as a clause; the case is real (the session that already read the doc skips the restatement) and stays, but as C004's bound rather than a second rule.

### C009
- key: During the freshness pass, re-read the five named sources and never re-verify anything.
- class: rule
- source: plugins/claude-kit/skills/recap/SKILL.md:26
- provenance: 5200f4e 2026-08-31, the plan's "re-read, never re-verify" budget.
- verdict: keep
- reason: No conflict with the doctrine's confirm-before-you-act: the recap acts on nothing, reads are inside the bound, and a fact needing a run is inferred naming the run.

### C010
- key: Re-read the plan doc from disk, reading its latest Chapter whole.
- class: rule
- source: plugins/claude-kit/skills/recap/SKILL.md:28
- provenance: 5200f4e 2026-08-31, the section 1 install.
- verdict: keep
- reason: Its trigger is every freshness pass, which is neither the doctrine's compaction trigger nor standing-watch's tick, so it is not a copy of either and a pointer would send the reader to the wrong trigger.

### C011
- key: Map the Chapter's fields as follows: `Completed:` and `Next:` are the record side of the restatement, `Gate:` feeds part (b), and `Review Findings:` feeds part (d).
- class: mechanic
- source: plugins/claude-kit/skills/recap/SKILL.md:28
- provenance: 5200f4e 2026-08-31, the section 1 install.
- verdict: keep
- reason: No program routes Chapter fields into report parts; the mapping is the session's.

### C012
- key: Read git against origin: what is committed, what is pushed, what is still dirty, and what the branch tip on origin carries.
- class: rule
- source: plugins/claude-kit/skills/recap/SKILL.md:29
- provenance: 5200f4e 2026-08-31, the section 1 install.
- verdict: keep
- reason: The four readings are the close-with-the-state facts an operator on a phone decides on; no machinery produces them for a recap.

### C013
- key: Read the origin branch tip with `git ls-remote`, which asks the remote and writes nothing.
- class: mechanic
- source: plugins/claude-kit/skills/recap/SKILL.md:29
- provenance: 5200f4e 2026-08-31; the instrument choice matches the operator-tier memory a-behind-ahead-count-answers-from-a-possibly-stale-tracking-ref.
- verdict: keep
- reason: The plan's amendment says a named instrument is invocable or not named, so the command stays; the read-only justification stops a session under the bound refusing a command that contacts the remote.

### C014
- key: Never substitute a local remote-tracking ref for the remote tip reading.
- class: rule
- source: plugins/claude-kit/skills/recap/SKILL.md:29
- provenance: 5200f4e 2026-08-31; the incident class is the operator-tier memory a-behind-ahead-count-answers-from-a-possibly-stale-tracking-ref, a pass that read "behind 0 ahead 0" from a ref two commits stale.
- verdict: keep
- reason: Incident-born, still possible on every multi-repo pass, and nothing mechanical refreshes a tracking ref before a recap reads it.

### C015
- key: Where the remote is unreachable, report the tip as an inferred claim naming `git ls-remote` as what would confirm it.
- class: rule
- source: plugins/claude-kit/skills/recap/SKILL.md:29
- provenance: 5200f4e 2026-08-31, the section 1 install.
- verdict: keep
- reason: An application of the doctrine's cannot-measure rule naming the one command that would confirm; it carries only what the reader cannot act without and does not restate the owner.

### C016
- key: Read the leash with `node <plugin-root>/hooks/kit-goal.js status`, run from the project directory.
- class: mechanic
- source: plugins/claude-kit/skills/recap/SKILL.md:30
- provenance: 5200f4e 2026-08-31 installed the command; e22cff5 2026-09-02 (WORKTREE-GOALS §3) corrected the parenthetical when the leash moved from the repository to the tree.
- verdict: keep
- reason: The status call answers the directory it is run from, so the run-from-the-tree-root instruction is what makes the reading about the right tree.

### C017
- key: Resolve `<plugin-root>` to `CLAUDE_PLUGIN_ROOT` where the harness supplies it, else to this skill's base directory's grandparent.
- class: mechanic
- source: plugins/claude-kit/skills/recap/SKILL.md:30
- provenance: 5200f4e 2026-08-31, the section 1 install.
- verdict: keep
- reason: The placeholder's resolution has no owner in the ownership map and is restated in park, standing-watch and memory-system alike, so there is nothing to point at; the unowned convention is a program-level gap to declare.

### C018
- key: Read both halves of the leash: which plans a goal is armed for with the current plan's queue position, and the binding.
- class: rule
- source: plugins/claude-kit/skills/recap/SKILL.md:30
- provenance: 5200f4e 2026-08-31 installed the two halves; f64247e 2026-09-01 (INSTRUMENTS-NOT-PROSE §7) rebuilt the binding half around the placement instrument.
- verdict: keep
- reason: The Stop hook keys on both halves, so a recap reading one misreports what a park would owe; the bullet's rationale passages compress around this rule (adjudication A022) while the rule stands.

### C019
- key: Expect `status` to print the binding in one of three forms: bound to a named session id, unbound with an arming session recorded, or unbound with none recorded.
- class: mechanic
- source: plugins/claude-kit/skills/recap/SKILL.md:30
- provenance: f64247e 2026-09-01, INSTRUMENTS-NOT-PROSE §7.
- verdict: keep
- reason: A pinned copy: test/doctrine-parity.test.js:5727-5741 counts hooks/kit-goal.js's binding ternary against the figure and asserts the phrase "one of three forms"; the CLI prints the forms but nothing makes a session read them, so this is not superseded in the retire sense.

### C020
- key: For the two unbound forms, read the kit-goal skill's claim signals rather than judging from the printed form.
- class: pointer
- source: plugins/claude-kit/skills/recap/SKILL.md:30
- provenance: f64247e 2026-09-01, INSTRUMENTS-NOT-PROSE §7.
- verdict: keep
- reason: No finding; the parity pin asserts the pointer's presence (test/doctrine-parity.test.js:5899) and kit-goal owns the claim routes.

### C021
- key: Never place the leash binding on the printed session id.
- class: rule
- source: plugins/claude-kit/skills/recap/SKILL.md:30
- provenance: f64247e 2026-09-01; the replaced sentence had told the recap to report the binding as printed on a false premise that nothing hands a session its own id.
- verdict: keep
- reason: The id appears in the bound form alone, so a session holding the leash by the arming route would read unbound and freely claimable while its next stop binds and blocks; the pin refuses a bare id comparison by name.

### C022
- key: Place the binding on `sessionHoldsLeash` in `hooks/kit-goal-lib.js`, resolving the absent state and then the damaged one before the id, and gating the id on shape before the call.
- class: mechanic
- source: plugins/claude-kit/skills/recap/SKILL.md:30
- provenance: f64247e 2026-09-01; the order was set after a weaker guard was found asserting a definite foreign placement over a damaged file, and the type test mirrors hooks/kit-goal.js line 380.
- verdict: rewrite
- reason: The shipped invocation embodies the order and the pin proves it across eleven stubbed branches and two real-filesystem rows (test/doctrine-parity.test.js:5760-5896), so the prose reduces to naming `sessionHoldsLeash` as the placement; the ordering account lives here: absent before damaged because `readGoal` returns null for both, damaged before id so an unreadable goal never lands as a placement, shape before the call so an unset id reads unplaceable rather than false.

### C023
- key: Spell `<plugin-root>` with forward slashes inside the JavaScript require string.
- class: mechanic
- source: plugins/claude-kit/skills/recap/SKILL.md:30
- provenance: f64247e 2026-09-01, INSTRUMENTS-NOT-PROSE §7.
- verdict: rewrite
- reason: The hazard is real and uncorrected by any program (a Windows-spelled root collapses in a JavaScript string and the catch reports unknown), so the clause stays beside the command; it compresses to the one clause memory-system uses because the reader is mid-command and the collapse narrative adds nothing they act on.

### C024
- key: Read the leash placement with the given `node -e "try{const g=require('<plugin-root>/hooks/kit-goal-lib.js'),...}catch{console.log('unknown')}"` invocation, run from the project directory.
- class: mechanic
- source: plugins/claude-kit/skills/recap/SKILL.md:30
- provenance: f64247e 2026-09-01, INSTRUMENTS-NOT-PROSE §7.
- verdict: keep
- reason: The invocation is the instrument; the pin lifts it from the backticks and runs it (test/doctrine-parity.test.js:5771), so its text stays verbatim and any change goes through the pin.

### C025
- key: Report the leash as a placement word only: this session's, not this session's, unplaceable, unknown, or none armed.
- class: rule
- source: plugins/claude-kit/skills/recap/SKILL.md:30
- provenance: f64247e 2026-09-01; five words rather than four because the fourth reading had folded none-armed into damaged, which would have told every unleashed project never to end its turn.
- verdict: keep
- reason: The delivery paragraph binds on these five words and the id itself is a disclosure the line bars keep off external channels.

### C026
- key: Report the negative placement as "not this session's" rather than as another session's.
- class: rule
- source: plugins/claude-kit/skills/recap/SKILL.md:30
- provenance: f64247e 2026-09-01, INSTRUMENTS-NOT-PROSE §7.
- verdict: keep
- reason: `sessionHoldsLeash` composes the bound-id and recorded-arming-id routes and deliberately omits the transcript-text route as too expensive per call, so a session that would claim on typed text reads negative here; "another session's" would assert a placement the predicate cannot make.

### C027
- key: Mark the leash placement as inferred rather than confirmed.
- class: rule
- source: plugins/claude-kit/skills/recap/SKILL.md:30
- provenance: f64247e 2026-09-01, INSTRUMENTS-NOT-PROSE §7.
- verdict: keep
- reason: The environment id is read on shape alone and a dispatched subagent's shell carries its dispatcher's id, so the instrument cannot confirm whose shell it ran in.

### C028
- key: Treat a leash placement taken anywhere but a session's own shell as unverified rather than merely uncertain.
- class: rule
- source: plugins/claude-kit/skills/recap/SKILL.md:30
- provenance: f64247e 2026-09-01, INSTRUMENTS-NOT-PROSE §7.
- verdict: keep
- reason: Nothing in the harness gives a dispatched agent an identifier of its own, so a subagent's reading places its dispatcher and no marking short of unverified is honest.

### C029
- key: Do not gate the leash instrument on `CLAUDE_CODE_CHILD_SESSION=1`, because it is set in a main session's tool shell exactly as in a dispatched agent's.
- class: rationale-example
- source: plugins/claude-kit/skills/recap/SKILL.md:30
- provenance: f64247e 2026-09-01; both review lenses proposed the variable as the subagent discriminator and the remedy was rejected after running it in the main session and reading the CLI's environment builder, which sets it with no branch on agent-ness.
- verdict: rewrite
- reason: One clause stays because two independent reviewers reached for this fix and a third will; the verification account (set unconditionally in every session's tool shell, confirmed at the shell and at the CLI source) lives here.

### C030
- key: Never let the leash command's own error text, absolute paths, or stack traces enter the report.
- class: rule
- source: plugins/claude-kit/skills/recap/SKILL.md:30
- provenance: f64247e 2026-09-01; the disclosure bar itself is 5200f4e's round-3 fix (a relay-delivered path carries the OS username).
- verdict: rewrite
- reason: The rule stands whole; the residual passage (a root spelling that breaks the parse prints a stack trace before the `try` exists) compresses to one clause, since the reader needs to know the wrapper does not cover every case and not how the parser fails.

### C031
- key: Where any part of the reading leaves this session, establish the store's readership question via the coordinator skill's precondition rather than answering it here.
- class: pointer
- source: plugins/claude-kit/skills/recap/SKILL.md:30
- provenance: f64247e 2026-09-01, INSTRUMENTS-NOT-PROSE §7.
- verdict: keep
- reason: No finding; the coordinator owns the readership precondition per the ownership map.

### C032
- key: Keep "none armed", "unplaceable" and "unknown" distinct and never report one as another.
- class: rule
- source: plugins/claude-kit/skills/recap/SKILL.md:30
- provenance: f64247e 2026-09-01; as shipped in the prior round the reading folded none-armed into unknown and the delivery rule would have held every unleashed project.
- verdict: keep
- reason: The delivery paragraph binds on the split (unplaceable and unknown take the leashed shape, none armed does not), and the pin's absence row exists to hold the two apart.

### C033
- key: Separate an absent goal state from a damaged one using `goalStateAbsent`, and read all these states from the kit's own answers rather than by inference.
- class: mechanic
- source: plugins/claude-kit/skills/recap/SKILL.md:30
- provenance: f64247e 2026-09-01, INSTRUMENTS-NOT-PROSE §7.
- verdict: rewrite
- reason: The read-from-the-kit's-answers clause stays as the rule; the `readGoal`-returns-null-for-both explanation is the invocation's design and the pin's two filesystem rows enforce it (test/doctrine-parity.test.js:5866-5896), so it lives here.

### C034
- key: Read every background run's result from the marker the run wrote, such as an exit-code file or a completion line in the log.
- class: rule
- source: plugins/claude-kit/skills/recap/SKILL.md:31
- provenance: 5200f4e 2026-08-31; this bullet was round 3's residue, having settled a run's death on the process list alone.
- verdict: rewrite
- reason: The doctrine owns background-run markers and the recap names it as owner, so the restated marker rule with its reason becomes a pointer; a paraphrase with no pin is the defect class the install's own amendment removes.

### C035
- key: Never read an absent marker as meaning the run is in flight.
- class: rule
- source: plugins/claude-kit/skills/recap/SKILL.md:31
- provenance: 5200f4e 2026-08-31, the section 1 install.
- verdict: keep
- reason: A recap-specific reading rule the doctrine does not state; a run that died before writing its marker looks identical to one still running.

### C036
- key: Read the doctrine's background-task bullet for what settles a background run's death.
- class: pointer
- source: plugins/claude-kit/skills/recap/SKILL.md:31
- provenance: 5200f4e 2026-08-31, round 3's fix pointing at the owner.
- verdict: keep
- reason: No finding; the pointer is the owner reference the rewrite of C034 leans on.

### C037
- key: Report each background run on both components, the process list and the completion notification, never on the process list alone.
- class: rule
- source: plugins/claude-kit/skills/recap/SKILL.md:31
- provenance: 5200f4e 2026-08-31, round 3: the bullet had settled death on the process list alone where the doctrine settles it on both.
- verdict: keep
- reason: The quotation of the doctrine's clause is a cited copy and the reporting rule is the recap's own fix for the incident; both are reads inside the bound.

### C038
- key: Name the no-marker-by-design case as itself rather than folding it into either verdict.
- class: rule
- source: plugins/claude-kit/skills/recap/SKILL.md:31
- provenance: 5200f4e 2026-08-31, round 3: the prior text produced a false death line for the doctrine's worktree-isolated fallback, where no marker is written by design.
- verdict: keep
- reason: Incident-born, the fallback still exists, and nothing mechanical distinguishes a run that wrote no marker by design from one that died before writing one.

### C039
- key: Take one `ListAgents` read of the roster where a peer session is load-bearing to the report, and skip it where none is.
- class: rule
- source: plugins/claude-kit/skills/recap/SKILL.md:32
- provenance: 5200f4e 2026-08-31, the plan's "re-check the roster where peers are load-bearing".
- verdict: keep
- reason: No finding; a roster read is inside the bound and the skip clause keeps the reading cheap.

### C040
- key: During a recap take no action that changes state anywhere and none that spends the machine's one heavy-process slot.
- class: rule
- source: plugins/claude-kit/skills/recap/SKILL.md:34
- provenance: 5200f4e 2026-08-31, "bounded by one test rather than a list".
- verdict: keep
- reason: An explicit override the plan installed on the surface that owns the moment; the kaizen, memory-stamp and act-on-found-work rules are deferred one turn to (d), not refused, so the contentions are intentional semantics. The instance list is the class-not-boundary device and stays.

### C041
- key: Report any fact that would need a run to confirm as an inferred claim naming the run that would confirm it.
- class: rule
- source: plugins/claude-kit/skills/recap/SKILL.md:34
- provenance: 5200f4e 2026-08-31, the plan's "reported as unverified rather than verified during the recap".
- verdict: keep
- reason: Applies the doctrine's inferred marking to the one thing the bound forbids and names the substitute for running; not a restatement of the owner.

### C042
- key: Do not spawn a suite during a recap, because it spends the machine's one heavy-process slot to answer a question the operator asked so they would not have to spend anything.
- class: rationale-example
- source: plugins/claude-kit/skills/recap/SKILL.md:34
- provenance: 5200f4e 2026-08-31, the section 1 install.
- verdict: retire
- reason: C040 names suites as an instance and the slot in the bound, so the rule is obeyed without this sentence. The why, kept here: the operator asked for a recap precisely so nothing would be spent, and a suite spends the box's one heavy-process slot (the role skill's claim protocol) on a question a read answers.

### C043
- key: Write the report in five parts in the order (a) goal and focus, (b) where things stand, (c) waits, (d) next steps, (e) drift diff.
- class: mechanic
- source: plugins/claude-kit/skills/recap/SKILL.md:38
- provenance: 5200f4e 2026-08-31, the plan's fixed five-part shape adapted from the published pattern.
- verdict: keep
- reason: No program assembles the report; the fixed shape is what makes a recap comparable across sessions.

### C044
- key: Scale the prose to the session, a few lines per part for a short session and more for a long-running plan.
- class: rule
- source: plugins/claude-kit/skills/recap/SKILL.md:38
- provenance: 5200f4e 2026-08-31, the section 1 install.
- verdict: keep
- reason: An instance of the doctrine's match-length-to-job rule naming the recap's scaling axis (session length), which the doctrine does not; a pointer would be no shorter.

### C045
- key: In part (a), quote the goal verbatim as the record states it, from the plan doc's `## Goal` or from the dispatch brief where the session is executing one.
- class: rule
- source: plugins/claude-kit/skills/recap/SKILL.md:40
- provenance: 5200f4e 2026-08-31; the published pattern's "goal in the requester's words" mapped onto the kit's `## Goal` and `## Dispatch Authorization`.
- verdict: keep
- reason: The verbatim quotation is the record half of the drift diff; the parenthetical naming which section is the planning session's prose and which carries the requester's framing is what C076's external-channel carve-out binds on.

### C046
- key: Read `skills/brainstorming/SKILL.md` for the shape of the plan doc's `## Goal`, and the plan's `## Dispatch Authorization` for the requester's own framing where the plan carries it.
- class: pointer
- source: plugins/claude-kit/skills/recap/SKILL.md:40
- provenance: 5200f4e 2026-08-31, the section 1 install.
- verdict: keep
- reason: No finding; brainstorming owns the Goal shape per the ownership map.

### C047
- key: Place the pre-read restatement beside the record's goal, and the session's stated current focus beside the latest Chapter's `Completed:` and `Next:`.
- class: rule
- source: plugins/claude-kit/skills/recap/SKILL.md:40
- provenance: 5200f4e 2026-08-31, the section 1 install.
- verdict: keep
- reason: The side-by-side pairs are what part (e) diffs; the no-Chapter fallback keeps the rule executable on a plan with no Chapter yet.

### C048
- key: Present both pairs verbatim and side by side, never merged into one summary.
- class: rule
- source: plugins/claude-kit/skills/recap/SKILL.md:40
- provenance: 5200f4e 2026-08-31, the section 1 install.
- verdict: keep
- reason: A merged summary is the paraphrase that agrees with both sources by construction, the same defect the pre-read ordering exists to prevent.

### C049
- key: In part (b), mark every load-bearing claim confirmed, inferred or reported, with its evidence named.
- class: rule
- source: plugins/claude-kit/skills/recap/SKILL.md:42
- provenance: 5200f4e 2026-08-31; the triad restatement was a Critical site in review rounds 1 and 2 (a restatement disagreeing with its owner) and survived round 3 with "per the doctrine" attached.
- verdict: rewrite
- reason: The doctrine owns the triad and the recap already names it, so the three evidence forms restated in full are a second copy with no pin; the rule reduces to the marking per the doctrine with evidence named.

### C050
- key: Report a green suite as a suite result with the lane it ran and the baseline it is a delta against, never as proof of behavior the suite does not exercise.
- class: rule
- source: plugins/claude-kit/skills/recap/SKILL.md:42
- provenance: 5200f4e 2026-08-31, the published pattern's "tests passing does not count as proven" mapped onto the doctrine's lane-and-baseline reporting.
- verdict: keep
- reason: The doctrine's rule is about gating behavior on observation; this is the wording of a suite result in a report, and the two do not substitute.

### C051
- key: In part (c), split what the session is waiting on by what holds it: a person named by role and what they hold, or something technical named with the last diagnosis.
- class: rule
- source: plugins/claude-kit/skills/recap/SKILL.md:44
- provenance: 5200f4e 2026-08-31; the boundary sentence against executing-work's blocker vocabulary is the fix for a round 1/2 Critical where the closed blocker set was restated and disagreed with its owner.
- verdict: keep
- reason: The split is the report's own axis and the boundary sentence is what stops the next author restating executing-work's blocker set here; removing it reopens the defect.

### C052
- key: Read `skills/executing-work/SKILL.md` and its completion contract for the closed blocker set and the `BLOCKED:`/`WAITING:` stop shapes, which are not part (c)'s axis.
- class: pointer
- source: plugins/claude-kit/skills/recap/SKILL.md:44
- provenance: 5200f4e 2026-08-31, the round 1/2 fix pointing at the owner.
- verdict: keep
- reason: No finding; executing-work owns the completion contract per the ownership map.

### C053
- key: In part (d), list next steps in order, each marked as the session's or the operator's, stated so the operator can act from a phone.
- class: rule
- source: plugins/claude-kit/skills/recap/SKILL.md:46
- provenance: 5200f4e 2026-08-31 installed the part; 10518d6 2026-08-31 (PARK-AND-QUIESCE §3) folded the recap in because line 46 carried pre-widening park refusal semantics that answered the opposite of their owner.
- verdict: keep
- reason: A report-part definition adding the owner marking to the doctrine's ordered-steps rule; the restated mechanisms around it (executing-work's `WAITING:` preconditions, park's wake mechanism) become pointers because they have drifted once already and carry no pin.

### C054
- key: Where the question is whether the session is safe to park, name every in-flight dispatch against the windows finishing-work's unavailability rule owns.
- class: rule
- source: plugins/claude-kit/skills/recap/SKILL.md:46
- provenance: 5200f4e 2026-08-31, the companion-plan design (/recap answers safe-to-park).
- verdict: keep
- reason: A park with a dispatch in flight is the case the park skill's preconditions turn on, and the recap is the instrument that answers it; finishing-work owns the windows and the pointer stays.

### C055
- key: Read `skills/finishing-work/SKILL.md` from the bold lead "Unavailability is the gate failing to run at full strength" for the dispatch windows and readings.
- class: pointer
- source: plugins/claude-kit/skills/recap/SKILL.md:46
- provenance: 5200f4e 2026-08-31, the section 1 install.
- verdict: keep
- reason: Finishing-work is the owner per the ownership map; standing-watch's pointer at the same lead is a sibling pointer, not an overlap.

### C056
- key: Report each dispatch's window state and name what a park would still owe.
- class: rule
- source: plugins/claude-kit/skills/recap/SKILL.md:46
- provenance: 10518d6 2026-08-31, PARK-AND-QUIESCE §3, which reworded the precondition from "refuses a park outright" to "holds the park, in-turn and unrefused" when Standing Amendment 3 widened the `WAITING:` shape.
- verdict: rewrite
- reason: The rule stays; its bound restates executing-work's park preconditions, a copy that went stale once and was corrected by fold-in, so the bound becomes a pointer at the `WAITING:` stop shape.

### C057
- key: Run the readings that change anything, the probe among them, only when the operator acts on the report, never during it.
- class: rule
- source: plugins/claude-kit/skills/recap/SKILL.md:46
- provenance: 5200f4e 2026-08-31 ("no probes fire"), restated at 10518d6.
- verdict: keep
- reason: A blast-radius gate: the probe is a message to a dispatched agent and changes its state, so it is an instance of the bound; the doctrine's probe cadence governs a working session and the recap defers it one turn under the owning skill's override.

### C058
- key: Name the leash in part (d).
- class: rule
- source: plugins/claude-kit/skills/recap/SKILL.md:46
- provenance: 5200f4e 2026-08-31 installed the rule; 10518d6 2026-08-31 corrected the wake account (a `WAITING:` stop is re-invoked by its completion notification, a park wakes only on resume or cancel, a parked coordinator seat wakes on its reconciliation timer, the armed goal wakes nothing).
- verdict: rewrite
- reason: The rule stays because an operator deciding on a park needs to know nothing wakes the session on a timer; the 120-word wake account is the park skill's to own and has already drifted once, so it becomes a pointer.

### C059
- key: In part (e), diff both halves of the restatement against the record: goal against the record's goal, focus against the Chapter.
- class: rule
- source: plugins/claude-kit/skills/recap/SKILL.md:48
- provenance: 5200f4e 2026-08-31, the drift diff the whole ordering serves.
- verdict: keep
- reason: The fifth part is the plan's stated reason for the pre-read ordering; "usually none, one word is the whole line" stays as the format bar, and only the "most valuable line" claim and the section-3 example leave the passage.

### C060
- key: When there is drift, name what the session believed and name what the record says, and stop there.
- class: rule
- source: plugins/claude-kit/skills/recap/SKILL.md:48
- provenance: 5200f4e 2026-08-31, the section 1 install.
- verdict: keep
- reason: "Stop there" is the read-only bar applied to the drift line: reconciling the two is the work the recap must not start.

### C061
- key: Where the record was freshly read this session with no compaction between, say so beside the drift line.
- class: rule
- source: plugins/claude-kit/skills/recap/SKILL.md:48
- provenance: 5200f4e 2026-08-31, the section 1 install.
- verdict: keep
- reason: A "none" after a fresh read is the paraphrase control and proves little; the annotation tells the operator how much the line is worth.

### C062
- key: Never end the turn on a recap in a project with a leash armed.
- class: rule
- source: plugins/claude-kit/skills/recap/SKILL.md:52
- provenance: f64247e 2026-09-01; the lead was widened from "a session holding an armed leash" to "a project with a leash armed" so it reaches a session placing the leash elsewhere, and the bystander carve-out was added in the same rewrite.
- verdict: rewrite
- reason: The rule stands, but the lead admits no exception while the paragraph carves one for a bystander with no work, which the sweep read as a contradiction; the lead gains its carve-out beside it, per the doctrine's rule that a stop read without its exceptions is a pointer.

### C063
- key: Read the leash before composing the report.
- class: rule
- source: plugins/claude-kit/skills/recap/SKILL.md:52
- provenance: 5200f4e 2026-08-31, the section 1 install.
- verdict: keep
- reason: A report opening with the goal is not a lead the Stop hook allows on, so a recap composed before the leash is read bounces the session back into the work the operator asked it to hold still about.

### C064
- key: Expect the Stop hook to allow a stop only on a last message whose first characters are `BLOCKED:` or `WAITING:`, to block a mid-queue `BLOCKED:` with an advance reason, and to refuse either prefix whose stated reason is capacity.
- class: mechanic
- source: plugins/claude-kit/skills/recap/SKILL.md:52
- provenance: 5200f4e 2026-08-31; round 3's Minor corrected "only" to admit the indeterminate reads the hook allows on by design.
- verdict: rewrite
- reason: hooks/kit-goal-stop.js performs every clause enumerated and states them in its header, and kit-goal owns the hook per the ownership map; the recap keeps one sentence (the hook allows a stop only on a `BLOCKED:`/`WAITING:` lead) so the bounce consequence stays intelligible, and the enumeration becomes a pointer.

### C065
- key: Never treat a placement of "not this session's" as evidence that a stop would in fact be allowed.
- class: rule
- source: plugins/claude-kit/skills/recap/SKILL.md:52
- provenance: f64247e 2026-09-01, INSTRUMENTS-NOT-PROSE §7.
- verdict: keep
- reason: The hook enforces on the arming route (typed `<command-args>` text naming the plan), which `sessionHoldsLeash` omits, so the instrument's negative is wider than the hook's allow; the placement buys the report's accuracy about whose leash is armed and never a licence to stop.

### C066
- key: On all four armed readings, deliver the recap without ending the turn, over the relay reply or in the message before the work continues, then continue whatever work the session was already doing.
- class: rule
- source: plugins/claude-kit/skills/recap/SKILL.md:52
- provenance: 5200f4e 2026-08-31 stated the shared branch over four readings; f64247e 2026-09-01 made them placements and split none-armed out.
- verdict: keep
- reason: One delivery branch for every armed reading is what keeps a placement error from becoming a bounced turn; the bystander case is the lead's carve-out (C062), not a contradiction of this rule.

### C067
- key: On a "none armed" reading, end the turn or not on whatever the session's own work calls for.
- class: rule
- source: plugins/claude-kit/skills/recap/SKILL.md:52
- provenance: f64247e 2026-09-01; the prior text had told every unleashed project never to end its turn.
- verdict: keep
- reason: None armed is the ordinary state of most projects and carries no leash; without this exemption the delivery rule held every project.

### C068
- key: A bystander session with no work of its own delivers the recap and ends the turn on a true statement that it holds no work here.
- class: rule
- source: plugins/claude-kit/skills/recap/SKILL.md:52
- provenance: f64247e 2026-09-01, INSTRUMENTS-NOT-PROSE §7.
- verdict: keep
- reason: The continue clause is satisfied vacuously where there is nothing to continue, and a true statement of the session's own state is not the manufactured stop C071 bars; the lead's rewrite names this as its carve-out.

### C069
- key: Where such a bystander is one the hook would block, end the turn under a `BLOCKED:` naming that it was invoked with no work under a leash it may claim.
- class: rule
- source: plugins/claude-kit/skills/recap/SKILL.md:52
- provenance: f64247e 2026-09-01, INSTRUMENTS-NOT-PROSE §7.
- verdict: keep
- reason: Under the arming-route reading the hook blocks a plain stop, and a `BLOCKED:` naming the true situation is the honest lead rather than a workaround.

### C070
- key: Where the session is stopping anyway on a true `BLOCKED:` or `WAITING:`, ride the recap under that lead, after the blocker paragraph.
- class: rule
- source: plugins/claude-kit/skills/recap/SKILL.md:52
- provenance: 5200f4e 2026-08-31, the section 1 install.
- verdict: keep
- reason: The hook reads the first characters of the last message, so a recap placed before the lead would turn a genuine stop into a bounce.

### C071
- key: Never manufacture a stop in order to get a recap out.
- class: rule
- source: plugins/claude-kit/skills/recap/SKILL.md:52
- provenance: 5200f4e 2026-08-31, quoting executing-work's completion contract.
- verdict: keep
- reason: A quoted clause citing its owner; a fabricated `BLOCKED:` releases the leash on a false record.

### C072
- key: Never clear the goal so a recap can stop.
- class: rule
- source: plugins/claude-kit/skills/recap/SKILL.md:52
- provenance: 5200f4e 2026-08-31, the section 1 install.
- verdict: keep
- reason: Clearing the goal abandons the continuity the leash holds, and the operator asked for the reading in order to decide that question themselves.

### C073
- key: Read the coordinator skill's ledger rules under the bold lead "What rides, and the two things that stop it riding" for the two bars on any part of the reading that leaves this session.
- class: pointer
- source: plugins/claude-kit/skills/recap/SKILL.md:54
- provenance: 5200f4e 2026-08-31, round 3: the bars had been scoped by audience, exempting the relay reply, where their owner scopes them by what a line carries.
- verdict: keep
- reason: The coordinator owns every bar on what a board line carries per the ownership map; the pointer plus the quoted "on what a line carries" clause is the pin.

### C074
- key: Spell every path repo-relative or home-relative and never absolute.
- class: rule
- source: plugins/claude-kit/skills/recap/SKILL.md:54
- provenance: 5200f4e 2026-08-31, round 3: a relay-delivered part (b) evidence reference would have put an absolute path's OS username onto Discord.
- verdict: keep
- reason: Incident-born, still possible on every relay reply, and no hook screens a reply's text; the copy is a cited quotation of its owner and the kaizen clause is not this unit's to rule.

### C075
- key: Carry the operator's own words as a pointer to the artifact or channel that holds them, never quoted and never paraphrased.
- class: rule
- source: plugins/claude-kit/skills/recap/SKILL.md:54
- provenance: 5200f4e 2026-08-31, round 3; the paraphrase clause is quoted from the coordinator skill's ledger rules.
- verdict: keep
- reason: The coordinator owns the bar and the recap quotes it with the clause that closes the paraphrase loophole; a relay reply is an external service whatever its allowlist.

### C076
- key: Quote the record's `## Goal` verbatim in part (a), but carry anything the plan or leash holds of the operator's authorization words as a pointer to where it sits.
- class: rule
- source: plugins/claude-kit/skills/recap/SKILL.md:54
- provenance: 5200f4e 2026-08-31, round 3; the recap plan's own `## Dispatch Authorization` section is the ordinary case where the record carries operator words.
- verdict: keep
- reason: Not a restatement: it resolves the collision between C045 (quote the goal verbatim) and C075 (never quote the operator) for a record that carries both, and neither rule alone answers it.

### C077
- key: Suspend for the recap's duration every standing rule that would make it write.
- class: rule
- source: plugins/claude-kit/skills/recap/SKILL.md:58
- provenance: 5200f4e 2026-08-31, the plan's "read-only bar, stated as an explicit override".
- verdict: keep
- reason: An explicit override installed on the surface that owns the moment; the kaizen grant, the same-turn memory fix and act-on-found-work are deferred to (d) rather than refused, and naming them is what makes the class statement bite.

### C078
- key: Do not act on what the recap finds, because a recap that fixes what it notices reports on a session it has already changed and destroys the reading the invocation was for.
- class: rationale-example
- source: plugins/claude-kit/skills/recap/SKILL.md:58
- provenance: 5200f4e 2026-08-31 ("A recap that fixes what it notices has destroyed the reading it was invoked for").
- verdict: keep
- reason: The suspension overrides doctrine mandates that outrank a skill for principles, so without the reason a session weighs a mandate against an unexplained bar and the mandate wins; the rule is not obeyed reliably without it.

### C079
- key: Carry anything found into the report as a next step under (d), named and unactioned.
- class: rule
- source: plugins/claude-kit/skills/recap/SKILL.md:60
- provenance: 5200f4e 2026-08-31, the plan's "anything found rides in the report as a next step; the operator's follow-up is where it becomes work".
- verdict: keep
- reason: An operator-decision gate that is the recap's purpose (the operator decides whether the session continues); act-on-found-work is deferred one turn under the stated override, not contradicted.

### C080
- key: Refuse the rationalizations "it is one line", "it was the next step anyway" and "fixing it is what makes the report accurate".
- class: rationale-example
- source: plugins/claude-kit/skills/recap/SKILL.md:60
- provenance: 5200f4e 2026-08-31, the section 1 install; no incident beyond the install is recorded for the list.
- verdict: keep
- reason: A rationalization list is behavior-shaping wording rather than rationale, and no evidence shows dropping it is safe; taste is not a verdict.

### C081
- key: Read `skills/coordinator/SKILL.md`, its operator-interface function, for the machine-wide status round's conditions.
- class: pointer
- source: plugins/claude-kit/skills/recap/SKILL.md:64
- provenance: 5200f4e 2026-08-31, the round 1/2 fix replacing a restatement of the status-round conditions with a pointer at the runbook.
- verdict: keep
- reason: No finding; the coordinator owns the runbook per the ownership map.

### C082
- key: Never substitute a recap for the coordinator's status round or the round for a recap, and do not run recaps from the coordinator seat.
- class: rule
- source: plugins/claude-kit/skills/recap/SKILL.md:64
- provenance: 5200f4e 2026-08-31, the plan's neighbours bullet "so neither gets improved into the other".
- verdict: keep
- reason: The contrast is the rule's reason and the pointer is the fix for a restatement that disagreed with its owner; a coordinator running recaps has left a seat whose runbook the coordinator skill owns.

### C083
- key: End the recap at the reading and never park the session; answer whether it is safe to park and leave the decision to the operator.
- class: rule
- source: plugins/claude-kit/skills/recap/SKILL.md:65
- provenance: 5200f4e 2026-08-31, the companion-plan design with park-and-quiesce: /recap answers, /park acts.
- verdict: keep
- reason: An operator-decision gate that keeps the read-only instrument read-only; the park skill states the same split from its side.

### C084
- key: Phrase the never-end-the-turn lead as about the project's armed leash, not about this session's own hold on it.
- class: mechanic
- source: plugins/claude-kit/skills/recap/SKILL.md:52
- provenance: f64247e 2026-09-01; the prior lead "A session holding an armed leash cannot end its turn on a recap" did not address a session that places the leash elsewhere, and the rewrite widened it to the project.
- verdict: retire
- reason: A document explaining its own phrasing is journey, and this entry is where it lives: the lead is stated over the project because the rule binds on all four armed placements, including not-this-session's, so a future edit narrowing it to the holder reopens the gap f64247e closed.
