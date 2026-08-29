# A memory surfaces when the work touches what it is about, not only when somebody asks

Status: Ready
Commit Model: Commit-and-Push
Created: 2026-08-29

Session model: any executor session in the kit repo; three sections, tiers per section. Authored by the KIT: Expert seat from a design dialog with the operator, 2026-08-29. Anchors are authoring-time; re-locate every hit by content.

## Dispatch Authorization

Authorized 2026-08-29 by the operator: the recognition-trigger vocabulary, the recognition hook, and its instrumentation, approved in a design dialog at the operator's keyboard in the expert seat's session, including the tier boundaries recorded under Decisions. This section was authored by the KIT: Expert seat; per the peer-sessions trace rule it is a warrant only for a citing session that did not author it, and the receiving session performs its own trace: the grant is the operator's approval in the expert session's transcript, and the plan enters the armed queue only by the operator's word or the expert's append under it.

## Goal

The memory system pushes once and pulls thereafter: the index rides into every session start, and `memq` serves whoever asks. The session that most needs a memory is the one that does not know to ask, and the start-of-session index has faded by hour six or been compressed by a compaction, so the highest-value memories are recalled by luck at their moment of use. When this plan is done: a memory can carry deterministic recognition triggers beyond its file anchors (command patterns, skill and agent invocations, rare tool names, error signatures, path globs); a hook watches the session's own tool stream and injects a one-line pointer nudge when the work touches what a memory is about, before the act for command-shaped hazards and after it for paths and errors, deduplicated and capped so nudges stay rare enough to be read; and the applied-stamp machinery measures whether nudged memories get applied at a higher rate than unnudged ones, which is the evidence the semantic tier's gate reads.

## Evidence

- The delivery-timing failure is the same one two sibling efforts just processed: the instruments plan's thesis (the reader who does not know to ask is the one the instrument must serve) and the update-window plan's push-at-moment-of-use design. The index-then-pull shape serves the asker; recognition serves the session that forgot.
- The store's own index already contains a real memory wanting each proposed trigger class, confirmed against the live index this session: `test-suite-invocation` wants a command pattern (`node --test`) and an error signature (module-not-found); the stash hazard class wants a pre-act command trigger; `merging-hook-edits-staleness-the-build-stamp` wants a path glob over the hooks tree; `first-turn-reading-path-is-the-subagents-dir` wants an agent-dispatch trigger; `worktree-guard-refuses-compound-commands` wants a rare-tool trigger.
- The `anchors:` field is files only by confirmed design (`memory-system/SKILL.md`, The anchors field section): `<path>@<blob-sha>` entries whose sha is load-bearing for drift detection, written by `memq anchor` which hashes the tree. A command pattern has no bytes to hash, which is why recognition triggers are a sibling field rather than new anchor entry types.
- The applied-stamp machinery already records recall-at-use, so the experiment instruments itself: stamp rates on nudged versus unnudged memories are readable from existing records plus the nudge log this plan adds.

## Decisions

Decided 2026-08-29 by the operator in the design dialog.

