# Rationale ledgers

A rationale ledger records why each rule in the kit's prose holds, one entry per claim, beside the document the claim lives in. Rule text says what happens, the ledger says why, and git says when. The corpus is 26 files, one per owning skill, at `plugins/claude-kit/skills/<skill>/references/rationale-ledger.md`, covering the 49 documents a session loads as instruction with 6,882 entries.

Nobody loads a ledger. It is not instruction, and no skill body, charter frontmatter or hook points a session at one as part of a task. What reads it is a session about to change a rule, which opens the entry for the claim it is changing before it edits the sentence, so the reason a rule holds is not re-litigated at the next review. Its other reader is `docs/plans/claude-kit_corpus-rewrite_spec_v1.md`, which rewrites every rule document from the verdicts recorded here.

## What an entry holds

Each document sits under its own `##` heading, which opens with the document's inventory line and then carries one entry per claim, retired claims included so a later audit does not re-find them. The inventory line states what the document is for, which moments it owns, and when a session loads it, in one of four load classes: at every session start, at every plan run, on a named trigger, or on demand.

An entry is a `###` heading carrying the claim's id, and under it a fixed set of fields:

- **key:** the claim as one imperative sentence with its bound. This is the entry's identity, and a key-match check pairs every key against the extraction list both ways.
- **class:** rule (what must happen), mechanic (a command, path, field or threshold), pointer (go and read that other surface), or rationale-example.
- **source:** the file and line the claim was read at, resolved at the commit its id layer names.
- **provenance:** the commit, incident, memory record or kaizen note that installed the claim, or `no provenance found`.
- **verdict:** keep, rewrite or retire, with the reason on the line below it.
- **proposed:** the target wording the judge ruled toward, on rewrite entries and on retire entries that retire a passage, one line per distinct proposal. A proposal that pointed at another ruling by id carries the resolved text marked `(via Annn)`.
- **baseline-test:** `yes` where the judge read the change as behavior-shaping, which is what the rewrite plan's RED and GREEN step keys on. 1,200 entries carry it.

A reason may name the form the judge ruled toward, a pointer at the owner, a split, or a fold into a neighbour, because that form is why the verdict is rewrite rather than keep or retire. What a passage actually becomes is the rewrite plan's call, and where the two differ the rewrite plan governs.

## Placement

A ledger sits with the skill that owns the document, not with the file the document is. That rule decides three cases the paths alone do not. All 16 agent charters sit under the executing-work ledger, because a markdown file under `plugins/claude-kit/agents/` reads as a charter and ownership is keyed by moment rather than by directory. The doctrine, its home-directory mirror, the output style, `home/CLAUDE.md` and the ownership map sit under the operating-instructions ledger. Every other reference file sits under its own skill.

The mirror carries a heading and no entries. It is byte-identical to the doctrine under `test/doctrine-parity.test.js`, so one extraction serves both and the mirror's heading points at the doctrine's entries rather than repeating them.

## Claim ids

An id carries the layer it was extracted at, and the four layers are what let a reader tell one extraction from another. `C` is a claim extracted at the audit's extraction commit `6bc07fb`. `R` is one re-extracted at the merge `d9540ad`, `S` at `4b2e64c`, and `T` at the finishing merge `aff63fa`, each covering the rule text that landed on main between those points. Ids restart under every document heading, and inside a document read in chunks they restart per chunk, so a chunked document spells the chunk in the id (`c2.C001`) and a claim named inside a reason or provenance line carries the same prefix.

Supersession is how a re-extraction retires an older reading without retiring the rule. An older `C`, `R` or `S` entry whose passage a later entry now carries reads retire and takes a `superseded-by:` line naming its successor; the passage's live verdict is the successor's. There are 682 such records, which is why a count of retirements over a ledger has to leave them out: the 1,492 retire verdicts hold 682 supersessions and 810 passage retirements. The other verdicts are 4,373 keep and 1,017 rewrite.

## Maintenance

A ledger is a tracked file under a measured root, so it carries its own cap in `test/size-budget.json` and any edit that moves its size moves the cap through `node plugins/claude-kit/scripts/kit-size.js sync <path>` in the same change. Skipping the sync reds `test/size-ratchet.test.js`, and a new ledger with no cap at all reds it for a different reason.

Three walkers leave the ledgers out, and one deliberately does not. The two `test/doctrine-parity.test.js` walkers that enumerate shipped markdown as instruction surfaces skip them through the shared `isRationaleLedger` predicate, and `test/review-loop-provenance.test.js`'s skill-tree walker skips them by name, because an entry quotes rule wording verbatim as its key, retired wordings included, which any single-carrier or wording sweep reads as a second carrier of a phrase that should be stated once. The tracked-tree retire sweep in that same parity file keeps them in its judged set, so a ledger paragraph enumerating the classes that retire a test would red there and would need an exemption of its own.

Editing an entry is a hand edit. The generator that assembled these files from the audit's judge fragments lived in that run's gitignored scratch and does not survive the run, so nothing regenerates a ledger from source: a correction is made in the file, and the key-match property (every claim key an entry, every entry a claim) is what a later change has to preserve.
