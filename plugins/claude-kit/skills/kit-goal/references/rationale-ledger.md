# Rationale ledger: kit-goal

This file is the rationale ledger for the documents the `kit-goal` skill owns. Rule text says what happens; this ledger says why; git says when. Nobody loads it by default. A session about to change a rule in one of the documents below reads the entry for the claim it is changing first, so the reason a rule holds is not re-litigated at the next review.

Each document sits under its own heading, which opens with its inventory line (what the document is for, which moments it owns, and when a session loads it) and then carries one entry per claim, retired claims included so the next audit does not re-find them. An entry is keyed by the claim's imperative sentence and carries its class (rule, mechanic, pointer, or rationale-example), its source as file and line, its provenance (the commit, incident, memory or kaizen note that installed it, or `no provenance found`), and its verdict (keep, rewrite, or retire) with the reason. A `C` entry's source line is read at the extraction commit `6bc07fb`; an `R` entry is a claim re-extracted from a hunk the Section 5 merge changed, and its source line is read at the merged commit `d9540ad`. Claim numbers restart under every document heading, and inside a document read in chunks they restart per chunk, so an entry id is unique only under its heading and a chunked document carries the chunk in the id (`c2.C001` is claim C001 of the second chunk); a claim named inside a reason or provenance line of such a document carries the same prefix. A `C` entry whose source hunk the Section 5 merge rewrote reads `retire` and carries a `superseded-by:` line naming the `R` entry that holds the passage at the merged commit; the passage's own verdict is that entry's, so a count of retirements over this ledger leaves those records out. A reason may name the form the judge ruled toward (a pointer at the owner, a split, a fold into a neighbour), because that form is why the verdict is rewrite rather than keep or retire; what a passage becomes is the rewrite plan's to decide, and where the two differ the rewrite plan governs. The target wording a judge proposed rides on the entry's `proposed:` line, one line per distinct proposal, on rewrite and retire entries that retire a passage; a proposal that pointed at another ruling by id carries the resolved text marked `(via Annn)`. A rewrite or retire the judge flagged as behavior-shaping carries `baseline-test: yes`, which is what the rewrite plan's RED and GREEN step keys on. What a passage becomes is the rewrite plan's to decide (`claude-kit_corpus-rewrite_spec_v1.md` under `docs/plans/`), and where it and a proposal differ the rewrite plan governs.

## plugins/claude-kit/skills/kit-goal/SKILL.md

This document is the operating guide for `/kit-goal`, a tree-scoped completion leash that holds an autonomous plan run to completion across session boundaries. It owns the moments of arming a plan or an ordered queue of plans (including appending to a queue, self-arming a plan a run took on itself, and arming a plan handed over by a peer session), clearing an armed leash, reading what is armed through the status command and the status-line widget, writing and recording a plan's `## Dispatch Authorization` grant, and the Stop-hook enforcement that decides when a stop releases, advances, or is blocked, plus the event lines that record those outcomes. It also states what an arming itself authorizes: approval of the plan as written, and, for an operator-typed arming, the request to parallelize the run through subagents and Workflows. A session loads it before a specific act, when the operator types `/kit-goal <plan path>`, `/kit-goal clear`, or bare `/kit-goal`, or when a run must arm, append, or reason about an armed leash, so the load class is `named-trigger`.

Extracted at `6bc07fb`: whole document (`skills.kit-goal.SKILL.md`).

### C001
- key: Arm a plan run with `/kit-goal docs/plans/<plan>.md`, which writes the goal state to `.kit/goal-state.json` in the working tree so the arming outlives a session boundary.
- class: mechanic
- source: plugins/claude-kit/skills/kit-goal/SKILL.md:8
- provenance: 6806b04 2026-07-16 installed the arming surface with the Stop hook; e22cff5 2026-09-02 (WORKTREE-GOALS §3) reworded it when the leash moved from the repository to the working tree.
- verdict: keep
- reason: The owner's one-sentence statement of what the leash is and where it lives; every later rule presupposes the state is tree-scoped, and the operator memory records a run armed in the wrong directory when that was not understood.

### C002
- key: Pass several plan paths in one invocation to arm an ordered queue; the leash advances itself plan to plan and only the last plan's terminal state releases the session.
- class: mechanic
- source: plugins/claude-kit/skills/kit-goal/SKILL.md:10
- provenance: dbf5e6a 2026-08-16, the kit-goal queue plan's skill section.
- verdict: keep
- reason: The queue arming is the caller's act and the sentence is what tells a session one invocation covers the sequence with no retyped arming between plans.

### C003
- key: Use `/kit-goal` to arm and to sequence plan runs, and reserve native `/goal` for goals that are not plan-based.
- class: rule
- source: plugins/claude-kit/skills/kit-goal/SKILL.md:12
- provenance: 6806b04 2026-07-16 placed the kit leash beside native `/goal`; dbf5e6a 2026-08-16 added that a queue is what `/kit-goal` takes.
- verdict: keep
- reason: No finding. The split keeps plan runs on the deterministic hook the kit tests.

### C004
- key: Give each argument as a repo-relative plan path such as `docs/plans/foo_spec_v1.md`.
- class: mechanic
- source: plugins/claude-kit/skills/kit-goal/SKILL.md:16
- provenance: dbf5e6a 2026-08-16.
- verdict: keep
- reason: No finding. The path shape is what the CLI validates and the hook matches.

### C005
- key: Arm by running `node <plugin-root>/hooks/kit-goal.js arm <plan path>...`, which is `../../hooks/kit-goal.js` from this skill's base directory.
- class: mechanic
- source: plugins/claude-kit/skills/kit-goal/SKILL.md:19
- provenance: dbf5e6a 2026-08-16.
- verdict: keep
- reason: No finding. The command and the path derivation are what a session runs.

### C006
- key: Report the arm command's one-line result.
- class: rule
- source: plugins/claude-kit/skills/kit-goal/SKILL.md:22
- provenance: 61a9825 2026-08-29 last reworded the line; the report rule dates from the arming surface at 6806b04 2026-07-16.
- verdict: keep
- reason: The session's act; the line-22 rewrite (A005) trims the CLI's refusal enumeration around it, not the rule.

### C007
- key: When the arm command refuses, surface the reason it gives and stop rather than retrying.
- class: rule
- source: plugins/claude-kit/skills/kit-goal/SKILL.md:22
- provenance: 61a9825 2026-08-29 last touched the line; the refusal set grew across 2993ac4, 72309c6 and 050da02.
- verdict: keep
- reason: The rule stands; its bound's enumeration of what the CLI refuses moves here (missing plan, `Status: Complete`, duplicate, control character, path outside the project, unknown leading-dash token) because the CLI names the reason itself at the refusal.

### C008
- key: Treat an unrecognized-flag refusal naming a flag this skill documents as a sign the CLI in this session's plugin view predates that flag.
- class: rationale-example
- source: plugins/claude-kit/skills/kit-goal/SKILL.md:22
- provenance: 050da02 2026-08-29, where the refusal's version identifier read "version claude-kit" on the one surface whose job is naming the build.
- verdict: keep
- reason: Without it the surface-and-stop rule misreads a documented flag's refusal as the session's own authoring error; nothing else names version skew as the cause.

### C009
- key: Read the sentence the arm prints to learn the binding, rather than matching its exact wording.
- class: rule
- source: plugins/claude-kit/skills/kit-goal/SKILL.md:24
- provenance: 1819e2c 2026-08-29, which removed the skill's literal quotation of a sentence free to improve.
- verdict: keep
- reason: The wording is the CLI's to improve and the rule is what keeps the skill from pinning it.

