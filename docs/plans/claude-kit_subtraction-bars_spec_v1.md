# The kit gains subtraction: a rule that retires tests and prose, and a ratchet that holds the size

Status: In Progress
Commit Model: Commit-and-Push
Created: 2026-09-03

Session model: any executor session in the kit repo; four sections, tiers per section. Authored by the KIT: Expert seat from the operator's direction in the 2026-09-03 design dialog, which ranked this plan first in the cycle: the bars land before any audit, so the audits have a bar to cut to.

## Goal

Every rule the kit has about tests and prose says what to add and none says what to remove, so both grow by construction. At HEAD the suite is 96,900 lines against 50,300 lines of product, three quarters of it written in one month, and the skills run to 167,000 words with half their sentences over forty words. When this plan is done the kit carries the mirror rules: what retires a test, what a sentence has to earn to stay, a reviewer duty to name surplus as a finding, and a ratchet test that fails any curated file that grows past a committed budget. Nothing is cut here. The cuts are the corpus audit's and the test audit's, and they cut to these bars.

## Approach

The growth is the rules working as written, not the rules being ignored. The testing-discipline skill has a "what earns a test" list and no retire list. The single-source rule says copy a rule whole under a parity pin, so every restatement is a full copy plus a test. The reviewers are charged with finding what is missing, never what is surplus. A symmetric rule at each of those three sites is the fix, and a ratchet is what makes the rule bite between audits.

Terms this plan leans on. The whole gate is `node --test test/*.test.js` from the repo root, read from its own exit marker; its one permanent failure on this machine is the memory-session path-length test, and green below means that failure set and no other. The doctrine has two tracked copies, `plugins/claude-kit/skills/operating-instructions/SKILL.md` and `home/claude-kit-doctrine.md`, pinned byte-identical by `test/doctrine-parity.test.js`; a third under `plugins/claude-kit/` is gitignored build output the build regenerates, so "both copies" below means the two tracked ones. The register core is the communication-core block the output style copies from the doctrine between its `KIT-REGISTER-CORE` markers, pinned by `test/output-style-parity.test.js`. The four reviewer charters are `adversarial-reviewer`, `blind-reviewer`, `blind-reader` and `prose-reviewer` under `plugins/claude-kit/agents/`.

The bars are written where the ownership map already places the moments. Tests: `testing-discipline` (row 40). Prose: `writing-skills` (row 93). The doctrine keeps its pointers and gains one sentence each way. The reviewer charters carry the duty at the point of action.

A scout sweep ran on 2026-09-03 for every surface stating either contract. Tests: 25 surfaces, the rule itself at `testing-discipline/SKILL.md:10-27`, the floor-never-shrink clause at `executing-work/SKILL.md:112`, the `Tests:` line at `brainstorming/SKILL.md:81`, the reviewer duty at `agents/adversarial-reviewer.md:40`, and four doctrine bullets under Verify and What the suite cannot see. Prose: 26 surfaces, the delete-litmus and the length bullet in the doctrine's Style section (`operating-instructions/SKILL.md:24,28` and the home mirror), `writing-skills/SKILL.md:18,21,56-60`, the ownership map's copy-whole rule at `:3`, and the four reviewer charters' no-restating lines. Two test files pin prose wording: `test/doctrine-parity.test.js` and `test/output-style-parity.test.js`. The sections' file lists come from that sweep.

Decisions:

1. Budgets initialize at current size. This plan sets no cut target. A budget is a ceiling that only the audits lower, and lowering is free; raising one is an edit to the budget file that rides in the diff for the reviewer to see.
2. An exact-wording assertion on prose or on printed text is a retire class except where two or more surfaces carry one text by design, in which case byte-identity is that text's contract and the pin over it stays. That exception is a predicate over the pin rather than a registry of named sets: the tree holds at least six such sets, the doctrine mirror and the register core among them, and the others are pinned by tests whose names carry no identity vocabulary.
3. A count pin retires where nothing derives the count and a sibling leg already catches the same drift. A count each side derives independently stays, and so does a hardcoded count that is the only detector of a symmetric removal. A prose restatement of a count is repaired by deleting the restatement, never by pinning it.
4. The ratchet reads tracked files only, by `git ls-files`, so the gitignored third doctrine copy and scratch never enter it.

