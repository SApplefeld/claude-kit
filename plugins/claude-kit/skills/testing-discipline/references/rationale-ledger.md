# Rationale ledger: testing-discipline

This file is the rationale ledger for the documents the `testing-discipline` skill owns. Rule text says what happens; this ledger says why; git says when. Nobody loads it by default. A session about to change a rule in one of the documents below reads the entry for the claim it is changing first, so the reason a rule holds is not re-litigated at the next review.

Each document sits under its own heading, which opens with its inventory line (what the document is for, which moments it owns, and when a session loads it) and then carries one entry per claim, retired claims included so the next audit does not re-find them. An entry is keyed by the claim's imperative sentence and carries its class (rule, mechanic, pointer, or rationale-example), its source as file and line, its provenance (the commit, incident, memory or kaizen note that installed it, or `no provenance found`), and its verdict (keep, rewrite, or retire) with the reason. A `C` entry's source line is read at the extraction commit `6bc07fb`; an `R` entry is a claim re-extracted from a hunk the Section 5 merge changed, and its source line is read at the merged commit `d9540ad`. Claim numbers restart under every document heading, and inside a document read in chunks they restart per chunk, so an entry id is unique only under its heading and a chunked document carries the chunk in the id (`c2.C001` is claim C001 of the second chunk); a claim named inside a reason or provenance line of such a document carries the same prefix. A `C` entry whose source hunk the Section 5 merge rewrote reads `retire` and carries a `superseded-by:` line naming the `R` entry that holds the passage at the merged commit; the passage's own verdict is that entry's, so a count of retirements over this ledger leaves those records out. A reason may name the form the judge ruled toward (a pointer at the owner, a split, a fold into a neighbour), because that form is why the verdict is rewrite rather than keep or retire; what a passage becomes is the rewrite plan's to decide, and where the two differ the rewrite plan governs. The target wording a judge proposed rides on the entry's `proposed:` line, one line per distinct proposal, on rewrite and retire entries that retire a passage; a proposal that pointed at another ruling by id carries the resolved text marked `(via Annn)`. A rewrite or retire the judge flagged as behavior-shaping carries `baseline-test: yes`, which is what the rewrite plan's RED and GREEN step keys on. What a passage becomes is the rewrite plan's to decide (`claude-kit_corpus-rewrite_spec_v1.md` under `docs/plans/`), and where it and a proposal differ the rewrite plan governs.

## plugins/claude-kit/skills/testing-discipline/SKILL.md

This document is the kit-wide authority on a test suite's two costs, the authoring decision that sets what the suite can see and the gate decision that sets what it costs to consult. It owns these moments: deciding whether a change earns a test and what shape that test takes; deciding whether a test already in the tree still earns its keep or retires; pinning a hazard that a shared setup hides; pricing a test's runtime shape at authoring; choosing which lane runs at a fix round, a section close, a push, a merge, finishing, and a handoff; discriminating a red from a flake; and recording, pinning, and comparing wall-clock and contention figures, including the pre-suite check of the box. It states no runnable commands, since a repo's lane invocations are per-repo facts held in that project's memory tier. Load class: named-trigger, per its own frontmatter description, which lists the acts and events that call it (writing a test, auditing a suite, choosing a lane after a fix, reading a red or a wall-clock figure).

Extracted at `6bc07fb`: whole document (`skills.testing-discipline.SKILL.md`).

### C001
- key: Read a repo's actual lane and suite commands from that project's memory tier wherever this skill names a lane.
- class: pointer
- source: plugins/claude-kit/skills/testing-discipline/SKILL.md:8
- provenance: 27ac5d7 2026-08-27, the testing-discipline plan's Approach bullet "the skill is kit-wide; per-repo facts stay in memory", written so the skill states discipline and never a command.
- verdict: keep
- reason: The skill is loaded across repos, so any command it carried would be wrong somewhere; the lane commands live in the project tier where `test-suite-invocation` already did. Line 68's duplicate read clause retires (C053); this sentence is the one statement.

