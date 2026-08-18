# Standing Watch: A Skill for Watching a Live System, and the Doctrine Lines the Watch Paid For

Status: Approved
Commit Model: Commit-and-Push
Created: 2026-08-18

## Related

- `../archive/claude-kit_intake-gap-check_spec_v1.md`: complete. Added the intake gap check to the doctrine and the assumption-declaration surfaces to brainstorming, executing-work, and finishing-work. It edits the same doctrine sources and the same `executing-work` skill this plan does, and it runs first.

- `D:\ai-os\.kit\distill-handoff\DISTILLATION.md` (gitignored working artifact in the AI OS repo): the
  2026-08-18 distillation of the NEO babysitter ledger, forty-one passes of an attended watch over a live
  engine, whose kit-side clusters (items 10 through 14) this plan carries. The engine-side clusters became
  three plans in that repo (`ai-os-advisory-rulings_spec_v1.md`, `ai-os-watch-loop-friction_spec_v1.md`,
  `ai-os-clone-hygiene_spec_v1.md`). The distillation quotes the ledger by tick number; this plan quotes only
  what a section needs.
- `D:\ai-os\docs\neo-babysitter-runbook.md`: the project-specific runbook the new skill generalizes. It stays
  in that repo and is out of this plan's scope; once the skill ships, a one-line follow-up there can point
  at the skill for the mechanics and keep only the NEO-specific checks.
- `skills/writing-skills/SKILL.md`: owns how a skill is written and gated (RED/GREEN in a fresh headless
  session, one owner per rule, description states the trigger). Sections 1 and 2 are behavior-shaping prose
  and run under it.
- `skills/curating-docs/SKILL.md`, "The header is a machine contract": the plan-doc shape this file honors.
- `test/doctrine-parity.test.js` and `test/output-style-parity.test.js`: the gates that hold
  `home/claude-kit-doctrine.md` and the output style's core byte-identical to
  `skills/operating-instructions/SKILL.md`. Section 2 edits the source and syncs both mirrors in the same
  changeset.

## Goal

An attended session that watches a live system it does not own (wakes on a timer or an operator message,
reads the system's own state, intervenes, writes a ledger, sleeps) is a distinct kind of work with distinct
failure modes, and the kit has no skill for it. Forty-one passes of one such loop show the shape of those
failures: the loop's own notes went stale and were then obeyed as fact (a wrong standing line nearly closed
an advisory permanently; five self-armed wake prompts had to be re-armed for claims a later finding made
false); a true engine value was reported against the wrong subject a dozen times; a neighbouring measurement
stood in for one that was down; a healthy agent was nearly killed on filesystem silence; a foreign test host
crashed a suite; and a permission audit asked one question when it needed two. When this plan is done, the
kit carries one skill that owns the watch-loop discipline (the ledger's shape, the tick order, the wake
mechanics, the ping template with figure provenance, and the one-way-door preflight), the doctrine carries
the four environment and verification lines every session needs whether or not it is watching anything, and
the security reviewer and dispatch brief carry the two-question audit for any shell-command grant.

## Approach

**One new skill, not five.** Items 10, 11 (its ledger half), 12 (its watch half) and 14 of the distillation
are one discipline seen from four sides: state that outlives the context that wrote it. `writing-skills`'
own bar is that a new skill must beat one more paragraph in an existing skill; this one does, because no
existing skill's trigger is "you are watching a system", and the rules that follow from it (re-derive
before obeying, supersede in place, arm the wake first, dedup the ping) have no other home. The skill is
named `standing-watch`. Its description states the trigger (a loop, a runbook, a ledger, `/loop`, a
babysitter or watch session) and stops.

**The doctrine takes only what every session needs.** Four lines earned their place across the forty-one
passes and none of them is watch-specific: `SendMessage` is the discriminating liveness probe for a
dispatched agent, and it runs before any kill; "one heavy process at a time" is per machine, so a foreign
`testhost` or `dotnet` is checked for before a suite; a background task's completion notification reports
the wrapper's exit, so the run's own exit is read from a captured marker; and when the endpoint that would
answer is down, the answer is "cannot measure", never a neighbouring endpoint's number. The first three
land in **Environment and tooling discipline** beside the existing build-sequencing bullet; the fourth lands
in **Verify before you claim** beside "mark every load-bearing claim". One more line goes into **Before you
send**: "Does every figure or state in this message name its source (row, column, scan cycle) and its
subject?" That list sits inside the register core that the output style mirrors byte-for-byte, so the edit
is a three-file sync (skill source, home mirror, output style core) and the two parity tests are the gate.
Every doctrine line states the lesson, not the incident, one level more general than what taught it, per
the doctrine's own kaizen rule.

