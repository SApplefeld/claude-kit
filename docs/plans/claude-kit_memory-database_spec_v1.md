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
- The interactive stamp and outcome writers append to the spool and make no database call. The database still receives every one of them, one publish later. A later section that reinstates a synchronous call on that path is reintroducing the latency the spool removed: a kill landing after the server committed leaves the row and spools it again, and while the stamp id's unique index means that resend inserts once rather than twice, the interactive channel still pays a process start it was never budgeted for.
- `db-sync` is withheld from the fleet grant, so the withheld list is six names and the granted list does not carry it. A section that changes either count starts from six. The verb refuses a redirected store root, and the fleet store signals redirect it, so granting it would authorize an act that cannot happen.
- A boundary budget is this client's own and is never borrowed from an interactive channel. The judged channel's 400 millisecond probe timeout is an interactive stamp's budget, and a sqlcmd spawn's clock cannot express less than one second, so a batch verb that borrowed it would refuse a healthy host whose login takes over a second and say nothing.
- A call whose server side holds a wait of its own takes a budget above that wait. The record upsert waits up to thirty seconds on the fleet publish lock, which exists so two sandboxes publishing at once queue rather than race, and a client clock shorter than that wait kills the second publisher with its own tool instead of letting it queue, so the lock serializes nothing. The client's budget is what moves, never the server's wait, since shortening the wait to fit a short clock turns queuing into failure.
- The publish carries one run deadline of this client's own and starts no boundary call past it, and the session hook's publish marker takes a staleness interval not shorter than that run budget. Each call's own clock bounds one call and bounds no run, so without the deadline a degraded host permits a run of any length, and with the marker's interval shorter than the run budget a second detached publish starts while the first is still going.
- Every spool line carries a stamp id the client generates when it writes the line, and `usp_AppendUsage` and `usp_AppendOutcomes` skip a stamp id their table already holds, enforced by a unique index on that column rather than by a lookup the client trusts. Delivery is therefore idempotent at the server, and a line sent twice inserts once. (Operator's word of 2026-09-18.)
- A publish reports through one surface. The drain's counts ride on the verb's own summary line, and every failure's own detail, carrying the cause word that names it, rides on a single failure list printed on stderr beside that line. There is no second list, no classifier and no cause vocabulary deciding which surface a sentence reaches. The publish run's error column is not a second surface either: it carries the part of that same one list the run actually failed at, and nothing else, so it is null on a healthy run that had something to say. (Operator's word of 2026-09-18, ruling the design stop this section was held on, and replacing the earlier sentence here that gave the column the whole list. The run row carries no success flag of its own, so a column filled on every chatty run would leave a host-side reader no way to find a failure at all, and a warning ahead of a real failure would push that failure past the five sentences the column takes. The column answers the exit code's question and the printed list answers the reader's.) The verb exits non-zero when something the run set out to do actually failed, which is a fact the publish holds rather than a re-reading of that list, so an automated caller still reads a loud failure. The list and the exit code answer different questions on purpose. A run that delivered every line it read is clean even where it has something to say, so a warning that the spool is near the size one call funds prints and exits zero, while a refusal, a transport failure, a host below the required schema version, a spool holding bytes no drain can read and a file that could not be cleared each print and exit non-zero. Deriving the code from the list instead would fail a run for warning about a future run, which is the cry-wolf defect from the other side. (Operator's word of 2026-09-18: if every id the drain set out to process was processed, the queue is clean, and the retained count then rides alone on the summary line with no sentence beside it.) A note list with a writer and no reader is worse than an over-reporting one, because the warning that the spool has grown too large to send in one go is exactly what it swallows. (The two-list design recorded here before was refused by the scope adjudicator at section 3's round 5 design stop, on the grounds that nothing in the Goal, the Acceptance or the Tests line asks for a cause vocabulary, a second list or an exit code keyed off the split. The operator continued the section and kept the exit code on 2026-09-18, since what the judge refused is the two-way split rather than the existence of a failure signal.)
- The local queue is a SQLite file at the store root beside the client config, opened through Node's built-in `node:sqlite` (`DatabaseSync`) in WAL mode, with the constructor's `timeout` option giving a busy wait so a second writer against a held lock waits rather than failing. No dependency is added. The store root is outside the sync allowlist by construction, as the file spool was, and the Chapter proves it with the allowlist's own probe. One table holds the queue: `id` TEXT PRIMARY KEY (the stamp id the writer already generates), `kind` TEXT (`usage` or `outcome`), `payload` TEXT (the JSON the matching append procedure takes), `created_at` TEXT. The schema replaces the malformed-line concept: a row is well formed or it does not exist. `stampRead`, the applied-stamp append inside `cmdTouch`, `cmdLog` and `hooks/memory-usage-stamp.js` each insert one row and make no host call, and their local `usage.jsonl` and `outcomes.jsonl` writes are unchanged. A failed insert prints one sentence on stderr and the interactive verb still exits zero. The drain selects the rows, sends them to `usp_AppendUsage` and `usp_AppendOutcomes`, and on full success deletes exactly those ids, so a row inserted during the send survives by construction. On any refusal or transport failure it deletes nothing, prints the server's own text and exits non-zero. The server-side unique index on the stamp id stands, so a resend after an ambiguous outcome inserts once. The doctor reports queue depth from a row count. This is a new implementation: it takes its own round 1 with its own red-first cases, and the design-stop and review-round-backstop counts restart with it, as the drain redesign of the same date did. (Operator's word of 2026-09-18, relayed by the Expert seat from the operator's Discord channel: "we're now somewhere around 36 hours into this plan/section, and we're still getting stuck on all the ways that we can't cleanly track and clear records. At this point, it feels clear to me that we're doing square peg in a round hole. Let's stop trying to force an invalid fit, scratch what we did with the file, and pivot to a sqlite database as the local queue." The table shape, the writer contract, the drain contract and the doctor reading above are the Expert's proposal on that ruling rather than the operator's own words. The Goal's "local spool" reads as "local queue"; the operator may reword. Moving `usage.jsonl` and `outcomes.jsonl` themselves into SQLite is parked for the operator to decide as its own plan.)
- Section 3's review terminus is decided in advance rather than asked. The operator's word of 2026-09-18, relayed by the Expert seat from the operator's Discord channel: "let's let it have a few rounds. This is a new approach, it's okay if it doesn't converge instantly. If we hit 3-5 rounds again though, then we drop the local queue and move on." The reading below is the Expert's rather than the operator's own words. The existing review-round backstop at the adjudication of round five is the terminus, and it produces no BLOCKED and no further ask. Where that adjudication leaves a serious defect in the queue code, section 3 ships with no local queue at all: with the host reachable a stamp goes to the host, with the host unreachable it skips the host, and the local journals are unchanged either way and remain the record, with the doctor's last-successful-publish age as the loud signal. A Major outside the queue code, tenancy and the procedures' error text among them, does not trigger the drop. At the close of round three the operator gets a one-line status on his channel, counting the rounds and naming what remains open, so he can pull the queue earlier if he chooses. That is a status and never a stop.
- Superseded by the SQLite queue ruling above, and kept for the record: the spool drain is the minimal form and nothing more: read the spool, send every line it holds to each procedure, clear exactly what was read when every send succeeded, and on any refusal or transport failure leave the file whole and report the server's own text on a surface a person reads. It carries no rotation, no aside file, no per-line put-back, no leftover pass, no batching and no lock-staleness arithmetic, and a section that reintroduces one of those is reintroducing the defect class that cost this plan its review budget. A malformed line is kept and reported, never destroyed. (Operator's word of 2026-09-18.)
- A spool line the host takes the batch for and then declines on its own, because the record its stamp points at has not reached the host yet, is counted rather than named. `usp_AppendUsage` and `usp_AppendOutcomes` answer in counts, so the client cannot learn which line was declined, and the line goes off the spool with no row on the host. The count rides on the verb's summary line, which is what makes that loss reported rather than silent. Closing it is a contract change on both sides and is its own piece of work: the two procedures return the declined stamp ids, and the drain keeps exactly those lines on the spool so a later run lands them once their record arrives. It is not a redesign of the drain, which already removes what it read on a successful call without being told anything, so identities change only which lines survive the clear. The procedures belong to section 2, which is closed, so this reopens that section or takes a section of its own, and no client code is written against the new shape until the procedures carry it. The expectation is written down here so both halves have a target rather than each waiting on the other. Expected shape, prespecified here rather than left for the later work to invent. The transport is one JSON document and not a result set. `callProcedure` wraps every call as an insert of the procedure's output into a one-column table and then selects that single `Json` column behind the `kitdb-json=` tag, at `plugins/claude-kit/scripts/memory-database.js:822-828`, and the client keeps one parsed value per tagged line at `:763-767`. A second result set cannot reach the client at all, so the change is additive on the object each procedure already returns. Beside `appended`, `rejected` and `skipped` it returns `declined`, an array of the stamp id strings it would not take, one entry per declined line, with the length of `declined` equal to `rejected`. The ids are the client's own stamp ids echoed back as the client sent them, since the client holds no other handle on a line. An absent `declined` key is the old procedure, read as today's counts-only answer, which is what lets either half of this land first without breaking the other. `counted` at `:1776-1779` already hands the whole object back, so the read costs no transport work. The client's two addresses are both in that same file. The `rejected` accumulation inside `drainSpool` at `:1423` counts what it cannot name today, and it gains the ids beside the count. `clearSpool` at `:1194` already keeps a retained set, holding the lines that arrived behind the read and the malformed pieces, and the declined ids join that set rather than forcing a rewrite. That set is the seam and it exists today, which is why identities change only which lines survive the clear rather than the drain's design. No client code is written against this shape until the procedures carry it, and where the delivered shape differs, this bullet is the address to circle back to and the difference is the later work's to record here. (Recorded 2026-09-18 on the operator's word, who named the register: this is prespecifying a contract rather than guessing at one, and its worth is in the detail it commits to.)
- Whole-suite runs are suspended for the rest of this plan, on the operator's word of 2026-09-18. A section closes on its targeted lane alone and no step runs the whole suite. The one whole-suite run this plan still owes happens at the finishing pass, before the branch merges, and whatever it turns up is triaged there as its own piece of work rather than inside the section that caused it. Red-first authoring is unchanged: a section still writes its tests, still watches them fail before the fix, and still runs the files it touched. What is dropped is the whole-suite run and nothing else, because this machine budgets one heavy process at a time and a seventeen-minute suite run blocks every other session on the box. (Operator's word of 2026-09-18.)
- The shared search asks the host for the widest answer it serves rather than for the display cap, which is a departure from section 4's own sentence saying the client calls `usp_Search` with the same limit. Every filter the block applies runs on the client after the host has already cut: a row shown lexically above is dropped, and a retired row is dropped. A cut taken at the display cap therefore left the block short of live hits the host held just under it, silently, under a note saying the shared index served the search. The value asked for is the larger of the display cap and the procedure's own maximum, which the procedure clamps again on its own side, so no caller number is trusted. The local channel ranks its whole store and caps after its own filters for the same reason.

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

`Schema/`: `mem.Sandbox` (id, name, publisher login name, created); `mem.Store` (id, sandbox id nullable and null for a shared tier, tier as `project`, `type` or `operator`, segment for the project path or type name, null for operator), unique on (sandbox id, tier, segment) with the null sandbox meaning the fleet; `mem.Record` (id, store id, name, file key, description, body, body hash, file modification time, machine from the record's `machine:` field, tags, supersedes name, author, archived flag, visibility as `private` or `shared`, last published by sandbox id, updated, deleted); `mem.Embedding` (record id, chunk index starting at zero, chunk text offset and length, `VECTOR(1024)`, model identity, dimensions, embedded at), unique on (record id, chunk index, model identity), separate from the record so a re-embed pass touches one table, with a record embedded whole holding one row at chunk zero; `mem.Usage` (record id, kind as `read` or `applied`, timestamp, sandbox id, session id nullable, stamp id), unique on the stamp id; `mem.Outcome` (store id, action key, result, summary, detail, tags, timestamp, sandbox id, stamp id), unique on the stamp id; `mem.PublishRun` (sandbox id, started, finished, counts of added, changed, removed, embedded, spool drained, error text); `mem.IndexOrphan` (store id, index line name, description, first seen, last seen by sandbox id); `mem.QueryLog` (login, procedure, sandbox id, parameters digest, row count, timestamp); `mem.SchemaVersion`. Uniqueness on (store id, file key), which for a shared tier is (tier, segment, file key) since the store carries no sandbox. Visibility defaults from the tier at insert: `private` for a project store, `shared` for the others.

`FullText/`: a catalog and one full-text index over `mem.Record.Description` and `mem.Record.Body`.

`Procedures/`, all under `mem`, every one resolving the caller through one inline function `mem.CallerSandbox()` over `ORIGINAL_LOGIN()` that returns no rows for an unmapped login: `usp_UpsertRecords` (JSON batch, typed table via `OPENJSON`, upsert on the unique key, marks deleted the file keys the batch names as removed); `usp_UpsertEmbeddings` (JSON batch of record id, vector text, model identity, dimensions); `usp_ListRecords` (model identity; one row per record the caller may see, each carrying record id, tier, segment, file key, name, archived flag, visibility and whether an embedding exists for that model identity, which is the publisher's only route to a record id, to the unembedded set and to the removed set under `DENY SELECT`); `usp_AppendUsage` (JSON batch, each element carrying the client's stamp id, inserting only the ids `mem.Usage` does not already hold); `usp_AppendOutcomes` (JSON batch, the same skip against `mem.Outcome`); `usp_Search` (query text, query vector, limit; four candidate lists fused by reciprocal rank at K 60 in the knowledge base's shape: full-text over description, full-text over body, vector distance over live records, vector distance over archived records; then, in fused-score space, an applied boost of 0.002 per distinct applied day capped at ten days, and a multiplier of 0.5 for an archived record and 0.5 for a superseded one, all four as parameters with those defaults, which re-express the local ranker's similarity-space constants at `memq.js:589-594` rather than copy them; returns record identity, tier, sandbox, visibility, description, fused score and each list's rank); `usp_Nearest` (vector, limit; the neighbours shape, live records only); `usp_PromoteRecord` (tier, segment, name, owning sandbox; curator role only); `usp_CurationUnapplied` (days); `usp_CurationSupersededLive`; `usp_CurationOrphans` (the `mem.IndexOrphan` rows section 3 records, and the shared records no sandbox has published for thirty days); `usp_Health` (schema version, record and embedding counts, last publish, oldest unembedded record, for the caller's own sandbox under a publisher login and for every sandbox under the curator). Every publisher read procedure filters to rows the caller may see before it ranks: its own sandbox's private rows plus every shared row, never a deleted row; the curator procedures run over every row. `usp_Search` and `usp_Nearest` insert one `mem.QueryLog` row per call before returning, carrying the login, the resolved sandbox, a digest of the query text and the row count, since both can return another sandbox's shared rows.

`Security/`: three roles. `mem_publisher` holds `EXECUTE` on exactly `usp_UpsertRecords`, `usp_UpsertEmbeddings`, `usp_AppendUsage`, `usp_AppendOutcomes`, `usp_AppendPublishRun`, `usp_UpsertIndexOrphans`, `usp_ListRecords`, `usp_Search`, `usp_Nearest` and `usp_Health`, which for a publisher returns its own sandbox's rows only. (Roster amended 2026-09-17, from seven procedures to ten across two amendments, both recorded as approval drift and both open to the operator to overturn. The first added the writers for `mem.PublishRun` and `mem.IndexOrphan`. Section 3 requires both tables written under an execute-only publisher login and names no procedure for either, so the original roster and section 3's requirement contradicted each other; the roster was the stale surface. Ruled by the executing session on section 2's round 1 findings. The second added `usp_ListRecords`, the reader that lets an execute-only publisher see its own inventory. Section 3 must learn each record's id to write its embeddings, learn which records carry no embedding for the current model, and learn which of its own file keys the database still holds so the walk can name the rest as removed. No delivered procedure answered any of the three, and `DENY SELECT` puts every table out of reach, so section 3 was unbuildable as specified. Ruled by a consultant at fable on section 3's first dispatch, whose grounds this session confirmed against the delivered scripts before adopting them.) `mem_curator` holds `EXECUTE` on `usp_PromoteRecord`, the three curation procedures and `usp_Health`, and no table rights, so memq's curator connection is execute-only like its publisher connection. `mem_review` holds `SELECT` on every table and executes nothing; it exists for the operator's hand review through a query tool and no kit code connects as it. Logins `kit_scott_claude`, `kit_neo_claude`, `kit_asr_claude` as users in `mem_publisher`, each mapped to its `mem.Sandbox` row; `kit_curator` in `mem_curator`; `kit_review` in `mem_review`. `DENY SELECT` on every table to `mem_publisher` and `mem_curator`, so neither connection principal reads past its procedures even if a later grant widens.

`Install-MemoryDatabase.ps1` at `plugins/claude-kit/db/`: takes the server and the database name, and either a deploy login and password or `-WindowsAuth`; creates the database when absent; applies the four directories in order through `sqlcmd -b -I` with `-N` when a login is used; is idempotent, so a second run is a no-op that still exits 0; prints one line per script applied. On the run that first creates the five logins it generates their passwords itself and writes them to a logins file whose path `-LoginsPath` names (default `~/.claude/kit-memory-db-logins.json`), created exclusively so it never overwrites one; a later run finds the logins present and leaves them. It never drops a table and never alters a column type, and it refuses to run when `mem.SchemaVersion` holds a version newer than the scripts it carries. Section 2's test runs it with `-WindowsAuth` against the executing VM's own local instance, which every sandbox carries under Windows-only authentication, into a database named with a run-scoped suffix and a logins file under the test's temp directory, dropping both at teardown, so no credential is a fixture.

Acceptance: two consecutive installer runs against the host both exit 0 and the second applies no change, read from the script's own output; a login in `mem_publisher` can execute `usp_UpsertRecords` and cannot `SELECT` from `mem.Record`, proven by a failing query in the Chapter; `usp_Search` called as the SCOTT sandbox login returns a NEO sandbox's private row never and its shared row always, proven with two seeded rows; `usp_PromoteRecord` fails for a publisher login and succeeds for the curator; a `usp_Search` call leaves one `mem.QueryLog` row, read back under the review login; the Chapter quotes one banner header and one shell-then-ALTER pair from the delivered files as the sql-style evidence.

Files in scope: new `plugins/claude-kit/db/Schema/*.sql`, `plugins/claude-kit/db/FullText/*.sql`, `plugins/claude-kit/db/Procedures/*.sql`, `plugins/claude-kit/db/Security/*.sql`, `plugins/claude-kit/db/Install-MemoryDatabase.ps1`, `plugins/claude-kit/db/README.md`; new `test/memory-database-install.test.js` running the installer against the local SQL Server instance on the executing VM, which every sandbox carries, so the gate needs no host.
Tests: at minimum, lock idempotence of the installer, the tenancy filter in both directions for `usp_Search` and `usp_Nearest`, the publisher role's denied `SELECT`, the promote procedure's role gate, and the unmapped-login case returning no rows rather than every row; a tenancy leak is the expensive failure and it is silent from the caller's side.

### 3. The publisher and the spool
Model: opus

Add `memq db-sync` and the local spool. The verb reads the client config, probes the host at a probe budget of this client's own, no lower than twice the sqlcmd spawn floor, and stands down with one line when the config is absent or the host is unreachable. When reachable it walks the store with the same tier walk and body hash `memory-index.js`'s `sweep` uses (`memory-index.js:823`, `hashOf` at `:698`), publishes every record the walk finds through `usp_UpsertRecords` in batches, the database reporting each as added, changed, unchanged or skipped, then drains the spool, then reads its own inventory once through `usp_ListRecords` for the current model identity, names as removed the file keys that reader returns for this sandbox's own project stores and the walk no longer finds, never a shared row, embeds every record the same reader reports as carrying no embedding for that model identity through the host's `/v1/embeddings` in batches of the local `EMBED_BATCH` (`memory-index.js:76`) with the local `embedText` composition (`:713`), splitting every body at paragraph boundaries into ordered chunks of 512 to 1024 tokens, never past the server's 2048-token ceiling, that each carry the record's name the way `embedText` prefixes it, writes them through `usp_UpsertEmbeddings` with their chunk index and offsets, records index lines with no record file into `mem.IndexOrphan`, and writes one `mem.PublishRun` row. It prints one summary line in the shape the sweep's counters take.

The local queue is the SQLite file the Standing Brief Amendments block's SQLite queue ruling of 2026-09-18 describes, and that ruling governs this paragraph wherever the two differ. The file spool below is deleted rather than repaired: the file, its two locks, the read, clear, put-back and retained-set code, and the tests that pin that file's behaviour all go. The rest of this paragraph is kept for the record. The spool is `~/.claude/kit-memory-db-spool.jsonl`, appended with one line per stamp or outcome the database call could not deliver, in the record shapes `usp_AppendUsage` and `usp_AppendOutcomes` take, each line carrying the stamp id the writer generated for it; a failed record upsert is never spooled, since the next walk re-derives it from the file. Writers: `stampRead` (`memq.js:7242`), the applied-stamp append inside `cmdTouch` (`memq.js:9734`, the function at `:9561`), `cmdLog`'s outcome append, and the read-stamp hook (`hooks/memory-usage-stamp.js:92`) each append to the spool and make no database call at all; the file-side write they make today is unchanged in every case, so the local `usage.jsonl` stays complete. (Amended 2026-09-17, from a short-timeout database attempt to a spool append, recorded as approval drift and open to the operator to overturn. The interactive budget never funded a process start, and a kill landing after the server committed produced duplicate rows against two insert procedures that carry no dedupe. The database still receives every stamp, one publish later, which is the same journey with the latency and the duplicate both removed. Ruled by the executing session on section 3's round 1 findings. The Goal's sentence that the stamps "write to the database first" reads against this: the database is still where a stamp lands and the spool is still what catches it, and the operator may want that sentence reworded.) The spool drain is the minimal form. It reads the spool under the store's existing exclusive-create lock, sends every line it read to each procedure, and clears exactly the lines it read when every send succeeded, keeping whatever arrived behind the read, so a line appended during the drain survives it. (Restated 2026-09-18 on the operator's word, against a delivered implementation that did not do it. That code compared the file's size before and after, then emptied the whole file or left the whole file, so an append landing behind the read cost a full resend and reported a state that was not a fault. Clearing the lines it read removes that state rather than reporting it: there is no raced outcome left to name, because every line the drain set out to deliver was delivered and every line it never read is still on the file. The client cannot go further and drop only the individually accepted lines, because `usp_AppendUsage` and `usp_AppendOutcomes` answer in counts rather than identities and never name the line they declined, which is the gap section 5 already carries.) On any refusal or transport failure it leaves the file whole and reports the server's own error text on a surface a person reads. A malformed line is kept and reported, never destroyed. It carries no rotation, no aside file, no per-line put-back, no leftover pass, no batching and no lock-staleness arithmetic. What makes leaving the file whole safe is the stamp id every spool line carries and the unique index behind the two append procedures, which make a resent line insert once. The drain runs after the record upsert leg and before the embedding leg, rather than first. (Amended 2026-09-18, recorded as approval drift and open to the operator to overturn. The append procedure resolves each stamp against the records the host holds, so a stamp naming a record the host has not yet received resolves to nothing, is counted rejected and is never written, while the drain reads that call as a success and empties the file. A first publish from a new machine loses every stamp it carries that way. Ruled by the executing session on section 3's round 3 findings, against the reviewer's own recommendation to raise it, because this section's Tests paragraph names the silent loss of a stamp between spool and database as the expensive failure and so ranks the two clauses itself. The drain does not move to the end of the run because the embedding leg is the long one and a drain behind it can be starved by a run out of budget. The cost accepted is that a run whose record upsert fails drains nothing, which delays stamps rather than losing them.) (Amended 2026-09-18 on the operator's word, replacing the rotation, the aside file, the per-line put-back, the leftover pass, the batching and the deadline-derived lock staleness, and recorded as approval drift. Three consecutive review rounds found faults only in the code the previous repair had written, every one of them inside that machinery, while the plan's own acceptance asks only that the drain empty the spool and report the count. The operator ruled the mechanism a redesign rather than a repair and moved the duplicate-protection to the server, where a unique index enforces it once for every client. This is a new implementation: it takes its own round 1 with its own red-first cases, and the design-stop and review-round-backstop counts restart with it.) The spool sits at the store root, which the sync allowlist excludes by construction; the Chapter proves it with the allowlist's own probe.

