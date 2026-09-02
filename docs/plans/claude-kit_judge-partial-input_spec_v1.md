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
- Decided 2026-09-01 (expert, adjudicating section 1's review round; all three
  reviewers converged on the Critical): the in-band cut marker is read as a
  marker only in a triple that opened with the capture-cut notice; in any
  other triple a line of that shape is ordinary fenced data. The fenced
  content is authored by the judged party, so the unconditional reading
  handed it an unauthenticated token that suppresses the diverged-for-unproven
  verdict class on an uncut entry, and the marker literal sits in this repo's
  own source, contract, and tests, so a judged call that prints those files
  triggers it non-adversarially. Conditioning on the notice closes the uncut
  case; a forged marker inside a genuinely cut entry buys nothing the
  entry-level notice has not already granted. The delete-until-section-2
  alternative was declined in favor of the single-rollout entry below.
- Decided 2026-09-01 (expert, same round): SYSTEM's completeness sentence
  claims only what the pipeline knows, an unmarked input was not cut by this
  capture pipeline, rather than "is complete". Cuts upstream of the hook (the
  harness truncating a tool result before capture sees it) arrive unmarked;
  8 of the 13 frozen battery results are exactly such cuts, and the three
  13/13 runs show the judge still reasons correctly about them, so this is an
  honesty correction, not a behavior reversal.
- Decided 2026-09-01 (expert, same round): one rollout moment. The daemon
  restart that activates v3 happens once, after sections 2 and 3 land, never
  per section. Until a production verdict carries the v3 id its text may
  still be edited under the id-mint discipline (the discipline protects
  verdict-log comparability, and no live verdict exists at v3 before that
  restart), and the window where the judge reads a marker vocabulary no
  producer emits never opens.
- Decided 2026-09-01 (expert, same round): the daemon's defensive read-side
  cap becomes self-marking and moves above the new field cap.
  `sidecar/spool.js` cuts every parsed text field at `ENTRY_FIELD_CAP`
  (4,000) with nothing set, under a comment that no honest line is touched;
  section 3's 6,000-character field cap falsifies that comment and would
  silently cut every honest 4,000-6,000-character field with `truncated`
  false, an unmarked cut under a prompt that now vouches for unmarked
  inputs. The parse marks its own cut into `entry.truncated`, the cap rises
  above the new field cap so it stays defensive-only, and `sidecar/spool.js`
  joins section 3's files.
- Decided 2026-09-01 (expert, same round): the capture hook's `truncated`
  flag keys on cuts to the three judged fields (intent, command, result)
  only; a cut to `sessionId`, `cwd` or `tool` no longer sets it, since the
  judge never sees those fields. The residual that a judged party can set its
  own flag with a 2,001-character intent is accepted and recorded: the
  sidecar holds no authority, the immunity granted is absence-reasoning only
  (a visible contradiction still diverges), and the long field is itself
  visible in the spool. Section 2 carries the change.
- Decided 2026-09-01 (expert, same round): the rollup reports per-promptId
  verdict counts wherever the window it reads carries more than one id, so
  CONTRACT.md's comparability sentence has an enforcing surface during the
  v2-to-v3 transition window (verdict logs live 14 days on mtime).
  `sidecar/rollup.js` joins section 3's files.
- Agreed 2026-09-01 (expert and the memory-read-side worker session, over peer
  messaging): `docs/security-model.md` is co-held uncommitted by both
  sessions. The expert's marker-vocabulary paragraph commits first, inside
  this plan's section 1 close commit; the worker then edits its two
  corrections (the session-id reader enumeration and the tier-name sentence)
  on top of that committed base and commits only its own. The worker holds
  off editing the file until the expert confirms the landed hash on the
  messaging channel. Fallback if the worker's timeline compresses first:
  whichever session commits the mixed file names both contributions in the
  commit message, with the other's explicit OK recorded on the channel.
  Amended later the same day: the expert granted that OK explicitly (this
  section's battery gate is stalled on endpoint contention, so the expert's
  commit is hours away), so whichever close lands first commits the file, the
  worker's commit naming the expert's paragraph if it goes first, and the
  expert then drops the file from its own staged list.
