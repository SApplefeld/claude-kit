# corpus-compression

`workflow.mjs` is the one dispatch path for the corpus-compression plan (`docs/plans/claude-kit_corpus-compression_spec_v1.md`). It runs under the Workflow tool by `scriptPath` and never through the Agent tool, since the Agent tool cannot set effort.

## Pacing

The script's constants are the only places a model, an effort or a pool size is written:

| Constant | What it sets |
|---|---|
| `MAX_OPEN` | the most agents open at once across the whole run, at most five |
| `MAX_TRACKS` | the most documents whose waves run at once, at most three |
| `REVIEW_MODEL`, `REVIEW_EFFORT` | every reviewer |
| `DRAFT_MODEL`, `DRAFT_EFFORT` | the drafter, keyed by the config a wave names |

The two drafting configs are `opus-medium` and `fable-low`, the pair the pilot's bake-off compared; the operator named `opus-medium` the drafter. A wave's optional `track` names the document it belongs to. Waves in one track run in order, each settling before the next starts, and waves with no track share one track. `test/corpus-compression-workflow.test.js` fails where an `agent()` call lacks a model or an effort, where `MAX_OPEN` exceeds five or `MAX_TRACKS` three, where a wave starts before the previous one in its track settles, or where either ceiling is passed.

## Running it

Pass the waves as `args`:

```json
{
  "waves": [
    { "id": "doctrine-draft", "track": "doctrine", "kind": "draft", "config": "opus-medium", "prompt": "..." },
    { "id": "doctrine-review-1", "track": "doctrine", "kind": "review", "round": 1, "reviews": [
      { "agentType": "claude-kit:prose-reviewer", "prompt": "..." },
      { "agentType": "claude-kit:blind-reader", "prompt": "..." }
    ] }
  ],
  "done": ["doctrine-draft"]
}
```

Every wave is checked before the first dispatch, so a malformed list dispatches nothing. The main thread writes every prompt, and authors a blind reviewer's prompt as its own literal sharing nothing with a sighted one. The script cannot check that, since prompts arrive in `args`. A review wave may name only the reviewer types in `REVIEWERS`, each governed by the read-only guard. The drafter is `claude-kit:corpus-drafter`, also read-only.

The Workflow tool evaluates the file as an async body with `agent`, `log`, `phase` and `args` in scope, and the top-level `return` is the run's result.

The script returns each wave's text and writes nothing. A failed agent comes back as an error entry in its wave. Its track stops after that wave, the other tracks run on, and the run returns every wave that finished. Where the whole run is killed, each finished agent's text is in the run's `journal.jsonl`, under the `result` field of its line. The main thread saves what it keeps under `.kit/scratch/corpus-compression/`, and reads the capacity meter before and after each run, since tracks interleave inside one. A Workflow script cannot read the disk, so on a resume the main thread lists in `done` the id of every wave whose artifact it already saved, and the script skips those waves. A `done` id that names no wave in the list is refused, so a mistyped id never re-dispatches a finished wave.
