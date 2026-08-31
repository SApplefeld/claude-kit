# A session reports where it actually stands, restating its goal before it re-reads it

Status: Complete
Commit Model: Commit-and-Push
Created: 2026-08-29

Session model: any executor session in the kit repo; one section, opus tier. Authored by the KIT: Expert seat from a design dialog with the operator, 2026-08-29, adapting a pattern published by an Anthropic engineer to the kit's own machinery. Anchors are authoring-time.

## Dispatch Authorization

Authorized 2026-08-29 by the operator: the /recap skill as designed in the dialog, given at the operator's keyboard in the expert seat's session. This section was authored by the KIT: Expert seat; per the peer-sessions trace rule it is a warrant only for a citing session that did not author it, and the receiving session performs its own trace: the grant is the operator's authorization in the expert session's transcript, and the plan enters the armed queue only by the operator's word or the expert's append under it.

## Goal

The operator returns to a long-running session after hours away, or is deciding whether it is safe to park one, and needs to know where it actually stands without steering it into new work. Plans persist for days or weeks and the operator does not carry their details; a session's own working understanding can also drift from the plan it serves, and nothing today makes that drift observable. When this plan is done, /recap is a kit skill: invoked, the session refreshes what is stale, restates its goal from working memory before re-reading the record, and reports in a fixed five-part shape without starting any new work.

## Evidence

- The source pattern, quoted to the expert seat by the operator from an Anthropic engineer's published account: with eight or more concurrent sessions, a /recap skill that refreshes stale context then reports the goal in the requester's words, actual standing with evidence (tests passing does not count as proven), person-blocked versus technically-blocked, and next steps marked by owner, with no new work permitted during a recap.
- Three of its four report parts already exist as kit machinery rather than needing invention: the goal lives in the plan doc's Goal and Dispatch Authorization; standing-with-evidence is the confirmed/inferred/reported marking plus the green-suite-is-necessary-not-sufficient rule; the blocked split and owner-marked next steps are the BLOCKED vocabulary and the board-recap rule's fourth part.
- The ordering lesson that makes the drift check real arrived through the same day's kaizen pass in another costume: a control derived from the instrument tests the instrument's mechanism and not its coverage. A goal restated after re-reading the doc is that control, a paraphrase that passes regardless of drift; only a restatement taken before the re-read can disagree with it.

## Standing Brief Amendments

- **Point at the owner; restate only what the reader cannot act without.** Two review rounds on section 1 each returned the same defect class at fresh sites: a sentence in this plan's deliverable restates a rule another kit file owns, and the restatement disagrees with its owner. The instances spanned the closed blocker set, the coordinator's status-round conditions and its two line bars, the park wake mechanism, the confirmed/inferred/reported triad, and a disclosure bar stated backwards. The generator is the section's own framing, which asks for report parts "mapped to the machinery that answers it", and mapping invites restatement. So the standing instruction for every dispatch under this plan is the writing-skills one-owner rule applied at the sentence: name the owning file and what it decides, and carry its words only where a reader cannot perform the step without them. Where a restatement is genuinely load-bearing, quote the owner rather than paraphrasing it, and cite the line. A paraphrase of a rule is a second copy of that rule with no pin holding the two together.
- **A named instrument is invocable or it is not named.** Where the deliverable tells a session to read something, it gives the command that reads it, not the name of a subcommand. A step a reader cannot perform is a step that does not exist.

## Sections of Work

### 1. The /recap skill

Model: opus

New skill at `plugins/claude-kit/skills/recap/SKILL.md`, user-invocable as /recap. Its body carries:

