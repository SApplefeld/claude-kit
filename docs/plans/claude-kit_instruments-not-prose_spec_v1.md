# A value nobody measured is prose wearing a number's clothes, and the kit stops asking for them

Status: Ready
Commit Model: Commit-and-Push
Created: 2026-08-28

**Authored and parked by the kaizen pass of 2026-08-28; sections to be briefed in a design round with the operator before arming.** Promoted from two kaizen notes the operator approved combining (decided 2026-08-28 at the expert session's keyboard): the measurement-expiry note and the incremented-series note, one root between them. Scheduled after the current four-plan queue (seat-infrastructure, memq-network-cwd-resolver, review-and-record-discipline, plan-lifecycle-and-diagnostics); scheduling is the coordinator's, arming is the operator's, and this plan carries no Dispatch Authorization section until he grants one. The Ready status is the parked state's own value: session start lists the plan as authored and parked rather than offering it for resume, and the run that starts it sets the header to In Progress.

## Goal

Two failure shapes surfaced in one night of live seats, and they are one defect. A durable record carries a measurement without the context that made it valid: suite wall clocks, lock-wait margins, and baseline counts all silently expired when the machine's hardware changed under them, and the artifacts went on presenting the figures in the same voice, six expired readings leaned on in one evening by a reader who was warning others against exactly that. And a durable series was produced by incrementing rather than measuring: every timestamp on a coordinator ledger was advanced by feel, internally consistent, monotonic, plausibly spaced, and twenty to forty-five minutes wrong, catchable only when an entry drifted past the clock into the future. The shared root: any field a writer can plausibly produce from context rather than from an instrument will eventually be produced from context, and a format that asks for such a field is asking to be filled in. A timestamp does not feel like a measurement while it is being written; it feels like formatting.

When this plan is done: a measurement figure in a durable kit artifact carries provenance (what produced it, when, under what contention) as a convention the review lenses check; time fields in kit-written ledgers and registries are machine-stamped wherever a hook or CLI writes the line, removing the opportunity rather than policing it; a reader can mechanically tell a figure predates the machine's current configuration; and the read protocols for boards and ledgers self-check their newest stamp against the clock, saying so when one sits in the future.

## Evidence

All reported from the 2026-08-28 kaizen notes and the coordinator seat's own measurements, re-verified at design time rather than trusted from here:

- Three whole-suite runs, same tree, same commit, no code change: 1,913 s, 2,208 s, 2,606.9 s, the hard-serialised box with nothing else on it the slowest, per-class factors scattering 0.513x to 2.270x. A duration on that machine accepts or rejects nothing without a co-measured control from the same run. The interim warning lives in the claude-kit project memory (`suite-baseline-is-not-zero-fail`), which this plan supersedes with a convention.
- The fabricated timestamp series passed every internal check it could have been given; the only disagreeing instrument was the clock nobody consulted. Downstream, two peer seats audited their Chapters for citations of the times, and one declined to launder them, which is the cost signature: fabrication spreads through citation.
- The precedent showing the fix's shape already half-exists: the seat-infrastructure registry entry's `Heartbeat:` line is hook-stamped while its `Started:` and `Status-updated:` fields are prose, so the same file demonstrates both the instrument and the invitation.
- The machine-configuration change that expired the figures (2026-08-27 20:17 local reboot: 6 cores to 4, 16 GB to 20, Defender exclusions) is recorded only in prose across memories and Chapters; nothing mechanical marks a before-epoch figure as before-epoch.
- A live instance of the thesis at full drift, confirmed at code by two seats 2026-08-29: the memory-system skill called the doctor's `-Fix` "the way to push this session's writes immediately" while the fix pass commits and never pushes (the push lives in the sync runner alone), a prose assertion with no mechanism behind it that read true when written and shipped false with nothing to catch it, at a measured cost of two runs each leaving a branch silently one commit short of the remote. The sentence's correction ships in `claude-kit_standing-lines-and-honest-reports_spec_v1.md` Section 1; what rides here is that no instrument existed to notice the drift.

## Design forks, to be settled in the design round

1. **Provenance line versus configuration epoch versus both.** A per-figure provenance convention (source run, date, contention) is cheap and reviewable but relies on writers; a machine configuration epoch (recorded at hardware or environment change, compared against figure dates) catches the reader who is not looking but needs a home and a writer. The cheap half and the catching half are different halves; the round decides whether both land.
2. **Stamp scope.** Which kit surfaces gain machine-stamped fields: the coordinator board and ledger, the registry entry's prose time fields, memory frontmatter dates, Chapter headers. The wider class question from the note rides here: which other fields in kit artifacts are prose where they could be stamped.
3. **Enforcement posture.** Whether the review lenses' provenance check is a charter clause (consistent with review-and-record-discipline's amendments) or a mechanical guard, honoring the kit's recorded stance that guards narrow honest writers without authenticating them.

## Related

- `docs/plans/claude-kit_seat-infrastructure_spec_v1.md`: Section 3's registry contract and Section 5's seat-stop hook are the stamping precedent and the nearest surfaces; this plan runs after that one ships.
- `docs/plans/claude-kit_review-and-record-discipline_spec_v1.md`: its Sections 6 and 7 (absence checks, run-authored corroboration) are sibling review-discipline rules from the same kaizen batch; the provenance-check clause here should match their charter idiom.
- The claude-kit project memory `suite-baseline-is-not-zero-fail`: carries the interim scatter warning this plan replaces with a convention.

## Chapters
