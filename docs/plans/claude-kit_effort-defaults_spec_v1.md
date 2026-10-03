# One Table for Effort Defaults

Status: Ready
Commit Model: Branch-and-PR
Disjoint: no
Created: 2026-10-03

## Goal

When this is done, the kit states the effort of every dispatch it makes in one table, executing-work's dispatch table, and no skill prose outside that table, agent charter body, `README.md`, `docs/architecture.md` or doctrine file states an effort level for a dispatch. An agent the table names no row for runs at its own frontmatter effort, which the table says in one sentence. A test compares every table row marked as a frontmatter default with the agent file it names, a second test fails on any agent file the pin does not cover, and a third fails when an effort level is stated outside the table. The table then carries the values the operator ruled on 2026-10-03: `medium` in place of `high` for Opus and Sonnet, `medium` in place of `high` for three Fable dispatches, and `high` in place of `max` for the Opus stand-in. A later model release is then an edit to the table, the agent lines it names and one test map, and to nothing else.

## Intent

**The frame, in the operator's words.** On the architect's channel, 2026-10-03: "With the release of Opus and Sonnet 5.5, effort has changed pretty dramatically. Medium is recommended for most tasks, pretty much all the way through, and it's extremely token efficient and performs almost as well as Fable 5.1 on High." Of Fable agents: they "default to High, and burn tokens extremely quickly." Asked whether to wait for a rumored Fable 5.5: "we might as well change on what we know to be factual now."

**What done needs to do.** Put every effort default in one place, so the next release costs one edit. Move Opus and Sonnet dispatches from `high` to `medium`. Lower Fable's effort where it runs on every plan. Keep the result checkable by a test, since a stale value in a skill is a rule a session will follow.

**What done does not need to do.** It does not gather model names into the table: which model reviews what, the tier bands, the capacity reading, the unavailability rule and the rule that routes a dispatch to Workflow or the Agent tool stay where they are, and a skill may still name a model. It does not measure quality at the new values. It does not touch the persona fleet's own session settings, which already read `medium` for all six personas in `D:\personas\fleet.json` on SCOTT-CLAUDE. It does not touch the corpus-compression tooling, whose dispatch shape belongs to its own plan. It does not anticipate a model that is not released.

**Alternatives refused.**
- Wait for Fable 5.5 and write one plan: refused by the operator, since the release is supposition.
- Leave all five Fable `high` dispatches at `high`: refused by the operator, since three of them run on every plan over whole changesets.
- Move the finishing reviews and the plan review from Fable to Opus at `medium`: refused by the operator, since it takes the stronger model off the last gate before a merge on a claim nobody here has measured.
- A new reference file for the table: refused, since a session needs the table at every dispatch and executing-work is already loaded there.
- A table row per agent file, duplicating the frontmatter in prose: refused, since the harness reads the frontmatter and a test can pin it without 18 more rows in a capped skill.

**Rulings after the sketch.** Decided 2026-10-03 by the operator on the architect's channel, on three options put to him for the five places Fable runs at `high`: option A, Fable at `medium` for the implementer, the finishing reviews and the plan review, and `high` kept for the consultant and the scope adjudicator. His words: "Agreed with A. That's a good balance, and we've benefited from High without overusing our Fable Allowance, I think leaving those but dropping the others you named is a good way to balance it further." The others named to him in the same message were Opus and Sonnet reviewers to `medium`, any other Opus, Sonnet or Haiku dispatch to `medium`, and the Opus stand-in from `max` to `high`. The stand-in was described to him as what runs "when Fable is unavailable", so it covers both the compensation row and the consultant's stand-in, and neither is an "other Opus dispatch" at `medium`.

**Provenance.** Written by the ARCHITECT persona on SCOTT-CLAUDE, 2026-10-03, on the operator's ask over the architect's channel.

## Approach

