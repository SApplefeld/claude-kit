# The kit's prose reads in one-idea sentences and one-point paragraphs, with restatements cut

Status: In Progress
Commit Model: Branch-and-PR, one PR per section, stacked, no auto-merge
Created: 2026-09-15

Session model: any executor session in the kit repo on the execution model (an Opus-led session, per the brainstorming skill's rule that execution belongs to the execution model). Seventeen sections run in order, section 0 dispatched to the Opus implementer and every rewrite section to the Fable implementer, each closing on its own stacked pull request. Authored by the KIT: Expert seat on the operator's word at the keyboard on 2026-09-15. This plan is step 3 of the post-rewrite program (`claude-kit_post-rewrite_program_v1.md`). It runs after step 2, the skill retirement, closed and merged on 2026-09-15, and before step 4, the read-and-intent review, whose plan is written against the prose this pass produces. Anchors below are authoring-time from the tree at `399dd4f`; re-locate every hit by content.

## Dispatch Authorization

Authorized 2026-09-15 by the operator at the keyboard of the KIT: Expert session, for any session holding this plan, covering the sentence-shape and paragraph-length pass over the documents batch 3 of the corpus rewrite's rulings names, widened the same day to cutting a sentence that restates another, and delivered as one stacked pull request per section. The rulings themselves are recorded on `docs/backlog.md` under the item opening "The corpus rewrite's four operator decision batches": batch 3 ordered the pass and its document order on 2026-09-13, ruling 20 flagged the kit-goal skill's four passages for it, and ruling 23 handed it the ai-tells respell. The widening to restatement cuts and the per-section stacked shape were the operator's word on 2026-09-15 in the authoring session, recorded rather than quoted. The arming is the operator's typed `/kit-goal` with this plan's path; `Status: Ready` is the kit's parked value and is not the arm. What that word covers: the shape of every sentence and paragraph in the documents named below, the cutting of restatements inside a document, the pointer form where another document owns a rule, the records each section owes, and the pull request shape, which is one pull request per section opened at that section's close, stacked on the section before, marked ready, with auto-merge left unarmed so that the operator's serial read decides each merge. That shape is the operator's word of 2026-09-15 and outranks what executing-work's step 7 and finishing-work's step 7 say a Branch-and-PR plan does with its pull request. It does not cover changing what any rule says, retiring any rule, or judging a parked plan; those are steps 4, 2 and 5 of the program.

## Goal

Every document this plan names reads in sentences of one idea and paragraphs of one point, with a sentence that restated another cut down to the one clean statement, and no claim lost. The operator can read each document by hand in one sitting and see its intent. The baseline says why the pass is wanted: in the coordinator skill seven sentences in ten run past thirty words, the doctrine holds sixteen paragraphs past two hundred words, and executing-work holds twenty-six. Behavior does not move: every ruled probe pair reads the same answer before and after, and every claim a rationale ledger records either survives in the rewritten text or is retired against the statement that carries it. Each section lands as its own pull request stacked on the one before, so the operator reads and merges them serially and can rewind to any one.

## Approach

**The edit unit is the paragraph, and the bars are the writing-skills skill's own.** Its "What a sentence has to earn" section states three bars: one idea per sentence, the literal phrase, and a pointer where another site owns the rule. This plan adds no bar. It applies those three to every paragraph of the documents named below, and it reads the twenty-word figure as that section reads it, a diagnostic that finds a second idea rather than a cap.

**A restatement is cut, and the cut is recorded.** A restatement is a sentence whose every claim another sentence of the same document already carries. It keeps out a sentence that adds a bound, an exception, an example that changes what a reader would do, or a claim stated nowhere else in the document; those are kept and reshaped. It keeps out the doctrine's own deliberate copies, the output style's register core and the `home/` mirror, which a parity pin holds byte-identical to the source. Where a document restates a rule another document owns, the ownership map (`plugins/claude-kit/skills/operating-instructions/references/ownership-map.md`) naming that owner, the restatement becomes a pointer at the owner, which is the third bar. A cut sentence's claim is found in its document's rationale ledger, and that entry's verdict becomes `retire` with a reason naming the entry whose passage now carries the claim and a `landed:` line, in the ledger's own format. The verdict is written at first green without its `landed:` line, since the line names a commit hash, and the section's close commit adds the line naming the first-green commit, which exists by then. Where no entry exists for the cut sentence, the Chapter names the sentence and the survivor, and no entry is written. A rewrite that changes a sentence's shape and not its claim touches no verdict.

**No claim is lost, and that is the reviewers' test.** The pre-rewrite document at the section's base ref is the fact base. A claim is lost when a reader of the new text would do something the old text forbade, would skip something the old text required, or could no longer find a bound the old text set. It keeps out a reword that moves emphasis, a restatement cut with its survivor named, and a restatement turned into a pointer at the owner the ownership map names. Every sentence of the old text either survives reshaped, or is a restatement whose survivor the Chapter or the ledger names. The review round is executing-work's step 3 roster as the section's `Audience:` line summons it: the code pair over the ledger and test edits, and the document pair over the rewritten document, one blind reader per persona and the prose reviewer with the old text as its fact base. The adversarial reviewer traces the cut list against the new text. Every lens runs at Fable, which is the writer's tier and the ceiling.

**Anchors stay byte-identical.** An anchor is a bold bullet lead, a heading, a numbered step's number and bold lead, a code literal in backticks, a quoted string, a frontmatter line, a marked parity region, a phrase a test pins, or a table's columns and rows with every figure and name in its cells. It keeps out the sentence that follows a lead, the body of a step, a parenthetical, and the prose inside a table cell, which the pass may reshape freely. The output-style parity pin locates doctrine elements by bullet lead, the ownership map points at bullets by lead, the probe shapes name files by path, and the ledgers key claims by imperative sentence and cite targets by their own text, so a renamed anchor breaks a pointer this pass is not here to fix. A long bullet may gain sub-bullets under its unchanged lead, except the eight register-core bullets the output style copies, which stay single lines because the style's parity pin compares only the line each lead opens: a split there is a meaning question, never a sub-bullet. A paragraph may split into two under the same heading. A step may not renumber, and a bullet list keeps its item count, since one test counts the commit-model bullets.

**A pinned phrase is an anchor first and a re-aim second.** `test/doctrine-parity.test.js` holds about three hundred assertions, and many of them locate a bullet by its lead and then require a plain-prose phrase inside it, such as "the exit code read from the run itself" in executing-work's Chapter template or "least likely to have seen the friction" in role and peer-sessions. Others require two facts inside one sentence, such as a lane name and the word push in each commit-model bullet, or forbid two words inside one clause, such as board beside a container noun in the coordinator. `test/review-loop-provenance.test.js` pins "five review rounds" exactly once tree-wide and a backticked count before "further rounds". Before a section rewrites a document, the executor extracts every assertion in those two tests and in `test/output-style-parity.test.js` and `test/claim-class-parity.test.js` that reads that document, and hands the implementer the pinned phrases and sentence-boundary rules as anchors in the brief. A pinned phrase survives verbatim where the three bars allow it. Where it cannot, the assertion is re-aimed in the same commit to the new wording, the claim behind it unchanged, and the Chapter lists every re-aimed assertion by test name so the reviewers can read the claim across the old pin and the new. A negative check that reds because a reword put two unrelated words in one clause is a reshape of the sentence, never a loosening of the test. No assertion is deleted.

**The claim-class region is one text in three files.** `test/claim-class-parity.test.js` holds the `KIT-CLAIM-CLASS` region byte-identical across executing-work's step 4, the adversarial reviewer's charter and the blind reviewer's charter. Section 3 rewrites it once and lands the same text in all three files in one commit, and section 12 leaves the region untouched. The `## Before you send` section is the same shape across the doctrine's three copies, and section 1 owns it.

**Line-number citations into the in-scope documents are re-aimed by the section that moves them.** `docs/harness-assumptions.md` carries eighty-five `Source:` lines citing in-scope documents by file and line, counted on 2026-09-15: executing-work 25, peer-sessions 17, finishing-work 15, the doctrine 11, memory-system 9, kit-goal 3, brainstorming 2, and coordinator, role and the qa-verifier charter 1 each. No test reads them. A paragraph split above a cited line makes every citation below it wrong without a sound. Every rewrite section ends by re-aiming the `Source:` lines into its document, located by the content each cites, and its Files in scope names that file; a section whose document has no citation records that in its Chapter. The rationale ledgers' own `source:` lines are commit-pinned by their preamble and stay as they are.

**Behavior is proven unmoved by the probe pairs the corpus already carries.** Fifteen probes sit under `test/probes/`, every one ruled, each a scenario a cold reader answers from a set of files. A shape is one such file set, and a probe carries several. The in-scope files appear in those shapes as follows: the doctrine in thirty, executing-work in nineteen, the output style in seventeen, curating-docs in six, role and finishing-work in five each, peer-sessions in three, memory-system, kit-goal, brainstorming and the scope adjudicator in two each, and responding-to-review, the coordinator, the plan reviewer and the adversarial reviewer in one each. Each section runs the before-and-after pair over the moments whose shapes name its files, as the writing-skills skill's probe rule states. The before leg is `node tools/probe-corpus/run.mjs --only <moments> --before <base sha>`, which reads the files at that ref itself, and the after leg is the same command without `--before`. A matching pair is the reading that shape moved and behavior did not. A mismatch the after leg carries and the before leg lacks is a finding: the sentence that moved the reading is found and re-shaped, and where it cannot be, the section stops on it as a meaning question. Each run sends every scenario to a paid model endpoint and holds the machine's heavy-process slot for its duration, so the executor session claims the slot, runs it itself, one run at a time, and never hands it to a dispatched agent.

**Meaning questions go to step 4, never into this pass.** A meaning question is a place where the rewriter, or a reviewer in the section's round, believes the old text says the wrong thing, says two things at once that disagree, or leaves a case it should decide. It keeps out a restatement, a long sentence, and a mannered phrase, which this pass fixes. Each section's Chapter carries a `Meaning questions:` line listing them by document, heading and the sentence in question. Finishing gathers every line into one `docs/backlog.md` item opening "Meaning questions the prose pass raised for step 4", which is the input step 4's plan is written from.

**Each section is one pull request, stacked on the section before.** The repository merges by merge commit only and deletes a branch on merge, read from its settings on 2026-09-15, which is what makes a stack hold without rebasing: when the operator merges the bottom pull request, GitHub retargets the next one onto `main`, and its merge commit carries the fix along. At each section's step 7 the executor commits to a branch `prose/<NN>-<slug>`, the slug being the section heading in lowercase with hyphens (`prose/02-executing-work-first-half`), cut from the previous section's branch, pushes it, opens the pull request with `gh pr create --base <previous branch>` and marks it ready, and never arms auto-merge, since a stacked pull request's base is a branch and arming would merge into it. The repository's two pull request guards read other things: the docs guard reads uncommitted `docs/` changes at create time, and the merged-branch guard reads whether the target branch's pull request has merged. Neither reads the base. The pull request body carries the section's diagnostics table, its cut list with each survivor, and its meaning questions. This spec lands on `main` by its own pull request before the arm, and section 0 cuts from `main` after that merge, so every branch in the stack carries the plan doc. The operator merges serially. A rewind is a fix the operator asks for on a section whose pull request is still open below others in the stack: it lands as a new commit on that section's branch, under a rewind round recorded as a `#### Rewind round <n> - YYYY-MM-DD` sub-heading directly beneath that section's Chapter, so the Chapter numbering the status line and the boundary nudge read by heading stays in file order, and the trunk rule dismisses stale approvals on push, so the operator approves again. A fix asked for on a section whose pull request has already merged takes finishing-work's merged-branch rule instead: a new branch off `main`, its own pull request, and its rewind sub-heading beneath the section's Chapter on that branch. The pull request finishing-work opens is the top of the stack, with base the last section's branch, carrying the archive, the program's Log line and the backlog item above. The reap of every branch is owed after the last merge and is named in the close-out.

**The plan doc is pre-slotted so stacked branches never conflict in it.** Section 0 writes one HTML comment marker per section under `## Chapters`, `<!-- chapter-slot N -->`, and each section's Chapter replaces its own marker in place rather than appending at the end, which keeps the Chapters in section order and numbered in file order. A rewind round's record is the sub-heading beneath its section's Chapter named above, never a new Chapter number. `test/size-budget.json` is the other file every section touches; its entries are alphabetical, so two sections' cap lines can sit adjacent, and a conflict there on a rewind is resolved by taking both lines.

**Every section takes the size shrink.** The ratchet is synced per file the section touched, `node plugins/claude-kit/scripts/kit-size.js sync --repo <root> <paths>`, and the Chapter's Delta line reports the net. A raise is a finding on a section whose job is to cut.

**The diagnostic is one committed script.** Section 0 lands `tools/prose-shape.mjs`, which takes file paths on its command line and prints one row per file: words, paragraphs, paragraphs past 120 and 200 words, the longest paragraph, sentences, sentences past 30 and 45 words, and the longest sentence, as an aligned table on standard output, or as one JSON object per row under `--json`. Its units are fixed here so every Chapter counts the same way. A paragraph is a run of non-blank lines between blank lines, except that each list item, a line opening with `- ` or a number and a period, is its own paragraph. A fenced code block, a table row, a frontmatter block and an HTML comment are skipped. A sentence ends at a period, question mark or exclamation mark, with any closing quote, parenthesis or bracket directly after it kept in the sentence, followed by whitespace and then an uppercase letter, a digit, an asterisk, an underscore, a backtick, an opening parenthesis or bracket, or an opening quote. A semicolon or colon never ends one. A backtick span is masked before splitting, so a period inside it never ends one. A bold lead ending in a period is its own sentence. Every later section runs it at its base ref and at its head and puts both rows in the Chapter and the pull request body. No threshold is a gate: the count of sentences past 30 words and paragraphs past 200 words falls, and any sentence past 45 words that stays is listed in the Chapter with the reason it stays. The gate is the operator's hand read at the pull request.

**Baseline, measured on the trunk at `399dd4f` on 2026-09-15 with a scratch form of that script.** The scratch form counted a list block as one paragraph where the committed rule counts each item, so the paragraph columns will move; section 0 re-derives the table with the committed tool, one row per file with the ten charters as ten rows, and records the differences.

| Document | Words | Paragraphs | Paragraphs past 200 words | Sentences | Sentences past 30 words |
| --- | --- | --- | --- | --- | --- |
| operating-instructions (the doctrine) | 10,672 | 95 | 16 | 264 | 136 |
| output-styles/kit.md | 1,503 | 28 | 2 | 41 | 16 |
| executing-work | 25,512 | 94 | 26 | 547 | 327 |
| finishing-work | 16,532 | 49 | 28 | 439 | 228 |
| coordinator | 19,927 | 43 | 27 | 387 | 271 |
| role | 7,364 | 38 | 13 | 203 | 88 |
| standing-watch | 3,877 | 35 | 4 | 110 | 48 |
| peer-sessions | 10,384 | 61 | 14 | 266 | 152 |
| memory-system | 14,821 | 126 | 18 | 435 | 203 |
| ten reviewer charters together | 18,722 | 197 | 16 | 566 | 229 |
| responding-to-review | 1,923 | 19 | 5 | 60 | 23 |
| curating-docs | 2,496 | 32 | 2 | 72 | 27 |
| brainstorming | 3,592 | 37 | 4 | 107 | 43 |
| kit-goal | 2,837 | 40 | 2 | 81 | 42 |

**The three largest documents split in two.** A pull request rewriting twenty-five thousand words is not readable by hand, which is the pass's own reason. Executing-work splits at its section loop's step 4: the first half is the preamble, the completion contract, the before-starting section and steps 0 to 3, near ten thousand words; the second is steps 4 to 8 and everything after the loop. Finishing-work splits at its `## Steps` heading, six thousand six hundred words before and nine thousand nine hundred after. The coordinator splits at its `## The never-tasks-directly rule` heading, nine thousand three hundred before and ten thousand five hundred after. The two halves of one document are two sections and two pull requests, and the second half's cut list may name a survivor in the first half.

**The section recipe.** Every rewrite section below runs this and states only what differs. Read the document's rationale ledger entries for the passages in scope before writing (`docs/backlog.md`'s item of 2026-09-10 on ledgers records that no rule yet sends a writer there; this plan does). Extract the pinned phrases and sentence-boundary rules for the document from the four tests named above and put them in the brief as anchors. Rewrite paragraph by paragraph under the three bars, cutting restatements and keeping anchors. Update every `passage:` line in a ledger whose text the rewrite changed. Write the `retire` verdicts for cut sentences. Re-aim any assertion a surviving bar forced off its phrase, and any `Source:` line in `docs/harness-assumptions.md` the section moved. Run the diagnostic at base and head. Sync the size cap. Run the targeted lane: `test/doctrine-parity.test.js`, `test/output-style-parity.test.js`, `test/claim-class-parity.test.js`, `test/review-loop-provenance.test.js`, `test/kit-goal-stop.test.js`, which reads executing-work's blocker set, `test/ledger-preamble-parity.test.js`, `test/size-ratchet.test.js`, `test/probe-set.test.js` and `test/readonly-agent-guard.test.js`, read from the run's exit code. The base row of the diagnostic is read over copies taken with `git show <base sha>:<path>` into `.kit/scratch/`, never over a prior section's head row. Run the probe pair over the moments the section's files touch. Dispatch the reviewers. Write the Chapter into its slot with the diagnostics, the cut list, the sentences past 45 words that stay, the re-aimed assertions, the probe readings and the meaning questions. Open the stacked pull request.

**Sweep.** A pointer sweep over the tree ran on 2026-09-15 for every surface that anchors on the text of an in-scope document: parity pins, quoted phrases in tests, bold-lead pointers, ledger `passage:` lines, line-number citations and word-count caps. Its result is recorded under `## Sweep result` below and the Files in scope lists are written from it.

## Standing Brief Amendments

- The diagnostic's sentence unit is the one the Approach states: a sentence also ends where its closing punctuation sits inside a closing quote, parenthesis or bracket, and where the next sentence opens with a digit, an underscore, an opening bracket or an opening quote.

## Sections of Work

### 0. The instrument, the baseline and the slots
Model: opus
Lands `tools/prose-shape.mjs` as described in the Approach, with its usage in a header comment, since `tools/` carries no README. Re-derives the baseline table over every in-scope document and records any difference from the table above in its Chapter. Writes the seventeen chapter-slot markers under `## Chapters`. Backfills the post-rewrite program's Log with the two lines the program's own rule owes and no session wrote: step 1 closed and merged 2026-09-14 in pull request 22, and step 2 closed and merged 2026-09-15 in pull request 26. Adds a line to the program's step 3 entry naming this plan as written.
Acceptance: the script runs from a clean checkout over the in-scope paths given on its command line and prints one row per file under the units the Approach fixes; the Chapter carries the re-derived table; seventeen markers sit under `## Chapters`; the program's Log carries the two lines and the step 3 entry names this file.
Files in scope: `tools/prose-shape.mjs`, `test/prose-shape.test.js`, `test/size-budget.json`, `docs/plans/claude-kit_prose-pass_spec_v1.md`, `docs/plans/claude-kit_post-rewrite_program_v1.md`.
Tests: lock that the sentence splitter does not split inside backticks and that a fixture with a known sentence count reads that count; a miscount is silent and every later Chapter would carry it.