### C002
- key: Treat nothing written in this skill as a command to run.
- class: rule
- source: plugins/claude-kit/skills/testing-discipline/SKILL.md:8
- provenance: 27ac5d7 2026-08-27, same install as C001.
- verdict: rewrite
- reason: The rule stays; the "two costs" framing before it is rationale (the skill's authoring and gate decisions are the two costs a suite pays) and the "This skill owns both, kit-wide" claim is the ownership map's row. Neither is obeyed, so dropping them changes no behavior.
- proposed: Line 8 keeps "nothing in this file is a command to run" and the memory-tier pointer; the two-costs framing moves to this ledger and the ownership sentence is dropped as the map's.

### C003
- key: Write a test for an implementer's acceptance criterion, the behavior the section was dispatched to produce.
- class: rule
- source: plugins/claude-kit/skills/testing-discipline/SKILL.md:14
- provenance: 27ac5d7 2026-08-27, the litmus for what earns a test, drawn from the 2026-08-26 census of defects caught by tests versus reviews.
- verdict: keep
- reason: no finding.

### C004
- key: Write a test for a path no human drives by hand, such as a hook or a CLI that only machines exercise.
- class: rule
- source: plugins/claude-kit/skills/testing-discipline/SKILL.md:15
- provenance: 27ac5d7 2026-08-27, the litmus.
- verdict: keep
- reason: no finding.

### C005
- key: Write a cross-surface pin wherever a writer and a reader share a value such as a wire field, a filter constant, or a column list.
- class: rule
- source: plugins/claude-kit/skills/testing-discipline/SKILL.md:16
- provenance: 27ac5d7 2026-08-27, restating the doctrine's pre-existing cross-component pin at the owner's point of action; the plan's Chapter 1 records the text as doctrine-verbatim.
- verdict: keep
- reason: This skill owns what earns a test; the doctrine's copy is the pointer surface per the ownership map. A session changing the pin rule changes it here and points from the doctrine.

### C006
- key: Write a regression test pinning the fixed cause of a defect that actually happened.
- class: rule
- source: plugins/claude-kit/skills/testing-discipline/SKILL.md:17
- provenance: 27ac5d7 2026-08-27, the litmus; the census counted eleven regression saves.
- verdict: keep
- reason: no finding.

### C007
- key: Write a test for any contract whose break no gate short of a test reliably catches, even when no listed item names it.
- class: rule
- source: plugins/claude-kit/skills/testing-discipline/SKILL.md:19
- provenance: 27ac5d7 2026-08-27, the class closer added at the review round ("the litmus class did not cleanly contain its own first instance", a Minor).
- verdict: keep
- reason: no finding.

### C008
- key: Prefer one whole-tree pin that visits every member of a family over a test per function.
- class: rule
- source: plugins/claude-kit/skills/testing-discipline/SKILL.md:21
- provenance: 27ac5d7 2026-08-27, from the census finding that whole-tree pins were the shapes that caught defects while function mirrors dominated the intentional-change breakages.
- verdict: keep
- reason: The five named shapes are the census's saves and the class closer is what reaches a new shape; a session cutting the list cuts the evidence. C019's focused test composes with it through C020's "what an earlier test cannot see".

### C009
- key: When a family gains a member, extend the family's pin or write the family's first pin instead of giving the member private function mirrors.
- class: rule
- source: plugins/claude-kit/skills/testing-discipline/SKILL.md:21
- provenance: 27ac5d7 2026-08-27, same install; the RED probe for this rule half-reproduced (the unguided agent added a roster control and eleven mirrors anyway).
- verdict: keep
- reason: It is C008 at the moment it bites, with the act named; the probe shows the moment is exactly where a writer falls back to mirrors.

### C010
- key: Retire a test in the tree that falls in a retirement class, and do not write a candidate that falls in one.
- class: rule
- source: plugins/claude-kit/skills/testing-discipline/SKILL.md:25
- provenance: 70b1f73 2026-09-04, the subtraction-bars plan's Section 1: the kit had rules for adding tests and none for removing them (96,900 test lines against 50,300 product).
- verdict: keep
- reason: Opener of the retire list; the bound (C011) and the class closer (C018) are its other two parts, not copies. The retire-class agreement pin reads the class heads out of this file, so a rename of any head has to carry every carrier.

### C011
- key: Repair rather than delete where the contract still needs cover: re-pin a wording pin on a stable form, repoint a moved contract's test at its new home.
- class: rule
- source: plugins/claude-kit/skills/testing-discipline/SKILL.md:25
- provenance: 70b1f73 2026-09-04, added when the rule as drafted would have retired four or more guards whose comments record the drift they exist to catch.
- verdict: keep
- reason: Without it the retire rule deletes tests whose contract still needs cover; it also covers the wording-pin repair that no class bullet names.

### C012
- key: Retire an implementation mirror, a test that restates a function's body.
- class: rule
- source: plugins/claude-kit/skills/testing-discipline/SKILL.md:27
- provenance: 70b1f73 2026-09-04, folded from the skill's former "What never earns one" paragraph (27ac5d7).
- verdict: keep
- reason: no finding.

### C013
- key: Retire a hardcoded count pin that another assertion in the same suite already covers.
- class: rule
- source: plugins/claude-kit/skills/testing-discipline/SKILL.md:28
- provenance: 70b1f73 2026-09-04, with the two exceptions added when the class as drafted retired a live length assertion that guards a set comparison against two empty sets; d2e2f37 2026-09-05 clarified "another leg" as another assertion in the same suite.
- verdict: keep
- reason: The exceptions are what keep the class from retiring instrument controls; C015's duplicate class does not carry them.

### C014
- key: Retire an exact-wording pin on stderr, stdout, or curated prose, pinning the exit code, a stable token, or a machine-read field instead.
- class: rule
- source: plugins/claude-kit/skills/testing-discipline/SKILL.md:29
- provenance: 70b1f73 2026-09-04; the byte-identity carve-out was the plan's load-bearing correction, since the tree held at least six pinned copy sets no registry names and the rule as written would have retired their guards.
- verdict: keep
- reason: no finding.

### C015
- key: Retire a duplicate test whose failure implies another's and which catches nothing the other misses.
- class: rule
- source: plugins/claude-kit/skills/testing-discipline/SKILL.md:30
- provenance: 70b1f73 2026-09-04; the direction of implication was corrected from the plan's own draft, which had named the more sensitive test as the duplicate.
- verdict: keep
- reason: The count-pin class (C013) is its instance with exceptions, and the control-leg exemption (C017) is its stated carve-out; neither conflicts with it.

### C016
- key: Retire an orphan test whose contract no longer exists, and repoint one whose contract merely moved.
- class: rule
- source: plugins/claude-kit/skills/testing-discipline/SKILL.md:31
- provenance: 70b1f73 2026-09-04.
- verdict: keep
- reason: The class carries its own repair so a reader of the list sees it; C011 is the general rule.

### C017
- key: Keep a leg whose job is to prove the comparison beside it had something to compare, whatever its shape.
- class: rule
- source: plugins/claude-kit/skills/testing-discipline/SKILL.md:33
- provenance: 70b1f73 2026-09-04, added because the classes as drafted retired the withheld controls the doctrine's silent-check bullet mandates, two of them live in the kit's own suite; d2e2f37 respelled "neighbour".
- verdict: keep
- reason: A stated exemption, not a conflict with C015 or C018: a control's defect (an empty comparison) is caught nowhere else. It is written on what the leg is for rather than its shape so a new control shape is covered.

### C018
- key: Retire, and never write, any test whose maintenance cost is not paid for, even when no listed class names it.
- class: rule
- source: plugins/claude-kit/skills/testing-discipline/SKILL.md:35
- provenance: 70b1f73 2026-09-04; the closer's first three reasons reached only the moving-assert half and the holds-on-a-break case was added ("A fold that narrows the rule is not a fold").
- verdict: keep
- reason: All four conditions are load-bearing and the missing fourth was a recorded defect; compressing the closer is where that defect recurs.

### C019
- key: Write one focused test per stated behavior, sized like its neighbors.
- class: rule
- source: plugins/claude-kit/skills/testing-discipline/SKILL.md:37
- provenance: 70b1f73 2026-09-04, the shape bar specified in the subtraction-bars plan's Section 1; d2e2f37 2026-09-05 reworded the paragraph at the finishing fix round.
- verdict: keep
- reason: Composes with C008 through C020; no history records friction with the paragraph's four rules sharing one paragraph.

### C020
- key: Add a further test beside an existing one only where its subject is something the earlier test cannot see.
- class: rule
- source: plugins/claude-kit/skills/testing-discipline/SKILL.md:37
- provenance: 70b1f73 2026-09-04, as C019; the instances clause names the controls the doctrine mandates so they are not read as surplus.
- verdict: keep
- reason: This clause is what reconciles the family pin with a member's own behavior test and what keeps withheld controls off the surplus list.

### C021
- key: Where a section adds tests and retires none, state the reason in that section's Chapter.
- class: rule
- source: plugins/claude-kit/skills/testing-discipline/SKILL.md:37
- provenance: 70b1f73 2026-09-04, the section duty from the subtraction-bars plan, with the Chapter's contents left to executing-work.
- verdict: keep
- reason: The duty is the plan's mechanism for a suite that only grows; the carrier (the Chapter's Delta line) is executing-work's.

