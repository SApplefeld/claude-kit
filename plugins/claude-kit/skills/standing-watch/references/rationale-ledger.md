# Rationale ledger: standing-watch

This file is the rationale ledger for the documents the `standing-watch` skill owns. Rule text says what happens; this ledger says why; git says when. Nobody loads it by default. A session about to change a rule in one of the documents below reads the entry for the claim it is changing first, so the reason a rule holds is not re-litigated at the next review.

Each document sits under its own heading, which opens with its inventory line (what the document is for, which moments it owns, and when a session loads it) and then carries one entry per claim, retired claims included so the next audit does not re-find them. An entry is keyed by the claim's imperative sentence and carries its class (rule, mechanic, pointer, or rationale-example), its source as file and line, its provenance (the commit, incident, memory or kaizen note that installed it, or `no provenance found`), and its verdict (keep, rewrite, or retire) with the reason. A `C` entry's source line is read at the extraction commit `6bc07fb`; an `R` entry is a claim re-extracted from a hunk the Section 5 merge changed, and its source line is read at the merged commit `d9540ad`. Claim numbers restart under every document heading, and inside a document read in chunks they restart per chunk, so an entry id is unique only under its heading and a chunked document carries the chunk in the id (`c2.C001` is claim C001 of the second chunk); a claim named inside a reason or provenance line of such a document carries the same prefix. A `C` entry whose source hunk the Section 5 merge rewrote reads `retire` and carries a `superseded-by:` line naming the `R` entry that holds the passage at the merged commit; the passage's own verdict is that entry's, so a count of retirements over this ledger leaves those records out. A reason may name the form the judge ruled toward (a pointer at the owner, a split, a fold into a neighbour), because that form is why the verdict is rewrite rather than keep or retire; what a passage becomes is the rewrite plan's to decide, and where the two differ the rewrite plan governs. The target wording a judge proposed rides on the entry's `proposed:` line, one line per distinct proposal, on rewrite and retire entries that retire a passage; a proposal that pointed at another ruling by id carries the resolved text marked `(via Annn)`. A rewrite or retire the judge flagged as behavior-shaping carries `baseline-test: yes`, which is what the rewrite plan's RED and GREEN step keys on. What a passage becomes is the rewrite plan's to decide (`claude-kit_corpus-rewrite_spec_v1.md` under `docs/plans/`), and where it and a proposal differ the rewrite plan governs.

## plugins/claude-kit/skills/standing-watch/SKILL.md

This document is the chassis for a session standing watch over a live system it does not own, running as a repeating loop that wakes, checks, intervenes and sleeps again. It owns the moments where a watch decides what its two written surfaces hold and how they are kept: what goes on the runbook versus the ledger, whether a line is admitted to the ledger at all and under which kind, how a superseded fact is rewritten and when history is pruned, the fixed order of every tick (arm the heartbeat, re-derive the board, re-measure before obeying, act, write, arm, sleep), how a wake prompt is authored and how pacing is chosen, the shape of a ping to the operator, the preflight before any one-way-door action on the watched system including killing a dispatched agent, and where a lesson or a decision is routed at the end of a run or during it. Its load class is `named-trigger`: the frontmatter says to use it when a session watches a live system on a repeating loop, when a loop is armed with /loop or a self-authored wake prompt, when a runbook or ledger is in play, or when the operator asks the session to keep an eye on a running system.

Extracted at `6bc07fb`: whole document (`skills.standing-watch.SKILL.md`).

### C001
- key: Run a watch on exactly two written surfaces, the runbook and the ledger, and no others.
- class: rule
- source: plugins/claude-kit/skills/standing-watch/SKILL.md:12
- provenance: 0ea17a9 2026-08-18, installed with the skill from the forty-one-pass watch loop whose notes went stale and were obeyed as fact (docs/archive/claude-kit_standing-watch_spec_v1.md, Goal).
- verdict: keep
- reason: No finding. The closed class of two is what lets the loop's memory be enumerated at all; a third surface is a third place for state to go stale unnoticed.

### C002
- key: Keep the runbook as the committed, project-specific procedure: what a pass checks, in what order, with which commands, and what each result means.
- class: mechanic
- source: plugins/claude-kit/skills/standing-watch/SKILL.md:14
- provenance: 0ea17a9 2026-08-18, installed with the skill (docs/archive/claude-kit_standing-watch_spec_v1.md, Approach).
- verdict: keep
- reason: A001. Nothing enforces the runbook's content; the rule holds because the runbook is the only place the procedure survives a session.

### C003
- key: Change the runbook only when the procedure itself changes.
- class: rule
- source: plugins/claude-kit/skills/standing-watch/SKILL.md:14
- provenance: 0ea17a9 2026-08-18, installed with the skill.
- verdict: keep
- reason: No finding. It is the boundary that keeps state out of the committed file and procedure out of the ledger.

### C004
- key: Keep the ledger gitignored under `.kit/`, holding what is true of the watched system now and what the loop learned.
- class: mechanic
- source: plugins/claude-kit/skills/standing-watch/SKILL.md:15
- provenance: 0ea17a9 2026-08-18, installed with the skill.
- verdict: keep
- reason: A002 to A004. Park's line places a different artifact; the map gives the ledger to this skill; only the gitignore half is mechanical and it is per-project.

### C005
- key: Rewrite the ledger in place rather than appending to it.
- class: rule
- source: plugins/claude-kit/skills/standing-watch/SKILL.md:15
- provenance: 0ea17a9 2026-08-18, installed with the skill; the act's rule at line 36 was earned by RED/GREEN probe B (docs/archive/claude-kit_standing-watch_spec_v1.md line 237).
- verdict: keep
- reason: A005, A006. An attribute in the artifact's definition, not a second statement of the supersede rule that line 36 owns.

