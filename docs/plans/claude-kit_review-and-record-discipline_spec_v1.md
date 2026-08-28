# A clearance is a hypothesis, a tool's output is its own fact base, and the register takes the plain floor

Status: In Progress
Commit Model: Commit-and-Push
Created: 2026-08-27

Session model: Opus, in a clean session opened in the kit repo. The running order, recorded in each plan's header and in `docs/plans/README.md`: seat-infrastructure (1), memq-network-cwd-resolver (2), this plan (3), plan-lifecycle-and-diagnostics (4), with testing-discipline complete and archived ahead of the whole queue. The start condition is observable and names its check: this plan starts when `docs/plans/claude-kit_testing-discipline_spec_v1.md` and `claude-kit_memq-network-cwd-resolver_spec_v1.md` both read `Status: Complete` or sit in `docs/archive/`, because that pair edits two of this plan's amendment surfaces (executing-work, both doctrine copies) first. The seat-infrastructure plan shares no files with this one and does not gate it; the machine's one-suite-at-a-time budget is the only constraint it adds. Authored by the KIT: Expert seat from seven 2026-08-26 kaizen notes on review and record discipline. Anchors as of commit `6a928f7`; re-locate by content.

## Dispatch Authorization

Authorized 2026-08-27 by the operator: arming and execution of the four remaining queue plans by a worker session in this repository on this machine, in order: seat-infrastructure, then memq-network-cwd-resolver, then review-and-record-discipline, then plan-lifecycle-and-diagnostics, each plan honoring its own recorded start condition. This grant supersedes the same date's earlier grant, which placed a three-plan slate behind an armed testing-discipline and memq-network queue: the operator promoted seat-infrastructure ahead of memq-network-cwd-resolver, and the earlier queue's leash did not survive the session that held it, so memq-network-cwd-resolver now carries its own section rather than riding an armed goal. The grant was given at the keyboard of the KIT: Expert session in this repository, in that session's own conversation, and is recorded here by reference rather than quotation, per the public-repository convention. One grant covers the four plans, each carrying its own section pointing at it. This section was authored by the KIT: Expert seat on that keyboard instruction; per the peer-sessions trace rule it is a warrant only for a citing session that did not author it, and the receiving session performs its own trace of the grant before arming. That trace takes the form the peer-sessions rule states, provenance rather than credential: it reads this section's recorded claim, the commit that landed it, and the grant's scope against the action in front of it.

## Goal

Seven review-and-record lessons the kit learned this week exist only as incident reports: a security lens explicitly cleared a trust claim a prose lens correctly called Critical, and only the orchestrator's own trace settled it; two documents agreed the ListAgents roster row carries a working directory, the tool prints none, and two review lenses across two rounds endorsed the false claim because no lens ran the tool; a falsified-claim sweep whose pattern was shaped by the incident that taught it missed two sibling falsehoods in the same changeset; a whole-document prose pass at finishing caught a positional back-reference broken by that effort's own insertions, which a per-section diff reviewer structurally cannot see; a fix-round delta shipped a hang because the round's review was nearly skipped as unnecessary; a late section silently invalidated a document an earlier section had written, with no step to re-open it; and the operator's own reading evidence says the communication register's depth calibration is tuned backwards.

When this plan is done, each of those is a standing rule on the surface that fires at its moment: responding-to-review treats clearances as hypotheses, the reviewer charters and the dispatch brief anchor tool-printed claims to tool runs, the docs-curator's sweep recipe states its class, executing-work owes a review round to qualifying fix deltas and re-opens documents a late section falsified, finishing-work states the whole-document scope structurally, and the register's default is the plain floor in all three parity copies.

## Evidence