Session start spawns `memq db-sync` detached, beside the git sync's spawn in `memory-session.js:703`, under its own attempt marker `kit-memory-db-sync.attempt` at the store root under a staleness interval of its own, not shorter than the publish's own run budget, so neither spawn suppresses the other and two detached publishes cannot stack (amended 2026-09-17, from the git sync's interval, recorded as approval drift and open to the operator to overturn; the git sync's own interval is two minutes and a publish can outlast it, so back-to-back sessions stacked concurrent publishes on a machine budgeted at one heavy process), only when the client config exists, and never in a run-scoped or pinned-store session. The doctor runs it inline under `-Fix`. `db-sync` walks the store, so it joins the network-share stand-down that gates the store-walking verbs, and the pin of those gated functions at `test/memq.test.js:3781` moves from twelve names to thirteen in this section.

Acceptance: on a machine with the config, a first `memq db-sync` publishes every live and archived record across the tiers and embeds them, a second run reports zero added and zero changed, and editing one record's body then running again reports one changed and one embedded, each read from the verb's own summary line; with the host unreachable, `memq touch` still stamps the local sidecar and appends one spool line, and the next reachable `db-sync` drains it and reports the count; the fleet grant withholds `db-sync` and `test/memq-grant.test.js`'s parity case passes with it on the withheld list. (Amended 2026-09-17, from granted to withheld, recorded as approval drift and open to the operator to overturn. The grant fires only under the fleet store signals, and under exactly those signals the verb's own refusal of a redirected store root stands it down before it reads a record, so the grant authorized nothing. Withholding loses no capability and removes a line a later permission audit would have to reason about. Ruled by the executing session on section 3's round 2 findings, and the withheld list therefore grows from five names to six here, which section 5's own counts start from.)

Files in scope: `plugins/claude-kit/scripts/memq.js` (dispatch table at `:17386-17446`, usage text at `:5319-5349`, `stampRead`, `cmdTouch`, `cmdLog`, a new `db-sync` command and a new database client module), new `plugins/claude-kit/scripts/memory-database.js` (the sqlcmd spawn, the JSON payload file, the embedding client over `kit-endpoint-lib.js`'s request shape, the spool), `plugins/claude-kit/hooks/memory-usage-stamp.js`, `plugins/claude-kit/hooks/memory-session.js` (the detached spawn only), `plugins/claude-kit/hooks/memq-grant.js:295-296`, `test/memq-grant.test.js`, new `test/memory-database.test.js`, `test/memory-session.test.js`, `test/memq.test.js` (the gated-verbs pin only). Added by the section 3 ruling recorded under Standing Brief Amendments: new `plugins/claude-kit/db/Procedures/045-usp_ListRecords.sql`, `plugins/claude-kit/db/Security/010-Roles.sql` (the grant and the matching curator deny), and `test/memory-database-install.test.js` (the roster pin and the reader's own subtests). Added by the drain redesign of 2026-09-18: `plugins/claude-kit/db/Schema/080-Usage.sql` and `090-Outcome.sql` (the stamp id column and its unique index), `plugins/claude-kit/db/Procedures/060-usp_AppendUsage.sql` and `070-usp_AppendOutcomes.sql` (the skip against an id already held). Section 2 stays closed; the installer is re-runnable and applies a changed script, so the host takes the new procedure and the changed ones on section 3's own install run. The installer never alters a column type and the two stamp id columns are new, so they are added rather than altered, and a table already holding rows takes the column nullable with the unique index filtered to the non-null rows. Added by the round 4 ruling on the schema version marker: `plugins/claude-kit/db/Schema/020-SchemaVersion.sql` (which creates the table and no longer writes the row), new `plugins/claude-kit/db/Version/010-RecordSchemaVersion.sql` (which writes it, in a fifth directory the installer applies last), `plugins/claude-kit/db/Install-MemoryDatabase.ps1` (the directory list and the version constant), and `plugins/claude-kit/db/README.md`, whose sentence naming the directory order the change made false. Folded on the round 3 review of the drain redesign: `plugins/claude-kit/hooks/kit-compact-lib.js`, which owns the elision and sanitizing passes this client's host-bound text takes. The client and memq had each spelled the four-pass render separately, and that file is the shared output channel both already bind, so the render moves there as one exported helper taking each caller's own cap. Folded on the whole-gate reading taken after that round: `test/hook-canary.test.js` and `test/size-budget.json`. Both carry collateral reds this plan caused in lanes no targeted lane of this section reads. The canary builds its fixture cache by naming memq's siblings one at a time, and memq now binds the database client at load, so the cache's memq cannot load and twenty-nine probe cases fail; the repair makes that copy structural rather than enumerated. The ratchet reds on the three new test files this plan added with no cap recorded and on three files it grew past their caps, which is the budget edit this plan owes. Set by the SQLite queue ruling of 2026-09-18: the queue lives in `plugins/claude-kit/scripts/memory-database.js` rather than a new module, since that file already owns the writer and drain seams, and the file spool's own tests in `test/memory-database.test.js` are deleted with the code they pin.
Tests: at minimum, lock the stand-down when the config is absent (no spawn, no network, no spool), the spool append on a failed database call with the local stamp still written, the drain's clear-only-on-full-success, that the file is left whole and the server's own text reported on a refusal and on a transport failure, that a line appended during a drain survives it, that a malformed line is kept and reported, that a resent line inserts once against the unique index, that every walked record is sent on every run with the counts read from the server's own summary, a client that skipped unchanged records being the defect since it starves the orphan rule's stamp, and the removed-file marking; the silent loss of a stamp between spool and database is the expensive failure. The sqlcmd spawn and the embedding call are seams the tests replace with fakes; one live case runs against the local instance where section 2's installer has been applied to it.

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

### Interim board 9 - 2026-09-17

Section 3 round 4 is adjudicated and the design stop is ruled. The stop is
lifted: the held unit re-enters an ordinary fix round and the drain stands.

Stage. Sections 1 and 2 stay closed. Section 3 is at step 4 of its loop, with
round 4 adjudicated and a fix round dispatched on the findings the stop does not
freeze. The code is committed at `0a19bf92` with two fix passes in the tree
unstaged. PR 59 is open, still draft, auto-merge never armed.

Gate baseline, all four lanes re-run by this session after the round 3 fix pass,
each exit code read from that run’s own marker file rather than from a grep over
its output. Measured on SCOTT-CLAUDE at 2026-09-17T22:45Z, on the worktree at
`0a19bf92` plus both fix passes, under this session’s own heavy-process claim,
written over an empty claims directory and deleted at the end. The database lane
46 tests, 46 pass, 0 fail, 0 skipped, exit 0, zero delta against its own 46 of 46
baseline, the round 3 fix pass having rewritten one case in place rather than
adding any. The session lane 85 of 85, exit 0, zero delta. The memq and grant
lanes 769 of 769, exit 0, zero delta. The live install lane 28 of 28, 0 skipped,
exit 0, zero delta. Nothing is red.

The round 3 fix pass, verified rather than accepted. Its delta was read in full by
this session against the round 3 capture, and the three files it touched were
byte-scanned for the NUL bytes its own report named repairing: zero in all three.
It closed C1 by withholding only shared records from the embedding leg, since the
procedure reaches the `older` disposition only for a row whose store carries no
sandbox; C6 by giving the probe a budget of this client’s own at twice the sqlcmd
floor; and C10 and C11 in the cases. It declined C13, the read procedure’s
isolation level, with a reason this session confirmed on its own surface: every
procedure in the tree that writes takes `READ COMMITTED`, the three QueryLog
writers among them, and only the four pure reads take `READ UNCOMMITTED`, so the
file already follows the checklist’s own write rule.

Round 4, adjudicated. One lens, the adversarial reviewer at opus and high effort
through the Workflow route, which is the decayed round’s one dispatch at the
writer tier. It returned no Critical, five Majors and four Minors. Every Major was
checked against the code by this session before it became a plan mutation.

Two of the five sat in the frozen mechanism and were held with the unit until the
ruling below lifted the stop: the drain
reads only whether its call succeeded and discards the procedure’s own answer, so
a stamp the server rejected is counted as delivered and deleted from the spool;
and a drain refusal aborts the whole publish under the unreachable label, one line
above the branch that already treats a drain problem as a note. The second is the
same wedge class as the round 3 finding already held.

Three are spec-traceable and went to a fix round. The record upsert call’s clock
is five seconds by default against a server that waits thirty on the fleet publish
lock, so two sandboxes publishing at once never queue as that lock intends and the
second is killed by its own tool. The publish carries no run deadline at all while
the session hook re-arms its detached spawn every two minutes, so a degraded host
lets two publishes stack on a box budgeted at one heavy process. And the grant
screen’s closure assertion cannot reach the client module memq now loads, because
the map it iterates names only the four hooks files, so it stays green over a
member it structurally cannot reach while a comment above it asserts the opposite.

Provenance read on this session’s own surface. The closure test’s comment appears
in both the round 2 and round 3 captures, so it predates every fix round and that
finding is spec-traceable rather than fix-introduced. No new pair opened, and the
design stop’s trigger did not fire again.

Rulings adopted this boundary, both recorded above as Standing Brief Amendments
and both approval drift open to the operator to overturn. The client budget is
what moves against the server’s lock wait, never the lock wait itself, because
shortening the wait to fit a short clock turns queuing into failure, which is the
opposite of what section 2 built the lock for. And the publish gains one run
deadline with the publish marker’s staleness interval tied to it, which departs
from section 3’s own sentence putting that marker on the git sync’s interval.

The design stop, ruled. The `scope-adjudicator` was dispatched on the fixed brief:
the plan’s what, the mechanism, the round indices and the capture range, with no
account of what happened inside the rounds. It was dispatched ahead of its window
rather than at the close gate, because the live expert seat had been idle and
silent on the same ask since it was sent and round 5 is the last round before the
review round backstop reaches the operator. A late answer from that seat is
recorded beside this ruling.

The bucket is accept-and-declare. Its ground is that the mechanism the rounds have
been building is the one the Goal and section 3’s acceptance already ask for, in
the form they ask for it: a local spool file, emptied by `db-sync` once the host
answers, with the drained count on the verb’s own summary line. The parts the fix
rounds added are the how of draining rather than a departure from it, and the
bound is the spool file and its aside sibling. This session checked those grounds
on its own surface: both quoted sentences exist as quoted, and the drain as built
adds no mechanism the plan’s text does not already carry. An accept-and-declare on
a design stop moves no acceptance bullet, so it earns no Standing Brief Amendment
and is recorded here and on the Chapter instead.

The judge also noted, outside the mechanism it ruled on, that the interactive
stamp path spools unconditionally where the Goal says the stamps write to the
database first. That is the finding this plan already amended at round 3, and the
amendment already names the Goal’s wording as the operator’s to reconsider, so a
second seat reaching it independently changes nothing and is worth recording.

Live dispatches, one. An `implementer-opus` holds four files for the three
spec-traceable Majors and one folded comment repair, with the drain named
off-limits in its brief, since it was dispatched while the stop still stood. The
drain unit therefore takes a second fix pass after that one returns rather than a
widened brief mid-flight, which would invalidate an agent faithfully executing the
brief it was given.

Round count, against the backstop. Four rounds are adjudicated. The fix round now
in flight owes a fifth under the fix delta bar, since its delta changes boundary
call budgets. If that round’s adjudication still leaves an owed finding, the
section stops on the BLOCKED path with the phase analysis, which is the operator
backstop working rather than a fault.

Minors. The close pass list is kept at
`.kit/scratch/memory-database/minors-section-3.md`, carrying nine entries, three of
them frozen inside the held mechanism. Two round 4 Minors went elsewhere: the
architecture doc’s twelve-verb paragraph is routed to section 4, whose files in
scope already name that document, and the QueryLog table header naming two writers
where there are now three is folded into section 3 under the re-open rule, which
puts that file on this section’s files in scope.

Next action per section. Sections 1 and 2 are closed and need nothing. Section 3:
read the fix pass’s delta, then dispatch the second fix pass on the drain unit the
ruling released, which is round 3’s C3, C4, C7, C8 and C9 plus round 4’s two drain
Majors. Then re-run all four lanes from this session and take round 5 over both
deltas together. Then the Minor close pass, the host install of `usp_ListRecords`,
the close gate and Chapter 3. Then sections 4 and 5, then finishing-work.

### Interim board 10 - 2026-09-17

Section 3 has both of its owed fix deltas moving. The first landed and was
verified here; the second is dispatched on the unit the design stop released.

Stage. Sections 1 and 2 stay closed. Section 3 is at step 4 of its loop with
four rounds adjudicated, the design stop lifted, and the fix work split across
two passes. The code is committed at `0a19bf92` with both fix passes unstaged in
the tree, the second still being written. The plan doc is committed through
`914c156e`. PR 59 is open, still draft, auto-merge never armed.

The round 4 fix pass, verified rather than accepted. Its delta was isolated on
this session’s own surface by capturing the section as it now stands and diffing
that against the round 4 capture over the same path set, which gives the pass’s
own 542 lines of change rather than its report’s account of them. It was read in
full. It closed the three spec-traceable round 4 Majors: the record upsert now
takes a budget derived from the server’s own thirty-second lock wait, so its
query clock is thirty-two seconds and the second publisher queues instead of
being killed by its own tool; the publish carries one run deadline of fifteen
minutes with every boundary call gated on it and clamped to what remains; and
the session hook’s publish marker moved onto an interval of its own at sixteen
minutes, leaving the git sync’s two minutes untouched. It also repaired the
grant closure assertion so it reaches the client module memq now loads, which is
the finding whose provenance predated every fix round.

Two things this session checked rather than took on the report’s word. The
removal leg can never run after a partial record upsert: a budget refusal inside
the batch loop returns from `publish` at once, so a run that published some
batches and not others never reaches the call that marks rows removed. And the
embedding leg’s counts are merged into the summary before the budget refusal
returns, so a run stopped mid-embed still reports what it embedded.

Decisions this session took on that pass’s reported concerns, none of them a
plan mutation. The clamp to the remaining budget stays, because Standing Brief
Amendment 6 states it in its own words and the declared overshoot bound depends
on it. The publish-run row staying behind the deadline gate stays too: a run
that spent its budget is not a successful publish, the verb’s own summary line
and its stderr both say the budget was spent, and exempting one call from the
rule would be the amendment’s literal text read against itself. The fifteen and
sixteen minute figures are the implementer’s and are recorded here as a route (b)
assumption: measured embedding latency on this host is 19 ms for a long text, so
a store of this size publishes inside the budget many times over.

Live dispatches, one. An `implementer-opus` holds `memory-database.js` and
`test/memory-database.test.js` for the drain unit the ruling released. It was
asked for seven things across the spool drain: read the append procedures’ own
`{appended, rejected}` answer so a stamp the server refused is counted rather
than deleted as delivered; stop standing the whole publish down on a drain
refusal, since the reachability probe one step earlier has already proved the
host answers; send each procedure’s lines in batches so a spool grown large
cannot fail every future publish; write a case that actually fails without the
rotation’s late re-read, proven red-first; reconcile the two comments that state
opposite facts about a torn trailing line; and fold the newline repair that is
spelled twice into one helper.

Two rulings ride in that brief as instructions rather than as open questions,
both made by this session on the code. A drain refusal never stands the publish
down, because a failure after a successful health probe is evidence about the
spool and not about the host. And a batch the server partly refused is still
deleted, with the refused count carried out to the summary line, because the
procedures answer with counts and not identities, the local usage journal is the
record and is written on every one of those paths independently, and putting a
refused batch back would re-send a permanently poisonous line on every run
forever, which is the wedge class rounds 2 and 3 already fought twice.

Gate baseline. The last measurement this session made itself is board 9’s, on
SCOTT-CLAUDE at 2026-09-17T22:45Z at `0a19bf92` plus the round 3 fix pass: the
database lane 46 of 46, the session lane 85 of 85, the memq and grant lanes 769
of 769, the live install lane 28 of 28, every exit code 0 read from that run’s
own marker file. The round 4 fix pass reports 49, 86, 769 and 28 on the same
four lanes after its own edits, which is recorded here as reported rather than
confirmed: this session has not re-measured since, and deliberately has not,
because a suite must never run beside a live dispatch on this box and one is in
flight. All four lanes are re-run here once the drain pass returns.

Round count, against the backstop. Four rounds are adjudicated. Both fix deltas
owe a fifth under the fix delta bar, the first because it changes boundary call
budgets and the second because it changes what the drain deletes. Round 5 runs
over the two deltas together, and its adjudication is the backstop point: if it
still leaves an owed finding, the section stops on the BLOCKED path with the
phase analysis attached rather than opening a sixth round.

Minors. The close pass list is at
`.kit/scratch/memory-database/minors-section-3.md`, carrying nine entries. The
three that were frozen inside the drain are in the dispatched brief and leave
that list as they are fixed.

Next action per section. Sections 1 and 2 are closed and need nothing. Section
3: await the drain fix pass, read its delta on this session’s own surface as the
last one was read, then re-run all four lanes from this session on a box polled
clear, then take round 5 over both fix deltas together. Then the Minor close
pass, the host install of `usp_ListRecords` on 192.168.58.245, the close gate and
Chapter 3. Then sections 4 and 5, then finishing-work.

### Interim board 11 - 2026-09-17

Section 3 hit the review-round backstop. Round 5 is adjudicated and left three
confirmed Majors, so the section stops here and the stop is declared to the
operator. This entry is the record a resuming session reads first.

