---
name: testing-discipline
description: "Use when writing a test, deciding whether a change earns one or whether a test already in the tree still earns its keep, choosing which tests to run after a fix, or reading a red or a wall-clock figure. Triggers: a new test or test file, a test whose subject moved or was deleted, a suite audit, a test that reds on every intentional edit, a fix round tempting a full-suite re-run, a suite that reds only beside a busy neighbor, a wall clock that grew, a test reaching for a port, a spawn, or shared state."
---

# Testing Discipline

Lane commands are per-repo facts, so look each one up in that project's memory tier. Nothing in this file is a command to run.

## What Earns a Test

A test is written for one of these:

- **An implementer's acceptance criterion**: the behavior the section was dispatched to produce.
- **A path no human drives by hand**: a hook, a CLI, anything only machines exercise.
- **A cross-surface pin**: a writer and a reader share a value, such as a wire field, a filter constant or a column list, and each side tested only against its own literal hides a mismatch. A pin reading shipped prose normalizes `\r\n` to `\n` first, or it reds on every checkout that writes the file in `\r\n`.
- **A defect that actually happened**: the regression test pins the fixed cause on a stable form, such as a token, a direction, a field or a far end, never on the sentence the fix wrote. A defect commit earns the cause its pin. It does not exempt a wording pin from the wording class.

The list is instances of one class: a contract whose break no gate short of a test reliably catches. A candidate that pins such a contract earns its test even where no item names it.

**Requirement or choice:** a candidate that passes that class faces a second question before it is written. Could a session make the change this test forbids on its own authority, with nothing else needing to change? Where it could, the test pins a choice rather than a requirement, and it is not written. Where something else would have to change, it pins a requirement. That something can be a caller relying on the return, a guard that must refuse, or a writer and a reader agreeing on a field. It can be a shipped surface a reviewer can open that states or depends on the pinned thing, such as a script header, a comment at the guarded code, a skill or a charter. It can be code that reads a set at runtime to allow, deny or route, and must classify a new member first. A pin over such a set reds on a legitimate addition by design, and that red is the classification step. It is a requirement only where that runtime reader exists and the test derives at least one side from source.

A pin typing in the members or count of a list no code reads at runtime is a choice. So is a pin over a value a comment merely records, such as a five-second clamp. A count, a default, a configuration value, a wording, a menu's membership and a file's current structure are choices wherever only the test states them, or another surface states them only as current values.

Where a choice sits beside a requirement, reshape the test to pin the requirement alone, deriving any constant it needs. A requirement stated only in `docs/security-model.md` gains one sentence at the guarded code, since a blind reviewer may not open `docs/`. A whole-tree pin takes the same question. One asserting that two surfaces agree pins a requirement. One asserting that every family member meets a policy pins a choice, unless a shipped surface states the policy.

**The flag case:** what a flag is set to in a configuration is a choice, and it is not pinned. Four things about a flag are requirements. First, the guarded code runs when the flag is on and not when it is off, proved once each way. Second, the direction a guard takes when it cannot read its input. Third, an unparseable value degrades rather than throws, since a throw in a hook that swallows errors is a silent allow. Fourth, the exact value that disables a guard, since a looser match disables it more often.

**The price:** a test costs its wall clock times every future section that runs the gate, plus every future edit that reds it with no defect behind it. It is written only where the break it would catch costs more. The gate runs files in parallel, so its clock is the suite's total work across the workers, and a spawn in any file lengthens it. For a test that spawns a process, directly or through a shared helper, or builds a fixture per test, the Chapter states that trade. It names the file the test joins and the spawn sites it adds.

**Prefer one whole-tree pin to a test per function.** The shape that catches real defects is an invariant pinned across the whole tree: a roster or reflection pin over a family, a derived pin that scans a source file, a cross-surface count assertion, a region-extraction test over real code, a fixture self-check. Any assertion that visits every member of a family and fails when one drifts is in that class. When a family gains a member, extend the family's pin, or write its first, rather than giving the member private function mirrors.

## What Retires a Test

A test in the tree retires when it falls in one of these classes, and a candidate that falls in one is not written. Where the contract still needs cover, the repair replaces the deletion: a wording pin is re-pinned on a stable form, and a moved contract's test is repointed at its new home.

