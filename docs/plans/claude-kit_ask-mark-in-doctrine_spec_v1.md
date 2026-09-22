# The doctrine names the `ASK:` mark for a reply that needs the operator

Status: In Progress
Commit Model: Branch-and-PR
Created: 2026-09-22

Session model: the kit worker persona, on the steward's handoff by name; one section at sonnet.
Authored by the architect persona on ASR-CLAUDE. Every anchor resolves at trunk `f480fb39` and is
found by content rather than by line number.

## Dispatch Authorization

The operator asked for this on the architect persona's relay thread on 2026-09-22, in these
words: "I agree, this should be a small doctrine edit to indicate using "ASK:" when there is a
question, but that only helps interactive sessions." He approved the architect's sketch, which
named this plan as a separate claude-kit plan, with "Please proceed!" the same day. The plan is
scheduled through the coordinator persona for the kit worker, so the grant covers the session that
persona's queue assigns and no other.

## Goal

A session steered over the Discord relay opens any reply that hands the operator a decision, a
question or an act only he can perform with a line beginning `ASK:`, because the doctrine tells it
to. The Discord broker's operator inbox lists such a reply on its `Fleet: Inbox` card, with the
ask's own words, until the operator answers that session. A reply without the mark reaches the
card only where a classifier reads it as an ask, and a classifier can miss. It matters because the
operator reads the fleet from a phone and the card is the one place that lists who is waiting on
him.

## Intent

**The frame, in the operator's words.** "I agree, this should be a small doctrine edit to indicate
using "ASK:" when there is a question, but that only helps interactive sessions."

**What done needs to do.** Add the rule to the doctrine once, in the bullet that already governs
how a session puts a decision to the operator, and carry it to the doctrine's mirror copy. Pay for
the growth in the size budget. Leave every parity pin green.

**What done does not need to do.** It does not need to change the register core the output style
pins, since the bullet it extends sits outside that core. It does not need to change the broker,
the relay's server instructions or the persona plugin, which are the discord-channels repository's
own plan. It does not need a new skill, a hook or a check that a reply carries the mark.

**Alternatives refused.**
- Putting the sentence in the client-briefing register bullet: refused, because that bullet sits
  inside the register core the output style copies byte for byte, which would make a three-file
  change of a one-sentence rule.
- A hook that scans a reply-tool call for the mark: refused, because the broker's classifier is
  already the backstop for a reply that forgets, and a check no requirement names is not written.

**Rulings after the spec shipped.** 2026-09-22, at section 1's review: the trigger is a reply whose
work waits on the operator, for an answer or for an act only he can perform, and a reply that only
reports and waits on nothing takes no mark however many steps it lists for him. The Goal's broader
phrasing, "any reply that hands the operator a decision, a question or an act only he can perform",
is read through the Goal's own purpose clause, that the card "is the one place that lists who is
waiting on him". Marking a close-out that waits on nothing fills the card with items that never
clear, which defeats that purpose. The rule also states that it never replaces a mandated
`BLOCKED:` or `WAITING:` lead, because the Stop hook screens the turn-end message's first
characters and the broker posts that same message as the thread's reply.

2026-09-22, at section 1's third review round, on a consultant ruling: the rule leaves the batches
bullet and takes a bullet of its own, directly after the client-briefing register bullet. This
supersedes the "What done needs to do" clause "in the bullet that already governs how a session
puts a decision to the operator", which was written for a two-sentence rule that three review
rounds grew to eight. Two facts decided it. The batches bullet is about decisions, and a
decisions-only frame is what dropped the act class the Goal names and earned round 2's Critical.
And the ledger entry `c1.C063` removed an ordering rule from that bullet once, for fixing an order
the register bullet orders differently; a lead line ahead of a brief is not that, which the
`BLOCKED:` lead already demonstrates, but the shadow is answered in the bullet's own words rather
than left for the next reader. The output style and its parity pin stay out of scope: the pin is a
closed list of the eight leads the style itself carries, so a ninth doctrine bullet is inert to
it, confirmed by running the lane rather than by reading the test. Reversal: move the bullet's
sentences back onto the batches bullet and re-sync the two caps.

**Provenance.** Distilled from the architect persona's exchange with the operator on the seat's
relay thread, 2026-09-22, in the same design round that produced the discord-channels plan
`channels_judge-unmirrored-replies_spec_v1.md`.

## Approach

