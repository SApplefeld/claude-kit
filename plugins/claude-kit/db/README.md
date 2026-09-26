# The shared memory database

The `mem` schema on a SQL Server 2025 host holds every sandbox's published memory records, their embeddings, the usage and outcome journals, and the curation surface. This directory carries the schema as ordered T-SQL scripts, the installer that applies them, and the host probe (`Test-MemoryDatabaseHost.ps1`) that checks a sandbox's connection to the host.

## What the host needs before the installer runs

The operator performs these once on the host; the installer checks the first two and refuses when either is missing.

1. SQL Server 2025 (product major version 17) or newer. The `VECTOR` column type and `VECTOR_DISTANCE` are what the similarity lists run on.
2. Full-Text Search installed on the instance. `mem.Record` carries a full-text index over its description and body.
3. Mixed-mode authentication, so the SQL logins the installer creates can connect.
4. TCP enabled and reachable from every sandbox machine, with a certificate the clients trust, since every client connection encrypts.
5. A login for the installing connection. The installer is run and verified as `sysadmin`, which a first run needs to create the database and the five logins. A later run that finds every login present creates nothing at server scope and touches only the database and the five logins' catalog rows, so a narrower principal may serve it; no narrower principal is verified.

## Running the installer

```powershell
# Against a local instance under Windows authentication, trusting its self-signed certificate.
pwsh -NoProfile -File .\Install-MemoryDatabase.ps1 -Server localhost -Database KitMemory -TrustServerCertificate

# Against the host under SQL authentication. The password is read from SQLCMDPASSWORD and from nowhere else.
$env:SQLCMDPASSWORD = '<the installing login password>'
pwsh -NoProfile -File .\Install-MemoryDatabase.ps1 -Server host.example -Database KitMemory -Login kit_install
```

The installer needs PowerShell 7. Every connection it opens asks for encryption, so no password crosses the wire in the clear.

Parameters:

| Parameter | Meaning |
| --- | --- |
| `-Server` | The instance, as sqlcmd's `-S` takes it. |
| `-Database` | The database to create or upgrade. A plain identifier; anything else is refused before a connection is made. |
| `-WindowsAuth` | The default. The installing connection uses the current Windows account. |
| `-Login` | SQL authentication for the installing connection. The password is read from the `SQLCMDPASSWORD` environment variable, the only route: there is no password parameter, so it never rides a command line or a shell history, and a run with `-Login` and no `SQLCMDPASSWORD` refuses before sqlcmd is spawned. |
| `-LoginsPath` | Where the generated login passwords are written. Defaults to `~\.claude\kit-memory-db-logins.json`. |
| `-TrustServerCertificate` | Accept the server's certificate without validating it. For a local instance with a self-signed certificate; never for the host. |
| `-SqlcmdPath` | Where sqlcmd is, when it is neither at the ODBC client tools path nor on PATH. |

The installer is safe to run again. Every script guards its own creation or is a repeatable `ALTER`, `GRANT` or `DENY`, and the run prints one `Applied <dir>/<file>: changed` or `no change` line per script, so a second run over an installed host reads `0 changed` on its `Summary` line. The reading is a digest of the catalog state the installer owns (objects, columns with their collation and identity, module definitions, indexes with their columns, constraint definitions, principals with their SIDs and permissions, the five logins and their server permissions, the full-text catalog and index, and the sandbox and version rows); a login's password is the one thing it owns that no catalog exposes, so a password change alone reads as no change. It never drops a table and never alters a column type, and it refuses to run when `mem.SchemaVersion` already holds a version newer than the one it carries.

Scripts apply in the directory order `Schema`, `FullText`, `Procedures`, `Security`, `Version`, and inside each directory in the ordinal order of the file names. A new script takes the next free numeric prefix in its directory. `Version` holds one script, the write of the `mem.SchemaVersion` row, and it runs last: that row is what a client reads to decide the host carries this version's columns and procedures, so a run that dies partway through leaves the host at the version it held before and the next run finishes the job.

The two functions under `Procedures/` (`mem.CallerSandbox` and `mem.udf_VisibleRecords`) are dropped and created again on every run, each in two batches, so between the batches every publisher procedure fails with an invalid-object error, and a run that fails on one of those two scripts leaves every procedure failing until the script is repaired and the installer run again. Run the installer while no sandbox is publishing.