Stage. Sections 1 and 2 stay closed. Section 3 is at step 4, stopped at the
backstop with round 6 owed and unrun. The code is committed at `0a19bf92` with
both fix passes unstaged in the tree. PR 59 is open, still draft, auto-merge
never armed.

The gate, measured by this session rather than reported. On SCOTT-CLAUDE, exit
codes read from each run’s own marker file: the database lane 53 of 53, the
session lane 86 of 86, the memq and grant lanes 769 of 769, the live install lane
28 of 28, all exit 0. Against board 9’s baseline of 46, 85, 769 and 28 the delta
is +7 and +1, which decomposes exactly into round 4’s three and one and the drain
pass’s four. Both implementers’ reported counts are now confirmed. The run was
taken under a live foreign heavy-process claim (`supervisor-dev`, repo
`agent_persona`, 89 minutes into a declared two hour window) with no foreign test
runner or build visible in the process poll. The claim was named and not touched,
per the clause; weigh it against timings rather than against pass or fail.

Round 5, three fresh-context seats. Adversarial CHANGES_REQUIRED, blind
CHANGES_REQUIRED, security CONCERNS. The full adjudication with file, line,
provenance and failing input for each finding is at
`.kit/scratch/memory-database/3/round5-verdict.md`, and the reviewed delta at
`.kit/scratch/memory-database/3/round5-delta.diff`.

The three owed Majors, each confirmed by this session against the code rather
than taken from a seat. First, the drain wedges permanently on one line the
server always refuses: `send` breaks out of its batch loop on the first refusal
and skips the second procedure, and the put-back returns the refused batch to the
head of its type, so that batch is batch 1 on every future run and nothing ever
drains again. This is fix-introduced, by the pass whose stated purpose was to end
that wedge, and the module’s own comment asserts the opposite behaviour. Second,
malformed lines are destroyed by the rotation and then reported as zero on the
refused-drain branch, while the two sibling returns report them correctly; all
three seats found this independently, the blind one from the diff alone. Third,
the spool lock’s stale threshold can outlive the publish re-arm interval: at the
legal maximum configured timeout it is 1204000 ms against a re-arm at 960000 ms,
so a publisher killed mid-drain leaves a lock no live publisher could hold.

A correction this session owes on its own earlier claim. It had recorded that
nothing pins the re-arm interval to the run budget. That was wrong: a pin exists
at `test/memory-session.test.js:3321` and reads both constants from their own
sources. The real defect is narrower and worse, that the pin guards the wrong
quantity, comparing against the run budget rather than against the largest value
`drainStaleMs` can return.

The consult, run before the declaration as the decision rule requires. It ruled
that the stop is the right instrument and that the recurrence is a real pattern
rather than this session’s fatigue. Its diagnosis, adopted here: the drain has no
rule for retiring a line the server will never accept, it cannot tell such a line
from a host that merely blinked, and rounds 2 and 3, round 4 and round 5 each
re-found that one absence somewhere new. So the operator is asked one design
question rather than handed three bugs. It also ruled that a sixth round is not
this session’s to open, since the fix for the first Major changes what the drain
deletes and puts back, which board 10 already ruled owes a round of its own.

A check this session ran that raises the recommendation’s confidence. The only
two production writers of a usage stamp pass the literals `read` and `applied`,
which are exactly the two values the procedure accepts, and the timestamp is
always a fresh ISO string. Current kit code therefore cannot produce a line the
procedure throws over at all, so retiring a refused batch cannot silently drop a
legitimate stamp. Only version skew or a hand-edited spool can create one.

A fourth Major, outside section 3 and fixed here rather than deferred. Six
untracked `.agentic-*` files, about 102 KB including two 50 KB persona files
holding operator preferences, machine facts and session ids, sat inside
`plugins/claude-kit/` where both build scripts collect every file including
dotfiles. Nothing ignored them, so the next build of either kind would have
packaged them into the distributed artifact. Keeping them unstaged, which was the
standing instruction, never protected the artifact. The three names are now in
`.gitignore` and in both build scripts’ exclusion lists. Verified on a real build:
zero such entries in the rebuilt zip, against a control showing the same predicate
finding all six in the source tree, and 16 SQL files from the same directory still
packaged. The files themselves were not deleted, being another tool’s live state.

A collateral red this session found and deliberately did not fix. The size ratchet
lane is red and was already red at `0a19bf92`: `test/size-budget.json` carries no
cap for any of section 3’s three new test files, and `test/memory-session.test.js`
now stands at 3451 lines against a cap of 3207. No lane section 3 runs reads the
ratchet, which is why it went unseen. It is left because adding caps is a budget
edit the test itself marks as deliberate, and round 6 moves those line counts
again. Section 3 owes it before its close gate.

Minors. The close pass list at `.kit/scratch/memory-database/minors-section-3.md`
now carries ten entries. Round 5 added several more, which are in the verdict file
rather than folded into that list, so that round 6 and the close pass read them
from one place.

Next action per section. Sections 1 and 2 are closed and need nothing. Section 3
is stopped at the backstop and waits on one operator answer: what retires a batch
the server itself refuses, once the health probe has already proved the host
answers. With that answered, round 6 is bounded: the retirement rule written into
the comment first, a red-first case for a poison batch with healthy work behind
it, the malformed count returned on the refused branch, the stale threshold
clamped and its pin re-pointed at the right quantity, then the Minor close pass,
the size budget, the host install of `usp_ListRecords` on 192.168.58.245, the
close gate and Chapter 3. Then sections 4 and 5, then finishing-work.

### Interim board 12 - 2026-09-17

The backstop stop is answered and lifted. This entry records the operator’s
ruling, which is the durable record of it, and the round it released.

Decided 2026-09-17 by the operator, on the relay channel, answering the backstop
question of what retires a batch the procedure itself refuses. The answer is that
nothing does. A refused batch is a contract defect between the client and the
procedure rather than an operational state, so the drain gets no retirement rule
at all. A refused batch is put back and never deleted. The refusal costs that one
procedure’s drain for this run only; the other procedure and every other batch
still drain. The server’s own error text is reported loudly on a surface a person
reads, and it opens a defect. The spool grows until the contract is repaired, and
that growth is the signal.

The rationale the operator gave, recorded so it is not re-litigated. The procedure
throws only for an unmapped login, a non-array payload, or a stamp missing its
timestamp or carrying a kind other than read or applied. Every writer today emits
only read and applied with a fresh timestamp, so no such line can exist without a
bug or version skew. A stamp naming a record the caller cannot see is already
counted rather than thrown, by design.

This overrides the session’s own recommendation, which was to delete a refused
batch and report the count, on the ground that the local journal is the record.
The operator’s ground is better: the session was treating a contract defect as an
operational state, and deleting the evidence of a defect removes the only signal
that the contract is broken.

One clause of the ruling is ambiguous and the session declared its reading rather
than asking again. "Costs that one procedure’s drain for this run only" is read as
bounding the cost to this run rather than abandoning that procedure’s remaining
batches: only the refused batch is skipped and put back, the batches behind it in
the same procedure are still sent, and the other procedure is still sent. The
alternative reading leaves the refused batch first in line on every future run and
so never drains that procedure again, which is the permanent block the ruling
exists to remove. The reading was stated back to the operator on the same channel
so a correction is cheap, and it is written into the round 6 brief.

The consequence that reading carries, which is the round’s sharp edge. Delivery
stops being a prefix of each type’s lines once a middle batch can be refused while
later ones land, so `putBack` can no longer reconstruct what to keep from a single
per-type count. It has to track which lines were actually delivered. Getting that
wrong sends a record twice or drops one, which is the failure the spool exists to
prevent.

Round 6 is dispatched on that ruling, to an `implementer-opus`, with the brief at
`.kit/scratch/memory-database/3/round6-brief.md`. Five items: un-wedge the drain
and never delete a refused batch, with the non-prefix put-back and its no-duplicate
pin; report the malformed count on the refused branch; stop swallowing the put-back
failure on that same branch; clamp the stale-lock threshold and re-point its pin at
the quantity that actually has to be cleared; and rewrite the comments that
contradict the code. The `.sql` files, the procedures’ return shapes, a quarantine
file and `test/size-budget.json` are all named out of scope.

Gate baseline for that round, measured by this session on this worktree state, all
exit codes 0 read from each run’s own marker file: 53, 86, 769 and 28.

Still owed after round 6, unchanged. The size budget, which is red at `0a19bf92`
and carries no cap for section 3’s three new test files. The Minor close pass at
`.kit/scratch/memory-database/minors-section-3.md`, ten entries, plus the Minors
round 5 added in `.kit/scratch/memory-database/3/round5-verdict.md`. The host
install of `usp_ListRecords` on 192.168.58.245. Then the close gate and Chapter 3.

Next action per section. Sections 1 and 2 are closed and need nothing. Section 3:
read round 6’s delta on this session’s own surface against a verified pre-round
base, re-run all four lanes from this session on a box polled clear, then review
round 6. Then the size budget, the Minor close pass, the host install, the close
gate and Chapter 3. Then sections 4 and 5, then finishing-work.

### Interim board 13 - 2026-09-17

Round 6 landed, was reviewed, and the section is held at a second design stop on
the spool drain. The operator ruling that released the first stop is built and
green; what stops the section now is a different defect in the same mechanism.

Stage. Sections 1 and 2 stay closed. Section 3 is at step 4. Round 6’s fix pass
is built, verified here and committed: `6528be23` carries the whole section 3
client, 9 files, 1882 insertions, pushed. PR 59 is open, still draft, auto-merge
never armed. The drain mechanism is frozen and no fix round runs on it until the
ruling lands.

The gate, measured by this session on this worktree state, every exit code read
from that run’s own marker file: the database lane 56 of 56, the session lane 86
of 86, the memq and grant lanes 769 of 769, the live install lane 28 of 28, all
exit 0. Against board 12’s baseline of 53, 86, 769 and 28 the delta is +3, which
is exactly the three cases round 6 added, and no case moved from pass to fail.
The run was taken under contention this session named rather than measured away:
this session wrote the machine’s heavy-process claim at 01:45:53Z, and a foreign
session (`supervisor-dev`, repo `agent_persona`) replaced it at 01:48:34Z with a
four-process run that deliberately loads the box. So the box held two heavy runs
under one claim naming only the second. Pass and fail are unaffected; timings are
not comparable. The foreign claim was left untouched.

Round 6’s own delta was read here against a base this session rebuilt and proved
rather than accepted: HEAD plus the pre-round capture, checked by a three-state
marker probe, at `.kit/scratch/memory-database/3/round6-own-delta.diff`, 538
lines over three files. A first attempt at that rebuild silently applied nothing
and returned success, and was caught by the probe rather than by the exit code.

Round 6’s review, three fresh-context lenses at fable: adversarial
CHANGES_REQUIRED, blind CHANGES_REQUIRED, security CLEAR. Both code lenses found
the same Major independently.

The owed Majors, each confirmed by this session against the code rather than
taken from a lens. First, the leftover fold-back destroys undelivered lines: a
bare catch swallows a failed write-back, the unlink never runs, and the next
statement renames the live file over an aside file that still holds those lines
(`memory-database.js:1081-1092`). That is the silent loss the spool exists to
prevent. Second, the send loop cannot tell a host that went away from a batch the
procedure refuses: `runBatch` returns the same shape for a spawn failure, a spent
budget and a server refusal (`:566`, `:591`, `:595`, `:602`), so a transient
outage is reported as a contract defect and the drain spends its remaining budget
attempting every later batch. Third, outside the held mechanism, the embedding
store call is budgeted at the configured timeout while the procedure it calls
takes the same thirty-second fleet publish lock the record upsert waits on
(`050-usp_UpsertEmbeddings.sql:156` against `040-usp_UpsertRecords.sql:212`;
the client at `:1783` against `:1546`). That violates the standing amendment on
a call whose server side holds a wait of its own. Fourth, the drain’s new
deadline branch ships with no test.

The second design stop, and what it holds. The provenance was read from the
captures rather than from recollection: the rotation to an aside file dates from
round 3, while the swallowing fold-back that makes it lossy was written by the
drain fix pass (`.kit/scratch/memory-database/3/drain-own-delta.txt:201`), and
the send loop’s conflation sits in lines round 6 itself wrote. Round 5 carried
owed fix-introduced Majors in this same mechanism. That is two consecutive rounds
of fix-introduced Majors in one mechanism, which the governing skill makes a
design stop rather than a third fix round. The count restarted at round 4’s
ruling, so this pair opened after that ruling rather than continuing it.

Ask outstanding: the design stop’s judge. The repository’s live expert seat,
`KIT: Expert`, was sent the fixed brief on 2026-09-17 over the peer-session
channel: the plan’s Goal and section 3’s acceptance as the trace target, the
mechanism named, the round indices and the capture range, and no account of what
happened inside the rounds. The brief is at
`.kit/scratch/memory-database/3/design-stop-2-brief.md`. The window runs until
the section’s other work reaches the close gate; if no answer has arrived by
then, the `scope-adjudicator` is dispatched and its ruling is the one in force,
with a late answer recorded beside it. That seat was asked twice before in this
plan and answered neither time.

Live dispatch: an `implementer-opus` on the embedding budget Major alone, with
the whole drain mechanism named out of scope and frozen, and with the foreign
heavy-process claim named so it spawns one lane and no more.

The review-round backstop’s ladder. Its count restarted at the operator’s answer
of 2026-09-17, which is a separate count from the design stop’s and does not
move with it. That continue bought the section three further rounds, and round
6’s review is the first of them, so the backstop does not fire here. From the
third of those rounds onward an adjudication that still leaves the terminal
condition unmet declares again.

Minors. The close pass list at `.kit/scratch/memory-database/minors-section-3.md`
now carries this round’s eleven, five of them frozen inside the held mechanism
and marked as such. Round 5’s intake entry is closed there: it was upgraded to a
Major and fixed in round 6.

Next action per section. Sections 1 and 2 are closed and need nothing. Section 3:
await the embedding fix, read its delta here against a verified base, then either
the expert seat’s ruling or the `scope-adjudicator` dispatched at the close gate,
then restore the drain to the form a refuse names or re-enter the held Majors
into a fix round. Then the size budget, the Minor close pass, the host install of
`usp_ListRecords` on 192.168.58.245, the close gate and Chapter 3. Then sections
4 and 5, then finishing-work.

### Interim board 14 - 2026-09-18

The second design stop is ruled and lifted. The held drain unit is back in an
ordinary fix round, and the one Major outside that mechanism is fixed, verified
here and pushed.

Stage. Sections 1 and 2 stay closed. Section 3 is at step 4 with the design stop
lifted. The code is committed and pushed through `472d5f0a`; the tree carries no
section 3 work of its own beyond the fix round now in flight. PR 59 is open,
still draft, auto-merge never armed, re-read after each of this window’s two
pushes.

The embedding budget Major, closed. The call that stores a pack’s vectors was
budgeted at the configured timeout while the procedure it calls takes the same
thirty-second fleet publish lock the record upsert waits on, so a second
publisher was killed by its own client several times over before the server
would have admitted it, and the expensive vector work was thrown away and redone
on the next run. It now derives its budget from the server’s own wait, as the
sibling call already did. The delta was read here against a base that needed no
reconstruction: HEAD carried round 6’s committed client and the worktree held
only these two files, so `git diff HEAD` over them is the fix’s own delta. The
existing pin was widened to cover both lock-taking calls rather than duplicated,
and it asserts each call is actually made in the run, so it cannot go quiet by
filtering on a call that never happens. Its withheld control speaks: the
inventory read made by the same run still carries the configured timeout, whose
clock is under the server’s wait, which is the value the defect had.

The gate for that fix, measured here, exit code read from the run’s own marker
file: the database lane 56 tests, 56 pass, 0 fail, 0 skipped, exit 0, on
SCOTT-CLAUDE at 2026-09-18T02:20Z on the worktree at `2ef589a3` plus the fix.
Against board 13’s 56 of 56 on the same lane the delta is zero, the case having
been widened in place rather than added. The box carried one foreign claim
(`supervisor-dev`, repo `agent_persona`) which was ten seconds past its own
declared 1800 second bound when read from the file’s modification time, with no
`node --test` runner on the process list. Under the claim protocol an aged claim
is proceeded past unclaimed, so this session ran without writing a claim and left
the foreign one untouched.

The second design stop, ruled. The bucket is accept-and-declare, from the
`scope-adjudicator` at fable on the fixed brief at
`.kit/scratch/memory-database/3/design-stop-2-brief.md`. Its ground is that the
mechanism the fix rounds have been building is the one the Goal and section 3’s
acceptance already ask for: the Goal’s "a local spool that drains when the host
returns" and the acceptance’s "the next reachable `db-sync` drains it and reports
the count". The rotation to an aside file, the batching, the place-set put-back,
the leftover fold-back and the lock staleness ceiling are the how of that one
drain rather than a second mechanism, and the bound it stays inside is that the
spool holds only the stamps and outcomes the Goal names and empties only into the
two append procedures, touching no markdown tier, no git sync, no local index and
no record body.

This session checked those grounds on its own surface rather than adopting them
on the seat’s word. Both quoted sentences exist in this document verbatim, and a
control sentence this session invented returns zero against the same predicate,
so the check discriminates rather than matching whatever it is handed. The
declared work adds no mechanism the trace target does not already carry, which is
the reading this session had already made independently at board 9’s ruling on
the same mechanism.

The adjudicator was dispatched ahead of its window, and the reason is recorded
because it is a judgment rather than the rule. The window runs until the
section’s other work reaches the close gate. The repository’s expert seat, `KIT:
Expert`, holds the same fixed brief and was live and idle on the roster at the
moment of dispatch. An idle seat does not answer a message it already holds, and
that seat has now been asked three times across this plan and answered none, so
waiting out the window bought nothing. A late answer is recorded beside this
ruling and does not displace it.

An accept-and-declare on a design stop moves no acceptance bullet, so it earns no
Standing Brief Amendment and is recorded here and on the Chapter. The design
stop’s count of consecutive fix-introduced rounds restarts at this ruling.

Live dispatches, one. An `implementer-opus` holds `memory-database.js` and
`test/memory-database.test.js` for the released unit. It was asked for three owed
findings and seven folded comment repairs. First, the leftover fold-back destroys
undelivered lines: a bare catch written for the missing-file case also swallows a
failed write-back, the unlink then never runs, and the next statement renames the
live file over an aside that still holds those lines. Second, the send loop cannot
tell a host that went away from a batch the procedure refuses, because `runBatch`
returns one failure shape from five sites, which matters because the operator’s
ruling makes a refusal open a defect, so a blinking host would open defects that
are not real. Third, the drain’s deadline branch ships with no test.

One constraint rides in that brief as an instruction rather than an open
question, because the obvious discriminator is wrong. A non-zero sqlcmd exit does
not by itself mean the server refused the batch: a closed port, a login failure, a
certificate refusal and a kill on the client’s own clock all exit non-zero too. So
the discrimination must be structural rather than a match on human-readable prose,
and where a cause is genuinely indistinguishable the conservative reading is an
outage, since over-reporting a contract defect is the failure the finding names.

Both Majors were re-confirmed at the code this window rather than carried from a
lens or from an earlier context: the fold-back at `memory-database.js:1085-1096`,
and `runBatch`’s five failure returns at `:562`, `:570`, `:595`, `:599` and
`:605`.

The size budget, measured and deliberately deferred. The ratchet lane reports
fail 1 with six items, read from the run’s own reporter rather than from the
background wrapper, which reported exit 0 for the wrapper while the run inside it
failed. Three files carry no cap at all (`test/memory-database-host.test.js`,
`test/memory-database-install.test.js`, `test/memory-database.test.js`) and three
are over cap (`test/memory-session.test.js` 3460 against 3207,
`test/memq-grant.test.js` 1430 against 1339, `test/memq.test.js` 30417 against
30412). All six predate this window. The edit waits until the drain fix lands,
because that round moves two of these counts again, which is board 11’s own
reasoning rather than a new one.

A correction to board 13. It recorded five round 6 Minors frozen inside the held
mechanism. The close pass list carries six under that heading, M6 through M11.
All six are in the dispatched brief bar M6, which is a plan-doc edit and this
session’s: the drain batches at `DRAIN_BATCH` while section 3’s text still says
the drain sends the file’s lines in one batch per procedure, and no amendment
records the change. Round 3’s C9, which asked for that batching, is closed by it.

Round count, against the backstop. The ladder restarted at the operator’s answer
of 2026-09-17, which bought three further rounds; round 6’s review was the first.
The embedding fix delta and the drain fix delta each owe a round under the fix
delta bar, and they are taken together as one round, which is this plan’s own
precedent from board 10 and which conserves the ladder. From the third of the
bought rounds onward an adjudication still leaving the terminal condition unmet
declares again.

