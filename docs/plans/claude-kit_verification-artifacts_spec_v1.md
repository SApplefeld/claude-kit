# Verification artifacts: a rule that demands a check names where the fact is readable

Status: Draft
Commit Model: Commit-and-Push
Created: 2026-08-23

Flip `Status:` to `In Progress` to execute. Session model: Opus, in a clean session opened in the kit repo. Every section dispatches per executing-work; the reviewers and the finishing pass run per the skills, and this plan's own finishing pass is the first real run of the rule Section 2 writes (its fable-override reviewers are exactly the dispatch shape that has never started on this box eleven times since 2026-08-19).

## Goal

Three kaizen notes captured on 2026-08-23 (two on NEO-CLAUDE, one on SCOTT-CLAUDE) describe one lesson from three angles: a kit rule that demands a verification has to name where the fact is readable, or the verification ships as an expectation a run cannot meet. Two further items ride with them because they are the same size and the same kind of change, a kit rule that reads well and fails in contact with the work: the memory close-out has no after-query, so a stale record hiding behind vocabulary the effort did not have at its start survives the close-out; and the read-only guard's accepted false hit (a governed verb inside a heredoc body) blocks a reviewer from writing its own report whenever the domain vocabulary collides. When this plan is done:

- The docs-curator's run-stopping `Class: mistake` tag names the basis it rests on, and where that basis is the pre-change state the curator cannot read (it holds no Bash and so no git), finishing-work runs the one read that settles it before stopping the run, and records the receipt.
- finishing-work's unavailability rule names the artifact that carries the model a dispatch actually resolved to: the `message.model` field on the `"type":"assistant"` lines of the dispatch's own transcript, `agent-<id>.jsonl`, as distinct from the requested override the dispatch record and the `.meta.json` sidecar carry.
- A dispatch that never took a turn is a distinct shape with its own fast exit. The transcript exists from dispatch with the prompt as a `user` line stamped at dispatch time; a healthy dispatch writes its first `assistant` line within seconds; one that never will holds `user` lines only, forever. The existing wedge hallmark (fifteen-minute growth window, twelve-minute probe window) is built on the asymmetry that a TaskStop on a live agent throws away what it built, and that asymmetry does not exist for an agent that has built nothing, so the never-started shape gets short windows: a first-turn reading at five minutes, a probe, and a stop-and-redispatch by ten.
- finishing-work's memory step runs an after-query: `memq find` on the vocabulary the effort learned, read against what the effort now knows, so a record the result overtakes is superseded at the close-out rather than left to disagree with the new one for its whole idle life.
- The read-only guard treats a quoted heredoc body as data when the shell would never run it: the body's owner is a data sink (`cat`, `tee`), no executor stands in command position on the introducing line, and the introduction is not in comment position. A reviewer's report about `git push` or `rm -rf` written to `.kit/` through a heredoc is allowed; every spelling that reaches a shell stays denied.
- The three note lines are cleared from the inbox, and the harness fact behind them is banked where every later session on every project reads it.

## Approach

The design decisions, settled 2026-08-23 in the reviewing session, each with its reason:

