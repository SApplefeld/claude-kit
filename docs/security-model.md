# Security model

What the kit's local state assumes, what it guards, and what it does not claim. Written as preconditions that can be checked, because a premise stated as a reassurance ("the store is trusted") cannot be re-tested when something changes underneath it, and one did: the memory store's trust premise was accepted when the store was per-project, then invalidated when a machine-wide shared tier was added, and nothing forced a re-check.

## Principals

**Within one machine account, there is exactly one principal**: that account's user. Every project session, every dispatched subagent, and every hook runs as that user with full read and write access to `~/.claude`. Anyone who can write there already has code execution through hooks and `settings.json`, so no control in this document defends against that.

**Across the deployment, there are several.** The kit is shared with other team members, the repositories sync across multiple machines, and the same person operates it under two work accounts and one personal account. That means kit code, and any repository-carried configuration, crosses account and person boundaries routinely. A control whose only justification is "one person, one machine" is not justified here.

Three consequences follow, and they are why several of the sections below are stricter than a single-user store would warrant:

- **The store is not a security boundary between projects.** Per-project separation is a convention the tooling follows, not a control the design enforces. Any session can read and write any project's memory directory by resolving the path itself.
- **The shared project-type tier is a cross-person surface, not merely a cross-project one.** Content one person writes is read into another person's session context, wherever a type tier is shared rather than machine-local.
- **A repository is a distribution channel for configuration.** Anything a synced or shared repository can set for the shell that opens a session (`terminal.integrated.env.windows` in a committed `.vscode/settings.json`, a `devcontainer.json` env block, an `.envrc`) reaches an account that merely cloned it. Environment-driven behavior is therefore attacker-reachable in a way it would not be on a single-operator machine.

**What is machine-local versus shared is worth checking rather than assuming.** The kit payload is shared by design. Whether a given store directory syncs depends on how that machine is configured, and the tooling neither knows nor enforces the answer. Treat a type tier as shared unless you have confirmed otherwise for that machine.

## The memory store, per tier

The store lives at `~/.claude/projects/<sanitized-cwd>/memory/` (project tier) and `~/.claude/memory-types/<type>/` (type tier).

**Project tier.** Authored by that project's sessions, injected into context by the harness. Inside the trust boundary in the ordinary sense: the thing that wrote it is the thing that reads it.

**Type tier.** Authored by *any* project on the machine that declares `Project-Type: <type>`, and read into the context of *every* project declaring that type. This is a machine-wide shared read-and-write surface. A claim that no store-controlled content reaches a session's trusted context is false by design for this tier.

Two paths carry type-tier content into a model's context, and they are not equally guarded:

| Path | Guard |
|---|---|
| SessionStart index emission (`memory-session.js`) | Each line reduced to bounded printable ASCII, line count and line length capped, two-space indented so a line cannot forge an unindented block, framed as data rather than instructions |
| `memq get <name>` body | Length-capped, and for the type tier fenced the same way: provenance and a data-not-instructions line on stdout, every body line two-space indented so column zero stays the tool's own voice. Not charset-sanitized, because a body is a document where newlines and punctuation are legitimate content |

Both hops now carry the same fence, and the fence rather than the charset is the control on the body. Project-tier output is unfenced and unchanged: the project that wrote it is the project reading it.

## Storage properties

Plaintext, unversioned, outside git. The only recovery mechanism is a single-generation `.bak` written by `memq decay-prune`, which the next pass overwrites.

A credential, connection string, or token written into an outcome journal entry persists in the clear indefinitely. The only control preventing that is an instruction in the `memory-system` skill telling the model not to do it. There is no redaction, no scanning, and no mechanical guard.

## Environment overrides, and why they differ

Two variables redirect where the tooling looks, and they are deliberately gated differently:

- **`KIT_MEMORY_ROOT`** relocates the store root, and is honored only when `KIT_MEMORY_ROOT_ALLOW_DATA` is also set. It selects *which data reaches the model*. Set without its signal, it is ignored, the real store is used, and a note goes to stderr.
- **`KIT_PLUGINS_ROOT`** relocates the plugin payload the `memq` shim executes, and is honored only when `KIT_PLUGINS_ROOT_ALLOW_CODE` is also set. It selects *which program runs*.

