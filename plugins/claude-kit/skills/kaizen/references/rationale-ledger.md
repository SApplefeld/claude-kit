# Rationale ledger: kaizen

This file is the rationale ledger for the documents the `kaizen` skill owns. Rule text says what happens; this ledger says why; git says when. Nobody loads it by default. A session about to change a rule in one of the documents below reads the entry for the claim it is changing first, so the reason a rule holds is not re-litigated at the next review.

Each document sits under its own heading, which opens with its inventory line (what the document is for, which moments it owns, and when a session loads it) and then carries one entry per claim, retired claims included so the next audit does not re-find them. An entry is keyed by the claim's imperative sentence and carries its class (rule, mechanic, pointer, or rationale-example), its source as file and line, its provenance (the commit, incident, memory or kaizen note that installed it, or `no provenance found`), and its verdict (keep, rewrite, or retire) with the reason. A `C` entry's source line is read at the extraction commit `6bc07fb`; an `R` entry is a claim re-extracted from a hunk the Section 5 merge changed, and its source line is read at the merged commit `d9540ad`. Claim numbers restart under every document heading, and inside a document read in chunks they restart per chunk, so an entry id is unique only under its heading and a chunked document carries the chunk in the id (`c2.C001` is claim C001 of the second chunk); a claim named inside a reason or provenance line of such a document carries the same prefix. A `C` entry whose source hunk the Section 5 merge rewrote reads `retire` and carries a `superseded-by:` line naming the `R` entry that holds the passage at the merged commit; the passage's own verdict is that entry's, so a count of retirements over this ledger leaves those records out. A reason may name the form the judge ruled toward (a pointer at the owner, a split, a fold into a neighbour), because that form is why the verdict is rewrite rather than keep or retire; what a passage becomes is the rewrite plan's to decide, and where the two differ the rewrite plan governs. The target wording a judge proposed is recorded in the corpus audit plan's scratch adjudication log (the plan is `claude-kit_corpus-audit_spec_v1.md` under `docs/`), which is that plan's transient scratch: its rewrite section consumes the log, and the rewrite plan it writes under `docs/plans/` is the durable home of any target wording once written. The baseline-test flag on a behavior-shaping rewrite rides in the entry's reason line.

## plugins/claude-kit/skills/kaizen/SKILL.md