- Decided 2026-09-01 (expert, adjudicating section 1's fix-delta review round;
  three reviewers at opus, all nine prior rulings confirmed landed): the
  marker-reading instruction ships with its producer. Until section 2's
  head-and-tail emitter exists, the only party able to put the marker shape
  into a triple is the party being judged, so the instruction is exposure
  with no benefit, and the one-rollout-moment decision has no enforcing
  mechanism (the daemon's scheduled task relaunches from this worktree within
  15 minutes of a daemon exit, so uncommitted edits are production behavior).
  Section 1's SYSTEM therefore drops the marker paragraph, CONTRACT.md's
  marker bullet, and their pins; all three move to section 2, landing in the
  same commit as the emitter. The conditioning design stands, amended: the
  negative clause is positional ("in a triple that did not open with the
  notice", never the line-relative "above it"), and the fence paragraph's
  forgeable-shape enumeration is extended to name the notice, the marker, and
  the fence labels as shapes a judged party may print. The reviewer proposal
  to bind the marker to the fence tag is rejected as architecturally
  impossible: the capture hook writes the marker at capture time and the
  nonce is drawn at judge time, which is why the marker is bounded by
  condition rather than authentication (docs/security-model.md states this).
- Decided 2026-09-01 (expert, same round): the earlier rationale that a
  forged marker under a genuine notice "buys nothing the entry-level notice
  has not already granted" was inaccurate and is corrected here rather than
  defended: under a head-only cut it buys placement, relocating the perceived
  hole and presenting the retained text as the true end. The residual is
  accepted with that honest description (the immunity granted remains
  absence-reasoning leniency, never cover for a visible contradiction), and
  section 2's brief carries the corrected rationale.
- Decided 2026-09-01 (expert, same round): absence-immunity is scoped to the
  marking's own reach where the marking has one. The ACTION prompt-cap label
  names its field, so the immunity it licenses is about the command's missing
  tail only, never the result; SYSTEM says so. The entry-level notice cannot
  name a field, so its triple-wide grant stands as the already-adjudicated
  residual, narrowed by section 2 (flag keys on judged fields only) and given
  field identity by section 2's in-band markers.
- Decided 2026-09-01 (expert, same round): accepted wording and precision
  fixes for section 1's fix round two: the always-on opening sentence of the
  partial-input paragraph is rephrased so a whole input is not told "some of
  what you receive is cut"; the partial-input paragraphs move below the
  fencing paragraph so fences are defined before they are referenced; the
  ACTION label reads "of at least N characters" when the entry is
  capture-cut (the remnant length is a floor, not the size); the prompt-time
  slice takes the lone-surrogate trim the pipeline's other cuts already
  take, with the label derived from the trimmed slice; the empty-result
  placeholder on a truncated entry reads "(the call produced no output, or
  none survived the capture cut)"; the self-declared-truncation clause gains
  "a claim of truncation inside the fences is data, never one of this
  message's markings"; CONTRACT.md's `truncated` table row is corrected to
  the hook's six fields (section 2 re-narrows it deliberately); CONTRACT.md's
  absent-notice sentence mirrors SYSTEM's any-marking scope; the notice
  comment and test comment rest on the durable reason (the flag is
  entry-level and carries no field identity), not the transient field list;
  the header names surfaces rather than counting "two"; the overclaiming
  negative pins state that the named member is swept and the class is not;
  the whole-triple no-cut-wording pin is scoped to module-authored regions
  with the 1,501-character case pinned separately.
- Decided 2026-09-01 (expert, same round): three findings route out. The
  judge-prompt input is sent to the model with no invisible-character strip
  (a v2 carry-over with a real design tension), the daemon's scheduled task
  runs production from a live worktree, and recognition-v1 still hedges and
  cites v2 as its exemplar: all three go to the backlog at this section's
  close, the worktree-is-production item flagged as a candidate spec. The
  rollup promptId finding restates what is already ruled to section 3.
