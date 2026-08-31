---
name: kaizen
description: "Use when running a kaizen pass on the kit: an explicit kaizen request, accepting an end-of-effort or session-start offer to reflect on captured friction, or applying a pending kaizen brief in the kit repo. Jotting a single friction note does not need this skill; the global capture rule covers that."
---

# Kaizen

Kaizen is the kit improving itself. Friction with the kit (a rule that was ambiguous, a step that fought the work, a capability you wished for) is captured cheaply while you work; a kaizen pass turns that captured friction into real improvements, authored well. It runs only when there is something to discuss. It is the kit's own writing-skills loop, pointed at the kit.

## The inbox lives in the kit repo

Notes and briefs live inside the kit's working clone, so git is the sync-and-combine mechanism across my machines. No separate aggregation step.

- `kaizen/notes-<machine>.md` is per-machine, append-only, one line per note: date, machine, repo, and the friction. Per-machine files mean three workstations can all push notes with zero merge conflicts. A `git pull` before a pass merges every machine's notes automatically.
- `kaizen/briefs/` holds one file per brief a reflect pass produces.

**Pending items** means any `kaizen/notes-*.md` has note lines, or `kaizen/briefs/` holds a file. That predicate gates every offer and the SessionStart nudge: nothing pending means no kaizen, by construction.

## Capturing (the cheap half)

Capture is manual, not an always-on posture: when you (or rarely I) notice the kit got in the way, append a one-line note and carry on. Capture is standing-authorized for every session, seated or not: no per-note approval and no routing through any seat, the append itself being the capture, and in the kit clone the note is committed and pushed with the note file alone staged, so the inbox syncs across machines without waiting on a pass. **That push runs no gate, and the rule is what the push can break rather than the path it lands on.** A push publishes every commit the upstream does not have rather than the commit you just made, so what has to be the note alone is the branch delta and never the staging set: read that delta before pushing (`git log --oneline @{u}..HEAD`, or the ahead count `git status -sb` prints) and take this exemption only where the note commit is the whole of it. A delta that is that one commit carries one appended line to an inbox no test takes as a subject, so no lane covers anything it changed and there is nothing for a gate to read; the capture also runs from whatever repo you are working in, which holds neither the kit's lanes nor a baseline on them. The exemption is that narrow: a delta carrying anything beside the note commit is a different push and takes the lane its own surface earns, which for the kit's main is the whole gate the pre-push condition names, so a note commit sitting on top of unpushed work waits for that gate rather than carrying that work out under this exemption. Beside the friction bar below, every note takes the public-board cap, because the inbox is a repository surface that may be public: an absolute path is spelled repo-relative or home-relative, the operator's words stay off the artifact, and a friction that cannot be stated inside the cap goes to the operator rather than into the inbox. You do not load this skill to capture; the kit doctrine (imported via `~/.claude/CLAUDE.md`) carries the bar.

Capture happens while you are working in some other project, so the kit clone is elsewhere on disk. Find it via the machine-local signpost `~/.claude/claude-kit.local.json` (written by `doctor -Fix` on Windows, `setup.sh` on POSIX), which records `kitRepoPath`. Append the note to `<kitRepoPath>/kaizen/notes-<machine>.md`, where `<machine>` is the hostname. The plugin caches under `~/.claude/plugins/` (the marketplace clone and the per-version cache dirs) are full copies of the kit repo, `kaizen/` included; a note written there never reaches a pass and dies on the next update, so the signpost's `kitRepoPath` and the missing-signpost fallback are the only two destinations. If the signpost is missing (first-run setup has not happened on this machine), fall back to `~/.claude-kaizen/notes-<machine>.md` and say so, so it gets folded in later.

**Worth a note (concrete kit friction):**
- a kit rule or skill instruction was ambiguous, contradicted the actual situation, or let you rationalize around it
- a workflow step fought the work or added cost without value
- you wished for a capability the kit does not have, or hit a gap
- a review or agent behaved in a way that suggests its prompt needs tuning

