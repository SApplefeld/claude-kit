# Claude-Kit Memq Session Recap

Status: In Progress
Commit Model: Commit-and-Push
Fable Spend: finishing reviews
Created: 2026-08-01

## Goal

Scott can tell how the memory system is actually being used: whether sessions are exercising the memq extension layer (outcome logging, applied stamps) or writing traditional MD memory files, or both, and what kind of information is being saved. When this is done, a `memq recent` command reports all memory-store activity inside a time window, labeled by surface, and the close-out ritual carries that digest to Scott so every substantive session ends with an accurate account of what it saved.

## Approach

This is an observability gap, not a data gap: every write surface is already timestamped on disk. `memq log` appends `{ts, ...}` to `outcomes.jsonl`; `memq touch`, `memq get`, and the read-stamp hook append `{ts, file, kind}` to `usage.jsonl`; memory files and `MEMORY.md` carry mtimes. The feature is a reader over those surfaces plus a boundary to diff against, delivered two ways: pull (Scott runs `memq recent --since 7d` any time to answer "is memq being used at all") and push (the close-out runs it over the session window and relays the digest).

The digest answers the memq-versus-MD question by construction, because provenance rides the surface: journal entries and stamps only exist via memq, while project-tier memory files only arrive via the Write tool and type-tier files only via `add-type`. No write-path change is needed anywhere.

A deterministic command plus a skill-step trigger was chosen over two alternatives (decided 2026-08-01): a behavior-only recap rule loses because model recall across a long session is the mechanism that already fails today, and a Stop-hook nudge is deferred because it needs dedupe state and its output reaches the model rather than Scott; it remains the follow-up if close-out compliance proves weak, which `memq recent --since 7d` itself will measure.

Sequencing (decided 2026-08-01): this plan edits `plugins/claude-kit/scripts/memq.js`, which the instance-store-pin plan has in flight, so it is queued behind that plan and starts only after it completes. Because `recent` hangs off `projectMemoryDir`, it follows that plan's `KIT_MEMORY_PROJECT` pin automatically.

Test harness: Node's built-in runner, Node v24. The gate is `node --test "test/*.test.js"` from the repo root, quoted; the bare directory form discovers no files and produces a synthetic false red. Capture the pass/fail baseline at execution start, not from this doc: the instance-store-pin work lands first and moves the count.

## Standing Brief Amendments

- The gate is `node --test "test/*.test.js"`, quoted. Never the bare directory form.
- Never write under `docs/`: the docs-write-guard denies a non-curator subagent that write. Return doc prose in the final message for the main thread to place.
- Do not write to real user state. Point any store at a temp root via `KIT_MEMORY_ROOT` plus `KIT_MEMORY_ROOT_ALLOW_DATA=1`, and use a short temp root, never the scratchpad path: the store flattens the cwd into one directory name and a long root exceeds MAX_PATH. Follow the existing temp-root pattern in `test/memq.test.js`.

## Sections of Work

### 1. `memq recent`: the time-boxed activity digest
Model: opus

`memq recent [--since <n>d|<n>h]` (default `1d`) prints one digest of store activity inside the window, grouped by surface, each group opening with a coverage line that states its count even at zero, the same posture as `recall`, so an idle surface is a stated fact rather than a silent absence.

