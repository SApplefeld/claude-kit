# A memory record says who wrote it, and a machine-scoped record can anchor a file inside the store

Status: In Progress
Commit Model: Branch-and-PR
Created: 2026-09-02

Session model: any executor session in the kit repo; three sections, tiers per section. Authored by the KIT: Expert seat from the 2026-09-02 kaizen pass. Anchors are stated as of 0c6093e7, and every hit is re-located by content. This plan runs after `claude-kit_kaizen-code-batch_spec_v1.md`. Where `board:` is absent from `MEMQ_FIELDS` when this plan starts, the run proceeds and the Chapter notes it, since nothing this plan builds reads that key.

## Dispatch Authorization

Authorized 2026-09-02 by the operator, first-hand on the allowlisted relay thread, to be appended to the kit worker's armed queue: the author field and the store-relative anchors as designed here, eleventh in the queue. The operator's word was the answer to a decision batch the KIT: Expert seat put on the relay, choosing the recommended option of appending the pass's four code-and-design specs to the worker's queue in the order code batch, liveness, claim writer, provenance; that seat recorded it here and ran the append. Per the peer-sessions trace rule this section is a warrant only for a citing session that did not author it, and the receiving session performs its own trace: the grant is the operator's message on the Expert session's relay thread, and the plan arms only by the operator's word or the Expert seat's append under it.

Amended 2026-09-21 by the architect persona, on the operator's word on the architect's relay thread that day. The kit worker's queue named above no longer exists, and this plan sat in no queue after the fleet moved to persona workers. The post-rewrite program (`claude-kit_post-rewrite_program_v1.md`) holds every plan written before the corpus rewrite for its step 5, the triage, and for the three-part spec review before arming. The architect checked this plan section by section against trunk 0c6093e7 and put the choice to the operator: hold it for the triage, or pull it forward after an anchor fix and that review. His answer, in his words: "Agreed. Let's do B." The plan is therefore pulled ahead of the triage. It joins the dev-plugin persona's queue after the six plans that queue held on that date, in the order kaizen code batch, liveness by session identity, this plan. The steward's append under that word is the arming. This authorization covers the plan as re-anchored at 0c6093e7 and reviewed on that date. An executor checks one thing before starting: that the steward handed it this plan by name. The steward is the fleet's coordinator persona, the session that owns each worker persona's queue, and a handoff is this plan's filename arriving as the worker's goal from that persona. The rest of this section records how the authorization came about, and none of it is a precondition.

2026-09-22, the operator, on the dev-plugin persona's relay thread: this plan is authorized to run. It was one of five plans paused in that persona's goal tree, and the operator's words were "please proceed on all five of the paused plans in whatever order you consider to be the most effective implementation of them." That word is first-hand and ranks above the steward handoff the paragraph above names, so it stands as this run's arming.

## Goal

The memory store records who committed a record and nothing records who wrote one. On a shared checkout with several seats, an uncommitted record can be attributed only by asking every seat in turn, and the store's own sync can publish it first under a message no seat wrote. The coordinator seat measured the cost as a rate: three sets of unclaimed records in twelve hours from at least two authors, each resolved by an asking round, with a fourth seat holding clean work uncommitted meanwhile so as not to sweep the others. The shared tiers' frontmatter grammar carries no authorship key at all. `add-type` and `add-operator` write `tags:`, `supersedes:` and `triggers:`, and `add-operator` writes `machine:` besides. The four run-provenance lines `provenanceLines` emits, `run:`, `vector:`, `section:` and `written:`, are written only under a run-scoped store pin. An ordinary create carries none of them, and none of them names a session. A practice fix therefore has nowhere to stamp, and the field has to be born in the authoring grammar.

A second gap sits in the same tier. The anchor verb records which files a project-tier record is about and reports drift when they change, and it refuses the two shared tiers on the ground that they have no root and no tree. A machine-scoped operator-tier record asserting a fact about a file inside the store has a root: the store is a git repository, and the record and the file it describes sit in one tree. The tier holding a machine's hard-won, machine-specific facts is therefore the one tier with no drift detection, and one such record went false a day after it was written, sat unchallenged for three days, and was republished onto a board in three places.

When this plan is done: every shared-tier record written by `memq add-type` or `memq add-operator` carries an `author:` field the CLI writes from the session id alone, `get` and `find`'s lexical block print it, and the project-tier guard accepts the same field at the write door; a machine-scoped operator-tier record can anchor a path that resolves inside the store root, with the same drift readings the project tier gets; and the existing backup pin drives the one spelling it leaves open, the `.md.bak` name passed as an argument.

## Intent

**The frame.** The design conversation behind this plan is not on record, so the frame is drawn from the two kaizen notes under Evidence and from the Decisions. Several sessions share one memory store. When a record turns up uncommitted, nobody can tell who wrote it without asking every session in turn. When a record about one machine goes stale, nothing notices.

