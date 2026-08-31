# The judgment sidecar: a local-model second reader over fleet tool calls

Status: In Progress
Commit Model: Commit-and-Push
Session model: opus or above; section 8 requires a fable design pass before implementation

## Dispatch Authorization

Authorized 2026-08-30 by the operator in the expert seat's design dialog: the full revised scope of this spec (capture, judgment, in-band pointer delivery, memory recognition, and the memq semantic channel), queued for execution immediately after the public-surface-hygiene plan by the operator's direct instruction, for any session holding this plan. The queue insertion into the armed goal state was itself operator-instructed in the same dialog.

## Goal

A sidecar that reads the fleet's tool calls with a second mind and puts what it sees in front of the session at the moment it matters. Three products, all powered by the host's local model at marginal cost near zero:

1. **Judgment.** Every captured tool call is judged after it runs: did the action do what the stated intent required. Verdicts land in per-session logs; `diverged` verdicts, the quiet failures, come back to the session that produced them on its next tool call.
2. **Recognition.** Each captured call is checked against the project's memory index: does a stored memory bear on what the session is doing right now. A hit comes back as a pointer at the next tool call, the background-recognition loop a human mind runs without being asked.
3. **Retrieval.** `memq find` gains a model-judged semantic channel that outranks the embedder's cosine similarity when the endpoint is up, and degrades to the embedder honestly when it is not.

The sidecar holds no authority. It observes, judges, points, and reports; the session and the operator decide. Its founding product remains converting claims the fleet can only assert today ("no silent failures happened this session") into logged, countable facts with a named instrument behind them. The defect class it exists for is the quiet one: an exit code that belongs to the wrong command in a pipeline, a search whose silence proves nothing about its pattern, a staged list that holds more than the intent named.

## Evidence

The design rests on a measured audition, journaled end to end under the project journal key `local-model-audition` (query: `memq get local-model-audition`). The constants:

- Endpoint: Ollama on the Hyper-V host GPU, at the address the operator memory tier records (`the-host-serves-a-local-llm-endpoint-for-all-vms`); that record is the canonical human-readable source, and the machine-readable source is the per-machine config file this spec introduces. Probe for liveness before leaning on it.
- Model: `qwen3.8:27b` (Q4_K_M, 17.5 GB weights, fully VRAM-resident, keep-alive forever). Standing context 65536, one serial slot; `OLLAMA_NUM_PARALLEL` is parsed but inert in the installed version, so the lane is serial by construction.
- Performance: roughly 90 to 104 tok/s generation, 320 tok/s prefill. Latency is output-token-bound: a one-word classification runs about 200 ms, a schema-constrained verdict with a 300-character reason runs 0.7 to 1.5 s, so the uncontended lane sustains 1 to 2 verdicts/second. Context allocation does not affect per-call latency (16K, 32K, and 64K measured within noise); an allocation-change reload costs about 10 s of cold first call. Fleet volume sits orders of magnitude below the ceiling.
- The lane has a standing second tenant: the operator's own agent harness runs full sessions against the endpoint, so calls queue behind its generations. The contended-lane resilience rule below is load-bearing under normal operation.
- Judgment capability: 14/14 on policied event triage; 12 to 13 of 13 substance on real production tool calls harvested from fleet transcripts, including inverted semantics, a trap-shaped-but-honest exit echo, and observation intents.
- Recognition capability: against the real 44-record project index, 12/12 recall on gold-labeled situations, 3/3 clean on true negatives with zero invented relevance, extras limited to adjacent pointers beside a correct primary hit. The index prefix caches in the slot, so steady-state recognition runs near 1.1 s and a names-only output cap brings it lower.
- Distillation capability: 3/3 correct lessons from real incidents at the one-level-more-general bar (one under-generalized); the model composes past schema caps, so constrained decoding truncates mid-sentence. Contract in the schema, budget in the prompt, and adjudication before anything is saved.
- Format: prose output breaks its contract on non-achieved verdicts; JSON-schema-constrained output with an enum eliminates the failure class. Constrained decoding is mandatory.
- VRAM ledger, operator-measured: 7 GB non-model host floor, 17.5 GB weights, KV near 65 to 70 KB per token; the standing 64K context holds total GPU use steady at 27.3 of 31.5 GB under genuine full load. 128K over-commits and pages softly to system RAM while the API still claims residency.
- Runner behavior: `llama-server.exe` host RAM plateaus near 8 GB under sustained load; an Ollama restart clears it (about 6.5 s reload). Posture: budget headroom, restart on threshold.

Audition scripts live at `.kit/round2-policy.mjs`, `.kit/round3-action.mjs`, `.kit/round5-real.mjs`, `.kit/round6-memory.mjs`, `.kit/round6b-distill.mjs`, and `.kit/harvest-cases.mjs` in this repo's gitignored scratch; section 7 promotes their content into committed regression fixtures.

## Design

One repo (this one), three components, file contracts between them. All machine-local sidecar state lives under `~/.claude/kit-sidecar/`: `spool/` (capture), `inbox/<sessionId>.jsonl` (delivery), `logs/` (verdict and recognition logs, findings, offsets). The endpoint's machine-readable config is `~/.claude/kit-endpoint.json` (`{ "url", "model" }`), operator-authored per machine; every component treats its absence as "no endpoint on this machine" and stays dormant or degrades, never errors.

**The capture hook (kit-shipped).** A PostToolUse hook, Bash matcher in v1, that appends one JSON line per completed tool call to the spool: timestamp, session id, cwd, tool name, the call's `description` field (the declared intent), the command, the result truncated to a bounded length, and the harness error flag. Fail-open and dormant-by-default: it stats the spool root and exits silently when absent, so installing the hook activates nothing until the daemon's first run creates the root. No network, no waiting; any internal error exits 0. The hook must never disturb the session it observes.

