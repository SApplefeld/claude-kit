# The store's authoring verbs show a record's nearest neighbours before writing it, and the decay scan nominates live pairs that read as one fact

Status: Ready
Commit Model: Commit-and-Push
Created: 2026-09-04

Session model: any executor session in the kit repo; three sections in order, since section 2 reuses the pairwise reading section 1 introduces and section 3 documents both. Authored by the KIT: Expert seat on a capability gap the operator proposed and the NEO-CLAUDE coordinator seat captured to the kaizen inbox (kaizen/notes-NEO-CLAUDE.md, the 2026-09-04 note on the absent write-time duplicate check), forwarded by the operator at the keyboard. Anchors are authoring-time and named by function; re-locate every hit by content.

## Dispatch Authorization

Authorized 2026-09-04 by the operator at the keyboard of the KIT: Expert session, as a spec to be drafted at the proposal's recorded shape and armed onto the kit worker's queue, the grant covering any session holding this plan. The Expert seat authored the spec and the operator's own typed arming is the arm, so author and citer are different parties.

## Goal

The memory store's search is strong, and its write path consults none of it. `memq add-type` and `memq add-operator` take a name, a description and a body and write them under the tier lock, and the only duplicate check on that path is an exact-name collision, so a record that says what an existing record already says is authored against the author's own recall rather than against the store, and the overlap is noticed later, by a reader who happens to search first, or never. One session on one seat showed both outcomes with the search as the only variable: a record banked and found afterwards to overlap two existing records that covered part of it better, costing a repair, and a later write made unnecessary because the author searched first and found the fact already applied eight times. The operator tier alone holds 268 records carrying 1,080 read stamps, so the cost of an unnoticed overlap compounds with every reader. When this plan is done: the two authoring verbs run the store's own semantic search over the incoming name and description before writing and print the nearest live neighbours with their scores, flagging any at or above a floor as a likely overlap, and then write anyway; the decay scan reports live same-tier pairs at or above that floor as replacement candidates, nominating and never retiring; and the memory-system skill states both, and tells a project-tier author, whose Write no verb sees, to search first.

## Evidence

- `plugins/claude-kit/scripts/memq.js`, `cmdAddType` and `cmdAddOperator`: every validation runs before the tier lock is acquired, and the write is name, index line and record under the lock; the check the code comments call the duplicate check is `fs.existsSync` on the record's filename. Nothing on the path compares content.
- The same file, `semanticChannel`: the search's semantic block, an ordinary function in the same module scope as the two authoring verbs, so an authoring verb can call it in-process with no spawn; it lazily requires `memory-index.js`, which owns the embedder, the per-machine vector index and its absent and unusable degrades. Scores are cosine similarity from the embedder, printed raw per hit; the module's own known-answer control scores a paraphrase near 0.26 and an unrelated sentence near zero, and `SEMANTIC_FLOOR = 0.1` is the admission floor. The lexical block has no score, and the model-judged block has no number and sends the query and candidates off the machine.
- `cmdDecayScan` and `tierDecayCandidates`: hold each live record's name, description, tier, idle days, applied evidence, pin state and supersession label; they never require `memory-index.js`, so the scan has no similarity reading today and its only notion of replacement is the hand- or CLI-authored `supersedes:` pointer, which it nominates for archive whatever the idle clock.
- `plugins/claude-kit/hooks/memq-grant.js`: `find` is withheld from the fleet's prompt-free grant because it loads an embedder from a directory the command line does not name; `add-type` and `add-operator` are granted in their plain form with `--body-file`, a body-carrying `--update`, `--supersedes` and `--trigger` screened. No new flag is needed by this plan, so the screen is untouched.
- `test/memq.test.js`: `makeFakeEmbedder` and `withEmbedder` stand up a deterministic fake embedder under a temp module root, and every test runs embedder-absent by default; `test/memq-grant.test.js` is the fleet harness, whose `FLEET` constant is the engine store-signal pair. The project memory `memq-suite-has-two-store-harnesses` records which of the two refuses repair and delete.
- `plugins/claude-kit/skills/memory-system/SKILL.md`: the `add-type` and `add-operator` rows document every flag and refusal and no overlap check; the `decay-scan` row and the four-remedies paragraph describe supersession by pointer alone; no sentence tells an author to search before writing a shared-tier record.
- The project tier has no memq authoring verb: a project memory is written with the Write tool and screened only by the frontmatter guard, which checks shape and never content.

