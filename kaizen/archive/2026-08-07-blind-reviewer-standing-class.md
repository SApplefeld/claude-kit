# Kaizen brief: separate a standing defect class from diff-describing framing

Friction: the blind-reviewer's input contract barred the spec, the plan, and the section name, and its contamination rule was absolute: any description of intent is disregarded and the dispatch is noted contaminated. That left no room for a legitimate and useful instruction, telling the reviewer to hunt a defect class the repo keeps producing, and no test for telling the two apart. The dispatcher could not tell whether a repo-wide hunting instruction was allowed, and the reviewer could not tell whether one it received was a leak.

Change:
- `plugins/claude-kit/skills/executing-work/SKILL.md`: the "never pre-judge the review" paragraph, which owns what a dispatch may say, gains the rule and the litmus. A repo-wide defect class is neither pre-judging nor contamination. The test: would the sentence read identically for every diff in this repository? A standing property passes and may ride in any dispatch, the blind one included; a sentence that would change with the section fails, and diff-describing framing is that shape (what the change adds, which files matter, what to focus on, what the author was trying to accomplish).
- `plugins/claude-kit/agents/blind-reviewer.md`: the same test at its point of action, so the reviewer can apply it to its own inbox rather than flagging a legitimate class line as contamination and spending the round on a false alarm. A passing sentence is hunted as instructed with nothing said about contamination; a failing one is disregarded and noted.

Acceptance: both sites state the same one-sentence test in the same terms; the reviewer's copy tells it what to do in each direction; the dispatcher's copy makes clear the bar applies to every dispatch and the blind dispatch is only stricter about the failing case.

Discipline: follow writing-skills. Executing-work owns the rule as the site that governs what a dispatcher writes; the agent file carries the operational residue at its point of action rather than a second statement of the rule.
