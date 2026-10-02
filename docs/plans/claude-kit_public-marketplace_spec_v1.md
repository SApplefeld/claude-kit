# A public marketplace repository carries the three plugins and nothing else, filled by a tag-triggered publish job from each private repository, so the source repositories can go private

Status: Ready
Commit Model: Branch-and-PR
Created: 2026-10-02

## Dispatch Authorization

The ARCHITECT persona wrote this plan on 2026-10-02 on the operator's decisions of 2026-09-28, recorded in `docs/backlog.md` under "Plugins-only public distribution across all three repos", and his rulings of 2026-10-02 on the ARCHITECT's channel: the public repository is `SApplefeld/plugins`, the fleet's hosts uninstall every plugin and reinstall only from the public marketplace, the private clones stay for development, releases are cut by tag, and llm-wiki goes private with a cleaned public copy under its own plan. It is the fourth of the rename's four plans and the carrier of the shared design: the persona repository's `agent_persona_public-marketplace_spec_v1.md` and the relay repository's `channels_public-marketplace_spec_v1.md` are its two siblings, each adding the same job to its own repository. It has one precondition, on dispatch: `claude-kit_grimoire-rename_spec_v1.md` has merged, so the plugin folder is `plugins/grimoire/`. The coordinator queues it for the kit's worker then. Three prerequisites are the operator's and sit under `## Operator Verification`: creating the public repository, installing the deploy key and the banned-words list as secrets in each private repository, and enabling Actions there, which the ARCHITECT's account cannot read or set. While the three source repositories are public, no commit, pull request, Chapter or brief on this plan spells any word on the banned list or the path of a file that leaks one, per the operator's correction of 2026-09-28.

## Goal

A public GitHub repository `SApplefeld/plugins` holds `.claude-plugin/marketplace.json` naming the marketplace `applefeld` with three entries, `grimoire`, `personas` and `relay`, a short README for an installer, and one folder per plugin that holds only that plugin's runtime files. Each private repository carries a GitHub Actions workflow that runs on a pushed tag matching `publish-*` and on a manual run, assembles a snapshot from a committed allowlist of paths, fails on any path from a plan, backlog, kaizen or scratch zone and on any word from a list held only as a repository secret, and pushes one commit that replaces the public repository's folder for that plugin over an SSH deploy key, serialized per repository. The kit's job also seeds the marketplace file and the README when the public repository lacks them. A clean machine adds the public marketplace and installs all three plugins, and the operator then takes the three source repositories private.

## Intent

The frame, in the operator's words. On 2026-10-01 through the kit worker's thread: "We wanted to make GitHub Actions so that they could deliver to a singular public repo that would be shareable with people I trusted or people that I wanted to see it. It would contain all three plugins in a singular marketplace entry. They would get commits pushed to them when the private plugins with all of our capabilities wanted to publish. The idea was to make a singular plugin that was installable for the full functionality of personas, plus Discord channels, plus what is currently named Claude Kit (but without any of the documentation, docs, plans, backlog, or history, just the core functionality of the plugin in a singular public repo with three entries that is all installable from one place)." On 2026-10-02 on the ARCHITECT's channel: "Plugins is a good new repo to contain them all"; "we will uninstall everything from Claude and reinstall only the public plugin. We'll keep the private repos clones locally for work"; "we can tag for releases"; and on the marketplace name, the ARCHITECT's reading that it stays `applefeld` so every install id keeps its shape, which he did not contradict.

What done needs to do. Three publish jobs, one per private repository, each built from the same two scripts and its own allowlist. The public repository's catalog and README, seeded once by the kit's job from files this repository commits. A gate that never prints the word it matched. A release section in each private README. A clean-machine install before the flip. The fleet's reinstall and the flip are the operator's.

What done does not need to do. It does not carry the private repositories' history into the public one: each publish is one commit replacing one folder. It does not publish `home/`, `settings/`, the doctor's launcher at the repository root, the tests, the sidecar, the tools or any document. It does not make the publish run on a push to trunk. It does not build llm-wiki's publish, which takes its own plan once the operator writes its remote address. It does not change the private marketplaces, which stay for `--dev` loads from a clone.

