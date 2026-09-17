# Memory database: a shared SQL Server index, journal and curation layer over the markdown store

Status: In Progress
Commit Model: Branch-and-PR
Disjoint: yes
Created: 2026-09-16

Session model: any executor session in the kit repo; five sections, tiers per section. Authored by the coordinator persona on SCOTT-CLAUDE on the operator's word of 2026-09-16 on the coordinator's relay thread. Anchors are authoring-time; re-locate every hit by content.

## Dispatch Authorization

The operator authorized this plan on 2026-09-16 on the coordinator persona's Discord thread, the relay channel the operator steers that session from. The operator's words, in order: "I like the separate plan. Let's lock down MEMQ first", then "Agreed. You may need to commit/PR that into Claude-Kit", after a design exchange that settled the shape recorded under Approach. The coordinator session authored this plan and does not execute it. Per the peer-sessions trace rule this section is a warrant only for a citing session that did not author it, and the receiving session performs its own trace: the grant is the operator's messages on the coordinator's relay thread, and the plan arms only by the operator's word.

## Goal

When this is done, a SQL Server database on the virtualization host holds the shared semantic index, the usage journals and the curation queries for the kit memory store, reachable from every sandbox VM over an encrypted connection with its own execute-only login. Every sandbox's vectors come from one embedding model served on the host, so a record written on one sandbox is findable by meaning from another. A project-tier record is visible only to the sandbox that wrote it, an operator-tier or type-tier record is shared, and a promote procedure is the one way a project lesson becomes shared. `memq find` serves its semantic channel from the database with the local index as the fallback, `memq recall` and session start each gain one bounded block of the records nearest to the current project and its recent work, and the read and applied stamps and the outcome journal write to the database first with a local spool that drains when the host returns. The markdown tiers on each VM stay the record and the fallback, the git sync is unchanged, and a machine with no host reachable runs exactly as the kit runs today. It matters because the store's three sandboxes learn the same lessons separately today, the tier index files that carry every description are read under a sixty-four kilobyte cap the operator tier already exceeds, the per-machine usage journals are the one file shape the git sync cannot rebase cleanly, and nothing in the kit surfaces a memory by meaning at any moment but an explicit `memq find`.

## Approach

**What exists, read from the code at 4c7059d.** The semantic index is a per-machine JSONL sidecar at the store root (`plugins/claude-kit/scripts/memory-index.js:65`, `SIDECAR_FILE`), one line per record with a 384-dimension vector from `Xenova/all-MiniLM-L6-v2` at `q8` loaded in-process (`memory-index.js:51-54`), rebuilt whenever a record's body hash or the model identity changes (`sweep`, `memory-index.js:823`). Its consumers are `memq find`'s semantic block (`memq.js:6039`, `semanticChannel`), the write-time neighbours check on the shared tiers (`memq.js:14927`) and the decay scan's neighbour pairs (`memq.js:12409`). `memq recall` never reads it (`memq.js:8309` is synchronous over the index files and journals), and the session-start hook injects the project and type tier indexes only (`plugins/claude-kit/hooks/memory-session.js:1019` and `:1249`, both through `indexLines` at `:959` under `INDEX_READ_CAP = 65536` at `:314`). The operator tier index on this machine is 76,743 bytes, so `memq find`'s judged candidate set and `memq recall` read it truncated, which `memq` itself reports on every run. Usage stamps are per-tier `usage.jsonl` files written by the read-stamp hook (`hooks/memory-usage-stamp.js:92`), `memq get` (`memq.js:7242`) and `memq touch` (`memq.js:9561`), folded by decay-prune (`memq.js:13208`), and read by `readUsage` (`memq.js:2546`) and `appliedTally` (`memq.js:2618`). The store syncs through a private git remote with a rebase (`plugins/claude-kit/doctor/sync-store.ps1:513`); the kit's own journal records the sync standing down on a cross-machine `MEMORY.md` conflict, and the three files dirty in the store on this machine at authoring are all `usage.jsonl`. Across the switch, the kit already depends on one host service: the model endpoint at `~/.claude/kit-endpoint.json`, spoken through `plugins/claude-kit/scripts/kit-endpoint-lib.js` in the OpenAI dialect (`:138-151`), which `memq find`'s judged channel (`memq.js:6846`) and the judgment sidecar (`sidecar/judge.js:110`) both use. The operator tier on this machine holds records labeled as learned on NEO-CLAUDE beside SCOTT-CLAUDE's, since the sync copies every tier to every machine and the ranker only demotes a foreign machine's fact.

**Why a database on the host, and why the record stays markdown.** The host is the neutral service every sandbox already reaches, the sandboxes run on it and go down with it, and the operator has installed the same SQL Server 2025 Developer Edition on every VM, whose native `VECTOR` type and `VECTOR_DISTANCE` this plan's author confirmed on SCOTT-CLAUDE. A database answers the three defects above at once: one index for the fleet, journals that are rows instead of files, and curation as queries. It also answers the separation the operator keeps between the businesses, which the git sync does not: visibility is a property of the row, resolved from the caller's login inside every procedure, never a parameter a caller passes. The markdown record stays because it is what a sandbox with no host has, what a co-worker without the operator's setup gets, what git history audits, and what every existing memq verb reads. So the database is a derived layer plus the journals, and the publisher that fills it is the same walk the local sweep runs today. Moving the record itself into the database is a later plan, taken after living with this one.

**The transport is sqlcmd, not a Node driver.** The kit core stays dependency-free, `sqlcmd` ships on every sandbox at `C:\Program Files\Microsoft SQL Server\Client SDK\ODBC\170\Tools\Binn\SQLCMD.EXE`, and the calls this plan makes are few and batched. memq spawns `sqlcmd` with `-b -I -N` (fail on error, quoted identifiers, encrypt), the password in the `SQLCMDPASSWORD` environment variable rather than on the command line, and a batch payload in a temp input file. Procedures take typed parameters; the batch procedures take one `nvarchar(max)` JSON parameter parsed with `OPENJSON` into a typed table, which is the one place a JSON document crosses the boundary. Results come back as `FOR JSON` text on stdout. The spawn costs on the order of a hundred milliseconds, which is inside the budget `memq find` already spends on its judged channel.

**The embedder runs on the host so every sandbox's vectors compare.** A vector is comparable only with vectors from the same model, which is why the local index is never synced today. One embedding server on the host, spoken in the same OpenAI dialect the kit already uses (`/v1/embeddings`, model identity from `/v1/models`), makes the fleet's vectors one space. The model is `BAAI/bge-m3` at 1024 dimensions, the model the operator's knowledge-base project already pinned (`D:/knowledge-base/docs/architecture.md`, "The embedding container"), served by a second llama.cpp server instance in embedding mode on the host's GPU, which the operator chose on 2026-09-16 because the host's CPU is the fleet's contended resource and the GPU has headroom once the Qwen instance's context drops to the 32K to 64K range. Section 1 measures the latency and the operator records the VRAM it takes, and every embedding row records the model identity and dimension it was made with, so a later model change is a re-embed pass and never a schema change. The embedder's batch and micro-batch are set to 2048 tokens, a per-input ceiling below the model's 8192-token window, while its context stays at the full 8192, since the instance runs a unified key-value cache in which the context is the pool every in-flight sequence shares, and a 2048 context would cap a batched request at two to four chunks in flight. The publisher chunks every record body at paragraph boundaries to a target of 512 to 1024 tokens, so no chunk approaches the ceiling and an oversized one is refused by the server rather than truncated. A record is matched on its best chunk and returned whole, so a long record is never matched on its first two thousand tokens, which is the local index's behavior today (`TEXT_CAP`, `memory-index.js:70`). The smaller chunk is the retrieval choice, since one vector over thousands of heterogeneous tokens drifts toward a centroid that matches everything weakly. The 2048 ceiling is the serving choice, since attention cost is quadratic in the micro-batch width and 2048 fits the host's GPU without depending on flash attention engaging for a non-causal model. The local MiniLM index stays as the fallback and is not re-pointed at the host model.

**Tenancy and security, in the rows and the roles.** One database, `KitMemory`, one schema, `mem`. A sandbox row per VM, keyed to its publisher login. Every publisher procedure resolves the caller's sandbox from `ORIGINAL_LOGIN()` through one inline function, `mem.CallerSandbox()`, which returns no row for an unmapped login, and every publisher read filters on it before ranking, fail-closed: the caller sees its own sandbox's private rows plus every shared row, and a row carrying a deleted mark is served by no read procedure. A project-tier record is `private`, an operator-tier or type-tier record is `shared`, and `mem.usp_PromoteRecord` flips a private record to shared under the curator role only. The curator role's procedures run over every row and take a record's identity (tier, segment, name and, for a private record, its owning sandbox) rather than resolving a sandbox, since the curator login maps to none. Three sandbox logins hold `EXECUTE` on the `mem` schema's publisher procedures and nothing else, no table rights anywhere. One curator login holds `EXECUTE` on the promote, curation and health procedures and nothing else, so both connection principals memq uses are execute-only per the house rule. A separate review login holds `SELECT` on the tables for the operator's hand review and is used by no kit code. The temporary `kit_deploy` sysadmin login exists only for the installer and is dropped by the operator after section 2 lands. The connection is encrypted with a host certificate the VMs trust, imported into each VM's trusted root, so no client passes a trust-anything flag. Every procedure that reads across sandboxes logs the call with the resolved login into `mem.QueryLog`, on the pattern of the knowledge base's audit table.

**A shared-tier record is one row for the fleet, not one per sandbox.** The git sync copies the operator and type tiers to every machine, so every sandbox's publisher walks the same shared records. A store row for a shared tier carries no sandbox, and a shared record is keyed by (tier, segment, file key) alone, so the three publishers upsert one row and one embedding. When two sandboxes hold different bodies for the same shared record, which happens between one machine's write and the sync landing on the others, the newer file modification time wins and the row records the sandbox that last published it. Removal marking is a private-store act: a publisher marks removed only file keys in its own sandbox's project stores, and a shared row is never marked removed by a publisher. A shared row no sandbox has published for thirty days is what `memq db-curate --orphans` lists for the curator, beside the index lines with no record.

**The client config, and which login it holds when.** `~/.claude/kit-memory-db.json` carries `server`, `database`, `login`, `password`, `embedding.url`, `embedding.model`, optional `timeoutMs`, and optional `curatorLogin` and `curatorPassword`. On SCOTT-CLAUDE the operator writes it first with `kit_deploy` in `login`, which is what section 1 probes with and section 2 installs with. Section 2's installer generates the passwords for the three publisher logins, the curator login and the review login itself, creates the logins with them, and writes them to `~/.claude/kit-memory-db-logins.json` on the installing machine, never to a log or a Chapter; the executor then rewrites the config's `login` and `password` to `kit_scott_claude` and adds the curator pair, and the operator carries the NEO and ASR pairs to those VMs by hand and drops `kit_deploy`. From section 3 on, `login` is always a sandbox's publisher login, and a verb that needs the curator reads the two curator fields and refuses with the reason when they are absent. The installer accepts Windows authentication as well as a SQL login, because every sandbox's own local instance runs Windows-only authentication and section 2's test installs against it.

**Fallback is the current kit, and every stand-down is loud.** The host is reachable or it is not, and the difference is one probe at the timeout the judged channel already uses. Unreachable: `memq find` serves the local semantic channel as today and prints one line naming the database as unreachable, `memq recall` and session start omit their database block with one line each, and stamps and outcomes append to the local spool. Reachable: the publisher drains the spool before it publishes. The doctor step reports the spool depth and the age of the last successful publish, so a machine that has silently fallen back for a week says so at every session start through the doctor's existing nudge shape. Nothing here removes or weakens the file-backed paths.