## Standing Brief Amendments

Every entry binds every section of this plan, dispatched or inline, and rides into every sighted dispatch brief. Each is sourced from a memory record rather than authored here, and the record is named so a reader can check it.

1. A reviewer of an amendment to a dense kit file reads the whole file, never the diff alone, and the brief names the rules the new prose now sits beside. These files cross-reference themselves densely enough that a rule added to one step contradicts an unchanged rule in another, the new prose reading correct on its own terms while the defect lives in the seam. Budget for a heavy round: one amendment to `executing-work/SKILL.md` has drawn twenty-one findings across two lenses, nearly all seam defects rather than writing defects. (`skill-amendments-collide-with-neighbours`)

2. A claim this plan retires or changes is swept by meaning, in two passes, and the sweep crosses both files and kinds: a code comment, a test block header, a document, this plan's own Approach line and its own acceptance criteria are all neighbours of one another. Enumerate every occurrence of the retired wording, then read each one and classify it against what the amendment actually changed, discarding those that mean something else, because the phrase carrying a retired claim almost always also carries true statements. Run the retired wording as a pattern against the pre-edit text first and watch it speak, since a zero from a pattern that never matched certifies nothing. Chapters and interim boards are append-only history and are exempt. (`a-retired-claim-is-swept-by-meaning-not-by-words`)

3. The round exit for a claims section: a Major is this section's to fix only where it sits in this section's delta and contradicts an acceptance clause or a principle this plan states. Anything else is a file-audit finding, routed to `docs/backlog.md` under step 4's out-of-scope route rather than fixed here. Sections 1 through 3 deliver claims and are expected to take more rounds than a code section; that is the class behaving normally rather than a signal. Section 4 delivers code, so a round count climbing there is a signal. (`claims-sections-need-more-review-rounds-than-code-sections`, and the kaizen note of 2026-09-03 on the missing exit condition)

4. Closure evidence for a rule is a predicate over the rule, stated with its scope and its matches, never a list of the call sites that happen to spell it: a list cannot cover the sites that do not spell it. Writing a defect class into brief text does not stop the class, because a claims defect is invisible by construction to its own author, a true-sounding sentence looking exactly like a true sentence. Where a class can be closed mechanically, the mechanical check is the closure and the prose is not. (`claims-sections-need-more-review-rounds-than-code-sections`)

5. A parity pin over two copies reports that the copies agree and never that either is right, so it is no evidence for a claim added to both. `test/doctrine-parity.test.js` strips the skill copy's YAML frontmatter and normalizes CRLF to LF and the trailing newline before comparing (`:39-63`), so line endings are outside the pin and the constraint is that the prose text lands identically in both copies. (`an-equality-pin-propagates-the-gap-it-should-catch`)

6. Every file this plan edits is CRLF in this checkout. `sed -i` under Git Bash rewrites a CRLF file whole to LF, which would show up as a whole-file diff rather than as the one-line change intended, so edits go through a tool that preserves the file's own endings. (`sed-i-in-git-bash-rewrites-a-crlf-file-whole-to-lf`, `crlf-per-file-in-windows-checkouts`)

## Sections of Work

### 1. The retire rule and the pin bans

Model: opus

