# Rationale ledger: responding-to-review

This file is the rationale ledger for the documents the `responding-to-review` skill owns. Rule text says what happens; this ledger says why; git says when. Nobody loads it by default. A session about to change a rule in one of the documents below reads the entry for the claim it is changing first, so the reason a rule holds is not re-litigated at the next review.

Each document sits under its own heading, which opens with its inventory line (what the document is for, which moments it owns, and when a session loads it) and then carries one entry per claim, retired claims included so the next audit does not re-find them. An entry is keyed by the claim's imperative sentence and carries its class (rule, mechanic, pointer, or rationale-example), its source as file and line, its provenance (the commit, incident, memory or kaizen note that installed it, or `no provenance found`), and its verdict (keep, rewrite, or retire) with the reason. A `C` entry's source line is read at the extraction commit `6bc07fb`; an `R` entry is a claim re-extracted from a hunk the Section 5 merge changed, and its source line is read at the merged commit `d9540ad`. Claim numbers restart under every document heading, and inside a document read in chunks they restart per chunk, so an entry id is unique only under its heading and a chunked document carries the chunk in the id (`c2.C001` is claim C001 of the second chunk); a claim named inside a reason or provenance line of such a document carries the same prefix. A `C` entry whose source hunk the Section 5 merge rewrote reads `retire` and carries a `superseded-by:` line naming the `R` entry that holds the passage at the merged commit; the passage's own verdict is that entry's, so a count of retirements over this ledger leaves those records out. A reason may name the form the judge ruled toward (a pointer at the owner, a split, a fold into a neighbour), because that form is why the verdict is rewrite rather than keep or retire; what a passage becomes is the rewrite plan's to decide, and where the two differ the rewrite plan governs. The target wording a judge proposed rides on the entry's `proposed:` line, one line per distinct proposal, on rewrite and retire entries that retire a passage; a proposal that pointed at another ruling by id carries the resolved text marked `(via Annn)`. A rewrite or retire the judge flagged as behavior-shaping carries `baseline-test: yes`, which is what the rewrite plan's RED and GREEN step keys on. What a passage becomes is the rewrite plan's to decide (`claude-kit_corpus-rewrite_spec_v1.md` under `docs/plans/`), and where it and a proposal differ the rewrite plan governs.

## plugins/claude-kit/skills/responding-to-review/SKILL.md

This document governs how a session weighs and answers review output and operator feedback before acting on either. It owns the moments where a review agent returns findings, where the operator gives feedback or a correction, and where a session is about to implement a suggestion from either source, especially one that looks wrong, unclear, or larger than the problem; it also owns how a session counts corroboration across independent review lenses, how it treats a reviewer's clearance or a pair of contradicting verdicts, how it handles a claim finding's fix brief, and the tone of a review reply. It does not own severity triage itself, which it hands to executing-work's "Address findings" step, nor the claim-finding class and its dispositions, which it hands to executing-work, nor the docs-curator Drift Report route, which it hands to finishing-work. Load class: `named-trigger` - the skill is loaded before a specific act, when review output arrives to be adjudicated, when the operator gives feedback, or before implementing a suggestion from either.

Extracted at `6bc07fb`: whole document (`skills.responding-to-review.SKILL.md`). Re-extracted at `d9540ad` over the hunks the Section 5 merge changed (`R` entries below). Re-extracted at `4b2e64c` over the hunks the Section 8 merge changed (`S` entries below).

### C001
- key: Treat a review finding as an input to your judgment rather than an order, and evaluate it before you act on it.
- class: rule
- source: plugins/claude-kit/skills/responding-to-review/SKILL.md:8
- provenance: 830ff28 2026-06-17, installed with the skill as ported from Daren's fork and session mining; no incident narrated.
- verdict: rewrite
- reason: The rule stands; the paragraph compresses to the rule and its imperative once C002 and C057 move here (A001, A002, A036). Nothing enforces it mechanically, so the rule itself is never a retirement candidate.
- proposed: Reduce line 8 to the rule and its imperative, with the fallibility and operator-standing sentences moved to this ledger.
- baseline-test: yes

### C002
- key: Evaluate findings because the kit's fresh-context review agents catch what you missed yet are fallible and cannot see intent you never wrote down.
- class: rationale-example
- source: plugins/claude-kit/skills/responding-to-review/SKILL.md:8
- provenance: 830ff28 2026-06-17, installed with the skill; no incident narrated.
- verdict: retire
- reason: Motivation only; the operative form (a finding can be wrong, out of scope, or built on context the agent lacked) stays at line 12. The why now lives here: fresh-context lenses see the diff and not the intent, so a finding can be confidently wrong about what the code was for.
- proposed: Move the sentence to this ledger under C002; line 12 keeps the operative fallibility statement.

### C003
- key: Adjudicate every review-agent finding, giving each one an honest verdict.
- class: rule
- source: plugins/claude-kit/skills/responding-to-review/SKILL.md:12
- provenance: 830ff28 2026-06-17, installed with the skill; the enumeration grew in 12ef61f (blind lens) and a5fce80 (document battery, recorded as a deviation because the adjudication rule must reach the new lenses).
- verdict: retire
- superseded-by: S002
- reason: Survives the merge at HEAD line 12 verbatim (f26619c inserted a trace sentence beside it). No hook makes a session adjudicate a finding, and the enumeration is what binds each new lens to the rule; R001 and R003 are this sentence re-read and are retired as duplicates of it. Superseded at `4b2e64c` by S002 (the Section 8 merge; the verdict before it was keep).

### C004
- key: Do not rubber-stamp a finding and do not reflexively defer to it.
- class: rule
- source: plugins/claude-kit/skills/responding-to-review/SKILL.md:12
- provenance: 830ff28 2026-06-17, installed with the skill; no incident narrated.
- verdict: retire
- superseded-by: S005
- reason: Survives at HEAD line 12 verbatim. The two failure modes are the anti-sycophancy pair this skill exists for and nothing mechanical catches either; R004 is its duplicate. Superseded at `4b2e64c` by S005 (the Section 8 merge; the verdict before it was keep).

### C005
- key: Push back on a wrong finding and give the reason, treating that as correct rather than insubordinate.
- class: rule
- source: plugins/claude-kit/skills/responding-to-review/SKILL.md:12
- provenance: 830ff28 2026-06-17, installed with the skill; no incident narrated.
- verdict: retire
- superseded-by: S003
- reason: Survives at HEAD line 12 verbatim. The "not insubordinate" clause is the license a session needs against the pull to defer; R002 is its duplicate. Superseded at `4b2e64c` by S003 (the Section 8 merge; the verdict before it was keep).