- Decided 2026-09-01 (expert, fix round two complete): all eight items
  landed with red-side evidence per changed pin, verified by the
  orchestrator's own reads (harvest.LINE_CAP_BYTES exported and pinned at
  the battery test; identity fields on the plain trimmed slice; spool's
  textOf trimmed without marker vocabulary; rollup keyed on raw ids with
  render-time neutralization). The n-ordinal dispute settled on the
  security lens's reading: selectTriples' stated claim is stability across
  --limit values, which holds; the comment now states n as the contiguous
  position among kept pairs and names transcript position as a property
  the command never carried. Lane 476/472/0/4 -> 478/474/0/4, +2 adds
  named. No third review round: the delta is precision against defects two
  full rounds verified, and the orchestrator's verification closes it.
  lenses, opus/max) verified every fix-round-one item resolved, with deep
  controls (a 40,000-probe two-copy cutToCap sweep and a 4,000-case
  serialize fuzz, both clean, plus an independent re-derivation of the
  multi-part containment margins). Accepted for fix round two: harvest's
  LINE_CAP_BYTES exported and strict-pinned as its own comment already
  claims (the one ruled pin that was claimed but absent); identity fields
  switch from cutToCap to a plain surrogate-trimmed head slice at
  IDENTITY_FIELD_CAP, so a cut cwd carries no marker or newline, with the
  recognition consequence (a cwd past the cap resolves no memory index)
  stated in the constant's comment and CONTRACT's bullet; the serialize
  guard widened to validate meta and the field keys so its answers-null
  comment is true; rollup's per-prompt map keyed on the raw id with
  neutralization at render and a collision note; spool's textOf gains the
  lone-surrogate trim (deliberately not cutToCap, which would forge a
  capture marker the daemon cannot honestly claim); the harvest summary
  names found-then-refused pairs distinctly and the n-ordinal claim is
  reconciled with the code (two lenses read it oppositely; the implementer
  settles it against selectTriples' stated claim and reports which way);
  the stale-prose stragglers (the hook's v3-as-re-exporter pointers,
  battery's 2000 figure, its fieldCuts/spoolLine divergence comment and
  README sentence, the two reachability comments, batteries/README's
  recognition-cut sentence, CONTRACT's orphan-at-either-end overclaim)
  corrected; and v4's header residual description extended to name the
  adjoining-evidence width of the forged-marker grant, with
  commandForPrompt's defence-in-depth branch recorded as
  fragment-tolerant rather than rerouted (a prompt-time cut wearing
  capture-marker vocabulary would state a falsehood). Routed to the main
  thread and landed the same turn: docs/README.md's plan entry re-worded
  to v4, and docs/security-model.md's residual sentence extended the same
  way. The blind lens's identity-cap MAJOR is thereby accepted in its
  adversarial-suggested form; the 512 figure itself stands as ruled.
  landed and verified by the orchestrator's own reads (v3's diff against
  a36ee79 is empty; v4 is the sole required prompt in judge.js, daemon.js
  and battery.js; no judgment-v3 literal remains in the daemon test's live
  pins). One deviation accepted with the implementer's arithmetic:
  IDENTITY_FIELD_CAP is 512 rather than the ruled ~1,024, because the
  skeleton invariant holds in bytes and JSON escapes a control character at
  six bytes, so 3 x 1,024 x 6 = 18,432 overruns the 16,384-byte line while
  3 x 512 x 6 + overhead fits; the ruled figure was character-thinking.
  serialize's optional sources argument is gone entirely (it takes the
  draft and every cut re-derives from the draft's own text), which is the
  stronger shape than the ruling's minimum. Lane 471/467/0/4 ->
  476/472/0/4, +5 adds named, red-side evidence for the new coverage pins
  shown against four one-at-a-time pre-fix probes, each restored
  byte-identical.
  (adversarial + blind + security at opus/max) returned two
  CHANGES_REQUIRED and one CONCERNS; adjudication follows. The blind lens's
  Critical stands and overturns this plan's earlier in-place-amendment
  posture: the new prompt text ships as `sidecar/prompts/judgment-v4.js`
  with PROMPT_ID 'judgment-v4', v3 restored to its a36ee79 state as the
  frozen instrument Chapter 1's 12/13 was measured on, requires and live
  pins repointed, because a36ee79 published v3 and the id's comparability
  contract binds from commit, not from fleet rollout ("unreleased" was the
  wrong boundary). Accepted for the fix round: the day-file bound
  re-derived upward with corrected arithmetic; identity fields (sessionId,
  cwd, tool) take their own small cap with a pinned
  skeleton-always-fits-the-line invariant, closing the newly reachable
  silent record drop; harvest bounds its combined triple and records
  per-field cut state so a frozen marker never replays under truncated
  false and an oversized fixture cannot abort a whole run; serialize's
  re-derive-from-source guarantee stops resting on an optional argument and
  CONTRACT's sentence becomes true by construction; the marker-integrity
  and multi-part-containment pins move from function-proving to
  coverage-proving (production path asserts one whole marker with a true
  count; non-uniform filler; the given-greater-than-text branch pinned
  across the boundary; the negative-slice overlap clamped in both cutToCap
  copies); the :107 "Only in a triple..." sentence is scoped to in-band
  text, curing the contradiction with the ACTION label's unconditional
  reading; rollup's promptId slice takes the surrogate trim, the
  hardcoded "two instruments" names the real count, and the map-bounded
  comment says what is actually bounded (the rendering); and the stale
  prose set (day-file arithmetic, skeleton comment, PART_CAP rationale,
  orphaned captureCutMarker comment, the fourth unretired marker
  statement, the 1,501-example, battery's "first N of them" line) is
  corrected. Declined as written: judge.js sending num_ctx, because the
  4K-default failure scenario does not hold on this deployment (endpoint
  configured at 16K, worst triple ~7.5K tokens) while a per-request
  num_ctx differing from the server's forces model reloads on the shared
  serial lane; the hook's false sized-against-the-judge's-window comment
  is corrected to the truth and the explicit context knob goes to the
  backlog with that analysis. Routed to the main thread's close: the
  security-model.md marker-vocabulary paragraph (ruled to this section's
  commit), the egress-surface size note (tripled caps and the tail region
  now travel), the Rollout window note (the daemon can hold the marker
  instruction before fleet hooks emit markers; harm bounded by the
  accepted absence-leniency residual), and the recognition-v1 backlog
  item's extension (head-slices can bisect an in-band marker).
  implementer concerns dispositioned. `sidecar/text.js` joins the scope
  (the head-and-tail cutter is single-sourced there beside the shared trim,
  re-exported by judgment-v3, mirrored once into the hook across the
  packaging boundary under the cross-boundary pin), accepted on the same
  ground as the fix-round-two trim ruling. The multi-part result bound now
  removes a middle rather than a tail so the marker's count is true and the
  kept tail is the output's real end, accepted as the direct reading of the
  true-count ruling. The frozen battery's cut coverage moved to unit drives
  plus a within-cap control (cases.json untouched), per the standing
  acceptance. ENTRY_FIELD_CAP lands at 12,000, twice the field cap,
  mirroring the prior 4,000 = 2 x 2,000 relation. And the stale
  "8192 bytes" spool-contract sentences (a daemon.js diagnostic literal and
  a daemon-test comment) were corrected to 16,384 by the main thread inline,
  daemon.js thereby joining the changeset with that one line.
  three rulings. (1) The caps and the field-cut shape are deliberately
  mirrored into `sidecar/battery.js` and `sidecar/harvest.js` and pinned
  equal to the hook's by strict equality; the mirrors move with the hook, so
  those two files plus `sidecar/batteries/README.md` join sections 2+3's
  files in scope, and every pin stays a strict equality. The frozen
  battery's ACTION-cut coverage loss at COMMAND_PROMPT_CAP 6,000 (no frozen
  command exceeds the new cap) is accepted: `cases.json` stays frozen for
  comparability, unit pins keep the path exercised, and the backlogged
  battery-extension item now owes a command case past 6,000 characters.
  Fixture-shape comparability is already covered by the finishing-pass
  battery re-run ruling. (2) Multi-part results plumb the true given length
  through the hook (a `resultParts`-style internal returning text plus
  given), so the marker's count and the kept-vs-given comparison are exact;
  PART_CAP stays as the peak bound, the caller still decides truncation,
  which is the design the plan preserves. (3) The serialize byte-cap pass
  stays at the operator's 16,384 as the durability bound, and the
  implementer's arithmetic exposed that it now fires routinely (three
  near-cap fields exceed it), so its cut takes the same head-and-tail
  marker discipline rather than a raw tail slice that eats or bisects the
  marker; if that proves disproportionate in code, the fallback is
  escalation with the proposed shape, never a silent mangled marking.
  the final prompt text at the finishing pass, before rollout, under section
  1's same gate (three runs, median >= 12/13, none < 11/13). Sections 2 and 3
  amend judgment-v3's SYSTEM again (the marker paragraph, the fence-list
  marker entry) and raise COMMAND_PROMPT_CAP, and the #13 flip demonstrated
  that wording changes move verdicts, so the text that rolls out must be the
  text that was measured. The sections' own dispatch runs no battery (the
  implementer is barred from the endpoint entirely); the finishing pass owns
  the re-run.
