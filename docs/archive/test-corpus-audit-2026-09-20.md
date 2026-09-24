# The test corpus audit

Archived snapshot, measured 2026-09-20. The suite has changed since, so every count below describes that day's `test/` rather than the current one.

This document is a census of `test/`, measured case by case against the requirement axis. It exists so that a session deciding whether a test earns its keep has a number to start from rather than an impression. It measures the corpus; it does not change it. Nothing here retires a test, and every verdict below is a nomination a person still adjudicates.

The rule it measures against is the one `plugins/claude-kit/skills/testing-discipline/SKILL.md` owns. A test pins a requirement when a session could not make the change it forbids on its own authority, because something else would have to change too: a caller that depends on the return, a guard that must refuse on the path it guards, a writer and a reader that must agree on a field, a shipped surface that states why the pinned thing must hold, or code that reads a set at runtime to allow, deny or route. A test pins a choice when a session could make that change alone.

## What the corpus is

3,451 test cases across 62 files. 181 of those cases spawn a child process, carrying 678 spawn sites between them. Cases are counted as `test(...)` and `it(...)` registrations, read by first argument rather than by a title regex, so a title concatenated across lines or computed per variant is counted like any other.

## The five axes

Each case carries five readings. Four are model judgments. One is computed from the tree.

| Axis | Type | What it answers |
| --- | --- | --- |
| Pins | requirement, choice, mixed, or control leg | Whether the case constrains something outside itself, under the litmus above |
| Blast | 1 to 5 | What a silent regression of the asserted behaviour would cost, from cosmetic to irrecoverable data loss |
| Fragility | 0 to 1 | The probability an ordinary edit reds the case with no defect behind it |
| Subject | behaviour, prose, cross-surface parity, or tree shape | What the assertions actually read |
| Orphan | computed | Whether the subject files the file header cites still exist in the tree |

Fragility is the axis that earns its place. It is what the requirement axis prices as a test's recurring cost, and it separates the corpus cleanly by subject.

## The readings

| Verdict | Cases | Share |
| --- | ---: | ---: |
| Keep | 2,884 | 83.6% |
| Reshape | 204 | 5.9% |
| Review, the model could not call it | 359 | 10.4% |
| Retire | 4 | 0.1% |

What each case pins: requirement 3,201 (93%), choice 188 (5%), control leg 57 (2%), mixed 5 (0%).

What each case exercises: executable behaviour 3,240 (94%), prose content 131 (4%), cross-surface parity 64 (2%), tree shape 16 (0%).

Mean fragility across the corpus is 0.31. Mean blast is 2.42.

The corpus is healthy. There is no accumulated dead weight to sweep, and 93% of cases pin a requirement rather than a choice. The cost the requirement axis is concerned with sits in a narrow seam, not spread across the tree.

## Where the fragility is

One file carries most of the problem.

| File | Cases | Mean fragility |
| --- | ---: | ---: |
| `doctrine-parity.test.js` | 75 | 0.67 |
| `review-loop-provenance.test.js` | 28 | 0.51 |
| `embedder-install.test.js` | 13 | 0.50 |
| `session-start-plans.test.js` | 19 | 0.40 |
| `session-start-plugin-view.test.js` | 14 | 0.38 |
| `probe-set.test.js` | 60 | 0.38 |
| `kit-sidecar-battery.test.js` | 122 | 0.38 |
| `session-start-kaizen.test.js` | 14 | 0.38 |

`doctrine-parity.test.js` reads at more than double the corpus mean, and 75% of its cases are flagged to reshape or retire. It asserts on doctrine sentences, so every prose edit reds it whether or not a contract moved. That reading is independent of the repository's own record of the same file, which counts it rewritten 27 times in six days as the prose it pins was edited. Two measurements taken different ways agree on which file costs the most.

## Where the wall clock is

Spawn sites are concentrated in two files. `memq.test.js` holds 271 of the 678, and `kit-goal-lib.test.js` holds 230. Together they are 74% of every child process the suite starts. Both files read keep-heavy, so that cost buys real insurance rather than being waste. It is stated here because the gate's clock is the suite's total work spread over the workers, so any future section that adds a spawn to either file moves the gate for every section after it.

## Where the stakes are lowest

Files whose mean blast falls below 1.8, among files of at least ten cases: `doctor-encoding.test.js` (1.49), `kit-goal-statusline.test.js` (1.55), `session-start-backlog.test.js` (1.56), `kit-sidecar-rollup.test.js` (1.67), `kit-statusline.test.js` (1.79). A low blast reading is not on its own a reason to cut. It is the axis to weigh a reshape against when one of these files turns red on an edit that changed no contract.

## What the verdicts are worth

The verdicts are a triage ranking rather than a decision, and they are not evenly reliable.

The retire set is four cases and is the most conservative reading available. A case retires only where its subject is text or tree shape, where its fragility is high and its blast low, because there is no behaviour underneath to keep. A case that asserts real behaviour through a sentence is a reshape, since the requirement is live and only the wording is the choice.

The reshape set of 204 is the least verified bucket. Each one is a case where a live requirement appears to be stated through a fragile literal, so the remedy is to derive the constant or assert the token a reader acts on. Whether each is genuinely reshapeable has not been checked case by case.

The review set of 359 is not a failure. It is the two bands where the reading is honestly indecisive: cases where requirement against choice came back below confidence 0.45, and cases where a sibling in the same file may already catch the same break. The second band cannot be settled from this data at all, because the sibling comparison was made against sibling titles rather than sibling assertions, and a cover holds only where the surviving sibling's assertions constrain the same thing.

Two limits apply to every reading. The judge reads the test source and the file's header comment, never the product code the test exercises, so whether a test supports active code rests on the paths the header cites. And the readings are model judgments about what a test pins, not verified facts about what would break.

## Reproducing it

The instrument lives in `.kit/test-audit/`, which is scratch and untracked. It has four parts, and the split matters: raw judgments are bought once and the policy over them is free to change.

- `extract.js` parses `test/*.test.js` into one row per case, with the case source, the file header, the leading comment, and the spawn count.
- `questions.js` holds the five questions, with the requirement litmus quoted into the prompt so the judgment runs against this repository's own rule.
- `judge.js` sends one request per case, batching all questions over one state, and appends to `results.jsonl` so an interrupted run resumes rather than re-buying what it already has.
- `report.js` composes verdicts from the raw answers and writes the tables above. Every threshold is a named constant here, so moving one re-reports without spending anything.

A full pass over the corpus is 3,451 requests, about 12.0 million input tokens, and runs in 82 seconds at concurrency 10.

## Related

- `plugins/claude-kit/skills/testing-discipline/SKILL.md` owns the earn and retire classes this audit measures against.
- `docs/plans/claude-kit_test-requirement-axis_spec_v1.md` is the plan that adds the requirement axis to that skill. This audit is evidence for it and does not implement any part of it.