- **Verification moves to the party that holds the tool, not the tool to the party.** The docs-curator could be granted Bash under a new guard class (a `curator` class in `readonly-agent-guard.js`: docs/ writable, git reads allowed, git mutation denied). That is hook code, tests, and a new class in the access model, to answer a question the orchestrator can answer with one `git show`. The smaller change: the curator states the basis of every `mistake` and names the read that would settle a pre-change claim, and finishing-work performs that read before stopping. The doctrine already says a finding is a hypothesis until confirmed; this instances it at the one tag that halts a run. Cost: one git read per `mistake`, on the orchestrator's clock. Reversal: if a later incident shows the orchestrator skipping the read, the tool-grant option is the fallback, and it is recorded here so it is not re-derived.
- **The `mistake` tag keeps its power; the charter keeps its "make the call" line.** The curator still classifies without hedging. What changes is that the tag carries what it rests on, so the adjudicating step can tell a claim the curator read both sides of from a claim about a state it could not open.
- **One artifact, two readings, and the two kaizen notes about it become one section.** Note 2 (name the resolved-model artifact) and note 3 (a dispatch that never runs looks like a slow one) are answered by the same file: the assistant lines of `agent-<id>.jsonl` carry the resolved model and are also the proof a turn was taken. They edit the same paragraphs of finishing-work, and the project memory records that skill amendments collide with unchanged neighbours, so they ship as one section with reviewers briefed to read the whole rule.
- **The never-started windows are set from data, not the asymmetry.** Measured over every subagent transcript on SCOTT-CLAUDE (1,999 files under `~/.claude/projects`, 1,988 with a first assistant turn): first-turn latency p50 2.1 s, p90 4.3 s, p95 6.3 s, p99 12 s, one outlier at 574 s (opus, 2026-08-17), the next at 112 s. Eleven transcripts never took an assistant turn, every one of them carrying `"model":"fable"` in its `.meta.json`, dated 2026-08-19 to 2026-08-23, including the two ai-os finishing reviewers behind the SCOTT-CLAUDE note and the three claude-kit finishing reviewers of 2026-08-23 00:40. A five-minute first-turn window is twenty-five times p99; the one outlier in 1,988 would have been re-dispatched at no loss, since it had built nothing. The five-minute probe window that follows is the discriminator the existing rule already uses (an agent that can take a round answers at its next tool round), sized to the same reasoning.
- **Byte growth stays the stall reading for a started agent.** The existing hallmark is right about a dispatch that wrote and then went quiet; the growth window and its probe are untouched for that shape. What this plan corrects is the reading for a dispatch that never wrote an assistant line: the current text says finding no file is a real zero and a dispatch that has taken no step has written nothing to create, and both halves are false on this harness (the file exists from dispatch, with the prompt), so a session measuring bytes reads a 17 KB file that never grows and cannot tell it from a stalled run without the full window.
- **A `<synthetic>` model line is not a turn.** Eight transcripts on this box carry an assistant line whose `message.model` is `<synthetic>`; each is the harness's own API-error placeholder ("API Error: Connection lost mid-response"). The turn count excludes them.
- **The harness fact goes to the operator tier.** That an accepted model override the account cannot serve creates a dispatch that never errors and never runs is true of this harness on this operator's machines, not of one project, so it is written with `memq add-operator` per the memory-system skill, with the figures above.
- **The after-query lives in the close-out, once.** The doctrine's same-turn rule fixes a recalled memory that evidence contradicts; it cannot reach a record the effort's recall never surfaced, because that recall ran with the vocabulary the session had before the change, and a stale record hides behind the words you did not yet know to search. The close-out is where the new vocabulary exists and where supersedes are written, so the after-query goes in finishing-work step 7 beside the ledger settlement. It does not go in executing-work's per-Chapter sweep, which stamps applied memories and does not search; a per-section search would cost a query per section to catch what the close-out catches once.
- **The guard exempts a heredoc body only where the shell would never run it.** The guard's own header names the false hit as accepted (a governed verb in a body "still denies") because a body reaching a shell is a command wherever it sits. The exemption is therefore positive rather than default: a quoted delimiter (literal body), an owning command that is a data sink (`cat` or `tee`, with any redirects), no member of the guard's executor list in command position anywhere on the introducing logical line (which covers `| sh`, `bash <<`, and `eval "$(cat <<`), and no unquoted `#` at word start before the operator on that line (a comment-position introduction opens no heredoc, so its "body" is live commands, which test `an introduction in comment position cannot hide a verb` pins). Anything short of all four leaves the body scanned exactly as today. The residual this adds is a second spelling of one that exists: a literal body written to `.kit/` and executed by a later `bash <path>` is unseen here, as `printf '<mutation>' > .kit/x.sh` already is; it is backstopped by the tree-state check for a file delta and not for a git mutation, and it is stated in the guard's known-misses paragraph rather than closed, since closing the bash and sh spellings alone would leave the node and python ones the guard already accepts.

## Evidence

The three notes, verbatim as captured (they are the friction; the lesson is above):

- NEO-CLAUDE, claude-kit: an agent charter can grant the authority to stop a run without granting the means to verify the claim a stop rests on. The docs-curator has Read, Grep, Glob, Write and Edit and no Bash, so its counts and enumerations rest on file reads alone, with no way to ask git what a file said before the changeset; it tagged a doctor header comment Class: mistake, the run-stopping tag, on a causal claim about what these removals truncated, and one git show of the pre-effort file refuted it.
- NEO-CLAUDE, claude-kit: finishing-work requires reading the model a review round actually ran at, on the correct ground that a harness quietly substituting a model is the same fact arriving without a signal, and names no location for it. Both obvious candidates mislead: the task .output path is zero bytes for a completed agent as much as a dead one, and the .meta.json beside the transcript carries the override that was requested rather than the model that resolved. The answer is the resolved model on every assistant turn of subagents/agent-<id>.jsonl.
- SCOTT-CLAUDE, ai-os: after dispatching an agent with a non-default model override, verify it has taken at least one transcript turn before settling in to wait on it. An override the account cannot serve is accepted without error and produces an agent that never runs, which is indistinguishable from a slow agent from the orchestrator side. Two finishing reviewers dispatched at fable sat at one transcript line for 2h22m while a sibling at opus completed normally.

