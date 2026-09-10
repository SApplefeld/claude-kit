# Rationale ledger: consult

This file is the rationale ledger for the documents the `consult` skill owns. Rule text says what happens; this ledger says why; git says when. Nobody loads it by default. A session about to change a rule in one of the documents below reads the entry for the claim it is changing first, so the reason a rule holds is not re-litigated at the next review.

Each document sits under its own heading, which opens with its inventory line (what the document is for, which moments it owns, and when a session loads it) and then carries one entry per claim, retired claims included so the next audit does not re-find them. An entry is keyed by the claim's imperative sentence and carries its class (rule, mechanic, pointer, or rationale-example), its source as file and line, its provenance (the commit, incident, memory or kaizen note that installed it, or `no provenance found`), and its verdict (keep, rewrite, or retire) with the reason. A `C` entry's source line is read at the extraction commit `6bc07fb`; an `R` entry is a claim re-extracted from a hunk the Section 5 merge changed, and its source line is read at the merged commit `d9540ad`. Claim numbers restart under every document heading, and inside a document read in chunks they restart per chunk, so an entry id is unique only under its heading and a chunked document carries the chunk in the id (`c2.C001` is claim C001 of the second chunk); a claim named inside a reason or provenance line of such a document carries the same prefix. A `C` entry whose source hunk the Section 5 merge rewrote reads `retire` and carries a `superseded-by:` line naming the `R` entry that holds the passage at the merged commit; the passage's own verdict is that entry's, so a count of retirements over this ledger leaves those records out. A reason may name the form the judge ruled toward (a pointer at the owner, a split, a fold into a neighbour), because that form is why the verdict is rewrite rather than keep or retire; what a passage becomes is the rewrite plan's to decide, and where the two differ the rewrite plan governs. The target wording a judge proposed and the baseline-test flag on a behavior-shaping rewrite are recorded in the corpus audit plan's scratch adjudication log (the plan is `claude-kit_corpus-audit_spec_v1.md` under `docs/`), which that plan's rewrite section consumes; this ledger does not carry them.

## plugins/claude-kit/skills/consult/SKILL.md

This document is the kit's escalation instrument: it tells a session how to convene one fresh-context judge, the `consultant` agent, to rule on a single question the session cannot settle on its own. It owns the moments where a session is stuck mid-execution and must decide whether and how to escalate: a second failed attempt at the same problem, a BLOCKED that turns on a decision, a systematic-debugging dead end, and a hard-to-reverse or load-bearing decision the spec does not cover. It also owns the shape of the consult brief, the model and dispatch route for the consultant, the adjudication of the returned ruling, and the choice between the consult and its siblings (design-council, cold, the diff reviewers). Load class: `named-trigger` - the frontmatter says to use it mid-execution at the trigger floor and when the operator asks for a consult or a second opinion on a problem, so it is loaded before convening a consult rather than at session or plan start.

Extracted at `6bc07fb`: whole document (`skills.consult.SKILL.md`). Re-extracted at `d9540ad` over the hunks the Section 5 merge changed (`R` entries below).

### C001
- key: Convene a consult when you hit the trigger floor mid-execution or when the operator asks for a consult or second opinion on a problem.
- class: rule
- source: plugins/claude-kit/skills/consult/SKILL.md:3
- provenance: 1d9c467 2026-08-15, the consult plan (docs/archive/claude-kit_consult_spec_v1.md) built after the sapplefeld-ai-os run where the in-context advisor confirmed a wrong framing; d6cd30d 2026-08-15 narrowed the description's trigger (b) to a BLOCKED that turns on a decision.
- verdict: retire
- superseded-by: R001, R003
- reason: The instruction survives verbatim at HEAD line 3, which 9f1ed1b rewrote (merged at d9540ad) to name the design stop; it continues as R003 with R001, and this id retires as the pre-merge duplicate. The passage itself is kept: the description is the harness's match surface and each enumerated trigger is a match term.

### C002
- key: Decide whether to consult by checking the trigger floor, never by how stuck the session feels.
- class: rule
- source: plugins/claude-kit/skills/consult/SKILL.md:3
- provenance: 1d9c467 2026-08-15, the plan's trigger philosophy: stuck sessions feel almost done, so the triggers are a counted floor.
- verdict: retire
- superseded-by: R004
- reason: Survives verbatim at HEAD line 3 as R004 after the 9f1ed1b merge; this id retires as the pre-merge duplicate and the passage stands.

