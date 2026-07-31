---
name: memory-system
description: "Use when working with the kit memory store beyond plain memory files: logging an action outcome, asking what happened last time something was tried, stamping a memory as applied, tagging memories, running the decay pass, or recording a convention shared by every project of a type. Triggers: memq, outcomes journal, applied stamps, tag registry, type tier, memory decay."
---

# Memory System

The kit memory store is the file-per-fact memories plus an extension layer: an outcome journal (`outcomes.jsonl`), used-tracking (`usage.jsonl`), tags, a decay lifecycle, and a shared project-type tier, all reached through the `memq` CLI. `memq` resolves the store from the cwd, so run it from the project root the session runs in; from a subdirectory it resolves a different, empty store. If `memq` does not resolve in the shell, the shim is not installed: run the kit doctor with `-Fix` (the kit-doctor skill owns that run).

Two rules govern everything below:

- **Never hand-edit `outcomes.jsonl` or `usage.jsonl`.** They are written only through `memq` and the read-stamp hook, and the only rewrite path is `memq decay-prune`, which runs under the store lock with a `.bak` beside every file it touches. A hand edit races the hook that appends on every memory read, including yours.
- **Journal entries never enter the memory index.** `MEMORY.md` carries index lines for memory files and exactly one journal pointer line, verbatim: `Outcomes: outcomes.jsonl holds the action journal; query with memq find <term>.` The pointer deliberately does not look like a memory line (`- [Title](file.md) - description`), so index parsers ignore it.

## memq reference

| Command | Does |
|---|---|
| `memq log <key> pass\|fail "<summary>" [--tag t]... [--detail "..."]` | Append one outcome to the project journal. Warns on an unregistered tag, never blocks. |
| `memq find <term> [--tag t] [--outcomes\|--memories\|--all]` | One summary line per hit: journal keys as `<key>  <pass>/<fail>  last <age>  <latest summary>`, memories as `<name>  [tags]  <description>`, spanning both tiers with tier labels on a typed project. |
| `memq get <key\|name>` | Full journal entries for a key (newest first, capped), or a memory file's body. |
| `memq touch <name> --applied [--type]` | Stamp a memory as applied; `--type` targets the declared type tier's sidecar. |
| `memq add-type <type> <name> "<description>" [--body "..."] [--tag t]...` | Write a type-tier memory and its index line together, under the tier lock. The only type-tier authoring path. |
| `memq decay-scan` | Report decay candidates with their evidence dates. Writes nothing. |
| `memq decay-prune [--rollup] [--archive <name>]... [--archive-type <name>]...` | The pass's one mutation path, and it mutates only what its flags name: `--rollup` runs the journal rollup and the usage prunes, the archive flags move the named memories and prune their index lines. Locked, backed up, prints what it removed. |
| `memq decay-done` | Touch the decay stamp that records a completed pass. |

`get` precedence on a name collision is deliberate: a journal key wins over a memory name, and a project memory shadows a same-named type memory, so the tier a project owns always beats the shared one. A type-tier hit is labeled on stderr; when the shadowed shared record is the one you want, read its file under `~/.claude/memory-types/<type>/` directly.

## Action keys

Dot-namespaced, project or domain leading: `neo.sql.procs`, `neat.deploy.iis`, `sql.linked-server`. The key is the retrieval handle (`find` matches key substrings), so lead with the name a future session will reach for and keep one hierarchy per subject rather than minting near-duplicates. When a fact cuts across the hierarchy ("everything SQL-related"), that is what tags are for, not a second key.

## The outcome-logging bar

Log an outcome when a future session, about to act on that key, would stop or steer differently after reading the entry. Both directions count; the norm does not.

Log:
- A failure with a cause and a countermeasure: `memq log neo.sql.openquery fail "OPENQUERY truncates NVARCHAR(MAX); stage through a temp table"`.
- A success that settled an open question: `memq log neat.deploy.appsettings pass "app-pool recycle alone picks up appsettings changes; no iisreset"`.
- An outcome that flips what the store currently believes, either direction.

Skip:
- Routine successes: a green build, a passing suite, a clean commit. The norm carries no stop/go signal.
- A failure explained by your own typo or a transient outage. Nothing for a future session to change course on.
- A durable fact with no event attached: that is a memory file, not a journal entry. The journal records what happened when you acted; the memory tier holds what is true.

**Write the summary and detail yourself; never paste raw tool output into a memq argument.** Two reasons, both at this exact keystroke. The journal is plaintext on disk and gets read back into context, so a credential, connection string, token, API key, or personal data pasted into it is stored in the clear indefinitely: name the shape of the secret ("the connection string was missing Encrypt=True"), never its value. And the shim installs one wrapper per shell: PowerShell resolves `memq.ps1`, which splats arguments straight onto node, and Git Bash resolves the extensionless wrapper, so neither hands your arguments to `cmd.exe`; only a caller inside `cmd.exe` itself reaches `memq.cmd`, whose `%*` forwarding `cmd.exe` parses, so on that one path an argument carrying an odd number of `"` characters ends the quoted region and anything after a `&` in that text runs as a separate command. Your own one-line prose is safe on every path. `memq` strips `"` from what it stores, which keeps a stored value safe to paste later, but it cannot un-run a command line already parsed.

