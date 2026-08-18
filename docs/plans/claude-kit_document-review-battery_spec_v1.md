# Document Review Battery

Status: In Progress
Commit Model: Commit-and-Push
Created: 2026-08-18

## Goal

The kit reviews written documents the way it reviews code: with a fresh-context pair whose lenses are chosen for prose rather than diffs. When this is done, a section or effort whose deliverable is a document for a named reader gets (1) a blind reader dispatched as that reader's persona, who receives the documents and nothing about their intent and reports what it understood, what it was left asking, what it could not follow, and (for a procedure) the first step it could not perform; and (2) an adversarial prose reviewer who checks every claim against the fact base, checks the documents against one another, and then hunts style defects, machine-prose tells, and presumed knowledge the named audience does not have. An outward-facing document also voids the prose-only security waiver, so a disclosure sweep runs against a list the spec supplies. Today a docs-only section skips the blind lens entirely and hands the adversarial code reviewer a document it was never chartered to judge; nothing reads a deliverable document as its reader would, and nothing checks whether it presumes knowledge the reader lacks.

## Approach

**Mirror the code pair rather than extend it.** The two code reviewers carry postures that fight the document lenses. `blind-reviewer` forbids reading `docs/` and is charged with "assume the code is wrong"; an outside reader is not hunting defects, it is reporting comprehension. `adversarial-reviewer` is structured as spec compliance then code quality. So two new agents, `blind-reader` and `prose-reviewer`, mirror the pair's shape (blind lens without the intent story, adversarial lens with the spec and the fact base) and reuse two moves the kit already owns verbatim: the contamination test that keeps a blind dispatch blind ("would this sentence read identically for every document in this repository?"), and the accuracy-before-style ordering that mirrors spec-compliance-before-quality.

