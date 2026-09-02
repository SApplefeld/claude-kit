# The heavy-process claim is written by a verb that carries its own exclusion, and a waiter has a rule

Status: Ready
Commit Model: Commit-and-Push
Created: 2026-09-02

Session model: any executor session in the kit repo; three sections, tiers per section. Authored by the KIT: Expert seat from the 2026-09-02 kaizen pass, which folded eleven inbox notes on the claim protocol's write side into this one design. Anchors are authoring-time; re-locate every hit by content.

## Dispatch Authorization

None recorded. Authored under the kaizen skill's standing adjudication authority, which reaches the authoring and not the arming: the plan enters the worker's queue only on the operator's word, given on a warranted channel and recorded here by a session that will not be the one citing it.

## Goal

The machine's one-heavy-process slot is a file, `claims/heavy-process.md` in the coordinator directory, and the protocol around it is specified almost entirely from the arbiter's side: how the coordinator reads the fields, when it probes, what a release rests on. The writer's side is a read followed by a plain write, and a waiter's side is not specified at all. Eleven inbox notes across three seats in three days describe what that asymmetry produces: a read that goes stale between the read and the write, so a claim silently replaces a live foreign one; a waiter that computes an expiry from claimant-written fields and waits on a future-dated or over-long value forever; a session that infers the file's contents from its own successful write while a foreign write has already landed; two sibling agents of one session carrying one substituted id, so one sibling's completion delete erases the other's live claim; a claim written by a foreground wrapper that dies before its release step; a check that prints the claim state and runs anyway; and a release that leaves no record at all, so a correct early release and a wrong foreign delete are byte-identical afterwards.

When this plan is done: the claim is written and released by a kit verb whose create is exclusive, so the existence check and the write are one system call and a collision is a loud refusal rather than a silent overwrite; the verb reads the clock itself, carries a per-invocation actor token beside the accountable session id, and scopes its release by both, so siblings cannot delete each other and a dispatched agent's claim says which actor wrote it; every release appends one tombstone line to a machine-local log, so the slot's history is readable; the role skill states the waiter's rule in as many words as it states the arbiter's; and the dispatch brief's deliberate second copy of the protocol names the verb rather than describing the fields, so every dispatched agent on every machine gets the same behaviour from one command.

## Evidence

- The write side is a plain write today: the role skill's claim section says "read the live claim file, then write `claims/heavy-process.md`" and the executing-work brief clause repeats it ("where no live claim stands, write the claim with its full field set"), `plugins/claude-kit/skills/executing-work/SKILL.md:286-320` at HEAD `d09d099`. Neither names a primitive between the read and the write.
- The notes, all in `kaizen/notes-SCOTT-CLAUDE.md` at the pass's capture commit unless stated: the waiter gap and its second half (2026-08-30, coordinator seat, "specified entirely from the arbiter's side"); the read-then-write race and the exclusive-create primitive (2026-08-30, two notes); the same-id sibling delete (2026-08-31); the actor-versus-accountable collision seen from outside (2026-09-01); the placement rule and the gating form (KIT: Expert, 2026-09-01 and 2026-09-02); the delete-on-completion audit gap (2026-08-30); the entry-check-only re-test gap and the `Expected-seconds` misreading (2026-08-31, two notes); and the NEO note on the release being foreclosed by a successor's answer, whose fix rides the liveness plan.
- `kit-goal-lib.js` already uses the exclusive-create primitive for its own state file (`plugins/claude-kit/hooks/kit-goal-lib.js:857`, the EEXIST comment), so the verb has a sibling in the tree to mirror.
- The stamp CLI already owns clock reads for the coordinator directory (`plugins/claude-kit/hooks/kit-registry-stamp.js`, `push`, `now`), which is why the verb lands there rather than in a new file.

## Decisions

Decided 2026-09-02 by the Expert seat under standing adjudication; reversible at arming.

1. **The verb lives in the stamp CLI as `claim` and `release`.** One CLI already owns the directory's machine-written fields and resolves the calling session's id; a second CLI would duplicate its scope resolution and its sanitizer. Alternative: a new `kit-claim.js`, declined for that duplication.
2. **The actor token is the clock read itself.** `Started:` is read at the write by the verb, at millisecond precision, and doubles as the per-invocation token the release matches on, so no new field is invented for the discriminator and the file stays readable by every existing consumer. A separate `Actor:` line names the writer's kind (`session` or `agent`) for readers outside the protocol, which is the fix the 2026-09-01 note asks for, and carries no authority.
3. **Release appends a tombstone.** `claims/released.log`, one line per release with the released claim's fields and the releasing actor, machine-local under the same allowlist exclusion the claims directory already has. A renewal is a release followed by a claim, and the log records both.
4. **The waiter's bound is its own clock.** A waiter never derives a bound from `Started:` or `Expected-seconds:`; past its own bound its remedy is a probe to the holder over the peer surface and an escalation to the coordinator, never a longer wait. The claim's fields are what the holder believes it is doing.
5. **The deferring session re-checks when its blocker clears.** The rule "where no live claim stands, write the claim" gains its re-test moment: a session that proceeded under a named contention re-runs the claim verb at the moment the foreign claim clears, and the tombstone log is what tells it the moment. A release notifying every deferred waiter was weighed and declined as a message fan-out the protocol cannot bound.