- The order, stated as load-bearing: first restate the goal and current focus from working memory, in the session's own words, before touching any file; then run the freshness pass; then report. The restatement is written into the report beside what the record says, and the fifth report line is the drift diff between them, usually "none" and load-bearing when it is not. The skill states why the order cannot be reversed: a restatement composed after the re-read is a paraphrase of the record and can no longer disagree with it, so it detects nothing.
- The freshness pass, budgeted: re-read the plan doc from disk including its latest Chapter, re-check git against origin, re-read any background run's marker or completion state, re-check the roster where peers are load-bearing to the report. The bound is re-read, never re-verify: no suites run, no reviews dispatch, no probes fire; a fact that would need a run to confirm is reported as unverified rather than verified during the recap.
- The five report parts, each mapped to the machinery that answers it: the goal in the words of whoever asked it, quoted from the plan doc's Goal or the dispatch, beside the session's own pre-read restatement; where things actually stand, every load-bearing claim marked confirmed, inferred, or reported with its evidence named, a green suite reported as a suite result and never as proof of behavior it does not exercise; what is blocked on a person versus on something technical, the person named by role and what they hold; next steps in order, each marked as the session's or the operator's; and the drift diff.
- The read-only bar, stated as an explicit override: the doctrine's act-on-found-work rule is suspended for the recap's duration, because a recap that starts fixing what it notices has destroyed the stable reading it was invoked for. Anything found rides in the report as a next step; the operator's follow-up, not the recap, is where it becomes work.
- The relation to neighbors, so neither gets "improved" into the other: the coordinator's status round is pulled, fleet-wide, one bounded line per session, where /recap is operator-invoked, one session, deep; and /recap is the instrument for deciding whether a session is safe to park, with /park (its companion plan) being the act.

Tests: none mechanical for the skill body; acceptance is the blind-reader dispatch over the finished skill plus the adversarial round checking each report part's mapping against the machinery it names.

Files in scope: `plugins/claude-kit/skills/recap/SKILL.md`.

### 2. The payload map enrolls the new skill

Model: opus
Locus: inline

The repository README carries a STRUCTURE block that maps the shipped payload directory by directory, and its `skills/` list is exhaustive: every skill the plugin ships has a line there. A skill added without its line leaves the marketplace README understating the payload, which is the carrier class the writing-skills amendment rule names. Add the `recap/` line in the block's existing shape, a directory name and a one-line description of what the skill is for, positioned so the list's own ordering still reads.

This section exists because section 1's review surfaced the omission and section 1's `Files in scope:` never listed the README. It is an out-of-scope surface appended as its own section rather than folded, the fold predicate failing on its directory leg.

Tests: none mechanical. Acceptance is that the block lists every directory under `plugins/claude-kit/skills/`, verified by diffing the block's names against that directory's contents.

Files in scope: `README.md`.

## Out of Scope

- Any automatic invocation: /recap is the operator's verb; a session recapping itself unprompted is ordinary close-with-the-state discipline and needs no skill.
- Fleet aggregation of recaps: that is the coordinator's board and status round, unchanged.

## Related

- `docs/plans/claude-kit_park-and-quiesce_spec_v1.md`: the companion authored the same day; /recap answers "is it safe to park," /park performs the parking.