**What done needs.** A record written through the memory CLI into a shared tier names the session that wrote it. A reader sees that name where it reads the record and where it searches for one. A record that states a fact about a file inside the store, on the machine that wrote it, is flagged when that file changes.

**What done does not need.** Proof of who wrote a record, since the field narrows an honest writer and authenticates nobody. A seat name or a registry name in the record, or one looked up when the record is printed. The author on the `recall` digest. Existing records rewritten to carry the field. A session asked to hand-write the field. A drift check for a record scoped to another machine, or for a shared record with no machine scope. A count of other machines' records at session start. Any change to the recognition nudge, which keeps reading the project tier's anchors only. A git check on the store root.

**Alternatives refused.**
- A sidecar file beside the record: a field inside the record survives every rename and archive move the tiers perform.
- The registry name in the record: it gives the coordinator directory a route into the store and puts free text on a charset-closed line.
- The field required on the project tier: the Write tool is the sanctioned authoring path there, and a required field would refuse every record it writes.
- Anchors on every shared record: a path is checkable only where the machine that wrote the fact is the machine reading the tree.

**Rulings.** The operator authorized this plan on 2026-09-02 and pulled it ahead of the triage on 2026-09-21, as the Dispatch Authorization records. No ruling of his on the design itself is recorded.

**Provenance.** Distilled on 2026-09-21 by the architect persona from this plan's Goal, Decisions and Out of Scope and from the kaizen notes under Evidence. The original design conversation was not available to that session.

## Evidence

- `kaizen/notes-SCOTT-CLAUDE.md` 2026-08-30, the authorship note, its refinement, and the expert seat's correction establishing the three-layer door model (guard on the shared tiers, discipline on the shell channel, inert past the readers). The authoring grammar that correction enumerated has since gained `triggers:`, and the Goal above carries the current enumeration.
- `kaizen/notes-ASR-CLAUDE.md`, the second note: drift detection scoped to tier rather than to whether the record makes a checkable claim, with the observed false record about a board's sync exclusion.
- `kaizen/notes-SCOTT-CLAUDE.md` 2026-08-30, the `.md.bak` note: confirmed that a `.bak` alone resolves as a record on the memq of that date, and not tested whether it shadows a live sibling. The memory-system skill states `.md.bak` is outside the memory-filename grammar and swept by no listing. `test/memq.test.js` pins most of that statement already, and section 3 states what it leaves open.
- The memory-system skill's frontmatter rules: fields read at the top level and under `metadata:`, the guard's `MEMQ_FIELDS` placement check, and the `machine:` field's identifier gate (`plugins/claude-kit/skills/memory-system/SKILL.md`, the sections "Where a hand-written frontmatter field lands", "The `machine:` field", and "The frontmatter guard").

## Decisions

Decided 2026-09-02 by the Expert seat under standing adjudication; reversible at arming. Every anchor in this plan resolves at trunk 0c6093e7 and is found by content rather than by line number. The plan cites no line number into a file the memory database plan changed after that commit.

1. **The field is `author:` in the frontmatter, written by the CLI, and it is provenance rather than credential.** Its value is the calling session's id alone, read from `CLAUDE_CODE_SESSION_ID` and admitted only where it has the harness's session-id shape (`isSessionIdShaped`, the one definition memq already imports from `kit-goal-lib.js`); where the variable is absent or its value is not id-shaped, the value written is the literal `none`. The CLI reads no registry entry and no other coordinator-directory file for it, so the field carries nothing a seat typed: both spellings sit inside the record-name charset `[A-Za-z0-9_.-]`, which is the one value grammar the guard checks and every printer relies on. The value is unauthenticated, and the field narrows an honest writer without authenticating one, exactly as `machine:` does; a session's registry name is looked up from the id by the reader that wants it, never carried in the record. Alternative: a sidecar beside the record, declined because a field that travels with the record survives every rename and archive move the tiers already perform. Alternative: the registry name in the record, declined because it would give the coordinator directory a route into the store that no scope list names and put free text on a hit line the security model describes as charset-closed. The field stands beside the run-provenance lines and is none of them. `run:`, `vector:`, `section:` and `written:` name a kit run and are written only under a run-scoped store pin. `author:` names the session and is written on every create. The two coexist, and `provenanceLines` is unchanged.
2. **The project tier takes the field at the write door as optional, never required.** The guard validates its placement like every other memq field and refuses nothing for its absence, because the Write tool is the sanctioned project-tier authoring path and a required field there would refuse every record the harness's own memory feature writes.
3. **Store-relative anchors are admitted for a record carrying `machine:` matching this host.** The anchor verb resolves a path against the store root for such a record and refuses every other shared-tier record as today, so a path is anchored only where the machine that wrote the fact is the machine reading the tree. Drift surfaces report the operator tier only on this host and say `not checked (record is scoped to another machine)` elsewhere. The column-zero guarantee the security model states for shared-tier anchors is kept: no reading of a shared-tier record's anchors ever puts a path at column zero, on any surface.