### C003
- key: Do not use the consult to review a diff; send diffs to the adversarial and blind reviewers instead.
- class: rule
- source: plugins/claude-kit/skills/consult/SKILL.md:3
- provenance: 1d9c467 2026-08-15, the plan's sibling discriminator set (consult, design-council, cold, the reviewers).
- verdict: retire
- superseded-by: R005
- reason: Survives verbatim at HEAD line 3 as part of R005 after the 9f1ed1b merge; this id retires as the pre-merge duplicate and the passage stands.

### C004
- key: Do not use the consult for design-time divergence; use design-council instead.
- class: rule
- source: plugins/claude-kit/skills/consult/SKILL.md:3
- provenance: 1d9c467 2026-08-15, the plan's sibling discriminator set.
- verdict: retire
- superseded-by: R005
- reason: Survives verbatim at HEAD line 3 as part of R005 after the 9f1ed1b merge; this id retires as the pre-merge duplicate and the passage stands.

### C005
- key: Dispatch exactly one read-only fresh judge, the `consultant` agent, on one question, without giving it this session's transcript.
- class: mechanic
- source: plugins/claude-kit/skills/consult/SKILL.md:8
- provenance: 1d9c467 2026-08-15, the consult plan; the read-only half is enforced by plugins/claude-kit/hooks/readonly-agent-guard.js, which governs `consultant` by name.
- verdict: retire
- superseded-by: R006
- reason: 9f1ed1b rewrote line 8 (merged at d9540ad) so the consultant is the seat at every floor shape but the design stop, whose judge executing-work step 4 names; the instruction survives at HEAD line 8 with that carve-out as R006, and this id retires as the pre-merge duplicate.

### C006
- key: Require the consultant to issue a ruling, test the querent's framing rather than ratify it, and end implementable.
- class: rule
- source: plugins/claude-kit/skills/consult/SKILL.md:8
- provenance: 1d9c467 2026-08-15, the plan's mandate ("rule, don't survey; end implementable; every stated instinct is flagged to be tested"), which is what made the incident's fresh-context ruling work.
- verdict: retire
- superseded-by: R008
- reason: Survives verbatim at HEAD line 8 as R008 after the 9f1ed1b merge; this id retires as the pre-merge duplicate. The within-document duplicate of its test-not-ratify clause at line 28 (C024) is the copy that leaves.

### C007
- key: Treat the consultant's blindness to the transcript as the source of its value, since the framing reaches it as text it can test rather than as its own reasoning.
- class: rationale-example
- source: plugins/claude-kit/skills/consult/SKILL.md:8
- provenance: 1d9c467 2026-08-15, the plan's "Why the consult exists": the in-context advisor, sharing the transcript, confirmed the wrong framing in the 2026-08-15 incident.
- verdict: retire
- superseded-by: R007
- reason: Survives verbatim at HEAD line 8 as R007 after the 9f1ed1b merge; this id retires as the pre-merge duplicate. The rationale itself is kept in the document (see R007): withholding the transcript is an omission whose value is invisible from the act, and no hook reads brief contents.

### C008
- key: Use the consult as the kit's only escalation instrument, since the kit provides no in-context advisor.
- class: rationale-example
- source: plugins/claude-kit/skills/consult/SKILL.md:8
- provenance: d6cd30d 2026-08-15 retired the advisor experiment as superseded (unmeasurable: server-side tool, no local record); 1d9c467 wrote the sentence as present-tense fact per the plan.
- verdict: retire
- superseded-by: R009
- reason: Survives verbatim at HEAD line 8 as R009 after the 9f1ed1b merge; this id retires as the pre-merge duplicate. The sentence is kept in the document (see R009) because the advisor is a live harness setting the kit never edits, so a session can meet it enabled.

### C009
- key: Treat the triggers as a counted floor a re-reader can recognize, because stuck sessions feel almost done rather than stuck.
- class: rationale-example
- source: plugins/claude-kit/skills/consult/SKILL.md:12
- provenance: 1d9c467 2026-08-15, the plan's trigger philosophy paragraph.
- verdict: keep
- reason: Without this sentence the four bullets read as symptoms to recognize in oneself, which is the under-firing the floor exists to defeat; the 2026-09-08 kaizen note (kaizen/notes-SCOTT-CLAUDE.md line 49) records a section that owed the consult at the second round and got it at the sixth, so the class is still live and no machinery counts the floor.

