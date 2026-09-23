# jev-recognition-v1

A hand-labeled battery that measures TypeSafe's Jev model as the judge between the fleet memory store's search shortlist and the fleet memory block. `run.js` asks Jev about the top thirty records `usp_Search` returns for each situation and reports where the scores of the records that bear separate from the scores of the records that do not. The two floors the fleet block's judge uses are ruled from that separation, so the cases here are frozen on the same terms as the other batteries in this directory: nobody may regenerate a case, a label or a situation text from a run.

## situations.json

Twenty-five situations: thirteen positive and twelve true negatives. Each row carries:

- `n`, the situation's number, unique in the file.
- `situation`, a hand-written summary of what an agent is doing, in `recognition-v1`'s register.
- `composed`, the same situation as the fleet block composes its state: the project segment name and three action keys, joined with single spaces.
- `gold`, the names of every record in the fleet store that would change what the agent does next, empty for a true negative.

Every situation is written by hand from this fleet's recent session transcripts and sidecar capture spool lines, and none is a verbatim spool line or transcript excerpt. Every `composed` names the `D--claude-kit` segment, whose checkout path this repository already publishes. A segment naming a repository that is not published here stays out of the file, as does a record whose name carries a machine or account name.

## The labeling discipline

A label is decided from the situation text and the store's own record names and descriptions, before Jev has scored the situation. The question a label answers is the one the harness asks: would reading this record now change what the agent does next. Where the store holds two or more records carrying one lesson, every one of them is gold.

A true negative is a realistic situation where nothing in the store bears, including near-miss topics that share vocabulary with a stored lesson. A negative is checked by hand against its whole top thirty in both shapes. A negative that any record in its shortlist bears on is rewritten rather than kept.

A gold record that `usp_Search` does not place in a situation's top thirty is kept as labeled. The run reports it as a stage-1 miss, since a record the shortlist never shows is a fact about stage 1 and not a reason to change the label.

The executing session writes the labels, and the operator confirms them before any run's numbers are read. A label is revisable only on evidence a reader can see in the case text and the store. A run's scores are never that evidence, since a label changed to agree with a run proves nothing about the judge.

The harness refuses a case file holding fewer than ten true negatives, since the boundary reading is a separation over negatives and a handful of them settles nothing.

## What the run reports

For each shape, composed first: per situation, the gold record's stage-1 rank, its rank by judge score, its score and the strongest non-gold score; then recall over the positives and clean negatives at 0.3, 0.5 and 0.7, the weakest gold score, the strongest ghost score on a negative, the stage-1 misses, the request count and the input tokens. A positive's gold score is its best-scoring gold record. A negative is clean at a threshold when every candidate scores below it.

## Running it

From the repository root:

```
TYPESAFE_API_KEY=<key> node sidecar/batteries/jev-recognition-v1/run.js
MOCK=1 node sidecar/batteries/jev-recognition-v1/run.js
```

`TYPESAFE_API_URL` points the run at another endpoint, https or a loopback host. `--cases <file>` scores another case file. `MOCK=1` runs every stage against in-process stand-ins, with no network call and no database call, and `test/jev-battery.test.js` runs that path. The per-candidate results go to `.kit/jev-battery/` under the working directory.

WHERE THE DATA GOES. A live run sends every situation's text, and each candidate record's name, description and status, off this machine to the vendor's endpoint. Record bodies are never sent. `docs/security-model.md` states what the vendor holds and on what terms. Stage 1 runs on the memory database host through the kit's own client, and it sends each situation's text to the host's embedder.

This directory does not ship with the kit plugin, since `sidecar/` sits outside `plugins/claude-kit/`.
