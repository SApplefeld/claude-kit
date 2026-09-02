# Memory recognition reaches the shared tiers: a seat reads the store at takeover, a record is born with its trigger, and the operator tier is backfilled

Status: Ready
Commit Model: Commit-and-Push
Created: 2026-09-02

Session model: the kit worker's leashed session; four sections, tiers per section, sections 1 and 2 independent of each other and of section 3, section 3 after section 2 so the backfill runs with the warning and the coverage line in place, section 4 at the close. Authored by the KIT: Expert seat from the operator's dialog of 2026-09-02 after a coordinator seat failed to recall an operator-tier ruling about its own ledger until the operator pointed at it. Anchors are authoring-time; re-locate every hit by content.

## Dispatch Authorization

Authorized 2026-09-02 by the operator at the keyboard in the KIT: Expert seat's session: all three moves of the recognition-reach diagnosis (the takeover ritual reads the store, the operator tier is backfilled with triggers starting from the ledger ruling, the semantic route stays behind its evidence gate), to be appended to the worker's queue and moved earlier in it at the Expert seat's judgment. The operator's words were an agreement with every item of the diagnosis and an approval to proceed on them all as a new spec for the worker's queue; that seat recorded them here and ran the append. Per the peer-sessions trace rule this section is a warrant only for a citing session that did not author it, and the receiving session performs its own trace: the grant is the operator's keyboard message in the Expert session's transcript (session 5dd160be on SCOTT-CLAUDE, 2026-09-02), and the plan arms only by the operator's word or the Expert seat's append under it.

## Goal

The memory recognition nudge is wired and working, and it reached none of the 237 operator-tier records because none declares a trigger, the takeover ritual has no step that reads the store, and the session-start injection is scoped to the project a session started in. Three independent routes each missed one record that would have changed a seat's whole approach. When this plan is done: every seat takeover ends with the store's digest in front of the seat, the operator block included; a shared-tier record cannot be written without either a trigger or a loud statement that it has none; every operator-tier and type-tier record that has a machine-readable handle declares it, and the ones that have none are named in one place; and the evidence reading that gates the semantic route exists as a number rather than a promise.

## Evidence