**The two-question grant audit goes where a grant is judged.** The security reviewer's checklist gains it,
and the executing-work Dispatch Brief gains a conditional slot: when a section composes or widens a
permission grant of any kind, the brief carries both questions. One owner (the security reviewer holds the
rule; the brief slot is a pointer at its point of action), per writing-skills.

**Gates.** The kit's code gate is `node --test test/` from the repository root (every test file under
`test/`); the prose gate for sections 1 and 2 is writing-skills' RED/GREEN in a fresh headless session
(`claude -p`), never a subagent of the editing session, with the doctrine's contaminated-RED caveat
recorded where it applies. Section 3 is a checklist addition and takes the lighter bar writing-skills gives a
structural slot.

## Sections of Work

### 1. The `standing-watch` skill

Model: opus

New `plugins/claude-kit/skills/standing-watch/SKILL.md`, in the kit's voice, quoted frontmatter, description
as trigger only. Body, in this order, each rule owned here and pointed at from nowhere else:

- **What a watch is, and the two artifacts.** A runbook (the procedure, committed, project-specific) and a
  ledger (the state, gitignored under `.kit/`, rewritten in place). Nothing the loop needs lives only in
  its context: finish the tick, write the ledger, then arm the wake.
- **The ledger's shape, and the rule that keeps it honest.** Two kinds of content, kept in separate
  sections: *standing* (prohibitions, mechanisms confirmed in source, do-not-reopen traps) and *situational*
  (the board as of the last pass, open interventions, recent pings, the quiet streak). Every situational
  sentence carries the time of the evidence behind it and the command that re-derives it. Supersede in
  place; never stack a new baseline on an old one. A read protocol at the top says what a constrained pass
  reads and in what order. Prune on a quiet tick: move superseded history to a dated archive byte-identical
  (hash-verified at the destination), keep the do-not-reopen traps live, and re-derive section offsets after
  the last edit, not before.
- **The tick order.** On a restart, arm the wake first, before any check (session-only timers die with the
  session). Then re-derive the board from the system's own source of truth, never from the ledger, the
  handoff, or the wake prompt's situation text: those are hints with a timestamp. Then, for every standing
  DO or DO-NOT that cites a condition, re-measure the condition before obeying it, and re-read the governing
  document (a plan doc outranks the ledger for a plan's gate; the ledger line was true when written and the
  plan changed under it). Then act, write, arm, sleep.
- **Wake mechanics.** A self-authored wake prompt carries the standing prohibitions and a pointer to the
  ledger, never a situation report (the prohibitions age well; the situation does not, and a known-stale
  armed instruction is worse than none because it will be followed). Check the timer list against the clock
  before assuming pacing is covered: a one-shot whose time elapsed during a long pass is stale, not pending,
  and fires the instant the pass ends. Timers fire only while the session is idle, so a long attended turn
  defers the heartbeat; that is expected. A static board gets the heartbeat only; an active one gets a
  one-shot 15 to 60 minutes out.
- **The ping template.** Dedup key per condition; never re-send a pending ask, and a correction is labelled
  as one and sent only when it changes the shape of the operator's decision. Every figure or state names its
  source (row, column, scan cycle) and its subject on an evidence line, and any measurement whose source was
  down is written "cannot measure". Corrections to earlier claims lead the message. The escalation bar and
  the client-briefing register are the doctrine's; point at them.
- **The one-way-door preflight.** Before any closure, dismissal, delete, or resume on the watched system,
  name in one sentence what will act on the thing afterward; if the answer is "the mechanism this closure
  removes", do not close it. Before killing a dispatched agent, probe it with a message; silence on the
  filesystem is an absence of signal, not a signal.
