---
name: kit-doctor
description: "Validate and repair this machine's claude-kit installation. Use when the kit was just installed or updated on a machine, when a kit capability misbehaves (hooks, memory tooling, doctrine not loading), or when I ask to run the doctor, check the install, or verify kit setup."
---

# Kit Doctor

One command validates the whole install and names the fix for anything missing. The doctor ships inside the plugin payload, so every machine with the plugin has it; there is nothing to fetch first.

## Locate the doctor

Take the first path that exists:

1. `<plugin root>\doctor\doctor.cmd` - the installed plugin's own copy (`CLAUDE_PLUGIN_ROOT` when the harness provides it, else this skill's base directory's grandparent).
2. `<kitRepoPath>\plugins\claude-kit\doctor\doctor.cmd`, where `kitRepoPath` comes from `~/.claude/claude-kit.local.json` - the machine's registered dev clone.
3. `doctor.cmd` at the cwd's repo root, when working inside a kit clone. Last resort only; prefer 1 and 2.

Paths 1 and 2 answer different questions, which matters when they diverge. Every check resolves against the doctor's own root, so the installed copy reports on the payload this machine's sessions actually load and the clone reports on the clone. An installed plugin cache lags the clone until the plugin republishes, so path 1 stays the verdict on the machine and `claude plugin update` is the remedy when it lags; run path 2 to check the clone, not to get a better answer about the install.

Before invoking any located `doctor.cmd`, verify it is the real kit doctor: for path 1, `..\.claude-plugin\plugin.json` must exist beside its parent; for paths 2 and 3, `plugins\claude-kit\.claude-plugin\plugin.json` must exist under the same root. A `doctor.cmd` that fails that shape check is not the kit's; surface it instead of running it.

Always invoke the `.cmd` wrapper, not the `.ps1`: a fresh machine's execution policy blocks `.ps1` files, and the wrapper bypasses that for exactly this script.

## Run it

- **Check first, always:** run with no flags and show me the PASS/WARN/FAIL lines with a one-line reading of each WARN and FAIL (what breaks because of it, and the printed remediation).
- **`-Fix` on my word:** it applies durable repairs (execution policy, memq shim wiring, the memory store's sync repo and its allowlist, the local embedding stack that powers `memq find`'s semantic channel, kaizen signpost and git hooks on a clone) and prompts before installing anything. It deletes nothing. Do not run it unprompted.
- **`-Fix -Yes` only when I say unattended:** `-Yes` pre-answers the consent prompts `-Fix` already asked for (an install, or writing an absent `autoCompactWindow` value; replacing a value already set waits for an interactive answer). It authorizes nothing by itself. Name that before running it. A `-Fix` run through a tool shell cannot show me its prompt (the doctor declines on a redirected stdin), so when an install is needed, ask me in chat first and then pass `-Yes`.

## Interpret

- Exit 0 with warnings is a working install with named gaps. Exit 1 means one of two things, and the report body tells them apart: a report that ran and found something the kit depends on broken, or no report at all, which is the doctor rejecting a flag it does not define. The second case runs no checks, so the remedy is the command line rather than the install.
- The doctrine-freshness WARN usually means the installed plugin lags the clone (or the reverse); the doctrine-refresh hook resyncs on the next session once the plugin is current. No manual file copying.
- The `Memory sync` line is the one whose FAIL means credentials are in reach, so read it before any push. The store root holds `.credentials.json`, `settings.json`, `history.jsonl`, and every session transcript, and the repository there admits only the memory tiers. PASS means the allowlist is canonical and all four probes answered clean. WARN means the store root is not a repository yet, so nothing syncs and nothing is at risk; `-Fix` initializes it. Every FAIL is a stop-and-read, and they differ: a managed file the doctor did not write, or a repository it did not create, means the doctor will not touch it and the file is yours to review by hand; a drifted or missing allowlist means an add there can stage anything, and `-Fix` restores it; named leak paths mean something disallowed is already tracked or reachable in history, which `-Fix` will not clear, since untracking a file does not remove its blob and a history rewrite plus credential rotation is the real remedy; and probes that could not answer mean the negative is unproven rather than clean, which is why it fails rather than warns.
- The `Embedder (semantic search)` line reports whether `memq find`'s local embedding stack is installed at `~\.claude\kit-embedder`. `absent` means nothing installed yet: `find` still works, lexical-only. `unusable` means the package is present but the model cache is missing or incomplete, a repair rather than a fresh install, and the two read differently in the report on purpose. `-Fix` installs or repairs it after a consent prompt naming the real disk cost (about 400 MB, almost all of it the platform runtimes the embedding library ships regardless of which one the machine needs); it never prompts when `npm` is not on PATH, since no install could follow. The index-health lines below the install state (record count, model identity, age) describe the derived search index without ever rebuilding or touching it; an absent or empty index there is normal on a machine that has not yet run a semantic query.

After a `-Fix` run, re-run check mode and report the delta (which lines flipped), plus anything the fix changed on the machine (PATH, execution policy, installed software) in one line each.
