# The rule corpus is compressed to half its words, each rule re-expressed from its ledger with its meaning kept, one document per pull request

Status: In Progress
Commit Model: Branch-and-PR, one PR per section
Created: 2026-09-25

Session model: the kit worker seat (DEV-PLUGIN) on the execution model. Every drafting and review dispatch in this plan runs through one committed Workflow script (section 1) that names the model and the effort on every call, holds at most three agents open, and runs one section's wave to completion before the next. Drafters are read-only and return text; the worker's main thread writes the files. The drafting model for sections 3 to 11 is whichever configuration wins the bake-off section 2 runs, Opus at medium or Fable at low; every review runs at Fable low, the configuration the operator reports ran cleanly in earlier fan-outs. Authored by the architect persona on 2026-09-25 from a design request the assistant persona relayed with the operator's approval on the Discord thread that day ("please proceed immediately") and two amendments the same day. Line and word figures are authoring-time readings at trunk `57a7c754`; re-locate every anchor by content.

## Dispatch Authorization

This plan arms in two stages. Stage one is sections 1 and 2, the dispatch script and the doctrine pilot. They arm only when no item under Decisions reads `Ruled: pending`; the operator's answers arrive on the architect's relay thread or at a keyboard, and "all as recommended" binds every item at once. Stage two is sections 3 to 12. They arm only after section 2's pull request has merged, the operator has read the compressed doctrine whole and ruled its flagged claims, named the bake-off winner under item 5, and said "go" for the fan-out on a relay thread or at a keyboard, recorded under item 3 with its date. A pilot that misses item 3's test stops the plan at section 2, and the architect persona rewrites sections 3 to 12 to what the pilot taught before any of them arms.

Pacing is a hard requirement of this plan, on the operator's word relayed by the assistant persona on 2026-09-25 (reported; his words as relayed: "the workflows ... capped at maybe 3 to 5 agents"). It is enforced in the machinery rather than in instructions: every dispatch runs through `tools/corpus-compression/workflow.mjs` by the Workflow tool's `scriptPath`, whose named constants `MAX_OPEN = 3`, `REVIEW_MODEL = 'fable'`, `REVIEW_EFFORT = 'low'`, `DRAFT_MODEL` and `DRAFT_EFFORT` are the only places a model, an effort or a pool size is written, and `test/corpus-compression-workflow.test.js` fails where any `agent()` call in that file lacks a model and an effort literal or where `MAX_OPEN` exceeds five. The script runs sections as sequential waves: one drafter, then the two reviewers, then each fix-round reviewer, one wave finishing before the next starts. No dispatch in this plan inherits the session's model or effort. Every review runs at Fable low; no section asks for a higher effort, so none justifies one. The drafters are read-only agents that return proposed text, which keeps every dispatch inside the doctrine's standing Workflow grant for read-only agents at a set effort, and gives the main thread one point where every rewording is read before it touches the tree. The Agent tool is not used in this plan, since it cannot set effort.

## Goal

The kit's rule corpus is 49 documents and 193,762 words on the size tool's count at `57a7c754` (`test/size-budget.json`, the 49 paths that are neither a rationale ledger nor a test), up from the 175,123 words the corpus rewrite landed on 2026-09-13. When this plan is done: every one of the 49 documents has been redrafted from its rationale ledger so that each live claim keeps its meaning and is stated in the shortest clear form, under the operator's ruling that meaning is what a keep verdict protects and never its wording; the 49 documents sum to 96,881 words or fewer, or each miss carries the one-line ask its section raised; every live ledger entry carries the landed wording on its `passage:` line and a `flag:` line wherever the drafter judged the reason weak, stale or unfounded, so the operator argued only the flagged claims and the ones he disagreed with, never a rule from memory; every ruled probe pair reads the same answer before and after each section, the designed mismatches standing, and every moment a section's `baseline-test: yes` entries turn on is covered by a probe pair or recorded as waived; the parity pins, the ledger preamble pin and the size ratchet are green at every section close with each cap moved to its landed size; every dispatch ran through the committed script under its constants; the three approved additions are in the text (a classify-first step in systematic-debugging, one line in the Before-you-send list in all three copies, and a Failed approaches field in the Chapter template); the doctrine has taken the per-bullet moment test the post-rewrite program's step 4 orders and every document carries the operator's recorded read on its ruled entries, so that program's step 4 is closed by this plan; and the corpus carries a hard cap at its landed total that only an operator ruling raises.

Acceptance:

- Every document in the sections below is at or under its target on `node plugins/claude-kit/scripts/kit-size.js sync --repo . <paths>`'s count, its cap moved to the landed count at the section's close, and the Chapter records target and landing side by side. A landing above the target carries the one-line ask the lean kit program's decision 1 provides for a miss: the document, its target and its landing, one line.
- Under every document's ledger heading, every entry with verdict keep or rewrite either carries a `passage:` line quoting the landed text verbatim, or has been re-verdicted retire with a reason naming the entry whose passage now carries its meaning. Every entry whose reason the drafter judged weak, stale or unfounded carries `flag: weak-reason`, `flag: stale` or `flag: unfounded`, the set closed at those three, and the pull request body lists the flagged entries by id with the flag and one line of why. The operator's ruling on any entry, flagged or not, lands on the entry as `ruled: <keep|cut|amend> YYYY-MM-DD` before the section's pull request is marked ready; a disagreement on an unflagged entry is raised as a pull request comment naming the entry id and lands the same line.
- The probe reading per section is two runs, the before leg `node tools/probe-corpus/run.mjs --only <ruled moments> --before <base sha>` and the after leg `node tools/probe-corpus/run.mjs --only <all kept moments>`, in the form writing-skills' RED and GREEN step states, and the Chapter quotes both summary lines verbatim with the four-outcome reading. Before drafting, the section lists the moments its `baseline-test: yes` entries turn on, maps each to a probe in `test/probes/` or writes one new probe for it under the section's new-probe cap stated in Assumptions. Every ruled pair matches; a proposed probe's after leg is recorded for the operator's ruling; a moment under no probe and past the cap is recorded as waived by name.
- `test/size-ratchet.test.js`, `test/doctrine-parity.test.js`, `test/output-style-parity.test.js`, `test/ledger-preamble-parity.test.js`, `test/probe-set.test.js` and `test/corpus-compression-workflow.test.js` are green at every section close. A pin that asserts a sentence's text is re-pinned to the landed sentence in the commit that lands the sentence. The whole gate (`node --test test/*.test.js`) is green at every pull request's ready mark.
- The three approved additions are present, each in its section's acceptance: section 9 for the classify-first step and the four charters' pointer at it, section 2 for the Before-you-send line in all three copies, section 3 for the Chapter field.
- Section 2's doctrine carries the per-bullet read: the Chapter lists every bullet with the moment it fires at and the skill that owns that moment, and each bullet a skill owns is a pointer at the owner or has moved there. Every later section's ruled entries are the operator's recorded read of that document.
- Section 2's Chapter records the bake-off: for each of the two configurations, the two drafts, the blind prose review's verdict, the meaning read against the ledger reasons, and the meter delta the capacity reader printed before and after that configuration's wave.
- At the close, the 49 caps sum to 96,881 words or fewer, or section 12's Chapter records the sum and the misses that make it; `kit-size.js` and `test/size-ratchet.test.js` carry a corpus cap at the landed sum that reds the gate when the 49 measured documents exceed it, and `docs/plans/claude-kit_post-rewrite_program_v1.md` records step 4 closed by this plan.

## Intent

The operator's frame, from the request the assistant persona relayed on 2026-09-25: a pass that shrinks the kit's rule prose by half or more, where agents draft the rewording, the ledgers supply the reason for every claim, and the operator reviews drafts and argues only the flagged claims, never rule by rule from memory. The pilot is the doctrine, because it loads in every session and because the pilot is where the operator decides what "shortest" means before the big skills take it. Two amendments the same day: pacing is mechanical, Fable low is the proven baseline, and the drafting model is decided by a bake-off inside the pilot rather than by benchmarks.

Done means: every rule keeps its meaning and loses its length; the ledger, not the rule, keeps the why; the operator's review cost is the flagged claims and the disagreements; the probe pairs, not per-claim reps, carry the behaviour reading; every dispatch is paced by a constant the operator can read in the pull request; and the corpus stops regrowing once it is cut.

Done does not need: a rewrite of the ledgers' own prose; a new review tool; a change to the ledger's verdict vocabulary; any rule retired on taste; a per-claim RED and GREEN rep; a dispatch above low effort; or a document made shorter than its meaning allows, which is why a miss is an ask rather than a cut.

Alternatives refused, one line each:
- Per-claim RED and GREEN reps over the 1,156 flagged entries: the writing-skills probe-pair rule already stands in for them where a probe is ruled, and the reps would cost on the order of a thousand paid reads against about forty cents a pair.
- A separate review sheet artifact per document: the ledger diff in the pull request is the sheet, since every entry already carries reason, provenance and passage, and a second artifact drifts from it.
- Compressing the doctrine and then running the post-rewrite program's step 4 separately: the per-bullet moment test is the doctrine's biggest cut, and two passes over one document double the operator's reads.
- Keeping the prior "keep verdict's wording stays whole" rule: it is what held the corpus rewrite to 18 percent; the operator's 2026-09-25 ruling overrides it for this pass, asked as item 0.
- Picking the drafting model on reported benchmarks: the pilot is small and runs first, so two doctrine sections drafted by both configurations decide it on prose, meaning and meter.
- Drafters that edit files: a read-only drafter stays inside the standing Workflow grant, and the main thread's write is the one check every rewording passes.
- A hard cap per file set by the plan: the lean kit program's decision 1 says growth is declared, never discovered; what this plan adds is one cap on the corpus total, since the corpus regrew 18,639 words in the twelve days after the rewrite.

Rulings after the spec shipped, each appended dated, and the Chapter that lands one names it as drift:
- 2026-09-25, on the relay thread: items 0 to 6 as recommended, item 5 as the bake-off deciding with the winner still to be named. Item 7 taken with a reservation: the operator has avoided a corpus-wide cap so as not to block useful increases to the doctrine, and takes it now on the condition that an increase is verified as necessary first, since the corpus regrows faster than they have found a way to stop. The raise protocol in section 12 carries that condition.

Provenance: distilled by the architect persona from the assistant persona's relayed request and two amendments, the corpus rewrite's archived spec and rulings record, and the post-rewrite program, on 2026-09-25 in session 1e18cd68.

## Decisions

Written to the recommendations. An item reading `Ruled: pending` holds sections 1 and 2 parked, except item 5, which the bake-off answers and which parks sections 3 to 12 alone; nothing lands by silence. The evidence block sits at the end of this section.