### C022
- key: For a temporary repro, follow the doctrine's "Make the test earn its green" bullet.
- class: pointer
- source: plugins/claude-kit/skills/testing-discipline/SKILL.md:37
- provenance: 70b1f73 2026-09-04 ("with the doctrine's own bullet left to govern a scratch check"); d2e2f37 renamed the scratch check a temporary repro.
- verdict: keep
- reason: A pointer at the owner of the red-first discipline; it stops the shape bar being read as retiring a temporary repro.

### C023
- key: Pin a hazard that an area's shared setup avoids with one test that does not share that setup.
- class: rule
- source: plugins/claude-kit/skills/testing-discipline/SKILL.md:41
- provenance: 27ac5d7 2026-08-27, from the memq network blind spot (the memory-anchors plan's Section 7 Critical: every pinned test routed around the cwd walk, so the suite went green over a hang every unpinned session hit); Chapter 1 records the rule shipped on point-of-action rationale, its RED probe not reproducing.
- verdict: rewrite
- reason: The paragraph states the act twice (opening and closing "So" sentence); merge them into one statement carrying the diagnostic question and the act. The incident class recurs wherever a fixture avoids a hazard uniformly, so the rule itself stays.
- proposed: The paragraph is the merged rule of A019 with the memq example retired to this ledger (A022).
- proposed: (via A019) Merge C023 and C024 into one statement that carries the question ("ask what the uniformity avoids") and the act (one test without the setup).
- baseline-test: yes

### C024
- key: When an area's setup is uniform, ask what the uniformity avoids and give the area one test without it.
- class: rule
- source: plugins/claude-kit/skills/testing-discipline/SKILL.md:41
- provenance: 27ac5d7 2026-08-27, as C023.
- verdict: retire
- reason: Merged into C023; its one addition, "ask what the uniformity avoids", rides into the merged sentence.

### C025
- key: Treat the kit's memq network tests, which pin KIT_MEMORY_PROJECT and so route around the cwd walk, plus their unpinned control, as the worked instance of the blind-spot rule.
- class: rationale-example
- source: plugins/claude-kit/skills/testing-discipline/SKILL.md:41
- provenance: 27ac5d7 2026-08-27; the incident is the memory-anchors plan's Section 7 Critical and the memq-network-cwd-resolver plan's control.
- verdict: retire
- reason: The rule stands without it, and the example's "the one test that can see it" is already stale: the cwd-resolver plan found four unpinned network cases at its base ref and added seven more, so `test/memq.test.js` now holds many. The worked instance lives here and in that archived plan: pinned memq tests return the pinned segment before the cwd walk, so only an unpinned case can see a hang in the walk.
- proposed: Delete the worked-example sentence; the blind-spot rule stands on the merged statement of A019.
- baseline-test: yes

### C026
- key: Set the suite's wall clock and parallelism when each test is written, not when someone finally profiles the suite.
- class: rationale-example
- source: plugins/claude-kit/skills/testing-discipline/SKILL.md:45
- provenance: efcfa16 2026-08-27, when the doctrine's authoring bullet shrank to this principle plus a pointer and the skill restated it as a sanctioned point-of-action copy (plan Chapter 2).
- verdict: retire
- reason: The doctrine keeps the principle always-loaded ("A suite's wall clock and its parallelism are set one test at a time, at authoring") and the four pricing bullets are obeyable without the restatement. Its why: a dependent test hides its dependence until the runner goes parallel, and a profiling pass finds the cost after every test has been shaped.
- proposed: Delete the framing sentence; the section opens on "Each expensive shape has a cheaper form that sees the same defects".
- baseline-test: yes

### C027
- key: Replace a spawn per assertion with a spawn per batch: run the process once and assert many times against its output.
- class: rule
- source: plugins/claude-kit/skills/testing-discipline/SKILL.md:47
- provenance: 27ac5d7 2026-08-27, from the census's 239 spawn-class call sites across 32 test files.
- verdict: keep
- reason: no finding.

### C028
- key: Build a fixture once per process and give each test its own copy to mutate, rather than building it per test.
- class: rule
- source: plugins/claude-kit/skills/testing-discipline/SKILL.md:48
- provenance: 27ac5d7 2026-08-27, the cost shapes.
- verdict: keep
- reason: An instance under the class closer C033, the same enumeration shape as the litmus; the instance is the shape the census priced.

### C029
- key: Give each test an owned temp dir instead of a fixed port or shared mutable state.
- class: rule
- source: plugins/claude-kit/skills/testing-discipline/SKILL.md:49
- provenance: 27ac5d7 2026-08-27; the doctrine's authoring bullet keeps the same sentence by the plan's requirement and routes the shapes here (parity-pinned route).
- verdict: keep
- reason: The owner's statement of the shape; the doctrine's copy is the principle-keeping restatement the plan adjudicated. Deleting it strands C030.

### C030
- key: Configure the test runner parallel from day one so a dependent test fails at birth rather than at a retrofit.
- class: rule
- source: plugins/claude-kit/skills/testing-discipline/SKILL.md:49
- provenance: 27ac5d7 2026-08-27; Standing Brief Amendment 2 of the same plan required every test to run green under the parallel runner.
- verdict: keep
- reason: no finding.

### C031
- key: Use a real process spawn only where a shell, CLI, or cross-process boundary is the subject, and test everything else in-process.
- class: rule
- source: plugins/claude-kit/skills/testing-discipline/SKILL.md:50
- provenance: 27ac5d7 2026-08-27, the cost shapes.
- verdict: keep
- reason: no finding.

### C032
- key: Price a real process spawn at roughly half a second to a second when judging a test's shape.
- class: mechanic
- source: plugins/claude-kit/skills/testing-discipline/SKILL.md:50
- provenance: 27ac5d7 2026-08-27, restored at the review round ("the per-spawn cost magnitude, which is the argument for batching, had been dropped", a Minor).
- verdict: keep
- reason: no finding.

### C033
- key: Move any cost paid per test to once per process, and make any shared resource an owned one, beyond the four named shapes.
- class: rule
- source: plugins/claude-kit/skills/testing-discipline/SKILL.md:52
- provenance: 27ac5d7 2026-08-27, the class closer for the cost shapes.
- verdict: keep
- reason: The closer reaches a shape no bullet names; the bullets are its instances and neither replaces the other.

### C034
- key: Run the lane the gate moment names, never a bigger one.
- class: rule
- source: plugins/claude-kit/skills/testing-discipline/SKILL.md:56
- provenance: 27ac5d7 2026-08-27, the section opener; the rule proper is C048's closing default from efcfa16.
- verdict: retire
- reason: The clause is the reason C048 exists: the suite's wall clock was spent at the cadence, not the test count (four whole gates on one section's fix rounds, 333 s quiet against 816 s beside a neighbor). The lead-in "Each gate moment names its lane" stays as the list's introduction.
- proposed: (via A029) Cut the wall-clock clause from line 56, leaving "Each gate moment names its lane:"; C048 carries the instruction.
- baseline-test: yes