## Approach

Before the lock, on the creation path only, the two authoring verbs run the semantic channel in-process with the query `<name>: <description>`, take the three highest-scoring live hits the search admits, ordered by raw similarity rather than the search's blended rank, across every tier and store the index reaches, archived records excluded and superseded ones labeled as the search labels them, and print them on stderr as a neighbours block: name, score, tier and store, and the word `likely overlap` on any hit at or above `NEIGHBOUR_FLOOR`. Then the write proceeds exactly as today. The block is three lines wherever the search admits three hits, so the floor is a label on a line the author already sees and never a gate. A `--update` runs no check: it repairs a record already there, whose neighbours were shown when it was written, and the record's own prior version would otherwise rank first against itself. Embedder absent or unusable: one line, `memq: neighbours not checked (<cause>); remedy: <remedy>; the write proceeds`, the cause and remedy the search's own and the line reshaped because no lexical matches are served here, and the write proceeds. Under the engine store signals (`KIT_MEMORY_ROOT` with `KIT_MEMORY_ROOT_ALLOW_DATA=1`) the check is skipped and one line says so: the fleet grant withholds `find` because it loads an embedder from an unnamed directory, and an in-process load inside a granted verb would route around that reason. The model-judged block is never used by an authoring verb, so nothing an author types leaves the machine.

The decay scan gains a pairs block on stderr after its anchor-drift block: for each tier the scan reaches, every live pair at or above the floor, one line per pair with both names and the score, pinned records listed, pairs already joined by a `supersedes:` pointer excluded since the store already holds their answer. It reads vectors from the index `memory-index.js` keeps and embeds what the index lacks the way the search does, so a scan on a freshly synced store still answers. It nominates and never moves: no `decay-prune` flag acts on a pair, and the remedy is the author's, a fresh record carrying `--supersedes`, a repair, or a delete, per the skill's four remedies. Embedder absent, or the engine store signals set: the block's heading says not checked and why.

`NEIGHBOUR_FLOOR` is one constant in `memq.js` beside the semantic constants, seeded at 0.30, above the 0.26 paraphrase control and well below the 0.59 the inbox note reports for a found duplicate. It is a seed rather than a measurement, tuned at a decay pass that has a pairs block to read, and the skill says so in the words the decay thresholds already use.

The surfaces that read or write a record's similarity were swept by a read-only scout over `memq.js`, `memory-index.js`, the hooks and the skill, searching for `duplicate`, `overlap`, `neighbour`, `similar` and `supersed`; every hit is either the exact-name check, the semantic constants, or the supersession machinery, all named above, and the Files in scope below are drawn from that return.

## Decisions

Decided 2026-09-04 by the Expert seat; reversible at arming.

1. **Warn, never refuse.** A refusal keyed on a similarity score blocks honest writes on a seed nobody has measured, and the author sees the neighbours either way; the proposal asked for exactly this.
2. **The floor is a seed at 0.30, and the block prints three lines whatever the scores.** The floor labels; it does not gate. Tune it at a decay pass with evidence, never widen speculatively.
3. **Semantic only; the judged block is never used by an authoring verb.** An authoring verb that posted a record's name and description to the model endpoint would add an egress the security model does not describe, for a ranking the author does not need; the lexical block adds nothing over a name-and-description query.
4. **Skip the check under the engine store signals rather than load the embedder there.** The grant's reason for withholding `find` is the load, and the check is a convenience the unattended vector can do without; the write still lands.
5. **The project tier is covered by instruction, not by the frontmatter guard.** The guard is a shape check at the write door of a PreToolUse hook; loading an embedder there would put seconds of latency in front of every memory Write for a check the author can run as `memq find` in their own words, which is what the skill will say.