### C010
- key: Treat an unbound arm result as not an error, and distinguish the two unbound states, one where the recorded id lets that session claim and one where no usable id was readable so only the arming text claims.
- class: mechanic
- source: plugins/claude-kit/skills/kit-goal/SKILL.md:24
- provenance: 1819e2c 2026-08-29 added the second claim route and the two-state report after a self-armed run on a failed transcript lookup was left unheld.
- verdict: rewrite
- reason: "Not an error" stays; the two-state description duplicates the claim-signal paragraph at line 98 within the same document, so line 24 points there instead. Lands as 'An arm reporting an unbound result is not an error, and `## How the leash holds` below owns the binding.' The line-98 paragraph this reason points at retires in the same section (C064, C066), so the landing points at the section that owns the binding rather than at a retired paragraph; the two-state description and the multi-line-invocation sentence (C011) leave. Fixed at section 27's close: the pointer at `## How the leash holds` aimed at a section that no longer states the claim once C064, C066 and C068 left, so the landing is 'An arm reporting an unbound result is not an error: the sentence it prints names the route that claims the leash, and `armingSessionClaims` in `hooks/kit-goal-lib.js` owns that claim.', the arm's own unbound note (`unboundNote` in `hooks/kit-goal.js`) naming the route.

### C011
- key: Expect a multi-line `/kit-goal` or a prose request to arm to bind exactly as the single-line form does, because binding comes from the CLI run.
- class: rationale-example
- source: plugins/claude-kit/skills/kit-goal/SKILL.md:24
- provenance: 8ecf3a9 2026-08-20: a multi-line invocation the harness did not parse into command markup armed but never bound, twelve hours unleashed on a live run.
- verdict: retire
- reason: The incident class is closed by machinery (the CLI binds the arming session at arm time whatever the message shape), so the sentence explains a failure that cannot recur; this entry is its record. Retired as the paragraph's closing sentence, the invocation's-shape sentence.
- proposed: Drop the sentence; the ledger carries why invocation shape stopped mattering.

### C012
- key: Expect queue arming to be all-or-nothing: every path is validated before anything is written and one bad path refuses the whole arm, naming the offender.
- class: mechanic
- source: plugins/claude-kit/skills/kit-goal/SKILL.md:26
- provenance: dbf5e6a 2026-08-16, the queue plan; 80cce3c 2026-08-16 records a watcher losing a queue to that refusal.
- verdict: retire
- reason: The CLI performs the validation and names the offender in its refusal; the design reason (a partial queue is a silent failure) lives here beside C013. Retired whole with its paragraph and the blank line after it, with C013.
- proposed: Drop the sentence from line 26; the CLI's refusal reason is the surface.

### C013
- key: A partial queue would be the silent-failure shape, a run that looks armed for four plans and is armed for two.
- class: rationale-example
- source: plugins/claude-kit/skills/kit-goal/SKILL.md:26
- provenance: dbf5e6a 2026-08-16.
- verdict: retire
- reason: Design rationale for CLI behavior; recorded here so a session changing the arm's validation knows why it is atomic over the whole argument list. Retired whole with its paragraph and the blank line after it, with C012.
- proposed: Move to this ledger under C012.

### C014
- key: Grow an armed queue with `node <plugin-root>/hooks/kit-goal.js arm --append <plan path>...`, which adds the plans behind the existing queue under the existing binding and leaves the plan in flight running.
- class: mechanic
- source: plugins/claude-kit/skills/kit-goal/SKILL.md:28
- provenance: 2993ac4 2026-08-25, dispatch authority: the queue grows through append instead of being replaced.
- verdict: keep
- reason: The append form is the session's act and kit-goal owns it; executing-work points.

### C015
- key: Place `--append` at any argument position.
- class: mechanic
- source: plugins/claude-kit/skills/kit-goal/SKILL.md:34
- provenance: 2993ac4 2026-08-25.
- verdict: retire
- reason: The CLI reads its flags wherever they sit and the documented forms already lead with the flag; nothing is lost. Retired as the paragraph's opening sentence, the line opening at 'The named plans join the queue'.
- proposed: Drop the position sentence and the duplicate-refusal sentence from line 34.

### C016
- key: Expect an append to be all-or-nothing: a path already in the queue or repeated among the arguments refuses the whole invocation naming the duplicate and leaves the queue byte-identical.
- class: mechanic
- source: plugins/claude-kit/skills/kit-goal/SKILL.md:34
- provenance: 2993ac4 2026-08-25; one duplicate definition shared by arm and append so the two cannot disagree.
- verdict: retire
- reason: Duplicate refusal is the CLI's and its reason names the duplicate; the shared-definition design is recorded here. Retired as the all-or-nothing sentence, the paragraph keeping its join sentence and its refuses-when-nothing-is-armed sentence.
- proposed: Drop the sentence; the CLI's refusal is the surface.

### C017
- key: Use the bare arm form for a first arming, since `--append` refuses when nothing is armed.
- class: rule
- source: plugins/claude-kit/skills/kit-goal/SKILL.md:34
- provenance: 2993ac4 2026-08-25; 72309c6 2026-08-29 made the refusal name the bare form after a run met the empty-queue refusal with the rescue in a skill it had not loaded.
- verdict: keep
- reason: The session's choice of form; kit-goal owns it and executing-work restates the three readings as a pointer.

### C018
- key: Arm with `node <plugin-root>/hooks/kit-goal.js arm --self-armed <plan path>...` to record that the arming invocation is the run's own rather than the operator's.
- class: mechanic
- source: plugins/claude-kit/skills/kit-goal/SKILL.md:36
- provenance: 61a9825 2026-08-29, the arming field decomposed to the one fact a caller can supply.
- verdict: keep
- reason: No finding. The form a run uses for its own arming.

### C019
- key: Pass `--self-armed` where a session runs the CLI for itself, and leave it off where the operator typed the invocation.
- class: rule
- source: plugins/claude-kit/skills/kit-goal/SKILL.md:42
- provenance: 61a9825 2026-08-29, three review rounds because one value carried two facts; kaizen/notes-NEO-CLAUDE.md 2026-09-03 records two seats omitting the flag on a relayed operator instruction.
- verdict: rewrite
- reason: The rule and its one-fact definition (who ran this invocation, as it claimed it) stay and the wording names the relayed-instruction case as the run's own invocation, since that is where the record has gone wrong; the downstream-effect sentences leave. Lands at line 40 as 'Use it where a session runs the CLI for itself, the arming the section below governs, and leave it off where the operator typed the invocation. A session running the CLI on a relayed operator instruction is the run's own invocation and takes the flag. The CLI infers nothing from the session id, the transcript or the arguments, which are the same either way, so the flag is the only thing that tells the two apart. It records one fact and no other: who ran this invocation, as this invocation claimed it.', the authorization-record sentence whole after it; its second proposal (via A019) lands at line 60 with C039 as 'Such an arm takes `--self-armed`, under the flag rule above.'
- proposed: Line 42 keeps the rule and the one-fact definition, states that a session running the CLI on a relayed instruction is the run's own invocation, and drops the sentences on what the flag changes downstream.
- proposed: (via A019) Line 62's "Such an arm is made with `--self-armed`" becomes a pointer at the flag rule at line 42.
- baseline-test: yes

### C020
- key: Place `--self-armed` at any argument position, on either the bare arm form or the `--append` form.
- class: mechanic
- source: plugins/claude-kit/skills/kit-goal/SKILL.md:42
- provenance: 61a9825 2026-08-29.
- verdict: retire
- reason: Flag parsing is the CLI's; the `--append --self-armed` spelling at line 44 carries the both-forms fact. Retired as the paragraph's opening sentence ('It sits at any argument position, like `--append`, and rides on both forms').
- proposed: Drop the position sentence; the "rides on both forms" fact survives as the `--append --self-armed` spelling at line 44.

### C021
- key: Expect `--self-armed` to change only the goal state's condition text and the Stop hook's block-reason clause, leaving the binding, the queue and every enforcement rule the same, with the self direction reported in the arm's result line.
- class: mechanic
- source: plugins/claude-kit/skills/kit-goal/SKILL.md:42
- provenance: 61a9825 2026-08-29.
- verdict: retire
- reason: What the flag changes is composed by kit-goal-lib.js and kit-goal-stop.js; recorded here so nobody re-adds a refusal gate on the flag, which 61a9825 deleted because it contradicted the skill and the architecture doc. Retired as the paragraph's two closing sentences, on what the flag decides and on the binding being the same either way; the tail of line 62 on what the condition text records leaves with it under C039.
- proposed: Drop the two sentences; the ledger carries them.

