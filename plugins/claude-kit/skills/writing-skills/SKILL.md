---
name: writing-skills
description: "Use when creating a skill for this kit, editing one, or deciding whether a wording change to a behavior-shaping skill will actually change behavior. Also use when amending curated prose the kit ships: a skill, an agent charter, the output style, a README, a plan doc, or a doc under docs/. Triggers: adding a new SKILL.md, reworking a skill's rules, correcting a claim a curated document states, a skill that reads well but agents ignore under pressure, or a kaizen change to the kit's own skills."
---

# Writing Skills

A skill is behavior-shaping prose, not documentation. One that reads well but does not change what an agent does under pressure is decoration. Treat a skill change like a code change.

## When a skill earns its place

- **Create when:** the technique is non-obvious, recurs across efforts, and is general. A single project's convention is not a skill; it goes in that project's CLAUDE.md.
- **Do not create when:** it is a one-off, a restatement of standard practice, or something a hook or regex can enforce mechanically. Automate the mechanical ones; reserve skills for judgment.
- **The kit stays lean.** A new skill must beat the alternative of one more paragraph in an existing skill. When in doubt, fold it in rather than add a file.
- **The size budget is a ledger rather than a ceiling.** In the kit's own repository, the budget file (`test/size-budget.json`) and the ratchet test (`test/size-ratchet.test.js`) make growth visible, not forbidden. A file that grows raises its cap in the same change, and one that shrinks lowers it. Move the caps with `node <plugin-root>/scripts/kit-size.js sync --repo <the project's root> <path>...`, naming the files the change touched. A new curated file, added to git or not yet, gets its first cap the same way. The bare form with no paths moves every cap and belongs to an audit over a clean tree. The Chapter's Delta line is where the net is read. A raise is never a finding on its own: what a reviewer weighs is whether the added words earn their place. A session rewording a passage takes the shrink where one is available.

## Anatomy

- One SKILL.md, in the kit's voice: direct, opinionated, anti-dogma. Add a reference file only when the body genuinely outgrows the size of the kit's other skills, and gate it the way csharp-style and sql-style do: the SKILL.md covers routine work and names the territories that need the reference.
- **Frontmatter: always quote the description.** `name` and `description` are the two that matter.
- Body: the principle, the rules that carry judgment, the antipatterns. Tables and lists for what gets scanned; prose for the why. A flowchart only for a decision where the agent might genuinely go wrong, never for linear steps.
- **One owner per rule.** The doctrine's one-owner bullet owns the principle and the forms a mention may take (`skills/operating-instructions/SKILL.md` under the kit plugin root). The ownership map that bullet names carries the owning document for each moment. When editing a rule, grep for its key phrases across the kit and fix the owner, not the nearest copy.
- The plan-doc header and structure is one such rule, owned outside this skill: `curating-docs/SKILL.md`'s "machine contract" section is the frozen shape external tooling parses. Point at it rather than restating any of its lines here.

## The description states the trigger, not the workflow

The description is how a future session decides whether to load the skill. Write it as "Use when..." plus the symptoms that pull it in, and stop. Do not summarize the skill's process there.

## Match the form to the failure

Name the failure first, then pick the form that fixes it. The form that bulletproofs one failure backfires on another:

| The failure | The form that fixes it | The form that backfires |
|---|---|---|
| Knows the rule, skips it under pressure | Prohibition plus a rationalization table plus a red-flags list | Soft "prefer..." guidance |
| Complies, but the output is wrong-shaped (bloated, buried, restated) | A positive recipe: state what the output IS, its parts in order | A prohibition list ("don't restate", "never narrate") |
| Omits a required element from something it already produces | A structural slot: a REQUIRED field in the template it fills | Prose reminders near the template |
| Behavior should depend on a condition | A conditional on an observable predicate ("if the brief exists, reference it") | An unconditional rule plus exemption clauses |

Three rules govern any rule you write, not just the four forms above:

- **No nuance clauses.** "Don't X unless it matters" reopens the negotiation. Express a real exception as its own conditional on something observable.
- **Exemption clauses do not scope.** If part of the output must be exempt, restructure so the rule cannot reach it.
- **Close every enumeration with its class.** State the class the instances belong to right where the list ends ("the table is instances, not the boundary"; "the set is closed"), so a novel variant meets the rule even though no row names it.

## State facts the reader can check and correct

The rules above govern the form of a rule. These two govern the facts a rule stands on, which go stale on their own schedule and take the rule with them.

- **When two framings of one fact are both true, ship the one the reader can verify from where they sit.** Name the file, the command, the observable event, or the artifact the fact lives in, and pick the framing that makes it findable.
- **A fact base drawn from observed instances states its lists as open unless the contract closes them.** Closure comes from the contract (a schema, an enum, a validated surface with a published shape), never from the sample agreeing with itself. So write the list as open and say what would close it, or cite the contract that already does.

Those two are instances rather than the boundary. The class is any fact a rule rests on that the reader cannot check for themselves or cannot see the edges of, and a new way of putting a fact out of the reader's reach meets the rule even though neither bullet names it.

## What a sentence has to earn

Whether a sentence belongs at all is the doctrine's call rather than this skill's. Its "Documents ship the current state; the journey lives in git" bullet (`skills/operating-instructions/SKILL.md` under the kit plugin root) sorts state from journey and states its own exemptions, append-only history among them. This section adds the shape the surviving sentences take, at authoring rather than only at review.

A sentence in the kit's own voice, in any curated prose it ships, is one idea, in the literal phrase, pointing where another site owns the rule. Those three sentence-shape bars, the term the doctrine defers to this section by, in order:

- **One idea.** A sentence is one idea, about twenty words. A rule and the bound that limits it are two sentences, the bound following the rule at once. That way neither sentence is long and the rule is never read without its bound. They share one sentence only where the split would leave the rule readable alone. A word count past twenty is the diagnostic that finds a second idea rather than the bar itself. Uniform sentence length is its own defect, so the count is read per sentence and never as a target. A paragraph makes one point, or says in the paragraph why its parts must be read together.
- **The literal phrase.** Where a literal phrase for the thing exists, the sentence uses it. A metaphor stands where it is the established term for the thing and is mannered prose everywhere else. Mannered prose is metaphor and flourish substituted for direct statement, written to display the writer, dragging in connotations the writer did not choose. The fix for mannered prose is that literal phrase. The packed sentence, the nested qualification and the reasoning-first order are the same defect in another shape, and the doctrine's plain-prose bullet names each.
- **A pointer where another site owns the rule.** The one-owner rule under Anatomy above points at the doctrine's bullet for the forms a mention may take; this bar adds no form to that list and no exception.

The three are instances of one class: prose that costs the reader more to read than it changes for them. A form of it none of them names is inside the bar.

## The paragraph is the edit unit for curated prose

**When an amendment corrects a claim a curated document states, the edit unit is the paragraph, never the sentence.** Re-derive the whole paragraph from the corrected claim, then check the claim's other carriers: the neighbouring clauses that qualified or restated it, and any sibling surface stating the same behavior. Those two are instances rather than the boundary. The unit is the claim across every surface carrying it, and the paragraph is that unit's smallest case. A surface carrying the claim is inside the rule whether or not anything here names it. The carriers this kit keeps producing are a doctrine parity copy, the output style's register block, an agent charter, a test's assertion message, a memory record, and a README's payload map, and that list is instances rather than the boundary too. An amendment that corrects no claim is outside the rule and takes whatever edit it needs, a typo fix, an added bullet, and a label rename among them.

An insertion anchored on the tail of a block, or on the next entry's first line, restores every byte of that anchor in the replacement. It then re-greps the neighbour's lead-in, with a control at HEAD proving the pattern matches the intact form.

A carrier on another surface is not automatically yours to edit in place. Four dispositions cover the shapes this kit produces, and they are instances rather than the boundary: a carrier fitting none of them is named as such and routed deliberately, never edited in place by default. Where the one-owner rule above applies, fix the owner rather than the nearest copy. Where the surfaces are a deliberate byte-identical set, every copy lands in one edit or none does. A partial edit reds the parity pin by design. The set is as large as the pin says rather than as large as the pair you first thought of. Where the claim is a deliberate restatement across surfaces the section's scope already covers, it lands on every one of them in the same edit. And where a carrier sits in a file the section's `Files in scope:` never listed, it is an out-of-scope surface: it takes the route the executing-work skill's fix-round step owns (`skills/executing-work/SKILL.md` under the kit plugin root), rather than an in-place edit the post-review scope check never sees.

The rule binds every writer amending curated prose. Assume no downstream backstop, since what stands downstream differs by surface. Which pass reads which surface is finishing-work's and executing-work's to state (`skills/finishing-work/SKILL.md` and `skills/executing-work/SKILL.md` under the kit plugin root).

## Know it works before you trust it

A skill you wrote and never tested is a guess. The honest test is to watch an agent's behavior with and without the wording:

1. **RED:** give a fresh subagent a realistic task that tempts the failure, without the new guidance. Watch it fail; record the rationalization verbatim. If it does not fail, there is nothing to fix, so stop.
2. **GREEN:** add the minimal guidance addressing that specific failure. Re-run. The agent should now comply.
3. **REFACTOR:** if it finds a new loophole, add the counter and re-run until it holds. For discipline rules, combine pressures (time plus sunk cost plus authority); single pressures are weak tests.

Run several reps, since one sample lies, and read every flagged result yourself, since template echoes masquerade as both failures and successes. This is the standard for any change to behavior-shaping content, the kit's own skills included.

In the kit's own repository, where the probe set lives, a change touching a file a probe's shape under `test/probes/` names, in a passage the probe's scenario turns on, runs the probe runner's before-and-after pair for that moment. The check is the changed and untracked paths, read against the same `<sha>` the before leg takes, against the shapes' `files:` lists, and then the changed hunks against those probes' scenarios, a hunk no scenario turns on running nothing and being recorded as such where the reading is. Where the probe is `ruled`, the pair stands in for the reps above as the RED and GREEN. Where it is `proposed`, the after leg alone is run and recorded as evidence for the operator's rulings batch, and the reps above stand. A before leg that matches is not step 1's nothing-to-fix case. The pair's readings close at four: a matching pair on a moment the change did not mean to move is a reading that held; a before-leg mismatch the after leg matches is the repair; a mismatch both legs carry is the corpus's, recorded as such; and an after-leg mismatch the before leg lacks takes the intent test below, as does a matching pair on a moment the change meant to move, which is a finding rather than a reading that held. An errored or unparsed pair, or one in a leg recorded unavailable, is none of these and is re-run as finishing-work's step 6 directs. Where it errors again it stands in for nothing, so the reps above run. A designed shape's rows and a designed-agreed row are none of these either and take finishing-work's step 6 dispositions. Rows from a shape naming no changed file are no reading at all, which follows from what each leg reads in `tools/probe-corpus/README.md`'s "What the runner reads" section. The before leg is `node tools/probe-corpus/run.mjs --only <moments> --before <sha>`. The after leg is the same command with no `--before` and its own moment list. The after leg's `<moments>` is the comma-joined list of every moment the check above kept, and the before leg's is that list narrowed to the `ruled` ones. `<sha>` is the parent of the change's first commit resolved to a sha, or `HEAD` where the change is uncommitted; a root-commit change takes the `<sha>` finishing-work's pre-step-1 derivation yields, which leaves the before leg unrun as that skill's step 6 records it. The pair runs once at the section's close over the section's whole change rather than at each fix round, and inside a finishing pass the set's runs are finishing-work's step 6's alone. The run's process standing is finishing-work's step 6's. `tools/probe-corpus/README.md` owns what each leg reads and what each row status means, and finishing-work's step 6 owns how the run is spawned, when a leg is re-run and what each row counts for. What this bar adds is the intent test on a ruled probe's after-leg mismatch the before leg lacks: a move the change intended is a re-ruling to ask the operator for, and any other is a finding. A change whose only shape-named files are the repo's `home/*.md` files is seen by neither leg, so it takes the reps above with the cache staging below. A matching leg pair is one sample, and the raw replies the runner keeps are read as the flagged results above are. The reading, or both where a pair ran, is recorded on the line executing-work's Chapter template holds for it in `Decisions / Surprises`, or in the turn's close-out status where no section Chapter exists.

**A doctrine edit is invisible to same-session subagents.** A GREEN probe for a doctrine change runs in a fresh session (a headless `claude -p`), never as a subagent of the session that made the edit. And `~/.claude/claude-kit-doctrine.md` is not the file to stage the probe wording in. Where the probe pair above does not supply the GREEN, stage the candidate wording in the installed plugin cache's copy of the operating-instructions skill for the probe run and restore it after; the real change ships through the normal commit and goes live when the plugin updates.

**Doctrine-adjacent rules have a contaminated RED.** Where the harness's subagent inheritance is off, a RED is genuine, and where it is on, that contamination is production-faithful rather than a test defect. Absence of failure there is weak evidence, not proof the rule is dead weight. Judge such a rule on its distinct value instead: point-of-action encoding survives compaction and reaches contexts the doctrine does not (a headless worker mid-loop, a session whose doctrine was summarized away). If you ship a rule whose RED did not reproduce, record that it stands on that rationale, not on a demonstrated failure. A rule with neither a reproduced RED nor that rationale is the guidance-from-imagination antipattern, so leave it out.

## Antipatterns

- A narrative ("the time we fixed X") instead of a reusable technique.
- A harness-injection fact stated as unconditional ("subagents load X", "memory is injected into Y") when it hinges on a user setting: a settings flip silently falsifies the prose with no test to catch it. State the safe assumption instead; where the fact must be stated, name the setting it depends on.
- Guidance written from imagination instead of an observed failure.