**The step 7 sweep and what it found.** Two scouts ran on 2026-09-16 over the worktree at 4c7059d. The first mapped the semantic index, the judged channel, every writer and reader of `usage.jsonl`, the session-start blocks, the recognition nudge, the sidecar, the sync, the doctor and the tests; its findings are the paragraphs above and the Files in scope below. The second swept every surface that enumerates or pins the things this plan extends: the memq dispatch table (`memq.js:17386-17446`) and usage text (`memq.js:5319-5349`); the fleet grant's `GRANTED_VERBS` set (`hooks/memq-grant.js:295-296`) and the parity test that derives the withheld list from the dispatch table (`test/memq-grant.test.js:1260-1294`); the memq reference table in the memory-system skill (`plugins/claude-kit/skills/memory-system/SKILL.md:21-36`) under its size cap (`test/size-budget.json:47`, 14548 bytes, gated by `test/size-ratchet.test.js`); the doctor's placement rule that nothing may sit between the embedder section and the `.kit/` exposure marker (`plugins/claude-kit/doctor/doctor.ps1:1303-1313`, pinned by `test/embedder-install.test.js:374-379` and `test/doctor-goal-state.test.js:104-112`); the kit-doctor skill's step prose (`plugins/claude-kit/skills/kit-doctor/SKILL.md:27,34,35`); the sync allowlist (`plugins/claude-kit/doctor/install-memory-sync.ps1:97-117`), which admits nothing at the store root, so the client config and the spool are excluded from sync by construction; the security model's inventory of files under the store root (`docs/security-model.md:136-137,156,184,371-372`) and the architecture doc's shared-state bullet (`docs/architecture.md:377`); the session-start block count stated as eight at `docs/architecture.md:151` and `docs/README.md:15`, with the open backlog item of 2026-09-08 that conflates that count with `session-start.js`'s twelve; the block-count pins in `test/memory-session.test.js:201` and `:636`; and the build, which packages everything under `plugins/claude-kit/` recursively (`build.ps1:84-90`, `build.sh`) and hashes only `hooks/*.js` and `hooks.json`, so a new `plugins/claude-kit/db/` directory ships with no manifest edit. Not surfaces: `memq-shim.js` (a pass-through), `plugin.json` (metadata only), `test/doctrine-parity.test.js` and `test/output-style-parity.test.js` (neither names memq).

