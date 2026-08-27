---
name: testing-discipline
description: "Use when writing a test, deciding whether a change earns one, choosing which tests to run after a fix, or reading a red or a wall-clock figure. Triggers: a new test or test file, a fix round tempting a full-suite re-run, a suite that reds only beside a busy neighbor, a wall clock that grew, a test reaching for a port, a spawn, or shared state."
---

# Testing Discipline

A suite has two costs and both are set one decision at a time: the authoring decision sets what the suite can see, and the gate decision sets what it costs to consult. This skill owns both, kit-wide. A specific repo's exact suite invocation and its lane commands are per-repo facts that live in that project's memory tier, so wherever this skill names a lane, look the command up there; nothing in this file is a command to run.

## What earns a test

A test is written for one of these:

- **An implementer's acceptance criterion**: the behavior the section was dispatched to produce.
- **A path no human drives by hand**: a hook, a CLI, anything only machines exercise, where no manual pass will ever catch a break.
- **A cross-surface pin**: a writer and a reader share a value (a wire field, a filter constant, a column list), and each side tested only against its own literal is how a mismatch stays invisible.
- **A defect that actually happened**: the regression test that pins the fixed cause.

The list is instances of one class: a contract whose break no gate short of a test reliably catches, whether because nothing renders the break to a human or because the human who would notice is not in its path. A candidate that pins such a contract earns its test even though no item names it.

What never earns one: an implementation mirror (a test restating a function's body, which breaks on every intentional edit and sleeps through defects), and an exact-wording assert on stderr or stdout text (pin the exit code, a stable token, or a machine-read field; the sentence is free to improve). The pair is instances, not the boundary: any assert that moves when the code is edited and holds when the behavior breaks belongs with them.

**Prefer one whole-tree pin to a test per function.** The shape that catches real defects is an invariant pinned across the whole tree: a roster or reflection pin over every member of a family, a derived pin that scans a source file, a cross-surface count assertion, a region-extraction test over real code, a fixture self-check. Those are instances of one class, an assertion that visits every member of a family and fails when any one drifts, and a new shape that does that is in the class. When a family gains a member, extend the family's pin, or write the family's first, rather than giving the member a private suite of function mirrors.

## The shared-setup blind spot

When every test in an area shares the setup that avoids a hazard, the area is structurally blind to that hazard: green proves the behavior under the one condition where the failure cannot happen. Pin the hazard with one test that does not share the setup. The kit repo's suite carries the worked example: the memq network tests in `test/memq.test.js` pin `KIT_MEMORY_PROJECT`, which routes around the cwd walk entirely, so every pinned test is blind to a hang in that walk, and the unpinned control beside them (the comment above it names the gap) is the one test that can see it. So when an area's setup is uniform, ask what the uniformity avoids, and give the area one test without it.

## Price the shape at authoring

The suite's wall clock and its parallelism are set when each test is written, not when someone finally profiles the suite. Each expensive shape has a cheaper form that sees the same defects:

- **A spawn per assertion** becomes a spawn per batch: run the process once, assert many times against its output.
- **A fixture built per test** becomes a fixture built once per process and copied: pay the build once, give each test its own copy to mutate.
- **A fixed port or shared mutable state** becomes an owned temp dir: a test that owns its temp state, opens no fixed port, and shares nothing mutable runs parallel forever, while one leaning on shared state serializes its file and hides the dependence until the runner goes parallel. Configure the runner parallel from day one, so a dependent test fails at birth rather than at the retrofit.
- **A real spawn only where the boundary is the subject**: a shell, a CLI, or a cross-process boundary is honestly tested by a real spawn; everything else is tested in-process. A real process spawn costs on the order of half a second to a second, so a suite that spawns per assertion spends its wall clock proving things about a wrapper nobody is testing.

The four are instances, not the boundary: any cost paid per test that could be paid once per process, and any shared resource that could be an owned one, takes the same trade.

## The lanes

Each gate moment names its lane, and running a bigger lane than the moment calls for is where the wall clock goes:

- **The targeted lane**, the changed files' tests plus any whole-tree pin whose subject those files are, runs after each fix. The second half is what makes the lane honest: a family's pin usually lives in a file of its own, so a lane derived from filenames alone excludes the very shape this skill prefers, and a change to a family member runs the family's pin whatever file it sits in.
- **The whole gate** runs at section close, at finishing, and before a push. After a fix round it runs only when the round's delta touches a shared module; a delta confined to leaf code takes the targeted lane.
- **The contention lane** sits apart from the main gate and holds the tests whose subject is genuinely machine-shared state (a machine-global tier, a real shared lock), each saying so in its own text. It runs serially, at finishing, before a push, and at section close whenever that section's delta touched the lane's subject, so a change to machine-shared state is never closed green by a gate that skipped the only tests covering it. A test in the main gate that needs the box to itself belongs here instead: moving it is the fix, not retrying the main gate until it passes.

The moments are closed by a default rather than by the list: any step not named above takes the targeted lane, and only the moments named above earn the whole gate.

A lane's delta is read against a baseline recorded on that same lane. A targeted run's counts describe the tests it ran and nothing else, so diffing them against a whole-gate baseline reports a difference the lanes themselves account for, and a claim of no regressions across the suite takes a whole-gate baseline of its own.

The lanes' commands are the per-repo facts named at the top: read them from the project's memory tier, and record them there when a repo first defines its lanes.

## Reading a red

A red is discriminated by protocol, not by re-running the world:

1. **Capture the exit code and the discriminating output from the run itself**: a foreground run's own exit status, or, for a backgrounded one, the marker the run writes and the error text in its own log. Never read either from a background wrapper's completion notification, which reports the wrapper's exit and nothing about the run inside it. Where an isolation screen refuses the marker compound, the fallback is a bare redirect plus the run's own summary output, which is still the run speaking rather than the wrapper.
2. **Solo, then class, then a full re-run with no code change, then a clean tree.** Solo separates the test from its neighbors; the class run separates the fixture from the box; the unchanged full re-run separates the code from the machine; and the same red on a clean tree, or already present in the baseline you recorded to diff against, separates a regression you caused from one that was there before you arrived. Skip that last rung and a deterministic pre-existing red gets named a regression of whatever change happens to be in flight.
3. **Name it flake or regression, with the reason, before moving on.** The reason cites the discriminating output from step 1, not the timing or the vibe of the failure.

## The clock and the box

Three rules keep a wall-clock figure honest:

- **Capture the clock with the baseline.** The suite's wall clock is recorded alongside the pass/fail counts already captured at a baseline, and the baseline names the lane it was run on, so a later run has a figure to diff against rather than a recollection and a comparable lane to diff it on. Growth past a few minutes is a finding to route (a fast lane for day-to-day edits, the whole gate before a push), never a fact of life to absorb.
- **Record the contention beside the clock.** Every wall-clock figure carries the box's process count and free memory beside it, captured at the run. Growth is a finding only against a baseline at comparable contention or a same-conditions trend, and the edge is observable rather than asserted: run the same suite on the same tree once with the box quiet and once beside a neighbor's suite, and the two figures show how much of any growth the load alone accounts for. Without that comparison a raw cross-load reading manufactures a finding out of a busy box.
- **Check the box before any suite.** Before starting a suite, check the process list for a test runner or build, whatever its engine, whether owned by another session or by a running engine, and either wait for it or name the contention in what you report. `testhost`, `dotnet`, `node --test`, and a build are instances, not the boundary: the class is any foreign process that holds the box's memory or CPU, or the repo's binaries, while your suite runs.