1. **Tier 1 is deterministic recognition, built now.** File anchors plus a typed `triggers:` sibling field; a hook matches the tool stream against both; no model in the matching loop.
2. **Tier 2 (semantic matching against the store's embeddings) is designed later and gated on evidence:** it is not specced here, and its gate is the stamp-rate reading from Section 3 showing that nudges get acted on at all, since a semantic tier with unproven nudge precision is an expensive way to get ignored.
3. **Tier 3 (a dedicated Memory seat tailing peer transcripts and nudging over messaging) is the recorded horizon,** not designed here; it waits on tier 1's evidence and would need its own sanctioned-pattern argument in peer-sessions terms.
4. **Nudges are pointers, never bodies:** a nudge names the memory and one line of why it fired, and the session hunts the specifics via `memq get`, which keeps injection cheap, respects context, and preserves the recall-then-verify discipline.

## Sections of Work

### 1. The `triggers:` field joins the record grammar

Model: opus

A new optional frontmatter field, sibling to `anchors:`, carrying typed recognition entries: `cmd:<pattern>` (substring or anchored fragment matched against a Bash command), `err:<pattern>` (matched against a failed call's output), `skill:<name>`, `agent:<type>`, `tool:<name>`, `glob:<path-glob>`. The section fixes the grammar with the same rigor the anchor grammar has, including its bars: a specificity floor stated as a rule (a pattern shorter than the floor or matching a bare common token is refused, `git` alone being the named example), and the same one-line, comma-separated, top-level-or-metadata placement discipline the sibling fields take. Written by a new `memq` verb in the anchor verb's idiom (merge not replace, refusals name every bad entry, one backup generation spent, project tier only); the frontmatter guard learns the field as it knows the others, refusing entries outside the grammar; listings display it; `find` ignores it, stated explicitly as the anchors section states its own non-readers. File anchors are untouched: they keep their drift semantics, and recognition reads their paths with the sha ignored at match time.

Tests red-first per surface: the guard refusing an out-of-grammar entry with a passing control, the verb's merge and refusal behaviors against the anchor verb's own test patterns as siblings, the specificity floor proven against the named bare token.

Files in scope: `scripts/memq.js`, `plugins/claude-kit/hooks/memory-frontmatter-guard.js`, `plugins/claude-kit/skills/memory-system/SKILL.md`, matching `test/` files.

### 2. The recognition hook watches the stream and nudges with a pointer

Model: opus

One hook registered on both boundaries. PreToolUse matches command, skill, agent, and tool triggers, so a command-shaped hazard's nudge lands before the act; PostToolUse matches path anchors, glob triggers, and error signatures against the call's touched paths and failure output, so recognition lands the moment the evidence exists. The hook never blocks and never modifies a call: its whole output channel is an injected context line, and every failure inside it fails open to silence. Matching runs against an in-process trigger index built from the project tier and rebuilt only when the memory directory's state has moved, so the per-call cost is a lookup rather than a store read. Precision machinery ships with the matcher, not after it: once-per-trigger-per-session dedup, a per-turn nudge cap, and the pointer-only nudge form from decision 4 (the record name, the trigger that fired, one clause of why, and the `memq get` spelling). The bounded reader discipline applies to every file this hook opens, per the guard-siting rule: it uses the shared bounded reader, never a fresh unbounded one.

Tests red-first per trigger class with named controls: each class's fixture shows the nudge and a non-matching sibling stays silent; the dedup proven by a second identical call staying silent; the cap proven against a fixture that would over-fire; the fail-open proven against an unreadable store.

Files in scope: a new hook file under `plugins/claude-kit/hooks/` (the implementer names it), `plugins/claude-kit/hooks/hooks.json`, matching `test/` files.

### 3. The nudge log makes the experiment readable

Model: sonnet

Every nudge appends one line to a machine-local log (the record, the trigger, the moment), and the memory-system skill gains the reading protocol: the stamp rate of nudged records against unnudged ones over a stated window, read from the nudge log joined with the applied-stamp records, which is the evidence decision 2's gate consumes. The log is gitignored scratch, bounded (size-capped with rotation in the events-stream idiom), and its absence reads as no-nudges-yet rather than as an error.

Tests: the append shape and rotation red-first; the join read proven against a fixture holding one nudged-and-stamped, one nudged-unstamped, and one unnudged-stamped record, each named as what it proves.

Files in scope: the Section 2 hook file, `plugins/claude-kit/skills/memory-system/SKILL.md`, matching `test/` files.

## Out of Scope

- Tier 2 semantic matching: designed only after Section 3's stamp-rate evidence exists, per decision 2.
- Tier 3, the Memory seat: recorded horizon, per decision 3.
- Any blocking or modifying behavior in the hook: recognition informs, never gates.
- Shared-tier triggers: the trigger index reads the project tier; widening to the operator or type tiers is future work with its own cross-machine questions.

## Related

- `docs/plans/claude-kit_instruments-not-prose_spec_v1.md`: the sibling push-at-moment-of-use design; its moment-pin serves the reader of a figure as this plan's nudge serves the holder of a memory.
- The bootstrap rider every payload plan carries: the hook ships in the payload, so recognition starts after the next fleet update.

## Chapters