**One new bullet, two copies.** The doctrine's source is
`plugins/claude-kit/skills/operating-instructions/SKILL.md` and its mirror is
`home/claude-kit-doctrine.md`; `test/doctrine-parity.test.js` pins the two byte-equal after the
source's frontmatter is stripped. The rule lands as a bullet of its own, directly after the
client-briefing register bullet and before **Nothing untrue ships**, on the ruling recorded under
`## Intent`. The batches bullet, which governs how a session puts a decision to the operator, is
left as it stands and keeps deferring each ask's internal shape to the register bullet. The
register core the output style copies (`plugins/claude-kit/output-styles/kit.md`, between the
`KIT-REGISTER-CORE:BEGIN` and `END` markers) does not include this bullet, so the output style and
`test/output-style-parity.test.js` are untouched.

**The growth is declared.** The size ratchet (`test/size-ratchet.test.js` over
`test/size-budget.json`) measures prose in words, and the doctrine sits within a few words of its
cap in both copies. The section raises the two caps, `home/claude-kit-doctrine.md` and
`plugins/claude-kit/skills/operating-instructions/SKILL.md`, to the sizes the two files measure
after the edit, read from `node plugins/claude-kit/scripts/kit-size.js report` and not guessed.

**The mark's shape is the broker's.** The broker reads a line whose first non-space characters
are exactly `ASK:`, uppercase with the colon, outside a fenced code block, and takes the rest of
that line as the item's excerpt. A blockquoted or bulleted `ASK:` and a lowercase `ask:` mark
nothing there. The doctrine sentence therefore says the line begins with `ASK:` and carries the ask
in one sentence, and says nothing about the broker's parser, which is the discord-channels
repository's to describe.

**The sweep.** The doctrine copies, the output style and the three parity and ratchet tests were
read for `ASK:` (`git grep -n "ASK:"` over the tree outside `docs/`): no kit surface names the
mark today. That predicate finds only a surface already carrying the literal, so it clears the
literal rather than the class. A surface that states the shape of an operator-facing message
without naming the mark is invisible to it, and section 1's review found one, the `executing-work`
skill's stop-message paragraphs, now carried in `docs/backlog.md`.

## Sections of Work

### 1. The doctrine names the mark
Model: sonnet
In `plugins/claude-kit/skills/operating-instructions/SKILL.md`, a new bullet lands directly after
the **Write every decision ask to the client-briefing register** bullet and directly before
**Nothing untrue ships**, reading: "- **On the relay thread, a reply that waits on me carries an
`ASK:` line.** A reply whose session cannot take its next step until I answer or act opens with a
line beginning `ASK:`. That line names, in one sentence, the answer or the act it waits for. It
stands as a line of its own, not bulleted, not quoted, and not inside a code fence. The line is a
mark ahead of the message rather than a part of the ask. The brief under it keeps the shape the
register bullet above fixes. The rule covers every message the session sends to the thread, the
turn-end message and a reply-tool message alike. Where another rule fixes the message's first
characters, as the `BLOCKED:` and `WAITING:` leads do, that lead keeps the top. The `ASK:` line
then comes directly under it and restates the ask in its own words. A reply that only reports and
waits on nothing, a close-out status among them, takes no mark, however many steps it lists for
me." The
same bullet lands in the same position in `home/claude-kit-doctrine.md`. The batches bullet is
left as it stands, ending at "so nothing is re-asked."
`test/size-budget.json` raises the caps for both files to the measured sizes, read from the size
report after the edit and not guessed. Acceptance: `node --test test/doctrine-parity.test.js test/size-ratchet.test.js
test/output-style-parity.test.js` exits 0; `node plugins/claude-kit/scripts/kit-size.js check`
exits 0; `git diff --stat` over the three files in scope touches exactly those three, and nothing
outside `docs/` changes beyond them; `git grep -n "ASK:" --
plugins/claude-kit/skills/operating-instructions/SKILL.md home/claude-kit-doctrine.md` returns two
lines, one per copy, both in the new bullet; `git grep -c "ASK:" --
plugins/claude-kit/output-styles/kit.md` returns nothing, since the output style does not change.
Files in scope: `plugins/claude-kit/skills/operating-instructions/SKILL.md`,
`home/claude-kit-doctrine.md`, `test/size-budget.json`.

## Out of Scope

- The register core in the output style and `test/output-style-parity.test.js`.
- The broker, the relay's server instructions and the persona plugin, which
  `channels_judge-unmirrored-replies_spec_v1.md` in the discord-channels repository covers.