- **What done looks like.** A quiet streak long enough that the operator retires the loop, and a distilled
  list of what the interventions taught, split into what the system should do itself and what the kit
  should stop the agent doing. The ledger is the raw material for that list; write it so it can be distilled.

Close every enumeration with its class. Register the skill wherever the kit lists skills (check
`docs/architecture.md`'s skill inventory and any test that pins the skill set; `test/` will say). Run the
writing-skills RED/GREEN for at least the two rules most likely to be skipped under pressure (re-derive
before obeying; probe before kill), in a fresh headless session, and record the transcripts' verdicts in the
Chapter.

Files in scope: `plugins/claude-kit/skills/standing-watch/SKILL.md` (new), `docs/architecture.md` (skill
inventory line), any skill-set pin under `test/`.

Acceptance:
- The skill exists with quoted frontmatter and a trigger-only description; `node --test test/` is green.
- Each rule above is stated once, here, and no other skill restates it (grep the key phrases).
- RED/GREEN recorded for the two named rules, with the fresh-session caveat honored.
- `docs/architecture.md` names the skill in its inventory in the same register as its neighbours.

### 2. Four doctrine lines and one Before-you-send question, synced across the three copies

Model: opus

Edit `plugins/claude-kit/skills/operating-instructions/SKILL.md` and mirror to `home/claude-kit-doctrine.md`
and, for the Before-you-send line, the output style's register core (`plugins/claude-kit/output-styles/`),
so `test/doctrine-parity.test.js` and `test/output-style-parity.test.js` stay green:

- **Environment and tooling discipline**, beside "Sequence the build and the suites": (a) "One heavy process
  at a time is per machine, not per directory: memory is what the rule protects, so before a suite check for
  a foreign `testhost`/`dotnet`/build owned by another session or an engine, and wait or name the contention;
  a run that crashes at a fraction of its total is contention, not a result." (b) "A background task's
  completion notification reports the wrapper's exit, not the run's; read the run's exit from a marker it
  wrote itself." (c) "Before killing a dispatched agent on a stall signal, probe it with a message: a wedged
  agent cannot answer, a starved one answers at once, and the two look identical from the filesystem."
- **Verify before you claim**, beside "Mark every load-bearing claim": "When the endpoint or artifact that
  would answer your question is down or unreadable, the answer is 'cannot measure', never a neighbouring
  endpoint's number presented as the measurement; and a count read out of a prose summary is an inference
  until the artifact it summarizes is read."
- **Before you send**, one new question in the list: "Does every figure or state in this message name its
  source (row, column, scan cycle) and its subject?"

Wording is the implementer's within those meanings; keep the doctrine's voice, no em dashes, lesson not
incident. The output-style parity test pins the core as a closed set in a fixed order, so the new question
is inserted at the same position in all three files. Run the writing-skills probe for the probe-before-kill
line in a fresh headless session; if its RED does not reproduce (doctrine-adjacent contamination), record
that it stands on point-of-action rationale, per writing-skills.

Files in scope: `plugins/claude-kit/skills/operating-instructions/SKILL.md`, `home/claude-kit-doctrine.md`,
the output style file under `plugins/claude-kit/output-styles/`.

Acceptance:
- Both parity tests green; `node --test test/` green.
- The five additions present in the source and mirrored exactly where each parity test looks.
- One RED/GREEN record in the Chapter for the probe-before-kill line, or the stated rationale if RED did not
  reproduce.

### 3. The two-question grant audit, in the security reviewer and the dispatch brief

Model: sonnet

`plugins/claude-kit/agents/security-reviewer.md`: add to its checklist a rule owned there: for any
shell-command allow rule or grant a change composes or widens (`Bash(<prefix>:*)`-shaped rules and their
equivalents), ask two independent questions and flag a grant that passes only the first: does the verb
mutate its target; and can the verb write a file, or reach the network, while reading (flag options like
`--output=<path>` on read verbs, and any verb with a mutating flag form). State the matcher fact the audit
stands on: a rule matches leading text on whole-token boundaries and grants the whole tail after the pinned
prefix, and a deny rule matches the same way, so a deny binds a flag only at the front of the tail and the flag
escapes it by moving; the verb list is the enforcement point. Name the operator-tier memory `claude-code-bash-rule-token-matching` as the
measured record. `plugins/claude-kit/skills/executing-work/SKILL.md`, the Dispatch Brief template: one
conditional slot, "[grant-composing section] the two-question grant audit from the security reviewer's
checklist, verbatim", pointing at the reviewer as the owner.

Files in scope: `plugins/claude-kit/agents/security-reviewer.md`, `plugins/claude-kit/skills/executing-work/SKILL.md`.

Acceptance:
- The reviewer's checklist carries the rule once; the brief template carries the pointer slot; grep finds
  the key phrase in exactly those two files.
- `node --test test/` green (the hook canary and any pin over agent files).

## Verification

`node --test test/` green from the repository root, and the two RED/GREEN records (section 1's two rules,
section 2's one line) in the Chapters. Nothing here has an operator-only check.

## Out of Scope

- `D:\ai-os\docs\neo-babysitter-runbook.md` (another repo; a follow-up there points at the skill).
- The `/loop` command itself (harness-owned); the skill documents how a watch uses it.
- Any change to the memory-system skill or `memq`; the ledger is not a memory tier.
- A hook that enforces any of these mechanically. Each is a judgment rule; writing-skills says automate the
  mechanical ones and reserve skills for judgment, and none of these has a regex.

## Operator Verification

None.

## Open Questions

None blocking. The skill's exact section headings and the doctrine lines' final wording are the
implementer's, within the meanings above, recorded in the Chapters.

## Chapters

### Chapter 1 - 2026-08-18
Completed: 1. The `standing-watch` skill
Implemented By: implementer-opus, with a fable adversarial-reviewer and a fable blind-reviewer
Metrics: 1 review round; NEEDS_CONTEXT 0; escalations 0; consults 0
Decisions / Surprises:
- The implementer returned DONE_WITH_CONCERNS on three items, all adjudicated here. Two rules the section's bullet list names ("cannot measure", probe before kill) are stated in the skill as pointers rather than as rules, because Section 2 places both in the doctrine and writing-skills forbids one rule with two owners. I verified the pointers name the sections Section 2 actually used: the "cannot measure" line sits under Verify before you claim and the probe line under Environment and tooling discipline. The third concern was that the probes were the orchestrator's to run, which is correct and is recorded below.
- The second concern was that the ping template's evidence line and Section 2's new Before-you-send question ask the same thing. They do, and that is the intended shape rather than a duplicate rule: the doctrine question is the re-read check and the skill's evidence line is the message structure it checks against, which is the same relationship every other Before-you-send question has to the rule above it.
RED/GREEN, probe A (probe a dispatched agent before killing it), fresh headless `claude -p` sessions from an isolated repository, neither a subagent of this session:
- RED (no rule supplied) reached for the agent's transcript: pull `TaskOutput`, fall back to `cat` on the transcript file, read the tail, and TaskStop if the tail looks wedged. GREEN sent a message probe first and named the discriminator: a starved-but-alive agent answers at once and a wedged one cannot, so a silent transcript is an absence of signal rather than evidence.
- The RED arm did not reach the kill, and that is the honest reading rather than a clean separation: an existing doctrine bullet already forbids racing a rival into a suspected stall, so RED inherited the do-not-kill half. What RED lacked was the discriminating move. It proposed the filesystem read, which is exactly the non-signal the new rule names, so the delta the probe establishes is the probe-versus-transcript choice and not the kill-versus-wait one.
RED/GREEN, probe B (re-derive and re-measure before obeying a standing note), same conditions, scenario a watch tick holding a five-hour-old standing DO-NOT citing an advisory lock:
- RED did not reproduce. Without the rule, the arm re-ran the lock query on its own, called the ledger line a claim rather than a fact, and branched on the measurement. The doctrine's existing re-ground-a-summary-at-the-moment-of-use rule covers enough of this that the failure the section guards against did not appear in a single-turn scenario, which is the contaminated-RED case writing-skills anticipates.
- One real delta survived and is worth the record: GREEN rewrote the ledger unconditionally, striking the stale line with the new measurement on both branches, while RED corrected the ledger only on the branch where the lock had cleared and left the stale line standing on the branch where it had not. The rule that earns its place from this pair is therefore supersede-in-place rather than re-measure-before-obeying, which the skill states and which the shipped text keeps.
Review Findings: adversarial APPROVED_WITH_CONCERNS, blind APPROVED_WITH_CONCERNS. Blind's Major was real and reproduced on my own read: the artifacts section said "a pass that arms first and writes second loses the pass" while the tick order opens with "arm the wake first, before any check", so the document's own fixed sequence contradicted the rule stated four sections above it, on exactly the truncated-read failure this repository names as its defect class. Fixed by naming the two arms explicitly, a safety arm on restart and a paced arm after the write, and closing the class at two. Three Minors fixed: the probe citation now scopes itself to a stall-signal kill, matching the doctrine bullet it points at rather than overstating it; the duplicated "absence of signal" sentence is gone from the skill, leaving the doctrine the only owner and the skill only the watch-specific tail; and the re-derive step now says a self-authored wake prompt carries no situation text while an operator's may, so the step and Wake mechanics stop describing the artifact differently. "Labelled" corrected to the American spelling the rest of the tree uses.
Stamps: adjudicated 3, stamped 2 (`claude-code-bash-rule-token-matching`, `claude-code-file-permission-rules`, both operator tier). Skipped `fable-limit-can-exhaust-mid-run`: every fable dispatch in this section succeeded, so it steered nothing.
Next: 2. Four doctrine lines and one Before-you-send question
Commit Model: Commit-and-Push

### Chapter 2 - 2026-08-18
Completed: 2. Four doctrine lines and one Before-you-send question, synced across the three copies
Implemented By: implementer-opus, with a fable adversarial-reviewer and a fable blind-reviewer
Metrics: 1 review round; NEEDS_CONTEXT 0; escalations 0; consults 0
Decisions / Surprises:
- The implementer reported a gap in what the parity gate can see, rather than fixing it quietly, and it is worth carrying: `doctrine-parity` and `output-style-parity` prove the three copies agree, never that any particular line is present in them. A symmetric deletion from every copy leaves both tests green. The gate is a sync gate and this section relied on it as one; presence coverage would be a different test and is not in this plan's scope. Carried to the backlog.
- Probe A above is this section's RED/GREEN for the probe-before-kill line, run once and recorded there rather than twice.
Review Findings: adversarial APPROVED_WITH_CONCERNS, blind APPROVED_WITH_CONCERNS, no Criticals. Three Minors fixed, all in the three-copy sync. The per-machine bullet asserted "Memory is what the rule protects" as a sole rationale while the adjacent sequencing bullet grounds the same rule in DLL locks and shared fixtures, so a reader deciding whether the rule reaches another checkout got opposite answers from neighbouring paragraphs; it now names memory as one pressure among those the sequencing rule guards. "neighbouring" corrected to "neighboring" to match the tree's American spelling.
Deviation from the spec's literal wording, deliberate: the new Before-you-send question ships as "Does every figure or state in this message name the source it came from (the file, the query, the run) and the subject it is about?" rather than the spec's "(row, column, scan cycle)". The blind reviewer caught that the spec's parenthetical is watch-domain vocabulary ("scan cycle" names a concept the doctrine never defines) landing in a checklist that governs every message on every task. The section's own text makes wording the implementer's within the stated meaning, and the meaning is unchanged: name the source and name the subject. Reversal cost is one three-file sync.
Stamps: adjudicated with Chapter 1's sweep, which covers this section's span.
Next: 3. The two-question grant audit
Commit Model: Commit-and-Push

### Chapter 3 - 2026-08-18
Completed: 3. The two-question grant audit, in the security reviewer and the dispatch brief
Implemented By: implementer-sonnet, with an opus adversarial-reviewer and an opus blind-reviewer, both at effort xhigh through the Workflow route
Metrics: 1 review round; NEEDS_CONTEXT 0; escalations 0; consults 0
Decisions / Surprises:
- The section cites operator-tier memory `claude-code-bash-rule-token-matching` as the measured record behind its matcher claim, and no such record existed on this machine. Ruled to measure the fact and create the record rather than drop the citation, because the audit's second question is arbitrary caution without a reason the matcher cannot be bounded. Three probes against the real CLI (2.1.235), each an isolated repository with a hand-written settings file and a fresh headless session, established all three parts: a deny `Bash(git lo:*)` did not block `git log -2 --oneline`, so matching is on whole-token boundaries rather than raw string prefix; a deny `Bash(git log -1:*)` did block `git log -1 --oneline`, so a rule covers the whole tail after its pinned prefix; and with a deny `Bash(git log --format=%H:*)`, `git log --format=%H -1` was denied while `git log -1 --format=%H` ran, so the deny binds only while the option sits at the front of the tail and the option escapes by moving.
- The first control was mis-designed and is recorded so the correction is not re-derived: a deny on `Bash(git log --format:*)` failed to block `git log --format=%H -1`, which reads as contradicting the whole-tail claim until you see that `--format` is not a whole token inside `--format=%H`. The deny never matched, for a token-boundary reason and not a position one. The exact-token redesign is what produced the decisive result.
- The record's own index description read "a deny cannot bound a flag", which the third probe contradicts. Repaired in the same turn via `memq add-operator --update`; the record body was already correct and only the one-line description overstated.
Spec deviation, deliberate: the spec says a deny "cannot bound a flag at any tail position". The measurement says it binds at the front of the tail and nowhere else. The shipped checklist states the measured fact and the spec text above has been corrected to match, per the deviation rule; the substance the section asked for, that the verb list is the enforcement point, is unchanged and now carries a true reason instead of an over-general one.
Review Findings: adversarial APPROVED_WITH_CONCERNS, blind CHANGES_REQUIRED. Both reviewers landed independently on the same defect in the checklist bullet and the blind lens stated it hardest: "flag a grant that passes only the first" names a verdict for one of three outcomes, leaves the fail-both cell unaddressed, and is polarity-ambiguous besides, since these questions are phrased so that yes is the unsafe answer. Read literally it exempts the most dangerous grant class, and this repository's own recommended settings carry four examples of it. The bullet is rewritten to lead with the complete flag rule (fail either screen and the grant is flagged; failing both is the worst case, not an exempt one), then the two screens beneath it, then the matcher fact as the reason, which also clears the truncation-hazard ordering both reviewers flagged. Three further Majors fixed in the dispatch brief: the conditional marker was an unobservable predicate where every sibling marker reads off a mechanical fact, so it is now keyed to the section's files in scope; the "verbatim" instruction named no path where the neighbouring bullet spends nineteen lines establishing that a cross-file reference must resolve through the plugin-root ladder, so it now points at `<root>/agents/security-reviewer.md` by that same ladder; and the audit's owner was not in step 3's security-reviewer dispatch predicate, so a section could carry the slot in its brief and never get the reviewer that owns the rule, which the widened trigger list fixes. The slot also now states the implementer-facing action (narrow the grant, or return it with the reason) rather than the reviewer's "flag", which is not a move an implementer can make.
Minors fixed: the enforcement-point sentence is now scoped to settings-file permission rules, because this kit ships two counterexamples (`readonly-agent-guard.js` parses the whole command at any token position, `memq-grant.js` keys on absolute-path equality) that a reviewer generalizing the sentence would reason about from the wrong model; the matcher claim now carries its CLI version inline rather than resting on a memory name a subagent cannot read; and the header shape matches its siblings. The OWASP tag moved from A01 to A05, Security Misconfiguration being the closer fit for an over-broad rule in a settings file, and the tag propagates into every finding the rule emits.
Minors noted, not fixed: the four implementer charters each restate the Dispatch Brief field list and none names the new conditional slot. The enumeration was already lossy before this change (it omits rich references, error and delete semantics, and workspace constraints), so this is a pre-existing class rather than damage this section did, and fixing it means editing four charters outside this plan's files in scope. Carried to the backlog.
- One acceptance criterion does not hold as written and must not be recorded as passing on a bare grep: "grep finds the key phrase in exactly those two files" is false, because `docs/README.md` and `docs/plans/README.md` both carry the phrase "two-question grant audit" in their plan-index descriptions. The property the criterion was reaching for does hold: the adversarial reviewer confirmed no other kit surface states any grant-audit rule, so writing-skills' one-owner requirement is met. The criterion conflated a rule with a mention of one.
Stamps: adjudicated with Chapter 1's sweep, which covers this section's span; `claude-code-bash-rule-token-matching` was stamped applied for this section's work.
Next: finishing-work
Commit Model: Commit-and-Push