### C022
- key: Spell a self-armed addition to an operator-typed queue as `--append --self-armed`, since arming is recorded per plan and entries already queued keep the arming they were armed with.
- class: mechanic
- source: plugins/claude-kit/skills/kit-goal/SKILL.md:44
- provenance: 61a9825 2026-08-29.
- verdict: keep
- reason: Per-plan recording is what makes the spelling right and the spelling is the session's act; kit-goal owns it.

### C023
- key: Expect a self-armed arm whose plan doc records no authorization to still proceed while warning on stderr and naming those plans.
- class: mechanic
- source: plugins/claude-kit/skills/kit-goal/SKILL.md:44
- provenance: 61a9825 2026-08-29: the refusal gate went and the honest spelling became runnable, with a warning because a section the scan does not reach is otherwise invisible.
- verdict: retire
- reason: The CLI proceeds and warns by itself at exit zero; the warning is the surface and its reason is recorded here. Retired as the paragraph's closing sentence, the paragraph ending at 'the arming they were armed with'.
- proposed: Drop the sentence; the ledger records why the warning exists.

### C024
- key: Read the bare form's stderr warning naming dropped plans before the next step, since a warning always means work left the queue.
- class: rule
- source: plugins/claude-kit/skills/kit-goal/SKILL.md:46
- provenance: 2993ac4 2026-08-25 made the bare replace warn when it drops a non-empty queue.
- verdict: keep
- reason: No finding. Reading the warning is the session's act and the warning is silent when nothing dropped.

### C025
- key: Under an operator-typed arming, reduce wall-clock time by parallelizing the plan's work through subagent dispatch and Workflows wherever the sections and their gates allow.
- class: rule
- source: plugins/claude-kit/skills/kit-goal/SKILL.md:50
- provenance: de0d887 2026-08-15: sessions were not deriving the parallelization authorization from the standing doctrine, so the arming act carries the per-run request without widening the doctrine.
- verdict: keep
- reason: The authority is the arming act, scoped to this run, and the cross-reference to the doctrine's reading of the harness line is how the injected Workflow line is satisfied; the gate on deep-research and other Workflow use is blast-radius and stays.

### C026
- key: On a self-armed run, parallelize through subagents without asking, but ask before any Workflow use beyond dispatching a read-only agent at an effort the Agent tool cannot set.
- class: rule
- source: plugins/claude-kit/skills/kit-goal/SKILL.md:52
- provenance: 61a9825 2026-08-29 settled what a self-arm carries.
- verdict: keep
- reason: A self-armed run holds only the doctrine's standing grant; executing-work:419's no-ask Workflow route is that same narrow purpose, so the two agree at execution. The executing-work:419 cite is the adoption trigger at the landing; the no-ask Workflow route sits at that file's line 401, the sentence opening 'The doctrine's standing-dispatch bullet carries the operator's request for this route'; prefer the phrase over the line.

### C027
- key: Under an armed leash, never wait for a separate approval message and never read the plan's `Status:` header as evidence that approval is missing.
- class: rule
- source: plugins/claude-kit/skills/kit-goal/SKILL.md:54
- provenance: 04277e1 2026-08-21, arming is approval; 61a9825 2026-08-29 added the self-armed source of approval.
- verdict: keep
- reason: kit-goal owns the rule by 04277e1's own placement; the three preceding sentences name where approval comes from under each arming, which a run must be able to cite.

### C028
- key: Do not treat a `Status:` value the kit does not define as gating arming; executing-work's run-start step normalizes it.
- class: mechanic
- source: plugins/claude-kit/skills/kit-goal/SKILL.md:54
- provenance: 04277e1 2026-08-21.
- verdict: keep
- reason: Already the pointer at executing-work, which owns the normalization.

### C029
- key: Record a plan's arming authority in a `## Dispatch Authorization` section naming who authorized the run, when, and which sessions the grant covers, defaulting to "any session holding this plan".
- class: mechanic
- source: plugins/claude-kit/skills/kit-goal/SKILL.md:58
- provenance: 2993ac4 2026-08-25.
- verdict: keep
- reason: No finding. The section's format is kit-goal's by the ownership map.

### C030
- key: Before arming a plan that arrived by peer message, trace its committed grant to the operator rather than arming on the section's presence alone.
- class: rule
- source: plugins/claude-kit/skills/kit-goal/SKILL.md:58
- provenance: 2993ac4 2026-08-25, the review's Critical: a peer could author a section and have a leashed receiver run work the operator never approved; f75e235 2026-08-26 found the same gap in the architecture doc.
- verdict: keep
- reason: No tool performs the trace, so the reason the section's presence is insufficient is what makes the rule obeyable; peer-sessions owns the trace and this sentence points there.

### C031
- key: Read the peer-sessions skill for the trace, the standing of the peer message itself, and the reply states.
- class: pointer
- source: plugins/claude-kit/skills/kit-goal/SKILL.md:58
- provenance: 2993ac4 2026-08-25.
- verdict: keep
- reason: No finding. The pointer the ownership map requires.

### C032
- key: Put the grant's essential claim in the `## Dispatch Authorization` section's first sentence rather than spreading it over several.
- class: rule
- source: plugins/claude-kit/skills/kit-goal/SKILL.md:60
- provenance: 2993ac4 2026-08-25 stored the first sentence; f75e235 2026-08-26 fixed the cap and the marker.
- verdict: keep
- reason: An authoring rule the session obeys because the CLI records only that sentence.

### C033
- key: Expect the CLI to store only that first sentence, flattened to one line, stripped to printable ASCII, capped, and read from the head of the file only.
- class: mechanic
- source: plugins/claude-kit/skills/kit-goal/SKILL.md:60
- provenance: 2993ac4 2026-08-25; the cap was raised from 120 to 320 after it stored half of the spec's own grant.
- verdict: retire
- reason: The scan is the library's (safeForAuthorization, planHeadText, AUTHORIZATION_MAX_CHARS); the one clause a writer needs, that only the first sentence is recorded, rides with C032. Retired to the clause 'it stores the section's **first sentence** only' inside C032's sentence, the flattening, stripping, capping and head-of-file mechanics leaving. Its landing respelled C034's keep sentence; C034 records the flip.
- proposed: Drop to the one clause A043 keeps.