**What the kit does today, read at 892b9f31.** Executing-work's reviewer effort table (`plugins/grimoire/skills/executing-work/SKILL.md:299-312`) already owns ten rows. These other places state effort levels of their own:

- `plugins/grimoire/skills/executing-work/SKILL.md:314` and `:316`, two paragraphs under the table that restate its rows in prose, and `:341`, which calls a below-Fable reviewer's `high` the rule's own level and speaks of a compensation notch.
- `plugins/grimoire/skills/finishing-work/SKILL.md:12` (finishing reviewers at `high`, the fallback "recorded as lower-effort"), `:58` (compensation at `effort: 'max'`), `:60` (the bare fallback, which "names both losses, tier and effort"), `:82`, `:96` and `:98` (fable at `high`), `:102` (the scope adjudicator's `high`).
- `plugins/grimoire/skills/brainstorming/SKILL.md:40` (the plan review at "effort high", written bare, with `low` as the fallback "run at lower effort").
- `plugins/grimoire/skills/consult/SKILL.md:33` (the consultant at `high`, the stand-in at `max`).
- `docs/architecture.md:15` (the frontmatter pins, agent by agent, and the climb to `high` per dispatch) and `:39` (every other per-section dispatch at `high`, fable at `high` by default, the Opus stand-in at `max`, and the claim that `high` sits above every reviewer's frontmatter effort).
- `README.md:227`, which states `high` and `max` and speaks of compensating for the lost tier.
- `plugins/grimoire/skills/operating-instructions/references/ownership-map.md:32`, which names executing-work's steps 3 and 4 as the owner of reviewer effort and names no owner for any other dispatch's effort.
- The frontmatter of the 18 files under `plugins/grimoire/agents/`: `low` on adversarial-reviewer, blind-reviewer, blind-reader, prose-reviewer, plan-reviewer and corpus-drafter; `medium` on security-reviewer, performance-reviewer, docs-curator, qa-verifier, implementer-opus and implementer-sonnet; `high` on consultant, scope-adjudicator and implementer-fable; no `effort` line on implementer-haiku, design-facilitator and council-member.

One test pins nine of those frontmatter lines by a hand-written map (`test/readonly-agent-guard.test.js:950-962`), and `test/review-loop-provenance.test.js:473-628` pins that map's roster. Nothing reads the table, which `docs/backlog.md:321` records as an open gap.

**The design.** The table stays where it is and is renamed the dispatch table, since it gains rows that are not reviewers. Its first column is headed `The dispatch`, and the sentence that introduces it at `:299` is rewritten to say it sets the effort and route of every dispatch the kit makes. It gains the rows it lacks. Every row's first cell opens with a short name in bold, two or three words, unique in the table. A row whose effort is an agent's own frontmatter default says `(frontmatter default)` in its effort cell and names each agent file it speaks for in backticks in its first cell, which is what lets a test compare the two. That holds for the five rows already marked that way: the code and document pair row names `adversarial-reviewer`, `blind-reviewer`, `blind-reader` and `prose-reviewer`; the security row `security-reviewer`; the performance row `performance-reviewer`; the scope adjudicator's row `scope-adjudicator`; and the later-round row over a fable writer `adversarial-reviewer` and `prose-reviewer`, the two lenses a later round dispatches. Every other skill and document names the row it takes in one fixed form, the words `dispatch table row` followed by the row's short name in double quotes, and states no effort level. One sentence under the table says an agent with a frontmatter effort and no row runs at that effort on the route it rides today, which covers qa-verifier, docs-curator, corpus-drafter, design-facilitator and council-member. The frontmatter stays the source for an agent's own default, because the harness reads it.

**Rows added in section 1, at today's values.**

| The dispatch | Model | Effort | Route |
|---|---|---|---|
| `implementer-haiku` | haiku | none, since Haiku 4.5 takes no effort (`docs/backlog.md:320`) | Agent tool |
| `implementer-sonnet` | sonnet | `medium` (frontmatter default) | Agent tool |
| `implementer-opus` | opus | `medium` (frontmatter default) | Agent tool |
| `implementer-fable` | fable | `high` (frontmatter default) | Agent tool |
| The `consultant` | fable | `high` (frontmatter default) | Agent tool |
| The consultant's stand-in where fable cannot run | opus | `max` | Workflow |
| The plan review of a new spec, `plan-reviewer` | fable | `high` | Workflow |
| The blind read of a new spec, `blind-reader` | fable | `low` (frontmatter default) | Agent tool |
| Any other dispatch of an agent with no frontmatter effort | opus or sonnet | `high` | where it rides Workflow |
| Any other dispatch of an agent with no frontmatter effort | fable | `medium` | where it rides Workflow |

The last two rows cover an ad hoc dispatch, such as a general-purpose agent or a scout, and set its level only where the dispatch rides Workflow. Whether it may ride Workflow is the doctrine's standing-dispatch bullet's call and the operator's stored rule's, never this row's. They have no source passage in the kit. Their source is the operator-tier memory record `fan-out-runs-through-workflow-under-a-session-wide-cap`, which the section 1 Chapter cites by name. The plan review's no-Workflow fallback is not a row: the sentence at `executing-work/SKILL.md:339` already covers every row whose Workflow route is unavailable.

**Values changed in section 3.** A row not listed keeps its value. The four existing Fable reviewer rows at their frontmatter default (`:303-305` and `:308`) are unchanged.

| The dispatch | Model | Before | After |
|---|---|---|---|
| Round 1's reviewers one tier above a haiku- or sonnet-tier writer | sonnet or opus | `high` | `medium` |
| A later round's one lens over a haiku, sonnet or opus writer | the writer's tier | `high` | `medium` |
| A per-section reviewer re-aimed after its tier was ruled out, landing below fable | sonnet or opus | `high` | `medium` |
| The finishing reviews over the whole changeset | fable | `high` | `medium` |
| The plan review of a new spec | fable | `high` | `medium` |
| `implementer-fable` | fable | `high` | `medium`, in its frontmatter too |
| Compensation for a Fable gate that could not run | opus | `max` | `high` |
| The consultant's stand-in | opus | `max` | `high` |
| Any other dispatch, opus or sonnet | opus or sonnet | `high` | `medium` |

Every row that rides Workflow today keeps that route for every lens, including a security or performance reviewer whose row effort now equals its frontmatter `medium`. One route per round is simpler than splitting it by lens, and the sentence at `:318` that sends a dispatch to Workflow when its row differs from the frontmatter is reworded in section 1 to send it wherever its row says.

A re-aim that reaches fable keeps `high`. It is a sixth place Fable runs at `high`, which the options put to the operator did not name, so it stays as it is until he rules on it, and section 1 splits the re-aim row in two so the two levels can differ.

**Why the consultant and the scope adjudicator keep `high`.** Each is one ruling on one hard question, dispatched rarely, so `high` costs little there. The three Fable dispatches that drop run on every plan.

**History this plan moves against.** The below-Fable `high` was set on 2026-08-11 by the reviewer-effort-compensation effort, on the reasoning that a weaker model needs more effort to stand in for a stronger one (`docs/backlog.md:320`). The operator's ruling replaces that reasoning for the 5.5 models.

**The sweep.** Run by the architect on 2026-10-03 over the kit at 892b9f31 and over the trunks of agent_persona (83083d8) and discord-channels (1d4db3c). Searches: `effort` as a word, per file; `^(model|effort):` in agent frontmatter; an effort level in backticks, after the word `effort`, or as `effort: '<level>'`, in every `SKILL.md`, agent file, `README.md`, `docs/*.md`, `home/`, `plugins/grimoire/output-styles` and `tools/`; `--effort`, `effort:` and `reasoning effort` in the other two repositories. Surfaces found in the kit are the ones listed above, the two tests, `docs/backlog.md:298`, `:320` and `:321`, the rationale ledgers beside each skill, `tools/corpus-compression/workflow.mjs:37-43` with its test, and `tools/corpus-compression/mechanism-cut-2026-09-30.json`. The other two repositories state no kit dispatch default: agent_persona carries a per-persona `effort` setting in its fleet file and launch scripts, and discord-channels carries the word only in tests and archived plans.

**Size.** The four skills and `implementer-fable.md` sit exactly at their word caps in `test/size-budget.json` (15508, 8317, 2712, 558, 1048). `test/readonly-agent-guard.test.js` and `test/doctrine-parity.test.js` sit exactly at their line caps (1881 and 6419). No existing entry's cap rises. Executing-work pays for its new rows by deleting the two restating paragraphs at `:314` and `:316`, keeping one fact no row carries: the adjudicator's `high` is its charter's own pin and never a compensation notch. A pointer costs more words than the level it replaces, so each of the other three skills and the ownership map pays for its pointers inside the passage it edits, by cutting the rationale that restated the level, and the Chapter names each cut. A file that ends smaller has its cap lowered to its count. A file that cannot fit is a stop that reports the measured overage, never a raised cap. The new tests live in a new file, `test/dispatch-table.test.js`, with its own new budget entry at its measured size. The existing frontmatter pin moves out of `test/readonly-agent-guard.test.js` into that file, which shrinks the old file, and `test/review-loop-provenance.test.js`'s roster check is re-pointed at the new file.

## Sections of Work

### 1. The dispatch table owns every effort
Model: opus

Rename the table and its first column, rewrite its lead sentence, and add the ten rows the Approach lists, at today's values. Mark each frontmatter-default row as the design states. Delete the two restating paragraphs under the table, keeping the one fact. Reword the sentence at `:318` to route a dispatch as its row says. Split the re-aim row in two, one landing below fable and one reaching fable, both at today's `high`. Add the sentence for an agent no row names. In executing-work at `:341`, finishing-work, brainstorming, consult, `docs/architecture.md:15` and `:39`, and `README.md:227`, replace each stated effort level with a pointer in the fixed form. In `docs/architecture.md:15`, the agent-by-agent list of frontmatter pins becomes one sentence pointing at the agent files and the table. Rewrite every sentence in those files that says one dispatch's effort is above, below, lower than or a notch over another's, finishing-work's two fallback sentences at `:12` and `:60` and brainstorming's at `:40` among them, so it records the effort the dispatch ran at beside its row's effort and makes no comparison. In the ownership map, name executing-work's dispatch table as the owner of every dispatch's effort. Update each changed rule's line in the rationale ledger beside its skill, per the writing-skills skill. This section changes no value: every dispatch resolves to the effort and route it resolved to before.

Acceptance:
- Outside the table's own lines in executing-work, none of the four skills, `docs/architecture.md` and `README.md` states an effort level for a dispatch, whether in backticks, in quotes, after the word `effort`, or bare.
- No file in scope says one dispatch's effort is above, below, lower than or a notch over another's. The Chapter lists every remaining line in those files that holds one of the words `low`, `medium`, `high`, `xhigh` or `max` beside a dispatch, with the reason it is not an effort level.
- Every pointer is written in the fixed form, and the short name inside it exists in the table verbatim.
- Each of the ten rows marked `(frontmatter default)` names its agent files in backticks, and each named file's `effort` line equals the row's level.
- For each row added, the Chapter names the passage or the memory record the value was taken from.
- `node --test test/size-ratchet.test.js` passes with no existing cap raised, and each file that ended smaller has its cap lowered to its measured count.
- `node --test test/doctrine-parity.test.js test/readonly-agent-guard.test.js test/review-loop-provenance.test.js` passes. A pin in those files that quotes a sentence this section rewrote is re-pointed at the new sentence, and the Chapter lists each one.

Files in scope: `plugins/grimoire/skills/executing-work/SKILL.md`, `plugins/grimoire/skills/finishing-work/SKILL.md`, `plugins/grimoire/skills/brainstorming/SKILL.md`, `plugins/grimoire/skills/consult/SKILL.md`, the `references/rationale-ledger.md` beside each of those four, `plugins/grimoire/skills/operating-instructions/references/ownership-map.md` and its rationale ledger where it has one, `docs/architecture.md`, `README.md`, `test/size-budget.json`, `test/doctrine-parity.test.js`, `test/review-loop-provenance.test.js`.
Tests: none new here. Section 2 pins what this section builds, and the first four acceptance bullets are checked by hand until then.
Audience: a kit session at a dispatch moment, holding the skill and no memory of this plan. It must be able to answer, from the table alone, what effort and route its dispatch takes. Voice: none named. Fact base: the passages the Approach cites at 892b9f31.

### 2. The pins
Model: opus

Create `test/dispatch-table.test.js` with four tests, and move the existing frontmatter pin into it. The frontmatter test holds a map naming every `.md` file directly under `plugins/grimoire/agents/` with its `effort` value or the word `none`, and compares each file's frontmatter with the map. The roster test fails on a file in that directory the map does not name. The table test parses each table row marked `(frontmatter default)`, reads the agent file names in its first cell, and fails where the row's effort differs from the map. The restatement test reads every `SKILL.md`, executing-work's included outside the table's own lines, the body of every agent file, every file under `home/` and `plugins/grimoire/output-styles`, `README.md` and `docs/architecture.md`, and fails where a line states an effort level: one of `low`, `medium`, `high`, `xhigh` or `max` in backticks or quotes, or bare after the word `effort`. Its allow list holds only lines where the matched word is not a dispatch's effort level, and a line that states one is never allowed. The same file finds every pointer by its fixed form and checks that the short name inside it exists in the table. Re-point `test/review-loop-provenance.test.js`'s roster check at the new file.

Acceptance:
- With an agent file added under a temporary name and no map entry, the roster test fails naming that file. With `implementer-fable.md`'s `effort` line changed, the frontmatter test fails naming that agent, and with the table's `implementer-fable` row changed instead, the table test fails naming that row. With the scope adjudicator's row changed, it fails naming that row, which shows the rows that predate this plan are pinned too.
- The restatement test fails on a control the Chapter records: a sentence of the shape a skill would write, placed once in a skill other than executing-work and once in executing-work outside the table, that the test's pattern was not written from. It passes with the control removed. Every allow-list line is listed in the Chapter with the sense its word carries.
- With one pointed-at row label changed by a word in a skill, the label check fails naming the skill and the label.
- `node --test test/dispatch-table.test.js test/readonly-agent-guard.test.js test/review-loop-provenance.test.js test/size-ratchet.test.js` passes, with no existing cap raised and one new budget entry.

Files in scope: `test/dispatch-table.test.js` (new), `test/readonly-agent-guard.test.js`, `test/review-loop-provenance.test.js`, `test/size-budget.json`.
Tests: the frontmatter pin and the table pin both ways, since either can drift alone while the suite stays green; the roster check, since an agent added without a decision inherits the session's effort; the restatement sweep with a withheld control, since a silent sweep proves nothing until it has been seen to speak; the label check, since a pointer at a renamed row sends a session to a rule that is not there.

### 3. The new values
Model: sonnet

Change the table's rows to the After column of the Approach's second table. Change `effort: high` to `effort: medium` in `plugins/grimoire/agents/implementer-fable.md`, and its entry in the test map. Add one rationale-ledger line under executing-work naming the operator's ruling of 2026-10-03 as the reason, in place of the compensation reasoning it replaces. Amend `docs/backlog.md:298` and `:320` to the pins as they now stand, leaving the open-experiment record at `:320` otherwise as written, and retire `:321` to the quarter's backlog snapshot, since section 2 delivered it. The session running the plan then replaces the operator-tier memory record `fan-out-runs-through-workflow-under-a-session-wide-cap` in its main thread: it reads the record with `memq get`, and writes a new record carrying a `supersedes:` pointer at it, identical but for its effort paragraph, which points at the dispatch table and states no level.

Acceptance:
- Every changed row reads as the After column states, and the consultant's and the scope adjudicator's rows still read `high`.
- `git diff --stat <section 2's commit>..HEAD` over `plugins/`, `README.md` and `docs/architecture.md` names only `plugins/grimoire/skills/executing-work/SKILL.md`, its rationale ledger and `plugins/grimoire/agents/implementer-fable.md`. This is the proof that a release is one table edit.
- `node --test test/dispatch-table.test.js test/readonly-agent-guard.test.js test/review-loop-provenance.test.js test/size-ratchet.test.js` passes with no cap raised, and the whole gate passes at finishing.
- `memq get` on the new record shows the `supersedes:` pointer and an effort paragraph naming the dispatch table.

Files in scope: `plugins/grimoire/skills/executing-work/SKILL.md`, `plugins/grimoire/skills/executing-work/references/rationale-ledger.md`, `plugins/grimoire/agents/implementer-fable.md`, `test/dispatch-table.test.js` (the map entry), `test/size-budget.json` only where a count fell, `docs/backlog.md`, `docs/archive/backlog-2026-Q4.md`, the operator memory tier through `memq`.
Tests: none new, since section 2's pins hold every value this section sets.

## Out of Scope

- Model names in any skill: which model reviews which writer tier, the tier bands, the capacity reading, the unavailability rule and the rule that sends a dispatch to Workflow or the Agent tool.
- `tools/corpus-compression/workflow.mjs`, its test and `mechanism-cut-2026-09-30.json`, which record one plan's own dispatch shape and a dated measurement.
- `docs/backlog.md` beyond the three items named, every plan document and everything under `docs/archive/` except the Q4 backlog snapshot section 3 appends to, which are history and may state the levels a past round ran at.
- The persona fleet's per-session `model` and `effort` in agent_persona's fleet file, and every file in agent_persona and discord-channels.
- Any measurement of review quality at the new values.
- A row for a model that is not released.

## Assumptions

- assumed 2026-10-03 (operator's word on the architect's channel): `medium` is the right effort for Opus and Sonnet 5.5 on most tasks; reversal: the table's rows and nothing else.
- assumed 2026-10-03 (`docs/backlog.md:320`): Haiku 4.5 takes no effort setting, so the haiku row names none; reversal: one row.
- assumed 2026-10-03 (default): the vendor's own effort guidance for the 5.5 models was not read for this plan, which rests on the operator's statement of it; reversal: none, a citation can be added to the ledger line.
- assumed 2026-10-03 (default): a worker running another plan picks the new values up when this plan's kit reaches its machine, mid-plan included; reversal: none needed, since a Chapter records the effort each round ran at.
- assumed 2026-10-03 (operator's word on the architect's channel about this session's own agents, "set the effort level lower rather than get the default", Fable named): the two plan reviews of this spec ran at fable and `medium`, below the `high` brainstorming names today; reversal: one re-dispatch at `high`.
- assumed 2026-10-03 (default): an agent with a frontmatter effort and no table row keeps that effort and its route, so qa-verifier, docs-curator, corpus-drafter, design-facilitator and council-member are unchanged; reversal: a row each.

## Operator Verification

- After this plan merges and the plugin updates on a machine, dispatch `implementer-fable` once through the Agent tool and observe the effort it ran at, as `docs/backlog.md:298` describes for the earlier pins. The installed plugin cache is what a session runs from, and no test in the repository reads it. An effort of `high` means the cache is stale and a plugin update is owed; it reopens nothing in this plan.

## Open Questions

- Whether a per-section reviewer re-aimed up to fable drops from `high` to `medium` with the rest. Owner: the operator. The plan keeps it at `high`, and a ruling is one row.

## Chapters