**The judge daemon.** A small Node process, one per VM, living in this repo under `sidecar/` and run from the working clone (the machine signpost's `kitRepoPath` locates it). It consumes the spool with a persisted offset and, per entry: formats the INTENT/ACTION/RESULT triple, calls the endpoint with the proven judgment prompt and a schema-constrained response (verdict enum `achieved | failed | diverged`, reason capped at 300 characters, budget stated in the prompt); resolves the entry's project from its cwd, loads that project's memory index (cached, mtime-checked), and makes a recognition call with the proven zero-invention prompt (empty result is the normal case); appends verdicts to the per-session log, `diverged` findings to the findings file, and delivery items to the session's inbox. Delivery items are `diverged` verdicts and recognition hits only, deduplicated per session (one pointer per record per session, one alert per call). V1 is manually started; service installation and fleet-wide distribution are post-field-trial decisions.

**The delivery valve (the same capture hook, second duty).** After spooling, the hook reads its own session's inbox from a per-session delivered-offset and emits undelivered items as hook output the model sees on its next turn. Pointer-not-body discipline throughout: a verdict alert carries the intent, the one-clause reason, and "verify before proceeding"; a memory pointer carries the record name, one clause of why, and the `memq get <name>` spelling; nothing quotes a record body or a transcript. Caps: at most 3 items per call, 600 bytes total, overflow stays queued for the next call. Dormant unless the inbox directory exists; fail-open like the capture duty. The valve is why advisory files are a substrate rather than a dead end: the daemon thinks off the session's critical path, and the session still hears about it one tool call later, which for a lied-about exit code or an applicable memory is the relevant moment.

**The memq semantic channel.** `memq find` gains a model-judged block: when `kit-endpoint.json` exists, probe the endpoint with a short timeout (about 400 ms); on success, send the query and the candidate set (lexical hits plus the embedder's top ranks) for judged relevance with reasons, and label the block as model-judged; on probe failure or timeout, fall back to the embedder block unchanged, with one honest line naming the degrade, exactly as the embedder's own absence is named today. The endpoint is never a hard dependency: store verbs, recall, and every write path are untouched, and a machine with no config file behaves byte-identically to today.

**Resilience, field-derived.** Contended lane: calls carry a timeout; on timeout the daemon gap-marks ("calls N to M not judged, lane busy") and moves on, never blocking, never retry-storming. Endpoint down: gap-mark the range, keep consuming; a gap is a recorded cannot-measure, never a silence that reads as clean. Runner restart: a connection failure after a healthy period is retried once after the reload window (about 7 s), then gap-marked.

**Reporting.** The findings file and a rollup command (counts per session per day, gap ranges included) remain the audit surface; the coordinator's status round may read them. Nothing couples to Discord in v1.

## Non-goals

- **Interrupt authority.** The triage organ scored at ceiling in the audition because fleet events are sparse and mostly obvious; the marginal value over the coordinator's existing steering surfaces is thin, while preemption authority and double-notification are real costs. Interrupt-style reflexes belong to a future host-owned-loop organism. Decided 2026-08-30; argue against this record, not from scratch.
- **Bodies in-band.** The valve delivers pointers, never bodies: no record text, no transcript quotes, no verdict rationale beyond one clause. A body injected by machinery would be read as fact without anybody opening the record; the pointer preserves recall-then-verify.
- **Parallelism engineering.** The serial lane clears 1 to 2 verdicts/second against a fleet producing a few thousand calls a day. Migration to llama.cpp's own server with true batching is the known path if saturation arrives.
- **A model cascade.** One model serves all roles; a smaller model returns only if VRAM pressure demands it.
- **Store writes by any component.** The daemon points, the distiller drafts; sessions and the operator author. Nothing in this plan writes to the memory store.

## Standing Brief Amendments

Binding on every section opened after the amendment, dispatched or inline. Each entry
names the class rather than the instance that produced it.

1. **A predicate a second hook needs is extracted to a `kit-*-lib.js`, never reached by
   requiring the sibling hook that happens to hold it.** A hot hook path pays the whole
   module load for one answer, and a sibling that fails to load takes the borrower down
   with it silently. The repository already ruled this and wrote the reasoning into
   `plugins/claude-kit/hooks/kit-network-lib.js`, which exists as 41 lines precisely so a
   PostToolUse hook need not load an 11,880-line module to answer one question at a
   measured 8.7 to 11.4 ms. Adopted 2026-08-30 on the spec author's consult.

2. **A branch is not tested until a case exists that can only pass if that branch works.**
   The failure shape this closes is a shared fixture: every case reuses one payload shape,
   one warmed require, or one field small enough that later cut stages never run, so the
   suite is structurally blind to the branches it names in its own test titles. Cost
   measurements take the path production takes, which for a hook is a cold spawn and never
   a warmed in-process call. Adopted 2026-08-30 after one review round found three
   instances in a single section.

3. **A shipped document that says where data goes names the machine boundary and the
   transport, not a role word that can read as either.** "The host" naming both this
   machine and the hypervisor turns a cleartext cross-machine POST to a multi-tenant
   service into a sentence that reads as no egress at all. Adopted 2026-08-30 from the
   section 1 security round.

5. **A section's tests, replays and acceptance runs read and write fixture stores and
   fixture homes only, never the live `~/.claude`.** The daemon, the hook and every
   replay resolve their state through an explicit override (`--state-dir`, `--config`,
   `--memory-root`, a fixture `HOME`), so no run of this plan's work can touch the
   operator's real store. This restates at execution time what the plan's Non-goals
   already bar at design time. Adopted 2026-08-30 during section 3, and recorded in this
   block at section 5's open: it was cited by number in section 4's text and in
   Chapter 3's acceptance while this block never carried it, so every dispatch after its
   adoption inherited it through brief text rather than from the block that is supposed
   to deliver it.

6. **A control for a predicate over a class is built from the class's generating rule, never
   from a list of spellings.** A name list samples a class and cannot cover it: the member
   that breaks the predicate is by definition the one no name in the list suggested, so a
   list-built control returns the same green whether the predicate is sound or blind to the
   member nobody thought to write down. Where the class has a generating rule, the control
   enumerates that rule's boundary cases, chooses each instance for its shape rather than its
   spelling, and states the rule in the case's own text, so a later reader can tell coverage
   from sampling. Adopted 2026-08-31 after the live-store screen was found accepting a path
   inside the live tree for the third time in one section, on three different defects, each
   time with a control drawn from an enumerated list of spellings and each time reported as
   closed by the round that added more spellings to the list.

7. **A screen answers about the path it was handed, and every component created beneath that
   path afterward is unscreened.** A caller-supplied root that passes a containment screen
   licenses nothing about the directories a later step creates under it: a recursive mkdir
   follows a reparse point on any intermediate component, so a link planted below the screened
   root routes the write wherever it points while the run prints the sentence saying the root was
   screened and found outside. A writer under a caller-supplied root therefore either creates each
   component through the same guard that screened the root, or re-screens the deepest directory it
   actually created immediately before the write. Adopted 2026-08-31 after the live-store screen,
   rebuilt to close five instances of the accept-a-path-inside-the-live-tree class, was found to
   have moved the sixth instance one layer down into the writer that trusts it.

No entry 4 exists in this plan. No rule numbered 4 appears in any surviving artifact of
it, so the gap is a numbering gap rather than a lost rule, and entry 5 keeps the number
it was cited under so both existing citations resolve.

## Sections of Work

### 1. Spool contract and capture hook. Model: opus

The spool line schema documented in `sidecar/CONTRACT.md` and mirrored in the hook's header comment; the PostToolUse hook implemented per Design (capture duty only; the valve arrives in section 3) with tests: a well-formed line for a Bash call, dormant when the spool root is absent, exits 0 on malformed payloads and write failures, latency under a generous asserted ceiling. Ships in the kit's hooks directory through the normal build.

The section as built also carries three things its original text did not name, each recorded here so the
document matches what shipped. The harness error-flag normalization is extracted to
`plugins/claude-kit/hooks/kit-tool-payload-lib.js` and required by both the capture hook and
`memory-recognition-nudge.js`, per Standing Brief Amendment 1. `docs/security-model.md` gains a
`## The capture spool` section, because the changeset adds a machine-local plaintext concentration of every
shell command and its output to `~/.claude` and that document is the inventory of what lives there.
`docs/architecture.md`'s PostToolUse enumeration gains the hook.

Acceptance: hook tests green in the kit suite; a manual session on this VM with the spool root present produces schema-valid spool lines for real calls.

### 2. Judge daemon core. Model: opus

`sidecar/` scaffolding (plain Node, no framework, config loading from `kit-endpoint.json`, `.gitignore` untouched since state lives under `~/.claude/kit-sidecar/`), spool consumption with a persisted offset, the judgment call with schema-constrained output, per-session verdict logs, findings appends, and all three resilience behaviors. The system prompt ships as a versioned file, not an inline string. The daemon's first run creates the spool root: the activation act.

Acceptance: against the live endpoint, the daemon judges a replayed spool of the audition's 13 harvested cases and reproduces the audition verdicts; with the endpoint stopped, it gap-marks and continues; killed and restarted, it resumes from its offset without re-judging.

### 3. Delivery valve. Model: opus

The hook's second duty per Design: inbox readback with a per-session delivered-offset, pointer formatting for both item types, the 3-item/600-byte caps with overflow queuing, dormant without the inbox directory, fail-open. The daemon side: inbox writes for `diverged` verdicts with per-call dedup. Security review on this section is mandatory: the valve injects text derived from model output and from spool content into sessions, so the formatter must neutralize anything instruction-shaped (the injected line states it is advisory sidecar output and data, not instructions).

The section as built also carries four things its original text did not name, each recorded here so the
document matches what shipped. The subagent stand-down predicate is extracted to
`plugins/claude-kit/hooks/kit-agent-identity-lib.js` and required by all four hooks that ask the question
(`kit-sidecar-capture.js`, `memory-recognition-nudge.js`, `chapter-boundary-nudge.js`,
`compact-deferral-nudge.js`), per Standing Brief Amendment 1: the review round found the five key
spellings hand-copied across the call sites, which is the drift that amendment exists to stop. The lib
exports three readings rather than one because the sites genuinely ask three different questions, and
flattening them would have silently widened `chapter-boundary-nudge.js`'s stand-down. This widens the
section's files in scope beyond the valve itself and is a deliberate fold rather than a scope slip.
`sidecar/inbox.js` is a new module holding the daemon's writing side, and `sidecar/logs.js` and
`sidecar/config.js` gain the delivered-set state and the inbox path respectively, because the dedup set
has to persist across restarts and the inbox is otherwise the one path outside `statePaths`. Inbox
retention rides the daemon's existing 14-day sweep, an expired offset held back while its queue is still
live, since a plaintext concentration the daemon owns with no retention was a Major in section 2.
`docs/security-model.md` gains a `## The delivery inbox` section and its producer-only neutralization
claim is corrected, because the valve deliberately re-applies the guard at the delivery boundary; the
two implementations sit in separate processes and are pinned equal by a test rather than shared by a
require. `docs/architecture.md`'s PostToolUse entry gains the second duty and drops its "emits nothing".
Acceptance: a live session on this VM with daemon running receives a diverged-verdict pointer on the tool call following a deliberately trapped command (piped exit-code shape); caps proven by a flooded inbox delivering 3 items and queuing the rest; hook tests cover dormancy and fail-open.

### 4. Memory recognition in the daemon. Model: opus

The recognition duty per Design: per-project index resolution from spool cwd with mtime-checked caching, the round-6 prompt with names-only capped output, per-session per-record dedup, recognition hits to the inbox as memory pointers, and a recognition log beside the verdict log. Empty results are the normal case and cost one cheap call.

The section as built also carries five things its original text did not name, each recorded here so the
document matches what shipped. Two predicates are extracted per Standing Brief Amendment 1:
`sidecar/endpoint.js` holds the endpoint transport lifted out of `sidecar/judge.js`, so the recognition
call reaches the endpoint without requiring the judgment module, and `sidecar/record-name.js` holds the
record-name pattern, which the index reader and the inbox both need. Three further modules are new:
`sidecar/memory-index.js` for project resolution and the mtime-and-size-checked index cache,
`sidecar/recognize.js` for the call and its answer parsing, and `sidecar/prompts/recognition-v1.js` for
the versioned prompt, mirroring `judgment-v2.js`. The daemon gains a read-only `--memory-root` option so
a replay resolves indexes from a fixture root rather than the live store, per Standing Brief Amendment 5.
`docs/security-model.md` gains a `### What recognition adds to the egress` subsection, because this is the
section that begins sending a project's whole memory index off the machine and that document is the
inventory of what leaves it. One extraction was deliberately NOT taken: memq's own project resolution is
required directly rather than wrapped, because two kit hooks already require memq for exactly that
question, so requiring it is the house pattern, and Amendment 1's stated rationale is a hot hook path,
which a long-lived daemon is not.
Acceptance: a replayed spool of the round-6 battery's 15 situations reproduces its 12/12 recall with zero gold misses and at most 2 non-gold pointers across the battery (amended 2026-08-30 by operator ruling, recorded in Decisions; clean negatives reported per case) through the daemon path end to end, pointers landing in the inbox with correct dedup; a session in a project with no memory index produces no recognition calls.

### 5. Findings surface and rollup. Model: sonnet

The rollup command over verdict logs, recognition logs, and findings: per-session and per-day counts, gap ranges, delivered-pointer counts, plain-text output a status round can quote.

The section as built also carries five things its original text did not name, each recorded here so the
document matches what shipped. `sidecar/rollup.js` is the command itself and `test/kit-sidecar-rollup.test.js`
its suite. Two predicates were folded in from outside the declared files, both in `sidecar/` and both
adjudicated at the review round: `sidecar/logs.js` gains an exported `gapNote` so the sentence a gap record
carries has one spelling rather than three, per Standing Brief Amendment 1, and `sidecar/endpoint.js` stops
putting `err.message` into a gap detail, because this section makes that field a printed one and an endpoint
URL carrying credentials throws with no error code anywhere in its cause chain, which is the branch that
would have spelled the URL into a rendered line. `sidecar/text.js` gains a shared `TEXT_MAX_CHARS`, because a
length cap is a property of the output channel rather than of the producer that first needed one, and this
command is that channel's second producer. The rollup also reads the daemon's own counters from
`logs/offsets.json` and renders them apart from its own parse counts, since a daemon that dropped spool
lines or failed a log write makes the rollup's totals incomplete and nothing else on the surface could say
so. `docs/architecture.md` gains a `sidecar/` repo-layout bullet, which that directory never had: sections 2
through 4 built the whole component set and only the capture hook was ever named there.

Acceptance: rollup output over sections 2 and 4's replay runs matches hand-counted totals, gaps included.

### 6. memq semantic channel with graceful degrade. Model: opus

The model-judged block in `memq find` per Design: config detection, the short probe, candidate-set judging with reasons, the labeled block, the honest degrade line, and byte-identical behavior when no config file exists. memq's store verbs and write paths are out of bounds for this section's diff. Tests cover: config absent (identical to today), probe fail (degrade line plus embedder block), probe pass (mocked endpoint, judged block shape); a live-endpoint run is the manual acceptance.

Acceptance: the memq suite's existing tests stay green untouched; the new tests cover all three states; a live `memq find` on this VM shows the judged block with the endpoint up and the degrade line with it stopped.

### 7. Regression batteries and replay harness. Model: sonnet

The audition batteries promoted into `sidecar/batteries/` as frozen fixtures with expected verdicts (judgment and recognition both), plus a harvest command extracting fresh INTENT/ACTION/RESULT triples from a named transcript file. Battery runs are on-demand evaluation, not CI, since they need the live endpoint.

Acceptance: frozen batteries reproduce at least the audition scores against the live endpoint; a fresh harvest of a recent session produces judgeable triples end to end.

### 8. Transcript distiller (gated). Model: fable design pass, then per that pass

Gated on the operator's call after a field trial of sections 1 through 7. Scope sketch for the design pass: end-of-session transcript extraction, chunked map-reduce distillation sized well inside the standing context, candidate memory drafts and contradiction flags written to a pending file for session or operator adjudication, budget-in-prompt plus validate-and-re-ask per the round-6b finding. Interaction with the shipped memory-recognition hook is evaluated then.

Acceptance: deferred to the design pass.

## Decisions

- Decided 2026-08-30: judgment over triage as the founding purpose. Triage scored at ceiling and duplicates coordinator steering; judgment addresses the fleet's documented quiet-failure class.
- Decided 2026-08-30: capture by PostToolUse hook, judgment by external daemon. Push-over-poll, structured payloads, subagent coverage, kit distribution; the daemon keeps model calls off every session's critical path.
- Decided 2026-08-30 (operator ruling, reversing the same-day advisory-only decision): advisory files are the substrate, not the product; in-band delivery of pointers is in scope. The original decision defended sessions against injected model output; the valve honors that concern by delivering pointers only, one tool call late, capped and neutralized, while the file layer remains the durable record. Advisory-only-forever would have built the loop and skipped its purpose: surfacing the right fact at the relevant moment.
- Decided 2026-08-30 (operator ruling): memory recognition ships in v1 through the daemon and valve, not deferred to the distiller gate. Round 6 proved the capability; the valve supplies the delivery path the deferral was waiting on.
- Decided 2026-08-30 (operator ruling): the memq semantic channel is in scope, with graceful degrade as the boundary: probe first, model-judged block when the endpoint answers, embedder unchanged when it does not, endpoint never a hard dependency of any store operation.
- Decided 2026-08-30 (operator ruling, reversing the same-day new-repo decision): one plan, one repo; the daemon lives in this repo under `sidecar/`. The separate-repo decision rested on the kit not owning the endpoint relationship; the memq channel gives the kit that relationship anyway, and a single repo makes the plan executable hands-off by the armed queue without cross-repo permission walls.
- Decided 2026-08-30 (operator instruction): this plan joins the armed queue immediately after public-surface-hygiene, by direct insertion into the armed goal state rather than a re-arm.
- Decided 2026-08-30: standing endpoint configuration context 65536, serial, keep-alive forever, per the operator's sustained full-load measurement (27.3 of 31.5 GB GPU, about 104 tok/s, runner RAM plateau near 8 GB). An earlier same-day reading put the sweet spot at 16K to 32K; longer operation at 64K settled it.
- Decided 2026-08-30 (spec author consult): section 8 is deferred by design, not a blocker, so this plan
  reaches Complete at section 7. Section 8 carries a gate plus a scope sketch and its own acceptance reads
  "deferred to the design pass", so there is no buildable acceptance a run could reach; declaring BLOCKED on
  it would misfile a designed deferral as a failure state and leave the plan tripping every session-start
  recovery advisory. Its substance moves to `docs/backlog.md` as a parked item naming its driving signal: the
  field trial of sections 1 through 7 elapsed, plus the operator's call.
- Decided 2026-08-30 (spec author consult): the harness error-flag normalization is extracted to a shared
  hook library rather than reached by requiring a sibling hook, per Standing Brief Amendment 1.
- Decided 2026-08-30 (operator ruling, taken at the keyboard in the spec author's session): section 4's
  recognition acceptance is amended from "3/3 clean negatives" to a total false-pointer budget, because the
  criterion counted the same harm (a false pointer interrupting the agent) in two columns and the shipped
  prompt is markedly quieter overall than the round-6 control. Amended criterion: the replayed round-6
  battery reproduces 12/12 recall with zero gold misses, and at most 2 non-gold pointers across its 15
  situations (the shipped prompt measures 1, case 11's; the control measures 8 and fails). Clean negatives
  stay reported per case. Case 11's gold label is affirmed by the battery owner on two surfaces: the
  prompt's own bears-on rule (an agent already listing `docs/plans/` gains no change of next action from
  the record) and the record's own declared triggers, which name the indexes and `git mv`, not a listing.
  The prompt is never tuned against case 11; future prompt iterations are scored on held-out cases. The
  rest of the section-4 acceptance (daemon-path end to end, dedup, no-index silence) is unchanged.
- Decided 2026-08-31 (consult ruling, adopted): the live-store screen in `sidecar/state-screen.js`
  compares FILESYSTEM IDENTITY rather than path strings. Path-string comparison is not salvageable
  here and the ruling settles that by measurement rather than argument: no single canonicalizer
  covers the class, since `fs.realpathSync.native` normalizes 8.3 names, case, `\\?\` and
  volume-GUID roots but returns a UNC admin-share spelling unchanged, and closing UNC by string
  would need a drive-mapping table Node does not expose. The shipped design is identity-anchored
  containment: a `dev`/`ino` walk up the candidate's realpath ancestor chain, with a one-segment
  case-folded name compare used only for components that do not yet exist on disk, since the leaf
  is usually about to be created. Pure identity was ruled out in the same breath: it regresses the
  one case the string screen gets right, an absent live tree, where every child of the home
  directory shares the same existing anchor. The old string predicate is kept as a REFUSAL-ONLY
  overlay whose `ok` is discarded, which is what makes its two known remaining defects harmless:
  both produce a false `ok`, and an overlay that cannot grant `ok` cannot act on one. Measured on
  22 generated cases: the ruled predicate wrong on 0, the shipped one wrong on 8, four of those
  failing open.
- Decided 2026-08-31: two further instances of the screen's defect class were confirmed at this
  boundary, bringing the count to six found in one section. Instance 5 is an 8.3 short name, and it
  is the one that matters most, because it needs no UNC, no admin share and no elevation and it
  reproduces on the system volume the live home sits on: two spellings of one directory stat to an
  identical `dev`/`ino` while the screen refuses one and accepts the other, with a genuine outsider
  correctly accepted in both spellings as the control in the other direction. Instance 6 is the
  `/[\\/]/` separator split in round 5's own fix, which on POSIX reads a genuine child directory
  named with a leading backslash segment as an escape. Both were reproduced by this session against
  the shipped module before being acted on.
- Declared assumption 2026-08-31, section 7: the rebuilt screen ships with its Windows behaviour
  MEASURED and its POSIX behaviour INFERRED, and this is a deliberate call rather than an oversight.
  This repository has no CI configuration and this box has no WSL, so no POSIX run is available
  here, and standing one up is a different goal than this plan's. What reduces the exposure is that
  the ruled predicate contains no separator literal and no platform branch at all: its only string
  literal is `.claude`, and the case fold is applied on both platforms deliberately, because folding
  over-refuses a renamed directory on case-sensitive Linux while an exact compare ACCEPTS a write
  into the live store on case-insensitive macOS. What would confirm the inference is a run of
  `node --test test/kit-sidecar-battery.test.js` on Linux or macOS. Override freely; a CI surface
  for this repository is recorded as its own backlog item rather than folded into this section.
- Declared assumptions, override freely: machine-local state under `~/.claude/kit-sidecar/`; endpoint config at `~/.claude/kit-endpoint.json`, operator-authored; v1 daemon manually started, no service install; fleet-wide daemon distribution decided post-field-trial; the hook ships dormant-by-default via the spool-root check, needing no setting.

## Out of scope for this document

The PIANO-organism substrate (Agent SDK host, streaming-input sessions, module scheduling) is a separate future effort. This spec is deliberately the smallest organ set that earns rent on the existing fleet.

## Chapters
### Chapter 1 - 2026-08-30
Completed: 1. Spool contract and capture hook
Implemented By: implementer-opus for the build and again for the fix round, with the review round dispatched through `Workflow` (adversarial, blind and security reviewers, model `opus`, effort `max`, the no-headroom row of the reviewer-effort table since this section's writer tier is opus). Base ref `9ab34a2`. The `docs/` writes were taken in the main thread, which the docs-write-guard requires.
Metrics: 2 implementer dispatches; 1 review round of 3 reviewers; 16 findings, all fixed; 1 fix round; NEEDS_CONTEXT 0; escalations 0; consults 2, both expert asks to the seat that authored this spec.
Decisions / Surprises: The `Status:` header read `Ready`, which is outside the two values the kit tooling reads, so it was normalized to `In Progress` at the start; a plan carrying any other value drops out of the SessionStart recovery inventory. Two expert asks went to the spec author and both were ruled at the source. The first ruled the shared-predicate extraction into this section rather than a later one, and the repository turned out to have written the argument down already: `hooks/kit-network-lib.js` exists as 41 lines with a header stating that an 11,880-line module must not sit on a hot hook path, at a measured 8.7 to 11.4 ms warm require, which is the same trade this section had made in the other direction. The second ruled section 8 deferred by design, so this plan reaches Complete at section 7; both rulings are recorded as dated decisions above. The surprise that mattered came at the acceptance step rather than in the code. Section 1 asks for a live pass on this VM, and live sessions run hooks from the installed plugin cache rather than from the working tree; that cache is pinned at commit `5edb4483fd03` and carries neither the new hook nor a `hooks.json` entry wiring it. Creating the spool root would therefore have produced an empty file, which is indistinguishable from a correctly dormant hook, so the check could not have answered the question it was run to answer. The window was announced to all four seats, cancelled before anything was created, and the all-clear sent.
Assumptions: (2026-08-30, section 1) `~/.claude/kit-endpoint.json` was absent on this machine and sections 2, 4 and 6 cannot be accepted without it, so it was authored from the canonical address in the operator memory tier; rollback is deleting that one file, and the operator may overwrite it. (2026-08-30, section 1) The spool retention window is 14 days, chosen by the implementer and stated in `sidecar/CONTRACT.md` as the rule the daemon must meet on startup; override freely. (2026-08-30, section 1) The day-file size bound is 64 MiB, following the sibling nudge's own log cap as precedent.
Review Findings: Three CONCERNS verdicts, no Criticals, 16 findings, every one fixed. The five security Majors: no retention owner, so the spool grew without bound; no tamper evidence, with removing the spool root stopping capture in a call that is itself uncaptured; an egress claim that read as no egress at all; `statSync` following a directory junction where this repository's own `kit-goal-lib.js` already ships the `lstatSync` guard with the reasoning written out; and the absence of any entry for this new surface in `docs/security-model.md`. The egress finding was the sharpest of the round and it lived in prose rather than code: the contract said the spool never leaves the host except in the prompt the daemon sends to the host's local endpoint, where "host" meant this machine in one clause and the hypervisor in the next, so a sentence describing an unauthenticated cleartext cross-machine POST of unredacted command output to a multi-tenant service read as reassurance. The implementer marked its rewrite reported-from-the-spec; it is upgraded to confirmed here, since the endpoint config on this machine carries an `http://` URL and no token and answers a probe with no auth header. Three further findings were one class rather than three: a test whose shared fixture makes it structurally blind to the branch its own title names, found in `resultText`'s untested response shapes, in `CUT_ORDER`'s second and third stages never being reached, and in a latency ceiling measured on a warmed in-process call where production takes a cold spawn. That class became Standing Brief Amendment 2. The fix round ran 16 probes; two came back green on the first pass and were re-cut rather than accepted, and one probe caught a defect in the implementer's own fix. Two reviewer framings were pushed back on with evidence and the pushback accepted: the header comment was silent about directory links rather than false about them, and the day-file link screen mostly formalizes on Windows a refusal `EISDIR` already produced, biting for real only on POSIX. The blind reviewer also flagged contamination in its own dispatch, correctly: the changed-file list carried the parenthetical "one added PostToolUse entry", which would not read identically for every diff in this repository and so failed the standing-property test. It disregarded the annotation and enumerated the file itself.
Stamps: Adjudicated 2, stamped 1. `this-vm-rides-a-host-with-an-idle-rtx-5090` stamped, since the VM-versus-host split is what made the egress paragraph a machine-boundary crossing rather than a local call. `doctor-fix-is-never-a-neutral-committer` skipped: read in the window by a hook rather than by this work, and nothing in this section runs the doctor. Two further operator records were stamped at intake as they were applied, the endpoint record that supplied the address and the probe-before-leaning rule, and the build-stamp record that is why a rebuild rode with every hook edit.
Gate: 2260 / 2256 / 1 / 3, exit 1, read from the run's own exit marker, with the box polled for a foreign test runner first and none found. Baseline 2223 / 2220 / 1 / 2, exit 1, from the previous plan's close on this same suite. Delta: plus 37 tests (29 in the capture hook's file, 8 in the new library's), plus 1 skip, a POSIX-only file-mode assertion this platform cannot honor, and the failure count unchanged at 1. Failures by name: a pinned directory too long to name faithfully stands the session down, this machine's one known permanent red. The whole gate ran because this section's delta touched a shared module, `memory-recognition-nudge.js`, and it also closes the one gap the implementer named in its own evidence: no pre-edit baseline of that file's suite was captured, and the whole-gate run shows its 74 cases green inside a total carrying no new failures.
Acceptance: met on its test half, open on its live half, and recorded that way rather than counted as done. A manual session on this VM producing schema-valid spool lines for real calls cannot run until the plugin installed on this machine carries the hook. What is confirmed instead, from two sources sharing no derivation path: `memory-recognition-nudge.js` has read `tool_input`, `tool_response`, `session_id` and `cwd` off this envelope in production for weeks, and this session's own harness transcript carries 2,814 real Bash tool_use blocks whose input keys are exactly `["command","description"]`, which is the intent field the judgment triple depends on. The live pass routes to section 2, where the daemon exists and a plugin update is warranted on its own terms.
Next: 2. Judge daemon core
Commit Model: Commit-and-Push
### Chapter 2 - 2026-08-30
Completed: 2. Judge daemon core
Implemented By: implementer-opus for the build and again for the fix round, with the review round dispatched through `Workflow` (adversarial, blind and security reviewers, model `opus`, effort `max`, the no-headroom row of the reviewer-effort table since this section's writer tier is opus; all three resolved at `claude-opus-5`, read from their transcripts). Base ref `1d6c395`. The prompt-version rename, the two document edits and all three acceptance runs were taken in the main thread, the `docs/` write because the docs-write-guard requires it.
Metrics: 2 implementer dispatches; 1 review round of 3 reviewers; 45 raw findings, deduplicating to 2 Criticals, 10 Majors and 13 Minors, plus 1 the controller found and 1 defect observed in the model's own output; every one fixed; 1 fix round; NEEDS_CONTEXT 0; escalations 0; consults 0.
Decisions / Surprises: The section's stated acceptance, that the daemon reproduce the audition verdicts, had no artifact behind it: the audition computed verdicts live and the journal recorded only the aggregate score, so there was no per-case expected set to reproduce. Generating one from a daemon run would have put the control on the same derivation path as the pattern, so all thirteen cases were hand-adjudicated by the controller from the case text and the journal's qualitative record, written to gitignored scratch, before the daemon existed. Four of those thirteen adjudications were then wrong, in one class, and the daemon was right on all four. Every harvested result is capped at 350 characters and the adjudication was taken from a 600-character dump, so no cut was ever visible and three cases were scored as complete whose required output is simply absent from the text: case 1 has no directory listing at all, case 8 shows four staged paths and a severed fifth, case 12 ends mid-filename. The judge applied the rule the expected set was written against, that an instrument which cannot prove what the intent needs is diverged, and the controller was the one inventing the missing evidence. The correction is recorded in the scratch file beside the original rather than replacing it. The second surprise was a single raw NUL byte in `sidecar/daemon.js`, used as a composite-key delimiter, which made `grep -rn` print nothing for that file while `grep -c` on the same pattern returned 2: a source file excluding itself from every line-printing sweep by its own content, in a repository whose hygiene passes are grep-driven. Both lessons are banked to the operator tier.
Assumptions: (2026-08-30, section 2) The daemon takes a `--state-dir` override, and a `--config` override beside it, so no test and no replay reads or writes the live `~/.claude`; this was the controller's call at intake and the standing rule that no section writes the live store is why. (2026-08-30, section 2) `--once` drains and exits, the default is a watch loop, idle poll 2s. (2026-08-30, section 2) The endpoint request timeout defaults to 90 seconds with an optional `timeoutMs` key, chosen because the spec records a standing second tenant on the lane, so a tight timeout would gap-mark on someone else's generation and report impatience as unmeasurable data. (2026-08-30, section 2) Tests stand up a mock HTTP server on an ephemeral port, never a fixed one. (2026-08-30, section 2) Eight further implementer assumptions, each declared and each low-blast: no endpoint config means the daemon creates nothing at all rather than activating capture nothing can consume; gaps go to the findings file as well as the session log; a consecutive-failure latch of 3 per kind per pass bounds the retry posture; verdict records carry a 200-character command preview rather than the whole command; a `callId` outside the contract's 16-hex format counts the line malformed; an unusable explicit `nowMs` deletes nothing rather than substituting the machine clock; the prompt's closing output instruction differs from the audition's because the output shape is now schema-constrained; and gap records coalesce per session.
Review Findings: Two BLOCK verdicts and one CONCERNS, 2 Criticals, both confirmed at source by the controller before any fix. The first: `drainFile` recomputed the persisted byte offset from decoded strings while `spool.readFrom` already returned the correct byte position and had it discarded, so any invalid UTF-8 inflated the cursor by two bytes per bad byte through the U+FFFD substitution. The contract states that torn interleaved appends are an expected event and a torn append splits at an arbitrary byte boundary, so mid-multibyte splits are the normal case; the overshoot loses lines, and past the file size it triggers a reset, a full re-read, and an unbounded hot loop re-POSTing a whole day of unredacted command output off-machine. Two reviewers found it independently. The second: the offset advanced past a gapped entry before the gap record reached disk, so a kill during an outage left calls with neither a verdict nor a gap, which the daemon's own header names as the one outcome it will not accept. The controller had reproduced that ordering defect independently on a different symptom before the round returned, by SIGKILLing a live drain and finding the offset advanced past five consumed lines with the pass counters still at zero. Ten Majors followed and all were fixed: a short-circuited `&&` that dropped the findings write whenever the session-log write failed; retention running only at startup while watch is the default mode, so the privacy bound stopped applying the longer the daemon ran; a destructive offset drop driven by a listing that returns empty on a read failure, treating an unreadable directory as an empty one; a tripped latch consuming the rest of the pass with no re-queue, so four and a half minutes of the lane's second tenant would permanently discard the backlog; an unfenced judgment prompt in which the party being judged writes all three sides, with `cat` of the prompt file or of a verdict log as the near-at-hand accidental trigger; a reason field neutralized for whitespace and length only, leaving ANSI, bidi and zero-width characters to reach every consumer; the daemon's own logs having no retention, no cap and no rotation while the bounded command preview's justification expires with the spool; an endpoint host that was unconstrained and, more to the point, unattested on any surface; a test whose title named the configured timeout and which would have passed with the timeout wiring deleted, Standing Brief Amendment 2 exactly; and the raw NUL. Thirteen Minors were fixed too, among them a spread over the defaults that let an explicitly-undefined key point a replay at the live store, an unversioned state file trusted under v1 semantics, directory modes left world-traversable, and the symlink half of four separate path guards having no case behind it at all, which is Amendment 2 landing on a security control. One implementer concern was overridden on evidence: it edited the judgment prompt in place against that file's own stated versioning rule, arguing no field verdict existed to be made incomparable, but the controller had already produced thirteen field verdicts under `judgment-v1` in the pre-fix acceptance run. The prompt shipped as `judgment-v2.js` instead, which turned that comparison into the section's cleanest result. One implementer concern was accepted and stands: the lane-busy hold means a lane busy for the whole retention window records no gap for the held calls, bounded by the endpoint-down path covering the case where the lane is not merely busy.
Stamps: Adjudicated 1, skipped 1, plus 7 stamped from the controller's own account of the stretch, which the report could not surface because their reads fell outside the window. `doctor-fix-is-never-a-neutral-committer` skipped again: read in the window by a hook rather than by this work, and nothing in this section runs the doctor. Stamped: the shared-derivation-path record, which is the one that shaped the whole expected-set design and its ordering; the agent growth-reading artifact and the empty-output-file record, both applied and both re-confirmed live when the first transcript path came back missing; the stated-count record, which is why every implementer figure was re-run rather than accepted; the contended-run record, which is why the box was polled before the gate; the heredoc record, which routed two scripts through the Write tool; and the endpoint record that supplied the address. Two new operator-tier records were written, each generalized past the incident: `a-raw-control-byte-makes-a-file-invisible-to-line-printing-greps`, whose asymmetry is the trap, since count and list forms keep working while the line-printing form goes silent; and `an-expected-set-inherits-the-cut-of-the-view-it-was-read-in`, whose tell is that the wrong answers cluster on one reason, which indicts the control rather than the subject.
Gate: 2366 / 2362 / 1 / 3, exit 1, read from the run's own exit marker, with the box polled for a foreign test runner first and none found. Baseline 2260 / 2256 / 1 / 3, exit 1, from Chapter 1 on this same suite. Delta: plus 106 tests and plus 106 passing, the new `test/kit-sidecar-daemon.test.js` in full, with the failure and skip counts both unchanged. Failures by name: a pinned directory too long to name faithfully stands the session down, this machine's one known permanent red. The whole gate ran because the section closes and because `docs/security-model.md` sits inside `doctrine-parity`'s own tree sweep. The section's own lane was reproduced by the controller three times: 62 of 62 at the build, 106 of 106 after the fix round, and 106 of 106 again after the prompt rename.
Acceptance: met in full, every clause on a real run rather than a mock. Thirteen cases replayed against the live endpoint through the shipped daemon score 13 of 13 on substance against the corrected expected set, inside the audition's recorded 12 to 13 of 13. The endpoint-stopped clause gap-marked all thirteen and exited 0 against a dead port, writing gap records to both surfaces rather than falling silent. The kill-and-restart clause was run with a real SIGKILL at four seconds: five judged before the kill, eight after the restart, thirteen unique call ids and zero duplicates, and a third pass over the drained directory reported nothing to judge. Two further facts came out of running the acceptance twice, once before the fix round under `judgment-v1` and once after it under `judgment-v2`. The verdict distribution is identical across both, five diverged, two failed and six achieved, so the added fencing and the neutralization changed no verdict, which was the implementer's one inferred claim and is now confirmed. And case 5's reason, which under v1 stated the script crashed with a missing method that appears nowhere in the result, is grounded under v2 and names the truncation instead. That defect is recorded rather than counted as fixed: one sample is not a repair, and it is a section 3 input, since the valve delivers exactly this field in band. Confirmed alongside: `~/.claude/kit-sidecar` was never created by any of the runs, and a sweep for the endpoint address over the tree returns nothing with a control proving the pattern is live.
Next: 3. Delivery valve
Commit Model: Commit-and-Push
### Chapter 3 - 2026-08-30
Completed: 3. Delivery valve
Implemented By: implementer-opus for the build and again for the fix round, with the review round dispatched through `Workflow` (adversarial, blind and security reviewers, model `opus`, effort `max`, the no-headroom row of the reviewer-effort table since this section's writer tier is opus; all three resolved at `claude-opus-5`, read per-line from their own transcripts). Base ref `43d0444`. The two `docs/` edits and the live-clause end-to-end were taken in the main thread, the documents because the docs-write-guard denies a subagent any write under `docs/`.
Metrics: 2 implementer dispatches; 1 review round of 3 reviewers, `parallel()` running two of them and queueing the third, which is the documented cap rather than a fault; 2 Criticals, 10 Majors and 7 Minors after deduplication, of which 8 Majors went to the implementer and 2 were the controller's own to take; 1 controller finding confirmed and 1 discarded; every one fixed; 1 fix round; NEEDS_CONTEXT 0; escalations 0; consults 0.
Decisions / Surprises: The section's defining event is a defect in the controller's own dispatch brief. The brief asserted, and marked CONFIRMED, that a session's main-thread tool calls are serial, and used that to argue the delivered-offset needed no lock. The claim is false and this repository already documented the opposite in two places it names in its own comments: `memory-recognition-nudge.js:130-131` says the harness issues tool calls in parallel, and `docs/architecture.md` says it again. The implementer flagged the risk as a concern it could not check and built on the assertion anyway, which is the correct response to a premise marked confirmed by the party that dispatched it, and all three reviewers then found the same hole independently. The lesson generalizes past the incident: a false premise in a brief does not fail loudly, it produces an implementation that is internally consistent, passes its own gate, and is wrong at exactly the point the premise touched. It is banked to the operator tier. The second surprise is an instrument error the controller caught before acting on it: `grep -c '\r'` reported 392 CR-bearing lines in `sidecar/CONTRACT.md` and appeared to contradict the implementer's LF-only claim, but a byte-level read returned `CRLF=0, bareLF=392` for every changed file. The implementer was right and the grep was the wrong instrument, which is why every line-ending check in this section reads bytes. The third: the tail-cut Critical is unreachable on ASCII input. Pure-ASCII items top out around 515 bytes, so the 600-byte cut never fires, and the defect only appears once a field carries multi-byte characters. A suite exercising the happy path could never have seen it, and the reviewer found it by running the shipped module rather than by reading it.
Assumptions: (2026-08-30, section 3) The delivered-offset lives at `inbox/<slug>.offset` and the read-select-advance runs under a claim at `inbox/<slug>.lock` that is attempted once, reaped stale at 30 seconds, and never waited on, because the contract's own error posture forbids putting an observed session on a critical path; a copy that cannot take the claim delivers nothing. (2026-08-30, section 3) The offset advances before anything is emitted and nothing is emitted when that write fails: a pointer lost to a crash costs one advisory line, where an item emitted against an offset that never moved is an injection loop the session cannot switch off. (2026-08-30, section 3) A malformed inbox line is skipped with the offset still advancing past it, the daemon's own malformed counter being where that signal lives, because the hook has no surface to report a skip on. (2026-08-30, section 3) The 600-byte cap governs item text plus the newline joining items; the opening framing and the closing fence sit outside it by design, so a flooded queue cannot displace the marking that makes the block read as data. (2026-08-30, section 3) Item text fields are cut to 200 characters at the write and again at the read, so one field cannot spend the whole budget. (2026-08-30, section 3) The daemon's delivered set is bounded at 512 keys, oldest dropped first; past the bound a spool reset reaching further back can queue one duplicate pointer, which is a redundant line rather than a lost finding. (2026-08-30, section 3) Inbox retention rides the daemon's existing 14-day sweep, with an expired offset held back while its queue is still live. (2026-08-30, section 3) A memory record name must match a conservative pattern or the item is dropped, because the name is spelled into a `memq get` line a reader may run.
Review Findings: Two BLOCK verdicts and one CONCERNS, 2 Criticals, both confirmed at source and both re-confirmed by the controller after the fix by running the shipped module on the reviewer's own breaking payloads rather than by reading the diff. The first: `cutBytes` cut the tail, which is exactly where the spec-mandated content sits, so an over-budget memory pointer came back with the record name severed mid-token and an over-budget alert came back without the trailing directive the framing tells the reader to act on. Unreachable on ASCII, as above. Fixed by cutting the item's variable fields in a per-kind order and recomposing, the discipline the spool serializer in the same file already used. The second: `writeOffset` wrote its temporary file at a predictable path with no `O_EXCL` and no lstat, so a link planted at `inbox/<slug>.offset.tmp` pointing at `~/.claude/settings.json` would have been followed and the target truncated by the next queued delivery. The sibling hook's correct form was three files away. Fixed to the sibling's exact shape, an exclusive create at a path carrying the pid and six random bytes, with a case that plants the link at the old name and asserts a decoy file is byte-identical afterwards. Ten Majors followed. Eight went to the implementer: the non-single-writer offset needing the claim described above, which is the finding the controller's own false premise created; the five hand-copied spellings of the subagent stand-down key set, extracted to `kit-agent-identity-lib.js` per Standing Brief Amendment 1 and wired to all four call sites, deliberately preserving three distinct readings because the sites ask three different questions; `writeItem` calling `ensureDir` and so silently recreating the directory whose deletion is the documented off switch; a retention sweep expiring `.jsonl` and `.offset` independently and therefore able to re-deliver a whole inbox; a dedup set keyed on the bare call id, which would have dropped a memory pointer for a call that already had an alert, silently and with no counter; an alert naming no source while its own framing told the reader to check one; Standing Brief Amendment 3 violated by a role word in the framing that let a cleartext cross-machine POST read as no egress; and undelimited value slots a quote could close. Two Majors were the controller's own and were taken in the main thread: `docs/architecture.md` still said this hook emits nothing, which the valve makes false, and `docs/security-model.md` had no inbox entry at all while asserting a producer-only neutralization that this changeset deliberately abandons. Seven Minors were fixed too. One controller finding was confirmed and one was discarded with its reason recorded: the implementer reported that `memory-recognition-nudge.js` puts record names and trigger text in front of the model unguarded, and the controller opened the code and found `nudgeLine` sanitizes every untrusted field, the single unsanitized field carrying only an empty string or a fixed internal literal. Flagging an adjacent surface for confirmation was the right move and was told so; the claim itself did not hold. One implementer pushback was accepted in part: the queued-note signal now fires on an explicit partial-tail check rather than on unconsumed bytes, which closes the false positive without adopting the shortcut that created it, and a torn line that never completes still makes the note optimistic, which is the recorded residual.
Gate: 2425 / 2420 / 1 / 4, exit 1, read from the run's own exit marker, with the box polled for a foreign test runner first and none found. Baseline 2366 / 2362 / 1 / 3, exit 1, from Chapter 2 on this same suite. Failures by name: a pinned directory too long to name faithfully stands the session down, this machine's one known permanent red, unchanged. The whole gate ran because the section closes and because both edited documents sit inside `doctrine-parity`'s own tree sweep. The controller re-ran the whole gate itself rather than accepting the implementer's figures, and ran it after the two `docs/` edits rather than before, since a gate taken before them would not have covered them.
Acceptance: met in part, and the unmet half is blocked on an act outside this session. The caps clause is met: a flooded inbox delivers exactly three items inside 600 bytes and queues the rest, with a separate case where the byte cap binds at one item while the item cap still has room. The dormancy and fail-open clause is met across absent root, linked root, unreadable file, malformed line, unknown version and kind, and absent, garbage, negative or oversized offset, each asserting exit 0 and empty stdout. The live-session clause is NOT met and could not be attempted: no build in this machine's installed plugin cache carries the capture hook at all, across all 54 cached versions, and the spool root does not exist, so the harness has no hook to invoke and the sidecar is inert here. Meeting it requires a plugin update carrying sections 1 through 3, which is the consequence already standing on the coordinator's board rather than a new one. What was run instead, and is the honest maximum from here, is an end-to-end on the real binaries against a fixture home per Standing Brief Amendment 5: the real daemon judging a real trapped call in the piped exit-code shape the section names, against the live endpoint, writing a real inbox item; then the real hook cold-spawned the way the harness spawns it, payload on stdin, returning the pointer on the nested `hookSpecificOutput.additionalContext` channel. The subagent stand-down was exercised against a queue that genuinely held an undelivered item, with a control proving the same queue delivers to a non-subagent call, because a stand-down checked against a drained inbox passes for the wrong reason. What remains unproven from here is only the harness's own delivery of that field to the model, which is confirmed independently in the operator tier and is not this section's code.
Next: 4. Memory recognition in the daemon
Commit Model: Commit-and-Push
### Chapter 4 - 2026-08-30
Completed: 4. Memory recognition in the daemon
Implemented By: implementer-opus for the build and again for the fix round, with the review round dispatched through `Workflow` (adversarial, blind and security reviewers, model `opus`, effort `max`, the no-headroom row since this section's writer tier is opus). Base ref `97fcc80`. The section spans two controller sessions: the first built, gated, adjudicated the review round and dispatched the fix round; it died four minutes later and this session picked the fix round up from its artifacts. The two `docs/` edits were taken in the main thread, the documents because the docs-write-guard denies a subagent any write under `docs/`.
Metrics: 2 implementer dispatches; 1 review round of 3 reviewers; 2 Criticals, 8 Majors and 13 Minors after deduplication; 1 fix round; NEEDS_CONTEXT 0; escalations 0; consults 0, with one expert ask to the spec author on the acceptance and one operator decision.
Decisions / Surprises: The section's defining event is that its controller died mid-flight and the recovery cost nothing, which is the durable-artifact rule paying out rather than a happy accident. The first session stopped on a harness credits error at 12:06Z with an implementer four minutes into the fix round; the subagent died with it and neither ever reported. Everything needed to resume was already outside that context: the review adjudication in a scratch file, and the entire fix brief in a `SendMessage` the transcript preserves. The successor reconstructed the state by reading those two artifacts plus the tree, and the only thing genuinely lost was the dead implementer's own account of what it had finished, which the successor replaced with a code audit rather than a guess. The audit is where the second lesson sits: it was handed to the replacement implementer marked inferred-from-grep with an instruction to verify each claim, and one claim was wrong in exactly the way an unmarked one would have been obeyed. It pointed at `logs.js:286` as the recognition record writer; 286 is inside `verdictRecord` and the writer is `recognitionRecord` at 313. The diagnosis was right and the line was wrong, and the implementer found the real site because it was told to check rather than to apply. Third, a coverage finding the fix round produced on its own initiative: MAJOR 6's fix was correct in the code and the test covering it asserted only that some warning fired and printed no address, so it would have passed with the entire fix deleted. That is Standing Brief Amendment 2 landing on a security disclosure, and it was closed with a probe. Fourth, the acceptance shortfall turned out not to be the code's to fix, and the route it took is the record: the controller's own recommendation to the operator was wrong on its central premise and was corrected by the spec author before the operator ruled. The controller argued case 11's pointer was defensible because the record's own closing advice names the command being run; the author refuted it on two surfaces the controller had read and not weighed, the prompt's own bears-on rule and the record's declared triggers, which name the index files and a `git mv` and deliberately not a listing. The controller adopted the correction and revised its brief before the decision was taken.
Assumptions: (2026-08-30, section 4) The heavy-process claim protocol was omitted from the fix-round dispatch brief and sent separately once noticed; the box carried nine foreign `dotnet` processes during the acceptance run, so the first gate ran unclaimed and every run after it claimed and released. (2026-08-30, section 4) memq's `worktreeMainRoots` unbounded memoization is left unfixed and routed to section 6, which owns that file: growth is bounded by distinct working directories at roughly two path strings each, single-digit megabytes even at ten thousand, and the fix lands in a 12,000-line shared module outside this section's scope, so the edit's blast radius exceeds the leak. (2026-08-30, section 4) `--memory-root` deliberately bypasses memq's own `KIT_MEMORY_ROOT_ALLOW_DATA` gate, argued in place: that gate stops an inherited environment variable from moving where memories are written, where this is a read-only path typed on a command line and printed at startup. (2026-08-30, section 4) A recognition timeout discards its backlog where the judgment path preserves one, argued in place: recognition runs second, so a genuinely queued lane has already stopped the pass as a judgment timeout.
Review Findings: Two BLOCK verdicts and one CONCERNS, 2 Criticals, both accepted. The first: `commitPending` refused to persist any offset while a recognition gap was open, and a recognition gap could not clear once the policy latched, so from the first recognition failure to pass end the offset froze while judgment kept making real endpoint calls. A kill in that window re-read the whole pass and re-POSTed every command and output off-machine, which voids the acceptance the daemon's own header states. Two reviewers read the same code and reached opposite conclusions; both were right about different moments, since no gap survives a pass exit and the offset is still frozen during the pass, and the adjudication kept the finding rather than letting the converse discharge it. Fixed to per-file pending offsets, with a red/green pair whose case reads the persisted offset from inside the server handler mid-drain so it can only pass if the offset moves through the outage. The second Critical was the acceptance itself, and it is recorded below. Eight Majors were fixed. The sharpest was the per-call nonce emitted ahead of the index, so no two calls shared a prefix and the endpoint's cache never warmed, while the comment on the same lines asserted the opposite as fact; the fix derives the index fence tag from the index content and keeps the per-call nonce on the situation fence, and it worked on its own terms, per-call latency falling from about 1.6 s to about 0.9 and the run's wall clock from 37.0 s to 26.4 s for the same 30 calls. Three reviewers independently found one gap reason that was false about what happened, a judgment failure borrowing a recognition-flavoured reason so the log pointed an audit reader at the wrong prompt. Two findings were one class, a prompt showing the model records it would then refuse on the way back as inventions, and a dedup key set that made the schema's three-item cap silently mean one; both would have degraded quietly with no counter. Three Majors were one security class, three surfaces that tell a reader where data goes still enumerating a pre-section-4 egress, which is Standing Brief Amendment 3 landing inside this section's own diff, and one of the three sat outside the declared files and was folded in deliberately. Twelve of thirteen Minors were closed and the thirteenth is the routed deferral recorded above.
Stamps: Adjudicated 6, stamped 3. `plans-authored-elsewhere-never-reach-the-index` stamped, since reading it is what let the controller judge case 11 on the record's own content rather than on the implementer's summary of it. `claude-kit-hook-edits-need-a-build-stamp-refresh` stamped, since it is why the build ran after the hook edit rather than after the canary went red. `neo-claude-admin-seat-armed` stamped, since it is one of the records that established this machine had no delegation grant of its own at the seat takeover. Three skipped: `memory-store-pushes-need-no-permission`, `admin-seat-request-inbox` and `coordinator-board-clearance`, each read in the window by seat work rather than by this section, and none of them steering anything in it.
Gate: 2454 / 2449 / 1 / 4, exit 1, read from the run's own exit marker, with the box polled for a foreign runner first and none found, and the heavy-process slot claimed and released around the run. Baseline 2448 / 2443 / 1 / 4, exit 1, from the first controller session's own gate over the build. Delta: plus 6 tests and plus 6 passing, with the failure and skip counts both unchanged. Failures by name: a pinned directory too long to name faithfully stands the session down, this machine's one known permanent red. The controller re-ran the whole gate itself rather than accepting the implementer's figures and reproduced them exactly.
Acceptance: met, under a criterion the operator amended during this section rather than the one written at approval. The replayed round-6 battery reproduces 12/12 recall with zero gold misses; dedup is correct, 13 pointers re-draining to 13 with a second session receiving its own; a project with no memory index produces no recognition calls; and `~/.claude/kit-sidecar` was never created by any run. The original criterion also asked for 3/3 clean negatives and the build scores 2/3, missing on case 11. That miss survived the repair and is a real false positive rather than an aged label, affirmed by the battery's owner on the prompt's own bears-on rule and on the record's declared triggers. What the amendment changed is how the harm is counted: the criterion counted a false pointer in two different columns depending on which case it landed in, while the system's own cost model treats every false pointer as one harm, and on that model the shipped prompt produces 1 across the battery's 15 situations where the measured round-6 control produces 8 while scoring 3/3. The amended criterion is 12/12 recall with zero gold misses and at most 2 non-gold pointers, clean negatives still reported per case, the prompt never tuned against case 11, and future iterations scored on held-out cases. Two things are recorded rather than smoothed over. The amendment reached this session through the spec author's report of an operator ruling taken at that seat's keyboard, not from the operator to this session directly, and the plan doc's Decisions entry is its record. And the eliminated cause is eliminated by measurement rather than argument: the fence-tag defect was the most plausible suspect, its fix landed and demonstrably bought the caching it was for, and it changed no verdict, with sampling at temperature 0 and two runs producing case-for-case identical outcomes.
Next: 5. Findings surface and rollup
Commit Model: Commit-and-Push
### Chapter 5 - 2026-08-30
Completed: 5. Findings surface and rollup
Implemented By: implementer-sonnet for the build and again for the fix round, with the review round dispatched through `Workflow` (adversarial, blind and security reviewers, model `opus`, effort `xhigh`, the one-tier-above-the-writer row of the reviewer-effort table since this section's writer tier is sonnet). Base ref `0bc7580`. The `docs/architecture.md` write was taken in the main thread, which the docs-write-guard requires.
Metrics: 2 implementer dispatches; 1 review round of 3 reviewers; 0 Criticals, 7 Majors and 14 Minors after deduplication, every one fixed; 1 fix round; NEEDS_CONTEXT 0; escalations 0; consults 0.
Decisions / Surprises: The section opened on a defect in the plan doc rather than in the code. Section 4's own text and Chapter 3's acceptance both cite "Standing Brief Amendment 5" while the amendments block held entries 1 through 3 and never carried it, so the fixture-stores-only rule that governed two shipped sections was riding in brief text rather than in the block that exists to deliver it, and the next dispatch would have inherited a shorter list with nothing to show what was missing. The rule is recorded now as entry 5, keeping the number it was cited under so both existing citations resolve, with the absent entry 4 named as a numbering gap rather than quietly renumbered: renumbering would have falsified a citation inside a Chapter, which is append-only by design. No rule numbered 4 appears in any surviving artifact of this plan, and the amendment-4 hits elsewhere in the tree belong to the role-seat spec's own block.
  The sharpest correction of the section came from the implementer and it improved on the brief that sent it. The fix list carried the endpoint-address finding marked inferred with an instruction to verify before changing anything, and the verification refuted the stated mechanism while confirming the defect: on this runtime a malformed endpoint URL is wrapped by undici in a `TypeError` whose cause carries `ERR_INVALID_URL`, so the code path the finding named never runs. The real trigger is an endpoint URL carrying credentials, which `config.js` accepts and parses, and which throws with no code anywhere in the chain and the full URL, credentials included, in the message. A finding marked confirmed would have been implemented against the wrong branch and closed the wrong hole.
  Three reviewers found the un-neutralized day label independently, which is what promoted it above its neighbours: `dayOf` sliced ten characters off a timestamp and rendered them, while the module's own header asserted that every rendered free-text field is neutralized. The file made a false claim about itself, and the suite could not see it because the one escape case put its payload in a different field.
  The box was contended for most of the section and the coordination is worth recording, because the protocol worked and the clock did not. A peer seat held the machine's one heavy-process slot, and a claim of mine refused to start rather than overwriting a live foreign one, which is the accident the session-scoped rule exists to prevent. Twice a claim was read carrying a `Started:` value in the future, thirty-seven minutes ahead on the second reading, which makes an expiry uncomputable and a lapsed hold indistinguishable from a live one; the coordinator had caught the same shape earlier in the day. A disagreement about whether a peer's kaizen note was staged was resolved by re-reading the index rather than by argument, and the honest account is that the state moved between two readings rather than that either reader misread a column.
Assumptions: (2026-08-30, section 5) The command is `node sidecar/rollup.js [--state-dir <path>] [--help]`, mirroring the daemon's own argument conventions, with no `--json`, no day window and no session filter, because the section asks for plain text and configurability it did not ask for is speculative. (2026-08-30, section 5) A state dir or logs dir that does not exist prints what it looked for and exits 1 rather than printing zeros and exiting 0, because a human ran the command and a column of zeros cannot distinguish an instrument that never engaged from one that saw nothing. (2026-08-30, section 5) Malformed lines are counted and reported rather than skipped, on the same reasoning. (2026-08-30, section 5) The delivered and queued split is read from the inbox byte offset, so "delivered" means consumed past the offset and is footnoted as such, since the valve advances that offset before emitting and past lines it never emitted. (2026-08-30, section 5) Section 2's own replay logs no longer exist on disk, so the gap-bearing half of the acceptance was reproduced rather than recovered: the section-4 replay state was copied to scratch, its offsets dropped, and the shipped daemon re-run against a dead port, which is the same endpoint-down clause section 2 accepted on.
Review Findings: Three verdicts, two CHANGES_REQUIRED and one CONCERNS, no Criticals, 7 Majors and 14 Minors after deduplication, all fixed. The Majors cluster into four classes rather than seven. Two are the same failure of an audit surface to know its own limits: the rotated findings generation was never read, so every finding in it vanished from a line calling itself a cross-check, silently and most when the fleet was busiest, and the gap-echo line asserted that echoes were already counted from the session logs while the daemon sweeps those logs at the retention window and never sweeps findings, so the assertion expires by design. Both are now comparisons that stay true rather than claims that rot. Two are the cannot-measure-versus-clean inversion this whole instrument exists to close, arriving inside the instrument itself: a file that could not be read returned zeros with no counter, so an unreadable verdict log rendered as a clean all-zero session, and the daemon's own skip counters were never read at all, so a daemon that dropped thousands of spool lines or failed its log writes still reported zero. One is the un-neutralized day label above. One is the missing cross-component pin: every fixture hand-built its records, so writer and reader were each tested only against their own literals and a renamed field in `logs.js` would have made the rollup report zeros with the whole suite green. One is a clock: per-day buckets keyed on when the daemon wrote a record rather than when the call ran, though verdict and recognition records carry `capturedAt` for exactly that distinction, and v1's daemon is manually started so judging a backlog is the ordinary case. The security round added the missing link screen, this command being a third reader where `docs/security-model.md` asserts that both sides lstat and refuse a link, which is why the fix went into the code and not into the document. Of the Minors, the one worth naming is that `neutralize` strips but does not bound, so a hand-written megabyte field would render in full into a terminal and into anything quoting it; the cap now lives in `text.js` beside `neutralize` as a property of the channel. The implementer raised three concerns, all accepted: one screen it added beyond the list for internal consistency, one residual it correctly declined to fix out of scope (the per-session listing is not cardinality-capped where the day and gap lists now are), and one verification it could not run under the box budget, which this Chapter's gate answers.
Stamps: Adjudicated 3, skipped 3, plus 7 stamped from the controller's own account of the stretch, which the report could not surface because their reads fell outside its window. The three skipped were read in the window by seat work rather than by this section: `coordinator-board-clearance`, `admin-seat-request-inbox` and `memory-store-pushes-need-no-permission`, none of them steering anything here. Stamped: the empty-subagent-output record, which is why a first-turn reading of zero lines was routed to the real transcript rather than read as a dispatch that never started; the not-TAP record, which is why a count grep returning nothing was read as the wrong pattern rather than as a run with no summary; the contended-run record, which drove the whole box negotiation; the shared-derivation-path record, which is why the acceptance control was hand-grepped rather than taken from the instrument under test; the docs-write-guard record, which routed the architecture line to the main thread; the stated-count record, which is why every implementer figure was re-run; and `workflow-parallel-caps-at-two`, re-confirmed live, the third reviewer's start timestamp sitting five minutes after the other two because it queued rather than ran beside them.
Gate: 2524 / 2519 / 1 / 4, suites 0, exit 1, read from the run's own exit marker, with the box claimed and released around the run and a peer seat holding its own runs off the machine for the window. Baseline 2454 / 2449 / 1 / 4, exit 1, from Chapter 4 on this same suite. Delta: plus 70 tests and plus 70 passing, with the failure and skip counts both unchanged. Failures by name: a pinned directory too long to name faithfully stands the session down, this machine's one known permanent red. The whole gate ran because the section closes and because the two folds touch `sidecar/logs.js` and `sidecar/endpoint.js`, which the daemon suite covers and this section's own lane does not; it is also what answers the implementer's third concern, that it could not run the daemon suite itself.
Acceptance: met, on both halves and against a control built before the instrument was run. The rollup's totals over the section-4 replay reproduce a hand count taken by grep over the JSONL rather than from the command under test: 17 verdicts as 14 diverged and 3 failed, 14 findings cross-checking the diverged count, 17 recognition calls with 14 pointed, and 28 queued pointers against no offset file. The gaps-included clause was met on a fixture built for it, since section 2's own replay logs are gone: the shipped daemon re-run against a dead port produced two gap records covering 16 and 1 calls and 17 recognition-gaps, and the rollup renders both the single-call and the multi-call range forms and reports 17 gapped calls, matching the daemon's own console figure. The delivered-pointer path was exercised on the one fixture carrying a real inbox offset, section 3's end-to-end, where an offset equal to the queue file's own length yields delivered 1 and queued 0. One corroboration came free and from a different file: the daemon-counters section reads `logs/offsets.json` and independently reports parsed 17 and gapped 17, which is a second instrument agreeing with the hand count rather than the same derivation path twice.
Next: 6. memq semantic channel with graceful degrade
Commit Model: Commit-and-Push

### Interim board 1 - 2026-08-30
Section 6 (memq semantic channel with graceful degrade) is in its second fix round and has
not closed. This entry exists because the closure-drought rule earns one: two review-round
adjudications have now passed with no section closing, and the compaction gate has been
holding offers against that same drought.

In flight: section 6 only. Sections 1 through 5 are closed and pushed. Stage: built, reviewed
once, fixed once, reviewed again, and now in fix round 2. Base ref for the review is 1219a7a,
which is 11 commits past the base the implementer built on; every one of those commits is a
peer session's and touches only docs/, docs/plans/ and kaizen/, no code and no test file, so
nothing moved under this section's work.

Live dispatches: one, implementer-opus a20d65313e01034da, resumed against .kit/s6-fixes-2.md
and asked for five Majors and eleven Minors plus the lanes. The review round that produced
that list has returned and is closed: adversarial, blind and security, all at model opus and
effort max through Workflow, verdicts CHANGES_REQUIRED, CHANGES_REQUIRED and CONCERNS, no
Criticals.

Gate baseline, mine, run under this session's own claim on this box at 19:11Z and read from
the run's own exit marker: 2544 tests, 2539 passing, 1 failing, 4 skipped, exit 1. Against
Chapter 5's 2524 / 2519 / 1 / 4 that is plus 20 tests and plus 20 passing with failures and
skips unchanged, the one red being this machine's known permanent failure at
test/memory-session.test.js:865. The comparison crosses a base-ref boundary, which is sound
here only because those 11 peer commits touch no test file.

Rulings adopted since Chapter 5, each already in the fix brief and each owed a Chapter entry:

1. The first round's Critical was that the judged channel read the endpoint config and never
   read its non-local-host flag, while the security document credited exactly that warning as
   the compensating control. Ruled to lift the check into the shared endpoint client as a
   channel-level duty both producers call, rather than repair it in memq alone. Confirmed
   landed, and confirmed closed by the second round's security lens.
2. The provenance value crossing the machine boundary is a flattened absolute project path
   carrying the account name and unrelated repositories' directory names. Ruled a reduction
   rather than a better disclosure: the prompt gets the bare tier token and the full label
   stays on the rendered line. A candidate is already identified on the wire by its index.
3. Pending-tier records are excluded from the candidate set. The store already keeps them out
   of the local semantic index, and exporting them to a multi-tenant service off the machine
   is further than the reach that policy refuses rather than nearer.
4. The judged answer must carry both an index and a name, and the two must agree, rather than
   a name alone. Requiring both makes a fabricated record unrepresentable rather than merely
   improbable, since an invented name has no index that resolves to it and a bare index has
   named nothing to check.
5. Two fenced blocks in one find output is acceptable. They are sequential rather than
   interleaved, so a reader can tell which fence frames which line.
6. The worktreeMainRoot memo sits outside the section's stated bound on memq's store verbs.
   Chapter 4's recorded assumption routes it here, so it is a declared fold rather than a
   scope slip.

Deferred deliberately, owed a backlog entry at section close: the store root is gated behind
an explicit allow-data flag while the endpoint config path reads a bare home directory. A real
asymmetry an auditor would ask about, and outside this section's bound to change.

Next action: await fix round 2, re-run the whole gate under a fresh claim, then Chapter 6,
commit and push, then section 7. Two of the second round's findings were this session's own
documentation rather than the implementer's code, and both are already fixed: the skill file
documented the absent-endpoint case as emitting a line the code deliberately does not emit,
and the architecture document called the off-machine endpoint machine-local, which is Standing
Brief Amendment 3's failure shape appearing in text written by the session that adopted it.

### Chapter 6 - 2026-08-30
Completed: 6. memq semantic channel with graceful degrade
Implemented By: implementer-opus for the build and again for each of two fix rounds, with two review rounds of three reviewers each dispatched through `Workflow` (adversarial, blind and security, model `opus`, effort `max`, the no-headroom row of the reviewer-effort table since this section's writer tier is opus). The second round's base ref is `1219a7a`, eleven commits past the base the implementer built on; all eleven are a peer session's and touch only `docs/`, `docs/plans/` and `kaizen/`, no code and no test file, which is what makes a gate comparison across that boundary sound. The three `docs/` and skill writes and every live acceptance run were taken in the main thread, the documents because the docs-write-guard denies a subagent any write under `docs/`.
Metrics: 3 implementer dispatches; 2 review rounds of 3 reviewers; round 1 returned 1 Critical, 7 Majors and 8 Minors after deduplication, round 2 returned 0 Criticals, 5 Majors and 11 Minors, of which 2 were the controller's own documentation rather than the implementer's code; every one fixed; 2 fix rounds; NEEDS_CONTEXT 0; escalations 0; consults 0.
Decisions / Surprises: The section's defining constraint was the packaging boundary, and it was invisible until the Critical made it matter. `build.ps1` packages recursively under `plugins/claude-kit/` and nothing else, so `memq.js` ships and `sidecar/` does not. The first round's Critical was that the judged channel read the endpoint config and never read its non-local-host flag, while `docs/security-model.md` credited exactly that warning as the compensating control, and the obvious repair, calling the daemon's helper, is unavailable across that boundary. The ruling was to lift the check into a shared endpoint client inside the shipped tree, `plugins/claude-kit/scripts/kit-endpoint-lib.js`, which both producers call, and to place the call ahead of the probe so a redirected-but-dead endpoint still discloses. The second round's security lens confirmed it closed rather than the controller assuming it from the fix report.
  The redirect control's real reach is narrower than the document claimed and is now written down as such. This fleet's endpoint is itself on a private address across the virtual switch, so a config rewritten from that address to another private one changes where every query goes while leaving the non-local warning silent and this command's output identical. The endpoint fingerprint is what makes that visible: it is a change detector rather than a locality screen, and the two controls answer different questions.
  Two of the second round's findings were this session's own prose rather than the implementer's code, which is the surprise worth keeping. `docs/architecture.md` called the off-machine endpoint machine-local, which is Standing Brief Amendment 3's failure shape verbatim, appearing in text written by the session that adopted the amendment. And `plugins/claude-kit/skills/memory-system/SKILL.md` documented the absent-endpoint case as emitting a degrade line, where the code is deliberately silent, because a line every `find` printed would be noise about a channel nobody configured. That silent case is the ordinary state on most machines, so the most common behaviour was the one documented wrong. A reviewer reading the diff cannot tell whose hand wrote which file, which is why dispatching the round over the whole changeset rather than the implementer's files alone is what caught them.
  The fix round's own closing report carried one inferred claim that was wrong, and the memory store is what caught it. The implementer edited `plugins/claude-kit/hooks/kit-sidecar-capture.js` for a comment, searched for a build-stamp artifact, found none, and reported that it believed no refresh was owed while marking the belief inferred. The stamp exists at `plugins/claude-kit/.claude-plugin/build-info.json`, is gitignored and machine-local, and `hook-canary.test.js` compares the working tree against it, so the search failed because the artifact is untracked rather than because it is absent. The builder was run before the gate. Marking the claim inferred rather than asserting it is what made the check cheap.
  The box was contended for the whole close and the coordination is worth recording, because the protocol held and a clock field did not. A peer seat's live claim carried `Started: 2026-08-30T00:00:00Z`, a placeholder typed into a heredoc rather than interpolated at the write, which makes the hold's expiry uncomputable from outside; on that value it had lapsed twenty hours earlier while the peer's `testhost` was genuinely running. Presence licensed waiting and the claim was never overwritten. Reported to that seat, which confirmed the placeholder was its own, re-stamped with a real reading, and banked the generalization operator-tier: a field whose only purpose is comparison against a later clock reading has to be produced by a clock reading at the moment of the write. That is the third malformed `Started:` value read from that seat today, twice future-dated and once a placeholder.
Assumptions: (2026-08-30, section 6) The shared endpoint client ships at `plugins/claude-kit/scripts/kit-endpoint-lib.js` rather than being required across the packaging boundary from `sidecar/`, per Standing Brief Amendment 1 and because the boundary makes the alternative impossible rather than merely undesirable; `sidecar/config.js` re-exports from it so the daemon and memq cannot drift. (2026-08-30, section 6) The judged call's budget is 2000 ms and the probe's is 400 ms, chosen because `find` is an interactive command where degrading fast beats answering slowly, and the lane carries a standing second tenant. (2026-08-30, section 6) The provenance value crossing the machine boundary is a bare tier token from `tierWireToken`, never the flattened absolute project path, which stays on the rendered line. (2026-08-30, section 6) Pending-tier records are excluded from the candidate set. (2026-08-30, section 6) A judged answer must carry an index and a name that agree, and either alone is refused.
Review Findings: Round 1 returned 1 Critical, 7 Majors and 8 Minors; round 2 returned 0 Criticals, 5 Majors and 11 Minors, with verdicts CHANGES_REQUIRED, CHANGES_REQUIRED and CONCERNS. Six rulings were taken across the two rounds and each is recorded here rather than only in the scratch briefs. The Critical was ruled to the shared client as a channel-level duty both producers call, rather than repaired in memq alone. The provenance disclosure was ruled a reduction rather than a better disclosure: the prompt gets the bare tier token and the full label stays local, since a candidate is already identified on the wire by its index, so there was no disclosure to improve and a field to stop sending. Pending-tier records were ruled out of the candidate set, because the store already keeps them out of the local semantic index and exporting them to a multi-tenant service off the machine is further than the reach that policy refuses rather than nearer. The judged answer was ruled to require both an index and a name that agree, which makes a fabricated record unrepresentable rather than merely improbable, since an invented name has no index that resolves to it and a bare index has named nothing to check. Two fenced blocks in one `find` output was ruled acceptable, being sequential rather than interleaved. And the `worktreeMainRoots` memo, routed here by Chapter 4's recorded assumption, was ruled a declared fold rather than a scope slip.
  Two findings turned on a test that could not fail, which is Standing Brief Amendment 2 landing twice in one section. The code-load pin filtered its closure walk on a `/^cmd[A-Z]/` name pattern, so any intruder without that prefix passed unseen; the amended assertion compares the whole sorted closure against a named set, and the control is two mutations neither of which carries a `cmd` prefix, both red on the amended pin and both green on the old one. The memo-eviction case touched its hot key last, which is an insertion under FIFO, so residency was guaranteed whether the fix worked or not.
  The implementer's controls were held to the coverage bar rather than the instrument bar, and one was reported honestly as failing it: the archived-marker case cannot discriminate its own fix, because an archived candidate reaches the set only through the semantic channel, which already carried both flags. The superseded case is the one that proves the propagation, and the report says so rather than presenting four green controls as four proofs. The provenance control is the one that carries real coverage evidence, its instance being a store segment the pattern was never handed, a project directory named `AcmeBillingPrivateRepo` appearing nowhere else in the fixture, so an implementation still sending the label could not avoid sending it.
Stamps: Adjudicated 6, stamped 4, all operator tier. `claude-kit-hook-edits-need-a-build-stamp-refresh` stamped, since it is the record that refuted the fix round's inferred no-refresh-owed claim and put the builder ahead of the gate. `a-control-from-inside-the-patterns-own-vocabulary-proves-nothing` stamped, since it is the standard the round-2 controls were judged against and the reason the withheld-instance control counts as coverage evidence where the two prefix-free mutations count only as a functioning instrument. `two-surfaces-corroborate-only-if-no-upstream-reaches-both` stamped, since it is why the gate was re-run in the main thread rather than read off the implementer's lane report. `search-by-what-the-file-says-not-your-paraphrase-of-it` stamped, since every doc-claim verification this section ran was anchored on text read out of the file rather than on remembered wording.
Gate: 2554 / 2549 / 1 / 4, suites 0, exit 1, read from the run's own exit marker, with the box claimed at 20:07:51Z by exclusive create and released by a session-scoped delete at 20:14:07Z. Baseline 2544 / 2539 / 1 / 4, exit 1, this session's own whole-gate run at 19:11Z. Delta: plus 10 tests and plus 10 passing, with the failure and skip counts both unchanged. Failures by name: a pinned directory too long to name faithfully stands the session down, this machine's one known permanent red at `test/memory-session.test.js:865`. The whole gate ran because the section closes, because the delta touches `sidecar/` modules the daemon suite covers, and because three documents sit inside `doctrine-parity`'s own tree sweep. It ran after the plugin rebuild rather than before, since the hook edit staled the build stamp the canary compares against. The implementer's own four lane figures are reported rather than confirmed here and were not relied on; its claim of plus 30 tests in the memq lane is an inference against a per-lane number this session never reported, and the whole-gate delta of plus 10 is the measured figure. No test file was deleted, 46 present, and only this section's three test files changed.
Acceptance: met in full, on all three states and against the live endpoint rather than a mock, run from a fixture home per Standing Brief Amendment 5 with the real store copied in read-only and the live `~/.claude` never read as the run's own home. Endpoint up: the judged block renders fenced and framed as advisory data, ranking five candidates with reasons, each line carrying provenance as a bare tier token and no absolute path anywhere, preceded by the fingerprint line naming an eight-hex digest and never the address. Endpoint stopped, the fixture config repointed at a dead loopback port: one honest degrade line naming that nothing answered, the lexical block unchanged, exit 0, and no fingerprint line at all, which is the call declining to happen rather than a config read speaking. Config absent: the channel is silent, the output carries no mention of it, and exit is 0, which is the behaviour `plugins/claude-kit/skills/memory-system/SKILL.md` now documents after this round corrected it. One live observation is recorded rather than smoothed over: the first judged call after a cold prefix outran its 2000 ms budget and degraded honestly, and three consecutive runs after it returned the judged block, so the budget is tight against a cold cache by design and the degrade is the designed answer rather than a defect. The existing memq suite stayed green untouched throughout, which the whole gate carries.
Next: 7. Regression batteries and replay harness
Commit Model: Commit-and-Push

### Interim board 2 - 2026-08-30
Section 7 (regression batteries and replay harness) is in its second fix round and has not
closed. This entry exists because the closure-drought rule earns one: two review-round
adjudications have now passed with no section closing, and the compaction gate has been
holding offers against that same drought.

In flight: section 7 only. Sections 1 through 6 are closed and pushed. Stage: built,
reviewed once, fixed once, reviewed again, and now in fix round 2 at an escalated tier.

Live dispatches: one, implementer-opus, resumed against nothing and dispatched fresh against
`.kit/s7-fixes-2.md`, asked for 2 Criticals, 10 Majors and 13 Minors, minus the two findings
that land under `docs/` and are the controller's own. The review round that produced that
list has returned and is closed: adversarial, blind and security, all at model opus and
effort xhigh through Workflow, which is the one-tier-above-the-writer row of the
reviewer-effort table since this section's writer tier is sonnet. Verdicts CHANGES_REQUIRED,
CHANGES_REQUIRED and CONCERNS.

The tier escalation is the entry's most important content, because the rule that governs it
demands the comparison be named rather than assumed. Round 2 returned Criticals after round 1
did, which forks two ways: a repeating finding class indicts the implementer and makes the
tier the lever, while Criticals landing on new ground indict the spec's premise and earn a
consult instead. The comparison was run and a class repeats, twice over. Round 1's Critical 1
was that a gapped case scored as PASS because the scorer never counted it as unmeasured; round
2's is that a gapped run scores as PASS because scoring reads the whole accumulated session
log while the fixture builder appends to an existing spool, so a re-used state directory lets
the previous run's verdicts answer for this one. Different door, same class, and it is the
cannot-measure-versus-clean inversion this entire plan exists to close, now on its third
appearance in the effort and its second in this section. Separately, round 1's Major 4 was the
state-directory refusal and round 2's other Critical is that same refusal scoped one directory
too narrow, which is a fix that landed and does not reach. A class repeats, so the section
escalated from sonnet to implementer-opus with both rounds' evidence carried into the brief.

Both Criticals were confirmed by the controller before the brief was written rather than taken
from the reports. The state-directory guard was reproduced by running its predicate directly
with no writes: with the account name elided, `<home>\.claude`, `<home>` itself and
`<home>\.claude\projects` are all accepted, and only the `kit-sidecar` subtree is refused,
while both output paths print "state root (fixture, not the live store)" unconditionally. So
the check that cites Standing Brief Amendment 5 as holding "by a check that ran" is the check
that breaks it. The stale-verdict Critical was confirmed by reading the path end to end: fixed
session constants, deterministic call ids derived from the case number and the case count, a
fixture builder that appends, and a reader that takes the whole file.

Two of round 2's findings are the controller's own round-1 rulings rather than the
implementer's errors, and the brief says so plainly so the next round does not read them as
sloppiness. Round 1 ruled that `neutralize()` be applied inside the harvest command's field
cut; `neutralize` collapses every whitespace run, so a harvested multi-line command can no
longer reproduce what the capture hook would have written, and the judgment fixtures are
scored on exactly that line structure. The corrected ruling splits the guard: the unsafe
character strip belongs in the stored field and the whitespace collapse belongs at the print
boundary only. Round 1 also accepted a local duplication of the capture hook's cap constants
over a require across the packaging boundary; that half stands on Chapter 6's boundary
reasoning, but section 3's precedent has a second half, that two implementations in separate
processes are pinned equal by a test, and no such pin was added.

Gate baseline, mine, run under this session's own claim on this box at 21:32Z and read from
the run's own exit marker: 2587 tests, 2582 passing, 1 failing, 4 skipped, exit 1. Against
Chapter 6's 2554 / 2549 / 1 / 4 that is plus 33 tests and plus 33 passing with failures and
skips unchanged, and plus 33 is exactly the battery suite's own count, which is a second
reading agreeing that no other suite moved. The one red is this machine's known permanent
failure at `test/memory-session.test.js:865`. The comparison crosses a base-ref boundary,
sound here because the five peer commits between Chapter 6's base and current HEAD touch only
`docs/`, `docs/plans/` and `kaizen/`, no code and no test file. The box was claimed at
21:32:27Z by exclusive create with `Started:` interpolated from a clock read at the write, and
released by a session-scoped delete at 21:37:22Z.

Uncommitted and deliberately so, named here because a worktree state with no record is what a
fresh session cannot recover: the two `docs/` findings from round 2 are already fixed in the
working tree and ride with the section's close commit rather than landing alone. The
architecture document's `sidecar/` bullet claimed all of the component's state lives under the
user's home directory and none in the repo, which this section falsifies twice over, since
`sidecar/batteries/` is committed fixture content and a battery run builds its state root
under the system temporary directory; the bullet also enumerated the daemon and the rollup and
omitted the two new commands. The security model gains an evaluation-batteries section,
because this section creates two new plaintext concentrations of real fleet command output and
that document is the inventory of them: one published permanently to a public git repository,
one machine-local, outside `~/.claude`, and outside the daemon's retention sweep.

Next action: await fix round 2, verify the fixes against the code rather than the report,
re-run the whole gate under a fresh claim, run the section 7 live acceptance (the frozen
batteries against the live endpoint plus a fresh harvest end to end), then Chapter 7, flip the
plan to Complete, move section 8's substance to `docs/backlog.md` as a parked item, archive
via curating-docs, commit and push.

### Interim board 3 - 2026-08-30
Section 7 (regression batteries and replay harness) is in its third fix round and has not
closed. The entry exists because the closure-drought rule earns one and because the compaction
gate raised its own signal: eight offers held over thirty-five minutes waiting for a boundary.

In flight: section 7 only. Sections 1 through 6 are closed and pushed. Stage: built, reviewed
three times, fixed twice, and now in fix round 3 at the same tier, which is the entry's most
important content.

Live dispatches: one, implementer-opus, dispatched against `.kit/s7-fixes-3.md` with 2
Criticals, 6 Majors and 15 Minors. Its predecessor returned DONE_WITH_CONCERNS and both of its
Criticals were confirmed fixed here by reading the code rather than the report: the state-root
refusal now covers the whole `~/.claude` tree including the traversal spelling, and the
reassurance sentence is unreachable except through an `ok` status because both other statuses
return first; and the per-run token threads writer to reader through one object, so the log a
run scores is a file no earlier run could have written to.

The third review round is returned and closed: adversarial, blind and security, all at model
opus and effort max through `Workflow`, the no-headroom row of the reviewer-effort table since
the escalated writer tier is opus. Verdicts CHANGES_REQUIRED, CHANGES_REQUIRED and CONCERNS,
with 2 Criticals, both confirmed at source here before the brief was written. The first: the
screen resolves links on the candidate side while comparing against a lexical live tree, so a
`~/.claude` sitting behind a link is accepted while the run prints a sentence claiming it
compared by spelling and by realpath. The second: no lock exists anywhere in the battery or
the daemon, and the daemon routes each verdict by the session id read off the spool entry
rather than its own, so two concurrent runs on one state directory cross-feed and a run that
made zero endpoint calls prints PASS off the other run's verdicts.

The lever decision is the entry's real content, and it went against this session's own
framing. Both Critical classes repeat, which the escalation rule reads as indicting the
implementer and making the tier the lever. The comparison was run and the reading was that the
rule's surface answer aimed at the wrong target, because each round's brief had named the
instance and the implementer had closed the instance exactly, declaring in writing where it
had stopped. A consult was convened to test that framing rather than to ratify it, and it
refuted the framing on evidence out of this session's own brief. The round-2 brief's Class 1
fix shape named one operand for resolution and handed the other over as a lexical literal, so
the asymmetry the blind lens found was specified rather than missed. The round-2 brief already
stated the Class 2 invariant verbatim, in the words this session proposed as the new lever, so
that lever had already run and had not closed the class. The actual generator is neither the
brief's nouns nor the implementer's tier: it is that every round's control was drawn from the
instance the finding named, which is the failure `a-control-from-inside-the-patterns-own-
vocabulary-proves-nothing` names and which this plan stamped in Chapter 6. The ruling is to
spend the second and last opus dispatch rather than the Fable bump, since a tier bump cannot
reach a controller-authored control defect, and to specify each fix as a property with a
control drawn from a withheld instance. Adopted in full. The reach of both classes has also
collapsed monotonically across the three rounds, from no guard at all to a guard covering all
but a link on the live side, and from contamination on ordinary documented re-use to
contamination requiring two simultaneous runs against one explicitly named root, which reads
as convergence rather than a stuck implementer.

Two rulings on direction were this session's rather than the reviewers', and both went against
the reviewer's proposed fix. A frozen field longer than the field cap is not refused, because
the capture hook cuts at that same cap and refusing would be refusing correct behaviour and
would make the shipped fixture unloadable; it is named per case in the run report instead, with
the README stating that a frozen field may legitimately exceed any real spool line. And the
live-store refusal keeps one predicate-only case aimed at the real path, which makes no writes
and spawns no child, while both process-spawning cases move to a fixture home, because a case
that names the real path is what proves the refusal reaches it and a case that spawns the
command there is what could create the fleet-wide capture lever if the screen ever regressed.

Two further findings were confirmed here rather than taken from the reports. Four of the
thirteen frozen judgment cases carry a `corrected` field whose own text says the original hand
adjudication was wrong, while the command's header and the fixture README both claim every
expected verdict was adjudicated before the daemon existed, which is an honesty gate failing in
two shipped artifacts. And case 9's command field is 3,478 characters against a 2,000-character
cap, so it is cut at replay with nothing reporting it.

Gate, this session's own, run under its own claim at 22:22Z and read from the run's own exit
marker: 2614 tests, 2608 passing, 1 failing, 5 skipped, exit 1. Against Interim board 2's
2587 / 2582 / 1 / 4 that is plus 27 tests, plus 26 passing and plus 1 skip, with failures
unchanged, and those figures are exactly the battery lane's own reported delta, a second
reading agreeing no other suite moved. The one red is this machine's known permanent failure at
`test/memory-session.test.js:865`. The background wrapper reported exit 0 while the run's own
marker held EXIT=1, which is the wrapper-exit trap rather than a discrepancy. The box was
claimed at 22:22:27Z by exclusive create with `Started:` interpolated from a clock read at the
write, and released at 22:33:58Z by a session-scoped delete after matching the file's own
`Session:` line.

Honesty sweeps were run here rather than accepted from the report, each with a control proven
to speak first: em dashes, raw control bytes and a structural private-address shape over the
changed files, and the configured endpoint address over the whole repository. All four came
back empty against controls that spoke. The scope is stated at its real strength: the literal
address is swept and the class of addresses is covered only by the structural pattern.

A residual is recorded rather than closed. After the reconciliation fix lands, two concurrent
runs on one state directory can still interleave such that a run parses exactly its own line
count while some of its cases were judged by the other run's process. The verdicts are real
measurements of identical frozen content, so the harm reduces from a false pass to provenance
misattribution, the printed fingerprint and model naming one config while some records came
from another. Marked inferred by the consultant and not verified here.

Uncommitted and deliberately so: the two `docs/` findings from round 2 remain fixed in the
working tree and ride with the section's close commit, as Interim board 2 already records.

Next action: await fix round 3, verify both Criticals against the code with their controls run
red then green rather than against the report, re-run the whole gate under a fresh claim, then
take the operator fork the consult surfaced, which is whether a fourth review round is worth
three reviewer dispatches against a residual now narrowed to one recorded Minor. Then the
section 7 live acceptance, Chapter 7, flip the plan to Complete, move section 8's substance to
`docs/backlog.md` as a parked item, archive via curating-docs, commit and push.

### Interim board 4 - 2026-08-31
Section 7 is in its fourth fix round and has not closed. Four review-round adjudications have
now passed with no section closing, and the compaction gate raised its own signal at eighteen
offers held over thirty minutes.

The fourth round's Critical is the entry's most important content, and it is the one finding of
this section that would have done real harm rather than producing a wrong number. Round 3 added
a sweep record to `sidecar/batteries/README.md`, the table that proves no real identifier ships
in the published fixtures, and its positive control for the identifier pattern was this
session's own real session id. Two lenses found it independently and the security lens returned
BLOCK. Confirmed here on three legs before acting: the value sat in the untracked README, it
appeared in no tracked content so the section-close commit would have been the publication
event, and it resolved to three live artifacts on this machine. Fixed in the main thread, since
it is a Critical security finding and those are never parked: the control is now a
repeating-digit synthetic, the account-path control lost its real-looking name, the long-hex
control lost a real commit prefix, and the `Matches here` column now counts the table's own
controls, which is what let the disclosure hide. All seven patterns were re-run here with each
proved against its own control first, and every remaining match is synthetic or a
documentation-range address.

The generative lesson is recorded in the README rather than only here, because the trap is
structural rather than careless: a control's job is to speak, the cheapest thing that speaks is
real data, and a control string is itself published content. So the artifact whose purpose is
proving nothing real ships is the likeliest place for something real to ship. The README now
states that controls are synthetic on the same terms as the fixture they screen.

This session's own earlier sweeps did not catch it, and the reason is worth keeping: they swept
for the endpoint address, em dashes, raw control bytes and private addresses, and never for
session identifiers. A predicate narrower than the class it guards returns the same clean
verdict whether the state is absent or merely unnamed, which is the coverage rule landing on the
session that had been applying it to everyone else.

Both classes that drove rounds 1 through 3 are confirmed CLOSED by round 4's own reviewers
rather than by this session's assertion. The adversarial lens probed the state-root screen with
withheld instances (home root, trailing separator, mixed case, traversal, sibling directory, UNC
and relative spellings) and it answered correctly throughout, and it read the reconciliation
arithmetic as sound with `parsed` confirmed per-pass at source. The round-4 Critical is new
ground, not a fourth repetition.

Live dispatches: one, implementer-fable carrying the explicit fable model override, against
`.kit/s7-fixes-4.md` with 4 Majors and 11 Minors and an explicit list of findings ruled not to
be fixed. Its first-turn reading was taken because an override dispatch always earns one: 21
non-synthetic assistant lines, zero synthetic, model resolved to `claude-fable-5`.

The escalation to fable is recorded with its real reason, because a later reader would otherwise
misattribute it. It is not earned by the repeating-class rule, which does not fire here since no
class repeats. It is earned by the bar on a third dispatch at one tier: opus has had two fix
dispatches on this section, so the choice was fable or the main thread, and the remaining set
includes an honesty gate where being right matters more than being cheap.

That honesty gate is Major 1: the per-case cut report and the fixture README both state that the
judge sees the first 2,000 characters of case 9's 3,478-character command, while the judgment
prompt caps that field at 1,500. A report understating a cut, in an instrument whose four
corrected cases exist because a cut removed the evidence a verdict turned on, is the same defect
one level up. The other three Majors: the provenance residual is narrower than the code's
comment claims and is cheaply closable by comparing each scored record's prompt, model and
endpoint against this run's; the plaintext-concentration disclosure and removal hint print only
on the success path while the plaintext is written before the endpoint is contacted, so a run
with no endpoint config creates a directory of real fleet command output and never says so; and
an ungated recognition counter can turn a fully measured judgment-only run into a cannot-measure
exit.

Seven findings are ruled recorded rather than fixed, and the brief names them so the
implementer does not widen the delta: the recognition ceiling measuring answer-extras rather
than daemon-queued pointers and its absolute-versus-rate shape, the split case semantics in the
path containment helper, the expected-skips count resting on the fixture cwd resolving to a
segment with no index, three lstat-then-write windows, an unbounded transcript accumulation, and
a truncation flag derived differently from the capture hook's. Each is real; changing the
acceptance arithmetic at the close of the section it certifies is the worse trade. One reviewer
finding was ruled against outright: the two screen assertions that pass real `~/.claude` paths
in read-only earn their exception, because they write nothing and spawn nothing, and a control
that never names the real default state root cannot prove the refusal reaches it.

Round 3's fixes were verified here at the code rather than from the report. The screen now
resolves both operands and cross-compares four ways, returning unscreened rather than accepted
when either side fails, and the state-root sentence is rendered from the screen's own record of
which comparisons ran, so an implementation that resolved one side prints a shorter list and
cannot outrun its own check. The reconciliation is one integer equality between fixture lines
written and daemon lines consumed, and its comment bounds what it does not close rather than
claiming the class is shut.

A declared fold: `sidecar/text.js` gained the shared surrogate trim under Amendment 1 and is now
on this section's Files in scope, taken by the implementer outside the brief's listed scope and
declared in its report.

The box was contended for this whole stretch and the coordination is recorded because a protocol
gap surfaced. A subagent's claim was overwritten mid-run; the peer seat confirmed from its own
transcript that it wrote with a truncating shell redirect after releasing an earlier claim,
never re-reading the file, so an exclusive create landing in that gap was replaced with no error
on either side. The peer re-stamped a date-only `Started:` value with a real clock reading, the
fourth malformed value from that seat recorded in this plan. The generalization is that a
read-then-write carries no mutual exclusion whatever the reader does with what it read, so the
exclusion has to be the write; the peer is capturing that as kaizen, and this entry cites it
rather than filing a duplicate. The whole gate is being held rather than run beside a live
foreign suite, on the reasoning that a contended run is contention rather than a result and
would have to be discarded anyway.

Next action: await fix round 4, verify the four Majors at the code, re-run the whole gate under
a fresh claim once the peer's hold clears, then the section 7 live acceptance, Chapter 7, flip
the plan to Complete, move section 8's substance to `docs/backlog.md`, archive via
curating-docs, commit and push.

### Interim board 5 - 2026-08-31
Section 7 is in its sixth review round and has not closed. Two further round adjudications
have passed since Interim board 4 with no section closing, which is the closure-drought floor
on its own, and the compaction gate raised its own signal alongside.

The entry's real content is that one defect class has now been found open four times on one
module, and that this session is the party that kept failing to close it rather than any
implementer. The class: the live-store screen accepts a path that is INSIDE the live
`~/.claude` tree while printing the sentence saying it screened the path and found it outside.
Instance 1 was the screen's scope, narrowed to `~/.claude/kit-sidecar`. Instance 2 was the
one-sided realpath, resolving the candidate and comparing it against the live tree's
unresolved spelling. Instance 3, found in round 5, was `startsWith('..')` reading a genuine
child named `..data` as an escape, since `path.relative` returns `..data` for it. Instance 4,
found in round 6 and reproduced here, is a UNC spelling: `\localhost\D$\...\.claude\x` and
`D:\...\.claude\x` are the same directory on disk, and the screen refuses the second and
accepts the first, because `path.relative` returns an absolute path when the two roots differ
in kind and `isAbsolute(rel)` then short-circuits every one of the four comparisons.

The generator is now named, and it is not the implementer tier. Instance 3's defective
predicate predates the fable dispatch, which moved it verbatim during an extraction, so a tier
bump could not have reached it. What generates the class is that every control this screen has
ever been given was a list of path SPELLINGS: round 2's, round 3's, and round 4's seven-name
probe list. A name list samples a class and cannot cover it, because the member that breaks the
predicate is by definition the one no name in the list suggested. That is recorded as Standing
Brief Amendment 6, adopted at this boundary and binding on every section opened after it.

Round 5's fix, written in the main thread rather than dispatched, closed instance 3 and was
itself another sample: it fixed the containment test to read the relative path's first segment
and built its control from three spellings of instance 3's own shape. All three of round 6's
lenses answered the round's stated question the same way without prompting, that the new
control is a sample rather than coverage evidence, and the adversarial lens then produced
instance 4 from outside the sample. Recording that plainly is the point: this session applied
Amendment 6 to everyone else's controls for three rounds and not to its own.

A second defect of the same shape rides with it, from the blind lens and confirmed here in
principle: `sidecar/harvest.js` screens `path.resolve(outPath)` and then lstats, writes,
chmods and reports against the raw `outPath`, so the spelling that is judged is not the
spelling that is written. And round 4's Major 1 is half-closed: `fieldCuts` records a cut only
when a field exceeds the 2000-character field cap, so case 5's 1,555-character command, cut to
1,500 by the judgment prompt, is cut with nothing in the run report saying so, while the
fixture README asserts that every such cut is named per case. Case 5 is one of the four
corrected cases whose corrections exist because a cut removed the evidence a verdict turned on,
which is the same defect one level up for the second time in this section.

Two sweep-table counts are wrong and were confirmed wrong by re-running the table's own
pattern: the new eighth row records `PRE-FIX` three times in `cases.json` where the recorded
regex matches it twice (five occurrences exist, three of them lowercase and correctly
unmatched), and the account-path row undercounts its own file. No real identifier ships on
either, but this is the column whose miscount hid a real session id in round 4, so a count a
re-run contradicts is treated as a defect rather than a nit.

The host name `SCOTT-CLAUDE` in cases 1 and 10 was adjudicated rather than reflexively
replaced. It appears three times, always inside the path `kaizen/notes-SCOTT-CLAUDE.md`, where
it names a file rather than a network destination, and that path is already tracked, published
content of this repository, confirmed here by `git ls-files`, with the token appearing in about
twenty tracked documents. The exposure delta is zero and the rule-compliance delta is not,
which is why the security lens is right that the decision belongs in `docs/security-model.md`
rather than only in the fixture README. Recorded as a finding to close at the section's
freezing step rather than as a disclosure.

Gate: 2643 / 2636 / 1 / 6, exit 1, read from the run's own marker, against this session's
earlier whole-gate run of 2642 / 2635 / 1 / 6 on the same tree without round 5's fixes: plus 1
test, plus 1 passing, failures and skips unchanged. The one red is this box's known permanent
one, confirmed by name in the log rather than by count. Both runs are this session's own, so
the delta is a real diff rather than a comparison across baselines.

Live dispatches at this boundary: none. Round 6 was three read-only lenses through `Workflow`,
adversarial, blind and security, all at model `opus` and effort `max`, the no-headroom row of
the reviewer-effort table, since round 5's delta was written in the main thread and this
session's model is the writer tier. All three returned; verdicts CHANGES_REQUIRED,
CHANGES_REQUIRED and BLOCK.

The box was released to the peer seat mid-adjudication. My own claim overran its
`Expected-seconds` by eleven minutes, because the figure was set to the suite's runtime rather
than to the whole hold, and the peer asked rather than deleting a claim it did not hold. The
generalization sent back: `Expected-seconds` bounds the hold, not the process inside it, and a
holder who overruns rewrites the field rather than leaving a reader to compute a lapsed expiry.

Next action: convene a consult on the screen's design before spending a fifth attempt at it,
since this is the second failed attempt at one problem by this session and a patch to a string
comparison is what has failed four times; the framing to test is whether path-string comparison
is salvageable here at all or whether the screen should compare filesystem identity over the
candidate's existing ancestor chain, which is spelling-independent by construction. Then the
non-screen fixes (the unreported prompt-cap cut, the two sweep counts, harvest resolving once,
the security-model host-name record), then a seventh review round, then the section 7 live
acceptance, Chapter 7, flip the plan to Complete, move section 8's substance to
`docs/backlog.md`, archive via curating-docs, commit and push.
### Interim board 6 - 2026-08-31
Section 7 is through its seventh review round and has not closed. That is the closure-drought
floor again on its own, and the compaction gate raised its own signal alongside, holding four
offers.

What changed since Interim board 5 is the shape of the problem rather than another patch to it.
A consult was convened before spending a fifth attempt at the screen, and it corrected the
framing rather than answering the question as asked. The question offered two options, keep
patching path strings or compare filesystem identity; the ruling took neither, because pure
identity regresses the one case the string screen gets right, an absent live tree, where every
child of the home directory shares the same existing anchor. What shipped is identity-anchored
containment: a device-and-inode walk up the candidate's realpath ancestor chain, with a
one-segment case-folded name compare used only for components that do not yet exist, and the old
string predicate kept as a REFUSAL-ONLY overlay whose `ok` is discarded. That last move is what
retires the string predicate's two known remaining defects without a further patch: both produce
a false `ok`, and an overlay structurally unable to grant `ok` cannot act on one.

The ruling rests on measurement rather than argument, and the measurements were re-run by this
session against the shipped module before anything was built on them. Confirmed here: the drive
letter, the `\\localhost\D$` admin share and its loopback-address form return an identical
device-and-inode pair for one directory; `bigint: true` is mandatory, since the Number form of an
inode on this machine reports 6917529027648879000 where the BigInt form reports
6917529027648878213, a collision-sized difference; and `fs.realpathSync` leaves an 8.3 spelling
untouched while `fs.realpathSync.native` expands it but leaves a UNC spelling untouched, so no
single canonicalizer covers the class and string comparison is not salvageable.

Two further instances of the class were confirmed at this boundary, taking the count to six.
Instance 5 is an 8.3 short name and it is the most serious of the six, because it needs no UNC,
no admin share and no elevation and it reproduces on the system volume the live home sits on:
two spellings of one directory stat to an identical device-and-inode pair while the old screen
refused one and accepted the other, with a genuine outsider correctly accepted in both spellings
as the control in the other direction. Instance 6 is the one that matters for the future, and it
is not in the screen at all. With the rebuilt screen answering correctly, the security lens found
that an intermediate reparse point UNDER a screened `--state-dir` still routes a fixture write
into the live tree, because the writer creates `memory-root`, `projects` and the segment
directory with a recursive mkdir that lstats only the leaf it was handed. Reproduced here with a
junction on an intermediate component: the screen answers `ok`, the directory chain is created,
the index lands inside the fixture live tree, and the same shape with no junction correctly stays
outside. The hole did not close, it moved one layer down into the code that trusts the screen.
That is recorded as Standing Brief Amendment 7 and it is the durable lesson of this section.

Round 7 verdicts: CHANGES_REQUIRED, CHANGES_REQUIRED, CONCERNS. All three lenses hunted a sixth
instance INSIDE the screen and none found one, across UNC, extended-length, volume-GUID, 8.3,
case-flipped, alternate-data-stream and both link directions, which is the first round in this
section where the screen itself survived the hunt. The findings are therefore about the writer
below it and the control beside it. The sharpest of them, found independently by two lenses: the
invariance table's only coverage floor is a global count of checked pairs, and it fails in both
directions. Downward, the entire Windows spelling class can drop out and the count still clears
the floor, so the very transform that generated instance 5 could run zero times unnoticed.
Upward, the floor cannot be met on POSIX at all, so the run this plan's own declared assumption
names as the confirmation of its POSIX inference would go red on the instrument rather than on
the screen. That is the section's own recurring failure shape, a check green or red for the
wrong reason, arriving one level up in the thing built to detect it.

The two security Majors beside it are being fixed rather than parked, per the rule that a
security finding of Major weight never takes the out-of-scope route: the hard-link guard sits in
the producer that needed it second rather than at the channel both producers write through, and
the suite reads the live `~/.claude` through the screen's own realpath calls while the test
file's header claims it does not, which is an Amendment 5 violation whatever its exposure.

Gate: 2650 / 2643 / 1 / 6, exit 1, run by this session and read from the run's own marker,
against Interim board 5's 2643 / 2636 / 1 / 6. Delta plus 7 tests and plus 7 passing, failures
and skips unchanged. The one red is named rather than counted: `test/memory-session.test.js:854`,
this box's known permanent path-length red, whose assertion is about a pinned memory-store
directory name and which touches no sidecar module. The box was claimed by exclusive create for
that run and released immediately after; three foreign `dotnet.exe` processes were on the box at
the time with no claim standing, and that contention is named here rather than treated as a clean
read, since a process poll is a sample and not a clearance.

One reported figure is marked down rather than repeated. The implementer measured the replaced
screen as wrong on 34 of 88 pairs, 10 failing open, but against a reconstruction it wrote after
destroying the only copy of the original. That is weaker than it sounds and stronger than it
reads: this session confirmed the reconstruction's three function bodies are code-identical to
the predicate the new module still retains verbatim as its overlay, differing only by an elided
comment, and the adversarial lens independently found a second corroborating copy on disk. The
figures are a diagnostic that nothing green depends on, and they are recorded as measured against
a corroborated reconstruction rather than against the shipped file.

Live dispatches at this boundary: one, the round-7 fix implementer, resumed over SendMessage with
its own context rather than dispatched fresh, carrying the thirteen-item fix list and Amendment 7.
Round 7 itself was three read-only lenses through `Workflow` at model `opus` and effort `max`, the
no-headroom row of the reviewer-effort table, since the writer tier for this delta is opus.

Next action: adjudicate the fix round, re-run the whole gate, then the section 7 live acceptance
(frozen batteries against the live endpoint plus a fresh harvest end to end), Chapter 7, flip the
plan to Complete, move section 8's substance to `docs/backlog.md`, archive via curating-docs,
commit and push. The push now has to expect a non-fast-forward: the operator has a second worker
committing from a worktree of this repository, and it touches the same shared documents
(`docs/architecture.md`, `docs/backlog.md`, the README). The merge is expected to be clean, since
the two workers write different sections, and a clean merge is exactly the case that needs the
whole gate re-run afterward plus a read of the merged document, because two additions to one
inventory document can make incompatible claims about the same surface with no conflict marker to
catch it.
### Interim board 7 - 2026-08-31
Section 7 is through its eighth fix round and has not closed. The closure-drought floor is met
again and the compaction gate raised its own signal alongside, and this entry also lands during a
forced wait for the machine rather than at a moment of this session's choosing.

The round-8 delta is the first in this section that closes the class at the layer the class
actually lives on. Amendment 7's instance is closed in the WRITER rather than in the screen:
`sidecar/logs.js` gains `ensureDir(dir, guardFrom)`, which creates one component at a time below
the screened root instead of handing the whole chain to a recursive mkdir, and all three of
`sidecar/battery.js`'s fixture-tree creators pass the screened `--state-dir` into it. The
hard-link refusal moved out of the producer that needed it second and into `guardWriteTarget` at
the boundary both producers write through, which is the shape the doctrine already requires of a
sanitizing guard once a channel gains a second producer. The invariance table's coverage floor is
no longer a global count but a per-transform one derived from what the platform can actually
build, so a transform that silently stops generating fails the case rather than being absorbed by
a total, which was round 7's sharpest finding and the one two lenses reached independently. And
the suite's last read of the operator's real store is gone: every child now inherits a fixture
home, `os.homedir()` survives in exactly two places for the string it returns and never as a path
to open, and the file header states that rather than claiming an exception.

Everything above was verified here at the code rather than taken from the report. The production
call shape was driven by a two-directional control this session wrote and ran: a junction on an
intermediate component under a screened root is refused with nothing created inside the fixture
live tree, and the identical shape with no junction is still created outside it. The per-transform
floor, harvest's single resolved `--out`, `fieldCuts` reading the cap rather than the resulting
length, and every `os.homedir()` and `.claude` site in the suite were each read at source. An em
dash sweep over the five changed files returns zero against a control file carrying one, so the
silence is the instrument working; the predicate is the literal character and the scope is those
five files.

The entry's most important content is a controller error, because it is the kind that produces no
error message. A blocking `TaskOutput` call returned at its own timeout with a raw slice of the
agent's transcript, and that slice ended in a `DONE_WITH_CONCERNS` report. It was read as the
agent's final report; it was the PREVIOUS round's report, still sitting in the transcript while
the agent worked the round after it. Two things followed. A file edit was made to
`test/kit-sidecar-battery.test.js` while the agent was still writing that same file, so two
writers raced on one header, and a whole-gate run was started against a tree the agent was still
changing. Neither cost anything durable: the agent's fix superseded the edit with a stronger one
and the surviving header is self-consistent and was re-verified true, and the gate was discarded
unread rather than reported. The generalization is the one the completion contract already
states and this session did not apply: a timed-out call's payload is a slice and never a result,
and a terminal marker found inside a slice belongs to whatever round wrote it. Only a status of
completed yields a final report, and here that status arrived thirty minutes later.

One implementer disagreement was adopted against this session's own written instruction. The fix
brief specified stripping trailing dots and spaces before the segment compare on win32; the
implementer folded unconditionally and argued that the asymmetry justifying the strip, where
over-refusal costs a rename and under-refusal costs the operator's store, is a property of the
filesystem being addressed rather than of the platform the process runs on, since a Linux host can
export a share a Win32 client canonicalizes on the far end. Adopted, because this module already
folds case unconditionally on exactly that reasoning and this plan's own declared assumption
records it, so gating one and not the other would be incoherent.

One implementer concern is answered here rather than left open. `logs.ensureDir` called with no
root is still the old permissive `mkdir -p`, and the daemon's own call sites use that form. It is
safe there and the reason is structural rather than a judgement: `statePaths` returns the root
plus three children one level below it, so there is no intermediate component for a reparse point
to sit on, and each child is lstat-refused on its own before creation. Recorded as a bounded
residual rather than a defect, bounded by the shape of the paths rather than by anybody's care.

A second Amendment 5 hazard was found and closed by the implementer inside its own fix and is
worth naming: an existing case built its control path inside the operator's real `~/.claude` and
registered a recursive remove on it. It never created anything, but only because the guard the
case exists to test was working, and the path it sat beside is the fleet-wide capture activation
lever. It now runs against a fixture home.

The gate is HELD rather than run, and this is a wait rather than a result. A live foreign claim
stands on the machine's one heavy-process slot: session `af7f2d50-...`, repo `D:/ai-os`, a
whole-solution verification gate started 03:36:00Z with a 1800-second estimate. Presence licenses
waiting, so no gate figure is reported at this boundary and none is inferred from the
implementer's own lane run, which reports 250 / 248 / 0 / 2 exit 0 on the two sidecar suites and
is recorded as REPORTED. A process poll taken before the claim was read showed three foreign
`dotnet` processes at about 150 MB each and no test runner; that poll is named as contention
rather than read as a clearance.

Live dispatches at this boundary: none. The round-8 implementer returned completed and its files
are settled, confirmed by a process poll finding no surviving `node --test` child and by the tree
not moving across two readings.

Next action: wait out the peer's claim, take the slot by exclusive create, run the whole gate and
report it against Interim board 5's 2643 / 2636 / 1 / 6, then the section 7 live acceptance (the
frozen batteries against the live endpoint plus a fresh harvest end to end), Chapter 7, flip the
plan to Complete, move section 8's substance to `docs/backlog.md`, archive via curating-docs,
commit and push. The push expects a possible non-fast-forward: a second worker commits to this
repository from a worktree and touches the same shared documents, and a clean merge there is
exactly the case that needs the whole gate re-run afterwards plus a read of the merged document.