### C035
- key: Compose the targeted lane as the changed files' tests plus any whole-tree pin whose subject those files are.
- class: mechanic
- source: plugins/claude-kit/skills/testing-discipline/SKILL.md:58
- provenance: efcfa16 2026-08-27 review finding (a lane of the changed files' tests structurally could not reach a whole-tree pin, which that diff itself demonstrated), restated at cceff11 2026-08-31.
- verdict: keep
- reason: Deliberately stated in full on the doctrine and here and pinned as such for doctrine-only-reader visibility; a change to the definition lands on both copies or reds the lane-text pin.

### C036
- key: Take the targeted lane at a fix round and at a section close, whatever the delta touched.
- class: rule
- source: plugins/claude-kit/skills/testing-discipline/SKILL.md:58
- provenance: a321af3 2026-08-30, the gate-cadence plan's core sentence (operator decision 2026-08-30: the whole gate saved for the handoff; 25-plus-minute gates on the NEO box priced a ten-chapter plan at 250 added minutes), with the push forward-reference added against that plan's Section 2 Critical.
- verdict: rewrite
- reason: The rule, the push forward-reference and C037's act stay; the sentence explaining why the definition has a second half moves here: a family's pin usually lives in a file of its own, so a lane derived from filenames alone excludes the very shape this skill prefers.
- proposed: Keep the definition, C036, C037's act, the push forward-reference and C038's duty (or its pointer per A040); move "a family's pin usually lives in a file of its own, so a lane derived from filenames alone excludes the very shape this skill prefers" to the ledger.
- baseline-test: yes

### C037
- key: Run a family's pin whatever file it sits in when a change touches a family member.
- class: rule
- source: plugins/claude-kit/skills/testing-discipline/SKILL.md:58
- provenance: efcfa16 2026-08-27 review finding, as C035.
- verdict: keep
- reason: The act that makes the targeted lane honest; the doctrine's copy gives the reason and this one gives the act, and the definition is pinned on both.

### C038
- key: Name in the closing Chapter the lane or lanes that ran for that section.
- class: rule
- source: plugins/claude-kit/skills/testing-discipline/SKILL.md:58
- provenance: 9784239 2026-08-30, the gate-cadence plan's Section 5: every Chapter satisfied the template and violated the doctrine because nothing that defines a Chapter carried the lane; the template gained its Gate field.
- verdict: rewrite
- reason: Executing-work owns Chapter contents and its Gate field carries the duty and the reason; this becomes a pointer at that field so three copies do not drift.
- proposed: (via A040) Replace the sentence with a pointer at the Chapter template's Gate field in executing-work.
- baseline-test: yes

### C039
- key: Run the whole gate at finishing, before the plan's handoff.
- class: rule
- source: plugins/claude-kit/skills/testing-discipline/SKILL.md:59
- provenance: a321af3 2026-08-30 (the moment) and 9784239 2026-08-30 (the one-moment reading), gate-cadence plan.
- verdict: keep
- reason: Pinned phrase on both copies; the doctrine names the moments, this skill the mechanics, finishing-work the run inside its pass.

### C040
- key: Run the whole gate before a push only where that push lands on a trunk consumers install from directly with no CI gating the merge.
- class: rule
- source: plugins/claude-kit/skills/testing-discipline/SKILL.md:59
- provenance: a321af3 2026-08-30, gate-cadence Principle 2 (operator decision 2026-08-30): the condition keys on the surface so claude-kit stops matching it the day it gains branch protections, with no rule edit.
- verdict: keep
- reason: One condition on seven carriers, pinned alike with a shape sweep for an eighth; a reword reaches every carrier or none.

### C041
- key: Treat finishing's own full-suite run as the handoff gate; run no second gate between them.
- class: mechanic
- source: plugins/claude-kit/skills/testing-discipline/SKILL.md:59
- provenance: 9784239 2026-08-30, gate-cadence Section 6: a reader took "at finishing, before the plan's handoff" as two moments and looked for a second gate no procedure runs.
- verdict: keep
- reason: The parity test asserts this sentence on this skill; the doctrine's sentence was left as approved because it reads correctly under this gloss.

### C042
- key: Decide the pre-push whole gate on the trunk's surface, never a repo's name, and drop it the day the trunk gains branch protections and a merge gate.
- class: rule
- source: plugins/claude-kit/skills/testing-discipline/SKILL.md:59
- provenance: a321af3 2026-08-30, Principle 2 as C040.
- verdict: keep
- reason: The principle that lets the condition retire itself without an edit; removing it leaves the condition reading as a rule about claude-kit.

### C043
- key: Run finishing's whole gate even where downstream CI exists.
- class: rule
- source: plugins/claude-kit/skills/testing-discipline/SKILL.md:59
- provenance: a321af3 2026-08-30, gate-cadence Principle 1 (operator decision 2026-08-30): a plan hands off clean on our own evidence.
- verdict: keep
- reason: An operator decision stated at the owner with its reason; the doctrine's clause is the approved verbatim text.

### C044
- key: Run the whole gate on a merge.
- class: rule
- source: plugins/claude-kit/skills/testing-discipline/SKILL.md:59
- provenance: 9784239 2026-08-30, gate-cadence Section 6: post-merge lost its lane when the unconditional pre-push gate retired, and a merge's redness sits in files neither parent changed (the 27ac5d7 baseline's stale-stamp reds after merge ee7a336 are the recorded instance).
- verdict: keep
- reason: Pinned on both copies and carried by every finishing-work merge bullet under the integration-verb sweep.