Next action per section. Sections 1 and 2 are closed and need nothing. Section 3:
await the drain fix round, read its delta here against a verified base, re-run all
four lanes from this session on a box polled clear, then take one review round
over both fix deltas together. Then the M6 plan-doc amendment, the size budget,
the Minor close pass, the host install of `usp_ListRecords` on 192.168.58.245, the
close gate and Chapter 3. Then sections 4 and 5, then finishing-work.

### Interim board 15 - 2026-09-18

The drain fix landed, was verified here and pushed, and the round it owed is
adjudicated. Four Majors survive, so the section is in another fix round rather
than closing.

Stage. Sections 1 and 2 stay closed. Section 3 is at step 4. Its code is
committed and pushed through `fdea6414`, so the work is durable and a fresh
session resumes from the branch rather than from a dirty tree. The tree carries
no section 3 work of its own beyond the fix round now in flight. PR 59 is open,
still draft, auto-merge never armed, re-read after this window’s push.

The drain fix, verified rather than accepted. The tree held only the two files
plus one foreign file, so `git diff HEAD` over them is the fix’s own delta, read
in full here. It closed three owed findings. The leftover fold-back no longer
runs under one bare catch: a missing aside file is quiet on ENOENT alone, and any
other read failure or a failed write-back returns before the rotation, so the
rename that destroys the aside is unreachable while that file still holds
undelivered lines. The send loop now carries a `cause` on every transport failure
and tells a refusal from an outage. And the drain’s deadline branch gained a case
with the unclamped side as its withheld control.

The red proof was confirmed from the run’s own reporter output rather than from
the implementer’s account of it: 60 tests, 57 pass, 3 fail against the pre-fix
bytes, with the fold-back case reporting success while destroying the leftover,
the outage case carrying no cause at all, and the envelope case unable to find
the function. The first grep over that log came back empty and was the
predicate’s fault rather than the run’s: the reporter’s marker lines open with a
multibyte character, so a single-byte wildcard never matches them.

The discriminator, confirmed against the real tool rather than left inferred.
The implementer flagged that its refusal-versus-outage rule rested on a reading
of what sqlcmd prints and that it could not reach a server to check. This session
ran the pinned client on this machine, ODBC 170 SQLCMD.EXE version 15.0.1300.359,
against three shapes. A procedure that throws prints `Msg 50000, Level 16, State
1, Server SCOTT-CLAUDE, Line 1` over an open connection. A closed port and a
rejected login both print under the tool’s own `Sqlcmd: Error:` prefix with no
such envelope, and both speak of refusal in words, which is exactly why the rule
cannot be a match on prose. All three exit non-zero. The rejected login is the
case that mattered most, since a login failure is server-side and could have
carried an envelope; it does not. A certificate refusal was not captured and is
the one shape of this class still unobserved.

The gate, measured here on a box polled clear, every exit code read from that
run’s own marker file. On SCOTT-CLAUDE at 2026-09-18T03:15Z on the worktree that
became `fdea6414`: the database lane 60 tests, 60 pass, 0 fail, 0 skipped, exit
0; the session lane 86 of 86, exit 0; the memq and grant lanes 769 of 769, exit
0; the live install lane against this machine’s own SQL Server 28 of 28, exit 0.
Against board 14’s baseline of 56, 86, 769 and 28 the delta is +4 on the database
lane, which is exactly the four cases this round added, and nothing moved from
pass to fail. The claims directory was empty and no test runner was on the
process list, so this session wrote the machine’s heavy-process claim, ran, and
deleted it after verifying the `Session:` line was its own.

Round 7, adjudicated. One lens, the adversarial reviewer at opus and high effort
through the Workflow route, which is the decayed round’s one dispatch at the
writer tier, taken over both fix deltas together from base `2ef589a3`. It
returned CHANGES_REQUIRED with four Majors and five Minors. Every Major was
checked against the code here before it became a plan mutation, and all four hold.

First, the spool lock’s staleness is one spawn floor short of the drain’s own
maximum hold. A batch starting a moment before the deadline has its budget lifted
to the two-second floor, and the transport’s default kill is that budget plus the
floor again, so the spawn may live four seconds past its start while the
staleness asks for only the remaining budget plus two. The gap is two seconds, in
which a second publisher breaks a live holder’s lock, folds back the file it is
still draining and re-sends lines already delivered, which is the exact
double-delivery the lock exists to prevent. Two comments assert the invariant the
arithmetic does not hold.

Second, the set of procedures that take the fleet publish lock is written out by
hand twice, as prose in a comment and as a two-name literal filter in the pin
that guards their budgets. A third procedure taking that lock would get the short
configured timeout, which is the defect the pin exists to catch, and the pin would
stay green because its literal list never names it. The owning surface is the
`sp_getapplock` line in each `.sql` file, and the pin is to derive the set from
there.

Third, the discriminator’s fixtures are strings this effort authored about what
the tool prints rather than bytes anyone observed. That is a fair finding on the
artifact even though this session has since observed them: the evidence lives in
a board entry where the suite cannot read it. The three captures above go into
the case as recorded output, with the invented probes kept and marked as controls.

Fourth, the fold-back is not idempotent. If the append to the live file succeeds,
the aside unlink then fails and the rotation fails for the same cause, the
leftover sits in both files; the next drain folds the same bytes on again and
sends them twice once the rotation succeeds. The invariant the fix owes is that
when the fold-back returns, the leftover exists in exactly one of the two files.

Provenance, read here rather than taken from the lens. All four are
fix-introduced: the staleness ceiling and the fold-back guard were written by
round 6 and by this round’s own drain pass, the pin’s two-name filter by the
embedding fix, and the fixtures by this round. The design stop does not fire on
them. Its count of consecutive fix-introduced rounds restarted at the
accept-and-declare ruling recorded on board 14, and that ruling landed after round
6’s review, so this is the first such round after the restart rather than the
second of a pair.

Round count, against the backstop. The ladder restarted at the operator’s answer
of 2026-09-17, which bought three further rounds. Round 6’s review was the first
and round 7 is the second, so this adjudication does not declare. The fix round
now in flight owes the third under the fix delta bar, since its delta changes what
the drain deletes and what a lock’s staleness permits, and that adjudication
declares to the operator if it still leaves the terminal condition unmet.

Live dispatches, one. An `implementer-opus` holds `memory-database.js` and
`test/memory-database.test.js` for the four Majors plus four folded Minors. The
folded ones are the comment that overstates what goes back after an outage, the
`cause` field no production caller reads, the untested cause composition in the
transport, and the one failure return that carries no cause at all. The brief
names the fourth Major’s invariant and leaves the mechanism to the implementer,
because moving the unlink inside the existing guard reaches the same duplicated
state by another route.

Approval drift recorded here, one edit this session made inside the
approval-scoped fingerprint region, deliberate and open to the operator to
overturn. Section 3’s drain sentence moved from one batch per procedure with a
truncate on success to the rotation and the batching the code has built, which is
round 6’s M6 and the last of the Minors the second design stop had frozen.

Minors. The close pass list at `.kit/scratch/memory-database/minors-section-3.md`
carries twenty-nine entries. Round 7 added one that accumulates, a record upsert
the server answers with its own message still standing the run down as
unreachable, and four that went into the fix brief instead.

The size budget, still owed and still deferred on board 11’s own reasoning: the
ratchet lane reports six items, three test files with no cap and three over cap,
and the round in flight moves two of those counts again.

Next action per section. Sections 1 and 2 are closed and need nothing. Section 3:
await the round 7 fix round, read its delta here against a verified base, re-run
all four lanes from this session on a box polled clear, then take the round it
owes. Then the size budget, the Minor close pass, the host install of
`usp_ListRecords` on 192.168.58.245, the close gate and Chapter 3. Then sections 4
and 5, then finishing-work.

### Interim board 16 - 2026-09-18

The round 7 fix landed, was verified here and pushed, and the round it owes is
dispatched. That round is the third of the three the operator bought, so its
adjudication declares if it still leaves the terminal condition unmet.

Stage. Sections 1 and 2 stay closed. Section 3 is at step 4. Its code is
committed and pushed through `8765f16f`, so the work is durable and a fresh
session resumes from the branch rather than from a dirty tree. The tree carries
no section 3 work of its own. PR 59 is open, still draft, auto-merge never
armed, read before this push and again after it.

The fix, verified rather than accepted. The tree held only the two files plus
one foreign file, so `git diff HEAD` over them is the fix’s own delta, read in
full here at `.kit/scratch/memory-database/3/r7fix-src.diff` and
`r7fix-test.diff`, 612 and 508 lines. All four Majors are closed and each was
checked at the code rather than on the report.

First, the lock staleness. `spawnKillMs` is now the one spelling of how long a
spawn may live, `runBatch` takes its default kill from it, and
`SPAWN_MAX_OVERSHOOT_MS` is that function at the spawn floor, so the overshoot
is two floors rather than one. The ceiling moves from 902000 to 904000 and the
per-deadline staleness from deadline plus two seconds to deadline plus four.
The arithmetic was traced here: 904000 still clears `DB_SYNC_ATTEMPT_STALE_MS`
at 960000, and the pin in the session lane reads both constants from their own
sources, so it still guards the relation that had to hold once the ceiling
grew. The new case sits in the middle range where neither the floor nor the
ceiling decides and the arithmetic itself is what answers, which is what makes
it say anything.

Second, the lock-taking roster. The pin now derives the set by reading every
script under `db/Procedures` that asks `sp_getapplock` for the `mem.Publish`
resource, and takes the name off the `ALTER PROCEDURE` the deployment shape
puts each one behind. Its control is withheld from its own literals: a
procedure written for the probe and named nowhere in the pin is found by its
shape, one taking a different resource is not, and an empty directory answers
nothing, which is the state the non-empty assertion reds on.

Third, the fixtures. The three captures this session took from the real tool
are pinned as recorded output of ODBC 170 SQLCMD.EXE 15.0.1300.359, the two
invented probes stay and are marked as the file’s own, and the uncaptured
certificate refusal is named as the one member of the class the fixtures do not
cover. The case cannot be red against the previous code, because the finding
was about provenance rather than behaviour, so it earns its green a different
way: a words-based classifier, the instrument this discriminator is not, calls
the observed closed-port bytes a refusal.

Fourth, the fold-back is gone rather than guarded, and the reasoning is worth
keeping. A fold is an append and a removal, two calls with two outcomes, so no
ordering of them can guarantee the leftover ends in one file. `drainSpool` now
takes at most two passes over the same machinery: a file an earlier drain left
aside is read, sent and written back where it lies, and only once that file is
gone does the live spool rotate onto its path for a second pass. Nothing is
copied between the two files ahead of a send.

One semantic the implementer got wrong first and corrected, proved with a
second build of the module rather than argued: stopping the drain on a refusal
in the leftover pass would wedge the live spool behind a line the server will
never take, which is the wedge the per-batch skip exists to prevent. A refusal
does not stop the drain. Its lines go back and cost one more spawn.

The residual, confirmed here and recorded rather than reopened. `putBack` still
appends the undelivered lines to the live file and then unlinks the file aside
(`memory-database.js:1187-1195`), which is the same two-call shape one step
further on. Where the append lands with lines undelivered and the unlink then
fails, those lines sit in both files and a later drain sends them twice. That
window predates this round, the round changed none of it, and it is reported as
`unclearable` rather than silently. It goes on the Minor list rather than into
another fix round, since a fix there would owe a round of its own against a
ladder with one left.

The gate, measured here on a box polled clear, every exit code read from that
run’s own marker file. On SCOTT-CLAUDE at 2026-09-18T03:56Z on the worktree
that became `8765f16f`: the database lane 64 tests, 64 pass, 0 fail, 0 skipped,
exit 0; the session lane 86 of 86, exit 0; the memq and grant lanes 769 of 769,
exit 0; the live install lane against this machine’s own SQL Server 28 of 28,
exit 0. Against board 15’s baseline of 60, 86, 769 and 28 the delta is +4 on the
database lane, exactly the four cases this round added, with nothing moving from
pass to fail. The claims directory was empty and no test runner was on the
process list, so this session wrote the machine’s heavy-process claim with a
clock read at the write, ran, and deleted it after verifying the `Session:` line
was its own.

Three implementer concerns, all adjudicated here rather than routed. That the
two-pass rebuild is structural rather than local is not a scope question: board
14’s accept-and-declare already ruled the rotation, the batching, the place-set
put-back and the staleness ceiling to be the how of the one drain the plan asks
for, and replacing a fold with a second pass over that same machinery adds no
mechanism. That `putBack` carries the remaining instance of the class is the
residual above. That a refused leftover costs one extra spawn and reports batch
counts rather than distinct line counts is a reporting imprecision stated in the
code, and the alternative to it was the wedge.

Three sidecar alerts arrived against this window’s calls and all three were
treated as data that failed its own check. One claimed the overstating prose
survived at two lines; this session’s own sweep matches one line, the
spent-budget message, whose sentence is accurate. One claimed a background
launch proved only the launch, which is true of the launcher and is why the
counts above were read from the run’s own marker files. One claimed a box poll
diverged from its intent when it reported exactly what it found.

Live dispatches, one. Round 8 is the decayed round’s single lens, the
adversarial reviewer at opus and high effort through the Workflow route, over
the round 7 fix delta alone from base `fdea6414`. Its brief carries the Goal and
section 3’s acceptance as the trace target, all eleven Standing Brief
Amendments, the operator’s drain ruling, the four findings this delta was asked
to close, and the repository’s standing hunt classes, which read identically for
every diff here.

Round count, against the backstop. The ladder restarted at the operator’s answer
of 2026-09-17, which bought three further rounds. Round 6’s review was the first
and round 7 the second, so round 8 is the third. If its adjudication still
leaves the terminal condition unmet, the section stops on the BLOCKED path with
the phase analysis attached rather than opening a ninth round.

Minors. The close pass list at `.kit/scratch/memory-database/minors-section-3.md`
carries twenty-nine entries and gains the `putBack` residual above, which is
thirty.

The size budget, still owed. The deferral reason is now spent: board 11 deferred
it because the round in flight would move the counts again, and the round that
moved them has landed. It is the next thing after round 8 is adjudicated.

Next action per section. Sections 1 and 2 are closed and need nothing. Section
3: await round 8, adjudicate it at the code, and on a terminal adjudication run
the size budget, the Minor close pass, the host install of `usp_ListRecords` on
192.168.58.245, the close gate and Chapter 3; on a non-terminal one, declare to
the operator. Then sections 4 and 5, then finishing-work.

### Interim board 17 - 2026-09-18

Round 8 is adjudicated and section 3 stops. Two rules fire on this one
adjudication: a third design stop, which is ruled and lifted here, and the
review-round backstop, which is the operator’s and which this entry is the
durable record of. This entry is what a resuming session reads first.

Stage. Sections 1 and 2 stay closed. Section 3 is at step 4, stopped at the
backstop with the round its adjudication owed unrun. Its code is committed and
pushed through `8765f16f`, so the work is durable and a fresh session resumes
from the branch rather than from a dirty tree. The tree carries no section 3
work of its own. PR 59 is open, still draft, auto-merge never armed.

Round 8, adjudicated. One lens, the adversarial reviewer at opus and high
effort through the Workflow route, which is the decayed round’s one dispatch
at the writer tier, over the round 7 fix delta from base `fdea6414`. It
returned CHANGES_REQUIRED with four Majors and six Minors. Every Major was
checked against the code here before it became a plan mutation, and all four
hold.

First, the invariant the round 7 fix wrote is half false. The comment at
`memory-database.js:1308-1314` says in capitals that a line is in exactly one
file at every point of the drain. `putBack` is itself an append then an
unlink (`:1187-1191`), and the leftover pass calls it at `:1395` with no
rotation behind it. Where the append lands with lines undelivered and the
unlink then fails, `drainPass` returns false, the rotation never runs, and the
lines sit in both files for the next drain to send twice. The case the round
added cannot reach it: its fixture delivers everything, so the appended set is
empty and the write never happens.

Second, the refused count is untrue as written. The refusal accumulators are
outer-scope now (`:1267`), while the same lines are sent twice in one run: the
leftover pass refuses them, `putBack` returns them to the live spool, the
rotation picks them up and the second pass refuses them again. The summary at
`:1280-1282` then says two batches carrying twice the lines stay on the spool
while half that number stay. The comment at `:1410-1411` excuses the count as
one of batches rather than of lines, but the string it composes says lines.

Third, the disk-failure message regressed to a bare errno on the branch that
actually fires. `drainPass` assigns `spool.error` straight to `unclearable`
(`:1317-1318`), and `errText` returns `err.code` alone whenever there is one
(`:298-301`), so a leftover file that cannot be read reaches a person as
`the spool (unclearable): EIO`, naming no file and explaining nothing. The
explanatory sentence the delta kept now sits on the `fs.statSync` branch
(`:1434-1435`), which fails on a directory permission rather than on a read.
That surface is the one the operator’s own ruling calls the loud report.

Fourth, the lock floor’s comment asserts arithmetic the code no longer holds.
It says the fewest calls a drain holds the lock across is one per procedure
(`:1210-1214`), while the leftover pass makes that one per procedure per pass
over two passes. On the branch that carries no deadline, a configured timeout
of twenty seconds gives a floor of 60000 ms against a drain that can hold the
lock about 88000 ms. Production’s only caller passes a deadline, which bounds
both passes, so the exposure is the exported API and the stale comment.

Provenance, read here rather than taken from the lens. All four are
fix-introduced and all four sit in the spool drain: the leftover pass and its
invariant comment, the outer-scope accumulators, the `unclearable` assignment
and the `DRAIN_MIN_CALLS` floor were every one of them written by the round 7
fix. The lens traced three to section 3’s acceptance and returned no trace on
the fourth; this session re-traced that one against the same target rather
than holding it, since the drain’s lock staleness is inside the drain that
bullet names, which two adjudicator rulings have now read the same way.

A correction this session owes on board 16’s own words. Board 16 recorded the
`putBack` residual as a Minor and said the round changed none of it. The round
did change it. It added a second caller of `putBack`, on a path with no
rotation behind it to replace the file the failed unlink left standing, which
is a new instance of the class rather than the untouched old one. The entry is
upgraded out of the Minor list and is owed as a Major.

The third design stop, ruled and lifted. Rounds 7 and 8 each carry owed
fix-introduced Majors in one mechanism, the spool drain, which the governing
skill makes a design stop rather than a third fix round. The count restarted
at board 14’s ruling, round 7 was the first such round after that restart, and
round 8 is the second, so the pair is complete. The ask went to the
repository’s live expert seat, `KIT: Expert`, on the fixed brief at
`.kit/scratch/memory-database/3/design-stop-3-brief.md`, and the
`scope-adjudicator` was dispatched at once beside it, because this stop
freezes its own round’s fixes and so leaves no other work in flight for a
window to run against. That seat has now been asked five times across this
plan and has answered none; a late answer is recorded beside this ruling.

The bucket is accept-and-declare. Its ground is that the mechanism the rounds
have been building is the one the Goal and section 3’s acceptance already ask
for: the Goal’s "a local spool that drains when the host returns" and the
acceptance’s "the next reachable `db-sync` drains it and reports the count".
Everything the two rounds added sits inside one of those two verbs. Inside
drains: the rotation, the batching, the per-line put-back, the leftover pass
and the deadline-derived lock staleness, each deciding what happens to a line
the host did not take. Inside reports the count: the drained, malformed and
rejected figures and the one cause word beside them. The bound is that the
drain reads and writes only the spool file, its aside sibling and the spool
lock, and sends only to the two append procedures.

This session checked those grounds on its own surface rather than adopting
them on the seat’s word. All three quoted sentences exist in this document
verbatim, and a fourth sentence this session invented in the same shape
returns zero against the same predicate, so the check discriminates rather
than matching whatever it is handed. An accept-and-declare on a design stop
moves no acceptance bullet, so it earns no Standing Brief Amendment and is
recorded here and on the Chapter. The design stop’s count of consecutive
fix-introduced rounds restarts at this ruling.

The review-round backstop, fired. The ladder restarted at the operator’s
answer of 2026-09-17, which bought three further rounds. Round 6’s review was
the first, round 7 the second and round 8 the third, and round 8’s
adjudication leaves four owed Majors, so the terminal condition is unmet and
the section stops here rather than opening a ninth round. The stage the ladder
has reached: the opening bound was spent at board 11, the operator’s continue
bought three, all three are now spent, and from here each adjudication that
still leaves the terminal condition unmet declares again. The round count as
restarted is three of three.

The round this adjudication owed, named as owed and unrun. The fix for the
four Majors owes a review round of its own, because the first Major’s subject
is a disk-failure path the area’s own new case demonstrably routes around,
which is the fix-delta bar’s judgment clause rather than one of its three
triggers. The backstop opens no round, so that round is owed and unrun and is
taken on the re-arm before anything else. Nothing else is owed unfixed: round
8 returned no Critical and no security finding of any weight, so the two
classes that never freeze with the rest had nothing in this round.

Minors. The close pass list at `.kit/scratch/memory-database/minors-section-3.md`
carries thirty-six entries after round 8’s six, with the `putBack` residual
marked upgraded out of it rather than deleted.