- Any hook, skill or check that reads a reply for the mark.
- The installed doctrine copy under the operator's home directory, which the doctrine refresh
  hook and the doctor carry from the mirror on their own schedule.

The list is closed at these four items.

## Assumptions

- assumed 2026-09-22 (operator ruling on the sketch): the sentence lives in the doctrine rather
  than in a skill; reversal: move the bullet.
- assumed 2026-09-22 (default), reversed 2026-09-22 at section 1's consult: the home was the
  batches bullet rather than the register bullet, because the batches bullet sits outside the
  output style's pinned core. The rule now has a bullet of its own after the register bullet,
  which the pin does not reach either, confirmed by running the lane. Reversal: move the bullet's
  sentences back onto the batches bullet and re-sync the two caps.
- assumed 2026-09-22 (default): the growth is paid by raising the two caps rather than trimming
  elsewhere; reversal: trim the same number of words from the doctrine and leave the caps.
- assumed 2026-09-22 (default): this one-section spec skips the blind read, the gating litmus and
  the plan review, per the brainstorming skill's allowance for a trivial spec; reversal: run them
  before the worker takes it.

## Operator Verification

- Read the next reply an interactive session sends you over Discord that hands you a decision.
  An `ASK:` line at its top, drawn with its excerpt on the `Fleet: Inbox` card, confirms the
  sentence reached the session; its absence on a session started after the kit update installed
  reopens section 1.

## Open Questions

None.

## Related

- Pairs with `channels_judge-unmirrored-replies_spec_v1.md` in the discord-channels repository,
  which has the broker's judge read every unmarked reply and the relay's own instructions name
  the mark for sessions that do not load the kit.

## Chapters