### C045
- key: Populate the contention lane with the tests whose subject is genuinely machine-shared state, such as a machine-global tier or a real shared lock, each saying so in its own text.
- class: mechanic
- source: plugins/claude-kit/skills/testing-discipline/SKILL.md:60
- provenance: 27ac5d7 2026-08-27, the testing-discipline plan's Section 4 (the memq type-lock test's subject was the machine-global tier, so a sibling's write was indistinguishable from the rival under test); line reworded at a321af3.
- verdict: keep
- reason: The only definition of the lane's membership in the kit; the finishing pass and the qa-verifier run the lane but read its membership from here.

### C046
- key: Run the contention lane serially, beside the whole gate wherever the whole gate runs, and at a section close whenever that delta touched machine-shared state.
- class: rule
- source: plugins/claude-kit/skills/testing-discipline/SKILL.md:60
- provenance: 27ac5d7 2026-08-27 review Major (the lane never ran at section close, so a machine-shared change could close green with its tests skipped); schedule restated at a321af3.
- verdict: keep
- reason: Pinned schedule on both copies, with the finishing pass and the qa-verifier pinned at their points of action.

### C047
- key: Move a main-gate test that needs the box to itself into the contention lane rather than retrying the main gate until it passes.
- class: rule
- source: plugins/claude-kit/skills/testing-discipline/SKILL.md:60
- provenance: 27ac5d7 2026-08-27, from the evening where every red was a contention flake re-run rather than moved.
- verdict: keep
- reason: The repair the lane exists for; without it the main gate is retried until green, which is the incident.

### C048
- key: Take the targeted lane at any step not named among the gate moments, and earn the whole gate only at the named moments.
- class: rule
- source: plugins/claude-kit/skills/testing-discipline/SKILL.md:62
- provenance: efcfa16 2026-08-27 review finding that the lane enumeration was not closed with its class.
- verdict: keep
- reason: The closing default over this file's list; the doctrine closes its own list the same way, re-sited at 9784239 after a reader priced a merge at the targeted lane.

