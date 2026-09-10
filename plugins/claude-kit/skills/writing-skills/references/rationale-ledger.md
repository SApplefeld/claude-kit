# Rationale ledger: writing-skills

This file is the rationale ledger for the documents the `writing-skills` skill owns. Rule text says what happens; this ledger says why; git says when. Nobody loads it by default. A session about to change a rule in one of the documents below reads the entry for the claim it is changing first, so the reason a rule holds is not re-litigated at the next review.

Each document sits under its own heading, which opens with its inventory line (what the document is for, which moments it owns, and when a session loads it) and then carries one entry per claim, retired claims included so the next audit does not re-find them. An entry is keyed by the claim's imperative sentence and carries its class (rule, mechanic, pointer, or rationale-example), its source as file and line, its provenance (the commit, incident, memory or kaizen note that installed it, or `no provenance found`), and its verdict (keep, rewrite, or retire) with the reason. A `C` entry's source line is read at the extraction commit `6bc07fb`; an `R` entry is a claim re-extracted from a hunk the Section 5 merge changed, and its source line is read at the merged commit `d9540ad`. Claim numbers restart under every document heading, and inside a document read in chunks they restart per chunk, so an entry id is unique only under its heading and a chunked document carries the chunk in the id (`c2.C001` is claim C001 of the second chunk); a claim named inside a reason or provenance line of such a document carries the same prefix. A `C` entry whose source hunk the Section 5 merge rewrote reads `retire` and carries a `superseded-by:` line naming the `R` entry that holds the passage at the merged commit; the passage's own verdict is that entry's, so a count of retirements over this ledger leaves those records out. A reason may name the form the judge ruled toward (a pointer at the owner, a split, a fold into a neighbour), because that form is why the verdict is rewrite rather than keep or retire; what a passage becomes is the rewrite plan's to decide, and where the two differ the rewrite plan governs. The target wording a judge proposed is recorded in the corpus audit plan's scratch adjudication log (the plan is `claude-kit_corpus-audit_spec_v1.md` under `docs/`), which is that plan's transient scratch: its rewrite section consumes the log, and the rewrite plan it writes under `docs/plans/` is the durable home of any target wording once written. The baseline-test flag on a behavior-shaping rewrite rides in the entry's reason line.

## plugins/claude-kit/skills/writing-skills/SKILL.md

This document is the kit's rulebook for authoring and amending behavior-shaping prose. It owns the moments where a session decides whether a new skill earns a file at all, how a SKILL.md is shaped (frontmatter, body, one owner per rule, size-budget caps), how a description states its trigger, which rule form fixes which observed failure, what facts a rule may rest on, the three sentence-shape bars for any prose the kit ships in its own voice, the paragraph-as-edit-unit rule for correcting a claim in curated prose and how carriers of that claim on other surfaces are routed, and the RED/GREEN/REFACTOR probe discipline (including the probe-corpus before-and-after pair, doctrine-probe staging, and the contaminated-RED case) that must run before a wording change is trusted. Its load class is `named-trigger`: the frontmatter says to use it when creating or editing a skill, when judging whether a wording change will change behavior, or when amending curated prose the kit ships, with triggers such as adding a new SKILL.md, reworking a skill's rules, correcting a claim a curated document states, or a kaizen change to the kit's own skills.

Extracted at `6bc07fb`: whole document (`skills.writing-skills.SKILL.md`). Re-extracted at `4b2e64c` over the hunks the Section 8 merge changed (`S` entries below).

### C001
- key: Name the specific failure a skill change is meant to fix before writing the change.
- class: rule
- source: plugins/claude-kit/skills/writing-skills/SKILL.md:8
- provenance: 830ff28 2026-06-17, the writing-skills skill ported from a fork with the session-mined completion contract; no incident beyond the port.
- verdict: retire
- reason: Line 33 (C036) owns the rule with the table that makes it actionable; line 8 is the opening summary, and the one-owner rule this file carries makes a summary restatement the copy. Safe because the owner sits in the same file and nothing loads line 8 without line 33.

### C002
- key: Pick the rule form that fixes the named failure rather than any form you prefer.
- class: rule
- source: plugins/claude-kit/skills/writing-skills/SKILL.md:8
- provenance: 830ff28 2026-06-17, the fork port; no incident beyond the port.
- verdict: retire
- reason: C036 owns the form-picking rule and the failure table; the line 8 clause is a restatement in the opening summary.

### C003
- key: Confirm the new wording actually works before trusting it.
- class: rule
- source: plugins/claude-kit/skills/writing-skills/SKILL.md:8
- provenance: 830ff28 2026-06-17, the fork port; no incident beyond the port.
- verdict: retire
- reason: C083 at line 79 owns the rule with the method (watch an agent with and without the wording); the line 8 clause is the summary of it.

### C004
- key: Create a skill only where the technique is non-obvious, recurs across efforts, and is general.
- class: rule
- source: plugins/claude-kit/skills/writing-skills/SKILL.md:12
- provenance: 830ff28 2026-06-17, the fork port; no incident beyond the port.
- verdict: keep
- reason: No finding. The create test is the only statement of when a skill earns a file, and no hook or test judges it.

### C005
- key: Put a single project's convention in that project's CLAUDE.md, not in a skill.
- class: rule
- source: plugins/claude-kit/skills/writing-skills/SKILL.md:12
- provenance: 830ff28 2026-06-17, the fork port; no incident beyond the port.
- verdict: keep
- reason: No finding. The routing of a project convention away from the kit is unenforced and recurs at every kaizen change.

### C006
- key: Do not create a skill for a one-off, a restatement of standard practice, or anything a hook or regex can enforce.
- class: rule
- source: plugins/claude-kit/skills/writing-skills/SKILL.md:13
- provenance: 830ff28 2026-06-17, the fork port; no incident beyond the port.
- verdict: keep
- reason: No finding. The do-not-create list is the negative half of C004 and closes with the automate-the-mechanical class.

### C007
- key: Automate mechanically enforceable rules and reserve skills for judgment.
- class: rule
- source: plugins/claude-kit/skills/writing-skills/SKILL.md:13
- provenance: 830ff28 2026-06-17, the fork port; no incident beyond the port.
- verdict: keep
- reason: No finding. This is the principle the audit's own retire-as-superseded verdict rests on, and nothing enforces it mechanically.

### C008
- key: A new skill must beat the alternative of adding one more paragraph to an existing skill.
- class: rule
- source: plugins/claude-kit/skills/writing-skills/SKILL.md:14
- provenance: 830ff28 2026-06-17, the fork port; no incident beyond the port.
- verdict: keep
- reason: The bar stands as worded; the antipattern copy at line 100 (C132) retires and the cost claim (C010) moves here. The why: every skill is paid for in every session's skill list, since the skill catalog rides every session's prompt.

### C009
- key: When in doubt, fold the guidance into an existing skill rather than adding a file.
- class: rule
- source: plugins/claude-kit/skills/writing-skills/SKILL.md:14
- provenance: 830ff28 2026-06-17, the fork port; no incident beyond the port.
- verdict: keep
- reason: The default stands as worded; the line 100 antipattern that restated it retires, and no machinery decides the fold-versus-file call.

### C010
- key: Weigh a new skill knowing every skill is paid for in every session's skill list.
- class: rationale-example
- source: plugins/claude-kit/skills/writing-skills/SKILL.md:14
- provenance: 830ff28 2026-06-17, the fork port; no incident beyond the port.
- verdict: retire
- reason: The lean bar (C008) is obeyed without the cost claim, so the why lives here: a skill's description sits in every session's skill list, so every skill costs every session context whether or not it loads.

### C011
- key: A curated file that grows raises its size cap in the same change, and one that shrinks lowers it.
- class: rule
- source: plugins/claude-kit/skills/writing-skills/SKILL.md:15
- provenance: c591c49 2026-09-08, the operator's mid-run ruling that Subtraction Bars was meant to encourage cutting and never to forbid adding, which turned the ratchet from a ceiling into a ledger and gave kit-size a sync verb.
- verdict: rewrite
- reason: The rule holds; its sentence also carries the sync command and the shared-checkout reason at sixty words, which the file's own one-idea bar forbids. Split into rule, then command; the ratchet test (test/size-ratchet.test.js) reds a stale cap but nothing moves one for the session.

### C012
- key: Move caps with `node <plugin-root>/scripts/kit-size.js sync --repo <project root> <path>...`, naming the files the change touched.
- class: mechanic
- source: plugins/claude-kit/skills/writing-skills/SKILL.md:15
- provenance: c591c49 2026-09-08, the sync verb added to kit-size.js in the same commit as the ledger rule.
- verdict: keep
- reason: The ratchet test makes a stale cap visible but nothing runs sync for the session, and the path list is the writer's choice. The why of naming paths (C013, moved here): on a shared checkout the bare form would move the caps of a peer's in-flight files into your diff.

### C013
- key: Name the touched paths so a peer's in-flight files' caps stay out of your diff on a shared checkout.
- class: rationale-example
- source: plugins/claude-kit/skills/writing-skills/SKILL.md:15
- provenance: c591c49 2026-09-08, written on a shared checkout where a peer's kaizen inbox was mid-edit.
- verdict: retire
- reason: The instruction to name the touched paths is obeyed without the consequence, and the bare form's own refusal on a dirty tree covers the case mechanically; the why now lives under C012.

### C014
- key: Give a new curated file its first cap through the same sync command, whether or not it is added to git yet.
- class: rule
- source: plugins/claude-kit/skills/writing-skills/SKILL.md:15
- provenance: c591c49 2026-09-08, sync adds a first cap for a named path the budget lacks.
- verdict: keep
- reason: No finding of its own; it survives the line 15 split as its own sentence. The named-path form is what admits an untracked file, which the bare form refuses.

### C015
- key: Use the bare sync form with no paths only in an audit over a clean tree; it moves every cap and refuses on divergence from HEAD.
- class: mechanic
- source: plugins/claude-kit/skills/writing-skills/SKILL.md:15
- provenance: c591c49 2026-09-08, the bare form's clean-tree refusal designed in the same commit.
- verdict: rewrite
- reason: The refusal conditions are enforced by plugins/claude-kit/scripts/kit-size.js (usage text: sync runs "over a clean tree"; refusal at exit 2 on a file or the budget differing from HEAD, untracked or ignored), so the enumeration retires as superseded; the form-choice sentence stays because no program decides which form a writer reaches for.

### C016
- key: Read the net size change on the Chapter's Delta line.
- class: mechanic
- source: plugins/claude-kit/skills/writing-skills/SKILL.md:15
- provenance: c591c49 2026-09-08, the Delta line named as where the net is read.
- verdict: keep
- reason: The Delta line is a Chapter field the writer reads; no program reads it for the session.

### C017
- key: Do not treat a cap raise as a finding on its own; weigh whether the added words earn their place.
- class: rule
- source: plugins/claude-kit/skills/writing-skills/SKILL.md:15
- provenance: c591c49 2026-09-08, the operator's ruling that the ratchet never forbids adding.
- verdict: keep
- reason: It is the reviewer's duty that follows from the ledger principle (C133), which the principle does not state; the two are one bullet by design and no test weighs words.

