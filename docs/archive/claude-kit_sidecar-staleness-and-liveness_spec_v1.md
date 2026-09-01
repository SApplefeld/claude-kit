# Sidecar staleness and liveness

Status: Complete
Author: SCOTT-CLAUDE Coordinator seat (draft, 2026-08-31); finalized by the Expert seat under operator rulings, 2026-08-31
Commit Model: Commit-and-Push

## What this is about

The judgment sidecar watches every session's completed tool calls, asks a local
model whether the call achieved its stated intent, and returns a one-clause
advisory to the session that made the call. It is an instrument for catching the
class of failure an exit code cannot: a command that succeeds and does not do
what it said.

The judging works. The delivery does not arrive in time to be useful, and on
2026-08-31 most of it did not arrive at all. This spec is about the pipe, not
the judge.

## Related

Extends the shipped instrument built by `claude-kit_judgment-sidecar_spec_v1.md`
(archived): same spool, same daemon, and the delivery caps this plan revises.

## The measurement

All figures computed 2026-08-31T20:02-20:14Z from the sidecar's own artifacts
under the state root (`spool/`, `logs/`, `inbox/`), by script rather than read
from any summary.

The judge is healthy and is not the constraint:

| Metric | Value |
| --- | --- |
| Judgment latency p50 / p95 / max | 1,087 ms / 2,917 ms / 8,405 ms |
| Recognition latency p50 / p95 / max | 1,028 ms / 3,067 ms / 8,877 ms |
| Timeouts against the 90,000 ms budget | 0 |
| Verdicts | 953: achieved 784, diverged 145, failed 24 |
| Divergence rate per session | 11 to 25 percent, no session an outlier |

`failed` is a judgment about the call rather than a sidecar error: 9 of 9
sampled `failed` records carry `isError: false`, meaning the tool call exited
zero and still did not do what it claimed. That is the most valuable class the
instrument produces and it is working.

The pipe is where it goes wrong:

| Metric | Value |
| --- | --- |
| End-to-end, call to verdict, p50 | 75 minutes |
| p95 / max | 111 minutes / 133 minutes |
| Model time as a share of that | about 1 second |
| Spool judged | 71 percent; 29 percent of bytes undrained |
| Inbox items delivered | 41 percent; 59 percent never reached a session |

The verdict stream has four idle gaps over its 265-minute span, two of them very
large: 74 minutes and 133 minutes. Total dead time is 211 minutes of 265. The
operator separately confirmed the daemon failed to start and sat offline.
Recomputed against live time only, the daemon judges about 17.6 verdicts per
minute against an arrival rate of 5.2, roughly 3.4x headroom on an 18 percent
duty cycle. The 75-minute end-to-end figure is a queue drained oldest-first
after an outage, not slowness, and the drain loop is strictly serial and
oldest-first by design (`sidecar/daemon.js`, the pass loop and `drainFile`).

## Decisions

- Decided 2026-08-31 (operator): the freshness horizon is 15 minutes. Past
  that, a verdict is no longer relevant to what the session is doing.
- Decided 2026-08-31 (expert, operator-confirmed): a stale-skipped entry is
  skipped for recognition as well as judgment, under the one horizon.
  Recognition costs the same model call as judgment, so recognizing a dead
  hour's backlog would spend exactly the drain time the skip reclaims, and the
  pointer delivers through the same inbox to a session that has moved on. If
  post-ship evidence shows valuable pointers being dropped, a second, longer
  recognition horizon is a small amendment; two horizons now is speculative.
- Decided 2026-08-31 (expert, operator-confirmed): newest-first draining is
  closed as not worth it. The single byte-offset per file encodes "everything
  before here is done" and makes crash recovery trivial; hole-tracking under
  crashes is where double-judging breeds. With stale entries skipped at near
  zero cost, the drain reaches fresh work within moments of restart, and inside
  the horizon oldest-first with 3.4x headroom keeps lag small by construction.