## Sections of Work

### 1. The two authoring verbs print a neighbours block before the write. Model: opus

`semanticChannel` already returns its hits and notes without printing, the printing living in `cmdFind`; call it from `cmdAddType` and `cmdAddOperator` on the creation path only, after every validation passes and before the lock, with the query `<name>: <description>`, no tag, an empty already-shown set and the archive withheld, and order the hits by raw similarity. The channel is async by design, so the two verbs become async and `main`'s dispatch of them gains the same `.catch` backstop it gives `find`, with their usage and exit-code paths unchanged. Print the block on stderr in the shape `memq: nearest neighbours of <name>` followed by up to three lines `  <name>  <score>  (<tier>:<store>)[  superseded][  likely overlap]`, the last label on any score at or above `NEIGHBOUR_FLOOR`, then a closing line where any hit carries the label: `memq: a likely overlap is a candidate for --supersedes, a repair, or a delete; the write proceeds`. Embedder absent or unusable: `memq: neighbours not checked (<cause>); remedy: <remedy>; the write proceeds`, the cause and remedy the search's own. Engine store signals set: `memq: neighbours not checked under the fleet store signals; the write proceeds`. A `--update` prints no block. A hit is never the record being written, which does not exist yet on the creation path, and never an archived one. The block is stderr only, so the success line on stdout is unchanged and every existing test of it stays green.

Acceptance, each test watched red first on the fake embedder harness: an `add-type` whose description paraphrases an existing same-tier record prints that record as a neighbour with a score at or above the floor and the label, then writes the record and its index line; the same with the neighbour in another tier and in another project's store prints its provenance; an add with no neighbour the search admits prints the heading and no lines and writes; an `--update` of an existing record prints no block; with the embedder absent the not-checked line prints and the write lands; under `test/memq.test.js`'s own engine-signal fixture the skip line prints and the write lands, and `test/memq-grant.test.js`'s plain-form `add-type` grant pin stays green; and a loopback endpoint fixture configured for the judged block records no request during an add, which pins Decision 3.

Files in scope: `plugins/claude-kit/scripts/memq.js`, `test/memq.test.js`, `test/memq-grant.test.js`, and `test/size-budget.json` for the two test files' caps.

Tests: lock that the block is stderr only and the write is never gated; lock the fleet skip in both directions; lock no egress. The expensive failure is a check that quietly refuses or quietly posts.

### 2. The decay scan nominates live pairs above the floor. Model: opus

In `cmdDecayScan`, after the anchor-drift block, print `memq: neighbour pairs (<tier>)` per tier the scan reaches, then one line per live pair at or above `NEIGHBOUR_FLOOR`, `memq: pair  <name>  <name>  <score>`, pinned records included and marked, pairs already joined by a `supersedes:` pointer in either direction excluded, and `memq: no neighbour pairs (<tier>)` for a tier checked whole with none. Vectors come from the index `memory-index.js` keeps; a record the index lacks is embedded the way the search embeds it, and a record that cannot be embedded is counted on the heading, `memq: neighbour pairs (<tier>): <n> not checked`. Embedder absent or unusable, or the engine store signals set: the heading reads `memq: neighbour pairs (<tier>): not checked (<cause>)`, the drift block's own idiom, and no pair lines follow. `decay-prune` is untouched: no flag acts on a pair.

Acceptance, watched red first: two live same-tier records whose bodies paraphrase each other print as one pair with their score; the same pair with a `supersedes:` pointer between them prints nothing; a pinned member prints with its mark; a cross-tier pair prints under neither tier, since a pointer cannot cross tiers and the remedy would have nowhere to land; with the embedder absent the heading names the cause; the scan's exit code and stdout are byte-identical to today's and every existing stderr block's text is unchanged, the new block following the drift block.