Alternatives refused. One workflow in the public repository pulling from three private ones: refused, since it would need a read credential for each private repository and would run in the public repository where anyone can read the logs. A denylist of paths instead of an allowlist: refused on the operator's 2026-09-28 decision, since a new private file ships by default under a denylist. Publishing on every push to trunk: refused on the same decision; a tag is a deliberate act. The banned-words list in any repository: refused, since the list itself is the leak. One shared copy of the scripts fetched at run time: refused, since the kit repository goes private and the fetch would need its own credential.

Rulings after the spec shipped: none yet.

Provenance: written by the ARCHITECT persona, session 57239bb8, on 2026-10-02, from the 2026-09-28 decision record and the operator's rulings of 2026-10-02.

## Approach

**The public repository's shape.** `SApplefeld/plugins`, created by the operator, default branch `main`. At its root: `.claude-plugin/marketplace.json`, `README.md`, and `plugins/grimoire/`, `plugins/personas/`, `plugins/relay/`. The marketplace file names the marketplace `applefeld`, the owner as in this repository's marketplace file, and three entries: `grimoire` with source `./plugins/grimoire`, `personas` with source `./plugins/personas`, and `relay` with source `./plugins/relay/plugins/relay`. The relay's installed plugin is a shim that runs the broker from a live checkout, so its folder is a root-layout snapshot of its repository holding the broker, the wrapper and the install scripts, and the entry points at the manifest two levels in. No entry carries a `version`, so installs follow commits. The marketplace name is the one this host's kit install already uses, so `grimoire@applefeld` and the kit lookup in the persona plugin do not change; the fleet's private `applefeld` marketplace is removed from each host before the public one is added, since one machine cannot register two marketplaces under one name.

**The seed files, in this repository.** `tools/publish/public/marketplace.json` is the catalog above, and `tools/publish/public/README.md` is the installer's page: the three install commands, that the kit's session hook offers to wire its doctrine import and its doctor ships inside the installed payload, that the persona plugin's supervisor runs from the installed folder, and that the relay needs a host install from its folder's install scripts. The kit's job copies both into the public repository only where the file is absent, so a later hand edit there survives.

**The allowlist, `tools/publish/allowlist.txt`.** One path or glob per line, relative to the repository root, resolved by `git ls-files` so an untracked file never ships. This repository's list is `plugins/grimoire/**`. Anything the list resolves that matches the forbidden set fails the assembly: a path under `docs/`, `kaizen/`, `.kit/`, `test/` or `tools/`, or whose file name carries `.test.`. The forbidden set is a second guard over the allowlist and the reason an allowlist mistake cannot ship a plan.

**The assembler, `tools/publish/assemble.mjs`.** Node, builtins only. Arguments: `--allowlist <file>`, `--out <dir>`, and `--strip-version` for the relay. It resolves the allowlist through `git ls-files`, applies the forbidden set, copies each file under `--out` preserving its path, strips `"version"` from `.claude-plugin/plugin.json` under the flag, and prints the count copied. An empty resolution is a failure, since a job that published nothing would read as a success.

**The gate, `tools/publish/leak-gate.mjs`.** Node, builtins only. Arguments: `--root <dir>` and `--words-file <file>`. It reads the list, one word per line, trims and drops blanks, and scans every file under the root case-insensitively. On a hit it prints the file's path and line number and nothing else, since the word must never reach a log, and exits 1 after the whole scan. An empty list is a failure, since an empty secret would pass everything. GitHub masks a secret's value in logs, and the gate prints no matched text regardless, so the two guards stack.

