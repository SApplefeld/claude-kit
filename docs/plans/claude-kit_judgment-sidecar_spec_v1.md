# The judgment sidecar: a local-model second reader over fleet tool calls

Status: Ready (not armed)
Commit Model: Commit-and-Push
Session model: opus or above; section 6 requires a fable design pass before implementation

## Dispatch Authorization

Authorized 2026-08-30 by the operator: the judgment-sidecar design as recorded in this spec's Decisions section, approved in a design dialog at the operator's keyboard in the expert seat's session. This section records design authorization; arming this plan for execution is a separate operator act, and this plan does not join the currently armed queue.

## Goal

A sidecar that judges fleet tool calls after they run: did the action do what the stated intent required. Verdicts come from the host's local model at marginal cost near zero, land in per-session logs, and diverged findings surface on files the operator and coordinator already read. The sidecar holds no authority. It observes, judges, and reports, and its product is converting claims the fleet can only assert today ("no silent failures happened this session") into logged, countable facts with a named instrument behind them.

The defect class it exists for is the quiet one: an exit code that belongs to the wrong command in a pipeline, a search whose silence proves nothing about its pattern, a staged list that holds more than the intent named. The fleet's doctrine catches these by discipline; the sidecar is that discipline as machinery that cannot forget to run.

## Evidence

The design rests on a measured audition, journaled end to end under the project journal key `local-model-audition` (query: `memq get local-model-audition`). The constants:

- Endpoint: Ollama on the Hyper-V host GPU, `http://192.168.58.245:11434`, recorded in the operator memory tier (`the-host-serves-a-local-llm-endpoint-for-all-vms`). Probe `/api/tags` for liveness before leaning on it.
- Model: `qwen3.8:27b` (Q4_K_M, 17.5 GB weights, fully VRAM-resident, keep-alive forever). Standing context 32768, one serial slot; `OLLAMA_NUM_PARALLEL` is parsed but inert in the installed version, so the lane is serial by construction.
- Performance: roughly 90 tok/s generation, 320 tok/s prefill, 200 to 700 ms per verdict, about 5 verdicts/second sustained on the serial lane. Fleet tool-call volume is orders of magnitude below that ceiling.
- Capability: 14/14 on policied event triage; 9/10 on hand-written action-awareness cases; 12 to 13 of 13 substance on real production tool calls harvested from fleet transcripts, including inverted semantics (a deliberately-derived test failure judged achieved), a trap-shaped-but-honest exit echo (no false alarm), and observation intents (a faithfully read red gate judged achieved).
- Format: prose output breaks its contract on non-achieved verdicts; JSON-schema-constrained output with a verdict enum eliminates the failure class. Constrained decoding is mandatory, not advisory.
- VRAM ledger, operator-measured: 7 GB non-model host floor, 17.5 GB weights, KV near 65 to 70 KB per token. Context 16K to 32K holds total GPU use at 23 to 28 GB under genuine workday load (work VM on GPU-P plus a live Teams call). 128K over-commits and pages softly to system RAM while the API still claims full residency.
- Runner behavior under sustained load: `llama-server.exe` host RAM climbs (observed to 8 GB); an Ollama restart clears it at a measured cost of about 6.5 s reload. Operational posture: budget host RAM headroom and restart on threshold.

Audition scripts live at `.kit/round2-policy.mjs`, `.kit/round3-action.mjs`, `.kit/round5-real.mjs`, and `.kit/harvest-cases.mjs` in this repo's gitignored scratch; section 5 promotes their content into the sidecar repo as regression fixtures.

## Design

Two components with a file contract between them.

**The capture hook (kit-shipped).** A PostToolUse hook, Bash matcher in v1, that appends one JSON line per completed tool call to a machine-local spool: timestamp, session id, cwd, tool name, the call's `description` field (the declared intent), the command, the result truncated to a bounded length, and the harness error flag. The hook is fail-open and dormant-by-default: it stats the spool root directory and exits silently when the directory is absent, so installing the hook activates nothing until a daemon creates the spool root. No network, no waiting, no configuration; any internal error exits 0. The hook must never disturb the session it observes.

**The judge daemon (sidecar repo).** A small Node process, one per VM, that consumes the spool: formats each entry as an INTENT/ACTION/RESULT triple, calls the endpoint with the proven system prompt and a JSON-schema-constrained response (verdict enum `achieved | failed | diverged`, reason capped at 300 characters), appends the verdict to a per-session verdict log, and appends `diverged` findings to a findings file with session, timestamp, intent, and reason. The daemon judges against the intent, not against surface success markers; the shipped system prompt is the one validated on production cases, including its calibrated-suspicion clause and its instances-not-the-boundary phrasing.

**Resilience, field-derived.** Three requirements written by live traffic during the audition:
- Contended lane: verdict calls carry a timeout; on timeout the daemon marks a gap ("calls N to M not judged, lane busy") and moves on. It never blocks, never retry-storms.
- Endpoint down: the daemon gap-marks the affected range and keeps consuming the spool. A gap is a recorded cannot-measure, never a silence that reads as clean; the watcher obeys the rule it enforces.
- Runner restart: a connection failure following a healthy period is retried once after the reload window (about 7 s), then gap-marked.