- Decided 2026-08-31 (expert): the dead-session inbox question closes on
  existing behavior. The draft's claim that undelivered queues are retained
  forever was wrong: the daemon already sweeps inbox files older than the
  14-day retention window, with a hold for files whose queue is still live
  (`sidecar/daemon.js:411-419`, `sidecar/spool.js:81`). A dead session's queue
  is private, bounded, and swept; no new mechanism is warranted.
- Decided 2026-08-31 (expert): the delivery-cap fix splits the overloaded
  constant rather than raising it in place. `INBOX_MAX_BYTES = 600` serves two
  jobs in the installed hook: the batch budget in `takeBatch` and the per-item
  truncation cap inside `fitComposed`. Raising it to 1,200 in place would let a
  single item bloat to 1,200 bytes. The split keeps the per-item cap at 600 and
  gives the batch its own 1,200-byte budget, making the stated batch of three
  reachable at observed item sizes (~358 bytes).
- Decided 2026-08-31 (operator): implementation runs in the Expert session
  rather than being appended to the armed worker queue, which is five plans
  deep while the daemon is mis-serving live sessions today.
- Decided 2026-08-31 (expert, at section 3 review): the batch budget is
  derived, not chosen: `INBOX_MAX_BYTES = INBOX_MAX_ITEMS * ITEM_MAX_BYTES +
  (INBOX_MAX_ITEMS - 1)` (1,802). The reviewed 1,200 failed the section's own
  goal: two at-cap items cost 1,201 and still broke the batch at one, and a
  fully populated real alert composes to ~510 bytes so three real items
  (1,532) capped at two. The derivation makes the three-item promise
  structural and leaves one knob (the per-item cap) plus one count. A
  structural guard in `takeBatch` takes a lone over-budget item regardless,
  so no relation between the constants can ever stall a session's queue with
  an undeliverable head item.
- Decided 2026-08-31 (expert, at section 1 review): contiguous stale skips
  are coalesced into dated, session-attributed gap-style records (reason
  `stale`) in the session log and findings file. The bare counter alone
  rendered a discarded backlog identically to a quiet fleet in the rollup's
  per-session and per-day sections, which is the reading the daemon's gap
  machinery exists to prevent. The spec's no-per-entry-record ruling stands;
  a coalesced per-stretch record is not per-entry spam.
- Decided 2026-08-31 (expert, at section 1 review): backlog held over by the
  busy-lane policy is NOT exempted from the horizon. An entry held past 15
  minutes is stale by the operator's ruling at the moment it can finally be
  judged; the gap-shaped stale record makes the drop visible, which is the
  legitimate half of the objection.
- Decided 2026-08-31 (expert, at section 2 build): the wrapper's stand-down
  line lands in the wrapper's own sibling log, `daemon-task.log`, under the
  same 5 MB rotation rule, because the wrapper's own output redirection holds
  `daemon.log` locked for the daemon's whole life; three append methods were
  proven to fail there with a sharing violation while a control write to a
  fresh sibling succeeded. Option B (re-plumbing the daemon's own output
  through a per-line pipeline) was rejected as risking the instrument's live
  logging path for a few lines an hour.
- Decided 2026-08-31 (expert, at section 2 review): heartbeat write failures
  are counted in their own persisted counter (`heartbeatFailures`), never in
  `writeFailures`. Two shipped consumers define every unit of `writeFailures`
  as a lost record (`rollup.js` renders "totals above are incomplete by that
  many records"; `battery.js` turns any delta into a cannot-measure), and a
  failed heartbeat loses no record. The rollup renders the new counter as its
  own clause and the battery excludes it from the lost-records reading, so
  the section's file scope widens to `sidecar/rollup.js`, `sidecar/battery.js`
  and their tests, mirroring section 1's fold. Per the Standing Brief
  Amendment, the counter-set carriers were swept as part of the same round.

## Standing Brief Amendments

- When a change alters a stated numeric bound, cap, or counter set, grep the
  repo for that value's other carriers (file header comments, CONTRACT.md,
  docs/, sibling modules whose comments justify their own constants by it)
  and disposition every hit: update it, or name it and the reason it is held.
  Both sections' reviews surfaced carriers left stating the old number; the
  class repeats, so the sweep rides in every brief.

