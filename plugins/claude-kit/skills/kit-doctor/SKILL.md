---
name: kit-doctor
description: "Validate and repair this machine's claude-kit installation. Use when the kit was just installed or updated on a machine, when a kit capability misbehaves (hooks, memory tooling, doctrine not loading), or when I ask to run the doctor, check the install, or verify kit setup."
---

# Kit Doctor

One command validates the install and names the fix for each gap. It ships in the plugin payload, so every machine with the plugin has it.

## Locate the Doctor

Take the first path that exists:

1. `<plugin root>\doctor\doctor.cmd`, the installed copy, with the root from `CLAUDE_PLUGIN_ROOT` or else this skill's base directory's grandparent.
2. `<kitRepoPath>\plugins\claude-kit\doctor\doctor.cmd`, with `kitRepoPath` from `~/.claude/claude-kit.local.json`.
3. `doctor.cmd` at the cwd's repo root, inside a kit clone.

Path 1's report is the verdict on the machine. `claude plugin update` is the remedy when the installed cache lags the clone. Run path 2 to check the clone, never to get a better answer about the install. A clone run also reads the installed copy on the memq shim, `Memory sync` and embedder steps. Where the machine matches the installed copy and not the clone, those report INFO reading `trails the checkout in hand`, and `-Fix` from the clone installs nothing there. A FAIL or WARN whose expected value came from the payload names that copy.

Before running a located `doctor.cmd`, confirm it is the kit's. Path 1 needs `..\.claude-plugin\plugin.json` beside its parent, and paths 2 and 3 need `plugins\claude-kit\.claude-plugin\plugin.json` under the same root. Surface one that fails instead of running it.

Always invoke the `.cmd` wrapper, not the `.ps1`.

## Check and Fix Modes

- **Check first, always:** run with no flags and show me the PASS/WARN/FAIL lines. Read each WARN and FAIL in one line: what it breaks and its printed remedy.
- **`-Fix` only on my word:** it prompts before installing anything. It repairs execution policy, memq shim wiring, the store's sync repo and allowlist, the local embedding stack, the kaizen signpost and git hooks on a clone, and `autoCompactWindow` in user `settings.json` behind its own prompt. It runs `memq db-sync` where the memory database step warns. It deletes only the temp file its own failed signpost write left.
- **`-Fix -Yes` only on my word:** for an unattended run, or through a tool shell after my yes in chat. `-Yes` pre-answers the consent prompts `-Fix` already asked for. It authorizes nothing by itself, so name that before running it. The doctor declines prompts on a redirected stdin, so for an install through a tool shell, ask me in chat first.

## Reading the Report

- Exit 0 with warnings is a working install with named gaps. Exit 1 is a report that found something broken, or no report at all when the doctor rejected an unknown flag. The report body tells them apart. With no report no checks ran, so fix the command line, not the install.
- A `Doctrine import` WARN that the installed copy differs from the payload's skill body usually means the plugin lags the clone, or the reverse. The doctrine-refresh hook resyncs next session once the plugin is current. A session on an older plugin than the file's last writer leaves it alone. Never copy doctrine files by hand. A missing import line or doctrine file prints its remedy, and a missing operating-instructions skill prints only that freshness cannot be verified.
- Read `Memory sync` before any push, because its FAIL means credentials are in reach. The store root holds `.credentials.json`, `settings.json`, `history.jsonl` and every session transcript, and the repository there admits only the memory tiers and the machine coordinator directory. PASS means the allowlist is canonical and all four probes answered clean. INFO means the allowlist matches the installed copy, and one matching neither copy is the drift FAIL. The WARN that the store root is not a repository yet means nothing syncs or is at risk, and `-Fix` initializes it. Its other WARNs are not `-Fix`'s to clear, so read their remedy or gap on the line.
- Every `Memory sync` FAIL is a stop-and-read, and each class has its own remedy:
  - A managed file the doctor did not write, or a repository it did not create, is one it leaves alone. Review it by hand.
  - A drifted or missing allowlist lets an add stage anything. `-Fix` restores it.
  - Named leak paths are tracked or reachable in history. `-Fix` cannot clear them, since untracking leaves the blob. Rewrite history and rotate credentials.
  - Probes that could not answer leave the negative unproven, not clean, so they fail rather than warn.
- `memq shim` compares `~\.claude\bin` against the payload's copies. A shim that does not run never reads as trailing, since it is healthy for no copy. A FAIL naming missing or differing files means the bin matches no copy that could be judged. `-Fix` reinstalls them from the copy the line names.
- `Embedder (semantic search)` reports `memq find`'s local embedding stack at `~\.claude\kit-embedder`. `absent` means not installed, and `find` still works lexical-only. `unusable` means the model cache is missing or incomplete, a repair rather than a fresh install. `-Fix` installs or repairs it after a consent prompt naming the real disk cost (about 400 MB). The index-health lines (record count, model identity, age) describe the search index and never rebuild it. An absent or empty index is normal before a machine's first semantic query.
- `Memory database` reports the host's shared SQL Server index, configured in `~\.claude\kit-memory-db.json`. INFO with no config is a machine on its own store. WARN naming `pwsh` or `node` is a missing prerequisite to install. With a config, the `Probe:`, `Host:`, `Sandbox` and `Queue:` lines report the host probe's `-Quick` checks, `mem.usp_Health` under this machine's publisher login, and the local queue. FAIL means `memq find`, `recall` and session start fall back to the local index. WARN is also queued rows or no clean publish in seven days, and a run that ended on an error is not clean. `memq db-sync` clears either once its printed failure is fixed. `-Fix` runs it unprompted, since the publish is the kit's own state.

After `-Fix`, re-run check mode and report which lines flipped. Name in one line each what the fix changed on the machine, such as PATH, execution policy or installed software.