### C006
- key: Never let anything the loop needs live only in a session's context.
- class: rule
- source: plugins/claude-kit/skills/standing-watch/SKILL.md:17
- provenance: 02980e2 2026-08-18 last touched the line in the arming repair; the sentence is the skill's founding premise from 0ea17a9 2026-08-18.
- verdict: keep
- reason: A007 to A009. The premise stays at line 17 under the A008 rewrite; executing-work's recovery lines govern other artifacts.

### C007
- key: End every pass in this fixed order: finish the tick, write the ledger, then arm the wake.
- class: rule
- source: plugins/claude-kit/skills/standing-watch/SKILL.md:17
- provenance: 02980e2 2026-08-18, the adversarial review's second arming contradiction between this section and the tick order.
- verdict: rewrite
- reason: A008, A010, A011. The tick order at line 49 owns the sequence; two statements of one sequence is the class that produced both arming contradictions, so line 17 points and step 4 keeps.
- proposed: Line 49 (C062) keeps the sequence; line 17 points at the tick order.
- proposed: (via A010) Line 49 (C062) keeps the sequence; line 17 points at the tick order.
- baseline-test: yes

### C008
- key: Treat arming before writing as losing the pass, because the write may never happen.
- class: rationale-example
- source: plugins/claude-kit/skills/standing-watch/SKILL.md:17
- provenance: 02980e2 2026-08-18, arming repair; the cost was stated at 0ea17a9 2026-08-18.
- verdict: keep
- reason: A012. The tick both opens and closes by arming, so the end-of-pass order reads as contradicting step 1 unless this reason names which arm and why.

### C009
- key: Recognize exactly two arm reasons and no more: the safety arm (standing repeating heartbeat) and the paced arm (a one-shot setting the next pass).
- class: mechanic
- source: plugins/claude-kit/skills/standing-watch/SKILL.md:17
- provenance: 02980e2 2026-08-18, the two-arm design that ended the second arming contradiction.
- verdict: keep
- reason: A013. The definitions are the repair; nothing classifies an arm mechanically.

### C010
- key: On a restart, put the heartbeat up before checking anything.
- class: rule
- source: plugins/claude-kit/skills/standing-watch/SKILL.md:17
- provenance: 02980e2 2026-08-18, arming repair; the restart rule itself is from 0ea17a9 2026-08-18 (tick order).
- verdict: rewrite
- reason: A014, A015. Tick step 1 at line 46 states it with the reason and the cadence ownership; line 17 keeps the safety-arm definition and drops the restatement of when it is armed.
- proposed: Line 46 (C057) keeps; line 17's restart clause folds into the pointer at the tick order.
- proposed: (via A014) Line 46 (C057) keeps; line 17's restart clause folds into the pointer at the tick order.
- baseline-test: yes

### C011
- key: Treat both arm steps as ensure rather than add: add no second heartbeat, and take no one-shot on a static board.
- class: rule
- source: plugins/claude-kit/skills/standing-watch/SKILL.md:17
- provenance: 02980e2 2026-08-18, "reads both steps as ensure rather than add" was the repair's own wording.
- verdict: rewrite
- reason: A016, A017. Steps 1 and 4 each carry their own ensure reading; line 17 keeps the phrase only as the gloss on its pointer at the tick order.
- proposed: Lines 46 (C058) and 49 (C063) keep; line 17 keeps only "both steps read as ensure rather than add" as the pointer's gloss.
- proposed: (via A016) Lines 46 (C058) and 49 (C063) keep; line 17 keeps only "both steps read as ensure rather than add" as the pointer's gloss.
- baseline-test: yes

### C012
- key: Treat anything else a tick produces (a ping, a commit, an intervention) as an output of that tick, never as a loop artifact.
- class: rule
- source: plugins/claude-kit/skills/standing-watch/SKILL.md:17
- provenance: 02980e2 2026-08-18.
- verdict: keep
- reason: A008. Closes the two-artifact class; survives the line 17 rewrite unchanged.

### C013
- key: Keep the ledger's two kinds of content in separate sections and never interleave them.
- class: rule
- source: plugins/claude-kit/skills/standing-watch/SKILL.md:21
- provenance: 0ea17a9 2026-08-18, installed with the skill.
- verdict: keep
- reason: No finding. Interleaving is what makes a successor sort before it can act (memory a-coordination-ledger-holds-current-state-not-its-own-journey, Resume cost).

### C014
- key: File as Standing the prohibitions, mechanisms confirmed in the system's source, and do-not-reopen traps, which stay true without re-measurement.
- class: mechanic
- source: plugins/claude-kit/skills/standing-watch/SKILL.md:23
- provenance: 0ea17a9 2026-08-18, installed with the skill.
- verdict: keep
- reason: A018. No classifier exists. The backlog (line 361) holds a separate design item that this enumeration lacks the trailing-clause marker the gating-definition rule requires.

### C015
- key: File as Situational the board as of the last pass, open interventions, recent pings, and the quiet-streak length, which a later pass must re-derive before acting on.
- class: mechanic
- source: plugins/claude-kit/skills/standing-watch/SKILL.md:24
- provenance: 0ea17a9 2026-08-18, installed with the skill.
- verdict: keep
- reason: A019. No classifier exists. The backlog (line 362) records that a recent ping cannot carry the re-derive command line 34 requires, a design question for the follow-on.

### C016
- key: Place a line on the ledger only if a successor with no context needs it to resume the watch.
- class: rule
- source: plugins/claude-kit/skills/standing-watch/SKILL.md:26
- provenance: 3074425 2026-08-31, the coordinator board that filled with its own journey; banked operator-tier as a-coordination-ledger-holds-current-state-not-its-own-journey.
- verdict: keep
- reason: A020. The three disqualified grounds are what stops the old re-derivability test being read back in; no hook screens a ledger line.