### Chapter 1 - 2026-09-22
Completed: 1. The doctrine names the mark
Implemented By: implementer-sonnet for the first landing; the main session for the four fix rounds and the placement move, inline, after the consult ruled; resumed and closed by a fresh DEV-PLUGIN session after a fleet restart cut the first one off at round 4's author re-read.
Metrics: review rounds 4, closed major-closed; provenance 4 spec-traceable, 15 fix-introduced, 1 new-requirement, rulings (1 refused, 0 declared, 0 asked); advisory: 0 findings, 0 fixed, 0 deferred, 0 refused; NEEDS_CONTEXT 0; escalations none; consults 1. The provenance split for rounds 1 to 3 is reconstructed from the first session's transcript, which recorded counts per round rather than a value per finding: round 1's four Majors traced to the spec's own wording, and every surviving Critical and Major in rounds 2 to 4 sat in lines a fix round wrote.
Decisions / Surprises:
- Section 1 open. Changes: appends a rule to the doctrine's batches bullet in both copies and raises two size caps. Serves: the Goal sentence "A session steered over the Discord relay opens any reply that hands the operator a decision, a question or an act only he can perform with a line beginning ASK:, because the doctrine tells it to." Adds a mechanism: no, nothing new runs; the sentence is read by a session, and the matcher that reads the mark lives in another repository. Size: 66 words at first landing, 86 after the fix round, across two byte-identical copies. Cost of not building: the operator's inbox card lists a waiting session only where the broker's classifier infers an ask, and a classifier can miss.
- Round 1 fix, the four converging Majors. Changes: replaces the two specified sentences with four, narrowing the trigger from "hands me a decision, a question, or an act only I can perform" to "cannot move without my answer", excluding a close-out or board recap that only lists the operator's later steps, and stating the mark's precedence under a mandated BLOCKED: or WAITING: lead. Serves: the same Goal sentence, and the Goal's purpose clause "the card is the one place that lists who is waiting on him", which the original trigger defeated by filling the card with unanswerable items. Adds a mechanism: no; the rewrite narrows a rule's scope and states a precedence between two marks that both already exist, and nothing new runs. Size: two sentences become four, 66 words to 86, no branch and no state. Cost of not building: a leashed session's BLOCKED declaration cannot obey both rules at once, since the Stop hook screens the message's first characters, and every routine close-out that lists the operator's steps would have to carry the mark.
- Round 2 fix, one Critical and six standing Majors. Changes: rewrites the rule a second time. The trigger becomes "a reply whose work waits on me", which restores the act class the first rewrite dropped. The exclusion becomes "a reply that only reports, and waits on nothing", which stops ruling on the close-out and the board recap, moments other bullets own, and instead defines what an ask is. "Carries" becomes "opens with", so the line cannot be buried. "A leashed run mandates" becomes "a mandated lead", since the WAITING: lead is mandated with no leash qualifier. The line is "plain", which excludes the bulleted form the broker's matcher ignores. The line "restates the ask", which answers what it carries when a BLOCKED: lead already names the need. The spec's Approach, its two Assumptions reversals, its acceptance criterion and its Intent ruling slot are updated to match. Serves: the Goal sentence and its purpose clause "the card is the one place that lists who is waiting on him", read together as the recorded ruling reads them. Adds a mechanism: no; every change narrows, widens or re-points an existing sentence, and nothing new runs. Size: 86 words to 73, caps 11032 down to 11019. Cost of not building: the rule would exclude the act class the Goal names, misstate where the WAITING: mandate comes from, allow the mark to be buried mid-reply, and leave the spec describing a two-sentence design that no longer exists.
- Round 3 fix, five Majors and a consult. Changes: moves the rule out of the batches bullet into a bullet of its own, directly after the client-briefing register bullet, and rewrites it to the consultant's eight sentences. The trigger becomes "whose work cannot go on or finish until I answer or act". The artifact is named: every message of the session's that reaches the thread. The carve-out is stated by mechanism, "where another rule fixes the message's first characters", with BLOCKED: and WAITING: as instances, so the close-out status's own opener is covered. "Plain" becomes the three shapes the broker rejects. The close-out exemption moves into the trigger rather than ruling on the close-out. Serves: the Goal sentence and its purpose clause, and the Intent's "Add the rule to the doctrine once", which the ruling supersedes in its placement half and honours in its once half. Adds a mechanism: no; a doctrine bullet is prose and nothing new runs. Size: 73 words to 172, caps 11019 to 11118. Cost of not building: the rule would keep colliding with a neighbour each round, having collided with a different one in each of the three so far.
- Consult, 2026-09-22, the consultant at fable and high effort through the Agent tool. Convened on trigger (a), a second failed attempt at the same problem with no Critical class repeating, which the tier-escalation ladder routes to a premise consult rather than a tier bump. Question: where the rule belongs, which artifact it governs, and how it should state its relationship to the mandated openers. Ruling adopted whole. What I checked on my own surface rather than adopting: its claim that the output-style parity pin is a closed list of the style's own leads, so a ninth doctrine bullet is inert to it. Confirmed by running the lane with the new bullet in place, 186 pass 0 fail exit 0, rather than by reading the test. What I discarded: nothing. Its one stated uncertainty, whether any close-out status ever waits on the operator, is marked inferred in its own return and does not change the landed wording, since the trigger disposes of a close-out either way.
- Round 4 fix, three Majors fixed and one design stop. Changes: rescopes the trigger from "whose work cannot go on or finish" to "whose session cannot take its next step", which removes the conflict between the bullet's trigger and its close-out carve-out; splits the 27-word sentence and repairs the double genitive and the three-item correlative; rewrites the spec's stale Approach sentences, its quoted bullet and Assumption 1's reversal; re-points both backlog entries at the new bullet by its lead and restores "answers or acts". Serves: the Goal sentence and its purpose clause. Adds a mechanism: no for the three fixed Majors, all of them prose. The fourth Major proposed a disclosure bar on the ASK: line's content, which is a guard no Goal sentence, Intent clause or acceptance bullet names, so it took the design stop; the scope adjudicator refused it on a form ground and it is routed to docs/backlog.md. Size: 172 words to 174, caps 11118 to 11120. Cost of not building: the bullet would contradict itself on a Branch-and-PR close-out, and three records would point a future repair at a bullet that carries nothing about the mark.
- The approved spec's quoted wording and placement both changed during execution, and the plan doc records it as approval drift. The section body, the Approach, Assumptions 1 and 2 and the Intent's "Rulings after the spec shipped" slot were rewritten inside the approval-scoped region to describe what landed. Every such edit traces to a round's adjudication or to the consult's ruling above, and the operator can reverse the placement by moving the bullet's sentences back onto the batches bullet and re-syncing the two caps.
- The design stop is the first real instance of a guard the kit would require at a boundary the plan never names being stopped, which the operator-tier memory `a-kit-required-guard-does-not-name-a-mechanism-at-the-design-stop` says reopens its ruling and goes to the operator. It is carried to the operator in this session's close-out rather than held here, since it asks nothing of this section.
- Probe pair: not run. The section's doctrine delta against its base `b78a3d9e` is one inserted bullet and changes no existing passage. The two probe scenarios that mention the relay thread, `merged-plan-branch-delete-on-an-armed-run` and `spec-self-review-finished-before-arming`, mention it as setting, and neither decision turns on a reply's opening line. This is recorded as no scenario turning on the change, not as a clean reading.
Assumptions: none recorded during execution beyond the approval drift above.
Review Findings: design stop: a content bar on the `ASK:` line, ruling refuse by the scope-adjudicator (fable, Agent tool), routed to `docs/backlog.md`. review: round 1 adversarial and blind at opus, Workflow at high; round 2 adversarial at opus, Workflow at high, one tier above the sonnet writer where the round rule's writer tier would have set sonnet; round 3 adversarial and blind at opus, Workflow at high, re-raised by round 2's Critical; round 4 adversarial at opus, Workflow at high. Critical addressed: round 2's, an act is not an answer, fixed by the round 2 rewrite. Majors addressed: round 1's four, round 2's six standing, round 3's five, round 4's three fixed; round 2's turn-end conflation Major refuted at the source, `broker/routing/outbound.ts:62` and `:1345` in the discord-channels repository showing the turn-end message is posted as the thread's reply; round 4's disclosure Major justified-not-fixed on the design stop's refuse and routed. Minors: 14 fixed across the rounds, 1 upgraded on a stated consequence (a doctrine must not assert another repository's behaviour), 9 left with the reason, one of them resolved by the landed trigger, and 4 routed to `docs/backlog.md` as the two entries they share, all recorded in `.kit/scratch/ask-mark/minors-section-1.md` and below. Round 4's Minors left: a `WAITING:` dispatch wait takes no mark, because it waits on a subagent and not on the operator; the broker withholding a lineage worker's marked ask and its 200-code-point excerpt cut are the broker's, which the Out of Scope list keeps out. Close pass: three defects in the routed backlog entries fixed, a doubled "the doctrine bullet", an example path that had lost its backslashes, and blank lines splitting the entries' group, and the close pass's delta and round 4's prose-only delta took the author re-read of the landed bullet against the Goal sentence, recorded here as an author re-read rather than a round.
Stamps: adjudicated 3, stamped 1 (`line-endings-are-governed-by-autocrlf`, which set the per-file line-ending handling in every scripted edit here). Skipped `a-trace-target-you-composed-cannot-check-your-own-work` and `subagent-can-report-a-documented-past-injection-as-a-live-one`, neither of which changed what was built. The first session stamped the design-stop memory applied before the restart; it is absent from the unstamped list.
Gate: targeted lane `node --test test/doctrine-parity.test.js test/size-ratchet.test.js test/output-style-parity.test.js`, 186 tests, 186 pass, 0 fail, exit 0, wall 39s, measured 2026-09-22 13:32 -0400 on SCOTT-CLAUDE in the `ask-mark-exec` worktree at `ce931610` plus this section's five uncommitted files, with no foreign test runner in the process list; baseline 186/186/0 on the same lane at first green, so no delta. `kit-size.js check` exit 0. Acceptance greps: `ASK:` returns one line in each doctrine copy, both in the new bullet, and the two bullet lines are byte-identical; `git grep -c "ASK:" -- plugins/claude-kit/output-styles/kit.md` returns nothing, exit 1. Em-dash sweep of the bullet: 0, with a control that spoke (1 in `kaizen/notes-ASR-CLAUDE.md`). Test delta: none added, none retired, none edited; 0 spawning tests.
Next: finishing-work
Commit Model: Branch-and-PR
Delta: measured 2026-09-22 13:33 -0400 on SCOTT-CLAUDE, worktree `ask-mark-exec` against HEAD `ce931610`, no foreign runner live.
```
repository: ask-mark-exec
home/claude-kit-doctrine.md: 11120 words, cap 11120, +2
plugins/claude-kit/skills/operating-instructions/SKILL.md: 11120 words, cap 11120, +2
words: 917845 of cap 917906 across 87 curated files
test lines: 128992 of cap 128992 across 68 test files
tests: 3716
changed paths under no measured root: 2 (2 differing from HEAD, 0 untracked), which this tool does not measure and which no row above names; named-exclusion paths in the changeset: test/size-budget.json, which a root holds and no shape measures, so no row above names them
```

