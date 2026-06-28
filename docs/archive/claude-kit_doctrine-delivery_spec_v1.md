# Doctrine Delivery and Cross-Surface Sync

Status: Complete
Commit Model: Review-Only
Created: 2026-06-26

## Goal

Make the kit's operating doctrine ride a single source of truth that every surface stays current on with near-zero per-machine work. Claude Code (the primary surface) gets the doctrine guaranteed always-on and auto-refreshing; Cowork and Chat get it through the auto-updating plugin skill plus a one-time per-account pointer. This removes the clone-and-setup-copy delivery, which silently went stale on a plugin-only fleet (5-6 machines/accounts), and replaces it with plugin-carried delivery.

## Approach

The doctrine becomes a plugin skill, `skills/operating-instructions/SKILL.md`. The SKILL.md is the canonical single source (frontmatter + the full doctrine as the body); no build-time generation, nothing to drift. Because it is plugin content, it rides plugin auto-update to every surface, and there is no 10k-character cap (a skill body loads on demand).

Delivery per surface:

- **Claude Code (always-on, hybrid):** a SessionStart hook (`doctrine-refresh.js`) reads the installed skill's SKILL.md from `CLAUDE_PLUGIN_ROOT`, strips the YAML frontmatter, and refreshes a stable, kit-owned file `~/.claude/claude-kit-doctrine.md` whenever it differs. That file is safe to overwrite silently (it is kit-owned, not the user's personal CLAUDE.md). The user's `~/.claude/CLAUDE.md` imports it with one stable relative line, `@claude-kit-doctrine.md`. Reading from `CLAUDE_PLUGIN_ROOT` each session means the version-stamped plugin cache path never leaks into the import, so the import line never goes stale. If the import line is missing, the hook offers (never silently performs) to add it; editing the user's personal CLAUDE.md stays consent-gated.
- **Cowork / Chat:** the skill is auto-available via the plugin (confirmed: kit skills load in Cowork). The user pastes a one-line pointer into each account's personal preferences ("consult the operating-instructions skill before non-trivial work"). This is the one irreducible manual step, once per account. It is a stable pointer: it never changes when the doctrine changes.

Plugin currency (orthogonal, already mostly built): this thread's PR-check hooks (stranded-branch detection, kit-version-nudge, build stamp) ship in the same changeset. Automatic plugin update is a verify-item (see Open Questions).

Superseded and removed: the clone-based `claude-md-drift.js` hook and `setup`'s CLAUDE.md-copy + `homeClaudeMdSha256` stamp from earlier this thread, plus the repo-root `home/CLAUDE.md` (its content moves into the skill). `setup` shrinks to dev-clone concerns only: the kaizen signpost (still consumed by the kaizen skill) and git-hooks wiring.

## Sections of Work

### 1. Operating-instructions skill (canonical doctrine)
Model: fable
Create `plugins/claude-kit/skills/operating-instructions/SKILL.md`: triggering frontmatter (name + a description that fires on any non-trivial task) followed by the full doctrine body moved verbatim from `home/CLAUDE.md`. Remove repo-root `home/CLAUDE.md`. Update `README.md` references (the file map line, the "global rules live in home/CLAUDE.md" line, and the setup.ps1 description line).
Acceptance: SKILL.md exists with valid frontmatter; body byte-identical to the old doctrine; `home/CLAUDE.md` gone; no dangling `home/CLAUDE.md` references outside docs/archive.

### 2. doctrine-refresh hook + retire claude-md-drift
Model: fable
Add `plugins/claude-kit/hooks/doctrine-refresh.js` (SessionStart, startup|resume): resolve the skill SKILL.md via `CLAUDE_PLUGIN_ROOT` (fallback `__dirname/../skills/...`), strip frontmatter, compare to `~/.claude/claude-kit-doctrine.md`, write if different (silent, create `~/.claude` if needed). Then if `~/.claude/CLAUDE.md` is missing or lacks the `@claude-kit-doctrine.md` token, emit additionalContext offering to add it (one-time, on approval). Fail-open and silent on any error. Delete `claude-md-drift.js`; in `hooks.json`, replace the claude-md-drift SessionStart entry with doctrine-refresh.
Acceptance: node --check passes; hooks.json valid and references doctrine-refresh, not claude-md-drift; simulated runs (fake HOME) show: first run writes the file + offers the import; up-to-date run silent; frontmatter stripped from the written file.

### 3. Trim setup scripts to dev-only
Model: sonnet
`setup.ps1` and `setup.sh`: remove the CLAUDE.md validate/backup/copy blocks and the `homeClaudeMdSha256` stamp. Keep the kaizen signpost (`kitRepoPath`, `machine`) and the git-hooks wiring. Update the header comments and the closing "Next:" hint to reflect dev-clone-only setup (signpost + hooks; doctrine now ships via the plugin).
Acceptance: setup writes a signpost with kitRepoPath + machine (no hash) and wires git hooks; no reference to home/CLAUDE.md remains; the kaizen skill's signpost contract (kitRepoPath) is intact.

### 4. Account pointer + usage docs + autoUpdate verify
Model: fable
Add a short "house rules across surfaces" section to `README.md`: the one-line account-preferences pointer to paste per account, the one-time `@claude-kit-doctrine.md` import line for Code, and a note that the plugin carries skills/agents/hooks to all surfaces. Record the autoUpdate finding (background auto-update at startup is documented; no explicit enable key was confirmed) as a verify-item.
Acceptance: README documents all three surfaces and the per-surface one-time step; Open Questions updated.