### C049
- key: Expect a trunk under this cadence to carry a collateral red mid-plan in the families the plan never touched, chiefly consumers of a shared module it changed.
- class: rationale-example
- source: plugins/claude-kit/skills/testing-discipline/SKILL.md:64
- provenance: a321af3 2026-08-30, operator decision 2026-08-30 accepting late discovery with its price named; the window-cutting clause is the fix for that plan's Section 2 Critical (the skill had claimed nothing between sections reads the tree, false for a Commit-and-Push push to main).
- verdict: rewrite
- reason: The pricing narrative moves here: reserving the whole gate for the handoff means a targeted lane reads the changed files' families and nothing further out, so an untouched consumer of a changed shared module can go red unseen until finishing, except where a push to an install-surface trunk or a mid-plan merge fires the whole gate. The clause naming those two moments stays in the skill.
- proposed: Reduce the paragraph to the window-cutting clause and C050; the pricing sentences ("Reserving the whole gate for the handoff buys wall clock at a named price", "So the price is paid between the sections only...") move to the ledger.
- baseline-test: yes

### C050
- key: When your own baseline reddens, suspect the in-flight plan before your own change, and confirm by checking whether the red sits outside your diff.
- class: rule
- source: plugins/claude-kit/skills/testing-discipline/SKILL.md:64
- provenance: a321af3 2026-08-30; the approved text first pointed the heuristic at the changed families and was corrected to the untouched consumers, which is the direction the lane cannot read.
- verdict: keep
- reason: The peer's reading rule at the point of action, separating suspicion from its confirming check; the doctrine's copy is the approved verbatim sentence.

### C051
- key: Read a lane's delta against a baseline recorded on that same lane.
- class: rule
- source: plugins/claude-kit/skills/testing-discipline/SKILL.md:66
- provenance: efcfa16 2026-08-27 review Critical: splitting the gate into lanes left the baseline unscoped, so a 12-test targeted run could be diffed against an 1853-test baseline and reported as no regressions.
- verdict: rewrite
- reason: The ownership map gives delta reporting to the doctrine's gate bullet, whose copy is pinned and carries the same reason; this line becomes a pointer at it.
- proposed: (via A065) Replace line 66 with a pointer at the doctrine's gate bullet for the same-lane baseline and the whole-gate baseline rules.
- baseline-test: yes

### C052
- key: Take a whole-gate baseline of its own before claiming no regressions across the suite.
- class: rule
- source: plugins/claude-kit/skills/testing-discipline/SKILL.md:66
- provenance: efcfa16 2026-08-27, as C051.
- verdict: rewrite
- reason: As C051; the doctrine's copy is the owner's.
- proposed: (via A065) Replace line 66 with a pointer at the doctrine's gate bullet for the same-lane baseline and the whole-gate baseline rules.
- baseline-test: yes

### C053
- key: Read a repo's lane commands from that project's memory tier.
- class: pointer
- source: plugins/claude-kit/skills/testing-discipline/SKILL.md:68
- provenance: 27ac5d7 2026-08-27, as C001.
- verdict: retire
- reason: Duplicate of C001 within the file; line 68 keeps the record duty (C054) and points at the header for the read.

### C054
- key: Record a repo's lane commands in that project's memory tier when the repo first defines its lanes.
- class: rule
- source: plugins/claude-kit/skills/testing-discipline/SKILL.md:68
- provenance: 27ac5d7 2026-08-27; the plan's Section 4 landed the kit repo's own lane commands in its project memory as the close-out's memory work.
- verdict: keep
- reason: no finding.

### C055
- key: Discriminate a red by following the protocol rather than by re-running the world.
- class: rule
- source: plugins/claude-kit/skills/testing-discipline/SKILL.md:72
- provenance: 27ac5d7 2026-08-27, the plan's Approach bullet of the same words, against the evening of four full re-runs.
- verdict: keep
- reason: no finding.

### C056
- key: Capture the exit code and the discriminating output from the run itself: a foreground run's exit status, or a backgrounded run's own marker and log error text.
- class: rule
- source: plugins/claude-kit/skills/testing-discipline/SKILL.md:74
- provenance: 27ac5d7 2026-08-27; the two forms were the fix for the review Minor that the marker requirement was unexecutable for a foreground run.
- verdict: keep
- reason: The red protocol's first rung, owned here; the wrapper prohibition and the isolation fallback that follow it are the doctrine's background-task bullet's and become a pointer.

### C057
- key: Never read the exit code or error from a background wrapper's completion notification, which reports only the wrapper's exit.
- class: rule
- source: plugins/claude-kit/skills/testing-discipline/SKILL.md:74
- provenance: 27ac5d7 2026-08-27, restating the doctrine's background-task bullet.
- verdict: retire
- reason: The doctrine's bullet title is this sentence, always loaded, and the map gives background-run markers to the doctrine; C056's "from the run itself" already excludes the wrapper.
- proposed: (via A073) Delete the sentence; C056's "from the run itself" and the pointer of A071 carry it.
- baseline-test: yes

### C058
- key: Where an isolation screen refuses the marker compound, use a bare redirect plus the run's own summary output.
- class: mechanic
- source: plugins/claude-kit/skills/testing-discipline/SKILL.md:74
- provenance: 27ac5d7 2026-08-27, the same review Minor's isolation-screen half.
- verdict: rewrite
- reason: No hook performs the fallback, so it is not superseded, but the doctrine owns the isolation screen and states the fallback twice; a pointer keeps the rung from stranding a worktree-isolated reader.
- proposed: (via A075) Replace the sentence with a pointer at the doctrine's background-task bullet for the isolation-screen fallback.
- baseline-test: yes

