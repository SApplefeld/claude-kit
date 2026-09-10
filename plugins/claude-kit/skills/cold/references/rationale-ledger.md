# Rationale ledger: cold

This file is the rationale ledger for the documents the `cold` skill owns. Rule text says what happens; this ledger says why; git says when. Nobody loads it by default. A session about to change a rule in one of the documents below reads the entry for the claim it is changing first, so the reason a rule holds is not re-litigated at the next review.

Each document sits under its own heading, which opens with its inventory line (what the document is for, which moments it owns, and when a session loads it) and then carries one entry per claim, retired claims included so the next audit does not re-find them. An entry is keyed by the claim's imperative sentence and carries its class (rule, mechanic, pointer, or rationale-example), its source as file and line, its provenance (the commit, incident, memory or kaizen note that installed it, or `no provenance found`), and its verdict (keep, rewrite, or retire) with the reason. A `C` entry's source line is read at the extraction commit `6bc07fb`; an `R` entry is a claim re-extracted from a hunk the Section 5 merge changed, and its source line is read at the merged commit `d9540ad`. Claim numbers restart under every document heading, and inside a document read in chunks they restart per chunk, so an entry id is unique only under its heading and a chunked document carries the chunk in the id (`c2.C001` is claim C001 of the second chunk); a claim named inside a reason or provenance line of such a document carries the same prefix. A `C` entry whose source hunk the Section 5 merge rewrote reads `retire` and carries a `superseded-by:` line naming the `R` entry that holds the passage at the merged commit; the passage's own verdict is that entry's, so a count of retirements over this ledger leaves those records out. A reason may name the form the judge ruled toward (a pointer at the owner, a split, a fold into a neighbour), because that form is why the verdict is rewrite rather than keep or retire; what a passage becomes is the rewrite plan's to decide, and where the two differ the rewrite plan governs. The target wording a judge proposed rides on the entry's `proposed:` line, one line per distinct proposal, on rewrite and retire entries that retire a passage; a proposal that pointed at another ruling by id carries the resolved text marked `(via Annn)`. A rewrite or retire the judge flagged as behavior-shaping carries `baseline-test: yes`, which is what the rewrite plan's RED and GREEN step keys on. What a passage becomes is the rewrite plan's to decide (`claude-kit_corpus-rewrite_spec_v1.md` under `docs/plans/`), and where it and a proposal differ the rewrite plan governs.

## plugins/claude-kit/skills/cold/SKILL.md

This document is the kit's cold-evaluation lens: a standing procedure for judging a non-code decision neutrally when the operator's own preference, ownership, enthusiasm, or wanted answer is built into how the question was asked. It owns the moment a session decides whether an ask is a Cold turn, the moment it strips evaluative framing while keeping factual anchors, the ground rules for when a read may be revised, and the shape of the output it returns (short form or full form with its named sections and confidence scale). It also owns the routing away from itself for code, diffs, specs, architecture, already-agreed execution, and neutral lookups. Load class: `named-trigger` - the description says it is used for non-code go/no-go calls and for moments like "is this a good idea?", "should I do X?", or "are you sure?" asked with no new evidence, so a session loads it before evaluating such a decision rather than at session or plan start.

Extracted at `6bc07fb`: whole document (`skills.cold.SKILL.md`).

### C001
- key: Use this cold-evaluation lens for non-code go/no-go judgment calls where the framing carries a preference, ownership, enthusiasm, or a wanted answer.
- class: rule
- source: plugins/claude-kit/skills/cold/SKILL.md:3
- provenance: 6f848ad 2026-06-14, the skill's install as the kit's sycophancy lens "tuned to my personality"; 0e47170 2026-07-15 trimmed the description to trigger-only.
- verdict: keep
- reason: The description is the harness's load trigger, read before the body exists to a session; its quoted specimen asks are the match strings, so it can be neither deleted nor pointed at the body.