## Logins, roles and the sandbox map

The installer creates five SQL logins where absent, each with a fresh random password, and maps each to one database role:

| Login | Role | What it may do |
| --- | --- | --- |
| `kit_scott_claude`, `kit_neo_claude`, `kit_asr_claude` | `mem_publisher` | Execute the publish, journal and read procedures for its own sandbox, and `usp_JevCalibration`, the fleet-wide judge calibration counts. No table access: `SELECT` on the `mem` schema is denied. No server permission beyond `CONNECT SQL`. |
| `kit_curator` | `mem_curator` | Execute the promote and curation procedures and the health report. No table access, no publishing. |
| `kit_review` | `mem_review` | `SELECT` on the whole `mem` schema, including every sandbox's private rows and the query log. Executes nothing. |

`mem.Sandbox` maps each publisher login to its sandbox (`SCOTT-CLAUDE`, `NEO-CLAUDE`, `ASR-CLAUDE`). Every read procedure that returns records resolves the connected login through that table and filters to the caller's own private rows plus every shared row before ranking. A login the table does not name gets no rows, never every row. `usp_JevCalibration` is the one publisher read with no sandbox filter. It counts the judged fleet pointers every sandbox has keyed to a read or an unread, per score band, and returns those counts and no field of any record, so the fleet's hit rate reaches its twenty-row floor as one number. A new sandbox is a new row in `Security/030-Sandboxes.sql` and a new login in `Security/020-Logins.sql`.

A shared row is one row for the fleet, so any publisher can rewrite its body and its vectors and can create the shared stores every sandbox reads. That is the same trust the git sync of the shared tiers extends today, accepted here by design; `mem.Record` records which sandbox last published each row. Publishes serialize on one fleet-wide application lock (`mem.Publish`) held for the length of each batch's transaction, so two sandboxes first-publishing the same shared row queue rather than one failing on the unique key.

Every `usp_Search`, `usp_Nearest`, `usp_ListRecords` and `usp_JevCalibration` call leaves one row in `mem.QueryLog`: the login the sandbox was resolved from, the security context the call ran under, the sandbox, a digest of the query text or vector (for `usp_ListRecords`, which takes neither, a digest of the model identity, and for `usp_JevCalibration` a digest of its day window), and the row count. The digest covers no other parameter, so two search or nearest calls that differ only in their limit, model or archived flag log the same digest. Read it under `kit_review`.

## The logins file

When the installer creates a login, the password exists nowhere but on the server and in this file, so the file is written immediately before the logins script runs, after every schema and procedure script has applied, and is created exclusively: an existing file is never overwritten, and a run that would need to create a login while the file exists stops before touching the server. Its refusal names which of the logins the existing file lists are on the server (their passwords there may be live) and which are not (their passwords there reached no server). Move the file aside and run again.

The file holds `server`, `database`, `created`, and one entry per created login with its `login`, `password`, `role` and `sandbox`. A login already on the server is left as it is, so a later run neither rotates passwords nor rewrites the file. Rotate a password with `ALTER LOGIN` and update the file by hand. A login that is present when the installer reads the server and absent by the time the logins script runs is refused by that script rather than created with a placeholder, and the run fails naming it.

Treat the file as a credential: keep it in the operator's profile, never in a repository, and never paste its `password` values into a chat, a plan document or a log.

## Pointing a sandbox at the host

Each sandbox machine reads its connection from `~\.claude\kit-memory-db.json`, the file the doctor's host probe (`Test-MemoryDatabaseHost.ps1`) also reads. Its `login` is that machine's publisher login, and its `password` field takes the value the logins file holds for that login. The probe prints one `PASS`, `FAIL` or `INFO` line per check (the connection and its login, the server version and full-text service, the vector type, the embedding server, the embedding latency, and the local sqlcmd client tools), exits non-zero on any `FAIL`, and under `-Quick`, the form the doctor runs, skips the latency measurement and prints that skip as `INFO`. The client itself spawns sqlcmd from one fixed path, `C:\Program Files\Microsoft SQL Server\Client SDK\ODBC\170\Tools\Binn\SQLCMD.EXE`, and resolves nothing from `PATH`, so a machine whose client tools sit elsewhere publishes nothing and says so.

