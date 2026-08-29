# A clearance is a hypothesis, a tool's output is its own fact base, and the register takes the plain floor

Status: In Progress
Commit Model: Commit-and-Push
Created: 2026-08-27

Session model: Opus, in a clean session opened in the kit repo. The running order, recorded in each plan's header and in `docs/plans/README.md`: seat-infrastructure (1), memq-network-cwd-resolver (2), this plan (3), plan-lifecycle-and-diagnostics (4), with testing-discipline complete and archived ahead of the whole queue. The start condition is observable and names its check: this plan starts when `docs/plans/claude-kit_testing-discipline_spec_v1.md` and `claude-kit_memq-network-cwd-resolver_spec_v1.md` both read `Status: Complete` or sit in `docs/archive/`, because that pair edits two of this plan's amendment surfaces (executing-work, both doctrine copies) first. The seat-infrastructure plan shares one file with this one, `plugins/claude-kit/skills/executing-work/SKILL.md` (its Section 3 adds the dispatch-brief box-budget clause), and the queue order already sequences it strictly first; beyond that ordering, the machine's one-suite-at-a-time budget is the only constraint it adds. Authored by the KIT: Expert seat from seven 2026-08-26 kaizen notes on review and record discipline. Anchors as of commit `6a928f7`; re-locate by content.

## Dispatch Authorization

Authorized 2026-08-27 by the operator: arming and execution of the four remaining queue plans by a worker session in this repository on this machine, in order: seat-infrastructure, then memq-network-cwd-resolver, then review-and-record-discipline, then plan-lifecycle-and-diagnostics, each plan honoring its own recorded start condition. This grant supersedes the same date's earlier grant, which placed a three-plan slate behind an armed testing-discipline and memq-network queue: the operator promoted seat-infrastructure ahead of memq-network-cwd-resolver, and the earlier queue's leash did not survive the session that held it, so memq-network-cwd-resolver now carries its own section rather than riding an armed goal. The grant was given at the keyboard of the KIT: Expert session in this repository and is mirrored on that session's account-allowlisted relay thread, which is the artifact holding the operator's words; it is recorded here by reference rather than quotation, per the public-repository convention. One grant covers the four plans, each carrying its own section pointing at it. This section was authored by the KIT: Expert seat on that keyboard instruction; per the peer-sessions trace rule it is a warrant only for a citing session that did not author it, and the receiving session performs its own trace of the grant before arming. That trace takes the form the peer-sessions rule states, provenance rather than credential: it reads this section's recorded claim, the commit that landed it, and the grant's scope against the action in front of it; the relay thread is the operator's own audit surface, not a surface the trace requires opening.

## Goal

Seven review-and-record lessons the kit learned this week exist only as incident reports: a security lens explicitly cleared a trust claim a prose lens correctly called Critical, and only the orchestrator's own trace settled it; two documents agreed the ListAgents roster row carries a working directory, the tool prints none, and two review lenses across two rounds endorsed the false claim because no lens ran the tool; a falsified-claim sweep whose pattern was shaped by the incident that taught it missed two sibling falsehoods in the same changeset; a whole-document prose pass at finishing caught a positional back-reference broken by that effort's own insertions, which a per-section diff reviewer structurally cannot see; a fix-round delta shipped a hang because the round's review was nearly skipped as unnecessary; a late section silently invalidated a document an earlier section had written, with no step to re-open it; and the operator's own reading evidence says the communication register's depth calibration is tuned backwards.

When this plan is done, each of those is a standing rule on the surface that fires at its moment: responding-to-review treats clearances as hypotheses, the reviewer charters and the dispatch brief anchor tool-printed claims to tool runs, the docs-curator's sweep recipe states its class, executing-work owes a review round to qualifying fix deltas and re-opens documents a late section falsified, finishing-work states the whole-document scope structurally, and the register's default is the plain floor in all three parity copies; the dispatch brief and the sighted charters bind a clean check to the rule that refuses each case and a sweep to its exemption dispositions; corroboration excludes evidence the run under review itself authored; the doctrine's index bullet guards both directions of a shared checkout, a file never resting staged while a peer can commit; writing-skills makes the paragraph the edit unit for curated prose, the writer-side half of the whole-file review brief; the testing-discipline box check names its instrument's limits, a clean poll being a sample rather than a clearance; and the doctrine's control rule distinguishes proving the instrument from proving its coverage, a class sweep owing the second.

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