The testing-discipline skill gains "What retires a test" directly under "What earns a test", as its mirror. The classes, each with a one-clause example: an implementation mirror; a count pin a sibling leg already covers; an exact-wording pin on prose no identity contract covers; a duplicate, meaning a test whose failure implies another's and which catches nothing the other misses; an orphan, whose contract no longer exists, a contract that merely moved earning a repointed test instead. The existing "What never earns one" paragraph, which already names the mirror and the wording pin, folds into this list so the skill states the retire classes once. The section states the shape bar: one focused test per stated behavior, sized like its neighbours, beyond the further tests whose subject is what an earlier test cannot see, with the doctrine's own bullet left to govern a scratch check. It states the section duty: where a section adds tests and retires none, the reason belongs in its Chapter, whose contents `executing-work` owns, the `Delta:` line that carries a test delta structurally arriving in section 4 rather than here. The doctrine's "Make the test earn its green" bullet gains one sentence pointing at the retire rule, in both doctrine copies. The ownership map's row 40 names retirement beside earning.

Acceptance: the five classes are stated under one heading with the never-earns paragraph folded in; the doctrine-parity suite is green; no surface under `plugins/` or `home/` outside testing-discipline defines the classes, a plan doc that names them for its own use being a pointer rather than a definition. Section 2's charters naming the classes is section 2's acceptance rather than this one's, since no state of section 1 can satisfy it. Sections 1 through 3 write their test delta in Chapter prose, since the `Delta:` line arrives in section 4.

Files in scope: `plugins/claude-kit/skills/testing-discipline/SKILL.md`, `plugins/claude-kit/skills/operating-instructions/SKILL.md`, `home/claude-kit-doctrine.md`, `plugins/claude-kit/skills/operating-instructions/references/ownership-map.md`.

Tests: none new. The parity pin over the doctrine copies is the gate.

### 2. The reviewers name surplus

Model: sonnet

The adversarial reviewer's Tests bullet runs both directions: a test in the changeset that falls in a retire class is a finding, Major for a banned pin class or a restatement of an owner, Minor otherwise, naming the class and pointing at testing-discipline for its definition; a list of five class names is a pointer's index, and the definitions stay with the owner. The prose reviewer gains the same duty over sentences: a sentence failing the delete-litmus or a passage restating an owner is a finding at the same severities, tagged `[style]`. The floor clause at `executing-work/SKILL.md:112` is restated so the floor is the named contracts and an extension is named in the Chapter, never silent. The `Tests:` paragraph inside brainstorming's step 12, the one opening "Where a section carries real behavioral risk", gains one sentence: the line is a floor on contracts and a ceiling on shape, one test per named behavior.

Acceptance: each charter states the duty in one bullet; the two skill edits are one sentence each; a fresh-context read of either charter names the five classes and where their definitions live.

Files in scope: `plugins/claude-kit/agents/adversarial-reviewer.md`, `plugins/claude-kit/agents/prose-reviewer.md`, `plugins/claude-kit/skills/executing-work/SKILL.md`, `plugins/claude-kit/skills/brainstorming/SKILL.md`.

Tests: none new. `test/readonly-agent-guard.test.js` reads the two charters and is their gate; the two skill edits have no mechanical gate, and the section's reviewer pair is theirs.

### 3. The prose bar

Model: opus

The writing-skills skill gains a section stating what a sentence has to earn. The delete-litmus, applied at authoring: a sentence that changes what the reader does stays, one that changes only what they know goes. The size bar: one idea per sentence, a sentence past roughly forty words is split or cut, a paragraph carries one point. The definition of mannered prose, adapted from the "Writing density" section of Anthropic's page "Prompting Claude Fable 5.1" (platform.claude.com, under prompt engineering): prose that substitutes metaphor and flourish for direct statement, exists to display the writer, drags in connotations the writer did not choose, and is fixed by using the literal phrase where one is available. Pointing over restating, already the one-owner rule, restated here only as the pointer. The doctrine's "Match a document's length to its job" bullet gains one sentence naming writing-skills as the owner of the bar, in both copies. The ownership map's row 93 stays as it is.

Acceptance: the new section is under three hundred words and passes its own bar; the doctrine-parity suite is green; the kaizen note of 2026-09-03 on the missing density bar is cleared, which under the kaizen skill means its line is deleted from the inbox in the same commit.