### C017
- key: Reject a line that argues rather than states, or whose subject is the keeper's own reasoning rather than the watched system.
- class: mechanic
- source: plugins/claude-kit/skills/standing-watch/SKILL.md:26
- provenance: 3074425 2026-08-31, the memory record's own tell for a drifted ledger.
- verdict: keep
- reason: A021 to A023. Line 79 cites this tell rather than restating it; nothing applies it mechanically.

### C018
- key: Route what a rejected line carries, where durable, to the destination rule at the end of this file rather than back onto the ledger.
- class: rule
- source: plugins/claude-kit/skills/standing-watch/SKILL.md:26
- provenance: 3074425 2026-08-31.
- verdict: keep
- reason: A024, A025. This line is the owner of the route; under the rewrite it gains the drop branch line 28 currently adds.

### C019
- key: Keep off the ledger any line the keeper cannot confidently say a successor needs.
- class: rule
- source: plugins/claude-kit/skills/standing-watch/SKILL.md:28
- provenance: 6c725a0 2026-09-03, the inverted default from the 201-kilobyte coordinator board, Section 2 of docs/archive/claude-kit_gating-definitions_spec_v1.md.
- verdict: keep
- reason: A026 to A028. The sentence is pinned verbatim by test/doctrine-parity.test.js (line 1935); a rewording that keeps the direction still fails the pin, so update the pin in the same edit.

### C020
- key: Accept the loss of a wrongly-excluded line, because a reproducible fact costs one re-derivation, a durable one costs one read of its home surface, and the rest is content the test exists to keep off.
- class: rationale-example
- source: plugins/claude-kit/skills/standing-watch/SKILL.md:28
- provenance: 6c725a0 2026-09-03, "with the loss accepted in place rather than argued away".
- verdict: keep
- reason: A029. The third cost is the one instruction that stops a rescue on the only-record ground the founding incident used; the backlog contests this pricing (lines 368, 369), which shows it is load-bearing.

### C021
- key: Expect a wrongly-admitted line to survive every rewrite, because supersede, prune and the per-pass write all ask what fact a line holds and never whether it belongs.
- class: rationale-example
- source: plugins/claude-kit/skills/standing-watch/SKILL.md:28
- provenance: 6c725a0 2026-09-03.
- verdict: rewrite
- reason: A027, A030. The one-sentence asymmetry stays because it is why the default faces outward; the trace it currently carries restates lines 36 and 40 and lives here: supersede fires on a changed fact, prune moves only what supersede retired, the per-pass write leaves an unrefreshed line as found, so no later rule asks whether a line belongs.
- proposed: One sentence: a wrongly-admitted line survives every rewrite this file performs, since none asks again whether a line belongs; the three-rule trace lives in this ledger under C021.
- baseline-test: yes

### C022
- key: Fire supersede only when the fact a line holds changes.
- class: rule
- source: plugins/claude-kit/skills/standing-watch/SKILL.md:28
- provenance: 6c725a0 2026-09-03 restated it; the rule was installed at 0ea17a9 2026-08-18 (line 36) and earned by probe B.
- verdict: rewrite
- reason: A031, A032. Line 36 owns supersede; this premise becomes a pointer at it.
- proposed: Line 36 keeps; line 28's premise reads "supersede, under its own rule below, fires only on a changed fact"; line 30's C040 stays.
- proposed: (via A031) Line 36 keeps; line 28's premise reads "supersede, under its own rule below, fires only on a changed fact"; line 30's C040 stays.
- baseline-test: yes

### C023
- key: Prune only what supersede has already retired.
- class: rule
- source: plugins/claude-kit/skills/standing-watch/SKILL.md:28
- provenance: 6c725a0 2026-09-03 restated it; line 40 ("move superseded history") is from 0ea17a9 2026-08-18.
- verdict: rewrite
- reason: A027. Line 40 owns the prune; this premise becomes a pointer at it.

### C024
- key: Write back what the re-derive step produced, rewriting a refreshed line current and leaving standing as found any line the re-derivation neither confirmed nor contradicted.
- class: rule
- source: plugins/claude-kit/skills/standing-watch/SKILL.md:28
- provenance: 6c725a0 2026-09-03.
- verdict: keep
- reason: A027. The only statement in the file of what the per-pass write does to an unrefreshed line; tick step 4 says only "write the ledger", so this has no owner to point at and may move beside step 4.

### C025
- key: Send a line the admission default keeps off to the destination rule where it carries something durable, and otherwise drop it.
- class: rule
- source: plugins/claude-kit/skills/standing-watch/SKILL.md:28
- provenance: 6c725a0 2026-09-03.
- verdict: rewrite
- reason: A024, A025, A033, A034. The sentence already says "by the same route as a line that fails the test"; the drop branch moves to line 26 and this becomes the bare pointer.

### C026
- key: Apply the admission default only to what no rule has already placed as ledger content.
- class: rule
- source: plugins/claude-kit/skills/standing-watch/SKILL.md:30
- provenance: be769a8 2026-09-03, the route by which a doubted prohibition could be kept off and drop from the wake prompt; the residual framing is from 6c725a0 2026-09-03.
- verdict: keep
- reason: A035. The paragraph lead is pinned (test/doctrine-parity.test.js line 1935); the A035 rewrite splits the paragraph and pointer-izes its restated premises but keeps this sentence verbatim.

### C027
- key: Treat as placed by this file: the two-kinds rule's members, the read protocol, and the pass record named by the destination rule.
- class: mechanic
- source: plugins/claude-kit/skills/standing-watch/SKILL.md:30
- provenance: be769a8 2026-09-03.
- verdict: keep
- reason: A036. Nothing performs placement; the backlog (line 365) notes the coordinator's board excludes the read protocol this names, a consumer-side gap.