- The split-verdict instance (reported, 2026-08-26 note): a security lens cleared "no model-writable input can produce a deny" at a named line, the prose lens rated the same line Critical, and tracing the gate's own branch order proved the prose lens right. `plugins/claude-kit/skills/responding-to-review/SKILL.md` treats findings as fallible hypotheses and says nothing about clearances; the corroboration section (:24-:28) weighs converging findings and has no rule for contradicting verdicts.
- The tool-output instance (reported, 2026-08-26 note; the correction shipped at four sites under that plan's enumerate-every-surface amendment): two documents agreed the roster row carries a working directory, the tool prints none, the claim predated the effort, and two review lenses across two rounds endorsed its propagation. The project memory `an-enumeration-about-a-tool-is-read-from-the-tool` carries the lesson; no reviewer charter or brief field does.
- The sweep-shape instance (reported, 2026-08-26 note): a falsified-claim sweep written manual-compaction-shaped missed a "the one .kit/ writer" only-claim and a "this report never produces them" never-claim in the same changeset. The curator charter's sweep recipe (`plugins/claude-kit/agents/docs-curator.md`, the counted-or-ordinal line near :52) searches digits, number-words, ordinals, and `only/sole/single/unique`; never-claims and the "the one X" spelling fall outside its token list, and the recipe does not state the class the tokens instantiate.
- The fix-round instance (reported, 2026-08-26 note, confirmed by that session at the sites): Section 7 of `docs/archive/claude-kit_memory-anchors-and-frontmatter-guard_spec_v1.md`, whose fix-round delta put a network stand-down 60 to 90 lines downstream of the walk that hangs, every existing test pinned the store and routed around it, and the nearly-skipped review round is what caught it. `plugins/claude-kit/skills/executing-work/SKILL.md` names the fixes-then-re-review cycle (stagger rule, :301) and nowhere states when a fix delta owes a round.
- The late-section instance (reported, 2026-08-26 note): a Critical in a final adversarial round found a skill file describing behavior a later section of the same plan had corrected, the file sitting in that section's own `Files in scope:` the whole time; executing-work's step 5 updates the spec to match reality and no step re-opens a previously-written document whose subject a later section changed.
- The whole-document instance (reported, 2026-08-26 note): the finishing pass found a broken positional back-reference ("the two paragraphs above") and a verb drift between sibling docs; `plugins/claude-kit/skills/finishing-work/SKILL.md` step 3 dispatches `prose-reviewer` "over every document in scope" without stating that the read is of whole documents rather than diffs.
- The register evidence (operator, 2026-08-26, keyboard; the operator memory `scott-reads-plain-language-over-technical` holds the verbatim, read with `memq get` since the store lives outside the repo): reading a plain rewrite of a technical list, the operator reported the plain version beat the technical one even for items he knew. The calibration sentence lives inside the register bullet, present in three copies: both doctrine copies, `plugins/claude-kit/skills/operating-instructions/SKILL.md` and `home/claude-kit-doctrine.md`, held identical by `test/doctrine-parity.test.js` (path constants :35-:37), and the register-core region of `plugins/claude-kit/output-styles/kit.md`, held identical to the doctrine's copy by `test/output-style-parity.test.js` (style path constant :35). The `KIT-REGISTER-CORE:BEGIN/END` markers themselves exist only in `kit.md`; in the two doctrine copies the compared region is defined by the parity tests, not by markers, so the executor derives the block's extent there from the tests.

## Approach

- **Each rule lands on the surface that fires at its moment, once.** The clearance rule fires when review output is weighed, so it lives in responding-to-review; the tool-run rule fires when a brief is written and when a reviewer reads, so it lives in the brief template and the charters; the sweep class fires inside the curator, the fix-round and re-open rules inside executing-work's loop, the whole-document scope inside finishing-work's roster, and the register default inside the register bullet. No rule is restated on a second surface; pointers only, per writing-skills' one-owner rule.
- **Prose amendments to dense skills take the whole-file review brief** (Standing Amendment 1 below), because this class of change has a recorded defect mode: the new paragraph is right and an unchanged neighbour now contradicts it.
- **Parity edits land byte-identically or not at all.** Sections 3 and 5 touch parity-held text; the mid-edit red proves the identity check sees the change (edit one copy, run the parity suite red, land the remaining copies, run it green), and Section 5 states the procedure in full where it applies.

## Standing Brief Amendments

1. A section amending any skill or charter file briefs its sighted reviewers to read each amended file whole, never the diff alone, because the defect class for skill amendments lives in the seam with unchanged neighbours (project memory `skill-amendments-collide-with-neighbours`; the kaizen batch's round-8 blind review returned eleven neighbour defects on exactly this brief). The blind lens keeps its own contract untouched.
2. Every quoted current-text phrase in these sections is re-read from the file at implementation time, never trusted from this spec: the testing-discipline plan edits two of the same files first, so this spec's quotations are authoring-time anchors, not current text.
3. Each section records its own suite baseline at its open and reports its gate delta against that baseline, never against a sibling section's.

## Sections of Work

### 1. A clearance is weighed like a finding, and a tool-printed claim names a tool run

Model: opus

Two amendments with one owner each:

- `plugins/claude-kit/skills/responding-to-review/SKILL.md` gains the symmetric half of its finding rule, beside the corroboration section: a reviewer's explicit clearance ("this line is fine", "no issue here") is a claim of the same standing as a finding, never adoptable on the agent's word alone; and when two lenses return contradicting verdicts on one passage, neither verdict is adoptable as such, and the orchestrator's own trace of the code settles it, recorded with the evidence. The split-verdict instance above is the evidence to cite in the rule's own justifying clause.
- The tool-run anchor, at its two firing surfaces: `plugins/claude-kit/skills/executing-work/SKILL.md`'s Dispatch Brief assertion-marking bullet gains the clause that a claim whose subject is what a tool prints is confirmed only by a run of that tool, with document agreement never sufficing; and the sighted reviewer charters (`plugins/claude-kit/agents/adversarial-reviewer.md`, `plugins/claude-kit/agents/prose-reviewer.md`) gain the reviewer half: a change asserting what a tool prints is checked against a run where the charter's tools allow it, and reported as unverified-on-documents where they do not. The blind charters are untouched: their input contracts exclude the spec-side context the rule keys on.

Tests: grep `test/` for pins over every line touched before editing (doctrine-parity pins executing-work text); any matching pin re-derived red-then-green; full suite delta zero against the baseline this section records.

Files in scope: `plugins/claude-kit/skills/responding-to-review/SKILL.md`, `plugins/claude-kit/skills/executing-work/SKILL.md`, `plugins/claude-kit/agents/adversarial-reviewer.md`, `plugins/claude-kit/agents/prose-reviewer.md`, `test/doctrine-parity.test.js` (only where a pin matches).

### 2. The claim sweep states its class and widens its tokens

Model: sonnet

`plugins/claude-kit/agents/docs-curator.md`'s sweep recipe (the counted-or-ordinal line and its siblings): state the class the tokens instantiate, absolute and exclusive claims a change can falsify, and close the enumeration with it per writing-skills' closed-enumeration rule, so an author generalizes from the class rather than from the triggering incident. Widen the token list with the two recorded misses: never-claims (`never`, `no <x> can`, `nothing`) and the "the one X" spelling of an only-claim. The recipe stays a recipe: tokens are instances, the class sentence is the boundary.

Tests: grep `test/` for pins over the charter's edited lines first; suite delta zero.

Files in scope: `plugins/claude-kit/agents/docs-curator.md`.

### 3. A qualifying fix delta owes a round, and a falsified document is re-opened

Model: opus

Two executing-work amendments:

- **The owed round.** At the point where fix rounds are adjudicated, state: a review round over a fix delta is owed, never optional, when the delta touches an outward action or adds a module, because a green suite cannot see a goal every test in the area routes around (the memory-anchors Section 7 instance is the citation). Below that bar the existing trivial-section judgment stands.
- **The re-open rule.** At step 5 (spec-matches-reality): when this section changed behavior that a document inside any completed section's `Files in scope:` describes, that document re-opens in this section's round, its describing passages re-read against the new behavior, because a later section that corrects a behavior an earlier section documented silently owns that document and no diff-scoped review can see a file nobody edited. State it as a check the closing section runs, keyed on the observable (the behavior changed and a prior section's scope names a document describing it), not as a curator duty, since the finishing curator reads for drift against code and only where it happens to look.

Tests: grep `test/` for pins over every line touched (`test/doctrine-parity.test.js` pins executing-work text; the pin sites sit in that test file at :380 and :451-:453, not in the skill); any matching pin re-derived red-then-green; suite delta zero.

Files in scope: `plugins/claude-kit/skills/executing-work/SKILL.md`, `test/doctrine-parity.test.js` (only where a pin matches).

### 4. The finishing document pass states its whole-document scope

Model: sonnet

`plugins/claude-kit/skills/finishing-work/SKILL.md` step 3's document leg: state that the prose pass reads each document whole, never as a diff, and that this is the structural reason it exists beside the per-section passes, a section-scoped reviewer seeing the insertion but not what the insertion invalidated paragraphs away; name the two recorded catch classes (a positional back-reference broken by later insertions; verb drift between sibling documents describing one behavior) as instances and close with the class.

Tests: grep `test/` for pins over the edited lines (doctrine-parity pins finishing-work's unavailability text; the edit is elsewhere in the file, so expect no hit, and prove it by the grep rather than assumption); suite delta zero.

Files in scope: `plugins/claude-kit/skills/finishing-work/SKILL.md`, `test/doctrine-parity.test.js` (only where a pin matches).

### 5. The register takes the plain floor, in all three parity copies

Model: opus

Amend the calibration sentence inside the register bullet ("Calibrate depth to demonstrated ground, never assumed expertise..."), byte-identically in the three copies that carry it: `plugins/claude-kit/skills/operating-instructions/SKILL.md`, `home/claude-kit-doctrine.md`, and the register-core region of `plugins/claude-kit/output-styles/kit.md` (whose `KIT-REGISTER-CORE` markers bound it there; in the doctrine copies the parity tests define the compared region). The tuning inverts: plain language is the standing default even where the reader holds the vocabulary, because plain for a known concept costs a skim while technical for an unknown one silently costs comprehension; demonstrated vocabulary is permission for technical depth, spent only where precision is load-bearing (an exact value in a decision ask, code itself). The evidence citation stays in this plan and the operator memory, never in the doctrine text, per the state-not-journey rule. Where the output style carries its own non-core calibration line, align it in the same edit. Both parity suites red at the mid-edit point and green at the end; pinned phrases in either suite over the edited sentence re-derived red-then-green.

Tests: `test/doctrine-parity.test.js` and `test/output-style-parity.test.js` mid-edit red, end green; suite delta zero.

Files in scope: `plugins/claude-kit/skills/operating-instructions/SKILL.md`, `home/claude-kit-doctrine.md`, `plugins/claude-kit/output-styles/kit.md`, `test/doctrine-parity.test.js`, `test/output-style-parity.test.js` (each test file only where a pin matches).

## Out of Scope

- The testing-discipline plan's own executing-work and doctrine edits: slate position 1, already in execution; this plan starts after its queue completes and re-reads every shared file then (Standing Amendment 2).
- New review lenses or roster changes: every amendment here tunes an existing surface.
- The seat-infrastructure plan (`docs/plans/claude-kit_seat-infrastructure_spec_v1.md`): slate position 1, its own effort, sharing no files with this one.

## Related

- `docs/archive/claude-kit_testing-discipline_spec_v1.md` (complete and archived; it ran as `docs/plans/claude-kit_testing-discipline_spec_v1.md`): slate position 1; shares `executing-work/SKILL.md` and both doctrine copies as amendment surfaces, which is why this plan is sequenced strictly after it.
- `kaizen/notes-SCOTT-CLAUDE.md`, the seven 2026-08-26 review-and-record notes: the origin, cleared into this spec at authoring.
- Project memories applied in this authoring: `skill-amendments-collide-with-neighbours` (Standing Amendment 1), `an-enumeration-about-a-tool-is-read-from-the-tool` (Section 1), `a-restated-count-is-a-cross-file-invariant` (Standing Amendment 2's shape).

## Chapters
