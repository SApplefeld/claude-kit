# Kaizen brief: confidence vocabulary is defined for reviewers but undefined in cold

Friction: `plugins/claude-kit/agents/adversarial-reviewer.md:49` and `agents/blind-reviewer.md:52` define the confidence scale operationally (high means you verified the failing path against the code; medium means likely but unverified; low means a suspicion worth a look), and pin it independent of severity. `skills/cold/SKILL.md`'s Recommendation section asks for "the confidence level" with no definition, so a "medium confidence" recommendation carries no fixed meaning, and the kit's two confidence-bearing surfaces do not share a vocabulary.

Change: define the scale once for judgment calls in cold's Recommendation section, mirroring the reviewer wording adapted to decisions: "Confidence uses the kit's reviewer scale: high means the deciding evidence was verified this pass; medium means likely, with a named check outstanding; low means a lean - name what would firm it." Leave the reviewer copies in place (agents run fresh-context and cannot dereference a pointer into a skill they do not load).

Triage note: this is the weakest of the three briefs and is offered for the pass to accept or discard. It is a vocabulary-consistency fix standing on observed textual inconsistency (the file:line receipts above), not on an observed behavioral failure, so a pressure-RED is the wrong test; per writing-skills, if applied it ships on the distinct-value rationale (a shared meaning for confidence across surfaces) and that rationale gets recorded. If the pass judges the inconsistency harmless, discarding this brief is the correct outcome.

Acceptance: cold's Recommendation section defines the three levels in wording consistent with the reviewer agents'; a reader can map a cold "medium" and a reviewer "medium" to the same epistemic state.

Discipline: follow writing-skills; baseline-test any behavior-shaping wording.

## Outcome (2026-08-09): applied

Applied as written: cold's Recommendation section now defines the high/medium/low scale in wording that maps to the reviewer agents' operational definitions. No behavioral probe, per the brief's own triage note; ships on the recorded shared-vocabulary rationale (a cold "medium" and a reviewer "medium" now name the same epistemic state). The reviewer copies stay in place because those agents run fresh-context and cannot dereference a pointer into a skill they do not load.
