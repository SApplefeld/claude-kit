# corpus-compression

`workflow.mjs` is the one dispatch path for the corpus-compression plan (`docs/plans/claude-kit_corpus-compression_spec_v1.md`). It runs under the Workflow tool by `scriptPath` and never through the Agent tool, since the Agent tool cannot set effort.

## Pacing

The script's constants are the only places a model, an effort or a pool size is written:

| Constant | Value | What it sets |
|---|---|---|
| `MAX_OPEN` | 3 | the most agents a review wave holds open |
| `REVIEW_MODEL`, `REVIEW_EFFORT` | `fable`, `low` | every reviewer |
| `DRAFT_MODEL`, `DRAFT_EFFORT` | keyed by config | the drafter, per the config a wave names |

The two drafting configs are `opus-medium` and `fable-low`, the pair the pilot's bake-off compares. Waves run in order, and each settles before the next starts. `test/corpus-compression-workflow.test.js` fails where an `agent()` call lacks a model or an effort, where `MAX_OPEN` exceeds five, or where a wave starts before the previous one settles.

## Running it

Pass the waves as `args`:

```json
{
  "waves": [
    { "id": "doctrine-draft-fable", "kind": "draft", "config": "fable-low", "prompt": "..." },
    { "id": "doctrine-review-1", "kind": "review", "round": 1, "reviews": [
      { "agentType": "claude-kit:prose-reviewer", "prompt": "..." },
      { "agentType": "claude-kit:blind-reader", "prompt": "..." }
    ] }
  ],
  "done": ["doctrine-draft-opus"]
}
```

The main thread writes every prompt. A blind reviewer's prompt is authored as its own literal and shares nothing with a sighted one. A review wave may name only the reviewer types in `REVIEWERS`, each governed by the read-only guard. The drafter is `claude-kit:corpus-drafter`, also read-only.

The script returns each wave's text and writes nothing. The main thread saves what it keeps under `.kit/scratch/corpus-compression/`. A Workflow script cannot read the disk, so on a resume the main thread lists in `done` the id of every wave whose artifact it already saved, and the script skips those waves.