### C028
- key: Do not read "the current state" as a placed class of its own; it is the ledger's own definition, already divided into the placed members.
- class: rule
- source: plugins/claude-kit/skills/standing-watch/SKILL.md:30
- provenance: be769a8 2026-09-03, closing a reading that would make every fact of the watched system a recognised member.
- verdict: rewrite
- reason: A035. A defensive gloss on line 81's wording; the safe move is to word line 81 so the reading cannot arise and drop the gloss, in the same edit that gives line 81 its missing destination leg (A093).

### C029
- key: Apply the admission test to placed classes too; placement settles only that a successor needs the class, never that a line is exempt from the test.
- class: rule
- source: plugins/claude-kit/skills/standing-watch/SKILL.md:30
- provenance: be769a8 2026-09-03, "the repair is a pointer to the rules that already answer whether such a line is needed, not a new exception".
- verdict: keep
- reason: A035. Without it placement would become the exemption the be769a8 round rejected outright (Standing Brief Amendment 2 of that plan).

### C030
- key: Refuse a line that is not the member it presents as, and refuse a member whose particular line no successor needs to resume the watch.
- class: rule
- source: plugins/claude-kit/skills/standing-watch/SKILL.md:30
- provenance: be769a8 2026-09-03.
- verdict: keep
- reason: A035. The two refusals are what keep the test whole under placement; the first is the founding incident's dressed-up lines.

### C031
- key: Keep off a recognised member whose particular line the keeper cannot confidently say a successor needs, and route it by the destination rule or drop it.
- class: rule
- source: plugins/claude-kit/skills/standing-watch/SKILL.md:30
- provenance: be769a8 2026-09-03.
- verdict: keep
- reason: A026, A028, A033, A034. Already the pointer form ("exactly as the paragraph above states it") and carries the pinned carve-out for a prohibition or trap; deleting it deletes the exemption's application.

### C032
- key: Apply the admission default only in the test's doubt branch, in its three shapes: an unplaced line whose need cannot be called, a line not recognisable as a member, and a recognised member whose particular line cannot be called needed.
- class: mechanic
- source: plugins/claude-kit/skills/standing-watch/SKILL.md:30
- provenance: be769a8 2026-09-03.
- verdict: keep
- reason: A037. No program classifies a doubt; the backlog (line 369) contests the second shape for a DO-NOT of uncertain membership, which is a design question on this sentence.

### C033
- key: Read a prohibition's cited condition measuring false as meaning the line does not bind this pass, never that the line is retired.
- class: rule
- source: plugins/claude-kit/skills/standing-watch/SKILL.md:30
- provenance: be769a8 2026-09-03, a security-lens regression in that round made a false reading a retirement trigger and was reverted.
- verdict: keep
- reason: A038. Blast-radius gate on an act against a system the watch does not own; the regression it guards against was real in the same round.

### C034
- key: Hold a prohibition that cites no condition as binding until the operator's word retires it.
- class: rule
- source: plugins/claude-kit/skills/standing-watch/SKILL.md:30
- provenance: be769a8 2026-09-03; that round withdrew a governing-document retirement route because the re-measure step re-reads a document only for a line citing a condition.
- verdict: keep
- reason: A039 to A041. Premise for the conditionless case; blast-radius. The backlog (line 371) notes the liveness cost, over-binding after a document drops the prohibition, which is the recoverable direction.

### C035
- key: Treat a do-not-reopen trap as needed however old it is.
- class: rule
- source: plugins/claude-kit/skills/standing-watch/SKILL.md:30
- provenance: be769a8 2026-09-03 restated it; the rule is line 40's from 0ea17a9 2026-08-18.
- verdict: keep
- reason: A042, A043. Ends "by the prune rule", which is the pointer form at the owner.

### C036
- key: Put a recognised prohibition or trap on the standing list and remove it only when its source retires it.
- class: rule
- source: plugins/claude-kit/skills/standing-watch/SKILL.md:30
- provenance: be769a8 2026-09-03.
- verdict: keep
- reason: A039, A040. The conclusion that places both members and names the one fact supersede fires on for them; C034 is its premise.

### C037
- key: A consuming skill naming a member whose content no probe reproduces and whose loss licenses the act it closes off must state that the member takes this exemption.
- class: rule
- source: plugins/claude-kit/skills/standing-watch/SKILL.md:30
- provenance: be769a8 2026-09-03, the exemption pinned on the property rather than the names so a consumer's equivalent member reads it.
- verdict: keep
- reason: A035. The property sentence is pinned (test/doctrine-parity.test.js line 1935); the obligation is what makes the pin mean anything to a consumer.

### C038
- key: Do not admit or rescue a line on the grounds that nothing else records it.
- class: rule
- source: plugins/claude-kit/skills/standing-watch/SKILL.md:30
- provenance: 6c725a0 2026-09-03, the founding incident's content had no other record either.
- verdict: keep
- reason: A035. Pinned verbatim ("Having no other record neither admits a line nor rescues one"); the load-bearing half of the outward default.

### C039
- key: A skill built on this chassis must name by rule every class its ledger is the one record of.
- class: rule
- source: plugins/claude-kit/skills/standing-watch/SKILL.md:30
- provenance: 6c725a0 2026-09-03, "the placed class defined by the rule that places it rather than by an enumeration the chassis cannot close over its consumers".
- verdict: keep
- reason: A035. The one route by which a one-record class survives the outward default; a consumer that skips it loses the class by construction.