This document is the kit's self-improvement skill: it governs how friction with the kit itself is captured as one-line notes and how a "kaizen pass" turns those notes into briefs, direct fixes, promoted specs, routed learnings, or parked backlog items. It owns four moments: capturing a friction note into the kit repo's inbox (including the note's commit and push, its gate exemption, and the public-board cap on its wording); running a pass, whether by an operator's attended request or by the standing adjudication authority the machine-coordinator and kit-expert seats hold; writing and applying briefs, including the clearing and reconciliation of dispositioned note lines and the gate that precedes the push; and offering a pass, gated on the pending-items predicate. Load class: `named-trigger` - the frontmatter says to load it when running a kaizen pass, when accepting an end-of-effort or session-start offer to reflect, or when applying a pending brief, and it says explicitly that jotting a single note does not need the skill.

Extracted at `6bc07fb`: whole document (`skills.kaizen.SKILL.md`).

### C001
- key: Load this skill when running a kaizen pass, accepting a reflect offer, or applying a pending kaizen brief.
- class: rule
- source: plugins/claude-kit/skills/kaizen/SKILL.md:3
- provenance: 830ff28 2026-06-17, the port that created the kaizen skill; the frontmatter's load triggers and its not-for-capture bound were written together.
- verdict: keep
- reason: The frontmatter is what the harness shows at load time, so it is the surface that keeps a note from loading the skill; the body's duplicate (C022) retires and this bound carries the exclusion alone.

### C002
- key: Run a kaizen pass only when there is captured friction to discuss.
- class: rule
- source: plugins/claude-kit/skills/kaizen/SKILL.md:8
- provenance: 830ff28 2026-06-17, the port that created the skill; the sentence is the loop's design statement, with no incident behind it.
- verdict: keep
- reason: It bounds the session's initiative (no offer, no nudge, no self-started pass on an empty inbox) and does not bar the operator's explicit start (C075), which ranks above skill text; a pass the operator starts gathers session and operator friction at step 1, so the two are not in conflict.

### C003
- key: Keep kaizen notes and briefs inside the kit's working clone so git syncs and combines them across machines.
- class: mechanic
- source: plugins/claude-kit/skills/kaizen/SKILL.md:12
- provenance: 830ff28 2026-06-17 installed the inbox-in-repo design; a8770b3 2026-06-28 only reworded the voice.
- verdict: keep
- reason: Git is the sync but nothing enforces the location; the session-start counter reads `kaizen/` under the kit repo and a note written elsewhere (the 1c8ae4e misroute) is silently lost, so the convention stays stated.

### C004
- key: Write notes to `kaizen/notes-<machine>.md`, append-only, one line per note carrying date, machine, repo, and the friction.
- class: mechanic
- source: plugins/claude-kit/skills/kaizen/SKILL.md:14
- provenance: 830ff28 2026-06-17; the single-form field list predates the long note form `kaizen/README.md` admitted in the 2026-09-02 pass.
- verdict: rewrite
- reason: The file's identity and append-only shape hold, but the one-line field list is stale against `kaizen/README.md`, which states two valid forms a pass reads; the line keeps the file and points at the README for the forms, and the destination with its hostname resolution stays at line 23 (C024) where a capturing session acts on it.

### C005
- key: Use per-machine note files because they let several workstations push notes with zero merge conflicts and a pull merges them automatically.
- class: rationale-example
- source: plugins/claude-kit/skills/kaizen/SKILL.md:14
- provenance: 830ff28 2026-06-17; design rationale for the per-machine layout, no incident.
- verdict: retire
- reason: The why now lives here and in `kaizen/README.md`: one file per machine means concurrent pushes never conflict and a pull merges them. Deleting the sentence reddens the INTEGRATION_EXEMPT anchor `Per-machine files mean three workstations` at test/doctrine-parity.test.js:5464, so that entry is re-anchored or removed in the same commit.

### C006
- key: Put one file per reflect-pass brief in `kaizen/briefs/`.
- class: mechanic
- source: plugins/claude-kit/skills/kaizen/SKILL.md:15
- provenance: 830ff28 2026-06-17, the port that created the skill.
- verdict: keep
- reason: The hook counts files in `kaizen/briefs/` but nothing enforces one file per brief; the convention is the pass author's and the predicate (C007) depends on it.

### C007
- key: Treat "pending items" as true when any `kaizen/notes-*.md` has note lines or `kaizen/briefs/` holds a file.
- class: mechanic
- source: plugins/claude-kit/skills/kaizen/SKILL.md:17
- provenance: 830ff28 2026-06-17, installed with the kit-repo kaizen nudge in the same commit.
- verdict: keep
- reason: The nudge evaluates the predicate in code (`hooks/session-start.js` `countPendingKaizen`, pinned by test/session-start-kaizen.test.js), but the finishing-work offer applies it by judgment, so the definition stays in prose for the consumer no program runs.

### C008
- key: Capture manually: when you notice the kit got in the way, append a one-line note and carry on.
- class: rule
- source: plugins/claude-kit/skills/kaizen/SKILL.md:21
- provenance: 830ff28 2026-06-17 installed manual capture ("propose a note, on my nod append it"); c606b62 2026-08-29 retired the nod on the operator's standing grant, recorded verbatim in the operator memory `kaizen-standing-grant`.
- verdict: keep
- reason: Kaizen owns the capture rule whole and the doctrine bullet is its copy at the moment the skill is not loaded; the paragraph is split into three under A016 with no rule dropped, and this sentence stands as written.

### C009
- key: Append a capture note without seeking approval or routing through any seat.
- class: rule
- source: plugins/claude-kit/skills/kaizen/SKILL.md:21
- provenance: c606b62 2026-08-29, the operator's standing grant of 2026-08-29 ("you are always welcome to jot any Kaizens and commit/push them"), replacing fb0f194's coordinator-only routing leg.
- verdict: keep
- reason: The grant is an authority, not a timing rule; the recap skill's suspension of the append for a recap's duration is the moment-owner's rule and the note lands after the report, so no conflict is real. The seated-or-not bound and the no-routing clause are the grant's edges and stay verbatim.

### C010
- key: In the kit clone, commit and push the note with the note file alone staged so the inbox syncs across machines immediately.
- class: rule
- source: plugins/claude-kit/skills/kaizen/SKILL.md:21
- provenance: c606b62 2026-08-29; the operator's grant covers "commit/push them" by name.
- verdict: keep
- reason: The immediate commit-and-push is the grant's own content, which the doctrine's staging rule does not say; a recap suspends it for the recap's duration only.

### C011
- key: Run no test gate before that note push.
- class: rule
- source: plugins/claude-kit/skills/kaizen/SKILL.md:21
- provenance: cceff11 2026-08-31, Section 7 of the gate-cadence plan, after a reviewer found the kaizen skill carrying three gate-earning actions with no lane named; the exemption was installed on a verified premise and recorded as an adjudicated INTEGRATION_EXEMPT entry.
- verdict: keep
- reason: The doctrine's gate bullet gives way to this one push because the history adjudicated it: the exemption is pinned at test/doctrine-parity.test.js:5467 and holds only while the branch delta is the note commit alone. The exemption lives in a skill the capture moment does not load, which the doctrine's unit should weigh.

### C012
- key: Read the branch delta before pushing with `git log --oneline @{u}..HEAD` or the ahead count `git status -sb` prints.
- class: mechanic
- source: plugins/claude-kit/skills/kaizen/SKILL.md:21
- provenance: 3380bf2 2026-08-31, the gate-cadence close-out, which corrected the exemption's subject from the staging set to the branch delta.
- verdict: keep
- reason: The read is the check the parity exemption entry says the paragraph must state, and nothing runs it for the session.

### C013
- key: Take the no-gate exemption only where the note commit is the whole branch delta.
- class: rule
- source: plugins/claude-kit/skills/kaizen/SKILL.md:21
- provenance: 3380bf2 2026-08-31, same correction as C012.
- verdict: keep
- reason: In the document this is C011's own bounding clause, stated once; the claims list split rule from bound, and C016 is the same condition's other consequence, not a restatement.

### C014
- key: Check the delta rather than the staging set because a push publishes every commit the upstream lacks, not just the one you made.
- class: rationale-example
- source: plugins/claude-kit/skills/kaizen/SKILL.md:21
- provenance: 3380bf2 2026-08-31; the earlier cceff11 wording keyed on the staging set and let a note commit carry unpushed work out under the exemption.
- verdict: keep
- reason: The push-semantics sentence is the boundary of the correction; without it "branch delta, never the staging set" reads as a preference, which is the misreading it fixed.

### C015
- key: A lone note commit changes one appended inbox line no test takes as a subject, and capture runs from a repo holding neither the kit's lanes nor a baseline.
- class: rationale-example
- source: plugins/claude-kit/skills/kaizen/SKILL.md:21
- provenance: cceff11 2026-08-31, the exemption's premise, verified at install (every test touching `kaizen/` builds its own fixture).
- verdict: retire
- reason: The premise is restated in the parity exemption entry and here: the exemption is honest only while no test reads the repo's real inbox and the capturing repo carries no lane over the kit; the day a test reads the real inbox the exemption lapses. The rule is obeyed without the sentence.

### C016
- key: Where the delta carries anything besides the note commit, run the lane that push's own surface earns.
- class: rule
- source: plugins/claude-kit/skills/kaizen/SKILL.md:21
- provenance: cceff11 2026-08-31 installed the narrow scope; 3380bf2 2026-08-31 moved it from the commit's contents to the branch delta.
- verdict: keep
- reason: It is the exemption's negative side and names the lane the other push takes; the integration-verb pin requires the pushing paragraph to name its lane, so deleting it reddens the suite.

### C017
- key: Make a note commit sitting on top of unpushed work wait for the whole gate rather than pushing under the exemption.
- class: rule
- source: plugins/claude-kit/skills/kaizen/SKILL.md:21
- provenance: 3380bf2 2026-08-31, added as the concrete failure shape the staging-set wording let through.
- verdict: keep
- reason: The clause names the case a reader would rationalize around ("my commit is only the note"); it is the correction's own shape and stays with C016.

### C018
- key: Apply the public-board cap to every note, since the inbox is a repository surface that may be public.
- class: rule
- source: plugins/claude-kit/skills/kaizen/SKILL.md:21
- provenance: c606b62 2026-08-29 moved the cap from the message leg to the capture rule.
- verdict: rewrite
- reason: The cap stays at the capture rule, but its footing ("because the inbox is a repository surface that may be public") is the derivation form the parity suite bars at the three pinned cap sites in favour of the standard docs/security-model.md states, so a session could reason the cap away if the repo went private; the rewrite states the cap as that standard.

### C019
- key: Spell any absolute path in a note repo-relative or home-relative.
- class: mechanic
- source: plugins/claude-kit/skills/kaizen/SKILL.md:21
- provenance: c606b62 2026-08-29, with the cap.
- verdict: keep
- reason: The coordinator skill owns the cap and this is the one-clause copy at the point of action, which loads neither coordinator nor recap; nothing screens a note for absolute paths.

### C020
- key: Keep the operator's words off the note artifact.
- class: rule
- source: plugins/claude-kit/skills/kaizen/SKILL.md:21
- provenance: c606b62 2026-08-29, with the cap.
- verdict: rewrite
- reason: The owner's bar covers a paraphrase exactly as a quotation and the kaizen clause leaves paraphrase open; the rewrite states the reach (quoted or paraphrased, ride as a pointer) so the copy matches the owner.

### C021
- key: Take a friction that cannot be stated inside the public-board cap to the operator instead of writing it into the inbox.
- class: rule
- source: plugins/claude-kit/skills/kaizen/SKILL.md:21
- provenance: c606b62 2026-08-29, with the cap.
- verdict: keep
- reason: The escape route is what makes the cap obeyable without losing the friction; no finding touched it and no machinery provides it.

### C022
- key: Do not load this skill to capture a note; the kit doctrine carries the capture bar.
- class: rule
- source: plugins/claude-kit/skills/kaizen/SKILL.md:21
- provenance: 830ff28 2026-06-17, written beside the frontmatter's identical bound.
- verdict: retire
- reason: The frontmatter (C001) states the same exclusion on the surface the harness shows at load time; the body sentence is read only after the skill is loaded and does nothing there.

### C023
- key: Locate the kit clone via the machine-local signpost `~/.claude/claude-kit.local.json`, which records `kitRepoPath`.
- class: mechanic
- source: plugins/claude-kit/skills/kaizen/SKILL.md:23
- provenance: 830ff28 2026-06-17 ("setup: signpost"); 1c8ae4e 2026-07-24 reworded the line when adding the cache prohibition.
- verdict: keep
- reason: The signpost writers are pinned by test/kaizen-signpost.test.js but the read is the session's; without it a capturing session in another repo has no way to the inbox.

### C024
- key: Append the note to `<kitRepoPath>/kaizen/notes-<machine>.md`, where `<machine>` is the hostname.
- class: mechanic
- source: plugins/claude-kit/skills/kaizen/SKILL.md:23
- provenance: 830ff28 2026-06-17.
- verdict: keep
- reason: This is the resolved destination at the point of action; the duplicate identity at line 14 is what C004's rewrite trims, not this line.

### C025
- key: Never write a note into the plugin caches under `~/.claude/plugins/`; only the signpost's `kitRepoPath` and the missing-signpost fallback are valid destinations.
- class: rule
- source: plugins/claude-kit/skills/kaizen/SKILL.md:23
- provenance: 1c8ae4e 2026-07-24, after a note was misrouted to the marketplace clone, a byte-identical copy of the repo.
- verdict: keep
- reason: The incident can recur on any machine with a plugin cache and no hook refuses the write; the reason (the cache is a full copy, so the misroute is invisible until an update deletes it) is what makes the prohibition recognizable.

### C026
- key: If the signpost is missing, write the note to `~/.claude-kaizen/notes-<machine>.md` and say so, so it gets folded in later.
- class: mechanic
- source: plugins/claude-kit/skills/kaizen/SKILL.md:23
- provenance: 830ff28 2026-06-17.
- verdict: keep
- reason: Both the fallback path and the announcement are the session's acts; nothing folds the fallback file in.

### C027
- key: Write a note when a kit rule or skill instruction was ambiguous, contradicted the situation, or let you rationalize around it.
- class: rule
- source: plugins/claude-kit/skills/kaizen/SKILL.md:26
- provenance: 830ff28 2026-06-17, the capture bar.
- verdict: keep
- reason: Kaizen owns the bar and the doctrine copies its first item; "kit rule" is decidable by where the file lives (under the kit plugin root or in the project), which answers the probe on kit-shipped versus project-authored skills.

### C028
- key: Write a note when a workflow step fought the work or added cost without value.
- class: rule
- source: plugins/claude-kit/skills/kaizen/SKILL.md:27
- provenance: 830ff28 2026-06-17, the capture bar.
- verdict: keep
- reason: Owner's whole statement; the doctrine's copy is the pointer form.

### C029
- key: Write a note when you wished for a capability the kit lacks or hit a gap.
- class: rule
- source: plugins/claude-kit/skills/kaizen/SKILL.md:28
- provenance: 830ff28 2026-06-17, the capture bar.
- verdict: keep
- reason: Owner's whole statement; the doctrine's copy is the pointer form.

### C030
- key: Write a note when a review or agent behaved in a way that suggests its prompt needs tuning.
- class: rule
- source: plugins/claude-kit/skills/kaizen/SKILL.md:29
- provenance: 830ff28 2026-06-17, the capture bar.
- verdict: keep
- reason: No finding; the item is the bar's only reach into agent charters and the doctrine does not copy it.

### C031
- key: Do not write a note that only says it went fine or offers general praise.
- class: rule
- source: plugins/claude-kit/skills/kaizen/SKILL.md:32
- provenance: 830ff28 2026-06-17, the capture bar.
- verdict: keep
- reason: No finding; the exclusion keeps the inbox a friction-only signal, which the pending predicate depends on.

### C032
- key: Send a project-specific gotcha to that project's memory tier, not to the kaizen inbox.
- class: rule
- source: plugins/claude-kit/skills/kaizen/SKILL.md:33
- provenance: 830ff28 2026-06-17 installed the exclusion; eb7d29d 2026-08-09 changed the destination from "auto memory" to the project's memory tier after a harness-setting flip made the old wording false.
- verdict: keep
- reason: It bars the write at capture where C054 routes an already-written note at triage; the destination word is the pointer-sized form of memory-system's filing rule and is load-bearing since eb7d29d.

### C033
- key: Do not write a note about a one-off mistake of your own that is not about the kit.
- class: rule
- source: plugins/claude-kit/skills/kaizen/SKILL.md:34
- provenance: 830ff28 2026-06-17, the capture bar.
- verdict: keep
- reason: Owner's whole statement with the "not about the kit" qualifier that makes it decidable; the doctrine's copy is the pointer form.

### C034
- key: State the lesson, not the incident: pitch every note one level more general than the incident that taught it.
- class: rule
- source: plugins/claude-kit/skills/kaizen/SKILL.md:36
- provenance: 6b3cbec 2026-07-26, a relocated lesson given its point-of-action home in the capture rule.
- verdict: rewrite
- reason: The bold lead and the instruction with its evidence-versus-note gloss stay; only the burn metaphor (C035) leaves. The doctrine's prose bar (concrete words) and this rule (general lesson) are two axes a note satisfies at once, as the 2026-09-02 triage record's note leads show.

### C035
- key: One burn should teach you "hot," not "that stove."
- class: rationale-example
- source: plugins/claude-kit/skills/kaizen/SKILL.md:36
- provenance: 6b3cbec 2026-07-26, with the rule.
- verdict: retire
- reason: The rule is stated literally in the same paragraph; the metaphor adds no condition a session needs and the doctrine's copy of the rule never carried it.

### C036
- key: Leave out any note you have to talk yourself into; zero notes in a session is normal.
- class: rule
- source: plugins/claude-kit/skills/kaizen/SKILL.md:38
- provenance: 830ff28 2026-06-17, the capture bar.
- verdict: keep
- reason: Owner's whole statement with the decidable test; the doctrine's copy is the pointer form.

### C037
- key: The machine-coordinator seat and the kit repo's expert seat may disposition the inbox at any time under the operator's standing authority, with no per-note operator round.
- class: rule
- source: plugins/claude-kit/skills/kaizen/SKILL.md:42
- provenance: c606b62 2026-08-29, widening fb0f194's coordinator-only carve-out to standing adjudication at two seats on the operator's grant.
- verdict: keep
- reason: The grant is positional and this sentence is where it sits; the 2026-09-02 pass ran under it and its record cites it.

### C038
- key: Standing adjudication is what keeps the inbox moving between attended passes.
- class: rationale-example
- source: plugins/claude-kit/skills/kaizen/SKILL.md:42
- provenance: c606b62 2026-08-29, with the grant.
- verdict: retire
- reason: The why is c606b62's own title ("the loop stops asking permission to learn about itself"): without standing adjudication the inbox waits on the operator's attended pass and grows; the grant is obeyed without the sentence.

### C039
- key: Do not use the standing authority to widen or relax the capture bar.
- class: rule
- source: plugins/claude-kit/skills/kaizen/SKILL.md:44
- provenance: fb0f194 2026-08-28 installed the narrowing for the coordinator carve-out; c606b62 2026-08-29 restated it for the standing authority.
- verdict: rewrite
- reason: The narrowing itself stays verbatim; the paragraph loses only its announcing sentence, which states no narrowing and no incident installed.

### C040
- key: Take a materially consequential disposition to the operator as a decision ask.
- class: rule
- source: plugins/claude-kit/skills/kaizen/SKILL.md:44
- provenance: fb0f194 2026-08-28, kept at c606b62 2026-08-29; the operator's grant record says it is not a grant for pass-time edits to skills or doctrine.
- verdict: keep
- reason: Class operator-decision: what it guards is a kit-wide change shipped to every installing consumer through a trunk with no CI, the doctrine's own material-decision interrupt; the sentence is already the pointer form ("like any other decision ask").

### C041
- key: Land a dispatched disposition as an artifact in the repo that owns the work - a spec, a backlog entry, a plan - never as an instruction to a session on a seat's say-so.
- class: rule
- source: plugins/claude-kit/skills/kaizen/SKILL.md:44
- provenance: fb0f194 2026-08-28 (the coordinator's never-tasks-directly rule applied to kaizen), restated at c606b62 2026-08-29.
- verdict: keep
- reason: No finding of its own; the 2026-09-02 pass landed five specs and routed the queue decision to the operator, which is this rule working.

### C042
- key: Open the pass by running `git pull` in the kit repo so notes from every machine are merged.
- class: rule
- source: plugins/claude-kit/skills/kaizen/SKILL.md:46
- provenance: 830ff28 2026-06-17 installed the pull; the step's later sentences are cceff11, 3380bf2 and 7701ec5.
- verdict: rewrite
- reason: The instruction stands; the Gather step is restructured into sub-bullets with no rule or reason dropped because its 120-word sentence fails the kit's own sentence bar, and the readers' compressions dropped content the baseline test at 7701ec5 proved necessary.

### C043
- key: Read the pull's own output to decide which test lane the pass owes before pricing it.
- class: rule
- source: plugins/claude-kit/skills/kaizen/SKILL.md:46
- provenance: 3380bf2 2026-08-31, correcting cceff11's claim that every pull is a merge; no incident is narrated for the refinement.
- verdict: keep
- reason: The pull's paragraph must name its lane (integration-verb pin) and the lane depends on what the pull did; nothing reads the output for the session.

### C044
- key: Treat `Already up to date` or `Fast-forward` as no merge, and open the pass on the targeted lane.
- class: mechanic
- source: plugins/claude-kit/skills/kaizen/SKILL.md:46
- provenance: 3380bf2 2026-08-31.
- verdict: keep
- reason: Git prints the words; classifying them is the reader's act, and without it every pass would price a whole gate on a tree origin already had.

### C045
- key: Where the pull reports a merge, run the whole gate over the merged tree with the contention lane beside it before the pass changes anything.
- class: rule
- source: plugins/claude-kit/skills/kaizen/SKILL.md:46
- provenance: cceff11 2026-08-31, after the kaizen skill was found carrying gate-earning actions unnamed.
- verdict: keep
- reason: The doctrine owns the merge moment, but the integration-verb pin (test/doctrine-parity.test.js:5441) requires the pulling paragraph to name its lane in the shared words, so the restatement is required rather than duplicated.

### C046
- key: Where the pull output has scrolled away, run `git log -1 --pretty=%p HEAD`: two parents means a merge commit, one means not.
- class: mechanic
- source: plugins/claude-kit/skills/kaizen/SKILL.md:46
- provenance: 3380bf2 2026-08-31.
- verdict: keep
- reason: The command answers half the question and the HEAD-moved test the other half; the readers' compressions dropped it and nothing else supplies it.

### C047
- key: Read all `kaizen/notes-*.md`, each file in its own tool call, and record each file's note count before triage begins.
- class: rule
- source: plugins/claude-kit/skills/kaizen/SKILL.md:46
- provenance: 7701ec5 2026-09-02, after the 2026-09-02 pass cleared sixteen notes and covered fourteen (errata in kaizen/archive/2026-09-02-pass-triage.md); baseline-tested against a fresh reader.
- verdict: keep
- reason: The incident can recur on any pass and no program reads the files or takes the count; the count is the figure step 3 reconciles against.

### C048
- key: Read one file per call because a loop printing every file through one call can overrun the harness output cap and lose a file's tail unmarked.
- class: rationale-example
- source: plugins/claude-kit/skills/kaizen/SKILL.md:46
- provenance: 7701ec5 2026-09-02, with the rule.
- verdict: keep
- reason: The reason rode with the rule through its baseline test; without it the one-call-per-file rule reads as a style preference a reader batches away, which is the incident.

### C049
- key: Keep the step 1 note count as the figure the step 3 clear is reconciled against.
- class: mechanic
- source: plugins/claude-kit/skills/kaizen/SKILL.md:46
- provenance: 7701ec5 2026-09-02.
- verdict: keep
- reason: The forward reference is what makes step 1 produce the figure before triage; without it step 3 has nothing to reconcile against.

### C050
- key: Add any friction from this session still in context, and when the pass is attended ask the operator for theirs.
- class: rule
- source: plugins/claude-kit/skills/kaizen/SKILL.md:46
- provenance: 830ff28 2026-06-17 ("ask me for mine"); c606b62 2026-08-29 confined the ask to the attended pass.
- verdict: keep
- reason: Class loop-maintenance, but not a gate: the unattended branch proceeds on the standing grant and the ask is an input on the attended pass; the standing-grant precedent has already run on this sentence.

### C051
- key: For each item ask whether the friction is real and what the smallest change that fixes it is, then sort it into one of the four dispositions.
- class: rule
- source: plugins/claude-kit/skills/kaizen/SKILL.md:47
- provenance: 830ff28 2026-06-17; c606b62 2026-08-29 added the attended-versus-standing bound.
- verdict: rewrite
- reason: The two questions and the bound stay verbatim in two sentences instead of one, because the bound sits mid-sentence between the label and the questions; the attended-branch gate is loop-maintenance already resolved by c606b62's standing branch.

### C052
- key: Turn a small, clear item into a brief, or fix it directly since the pass already runs in the kit repo.
- class: rule
- source: plugins/claude-kit/skills/kaizen/SKILL.md:48
- provenance: 830ff28 2026-06-17.
- verdict: keep
- reason: The disposition's definition; step 3 (C057) performs it and the two are not one statement.

### C053
- key: Brainstorm an item large enough to deserve its own design into a `docs/plans/` spec instead of a brief.
- class: rule
- source: plugins/claude-kit/skills/kaizen/SKILL.md:49
- provenance: 830ff28 2026-06-17.
- verdict: keep
- reason: No finding; the 2026-09-02 pass promoted five specs under it.

### C054
- key: Route an item that is not about the kit out of the inbox: a project learning to that project's memory tier, a project convention to that project's CLAUDE.md.
- class: rule
- source: plugins/claude-kit/skills/kaizen/SKILL.md:50
- provenance: 830ff28 2026-06-17; eb7d29d 2026-08-09 corrected the destination from "auto memory".
- verdict: keep
- reason: The closing sentence ("It leaves the inbox either way") is an instruction to clear the note whichever destination it took, not a restatement, so the bullet stands whole.

### C055
- key: Move an open experiment with a defined driving signal and no data yet to the kit's `docs/backlog.md` with its signal and decision protocol, and clear the note.
- class: rule
- source: plugins/claude-kit/skills/kaizen/SKILL.md:51
- provenance: ae90fa5 2026-07-08, whose message narrates nothing about the disposition; no provenance found for its why beyond the commit.
- verdict: rewrite
- reason: The instruction stays verbatim; only the third sentence (C056's rationale) leaves for this ledger.

### C056
- key: Park items out of the inbox so it stays a friction-only signal and the pending-items nudge never cries wolf over a waiting experiment.
- class: rationale-example
- source: plugins/claude-kit/skills/kaizen/SKILL.md:51
- provenance: ae90fa5 2026-07-08, with the disposition.
- verdict: retire
- reason: The why now lives here: the pending predicate (C007) counts every note line, so an experiment left in the inbox nudges every kit-repo session start until its signal arrives; parking it in the backlog keeps the inbox a friction-only signal.

### C057
- key: Write a brief for each apply-now item using the brief format.
- class: rule
- source: plugins/claude-kit/skills/kaizen/SKILL.md:52
- provenance: 830ff28 2026-06-17; step 3's later sentences are cceff11 and 7701ec5.
- verdict: rewrite
- reason: The instruction stands; step 3 is restructured into sub-bullets with no rule or reason dropped, keeping the pinned install-surface wording verbatim (test/doctrine-parity.test.js:3944) and the 7701ec5 clearing sentences that were baseline-tested as a unit.

### C058
- key: Make the change per the writing-skills skill.
- class: pointer
- source: plugins/claude-kit/skills/kaizen/SKILL.md:52
- provenance: 830ff28 2026-06-17.
- verdict: keep
- reason: The step reaches direct fixes made without a brief, which the template's Discipline line never touches.

### C059
- key: Baseline-test any behavior-shaping wording before trusting it.
- class: rule
- source: plugins/claude-kit/skills/kaizen/SKILL.md:52
- provenance: 830ff28 2026-06-17.
- verdict: keep
- reason: As C058: a direct fix has no brief to carry the Discipline line, so the step states the bar itself.

### C060
- key: Clear the note lines you handled once the change is made.
- class: rule
- source: plugins/claude-kit/skills/kaizen/SKILL.md:52
- provenance: 830ff28 2026-06-17; 7701ec5 2026-09-02 bounded how the clear is done.
- verdict: keep
- reason: The park disposition's clear is the same act at one disposition; step 3's is the closing act for all of them.

### C061
- key: Archive applied briefs out of `kaizen/briefs/`.
- class: rule
- source: plugins/claude-kit/skills/kaizen/SKILL.md:52
- provenance: 830ff28 2026-06-17.
- verdict: keep
- reason: No finding; the pending predicate counts brief files, so an unarchived brief nudges forever.

### C062
- key: Clear each dispositioned line by its own text and never truncate the note file.
- class: mechanic
- source: plugins/claude-kit/skills/kaizen/SKILL.md:52
- provenance: 7701ec5 2026-09-02, after the 2026-09-02 pass's whole-file clear dropped two notes it never read.
- verdict: keep
- reason: The clear is a hand edit with no program doing or checking it, and the incident can recur on any pass.

### C063
- key: Never rewrite the whole inbox surface, because producers append at any time and nothing coordinates them with a running pass.
- class: rationale-example
- source: plugins/claude-kit/skills/kaizen/SKILL.md:52
- provenance: 7701ec5 2026-09-02, with the rule.
- verdict: keep
- reason: The reason rode with the rule through its baseline test; without the concurrent-append account the never-truncate rule reads as fussiness a reader simplifies away.

### C064
- key: Before the clearing commit, reconcile the staged diff's removed note lines against the triage record: every removed line named, and the removed count equal to the dispositioned count.
- class: rule
- source: plugins/claude-kit/skills/kaizen/SKILL.md:52
- provenance: 7701ec5 2026-09-02, the same incident.
- verdict: keep
- reason: The removed-lines check; C066 is the remaining-lines check and 7701ec5 installed both as the two ends of one loop.

### C065
- key: Restore to the inbox any removed line the triage record does not name rather than committing it away.
- class: rule
- source: plugins/claude-kit/skills/kaizen/SKILL.md:52
- provenance: 7701ec5 2026-09-02.
- verdict: keep
- reason: No finding; the restore is what the reconciliation exists to trigger.

### C066
- key: Check that notes read minus notes dispositioned equals what stays in the file, and have the record name each remaining line and why.
- class: mechanic
- source: plugins/claude-kit/skills/kaizen/SKILL.md:52
- provenance: 7701ec5 2026-09-02.
- verdict: keep
- reason: Equal counts fix the remainder's size, not which lines it holds or why; this is what names a note read and never triaged, and nothing computes it.

### C067
- key: Run the whole gate with the contention lane beside it before the push that ships an applied brief.
- class: rule
- source: plugins/claude-kit/skills/kaizen/SKILL.md:52
- provenance: cceff11 2026-08-31, after the kaizen skill was found carrying gate-earning actions unnamed.
- verdict: keep
- reason: Two pins require the sentence: the integration-verb pin demands the lane named at the pushing paragraph and INSTALL_SURFACE_CARRIERS names this file as a carrier of the condition in shared wording; a pointer-only form reddens both.

### C068
- key: Take that pre-push gate moment from executing-work's step 7, which owns it.
- class: pointer
- source: plugins/claude-kit/skills/kaizen/SKILL.md:52
- provenance: cceff11 2026-08-31.
- verdict: keep
- reason: The pointer at the owner; no finding.

### C069
- key: Follow a promoted spec's own recorded commit model rather than the kit repo's.
- class: rule
- source: plugins/claude-kit/skills/kaizen/SKILL.md:52
- provenance: 830ff28 2026-06-17 (with the three commit models); cceff11 2026-08-31 split it into its own sentence.
- verdict: keep
- reason: No finding; a promoted spec's header is the positional grant for its own pushes.

### C070
- key: Write each brief so a fresh kit-repo session can execute it without this session's context.
- class: rule
- source: plugins/claude-kit/skills/kaizen/SKILL.md:56
- provenance: 830ff28 2026-06-17.
- verdict: keep
- reason: The doctrine's handoff rule decides when to hand off; this fixes what a brief contains.

### C071
- key: Use the brief template: a `# Kaizen brief: <short title>` heading, then Friction, Change, Acceptance, and a Discipline line reading "follow writing-skills; baseline-test any behavior-shaping wording."
- class: mechanic
- source: plugins/claude-kit/skills/kaizen/SKILL.md:59
- provenance: 830ff28 2026-06-17.
- verdict: keep
- reason: Nothing validates a brief against the template; the writer holds the format.

### C072
- key: Never offer a kaizen pass on an uneventful session.
- class: rule
- source: plugins/claude-kit/skills/kaizen/SKILL.md:68
- provenance: 830ff28 2026-06-17, written beside C073 on the same line.
- verdict: retire
- reason: C073 states the same bar with the predicate and the moments named, which is the decidable form; the five-word negative lead merges into it.

### C073
- key: Offer a pass only when the inbox has pending items and only at a natural moment: finishing-work's close-out, or when the operator signals they are wrapping up.
- class: rule
- source: plugins/claude-kit/skills/kaizen/SKILL.md:68
- provenance: 830ff28 2026-06-17.
- verdict: keep
- reason: Class loop-maintenance, but a bar on the session's initiative rather than a permission the pass waits on: standing adjudication proceeds with no offer since c606b62, so retiring it makes the session louder, not freer.

### C074
- key: Make the offer one dismissable line, such as "N kaizen items captured, want to run a pass?".
- class: mechanic
- source: plugins/claude-kit/skills/kaizen/SKILL.md:68
- provenance: 830ff28 2026-06-17.
- verdict: keep
- reason: The session composes the line and the cap on its size is what keeps the offer from becoming a nag.

### C075
- key: Let the operator start a kaizen pass explicitly at any time, regardless of the pending-items and natural-moment gates on offering one.
- class: rule
- source: plugins/claude-kit/skills/kaizen/SKILL.md:68
- provenance: 830ff28 2026-06-17 ("Scott can always start one explicitly").
- verdict: keep
- reason: The operator's live word ranks above skill text; the sentence records that C002 and C073 bound the session's initiative only.

### C076
- key: Fire the SessionStart nudge only in the kit repo, reminding the session of pending items when claude-kit is opened, using the same pending-items predicate as the offer.
- class: mechanic
- source: plugins/claude-kit/skills/kaizen/SKILL.md:68
- provenance: 830ff28 2026-06-17, installed with the hook it describes.
- verdict: rewrite
- reason: The nudge is a program (`hooks/session-start.js` `countPendingKaizen` and the block at line 1505, pinned by test/session-start-kaizen.test.js), so the sentence asks nothing of a session; it becomes a pointer naming the hook so the shared predicate stays visible.