The size budget, still owed and no longer deferred for its old reason. The
ratchet lane reports six items, three test files with no cap and three over
cap. Board 16 recorded the deferral reason as spent. It is not run here
because the section is stopped, and it is the first thing after the owed round
on the re-arm.

Next action per section. Sections 1 and 2 are closed and need nothing. Section
3 is stopped at the backstop and waits on the operator. With an answer, the
order is the owed round over the four Majors’ fix, then the size budget, the
Minor close pass, the host install of `usp_ListRecords` on 192.168.58.245, the
close gate and Chapter 3. Then sections 4 and 5, then finishing-work.

### Interim board 18 - 2026-09-18

The operator answered the backstop, and the answer is a redesign rather than
a repair. Section 3 is unblocked and resumes here. This entry is what a
resuming session reads first.

The ruling, as it reaches the work. No ninth review round is opened over the
four Majors board 17 recorded. The spool drain is rewritten to the minimal
form instead, and the duplicate protection those four faults were all
defending moves to the server, where one unique index enforces it for every
client rather than each client defending it in its own control flow.

What section 2 gains. Each spool line carries a stamp id the writing client
generates. `mem.Usage` and `mem.Outcome` each take that column with a unique
index on it, and `usp_AppendUsage` and `usp_AppendOutcomes` insert only the
ids their table does not already hold. The two columns are new rather than
altered, so the installer adds them, and a table already holding rows takes
the column nullable with the index filtered to the non-null rows. These land
on the host beside `usp_ListRecords`, on section 3’s own install run, under
the re-runnable installer section 2 already delivered.

What section 3 becomes. Read the spool under the store’s existing
exclusive-create lock, send every line read to each procedure, clear exactly
the bytes read when every send succeeded, and on any refusal or transport
failure leave the file whole and report the server’s own text loudly. A
malformed line is kept and reported, never destroyed. Removed outright: the
rotation, the aside file, `putBack`, the leftover pass, the batching, the
lock-staleness arithmetic, and every test written over them.

Why leaving the file whole is now safe, which is the whole hinge of the
redesign. Every fault of rounds 7 and 8 lived in the machinery that decided
what happens to a line the host did not take, and that machinery existed to
stop a line being sent twice. With the unique index behind the two
procedures, a line sent twice inserts once, so the client no longer needs to
be right about which lines were delivered. The failure mode the old drain
destroyed records to avoid is now absorbed by the server.

Counts. This is a new implementation, so it takes its own round 1 with its
own red-first cases, and both the design-stop count and the review-round
backstop count restart with it. The eight rounds behind it are history rather
than a ladder position.

The round board 17 named as owed and unrun is retired rather than taken. It
owed a review of the fix for four Majors in code this ruling deletes, so
there is no delta left for it to read. The thirty-six Minor entries are
triaged rather than carried whole: an entry against a deleted mechanism goes
with it, and the rest stand for the close pass.

Order from here. The drain redesign with its own round, then the size budget,
then the Minor close pass, then the host install of the new and changed
scripts on 192.168.58.245, then the close gate and Chapter 3. The operator
placed the size budget after the redesign lands. Then sections 4 and 5, then
finishing-work.

Stage. Sections 1 and 2 stay closed, with section 2’s delivered scripts
reopened only for the two tables and two procedures named above. Section 3 is
at step 1 of a fresh implementation. Its committed code through `8765f16f` is
the state being rewritten. PR 59 is open, still draft, auto-merge never
armed. The gate baseline is board 16’s, measured on SCOTT-CLAUDE at
2026-09-18T03:56Z on the worktree that became `8765f16f`: database lane
64/64, session lane 86/86, memq and grant lanes 769/769, live install lane
28/28, every exit code read from that run’s own marker file.

### Interim board 19 - 2026-09-18

The redesign is built and its first review round is adjudicated. A fix round
over that round’s three Majors is in flight. No section closed, so this is an
interim entry rather than a Chapter.

Stage. Sections 1 and 2 stay closed, with the two tables and two procedures
named at board 18 reopened inside section 3’s own delta. Section 3 is at step 4
of a fresh implementation, round 1 adjudicated, fix round dispatched. Nothing
is staged. The code sits unstaged against `cc960bc6`, which carries the plan
doc alone. PR 59 is open, still draft, auto-merge never armed.

What was built. The two tables each take a stamp id column with a unique
filtered index. The two append procedures insert only the ids their table does
not already hold, under `UPDLOCK, HOLDLOCK` range locks so that a second sender
of the same id waits and then skips rather than racing past the check and dying
on the index, which would take every unrelated line in that batch with it. The
drain is the minimal form: read, one call per procedure over everything read,
clear only on full success, leave the file whole and report the server’s own
text on any failure, malformed lines kept. `putBack`, `drainStaleMs`,
`appendRepaired`, the rotation, the aside file, the leftover pass, the batching
constant and the derived lock staleness are all deleted, with the deletion
proven by a sweep whose control spoke.

The gate, measured by this session rather than taken from the implementer. Five
lanes run one at a time under this session’s own heavy-process claim on
SCOTT-CLAUDE at 2026-09-18T08:03Z, each exit code read from that lane’s own
marker file: database 56/56 exit 0, live install 32/32 exit 0, session 86/86
exit 0, memq 715/715 exit 0, grant 54/54 exit 0. Against board 16’s baseline the
database lane falls from 64 because twelve cases tested machinery that no longer
exists, the install lane rises from 28 by four live cases, and the session, memq
and grant lanes are unchanged at 86 and 769. The implementer reported one
session-lane red under three concurrent lanes; it did not reproduce here on a
sequential run, which is the contention this machine’s own memory record
already names, so it is read as contention rather than a result.

Round 1, adjudicated. Three lenses at fable, one tier above the section’s opus
writer, over base `cc960bc6`: adversarial APPROVED_WITH_CONCERNS, blind
CHANGES_REQUIRED, security CONCERNS. No Critical from any lens. The capture is
at `.kit/scratch/memory-database/3/redesign-round-1.diff`.

Three Majors, each confirmed at the code here before it became a fix.

First, the clear was a read followed by a write, so an append landing between
the two was lost. This session had authorised that residual when it briefed the
work, and the adversarial lens returned a strictly better shape: truncate only
when the file’s size still equals what was read and no malformed bytes were
kept, and otherwise leave the file whole for the next drain. That removes the
window rather than narrowing it, because there is no write-back left to race,
and it is cheaper in machinery rather than dearer. The session’s own earlier
judgment was the weaker one and is recorded as overturned by the review.

Second, one call carrying the whole spool grows with the spool, and the payload
is built as a chain of string concatenations on the server. Past some size the
call cannot finish inside the configured clock, the kill reads as an outage, the
file is left whole, and every later run makes the same oversized call forever.
The constant that used to prevent this was the batching the operator removed by
name, so the fix may not reinstate it: the call’s clock is sized to the payload
instead, which adds no per-batch tracking and so reintroduces none of the defect
class. What remains past the clamp is reported as the operator’s question
rather than the client’s.

Third, nothing checked that the host actually holds the new procedures. The
client reads no schema version, confirmed here by a grep returning zero matches
under `plugins/claude-kit/scripts/`, and the installer still declared version 1.
A machine taking the new client before the installer runs sends the stamp id to
a procedure whose `OPENJSON` ignores the unknown key, and then resends the whole
file on any failure and inserts every landed row again. That is the duplicate
defect this redesign was ordered to end, arriving through the upgrade order. The
fix bumps the installer’s version and refuses the drain against a host below
what the client needs, reporting both versions and the remedy, and calling it
neither an outage nor a refusal, since the host is up and the condition will
never resolve itself.

One Minor upgraded with its reason stated. The security lens found the stamp id
unique fleet-wide rather than per sandbox, so one sandbox’s row can suppress
another’s write for the same id. It is not exploitable: the ids are random
UUIDs, no publisher-facing procedure returns another sandbox’s ids, and
`DENY SELECT` holds. It is upgraded because the index ships to the host in this
same change, and changing a unique index after it holds rows is a migration
rather than an edit.

Provenance. All three Majors are spec-traceable, and none is fix-introduced:
this is the redesign’s first round and no fix round of it had run when they were
found. The design stop’s count of consecutive fix-introduced rounds therefore
stays at zero, and the review-round backstop’s count stands at one of the ladder
restarted by the operator’s answer.

Minors. The list at `.kit/scratch/memory-database/minors-section-3.md` was
triaged against the redesign rather than carried whole. Four entries retire
because the mechanism they were written against is deleted, one narrows to the
single write path that survives, and seven new entries join from this round. The
triage swept the deleted identifiers by name rather than by a structural pattern
over the class, which is what it can claim and no more. One round 1 finding is
outside section 3 and went to `docs/backlog.md` instead: the repository carries
no package lockfile, so the dependency audit cannot run over it at all.

Live dispatch. One implementer at opus, asked for the three Majors and the
upgraded Minor, red first on every one, with the fix-2 clamp’s own threshold to
be reported as a number this session can carry to the operator.

Next action per section. Sections 1 and 2 need nothing. Section 3 takes the fix
round’s return, then the review round that fix delta owes, since it reaches the
security lens’s own surfaces and adds a refusal path. Then the size budget, the
Minor close pass, the host install of the new and changed scripts on
192.168.58.245, the close gate and Chapter 3. Then sections 4 and 5, then
finishing-work.

### Interim board 20 - 2026-09-18

The redesign’s round 2 is adjudicated and its fix round is in flight. No
section closed, so this is an interim entry rather than a Chapter.

Stage. Sections 1 and 2 stay closed. Section 3 is at step 4 of the redesign,
round 2 adjudicated, second fix round dispatched. Nothing is staged. The code
sits unstaged against `b154a257`, which carries the plan doc and the backlog
alone. PR 59 is open, still draft, auto-merge never armed.

Round 1’s fixes, verified here at the code rather than taken from the
implementer. The spool clear no longer reads and writes back: it truncates
only where the file’s size still equals what the read consumed and no
malformed bytes were kept. The client carries `REQUIRED_SCHEMA_VERSION = 2`
and refuses the drain against a host below it, and the installer declares 2 to
match. Both unique indexes are now over sandbox id and stamp id, with the
matching predicate in each procedure. One drain call site exists and it threads
the host’s version from the health probe the run already spends.

The gate, measured by this session under its own heavy-process claim on
SCOTT-CLAUDE at 2026-09-18T09:15Z, each exit code read from that lane’s own
run: database 59/59 exit 0, live install 34/34 exit 0. Against the round 1
baseline of 56 and 32 the two lanes rise by three and two cases, all of them
the fix round’s own red-first cases. The claims directory was empty before the
claim was written and is empty again.

Round 2, adjudicated. One adversarial lens at opus, the writer’s own tier,
at high effort through the workflow route, over base `cc960bc6`:
CHANGES_REQUIRED. No Critical. Four Majors and seven Minors. The security lens
joins no decayed round, so its read of these surfaces is the finishing pass.
The capture is at `.kit/scratch/memory-database/3/fix-round-2.diff`.

Provenance. All four Majors sit in lines round 1’s fix round wrote and all four
trace to section 3’s acceptance or to a standing amendment, so all four read as
fix-introduced. Round 1’s three were spec-traceable. The design stop needs two
consecutive rounds of fix-introduced Majors in one mechanism; this is the
first, so the count stands at one and no stop fires. The review-round backstop
stands at two of the ladder the operator’s answer restarted.

Three Majors go to the fix round, each confirmed at the code here first.

First, the drain reports lines as delivered that are still on the file. The
clear declines to empty the spool on two ordinary paths, an append that raced
the read and any malformed bytes kept, and returns success on both, so the
summary a person reads says the spool emptied when it did not, and says it
again on every later run. That is the one surface that would expose the wedge
below, reporting success on exactly the state it exists to show.

Second, the payload clock lifts a call above the operator’s own configured
timeout, up to ten minutes. Standing amendment 6 says a call’s clock is the
remaining budget divided down and lifted only to the tool’s floor. The fix this
session authorised last round went the other way and nobody caught it at
briefing. The fix bounds the derived want at the configured want and reports an
oversized payload plainly instead, which returns the question to the operator
where the round 1 brief said it belonged.

Third, the clear’s comment asserts in capitals that no window exists, and that
is false. A stat followed by a truncate is check-then-act across two syscalls,
appenders take no lock by design, and a stamp landing between the two is
destroyed and counted nowhere. The comment is corrected to state the residual
truthfully and the two calls move onto one descriptor, which narrows the window
without adding machinery. Closing it outright would need the rename the
operator’s ruling deleted.

One Major is justified and not fixed, and the ground is the operator’s own
word. A malformed line keeps the whole spool: nothing removes those bytes, so
the file never empties again and grows until somebody looks. The lens’s
proposed fix is to clear the readable lines and write the malformed pieces
back, which is a rewrite of the spool, which is the loss window round 1 closed
and which amendment 13 deletes by name. The ruling says a malformed line is
kept and reported, never destroyed, so the remedy here is to report it loudly
rather than to repair it, which is the first Major’s fix. The consequence is
the operator’s to rule on and is carried to them rather than settled here.

The number the operator asked for, measured by the implementer and stated as
reported rather than confirmed on this session’s surfaces: at the default ten
second timeout the old payload clock reached its ten minute clamp at about
1,549,000 payload characters, roughly 6,900 stamp lines. With the second fix in
place no clock is lifted at all, so the threshold becomes the point at which an
oversized payload is reported rather than the point at which the clamp bites.

Minors. Seven new entries join the list at
`.kit/scratch/memory-database/minors-section-3.md`, which now carries the
redesign’s two rounds. None was upgraded.

Live dispatch. One implementer at opus, asked for the three Majors, red first
on every one, with the fourth recorded as justified and not fixed.

Next action per section. Sections 1 and 2 need nothing. Section 3 takes the fix
round’s return, then the round that fix delta owes if it meets the bar, then the
size budget, the Minor close pass, the host install of the new and changed
scripts on 192.168.58.245, the close gate and Chapter 3. Then sections 4 and 5,
then finishing-work.

### Interim board 21 - 2026-09-18

Round 3 is adjudicated and its fix round is in flight. No section closed, so
this is an interim entry rather than a Chapter.

Stage. Sections 1 and 2 stay closed. Section 3 is at step 4 of the redesign,
round 3 adjudicated, third fix round dispatched. Nothing is staged. The code
sits unstaged against `2a2f6701`, which carries the plan doc alone. PR 59 is
open, still draft, auto-merge never armed.

Round 2’s fixes, verified here at the code. The payload no longer lifts a
call’s clock at all: `payloadCallMs` returns the configured want clamped to the
ceiling, and an oversized payload is reported with its size and its clock
instead. The clear measures and empties through one descriptor, and its comment
now states the residual window truthfully rather than denying it. The drain
reports drained only for lines that left the file and carries a remaining count
otherwise.

One ruling this session made on that round, recorded because the code
contradicted itself. The fix first reported a raced clear as a failure while
its own comment called the race the ordinary busy machine. A surface that
reports a failure every time a stamp lands during a publish teaches its reader
to ignore it, and the state that needs a person is the malformed one, so
flattening the two destroys the signal the round’s first Major existed to
build. Ruled: a raced clear is an ordinary named state carrying its count, and
a malformed clear is a failure. Confirmed at the code afterwards that a raced
drain writes nothing into the publish run’s error column.

The gate, measured by this session under its own heavy-process claim on
SCOTT-CLAUDE at 2026-09-18T10:14Z, each exit code read from that lane’s own
run: database 63/63 exit 0, live install 34/34 exit 0, grant 54/54 exit 0.
Against the round 1 baseline of 56 the database lane rises by seven, all of
them red-first cases the two fix rounds added. The em dash constraint was
checked here over both changed files with a control that spoke: zero matches
against a control file holding one.

Round 3, adjudicated. One adversarial lens at opus through the workflow route
at high effort, over base `cc960bc6`: CHANGES_REQUIRED. No Critical. One Major
and six Minors. The lens confirmed seven of the standing amendments honoured in
the delivered code and disputed neither of the two dispositions it was handed.

Provenance. The Major is spec-traceable and is not fix-introduced: its subject
is the order of the publish legs, which the plan’s own Approach fixed before
any of this was written. So round 2’s pair does not complete, the design stop’s
count of consecutive fix-introduced rounds returns to zero, and the review-round
backstop stands at three of the ladder the operator’s answer restarted.

The Major, confirmed at the code here. The publish drains the spool before it
upserts records. The append procedure resolves each stamp through the visible
records function, so a stamp naming a record the host does not yet hold
resolves to nothing, is counted rejected and is never written, while the drain
treats that call as success, empties the file and loses the line. Two ordinary
paths reach it: a record created and stamped between two runs, and a first
publish from a machine that has never published, where every spooled stamp
resolves to nothing and the summary reports them all drained. That is the
silent loss of a stamp between spool and database this section’s own Tests
paragraph names as the expensive failure.

This session ruled it rather than raising it, and the ground is worth recording
because the lens said it needed the operator. The lens was right that the
Approach says the verb drains the spool first and that the fix changes that
sentence. It is rulable even so, because the same section’s Tests paragraph
already ranks the two: one clause names a sequence and the other names a
data-loss failure, so the spec answers the question rather than leaving it
open. The lens’s alternative, the server returning rejected stamp ids so the
client can keep those lines, is the per-line put-back amendment 13 deletes by
name and was refused. The drain moves to sit after the record upsert leg and
before the embedding leg, rather than to the end of the run: the embedding leg
is the long part, and a drain behind it can be starved by a run out of budget,
which would trade one loss for another. The cost accepted is that a run whose
upsert fails now drains nothing, which delays stamps rather than losing them.
The Approach sentence changes with it, which is approval drift and is named
here for the operator to overturn.

Two Minors were upgraded on a stated consequence. The verb exits zero even when
the drain was refused, stopped by the schema gate or unable to clear, and those
states reach stderr alone, which nobody reads on the detached session-start
spawn while section 5’s doctor step reads the result: a failure nobody can see
is the defect this round’s earlier work existed to remove. And three refusal
paths report a remaining count of zero while the file still holds every line,
so the counted field a reader scrapes says zero for exactly the states in which
the spool is not emptying. A style violation of amendment 1 went with them: a
version note was edited rather than appended to in both append procedures.

Minors. Six new entries join the list at
`.kit/scratch/memory-database/minors-section-3.md`, three of them the ones
upgraded above and three left for the close pass.

Live dispatch. The same implementer at opus, continued with its context, asked
for the Major, the two upgraded Minors and the style restore, red first on each.

Next action per section. Sections 1 and 2 need nothing. Section 3 takes the fix
round’s return, then the round that fix delta owes, since it reaches a write
outside the tree. Then the size budget, the Minor close pass, the host install
of the new and changed scripts on 192.168.58.245, the close gate and Chapter 3.
Then sections 4 and 5, then finishing-work.

### Interim board 22 - 2026-09-18

Round 4 is adjudicated and its fix round is in flight. No section closed, so
this is an interim entry rather than a Chapter.

Stage. Sections 1 and 2 stay closed. Section 3 is at step 4 of the redesign,
round 4 adjudicated, fourth fix round dispatched. Nothing is staged. The code
sits unstaged against `d30e2d82`, which carries the plan doc alone. PR 59 is
open, still draft, auto-merge never armed, re-read before and after the push
of `d30e2d82`.

Round 3’s fixes, verified here at the code rather than taken from the report.
The drain now sits between the record upsert and the inventory read: the upsert
batch loop is at `:1800`, the drain at `:1846`, the inventory read at `:1922`,
the removal marking at `:1964` and the embedding write at `:2149`. The verb’s
exit code runs through an exported `publishFailed`, called at `memq.js:17458`.
The three refusal paths that answer before a usable read return a null depth,
and the summary line omits the clause rather than printing a zero. Both append
procedures carry their v1.0 note block again, restored below the v1.1 entry.

The spec moved with the code, which is approval drift and is named here. Section
3’s Approach no longer says the verb drains the spool first; it names the true
order. The drain paragraph gained the ruling and its ground. Both are open to
the operator to overturn.

The gate, measured by this session under its own heavy-process claim on
SCOTT-CLAUDE at 2026-09-18T10:45Z, four lanes run sequentially, each exit code
read from that lane’s own run: database 66/66 exit 0, live install 34/34 exit 0,
grant 54/54 exit 0, memq 715/715 exit 0. The claims directory was empty at the
spawn and no foreign test runner was live, so the claim was written and released
around the run. Against the redesign’s round 1 baseline of 56 the database lane
is up ten, all of them red-first cases the fix rounds added.

Round 4, adjudicated. One adversarial lens at opus through the workflow route at
high effort, over base `cc960bc6`: CHANGES_REQUIRED. No Critical. Three Majors
and four Minors. The lens confirmed the drain’s new position against the
amendment, and confirmed the withheld list at six names.

Provenance. Two Majors are spec-traceable and one is fix-introduced, so round
3’s spec-traceable round does not pair with it and the design stop’s count of
consecutive fix-introduced rounds stands at one. The review-round backstop is at
four of the ladder the operator’s answer restarted, so the next round’s
adjudication is the bound.

