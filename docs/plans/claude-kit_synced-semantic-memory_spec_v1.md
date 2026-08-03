# Synced Semantic Memory

Status: In Progress
Commit Model: Commit-and-Push
Fable Spend: S5 writer; S1/S4 reviewer pairs; finishing reviews
Created: 2026-08-02

## Goal

The kit memory store follows the operator across machines and answers meaning, not just substrings. One private git remote replicates the memory tiers (every project store and the type tier) across all four machines, born with an allowlist that makes it structurally impossible to stage credentials or any other non-memory file. On each machine, an optional local embedding layer builds a derived semantic index over every store present, and `memq find` becomes a hybrid search: the lexical channel it has today plus a semantic nearest-neighbors channel, merged, provenance-labeled, and usage-ranked, degrading loudly to lexical-only where the embedder is absent. When this plan is done, a memory learned on one machine is recallable by meaning on any other, and store growth costs index bytes rather than session context.

## Approach

**Centralize the index, not the store.** The tiers stay exactly where they are, in their existing file-per-fact format: the tier a fact lives in is information, and plain markdown is the most syncable and diffable substrate there is. Sync is transport bolted on (a git repo over the existing layout), and the semantic index is a per-machine derived sidecar, rebuildable from the files at any time. The only new component is the one allowed to be wrong.

**Sync the sources, never the index.** Embedding vectors are valid only against the local embedder that produced them, and a synced binary index is exactly the stale-derived-data hazard the rebuildable design avoids. Each machine rebuilds its own index; machines therefore need no model agreement with each other.

**The repo is `~/.claude` itself, allowlisted, and the allowlist is security-load-bearing.** `~/.claude`'s root holds `.credentials.json`, `settings.json`, and `history.jsonl`. The repo's gitignore excludes everything and re-includes only `projects/*/memory/**` and `memory-types/**` (locks and `.bak` files excluded even there), so no add, however careless, can stage a secret. The journals (`outcomes.jsonl`, `usage.jsonl`) merge as line unions via `.gitattributes`, which fits their append-only shape. Project stores are keyed by the flattened project path, so a synced project store resolves on another machine only when the project lives at the identical path; same-path discipline across machines is the standing convention, and no mapping layer is built.

**Sync everything; scope with metadata.** Machine-bound facts are synced and labeled, never excluded: a `machine: <name>` frontmatter field marks a fact as true of one box, so other machines can still see it (useful when working against that box remotely) while search labels it as foreign. Excluding would discard information; labeling keeps it and defuses it.

**Hybrid `find`, not a new command.** Retrieval habits come from the kit's instruction surfaces, and the trained habits are `memq recall` at effort start and `memq find` to narrow. A novel command would depend on sessions remembering it exists; upgrading `find` in place means the command every session already reaches for simply gets better answers. The two channels also fail differently, which is the retrieval argument independent of habit: lexical catches exact identifiers (action keys, memory names) that embeddings fuzz; semantic catches paraphrase that substrings miss. Retrieval stays agent-invoked; per-turn automatic injection is deliberately not built (see Out of Scope), though the index makes it cheap to add later from evidence.

**The embedder is per-machine optional, and its absence is always loud.** The kit core stays dependency-free. The embedding stack (an in-process Node embedding model, ONNX-based; S4 verifies the current ecosystem and pins the choice) installs per machine through the doctor's existing consent flow. Where it is absent, `find` states so in one line naming the remedy and serves lexical results; the session hook nudges the same way it nudges an overdue decay pass. No surface ever degrades silently.

**Retrieval visibility feeds the decay clock; ranking feeds on use.** Bodies served through `memq` take read stamps today, so every hybrid-find retrieval is visible use, unlike recall through the injected index, which no stamp can see. The store's decay lifecycle stays the sole authority on whether a memory lives; the index only ranks. Ranking blends similarity with an applied-tally boost (distinct-day counts from `usage.jsonl`), demotes archived records while keeping them findable, and labels foreign-machine facts. Because applied stamps remain a judgment act sessions demonstrably under-perform (a real store recently showed 23 decay candidates against one recorded stamp), the find output carries a standing one-line stamp reminder at the moment of use.