### 1. The doctrine and the output style
Model: fable
The section recipe over the doctrine's three copies together: `plugins/claude-kit/skills/operating-instructions/SKILL.md` (the source), `home/claude-kit-doctrine.md` (the mirror) and the register core inside `plugins/claude-kit/output-styles/kit.md`, which `test/doctrine-parity.test.js` and `test/output-style-parity.test.js` hold byte-identical. The output style's own text outside the core is in scope too. Every bold bullet lead in the doctrine is an anchor. This section's probe pair runs every ruled moment, since the doctrine sits in thirty shapes.
Acceptance: both parity pins green; the diagnostic rows fall as the Approach states; every ruled probe pair matches or is recorded as a finding whose disposition is the reshaped sentence or the meaning question the section stopped on; the cut list names a survivor for every cut; `plugins/claude-kit/skills/operating-instructions/references/rationale-ledger.md` carries a `retire` verdict for every cut sentence it has an entry for.
Files in scope: the three copies, the operating-instructions rationale ledger, `test/doctrine-parity.test.js` and `test/output-style-parity.test.js` for re-aims only, `docs/harness-assumptions.md` for its `Source:` lines into the doctrine, `test/size-budget.json`, the plan doc.
Audience: a Claude session loading the doctrine at session start, expert in the kit's vocabulary and holding no session context, which must be able to read each bullet and know what it may and may not do; the operator reading by hand on a phone, expert in the intent, who must be able to see what each bullet decides. Voice: the kit's own, direct and plain. Fact base: the three copies at the section's base ref and the operating-instructions rationale ledger.

### 2. Executing-work, first half
Model: fable
The section recipe over `plugins/claude-kit/skills/executing-work/SKILL.md` from its start through the section loop's step 3, "Review". Step numbers and bold step leads are anchors. The two `passage:` lines in its ledger are checked and updated where they sit in this half.
Acceptance: as the recipe states; the ledger `plugins/claude-kit/skills/executing-work/references/rationale-ledger.md` carries the verdicts and passage updates; `test/ledger-preamble-parity.test.js` green, since the preamble is not touched.
Files in scope: the skill, its ledger, `test/doctrine-parity.test.js` and `test/review-loop-provenance.test.js` for re-aims only, `docs/harness-assumptions.md` for its `Source:` lines into the skill, `test/size-budget.json`, the plan doc.
Audience: a Claude session executing a plan mid-run, expert in the kit's vocabulary, which must be able to find the step it is on and read what that step requires; the operator reading by hand. Voice: the kit's own. Fact base: the skill at the section's base ref and its ledger.

### 3. Executing-work, second half
Model: fable
The section recipe over the same file from step 4, "Address findings", to its end: the consult, delegating, the Chapter format and the close. The Chapter template is a machine-read shape and its field names are anchors. A cut in this half may name a survivor in the first half. This half holds the `KIT-CLAIM-CLASS` region, which it rewrites once and lands byte-identical in `plugins/claude-kit/agents/adversarial-reviewer.md` and `plugins/claude-kit/agents/blind-reviewer.md` in the same commit, with `test/claim-class-parity.test.js` green.
Acceptance as section 2, plus the claim-class pin green. Files in scope as section 2, plus the two charters for the region only and `test/claim-class-parity.test.js` for re-aims only. Audience, Voice and Fact base as section 2.

### 4. Finishing-work, first half
Model: fable
The section recipe over `plugins/claude-kit/skills/finishing-work/SKILL.md` from its start to its `## Steps` heading. The one `passage:` line in its ledger is checked.
Acceptance: as the recipe states, with `plugins/claude-kit/skills/finishing-work/references/rationale-ledger.md` carrying the verdicts.
Files in scope: the skill, its ledger, `test/doctrine-parity.test.js` for re-aims only, `docs/harness-assumptions.md` for its `Source:` lines into the skill, `test/size-budget.json`, the plan doc.
Audience: a Claude session closing an effort, expert in the kit's vocabulary, which must be able to read each step and know what it runs and what it records; the operator reading by hand. Voice: the kit's own. Fact base: the skill at the section's base ref and its ledger.

### 5. Finishing-work, second half
Model: fable
The section recipe over the same file from `## Steps` to its end. Step numbers and command literals are anchors.
Acceptance, Files in scope, Audience, Voice and Fact base as section 4.

### 6. Coordinator, first half
Model: fable
The section recipe over `plugins/claude-kit/skills/coordinator/SKILL.md` from its start to its `## The never-tasks-directly rule` heading.
Acceptance: as the recipe states, with `plugins/claude-kit/skills/coordinator/references/rationale-ledger.md` carrying the verdicts. The negative checks that forbid board beside a container noun are read before writing.
Files in scope: the skill, its ledger, `test/doctrine-parity.test.js` for re-aims only, `docs/harness-assumptions.md` for its `Source:` lines into the skill, `test/size-budget.json`, the plan doc.
Audience: a Claude session holding the coordinator seat on a reconciliation pass, expert in the kit's vocabulary, which must be able to read what a pass does and what a board line may carry; the operator reading by hand. Voice: the kit's own. Fact base: the skill at the section's base ref and its ledger.

### 7. Coordinator, second half
Model: fable
The section recipe over the same file from `## The never-tasks-directly rule` to its end, the ledger section included.
Acceptance, Files in scope, Audience, Voice and Fact base as section 6.

### 8. Role
Model: fable
The section recipe over `plugins/claude-kit/skills/role/SKILL.md`. The registry entry and claim file templates in code fences are anchors, and so is the kaizen capture duty's pinned prose.
Acceptance: as the recipe states, with `plugins/claude-kit/skills/role/references/rationale-ledger.md` carrying the verdicts.
Files in scope: the skill, its ledger, `test/doctrine-parity.test.js` for re-aims only, `docs/harness-assumptions.md` for its `Source:` lines into the skill, `test/size-budget.json`, the plan doc.
Audience: a Claude session taking a seat or claiming the heavy-process slot, expert in the kit's vocabulary, which must be able to run the ritual and read the claim protocol; the operator reading by hand. Voice: the kit's own. Fact base: the skill at the section's base ref and its ledger.

### 9. Standing-watch
Model: fable
The section recipe over `plugins/claude-kit/skills/standing-watch/SKILL.md`.
Acceptance: as the recipe states, with `plugins/claude-kit/skills/standing-watch/references/rationale-ledger.md` carrying the verdicts.
Files in scope: the skill, its ledger, `test/doctrine-parity.test.js` for re-aims only, `test/size-budget.json`, the plan doc.
Audience: a Claude session on a watch loop, expert in the kit's vocabulary, which must be able to read what a pass does and what the ledger carries; the operator reading by hand. Voice: the kit's own. Fact base: the skill at the section's base ref and its ledger.

### 10. Peer-sessions
Model: fable
The section recipe over `plugins/claude-kit/skills/peer-sessions/SKILL.md`. The message template in its code fence and the Roles table are anchors.
Acceptance: as the recipe states, with `plugins/claude-kit/skills/peer-sessions/references/rationale-ledger.md` carrying the verdicts.
Files in scope: the skill, its ledger, `test/doctrine-parity.test.js` for re-aims only, `docs/harness-assumptions.md` for its `Source:` lines into the skill, `test/size-budget.json`, the plan doc.
Audience: a Claude session about to message or act on a message from another session, expert in the kit's vocabulary, which must be able to read what standing a message has and what its seat owes; the operator reading by hand. Voice: the kit's own. Fact base: the skill at the section's base ref and its ledger.

### 11. Memory-system
Model: fable
The section recipe over `plugins/claude-kit/skills/memory-system/SKILL.md`. Command literals and the one `passage:` line in its ledger are checked.
Acceptance: as the recipe states, with `plugins/claude-kit/skills/memory-system/references/rationale-ledger.md` carrying the verdicts.
Files in scope: the skill, its ledger, `test/doctrine-parity.test.js` for re-aims only, `docs/harness-assumptions.md` for its `Source:` lines into the skill, `test/size-budget.json`, the plan doc.
Audience: a Claude session about to read or write the memory store, expert in the kit's vocabulary, which must be able to find the verb and read what it owes; the operator reading by hand. Voice: the kit's own. Fact base: the skill at the section's base ref and its ledger.

### 12. The reviewer charters
Model: fable
The section recipe over the ten agent charters batch 3 means by "the reviewer charters": `adversarial-reviewer`, `blind-reviewer`, `prose-reviewer`, `plan-reviewer`, `security-reviewer`, `qa-verifier`, `blind-reader`, `scope-adjudicator`, `consultant` and `docs-curator`, all under `plugins/claude-kit/agents/`. The set is closed at those ten; the directory's other six, the four implementers and the two council seats, are under Out of Scope. Frontmatter lines, the report formats the charters specify, every field name a dispatch template fills, the `[CRITICAL|MAJOR|MINOR]` and `trace:` tokens `test/review-loop-provenance.test.js` pins, and the `KIT-CLAIM-CLASS` region section 3 owns are anchors. The executing-work ledger carries the charter entries, sixteen charter headings under `plugins/claude-kit/skills/executing-work/references/rationale-ledger.md`, and the recipe's ledger steps run there. `test/readonly-agent-guard.test.js` reads each charter's frontmatter `tools:` line and is part of the targeted lane.
Acceptance: as the recipe states over ten files; the readonly guard test green; the cut list names a survivor for every cut.
Files in scope: the ten charters, the executing-work ledger, `test/review-loop-provenance.test.js` and `test/doctrine-parity.test.js` for re-aims only, since the latter pins phrases in the adversarial, prose and qa-verifier charters, `docs/harness-assumptions.md` for its one `Source:` line into the qa-verifier charter, `test/size-budget.json`, the plan doc.
Audience: a dispatched reviewer agent holding only its charter and its brief, which must be able to read what it reviews for, what it returns and in what shape; the operator reading by hand. Voice: the kit's own. Fact base: the ten charters at the section's base ref and the executing-work ledger.

### 13. Responding-to-review
Model: fable
The section recipe over `plugins/claude-kit/skills/responding-to-review/SKILL.md`.
Acceptance: as the recipe states, with `plugins/claude-kit/skills/responding-to-review/references/rationale-ledger.md` carrying the verdicts.
Files in scope: the skill, its ledger, `test/size-budget.json`, the plan doc.
Audience: a Claude session adjudicating review findings, expert in the kit's vocabulary, which must be able to read how a finding is weighed; the operator reading by hand. Voice: the kit's own. Fact base: the skill at the section's base ref and its ledger.

### 14. Curating-docs
Model: fable
The section recipe over `plugins/claude-kit/skills/curating-docs/SKILL.md`. The machine contract section's frozen shape and every header value it names are anchors.
Acceptance: as the recipe states, with `plugins/claude-kit/skills/curating-docs/references/rationale-ledger.md` carrying the verdicts.
Files in scope: the skill, its ledger, `test/size-budget.json`, the plan doc.
Audience: a Claude session archiving a plan or registering a new one, expert in the kit's vocabulary, which must be able to run the close path and the create path; the operator reading by hand. Voice: the kit's own. Fact base: the skill at the section's base ref and its ledger.

### 15. Brainstorming
Model: fable
The section recipe over `plugins/claude-kit/skills/brainstorming/SKILL.md`. The spec format block in its code fence is an anchor.
Acceptance: as the recipe states, with `plugins/claude-kit/skills/brainstorming/references/rationale-ledger.md` carrying the verdicts.
Files in scope: the skill, its ledger, `test/doctrine-parity.test.js` for re-aims only, `docs/harness-assumptions.md` for its `Source:` lines into the skill, `test/size-budget.json`, the plan doc.
Audience: a Claude session designing with the operator, expert in the kit's vocabulary, which must be able to run the process and write the spec; the operator reading by hand. Voice: the kit's own. Fact base: the skill at the section's base ref and its ledger.

### 16. The ruled passages in kit-goal and ai-tells
Model: fable
Ruling 20's four kit-goal passages, re-located by content in `plugins/claude-kit/skills/kit-goal/SKILL.md`: the refusal list (the paragraph opening "The CLI lives at"), which becomes a pointer at the command's own printed reason, per the ledger entries the ruling cites; the plan handoff paragraph (opening "Two things make that wait workable"); leash condition (c) (the list item opening "(c) the last assistant message opens with"); and the blocked-plan count paragraph (opening "Read `goal-blocked`'s count"). The section recipe runs over those four passages and no other part of the file. Ruling 23's ai-tells respell in `plugins/claude-kit/skills/scott-writing-style/references/ai-tells.md`: the sentence opening "Section 2 licenses one narrow version" splits at its relative clause, with the ruling's spelling as starting text. The two cold respells the ruling names are moot, cold having retired in step 2.
Acceptance: the four passages and the one sentence read as the recipe requires; `plugins/claude-kit/skills/kit-goal/references/rationale-ledger.md` carries the verdicts; the kit-goal probe pair matches; the rest of both files is byte-identical to the base ref.
Files in scope: the two files, the kit-goal ledger, `docs/harness-assumptions.md` for its `Source:` lines into kit-goal, `test/size-budget.json`, the plan doc.
Audience: a Claude session arming or reading a leash, expert in the kit's vocabulary, which must be able to read why an arm refused and what a blocked count means; the operator reading by hand. Voice: the kit's own. Fact base: the two files at the section's base ref and the kit-goal ledger.

## Out of Scope

- Changing what any rule says, deciding a case a rule leaves open, or retiring a rule. Those are steps 4, 4 and 2 of the program, and this pass lists the first two as meaning questions.
- Every skill batch 3 does not name: kaizen, testing-discipline, writing-skills, systematic-debugging, consult, design-council, branch-hygiene, kit-doctor, csharp-style, sql-style, and scott-writing-style outside the one ai-tells sentence. Kit-goal outside its four passages.
- The four implementer charters, aligned to one text by ruling 1, and the two council seats, `council-member` and `design-facilitator`.
- The rationale ledgers' own prose, including the 114 reason lines carrying dates that `docs/backlog.md`'s item of 2026-09-14 records; only verdicts and `passage:` lines for cut or reshaped passages change.
- The ownership map, the READMEs, `docs/*.md` other than the `Source:` lines of `docs/harness-assumptions.md`, and hook and script comments. Anchors do not move, so no pointer in them goes stale.
- Any test edit beyond re-aiming an assertion to the new wording of the claim it already pins. No assertion is added, deleted or loosened.
- Cutting for size alone. Every cut is a restatement or a pointer under the third bar, and the shrink is a consequence.
- Arming auto-merge on any pull request of this plan.

## Assumptions

