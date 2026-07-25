# Kit Architecture

The kit is a Claude Code plugin plus the repo material that maintains it. Almost all of it is prose: skills the model loads on demand, agent definitions, and a doctrine file that ships to the user's home directory. The exceptions are the pieces with real runtime behavior, and there are two: the Node hooks wired to session and tool events, and the compaction engine, a Bun program that rewrites session transcripts.

That split is the thing to hold onto when changing anything here. Prose surfaces are behavior-shaping text with no test but the writing-skills RED/GREEN check; the hooks and the engine are code with a real gate under `test/` and `tools/engine-tests/`.

## Repo layout

- **`plugins/claude-kit/`** is the installable payload, and the only zone an installed plugin loads. It holds `skills/` (18 skills, each a `SKILL.md` plus optional `references/`), `agents/` (reviewers, implementers by model tier, the QA verifier, the docs curator, the design facilitator, the council member), `hooks/` (Node scripts plus `hooks.json`), and `doctor/` (the Windows first-run and repair tool; its one destructive action, clearing a machine's leftover resume-relay state, needs the separate `-RemoveLegacyRelay` switch on top of `-Fix`).
- **`home/`** holds the two files that land in the user's home directory rather than loading from the plugin: `CLAUDE.md`, an import stub that pulls the doctrine in and carries any machine-local pointers, and `claude-kit-doctrine.md`, the doctrine body itself. The doctrine's single source is the `operating-instructions` skill: `doctrine-refresh.js` strips that skill's frontmatter and writes the body to `~/.claude/claude-kit-doctrine.md` each session, so the copy here must stay byte-identical to the skill's body or a session loads doctrine the repo does not show.
- **`docs/`** is the working library: about-the-solution documents at the root, active plans in `plans/`, finished history in `archive/`. It is not part of the payload.
- **`kaizen/`** is the kit's self-improvement inbox, one note per piece of observed kit friction.
- **`settings/settings.recommended.json`** is the recommended user settings shape.
- **`tools/`** holds repo-side utilities that do not ship: `engine-tests/` (the compaction engine's Bun suite) and `transcript-study/` (the corpus analysis behind the compaction thresholds).
- **`build.ps1`, `build.sh`, `.claude-plugin/marketplace.json`** package and publish the plugin.

## Hooks

`plugins/claude-kit/hooks/hooks.json` is the wiring, and every hook is a Node script invoked with the plugin root. The events in use:

- **SessionStart** runs `session-start.js` (resume surfacing and unarchived-plan flagging), `branch-reaper-nudge.js`, `kit-version-nudge.js`, and `doctrine-refresh.js`. Matchers differ per hook: the doctrine refresh also fires on `clear`, and `branch-reaper-nudge.js` skips the `compact` entry. `session-start.js` firing on `compact` is what makes a compacted session re-read its plan doc, so it is the recovery path the kit relies on.
- **PreToolUse** runs `docs-write-guard.js` on write-shaped tools, and `pr-docs-guard.js`, `merged-pr-push-guard.js`, and `readonly-agent-guard.js` on shell tools. The last of those keys on the calling agent's type and governs two classes: the five judgment agents, for whom the repo tree is read-only, and `qa-verifier`, which may write and delete inside the build-output directories its suites need but nowhere else. Both lose git and GitHub state changes, formatters, and the package-manager verbs that rewrite a lockfile or a tracked project file; reads, builds, and test runs stay untouched for both, and `.kit/` is writable scratch. Every guard is a fail-open denylist, blocking only the shapes it names and allowing anything it cannot positively judge, so the `git status --porcelain` comparison that executing-work and finishing-work run around each review round is the backstop for what the heuristics miss; the mutations no tree comparison can see, an outward `gh` call or a ref creation that leaves the worktree byte-identical, are on the denylist for exactly that reason.
- **PostToolUse** runs `format-on-edit.js` after edits.
- **Stop** runs `stop-docs-hygiene.js` and `kit-goal-stop.js`, the deterministic leash that holds a `/kit-goal` run to completion. Its state is a file in the project (`.kit/goal-state.json`) that no session swap deletes, but the hook enforces on session identity, so a swap carries the leash only where the compaction ledger records the successor, which is a manual compact-session compaction and nothing else; a successor the hook cannot tie to the bound session is a bystander whose stop is allowed, and re-arming is the recovery.

## Compaction engine

The engine is the kit's one substantial program: it reads a session transcript, writes a new session whose transcript keeps human messages verbatim and replaces bounded slices of assistant work with summaries, and leaves the source untouched. It is the mechanism behind the compact-session skill's single manual mode, where a compaction is requested or offered at a turn's end and the swap is performed by a typed `/resume`.

`docs/compaction-engine.md` is the full mechanism document: the plan model, turn segmentation and the `--keep N` fallback, the summarizer contract, the emitted transcript's single-chain guarantee, failure paths, and tuning knobs.

## External integrations

- **The `claude` CLI** is spawned headlessly by the engine to summarize, pinned to a model, with hooks disabled and all tools denied. `claude` must resolve to a native executable rather than an npm `.cmd` shim, because the prompt carries transcript-derived text on argv.
- **Bun** runs the engine and its tests. **Node** runs the hooks.
- **git and the GitHub CLI** are what the branch-hygiene, PR-docs, and merged-PR-push guards observe and act on.
- **The local filesystem under `~/.claude/`** is shared state: `projects/<sanitized-cwd>/<session-id>.jsonl` for transcripts, `magic-compact/` for the omission caches, the ledger, and parse-failure debug output.
