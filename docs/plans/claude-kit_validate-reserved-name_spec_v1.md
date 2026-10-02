# The pre-commit hook tolerates the reserved-name error Claude Code 2.1.287 raises on the plugin's name, so a commit touching the plugin lands again

Status: Ready
Commit Model: Branch-and-PR
Created: 2026-10-01

## Dispatch Authorization

The coordinator persona relayed the plugin worker's finding on 2026-10-01: Claude Code 2.1.287's `claude plugin validate` rejects the plugin name `claude-kit` as reserved, and `.githooks/pre-commit` runs that validation on every commit touching `plugins/claude-kit/`, so no session on a 2.1.287 host can commit a plugin change. The coordinator put three options to the operator over the relay, narrow the hook, rename the plugin, or hold, and recommended the narrowing. The ARCHITECT persona wrote this plan for the narrowing on its design remit the same day. It has one precondition, on dispatch: the operator rules for the narrowing on the coordinator's ask. A ruling for the rename closes this plan unrun, and the rename takes its own plan. A ruling to hold parks it. The coordinator queues it for the kit's worker once the ruling lands.

## Goal

A commit touching `plugins/claude-kit/` passes the pre-commit hook on a 2.1.287 host when the validator's only error is the reserved-name error on the manifest's `name`, and still fails on any other manifest error and on any error in the plugin's contents. The hook says in one line that it tolerated the name, so the tolerance is visible on every plugin commit until the rename retires it. The README's install step says the same error is expected from the two validate commands it lists. A test pins the filter's four cases. When this ships, the kit's worker commits the Jev code-checks section that has sat green and uncommitted since the fleet moved to 2.1.287.

## Intent

The coordinator's proposal, 2026-10-01: "Claude Code 2.1.287's 'claude plugin validate' rejects the plugin name 'claude-kit' as reserved, and .githooks/pre-commit runs that validation on every commit touching plugins/claude-kit/ ... Proposed fix: narrow the hook to tolerate only the reserved-name rule, with a rename to be planned separately." The ARCHITECT confirmed the finding on this machine's 2.1.287 build: `claude plugin validate --json ./plugins/claude-kit` exits 1 with one manifest error at path `name` whose message opens `Plugin name "claude-kit" is reserved`, and `code` is null, so there is no rule id to filter on. The marketplace at `.claude-plugin/marketplace.json` fails the same way at `plugins[0].name`. Two readings decide the shape. The validator keeps walking the plugin's contents under the reserved name: a copy with one agent file's frontmatter broken reported that file under `contents` beside the name error. So a hook that filters the manifest's errors loses none of the content checks the hook exists for. And a file with no frontmatter block is a warning on this build, not an error, so the plain validator the hook runs never failed on that case; the hook's comment at `.githooks/pre-commit:20` promises more than the validator delivers, which is found work this plan records and does not fix.

What done needs to do. The hook runs the validator with `--json`, hands the output to a filter, and fails the commit when any manifest error remains after the reserved-name error on path `name` is set aside, or when any entry under `contents` carries an error. The filter prints each remaining error in the validator's own `path: message` form, so the committer reads what the plain run would have shown. When the filter passes and the name error was present, the hook prints one line naming the tolerance. The filter lives in its own file under `.githooks/`, since a program on a `node -e` command line breaks on whichever quote the invoking shell owns, and the hook runs under `sh` on POSIX and under Git Bash on Windows. The README's install step keeps its two commands and gains one sentence saying each reports the reserved-name error until the plugin is renamed, and that the hook tolerates that error alone.

What done does not need to do. It does not rename the plugin: the name is in the install cache path under `~/.claude/plugins/cache/applefeld/claude-kit/`, the `enabledPlugins` key `claude-kit@applefeld`, the output style `claude-kit:Kit`, every agent and skill prefix a session types, the marketplace, `setup.sh`, `doctor.ps1` and the tests that read the plugin view, so a rename is its own plan with a migration for every installed host. It does not add a `version` to the manifest or make any gate run `--strict`. It does not make the hook fail on a missing frontmatter block, which the validator reports as a warning. It does not change the marketplace, which no hook validates.

Alternatives refused. Dropping the validation from the hook: refused, since the content checks still run under the reserved name and are what the hook was added for. Reading the JSON's `success` field: refused, since it is false whenever the name error is present and carries nothing the filter can use. Matching the message text alone, without the path: refused, since a future error about some other field could carry the word reserved, and the path `name` is the one the plugin's manifest produces. Renaming now, as the unblocker: refused for this plan, since the rename reaches every installed host and the hook is one file. Filtering inline with `node -e`: refused, since the kit's operator memory records that an apostrophe inside such a program ends the shell argument under Git Bash, and the filter's messages carry English.

## Approach

**The filter.** `.githooks/plugin-validate-filter.js` reads the validator's JSON from standard input. It takes `manifest.errors`, drops each entry whose `path` is `name` and whose `message` contains `is reserved`, and collects what remains. It takes every entry of `contents` and collects each one's `errors`, prefixed by the file. When nothing was collected it exits 0, and prints `reserved-name` on standard output when it dropped an entry, so the hook can print its tolerance line. When something was collected it prints each as `path: message` on standard error and exits 1. Input that is not JSON, or JSON with no `manifest`, exits 1 with the parse failure, since a validator that printed something else is not a pass.