## Sections of Work

### 1. The `author:` field
Model: opus

`memq add-type` and `memq add-operator` in `plugins/claude-kit/scripts/memq.js` write `author:` at the top level, with the value Decision 1 states: the id-shaped `CLAUDE_CODE_SESSION_ID` or the literal `none`, and nothing read from the coordinator directory. The create path puts the fields that say how a record stands, `tags:`, `supersedes:` and `triggers:`, above the lines that say who wrote it. `author:` says who wrote it, so it is pushed after those fields and ahead of the lines `provenanceLines` returns. It is written on every create, outside that function's run gate. `--update` leaves it as written, since it records the creating writer. The print set is exactly two surfaces: `get` prints one `author: <value>` line where `triggerReport` prints the record's `triggers:` lines, indented under the provenance fence wherever the body was fenced, since the value is the record's own text and never memq's voice, and `find`'s lexical block carries the value on its hit line. A hit whose line carries a tier label, `(pending)`, `(project)`, `(type:<type>)` or `(operator)`, reads `(<label> author:<value>)`, as in `(operator author:<value>)`. A project-tier hit printed with no label reads `(author:<value>)`. A record whose field is `none` prints `author:none` on the same terms, and a record with no field prints as it does today. `recall` is outside the print set and its per-record lines are unchanged. Every printed value passes the same charset reduction the record name takes, so a hand-edited field cannot put free text on either line. The frontmatter guard (`plugins/claude-kit/hooks/memory-frontmatter-guard.js`, `MEMQ_FIELDS`) adds the field with the same placement check as the others, accepting a value inside `[A-Za-z0-9_.-]` up to the record-name cap and refusing one outside it; the value grammar is the writer's and the guard's alike, so the guard never refuses a project-tier record carrying what the CLI would write. The memory-system skill gains a section headed "The `author:` field" after the one headed "The `machine:` field", stating the field, its source, its `none` spelling, and its ceiling (provenance, not credential; records written before the field exist stay unclaimed). That section does not ask a session to hand-write the field, and it says the guard accepts the field on the project tier for a record carried in from a CLI-written tier. Four existing passages take the field: the reference table's `add-type`, `add-operator`, `get` and `find` rows, the field list under the heading "Where a hand-written frontmatter field lands" (the bold lead "So write every field at the top level"), and the section headed "The frontmatter guard". `docs/architecture.md`'s `frontmatterValue` paragraph (the bold-free sentence "It reads each of `tags:`, `created:`, ...") adds `author:` to its enumeration. Tests: a created record carries the id where `CLAUDE_CODE_SESSION_ID` is id-shaped and `none` where the variable is absent or malformed; `--update` preserves the value; `get` prints the line and `find`'s lexical hit carries the value; the guard accepts the field at the top level and under `metadata:`, refuses it under any other key, and refuses a value outside the charset.

Acceptance: tests green and watched red first; `node --test test/memq*.test.js test/memory-frontmatter-guard*.test.js test/size-ratchet.test.js`, plus every test file that reads a document this section edits, `test/doctrine-parity.test.js` among them, green with delta named against a recorded baseline, the changeset carrying `test/size-budget.json` re-synced to the grown skill and test files; skill and architecture text updated with no em dashes.

### 2. Store-relative anchors for machine-scoped operator records
Model: opus

