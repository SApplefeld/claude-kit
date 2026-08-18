# Kaizen brief: the blind-review dispatch line leads with the property test

Friction: the same NEO-CLAUDE run withheld the spec, the plan, and the section name from every blind-reviewer dispatch and still leaked intent three times. `executing-work` step 3 stated the real rule ("would the sentence read identically for every diff in this repository?") but hundreds of words after the withhold list in the same paragraph, so under truncation or skimming the list survived and read as the rule. General lesson: when a rule is stated as a list of prohibited items plus a governing test, the test leads and the list illustrates; whatever sentence comes first is the one that survives a cut.

Change: `plugins/claude-kit/skills/executing-work/SKILL.md` step 3, the blind-reviewer dispatch clause: open with the property test, then the withheld items as the common leaks, then a closing sentence that a brief withholding all three and still saying what the section was for has failed the test. The later "one test separates the two" passage stays; it now restates a rule already led with.

Acceptance: the step-3 blind-reviewer clause opens with the property test before any withheld item is named; the blind-reviewer agent's own dispatch guidance at the Delegating section is unchanged and consistent; suite at baseline.

Discipline: follow writing-skills; baseline-test any behavior-shaping wording.

## Outcome (2026-08-17): applied
Ground: the RED is the observed run (three intent leaks past a full withhold list); no GREEN reproduced, since the leak is a property of a live dispatch under pressure; the wording change is placement (test first, list second), the writing-skills lever for a rule that reads well and is skimmed. Also folded in from the pending 2026-08-02 NEO-CLAUDE note against the same clause: when omitting docs/ paths empties the changed-file list (a docs-only section), skip the blind dispatch, run the adversarial-reviewer alone, and record `blind: no code diff` on the Chapter's review line.
