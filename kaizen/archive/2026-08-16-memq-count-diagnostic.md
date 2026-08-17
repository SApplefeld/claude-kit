# Kaizen brief: memq count rejections name what was parsed

Friction: `usageCount` in `plugins/claude-kit/scripts/memq.js` (lines 1554-1562) diagnoses exactly one argument-splitting cause, an argument carrying a literal `"` (the PowerShell case), and for every other cause prints only the expected shape. The caller sees a usage dump describing an invocation they believe they made, with no view of what the process received; a rejected `add-operator` call cost five throwaway probe records to bisect, and the first-blamed cause (length) was wrong. General lesson: when a check rejects on a computed property of the input, the diagnostic names the computed value, not only the expected one.

Change: in `usageCount`, echo the parsed positionals alongside the expected shape: the count, and each positional bounded to a display width, so any splitting cause is self-evident from the first failure. Keep the existing embedded-quote diagnosis as the special-cased cause it already names.

Acceptance: new test in `test/memq.test.js` asserting a wrong-count rejection's stderr carries the received count and the bounded positionals, watched red before the change; all existing memq tests green.

Discipline: follow writing-skills; baseline-test any behavior-shaping wording.

## Outcome (2026-08-16): applied

`usageCount` now takes the parsed positionals and echoes their count and display-bounded values ahead of the usage line, at all three call sites (log, add-type, add-operator); regression test watched red then green, memq suite 231/231.