The file's keys:

| Key | Meaning |
| --- | --- |
| `server`, `database` | The instance as sqlcmd's `-S` takes it, and the database the installer created. |
| `login`, `password` | This machine's publisher login and its password from the logins file. |
| `embedding.url`, `embedding.model` | The embedding server on the host and the model identity it lists at `/v1/models`. Every vector on the host is stored under this identity. |
| `timeoutMs` | Optional. The clock one boundary call may run on, 1000 to 600000; the default is 10000. |
| `curatorLogin`, `curatorPassword` | Optional, and given together. The `kit_curator` login and its password from the logins file. Only the machine the operator curates from carries them; `memq db-promote` and `memq db-curate` run under this pair and refuse with the two fields named where it is absent. A config carrying one of the two without the other is refused as invalid rather than read as a publisher-only config. |
| `windowsAuth` | Optional, default false. On `true` the client connects as the current Windows account and `login` and `password` are not required, which is the shape the install test lane uses against a machine's own local instance. A fleet config never sets it. |
| `trustServerCertificate` | Optional, default false, admitted only on an exact `true`. Passes `-C` to every spawn, which keeps the link encrypted and drops certificate validation. For a local instance with a self-signed certificate; never for the host, whose certificate validates. |

The publisher pair is what every memq surface uses: `memq db-sync` publishes under it; `memq find`, the write-time neighbours check behind `add-type` and `add-operator`, the decay scan's pairs block, `memq recall`, `memq judged` and the session-start block query under it; `memq jev-calibration` reads `mem.usp_JevCalibration` under it; and the doctor's `Memory database` step reads `mem.usp_Health` under it. The curator pair is used by the two curator verbs alone. The sync allowlist admits nothing at the store root, so this file, the logins file, the local queue (`~\.claude\kit-memory-db-queue.sqlite`, where every read, applied and outcome stamp waits until the next publish, whatever the host's state) and the publish marker (`~\.claude\kit-memory-db-sync.attempt`) never reach another machine through the store sync.

A publish runs four ways. The session-start hook spawns `memq db-sync` detached at startup and resume, at most once per sixteen minutes, only where this file exists and the store is neither pinned nor redirected. A hand-typed `memq db-sync` does the same inline and prints one summary line plus every failure the run has to report, exiting non-zero only where something the run set out to do did not happen. `doctor -Fix` runs it from the doctor step. And `memq forget` spawns it detached after each removal, where this file exists and the store root is the default one, so the removed record's row can retire. A store pin rides on the `KIT_MEMORY_ROOT` override, so a pinned removal spawns nothing unless that override names the default root. It spawns nothing where that root is spelled as a network share and no store pin is set. Every run reads the host's schema version off its first probe and stands a caller down by name where the host is too old for it: the queue drain needs version 2, the shared search version 3 and the retired-rows form of the neighbours scan version 4, each answered with the installer named rather than with a wrong or silent result. Version 5 carries a judged fleet pointer's four outcome columns and `mem.usp_JevCalibration`, and no client gates on it, which is the one exception to that convention. A lower host drops those four fields from a pointer row and the drain then removes the row from the queue, so the host takes version 5 before any machine runs a client that writes pointer rows. A lower host also refuses `memq jev-calibration` in the server's own words. This installer writes version 6, which gives `mem.usp_Search` the `@p_Segment` and `@p_Tag` parameters that cut its candidates to one project segment and one tag, and a search naming either needs it, so `memq judged`, which always names a segment, stands down by name on a lower host. A search naming neither is sent exactly as before and needs only version 3.

The doctor's `Memory database` step is the standing check: it runs the probe under `-Quick`, reads the health report for this sandbox, and warns when the queue holds rows or the last clean publish, the last run that ended with no error, is older than seven days. It also warns, rather than passing, where `pwsh` or `node` is missing and the host was therefore not checked, and it reports `INFO` only where no config exists. `doctor -Fix` runs `memq db-sync` from there.
