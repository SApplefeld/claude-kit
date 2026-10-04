# Short Titles for Pull Requests

Status: Ready
Commit Model: Branch-and-PR
Disjoint: no
Created: 2026-10-03

## Goal

When this is done, the kit tells a session to title every pull request as an uppercase prefix naming the part of the system the work changes, then a short heading, as in `RELAY: Attachments Reach the Session`. It no longer tells a session to give a pull request title the commit-title sentence. A plan document's own title takes the same short heading with no prefix, so a plan's pull request title is built from it. This matters because the operator reads the pull request list and the trunk's merge commits, which carry the pull request title, and he finds the short form clearer than the sentence.

## Intent

**The frame, in the operator's words.** On the architect's channel, 2026-10-03, of two draft pull requests titled `One Table for Effort Defaults` and `Attachments Reach the Session`: "I really like how you titled the latest PRs. Clear, concise, good description." Of the earlier form, an uppercase prefix and a full sentence: "I found the long sentence was an improvement, but it still felt a little bit janky to me, so I definitely like this form better." Of the rule that produced the sentence: "we might want to take out that whole 'first sentence becomes the title' thing so that the 'pull you described in opposite directions' is removed and handled, and it's just more clear to use this shorter, more direct form."

**What done needs to do.** State one rule for a pull request title, in the one place that owns it, so no second rule pulls toward the sentence. Keep the uppercase prefix. Make the prefix name the work, so the title is right both while the pull request is a draft and after the work lands.

**What done does not need to do.** It does not change how a commit is titled: a commit keeps its prefix and its sentence. It does not retitle any pull request that is open or merged today. It does not rewrite the title of any existing plan document. It does not add a test, a hook or a check on titles. It does not change the persona plugin's charters, which a separate plan in that repository carries.

**Alternatives refused.**
- Short titles with no prefix: refused by the operator, who likes the prefix.
- Short titles for commits too: refused, since a worker makes dozens of small commits per plan and five words rarely names one.
- A `PLAN:` prefix on a plan's draft, rewritten when the work lands: refused by the architect on the operator's leave, since a title that must be rewritten can be left stale, and the draft state already says the work is pending.
- Stating the rule in the doctrine: refused, since finishing-work already owns the pull request, and every session loads the doctrine while the loaded corpus is over its word cap.

**Rulings after the sketch.** Decided 2026-10-03 by the operator on the architect's channel, on three options: pull request titles only, short form with the prefix kept, or commits too. His words: "I like option two. I like the prefix." On the prefix of a plan's draft he left the choice open: "I'm fine with `plan` if it gets rewritten before it's ready. I'm fine with it being the same thing from the original value from when it's created, and the draft status is what tells me that it's pending." The architect chose the second: one prefix that names the work, from creation.

**Provenance.** Written by the ARCHITECT persona on SCOTT-CLAUDE, 2026-10-03, on the operator's ask over the architect's channel.

## Approach

**One sentence carries the long form today.** `plugins/grimoire/skills/finishing-work/SKILL.md:168`, under step 7's Branch-and-PR bullet, reads: "The title takes the doctrine's commit-title form, in your own words and never curator text, since it rides the command line." The doctrine's commit-title bullet gives that form: an uppercase prefix, then a proper sentence with a closing period. The doctrine's heading bullet gives the short form: no article, no period, usually two or three words and never more than five, naming the effect. The plan re-points the one sentence from the first bullet to the second and keeps the prefix.

**The rule as it will read.** The sentence at `:168` is replaced by this passage, and the worker may tighten its wording without changing what it requires:

> The title is an UPPERCASE prefix naming the part of the system the work changes, then the doctrine's heading form with each main word capitalized, as in `RELAY: Attachments Reach the Session`. It is never the commit-title sentence, and the prefix is never `PLAN`, since the title outlives the draft. A plan's pull request takes the plan's title after the prefix, and a per-section pull request takes the section's. Write it in your own words and never curator text, since it rides the command line. A pull request already open keeps a title that takes this form and still names what was delivered, and takes a new one otherwise.

