# Memory supersedes: the fourth remedy, for the record that was right and is stale now

Status: In Progress
Commit Model: Commit-and-Push
Created: 2026-08-22

## Goal

The memory store has three remedies for a bad record: delete (never true), repair (wrong body), and archive (aged out, via decay). The missing case is the record that was right when written and has been overtaken: today its correction is a fresh record beside the old one, and both answer `recall` and `find` for 60 idle days plus the old record's applied-stamp extension, up to 425 days, disagreeing the whole time with nothing telling a future session which to trust. When this plan is done, a new record can carry `supersedes: <name>` in its frontmatter, and from the moment it lands the store's read surfaces label and demote the superseded record, `get` still answers for it (a replaced fact is still evidence of what was true), and the next decay pass nominates it for archive regardless of its idle clock. Adopted from the Warden-AI evaluation (candidate 3, decided 2026-08-22).

## Approach

The design decisions, settled 2026-08-22, each with its reason:

- **The new record carries the field, pointing back.** File-per-fact means the old file is not rewritten; a pointer on the successor is one write, and the shared tiers' bar on hand edits stays intact.
- **Label and demote, never auto-archive.** The pointer is model-written; a wrong pointer must cost a mislabel, not a retirement. `recall` labels the superseded record's line; `find`'s lexical block labels; `find`'s semantic block demotes by a new constant (`SEMANTIC_SUPERSEDED_DEMOTION`, seeded 0.1 to match the archive demotion, tunable on the same posture as the other seeded constants) and labels; `get` answers with a note naming the successor, on the same channel the archive note uses; `decay-scan` lists a superseded record as an archive candidate whatever its idle clock, naming `superseded by <name>` as the evidence. Nomination, not retirement: the pass's judgment step still picks, consistent with "crossing a threshold nominates".
- **Same-tier only in v1.** A cross-tier pointer meets the union-merge and provenance questions the shared tiers were built to avoid; the same-tier case is the observed need.
- **Creation-only, like `--tag` and `--machine`.** `--supersedes <name>` on `add-type` and `add-operator`, refused alongside `--update` exactly as the other creation-only fields are; a record needing a different pointer is a delete and a fresh write. The project tier authors the field by hand frontmatter, as it does `tags:` and `pinned:`.
- **A dangling pointer is a typo guard at write time and inert at read time.** The write verbs refuse `--supersedes` naming no live same-tier record (catches the typo while the author is present). At read time a pointer whose target is archived still labels the archived copy (the claim is still true); a pointer whose target is absent entirely labels nothing and is inert.
- **The fleet grant is unchanged.** Superseding is demotion-class, the same class as the granted `decay-prune --archive` flags; the grant hook screens no new flag. Section 2's security review confirms or refutes this posture; refuting it means withholding at the hook, which owes a per-site red.
- **Repair compatibility is free.** The repair path carries a record's frontmatter across verbatim (it never invents or drops fields), so a successor's `supersedes:` survives its own later repair with no new code.
- **The superseded map is built by an inverse scan of live records, per tier, at read time.** The pointer lives on the successor, so knowing that record X is superseded requires finding a live record whose frontmatter names X: each read surface that labels or demotes builds a name-to-successors map by walking the tier's live records' `supersedes:` fields once per invocation, the same cost class as the decay scan's per-record pin walk. Only a live successor counts: a successor that has itself been archived or deleted no longer labels its target, because the label's justification is that a live record replaces this one. `pinState` is the per-record reader shape to mirror for the field; the map itself is new code with no existing precedent, which is why it is stated here rather than left to be discovered.
- **Chains and fan-in resolve one hop at a time, and a cycle is dropped.** Each pointer labels its direct target only, with no transitive resolution: where B supersedes A and C supersedes B, A's label names B and B's names C, and a reader follows the chain hop by hop. A fan-in (several live successors naming one target) labels the target with its pointing successors, name-ordered up to a display cap with the remainder counted (`SUPERSEDED_SHOWN`, the shape `DECLARERS_SHOWN` already sets), and demotes once, a flag rather than a sum. A cycle labels nothing, on both shapes a pointer can make one: a mutual pair each naming the other, and a record naming itself, which is that pair with one file playing both halves. Neither asserts a replacement, and reading one as if it did loses a fact rather than mislabeling it, since a scan would nominate both halves for archive. Section 2's write path cannot mint either shape (the create path refuses an existing name and `--supersedes` requires an existing live one), so both are hand-written frontmatter, which the project tier authors by design.

