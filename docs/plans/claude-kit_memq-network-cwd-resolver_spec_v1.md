# The memq resolver stands down on a network working directory, at every verb that walks it

Status: In Progress
Commit Model: Commit-and-Push
Created: 2026-08-26

Session model: Opus, in a clean session opened in the kit repo. This plan is the shared-resolver half deliberately left out of `claude-kit_memory-anchors-and-frontmatter-guard_spec_v1.md` Section 7, whose Critical finding established the defect and fixed it at four command entry paths. Anchors below are as of commit `1567b38`; re-locate by content.

## Dispatch Authorization

Authorized 2026-08-27 by the operator: arming and execution of the four remaining queue plans by a worker session in this repository on this machine, in order: seat-infrastructure, then memq-network-cwd-resolver, then review-and-record-discipline, then plan-lifecycle-and-diagnostics, each plan honoring its own recorded start condition. This grant supersedes the same date's earlier grant, which placed a three-plan slate behind an armed testing-discipline and memq-network queue: the operator promoted seat-infrastructure ahead of memq-network-cwd-resolver, and the earlier queue's leash did not survive the session that held it, so memq-network-cwd-resolver now carries its own section rather than riding an armed goal. The grant was given at the keyboard of the KIT: Expert session in this repository, in that session's own conversation, and is recorded here by reference rather than quotation, per the public-repository convention. One grant covers the four plans, each carrying its own section pointing at it. This section was authored by the KIT: Expert seat on that keyboard instruction; per the peer-sessions trace rule it is a warrant only for a citing session that did not author it, and the receiving session performs its own trace of the grant before arming. That trace takes the form the peer-sessions rule states, provenance rather than credential: it reads this section's recorded claim, the commit that landed it, and the grant's scope against the action in front of it.

## Goal

`memq` hangs for the SMB timeout on an unreachable network working directory, at eleven of its fifteen verbs, before any of them can print a refusal.

The mechanism is one synchronous stat. `projectSegment` (`plugins/claude-kit/scripts/memq.js`:754) calls `worktreeMainRoot(cwd)`, which memoizes `resolveWorktreeMainRoot` (:556), whose first filesystem touch is `fs.statSync(path.join(cwd, '.git'))` (:559). On a working directory naming an unreachable share that stat blocks for the SMB timeout rather than failing fast, and it runs before the verb has done anything a user could see.

When this plan is done, every verb that resolves the project memory directory from the working directory refuses first, in words, naming the working directory as the reason, and no verb reaches that stat on a network path.

## Approach

The predicate already exists and is already single-sourced. Section 7 created `plugins/claude-kit/hooks/kit-network-lib.js`, exporting `namesNetworkShare(cwd)`, which `scripts/memq.js` re-exports under its own name and five hooks import. This plan adds no new judgment; it moves an existing answer to the seven doors it does not yet guard.

- **The gate goes at each verb's entry, not inside the shared resolver.** `projectSegment` sits behind all fifteen verbs and behind the memoization map, and four of those verbs (`add-type`, `add-operator`, `delete-type`, `delete-operator`) legitimately run from any working directory because the shared tiers do not depend on the project segment. Gating the resolver would refuse those four for a reason that does not apply to them, and would put a refusal decision inside a function whose contract is to return a path or null. Each verb refuses at its own door, in its own words, which is the shape Section 7 shipped at the four it covered.

- **A pin closes the door completely, and that is why the suite went green over this.** `projectSegment` returns the pinned segment before it consults `worktreeMainRoot`, so a pinned store never reaches the stat. Every existing memq network test in `test/memq.test.js` sets `KIT_MEMORY_PROJECT`, which routes around the walk entirely, so the suite is structurally blind to the defect: it proves the refusal speaks under the one condition where the hang could not happen. Every test this plan adds runs **unpinned**, and that is the control Standing Amendment 1 asks for.

- **The refusal joins each surface's existing not-checked vocabulary rather than minting a new one.** Section 7 established the wording at `cmdRecall`, `cmdDecayScan`, `cmdAnchor` and `cmdGet`; the seven verbs here say the same thing in the register each already uses for a refusal it cannot check past. A verb whose whole output is a digest says so as its digest; a verb that writes says nothing was written.

- **The memoization map is not a hazard and is not touched.** `worktreeMainRoots` keys on the cwd string and is per-process, so a refusal that returns before the first call leaves no entry, and no later call in the same process can be served a poisoned one.

## Evidence