**The plan document's title.** `plugins/grimoire/skills/brainstorming/SKILL.md` step 9 gains one sentence: the spec's title takes the doctrine's heading form with each main word capitalized and carries no prefix, since its pull request's title is built from it. The machine contract row for the title in `plugins/grimoire/skills/curating-docs/SKILL.md:64` stays `free-form`, because the external engine's parse does not change.

**What stays.** The doctrine's two bullets are not edited. "A commit title is a sentence, not a heading" stays true of commits. The own-words rule and its reason stay, so `docs/security-model.md:782` stays true as written.

**Why the trunk shows the pull request title.** The three repositories merge with a merge commit titled from the pull request: `gh api repos/SApplefeld/claude-kit` answers `allow_squash_merge: false`, `allow_merge_commit: true`, `merge_commit_title: PR_TITLE`, and trunk commit `892b9f31` has two parents and the title of pull request 182. The ledger entry S221 gives a squash merge as a reason, which is not how these repositories merge, so its replacement states the merge commit.

**The ledger moves with the sentence.** `test/doctrine-parity.test.js` has a test, "every passage-pinned ledger entry quotes its source verbatim", that requires each `- passage:` line in the finishing-work ledger to be a substring of its source file. Entries S221 and S222 quote the sentence at `:168`. A002's key says "not the commit-title form the title takes". S221 is retired and superseded by a new entry for the new rule, S222's passage is re-pointed at the own-words sentence, and A002's key is reworded to match. Brainstorming's ledger gains one entry for its new sentence.

**Word growth is declared.** Each per-file cap in `test/size-budget.json` sits at its file's measured size, so the new passage needs four caps raised: the two skills and their two ledgers. The worker raises exactly those with `node plugins/grimoire/scripts/kit-size.js sync --repo . <the four paths>` and reports the four deltas in the Chapter. The skill growth is expected near 90 words for finishing-work and 30 for brainstorming. The `corpus-cap` key is not touched. It is already exceeded on the trunk at `892b9f31`, 106849 words against 105550, and a raise is the operator's ruling under the corpus cap item in `docs/backlog.md`.

**The sweep.** One scout sweep ran on 2026-10-03 over the trunk at `892b9f31`, excluding `docs/archive/`. It searched for every statement of a pull request title rule, the commit-title and heading rules and what pins them, every reader of a plan's first heading, every hook or script that parses a commit or pull request title, the agent charters, and the tests a reword would redden. It found:
- One live pull request title rule, `finishing-work/SKILL.md:168`, and one prose copy of its own-words half, `docs/security-model.md:782`.
- No code that parses, validates or generates a commit title or a pull request title. `pr-docs-guard.js` and `merged-pr-push-guard.js` match the command and read the state, never the title.
- One reader of a plan's first heading, `planParts` in `plugins/grimoire/scripts/jev-judge.js:287`, which takes any text.
- Ledger entries for the rule in the finishing-work ledger: S220, S221, S222 and A002, with older retired layers above them.
- Tests a reword can redden: the passage-verbatim test, `test/size-ratchet.test.js`, and the commit-model bullet extractor in `test/doctrine-parity.test.js` near `:5403`, which selects bullets by the words "whole gate" and "push". The new passage uses neither.
- `test/heading-shape.test.js` does not read pull request titles or the titles of plan documents.

## Sections of Work

### 1. The title rule
Model: opus

Replace the title sentence at `plugins/grimoire/skills/finishing-work/SKILL.md:168` with the passage the Approach gives. Leave the sentences on either side of it as they are: the list of what the pull request carries, and the body header and body register sentence. Add the plan-title sentence to step 9 of `plugins/grimoire/skills/brainstorming/SKILL.md`. Update the finishing-work ledger as the Approach states, and add the brainstorming ledger entry. Raise the four per-file caps to the measured sizes.

