# memq reads its fields where the harness puts them

Status: Draft
Commit Model: Commit-and-Push
Created: 2026-08-23

Flip `Status:` to `In Progress` to execute. Session model: Opus, in a clean session opened in the kit repo, **first in the running order**, ahead of `claude-kit_verification-artifacts_spec_v1.md`, because that plan's after-query section writes `supersedes:` by hand and the memory-anchors plan's guard and anchors both read frontmatter through the readers this plan corrects. One section. Anchors below are as of commit `d8bf2b3`; re-locate by content.

## Goal

On this harness, a Write into a project's memory directory (`~/.claude/projects/<project>/memory/`) is rewritten in the same second into the harness's own frontmatter shape: `name: ""` over a `metadata:` map, with every top-level key the author wrote moved under `metadata:` and `node_type: memory`, `originSessionId`, and `modified` added. memq reads its fields (`tags`, `created`, `pinned`, `supersedes`, `machine`) at the top level only, by a deliberate rule that a key nested under another is a different key. The two together mean every hand-written project-tier field is silently inert: `pinned:` pins nothing, `supersedes:` labels and demotes nothing, `tags:` never match `--tag`, `created:` never reaches the idle clock. Two shipped features, pinning and supersedes, document the hand-written frontmatter line as the project tier's way to author them, and the SessionStart memory block tells every session to write memory files with the Write tool. When this plan is done:

- memq reads each of its fields at the top level first and, absent there, from the `metadata:` map the harness writes; a field indented under any other key is still reported as misplaced, exactly as today.
- The memory-system skill states the rewrite, where a hand-written field lands, and that memq reads both placements, in the passages that today describe the top-level-only grammar.
- The harness fact is banked in the operator tier, where every project on every machine reads it.

## Approach

- **Both placements are read, top-level winning.** The reader's comment argues that promoting a nested key "would read the file as saying something it does not say". The harness inverts that premise: it relocates the author's own top-level key under `metadata:` on every Write, so the nested key under `metadata:` is exactly what the author said. Under any other key the old rule stands, since nothing relocates keys there. Where a field is present in both placements the top-level value wins, because a top-level line on a harness-shaped file can only have been written after the rewrite (by the CLI or by hand outside the Write tool) and is the newer intent.
- **The `metadata:` map is recognised by shape, once.** A column-0 `metadata:` line inside the frontmatter block, followed by lines indented by the first following line's indentation, ending at the next column-0 line or the closing fence. Only that map is promoted; deeper nesting is not, and a `metadata:` map that is not at column 0 is not a map.
- **No writer changes.** The shared-tier writers, `decay-prune`'s archive move, the repair carrier (which copies frontmatter verbatim), and the memory-anchors plan's `memq anchor` all write through Node's fs and are never rewritten; a model-written project record ends up nested. Two shapes in one store is the reality, and an engine's fleet store, which lives outside the harness's directory, keeps the top-level shape entirely. One reader that handles both is the whole fix.
- **The pinned-grammar note keeps its teeth.** `pinState`'s report of an indented `pinned:` stays for a field under any key other than `metadata:`; a `pinned:` under `metadata:` pins, since that is where the harness puts the one the author wrote at the top level.
- **The test flips with its reason rewritten,** not deleted: the fixture that proved a nested `tags:` contributes nothing becomes two cases, one proving a `metadata:`-nested key is read and one proving a key under some other map still is not.
- **The skill text is corrected in the same section,** because a reader who follows the current text writes a top-level line, sees it vanish into `metadata:`, and concludes the write failed; the text has to say what happens and that it is fine. Behavior-shaping wording, so writing-skills governs and the change is baseline-tested.
- **Acceptance is a real Write, not only the suite.** The defect is in the seam between the harness and memq, which no in-process test exercises; the section closes on a probe record written with the Write tool and found by `memq find --tag`, then deleted.

## Evidence

- The probe, this session, 2026-08-23: a record written with the Write tool carrying top-level `created`, `tags`, `pinned`, `supersedes`, and `anchors` was on disk in the same second as `name: ""` over `metadata:` holding all five keys nested, plus `node_type: memory`, `originSessionId`, and `modified`; the file's mtime equalled the `modified` stamp to the millisecond. Every pre-existing file in the store (six) carries the same shape with no column-0 memq field, and the session's own new record `memory-store-forks-declined-2026-08-23.md` is in that shape with its `created:` under `metadata:`.
- `plugins/claude-kit/scripts/memq.js` at `d8bf2b3`: the grammar comment at :1800-1806 ("memories written by the harness carry node_type and type nested under metadata:, so promoting a nested key to the top-level field would read the file as saying something it does not say"); `frontmatterValue` at :1870-1884 (top-level regex, `FRONTMATTER_INDENTED` when the key is found indented); `frontmatterField` :1886; `readFrontmatterTags` :1900; `readFrontmatterCreated` :1918; `pinState` :1963; `supersededSuccessors` :2068; `recordFrontmatter` :6907 (the repair carrier).
- `test/memq.test.js:1719-1733`, `a tags key nested under another is not promoted to the top-level field`, whose fixture is the harness shape and whose assertion is `[]`.
- `memq find harness --memories` on this store prints `[]` in the tags column for a harness-shaped record carrying `tags: gotcha` under `metadata:`; the tag registry at `~/.claude/memory-types/tag-registry.md` is `{}`.
- `plugins/claude-kit/skills/memory-system/SKILL.md`: :104 ("Frontmatter uses the inline form only: `tags: a, b` on one line"), :111 (`machine:` "inline single-line form, the same line discipline as `tags:`"), :146-154 (the project tier authors `supersedes:` by hand; the grammar "is strict on purpose"; "Top level inside the frontmatter block"), :178-186 (`pinned:` at the top level; "an indented `pinned:` does not pin, and the scan names the misplacement"), :194 (`created:`).
- `docs/archive/claude-kit_memory-supersedes_spec_v1.md` (Complete): the project-tier hand-written pointer, inert on this harness from the day it shipped. `docs/archive/claude-kit_automemory-off_spec_v1.md`: the harness's memory feature is opaque and private, which is why this plan reads the shape it writes rather than its state.