- assumed 2026-09-15 (the operator's word in the authoring session): a sentence restating another in the same document is cut, and a cross-document restatement whose owner the ownership map names becomes a pointer; reversal: the reviewers' test narrows to shape only and the cut lists empty.
- assumed 2026-09-15 (the rulings item on `docs/backlog.md`): "the reviewer charters" means the ten agents named in section 12; reversal: one row added or removed in section 12.
- assumed 2026-09-15 (readability, the pass's own reason): executing-work, finishing-work and the coordinator each split into two sections at the points the Approach names; reversal: merge the pairs, three fewer pull requests.
- assumed 2026-09-15 (the writing-skills probe rule as it stands): every section whose files a probe shape names runs the before-and-after pair at its close, the executor running it itself; reversal: run the set once at finishing, which loses per-section evidence.
- assumed 2026-09-15 (finishing-work step 7 read against a stacked base): auto-merge is armed on no pull request of this plan; reversal: none, a stacked base makes arming wrong.
- assumed 2026-09-15 (the program's Log rule): section 0 backfills the step 1 and step 2 close lines; reversal: drop that item from section 0.
- assumed 2026-09-15 (default): chapter slots are HTML comment markers replaced in place, and a rewind round's Chapter sits directly beneath its section's Chapter; reversal: append Chapters as executing-work does elsewhere and resolve the plan-doc conflict by hand at each rewind.
- assumed 2026-09-15 (default): meaning questions are gathered into one `docs/backlog.md` item at finishing rather than written per section; reversal: each section writes its own item.
- assumed 2026-09-15 (the brainstorming skill's session rule): the executor is an Opus-led Worker session the operator arms with `/kit-goal`, dispatching every rewrite section to the Fable implementer and running the probe pairs itself; reversal: a header line.
- assumed 2026-09-15 (`hooks/pr-docs-guard.js` header and `hooks/merged-pr-push-guard.js` header, read 2026-09-15): neither pull request guard reads the base branch, so a stacked create and push pass them; reversal: the guard that turns out to read the base is amended out of band and the plan pauses at that section.
- assumed 2026-09-15 (default): no numeric floor is set on how far a document's long-sentence and long-paragraph counts must fall, the operator's hand read being the gate; reversal: a floor per document in each section's acceptance.
- assumed 2026-09-15 (the ledger's own format): a ledger entry's key is not rewritten when its sentence is reshaped, since the key names the claim; only `passage:` lines and cut verdicts change; reversal: rekey entries, at a cost the ledger format does not price.

## Operator Verification

- For each pull request, read the rewritten document whole. A cut you judge critical, or a sentence whose meaning moved, reopens that section as a rewind round on its branch.
- At the first merge, observe whether the trunk ruleset's setting that requires an additional approval for commits not attributed to the pull request's author asks for anything beyond your one approval. The bot commits under one identity and opens the pull request under another account's token, so whether the setting fires is unknown until then. If it does, name it and the executor records the merge path in the section's Chapter.

## Open Questions

- Whether the plugin update and restart the step 2 gate names landed on every other machine. The operator's to confirm; this plan edits the tree and does not depend on it.

## Related

- `claude-kit_post-rewrite_program_v1.md`: the program this plan is step 3 of.
- `docs/archive/claude-kit_corpus-rewrite-follow-up_spec_v1.md`: step 1, which landed the rulings this pass inherits.
- `docs/archive/claude-kit_skill-retirement_spec_v1.md`: step 2, which retired cold, recap and park, removing recap from this pass's list and the two cold respells from ruling 23.
- `docs/archive/claude-kit_corpus-rewrite_spec_v1.md`: the rewrite whose rulings batch ordered this pass.
- `docs/backlog.md`, the item of 2026-09-05 opening "Two corpus-wide prose classes the subtraction-bars plan measured and deliberately did not cut": this plan covers both classes for the documents in scope, and the close-out prune narrows that item to the documents it does not.

## Sweep result

A read-only scout swept the tree on 2026-09-15 at `399dd4f`, excluding `.git` and `.kit`, for every surface anchoring on the text of an in-scope document. Searches: each document's name against `test/*.test.js`, `plugins/claude-kit/`, `docs/`, `README.md` and `tools/`; `passage:` across every rationale ledger; `ownership-map` tree-wide; the `Source:` line pattern in `docs/harness-assumptions.md`; length and count patterns across `test/`; the `KIT-CLAIM-CLASS` and `KIT-REGISTER-CORE` markers; and a full read of `test/doctrine-parity.test.js` by test name with a line-cited sample of each assertion pattern. Surfaces found, by anchor kind:

- **Byte-identical regions.** The doctrine body across source and mirror (`test/doctrine-parity.test.js`); the `## Before you send` section across all three copies (`test/output-style-parity.test.js`); the `KIT-CLAIM-CLASS` region across executing-work step 4 and the adversarial and blind reviewer charters (`test/claim-class-parity.test.js`).
- **Pinned plain-prose phrases.** `test/doctrine-parity.test.js` across executing-work, finishing-work, coordinator, role, peer-sessions, standing-watch, memory-system and brainstorming, and in the adversarial, prose and qa-verifier charters, including affirmative substrings, same-sentence requirements, negative clause checks and a commit-model bullet count; `test/review-loop-provenance.test.js` across executing-work step 4 and the adversarial, blind and security reviewer charters; `test/kit-goal-stop.test.js`, which requires executing-work's blocker set to name the stop-for-a-yes rule on exactly one list line. The plan review found the charter and kit-goal-stop pins after the sweep missed them.
- **Bold leads and headings.** The output style's eight core leads; about forty ownership-map rows pointing at doctrine bullets by lead; `## Which text governs` and `## Before you send`; the ai-tells pattern headings the prose reviewer hunts by name. All safe under the anchor rule.
- **Line numbers.** Eighty-five `Source:` lines in `docs/harness-assumptions.md` into ten in-scope documents, counted per document in the Approach, checked by nothing. Ledger `source:` lines, commit-pinned by design.
- **Ledger passage pins.** Four in scope: executing-work V001 and V002, finishing-work V001, memory-system T001. Two out of scope in the kaizen and writing-skills ledgers.
- **Word-count caps.** One entry per in-scope document in `test/size-budget.json`, live-checked by `test/size-ratchet.test.js`; growth reds, shrink passes.
- **Path only.** The probe shapes, the readonly guard, the docs-write guard and the recognition nudge tests name files or agent identifiers and read no prose.

No test measures sentence or paragraph length. The Files in scope lists above are written from this result.

## Chapters

### Chapter 1 - 2026-09-15
Completed: 0. The instrument, the baseline and the slots
Implemented By: implementer-opus for the script and its test; main session for the sentence-unit widening, the close pass and the plan-doc edits
Metrics: review rounds 1, closed major-closed; provenance 1 spec-traceable, 0 fix-introduced, 2 new-requirement, rulings (0 refused, 0 declared, 2 asked); NEEDS_CONTEXT 0; escalations 0; consults 1
Decisions / Surprises: The plan's Status header read Ready and now reads In Progress. Decided 2026-09-15 by the operator on the relay thread: the diagnostic's sentence unit widens before any Chapter measures under it, so a sentence also ends inside a closing quote, parenthesis or bracket and before an opening quote, bracket, underscore or digit. The operator's reason: each paragraph is still read by hand, and the closer count helps this first diagnosis and remediation. The Approach's sentence unit is restated to match and the new Standing Brief Amendments block records it, which is approval drift made on that decision. The first-draft script counted list markers and heading hashes as words; the implementer was sent back and the marker is now stripped as structure. The Goal's figures come from the scratch baseline and stay as written; the re-derived table below is the one later sections diff against. Seventeen slot markers landed at 128e0f1, and this Chapter replaces slot 0 in place as the Approach orders, leaving sixteen. Probe pair: the change named no shape file, so no pair ran. Local main was rebased onto origin at the operator's word before arming and still carries another session's three unpushed kaizen commits, untouched.
Assumptions: - The ten reviewer charters are measured as ten rows, as the Approach's baseline paragraph orders, rather than one combined row (decided 2026-09-15, section 0, the Approach's own text). - The fix delta that widened the sentence unit owed no review round: one regular expression in an existing module, no outward action, no new module and no security surface, locked by red-then-green tests and measured over all 23 in-scope files with every new boundary read by hand (decided 2026-09-15, section 0, the fix-delta bar's below-bar judgment).
Review Findings: review: adversarial and blind at fable, Agent tool. Major (adversarial, spec-traceable): `test/size-budget.json` carried no cap for the new test, folded into scope and fixed. Held Majors (blind, orchestrator-made traces, both new-requirement at `tools/prose-shape.mjs:57`): a sentence opening with a quote, bracket, underscore or digit merged into the one before, and a terminator inside a closing quote or parenthesis never ended a sentence. The KIT: Expert ask went unanswered; the scope-adjudicator ruled ask on both; the pre-BLOCKED consult ruled widen both now; the operator said yes and both are fixed, with one lock each and the fixture moved from 15 to 16 sentences. Minors: 4 fixed in the close pass (the test's second paragraph splitter replaced with `splitParagraphs`; the header's bold-lead claim now says a bold phrase closing mid-sentence splits too; the header's closing-quote claim is true under the widened unit; the win32 drive-letter case compare that could print nothing at exit 0), 0 upgraded, 10 left with the reason. Thematic breaks and setext underlines, blockquote and `*`/`+` bullets, `*Lead.*` and `_Lead._` leads, and an inline triple-backtick opener occur zero times in the 23 in-scope files outside frontmatter and fences, a scan whose control file matched each shape; the blockquote, bullet and italic-lead shapes would also widen the Approach's unit past the operator's decision. A comment opened on a table or fence line, a backtick span wrapping a line break, a document opening with a thematic break, and a path starting with `--` have no instance in scope either. The Goal's stale figures are answered by this Chapter's table. The blind claim that no fixture covered quote, bracket or digit starts is answered by the two new locks. Author re-read of the close-pass delta, not a round.
Stamps: adjudicated 16, stamped 2 (`kit-compact-checkpoint-lapses-from-a-worktree` and `a-status-read-from-a-checkout-is-a-fact-about-the-ref`, both operator tier); window 3h, since the run started.
Gate: targeted lane (SCOTT-CLAUDE, 2026-09-15 14:05Z to 14:06Z, heavy-process slot claimed by this session after supervisor-dev's claim cleared), the recipe's nine files plus `test/prose-shape.test.js`: 577 tests, 576 pass, 0 fail, 1 skipped, exit 0. The skip is `listProbeFiles does not read a symbolic link as a probe`, which this box refuses at EPERM. No baseline exists on this combined lane: the interim board recorded two of its files alone, `test/prose-shape.test.js` at 19 pass and `test/size-ratchet.test.js` at 98 pass, and this run did not split its counts per file. The prose-shape file read 21 pass, 0 fail, exit 0 on its own run beforehand. Red before green: the three changed locks failed against the committed script, 21 tests, 18 pass, 3 fail, exit 1.
Next: 1. The doctrine and the output style
Commit Model: Branch-and-PR
Delta: SCOTT-CLAUDE, 2026-09-15 14:06Z, worktree against HEAD 36e0a27, no contention.

```
repository: claude-kit
test/prose-shape.test.js: 313 lines, cap 313, +15; tests 21, +2
words: 853207 of cap 853207 across 86 curated files
test lines: 114603 of cap 114603 across 61 test files
tests: 3409
changed paths under no measured root: 4 (2 differing from HEAD, 2 untracked), which this tool does not measure and which no row above names; named-exclusion paths in the changeset: test/size-budget.json, which a root holds and no shape measures, so no row above names them
```

Re-derived baseline, `node tools/prose-shape.mjs` over the working tree at 36e0a27 plus this section's script, the in-scope documents unchanged since 399dd4f (SCOTT-CLAUDE, 2026-09-15 around 14:03Z). Columns: words, paragraphs, past 120, past 200, longest paragraph, sentences, past 30, past 45, longest sentence.

| File | Words | Paras | >120 | >200 | Longest para | Sentences | >30 | >45 | Longest sent |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| operating-instructions | 10516 | 108 | 26 | 13 | 686 | 444 | 121 | 51 | 191 |
| output-styles/kit.md | 1435 | 39 | 3 | 1 | 238 | 84 | 8 | 4 | 71 |
| executing-work | 21748 | 114 | 40 | 27 | 2059 | 645 | 313 | 154 | 173 |
| finishing-work | 16324 | 52 | 36 | 29 | 1535 | 477 | 221 | 113 | 196 |
| coordinator | 19844 | 56 | 40 | 31 | 1883 | 441 | 267 | 167 | 356 |
| role | 7080 | 59 | 22 | 12 | 577 | 234 | 90 | 41 | 209 |
| standing-watch | 3782 | 42 | 7 | 3 | 977 | 136 | 42 | 27 | 120 |
| peer-sessions | 9886 | 74 | 27 | 15 | 836 | 318 | 140 | 62 | 118 |
| memory-system | 12812 | 147 | 31 | 18 | 756 | 481 | 174 | 64 | 114 |
| adversarial-reviewer | 3454 | 37 | 9 | 7 | 531 | 115 | 47 | 26 | 123 |
| blind-reviewer | 1363 | 32 | 2 | 2 | 215 | 71 | 11 | 3 | 123 |
| prose-reviewer | 2847 | 30 | 7 | 4 | 464 | 98 | 37 | 18 | 90 |
| plan-reviewer | 932 | 35 | 0 | 0 | 98 | 59 | 6 | 0 | 43 |
| security-reviewer | 1785 | 32 | 3 | 1 | 287 | 81 | 18 | 11 | 79 |
| qa-verifier | 816 | 13 | 2 | 0 | 159 | 44 | 10 | 2 | 62 |
| blind-reader | 1618 | 29 | 3 | 1 | 319 | 83 | 17 | 4 | 64 |
| scope-adjudicator | 1955 | 45 | 3 | 0 | 183 | 103 | 18 | 5 | 74 |
| consultant | 463 | 14 | 0 | 0 | 108 | 29 | 2 | 0 | 38 |
| docs-curator | 1788 | 27 | 3 | 2 | 488 | 92 | 19 | 3 | 83 |
| responding-to-review | 1855 | 23 | 6 | 4 | 356 | 76 | 21 | 9 | 108 |
| curating-docs | 1547 | 42 | 2 | 1 | 327 | 87 | 13 | 3 | 108 |
| brainstorming | 3077 | 34 | 5 | 3 | 875 | 130 | 38 | 13 | 102 |
| kit-goal | 2719 | 42 | 6 | 1 | 281 | 102 | 38 | 14 | 71 |

Differences from the Approach's scratch table. Words fall in every row (the doctrine 10,672 to 10,516, executing-work 25,512 to 21,748), because list markers, heading hashes, fences and tables are no longer counted as words. Paragraphs rise in every row but brainstorming (the doctrine 95 to 108, brainstorming 37 to 34), because each list item is now its own paragraph while fences and tables no longer join the prose around them. Sentences rise in most rows (the doctrine 264 to 444) and sentences past 30 words fall in most (executing-work 327 to 313, the doctrine 136 to 121, role the exception at 88 to 90), because list items and bold leads now split. The ten charters, one row of 18,722 words before, now read as ten rows summing to 17,021. Under the widened unit the corpus reads 4,430 sentences and 1,671 past 30 words, against 4,421 and 1,672 under the unit as first written.

### Chapter 2 - 2026-09-15
Completed: 1. The doctrine and the output style
Implemented By: implementer-fable at the fable override; the review fixes, the `docs/harness-assumptions.md` re-aims, the size sync and the probe adjudication in the main session
Metrics: review rounds 2, closed major-closed; provenance 4 spec-traceable, 1 fix-introduced, 0 new-requirement, rulings (0 refused, 0 declared, 0 asked); NEEDS_CONTEXT 0; escalations none; consults 0
Decisions / Surprises: The implementer regrouped six long bullets into sub-bullets under unchanged leads and left the two longest, the index-window bullet and the stop-for-a-yes bullet, as single paragraphs; neither is a register-core bullet, so the Approach permits sub-bullets there, and the reason they went without is on the Minor list. Two lines gained words no base sentence carried, the ranking bullet's "Second:/Third:/Fourth:/Fifth:/Last:" labels and "in four parts" in the Narrate bullet; both are deliberate and neither changes a rule. Four `Source:` citations in `docs/harness-assumptions.md` turned out to have been mis-aimed by one bullet before this section began, which the by-content re-aim corrected rather than preserved, and a fifth pointed at a doctrine fact that exists at no ref and was dropped. This Chapter corrects Interim board 4, which recorded the probe baseline wrongly and is the second time this section misread it; the runner's counting rule is now read from its own source rather than from its header line, and the reading is below. Probe pair: 39 ruled pairs before and after, counted mismatches falling from 3 to 1, with the one mismatch at head read as an unstable moment rather than a sentence that moved; the full reading is below.
Assumptions: none
Review Findings: review: code pair and document pair (2 readers) at fable, Agent tool, round 1; one lens at fable, Agent tool, round 2. Round 1 returned no Critical. Three Majors were owed and all three are fixed: the index-window bullet's flattened condition (blind-reviewer MAJOR, prose-reviewer MAJOR, adversarial-reviewer MINOR, three lenses converging on one passage without sharing a brief), the stale `Source:` citations (prose-reviewer MAJOR), and the epistemic-status imperative, which arrived MINOR from two lenses and was upgraded at adjudication on the consequence the prose lens stated, that a reader taking the imperative alone would state epistemic status by default. Round 2 returned one MAJOR, fix-introduced: my own re-aim of the SendMessage citation pointed at a bullet that does not carry the claim, which I confirmed by grepping the doctrine at head and at base for any delivery-timing sentence and finding none, with `finishing-work/SKILL.md` as the control at one hit; the citation is dropped rather than re-aimed. Round 2's two Minors: one folded (a `:100` citation mis-aimed at base and at head, re-aimed to `:185`), one left with the reason (a partial citation whose mechanism the memory record beside it carries). Every trace on a blind-lens finding is orchestrator-made. Minors: 0 fixed in the close pass, 1 upgraded on a stated consequence, 4 left with the reason, recorded at `.kit/scratch/claude-kit_prose-pass_spec_v1/minors-section-1.md`; each of the four is a prose restructure whose subject no test reads, so each would owe a round under the fix-delta bar's judgment clause and the close pass never owes one.
Meaning questions: operating-instructions, under `## Which text governs`, the stop-for-a-yes bullet: "The one instance settled here is delegation" was named by both blind readers as a sentence neither could resolve, and it reads the same at base, so it is a question about what the rule says rather than about this pass's shaping.
Stamps: adjudicated 2, stamped 0; window 3h, covering the section since Chapter 1's 14:06Z. Both hits are operator tier, `subagent-can-report-a-documented-past-injection-as-a-live-one` and `cswap-autoswitch-moves-the-active-account`, and neither was read by this session nor acted on in this section, which is the shape the operator-tier record `unstamped-lists-peer-session-reads` describes. Two records were applied and stamped earlier in this section, `doctrine-has-a-third-gitignored-copy` and `the-probe-runner-is-a-paid-box-claimed-run`. The deferred scope correction landed here too: `agent-growth-reading-artifact` carried `machine: NEO-CLAUDE` while its behaviour reproduced on SCOTT-CLAUDE, and `--machine` is creation-only, so the remedy was a supersede rather than a repair, and `the-task-output-path-is-not-the-growth-artifact` now carries the fact with no machine pin.
Gate: targeted lane, the recipe's nine test files (SCOTT-CLAUDE, 2026-09-15 15:36Z to 15:37Z, run unclaimed: supervisor-dev's claim for agent_persona was past its declared 300 seconds, waited out to that declaration and then proceeded past with the holder told on the peer channel, and this session's own probe-corpus run was live on the network beside it): 556 tests, 555 pass, 0 fail, 1 skipped, exit 0. Against the baseline recorded on this same nine-file lane at 15:09Z, 556/555/0/1 exit 0, no test moved and nothing regressed. The skip is the symlink probe case this box refuses at EPERM. The lane went red once before this reading, on the size cap alone, at 10590 words against a cap of 10587; the caps were synced to 10590 and the lane is the re-run.
Next: 2. Executing-work, first half
Commit Model: Branch-and-PR
Delta: SCOTT-CLAUDE, 2026-09-15 16:20Z, worktree against HEAD 2da9f4a, no contention on the reading itself.

```
repository: claude-kit
home/claude-kit-doctrine.md: 10590 words, cap 10590, +3
plugins/claude-kit/skills/operating-instructions/SKILL.md: 10590 words, cap 10590, +3
words: 853147 of cap 853147 across 86 curated files
test lines: 114603 of cap 114603 across 61 test files
tests: 3409
changed paths under no measured root: 4 (1 differing from HEAD, 3 untracked), which this tool does not measure and which no row above names; named-exclusion paths in the changeset: test/size-budget.json, which a root holds and no shape measures, so no row above names them
```

Diagnostic, `node tools/prose-shape.mjs` at the base ref `7981da6` over copies taken with `git show` into `.kit/scratch/`, and at head over the worktree (SCOTT-CLAUDE, 2026-09-15 16:12Z). The mirror reads identical to the source in both legs, as its parity pin requires.

| File | Leg | Words | Paras | >120 | >200 | Longest para | Sentences | >30 | >45 | Longest sent |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| operating-instructions | base | 10516 | 108 | 26 | 13 | 686 | 444 | 121 | 51 | 191 |
| operating-instructions | head | 10475 | 119 | 26 | 9 | 690 | 624 | 45 | 2 | 57 |
| home/claude-kit-doctrine.md | base | 10516 | 108 | 26 | 13 | 686 | 444 | 121 | 51 | 191 |
| home/claude-kit-doctrine.md | head | 10475 | 119 | 26 | 9 | 690 | 624 | 45 | 2 | 57 |
| output-styles/kit.md | base | 1435 | 39 | 3 | 1 | 238 | 84 | 8 | 4 | 71 |
| output-styles/kit.md | head | 1435 | 39 | 3 | 1 | 240 | 108 | 2 | 0 | 40 |

Sentences past 30 words fall in both documents, 121 to 45 in the doctrine and 8 to 2 in the output style, and paragraphs past 200 words fall from 13 to 9, so the Approach's diagnostic direction holds. The longest paragraph rises by four words in the doctrine and two in the output style, because a restatement cut inside a long bullet is smaller than the connective words the splits added.

Two sentences past 45 words stay, both in the doctrine, read under the committed unit. The ranking bullet's third rank runs 55 words and the stop-for-a-yes bullet's channel list runs 57. Each is one closed list, which is one idea under the writing-skills bar, and splitting an enumerated closed list across two sentences makes it read as two lists and invites a reader to treat a closed set as open, which is the one thing both sentences exist to prevent. The output style has no sentence past 45 words.

Cut list, four restatements, each with its survivor. The implementer's own list was lost with the session context at a compaction, so this list is re-derived from a sentence-level diff of the base copy against head using the diagnostic's own exported splitter, with each cut confirmed absent from head and each survivor confirmed present by literal grep; the working is at `.kit/scratch/claude-kit_prose-pass_spec_v1/1/cut-list.md`.

1. `## Which text governs`: "Ranking is the first move rather than the last." Survivor: the bullet's own lead, "When two surfaces disagree at a moment, rank them before you act."
2. Pushed-is-not-merged: "Pushing to a feature branch does not land the work on the trunk." Survivor: the bullet's own lead, "Pushed is not merged; a pull request branch is frozen once its pull request has merged, not once it is up."
3. The index-window bullet: "It stops no sweep, and reading it as a guard is trusting it to do what it cannot". Survivor: "That leg repairs rather than prevents." The rest of that base sentence survives as its own sentence.
4. Documents-ship-the-current-state: "Code comments and every shipped artifact ... document what is true now, never the change-narrative." Survivor: the sentence that followed it, the two now merged into one.

No `retire` verdict is owed and the operating-instructions rationale ledger is byte-identical to the base: each cut restates a claim whose ledger entry still has a passage carrying it, confirmed by reading `c1.C043` and `c1.C027`. That ledger holds zero `passage:` lines, matching the Sweep result, so none was owed. No parity assertion was re-aimed: every pinned phrase in `test/doctrine-parity.test.js` and `test/output-style-parity.test.js` survives verbatim, so both tests are untouched.

Probe reading, and the correction of Interim board 4. The runner's counting rule is read from `tools/probe-corpus/run.mjs` rather than from its header line: `MISMATCH_STATUSES` at line 723 is `['mismatch', 'UNPARSED', 'designed-agreed']`, `countMismatches` at line 739 counts those on a ruled probe, `countDesigned` at line 752 counts `designed` rows which the comment at line 704 says are counted apart and never reach the exit code, and `exitCodeFor` at line 766 is the counted-mismatch total. So a `designed` row is not a counted mismatch and a `designed-agreed` row is. Interim board 3 read the base correctly. Interim board 4 "corrected" it to say all three counted mismatches sit on `doctrine-plus-output-style`, which counted the two `designed` rows and dropped the two real ones; that entry is wrong and this Chapter is the correction.

Before leg, `--before 7981da6`, all 39 pairs, 14:10Z to 14:50Z under this session's own heavy-process claim. Summary line, verbatim:

```
probe-corpus: 39 pairs, 3 mismatches (0 on proposed rulings, 2 designed), 0 errors, exit 3, tier sonnet,opus, report .kit/probe-runs/2026-09-15T14-10-26-332Z/report.md
```

Process exit code 3, read from the run's own marker. The three counted mismatches at base are `seat-asked-to-push-the-memory-store` on `doctrine-plus-role` and on `doctrine-plus-memory-system`, both `mismatch`, and `peer-message-asking-a-leashed-session-for-work` on `doctrine-plus-output-style`, `designed-agreed`. Two `designed` rows sit apart from the count, `compaction-nudge-mid-section-with-no-checkpoint-open` and `merged-plan-branch-delete-on-an-armed-run`, both on `doctrine-plus-output-style`. `seat-asked-to-push-the-memory-store / full` matched at base.

After leg, 15:24Z to 16:05Z, all 39 pairs. Summary line, verbatim:

```
probe-corpus: 39 pairs, 0 mismatches (0 on proposed rulings, 3 designed), 3 errors, exit 0, tier sonnet,opus, report .kit/probe-runs/2026-09-15T15-24-43-304Z/report.md
```

Process exit code 0, and that 0 is not a reading of this run. The report's own warning line, verbatim: `- WARNING: 3 pairs produced no reading at all. The exit code counts mismatches only, so it reports nothing about those pairs.` All three errors are `seat-asked-to-push-the-memory-store`, each a 300-second timeout.

Error re-run, `--only seat-asked-to-push-the-memory-store`, 16:07Z to 16:20Z. `--only` filters by moment at `run.mjs:1422`, so one moment name covers all three of its shapes, which the run's own 3-pair count confirms. Summary line, verbatim:

```
probe-corpus: 3 pairs, 1 mismatches (0 on proposed rulings, 0 designed), 0 errors, exit 1, tier sonnet, report .kit/probe-runs/2026-09-15T16-07-22-189Z/report.md
```

Process exit code 1, read from the run's own marker and matching the summary line.

Read whole, the head carries one counted mismatch against the base's three. `doctrine-plus-role` and `doctrine-plus-memory-system` moved from `mismatch` to `match`, `peer-message` moved from `designed-agreed` to `designed`, the two other `designed` rows are unchanged, and `full` moved from `match` to `mismatch`, reading `decline-and-route-to-the-operator` where the ruling reads `pull-rebase-and-push-the-store`.

That one new mismatch is recorded as a finding and disposed of as an unstable moment rather than a sentence that moved, on three pieces of evidence. The two sentences that decide this moment are byte-identical between base and head, confirmed by grep: the closed channel list naming "the memory store's own sync", and "A push to any remote but the working branch's own is inside the test, with the memory store's own sync excepted, since that sync is on the list." The base run itself already had this moment disagreeing on two of its three shapes, in the same direction and with the same wrong action. And which shapes agree flips between runs while the direction of disagreement does not, which is the signature of a moment the sonnet tier reads unstably. The net moved toward the ruling, three counted mismatches to one. This is recorded rather than called clean, and the moment is worth re-reading at finishing.

### Chapter 3 - 2026-09-15
Completed: 2. Executing-work, first half
Implemented By: implementer-fable at the fable override, dispatched twice after the first dispatch wedged; the review fixes, the `docs/harness-assumptions.md` re-aims, the size sync and the probe adjudication in the main session
Metrics: review rounds 3, closed claim-exit; provenance 5 spec-traceable, 3 fix-introduced, 0 new-requirement, rulings (0 refused, 0 declared, 0 asked); NEEDS_CONTEXT 0; escalations none; consults 0
Decisions / Surprises: The first implementer dispatch wedged under account swaps at a rate limit and was stopped on the whole hallmark, as Interim board 5 records; that is an environment fault and counts against neither ladder, and the one same-tier re-attempt completed. The pointer conversion at the memq paragraph was the section's one real hazard: it moved two claims to `memory-system/SKILL.md:8`, which carries neither, and review round 2 caught it. Both claims are stated in executing-work again at line 112, the worktree-filing sentence being new text at head because its only base carrier was the sentence the conversion cut. Two of this session's own calls were wrong and are conceded: re-aiming `Source:` citations to a "nearest carrying line" rather than to a line that states the belief, and editing the reason line of the keep entry `c1.C019`, which the plan's Out of Scope list puts outside this pass; that edit is reverted and the entry is byte-identical to the base. The second half, from the line opening `4. **Address findings.**`, is identical to 758e064 once CRLF is normalized, the worktree checking out CRLF under `core.autocrlf true` against LF blobs. An em dash sweep over the skill, its ledger and `docs/harness-assumptions.md` reads 0 at base, 0 at head and 0 in the added lines, with a control line reading 1 (SCOTT-CLAUDE, 2026-09-15 about 19:22Z). Probe pair: the before and after legs read the same, 0 errors on both, with no moment moved; the full reading is below.
Assumptions: none
Review Findings: review: code pair (blind-reviewer over the ledger and `test/size-budget.json`, adversarial-reviewer) and document pair (2 readers, prose-reviewer) at fable, Agent tool, round 1; adversarial-reviewer alone at fable, Agent tool, rounds 2 and 3, over the fix delta against 9dc98d6. No Critical survived adjudication: the prose reviewer's Critical on line 112's all-zero digest tell, which asserted one cause the base contradicts, was downgraded to Major as a wrong narrowing in a diagnostic tell whose full cause list sits one pointer away, and fixed. Round 1's other owed Majors, all fixed: the failed-handshake consequence dropped from line 112 (prose-reviewer); the worktree-filing citation, harness-assumptions line 22, aimed at a line that no longer carried it (adversarial-reviewer and prose-reviewer); the "nearest carrying line" re-aims at harness-assumptions lines 20 and 74 (adversarial-reviewer), line 20 now citing `kit-goal/SKILL.md:12` alone and line 74 citing `docs/security-model.md:645`, which states the `tools:` fact the skill removed at 3a09c25; and the `c1.C019` reason quoting a sentence the cut removed (prose-reviewer). One adversarial Major was justified-not-fixed: harness-assumptions line 12's `:86` carries the session-id half of its belief, with `kit-goal/SKILL.md:98` and the memory record carrying the other half. Round 2 returned three Majors, all fix-introduced and all fixed: memory-system:8 does not state where a worktree session is filed, so the sentence returns to line 112 and so does the citation; the pointer's "every directory" aimed at a resolver rule with no failed-handshake case, so that case is stated at line 112 again; and the `c1.C019` reason edit sat outside the plan's Out of Scope bound and is reverted. The two fix-introduced rounds do not form a design stop, since round 3 returned no Major. Round 3 returned one Minor, line 389's wording, fixed, and asked that this Chapter name the dropped citations, which the Delta reading below does. Minors: 9 fixed inside the fix rounds rather than in a close pass, since each was a one-sentence reshape landing with the Majors' own delta and reviewed by the round that followed; 0 upgraded; 8 left with the reason, the reasons at `.kit/scratch/claude-kit_prose-pass_spec_v1/2/round-1-adjudication.md`. Among those eight, the cap footing restated at two sites stays because `test/doctrine-parity.test.js` requires it at each cap site, and the line 150 antecedent sits inside the fenced Dispatch Brief template, an anchor the same test pins. Every trace on a blind-lens finding is orchestrator-made.
Meaning questions: all present at base, listed here for the program's step 4. Completion contract: "Waiting is the third stop shape" never names the first two; "re-block" is never defined; "The only in-turn hold the contract names is a blocking `TaskOutput`" sits beside the synchronous shape; "This paragraph is where the moment lives" sits beside peer-sessions owning the expert-ask route. Step 0: the kit-goal CLI executable for `arm --self-armed` is not spelled. Step 1: the Dispatch Brief's box-budget clause names no source for the session's own id and roster name; which text in the standing clauses is the literal the brief carries and which is orchestrator guidance is not marked; "the dispatch is short" has no threshold against the first-turn reading. Step 3: whether a deliverable spec under `docs/plans/` reaches a blind reader as a document path or is withheld as the spec path; its opening leans on step 7's first-green commit, which the loop's order places after it; the Workflow route coins "a dispatch carrying the plan's what" before step 4 defines it; the Audience rule's "never subtracted" sits beside "It replaces the code pair".
Stamps: adjudicated 7, stamped 2; window 3h, covering the section since Chapter 2's close. Stamped: `the-probe-runner-spends-the-operators-own-session-allowance`, which is why both probe legs were read row by row and not from their exit code, and `subagent-liveness-cannot-be-read-from-the-filesystem` in the operator tier, which is why the wedge and first-turn readings were taken from the agent transcript. Skipped: `a-retired-claim-is-swept-by-meaning-not-by-words` and `a-retire-cover-must-be-read-at-assertion-level`, both surfaced by a hook nudge and both about retiring tests rather than prose cuts; and three operator-tier reads, `subagent-can-report-a-documented-past-injection-as-a-live-one`, `forward-resource-arrangements-into-dispatch-briefs` and `gh-cli-on-scott-claude`, none of which this section can show changed what it built.
Gate: targeted lane, the recipe's nine test files, which include `test/ledger-preamble-parity.test.js` the section's acceptance names (SCOTT-CLAUDE, 2026-09-15 18:33Z, the content of 23c0c9e unstaged over 9dc98d6, no foreign heavy process): 556 tests, 555 pass, 0 fail, 1 skipped, exit 0. Against the baseline recorded on the same lane at 758e064, 556/555/0/1 exit 0, no test moved and nothing regressed. The skip is the symlink probe case this box refuses at EPERM. The whole suite also ran at the first-green tree: 3503 tests, 3491 pass, 0 fail, 12 skipped, exit 0 (SCOTT-CLAUDE, 2026-09-15 18:16Z).
Next: 3. Executing-work, second half
Commit Model: Branch-and-PR
Delta: SCOTT-CLAUDE, 2026-09-15 18:58Z, worktree against HEAD e070481, which already carries the whole section, so the reading shows no measured row; the foreign `kaizen/notes-SCOTT-CLAUDE.md` line is the one path differing from HEAD. Across the section, the skill's cap in `test/size-budget.json` moved from 25472 to 25382 and the ledger's from 208758 to 208803, the ledger's rise being R044's retire verdict and its `landed:` line.

```
repository: claude-kit
words: 853102 of cap 853102 across 86 curated files
test lines: 114603 of cap 114603 across 61 test files
tests: 3409
changed paths under no measured root: 4 (1 differing from HEAD, 3 untracked), which this tool does not measure and which no row above names; named-exclusion paths in the changeset: none
```

Diagnostic, `node tools/prose-shape.mjs` over LF copies taken with `git show` into `.kit/scratch/claude-kit_prose-pass_spec_v1/2/`, at the base ref `758e064` and at HEAD `e070481` (SCOTT-CLAUDE, 2026-09-15 about 19:20Z, exit 0). The first half is lines 1 to 403 at base and 1 to 477 at head, each ending on the line before `4. **Address findings.**`.

| File | Leg | Words | Paras | >120 | >200 | Longest para | Sentences | >30 | >45 | Longest sent |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| executing-work, first half | base | 10203 | 65 | 22 | 15 | 1930 | 338 | 147 | 60 | 139 |
| executing-work, first half | head | 10099 | 109 | 36 | 4 | 211 | 530 | 77 | 1 | 46 |
| executing-work, whole | base | 21748 | 114 | 40 | 27 | 2059 | 645 | 313 | 154 | 173 |
| executing-work, whole | head | 21644 | 158 | 54 | 16 | 2059 | 837 | 243 | 95 | 173 |

In the first half, sentences past 30 words fall from 147 to 77 and past 45 from 60 to 1, and paragraphs past 200 words fall from 15 to 4. The longest paragraph falls from 1930 words to 211. The whole-file longest paragraph and sentence are unchanged, which fits both sitting in the second half that section 3 owns, since the first half's own longest figures fell. Paragraphs past 120 rise from 22 to 36, inferred to be split paragraphs past 200 whose pieces still run past 120, which a per-paragraph listing would confirm.

One sentence past 45 words stays: the security-reviewer trigger enumeration in step 3, 46 words. It is one closed list, which is one idea under the writing-skills bar, and splitting it would make a closed set read as two lists.

Cut list, three restatements and one pointer conversion, each with its survivor. Each cut was confirmed absent at head, and each survivor present, by literal grep over the LF copies at about 19:21Z.

1. The completion contract: "The only reason to stop mid-spec is a true blocker, and when you hit one you make it impossible to miss." Survivors: "**Stop only for a true blocker, and make it loud.**" (line 45) and "Interrupt me only for a member of the blocker set below." (line 10).
2. Step 1: "Short of the whole hallmark, quiet is working." Survivor: "**A quiet agent is a working agent, short of the wedge hallmark.**" (line 374). This is also the survivor the keep entry `c1.C019` now reads against; its reason line quotes the cut sentence as of the commit it names and is left as it stands under the Out of Scope bound.
3. Step 3: "The blind lenses carry no such line either, on the sighted-only rule above and for its reason." Survivor: "**The adversarial lens, the security lens and the scope adjudicator carry a `Trace target:` line, and no other dispatch does.**" (line 395). The ledger's R044 moves from `keep` to `retire`, naming R041's key, with `landed: 9dc98d6 section 2`.
4. The memq resolution paragraph, base line 81: its store-resolution cases became a pointer at `memory-system/SKILL.md:8`, which carries five of the six. The sixth, a worktree whose handshake fails, stays at line 112 with its `git worktree repair` tell, as does the sentence stating where the harness files a session started inside a linked worktree.

Ledger: R044's verdict and `landed:` line, and V002's `passage:` line updated to head line 72. V001's `passage:` line still reads true. No other ledger line changed. No parity assertion was re-aimed: every pinned phrase in `test/doctrine-parity.test.js`, `test/review-loop-provenance.test.js` and `test/kit-goal-stop.test.js` survives verbatim.

`Source:` lines: 23 citations into the skill in `docs/harness-assumptions.md` were re-aimed by content, all already stale at the base because earlier edits moved the lines. Three did not re-aim to the skill. Line 20's executing-work citation is dropped, since no line of the skill states that native `/goal` belief, and `kit-goal/SKILL.md:12` carries it alone. Line 21's `:112` half is dropped, since that line points at the transcript derivation rather than stating it, and `memory-system/SKILL.md:8` carries it alone. Line 74 moves to `docs/security-model.md:645`, the skill having carried the agentType `tools:` fact from 5ecd99a until 3a09c25 removed it.

Probe reading. The ten moments whose shapes name the skill were read in three runs, each under this session's own heavy-process claim.

Before leg, one moment, `--before 758e064 --only commit-and-push-at-section-close`, 18:33Z. Summary line and exit code: 3 pairs, all `match`, 0 errors, exit 0, report `.kit/probe-runs/2026-09-15T18-33-51-400Z/report.md`.

Before leg, the other nine moments, `--before 758e064`, 18:38Z to 18:57Z. Summary line, verbatim:

```
probe-corpus: 24 pairs, 1 mismatches (0 on proposed rulings, 1 designed), 0 errors, exit 1, tier sonnet,opus, report .kit/probe-runs/2026-09-15T18-38-15-552Z/report.md
```

Process exit code 1, read from the run's own marker. The report's warning line, verbatim: `- WARNING: 1 pair on a shape built to read against the answer agreed with it instead, and each one is counted with the mismatches: either the defect the shape exposes is fixed, or the shape no longer reaches the moment and the marker on it is stale.`

After leg, all ten moments over the worktree at 23c0c9e's content, 18:57Z to 19:20Z. Summary line, verbatim:

```
probe-corpus: 27 pairs, 1 mismatches (0 on proposed rulings, 1 designed), 0 errors, exit 1, tier sonnet,opus, report .kit/probe-runs/2026-09-15T18-57-53-426Z/report.md
```

Process exit code 1, read from the run's own marker, with the same warning line as the before leg.

Read whole, the two legs agree pair for pair. In both, 25 pairs `match`. `merged-plan-branch-delete-on-an-armed-run` on `doctrine-plus-output-style` reads `designed-agreed`, the one counted mismatch, with the same action read, `remove-the-worktree-then-delete-the-branch`. `compaction-nudge-mid-section-with-no-checkpoint-open` on `doctrine-plus-output-style` reads `designed`, the same action, `keep-working-to-the-boundary`. Neither row's shape loads executing-work, so this section could not have moved either, and neither moved. Chapter 2 recorded `merged-plan-branch-delete` as `designed` on both of its legs, the after leg reading section 1's fixed text, and this section's before leg reads that same text at 758e064 as `designed-agreed`. The same text reading two ways across runs points at a moment the sonnet tier reads unstably, not at a sentence that moved. It is recorded for finishing to settle, not as a finding of this section.

Next for section 3: its brief carries the reader findings round 1 logged against the second half, listed at `.kit/scratch/claude-kit_prose-pass_spec_v1/2/round-1-adjudication.md` under "Carried to section 3".

### Chapter 4 - 2026-09-15
Completed: 3. Executing-work, second half
Implemented By: implementer-fable at the fable override, one dispatch; the review fixes, the close pass, the ledger `landed:` lines, the size sync and the probe adjudication in the main session
Metrics: review rounds 2, closed claim-exit; provenance 2 spec-traceable, 0 fix-introduced, 0 new-requirement, rulings (0 refused, 0 declared, 0 asked); NEEDS_CONTEXT 0; escalations none; consults 0
Decisions / Surprises: The rewrite covers the second half, from the line opening `4. **Address findings.**` to the end of the file, plus the KIT-CLAIM-CLASS region in both reviewer charters. The first half is byte-identical to 139fb64 after CRLF normalization, confirmed by a literal compare of the two copies. Both of round 1's owed Majors were bounds the base stated and the rewrite stopped stating, which is this pass's one real hazard and the second section running to find it: the adoption trigger's example list had closed into a definition, and the fold predicate's three tests had detached from the predicate they decide. The size caps rose rather than fell for that reason, the skill by 18 words and each charter by 3, since restoring a bound costs words; the ledger's cap rose 10 more for the two `landed:` lines. An em dash sweep over the skill and both charters reads 0 at head, with a control line reading 1 (SCOTT-CLAUDE, 2026-09-15 about 20:40Z). Probe pair: one shape moved from `match` to `mismatch` between the legs, and a re-run of that one pair at the base reads the same mismatch, so the section did not move it; the full reading is below.
Assumptions: none
Review Findings: review: code pair (adversarial-reviewer, blind-reviewer over the diff, plus two blind-readers and the prose-reviewer) at fable, Agent tool, round 1; adversarial-reviewer alone at fable, Agent tool, round 2, over the fix delta `git diff 99fd86a f8440bb`. No Critical was returned in either round. Round 1's two owed Majors, both spec-traceable to the Goal's "no claim lost" and both fixed at f8440bb: the adoption trigger read "Such a change is X, Y, or Z", closing a list the base left open, and now reads "Instances of such a change are ..."; and the fold predicate's three tests had become free-standing sentences, so the conjunction deciding "trivial and within the section's spirit" was gone, and they now hang off "because it means all three of these hold:". The second was an adversarial MINOR upgraded on the prose lens's stated consequence, a fold decided by feel. Round 2 returned no Major and no Critical, which ends the loop. Minors: round 1 returned 9, of which 5 were fixed inside the fix round, 1 was upgraded as above, and 3 were left with the reason at `.kit/scratch/claude-kit_prose-pass_spec_v1/3/round-1-adjudication.md`; the ninth, the five stale `docs/harness-assumptions.md` citations, was owed main-thread work rather than a finding on the delta and is re-aimed below. Round 2 returned 2, both claim findings: a "because" the round-1 fix attached to the BLOCKED line rather than to the rule, fixed in the close pass, and a third sentence past 45 words, which this Chapter's kept list discharges. Among the three left, restoring the `:569` bridge would undo cut 5 and S071's retirement, and the survivor at `:510` states the rule the bridge pointed at. Every trace on a blind-lens or blind-reader finding is orchestrator-made.
Meaning questions: all present at base, carried for the program's step 4. Step 4: the decision graph has no ordered walk a reader can follow, which the base carried inside one 2059-word paragraph and the rewrite carries as many short ones; the cross-reference names do not match the paragraph leads they point at; the out-of-scope route is written after the close-gate paragraph that runs after it; `<base>` is used and never defined (the implementer raised this too); `<plan-slug>` and `<section>` path shapes are not stated. Step 5: its check is meant for step 2's moment. Step 6: `:693`'s "all three" has no clear antecedent. Chapter format: `:619`'s "for the reason finishing-work's step 6 gives it" points at a reason that skill no longer states.
Stamps: adjudicated 6, stamped 3; window about 2h, covering the section since Chapter 3's close. Stamped: `a-retired-claim-is-swept-by-meaning-not-by-words` and `a-retire-cover-must-be-read-at-assertion-level`, both on the generous bar, because the two retire verdicts were checked against the survivors' own keys rather than against their titles, which is the assertion-level read those records ask for; and `fan-out-runs-through-workflow-under-a-session-wide-cap` in the operator tier, which bounded round 1's roster to five concurrent readers. Skipped: three operator-tier reads, `subagent-can-report-a-documented-past-injection-as-a-live-one`, `gh-cli-on-scott-claude` and `cswap-autoswitch-moves-the-active-account`, none of which this section can show changed what it built.
Gate: targeted lane, the recipe's nine test files (SCOTT-CLAUDE, 2026-09-15 20:23:59Z to 20:24:47Z, the close-pass and `landed:` content unstaged over f8440bb, no foreign heavy-process claim and this session's own claim held): 556 tests, 555 pass, 0 fail, 1 skipped, exit 0, read from the run's own exit code. Against the baseline recorded on this same nine-file lane at 20:14Z, 556/555/0/1 exit 0, no test moved and nothing regressed. The skip is the symlink probe case this box refuses at EPERM. An earlier run of the same lane at 20:22Z read the same counts over the tree before the ledger's `landed:` lines; this reading is the one that covers the state the section closes on.
Next: 4. Finishing-work, first half
Commit Model: Branch-and-PR
Delta: SCOTT-CLAUDE, 2026-09-15 20:47Z, worktree against HEAD a2ab1d7, which carries the implementer's rewrite and the fix round but not the close pass or the `landed:` lines; the foreign `kaizen/notes-SCOTT-CLAUDE.md` line and four untracked `.agentic-*` files are among the unmeasured paths.

```
repository: claude-kit
plugins/claude-kit/skills/executing-work/references/rationale-ledger.md: 208810 words, cap 208810, HEAD size unreadable (its blob is past the git runner output ceiling), so no delta
words: 853133 of cap 853133 across 86 curated files
test lines: 114603 of cap 114603 across 61 test files
tests: 3409
changed paths under no measured root: 7 (2 differing from HEAD, 5 untracked), which this tool does not measure and which no row above names; named-exclusion paths in the changeset: test/size-budget.json, which a root holds and no shape measures, so no row above names them
```

Diagnostic, `node tools/prose-shape.mjs` over LF copies in `.kit/scratch/claude-kit_prose-pass_spec_v1/3/diag/`, taken with `git show` at the base ref `139fb64` and from the worktree at head (SCOTT-CLAUDE, 2026-09-15 about 20:30Z, exit 0). The second half starts at the line opening `4. **Address findings.**` and runs to the end of the file.

| File | Leg | Words | Paras | >120 | >200 | Longest para | Sentences | >30 | >45 | Longest sent |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| executing-work, second half | base | 11545 | 49 | 18 | 12 | 2059 | 307 | 166 | 94 | 173 |
| executing-work, second half | head | 11560 | 106 | 44 | 10 | 277 | 533 | 122 | 2 | 57 |
| executing-work, whole | base | 21644 | 158 | 54 | 16 | 2059 | 837 | 243 | 95 | 173 |
| executing-work, whole | head | 21659 | 215 | 80 | 14 | 277 | 1063 | 199 | 3 | 57 |
| adversarial-reviewer | base | 3454 | 37 | 9 | 7 | 531 | 115 | 47 | 26 | 123 |
| adversarial-reviewer | head | 3457 | 38 | 9 | 6 | 531 | 124 | 45 | 25 | 90 |
| blind-reviewer | base | 1363 | 32 | 2 | 2 | 215 | 71 | 11 | 3 | 123 |
| blind-reviewer | head | 1366 | 33 | 2 | 1 | 215 | 80 | 9 | 2 | 55 |

In the second half, sentences past 45 words fall from 94 to 2 and past 30 from 166 to 122, and the longest paragraph falls from 2059 words to 277. The whole file's longest paragraph and sentence now come from this half, since the first half's own longest are smaller, which is what section 2's Chapter predicted. The charters move little because only their claim-class region was in scope: each gains one paragraph from the region's split, and the adversarial charter's longest sentence falls from 123 words to 90.

Three sentences past 45 words stay in the whole file, two of them in this section's half. The fold predicate's restored test at `:590` is 57 words, one closed list of three conditions that decide one question, which splitting would read as three separate tests. The Commit-and-Push lead at `:618` is 47 words, a bold lead the tool joins to the sentence after it. The third, the security-reviewer trigger enumeration at 46 words, sits in the first half and is section 2's record.

Cut list, five restatements, each with its survivor. Each cut was confirmed absent at head and each survivor present, by literal grep over the LF copies at about 20:35Z.

1. Step 4, the ask bucket's reason clause for why the backstop's line leads. Survivor at `:558`: "Where one adjudication owes this declaration and an ask bucket's together, this line leads and the ask rides in the body, since the Stop hook releases on one leading line and the bound is what stopped the section."
2. The design stop's restatement of the answer window. Survivor at `:510`, which states the window and the late-answer rule whole. Ledger: T099 moves from keep to retire, with `landed: 99fd86a section 3`.
3. The design stop's appositive naming the judge's seat. Survivor at `:502`: "The judge is the repo's live Expert seat where the `ListAgents` roster the peer-sessions skill owns shows one."
4. The backstop's restatement of the failure a refuse recorded but not performed would leave. Survivor at `:532`: "since a refuse recorded and not performed would leave the section closable with the refused mechanism still standing."
5. The loop end's "falls to the adjudicator then" clause. Survivor: the same `:510` sentences as cut 2. Ledger: S071 moves from keep to retire, with `landed: 99fd86a section 3`.

Ledger: T099 and S071 move from keep to retire with their reasons naming the survivors' entries (T061 with T063, and T061 with T062), and each carries its `landed:` line. No `passage:` line changed, confirmed by grep for the changed phrases over the ledger. No parity assertion was re-aimed.

`Source:` lines: five citations into the second half in `docs/harness-assumptions.md` were re-aimed by content, line 11 to `:630`, lines 64 and 65 to `:646`, line 75 to `:658` and line 183 to `:632`. The reviewer confirmed the other eighteen executing-work citations hash identical at both refs, so nothing else moved.

Probe reading. The same ten moments section 2 read, since the shapes that name the skill do not change with the half. The before leg is section 2's after leg, the 18:57Z run over 27 pairs, which this section reuses rather than re-paying for.

After leg, all ten moments over the worktree at the close-pass content, 20:22Z to 20:43Z, under this session's own heavy-process claim. Summary line, verbatim:

```
probe-corpus: 27 pairs, 1 mismatches (0 on proposed rulings, 2 designed), 0 errors, exit 1, tier sonnet,opus, report .kit/probe-runs/2026-09-15T20-22-30-384Z/report.md
```

Process exit code 1, read from the run's own marker. The report printed no warning lines. Rows other than `match`: 24 pairs match; `pre-send-checklist-after-an-authorized-push` on `output-style-plus-executing-work` reads `mismatch`, the one counted mismatch, reading CONTESTED / hold-the-message-and-ask-for-approval against the ruled RESOLVED / send-without-asking; `compaction-nudge-mid-section-with-no-checkpoint-open` on `doctrine-plus-output-style` reads `designed`; and `merged-plan-branch-delete-on-an-armed-run` on `doctrine-plus-output-style` reads `designed`, where the before leg read it `designed-agreed`.

The mismatch is not this section's. That pair read `match` on the before leg, so it was re-run at the base, `--before 139fb64 --only pre-send-checklist-after-an-authorized-push --shape output-style-plus-executing-work`, 20:43Z to 20:47Z: 1 pair, 1 mismatch, 0 errors, exit 1, reading the same CONTESTED / hold-the-message-and-ask-for-approval. So the base text produces the same reading and the section moved nothing. The reply's seven citations are all present verbatim at the base, checked one by one. What the reader describes is a fork it sees between the output style's pre-send checklist and the completion contract, and that fork reads the same at both refs. It is recorded for finishing to settle, with `merged-plan-branch-delete-on-an-armed-run`, which is the second moment this plan has now seen read two ways across runs on unchanged text.

### Chapter 5 - 2026-09-15
Completed: 4. Finishing-work, first half
Implemented By: implementer-fable at the fable override, two dispatches, the rewrite and the fix round; the `docs/harness-assumptions.md` placement, the two round-2 Minor fixes, the ledger `landed:` lines, the size sync and the probe adjudication in the main session
Metrics: review rounds 2, closed claim-exit; provenance 4 spec-traceable, 0 fix-introduced, 0 new-requirement, rulings (1 refused, 0 declared, 0 asked); NEEDS_CONTEXT 0; escalations none; consults 0
Decisions / Surprises: The rewrite covers the skill from its start to the line before `## Steps`, which moved from line 42 to line 114. Every line from `## Steps` to the end is byte-identical to 1fa25b3 after CRLF normalization, 71 lines each side, `cmp` exit 0, re-checked on the close content. The section shrank rather than grew: the half fell from 6603 words to 6482, and the skill's cap fell from 16499 to 16378. The fix round's implementer could not write `docs/harness-assumptions.md`, because the kit's docs write guard refuses that agent type, so it delivered the edited copy under `.kit/` and the main session verified that the copy changed only `Source:` lines before placing it. The `--touching 1fa25b3` probe selected three moments, none of them about the liveness rules this half owns, because the selector keys on which files a moment's shapes name. An em dash sweep over the skill, its ledger and `docs/harness-assumptions.md` reads 0 at close, with a control line built in the same command reading 1 (SCOTT-CLAUDE, 2026-09-15 about 22:10Z); an earlier sweep in this section whose control read 0 was discarded as unproven.
Assumptions: none
Review Findings: review: code pair (adversarial-reviewer, blind-reviewer over the diff, plus two blind-readers and the prose-reviewer) at fable, Agent tool, round 1 over `git diff 1fa25b3 558584f`; adversarial-reviewer alone at fable, Agent tool, round 2, over the unstaged fix delta against 558584f. No Critical was returned by the diff reviewers in either round. Round 1's owed Majors, all spec-traceable to the Goal and to section 4's Files in scope: the eleven `docs/harness-assumptions.md` lines still cited base line numbers, found by the adversarial and prose lenses both, and re-aimed below; the trigger-two conjunction's two halves were split by the sidecar paragraph, found by the gate-strength blind reader, and the paragraph now follows both halves; the empty tally's paragraph promised two causes and settled one, found by the blind reviewer and a blind reader independently, and now points at where the first is settled; and five cuts had no ledger entry or Chapter record, which the cut list below discharges. One Major was refused: the prose lens asked for the 56-word wedge hallmark definition at `:40` to be split, and it stays, because it is one three-part test deciding one predicate and splitting it detaches the predicate, the defect section 3's round 1 took on the fold predicate. The prose lens's own verdict allowed the listed reason instead. The stalled-agent blind reader's two Criticals, the `subagents/` directory root and what the dispatch record is, are present and undefined in the base half too, confirmed by grep, so they are meaning questions below rather than drift. Round 2 returned no Major and no Critical, which ends the loop. Minors: round 1 returned 16 across the lenses, of which 5 sentence splits were fixed in the fix round and the rest were left with the reason at `.kit/scratch/claude-kit_prose-pass_spec_v1/minors-section-4.md`. Round 2 returned 3: the resolved-model citation covered one of its two facts and now cites `:24` and `:30`; the new pointer at `:36` credited the routing to a branch the owning text says the case never reaches, and now reads "the synthetic-only cause ... the paragraph above"; and two assumption lines cite the skill for clauses only their memory records carry, which is pre-existing and left. Every trace on a blind-lens or blind-reader finding is orchestrator-made.
Meaning questions: all present at base, carried for the program's step 4. The half never gives the `subagents/` directory root, never defines the dispatch record or says whether `agent-<id>.jsonl` takes the task id, never names where `status` is read, and uses "re-block" undefined. The tier order of model families behind "a stronger family's prefix" is never stated, and neither is "frontmatter effort" nor the Reviewer Dispatch template's three fields. `:24` says the reason for the line-by-line read is in the growth paragraph, and it sits at `:52` and `:70`. `:24`'s "because the compensation route below is itself a Workflow round" reads narrower than `:12`, which routes every finishing reviewer through Workflow. The half references step 1 without describing it. Whether a read-only scout is review-class cannot be decided from `:80` alone. The `grep -a` flag is called load-bearing with no PowerShell equivalent named, and the byte-size read is the one instrument not spelled as a command. The unavailability definition names a cause the triggers are later said unable to conclude, and the cadence paragraph takes the first-turn reading only after the window closes beside a sentence settling it whenever taken. Line 7 of `docs/harness-assumptions.md` still says skill lines resolve at `9297097`, which sections 1, 3 and 4 have each re-aimed past without changing; it is recorded for finishing rather than set to a self-referential hash here.
Stamps: adjudicated 1, stamped 0; window 2h, covering the section since Chapter 4's close. Skipped: `forward-resource-arrangements-into-dispatch-briefs` in the operator tier, read after the fix round's brief was written, so it cannot have shaped what the brief forwarded.
Gate: targeted lane, the recipe's nine test files (SCOTT-CLAUDE, 2026-09-15 about 22:11Z, the close content unstaged over 558584f, no foreign heavy-process claim and this session's own claim held): 556 tests, 555 pass, 0 fail, 1 skipped, exit 0, read from the run's own exit code. Against the baseline recorded on this same nine-file lane before the section, 556/555/0/1 exit 0, no test moved and nothing regressed. The skip is the symlink probe case this box refuses at EPERM. The same lane read the same counts at first green over 558584f (21:28Z) and after the fix round (21:41Z).
Next: 5. Finishing-work, second half
Commit Model: Branch-and-PR
Delta: SCOTT-CLAUDE, 2026-09-15 22:12Z, worktree against HEAD 558584f, which carries the rewrite but not the fix round, the close pass or the `landed:` lines; the foreign `docs/plans/README.md` and `kaizen/notes-SCOTT-CLAUDE.md` changes and five untracked foreign files are among the unmeasured paths.

```
repository: claude-kit
plugins/claude-kit/skills/finishing-work/SKILL.md: 16378 words, cap 16378, +24
words: 853002 of cap 853002 across 86 curated files
test lines: 114603 of cap 114603 across 61 test files
tests: 3409
changed paths under no measured root: 8 (3 differing from HEAD, 5 untracked), which this tool does not measure and which no row above names; named-exclusion paths in the changeset: test/size-budget.json, which a root holds and no shape measures, so no row above names them
```

Diagnostic, `node tools/prose-shape.mjs` over LF copies in `.kit/scratch/claude-kit_prose-pass_spec_v1/4/`, taken with `git show` at the base ref `1fa25b3` and from the worktree at the close content (SCOTT-CLAUDE, 2026-09-15 about 22:12Z, exit 0). The first half runs from the file's start to the line before `## Steps`.

| File | Leg | Words | Paras | >120 | >200 | Longest para | Sentences | >30 | >45 | Longest sent |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| finishing-work, first half | base | 6603 | 18 | 13 | 11 | 1182 | 165 | 87 | 54 | 196 |
| finishing-work, first half | head | 6482 | 54 | 26 | 0 | 200 | 309 | 45 | 1 | 56 |
| finishing-work, whole | base | 16324 | 52 | 36 | 29 | 1535 | 477 | 221 | 113 | 196 |
| finishing-work, whole | head | 16203 | 88 | 49 | 18 | 1535 | 621 | 179 | 60 | 123 |

In the first half, sentences past 45 words fall from 54 to 1 and past 30 from 87 to 45, and paragraphs past 200 words fall from 11 to 0. The whole file's longest paragraph, its longest sentence and all 18 of its paragraphs past 200 words are in the Steps half, which is section 5's.

One sentence past 45 words stays in this half. The wedge hallmark's definition at `:40` is 56 words: "A dispatch is wedged when all three of these hold", then its three terms. It is one closed conjunction deciding one predicate, so splitting it would read as three separate tests.

Cut list, eight restatements, each with its survivor. Each cut was confirmed absent at head and each survivor present, by the implementer's grep over the LF copies and re-checked by the round 1 adversarial reviewer. Line numbers are the close content's.

1. The one-retry budget "whatever the two shapes". Survivors at `:88` and `:68`. Ledger: c1.C017 moves from rewrite to retire.
2. The ladder's record naming each dispatch's shape and the close-out surfacing the downgrade. Survivors at `:88`, `:100` and `:104`. Ledger: c1.C018 moves from rewrite to retire.
3. The dispatch record and the sidecar's `model` key answering what was requested. Survivors at `:18` and `:22`. No ledger entry keys this sentence; c1.C014 keys its survivor.
4. The clause routing an all-synthetic empty tally to the never-started paragraph. Survivors at `:32` and `:36`. c1.C031 keys both halves of this claim and stays at keep, since both survive.
5. "That pair is established by the never-started reading below, at its own artifact." Survivors at `:48`, `:58` and `:60`. No ledger entry.
6. The pair as the sole liveness reading once a probe is sent. Survivors at `:42` and `:50`. Ledger: c1.C079 moves from rewrite to retire.
7. A synthetic-only pair and a both-zero pair alike waiting for the window's close. Survivors at `:60`, `:74` and `:84`. c1.C085 keys half of this claim and stays at keep, since both halves survive.
8. The hallmark's shape staying unchanged while the reading and windows vary. Survivor at `:40`. No ledger entry.

Ledger: c1.C017, c1.C018 and c1.C079 move from rewrite to retire with their reasons naming the survivors' entries, and each `landed:` line now reads `558584f section 4` in place of the corpus rewrite's `d549e65 section 5`, since the preamble's `landed:` line names the commit that landed the passage and the retire landed at 558584f. The one `passage:` line, V001 at the Steps half's auto-merge text, is untouched. No parity assertion was re-aimed.

`Source:` lines: the eleven lines of `docs/harness-assumptions.md` that cite this half, fifteen citations, were re-aimed by content to `:22`, `:24`, `:26`, `:30`, `:46`, `:52`, `:54`, `:56`, `:58`, `:60`, `:68` and `:86`, and line 34's prose reference to the hallmark moved from the skill's line 18 to line 40. The round 2 reviewer opened all fifteen at the new lines.

Probe reading. `--touching 1fa25b3` selected three moments over 8 pairs: `branch-and-pr-pull-request-at-finishing`, `branch-and-pr-pull-request-at-section-close` and `merged-plan-branch-delete-on-an-armed-run`. After leg over the fix-round content, 21:44Z, under this session's own claim. Summary line, verbatim:

```
probe-corpus: 8 pairs, 0 mismatches (0 on proposed rulings, 0 designed), 3 errors, exit 0, tier sonnet, report .kit/probe-runs/2026-09-15T21-44-12-612Z/report.md
```

The report warned that 3 pairs produced no reading, so exit 0 said nothing about them. All three were `merged-plan-branch-delete-on-an-armed-run`, each failing with "OAuth session expired and could not be refreshed". The five pairs that read all match. That moment was re-run alone at 22:02Z: 3 pairs, 1 mismatch, 0 errors, exit 1, with `full` and `doctrine-plus-branch-hygiene` reading `match` and `doctrine-plus-output-style` reading `designed-agreed`, the counted status. The same pair run at the base, `--before 1fa25b3`, at 22:06Z read `designed`, exit 0. That shape reads only the doctrine and the output style, both byte-identical at base and head by `git diff --quiet`, and the two runs' prompt files are byte-identical, so the section moved nothing. This is the third run on unchanged text to read that pair two ways, and it stays recorded for finishing with `pre-send-checklist-after-an-authorized-push`.

### Chapter 6 - 2026-09-15
Completed: 5. Finishing-work, second half
Implemented By: implementer-fable at the fable override, with the round 2 Major fixed in the main thread
Metrics: review rounds 2, closed major-closed; provenance 2 spec-traceable, 1 fix-introduced, 0 new-requirement, rulings (0 refused, 0 declared, 0 asked); NEEDS_CONTEXT 0; escalations none; consults 0
Decisions / Surprises: The rewrite cut three sentences and one of them had to come back. `test/doctrine-parity.test.js` reads this half in many places, and no assertion was re-aimed: the two sentences that would have tripped the per-line integration sweep after a split were reshaped instead, which is what the Approach asks for. The size cap for the skill rose rather than fell, 16378 to 16426, which is the first raise of this pass: the restoration and the sentence splits add words while the shape falls hard, so the raise is the recipe working rather than the file growing. The probe pair read 8 pairs, 0 mismatches, 0 errors, exit 0 over the three moments `--touching e7f0c33` selects (branch-and-pr-pull-request-at-finishing, branch-and-pr-pull-request-at-section-close, merged-plan-branch-delete-on-an-armed-run), tier sonnet, run at 2026-09-15T23:13Z on SCOTT-CLAUDE under this session's own heavy-process claim; its one designed mismatch is not counted, per the runner's own rule.
Assumptions: none
Review Findings: review: full roster (2 readers) at fable, Agent tool; round 2 one adversarial lens at fable, Agent tool. Round 1 returned two Majors, both spec-traceable. The adversarial lens found that the cut of "The docs ship in the same PR as the code, never as a follow-up." contradicted entry S205's own recorded reason, which had ruled that sentence non-redundant, so the sentence was restored and S205 was reverted to its base verdict and reason. The prose lens found that "That is the gate this bullet runs" had lost its antecedent to the cut beside it and now read as the handoff gate, the opposite of the claim; it now names the whole gate over the updated branch outright. Round 2 returned one fix-introduced Major: the round 1 fix for a positional pointer at the probe rule had replaced it with a partial restatement that dropped the rule's own two bounds, so the sentence now points at the paragraph by its opening words and defers to its bounds. That last fix was made in the main thread and took an author re-read rather than a round. Minors: 12 fixed in the fix round, 0 upgraded, 3 left with the reason (the auto-merge paragraph, which is V001's `passage:` text verbatim and cannot be split without fragmenting a pinned passage across lines; the OPEN and ruleset paragraph, whose only order-preserving split strands two push actions on a line with no lane word; the prose-to-list conversions, ruled inside the recipe). The two blind readers' Majors are base-inherited: each string sits once at the base ref and once at head, so they are meaning questions rather than drift. Meaning questions: the hold window's closing moment is defined through two forward references, at :140 and :150; "the writing-style skill" at :148 matches two skills in this repository, `writing-skills` and `scott-writing-style`, while only the latter holds `references/ai-tells.md`; "No blind reviewer runs here" at :150 sits beside a sentence saying the blind reader is re-run when a document changed after its section review; the `Gate:` line fill at :211 happens after the archival `git mv` and the text does not say which path the edit lands on; "and the pass resumes at step 7" at :243 reads as re-entering the step the reader is inside; "Hard rule 2" at :253 names a numbered rule that branch-hygiene states as unnumbered bullets. Each is the base's, and none was changed. `docs/harness-assumptions.md` cites no line of this half: all 15 of its citations into this skill sit at lines 22 to 86, in the first half, so this section owed no `Source:` re-aim.
Stamps: adjudicated 2, stamped 2, both operator tier (`ask-the-coordinator-not-the-process-list`, `forward-resource-arrangements-into-dispatch-briefs`); project tier 0.
Gate: the nine-file targeted lane, 556 tests, 555 pass, 0 fail, 1 skipped, exit 0, read from the run's own exit code (SCOTT-CLAUDE, 2026-09-15 23:19Z, under this session's own heavy-process claim, no foreign claim live, the main checkout carrying five foreign dirty or untracked files). Baseline on this lane, 556/555/0/1 exit 0: unchanged. The one skip is the symlink case this box refuses at EPERM. The probe reading sits on the Decisions line above.
Next: 6. Coordinator
Commit Model: Branch-and-PR
Delta: measured on SCOTT-CLAUDE at 2026-09-15T23:20Z, over the worktree against HEAD c9435e8, with five foreign dirty or untracked files in the checkout.

```
repository: claude-kit
plugins/claude-kit/skills/finishing-work/SKILL.md: 16426 words, cap 16426, +52
plugins/claude-kit/skills/finishing-work/references/rationale-ledger.md: 72681 words, cap 72681, +7
words: 853050 of cap 853050 across 86 curated files
test lines: 114603 of cap 114603 across 61 test files
tests: 3409
changed paths under no measured root: 7 (2 differing from HEAD, 5 untracked), which this tool does not measure and which no row above names; named-exclusion paths in the changeset: test/size-budget.json, which a root holds and no shape measures, so no row above names them
```

### Chapter 7 - 2026-09-16
Completed: 6. Coordinator, first half
Implemented By: implementer-fable at the fable override, one dispatch; the round 1 fix round, the `docs/harness-assumptions.md` re-aim and the size sync in the main thread
Metrics: review rounds 2, closed major-closed; provenance 2 spec-traceable, 0 fix-introduced, 0 new-requirement, rulings (0 refused, 0 declared, 0 asked); NEEDS_CONTEXT 0; escalations none; consults 0
Decisions / Surprises: The rewrite covers lines 1 to 60 of the base, the half above `## The never-tasks-directly rule`, which moved from line 61 to line 131. Every line from that heading to the end is byte-identical to 035bc52 after CRLF normalization, 43 lines, `cmp` exit 0. Three sentences were cut and one had to come back: the omitted-count reading at base line 27, whose named survivor bound "its absence" to the re-arm race a paragraph earlier, so two lenses that shared no brief each found the bound dropped and it is restored verbatim at head line 41. The size cap rose rather than fell, 19867 to 19894, the restored sentence and three one-sentence reshapes costing 27 words; the implementer had trimmed the skill to sit exactly at the old cap, so the round 1 fixes took a cap sync. No parity assertion was re-aimed: the four paragraphs `test/doctrine-parity.test.js` slices to their own newline (head lines 28, 89, 95 and the last-act paragraph) stay one paragraph each, and the BLOCKED funnel's seven-key disposition sentence stays one sentence of 66 words because the test requires all seven keys inside one inner slice. The plan's section 6 entry names a container-noun check as reading this skill; that check (`RETIRED_FOOTING` in `test/doctrine-parity.test.js`) reads the executing-work and peer-sessions slices only, so section 7's brief should not repeat the premise. Ledger: `c1.C017` and `c1.C059` stay at `keep`, since each keys a claim that still has a carrier under the entry's own passage at head (line 16 for the heartbeat-only timer, lines 37 and 41 for the omitted count), on the precedent Chapter 5 set for `c1.C031` and `c1.C085`; the third cut, the keep-never-prune sentence at base line 47, has no keying entry and `c2.C038` keys its survivor at head line 105. No pointer conversion was needed. The probe pair over the one moment `--touching 035bc52` selects, `seat-asked-to-push-the-memory-store`, read two mismatches on the after leg, and the before leg at the base shows neither is this section's; the reading is below.
Assumptions: none
Review Findings: review: full roster (2 readers) at fable, Agent tool, round 1 over `git diff 035bc52 9c1d273`; round 2 one adversarial lens at fable, Agent tool, over `git diff 9c1d273 f7f5437`. Round 1 returned no Critical and two owed Majors, both spec-traceable to the Goal's no-claim-lost test: the blind reviewer and the prose reviewer independently found the omitted-count clause cut with its survivor bound to the wrong absence, restored verbatim; the prose reviewer found the claim-probe carve-out's "that sentence" now pointing at the re-derivation sentence rather than the never-polled reading, so it names "the never-polled sentence" by its own words. Round 2 returned no findings: it confirmed each fix restores the base's bound without adding a claim, the two re-aimed pointers name what the base's "that sentence" pointed at, the word delta is exactly the cap move, and no sliced paragraph or stamp window is disturbed. Minors: 3 fixed in the fix round (the source list's "begin with" opener, the claim file named ", another source", and "the send time the open line keys on"), 0 upgraded, 19 left with the reason at `.kit/scratch/claude-kit_prose-pass_spec_v1/minors-section-6.md`: two restore asks whose claims each have two carriers, the multi-point paragraphs at :28, :89 and :95 that the parity test slices whole and so cannot split, the plan:117 container-noun note recorded above, the ledger verdict adjudicated keep, a base-inherited contrast-density note, and 13 blind-reader referent findings each present verbatim at the base by grep. The close pass fixed nothing further. Meaning questions, all present at base and carried for the program's step 4: "silently stale" at :28 decides neither reading; what closes an escalation is past the cut at :63; the "does record" contrast at :35; the "dead conjunct" opener at :113; "the two machine stamps" at :95 unnamed; "safety arm" at :16 unglossed; a hostname past the memq cap at :10 undisposed; why the last plan records nothing at :41; two sources for one cadence at :99 and :101; "reconciliation guard above" at :123 unnamed; "the decider" at :95 with no antecedent; how a repo is resolved from disk at :28 and :43; `deny-interactive` at :129 unintroduced; and the BLOCKED funnel's "`ts` the dedup key at the bound stated below" naming a bound the funnel never states under that name. `docs/harness-assumptions.md:143` is the one citation into this half, re-aimed from `:33` to `:67`, both the update-window paragraph whose stale-cache sentence carries the belief.
Stamps: adjudicated 1, stamped 0; window 3h, covering the section since Chapter 6's close. Skipped: `an-unchallenged-claim-drifts-because-nothing-exercises-it` in the project tier, read 51 minutes before the sweep; nothing this section built keyed on it, the ledger keep ruling resting on carriers found by grep rather than on that record.
Gate: the nine-file targeted lane, 556 tests, 555 pass, 0 fail, 1 skipped, exit 0, read from the run's own marker file (SCOTT-CLAUDE, 2026-09-16 00:16Z, under this session's own heavy-process claim, no foreign claim live, the main checkout carrying seven foreign dirty or untracked files, the skill at f7f5437's content). Baseline on this lane, 556/555/0/1 exit 0 at section 5's close: unchanged. The one skip is the symlink case this box refuses at EPERM. The probe reading sits below the diagnostic.
Next: 7. Coordinator, second half
Commit Model: Branch-and-PR
Delta: measured on SCOTT-CLAUDE at 2026-09-16T00:38Z, over the worktree against HEAD 245ed39, which already carries the rewrite, the fix round and the cap sync, so no skill row prints; seven foreign dirty or untracked files in the checkout.

```
repository: claude-kit
words: 853077 of cap 853077 across 86 curated files
test lines: 114603 of cap 114603 across 61 test files
tests: 3409
changed paths under no measured root: 7 (2 differing from HEAD, 5 untracked), which this tool does not measure and which no row above names; named-exclusion paths in the changeset: none
```

Diagnostic, `node tools/prose-shape.mjs` over LF copies in `.kit/scratch/claude-kit_prose-pass_spec_v1/6/`, the base taken with `git show 035bc52:` and the head from the worktree at the close content (SCOTT-CLAUDE, 2026-09-16 00:20Z, exit 0). The first half is base lines 1 to 66 and head lines 1 to 130, so the two halves are not the same text and the whole-file rows are the like-for-like comparison.

| File | Leg | Words | Paras | >120 | >200 | Longest para | Sentences | >30 | >45 | Longest sent |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| coordinator, first half | base | 10076 | 33 | 23 | 17 | 1883 | 239 | 133 | 82 | 318 |
| coordinator, first half | head | 9338 | 65 | 37 | 7 | 717 | 451 | 72 | 1 | 66 |
| coordinator, whole | base | 19844 | 56 | 40 | 31 | 1883 | 441 | 267 | 167 | 356 |
| coordinator, whole | head | 19871 | 91 | 56 | 22 | 1582 | 668 | 215 | 91 | 356 |

In the first half, sentences past 45 words fall from 82 to 1 and past 30 from 133 to 72, and paragraphs past 200 words fall from 17 to 7. The seven paragraphs still past 200 words include the four the parity test slices whole. The whole file's longest paragraph and longest sentence are now in the second half, which section 7 takes.

Cut list, three restatements, one restored. Line numbers are the close content's.

1. "The heartbeat is the only timer running either way", base line 10. Survivors at `:16` ("with one timer standing behind the events", "Beyond that heartbeat the seat arms no one-shot in either state") and `:152` in the unchanged half. Ledger: `c1.C017` stays keep.
2. The omitted-count reading, base line 27. Cut by the implementer, found dropped by two lenses, restored verbatim at `:41`. Ledger: `c1.C059` stays keep.
3. "Each of those readings can only keep an entry, never prune one", base line 47. Survivors at `:105` ("An unknown entry is not pruned") and `:121`. No keying entry; `c2.C038` keys the survivor.

Em dash sweep over the skill and `docs/harness-assumptions.md`: 0 and 0, with a control line built in the same command reading 1.

Probe reading. `--touching 035bc52` selects one moment, `seat-asked-to-push-the-memory-store`, whose `full` shape reads this skill and whose other two shapes do not. After leg over the close content, 00:17Z to 00:26Z, under this session's own claim. Summary line, verbatim:

```
probe-corpus: 3 pairs, 2 mismatches (0 on proposed rulings, 0 designed), 0 errors, exit 2, tier sonnet, report .kit/probe-runs/2026-09-16T00-17-07-465Z/report.md
```

`full` and `doctrine-plus-role` read `decline-and-route-to-the-operator` against the ruling `pull-rebase-and-push-the-store`; `doctrine-plus-memory-system` matches. The before leg at the base, `--before 035bc52 --only seat-asked-to-push-the-memory-store`, 00:27Z to 00:37Z, read `probe-corpus: 3 pairs, 1 mismatches (0 on proposed rulings, 0 designed), 1 errors, exit 1`, with one warning that a pair produced no reading: `full` reads `decline-and-route-to-the-operator` at the base too, `doctrine-plus-role` timed out at 300 seconds, and `doctrine-plus-memory-system` matches. So the `full` mismatch predates this section, and `doctrine-plus-role` reads the doctrine and the role skill alone, neither of which this section touched, so nothing it reads moved. Both are recorded for finishing as a ruled moment whose two widest shapes read against the ruling on unchanged text.

<!-- chapter-slot 7 -->

<!-- chapter-slot 8 -->

<!-- chapter-slot 9 -->

<!-- chapter-slot 10 -->

<!-- chapter-slot 11 -->

<!-- chapter-slot 12 -->

<!-- chapter-slot 13 -->

<!-- chapter-slot 14 -->

<!-- chapter-slot 15 -->

<!-- chapter-slot 16 -->

### Interim board 1 - 2026-09-15

Section 0 stage: step 4, held on an ASK. First green landed at 128e0f1 on `prose/00-the-instrument-the-baseline-and-the-slots`. Review round 1 ran the adversarial and blind reviewers at fable through the Agent tool. The adversarial reviewer's Major, the missing `test/size-budget.json` cap for `test/prose-shape.test.js`, is fixed by folding the budget file into the section: its Files in scope line now names it. Twelve Minors wait for the close pass.

Held: two blind-reviewer Majors against `tools/prose-shape.mjs:57`. Finding 1: a sentence opening with a quote, bracket, underscore or digit merges into the one before it. Finding 2: a terminator inside a closing quote or parenthesis never ends a sentence. Both read as new-requirement. The KIT: Expert ask went unanswered, and the scope-adjudicator ruled ASK on each, on the test "changes a decision the plan recorded", recommending both be taken now. The pre-BLOCKED consult ruled widen both now, before any Chapter measures under the unit, and found no preference fork, only the authority question. Measured with a scratch variant over the 23 in-scope files: 4421 to 4430 sentences, 1672 to 1671 past 30 words; the nine new boundaries are all real sentence ends. Waits on: the operator's yes or no to editing the Approach's recorded sentence unit.

Live dispatches: none. Gate baseline (targeted lane, SCOTT-CLAUDE, 2026-09-15 around 13:40Z, contention: a foreign heavy-process claim held by supervisor-dev for agent_persona, run unclaimed as a sub-second suite): `node --test test/prose-shape.test.js` 19 tests, 19 pass, 0 fail, exit 0; `node --test test/size-ratchet.test.js` 98 tests, 98 pass, 0 fail, exit 0 after the fold, 97 pass and 1 fail before it.

Next action on a yes: widen `SENTENCE_END` to the ruling's form, restate the Approach's sentence unit, move the two locks that pin the old behavior, add a lock per finding, then take the close pass, the close gate, the baseline re-derivation and Chapter 0. On a no: record both findings as a known limitation of the unit in the tool's header and proceed the same way.

### Interim board 2 - 2026-09-15

Section 0 is closed: Chapter 1 above, commit 7981da6, pull request 29 open against `main`, ready, auto-merge not armed. The operator answered yes to widening the sentence unit on the relay thread, and that decision, its reason and its record are in Chapter 1 and in the new `## Standing Brief Amendments` block.

Section 1 stage: step 1, the implementer writing. Branch `prose/01-the-doctrine-and-the-output-style` is cut from section 0's branch at 7981da6 and carries no commit yet. A read-only scout extracted the parity pins to `.kit/scratch/claude-kit_prose-pass_spec_v1/1/doctrine-pins.md`: 25 tests in `test/doctrine-parity.test.js` and 12 in `test/output-style-parity.test.js` read a doctrine copy or the output style, and the other four tests in the targeted lane read neither.

Live dispatches: `implementer-fable` at the fable override, rewriting the doctrine source, the `home/` mirror, the output style and the operating-instructions ledger, with the two parity tests in scope for re-aims only. Its brief withholds every write under `docs/`: it returns the eleven `docs/harness-assumptions.md` `Source:` re-aims in its report and the main thread places them. The paid probe before leg (`node tools/probe-corpus/run.mjs --before 7981da6`, all 39 pairs, the whole ruled set as section 1 requires) runs beside it under this session's own heavy-process claim, network-bound per the runner's README, and the implementer's brief clears its test runs to proceed beside that claim.

Gate baseline for section 1 (targeted lane, SCOTT-CLAUDE, 2026-09-15 14:05Z to 14:06Z): 577 tests, 576 pass, 0 fail, 1 skipped, exit 0, the skip being the symlink probe case this box refuses at EPERM. Diagnostic baseline: the doctrine at 444 sentences, 121 past 30 words, 51 past 45, 108 paragraphs, 13 past 200; the output style at 84 sentences, 8 past 30, 4 past 45, 39 paragraphs, 1 past 200.

Next action: read the implementer's diff and report, run review round 1 as the section's `Audience:` line summons it (the code pair plus the document pair, two blind readers and the prose reviewer), run the probe after leg, place the `Source:` re-aims, then close section 1 on its own stacked pull request based on section 0's branch.

### Interim board 3 - 2026-09-15

Section 1 stage: step 3, review round 1 in flight, three lenses back and two out. The implementer returned DONE_WITH_CONCERNS and its work is verified and committed at first green, `5e3567d` on `prose/01-the-doctrine-and-the-output-style`, which is pushed.

What landed at first green: the doctrine source, the `home/` mirror, the output style and `test/size-budget.json`. Six long bullets gained sub-bullets under unchanged leads, eleven lines in all and none of them a register-core bullet. Four restatements were cut, each with its survivor named. No parity assertion was re-aimed, so both parity tests are untouched, and the operating-instructions ledger is byte-identical: all four cuts restate a claim whose ledger entry still has a passage carrying it, which this session confirmed by reading `c1.C043` and `c1.C027` rather than taking the implementer's word. That ledger holds zero `passage:` lines, matching the Sweep result, so none was owed.

Live dispatches: `adversarial-reviewer` and `prose-reviewer`, both at the fable override through the Agent tool. The adversarial lens carries the spec path, the base ref `7981da6`, the section name, the `Amendments in effect:` line, the `Trace target:` line and the four-entry cut list to trace. The prose lens carries the full Document Review Brief with the base ref's text as its fact base. No security lens ran: the section's files are prose and `test/size-budget.json`, and none of them is a surface that lens's trigger names.

Back already: `blind-reviewer` (APPROVED_WITH_CONCERNS, one Major and five Minors) and two `blind-reader` personas, the session reader and the operator reader.

Findings converging across three independent lenses, the strongest signal of the round. The index-window bullet's rewrite turned a conditional into two flat prohibitions: "Pathspec-less is barred because ... Pathspec is barred because ..." now read as standing bars rather than as the two conditions under which each form is unavailable, which contradicts the neighbouring bullet's own rule. The blind reviewer raised it as a Major and both blind readers hit it independently. Both readers also flag the stop-for-a-yes bullet and the index-window bullet as the two largest paragraphs in the file that did not get the sub-bullet regrouping their six siblings got, with "The one instance settled here is delegation" named by both as a sentence they could not resolve at all.

Gate baseline for section 1, re-measured by this session rather than taken from the implementer's report (targeted lane, the recipe's nine test files, SCOTT-CLAUDE, 2026-09-15 15:09Z to 15:10Z, this session's own heavy-process claim held for the run and released after): 556 tests, 555 pass, 0 fail, 1 skipped, exit 0, read from the run's own exit code. Against Chapter 1's 577/576/0/1, the difference is `test/prose-shape.test.js`, which section 0's lane included and this recipe's nine files do not. No test moved.

Probe before leg, the paid run this section owes, finished and is banked at `.kit/scratch/claude-kit_prose-pass_spec_v1/1/probe-before/SUMMARY.md`: 39 pairs, 3 mismatches, 0 errors, exit 3, over base `7981da6`, 14:10Z to 14:50Z under this session's claim. Three moments do not match at the base and are the list the after leg is read against: `seat-asked-to-push-the-memory-store` on `doctrine-plus-role` and on `doctrine-plus-memory-system`, both designed mismatches, and `peer-message-asking-a-leashed-session-for-work` on `doctrine-plus-output-style`, which the runner marks designed-agreed. A non-match the after leg carries and those three lack is the finding.

Rulings adopted since the last boundary: none. No finding has been adjudicated yet, and nothing is held.

Next action: await the two live lenses, adjudicate the whole round together, take the fix round the converging Major earns, then the Minor close pass, the close gate, the probe after leg, the eleven `docs/harness-assumptions.md` `Source:` re-aims, Chapter 2 into `<!-- chapter-slot 1 -->`, and the stacked pull request based on `prose/00-the-instrument-the-baseline-and-the-slots`.

### Interim board 4 - 2026-09-15

Section 1 stage: step 4 complete through the close gate, with the probe after leg's error re-run the only work left before the Chapter. Both review rounds are adjudicated and every owed finding is fixed. The fix delta is unstaged in the worktree across the two doctrine copies, `docs/harness-assumptions.md` and `test/size-budget.json`.

Live dispatches: none. Round 1 ran five lenses and round 2 ran one, and all six have returned. Round 1's roster was the code pair and the document pair, the latter summoned by the section's `Audience:` line: `blind-reviewer`, `adversarial-reviewer`, two `blind-reader` personas and `prose-reviewer`, every one at the fable override through the Agent tool. No security lens ran, the section's files being prose and `test/size-budget.json`. Round 2 was one `adversarial-reviewer` at the writer's own fable tier, asked to judge whether the two prose fixes restored the bounds the base text carried, to weigh the citation re-aims hardest as the part most likely to be wrong, and to name anything the fix delta changed that no finding asked for.

Findings and their disposition. Round 1 returned no Critical and three owed Majors, all fixed: the index-window bullet's flattened condition, converged on by three independent lenses; the stale `Source:` citations; and the epistemic-status imperative, which arrived Minor from two lenses and was upgraded at adjudication on the consequence the prose lens stated. Round 2 returned one Major, fix-introduced, on my own re-aim of the SendMessage citation, which pointed at a bullet carrying no delivery-timing claim; the doctrine states that fact at no ref, so the citation was dropped rather than re-aimed. One round-2 Minor was folded and one left with its reason. Four Minors are left unfixed at `.kit/scratch/claude-kit_prose-pass_spec_v1/minors-section-1.md`, each a prose restructure whose subject no test reads, so each would owe a round under the fix-delta bar's judgment clause and the close pass never owes one.

Gate: close gate green on the targeted lane, the recipe's nine test files (SCOTT-CLAUDE, 2026-09-15 15:36Z to 15:37Z, run unclaimed after supervisor-dev's claim for agent_persona passed its declared 300 seconds, waited out to that declaration and then proceeded past with the holder told on the peer channel, and this session's own probe-corpus run live on the network beside it): 556 tests, 555 pass, 0 fail, 1 skipped, exit 0, read from the run's own exit code, against the 556/555/0/1 baseline recorded on that same lane at 15:09Z. The lane went red once first on the size cap alone, 10590 words against 10587; the caps are synced to 10590 and the green is the re-run.

Probe after leg, 15:24Z to 16:05Z, 39 pairs: `probe-corpus: 39 pairs, 0 mismatches (0 on proposed rulings, 3 designed), 3 errors, exit 0`. The exit code is not a reading of this run. The runner's own warning says so: three pairs produced no reading at all and the exit code counts mismatches only. All three are `seat-asked-to-push-the-memory-store`, each a `spawnSync ... ETIMEDOUT` at 300 seconds, and all three matched at the base, so they are re-running now under `--only`.

A correction to interim board 3, which recorded the before leg's baseline wrongly. That entry named `seat-asked-to-push-the-memory-store` on `doctrine-plus-role` and on `doctrine-plus-memory-system` as two of the three non-matching rows at the base. Those two matched at the base. The before leg's three non-matching rows are all on the `doctrine-plus-output-style` shape: `compaction-nudge-mid-section-with-no-checkpoint-open`, `merged-plan-branch-delete-on-an-armed-run` and `peer-message-asking-a-leashed-session-for-work`, read from rows 21, 28 and 31 of the before run's own `report.md`. The banked `SUMMARY.md` is corrected and carries the correction in its own text.

Read against that corrected baseline, the after leg carries one change and no new moment. `compaction-nudge` and `merged-plan-branch-delete` read exactly as they did at the base. `peer-message-asking-a-leashed-session-for-work` on `doctrine-plus-output-style` moved from `designed-agreed` to `designed`: the action read is the same, `decline-and-route-to-the-operator`, and the verdict label moved from `RESOLVED` to `CONTESTED`. Same decision, weaker resolution, which is the finding this section owes a disposition for.

Rulings adopted since the last boundary: none. No finding was held, none went to a judge, and no consult was convened.

Next action: read the error re-run, dispose of the `peer-message` reading, then Chapter 2 into `<!-- chapter-slot 1 -->`, the close commit, the push, and `gh pr create --base prose/00-the-instrument-the-baseline-and-the-slots`, marked ready, auto-merge never armed. Then section 2.

### Interim board 5 - 2026-09-15

Section 1 is closed: Chapter 2 above, close commit 758e064, pull request 30 open against `main`, ready, auto-merge not armed. Section 0's branch was deleted when pull request 29 merged, so pull request 30 is based on `main` and says so in its body.

Section 2 stage: step 1, implementer dispatched a second time. Branch `prose/02-executing-work-first-half` is cut from 758e064 and carries no commit yet. The section's first half is lines 1 to 403 of the skill; line 404 opens step 4.

The first `implementer-fable` dispatch wedged and was stopped. Its 42 turns all resolved at `claude-fable-5-1`. Its last turn, at 16:48:36Z, issued a Bash call whose result never came back, and no shell process from that call survived on the box. Its transcript stayed flat for 55 minutes. A liveness probe sent at about 17:29Z went unanswered through a 15-minute window, with the turn count still at 42, so the whole wedge hallmark held and it was stopped at 17:44Z. It had written no in-scope edit, only restore copies under `.kit/scratch/`. The operator named the cause on the thread: account swaps under a rate limit. This session's account address changed across the compaction, which agrees. This is an environment fault rather than a failed round, so it counts against neither the review ladder nor the same-tier bar.

Live dispatches: the re-dispatch, `implementer-fable` at the fable override, on the same brief plus an instruction to keep each shell call small. It is the one same-tier re-attempt a wedge allows; a second stop on this tier takes the stall raise, since the section is fable-tier.

Pins: a read-only scout extracted every test assertion reading this skill to `.kit/scratch/claude-kit_prose-pass_spec_v1/2/executing-work-pins.md`. Nine sit in the first half, eight in `test/doctrine-parity.test.js` and one in `test/kit-goal-stop.test.js`, and one sweep reads the whole file. Two were confirmed by direct read. The ledger's two `passage:` pins, `V001` and `V002`, both sit in this half, and `V002`'s is already stale against HEAD.

Probe before leg is incomplete and owed. The ten moments whose shapes name the skill select 27 pairs. The run at 16:43Z read 2 pairs, both `match`, and lost the other 25 to `reader exited 1: You've hit your session limit · resets 3:10pm (America/New_York)`, each refused in about 1.3 seconds. It exited 0, and the runner's own warning says that 0 reports nothing about those 25 pairs. The re-run is owed after the limit resets. It reads at `--before 758e064`, so its timing does not change what it measures. The reading is banked at `.kit/scratch/claude-kit_prose-pass_spec_v1/2/probe-before/SUMMARY.md`.

Gate baseline for section 2: the recipe's nine-file targeted lane read 556 tests, 555 pass, 0 fail, 1 skipped, exit 0 at 758e064 (SCOTT-CLAUDE, 2026-09-15 15:36Z, Chapter 2's close gate), and nothing on that lane has changed since. Diagnostic base, over a copy at 758e064 (SCOTT-CLAUDE, 2026-09-15 16:33Z): the whole skill reads 21748 words, 114 paragraphs, 27 past 200, 645 sentences, 313 past 30, 154 past 45; lines 1 to 403 read 10203 words, 65 paragraphs, 15 past 200, 338 sentences, 147 past 30, 60 past 45.

Rulings adopted since the last boundary: none.

Foreign state named and left: `kaizen/notes-SCOTT-CLAUDE.md` carries one uncommitted line written by `supervisor-dev`, which this session does not stage.

Next action: take the re-dispatch's first-turn reading, await it, verify its diff, then review round 1, the probe re-run after the reset, the after leg, the `Source:` re-aims, Chapter 3 into `<!-- chapter-slot 2 -->`, and the stacked pull request based on `prose/01-the-doctrine-and-the-output-style`.

### Interim board 6 - 2026-09-15

Section 2 stage: step 4 complete through the close gate. The probe pair is the only work left before Chapter 3. The branch carries interim board 5 (47fd04a), the first-green commit 9dc98d6 and the review-fix commit 23c0c9e, all three pushed except 23c0c9e and this board, which push together.

The re-dispatched implementer returned DONE_WITH_CONCERNS after 23 minutes. Its one concern was the ledger's size cap, which the size sync answered. Its diff was verified here rather than accepted. The second half, from the line opening `4. **Address findings.**`, is identical to 758e064 once CRLF is normalized to LF: the worktree checks out CRLF under `core.autocrlf true` while the blob is LF, which is the whole 114-byte difference a raw byte compare shows. The whole suite at the first-green tree read 3503 tests, 3491 pass, 0 fail, 12 skipped, exit 0 (SCOTT-CLAUDE, 2026-09-15 18:16Z, 47fd04a plus the section's unstaged work).

Diagnostic at 23c0c9e, over LF copies (SCOTT-CLAUDE, 2026-09-15 18:40Z): the whole skill reads 21644 words, 158 paragraphs, 16 past 200, 837 sentences, 243 past 30, 95 past 45. The first half reads 10099 words, 109 paragraphs, 4 past 200, 530 sentences, 77 past 30, 1 past 45. The one sentence past 45 is the security-reviewer trigger enumeration in step 3, 46 words.

Review: three rounds, all at fable. Round 1 ran the full roster, the code pair over the ledger and size budget and the document pair over the skill. Round 2 and round 3 ran the adversarial lens alone over the fix delta against 9dc98d6. Round 3 returned no Major, which ends the loop. The adjudication record, every finding with its disposition and reason, is at `.kit/scratch/claude-kit_prose-pass_spec_v1/2/round-1-adjudication.md`, and Chapter 3 carries it. Two points worth carrying now. The prose reviewer's Critical on the all-zero digest tell was adjudicated Major: a wrong narrowing in a diagnostic tell whose full cause list is one pointer away. And two of this session's own calls were wrong and conceded: re-aiming citations to a "nearest carrying line", and editing a keep entry's reason line, which plan line 194 puts out of scope.

Close gate: the recipe's nine-file targeted lane read 556 tests, 555 pass, 0 fail, 1 skipped, exit 0 (SCOTT-CLAUDE, 2026-09-15 18:33Z, 23c0c9e's content unstaged), matching the baseline above.

Probe: the account allowance is back. A one-moment test run at 18:33Z read `commit-and-push-at-section-close` at 758e064, three pairs, all `match`, 0 errors, exit 0, report `.kit/probe-runs/2026-09-15T18-33-51-400Z/report.md`. The before leg over the other nine moments is running under this session's heavy-process claim. The after leg over all ten follows it.

Live dispatches: none.

Rulings adopted since the last boundary: none.

Foreign state named and left: `kaizen/notes-SCOTT-CLAUDE.md` still carries `supervisor-dev`'s uncommitted line.

Next action: read the before leg, run the after leg over the ten moments, compare the pairs, then Chapter 3 into `<!-- chapter-slot 2 -->`, the close commit, the push, and `gh pr create --base prose/01-the-doctrine-and-the-output-style`, marked ready, auto-merge never armed. Then section 3, whose brief carries the reader findings the round logged against the second half.

### Interim board 7 - 2026-09-15

Section 2 is closed: Chapter 3 above, close commit c706553, pull request 31 open against `main`, ready, auto-merge not armed. Pull request 30 had merged at 16:50Z and its branch was deleted, so pull request 31 is based on `main`, where 758e064 is an ancestor and the three-dot diff names only section 2's five files.

Section 3 stage: step 1, brief being written, no dispatch yet. Branch `prose/03-executing-work-second-half` is cut from c706553 and carries no commit yet. The second half runs from line 478, `4. **Address findings.**`, to line 591. The `KIT-CLAIM-CLASS` region sits at lines 480 to 482 of the skill, at 61 to 63 of the adversarial reviewer's charter and at 56 to 58 of the blind reviewer's; `test/claim-class-parity.test.js` dedents each region before comparing, so the skill's copy keeps its list indent. The scout's pin extract at `.kit/scratch/claude-kit_prose-pass_spec_v1/2/executing-work-pins.md` marks the second-half pins, at 758e064's line numbers, which sit 74 lines lower at c706553. No ledger `passage:` line points into the second half: the ledger holds two, V001 and V002, both in the first half. Five `Source:` citations in `docs/harness-assumptions.md` point into it, at :537, :539, :553 twice and :559.

Probe before leg for section 3: section 2's after leg is taken as this section's before leg, and no second paid run is made. That run read the worktree at 18:57Z, whose bytes differed from c706553 only in the plan doc and in `kaizen/notes-SCOTT-CLAUDE.md`. Every path a probe shape reads was listed from `test/probes/` (116 entries, all under `plugins/claude-kit/`, their counts matching the Approach's tally of 30, 19 and 17), and neither of those two files is among them. The ten moments naming the skill include `review-round-returning-only-claim-majors`, the one shape reading the adversarial reviewer's charter, so the ten cover every file section 3 touches that a shape reads.

Diagnostic base at c706553, over `git show` copies (SCOTT-CLAUDE, 2026-09-15 about 19:40Z): the second half reads 11545 words, 49 paragraphs, 12 past 200, longest 2059, 307 sentences, 166 past 30, 94 past 45, longest 173. The adversarial reviewer's charter reads 3454 words, 7 paragraphs past 200, 115 sentences, 47 past 30; the blind reviewer's 1363 words, 2 past 200, 71 sentences, 11 past 30.

Gate baseline for section 3: Chapter 3's close gate, the nine-file lane at 556/555/0/1 exit 0 (SCOTT-CLAUDE, 2026-09-15 18:33Z), whose tree differs from c706553 only in the plan doc, confirmed by `git diff --name-only 23c0c9e c706553`.

Live dispatches: none. Rulings adopted since the last boundary: none. The journal now carries section 2's close and its probe re-run.

Foreign state named and left: `kaizen/notes-SCOTT-CLAUDE.md` still carries `supervisor-dev`'s uncommitted line.

Next action: dispatch `implementer-fable` at the fable override on section 3's brief, carrying the second-half reader findings from round 1 of section 2, then verify, review round 1, the after leg over the ten moments, the five `Source:` re-aims, Chapter 4 into `<!-- chapter-slot 3 -->`, and the pull request based on `main` if pull request 31 has merged by then, else on `prose/02-executing-work-first-half`.

### Interim board 8 - 2026-09-15

Section 3 stage: step 1, the implementer writing. Interim board 7 is pushed on `prose/03-executing-work-second-half` at 139fb64. This entry answers the compaction nudge and records no ruling.

Live dispatches: one `implementer-fable` at the fable override, dispatched at about 19:30Z on the brief at `.kit/scratch/claude-kit_prose-pass_spec_v1/3/brief.md`. It was asked to rewrite the skill from `4. **Address findings.**` to the end, and to rewrite the `KIT-CLAIM-CLASS` region once and land it in the skill and in the adversarial and blind reviewer charters. It must leave lines 1 to 477 and the charters outside the region byte-identical, and it returns the cut list, pointer conversions with their owners' lines, re-aims, meaning questions, byte-identity proofs, the lane's counts and the new line numbers of the five cited passages. Its first-turn reading, taken past the five-minute window, read 50 assistant lines, all at `claude-fable-5-1`, so it started. At 19:47Z its transcript read 96 assistant lines, and the skill reads modified in the worktree.

Gate baseline: unchanged from interim board 7, the nine-file lane at 556/555/0/1 exit 0 (SCOTT-CLAUDE, 2026-09-15 18:33Z).

Rulings adopted since the last boundary: none.

Foreign state named and left: `kaizen/notes-SCOTT-CLAUDE.md` still carries `supervisor-dev`'s uncommitted line.

Next action: await the implementer, verify its diff, then review round 1, the after leg over the ten moments under this session's claim, the five `Source:` re-aims, the size sync, Chapter 4 into `<!-- chapter-slot 3 -->`, and the pull request based on `main` if pull request 31 has merged, else on `prose/02-executing-work-first-half`.

### Interim board 9 - 2026-09-15

Section 3 stage: step 4, round 1 adjudicated and fixed, round 2 in flight. The implementer returned DONE after 32 minutes. Its work was verified here and committed at first green, 99fd86a: the first 477 lines of the skill are identical to 139fb64 by LF-normalized compare, no added line holds an em dash, and the nine-file lane read 556/555/0/1 exit 0 (SCOTT-CLAUDE, 2026-09-15 20:04Z, under this session's claim). The round 1 fixes, the five `Source:` re-aims and the size sync are committed at f8440bb, and both commits are pushed.

Round 1 ran the full roster at fable through the Agent tool: the adversarial reviewer, the blind reviewer, two blind readers and the prose reviewer. Two owed Majors, both fixed, both spec-traceable against the Goal's no-claim-lost test. The adoption trigger's example list had become a closed definition. The fold predicate's three tests had come apart from the predicate they define. Five Minors were fixed in the same delta and four left with the reason. The full record is at `.kit/scratch/claude-kit_prose-pass_spec_v1/3/round-1-adjudication.md`. The size sync raised the skill's cap by 18 words and each charter's by 3, all from the restored bounds, which Chapter 4 records as a finding on a cutting section.

Live dispatches: one `adversarial-reviewer` at fable, round 2, over `git diff 99fd86a f8440bb`, asked whether each fix restored the base's bound without adding a claim, whether the re-aims point at lines stating their beliefs, and whether the delta changed anything no finding asked for.

Gate baseline: the nine-file lane at 556/555/0/1 exit 0 over the fix round's tree (SCOTT-CLAUDE, 2026-09-15 20:14Z, under this session's claim).

Rulings adopted since the last boundary: none.

Foreign state named and left: `kaizen/notes-SCOTT-CLAUDE.md` still carries `supervisor-dev`'s uncommitted line.

Next action: adjudicate round 2, then the close pass, the close gate, the after leg over the ten moments under this session's claim, the diagnostic rows, the `landed:` lines for T099 and S071, Chapter 4 into `<!-- chapter-slot 3 -->`, and the pull request based on `main` if pull request 31 has merged, else on `prose/02-executing-work-first-half`.


### Interim board 10 - 2026-09-15

Section 3 stage: closed. Chapter 4 is above, the close commit is cee5e37 on `prose/03-executing-work-second-half` and it is pushed. Its pull request is NOT open: the kit's `pr-docs-guard` refuses to open one while `docs/` carries uncommitted changes, and this checkout carries three that are the `coordinator` session's, the two plan docs it queued on 2026-09-15 (`claude-kit_plugin-cache-sweep_spec_v1.md` and `claude-kit_relay-channel-standing_spec_v1.md`, both untracked) and the two matching index entries in `docs/plans/README.md`. They are not this session's to commit. The coordinator was asked over the peer channel to land them; it was idle at the ask and had not acted as of 21:05Z. The pull request opens against `main`, since pull request 31 merged at 20:27Z, and a check of both diff forms shows the branch differs from `main` by section 3's work alone, 7 files and 212 insertions.

Section 4 stage: step 1, implementer dispatched. Branch `prose/04-finishing-work-first-half` is cut from cee5e37. The base row for its half, lines 1 to 41 of `plugins/claude-kit/skills/finishing-work/SKILL.md`, is 6603 words, 18 paragraphs, 11 past 200, longest paragraph 1182, 165 sentences, 87 past 30, 54 past 45, longest sentence 196.

Live dispatches: one `implementer-fable` at the fable override, on the brief at `.kit/scratch/claude-kit_prose-pass_spec_v1/4/brief.md`, asked to rewrite lines 1 to 41 of the finishing-work skill under the three bars, to leave line 42 onward byte-identical, and to write the ledger's retire verdicts without their `landed:` lines.

Gate baseline: the nine-file lane at 556/555/0/1 exit 0 (SCOTT-CLAUDE, 2026-09-15 20:23:59Z to 20:24:47Z, over the tree section 3 closed on, under this session's own heavy-process claim, no foreign claim live).

Rulings adopted since the last boundary: none.

Foreign state named and left: `kaizen/notes-SCOTT-CLAUDE.md` carries `supervisor-dev`'s uncommitted line, and the three `docs/plans/` changes above are the coordinator's. Four untracked `.agentic-*` files sit at the repository root.

Next action: take the implementer's first-turn reading, then await it; open section 3's pull request the moment `docs/` goes clean, since that is the one step section 3 still owes.

### Interim board 11 - 2026-09-15

Section 3 stage: closed and pushed at cee5e37. Its pull request is still not open, held by `pr-docs-guard` on the same three coordinator files in `docs/plans/` that interim board 10 names.

Section 4 stage: closed. Chapter 5 is above, and the close commit is 785fd80 on `prose/04-finishing-work-first-half`, pushed. Its stacked pull request, base `prose/03-executing-work-second-half`, is held on the same guard.

Section 5 stage: step 1, implementer dispatched. Branch `prose/05-finishing-work-second-half` is cut from 785fd80. The base row for its half, lines 114 to 184 of `plugins/claude-kit/skills/finishing-work/SKILL.md` at 785fd80, is 9721 words, 34 paragraphs, 18 past 200, longest paragraph 1535, 312 sentences, 134 past 30, 59 past 45, longest sentence 123.

Live dispatches: one `implementer-fable` at the fable override, on the brief at `.kit/scratch/claude-kit_prose-pass_spec_v1/5/brief.md`, asked to rewrite the Steps half under the three bars, to leave lines 1 to 113 byte-identical, to keep V001's `passage:` line verbatim with whatever text the passage ends in, and to write retire verdicts without their `landed:` lines. Its first-turn reading was 53 assistant lines, so it started. Its transcript was still growing at 2026-09-15 22:3xZ.

Gate baseline: the nine-file lane at 556/555/0/1 exit 0, recorded on this lane at section 4's close over the tree 785fd80 carries (SCOTT-CLAUDE, 2026-09-15).

Rulings adopted since the last boundary: none.

Foreign state named and left: `kaizen/notes-SCOTT-CLAUDE.md` carries `supervisor-dev`'s uncommitted line, the three `docs/plans/` changes are the coordinator's, and four untracked `.agentic-*` files sit at the repository root.

Next action: await the implementer and verify its diff, then the first-green commit, review round 1, and the rest of the section loop into `<!-- chapter-slot 5 -->`; open the section 3 and section 4 pull requests the moment `docs/` goes clean.

### Interim board 12 - 2026-09-15

Sections 3, 4 and 5 are all closed, pushed, and holding for the same reason: `pr-docs-guard` refuses to open a pull request while `docs/` carries uncommitted changes, and this checkout still carries the coordinator session's three, `docs/plans/README.md` plus the two untracked plan docs interim board 10 names. Their close commits are cee5e37, 785fd80 and 035bc52. Three pull requests are owed the moment `docs/` goes clean: section 3 against `main`, section 4 based on `prose/03-executing-work-second-half`, and section 5 based on `prose/04-finishing-work-first-half`, each marked ready with auto-merge never armed.

Section 5 stage: closed. Chapter 6 is above. Its close gate read 556 tests, 555 pass, 0 fail, 1 skipped, exit 0 on the nine-file lane, and the boundary steps are done: the journal entry is logged and the unstamped sweep for the section's window read zero owed in both tiers, against an account naming the two operator-tier records this session stamped applied during the section.

Section 6 stage: step 1, the brief written and the implementer not yet dispatched. Branch `prose/06-coordinator-first-half` is cut from 035bc52 and carries no commit but this entry. The split is at line 61, the heading `## The never-tasks-directly rule`, so the first half is lines 1 to 60 of `plugins/claude-kit/skills/coordinator/SKILL.md`. Its base row, measured over a `git show 035bc52:` copy (SCOTT-CLAUDE, 2026-09-15 around 23:30Z, exit 0), is 9311 words, 30 paragraphs, 16 past 200, longest paragraph 1883, 224 sentences, 124 past 30, 77 past 45, longest sentence 318. The whole file reads 19844, 56, 40, 31, 1883, 441, 267, 167, 356.

What this section owes that the five before it did not. The coordinator is the most heavily pinned document in the pass: `test/doctrine-parity.test.js` reads it in dozens of assertions, including the negative checks the plan's section 6 entry names, which forbid the word "board" beside a container noun, and several slice checks bounded by bold leads. The four function bullets under `## The four functions` are counted by two separate assertions, one requiring the set stated as four and one requiring exactly one Kaizen bullet. The ledger carries no entry-level `passage:` line, confirmed by grep, so none is owed; its `c1` entries key skill lines 1 to 38 and its `c2` entries lines 39 to 66 at the extraction commit `6bc07fb`, so a `c2` entry can key a claim now in the second half. `docs/harness-assumptions.md` carries exactly one citation into this skill, at its line 143 naming `coordinator/SKILL.md:33`, which is in this half and is owed a re-aim the main thread places.

Live dispatches: one read-only `Explore` scout at sonnet, extracting every test assertion that reads the coordinator to `.kit/scratch/claude-kit_prose-pass_spec_v1/6/coordinator-pins.md`, classified by half and with the negative checks, the same-sentence checks and the slice boundaries called out separately. It is an ungoverned agent type, so it runs under a tree-state bracket captured at `.kit/scratch/claude-kit_prose-pass_spec_v1/6/tree-before-scout.txt`. The implementer dispatch waits on that file, which its brief at `.kit/scratch/claude-kit_prose-pass_spec_v1/6/brief.md` points at.

Gate baseline: the nine-file lane at 556/555/0/1 exit 0, recorded on this lane at section 5's close over the tree 035bc52 carries (SCOTT-CLAUDE, 2026-09-15 23:19Z).

Rulings adopted since the last boundary: none.

Foreign state named and left: `kaizen/notes-SCOTT-CLAUDE.md` carries `supervisor-dev`'s uncommitted line, the three `docs/plans/` changes are the coordinator's, and three untracked `.agentic-*` files sit at the repository root.

Next action: read the scout's pins file, fold its call-outs into the brief, dispatch `implementer-fable` at the fable override, and take its first-turn reading. Open the three held pull requests the moment `docs/` goes clean.

### Interim board 13 - 2026-09-16

Sections 3, 4 and 5 are still closed, pushed and held: their three pull requests wait on `docs/` going clean of the coordinator session's `docs/plans/README.md` edit and two untracked plan docs, checked again at this boundary and still present.

Section 6 stage: step 3 about to open, review round 1 not yet dispatched. The implementer returned DONE_WITH_CONCERNS after 22 minutes, its first-turn reading having read 58 assistant lines and 0 synthetic. Its work was verified here and committed at first green, 9c1d273 on `prose/06-coordinator-first-half`: lines 61 to 103 at 035bc52 are byte-identical to the tail at head after LF normalization, 43 lines each side by `cmp` exit 0; the nine-file lane read 556 tests, 555 pass, 0 fail, 1 skipped, exit 0 under this session's own heavy-process claim (SCOTT-CLAUDE, 2026-09-16 00:00Z), matching the baseline recorded on the same lane at section 5's close; the em dash sweep over the skill and `docs/harness-assumptions.md` reads 0 and 0 with a control line built in the same command reading 1. The one citation into this half, `docs/harness-assumptions.md:143`, is re-aimed from `:33` to `:67`, both lines being the update-window paragraph whose sentence about killing every session on the stale cache carries the belief.

What the implementer reported, carried for the round. Three cuts, each with a survivor it named by line: the heartbeat-only-timer sentence at base line 10, the omitted-count clause at base line 27, and the keep-never-prune sentence at base line 47. No pointer conversion. One sentence past 45 words kept, the BLOCKED funnel's seven-field disposition sentence at 66 words, because `test/doctrine-parity.test.js` requires all seven keys inside one inner slice. No assertion re-aimed, and a scratch re-derivation of every first-half pin from the test's own regexes read 0 failures. No ledger verdict written: the cut sentences keyed by `c1.C017` and `c1.C059` each have another carrier surviving in the same paragraph, on the precedent Chapter 5 set for `c1.C031` and `c1.C085`, and the third cut has no keying entry; this session's adjudication of that call is owed at step 4. The skill sits exactly at its size cap of 19867 words after the implementer trimmed nine filler words to clear an intermediate ratchet red, so any review fix that adds a word takes a cap sync. One meaning question, present at base: the BLOCKED funnel's "`ts` the dedup key at the bound stated below" names a bound the funnel never states under that name. Head rows for the half: 9311 words, 65 paragraphs, 37 past 120, 7 past 200, longest 714, 450 sentences, 72 past 30, 1 past 45, longest 66.

Live dispatches: none.

Gate baseline: the nine-file lane at 556/555/0/1 exit 0 over the tree 9c1d273 carries (SCOTT-CLAUDE, 2026-09-16 00:00Z).

Rulings adopted since the last boundary: none.

Foreign state named and left: `kaizen/notes-SCOTT-CLAUDE.md` carries `supervisor-dev`'s uncommitted line, the three `docs/plans/` changes are the coordinator's, and three untracked `.agentic-*` files sit at the repository root.

Next action: dispatch review round 1 at fable through the Agent tool, the code pair over `git diff 035bc52 9c1d273` and the document pair, two blind readers on the section's two personas and the prose reviewer with the base half as its fact base; then adjudicate, the fix round, round 2, the close pass, the close gate, the probe pair over `--touching 035bc52`, Chapter 7 into `<!-- chapter-slot 6 -->`, and the stacked pull request based on `prose/05-finishing-work-second-half`. Open the three held pull requests the moment `docs/` goes clean.

### Interim board 14 - 2026-09-16

Sections 3, 4 and 5 are still closed, pushed and held on the same three coordinator files under `docs/`, checked again at this boundary.

Section 6 stage: step 4, round 1 adjudicated and its fix round committed at f7f5437 on `prose/06-coordinator-first-half`, pushed; round 2 in flight. Round 1 ran the full roster at fable through the Agent tool, the adversarial and blind reviewers over `git diff 035bc52 9c1d273` and two blind readers plus the prose reviewer over the half, with the tree bracket reading clean on both sides. No Critical. Two owed Majors, both spec-traceable to the Goal's no-claim-lost test and both fixed: the omitted-count reading, cut at base line 27 and found dropped by the blind reviewer and the prose reviewer independently, is restored verbatim at the degraded-brief sentence, since its named survivor bound "its absence" to the re-arm race one paragraph earlier; and the claim-probe carve-out's "that sentence", which after the split pointed at the re-derivation sentence rather than the never-polled reading, now names the never-polled sentence. Three Minors fixed beside them, each a one-sentence reshape: the source list's opener, the claim file named as a source, and the send-time sentence naming the open line as its antecedent. Every other Minor is at `.kit/scratch/claude-kit_prose-pass_spec_v1/minors-section-6.md` with its reason, and every blind-reader referent finding sits verbatim at the base by grep, so those are meaning questions.

Rulings adopted since the last boundary: the ledger call. `c1.C017` and `c1.C059` stay at `keep`, on this session's read and the adversarial lens's independent read: each entry keys a claim rather than a sentence, and at head each claim has a carrier under the entry's own passage (line 16 for the timer, line 37 and now the restored sentence at line 41 for the omitted count), so a `retire` naming another entry would state the claim retired when it is not. The third cut has no keying entry; `c2.C038` keys its surviving sentence. This is Chapter 5's `c1.C031` and `c1.C085` precedent applied again and no amendment is written for it.

Live dispatches: one `adversarial-reviewer` at fable, round 2, over `git diff 9c1d273 f7f5437`, asked whether each fix restores the base's bound without adding a claim, whether the two re-aimed pointers name what the base's "that sentence" pointed at, and whether the delta changed anything no finding asked for.

Gate baseline: the nine-file lane at 556/555/0/1 exit 0 over the fix round's tree, under this session's own heavy-process claim (SCOTT-CLAUDE, 2026-09-16 00:12Z), matching the baseline recorded on this lane at section 5's close. The skill's cap rose from 19867 to 19894, the restored sentence and three reshapes costing 27 words, which Chapter 7 records as a raise on a cutting section. The tail past `## The never-tasks-directly rule` is byte-identical to the base, 43 lines, `cmp` exit 0, and the em dash sweep reads 0 and 0 with its control reading 1.

Foreign state named and left: `kaizen/notes-SCOTT-CLAUDE.md` carries `supervisor-dev`'s uncommitted line, the three `docs/plans/` changes are the coordinator's, and three untracked `.agentic-*` files sit at the repository root.

Next action: adjudicate round 2, then the close pass over the Minor list, the close gate, the probe pair over `--touching 035bc52` under this session's claim, the diagnostic head row, Chapter 7 into `<!-- chapter-slot 6 -->`, the close commit and push, and the stacked pull request based on `prose/05-finishing-work-second-half`, held with the other three while `docs/` stays dirty.