### C059
- key: Run the test solo, then its class, then a full re-run with no code change, then check a clean tree or the recorded baseline.
- class: mechanic
- source: plugins/claude-kit/skills/testing-discipline/SKILL.md:75
- provenance: 27ac5d7 2026-08-27; the clean-tree rung was a review Major (no rung separated a regression you caused from a pre-existing red).
- verdict: keep
- reason: The protocol is this skill's; the doctrine's retained clause was re-synced to four rungs at efcfa16, and the qa-verifier's "run twice" is the surface that gives way.

### C060
- key: Do not skip the clean-tree rung, or a deterministic pre-existing red gets named a regression of whatever change is in flight.
- class: rationale-example
- source: plugins/claude-kit/skills/testing-discipline/SKILL.md:75
- provenance: 27ac5d7 2026-08-27, as C059.
- verdict: retire
- reason: The step already says what the rung separates; this repeats the consequence. Its why: the clean-tree or recorded-baseline read is the only rung that can exonerate the change in flight.
- proposed: Delete "Skip that last rung and a deterministic pre-existing red gets named a regression of whatever change happens to be in flight."
- baseline-test: yes

### C061
- key: Name the red a flake or a regression, with a reason citing the discriminating output, before moving on.
- class: rule
- source: plugins/claude-kit/skills/testing-discipline/SKILL.md:76
- provenance: 27ac5d7 2026-08-27, the protocol's closing rung.
- verdict: keep
- reason: Owner's rung; the doctrine's "A red is a signal" bullet is the principle, and a named flake is still filed as a finding under it, so the qa-verifier does not conflict.

### C062
- key: Record the suite's wall clock alongside the pass/fail counts at a baseline, and name the lane the baseline ran on.
- class: rule
- source: plugins/claude-kit/skills/testing-discipline/SKILL.md:82
- provenance: 27ac5d7 2026-08-27 (the wall-clock capture would have been orphaned when Section 2 shrank the authoring bullet, a review Major) and efcfa16 2026-08-27 (the lane name, from the unscoped-baseline Critical).
- verdict: rewrite
- reason: The two rules stay; the purpose clause moves here: a later run needs a figure to diff against rather than a recollection, and a lane to diff it on, because a targeted run's clock says nothing about a whole gate's.
- proposed: Drop the purpose clause; the bullet reads as the two rules.
- baseline-test: yes

### C063
- key: Route wall-clock growth past a few minutes as a finding, such as a fast lane for day-to-day edits, rather than absorbing it.
- class: rule
- source: plugins/claude-kit/skills/testing-discipline/SKILL.md:82
- provenance: 27ac5d7 2026-08-27, designed with C072 as one rule; the operator-tier record on this box (three same-tree runs at 1,913 s to 2,607 s with the quiet box slowest) is why C072 must bound it.
- verdict: rewrite
- reason: Reads as an absolute threshold; state that the growth is first established under the contention rule, then routed.
- proposed: C063 states its dependency: growth established under the contention rule, past a few minutes, is a finding to route.
- baseline-test: yes

### C064
- key: Give every measured figure recorded in a journal-layer artifact a moment-pin.
- class: rule
- source: plugins/claude-kit/skills/testing-discipline/SKILL.md:83
- provenance: 7ef71e3 2026-09-01, instruments-not-prose Decision 1 (operator, 2026-08-29): six expired readings leaned on in one evening after the box's hardware changed under them.
- verdict: keep
- reason: The convention's single owning site, pinned so a restatement anywhere in the shipped kit reddens; every other surface points here.

### C065
- key: Make a moment-pin state what produced the figure, when, on which machine, and under what contention.
- class: mechanic
- source: plugins/claude-kit/skills/testing-discipline/SKILL.md:83
- provenance: 7ef71e3 2026-09-01; the machine field is what lets a figure be placed against an epoch.
- verdict: keep
- reason: The pin's form, and "under what contention" is the phrase the parity sweep counts.

### C066
- key: Consult the memory-system skill for the per-hostname configuration-epoch record and the expiry rule that reads a figure against it.
- class: pointer
- source: plugins/claude-kit/skills/testing-discipline/SKILL.md:83
- provenance: 7ef71e3 2026-09-01, Section 2 (the epoch as a memory record at a canonical key).
- verdict: keep
- reason: The parity test checks the far end still carries the epoch record and the expiry rule; the pointer is pinned at both ends.

### C067
- key: Treat the journal layer as the conversation, the plan doc's Chapters, the commit message, and append-only history such as an archive or changelog.
- class: mechanic
- source: plugins/claude-kit/skills/testing-discipline/SKILL.md:83
- provenance: 7ef71e3 2026-09-01, restating the doctrine's journey-ban bullet and its append-only exemption.
- verdict: rewrite
- reason: The doctrine owns the layer's definition and the sentence already names it as the doctrine's; it becomes a pointer, keeping only that Chapters carry pinned figures under the append-only exemption.
- proposed: (via A090) Replace the journal-layer sentence with a pointer at the doctrine's "Documents ship the current state" bullet, keeping only that Chapters carry pinned figures under its append-only exemption.
- baseline-test: yes

### C068
- key: In a plan doc, put pinned figures and dated evidence only in its Chapters, its interim board entries, and its Evidence section.
- class: rule
- source: plugins/claude-kit/skills/testing-discipline/SKILL.md:83
- provenance: 7ef71e3 2026-09-01, Decision 1's sites ("a Chapter, a board line, an evidence entry").
- verdict: rewrite
- reason: "Dated evidence ... nowhere else" over-reaches the decision and bars the "decided YYYY-MM-DD" records the doctrine requires and the archived plans carry in Decisions sections; scope it to moment-pinned measured figures.
- proposed: Scope the sentence to moment-pinned measured figures; a dated decision record is the doctrine's decision-batch rule and is untouched.
- baseline-test: yes