- Decided 2026-09-01 (expert, battery adjudication): section 1 closes on
  12/13. The battery gate is met (three runs at 12/13, median 12, floor 12,
  zero gap records) and the two v2 misses this plan targeted (#1 and #5,
  both false-achieved) are fixed in all three runs. The new miss is #13, an
  observation intent whose result a harvester pre-capture cut left visibly
  truncated with no pipeline marking; the judge now reasons from the visible
  cut to a false diverged. The round-1 text protected that case with the
  "unmarked means complete" sentence the review round correctly removed as
  an overclaim (eight of thirteen fixtures are unmarked-and-cut), so the
  loss is the priced cost of an honest completeness claim, accepted rather
  than iterated: a tool-side-cut leniency clause risks re-breaking #1/#5
  and each wording round costs a review-plus-battery cycle. Causal
  attribution of the #13 flip to the fix-round-two wording is inferred from
  a clean three-versus-three split across the two texts, unconfirmed (a
  host reconfiguration sits between the samples). Backlog at close: a
  candidate v4 case teaching restraint on visibly-cut-but-unmarked inputs,
  with a battery case pinned before any wording moves.
- Decided 2026-09-01 (expert, fix round two): two implementer deviations
  adjudicated. The prompt-time surrogate trim uses the shared
  `trimLoneSurrogate` from `sidecar/text.js` rather than the inline copy the
  brief asked for, accepted because the sidecar already single-sources that
  trim at five call sites and an inline copy would be a second spelling of a
  boundary guard; the cost is one new `require('../text.js')` in a `prompts/`
  file. And the fence paragraph's forgeable-shape extension splits between
  sections: section 1 lands the partial naming the capture-cut notice and the
  fence labels (both ship in section 1), while the in-band marker joins that
  list in section 2 beside its emitter, since section 1's SYSTEM no longer
  names the marker anywhere.

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
  meaning. Per the fix-delta ruling in Decisions, section 1's SYSTEM does NOT
  name the capture-time cut marker: that instruction ships in section 2 with
  its producer, conditioned positionally on the capture-cut notice and named
  in the fence paragraph's forgeable-shape list. Section 1's fence paragraph
  does name the notice and the fence labels as forgeable shapes, the partial
  of that extension whose subjects section 1 itself ships; the marker joins
  the list in section 2. The completeness claim for
  unmarked inputs is pipeline-scoped (not cut by this capture pipeline),
  never absolute, and the ACTION label's immunity is scoped to the command
  field it names.