Files in scope: `plugins/claude-kit/scripts/memq.js`, `plugins/claude-kit/scripts/memory-index.js` where the pairwise read needs an export the index does not yet offer, `test/memq.test.js`, and `test/size-budget.json` for its cap.

Tests: lock the exclusion of pointed pairs and the cross-tier silence; lock that nothing moves. The expensive failure is a pair nominated that the store already answered, which would teach a reader to skim the block.

### 3. The skill states both, and tells a project-tier author to search first. Model: sonnet

In `plugins/claude-kit/skills/memory-system/SKILL.md`: the `add-type` and `add-operator` rows gain one sentence each on the neighbours block, its floor, its stderr-only shape, its embedder-absent line and its fleet skip; the `decay-scan` row gains the pairs block; the four-remedies paragraph gains the sentence that the scan nominates unlinked live pairs and that the remedy is the author's; the decay-lifecycle section's seeds-not-measurements sentence names `NEIGHBOUR_FLOOR` beside the thresholds it already covers; and the operator-tier and project-type-tier sections' authoring paragraphs gain the instruction to read the neighbours block before the write lands, with the project tier's own paragraph telling an author to run `memq find` in the words of the fact before a Write, since no verb sees that write. In `docs/security-model.md`, one sentence beside the relevance channel's account stating that the authoring verbs' neighbour check runs the local semantic channel only and posts nothing. The skill is a measured file under the size ratchet, so its cap is raised in this section's diff; `docs/` is not measured.

Files in scope: `plugins/claude-kit/skills/memory-system/SKILL.md`, `docs/security-model.md`, `test/size-budget.json`.

## Out of Scope

- Refusing a write on a similarity score, and any `--no-neighbours` or threshold flag (Decisions 1 and 2), so the fleet grant's screen is untouched.
- A content check inside the frontmatter guard (Decision 5).
- Using the lexical or the model-judged block in an authoring verb (Decision 3).
- Cross-tier supersession, which the store does not have; a cross-tier pair is reported nowhere by section 2 for that reason.
- A one-time sweep dispositioning the pairs the first scan reports across the 268 operator-tier records; that is a decay pass's adjudication, run at a close-out by the kaizen or finishing skill's own trigger.

## Assumptions

- assumed 2026-09-04 (default): Commit-and-Push, the kit's default and the worker queue's model; reversal: a header edit before arming.
- assumed 2026-09-04 (source: the scout's read of `memq.js`'s semantic constants and their known-answer control): 0.30 is a defensible seed for `NEIGHBOUR_FLOOR`; reversal: one constant, retuned at a decay pass.
- assumed 2026-09-04 (source: the scout's read of `memq.js`'s module scope): the semantic channel is reachable in-process from the authoring verbs without an export, so the check adds an embedder load per add and no spawn; reversal: none, the cost `find` already pays.
- assumed 2026-09-04 (source: the size-ratchet section of `claude-kit_subtraction-bars_spec_v1.md`): `test/size-budget.json` is on main before this plan runs, so each section raises its test and skill caps in its own diff, a cap being that file's line count for the file and the ratchet a test that fails on any measured file over its cap or absent from the budget; reversal: where the budget is absent, the clause is moot and the Chapter says so, and where it is present but untracked, it is a peer's in-flight work, so the section holds its cap edit rather than staging a file it did not author, names the hold in its Chapter, and lands the raise once the budget is on main.

## Operator Verification

None. The floor's first tuning is a decay-pass judgment the skill already routes.

## Open Questions

None.

## Related

- `docs/archive/claude-kit_memory-supersedes_spec_v1.md`: the `--supersedes` pointer and its four-remedies routing that section 2's nominations resolve into.
- `docs/archive/claude-kit_memory-recognition-reach_spec_v1.md`: the semantic index and embedder machinery section 1 reuses.
- The kaizen inbox note dated 2026-09-04 in `kaizen/notes-NEO-CLAUDE.md` on the absent write-time duplicate check, which this plan dispositions.

## Chapters