### C010
- key: Convene a consult on a second failed attempt at the same problem, whatever its shape.
- class: rule
- source: plugins/claude-kit/skills/consult/SKILL.md:14
- provenance: 1d9c467 2026-08-15 installed trigger (a); fb5d4fe 2026-09-07 added the review seesaw shape (review-loop-exit plan); 9f1ed1b 2026-09-09 added the design stop shape.
- verdict: retire
- superseded-by: R010
- reason: Survives at HEAD line 14 with five shapes as R010 after the 9f1ed1b merge; this id retires as the pre-merge duplicate and the passage stands.

### C011
- key: Where executing-work's tier-escalation ladder already owns the moment, follow that ladder instead of consulting.
- class: rule
- source: plugins/claude-kit/skills/consult/SKILL.md:14
- provenance: 1d9c467 2026-08-15, a review fix: trigger (a) as drafted conflicted with the tier-escalation ladder and was made to defer to it.
- verdict: retire
- superseded-by: R013, R014
- reason: Survives verbatim at HEAD line 14 as R013 after the 9f1ed1b merge, now bounded by R014 so it does not reach the design stop; this id retires as the pre-merge duplicate.

### C012
- key: Convene a consult on any BLOCKED that turns on a decision, before escalating.
- class: rule
- source: plugins/claude-kit/skills/consult/SKILL.md:15
- provenance: 1d9c467 2026-08-15, trigger (b), narrowed in the same commit's review fix from "any BLOCKED" after it mandated a consult before credential and destructive BLOCKEDs.
- verdict: keep
- reason: The gate it states is the operator's own preference, cost or risk-appetite call (class operator-decision), not loop upkeep; executing-work line 53 restates it for the BLOCKED path and names this skill as the owner of the mechanics. Both readers' compressions were the same length as the passage.

### C013
- key: After the consult, send the operator only the preference, cost, or risk-appetite fork that survives, with the ruling attached.
- class: rule
- source: plugins/claude-kit/skills/consult/SKILL.md:15
- provenance: 1d9c467 2026-08-15, the plan's trigger (b) sentence.
- verdict: keep
- reason: At the trigger the routing promise is what makes "consult first" a filter rather than a delay before an inevitable escalation; C039 is the same routing at adjudication and both were kept apart deliberately. The gate is operator-decision class and stays.

### C014
- key: Send an external dependency only the operator can satisfy, and a destructive action awaiting their yes, straight to the operator without a consult.
- class: rule
- source: plugins/claude-kit/skills/consult/SKILL.md:15
- provenance: 1d9c467 2026-08-15, the review fix that exempted the two shapes after the pre-BLOCKED rule proved over-broad.
- verdict: keep
- reason: Class blast-radius: the destructive arm is the doctrine's stop-for-a-yes on an irreversible act, and the dependency arm waits on something only the operator can supply. A gate on an irreversible act stays.

### C015
- key: Convene a consult at a systematic-debugging dead end, before the stop-and-report.
- class: rule
- source: plugins/claude-kit/skills/consult/SKILL.md:16
- provenance: 1d9c467 2026-08-15, trigger (c), wired from the systematic-debugging skill's side in the same commit.
- verdict: keep
- reason: The skill fixes the moment inside the debugging procedure; the consultant charter's description names the trigger only as its own match surface, which cannot point at the skill.

### C016
- key: Convene a consult on a hard-to-reverse or load-bearing decision the spec does not cover, where you would otherwise be guessing.
- class: rule
- source: plugins/claude-kit/skills/consult/SKILL.md:17
- provenance: 1d9c467 2026-08-15, trigger (d), the general license.
- verdict: keep
- reason: The skill carries the guessing bound the charter's description compresses to "weighty"; owner keeps the whole.

### C017
- key: Send a spec gap to the operator only where the answer turns on preference, cost, or risk appetite; rule on it yourself where it turns on facts about the system.
- class: rule
- source: plugins/claude-kit/skills/consult/SKILL.md:19
- provenance: 1d9c467 2026-08-15, the plan's preference-versus-facts discriminator (decided 2026-08-15).
- verdict: keep
- reason: The discriminator binds two seats and each reads it on its own surface: the consultant to know what it may rule, the session to know what to send up. Operator-decision class; it both creates and bounds the gate, so it stays.

