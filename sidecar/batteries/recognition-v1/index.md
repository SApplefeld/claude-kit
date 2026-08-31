# Project memory: claude-kit

- [Run the suite as `node --test test/*.test.js`](test-suite-invocation.md) - the bare directory form dies with module-not-found on Node 24 before running anything
- [The suite is not zero-fail: one intermittent red and one this box makes permanent](suite-baseline-is-not-zero-fail.md) - baseline 1,875 tests / 1 fail; the memory-session path-length red is this machine's short TEMP, not a regression
- [Skill amendments collide with unchanged neighbours](skill-amendments-collide-with-neighbours.md) - the defect lives in the seam, so brief reviewers to read the whole file rather than the diff
- [The memq suite has two store harnesses](memq-suite-has-two-store-harnesses.md) - the fleet-signals harness refuses repair and delete, so the wrong fixture reads as a product bug
- [A peer session's memq write does not explain a memq red](memq-shared-tiers-couple-concurrent-sessions.md) - the suite redirects HOME to a fixture and skips when the redirect fails, so blaming a neighbour buries the real cause
- [The plugin zip size differs by PowerShell host](build-size-differs-by-powershell-host.md) - pwsh 7 and Windows PowerShell 5.1 write zips ~1.5 KB apart, so compare a build figure only against the same host

- [Warden-AI was evaluated and declined](warden-ai-evaluated-and-declined.md) - do not re-evaluate from its README; the five ideas worth keeping are banked in docs/plans/claude-kit_warden-adoption-candidates_notes_v1.md
- [Memory-store forks declined 2026-08-23: a verified witness date and a supersede reason](memory-store-forks-declined-2026-08-23.md) - the idle clock and the successor's body already carry both; reopen on a real need, not on prior art

- [memq display path normalizes where its filters do not](memq-display-normalizes-where-filters-do-not.md) - a rendered listing is never evidence a filter matches; prove a filter by its own count against a control

- [A running suite's liveness is the process list, never the output file](reading-a-running-suite.md) - `node --test` block-buffers a redirect, so a frozen line count is not a dead run, and wall clock is not comparable across runs under different contention

- [In a worktree-isolated session, some compound Bash shapes are refused](worktree-guard-refuses-compound-commands.md) - the isolation guard's trigger is a complexity heuristic with an unknown boundary, so `cd <worktree> && <cmd>` passes routinely while a heredoc write and the doctrine's `echo $? > run.exit` marker pattern are refused; reach for the Write and Grep tools, which it does not govern

- [A manual `/compact` never reaches the compaction gate](manual-compact-never-reaches-the-gate.md) - the PreCompact matcher is auto-only, so the in-code `not-auto` clause is anti-rewiring defence rather than a live path, it allows rather than refuses, and a manual landing spends no release marker

- [A merge that touches any hook leaves the build stamp stale, with no conflict](merging-hook-edits-staleness-the-build-stamp.md) - the stamp hashes bytes while git merges lines, so rebuild before gating a merge whose diff touches plugins/claude-kit/hooks/

- [Specs handed over by the KIT: Messaging session are pre-authorized to arm](kit-messaging-handoffs-are-pre-authorized.md) - decided 2026-08-25 by the operator; the peer-standing rule still holds for everything else, and this is the operator's own answer to it rather than a peer's assertion

- [A count restated on a second surface is an invariant nothing checks](a-restated-count-is-a-cross-file-invariant.md) - git merges both sides clean and no test asserts a prose number against its source, so read the count from the thing it counts at the moment you write it; a tightened rule is a cross-file change too

- [When a claim's subject is what a tool prints, the tool is the fact base](an-enumeration-about-a-tool-is-read-from-the-tool.md) - completing an enumeration from a neighbouring document reproduces that document's error with a second surface's authority behind it, and a completeness grep piped through `head` has silently become a sample

- [A kit feature you just built is not available until the install and your session view both advance](a-feature-built-this-session-is-not-installed-yet.md) - hooks, skills and the goal CLI run from the cache the session resolved at its own start, which a mid-session `claude plugin update` does not move, so read that copy before concluding a new flag is broken or the install is behind

- [A retired claim is swept by its meaning, never by the words that carry it](a-retired-claim-is-swept-by-meaning-not-by-words.md) - the phrase carrying a retired claim also carries true statements, so enumerate every occurrence and classify each against what the amendment changed; the class crosses files and kinds and survives a mandated neighbour sweep

- [A merge resurrects a plan's stale pre-execution copy beside its archive](a-merge-can-resurrect-an-archived-plans-stale-copy.md) - when the base predates both the creation and the archival, git sees two unrelated adds and keeps both; the tell is one filename in both docs/plans/ and docs/archive/, and the archive copy with its Chapters is authoritative
- [Archiving a plan updates two indexes, and docs/archive/README.md is not one](archiving-a-plan-touches-two-indexes-not-three.md) - that file is rules-only with no per-plan list, so the close-out moves docs/README.md (bullet plus its count sentence) and docs/plans/README.md, and derives the count by listing the directory

- [Two sessions on one kit checkout: the expert freezes commits while a worker runs](two-sessions-one-checkout-commit-freeze.md) - a commit by either session silently advances the other's HEAD, so the expert messages before any commit during a live run (leashed or not), both sides stage only what they changed, and a long run revisits the separate-worktree shape

- [A seat that declines to give a direction names who acts](a-declining-seat-names-who-acts.md) - two seats each correctly declining produces a stall that reads like discipline; fold the name-who-acts clause into seat-infrastructure Section 3's standing-delegation block when it resumes
- [Unlazy was evaluated; one rule adopted, the machinery declined](unlazy-evaluated-one-rule-adopted.md) - the kit's specs, reviewers, and leash cover its gates-and-stop-hook territory; the keeper was positive controls for absence-proving acceptance checks

- [The doctrine has three copies and the third is a gitignored build artifact](doctrine-has-a-third-gitignored-copy.md) - plugins/claude-kit/claude-kit-doctrine.md is regenerated build staging, so a tree-wide doctrine grep returns three hits where two surfaces own it

Outcomes: outcomes.jsonl holds the action journal; query with memq find <term>.
- [Line endings here are git's, not the file's](line-endings-are-governed-by-autocrlf.md) - core.autocrlf=true with no .gitattributes, so every committed blob is LF and only the worktree diff a reviewer reads depends on preserving a file's endings
- [The first-turn reading is taken at `subagents/`, never at the returned output_file](first-turn-reading-path-is-the-subagents-dir.md) - the tool-returned output_file is zero bytes for every dispatch, so the never-started reading false-positives without a positive control
- [memq's `find` semantic channel is cwd-dependent](memq-find-semantic-channel-is-cwd-dependent.md) - it calls projectSegment(process.cwd()) itself, so a network stand-down refuses the whole verb rather than just the lexical block
- [A parity pin over data shape is blind to a divergence in control flow](parity-pin-over-shape-misses-control-flow.md) - two surfaces can agree on what a record carries and disagree on whether it is written at all, so a contract mirrored across surfaces needs one pin leg per axis
- [Factoring N call sites into one shared constant asserts that they are the same](factoring-call-sites-asserts-sameness.md) - the claim arrives in the one form that reads as tidiness, so trace each site to its writer before folding them together
- [A filename grep over test/ is not the whole pin surface](a-filename-grep-misses-a-test-that-walks-a-tree.md) - doctrine-parity walks plugins/claude-kit to depth 6 and names no file, so resolving pins by path literal silently misses it
- [The session-start git snapshot is a point-in-time reading](session-start-git-snapshot-goes-stale.md) - a `??` marker expires at the session's own first commit, so re-derive tracking with git ls-files before marking it confirmed
- [A finding's suggested fix carries a scope claim the finding itself does not](a-findings-fix-line-is-a-scope-claim-too.md) - confirm the observation, then ask separately whether repairing it needs acceptance the section lacks
- [Prose written to justify a rule invents the incident that would justify it](justifying-prose-invents-its-own-incident.md) - a consequence in the source becomes a past event in the draft; check the tense against the record
- [A routing claim is an intention until the target file holds it](a-routing-claim-is-an-intention-until-the-target-holds-it.md) - "routed to the backlog" written before the write freezes as though done; verify at the target, not the claim
- [An effort's base ref is the parent of its earliest commit, which may not be yours](an-efforts-base-ref-is-not-your-own-first-commit.md) - deriving from your own first commit silently narrows every reviewer's scope with no error
- [Adding a value to a vocabulary means finding its producer, not only its readers](a-vocabulary-value-needs-a-producer-not-only-readers.md) - a state with readers and no producer passes every test written about it and never happens
- [An unchallenged claim drifts from true to false because nothing exercises it](an-unchallenged-claim-drifts-because-nothing-exercises-it.md) - same silence-reads-as-agreement mechanism as an absence check that goes quiet for the wrong reason
- [Stating a rule is not the same as siting the guard it asks for](a-stated-rule-is-not-a-sited-guard.md) - a correct guard behind an unexported boundary stays true and stops being applied, and only a sweep sees it
- [Emitted text naming a runnable path routes around its gate](emitted-text-naming-a-runnable-path-routes-around-its-gate.md) - a slash spelling is a skill invocation only while no commands/ directory exists, and the skill load IS the authorization gate
- [The doctor's fix pass is never a neutral committer](doctor-fix-is-never-a-neutral-committer.md) - a marker-carrying managed file is rewritten by -Fix in the same act that commits a record, so a pending operator decision on a drifted file gets spent as a side effect; commit store records with a direct scoped commit while such a condition stands
- [Ask an ownership predicate in the tense of the actor, not of the reader](ask-ownership-in-the-tense-of-the-actor.md) - a guard whose answer is consumed by an actor that mutates the state it reads must be evaluated post-action, via the actor's own predicate
- [An identity sweep keyed on your own strings cannot find an arbitrary real identifier](identity-sweep-needs-the-source-of-truth.md) - cross-reference every UUID-shaped literal against the transcript store that would make it real; a keyword sweep reads clean on a real session id
- [A plan reaches the docs index only at its own close-out](plans-authored-elsewhere-never-reach-the-index.md) - plans authored by sibling seats accumulate unlisted; reconcile the roster against docs/plans/ at every close-out
- [A fix motivated by a sweep silently adopts the sweep's cleanliness as its acceptance criterion](a-sweep-driven-fix-adopts-the-sweeps-acceptance.md) - the rationale cites the checking apparatus rather than the consumer; the blind lens catches it
- [An absence check scoped by a directory list excludes whatever its author did not think of](an-absence-checks-scope-list-excludes-what-nobody-thought-of.md) - no control catches a scope hole, since the control runs inside the scope; scope as the tree minus exclusions
- [A control is blind to every failure it shares a derivation path with the pattern](a-control-is-blind-to-its-shared-derivation-path.md) - four faces (wording, scope, escaping, schema model); the catchers are a complement formulation and an instrument you did not build