### C006
- key: Route the docs-curator Drift Report to the operator and read finishing-work's step 4 for the adjudications that are yours and how to record them.
- class: pointer
- source: plugins/claude-kit/skills/responding-to-review/SKILL.md:12
- provenance: 830ff28 2026-06-17 routed the report to the operator; dd5e568 2026-08-24 (verification-artifacts plan) replaced "exactly one" adjudication, which read as a cap and made an orchestrator refuse a required re-classification, with the class finishing-work step 4 defines.
- verdict: retire
- superseded-by: S011
- reason: Survives at HEAD line 12 verbatim. Finishing-work owns the stop on a `mistake` and this is the pointer a non-owner keeps; the gate is operator-decision class (A004, A005) because the resolution picks which of code, spec, or doc is the truth. R010 to R012 are this parenthetical re-read. Superseded at `4b2e64c` by S011 (the Section 8 merge; the verdict before it was keep).

### C007
- key: Implement the operator's feedback once you understand it.
- class: rule
- source: plugins/claude-kit/skills/responding-to-review/SKILL.md:14
- provenance: 830ff28 2026-06-17, installed with the skill; a8770b3 reworded to first person.
- verdict: rewrite
- reason: The rule stands; the paragraph loses only its third sentence (C010), a doctrine copy, under A006.
- proposed: Drop the third sentence of line 14 to this ledger; keep the implement, verify-scope, and say-so sentences unchanged.
- baseline-test: yes

### C008
- key: Verify the scope of operator feedback when that scope is unclear.
- class: rule
- source: plugins/claude-kit/skills/responding-to-review/SKILL.md:14
- provenance: 830ff28 2026-06-17, installed with the skill; no incident narrated.
- verdict: keep
- reason: An operator-decision gate (A007): the scope of the operator's own instruction is theirs to state, and the doctrine's intake gap check routes a material gap to them. Retiring it would have a session guess the scope of a trusted instruction.

### C009
- key: Say so when you see a problem with the operator's feedback.
- class: rule
- source: plugins/claude-kit/skills/responding-to-review/SKILL.md:14
- provenance: 830ff28 2026-06-17, installed with the skill; no incident narrated.
- verdict: keep
- reason: The skill's instance of the doctrine's Disagree-up-front bullet at the moment feedback arrives; unchanged by the line 14 rewrite.

### C010
- key: Voice the disagreement because silence reads as agreement and the operator wants the disagreement when you have one.
- class: rationale-example
- source: plugins/claude-kit/skills/responding-to-review/SKILL.md:14
- provenance: 830ff28 2026-06-17, installed with the skill; the same sentence sits in the doctrine's Disagree-up-front bullet, which owns it.
- verdict: retire
- reason: A verbatim doctrine copy; the doctrine keeps it and C009 is obeyable without it. The why: a session that says nothing has agreed in the operator's eyes, so an unvoiced objection is a shipped defect.
- proposed: Move to this ledger under C010; the doctrine keeps the sentence.

### C011
- key: Read the whole set of findings and understand it before you react or act.
- class: rule
- source: plugins/claude-kit/skills/responding-to-review/SKILL.md:18
- provenance: 830ff28 2026-06-17, installed with the skill; no incident narrated.
- verdict: rewrite
- reason: The rule stands; the item folds its lead and its restatement into one sentence and its reason (C012) moves here (A009).
- proposed: Fold item 1 to its lead plus one sentence naming the finding-by-finding failure, with the interrelation reason moved to this ledger.
- baseline-test: yes

### C012
- key: Read the set first because findings interrelate and fixing one can moot another.
- class: rationale-example
- source: plugins/claude-kit/skills/responding-to-review/SKILL.md:18
- provenance: 830ff28 2026-06-17, installed with the skill.
- verdict: retire
- reason: Motivation only. The why: findings interrelate, and a fix made finding-by-finding can moot or contradict a later one in the same set.
- proposed: Move to this ledger under C012.

### C013
- key: Confirm a finding is real in the actual code and on this stack before implementing it.
- class: rule
- source: plugins/claude-kit/skills/responding-to-review/SKILL.md:19
- provenance: 830ff28 2026-06-17, installed with the skill; the doctrine's a-finding-is-a-hypothesis bullet is its authority.
- verdict: rewrite
- reason: The rule stands and this skill owns it (A011, A013); the item drops its reason sentence here (A012). The why: a reviewer reasoning from a diff can be wrong about code it could not see, and the blind lens sees only the diff by design.
- proposed: Keep the lead and the confirm-in-the-actual-code sentence; move the diff-reasoning reason to this ledger under C013.
- baseline-test: yes

### C014
- key: Apply the YAGNI test to any push for configurability, an abstraction, or a "professional" feature: is it needed now?
- class: rule
- source: plugins/claude-kit/skills/responding-to-review/SKILL.md:20
- provenance: 830ff28 2026-06-17, installed with the skill; no incident narrated.
- verdict: keep
- reason: The probe's fork (fix-or-justify versus YAGNI) is settled by the owner: item 5 hands disposition to executing-work, whose step 4 now reads a Major's provenance before any fix (f26619c). This item only licenses the pushback; the proposed restyle is no shorter (A014, A015).

### C015
- key: Grep for the caller to decide whether the pushed-for addition is needed now.
- class: mechanic
- source: plugins/claude-kit/skills/responding-to-review/SKILL.md:20
- provenance: 830ff28 2026-06-17, installed with the skill.
- verdict: keep
- reason: no finding.

### C016
- key: Where the grep shows the thing is unused, say so and leave it out.
- class: rule
- source: plugins/claude-kit/skills/responding-to-review/SKILL.md:20
- provenance: 830ff28 2026-06-17, installed with the skill.
- verdict: keep
- reason: The outcome half of item 3, kept with it under A015.

### C017
- key: When a finding is wrong, say why up front and show the evidence: the code, the test, or the constraint.
- class: rule
- source: plugins/claude-kit/skills/responding-to-review/SKILL.md:21
- provenance: 830ff28 2026-06-17, installed with the skill.
- verdict: keep
- reason: The item is kept whole (A016) because the re-check clause inside it is baseline-tested wording and the proposed compression breaks it.