### C018
- key: When rewording a passage, take the shrink where one is available.
- class: rule
- source: plugins/claude-kit/skills/writing-skills/SKILL.md:15
- provenance: c591c49 2026-09-08, the third clause of the ledger bullet.
- verdict: keep
- reason: No finding of its own; it is the subtraction half of the ledger rule and nothing enforces it.

### C019
- key: Write one SKILL.md in the kit's voice: direct, opinionated, anti-dogma, with no em dashes.
- class: rule
- source: plugins/claude-kit/skills/writing-skills/SKILL.md:19
- provenance: 830ff28 2026-06-17, the port, which installed the no-em-dash rule in the doctrine and here in one commit.
- verdict: rewrite
- reason: The em-dash ban is the doctrine's Style bullet whole, with its scope; no test enforces it over the plugin payload, so it is a restatement rather than a superseded rule, and the doctrine owns it. Drop the item from the voice list; the rest of the line stands.

### C020
- key: Add a reference file only when the body outgrows the size of the kit's other skills, and gate it as csharp-style and sql-style do.
- class: rule
- source: plugins/claude-kit/skills/writing-skills/SKILL.md:19
- provenance: 830ff28 2026-06-17, the fork port; no incident beyond the port.
- verdict: keep
- reason: No finding. The reference-file gate is unenforced and the two style skills are its live instances.

### C021
- key: Always quote the frontmatter description value.
- class: rule
- source: plugins/claude-kit/skills/writing-skills/SKILL.md:20
- provenance: 830ff28 2026-06-17 installed it; 73a485e 2026-07-15 found eight agent descriptions unquoted under it and quoted them.
- verdict: keep
- reason: The rule stands; its mechanism (C022) moves here: an unquoted value containing a colon-space breaks the YAML silently and drops all skill metadata, and no test parses the frontmatter for the writer.

### C022
- key: Quote it because an unquoted value containing a colon-space breaks the YAML silently and drops all skill metadata.
- class: rationale-example
- source: plugins/claude-kit/skills/writing-skills/SKILL.md:20
- provenance: 830ff28 2026-06-17, the fork port.
- verdict: retire
- reason: The quote rule is mechanical and obeyed without the mechanism; the why now lives under C021.

### C023
- key: Treat `name` and `description` as the only frontmatter fields that matter.
- class: mechanic
- source: plugins/claude-kit/skills/writing-skills/SKILL.md:20
- provenance: 830ff28 2026-06-17, the fork port.
- verdict: keep
- reason: No finding. A harness fact the writer needs at authoring; note it is a harness claim and would fall under the line 96 antipattern if the harness gained a third field.

### C024
- key: Build the body from the principle, the rules that carry judgment, and the antipatterns.
- class: mechanic
- source: plugins/claude-kit/skills/writing-skills/SKILL.md:21
- provenance: 830ff28 2026-06-17, the fork port.
- verdict: keep
- reason: The anatomy every SKILL.md follows; the reader's compression of line 21 dropped it, which is why that compression was refused.

### C025
- key: Use tables and lists for content that gets scanned and prose for the why.
- class: rule
- source: plugins/claude-kit/skills/writing-skills/SKILL.md:21
- provenance: 830ff28 2026-06-17, the fork port.
- verdict: keep
- reason: Line 21's three sentences are each one idea and inside the bar; the compress finding was taste.

### C026
- key: Use a flowchart only for a decision where the agent might genuinely go wrong, never for linear steps.
- class: rule
- source: plugins/claude-kit/skills/writing-skills/SKILL.md:22
- provenance: 830ff28 2026-06-17, the fork port (the seed's 73a485e touched the line, not the sentence).
- verdict: keep
- reason: Stands with line 21; nothing to compress without loss.

### C027
- key: Give every rule exactly one owning site.
- class: rule
- source: plugins/claude-kit/skills/writing-skills/SKILL.md:22
- provenance: 73a485e 2026-07-15, the stabilization effort's authoring rule closing the drift generator it had reconciled (a dozen drifted copies, one in contradiction); the doctrine's "One owner per moment" bullet and the ownership map followed at 5cd8f22 2026-09-01.
- verdict: rewrite
- reason: The doctrine now owns the principle with its form list and carve-outs and ranks above the skill for principles, so line 22 points at the doctrine's bullet and the map, keeping the authoring residue (C030). The why (C029, moved here): a rule stated twice is two rules a week later; the 2026-07-14 audit found a dozen drifted copies, one in outright contradiction.

### C028
- key: Make every other mention of a rule a pointer or an operational residue at its point of action, never a restatement.
- class: rule
- source: plugins/claude-kit/skills/writing-skills/SKILL.md:22
- provenance: 73a485e 2026-07-15 installed the pointer form; ab3d766 2026-08-29 added the operational-residue form for the executing-work fix-round pointer.
- verdict: rewrite
- reason: Real conflict with the doctrine's form list, which licenses a whole copy under a parity pin or build step; d2e2f37 confirmed that carve-out lives in the doctrine and the map and not here, and line 73 already treats the pinned set as a disposition. Line 22 gives way to a pointer at the doctrine's forms; the doctrine's list lacks the residue form and should gain it in the same change (the operating-instructions unit's finding).

### C029
- key: Treat a rule stated twice as two rules a week later, as the 2026-07-14 stabilization audit's dozen drifted copies showed, one in outright contradiction.
- class: rationale-example
- source: plugins/claude-kit/skills/writing-skills/SKILL.md:22
- provenance: 73a485e 2026-07-15, the stabilization audit's own finding.
- verdict: retire
- reason: The rule is obeyed without the date and count, and a dated finding in a shipped document is journey under the doctrine's state-versus-journey bullet; the why now lives under C027.

### C030
- key: When editing a rule, grep its key phrases across the kit and fix the owning site rather than the nearest copy.
- class: rule
- source: plugins/claude-kit/skills/writing-skills/SKILL.md:22
- provenance: 73a485e 2026-07-15, the authoring mechanic of the one-owner rule.
- verdict: keep
- reason: The authoring residue the doctrine's principle does not carry; C076 at line 73 is its pointer-with-residue inside the carrier dispositions, not a duplicate, since ab3d766 found a three-disposition set defective.

### C031
- key: For the plan-doc header and structure, read and point at `curating-docs/SKILL.md`'s "machine contract" section rather than restating any of its lines.
- class: pointer
- source: plugins/claude-kit/skills/writing-skills/SKILL.md:23
- provenance: 662e5e3 2026-08-01, an external engine parsing every plan doc case-sensitively with nothing telling an author which lines are load-bearing; curating-docs took the contract and this skill a pointer.
- verdict: keep
- reason: No finding. A pointer at a frozen shape external tooling parses; the pointer sits here because this is the skill loaded when a plan doc's shape is written.

### C032
- key: Write a skill description as "Use when..." plus the symptoms that pull it in, and stop there.
- class: rule
- source: plugins/claude-kit/skills/writing-skills/SKILL.md:27
- provenance: 830ff28 2026-06-17, the fork port.
- verdict: keep
- reason: The rule stands as worded; line 27's opening sentence on what a description is for, and the mechanism (C034), are rationale that move here: the description is how a future session decides whether to load the skill.

### C033
- key: Do not summarize the skill's process in its description.
- class: rule
- source: plugins/claude-kit/skills/writing-skills/SKILL.md:27
- provenance: 830ff28 2026-06-17, the fork port; fdd7b82 2026-07-15 collapsed the stale live specimen to the rule and its evidence.
- verdict: keep
- reason: The rule stands; the antipattern copy at line 97 (C129) retires. The why (C034, C035 moved here): an agent that reads a process summary acts on the summary and skips the body, so a step the body insists on gets dropped; a description reading "code review between tasks" yielded one review where the body specified two.

### C034
- key: Omit the process summary because an agent acts on the summary and skips the body, dropping a step the body insists on.
- class: rationale-example
- source: plugins/claude-kit/skills/writing-skills/SKILL.md:27
- provenance: 830ff28 2026-06-17, the fork port.
- verdict: retire
- reason: The prohibition is obeyed without the mechanism; the why now lives under C033.

### C035
- key: Note that a description reading "code review between tasks" yields one review where the body specifies two.
- class: rationale-example
- source: plugins/claude-kit/skills/writing-skills/SKILL.md:29
- provenance: 830ff28 2026-06-17 as a live specimen naming executing-work's old description; fdd7b82 2026-07-15 collapsed it to this general example when the description changed.
- verdict: retire
- reason: A second illustration of the line 27 rule, which stands without either; the example now lives under C033.

### C036
- key: Name the failure first, then pick the form that fixes that failure.
- class: rule
- source: plugins/claude-kit/skills/writing-skills/SKILL.md:33
- provenance: 830ff28 2026-06-17, the fork port.
- verdict: keep
- reason: The owner of the name-then-pick rule, with the table and the bound that a form bulletproofing one failure backfires on another; C001 and C002 retire in its favour.

### C037
- key: For an agent that knows the rule but skips it under pressure, write a prohibition plus a rationalization table plus a red-flags list, not soft "prefer..." guidance.
- class: mechanic
- source: plugins/claude-kit/skills/writing-skills/SKILL.md:37
- provenance: 830ff28 2026-06-17, the fork port.
- verdict: keep
- reason: No finding. A table row pairing a failure with its form; unenforced.

### C038
- key: For compliant but wrong-shaped output, write a positive recipe stating what the output is and its parts in order, not a prohibition list.
- class: mechanic
- source: plugins/claude-kit/skills/writing-skills/SKILL.md:38
- provenance: 830ff28 2026-06-17, the fork port; 8cdb3f5 2026-09-04 records a section shipping the backfiring form this row names, which is the row's live incident.
- verdict: keep
- reason: The row owns the recipe rule with its backfire column; the antipattern copy at line 98 (C130) retires.

### C039
- key: For an omitted required element, add a structural slot: a REQUIRED field in the template the agent fills, not a prose reminder near the template.
- class: mechanic
- source: plugins/claude-kit/skills/writing-skills/SKILL.md:39
- provenance: 830ff28 2026-06-17, the fork port.
- verdict: keep
- reason: No finding. A table row; unenforced.

### C040
- key: Where behavior should depend on a condition, write a conditional on an observable predicate, not an unconditional rule plus exemption clauses.
- class: mechanic
- source: plugins/claude-kit/skills/writing-skills/SKILL.md:40
- provenance: 830ff28 2026-06-17, the fork port.
- verdict: keep
- reason: The table row pairs one failure with its form; line 44 (C042) governs how any exception in any rule is written. Two scopes, both kept.

### C041
- key: Write no nuance clauses such as "don't X unless it matters", which reopen the negotiation.
- class: rule
- source: plugins/claude-kit/skills/writing-skills/SKILL.md:44
- provenance: 830ff28 2026-06-17, the fork port.
- verdict: keep
- reason: Three short sentences each one idea; the compress finding was taste. The quoted clause defines the term for the reader.