A contract-surface sweep ran 2026-08-22; Files in scope derive from it. Anchors as of commit 872089b; re-locate by content. The relevant surfaces: the frontmatter walk and per-key readers (`memq.js:1773-1940`; `frontmatterField` at :1852 is the reader shape to mirror, `pinState` at :1935 the per-record scan precedent), the semantic constants and blend (:286-315, :2634-2686), hit-line labeling (:2737-2776), `recallDigest` (:3352+), the add-verb flag loops (:6853+, :7330+) and the creation-only refusal site (:7410-7414), the usage banner (:2011-2034), `memq-grant.js` (untouched; its mechanical granted-equals-dispatch-minus-withheld pin at `test/memq-grant.test.js:718` must stay green unmodified, which is itself evidence the grant posture is additive), the memory-system skill's reference rows and lifecycle sections, and the docs (`security-model.md:294` region, `architecture.md:129`/`147`/`157-161` region).

## Sections of Work

### 1. The field and the read paths

Model: opus

Implement the `supersedes:` frontmatter reader (top-level, inline, single name; mirror `frontmatterField`'s grammar including the indented-is-not-the-field rule), the per-tier inverse map per the Approach (live successors only, built once per invocation by the surfaces that label or demote), and the read-surface behavior: `recall` labels the superseded record's digest line; `find` lexical labels; `find` semantic demotes by `SEMANTIC_SUPERSEDED_DEMOTION` and labels the hit line with a `superseded` token in the style of the existing `retired` token; `get` on the superseded name emits the successor note beside its body; `decay-scan` lists the record as an archive candidate naming the pointer as evidence, pinned records excepted (a pin still beats a nomination, consistent with the pin binding the decay pass). The archived-target and absent-target read behaviors per the Approach.

Tests, red first, one per site: the reader's grammar (top-level reads, indented does not, single name only); recall's label; find's lexical label; find's semantic demotion below an equally similar non-superseded twin, mirroring the archived-twin test's shape; the hit-line token; get's successor note; decay-scan's nomination and its pin exception; the dangling-pointer and archived-target read behaviors; an archived or deleted successor no longer labels its target; a two-hop chain labels each target with its direct successor only; a fan-in labels with its live successors, name-ordered and capped with a counted remainder, and demotes once. The demotion constant's seed value is asserted once, beside the other semantic constants' pins.

Files in scope: `plugins/claude-kit/scripts/memq.js`, `test/memq.test.js`.

### 2. The authoring flag

Model: opus

Add `--supersedes <name>` to `cmdAddType` and `cmdAddOperator`: parsed in the flag loops, written as a top-level frontmatter line beside `tags:` and `machine:`, refused alongside `--update` at the creation-only refusal site, refused when no live same-tier record holds the target name, target name validated before the existence check against the same identifier grammar record names already answer at create time (the `[\w.-]+` charset and cap the `--machine` value shares), and the usage banner updated. The grant hook is deliberately untouched; this section's security review, the dispatched security-reviewer that executing-work's standing trigger list convenes for a section touching the grant surface, with its findings recorded in the Chapter, verifies the demotion-class posture (what can a fleet worker now do prompt-free that it could not: demote a shared record's search rank and label it, which the granted archive flags already exceed) and the refusal ordering (the store-signal refusals unchanged; `--supersedes` is not screened, and the mechanical granted-verbs pin stays green unmodified).

Tests, red first: the flag writes the field and the success line reports it; `--update --supersedes` refuses; a dangling target refuses with nothing written; an archived-only target refuses (it is not a live record; the author is told the name is retired); the field lands beside `tags:` and `machine:` in the assembled frontmatter and survives a later `--update` body repair verbatim; the cmd.exe wrapper path carries the flag (mirror the existing wrapper-spawn test shape).

Files in scope: `plugins/claude-kit/scripts/memq.js`, `test/memq.test.js`, `test/memq-grant.test.js` (run, not edit; its :718 pin passing unmodified is an acceptance check).

### 3. The skill and the docs

Model: sonnet
Locus: inline

Document the fourth remedy where the other three live: the memory-system skill's `add-type`/`add-operator` reference rows gain the flag; the "Repairing and removing a shared-tier record" section gains the routing sentence (delete for never-true, repair for a wrong body, supersede for right-then-stale-now, archive for aged-out), placed beside the existing delete-versus-archive distinction it completes; the decay-lifecycle section gains the nomination rule; the recall/find sections gain the label and demotion in the same style as the archive suppression's account. Docs: `architecture.md`'s retention and search paragraphs (:129, :157-161 region) gain the superseded state; `security-model.md`'s retention paragraph (:294 region) gains one sentence (a superseded record is demoted and nominated, never removed, and the pointer is model-written data). `fleet-integration.md` is untouched unless section 2's review changes the grant posture.

Acceptance: the skill states all four remedies and a reader can route a stale-but-was-right record from the skill text alone; each of these surfaces is either updated or verified unchanged, named in the Chapter: the memory-system skill's verb reference rows, its repair-and-remove section, its decay-lifecycle section, and its recall/find sections; `docs/architecture.md`'s retention paragraph (:129 region) and search paragraphs (:157-161 region); `docs/security-model.md`'s retention paragraph (:294 region); `docs/fleet-integration.md`'s grant paragraphs (untouched unless section 2's review changes the posture); and the frontmatter-key and ranking test pins in `test/memq.test.js` (green, extended by section 1's new pins); no surface still implies a fresh record and its stale predecessor coexist unlabeled.

Files in scope: `plugins/claude-kit/skills/memory-system/SKILL.md`, `docs/architecture.md`, `docs/security-model.md`.

## Out of Scope

- Cross-tier supersession, multi-name pointers, and any patch grammar for the field (v1 is one name, same tier).
- Auto-archival on the pointer (demote and nominate only, by design).
- Index-line changes: `MEMORY.md` lines are untouched; the label derives from frontmatter at digest time, the same per-record read the pin scan already performs.
- Pending-tier semantics (a run's pending record may carry the field; adjudication and promotion stay the engine's, unchanged).
- Reinstatement paths and everything else the shared tiers already lack by design.

## Assumptions

- assumed 2026-08-22 (default): `SEMANTIC_SUPERSEDED_DEMOTION` seeds at 0.1, matching the archive demotion, tunable under the backlog's 2026-07-31 constants item (seeded by judgment, tuned on real evidence, never widened speculatively); reversal: one constant.
- assumed 2026-08-22 (default): the fleet grant does not screen `--supersedes` (demotion-class); reversal: withhold at the hook with a per-site red, one hook edit plus tests.
- assumed 2026-08-22 (source: the sweep; the repair path carries frontmatter verbatim): no repair-path work is needed; reversal: none, pinned by an existing test plus section 2's survives-repair test.

## Open Questions

None.

## Related

- `../archive/claude-kit_shared-tier-authoring_spec_v1.md` (built the repair and delete verbs this remedy completes; the surface this plan extends).
- `claude-kit_warden-adoption-candidates_notes_v1.md` (candidate 3's evidence and open questions, all settled here or in the Approach).

## Chapters

### Chapter 1 - 2026-08-23
Completed: 1. The field and the read paths
Implemented By: implementer-opus (build round and fix round, one agent resumed)
Metrics: review rounds 1; NEEDS_CONTEXT 0; escalations 0; consults 0
Gate: 1235 pass / 0 fail / `suites 0` / exit 0, 252s, re-run by the main session against the final tree rather than taken from the implementer's report. Baseline was 1214 at 4ad4f83, so the delta is the 21 supersession tests this section adds and nothing else. The implementer's own run of the same command reported the same figures at 233s.
Review: adversarial, blind and security, dispatched as one Workflow round (`wf_e287d0ba-c9c`) because the reviewer-effort table puts an opus-tier section's reviewers at opus with no headroom, which is effort `max`, and the Agent tool has no effort parameter on this version. All three confirmed at `claude-opus-5`, effort `max`, 416,392 subagent tokens. Tree-state bracket clean across both the review round and the fix round: the worktree carried exactly `plugins/claude-kit/scripts/memq.js` and `test/memq.test.js` at every capture.
Review Findings: 0 Critical. 6 Major, all fixed. (1, security) the decay-scan nomination sat above the unreadable-sidecar suppression, so a tier whose usage sidecar failed to open would nominate from a zero the scan knows is false; now gated on `!evidenceUnread`. (2, adversarial) a pinned record superseded by a live successor lost its label because the label was computed below the pin branch; hoisted, the pin block being where that evidence earns its place twice over. (3, blind) the map labeled an archived record whose name the live tier still holds, which is a claim about a different record; `supersededBy` now takes an `archived` flag and the map carries the live tier's names. Confirmed by the main session at `memq.js:6046-6060` before adjudication: `decay-prune`'s `!free` branch does leave a live and an archived record coexisting under one name. (4, blind and adversarial converged) `2N` file reads per tier where `N` would do; `listMemories` now reads each record once and carries both `tags` and `supersedes`, so `find`, `recall` and `decay-scan` cost exactly what they cost before this section existed. (5, adversarial) the self-pointer guard had no test; adding one showed it was dead code under the 2-cycle guard, so one guard remains and a mutation probe turns both tests red. (6, adversarial) same-tier-only had no regression cover; added.
  Minors fixed: the fan-in label capped with a counted remainder (`SUPERSEDED_SHOWN`, in `DECLARERS_SHOWN`'s style); mutual 2-cycle pairs dropped with a chain control proving genuine chains still nominate; a retired-and-superseded twin-ranking pin; three comments corrected that cited a `--supersedes` flag section 2 has not shipped; comment reflow debris.
  Minors noted and not fixed, deliberately: find's lexical label position (a pre-existing class the tier label already shares); the map built eagerly on a zero-hit find; the untested pending-tier branch; the YAML-quoted-value silent failure, which the Approach deliberately scopes to the write-time typo guard.
Decisions / Surprises: `get <name>` is the one verb this section made more expensive, and the concern was adjudicated rather than fixed. It costs a live-tier walk (101 record reads on a 100-record tier, measured with a `readFileSync` counter; roughly 55ms on the real store's worst tier at 99 records), halved from the first round but up from 1. Accepted: the pointer lives on the successor by the Approach's settled design, so the question has no answer short of opening the tier's records, and the only eliminations are a persistent reverse index (the index-line class this plan puts Out of Scope, plus invalidation as new store state) or dropping `get`'s successor note (which contradicts this section's acceptance). `get` is a human-typed single lookup, not a loop. The other three verbs are unchanged from pre-section cost. Reversal if a tier ever grows into the thousands: a cached or persisted reverse map, which is a design change and a new section rather than an implementation fix.
  The applied-day extension override stays: a heavily used record a fresher one replaces is nominated too, because what the extension buys is time for a fact still in use and the pointer says the store has a newer answer. The unreadable-sidecar gate is about the pass's own blindness and outranks it; the pin outranks both.
  Surprise: adding the self-pointer test proved the explicit self-check redundant. A record naming itself is the mutual pair with one file playing both halves, so one guard covers both shapes.
Approval drift: three amendments above `## Chapters`, made deliberately and named here. (a) The Approach's fan-in clause said the target is labeled with "every pointing successor"; it is now capped with a counted remainder, so one line cannot grow with the tier, which is the rule every other enumeration in `memq.js` follows. (b) Section 1's Tests line carried the same "every live successor" wording and took the same amendment. (c) The Approach's "self-supersession is structurally unreachable" was true of the write path and not of the field: the project tier authors this frontmatter by hand, and a hand-written mutual pair is reachable and costs more than a mislabel, since one scan nominates both halves for archive and a pass acting on that list loses the fact from both. The bullet now reads "a cycle is dropped" and states both shapes, with the write path's inability to mint either kept as the narrower claim it is.
Assumptions: assumed 2026-08-23 (default, section 1): `SUPERSEDED_SHOWN` seeds at 4, matching no existing constant exactly but sitting in `DECLARERS_SHOWN`'s class of display caps with a counted remainder; reversal: one constant.
Stamps: adjudicated 0, stamped 0; none surfaced (project tier 0, operator tier 0 over the 1d window covering this section's span).
Next: 2. The authoring flag
Commit Model: Commit-and-Push