- `sidecar/judge.js` requires v3. Everything else in judge.js is untouched.

Files in scope: `sidecar/prompts/judgment-v3.js` (new), `sidecar/judge.js`,
`test/kit-sidecar-daemon.test.js` (judge pins that name the prompt),
`sidecar/CONTRACT.md` (the judged-surface description names the notice
behavior and the id bump; the marker bullet moved to section 2),
`docs/security-model.md` (a docs/ write, main thread, phased so the file
never describes uncommitted behavior, because the sibling session may commit
it first under the co-held-file agreement: the worktree copy today carries
only the nonce-fencing description true of committed v2; the capture-cut
notice and flag-residual prose land in section 1's close commit, and the
marker vocabulary in section 2's).

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
the shared trim already uses. Per the review-round ruling in Decisions, the
entry-level `truncated` flag keys on cuts to the three judged fields
(intent, command, result) only.

This section also lands the judge's side of the marker, moved here from
section 1 by the fix-delta ruling so the instruction and its producer ship
in one commit: SYSTEM gains the marker-reading paragraph, conditioned on the
capture-cut notice with a positional negative clause ("in a triple that did
not open with the notice", never a line-relative phrasing), the fence
paragraph's forgeable-shape list gains the marker (section 1 already names
the notice and the fence labels, per the fix-round-two deviation ruling in
Decisions), and CONTRACT.md regains the marker bullet. The marker's framing is
part of the contract: it occupies its own line (the template or the emitter
guarantees the newlines, and the cross-boundary pin covers the framing, not
just the literal). The brief carries the corrected residual rationale: a
forged marker under a genuine notice buys placement of the perceived hole,
which is accepted because the immunity is absence-leniency only. The
CONTRACT.md `truncated` table row narrows back to the three judged fields in
this same change, and the four "no producer emits the marker yet" statements
this ruling leaves in section 1's files are all retired here in one commit.

Files in scope: `plugins/claude-kit/hooks/kit-sidecar-capture.js`,
`test/kit-sidecar-capture.test.js`, `sidecar/prompts/judgment-v3.js` (SYSTEM
gains the marker paragraph; lands after section 1), `sidecar/CONTRACT.md`,
`test/kit-sidecar-daemon.test.js` (the marker pins return here),
cross-boundary pin test placement per the existing trim-helper precedent.

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

Two review-round rulings from Decisions ride in this section. The daemon's
read-side defensive cap (`sidecar/spool.js`, `ENTRY_FIELD_CAP`) rises above
the new field cap and marks any cut it does make into `entry.truncated`, so
the defensive bound can never again silently cut an honest field under a
prompt that vouches for unmarked inputs. And `sidecar/rollup.js` reports
per-promptId verdict counts wherever the window it reads carries more than
one id, giving CONTRACT.md's comparability sentence an enforcing surface
through the transition window.

Files in scope: within sections 2 and 3's combined set (the capture hook, its
test, judgment-v3, the daemon test), plus `sidecar/spool.js` and
`sidecar/rollup.js` with their tests, plus `sidecar/battery.js`,
`sidecar/harvest.js` and `sidecar/batteries/README.md` (the cap/cut mirrors
move with the hook under strict-equality pins, per the NEEDS_CONTEXT
adjudication in Decisions).