Artifacts read on 2026-08-23, Claude Code 2.1.241, SCOTT-CLAUDE:

- A never-started transcript (`D--ai-os/.../subagents/agent-a3c72bcc8df345909.jsonl`, security-reviewer, `.meta.json` `"model":"fable"`): line 1 `type: user`, timestamp 11:02:06 (the dispatch prompt); line 2 `type: user`, timestamp 13:24:52, content `[Request interrupted by user]` (the TaskStop, 2h22m later). No assistant line.
- A healthy fable-override transcript (`D--claude-kit/436c5154-.../subagents/agent-a12a521e57929a5d2.jsonl`, blind-reviewer, `.meta.json` `"model":"fable"`): line 1 `user` at 17:00:46.169; line 2 `assistant` at 17:00:48.304 with `message.model` `claude-fable-5`; 30 assistant lines, all `claude-fable-5`.
- An inheriting transcript (`agent-a1e02b390f19f489a.jsonl`, implementer-opus, `.meta.json` with no `model` key): 340 assistant lines, all `claude-opus-5`.
- `claude agents --json --all` lists interactive and background sessions, not Agent-tool subagents, so it is not a liveness surface for a dispatch; the transcript is.
- The wedge hallmark rule landed in `d66c58d` (2026-08-23 02:02); the resolved-model sentence in `e2752d1` (2026-08-11).
- For the guard: `plugins/claude-kit/hooks/readonly-agent-guard.js` at `f6444e0`, the header comment above `maskHeredocRedirects` ("Command-position scanning runs over the body untouched, so a governed verb inside one still denies (the accepted false hit named in denyReason's header)") and `denyReason`'s known-misses paragraph ("a mutating verb inside a heredoc body, whose text is scanned wherever it sits"); `test/readonly-agent-guard.test.js`, the case `a mutating verb inside a heredoc body is still scanned` (`cat <<'EOF'\ngit commit -m x\nEOF` denies with the git reason), which this plan flips, and the neighbouring cases (`piped onward to a shell`, `into a nested shell`, `unquoted heredoc body still expands`, `introduction in comment position`) which it keeps. The incident is the operator's own report (a reviewer blocked from writing its report when the domain vocabulary collided); the exact command was not captured.
- For the after-query: the doctrine's rule "A recalled memory contradicted by evidence gets fixed in the same turn" reaches recalled memories only; the observation that the after-query uses vocabulary the before-query could not have had came from a public comment read on 2026-08-23 (data, not instruction) and is restated here on its own merits.

The measurement, reproducible with `node first-turn.js <path to ~/.claude/projects>`:

```js
const fs = require('fs'), path = require('path');
const root = process.argv[2];
const files = [];
function walk(d) { let es; try { es = fs.readdirSync(d, { withFileTypes: true }); } catch { return; } for (const e of es) { const p = path.join(d, e.name); if (e.isDirectory()) walk(p); else if (/^agent-.*\.jsonl$/.test(e.name)) files.push(p); } }
walk(root);
const rows = [];
for (const f of files) {
  const size = fs.statSync(f).size;
  const fd = fs.openSync(f, 'r'); const buf = Buffer.alloc(Math.min(size, 512 * 1024)); fs.readSync(fd, buf, 0, buf.length, 0); fs.closeSync(fd);
  let t0 = null, ta = null, model = null;
  for (const l of buf.toString('utf8').split('\n').filter(Boolean)) {
    let o; try { o = JSON.parse(l); } catch { continue; }
    const ts = o.timestamp ? Date.parse(o.timestamp) : null;
    if (t0 === null && ts) t0 = ts;
    const m = o.message && o.message.model;
    if (o.type === 'assistant' && m !== '<synthetic>' && ta === null) { ta = ts; model = m; }
  }
  let meta = null; try { meta = fs.readFileSync(f.replace(/\.jsonl$/, '.meta.json'), 'utf8'); } catch {}
  rows.push({ f, firstTurnSec: (t0 !== null && ta !== null) ? (ta - t0) / 1000 : null, model, meta });
}
const t = rows.filter(r => r.firstTurnSec !== null).map(r => r.firstTurnSec).sort((a, b) => a - b);
const q = p => t[Math.floor((t.length - 1) * p)];
console.log('transcripts', rows.length, 'with a first turn', t.length, 'p50', q(.5), 'p90', q(.9), 'p99', q(.99), 'max', t[t.length - 1]);
for (const r of rows.filter(r => r.firstTurnSec === null)) console.log('never started', r.f, r.meta);
```