### C018
- key: Rule a mixed question first, so only the small real fork reaches the operator rather than the whole tangle.
- class: rule
- source: plugins/claude-kit/skills/consult/SKILL.md:19
- provenance: 1d9c467 2026-08-15, the same discriminator paragraph.
- verdict: keep
- reason: Narrows the operator gate rather than creating one; what survives is still the operator's fork (operator-decision). Two seats apply it, so both surfaces carry it.

### C019
- key: State the decision plainly in the brief.
- class: mechanic
- source: plugins/claude-kit/skills/consult/SKILL.md:25
- provenance: 1d9c467 2026-08-15, the plan's brief template.
- verdict: keep
- reason: Compose versus receive: the skill tells the session what to write, the charter tells the agent what to expect, and neither reader loads the other's surface.

### C020
- key: Return NEEDS_CONTEXT, not a survey, for a consult that arrives without a decision to rule on.
- class: rule
- source: plugins/claude-kit/skills/consult/SKILL.md:25
- provenance: 1d9c467 2026-08-15, the plan's brief template; the plan-reviewer's kindred rule (ead49db 2026-09-08) was modelled on it.
- verdict: keep
- reason: Two charters, two dispatches, two missing inputs; the consult's copy is the session-side statement of what a decision-less brief buys.

### C021
- key: Put the evidence in the brief: for a review-failure consult the rounds' surviving findings, for a debugging consult the hypothesis history.
- class: mechanic
- source: plugins/claude-kit/skills/consult/SKILL.md:26
- provenance: 1d9c467 2026-08-15, the plan's brief template; fb5d4fe 2026-09-07 trimmed the wording under the size ratchet.
- verdict: keep
- reason: Compose versus receive; the per-kind evidence is the session's to assemble and the charter says only "the evidence".

### C022
- key: Name in the brief the repo paths worth reading.
- class: mechanic
- source: plugins/claude-kit/skills/consult/SKILL.md:27
- provenance: 1d9c467 2026-08-15, the plan's brief template.
- verdict: keep
- reason: Compose versus receive, as C019.

### C023
- key: State the querent's current lean in the brief and label it explicitly as an instinct to test.
- class: mechanic
- source: plugins/claude-kit/skills/consult/SKILL.md:28
- provenance: 1d9c467 2026-08-15, the plan's brief template; the label is what the incident's ruling turned on.
- verdict: keep
- reason: Compose versus receive; the label is the session's act and the charter's expectation. The trailing clause on this bullet is C024 and leaves.

### C024
- key: Have the consultant check the querent's lean rather than ratify it.
- class: rule
- source: plugins/claude-kit/skills/consult/SKILL.md:28
- provenance: 1d9c467 2026-08-15, the same plan sentence that produced line 8's mandate.
- verdict: retire
- reason: A within-document duplicate: line 8 states the test-not-ratify mandate for the session and the charter's Test the framing bullet states it for the agent, and the lean bullet's own label ("an instinct to test") already carries the meaning. Safe because both owners keep the rule whole; the edit ends the bullet at the label and is flagged for baseline-testing.

### C025
- key: State in the brief what an implementable answer would look like.
- class: mechanic
- source: plugins/claude-kit/skills/consult/SKILL.md:29
- provenance: 1d9c467 2026-08-15, the plan's brief template.
- verdict: keep
- reason: Compose versus receive, as C019.

### C026
- key: Write bulky evidence to the gitignored `.kit/` scratch path and reference it in the brief by path, never pasted inline.
- class: mechanic
- source: plugins/claude-kit/skills/consult/SKILL.md:31
- provenance: 1d9c467 2026-08-15, the plan's brief template.
- verdict: keep
- reason: The doctrine owns where transient artifacts live and this sentence names that destination in pointer form; the consult-specific rule (by path, never inline) is stated nowhere else for the session.

### C027
- key: Treat writing the brief as part of the mechanism, not overhead, since the briefing cost forces the problem outside the session's own reasoning loop.
- class: rationale-example
- source: plugins/claude-kit/skills/consult/SKILL.md:33
- provenance: 1d9c467 2026-08-15, the plan's discriminator against the advisor ("zero briefing cost" versus "the briefing cost is the mechanism"); the advisor was retired in d6cd30d.
- verdict: retire
- reason: The contrast it drew lost its second term when the advisor left the kit, and the five brief fields plus the NEEDS_CONTEXT return are obeyable without it. The why is this: a brief written for a reader with no transcript forces the session to state the problem outside its own loop, which is where a wrong premise becomes visible.