### C042
- key: Express a real exception as its own conditional on something observable.
- class: rule
- source: plugins/claude-kit/skills/writing-skills/SKILL.md:44
- provenance: 830ff28 2026-06-17, the fork port.
- verdict: keep
- reason: Governs any rule, where C040 is one table row; not a duplicate.

### C043
- key: Where part of the output must be exempt, restructure the rule so it cannot reach that part rather than adding an exemption clause.
- class: rule
- source: plugins/claude-kit/skills/writing-skills/SKILL.md:45
- provenance: 830ff28 2026-06-17, the fork port; 8cdb3f5 2026-09-04 records a draft carrying an exemption clause against this rule, its live incident.
- verdict: keep
- reason: The rule and its bound (exemption clauses do not scope) stand; the example (C044, moved here): "this limit excludes code blocks" still suppresses code blocks.

### C044
- key: Note that "this limit excludes code blocks" still suppresses code blocks.
- class: rationale-example
- source: plugins/claude-kit/skills/writing-skills/SKILL.md:45
- provenance: 830ff28 2026-06-17, the fork port.
- verdict: retire
- reason: The restructure rule is obeyed without the instance; the example now lives under C043.

### C045
- key: Close every enumeration by stating, where the list ends, the class its instances belong to.
- class: rule
- source: plugins/claude-kit/skills/writing-skills/SKILL.md:46
- provenance: 0605d85 2026-08-01, the capacity stop that rode a fatigue-shaped rationalization table no row of which matched a quality-shaped excuse.
- verdict: keep
- reason: Incident-born, recurrable at every list, and no machinery closes an enumeration; the two quoted closing phrases stay as the recipe. The why (C046, moved here): a list of instances reads as exhaustive the moment it ships, so an unlisted variant presents itself as licensed, and a class statement makes the novel variant meet the rule.

### C046
- key: Close the list because it reads as exhaustive on shipping, so an unlisted variant presents itself as licensed; a class statement makes a novel variant meet the rule.
- class: rationale-example
- source: plugins/claude-kit/skills/writing-skills/SKILL.md:46
- provenance: 0605d85 2026-08-01, the capacity stop.
- verdict: retire
- reason: The close-the-list rule is obeyed without the licensing account; the why now lives under C045.

### C047
- key: Where two framings of one fact are both true, ship the one the reader can verify from where they sit.
- class: rule
- source: plugins/claude-kit/skills/writing-skills/SKILL.md:52
- provenance: a5e184b 2026-08-25, a review round whose three Majors were one defect: motivating clauses whose asserted mechanism the file's own contract or a grep denied.
- verdict: keep
- reason: Incident-born and unenforced. The why (C049, C135 moved here): "`memq recall` returns the whole memory store as one bounded digest" and "the memory store is available in bulk" are the same fact and only the first names something the reader can run; a rule taken on trust cannot be repaired when the fact under it moves, so the reader keeps obeying a rule that describes nothing.

### C048
- key: Name the file, command, observable event, or artifact the fact lives in, and pick the framing that makes it findable.
- class: mechanic
- source: plugins/claude-kit/skills/writing-skills/SKILL.md:52
- provenance: a5e184b 2026-08-25, the same round.
- verdict: keep
- reason: The recipe half of C047; stays as its own sentence in the line 52 rewrite.

### C049
- key: Prefer "`memq recall` returns the whole memory store as one bounded digest" over "the memory store is available in bulk", because a rule taken on trust cannot be repaired when the fact underneath it moves.
- class: rationale-example
- source: plugins/claude-kit/skills/writing-skills/SKILL.md:52
- provenance: a5e184b 2026-08-25, the same round.
- verdict: retire
- reason: The rule names what a verifiable framing is (C048), so the pair demonstrates rather than defines; it now lives under C047.