### C002
- key: For code, diffs, specs, or architecture, go to the adversarial-reviewer agent instead of this lens.
- class: pointer
- source: plugins/claude-kit/skills/cold/SKILL.md:3
- provenance: 6f848ad 2026-06-14, the skill's install.
- verdict: keep
- reason: A harness-surface exclusion that stops the selector loading cold for code; the body's When-not-to-use line (C041) is the whole routing rule and both stay.

### C003
- key: Treat sycophancy as most costly on these calls, because no compiler or test suite contradicts a confident agreeable answer and the pull to agree is strongest where the operator is most invested.
- class: rationale-example
- source: plugins/claude-kit/skills/cold/SKILL.md:8
- provenance: 6f848ad 2026-06-14, the skill's install; ba1060b 2026-08-18 reworded only the neighbouring roster clause (review agents pointed at artifacts, not code alone).
- verdict: retire
- reason: The why of the lens: on a judgment call nothing mechanical contradicts an agreeable answer, and the operator's investment is where agreement pulls hardest. The trigger and the job are obeyable without it, so it lives here; flagged for baseline-testing because it opens the skill's calibration paragraph.
- proposed: Drop the "Sycophancy is most expensive exactly here..." sentence from line 8; the ledger entry for C003 carries the rationale.
- baseline-test: yes

### C004
- key: Make the answer track the evidence rather than the framing, instead of aiming to be critical.
- class: rule
- source: plugins/claude-kit/skills/cold/SKILL.md:10
- provenance: 6f848ad 2026-06-14, the skill's install.
- verdict: keep
- reason: Cold owns the verdict moment per the ownership map and the doctrine's Match-my-precision bullet already points at cold by name; the passage rewrite at A008 removes only the C007 clause.

### C005
- key: Agree when the evidence supports agreement and push back when it does not.
- class: rule
- source: plugins/claude-kit/skills/cold/SKILL.md:10
- provenance: 6f848ad 2026-06-14, the skill's install.
- verdict: keep
- reason: The agree-when-supported half is stated only here and is the bound that keeps the lens from over-firing; the doctrine's Disagree-up-front bullet states the other half for every turn, a different register.

### C006
- key: Never manufacture an objection in order to look rigorous.
- class: rule
- source: plugins/claude-kit/skills/cold/SKILL.md:10
- provenance: 6f848ad 2026-06-14, the skill's install.
- verdict: keep
- reason: The bar on the over-firing direction; C037 is its output act in the Strongest-objection slot, and both stay.

### C007
- key: Treat an over-firing skeptic as no better calibrated than a yes-man, since it trains the reader to ignore the output.
- class: rationale-example
- source: plugins/claude-kit/skills/cold/SKILL.md:10
- provenance: 6f848ad 2026-06-14, the skill's install.
- verdict: retire
- reason: The why of C006: an objection manufactured to look rigorous miscalibrates the lens exactly as agreement does, and a reader who learns the objections are padding stops reading them. C006 is obeyable without it; retired to this ledger with the A008 rewrite.
- proposed: Removed with the A008 rewrite of line 10; the ledger carries the why.
- baseline-test: yes

### C008
- key: Diagnose a turn as a Cold turn when the ask carries a baked-in answer or a personal stake, not merely a question.
- class: rule
- source: plugins/claude-kit/skills/cold/SKILL.md:14
- provenance: 6f848ad 2026-06-14, the skill's install.
- verdict: keep
- reason: The loaded-body diagnosis rule; the frontmatter (C001) is the harness's trigger for the same condition and the two serve different readers (A001, A003).

### C009
- key: Count an irreversible personal move as the first-ranked trigger: exits, formations, buyouts, hires and fires, large financial commitments, relationship-altering moves.
- class: mechanic
- source: plugins/claude-kit/skills/cold/SKILL.md:16
- provenance: 6f848ad 2026-06-14, the skill's install.
- verdict: keep
- reason: no finding

### C010
- key: Count emotional attachment or identity as a trigger: a long-wanted project, a sunk cost, "I've always believed," a plan already half-committed to out loud.
- class: mechanic
- source: plugins/claude-kit/skills/cold/SKILL.md:17
- provenance: 6f848ad 2026-06-14, the skill's install; a8770b3 2026-06-28 changed voice only.
- verdict: keep
- reason: no finding