### C028
- key: Dispatch the consult as a plain Agent-tool call to `consultant` with the fable model override, running Fable at `high`.
- class: mechanic
- source: plugins/claude-kit/skills/consult/SKILL.md:37
- provenance: 1d9c467 2026-08-15, the plan's static Fable-at-high rule (decided 2026-08-15); 42599a6 2026-08-24 reworded only the unavailability clause; test/readonly-agent-guard.test.js line 913 pins the charter's `effort: high` to this sentence.
- verdict: keep
- reason: The consult skill owns the model rule under the ownership map, and the Agent route is the default because the charter's frontmatter effort is already `high`, where the plan reviewer's is `low` and needs Workflow; the contention with brainstorming is two intentional routes, not a conflict.

### C029
- key: Where the fable tier is unavailable, dispatch Opus at `max` through `Workflow`'s `agent()` instead.
- class: mechanic
- source: plugins/claude-kit/skills/consult/SKILL.md:37
- provenance: 1d9c467 2026-08-15, the operator's ruling that the cost hold dies and Opus at `max` is the standing stand-in; 42599a6 2026-08-24 aligned the condition to finishing-work's gate-level fact, pinned by test/doctrine-parity.test.js line 3769.
- verdict: keep
- reason: The contention with brainstorming's wait rule is two intentional semantics: memory `model-tier-substitution-for-review` (operator, 2026-08-18) draws the line at design and planning work, which waits, while a gate-shaped mid-execution seat substitutes. The condition's wording is pinned, so any edit to this line must keep "the stand-in is Opus at `max`" and "could not be run at the fable tier".

### C030
- key: Fill executing-work's Reviewer Dispatch template naming all three fields explicitly: `agentType` as `claude-kit:consultant`, `model`, and `effort`.
- class: mechanic
- source: plugins/claude-kit/skills/consult/SKILL.md:37
- provenance: 1d9c467 2026-08-15, the plan's model rule; d6cd30d 2026-08-15 made executing-work's template name `claude-kit:consultant`.
- verdict: rewrite
- reason: Executing-work owns the Reviewer Dispatch template and its three required fields (line 402), so the enumeration here is a partial copy the ownership map calls a defect; the consult-specific value (`agentType` `claude-kit:consultant`) rides with the pointer. Safe because the template already marks all three REQUIRED and the pointer remains; flagged for baseline-testing.

### C031
- key: Read executing-work's Reviewer Dispatch template for why each dispatch field is required; a consult dispatch only fills it in.
- class: pointer
- source: plugins/claude-kit/skills/consult/SKILL.md:37
- provenance: 1d9c467 2026-08-15, the plan's model rule.
- verdict: keep
- reason: This is the pointer the ownership map asks the non-owner to carry; C030's rewrite folds into it.

### C032
- key: Convene a consult at the triggers autonomously, with no per-plan and no per-session ask.
- class: rule
- source: plugins/claude-kit/skills/consult/SKILL.md:37
- provenance: d6cd30d 2026-08-15: both reviewers found the fallback route citing an authorization that excluded it; the doctrine's covered class was widened first and this sentence was added to point at it.
- verdict: keep
- reason: The doctrine owns the standing dispatch request and this sentence names it as the source, which is the pointer form; the contention with design-council's never-auto-run is two instruments with opposite opt-in by design (council opt-in from f62fc16 2026-06-15).

### C033
- key: Keep the consult's model choice static; never pick a tier dynamically at dispatch time.
- class: rule
- source: plugins/claude-kit/skills/consult/SKILL.md:39
- provenance: 1d9c467 2026-08-15, "Why static Fable-at-high, never dynamic (decided 2026-08-15)".
- verdict: keep
- reason: A rule with no machinery behind it (nothing stops a session choosing a lower tier for a consult) whose incident class recurs whenever a stuck session judges its own question simple.

### C034
- key: Treat any rule asking the stuck session to pick a tier as failing exactly when needed, since the consult fires when the session's judgment is compromised.
- class: rationale-example
- source: plugins/claude-kit/skills/consult/SKILL.md:39
- provenance: 1d9c467 2026-08-15, the same decision paragraph.
- verdict: retire
- reason: C033 states the rule in the same sentence's opening clause and is obeyable without the reason. The why is this: the consult fires at the moment the session's judgment is compromised, so a rule that asks that session to choose a tier correctly fails precisely when it is needed.