- **An implementation mirror**: a test restating a function's body, which breaks on every intentional edit and sleeps through defects.
- **A count pin a sibling leg already covers**: an assert that a family has seven members where nothing derives the seven and another assertion in the same suite catches the same drift. A count each side derives independently stays, and so does a hardcoded count that is the only detector of a symmetric removal.
- **An exact-wording pin on prose no identity contract covers**: an assert on stderr or stdout text, or on a curated sentence, where pinning the exit code, a stable token or a machine-read field leaves the wording free to improve. Where two or more surfaces carry one text by design, byte-identity is that text's contract and its pin stays, whether or not a registry names them.
- **A duplicate**: a test whose failure implies another's and which catches nothing the other misses.
- **An orphan**: a test whose contract no longer exists; one whose contract merely moved earns a repointed test.
- **A pin on a choice**: a test that goes red on an edit a session could make on its own authority with nothing else needing to change, where no shipped surface states or depends on the value, no code reads the set at runtime, and the test derives nothing from source. It retires whether or not a sibling duplicates it. The carve-outs above hold here too, as do a control leg and a pin over a set code reads at runtime. A refusal reason, a deny line or a report line is pinned on the tokens a reader acts on and on what must be absent from it, never on its sentence. Beside a requirement, the test is reshaped to pin the truncation rather than the 120, the agreement rather than the four, the direction rather than the sentence. A test the section edited to stay green on its own change falls here where the plan names no contract change behind the red, and that section reshapes or retires it rather than updating it. A test `docs/security-model.md` cites as a control, or as the only mechanical trace of a prose-enforced requirement, retires only in a section that amends that document to say what replaces it. Search the document for the test's file name and read the citing paragraph. Where it describes another test in the file, or says the file is not the control, no amendment is owed, and the Chapter's retire line says so.

A leg whose job is to prove the comparison beside it had something to compare is none of these, whatever its shape, since a control that cannot fail alone keeps its neighbor's silence honest.

The six are instances of one class: a test whose maintenance cost is not paid for. Its red indicates no defect, or it stays green while the behavior it pins breaks, or the defect it would catch is caught elsewhere, or its contract is gone. A candidate in that class is not written and a test in it retires, even where no item names it.

**The shape bar:** one focused test per stated behavior, sized like its neighbors, with a further test beside it only where its subject is what an earlier test cannot see. A shared-setup control, a flag proved in both directions and a withheld control are instances of that class rather than surplus. The doctrine's "Make the test earn its green" bullet governs a temporary repro.

**The lifecycle:** new code adds tests. Changed code adds tests and retires the ones its change orphans or turns into pins on a choice. Removed code removes its tests. A section that adds tests and retires none says why in its Chapter, whose contents executing-work owns. A section whose own change reddened or edited an existing test names each in its Chapter and rules it a defect, a contract change the plan names, or a choice. A red ruled a choice retires or reshapes the test in the same section. It is never settled by widening the assertion to admit the new value.

## Shared-Setup Blind Spot

When every test in an area shares the setup that avoids a hazard, green proves the behavior only under the one condition where the failure cannot happen. So when an area's setup is uniform, ask what the uniformity avoids, and pin that hazard with one test that does not share the setup.

## Price the Shape at Authoring

Each expensive shape has a cheaper form that sees the same defects:

- **A spawn per assertion** becomes a spawn per batch: run the process once and assert many times against its output.
- **A fixture built per test** becomes one built once per process and copied, so each test mutates its own copy.
- **A fixed port or shared mutable state** becomes an owned temp dir. A test that owns its temp state, opens no fixed port and shares nothing mutable runs parallel forever. One leaning on shared state serializes its file and hides the dependence until the runner goes parallel. Configure the runner parallel from day one, so a dependent test fails at birth rather than at the retrofit.
- **A real spawn only where the boundary is the subject**: a shell, a CLI or a cross-process boundary is honestly tested by a real spawn, and everything else in-process. A real process spawn costs on the order of half a second to a second, so a suite that spawns per assertion spends its wall clock proving things about a wrapper nobody is testing.

Any cost paid per test that could be paid once per process, and any shared resource that could be an owned one, takes the same trade.

## Test Lanes

Each gate moment names its lane:

- **The targeted lane**, the changed files' tests plus any whole-tree pin whose subject those files are, is what a fix round and a section close take, whatever the delta touched. A push after a section close is a moment of its own and takes the lane its own condition below names. A change to a family member runs the family's pin whatever file it sits in. Executing-work's Chapter template carries the duty to name the lane or lanes that ran, at its Gate field.
- **The whole gate** runs at finishing, before the plan's handoff, and before a push only where that push lands on a trunk consumers install from directly with no CI gating the merge. Finishing and the handoff are one moment rather than two: finishing's own full-suite run is the gate the plan hands off on. The pre-push moment keys on the surface, never on a repo's name, so a trunk that gains branch protections and a merge gate stops earning it with nothing here to edit. Finishing earns the gate even where downstream CI exists, because the plan hands off clean on our own evidence and CI is only a backstop. A merge takes the whole gate too: a clean merge can redden a suite with both parents green, in files neither parent changed, which no lane derived from the merge's own diff reads. A merge whose diff touches the sources a local build artifact is stamped from rebuilds before it gates. The merge leaves the stamp stale with no conflict to flag it. In the kit repository those sources are the files under `plugins/claude-kit/hooks/`, rebuilt with `build.ps1` or `build.sh`.
- **The contention lane** holds the tests whose subject is genuinely machine-shared state (a machine-global tier, a real shared lock), each saying so in its own text. It runs serially, beside the whole gate wherever the whole gate runs, and at section close whenever that section's delta touched the lane's subject. A main-gate test that needs the box to itself moves here, which is the fix, rather than the main gate being retried until it passes.