`memq anchor --operator <name> <path>...` is admitted where the record's `machine:` matches `os.hostname()` caselessly, resolving each path against the store root (what `memoryRoot()` returns, `~/.claude` in the default configuration, with no git check made) and refusing a path outside it under the existing anchor grammar. The `anchors:` line stores each entry as `<path>@<sha>` with the path relative to the store root, the form the project tier stores relative to its own root. The hash is the file's bytes through `blobSha`, with no git call, so a sync commit changes no reading. Every other `--operator` call refuses as today, with the `--operator` refusal naming the machine rule (a store-relative anchor is admitted only on a record whose `machine:` names this host); the `--type` refusal is unchanged, a type record carrying no `machine:` for the rule to apply to. `get`, `decay-scan`, and `recall` report drift for those records on the matching host and the not-checked cause (`record is scoped to another machine`) on any other. The column-zero guarantee holds throughout, and it fixes each line's shape. On the matching host `get --operator <name>` prints one line at column zero in memq's own words carrying counts alone, `anchors: <n> checked against the store root, <d> changed since written`. Under it, where `triggerReport` prints and indented the same way, it prints one `anchors: <path> <state>` line per anchor. The reader learns which store file changed, and no path sits at column zero. `decay-scan`'s `DRIFT` block and `recall`'s digest each carry the record's name through `sanitize` with the same counts and never a path, and `memq get --operator <name>` is where the paths are read. Off-host, all three print the fixed not-checked cause and nothing from the record. A shared-tier record this section does not admit keeps the fixed sentence it has today. The session-start drift line gains its own sentence for the operator tier, worded `1 operator memory scoped to this machine anchors a store file that has changed since it was written; memq decay-scan lists it.` (plural: `N operator memories scoped to this machine anchor store files that have changed since they were written; memq decay-scan lists them.`), a count and this hook's own words with no store text on it. The operator reading holds the same three states `driftNudge` keeps apart for the project tier, each with its own sentence. The unsettled one reads `N operator memories scoped to this machine could not be checked against the store files they anchor; memq decay-scan says why.`, and the bounded one mirrors the project tier's bounded sentence with `operator memories scoped to this machine` as its subject. The operator reading takes its own budget at the same three caps, `DRIFT_RECORDS_CAP`, `DRIFT_BYTES_CAP` and `DRIFT_ENTRIES_CAP`, so a large project tier cannot starve it. Off-host operator records are not counted there at all, their not-checked cause belonging to the three verbs above, and the operator-tier reading is taken against the store root memq resolves only where the project-tier check already runs, so a pinned session (`anchorRoot` answering null, `driftNudge` in `plugins/claude-kit/hooks/memory-session.js`) stays silent on both tiers as today. These curated passages state the old contract and are rewritten in this section's changeset to state the new one: `docs/architecture.md`'s anchor-tier paragraph ("The tier is the project tier and only it, in this version ... the type and operator tiers have neither"), and in `docs/security-model.md` the anchor-surfaces paragraph's closing sentence ("a shared-tier record's anchors are answered with fixed text carrying nothing from the record at all"), the backup paragraph's `memq anchor` sentence ("rewrites one project-tier record's `anchors:` line"), the operator-tier paragraph's clause "the tier is not emitted at session start", and the paths paragraph's clause "the operator tier being deliberately absent from what session start emits". That paragraph's clause "its file anchors and its `glob:` triggers stay project-scoped" stays as written, since the recognition nudge is unchanged and reads the project tier's anchors only; the session-start clauses narrow to the tier's records being absent, the drift line carrying a count derived from it and nothing else. The memory-system skill's section headed "The `anchors:` field" and the reference table's `memq anchor` row both state the admission and the machine rule. That row opens "Record which files a project memory is about" and names no tier refusal, so the machine rule is new text there rather than a rewrite. The memory-system rationale ledger's entries keyed on the anchor verb refusing `--type` and `--operator` are read and brought current in the same changeset, as that ledger's own rule asks. Tests over a fixture store: anchor admitted on a matching host, refused on a non-matching one with the machine rule named, drift reported when the anchored store file changes, not-checked reported off-host, each of those two driving `get`, `decay-scan` and `recall` and asserting no anchored path at column zero, and in `test/memory-session.test.js` the session-start line carrying the operator-tier count for a drifted store-relative anchor with no path on the line, the unsettled and the bounded sentence each pinned by one case, and silence under a pinned session.

Acceptance: the five tests green, watched red first; the memory-system skill's anchor section and table row, `docs/architecture.md`, and `docs/security-model.md` updated as above; `node --test test/memq*.test.js test/memory-session.test.js test/size-ratchet.test.js`, plus every test file that reads a document this section edits, `test/doctrine-parity.test.js` among them, green with delta named, the changeset carrying `test/size-budget.json` re-synced to the grown skill and test files.

### 3. The backup-shadow pin
Model: sonnet

The test named "no reading verb resolves a transient-shaped name, with a live record proving it can speak" in `test/memq.test.js` already holds two of the three cases. Its fixture carries a live `shadowed.md` beside a differing `shadowed.md.bak`, and a backup-only `orphan.md.bak` with an index line naming it. It pins that `memq get shadowed` resolves to the live body, that the backup neither shadows it nor rides along, and that `memq get orphan` answers as absent. Two additions to that same test are what remain. The first drives the literal backup spelling as an argument, `memq get shadowed.md.bak` and `memq get orphan.md.bak`, and asserts each resolves to nothing. That spelling is the one the kaizen note in Evidence says once resolved as a record, and it is the one that can fail. The second counts rather than matches, asserting `memq recall` lists `shadowed` exactly once, counted as digest lines whose name field equals `shadowed`. Where the argument case fails, the section stops and reports rather than fixing, since the fix belongs to the listing grammar the memory-system skill already claims.

