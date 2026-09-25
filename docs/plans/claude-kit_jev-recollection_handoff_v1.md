# Jev and the kit's recollection surfaces: a handoff brief

Status: Handoff (non-executable; authors no sections)
Created: 2026-09-19
Origin: a claude.ai design conversation on the operator's behalf, working from a clone of `SApplefeld/claude-kit` at `main` 2d2ead9 and the `feat/memory-database` branch at 1e3bdd7 (pull request 59). Anchors are authoring-time; re-locate every hit by content.
Distilled into: `claude-kit_jev-recollection-judge_spec_v1.md`, which adopts applications A and E below and declines B, C and D with reasons.
Companion files: `run.js` (the battery-to-SystemOne harness) and `report.md` (the live run's output) were delivered beside this brief to the operator and are not in the repository; the spec's section 1 lands the harness.

The numbers and vendor terms in this document are reported from the cloud session's run and the vendor's published pages. Nothing here was re-measured by the session that filed it.

## 1. Purpose and standing

This document records a day of design work and one live experiment against TypeSafe's Jev model. It hands the receiving session the findings, the reasoning behind them, and the places in the kit where Jev earns a seat. It is not an approved plan, it authorizes nothing, and every implementation specific below is a proposal for a plan doc under `docs/plans/` to adopt, amend, or reject.

Claims here carry two grades. A confirmed claim names its evidence (a file and line, a command run, a number from the run's own output) and can be acted on after re-locating the anchor. An inferred claim is a reading of confirmed facts, and it says so. The largest inferred claims are the interpretations of a thirteen-case and a fifteen-case battery: strong enough to direct the next experiment, not strong enough to redesign a surface on.

One standing item. A TypeSafe API key was used for the live run from the cloud session. It was passed as an environment variable for one invocation, written to no file, and the operator intends to decommission it. The receiving session must not look for it and must obtain its own through `TYPESAFE_API_KEY` in the environment, on the same terms the kit already gives `~/.claude/kit-endpoint.json`.

## 2. Jev and the line

Jev is a model that returns typed decisions with calibrated probabilities instead of text, and the whole question of where it fits reduces to knowing which decisions have that shape. TypeSafe AI released it on 2026-09-15 as the first of what they call System One models. It takes a block of state and a set of typed questions, evaluates every question in one parallel pass, and returns one answer per question: a `noul` (a probability of yes), a `choice` (a distribution over options the caller enumerated) or a `score` (a position on a scale the caller defined). It generates no strings. The price is $0.042 per million input tokens with output free, and the vendor claims 70 to 500 ms per call.

### The wire contract

`POST https://api.typesafe.ai/v1/systemone` with `Authorization: Bearer <key>`, a JSON body of `{ state, model: "jev-latest", questions }`, where `state` is a string, object or array and `questions` is a map of id to `{ type, instructions, criteria }`. A `noul` takes optional `criteria: { true, false }` descriptions; a `choice` takes `criteria: { option: description | null }`; a `score` takes an ordered array of level names. The response carries `answers` keyed by question id, and `usage.input_tokens`. Errors are `401`, `422`, `429` and `529`; the last two want exponential backoff. The vendor's official SDK exposes this as `client.system_one(...)`, and a request shaped for it can be pointed at a local endpoint by changing `base_url`.

### The two dimensions

The line between ordinary code, Jev and an LLM is two independent dimensions, and Jev owns one quadrant. The first asks whether the condition can be computed from the data or requires judgment: `order.total > 100` is computable, "is this customer angry" is not, and that line separates code from any model. The second asks whether the answer space is closed (every valid answer enumerable before the input is seen) or open (the answer must be constructed). Jev's home is judgment required with a closed answer space: the question is hard, the answer is small.

Three smells mark Jev territory in an existing codebase. The regex we are ashamed of: a keyword heuristic approximating a judgment. The LLM call parsed into an enum: any prompt ending "reply with exactly one of" is a Jev call wearing an LLM costume. The human glance: any queue where a person sorts rather than composes. Two properties then change the design. Questions are nearly free, so one fuzzy judgment decomposes into a checklist evaluated in one pass, and ordinary code recombines the answers. And because the probabilities are calibrated (the vendor trains them against outcomes rather than preference), a confidence threshold routes work: act automatically above it, escalate to an LLM or a human below it.

The counter-smells matter as much. An extracted value (an order number, a date) is generation, not decision. A decision that needs an explanation for an audit or a user needs text. A one-off decision has no volume to justify the plumbing. And a closed-space question that needs chained reasoning to reach ("would this refactor break callers") is System 2 work with a small answer. The battery below found exactly that last case.

### Privacy standing

TypeSafe's privacy policy commits, twice, not to train or fine-tune any model on inputs, and that commitment appears to cover every customer. The operational scaffolding behind it is thin: retention is "as long as reasonably necessary" with no fixed deletion window, zero data retention is enterprise-only by negotiation, no security certification is cited, and no data-access or deletion mechanism is described. By comparison, Anthropic's published terms delete API content within 30 days and do not train on it by default. The material gap for the kit is the retention window, since anything a Jev call carries sits on the vendor's infrastructure for an undefined period. The operator accepted the off-LAN call for the fleet on 2026-09-20, recorded in the spec's Intent.

### The local alternative

`jaredpalmer/kev` is a reconstruction of Jev's architecture on Qwen2.5-0.5B. It is a 38 MB LoRA adapter plus a pointer readout head, packs the state and every question into one sequence under a block-causal mask (each question sees the state and never a sibling), scores each question's options against a decide token, and speaks TypeSafe's exact API. Question isolation is exact (packed and separate requests agree to 4e-6) and forged delimiters cannot inject options. It is trained on six public passage-classification datasets, its calibration is measured in-distribution only, and it serves at most 8,192 tokens. It is a reference implementation, not a usable backend for this workload today. Point the harness at it with `TYPESAFE_API_URL` to measure the gap.

### Reference material

- TypeSafe API contract: https://docs.typesafe.ai/api and https://docs.typesafe.ai/legal
- TypeSafe privacy policy: https://typesafe.ai/legal/privacy-policy
- Anthropic retention and training terms: https://privacy.claude.com/en/articles/7996866-how-long-do-you-store-my-data and https://privacy.claude.com/en/articles/10023580-is-my-data-used-for-model-training
- kev: https://github.com/jaredpalmer/kev
- jev-pruner (a Claude Code function-hook plugin that trims Bash output with Jev; separate from the kit, and it ships command output and conversation history to TypeSafe on every eligible call): https://github.com/tamaratran/jev-pruner
- Launch coverage: https://www.theregister.com/ai-and-ml/2026/09/16/typesafe-ai-debuts-model-for-machines-that-plays-doom/5296711

## 3. The battery run

The sidecar's two frozen batteries were replayed against Jev on 2026-09-19 and scored against their hand-adjudicated expected values. The batteries are `sidecar/batteries/judgment-v1/cases.json` (thirteen real production triples, expected verdicts in `acceptableVerdicts`, passing floor twelve of thirteen) and `sidecar/batteries/recognition-v1/` (fifteen situations against a 46-line index, twelve with one gold record each and three true negatives, measured floor twelve of twelve recall with three of three clean negatives). The run took 41 requests and 132,441 input tokens, roughly half a cent. `MOCK=1` exercises every path of the harness without a network call.

### Method

Judgment ran in two modes over the same triples, rendered as structured state `{ intent, action, result, note }` with the harness error flag as context rather than verdict, on the terms `judgment-v4.js` gives it. Choice mode asked one three-way `choice` with the v4 verdict definitions condensed into criteria descriptions. Decomposed mode asked three nouls (`met`, `open`, `contradict`) and derived the verdict in code: contradiction at or above 0.5 gives diverged; otherwise met gives achieved; otherwise open gives failed; otherwise diverged. Recognition asked one noul per index record ("would reading this record now change what the agent does next"), all sharing the situation as state, with the sidecar's `MAX_RECORDS` cap of three mirrored and the keep threshold swept at 0.3, 0.5 and 0.7.

### Results

Judgment scored 10 of 13 in both modes, under the floor. Recognition placed the gold record first, out of 46, in 12 of 12 positive situations; no fixed threshold met both floors at once.

| n | expected | choice | decomposed | met | open | contradict |
|---|----------|--------|------------|-----|------|------------|
| 1 | diverged | achieved (miss) | achieved (miss) | 0.59 | 0.12 | 0.38 |
| 2 | failed/diverged | achieved (miss) | diverged | 0.80 | 0.89 | 0.57 |
| 3 | achieved | achieved | achieved | 0.88 | 0.04 | 0.15 |
| 4 | achieved | achieved | achieved | 0.89 | 0.14 | 0.35 |
| 5 | diverged | failed (miss) | diverged | 0.72 | 0.95 | 0.82 |
| 6 | achieved/diverged | diverged | diverged | 0.14 | 0.10 | 0.84 |
| 7 | achieved | achieved | diverged (miss) | 0.94 | 0.94 | 0.61 |
| 8 | diverged | diverged | diverged | 0.63 | 0.10 | 0.71 |
| 9 | failed | failed | diverged (miss) | 0.22 | 0.99 | 0.83 |
| 10 | achieved | achieved | achieved | 0.95 | 0.04 | 0.13 |
| 11 | achieved | achieved | achieved | 0.91 | 0.04 | 0.19 |
| 12 | diverged | diverged | diverged | 0.45 | 0.11 | 0.56 |
| 13 | achieved | achieved | achieved | 0.82 | 0.05 | 0.27 |

| recognition threshold | recall | clean negatives | false pointers |
|---|---|---|---|
| 0.3 | 12/12 | 1/3 | 25 |
| 0.5 | 12/12 | 2/3 | 15 |
| 0.7 | 11/12 | 3/3 | 1 |

The boundary is thin: the weakest gold scored 0.56 (situation 3) and the strongest ghost on a negative scored 0.53 (`warden-ai-evaluated-and-declined`, situation 11).

### Interpretation

The judgment misses concentrate where the v4 prompt spends its effort. Cases 1 and 5 are the cut-evidence cases: the result stops mid-line before its own confirmation, and the right verdict rests on reasoning that what the judge cannot see is unknown rather than absent. That is reasoning about absence, the paragraphs v4 exists to teach, and it is System 2 work behind a small answer. Case 2 (an open `NO TRANSCRIPT` on a zero exit) was choice mode's one bad miss. Case 7, the trap-shaped-but-honest reading predicted to fool it, passed in choice mode at met 0.94; the inverted-intent understanding is present, and it was the derivation ordering that fumbled cases 7 and 9, not the model. Reordering the derivation retroactively reaches 11 of 13, but that is tuning policy on the test set, a cousin of the regeneration the battery README forbids, and it needs fresh cases to mean anything.

The recognition finding separates two capabilities. Ranking (which record bears most) was flawless. Absolute deciding (whether anything bears at all) is delicate, and the three negatives are where the design work lives. So the port guidance is: trust the ordering, engineer the silence.

Two caveats ride with every number. The adapter's instructions are a condensed paraphrase of v4's semantics, not the measured text, so a miss can be the rendering. And thirteen and fifteen cases direct an experiment; they do not settle an architecture.

## 4. The kit as it stands

Recollection today serves one seam of the turn, retroactively, and the whole sidecar contract exists because the judge is slow.

### The sidecar flow

The capture hook spools every Bash call at PostToolUse. The daemon wakes on a 2 second poll and clears "one to two verdicts a second" against "a few thousand calls a day" from the fleet (`sidecar/daemon.js:177-181`). Recognition runs for every captured call whose project has a memory index, sends the whole index as prompt text under `INDEX_PROMPT_CAP = 32768` characters with a cut index stated as cut (`sidecar/prompts/recognition-v1.js:60`), and names at most `MAX_RECORDS = 3` records. The pointer lands in the session's inbox, and the valve emits it "through the same hook, one tool call later" (`plugins/claude-kit/hooks/kit-sidecar-capture.js:14-16`). So a pointer about call N cannot reach the model before the result of call N+1, and under queue depth it is later. Judgment (`sidecar/prompts/judgment-v5.js`) returns one of achieved, failed, diverged, unproven plus a reason, and its fencing, nonces and partial-input paragraphs exist because an instruction-following judge reads text written by the party it judges.

### The seams of a turn

A Claude Code turn is prompt submitted, model plans, then a loop of PreToolUse gate, tool run, PostToolUse, result into context, then the reply. Hooks inject text at each seam, and recollection is only useful when it lands at one. Today's design serves the tool-result seam one or more calls late. A recognizer at Jev's latency can serve three seams the daemon cannot: PostToolUse synchronously, UserPromptSubmit, and PreToolUse against the proposed command before it runs. Memory before the mistake is prevention; after, it is cleanup.

### The memory database destination

The memory database plan (`claude-kit_memory-database_spec_v1.md`) builds the scaling recall stage the sidecar lacks: a SQL Server 2025 `mem` schema, per-chunk `VECTOR(1024)` embeddings from one host embedder, the usage and outcome journals written database-first with a local spool, and a curation surface, all behind EXECUTE-only procedures per role. `mem.usp_Search` is a hybrid ranker returning a quantized `[distance]`, with `@p_Limit` defaulting to 10. Its section 4 serves `memq find`'s semantic channel from it, leaves the judged channel and the merge rule unchanged, and adds a `fleet memory` block to `memq recall` and to session start: ten nearest by vector, five lines at session start, under a two second budget after which the block is omitted with one line. Every database consumer degrades to the local path with a stand-down line.

## 5. Applications

Ranked by how much the surface's own constraints favor Jev.

### A. The fleet memory blocks (adopted)

The session-start and `recall` fleet blocks are the surface where Jev is an enabler rather than an optimization, because the two-second budget is why those blocks ship unjudged. A Jev pass over the shortlist fits inside the existing budget, and the block can then say "records that bear on this project's recent work" instead of "records whose vectors are close".

Wiring: after `usp_Search` returns its rows at a raised limit, compose the situation from what the block already embeds (project segment name plus the three most recent outcome action keys) and ask one noul per candidate:

```json
{
  "state": "<the composed situation text>",
  "model": "jev-latest",
  "questions": {
    "r0": {
      "type": "noul",
      "instructions": {
        "question": "The state describes what an AI coding agent is doing or just observed. Would reading the memory record below, right now, change what the agent does next? Most situations match zero or one records; do not invent relevance.",
        "record_title": "<title>",
        "record_description": "<index-line description>",
        "record_status": "<live | archived | superseded>"
      },
      "criteria": {
        "true": "Reading this record now would change what the agent does next.",
        "false": "This record does not bear on the situation."
      }
    }
  }
}
```

Names and descriptions only; bodies never leave the LAN. The run's boundary suggested a top-1 floor near 0.55 and a further-candidate floor near 0.7, both to be re-measured on the fleet store before they are trusted. Pass the record's status into the question rather than letting the procedure's archived and superseded multipliers silently crowd a live record out of the top-K the judge sees. Fallback is the plan's own convention: the distance-ordered list with one stand-down line.

### B. The judged channel in `memq find` (declined)

Swapping Jev into the judged channel's seat changes interactive latency from seconds to about 150 ms and costs the judge's prose reasons. Because `find` is an explicit command whose user reads the output, the reasons have value there. The operator declined a flag on 2026-09-20.

### C. Sidecar recognition, staged (deferred)

With the store on the host, the daemon composes the situation from the captured triple, embeds it, calls `usp_Search` at a limit of 30 to 50, and asks Jev the per-candidate nouls from A. Delivery keeps `MAX_RECORDS = 3` and the inbox contract. The second cut moves recognition onto the seams, PostToolUse synchronous first, then PreToolUse once the false-pointer rate at the chosen threshold is trusted, because a gate that interrupts on a 0.53 ghost is exactly the cost `recognition-v1.js` warns about. Volume at a few thousand calls a day, at roughly 7,000 input tokens per recognition, is $0.60 to $1.50 per day. Deferred until a month of outcome rows exists.

### D. Judgment stays local (declined)

The battery says why: under the floor, and its misses were the cut-evidence cases the v4 prompt's partial-input paragraphs exist to handle. Two things carry forward. Jev dissolves the injection class that v4's nonces and fencing defend against, because a model with no instruction channel cannot be told to follow one. And the decomposed-noul form gives a calibrated confidence per failure mode, which the delivery valve could use. If judgment is ever re-tested, extend `judgment-v1` with fresh harvested cases first.

### E. The calibration loop (adopted)

The plan's database-first journals are the instrument that makes every threshold above measurable. If a delivered pointer's subsequent `memq get`, or its absence, lands in the outcome journal keyed to the recognition that delivered it, then "does Jev's 0.8 mean 80 percent on this store" is a query, the operating point in A becomes an empirical setting, and the logged candidates give a retrospective comparison of cosine floor versus Jev without touching a live surface. The same rows are the training-set shape a kev-style local model needs if the LAN-only stance ever hardens.

### Constraints and risks

- Off-LAN dependency: a Jev call is the first hop in these paths that leaves the host network. Against that, the embedder and the Qwen instance contend for one GPU, and every judgment moved to Jev is VRAM returned.
- Retention: TypeSafe states no fixed deletion window; an email to privacy@typesafe.ai asking the actual retention of `/v1/systemone` request bodies would say more than the policy does.
- No reason text: every application loses the one-sentence "why" the local judge writes.
- Silent miss in staged retrieval: a record `usp_Search` fails to surface is invisible to the judge. Over-fetch, the hybrid lexical lists, and a periodic recall audit against hand-labeled situations are the defenses.
- Thin boundary: the run's positive-versus-negative separation at the decision floor was three probability points over three negatives. More negatives are needed before any threshold is trusted at a seam that can interrupt.
- Index-in-questions cost: each candidate costs about 150 input tokens per call, so cost scales with K, not with the store.

## 6. End result

Jev is not a search engine and does not replace the store's recall stage; the memory database plan builds that stage, and the cosine floor it leaves as the decider is the seat Jev fits. On the sidecar's own batteries Jev ranks a shortlist correctly every time and judges a tool call's outcome worse than the local prompt does, so recollection is the port and judgment is not.