### 6. A clean check names the rule that refuses each case, and a sweep reports its exemptions

Model: opus

Folded 2026-08-28 from the kaizen absence-check note (four instances in one night across four seats, plus a fifth transient-axis shape with no wrong answer in it to notice), operator-approved at the expert session's keyboard. Two amendments, same owner split as Section 1:

- `plugins/claude-kit/skills/executing-work/SKILL.md`'s Dispatch Brief gains the standing clause, both halves: an implementer whose work includes a pin whose subject is a refusal, a sweep expected to come back clean, or a grep whose acceptance is empty output reports it by naming, in words, which rule refuses each case, never by reporting the run green, since a green says the assertion held while naming the mechanism says the assertion was about the thing meant; and a sweep's dispositions include the unchanged, a referrer left unchanged reported with the rule that exempts it, because a complete sweep and a partial one leave behind the same clean grep. The clause closes its enumeration with the class rather than the instances: its subject is any check whose acceptance is an absence, which reaches past the assertion pin and the grep to the readiness poll, the contention gate, and the pre-flight sweep, because a predicate narrower than the class it guards reports the same clear verdict whether the state it was meant to detect is absent or merely unnamed. The worker seat's 2026-08-28 readiness check is the citing instance: a box-free poll keyed to two engine names, its instrument verified against two independent process readers, its predicate blind to the engines it did not list, on a box whose contention rule names every foreign process as the class. The reviewer half below already speaks at this width; this sentence brings the brief half level with it. The clause also carries the coverage half, folded 2026-08-28 from the coordinator's public-surface sweep, where the prescribed positive control passed and two unnamed members of the swept class sat unmatched because a control run against an instance the author named proves the instrument functions and proves nothing about coverage: a check whose subject is a class states what would catch a member the author did not name, a structural pattern over the class's shape where one exists, and where the class can be neither enumerated nor shaped, the report is that the named members are swept and the class is not, never that the sweep is clean.
- The sighted reviewer charters (`plugins/claude-kit/agents/adversarial-reviewer.md`, `plugins/claude-kit/agents/prose-reviewer.md`) gain the lens half: of every clean sweep or absence claim, ask what its control was and which rule refuses each case, and of a control, whether it proves coverage or only function, since a true positive on a named instance says nothing about the members the author could not name; where that account cannot be had, the axis is unproven rather than covered. Of a repeated instrument, ask one ratio question besides: whether the finding count tracks the population, because a count stable while the population turns over entirely is a fixed-budget detector rather than a converging sweep (field instance 2026-08-28: a class table's defect count held at six across rounds whose member populations were disjoint, and the stability was read as convergence until a consult read it as budget).

The seat-infrastructure plan's Standing Brief Amendment 7 is this rule's plan-local instance, landed mid-run there; this section is the durable home, and the two compose rather than duplicate, the amendment remaining that plan's record.

Two field instances from the seat-infrastructure Section 2 run ride in this record because they test the clause from the side the founding instances could not (both reported: the worker's implementer report, routed to this seat by the coordinator 2026-08-28, no run re-read from here). Every founding instance was an author catching their own check, and three of the four finders were the seat that wrote the check. The transferability datum is the referrer table: the dispatching brief enumerated a sweep's referrers, the implementer found three more in `docs/archive/`, left all three unchanged under the same append-only-history rule the table's entries took, and reported the table as short by three with the exempting rule stated rather than quietly matching it. Nothing in the doctrine instructs an implementer to report an orchestrator's enumeration as short; that behavior exists only in the clause's dispositions half, so a stranger following it against its own author's brief is the evidence that the clause is an instrument rather than a sentiment, catching exactly the enumeration-read-as-boundary failure the half exists to surface. The second instance claims less and is recorded at its established size: the same implementer, whose brief asked only for an account of which rule refuses each case, built a control for its banned-punctuation sweep before reporting the silence, a file holding one planted instance, the pattern run against it and heard. The machine's global CLAUDE.md imports the kit doctrine (confirmed by file read, 2026-08-28), dispatched agents load it, and the doctrine's general control rule matches the behavior almost to the letter, sibling-subject fallback included. So what this second instance evidences is the doctrine's rule reaching a surface its text does not obviously name, a prose sweep rather than a test, which supports this section's own claim that the class is wider than the instances any rule lists; it does not establish that the clause transfers, and is not recorded as though it did.

Tests: grep `test/` for pins over every line touched; any matching pin re-derived red-then-green; suite delta zero against this section's own baseline.

Files in scope: `plugins/claude-kit/skills/executing-work/SKILL.md`, `plugins/claude-kit/agents/adversarial-reviewer.md`, `plugins/claude-kit/agents/prose-reviewer.md`, `test/doctrine-parity.test.js` (only where a pin matches).

### 7. An artifact the run authored is not corroboration

Model: opus

Folded 2026-08-28 from the coordinator-raised, worker-confirmed instance, operator-approved at the expert session's keyboard: a fixture invented a registry journal the directory contract does not define, and two independent reviewers then cited the invention as evidence the tier needed a union merge, agreement manufactured by an artifact the run itself authored, which looks like ground truth to every downstream reader while nothing about reading it says who wrote it.

- `plugins/claude-kit/skills/responding-to-review/SKILL.md`'s corroboration section gains: two findings converging on evidence the run under review itself authored (a fixture, a stub, a generated artifact) are one finding, not two; corroboration requires evidence originating outside the run, and a claim about a contract cites the contract's owning surface, which outranks any artifact written to exercise it.
- The sighted charters gain the reviewer half: a fixture is an assertion by a test author, never evidence of a contract. The blind charters stay untouched, preserving their minimal input contract; a blind lens's fixture misread is caught at the orchestrator's corroboration step, which is the rule above.

Tests: grep `test/` for pins over every line touched; any matching pin re-derived red-then-green; suite delta zero against this section's own baseline.

Files in scope: `plugins/claude-kit/skills/responding-to-review/SKILL.md`, `plugins/claude-kit/agents/adversarial-reviewer.md`, `plugins/claude-kit/agents/prose-reviewer.md`, `test/doctrine-parity.test.js` (only where a pin matches).

### 8. The index rule gains its second direction, and a file never rests staged

Model: opus

Folded 2026-08-28 from the shared-checkout sweep the two live seats reconstructed from opposite ends (expert commit `92b3e2d` adopted a worker hunk staged in the seconds between the expert's staged-list read and its pathspec-less commit; both sides followed the existing rule as written): the doctrine's index bullet reads the shared surface in one direction only. The staged-list read protects a committer from sweeping a peer's staged work into its own commit; nothing protects a session's own staged work from a peer's commit, because that session's protective read runs at its own commit, after the peer's commit already had its opportunity. The window is the interval between one session's `git add` and its own `git commit`, and composing a commit message inside it is exactly the shape careful practice encourages. When the window fires, the casualty is the record rather than the content: the hunk lands under a message about something else and its rationale exists nowhere in git.

- The doctrine's staging bullet, in both parity copies (`home/claude-kit-doctrine.md` and `plugins/claude-kit/skills/operating-instructions/SKILL.md`), gains the second direction beside the existing staged-list-read sentence: on a checkout another session may commit to, a file never rests staged; stage and commit in immediate succession with the staged-list read between them, or commit by pathspec from the worktree where the bullet already sanctions it. And commit and push are separate steps with the landed commit's own file list read between them, stated as the repair leg rather than the cause leg: it cannot prevent a sweep, but it converts a published one into an amendable one.

Tests: `test/doctrine-parity.test.js` red mid-edit, green at end, per Approach's parity procedure; pinned phrases over the edited bullet re-derived red-then-green; suite delta zero against this section's own baseline.

Files in scope: `home/claude-kit-doctrine.md`, `plugins/claude-kit/skills/operating-instructions/SKILL.md`, `test/doctrine-parity.test.js` (only where a pin matches).

### 9. The paragraph is the edit unit for curated prose

Model: sonnet

Folded 2026-08-28 from the seat-infrastructure Section 2 run (reported: the worker seat's account, no round re-read from here): that section took four review rounds, and three returned a Critical of one class in curated prose the main thread had written, an edit correcting one claim while a neighbouring clause in the same paragraph, or the same claim on a sibling document, went on saying the old thing. The distribution is part of the evidence: every Critical was in main-thread prose and the dispatched implementer produced zero across the same rounds, because an implementer edits named files under a brief with a reviewer behind it, while the orchestrator makes scattered corrections to curated documents between rounds with no brief and no reviewer between the edit and the commit; the failure needs that gap. The rule also caught its own author twice inside the section that wrote it, and one catch reaches past the paragraph: a sentence-level edit turned two sibling documents from stale-and-agreeing into stale-and-contradicting, so the true unit is the claim across its carrying surfaces, the paragraph being its smallest case. That plan's Standing Brief Amendment 8 is the plan-local instance; this section is the durable home, composing with it exactly as Section 6 composes with that plan's Amendment 7.

- `plugins/claude-kit/skills/writing-skills/SKILL.md` gains the writer-side rule: when amending a curated document, the edit unit is the paragraph and never the sentence. Re-derive the whole paragraph from the corrected claim, then check the claim's other carriers, the neighbouring clauses that qualified or restated it and any sibling document stating the same behavior, because a sentence patch leaves the seam speaking the old claim. This is the writer-side half of the discipline whose reviewer-side half already exists (this plan's Standing Amendment 1 briefs reviewers to read amended files whole); the reviewer brief catches the residue, this rule stops producing it. The surface is writing-skills rather than a dispatch template because the recorded writer was the main thread, which no brief reaches.
- `plugins/claude-kit/skills/executing-work/SKILL.md`'s fix-round step gains a one-line pointer to the rule, never a restatement, per Approach's one-owner rule: the recorded incidents all fired at that step's moment, an orchestrator correcting curated prose between rounds, which is a moment executing-work is loaded and writing-skills may not be.

Tests: grep `test/` for pins over the edited lines; any matching pin re-derived red-then-green; suite delta zero against this section's own baseline.

Files in scope: `plugins/claude-kit/skills/writing-skills/SKILL.md`, `plugins/claude-kit/skills/executing-work/SKILL.md`, `test/doctrine-parity.test.js` (only where a pin matches).

### 10. The box check names its instrument's limits, and a clean poll is a sample rather than a clearance

Model: sonnet

Folded 2026-08-28 from the coordinator seat's measured finding (reported: three polls across roughly two minutes returning three different pictures of one continuous stretch of work; in-process agent fan-out invisible to the process table; idle build servers reading identically to live builds), dispositioned under the coordinator's standing kaizen authority and routed here by the expert seat because the box check is this skill's surface. The seat-infrastructure plan's Section 3 claim-file amendment carries the claim-protocol half, retiring the process list as that protocol's verdict; this section is the testing-discipline half, and the two compose rather than duplicate: neither surface restates the other's rule, and each cites the shared lesson in its own justifying clause.

- `plugins/claude-kit/skills/testing-discipline/SKILL.md`'s box-check paragraph gains the instrument statement: the check's poll is a sample, never a clearance. The general form rides with the rule because it is the rule's boundary: a sampling instrument cannot see work whose lifetime is shorter than its interval, no cadence repairs that, and only the participant's own declaration does. Three consequences, stated where the check lives: a clean poll licenses a spawn only alongside the claim surface where one exists (the role skill's claim file, once the seat-infrastructure plan lands it, with the poll standing alone before then and its weakness named); a poll's presence reading stays actionable, since a live foreign engine is real contention even where an idle build server can masquerade as one, the cost of waiting being bounded where the cost of colliding is not; and a run that dies partway through remains contention evidence regardless of any clean poll that preceded it, which the doctrine's machine-budget bullet already states and this paragraph cross-references rather than restates.

Tests: grep `test/` for pins over the edited paragraph; any matching pin re-derived red-then-green; suite delta zero against this section's own baseline.

Files in scope: `plugins/claude-kit/skills/testing-discipline/SKILL.md`, `test/doctrine-parity.test.js` (only where a pin matches).

### 11. A control proves the instrument; a class sweep also proves its coverage

Model: opus

Folded 2026-08-28 from the coordinator seat's public-surface sweep, dispositioned under the standing kaizen grant, and the incident is the rule's own success signal firing on an inadequate check: the sweep's author ran the doctrine's prescribed positive control, watched it speak, and reported a clean result, while two further machine names of the same class sat unmatched in a live spec because no literal the author knew could name them; an outside seat holding different knowledge found them, and nothing in the rule's loop could have. The control proved the grep functioned. The question the rule never asked is whether the pattern list covered the class. The same night supplied the repair's proof at both of its jobs, before the section existed. The worker seat, handed the retraction, re-ran its own close as a class sweep and its control found a known hostname by shape without ever being given the string, the verification case. The coordinator seat then ran the structural form over the payload and surfaced a machine name it had never seen and could not have searched for, in a shipped worked example, the discovery case, which the founding incident's literal sweep was blind to by construction.

- The doctrine's control rule, in both parity copies (`home/claude-kit-doctrine.md`, `plugins/claude-kit/skills/operating-instructions/SKILL.md`; the compared region is defined by `test/doctrine-parity.test.js`, not by markers), gains the distinction beside the existing run-the-control sentence, the paragraph the edit unit: a control run against an instance the author named proves the instrument functions and proves nothing about coverage; a check that proves an absence over a class also answers whether it can find an instance the author did not name, with a structural pattern over the class's shape the first reach where the class has one, and where the class can be neither enumerated nor shaped, the honest report is that the named members are swept and the class is not, never that the sweep is clean. Section 6 carries the brief and charter halves of this same distinction; the doctrine copy is the always-loaded one, and each surface speaks in its own register without restating the other, per Approach's one-owner rule read as it is there: complementary halves at their firing moments, pointers otherwise.

Tests: `test/doctrine-parity.test.js` mid-edit red and end green per Approach's parity procedure; any pin over the edited paragraph re-derived red-then-green; suite delta zero against this section's own baseline.

Files in scope: `home/claude-kit-doctrine.md`, `plugins/claude-kit/skills/operating-instructions/SKILL.md`, `test/doctrine-parity.test.js` (only where a pin matches).

### 12. The doctrine's box check states the same instrument limit its owning skill does

Model: opus

Appended 2026-08-29 during this plan's own execution, from the wave-1 review round: Section 10 gave the testing-discipline skill's box check its instrument statement, and the two doctrine copies still present the process poll as the whole pre-suite check. The two are the same rule at two points of action, and `test/doctrine-parity.test.js` says so in its own assertion message, that a session loading only one of them must get the same check. That stated invariant is now false while the pin stays green, because the pin asserts the substrings `whatever its engine` and `running engine` and the divergence touched neither. The doctrine is the always-loaded surface, so a session that never loads the skill performs exactly the check the skill now calls insufficient.

- The doctrine's box-check bullet, in both parity copies (`home/claude-kit-doctrine.md`, `plugins/claude-kit/skills/operating-instructions/SKILL.md`; the compared region is defined by `test/doctrine-parity.test.js`, not by markers), gains the leg the skill now carries: the poll is a sample rather than a clearance, and its presence reading and its absence reading are not worth the same, since a live foreign process is contention while an empty poll is a sample that saw nothing. The bullet states the limit and defers the claim protocol to its owner rather than restating it, per Approach's one-owner rule, so the doctrine copy gains no protocol mechanics. The paragraph is the edit unit, and the two copies land byte-identically or not at all.
- The pin gains the leg it is missing. `test/doctrine-parity.test.js`'s box-check test currently ties the doctrine bullet and the skill bullet together on two substrings that a divergence of this shape slips past. Extend it so the invariant its own message states is actually asserted: whatever phrase carries the sample-not-clearance leg is pinned on both surfaces, so the next amendment to either cannot silently re-open the gap.

This section exists because the wave-1 finding could not fold into Section 10: the doctrine copies sit outside that section's `Files in scope:`, the parity edit carries its own red-then-green acceptance, and the pin extension is a test change Section 10 was explicitly barred from making.

Tests: `test/doctrine-parity.test.js` red at the mid-edit point (one copy edited, the other not) and green at the end, per Approach's parity procedure; the extended pin re-derived red-then-green, its red proven by reverting the skill-side leg and watching the new assertion speak rather than by assuming it would; suite delta zero against this section's own baseline.

Files in scope: `home/claude-kit-doctrine.md`, `plugins/claude-kit/skills/operating-instructions/SKILL.md`, `test/doctrine-parity.test.js`.

## Out of Scope

- The testing-discipline plan's own executing-work and doctrine edits: slate position 1, already in execution; this plan starts after its queue completes and re-reads every shared file then (Standing Amendment 2).
- New review lenses or roster changes: every amendment here tunes an existing surface.
- The seat-infrastructure plan (`docs/plans/claude-kit_seat-infrastructure_spec_v1.md`): slate position 1, its own effort, sharing only `executing-work/SKILL.md`, which the queue order sequences it into strictly first.

## Related

- `docs/archive/claude-kit_testing-discipline_spec_v1.md` (complete and archived; it ran as `docs/plans/claude-kit_testing-discipline_spec_v1.md`): slate position 1; shares `executing-work/SKILL.md` and both doctrine copies as amendment surfaces, which is why this plan is sequenced strictly after it.
- `kaizen/notes-SCOTT-CLAUDE.md`, the seven 2026-08-26 review-and-record notes: the origin, cleared into this spec at authoring.
- Project memories applied in this authoring: `skill-amendments-collide-with-neighbours` (Standing Amendment 1), `an-enumeration-about-a-tool-is-read-from-the-tool` (Section 1), `a-restated-count-is-a-cross-file-invariant` (Standing Amendment 2's shape).
- `docs/plans/claude-kit_seat-infrastructure_spec_v1.md` (slate position 2, closing ahead of this plan): its per-section and finishing findings shaped this plan's later sections, and its Related section carries the pointer back.
- `docs/backlog.md`, the claim-protocol review-instrument item (2026-08-28, parked from that plan's Section 4 close): the two one-directional enumeration tables and the specified-but-unbuilt state model keyed on claim state, transition, and both harm directions. This plan is one of that item's named signals; a session reaching this plan's review-instrument territory reads the item and resolves its two open design calls (which shipped surface owns the model; what a pin over a review instrument asserts) before building, consulting rather than guessing, since both are design calls the item deliberately left open.

## Chapters

### Chapter 1 - 2026-08-29
Completed: 2. The claim sweep states its class and widens its tokens
Implemented By: implementer-sonnet
Metrics: 1 review round (shared with sections 4 and 10, both lenses at opus/xhigh); 1 pre-review fold round; 1 fix round; NEEDS_CONTEXT 0; escalations 0; consults 0
Decisions / Surprises: the implementer flagged an upstream neighbour in the charter's "Highest yield first" list and rated it non-contradicting; I disagreed and folded it, since that list framed exclusivity purely as a count of one while the amended recipe below it had grown a universal-denial pass, so the two disagreed about what the sweep covers. It went back to the implementer rather than being fixed in the main thread, per this plan's own Section 9 finding that main-thread prose edits between rounds are where the Criticals land. The implementer chose a dedicated Exclusivity claims bullet over widening the counting bullet, on the ground that a never-claim is falsified by one counterexample rather than by a member joining a set, so the counting title would have become false of its own contents. Review then found the section had shipped the very defect it was written against: a closed enumeration whose class sentence was false of two of its four passes. Resolved by stating two classes and closing each. Two further findings were real: the justification rested on a false premise, since the number pass does land on the "one" in "the one X", re-grounded on discrimination rather than absence; and the never-claim schema was a metavariable sitting in a slot that records literal search terms, which would have made every never-claim sweep read clean for the wrong reason.
Assumptions: the brief named two edit sites while the section's Files in scope is the whole charter; I treated the named sites as a starting point rather than a scope boundary, and said so when folding (2026-08-29, section 2).
Review Findings: 3 Major addressed (class sentence false of passes 1 and 2, at both the recipe and the CLAIMS SWEPT sites; false no-digit premise; unrunnable metavariable in the searched field). No Critical, no Minor left open.
Stamps: adjudicated 2, stamped 2 (doctrine-has-a-third-gitignored-copy, which rode verbatim into both reviewer briefs so the gitignored build copy would not be reported as drift; grep-phrase-straddles-a-line-wrap, operator tier, which is why the bullet hunt anchored on single rare words rather than phrases).
Next: 1
Commit Model: Commit-and-Push

### Chapter 2 - 2026-08-29
Completed: 4. The finishing document pass states its whole-document scope
Implemented By: implementer-sonnet
Metrics: 1 review round (shared with sections 2 and 10, both lenses at opus/xhigh); 1 fix round; NEEDS_CONTEXT 0; escalations 0; consults 0
Decisions / Surprises: the spec's own premise was wrong and the blind lens caught it. Section 4 as written credits the finishing prose pass with seeing what a section-scoped reviewer cannot, because that reviewer reads a diff. No section-time document reviewer reads a diff: executing-work's Document Review Brief hands prose-reviewer and blind-reader document paths, and both read whole, so the credited gap does not exist. The real structural reason is time-ordering, which the spec's own example already stated: a section-time read is fixed at its own section, and only the finishing pass runs after every section has landed. The spec section was corrected to match reality per step 5 rather than the implementation being defended. Section 2's new charter bullet also falsified an enumeration two lines below this section's own edit, finishing-work's "a falsified count, enumeration, justification, or path", which mirrored the curator's three sweep bullets one to one; the fix extended it and restated it as instances of the curator's classes rather than their boundary, so a future fifth bullet cannot re-falsify it the same way.
Assumptions: none.
Review Findings: 3 Major addressed (false diff-versus-whole premise, replaced with time-ordering; falsified mirror enumeration in the same file; nothing left open), 2 Minor addressed (closing class narrower than its own second instance, since verb drift between siblings is not visible reading one document end to end; "The pass" restored to "The prose pass", which read literally forbade the changeset-scoped adversarial read the same step mandates). No Critical.
Stamps: covered by Chapter 1's adjudication over the same window; no further record surfaced.
Next: 1
Commit Model: Commit-and-Push

### Chapter 3 - 2026-08-29
Completed: 10. The box check names its instrument's limits, and a clean poll is a sample rather than a clearance
Implemented By: implementer-sonnet
Metrics: 1 review round (shared with sections 2 and 4, both lenses at opus/xhigh); 1 fix round; NEEDS_CONTEXT 0; escalations 0; consults 0
Decisions / Surprises: the implementer corrected my own central pin resolution and was right. I had cleared its target bullet as unpinned after reading fifteen lines of the parity test at :306; that test's second half pins exactly that bullet, and the test's own name says "and in the skill", which I read past. Its edit preserved both pinned substrings and the gate confirmed it. Review then found the first draft restated the claim protocol without the carve-out its owning contract states in terms, that naming contention and proceeding never includes writing the claim, since there is one claim file and a proceeding session that wrote would replace a live holder's record. The blind lens rated it Critical. One change resolved four findings: the restatement became a pointer to the role skill, which removed the hazard, kept the designed-restatement count at two on the two surfaces that enumerate it, dropped a duplicate of executing-work's own presence-and-absence clause, and replaced an unrooted relative path with a resolvable owner. The instrument limit was also wrong in kind: a single pre-spawn read has no interval, so the sampling-interval framing was replaced with the two limits that actually bite a one-shot read, in-process agent fan-out and a neighbour starting after the sample.
Assumptions: the spec hedged the claim surface as existing only once the seat-infrastructure plan landed it; that plan is Status Complete in docs/archive, so the conditional was resolved to the present tense and the hedge kept out of the shipped prose (2026-08-29, section 10).
Review Findings: 1 Critical addressed (unconditional claim-write restatement, reduced to a pointer), 4 Major addressed, 3 Minor addressed. One Major could not be fixed here and became Section 12: the amendment leaves both doctrine copies stating the process poll as the whole pre-suite check, and the parity test that exists to hold the two in step stays green because it asserts two substrings the divergence never touched.
Stamps: covered by Chapter 1's adjudication over the same window; no further record surfaced.
Next: 1
Commit Model: Commit-and-Push

