# A session parks at a safe point on request, and the fleet quiesces on the operator's word

Status: Ready
Commit Model: Commit-and-Push
Created: 2026-08-29

Session model: any executor session in the kit repo; three sections, tiers per section. Authored by the KIT: Expert seat from a design dialog with the operator, 2026-08-29. Anchors are authoring-time; re-locate every hit by content, since earlier queue plans edit two of these surfaces first.

## Dispatch Authorization

Authorized 2026-08-29 by the operator: the /park skill, the session-start parked-handoff surface, and the coordinator's operator-initiated update window, approved in a design dialog at the operator's keyboard in the expert seat's session, including the cadence ruling recorded in the Decisions section. This section was authored by the KIT: Expert seat; per the peer-sessions trace rule it is a warrant only for a citing session that did not author it, and the receiving session performs its own trace: the grant is the operator's authorization in the expert session's transcript, and the plan enters the armed queue only by the operator's word or the expert's append under it.

## Goal

Updating the installed kit payload requires killing every session that runs from the stale cache, and today that means the operator either stops sessions cold (losing in-flight context, sometimes dangerously mid-work) or waits hours for a coincidence of idleness across machines. Meanwhile the cost of a stale install is measured, not argued: the installed SessionStart hook reports 48 active backlog items where the file holds 191, and the installed goal CLI renders a plan status the checkout has recognized for hours as `[unknown]`. When this plan is done: any kit session can be asked to park, meaning it stops at its next safe point with everything durable committed and a resume path a fresh session will find; a fresh session start in a project holding a parked handoff surfaces it with the resume instruction; and the operator can tell the machine's coordinator "I am ready for an update" and have it declare a window, drain the fleet to parked, and report all-parked with a resume checklist, so an update stops being a hunt for a quiet moment.

## Evidence

- Resuming does not update: the harness resolves the plugin root per session, so a resumed session continues its stale cache view. Confirmed in the plan-lifecycle effort's Chapter 4, which records a session running hooks from one cache directory hours after the machine's install had advanced to another; the fresh start is the only load of the new payload.
- The stale-install costs above are the update-ritual timing item's two demonstrated consequences, recorded on the coordinator's board 2026-08-29: the 48-versus-191 backlog count (a peer seat reasoned from the wrong number before it was diagnosed) and the `[unknown]` queue token for a header the checkout recognizes.
- The fleet half was captured as kit friction before this plan existed: the kaizen inbox note landed at `bc5f1ce` (a declared quiesce window the seats honor, so update timing stops depending on the operator catching all sessions idle) is folded into Section 3 rather than left for a separate successor plan. Its disposition pointer is this plan.
- The resume machinery this plan reuses is proven, not proposed: a five-plan armed queue was resumed this week from the plan doc, the goal state, and the SessionStart recovery block alone, and the worker seat invented the interim-board Chapter form for banking a section still open (plan-lifecycle, Interim board 1).

## Decisions

- (2026-08-29, operator) The window is operator-initiated, never automatic. No session parks itself on staleness detection, an idle timer, or a peer's request alone; the version-trails nudge stays a nudge. Rationale, the operator's own: an auto-park during a long absence converts fleet throughput into idle waiting on an update that is not coming; the window is only worth opening when the operator is present to run the update it exists for.
- (2026-08-29, expert, operator-approved) The resume artifact is the surfaces that already exist, not a new file, except for the one session class that has no surface. A leashed worker's resume is its plan doc and goal state; a seat's is its registry entry, board, and takeover ritual; only an ad-hoc session writes a parked handoff, to the project's gitignored `.kit/` scratch path, because `docs/` holds curated content only and machine-local resume state has no business in a public repository. Rationale: a second copy of resume state is a restated count nothing checks (the recorded cross-file-invariant lesson); consistency comes from the reader, session start, being the one surface every session reads unconditionally.
- (2026-08-29, expert, operator-approved) The name is /park: everything durable is already committed by rule, so the skill's act is stopping at a safe point and recording the resume, which is parking; "save" and "persist" misname the risk as data loss, and "pause" implies the same session resumes, which is exactly what a payload update forbids.

