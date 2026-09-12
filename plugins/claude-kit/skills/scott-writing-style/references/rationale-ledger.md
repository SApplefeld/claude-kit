# Rationale ledger: scott-writing-style

This file is the rationale ledger for the documents the `scott-writing-style` skill owns. Rule text says what happens; this ledger says why; git says when. Nobody loads it by default. A session about to change a rule in one of the documents below reads the entry for the claim it is changing first, so the reason a rule holds is not re-litigated at the next review.

Each document sits under its own heading, which opens with its inventory line (what the document is for, which moments it owns, and when a session loads it) and then carries one entry per claim, retired claims included so the next audit does not re-find them. An entry is keyed by the claim's imperative sentence and carries its class (rule, mechanic, pointer, or rationale-example), its source as file and line, its provenance (the commit, incident, memory or kaizen note that installed it, or `no provenance found`), and its verdict (keep, rewrite, or retire) with the reason. A `C` entry's source line is read at the extraction commit `6bc07fb`; an `R` entry is a claim re-extracted from a hunk the Section 5 merge changed, and its source line is read at the merged commit `d9540ad`. Claim numbers restart under every document heading, and inside a document read in chunks they restart per chunk, so an entry id is unique only under its heading and a chunked document carries the chunk in the id (`c2.C001` is claim C001 of the second chunk); a claim named inside a reason or provenance line of such a document carries the same prefix. A `C` entry whose source hunk the Section 5 merge rewrote reads `retire` and carries a `superseded-by:` line naming the `R` entry that holds the passage at the merged commit; the passage's own verdict is that entry's, so a count of retirements over this ledger leaves those records out. A reason may name the form the judge ruled toward (a pointer at the owner, a split, a fold into a neighbour), because that form is why the verdict is rewrite rather than keep or retire; what a passage becomes is the rewrite plan's to decide, and where the two differ the rewrite plan governs. The target wording a judge proposed rides on the entry's `proposed:` line, one line per distinct proposal, on rewrite and retire entries that retire a passage; a proposal that pointed at another ruling by id carries the resolved text marked `(via Annn)`. A rewrite or retire the judge flagged as behavior-shaping carries `baseline-test: yes`, which is what the rewrite plan's RED and GREEN step keys on. What a passage becomes is the rewrite plan's to decide (`claude-kit_corpus-rewrite_spec_v1.md` under `docs/plans/`), and where it and a proposal differ the rewrite plan governs.

## plugins/claude-kit/skills/scott-writing-style/SKILL.md

This document is a writing-style guide that tells a session how to draft prose in Scott Applefeld's voice, derived from samples of his technical proposals, benefit analyses, architecture documents, and email replies. It owns the moments of drafting and reviewing any document, draft, or written output that will be sent by Scott Applefeld or is meant to mimic his style: choosing the opener, ordering context before verdict, setting section count and nesting depth, naming and casing headers, sizing sections and sub-sections, applying the signature rhetorical patterns (thesis-first sections, "However" pivots, numbered versus bulleted lists, italic and bold emphasis, numeric anchoring, prose over bullets, parenthetical caveats, varied sentence length, first-person plural voice), writing the close, and avoiding a fixed list of banned constructions. It also owns the routing to a companion catalog of machine-prose tells for both the writer finishing a draft and the reviewer checking one. Load class: named-trigger, loaded before writing or reviewing a document in this voice, per its own description ("Use whenever asked for a document, draft, or other written output that will be sent by Scott Applefeld or intended to mimic his style").

Extracted at `6bc07fb`: whole document (`skills.scott-writing-style.SKILL.md`).

### C001
- key: Follow the rules in this document when drafting anything in Scott's voice.
- class: rule
- source: plugins/claude-kit/skills/scott-writing-style/SKILL.md:10
- provenance: f8c0649 2026-06-10, the initial import of the skill, its rules drawn from samples of the operator's own writing; no incident narrated.
- verdict: keep
- reason: No finding. This sentence is the skill's scope statement and the tiebreak rule (dominant pattern first, exception flagged) that A026 and A063 lean on to resolve the contradictions section.

### C002
- key: Open the piece with a blunt declarative statement of the core premise.
- class: rule
- source: plugins/claude-kit/skills/scott-writing-style/SKILL.md:16
- provenance: f8c0649 2026-06-10, the initial import of the skill, its rules drawn from samples of the operator's own writing; no incident narrated.
- verdict: keep
- reason: The owner line for the opener; its copy in contradictions item 2 (C076) retires, so this line must stay whole with its email exception on line 21. No machinery reads it.

### C003
- key: Keep the opening paragraph to 1 to 3 sentences and 25 to 55 words.
- class: mechanic
- source: plugins/claude-kit/skills/scott-writing-style/SKILL.md:17
- provenance: f8c0649 2026-06-10, the initial import of the skill, its rules drawn from samples of the operator's own writing; no incident narrated.
- verdict: keep
- reason: No finding. A measured band from the samples that nothing else in the corpus states or enforces.

### C004
- key: Start the opening sentence with a frame-setter such as "First, it's fundamentally important to understand..." or "The most valuable resource to the business is...".
- class: mechanic
- source: plugins/claude-kit/skills/scott-writing-style/SKILL.md:18
- provenance: f8c0649 2026-06-10, the initial import of the skill; reworded at 0918893 2026-06-28 only to genericize sample names for team-sharing.
- verdict: keep
- reason: No finding. The frame-setter specimens are the voice itself and the only carrier of it; the genericization already stripped the client names.

### C005
- key: Never open with a question.
- class: rule
- source: plugins/claude-kit/skills/scott-writing-style/SKILL.md:19
- provenance: f8c0649 2026-06-10, the initial import of the skill; 0918893 2026-06-28 dropped the "zero of five samples" count from the line.
- verdict: keep
- reason: This document owns the ban; the ai-tells catalog's "already prohibited" list names Section 1 by design (document-review-battery plan section 1), so any restating there is the catalog's defect, not this line's.

### C006
- key: Never open with a quote, an anecdote, or scene-setting.
- class: rule
- source: plugins/claude-kit/skills/scott-writing-style/SKILL.md:20
- provenance: f8c0649 2026-06-10, the initial import of the skill, its rules drawn from samples of the operator's own writing; no incident narrated.
- verdict: rewrite
- reason: The owner line; lines 107 and 144 were two more copies of it and retire (A005), with line 107's examples folded in here. The sentence itself is unchanged. Lands at line 20 (section 36's close) as "Never open with a quote, anecdote, or scene-setting (no "Picture this…", no customer quote).", the sentence whole with its period after the arriving parenthetical; the respell is the merge C063's retirement forces, so the verdict reads rewrite.
- proposed: Line 20 keeps its sentence and takes C063's examples as a parenthetical before the period.

### C007
- key: In an email reply, put a one-line personal acknowledgement such as "Thanks [Name]!" before the frame-setter.
- class: rule
- source: plugins/claude-kit/skills/scott-writing-style/SKILL.md:21
- provenance: f8c0649 2026-06-10, the initial import of the skill; reworded at 0918893 2026-06-28 to replace two real first names with "[Name]".
- verdict: keep
- reason: The owner of the email exception; contradictions item 2 restated it and retires (A001), so this line is the only carrier.

### C008
- key: Keep the email acknowledgement to one line.
- class: mechanic
- source: plugins/claude-kit/skills/scott-writing-style/SKILL.md:21
- provenance: f8c0649 2026-06-10, the initial import of the skill, its rules drawn from samples of the operator's own writing; no incident narrated.
- verdict: keep
- reason: No finding. The bound on C007; nothing else states it.

### C009
- key: After the opener, deliver context or definition before any verdict.
- class: rule
- source: plugins/claude-kit/skills/scott-writing-style/SKILL.md:25
- provenance: f8c0649 2026-06-10, the initial import of the skill, its rules drawn from samples of the operator's own writing; no incident narrated.
- verdict: keep
- reason: The contention with the doctrine's answer-first order is two audiences, not one rule: the doctrine governs prose the operator reads, this skill governs documents he sends in his voice, and the ownership map gives that moment here. The precedence between the two prose owners is an open backlog item recorded by the subtraction-bars plan, not a defect in this line.

### C010
- key: Make the second move one of a definitional clarification, a scope statement, or a goal statement.
- class: mechanic
- source: plugins/claude-kit/skills/scott-writing-style/SKILL.md:27
- provenance: f8c0649 2026-06-10, the initial import of the skill, its rules drawn from samples of the operator's own writing; no incident narrated.
- verdict: keep
- reason: No finding. The mechanic under C009; ai-tells:79 leans on this scope-statement licence to distinguish a boundary from a preview.

### C011
- key: Do not state the verdict or recommendation second; land verdicts at the end of a section or the end of the piece, after the reasoning.
- class: rule
- source: plugins/claude-kit/skills/scott-writing-style/SKILL.md:31
- provenance: f8c0649 2026-06-10, the initial import of the skill, its rules drawn from samples of the operator's own writing; no incident narrated.
- verdict: keep
- reason: As C009: the doctrine's lead-with-the-answer rule is the register for decision asks to the operator, and this is a property of his own documents. Two owners for two audiences; real conflict no.