### C069
- key: Carry no dated-evidence annotation in a curated document, a code comment, or a skill body.
- class: rule
- source: plugins/claude-kit/skills/testing-discipline/SKILL.md:83
- provenance: 7ef71e3 2026-09-01, the bar the operator made load-bearing in Decision 1, written as the one-sentence pointer at the doctrine's ban the plan's Section 1 prescribed.
- verdict: keep
- reason: Already the pointer form; the plan doc is excluded by the preceding sentence's carve-out.

### C070
- key: Keep the deep evidence behind a figure, such as a scatter analysis or multi-run comparison, in memory or in the plan's Evidence section, and cite it from a journal line.
- class: rule
- source: plugins/claude-kit/skills/testing-discipline/SKILL.md:83
- provenance: 7ef71e3 2026-09-01, Decision 1 ("cited from the journal line, never restated in it"); the project memory holding the suite baseline was cut to a pointer and kept the scatter analysis it is the home for.
- verdict: keep
- reason: Part of the single owning site; removing it reopens restated evidence at every journal line.

### C071
- key: Record the box's process count and free memory, captured at the run, beside every wall-clock figure.
- class: rule
- source: plugins/claude-kit/skills/testing-discipline/SKILL.md:84
- provenance: 27ac5d7 2026-08-27, the comparable-contention rule (the suite at 333 s quiet and 816 s beside a neighbor at one commit).
- verdict: rewrite
- reason: The rule, its bound and the procedure stay; the closing consequence sentence moves here: without a comparable-contention baseline a raw cross-load reading manufactures a finding out of a busy box.
- proposed: Drop "Without that comparison a raw cross-load reading manufactures a finding out of a busy box."; keep the rule, the bound and the procedure.
- baseline-test: yes

### C072
- key: Call wall-clock growth a finding only against a baseline at comparable contention or a same-conditions trend.
- class: rule
- source: plugins/claude-kit/skills/testing-discipline/SKILL.md:84
- provenance: 27ac5d7 2026-08-27, as C071.
- verdict: keep
- reason: The bound that keeps C063 honest; the operator-tier scatter record shows the between-run band exceeds the effects the bars were written to detect.

### C073
- key: Observe the contention edge by running the same suite on the same tree once with the box quiet and once beside a neighbor's suite.
- class: mechanic
- source: plugins/claude-kit/skills/testing-discipline/SKILL.md:84
- provenance: 27ac5d7 2026-08-27 review Minor ("varies widely enough" had no observable edge).
- verdict: keep
- reason: no finding. A session changing it should know the operator-tier record `box-duration-figures-need-a-co-measured-control` found two runs hours apart diff across an unrecorded fleet size and asks for a co-measured control in the same run; that record post-dates this sentence and the kit answered it with the moment-pin rather than an edit here.

### C074
- key: Before starting a suite, check the process list for any foreign process holding the box's memory, CPU, or the repo's binaries, whatever its engine or owner.
- class: rule
- source: plugins/claude-kit/skills/testing-discipline/SKILL.md:85
- provenance: 27ac5d7 2026-08-27, the engine-agnostic box check, after a session followed the doctrine's enumerated list exactly and missed a live node --test gate; d2e2f37 respelled "neighbour".
- verdict: keep
- reason: The same rule at two points of action by design, with the skill's bullet pinned on its class phrases and both blind spots so a session loading either copy gets the same check.

### C075
- key: When the pre-suite check finds a foreign process, either wait for it or name the contention in what you report.
- class: rule
- source: plugins/claude-kit/skills/testing-discipline/SKILL.md:85
- provenance: 27ac5d7 2026-08-27, as C074.
- verdict: keep
- reason: Part of the pinned two-copy rule; the doctrine's cost sentence makes waiting sound, not mandatory, so there is no fork.

### C076
- key: Treat the pre-suite poll as a sample and never a clearance, since it cannot see in-process agent fan-out or a neighbor starting after the sample.
- class: rationale-example
- source: plugins/claude-kit/skills/testing-discipline/SKILL.md:85
- provenance: 31faeb3 2026-08-28, review-and-record Section 10, from the coordinator's measured finding (three polls over two minutes returning three pictures of one stretch of work).
- verdict: keep
- reason: Pinned on this bullet as the rule's boundary rather than its reason; no machinery replaces the reading and the incident recurs on every shared box.

### C077
- key: Let a clean poll license a spawn only alongside the claim protocol, which the role skill owns in full.
- class: rule
- source: plugins/claude-kit/skills/testing-discipline/SKILL.md:85
- provenance: 31faeb3 2026-08-28, Section 10; the first draft restated the protocol and was cut to a pointer after a Critical (it dropped the carve-out that a proceeding session never writes the claim file).
- verdict: keep
- reason: Pinned phrase; the protocol stays the role skill's and this sentence never grows back into a restatement.

### C078
- key: Treat a run that dies partway through as contention evidence regardless of any clean poll that preceded it.
- class: rule
- source: plugins/claude-kit/skills/testing-discipline/SKILL.md:85
- provenance: 31faeb3 2026-08-28, Section 10, written as a cross-reference to the doctrine's machine-budget bullet rather than a restatement.
- verdict: keep
- reason: Already the pointer form, quoting the owning bullet by title; the operator record on forged partial results is the incident class behind it.