### 5. Verify
Model: fable
node --check all hooks; validate hooks.json; functional-test doctrine-refresh with a fake HOME and a fake plugin root; confirm claude-md-drift.js is gone and unreferenced; run build.sh and confirm the new skill is packaged. Leave everything uncommitted for Scott's review.

## Out of Scope

- Rewriting the doctrine content itself (only relocated verbatim into the skill).
- This thread's PR-check hooks (already built; they ship in the same uncommitted changeset but are not re-designed here).
- Relying on plugin SessionStart hooks executing in Cowork/Chat (unconfirmed); Cowork/Chat delivery rests on the skill + account pointer, not hooks.
- Any git commit/push/PR: Scott reviews and commits.

## Open Questions

- autoUpdate mechanism (RESOLVED): no marketplace.json change is needed. The repo README already documents the real mechanism - `plugin.json` omits `version`, so every commit is a new version; background auto-update runs at startup (set `GITHUB_TOKEN` for the private repo); `/plugin update claude-kit` is the manual path. There is no `autoUpdate` marketplace key (the earlier research agent's claim of one was not supported by the docs).
- Chat auto-loading plugin skills: confirmed in Cowork (skills visible this session); inferred for Claude.ai Chat, not yet confirmed. Owner: Scott (observe in a Chat session).
- Import path form: `@claude-kit-doctrine.md` (relative to ~/.claude) is the intended line; confirm relative-import resolution in user-scope CLAUDE.md on first real run. Owner: execution.

## Related

- Extends the git-hygiene / distribution series. The push guard (`merged-pr-push-guard`) and stranded-commit detection from the archived `docs/archive/claude-kit_merge-strand-guard_spec_v1.md` are the PR-check work that ships in this same uncommitted changeset.
- Supersedes the clone-based `claude-md-drift` approach explored earlier this thread (never committed).

## Chapters

### Chapter 1 - all sections implemented (2026-06-26)

Implemented and verified all five sections in one pass (main thread). Left entirely uncommitted for Scott's review (Review-Only).

What shipped:
- `plugins/claude-kit/skills/operating-instructions/SKILL.md` - canonical doctrine: triggering frontmatter + the doctrine body moved byte-identical from the old `home/CLAUDE.md` (verified by diff).
- `plugins/claude-kit/hooks/doctrine-refresh.js` - SessionStart (startup|resume): reads the skill from `CLAUDE_PLUGIN_ROOT`, strips frontmatter, refreshes `~/.claude/claude-kit-doctrine.md` silently when it drifts, and offers (consent-gated) to add the `@claude-kit-doctrine.md` import to `~/.claude/CLAUDE.md` when missing. Fails open.
- Retired `claude-md-drift.js` (deleted, unreferenced) and the `homeClaudeMdSha256` stamp; `hooks.json` rewired (SessionStart: session-start, branch-reaper-nudge, kit-version-nudge, doctrine-refresh).
- `setup.ps1`/`setup.sh` trimmed to dev-clone concerns: kaizen signpost (kitRepoPath + machine, no hash) + git-hooks wiring; validates the repo via the plugin marker.
- Removed repo-root `home/CLAUDE.md`; updated `README.md` (skills map, INSTALL steps 4 + 6, the Updating note, the conventions line) and `docs/README.md` index.

Verification (all passed): node --check on all 9 hooks; hooks.json valid and claude-md-drift-free; doctrine-refresh against a fake HOME + the real plugin root - fresh run writes the stripped body and emits the offer, import-present run is silent, a staled file is refreshed back to the skill body; setup.sh dry-run writes a hash-free signpost; build.sh packages the skill and the new hook into the zip and excludes claude-md-drift.

Decisions / notes:
- autoUpdate open question resolved: no marketplace.json change; the README already documents the real mechanism (version omitted = every commit a new version; background auto-update at startup with GITHUB_TOKEN for the private repo; `/plugin update` manual path).
- `home/CLAUDE-FOR-FABLE.md` is a separate artifact, left untouched; it has the same delivery question if Scott wants it solved later.

Remaining (Scott): review + commit; rebuild/reinstall (or push + `/plugin update`) so the skill/hook go live; one-time per machine add the import line in Code (or accept the hook's offer); one-time per account add the pointer to Cowork/Chat preferences. Inferred-not-confirmed: that Claude.ai Chat auto-loads plugin skills (confirmed in Cowork this session).

### Chapter 2 - close-out (2026-06-28)

Status flipped to Complete and the plan archived. The effort shipped: all five sections were reviewed and committed as `c800e05` ("Operation Instructions") on 2026-06-26, alongside the PR-check hooks. Chapter 1's "left entirely uncommitted for Scott's review" was the hand-off state and is superseded by that commit.

Confirmed at close (git evidence): `operating-instructions/SKILL.md` and `doctrine-refresh.js` are tracked and committed in `c800e05`; `home/CLAUDE.md` is gone from the tree; the working tree is clean at these artifacts; the doctrine is in daily use.

Open questions settled: the `@import` resolution question is answered empirically by daily use (the doctrine loads, so the relative import resolves); Cowork skill auto-load was confirmed in-session; Chat auto-load stays a passive observation, not plan work.

Operational rollout (continues per machine, not plan work): the one-line `@claude-kit-doctrine.md` import is added per machine in Code (the `doctrine-refresh` hook offers it automatically when absent), and the account pointer is pasted per Cowork/Chat account.

