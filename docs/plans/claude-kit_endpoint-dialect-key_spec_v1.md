# The memory search's judged ranking speaks the endpoint's declared dialect, and a refusal names the path it hit

Status: Ready
Commit Model: Commit-and-Push
Created: 2026-09-04

Session model: any executor session in the kit repo; two sections in order, since section 2 documents the behaviour section 1 lands. Authored by the KIT: Expert seat on a defect the NEO-CLAUDE machine coordinator seat captured to the kaizen inbox (kaizen/notes-NEO-CLAUDE.md, the 2026-09-04 note on the dropped dialect key) and the operator forwarded at the keyboard. Anchors are authoring-time and named by function; re-locate every hit by content.

## Dispatch Authorization

Authorized 2026-09-04 by the operator at the keyboard of the KIT: Expert session, as a defect fix to be appended to the kit worker's armed queue immediately behind the plan in flight, the grant covering any session holding this plan. The Expert seat authored the spec and the operator's own typed append is the arming, so author and citer are different parties.

## Goal

`memq find` has a third, model-judged ranking block that sends the query and the candidates the lexical and semantic blocks ranked to the machine's configured model endpoint. On every machine whose endpoint speaks only the OpenAI chat-completions dialect, which is both machines of this fleet today, that block has never worked: its one call into the shared endpoint library hands over a hand-built config object carrying url, model and timeout and no dialect, the library falls to its ollama default, posts an ollama-shaped body to the ollama generate path, and the gateway answers 404. The failure is shaped to be unreadable, because the library's liveness probe fetches the bare base URL, which any gateway answers, and the refusal prints as a bare `HTTP 404` naming neither the path posted to nor the dialect chosen, so it reads as the endpoint being down. When this plan is done: the judged call speaks the dialect the config declares, a `memq find` on this box prints a model-judged block against the live endpoint, a refusal from the transport names the HTTP status, the path it posted to and the dialect it chose, and the two documents that describe the endpoint handoff describe the behaviour that ships.

## Evidence

- `plugins/claude-kit/scripts/memq.js`, `judgedChannel`: `client.loadEndpointConfig()` returns a config carrying `api`, and the `client.postGenerate(request, { url: config.url, model: config.model, timeoutMs: JUDGED_CALL_TIMEOUT_MS })` call beside the endpoint-fingerprint note drops it. `config.api` is read nowhere in memq.js.
- `plugins/claude-kit/scripts/kit-endpoint-lib.js`, `postGenerate`: `const api = (config && API_FLAVORS.includes(config.api)) ? config.api : DEFAULT_API;` with `DEFAULT_API = 'ollama'` and `GENERATE_PATHS = { ollama: '/api/generate', openai: '/v1/chat/completions' }`; the non-2xx branch returns `{ status: 'refused', detail: 'HTTP <status>' }` and nothing about the path or dialect. `probeEndpoint` fetches `config.url` itself and reads any answer as ok, dialect-blind by design.
- The same library's config parser reads `api: openai` correctly, case and whitespace forgiven, and defaults silently to ollama when the key is absent; the parser is not the defect.
- Every other caller passes the loaded config through whole: `sidecar/judge.js` and `sidecar/recognize.js` call `endpoint.postGenerate(request, config, deps)` with the object `loadEndpointConfig` returned, so the sidecar daemon speaks the declared dialect and is unaffected. memq's judged block is the sole caller that rebuilds the config object by hand.
- Probed from this box on 2026-09-04 against the configured endpoint, which declares `api: openai`: `GET /v1/models` 200 listing the configured model, `POST /v1/chat/completions` 200 with a completion, `POST /api/generate` 404, `GET /api/tags` 404, every response carrying a `llama.cpp` server header. The NEO-CLAUDE coordinator reports the same four readings from its box. The operator-tier record `the-host-endpoint-speaks-only-the-openai-dialect` holds the endpoint's current shape.
- Tests: `test/kit-endpoint-lib.test.js` covers dialect translation and path selection at the library level, `api: openai` included, against a real loopback `node:http` server; `probeEndpoint` has no test of its own. `test/memq.test.js` drives the judged block as a black box through a fixture `~/.claude/kit-endpoint.json` and a loopback server, and no test there configures `api: openai` or asserts on the chat-completions path, so the defect is invisible to the suite as it stands.