Surfaces, spanning the project tier and any declared type tier (every store reader spans both tiers; a project-tier-only reader is this store's known failure mode):

- Journal entries logged (from `outcomes.jsonl` `ts`): key, pass/fail, summary.
- Applied stamps (from `usage.jsonl`): memory name and tier. Read stamps report as a count only.
- Memory files added or updated (from file times), per tier, split added versus updated where the platform distinguishes creation time, labeled updated otherwise. Archive directories included, so a decay-pass demotion shows up.

Rules:

- Read-only, and stamp-free: `recent` reads sidecars and file stats, never serves a body, so it writes no `read` stamps and mutates nothing.
- `--since` takes `<n>d` or `<n>h`; anything else is refused loudly. No other flags.
- Resolves the store exactly as every other command does (`projectMemoryDir` and the gated overrides), so it composes with `KIT_MEMORY_ROOT` and the instance pin with no code of its own.

Files: `plugins/claude-kit/scripts/memq.js`, tests in `test/`.
Acceptance: gate green. Against a known-answer store in a temp root: entries inside the window appear and entries outside it do not, across all three surfaces and both tiers; an empty store prints all coverage lines at zero; a hostile `--since` is refused; and `usage.jsonl` is byte-identical before and after a `recent` run.
Tests: at minimum, lock the window boundary both directions, the two-tier span (a type-tier record appears without a project-tier sibling), the zero-coverage posture, and the stamp-free guarantee; a `recent` that silently stamped reads would corrupt the decay evidence it reports on.

### 2. Wire the recap into close-out and the skill reference
Model: opus
Locus: inline

Load the writing-skills skill first; both edits are behavior-shaping prose.

- `plugins/claude-kit/skills/memory-system/SKILL.md`: a `memq recent` row in the command reference table, and a short norm: at close-out, run `memq recent` over the session window and carry the digest into the close-out status, labeled by surface. Add recap triggers (session recap, memq recent, memory activity) to the skill's frontmatter description so the skill loads when they come up.
- `plugins/claude-kit/skills/finishing-work/SKILL.md`: the close-out step list gains the recap run, so the report reaches Scott wherever finishing-work runs.

Files: `plugins/claude-kit/skills/memory-system/SKILL.md`, `plugins/claude-kit/skills/finishing-work/SKILL.md`.
Acceptance: both skills name the command and the close-out norm; the memory-system frontmatter carries the new triggers; no other skill or doc claims the recap.

## Out of Scope

- A Stop-hook recap nudge. Deferred until `memq recent --since 7d` shows close-out compliance is weak; that measurement is the reopening trigger.
- A session-start boundary marker. `--since` covers the need without new state.
- Attributing an MD file write to a specific tool beyond the tier-level provenance the digest already implies.
- Any change to write paths, stamps, or the decay lifecycle.

## Open Questions

None. Approach and sequencing were settled with Scott on 2026-08-01; the 1d default window is a low-blast pick, swappable on request (the constant lives beside the flag parsing in `memq.js`).

## Related

- Queued behind `claude-kit_instance-store-pin_spec_v1.md`, which holds `scripts/memq.js` in flight and whose `KIT_MEMORY_PROJECT` pin `recent` inherits through `projectMemoryDir`.
- Builds on `../archive/claude-kit_fleet-integration_spec_v1.md`, which established the gated store overrides `recent` resolves through.

## Chapters

### Chapter 1 - 2026-08-01
Completed: 1. `memq recent`: the time-boxed activity digest
Implemented By: implementer-opus, one dispatch plus one fix round via the same agent's context
Metrics: 1 review round (adversarial + blind + security, all at the session model); 0 NEEDS_CONTEXT; 0 escalations; advisor opus
Decisions / Surprises:
- Two spec adjustments, both fulfilling the spec's own stated rules rather than changing intent, and both endorsed by the adversarial reviewer as following from the spec text. The digest spans three tiers, not the two the spec names: the run-scoped pending tier exists and the spec's own parenthetical says a project-tier-only reader is this store's known failure mode. And `recent` carries the provenance fence, which the spec does not mention: it is a new path carrying store content into a model's context and it is recall-shaped, so `security-model.md`'s output-shape test puts it with `recall` rather than with `find`.
- The fence rule was applied more widely than the dispatch brief first instructed, and the brief was wrong. It told the implementer to match `cmdRecall` and leave journal lines at column zero under a store pin. The security and adversarial reviewers independently rejected that: `recall` emits one line per journal key, `recent` emits one per entry inside the window, and `recentDigest` cuts the journal last, so a pinned digest is exactly the shape where unfenced other-worker prose can fill the budget. Pinned journal lines now carry the fence. `cmdRecall`'s own narrower posture is left unchanged and is named below as out of scope.
- The archive surface was dead code against its own contract. `decay-prune` archives with a bare `fs.renameSync` and rename preserves mtime, while membership keyed on mtime alone; an archive candidate is idle 60+ days by construction, so a demotion could never land inside any plausible window. Archive records now key on `max(mtime, ctime)`, the clock a rename actually moves. The blind reviewer reproduced the failure end to end before it was fixed.
- The test that covered the archive surface passed only because its fixture hand-wrote an archived file with a 3-hour mtime, a state no production path can create. It now drives a real `decay-prune --archive` and was watched red against the old code first.
- A latent crash surfaced in shared code: `recallAgeColumn` called `new Date(ms).toISOString()`, which throws `RangeError` for a finite value outside Date's range, so one corrupt file mtime ended the whole digest. The function already promised `unknown` for a moment no arithmetic can trust, so the range guard makes it honor its stated contract. It is shared with `recall`, with no behavior change on any valid input.
- The `added` label needed a platform gate to match the spec's "where the platform distinguishes creation time, labeled updated otherwise". A birthtime-versus-mtime comparison cannot express it: where Node falls back to ctime, an ordinary content write leaves the two equal, which is indistinguishable from a genuine never-modified file.
- `docs/security-model.md` gained the `recent` row and its two counted claims moved (three type-tier paths to four, five fenced hops to six). A change that falsifies a count has a blast radius set by where the count is repeated, which is the drift-sweep rule this session's earlier commit (36cb51b) put into the curator's charter.
Review Findings: 4 Major and 7 Minor raised across three reviewers, all 11 fixed. 8 were verified red-first by reverting the fix against its new test, including the `RangeError` crash and the unreachable archive path. Three findings were adjudicated as no-change with the reason recorded: a rollup and a raw stamp both counting as stamps (the group counts stamps and says so), a future-dated mtime staying in every window (reading a skewed clock as "just now" beats hiding real activity), and the interleaved per-group output shape (it is what the spec's own wording describes). Two residuals are known and named rather than hidden: the framing line keys on type-derived records built rather than records surviving a budget cut, so a pin whose every type line is cut still names the type tier; and `cmdRecall`'s unfenced pinned journal lines are a narrower instance of the same question, left out of scope because changing a shipped command's output is a separate call.
Gate: 456 tests, 456 pass, 0 fail, against a 444 baseline captured at 2b901f3 plus 36cb51b. +12 tests, all new; nothing else moved.
Next: 2. Wire the recap into close-out and the skill reference
Commit Model: Commit-and-Push

### Chapter 2 - 2026-08-01
Completed: 2. Wire the recap into close-out and the skill reference
Implemented By: main session (the section carries `Locus: inline`, and both files are behavior-shaping prose)
Metrics: 0 review rounds (see below); 0 NEEDS_CONTEXT; 0 escalations; advisor opus
Decisions / Surprises:
- The close-out norm has one owner, not two. Stating it in both skills would have been the rule-said-twice antipattern `writing-skills` names, so it follows the precedent already in `memory-system` for the decay pass: `finishing-work` step 7 owns the trigger and the run, and `memory-system` describes what the command is and points at that step. Neither restates the other.
- The per-section review pair was skipped under `executing-work` step 3's allowance for a small self-contained section. Four edits, no logic, and the finishing pass reviews the whole changeset including these files. Recorded here rather than left implicit.
- The `memq recent` row and the Session recap section state only behavior the shipped code has, including the archive clock, which was a defect until this effort fixed it. Nothing in the prose promises a capability the command does not have.
Review Findings: none raised; the finishing reviews cover this section.
Gate: 456 tests, 456 pass, 0 fail. Prose-only, so unchanged from Section 1, and no hook or `hooks.json` was touched, so no build stamp refresh is owed.
Next: finishing-work
Commit Model: Commit-and-Push
