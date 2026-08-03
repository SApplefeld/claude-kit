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

Before invoking any located `doctor.cmd`, verify it is the real kit doctor: for path 1, `..\.claude-plugin\plugin.json` must exist beside its parent; for paths 2 and 3, `plugins\claude-kit\.claude-plugin\plugin.json` must exist under the same root. A `doctor.cmd` that fails that shape check is not the kit's; surface it instead of running it.

Always invoke the `.cmd` wrapper, not the `.ps1`: a fresh machine's execution policy blocks `.ps1` files, and the wrapper bypasses that for exactly this script.

## Run it

- **Check first, always:** run with no flags and show me the PASS/WARN/FAIL lines with a one-line reading of each WARN and FAIL (what breaks because of it, and the printed remediation).
- **`-Fix` on my word:** it applies durable repairs (execution policy, memq shim wiring, the memory store's sync repo and its allowlist, kaizen signpost and git hooks on a clone) and prompts before installing anything. It deletes nothing. Do not run it unprompted.
- **`-Fix -Yes` only when I say unattended:** `-Yes` pre-answers the consent prompts of whatever the other flags already asked for (an install, a removal). It authorizes nothing by itself. Name that before running it. A `-Fix` run through a tool shell cannot show me its prompt (the doctor declines on a redirected stdin), so when an install is needed, ask me in chat first and then pass `-Yes`.
- **`-RemoveLegacyRelay` only on my explicit say-so:** with `-Fix`, it deletes the leftover resume-relay state named below. That is the doctor's one destructive action and naming the switch is the authorization for it, so never add it to make a warning go away, and never pass `-Fix -RemoveLegacyRelay -Yes` before I have read the resume records the check prints. `-Fix -Yes` without this switch is the install case and cannot reach that state. Check which doctor you located before trusting a removal run: a copy that predates this switch accepts it and silently ignores it (`powershell -File` does not reject an unknown switch), so the run reports success having deleted nothing, and an older copy may still prompt to re-arm the very watcher you meant to remove. An installed plugin cache lags the clone until the plugin republishes, so confirm the located doctor prints a `Legacy resume relay` line at all, and prefer the registered clone (locate path 2) until the cache is current.

## Interpret

- Exit 0 with warnings is a working install with named gaps; exit 1 means something the kit depends on is broken.
- The doctrine-freshness WARN usually means the installed plugin lags the clone (or the reverse); the doctrine-refresh hook resyncs on the next session once the plugin is current. No manual file copying.
- A `Legacy resume relay` WARN means the machine still carries leftovers of the resume relay, which is no longer part of the kit: its `%LOCALAPPDATA%\claude-kit\resume-relay` state directory, a `claude-resume-relay.lnk` Startup shortcut, or a resident `AutoHotkey64.exe` watcher process. Nothing in the kit owns or maintains them. It also WARNs when nothing was found but the watcher query itself was refused, because an unchecked condition is not a clean one. A PASS with no detail is the clean state.
- Every run, `-Fix` or not, prints the resume records that state directory still holds: every readable `failed\` record (those are the resume pointers a removal destroys, so they are never abbreviated), the newest few of `processed\`, a pending `request.txt`, and the tail of `relay.log`, with a count of what it did not print. Read them before agreeing to any removal, and triage against real git state: a `failed\` record is a real stall only when no newer `processed\` record carries the same continue prompt, and a stall whose work already landed via pushed commits and plan-doc Chapters needs no resume either way.
- `-Fix -RemoveLegacyRelay` removes the leftovers on consent at an interactive prompt: the watcher process, then the shortcut, then the whole state directory including records it did not print. A watcher it cannot stop or cannot check blocks the rest, and a directory it could not fully read is left alone. AutoHotkey itself stays installed.

After a `-Fix` run, re-run check mode and report the delta (which lines flipped), plus anything the fix changed on the machine (PATH, execution policy, installed software) in one line each.