## Approach

Hand the loaded config through, as the daemon's callers already do. The call site passes the object `loadEndpointConfig` returned with only the timeout overridden, so a key the library reads today or later cannot be dropped by a hand-built literal; that is the durable shape, where adding `api:` to the literal fixes this key and re-arms the class. The transport's refusal grows the two facts a reader needs to place a 404: the path it posted to and the dialect it chose, so memq's existing degrade line, which carries the transport's detail verbatim, reads `endpoint refused the call: HTTP 404 from /api/generate (ollama dialect)` against an OpenAI-only gateway, which is a misconfiguration a reader can act on rather than an endpoint that looks dead. The probe stays as it is. It answers whether a transport is there, any answer counting, and a probe that fetched a dialect's listing path would stand the block down on a gateway that serves chat completions and no model list; the dialect mismatch is the call's to report, in one line, and after this plan it is. The config parser stays as it is too: `api` remains optional with the ollama default, which older configs rely on, the documents describe, a test pins, and the daemon shares.

No contract sweep was needed: the dialect is read in exactly one function, the library's `postGenerate`, and its callers are the three named under Evidence, found by a repository grep for `postGenerate(` that the scout ran and this seat re-ran.

## Decisions

Decided 2026-09-04 by the Expert seat; reversible at arming.

1. **Pass the loaded config through rather than adding the missing key to the literal.** The defect's class is a hand-built object dropping a key the library reads; only the first shape closes the class. The daemon's two callers already take it.
2. **The transport's refusal names path and dialect; the probe is unchanged.** The probe's any-answer contract is deliberate liveness and gains its first direct test as a pin. Naming the path at the refusal is what makes a dialect mismatch legible, and it costs one string.
3. **`api` stays optional with the ollama default; no refusal of a config that omits it.** The NEO coordinator's note suggested refusing such a config. Refusing would break every older config, stand the daemon down on the same loader, and contradict the architecture document's description of the key as optional, to catch a case the named refusal now makes legible in one line. Reversible by a later plan if a fleet ever runs a mix of dialects behind bare configs.

## Sections of Work

### 1. The judged call forwards the loaded config, and a refusal names its path and dialect. Model: opus

In `memq.js`'s `judgedChannel`, replace the hand-built second argument to `client.postGenerate` with the loaded config object carrying `timeoutMs: JUDGED_CALL_TIMEOUT_MS` as its one override, and leave the request object as it is. In `kit-endpoint-lib.js`'s `postGenerate`, make the non-2xx refusal's `detail` read `HTTP <status> from <path> (<dialect> dialect)`, the path being the one `generatePath(api)` chose and the dialect the resolved `api`; every other field of the result is unchanged, and `probeEndpoint` is unchanged. Check that memq's `sanitize` keeps the slash and the parentheses in that detail, since the degrade line is where the reader meets it, and adjust the wording rather than the sanitizer if it does not.

