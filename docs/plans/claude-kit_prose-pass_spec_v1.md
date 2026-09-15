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

<!-- chapter-slot 1 -->

<!-- chapter-slot 2 -->

<!-- chapter-slot 3 -->

<!-- chapter-slot 4 -->

<!-- chapter-slot 5 -->

<!-- chapter-slot 6 -->

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