The three Majors, each confirmed here at the code. The count of records embedded
is taken from what the client sent rather than from what the host stored: the
write returns inserted, updated and rejected counts and refuses any row naming a
record the caller cannot see, and the code reads only whether the call
succeeded. Every other leg already reads the host’s own counts, and the
section’s acceptance asks for the embedded figure to be read from the summary
line, so a false count breaks the acceptance test itself. Second, the verb’s
exit code treats two ordinary states as failures: a lock another publisher
holds, which the next run clears, and a warning about the next run’s payload
size, which rides on a drain that emptied the spool completely. The comment
directly above the predicate enumerates the states it is for and names neither,
so the code contradicts its own stated contract. Third, the schema version
marker is written at the start of an install run and asserts what the end of it
establishes: the installer applies the schema directory first, the version row
lands before the stamp id columns are added and before the append procedures are
replaced, so an install that dies in between leaves a host answering the new
version with the old procedures, the client’s gate passes, the stamp id is
ignored, and a resent line writes a duplicate row. That is the defect the gate
exists to prevent.

One ruling adopted this boundary, and it repairs an omission of this session’s.
The raced-versus-failure ruling made at round 2 changed what every later dispatch
is built from and was recorded only in a board entry, not in the Standing Brief
Amendments block where the adoption trigger puts it. It is now entry 15, stated
as the rule rather than as the finding: only a state that needs a person reaches
the failure list, a state the next ordinary run clears is a note, and a run that
finished its work and is warning about the next one is a note too. The second
Major above is that same rule applied to two causes the fix round did not
consider, which is why it reads as fix-introduced rather than as a new
requirement.

Minors. Four new entries join the list at
`.kit/scratch/memory-database/minors-section-3.md`, now 66 entry lines. Two were
upgraded on a stated consequence and went to the fix round. One is the stamp id
index question raised for the third time by a third lens, which only the host
install can answer. One is a claim about a comment, left for the close pass.

A fold recorded. `plugins/claude-kit/db/Schema/020-SchemaVersion.sql` and one new
final install script join section 3’s files in scope, for the third Major. They
sit in the directory the section already changes, need no acceptance the section
does not carry, and the install lane that closes the section covers them.

Live dispatch. The same implementer at opus, continued with its context, asked
for the three Majors and the two upgraded Minors, red first on each, with the
new amendment quoted as what the exit-code item is judged against.

Next action per section. Sections 1 and 2 need nothing. Section 3 takes the fix
round’s return, then the round that fix delta owes, which is the fifth and the
bound. Then the size budget, the Minor close pass, the host install of the new
and changed scripts on 192.168.58.245, the close gate and Chapter 3. Then
sections 4 and 5, then finishing-work.

### Interim board 23 - 2026-09-18

Round 5 is adjudicated. A design stop fired and was ruled, and the review-round
backstop fired on the same adjudication, so the section is stopped for the
operator rather than opening the fix round that adjudication would owe. No
section closed, so this is an interim entry rather than a Chapter.

Stage. Sections 1 and 2 stay closed. Section 3 is stopped at step 4 of the
redesign on the review-round backstop. The backstop is at its opening bound,
firing for the first time, and the round count as it stands is five. A continue
buys the section three further rounds, and the count restarts at the operator’s
answer. The design stop’s own count of consecutive fix-introduced rounds
restarts at its ruling below and does not move on this declaration.

Round 5, adjudicated. One adversarial lens at opus through the workflow route at
high effort, over base `cc960bc6`: CHANGES_REQUIRED. No Critical. Four Majors
and five Minors. The lens was given the amendments block as it now stands and
the section’s Files in scope line as widened by the round 4 fold.

The four Majors, each confirmed here at the code. First, the verb truncates the
server’s own words before printing them: the failure sentences are composed with
the cause and the spool path in front, and the print applies a 300 character cut
that lands before the server’s text begins, so a refusal shows the operator
boilerplate and an outage shows a fragment. Second, the same print strips
backslashes, so every Windows path these sentences name is printed as a string
that names no file, while memq already owns two renderers for exactly this and
twenty other call sites use them. Third, `summary.notes` is written by one line
and read by nothing: `cmdDbSync` prints only the failure list, so every sentence
the round 4 fix moved onto the note list now reaches no reader at all, including
the oversized-payload warning whose whole purpose is to make a spool that never
empties legible. Fourth, the new sendability screen accepts any non-empty value
as a timestamp, so a line carrying a malformed date passes the screen, the host
throws over the whole batch, the file is left whole, and every later drain
rebuilds the same batch, which wedges the spool permanently.

Provenance. The first two are spec-traceable, tracing to the Tests line’s
"the server’s own text reported". The third and fourth are fix-introduced: both
sit in lines the round 4 fix wrote. The third sits in the same mechanism as
round 4’s own fix-introduced Major, which was the two ordinary states wrongly on
the failure list, so rounds 4 and 5 are two consecutive rounds of fix-introduced
Majors in one mechanism. That is the design stop.

The design stop, and its ruling. The mechanism named was the drain’s
cause-reporting routing: the two cause sets, the classifier that decides which
list a drain sentence rides on, the note list itself, and the exit-code
predicate keyed off the split. The expert ask went to the live `KIT: Expert`
seat first and had not answered when the section’s other work reached the stop,
so the window was zero and the `scope-adjudicator` was dispatched at once, at
fable and its charter’s own effort. Its bucket is REFUSE. Its grounds are the
Goal reading rather than an Out of Scope entry, and the grounds were checked
here against the plan before adoption: the Out of Scope list holds nothing
bearing on this, and the form the bullets do ask for is one reporting surface,
the drain’s count on the verb’s own summary line with the server’s or the disk’s
own text reported beside it. Nothing in the Goal, the Acceptance, the Tests line
or the Out of Scope list names a cause vocabulary, a second list, a classifier,
or an exit code keyed off that classification. The ruling is adopted.

What the refuse orders, owed and unrun. A refuse removes the mechanism to the
form the bullets ask for, in one fix round. The backstop freezes that removal
like any other fix, so it is named here rather than performed: remove the two
cause sets, the classifier, the note list and the exit-code predicate; push the
drain’s detail with its cause word onto the one failure list; print that list on
stderr beside the summary line; and retire the tests written against the
classifier and the note list. The count the acceptance asks for already rides on
the summary line independently of the routing, so the removal costs nothing the
acceptance names. This removal is the first thing the session that resumes does,
before anything else. A refuse recorded and never performed would leave the
section closable with the refused mechanism still standing, which is the one
failure this entry exists to prevent.

The judge also observed that the verb’s exit code for non-drain failures, an
unreadable tier or an embed refusal, is named by no section 3 bullet either, and
that it arrived on the same predicate, so it falls inside the removal rather
than beside it. That is carried to the operator as part of the declaration.

One dispatch defect to fix on any re-dispatch: the judge’s brief named a capture
path that does not exist, `fix-round-4.diff`. The judge said so, did not open the
similarly named sibling, and ruled from the round 5 capture, whose removed lines
carry the pre-state the ruling needed. The ruling stands on what it did read.

Minors. Five new entries join the list at
`.kit/scratch/memory-database/minors-section-3.md`, now 71 entry lines. Four are
claims for the close pass, one of which supersedes round 4’s entry on the same
sentence. The fifth is not deferred: the new install script is untracked while
the installer now stops when a listed directory is missing, so it is staged in
the same commit as the installer or every install breaks before applying
anything.

The gate, measured by this session under its own heavy-process claim on
SCOTT-CLAUDE, lanes run one at a time, each exit code read from that lane’s own
run. The box was held by a foreign session at the first attempt, `KIT: Expert`
with a live runner behind it; that claim was left alone and this session waited
for it, which took two minutes. Counts and the moment are on the Gate line of
the Chapter this section will eventually carry, and are recorded here as
measured: database 69/69 exit 0, grant 54/54 exit 0, install and memq as the
declaration reports them.

Next action per section. Sections 1 and 2 need nothing. Section 3 is stopped and
waits on the operator. On the answer, the removal fix round above runs first,
then the round that removal delta owes, then the size budget, the Minor close
pass, the host install on 192.168.58.245, the close gate and Chapter 3. Then
sections 4 and 5, then finishing-work.

### Interim board 24 - 2026-09-18

The operator answered the backstop and the section resumed. Two fix rounds
landed and the drain was rebuilt on the operator’s own correction. No section
closed, so this is an interim entry rather than a Chapter.

The operator’s answer. Continue the section, adopt the refuse, and keep one
exit code so an automated caller still reads a loud failure. The removal the
refuse ordered is performed: the two cause sets, the classifier, the note list
and the exit-code predicate are gone from the tree, confirmed here by a whole
tree search rather than from a report. Every drain sentence now rides on the
one failure list the verb prints on stderr beside its summary line.

The exit code is no longer that list’s emptiness. The operator ruled the
principle twice: if every id the drain set out to process was processed, the
queue is clean. Two states proved the point. An append landing behind the read
delivered every line and is not a fault. The oversized-payload warning is
pushed before the call and the call then succeeds, so that run delivered
everything and emptied the file while warning about a future one. Deriving the
exit code from the printed list would fail both. The list stays the one
reporting surface and the exit code answers its own question, which is whether
anything the run set out to do failed.

A correction to board 23, which asserted more than it had. That entry recorded
four Majors as "each confirmed here at the code". One was not real. The lens
claimed the verb’s print strips backslashes so every Windows path names no
file, and this session recorded it as confirmed. It is false: charsetRule at
memq.js:2705-2707 is /[^\x20-\x7E]/g, which keeps the backslash at 0x5C. The
implementer disproved it with two probes and this session then read the regex
itself. The earlier check that appeared to confirm it was a shell heredoc
eating the backslashes rather than the renderer. The print site still moved to
the renderer that marks its own cut, which is what the truncation Major
actually needed.

The operator’s correction, which is the substantial change here. Asked why an
append behind the read should make a run read as unclean, this session first
amended the plan sentence toward the delivered code. That was the wrong
direction and is reverted. The operator’s own redesign ruling had said the
drain clears exactly what it read, and the delivered code never did: it
compared the file’s size and then emptied the whole file or left the whole
file. The drain now removes exactly the lines it read and keeps what arrived
behind them, so the raced outcome is not reported better, it stops existing.
summary.spoolCause and the summary line’s clause naming the race are gone with
it.

The hazard underneath, which this session got wrong and the implementer caught.
Nothing that appends to the spool took any lock, so rewriting the file in place
had a real loss window. This session proposed the appenders take the drain’s
lock. That is refuted and the evidence is the lock’s span rather than its cost:
it is acquired at memory-database.js:1331 and released at :1523, with both
sqlcmd spawns inside, so an interactive stamp would have queued behind a
network round trip and then dropped its line. A second lock now covers one file
operation only, taken by the appender and by the clear, so a contending write
waits about fifty milliseconds. Residual, named rather than hidden: a writer
that cannot take that lock inside its wait writes nothing and answers false, so
the stamp is absent from the spool while usage.jsonl still holds it. A test
pins that bound.

Recorded as a new amendment: the append procedures answer in counts rather than
identities, so a line the host declines on its own cannot be named and is lost
to the host. The operator ruled it its own piece of work rather than a
reopening of this section, and asked that the expectation be written down so
both halves have a target. The amendment names the expected shape and the two
client addresses that change, and no client code is written against it until
the procedures carry it.

The gate, measured by this session under its own heavy-process claim on
SCOTT-CLAUDE, lanes run one at a time, each exit code read from that lane’s own
marker file. No foreign runner or build on the box at the poll. memory-database
74/74 exit 0, up from 69 at the round’s start. memq 715/715 exit 0, unchanged.
memory-usage-stamp 15/15 exit 0, run because the stamp hook is one of the four
appenders now paying a lock.

Two process failures of this session’s own, recorded because both are cheap to
repeat. It stopped a working implementer on the full wedge hallmark: the task
artifact read zero bytes and a probe went unanswered, and both signals were
false, since that artifact is not a live sink for this dispatch shape and a
queued probe cannot arrive while the agent holds a tool call open. The agent was
resumed and no work was lost. It also amended a plan sentence toward the code
rather than asking why the code disagreed with it, which the operator caught.

Next action per section. Sections 1 and 2 need nothing. Section 3 owes its
review round over this delta, then the size budget, the Minor close pass, the
host install on 192.168.58.245, the close gate and Chapter 3. Then sections 4
and 5, then finishing-work.

### Interim board 25 - 2026-09-18

The rebuilt drain took its review round and one fix round, and a second round
put the section under a design stop. No section closed, so this is an interim
entry rather than a Chapter.

The identities amendment now prespecifies rather than gestures. The operator
ruled the register: writing a shape against a contract nobody has built yet is
prespecifying that contract rather than guessing at it, and its worth is in the
detail it commits to. The bullet now carries the transport constraint that
decides the shape. Every procedure answers as one JSON document behind a tag
rather than as a result set, at memory-database.js:822-828 and :763-767, so a
second result set cannot reach the client at all and the change is additive on
the object each procedure already returns. The bullet names the key, its
element type, the invariant tying its length to the rejected count, what an
absent key means on an old host, and the two client addresses at :1423 and
:1194. Every one of those references was confirmed here at the code before it
was written down.

The review round over the rebuilt drain ran three lenses at one tier above the
section's writer. Two Majors arrived from independent seats and both were
confirmed here at the code rather than taken from the reports. The verb exited
non-zero whenever two publishes overlapped, because a contended drain answers
not-ok and the publish read every not-ok as work that failed, which the
module's own comment says must not happen. The timestamp screen admitted a zone
offset the column refuses, which wedges the spool for good: a line the screen
admits is sent, the host throws over the whole batch, the drain leaves the file
whole by design and every later drain rebuilds the identical batch. The
implementer then measured that bound against a live SQL Server instance rather
than taking it from the brief. Fourteen hours either way is taken, one minute
past it is not, and four values the old screen passed are refused now. One
lens's finding was disproved here by probe rather than fixed, a seven-digit
fractional second parsing fine on this runtime.

The gate, measured by this session under its own heavy-process claim on
SCOTT-CLAUDE after a clean poll, lanes run one at a time, each exit code read
from that lane's own marker file. memory-database 79/79 exit 0, up from 74 at
this round's start. memq-grant 54/54 exit 0. memq 715/715 exit 0, unchanged.

The design stop, which is why no section closed. The fix for the error column
introduced a second accumulator feeding it, and the next round found that the
amendment binding this section says there is no second list and that the same
one list fills that column. Two consecutive rounds of Majors sitting in code
the previous round's own fix wrote, both in one mechanism, is a design stop
rather than a third repair. The frozen mechanism is what fills the publish
run's error column. The ask went to the repo's expert seat on the fixed brief,
carrying no amendment text, no fix narrative and no lean, and the section
continues on every finding that mechanism does not touch.

The same fork went to the operator in its own right, because the cost is theirs
to weigh. The one list carries warnings as well as failures, and one of those
warnings is about a future run, so a run that failed nothing writes a non-null
error to the host and nobody can ask the database which runs were clean. The
recommendation given was to hold the column to what failed and correct the
written rule, which is the option currently built.

Live dispatches at this boundary: one implementer at the section's own tier,
asked for five Majors and three Minors that the frozen mechanism does not
touch, with that mechanism named off-limits in its brief. One ask outstanding
at the expert seat.

Two process notes worth keeping. The task artifact again read zero assistant
lines for a working agent, and this session did not act on it: the worktree's
own growth and the agent's live tool calls were the evidence that it was alive.
That is the lesson from the stopped implementer holding. Second, the brief for
the first review round named three files as changed that carried no delta from
the base ref, which all three lenses caught and reported; the list was composed
from the section's scope rather than read from the diff.

Next action per section. Sections 1 and 2 need nothing. Section 3 owes the
ruling on the error column, then the round its current fix delta owes, then the
size budget, the Minor close pass at 76 entries, the host install on
192.168.58.245, the close gate and Chapter 3. Section 5 gains a third
security-model.md item: that document says memq find is the one verb that sends
anything off this machine, which this section's publisher contradicts. Then
sections 4 and 5, then finishing-work.

### Interim board 26 - 2026-09-18

The rebuilt drain took its third review round and is in its third fix round. No
section closed, so this is an interim entry rather than a Chapter.

Section 3 is the only section in flight. Its stage is a fix round dispatched
against seven Majors and four Minors, one of the seven held frozen. Sections 1
and 2 are closed and need nothing. Sections 4 and 5 have not opened.

The round count on the rebuilt drain stands at three. The review-round backstop
declares at five, so two rounds remain before this section reaches the operator
on that bound. The design stop's own count of consecutive fix-introduced rounds
is one, held where the ruling left it, because the mechanism that pair sits in
is frozen and no fix round has run on it.

Round 3 ran one lens over the fix delta, at the section's own tier and at high
effort, which is the decayed roster a later round takes. It returned seven
Majors, four Minors and no Critical, with the verdict changes-required. Two of
the seven were confirmed here at the code rather than taken from the report.

The first is a test that goes red on any clean checkout of this branch. The
one-destination scan finds the end of the publish function with a bare
line-feed literal. This repository sets autocrlf on and carries no gitattributes
file, and git itself warned on this session's own diff that the working copy's
line feeds become carriage-return pairs the next time git touches the file. So
the scan matches today only because an editor wrote the file, and the next
checkout reddens the lane for a reason that has nothing to do with the code
under test. The fix round also sweeps both test files for the same shape.

The second is the render that leaves this machine. The client had spelled the
four-pass elision a second time, with its own cap constant and its own barred
character, and the comment justified that by saying the client binds no memq at
load. The lens showed the justification is beside the point: the shared home is
the compaction library, which both modules already bind and which already owns
all three sanitizing passes. That library is folded into the section's files in
scope and the render moves there as one exported helper taking each caller's
own cap. The plan doc's files in scope line records the fold.

Four more Majors went to the fix round and are named here so a resuming session
does not have to rediscover them. A refusal by the host on the record, list or
removal legs is reported as a host that did not answer, which sends a reader to
the network instead of to the data, while the drain leg already tells the two
apart. A drain that cannot read under the spool write lock now answers
contended and exits zero, and carries no depth, so a lock that never ages out
yields clean-looking publishes forever while the file never empties; the fix
carries the measured depth. The spool append never re-asks whether it still
holds its lock after writing, which is the mirror of a guard the clear and the
drain both take, and losing that race destroys a stamp silently, which this
section's own tests line names as the expensive failure. The record leg renders
a file modification time with no screen, while the spool screens its own, and
one unrepresentable time wedges every publish.

The frozen mechanism is unchanged and was not touched. It is what fills the
publish run's error column. Round 3's lens reached it independently, with no
lean from this session, and reported the same fault the design stop was raised
on: the column is written from a narrower set than the one list the amendment
names, so a run whose only trouble is a warning records no error at all. That
is corroboration from a fresh seat rather than a new finding, and it stays held.
Round 3 also found that the previous fix round relaxed the test pin that would
have caught it, and recorded the open scope question in the test's own comment.
That relaxation is part of the held unit and is not being repaired ahead of the
ruling.

The ask on that ruling went to the repository's expert seat and was followed up
once at this boundary. Nothing has come back. Under the rule this session works
to, an ask still unanswered when the section's other work is ready for its close
gate falls to the scope adjudicator, which is then dispatched before that gate
runs. No section closes with a finding still held.

The gate, measured by this session on SCOTT-CLAUDE under its own claim after a
clean poll, lanes run one at a time, each exit code read from that lane's own
marker file, over the worktree at commit 63b9899f with this section's delta
uncommitted and two kaizen files dirty from other parties. memory-database
81/81 exit 0, up from 79 at this round's start. memq-grant 54/54 exit 0.
memory-session 86/86 exit 0, a lane with no prior baseline recorded, so read it
as green now rather than as a delta. The memq lane was not re-run this round
because its own file was unchanged since the 715/715 reading at the previous
boundary.

Live dispatches at this boundary: one implementer at the section's own tier,
asked for six Majors and four Minors, with the frozen mechanism named off-limits
in its brief and the compaction library folded into its scope for the render
move. One ask outstanding at the expert seat.

Rulings adopted since the last boundary: none. The fold of the compaction
library into the section's files in scope is a scope widening this session made
under the out-of-scope route's fold test, not a ruling, and it is recorded as
the approval drift it is.

Next action per section. Sections 1 and 2 need nothing. Section 3 owes this fix
round's return, the round that delta will owe, the ruling on the error column,
the size budget, the Minor close pass at 79 entries, the host install on the
virtualization host, the close gate and Chapter 3. Then sections 4 and 5, then
the finishing pass.

### Interim board 27 - 2026-09-18

The session running this plan crashed at 20:09Z mid fix round, and a successor
session took the Worker seat and re-armed the leash on the operator's typed arm.
No section closed, so this is an interim entry rather than a Chapter.

Section 3 is the only section in flight. Sections 1 and 2 are closed and need
nothing. Sections 4 and 5 have not opened.