### C040
- key: Rewrite in place under supersede the reading a withdrawal replaced, whether the watched thing moved or the instrument was wrong.
- class: rule
- source: plugins/claude-kit/skills/standing-watch/SKILL.md:30
- provenance: be769a8 2026-09-03, routing the founding incident's withdrawn readings to the rule that already places them.
- verdict: keep
- reason: A031, A032. Not a restatement of line 36: it settles that a wrong instrument is a changed fact, which line 36 does not say.

### C041
- key: File a correction that earned a ping as a recent ping on the situational list, file the trap a broken instrument taught on the standing list, and send the reasoning that produced the trap to the memory store.
- class: mechanic
- source: plugins/claude-kit/skills/standing-watch/SKILL.md:30
- provenance: be769a8 2026-09-03, routing the memory record's three "what fails" shapes to their homes.
- verdict: keep
- reason: A044. Three keeper-performed writes; no hook files any of them.

### C042
- key: Decide doubt about which kind an admitted line is on the cost of the misfiling, never on the kinds' names.
- class: rule
- source: plugins/claude-kit/skills/standing-watch/SKILL.md:32
- provenance: 6c725a0 2026-09-03, the kind fork stated for the chassis and mirrored in the coordinator.
- verdict: keep
- reason: A045, A046. The fork's lead is pinned; the A045 rewrite pointer-izes the restated kind definitions and wake-prompt trace and keeps this sentence.

### C043
- key: Re-derive by probing the watched system, never by reading another record, whatever the line's provenance.
- class: mechanic
- source: plugins/claude-kit/skills/standing-watch/SKILL.md:32
- provenance: 6c725a0 2026-09-03 added "whatever the line's provenance" for told-not-derived lines; the probe rule is tick step 2's from 0ea17a9 2026-08-18.
- verdict: keep
- reason: A047 to A049. Pointer at step 2 carrying a bound step 2 lacks; the backlog (line 362) records that a recent ping cannot meet it.

### C044
- key: On this file's two kinds, let doubt fall to situational, since a wrongly-standing line is acted on stale while a wrongly-situational one costs one extra probe per pass.
- class: rule
- source: plugins/claude-kit/skills/standing-watch/SKILL.md:32
- provenance: 6c725a0 2026-09-03.
- verdict: keep
- reason: A050. Pinned through its carve-out clause (test/doctrine-parity.test.js line 1935) because stopping at "situational," left the qualifier position open to a reversing exception.

### C045
- key: Ask first whether the line is a prohibition or a do-not-reopen trap, and let doubt on that question fall to standing.
- class: rule
- source: plugins/claude-kit/skills/standing-watch/SKILL.md:32
- provenance: 6c725a0 2026-09-03; be769a8 2026-09-03 bounded it to doubt ("reaches only the doubt") so it cannot readmit by name.
- verdict: keep
- reason: A045. "such a member falls to standing" and "reaches only the doubt" are both pinned.

### C046
- key: A trap filed situational commands the re-opening it forbids, and a prohibition filed situational drops out of the wake prompt and stops binding before any pass reads the ledger.
- class: rationale-example
- source: plugins/claude-kit/skills/standing-watch/SKILL.md:32
- provenance: 6c725a0 2026-09-03, each member's own reason; the prohibition case was proven real at be769a8 2026-09-03.
- verdict: keep
- reason: A051. The carve-out inverts the paragraph's own default and these two accounts are the only statement of why; both readers keep.

### C047
- key: A skill that replaces these two kinds must state its own kind fork beside its override, on the same cost basis.
- class: rule
- source: plugins/claude-kit/skills/standing-watch/SKILL.md:32
- provenance: 6c725a0 2026-09-03, the coordinator restates both forks for its own board where the cost runs the other way.
- verdict: keep
- reason: A045. The coordinator's fork is pinned beside the chassis's for exactly this reason.

### C048
- key: Give every situational sentence both the time of the evidence behind it and the command that re-derives it.
- class: rule
- source: plugins/claude-kit/skills/standing-watch/SKILL.md:34
- provenance: 0ea17a9 2026-08-18, a neighboring measurement stood in for one that was down in the founding loop.
- verdict: keep
- reason: A052, A053. Executing-work's moment-pin governs a Chapter figure; this governs a ledger line. The backlog (line 362) notes a recent ping cannot carry the command.

### C049
- key: When a fact changes, rewrite the line that held it in place.
- class: rule
- source: plugins/claude-kit/skills/standing-watch/SKILL.md:36
- provenance: 0ea17a9 2026-08-18, earned by RED/GREEN probe B (docs/archive/claude-kit_standing-watch_spec_v1.md line 237).
- verdict: keep
- reason: A031, A054. The owner of supersede; the A054 rewrite drops only the reason clause on the next sentence.

### C050
- key: Never stack a new baseline under an old one and leave both readable.
- class: rule
- source: plugins/claude-kit/skills/standing-watch/SKILL.md:36
- provenance: 0ea17a9 2026-08-18.
- verdict: rewrite
- reason: A054. The rule stays; its reason moves here: the next pass reads whichever baseline it reaches first and has no way to tell which was current.

### C051
- key: Put a read protocol at the top of the ledger stating what a constrained pass reads and in what order.
- class: rule
- source: plugins/claude-kit/skills/standing-watch/SKILL.md:38
- provenance: 0ea17a9 2026-08-18, installed with the skill.
- verdict: keep
- reason: No finding. The kaizen note of 2026-09-02 (kaizen/notes-SCOTT-CLAUDE.md line 3) records that the coordinator leaves this inherited requirement with no home, a consumer-side gap.

### C052
- key: Prune on a quiet tick, never on a busy one.
- class: rule
- source: plugins/claude-kit/skills/standing-watch/SKILL.md:40
- provenance: 0ea17a9 2026-08-18 (docs/archive/claude-kit_standing-watch_spec_v1.md lines 96 to 97).
- verdict: keep
- reason: A055. Stays whole; only C055's reason clause leaves the paragraph.