**Backlog items this plan covers.** `docs/backlog.md:41` (2026-09-08, reconcile the session-start block count between the docs index and the architecture doc) is resolved in section 4 when the count changes anyway. `docs/backlog.md:112` (2026-08-29, the store sync's staging is unattended and path-shaped) is not covered: the sync is unchanged here, and the item stays. `docs/backlog.md:75` (2026-09-02, six operator-tier index lines name records that do not exist) gains an instrument in section 5, the curation query that lists index lines with no record, and the item is re-dated to point at it rather than retired.

## Standing Brief Amendments

- Every T-SQL file follows the sql-style skill (`skills/sql-style/SKILL.md` under the kit plugin root): shell-then-ALTER deployment, banner headers, leading commas, no em dashes. Every PowerShell file follows the house PowerShell shape the doctor scripts already use.
- No section writes a secret into the repository, a test fixture, a Chapter or a log line. The client config file's password field is named in docs and never quoted.
- A section that touches the host runs only when the operator's word that the host instance is up has reached the executing session, on that session's own channel or as a coordinator record carrying it, and the Chapter names that message by date and channel.
- A check that a run budget stops before it reads the host reports FAIL, naming the check and the exhausted budget, so a run that could not reach the host exits non-zero with the failing check named. INFO is for a check that reached the host and found an expected absence, or for a measurement the operator asked to skip, never for a check that measured nothing it was asked to measure.
- The publisher sends every record its walk finds on every run and never skips one whose body hash is unchanged. The database's `unchanged` disposition stamps `LastPublishedDt`, which the thirty-day orphan rule reads, so a client that skipped unchanged records would starve that stamp and list every untouched shared record as an orphan. The client learns record ids, the unembedded set and the removed set from one reader procedure, `mem.usp_ListRecords`, which takes the embedding model identity and returns one row per visible record. No local publish-state sidecar exists, so there is no client copy of database state to drift.
- The run's deadline governs whether a boundary call starts, and each call's own clock governs how long it runs. A call starts only while the deadline has not passed, and its clock is the remaining budget divided down across the clocks that run in sequence, lifted to the tool's floor where what remains is less than that floor: two seconds for a sqlcmd spawn, one second for an HTTP call. So the one call that crosses the deadline finishes less than two seconds past the configured timeout, no call starts after it, and a run with time left on the clock is never refused.
- The interactive stamp and outcome writers append to the spool and make no database call. The database still receives every one of them, one publish later. A later section that reinstates a synchronous call on that path is reintroducing a duplicate-row defect, since both append procedures are plain inserts with no dedupe and a kill landing after the server committed leaves the row and spools it again.
- `db-sync` is withheld from the fleet grant, so the withheld list is six names and the granted list does not carry it. A section that changes either count starts from six. The verb refuses a redirected store root, and the fleet store signals redirect it, so granting it would authorize an act that cannot happen.
- A boundary budget is this client's own and is never borrowed from an interactive channel. The judged channel's 400 millisecond probe timeout is an interactive stamp's budget, and a sqlcmd spawn's clock cannot express less than one second, so a batch verb that borrowed it would refuse a healthy host whose login takes over a second and say nothing.

## Sections of Work

### 1. Prove the host
Model: opus

Measure, against the real host, what sections 2 through 4 will be built on, before any of them is written against a guess. Deliver `plugins/claude-kit/db/Test-MemoryDatabaseHost.ps1`, which takes `-ConfigPath` (default `~/.claude/kit-memory-db.json`) and prints one line per check with PASS, FAIL or INFO and the measured value, exiting non-zero on any FAIL. The config file's shape is the one the Approach fixes, and this section is where it is first read. Section 5's doctor step calls this same script, so its output is stable text. At this section the database does not exist yet: the script connects to `master` when the config's `database` is absent on the server and prints that absence as INFO in check 2, and checks 1 and 3 run in `master`.

Checks, each recorded in the Chapter with the value it returned:

1. The connection succeeds with `-N` and without `-C`, and `sys.dm_exec_connections` reports `encrypt_option = TRUE` for the session, which proves the VM trusts the host certificate.
2. `SERVERPROPERTY('ProductVersion')` is a 17.x version and `FULLTEXTSERVICEPROPERTY('IsFullTextInstalled')` is 1; whether the config's database exists is printed as INFO.
3. A `VECTOR(1024)` round trip through `VECTOR_DISTANCE('cosine', ...)` returns a distance near zero for identical vectors.
4. `GET {embedding.url}/v1/models` lists `embedding.model`, and `POST {embedding.url}/v1/embeddings` for a short string returns a vector of 1024 floats. The identity recorded is the model id the server reports plus the server's own version header where it sends one.
5. Latency: ten embeddings of a text at the chunk target's upper bound, about 1024 tokens or 4000 characters of English prose, median and maximum, and ten of a twenty-word query. A separate single call with a text past the 2048-token ceiling must be refused by the server with a non-2xx status, recorded as PASS when it is, since the chunker's contract depends on that refusal. The Chapter records both alongside the VRAM reading the operator reports.
6. The local `sqlcmd` path resolves and reports its version, since sections 3 and 4 spawn it.

Acceptance: the script exits 0 against the host with every check PASS or INFO, the Chapter carries the six values, and a run with the host unreachable exits non-zero within the config's timeout with the failing check named. If check 5's median for the long text exceeds two seconds, the Chapter says so and the operator decides on the lighter model named under Open Questions before section 3 starts.

Files in scope: new `plugins/claude-kit/db/Test-MemoryDatabaseHost.ps1`; new `test/memory-database-host.test.js` covering the script's parsing and its unreachable path against a closed port. The live checks against the host run only under `KIT_MEMORY_DB_LIVE=1`, never on config presence alone, so the whole-suite gate reaches no network.
Tests: at minimum, lock the unreachable path's non-zero exit and its named check, and lock that a config file with a missing field fails before any network call; a probe that reports PASS on a half-configured machine is the expensive failure.

### 2. Schema, security and the installer
Model: fable

Deliver the database as T-SQL under `plugins/claude-kit/db/` in four directories the installer applies in order, and the installer itself.

`Schema/`: `mem.Sandbox` (id, name, publisher login name, created); `mem.Store` (id, sandbox id nullable and null for a shared tier, tier as `project`, `type` or `operator`, segment for the project path or type name, null for operator), unique on (sandbox id, tier, segment) with the null sandbox meaning the fleet; `mem.Record` (id, store id, name, file key, description, body, body hash, file modification time, machine from the record's `machine:` field, tags, supersedes name, author, archived flag, visibility as `private` or `shared`, last published by sandbox id, updated, deleted); `mem.Embedding` (record id, chunk index starting at zero, chunk text offset and length, `VECTOR(1024)`, model identity, dimensions, embedded at), unique on (record id, chunk index, model identity), separate from the record so a re-embed pass touches one table, with a record embedded whole holding one row at chunk zero; `mem.Usage` (record id, kind as `read` or `applied`, timestamp, sandbox id, session id nullable); `mem.Outcome` (store id, action key, result, summary, detail, tags, timestamp, sandbox id); `mem.PublishRun` (sandbox id, started, finished, counts of added, changed, removed, embedded, spool drained, error text); `mem.IndexOrphan` (store id, index line name, description, first seen, last seen by sandbox id); `mem.QueryLog` (login, procedure, sandbox id, parameters digest, row count, timestamp); `mem.SchemaVersion`. Uniqueness on (store id, file key), which for a shared tier is (tier, segment, file key) since the store carries no sandbox. Visibility defaults from the tier at insert: `private` for a project store, `shared` for the others.

`FullText/`: a catalog and one full-text index over `mem.Record.Description` and `mem.Record.Body`.

`Procedures/`, all under `mem`, every one resolving the caller through one inline function `mem.CallerSandbox()` over `ORIGINAL_LOGIN()` that returns no rows for an unmapped login: `usp_UpsertRecords` (JSON batch, typed table via `OPENJSON`, upsert on the unique key, marks deleted the file keys the batch names as removed); `usp_UpsertEmbeddings` (JSON batch of record id, vector text, model identity, dimensions); `usp_ListRecords` (model identity; one row per record the caller may see, each carrying record id, tier, segment, file key, name, archived flag, visibility and whether an embedding exists for that model identity, which is the publisher's only route to a record id, to the unembedded set and to the removed set under `DENY SELECT`); `usp_AppendUsage` (JSON batch); `usp_AppendOutcomes` (JSON batch); `usp_Search` (query text, query vector, limit; four candidate lists fused by reciprocal rank at K 60 in the knowledge base's shape: full-text over description, full-text over body, vector distance over live records, vector distance over archived records; then, in fused-score space, an applied boost of 0.002 per distinct applied day capped at ten days, and a multiplier of 0.5 for an archived record and 0.5 for a superseded one, all four as parameters with those defaults, which re-express the local ranker's similarity-space constants at `memq.js:589-594` rather than copy them; returns record identity, tier, sandbox, visibility, description, fused score and each list's rank); `usp_Nearest` (vector, limit; the neighbours shape, live records only); `usp_PromoteRecord` (tier, segment, name, owning sandbox; curator role only); `usp_CurationUnapplied` (days); `usp_CurationSupersededLive`; `usp_CurationOrphans` (the `mem.IndexOrphan` rows section 3 records, and the shared records no sandbox has published for thirty days); `usp_Health` (schema version, record and embedding counts, last publish, oldest unembedded record, for the caller's own sandbox under a publisher login and for every sandbox under the curator). Every publisher read procedure filters to rows the caller may see before it ranks: its own sandbox's private rows plus every shared row, never a deleted row; the curator procedures run over every row. `usp_Search` and `usp_Nearest` insert one `mem.QueryLog` row per call before returning, carrying the login, the resolved sandbox, a digest of the query text and the row count, since both can return another sandbox's shared rows.

`Security/`: three roles. `mem_publisher` holds `EXECUTE` on exactly `usp_UpsertRecords`, `usp_UpsertEmbeddings`, `usp_AppendUsage`, `usp_AppendOutcomes`, `usp_AppendPublishRun`, `usp_UpsertIndexOrphans`, `usp_ListRecords`, `usp_Search`, `usp_Nearest` and `usp_Health`, which for a publisher returns its own sandbox's rows only. (Roster amended 2026-09-17, from seven procedures to ten across two amendments, both recorded as approval drift and both open to the operator to overturn. The first added the writers for `mem.PublishRun` and `mem.IndexOrphan`. Section 3 requires both tables written under an execute-only publisher login and names no procedure for either, so the original roster and section 3's requirement contradicted each other; the roster was the stale surface. Ruled by the executing session on section 2's round 1 findings. The second added `usp_ListRecords`, the reader that lets an execute-only publisher see its own inventory. Section 3 must learn each record's id to write its embeddings, learn which records carry no embedding for the current model, and learn which of its own file keys the database still holds so the walk can name the rest as removed. No delivered procedure answered any of the three, and `DENY SELECT` puts every table out of reach, so section 3 was unbuildable as specified. Ruled by a consultant at fable on section 3's first dispatch, whose grounds this session confirmed against the delivered scripts before adopting them.) `mem_curator` holds `EXECUTE` on `usp_PromoteRecord`, the three curation procedures and `usp_Health`, and no table rights, so memq's curator connection is execute-only like its publisher connection. `mem_review` holds `SELECT` on every table and executes nothing; it exists for the operator's hand review through a query tool and no kit code connects as it. Logins `kit_scott_claude`, `kit_neo_claude`, `kit_asr_claude` as users in `mem_publisher`, each mapped to its `mem.Sandbox` row; `kit_curator` in `mem_curator`; `kit_review` in `mem_review`. `DENY SELECT` on every table to `mem_publisher` and `mem_curator`, so neither connection principal reads past its procedures even if a later grant widens.

`Install-MemoryDatabase.ps1` at `plugins/claude-kit/db/`: takes the server and the database name, and either a deploy login and password or `-WindowsAuth`; creates the database when absent; applies the four directories in order through `sqlcmd -b -I` with `-N` when a login is used; is idempotent, so a second run is a no-op that still exits 0; prints one line per script applied. On the run that first creates the five logins it generates their passwords itself and writes them to a logins file whose path `-LoginsPath` names (default `~/.claude/kit-memory-db-logins.json`), created exclusively so it never overwrites one; a later run finds the logins present and leaves them. It never drops a table and never alters a column type, and it refuses to run when `mem.SchemaVersion` holds a version newer than the scripts it carries. Section 2's test runs it with `-WindowsAuth` against the executing VM's own local instance, which every sandbox carries under Windows-only authentication, into a database named with a run-scoped suffix and a logins file under the test's temp directory, dropping both at teardown, so no credential is a fixture.

Acceptance: two consecutive installer runs against the host both exit 0 and the second applies no change, read from the script's own output; a login in `mem_publisher` can execute `usp_UpsertRecords` and cannot `SELECT` from `mem.Record`, proven by a failing query in the Chapter; `usp_Search` called as the SCOTT sandbox login returns a NEO sandbox's private row never and its shared row always, proven with two seeded rows; `usp_PromoteRecord` fails for a publisher login and succeeds for the curator; a `usp_Search` call leaves one `mem.QueryLog` row, read back under the review login; the Chapter quotes one banner header and one shell-then-ALTER pair from the delivered files as the sql-style evidence.

Files in scope: new `plugins/claude-kit/db/Schema/*.sql`, `plugins/claude-kit/db/FullText/*.sql`, `plugins/claude-kit/db/Procedures/*.sql`, `plugins/claude-kit/db/Security/*.sql`, `plugins/claude-kit/db/Install-MemoryDatabase.ps1`, `plugins/claude-kit/db/README.md`; new `test/memory-database-install.test.js` running the installer against the local SQL Server instance on the executing VM, which every sandbox carries, so the gate needs no host.
Tests: at minimum, lock idempotence of the installer, the tenancy filter in both directions for `usp_Search` and `usp_Nearest`, the publisher role's denied `SELECT`, the promote procedure's role gate, and the unmapped-login case returning no rows rather than every row; a tenancy leak is the expensive failure and it is silent from the caller's side.

### 3. The publisher and the spool
Model: opus

Add `memq db-sync` and the local spool. The verb reads the client config, probes the host at a probe budget of this client's own, no lower than twice the sqlcmd spawn floor, and stands down with one line when the config is absent or the host is unreachable. When reachable it drains the spool first, then walks the store with the same tier walk and body hash `memory-index.js`'s `sweep` uses (`memory-index.js:823`, `hashOf` at `:698`), publishes every record the walk finds through `usp_UpsertRecords` in batches, the database reporting each as added, changed, unchanged or skipped, then reads its own inventory once through `usp_ListRecords` for the current model identity, names as removed the file keys that reader returns for this sandbox's own project stores and the walk no longer finds, never a shared row, embeds every record the same reader reports as carrying no embedding for that model identity through the host's `/v1/embeddings` in batches of the local `EMBED_BATCH` (`memory-index.js:76`) with the local `embedText` composition (`:713`), splitting every body at paragraph boundaries into ordered chunks of 512 to 1024 tokens, never past the server's 2048-token ceiling, that each carry the record's name the way `embedText` prefixes it, writes them through `usp_UpsertEmbeddings` with their chunk index and offsets, records index lines with no record file into `mem.IndexOrphan`, and writes one `mem.PublishRun` row. It prints one summary line in the shape the sweep's counters take.

The spool is `~/.claude/kit-memory-db-spool.jsonl`, appended with one line per stamp or outcome the database call could not deliver, in the record shapes `usp_AppendUsage` and `usp_AppendOutcomes` take; a failed record upsert is never spooled, since the next walk re-derives it from the file. Writers: `stampRead` (`memq.js:7242`), the applied-stamp append inside `cmdTouch` (`memq.js:9734`, the function at `:9561`), `cmdLog`'s outcome append, and the read-stamp hook (`hooks/memory-usage-stamp.js:92`) each append to the spool and make no database call at all; the file-side write they make today is unchanged in every case, so the local `usage.jsonl` stays complete. (Amended 2026-09-17, from a short-timeout database attempt to a spool append, recorded as approval drift and open to the operator to overturn. The interactive budget never funded a process start, and a kill landing after the server committed produced duplicate rows against two insert procedures that carry no dedupe. The database still receives every stamp, one publish later, which is the same journey with the latency and the duplicate both removed. Ruled by the executing session on section 3's round 1 findings. The Goal's sentence that the stamps "write to the database first" reads against this: the database is still where a stamp lands and the spool is still what catches it, and the operator may want that sentence reworded.) The spool drain sends the file's lines in one batch per procedure and truncates the file only on success, under the store's existing exclusive-create lock pattern. The spool sits at the store root, which the sync allowlist excludes by construction; the Chapter proves it with the allowlist's own probe.

Session start spawns `memq db-sync` detached, beside the git sync's spawn in `memory-session.js:703`, under its own attempt marker `kit-memory-db-sync.attempt` at the store root with the git sync's staleness interval, so neither spawn suppresses the other, only when the client config exists, and never in a run-scoped or pinned-store session. The doctor runs it inline under `-Fix`. `db-sync` walks the store, so it joins the network-share stand-down that gates the store-walking verbs, and the pin of those gated functions at `test/memq.test.js:3781` moves from twelve names to thirteen in this section.

Acceptance: on a machine with the config, a first `memq db-sync` publishes every live and archived record across the tiers and embeds them, a second run reports zero added and zero changed, and editing one record's body then running again reports one changed and one embedded, each read from the verb's own summary line; with the host unreachable, `memq touch` still stamps the local sidecar and appends one spool line, and the next reachable `db-sync` drains it and reports the count; the fleet grant withholds `db-sync` and `test/memq-grant.test.js`'s parity case passes with it on the withheld list. (Amended 2026-09-17, from granted to withheld, recorded as approval drift and open to the operator to overturn. The grant fires only under the fleet store signals, and under exactly those signals the verb's own refusal of a redirected store root stands it down before it reads a record, so the grant authorized nothing. Withholding loses no capability and removes a line a later permission audit would have to reason about. Ruled by the executing session on section 3's round 2 findings, and the withheld list therefore grows from five names to six here, which section 5's own counts start from.)

Files in scope: `plugins/claude-kit/scripts/memq.js` (dispatch table at `:17386-17446`, usage text at `:5319-5349`, `stampRead`, `cmdTouch`, `cmdLog`, a new `db-sync` command and a new database client module), new `plugins/claude-kit/scripts/memory-database.js` (the sqlcmd spawn, the JSON payload file, the embedding client over `kit-endpoint-lib.js`'s request shape, the spool), `plugins/claude-kit/hooks/memory-usage-stamp.js`, `plugins/claude-kit/hooks/memory-session.js` (the detached spawn only), `plugins/claude-kit/hooks/memq-grant.js:295-296`, `test/memq-grant.test.js`, new `test/memory-database.test.js`, `test/memory-session.test.js`, `test/memq.test.js` (the gated-verbs pin only). Added by the section 3 ruling recorded under Standing Brief Amendments: new `plugins/claude-kit/db/Procedures/045-usp_ListRecords.sql`, `plugins/claude-kit/db/Security/010-Roles.sql` (the grant and the matching curator deny), and `test/memory-database-install.test.js` (the roster pin and the reader's own subtests). Section 2 stays closed; the installer is re-runnable and applies a changed script, so the host takes the new procedure on section 3's own install run.
Tests: at minimum, lock the stand-down when the config is absent (no spawn, no network, no spool), the spool append on a failed database call with the local stamp still written, the drain's truncate-only-on-success, that every walked record is sent on every run with the counts read from the server's own summary, a client that skipped unchanged records being the defect since it starves the orphan rule's stamp, and the removed-file marking; the silent loss of a stamp between spool and database is the expensive failure. The sqlcmd spawn and the embedding call are seams the tests replace with fakes; one live case runs against the local instance where section 2's installer has been applied to it.

### 4. The query side
Model: opus

Serve `memq find`'s semantic channel from `usp_Search` when the host is reachable. In `semanticChannel` (`memq.js:6039`), before the local index is loaded, the database client embeds the query text through the host and calls `usp_Search` with the same limit; the hits render through the existing hit-line composer with their tier and, for a shared row from another sandbox, that sandbox's name in the place the foreign-machine label sits today. The lexical block, the judged channel and the two-block merge rule at `memq.js:5624-5640` are unchanged. When the host is unreachable the local channel runs as today and one line names the database as unreachable. The write-time neighbours check (`memq.js:14927`) and the decay scan's neighbour pairs (`memq.js:12409`) take the same route: each sends the record's text to the host embedder and calls `usp_Nearest` with the vector that returns, so a local 384-dimension vector never reaches the database, with the same fallback to the local index.

`memq recall` gains one block, `fleet memory`, after the operator tier block: the ten records nearest to a query composed from the project segment name and the three most recent action keys in the project's outcome journal (the `memq log` journal, `outcomes.jsonl`), embedded through the host, rendered one line each with tier, sandbox and description, omitted with one line when the host is unreachable or the config is absent. Session start gains the same block through a new function in `memory-session.js`, emitted only when the client config exists, capped at five lines, with a two-second budget after which it is omitted with one line. Because the block is conditional on the config file, the block-count pins at `test/memory-session.test.js:201` and `:636` hold unchanged, and a new case pins the block present with a config and a fake client.

Docs: `docs/architecture.md:151` and `docs/README.md:15` move from eight blocks to nine and name the new one; the backlog item at `docs/backlog.md:41` is retired in the same edit by stating which hook each count belongs to; the memory-system skill's `find` and `recall` rows describe the database channel and its fallback line, and `test/size-budget.json:47` is raised to what the edit measures.

Acceptance: `memq find` for a term whose only semantic hit is a record another sandbox promoted returns that record with the sandbox named, proven live against the host with a seeded shared row; with the host unreachable the same command returns the local channel's hits and the one stand-down line; `memq recall` shows the fleet memory block with a config and omits it with one line without; the session-start block appears in the new test case and every existing case's count is unchanged.

Files in scope: `plugins/claude-kit/scripts/memq.js` (`semanticChannel`, `neighbourBlock`, `neighbourPairsBlock`, `cmdRecall`), `plugins/claude-kit/scripts/memory-database.js`, `plugins/claude-kit/hooks/memory-session.js`, `test/memq.test.js`, `test/memory-session.test.js`, `test/memory-database.test.js`, `docs/architecture.md`, `docs/README.md`, `docs/backlog.md`, `plugins/claude-kit/skills/memory-system/SKILL.md`, `test/size-budget.json`.
Tests: at minimum, lock the fallback in both directions for `find` (reachable serves the database hits, unreachable serves the local hits with the stand-down line), the foreign-sandbox label on a shared hit, the recall block's omission line, and the session-start block's conditionality on the config; a search that silently serves the local index while the operator believes the fleet index answered is the expensive failure.

### 5. Curation, the doctor step and the docs
Model: opus

Add `memq db-promote <name> [--sandbox <name>] [--tier project|type|operator] [--segment <segment>]` for the curator login only: it resolves the record by that identity, defaulting the sandbox to the caller's own machine name and the tier to project, calls `usp_PromoteRecord`, and refuses with the reason when the config carries no curator pair or the identity matches no private row. Add `memq db-curate [--unapplied <days>] [--superseded] [--orphans]` printing the three curation queries' rows in the store's line shape, curator login only. Both verbs are withheld from the fleet grant: the withheld list in `test/memq-grant.test.js:1286` grows from five names to seven, and that test's title and comments, which say five today, say seven.

Add the doctor step `Memory database`, placed after the `# --- .kit/ exposure.` marker per `doctor.ps1:1303-1313`: it reports INFO when no config file exists, otherwise runs section 1's probe script with a `-Quick` switch that skips the latency check, reads `usp_Health` under the config's publisher login for this sandbox, and reports FAIL on a failed check, WARN when the spool holds lines or the last publish is older than seven days, and PASS otherwise; under `-Fix` it runs `memq db-sync` inline and reports FIXED on a clean publish. The kit-doctor skill gains the step in the prose at `plugins/claude-kit/skills/kit-doctor/SKILL.md:34-35`'s shape, with `test/size-budget.json:43` raised to what that edit measures.

Three surfaces section 1 surfaced and left unedited land here, because this is the section that wires the probe into the doctor. First, `Get-SanitizedLine` exists twice: once at `doctor.ps1:96` and once in the probe, with different default caps, and section 5 pipes the probe's lines into the doctor's own output channel, so one channel gains two independently maintained sanitizers. Move it into a dot-sourceable helper beside the doctor, on the shape `install-embedder.ps1` already takes, and have both call it. Second, the probe carries `#Requires -Version 7.0`, because `-SkipHttpErrorCheck` is how it reads the embedding server's refusal as a result rather than an exception, while `doctor.cmd:5` launches the doctor under Windows PowerShell 5.1; the doctor step therefore spawns `pwsh` explicitly and reports INFO where no `pwsh` resolves, rather than letting the requirement fail as an unexplained error. Third, the probe's check 1 reads `sys.dm_exec_connections`, which needs VIEW SERVER STATE, and section 1 runs it under the deploy login, which is a sysadmin; the doctor step runs it under the config's publisher login, which holds EXECUTE and nothing else, so check 1 must either move to `CONNECTIONPROPERTY('encrypt_option')`, which a connection may read about itself without that permission, or section 2 must grant VIEW SERVER STATE to the publisher logins. Take the `CONNECTIONPROPERTY` route unless the measurement says it does not report the same value, since granting a server-wide permission to an execute-only login to satisfy one probe line is the wider change.

Docs: `docs/security-model.md` gains the client config, the logins file and the spool in its inventory of files under the store root, on the shape of the `kit-endpoint.json` and sidecar spool entries at `:136-137` and `:184`, stating that none syncs, that the config and the logins file carry passwords their ACLs protect, and that every `usp_Search` and `usp_Nearest` call is logged in `mem.QueryLog`; it also states what the two host links are protected by, which section 1 measured as asymmetric: the SQL link is encrypted with a certificate the VM trusts, proven by the probe connecting with `-N` and without `-C`, while the embedding link is plain HTTP over the virtual switch, carrying record bodies from section 3 onward, so the document states that asymmetry plainly and names whether it is accepted or closed rather than leaving a reader to infer it from the config's `embedding.url` scheme; its session-start passage at `:76`, which names the sync runner as the one detached spawn, and its stamp-hook passage at `:749`, which says the hook emits nothing, each gain the database call and the `db-sync` spawn; its withheld-verb count at `:675` moves from five to seven. `docs/fleet-integration.md:38`, which enumerates the granted verbs and the five withheld, gains `db-sync` and the two withheld verbs. `docs/backlog.md:162`'s "withholds five verbs" reads seven. `docs/architecture.md:377` gains the three files in the shared-state bullet and a paragraph under the memory store section describing the database layer and its fallback rule. `docs/README.md:15`'s sentence on the network-share gate reads thirteen of memq's nineteen verbs with the six it leaves running. `plugins/claude-kit/db/README.md` states the host setup the operator performs, the installer's parameters, and the login and role model. The memory-system skill gains rows for the three new verbs and a section on the database layer, with `test/size-budget.json:47` raised to the measured size. `docs/backlog.md:75` is re-dated to name `memq db-curate --orphans` as its instrument.

Acceptance: `memq db-promote` as a publisher login refuses with the role named, and as the curator flips one seeded private row to shared, proven live; `memq db-curate --unapplied 90` lists a seeded record with no applied stamp and omits one with a stamp inside the window; the doctor reports INFO with no config, PASS against the host, and WARN with one spool line, each read from its own output; the two marker-extraction tests pass unchanged; the memq grant parity test passes with the two verbs withheld.

Files in scope: `plugins/claude-kit/scripts/memq.js`, `plugins/claude-kit/scripts/memory-database.js`, `plugins/claude-kit/hooks/memq-grant.js`, `test/memq-grant.test.js`, `plugins/claude-kit/doctor/doctor.ps1`, new `test/memory-database-doctor.test.js` in the marker-extraction shape of `test/doctor-goal-state.test.js`, `plugins/claude-kit/skills/kit-doctor/SKILL.md`, `plugins/claude-kit/skills/memory-system/SKILL.md`, `test/size-budget.json`, `docs/security-model.md`, `docs/architecture.md`, `docs/README.md`, `docs/fleet-integration.md`, `docs/backlog.md`, `plugins/claude-kit/db/README.md`.
Tests: at minimum, lock the doctor step's four verdicts by fixture, the role refusal on both new verbs, and that neither verb is granted to a fleet worker; a promote a worker can run is the expensive failure.

## Out of Scope

- Moving the record itself into the database, and any change to what the markdown tiers hold or how memq reads them. That is the phase-two plan, written after this one has run for a while.
- Retiring or changing the store's git sync, its allowlist or its rebase. The per-machine journals keep syncing as they do today; the database is a second copy of the stamps, not a replacement, until phase two decides.
- The persona plugin's integration (a curator that writes memories from a persona's turns, and prompt-time injection into persona sessions). That plan lives in the agent_persona repository and depends on the query interface this plan delivers, not on its storage.
- Re-pointing the local MiniLM index at the host model, or removing the local index and embedder. Both stay as the fallback.
- An approximate-nearest-neighbour vector index. At about a thousand records an exact scan is fast, and the knowledge base's own decision record reserves the DiskANN index for a corpus a thousand times larger.
- Reranking, the sidecar's recognition channel, and the recognition nudge's lexical triggers. None changes here.
- The doctor writing the client config or installing the host's embedding server. Both are operator acts, listed under Operator Verification.
- The kit-resolution direction (`D:/agent_persona/docs/backlog.md`, 2026-09-15), under which a session's memory resolves from the repository it works in rather than its launch directory. The publisher walks whatever store memq resolves today.

## Assumptions

- assumed 2026-09-16 (operator's word on the relay thread): the database is the shared index, journal and curation layer and the markdown tiers stay the record and the fallback; reversal: the phase-two plan, which this plan's schema is designed not to block.
- assumed 2026-09-16 (operator's word on the relay thread, recorded under Open Questions): record bodies are cached in `mem.Record.Body` for shared and private rows alike, so a shared record is readable on a sandbox that never held its file and a private record is searchable by its full text; reversal: store bodies for shared rows only and descriptions for private rows, one condition in the publisher and one in the schema's nullability.
- assumed 2026-09-16 (default): a project-tier row is private to its sandbox and an operator-tier or type-tier row is shared, with promotion the only path from private to shared; reversal: a visibility default per store, one column already present.
- assumed 2026-09-16 (D:/knowledge-base/docs/architecture.md, the operator's own pin): the embedding model is `BAAI/bge-m3` at 1024 dimensions, served on the host; reversal: section 1's measurement, after which a lighter model is a config change and a re-embed pass, since every embedding row carries its model identity.
- assumed 2026-09-16 (default): the transport is `sqlcmd` spawned by memq, present on every sandbox at the ODBC 17 client path, with the password in `SQLCMDPASSWORD`; reversal: a Node driver installed as an optional per-machine stack the way the embedder is, which changes one module.
- assumed 2026-09-16 (default): the client config is `~/.claude/kit-memory-db.json`, hand-authored per machine like `kit-endpoint.json`, excluded from the sync by the allowlist's construction; reversal: none needed, the path is one constant.
- assumed 2026-09-16 (default): the three sandbox names are SCOTT-CLAUDE, NEO-CLAUDE and ASR-CLAUDE, matching the `machine:` values the operator tier already carries for the first two; reversal: a row in `mem.Sandbox`.
- assumed 2026-09-16 (default): the plan is disjoint from the doctrine prose pass in flight, since it touches no skill the pass rewrites except the memory-system skill's reference table, and that edit is additive; reversal: a rebase of the memory-system skill rows at the pull request.
- assumed 2026-09-16 (default): the four fusion lists and K of 60 are the knowledge base's, and the applied boost and the two demotions are re-expressed in fused-score space as 0.002 per distinct applied day capped at ten days and a 0.5 multiplier each, as procedure parameters; reversal: the parameters, which the procedure exposes, with section 2's Chapter recording the two-record check that fixed the defaults.
- assumed 2026-09-16 (operator's word on the relay thread): the embedder runs on the host's GPU with the Qwen instance's context reduced to make room, since the host's CPU is the contended resource; reversal: GPU layers set to zero on the same server instance, a launch flag.
- assumed 2026-09-16 (operator's word on the relay thread, recorded under Open Questions): every record body is chunked at paragraph boundaries to 512 to 1024 tokens under a 2048-token server ceiling and matched on its best chunk, rather than truncated as the local index truncates today; reversal: raise the ceiling and the target together, one server flag and one publisher constant, with a re-embed pass.
- assumed 2026-09-16 (default): the installer generates the five login passwords and writes them to a logins file on the installing machine with an exclusive create, and the operator carries two of them to the other sandboxes by hand; reversal: passwords passed as installer parameters the operator chooses, one parameter each.

## Operator Verification

- The host instance is installed as the default instance of SQL Server 2025 Developer, Mixed Mode, with the Full-Text and Semantic Extractions feature, TCP on 1433 bound to 192.168.58.245, a firewall rule scoped to 192.168.58.0/24, Force Encryption with a certificate whose public part is placed where the SCOTT-CLAUDE session can read it, and a `kit_deploy` sysadmin login whose password sits in `~/.claude/kit-memory-db.json` on SCOTT-CLAUDE. Section 1 cannot start until the operator's word that this is done has reached the executing session, per the Standing Brief Amendments. A check in section 1 that fails on the certificate or the port reopens this item.
- The host runs one llama.cpp server instance in embedding mode for `BAAI/bge-m3` on the GPU, with a 2048-token batch and micro-batch and an 8192-token context, reachable at the URL the config's `embedding.url` names, after the Qwen instance's context is reduced to the range the operator chose. The operator reads the host's VRAM before and after and reports both, which section 1's Chapter records beside the latency. A VRAM reading that leaves the Qwen instance short reopens the model choice under Open Questions.
- After section 2 lands, the operator drops `kit_deploy` and confirms on the thread. The plan does not close while that login exists.
- On NEO-CLAUDE and ASR-CLAUDE, the operator imports the host certificate, writes each VM's client config with its own login, and runs `memq db-sync` once; the Chapter of section 3 records the operator's word that each published, since this session cannot reach those VMs. A sandbox that cannot publish reopens section 3.

## Open Questions

- Decided 2026-09-16 by the operator on the relay thread: a private project-tier record's full body is cached on the host like a shared one, so every record is searchable by its full text and not only by its index line. The operator's reason: the fleet is one sandbox environment of his own, nothing in it needs to stay off the host, and full-text search over bodies is the power the plan exists for. The review login is the operator's alone.
- Decided 2026-09-16 by the operator on the relay thread: the embedding server is a llama.cpp instance in embedding mode on the host's GPU, with the Qwen instance's context reduced to the 32K to 64K range to leave the VRAM. Left open: the exact VRAM the embedder takes, which the operator reads at section 1 and records beside the latency.
- Decided 2026-09-16 by the operator on the relay thread: the embedder's batch and micro-batch are 2048 tokens rather than the model's 8192-token window, with the context left at 8192 for the shared cache, and the publisher chunks every body to 512 to 1024 tokens. The reasons: a tighter chunk matches better than one vector over a whole long record, the smaller micro-batch fits the GPU without depending on flash attention engaging for a non-causal model, and the server's refusal of an oversized input makes the chunker's contract self-enforcing. Two arguments raised for the change were rejected as wrong on the facts and carry no weight: retrieved records go to the calling Claude session and never to the Qwen instance's context, and the judged channel sends that instance names and descriptions only, so chunk size is no budget line against the Qwen context; and the knowledge base and this store are separate databases never ranked together, so sharing one embedding server imposes no shared chunk shape.
- Whether to keep `BAAI/bge-m3` if the VRAM reading is worse than estimated. Recommended: keep it unless section 1's measurement says otherwise, and name `BAAI/bge-base-en-v1.5` at 768 dimensions as the lighter alternative, which changes the `VECTOR` width in one schema script and the config's model name.
- Whether the phase-two plan moves the record into the database with system-versioned history, or keeps markdown and retires only the journals from the sync. Owner: the operator, after this plan has run for a month.
- Whether the persona integration plan's curator writes through `memq add-operator` and the publisher, or through a direct procedure. Owner: that plan's author, once section 3 fixes the publisher's shape.

## Related

- `docs/archive/claude-kit_synced-semantic-memory_spec_v2.md`: the local semantic index and the git sync this plan layers over, and the "sync the sources, never the index" rule this plan honors by putting one embedder on the host.
- `docs/plans/claude-kit_memory-record-provenance_spec_v1.md`: the `author:` field, which `mem.Record.Author` carries when that plan lands and leaves null until then.
- `D:/knowledge-base/docs/architecture.md` and `security-model.md`: the operator's knowledge-base project, whose schema conventions, fusion shape, role split and audit tables this plan mirrors.
- `D:/agent_persona/docs/backlog.md`: the kit-resolution direction and the persona memory findings of 2026-09-16 that motivated this plan.

## Chapters

### Interim board 1 - 2026-09-17

Section 1 is mid-flight at its first fix round. This entry exists because the compaction gate asked for a boundary, not because anything is wrong.

Stage: section 1 implemented and verified, round 1 reviewed, fix round dispatched and running. No other section has started.

Live dispatches: one implementer-opus holding section 1, resumed with the round 1 fix brief. It was asked for four Major fixes (a shared timeout deadline across the checks with a test that actually exercises a timeout, a password sweep rebuilt on a stub sqlcmd that can observe the command line, a non-live lane that does not redden on a machine without sqlcmd, and a check 5 refusal keyed on the body naming the size ceiling rather than on the status alone) plus ten folded Minors. The three reviewers have returned and are finished.

Gate baseline: no prior baseline exists on this lane, both files being new. Measured on this machine at 2026-09-17T12:40Z on the worktree at origin/main e434db59 plus the section's edits, with another session holding the heavy-process claim for D:/agent_persona: KIT_MEMORY_DB_LIVE=1 node --test test/memory-database-host.test.js gave 9 tests, 9 pass, 0 fail, exit 0, read from the run's own marker.

Host readiness, discharging Standing Brief Amendment 3: the operator gave their word that the host is up and ready on 2026-09-17, in this session directly, in the message that also asked for the compaction checkpoint before the plan started.

Rulings adopted since the last boundary: two reviewer findings discarded against evidence. A blind finding asking that check 5 pass only on a 4xx status was discarded because the live server refuses an oversized input with HTTP 500, so the proposed rule would fail the working host. An adversarial finding that check 4 needs the embedder launched with an alias was discarded because the live run lists the model id verbatim, so the alias is already set.

Next action: read the fix round report, re-run the lane, run the owed review round over the fix delta, then close section 1 with its Chapter and move to section 2.

### Interim board 2 - 2026-09-17

Section 1 is held at a design stop. This entry exists because two review-round adjudications have now passed with no section closing, and because the compaction gate asked for a boundary. Nothing is wrong with the work; the stop is the kit's own rule firing.

Stage: section 1 implemented and verified, three review rounds run and adjudicated, the second fix round's work in the tree and green. The section cannot close until the design stop's ruling lands. No other section has started.

Live dispatches: none. The section's implementer finished its second fix round and the round 3 reviewer has returned. One peer ask is outstanding, described below.

Gate baseline: measured on SCOTT-CLAUDE at 2026-09-17T13:54Z, on the worktree at origin/main e434db59 plus dbaaf524 plus the section's own edits, with the machine's heavy-process claim held by this session for the run and released after it. KIT_MEMORY_DB_LIVE=1 node --test test/memory-database-host.test.js gave 15 tests, 15 pass, 0 fail, 0 skipped, exit 0, read from the run's own exit code. The prior baseline on this same lane was 13 tests, 13 pass, 0 fail. The delta is +2 cases and no regressions. The two new cases are a withheld control proving the connection counter reads non-zero on a real connection, and a boundary call against a host that never answers being bounded by the remaining budget.

Live probe values, from the fix round's own run and unchanged from the previous board except the latency medians: check 1 encrypt_option TRUE connected with -N and without -C; check 2 ProductVersion 17.0.1000.7 with IsFullTextInstalled 1, and KitMemory absent on the server as INFO; check 3 cosine distance 0 on identical VECTOR(1024) vectors; check 4 BAAI/bge-m3 listed, one vector of 1024 floats, Server header llama.cpp; check 5 long text median 18 ms and max 22 ms, query median 7 ms and max 12 ms, oversize refused with HTTP 500 naming the 2048 batch size; check 6 the ODBC 170 sqlcmd at version 15.0.1300.359. Full run and -Quick each exit 0. The two-second decision point in section 1's acceptance is not triggered.

The design stop, and what it holds. Review rounds 2 and 3 each returned at least one Major that is a defect in code the section's own previous fix round wrote, and both sit in one mechanism: the shared run budget, meaning the single deadline every check draws its remaining time from and the division of that remainder across each sqlcmd spawn's login clock and query clock. That is two consecutive rounds of fix-introduced Majors in one mechanism, which the executing-work skill makes a design stop rather than a third fix round. The provenance was read from the captures rather than from recollection: the deadline's own identifiers appear at equal counts in both captures, so round 1's fix wrote them, while the round 3 Majors' identifiers appear zero times in the round 2 capture and seven, one, seven and six times in the round 3 capture, with a token present four times in both as the control. Captures at .kit/scratch/memory-database/1/fix-round-2.diff and fix-round-3.diff.

The two held Majors, both confirmed against the code by this session rather than accepted from the lens. First, the round 3 change making a budget-starved check report INFO rather than FAIL leaves exit 0 reachable on a run that never attempted the embedding server at all, because INFO does not increment the failure counter and the script exits 0 unless that counter is positive; section 1's acceptance requires a run that cannot reach the host to exit non-zero, and section 5's doctor step would read such a run as PASS. Second, the spawn budget split uses banker's rounding, so it overruns the bound it was written to enforce rather than only at the documented one-second floor: run on this machine, 3000 ms of budget buys 4000 ms of clock and 7000 ms buys 8000 ms.

Ask outstanding: the design stop's judge. The repo's live expert seat, KIT: Expert, was sent the fixed brief on 2026-09-17 over the peer-session channel: the plan's Goal and section 1's acceptance as the trace target, the mechanism named, the round indices and the capture range, and no account of what happened inside the rounds. No fix round runs on that mechanism until the ruling lands. If the section's other work reaches the close gate with no answer, the scope-adjudicator is dispatched then and its ruling is the one in force, with a late answer recorded beside it.

Rulings adopted since the last boundary: none. Two findings were discarded against evidence in earlier rounds and are recorded on the previous board.

Approval drift recorded here, two edits this session made to section 5 before this boundary, both inside the approval-scoped fingerprint region. The first appends to section 5's doctor-step paragraph the three surfaces section 1 surfaced and left unedited, because section 5 is the section that wires the probe into the doctor: the duplicated line sanitizer, the probe's PowerShell 7 requirement against a doctor launched under Windows PowerShell 5.1, and check 1's dependence on a server-state permission the publisher login does not hold. The second appends to section 5's docs paragraph the requirement that the security model state the asymmetry section 1 measured between the two host links, the SQL link encrypted with a trusted certificate and the embedding link plain HTTP carrying record bodies, and name whether that is accepted or closed.

Minors: eighteen across the three rounds, held in .kit/scratch/memory-database/minors-section-1.md for the section's close pass. One was routed to section 5 as an out-of-scope surface. Four of the round 3 Minors sit in the held mechanism, so the close pass cannot run before the ruling.

One surface the implementer raised and this session checked and discarded, recorded because a discarded finding that leaves no record is one the next round rediscovers. The implementer reported that check 5's measured median of 18 ms for a 4144-character text contradicts an "about 650 ms" figure in the operator tier, and asked for it to be routed as a memory correction. Reading the cited record found the correction already in place: its latency paragraph records the 20 ms warm figure, the 7 ms query figure, and that the single-sample 650 ms reading does not reproduce against a ten-sample median and is not a prompt-cache artifact. This session's own measurement agrees with the record. Nothing is owed, and the record is stamped applied for this section.

Next action: await the design stop's ruling, then either restore the mechanism to the form the ruling names or re-enter the held Majors into a fix round, run the Minor close pass, run the close gate, and close section 1 with its Chapter before moving to section 2.

### Interim board 3 - 2026-09-17

The design stop's ruling landed and section 1 is moving again, with section 2 now running beside it.

Stage: section 1 is in its removal fix round, the one the ruling ordered. Section 2 is in its first implementation pass. No section has closed.

Live dispatches, two. An implementer-opus holds section 1's two files, asked for exactly two changes: restore the starved-check disposition to FAIL naming the check and the exhausted budget, and fix the spawn budget split so the two sqlcmd clocks together cannot exceed the remaining budget, with the timing assertions tightened to discriminate the bound. An implementer-fable holds section 2's schema, full-text, procedures, security, installer, README and install test.

The design stop's ruling. The ask went to the repo's live expert seat, KIT: Expert, on 2026-09-17 over the peer-session channel and was unanswered when section 1's other work reached the close gate, so the scope-adjudicator was dispatched and its ruling is the one in force. A late answer from the expert seat will be recorded beside it. The bucket is refuse, on the design stop's third reading: the mechanism as built departs from the form section 1's acceptance bullet asks for, in one of its four parts. Three parts are that form and stay as built, since a bullet that bounds a whole run by one configured timeout is a shared deadline once it is built: the script-wide deadline, the remaining-time arithmetic every check draws from, and the split of each spawn's share across sqlcmd's login clock and query clock. The fourth departs: a check the budget stops before it reads the host reports INFO, which leaves exit 0 reachable on a run that never touched the host, while the bullet requires a run that cannot reach the host to exit non-zero with the failing check named. The form the removal restores is FAIL on any starved check, naming the check and the exhausted budget.

This session checked the ruling's grounds on its own surface rather than adopting them on the seat's word. The cited bullet is section 1's acceptance as written in this document, and the departure it names is the one this session had already confirmed against the code: INFO does not increment the failure counter, and the script exits 0 unless that counter is positive.

Ruling adopted, recorded as a standing brief amendment above rather than as a verdict, so the next round judges against the rule rather than against the history: a check a run budget stops before it reads the host reports FAIL.

The second held Major re-enters as an ordinary fix. The spawn budget split rounds to even, so 3000 ms of budget buys 4000 ms of clock, and that sits in a part the ruling keeps as built. It is therefore a repair rather than a removal, and it rides in the same fix round. The adjudicator also named, without ruling on it, that each clock's one-second floor lets a starved spawn run past the deadline and that round 3's timing assertions admit ceilings well above the configured timeout. Both are in the fix brief as work to settle rather than to note.

The design stop's count restarts at this ruling, so a Major in the removal delta opens a fresh pair rather than firing the same stop again.

Section 2's declared decisions, from its intake gap check. This machine's local default instance is Windows-authentication-only, confirmed by reading SERVERPROPERTY('IsIntegratedSecurityOnly') as 1 beside product version 17.0.1135.8, full-text installed, and VECTOR_DISTANCE working over a vector(3). A SQL login created there cannot authenticate, so section 2's test proves every role and tenancy gate with EXECUTE AS USER inside the deploy connection, and the proof by connecting as each login belongs to the host run. The host half of section 2's acceptance is the controlling session's own act rather than the implementer's, so the installer's first run against the live host is not delegated. Script files within each directory carry numeric prefixes so the intended order is the lexical order. The test's database carries a run-scoped suffix and is dropped at teardown, its logins file lives under the test's temp directory, and it drops exactly the logins its own run created.

Minors: still eighteen across three rounds, in .kit/scratch/memory-database/minors-section-1.md. The four that sat in the held mechanism are released by the ruling, so the close pass can run once the removal fix round is adjudicated.

Next action: adjudicate the removal fix round, run the owed review round over its delta, run the Minor close pass and the close gate, and close section 1 with its Chapter; adjudicate section 2's first pass and run its round 1 reviewers.

### Interim board 4 - 2026-09-17

Both sections have now been through a full review round. Neither has closed, and both are in a fix round.

Stage: section 1's fix round on the consult's ruling landed and was reviewed; it is now in a second fix round on that review's findings. Section 2's corrected pass landed and was reviewed by three lenses; it is now in a consolidated fix round on their findings.

Section 1, the consult's ruling. The implementer built it and this session confirmed it against the code rather than on the report: `Get-ClockSeconds` is `max(1, floor(BudgetMs / (1000 * Clocks)))` returning zero for a spent budget, and all five budget screens read a passed deadline and nothing else. Both reviewers traced the arithmetic against the ruling at every boundary input and both found it correct. The form the consult ordered is built.

Section 1's review round returned CHANGES_REQUIRED from both lenses, which converged independently on the same defects. The lead finding is one this session had classified as exempt in round 3 and was wrong about: when the configured database name fails the identifier screen, the existence query is left out of the batch entirely, and the run then prints INFO for check 2's database line and exits 0. Nothing measured what that check was asked to measure, which is what the standing amendment bars, and the trigger is a database name that is legal on the server but not a plain identifier. The earlier classification rested on the batch having run, which is true of the batch and false of the reading. It is dropped and the line becomes FAIL, as does the matching config line one step earlier, with the config read still not aborting so the other checks keep running.

That round is not a second design stop. A design stop keys on a mechanism's form being refused twice, and this round's Majors sit elsewhere: the tests built around the mechanism, and an INFO site that predates the ruling. The form itself was accepted this round on two independent readings, so the count does not advance and no second consult is convened.

Section 2's corrected pass. The resolver is back on `ORIGINAL_LOGIN()`, confirmed at `Procedures/020-CallerSandbox.sql:38`; `SUSER_SNAME()` survives only as the `mem.QueryLog.SessionLogin` column default, which is the audit column that makes an impersonated read visible. The tenancy proof no longer runs through impersonation: it re-points the sandbox row at the connecting login between assertions, which is data rather than a security token. Impersonation remains only in the permission-gate subtests, which is correct, because a database user's permission set is exactly what the permission engine evaluates under `EXECUTE AS USER`, and a new subtest pins that impersonation can no longer move tenancy, with red-first evidence from a scratch database. The unasked error-log table and procedure are deleted, confirmed by a sweep with a control that speaks.

Section 2's round 1 ran all three lenses, since the section plainly meets the security reviewer's trigger. All three traced the tenancy model, the role gates and the injection surface independently and all three found them sound, which is recorded in the Minor file so a later round does not re-derive it. Five Majors came back: the installer's Windows-auth branch omits `-N`, so the generated passwords cross the wire as cleartext T-SQL, confirmed by this session at `Install-MemoryDatabase.ps1:148-149` against the SQL-auth branch four lines above that gets it right; the logins file is written before any script runs, so a failed install leaves passwords that exist on no server and a refusal that cannot tell the operator which; the per-script digest can report no change for a change the script tree already produces, which is what the section's idempotence acceptance rests on; the publisher roster departs from the spec; and several refusal assertions pin whole sentences.

Approval drift, ruled and made. Section 2's roster above is amended from seven procedures to nine. The spec said the publisher role holds EXECUTE on exactly seven, while section 3 of the same plan requires the publish-run and index-orphan tables written under an execute-only publisher login and names no procedure for either. The two surfaces contradicted each other and the roster was the stale one, so this session amended it rather than dropping capability section 3 needs. It turns on the document's own text rather than on preference, which is why it was ruled here rather than raised. It is open to the operator to overturn.

Live dispatches, two, both fix rounds: the implementer-opus holding section 1's two files, and the implementer-fable holding section 2's changeset.

Minors: twenty-seven across four rounds for section 1 in `.kit/scratch/memory-database/minors-section-1.md`, of which round 5 added eight and six of those are folded into the current fix brief. Section 2's are in `.kit/scratch/memory-database/minors-section-2.md`, with ten accumulating for its close pass and the rest folded into its fix brief.

Owed by this session and not delegated: its own run of each section's lane, since a subagent's green is not this session's evidence; the first installer run against the live host, which is section 2's acceptance and the controlling session's own act; both Minor close passes; both close gates; both Chapters.

Next action: adjudicate both fix rounds, run each section's lane from this session against the recorded baselines, run the host install for section 2, then the Minor close passes, the close gates and the Chapters for sections 1 and 2.

### Chapter 1 - 2026-09-17

Completed: 1. Prove the host

What shipped: `plugins/claude-kit/db/Test-MemoryDatabaseHost.ps1`, a six-check probe of the memory database host, with its suite at `test/memory-database-host.test.js`. The probe reads the client config, then checks the connection and its encryption, the server version and full-text availability, the VECTOR type and its distance function, the embedder, embedding latency, and the sqlcmd client tools. It exits non-zero when any check fails, and every check that could not read the host reports FAIL naming the check and the exhausted budget.

The six values, read from a probe run against the host at 192.168.58.245 that exited 0 with every check PASS or INFO:

1. Connection: `encrypt_option = TRUE`, connected with `-N` and without `-C`, so the host's certificate validates.
2. Server: ProductVersion 17.0.1000.7, IsFullTextInstalled 1.
3. Vector: `VECTOR_DISTANCE` cosine on identical `VECTOR(1024)` vectors returns 0.
4. Embedder: model BAAI/bge-m3 listed, one vector of 1024 floats, Server header llama.cpp.
5. Latency: 4144 characters median 19 ms, max 33 ms; a 111-character query median 6 ms, max 12 ms; an oversize 16132-character input refused with HTTP 500 naming a 3926-token input against a 2048 batch size.
6. sqlcmd: the ODBC 170 client tools, version 15.0.1300.359.

Check 5's median for the long text is 19 ms. Section 1's acceptance made the lighter embedding model an operator decision only if that median exceeded two seconds, so that fork does not open and section 3 is unblocked without an operator call. This also settles the correction to interim board 2, which had cited an operator-tier figure of about 650 ms: the measured value is two orders of magnitude below the threshold either way.

Host readiness: the operator's word that the host instance is up reached this session directly on 2026-09-17. That discharges Standing Brief Amendment 3, which gates any section that touches the host.

The design stop. One mechanism was held: the single run budget every check draws from, split again across each sqlcmd spawn's two clocks. The ask went to the repository's expert seat and was unanswered when the section's other work reached its close gate, so the `scope-adjudicator` was dispatched and its ruling is the one in force; a late expert answer would be recorded beside it. Bucket: refuse, on one of the mechanism's four parts. Kept as built: the script-wide deadline, the remaining-time arithmetic, and the two-clock split, because a bullet that bounds a whole run by one configured timeout is a shared deadline once it is built. Refused: the disposition of a check the budget starves, which reported INFO and so left a zero exit reachable on a run that never touched the host, while the acceptance requires an unreachable host to exit non-zero with the failing check named. This session checked the grounds on its own surface rather than adopting them on the seat's word.

The consult. The removal fix round then produced a second failed attempt at the same mechanism, so rather than designing it a fifth time this session convened a `consultant` at fable and high effort. It ruled that the run's deadline governs whether a boundary call starts while each call's own clock governs how long it runs, that the clock is the remaining budget divided down across the clocks that run in sequence, and that the share is lifted to the tool's floor where less remains. It also ruled out two things this session might otherwise have tried: replacing the two-clock mechanism with a process kill, and raising the minimum timeout. The declared overshoot bound that follows: the one call that crosses the deadline finishes less than two seconds past the configured timeout, no call starts after it, and a run with time left on the clock is never refused. Both rulings were verified against this session's own arithmetic before adoption, and both were written into the Standing Brief Amendments block so later rounds judge against the rule rather than the history.

A correction this session owes out loud. In round 3 it classified check 2's database line as an exempt INFO on the ground that the batch had run and the host had answered. That was wrong: when the configured database name fails the identifier screen, the existence query is left out of the batch entirely, so the check measured nothing it was asked to measure and the run still exited 0. The reviewers found it, the earlier classification is dropped, and both that line and the matching config line one step earlier are now FAIL. The config read still does not abort, so the other checks keep running and only the exit code changes.

Decisions and surprises. The overshoot bound's precondition is stated rather than engineered away: beyond this script's own arithmetic the bound rests on sqlcmd honouring `-l` and `-t` and on `Invoke-WebRequest` honouring `-TimeoutSec`, and the header says so plainly, because wrapping the spawn in a kill would mean moving to a redirected-file process launch and taking three new failure modes on the credential path. A reviewer finding about check 5 costing twenty-one timeouts was narrowed rather than implemented: the sample loop breaks on the first call that does not answer, so a dead server costs one timeout and the twenty-one case needs a server answering just inside the timeout every time, which is the measurement check 5 exists to take. Standing Brief Amendment 1 was read as reaching the probe's inline T-SQL here-strings and not only `.sql` files, so those three batches were brought to the sql-style skill and verified against the live host; that reading is recorded here because it is a judgment rather than a quotation.

Review findings: five rounds. Rounds 2 to 4 were adversarial at opus; round 5 was the adversarial and blind pair at opus over the fix delta, both returning CHANGES_REQUIRED and converging independently on the same defects. Two Majors from round 5 were fixed: the INFO site above, and a new test that passed on both the defective and the fixed code path and so proved nothing, which was retired in favour of an exact-value table that discriminates. Thirty-five Minors accumulated across the five rounds; the close pass re-checked the nineteen still open against the current code and fixed eleven, closed seven as no longer reproducing, and left one standing by decision with its reason. The full list and every disposition are at `.kit/scratch/memory-database/minors-section-1.md`. One Minor was routed out of the section: `Get-SanitizedLine` is duplicated with `doctor.ps1`, which is not in section 1's files in scope, so the merge belongs to section 5.

Discarded: a round 4 finding that the two inner budget guards are dead code was confirmed but not acted on as a removal; they stay as a belt and the header now names the callers' screens as the live check. A round 3 claim about sqlcmd's `-X` flag was narrowed to what the installed banner actually supports rather than deleted, since its load-bearing conclusion is confirmed twice over.

Metrics: six checks, five reviewer rounds, one design stop, one consult, thirty-five Minors dispositioned.

Gate: `KIT_MEMORY_DB_LIVE=1 node --test test/memory-database-host.test.js`, the targeted lane, run by this session after the close pass rather than taken from a subagent's report: 17 tests, 17 pass, 0 fail, 0 skipped, exit 0, read from the run itself. The live case against the real host is among the passes. Baseline for this lane was 17/17/0 exit 0, so no delta. The lane ran under named contention: the machine's heavy-process claim was held by session `8e6ec236-97a8-4fbd-9cce-569dad115ad6` under the name `AP: Dev`, twelve minutes past its own 1500-second bound with no runner process behind it. Under the claim protocol an aged claim is proceeded past unclaimed, so this session and its agents ran without writing a claim, left the foreign one untouched, and routed the release to the live coordinator seat, which owns probe-and-release.

Delta: `plugins/claude-kit/db/Test-MemoryDatabaseHost.ps1` and `test/memory-database-host.test.js`.

Stamps: none. No memory record was applied in this section.

Next: 2. The schema, the security model and the installer.

Commit Model: Branch-and-PR, draft-per-plan.

### Chapter 2 - 2026-09-17

Completed: 2. The schema, the security model and the installer

What shipped: the memory database itself, as 31 T-SQL scripts under `plugins/claude-kit/db/` in four ordered directories plus a PowerShell installer, a README and a test lane. `Schema/` carries eleven guarded creates. `FullText/` carries the catalog and the record index. `Procedures/` carries fifteen modules under the `mem` schema, every one resolving its caller through `mem.CallerSandbox()`. `Security/` carries three roles, five logins and the sandbox rows. `Install-MemoryDatabase.ps1` applies them in order, is re-runnable, and prints one line per fact.

The host acceptance, run by this session rather than delegated. Two consecutive installer runs against 192.168.58.245 both exited 0. The first created the database, applied 31 scripts with 31 changed, wrote the logins file and created all five logins. The second reported `Database KitMemory: present`, `Schema version: carried 1, installed 1`, `Logins file: not written (every login present)`, every script `no change`, and `Summary: 31 script(s) applied, 0 changed`.

The publisher DENY, proven on the host as a real SQL login rather than through impersonation. Connected as `kit_scott_claude`, a member of `mem_publisher`: `SELECT COUNT(*) FROM mem.Record` was refused with `Msg 229 ... The SELECT permission was denied on the object 'Record', database 'KitMemory', schema 'mem'`. The control is the same login on the same connection executing `mem.usp_Health`, which succeeded and returned only its own sandbox, so the refusal is the DENY working rather than a broken connection. A detail worth keeping: selecting from `mem.CallerSandbox()` directly is refused too, so the tenancy resolver is reachable only through the procedures via ownership chaining.

Tenancy. The resolver reads `ORIGINAL_LOGIN()`, not `SUSER_SNAME()`. The first implementation pass changed it to `SUSER_SNAME()` so its tests could use `EXECUTE AS` on a Windows-authentication-only instance; this session refused that. `SUSER_SNAME()` follows `EXECUTE AS` while `ORIGINAL_LOGIN()` does not, so the relaxed form is fail-dangerous: the first module declared `WITH EXECUTE AS`, or the first `IMPERSONATE` grant, would silently re-point every publisher read at another sandbox's private rows. Both of the implementer's factual claims were verified here (no kit principal holds `IMPERSONATE`, no mem module runs `WITH EXECUTE AS`) and the deviation was still refused, because the case rested entirely on today's grant set and a security guard is not relaxed to make a test runnable. The replacement proof re-points `mem.Sandbox.PublisherLogin` at the connecting login between assertions, which is data rather than a security token. Impersonation survives only in the permission-gate subtests, which is correct, since a database user's permission set is exactly what the engine evaluates under `EXECUTE AS USER`, and a subtest now pins that impersonation cannot move tenancy, with red-first evidence from a scratch database.

An engine question three reviewers could not settle, settled by a live run. All three lenses flagged that the lexical search path never ran under a publisher token and that they could not tell from source whether `CONTAINSTABLE` inside a chained procedure honours ownership chaining the way a table reference does. If it did not, every production text search would return error 229 while the suite stayed green. A lexical `usp_Search` under `EXECUTE AS USER = kit_scott_claude` returned both visible rows with no error, so chaining does cover it and the publisher's schema-level DENY does not reach it. The case is now in the suite with a comment stating what it settles.

Approval drift. Section 2's publisher roster in this document was amended from seven procedures to nine, and the amendment is recorded in place above. The spec granted EXECUTE on exactly seven while section 3 of the same plan requires the publish-run and index-orphan tables written under an execute-only publisher login and names no procedure for either, so the two surfaces contradicted each other and the roster was the stale one. It was ruled here rather than raised because it turns on the document's own text rather than on cost or risk appetite. It is open to the operator to overturn.

Decisions and surprises. An error-log table and its procedure were built, found in review to be something the spec never asked for anywhere, and deleted, with every CATCH left as a bare `;THROW`. That departs from the sql-style skill's audit-and-absorb rule and is deliberate: sqlcmd `-b` is how the caller learns of a failure and the audit table is gone. The installer's Windows-authentication branch was sending generated passwords across the wire in cleartext, because it added the encryption flag only when a certificate-trust flag was also given, four lines below a SQL-authentication branch that always added it; both branches now always ask for encryption. The logins file was being written before any script ran, so a failed install left passwords that existed on no server and a refusal that could not tell the operator which; it is now written immediately before the logins script, and the refusal names which of the file's logins are on the server and which are not. The per-script change digest could report no change for a change the script tree itself produces, since it read a principal without its SID while the logins script runs `ALTER USER ... WITH LOGIN`; it now covers constraint definitions, index columns, column collation and identity, and principal SIDs, and its header names what remains outside it. One surprise ran the other way: a reviewer expected `SUSER_SNAME()` to return NULL for a loginless impersonated user, and on this engine it returns the user's SID as text, so the fallback added for it is present but inert and the column comment says so.

Review findings: one round with all three lenses at fable, since a section that builds a tenancy boundary and generates login passwords plainly meets the security reviewer's trigger. Adversarial and blind both returned CHANGES_REQUIRED; security returned CONCERNS. All three traced the tenancy model, the role gates and the injection surface independently and all three found them sound, which is recorded so a later round does not re-derive it. Five Majors were fixed. The close pass then fixed two more races by taking an application lock on the shared publish path and by refusing a placeholder password rather than creating a login with a public value, and verified both by reversing the fixes and watching the lane fall to 19 pass and 3 fail. Every Minor and its disposition is at `.kit/scratch/memory-database/minors-section-2.md`.

Standing, with reasons recorded rather than fixed: the two inline functions are dropped and re-created on every run, leaving a window where publisher procedures fail, because closing it means departing from the sql-style function idiom that Standing Brief Amendment 1 binds, which is the operator's call and is a two-file change if wanted; shared rows are fleet-writable by design, the same trust the git sync already extends, and the sentence naming it in `docs/security-model.md` belongs to section 5.

Metrics: 31 scripts, 15 procedures, 3 roles, 5 logins, 3 reviewer lenses, 2 host installer runs.

Gate: `node --test test/memory-database-install.test.js`, the targeted lane, run by this session after the close pass rather than taken from a subagent's report: 22 tests, 22 pass, 0 fail, 0 skipped, exit 0, read from the run itself. The live half of the lane exercises the machine's own SQL Server instance. Baseline was 21/21/0 exit 0, so the delta is the one subtest the close pass added. This lane ran under the same named contention Chapter 1 records.

Delta: `plugins/claude-kit/db/Schema/`, `plugins/claude-kit/db/FullText/`, `plugins/claude-kit/db/Procedures/`, `plugins/claude-kit/db/Security/`, `plugins/claude-kit/db/Install-MemoryDatabase.ps1`, `plugins/claude-kit/db/README.md`, `test/memory-database-install.test.js`.

State altered outside the repository: the host at 192.168.58.245 now carries a `KitMemory` database and five `kit_*` logins that did not exist before, and their generated passwords are in `~/.claude/kit-memory-db-logins.json` on this machine. To undo: drop the database, drop the five logins, and delete that file. The `kit_deploy` login holds the rights for all three.

Stamps: none. No memory record was applied in this section.

Next: 3. The publisher and the spool.

Commit Model: Branch-and-PR, draft-per-plan.

### Interim board 5 - 2026-09-17

Section 3 is mid-build. This entry exists because the compaction gate asked for a boundary, not because anything is wrong.

Stage: sections 1 and 2 are closed, their Chapters written and committed at `fbedb248`. Section 3 is in its first build pass, resumed after a NEEDS_CONTEXT that a consult ruled on. Nothing of section 3's is staged, and the only uncommitted work of this session's own is this document plus the two files the ruling opened.

Live dispatches, one. An `implementer-opus` (task `ac89fb1e2043094df`) holds section 3's files in scope plus the three the ruling added. It was asked for the publisher, the spool and the detached session-start spawn. Its publish sequence, after the spool drain: walk the store; send every walked record through `usp_UpsertRecords` in batches with the removed list null, summing the dispositions for the summary line; read the sandbox's own inventory once through `usp_ListRecords` for the current model identity; name as removed the listed project-tier rows whose segment and file key the walk no longer finds, with a walk that errored on any tier or segment naming nothing removed and saying so on its summary line; embed the listed rows the reader reports as carrying no embedding, never splitting one record's chunks across two database batches, with the model string written and the model identity passed coming from one place; then write the index orphans and one publish-run row. The agent is demonstrably live: its transcript grew from 1,193,874 bytes at its first-turn reading to 1,763,386 bytes at 2026-09-17T18:38Z, and the harness progress line at 18:50Z reads that it is repairing a duplicated module export in `memq.js`.

Gate baseline. No gate has run in this session since Chapter 2's. Section 3's own lane, `test/memory-database.test.js`, is a new file and has no baseline on this machine. The companion lanes carry the baselines their own Chapters record, and this session will re-measure each before reading anything into section 3's counts rather than trusting a figure taken two sections ago.

The ruling adopted since the last boundary. Section 3's first dispatch returned NEEDS_CONTEXT on a real gap rather than on a briefing defect: an execute-only publisher cannot learn a record's id, cannot learn which records carry no embedding for the current model, and cannot learn which of its own file keys the database still holds, because `DENY SELECT` covers every table and no delivered procedure answers any of the three. The spec was silent and the change is hard to reverse, so a `consultant` at fable ruled rather than this session. It added one reader, `mem.usp_ListRecords`, which takes the embedding model identity and returns one row per record the caller may see. This session confirmed the ruling's three cited facts against the delivered scripts before adopting them: `usp_UpsertEmbeddings` keys every chunk on the record id alone at `plugins/claude-kit/db/Procedures/050-usp_UpsertEmbeddings.sql:110`, `usp_UpsertRecords` returns counts and no identity at `040-usp_UpsertRecords.sql:379-384`, and the publisher's grant set is the nine procedures at `plugins/claude-kit/db/Security/010-Roles.sql:51-59`.

The heartbeat rule, which is this section's most load-bearing fact. The publisher sends every record its walk finds on every run and never skips one whose body hash is unchanged. The database's `unchanged` disposition is not a diff result but a liveness heartbeat: `usp_UpsertRecords` stamps `LastPublishedDt` for both `unchanged` and `older` at `040-usp_UpsertRecords.sql:307-314`, and `usp_CurationOrphans` lists every live shared row whose `LastPublishedDt` is older than the cutoff. So a publisher that skipped hash-equal records on the client would starve that stamp and turn every untouched shared record into a curator-visible orphan after thirty days. This session's own first lean reached the same answer for a weaker reason, that the server already returns an `unchanged` count and so must be the intended differ, and that reason would have ranked a local publish-state sidecar as a close second. The heartbeat rules that option out rather than merely beating it. Both facts are confirmed on this session's own surface and are recorded as Standing Brief Amendment 6.

Approval drift recorded here, five edits this session made inside the approval-scoped fingerprint region, all deliberate and all open to the operator to overturn. Standing Brief Amendments gained entry 6, the send-everything rule and its heartbeat reason. Section 2's publisher roster moved from nine procedures to ten, with the parenthetical now recording both amendments and their separate grounds. Section 2's procedure enumeration gained `usp_ListRecords` and what it returns. Section 3's publish clause was rewritten to name the reader and the removed set it derives. Section 3's files in scope gained the three files the ruling opened, and its Tests line's hash-diff clause was replaced with the send-everything contract, since the clause as written asked for a client-side skip the heartbeat rule forbids.

Minors: none yet for section 3. No review round has run on it.

Owed by this session and not delegated: its own run of section 3's lane and the companion lanes, the host install run that puts `usp_ListRecords` on the live database, which is this session's act exactly as section 2's installer run was, the Minor close pass, the close gate and Chapter 3.

Next action per section. Sections 1 and 2 are closed and need nothing. Section 3: await the implementer, read its diff and hunt the fail-dangerous patterns, run the targeted lane and the companion lanes from this session rather than from its report, run the host install for the new procedure, then open round 1 with the adversarial and blind pair plus the security lens, since the section spawns a process, makes a network call, reads a credential and touches a grant surface.

### Interim board 6 - 2026-09-17

Section 3's round 1 is adjudicated and its fix pass is in flight. This entry
exists because the compaction gate asked for a boundary at a clean point, and a
finished review round is one.

Stage. Sections 1 and 2 stay closed at `fbedb248`. Section 3's first build pass
delivered, and its three reviewers have reported. Nothing of section 3's is
staged. The uncommitted work is the section's eleven files plus this document
and one kaizen note.

Gate baselines, measured by this session on a quiet box rather than taken from
the implementer's report. `test/memory-database.test.js` 22 tests, 22 pass, 0
fail, exit 0. `test/memory-session.test.js` 83 tests, 83 pass, 0 fail, exit 0.
`test/memq-grant.test.js test/memq.test.js` 769 tests, 769 pass, 0 fail, exit 0.
The last two sum to the 852 the implementer reported for its combined companion
run, so its counts were accurate.

A red this session caused and then cleared, recorded because the lesson outlives
it. The first companion run came back exit 1 with two failures in
`test/memory-session.test.js`, both the absence of the sync nudge block rather
than wrong content, both burning over seven seconds. It did not reproduce: the
same file alone on a quiet box returned 83 of 83 with the whole file taking 52
seconds. The cause was this session's own sequencing. Three fresh-context
reviewers had been dispatched and were fanning out across the tree with git and
grep while the suite ran, and `syncNudge` shells out to real `git rev-list` and
`git status` subprocesses, so those probes timed out and the nudge returned
null. The heavy-process poll cannot see in-process agent fan-out, and the slot
was claimed by this session, so the contention was entirely its own and no check
available would have caught it. A gate and a review round are not overlapped
again on this plan. The lesson went to the kaizen inbox one level more general
than the incident.

The review round. Three lenses at fable over the uncommitted changeset at base
`e81f5f8f`: adversarial with the spec, blind with the diff alone, and the
security lens, which the section triggers on all four of its counts since it
spawns a process, makes a network call, reads a credential and widens a grant.
The adversarial and blind lenses both returned changes required; the security
lens returned concerns. The full adjudicated list is at
`.kit/scratch/memory-database/section3-round1-findings.md`, which records 25
accepted items, 3 refused, and one non-finding recorded so it is not
re-derived.

What the round found, in one sentence each for the items that matter. A live
record and its archived namesake collide on one host row, so a live body is
silently never published; the blind and adversarial lenses found this
independently. An engine worker with an overridden store root publishes under
the default store's credential and soft-deletes every project row that store
published, which the session hook already refuses to do for exactly this reason
while the grant does not. The sqlcmd child inherits an environment that can
steer it through a startup script, since the spawn passes `-x` and not `-X`.
The sqlcmd path falls back to the bare-name PATH search the pin exists to
prevent. The interactive stamp budget is incoherent: a 400 millisecond kill
against sqlcmd clocks lifted to their one-second floor, so on a healthy host the
child is killed on nearly every stamp, the stamp spools anyway, and a kill
landing after the server committed produces a duplicate row on the next drain.
Two values are copied out of `memory-index.js` rather than imported, which the
existing comment already admits. The spool's byte prefix is computed from a
decoded string, so invalid UTF-8 cuts a line in half. And the grant's own
justification says the verb writes nothing into the store, which is not what the
code does.

Two verdicts worth keeping for their own sake. The adversarial lens checked the
`require.main === module` dispatch move below `module.exports` and found it
correct and behaviour-preserving, so that question is closed. The security lens
confirmed the credential path: the password is spelled in exactly one place, the
child environment, and reaches no argv, log line, error string, spool line or
temp file. It also confirmed the T-SQL encoding holds against a hostile record
body, and that `usp_ListRecords` is fail-closed on visibility.

Approval drift authorized this session, one item. Finding A8 requires exporting
`EMBED_BATCH` and `hashOf` from `plugins/claude-kit/scripts/memory-index.js`,
which section 3's files in scope do not name. This session authorized that edit,
bounded to the export list, because it is the change the client's own comment
anticipates and the single-source rule requires. It is open to the operator to
overturn.

Minors: none yet closed. The Minor close pass runs after the fix round returns.

Owed by this session and not delegated: its own re-run of all four lanes after
the fix pass, the host install run that puts `usp_ListRecords` on the live
database, the Minor close pass, the close gate and Chapter 3.

Carried for section 4, settled this session at no cost. `usp_Search` returns one
scalar `[Json]` column through `FOR JSON PATH`, sixteen fields per hit including
a description, so fifty hits run well past sqlcmd's default display width. The
answer already exists in section 3's transport, which passes `-y 0` because a
JSON answer past that width is cut silently. Section 4 inherits the fix if it
reuses `runBatch` rather than spawning its own client.

Next action per section. Sections 1 and 2 are closed and need nothing. Section
3: await the fix pass, re-read its diff, re-run all four lanes from this session
rather than from its report, run the host install for the new procedure, then
judge whether the round's findings are answered and either close or open round
2.

### Interim board 7 - 2026-09-17

Section 3's round 2 is adjudicated and its second fix pass is in flight. This
entry exists because the compaction gate asked for a boundary, and a finished
review round is one.

Stage. Sections 1 and 2 stay closed. Section 3's code is committed and pushed
at `0a19bf92`, so the work is durable and a fresh session resumes from the
branch rather than from a dirty tree. PR 59 is open, still draft, auto-merge
never armed. The tree is clean apart from the nine untracked `.agentic-*` files
that stay unstaged by standing instruction.

Gate baselines at `0a19bf92`, all measured by this session on a quiet box with
exit codes read from the runs themselves rather than taken from an
implementer's report: the database lane 38 of 38, the session lane 85 of 85,
the memq and grant lanes 769 of 769, and the live install lane 28 of 28 against
the local SQL Server instance. Nothing is red.

Round 1, closed. Three lenses at fable found 25 accepted defects, 3 refused.
The full list is at
`.kit/scratch/memory-database/section3-round1-findings.md`. A fix pass
addressed all 25, and round 2 verified each one item by item: all 25 are
substantively fixed.

Round 2, adjudicated. The same three lenses over the committed section found
14 more accepted items, 2 refused, at
`.kit/scratch/memory-database/section3-round2-findings.md`. The fact that
shapes this round is that four of round 1's own fixes created new defects. The
twin-record fix pushed a duplicate onto the walk's failure list, which flipped
the partial flag and disabled the removal leg store-wide. The spool rewrite
left a state, a spool holding only malformed lines, that wedges every future
publish permanently with the text "the memory database did not answer: null".
The record-packing fix pushed the embedding response past the shared reader's
262144-byte cap, since this host's embedder answers 1024 dimensions and sixteen
of those vectors is about 327 KB. And the store-root refusal orphaned two
things at once: an interactive spool that no publish will now drain, and the
permission grant that covers the verb, which fires only in the environment
where the verb now refuses.

One item is a half-fix rather than a new defect, and two lenses found it
independently. The sqlcmd path no longer falls back to a bare name on PATH, but
it still takes its first candidate from an environment variable, so a
repository-committed terminal environment can still choose which binary
receives the login's password. The security lens noted that the section's own
test steers resolution through that same variable, which is what confirms the
mechanism.

The design stop, and where it stands. The governing skill declares a design
stop after two consecutive rounds of fix-introduced defects at this severity.
Round 1's findings were original defects, so round 2 is the first such round
and not the second. The second fix pass is therefore the decision point: if it
introduces a third generation, this section stops for a rethink rather than
opening a round 4. The brief says so in those words. Two things argue against
stopping now: the adversarial lens judged its own three Majors one-line fixes,
and the strongest security fix available removes code rather than adding it,
since passing the batch to sqlcmd on standard input deletes the temp file, the
file-mode question that does not work on Windows anyway, and the stale-file
sweeper together.

An orchestration error this session made, recorded because the lesson outlives
it. The blind lens reported its dispatch brief as contaminated: the brief named
the new and rewritten surfaces, which is exactly the intent that lens is meant
not to receive. It disregarded the framing and read the diff cold, so the round
stands and nothing needs re-running. The rule going forward is that a blind
brief carries the ref and the hunt classes and never the changed surfaces by
name. This is the second briefing-side error this session has caught and
recorded, the first being a suite run beside live review agents.

Minors: none closed yet for section 3. The Minor close pass runs once the
rounds converge.

Owed by this session and not delegated: its own re-run of all four lanes after
the second fix pass, the host install run that puts `usp_ListRecords` on the
live shared database at 192.168.58.245, which is this session's act exactly as
section 2's installer run was, the Minor close pass, the close gate, and
Chapter 3. The host install is deliberately held until the procedure stops
changing under review.

Carried for section 4. `usp_Search` returns one scalar JSON column with sixteen
fields per hit, so fifty hits run past sqlcmd's default display width. Section
3's transport already answers it by passing `-y 0`, and section 4 inherits the
fix if it reuses that transport rather than spawning its own client. Section 4
should also know that the shared HTTP response reader caps a body at 262144
bytes, which is the cap round 2 found the embedding leg crossing.

Next action per section. Sections 1 and 2 are closed and need nothing. Section
3: await the second fix pass, re-read its diff, re-run all four lanes from this
session, then judge convergence. If it introduced no new defects, close the
Minors, run the host install and write Chapter 3. If it introduced another
generation, convene the design stop rather than opening round 4.

### Interim board 8 - 2026-09-17

Section 3's round 3 is adjudicated and the section is held at a design stop.
This entry exists because the compaction gate asked for a boundary, and a
finished review round is one. Nothing is wrong with the work; the stop is the
kit's own rule firing on provenance.

Stage. Sections 1 and 2 stay closed. Section 3's code is committed and pushed
at `0a19bf92` with its second fix pass in the tree unstaged. PR 59 is open,
still draft, auto-merge never armed. The tree carries the section's six
modified files, this document, and the nine untracked `.agentic-*` files that
stay unstaged by standing instruction.

Gate baselines, all four lanes re-run by this session after the second fix
pass, on a quiet box, exit codes read from each run's own marker file rather
than from a grep over its output. Measured on SCOTT-CLAUDE at
2026-09-17T22:10Z, on the worktree at `0a19bf92` plus the second fix pass's
edits. The database lane 46 tests, 46 pass, 0 fail, 0 skipped, exit 0, against
a baseline of 38 of 38, so the delta is the eight cases that fix pass added.
The session lane 85 of 85, exit 0, zero delta. The memq and grant lanes 769 of
769, exit 0, zero delta. The live install lane against this machine's own SQL
Server 28 of 28, 0 skipped, exit 0, zero delta. Nothing is red, and the
implementer's reported counts match this session's own on every lane.

The lanes ran under named contention. The machine's heavy-process claim file
carried a foreign claim for another repository whose own bound expired at
21:47Z, read twelve minutes past that from the file's modification time rather
than from the `Started:` line it carries. No test runner was on the process
list. Under the claim protocol an aged claim is proceeded past unclaimed, so
this session ran without writing a claim and left the foreign one untouched.

Round 3, adjudicated. The same three lenses at fable over the section as it now
stands, base `e81f5f8f` to the worktree. The adversarial and blind lenses
returned changes required; the security lens returned concerns with no Critical
and no Major. The full list is at
`.kit/scratch/memory-database/section3-round3-findings.md`, which records the
findings as C1 to C18.

The blind lens reported its own dispatch clean this round: the ref, the file
list and standing hunt classes only, no docs paths opened, nothing under
`.kit/` read. Round 2's briefing error is not repeated.

The security lens re-derived the credential path from the code rather than
from round 2's verdict and found it sound. Round 2's half-fix is closed: the
client tool is resolved at one literal absolute path with no environment
lookup at all. The batch now goes to the tool on standard input, so the temp
file, its inert Windows mode, the stale-file sweeper and its per-spawn
directory listing are all gone rather than relocated. The two-question grant
audit passes, the granted set being byte-identical to the base.

The design stop, and what it holds. Rounds 2 and 3 each carry at least one
owed Major that the provenance read puts at fix-introduced, and the two sit in
one mechanism: the spool drain, which is `readSpool`, `putBack` and
`drainSpool` plus the cases over them. Round 2's pair there, both created by
round 1's spool rewrite, were the malformed-only spool wedging every publish
and the rewrite racing the appender it exists to tolerate. Round 3's, created
by round 2's own fix, is that the rotation's late re-read has no case that
would fail without it: delete the re-read and the case written to cover it
still passes. That is two consecutive rounds of fix-introduced Majors in one
mechanism, which the governing skill makes a design stop rather than a fourth
fix round.

Held as one unit until the ruling lands: C3, C4, C7, C8 and C9, every owed
finding of this round sitting in that mechanism. No fix round runs on the
drain meanwhile, and the section continues on everything the drain does not
touch.

Two classes never join that unit and never count toward the trigger, and both
matter here. A Critical, of which this round has none. And a security finding
of Critical or Major weight, which is what C2 is and what round 2's B9 was, so
the grant surface's own two-round pair is not what fired this stop. That
reading was made on the rule rather than on the outcome, and it cuts both
ways: it is also why the stop fires on the drain rather than being argued
away.

Ask outstanding: the design stop's judge. The repository's live expert seat,
KIT: Expert, was sent the fixed brief on 2026-09-17 over the peer-session
channel: the plan's Goal and section 3's acceptance as the trace target, the
mechanism named, the round indices, and the capture range at
`.kit/scratch/memory-database/3/fix-round-2.diff` and `fix-round-3.diff`, with
no account of what happened inside the rounds. If it is unanswered when the
section's other work reaches the close gate, the scope-adjudicator is
dispatched then and its ruling is the one in force, with a late answer
recorded beside it.

Provenance read on this session's own surface rather than taken from a lens.
C1, the batch-wide withhold on an older record, is spec-traceable and not
fix-introduced: `skippedOlder` appears eight times in the round 2 capture and
zero times in round 3's fix delta, so the mechanism predates both fix passes.

Live dispatches, one. An `implementer-opus` holds three files for the findings
outside the held mechanism, with the drain named off-limits in its brief and
an instruction to stop and report rather than edit there. It was asked for
four things: withhold only the non-project records of a batch from the
embedding leg, since the procedure answers `older` only for a shared row and a
private record can never be the older one; give the publish a probe budget of
the client's own no lower than twice the sqlcmd floor, since the judged
channel's 400 milliseconds resolves to a one-second login clock that refuses a
healthy host silently; make the fake host's `older` rule match the procedure's,
since as written it exercises a shape the server never produces and passes
against the defect; and bring `045-usp_ListRecords.sql` to the sql-style
checklist's isolation level and comment shape.

Approval drift recorded here, six edits this session made inside the
approval-scoped fingerprint region, all deliberate and all open to the operator
to overturn. Section 3's acceptance moved from the fleet grant classifying
`db-sync` as granted to withholding it, with the ground in place. Section 3's
spool-writers sentence moved from a short-timeout database attempt to a spool
append with no database call. Section 3's probe sentence moved from the judged
channel's 400 millisecond timeout to a budget of the client's own. And the
Standing Brief Amendments block gained three entries carrying those same three
rules forward, since that block is what every later dispatch is built from and
section 4 reuses this transport.

The Goal's own sentence that the stamps "write to the database first" now reads
against the code, which spools and delivers one publish later. That sentence
was left as the operator wrote it rather than rewritten by this session: the
database is still where a stamp lands and the spool is still what catches it,
and the amendment names the wording as the operator's to reconsider.

Minors: eighteen findings across round 3, of which nine are Minors
accumulating for the close pass in the findings file, with five more frozen
inside the held mechanism. No Minor close pass has run for section 3.

Owed by this session and not delegated: its own re-run of all four lanes after
this fix pass, the host install run that puts `usp_ListRecords` on the live
shared database at 192.168.58.245, the Minor close pass, the close gate, and
Chapter 3. The host install stays held until the procedure stops changing
under review, and this round moved it again.

Routed to section 5, beside what earlier boards routed there. The embedding
link is plain HTTP and carries every record body, private project-tier rows
included; the plan already defers the accepted-or-closed sentence to section
5's security-model edit. The new store-root append channels do not call the
guard every existing memq sidecar append calls, which is a Minor here and an
export question there. And the client accepts a trust-the-certificate flag
while the plan's Approach says no client passes one.

Next action per section. Sections 1 and 2 are closed and need nothing. Section
3: await the fix pass on the unheld findings, re-read its diff, re-run all four
lanes from this session, and await the design stop's ruling on the drain. On a
refuse, restore the drain to the form the ruling names in one removal fix
round. On an accept-and-declare, re-enter the held unit into an ordinary fix
round. On an ask, the section stops at this step until the operator answers.
Then the Minor close pass, the host install, the close gate and Chapter 3.
