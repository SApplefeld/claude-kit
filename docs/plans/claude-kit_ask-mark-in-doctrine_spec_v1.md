# The doctrine names the `ASK:` mark for a reply that needs the operator

Status: Ready
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

**Rulings after the spec shipped.** None yet.

**Provenance.** Distilled from the architect persona's exchange with the operator on the seat's
relay thread, 2026-09-22, in the same design round that produced the discord-channels plan
`channels_judge-unmirrored-replies_spec_v1.md`.

## Approach

**One bullet, two copies.** The doctrine's source is
`plugins/claude-kit/skills/operating-instructions/SKILL.md` and its mirror is
`home/claude-kit-doctrine.md`; `test/doctrine-parity.test.js` pins the two byte-equal after the
source's frontmatter is stripped. The bullet that owns how a session puts a decision to the
operator is **Surface decisions in batches, each with a marked recommendation**, under How we
work. It ends today with "so nothing is re-asked." The new rule is appended to that bullet as two
sentences, so the bullet stays the one place a session reads for how to ask. The register core the
output style copies (`plugins/claude-kit/output-styles/kit.md`, between the
`KIT-REGISTER-CORE:BEGIN` and `END` markers) does not include this bullet, so the output style and
`test/output-style-parity.test.js` are untouched.

**The growth is declared.** The size ratchet (`test/size-ratchet.test.js` over
`test/size-budget.json`) measures prose in words, and the doctrine sits within a few words of its
cap in both copies. The section raises the two caps, `home/claude-kit-doctrine.md` and
`plugins/claude-kit/skills/operating-instructions/SKILL.md`, by exactly the words the two sentences
add, read from `node plugins/claude-kit/scripts/kit-size.js report` after the edit.

**The mark's shape is the broker's.** The broker reads a line whose first non-space characters
are exactly `ASK:`, uppercase with the colon, outside a fenced code block, and takes the rest of
that line as the item's excerpt. A blockquoted or bulleted `ASK:` and a lowercase `ask:` mark
nothing there. The doctrine sentence therefore says the line begins with `ASK:` and carries the ask
in one sentence, and says nothing about the broker's parser, which is the discord-channels
repository's to describe.

**The sweep.** The doctrine copies, the output style and the three parity and ratchet tests were
read for `ASK:` (`git grep -n "ASK:"` over the tree outside `docs/`): no kit surface names the
mark today, so no second surface has to agree with the new sentence.

## Sections of Work

### 1. The doctrine names the mark
Model: sonnet
In `plugins/claude-kit/skills/operating-instructions/SKILL.md`, the bullet **Surface decisions in
batches, each with a marked recommendation** gains, after its last sentence "so nothing is
re-asked.", these two sentences: "On the relay thread, a reply that hands me a decision, a
question, or an act only I can perform opens with a line beginning `ASK:` and the ask in one
sentence. That line is the mark the broker's inbox card lists until I answer, and a reply without
it reaches the card only where a classifier reads it as an ask, which it can miss." The same two
sentences land in the same bullet of `home/claude-kit-doctrine.md`. `test/size-budget.json` raises
the caps for both files by the words added, read from the size report after the edit and not
guessed. Acceptance: `node --test test/doctrine-parity.test.js test/size-ratchet.test.js
test/output-style-parity.test.js` exits 0; `node plugins/claude-kit/scripts/kit-size.js check`
exits 0; `git diff --stat` touches exactly three files; `git grep -n "ASK:" --
plugins/claude-kit/skills/operating-instructions/SKILL.md home/claude-kit-doctrine.md` returns two
lines, one per copy, both in the batches bullet; `git grep -c "ASK:" --
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
  than in a skill; reversal: move two sentences.
- assumed 2026-09-22 (default): the home is the batches bullet rather than the register bullet,
  because the batches bullet sits outside the output style's pinned core; reversal: move the two
  sentences and sync the core.
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