**Item 0. For this pass a keep verdict protects a claim's meaning and never its wording.** Ruled: as recommended, 2026-09-25.

- Situation. The corpus rewrite's Goal left every keep verdict's wording whole, and 4,047 entries carry keep. That rule is why it cut 18 percent. The relayed request says this pass needs the opposite rule and asks that the spec record the operator's ruling.
- Decision. Whether the rule above is the operator's ruling, dated, written once into every ledger's preamble by section 2.
- Stakes. Without it, the pass cannot touch 4,047 claims' wording and cannot reach half.
- Options. (a) Yes. (Recommended.) (b) No: the pass compresses the rewrite and retire entries only. Cost: the half target is unreachable.
- Unanswered: the plan stays parked.

**Item 1. The 50 percent target is corpus-wide, with each document's target set at half its cap and a miss carried as one ask.** Ruled: as recommended, 2026-09-25.

- Situation. Half of 193,762 is 96,881 words. Documents differ in what they can give: executing-work at 27,332 words and the coordinator at 18,162 carry long procedure and can give more than half; the consultant charter at 573 and the design-facilitator at 433 already read as pointers and may not halve without losing an instruction.
- Decision. Whether the target binds each document at half, or the corpus at half with the documents free to trade.
- Stakes. A per-document bar on a small charter forces a cut that loses meaning; a corpus-only bar lets the big skills carry the number while a mid-size skill stays long.
- Options. (a) Each document targets half its cap; a landing above target is the one-line ask decision 1 provides; the close reads the corpus sum against 96,881 and records the misses. (Recommended.) The operator sees a miss per document and the total once, and the small charters' misses are cheap asks. (b) Corpus-only: the sum binds and no document has a target. Cost: a drafter can leave a long document long while the total holds. (c) Per document, hard: a miss is a rewrite round. Cost: rewrite rounds on the small charters over a few dozen words.
- Unanswered: the plan stays parked; the sections are written to (a).

**Item 2. The rationale ledgers are out of scope as prose, and in scope as the record.** Ruled: as recommended, 2026-09-25.

- Situation. The 23 ledgers hold 752,010 words and load only when a session changes a rule. This pass writes to every live entry (a `passage:` line, a `flag:` line where earned, a `ruled:` line where the operator ruled), so the ledgers grow by a few words per entry.
- Decision. Whether the ledgers' own prose is compressed in this pass.
- Stakes. Compressing the ledgers is a second pass of the same size over text no session loads by default.
- Options. (a) Ledger prose stays; entries gain the three lines above; each ledger's cap moves at its section's close, the ledger path named in the sync. (Recommended.) (b) Compress the ledgers too, in this plan. Cost: doubles the plan and the review load for no load-time gain. (c) Compress them in a later plan. Cost: none now; recorded as a backlog item under (a).
- Unanswered: the plan stays parked; the sections are written to (a).

**Item 3. The pilot succeeds on four readings and the operator's go.** Ruled: the test as recommended, 2026-09-25; the go for sections 3 to 12 is recorded here with its date when the operator gives it.

- Situation. The doctrine at 11,645 words and its two pinned copies are section 2. Sections 3 to 12 must not fan out on a pilot that cut words and lost meaning, or that flagged the wrong claims.
- Decision. What "the pilot succeeded" means.
- Stakes. A weak test fans out a bad recipe over 48 documents; a test the operator cannot read from a phone stalls the plan.
- Options. (a) Four readings plus the go. The doctrine lands at or under 5,823 words. Every ruled probe pair on the doctrine's moments matches before and after, the designed mismatches standing. The operator reads the compressed doctrine whole and rules every flagged entry. The section's Chapter records two counts: flagged entries the operator ruled `keep` unchanged, and unflagged entries the operator disagreed with; where the second exceeds the first the flagging rule in the section recipe is retuned before fan-out. Then the operator says "go". (Recommended.) The counts are what tell whether the flags carried the review. (b) Word count and green gate only. Cost: no reading of whether the flags worked. (c) The operator reads the doctrine and says go, with no counts. Cost: the fan-out inherits a flagging rule nobody measured.
- Unanswered: section 2 still runs; the fan-out stays parked.

**Item 4. Behaviour is read by a probe pair per moment, priced at about forty cents a pair, never by a rep per claim.** Ruled: as recommended, 2026-09-25.

- Situation. 1,156 ledger entries carry `baseline-test: yes`. The writing-skills skill already says that in the kit repository a ruled probe's before-and-after pair stands in for the RED and GREEN reps, and the corpus rewrite's ruling batch 4 waived the documents no probe names to the review pairs and keep re-reads. `test/probes/` holds 15 probes today, read as 39 shapes, whose whole-set run reads as about 35 to 39 pairs; a pair cost about forty cents on the run recorded 2026-09-07, so a whole-set run is about $16. Eleven of the fifteen probes name the doctrine's skill mirror, none names the home copy, so the doctrine's reading runs on the mirror.
- Decision. Whether the probe pair per moment is the testing unit for this pass, with new probes written under a per-section cap.
- Stakes. The cost is the operator's stated concern. A per-claim rep set over 1,156 entries at several reps and two legs is on the order of a thousand paid reads, inferred from the pair price; the probe route is a few pairs per section.
- Options. (a) Probe pair per moment. Each section maps its flagged entries to moments, reuses a probe where one exists, writes at most its new-probe cap, runs the two legs once at its close, and waives the rest by name. Whole-run cost after the extension is inferred at about 47 probes, about 110 pairs, about $45; a section's two legs are inferred at $2 to $10. A new probe is `proposed` until the operator rules it in the section's flagged batch. (Recommended.) (b) Per-claim reps. Cost: the order-of-magnitude figure above. (c) No behaviour reading. Cost: a wording change that moves a ruled answer is found by an incident rather than a pair.
- Unanswered: the plan stays parked; the sections are written to (a).