## Applied stamps

**Applied means acted on, not merely read.** A memory is applied when it changed what you did this session: you followed its warning, reused its pattern, avoided its trap. In the turn you act on one, run `memq touch <name> --applied` (add `--type` when the memory lives in the type tier). Reading, listing, or quoting a memory is not application; the read-stamp hook already records reads automatically (memory files of either tier opened via the Read tool, direct children of the tier directory only, never `MEMORY.md`).

The distinction is what the decay lifecycle keys on: only `applied` stamps reset a memory's idle clock, while `read` stamps ride along as evidence for the summarize-versus-archive judgment. A memory that is read forever and applied never is a memory earning its keep in no visible way, and it will be flagged.

## Tags and the registry

Tags are the cross-cutting escape hatch: an optional `tags` list on memory frontmatter and journal entries, queried with `memq find --tag <t>`. The vocabulary is controlled, not free-form, because unmanaged tags decay into synonyms that make `--tag` queries silently incomplete.

- **Frontmatter uses the inline form only**: `tags: a, b` on one line inside the `---` block. The YAML list form (`tags:` followed by `- a` lines) silently reads as no tags at all, exactly the silent incompleteness the registry guards against.
- **The registry** is `~/.claude/memory-types/tag-registry.md`: one tag per line, an optional one-phrase gloss after it, `#` comments and blank lines ignored. Add a line before minting a tag; `memq` warns on any tag outside the registry (and still writes the record).
- **Absent registry, no warnings; present registry, authoritative.** An absent file means the vocabulary is not yet established, so nothing warns. A present file, an empty one included, makes every unregistered tag warn. Creating the file is therefore the deliberate act that turns the control on.
- **Starter vocabulary**: projects (`neo`, `neat`), domains (`sql`), kinds (`gotcha`). Extend freely; the decay pass folds in tag hygiene against the registry.

## The project-type tier

`~/.claude/memory-types/<type>/` holds memories shared by every project of a type, in the same file-per-fact format with its own `MEMORY.md`. A project opts in with a `Project-Type: <type>` line in the first ten lines of its own memory `MEMORY.md`; the session hook then emits the type index at session start, and `find`, `get`, `touch --type`, and the decay pass span both tiers.

**The routing rule: a fact belongs in the type tier only when it holds for every project of that type, not just the one that taught it.** The test: would a project of this type that you have never opened act on it correctly? A fact naming a specific project stays in that project's store. Starter types: `nextjs`, `dotnet`; mint new ones freely through `add-type`, named for the platform or framework that dictates the conventions.

Author only through `memq add-type`, never a direct Write into `memory-types/`: the tier is genuinely shared by concurrent sessions of different projects, its writes serialize under a lock, and the Write tool cannot take one. `add-type` refuses to overwrite an existing name, because another project may rely on it.

## The decay lifecycle

A memory's idle clock starts at its last sign of life: the freshest of its file mtime, its optional `created:` frontmatter date, and its newest `applied` stamp. `read` stamps never reset the clock. 30 idle days makes a summarize candidate (condense the body, keep the index description), 60 an archive candidate (move to `memory/archive/`, index line pruned). A summarize edit resets the mtime, so archive arrives 60 idle days after the summarize, by construction. Journal entries older than 30 days are rollup candidates: `decay-prune --rollup` folds them into one per-key rollup entry that preserves the pass/fail tally and the union of the entries' tags, and never re-flags its own rollups. The rollup and the usage prunes run only under `--rollup`; an archive flag alone moves what it names and touches nothing else.

`created: YYYY-MM-DD` is an author-asserted sign of life: because the clock takes the freshest evidence, it can defer decay when file times understate recency, and can never age a memory faster than its mtime shows.

The pass runs at close-out; finishing-work step 7 owns the trigger (a decay stamp older than 14 days, or absent: a store where no pass has ever run is due, not exempt) and the run: `decay-scan` reports, your judgment picks (the summarize edit is the only hand edit in the pass), `decay-prune --rollup` with the archive flags mutates, `decay-done` stamps. The SessionStart hook nudges when the stamp is 30+ days overdue. Outside a close-out, do not run `decay-prune` unprompted.

## Known limits

- A type tier is reachable only through a declaring project: when the last project drops its `Project-Type` line, the tier's files stay on disk but no scan or prune reaches them. Re-add the line in some project of that type before running a pass over it.
- The type lock can be wedged by a directory or a non-JSON-object file sitting at `~/.claude/memory-types/<type>/store.lock`; no memq command recovers that. Manual recovery: confirm no writer is live, then delete that entry by hand. The lock is availability only; store integrity does not rest on it.
- Type-tier `read` evidence is sparse, because type bodies are normally fetched through `memq get`, which stamps nothing. `applied` stamps carry the decay decision there, so `touch --applied --type` on a type memory you act on matters more, not less.
