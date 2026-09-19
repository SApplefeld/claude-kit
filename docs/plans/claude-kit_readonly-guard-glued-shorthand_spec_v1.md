# The read-only agent guard misses Go's glued shorthand flags, so a write API call spelled without a space walks through it

Status: In Progress
Commit Model: Branch-and-PR
Created: 2026-09-14

Session model: any executor session in the kit repo; one section at opus. Authored by the KIT: Worker seat during the corpus-rewrite follow-up plan's finishing pass, which surfaced the hole and routed it out rather than fixing a hook its own Files in scope never named. Anchors are authoring-time; re-locate every hit by content.

## Goal

`plugins/claude-kit/hooks/readonly-agent-guard.js` is what stops a read-only dispatched agent, a reviewer or the consultant, from taking a write act. For `gh api` it denies two shapes: an explicit non-GET method, and a call that sends fields, since `gh api` with fields defaults to POST. The field test is a regular expression over each token, and it requires the flag to be followed by `=` or by the end of the token. Go's flag library, which the GitHub CLI uses, also accepts a shorthand glued straight to its value with no separator at all, so `-fquery=x` is a valid field argument that the test does not match. A read-only agent can therefore make a write API call by removing one space.

The hole predates this plan and nothing in the tree pins it. What changed its reach is the corpus-rewrite follow-up plan's fix round 9: finishing-work's auto-merge arm used to be `gh pr merge --auto --merge`, which the guard denies by verb whatever the flag spacing, and it is now a `gh api graphql` call that the guard denies only through this heuristic. The kit now ships, in a skill any agent can read, a write API call whose denial rests on the weaker of the two tests.

When this plan is done: the field test matches the glued shorthand forms, the method test is checked on the same axis rather than assumed, both are pinned by tests that were watched red against the current guard, and the arm spelling the kit ships is itself pinned as denied.

## Evidence

- The guard branch: `plugins/claude-kit/hooks/readonly-agent-guard.js:1011-1020`. The field test at `:1017` is `/^(?:-f|-F|--field|--raw-field|--input)(?:=|$)/`, which returns false for `-fquery=x`.
- The method test at `:1015` is `/^(?:-X|--method)=?(.*)$/`, whose trailing `(.*)` already absorbs a glued value, so `-XPOST` is matched. The two tests are written on different assumptions about the same flag grammar, which is the shape worth fixing rather than the one line.
- The CLI parses the glued form. Confirmed with a control on the installed `gh` 2.97.0: an invalid shorthand is refused at parse with `unknown shorthand flag: 'z'`, while `-fquery=x` parses and proceeds to the network. The control is what separates "the flag form is rejected" from "the flag form works".
- The arm the kit now ships is at `plugins/claude-kit/skills/finishing-work/SKILL.md:93`, as `gh api graphql -f query='mutation(...)' -f id=<node-id>`.

## Decisions

Decided 2026-09-14 by the authoring seat; reversible at arming.

1. **Fix the flag grammar, not the one spelling.** The remedy is a shared predicate that answers "is this token this flag, in any form the parser accepts", covering the separated form, the `=` form and the glued shorthand, used by both tests. A second regular expression alternation bolted onto the field test would leave the next reader to rediscover the same grammar.
2. **The shorthand set is closed and the long set is not.** Go's library glues only single-character shorthands, so `-f` and `-F` take the glued form and `--field`, `--raw-field` and `--input` do not. The predicate states that difference rather than treating all five alike, because a long flag with a glued value is not a thing the parser accepts and matching it would deny commands that are not write calls.
3. **The arm spelling is pinned as a test, not as a comment.** A test asserting the guard denies the exact `gh api graphql -f query=... -f id=...` shape finishing-work ships is what catches a future respelling of either surface drifting away from the other.

## Sections of Work

### 1. The flag predicate and its pins. Model: opus

Add a token predicate to `plugins/claude-kit/hooks/readonly-agent-guard.js` that answers whether a token is a given flag in any form the parser accepts: exactly the flag, the flag followed by `=`, and, for a single-character shorthand only, the flag followed directly by a value. Use it for both the field test at `:1017` and the method test at `:1015`, so the two read the same grammar. The method test keeps its existing behaviour of taking the value from the token or from the next token.

Tests in `test/readonly-agent-guard.test.js`, each watched red against the guard as it stands before the fix lands, since a test written after the fix proves only that the fix is present: `gh api graphql -f query=x` is denied; `-Fid=1` is denied; `-XPOST` stays denied, which the current guard already does and which the fix must not break; `--field=x` and `--field x` stay denied; the exact arm spelling finishing-work's step 7 ships is denied; and a read call, `gh api repos/o/r`, stays allowed, which is the control that the predicate has not started denying reads.

Files in scope: `plugins/claude-kit/hooks/readonly-agent-guard.js`; `test/readonly-agent-guard.test.js`.

Acceptance: every test above watched red first where it is meant to be red, then green; `node --test test/readonly-agent-guard.test.js` green with the delta named against a baseline recorded on that same command; `-fquery=x` denied and `gh api repos/o/r` allowed.

## Related

- `docs/archive/claude-kit_corpus-rewrite-follow-up_spec_v1.md`: the plan this was spun out of. Its finishing pass found the hole, confirmed both legs with a control, and routed the repair here rather than editing a hook no section of it named. Its Chapter 10 and Interim board 18 carry the evidence and the routing decision.
- `docs/backlog.md`, the item opening "A read-only agent can make a write API call by removing one space": the backlog record of this same finding, which names this plan as the repair shape.