Files in scope: `plugins/claude-kit/skills/writing-skills/SKILL.md`, `plugins/claude-kit/skills/operating-instructions/SKILL.md`, `home/claude-kit-doctrine.md`, `kaizen/notes-SCOTT-CLAUDE.md`.

Tests: none new.

### 4. The ratchet

Model: opus

`plugins/claude-kit/scripts/kit-size.js` reports the size of every curated file, classified by path: words for `plugins/claude-kit/skills/*/SKILL.md`, `plugins/claude-kit/skills/*/references/*.md`, `plugins/claude-kit/agents/*.md`, `plugins/claude-kit/output-styles/*.md` and `home/claude-kit-doctrine.md`; lines and test count for `test/*.test.js`. A word is a whitespace-separated token after the YAML frontmatter is stripped, code fences included; a test is a `test(` or `it(` call site at the start of a line, nested ones counted. It reads tracked files only, and its coverage control is a diff of `git ls-files` under those roots against the classified set: any tracked file under a root that is neither classified nor on a short named exclusion list (`test/size-budget.json`, fixture directories) fails the ratchet, which is what proves the expensive failure absent. `test/size-budget.json` holds one cap per file, initialized at the sizes at this section's commit. `test/size-ratchet.test.js` fails any file over its cap and any curated or test file with no budget entry, so a new skill or test file is a deliberate act that edits the budget in the same diff. The script's `report` verb compares HEAD to the worktree and prints one line per file whose size changed, its size against its cap and the delta, then totals; on a clean tree it prints totals only. That output is what a Chapter's `Delta:` line quotes. The executing-work Chapter template gains `Delta:` beside `Gate:`; the machine-read lines (`Completed:`, `Next:`) are untouched.

Acceptance: the ratchet reds on a fixture one word over cap, on a fixture file absent from the budget, and on a tracked file under a root that the classifier does not reach; it greens at cap; `report` on a clean tree prints only totals; the whole gate is green with the ratchet in it.

Files in scope: `plugins/claude-kit/scripts/kit-size.js`, `test/size-budget.json`, `test/size-ratchet.test.js`, `plugins/claude-kit/skills/executing-work/SKILL.md`.

Tests: the ratchet in both directions, the missing-entry case, and the unclassified-tracked-file case; the expensive failure is a ratchet that greens on a file it never classified, and the coverage diff is its control.

### 5. The describing and pinning surfaces catch up

Model: sonnet

Section 1 changed what the testing-discipline skill owns, and six surfaces that describe or pin that ownership still speak the old contract. This section repairs them. `README.md`'s payload-map entry for `testing-discipline/` promises the skill's scope and names no retirement, and `test/doctrine-parity.test.js` pins that entry's phrases, so the entry gains the retirement clause. `docs/architecture.md` states that two doctrine bullets carry the testing-discipline pointer where three now do, and its enumeration of what the skill owns omits retirement; the count is dropped rather than corrected, per this plan's Decision 3, and retirement is added to the list. A comment in `test/doctrine-parity.test.js` cites the deleted "What never earns one" clause by name as the stated reason for a pin's bounded reach, and is repointed at the retire class that now carries the claim. `docs/plans/claude-kit_test-audit_spec_v1.md` defines all five retire classes in its own terms paragraph, including the duplicate direction section 1 inverted and the orphan disposition it changed, and that enumeration is replaced by a pointer at the owner, since the plan that consumes the classes reading a stale copy of them is how the audit deletes coverage that should be repointed.

Two mechanical closures land here rather than as prose. The doctrine's new pointer at the "Make the test earn its green" bullet has no far-end presence pin, so a symmetric deletion of the pointer or of the skill's `## What retires a test` section leaves the suite green while the doctrine promises content nothing carries; the existing far-end loop in `test/doctrine-parity.test.js` gains that heading and one lead, which extends a pin rather than adding a test. And the defect class that recurred three times inside section 1, a retire class amended in one carrier and left standing in another, gets the predicate that catches it: a pin that enumerates every tracked surface naming a retire class and asserts each agrees with the owner, matched on the class shape rather than on a file list, so a carrier nobody named is reached. Its coverage statement says what it cannot reach, a carrier stating a class without using any of the class names.