### C012
- key: Default to 4 to 6 top-level sections.
- class: mechanic
- source: plugins/claude-kit/skills/scott-writing-style/SKILL.md:35
- provenance: f8c0649 2026-06-10, the initial import of the skill, its rules drawn from samples of the operator's own writing; no incident narrated.
- verdict: rewrite
- reason: The default; C014 is its bound and C015 its remedy, and A014 merges the three into one sentence without changing any number. Lands at line 35 (section 36's close) as the opening clause "Default to **4 to 6 top-level sections**," of the merged sentence, the numbers and the bold unchanged; the respell is the merge A014 orders, so the verdict reads rewrite.
- proposed: Merge line 35 into C015's one sentence as its opening clause, the colon form giving way.

### C013
- key: Treat 5 to 6 sections as typical for proposals and benefit docs, 4 major components plus sub-sections for architecture docs, and 4 for email replies (Goal, Approach, Cost, Timeframe).
- class: rationale-example
- source: plugins/claude-kit/skills/scott-writing-style/SKILL.md:36
- provenance: f8c0649 2026-06-10 as concrete per-document counts; 0918893 2026-06-28 genericized them into this description.
- verdict: retire
- reason: The default and its hard bounds are obeyed without the sample breakdown, which has carried no document names since the genericization. For the record: the samples ran 4 to 6 top-level sections; proposals and benefit docs 5 to 6, architecture docs 4 major components plus sub-sections, email replies 4 (Goal, Approach, Cost, Timeframe). Retired at section 36's close: line 36's sample breakdown is gone whole, the default and its bounds landing on line 35 in C015's merged sentence.
- proposed: Delete line 36; the ledger entry for C013 carries the sample range.

### C014
- key: Treat 4 top-level sections as a hard floor and 6 as a hard ceiling.
- class: mechanic
- source: plugins/claude-kit/skills/scott-writing-style/SKILL.md:37
- provenance: f8c0649 2026-06-10, the initial import of the skill, its rules drawn from samples of the operator's own writing; no incident narrated.
- verdict: rewrite
- reason: The bound on C012, kept in the merged sentence A014 describes; a rule and its bound are not a duplicate. Lands at line 35 (section 36's close) as "4 a hard floor and 6 a hard ceiling, and collapse past 6.", the numbers unchanged; the respell is the merge A014 orders, so the verdict reads rewrite.
- proposed: Merge line 37 into C015's one sentence as the floor-and-ceiling clause with the collapse instruction after it.

### C015
- key: Collapse sections when the document exceeds 6 top-level sections.
- class: rule
- source: plugins/claude-kit/skills/scott-writing-style/SKILL.md:37
- provenance: f8c0649 2026-06-10, the initial import of the skill, its rules drawn from samples of the operator's own writing; no incident narrated.
- verdict: rewrite
- reason: Merges with lines 35 and 37 into one sentence carrying the default, the floor and ceiling, and the collapse instruction; the numbers do not change, so the rewrite is safe, and it is flagged for baseline-testing because it is behavior-shaping wording. Lands at line 35 (section 36's close) as one sentence, "Default to **4 to 6 top-level sections**, 4 a hard floor and 6 a hard ceiling, and collapse past 6.", the digits and the bold kept from C012's line rather than the proposal's spelled-out numbers.
- proposed: Merge lines 35 and 37 into one sentence: default four to six top-level sections, four a hard floor and six a hard ceiling, collapse past six.
- baseline-test: yes

### C016
- key: Give most sections 2 to 3 nested sub-sections when the topic needs drill-down.
- class: mechanic
- source: plugins/claude-kit/skills/scott-writing-style/SKILL.md:38
- provenance: f8c0649 2026-06-10, the initial import of the skill, its rules drawn from samples of the operator's own writing; no incident narrated.
- verdict: keep
- reason: No finding. Stays as the first sentence of line 38 while the nesting cap beside it is rewritten.

### C017
- key: Nest at most two levels deep (section to sub-section to bullet list) and never go three levels deep in prose.
- class: rule
- source: plugins/claude-kit/skills/scott-writing-style/SKILL.md:38
- provenance: f8c0649 2026-06-10, the initial import of the skill, its rules drawn from samples of the operator's own writing; no incident narrated.
- verdict: rewrite
- reason: Line 109's copy retires into this line, bringing the field-and-parameter-catalog carve-out with it, and the sentence names the numbered 1-a-i list for steps, components and ranked items as the one licensed three-level structure, which settles the apparent collision with C035 that a careful read already resolves. Lands at line 36 (section 36's close): the nesting sentence reads "Nest at most two levels deep (section → sub-section → bullet list) and never three levels deep in prose." and a third sentence follows it, "Only two structures run three levels deep: the numbered 1 → a → i list for steps, components, and ranked items, and a field or parameter catalog.", carrying both proposals, the first landing's passive form ("Three levels are allowed only in the numbered 1 → a → i list ... and in field and parameter catalogs.") restated active at the close pass after round 1; line 109 (C065) is gone.
- proposed: In the merged nesting sentence, state that the numbered 1-a-i list for steps, components and ranked items is the one three-level structure allowed.
- proposed: (via A015) Move the catalog carve-out from line 109 into line 38 and delete line 109.
- baseline-test: yes

### C018
- key: Write headers as short noun phrases of 2 to 4 words in Title Case or ALL CAPS.
- class: mechanic
- source: plugins/claude-kit/skills/scott-writing-style/SKILL.md:42
- provenance: f8c0649 2026-06-10, the initial import of the skill, its rules drawn from samples of the operator's own writing; no incident narrated.
- verdict: keep
- reason: The target band; C066's five-word ceiling folds in beside it (A019) as a bound rather than a rival. This document owns header form; ai-tells:121 points at it by design.

### C019
- key: Model headers on examples such as INTEGRATION DESIGN, DEMILITARIZED ZONE, END RESULT, Improving Retention, GOAL, APPROACH, COST, TIMEFRAME.
- class: rationale-example
- source: plugins/claude-kit/skills/scott-writing-style/SKILL.md:43
- provenance: f8c0649 2026-06-10, the initial import of the skill, its rules drawn from samples of the operator's own writing; no incident narrated.
- verdict: rewrite
- reason: One specimen per case is enough to obey the rule; the full sample list for the record: INTEGRATION DESIGN, DEMILITARIZED ZONE, PROTECTING DATABASE, END RESULT, Improving Retention, Back Office Efficiencies, Driver Efficiencies, Safety Monitoring, GOAL, APPROACH, COST, TIMEFRAME. Lands at line 41 (section 36's close) as "Examples: `INTEGRATION DESIGN`, `Improving Retention`."
- proposed: Trim line 43 to one ALL CAPS and one Title Case example; the ledger entry for C019 carries the full list.
- baseline-test: yes

### C020
- key: Never use question-form headers.
- class: rule
- source: plugins/claude-kit/skills/scott-writing-style/SKILL.md:44
- provenance: f8c0649 2026-06-10, the initial import of the skill; 0918893 2026-06-28 dropped the "zero of five samples" count from the line.
- verdict: keep
- reason: The owner line; line 102 (verbatim) and line 144 (a clause) were copies and retire. The ai-tells catalog names Section 4 as owner by design.

### C021
- key: Never use command or imperative headers such as "Do this" or "Fix that".
- class: rule
- source: plugins/claude-kit/skills/scott-writing-style/SKILL.md:45
- provenance: f8c0649 2026-06-10, the initial import of the skill; 0918893 2026-06-28 dropped the "zero of five samples" count from the line.
- verdict: keep
- reason: No finding. Stated once, nowhere else in the corpus.

### C022
- key: Never use full-sentence headers.
- class: rule
- source: plugins/claude-kit/skills/scott-writing-style/SKILL.md:46
- provenance: f8c0649 2026-06-10, the initial import of the skill, its rules drawn from samples of the operator's own writing; no incident narrated.
- verdict: keep
- reason: No finding. Stated once, nowhere else in the corpus.

### C023
- key: Use ALL CAPS headers in technical and internal docs and Title Case headers in client-facing proposals and benefit docs.
- class: mechanic
- source: plugins/claude-kit/skills/scott-writing-style/SKILL.md:47
- provenance: f8c0649 2026-06-10, the initial import of the skill, its rules drawn from samples of the operator's own writing; no incident narrated.
- verdict: rewrite
- reason: Its unconditional bound collides with contradictions item 1 on proposals, and history says item 1 is the intended resolution: at import the ALL CAPS proposal was the short goal-approach-cost-timeframe email, which the 0918893 genericization renamed "proposal-style enumerations". The rewrite states case by formality with that enumeration named, and item 1 (C075) retires into it. Lands at line 45 (section 36's close) as "Case follows formality: ALL CAPS for technical and internal docs and for a short proposal-style enumeration (an email listing goal, approach, cost, timeframe), Title Case for longer client-facing proposals and benefit docs.", C024's sentence following it; contradictions item 1 is gone and item 3 stands as the section's one paragraph with its list marker gone.
- proposed: Rewrite line 47 to case by formality, naming the short proposal-style enumeration (an email listing goal, approach, cost, timeframe) as ALL CAPS and longer client-facing proposals and benefit docs as Title Case; then delete contradictions item 1.
- baseline-test: yes

### C024
- key: Pick one header style per document and stay consistent with it.
- class: rule
- source: plugins/claude-kit/skills/scott-writing-style/SKILL.md:47
- provenance: f8c0649 2026-06-10, the initial import of the skill, its rules drawn from samples of the operator's own writing; no incident narrated.
- verdict: rewrite
- reason: The rule itself is unchanged; it becomes the second sentence of the rewritten line 47 beside the case-by-formality sentence. This document owns it; ai-tells:121 restates it inside a pointer and that is the catalog's side. Lands at line 45 (section 36's close) as the second sentence, "Pick one style per document and stay consistent.", word for word.
- proposed: Line 47 becomes the case-by-formality sentence from A026 followed by the pick-one-and-stay-consistent sentence.
- baseline-test: yes

### C025
- key: Write sub-section headers as short noun phrases, often 2 to 3 words, in Title Case.
- class: mechanic
- source: plugins/claude-kit/skills/scott-writing-style/SKILL.md:48
- provenance: f8c0649 2026-06-10, the initial import of the skill, its rules drawn from samples of the operator's own writing; no incident narrated.
- verdict: keep
- reason: No finding. The sub-section form, stated once.

### C026
- key: Target 90 to 180 words of section body before any sub-sections or bullets.
- class: mechanic
- source: plugins/claude-kit/skills/scott-writing-style/SKILL.md:52
- provenance: f8c0649 2026-06-10, the initial import of the skill, its rules drawn from samples of the operator's own writing; no incident narrated.
- verdict: keep
- reason: No finding. A measured band from the samples, stated once.

### C027
- key: Open each section with a single declarative sentence stating the section's thesis.
- class: rule
- source: plugins/claude-kit/skills/scott-writing-style/SKILL.md:53
- provenance: f8c0649 2026-06-10, the initial import of the skill, its rules drawn from samples of the operator's own writing; no incident narrated.
- verdict: keep
- reason: The owner line for thesis-first sections; line 61 (C032) and line 140 (C079) were copies and retire, with line 61's "the rest of the section supports it" folded in here.

### C028
- key: Follow the section thesis with 2 to 4 paragraphs of 2 to 4 sentences each.
- class: mechanic
- source: plugins/claude-kit/skills/scott-writing-style/SKILL.md:53
- provenance: f8c0649 2026-06-10, the initial import of the skill, its rules drawn from samples of the operator's own writing; no incident narrated.
- verdict: keep
- reason: A range, not a fixed count, so a document varying inside it satisfies ai-tells' uniformity tell, which names Section 6's varied-length rule as its positive form. Real conflict no.

### C029
- key: Break a section into sub-sections rather than letting it run past roughly 220 words without structure.
- class: rule
- source: plugins/claude-kit/skills/scott-writing-style/SKILL.md:54
- provenance: f8c0649 2026-06-10, the initial import of the skill, its rules drawn from samples of the operator's own writing; no incident narrated.
- verdict: keep
- reason: No finding. Stated once.

### C030
- key: Keep sub-sections to 40 to 100 words.
- class: mechanic
- source: plugins/claude-kit/skills/scott-writing-style/SKILL.md:55
- provenance: f8c0649 2026-06-10, the initial import of the skill, its rules drawn from samples of the operator's own writing; no incident narrated.
- verdict: keep
- reason: No finding. Stated once.

### C031
- key: Use the signature patterns listed in this section when drafting.
- class: rule
- source: plugins/claude-kit/skills/scott-writing-style/SKILL.md:59
- provenance: f8c0649 2026-06-10, the initial import of the skill, its rules drawn from samples of the operator's own writing; no incident narrated.
- verdict: keep
- reason: No finding. The section's framing sentence.

### C032
- key: Make every section's first sentence state the point of the section in plain language and use the rest of the section to support it.
- class: rule
- source: plugins/claude-kit/skills/scott-writing-style/SKILL.md:61
- provenance: f8c0649 2026-06-10, the initial import of the skill, its rules drawn from samples of the operator's own writing; no incident narrated.
- verdict: retire
- reason: A duplicate of C027 inside the same document; its one addition ("the rest supports it") moves into line 53, so nothing is lost. Retired at section 36's close: line 61 is gone, "The rest of the section supports it." is appended to line 51 after C027's and C028's sentence, and the STRONGEST PATTERNS section is gone.
- proposed: (via A030) Append "the rest of the section supports it" to line 53, delete line 61, and delete the STRONGEST PATTERNS section per A005.
- baseline-test: yes

### C033
- key: Build the case, then pivot with "However,", "By comparison,", or "Comparatively,".
- class: mechanic
- source: plugins/claude-kit/skills/scott-writing-style/SKILL.md:63
- provenance: f8c0649 2026-06-10, the initial import of the skill; 830ff28 2026-06-17 changed an em dash on the line to a spaced hyphen.
- verdict: rewrite
- reason: The owner of the pivot; line 142 (C081) was a copy and retires. The rewrite of C034 folds the set-up clause into this sentence without changing the markers. Lands at line 59 (section 36's close) as "Build the status quo the reader holds, then pivot with `However,` or `By comparison,` or `Comparatively,` to why it is not sufficient.", the markers word for word and "Build the case" respelled by C034's rewrite, so the verdict reads rewrite.
- proposed: Line 63 keeps its heading and its three markers, its set-up clause reading as C034's rewrite states it.

### C034
- key: Treat the pivot as the core rhetorical move: set up the reasonable-sounding status quo, then pivot to why it is not sufficient.
- class: rationale-example
- source: plugins/claude-kit/skills/scott-writing-style/SKILL.md:63
- provenance: f8c0649 2026-06-10, the initial import of the skill; 830ff28 2026-06-17 changed an em dash on the line to a spaced hyphen.
- verdict: rewrite
- reason: The set-up clause is load-bearing: ai-tells distinguishes the licensed pivot (against a position a real reader holds) from the straw-position tell, and the writer needs the set-up instruction to stay on the licensed side. The frequency claim ("appears in every sample, the core rhetorical move") is sample evidence and lives here now. Lands at line 59 (section 36's close) as "Build the status quo the reader holds, then pivot with `However,` or `By comparison,` or `Comparatively,` to why it is not sufficient.", the three markers kept from C033's sentence and the frequency sentence gone.
- proposed: Line 63 becomes one sentence: build the status quo the reader holds, then pivot with "However," or "By comparison," to why it is insufficient; the frequency sentence goes to the ledger.
- baseline-test: yes

### C035
- key: Use numbered lists with lettered sub-items (1 then a then i) when listing steps, components, or ranked items.
- class: mechanic
- source: plugins/claude-kit/skills/scott-writing-style/SKILL.md:65
- provenance: f8c0649 2026-06-10, the initial import of the skill; reworded at 0918893 2026-06-28 only to drop the sample names that used it.
- verdict: keep
- reason: The 1-a-i form is the licensed three-level structure for enumerated mechanics; the rewrite of C017 names it so, which removes the apparent collision with the nesting cap.

### C036
- key: Use bulleted lists when listing non-ranked items such as fields, data points, or options.
- class: rule
- source: plugins/claude-kit/skills/scott-writing-style/SKILL.md:67
- provenance: f8c0649 2026-06-10, the initial import of the skill; 830ff28 2026-06-17 changed the bullet separator on the line from an em dash to a colon.
- verdict: rewrite
- reason: The heading and the sentence say one thing and merge; the bullet-format mechanic stays as its own sentence. Line 79 is the other half of the same division (reasoning in prose), not a duplicate. ai-tells:61 points at this licence by design. Lands at line 63 (section 36's close) as "Use them for non-ranked items such as fields, data points, and options." after the heading, C037's bullet-format sentence following it word for word.
- proposed: Line 67 becomes two sentences: bullets for non-ranked items such as fields, data points and options; each bullet a bold term, a colon or line break, then the explanation.
- baseline-test: yes

### C037
- key: Format each bullet as a bold term plus a colon or line break plus the explanation.
- class: mechanic
- source: plugins/claude-kit/skills/scott-writing-style/SKILL.md:67
- provenance: f8c0649 2026-06-10 as "bold term + em-dash or line break"; 830ff28 2026-06-17 made the separator a colon when the em-dash ban landed.
- verdict: keep
- reason: Bounded to catalog bullets by its heading, and line 79 bars argument bullets, so ai-tells' bold-on-every-bullet tell targets a case this line never licenses. Real conflict no.

### C038
- key: Italicize at most one word per sentence, to stress magnitude, universality, or a key technical term.
- class: mechanic
- source: plugins/claude-kit/skills/scott-writing-style/SKILL.md:69
- provenance: f8c0649 2026-06-10, the initial import of the skill; reworded at 0918893 2026-06-28 only to genericize the specimens.
- verdict: keep
- reason: No finding. Stated once.

### C039
- key: Bold quantitative claims, bolding the number and its unit together.
- class: mechanic
- source: plugins/claude-kit/skills/scott-writing-style/SKILL.md:71
- provenance: f8c0649 2026-06-10, the initial import of the skill; reworded at 0918893 2026-06-28 to replace real dollar figures with placeholders.
- verdict: keep
- reason: No finding. Stated once.

### C040
- key: Back every claim of impact with a concrete number rather than an adjective.
- class: rule
- source: plugins/claude-kit/skills/scott-writing-style/SKILL.md:73
- provenance: f8c0649 2026-06-10, the initial import of the skill; reworded at 0918893 2026-06-28 to replace the sample figures with kinds of number.
- verdict: rewrite
- reason: The four inline kinds of number were sample figures made generic and say nothing the rule does not; the rule plus its one instance (C041) is the whole passage. Line 141's copy (C080) retires. Lands at line 69 (section 36's close) as "Back every claim of impact with a concrete number rather than an adjective.", C041's "significantly faster" sentence following it word for word; line 141 is gone with the recap section.
- proposed: Line 73 becomes: back every claim of impact with a concrete number rather than an adjective; never write "significantly faster" without the figure beside it.
- proposed: (via A041) Delete line 141 with the STRONGEST PATTERNS section; line 73 keeps its "significantly faster" instance.
- baseline-test: yes

### C041
- key: Never write "significantly faster" without following it with the actual figure.
- class: rule
- source: plugins/claude-kit/skills/scott-writing-style/SKILL.md:73
- provenance: f8c0649 2026-06-10, the initial import of the skill, its rules drawn from samples of the operator's own writing; no incident narrated.
- verdict: keep
- reason: The one example the lean bar allows C040, so it is not a duplicate; ai-tells:163 carries the adverbial form and names Section 8 as owner.

### C042
- key: End each section with a 1 to 2 sentence summary paragraph restating the conclusion, then move on.
- class: mechanic
- source: plugins/claude-kit/skills/scott-writing-style/SKILL.md:75
- provenance: f8c0649 2026-06-10, the initial import of the skill, its rules drawn from samples of the operator's own writing; no incident narrated.
- verdict: keep
- reason: The doctrine's "no redundant summaries" governs artifacts the operator reads, not his own documents, and ai-tells:101 says in its own text that this summary paragraph is the licensed version differing in kind from the restating close it flags. Real conflict no.

### C043
- key: After stating an abstract rule, introduce a single named concrete example, walk through it, and resolve it.
- class: rule
- source: plugins/claude-kit/skills/scott-writing-style/SKILL.md:77
- provenance: f8c0649 2026-06-10, the initial import of the skill; reworded at 0918893 2026-06-28 to genericize the "Stops" example.
- verdict: keep
- reason: No finding. Stated once.

### C044
- key: Carry the reasoning in prose paragraphs and reserve bullets for catalogs and field lists, not for decomposing arguments.
- class: rule
- source: plugins/claude-kit/skills/scott-writing-style/SKILL.md:79
- provenance: f8c0649 2026-06-10, the initial import of the skill, its rules drawn from samples of the operator's own writing; no incident narrated.
- verdict: rewrite
- reason: The heading's "wall-of-bullets" figure gives way to the literal failure; the two rule sentences stay. Line 108's copy (C064) retires. Lands at line 75 (section 36's close) under the heading "Prose paragraphs, not bulleted arguments." as "Carry the reasoning in prose paragraphs, even in technical docs. Reserve bullets for catalogs and field lists."; line 108 (C064) is gone.
- proposed: Line 79 becomes: carry the reasoning in prose paragraphs, even in technical docs; reserve bullets for catalogs and field lists.
- proposed: (via A049) Delete line 108.
- baseline-test: yes

### C045
- key: Do not use em dashes; use commas, periods, parentheses, or colons instead.
- class: rule
- source: plugins/claude-kit/skills/scott-writing-style/SKILL.md:81
- provenance: 830ff28 2026-06-17, replaced the samples' "em dashes used sparingly" pattern with the ban in the commit that put the no-em-dash rule into CLAUDE.md.
- verdict: rewrite
- reason: The doctrine owns the ban and its replacement list, and this copy is stale: the doctrine added the spaced hyphen at c800e05 (2026-06-26) after this line was written, and the skill's own title uses one. Becoming a pointer ends the drift; no hook or test enforces the ban, so it is not superseded. Lands at line 77 (section 36's close) as "**No em dashes.** Per the doctrine's style rule, which owns the replacement list.", a pointer at the doctrine's Style bullet whose lead reads "No em dashes on any outward-facing surface." (skills/operating-instructions/SKILL.md line 24 at HEAD); the parenthetical (C046) is gone. Amendment 2 note: the spaced hyphen entered the doctrine's replacement list at 830ff28 (2026-06-17), the commit that also wrote this line without it, so the copy was born without the hyphen rather than drifting after c800e05, which moved the already-hyphenated bullet into the operating-instructions skill.
- proposed: (via A052) Line 81 becomes a pointer: no em dashes, per the doctrine's style rule, which owns the replacement list.
- baseline-test: yes

### C046
- key: Drop the samples' sparing em-dash use because em dashes now read as an AI-writing tell.
- class: rationale-example
- source: plugins/claude-kit/skills/scott-writing-style/SKILL.md:81
- provenance: 830ff28 2026-06-17, the same commit as C045.
- verdict: retire
- reason: The reason lives in the doctrine's own rule; the parenthetical is change narrative. For the record: the original samples used em dashes sparingly (0 to 2 per section) and the kit dropped them because they read as a machine-writing tell. Retired at section 36's close: the parenthetical is gone from line 77, which carries C045's pointer alone.
- proposed: (via A056) Delete the parenthetical on line 81.

### C047
- key: Put scope-limiting caveats in parentheses rather than in a new sentence.
- class: mechanic
- source: plugins/claude-kit/skills/scott-writing-style/SKILL.md:83
- provenance: f8c0649 2026-06-10, the initial import of the skill; reworded at 0918893 2026-06-28 only to genericize a specimen.
- verdict: keep
- reason: A property of the operator's own voice from his samples; the doctrine's ban on nested qualifications governs prose written for him to read, and the ownership map gives operator-voice documents here. Real conflict no.

### C048
- key: Vary sentence length deliberately, interleaving long explanatory sentences of 30 to 50 words with short landing sentences of 5 to 12 words at paragraph ends.
- class: mechanic
- source: plugins/claude-kit/skills/scott-writing-style/SKILL.md:85
- provenance: f8c0649 2026-06-10, the initial import of the skill; reworded at 0918893 2026-06-28 only to genericize a specimen.
- verdict: keep
- reason: The subtraction-bars plan scoped the kit's twenty-word bar to the kit's own voice precisely because this line licenses thirty-to-fifty-word explanatory sentences for operator-voice documents; the difference is a recorded decision. Real conflict no.

### C049
- key: Default to first-person plural voice in technical and proposal writing, switching to first-person singular only for subjective framing.
- class: rule
- source: plugins/claude-kit/skills/scott-writing-style/SKILL.md:87
- provenance: f8c0649 2026-06-10, the initial import of the skill; reworded at 0918893 2026-06-28 to genericize a specimen.
- verdict: rewrite
- reason: Absorbs contradictions item 4's bound ("I" runs freely only in a direct one-to-one email; a company deliverable uses it only for subjective framing) and drops two of three quoted specimens. C068's "you" ban is a different pronoun and stays separate. Lands at line 83 (section 36's close) as "Default to "we" (`"We create a new role with restricted permissions."`). Use "I" for subjective framing (`"In my opinion…"`), and freely only in a direct one-to-one email.", one specimen kept per case; contradictions item 4 (C078) is gone.
- proposed: (via A063) Line 87 becomes: default to "we" in technical and proposal writing; use "I" for subjective framing ("In my opinion") and freely only in a direct one-to-one email; then delete contradictions item 4.
- baseline-test: yes

### C050
- key: Close with a restatement of the end state or net result, not a gut punch, a rhetorical question, or a rallying cry.
- class: rule
- source: plugins/claude-kit/skills/scott-writing-style/SKILL.md:91
- provenance: f8c0649 2026-06-10, the initial import of the skill, its rules drawn from samples of the operator's own writing; no incident narrated.
- verdict: keep
- reason: The owner of the close; line 143 (C082) was a copy and retires, and ai-tells:87 and :141 name Section 7 as the rule they build on.

### C051
- key: Label the final section END RESULT, Aftermath, or Resolution, or let it function as a summary without an explicit header.
- class: mechanic
- source: plugins/claude-kit/skills/scott-writing-style/SKILL.md:92
- provenance: f8c0649 2026-06-10, the initial import of the skill, its rules drawn from samples of the operator's own writing; no incident narrated.
- verdict: keep
- reason: Stated once here; the recap line's "END RESULT-style" was its copy and retires.

### C052
- key: Structure the close as 2 to 4 short sentences telling the reader what they now have, in past tense or present-indicative, not future-promise.
- class: mechanic
- source: plugins/claude-kit/skills/scott-writing-style/SKILL.md:93
- provenance: f8c0649 2026-06-10, the initial import of the skill, its rules drawn from samples of the operator's own writing; no incident narrated.
- verdict: keep
- reason: No finding. Stated once.

### C053
- key: Model the close on patterns such as "The ultimate result of this design is that we have..." or "This creates a model where...".
- class: rationale-example
- source: plugins/claude-kit/skills/scott-writing-style/SKILL.md:94
- provenance: f8c0649 2026-06-10, the initial import of the skill, its rules drawn from samples of the operator's own writing; no incident narrated.
- verdict: rewrite
- reason: One pattern is enough beside C052's sentence count and tense. For the record, the three: "The ultimate result of this design is that we have...", "This creates a model where...", "That fixed the issue since the initial change, and for all punches moving forward." Lands at line 90 (section 36's close) as "Example pattern: `"The ultimate result of this design is that we have…"`".
- proposed: Trim line 94 to one example pattern; the ledger entry for C053 carries the rest.
- baseline-test: yes

### C054
- key: Close an email with an invitation to respond plus a signoff, and place a call to action nowhere else.
- class: rule
- source: plugins/claude-kit/skills/scott-writing-style/SKILL.md:95
- provenance: f8c0649 2026-06-10, the initial import of the skill, its rules drawn from samples of the operator's own writing; no incident narrated.
- verdict: keep
- reason: No finding. The email close, stated once.

### C055
- key: Do not write motivational closes.
- class: rule
- source: plugins/claude-kit/skills/scott-writing-style/SKILL.md:96
- provenance: f8c0649 2026-06-10, the initial import of the skill, its rules drawn from samples of the operator's own writing; no incident narrated.
- verdict: keep
- reason: Line 96 already carries one sentence per prohibition; the proposed compression reworded it without shortening it, which is taste.

### C056
- key: Do not put exclamation marks at the end of a document body.
- class: rule
- source: plugins/claude-kit/skills/scott-writing-style/SKILL.md:96
- provenance: f8c0649 2026-06-10, the initial import of the skill, its rules drawn from samples of the operator's own writing; no incident narrated.
- verdict: keep
- reason: As C055; the email-signoff exception stays with it.

### C057
- key: Do not use hand-holding signposts such as "Remember:" or "The takeaway is:".
- class: rule
- source: plugins/claude-kit/skills/scott-writing-style/SKILL.md:96
- provenance: f8c0649 2026-06-10, the initial import of the skill, its rules drawn from samples of the operator's own writing; no incident narrated.
- verdict: keep
- reason: A closing-specific ban from the import; ai-tells:65 catalogues mid-sentence throat-clearing with a deletion test, a different phrase class the document-review-battery plan placed in the catalog while leaving Section 7 intact. Each owner keeps its own.

### C058
- key: Never use question-form headers.
- class: rule
- source: plugins/claude-kit/skills/scott-writing-style/SKILL.md:102
- provenance: f8c0649 2026-06-10, the initial import of the skill, its rules drawn from samples of the operator's own writing; no incident narrated.
- verdict: retire
- reason: A verbatim duplicate of C020 (line 44) inside the same document. Retired at section 36's close: line 102 is gone; C020's line stays, at line 42.

### C059
- key: Do not use rhetorical questions in body prose.
- class: rule
- source: plugins/claude-kit/skills/scott-writing-style/SKILL.md:103
- provenance: f8c0649 2026-06-10, the initial import of the skill; 830ff28 2026-06-17 changed an em dash on the line to a spaced hyphen.
- verdict: keep
- reason: This document owns the ban and its once-per-document self-answer exception; the ai-tells "already prohibited" list names Section 8 by design.

### C060
- key: Use no emoji at all.
- class: rule
- source: plugins/claude-kit/skills/scott-writing-style/SKILL.md:104
- provenance: f8c0649 2026-06-10, the initial import of the skill, its rules drawn from samples of the operator's own writing; no incident narrated.
- verdict: keep
- reason: The owner line; the recap line's clause was a copy and retires.

### C061
- key: Do not use motivational language such as unlock, leverage, empower, transform, revolutionize, game-changer, world-class, or cutting-edge.
- class: rule
- source: plugins/claude-kit/skills/scott-writing-style/SKILL.md:105
- provenance: f8c0649 2026-06-10, the initial import of the skill, its rules drawn from samples of the operator's own writing; no incident narrated.
- verdict: keep
- reason: The owner of the vocabulary list; the ai-tells "already prohibited" entry carries a shortened copy, and any drift between the two is the catalog's to fix by pointing.

### C062
- key: Do not use marketing hype adjectives unsupported by numbers.
- class: rule
- source: plugins/claude-kit/skills/scott-writing-style/SKILL.md:106
- provenance: f8c0649 2026-06-10, the initial import of the skill, its rules drawn from samples of the operator's own writing; no incident narrated.
- verdict: keep
- reason: The owner line with its "significant plus figure" carve-out, which the recap copy dropped; ai-tells:163 covers the adverbial form and says so.

### C063
- key: Do not open with an anecdote, a story, a customer quote, or a scene.
- class: rule
- source: plugins/claude-kit/skills/scott-writing-style/SKILL.md:107
- provenance: f8c0649 2026-06-10, the initial import of the skill, its rules drawn from samples of the operator's own writing; no incident narrated.
- verdict: retire
- reason: A duplicate of C006 (line 20) with extra examples ("Picture this", a customer quote), which move into line 20 so nothing is lost. Retired at section 36's close: line 107 is gone and its examples sit on line 20 as "(no "Picture this…", no customer quote)".

### C064
- key: Do not produce listicle-only documents; let prose carry the argument and bullets support it.
- class: rule
- source: plugins/claude-kit/skills/scott-writing-style/SKILL.md:108
- provenance: f8c0649 2026-06-10, the initial import of the skill, its rules drawn from samples of the operator's own writing; no incident narrated.
- verdict: retire
- reason: A duplicate of C044 (line 79) inside the same document. Retired at section 36's close: line 108 is gone; C044's rule lands on line 75.

### C065
- key: Do not nest bullets three levels deep in prose sections.
- class: rule
- source: plugins/claude-kit/skills/scott-writing-style/SKILL.md:109
- provenance: f8c0649 2026-06-10, the initial import of the skill, its rules drawn from samples of the operator's own writing; no incident narrated.
- verdict: retire
- reason: A duplicate of C017 (line 38); its field-and-parameter-catalog carve-out moves into line 38 with the rewrite, so nothing is lost. Retired at section 36's close: line 109 is gone and its catalog carve-out sits on line 36 in C017's sentence.

### C066
- key: Do not write headers longer than about 5 words.
- class: rule
- source: plugins/claude-kit/skills/scott-writing-style/SKILL.md:110
- provenance: f8c0649 2026-06-10, the initial import of the skill, its rules drawn from samples of the operator's own writing; no incident narrated.
- verdict: rewrite
- reason: The ceiling on C018's two-to-four-word target, so it belongs beside the target on line 42 rather than in a separate list where it reads as a rival limit. Lands at line 40 (section 36's close) as "Never longer than about 5 words." after C018's sentence; line 110 is gone.

### C067
- key: Do not use "In conclusion" or "To summarize" signposting; let the final section simply state the result.
- class: rule
- source: plugins/claude-kit/skills/scott-writing-style/SKILL.md:111
- provenance: f8c0649 2026-06-10, the initial import of the skill, its rules drawn from samples of the operator's own writing; no incident narrated.
- verdict: keep
- reason: This document owns the ban; the ai-tells "already prohibited" list names it by design.

### C068
- key: Do not use second person as the primary voice; keep "we" dominant in proposal and technical work.
- class: rule
- source: plugins/claude-kit/skills/scott-writing-style/SKILL.md:112
- provenance: f8c0649 2026-06-10, the initial import of the skill, its rules drawn from samples of the operator's own writing; no incident narrated.
- verdict: keep
- reason: Bans "you" as primary voice, a different pronoun and failure from C049's we-versus-I default; not a duplicate.

### C069
- key: Do not use contractions in technical documentation.
- class: rule
- source: plugins/claude-kit/skills/scott-writing-style/SKILL.md:113
- provenance: f8c0649 2026-06-10, the initial import of the skill, its rules drawn from samples of the operator's own writing; no incident narrated.
- verdict: keep
- reason: No finding. Stated once, with its email carve-out.

### C070
- key: Pick an Oxford-comma convention and apply it consistently throughout a document.
- class: rule
- source: plugins/claude-kit/skills/scott-writing-style/SKILL.md:114
- provenance: f8c0649 2026-06-10, the initial import of the skill, its rules drawn from samples of the operator's own writing; no incident narrated.
- verdict: keep
- reason: No finding. Stated once.

### C071
- key: Write in active construction by default rather than passive voice.
- class: rule
- source: plugins/claude-kit/skills/scott-writing-style/SKILL.md:115
- provenance: f8c0649 2026-06-10, the initial import of the skill, its rules drawn from samples of the operator's own writing; no incident narrated.
- verdict: rewrite
- reason: Three specimens of active construction reduce to one; the rule and its third-party-system passive carve-out are unchanged. Lands at line 106 (section 36's close) as "Write in active construction ("We create…") and reserve passive voice for describing third-party system behavior." after the bold lead.
- proposed: Line 115 becomes: write in active construction by default ("We create ..."); reserve passive voice for describing third-party system behavior.
- baseline-test: yes

### C072
- key: Use at most one hedge per claim, such as "typically", "usually", or "in most cases".
- class: rule
- source: plugins/claude-kit/skills/scott-writing-style/SKILL.md:116
- provenance: f8c0649 2026-06-10, the initial import of the skill, its rules drawn from samples of the operator's own writing; no incident narrated.
- verdict: rewrite
- reason: The violation specimen ("it could potentially perhaps in some cases") is a second example and drops; the limit and two of its three allowed-hedge examples stay. This document owns the limit; the ai-tells "already prohibited" list names it. Lands at line 107 (section 36's close) as "Use at most one hedge per claim, such as `"typically"` or `"usually"`." after the bold lead.
- proposed: Line 116 becomes: use at most one hedge per claim, such as "typically" or "usually".
- baseline-test: yes

### C073
- key: Read references/ai-tells.md beside this skill before finishing a draft in this voice.
- class: pointer
- source: plugins/claude-kit/skills/scott-writing-style/SKILL.md:122
- provenance: a5fce80 2026-08-18, section 1 of docs/archive/claude-kit_document-review-battery_spec_v1.md installed the machine-prose catalog and this pointer at it.
- verdict: keep
- reason: Already the pointer form the plan specified ("SKILL.md points at it; both a writer and a reviewer read it"); the catalog owns the writer's duty.

### C074
- key: Read references/ai-tells.md and hunt its patterns by name when reviewing a document in this voice.
- class: pointer
- source: plugins/claude-kit/skills/scott-writing-style/SKILL.md:122
- provenance: a5fce80 2026-08-18, section 1 of docs/archive/claude-kit_document-review-battery_spec_v1.md.
- verdict: keep
- reason: As C073 for the reviewer half; the quote-the-passage duty sits in the catalog and the prose-reviewer charter.

### C075
- key: Pick header case by formality: ALL CAPS for internal or technical documents and proposal-style enumerations, Title Case for longer Title Case reports.
- class: rule
- source: plugins/claude-kit/skills/scott-writing-style/SKILL.md:130
- provenance: f8c0649 2026-06-10 naming the KNX email as the ALL CAPS proposal; 0918893 2026-06-28 genericized it to "proposal-style emails".
- verdict: rewrite
- reason: The formality rule merges into line 47 (C023) with the short proposal-style enumeration named, and the three sample sentences before it live here: technical PDFs used ALL CAPS, benefit and integration docs Title Case, and the one proposal email ALL CAPS for its goal-approach-cost-timeframe headers. Lands at line 45 (section 36's close) inside C023's sentence; contradictions item 1 (line 130) is gone and item 3 stands as the section's one paragraph with its list marker gone.
- proposed: (via A026) Rewrite line 47 to case by formality, naming the short proposal-style enumeration (an email listing goal, approach, cost, timeframe) as ALL CAPS and longer client-facing proposals and benefit docs as Title Case; then delete contradictions item 1.
- baseline-test: yes

### C076
- key: Give emails the one-line courtesy opener and open formal documents cold with the thesis.
- class: rule
- source: plugins/claude-kit/skills/scott-writing-style/SKILL.md:132
- provenance: f8c0649 2026-06-10, the initial import of the skill; 0918893 2026-06-28 dropped the "three of five" sample counts.
- verdict: retire
- reason: Contradictions item 2 resolves to exactly Section 1's rule (C002) and its email exception (C007), which stay whole; for the record, the formal samples opened cold and the two email samples opened with a thank-you line. Retired at section 36's close: item 2 (line 132) is gone.
- proposed: (via A001) Delete contradictions item 2 (line 132); Section 1 already carries the rule and the email exception.
- baseline-test: yes

### C077
- key: Nest more in status and review writing and keep proposal or explanatory writing flatter.
- class: rule
- source: plugins/claude-kit/skills/scott-writing-style/SKILL.md:134
- provenance: f8c0649 2026-06-10, the initial import of the skill; 0918893 2026-06-28 genericized the weekly-review sample name.
- verdict: keep
- reason: No finding. The only place the status-versus-proposal nesting difference is stated; it survives the retirement of the other contradictions items. Line 134's item lands at line 121 (section 36's close) word for word; the implementer renumbered its list marker from 3 to 1, and the close pass after round 1 dropped the marker, the item standing as the section's one paragraph rather than a one-item numbered list.

### C078
- key: Use "I" only when the piece is a direct one-to-one communication expressing personal judgment, and "we" for company-voice deliverables.
- class: rule
- source: plugins/claude-kit/skills/scott-writing-style/SKILL.md:136
- provenance: f8c0649 2026-06-10, the initial import of the skill; 0918893 2026-06-28 genericized the sample names.
- verdict: retire
- reason: Its one-to-one bound moves into line 87 (C049) so nothing is lost; for the record, the benefit analysis used "In my opinion" once, the direct 1:1 email used "I" freely, and the technical docs stayed in "we". Retired at section 36's close: item 4 (line 136) is gone and its bound sits on line 83 in C049's sentence.
- proposed: (via A063) Line 87 becomes: default to "we" in technical and proposal writing; use "I" for subjective framing ("In my opinion") and freely only in a direct one-to-one email; then delete contradictions item 4.
- baseline-test: yes

### C079
- key: Open every section with a one-sentence thesis, then support it.
- class: rule
- source: plugins/claude-kit/skills/scott-writing-style/SKILL.md:140
- provenance: f8c0649 2026-06-10, the initial import of the skill, its rules drawn from samples of the operator's own writing; no incident narrated.
- verdict: retire
- reason: A restatement of C027 in the STRONGEST PATTERNS recap, which retires whole as a copy of rules the same document owns; no incident installed the recap and no machinery reads it. Retired at section 36's close with the STRONGEST PATTERNS section (lines 138 to 144), the document ending at the one surviving contradictions item on line 121.

### C080
- key: Anchor every impact claim to a specific number.
- class: rule
- source: plugins/claude-kit/skills/scott-writing-style/SKILL.md:141
- provenance: f8c0649 2026-06-10, the initial import of the skill, its rules drawn from samples of the operator's own writing; no incident narrated.
- verdict: retire
- reason: A restatement of C040 in the recap section, which retires whole. Retired at section 36's close with the recap section.

### C081
- key: Use "However," or "By comparison," as the core pivot: set up, then pivot.
- class: rule
- source: plugins/claude-kit/skills/scott-writing-style/SKILL.md:142
- provenance: f8c0649 2026-06-10, the initial import of the skill; 830ff28 2026-06-17 changed an em dash on the line to a spaced hyphen.
- verdict: retire
- reason: A restatement of C033 in the recap section, which retires whole. Retired at section 36's close with the recap section.

### C082
- key: Close with an END RESULT-style net-state paragraph rather than a call to action.
- class: rule
- source: plugins/claude-kit/skills/scott-writing-style/SKILL.md:143
- provenance: f8c0649 2026-06-10, the initial import of the skill, its rules drawn from samples of the operator's own writing; no incident narrated.
- verdict: retire
- reason: A restatement of C050 and C051 in the recap section, which retires whole. Retired at section 36's close with the recap section.

### C083
- key: Use no questions as headers, no emoji, no hype adjectives, and no opening anecdote.
- class: rule
- source: plugins/claude-kit/skills/scott-writing-style/SKILL.md:144
- provenance: f8c0649 2026-06-10, the initial import of the skill, its rules drawn from samples of the operator's own writing; no incident narrated.
- verdict: retire
- reason: A one-line restatement of C020, C060, C062 and C006 that drops C062's carve-out; the recap section retires whole and each owner line stays. Retired at section 36's close with the recap section; C020 (line 42), C060 (line 99), C062 (line 101) and C006 (line 20) stay.

### C084
- key: Apply the never-question, never-imperative, never-full-sentence header bans to sub-section headers as well as top-level headers.
- class: rule
- source: plugins/claude-kit/skills/scott-writing-style/SKILL.md:48
- provenance: f8c0649 2026-06-10, the initial import of the skill, its rules drawn from samples of the operator's own writing; no incident narrated.
- verdict: keep
- reason: No finding. Line 48's "follow the same rule" is what extends Section 4's bans to sub-section headers; nothing else states it.

## plugins/claude-kit/skills/scott-writing-style/references/ai-tells.md

This document is a named catalog of the prose patterns that make a document read as machine-written, held as a reference beside the writing-style skill it serves. It owns two moments: drafting a document in this voice, where the writer avoids each catalogued pattern, and reviewing a document in this voice, where the reviewer hunts each pattern by name, quotes the offending passage, and says whether the finding is about frequency and uniformity or about a single line. It also fixes the licensed exceptions that keep a legitimate use of each pattern from being flagged, and it defers to the main skill's numbered sections for the five patterns those sections already prohibit. Load class: named-trigger (inferred) - it is loaded before drafting or reviewing a document written in this voice, not at session start and not on every plan run.

Extracted at `6bc07fb`: whole document (`skills.scott-writing-style.references.ai-tells.md`).

### C001
- key: When drafting a document in this voice, avoid every pattern this catalog names.
- class: rule
- source: plugins/claude-kit/skills/scott-writing-style/references/ai-tells.md:3
- provenance: a5fce80 2026-08-18, the document review battery effort, whose Section 1 created this catalog and directed a pointer section in SKILL.md beside it so writer and reviewer work from one list.
- verdict: keep
- reason: SKILL.md:122 says when to load the catalog and this line says what the writer does with it, which are two moments. Collapsing them would put the writer's duty in a file the writer may not open.

### C002
- key: When reviewing a document in this voice, hunt the catalogued patterns by name and quote the offending passage.
- class: rule
- source: plugins/claude-kit/skills/scott-writing-style/references/ai-tells.md:3
- provenance: a5fce80 2026-08-18, same effort; the prose-reviewer charter is dispatched with this file's path and is forbidden to hunt from memory when it cannot read the file.
- verdict: keep
- reason: The reviewer-side duty, including quoting the passage, has to live in the file the reviewer opens, and SKILL.md does not carry the quoting duty at all.

### C003
- key: State in each finding whether the defect is frequency and uniformity across the document or a single line.
- class: rule
- source: plugins/claude-kit/skills/scott-writing-style/references/ai-tells.md:5
- provenance: a5fce80 2026-08-18, the catalog's opening frame, written so a reviewer can tell a pattern from an instance.
- verdict: keep
- reason: The surrounding clauses are the criterion, not decoration: one triad is a sentence and a triad in every paragraph is a signature is what tells the reviewer which finding to raise.

### C004
- key: Use no em dashes.
- class: rule
- source: plugins/claude-kit/skills/scott-writing-style/references/ai-tells.md:11
- provenance: a5fce80 2026-08-18; the spec directed that an item already on the NEVER DO list be named in one line here and pointed back, so the hunt list is complete.
- verdict: keep
- reason: The line states no rule of its own and names Section 6 as the owner, which itself defers to the kit's global style rule, so the chain to the doctrine is intact.

### C005
- key: Write no rhetorical questions in body prose, no opening on one, and no question-form headers.
- class: rule
- source: plugins/claude-kit/skills/scott-writing-style/references/ai-tells.md:12
- provenance: a5fce80 2026-08-18, with the cross-references corrected in ba1060b after a finishing review found two misattributions in this file.
- verdict: keep
- reason: All three attributions check out against Sections 8, 1 and 4, and the licensed self-answer device has to sit beside the ban or a reviewer flags a sanctioned device.

### C006
- key: Avoid motivational and hype vocabulary such as unlock, leverage, empower, transform, game-changer, and world-class.
- class: rule
- source: plugins/claude-kit/skills/scott-writing-style/references/ai-tells.md:13
- provenance: a5fce80 2026-08-18, the same one-line-and-point-back section, except that this item carried a copy of the word list rather than a pointer.
- verdict: rewrite
- reason: The copy has already drifted, six words here against eight at SKILL.md:105, and this line names no owning section while line 9 promises every item does. Making it a pointer removes the drift surface without losing the pattern name a reviewer hunts by.
- proposed: (via A011) Replace the shortened word list with a one-line pointer at Section 8's motivational-language ban, in the same form the em dash and rhetorical question items already take.
- baseline-test: yes

### C007
- key: Never stack more than one hedge on a single claim.
- class: rule
- source: plugins/claude-kit/skills/scott-writing-style/references/ai-tells.md:14
- provenance: a5fce80 2026-08-18, same section.
- verdict: rewrite
- reason: The limit matches SKILL.md:116 exactly, so nothing about the rule changes; only the missing Section 8 attribution that line 9 promises is added, which is what makes the checkable examples reachable.
- proposed: (via A013) Name Section 8 as the owner on the hedges line, as the other items in this section do.

### C008
- key: Do not signpost a closing section with "In conclusion" or "To summarize".
- class: rule
- source: plugins/claude-kit/skills/scott-writing-style/references/ai-tells.md:15
- provenance: a5fce80 2026-08-18, same section.
- verdict: rewrite
- reason: The two phrases are the pattern's own name and cannot drift, so they stay; only the missing Section 8 attribution is added.
- proposed: (via A015) Name Section 8 as the owner on the signposting-the-close line.

### C009
- key: Do not let three-item lists and three-clause sentences become the document's default cadence.
- class: rule
- source: plugins/claude-kit/skills/scott-writing-style/references/ai-tells.md:21
- provenance: a5fce80 2026-08-18, the first catalogued tell, named in the spec's minimum list of patterns.
- verdict: keep
- reason: No finding. The rule is the cadence one, not a ban on triads, and its bound at line 27 keeps a genuine three-member set legal.

### C010
- key: Treat "The service is fast, reliable, and secure. It handles authentication, authorization, and auditing across the web, mobile, and API surfaces." as the triadic-rhythm tell.
- class: rationale-example
- source: plugins/claude-kit/skills/scott-writing-style/references/ai-tells.md:23
- provenance: a5fce80 2026-08-18; the spec's acceptance for this file required a before and after rewrite for every pattern.
- verdict: keep
- reason: The specimens are the acceptance rather than illustration. A finishing review raised as a Major that two patterns were described and not shown, and the fix was to add specimens, so retiring one re-creates a defect already adjudicated.

### C011
- key: Rewrite the triadic tell as "The service handles authentication and authorization. It also writes an audit record for every call, which is the part that matters when a customer disputes a charge."
- class: rationale-example
- source: plugins/claude-kit/skills/scott-writing-style/references/ai-tells.md:25
- provenance: a5fce80 2026-08-18, same acceptance.
- verdict: keep
- reason: The after half is the half the finishing Major was about; a described pattern with no shown fix is what it named as unmet.

### C012
- key: The rewrite works because it drops one item, keeps two, and spends the saved words on why the second earns its place.
- class: rationale-example
- source: plugins/claude-kit/skills/scott-writing-style/references/ai-tells.md:27
- provenance: a5fce80 2026-08-18.
- verdict: keep
- reason: This is the recipe, not commentary: without it the pair shows a fix and never names the move the writer repeats.

### C013
- key: When a real set has three members, write three.
- class: rule
- source: plugins/claude-kit/skills/scott-writing-style/references/ai-tells.md:27
- provenance: a5fce80 2026-08-18.
- verdict: keep
- reason: This is the carve-out that stops the cadence rule from becoming a ban on triads, and it already sits in nineteen words beside its threshold.

### C014
- key: Raise the triadic-rhythm finding only when nearly every set in the document has three members.
- class: mechanic
- source: plugins/claude-kit/skills/scott-writing-style/references/ai-tells.md:27
- provenance: a5fce80 2026-08-18.
- verdict: keep
- reason: No finding. It is the threshold that makes the tell raisable and is the frequency half of the opening frame applied to this pattern.

### C015
- key: Do not use the "it is not X, it is Y" negation-then-correction construction.
- class: rule
- source: plugins/claude-kit/skills/scott-writing-style/references/ai-tells.md:31
- provenance: a5fce80 2026-08-18, named in the spec's minimum pattern list.
- verdict: keep
- reason: No finding. Note that this rule is the one line 81 of this same document violates, which is why C032 is a rewrite.

### C016
- key: Replace "This is not a configuration change. It is a change to how the system thinks about identity." with "The change moves identity resolution out of the config file and into the token itself."
- class: rationale-example
- source: plugins/claude-kit/skills/scott-writing-style/references/ai-tells.md:33
- provenance: a5fce80 2026-08-18, the file's before-and-after acceptance.
- verdict: keep
- reason: Per C010, the specimen pairs are what a finishing review already ruled this file owes for every pattern.

### C017
- key: Use the "However," pivot only against a real position a real reader holds, never against a straw position invented one clause earlier.
- class: rule
- source: plugins/claude-kit/skills/scott-writing-style/references/ai-tells.md:37
- provenance: a5fce80 2026-08-18, written as the carve-out that keeps Section 6's licensed pivot from being flagged as this tell.
- verdict: keep
- reason: The family-resemblance sentence is the carve-out, and a ban read without it costs the writing skill its core rhetorical move. It is a different test from line 71, which asks whether the marker survives deletion.

### C018
- key: Vary paragraph and sentence length rather than writing every paragraph three sentences and every sentence the same length.
- class: rule
- source: plugins/claude-kit/skills/scott-writing-style/references/ai-tells.md:41
- provenance: a5fce80 2026-08-18, named in the spec's minimum pattern list as uniform paragraph and sentence length.
- verdict: keep
- reason: No conflict with SKILL.md:53, which sets a band of two to four sentences rather than a fixed three, so variation inside the band satisfies both. The pointer at Section 6 is already one line below, and the spread measurement at line 43 exists nowhere else.

### C019
- key: Measure the tell by taking the sentence lengths in a section and looking at the spread; sentences all within a few words of each other read as generated.
- class: mechanic
- source: plugins/claude-kit/skills/scott-writing-style/references/ai-tells.md:43
- provenance: a5fce80 2026-08-18.
- verdict: keep
- reason: No finding. This is the catalog's whole contribution over the doctrine and Section 6, which both say to vary length and neither says how to measure it.

### C020
- key: Three consecutive 26-to-31-word sentences, with the next two paragraphs built the same way, is the uniform-length tell.
- class: rationale-example
- source: plugins/claude-kit/skills/scott-writing-style/references/ai-tells.md:45
- provenance: a5fce80 2026-08-18.
- verdict: keep
- reason: Per C010, and this specimen is also the only calibration of the spread measurement, showing what a too-narrow spread looks like on the page.

### C021
- key: The rewrite merges two long sentences, then follows with "Every write lands in the audit table." and "That last part is what an auditor actually asks for."
- class: rationale-example
- source: plugins/claude-kit/skills/scott-writing-style/references/ai-tells.md:47
- provenance: a5fce80 2026-08-18.
- verdict: keep
- reason: Per C010 and C020; it is the after half that shows the spread the rule asks for.

### C022
- key: Do not put a bolded lead-in term on every bullet, especially on bullets carrying an argument.
- class: rule
- source: plugins/claude-kit/skills/scott-writing-style/references/ai-tells.md:51
- provenance: a5fce80 2026-08-18, named in the spec's minimum pattern list.
- verdict: keep
- reason: No conflict with SKILL.md:67, which says bullets are typically bold term plus explanation and is bounded to non-ranked field lists; SKILL.md:79 independently bars bullets for decomposing arguments, which is the same boundary this rule draws.

### C023
- key: A list reading "Performance: Queries return faster. / Reliability: Fewer failures occur. / Cost: Spend goes down." is the bolded-lead-in tell.
- class: rationale-example
- source: plugins/claude-kit/skills/scott-writing-style/references/ai-tells.md:55
- provenance: a5fce80 2026-08-18; this is one of the two patterns a finishing review found described rather than shown.
- verdict: keep
- reason: Per C010, with the added weight that this pattern's specimen exists because a fresh-context reviewer demanded it.

### C024
- key: Replace the label rack with prose: "The cache is keyed on tenant, so a cross-tenant read cannot hit. Eviction is manual... The cache is process-local and does not survive a restart."
- class: rationale-example
- source: plugins/claude-kit/skills/scott-writing-style/references/ai-tells.md:59
- provenance: ba1060b 2026-08-18, the finishing pass, added as the fix for the Major that two of the fourteen patterns were described rather than shown.
- verdict: keep
- reason: This line is literally the adjudicated review fix; retiring it undoes it.

### C025
- key: Keep bullets and bold terms only where the reader will scan for that term later, as in a catalog entry or lookup table.
- class: rule
- source: plugins/claude-kit/skills/scott-writing-style/references/ai-tells.md:61
- provenance: ba1060b 2026-08-18, added in the same finishing fix.
- verdict: keep
- reason: SKILL.md:67 says which items go in bullets and this line supplies the test that decides a borderline case, which the skill does not carry.

### C026
- key: Cut signposting and throat-clearing phrases such as "It is worth noting that", "importantly", "in essence", "at its core", "simply put", and "that said".
- class: rule
- source: plugins/claude-kit/skills/scott-writing-style/references/ai-tells.md:65
- provenance: a5fce80 2026-08-18, named in the spec's minimum pattern list.
- verdict: keep
- reason: SKILL.md:96 bars two hand-holding phrases in a close; this line states the body-prose class and the deletion test that decides membership, which is the only place that test exists.

### C027
- key: Test a signpost by deleting it; if the sentence is unchanged, it was throat-clearing.
- class: mechanic
- source: plugins/claude-kit/skills/scott-writing-style/references/ai-tells.md:65
- provenance: a5fce80 2026-08-18.
- verdict: keep
- reason: No finding. The test is what makes the phrase list open-ended rather than a closed enumeration a writer can route around.

### C028
- key: Replace "It is worth noting that the migration is reversible." with "The migration is reversible."
- class: rationale-example
- source: plugins/claude-kit/skills/scott-writing-style/references/ai-tells.md:67
- provenance: a5fce80 2026-08-18.
- verdict: keep
- reason: Per C010; it is the cheapest pair in the file and shows the deletion test being run.

### C029
- key: Keep a contrast marker such as "However," when it has an antecedent, because removing it changes the logical relation.
- class: rule
- source: plugins/claude-kit/skills/scott-writing-style/references/ai-tells.md:71
- provenance: a5fce80 2026-08-18, the survivor clause of the deletion test.
- verdict: keep
- reason: This is the exception the deletion test owes, and it is a different test from line 37: this one asks whether the marker survives deletion, that one asks whether the position it argues against is real.

### C030
- key: Do not write a paragraph that describes the structure of the section following it.
- class: rule
- source: plugins/claude-kit/skills/scott-writing-style/references/ai-tells.md:75
- provenance: a5fce80 2026-08-18, named in the spec's minimum pattern list.
- verdict: keep
- reason: No finding. Note that line 111's "Two notes for a reviewer" opener is this document's own instance of it, which is why C041 is a rewrite.

### C031
- key: Delete a structural preview and start with the section's thesis sentence instead.
- class: rule
- source: plugins/claude-kit/skills/scott-writing-style/references/ai-tells.md:79
- provenance: a5fce80 2026-08-18.
- verdict: keep
- reason: No finding. It is the rewrite half of C030 and names the replacement, without which a writer deletes the preview and has no opener.

### C032
- key: Allow one early scope statement saying what the piece will and will not cover, and flag previews repeated at the head of every section.
- class: rule
- source: plugins/claude-kit/skills/scott-writing-style/references/ai-tells.md:81
- provenance: a5fce80 2026-08-18, the licensed exception for Section 2's scope statement.
- verdict: rewrite
- reason: Both the licence and the every-section threshold stay; only "That is a boundary, not a preview." goes, because it is an instance of the negation-then-correction construction this same file bars at line 31. A catalog that commits its own tell teaches the pattern it forbids.
- proposed: Fold the boundary-versus-preview distinction into the licence sentence and delete "That is a boundary, not a preview.", keeping both the licence and the every-section tell.
- baseline-test: yes

### C033
- key: Do not close with a summary paragraph whose every sentence appeared earlier in different words.
- class: rule
- source: plugins/claude-kit/skills/scott-writing-style/references/ai-tells.md:85
- provenance: a5fce80 2026-08-18, named in the spec's minimum pattern list.
- verdict: rewrite
- reason: The rule holds and does not conflict with SKILL.md:75, which governs a section close rather than the document close. The change is placement: the Section 6 licence sits at line 101 under a different tell, so a reviewer meeting this ban does not see its carve-out, and naming it here is what makes the stop readable with its exception.
- proposed: Name Section 6's section-close summary as licensed beside the line 85 ban, so the stop is read with its exception rather than two sections apart from it.
- baseline-test: yes

### C034
- key: Close by stating the end state the reader now has after applying the design, which is new information arrived at by the body.
- class: rule
- source: plugins/claude-kit/skills/scott-writing-style/references/ai-tells.md:87
- provenance: a5fce80 2026-08-18.
- verdict: keep
- reason: The line names Section 7 as the owner and adds the discriminator, that the end state is arrived at rather than repeated, which is what separates the licensed close from the tell above it.

### C035
- key: Replace "In summary, the design separates the two roles, restricts the permissions on each, and audits the boundary between them." with "The result is an operator who can run every report and cannot read a single card number."
- class: rationale-example
- source: plugins/claude-kit/skills/scott-writing-style/references/ai-tells.md:89
- provenance: a5fce80 2026-08-18.
- verdict: keep
- reason: Per C010.

### C036
- key: Do not end every section on a one-line aphoristic moral set off alone.
- class: rule
- source: plugins/claude-kit/skills/scott-writing-style/references/ai-tells.md:95
- provenance: a5fce80 2026-08-18, named in the spec's minimum pattern list.
- verdict: keep
- reason: The "set off alone" recognizer is what separates an aphorism closing a section from an ordinary last sentence, and the once-versus-every-section threshold is the frequency bound the whole catalog runs on.

### C037
- key: End a section on the concrete consequence instead of a moral.
- class: rule
- source: plugins/claude-kit/skills/scott-writing-style/references/ai-tells.md:99
- provenance: a5fce80 2026-08-18.
- verdict: keep
- reason: No finding. It is the replacement for the deleted moral, without which the rule says only what not to write.

### C038
- key: Where a short summary paragraph closes a section, make it restate the section's conclusion about its subject, not a portable maxim that would fit any document.
- class: rule
- source: plugins/claude-kit/skills/scott-writing-style/references/ai-tells.md:101
- provenance: a5fce80 2026-08-18, the licensed exception for Section 6's section-close summary.
- verdict: keep
- reason: The differentiator is the whole content of the carve-out; a bare pointer at Section 6 would leave the licensed summary and the one-line moral indistinguishable to a reviewer.

### C039
- key: Avoid the generated-prose vocabulary set: delve, robust, seamless, comprehensive, streamline, crucial, figurative landscape, realm, myriad, testament to, figurative navigate, "in today's [adjective] world", and ensure where a plain verb serves.
- class: rule
- source: plugins/claude-kit/skills/scott-writing-style/references/ai-tells.md:105
- provenance: a5fce80 2026-08-18, named in the spec's minimum pattern list.
- verdict: keep
- reason: No conflict with C041. Line 105 is a recognizer list, not an instruction to avoid the words, and line 111 is its bound; the imperative reading came from the extraction, not the passage.

### C040
- key: Replace "In today's fast-moving compliance landscape, a comprehensive audit trail is crucial to ensuring seamless reporting." with a sentence asserting a fact about what an auditor needs.
- class: rationale-example
- source: plugins/claude-kit/skills/scott-writing-style/references/ai-tells.md:107
- provenance: a5fce80 2026-08-18.
- verdict: keep
- reason: Per C010, and line 111's second note refers back to this pair when it says swapping the word and keeping the empty sentence fixes nothing.

### C041
- key: Do not treat these words as banned; raise the finding on density and figurative use, since robust in statistics and ensure in a contract clause are correct.
- class: rule
- source: plugins/claude-kit/skills/scott-writing-style/references/ai-tells.md:111
- provenance: a5fce80 2026-08-18, written as the bound on the vocabulary recognizer above it.
- verdict: rewrite
- reason: The note itself stays whole, counterexamples included, because they are what stops a correct use of robust or ensure being flagged. Only the "Two notes for a reviewer" opener goes, since it is this document's own instance of the structural-preview tell it bars at line 75.
- proposed: Delete the "Two notes for a reviewer" opener and let the two notes stand as written, keeping the counterexamples and the assert-a-fact recipe whole.
- baseline-test: yes

### C042
- key: Fix a vocabulary tell by making the sentence assert a fact, not by swapping the word and keeping the empty sentence.
- class: rule
- source: plugins/claude-kit/skills/scott-writing-style/references/ai-tells.md:111
- provenance: a5fce80 2026-08-18.
- verdict: keep
- reason: The rewrite at C041 deletes only the paragraph's opener; this sentence is the fix recipe and is untouched.

### C043
- key: Do not build headers from one template such as repeated "Understanding X", all gerunds, or the same syllable count.
- class: rule
- source: plugins/claude-kit/skills/scott-writing-style/references/ai-tells.md:115
- provenance: a5fce80 2026-08-18, named in the spec's minimum pattern list as over-parallel headers.
- verdict: keep
- reason: No finding. Section 4 sets the header form and says nothing about headers being too alike, which is what this rule catches.

### C044
- key: Replace headers "Understanding the Problem / Understanding the Solution / Understanding the Tradeoffs" with "The Failure / Split Permissions / Cost At Volume".
- class: rationale-example
- source: plugins/claude-kit/skills/scott-writing-style/references/ai-tells.md:117
- provenance: a5fce80 2026-08-18.
- verdict: keep
- reason: Per C010.

### C045
- key: Write headers as short noun phrases with one case convention per document, and check separately that they are not too alike.
- class: mechanic
- source: plugins/claude-kit/skills/scott-writing-style/references/ai-tells.md:121
- provenance: a5fce80 2026-08-18.
- verdict: keep
- reason: The line already names Section 4 as the owner and states its own contribution, that the too-alike tell passes Section 4's checks; the parenthetical restating the form is what makes that claim readable in place.

### C046
- key: Avoid comma-plus-participle tails such as ", ensuring that", ", allowing teams to", ", making it easy to", ", providing a foundation for".
- class: rule
- source: plugins/claude-kit/skills/scott-writing-style/references/ai-tells.md:125
- provenance: a5fce80 2026-08-18.
- verdict: keep
- reason: No finding. Nothing else in the corpus names this construction, and the reason it is catalogued, that it appends a benefit without arguing for it, is a defect no other rule reaches.

### C047
- key: Replace "The gateway caches the token, reducing round trips and allowing downstream services to authorize locally, ensuring consistent latency." with two sentences naming the removed network hop.
- class: rationale-example
- source: plugins/claude-kit/skills/scott-writing-style/references/ai-tells.md:127
- provenance: a5fce80 2026-08-18.
- verdict: keep
- reason: Per C010; it shows the stacked form and the two-sentence fix.

### C048
- key: Accept one participial tail in a document; treat three in a paragraph as the pattern.
- class: mechanic
- source: plugins/claude-kit/skills/scott-writing-style/references/ai-tells.md:131
- provenance: a5fce80 2026-08-18.
- verdict: keep
- reason: No finding. It is the frequency threshold that keeps a single legitimate tail from being raised as a finding.

### C049
- key: Do not close by listing options, assigning each a merit, and declining to pick.
- class: rule
- source: plugins/claude-kit/skills/scott-writing-style/references/ai-tells.md:135
- provenance: a5fce80 2026-08-18, named in the spec's minimum pattern list as the non-committal verdict.
- verdict: keep
- reason: No conflict with the doctrine's decision-ask rule, which requires a marked and argued recommendation and says a bare pick is not one. Presenting the options and getting the call is options plus a recommendation, which is what this rule asks for rather than what it bars.

### C050
- key: Replace "Both approaches have their merits, and the right choice depends on your specific needs and priorities." with "Take the queue," plus its cost and the reason it wins.
- class: rationale-example
- source: plugins/claude-kit/skills/scott-writing-style/references/ai-tells.md:137
- provenance: a5fce80 2026-08-18.
- verdict: keep
- reason: Per C010, and the rewrite is the only place the shape of a verdict close is shown: the pick, its cost, and the reason it wins.

### C051
- key: Make the closing paragraph state the net result, and treat a document that reaches its last paragraph without a verdict as a defect against Section 7.
- class: rule
- source: plugins/claude-kit/skills/scott-writing-style/references/ai-tells.md:141
- provenance: a5fce80 2026-08-18.
- verdict: keep
- reason: The contribution over Section 7 is the reviewer's diagnosis, that a document without a verdict in its last paragraph usually did not have one, which turns a writing rule into a finding a reviewer can raise.

### C052
- key: Do not follow a prose paragraph with a bullet list that repeats the same points as fragments.
- class: rule
- source: plugins/claude-kit/skills/scott-writing-style/references/ai-tells.md:145
- provenance: a5fce80 2026-08-18; this is the second of the two patterns the finishing review found described rather than shown.
- verdict: keep
- reason: No finding. Its specimens and disposition at line 159 arrived in ba1060b as the fix for that Major.

### C053
- key: A staged-rollout paragraph followed by Canada / United Kingdom / United States bullets restating its order is the tell; bullets carrying dates and owners the paragraph never had are not.
- class: rationale-example
- source: plugins/claude-kit/skills/scott-writing-style/references/ai-tells.md:147
- provenance: a5fce80 2026-08-18, with the paired additive list and its disposition added in ba1060b.
- verdict: keep
- reason: The paired lists are the only place the boundary between a restating list and an additive one is drawn; the rule at line 159 states the disposition and never says where the line falls.

### C054
- key: Keep whichever of the paragraph and the list carries the detail.
- class: rule
- source: plugins/claude-kit/skills/scott-writing-style/references/ai-tells.md:159
- provenance: ba1060b 2026-08-18, added in the finishing pass as the fix for the described-rather-than-shown Major.
- verdict: keep
- reason: The middle sentence a compression would drop is the one that walks the paired specimens and draws the boundary C053 names, and the whole line is an adjudicated review fix.

### C055
- key: Cut the list where it would only re-say the sentence.
- class: rule
- source: plugins/claude-kit/skills/scott-writing-style/references/ai-tells.md:159
- provenance: ba1060b 2026-08-18, same fix.
- verdict: keep
- reason: It is not C054 restated: C054 decides which member to keep when both carry something, and this decides the case where the list carries nothing, which C054 alone does not dispose of.

### C056
- key: Avoid weightless intensifiers: truly, really, incredibly, highly, vital, essential, powerful, and significantly with no figure behind it.
- class: rule
- source: plugins/claude-kit/skills/scott-writing-style/references/ai-tells.md:163
- provenance: a5fce80 2026-08-18.
- verdict: keep
- reason: The line names Section 8 and says why it reaches further, that the adverbial form survives the adjective ban by attaching to ordinary words. Dropping "significantly" to leave a pointer would break the by-name hunt list for the one word a reviewer meets most.

### C057
- key: Replace "This is a highly effective approach that significantly reduces load." with "The approach cuts read load on the primary by about 60 percent at peak."
- class: rationale-example
- source: plugins/claude-kit/skills/scott-writing-style/references/ai-tells.md:165
- provenance: a5fce80 2026-08-18.
- verdict: keep
- reason: Per C010, and the rewrite is the only place the figure-behind-it requirement is shown as an actual number.