## Sections of work

### Section 1: skip stale entries at the drain

Model: opus

After an outage the sidecar must not work through hours of old data to catch
up. An entry whose `capturedAt` is older than the freshness horizon at the
moment the drain reaches it is skipped rather than judged: no judgment call, no
recognition call, no verdict record, no inbox item. The offset advances past it
once the stretch's stale record is on disk (the same offset-behind-the-record
hold gap records take, bounded so it never spans a judgment call), and the
skip is counted.

- The horizon is a named constant in `sidecar/daemon.js` beside
  `DEFAULT_POLL_MS`, default 15 minutes, overridable with a
  `--stale-horizon-minutes <n>` argument through `parseArgs` like
  `--retention-days`.
- A new `stale` counter joins the persisted counters in `offsets.json`, because
  a silent skip and a healthy drain look identical from outside, which is the
  failure mode this whole instrument exists to prevent. A per-pass report line
  names the count skipped and the horizon when the count is nonzero; no
  per-entry log record, since an outage backlog would spam hundreds of lines.
- An entry with no readable `capturedAt` is judged rather than skipped: absence
  of a timestamp must not silently discard work.
- `sidecar/CONTRACT.md` is updated where it describes the drain and the
  counters.

Files in scope: `sidecar/daemon.js`, `sidecar/logs.js` (the persisted counter
set is declared in its `emptyState()`), `sidecar/rollup.js` and
`test/kit-sidecar-rollup.test.js` (the rollup enumerates counters by name, so
the skip count must reach the reader's surface too), `sidecar/battery.js` and
`test/kit-sidecar-battery.test.js` (a frozen replay has no freshness, so the
battery pins the horizon open and names the stale drop path in its findings),
`sidecar/CONTRACT.md`, `test/kit-sidecar-daemon.test.js`.

Tests: both directions in one run: a spooled entry older than the horizon is
skipped and counted with its offset advanced, and one inside the horizon in the
same file is still judged. Plus: the missing-`capturedAt` entry is judged, and
the `--stale-horizon-minutes` override is honored.

### Section 2: make a dead daemon visible

Model: opus

The daemon being down for 133 minutes produced no signal anyone noticed. A
stopped stream and a quiet fleet look identical from every surface a reader
has, and the daemon log's start banners carry no timestamps at all.

- Every line the daemon reports gains an ISO timestamp prefix, applied where
  the default `report` dependency is bound so tests injecting their own
  reporter see unprefixed lines unchanged.
- The daemon writes a heartbeat file, `logs/heartbeat.json` under the state
  root, carrying `{ v: 1, ts: <ISO>, pid: <number> }`: written at startup and
  then at most once per minute from the watch loop, so an idle daemon still
  proves liveness without churning the offsets file. `--once` runs write it at
  the pass. Machine-readable so any session or wrapper can check it.
- The scheduled-task wrapper's stand-down stops being silent: when
  `daemon-task.ps1` finds a running daemon and exits, it first appends one line
  to the wrapper's own sibling log, `daemon-task.log` beside `daemon.log`
  under the same 5 MB rotation rule, naming the running pid and the
  heartbeat's timestamp and age when the file is readable ("stood down:
  daemon pid N running, last heartbeat T, age Xs"). The line cannot go to
  `daemon.log` itself: the wrapper's own output redirection holds that file
  locked for the daemon's whole life, so a later task tick meets a sharing
  violation there by construction, which is exactly the task-started case
  the signal exists for. A present-but-wedged daemon then reads as exactly
  that, instead of as a task that "starts and immediately stops" with nothing
  to say why. The wrapper does not kill a non-progressing daemon; whether it
  ever should is the operator's later call, made possible by this signal.
- `sidecar/CONTRACT.md` documents the heartbeat file and its cadence.

Files in scope: `sidecar/daemon.js`, `sidecar/daemon-task.ps1`,
`sidecar/CONTRACT.md`, `test/kit-sidecar-daemon.test.js`; widened at review
per the Decisions entry on `heartbeatFailures` to `sidecar/logs.js` (the
persisted counter set lives in its `emptyState()`), `sidecar/rollup.js`,
`sidecar/battery.js`, `test/kit-sidecar-rollup.test.js`,
`test/kit-sidecar-battery.test.js`; plus `sidecar/install-daemon-task.ps1`
(one-line carrier fold: the installer's closing echo names both logs).

Tests: both directions: the heartbeat is observed advancing across passes while
the daemon runs, and observed stale (unchanged) once it stops, since a signal
only ever seen in the healthy state proves nothing about the state it exists to
detect. Timestamp prefix asserted on a reported line. The PowerShell wrapper
has no suite coverage (standing gap for installer scripts); its stand-down line
is verified by a real run at acceptance.

### Section 3: split the inbox delivery caps

Model: sonnet

The batch caps in the capture hook are `INBOX_MAX_ITEMS = 3` and
`INBOX_MAX_BYTES = 600` (`plugins/claude-kit/hooks/kit-sidecar-capture.js:544-545`).
Items average ~358 bytes, so the byte cap breaks a batch at one item and the
item cap of three is unreachable: a constant that reads as three behaves as
one.

- A new `ITEM_MAX_BYTES = 600` takes over the per-item role: the `fitComposed`
  calls in the alert and memory formatters cut against it.
- `INBOX_MAX_BYTES` keeps only the batch-budget role in `takeBatch`, as the
  derived invariant the Decisions entry states: item count times per-item cap
  plus separators (1,802), never an independently chosen number.
- Both constants stay exported; the comment above them states the two roles
  plainly so the next reader cannot re-merge them.

Files in scope: `plugins/claude-kit/hooks/kit-sidecar-capture.js`,
`test/kit-sidecar-capture.test.js`.

Tests: both directions: three ~358-byte items now deliver as one batch of
three, and a single oversized item is still cut at 600 bytes. Existing cap
pins updated to the new expected values, not deleted.

## Open defect, parked with its reason

`docs/security-model.md:267` still states the superseded delivered-volume
bound ("at most three items and 600 bytes of item text"); the shipped hook
delivers up to 1,802 bytes per call under the derived budget. The security
reviewer rates the stale statement Major, and it is parked rather than fixed
because the file carries another session's uncommitted compaction-gate edits
and git cannot split a mixed file: an edit now would ride into that session's
commit or strand. The fix, ready to apply the moment the file clears, is to
restate the line as "at most three items, each cut to 600 bytes, in a derived
batch budget of 1,802 bytes". The same file's line ~660 carries a separate
held one-liner from the memory-sync effort; both land together.

## Out of scope

- Concurrency in the judge. 3.4x live headroom and an 18 percent duty cycle;
  parallelism would address a constraint that does not exist and would
  complicate the offset model.
- Newest-first draining, closed per Decisions.
- New dead-session queue mechanics, closed per Decisions on the existing
  14-day inbox sweep.
- Whether the stand-down guard should ever kill a non-progressing daemon:
  deferred to the operator once section 2's signal exists.

## Rollout

Two different installation surfaces, named so the close-out can say what is
live where:

- Daemon and wrapper changes (`sidecar/`) take effect when the running daemon
  is stopped and the scheduled task's next 5-minute tick restarts it from the
  updated source. Until then the old daemon keeps running old code.
- Capture-hook changes (section 3) ship with the plugin: they reach sessions
  only after `claude plugin update` and a session restart. The fleet-update
  residue from the sync-defects effort already queues that act.

## Claims held as unconfirmed

- That the stand-down guard is what kept the daemon down for 133 minutes. The
  mechanism is real and the outage is measured; the link is not established.
- The scheduled task's own state: the Coordinator's `schtasks` probe returned
  nothing and its control also returned nothing, so that instrument failed
  rather than reporting an absence.

## Evidence

- Sidecar state root artifacts: `spool/2026-08-31.jsonl`, `logs/verdicts-*.jsonl`,
  `logs/recognition-*.jsonl`, `logs/offsets.json`, `inbox/*.jsonl` and their
  `.offset` siblings.
- Delivery caps and their two roles: `plugins/claude-kit/hooks/kit-sidecar-capture.js:544-545`,
  `:897`, `:908`, `:991-998`.
- Serial drain: `sidecar/daemon.js` pass loop and `drainFile`;
  `MAX_CHUNKS_PER_FILE = 512`, `DEFAULT_POLL_MS = 2000`.
- Existing inbox sweep and retention: `sidecar/daemon.js:411-419`,
  `sidecar/spool.js:81` (`RETENTION_DAYS = 14`).
- Stand-down guard: `sidecar/daemon-task.ps1:29-31`.
- Outage confirmed by the operator at the keyboard; horizon and rulings
  delivered over the allowlisted relay channel, 2026-08-31.

## Chapters

### Chapter 1 - 2026-08-31
Completed: Section 1: skip stale entries at the drain
Implemented By: implementer-opus (three rounds: build, review fixes, review fixes; no escalation)
Metrics: review rounds 2; NEEDS_CONTEXT 0; escalations 0; consults 0
Decisions / Surprises: the spool field is `ts`, not the spec's `capturedAt` (the latter is the verdict record's copy; code reads `ts`). Stale stretches are a distinct record type rather than gap-typed, an implementer deviation confirmed at adjudication: gap-typed records would make the rollup's gap headline contradict the `gapped` counter on every skip. Round 2's Major inverted the crash-safety story (one quiet session's open stretch held every offset for the rest of the pass), fixed by flushing all open stretches before any judgment call; the implementer then disproved the suggested test observation point by probe and pinned the hold at the all-stale window instead. Busy-lane held backlog is deliberately NOT exempt from the horizon (an entry held past 15 minutes is stale by the operator's ruling when it can finally be judged; the stale record makes the drop visible). Folds: sidecar/logs.js (the persisted counter set lives in its emptyState), sidecar/rollup.js + its test (the reader's surface, folded inline by the orchestrator), sidecar/battery.js + its test (a frozen replay pins the horizon open at 100 days and names the stale drop path). Zone-less timestamps are judged, not aged (Date.parse would read them as local time). The two sibling implementers collided on the machine claim file in round 1 (both carry this session's id; the delete rule could not distinguish them); patched in later briefs by scoping deletion to the Started value the agent itself wrote, and captured to kaizen.
Assumptions: stale counts inside `parsed`; the identity parsed = judged + stale + gapped is stated in CONTRACT.md (decided 2026-08-31, section 1, resolved from the code and its tests; no prior invariant pinned parsed === judged).
Review Findings: round 1 pair (adversarial + blind, opus/max): 1 Critical (skips left no dated, attributed trace; fixed with per-stretch stale records) and 2 Majors (battery silently drops its own tail past the horizon; the recognition-skip decision had no pin) fixed; 1 blind Major (busy-lane exemption) rejected with justification above; 8 minors fixed, 1 noted. Round 2 (adversarial, opus/max, fix delta): 2 Majors (unbounded offset hold; the hold's pin could not fail) fixed with red/green probes both directions; minors fixed; the battery-test regex wiring pin noted, not actioned.
Stamps: adjudicated 5, stamped 2 at the boundary sweep (suite-baseline-is-not-zero-fail; claude-kit-hook-edits-need-a-build-stamp-refresh), plus a-routing-claim-is-an-intention-until-the-target-holds-it stamped on a recognition nudge at close. The span is accounted for; no hand walk owed.
Gate: targeted lane (daemon + rollup + battery tests) 361/359/0 fail/2 skipped, exit 0 read from the run, delta vs the round-2 baseline on the same lane +2 tests, 0 new failures. Whole gate (this close pushes to main, the install-surface trunk) 2773 tests/2765 pass/2 fail/6 skipped, exit 1: both fails are the box's standing baseline (the path-length permanent fail; the memq-shim fail, which this gate hardened from documented-intermittent to consistent, reproduced at HEAD bc57e15 in a clean worktree with no in-flight diff, memory corrected and the diagnostic now in docs/backlog.md). No contention lane: this repo defines none (docs/architecture.md). Gate ran on the main checkout carrying the durable-boundary session's uncommitted compact-gate edits and one untracked duplicate test file of theirs; both fails sit outside every sidecar family.
Next: Section 2: make a dead daemon visible
Commit Model: Commit-and-Push

### Chapter 2 - 2026-08-31
Completed: Section 3: split the inbox delivery caps
Implemented By: implementer-sonnet (three rounds; no escalation)
Metrics: review rounds 2; NEEDS_CONTEXT 0; escalations 0; consults 0
Decisions / Surprises: the reviewed 1,200 batch budget failed the section's own goal by arithmetic (two at-cap items cost 1,201 and still broke the batch at one; fully populated real items compose to ~510 bytes so three capped at two), so the budget became the derived invariant INBOX_MAX_ITEMS * ITEM_MAX_BYTES + (INBOX_MAX_ITEMS - 1) = 1,802: a deviation from the approved "~1,200", named in the close-out. The blind lens found the split had created an unstated no-stall invariant across two constants; takeBatch now always takes a lone over-budget item so no constant drift can wedge a session's queue. The security round confirmed neutralization, framing, and the guard bounded at the new volume, and rated the byte-budget branch structurally unreachable (a backstop, not a third control; comments reworded to say so). Carriers of the old 600-byte figure swept per the Standing Brief Amendment: hook header (three sites), CONTRACT.md (two sites), sidecar/inbox.js, docs/architecture.md placed by the main thread; docs/security-model.md:267 rated a security Major and PARKED as the written-up open defect in this spec's own section, the file being another session's dirty worktree file git cannot split.
Assumptions: none.
Review Findings: round 1 pair (adversarial + blind, opus/xhigh): 3 adversarial Majors (comment capacity claim false; file header contract stale; out-of-scope carriers) and 2 blind Majors (budget arithmetic; permanent-stall path) fixed via the derivation, the guard, and the carrier sweep; minors fixed. Round 2 (security-reviewer, opus/xhigh): 1 Major (security-model.md carrier) parked with its reason; 2 minors (backstop comments; ceiling test measures the true maximum shape with a fourth item queued) fixed. Verdict on the code itself: clean at the new volume.
Stamps: covered by Chapter 1's sweep (one boundary, two sections closing together).
Gate: targeted lane (capture test) 75/73/0 fail/2 skipped, exit 0 read from the run. Whole gate shared with Chapter 1 above. Hook build stamp refreshed via build.ps1 (exit 0) before the gate, per the operator-tier memory.
Next: Section 2: make a dead daemon visible
Commit Model: Commit-and-Push

### Chapter 3 - 2026-09-01
Completed: Section 2: make a dead daemon visible
Implemented By: implementer-opus (four rounds: build, fix, fix, fix; no escalation)
Metrics: review rounds 2 (round 1: adversarial + blind + security, opus/max via Workflow; round 2: verification, opus/max via Workflow); NEEDS_CONTEXT 0; escalations 0; consults 0
Decisions / Surprises: two Decisions entries recorded above at build/review time: the stand-down line lands in the wrapper's own sibling `daemon-task.log` (option A; the wrapper's `*>>` redirection holds `daemon.log` locked for the daemon's life, so option B was physically unavailable), and heartbeat write failures count in their own persisted counter `heartbeatFailures`, never `writeFailures`, which widened the section's file scope to logs.js/rollup.js/battery.js and their tests. The installer's completion message was folded inline by the orchestrator (two log lines instead of one). The implementer's own m11 fix introduced an unlink-before-guard defect (a planted link deleted before the guard saw it) that the pinned test caught on the first lane run: the fix-round's one red, root-caused and fixed to guard-then-unlink with a new leftover-sibling pin. Round 2 found one new Major the fix round had introduced: the `[long]` pid cast, whose type test admits a JSON double that overflows Int64, throwing past every fixed reason and silencing the stand-down line entirely; round 3 wrapped the cast (red reproduced first: `{"pid":1e300}` landed no line while the same run's control did). The m5 timing steps were derived from the exported floor at an eighth rather than the suggested quarter, because a quarter lands the fourth entry exactly on a `<` boundary. Known limit, held: the wrapper's `heartbeat unreadable (link)` reason string is real-run-unproven on this box (file symlinks need elevation; a junction is refused earlier as `not a file`, which was real-run proven); the refusal is proven, the wording is not.
Assumptions: none beyond the Decisions entries.
Review Findings: round 1 (adversarial + blind + security, opus/max): 6 Majors fixed (pass-length wedge window; writeFailures contamination; Int32 age overflow; pwsh ConvertFrom-Json DateTime coercion, a real four-hour signature on this Eastern box; unbounded pid attribution; unbounded read), 2 findings rejected with reasons (same-user trust is stated design; per-process state-dir resolution over-engineered vs the pid-mismatch clause), minors fixed. All fixes proven red/green both directions with dual-host real runs (Windows PowerShell 5.1 + pwsh 7.6.5), all 13 wrapper branches exercised by real run except the link reason above. Round 2 (verification, opus/max): all six round-1 fixes verified clean; 1 new Major (the pid cast) + 6 minors, all fixed in round 3, including replacing a vacuous battery pin with an end-to-end note pin whose red direction was established against HEAD.
Stamps: covered by Chapter 1's boundary sweep; no new adjudications this section.
Gate: targeted lane (daemon + rollup + battery tests) 371/369/0 fail/2 skipped, exit 0 read from the run, delta chain across rounds 361 -> 366 -> 370 -> 371, 0 new failures at every step. Whole gate (this close pushes to main, the install-surface trunk) 2794 tests/2779 pass/8 fail/7 skipped, exit 1 read from the run, vs the recorded baseline 2773/2765/2 fail/6 skipped: 1 of the 8 is the standing path-length fail (memory-session.test.js); the memq-shim standing fail did not fire (skipped rose 6 -> 7); the 6 new fails all sit in the durable-boundary session's in-flight families (compact-deferral-nudge.test.js 1, kit-compact-gate.test.js 3, hook-canary.test.js 3, the latter probing installed hooks against that session's uncommitted hook edits and a trailing machine install), none in any sidecar family, and the sidecar families import nothing this section touched. No contention lane: this repo defines none. No build stamp owed: this section touched no plugins/claude-kit/hooks/ file.
Next: whole-effort finishing pass (QA verifier, finishing reviews, docs curation, backlog entries, plan to Complete and archive)
Commit Model: Commit-and-Push