Acceptance: no surface outside the owner defines the classes, established by a predicate over the class shape with its scope and matches stated rather than by a list of files; the far-end pin reds when the skill's retire heading is removed and when the doctrine's pointer sentence is removed, each watched red before the fix; the agreement pin reds on a carrier deliberately reworded in a scratch copy; the whole gate is green.

Files in scope: `README.md`, `docs/architecture.md`, `test/doctrine-parity.test.js`, `docs/plans/claude-kit_test-audit_spec_v1.md`.

Tests: the far-end presence pin extended, and the cross-surface class-agreement pin added, both with a watched red. The expensive failure is an agreement pin that greens because its pattern reaches no carrier, so its control is a deliberately reworded carrier in a scratch copy.

## Out of Scope

- Any cut. The corpus audit's follow-on plan cuts prose and the test audit plan cuts tests, both to these bars.
- The meter-aware tier lean, which extends the capacity-gate plan's reader.
- The two parity pins' own size: they are wording pins by design and the test audit decides what they cover.

## Assumptions

- assumed 2026-09-03 (default): budgets initialize at current sizes and carry no cut target; reversal: edit the budget file, one line per file.
- assumed 2026-09-03, revised 2026-09-04 in section 1 (the tree, `test/doctrine-parity.test.js`): byte-identity is the contract wherever two surfaces carry one text by design, and the tree holds at least six such sets rather than the two the ownership map names, so the exception is a predicate over the pin and no registry gates it; reversal: state the exception as a registry again and enumerate every set.
- assumed 2026-09-03 (default): surplus findings take Major for a banned pin class or an owner restatement and Minor otherwise; reversal: one severity line in each charter.
- assumed 2026-09-03 (doctrine, Documents ship the current state): the ratchet counts tracked files only; reversal: a path list in the script.

## Related

- `docs/plans/claude-kit_corpus-audit_spec_v1.md`: the prose audit, whose readers are briefed with section 3's bar and whose follow-on plan cuts to it.
- `docs/plans/claude-kit_test-audit_spec_v1.md`: the test audit, which adjudicates every test against section 1's classes and lowers section 4's caps as it cuts.
- `docs/plans/claude-kit_capacity-gate_spec_v1.md`: the meter reader the tier lean will extend; unrelated to the bars, named so the two are not confused.
- Backlog items of 2026-08-22 and 2026-08-31 on restated facts and a hand-maintained category summary: instances of the owner-restatement class the reviewers now name.

## Open Questions

None.

## Chapters
### Chapter 1 - 2026-09-04

Completed: 1. The retire rule and the pin bans

Implemented By: implementer-opus for the first draft, then the main session for four fix rounds. The fix rounds ran inline rather than dispatched, against the default: they were interlocking wording reconciliations across one dense file whose calls the orchestrator had already made, and handing them out invites re-derivation on exactly the seams the round had just found. That leaves the fixes with no independent reader but the review rounds themselves, which is why a third round ran.

Metrics: 3 review rounds, 4 fix rounds; 0 NEEDS_CONTEXT; 0 escalations; 0 consults.

