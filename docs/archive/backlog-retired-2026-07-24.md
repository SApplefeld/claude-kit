# Backlog items retired 2026-07-24

Retirement reason for every item below: superseded by `claude-kit_compaction-unwind_spec_v1.md`, which removed the resume relay, the context tripwire, chain mode, and the kit-goal leash's relay-handoff clause. These items existed to harden or measure machinery the kit no longer ships, so they are closed rather than carried.

Kept in the live backlog: the `permission relay (v2.1.81+)` item under Explore channels, which is a native Claude Code feature and unrelated to the kit's relay.

## Retired in full

- **Relay hardening is frozen (decided 2026-07-22).** The relay stays as-is: an attended-workstation convenience whose failures degrade to the manual `/resume` line by design. Reliability investment in the relay planes is over; relay items in this backlog are parked by default and picked up only on Scott's explicit call. Driver: the AI OS (Spine) never depends on compaction - its Dispatch layer spawns a fresh worker per section and declares that through the external-engine contract (`KIT_EXTERNAL_ENGINE=1` for kit hooks plus a stand-down sentence in the directive for kit skills; `archive/claude-kit_external-engine-standdown_spec_v1.md`) - so compaction's behavioral and relay planes no longer sit on any unattended path. Kit-native attended and chain runs keep the full machinery.

- **Relay request queue: single-file last-writer-wins collision (2026-07-16).** `request.txt` is a machine-global single file, so two boundary requests written close together in different repos could have the second overwrite the first before the watcher's poll read it.

- **Failed or absent relay has no context ceiling: "continue uncompacted" grows unbounded (2026-07-17).** When a boundary compaction succeeded but the relay could not fire, the run continued uncompacted with no upper bound on context.

## Retired fragments of items that survive

- From **Workstation (ASR) config repairs (2026-07-15 verification pass)**, part (2): the ASR relay was armed and carried multiple production resumes 2026-07-18 through 07-21, confirmed by `processed\` archives and `relay.log`. Part (1), the dead user-level graphify PreToolUse hook, remains live in the backlog.

- From **Kit dogfooding follow-ups from the 2026-07-15 hardening session**, part (1): ASR ran engine-compact plus relay-resume end to end in production repeatedly 2026-07-18 through 07-21 (the Opus Demo UI and App Studio chains). Part (2), the never-executed sparse preserve-verbatim path, remains live.

- From **Explore channels for unattended interactive runs**, the closing driver: the 2026-07-10 overnight chain ran on manual dispatch because the resume relay was absent. The channels research item itself remains live.

- From **200k gate follow-up**, the mechanism framing: the observation that chain supervisors compacted their workers dozens of times but never themselves, and the three remaining suspects (the gate wording in executing-work step 8, the missing supervisor-self-compaction case, and the breadth of the interactive attended carve-out). All three named a check-gated compaction step that no longer exists. The corpus measurements survive in the live item, since the underlying question, whether long orchestrator sessions hold their context down, is unanswered and now rides native compaction.