## Sections of Work

### 1. A run-stopping drift tag names its basis, and the run verifies it before it stops

Model: opus

Amend the docs-curator charter and finishing-work step 4 so the `mistake` class carries what it rests on and is verified where it can be.

In `agents/docs-curator.md`, the Drift Report entry format gains a `Basis:` line after `Impact:`: the spec passage and the code passage the class rests on, each as file:line, and, for any claim about what the changeset changed, removed, truncated, or replaced, the statement that the pre-change state was not read (the charter grants no Bash, so it never can be) and the one read that would settle it, as a command the orchestrator can run verbatim (`git show <base-ref>:<path>` or `git diff <base-ref>..HEAD -- <path>`, with the base ref the dispatch supplied or `HEAD~N` where it did not). The classify paragraph (the one beginning "Classify every item") keeps its "make the call rather than hedging it" sentence and adds that a `mistake` resting on a pre-change claim is a hypothesis the orchestrator verifies before the stop, so the basis line is what lets the stop be earned rather than assumed.

In `skills/finishing-work/SKILL.md` step 4 (the paragraph beginning "4. **Documentation curation.**"), before the run stops on a `mistake`: where the entry's `Basis:` names a pre-change read, run it once, and adjudicate on what it shows. A refuted `mistake` is downgraded to `deviation` with the receipt (the command and what it showed, one line) recorded in the final Chapter, and the run continues. A `mistake` whose basis the read confirms, or whose basis needs no read, stops the run exactly as today. "Never silently reconcile a `mistake`" holds: the downgrade is a recorded adjudication, and the receipt is the record.

Acceptance:

- The Drift Report template in `agents/docs-curator.md` carries the `Basis:` line, and the charter states the pre-change rule and names the two git reads.
- finishing-work step 4 states the verify-before-stop step, the downgrade with receipt, and that a surviving `mistake` still stops the run.
- Baseline test per writing-skills: a scenario brief describing the NEO-CLAUDE incident (a doctor header comment tagged `mistake` on a claim that the changeset's removals truncated it, where the pre-effort file shows the comment was already in that shape). Before the change, the reworded skills stop the run; after, the orchestrator runs the named `git show`, records the refutation, downgrades, and continues.
- `node --test test/*.test.js` at baseline (zero-fail except the one intermittent memq-shim test the project memory names; capture the suite's wall clock beside the counts).

Files in scope: `plugins/claude-kit/agents/docs-curator.md`, `plugins/claude-kit/skills/finishing-work/SKILL.md`.

### 2. The transcript is the instrument: the resolved model, the first turn, and the never-started exit

Model: opus

Amend finishing-work's unavailability rule (the paragraphs from "**Unavailability is the gate failing to run at full strength" through "**Set the windows from the asymmetry") and executing-work's "A quiet agent is a working agent" bullet so both name the artifact and the reading.

In finishing-work:

- The resolved model. Where the rule says to read the model the round actually ran at, name the artifact: the `message.model` value on every `"type":"assistant"` line of the dispatch's `agent-<id>.jsonl`, read with a line-filtered count or grep (never a whole-file Read; the existing rule already says why). Distinguish the two readings by the question each answers: the dispatch record and the `.meta.json` `model` key answer what was requested (and the sidecar is silent where the dispatch inherited); the transcript answers what resolved. Where they differ, the harness substituted, which is trigger one arriving without a signal. The sentence "It ran at that model, which you read from the dispatch record you hold" is rewritten on those terms, since the dispatch record is the requested reading.
- The never-started shape. Replace the claim that finding no file is a real zero and that a dispatch that has taken no step has written nothing to create. The transcript exists from dispatch with the prompt as its first `user` line, whose `timestamp` is the dispatch time; a dispatch that never took a step holds `user` lines only. The liveness reading for this shape is the count of `assistant` lines whose `message.model` is not `<synthetic>` (the harness's API-error placeholder): zero after the first-turn window is the never-started shape, and the reading proves its own instrument (the file's own `user` line shows the path is right), so it needs no sibling control. Byte growth remains the stall reading for an agent that has taken a turn, with its existing windows and control.
- The windows for the never-started shape, in the windows paragraph, with the reason: the asymmetry that sets the long windows (a TaskStop discards what a live agent built) has no weight for an agent that built nothing, so these run short. First-turn window: five minutes from the transcript's first timestamp. At its close with zero turns, send the probe. Probe window: five minutes. At its close with still zero turns, TaskStop and enter the existing ladder (re-dispatch once at the same model; a second never-started at that model meets trigger two, and the round compensates per the route below). Carry the figures: p99 first turn 12 s, one outlier at 574 s in 1,988, eleven never-started dispatches on SCOTT-CLAUDE all carrying a fable override.
- The cadence sentence: the first-turn reading is taken at the first re-block after any dispatch and always, whatever the re-block shape, for a dispatch carrying a model override, since eleven of eleven observed never-starts carried one.

In executing-work, the quiet-agent bullet keeps finishing-work as the owner and adds one sentence: the never-started shape is the one silence that means something within minutes, so take the first-turn reading at the first re-block per finishing-work's rule, and always for a dispatch with a model override.

`test/doctrine-parity.test.js` pins finishing-work as the owner of the hallmark and the doctrine's probe bullet; it must stay green, and if a pinned phrase moves, the pin is updated with the reason in the Chapter.

Acceptance:

- finishing-work names the transcript's assistant-line `message.model` as the resolved-model artifact and the dispatch record or `.meta.json` `model` key as the requested one, and says which question each answers.
- The no-file-is-a-real-zero claim is gone; the never-started shape is defined by the assistant-line count with the `<synthetic>` exclusion; the first-turn window, the probe window, and the entry into the existing ladder are stated with their evidence figures.
- executing-work's quiet-agent bullet points at the first-turn reading and still names finishing-work as the owner.
- Baseline test per writing-skills: a scenario brief of two reviewers dispatched with the fable override, both transcripts at one `user` line twenty minutes after dispatch, a sibling at opus completing normally. Before the change, the rule yields a probe after the fifteen-minute growth window and a stop no earlier than twenty-seven minutes; after, a probe at five minutes and a stop-and-redispatch at ten, with the re-dispatch at the same model first.
- Both reviewers of this section are briefed to read the whole unavailability rule rather than the diff, per the project memory on skill amendments colliding with unchanged neighbours.
- `node --test test/*.test.js` at baseline.

Files in scope: `plugins/claude-kit/skills/finishing-work/SKILL.md`, `plugins/claude-kit/skills/executing-work/SKILL.md`, `test/doctrine-parity.test.js` (only if a pinned phrase moves).

### 3. The memory close-out runs the after-query

Model: opus

Amend finishing-work step 7 (the paragraph beginning "7. **Bank the learnings.**"), after the sentence that settles the memory ledger in both directions: run the after-query. `memq find` on the terms this effort learned (the names, paths, errors, constants, and facts that were not in the session's vocabulary when the effort's recall ran), read against what the effort now knows. A record the result overtakes is superseded (a fresh record carrying `supersedes:`, per the memory-system skill); a record that is simply wrong is corrected in place under the same-turn rule. State the reason in one sentence: the recall at effort start ran with the vocabulary the session had before the change, so a stale record hides behind words it did not yet know to search, and only a query run after the change can find it. Keep the step's existing order (sweep, decay pass, recap) and place the after-query before the recap so what it supersedes lands in the counts.

Acceptance:

- finishing-work step 7 names the after-query, its input (the effort's new vocabulary), its remedy (supersede or correct), and its reason, and the step's order still reads sweep, decay pass, after-query, recap.
- Baseline test per writing-skills: a scenario brief where the effort's recall found nothing about a subsystem the session had no name for, the effort learned that its contract changed, and the store holds an older record describing the old contract under an unrelated name. Before the change, the close-out banks the new fact beside the old record; after, the after-query surfaces the old record and the close-out supersedes it.
- `node --test test/*.test.js` at baseline.

Files in scope: `plugins/claude-kit/skills/finishing-work/SKILL.md`.

### 4. A heredoc body fed to a data sink is data, not a command

Model: opus

In `hooks/readonly-agent-guard.js`, extend the masking so that command-position scanning skips the body of a quoted heredoc when all four conditions of the Approach hold: quoted delimiter; the command owning the heredoc (the first token of the segment the `<<` operator sits in, after the last unquoted separator on the introducing logical line) is `cat` or `tee`; no name from `NESTED_EXECUTORS` stands in command position anywhere on the introducing logical line (use `commandPositions` over that line's masked text); and no unquoted `#` at word start precedes the operator on that line. Mask the body the way `maskQuoted` masks a quoted span (the NUL sentinel), so `segment`, `commandPositions`, `writeTargets`, and every heuristic that reads the masked copy skip it; `maskHeredocRedirects`'s own redirect blanking is unchanged for every body that does not qualify. The introducing line itself is never masked, so a redirect on it (`cat > README.md <<'EOF'`) still denies as a write, and the terminator still ends the span so a command after it is scanned.

Update the header comment above `maskHeredocRedirects` and `denyReason`'s known-misses paragraph: the accepted false hit is narrowed to the shapes that still deny, and the residual the Approach names (a literal body written to a class-writable path and run by a later command with a file operand, a second spelling of the existing `printf` residual) is stated beside the others.

Tests in `test/readonly-agent-guard.test.js`, red first: the case `a mutating verb inside a heredoc body is still scanned` becomes its inverse (`cat <<'EOF'\ngit commit -m x\nEOF` allows with empty stderr, renamed to say why); new allow cases for the report shape (`cat > .kit/review.md <<'EOF'` whose body opens lines with `git push origin main` and `rm -rf bin obj`) and the `tee .kit/review.md <<'EOF'` shape; new deny cases for `eval "$(cat <<'EOF'\ngit commit -m x\nEOF\n)"` (executor on the introducing line) and `# cat <<'EOF'\ngit commit -am pwn\nEOF` (comment position); and the existing `piped onward to a shell`, `into a nested shell`, `unquoted heredoc body still expands`, `introduction in comment position`, `redirect on a heredoc intro line`, and `terminator ends the blanking` cases all still pass unchanged.

Acceptance:

- The test file's heredoc block reads as above, every allow case asserting empty stderr and every deny case asserting its reason text, per the file's own two assertion rules.
- The guard's header and known-misses comments state the exemption's four conditions and the added residual.
- `docs/security-model.md`'s description of the read-only guard's residuals follows, through the finishing pass's curator (it is the curator's file; name the change in the section's Chapter so the curator finds it).
- `node --test test/*.test.js` at baseline.

Files in scope: `plugins/claude-kit/hooks/readonly-agent-guard.js`, `test/readonly-agent-guard.test.js`.

### 5. Clear the inbox and bank the harness fact

Model: sonnet
Locus: inline

Remove the two note lines from `kaizen/notes-NEO-CLAUDE.md` and the one from `kaizen/notes-SCOTT-CLAUDE.md`, leaving each file's header line where it has one. (The guard collision and the after-query were captured in conversation rather than in the inbox, so there is nothing to clear for Sections 3 and 4.) Write one operator-tier memory with `memq add-operator` per the memory-system skill, stating: on this harness (Claude Code 2.1.24x), a subagent dispatched with a model override the account cannot serve is created without error, never takes an assistant turn, and never times out; the transcript holds `user` lines only; a healthy dispatch's first assistant line lands within 12 s at p99; the `.meta.json` carries the requested override, and the transcript's assistant lines carry the resolved model.

Acceptance:

- `kaizen/notes-*.md` hold no note lines; `kaizen/briefs/` holds only `.gitkeep`; the SessionStart nudge reports no pending kaizen items on the next session.
- The operator-tier memory exists and `memq find "model override"` returns it.

Files in scope: `kaizen/notes-NEO-CLAUDE.md`, `kaizen/notes-SCOTT-CLAUDE.md`, the operator memory tier (CLI-authored).

## Related

- `docs/archive/claude-kit_reviewer-effort-compensation_spec_v1.md` (commit `e2752d1`): the round that wrote "read the model the round actually ran at" without naming the artifact.
- Commit `d66c58d` (wedge hallmark): the rule Section 2 corrects on the never-started shape and otherwise leaves standing.
- `docs/backlog.md`, the effort-dials item: the frontmatter `effort` pins and the Workflow route for reviewer effort, which the compensation route in the rule depends on.

## Chapters