**The workflow, `.github/workflows/publish.yml`.** Triggers: `push` on tags `publish-*`, and `workflow_dispatch`. One job on `ubuntu-latest`, `concurrency` group `publish` so two tags serialize, Node 24. Steps: check out the tag; run the assembler into a temporary directory; write the secret `PUBLISH_BANNED_WORDS` to a temporary file and run the gate on the snapshot; set up SSH with the secret `PUBLISH_DEPLOY_KEY` and GitHub's host key; clone `git@github.com:SApplefeld/plugins.git` at depth 1; seed the catalog and README where absent; remove `plugins/grimoire` and copy the snapshot in; commit as `Publish grimoire from claude-kit at <tag> (<short sha>).` under a bot identity named in the workflow, or exit 0 with a notice when the tree is unchanged; push, and on a rejected push pull with rebase once and push again, since the three jobs write disjoint folders. The secret names are the 2026-09-28 record's.

**The siblings.** The persona and relay repositories each carry the same two scripts byte for byte under `tools/publish/`, their own allowlist, their own workflow with their plugin's name and folder, and no seed files. The persona repository's list is its runtime: `.claude-plugin/plugin.json`, `hooks/**`, `bin/**`, `skills/**`, `package.json`, `package-lock.json` and `tsconfig.json`, which is what the backlog's prerequisite (2) asked for in place of moving the plugin into a subfolder. The relay's list is its root layout minus documents and tests, with `--strip-version`. Each sibling plan names its own list.

**The tests.** `test/publish-assemble.test.js` runs the assembler on a fixture repository under a temporary directory: a list naming two files copies those two and no third; a list naming a path under `docs/` fails naming it; a list resolving nothing fails; the flag strips `version` and leaves every other key. `test/publish-leak-gate.test.js` runs the gate on a fixture tree: a planted word from a temporary list fails with the file and line on stdout and the word absent from stdout and stderr; a clean tree passes; an empty list fails. Both run under `node --test test/*.test.js`.

**The README's release section.** `README.md` gains a section saying how a release is cut: tag trunk `publish-<YYYYMMDD>` or any `publish-` tag, push the tag, read the run, and what the job refuses. It names the two secrets by name and says the list's content lives nowhere in any repository.

**The scrub, prerequisite (1).** The backlog names a client word in one style reference. The worker asks the operator for the word on its thread, runs the gate locally with a temporary list holding it over the assembled snapshot, and rewrites the hit to a generic word before the section closes. The Chapter records the file by path and the line, never the word.

## Sections of Work

### 1. The publish job, its two scripts, the seeds and the tests

Model: opus

Acceptance:
- `node --test test/*.test.js` is green against the baseline recorded before the section's first edit, with the two new test files' cases listed in the Chapter, and the planted-word case red against a gate stub that exits 0 before the gate is written.
- `node tools/publish/assemble.mjs --allowlist tools/publish/allowlist.txt --out <tmp>` on this checkout copies exactly the files `git ls-files plugins/grimoire` lists, the count in the Chapter, and a planted line `docs/README.md` in a copy of the allowlist fails naming that path.
- `node tools/publish/leak-gate.mjs --root <tmp> --words-file <a temporary list the operator's word is on>` passes after the scrub and failed before it, both runs in the Chapter with the file and line and no word.
- `claude plugin validate tools/publish/public` passes the seeded catalog's shape, with the three entries' sources absent on disk reported by install and not by validate, per the documentation.
- `.github/workflows/publish.yml` parses: `node -e` over a YAML reader is not available without a dependency, so the worker runs `gh workflow view publish.yml` after the first push and reads the workflow listed, or records that Actions is not yet enabled.
- `README.md` carries the release section.

Files in scope: `tools/publish/assemble.mjs`, `tools/publish/leak-gate.mjs`, `tools/publish/allowlist.txt`, `tools/publish/public/marketplace.json`, `tools/publish/public/README.md`, `.github/workflows/publish.yml`, `test/publish-assemble.test.js`, `test/publish-leak-gate.test.js`, `README.md`, and the one style reference the scrub rewrites.
Tests: the forbidden set over an allowlist entry, since the allowlist is hand-edited and the set is what keeps a plan out; the gate printing no matched text, since the log is public to anyone with read on the public repository's forks of the workflow output and the word is the leak; the empty list and the empty resolution failing, since a quiet pass is the failure mode of every gate.