- The hang: `plugins/claude-kit/scripts/memq.js` `resolveWorktreeMainRoot` :556, whose `fs.statSync(dotGit).isFile()` at :559 is the blocking call; reached from `worktreeMainRoot` :548 (memoized) and `projectSegment` :754.
- The pin short-circuit: `projectSegment` :755-756 returns `pinnedProjectSegment()` before `worktreeMainRoot`, and `anchorRoot` does the same, returning null on a pin before touching cwd.
- The three resolver doors, all of which reach `projectMemoryDir(process.cwd())` as their first statement: `memDirOrNote` :3656, `readMemDirOrNote` :3684, and `cmdLog`'s own direct call :3849.
- The eleven verbs that reach one of those doors, confirmed by call-site search rather than inferred: `cmdLog` :3849 (direct), `cmdFind` :4063, `cmdGet` :4997, `cmdRecall` :5507, `cmdRecent` :6045, `cmdUnstamped` :6376, `cmdTouch` :6561, `cmdAnchor` :6936, `cmdDecayScan` :7603, `cmdDecayPrune` :9206, `cmdDecayDone` :11730.
- The four that do not, confirmed by reading each body whole: `cmdAddType` :9822, `cmdAddOperator` :10374, `cmdDeleteType` :10864, `cmdDeleteOperator` :10946. None references `memDirOrNote`, `projectMemoryDir`, `projectSegment`, `worktreeMainRoot` or `anchorRoot`.
- The four already fixed, and so out of scope here: `cmdRecall`, `cmdDecayScan`, `cmdAnchor`, `cmdGet`, per the anchors plan's Section 7.
- The predicate and its home: `plugins/claude-kit/hooks/kit-network-lib.js`, re-exported from `scripts/memq.js` :248.
- The suite: `node --test "test/*.test.js"` (the quoted-glob form; `node --test test/` fails MODULE_NOT_FOUND on Node 24.19.0). Capture the wall clock beside the counts.

## Standing Brief Amendments

The seven amendments in `docs/archive/claude-kit_memory-anchors-and-frontmatter-guard_spec_v1.md` (or `docs/plans/` until it archives) were earned on this same code and bind this plan's sections too. Three bear directly and are restated in force here; the other four are inherited by reference.

- **A not-checked answer never shares a value with a checked-and-clean answer.** A verb that stood down has not read an empty store. Each of the seven returns, in its report, the three answers it can give and the channel each travels on, with the evidence that a consumer on that channel receives it.
- **A symbol a later section must reuse is exported by the section that defines it.** The predicate is already exported; nothing here re-spells it, and a source-inspection pin holds that.
- **A remedy is proven in every environment and target state the emitting path admits.** Where a refusal names a way forward, the cell table is the deliverable: engine store signals present and absent, target present and absent, each cell carrying its exit code and first output line.

## Sections of Work

### 1. The seven remaining verbs refuse before they walk

Model: sonnet

Add the `namesNetworkShare` gate at the entry of the seven verbs Section 7 did not cover: `log`, `find`, `recent`, `unstamped`, `touch`, `decay-prune`, `decay-done`. The gate goes above the verb's resolver call in every case, which for `cmdLog` means above its direct `projectMemoryDir(process.cwd())` at :3849 and for the rest above their `memDirOrNote()` or `readMemDirOrNote()` call.

`find` is the one that needs a judgment rather than a transcription. Its semantic channel ranks every store on the machine and legitimately answers when the project store is absent (:4065-4068 says so), so a stand-down there refuses the project-tier lexical block and must not silently drop the semantic block that would still have answered. Either the semantic channel proceeds with the project tier declared not-checked, or the whole verb refuses and says which; whichever it is, the refusal says it in words and the report carries the reasoning.

`touch`, `decay-prune` and `decay-done` are writers, so their refusal states that nothing was written, on the pattern `cmdAnchor` already uses.

Tests, red first and every one of them **unpinned**: for each of the seven, a UNC working directory produces the refusal and no walk, against a local-path control that produces the verb's normal output, so the test proves the predicate speaks rather than that the verb happens to be quiet. Plus a source-inspection pin that the predicate is still spelled once, on the pattern the suite already uses, widened to admit these call sites.

Files in scope: `plugins/claude-kit/scripts/memq.js`, `test/memq.test.js`.

### 2. The skill says what a network working directory costs

Model: sonnet

`plugins/claude-kit/skills/memory-system/SKILL.md` describes how `memq` resolves its store from the cwd and enumerates the states that resolve a different or empty store (a plain subdirectory, a bare-repo worktree, a failed handshake). A network working directory is now a fourth state with a distinct answer, and the enumeration reads as exhaustive without it. Add it, and carry Standing Amendment 4's closure line for the enumeration.

Files in scope: `plugins/claude-kit/skills/memory-system/SKILL.md`.

## Out of Scope

- Gating `projectSegment`, `worktreeMainRoot` or `resolveWorktreeMainRoot` themselves. The four shared-tier verbs run correctly from any working directory and must keep doing so.
- The asynchronous or timeout-bounded stat that would let a network working directory resolve rather than refuse. Refusing fast is the whole goal here; resolving slowly is a different plan.
- The five hooks that already import the predicate. Section 7 covered them.

## Related

- `docs/plans/claude-kit_memory-anchors-and-frontmatter-guard_spec_v1.md`: the plan whose Section 7 created the predicate, fixed four of the eleven verbs, and named this remainder as a handoff. Archived on that plan's close; look under `docs/archive/` if it is not in `docs/plans/`.
- `docs/archive/claude-kit_testing-discipline_spec_v1.md`: the slate plan sequenced immediately ahead of this one, complete and archived. The two share `test/memq.test.js`, which that plan's Section 4 edited (a readiness barrier for the stale-lock race, and the type-lock test cut to two writers), so read its Chapter 4 before touching that file here. Its shared-setup coverage-gap pattern, where every test in an area shares the setup that avoids a hazard and the area is structurally blind to it, is what this plan's unpinned-test control applies.

## Chapters