### C011
- key: Weight the attachment signal highest because blind spots cluster on what the operator most wants to be true, not on what they know least.
- class: rationale-example
- source: plugins/claude-kit/skills/cold/SKILL.md:17
- provenance: 6f848ad 2026-06-14, the skill's install; a8770b3 2026-06-28 changed voice only.
- verdict: keep
- reason: The only text carrying the operator's weighting of the triggers, and the list's "in order" numbering puts this trigger second, so without the sentence the ranking reads wrong rather than unexplained. A rewrite plan touching the list should reconcile "in order" with this sentence rather than drop either.

### C012
- key: Count a conclusion pre-loaded into the question as a trigger: "this is the right move, isn't it?", "I'm leaning X - agree?", ownership pressure, or a bare "are you sure?" with no new fact.
- class: mechanic
- source: plugins/claude-kit/skills/cold/SKILL.md:18
- provenance: 6f848ad 2026-06-14, the skill's install.
- verdict: keep
- reason: no finding

### C013
- key: Do not apply this lens when none of the triggers is present, such as a neutral lookup, a code review, or executing agreed work.
- class: rule
- source: plugins/claude-kit/skills/cold/SKILL.md:20
- provenance: 6f848ad 2026-06-14, the skill's install.
- verdict: rewrite
- reason: The "does not apply" branch stays at the end of the trigger list so a truncated read of that section meets it, but its example list duplicates the When-not-to-use section, which alone carries the destinations; line 20 keeps the branch and points at When-not-to-use. Safe because the destinations never lived on line 20.
- proposed: (via A016) Line 20 reads "If none is present, this skill does not apply; When not to use routes the ask. Don't wrap an ordinary question in ceremony." and the example list moves out; line 64 is unchanged.
- baseline-test: yes

### C014
- key: Do not wrap an ordinary question in the ceremony of this procedure.
- class: rule
- source: plugins/claude-kit/skills/cold/SKILL.md:20
- provenance: 6f848ad 2026-06-14, the skill's install.
- verdict: keep
- reason: A distinct act from C013: not applying the lens is one thing, answering plainly rather than in the cold shape is another, and no machinery guards over-firing ceremony.

### C015
- key: Strip only the evaluative framing: the stated preference, enthusiasm, doubt, ownership, and the answer being fished for.
- class: rule
- source: plugins/claude-kit/skills/cold/SKILL.md:24
- provenance: 6f848ad 2026-06-14, the skill's install; a8770b3 2026-06-28 changed voice only.
- verdict: keep
- reason: Cold owns the strip-and-judge moment per the ownership map and the doctrine's Match-my-precision bullet points at cold; the two sentences before it ("Cold does not override that") are the bound and the pointer back, and stay. Only the closing metaphor (C017) leaves the passage.

### C016
- key: Keep every factual anchor: the operator's numbers, measurements, file:line references, the real data, and the actual offers on the table.
- class: rule
- source: plugins/claude-kit/skills/cold/SKILL.md:24
- provenance: 6f848ad 2026-06-14, the skill's install; a8770b3 2026-06-28 changed voice only.
- verdict: keep
- reason: The bound on the strip rule, stated beside it as the map requires; the doctrine's anchor duty governs plans and acceptance checks, and the passage already defers to it.

### C017
- key: Remove the thumb on the scale, never the evidence on it.
- class: rationale-example
- source: plugins/claude-kit/skills/cold/SKILL.md:24
- provenance: 6f848ad 2026-06-14, the skill's install; a8770b3 2026-06-28 changed voice only.
- verdict: retire
- reason: A metaphor restating C015 and C016, which are stated literally in the two sentences before it; retired to this ledger with the A020 rewrite.
- proposed: Removed with the A020 rewrite of line 24.

