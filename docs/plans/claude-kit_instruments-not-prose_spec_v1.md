# A value nobody measured is prose wearing a number's clothes, and the kit stops asking for them

Status: Ready
Commit Model: Commit-and-Push
Created: 2026-08-28

**Authored by the kaizen pass of 2026-08-28; design round completed 2026-08-29.** Promoted from two kaizen notes the operator approved combining (decided 2026-08-28 at the expert session's keyboard): the measurement-expiry note and the incremented-series note, one root between them. The design round ran 2026-08-29 at the operator's keyboard in the expert session and its rulings are the Decisions section below; the operator granted arming 2026-08-29, and the Dispatch Authorization section records the grant. The Ready status is the parked state's own value: session start lists the plan as authored and parked rather than offering it for resume, and the run that starts it sets the header to In Progress.

## Dispatch Authorization

Authorized 2026-08-29 by the operator: the moment-pin convention, the machine-epoch memory record, hook-stamping of the time fields a mechanical writer can own, and the two-direction review-charter clause, as ruled in the design round recorded under Decisions, given at the operator's keyboard in the expert seat's session. This section was authored by the KIT: Expert seat; per the peer-sessions trace rule it is a warrant only for a citing session that did not author it, and the receiving session performs its own trace: the grant is the operator's approval in the expert session's transcript, and the plan enters the armed queue only by the operator's word or the expert's append under it.

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

## Decisions

All three decided 2026-08-29 by the operator in the expert session's design round.

1. **Layered: journal moment-pin plus a memory-tier epoch, bounded by the journey ban.** A measured figure recorded in a journal-layer artifact (a Chapter, a board line, an evidence entry) carries a terse moment-pin: what produced it, when, under what contention. The machine configuration epoch lives as a machine-tier memory at a canonical key, written through the memory CLI when the machine's hardware or environment changes. Deep evidence (a scatter analysis, a multi-run comparison) lives in memory or a plan's Evidence section and is cited from the journal line, never restated in it. The bar that bounds the whole convention, the operator's own and load-bearing: this reaches the journal layer only. Curated documents, code comments, and skill bodies carry no dated-evidence annotations; the doctrine's journey ban stands there unchanged, and this plan's effect on curated surfaces is fewer figure-claims, never more. Rationale: the two incident classes are caught by different halves (a bare figure lies by reading as eternal truth, which the moment-pin fixes by pinning it to its past-tense moment; a perfectly pinned figure still expires silently when the machine changes, which the epoch fixes mechanically), while the write-litter failure the operator has seen before (journey narration in present-tense artifacts) is excluded by the bar rather than by hope.
2. **Stamp where a writer exists; convention everywhere else.** Fields written by a hook or CLI gain machine stamps, deleting the hand-typed field rather than policing it; surfaces only sessions author (Chapter prose, memory frontmatter dates) take the decision 1 convention. Rationale: a stamp needs a writer, inventing writers for session-authored prose is the ceremony-versus-coverage trade this repo has declined repeatedly, and removing a field from human hands is the one repair fabrication cannot route around, since a timestamp does not feel like a measurement while it is being typed.
3. **Enforcement is a two-direction review-charter clause, no mechanical guard.** The review lenses check both directions: a journal-layer figure missing its moment-pin is flagged, and dated-evidence annotation appearing in a curated surface is flagged as the journey-ban violation it is. Rationale: the clause rides review machinery that already reads every diff and polices the operator's litter concern by name; a mechanical guard would need to recognize a figure in arbitrary prose, which produces false alarms and quiet misses at once, and the kit's recorded stance is that guards narrow honest writers without authenticating anyone.

## Sections of Work

### 1. The moment-pin convention lands where figures are written, and the bar lands beside it

Model: opus

The convention from decision 1, stated where writers of journal figures read: the executing-work skill's Chapter and gate-reporting guidance, and the testing-discipline skill's baseline-capture guidance, each gaining the moment-pin form (source, date, contention) and the cite-do-not-restate rule for deep evidence. The curated-surface bar is stated in the same edits as the convention's boundary, one sentence each, pointing at the doctrine's journey ban rather than restating it. The claude-kit project memory `suite-baseline-is-not-zero-fail` is superseded per its own note: its scatter warning becomes the convention, and the memory is updated to point here rather than carry the interim form. Whole-file review per the recorded skill-amendment defect mode; grep the tree for pins over the edited sentences before editing.

Files in scope: `plugins/claude-kit/skills/executing-work/SKILL.md`, `plugins/claude-kit/skills/testing-discipline/SKILL.md`, the project memory file named above and its index line.

### 2. The machine epoch is a memory record with a canonical key

Model: opus

The memory-system skill gains the epoch convention: a machine-tier record at a canonical key the section fixes, carrying the machine's current configuration facts (cores, memory, the environment exclusions that move benchmarks) and the date they took effect, written through the memory CLI per that tier's CLI-authored rule, updated by whoever observes a configuration change, with the current 2026-08-27 epoch written as the first record so the convention ships populated rather than empty. The comparison duty is stated with it: a session leaning on a recorded figure compares the figure's moment-pin date against the epoch and treats a before-epoch figure as expired evidence, and the review clause of Section 4 checks the comparison where a diff leans on one.

Files in scope: `plugins/claude-kit/skills/memory-system/SKILL.md`, the machine-tier record (CLI-authored, never the Write tool).

### 3. Hook-written time fields stop being prose, and board reads self-check the clock

Model: opus

The stamping from decision 2, applied to the surfaces that have mechanical writers, with the exact field set confirmed at implementation against the seat-infrastructure contracts rather than assumed here: the registry fields a hook can stamp at the moments it already fires (the `seat-stop.js` heartbeat writer being the precedent and the natural carrier), and any board or goal-CLI-written line whose date a CLI can supply from the clock rather than from the writer. Where a contract makes a session the field's only writer, the repair is a stamping helper the session's own push step calls, so the date is read from the instrument even where the write stays the session's. The read-protocol self-check from the Goal ships here too: the board and ledger read steps in the coordinator and role skills compare the newest stamp against the clock and say so when one sits in the future, red-first on a future-stamped fixture with a present-stamped control. Registry and claim contracts are single-writer surfaces with recorded carve-outs, so every edit is checked against the role skill's writer rules before it ships, and no stamp is added that would put a second writer on a peer's file.

Files in scope: `plugins/claude-kit/hooks/seat-stop.js`, `plugins/claude-kit/skills/role/SKILL.md`, `plugins/claude-kit/skills/coordinator/SKILL.md`, matching `test/` files; the implementer names any helper file it adds.

### 4. The two-direction clause joins the reviewer charters

Model: sonnet

Decision 3's clause, added to the reviewer charters in the idiom the review-and-record effort's amendments established: a journal-layer figure in the diff missing its moment-pin is a finding, and dated-evidence annotation in a curated surface is a finding named as a journey-ban violation. Both directions stated in one clause so neither is read as the whole. Whole-file review per the recorded skill-amendment defect mode.

Files in scope: the reviewer agent charter files under `plugins/claude-kit/agents/` (the implementer names the exact set, matching where the review-and-record amendments landed).

## Related

- `docs/plans/claude-kit_seat-infrastructure_spec_v1.md`: Section 3's registry contract and Section 5's seat-stop hook are the stamping precedent and the nearest surfaces; this plan runs after that one ships.
- `docs/plans/claude-kit_review-and-record-discipline_spec_v1.md`: its Sections 6 and 7 (absence checks, run-authored corroboration) are sibling review-discipline rules from the same kaizen batch; the provenance-check clause here should match their charter idiom.
- The claude-kit project memory `suite-baseline-is-not-zero-fail`: carries the interim scatter warning this plan replaces with a convention.

## Chapters