### C035
- key: Give the consultant the compensation notch because it is gate-shaped: a shallow ruling gets adopted and steers the section with nothing downstream re-asking.
- class: rationale-example
- source: plugins/claude-kit/skills/consult/SKILL.md:39
- provenance: 1d9c467 2026-08-15, a review fix that recast the notch rule on gate-shaped versus plan-following ground in executing-work step 4 so it covers the consultant.
- verdict: retire
- reason: The ground is executing-work's (line 421) and this sentence is a copy applied to one seat; C028 names the tier outright. The why is this: the consultant is gate-shaped, so an under-powered ruling is adopted silently with nothing downstream re-asking the question, which is what the top tier compensates for.

### C036
- key: Have the consultant return a RULING with its EVIDENCE and CONFIDENCE, plus an OPERATOR FORK when one survives.
- class: mechanic
- source: plugins/claude-kit/skills/consult/SKILL.md:43
- provenance: 1d9c467 2026-08-15, the plan's adjudication section and the charter's output contract.
- verdict: keep
- reason: The charter owns the output contract; this one sentence names the sections the session must adjudicate, without which C037 to C039 cannot be stated. The OPERATOR FORK carries an operator-decision gate that stays.

### C037
- key: Treat the ruling as a hypothesis and check it against the real code before acting on it.
- class: rule
- source: plugins/claude-kit/skills/consult/SKILL.md:43
- provenance: 1d9c467 2026-08-15; the incident was a ruling adopted on a wrong premise.
- verdict: keep
- reason: The consult skill owns how a ruling is adjudicated (executing-work line 492 says so by name), so this is the doctrine's hypothesis rule applied at the owned moment rather than a copy; the charter's version binds the consultant's own evidence.

### C038
- key: Adopt what holds, and record in the Chapter both the ruling and what was discarded and why.
- class: rule
- source: plugins/claude-kit/skills/consult/SKILL.md:43
- provenance: 1d9c467 2026-08-15, the plan's adjudication section.
- verdict: keep
- reason: The Chapter destination is consult-specific and executing-work's Chapter template (Review Findings, Metrics) reads what this tells the session to record.

### C039
- key: When the ruling leaves a genuine preference fork, send that fork to the operator as the BLOCKED with the ruling attached.
- class: rule
- source: plugins/claude-kit/skills/consult/SKILL.md:43
- provenance: 1d9c467 2026-08-15, the plan's trigger (b) routing stated at adjudication.
- verdict: keep
- reason: The routing act at the moment it happens; operator-decision class, guarding the operator's call. C013 is its anticipation at the trigger and both were kept apart deliberately.

### C040
- key: Use the consult when you need the frame checked by fresh context in a single seat, convenable mid-execution.
- class: rationale-example
- source: plugins/claude-kit/skills/consult/SKILL.md:47
- provenance: 1d9c467 2026-08-15, the plan's discriminator set, born of the incident where the right instrument was not found mid-execution.
- verdict: keep
- reason: The anchor of the four-line sibling set; the three lines below it are the pointers the ownership map asks a non-owner to carry, so the set stands together.

### C041
- key: Use design-council instead for multi-lens divergence at design time with the operator present to adjudicate.
- class: rationale-example
- source: plugins/claude-kit/skills/consult/SKILL.md:48
- provenance: 1d9c467 2026-08-15, the plan's discriminator set.
- verdict: keep
- reason: The body's pointer at design-council, which owns the multi-lens fork, and the only place this document says what marks a moment design-time.

### C042
- key: Use cold instead when the operator's own preference contaminates the framing and fresh judgment is needed.
- class: rationale-example
- source: plugins/claude-kit/skills/consult/SKILL.md:49
- provenance: 1d9c467 2026-08-15, the plan's discriminator set.
- verdict: keep
- reason: The document's sole pointer at cold, which owns the preference-contaminated verdict.

### C043
- key: Use the reviewers instead when the subject is a diff rather than a question.
- class: rationale-example
- source: plugins/claude-kit/skills/consult/SKILL.md:50
- provenance: 1d9c467 2026-08-15, the plan's discriminator set.
- verdict: keep
- reason: The body's pointer at the reviewers, who own diffs; the frontmatter's exclusion is a match surface a session that loaded the skill by name never re-reads.