### C018
- key: Treat the operator's framing as context to understand, never as a reason to move the read.
- class: rule
- source: plugins/claude-kit/skills/cold/SKILL.md:28
- provenance: 6f848ad 2026-06-14, the skill's install; a8770b3 2026-06-28 changed voice only.
- verdict: keep
- reason: Cold owns the moment and the doctrine's "context to weigh, never an anchor to honor" is the pointer side; the "are you sure?" mention here is the load-trigger phrase, and the re-check protocol it once sat beside now lives in the doctrine (C022).

### C019
- key: Revise the read only on a new fact, and name the piece of evidence that moved it.
- class: rule
- source: plugins/claude-kit/skills/cold/SKILL.md:29
- provenance: 6f848ad 2026-06-14, the skill's install; the 2026-08-08 bare-challenge kaizen brief quotes it as one of the three hold-under-pushback sites.
- verdict: keep
- reason: The naming duty ("say which piece of evidence moved it") is stated only here; the doctrine's hold-under-pushback bullet and its own-change bullet state the threshold and the admission but not the naming. The bullet's bold lead and its sentence are handle and act, not two statements.

### C020
- key: Verify before concluding whenever it is practical: pull the real numbers, the source, and the history.
- class: rule
- source: plugins/claude-kit/skills/cold/SKILL.md:30
- provenance: 6f848ad 2026-06-14, the skill's install; b99a7fe 2026-08-09 appended the bare-challenge clause to this bullet by the kaizen brief's own design.
- verdict: keep
- reason: The mechanic of cold's own verdict moment and the anchor the re-check pointer (C022) hangs from; the doctrine's Ground-recommendations bullet is the engineering-advice principle in another register.

### C021
- key: When the deciding evidence is missing, state exactly what is missing rather than filling the gap with an agreeable guess.
- class: rule
- source: plugins/claude-kit/skills/cold/SKILL.md:30
- provenance: 6f848ad 2026-06-14, the skill's install.
- verdict: keep
- reason: Not the doctrine's cannot-measure rule, which is about a source that is down and the substitute numbers that do not count; this is about the agreeable guess on a judgment call, and C035 is its output slot.

### C022
- key: On a bare challenge carrying no new fact, re-pull the deciding evidence once more before restating the read.
- class: rule
- source: plugins/claude-kit/skills/cold/SKILL.md:30
- provenance: b99a7fe 2026-08-09, kaizen/archive/2026-08-08-bare-challenge-triggers-recheck.md: three sites entrenched a confident wrong answer under pushback; RED 4/6 under combined pressure, GREEN 5/6 with the clause, control 1/3.
- verdict: rewrite
- reason: The doctrine's Disagree-up-front bullet states the whole protocol, is loaded in every session that loads cold, and is the wording the brief's GREEN probe measured; cold's copy is unpinned by any parity test. Cold keeps the trigger coupling in one sentence and points at the doctrine; baseline-test with cold loaded before shipping, and add the pushback moment to the ownership map naming the doctrine.
- proposed: (via A037) Replace the three re-check sentences on line 30 with one: "A bare challenge ('are you sure?' with no new fact) triggers this rule once more; the doctrine's Disagree-up-front bullet owns the re-check and what its result does to the read."
- baseline-test: yes

### C023
- key: When the re-check reproduces the evidence, hold the read and say what you re-checked.
- class: rule
- source: plugins/claude-kit/skills/cold/SKILL.md:30
- provenance: b99a7fe 2026-08-09, kaizen/archive/2026-08-08-bare-challenge-triggers-recheck.md.
- verdict: retire
- reason: Verbatim in substance with the doctrine's hold-and-say sentence, installed by the same commit from the same brief; the C022 pointer carries it and the doctrine is the owner.
- proposed: Removed by the A037 rewrite; the doctrine's sentence is the rule.
- proposed: (via A037) Replace the three re-check sentences on line 30 with one: "A bare challenge ('are you sure?' with no new fact) triggers this rule once more; the doctrine's Disagree-up-front bullet owns the re-check and what its result does to the read."
- baseline-test: yes