## Chapters

### Interim board 1 - 2026-09-19

Section 1, the flag predicate and its pins, stands at step 4 with round 1 adjudicated and its fix round returned and verified. The section has not closed: the fix delta owes a round under the fix-delta bar, because it reaches a hook that emits an allow or deny decision, which is a surface step 3 names as the security lens’s trigger.

Live dispatches: none. Four have finished. `implementer-opus` was asked to build the section and returned DONE. `adversarial-reviewer`, `blind-reviewer` and `security-reviewer` were asked for round 1 and returned CHANGES_REQUIRED, APPROVED_WITH_CONCERNS and BLOCK. `implementer-opus` was asked for the round 1 fix and returned DONE_WITH_CONCERNS. All four reviewers and both implementers were read for their model on their own transcripts: the three reviewers ran at `claude-fable-5-1` and both implementers at `claude-opus-5`, so no dispatch was substituted below its assigned tier.

Gate baseline: measured 2026-09-19 on this worktree on SCOTT-CLAUDE, with the section’s work uncommitted and `kaizen/notes-SCOTT-CLAUDE.md`, `plugins/claude-kit/db/` and three `.agentic-*` files dirty from other sessions, no contention held during the runs and none polled at the time. `node --test test/readonly-agent-guard.test.js` before the section: tests 115, pass 115, fail 0, exit 0. After the section’s first build: 116/116/0, exit 0. After the round 1 fix: tests 118, pass 118, fail 0, skipped 0, exit code 0, duration 107811.4977ms. Every reading is from the run’s own exit code rather than a grep over its output. The delta across the section is +3 tests and no failure at any point.

Review-round backstop stage: section 1 has taken one review round, so the backstop has not fired and the count stands at 1 of the opening bound.

What round 1 found, in plain words. All three lenses independently found the same hole, and it is the plan’s own defect one keystroke over. The plan was written to stop a read-only agent making a write API call by deleting one space, as in `-fquery=x`. The guard the section built closed that spelling and still allowed the same call written `-iXPOST` or `-ifquery=x`, because the CLI’s parser lets a valueless shorthand stack in front of one that takes a value inside a single token. It was confirmed three independent ways: parse probes against the installed CLI run with no endpoint so nothing reached the network, a live read returning HTTP 200 on the clustered form, and two lenses running the worktree guard itself as a read-only agent and watching it allow eight write spellings. Rated Critical rather than Major because the subject is a live privilege boundary and the path is reachable by any read-only dispatched agent.

Its provenance is spec-traceable, so it took a fix round rather than a hold. It traces to the Goal sentence requiring the method test be checked on the same axis rather than assumed, and to recorded decision 1, whose predicate answers whether a token is a given flag in any form the parser accepts. A clustered shorthand is such a form.

Rulings and decisions adopted since the last boundary. The fix shape is the closed boolean-shorthand set that two lenses converged on, and the alternative of failing closed on any shorthand cluster was refused because it would deny `-pfquery=x`, which is a real read: `-p` takes a value, so that spelling is a GET with a preview named `fquery=x`. A second Major, that the auto-merge arm pin fed the guard a hand-copied literal and so could not detect the drift decision 3 created it to catch, was fixed by extracting the command from the skill file at test time with a hard failure where the pattern matches nothing. The alternative of narrowing the comment to what the literal proves was refused, because it would leave decision 3 with no instrument.

One finding was discarded rather than actioned, with the reason. The security lens observed out of scope that the guard denies `git stash list`, which is a read. Opening the cited code shows the over-block is deliberate and documented at `plugins/claude-kit/hooks/readonly-agent-guard.js:841-845`, alongside `git clean -nd` and `git apply --check`, on the stated ground that the mutating form is the dangerous one and the read-only form is cheap to lose, with a reviewer stashing the diff under review named as the catastrophic case. So it is a reasoned trade-off the author wrote down rather than an oversight, and it is neither folded, appended nor routed.

Two assumptions declared during this section, both route (b), low blast and reversible. Assumed 2026-09-19, section 1: `-h` is excluded from the boolean-shorthand strip set, because it short-circuits into help and reaches no request, so stripping it would deny a harmless help invocation; confirmed by running `gh api -hXPOST` on the installed CLI; reversal is to add it to the set, which costs denying that spelling. Assumed 2026-09-19, section 1: the boolean-shorthand set is left as a closed literal with no instrument that would catch a member a future CLI release adds, matching how the field-flag list already works; reversal is a test that shells out to the installed CLI, which would make the suite depend on a CLI version and a login.

A defect in my own dispatch brief, recorded because it nearly cost a false reading. The clustered arm respelling I specified for the fix round was already denied before the fix, because only its first field flag was clustered and the second, unclustered, denied the whole command on the old rule. The cluster therefore went untested by the case meant to test it. The implementer caught it, clustered both flags, and confirmed the corrected form allowed before the fix and denied after. A pin whose subject is reached by a different rule than the one under test reports the same green either way.

Next action for section 1: round 2, which runs round 1’s full roster at round 1’s tier, because a Critical survived round 1’s adjudication. Then the Minor close pass over the three entries in `.kit/scratch/claude-kit_readonly-guard-glued-shorthand_spec_v1/minors-section-1.md`, the plugin rebuild that a hook edit makes owed before any whole-suite run is trustworthy, the close gate, and Chapter 1. It is the plan’s only section, so finishing-work opens after it.