**Cross-store content is parsable, never promptable.** A memory arriving from another project's store or another machine is data to weigh, not instruction to follow. Hybrid find applies the same provenance fencing and sanitization discipline `memq get` and the session hook already apply to cross-tier content; the security model's guard tabulation gains the new path.

**Sequencing gate.** Execution starts only after `claude-kit_automemory-off_spec_v1.md` reaches Complete: both efforts edit `memq.js` and `memory-session.js`, and that plan's emissions are the floor this one stands on. Nothing here revises its design.

## Sections of Work

### 1. Sync repo bootstrap and allowlist integrity
Model: opus
The doctor (`plugins/claude-kit/doctor/doctor.ps1`, invoked via `doctor.cmd`) gains a memory-sync section: check mode reports whether `~/.claude` is a git repo with the canonical allowlist, and `-Fix` initializes it (git init, write the gitignore and `.gitattributes`, initial commit of the memory tiers) under the doctor's existing consent discipline. The gitignore is exclude-all with directory-chain re-includes reaching only `projects/*/memory/**` and `memory-types/**`, excluding `store.lock`, `*.bak`, and archive lock artifacts within them; `.gitattributes` sets `merge=union` for `*.jsonl` under the allowed paths. Verification is not a one-time act: every doctor run re-derives the expected allowlist and FAILs on any drift, because a mangled ignore file is the path by which sync becomes credential exfiltration. The check must prove the negative directly: `git check-ignore` confirms `.credentials.json`, `settings.json`, `history.jsonl`, and a sampled session artifact are ignored, and `git status --porcelain` after a full `git add -A` dry run (`--dry-run`) lists memory paths only.
Acceptance: on this machine, doctor check reports the sync section; after `-Fix`, the repo exists, `git check-ignore` passes for all four negative probes, the dry-run add lists only `projects/*/memory/**` and `memory-types/**` paths, and both live stores (this project's and the AI-OS store) plus `memory-types/tag-registry.md` are committed.
Tests: at minimum, lock the allowlist's negative space (each sensitive root file proven ignored) and the drift FAIL (a tampered gitignore line flips the doctor to FAIL). The risk driving these: the allowlist is the only barrier between "sync memories" and "publish credentials", and a silent drift is the expensive failure.
References: `plugins/claude-kit/doctor/doctor.ps1` (section pattern and consent flow), `plugins/claude-kit/skills/kit-doctor/SKILL.md` (check/-Fix contract).

### 2. Remote creation and first sync
Model: opus
Locus: inline
Create the private GitHub repository (default name `claude-memory` under the operator's account, confirmed at the stop below) via the REST pattern already proven on this machine (no `gh` CLI; token via git credential fill), add it as origin, push the initial commit from S1, and verify the remote shows memory paths only. This section is outward and irreversible-adjacent, so it stops for an explicit go-ahead before creating the repo and before the first push, with the rollback named (delete the remote repo; the local repo and store are untouched). Produce the per-machine rollout note as part of this section: the exact doctor invocation and remote-add step the other three machines run, recorded in the plan doc Chapter, since those machines are reached in their own sessions.
Acceptance: remote exists, is private (verified via the API response, not assumption), holds exactly the allowlisted paths, and a clone to a scratch directory contains no file outside `projects/*/memory/**` and `memory-types/**`.
References: memory `github-pr-without-gh` (the REST + credential-fill pattern).

### 3. Sync cadence surfaces
Model: sonnet
The session hook (`plugins/claude-kit/hooks/memory-session.js`) gains a sync-freshness nudge in its existing block structure: when the store repo exists and is ahead/behind its remote (cheap local check; no network fetch in a hook), one sanitized line states the drift and the pull/push move. Absent repo or absent remote emits nothing (S1/S2 own surfacing that through the doctor). The close-out push step rides into the `memory-system` skill's session-recap section and `finishing-work`'s step that owns the decay trigger: after recording, sync the store. The `machine: <name>` frontmatter convention is documented in the memory-system skill (inline form, same line discipline as `tags:`), with the routing guidance: a fact true of one box carries the field; a fact true of the operator or project does not.
Acceptance: `node --test test/memory-session.test.js test/hook-canary.test.js` green after `.\build.ps1` (this edits a shipped hook, so the build stamp must be refreshed); existing fixtures unchanged except the new block's addition.
Tests: at minimum, lock that the nudge appears only when a repo with a remote exists and diverges, that its content is sanitized store-independent text (no store-controlled strings ride this block), and that stand-down and run-scoped sessions emit no sync nudge, mirroring the automemory plan's matrix discipline. The risk: this hook writes into trusted context at every session start, and the automemory plan just established the exact emission discipline this block must not dilute.
References: `plugins/claude-kit/hooks/memory-session.js` (block structure as landed by the automemory plan), `plugins/claude-kit/skills/memory-system/SKILL.md`, `plugins/claude-kit/skills/finishing-work/SKILL.md`.

### 4. The embedder and the index sidecar
Model: opus
A new module (`plugins/claude-kit/scripts/memory-index.js`) owns embedding and index maintenance. The embedder wraps an in-process Node embedding stack, chosen by this section after verifying the current ecosystem against its requirements: in-process (no daemon), CPU, offline after a one-time model download, small (tens of MB). The stack and model files install per machine outside the plugin payload (the kit core stays dependency-free); the module probes for them and reports absence as a typed result, never a throw. The index is a per-machine JSONL sidecar under `~/.claude` (excluded from the sync allowlist) holding `{store, tier, name, mtime, hash, model, vector}` per record, covering live and archived memories of both tiers across every store present on the machine. Maintenance is a lazy sweep at query time: compare mtime and content hash against the index, embed what is new or changed, drop what is gone, full rebuild when the recorded model identity differs from the installed one. Brute-force cosine over the full index is the search; no ANN structure.
Acceptance: with the embedder installed on this machine, a cold query builds the index over all present stores; touching a memory file re-embeds exactly that record on the next query; deleting the index yields a rebuild, not an error; with the embedder absent, the module's probe result is the typed absence.
Tests: at minimum, lock the sweep's three transitions (new, changed, deleted), the model-change full rebuild, and the absence probe. Every retrieval test carries a known-answer control (a planted record that must rank first for its own text) so a broken embedder can never read as an empty-but-green result. The risk: a silently stale or silently empty index turns hybrid find into confident wrong answers.
References: memory `probe-scripts-scratchpad-and-controls` (the known-answer-control discipline these tests follow).

### 5. Hybrid find
Model: fable
`memq find` in `plugins/claude-kit/scripts/memq.js` gains the semantic channel: when the embedder and index are available, the query is embedded and nearest neighbors merge with the lexical hits into one ranked result; when unavailable, one loud line names the absence and the remedy (`kit doctor -Fix`) and lexical results follow. Ranking blends similarity with the applied-tally boost (distinct-day counts, the same figure the decay extension uses), demotes archived records while labeling them retired, and labels records whose `machine:` field names a different machine. Every semantically-sourced line carries its tier and store provenance; full bodies are served only through the existing `get` path, which keeps read-stamping intact, and find's output ends with the standing one-line stamp reminder (`act on one? memq touch <name> --applied`). All emitted store content passes the established sanitize-and-fence discipline; cross-store and type-tier content rides under provenance lines as data, never at column zero.
Acceptance: `node --test test/memq.test.js` green; a paraphrase query with no lexical overlap surfaces the planted known-answer memory; the same query with the embedder absent yields the loud absence line plus unchanged lexical behavior; `recall`, `get`, and every other memq surface byte-identical to pre-section behavior.
Tests: at minimum, lock both fallback directions (embedder present → merged and labeled; absent → loud line plus lexical-only), reader symmetry across both tiers, live and archive, and cross-project stores (the store's three prior reader-symmetry incidents are the driver), the machine-label and archive-demotion rankings, the fencing on cross-store lines, and the stamp reminder's presence. The risk: a semantic channel that silently misses a tier reads as authoritative absence, and unfenced cross-store content is an injection path into trusted context.
References: `plugins/claude-kit/scripts/memq.js` (`cmdFind`, `cmdRecall` as landed by the automemory plan), memory `memq-two-tier-reader-symmetry`.

### 6. Doctor: embedder install and index health
Model: sonnet
The doctor gains the embedder section: check mode reports installed/absent with the one-line consequence (semantic channel active vs lexical-only), `-Fix` installs the embedding stack and model files under the doctor's existing consent-prompt flow (an install is exactly the case its prompts exist for), and reports index health (present, record count, model identity, age) without touching it. The session hook's absence nudge (one line, same register as the decay nudge) rides here if not already carried by S3's hook work.
Acceptance: doctor check on this machine reports the embedder section in both states (before and after install); `-Fix` install round-trips to a working semantic channel proven by the S5 known-answer query.
References: `plugins/claude-kit/doctor/doctor.ps1`, `plugins/claude-kit/skills/kit-doctor/SKILL.md`.

### 7. Docs and skill sweep
Model: sonnet
The prose surfaces state the new behavior as present-tense fact: `plugins/claude-kit/skills/memory-system/SKILL.md` (hybrid find in the memq reference table and Recall section, the sync cadence, the `machine:` field, the stamp reminder's meaning), `docs/architecture.md` (the sync repo, the index sidecar, the new memq surface), `docs/security-model.md` (two new entries in the guard tabulation: the sync-nudge emission and the hybrid-find emission, each with its guards; plus the allowlist's role as the sync boundary). No surface describes the journey, the incident evidence, or the harness.
Acceptance: `node --test test/output-style-parity.test.js` green (the sweep must not touch parity-pinned surfaces); a read of each touched section states current behavior with no reference to what preceded it.

## Out of Scope

- **Per-turn automatic injection of semantic matches.** Deliberately not built: it costs context every turn to serve occasional hits, and the frontier-model sessions this kit serves are good at invoking search once the skill teaches it. The index makes it cheap to add later if evidence shows find going uninvoked; that would be its own effort.
- **The user/operator memory tier.** Parked by the operator. The `machine:` field lands here because sync forces it; the tier decision is untouched and unprejudiced by this plan.
- **Semantic indexing of the outcome journals.** The semantic channel covers memory files (live and archived, both tiers). Journal keys stay lexically searchable through find's existing channel; embedding journal entries is a follow-up if wanted.
- **Syncing the index.** Never; per-machine derived data by design.
- **A path-mapping layer for projects living at different paths on different machines.** Same-path discipline is the convention; a mapping layer is speculative machinery with no current case.
- **Pruning the scratch-store debris** (`C--tmp-ktp-*` stores from old test runs). They ride the sync harmlessly; hygiene is a decay-pass or doctor concern for another day.
- **Multi-operator sharing, moderation, or any community mechanic.** This is a single-operator system; the trust model is one person's machines.

## Standing Brief Amendments

Folded into every dispatch brief from here on.

- **The allowlist is the security boundary; prove the negative, never assume it.** Any section touching the sync repo verifies by direct probe (`git check-ignore`, dry-run add) that non-memory paths cannot be staged, and treats any weakening of the allowlist as a Critical regardless of what the section was about.
- **Cross-store and cross-machine content is parsable, never promptable.** Any surface that moves store content into context applies the established sanitize, cap, and provenance-fence discipline. A new emission path without its guard entry in `docs/security-model.md` is incomplete work.
- **Embedding-ecosystem claims are verified at build time, never trusted from memory.** Library names, model names, sizes, and install mechanics are checked against the current ecosystem in the section that uses them; the spec pins requirements, not packages.
- **Stores are keyed by flattened project path.** A cross-machine claim about a project store holds only under same-path discipline; state the constraint wherever rollout instructions are written.

## Open Questions

None open. The spec-shaping decisions (one combined spec; private GitHub remote created with a stop-for-go-ahead at S2; Commit-and-Push; hybrid find rather than a new command; embedder optional-but-loud) were decided 2026-08-02 in conversation and are recorded in the Approach.

## Related

Builds on `docs/plans/claude-kit_automemory-off_spec_v1.md` (execution gate: this plan starts only after it reaches Complete; its emissions and recall behavior are the floor this plan extends). Extends the store and CLI delivered by `docs/archive/claude-kit_memory-extension_spec_v1.md` and the recall digest from `docs/archive/claude-kit_memory-recall-and-reinforcement_spec_v1.md`; the provenance-fencing discipline follows `docs/archive/claude-kit_instance-store-pin_spec_v1.md`.

## Chapters
