# claude-kit: sweep stale plugin cache folders

Status: Ready
Commit Model: Branch-and-PR
Created: 2026-09-15
Worker: the next kit session the operator starts. Queued by the coordinator persona on the operator's instruction.

## Goal

The branch hygiene sweep also reclaims the plugin cache. Claude Code installs an unversioned plugin into a hash-named folder under `~/.claude/plugins/cache/<marketplace>/<plugin>/` on every update and never deletes the previous one. On the operator's machine the kit's own cache holds thirty-three such folders from two weeks of updates, about 185 megabytes, and the count grows with every update. The agentic plugin is about to drop its version field and take the same shape, so the pile grows on two plugins from here.

## Decisions taken at scoping (2026-09-15)

**Home: the branch hygiene skill, as a companion step, not a new skill.** The operator already runs that sweep when the session-start nudge flags reapable branches, and cache folders are the same kind of leftover: safe once nothing references them, dangerous to guess at. One sweep the operator already knows beats a second one to remember.

**Keep set, stated whole.** A folder is kept when any of these holds. It is the `installPath` a plugin entry in `~/.claude/plugins/installed_plugins.json` names. It is loaded by a running Claude Code process, which the sweep detects by checking whether the folder is the plugin root a live session's skill loads name; because that is not readable from outside a session, the rule stands in for it with an age floor: a folder modified within the last seven days is kept. Everything else under a plugin's cache directory is deleted. The seven day floor is the one tunable, named as a constant in the script, and it is what a running session that started before the newest install still needs: this coordinator session loads a kit folder that is not the recorded install path, because it started before this morning's update.

**Dry run first, delete on an explicit flag.** The sweep prints what it would remove with each folder's age and size, and removes only with `-Delete`, the same shape the branch sweep uses for its verified-merged set.

**Scope is the cache root only.** The sweep never touches `~/.claude/plugins/marketplaces/`, `installed_plugins.json`, or `known_marketplaces.json`. It reads the first; it writes none of them.

## Sections of Work

### Section 1: the sweep script

Model: sonnet. A bounded PowerShell script with a clear contract and a sibling to mimic in the branch sweep.

1. Add a script beside the branch hygiene skill's existing tooling that enumerates every `<marketplace>/<plugin>/<folder>` under the cache root, reads `installed_plugins.json` for each plugin's `installPath`, and classifies each folder as kept by install path, kept by age, or stale.
2. Print a table with one row per folder: marketplace, plugin, folder name, age in days, size, and the classification. Print the reclaimable total.
3. With `-Delete`, remove the stale folders and print what was removed. Without it, remove nothing.
4. Tests: a scratch cache root with three plugins, one versioned and two hash-named, an `installed_plugins.json` pointing at one folder each, folders older and younger than the floor. Assert the classification and that a dry run deletes nothing. Run the kit's test lane and read its exit code.

### Section 2: the skill wires it in

Model: inline. Prose in the branch hygiene skill and its session-start nudge.

1. The skill's procedure gains one step after the branch sweep: run the cache sweep dry, show the table, and delete on the operator's word or under the same standing authorization the branch sweep runs with.
2. The session-start nudge that counts reapable branches also counts stale cache folders and their total size, so the operator sees the pile before asking.
3. The kit's parity and skill tests run as the whole gate.

## Out of Scope

- Pruning anything under a marketplace clone.
- Changing how Claude Code names or chooses cache folders.
- Sweeping caches on a machine other than the one the session runs on.

## Operator Verification

Run the branch hygiene skill once after the plan lands. The dry run lists the kit's old hash folders as stale with their sizes, keeps the recorded install path and every folder younger than seven days, and the delete run reclaims the rest. A session started before the newest install keeps working, since its folder is inside the age floor.

## Chapters