**Item 5. The bake-off in section 2 decides the drafting model for sections 3 to 11, and the operator names the winner.** Ruled: the bake-off decides, 2026-09-25; the winner is named here from the pilot's pull request and holds sections 3 to 12 until then.

- Situation. Two candidates, each under the pacing cap: (a) Opus at medium effort, which the operator reports at benchmark parity with Fable, strong on prose and up to 40 percent cheaper in tokens (reported through the assistant persona, unverified); (b) Fable at low effort, the configuration that ran cleanly in earlier fan-outs. The assistant persona leans (a) and runs on Opus; the architect persona runs on Fable; neither lean is evidence.
- Decision. Which configuration drafts the fan-out.
- Stakes. The drafting model runs 48 documents; a wrong pick costs meaning or meter across all of them.
- Mechanism, declared. Section 2 drafts the doctrine's two largest sections, Scope and safety (2,413 words) and Verify before you claim (1,184), under both configurations, four dispatches in sequence under the cap. The prose reviewer reads the four drafts blind to authorship and ranks them. The main thread reads each draft's meaning against the ledger reasons and counts claims lost. The capacity reader is run before and after each configuration's wave and the Fable and five-hour meter deltas are recorded. The winner then drafts the rest of the doctrine, reusing its two winning drafts, so the bake-off costs two extra drafts rather than a doubled pilot.
- Options. (a) Opus at medium. Fable's weekly meter is its own, so an Opus drafter leaves it for the Fable-low reviews. (b) Fable at low. Proven pacing. Neither is recommended ahead of the data; the pull request body carries the three readings and the operator names the winner there.
- Unanswered: sections 3 to 12 stay parked.

**Item 6. The post-rewrite program's step 4 is folded into this plan and closed by it.** Ruled: as recommended, 2026-09-25.

- Situation. The post-rewrite program's step 4, the shared read-and-intent review, is unwritten. Its test, ruled 2026-09-18, is one per doctrine bullet: what moment does it fire at and which skill owns it; where a skill owns the moment the bullet becomes a pointer or moves, and what stays is principle. Its gate is that every section and skill in scope carries a recorded read.
- Decision. Whether section 2 runs the per-bullet test as part of compressing the doctrine, and every later section's `ruled:` lines stand as the operator's recorded read of that document, closing step 4.
- Stakes. Separate, the doctrine is redrafted twice and the operator reads every document twice.
- Options. (a) Fold it in: section 2's Chapter carries the per-bullet read, every section's ruled entries are the read, and section 12 records step 4 closed in the program document. (Recommended.) (b) Keep step 4 separate, after this plan. Cost: a second doctrine pass and a second whole read of 49 documents. (c) Run step 4 first. Cost: this plan waits on a plan not yet written.
- Unanswered: the plan stays parked; the sections are written to (a).

**Item 7. After the pass, the corpus total carries a hard cap that only an operator ruling raises.** Ruled: option (a), 2026-09-25, with the operator's reservation recorded: the cap is not there to block a useful increase to the doctrine, it is there so an increase is verified as necessary before it lands. So a raise ask names the rule the growth adds, the moment it owns, and why no existing rule carries it, and section 12 writes that shape into the raise protocol.

- Situation. The corpus rewrite landed 175,123 words on 2026-09-13. At `57a7c754` on 2026-09-25 the same 49 documents hold 193,762, a regrowth of 18,639 words in twelve days under the lean kit program's decision 1, which declares growth per file and never refuses it.
- Decision. Whether the close installs a corpus-level cap in the size tool and the ratchet that fails the whole gate when the 49 documents' sum exceeds it, raised only by a ruling the operator records.
- Stakes. Without a brake, half the cut can regrow within a month at the measured rate. With one, a plan that must add rule text carries a one-line ask to raise the cap, which is the shape decision 1 already gives a miss.
- Options. (a) Install the corpus cap at the landed sum; per-file caps keep moving as declared; a raise of the corpus cap is an operator ruling recorded on the backlog item that carries it. (Recommended.) (b) No corpus cap. Cost: the measured regrowth. (c) Hard per-file caps. Cost: contradicts decision 1 and turns every declared raise into an ask.
- Unanswered: the plan stays parked; section 12 is written to (a).

**Declared under routes (a) and (b), reversible by one word.** The Failed approaches field is added to the Chapter template (the operator leaned yes; "drop the field" reverses it, and section 3 then lands without it). The stale figures in the relayed request are corrected here rather than asked about: the corpus is 193,762 words today rather than 221,245, which was the pre-rewrite count, and the size ratchet raises a cap through `kit-size.js sync` as readily as it lowers one, so it is a ledger rather than a one-way brake, which is why item 7 exists. The three Supreme review items are taken as the assistant persona relayed them: the Supreme review is the operator's read of the kit against the `Utkarsh-X/Supreme` repository on GitHub, and its other items are out of scope. The pacing rule and the read-only drafter design are the second and third amendments' hard requirements, not asked.