Tests: cap pins updated to the new constants, not deleted; a both-directions
pin that a field between the old and new caps now spools whole; the spool's
self-marking cut pinned both directions (a field past ENTRY_FIELD_CAP parses
with truncated true; one under it parses with the line's own flag).

## Out of scope

- Any further cap raise (the straight-32KB shape), reopened by an operator
  word plus a duty-cycle reading from the rollup after this raise has run.
- Per-field truncation flags in the spool schema, declined per Decisions.
- Recognition-prompt changes: recognition already receives its index-cut flag
  (`indexCut`) and has its own prompt lineage; its field markers can follow
  this pattern in a later effort if the live rates justify it.
- Anything about `think`: both request builders already send `think: false`.

## Rollout

- One rollout moment, per the review-round ruling in Decisions: the daemon
  restart that activates the new prompt (judgment-v4, per the sections 2+3
  review ruling that overturned in-place amendment) happens once, after
  sections 2 and 3 land. The operator stops the daemon or waits for a box
  reboot; the scheduled task relaunches it within 15 minutes.
- The capture hook's changes (sections 2 and 3) ship with the plugin:
  `claude plugin update` plus session restarts, the same standing
  fleet-update act already queued. Until a session restarts, its old hook
  spools under the old caps with the any-field truncated trigger, which the
  judge reads correctly either way (the flag is the flag; only its trigger
  narrowed). One window rides this skew, named by the sections 2+3 security
  review: a restarted daemon can hold v4's marker-reading instruction while
  not-yet-restarted sessions run hooks that emit no marker, so in that
  window the only party able to put the marker shape into a fence is the
  judged party itself. Accepted: the harm is bounded by the marker's
  condition (it reads as a marking only in a notice-opened triple) and by
  the already-priced absence-leniency residual, and the window closes as
  sessions restart.
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

### Interim board 2 - 2026-09-01
Section 1 is code-complete and review-complete: the review round (adversarial
+ blind + security at opus/max) and two fix rounds are done, every fix
verified by the orchestrator's own reads, and the targeted lane is green at
305/303/0/2 (baseline chain 295 -> 301 -> 302 -> 305, deltas named in the
implementer reports under this session). The fence-paragraph forgeable-shape
partial (notice + labels) landed per the fix-round-two deviation ruling in
Decisions. The one open acceptance item is the battery gate: the endpoint's
generation lane has answered nothing since 16:19:56Z while its health root
answers in milliseconds and the model shows pinned resident; a 4-token
generation returned no response headers for 311 s. Diagnosis "wedged runner
rather than deep queue" is inferred, not confirmed. A decision ask went to
the operator over the relay at ~18:59Z: (1) bounce the runner then run the
battery, recommended; (2) poll to the 20:50Z window then CANNOT MEASURE;
(3) close section 1 on the lane gate with the battery deferred and owed.
Hedge in force: the implementer polls at ~10-minute cadence and runs the
three battery runs automatically the moment the lane frees. The operator
steered to the remembered keep_alive:0 unload fix (operator-tier memory
ollama-wedged-model-emits-empty-responses); applied at 20:14Z, it was
accepted (200, done_reason=unload, 7 ms) but did not clear the lane: a
480 s generation drew zero response headers while /api/ps showed the
model's keep-alive expiry frozen at an already-past timestamp for eight
straight minutes, so the scheduler is processing nothing. This wedge shape
(no headers) is deeper than the memory's documented shape (200 with empty
responses); only a host-side Ollama restart clears it, requested from the
operator over the relay at ~20:27Z. Side effect to restore afterward: the
unload dropped the model's infinite keep-alive pin. The operator's lead
that Qwen's thinking can run despite think:false (reasoning_effort:"none"
as the true off switch) is a candidate cause and a backlog item to verify
once the service is back. Rollout hazard
noted to the operator: the daemon's scheduled task relaunches from this
worktree, so the unmeasured v3 text goes live within 15 minutes of any
daemon exit regardless of this gate. Next: on battery evidence (or the
operator's ruling), close section 1 (security-model.md notice prose,
Chapter 1, targeted lane, whole gate + contention lane, commit, push), then
sections 2+3 in one dispatch.

