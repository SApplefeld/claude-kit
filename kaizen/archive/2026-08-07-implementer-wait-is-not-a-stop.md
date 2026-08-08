# Kaizen brief: name the lever that turns an implementer's wait into a stop

Friction: an implementer agent ended its turn three times to await its own background suite and burned about an hour. All four implementers already carried "never end your turn with a gate still running", so the discriminating fact is that more prose saying the same thing would not have helped. The agent obeyed a tool: the Bash tool's `run_in_background` parameter is documented to keep a command running across turns and re-invoke the caller when it exits, so reaching for it ends the turn by design. The skill named the outcome to avoid and left the mechanism that produces it unnamed, and the mechanism is what the agent reached for.

Change:
- `plugins/claude-kit/agents/implementer-haiku.md`, `implementer-sonnet.md`, `implementer-opus.md`, `implementer-fable.md`: step 4 names the lever. Background at the shell, never with the Bash tool's `run_in_background` parameter, because that parameter is defined to end the turn and re-invoke, converting a wait into a stop. States the working mechanism concretely (redirect to a log, background with `&`, poll with `until` in the same turn), carries the controller's "a wait is not a stop" phrasing, and closes with the red-flag phrases an agent writes immediately before doing it.

Acceptance: each implementer's step 4 names `run_in_background` as the wrong lever and the shell-plus-poll pattern as the right one; the four files stay identical in this passage; the red-flag list matches the phrasing shape executing-work uses for the controller.

Discipline: follow writing-skills. The failure was specificity rather than discipline, so the fix names the mechanism instead of adding a rationalization table to a 36-line agent file. RED not reproduced in this pass: the prohibition already existed and its failure is recorded from a live session, so the change stands on naming the unnamed lever rather than on a fresh red/green.