What happened between board 26 and the crash, read from the crashed session's
transcript. The round 3 fix round returned and was verified: the canary lane
58/58 exit 0 and the size ratchet 98/98 exit 0, both on that session's own runs.
The operator ruled the error column: it carries only the part of the one
failure list the run actually failed at, which is the option already built, and
the amendment in the block above now says so. The operator suspended whole-suite
runs for the rest of this plan, also recorded above. Round 4 ran one lens at the
section's own tier and returned no Critical, one Major and seven Minors, and it
did not re-raise the ruled column. The Major was confirmed at the code: the
one-home sweep's control was planted with the pattern's own identifiers, and two
deliberate four-pass copies at memq.js's own sanitizer and failure renderer sit
outside what the sweep claims. One Minor stayed a claim and went to the Minor
list, which now holds 80 entries. One Minor was upgraded on its consequence: the
three refused legs stood down before writing the publish run row. The lock wedge
where a lock file's time sits ahead of the clock was routed out to the backlog,
since it is memq's own lock and not this section's work.

The round 4 fix round was dispatched at 20:00Z and died with its parent. Its
transcript shows items 1, 4, 5, 6 and 7 edited and item 2 half done: the tail
run-row write and two of the three refused legs were changed, and the edit to
the removal leg was never written. Item 3 was not started and no lane ran. Both
source files parse. The round count on the rebuilt drain stands at four, and
the fix round is not a round, so the backstop declares at the adjudication of
round five if that round leaves the terminal condition unmet.

Live dispatches at this boundary: one implementer at the section's own tier,
asked to verify the five landed items against their brief, finish item 2's
removal leg and item 3, and run the memory-database, memq-grant and memq lanes.
The brief is the dead implementer's own, with only the claim identity changed.

The queue. The operator's arm named this plan and three more: goal-fit,
test-requirement-axis and prose-register. The three are committed on main after
this branch was cut, so the arm refused them and this plan alone is armed. They
are not merged in here, because that would carry unrelated commits into this
plan's pull request. At this plan's finishing pass, the session cuts a branch
off main in this checkout and re-arms the three with the self-armed flag, on the
operator's typed arm of 2026-09-18 in this session.

Rulings adopted since the last boundary: the error column ruling and the
whole-suite suspension, both the operator's and both in the block above.

Next action per section. Section 3 owes this fix round's return and its
verification, round 5, the Minor close pass at 80 entries, the host install on
the virtualization host, the close gate and Chapter 3. Then sections 4 and 5,
then the finishing pass.

### Interim board 28 - 2026-09-18

Section 3 is stopped on the review-round backstop at the adjudication of round
five on the rebuilt drain. This is the backstop's first firing on the rebuilt
drain, at its opening bound, since the redesign ruling restarted the count. The
round count as it stands is five.

The round 4 fix round returned DONE_WITH_CONCERNS and was verified in this
session, each lane run alone under the heavy-process claim at about 20:31Z on
the main checkout with the section's uncommitted delta in place:
memory-database 87/87, memq-grant 54/54, memq 715/715 and hook-canary 58/58,
each exit 0. Size-ratchet read 97/98, exit 1, on the new test file past its
cap. That cap was raised from 4760 to 4873 and no other entry moved. The
ratchet's confirming run is owed and waits on a foreign heavy-process claim.
The implementer's two concerns were accepted. A stand-down's error column
carries the refusal sentence alone, since the run printed nothing else. The
recordRun closure is the old tail write moved up so the three legs reach it.

Round 5 ran one adversarial lens at opus, high effort, through the Workflow
route. It returned no Critical, three Majors and eight Minors, and the tree was
unchanged across the round. All three Majors were confirmed on this session's
own surface, and all three trace to section 3's text, so all three are
spec-traceable. None sits in lines a fix round wrote and none repeats an earlier
round's class, so neither the design stop nor the tier ladder fires.

- Major 1: usp_ListRecords returned another sandbox's promoted project rows,
  keyed on tier, segment and file key alone. The publisher could then embed its
  own body under the other sandbox's record id. This one crosses a sandbox
  boundary, so it is held to the security bar and was fixed before the
  declaration. The fix filters those rows in 045-usp_ListRecords.sql with the
  predicate usp_AppendUsage already uses, and it adds a live case to
  test/memory-database-install.test.js. Its red-first run and lane are owed and
  wait on the heavy-process claim. Its delta touches SQL, so it owes a review
  round, and that round is owed and unrun: it is taken first on the re-arm.
- Major 2: callProcedure wraps every call as INSERT INTO ... EXEC. A runtime
  error inside a procedure run that way, such as a conversion failure or a
  constraint violation, dooms the transaction. The delivered CATCH then rolls
  it back, which raises Msg 3915 and replaces the server's own error text. A
  hand-raised THROW 50000 leaves the transaction committable, and its text
  passes through. This session's first probe placed a ROLLBACK after a plain
  THROW, which is not the delivered shape, and overstated the finding. The
  consultant's probes on the local instance separated the two cases. It is
  frozen by the backstop.
- Major 3: a failed spool append returns false and all three callers discard
  it, so a stamp is lost with nothing printed or counted. It is frozen by the
  backstop.
- Majors 4 and 5, upgraded from round 5 Minors because each states a failure
  scenario ending in a lost stamp. In clearSpool, a kept torn piece with no
  newline is written back with the next line glued onto it. Also in clearSpool,
  the write-back runs before the holds() check, so a failed check leaves a
  mid-line fragment as a permanent malformed line, and every later publish
  exits non-zero. Both sit in drain code. They are frozen by the backstop.

The other six Minors went to the Minor list, which now holds 86 entries after
the two upgrades were taken off it.

Pre-declaration steps. The expert ask went to KIT: Expert, and the Expert
answered from existing sources. The house sql-style's transport is a labeled
result set read directly, not INSERT-EXEC and not an OUTPUT parameter
(skills/sql-style/references/sql-style.md:136, :177, :194 and :230, and
SKILL.md:104, verified in this checkout). The precedent for reporting a lost
silent write is a durable state file that the next run reports: the sync state
file that doctor/sync-store.ps1 writes and memory-session.js reads. The Expert
reported a known defect in that precedent, which is that the marker must be
written on success as well as on failure. Neither answer settles whether the
section continues, so the declaration still stands.

The consultant ruled to continue rather than reshape. The rebuilt drain has
converged, and its own findings this round were the two clearSpool items. The
three original Majors sit in code the rebuild never touched, or, in Major 3's
case, a false answer the rebuild's fix rounds wrote and never wired to a
caller. The adopted fix shapes:
- Major 2: keep the INSERT-EXEC transport. The swap would falsify the
  prespecified declined-ids contract and the 8000-character reason the list
  answers one row per record. Change the CATCH in usp_UpsertRecords,
  usp_UpsertEmbeddings, usp_AppendUsage, usp_AppendOutcomes and
  usp_UpsertIndexOrphans so that it rolls back only a transaction it opened,
  then rethrows. Add one live refusal case red first. 040, 050 and 090 fold into
  the Files in scope on board 22's predicate, recorded as approval drift.
- Major 3: deliverStamp returns deliver's answer. touch and log each print one
  stderr sentence on a lost append and still exit zero. The read stamp and the
  hook stay silent, and the two false comments are corrected. The durable
  counter is refused, since it is the aside-file class the minimal-drain
  amendment bars. The expert's precedent carries the defect the expert
  reported.
- Majors 4 and 5: fixed in the same round.

Live dispatches at this boundary: none.

Next action. The BLOCKED goes to the operator with this analysis. On a
continue, run the owed round over the Major 1 fix first, then one fix round for
Majors 2 to 5 as above.

Pending merge. The expert's hook-dispatcher work is pushed at anchor 25ed38ac
on origin/feat/hook-dispatcher, draft pull request 64 against main. It leaves
kit-compact-lib.js untouched. It overlaps this branch in test/size-budget.json
and test/hook-canary.test.js. The merge waits until pull request 64 lands on
main and section 3 is committed, and then comes in with main. After it, re-run
`kit-size.js sync` over the changed paths rather than hand-resolving caps, and
rebuild before trusting hook-canary, whose stale-stamp red is the build stamp.

### Interim board 29 - 2026-09-18

Section 3, stage: the file spool is retired by operator ruling and the local
queue is being rebuilt on SQLite. Two rulings were adopted this boundary and
both are recorded under Standing Brief Amendments. The first pivots the queue
from a JSONL file to a SQLite file at the store root, opened through Node's
built-in node:sqlite, with one table keyed on the stamp id and a drain that
deletes by id. The second fixes the section's review terminus in advance: the
round five backstop drops the local queue and ships the section rather than
declaring a blocker, with a one-line operator status at the close of round
three. Both reached this session through the Expert seat from the operator's
Discord channel, and each record marks which sentences are the operator's own
words and which are the Expert's reading.

Confirmed on this box this turn, by this session's own run: Node v24.19.0
loads node:sqlite with no flag and round-trips a row through DatabaseSync. The
Expert's 2000 millisecond busy-wait reading is reported rather than confirmed
here.

Live dispatches at this boundary, both implementer-opus, both dispatched after
the rulings landed:
- The SQLite queue rebuild, over memory-database.js, memq.js's three stamp and
  outcome writers, hooks/memory-usage-stamp.js and test/memory-database.test.js.
  It also carries the adopted fix shape for round 5's Major 3, the failed
  append whose false answer every caller discarded.
- The procedures' CATCH fix over 040, 050, 060, 070 and 090, which today hide
  the server's own error text behind Msg 3915 on a runtime error inside
  INSERT-EXEC, plus the owed red-first run for Major 1's sandbox leak fix and
  its live case in test/memory-database-install.test.js.

The two dispatches hold disjoint files. Neither has reported.

Gate baseline: unchanged from Interim board 28. No lane has run since.

Owed and unrun, carried from board 28: the review round over the Major 1 fix,
which is folded into the second dispatch's own red-first work rather than
taken separately, since that fix is unchanged and its test now runs.

Next action per section. Section 3: await both dispatches, adjudicate their
diffs, run round 1 of the rebuilt queue's review, then the Minor close pass at
86 entries, the host install, the close gate on the targeted lanes, the stamp
sweep and Chapter 3. Sections 4 and 5 follow, then finishing.

Commit Model: Branch-and-PR.

### Interim board 30 - 2026-09-18

Section 3, stage: the SQLite queue is built and its first review round is
adjudicated, and two fix dispatches are in flight. The file spool is gone.

Round 6 covered the procedures' delta: the CATCH fix in 040, 050, 060, 070 and
090, and Major 1's sandbox leak fix in 045 with its owed red-first run, which
this round discharges. The implementer proved the defect on its own probes,
first in tempdb and then against the real procedure: the delivered handler
answered "Msg 3915 ... Cannot use the ROLLBACK statement within an INSERT-EXEC
statement" where the fixed one passes the server's own "Msg 42204, The vector
dimensions 1024 and 3 do not match". Major 1's case failed first against the
pre-fix predicate with NEO's shared project row reaching SCOTT's inventory.
Its final live run read 37 tests, 37 pass, 0 fail, exit 0. Three lenses read
the delta at fable. No Critical. One Major, from the blind lens, confirmed by
this session at 030-udf_VisibleRecords.sql:48-51 and
050-usp_UpsertEmbeddings.sql:146-151: the new tenancy rule reached the reader
and not the embedding writer, so a publisher holding another sandbox's record
id, which usp_Search hands out, can still attach its own vectors to that
record. It is a security finding and is in a fix dispatch rather than parked.
The security lens rated the same defect a minor and returned CLEAR otherwise.
The adversarial lens returned no Major. One style slip was fixed inline: 045
had rewritten its v1.0 header note in place, and now carries a v1.1 note above
the restored v1.0 text with VERSION bumped to match.

Round 7 covered the SQLite queue: memory-database.js, memq.js's three writers,
the read-stamp hook and the two test files. The implementer found and fixed a
leaked database handle on the damaged-file path before reporting, and proved
its own tests can fail by running five mutants against a scratch copy of the
tree rather than mutating the shared worktree, a peer agent being live in it.
This session re-ran its lane: 76 tests, 76 pass, 0 fail, exit 0, read from the
run's own exit code. Three lenses read it at fable. No Critical. One Major,
raised by the blind lens and seconded by the adversarial lens as a minor, and
upgraded here on that agreement: queueBusy compares the SQLite error code to 5
exactly, while the library reports extended codes, so a busy machine reads as
a fault and the verb exits non-zero. This session's own probe confirms the
plain contended case reports errcode 5 and code ERR_SQLITE_ERROR, so the
comparison holds today; the extended variants could not be provoked here and
stay reported rather than confirmed. Seven minors ride with it in the same fix
dispatch, the sharpest being the read-stamp hook inheriting the queue's
two-second busy wait against its own few-hundred-millisecond budget. The
security lens returned CLEAR: no SQL built from data, the password on no
surface, and the drain unable to delete a row it did not deliver.

Live dispatches at this boundary, both implementer-opus and both in flight:
the embedding writer's tenancy fix over 050 and the install test, and the
queue's fix round over the five queue files.

Gate baseline: test/memory-database.test.js 76/76/0 exit 0 and
test/memory-database-install.test.js 37/37/0 exit 0, both read from their own
runs this boundary. No whole-suite run, which the operator's amendment
suspends.

Size budget: caps resynced from the files themselves rather than by hand.
test/memory-database-install.test.js raised to 1959, test/memory-database.test.js
lowered to 4050, test/memory-session.test.js lowered to 3456. A resync is owed
after the two fix dispatches land, since both grow a capped file.

The minor list holds 226 lines. One entry leaves this plan rather than the
list: docs/security-model.md describes no part of this database, and section 5
owns the docs.

Next action per section. Section 3: adjudicate both fix dispatches, take the
round each fix delta owes, then the Minor close pass, the host install, the
close gate on the targeted lanes, the stamp sweep and Chapter 3. Sections 4
and 5 follow, then finishing. The armed queue now carries four plans behind
this one, appended by the operator on the relay channel: goal-fit,
readonly-guard-glued-shorthand, test-requirement-axis and prose-register. The
three the operator named that were authored on main after this branch was cut
were carried onto this branch at 3a3a6b39 so the leash could name them.

Commit Model: Branch-and-PR.


### Interim board 31 - 2026-09-19

Section 3, stage: the review loop has ended and the Minor close pass is in.
What remains is the host install, the close gate and Chapter 3.

Round 9 read the two fix dispatches as one delta, captured at
`.kit/scratch/memory-database/3/fix-round-9.diff`, 996 lines over six files.
One adversarial lens at opus and high effort through the Workflow route, the
writer tier being opus. No Critical. Two Majors, both addressed without a code
change, so the round's own fix delta owes no further round and the loop's
terminal condition is met.

The first Major was the size caps, confirmed on this session's own reading of
`kit-size.js report`: `test/memory-database.test.js` at 4286 lines against a
cap of 4050, `test/memory-session.test.js` at 3465 against 3456, and the
aggregate test-line cap over besides. Discharged by resyncing the caps from the
files, which the verb refused to do in its bare form over an uncommitted budget
edit and took once the changed files were named. Caps now read 4322, 3465 and
1965, and `test/size-ratchet.test.js` runs 98 tests, 98 pass, 0 fail, exit 0.

The second Major held that the queue's new 250 millisecond writer budget makes
a silently dropped stamp eight times likelier, because the drain holds the
write lock across one delete per delivered row. The lens offered three
remedies. Chunking the delete is barred: the operator's ruling names batching
among the machinery this section had already removed twice. So the premise was
measured rather than argued, by a probe mirroring `deleteRows` at
`.kit/scratch/probe/delete-hold.js`. The lock hold is 1.9 milliseconds at a
thousand queued rows, 8.9 at five thousand, 104 at twenty thousand and 249 at
fifty thousand. A writer on the 250 millisecond budget therefore loses a row
only at tens of thousands of undelivered stamps, which is a host unreachable
long enough that the doctor's publish age has been the loud signal for weeks,
and the local journal holds the stamp either way. The remedy taken is the
lens's own first option: the constant now carries that hold-against-depth
property as its justification and names lowering the depth, rather than
lengthening the wait, as the lever.

Ten Minors from that round joined the list, which the close pass then took.

The close pass, one implementer-opus dispatch over 90 entries and 18 round
headings, returned 16 fixed, 21 moot, 30 already fixed and 27 left. The moot
group is the two operator-ordered rebuilds landing: the file spool's removal
and the drain redesign's removal of rotation, an aside file, per-line put-back,
a leftover pass, batching and lock-staleness arithmetic. Each was confirmed
absent by a predicate run first against a planted control, and the pass states
its own limit, that those sweeps name a list of members rather than covering
the class structurally, with the structural sweep already living in the suite.

One site the pass found, flagged and left because no entry named it: the
publish summary line claimed a rejected queue row was "off the queue with no
row on the host", which is false whenever a later failure stops the delete.
That is the same false-claim class the pass had just fixed at
`memory-database.js:2246`, so it took the fix plus a sweep of the class rather
than a single repair. The line now reads "so no row on the host holds them",
with the test literal moved with it. The sweep ran a deletion-claim predicate
over the client, memq and the read-stamp hook against a planted control that
spoke; three matches, all read, all conditional or naming intent.

Gate: `test/memory-database.test.js` 82 tests, 82 pass, 0 fail, exit 0, and
`test/memory-session.test.js` 86 tests, 86 pass, 0 fail, exit 0, both re-run by
this session after the close pass and read from their own exit files, against
a baseline of 82/82/0 and 86/86/0 on the same lanes. No case was retired, so no
count moved; the two retirements were assertion legs inside surviving cases.
`test/size-ratchet.test.js` 98/98/0 exit 0. No whole-suite run, which the
operator's amendment suspends until finishing. Measured on this worktree with
the section's work uncommitted and the two kaizen note files dirty from other
work.

Live dispatches: none. Both fix dispatches and the close pass have reported.

Carried to the host install, which is the next act and the only place they can
be settled: the guarded drop of the fleet-wide stamp id index, which four
lenses raised and none could answer without a host; the install lane's
re-added `/vector dimensions/i` assertion beside `Msg 42204`, which the close
pass added on the round's word and could not run; and the writer screen's
alignment with the two append procedures, which rests on reading their THROW
conditions rather than on a live refusal.

Routed out of this plan since the last boundary, into `docs/backlog.md`: the
rule that a shared project record is visible but not this publisher's to write,
now hand-spelled in two procedures, whose repair is a schema change rather than
a close-pass fix.

Open for the operator, carried rather than asked, since neither blocks the
close: the non-regular-file guard on the queue's open, where the shared
boundary's guard is private to memq and an existing load pin bars the database
client from importing memq, so reuse needs a third home rather than an export;
and the schema-version gate's placement ahead of the publish lock, which the
close pass escalated as above a close-pass act.

Next action per section. Section 3: the host install on the operator's word
that the instance is up, then the close gate on the targeted lanes, the stamp
sweep and Chapter 3. Sections 4 and 5 follow, then finishing, which owes the
one whole-suite run. The armed queue carries four plans behind this one:
goal-fit, readonly-guard-glued-shorthand, test-requirement-axis and
prose-register.

Commit Model: Branch-and-PR.

### Interim board 32 - 2026-09-19

Section 3 is materially done and proven live on the host. Section 4's review
round 1 is adjudicated and owes a fix round.

**The host gate opened.** The operator's word that the instance is up reached
this session on 2026-09-19 on the relay Discord thread, which is what Standing
Brief Amendment 44 requires, and a second message the same day said the host was
fully installed. That second claim was checked rather than taken: the host read
back schema version 1 against this checkout's 2, with `mem.usp_ListRecords`
absent and the `StampId` column missing from both `mem.Usage` and `mem.Outcome`.
The host had section 2's install and none of section 3's.

**The install ran and section 3's acceptance is met live.** The installer applied
33 scripts, 10 changed, exit 0, moving the host from schema version 1 to 2. Read
back afterwards: version 2, `usp_ListRecords` present, both `StampId` columns
present. The logins file was not rewritten because every login was already
present, so the passwords the operator hand-carried to the other two sandboxes
are untouched, which `Security/020-Logins.sql` guarantees by guarding each
`CREATE LOGIN` on `IF NOT EXISTS` with no `ALTER LOGIN` anywhere.

The client config was then moved off the `kit_deploy` sysadmin login to
`kit_scott_claude`, with the curator pair added, which is the rewrite the
Approach paragraph assigns to the executor. The previous file is backed up beside
it. Publishing as the deploy login would have resolved no sandbox at all, since
`mem.CallerSandbox()` reads `ORIGINAL_LOGIN()`.

Two `memq db-sync` runs then proved both halves of the acceptance bullet. The
first published 1040 records and embedded 1040, drained the one queued stamp and
reported 6 index orphans. The second reported 0 added, 0 changed, 1040 unchanged,
0 embedded. Both exited 1 on one condition, and it is a store condition rather
than a defect: `goal-and-loop-transcript-shapes` exists in the operator tier both
live and archived, and those two files share a store key, so the client reports
the pair and sends neither by the deliberate design recorded at
`memory-database.js`'s `collectRecords` banner. It is the operator's to resolve
in the store.