## Chapters
### Chapter 1 - 2026-08-31
Completed: 1. The /recap skill
Implemented By: implementer-opus (build), implementer-opus (fix round), implementer-fable (tier escalation), main session (final fix round)
Metrics: review rounds 3; NEEDS_CONTEXT 0; escalations 1 (opus to fable); consults 0
Decisions / Surprises: three rounds, and the reason is one defect class rather than three. Rounds 1 and 2 each returned Criticals of a single shape, a sentence restating a rule another kit file owns whose restatement disagrees with its owner, at fresh sites each time: the closed blocker set, the coordinator's status-round conditions, the park wake mechanism, and a disclosure bar stated backwards. The escalation comparison the tier ladder requires was run before the bump and found the class repeating, which is the ladder's own discriminator pointing at the tier, so the bump was earned rather than assumed. It was also not sufficient on its own, and that is the entry worth keeping: the generator was the section's own framing, which asks for report parts "mapped to the machinery that answers it", and mapping invites restatement. The fix that held was the standing amendment written into this doc, changing the instruction from restate accurately to point at the owner and restate only what the reader cannot act without. The file got shorter, 56 to 65 lines across three rounds while gaining commands and fallbacks, because restatements became pointers. This skill ships without a reproduced RED/GREEN: writing-skills requires that a rule shipped without one records that it stands on the point-of-action rationale, and it does, no mechanical test being available for a skill body's prose.
Assumptions: the blind-reader persona is a session mid-plan holding the doctrine and nothing else about this file (route (b), declared 2026-08-31, section 1); the reviewer pair for the escalated round runs at fable per the reviewer-effort table's writer-tier cap rather than at the opus/max the first two rounds used (route (a), the executing-work table, 2026-08-31, section 1).
Review Findings: 2 Criticals in round 1, 2 in round 2, 0 in round 3, all addressed. Round 3's two Majors were the last of the class and both were fixed in the main thread: the background-marker bullet settled a run's death on the process list alone where the doctrine settles it on the process list plus the completion notification, which also produced a false line in the doctrine's own worktree-isolated fallback where no marker is written by design; and the two line bars were scoped by audience, exempting the relay reply, where their owner scopes them by what a line carries, so a relay-delivered report could put an absolute path's OS username onto Discord. The blind reader's own Major was the sharpest of the round and is fixed by subtraction: the file told a session to place itself against the bound session id, and nothing hands a session its own id from inside its own shell, so the step was removed rather than given an invented instrument, and the four readings that cannot establish the binding now share one safe delivery branch. Three Minors taken: the hook's "only" overstated its owner, which allows on indeterminate reads by design; the coordinator quote gained its paragraph anchor; and the parking pointer dropped a plan path that would dangle twice, once when the companion plan archives on delivery and always on installs where no such project path exists.
Gate: targeted lane, the five test files whose subject the changed files are (doctrine-parity, output-style-parity, pr-docs-guard, stop-docs-hygiene, readonly-agent-guard), 198 tests, 198 pass, 0 fail, exit code 0 read from the run itself rather than from a grep over its output. The whole gate is deferred rather than skipped: this machine's one heavy-process slot is held by a live foreign claim, and the contention is named rather than worked around.
Stamps: adjudicated 4, stamped 3 (test-suite-invocation and reading-a-running-suite in the project tier, box-duration-figures-need-a-co-measured-control in the operator tier); skipped neo-claude-standing-delegation-granted, nothing in this section touching a seat action.
Next: 2. The payload map enrolls the new skill
Commit Model: Commit-and-Push

### Chapter 2 - 2026-08-31
Completed: 2. The payload map enrolls the new skill
Implemented By: main session
Metrics: review rounds 0; NEEDS_CONTEXT 0; escalations 0; consults 0
Decisions / Surprises: this section exists because section 1's review found the README's STRUCTURE block understating the shipped payload, and the fold predicate failed on its directory leg, so it was appended as its own section rather than folded. That append is approval drift by construction and is recorded here as such. Under Commit-and-Push the append was named to the operator when it was made rather than only at the close, the push carrying no later human gate.
Assumptions: the block's ordering is positional rather than alphabetical, so the new line sits beside the other operator-invoked verbs rather than at the end (route (b), declared 2026-08-31, section 2).
Review Findings: none; the section is one line and its acceptance is mechanical.
Gate: no test enumerates the skills directory, so the block's completeness rests on no pin and the acceptance is the set-diff the section names: 25 directory names against 25 block names, empty in both directions. The check was earned rather than assumed, a first attempt's extraction predicate having returned zero names and read as a clean diff until the both-ways comparison exposed it, and the repaired predicate was then run against a copy of the block with recap deleted, which made it speak by printing recap. Because the predicate reads the directory listing rather than a hand-written list, that control is coverage evidence and not only an instrument check.
Stamps: none surfaced; the section's whole span sits inside Chapter 1's window, swept there.
Next: finishing-work
Commit Model: Commit-and-Push
