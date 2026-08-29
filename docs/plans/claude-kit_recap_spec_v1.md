# A session reports where it actually stands, restating its goal before it re-reads it

Status: Ready
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

## Out of Scope

- Any automatic invocation: /recap is the operator's verb; a session recapping itself unprompted is ordinary close-with-the-state discipline and needs no skill.
- Fleet aggregation of recaps: that is the coordinator's board and status round, unchanged.

## Related

- `docs/plans/claude-kit_park-and-quiesce_spec_v1.md`: the companion authored the same day; /recap answers "is it safe to park," /park performs the parking.

## Chapters