**The reader is a persona, and the persona is the audience the spec names.** A Fable model told to "read as an outsider" will still read like an expert who has the repository open, and it will silently fill every gap the document leaves from source. So the blind reader is dispatched as a named persona (`Reader:` in its brief, drawn from the section's audience line), and the persona sets what it may open. An operator or engineer persona may read the repository, which is what makes the procedural dry-run possible. A non-technical persona (a customer, non-technical staff, an engineer who did not author the code) receives the documents and nothing else: no repository, no code, no living docs. Every term it cannot resolve from the documents alone, every step that assumes a tool or concept the persona would not have, is a finding that names the concept needing explanation. A document with two audiences gets two readers, one per persona, in the same round.

**Accuracy and style live in one adversarial agent, accuracy first.** Humanizing a sentence can loosen a precise claim, and a style reviewer that never saw the fact base cannot know it did. The prose reviewer runs Pass 1 (goal compliance, every claim against the fact base, cross-document consistency of names and numbers) before Pass 2 (style against the writing skill when the document is in the operator's voice, machine-prose tells always, presumed knowledge against the named audience), so it can itself flag "this sentence reads as machine prose, and the obvious rewrite loosens claim X." The orchestrator adjudicates through responding-to-review as it does for code.

**Disclosure goes to the reviewer that already owns it.** An outward-facing document's security risk is what it reveals. The finishing-work prose waiver was written for kit-internal markdown and is a file-type predicate; it becomes an audience predicate: internal prose keeps the waiver, any document whose audience is outside the operator and the operator's own sessions voids it, and the security-reviewer's brief carries the disclosure list from the spec. No fourth agent.

**The spec supplies what the lenses need to be adjudicable.** A blind reader's "I was left asking X" is only a finding if answering X was the document's job for that reader. So brainstorming requires that any section whose deliverable is prose for a reader carries an audience line naming each persona and its knowledge level, the questions the document must answer for it, the voice (the operator's, company, other), the fact base paths, and (when outward-facing) the disclosure list. A docs-only section that names no audience is not a deliverable document (a plan doc edit, an index refresh) and keeps the existing rule.

**Single-source the machine-prose catalog.** The AI-tell hunt reads a `references/ai-tells.md` under the writing skill that the writer reads too, on the same principle as csharp-style feeding the adversarial reviewer's house-style pass: one contract, two readers, no drift.

**Roster mechanics.** Both agents are read-only judgment agents and join the read-only guard's strict class (`hooks/readonly-agent-guard.js`, the anchored regex at line 71) and its tests. Neither writes, so the docs-write guard needs nothing. The reviewer model rule is unchanged: the pair runs one tier above the writer; an inline document section on the Opus-led execution session reviews at fable.

## Sections of Work

### 1. Machine-prose catalog in the writing skill
Model: opus

Add `plugins/claude-kit/skills/scott-writing-style/references/ai-tells.md`: a catalog of patterns that read as machine-written, each with a one-line why and a rewritten example. At minimum: em dashes; triadic lists as the default rhythm; "it's not X, it's Y" contrast framing; uniform paragraph and sentence length; a bolded lead-in phrase on every bullet; signposting and throat-clearing ("it's worth noting", "importantly", "in essence"); a closing paragraph that restates the body; stacked hedges; the vocabulary set (delve, robust, seamless, comprehensive, leverage, streamline, ensure, crucial, landscape, "in today's"); rhetorical questions as section openers; every section ending on a one-line moral; over-parallel headers; explaining what the reader is about to read before reading it. Add a `## Machine-prose tells` pointer section to `SKILL.md` naming the reference and stating that both a writer and a reviewer of documents in this voice read it. Do not restate the SKILL.md's existing NEVER DO list in the reference; where an item already lives there (em dashes, motivational vocabulary, rhetorical questions), the reference names it in one line and points back.

Acceptance: the reference exists with at least twelve distinct patterns, each carrying a why and a before/after example; SKILL.md points at it; no em dash appears anywhere in either file (`grep -c` for the character returns 0).

Files: `plugins/claude-kit/skills/scott-writing-style/SKILL.md`, `plugins/claude-kit/skills/scott-writing-style/references/ai-tells.md` (new).

### 2. `blind-reader` agent
Model: fable

Create `plugins/claude-kit/agents/blind-reader.md`. Frontmatter: `name: blind-reader`, `tools: Read, Grep, Glob, Bash`, `effort: high`, description in the "Use when" trigger form: blind outside-reader review of a deliverable document, dispatched as a named reader persona with the document paths only, never the spec, plan, or intent; returns a summary-back, unanswered questions, comprehension gaps, presumed knowledge, and for a procedure the first step it could not perform.

Charter, in order:
- **Inputs.** The document paths, a `Reader:` line naming the persona and its knowledge level, and nothing that describes the documents' intent. Carry the contamination test from `agents/blind-reviewer.md` verbatim ("would the sentence read identically for every document in this repository?"), the treatment of a failing sentence (do not open a spec or plan path, note the dispatch as contaminated, review the documents alone), and the read-only rules including the guard paragraph.
- **What the persona may open.** An operator or engineer persona may read the repository to attempt a procedure, read-only. A non-technical persona (customer, non-technical staff, an engineer who did not author the code) opens the documents and nothing else: no repository, no code, no other docs. State why: a strong model with the code open fills the document's gaps from source and never reports them. A term the persona cannot resolve from the documents alone is a finding, not something to look up.
- **Output, in order.** (1) Summary-back: three sentences on what the document is for and what it wants the reader to do or know, written before any finding. (2) Questions the reader was left with. (3) Comprehension gaps: passages that could not be followed, and unresolved terms, each naming the concept that would need explaining for this persona. (4) For a procedural document, the dry-run: which steps it could perform, and the first step it could not, with what was missing (a value, a permission, a tool, a prior state the document never established). Findings are severity-ranked (Critical: a reader of this persona cannot achieve the document's evident purpose; Major: a section fails for this persona; Minor: friction), and the recall-over-precision posture from the code reviewers applies, with the same "no filler" bound.
- **Posture.** The reader is not hunting defects and does not certify the document. It reports its own experience of reading as the persona, and it never proposes prose; rewriting is the orchestrator's and writer's job.

Acceptance: the file parses as agent frontmatter (`name`, `description`, `tools`, `effort`), the contamination test sentence matches `blind-reviewer.md` character for character, the non-technical persona's no-repository rule is stated as a prohibition with its rationale, and the output order above is stated as a contract.

Tests: Section 7 proves the charter with a planted-gap document; this section ships the charter only.

Files: `plugins/claude-kit/agents/blind-reader.md` (new).

### 3. `prose-reviewer` agent
Model: fable

Create `plugins/claude-kit/agents/prose-reviewer.md`. Frontmatter: `name: prose-reviewer`, `tools: Read, Grep, Glob, Bash`, `effort: high`, description in trigger form: adversarial review of a deliverable document against its spec, its fact base, its sibling documents, and its audience; dispatched with the spec path, document paths, audience, voice, fact-base paths, and the writing-style skill path; returns severity-ranked findings tagged by pass.

Charter, in order:
- **Inputs.** Spec path, document paths, `Audience:` (each persona and knowledge level, from the spec), `Voice:` (`scott` | `company` | other), fact-base paths (code, living docs, a canonical numbers table where one exists), the absolute path to the scott-writing-style skill and its `references/ai-tells.md`. If the style path is missing, say so and run Pass 2's tell hunt from the reference's absence noted, never from memory of the rules. Read-only rules and guard paragraph as the other reviewers carry them.
- **Pass 1, goal and accuracy (first).** Does each document answer every must-answer question the spec lists for its audience? Is every claim (a number, a name, a path, a behavior, a version) true against the fact base? Are names, numbers, and terms consistent across the documents in scope? A false claim is Critical; a must-answer question left unanswered is Major; an inconsistency across documents is Major.
- **Pass 2, style and audience.** When `Voice: scott`, check against the writing skill's rules (structure, openers, headers, closers, NEVER DO). Always hunt the machine-prose tells in `references/ai-tells.md`. Always check presumed knowledge against each named audience: a term used before it is explained, a step that assumes tool familiarity the persona lacks, a concept the document leans on and never introduces; for a non-technical persona, jargon density is itself a finding.
- **The conflict rule.** A style finding whose fix would change what a sentence claims must say so and name the claim; the orchestrator adjudicates it against the fact base rather than applying it blind. Never resolve it yourself by choosing the looser wording.
- **Output.** Severity-ranked findings, each tagged `[accuracy]`, `[consistency]`, `[goal]`, `[style]`, `[tell]`, or `[audience]`, each quoting the passage and naming the fix's shape (not the prose), plus a `CLAIMS CHECKED` block naming what Pass 1 verified against which source, drift or none.

Acceptance: the file parses as agent frontmatter, the pass order is stated with accuracy first, the conflict rule is present as a prohibition, and the output tags are enumerated.

Files: `plugins/claude-kit/agents/prose-reviewer.md` (new).

### 4. Read-only guard roster
Model: sonnet

Add `blind-reader` and `prose-reviewer` to the strict class in `plugins/claude-kit/hooks/readonly-agent-guard.js` (the anchored regex at line 71 and the header comment at line 5), and to every enumeration of the strict roster in `test/readonly-agent-guard.test.js` (the loops at lines 100 to 102, 830, and 857, and any other list the file carries; grep the file for `blind-reviewer` and mirror each site). Sibling to mirror: `blind-reviewer` at each site.

Acceptance: `node --test test/readonly-agent-guard.test.js` passes with the two names present; a dispatch payload naming `claude-kit:blind-reader` and one naming `claude-kit:prose-reviewer` each classify as `strict` (assert it in the existing classification test alongside the siblings); `blind-reader-helper` still does not.

Tests: lock both directions for each new name, the way the existing loop does for its siblings.

Files: `plugins/claude-kit/hooks/readonly-agent-guard.js`, `test/readonly-agent-guard.test.js`.

### 5. Skill wiring
Model: fable

Four skills change. Every sentence added is behavior-shaping prose; the writing-skills skill governs form (prohibition plus rationale where an agent would otherwise skip under pressure).

- **brainstorming** (`skills/brainstorming/SKILL.md`): in the Spec format and the section-tier guidance, a section whose deliverable is a document for a reader carries an `Audience:` line naming each persona and its knowledge level, the must-answer questions per persona, a `Voice:` line, the fact-base paths, and a `Disclosure:` list when any persona is outside the operator and the operator's own sessions. State the reason: without the audience and must-answer list, the blind reader's questions cannot be adjudicated. Note that these lines ride in the section body, never on the `Model:` line (the machine contract's bare-token rule).
- **executing-work** (`skills/executing-work/SKILL.md`, step 3 at line 160): replace the docs-only branch. A section carrying an `Audience:` line dispatches the document pair in place of the code pair: `blind-reader` once per persona, with the document paths and the `Reader:` line only, under the same every-diff test and with the same withheld items (spec, plan, section name, intent), and `prose-reviewer` with the full brief. A docs-only section with no `Audience:` line keeps the existing rule (adversarial alone, `blind: no code diff`). The document pair takes the same one-tier-above-the-writer model rule and the same reviewer-effort table, and the Reviewer Dispatch template's `agentType` list gains both names. Add a Document Review Brief template beside the Dispatch Brief carrying the fields Sections 2 and 3 name. Record `review: document pair (<n> readers)` on the Chapter's review line.
- **finishing-work** (`skills/finishing-work/SKILL.md`): step 2's waiver becomes an audience predicate: it holds only when every changed file is prose and no document in the changeset names an audience outside the operator and the operator's own sessions; an outward-facing document voids it, and the security-reviewer's brief then carries the spec's `Disclosure:` list with the instruction to sweep the documents for any item on it. Step 3: when the effort's deliverable is documents, the whole-effort pass dispatches `prose-reviewer` over every document in scope (cross-document consistency is the whole-effort lens) at fable, alongside or in place of the code adversarial pass as the changeset warrants; the blind reader is not re-run at finishing unless a document changed after its section review.
- **security-reviewer** (`agents/security-reviewer.md`): a short "Documents" paragraph under Inputs: when the brief carries a `Disclosure:` list, sweep every document in scope for each item (names, identifiers, paths, internal states, and paraphrases of them), and report each hit as Critical with the passage quoted.

Acceptance: each of the four edits is present and reads consistently with its neighbors; `node --test test/doctrine-parity.test.js test/output-style-parity.test.js` still passes (these edits touch no doctrine copy, and the gate proves it); the executing-work `agentType` list names both new agents; grep for the old `blind: no code diff` branch shows it retained for the no-audience case only.

Tests: this section is prose; Section 7 is its behavioral proof.

Files: `plugins/claude-kit/skills/brainstorming/SKILL.md`, `plugins/claude-kit/skills/executing-work/SKILL.md`, `plugins/claude-kit/skills/finishing-work/SKILL.md`, `plugins/claude-kit/agents/security-reviewer.md`.

### 6. Roster surfaces outside docs/
Model: sonnet

Update every surface outside `docs/` that enumerates the agent roster: `README.md` (the `agents/` tree at lines 36 to 47, one line per new agent, mirroring the `blind-reviewer.md` line's shape), `plugins/claude-kit/.claude-plugin/plugin.json` (`"five review agents"` becomes the true count), and any other enumeration `grep -rn "blind-reviewer" --include=*.md --include=*.json` finds outside `docs/` and outside the files Sections 2 to 5 already own. `docs/security-model.md:131` and `docs/architecture.md` are the docs-curator's at finishing, not this section's.

Acceptance: the grep above returns no roster enumeration missing the two new names, and `plugin.json` still parses (`node -e "JSON.parse(require('fs').readFileSync('plugins/claude-kit/.claude-plugin/plugin.json','utf8'))"`).

Files: `README.md`, `plugins/claude-kit/.claude-plugin/plugin.json`.

### 7. Proof runs
Model: opus
Locus: inline

Prove each charter catches what it exists to catch, the way the kit proves a behavior-shaping skill (RED/GREEN, per writing-skills). Build two fixture documents under the session scratchpad or `.kit/scratch/` (never `docs/`): a short procedural guide with one planted gap (a step that references a value the document never establishes) and one planted undefined term; and a short customer-facing overview in the operator's voice with two planted machine-prose tells from Section 1's catalog, one planted false claim against a named fact base (a kit doc or file), and one planted disclosure item. Dispatch `blind-reader` twice on the guide (an operator persona and a non-technical persona) and `prose-reviewer` on the overview with the full brief; dispatch `security-reviewer` on the overview with the disclosure list. Record in the Chapter, per dispatch: which plants were caught, which were missed, and one verbatim finding. A missed plant is a charter defect: fix the charter (Sections 2, 3, or 5) and re-run that dispatch. Delete the fixtures at the end.

Acceptance: every plant is caught by the lens meant to catch it, on the final run; the non-technical reader's output shows it did not open the repository (its findings cite the documents only); the Chapter carries the per-dispatch record.

Files: none shipped; fixtures are transient.

## Out of Scope

- Changing `blind-reviewer.md` or `adversarial-reviewer.md`; the code lenses are untouched.
- A mechanical cross-document numbers gate (a script over a canonical numbers table). Kept as an agent pass here; a script earns its place once a project supplies the table.
- Reviewing the docs-curator's living-doc output with the pair. The curator's Drift Report is its own gate; a living doc that gains a named audience is a deliverable document and takes the pair through the normal route.
- Doctrine edits. The standing-dispatch bullet already covers "the fresh-context reviewer pair" without naming which pair; the wiring is skill-level.
- A plain-language style reference beyond the presumed-knowledge check in the prose reviewer. Add one if the proof runs or the first real dispatches show the reviewer needs a catalog to hunt from.

## Open Questions

None at creation. Design decided in conversation on 2026-08-18: two new agents rather than a mode on the existing pair; persona-scoped reader access; accuracy before style in one agent; disclosure to the security-reviewer under an audience predicate; audience lines as spec-required inputs.

## Related

Extends the review pair the read-only guard effort made mechanical (`docs/archive/claude-kit_readonly-agent-guard_spec_v1.md`) and the reviewer model and effort rules (`docs/archive/claude-kit_reviewer-effort-compensation_spec_v1.md`); both apply to the new pair unchanged.

## Chapters
