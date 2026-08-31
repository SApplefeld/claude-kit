# Sidecar staleness and liveness

Status: In Progress
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

## Sections of work

### Section 1: skip stale entries at the drain

Model: opus

After an outage the sidecar must not work through hours of old data to catch
up. An entry whose `capturedAt` is older than the freshness horizon at the
moment the drain reaches it is skipped rather than judged: no judgment call, no
recognition call, no verdict record, no inbox item. The offset advances past it
as it does for any processed entry, and the skip is counted.

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

Files in scope: `sidecar/daemon.js`, `sidecar/CONTRACT.md`,
`test/kit-sidecar-daemon.test.js`.

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
  to the daemon log naming the running pid and the heartbeat's timestamp and
  age when the file is readable ("stood down: daemon pid N running, last
  heartbeat T, age Xs"). A present-but-wedged daemon then reads as exactly
  that, instead of as a task that "starts and immediately stops" with nothing
  to say why. The wrapper does not kill a non-progressing daemon; whether it
  ever should is the operator's later call, made possible by this signal.
- `sidecar/CONTRACT.md` documents the heartbeat file and its cadence.

Files in scope: `sidecar/daemon.js`, `sidecar/daemon-task.ps1`,
`sidecar/CONTRACT.md`, `test/kit-sidecar-daemon.test.js`.

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
- `INBOX_MAX_BYTES` rises to 1,200 and keeps only the batch-budget role in
  `takeBatch`.
- Both constants stay exported; the comment above them states the two roles
  plainly so the next reader cannot re-merge them.

Files in scope: `plugins/claude-kit/hooks/kit-sidecar-capture.js`,
`test/kit-sidecar-capture.test.js`.

Tests: both directions: three ~358-byte items now deliver as one batch of
three, and a single oversized item is still cut at 600 bytes. Existing cap
pins updated to the new expected values, not deleted.

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