### C018
- key: Hold your position under pushback and move only on a new fact, never on tone.
- class: rule
- source: plugins/claude-kit/skills/responding-to-review/SKILL.md:21
- provenance: 830ff28 2026-06-17; the kaizen brief of 2026-08-08 required this no-move-on-tone rule to survive intact when the re-check clause was added.
- verdict: keep
- reason: A stated acceptance condition of the bare-challenge brief; the doctrine carries the same rule and this is its review-reply instance.

### C019
- key: On a bare challenge carrying no new fact, run exactly one re-verification of your cited evidence before restating: re-open the code, re-run the test.
- class: mechanic
- source: plugins/claude-kit/skills/responding-to-review/SKILL.md:21
- provenance: b99a7fe 2026-08-09, kaizen/archive/2026-08-08-bare-challenge-triggers-recheck.md: the hold-under-pushback rule had no path to discover thin evidence; RED 4 of 6 under combined pressure, GREEN 5 of 6 with the clause, old-wording control 1 of 3.
- verdict: keep
- reason: Baseline-tested wording whose language surfaced verbatim in GREEN reps; the trigger, the bounded action and the instances are each named as required parts. Any rewording re-runs the probe.

### C020
- key: Where the re-check reproduces your evidence, hold and say what you re-checked.
- class: rule
- source: plugins/claude-kit/skills/responding-to-review/SKILL.md:21
- provenance: b99a7fe 2026-08-09, the same kaizen brief (the resolution rule's first half).
- verdict: keep
- reason: Part of the tested clause; "say what you re-checked" is what distinguishes a re-check from a restatement in the reply.

### C021
- key: Where the re-check finds the evidence thinner than you claimed, treat that as the new fact and downgrade out loud.
- class: rule
- source: plugins/claude-kit/skills/responding-to-review/SKILL.md:21
- provenance: b99a7fe 2026-08-09, the same kaizen brief (the resolution rule's second half).
- verdict: keep
- reason: The clause that makes the no-move-on-tone rule safe: it supplies the new fact from the session's own re-check rather than waiting for one to arrive.

### C022
- key: If you pushed back and were wrong, say so plainly and implement, with no defense of why you pushed back.
- class: rule
- source: plugins/claude-kit/skills/responding-to-review/SKILL.md:21
- provenance: 830ff28 2026-06-17, installed with the skill.
- verdict: keep
- reason: The closing rule of item 4, kept with it under A016; the "no defense" clause is the anti-sycophancy rule's mirror for the session's own error.

### C023
- key: Handle Critical, Major and Minor findings exactly as executing-work's "Address findings" step defines, and read that step for the triage rule.
- class: pointer
- source: plugins/claude-kit/skills/responding-to-review/SKILL.md:22
- provenance: 830ff28 2026-06-17, installed with the skill.
- verdict: keep
- reason: no finding. The pointer at the owner of triage, and the sentence that settles the probe fork on C014.

### C024
- key: When ordering fixes, weight convergence between two independent lenses on one defect above either finding's severity rating.
- class: rule
- source: plugins/claude-kit/skills/responding-to-review/SKILL.md:26
- provenance: a5e184b 2026-08-25, kaizen-batch plan section 4; the rule produced its own first instance before it shipped, two reviewers with no contact landing on the same wrong sentence in section 2.
- verdict: keep
- reason: Incident-born, applied by name in later Chapters of the same plan, and no machinery counts convergence (A017).

### C025
- key: Put a corroborated Major ahead of a lone Critical in the fix order.
- class: rationale-example
- source: plugins/claude-kit/skills/responding-to-review/SKILL.md:26
- provenance: a5e184b 2026-08-25, kaizen-batch plan section 4.
- verdict: keep
- reason: The instance fixes the rule's reading (ordering, not a tie-break) and hosts the lone-Critical bound (A018).

### C026
- key: Still verify a lone Critical against the code before implementing it.
- class: rule
- source: plugins/claude-kit/skills/responding-to-review/SKILL.md:26
- provenance: a5e184b 2026-08-25, kaizen-batch plan section 4.
- verdict: keep
- reason: The bound that keeps the ordering rule from reading as a downgrade of an uncorroborated Critical (A017).

### C027
- key: Credit convergence because the kit's lenses are built to share nothing: blind lenses get only the base ref or document, sighted ones hold the spec, and none reads another's output.
- class: rationale-example
- source: plugins/claude-kit/skills/responding-to-review/SKILL.md:26
- provenance: a5e184b 2026-08-25; the order clause repaired the section 4 round's finding that "run in parallel" was false for finishing's serial lenses; 6b7b384 2026-08-29 re-keyed the test on what the lenses share.
- verdict: keep
- reason: States the independence test the counting rules apply, and its clauses are review-round repairs rather than decoration (A019).

### C028
- key: Check what each lens was given, standing-brief content included, before counting two findings as two observations.
- class: rule
- source: plugins/claude-kit/skills/responding-to-review/SKILL.md:28
- provenance: a5e184b 2026-08-25, kaizen-batch section 4 adversarial finding that Standing Brief Amendments break independence while the contamination test clears them.
- verdict: keep
- reason: Incident-born and recurring (a 2026-09-06 note records a brief carrying a prior adjudication that turned a lens into a restatement); nothing mechanical reads what a lens was given (A020).

### C029
- key: Do not count as corroboration two findings from one lens, a reviewer handed another's output, or two agents given the same contaminating framing.
- class: rule
- source: plugins/claude-kit/skills/responding-to-review/SKILL.md:28
- provenance: a5e184b 2026-08-25, kaizen-batch plan section 4.
- verdict: keep
- reason: The disqualifier list; kaizen/notes-SCOTT-CLAUDE.md line 36 is a live instance of the second case.

### C030
- key: Do not count convergence produced by shared standing-brief content, such as a Standing Brief Amendments entry or a repo-wide defect class named in both briefs.
- class: rule
- source: plugins/claude-kit/skills/responding-to-review/SKILL.md:28
- provenance: a5e184b 2026-08-25, the section 4 adversarial finding at docs/archive/claude-kit_kaizen-batch_spec_v1.md line 187.
- verdict: keep
- reason: The reconciliation with executing-work's contamination test is the whole point: that test clears the framing, so this rule is the only place the convergence it produces is discounted.

### C031
- key: Separate what the convergence is about before counting it: the effort's own artifacts as subject, versus those artifacts cited as evidence.
- class: rule
- source: plugins/claude-kit/skills/responding-to-review/SKILL.md:30
- provenance: 6b7b384 2026-08-29, review-and-record plan section 7: a fixture invented a registry journal the directory contract does not define and two independent reviewers cited it as evidence.
- verdict: keep
- reason: Incident-born; the subject-versus-evidence split is what keeps the rule from putting the effort's own artifacts out of reach (A021).

### C032
- key: Count two lenses landing on the same defect in the effort's own artifacts as corroboration.
- class: rule
- source: plugins/claude-kit/skills/responding-to-review/SKILL.md:30
- provenance: 6b7b384 2026-08-29, review-and-record plan section 7.
- verdict: keep
- reason: The positive half of C031; without it the evidence rule would discount every finding on a fixture the effort wrote.

### C033
- key: Count two lenses citing an effort-authored artifact as evidence of a fact the effort does not own as one finding, not two.
- class: rule
- source: plugins/claude-kit/skills/responding-to-review/SKILL.md:30
- provenance: 6b7b384 2026-08-29, review-and-record plan section 7; the class sentence is pinned once on three surfaces by test/doctrine-parity.test.js.
- verdict: keep
- reason: The incident's own rule, and its class sentence is a pinned copy; operator memory two-surfaces-corroborate-only-if-no-upstream-reaches-both records the general form.

### C034
- key: For a fact the effort does not own, take corroboration only from evidence originating outside the effort.
- class: rule
- source: plugins/claude-kit/skills/responding-to-review/SKILL.md:30
- provenance: 6b7b384 2026-08-29, review-and-record plan section 7.
- verdict: keep
- reason: The remedy half of C033; unenforced by machinery.

### C035
- key: Count an artifact authored before this effort began toward independence, and do not use merge state as the test.
- class: mechanic
- source: plugins/claude-kit/skills/responding-to-review/SKILL.md:30
- provenance: 6b7b384 2026-08-29; the section 7 first draft keyed independence on merge state, which the plan's own commit model falsified within the hour, and the review round replaced it.
- verdict: keep
- reason: no finding. A review-caught repair; a session tempted to simplify the test back to merge state re-opens that defect.

### C036
- key: Cite the contract's owning surface for a claim about a contract, and treat it as outranking any artifact written to exercise it.
- class: rule
- source: plugins/claude-kit/skills/responding-to-review/SKILL.md:30
- provenance: 6b7b384 2026-08-29, review-and-record plan section 7, designed as a multi-surface copy with the sighted charters because a charter inherits no skills.
- verdict: keep
- reason: The orchestrator's copy of a designed three-surface clause; the charter cannot be pointed at from a skill, and the blind lens has no fixture rule, so this is where a blind misread is caught (A022, A023).

### C037
- key: Take the owning surface to be wherever the fact's own producer defines it, never a copy that restates it.
- class: mechanic
- source: plugins/claude-kit/skills/responding-to-review/SKILL.md:30
- provenance: 6b7b384 2026-08-29; pinned once on all three surfaces at test/doctrine-parity.test.js lines 4932 to 4950 after the enumeration lost its tool leg on every surface.
- verdict: keep
- reason: A pinned copy keeps its copy; the pin fails on a pointer (A024, A025).

### C038
- key: Where no owning surface states the contract, treat the contract as unstated and the asserting artifact as a proposal rather than the source.
- class: rule
- source: plugins/claude-kit/skills/responding-to-review/SKILL.md:30
- provenance: 6b7b384 2026-08-29, review-and-record plan section 7.
- verdict: keep
- reason: The orchestrator's disposition generalized over the class, distinct from the reviewer's fixture diagnosis the parity test places on the charters alone (A026, A027).

### C039
- key: Read executing-work's SKILL.md for the claim-finding class, its exceptions, and the dispositions at its step 4.
- class: pointer
- source: plugins/claude-kit/skills/responding-to-review/SKILL.md:34
- provenance: 5620b2b 2026-09-07, review-loop-exit plan section 2: a false sentence could hold a section open because the loop had no class-keyed exit.
- verdict: retire
- superseded-by: S015
- reason: no finding. The pointer at the owner; A028 strips the enumeration that rides beside it. Superseded at `4b2e64c` by S015 (the Section 8 merge; the verdict before it was keep).

### C040
- key: Never put a replacement sentence in a fix brief for a claim finding.
- class: rule
- source: plugins/claude-kit/skills/responding-to-review/SKILL.md:34
- provenance: 5620b2b 2026-09-07, review-loop-exit plan section 2, which placed this rule here deliberately.
- verdict: retire
- superseded-by: S018
- reason: The rule stands; it gains C041 as its exception clause and loses the copied disposition list beside it (A028 to A030). The why: a rewritten sentence re-enters the class it was written to leave, so a fix brief that carries one restarts the loop it was meant to close. Superseded at `4b2e64c` by S018 (the Section 8 merge; the verdict before it was rewrite).

### C041
- key: Where a claim holds under either exception, owe it the behavior bar.
- class: rule
- source: plugins/claude-kit/skills/responding-to-review/SKILL.md:34
- provenance: 5620b2b 2026-09-07; the exceptions themselves live in executing-work's KIT-CLAIM-CLASS region, pinned by test/claim-class-parity.test.js.
- verdict: retire
- superseded-by: S019
- reason: A restatement of the owner's bar that survives only as the bound on C040, since without it a security-boundary claim would be barred from a replacement sentence (A029). Superseded at `4b2e64c` by S019 (the Section 8 merge; the verdict before it was rewrite).

### C042
- key: Treat a reviewer's explicit clearance as a claim about the code, not a fact you inherit, and never adopt a load-bearing one on the agent's word alone.
- class: rule
- source: plugins/claude-kit/skills/responding-to-review/SKILL.md:38
- provenance: a738710 2026-08-28, review-and-record plan section 1: a security lens cleared "no model-writable input can produce a deny", the prose lens rated the line Critical, and the trace proved the prose lens right.
- verdict: rewrite
- reason: The rule, its examples and its step-2 parallel stand; the paragraph's motivating third sentence moves here (A031). The why: a clearance arrives looking like the settled state and costs nothing to adopt, which is why it is the harder half to remember.
- proposed: Drop the paragraph's third sentence to this ledger under C042; keep the clearance definition, the examples, and the step-2 parallel.
- baseline-test: yes

### C043
- key: Verify a load-bearing clearance against the code before the section closes on it.
- class: rule
- source: plugins/claude-kit/skills/responding-to-review/SKILL.md:38
- provenance: a738710 2026-08-28, review-and-record plan section 1.
- verdict: keep
- reason: The act the incident required; unchanged by A031.

### C044
- key: Judge a clearance load-bearing when believing it retires a check you would otherwise have run.
- class: mechanic
- source: plugins/claude-kit/skills/responding-to-review/SKILL.md:40
- provenance: a738710 2026-08-28, review-and-record plan section 1.
- verdict: keep
- reason: no finding. The test C045's instances make recognizable.

### C045
- key: Verify the named property a clearance rests on, such as the trust boundary holding, model-writable input not reaching the sink, or the code refusing a case.
- class: rationale-example
- source: plugins/claude-kit/skills/responding-to-review/SKILL.md:40
- provenance: a738710 2026-08-28; the second instance is the incident itself.
- verdict: keep
- reason: The recognizer for C044's abstract test and the carrier of its imperative; the incident showed recognition is what sessions miss (A032).

### C046
- key: Do not go back into the full diff on a bare APPROVED verdict.
- class: rule
- source: plugins/claude-kit/skills/responding-to-review/SKILL.md:40
- provenance: a738710 2026-08-28, review-and-record plan section 1.
- verdict: keep
- reason: Rule, discriminator and a pointer at executing-work's orchestrator-stays-lean rule, which owns the diff-reading bound (A033).

### C047
- key: When two lenses return contradicting verdicts on one passage, adopt neither verdict and let the artifact settle which holds.
- class: rule
- source: plugins/claude-kit/skills/responding-to-review/SKILL.md:42
- provenance: a738710 2026-08-28, review-and-record plan section 1, the split-verdict instance.
- verdict: keep
- reason: Incident-born; the corroboration section had no rule for contradicting verdicts before it (A034).

### C048
- key: For a contradiction about what the code does, trace the code yourself and record the trace.
- class: rule
- source: plugins/claude-kit/skills/responding-to-review/SKILL.md:42
- provenance: a738710 2026-08-28; tracing the gate's own branch order is what settled the incident.
- verdict: keep
- reason: The incident's remedy stated as the rule.

### C049
- key: Record the trace's evidence, the branch order you read, the file:line and the path you followed, rather than the verdict you sided with.
- class: mechanic
- source: plugins/claude-kit/skills/responding-to-review/SKILL.md:42
- provenance: a738710 2026-08-28, review-and-record plan section 1.
- verdict: keep
- reason: What makes a recorded trace checkable later rather than a vote count.

### C050
- key: For a contradiction about whether the code does what was asked, read the section's own words in the spec and record that reading.
- class: rule
- source: plugins/claude-kit/skills/responding-to-review/SKILL.md:42
- provenance: a738710 2026-08-28, review-and-record plan section 1.
- verdict: keep
- reason: The intent half of the artifact rule; the code cannot settle it.

### C051
- key: Do not break a contradiction tie on severity.
- class: rule
- source: plugins/claude-kit/skills/responding-to-review/SKILL.md:42
- provenance: a738710 2026-08-28; in the incident the higher severity happened to be right, which is why severity is named as no tie-break.
- verdict: keep
- reason: Consistent with C024's currency distinction; unenforced.

### C052
- key: Do not break a contradiction tie on the lens's specialty.
- class: rule
- source: plugins/claude-kit/skills/responding-to-review/SKILL.md:42
- provenance: a738710 2026-08-28; the security lens cleared inside its own specialty and was wrong.
- verdict: keep
- reason: The incident's sharpest lesson, and the clause the compress proposal would have deleted (A034).

### C053
- key: Treat a verdict from a lens structurally denied the relevant input as evidence about the artifact it held, never a ruling on the one it did not.
- class: rule
- source: plugins/claude-kit/skills/responding-to-review/SKILL.md:42
- provenance: a738710 2026-08-28, review-and-record plan section 1.
- verdict: keep
- reason: Follows from the blind lens being denied the spec on purpose; it is how a blind clearance over a spec question is weighed.

### C054
- key: Apply the kit doctrine's anti-sycophancy rule in full when replying to a review.
- class: rule
- source: plugins/claude-kit/skills/responding-to-review/SKILL.md:46
- provenance: 830ff28 2026-06-17; fdd7b82 2026-07-15 repointed the reference at the doctrine; 5620b2b 2026-09-07 removed the doctrine restatement.
- verdict: keep
- reason: Already trimmed to a pointer plus the review-specific instances (A035).

### C055
- key: In a review reply, write no "Good catch", no "You're absolutely right", and no thanks to the reviewer or the operator for the finding.
- class: rule
- source: plugins/claude-kit/skills/responding-to-review/SKILL.md:46
- provenance: 830ff28 2026-06-17, installed with the skill.
- verdict: keep
- reason: The skill's own instance list; the doctrine names different phrasings, so this is not a copy.

### C056
- key: State the fix or state the disagreement, and let the changed code show you heard it.
- class: rule
- source: plugins/claude-kit/skills/responding-to-review/SKILL.md:46
- provenance: 830ff28 2026-06-17, installed with the skill.
- verdict: keep
- reason: The positive form of the reply; kept with the section under A035.

### C057
- key: Weigh operator feedback as usually right and always worth hearing, but never as infallible.
- class: rationale-example
- source: plugins/claude-kit/skills/responding-to-review/SKILL.md:8
- provenance: 830ff28 2026-06-17, installed with the skill; a8770b3 reworded to first person.
- verdict: retire
- reason: Line 14 carries the operative rule and the doctrine carries the standing. The why: the operator is trusted as a source and still wrong sometimes, so feedback is implemented once understood and questioned when a problem is seen.
- proposed: Move to this ledger under C057 as part of the line 8 rewrite (A001).

### C058
- key: Treat a severity rating and independent convergence as different kinds of evidence, not interchangeable.
- class: rationale-example
- source: plugins/claude-kit/skills/responding-to-review/SKILL.md:26
- provenance: a5e184b 2026-08-25, kaizen-batch plan section 4.
- verdict: retire
- reason: Motivation for C024, which stands with its instance and its independence account. The why: a severity rating is one reviewer's judgment about a defect, while independent convergence is evidence about the defect itself.
- proposed: Move the currency sentence to this ledger under C058; the rest of line 26 stands.
- baseline-test: yes

### C059
- key: Dispatch a round's review lenses together rather than feeding one lens's output into another.
- class: mechanic
- source: plugins/claude-kit/skills/responding-to-review/SKILL.md:26
- provenance: a5e184b 2026-08-25; the wording is the section 4 round's correction of "run in parallel", scoped to same-round dispatches.
- verdict: keep
- reason: A descriptive leg of the independence account rather than a dispatch instruction; executing-work step 3 owns and enforces the dispatch (A038, A039).

### R001
- key: Give every review-agent finding an honest verdict of your own.
- class: rule
- source: plugins/claude-kit/skills/responding-to-review/SKILL.md:12
- provenance: 830ff28 2026-06-17; the sentence pre-dates the merge and was re-read because f26619c 2026-09-08 changed line 12 beside it.
- verdict: retire
- superseded-by: S002
- reason: Duplicate ledger entry, no text change: the same sentence is held as C003, which keeps at HEAD line 12. C003 is superseded by S002, which carries the passage, so this record retires no passage of its own.

### R002
- key: Push back on a wrong finding and state your reason; treat doing so as correct rather than insubordinate.
- class: rule
- source: plugins/claude-kit/skills/responding-to-review/SKILL.md:12
- provenance: 830ff28 2026-06-17; re-read after f26619c 2026-09-08 changed line 12 beside it.
- verdict: retire
- superseded-by: S003
- reason: Duplicate ledger entry, no text change: held as C005, which keeps at HEAD line 12. C005 is superseded by S003, which carries the passage, so this record retires no passage of its own.

### R003
- key: Adjudicate every finding.
- class: rule
- source: plugins/claude-kit/skills/responding-to-review/SKILL.md:12
- provenance: 830ff28 2026-06-17; re-read after f26619c 2026-09-08 changed line 12 beside it.
- verdict: retire
- superseded-by: S002
- reason: Duplicate ledger entry, no text change: held as C003, which keeps at HEAD line 12. C003 is superseded by S002, which carries the passage, so this record retires no passage of its own.

### R004
- key: Do not rubber-stamp a finding and do not reflexively defer to one.
- class: rule
- source: plugins/claude-kit/skills/responding-to-review/SKILL.md:12
- provenance: 830ff28 2026-06-17; re-read after f26619c 2026-09-08 changed line 12 beside it.
- verdict: retire
- superseded-by: S005
- reason: Duplicate ledger entry, no text change: held as C004, which keeps at HEAD line 12. C004 is superseded by S005, which carries the passage, so this record retires no passage of its own.

### R005
- key: Read a finding's trace before you read its severity.
- class: rule
- source: plugins/claude-kit/skills/responding-to-review/SKILL.md:12
- provenance: f26619c 2026-09-08, review-loop-provenance plan section 2, from the NEO-CLAUDE twenty-round section of 2026-09-08 where a Major nobody asked for was built one repair per round (kaizen/notes-NEO-CLAUDE.md line 23).
- verdict: retire
- superseded-by: S006
- reason: New at HEAD, no finding, no duplicate in this range; the one sentence the plan directed this skill to carry as the adjudication-time pointer at executing-work's provenance read. Superseded at `4b2e64c` by S006 (the Section 8 merge; the verdict before it was keep).

### R006
- key: Re-trace a Major finding marked `trace: none` against the trace target yourself before holding anything on it.
- class: rule
- source: plugins/claude-kit/skills/responding-to-review/SKILL.md:12
- provenance: f26619c 2026-09-08, review-loop-provenance plan section 2.
- verdict: retire
- superseded-by: S007
- reason: New at HEAD, no finding; a `trace: none` is the lens's claim about the plan and is verified like any other claim before it is acted on, consistent with C013. Superseded at `4b2e64c` by S007 (the Section 8 merge; the verdict before it was keep).

### R007
- key: Send a re-traced `trace: none` Major to the provenance paragraph in executing-work's step 4 rather than into a fix.
- class: rule
- source: plugins/claude-kit/skills/responding-to-review/SKILL.md:12
- provenance: f26619c 2026-09-08, review-loop-provenance plan section 2.
- verdict: retire
- superseded-by: S008
- reason: New at HEAD, no finding; routes to the owner of the disposition, consistent with C023. Superseded at `4b2e64c` by S008 (the Section 8 merge; the verdict before it was keep).

### R008
- key: Trace a blind lens's findings yourself at adjudication.
- class: rule
- source: plugins/claude-kit/skills/responding-to-review/SKILL.md:12
- provenance: f26619c 2026-09-08, review-loop-provenance plan section 2 (the orchestrator supplies the blind lens's trace, recorded as orchestrator-made).
- verdict: retire
- superseded-by: S009
- reason: New at HEAD, no finding; the blind lens carries no trace by design, which is the same structural fact C053 rests on. Superseded at `4b2e64c` by S009 (the Section 8 merge; the verdict before it was keep).

### R009
- key: Keep a Critical finding, and any security finding of Critical or Major weight, on its own route whatever its trace says.
- class: rule
- source: plugins/claude-kit/skills/responding-to-review/SKILL.md:12
- provenance: f26619c 2026-09-08, review-loop-provenance plan section 2 (the exemption executing-work's provenance paragraph states).
- verdict: retire
- superseded-by: S010
- reason: New at HEAD, no finding; the bound R006 and R007 need so the provenance route never delays a Critical or a security finding. Superseded at `4b2e64c` by S010 (the Section 8 merge; the verdict before it was keep).

### R010
- key: Route docs-curator's Drift Report to the operator per finishing-work instead of adjudicating it yourself.
- class: rule
- source: plugins/claude-kit/skills/responding-to-review/SKILL.md:12
- provenance: 830ff28 2026-06-17 and dd5e568 2026-08-24; re-read after f26619c 2026-09-08 changed line 12 beside it.
- verdict: retire
- superseded-by: S011
- reason: Duplicate ledger entry, no text change: held as C006, which keeps at HEAD line 12. C006 is superseded by S011, which carries the passage, so this record retires no passage of its own.

### R011
- key: Read finishing-work's step 4 for which adjudications are yours, including the pre-change read a `mistake`'s `Basis:` line calls for.
- class: pointer
- source: plugins/claude-kit/skills/responding-to-review/SKILL.md:12
- provenance: dd5e568 2026-08-24; re-read after f26619c 2026-09-08 changed line 12 beside it.
- verdict: retire
- superseded-by: S011
- reason: Duplicate ledger entry, no text change: held as C006, which keeps at HEAD line 12. C006 is superseded by S011, which carries the passage, so this record retires no passage of its own.

### R012
- key: Record each such adjudication as finishing-work's step 4 directs.
- class: rule
- source: plugins/claude-kit/skills/responding-to-review/SKILL.md:12
- provenance: dd5e568 2026-08-24; re-read after f26619c 2026-09-08 changed line 12 beside it.
- verdict: retire
- superseded-by: S011
- reason: Duplicate ledger entry, no text change: held as C006, which keeps at HEAD line 12. C006 is superseded by S011, which carries the passage, so this record retires no passage of its own.

### S001
- key: Treat every review-agent finding as fallible, because it can be wrong, out of scope, or built on context the agent lacked.
- class: rationale-example
- source: plugins/claude-kit/skills/responding-to-review/SKILL.md:12
- provenance: 830ff28 2026-06-17, installed with the skill as ported from Daren's fork and session mining; 55c5abc 2026-09-09 changed only the step number beside it.
- verdict: keep
- reason: The three named failure modes are the recognizer a session adjudicates a finding against, and C002's retirement of the line 8 motivation rests on this operative form staying here; nothing mechanical checks a finding for any of the three.

### S002
- key: Give every finding an honest verdict.
- class: rule
- source: plugins/claude-kit/skills/responding-to-review/SKILL.md:12
- provenance: 830ff28 2026-06-17, installed with the skill; the enumeration grew in 12ef61f (blind lens) and a5fce80 (document battery); 55c5abc 2026-09-09 changed only the step number beside it.
- verdict: keep
- reason: No hook makes a session return a verdict on a finding, and the enumeration is what binds each new lens to the rule; supersedes C003, of which R001 was a retired duplicate.

### S003
- key: Push back on a wrong finding and state the reason; treat doing so as correct rather than insubordinate.
- class: rule
- source: plugins/claude-kit/skills/responding-to-review/SKILL.md:12
- provenance: 830ff28 2026-06-17, installed with the skill; 55c5abc 2026-09-09 changed only the step number beside it.
- verdict: keep
- reason: The "not insubordinate" clause is the license a session needs against the pull to defer; supersedes C005, of which R002 was a retired duplicate.

### S004
- key: Adjudicate every finding.
- class: rule
- source: plugins/claude-kit/skills/responding-to-review/SKILL.md:12
- provenance: 830ff28 2026-06-17, installed with the skill; 55c5abc 2026-09-09 changed only the step number beside it.
- verdict: keep
- reason: Shares the C003 -> S002 supersession, C003's key having merged the two sentences; R003 was its retired duplicate. Unenforced by machinery and the sentence the whole skill hangs on.

### S005
- key: Do not rubber-stamp a finding and do not reflexively defer to it.
- class: rule
- source: plugins/claude-kit/skills/responding-to-review/SKILL.md:12
- provenance: 830ff28 2026-06-17, installed with the skill; 55c5abc 2026-09-09 changed only the step number beside it.
- verdict: keep
- reason: The two failure modes are the anti-sycophancy pair this skill exists for and nothing mechanical catches either; supersedes C004, of which R004 was a retired duplicate.

### S006
- key: Read a finding's trace before you read its severity.
- class: rule
- source: plugins/claude-kit/skills/responding-to-review/SKILL.md:12
- provenance: f26619c 2026-09-08, review-loop-provenance plan section 2, from the NEO-CLAUDE twenty-round section of 2026-09-08 where a Major nobody asked for was built one repair per round (kaizen/notes-NEO-CLAUDE.md line 23); 55c5abc 2026-09-09 changed only the step number beside it.
- verdict: keep
- reason: Incident-born and the one sentence the plan directed this skill to carry as the adjudication-time pointer at executing-work's provenance read; supersedes R005.

### S007
- key: Re-trace a Major carrying `trace: none` against the trace target yourself before holding anything on it.
- class: rule
- source: plugins/claude-kit/skills/responding-to-review/SKILL.md:12
- provenance: f26619c 2026-09-08, review-loop-provenance plan section 2; 55c5abc 2026-09-09 changed only the step number beside it.
- verdict: keep
- reason: A `trace: none` is the lens's claim about the plan and is verified like any other claim before it is acted on, consistent with C013; supersedes R006.

### S008
- key: Send such a finding to the provenance paragraph in executing-work's step 4 instead of into a fix.
- class: rule
- source: plugins/claude-kit/skills/responding-to-review/SKILL.md:12
- provenance: f26619c 2026-09-08, review-loop-provenance plan section 2; 55c5abc 2026-09-09 changed only the step number beside it.
- verdict: keep
- reason: Routes to the owner of the disposition, consistent with C023, and the provenance paragraph still sits at executing-work's step 4 at HEAD (executing-work SKILL.md line 423); supersedes R007.

### S009
- key: Trace a blind lens's findings yourself at adjudication.
- class: rule
- source: plugins/claude-kit/skills/responding-to-review/SKILL.md:12
- provenance: f26619c 2026-09-08, review-loop-provenance plan section 2 (the orchestrator supplies the blind lens's trace, recorded as orchestrator-made); 55c5abc 2026-09-09 changed only the step number beside it.
- verdict: keep
- reason: The blind lens carries no trace by design, the same structural fact C053 rests on; supersedes R008.

### S010
- key: Keep a Critical, and any security finding of Critical or Major weight, on its own route regardless of its trace.
- class: rule
- source: plugins/claude-kit/skills/responding-to-review/SKILL.md:12
- provenance: f26619c 2026-09-08, review-loop-provenance plan section 2 (the exemption executing-work's provenance paragraph states); 55c5abc 2026-09-09 changed only the step number beside it.
- verdict: keep
- reason: The bound S007 and S008 need so the provenance route never delays a Critical or a security finding; supersedes R009.

### S011
- key: Route the docs-curator Drift Report to the operator, following finishing-work.
- class: rule
- source: plugins/claude-kit/skills/responding-to-review/SKILL.md:12
- provenance: 830ff28 2026-06-17 routed the report to the operator; dd5e568 2026-08-24 (verification-artifacts plan) replaced the "exactly one" cap with the class finishing-work defines; 55c5abc 2026-09-09 renumbered the step the parenthetical names.
- verdict: keep
- reason: Finishing-work owns the stop on a `mistake` and this is the pointer a non-owner keeps, an operator-decision gate because the resolution picks which of code, spec or doc is the truth; supersedes C006, of which R010 was a retired duplicate.

### S012
- key: Read finishing-work's step 5 for the class of adjudications that are yours.
- class: pointer
- source: plugins/claude-kit/skills/responding-to-review/SKILL.md:12
- provenance: dd5e568 2026-08-24 installed the pointer at finishing-work's step 4; 55c5abc 2026-09-09 (review-loop-provenance plan section 6) inserted the goal read as step 4 and renumbered steps 5 to 9, repointing this at step 5.
- verdict: keep
- reason: Finishing-work step 5 at HEAD is Documentation curation and defines the `mistake`/`deviation` class, the `Basis:` line and the pre-change read (finishing-work SKILL.md line 62), so the pointer is correct, and no test pins the step number in this file; shares the C006 -> S011 supersession, R011 having been C006's retired duplicate.

### S013
- key: Perform the pre-change read that a `mistake`'s `Basis:` line calls for.
- class: rule
- source: plugins/claude-kit/skills/responding-to-review/SKILL.md:12
- provenance: dd5e568 2026-08-24, verification-artifacts plan; 55c5abc 2026-09-09 renumbered the step it is read from.
- verdict: keep
- reason: A named member of the class the S012 pointer names, still defined at the repointed step; shares the C006 -> S011 supersession.

### S014
- key: Record each of those adjudications the way finishing-work's step 5 directs.
- class: mechanic
- source: plugins/claude-kit/skills/responding-to-review/SKILL.md:12
- provenance: dd5e568 2026-08-24, verification-artifacts plan; 55c5abc 2026-09-09 renumbered the step it points at.
- verdict: keep
- reason: Carries no mechanic of its own, only the owner's, so it is already the pointer form; shares the C006 -> S011 supersession, R012 having been C006's retired duplicate.

### S015
- key: Read `skills/executing-work/SKILL.md` under the kit plugin root for the claim class, its exceptions, and the dispositions at its step 4.
- class: pointer
- source: plugins/claude-kit/skills/responding-to-review/SKILL.md:34
- provenance: 5620b2b 2026-09-07, review-loop-exit plan section 2: a false sentence could hold a section open because the loop had no class-keyed exit; abfa98d 2026-09-09 appended S020 beside it.
- verdict: keep
- reason: The pointer at the owner, which still holds the class, the exceptions and the four dispositions at its step 4 (executing-work SKILL.md line 435); supersedes C039.

### S016
- key: Dispose of such a claim by deleting the false sentence, adding a cheap mechanical check, writing a Chapter line, or routing it out of scope.
- class: mechanic
- source: plugins/claude-kit/skills/responding-to-review/SKILL.md:34
- provenance: 5620b2b 2026-09-07, review-loop-exit plan section 2; untouched by the merge.
- verdict: retire
- reason: A duplicate whose owner already carries it: executing-work step 4 states the same four forms verbatim at line 435, and the S015 pointer beside it names that step, so dropping the copy loses no instruction. Baseline-test: yes.
- proposed: Drop the enumerated four forms from line 34 and leave the S015 pointer at executing-work's step 4 as the sole carrier.
- baseline-test: yes

### S017
- key: Do not rewrite the sentence, because a rewritten sentence re-enters the class it was written to leave.
- class: rationale-example
- source: plugins/claude-kit/skills/responding-to-review/SKILL.md:34
- provenance: 5620b2b 2026-09-07, review-loop-exit plan section 2; untouched by the merge.
- verdict: retire
- reason: Rationale S018 is obeyable without, and its why now lives here: a rewritten sentence re-enters the claim class it was written to leave, so a fix brief carrying one restarts the loop it was meant to close. Baseline-test: yes.
- proposed: Drop the "A rewritten sentence re-enters the class" clause from line 34; the ledger entries for S017 and S018 carry the why.
- baseline-test: yes

### S018
- key: Never put a replacement sentence in a fix brief for a claim finding.
- class: rule
- source: plugins/claude-kit/skills/responding-to-review/SKILL.md:34
- provenance: 5620b2b 2026-09-07, review-loop-exit plan section 2, which placed this rule here deliberately; abfa98d 2026-09-09 appended S020 beside it.
- verdict: rewrite
- reason: The rule stands and this skill owns it; the passage compresses to the S015 pointer plus one rule sentence carrying S019 as its exception clause and S020 as the other side of the class split, once S016 and S017 leave. Supersedes C040. Baseline-test: yes.
- proposed: Compress line 34 to the S015 pointer plus one rule sentence: a claim finding's fix brief never carries a replacement sentence, a claim an exception holds is owed the behavior bar in the same fix round, and every other lands in the close pass executing-work's step 4 owns.
- baseline-test: yes

### S019
- key: Hold a claim to the behavior bar when either exception applies to it.
- class: rule
- source: plugins/claude-kit/skills/responding-to-review/SKILL.md:34
- provenance: 5620b2b 2026-09-07; the exceptions themselves live in executing-work's KIT-CLAIM-CLASS region, pinned by test/claim-class-parity.test.js; abfa98d 2026-09-09 appended S020 beside it.
- verdict: rewrite
- reason: A restatement of the owner's bar that survives only as the bound on S018, since without it a security-boundary claim would be barred from a replacement sentence. Supersedes C041. Baseline-test: yes.
- proposed: Fold into the single rule sentence A018 names as its exception clause.
- baseline-test: yes

### S020
- key: Land every other claim finding's fix in the section's close pass along with the other Minors.
- class: rule
- source: plugins/claude-kit/skills/responding-to-review/SKILL.md:34
- provenance: abfa98d 2026-09-09, review-loop-provenance plan section 5: per-round Minor fixes at the writer tier grew the diff the next lenses read and bred text findings, so Minors and unexcepted claim findings now take one close pass per section; the plan directed this skill to carry one sentence.
- verdict: rewrite
- reason: A disposition executing-work's step 4 owns and states in full (executing-work SKILL.md lines 423 and 435), which this skill's item 5 hands to that step, so it folds into S018's rule sentence as the "every other" half of the class split, naming the owner rather than restating the pass. Baseline-test: yes.
- proposed: Merge into A018's rule sentence as the "every other" half of the class split, naming executing-work's step 4 as the owner of the close pass rather than restating the pass.
- baseline-test: yes
