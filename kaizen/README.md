# Kaizen inbox

The kit's self-improvement backlog. Captured friction with the kit becomes notes here; a kaizen pass turns notes into briefs and briefs into real improvements. The `kaizen` skill owns the workflow; this directory is just its storage.

## Structure

- `notes-<machine>.md` is per-machine and append-only, one note per bullet. Two forms are valid and a pass reads both. The short form is one pipe-delimited line: date, machine, repo, and the friction. The long form opens with a bold lead clause stating the lesson, then a parenthetical carrying the date, the seat, and the provenance, then a body, with an optional indented continuation bullet for a refinement filed later against the same note. Use the long form where the lesson needs its evidence beside it, and never split one incident across two notes. Per-machine files mean every workstation can push notes with no merge conflicts. A `git pull` before a pass merges them all.
- A note from a machine with no push path to this repository is landed by another machine's seat into the file named for the AUTHORING machine (`notes-ASR-CLAUDE.md` is one), with the landing seat and what it verified against the installed kit and what it could not check named in the note, so the filename still says who can be asked about it.
- A note file holds its header line and its notes and nothing else. The session-start count reads every non-empty line that does not open with `#` as a note, so an explanatory paragraph inside a note file reports as a pending item on every session start until it is removed; explanation belongs in this README.
- `notes-seed.md` holds the initial backlog from the 2026-06-17 session mining (the findings this port did not already address).
- `briefs/` holds one file per brief a reflect pass produces.
- `archive/` holds applied briefs, moved out of `briefs/` in the same commit that applied them, so the pending predicate stays clean.

Notes and briefs are tracked and pushed by git: that is the sync. The machine-local pointer that tells capture where this clone lives is the signpost at `~/.claude/claude-kit.local.json`, written by setup, and is never committed.

## Pending predicate

There are pending items when any `notes-*.md` has note lines or `briefs/` holds a file. That predicate gates the SessionStart nudge and the finishing-work offer. Empty inbox means kaizen stays silent.