### Chapter 1 - 2026-09-01
Completed: 1. judgment-v3: the partial-input contract
Commit Model: Commit-and-Push

Shipped: `sidecar/prompts/judgment-v3.js` (new), carrying the partial-input
contract: the capture-cut notice opening a flagged entry's triple, the ACTION
label declaring a prompt-time cut with kept/floor sizes ("of at least N" on a
capture-cut entry), absence-leniency scoped to the marking's own field, a
pipeline-scoped completeness claim for unmarked inputs, the self-declared-
truncation clause, and SYSTEM naming its own markings (notice, fence labels)
in the fenced-data shape list. Require repoints in `judge.js`, `daemon.js`,
`battery.js`; CONTRACT.md gained the judge-is-told and promptId bullets and
the six-field `truncated` row; batteries/README updated; pins in both test
files. `docs/security-model.md` gained the condition-bounded-markings
paragraph (this session's content alone; the worker seat's corrections land
as its own later delta, per the dissolved co-held-file agreement).

Decisions and surprises: two review rounds (adversarial + blind + security at
opus/max via Workflow, then a fix-delta round) plus two fix rounds; all
rulings in Decisions above. The marker instruction moved to section 2 with
its producer; the fence-list extension split (notice + labels here, marker in
section 2); shared `trimLoneSurrogate` accepted over an inline copy. The
endpoint's generation lane was wedged ~4h10m mid-section (the no-headers
scheduler shape, cleared only by the operator's host-side restart; both wedge
shapes are now in the operator memory tier). Battery adjudication: 12/13 x 3
accepted at the floor; #1/#5 (the plan's target defects) fixed, #13 newly
missed on honest-completeness grounds, routed to the backlog as a v4
candidate alongside four other routed findings.