### C024
- key: When the re-check finds the evidence thinner than claimed, treat that as the new fact and downgrade the read out loud.
- class: rule
- source: plugins/claude-kit/skills/cold/SKILL.md:30
- provenance: b99a7fe 2026-08-09, kaizen/archive/2026-08-08-bare-challenge-triggers-recheck.md.
- verdict: retire
- reason: Verbatim in substance with the doctrine's downgrade branch, including the "that finding is the new fact" bound; the C022 pointer carries it and C019 stays as the threshold rule it applies.
- proposed: Removed by the A037 rewrite.
- proposed: (via A037) Replace the three re-check sentences on line 30 with one: "A bare challenge ('are you sure?' with no new fact) triggers this rule once more; the doctrine's Disagree-up-front bullet owns the re-check and what its result does to the read."
- baseline-test: yes

### C025
- key: Separate bundled decisions and score the proposed action on its own merits when a grievance and a bet ride in one sentence.
- class: rule
- source: plugins/claude-kit/skills/cold/SKILL.md:31
- provenance: 6f848ad 2026-06-14, the skill's install.
- verdict: keep
- reason: no finding

### C026
- key: Treat a sound reason to leave something as no evidence that the next thing is good.
- class: rationale-example
- source: plugins/claude-kit/skills/cold/SKILL.md:31
- provenance: 6f848ad 2026-06-14, the skill's install.
- verdict: retire
- reason: The why of C025: a grievance is a reason to leave, not evidence for the bet that rides with it. C025 is obeyable without it; retired to this ledger.
- proposed: Drop " - a sound reason to leave is not evidence that the next thing is good" from line 31.

### C027
- key: Scale the output to the stakes, giving a small call the short form rather than five headers.
- class: rule
- source: plugins/claude-kit/skills/cold/SKILL.md:35
- provenance: 6f848ad 2026-06-14, the skill's install.
- verdict: keep
- reason: The selector between cold's two output shapes, a mechanic of the moment cold owns; the doctrine's match-length rule governs documents and would not tell a session which form to pick.

### C028
- key: In the short form, give the de-framed question in one line, the cold read, and the single strongest objection.
- class: mechanic
- source: plugins/claude-kit/skills/cold/SKILL.md:37
- provenance: 6f848ad 2026-06-14, the skill's install.
- verdict: keep
- reason: no finding

### C029
- key: Use the full form with its seven named sections for irreversible, high-stakes, or emotionally loaded calls.
- class: mechanic
- source: plugins/claude-kit/skills/cold/SKILL.md:39
- provenance: 6f848ad 2026-06-14, the skill's install.
- verdict: keep
- reason: The condition naming which calls take the seven sections; the doctrine's blast-radius bullet is the principle, this is the mechanic.

### C030
- key: In the Neutral restatement section, re-pose the ask as a disinterested third party would, stripped of preference, ownership, and the wanted answer.
- class: mechanic
- source: plugins/claude-kit/skills/cold/SKILL.md:42
- provenance: 6f848ad 2026-06-14, the skill's install.
- verdict: keep
- reason: no finding

### C031
- key: Answer the neutral restatement of the question, not the original framing.
- class: rule
- source: plugins/claude-kit/skills/cold/SKILL.md:42
- provenance: 6f848ad 2026-06-14, the skill's install.
- verdict: keep
- reason: The instruction that makes the Neutral-restatement section an answered question rather than a restatement exercise; a format instruction applying C015 inside its slot, not a second strip rule.

### C032
- key: In the Cold read section, give the direct answer in one to three sentences.
- class: mechanic
- source: plugins/claude-kit/skills/cold/SKILL.md:45
- provenance: 6f848ad 2026-06-14, the skill's install.
- verdict: keep
- reason: no finding

### C033
- key: In the Framing audit section, name the framing that could tip the answer, such as attachment, sunk cost, a baked-in conclusion, or a grievance doing double duty as a business case.
- class: mechanic
- source: plugins/claude-kit/skills/cold/SKILL.md:48
- provenance: 6f848ad 2026-06-14, the skill's install.
- verdict: keep
- reason: no finding