**Delivery, v1.** The findings file and a rollup command (`counts per session per day, gap ranges included`) are the whole surface. The coordinator's status round may read them; nothing couples to Discord in v1. Push delivery is a follow-on decision once field volume is known.

## Non-goals

- **Interrupt authority.** The triage organ scored at ceiling in the audition because fleet events are sparse and mostly obvious; the marginal value over the coordinator's existing steering surfaces is thin, while delivery, preemption authority, and double-notification are real costs. Interrupt-style reflexes belong to a future host-owned-loop organism, not to this sidecar. Decided 2026-08-30; do not re-litigate from scratch, argue against this record.
- **In-band verdict injection.** PostToolUse can feed text back into a session's context; doing so puts model output inside session context and is a trust step beyond advisory logging. Deferred deliberately.
- **Parallelism engineering.** The serial lane clears roughly 5 verdicts/second against a fleet that produces a few thousand calls a day. Migration to llama.cpp's own server with true batching is the known path if saturation ever arrives.
- **A model cascade.** The audition retired the planned small-triage-model tier: the 27B answers in reflex time, so one model serves all judging. A smaller model returns only if VRAM pressure demands it.
- **Store writes by any component.** The distiller drafts; sessions and the operator author. Nothing in this plan writes to the memory store.

## Sections of Work

### 1. Spool contract and capture hook (kit repo). Model: opus

The spool line schema documented in the sidecar repo and mirrored in the hook's header comment; the PostToolUse hook implemented per Design with tests: appends a well-formed line for a Bash call, dormant when the spool root is absent, exits 0 on malformed payloads and on write failures, adds no measurable latency (assert a generous ceiling). Ships in the kit's hooks directory through the normal build.

Acceptance: hook tests green in the kit suite; a manual session on this VM with the spool root present produces spool lines matching the schema for real calls.

### 2. Sidecar repo bootstrap. Model: sonnet

The new repo skeleton: plain Node, no framework, config file naming the endpoint, model, spool root, log paths, timeouts; README stating the advisory-only stance and the file contract; `.gitignore` for logs and spool.

Acceptance: repo exists with config loading and a no-op daemon entry point that creates the spool root (the activation act) and exits cleanly.

### 3. Judge daemon core. Model: opus

Spool consumption with a persisted offset, the verdict call with schema-constrained output, verdict logs, findings appends, and all three resilience behaviors. The system prompt ships as a versioned file, not an inline string.

Acceptance: against the live endpoint, the daemon judges a replayed spool of the audition's 13 harvested cases and reproduces the audition verdicts; with the endpoint stopped, it gap-marks and continues; killed and restarted, it resumes from its offset without re-judging.

### 4. Findings surface and rollup. Model: sonnet

The rollup command over verdict logs and findings: per-session and per-day counts, gap ranges, plain-text output a status round can quote.

Acceptance: rollup output over section 3's replay run matches hand-counted totals, gaps included.

### 5. Regression batteries and replay harness. Model: sonnet

The audition batteries promoted into the sidecar repo as frozen fixtures with expected verdicts, plus a harvest command that extracts fresh INTENT/ACTION/RESULT triples from a named transcript file for replay. Battery runs are on-demand evaluation, not CI, since they need the live endpoint.

Acceptance: the frozen batteries reproduce at least the audition scores against the live endpoint; a fresh harvest of a recent session produces judgeable triples end to end.

### 6. Transcript distiller (v1.5, gated). Model: fable design pass, then per that pass

Gated on the operator's call after a v1 field trial. Scope sketch to be specified by the design pass: end-of-session transcript extraction, chunked map-reduce distillation (chunks sized well inside the 32K context), candidate memory drafts and contradiction flags written to a pending file for session or operator adjudication. Interaction with the kit's memory-recognition machinery (in execution now, a separate plan) is evaluated then, not designed here.

Acceptance: deferred to the design pass.

## Decisions

- Decided 2026-08-30: judgment over triage as the sidecar's purpose. Triage scored at ceiling and duplicates coordinator steering; judgment addresses the fleet's documented quiet-failure class. Operator-initiated redirection, adopted with the audition as evidence.
- Decided 2026-08-30: capture by PostToolUse hook, judgment by external daemon. The hook wins capture on push-over-poll, structured payloads, subagent coverage, and kit distribution; the daemon keeps the model call out of every session's critical path. Producer/consumer split; the spool is the contract.
- Decided 2026-08-30: advisory-only permanently in this design. Authority adds failure modes; observation adds evidence. The board rollup, not intervention, is the product.
- Decided 2026-08-30: new repo for the daemon; the kit ships only the hook and the spool contract. Different substrate, different lifecycle.
- Decided 2026-08-30: standing endpoint configuration context 32768, serial, keep-alive forever, per the operator's own workday measurement (16K to 32K sweet spot, 23 to 28 GB total GPU under real load).
- Declared assumptions, override freely: the sidecar repo lands at `D:\kit-sidecar` under that name; findings delivery beyond the file waits for field volume; the hook ships in the next kit release dormant-by-default via the spool-root check, needing no setting.

## Out of scope for this document

The PIANO-organism substrate (Agent SDK host, streaming-input sessions, module scheduling) is a separate future effort. This spec is deliberately the smallest organ that earns rent on the existing fleet.