Decisions / Surprises: the plan's Decision 2 was wrong about the corpus, and that is the section's main finding. It assumed the ownership map names the only two byte-pinned prose copies, so every other exact-wording pin retires. The tree holds at least six such sets and a reviewer counted eight, each pinned by a test whose name carries no identity vocabulary, so the rule as written retired four or more documented drift guards. Decision 2 is restated as a predicate over the pin rather than a registry of named sets, Decision 3 is reconciled with the count criterion the skill ships, and Assumption 2 is revised against the tree. A second inherited defect: the plan's duplicate class read "a test whose failure is implied by another test's failure", which names the more sensitive test as the duplicate, since a test that fails whenever another fails catches everything that one catches. It now reads "whose failure implies another's". Third, the retire classes had no exemption for an instrument control, so they retired the withheld controls the doctrine's own silent-check bullet mandates, two of them confirmed live at `test/doctrine-parity.test.js:4222` and `:2358`. The surprise worth carrying forward is the section's own growth: the retire section went 305, 376, 321, 382, 429 words across the fix rounds, because each round added an exemption the rule genuinely needs. A correct rule with its carve-outs costs more words than an incorrect terse one, which is a real tension inside a plan about subtraction, and the bar the plan's Goal actually names is sentence length, where the section ends clean at a 40-word longest and none over.

One defect class recurred three times in this session's own work: a retire class amended in one carrier and left standing in another (the false pinned-copy sentence in the ownership map, then the stale count and wording classes in the plan's own section text). Per the operator memory that a claims class is closed by a mechanical check rather than by more prose or more rounds, the closure is a predicate that enumerates every tracked surface naming a retire class and reports what each says. Run at this close, it swept 5 classes over the tracked `.md` and `.js` set with its instrument controls speaking, and its verdict column proved too crude to be closure on its own: "duplicate" and "orphan" are ordinary English, so 20 and 26 carriers matched and most name unrelated subjects, which is the two-pass rule's own point. The enumeration is mechanical and the classification was done by reading; one genuine disagreement survives, `docs/plans/claude-kit_test-audit_spec_v1.md` restating all five classes in the pre-fix wording. The durable pass/fail version of that predicate is section 5's.