## Out of Scope

- The persona and relay repositories' jobs, in their sibling plans.
- llm-wiki, under its own plan once the operator writes its remote address.
- Removing the private marketplace files or the `--dev` load path, which development keeps.
- The zip build and its pre-commit rebuild, which the Cowork upload flow keeps.
- Any mechanism that publishes on a push to trunk.

## Assumptions

- assumed 2026-10-02 (source: the operator's words on the ARCHITECT's channel, 2026-10-02): the public marketplace is named `applefeld`, since the fleet's hosts uninstall every plugin and reinstall from the public repository alone; reversal: a name he gives instead, which changes one field in the seed catalog and the persona plugin's installed id in its sibling plan.
- assumed 2026-10-02 (source: `plugins/relay/launch.mjs` in the relay repository, read 2026-10-02, which runs the broker named in a registration the wrapper writes from a live checkout): the relay's public folder is a root-layout snapshot and its entry's source is `./plugins/relay/plugins/relay`; reversal: a hoisted layout, which changes the relay's allowlist and the install scripts' relative paths, and is the relay plan's to carry.
- assumed 2026-10-02 (default): the two scripts are copied byte for byte into the two sibling repositories rather than fetched, and drift between the copies is a known cost until a shared private package exists; reversal: none needed.
- assumed 2026-10-02 (source: the 2026-09-28 record): the secrets are named `PUBLISH_DEPLOY_KEY` and `PUBLISH_BANNED_WORDS`, and the operator installs both, since the ARCHITECT's account holds write and not admin on the three repositories; reversal: other names, which change the workflow's two references.
- assumed 2026-10-02 (default): the blind read and the plan review run on this spec, since it carries the design the two siblings instance.

## Operator Verification

- Before dispatch: create `SApplefeld/plugins`, public, default branch `main`, empty. Generate an SSH key pair, add the public half as a deploy key with write access on `SApplefeld/plugins`, and add the private half as the secret `PUBLISH_DEPLOY_KEY` in each of `claude-kit`, `agent_persona` and `discord-channels`. Add the secret `PUBLISH_BANNED_WORDS`, one word per line, in each of the three. Confirm Actions is enabled on each. Tell the kit's worker the one client word on its thread, for the scrub.
- First publish, after this plan and the two siblings merge: tag the kit first, since its job seeds the catalog, then the persona repository, then the relay. Read each run green and the three folders present in the public repository.
- Clean-machine install: on a machine with no plugin installed, `claude plugin marketplace add SApplefeld/plugins`, then install `grimoire@applefeld`, `personas@applefeld` and `relay@applefeld`, start one session, and read the kit's doctrine offer and the persona plugin's tools present. A failure reopens the plan whose folder failed.
- The fleet's reinstall: on each host, with its supervisors stopped, remove the private marketplaces `applefeld`, `agent-persona` and `sapplefeld-channels` and their plugins, add the public marketplace, install the three, run the kit doctor with `-Fix`, and relaunch. The persona plugin's installed id changes to `personas@applefeld` at this step, which its sibling plan carries.
- The flip: only after the clean-machine install passes, take `claude-kit`, `agent_persona` and `discord-channels` private. The act is irreversible from the public side: forks, stars and inbound links are gone. Confirm each fleet host still updates: the public marketplace needs no credential.

## Open Questions

- llm-wiki's remote address, which the operator writes on the ARCHITECT's channel before its plan is written.

## Related

- `agent_persona_public-marketplace_spec_v1.md` in the persona repository and `channels_public-marketplace_spec_v1.md` in the relay repository: the two siblings.
- `docs/archive/claude-kit_public-surface-hygiene_spec_v1.md`: the earlier sweep of the public surface, whose disposition table is the precedent for naming a hit without its text.
- `docs/backlog.md`, "Plugins-only public distribution across all three repos (2026-09-28)": the decision record this plan executes, retired at its close-out.

## Chapters