### R001
- key: Convene one fresh-context judge to rule on a question this session cannot settle.
- class: rule
- source: plugins/claude-kit/skills/consult/SKILL.md:3
- provenance: 9f1ed1b 2026-09-09, section 3 of the review-loop provenance plan (docs/plans/claude-kit_review-loop-provenance_spec_v1.md), merged at d9540ad; the sentence itself dates from 1d9c467 2026-08-15.
- verdict: keep
- reason: The HEAD form of C001's opening clause; the description is the harness's match surface and this is its lead term.

### R002
- key: Use the `consultant` agent for every shape the trigger floor sends to a consult except the design stop.
- class: mechanic
- source: plugins/claude-kit/skills/consult/SKILL.md:3
- provenance: 9f1ed1b 2026-09-09, the design stop: a judge that must never receive the querent's lean, so its seat is the scope adjudicator or the live Expert seat rather than the consultant.
- verdict: keep
- reason: The seat carve-out stated on the match surface so a session at a design stop does not dispatch the consultant with a lean the judge must not see; executing-work step 4 owns the design stop and this is the pointer-sized statement.

### R003
- key: Convene a consult mid-execution at any trigger-floor shape, and when the operator asks for a consult or a second opinion.
- class: rule
- source: plugins/claude-kit/skills/consult/SKILL.md:3
- provenance: 9f1ed1b 2026-09-09 rewrote the line; the instruction is 1d9c467 2026-08-15, the consult plan's trigger philosophy.
- verdict: keep
- reason: The HEAD form of C001; the four enumerated triggers are the match terms the harness keys on, and d6cd30d records that the description is the trigger surface.

### R004
- key: Decide whether to consult by checking the trigger floor, never by whether the session feels stuck.
- class: rule
- source: plugins/claude-kit/skills/consult/SKILL.md:3
- provenance: 9f1ed1b 2026-09-09 rewrote the line; the instruction is 1d9c467 2026-08-15, the trigger philosophy.
- verdict: keep
- reason: The HEAD form of C002; the load decision itself, placed where the session decides whether to load, and the 2026-09-08 kaizen note shows the under-firing class is still live.

### R005
- key: Do not use a consult to review a diff or to run design-time divergence; those go to the reviewers and to design-council.
- class: rule
- source: plugins/claude-kit/skills/consult/SKILL.md:3
- provenance: 9f1ed1b 2026-09-09 rewrote the line; the exclusions are 1d9c467 2026-08-15, the discriminator set.
- verdict: keep
- reason: The HEAD form of C003 and C004; exclusions on the match surface, with the body's sibling lines as the pointers at the owners.

### R006
- key: Dispatch one read-only fresh judge on one question, the `consultant` agent at every consult shape but the design stop.
- class: mechanic
- source: plugins/claude-kit/skills/consult/SKILL.md:8
- provenance: 9f1ed1b 2026-09-09 added the design-stop carve-out; the rule is 1d9c467 2026-08-15, with the read-only half enforced by plugins/claude-kit/hooks/readonly-agent-guard.js.
- verdict: keep
- reason: The HEAD form of C005 with the carve-out executing-work step 4 owns; the no-transcript half has no machinery behind it and is what the blindness rationale (R007) keeps obeyed.

### R007
- key: Keep the judge blind to this session's transcript, because a framing that arrives as text can be tested rather than merely extended.
- class: rationale-example
- source: plugins/claude-kit/skills/consult/SKILL.md:8
- provenance: 9f1ed1b 2026-09-09 rewrote the line; the rationale is 1d9c467 2026-08-15, "Why the consult exists": the advisor confirmed the wrong framing because it shared the transcript.
- verdict: keep
- reason: The HEAD form of C007. Withholding the transcript is an omission whose value is invisible from the act, no hook reads brief contents, and the incident (a shared-context judge ratifying a wrong frame) recurs the first time a session pastes its reasoning in.

### R008
- key: Have the consult rule rather than survey, test the querent's framing rather than ratify it, and end implementable.
- class: rule
- source: plugins/claude-kit/skills/consult/SKILL.md:8
- provenance: 9f1ed1b 2026-09-09 rewrote the line; the mandate is 1d9c467 2026-08-15.
- verdict: keep
- reason: The HEAD form of C006; the session-side statement of the mandate the charter owns, one sentence, which the session adjudicating a return needs on its own surface.