Acceptance: the pin green, or a Chapter naming the failing case with the listing code it points at; `node --test test/memq*.test.js test/size-ratchet.test.js` green with delta named, the changeset carrying `test/size-budget.json` re-synced to the grown test file.

## Out of Scope

- Authenticating any writer. Provenance only.
- Cross-tier anchors and anchors on non-machine-scoped shared records.
- Rewriting existing records to add the field; they stay unclaimed by construction and the skill says so.
- Filling the shared memory database's `mem.Record.Author` column. That takes a change to the publisher's batch, to `mem.usp_UpsertRecords` and to the installer's schema version, then an install on the host under a deploy login, which is the operator's act. No procedure projects the column and no read surface prints it. `docs/backlog.md` carries it as a next step.

## Assumptions

- assumed 2026-09-08 (source: `docs/security-model.md`'s paths paragraph, which keeps the operator tier's records out of the session-start emission, and the drift line's bounded design in `memory-session.js`): the session-start drift line excludes off-host operator records from its count entirely rather than folding them into the "could not be checked" sentence, since every record scoped to another machine would otherwise be counted on every session start on every other machine; reversal: a later session adds an off-host count sentence to `driftNudge` and extends the memory-session test.
- assumed 2026-09-08 (source: `driftNudge`'s single stand-down at a null `anchorRoot`, `memory-session.js`, and the pinned-session silence `test/memory-session.test.js` already pins): the operator-tier session-start reading rides only where the project-tier check runs, so a pinned session stays silent on both tiers; reversal: a later session splits the stand-down so the operator-tier reading takes the store root independently of the project root, and re-pins the pinned-session test to the new sentence.
- plan review 2026-09-08 (plan-reviewer at fable, effort high): 12 findings, 12 fixed, 0 assumed, 0 asked, 0 discarded.
- assumed 2026-09-21 (default): the record-name cap the guard applies to the field is the constant memq already exports for record names, found in the code by the implementer; reversal: name the constant here.
- assumed 2026-09-21 (default): Branch-and-PR with no cadence prose means one draft pull request for the plan; reversal: the header names a pull request per section.
- blind read 2026-09-21, after the re-anchor at 0c6093e7: 12 questions, 10 answered, 2 assumed, 0 asked.
- gating litmus 2026-09-21: 3 definitions, 0 one-sided, 0 crossed, 0 unplaced, 1 under-length, the print set, which is a closed list of two surfaces.
- plan review 2026-09-21 (plan-reviewer at fable, effort high, through Workflow): 13 findings, 13 fixed, 0 assumed, 0 asked.
- re-anchor check 2026-09-21 against trunk 974bfebc, where the memory database plan merged after the reviews above: 0 facts falsified, 0 line numbers moved, 1 conflict found. The database's `mem.Record.Author` column has no writer, and the Related entry said this plan's field would fill it. The entry now states what the code does, and filling the column is declared under Out of Scope (route (b), 2026-09-21: reversible, since the field rides in the published body and a later fill reads it from there).

## Related

- Kaizen triage record `kaizen/archive/2026-09-02-pass-triage.md`.
- `claude-kit_kaizen-code-batch_spec_v1.md` section 10 adds `board:` to the same frontmatter grammar, in `MEMQ_FIELDS`, the `add-operator` parse, and the memory-system field list. That plan runs ahead of this one in the queue, so `board:` is in the grammar when this plan's own key lands beside it.
- `../archive/claude-kit_memory-database_spec_v1.md` is complete. Its `mem.Record` table carries an `Author` column that nothing writes. The publisher's batch, `collectRecords` in `plugins/claude-kit/scripts/memory-database.js`, reads `machine:`, `tags:` and `supersedes:` from a record and no `author:`. The procedure `mem.usp_UpsertRecords` names no author value in its JSON contract. This plan leaves both as they are, per Out of Scope, so the column stays null after this plan lands. The field still reaches the database, inside the record body the publisher sends whole.
- `claude-kit_liveness-by-session-identity_spec_v1.md`: the same "narrows an honest writer" ceiling applied to the coordinator directory.
- `../archive/claude-kit_write-time-neighbours_spec_v1.md`: the pre-lock neighbours block on the same two creation paths this plan's `author:` field is written on.

## Chapters

### Interim board 1 - 2026-09-22

**Section 1, in review round 1.** `implementer-opus` built the `author:` field. The first-green commit is `c1c65a68`, on `feat/memory-record-provenance` over the arming commit `51ced7c2`. Lane, measured on SCOTT-CLAUDE at that commit with 14 foreign node processes live: `node --test test/memq*.test.js test/memory-frontmatter-guard*.test.js test/size-ratchet.test.js test/doctrine-parity.test.js`, 1105 tests, 1103 pass, 0 fail, 2 skipped, exit 0. The baseline at `51ced7c2` was 1100, 1098, 0 and 2.

The implementer's report was DONE_WITH_CONCERNS, and each concern is accepted:
- **The spec's named field list does not exist.** The paragraph under "Where a hand-written frontmatter field lands" holds no enumeration. The rationale ledger retired it at `d2c43f1e`, near `rationale-ledger.md:2136`. The new skill section states the field instead of reversing that ruling.
- **An author value outside the grammar reads as no author** (`authorOrNull`, mirroring `machineIdentityOrNull`). The name reduction alone keeps spaces, so free text would otherwise reach a hit line.
- **The test harness `homeEnv` strips `CLAUDE_CODE_SESSION_ID`,** as `childEnv` already did, so a create under test writes the same value in a session and in CI.
- **33 existing pins moved,** because every create now writes a frontmatter block. That is the Decision 1 behavior.

Add-decisions: `memq.isAuthorValue` is exported to the guard and gated in `MEMQ_SYMBOLS`, one grammar for writer, readers and guard. `authorOrNull` is the read gate. Neither adds a mechanism the spec does not name.

**Live dispatches.** Round 1 at fable: the adversarial, blind, security and performance lenses. The last two are owed because the frontmatter guard is a per-call hook.

**Next.** Adjudicate round 1, fix, re-gate, and write Chapter 1.

### Chapter 1 - 2026-09-23

Completed: 1. The `author:` field
Next: 2. Store-relative anchors for machine-scoped operator records

**What shipped.** `memq add-type` and `memq add-operator` write `author:` on every create, from the id-shaped `CLAUDE_CODE_SESSION_ID` or the literal `none`. `get` prints it under the provenance fence, and `find`'s lexical hit carries it in the tier parenthesis, or in a parenthesis of its own on an unlabeled line. The frontmatter guard adds the field to `MEMQ_FIELDS` and refuses a value outside the grammar memq reads. The memory-system skill has a section on the field, and the security model counts it. Commits on `feat/memory-record-provenance`: `c1c65a68` (the build), `9ddda6e8` (round 1 fixes), `1af9050c` (round 2 fixes).

**Review round 1, at fable.** Adversarial and blind: APPROVED_WITH_CONCERNS. Security: ADVISORY. Performance: CLEAR.
- Fixed:
  - The security model under-counted `CLAUDE_CODE_SESSION_ID`'s readers and the guard's fields and deny paths. This was security's one Major.
  - The skill's rewrite-carry list omitted `author:`.
  - Nothing said the author line counts against the 65536-character record cap.
  - The guard's deny text overstated what it refuses.
  - The `find` header comment did not name the author token.
- Declined:
  - Performance's three Minors. The extra frontmatter walks are bounded by the record cap, and a fix costs more code than it saves.
  - Blind's unlabeled-`find` ambiguity. The token reads `author:<value>` and so names itself, and section 1 prescribes that form.
  - Security's forged-author Minor, which is accepted by Decision 1 as provenance rather than credential.
- The adversarial Minor asking for `test/memory-session.test.js` in the lane was taken: it runs in every lane below.

**Review round 2, one adversarial lens at opus, effort high, through Workflow.** APPROVED_WITH_CONCERNS, five Minors, all fixed in `1af9050c`:
- The reader count is five, not four. `kit-registry-stamp.js` `push` reads the id at line 700.
- "The one reader whose output leaves the machine" was too wide, since the checkpoint and stamp CLIs also reach synced registry entries. It now reads "the one reader that writes the id into a record other sessions print".
- The deny text gave the writer's set as its reason for a reader-grammar refusal.
- The skill's `find` sentence did not cover the unlabeled line.
- `board:` left the project-tier rewrite-carry list, which round 1 had added it to. The field has no effect on a project-tier record.

Round 2 confirmed the declines above as sound. No Major or Critical remains open, so the section closes.

**Surprise.** A lane naming `test/size-budget.test.js`, a file that does not exist, exited 0 with that name silently skipped. The ratchet file is `test/size-ratchet.test.js`, and every lane below names it.

**Gate.** Targeted lane at `1af9050c` on SCOTT-CLAUDE, with foreign node processes live as in the interim board: `node --test test/memq.test.js test/memory-frontmatter-guard.test.js test/memory-session.test.js test/size-ratchet.test.js test/doctrine-parity.test.js test/memory-recognition-nudge.test.js test/memq-grant.test.js`, 1293 tests, 1291 pass, 0 fail, 2 skipped, exit 0 read from the run. This file set is wider than the interim board's 1105-test lane and has no baseline of its own at `51ced7c2`. The comparable claim is the fail count: 0 at the baseline, 0 here. The same seven-file set was red once, before the deny-text test pin was updated to the new wording. That was 1 fail, caused by this round's text change, and it is fixed in the same commit.

Commit Model: Branch-and-PR. Section commits land on `feat/memory-record-provenance` and are pushed. The draft-per-plan pull request opens at finishing.

### Chapter 2 - 2026-09-23

Completed: 2. Store-relative anchors for machine-scoped operator records
Next: 3. The backup-shadow pin

**What shipped.** `memq anchor --operator` admits a record whose `machine:` names this host, compared caselessly. It resolves paths against the store root with the project tier's own containment checks, hashes them through `blobSha` with no git call, and takes the operator tier's store lock. Every other operator record is refused in one line naming the machine rule. `get` prints a count line at column zero and indented per-anchor lines under the provenance fence. `decay-scan` and `recall` carry names and counts only. Off-host, all three print the fixed not-checked cause and nothing from the record. The session-start drift line gains operator-tier sentences, silent under a pinned session. The memory-system skill, its rationale ledger, `docs/architecture.md` and `docs/security-model.md` state the new contract. Commits on `feat/memory-record-provenance`: `b5386d6d` (build), `40b409c0`, `15ce8f06`, `03f2f51d` and `38b37f9b` (review rounds 1 to 4).

**Amendments to the spec's wording, recorded here as the section's own deviations.**
- The bounded operator sentence takes `operator memories` as its subject, not `operator memories scoped to this machine`. Its count includes records whose `machine:` was never read, so the scope claim would be untrue. Round 1's adversarial and blind reviewers both found it.
- The operator reading has four bounds, not "the same three caps". A new `heads` bound of 2000 (`DRIFT_OPERATOR_HEADS_CAP`) caps the head reads that learn each record's scope. The records cap and the byte and entry meter cut only records scoped here that anchor a file, the ones hashed. A bound the caller does not pass is no bound. The reason is measured on this machine's real operator tier: 377 records, 63 carrying `machine:`, none anchoring anything. The single 200-record budget made every session start print "stopped short of 177 operator memories". 377 head reads took about 23 ms. With the split, the real tier reads whole with nothing unexamined.
- The operator bounded sentence ends "bytes hashed" where the project tier's ends "bytes read", since on the operator tier a spent byte meter stops hashing and never the scope reads.
- The `--type` refusal text changed, against "the `--type` refusal is unchanged". Its old reason ("the type and operator tiers have neither") became false once `--operator` was admitted.

**Additions the spec does not name, each declared in its commit.** A `, <u> could not be checked` clause on the count line, so an unexaminable anchor never reads clean. A sentence for an operator tier that could not be examined, and one for an operator check that threw. `recall`'s operator clause follows what was actually checked, with its own causes for an unexaminable tier and for records tried with no check completed. A record scoped here whose `anchors:` line cannot be parsed counts as one anchor not checked, with the frontmatter cause on `get`. One scoped elsewhere with an unparseable line takes the elsewhere answer.

**Review.**
- Round 1, at fable: adversarial and blind APPROVED_WITH_CONCERNS, security CLEAR, performance CLEAR. One Major, the bounded sentence's unread scope, fixed. Declined: refusing store-root secret files as anchors, since `anchor` is withheld from the grant and a SHA-1 of a token file is not invertible; and the performance Minors on repeated realpath, hostname and unmetered `recall` hashing, the last stated in the security model as an availability cost.
- Round 2, one adversarial lens at opus: APPROVED_WITH_CONCERNS, thirteen Minors, all fixed. Declined: none. Accepted untested: `recall`'s "operator tier could not be examined" clause, since a null from `storeAnchorDrift` is hard to build in a fixture.
- Found by the round 2 fix agent on the real store: the false "stopped short of 177" line, fixed by the heads split above.
- Round 3, at opus: CHANGES_REQUIRED. Majors: a spent meter still cut scope reads, no test reached the heads bound, and these amendments were unrecorded. All fixed, the last by this Chapter.
- Round 4, at opus: APPROVED_WITH_CONCERNS. One Major, that the flake figures below carried no machine or contention reading, answered by the moment-pin there. Six Minors fixed in `38b37f9b`: the unused single-budget fallback removed, the unit test retitled and given its records-bound case, "bytes hashed", the head-read ceiling corrected to about 131 MB, a measurement moved out of a code comment, and `recall`'s clause comment rewritten.

**Accepted as is.** An operator record with an unclosed frontmatter block has no readable `machine:`, so it stays unscoped and out of the drift readings.

**Local state.** The round 2 fix agent ran `memory-session.js` once against the real `~/.claude` while checking that it parsed. Both sync spawn markers predate the run, so no background sync started.

**Flake found, not caused here.** `test/memory-database.test.js` "a promote runs under the curator login..." read `budgetMs` 3999 against 4000 on two lane B runs. It reads the real clock across `promoteRecord`'s deadline arithmetic, in a file this branch does not touch. Measured on SCOTT-CLAUDE on 2026-09-23, with other sessions' relay and sidecar node processes live and no foreign test runner in the process poll:
  - Isolated, the one test failed 2 of 13 runs on the branch and 0 of 6 on an `origin/main` export.
  - The whole `memory-database.test.js` file failed 0 of 5 on each side.
  - Whole lane B failed 2 of 6 runs on the branch and 0 of 3 on the `main` export.
  
  Those counts are too small to separate the two sides. That the branch's larger `memq.js` widens the window through the lazy require is inferred, not measured. It goes to the backlog at finishing.

**Gate.** Targeted lanes at `38b37f9b` on SCOTT-CLAUDE, exit codes read from each run:
- Lane A (`test/memq.test.js`, `test/memory-frontmatter-guard.test.js`, `test/memory-session.test.js`, `test/size-ratchet.test.js`, `test/doctrine-parity.test.js`, `test/memory-recognition-nudge.test.js`, `test/memq-grant.test.js`): 1308 tests, 1306 pass, 0 fail, 2 skipped, exit 0. The baseline at `911b4195` was 1293, 1291, 0 and 2, so +15 new tests and no new failure.
- Lane B (`test/ledger-preamble-parity.test.js`, `test/hook-canary.test.js`, `test/memory-sync.test.js`, `test/compact-deferral-nudge.test.js`, `test/memory-database.test.js`, `test/review-loop-provenance.test.js`), after `build.ps1`: 379/379, exit 0 on re-run. Runs at `03f2f51d` and `38b37f9b` each hit the flake above once (378/379, exit 1); the three comparison runs at `38b37f9b` were 379/379. The baseline is 379/379.

Commit Model: Branch-and-PR. Section commits land on `feat/memory-record-provenance` and are pushed; the draft-per-plan pull request opens at finishing.

### Chapter 3 - 2026-09-23

Completed: 3. The backup-shadow pin
Next: finishing pass

**What shipped.** The test "no reading verb resolves a transient-shaped name, with a live record proving it can speak" in `test/memq.test.js` drives the literal backup spelling as an argument. `memq get shadowed.md.bak` and `memq get orphan.md.bak` each answer as absent: exit 0, `nothing named` on stderr, nothing on stdout. `get` joins its argument onto `.md` before it looks anywhere, so the spelling hunts for `shadowed.md.bak.md`, which no rung holds. The section's stop-and-report branch did not fire. `memq recall` lists `shadowed` exactly once, counted by the digest line's name field, and only one name field starts with `shadowed`, so a backup listed under a cut stem is caught too. Commits: `d8403c34` (the pin) and `5381da59` (review fixes).

**Controls.** The absence predicate reads the live spelling `shadowed` as present. The name-field count reads 2 on a synthetic digest holding the name twice. On a synthetic digest carrying `shadowed` and `shadowed.md.`, the exact count reads 1 and the prefix count 2, which is the gap the prefix count closes.

**Review, at fable.** Blind APPROVED with one Minor, a backup listed under a variant stem that the exact count would miss, fixed by the prefix count. Adversarial APPROVED with one Minor, a comment citing `recallDigest` for the two-space join where `cmdRecall`'s per-tier line builders make it, fixed.

**Brief breach, no harm found.** The `implementer-sonnet` dispatch used `git stash`, which its brief forbade. Its one entry, `mrp-s3-wip-1790145867` at 02:44:27, held only `test/memq.test.js` and was dropped by the agent itself. The unreachable stash commits from other sessions all date from 2026-09-08 to 09-19, so no other session's entry was lost. The uncommitted `docs/backlog.md` edit in this worktree was intact afterwards.

**Gate.** Targeted lane at `5381da59`: `node --test test/memq.test.js test/size-ratchet.test.js`, 867/867, exit 0, against 867/867 at `3f6278be`. The additions extend an existing test, so the count is unchanged. Whole gate at `d8403c34` on SCOTT-CLAUDE, with no foreign test runner in the process poll, run serially after a baseline on a detached `origin/main` worktree at `ea09a661`, each after `build.ps1` (exit 0):
- main: 3943 tests, 3934 pass, 1 fail, 8 skipped, exit 1.
- branch: 3963 tests, 3954 pass, 1 fail, 8 skipped, exit 1.

The one fail on both sides is "loadIndex answers a status, never a throw, for a cwd the store refuses to name", the sidecar test that reds from a linked worktree. The branch adds 20 tests and no new failure. This repo defines no contention lane (`docs/architecture.md`, the `test/` entry).

Commit Model: Branch-and-PR. Section commits land on `feat/memory-record-provenance` and are pushed; the draft-per-plan pull request opens at finishing.