Neither gate may be loosened to match the other, and the reason the store root carries one at all is worth keeping: it was originally ungated on the reasoning that it redirects data rather than code. The project-type tier voided that. The SessionStart hook reads the store, so a redirected root supplies content a session sees before the user types, which makes it a behavior-shaping input and not merely a data path.

The precondition the old gate rested on was **the launching environment is trusted**. In a deployment where repositories sync across machines, accounts, and people, that precondition does not hold: a committed `.vscode/settings.json` (`terminal.integrated.env.windows`), a `devcontainer.json` env block, or an `.envrc` sets environment for whoever opens the repository. The gate exists because cloning a repository must not be enough to steer what a session reads.

## The `memq.cmd` residual

On Windows, `memq` resolves to a different wrapper per shell: PowerShell resolves `memq.ps1` (arguments splat directly onto node), Git Bash resolves the extensionless `memq` (`"$@"`), and only a caller inside `cmd.exe` reaches `memq.cmd`.

`memq.cmd` forwards arguments as `%*`, which `cmd.exe` substitutes into the command line before parsing it. An argument carrying an odd number of double quotes therefore ends the quoted region, and a following `&` starts a second command. This is confirmed by probe, not theoretical.

What covers it: the `memq.ps1` and sh wrappers keep the two common shells off that parser entirely, `memq` strips double quotes from free-text fields at the write boundary, and the skill instructs the model to compose summaries itself rather than pasting raw tool output into an argument.

The limit of that coverage: the write-boundary strip protects stored *summaries and descriptions*, not memory *bodies*, which are length-capped only.

This one is rated higher than a single-operator store would warrant. With a shared kit and a shared type tier, a body one person wrote can reach another person's command line, so the exposure is no longer bounded by one operator's own paste.

## Locks are availability, not integrity

The lockfile serializes rewrites of shared files. Two properties to know:

- A lock path can be wedged by a directory, or by a file whose contents are valid JSON but not a lock record, either of which the stale-break correctly refuses to remove. There is no in-tool recovery; the fix is deleting the file by hand.
- `decay-prune`'s rewrite copies any bytes appended after its read onto the replacement before renaming, but a window remains between that copy and the rename in which one concurrent append can be lost. That is one usage stamp, and it matches the tolerance the sidecar's readers already carry for torn appends.

## Hooks fail open, and what that costs

Every kit hook swallows errors and exits 0 silently, by design: a hook bug must never trap a session. The monitoring consequence follows directly and is easy to miss.

**Absence of a nudge, a stamp, or a warning is not evidence of health.** A hook that cannot run, cannot resolve its dependencies, or cannot write produces exactly the same observable output as one with nothing to say. The hook canary exists because of this, and it probes cache consistency rather than correctness.

## Type-tier governance limits

The shared tier has no owner and no cross-project coordination beyond the lock:

- `memq add-type` refuses to overwrite an existing name, on the reasoning that another project may rely on it.
- `memq decay-prune --archive-type` now names the projects declaring that type before it retires anything, and refuses a retirement affecting more than one declaring project unless `--confirm-shared` is passed. The listing is printed either way, so a single-declarer retirement still shows what it acted on.
- One project's usage prune still collapses read and applied evidence that other projects of that type contributed, so a memory heavily used elsewhere can later scan as idle. This one is not closed: the prune has no equivalent declarer check.
- A tier whose last declaring project drops its `Project-Type` line becomes unreachable to the decay scan and prune, and its sidecar grows without a reader.

## Not claimed

- The "data, not instructions" framing on emitted index lines is a mitigation, not a guarantee.
- `memq`'s argument validation protects the *store's shape*. It does not protect the user's secrets.
- `decay-prune` is auditable, not reversible: it prints everything it removed and leaves one generation of backup.
- Nothing here defends against an actor who already has write access to `~/.claude`. Such an actor can already execute code through hooks and settings.
