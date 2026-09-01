# Judge partial-input honesty

Status: In Progress
Author: SCOTT-CLAUDE Expert seat, from operator rulings over the relay, 2026-09-01
Commit Model: Commit-and-Push

## Related

Extends the judge shipped by `claude-kit_judgment-sidecar_spec_v1.md` and the
pipe fixed by `claude-kit_sidecar-staleness-and-liveness_spec_v1.md` (both
archived).

## What this is about

The capture hook cuts long fields before spooling (2,000 characters per field,
8KB per entry) and the judge is never told which calls were cut. The judge's
prompt hedges "RESULT (may be truncated)" on every call, cut or not, and the
hedge measurably fails: on this box's live verdict logs, 36.6% of truncated
inputs are judged diverged versus 10.2% of whole inputs (26/71 vs 21/206,
verdicts-44f5313c, read 2026-09-01), and the machine coordinator hand-checked
six such divergences as six false alarms: the judge reads the absent, cut
content as evidence the intent was not met. Separately, the cut itself keeps
the wrong part: `slice(0, cap)` keeps a field's head and discards its tail,
and for tool output the tail is where errors, exit summaries, and FAIL lines
live.

The operator ruled (relay, 2026-09-01): option A, tell the judge its input is
partial; no truncation-cap raise for now (the caps stay 2,000/8KB; the
endpoint context window is 32K tokens and is not this plan's concern); the
head-and-tail improvement rides along.

## Measurement baseline

- Live false-alarm signature: 36.6% diverged on truncated inputs vs 10.2% on
  whole ones (this session's verdict log, 2026-09-01).
- Frozen battery baseline, run 2026-09-01 against the live endpoint
  (qwen3.8:27b, judgment-v2): 11/13, one under the 12/13 floor, both misses
  false-achieved on expected-diverged cases, one of them a prompt-cap-cut
  case (#5). Single run; variance vs drift unresolved.
- Prompt-eval speed on this endpoint: ~2,550-2,760 tokens/sec (fresh, measured
  twice 2026-09-01).

## Decisions

- Decided 2026-09-01 (operator, relay): option A over skip-truncated-entirely
  and over leave-as-is. Rationale: a cut input's visible part can still show a
  real divergence; only the absence-reading is wrong.
- Decided 2026-09-01 (operator, relay): no cap raise in this plan. The stepped
  raise remains parked with its throughput math (a 32KB-field judge call costs
  ~4-5s of prompt eval at the measured speed, and burst backlogs would cross
  the 15-minute staleness horizon and drop entries).
- Decided 2026-09-01 (operator, relay, later the same day, superseding the
  entry above): the moderate raise ships in this plan as section 3 (6,000
  chars per field, 16KB per entry, judge command cap to match), chosen over
  straight-32KB for the burst-staleness math and over no-raise because 2,000
  characters is low against the 32K-token window now live. The operator also
  values that the moderate shape keeps recognition inside a 16K window,
  preserving the option to lower the endpoint context again under memory
  pressure.
- Decided 2026-09-01 (expert, at spec): the truncation marker keys on the
  spool entry's existing entry-level `truncated` flag plus the judge's own
  prompt-time cuts, with no per-field capture flags added. The spool schema
  and the fleet's installed hooks stay compatible; per-field capture flags
  would buy precision the judge can mostly derive (a field at exactly its cap
  length, and every prompt-time cut, are knowable at prompt build) at the
  price of a schema change and fleet latency.
- Decided 2026-09-01 (expert, at spec): the prompt change mints
  `judgment-v3` with a new PROMPT_ID rather than editing v2 in place, per the
  prompt module's own header: the id is written into every verdict record, so
  editing text under a held id would make the live divergence-rate comparison
  (pre-change vs post-change) unreadable.
- Decided 2026-09-01 (expert, at spec): the always-on "may be truncated" hedge
  is removed in v3. A complete input should read as complete; the hedge's
  blanket presence is half of why the flag carries no information today.
- Decided 2026-09-01 (expert, at section 1 build, on the implementer's
  escalation, citations verified): the prompt module is required in three
  places, not one, so section 1's scope widens to the other two requires. The
  daemon stamps `promptId` into every verdict record from its own require
  (`sidecar/daemon.js:174`, `:1183`), and the battery's provenance screen
  (`sidecar/battery.js:186`, `:937`) voids every scored case whose record id
  differs from its own prompt's, so judge.js alone at v3 would write false
  records and daemon-without-battery would leave the gate unable to measure
  anything. The spec's "battery runner needs no change" sentence was wrong,
  an unverified inference now corrected by this entry. Widened files:
  `sidecar/daemon.js` and `sidecar/battery.js` (one require line each),
  `test/kit-sidecar-battery.test.js` (the provenance stdout pin and two
  module requires), `sidecar/batteries/README.md` (names the live prompt).

## Sections of Work

### 1. judgment-v3: the partial-input contract

Model: opus

New `sidecar/prompts/judgment-v3.js`, from v2, with `PROMPT_ID = 'judgment-v3'`:

- `formatTriple(entry)` reads `entry.truncated` (already present on every
  spool entry the daemon hands it; `capture` sets it when any field was cut).
  When true, the triple opens with an affirmative marker naming the fact: this
  call's text was cut at capture, one or more of the fenced fields below is
  missing its tail. When false, no hedge appears anywhere: the v2 static
  "(may be truncated)" is gone.
- Prompt-time cuts are marked precisely where they happen: when the command
  exceeds COMMAND_PROMPT_CAP, the ACTION fence's label states the cut and the
  kept/total sizes, instead of cutting silently.
- SYSTEM gains the absence-is-not-evidence instruction: for an input marked
  cut, judge only what is visible; missing confirmation is not divergence;
  a visible contradiction still is. Wording is the implementer's within that
  meaning; it must also name the capture-time cut marker from section 2 so
  the judge reads an in-band marker as a cut, not as output content.
- `sidecar/judge.js` requires v3. Everything else in judge.js is untouched.

Files in scope: `sidecar/prompts/judgment-v3.js` (new), `sidecar/judge.js`,
`test/kit-sidecar-daemon.test.js` (judge pins that name the prompt),
`sidecar/CONTRACT.md` (the judged-surface description names the marker
behavior and the id bump).

Tests: both directions: a truncated entry's prompt carries the marker and an
untruncated entry's prompt carries no hedge text at all; the prompt-cap cut
labels the ACTION fence; the verdict record carries the v3 id.

Battery gate: run the judgment battery three times against the live endpoint
at v3. Acceptance: median run at or above the 12/13 floor, and no run below
11/13. Record all three runs' per-case results in the Chapter beside the
2026-09-01 v2 baseline (11/13). The battery runner needs no change: it uses
the live prompt module through judge.js.

### 2. Head-and-tail capture slicing

Model: opus

`plugins/claude-kit/hooks/kit-sidecar-capture.js`: a field past its cap keeps
its head and its tail with an explicit in-band cut marker between them,
instead of head-only. Shape: roughly 60% head, marker, remainder tail, total
kept within the existing FIELD_CAP; the marker names the count of characters
cut. The PART_CAP kept-vs-given comparison design (cap plus one, truncation
decided by the caller's own cut) is preserved; surrogate safety at both cut
points via the existing trim helper. The marker literal is defined once per
process boundary and pinned equal across it by a test, the same discipline
the shared trim already uses.

Files in scope: `plugins/claude-kit/hooks/kit-sidecar-capture.js`,
`test/kit-sidecar-capture.test.js`, `sidecar/prompts/judgment-v3.js` (SYSTEM
names the marker; lands after section 1), cross-boundary pin test placement
per the existing trim-helper precedent.

Tests: both directions: a field under the cap is byte-identical to its input
with no marker; a field past the cap carries head, marker with the true cut
count, and tail, within the cap; multi-part results (string and block shapes)
both take the discipline; surrogate boundaries hold at both cuts.

Build: touches `plugins/claude-kit/hooks/`, so the build stamp refresh runs
before the section's gate (operator-tier memory).

### 3. The moderate cap raise

Model: opus (rides section 2's dispatch: same file, same lanes, one pass)

Per the operator's "moderate" ruling (relay, 2026-09-01, superseding the
earlier no-raise ruling): `FIELD_CAP` 2,000 -> 6,000 characters and
`LINE_CAP_BYTES` 8,192 -> 16,384 in the capture hook (`PART_CAP` derives), and
`COMMAND_PROMPT_CAP` 6,000 in judgment-v3 so the prompt no longer re-cuts what
capture already bounded (it remains the defense-in-depth bound and still fires
in tests that feed it oversized text directly). The head-and-tail split of
section 2 applies at the new caps. Worst-case judge call at these numbers is
roughly 5-7K tokens (~2-2.5s at the measured eval speed), which keeps a
200-call burst inside the 15-minute staleness horizon; recognition's own
prompt caps are deliberately unchanged, so its worst case still fits a 16K
window and the operator keeps the option of lowering the endpoint context
back to 16K under memory pressure.

Files in scope: within sections 2 and 3's combined set (the capture hook, its
test, judgment-v3, the daemon test).

Tests: cap pins updated to the new constants, not deleted; a both-directions
pin that a field between the old and new caps now spools whole.

## Out of scope

- Any further cap raise (the straight-32KB shape), reopened by an operator
  word plus a duty-cycle reading from the rollup after this raise has run.
- Per-field truncation flags in the spool schema, declined per Decisions.
- Recognition-prompt changes: recognition already receives its index-cut flag
  (`indexCut`) and has its own prompt lineage; its field markers can follow
  this pattern in a later effort if the live rates justify it.
- Anything about `think`: both request builders already send `think: false`.

## Rollout

- Section 1 (prompt + judge) takes effect when the daemon restarts from
  updated source: operator stops the daemon or waits for a box reboot; the
  scheduled task relaunches it within 15 minutes.
- Section 2 (capture hook) ships with the plugin: `claude plugin update` plus
  session restarts, the same standing fleet-update act already queued.
- Live acceptance, operator-observable weeks out: the truncated-input
  divergence rate in fresh verdict logs converging toward the whole-input
  rate (36.6% -> ~10% is the direction; exact convergence is not promised).

## Chapters

### Interim board 1 - 2026-09-01
Section 1 is mid-build on its widened scope (see the Decisions entry on the
three prompt-module requires): the implementer escalated the coupling
(NEEDS_CONTEXT), was granted option (a), and is implementing judgment-v3 plus
the require repoints with both lanes baselined and the three-run battery gate
ahead of it. Sections 2 and 3 are not started and ship together in one
dispatch after section 1 closes (same file, same lanes); their brief must also
update section 1's ACTION-cut pin when COMMAND_PROMPT_CAP moves to 6,000.
Operator rulings all recorded in Decisions; the moderate raise superseded the
no-raise ruling later the same day. Review rounds for section 1 (adversarial +
blind pair) have not yet run; they follow the implementer's DONE. Next: await
section 1 DONE, verify, dispatch the reviewer pair, then sections 2+3.