- `plugins/claude-kit/hooks/memory-recognition-nudge.js:28-42` (the boundary and type split), `:121-135` (the semantic tier deferred behind decision 2 of the archived recognition spec, and the no-endpoint rule for the synchronous boundaries), `:1498-1500` (the PreToolUse boundary reads the operator tier's triggers), `:1601-1602` (a `skill:` trigger matches the skill a Skill call invokes, by whole identifier, the plugin-prefixed spelling answering by its last segment).
- `plugins/claude-kit/skills/role/SKILL.md:71` (takeover step 2 loads the coordinator skill), `:74` (step 5, the ritual's only memq call, resolves the delegation record); `plugins/claude-kit/skills/executing-work/SKILL.md:77` (a plan run recalls before its first section; a takeover that runs no plan never recalls).
- Store counts on SCOTT-CLAUDE, 2026-09-02, by a grep for `triggers:` under each tier's directory with the pattern's own hits as the control: operator tier 237 records, 0 triggers, 0 anchors; type tiers 5 records, 0 triggers; project tiers 7 triggers store-wide, in claude-kit (4) and Neuro-Evolution-Operations (3). `memq recall` from this checkout lists the ledger ruling at line 122 of a 200-line digest.
- `docs/archive/claude-kit_memory-recognition_spec_v1.md`, Decisions 2 (Tier 2 gated on a stamp-rate reading) and Out of Scope (shared-tier triggers named as future work; the operator-tier read at PreToolUse has since shipped).
- The record that failed: `a-coordination-ledger-holds-current-state-not-its-own-journey` (operator tier, `machine: SCOTT-CLAUDE`), now carrying `triggers: skill:coordinator`, declared by the Expert seat on 2026-09-02 under the operator's approval as the first backfill and the control for section 3.

## Decisions

Decided 2026-09-02 by the operator at the keyboard, on the Expert seat's recommendation.

1. **The recall step folds into takeover step 4 rather than becoming a step of its own.** Steps 4, 5 and 7 of the ritual are pinned by number in `test/doctrine-parity.test.js` and named as "the fourth step" in the role and coordinator skills, so a new step would renumber every reference. Step 4 becomes the read of the board and of the store together, which is also the right order: the board says what the seat owes, the store says what it knows.
2. **Trigger authoring moves to the record's birth.** `add-operator` and `add-type` take a repeatable `--trigger <type>:<pattern>` and warn on stderr, naming the `triggers` verb, when a new record is written with none. The separate verb stays for later declarations. Warn, never refuse: a record with no handle is still worth keeping, and the warning is what makes the debt visible at the moment it is incurred rather than 237 records later.
3. **The backfill is a judgment pass, run at Opus, with its handle-less remainder named rather than forced.** A trigger is a claim that a moment recognizes a lesson; a wrong one fires noise on every session that meets the pattern, so a record whose lesson has no skill, agent, tool, command or error shape is listed as handle-less rather than given a trigger to make the count look complete.
4. **The semantic route stays deferred behind the archived spec's gate, reframed.** Any future Tier 2 uses the in-process embedder with no endpoint call on the synchronous boundaries, a relevance floor, and a one-line cap, and the gate's reading is what section 4 produces. Nothing in this plan builds it.

## Sections of Work

### 1. The takeover ritual reads the store. Model: opus

`plugins/claude-kit/skills/role/SKILL.md`, the takeover ritual's step 4: after the board read (and the artifact inbox for Admin), the seat runs `memq recall` and reads the digest whole, the operator block included, before any announcement, on the same footing the board read already has: a seat that announces before it has read what the store holds about its own moment is a seat claimed without its lessons. State the price (about two hundred lines of context per takeover on a store of this size) and the reason it is paid here rather than at the first plan section, which is that a coordinator takeover runs no plan and the executing-work recall never fires for it. The coordinator skill's runbook gains one sentence at its takeover mention pointing at the role skill's step rather than restating it. The memory-system skill's recall paragraph names the takeover as a second moment the verb runs at, beside effort start.

Writing-skills discipline applies: RED reading of the ritual as it stands in a fresh session, GREEN after the amendment, both recorded in the Chapter. The step count and every numbered reference stay as they are; `node --test test/doctrine-parity.test.js` is the pin, and the reviewer brief names the whole file rather than the diff because the amendment lands in a numbered list whose neighbours carry the parity pins.

Acceptance: the amended step present in role, the pointer present in coordinator, the second moment present in memory-system, no em dashes; the doctrine-parity lane green with delta named against a recorded baseline; a real takeover in a fresh session (any seat) shows the digest in the transcript before the announcement.

### 2. A shared-tier record is born with its trigger, or says it has none. Model: opus

`plugins/claude-kit/scripts/memq.js`: `add-operator` and `add-type` accept `--trigger <type>:<pattern>`, repeatable, validated by the same grammar and bars the `triggers` verb applies (the `TRIGGER_TYPES` list, the universal floor, the bare-token bar scoped to the types it is true of), written into the new record's frontmatter as the `triggers:` line the nudge reads, and refused whole with nothing written where any entry fails, exactly as `triggers` refuses. A new record written with no `--trigger` succeeds and emits one stderr line naming the record and the `memq triggers <name> <type>:<pattern> --operator` (or `--type`) spelling that adds one later. `--update` never warns, since the record already exists and its trigger state is not this write's to judge. `memq recall`'s operator-tier and type-tier coverage lines gain the count of records with no trigger ("operator tier: 237 records, 236 without a recognition trigger"), so the debt is visible on the digest every seat reads at takeover after section 1.

Tests, red first, in the memq suite's harness that reaches the shared tiers (the memory `memq-suite-has-two-store-harnesses` names which): a record added with two triggers carries both in the shape `memq get` prints; an invalid trigger refuses with nothing written; a record added with none succeeds and the stderr line names the record and the verb; `--update` on a trigger-less record stays silent; the recall coverage line carries the count and reads zero on a tier whose every record declares one. Under the engine store signals the new flag inherits whatever grant the add verbs already have and widens nothing.

Acceptance: tests green, watched red first; `node --test test/memq*.test.js` green with delta named; the memq reference table in `plugins/claude-kit/skills/memory-system/SKILL.md` carries the flag and the warning in the two add rows, no em dashes.

### 3. The operator and type tiers are backfilled. Model: opus

A judgment pass over every operator-tier and type-tier record with no `triggers:` line (236 and 5 at authoring; re-count at the section's start with the same grep and its control). For each record, read the body and decide which moment recognizes its lesson: the skill whose procedure it corrects or extends (`skill:<name>`, by far the commonest for a ruling), the agent type it is about (`agent:`), the tool or command it guards (`tool:`, `cmd:`), or the failure text it explains (`err:`); `glob:` is admitted where the record is about a file class a call touches. Declare with `memq triggers <name> <type>:<pattern> --operator` (or `--type`), one record at a time so a refused pattern names its record, and never by hand-editing the frontmatter. A record whose lesson has no such moment is left undeclared and listed by name in the Chapter with one clause of why, per decision 3; the list is the plan's product as much as the declarations are, since it is the population a semantic route would exist to reach.

Two bars on the declarations. A trigger must be true of the moment, not merely related to it: `skill:coordinator` on a ruling about the board is true, `tool:Bash` on a lesson about test baselines is noise on every command. And a machine-scoped record (`machine:` in its frontmatter) keeps its scoping, which the nudge already honours through memq's machine gate; the pass never widens one.

The control, run before and after: the nudge fires for the ledger ruling on a Skill call naming `coordinator`, driven through the hook with a real PreToolUse payload rather than asserted from the frontmatter, and stays silent on a Skill call naming `role`. A dry run over ten records precedes the pass and its declarations are reviewed in the Chapter before the remaining two hundred are made, because a systematic misreading of the vocabulary is cheap to catch at ten and expensive at two hundred.

The store is a synced git repository; the pass's writes land in it through the store's own sync at the next session start, and the Chapter names the store commit that carried them once it exists. This section runs after section 2 so the warning and the coverage line are in place to read the count down.

Acceptance: the before and after counts named from the grep with its control; the handle-less list in the Chapter; the control fired and stayed silent as stated; the dry-run review recorded; no frontmatter edited by hand.

### 4. The evidence reading behind the semantic gate. Model: sonnet

The archived recognition spec gates the semantic route on a stamp-rate reading: of the nudges the hook fired, how many were followed by an applied stamp on the record named. Produce that reading once, from `.kit/memory-recognition-nudges.jsonl` in this checkout (and any other checkout on this machine whose log the section can reach, named per checkout) joined against each store's `usage.jsonl` applied stamps by record name within the same session, with the window stated. Record in the Chapter: nudges fired, distinct records named, applied stamps within the window, and the resulting rate; and state plainly whether the reading is on a population large enough to gate anything, since at authoring the whole store carried seven triggered records and the honest reading may be "not yet". No code ships unless the join needs a script, which then lives under the gitignored `.kit/` scratch path and is named in the Chapter.

Acceptance: the four figures and the window in the Chapter, each naming the file it came from; the population judgment stated; nothing under `docs/` but the Chapter.

## Out of Scope

- Tier 2 semantic matching itself, per decision 4; the reframe is recorded there for whoever designs it.
- The session-start index injection for a session whose project is the home directory (the coordinator's ordinary state). Section 1's recall step covers the takeover; whether session start should carry an operator-tier line count is a separate question.
- Anchors on shared-tier records: an anchor is a hash of a project file, and the refusal is by design.
- Any change to the nudge hook's matching or boundaries.

## Related

- `../archive/claude-kit_memory-recognition_spec_v1.md`: the recognition design this plan extends; its decision 2 is the gate section 4 reads.
- `claude-kit_memory-record-provenance_spec_v1.md`: touches the same add verbs (an `author:` field); the two plans are independent in content, and whichever lands second re-reads the verbs' usage text before editing.
- `claude-kit_kaizen-prose-batch_spec_v1.md`, section on the memory-system skill: the same skill file, different paragraph.

## Chapters
