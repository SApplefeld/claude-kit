# Standing Watch: A Skill for Watching a Live System, and the Doctrine Lines the Watch Paid For

Status: Approved
Commit Model: Commit-and-Push
Created: 2026-08-18

## Related

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
prefix, and a deny rule matches the same way, so a deny cannot bound a flag at any tail position; the verb
list is the enforcement point. Name the operator-tier memory `claude-code-bash-rule-token-matching` as the
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