### R009
- key: Escalate through the consult; do not reach for an in-context advisor, as the kit provides none.
- class: rule
- source: plugins/claude-kit/skills/consult/SKILL.md:8
- provenance: 9f1ed1b 2026-09-09 rewrote the line; the sentence is 1d9c467 with the advisor retired in d6cd30d 2026-08-15.
- verdict: keep
- reason: The HEAD form of C008; the advisor is a live harness setting the kit never edits, so the sentence is what fixes the escalation route for a session that meets it enabled.

### R010
- key: Convene a consult on a second failed attempt at the same problem, whatever the attempt's shape.
- class: rule
- source: plugins/claude-kit/skills/consult/SKILL.md:14
- provenance: 9f1ed1b 2026-09-09 added the design stop shape; 1d9c467 installed the trigger and fb5d4fe 2026-09-07 the seesaw shape.
- verdict: keep
- reason: The HEAD form of C010; the skill owns the shapes and the charter's description names the trigger only as its own match surface.

### R011
- key: Treat a design stop as a floor shape, but let executing-work's step 4 convene the judge its provenance paragraph names instead of the `consultant`.
- class: mechanic
- source: plugins/claude-kit/skills/consult/SKILL.md:14
- provenance: 9f1ed1b 2026-09-09, the design stop, added so a re-reader counting second-attempt shapes finds it.
- verdict: keep
- reason: The one shape on the floor whose seat is not the consultant; stated here because a session counting the floor would otherwise dispatch the consultant with the lean that judge must never receive. Executing-work step 4 owns the stop and this is the pointer.

### R012
- key: Expect the design stop not to be the only shape routing elsewhere, since the repeating-class Critical branch goes to the tier ladder.
- class: rationale-example
- source: plugins/claude-kit/skills/consult/SKILL.md:14
- provenance: 9f1ed1b 2026-09-09, the design stop paragraph.
- verdict: retire
- reason: R011 is obeyable without it and executing-work step 4 owns the design stop whole. The why is this: the design stop is listed on the floor, not only in executing-work, because a re-reader counting second-attempt shapes has to find it, and it is not the only shape that routes away from the consultant, the repeating-class Critical branch going to the tier ladder.

### R013
- key: Where executing-work's tier-escalation ladder owns the moment, follow the ladder rather than convening a consult.
- class: rule
- source: plugins/claude-kit/skills/consult/SKILL.md:14
- provenance: 9f1ed1b 2026-09-09 rewrote the line; the deferral is the 1d9c467 review fix that resolved trigger (a)'s conflict with the ladder.
- verdict: keep
- reason: The HEAD form of C011; without it a second failed review round with a repeating Critical class would draw a consult on framing where the ladder's tier bump is the remedy.

### R014
- key: Fire the design stop beside the tier ladder rather than deferring to it.
- class: rule
- source: plugins/claude-kit/skills/consult/SKILL.md:14
- provenance: 9f1ed1b 2026-09-09; executing-work line 431 states the same from the owner's side (the ladder keys on Criticals, the stop on provenance).
- verdict: keep
- reason: The bound on this document's own deferral rule (R013), without which R013 reads as sending the design stop to the ladder too; one sentence, and the owner's text agrees.

### R015
- key: Do not apply this brief section or the three sections below it to the design stop.
- class: rule
- source: plugins/claude-kit/skills/consult/SKILL.md:33
- provenance: 9f1ed1b 2026-09-09, the design stop.
- verdict: keep
- reason: Scopes the brief, model, adjudication and siblings sections to the consultant so the design stop's judge is not briefed with a lean or its bucket re-verified as a hypothesis; the scoping is this document's to state.

### R016
- key: For the design stop, take the brief from the scope adjudicator's charter, dispatch as executing-work's step 4 states, and adopt its bucket as a ruling.
- class: mechanic
- source: plugins/claude-kit/skills/consult/SKILL.md:33
- provenance: 9f1ed1b 2026-09-09, the design stop.
- verdict: rewrite
- reason: Executing-work step 4 owns the design stop's brief, dispatch and bucket, and this sentence restates three of its particulars where the ownership map allows a pointer. Safe because the owner's paragraph (executing-work line 431) carries every particular restated here; the pointer replaces them and is flagged for baseline-testing.