### Chapter 4 (final) - 2026-09-01
Completed: whole-effort finishing pass; plan Complete and archived
Base ref: bc57e15cb9bc14bd3f495e873a10dc5f6d4ec48e (parent of 530fcee, the first Chapter-appending commit; cross-checked against the scope union, every extra listing entry attributed to the sibling durable-boundary session's commits or bookkeeping)
QA (qa-verifier, inherited fable): PASS on every acceptance criterion in all three sections, with evidence per criterion; full suite `node --test test/*.test.js` 2793 tests/2785 pass/1 fail/7 skipped exit 1, the one fail the box's standing memory-session path-length baseline, no sidecar family red; contention lane NONE DEFINED (docs/architecture.md); one UNVERIFIABLE, operator/environment-class: the live scheduled-task stand-down interaction (the implementer's real wrapper runs in Chapter 3 cover the behavior; the verifier could not repeat them without touching the real state root).
Security review (security-reviewer, inherited fable/high): CLEAR, no Critical or Major. Two Minors: the CONTRACT.md exclusive-create sentence overstated the refusal (fixed this pass: the guard-then-clear order is now stated); the wrapper's three wildcard-interpreting path sinks (New-Item positional -Path, Move-Item -Destination) DECLINED with reason: low confidence, $env:USERPROFILE is not attacker-controllable for a scheduled task, and churning the wrapper after its dual-host real-run proof costs more than the nit.
Final adversarial review (adversarial-reviewer, inherited fable/high): APPROVED. Cross-section composition verified (the parsed = judged + stale + gapped identity holds as built; heartbeatFailures sits outside the identity everywhere it renders; old offsets.json upgrades to zeroed new counters). Three Minors, all fixed this pass: battery.js double loadState collapsed to one read; the "unforced by any floor" comment inverted to "forced past the floor" (it sat beside force=true); CONTRACT.md "the budget" disambiguated to "the per-item cap". Targeted lane after the fixes: 371/369/0 fail/2 skipped exit 0, read from the run, unchanged vs the Chapter 3 baseline.
Tree-state brackets: captured before QA and before the review round, compared after each; identical both times (porcelain hash b172fcc5c625e0714767b7f9bdd7b52d499ca494).
Drift adjudications (docs-curator report): D1 the security-model.md:267 delivered-volume bound, deviation, stays PARKED per this spec's Open defect section, fix text ready. D2 the docs index plan count, deviation, self-corrects at this archive move, no edit. D3 the fourteen-day-window over-claim in architecture.md, deviation, curator documented as-built (heartbeat.json, daemon.log, daemon-task.log named as outside the window). D4 heartbeat cadence, deviation: as built the stamp is also attempted per drained entry behind the same floor, a superset of the spec's cadence, documented as-built. D5, mistake class: both docs/README.md (:47-48) and docs/plans/README.md (:29-30) carry two consecutive "Completed plans are in archive/" paragraphs that disagree; pre-change read constructed by the orchestrator (curator holds no Bash): the duplication exists at the base ref in both files (count 2 at bc57e15 and on disk), so it predates this effort, a merge artifact where the standing-lines close-out (archived 08:55) appended a copy descending from a base that predated the judgment-sidecar archival (07:49): the older copy holds exactly one plan the newer lacks (judgment-sidecar), the newer holds three the older lacks. Resolved in this pass's index refresh: newer copy kept, judgment-sidecar entry restored, older copy removed, in both files.
Library hygiene: H2 cross-reference added one-way per curating-docs (this plan gains a Related section naming its predecessor; the archived judgment-sidecar plan is append-only history and is left alone). H3 index gaps resolve with this archive move.
Assumptions made during execution: the identity parsed = judged + stale + gapped is stated in CONTRACT.md, resolved from the code and its tests, no prior invariant pinned parsed === judged (Chapter 1).
Operator-pending verifications (what reopens work): (1) restart the live daemon, pid 25828, so the scheduled task's next tick relaunches it from this source: the real heartbeat.json appears only after that restart, and the real daemon-task.log stand-down lines flip from "heartbeat unreadable (no file)" to a live stamp reading; if after the restart no heartbeat.json appears within a minute of the daemon starting, that reopens section 2. (2) `claude plugin update` plus session restarts, so the capture-hook cap split (section 3) reaches sessions; if delivered blocks still break at one item after that, section 3 reopens. Both carried to docs/backlog.md as handoff items.
Gate:
Commit Model: Commit-and-Push