**Not worth a note:**
- "it went fine", or general praise
- a project-specific gotcha (that goes to the project's memory tier, not here)
- a one-off mistake of your own that is not about the kit

**State the lesson, not the incident.** Capture every note one level more general than the incident that taught it: the incident is the evidence, the lesson is the note. One burn should teach you "hot," not "that stove."

Zero notes in a session is the normal, healthy case. A note you have to talk yourself into is noise; leave it out.

## The pass (the reflect half)

The pass is the adjudication half, and its authority is standing: the machine-coordinator seat and the kit repo's expert seat each carry the operator's standing authority to disposition the inbox at any time, deciding what a note is worth and what it builds into, with no per-note operator round. The operator's attended pass (an explicit ask, an accepted end-of-effort or session-start offer, a pending brief) is the richer form, because their half of the retro joins it; standing adjudication is what keeps the inbox moving between those moments.

The standing authority is narrow in three ways worth stating, because a seat reading only this paragraph would otherwise take it wider than it goes. It does not widen the capture bar, which is this skill's and no seat's to relax. It does not reach a materially consequential disposition, which goes to the operator like any other decision ask. And a dispatched disposition lands as an artifact in the repo that owns the work, a spec, a backlog entry, a plan, never an instruction to a session on a seat's say-so.

1. **Gather.** In the kit repo, `git pull` first so notes from every machine are merged. Which lane that pull earns depends on what it did, so read that off the pull's own output before pricing it: `Already up to date` or `Fast-forward` means no merge happened, the tree is one origin already had, and the pass opens on the targeted lane, while a pull that reports a merge is an integration producing a tree neither side had, which is the merge moment the doctrine's gate bullet names, and there the whole gate runs over the merged tree with the contention lane beside it before the pass changes anything. Where that output has scrolled away, the tip's parent count settles it against the sha HEAD carried before the pull: `git log -1 --pretty=%p HEAD` prints two parents for a merge commit and one otherwise, and it is this pull's merge only where HEAD moved, an unmoved HEAD being a pull that integrated nothing whatever its tip already was. Then read all `kaizen/notes-*.md` plus any friction from this session still in context, and, when the pass runs attended, ask the operator for theirs; their half of the retro is the other half.
2. **Reflect and triage.** For each item, with the operator when attended and by standing authority otherwise: is it real, and what is the smallest change that fixes it? Sort into:
   - **Apply now:** small and clear. Becomes a brief (or is fixed directly, since the pass already runs in the kit repo).
   - **Promote:** large enough to deserve its own design. Brainstorm it into a `docs/plans/` spec instead of a brief.
   - **Route elsewhere:** not actually about the kit. A project learning goes to the project's memory tier; a project convention to that project's CLAUDE.md. It leaves the inbox either way.
   - **Park (wait-for-signal):** real and about the kit, but an open experiment with a defined driving signal and no data yet. Nothing to fix; move it to the kit's `docs/backlog.md` with its signal and decision protocol, and clear the note. The inbox stays a friction-only signal, so the pending-items nudge never cries wolf over an experiment that is simply waiting.
3. **Write briefs and apply.** Write a brief for each apply-now item (format below), make the change per the writing-skills skill (baseline-test any behavior-shaping wording before trusting it), then clear the note lines you handled and archive applied briefs out of `kaizen/briefs/`. The kit repo is Commit-and-Push, and its main is a trunk consumers install from directly with no CI gating the merge, so the push that ships an applied brief is itself the install surface: the whole gate runs before it with the contention lane beside it, at executing-work's step 7, which owns that moment. A promoted spec follows its own recorded commit model.

## The brief format

A brief is a self-contained directive a fresh kit-repo session can execute without this session's context:

```
# Kaizen brief: <short title>
Friction: <what went wrong, one or two lines, the evidence>
Change: <what to change, which files or skills>
Acceptance: <how you know it is right, verifiable>
Discipline: follow writing-skills; baseline-test any behavior-shaping wording.
```

## Offering a pass

Never offer on an uneventful session. Offer only when the inbox has pending items, and only at a natural moment: finishing-work's close-out, or when I signal I am wrapping up. The offer is one dismissable line ("N kaizen items captured, want to run a pass?"). I can always start one explicitly. The SessionStart nudge (kit repo only) is the same predicate from the other end: it reminds you when you open claude-kit and items are waiting.