### C053
- key: Move superseded history to a dated archive byte-identical to what it replaced, and verify the hash at the destination rather than at the source.
- class: mechanic
- source: plugins/claude-kit/skills/standing-watch/SKILL.md:40
- provenance: 0ea17a9 2026-08-18.
- verdict: keep
- reason: A055, A056. A rule, not a reason; K19's compression that dropped it is rejected. No program performs the prune.

### C054
- key: Keep do-not-reopen traps live in the ledger however old they are.
- class: rule
- source: plugins/claude-kit/skills/standing-watch/SKILL.md:40
- provenance: 0ea17a9 2026-08-18.
- verdict: keep
- reason: A042, A043, A055. The owner; its reason ("outlast the reasoning that produced them") stays because lines 30 and 32 cite it.

### C055
- key: Re-derive any section offsets or line pointers after the last edit of the pass, never before.
- class: rule
- source: plugins/claude-kit/skills/standing-watch/SKILL.md:40
- provenance: 0ea17a9 2026-08-18.
- verdict: rewrite
- reason: A055. The rule stays; its reason moves here: an offset computed mid-edit points at the wrong section for every pass that follows.

### C056
- key: Follow the tick sequence as fixed, and take what happens inside the act step from the runbook.
- class: rule
- source: plugins/claude-kit/skills/standing-watch/SKILL.md:44
- provenance: 0ea17a9 2026-08-18.
- verdict: keep
- reason: No finding. After A008 this section is the sole owner of the sequence.

### C057
- key: Ensure the heartbeat is armed first, before any check, on any restart.
- class: rule
- source: plugins/claude-kit/skills/standing-watch/SKILL.md:46
- provenance: 02980e2 2026-08-18, the two-arm repair named the heartbeat as the safety arm and the runbook as owner of its cadence.
- verdict: keep
- reason: A057. Owner of the restart rule; the clauses the readers would cut are the repair.

### C058
- key: Satisfy the heartbeat step by looking for a running heartbeat rather than adding a second one.
- class: rule
- source: plugins/claude-kit/skills/standing-watch/SKILL.md:46
- provenance: 02980e2 2026-08-18.
- verdict: keep
- reason: A016, A017. The step's own ensure reading; line 17's restatement is what gives way.

### C059
- key: Re-derive the board from the watched system's own source of truth, never from the ledger, the handoff, or any situation text a wake prompt carries.
- class: rule
- source: plugins/claude-kit/skills/standing-watch/SKILL.md:47
- provenance: 0ea17a9 2026-08-18, the founding loop obeyed its own stale notes as fact.
- verdict: keep
- reason: A047, A048, A058, A059. The owner of re-derivation; recap's read-from-disk line is the same doctrine principle on the plan doc.

### C060
- key: For every standing DO or DO-NOT that cites a condition, measure the condition now and re-read the governing document behind it before obeying.
- class: rule
- source: plugins/claude-kit/skills/standing-watch/SKILL.md:48
- provenance: 0ea17a9 2026-08-18; its probe did not reproduce RED and the plan's Chapter 1 records the point-of-action rationale it ships on (docs/archive/claude-kit_standing-watch_spec_v1.md lines 235, 284).
- verdict: keep
- reason: A060. The trailing clause is the recorded warrant, not decoration.

### C061
- key: Let a plan doc outrank the ledger for that plan's gate.
- class: rule
- source: plugins/claude-kit/skills/standing-watch/SKILL.md:48
- provenance: 0ea17a9 2026-08-18, a wrong standing line nearly closed an advisory permanently in the founding loop.
- verdict: keep
- reason: A060. Its reason ("the plan changed under it") is the step's warrant and stays.

### C062
- key: Act, then write the ledger, then ensure the next wake is armed, then sleep.
- class: rule
- source: plugins/claude-kit/skills/standing-watch/SKILL.md:49
- provenance: 02980e2 2026-08-18.
- verdict: keep
- reason: A010, A011. The owner of the end-of-pass sequence; line 17 points here.

### C063
- key: On a static board, let the heartbeat be the next wake and arm nothing more.
- class: mechanic
- source: plugins/claude-kit/skills/standing-watch/SKILL.md:49
- provenance: 02980e2 2026-08-18, the repair of a static board taking no one-shot against an end-of-pass arm called fixed.
- verdict: keep
- reason: A061 to A063. The ensure reading at the step; line 57 owns pacing.

### C064
- key: Put in a self-authored wake prompt the standing prohibitions and a pointer to the ledger, and nothing else.
- class: rule
- source: plugins/claude-kit/skills/standing-watch/SKILL.md:53
- provenance: 0ea17a9 2026-08-18, five self-armed wake prompts had to be re-armed for claims a later finding made false.
- verdict: keep
- reason: A064 to A066. The incident's own shape; the asymmetry reason stays on the same footing as C046.

### C065
- key: Never put a situation report in a wake prompt.
- class: rule
- source: plugins/claude-kit/skills/standing-watch/SKILL.md:53
- provenance: 0ea17a9 2026-08-18.
- verdict: keep
- reason: A064, A066. The named instance of the closed class, which is the incident.

### C066
- key: Check the timer list against the clock before assuming pacing is covered.
- class: rule
- source: plugins/claude-kit/skills/standing-watch/SKILL.md:55
- provenance: 0ea17a9 2026-08-18 (docs/archive/claude-kit_standing-watch_spec_v1.md lines 107 to 110).
- verdict: keep
- reason: A067. Kept with C067 (what the check finds) and C068 (the false positive it would otherwise raise).