Acceptance:
- `finishing-work/SKILL.md` states the pull request title as an uppercase prefix naming the part of the system the work changes, then the heading form, with one example in that form.
- No sentence in `finishing-work/SKILL.md` says a pull request title takes the commit-title form, and a search of the tree outside `docs/archive/`, `docs/plans/` and the retired layers of the ledgers finds no other sentence that says so. The Chapter gives the search run and its hits.
- The passage says the prefix is never `PLAN`, says what a plan's pull request and a per-section pull request take after the prefix, keeps the own-words rule with its reason, and says when an open pull request keeps its title.
- `brainstorming/SKILL.md` step 9 says the spec's title takes the heading form and carries no prefix.
- `home/grimoire-doctrine.md`, `plugins/grimoire/skills/operating-instructions/SKILL.md`, `plugins/grimoire/output-styles/kit.md` and `plugins/grimoire/skills/curating-docs/SKILL.md` are unchanged.
- In the finishing-work ledger, S221 is retired with a pointer at its successor, the successor's reason names the merge commit and not a squash, S222's passage is a sentence the skill now holds, and A002's key no longer says the title takes the commit-title form.
- `node --test test/doctrine-parity.test.js test/output-style-parity.test.js test/heading-shape.test.js test/ledger-preamble-parity.test.js` exits 0.
- `node --test test/size-ratchet.test.js` reports the baseline's one failure and no other. The baseline at `892b9f31` is one failing test, "this repository is inside its size budget, with every tracked file under a measured root classified", on `corpus-over-cap` alone. The Chapter gives the corpus figure before and after and the four per-file deltas.
- The pull request this plan's worker opens or finishes is itself titled in the new form.

Files in scope: `plugins/grimoire/skills/finishing-work/SKILL.md`, `plugins/grimoire/skills/finishing-work/references/rationale-ledger.md`, `plugins/grimoire/skills/brainstorming/SKILL.md`, `plugins/grimoire/skills/brainstorming/references/rationale-ledger.md`, `test/size-budget.json`.
Tests: none new. The sweep found no code that reads a pull request title, so there is no behavior to lock, and the passage-verbatim test already holds the ledger to the skill.
Audience: a kit session opening or finishing a pull request, holding finishing-work and no memory of this plan. It must be able to write a title in the new form from the passage alone, and to tell whether an open pull request's title stays. Voice: none named. Fact base: the passages the Approach cites at `892b9f31`.

## Out of Scope

- The doctrine's commit-title bullet and heading bullet, and so every commit title.
- The architect charter in the agent_persona repository, `bin/supervise-holder.sh`, which says a plan's draft pull request is "titled as the plan". Its own plan in that repository adds the prefix there.
- Every pull request open or merged before this plan lands, and the first heading of every existing plan document.
- The `corpus-cap` key in `test/size-budget.json` and the pending ruling on it.
- The discord-channels and llm-wiki repositories, which hold no title rule of their own.
- `tools/corpus-compression/mechanism-cut-2026-09-30.json`, a dated record no test or tool reads.
- Any hook, test or script that checks a title's form.

## Assumptions

- assumed 2026-10-03 (operator's word, "I'm fine with either"): the prefix names the work from creation and is never `PLAN`; reversal: one sentence in finishing-work.
- assumed 2026-10-03 (default): each main word of the short title is capitalized, as in the two titles the operator praised; reversal: a few words in two skills.
- assumed 2026-10-03 (default): every pull request takes the form, a worker's as well as a plan's draft, since the operator's praise and his option named pull request titles without limit; reversal: one clause.
- assumed 2026-10-03 (default): the rule's growth of about 120 words across two loaded skills is acceptable while the corpus cap ruling is pending, since it adds to a total already over the cap; reversal: the worker cuts the passage to its first two sentences.
- assumed 2026-10-03 (brainstorming step 10, a spec of one or two sections may skip): this one-section spec took no blind read and no plan review; reversal: one dispatch of each.
- assumed 2026-10-03 (default): a session on an installed kit older than this plan keeps writing the sentence form until its plugin updates; reversal: none needed.

## Operator Verification

- After this plan merges and the plugin updates on a machine, read the title of the next pull request a worker opens or finishes there. A title in the sentence form means the installed kit is stale, or the rule is not being read, and the second reopens this plan.

## Open Questions

None.

## Chapters