### C034
- key: In the Evidence section, give the strongest evidence for and against, kept separate.
- class: mechanic
- source: plugins/claude-kit/skills/cold/SKILL.md:51
- provenance: 6f848ad 2026-06-14, the skill's install.
- verdict: keep
- reason: no finding

### C035
- key: In the Evidence section, state plainly what evidence is missing and what would be needed to decide.
- class: mechanic
- source: plugins/claude-kit/skills/cold/SKILL.md:51
- provenance: 6f848ad 2026-06-14, the skill's install.
- verdict: keep
- reason: The output slot for C021; a format instruction, not a second rule.

### C036
- key: In the Strongest objection section, give the best case against what the operator wants to hear.
- class: mechanic
- source: plugins/claude-kit/skills/cold/SKILL.md:54
- provenance: 6f848ad 2026-06-14, the skill's install; a8770b3 2026-06-28 changed voice only.
- verdict: keep
- reason: no finding

### C037
- key: Say plainly when there genuinely is no strong objection.
- class: rule
- source: plugins/claude-kit/skills/cold/SKILL.md:54
- provenance: 6f848ad 2026-06-14, the skill's install; a8770b3 2026-06-28 changed voice only.
- verdict: keep
- reason: The output act C006 makes necessary: reporting the absence of an objection in the slot that asks for one, so the slot is never filled by a manufactured one.

### C038
- key: In the Recommendation section, give the call, the confidence level, and exactly what would change it.
- class: mechanic
- source: plugins/claude-kit/skills/cold/SKILL.md:57
- provenance: 6f848ad 2026-06-14, the skill's install; kaizen/archive/2026-08-16-register-confidence-clause.md cites this line as the proven wording lifted into the doctrine's decision-ask register.
- verdict: keep
- reason: no finding

### C039
- key: Use the kit's reviewer confidence scale: high means the deciding evidence was verified this pass, medium means likely with a named check outstanding, low means a lean with what would firm it named.
- class: mechanic
- source: plugins/claude-kit/skills/cold/SKILL.md:57
- provenance: b99a7fe 2026-08-09, kaizen/archive/2026-08-08-unify-confidence-vocabulary.md: cold's "confidence level" had no definition while the reviewer charters define the scale, so a cold "medium" and a reviewer "medium" named different states.
- verdict: keep
- reason: no finding; the brief records why the copy stays beside the reviewer charters' copies (agents run fresh-context and cannot dereference a pointer into a skill).

### C040
- key: In the Next check section, give the smallest practical step to verify before acting.
- class: mechanic
- source: plugins/claude-kit/skills/cold/SKILL.md:60
- provenance: 6f848ad 2026-06-14, the skill's install.
- verdict: keep
- reason: no finding

### C041
- key: Route code, diffs, specs, or architecture to the adversarial-reviewer or security-reviewer instead of this lens.
- class: pointer
- source: plugins/claude-kit/skills/cold/SKILL.md:64
- provenance: 6f848ad 2026-06-14, the skill's install.
- verdict: keep
- reason: The body's routing owner for code-shaped asks; the frontmatter copy (C002) is the harness surface and cannot point here.

### C042
- key: Route the execution of already-agreed work to the executing-work skill instead of this lens.
- class: pointer
- source: plugins/claude-kit/skills/cold/SKILL.md:64
- provenance: 6f848ad 2026-06-14, the skill's install.
- verdict: keep
- reason: The routing line with its destination; line 20's example list (C013) now points here instead of repeating it.

### C043
- key: Answer neutral factual lookups, from-scratch design, and anything with no baked-in answer and no personal stake under the global rules alone.
- class: rule
- source: plugins/claude-kit/skills/cold/SKILL.md:64
- provenance: 6f848ad 2026-06-14, the skill's install.
- verdict: keep
- reason: The routing table's third row and, after the C013 rewrite, the only exclusion list in the loaded body; its arrow form is a table, and recasting it as prose is taste.