### C067
- key: Treat a one-shot whose time elapsed during a long pass as stale rather than pending, since it fires the instant the pass ends.
- class: mechanic
- source: plugins/claude-kit/skills/standing-watch/SKILL.md:55
- provenance: 0ea17a9 2026-08-18.
- verdict: keep
- reason: A067, A068. A reading rule over a timer's behaviour; nothing marks a fired one-shot as stale for the keeper.

### C068
- key: Read a deferred heartbeat during a long attended turn as expected behavior, not a broken timer, because timers fire only while the session is idle.
- class: rationale-example
- source: plugins/claude-kit/skills/standing-watch/SKILL.md:55
- provenance: 0ea17a9 2026-08-18.
- verdict: keep
- reason: A069. Without the idle-only fact a keeper re-arms on a deferral, which is the act the check prices; both readers keep.

### C069
- key: Pace by the board: a static board gets the heartbeat only, an active one gets a one-shot 15 to 60 minutes out.
- class: mechanic
- source: plugins/claude-kit/skills/standing-watch/SKILL.md:57
- provenance: 02980e2 2026-08-18 last touched; the pacing design is 0ea17a9 2026-08-18.
- verdict: keep
- reason: A061, A062, A070. The owner of pacing; no program paces the loop.

### C070
- key: Count a board as active when something on it is expected to change before the heartbeat comes round again, and treat a board you cannot confidently place as active.
- class: rule
- source: plugins/claude-kit/skills/standing-watch/SKILL.md:57
- provenance: 02980e2 2026-08-18.
- verdict: keep
- reason: No finding. The parity pin's inward sweep deliberately excludes this sentence ("a board you cannot confidently place is active" is not a ledger placement), so a rewording here must keep clear of the swept verbs and objects.

### C071
- key: Structure a ping in this order: corrections, then the ask or report, then the evidence line.
- class: mechanic
- source: plugins/claude-kit/skills/standing-watch/SKILL.md:61
- provenance: 0ea17a9 2026-08-18.
- verdict: keep
- reason: A071. Nothing formats a ping.

### C072
- key: Put corrections to earlier claims first, labeled as a correction.
- class: rule
- source: plugins/claude-kit/skills/standing-watch/SKILL.md:63
- provenance: 0ea17a9 2026-08-18.
- verdict: keep
- reason: No finding. Corrections lead because the operator reads on a phone and acts on the first line.

### C073
- key: Send a correction only when it changes the shape of the operator's decision.
- class: rule
- source: plugins/claude-kit/skills/standing-watch/SKILL.md:63
- provenance: 0ea17a9 2026-08-18.
- verdict: keep
- reason: No finding. Pairs with the dedup key: a correction that changes nothing reads as escalation.

### C074
- key: Write the ask or the report in the client-briefing register, which the doctrine owns.
- class: rule
- source: plugins/claude-kit/skills/standing-watch/SKILL.md:64
- provenance: 0ea17a9 2026-08-18.
- verdict: keep
- reason: A072, A073. Already a pointer at the doctrine, which the ownership map names as the register's owner.

### C075
- key: Have every figure or state in the message name its source and its subject.
- class: rule
- source: plugins/claude-kit/skills/standing-watch/SKILL.md:65
- provenance: 0ea17a9 2026-08-18, a true engine value reported against the wrong subject a dozen times; the doctrine's Before-you-send question was added in the same commit.
- verdict: keep
- reason: A074 to A076. The ping template's instance of a doctrine principle; the closing sentence is the incident stated as a rule.

### C076
- key: Carry a dedup key per condition, send one ping per condition, and never re-send an ask already pending.
- class: mechanic
- source: plugins/claude-kit/skills/standing-watch/SKILL.md:67
- provenance: 0ea17a9 2026-08-18.
- verdict: keep
- reason: A077. No program tracks pending asks.

### C077
- key: For when to escalate at all, read the doctrine's "Pause only for a true blocker" bullet under How we work; for what a measurement reads when the source is down, read the doctrine's "cannot measure" line under Verify before you claim.
- class: pointer
- source: plugins/claude-kit/skills/standing-watch/SKILL.md:69
- provenance: 02980e2 2026-08-18; the "cannot measure" line moved to the doctrine at 0ea17a9 2026-08-18 as one of the four lines every session needs.
- verdict: keep
- reason: No finding. Correct pointer shape at both owners.

### C078
- key: Before any closure, dismissal, delete, or resume on the watched system, name in one sentence what will act on the thing afterward.
- class: rule
- source: plugins/claude-kit/skills/standing-watch/SKILL.md:73
- provenance: 0ea17a9 2026-08-18, a wrong standing line nearly closed an advisory permanently.
- verdict: keep
- reason: A078. The trailing clause already marks the four as instances of the class; reordering is taste.

### C079
- key: Do not close it when the answer is "the mechanism this closure removes".
- class: rule
- source: plugins/claude-kit/skills/standing-watch/SKILL.md:73
- provenance: 0ea17a9 2026-08-18.
- verdict: keep
- reason: A078. The preflight's stop; also what makes C085's gate a one-way door (A090).

### C080
- key: Treat killing a dispatched agent as a one-way door subject to the same preflight.
- class: rule
- source: plugins/claude-kit/skills/standing-watch/SKILL.md:75
- provenance: d8a3355 2026-08-23, the doctrine's liveness bullets stopped reading silence as alive and standing-watch got a route that resolves; a healthy agent was nearly killed on filesystem silence in the founding loop.
- verdict: keep
- reason: A079. The paragraph's route and its enumeration of what finishing-work owns are the fix for a stranded audience, and line 75 is pinned as the committed pointer (test/doctrine-parity.test.js line 429).