## Sections of Work

### 1. The `claim` and `release` verbs. Model: opus

Add `claim --expected <seconds> [--repo <name>] [--name <roster name>] [--agent]` and `release` to `plugins/claude-kit/hooks/kit-registry-stamp.js`. `claim` reads the live file first for the report, then creates the claim with the exclusive flag; on `EEXIST` it prints the live claim's fields with the file's own modification-time age, exits nonzero, and writes nothing, which is the gating form a script uses in its own control flow. It reads `Session:` from the shell environment as `push` does, `Name:` from the caller's registry entry where one exists and from `--name` otherwise (the brief substitutes the dispatching session's name), `Started:` from the clock at the write, `Actor:` as `session` or `agent` per the flag, and `Expected-seconds:` from the argument, refusing a missing or non-numeric value. `release` deletes only a claim whose `Session:` and `Started:` both match the caller's own claim (the CLI remembers its own `Started:` in a per-session sidecar under the claims directory, or takes `--started` from the caller), appends the tombstone line, and on any mismatch leaves the file in place, names the collision, and exits nonzero. Every path sanitizes what it prints, per the CLI's existing rule. Tests: two concurrent claims produce exactly one file and one refusal; a foreign claim refuses release and stays; a sibling claim with the same session and a different `Started:` refuses release and stays; a release appends one tombstone with the released fields; `--expected` absent refuses.

Acceptance: the five tests green, watched red first; `node --test test/kit-registry-stamp*.test.js` green with delta named against a recorded baseline; the security model's coordinator write-surface enumeration names the tombstone log.

### 2. The role skill states the writer's and the waiter's rules. Model: opus

Amend the claim-file section of `plugins/claude-kit/skills/role/SKILL.md`: the write is the `claim` verb and the release is the `release` verb, the exclusive create stated as the reason a collision is loud; the actor line and its meaning (accountable session versus acting writer); the tombstone log as the audit leg the delete rule lacked; the waiter rule of decision 4 with its two halves (never a bound from claimant fields, and never a fact about the file from one's own past write, a fresh read being the only source of current state on a multi-writer file); the re-test moment of decision 5; `Expected-seconds:` stated as an estimate that bounds nothing and a lapsed window as no release; the placement rule (a claim and its release live in the same execution unit as the run they bracket, so a wrapper that backgrounds the run never holds the claim); and the gating form (the verb's nonzero exit is what a script branches on, never a printed state before an unconditional run). Whole-file review, because the section's neighbours restate parts of what changes.

Acceptance: each rule present in the section that owns it; the arbiter's paragraphs unchanged except where they name the new fields; no em dashes; targeted lane green with delta named.

### 3. The dispatch brief clause becomes the verb, and a pin holds the copy. Model: opus

Rewrite the box-budget clause in `plugins/claude-kit/skills/executing-work/SKILL.md` so the dispatched agent runs `node <root>/hooks/kit-registry-stamp.js claim --expected <n> --name <substituted name> --agent` before its heavy work and `release` after, with `<root>` substituted at brief-writing time as today, and so the clause's prose states only what an agent must know to act on a refusal (wait or name the contention, never write around it) and on a release mismatch (leave it, name it). Add a parity pin in the test suite asserting the field list the role skill states and the field list the brief clause names are the same set, so the deliberate second copy cannot drift.

Acceptance: the pin green and watched red against a deliberately dropped field; the clause names the two commands and no field-by-field composition; targeted lane green with delta named.

## Out of Scope

- The probe's addressing and the disclaim disposition, which `claude-kit_liveness-by-session-identity_spec_v1.md` owns.
- Any process poll. The claim buys legibility, never a guarantee, and this plan does not change that.
- Cross-machine claims. The file stays machine-local by the sync allowlist's existing exclusion.

## Related

- `claude-kit_liveness-by-session-identity_spec_v1.md`: the arbiter-side half.
- `claude-kit_kaizen-prose-batch_spec_v1.md`: carries the doctrine bullet's clearance clause.
- Kaizen triage record `kaizen/archive/2026-09-02-pass-triage.md`.