Tests, each watched red before the fix and green after, on the harnesses the two files already use. In `test/memq.test.js`: a judged-block run whose fixture config declares `api: openai` lands its ranking call on `/v1/chat/completions` with a chat-shaped body (`messages` present, the memq request's `system` and `prompt` folded into it) and prints the model-judged block, where before the fix the same fixture's request lands on `/api/generate`, which is the red; and a fixture whose server answers 404 on the generate path prints the degrade line carrying the path and dialect, so the mismatch reads as one. In `test/kit-endpoint-lib.test.js`: the refusal detail for a non-2xx under each dialect names the status, that dialect's path and the dialect; and one direct `probeEndpoint` test pinning that a non-2xx answer on the base URL still reads as ok, since nothing pins that contract today and this section touches its neighbour. The existing test asserting the default path stays green; it pins Decision 3.

Live acceptance on this box, run by the implementer since the endpoint sits on the VM switch: `memq find <any term>` from the kit checkout prints a model-judged block above the lexical and semantic ones, where before this section it printed `memq: model-judged ranking off (endpoint refused the call: HTTP 404); the lexical and semantic blocks are unchanged`. If the endpoint is down at that moment the degrade line names a probe failure rather than a refusal, and the section records that reading and the reason instead of the block.

Files in scope: `plugins/claude-kit/scripts/memq.js`, `plugins/claude-kit/scripts/kit-endpoint-lib.js`, `test/memq.test.js`, `test/kit-endpoint-lib.test.js`, and `test/size-budget.json` where it exists on main, since both test files gain lines and the size ratchet caps every tracked test file at its current line count with no slack, so each cap is raised in this section's own diff.

Tests: lock the dialect handoff in both directions (an `api: openai` config reaching the chat path, the bare config still reaching the generate path), the refusal wording under each dialect, and the probe's any-answer contract; the expensive failure is the silent one this plan exists for, a healthy gateway reading as dead.

### 2. The documents describe the handoff that ships. Model: sonnet

`docs/architecture.md`, the paragraph describing `kit-endpoint.json` and its optional `api` key and the sentence after it stating that the daemon and `memq find`'s judged channel reach the endpoint through one shared client: state that every consumer hands the loaded config through whole, so the dialect the key declares is the dialect every call speaks, and that a refusal names the path and dialect it used. `docs/security-model.md`, the memq relevance channel section: where it describes the probe-then-call sequence and the degrade line, add the one sentence that a transport refusal names its path and dialect, and that the probe stays dialect-blind because it answers liveness alone. Both edits state the current behaviour and carry no account of the defect. `docs/backlog.md` gains nothing; the kaizen note that raised this is dispositioned by the kaizen pass, which cites this plan.

Files in scope: `docs/architecture.md`, `docs/security-model.md`.

## Out of Scope

- Refusing a config that carries url and model but no `api` (Decision 3).
- A dialect-aware probe (Decision 2).
- The host-side Ollama watchdog the kit ships under `sidecar/`, which probes the Ollama generate path on the endpoint host and cannot answer against a llama.cpp server; that is host state the operator holds, recorded in the operator tier's endpoint record.
- The judge request's missing `num_ctx` (backlog, 2026-09-01) and every other behaviour of the llama.cpp server itself.
- The memory-system skill's text, which describes the judged block's degrades without naming the `api` key and stays correct as written; adding the key there would spend a cap raise under the size ratchet for a sentence the architecture document already carries.

## Assumptions

- assumed 2026-09-04 (default): Commit-and-Push, the kit's default and the model every other plan in the worker's queue runs under; reversal: a header edit before arming.
- assumed 2026-09-04 (source: the size-ratchet section of `claude-kit_subtraction-bars_spec_v1.md`, in the worker's tree at authoring and not yet on main): `test/size-budget.json` will be on main before this plan runs, so section 1 raises the two test files' caps in its own diff; reversal: where the budget file is absent when section 1 runs, the cap clause is moot and the section says so in its Chapter.
- assumed 2026-09-04 (source: the scout's read of both test files, re-checked by this seat for the memq harness shape): the memq judged-block tests are black-box CLI runs against a loopback server keyed by a fixture config, so the new tests take that shape rather than dependency injection; reversal: none, a harness choice.

## Operator Verification

None. The live acceptance in section 1 is runnable by the implementer from this box.

## Open Questions

None.

## Related

- `docs/archive/claude-kit_judge-partial-input_spec_v1.md`: the sidecar daemon shares the endpoint library this plan touches and is the caller that passes the config through correctly.
- The kaizen inbox note dated 2026-09-04 in `kaizen/notes-NEO-CLAUDE.md` on the dropped dialect key, which this plan dispositions.

## Chapters