Any step not named above takes the targeted lane, and only the moments named above earn the whole gate.

Two of those moments, a push to a trunk consumers install from directly and a merge, run the whole gate mid-plan. Between them only targeted lanes read the tree, so a family the plan never touched can carry a red unseen. A peer whose own baseline reddens suspects the in-flight plan before its own change, and confirms by checking whether the red sits outside its own diff.

The doctrine's gate bullet ("After each step, run the lane the moment calls for, and report the delta") owns the same-lane baseline and the whole-gate baseline a no-regressions claim takes.

When a repo first defines its lanes, record their commands in that project's memory tier.

## Reading a Red

A red is discriminated by protocol, not by re-running the world:

1. **Capture the exit code and the discriminating output from the run itself**: a foreground run's own exit status, or a backgrounded run's marker and the error text in its own log. Where the environment refuses the marker compound, read the run's own summary output after the notification instead.
2. **Solo, then class, then a full re-run with no code change, then a clean tree.** Solo separates the test from its neighbors. The class run separates the fixture from the box. The unchanged full re-run separates the code from the machine. The same red on a clean tree, or in the baseline you recorded, separates a red that was there before you from one you caused.
3. **Name it flake or regression, with the reason, before moving on.** The reason cites the discriminating output from step 1, never the timing or the feel of the failure.

A red seen with another suite, build or embedding pass on the box that passes on a solo re-run is contention evidence. It goes to the kaizen inbox as a note stating which suite cannot share the box with what, whatever repository the suite belongs to.

## Clock and Box

- **Capture the clock with the baseline.** Record the suite's wall clock beside the baseline's pass/fail counts, and name the lane the baseline ran on. Growth established under the contention rule below, past a few minutes, is a finding to route, never a fact of life to absorb. The route is a fast lane for day-to-day edits, with the whole gate kept for the moments that earn it.
- **Moment-pin a measured figure.** A measured figure recorded in a journal-layer artifact carries a moment-pin: what produced it, when, on which machine, and under what contention. The machine is part of the pin: the configuration epoch a figure is read against is recorded per hostname, so a pin naming no machine can be placed against no epoch. The memory-system skill owns that record and the expiry rule that reads a figure against it. The doctrine's journey ban ("Documents ship the current state; the journey lives in git") defines the journal layer, and a plan doc's Chapters carry pinned figures under its append-only exemption. Within a plan doc, pinned figures sit only at its journal-layer sites: its Chapters, its interim board entries and its Evidence section. Elsewhere the ban holds, so a curated document, a code comment and a skill body carry no dated-evidence annotation. The deep evidence behind a figure, such as a scatter analysis or a multi-run comparison, lives in memory or in the plan's Evidence section, and a journal line cites it there. A figure at that home carries its evidence in full and cites nothing.
- **Record the contention beside the clock.** Every wall-clock figure carries the box's process count and free memory, captured at the run. Growth is a finding only against a baseline at comparable contention or a same-conditions trend. To see the edge, run the same suite on the same tree once with the box quiet and once beside a neighbor's suite, and the two figures show how much of any growth the load alone accounts for.
- **Check the box before any suite.** Before starting a suite, check the process list for a test runner or build, whatever its engine, whether owned by another session or by a running engine, and either wait for it or name the contention in what you report. `testhost`, `dotnet`, `node --test`, and a build are instances, not the boundary: the class is any foreign process holding the box's memory, its CPU or the repo's binaries while your suite runs. This poll is a sample, never a clearance. It cannot see in-process agent fan-out, which spawns no engine, and it cannot see a neighbor that starts after the sample and before the suite. A clean poll is a basis for starting and never proof the box is empty, so an overlap it missed is named as contention. A machine-state sentence leaving the session names the poll it rests on and its age, or says "not polled this turn". A run that dies partway through is contention evidence whatever poll preceded it, per the doctrine's machine-budget bullet ("One heavy process at a time is a per-machine budget, not a per-directory one").