**Evidence.**
- Corpus size: `test/size-budget.json` at `57a7c754`, summed over the 49 non-ledger, non-test paths (193,762), `home/CLAUDE.md` among them at 121 words; the rewrite's landing in `docs/plans/claude-kit_lean-kit_program_v1.md`, Log, 2026-09-13 (175,123).
- Ledger counts: `plugins/claude-kit/skills/*/references/rationale-ledger.md`, 7,022 entries; verdicts 4,047 keep, 1,140 rewrite, 1,835 retire; 1,156 entries carrying `baseline-test: yes`; 349 `passage:` lines; the entry-format paragraph in each ledger's preamble, held identical by `test/ledger-preamble-parity.test.js` with the executing-work ledger as source.
- Probe unit: `plugins/claude-kit/skills/writing-skills/SKILL.md`, "Know it works before you trust it", the paragraph opening "In the kit's own repository, where the probe set lives", which states the two legs; `tools/probe-corpus/README.md`, the paragraph naming forty cents a pair; `test/probes/` (15 probes, 11 naming `plugins/claude-kit/skills/operating-instructions/SKILL.md`, 0 naming `home/`).
- Pacing: the operator memory `fan-out-runs-through-workflow-under-a-session-wide-cap` (2026-09-11: Workflow only, model and effort per call, three Fable and five agents open); `workflow-parallel-caps-at-two` (the harness's own `parallel()` cap of `min(16, CPUs - 2)`); `plugins/claude-kit/hooks/capacity-read.js` (the meter line).
- Prior rule and its override: `docs/archive/claude-kit_corpus-rewrite_spec_v1.md`, Goal ("leaving each keep verdict's wording whole"); `docs/backlog.md`, the item opening "The corpus rewrite's four operator decision batches", which holds ruling 1 (one true text across the implementer charters), batch 4 (the waiver), ruling 25 (the ledger tidy) and ruling 26 (the lesson-landing rule).
- Step 4: `docs/plans/claude-kit_post-rewrite_program_v1.md`, Steps, "Step 4. The shared read-and-intent review."
- Lean definition and growth rule: `docs/plans/claude-kit_lean-kit_program_v1.md`, Decisions 1, 2, 3, 6.
- Cross-file pins: `test/doctrine-parity.test.js` pins one sentence across files different sections own (the absence-check clause on executing-work, the adversarial and prose reviewers; the install-surface condition on the doctrine, `README.md`, `docs/README.md` and `docs/architecture.md`; the sync-allowlist sentence across `docs/*.md`; the implementer charters' byte-identical Tests duty), which is why the shared-sentence rule under Approach exists.
- The stale-cap rule the corpus cap must respect: `plugins/claude-kit/scripts/kit-size.js`, the comment "a cap no measured file and no untracked file answers to is the stale entry", pinned by `test/size-ratchet.test.js`.
- The BLOCKED status the classify-first step generalizes: `plugins/claude-kit/agents/implementer-fable.md`, the `BLOCKED` bullet, and its three siblings.

## Approach

One recipe, applied per document, one document per pull request. The recipe is stated once here and each section names only what differs.

**The section recipe.**

1. Read the document whole and its ledger heading whole. Read the lean kit program's decision 3 for what lean is: one idea a sentence, about twenty words, a rule and its bound as two sentences, one example only where the rule cannot be stated without it.
2. Before drafting, write the moment map to `.kit/scratch/corpus-compression/<doc>-moments.md`: every `baseline-test: yes` entry under the heading, the moment it turns on, and the probe that covers it or `none`. Write new probes for uncovered moments up to the section's new-probe cap, choosing the moments the most entries turn on; the rest are waived by name. A new probe follows `test/probes/README.md` and lands `proposed` with its cap entry.
3. Dispatch the drafter through the script. The drafter is read-only: it returns the proposed document text and the proposed ledger lines. For each live entry it writes the shortest clear wording that keeps the meaning the reason states. It merges claims whose meanings the ledger already says are one rule stated twice, proposing retire on the absorbed entry with a reason naming the survivor. Where a rule's owner is another document per the ownership map, the sentence becomes a pointer at the owner's own text. Journey text leaves for the ledger under the doctrine's state-versus-journey rule. The main thread reads the returned text against the ledger heading before writing any of it.
4. Write the document and the ledger heading in one commit: each live entry's `passage:` line quotes the landed text verbatim; each entry whose reason the drafter judged weak, stale or unfounded carries `flag:` from the closed set. A ledger citation into a test or sibling names the target's own text, per the preamble.
5. Re-pin in that same commit: any test that asserts the sentence's text is re-pinned to the landed sentence, and every carrier a parity pin ties to that sentence lands the same sentence, whatever section owns the carrier's file. The parity copies (the doctrine mirror, the output style's core region) are regenerated byte for byte from the landed source, never edited.
6. At the section's close: move the caps with `node plugins/claude-kit/scripts/kit-size.js sync --repo . <the document, its ledger, its new probes, any carrier touched>`, write the heading's landing line naming the document's commit, run the two probe legs and the targeted lane, and record all of it in the Chapter. The cap sync and the landing line ride the section's close commit, the one commit that touches no document.
7. The pull request body lists the flagged entries by id, flag and one line of why, then the target and landing, then both runner summary lines, then the meter deltas. The operator rules on the entries before the pull request is marked ready; a `cut` or `amend` ruling is applied in a fix commit on the same branch.

**The commit unit is the document.** One document per commit, with its ledger heading, its re-pinned tests and the carriers a pin ties to it riding in that commit, since the parity suite reds any intermediate state where a pinned sentence and its copy differ. The operator reads history per document.

**The shared-sentence rule.** Where a parity pin ties one sentence across files that different sections own, the first section to compress that sentence lands the compressed form on every carrier the pin names in the same commit, the carrier's owning section leaves that sentence as landed, and both Chapters name the crossing. A carrier under `README.md`, `docs/README.md` or `docs/architecture.md` is in scope for that sentence alone.

**Where the words go.** A rule keeps its imperative sentence and its bound. It loses its rationale (to the ledger), its second and third example, its restatement of another owner's rule, its history, and its defensive clauses that name a case the rule's own words already cover. A first example stays only where the rule cannot be stated without it. The doctrine's per-bullet moment test (item 6) is the one structural move beyond that: a bullet whose moment a skill owns becomes one pointer sentence.

**The flagging rule.** A reason is `weak-reason` where it names no artifact a reader can open; the ledgers cite commits, incidents, memories, kaizen notes, tests, plans and Chapters, and the class is any artifact the repository or the memory store holds. It is `stale` where the named artifact no longer says what the reason says. It is `unfounded` where the named artifact cannot be found. The drafter never flags on taste. Section 2's Chapter measures the rule (item 3) and the fan-out inherits the retuned form if one is needed.

**The review ladder.** Round 1 runs the section's two reviewers at Fable low, the writer's tier where the winner is Fable and one tier above it where the winner is Opus, which is decision 6's ceiling in both cases; later rounds run one reviewer at Fable low. The prose reviewer joins round 1 on every section, since the deliverable is prose.

**Expected usage for the pilot wave, inferred, for the operator to compare with the meters.** Section 2 dispatches: four bake-off drafts, one blind prose review over the four, one whole-doctrine draft, two round-1 reviewers, and up to two fix-round reviewers, ten dispatches at most, never more than three open. Each drafter reads the doctrine (about 16,000 tokens) and its ledger heading (about 56,000 tokens) and returns about 8,000; each reviewer reads about the same. The wave is inferred at about 800,000 input tokens and 60,000 output tokens across the ten, split between the two configurations as the bake-off records. The probe legs are paid separately through the headless reader: 11 probes name the doctrine mirror, about 25 pairs, inferred at $10. The Chapter records the capacity reader's line before and after each wave so the inference is corrected by the meters.

**Surfaces swept for the contract.** The sweep for surfaces speaking the rules this plan touches is the corpus audit's own inventory, since every document here was reduced to claims and every claim carries its owner: the 49 documents in `test/size-budget.json`, the 23 ledgers, the six pin tests named under Acceptance, the probe set and its runner, the two program documents, `docs/rationale-ledgers.md`, and the README and `docs/` carriers the parity pins name. No new surface is expected; a section that finds one routes it under executing-work's out-of-scope route.

## Sections of Work

### 1. The dispatch script, its pin and the read-only drafter charter
Model: opus
Locus: inline
Files in scope: `tools/corpus-compression/workflow.mjs` (new), `tools/corpus-compression/README.md` (new), `test/corpus-compression-workflow.test.js` (new), `plugins/claude-kit/agents/corpus-drafter.md` (new, read-only tools `Read, Grep, Glob, Bash`, `effort: low`, no model pin), `test/readonly-agent-guard.test.js` (the new charter joins the read-only set), `test/size-budget.json`.
Tests: the workflow test reads the script's source and fails where any `agent()` call lacks both a `model:` and an `effort:` literal, where `MAX_OPEN` is absent or above five, or where a section's wave starts before the previous wave's promise settles (a dry run over a stub `agent` that records start and end order); the guard test admits the drafter charter as read-only.

The script exports the constants named under Dispatch Authorization and one function per wave: `draftWave(section)` dispatches the drafter and returns its text, `reviewWave(section, round)` dispatches the reviewers under a pool of `MAX_OPEN`, and `run(sections)` runs them in order with `pipeline`. It skips a wave whose artifact is already on disk, so a stop on the five-hour limit resumes from disk. The charter is declared growth of about 300 words under decision 1 and carries the section recipe's drafter duties and nothing else. Inline, because the script is small and evolves in contact with the Workflow API. Target: none; new files take their first caps.

### 2. The pilot: the doctrine, its two pinned copies and `home/CLAUDE.md`, with the bake-off, the per-bullet moment test and the Before-you-send line
Model: fable
Files in scope: `home/claude-kit-doctrine.md`, `plugins/claude-kit/skills/operating-instructions/SKILL.md`, `plugins/claude-kit/output-styles/kit.md` (core region and Before-you-send segment), `home/CLAUDE.md`, every `plugins/claude-kit/skills/*/references/rationale-ledger.md` (the doctrine heading in the operating-instructions ledger; the preamble paragraph in all 23), `test/doctrine-parity.test.js`, `test/output-style-parity.test.js`, `test/ledger-preamble-parity.test.js`, `README.md`, `docs/README.md`, `docs/architecture.md` (the install-surface sentence and any other carrier a pin ties to a doctrine sentence), `test/size-budget.json`, `test/probes/` (up to six new probes), `docs/rationale-ledgers.md` (the entry-line vocabulary).
Tests: the parity tests hold byte-identity and re-pin their bullet-content assertions to the landed sentences; each pin that guards a grant (the standing-dispatch bullet keeps the Workflow grant; the authorization bullet keeps its default, its override set and its bounds) is shown red on the base text with the grant removed and green on the landed text; `test/probe-set.test.js` accepts each new probe; the preamble pin is green across all 23 ledgers.

`Model: fable` names the review and the bake-off's Fable arm; the doctrine's drafting model is the bake-off winner. The recipe, with four additions. First, the bake-off under item 5, run before the whole-doctrine draft. Second, the per-bullet moment test: for each doctrine bullet, the Chapter records the moment it fires at and the skill that owns that moment per the ownership map; a bullet a skill owns becomes one pointer sentence or moves into that skill's section of this plan, recorded on the moment map so the owning section lands it; what stays is principle. Third, the Before-you-send list gains one line, "If this were falsely claiming to be complete, what would I have overlooked?", in all three copies at once. Fourth, the ledger preamble gains one dated authoring paragraph stating item 0's ruling, the `flag:` and `ruled:` lines with their closed sets, and that these bind every entry the pass touches; it lands in all 23 ledgers in one commit under the preamble pin, the executing-work ledger as source. `home/CLAUDE.md` is 121 words that include the doctrine; it is read, and its target is its cap. Targets: 5,823 words for the doctrine, its mirror identical; `kit.md`'s target is its cap less the words its core region loses, read at the close.

### 3. executing-work, with the Failed approaches Chapter field
Model: fable
Files in scope: `plugins/claude-kit/skills/executing-work/SKILL.md`, its ledger heading, `test/doctrine-parity.test.js`, the carriers its pins tie (`plugins/claude-kit/agents/adversarial-reviewer.md` and `prose-reviewer.md` for the absence-check clause, under the shared-sentence rule), `test/size-budget.json`, `test/probes/` (up to four).
Tests: the Chapter-template pin admits the new field; the gate-field pin still passes.

`Model: fable` names the review tier; the drafter is the bake-off winner, here and in every section below. The recipe. The Chapter format gains a `Failed approaches:` field written as "tried X, failed because Y, learned Z", with "none" acceptable, placed after `Decisions / Surprises`; declared growth of about twenty words. Target: 13,666 words. The moment map takes any doctrine bullet section 2 moved here.

### 4. finishing-work
Model: fable
Files in scope: `plugins/claude-kit/skills/finishing-work/SKILL.md`, its ledger heading, `test/doctrine-parity.test.js`, the carriers its pins tie, `test/size-budget.json`, `test/probes/` (up to four).

The recipe. Target: 8,616 words.

### 5. coordinator
Model: fable
Files in scope: `plugins/claude-kit/skills/coordinator/SKILL.md`, its ledger heading, `test/doctrine-parity.test.js`, the carriers its pins tie, `test/size-budget.json`, `test/probes/` (up to four).

The recipe. Target: 9,081 words.

### 6. memory-system
Model: fable
Files in scope: `plugins/claude-kit/skills/memory-system/SKILL.md`, its ledger heading, `test/doctrine-parity.test.js`, the carriers its pins tie (the sync-allowlist sentence across `docs/*.md`), `test/size-budget.json`, `test/probes/` (up to four).

The recipe. Mechanics the `memq` command performs and prints are pointers at the command's own output. Target: 8,776 words.

### 7. peer-sessions and role
Model: fable
Files in scope: `plugins/claude-kit/skills/peer-sessions/SKILL.md`, `plugins/claude-kit/skills/role/SKILL.md`, their ledger headings, `test/doctrine-parity.test.js`, the carriers their pins tie, `test/size-budget.json`, `test/probes/` (up to two).

The recipe, one commit per document, one pull request. Targets: 5,325 and 2,462 words.

### 8. The mid-size skills
Model: fable
Files in scope: the `SKILL.md` of `brainstorming`, `standing-watch`, `testing-discipline`, `curating-docs`, `writing-skills`, `kit-goal`, `responding-to-review`, `kaizen`, `kit-doctor`, their ledger headings, `test/doctrine-parity.test.js`, the carriers their pins tie, `test/size-budget.json`, `test/probes/` (up to two).

The recipe, one commit per document, one pull request. The curating-docs machine-contract table keeps every row's exact shape and value rule, since an external parser reads it; its prose around the table takes the recipe. Targets: half of each cap at arming.

### 9. The small skills, with the classify-first debugging step and the four charters' pointer at it
Model: fable
Files in scope: the `SKILL.md` of `systematic-debugging`, `consult`, `design-council`, `branch-hygiene`, `prose-register`, `csharp-style`, `sql-style`, their ledger headings, the four `plugins/claude-kit/agents/implementer-*.md` (the `BLOCKED` bullet only, under the shared-sentence rule), `test/doctrine-parity.test.js`, `test/size-budget.json`, `test/probes/` (up to two; the existing `debugging-dead-end-after-two-failed-fixes` probe covers the escalation rule).

The recipe, one commit per document, one pull request. systematic-debugging gains a classify-first step before Phase 1: sort the failure into one of five bins, code, environment, tool, external service or unknown, and never change working code to route around an environment problem; declared growth of about forty words. The four implementer charters' `BLOCKED` bullet then points at that step as the owner, landed in this section's commit for those four files under the shared-sentence rule, byte-identical across the four. Targets: half of each cap at arming plus the declaration.

### 10. The seventeen agent charters
Model: fable
Files in scope: every file under `plugins/claude-kit/agents/` except `corpus-drafter.md`, their ledger headings, `test/doctrine-parity.test.js`, `test/readonly-agent-guard.test.js` where a charter's tool list is pinned, `test/size-budget.json`, `test/probes/` (up to two).

The recipe, one commit per document, one pull request. The four implementer charters carry one true text with the tier's own substitutions, per the corpus rewrite's ruling 1, and their byte-identical Tests duty between markers stays identical; the `BLOCKED` bullet is as section 9 landed it. The whole frontmatter block of every charter is a machine contract and is not compressed. Targets: half of each cap at arming.

### 11. The six references
Model: fable
Files in scope: `operating-instructions/references/ownership-map.md`, `curating-docs/references/templates.md`, `prose-register/references/ai-tells.md`, `prose-register/references/voice-scott.md`, `csharp-style/references/csharp-style.md`, `sql-style/references/sql-style.md`, their ledger headings, `test/doctrine-parity.test.js`, `test/size-budget.json`.

The recipe, one commit per document, one pull request. The ownership map's rows keep owner and pointer columns whole and compress the moment column's prose; the templates keep every machine-contract line. Targets: half of each cap at arming.

### 12. The close: the corpus cap, the program records and the backlog
Model: sonnet
Files in scope: `plugins/claude-kit/scripts/kit-size.js` (a corpus cap read from a `corpus-cap` key the tool recognizes rather than reports stale), `test/size-budget.json`, `test/size-ratchet.test.js` (the sum check), `docs/architecture.md` (the size-ratchet paragraph), `docs/plans/claude-kit_post-rewrite_program_v1.md` (step 4 closed, Log entry), `docs/plans/claude-kit_lean-kit_program_v1.md` (Log entry), `docs/backlog.md`, `docs/rationale-ledgers.md` (entry count, the new lines, and the `passage:` field's not-backfilled sentence rewritten to say this pass backfilled it).
Tests: the ratchet's sum check fails on a fixture whose measured documents exceed the corpus cap, passes at it, and reports the `corpus-cap` key as a cap rather than a stale entry.

Read the 49 caps' sum with the size tool, record it and the misses, install the corpus cap at the landed sum, and write the two program Log entries and step 4's close, naming the per-bullet doctrine read and the per-document ruled entries as the recorded reads. Backlog gains two items: the ledger prose pass (item 2's option c) and the regrowth reading with the corpus cap's raise protocol. The protocol is one ask per raise, and the ask names the rule the growth adds, the moment it owns, why no existing rule carries it, and the word count, so a raise is verified as necessary before the operator rules on it; a raise ruled lands as a `kit-size.js sync` of the `corpus-cap` key in the same commit as the rule.

## Out of Scope

- The ledgers' own prose (item 2). A later plan.
- `docs/` root documents and READMEs, except a sentence a parity pin ties to a compressed sentence, which the shared-sentence rule brings in for that sentence alone; the plan-doc templates' machine-contract lines; hook and script code, except `kit-size.js` for the corpus cap in section 12 and the new script in section 1; and the tests' logic beyond re-pins and the two new tests.
- Any rule's retirement on taste. A rule leaves only where the ledger's reason says another entry carries its meaning.
- The kaizen inbox and the post-rewrite triage plan, which run on their own.
- The Supreme review's other items beyond the three the operator approved.
- Any dispatch through the Agent tool, and any dispatch above low effort.

## Assumptions

- Assumed 2026-09-25 (route a, from the writing-skills skill's probe-pair paragraph and ruling batch 4): a ruled probe pair stands in for the RED and GREEN reps; an uncovered moment past the section's new-probe cap is waived by name rather than rep-tested. Reversal: "reps on waived moments", which prices at the figure item 4 states.
- Assumed 2026-09-25 (route b, reversible): the per-section new-probe caps are section 2: 6; sections 3 to 6: 4 each; sections 7 to 10: 2 each; sections 1, 11 and 12: none. Reversal: name a different cap on the section.
- Assumed 2026-09-25 (route b): the operator's rulings on entries land on a `ruled:` line with the closed set keep, cut, amend. Reversal: name another vocabulary and section 2 rewrites the preamble paragraph.
- Assumed 2026-09-25 (route a, from the lean kit program's decision 1): the classify-first step, the Failed approaches field and the drafter charter are declared growth, about forty, twenty and three hundred words, carried on the section's target. Reversal: none needed; the declaration is the rule.
- Assumed 2026-09-25 (route b): sections 7 to 11 group documents into one pull request each with one commit per document, since the operator asked for isolated commits per file and reads pull requests; a per-document pull request over 48 documents is the reversal, at the cost of 48 review rounds.
- Assumed 2026-09-25 (route b): the three Supreme items and the two amendments are taken as the assistant persona relayed them. Reversal: the operator names a different wording in the section's pull request.
- Assumed 2026-09-25 (route b): the expected-usage figures under Approach are inferences from document sizes and dispatch counts; the meters the Chapter records are the measurement.
- The spec review chain for this plan: recorded in the handoff recap the architect persona sends.

## Related

- `docs/archive/claude-kit_corpus-rewrite_spec_v1.md`, the 18 percent pass this one supersedes in rule (keep protects meaning here, wording there).
- `docs/archive/claude-kit_prose-pass_spec_v1.md`, the sentence-shape pass whose probe readings and section shape this plan reuses.
- `docs/plans/claude-kit_post-rewrite_program_v1.md`, whose step 4 this plan closes under item 6.
- `docs/plans/claude-kit_lean-kit_program_v1.md`, whose decisions 1, 2, 3 and 6 bind every section.

## Chapters
