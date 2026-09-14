# The read-only agent guard misses Go's glued shorthand flags, so a write API call spelled without a space walks through it

Status: Ready
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
