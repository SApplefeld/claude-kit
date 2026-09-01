# The store's git channel gets its own guard, so every caller inherits it

Status: Ready
Commit Model: Branch-and-PR
Created: 2026-08-31

Session model: any executor session in the kit repo. Authored by the KIT: Worker (Skills) seat as a routed handoff out of `docs/plans/claude-kit_standing-grants_spec_v1.md`, whose section 2 surfaced the defect and could not fix it without shipping code that plan's Approach forbids.

## Dispatch Authorization

None. This plan is parked and unauthorized: no operator act has approved it, and nothing in this document stands in for one. It is written now because the context that found the defect is fresh, not because it may start. A session finding this plan does not arm it; the operator's own say-so is what starts it.

The commit model is Branch-and-PR deliberately rather than the kit's usual Commit-and-Push. The change edits a PowerShell helper that every machine's unattended memory-store sync dot-sources, so its failure mode is every machine silently losing memory sync. That earns a human review gate before the merge, which Commit-and-Push does not provide.

## Goal

Move the git-invocation guard from the caller that first needed it onto the channel every caller runs through, so that a hand run of the memory store's sync script inherits the same environment hardening the unattended background run already gets.

The operating doctrine states the rule this plan applies: a sanitizing guard is a property of the output channel rather than of the producer that first needed it, so the moment a channel gains a second producer the guard moves to the shared boundary as an exported helper. The channel here is git-invoked-against-the-memory-store. It has just gained its second producer.

## Evidence

Every claim below was confirmed at the code, at the file and line named.

The guard exists and lives in the Node caller. `plugins/claude-kit/hooks/kit-git-lib.js:59-72` defines `gitChildEnv()`, which copies the process environment, deletes every key matching `/^GIT_/i`, then sets `GIT_TERMINAL_PROMPT=0` and `NoDefaultCurrentDirectoryInExePath=1`. `plugins/claude-kit/hooks/memory-session.js:852-862` passes that environment to the detached spawn of the sync script, additionally dropping `NODE_OPTIONS` and setting `GCM_INTERACTIVE=never`.

The guard does not exist in the script. `plugins/claude-kit/doctor/sync-store.ps1` contains zero `$env:` references. `plugins/claude-kit/doctor/install-memory-sync.ps1` contains zero `GIT_` references, and its `Invoke-MemorySyncGit` at `:355-364` is a bare `& $GitExe @all` that touches no environment. So every protection above is the Node caller's, and any other caller of the same script gets none of it.

Two callers now exist besides the hook. Any session on the box, the coordinator seat included, can run the script by hand, the coordinator skill's former store-push carve-out having been retired whole rather than narrowed. And two skills shipped on main today document a weaker path into the same store for any session: `plugins/claude-kit/skills/memory-system/SKILL.md:66` and `plugins/claude-kit/skills/finishing-work/SKILL.md:102` both spell `git -C ~/.claude pull --rebase` followed by `git -C ~/.claude push`, which is bare git under the session's own environment with no allowlist probe, no inbound tree screen, and no lock.

The exposure is not limited to the push destination. The operator-tier memory record `git-env-config-pins-beat-repo-local-config` documents, with a measured two-direction verification on git 2.55.0.windows.3, that `core.fsmonitor` and `core.hooksPath` are ordinary repo-local config keys git honours on an ordinary read, so a bare `git status` against a planted repository executes that repository's code. The sync script runs status-shaped reads. That makes the missing scrub a code-execution surface on a wrong or planted store root, not only a redirection surface on the push.

The ownership gate diverges in the same direction. `plugins/claude-kit/hooks/memory-session.js:776` gates on the `--local claudekit.memorysync` config key, and the comment at `:757-774` states that choice is deliberate because the marker-bearing `.gitignore` that `Test-MemorySyncRepoIsOwn` also accepts "rides into a clone (and could be planted by a hostile repo)". The script's own test at `plugins/claude-kit/doctor/install-memory-sync.ps1:277-278` returns true on that weaker `.gitignore` evidence before it ever reads the key at `:280`. So the script's self-check is the forgeable one, and `docs/security-model.md:65` already states that ownership rather than the path is the security gate.