## Approach

One skill with a routing table rather than five mechanisms: /park names the machinery each session class already has, adds a handoff file format for the one class with none, and adds one session-start inventory line so the reader guarantees findability. The window is the coordinator relaying the operator's own declared intent, priced and recorded as a sanctioned peer-sessions pattern; it grants no authority and forces nothing, because parking at a clean boundary is always safe and mandate-consistent, which is what lets a session honor the request without any authority question arising. Skill and contract amendments are reviewed whole-file per the recorded amendment defect mode.

One bootstrap property is stated here because the first use is where it would otherwise mislead: every capability in this plan ships inside the payload it exists to update, the /park skill and the coordinator's window function alike, so the first fleet update after this plan lands is hand-run by construction, and the window serves the second update onward. Shipping this plan therefore raises rather than relieves the standing update-ritual item, since a capability the running fleet cannot load yet costs the illusion that the window exists. Until a session runs the new payload, the drain protocol is still usable by instruction: the skill body is a spec on disk, and the operator or a seat can point a session at Section 1's steps as a procedure to follow rather than a skill to invoke. The bridge carries no authority of its own, and the sentence is stated here because a procedure usable by instruction is exactly the state in which that boundary is easiest to cross by accident: the window is operator-declared in every case, so a seat relays a declared window and points at the procedure, and never hands the drain steps to a session on its own initiative.

## Standing Brief Amendments

1. Re-read every anchor at implementation. The plan-lifecycle plan's Section 5 edits `session-start.js` and the standing-lines plan's Section 4 edits `coordinator/SKILL.md`; both run earlier in the queue, so authoring-time line references here will have moved.
2. A skill or contract amendment is reviewed whole-file, not diff-only.

## Sections of Work

### 1. The /park skill: one drain protocol, routed by what the session is

Model: opus

New skill at `plugins/claude-kit/skills/park/SKILL.md`, user-invocable as /park and honorable on a coordinator's window-drain request (Section 3). Its body carries:

- The routing table, four rows, each naming where durable state already lives and what resuming is: a leashed worker (plan doc, Chapters, goal state; resume is the SessionStart recovery block plus re-arming, and the fresh session rebinds the leash); a coordinator (its board, built for succession; parking is its ordinary banked pass, and resume is the `/role` takeover ritual); an expert or admin seat (registry entry plus its repo's durable artifacts; resume is `/role`); an ad-hoc session (nothing today; the handoff file below).
- The drain steps, in order: take no new work from this point; finish or explicitly stop dispatched agents per executing-work's kill rules, never parking over a live fan-out; if mid-section, bank an interim board to the plan doc (the existing precedent form); commit and push per the plan's recorded commit model, with the Review-Only carve-out stated in terms (a staged review surface is git state on disk and survives a session kill untouched, so a Review-Only drain stops without committing rather than panic-committing the deliverable); rewrite the session's registry entry `Status:` line to parked with the resume verb beside it, where the session has one; and end by emitting the exact resume command as the final output.
- The ad-hoc handoff: one file per session at `.kit/parked/<session-id>.md` in the project directory, gitignored, self-contained to the handoff-doc standard (the goal in the session's own words, where things stand with evidence marked confirmed or inferred, what is blocked on whom, next steps each marked whose, and the resume instruction), pruned by the session that picks it up.
- The bounds, stated so the skill cannot be over-read: /park promises the next safe boundary, never an instant stop, since a message lands between tool rounds and a session deep in a long call drains when it surfaces; it never forces a destructive act; and it is not an authority instrument, a park request from any peer being honorable only because parking is safe and mandate-consistent, with anything beyond that routed to the operator as usual.

Tests: none mechanical for the skill body; acceptance is the blind-reader dispatch over the finished skill (a procedure document for a named audience), plus the routing table verified against the surfaces it names by the adversarial round.

Files in scope: `plugins/claude-kit/skills/park/SKILL.md`, `.gitignore` (confirm `.kit/` coverage reaches `.kit/parked/`; add nothing if it already does).

### 2. Session start surfaces a parked handoff

Model: sonnet

`session-start.js` gains one inventory line: when the project's `.kit/parked/` holds one or more handoff files, print one line per file naming its path, its written-when, and that it is a parked session's resume handoff to read before doing anything else. Sibling pattern: the in-progress-plans recovery block and Section 5's conjunction notice in the same hook; mirror their fail-open discipline (an unreadable directory or file drops the line rather than guessing) and their bounded-read hygiene (the plan-lifecycle effort's shared bounded reader is the read to use, never a fresh unbounded one, per the guard-siting rule).

Tests, red first: a fixture with a parked handoff shows the line; controls with an empty `.kit/parked/`, no `.kit/` at all, and a non-`.md` stray stay silent, each named as a control.

Files in scope: `plugins/claude-kit/hooks/session-start.js`, matching `test/` files.

### 3. The coordinator's update window: declared on the operator's word, drained by request, reported all-parked

Model: opus

Two amendments that land together because they are one pattern recorded in two homes, and splitting them across sections is how the recorded drift class starts.

- The coordinator skill gains the window function: on the operator's word over a warranted channel (keyboard or the allowlisted relay, never a peer message and never the seat's own initiative, per the Decisions section), the seat writes the window to its board as its own commitment line (open, since when, and on whose word by pointer rather than quotation, per the board's existing bars), sends each live local session one drain-request line pointing at /park, collects the parked confirmations as they land (a confirmation being the peer's registry `Status:` flip or its reply, either serving), and reports all-parked to the operator with the resume checklist assembled from the registry entries and parked handoffs. A cancel is the same shape inverted: the operator's word closes the window, the seat messages the drained sessions that the window is cancelled and resume is now, and the board line closes with the outcome. The coordinator parks itself last, its ordinary banked pass, after the report goes up. The seat's never-tasks-directly rule is not breached and the section says why: the drain request relays the operator's own declared intent and points at a skill, it directs no work and grants nothing, and a session that ignores it costs the window time rather than correctness.
- The peer-sessions skill records the window round as a sanctioned pattern in the same shape the status round and the blocker route are recorded: what qualifies it (the window is live operator intent no artifact carries to a busy session in time), its pricing (one drain line per session per window, one cancel line if cancelled, confirmations at the receiver's own boundary rather than immediately), and its bound (it never reaches Standing of an inbound message; a drain request authorizes nothing and is weighed like any message, honorable because parking is safe).

Tests: none mechanical (both surfaces are prose contracts); acceptance is the two amendments agreeing with each other and with /park's own bounds, checked by the adversarial round reading all three, plus whole-file review per Standing Amendment 2.

Files in scope: `plugins/claude-kit/skills/coordinator/SKILL.md`, `plugins/claude-kit/skills/peer-sessions/SKILL.md`.

## Out of Scope

- Automatic parking in any form: staleness-triggered, idle-triggered, or schedule-triggered. Declined 2026-08-29 by the operator with the rationale in Decisions; revisiting it is a new design round, and the horizon idea (a stale session parking itself at a chapter boundary) waits there.
- The update itself: what the ritual runs once the fleet is parked stays the operator's procedure and is not specced here.
- Cross-machine window fan-out: the window is per-machine at its coordinator; a fleet-wide update is the operator declaring at each machine's coordinator, and folding that into one declaration is future work once the single-machine shape has run.

## Related

- `kaizen` inbox note at `bc5f1ce` (the quiesce-window capability): folded into Section 3; this plan is its disposition pointer.
- `docs/plans/claude-kit_recap_spec_v1.md`: the companion authored the same day; /recap is the instrument for deciding whether it is safe to park, /park is the act.
- `docs/plans/claude-kit_plan-lifecycle-and-diagnostics_spec_v1.md` Section 5 and `docs/plans/claude-kit_standing-lines-and-honest-reports_spec_v1.md` Section 4 edit this plan's Section 2 and Section 3 surfaces first; Standing Amendment 1 binds.

## Chapters