**The hook.** The block at `.githooks/pre-commit:20` to `:27` keeps its shape. In place of the plain run it writes `claude plugin validate --json ./plugins/claude-kit` to a temporary file, since the validator's exit code is 1 whenever the name error is present and says nothing more. It runs `node .githooks/plugin-validate-filter.js` on that file, and on a non-zero exit prints the existing failure line and exits 1. On a pass whose output names the reserved name it prints `[pre-commit] tolerating the reserved-name error on the plugin name until the rename lands`. The `command -v claude` guard stays, and a `command -v node` guard joins it, since the filter needs node and the hook skips quietly where a tool is absent. The file is CRLF, and the edit keeps every ending: the worker counts byte 13 before and after, since the Git Bash `sed -i` strips every CR from a CRLF file.

**The test.** `test/githooks-validate-filter.test.js` runs the filter as a child process on four inputs built in the test: the reserved-name error alone, which passes and prints `reserved-name`; no errors, which passes and prints nothing; the reserved-name error beside a second manifest error, which fails and names the second; and the reserved-name error beside a content error, which fails and names the file and path. The inputs mirror the shape the validator printed on 2026-10-01, recorded under `## Intent`, and the fourth adds an `errors` entry to a `contents` item, since a content error was not observed and the filter's branch for it is the one a wrong shape would silently skip.

**The control.** Before the hook changes, a commit touching the plugin on this worktree fails at the hook, which is the finding. After the filter and hook land, the worker plants a second manifest error in `.claude-plugin/plugin.json`, one the validator reports as an error rather than a warning, and stages a plugin file: the hook goes red and prints the planted error. The plant is reverted before the real commit, which passes with the tolerance line. The Chapter records both runs' output.

**The README.** Step 2 under `## INSTALL (per machine)` at `README.md:168` keeps its two commands and gains one sentence after them.

## Sections of Work

### 1. The hook tolerates the reserved-name error alone, the filter is tested, and the README says what to expect

Model: sonnet

Acceptance:
- `node test/githooks-validate-filter.test.js` passes with the four cases, and the two failing cases were red against a filter stub that exits 0 before the filter was written, both runs in the Chapter.
- With a manifest error planted beside the name, a commit staging one plugin file fails at the hook and prints the planted error's path and message. Recorded in the Chapter, with the plant reverted after.
- With the plant reverted, a commit staging one plugin file passes the hook, prints the tolerance line, and rebuilds the zip as today.
- `.githooks/pre-commit` has the same count of byte 13 after the edit as before, both counts in the Chapter.
- `README.md` step 2 says the reserved-name error is expected from both commands until the rename and that the hook tolerates it alone.
- `docs/backlog.md` gains one item: the hook's comment promises to catch a frontmatter parse error, and on 2.1.287 a file with no frontmatter block is a warning the hook passes.
- The whole test suite is green against the baseline recorded before the section's first edit.

Files in scope: `.githooks/pre-commit`, `.githooks/plugin-validate-filter.js`, `test/githooks-validate-filter.test.js`, `README.md`, `docs/backlog.md`.
Tests: the filter's four cases, the two failing cases red first, the planted-error control on the real hook, the whole suite.

## Out of Scope

- Renaming the plugin, for the reach named under `## Intent`. It waits on the operator's ruling and takes its own plan.
- The validator's `version` warning and the `--strict` warnings.
- A hook check on the marketplace, which no hook validates today.
- The missing-frontmatter gap, recorded to the backlog by the section and not fixed.
- A later build that refuses to load or install a plugin under a reserved name. The fleet's installs load on 2.1.287 as the coordinator reports, and such a build makes the rename a precondition of every plugin plan.

## Assumptions

- assumed 2026-10-01 (source: `claude plugin validate --json` on this machine's 2.1.287 build, run on the plugin and on a copy with one agent file's frontmatter broken): the validator walks `contents` under the reserved name, so the filter loses no content check; reversal: a run whose `contents` is empty while a file is broken, which moves the plan to validating a renamed copy.
- assumed 2026-10-01 (source: the same runs, `code: null` on every error and warning): no rule id exists, so the filter matches on path and message text; reversal: a build that fills `code`, which the filter then matches instead.
- assumed 2026-10-01 (source: the 2026-10-01 run on the broken copy, which reported the missing frontmatter under `warnings`): the plain hook never failed on a file with no frontmatter block; reversal: none needed, the gap is backlog.
- assumed 2026-10-01 (default): the filter is a file under `.githooks/` rather than a `node -e` program; reversal: inline, where the operator memory record on `node -e` quoting is read first.
- assumed 2026-10-01 (default): the blind read and the plan review are skipped, since the spec is one section over one hook, one filter and one test.

## Operator Verification

- On a host whose `git config core.hooksPath` reads `.githooks`, after this merges, commit a change under `plugins/claude-kit/` and read the tolerance line in the hook's output.
- Rule on the rename, which this plan leaves standing as the lasting fix.

## Open Questions

- None.

## Chapters

