# Claude-Kit Docs

This directory is the working library and project history for the kit itself: the documents *about* the solution, the active plans, and the archived record of finished work. It is repo-level material, a sibling of `README.md`, `home/`, `kaizen/`, and `settings/`. It is not part of the installable plugin payload (`plugins/claude-kit/`), so nothing here loads or shows up when someone installs the plugin.

## Folder map

The library has three zones, and each zone has one job.

- **Root (`docs/`)** holds the stable documents about the solution and this index. Architecture, design rationale, and any security model live here. These describe what the kit *is*, not a single effort.
- **`plans/`** holds active plans only: specs that are open or in progress. A plan lives here while it is being worked. The moment it reaches `Status: Complete` or is abandoned, it moves to `archive/`. See `plans/README.md`.
- **`archive/`** holds finished and abandoned plans (their Chapters intact) and dated backlog snapshots. It is immutable history. Nothing here is live. See `archive/README.md`.

## Living documents

- **`backlog.md`** is the single living handoff and next-steps doc. It carries only active items. Completed items are pruned out to a dated snapshot in `archive/` so the doc never grows without bound.

## How the library is maintained

The `curating-docs` skill owns the mechanics: it archives a plan when it completes, prunes the backlog, cross-references related plans, and refreshes this index. `finishing-work` calls it at close-out, `brainstorming` calls it when a new plan is written, and it can be invoked directly to tidy or retrofit an existing tree.

## Active plans

- `plans/claude-kit_doctrine-delivery_spec_v1.md` (In Progress) - single-sources the operating doctrine as a plugin skill and delivers it per surface (Code always-on via import + refresh hook; Cowork/Chat via the skill + an account pointer). Extends the git-hygiene series; see its `## Related` link to the archived `merge-strand-guard` spec, whose push guard and stranded-commit work ship in the same changeset.

## Archive

See `archive/` for completed plans and backlog snapshots.