## Sections of Work

### 1. Both placements read, the test flipped, the skill corrected, the fact banked

Model: opus

In `memq.js`, `frontmatterValue(raw, name)` reads the top-level line as today and, when there is none, the same key inside the column-0 `metadata:` map recognised as the Approach states; it returns `FRONTMATTER_INDENTED` only for a key found indented outside that map. Every reader that goes through it (`frontmatterField`, `readFrontmatterTags`, `readFrontmatterCreated`, the `machine` and `supersedes` readers, `pinState`, `supersededSuccessors`, and the per-record walks that call `frontmatterValue` on text in hand) inherits the change with no edit of its own; add a pin that each of those readers resolves through the one function, so a later reader cannot re-introduce a top-level-only read. The grammar comment at :1795-1806 is rewritten to state the rewrite and the two placements. The repair carrier is untouched.

Tests, red first, in `test/memq.test.js`: `tags`, `created`, `pinned`, `supersedes`, and `machine` each read from a `metadata:`-nested fixture in the harness's exact shape; a top-level value wins over a nested one; a key under a map other than `metadata:` is still reported as indented; a `metadata:` line not at column 0 promotes nothing; the flipped case `a tags key nested under metadata is the author's own key and is read` beside `a tags key nested under any other key is not`; `find --tag` matches a nested tag; `pinState` pins on a nested `pinned:`; `supersededSuccessors` labels on a nested `supersedes:`; the decay clock takes a nested `created:`.

In `skills/memory-system/SKILL.md`: the passages at :104, :111, :146-154, :178-186, and :194 state that on Claude Code a Write into the memory directory is rewritten at once into `name: ""` over a `metadata:` map with every top-level key moved under it, that memq reads its fields in both placements, and that the author writes the field at the top level and expects to find it under `metadata:` afterwards; the "strict on purpose" and "an indented `pinned:` does not pin" sentences are narrowed to "under any key other than `metadata:`". Follow writing-skills; baseline-test with a scenario brief of a session that writes `supersedes:` by hand, re-reads the file, and finds it under `metadata:` (before the change, the session concludes the write failed and writes it again or gives up; after, it reads the skill's sentence and moves on).

Bank the harness fact with `memq add-operator` per the memory-system skill: on Claude Code, a Write into a project memory directory is rewritten in the same second into the harness's frontmatter shape, every top-level key moving under `metadata:`; memq reads both placements; files written through the CLI or outside the Write tool keep the top-level shape.

Acceptance:

- The suite is green at baseline (`node --test test/*.test.js`, zero-fail except the one intermittent memq-shim test the project memory names; capture the wall clock), with the new cases red first.
- The live gate: a probe record written with the Write tool into this project's memory directory carrying top-level `tags: probe-<date>` is found by `memq find --tag probe-<date>` and a `pinned:` on it is listed by `memq decay-scan` as pinned; the probe is then deleted and its absence from `MEMORY.md` confirmed.
- `memq find --tag gotcha` on this store now returns the five records that carry that tag under `metadata:`.
- The skill passages read as above, and the operator memory exists (`memq find "rewritten"` returns it).
- `docs/architecture.md`'s description of the memory grammar, where it has one, follows through the finishing pass's curator; name it in the Chapter.

Files in scope: `plugins/claude-kit/scripts/memq.js`, `test/memq.test.js`, `plugins/claude-kit/skills/memory-system/SKILL.md`, the operator memory tier (CLI-authored).

## Related

- `docs/plans/claude-kit_verification-artifacts_spec_v1.md` (queued next): its after-query section writes `supersedes:` by hand at the close-out, which this plan makes effective.
- `docs/plans/claude-kit_memory-anchors-and-frontmatter-guard_spec_v1.md` (queued last): its guard validates hand-written frontmatter and its anchors are read through the same readers; it states its rules in terms of both placements on the strength of this plan.
- `docs/archive/claude-kit_memory-supersedes_spec_v1.md` and `docs/archive/claude-kit_automemory-off_spec_v1.md`, per the Evidence.

## Chapters