### C034
- key: Keep the `## Dispatch Authorization` section above `## Sections of Work`.
- class: rule
- source: plugins/claude-kit/skills/kit-goal/SKILL.md:60
- provenance: f75e235 2026-08-26: a position below the block silently truncates a later section append, and the template fixes no position for this heading.
- verdict: rewrite
- reason: An authoring rule whose reason (the scan window's edge) is recorded here rather than in the skill. Flipped from keep to rewrite at section 27's close: C033's and C035's retires took the sentence this clause was joined to, so the clause opens its own sentence with a capital, and the sentence was respelled to stand as landed. Landed as the proposal below.
- proposed: Keep the section above `## Sections of Work` where the placement rule already puts it.

### C035
- key: Expect a section the scan window does not reach whole, or one whose heading carries anything after the title, to record as no authorization at all in `status`.
- class: mechanic
- source: plugins/claude-kit/skills/kit-goal/SKILL.md:60
- provenance: f75e235 2026-08-26, the window-edge rule, narrowed after the implementer refuted the two-condition form.
- verdict: retire
- reason: Scan outcomes pinned red-first in the library's tests; the placement rule C034 is what a writer obeys. Retired as the scan-window sentence. Its landing respelled C034's keep sentence; C034 records the flip.
- proposed: Drop; the ledger notes the window edge as the reason for the placement rule.

### C036
- key: Expect a first sentence longer than the cap to record its head with a truncation marker rather than being dropped.
- class: mechanic
- source: plugins/claude-kit/skills/kit-goal/SKILL.md:60
- provenance: f75e235 2026-08-26, so a cut sentence cannot read as whole.
- verdict: retire
- reason: The marker is the CLI's; recorded here so a reader of a status line knows a marked head is a partial by design. Retired as the cap-and-truncation-marker sentence.

### C037
- key: Treat the recorded authorization sentence as an audit trail only; nothing consults it to decide whether an arm may proceed and a plan with no section arms as before.
- class: mechanic
- source: plugins/claude-kit/skills/kit-goal/SKILL.md:60
- provenance: 2993ac4 2026-08-25 installed the record as provenance; 61a9825 2026-08-29 deleted the gate that had contradicted it.
- verdict: retire
- reason: A property of the CLI; recorded here so the gate is not re-added, since the trace is a step a person performs and never a check the CLI runs. Retired as the audit-trail sentence; its second carrier, line 62's 'It claims nothing about the grant' sentence, leaves with C039's landing.
- proposed: Drop; the ledger carries the audit-trail status.

### C038
- key: Take anything the plan does not cover to the operator, since a `## Dispatch Authorization` section supplies no live steering.
- class: rule
- source: plugins/claude-kit/skills/kit-goal/SKILL.md:62
- provenance: 61a9825 2026-08-29.
- verdict: keep
- reason: The blocker set's own gate restated for the artifact-armed run; operator-decision class, never loop bookkeeping.

### C039
- key: Make an arm carried by a plan's committed authorization section with `--self-armed`.
- class: rule
- source: plugins/claude-kit/skills/kit-goal/SKILL.md:62
- provenance: 61a9825 2026-08-29.
- verdict: rewrite
- reason: Restates C019's self case; becomes a pointer at the flag rule, and the sentence's tail on what the condition text records leaves with C021. Lands with C019's second proposal as 'Such an arm takes `--self-armed`, under the flag rule above.', the tail on what the condition text records leaving with C021 and the audit-trail sentence after it leaving as C037's second carrier.

### C040
- key: Arm a plan handed to a running session at the earliest moment the receiving tree holds it: immediately by `--append` from the run's own cwd, or at the next safe tree advance where the worktree was cut before the plan's commit.
- class: rule
- source: plugins/claude-kit/skills/kit-goal/SKILL.md:64
- provenance: 2993ac4 2026-08-25; f75e235 2026-08-26 last reworded it.
- verdict: keep
- reason: The arming moment is kit-goal's; the pinned-worktree explanation is what lets a receiver read a refused unseen path as tree lag.

### C041
- key: Reply `received-authorized-deferred` naming the gate you wait on when you cannot arm the handed-off plan yet.
- class: rule
- source: plugins/claude-kit/skills/kit-goal/SKILL.md:64
- provenance: 2993ac4 2026-08-25.
- verdict: keep
- reason: The deferred state is for a traced grant behind a tree gate; a grant the receiver cannot establish at all takes peer-sessions' holding state, which answers the probe.

### C042
- key: Treat only the receiver's armed acknowledgment as converting a handoff; a handoff answered by either held state is still the sender's to carry until the arm lands.
- class: mechanic
- source: plugins/claude-kit/skills/kit-goal/SKILL.md:64
- provenance: f75e235 2026-08-26: both readings had shipped across four surfaces, so answered and converted became two states spelled the same everywhere.
- verdict: keep
- reason: Incident-born, spelled identically on every surface by design, and unenforced by any tool.

### C043
- key: As sender, name the handoff's anchor, the commit the plan landed in.
- class: rule
- source: plugins/claude-kit/skills/kit-goal/SKILL.md:66
- provenance: 2993ac4 2026-08-25.
- verdict: rewrite
- reason: The sender's messaging conduct is peer-sessions:39's rule, stated whole there; kit-goal keeps a pointer. Lands with C044 as 'Two things make that wait workable and both are the sender's, the anchor and the re-send, which the peer-sessions skill owns.' The peer-sessions:39 cite sits at line 37 at the landing, the paragraph opening 'A dispatch that expects an arm names its anchor'; prefer the opener over the line.
- proposed: Line 66 opens with a pointer at peer-sessions for the anchor and the re-send, then keeps the receiver's re-check, the bare-form rule with the plans it names and the silent consequence, and the absent-state keying.
- baseline-test: yes

### C044
- key: As sender, re-send the handoff at your own next boundary rather than waiting indefinitely, since an acknowledgment can be lost with the receiver's context.
- class: rule
- source: plugins/claude-kit/skills/kit-goal/SKILL.md:66
- provenance: 2993ac4 2026-08-25.
- verdict: rewrite
- reason: The re-send runs only until one of the three replies arrives, which peer-sessions:39 states and this sentence omits; a pointer at the owner replaces it and the apparent conflict with C089 disappears. Lands with C043 as 'Two things make that wait workable and both are the sender's, the anchor and the re-send, which the peer-sessions skill owns.' The peer-sessions:39 cite sits at line 37 at the landing, the paragraph opening 'A dispatch that expects an arm names its anchor', which carries 'holds the handoff open until one of the three replies arrives'; prefer the opener over the line.
- proposed: (via A056) Line 66 opens with a pointer at peer-sessions for the anchor and the re-send, then keeps the receiver's re-check, the bare-form rule with the plans it names and the silent consequence, and the absent-state keying.
- baseline-test: yes

### C045
- key: As a deferred receiver, re-check your tree against the named anchor at each boundary you already take: a section close, a pull you owe, or an arm attempt.
- class: rule
- source: plugins/claude-kit/skills/kit-goal/SKILL.md:66
- provenance: 2993ac4 2026-08-25.
- verdict: keep
- reason: The receiver's arming re-check is kit-goal's; it rides on boundaries already taken and creates none, which answers the fetch question.

### C046
- key: When arming an inbound plan while running unleashed, use the bare form and name every plan to be held, your own in-flight plan first and the inbound one after, with `--self-armed`.
- class: rule
- source: plugins/claude-kit/skills/kit-goal/SKILL.md:66
- provenance: 72309c6 2026-08-29: the mid-run trigger named only the append spelling, which refuses on the empty queue that most often precedes an arming.
- verdict: rewrite
- reason: The loaded case of the bare form, stated at both sites on purpose; kit-goal owns and executing-work carries the spelling. Flipped from keep to rewrite at section 27's close: C048's retire took the stderr-warning clause that followed this sentence's semicolon, so the sentence ends at 'either plan's authorization', and the sentence was respelled to stand as landed. Landed as the proposal below.
- proposed: The flag rides on both entries and is right for both, because it records who ran the invocation, which is this run for the whole of it, and says nothing about either plan's authorization.

### C047
- key: Naming the inbound plan alone leaves the run's own in-flight work unheld and invisible to the position walk, the status line and a blocked event's plan attribution, with no dropped-plan warning.
- class: rationale-example
- source: plugins/claude-kit/skills/kit-goal/SKILL.md:66
- provenance: 72309c6 2026-08-29.
- verdict: keep
- reason: The failure is silent by construction and no machinery reports it; without the consequence the name-both-plans instruction reads as bookkeeping.

### C048
- key: Expect the stderr no-authorization warning where the in-flight plan carries no section of its own, the ordinary case for a plan the operator armed by hand.
- class: rationale-example
- source: plugins/claude-kit/skills/kit-goal/SKILL.md:66
- provenance: 61a9825 2026-08-29.
- verdict: retire
- reason: The warning names itself a warning at exit zero; an operator-armed plan ordinarily has no section, which is recorded here. Retired as the stderr-warning clause after 'either plan's authorization', the semicolon becoming a period; C046 records the respell. Its landing respelled C046's keep sentence; C046 records the flip.
- proposed: Drop; the ledger notes the operator-armed plan ordinarily has no section.

### C049
- key: Key the choice of the bare form on the goal state being genuinely absent, never on an append having refused.
- class: rule
- source: plugins/claude-kit/skills/kit-goal/SKILL.md:66
- provenance: 72309c6 2026-08-29: the append refusal was re-keyed on the path and names no command over an unreadable state, because a bare arm there would overwrite a live leash.
- verdict: keep
- reason: The one keying that keeps a replacement off a live leash the CLI cannot parse; the 2026-09-05 kaizen note records that state as still reachable by a hand edit.

### C050
- key: Arm from the tree where you will run, treating a worktree as its own place with its own `.kit/goal-state.json` rather than a spelling of the main checkout.
- class: rule
- source: plugins/claude-kit/skills/kit-goal/SKILL.md:68
- provenance: e22cff5 2026-09-02 (WORKTREE-GOALS §3) stated the tree-scoped principle once here; memory kit-goal-inert-when-session-cwd-is-not-project-root records a leash armed from a tool call's cwd that every hook then ignored.
- verdict: keep
- reason: Incident-born and unenforced: nothing reconciles the arm's cwd with the hooks' payload cwd, so the prose is the only guard. The git rationale, memq contrast and test citation leave the skill.

### C051
- key: Expect the goal and checkpoint CLIs to answer the directory they are run from, while `memq` resolves a worktree's memories to the main checkout.
- class: mechanic
- source: plugins/claude-kit/skills/kit-goal/SKILL.md:68
- provenance: e22cff5 2026-09-02; the two resolutions are pinned against each other in test/kit-goal-worktree.test.js.
- verdict: rewrite
- reason: The CLI half is C050's bound and stays as "run them from the session's own tree root"; the memq half is memory-system's reference and the test pins the code, so it leaves. Lands as 'A session working a worktree reads and writes that tree's own `.kit/goal-state.json`, a bare-repo worktree included. The goal and checkpoint CLIs answer the directory they are run from, so run them from the session's own tree root.' after C050's sentence word for word, the bare-repo case as its own clause rather than the proposal's one compressed spelling; the git rationale, the memq contrast and the test citation leave with it and the doctor sentence with C052.
- proposed: (via A067) Line 68 keeps "arm where you will run; a worktree is its own place with its own goal state, a bare-repo worktree included; the goal and checkpoint CLIs answer the directory they are run from, so run them from the session's own tree root", and drops the git rationale, the memq contrast, the test citation and the doctor sentence.
- baseline-test: yes

### C052
- key: Read the doctor's goal-state block as reporting only the checkout its own script sits in, and expect no goal state at all from a run off an installed payload.
- class: mechanic
- source: plugins/claude-kit/skills/kit-goal/SKILL.md:68
- provenance: 80cce3c 2026-08-16 found the report sat behind the clone gate; e22cff5 2026-09-02 replaced a false agreement claim with this residual after two reviewers converged on it.
- verdict: retire
- reason: A description of the doctor, which kit-doctor and the security document own; kit-doctor:18's install-copy verdict and this residual are different scopes, not a conflict. Recorded here so the residual is not lost. Retired as the doctor sentence, whole.
- proposed: (via A072) Drop from kit-goal; the ledger carries the residual and kit-doctor owns the doctor's report.

### C053
- key: Release the leash with `/kit-goal clear` (aliases `stop`, `off`, `reset`, `none`, `cancel`), which runs `node <plugin-root>/hooks/kit-goal.js clear`.
- class: mechanic
- source: plugins/claude-kit/skills/kit-goal/SKILL.md:72
- provenance: 6806b04 2026-07-16.
- verdict: keep
- reason: No finding. The clear command and its aliases.

### C054
- key: Report what is armed with `/kit-goal` or `/kit-goal status`, running `node <plugin-root>/hooks/kit-goal.js status`, which names the current plan and its queue position, the plans remaining, each queued plan's arming and authorization, each finished plan's outcome, and the holding session or that it is unbound.
- class: mechanic
- source: plugins/claude-kit/skills/kit-goal/SKILL.md:80
- provenance: 6806b04 2026-07-16 installed status; dbf5e6a, 2993ac4 and 61a9825 grew what it reports.
- verdict: keep
- reason: The status command is kit-goal's; park points at it.

### C055
- key: Use the status-line widget `scripts/kit-goal-statusline.js`, which prints one line for the project the status line shows in the form `🎯 <plan> · Sections: <done>/<total> (Next §N) · Plans: <i>/<n>`.
- class: mechanic
- source: plugins/claude-kit/skills/kit-goal/SKILL.md:86
- provenance: 590d9cc 2026-08-24 installed the widget; 96889a0 2026-08-26 made its Plans segment agree with the other two surfaces under one fixture.
- verdict: keep
- reason: The widget's name and line shape are what C062's reading rule needs; how it derives each field leaves the skill.

### C056
- key: Expect sections to be counted from the armed plan doc by the machine contract, a `### N.` heading under `## Sections of Work` complete when a Chapter's first `Completed:` line registers it, with the pointer taken from the last Chapter's `Next:` line and the Plans segment shown only for a queue.
- class: mechanic
- source: plugins/claude-kit/skills/kit-goal/SKILL.md:92
- provenance: 590d9cc 2026-08-24; 10518d6 2026-08-31 last touched the line.
- verdict: retire
- reason: The widget's own rendering, pinned in test/kit-goal-statusline.test.js. Retired as the sections-and-pointer sentence, the paragraph at line 90 keeping the doctor-installs-its-launcher sentence alone.
- proposed: Drop with C057.

### C057
- key: Read the Plans segment as derived from the plan docs, naming the plan actually current with the stored position beside it where the index lags, keeping the position of an entry whose doc is missing from `docs/plans/` and `docs/archive/`, and saying so when every queued plan reads Complete.
- class: mechanic
- source: plugins/claude-kit/skills/kit-goal/SKILL.md:92
- provenance: 96889a0 2026-08-26: the widget was the one surface still reporting the stored index, saying 1/2 where the advisory and status said 2 of 2.
- verdict: retire
- reason: The position walk is the widget's, sharing queuePosition with the other surfaces under one fixture so the three cannot answer one question three ways; recorded here for anyone touching the segment. Retired as the Plans-segment position-walk sentence.

### C058
- key: Wire a shell-command status-line tool with `node "<absolute path to ~/.claude>/bin/kit-statusline.js"`, using the literal path rather than a variable.
- class: rule
- source: plugins/claude-kit/skills/kit-goal/SKILL.md:92
- provenance: 3db65f2 2026-08-24: the tool's own shell decides whether `%USERPROFILE%` or `$HOME` expands.
- verdict: keep
- reason: Incident-born operator wiring, unenforced; it stands as its own sentence once the cache prose leaves.

### C059
- key: Expect the launcher to load the widget in-process and cache its last line at `<project>/.kit/statusline-cache.json`, keyed on the goal state's and the armed plan doc's modification times, caching only a render that read exactly that one keyed doc and refusing the cache to every other render.
- class: mechanic
- source: plugins/claude-kit/skills/kit-goal/SKILL.md:92
- provenance: e1613d8 2026-08-25 built the in-process load and the cache; 96889a0 and 2096484 2026-08-26 shrank what may enter it after the key froze a corrected line, the same defect three times.
- verdict: retire
- reason: The launcher's own behavior, shaped as a rule (the walk reports what it read) precisely so no prose list has to track it. Retired as the in-process load, cache and cache-key sentences, the `<project>/.kit/statusline-cache.json` path leaving with them.
- proposed: Drop the cache, budget and payload-independence sentences from line 92; fold "blank with exit 0 where the payload predates the widget; update the plugin, since the doctor's -Fix copies only the launcher" into line 94's bound.

### C060
- key: Expect a refresh whose render fails or overruns its budget to draw the last cached line, and treat the cache as disposable, dropped by the first in-budget refresh after a clear at the cost of one re-render.
- class: mechanic
- source: plugins/claude-kit/skills/kit-goal/SKILL.md:92
- provenance: e1613d8 2026-08-25 (the budget fallback); f8067be 2026-08-25.
- verdict: retire
- reason: The launcher's fallback and drop; the one consequence a reader needs, a retired line under sustained overrun, stays as C063. Retired as the budget-fallback and disposable-cache sentences; C063 records the respell their departure forced on its antecedent. Its landing respelled C063's keep sentence; C063 records the flip.

### C061
- key: Expect the launcher to print nothing with exit 0 where the installed payload predates the widget; update the plugin to bring the widget in, since the doctor's `-Fix` only copies the launcher.
- class: mechanic
- source: plugins/claude-kit/skills/kit-goal/SKILL.md:92
- provenance: 3db65f2 2026-08-24 stated the blank-until-update behavior; e1613d8 2026-08-25 met it live when the installed copy predated the new exports.
- verdict: rewrite
- reason: Folds into C062's bound as the old-payload cause of a blank widget and the operator's remedy; the launcher-newer-than-payload note is reference. Lands folded into C062's bound at line 92 as 'either the installed payload predates the widget, so the launcher prints nothing at exit 0, or something faulted' and 'Updating the plugin is what brings the widget in, since the doctor's `-Fix` copies only the launcher.'; the launcher-newer-than-payload note leaves as reference. C062 records the respell. Its landing respelled C062's keep sentence; C062 records the flip.

### C062
- key: Read a blank widget beside a plan run as a fault or a stale payload rather than as an unleashed run, since an unleashed run renders `🎯 unarmed`.
- class: rule
- source: plugins/claude-kit/skills/kit-goal/SKILL.md:94
- provenance: 72309c6 2026-08-29: blank had meant nothing armed and the architecture doc said the inverse of what shipped, so nothing-armed became an affirmative line.
- verdict: rewrite
- reason: Incident-born and unenforceable by the widget, which cannot annotate its own silence; the three-readings enumeration is what makes it checkable. Flipped from keep to rewrite at section 27's close: C061's rewrite folded the old-payload cause and the operator's remedy into this bound, so the blank-widget clause reads 'prints nothing at exit 0' and a remedy sentence follows it, and the sentence was respelled to stand as landed. Landed as the proposal below.
- proposed: Blank means the widget said nothing: either the installed payload predates the widget, so the launcher prints nothing at exit 0, or something faulted, a goal-state file sitting at its path unreadable among the causes. Updating the plugin is what brings the widget in, since the doctor's `-Fix` copies only the launcher.

### C063
- key: On a box where every refresh overruns the budget, the launcher keeps drawing the last cached line, so a cleared goal can still show its armed line.
- class: rationale-example
- source: plugins/claude-kit/skills/kit-goal/SKILL.md:94
- provenance: e1613d8 2026-08-25 (budget fallback); 72309c6 2026-08-29 placed it beside the three readings.
- verdict: rewrite
- reason: The one case where a non-blank armed line is untrustworthy; the class is live on any saturated box and nothing marks a retired line. Flipped from keep to rewrite at section 27's close: C060's retire took the cache sentences 'the retired line the paragraph above describes' pointed at, so the antecedent reads 'a retired line', and the sentence was respelled to stand as landed. Landed as the proposal below. Fixed at section 27's close: 'the cache' and 'the budget' respelled as 'the launcher's render cache' and 'the launcher's time budget' (`RENDER_BUDGET_MS` in `scripts/kit-statusline.js`), their defining sentences having left under C059 and C060; the proposal below is the landed sentence.
- proposed: A fourth reading sits outside the three, a retired line: only a render reaches the launcher's render cache, so on a box saturated enough that every refresh overruns the launcher's time budget it keeps drawing the last line it cached, and a goal cleared under that load still shows its armed line until one refresh comes in under the budget.

### C064
- key: Expect the `kit-goal-stop.js` Stop hook, wired in the plugin's `hooks.json`, to fire on every stop but no-op unless a goal is armed in the current project and the stopping session holds the leash.
- class: mechanic
- source: plugins/claude-kit/skills/kit-goal/SKILL.md:98
- provenance: 6806b04 2026-07-16 installed the hook; 1fc31b0 2026-07-16 bound it to one session after a bystander quoting the plan path was leashed.
- verdict: retire
- reason: The hook's own predicate, wired and tested; the ledger keeps the one-line statement that it is a no-op for any session but the leash holder. Retired to the predicate 'The `kit-goal-stop.js` Stop hook is a no-op unless a goal is armed in the current project and the stopping session holds the leash.', the `hooks.json` wiring and the fires-on-every-stop clause leaving; C067 records the respell. Its landing respelled C067's keep sentence; C067 records the flip.
- proposed: Line 98 reduces to: the hook is a no-op unless a goal is armed here and the stopping session holds the leash; one binding rides the whole queue and survives auto-compaction; arm from the session that should hold the leash; the re-arm rule.

### C065
- key: Expect an arm to bind the running session only when a transcript for the session id read from its shell exists on this machine, and to arm unbound otherwise.
- class: mechanic
- source: plugins/claude-kit/skills/kit-goal/SKILL.md:98
- provenance: 8ecf3a9 2026-08-20, arm-time binding under the two-key gate after a run sat twelve hours armed-unbound; ef05bed 2026-09-02 stopped a planted relative transcript path being read.
- verdict: retire
- reason: The CLI's gate; the transcript check exists for liveness, not authenticity (1819e2c), which is the fact a future change must not lose. Retired as the arm-time binding sentences of line 98. The claim's second carrier, line 24's 'binds only after corroborating it against a transcript on disk', stays: no entry under this heading keys it.

### C066
- key: Expect an unbound leash to be claimed at a session's first stop or first auto-compaction offer, by the user's `/kit-goal` arming text (command arguments or a typed message's argument block naming the plan) or by a session whose own id equals the recorded arming session id, and by nothing else.
- class: mechanic
- source: plugins/claude-kit/skills/kit-goal/SKILL.md:98
- provenance: 1fc31b0 2026-07-16 (command-args claim, nothing else claims); 8ecf3a9 2026-08-20 (typed-lead shape); 4601330 2026-08-18 (the compaction-offer claim point, without which a well-behaved run never bound and the gate never engaged); 1819e2c 2026-08-29 (the recorded-id route).
- verdict: retire
- reason: One exported predicate, armingSessionClaims, owns both claim points in kit-goal-stop.js and kit-compact-gate.js; the incident chain above is why there are two claim points and two signals, and it lives here. Retired whole: the two claim points, both signals, the argument-block shape, the recorded-id route, the nothing-else-claims enumeration and the two-claim-points rationale. The recap skill's line 30 points a reader at this skill for the claim signals; `armingSessionClaims` in `hooks/kit-goal-lib.js` is where they live. Its landing respelled C067's keep sentence; C067 records the flip.

### C067
- key: Arm from the session that should hold the leash.
- class: rule
- source: plugins/claude-kit/skills/kit-goal/SKILL.md:98
- provenance: 1fc31b0 2026-07-16.
- verdict: rewrite
- reason: The session's act and the one thing the binding machinery cannot do for it; it stands as its own sentence once the predicate description leaves. Flipped from keep to rewrite at section 27's close: C064's and C066's retires took the predicate description this clause hung from as 'so arm from the session that should hold the leash', so the clause stands as its own sentence, and the sentence was respelled to stand as landed. Landed as the proposal below.
- proposed: Arm from the session that should hold the leash.

### C068
- key: Expect one binding to ride the whole queue and to survive auto-compaction, with no other session leashed however often it mentions the plan, and a bystander told at session start that the leash is another session's, with the re-arm path given.
- class: mechanic
- source: plugins/claude-kit/skills/kit-goal/SKILL.md:98
- provenance: 1fc31b0 2026-07-16 (bystanders never leashed); 9c68506 2026-07-31 (native compaction preserves the id); dbf5e6a 2026-08-16 (one binding across the queue, the bystander notice).
- verdict: retire
- reason: Program behavior across kit-goal-stop.js and session-start.js; the one-binding-rides-the-queue fact survives in the rewritten line 98 because the re-arm rule depends on it. Retired to 'One binding rides the whole queue and survives auto-compaction.', the bystander notice and the never-leashed-however-often enumeration leaving.

### C069
- key: Re-arm with `/kit-goal <plan paths>` to reset the binding when a bound session died and its work resumes in a new one, naming the remaining plans mid-sequence because a re-arm replaces the queue rather than resuming it.
- class: mechanic
- source: plugins/claude-kit/skills/kit-goal/SKILL.md:98
- provenance: 1fc31b0 2026-07-16 (re-arm resets the binding); dbf5e6a 2026-08-16 (remaining plans, replace not resume); kaizen/notes-NEO-CLAUDE.md 2026-09-03 records re-arms run on relayed instructions without the flag.
- verdict: rewrite
- reason: No conflict with executing-work:95, which is the run re-arming for itself with `--self-armed`; the sentence should name both invokers and the flag the run's own re-arm carries, since the invoker is what the record has gotten wrong. Lands as 'Re-arming resets the binding, which is the recovery when a bound session died and its work resumes in a new one: a typed `/kit-goal <plan paths>` is the operator's re-arm and `arm --self-armed <plan paths>` is a run re-arming for itself. Mid-sequence it names the remaining plans, since a re-arm replaces the queue rather than resuming it.' The executing-work:95 cite is a fence line at the landing; the arm-on-receipt paragraph sits at line 67 under the bold lead 'A plan arriving mid-run is itself the trigger to arm it'; prefer the lead over the line.
- proposed: Line 98's re-arm sentence names the remaining plans, says a typed `/kit-goal` is the operator's re-arm and a run re-arming for itself uses `arm --self-armed`, and keeps "a re-arm replaces the queue rather than resuming it".
- baseline-test: yes

### C070
- key: Expect conditions (a) and (b) to release the stop on the last plan, and on any earlier plan to record the outcome, advance the leash, and block the stop with a reason naming the finished plan, the new current plan, and the instruction to continue it.
- class: mechanic
- source: plugins/claude-kit/skills/kit-goal/SKILL.md:100
- provenance: dbf5e6a 2026-08-16, the queue advance; 050da02 2026-08-29 took the misfiled-plan walk off the reason after the repair told a run its own blocker did not apply to it.
- verdict: retire
- reason: The hook's decision procedure, whose block reason tells the session what happened at the point of action. Retired as the queue-position sentences, the line reducing to 'When the stopping session holds the leash, the hook reads the stop against the conditions below.'
- proposed: Lines 100-106 reduce to the three conditions as the session meets them, the fake-WAITING stall with its re-arm recovery, and the composeCondition pointer.

### C071
- key: Expect condition (c) to allow the stop at any queue position, recording nothing and leaving the queue exactly as it stood.
- class: mechanic
- source: plugins/claude-kit/skills/kit-goal/SKILL.md:100
- provenance: 09c91a4 2026-08-06; 10518d6 2026-08-31 last touched the line.
- verdict: retire
- reason: The hook's; recorded here so a WAITING is never made to advance the queue. Retired with C070's sentences.

### C072
- key: Satisfy condition (a) by the plan's `Status` reading `Complete` or the plan file having moved to the archive, which on the last plan also auto-clears the goal.
- class: mechanic
- source: plugins/claude-kit/skills/kit-goal/SKILL.md:102
- provenance: 6806b04 2026-07-16.
- verdict: keep
- reason: The state the session brings about to release; the Status lifecycle is curating-docs' and this names which value the hook reads.

### C073
- key: Satisfy condition (b) by opening the last assistant message with `BLOCKED:` as its very first characters; a mid-message, bolded or heading `BLOCKED:` does not release.
- class: mechanic
- source: plugins/claude-kit/skills/kit-goal/SKILL.md:103
- provenance: 6806b04 2026-07-16; f1ff4fa 2026-07-23 aligned it with the hook's trimStart-and-startsWith semantics after summary-first stops bounced three times in one session.
- verdict: rewrite
- reason: The hook's literal-prefix match is kit-goal's side of a moment split with executing-work's authoring rule; strict matching is the intent verifier by design. Flipped from keep to rewrite at section 27's close: C075's retire took the sentence that closed condition (b) after this one, so the terminal mark carries the list's '; or', and the sentence was respelled to stand as landed. Landed as the proposal below.
- proposed: The match is the literal leading prefix: a `BLOCKED:` line mid-message, or one wrapped in bold or a heading, does not release; or

### C074
- key: Expect the hook to refuse a `BLOCKED:` whose stated reason is capacity, citing the completion contract.
- class: mechanic
- source: plugins/claude-kit/skills/kit-goal/SKILL.md:103
- provenance: 4d80091 2026-08-01: hours-long silent pauses under a leash released by "BLOCKED: I'm at my context limit"; the predicate is two-tier so domain nouns are not refused.
- verdict: retire
- reason: The hook refuses it mechanically and executing-work:55 owns the authoring rule; the two-tier predicate design is recorded here. Retired as the capacity-refusal sentence of condition (b). The executing-work:55 cite sits at line 53 at the landing ('the message's very first characters are `BLOCKED:`'), with the capacity exclusion at line 47 ('The set is closed. Capacity is never on it'); prefer the phrases over the lines.
- proposed: (via A094) Drop the capacity sentence from (b); executing-work keeps the rule and the hook enforces it.

### C075
- key: Expect a mid-queue blocker to be recorded and the queue to move on to the plans behind it.
- class: mechanic
- source: plugins/claude-kit/skills/kit-goal/SKILL.md:103
- provenance: dbf5e6a 2026-08-16: one plan waiting on a decision is not a reason to abandon the plans behind it.
- verdict: retire
- reason: The hook's advance; its block reason names the new current plan at the point of action. Retired as the mid-queue-blocker sentence of condition (b); C073 records the respell. Its landing respelled C073's keep sentence; C073 records the flip.
- proposed: (via A096) Drop the sentence; the ledger keeps the reason one blocked plan does not abandon the queue.

### C076
- key: Satisfy condition (c) by opening the last assistant message with `WAITING:` as its very first characters and naming what is pending, either dispatched background work or a park at a safe boundary taken on request; the goal stays armed and the first stop after the wake re-enters enforcement.
- class: mechanic
- source: plugins/claude-kit/skills/kit-goal/SKILL.md:104
- provenance: 09c91a4 2026-08-06 (kaizen: sessions burned eight blocks or faked foreground blocks to wait on background work); 10518d6 2026-08-31 widened the shape to a park taken on a request, the predicate the receiver can evaluate.
- verdict: rewrite
- reason: What a WAITING may name and that a park is taken on a request are unenforced and the session's; the request gate is operator-decision class by 10518d6's own reasoning and stays. Flipped from keep to rewrite at section 27's close: C077's retire took the capacity half of the sentence, so it ends at 'rule applies', and the sentence was respelled to stand as landed. Landed as the proposal below.
- proposed: The same literal-leading-prefix rule applies.

### C077
- key: Expect the hook to refuse a `WAITING:` for context, compaction or a fresh session, which is not background work.
- class: mechanic
- source: plugins/claude-kit/skills/kit-goal/SKILL.md:104
- provenance: 09c91a4 2026-08-06: the capacity refusal judges WAITING too, or WAITING becomes the escape hatch.
- verdict: retire
- reason: Refused mechanically by the hook; executing-work:59 and park:50 own the authoring bar. Retired as the capacity clause of condition (c)'s literal-prefix sentence; C076 records the respell. The executing-work:59 cite is the park occasion at the landing; the capacity bar sits at line 47 ('Capacity is never on it'); prefer the phrase over the line. The park:50 cite holds. Its landing respelled C076's keep sentence; C076 records the flip.
- proposed: (via A103) Drop the capacity sentence from (c).

### C078
- key: Expect a `WAITING:` that is neither a park nor an awaited dispatch to stall the run rather than release it, with the armed goal still visible at session start and to the doctor, and re-arming as the recovery.
- class: mechanic
- source: plugins/claude-kit/skills/kit-goal/SKILL.md:104
- provenance: 09c91a4 2026-08-06 (a fake WAITING stalls visibly); 10518d6 2026-08-31 added the parked-coordinator carve-out.
- verdict: keep
- reason: The consequence a session must know to not fake a WAITING, reported by no program; the coordinator wake is the park working, not the stall.

### C079
- key: Expect the hook otherwise to block the stop with a reason naming the plan, re-evaluating the conditions on every stop attempt including inside a stop-hook continuation.
- class: mechanic
- source: plugins/claude-kit/skills/kit-goal/SKILL.md:106
- provenance: 39d7397 2026-07-16 dropped the stop_hook_active early exit that had made the leash one-shot per turn.
- verdict: retire
- reason: The hook's; recorded here so the early exit is not re-added. Retired as the otherwise-blocks sentence and the re-evaluates sentence.
- proposed: Drop the two sentences; keep the composeCondition pointer (C081).

### C080
- key: Rely on Claude Code's consecutive-block cap (eight blocks without progress, `CLAUDE_CODE_STOP_HOOK_BLOCK_CAP`) as the loop backstop, and expect any error inside the hook to allow the stop.
- class: mechanic
- source: plugins/claude-kit/skills/kit-goal/SKILL.md:106
- provenance: 39d7397 2026-07-16 (the cap as backstop); 6806b04 2026-07-16 (fails safe on every axis, never traps).
- verdict: retire
- reason: The harness's cap and the hook's fail-open posture, which the security document states; the never-trap posture is the design constraint recorded here. Retired as the consecutive-block-cap sentence and the fail-open sentence; `hooks/kit-goal-stop.js` (its header comment near line 107) and `test/kit-goal-stop.test.js` (near line 1443) carry the cap.

### C081
- key: Take the canonical condition text from `composeCondition` in `hooks/kit-goal-lib.js`; this skill does not restate the literal.
- class: mechanic
- source: plugins/claude-kit/skills/kit-goal/SKILL.md:106
- provenance: 6806b04 2026-07-16.
- verdict: keep
- reason: The anti-drift pointer that makes retiring the condition descriptions safe; the literal has one owner.

### C082
- key: Expect `goal-complete` and `goal-blocked` to append one line each to `~/.claude/kit-events.jsonl`, every line carrying `ts`, `event`, `project`, `plan` and `session`, with `detail` (`plan-complete` or `plan-archived`) where there is one and `run` only where the environment names a well-formed `KIT_RUN_ID`.
- class: mechanic
- source: plugins/claude-kit/skills/kit-goal/SKILL.md:110
- provenance: dbf5e6a 2026-08-16 corrected the exactly-once claim under a queue; 050da02 2026-08-29 last reworded the line.
- verdict: retire
- reason: The emitter's line shapes, documented in architecture.md and carried for consumers by the operator memory kit-goal-event-stream-contract. Retired to '`goal-complete` and `goal-blocked` are the two event values, and `eventsSink` in `hooks/kit-goal-lib.js` owns the sink they append to and its override.', the two event names kept where the proposal reduced the line to the pointer alone, since the paragraph below reads `goal-blocked` by name; the `~/.claude/kit-events.jsonl` path leaves with the line shapes.
- proposed: Line 110 reduces to a pointer at eventsSink for the sink and its override.

### C083
- key: Redirect the events sink for a test or sandboxed run by setting both `KIT_EVENTS_PATH` and `KIT_EVENTS_PATH_ALLOW=1`; the path variable alone is ignored with a one-time stderr note while the real sink is used.
- class: mechanic
- source: plugins/claude-kit/skills/kit-goal/SKILL.md:110
- provenance: 050da02 2026-08-29 first named the gate in the skill; eventsSink owns it.
- verdict: retire
- reason: eventsSink prints its own note when the path is set alone, so a test author meets the gate at the point of use; the line keeps a pointer at eventsSink. Retired as the override gate, the pointer at `eventsSink` riding in C082's landing.

### C084
- key: Read a `goal-blocked` count as turn-ends under a standing blocker, not as a count of distinct blockers or a complete record of every blocked stop.
- class: rule
- source: plugins/claude-kit/skills/kit-goal/SKILL.md:112
- provenance: 050da02 2026-08-29: the coordinator funnel claimed one event per blocked stop, which the spent-key suppression falsifies.
- verdict: keep
- reason: A consumer's reading rule no emitter enforces; the emitter's statelessness and probe inflation are its reason and live here.

### C085
- key: To count blockers, dedup on the blocker's own identity, the recorded note where one survives or the plan and session it names, never on how many lines the stream holds.
- class: rule
- source: plugins/claude-kit/skills/kit-goal/SKILL.md:112
- provenance: 050da02 2026-08-29.
- verdict: keep
- reason: The consumer's dedup policy, which the operator memory also states as the consumer's own.

### C086
- key: Expect a stop that re-reads the very transcript entry an advance already consumed to be suppressed whole by the goal state's recorded key: it advances nothing, emits nothing, and holds the stop with its own reason.
- class: mechanic
- source: plugins/claude-kit/skills/kit-goal/SKILL.md:112
- provenance: 050da02 2026-08-29.
- verdict: retire
- reason: The hook's spent-key check; recorded here as the one blocked stop that emits nothing, which is why the count is not a complete record. Retired as the spent-key sentence.
- proposed: Drop; the ledger notes it as the one non-emitting blocked stop.

### C087
- key: Expect the arm command to write the goal state atomically.
- class: mechanic
- source: plugins/claude-kit/skills/kit-goal/SKILL.md:16
- provenance: dbf5e6a 2026-08-16.
- verdict: retire
- reason: The CLI's write guarantee, with nothing for the caller to do. Retired as the clause 'and writes the state atomically', the line ending at 'validates every plan'.
- proposed: Drop "and writes the state atomically" from line 16.

### C088
- key: Expect an operator-typed arming's parallelization request to be recorded in the goal state's condition text and restated in the Stop hook's enforcement block.
- class: mechanic
- source: plugins/claude-kit/skills/kit-goal/SKILL.md:50
- provenance: de0d887 2026-08-15 placed the request where the text reaches a session: composeCondition, the block reason, the session-start notice.
- verdict: retire
- reason: composeCondition and the hook carry it; the placement reasoning is recorded here. Retired as the paragraph's closing sentence, the paragraph ending at 'still needs asking'.
- proposed: (via A029) Line 50 drops the sentence on where the request is written and keeps the rest.

### C089
- key: Treat any of the three reply states as ending the sender's re-sending of the handoff, even though only the armed acknowledgment converts it.
- class: rule
- source: plugins/claude-kit/skills/kit-goal/SKILL.md:64
- provenance: f75e235 2026-08-26, the answered-versus-converted split spelled the same on every surface.
- verdict: keep
- reason: Incident-born and consistent with peer-sessions:39, which holds the handoff open only until a reply arrives; the line-66 re-send sentence that read against it becomes a pointer. The peer-sessions:39 cite sits at line 37 at the landing, the paragraph opening 'A dispatch that expects an arm names its anchor'; prefer the opener over the line.

### C090
- key: Bound the arming text's argument block to the lines from the /kit-goal token up to the first blank line, fence, or tag line.
- class: mechanic
- source: plugins/claude-kit/skills/kit-goal/SKILL.md:98
- provenance: 8ecf3a9 2026-08-20, the typed-lead claim shape, the analogue of the markup span boundary.
- verdict: retire
- reason: The claim predicate's own boundary, parsed by the hook; the session types nothing differently for it. Retired with C066's enumeration.
- proposed: Drop with the claim-signal description under A082.
