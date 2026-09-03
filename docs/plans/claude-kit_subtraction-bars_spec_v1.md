# The kit gains subtraction: a rule that retires tests and prose, and a ratchet that holds the size

Status: Ready
Commit Model: Commit-and-Push
Created: 2026-09-03

Session model: any executor session in the kit repo; four sections, tiers per section. Authored by the KIT: Expert seat from the operator's direction in the 2026-09-03 design dialog, which ranked this plan first in the cycle: the bars land before any audit, so the audits have a bar to cut to.

## Goal

Every rule the kit has about tests and prose says what to add and none says what to remove, so both grow by construction. At HEAD the suite is 96,900 lines against 50,300 lines of product, three quarters of it written in one month, and the skills run to 167,000 words with half their sentences over forty words. When this plan is done the kit carries the mirror rules: what retires a test, what a sentence has to earn to stay, a reviewer duty to name surplus as a finding, and a ratchet test that fails any curated file that grows past a committed budget. Nothing is cut here. The cuts are the corpus audit's and the test audit's, and they cut to these bars.

## Approach

The growth is the rules working as written, not the rules being ignored. The testing-discipline skill has a "what earns a test" list and no retire list. The single-source rule says copy a rule whole under a parity pin, so every restatement is a full copy plus a test. The reviewers are charged with finding what is missing, never what is surplus. A symmetric rule at each of those three sites is the fix, and a ratchet is what makes the rule bite between audits.

Terms this plan leans on. The whole gate is `node --test test/*.test.js` from the repo root, read from its own exit marker; its one permanent failure on this machine is the memory-session path-length test, and green below means that failure set and no other. The doctrine has two tracked copies, `plugins/claude-kit/skills/operating-instructions/SKILL.md` and `home/claude-kit-doctrine.md`, pinned byte-identical by `test/doctrine-parity.test.js`; a third under `plugins/claude-kit/` is gitignored build output the build regenerates, so "both copies" below means the two tracked ones. The register core is the communication-core block the output style copies from the doctrine between its `KIT-REGISTER-CORE` markers, pinned by `test/output-style-parity.test.js`. The four reviewer charters are `adversarial-reviewer`, `blind-reviewer`, `blind-reader` and `prose-reviewer` under `plugins/claude-kit/agents/`.

The bars are written where the ownership map already places the moments. Tests: `testing-discipline` (row 40). Prose: `writing-skills` (row 93). The doctrine keeps its pointers and gains one sentence each way. The reviewer charters carry the duty at the point of action.

A scout sweep ran on 2026-09-03 for every surface stating either contract. Tests: 25 surfaces, the rule itself at `testing-discipline/SKILL.md:10-27`, the floor-never-shrink clause at `executing-work/SKILL.md:112`, the `Tests:` line at `brainstorming/SKILL.md:81`, the reviewer duty at `agents/adversarial-reviewer.md:40`, and four doctrine bullets under Verify and What the suite cannot see. Prose: 26 surfaces, the delete-litmus and the length bullet in the doctrine's Style section (`operating-instructions/SKILL.md:24,28` and the home mirror), `writing-skills/SKILL.md:18,21,56-60`, the ownership map's copy-whole rule at `:3`, and the four reviewer charters' no-restating lines. Two test files pin prose wording: `test/doctrine-parity.test.js` (4,883 lines) and `test/output-style-parity.test.js` (253). The sections' file lists come from that sweep.

Decisions:

1. Budgets initialize at current size. This plan sets no cut target. A budget is a ceiling that only the audits lower, and lowering is free; raising one is an edit to the budget file that rides in the diff for the reviewer to see.
2. The byte-identical parity pins over the sets the ownership map names as pinned copies (the doctrine mirror, the register core) are the one class of wording pin that stays. Every other exact-wording assertion on prose or on printed text is a retire class.
3. A count is pinned only where a machine reads the count. A prose restatement of a count is repaired by deleting the restatement, never by pinning it.
4. The ratchet reads tracked files only, by `git ls-files`, so the gitignored third doctrine copy and scratch never enter it.

## Sections of Work

### 1. The retire rule and the pin bans

Model: opus

The testing-discipline skill gains "What retires a test" directly under "What earns a test", as its mirror. The classes, each with a one-clause example: an implementation mirror; a count pin on a set no machine reads as a count; an exact-wording pin outside the ownership map's pinned-copy sets; a duplicate, meaning a test whose failure is implied by another test's failure; an orphan, whose contract's owner moved or was deleted. The existing "What never earns one" paragraph, which already names the mirror and the wording pin, folds into this list so the skill states the retire classes once. The section states the shape bar in one sentence: one focused test per stated behavior, sized like its neighbours, and a scratch check is deleted rather than kept. It states the section duty: a section's Chapter names its test delta (files, tests, lines added and removed), and a section that adds without retiring says why nothing was retirable. The doctrine's "Make the test earn its green" bullet gains one sentence pointing at the retire rule, in both doctrine copies. The ownership map's row 40 names retirement beside earning.

Acceptance: the five classes are stated under one heading with the never-earns paragraph folded in; the doctrine-parity suite is green; the charters of section 2 name the classes and no surface outside testing-discipline defines them. Sections 1 through 3 write their test delta in Chapter prose, since the `Delta:` line arrives in section 4.

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

## Out of Scope

- Any cut. The corpus audit's follow-on plan cuts prose and the test audit plan cuts tests, both to these bars.
- The meter-aware tier lean, which extends the capacity-gate plan's reader.
- The two parity pins' own size: they are wording pins by design and the test audit decides what they cover.

## Assumptions

- assumed 2026-09-03 (default): budgets initialize at current sizes and carry no cut target; reversal: edit the budget file, one line per file.
- assumed 2026-09-03 (ownership map): the parity pins over the doctrine mirror and the register core are the only wording pins that survive the ban; reversal: name a further pinned-copy set in the map's third column.
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
