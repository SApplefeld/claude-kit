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

- **SessionStart** runs `session-start.js` (resume surfacing and unarchived-plan flagging), `branch-reaper-nudge.js`, `kit-version-nudge.js`, `doctrine-refresh.js`, and `hook-canary.js`. Matchers differ per hook: the doctrine refresh also fires on `clear`, and `branch-reaper-nudge.js` and `hook-canary.js` skip the `compact` entry, the canary because a plugin cache cannot change mid-session. `session-start.js` firing on `compact` is what makes a compacted session re-read its plan doc, so it is the recovery path the kit relies on.
- **PreToolUse** runs `docs-write-guard.js` on write-shaped tools, and `pr-docs-guard.js`, `merged-pr-push-guard.js`, and `readonly-agent-guard.js` on shell tools. The last of those keys on the calling agent's type and governs two classes: the five judgment agents, for whom the repo tree is read-only, and `qa-verifier`, which may write and delete inside the build-output directories its suites need but nowhere else. Both lose git and GitHub state changes, formatters, and the package-manager verbs that rewrite a lockfile or a tracked project file; reads, builds, and test runs stay untouched for both, and `.kit/` is writable scratch. Every guard is a fail-open denylist, blocking only the shapes it names and allowing anything it cannot positively judge, so the `git status --porcelain` comparison that executing-work and finishing-work run around each review round is the backstop for what the heuristics miss; the mutations no tree comparison can see, an outward `gh` call or a ref creation that leaves the worktree byte-identical, are on the denylist for exactly that reason.
- **PostToolUse** runs `format-on-edit.js` after edits.
- **Stop** runs `stop-docs-hygiene.js` and `kit-goal-stop.js`, the deterministic leash that holds a `/kit-goal` run to completion. Its state is a file in the project (`.kit/goal-state.json`) that no session swap deletes, but the hook enforces on session identity, so a swap carries the leash only where the compaction ledger records the successor, which is a manual compact-session compaction and nothing else; a successor the hook cannot tie to the bound session is a bystander whose stop is allowed, and re-arming is the recovery. Its three release points also append to the goal event stream described below.

### The canary

`hook-canary.js` is the one hook whose subject is the other hooks. Every kit hook fails open, so a stale or damaged plugin cache, a hook file that no longer parses, or a guard gone inert takes the enforcement away with no signal at all. The canary probes the cache a session actually executes (`CLAUDE_PLUGIN_ROOT`) and speaks only when something about it is positively broken.

It load-checks every hook named in `hooks.json` (each named file is present in the cache and `node --check` parses it), then runs known-answer probes in both directions, so a guard that answers everything the same way cannot read as healthy: a governed subagent writing a `docs/` path must deny while a main session writing the same path must allow, a read-only subagent's `git commit` must deny while its `git diff` must allow, and a throwaway fixture holding an armed goal must draw a block from `kit-goal-stop.js` while a directory with no goal armed draws nothing. `merged-pr-push-guard.js` and `pr-docs-guard.js` get a load check plus a benign-payload plumbing probe only, because their deny paths need external state (a MERGED pull request, a dirty checkout off the default branch); the repo suite owns their behavior. The goal probe runs against a temp directory with the event sink, the genealogy ledger, and the re-read delays all pinned away from real machine state. The sweep is about twenty serial spawns, each bounded at 5 seconds, under a second in total on a healthy cache.

A failure writes one warning into the session context naming each failed probe with its expected and actual answer, capped at 10 lines plus a count of the remainder, and points at `/kit-doctor` and a reinstall. The canary always exits 0 and never blocks anything. The loud/silent boundary is deliberate: anything positively observed about the cache being broken is loud, including a missing hook file, a missing or unparseable `hooks.json`, a probed hook the wiring no longer names, and a plugin root that is not there, while an unexpected error inside the canary's own code stays silent through its fail-open catch, since a canary bug that warned at every session start would cost more than the blind spot it covers. What the canary measures is a cache's internal consistency, not its freshness against the repo: a stale but coherent cache reads healthy, and `kit-version-nudge.js` is what watches for drift. The doctor's "Hook canary" check confirms the file is present and wired into the `SessionStart` array.

## Goal release events

A `/kit-goal` leash release leaves a machine-readable line in `~/.claude/kit-events.jsonl`, so an outside notification layer watches one well-known path instead of parsing transcripts. Transport is not the kit's job; the kit's deliverable is the file and its contract.

`emitGoalEvent` in `kit-goal-lib.js` writes it, and `kit-goal-stop.js` calls it at exactly three release points: the plan reaching `Status: Complete` (`goal-complete`, detail `plan-complete`), the plan file gone to the archive (`goal-complete`, detail `plan-archived`), and a last assistant message leading with `BLOCKED:` (`goal-blocked`). Two other releases deliberately emit nothing: a manual `/kit-goal clear`, where the user is already present, and the harness's own consecutive-block-cap override, which the hook never sees.

The contract a consumer reads against:

- One JSON object per line, `{ts, event, project, plan, session}`, plus `detail` present only on a `goal-complete`. `ts` is ISO 8601, `project` the absolute project path, `plan` the repo-relative plan path, `session` the session id or null.
- Every field is sanitized display data, not a command: printable ASCII, capped at 40 characters for `event` and `detail`, 120 for `plan` and `session`, and 260 for `project`.
- `project` is an absolute local path that typically embeds the OS username, so forwarding an event anywhere external is a PII call the consumer makes.
- A `goal-complete` is exactly-once: the emit is gated on the clear that actually removed the goal state, so a persistently failing clear never re-reports and a racer that finds the state already gone stays silent. A `goal-blocked` re-emits at every blocked stop, because the hook is stateless by design; dedup is the consumer's policy and is load-bearing against notification spam.
- `KIT_EVENTS_PATH` redirects the sink per process. It is a producer-side lever for tests and the canary's goal probe, and a consumer must not honor it ambiently.
- Emitting is observability, never a decision input. The helper never throws, returns nothing to branch on, and leaves a stop's verdict, output, and exit code identical when the write fails. A sink that exists and is not a regular file is left untouched and nothing is written, the same FIFO-hang guard the Stop hook applies to transcript paths. Rotation is best-effort and sized for a single writer: past 1 MB the file is renamed to `kit-events.jsonl.old`, replacing any previous one, and a rename that keeps failing degrades to unbounded growth rather than lost events.

## Compaction engine

The engine is the kit's one substantial program: it reads a session transcript, writes a new session whose transcript keeps human messages verbatim and replaces bounded slices of assistant work with summaries, and leaves the source untouched. It is the mechanism behind the compact-session skill's single manual mode, where a compaction is requested or offered at a turn's end and the swap is performed by a typed `/resume`.

`docs/compaction-engine.md` is the full mechanism document: the plan model, turn segmentation and the `--keep N` fallback, the summarizer contract, the emitted transcript's single-chain guarantee, failure paths, and tuning knobs.

## External integrations

- **The `claude` CLI** is spawned headlessly by the engine to summarize, pinned to a model, with hooks disabled and all tools denied. `claude` must resolve to a native executable rather than an npm `.cmd` shim, because the prompt carries transcript-derived text on argv.
- **Bun** runs the engine and its tests. **Node** runs the hooks.
- **git and the GitHub CLI** are what the branch-hygiene, PR-docs, and merged-PR-push guards observe and act on.
- **The local filesystem under `~/.claude/`** is shared state: `projects/<sanitized-cwd>/<session-id>.jsonl` for transcripts, `magic-compact/` for the omission caches, the ledger, and parse-failure debug output, and `kit-events.jsonl` for the goal release events above, the kit's one outbound machine-readable feed.