### C081
- key: On every pass with a dispatch in flight, evaluate the wedge hallmark rather than waiting for a trigger.
- class: rule
- source: plugins/claude-kit/skills/standing-watch/SKILL.md:75
- provenance: d8a3355 2026-08-23, written into the tick order because a watch never re-blocks.
- verdict: keep
- reason: A080, A081. Intentionally different semantics from executing-work's re-block trigger.

### C082
- key: Read `finishing-work`'s unavailability paragraphs first, from the bold lead "Unavailability is the gate failing to run at full strength".
- class: pointer
- source: plugins/claude-kit/skills/standing-watch/SKILL.md:75
- provenance: d8a3355 2026-08-23, the rule located by its bold lead because finishing-work carries no heading for it.
- verdict: keep
- reason: A082, A083. A pointer at the map's owner; the inline plugin-root resolution is what makes it resolve without a second lookup.

### C083
- key: Derive any stall window from that finishing-work rule and never invent one this skill does not own.
- class: rule
- source: plugins/claude-kit/skills/standing-watch/SKILL.md:75
- provenance: d8a3355 2026-08-23, replacing a local-window prohibition neither cited surface stated.
- verdict: keep
- reason: A084, A085. Deferral of the figure to its sole owner.

### C084
- key: Guard against manufacturing a stall signal from quiet, because quiet is most of what a watch ever looks at.
- class: rationale-example
- source: plugins/claude-kit/skills/standing-watch/SKILL.md:75
- provenance: d8a3355 2026-08-23; the near-kill on filesystem silence is from the founding loop (0ea17a9 2026-08-18).
- verdict: keep
- reason: A086 to A088. The only thing distinguishing the per-pass check from the owner's trigger; both readers keep.

### C085
- key: End a watch when the quiet streak runs long enough that the operator retires the loop.
- class: mechanic
- source: plugins/claude-kit/skills/standing-watch/SKILL.md:79
- provenance: 6c725a0 2026-09-03 last touched the line; the sentence is design from 0ea17a9 2026-08-18.
- verdict: keep
- reason: A089, A090. Operator-decision gate that survives on the file's own preflight: a loop retiring itself removes the thing that would act on the watched system afterward.

### C086
- key: Hand over at retirement a distilled list of what the interventions taught, split into what the watched system should do for itself and what the kit should stop the agent doing.
- class: rule
- source: plugins/claude-kit/skills/standing-watch/SKILL.md:79
- provenance: 0ea17a9 2026-08-18 (design); 6c725a0 2026-09-03 last touched.
- verdict: keep
- reason: A091. The founding loop's own distillation produced this skill.

### C087
- key: Write every pass in a form that survives distillation: the condition, what was done about it, and what it turned out to mean.
- class: rule
- source: plugins/claude-kit/skills/standing-watch/SKILL.md:79
- provenance: 6c725a0 2026-09-03 added the bound that "what it turned out to mean" is a fact of the watched system, never the keeper's reasoning.
- verdict: keep
- reason: A021, A022, A091. The bound cites the admission test's tell rather than restating it. The backlog (line 364) asks whether one pass record survives the next pass, a design question on this line.

### C088
- key: Send a decision about a plan to that plan's Chapters.
- class: rule
- source: plugins/claude-kit/skills/standing-watch/SKILL.md:81
- provenance: 3074425 2026-08-31, the write-time destination rule from the coordinator board incident.
- verdict: keep
- reason: A092 to A094. A pointer at executing-work's Chapter contract, not a restatement of it.

### C089
- key: Send a durable lesson about the watch's own instruments to the memory store in the pass that produced it.
- class: rule
- source: plugins/claude-kit/skills/standing-watch/SKILL.md:81
- provenance: 3074425 2026-08-31; the memory record's own discipline-at-write-time paragraph.
- verdict: keep
- reason: A093. Stays whole under the rewrite; the backlog (line 360) names the missing leg for a durable fact about the watched system itself.

### C090
- key: Keep on the ledger the pass record and the current state, and write nothing to the ledger twice.
- class: rule
- source: plugins/claude-kit/skills/standing-watch/SKILL.md:81
- provenance: 3074425 2026-08-31.
- verdict: keep
- reason: A093. Stays; "the current state" is to be worded so C028's gloss is unnecessary.

### C091
- key: On a watch with no scheduled end, rely on write-time routing as the whole mechanism, since distil-at-retirement never fires on a seat that does not retire.
- class: rule
- source: plugins/claude-kit/skills/standing-watch/SKILL.md:81
- provenance: 3074425 2026-08-31, the coordinator seat as the standing case.
- verdict: rewrite
- reason: A093. The rule and its condition stay; the trailing account moves here: without the routing a standing seat's ledger accumulates its own journey and every successor pays the resume cost (memory a-coordination-ledger-holds-current-state-not-its-own-journey, Unbounded growth and Resume cost).

### C092
- key: Unlike a prohibition or do-not-reopen trap, doubt about whether a particular "mechanism confirmed in source" line is needed is not exempt from the admission default, and its wrongful exclusion is priced as a re-derivation.
- class: rule
- source: plugins/claude-kit/skills/standing-watch/SKILL.md:30
- provenance: be769a8 2026-09-03, the exemption drawn on the property no probe reproduces, which the mechanism member lacks.
- verdict: keep
- reason: A035. The backlog (line 371) notes the re-derivation pricing names a source read the tick order never schedules, a design question rather than a sweep finding.

### C093
- key: Follow the doctrine's habit, under Environment and tooling discipline, of probing a dispatched agent with a message before any stall-signal kill.
- class: pointer
- source: plugins/claude-kit/skills/standing-watch/SKILL.md:75
- provenance: d8a3355 2026-08-23; the probe habit moved to the doctrine at 0ea17a9 2026-08-18 as one of the four lines every session needs.
- verdict: keep
- reason: A079. The committed pointer the parity pin at test/doctrine-parity.test.js line 429 relies on.