Assumptions: assumed 2026-09-04, section 1 (default): the fold of "What never earns one" into the retire list serves both the authoring moment and the retirement moment through an explicit sentence rather than by inference, since collapsing them silently would delete the authoring bar; reversal: split the list into an authoring half and a retirement half. assumed 2026-09-04, section 1 (the plan's own text): the 300-word ceiling is section 3's acceptance for section 3's new section and is not an acceptance clause on section 1, so this section is measured on sentence length, which its Goal names; reversal: state a word ceiling in section 1's acceptance and cut to it. assumed 2026-09-04, section 1 (executing-work, the inline-locus rule): the fix rounds ran in the main thread because they were design-entangled reconciliations; reversal: dispatch a fix round with the findings and the calls already made.

Approval drift, made deliberately and recorded here: a `## Standing Brief Amendments` block was added above `## Sections of Work`, carrying six entries each sourced from a named memory record; Decision 2, Decision 3 and Assumption 2 were amended as described above; section 1's own class enumeration, shape bar and section duty were brought into line with the shipped rule; acceptance clause 3 was scoped to what this section can satisfy, its charter half moving to section 2 because no state of section 1 can satisfy it; a stale line count for `test/doctrine-parity.test.js` was dropped rather than restated, per Decision 3's own remedy; and section 5 was appended. All of it sits above `## Chapters` and so inside the approval-scoped fingerprint the external engine reads.

Section 5 was appended because section 1's rounds surfaced six surfaces that describe or pin what the skill owns and are now stale, plus a missing far-end presence pin, none of which folds: they sit in `test/`, `docs/` and `README.md` rather than beside this section's files. Under this plan's Commit-and-Push model that scope change is named to the operator at the moment it is appended rather than only at the close.

Review Findings: 3 rounds at opus/max on both lenses, 82 findings, 7 Critical and 43 Major and 32 Minor. Every Critical is fixed. Round 1 found the count-pin ban retiring the cross-surface count assertion the same file prefers, and an unresolvable pinned-copy carve-out. Round 2 found that round 1's own fix had introduced a false claim about the tree, which is why round 3 ran. Round 3 confirmed the structural exception decidable against eight real pins and the duplicate direction correct, and found the plan's own text still carrying two retired classes. Majors fixed rather than justified, with these exceptions routed to section 5 as file-audit findings under Standing Amendment 3: the README payload map, two `docs/architecture.md` claims, a stale comment at `test/doctrine-parity.test.js:4789`, the missing far-end pin, and the consuming test-audit plan's own enumeration. One Major is accepted and sequenced rather than fixed: the Tests-floor clause at `executing-work/SKILL.md` is restated by section 2, so between this close and that one the tree carries both readings. Minors on prose (a garden-path clause, a double genitive, an unclosed carve-out list, a sentence failing the delete-litmus) were fixed; the row-40 third-column entry was reverted in round 1 and restored in round 3 on the map's own read contract, with the residual gap, that the column cannot distinguish a pointer from a co-owner or an enforcer, routed to the backlog.

Stamps: adjudicated 5, stamped 4. Applied: `a-retired-claim-is-swept-by-meaning-not-by-words`, `skill-amendments-collide-with-neighbours` and `an-equality-pin-propagates-the-gap-it-should-catch`, which are Standing Amendments 2, 1 and 5 and shaped the sweep, the reviewer briefs and the reading of the parity pin; and `claims-sections-need-more-review-rounds-than-code-sections`, which is Amendment 3's source and is what justified three rounds on a claims section rather than treating the count as misbehaviour. Skipped with reasons: `suite-baseline-is-not-zero-fail`, because this section ran no whole gate and its targeted lane was zero-fail, so the record steered nothing here; and `a-reap-is-a-resource-act-on-the-reaped-seat`, because this section reaped nothing.

Gate: two lanes. The targeted lane over this section's files, `node --test test/doctrine-parity.test.js test/output-style-parity.test.js`, read 77 tests, 77 passing, 0 failing and 0 skipped in 0.6 s at exit 0, read from the run's own marker rather than from a wrapper's notification. It ran at every fix round and at the section close, green each time; no baseline was recorded on this lane before the section, and none is needed for the delta claim, since a run with zero failures cannot be worse than any baseline. The whole gate ran because this section's push lands on `main`, which is this kit's install surface with no CI between a commit and a `claude plugin update`. It read 3039 tests, 3029 passing, 1 failing and 9 skipped over 52 test files in 327 s at exit 1, again from the run's own marker. The enumerated count sits far above the 52 test files the tree holds, which is the check that says the run is a reading at all. The one failure is this box's recorded standing red, `a pinned directory too long to name faithfully stands the session down`, and the run's own assertion output shows why it is a false red rather than a defect: the guard expects the fixture path to report that it cannot be named, and the path was nameable, so the length guard was never exercised. This machine's TEMP is too short to build a path that trips it. Those counts match the baseline recorded earlier today on this same lane, 3,039 tests over 52 files at 3,029 passing, 1 failing and 9 skipped, so the delta is zero and the failing test is the same one. Contention: the gate waited 1,802 s for the box, a foreign claim naming another session's PowerShell deploy lane holding the machine's one heavy-process slot. That claim aged past its own declared TTL of 1,800 s, so the run named the contention and proceeded without writing a claim of its own, and it left the foreign claim in place, a claim being deletable only by the session its Session line names. At the launch the box held 12 node and 8 PowerShell processes and no dotnet. The memory half of the contention lane is unmeasured: `wmic` does not exist on this machine, so the free-virtual reading failed and is reported missing rather than substituted from a neighbouring figure. The targeted lane shows the load in its own wall clock, 1.4 s under contention against 0.6 s once the box was quiet, on an unchanged two-file scope.

Next: sections 2 and 3 run in parallel, their file sets being disjoint, then section 4, then section 5. Section 4 stays last on its own ground rather than for file overlap: its budget file initializes at the sizes at its own commit, so running it earlier would freeze caps at pre-edit sizes and sections 1 through 3 would breach the ratchet they exist to establish.

Commit Model: Commit-and-Push

