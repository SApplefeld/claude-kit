# The PIANO substrate: loops outside the main thinking loop

Status: Direction, recorded 2026-09-03
Kind: Direction note, not an executable spec

## The direction

The operator's long-horizon aim, stated in the 2026-09-03 design dialog: a harness that runs several loops on different timers beside the main thinking loop, in the shape Project Sid's PIANO layer takes. Fast loops react to immediate changes or requests and can cancel or redirect a long-running task. Slow loops set goals, measure against them, redefine them, and create, curate and refine memory. All of them sit outside the loop the harness runs today. Sub-second reaction is not the aim. The judgment sidecar with a local Qwen model under llama.cpp was the first probe, and it worked. The recommended next step was the Claude Agent SDK as the host for external loops, keeping the CLI and the existing harness intact.

This runs after the current improvement cycle (the subtraction bars, the test audit, the corpus audit and its follow-on cut). Signal: the armed queue and that cycle drain.

## What already exists in this shape

The kit runs a proto-PIANO today, and naming its loops with their cadences is the starting inventory:

| Loop | Cadence | What it does | Authority |
|---|---|---|---|
| Judgment sidecar | per tool call | judges each completed call against its stated intent, points at memories | advises, as a PostToolUse context block |
| Compaction gate | per compaction offer | defers compaction until a chapter boundary | denies, by PreCompact exit 2 |
| Seat-stop hook | per turn end | heartbeats the registry, declares boundaries | writes the registry |
| claude-swap autoswitch | one minute | vacates an account nearing its threshold | acts, outside the harness |
| Discord broker usage card | mirrors ten- to thirty-minute polls | reports meters to the operator | reports |
| Coordinator reconciliation | per pass | reads the board and roster, prunes exited entries | writes the board |
| Memory decay | fourteen days | retires unread memories | writes the store |
| Kaizen pass | on signal | dispositions captured friction | writes the kit |

Every loop that touches the main thread advises it. None redirects it. The main loop is the only actor, and that is the doctrine's precedence ranking working as written: nothing below the operator's live word steers a session.

## The questions the design has to settle first

1. **Authority.** A fast loop that cancels or redirects is a new steering surface. The doctrine ranks the harness's own lines, then the operator's live word on a warranted channel, then positional grants. A module's redirect has to sit in that ranking, and the existing vehicle is the standing-grant rail in the role skill: the operator's standing authorization for a named module to interrupt on named conditions, read at the act. This is a brainstorm-first question, and a design-council candidate, because it is expensive to undo once modules can act.
2. **The bottleneck.** PIANO's modules share one bounded state the controller reads. The kit already has it: the goal state file, the board, the memory store, the sidecar spool, all read by the harness at SessionStart and PreToolUse. A v0 needs no new store, only a stated contract for what each loop may write there.
3. **Cancel without the SDK.** A PreToolUse hook can deny with a reason the model reads, which is a cancel at tool granularity, and the compaction gate already uses the same mechanism. So a fast loop that cancels or redirects at the next tool call is reachable on hooks alone. What hooks cannot do is inject a new goal mid-turn without waiting for a tool call, or host several sessions as modules of one organism. Those are the SDK's, and the split decides how much of the vision needs the SDK at all.
4. **Cost.** The archived operating-model spec recorded that SDK-hosted turns were API-billed end to end while in-session subagents stayed on the subscription. If that still holds, every outer loop hosted by the SDK pays per token on the API rather than on the plan's meters, which is why the local model carried the sidecar. Verify before designing around it; the note is from July and may be stale.
5. **SDK mechanics to verify.** Streaming-input mode for injecting messages into a running session, an interrupt call that stops the current turn, and programmatic hooks. Stated here from memory, not from a page read this session.

## Related

- `docs/archive/claude-kit_judgment-sidecar_spec_v1.md`: the first organ, and the spec that named this substrate as the separate future effort.
- `docs/archive/claude-kit_operating-model_spec_v1.md`: the SDK billing note under question 4.
- `plugins/claude-kit/skills/role/SKILL.md`: the standing-grant rail that question 1 would extend.