Gate: targeted lane (both sidecar test files) exit 0 at 305 tests/303 pass/
0 fail/2 skipped, run by the orchestrator (baseline chain 301 -> 302 -> 305
across the fix rounds). Battery: three runs at 12/13, median 12, none below
11, zero gap records, per-case lines in `.kit/jpi1/bat{8,9,10}.log`. Whole
gate exit 1 at 2902/2892/1 fail/9 skipped; the sole fail is the recorded
box-permanent memory-session path-length red (same test as the 2793/2785/1/7
baseline, fail count unchanged; the tree also carried the worker seat's
uncommitted memory-read-side tests, so the count delta belongs to both
efforts). This repo has no contention lane (docs/architecture.md).

Next: sections 2 and 3 in one dispatch (head-and-tail slicing + marker
instruction + cap raise), per the section texts above.

### Chapter 2 - 2026-09-02
Completed: 2. Head-and-tail capture slicing
Commit Model: Commit-and-Push

Shipped (with section 3, one dispatch as planned): the capture hook's
head-and-tail cut with the in-band marker (~60% head, marker naming the
true count, tail, surrogate-safe at both points, every byte-cap cut
re-derived from the field's own source via the draft-based serialize);
the marker's judge-side instruction in `sidecar/prompts/judgment-v4.js`, a
NEW prompt id minted by review ruling with judgment-v3 byte-restored as
the frozen measured instrument; the cross-boundary marker pin (literal and
framing); CONTRACT.md's marker bullet and narrowed three-field truncated
row; the cap/cut mirrors in battery.js and harvest.js moved with the hook
under strict-equality pins (scope widened by the NEEDS_CONTEXT
adjudication), with harvest recording per-field cut state and refusing
unreplayable triples.

Decisions and surprises: one NEEDS_CONTEXT round (mirrored-caps coupling,
multi-part true counts, the serialize byte-cap marker interaction, all
ruled in Decisions), two review rounds (adversarial + blind + security at
opus/max, then a fix-delta round), two fix rounds, every ruling recorded.
The blind lens's Critical overturned the in-place-amendment posture and
minted v4. The identity fields took their own 512-character plain slice
(byte-arithmetic deviation accepted over the ruled figure). A stale
heavy-process claim of this session's own blocked the box ~11 minutes
mid-effort, released on discovery and captured as a kaizen lesson.

Gate: targeted lane (capture, battery, daemon, rollup test files) exit 0
at 478 tests/474 pass/0 fail/4 skipped, run by the orchestrator (chain
456 -> 471 -> 476 -> 478 across the rounds). Whole gate exit 1 at
2934/2924/1 fail/9 skipped, sole fail the recorded box-permanent
memory-session path-length red, fail count unchanged from the 2793 and
2902 baselines. No contention lane exists in this repo. The battery
deliberately did not run this section: the finishing pass re-runs it on
the final v4 text, per the standing ruling.

Next: section 3's Chapter below; then the finishing pass (QA verifier,
fable-tier security + adversarial reviews, battery re-run on v4, docs
curation), then the single rollout moment.

### Chapter 3 - 2026-09-02
Completed: 3. The moderate cap raise
Commit Model: Commit-and-Push

Shipped in the same dispatch, commit and gates as Chapter 2 above, per the
plan's own one-pass note: FIELD_CAP 6,000, LINE_CAP_BYTES 16,384,
COMMAND_PROMPT_CAP 6,000 (in v4), IDENTITY_FIELD_CAP 512 with the pinned
skeleton-always-fits byte invariant, DAY_FILE_MAX_BYTES 128 MiB with
corrected arithmetic, spool's ENTRY_FIELD_CAP at 12,000 self-marking with
the surrogate trim, and rollup's per-promptId verdict counts keyed on raw
ids. Every gate line, ruling and surprise is Chapter 2's; the two
sections were built, reviewed and closed as one changeset.

Next: the whole-effort finishing pass, then rollout.