That the tenancy model is real was confirmed by accident: a probe script that had
been reading `mem.QueryLog` directly under `kit_deploy` now fails with SELECT
permission denied under the publisher login, which is the execute-only rule
working.

**Still open on the host, and the operator's:** `kit_deploy` is still present, and
Operator Verification says the plan does not close while it exists.

**Section 4 round 1.** Dispatched at fable against base `317a56b8`, the delta
captured at `.kit/scratch/memory-database/4/fix-round-1.diff`, 2077 lines over
seven files. Three lenses ran, the security lens triggered because the delta
constructs SQL, spawns a process and crosses an external boundary. No Critical.
Six Majors and eleven Minors.

Five Majors are owed and enter the fix round.

1. The operator-tier dedupe key mismatch, raised independently by the blind and
   adversarial lenses and confirmed here from the publisher's own source:
   `tierIdentity` publishes the operator tier with a null segment
   (`memory-database.js:2013`), so a host row returns segment null, `queryHit`
   maps it to the empty string and `fleetHit` keys the record on it
   (`memq.js:6091`), while every local reader keys the same record on
   `OPERATOR_LABEL` (`memq.js:405,5846`). An operator record already printed in
   the lexical block prints again in the fleet block. A judgment sidecar
   challenged this reading and the re-check strengthened it rather than thinning
   it.
2. The query side applies no store-root gate, raised by the security lens and
   mapped to OWASP A01 with SOC 2 CC6.1 and CC6.6. Every other host-reaching leg
   refuses a redirected root, `recall` sits in the fleet grant, and an unattended
   worker on a redirected store would therefore pull this machine's private
   records into its context. A security Major takes the fix-before-close route
   whatever else holds.
3. The fleet search block asks the host for exactly its display cap and then
   removes rows on this side, so it under-fills silently where the local channel
   would have filled.
4. `runHookTimed` in `test/memory-session.test.js` inherits the real home, so on
   this machine the suite reaches the live host and renders real record
   descriptions into a pinned case. The implementer fixed this leak for one
   sibling helper and missed this one.
5. The neighbours race's signal is not carried into the fleet path, so abandoned
   work keeps spawning after the block has printed.

The sixth Major is held rather than fixed. The adversarial lens reports that a
reachable host replaces the local index rather than merging with it, so a record
written this session is invisible to the write-time neighbours check until the
next publish. Its own trace field reads none, and the lens says plainly that the
spec asked for the route, so the provenance read puts it at new-requirement. It
goes to a judge rather than into a fix round, and the section continues on every
other finding meanwhile.

Eleven Minors are on `.kit/scratch/memory-database/minors-section-4.md` for the
close pass.

**Gate.** Section 4's first-green state is committed at `fc516992`. Lanes re-run
by this session from their own exit files, on this worktree with the two kaizen
files dirty from other sessions: `test/memory-database.test.js` 93 tests, 93
pass, 0 fail, exit 0; `test/memory-session.test.js` 87/87/0 exit 0;
`test/memq.test.js` 730/730/0 exit 0. Baselines on the same lanes were 82, 86 and
715 passing, so every delta is a new case and nothing regressed. No whole-suite
run, suspended by the operator until finishing.

**Live dispatches:** none. The section 4 implementer and all three reviewers have
reported.

**Declared, and the operator's to overturn.** The implementer reached the live
host once by accident while smoke-testing the session hook, which wrote one
`mem.QueryLog` row. It is reported rather than buried, and it is also what
surfaced Major 4.

**Next action per section.** Section 4: the fix round over the five owed Majors,
the judge on the held one, then the Minor close pass, the docs and the size cap,
then the close gate and Chapter 4. Section 3: Chapter 3, which can now name the
operator's message of 2026-09-19 on the relay thread as Amendment 44 requires.
Section 5 follows, then finishing, which owes the one whole-suite run. The armed
queue carries four plans behind this one: goal-fit,
readonly-guard-glued-shorthand, test-requirement-axis and prose-register.

Commit Model: Branch-and-PR.

### Chapter 3 - 2026-09-18

Completed: 3. The publisher and the spool

Implemented By: implementer-opus across the section's build and fix dispatches, with one consultant at fable ruling on the first dispatch's NEEDS_CONTEXT and the scope-adjudicator ruling each design stop. No tier escalation: every failed round returned findings rather than a repeating Critical class, so the ladder never fired.

Metrics: review rounds 22 across three builds of the same section (8, then 5, then 9, each build restarting the count on the operator's ruling that opened it), closed major-closed; provenance is recorded per round rather than as one aggregate, in interim boards 7 through 31 above, each of which from board 19 onward carries its own round's Provenance paragraph, and this Chapter does not restate a total it did not measure; rulings 4 design stop rulings recorded, 3 accept-and-declare and 1 refuse, plus 3 review-round backstop firings; NEEDS_CONTEXT 1; escalations 0; consults 2.

Decisions / Surprises: the section was built three times and the third build is what shipped. The first build spooled stamps to a text file and took eight review rounds; the second rebuilt the drain alone and took five; the operator then ruled the file the wrong shape outright, on 2026-09-18 relayed by the Expert seat, and the queue became a SQLite table opened through Node's built-in `node:sqlite`, which took nine more. Amendment 55 records that ruling and its table shape. The surprise worth carrying is what each rebuild cost and why: a text spool's failure modes are all about partial reads and put-backs, and every round invented another guard for one, while a row either exists or does not. Three of the five design stops were on the drain's own mechanism.

Two rulings changed the database itself rather than the client. A consultant at fable ruled that an execute-only publisher cannot learn a record's id, cannot learn which records carry no embedding for the current model, and cannot learn which of its own file keys the host still holds, since `DENY SELECT` covers every table and no delivered procedure answered any of the three. `mem.usp_ListRecords` was added on that ruling, and this session confirmed its three cited facts against the delivered scripts before adopting them. A scope-adjudicator later refused the drain's two-list reporting design, on the ground that nothing in the Goal, the acceptance or the Tests line asks for a cause vocabulary; the operator continued the section and kept the exit code, since what the judge refused was the split rather than the failure signal. Amendment 54 records the form that survived.

The host install is this Chapter's own act rather than a dispatched one, and Standing Brief Amendment 44 gates it. The operator's word that the instance is up reached this session on 2026-09-19 on the relay Discord thread, which is the message that amendment requires this Chapter to name by date and channel. A second message the same day said the host was fully installed. That claim was checked rather than taken, and it was wrong in a way that mattered: the host read back schema version 1 against this checkout's 2, with `mem.usp_ListRecords` absent and the `StampId` column missing from both `mem.Usage` and `mem.Outcome`. The host carried section 2's install and none of section 3's.

The installer then applied 33 scripts, 10 changed, exit 0, moving the host to schema version 2. Read back afterwards: version 2, `usp_ListRecords` present, both `StampId` columns present. The logins file was not rewritten, because every login was already there, so the passwords the operator hand-carried to NEO-CLAUDE and ASR-CLAUDE are untouched. `Security/020-Logins.sql:35-39` is what guarantees that: each `CREATE LOGIN` is guarded on `IF NOT EXISTS` and there is no `ALTER LOGIN` anywhere in the tree.

The client config was then moved off the `kit_deploy` sysadmin login to `kit_scott_claude` with the curator pair added, which is the rewrite the Approach paragraph assigns to the executor. The previous file is backed up beside it at `~/.claude/kit-memory-db.json.bak-pre-s3-install`. Publishing as the deploy login would have resolved no sandbox at all, since `mem.CallerSandbox()` reads `ORIGINAL_LOGIN()`. That the tenancy model is real was then confirmed by accident: a probe script that had been reading `mem.QueryLog` directly under the deploy login now fails with SELECT permission denied under the publisher login, which is the execute-only rule working.

Two `memq db-sync` runs proved both halves of the acceptance bullet live. The first published 1040 records and embedded 1040, drained the one queued stamp and reported 6 index orphans. The second reported 0 added, 0 changed, 1040 unchanged, 0 embedded. Both exited 1 on one condition, and it is a store condition rather than a defect: the record `goal-and-loop-transcript-shapes` exists in the operator tier both live and archived, and those two files share one store key, so the client reports the pair and sends neither, by the design its `collectRecords` banner states. Resolving it is the operator's, in the store.

Two things are open and both are the operator's. `kit_deploy` is still present on the host, and Operator Verification says the plan does not close while it exists. And the duplicate `goal-and-loop-transcript-shapes` needs deleting or renaming.

Dates in this document are not on one clock. Interim boards 31 and 32 carry 2026-09-19 because they were dated from UTC; this Chapter and the two before it carry the local date, which is what the commit timestamps use.

Assumptions: none beyond the plan's own.

Review Findings: 22 rounds' findings are dispositioned; the per-round record is in interim boards 7 through 31 above and the verdict files under `.kit/scratch/memory-database/3/`. The terminal condition was met at round 9 of the third build: no Critical, two Majors, both addressed without a code change, so that round's fix delta owed no further round. Both were addressed by measurement rather than by argument. The first was the size caps, resynced from the files after `kit-size.js report` confirmed three roots over. The second held that the queue's 250 millisecond writer budget makes a dropped stamp eight times likelier; a probe mirroring `deleteRows` measured the lock hold at 1.9 milliseconds at a thousand queued rows and 249 at fifty thousand, so a writer loses a row only at tens of thousands of undelivered stamps, which is a host unreachable long enough that the doctor's publish age has been loud for weeks. The constant now carries that hold-against-depth property as its justification. Minors: 90 entries and 18 round headings went to one close pass, which returned 16 fixed, 21 moot, 30 already fixed and 27 left with reasons; the moot group is the two operator-ordered rebuilds landing. That pass states its own limit, that its sweeps name a list of members rather than covering the class structurally, with the structural sweep already living in the suite. Four design stop rulings were adopted, three accept-and-declare and one refuse; the refuse is the one amendment 54 records, where the adjudicator struck the drain's two-list reporting design because nothing in the Goal, the acceptance or the Tests line asked for a cause vocabulary. `blind: ran` on every full round; the decayed rounds ran one adversarial lens at the writer's tier through the Workflow route.

Stamps: adjudicated 14, stamped 0. The window is the 33 hours since Chapter 2's commit at `fbedb248`, read with `memq unstamped --since 33h`. One project-tier and thirteen operator-tier records carry a read stamp inside it and no applied stamp. None changed what this section built: the section's own work was driven by the review rounds and the operator's two rulings, and the records in the window are about peer messaging, process liveness and environment facts that bore on how the work was run rather than on what it produced. Two of the thirteen were read minutes ago by the Expert seat answering an ask for section 4, not by this session.

Gate: the targeted lane, run by this session at section 3's close and read from the runs' own exit files. `test/memory-database.test.js` 82 tests, 82 pass, 0 fail, exit 0. `test/memory-session.test.js` 86 tests, 86 pass, 0 fail, exit 0. `test/size-ratchet.test.js` 98 tests, 98 pass, 0 fail, exit 0. Baselines on the same lanes were 82/82/0 and 86/86/0, so no count moved and nothing regressed; the two retirements in the close pass were assertion legs inside surviving cases rather than cases. Measured 2026-09-18 on this worktree, SCOTT-CLAUDE, with the section's work uncommitted at the time and `kaizen/notes-ASR-CLAUDE.md` and `kaizen/notes-SCOTT-CLAUDE.md` dirty from other sessions. No contention was held during the run. No whole-suite run: the operator's word of 2026-09-18, recorded as amendment 59, suspends it until the finishing pass. The contention lane did not run; the section's delta touches the host and the store rather than machine-shared test state, and the host acceptance above is the real-run evidence a green suite cannot give.

Next: 4. The query side

Commit Model: Branch-and-PR

Delta: measured 2026-09-18 on this worktree at `cb342adf`, SCOTT-CLAUDE, with section 4's built-and-uncommitted work in the tree and the two kaizen files dirty from other sessions. Both caps below read over, and that is section 4's owed raise rather than section 3's regression: the two figures grew when section 4's code and tests landed, and section 3 closed with `test/size-ratchet.test.js` green at 98/98/0 above.

```
repository: claude-kit
words: 853365 of cap 853289 across 86 curated files
test lines: 123193 of cap 122341 across 64 test files
tests: 3548
changed paths under no measured root: 2 (2 differing from HEAD, 0 untracked), which this tool does not measure and which no row above names; named-exclusion paths in the changeset: none
```

### Interim board 33 - 2026-09-18

Section 4, the query side, stands at step 4 and is held. The judge ruled ASK on the section's one new-requirement Major, so steps 5 through 8 do not run for this section until the operator answers. Sections 1 through 3 are closed, Chapter 3 committed and pushed at `40bc8455`.

Live dispatches. `implementer-opus` (`a5b7ef0d32493cff1`) was asked to fix the five owed Majors of round 1 over the query side's own files; it is live and writing at this entry, read from its transcript rather than from a notification. The `consultant` (`a531ab92918366fe4`) was asked to rule on the staleness fork and returned RULED. The `scope-adjudicator` (`a63484347361bf153`) was asked to rule on the held Major and returned BUCKET: ASK. Both are finished.

Gate baseline: measured 2026-09-18 on this worktree, SCOTT-CLAUDE, with section 4's work uncommitted and `kaizen/notes-ASR-CLAUDE.md` and `kaizen/notes-SCOTT-CLAUDE.md` dirty from other sessions, no contention held during the runs. `test/memory-database.test.js` 93 tests, 93 pass, 0 fail, exit 0. `test/memory-session.test.js` 87 tests, 87 pass, 0 fail, exit 0. `test/memq.test.js` 730 tests, 730 pass, 0 fail, exit 0. The lane baselines were 82, 86 and 715 passing, so all three lanes grew and none regressed.

Review-round backstop stage: section 4 has taken one review round, so the backstop has not fired and the count stands at 1 of the opening bound.

The held finding, in plain words. The plan's Goal says the semantic search is served from the shared database with the local index as the fallback. Section 4 also routes a second surface that way, the duplicate check that runs just before a memory is written. A reviewer held that this second surface should not be served from the database alone, because the database only knows what this machine last published to it, and nothing republishes during a session. So the check can miss a near-duplicate written minutes earlier and let a duplicate record through. The judge ruled that the plan's acceptance bullets do ask for the route but that nothing in them asks for the staleness disclosure, and that the call is the operator's.

The consult's ruling, adopted as a recommendation and not yet as an amendment. The consultant ruled that the two surfaces take different remedies, and that the framing that they should share one was the wrong part of the question. For the write-time duplicate check, run the local scan beside the database one and print both as two labelled blocks, deduplicated on record identity through the `alreadyShown` set that path already takes, with no score merging. For the ordinary search and the decay scan's pairs, disclose the age instead, since the last-publish time is already on the wire.

That ruling's EVIDENCE was checked on this session's own surface before this entry was written. `usp_Health` returns `lastPublish` per sandbox scoped to the caller (`plugins/claude-kit/db/Procedures/160-usp_Health.sql:40` and `:111`). `probeHost` calls that procedure (`plugins/claude-kit/scripts/memory-database.js:972`) and the query path calls `probeHost` (`:1133`). No `lastPublish` appears anywhere in that file, so the value is fetched and dropped, which is what makes the disclosure free. `alreadyShown` is a real parameter of `localSemanticChannel` honored at `plugins/claude-kit/scripts/memq.js:6575`, so the dedupe seam exists. And `FLEET_SERVED_NOTE` is pinned by identity in three assertions in `test/memq.test.js`, which a change to its shape would move. The consultant's own line numbers are stale against this tree because the implementer is mid-write in `memq.js`; the substance was re-checked at this tree's own coordinates rather than adopted at the cited ones.

No Standing Brief Amendment is written from that ruling yet. The mechanism it prescribes is the very thing the judge routed to the operator, so adopting it here would pre-empt the answer this section is held for.

One preference survives the ruling, and it is what the declaration carries: whether the ordinary search should also run the local scan beside the database one, buying same-session recall by meaning at the cost of loading the local model on every search. The consultant recommends no.

Next action per section. Section 4 waits on the implementer's fix round to return, then on the operator's answer to the held finding. After that answer: the Minor close pass over the 11 entries in `.kit/scratch/memory-database/minors-section-4.md`, the main thread's docs work (`docs/architecture.md:153`, `docs/README.md:15`, and retiring the 2026-09-08 reconcile item at `docs/backlog.md:44`), the size-budget raise both caps now need, the close gate, and Chapter 4. Section 5 follows.

### Interim board 34 - 2026-09-18

Section 4, the query side, stands at step 4 with round 2 adjudicated and is held. Two decisions now wait on the operator rather than one. Sections 1 through 3 are closed.

Live dispatches: none. The `implementer-opus` fix round (`a5b7ef0d32493cff1`) returned DONE and its work is committed at `3636d377`. The round 2 adversarial lens ran at opus through the Workflow route (`wk8wib2w0`) and returned. The round's tree-state bracket was captured before and after and shows no delta, so nothing wrote to the tree during the round.

Gate: the targeted lane, run by this session after the fix round and read from the runs' own exit files. `test/memory-database.test.js` 94 tests, 94 pass, 0 fail, exit 0. `test/memory-session.test.js` 89 tests, 89 pass, 0 fail, exit 0. `test/memq.test.js` 735 tests, 735 pass, 0 fail, exit 0. Baselines on the same lanes were 93, 87 and 730 passing with 0 failing, so all three grew and none regressed. Measured 2026-09-18 on this worktree, SCOTT-CLAUDE, with the two kaizen files dirty from other sessions. This machine's heavy-process slot was claimed before the first spawn and released after the last. Contention is named rather than cleared: node processes on this box went from 13 to 17 during the run, and the harness reaped a background watcher because the machine was critically low on memory. No whole-suite run, per amendment 59.

Review-round backstop stage: section 4 has taken two review rounds, so the backstop has not fired and the count stands at 2 of the opening bound.

Round 2 returned no Critical, three Majors and several Minors. Each Major was traced and confirmed against the code before adjudication.

Major 1, the widened ask, is spec-traceable and is dispositioned by the Standing Brief Amendments entry added above in this same changeset. The reviewer was right that the widening is correct and that every other departure from section 4's text in this plan was recorded while this one was not.

Major 2 and Major 3 are both real, both confirmed by reading rather than by report, and both pre-existing to this section's fix delta: they landed with section 3's commit `fc516992` and sit in the function this section edits. Neither is fixed, and both go to the operator, because each remedy is a decision rather than a repair.

Major 2 is that the shared search applies no relevance floor. The local ranking drops any hit below `SEMANTIC_FLOOR` at `plugins/claude-kit/scripts/memq.js:6574`. The shared path at `:6172` through `:6199` applies no floor at all, and the procedure applies none either, its vector candidate lists taking a fixed count ordered by distance with no cutoff. So a search for a term that matches nothing returns up to fifty arbitrary records under a line saying the shared index answered, where the same search on the local index says there are no matches. The reason it cannot simply be fixed on the client is that `100-usp_Search.sql` returns name, tier, sandbox and score and no distance, confirmed by reading its returned column list. So the client holds no similarity to apply the existing floor to. The two remedies are a change to a procedure belonging to closed section 2, or a threshold invented in the fused score's own units.

Major 3 is that the score column carries two different units. For `usp_Nearest` the client derives one minus the distance, which is a cosine similarity. For `usp_Search` it passes through the procedure's fused rank score, which is a sum of terms of one over sixty plus rank, so four lists put its ceiling near 0.066. Both reach the same hit-line composer, which prints two decimal places. A shared-index search therefore prints a score column reading 0.03 and 0.02 where the local block prints 0.71 and 0.64. The same mismatch makes the archived-overlap comparison at `:6188` structurally unreachable, since a fused score cannot reach the 0.30 floor it is tested against.

The held new-requirement Major from round 1 is unchanged and still held. The judge ruled ASK and the consult ruled on the substance. Reading the plan's own text settled the judge's ground: section 4 says the write-time check takes the shared route "with the same fallback to the local index", and a fallback runs only when the host is unreachable, while the acceptance bullets name only `find`, `recall` and session start.

Two surfaces found outside this section's scope. The recall block can under-fill for the same reason the search block did, confirmed at `memq.js:6235`, and is deliberately unfixed because it sits inside the held mechanism. The local ranking reads its cancellation only after the embedder has loaded; that is pre-existing and routes to `docs/backlog.md`, written when the section closes rather than now, so a high-collision shared file is not left dirty across the operator's answer window.

Next action. Section 4 waits on the operator's answers to the two decisions above. After them: the Minor close pass, the main thread's docs work (`docs/architecture.md:153` and `docs/README.md:15` still say eight blocks, and the reconcile item at `docs/backlog.md` is not retired), the size-budget raise, which the reviewer confirms is red on four paths including the memory-system skill, the close gate, and Chapter 4. Section 5 follows.