### C050
- key: State a list drawn from observed instances as open unless a contract closes it.
- class: rule
- source: plugins/claude-kit/skills/writing-skills/SKILL.md:53
- provenance: a5e184b 2026-08-25, the same round (a search key anchored on a set name the rule's own worked examples did not carry).
- verdict: rewrite
- reason: Merged with C052 into one rule, since the bullet's closing sentence restated its opening plus "say what would close it". The why (C136, moved here): an enumeration extracted from one fully-observed sample reads as exhaustive to its writer because every field was present and nothing contradicted it, so a reader branching on a field's absence is wrong for every instance the sample never contained.

### C051
- key: Treat a list as closed only on a contract's authority: a schema, an enum, or a validated surface with a published shape, never a sample agreeing with itself.
- class: mechanic
- source: plugins/claude-kit/skills/writing-skills/SKILL.md:53
- provenance: a5e184b 2026-08-25, the same round.
- verdict: keep
- reason: The bound of C050, which the rule cannot be applied without; stays as its own sentence.

### C052
- key: Write the list as open and say what would close it, or cite the contract that already closes it.
- class: rule
- source: plugins/claude-kit/skills/writing-skills/SKILL.md:53
- provenance: a5e184b 2026-08-25, the same round.
- verdict: rewrite
- reason: Merged into C050; only the "say what would close it" clause is new and it rides in the merged sentence.

### C053
- key: Treat any fact a rule rests on that the reader cannot check or cannot see the edges of as inside this rule, even where no bullet names its form.
- class: rule
- source: plugins/claude-kit/skills/writing-skills/SKILL.md:55
- provenance: a5e184b 2026-08-25, the class closure this file's own line 46 requires.
- verdict: keep
- reason: No finding. The enumeration closure for the two fact bullets.

### C054
- key: To decide whether a sentence belongs at all, read the doctrine's "Documents ship the current state; the journey lives in git" bullet in `skills/operating-instructions/SKILL.md` under the kit plugin root.
- class: pointer
- source: plugins/claude-kit/skills/writing-skills/SKILL.md:59
- provenance: 8cdb3f5 2026-09-04, the subtraction-bars section 3 Critical: a delete test stated here reached append-only history and 94,000 words of reference documents, so whether a sentence belongs became the doctrine's call, pointed at.
- verdict: keep
- reason: No finding. The pointer is the repair for a widening both review lenses found independently; restating the litmus here is the defect it replaced.

### C055
- key: Write every sentence in the kit's own voice as one idea, in the literal phrase, pointing where another site owns the rule.
- class: rule
- source: plugins/claude-kit/skills/writing-skills/SKILL.md:61
- provenance: 8cdb3f5 2026-09-04 installed the three bars; d2e2f37 2026-09-05 touched the line in the finishing fix round.
- verdict: keep
- reason: The doctrine's plain-prose bullet names this file by path as carrying the sentence-shape bars for curated prose, so the overlap is a pointer already in place; two audiences (all operator-read prose; curated kit prose) by design.

### C056
- key: Make each sentence one idea, about twenty words.
- class: rule
- source: plugins/claude-kit/skills/writing-skills/SKILL.md:63
- provenance: 8cdb3f5 2026-09-04 installed the bar at forty words; 8b03bfb 2026-09-08 tightened it to twenty on the operator's relay request after reading a dense and a plain version of one plan sketch.
- verdict: keep
- reason: The doctrine points here for curated prose; scott-writing-style's 30-to-50-word sentences govern a document in the operator's voice, a different owner and audience. The shared figure is pinned on the doctrine's three copies (test/doctrine-parity.test.js) and not against this file, a drift risk to watch when either number moves.

### C057
- key: Write a rule and the bound that limits it as two sentences, the bound following the rule at once.
- class: rule
- source: plugins/claude-kit/skills/writing-skills/SKILL.md:63
- provenance: 8b03bfb 2026-09-08, the forty-word rule-plus-bound sentence being the exact shape the operator could not follow.
- verdict: rewrite
- reason: The sentence stating this rule runs to about forty words with its exception clause inside, which is the bar's own failure; split into rule, bound and exception, nothing removed.

### C058
- key: Use a word count past twenty as the diagnostic that finds a second idea, not as the bar itself.
- class: mechanic
- source: plugins/claude-kit/skills/writing-skills/SKILL.md:63
- provenance: 8b03bfb 2026-09-08, the twenty-word tightening.
- verdict: keep
- reason: Only this file says the twenty is a diagnostic rather than the bar; the doctrine points here.

### C059
- key: Read the word count per sentence and never as a target, since uniform sentence length is its own defect.
- class: rule
- source: plugins/claude-kit/skills/writing-skills/SKILL.md:63
- provenance: 8b03bfb 2026-09-08, installed in the doctrine's core and here together.
- verdict: keep
- reason: The doctrine's copy is the pinned register core for operator communication; this one sits beside the count it qualifies for curated prose. The doctrine side is the operating-instructions unit's to rule.

### C060
- key: Make each paragraph one point, or say inside the paragraph why its parts must be read together.
- class: rule
- source: plugins/claude-kit/skills/writing-skills/SKILL.md:63
- provenance: 8cdb3f5 2026-09-04, the one-idea bar's paragraph clause.
- verdict: keep
- reason: No finding of its own; survives the line 63 split as its own sentence.

### C061
- key: Use the literal phrase for the thing wherever one exists.
- class: rule
- source: plugins/claude-kit/skills/writing-skills/SKILL.md:64
- provenance: 8cdb3f5 2026-09-04 installed the literal-phrase bar naming mannered prose from Anthropic's guidance; 8b03bfb 2026-09-08 added the packed-sentence clause.
- verdict: keep
- reason: Stands as worded; the bullet's second sentence (C062) splits so the definition of mannered prose has its own sentence.

### C062
- key: Use a metaphor only where it is the established term for the thing; elsewhere it is mannered prose.
- class: rule
- source: plugins/claude-kit/skills/writing-skills/SKILL.md:64
- provenance: 8cdb3f5 2026-09-04, the literal-phrase bar.
- verdict: rewrite
- reason: The sentence carries the rule and the three-clause definition of mannered prose; the definition is the term's meaning and the bar cannot be applied without it, so it stays as its own sentence rather than being cut.

### C063
- key: Fix mannered prose by replacing it with the literal phrase.
- class: mechanic
- source: plugins/claude-kit/skills/writing-skills/SKILL.md:64
- provenance: 8cdb3f5 2026-09-04, the literal-phrase bar.
- verdict: keep
- reason: The fix sentence; the reader's compression dropped it, which is why that compression was refused.

### C064
- key: For the packed sentence, the nested qualification, and the reasoning-first order, read the doctrine's plain-prose bullet, which names each.
- class: pointer
- source: plugins/claude-kit/skills/writing-skills/SKILL.md:64
- provenance: 8b03bfb 2026-09-08, the plain-prose bullet added to the doctrine's core.
- verdict: keep
- reason: A pointer at the doctrine's bullet for the defects it names; the correct form under one-owner.

### C065
- key: For which forms a mention of another site's rule may take, read the one-owner rule under Anatomy; this bar adds no form and no exception.
- class: pointer
- source: plugins/claude-kit/skills/writing-skills/SKILL.md:65
- provenance: 8cdb3f5 2026-09-04, the third bar as a pointer at the Anatomy rule.
- verdict: keep
- reason: Stands; once line 22 points at the doctrine's form list (C028), this pointer resolves through it.

### C066
- key: Treat any prose that costs the reader more to read than it changes for them as inside the bar, even where none of the three bars names its form.
- class: rule
- source: plugins/claude-kit/skills/writing-skills/SKILL.md:67
- provenance: 8cdb3f5 2026-09-04, the class closure the review required after the draft's carve-out list did not close with its class.
- verdict: keep
- reason: The doctrine's re-read question is asked of a whole artifact; this is the class the three bars instance, which the doctrine's line defers to.

### C067
- key: When an amendment corrects a claim a curated document states, edit the whole paragraph, never a single sentence.
- class: rule
- source: plugins/claude-kit/skills/writing-skills/SKILL.md:71
- provenance: ab3d766 2026-08-29, review-and-record section 9: a fix round shipped the sentence-patch defect it had just corrected, leaving sibling surfaces stating the superseded claim.
- verdict: keep
- reason: Incident-born, recurs at every main-thread correction, and pinned only as to owner and pointer (test/doctrine-parity.test.js), not enforced. The why (C072, moved here): a sentence patch leaves the seam speaking the old claim, so the paragraph self-contradicts where the fix and its neighbour disagree, or a sibling goes on stating the corrected version.

### C068
- key: Re-derive the whole paragraph from the corrected claim.
- class: rule
- source: plugins/claude-kit/skills/writing-skills/SKILL.md:71
- provenance: ab3d766 2026-08-29, section 9.
- verdict: keep
- reason: The method of C067; stands as worded in the line 71 split.

### C069
- key: Check the claim's other carriers: the neighbouring clauses that qualified or restated it and any sibling surface stating the same behavior.
- class: rule
- source: plugins/claude-kit/skills/writing-skills/SKILL.md:71
- provenance: ab3d766 2026-08-29, section 9.
- verdict: keep
- reason: Stands as worded; the second round of that commit found three sibling surfaces left stating the superseded discriminator.

### C070
- key: Treat the edit unit as the claim across every surface carrying it, whether or not this skill names that surface.
- class: rule
- source: plugins/claude-kit/skills/writing-skills/SKILL.md:71
- provenance: ab3d766 2026-08-29, the reach sentence rewritten after the fix round shipped one excluding two named carriers.
- verdict: rewrite
- reason: The rule holds; it shares an eighty-word sentence with the carrier list (C071), and the split gives each its own sentence with nothing removed.

### C071
- key: Expect carriers such as a doctrine parity copy, the output style's register block, an agent charter, a test's assertion message, a memory record, and a README's payload map, as instances rather than the boundary.
- class: rationale-example
- source: plugins/claude-kit/skills/writing-skills/SKILL.md:71
- provenance: ab3d766 2026-08-29, each carrier a kind the round found left behind (a test's assertion message, a charter, a README payload map).
- verdict: rewrite
- reason: Kept in the document, not the ledger, because the rule cannot be reliably obeyed without it: the incident was carriers of unnamed kinds going unchecked. It becomes its own sentence, closed as instances.

### C072
- key: Avoid a sentence patch because it leaves the seam speaking the old claim or a sibling still stating the version you just corrected.
- class: rationale-example
- source: plugins/claude-kit/skills/writing-skills/SKILL.md:71
- provenance: ab3d766 2026-08-29, section 9.
- verdict: retire
- reason: The paragraph rule is obeyed without the account of what a patch leaves; the why now lives under C067.

### C073
- key: Give an amendment that corrects no claim whatever edit it needs, a typo fix, an added bullet, or a label rename among them.
- class: rule
- source: plugins/claude-kit/skills/writing-skills/SKILL.md:71
- provenance: ab3d766 2026-08-29, section 9's bound on the rule.
- verdict: keep
- reason: The observable predicate that keeps the paragraph rule from reaching a typo; stands as worded.

### C074
- key: Do not assume a carrier on another surface is yours to edit in place.
- class: rule
- source: plugins/claude-kit/skills/writing-skills/SKILL.md:73
- provenance: ab3d766 2026-08-29, the four dispositions for a carrier on another surface.
- verdict: keep
- reason: The paragraph's rule over every carrier, which the dispositions instance; C075 is the closure for a carrier fitting none, not a duplicate.

### C075
- key: Name a carrier fitting none of the four dispositions as such and route it deliberately, never editing it in place by default.
- class: rule
- source: plugins/claude-kit/skills/writing-skills/SKILL.md:73
- provenance: ab3d766 2026-08-29, added when the fix round found a closed set of three dispositions with no home for the kit's dominant carrier shape.
- verdict: keep
- reason: The class closure the file's own line 46 requires; incident-born and unenforced.

### C076
- key: Where the one-owner rule applies, fix the owning site rather than the nearest copy.
- class: rule
- source: plugins/claude-kit/skills/writing-skills/SKILL.md:73
- provenance: ab3d766 2026-08-29, the first disposition.
- verdict: keep
- reason: A pointer with its residue ("the one-owner rule above"), which is the form line 22 licenses, and one of four dispositions that a fix round found incomplete at three; not a duplicate of C030.

### C077
- key: Where the surfaces are a deliberate byte-identical set, land every copy in one edit or none.
- class: rule
- source: plugins/claude-kit/skills/writing-skills/SKILL.md:73
- provenance: ab3d766 2026-08-29, the second disposition, with the parity pins that commit landed.
- verdict: rewrite
- reason: The rule holds and its bound (a partial edit reds the parity pin by design) is enforced by the pins in test/doctrine-parity.test.js; the fifty-word sentence carrying it, the bound and C078 splits into three, nothing removed.

### C078
- key: Take the byte-identical set's size from what the parity pin says, not from the pair you first thought of.
- class: mechanic
- source: plugins/claude-kit/skills/writing-skills/SKILL.md:73
- provenance: ab3d766 2026-08-29, the parity pins spanning five surfaces where the round had assumed two.
- verdict: keep
- reason: Stands as its own sentence after the split; the reader's compression dropped it.

### C079
- key: Where the claim is a deliberate restatement across surfaces the section's scope already covers, land the correction on every one of them in the same edit.
- class: rule
- source: plugins/claude-kit/skills/writing-skills/SKILL.md:73
- provenance: ab3d766 2026-08-29, the third disposition.
- verdict: rewrite
- reason: The rule holds; its reason clause (a restatement corrected on one surface alone is the drift the restatement was pinned against) is rationale and moves here.

### C080
- key: Where a carrier sits in a file the section's `Files in scope:` never listed, route it by the fix-round step in `skills/executing-work/SKILL.md` under the kit plugin root instead of editing it in place.
- class: pointer
- source: plugins/claude-kit/skills/writing-skills/SKILL.md:73
- provenance: ab3d766 2026-08-29, the fourth disposition, its path shape pinned after the round shipped a repo-root-relative literal.
- verdict: keep
- reason: A pinned pointer at executing-work's fix-round step; the correct form.

### C081
- key: Apply this paragraph rule as a writer amending curated prose, whoever you are.
- class: rule
- source: plugins/claude-kit/skills/writing-skills/SKILL.md:75
- provenance: 6d2e6cc 2026-08-29, the finishing pass of review-and-record, where the main thread's own corrections had no reviewer between edit and commit.
- verdict: rewrite
- reason: The rule holds; the origin story (an orchestrator's main thread making scattered corrections between rounds, which no brief reaches) is journey and moves here as the why the rule sits on the writer's side.

### C082
- key: Do not assume a downstream reviewer will catch the amendment; what stands downstream differs by surface.
- class: rule
- source: plugins/claude-kit/skills/writing-skills/SKILL.md:75
- provenance: 6d2e6cc 2026-08-29, three fix-round passes each finding a universal about which pass reads which surface false at some site.
- verdict: rewrite
- reason: The rule holds as the safe assumption; its ninety-word bound enumerates finishing-work's and executing-work's dispatch conditions, which those skills own and which drifted here three times, so it becomes a pointer at them and cannot drift again.

### C083
- key: Test a skill by watching an agent's behavior with and without the new wording rather than trusting untested prose.
- class: rule
- source: plugins/claude-kit/skills/writing-skills/SKILL.md:79
- provenance: 830ff28 2026-06-17, the fork port.
- verdict: keep
- reason: The owner of the confirm-before-trusting rule; C003 retires in its favour.

### C084
- key: RED: give a fresh subagent a realistic task that tempts the failure without the new guidance, watch it fail, and record the rationalization verbatim.
- class: rule
- source: plugins/claude-kit/skills/writing-skills/SKILL.md:81
- provenance: 830ff28 2026-06-17, the fork port.
- verdict: keep
- reason: Four short sentences each one idea; the compress finding was taste.

### C085
- key: Stop and change nothing if the RED task does not fail.
- class: rule
- source: plugins/claude-kit/skills/writing-skills/SKILL.md:81
- provenance: 830ff28 2026-06-17, the fork port; b99a7fe 2026-08-09 records a declined brief on exactly this ground (RED did not reproduce).
- verdict: keep
- reason: Stands; the contaminated-RED paragraph (C121, C122) is its stated exception on an observable predicate.

### C086
- key: GREEN: add the minimal guidance addressing that specific failure and re-run until the agent complies.
- class: rule
- source: plugins/claude-kit/skills/writing-skills/SKILL.md:82
- provenance: 830ff28 2026-06-17, the fork port.
- verdict: keep
- reason: Three sentences of fifteen words; the compress finding was taste.

### C087
- key: REFACTOR: where the agent finds a new loophole, add the counter and re-run until it holds.
- class: rule
- source: plugins/claude-kit/skills/writing-skills/SKILL.md:83
- provenance: 830ff28 2026-06-17, the fork port.
- verdict: keep
- reason: No finding.

### C088
- key: For discipline rules, combine pressures such as time plus sunk cost plus authority, since single pressures are weak tests.
- class: rule
- source: plugins/claude-kit/skills/writing-skills/SKILL.md:83
- provenance: 830ff28 2026-06-17, the fork port; b99a7fe 2026-08-09 ran its RED under exactly these combined pressures (fabricated prior verification, deadline, waiting authority).
- verdict: keep
- reason: No finding. Applied live and unenforced.

### C089
- key: Run several reps, since one sample lies.
- class: rule
- source: plugins/claude-kit/skills/writing-skills/SKILL.md:85
- provenance: 830ff28 2026-06-17, the fork port.
- verdict: keep
- reason: Not in real conflict with C113: a ruled probe's runner pair stands in for the reps by e0ef09c's design, on the observable predicate that the probe is ruled, with the paid-reader cost named and a cost ceiling declined in the plan's rounds.

### C090
- key: Read every flagged result yourself, since template echoes masquerade as both failures and successes.
- class: rule
- source: plugins/claude-kit/skills/writing-skills/SKILL.md:85
- provenance: 830ff28 2026-06-17, the fork port.
- verdict: keep
- reason: No finding.

### C091
- key: Apply this testing standard to any change to behavior-shaping content, the kit's own skills included.
- class: rule
- source: plugins/claude-kit/skills/writing-skills/SKILL.md:85
- provenance: 830ff28 2026-06-17, the fork port.
- verdict: keep
- reason: No finding. This is the bar the audit's own baseline-test flag is derived from.

### C092
- key: Run the probe runner's before-and-after pair for a moment when the change touches a file a probe's shape under `test/probes/` names, in a passage that probe's scenario turns on.
- class: rule
- source: plugins/claude-kit/skills/writing-skills/SKILL.md:87
- provenance: e0ef09c 2026-09-06, scenario-probes sections 3 and 5, fifteen review rounds.
- verdict: retire
- superseded-by: S001
- reason: The trigger rule holds as worded; the paragraph around it splits into one sentence per record (see C101, C103, C109 for the three that change). Superseded at `4b2e64c` by S001 (the Section 8 merge; the verdict before it was keep).

### C093
- key: Check the changed and untracked paths, read against the same `<sha>` the before leg takes, against the shapes' `files:` lists, then the changed hunks against those probes' scenarios; a hunk no scenario turns on runs nothing and is recorded as such.
- class: mechanic
- source: plugins/claude-kit/skills/writing-skills/SKILL.md:87
- provenance: e0ef09c 2026-09-06.
- verdict: retire
- superseded-by: S002
- reason: No finding of its own; the check that derives the moment list, which the runner's `--touching` does at file grain only. Superseded at `4b2e64c` by S002 (the Section 8 merge; the verdict before it was keep).

### C094
- key: Where the probe is `ruled`, let the pair stand in for the reps as the RED and GREEN.
- class: mechanic
- source: plugins/claude-kit/skills/writing-skills/SKILL.md:87
- provenance: e0ef09c 2026-09-06, the plan's design that the pair is the RED and GREEN the skill already demands.
- verdict: retire
- superseded-by: S004
- reason: The observable predicate that reconciles C089 with C113. Superseded at `4b2e64c` by S004 (the Section 8 merge; the verdict before it was keep).

### C095
- key: Where the probe is `proposed`, run the after leg alone, record it as evidence for the operator's rulings batch, and still run the reps.
- class: mechanic
- source: plugins/claude-kit/skills/writing-skills/SKILL.md:87
- provenance: e0ef09c 2026-09-06, rewrite 9 of section 3 (a proposed reading is rulings evidence).
- verdict: retire
- superseded-by: S005
- reason: No finding. Every probe was proposed at the plan's close, so this branch is the one that runs today. Superseded at `4b2e64c` by S005 (the Section 8 merge; the verdict before it was keep).

### C096
- key: Do not read a matching before leg as step 1's nothing-to-fix case; the pair measures movement rather than failure.
- class: mechanic
- source: plugins/claude-kit/skills/writing-skills/SKILL.md:87
- provenance: e0ef09c 2026-09-06.
- verdict: retire
- superseded-by: S008
- reason: No finding. The clause that keeps C085 from misfiring on a probe pair. Superseded at `4b2e64c` by S008 (the Section 8 merge; the verdict before it was keep).

### C097
- key: Read a matching pair on a moment the change did not mean to move as a reading that held.
- class: mechanic
- source: plugins/claude-kit/skills/writing-skills/SKILL.md:87
- provenance: e0ef09c 2026-09-06, the four closed readings.
- verdict: retire
- superseded-by: S011
- reason: One of the four readings this file owns (the plan's Chapter assigns them here); stays, as its own sentence. Superseded at `4b2e64c` by S011 (the Section 8 merge; the verdict before it was keep).

### C098
- key: Read a before-leg mismatch the after leg matches as the repair.
- class: mechanic
- source: plugins/claude-kit/skills/writing-skills/SKILL.md:87
- provenance: e0ef09c 2026-09-06.
- verdict: retire
- superseded-by: S012
- reason: One of the four readings; stays. Superseded at `4b2e64c` by S012 (the Section 8 merge; the verdict before it was keep).

### C099
- key: Record a mismatch both legs carry as the corpus's.
- class: mechanic
- source: plugins/claude-kit/skills/writing-skills/SKILL.md:87
- provenance: e0ef09c 2026-09-06.
- verdict: retire
- superseded-by: S013
- reason: One of the four readings; stays. Superseded at `4b2e64c` by S013 (the Section 8 merge; the verdict before it was keep).

### C100
- key: Take an after-leg mismatch the before leg lacks, and a matching pair on a moment the change meant to move, to the intent test; the latter is a finding rather than a reading that held.
- class: mechanic
- source: plugins/claude-kit/skills/writing-skills/SKILL.md:87
- provenance: e0ef09c 2026-09-06.
- verdict: retire
- superseded-by: S014
- reason: One of the four readings; stays. Superseded at `4b2e64c` by S014 (the Section 8 merge; the verdict before it was keep).

### C101
- key: Re-run an errored, unparsed, or leg-unavailable pair once as finishing-work's step 5 directs, and where it errors again run the reps, since it stands in for nothing.
- class: mechanic
- source: plugins/claude-kit/skills/writing-skills/SKILL.md:87
- provenance: e0ef09c 2026-09-06.
- verdict: retire
- superseded-by: S016
- reason: Line 87 itself assigns re-run mechanics to finishing-work's step 5 (C110), so the sentence restates its owner; it becomes a pointer with the residue a writer needs (a pair that errors twice stands in for nothing, so the reps run). Superseded at `4b2e64c` by S016 (the Section 8 merge; the verdict before it was rewrite).

### C102
- key: Take a designed shape's rows and a designed-agreed row to finishing-work's step 5 dispositions rather than the four readings.
- class: pointer
- source: plugins/claude-kit/skills/writing-skills/SKILL.md:87
- provenance: e0ef09c 2026-09-06.
- verdict: retire
- superseded-by: S018
- reason: Already a pointer; stays. Superseded at `4b2e64c` by S018 (the Section 8 merge; the verdict before it was keep).

### C103
- key: Treat rows from a shape naming no changed file as no reading at all, since both legs read one corpus.
- class: mechanic
- source: plugins/claude-kit/skills/writing-skills/SKILL.md:87
- provenance: e0ef09c 2026-09-06.
- verdict: retire
- superseded-by: S019
- reason: The README owns what each leg reads (C110), and this sentence restates a consequence of it; it becomes a pointer at tools/probe-corpus/README.md with the residue (such rows are no reading). Superseded at `4b2e64c` by S019 (the Section 8 merge; the verdict before it was rewrite).

### C104
- key: Run the before leg as `node tools/probe-corpus/run.mjs --only <moments> --before <sha>`.
- class: mechanic
- source: plugins/claude-kit/skills/writing-skills/SKILL.md:87
- provenance: e0ef09c 2026-09-06, with the parity pin tying the flags to the runner's KNOWN_FLAGS.
- verdict: retire
- superseded-by: S020
- reason: A pinned copy: test/doctrine-parity.test.js requires writing-skills to spell `--only` and `--before` inside a run.mjs command span and refuses any flag the runner does not take. Keep verbatim. Superseded at `4b2e64c` by S020 (the Section 8 merge; the verdict before it was keep).

### C105
- key: Run the after leg as the same command with no `--before` and its own moment list.
- class: mechanic
- source: plugins/claude-kit/skills/writing-skills/SKILL.md:87
- provenance: e0ef09c 2026-09-06.
- verdict: retire
- superseded-by: S021
- reason: The second half of the pinned command pair; stays. Superseded at `4b2e64c` by S021 (the Section 8 merge; the verdict before it was keep).

### C106
- key: Set the after leg's `<moments>` to the comma-joined list of every moment the check kept, and the before leg's to that list narrowed to the `ruled` moments.
- class: mechanic
- source: plugins/claude-kit/skills/writing-skills/SKILL.md:87
- provenance: e0ef09c 2026-09-06, rewrite 12 of section 3, which corrected a copy of finishing-work's economy that had made the RED unobtainable exactly where a fix worked.
- verdict: retire
- superseded-by: S022
- reason: Incident-born within the plan's own rounds; the moment-list derivation is this file's, not finishing-work's, and stays. Superseded at `4b2e64c` by S022 (the Section 8 merge; the verdict before it was keep).

### C107
- key: Set `<sha>` to the parent of the change's first commit resolved to a sha, or `HEAD` where the change is uncommitted.
- class: mechanic
- source: plugins/claude-kit/skills/writing-skills/SKILL.md:87
- provenance: e0ef09c 2026-09-06.
- verdict: retire
- superseded-by: S025
- reason: No finding of its own; the section-time before ref, distinct from finishing-work's base-ref derivation which the bound points at. Superseded at `4b2e64c` by S025 (the Section 8 merge; the verdict before it was keep).

### C108
- key: Run the pair once at the section's close over the section's whole change, not at each fix round.
- class: rule
- source: plugins/claude-kit/skills/writing-skills/SKILL.md:87
- provenance: e0ef09c 2026-09-06, the paid-reader economy.
- verdict: retire
- superseded-by: S027
- reason: Stands as worded in the split; a per-fix-round pair would spend about forty cents a pair per round (memory record the-probe-runner-is-a-paid-box-claimed-run). Superseded at `4b2e64c` by S027 (the Section 8 merge; the verdict before it was keep).

### C109
- key: Take the box claim step 5 names before the run, and run the section's lane once that claim is released.
- class: rule
- source: plugins/claude-kit/skills/writing-skills/SKILL.md:87
- provenance: e0ef09c 2026-09-06 wrote the claim clause; ddcb28e 2026-09-07 rewrote finishing-work's step 5 to "takes no heavy-process claim" (one network-bound reader holds neither processors nor memory), which the memory record of the first full run agrees with.
- verdict: retire
- superseded-by: S029
- reason: The claim is stale and false: the step 5 it points at names no box claim, so a session following this line would claim a slot the owner says the runner does not take and hold its lane for nothing. Drop the claim clause and point at finishing-work for the run's process standing; the doctrine's memory rule would have this corrected in the same turn as found, and the rewrite plan is that turn. Superseded at `4b2e64c` by S029 (the Section 8 merge; the verdict before it was rewrite).

### C110
- key: Read `tools/probe-corpus/README.md` for what each leg reads and what each row status means, and finishing-work's step 5 for how the run is spawned, when a leg is re-run, and what each row counts for.
- class: pointer
- source: plugins/claude-kit/skills/writing-skills/SKILL.md:87
- provenance: e0ef09c 2026-09-06, the ownership split the fifteen rounds settled on.
- verdict: retire
- superseded-by: S031
- reason: The ownership statement that C101 and C103 are rewritten to honour. Superseded at `4b2e64c` by S031 (the Section 8 merge; the verdict before it was keep).

### C111
- key: On a ruled probe's after-leg mismatch the before leg lacks, apply the intent test: a move the change intended is a re-ruling to ask the operator for, and any other is a finding.
- class: rule
- source: plugins/claude-kit/skills/writing-skills/SKILL.md:87
- provenance: e0ef09c 2026-09-06, "what this bar adds"; the plan routes every proposed reading to the operator's rulings batch and treats a probe edit as a re-ruling by construction.
- verdict: retire
- superseded-by: S033
- reason: An operator-decision gate, not loop maintenance: the ruling is the operator's answer to what the prose should make a fresh session do, and a session re-ruling a probe its own change moved would grade its own change against a spec it just rewrote. Stays under the standing-grant precedent. Superseded at `4b2e64c` by S033 (the Section 8 merge; the verdict before it was keep).

### C112
- key: Where a change's only shape-named files are the repo's `home/*.md` files, run the reps with the cache staging instead, since neither leg sees it.
- class: mechanic
- source: plugins/claude-kit/skills/writing-skills/SKILL.md:87
- provenance: e0ef09c 2026-09-06, kept over a reviewer's objection that it was anticipatory because the parser admits a home/ entry.
- verdict: retire
- superseded-by: S035
- reason: No finding. A conditional on an observable predicate (the runner reads home/ from the reader's home directory), which the plan chose to state. Superseded at `4b2e64c` by S035 (the Section 8 merge; the verdict before it was keep).

### C113
- key: Accept a matching leg pair as one sample and read the raw replies the runner keeps as you read flagged results.
- class: mechanic
- source: plugins/claude-kit/skills/writing-skills/SKILL.md:87
- provenance: e0ef09c 2026-09-06, the single-sample admission the rounds required (a match is single-sample evidence) with a cost ceiling declined.
- verdict: retire
- superseded-by: S037
- reason: Not in real conflict with C089; the sentence names the cost the reps rule is traded against and routes the reading through C090's read-it-yourself rule. Superseded at `4b2e64c` by S037 (the Section 8 merge; the verdict before it was keep).

### C114
- key: Record the reading, or both readings where a pair ran, on the line executing-work's Chapter template holds for it in `Decisions / Surprises`, or in the turn's close-out status where no section Chapter exists.
- class: rule
- source: plugins/claude-kit/skills/writing-skills/SKILL.md:87
- provenance: e0ef09c 2026-09-06, the Chapter slot added in the same commit.
- verdict: retire
- superseded-by: S040
- reason: Stands; the slot it names exists in executing-work's template and the pin checks the template names the summary prefix. Superseded at `4b2e64c` by S040 (the Section 8 merge; the verdict before it was keep).

### C115
- key: Run a GREEN probe for a doctrine change in a fresh session such as a headless `claude -p`, never as a subagent of the session that made the edit.
- class: rule
- source: plugins/claude-kit/skills/writing-skills/SKILL.md:89
- provenance: b99a7fe 2026-08-09, found when the first GREEN round silently re-tested the old wording; eb7d29d 2026-08-09 named the inheritance setting.
- verdict: keep
- reason: Incident-born and unenforced. The why (C116, moved here): a same-session subagent at best inherits the CLAUDE.md snapshot taken at session start, or with subagent inheritance off sees no doctrine, so a subagent GREEN re-tests the old wording.

### C116
- key: Avoid the subagent GREEN because subagents at best inherit the CLAUDE.md snapshot taken at session start, or see no doctrine at all, so the probe silently re-tests the old wording.
- class: rationale-example
- source: plugins/claude-kit/skills/writing-skills/SKILL.md:89
- provenance: b99a7fe 2026-08-09; eb7d29d 2026-08-09.
- verdict: retire
- reason: The fresh-session rule is obeyed without the inheritance account, and removing a harness-injection fact from the prose is what the line 96 antipattern asks; the why now lives under C115.

### C117
- key: Do not stage probe wording in `~/.claude/claude-kit-doctrine.md`.
- class: rule
- source: plugins/claude-kit/skills/writing-skills/SKILL.md:89
- provenance: b915f06 2026-08-09, the GREEN-round deploy reverted by the probe sessions themselves, the batch launch masking it.
- verdict: keep
- reason: Incident-born; the hook defeats the staging silently rather than refusing it, so the prose is not superseded. The why (C118, moved here): plugins/claude-kit/hooks/doctrine-refresh.js rewrites that file from the installed plugin's operating-instructions skill at every session start, the probe sessions' own starts included.

### C118
- key: Avoid that file because the doctrine-refresh hook rewrites it from the installed plugin's operating-instructions skill at every session start, so a hand-deployed copy dies at the first probe boot.
- class: rationale-example
- source: plugins/claude-kit/skills/writing-skills/SKILL.md:89
- provenance: b915f06 2026-08-09.
- verdict: retire
- reason: The ban is obeyed without the hook's behavior, which C119 replaces with the staging location; the why now lives under C117 naming the hook by path.

### C119
- key: Stage the candidate wording in the installed plugin cache's copy of the skill for the probe run and restore it afterwards.
- class: rule
- source: plugins/claude-kit/skills/writing-skills/SKILL.md:89
- provenance: b915f06 2026-08-09; e0ef09c 2026-09-06 bounded it to where the probe pair does not supply the GREEN.
- verdict: keep
- reason: The staging recipe the incident produced; unenforced.

### C120
- key: Ship the real change through the normal commit; it goes live when the plugin updates.
- class: mechanic
- source: plugins/claude-kit/skills/writing-skills/SKILL.md:89
- provenance: b915f06 2026-08-09.
- verdict: keep
- reason: Stands; it is what keeps the cache staging from being mistaken for the delivery.

### C121
- key: Expect a contaminated RED for a doctrine-adjacent rule, since a test subagent inheriting the global CLAUDE.md already complies with doctrine.
- class: rationale-example
- source: plugins/claude-kit/skills/writing-skills/SKILL.md:91
- provenance: 12ef61f 2026-07-09 installed the contaminated-RED guidance from the review-tension plan; eb7d29d 2026-08-09 added the inheritance-setting conditional.
- verdict: rewrite
- reason: The complies-with-doctrine mechanism moves here; the setting-conditional in the bound (inheritance on: the RED is contaminated and production-faithful; off: a RED is genuine) stays as C122's bound, because C122 cannot be applied without knowing which state the harness is in.

### C122
- key: Treat absence of failure in a doctrine-adjacent RED as weak evidence, not proof the rule is dead weight.
- class: rule
- source: plugins/claude-kit/skills/writing-skills/SKILL.md:91
- provenance: 12ef61f 2026-07-09, the review-tension plan.
- verdict: keep
- reason: Incident-born, recurs at every doctrine-adjacent rule, unenforced; b99a7fe declined a brief on this very reading.

### C123
- key: Judge such a rule on its distinct value: point-of-action encoding survives compaction and reaches contexts the doctrine does not.
- class: rule
- source: plugins/claude-kit/skills/writing-skills/SKILL.md:91
- provenance: 12ef61f 2026-07-09.
- verdict: keep
- reason: Stands with its parenthetical contexts (a headless worker mid-loop, a session whose doctrine was summarized away), which are the observable instances the test needs.

### C124
- key: Where you ship a rule whose RED did not reproduce, record that it stands on the distinct-value rationale rather than on a demonstrated failure.
- class: rule
- source: plugins/claude-kit/skills/writing-skills/SKILL.md:91
- provenance: 12ef61f 2026-07-09.
- verdict: keep
- reason: Stands as worded; its sentence loses the semicolon-joined C125 to its own sentence.

### C125
- key: Leave out a rule with neither a reproduced RED nor that rationale.
- class: rule
- source: plugins/claude-kit/skills/writing-skills/SKILL.md:91
- provenance: 12ef61f 2026-07-09.
- verdict: rewrite
- reason: The rule holds; it shares a semicolon sentence with C124, which the doctrine's plain-prose bullet forbids, so it becomes its own sentence with nothing removed.

### C126
- key: Do not write a narrative such as "the time we fixed X" in place of a reusable technique.
- class: rule
- source: plugins/claude-kit/skills/writing-skills/SKILL.md:95
- provenance: 830ff28 2026-06-17, the fork port.
- verdict: keep
- reason: No finding. Stated only here, so the antipattern is its owner.

### C127
- key: Do not state a harness-injection fact as unconditional when it hinges on a user setting.
- class: rule
- source: plugins/claude-kit/skills/writing-skills/SKILL.md:96
- provenance: eb7d29d 2026-08-09, an inbox note on executing-work's subagent-memory sentence going false under a settings flip, and the sweep that found the class elsewhere.
- verdict: keep
- reason: No finding. Incident-born, no test catches a settings flip, and stated only here.

### C128
- key: State the safe assumption instead, and where the fact must be stated, name the setting it depends on.
- class: rule
- source: plugins/claude-kit/skills/writing-skills/SKILL.md:96
- provenance: eb7d29d 2026-08-09.
- verdict: keep
- reason: No finding. The recipe half of C127, and the rule the C116 and C121 retirements follow.

### C129
- key: Do not write a description that summarizes the workflow.
- class: rule
- source: plugins/claude-kit/skills/writing-skills/SKILL.md:97
- provenance: 830ff28 2026-06-17, the fork port.
- verdict: retire
- reason: A restatement of C033 at line 27 in the antipattern list; the owner sits in the same file and the one-owner rule makes the list entry the copy.

### C130
- key: Do not aim a prohibition at a wrong-shaped-output problem; use a recipe.
- class: rule
- source: plugins/claude-kit/skills/writing-skills/SKILL.md:98
- provenance: 830ff28 2026-06-17, the fork port.
- verdict: retire
- reason: A restatement of the table row at line 38 (C038) with its backfire column; the row owns it.

### C131
- key: Do not write guidance from imagination instead of an observed failure.
- class: rule
- source: plugins/claude-kit/skills/writing-skills/SKILL.md:99
- provenance: 830ff28 2026-06-17, the fork port.
- verdict: keep
- reason: No finding. Stated only here, and line 91 (C125) points at it by name.

### C132
- key: Do not add a new skill where one paragraph in an existing skill would have done.
- class: rule
- source: plugins/claude-kit/skills/writing-skills/SKILL.md:100
- provenance: 830ff28 2026-06-17, the fork port.
- verdict: retire
- reason: A restatement of C008 and C009 at line 14; the lean bullet owns the test and the default.

### C133
- key: Treat the size budget as a ledger that records growth, not a ceiling that forbids it.
- class: rule
- source: plugins/claude-kit/skills/writing-skills/SKILL.md:15
- provenance: c591c49 2026-09-08, the operator's ruling that the ratchet encourages cutting and never forbids adding; the ownership map row names this bullet as the owner.
- verdict: keep
- reason: The principle of the bullet, enforced as to visibility by test/size-ratchet.test.js and as to the moving of caps by kit-size.js sync, neither of which states the norm; C017 is its reviewer duty, not a duplicate.

### C134
- key: The budget file lives at test/size-budget.json and the ratchet test at test/size-ratchet.test.js.
- class: mechanic
- source: plugins/claude-kit/skills/writing-skills/SKILL.md:15
- provenance: c591c49 2026-09-08.
- verdict: keep
- reason: A location fact the ratchet test does not tell the reader.

### C135
- key: An unverifiable fact-framing leaves the reader unable to notice when the underlying fact changes, so they keep obeying a rule that no longer holds.
- class: rationale-example
- source: plugins/claude-kit/skills/writing-skills/SKILL.md:52
- provenance: a5e184b 2026-08-25.
- verdict: retire
- reason: The reason behind C047, which states its own instruction; it now lives under C047.

### C136
- key: An enumeration built from one fully-observed sample looks exhaustive to its writer, so a reader who branches on an absent field will be wrong for instances the sample never covered.
- class: rationale-example
- source: plugins/claude-kit/skills/writing-skills/SKILL.md:53
- provenance: a5e184b 2026-08-25.
- verdict: retire
- reason: The open-list rule and its contract bound read without the account of how the writer is fooled; it now lives under C050.

### S001
- key: Run the probe runner's before-and-after pair for a moment whose probe shape names a file your change touched in a passage that probe's scenario turns on.
- class: rule
- source: plugins/claude-kit/skills/writing-skills/SKILL.md:87
- provenance: e0ef09c 2026-09-06, scenario-probes sections 3 and 5, fifteen review rounds; line rewritten by 55c5abc 2026-09-09, which inserted the finishing goal read as step 4 and renumbered finishing-work's step 5 to step 6, this claim's words unchanged.
- verdict: keep
- reason: The trigger rule for the pair; the merge touched only the step number elsewhere in the line, and the paragraph still splits into one sentence per record with this as the lead.

### S002
- key: Check the changed and untracked paths against the shapes' `files:` lists, then check the changed hunks against those probes' scenarios.
- class: mechanic
- source: plugins/claude-kit/skills/writing-skills/SKILL.md:87
- provenance: e0ef09c 2026-09-06, the check that derives the moment list; line rewritten by 55c5abc 2026-09-09 (step renumbering), the claim's words unchanged.
- verdict: keep
- reason: The runner's `--touching` selects at file grain only, so the hunk-against-scenario half has no mechanical substitute and stays with the writer.

### S003
- key: Run nothing for a hunk no scenario turns on, and record that it ran nothing.
- class: mechanic
- source: plugins/claude-kit/skills/writing-skills/SKILL.md:87
- provenance: e0ef09c 2026-09-06, the second half of the check sentence (shares C093's supersession with S002); line rewritten by 55c5abc 2026-09-09, the claim's words unchanged.
- verdict: keep
- reason: Nothing records a scenario-excluded hunk for the session, so the record-it clause is the writer's and stays as its own sentence in the split.

### S004
- key: Let the before-and-after pair stand in for the reps as the RED and the GREEN.
- class: rule
- source: plugins/claude-kit/skills/writing-skills/SKILL.md:87
- provenance: e0ef09c 2026-09-06, the plan's design that the pair is the RED and GREEN the skill already demands; line rewritten by 55c5abc 2026-09-09, the claim's words unchanged.
- verdict: keep
- reason: The observable predicate that reconciles the reps rule (line 85) with the one-sample admission (S037); every probe is still `proposed`, so this branch is unexercised rather than dead.

### S005
- key: Run only the after leg and record it as evidence for the operator's rulings batch.
- class: rule
- source: plugins/claude-kit/skills/writing-skills/SKILL.md:87
- provenance: e0ef09c 2026-09-06, rewrite 9 of section 3 (a proposed reading is rulings evidence); line rewritten by 55c5abc 2026-09-09, the claim's words unchanged.
- verdict: keep
- reason: The branch every probe takes today, and finishing-work's step 6 states the same routing for its own pass; two moments, one rule each.

### S006
- key: Skip the before leg on a proposed probe because it buys nothing for its paid readers.
- class: rationale-example
- source: plugins/claude-kit/skills/writing-skills/SKILL.md:87
- provenance: e0ef09c 2026-09-06, the reason clause of the proposed-probe sentence (shares C095's supersession with S005); line rewritten by 55c5abc 2026-09-09, the claim's words unchanged.
- verdict: retire
- reason: S005 is obeyed without the reason, and finishing-work's step 6 states the same clause, so the document carried it twice. The why: a proposed probe's mismatch goes to the operator's rulings batch whichever leg carries it, so a before leg over it spends a paid reader on a reading nobody acts on.

### S007
- key: Still run the reps described above when the probe is `proposed`.
- class: rule
- source: plugins/claude-kit/skills/writing-skills/SKILL.md:87
- provenance: e0ef09c 2026-09-06, the third clause of the proposed-probe sentence (shares C095's supersession with S005); line rewritten by 55c5abc 2026-09-09, the claim's words unchanged.
- verdict: keep
- reason: The bound that keeps a proposed probe's after leg from being read as the GREEN; unenforced.

### S008
- key: Do not treat a before leg that matches as step 1's nothing-to-fix case, and do not stop on it.
- class: rule
- source: plugins/claude-kit/skills/writing-skills/SKILL.md:87
- provenance: e0ef09c 2026-09-06; line rewritten by 55c5abc 2026-09-09, the claim's words unchanged.
- verdict: keep
- reason: The clause that keeps line 81's stop rule from misfiring on a probe pair; unenforced. The why (S009, moved here): the pair measures movement rather than failure, so a matching before leg says the moment sat where it was ruled to sit, not that there is nothing to fix.

### S009
- key: Read the pair as a measure of movement rather than of failure.
- class: rationale-example
- source: plugins/claude-kit/skills/writing-skills/SKILL.md:87
- provenance: e0ef09c 2026-09-06, the bound of the matching-before-leg sentence (shares C096's supersession with S008); line rewritten by 55c5abc 2026-09-09, the claim's words unchanged.
- verdict: retire
- reason: S008 is obeyed as a bare prohibition; the movement framing is why it holds rather than what to do, and now lives under S008.

### S010
- key: Sort every pair reading into exactly one of the four listed readings; the set is closed.
- class: mechanic
- source: plugins/claude-kit/skills/writing-skills/SKILL.md:87
- provenance: e0ef09c 2026-09-06, the closure written over the four readings when they were installed; line rewritten by 55c5abc 2026-09-09, the claim's words unchanged.
- verdict: keep
- reason: The class closure this file's own line 46 requires of every enumeration; its bound is what keeps errored, designed and no-changed-file rows from being forced into a reading.

### S011
- key: Read a matching pair on a moment the change did not mean to move as a reading that held.
- class: mechanic
- source: plugins/claude-kit/skills/writing-skills/SKILL.md:87
- provenance: e0ef09c 2026-09-06, the four closed readings; line rewritten by 55c5abc 2026-09-09, the claim's words unchanged.
- verdict: keep
- reason: One of the four readings the plan's Chapter assigns to this file; stays as its own sentence.

### S012
- key: Read a before-leg mismatch that the after leg matches as the repair.
- class: mechanic
- source: plugins/claude-kit/skills/writing-skills/SKILL.md:87
- provenance: e0ef09c 2026-09-06; line rewritten by 55c5abc 2026-09-09, the claim's words unchanged.
- verdict: keep
- reason: One of the four readings; stays.

### S013
- key: Read a mismatch both legs carry as the corpus's, and record it as such.
- class: mechanic
- source: plugins/claude-kit/skills/writing-skills/SKILL.md:87
- provenance: e0ef09c 2026-09-06; line rewritten by 55c5abc 2026-09-09, the claim's words unchanged.
- verdict: keep
- reason: One of the four readings; finishing-work's step 6 names the same row for its own pass, which is two moments rather than a duplicate.

### S014
- key: Take an after-leg mismatch that the before leg lacks to the intent test.
- class: mechanic
- source: plugins/claude-kit/skills/writing-skills/SKILL.md:87
- provenance: e0ef09c 2026-09-06; line rewritten by 55c5abc 2026-09-09, the claim's words unchanged.
- verdict: keep
- reason: The reading that feeds the intent test S033 and S034 own; stays.

### S015
- key: Take a matching pair on a moment the change meant to move to the intent test, and treat it as a finding rather than a reading that held.
- class: mechanic
- source: plugins/claude-kit/skills/writing-skills/SKILL.md:87
- provenance: e0ef09c 2026-09-06, the second half of the intent-test reading (shares C100's supersession with S014); line rewritten by 55c5abc 2026-09-09, the claim's words unchanged.
- verdict: keep
- reason: A matching pair on an intended move is the one reading a session would misread as success, so the finding label is load-bearing.

### S016
- key: Re-run an errored, unparsed, or unavailable-leg pair once, as finishing-work's step 6 directs.
- class: rule
- source: plugins/claude-kit/skills/writing-skills/SKILL.md:87
- provenance: e0ef09c 2026-09-06 wrote it against finishing-work's step 5; 55c5abc 2026-09-09 renumbered the pointer to step 6 when the finishing goal read became step 4.
- verdict: rewrite
- reason: Step 6 owns the re-run count and its triggers and states them, so the sentence restates its owner; it becomes a pointer, with S017 as the residue that follows. Baseline-test: yes.

### S017
- key: Where the re-run errors again, count the pair for nothing and run the reps above instead.
- class: rule
- source: plugins/claude-kit/skills/writing-skills/SKILL.md:87
- provenance: e0ef09c 2026-09-06, the residue of the re-run sentence (shares C101's supersession with S016); line rewritten by 55c5abc 2026-09-09, the claim's words unchanged.
- verdict: keep
- reason: This file's own consequence, which step 6 does not state: a pair that errors twice stands in for nothing, so the reps run.

### S018
- key: Take finishing-work's step 6 dispositions for a designed shape's rows and for a designed-agreed row.
- class: pointer
- source: plugins/claude-kit/skills/writing-skills/SKILL.md:87
- provenance: e0ef09c 2026-09-06 wrote it against step 5; 55c5abc 2026-09-09 renumbered the pointer to step 6.
- verdict: keep
- reason: Already a pointer, and step 6 carries the designed and designed-agreed dispositions under the new number.

### S019
- key: Count rows from a shape that names no changed file as no reading at all.
- class: mechanic
- source: plugins/claude-kit/skills/writing-skills/SKILL.md:87
- provenance: e0ef09c 2026-09-06; line rewritten by 55c5abc 2026-09-09, the claim's words unchanged.
- verdict: rewrite
- reason: The runner README's "What the runner reads" section owns what each leg reads, and this sentence restates a consequence of it; it becomes a pointer at tools/probe-corpus/README.md with the residue that such rows are no reading. Baseline-test: yes.

### S020
- key: Run the before leg as `node tools/probe-corpus/run.mjs --only <moments> --before <sha>`.
- class: mechanic
- source: plugins/claude-kit/skills/writing-skills/SKILL.md:87
- provenance: e0ef09c 2026-09-06, with the parity pin tying the flags to the runner's KNOWN_FLAGS; line rewritten by 55c5abc 2026-09-09, the claim's words unchanged.
- verdict: keep
- reason: A pinned copy: test/doctrine-parity.test.js requires writing-skills to spell `--only` and `--before` inside a run.mjs command span and refuses any flag the runner does not take. Keep verbatim.

### S021
- key: Run the after leg as the same command with no `--before` and with its own moment list.
- class: mechanic
- source: plugins/claude-kit/skills/writing-skills/SKILL.md:87
- provenance: e0ef09c 2026-09-06; line rewritten by 55c5abc 2026-09-09, the claim's words unchanged.
- verdict: keep
- reason: The second half of the pinned command pair; stays.

### S022
- key: Set the after leg's `<moments>` to the comma-joined list of every moment the check kept.
- class: mechanic
- source: plugins/claude-kit/skills/writing-skills/SKILL.md:87
- provenance: e0ef09c 2026-09-06, rewrite 12 of section 3, which corrected a copy of finishing-work's economy that had made the RED unobtainable exactly where a fix worked; line rewritten by 55c5abc 2026-09-09, the claim's words unchanged.
- verdict: keep
- reason: Incident-born within the plan's own rounds; the moment-list derivation is this file's, where finishing-work derives its own list with `--touching`.

### S023
- key: Set the before leg's `<moments>` to that same list narrowed to the `ruled` moments.
- class: mechanic
- source: plugins/claude-kit/skills/writing-skills/SKILL.md:87
- provenance: e0ef09c 2026-09-06, the second half of the moment-list sentence (shares C106's supersession with S022); line rewritten by 55c5abc 2026-09-09, the claim's words unchanged.
- verdict: keep
- reason: The narrowing is what keeps the before leg off a proposed probe's paid readers. The why (S024, moved here): a pair is a reading only where both legs ran the moment, and a proposed probe runs the after leg alone.

### S024
- key: Narrow the before leg because a pair is a reading only where both legs ran the moment.
- class: rationale-example
- source: plugins/claude-kit/skills/writing-skills/SKILL.md:87
- provenance: e0ef09c 2026-09-06, the reason clause of the moment-list sentence (shares C106's supersession with S022); line rewritten by 55c5abc 2026-09-09, the claim's words unchanged.
- verdict: retire
- reason: S023 is obeyed without it and S005 already states that a proposed probe runs the after leg alone; the why now lives under S023.

### S025
- key: Resolve `<sha>` to the parent of the change's first commit, or to `HEAD` where the change is uncommitted.
- class: mechanic
- source: plugins/claude-kit/skills/writing-skills/SKILL.md:87
- provenance: e0ef09c 2026-09-06; line rewritten by 55c5abc 2026-09-09, the claim's words unchanged.
- verdict: keep
- reason: The section-time before ref, distinct from finishing-work's base-ref derivation; nothing derives it for the session.

### S026
- key: For a root-commit change, take the `<sha>` from finishing-work's pre-step-1 derivation, which leaves the before leg unrun.
- class: mechanic
- source: plugins/claude-kit/skills/writing-skills/SKILL.md:87
- provenance: e0ef09c 2026-09-06, the bound of the before-ref sentence (shares C107's supersession with S025), written against step 5; 55c5abc 2026-09-09 renumbered the recording step to 6.
- verdict: keep
- reason: The pointer resolves: finishing-work's step 6 states that the empty-tree base ref a root-commit effort yields leaves the before leg unrun and recorded as such.

### S027
- key: Run the pair once at the section's close over the section's whole change, not at each fix round.
- class: rule
- source: plugins/claude-kit/skills/writing-skills/SKILL.md:87
- provenance: e0ef09c 2026-09-06, the paid-reader economy; line rewritten by 55c5abc 2026-09-09, the claim's words unchanged.
- verdict: keep
- reason: A per-fix-round pair would spend about forty cents a pair per round (memory record the-probe-runner-is-a-paid-box-claimed-run); nothing enforces the once.

### S028
- key: Inside a finishing pass, do not run the set yourself; only finishing-work's step 6 runs it.
- class: rule
- source: plugins/claude-kit/skills/writing-skills/SKILL.md:87
- provenance: e0ef09c 2026-09-06, the one-owner-per-moment split that gave the finishing pass its own run, written against step 5; 55c5abc 2026-09-09 renumbered it to step 6.
- verdict: keep
- reason: The bound that keeps a finishing pass from running the pair a second time beside step 6's run over the whole changeset, which that step states.

### S029
- key: Take the box claim that step 6 names before running the pair.
- class: rule
- source: plugins/claude-kit/skills/writing-skills/SKILL.md:87
- provenance: e0ef09c 2026-09-06 wrote the claim clause against step 5; ddcb28e 2026-09-07 rewrote that step to "takes no heavy-process claim" (one network-bound reader holds neither processors nor memory); 55c5abc 2026-09-09 renumbered the pointer to step 6 and left the clause as it was.
- verdict: rewrite
- reason: The clause is still false after the merge: step 6 names no box claim, so a session following it would claim a slot the owner says the runner does not take. Drop the clause and point at finishing-work's step 6 for the run's process standing; finishing-work's own post-gate re-run sentence says "under its own claim", a conflict inside that file for its unit to rule. Baseline-test: yes.

### S030
- key: Run the section's lane only once that box claim is released.
- class: rule
- source: plugins/claude-kit/skills/writing-skills/SKILL.md:87
- provenance: e0ef09c 2026-09-06, the second clause of the box-claim sentence (shares C109's supersession with S029); ddcb28e 2026-09-07 removed the claim the clause waits on; line rewritten by 55c5abc 2026-09-09, the claim's words unchanged.
- verdict: retire
- reason: With no claim taken there is nothing to release, and the owner says the whole gate may run beside the runner, so the sequencing instruction has no content left once S029 points at step 6. Baseline-test: yes.

### S031
- key: Read `tools/probe-corpus/README.md` for what each leg reads and what each row status means.
- class: pointer
- source: plugins/claude-kit/skills/writing-skills/SKILL.md:87
- provenance: e0ef09c 2026-09-06, the ownership split the fifteen rounds settled on; line rewritten by 55c5abc 2026-09-09, the claim's words unchanged.
- verdict: keep
- reason: The ownership statement S019 is rewritten to honour; the README exists at that path with a "What the runner reads" section and the pair-status list.

### S032
- key: Read finishing-work's step 6 for how the run is spawned, when a leg is re-run, and what each row counts for.
- class: pointer
- source: plugins/claude-kit/skills/writing-skills/SKILL.md:87
- provenance: e0ef09c 2026-09-06, the ownership split (shares C110's supersession with S031), written against step 5; 55c5abc 2026-09-09 renumbered the pointer to step 6.
- verdict: keep
- reason: Step 6 carries the spawn, re-run and row-count text under the new number; S016's rewrite folds into this pointer.

### S033
- key: Where the intended move produced a ruled probe's after-leg mismatch, ask the operator for a re-ruling.
- class: rule
- source: plugins/claude-kit/skills/writing-skills/SKILL.md:87
- provenance: e0ef09c 2026-09-06, "what this bar adds"; the plan routes every proposed reading to the operator's rulings batch and treats a probe edit as a re-ruling by construction; line rewritten by 55c5abc 2026-09-09, the claim's words unchanged.
- verdict: keep
- reason: An operator-decision gate rather than loop maintenance: a session re-ruling a probe its own change moved would grade its change against a spec it just rewrote.

### S034
- key: Treat any such mismatch the change did not intend as a finding.
- class: rule
- source: plugins/claude-kit/skills/writing-skills/SKILL.md:87
- provenance: e0ef09c 2026-09-06, the second half of the intent test (shares C111's supersession with S033); line rewritten by 55c5abc 2026-09-09, the claim's words unchanged.
- verdict: keep
- reason: The finding label is what routes an unintended move into a fix round; unenforced.

### S035
- key: Where a change's only shape-named files are the repo's `home/*.md` files, run the reps above with the cache staging described below.
- class: rule
- source: plugins/claude-kit/skills/writing-skills/SKILL.md:87
- provenance: e0ef09c 2026-09-06, kept over a reviewer's objection that it was anticipatory because the parser admits a home/ entry; line rewritten by 55c5abc 2026-09-09, the claim's words unchanged.
- verdict: keep
- reason: A conditional on an observable file-path predicate, and the case is live: the repo's `home/` holds CLAUDE.md and claude-kit-doctrine.md. The why (S036, moved here): the runner reads a `home/` entry from the reader's home directory rather than from the repo, so neither leg sees the change.

### S036
- key: Expect neither leg to see such a change, because the runner reads a `home/` entry from the reader's home directory rather than from the repo.
- class: rationale-example
- source: plugins/claude-kit/skills/writing-skills/SKILL.md:87
- provenance: e0ef09c 2026-09-06, the mechanism clause of the home-files sentence (shares C112's supersession with S035); line rewritten by 55c5abc 2026-09-09, the claim's words unchanged.
- verdict: retire
- reason: S035 is obeyed on its predicate alone, the runner README owns where a `home/` entry is read from, and finishing-work's step 6 carries this clause word for word; the why now lives under S035.

### S037
- key: Accept a matching leg pair as one sample, and do not run a second.
- class: rule
- source: plugins/claude-kit/skills/writing-skills/SKILL.md:87
- provenance: e0ef09c 2026-09-06, the single-sample admission the rounds required with a cost ceiling declined; line rewritten by 55c5abc 2026-09-09, the claim's words unchanged.
- verdict: keep
- reason: Reconciled with line 85's reps rule by S004's ruled-probe predicate. The why (S038, moved here): a second pair costs a paid reader per probe-and-shape pair, about forty cents each by the memory record, and buys a second sample of a reading the pair already gave.

### S038
- key: Do not take a second sample, because it costs a paid reader per probe-and-shape pair.
- class: rationale-example
- source: plugins/claude-kit/skills/writing-skills/SKILL.md:87
- provenance: e0ef09c 2026-09-06, the cost clause of the one-sample sentence (shares C113's supersession with S037); line rewritten by 55c5abc 2026-09-09, the claim's words unchanged.
- verdict: retire
- reason: S037 is obeyed without the price and S004 carries the predicate that keeps it from conflicting with the reps rule; the why now lives under S037 with the memory record's figure.

### S039
- key: Read the raw replies the runner keeps yourself, the same way you read the flagged results above.
- class: rule
- source: plugins/claude-kit/skills/writing-skills/SKILL.md:87
- provenance: e0ef09c 2026-09-06, the read-it-yourself residue (shares C113's supersession with S037); line rewritten by 55c5abc 2026-09-09, the claim's words unchanged.
- verdict: keep
- reason: Routes a pair's raw replies through line 85's read-every-flagged-result rule; nothing reads them for the session.

### S040
- key: Record the reading, or both readings where a pair ran, on the line executing-work's Chapter template holds for it in `Decisions / Surprises`.
- class: mechanic
- source: plugins/claude-kit/skills/writing-skills/SKILL.md:87
- provenance: e0ef09c 2026-09-06, the Chapter slot added in the same commit; line rewritten by 55c5abc 2026-09-09, the claim's words unchanged.
- verdict: keep
- reason: A pinned pointer: test/doctrine-parity.test.js asserts this file names "executing-work's Chapter template" and "`Decisions / Surprises`" and that executing-work's line names the writing-skills slot.