## Approach

The guard moves into `Invoke-MemorySyncGit`, which is the single funnel every git call in the sync path already passes through, so one edit covers the whole channel and no caller has to remember anything. The hook's own `gitChildEnv()` stays where it is: it guards the Node-side git calls, which do not route through the PowerShell helper, and the two implementations are pinned against each other rather than merged, since neither language can call the other's.

The suppression is not a bare strip. Per the memory record's measured residual, pointing `GIT_CONFIG_GLOBAL` at an empty file also drops `safe.directory`, whose absence surfaces as a dubious-ownership refusal that reads like a permissions bug. Any entry the store genuinely needs is re-added through the same `GIT_CONFIG_KEY_<i>` channel rather than the suppression being abandoned.

Verification is two-direction by construction, on the record's own instruction: a one-direction test proves nothing, because a marker that never appears may mean the hook never fired for an unrelated reason.

## Decisions

The scope question was ruled during the standing-grants plan's section 2 and is recorded here so it is not re-litigated. Hardening the script was considered for that plan and declined on three grounds: its Approach line reads "Prose contract end to end; no code ships"; the helper is dot-sourced by every machine's unattended runner, making it the highest-blast change available under that plan's push-straight-to-main model; and doing it there would spend the risk budget on the better of the two hand paths while leaving the documented bare-git one untouched. The work is real and belongs in its own plan with a review gate, which is this one.

The expert seat's read, recorded as a claim weighed rather than a ruling adopted: it held that the channel-guard rule makes the hardening in-scope for the standing-grants plan, since it changes what a hand run inherits rather than what the run may do. That argument does not reach the Approach line, which is the fact the decision turned on.

## Sections of Work

### 1. The channel takes the guard
Model: opus

`Invoke-MemorySyncGit` builds and passes a hardened child environment for every git call it makes: every `GIT_*` key stripped, `GIT_TERMINAL_PROMPT` refused, `core.fsmonitor` and `core.hooksPath` pinned inert through the `GIT_CONFIG_COUNT` / `GIT_CONFIG_KEY_<i>` / `GIT_CONFIG_VALUE_<i>` channel, and any `safe.directory` the store needs re-added through that same channel rather than lost to the suppression.

Acceptance: a planted repository whose `core.fsmonitor` and `core.hooksPath` both append to a marker file is run both ways, and the marker appears without the guard and does not appear with it, both directions captured in the run's own output. The unattended path's behaviour is unchanged, shown by the memory-sync suite passing against a recorded baseline.

Tests: the two-direction planted-repo probe above, left as a durable test rather than a scratch script, since the whole claim is a behaviour no static reading can establish.

### 2. The two implementations are pinned against each other
Model: sonnet

Nothing today would notice if the Node guard gained a key the PowerShell guard did not. Add a pin asserting the two carry the same protections, so a later edit to one surfaces as a red rather than as a silent divergence.

Acceptance: the pin goes red when a key is added to one side and not the other, shown by a control that makes exactly that edit against a copy and leaves both files present and grammatical.

### 3. The documents catch up
Model: sonnet, Locus: inline

`docs/security-model.md` currently describes the environment hardening as a property of the background spawn, at the sections its Principals and hook-invocation passages own, and `:498` states "The child environment carries no `GIT_*` variable" as though it held for every caller. Both take the correction once the guard is on the channel. The exposure was named in the coordinator skill's store-push carve-out, which has since been retired whole, and `docs/security-model.md` is where it now belongs and is what this plan's completion re-reads against the new behaviour rather than leaving standing.

## Out of Scope

The bare-git manual push the two shipped skills document. It is the weaker path and it is real, but replacing it is a contract change to two skills with their own readers, and this plan is about the channel rather than about which path a skill recommends. The standing-grants plan's section 4 already owns those two sites.

## Related

- `docs/plans/claude-kit_standing-grants_spec_v1.md`, whose section 2 surfaced this and routed it here.
- Operator-tier memory `git-env-config-pins-beat-repo-local-config`, which carries the technique, its measured verification, and the `safe.directory` residual.

## Chapters

(none yet)
