# Rationale ledger: csharp-style

This file is the rationale ledger for the documents the `csharp-style` skill owns. Rule text says what happens; this ledger says why; git says when. Nobody loads it by default. A session about to change a rule in one of the documents below reads the entry for the claim it is changing first, so the reason a rule holds is not re-litigated at the next review.

Each document sits under its own heading, which opens with its inventory line (what the document is for, which moments it owns, and when a session loads it) and then carries one entry per claim, retired claims included so the next audit does not re-find them. An entry is keyed by the claim's imperative sentence and carries its class (rule, mechanic, pointer, or rationale-example), its source as file and line, its provenance (the commit, incident, memory or kaizen note that installed it, or `no provenance found`), and its verdict (keep, rewrite, or retire) with the reason. A `C` entry's source line is read at the extraction commit `6bc07fb`; an `R` entry is a claim re-extracted from a hunk the Section 5 merge changed, and its source line is read at the merged commit `d9540ad`. Claim numbers restart under every document heading, and inside a document read in chunks they restart per chunk, so an entry id is unique only under its heading and a chunked document carries the chunk in the id (`c2.C001` is claim C001 of the second chunk); a claim named inside a reason or provenance line of such a document carries the same prefix. A `C` entry whose source hunk the Section 5 merge rewrote reads `retire` and carries a `superseded-by:` line naming the `R` entry that holds the passage at the merged commit; the passage's own verdict is that entry's, so a count of retirements over this ledger leaves those records out. A reason may name the form the judge ruled toward (a pointer at the owner, a split, a fold into a neighbour), because that form is why the verdict is rewrite rather than keep or retire; what a passage becomes is the rewrite plan's to decide, and where the two differ the rewrite plan governs. The target wording a judge proposed rides on the entry's `proposed:` line, one line per distinct proposal, on rewrite and retire entries that retire a passage; a proposal that pointed at another ruling by id carries the resolved text marked `(via Annn)`. A rewrite or retire the judge flagged as behavior-shaping carries `baseline-test: yes`, which is what the rewrite plan's RED and GREEN step keys on. What a passage becomes is the rewrite plan's to decide (`claude-kit_corpus-rewrite_spec_v1.md` under `docs/plans/`), and where it and a proposal differ the rewrite plan governs.

## plugins/claude-kit/skills/csharp-style/SKILL.md

This document is the operator's personal C# house style: it defines how C# source is laid out, commented, named, and organized, what the antipatterns are, and what must be true before C# work is called complete. It owns the moments of writing or modifying any C# code (services, handlers, helpers, MediatR notifications, models, DI registration, refactors), the moment of choosing between this style and a repository's own conventions or formatter contract, and the moment of outlining a large C# file to find one thing in it rather than reading it whole. Its load class is `named-trigger`: the frontmatter says to use it whenever writing or modifying any C# code, and to trigger on any C# work even when style is not named.

Extracted at `6bc07fb`: whole document (`skills.csharp-style.SKILL.md`).

### C001
- key: Load and apply this style whenever you write or modify any C# code, even when style is not mentioned.
- class: rule
- source: plugins/claude-kit/skills/csharp-style/SKILL.md:3
- provenance: f8c0649 2026-06-10, the INIT consolidation of the operator's working pattern; 7964c7e 2026-06-28 trimmed "static Serilog logger" from the trait list when ILogger became preferred. No incident narrated.
- verdict: keep
- reason: This is the frontmatter the harness matches to load the skill; the work-kind enumeration is what makes the skill load on a task that names a handler or a DI registration without naming style. Change it only to change when the skill loads.

### C002
- key: Read references/csharp-style.md for the full pattern reference before writing code.
- class: pointer
- source: plugins/claude-kit/skills/csharp-style/SKILL.md:8
- provenance: f8c0649 2026-06-10, INIT; a8770b3 2026-06-28 reworded to first person only.
- verdict: keep
- reason: No finding. This sentence is what makes SKILL.md and the reference one owner in two layers (philosophy always loaded, detail on demand), which is the basis for every same-owner ruling in this unit.

### C003
- key: Put short `// Title.` comments above blocks to act as section headers marking where one thing ends and another begins.
- class: rule
- source: plugins/claude-kit/skills/csharp-style/SKILL.md:12
- provenance: f8c0649 2026-06-10, INIT; 058e3a3 2026-07-24 rewrote the surrounding sentences from the operator's hand-edit review of Claude-authored C# in the PrePass plugin.
- verdict: keep
- reason: The signature trait of the style and the thing no formatter produces; the reference §6 is this skill's own detail layer, not a second owner, so the philosophy statement stays whole.

### C004
- key: End every section comment with a period.
- class: mechanic
- source: plugins/claude-kit/skills/csharp-style/SKILL.md:12
- provenance: f8c0649 2026-06-10, INIT, installed at once as philosophy, antipattern and checklist line.
- verdict: keep
- reason: CSharpier (format-on-edit.js) does not touch comment punctuation, so the prose is the only guard; the reference §11 match-the-file note is a legacy-file carve-out for `RegisterServices.cs` group labels, not a contradiction of this rule for a section comment a session writes.

### C005
- key: Write each section comment as a short, imperative, direct statement of what the next block is intended to do.
- class: rule
- source: plugins/claude-kit/skills/csharp-style/SKILL.md:12
- provenance: 058e3a3 2026-07-24, the operator's hand-edit review of Claude-authored C# (PrePass plugin, 2026-07-21) sharpened the comment voice; installed in the philosophy and reference §6 together.
- verdict: keep
- reason: Incident-born (wrong comment voice in shipped code), the incident recurs on every C# task, and no machinery checks voice. The antipattern bullet C038 is the observed-habit side of the same rule and was installed for that purpose.

### C006
- key: Judge a comment by intent rather than vocabulary, so `// Abort if we don't have a Valid VIN, make no changes.` counts as in-voice while "Now we check the inputs" does not.
- class: rationale-example
- source: plugins/claude-kit/skills/csharp-style/SKILL.md:12
- provenance: 058e3a3 2026-07-24, the operator's clarification that an incidental "we" is fine.
- verdict: keep
- reason: The intent test cannot be applied without one instance whose casual "we" still passes; remove the specimen and a session bans the word instead of the voice, which is the misreading the operator corrected.

### C007
- key: Never let a comment explain history, decision-making, alternatives weighed, or issues encountered; keep WHY comments rare and exceptional.
- class: rule
- source: plugins/claude-kit/skills/csharp-style/SKILL.md:12
- provenance: 058e3a3 2026-07-24, the same hand-edit review; installed in this skill, its reference, and the SQL skill and reference for T-SQL sentence-style comments in one change.
- verdict: keep
- reason: Each style skill owns its language's comment forms (the SQL side carries a banner carve-out this side does not need), so the four copies are per-language statements, not one rule looking for an owner.

### C008
- key: Write XML `/// <summary>` docs on public members only where they add something, and skip them where they would only restate the signature.
- class: rule
- source: plugins/claude-kit/skills/csharp-style/SKILL.md:12
- provenance: 7964c7e 2026-06-28, "Style Cleanups", which deleted the INIT antipattern banning XML doc comments and installed this qualified stance in the philosophy and checklist together; the message states no reason.
- verdict: keep
- reason: A deliberate reversal of an earlier ban; the checklist line C063 is its gate. A session that removes either restores the ambiguity the reversal resolved.

### C009
- key: Group related items and separate each group with a blank line and a label comment.
- class: rule
- source: plugins/claude-kit/skills/csharp-style/SKILL.md:13
- provenance: f8c0649 2026-06-10, INIT.
- verdict: keep
- reason: Philosophy principle whose detail is reference §3 and whose gate is checklist line C051; one owner, three surfaces installed together.

### C010
- key: Structure a Variables region as `// Values.`, `// Mapper.`, and `// Services.` groups with blank lines between them.
- class: rationale-example
- source: plugins/claude-kit/skills/csharp-style/SKILL.md:13
- provenance: f8c0649 2026-06-10, INIT.
- verdict: retire
- reason: Reference §3 carries the label list whole (five labels, this sentence names three) with a cited file example, and checklist C051 still names the `// Group.` form in SKILL.md, so the grouping rule loses nothing. The labels, for the record: `// Values.` static comparers and computed defaults; `// Mapper.` the AutoMapper instance; `// Services.` injected dependencies; `// Settings.` `IOptionsMonitor<T>`; `// State.` mutable state, rare.
- proposed: Cut the second sentence of philosophy point 2, leaving the grouping rule; the canonical labels live in reference §3.
- proposed: (via A022) Cut the second sentence of philosophy point 2, leaving the grouping rule; the canonical labels live in reference §3.
- baseline-test: yes

### C011
- key: Register DI services with `.AsImplementedInterfaces().PreserveExistingDefaults()`.
- class: mechanic
- source: plugins/claude-kit/skills/csharp-style/SKILL.md:14
- provenance: f8c0649 2026-06-10, INIT.
- verdict: keep
- reason: The one concrete C# instance of the idempotence principle in the philosophy; strip it and point 3 is the bare word "idempotent". The checklist C061 adds the file and the grouping as the gate.

### C012
- key: Write code that is idempotent, so it never breaks on re-execution.
- class: rule
- source: plugins/claude-kit/skills/csharp-style/SKILL.md:14
- provenance: f8c0649 2026-06-10, INIT.
- verdict: keep
- reason: The SQL skill states the same principle for deployment scripts; each language's skill owns its own artifact, so neither points at the other.

### C013
- key: Organize every class with `#region Title` / `#endregion` banners rather than inline narration.
- class: rule
- source: plugins/claude-kit/skills/csharp-style/SKILL.md:15
- provenance: f8c0649 2026-06-10, INIT.
- verdict: keep
- reason: Signature trait; the canonical order lives in checklist C050 and reference §2 as the gate and the detail of this principle.

### C014
- key: When in doubt, find an existing file solving a similar shape and follow its layout exactly.
- class: rule
- source: plugins/claude-kit/skills/csharp-style/SKILL.md:16
- provenance: f8c0649 2026-06-10, INIT; bounded to code already in this style by 830ff28 2026-06-17.
- verdict: keep
- reason: The "highly self-similar" clause is the premise that a sibling exists and the search is worth running; the Precedence section bounds it. The SQL twin is per-language.

### C015
- key: In a greenfield repo with no sibling to mimic, follow the exemplar in this document and the full template in the reference.
- class: rule
- source: plugins/claude-kit/skills/csharp-style/SKILL.md:16
- provenance: f8c0649 2026-06-10, INIT.
- verdict: keep
- reason: Sends the reader to this language's exemplar and templates; a pointer to the SQL twin would name the wrong language.

### C016
- key: Let a repository's mechanically-enforced contract override this style, and nothing softer than one.
- class: rule
- source: plugins/claude-kit/skills/csharp-style/SKILL.md:20
- provenance: 830ff28 2026-06-17, "Fork Improvements and Session Mining", which installed style precedence in the doctrine and both style skills as one change.
- verdict: keep
- reason: The doctrine owns the principle; the skill's Precedence section is a deliberate whole copy for the path where a subagent holds this skill by path and not the doctrine (the 2026-07-30 kaizen brief records a reviewer that had neither). A pointer fails that path. The map's form for a copy is a parity pin, and none pins this section: that is a pin to add, not wording to cut.

### C017
- key: Absent a mechanically-enforced contract, treat this style as the default authority and do not treat a legacy sibling as authority on its own.
- class: rule
- source: plugins/claude-kit/skills/csharp-style/SKILL.md:20
- provenance: 830ff28 2026-06-17, as C016.
- verdict: keep
- reason: As C016: doctrine principle, deliberate copy for the subagent path, SQL twin per-language.

### C018
- key: Do not use the mimic-a-sibling rule as a reason to abandon this style in a foreign repo.
- class: rule
- source: plugins/claude-kit/skills/csharp-style/SKILL.md:20
- provenance: 830ff28 2026-06-17, as C016; the session mining found sessions dropping the style to match a foreign repo's siblings.
- verdict: keep
- reason: This clause closes the loophole philosophy point 5 opens; the SQL reference's unbounded sibling sentence is not a runtime conflict for a C# decision and sits under its own SKILL.md bound.

### C019
- key: Write the section comments so that the comments alone tell the story of the method, as the exemplar method shows.
- class: rationale-example
- source: plugins/claude-kit/skills/csharp-style/SKILL.md:55
- provenance: f8c0649 2026-06-10, INIT.
- verdict: keep
- reason: A self-check a session can run on its own method (read only the comments), which neither C003 nor C005 states; it is a procedure rather than a why.

### C020
- key: To find one thing in a C# file past roughly 1,000 lines, take an outline in three greps instead of reading the file.
- class: rule
- source: plugins/claude-kit/skills/csharp-style/SKILL.md:59
- provenance: ddd6c72 2026-08-23, the process-rule-repairs plan: the doctrine's own language patterns failed against the corpus, a consult found language anchors cannot live in a language-agnostic surface, and the anchors moved here under a two-ended parity pin.
- verdict: keep
- reason: The ownership map assigns the principle to the doctrine and the recipe to this skill (rows 44 and 45); test/doctrine-parity.test.js:465-490 pins that the doctrine routes here and this section exists. The trigger clause is the minimum a recipe says about when it applies.

### C021
- key: Grep types with `^\s*((public|private|protected|internal|sealed|static|abstract|partial|readonly|file)\s+)*(class|interface|record|struct|enum)\s+\w`.
- class: mechanic
- source: plugins/claude-kit/skills/csharp-style/SKILL.md:61
- provenance: ddd6c72 2026-08-23, run against real files before landing; c6f08c5 corrected the nested-type accessibility prose beside it.
- verdict: keep
- reason: No finding. The optional modifier group is load-bearing (C028); nothing pins the pattern text, so a session that "tightens" it drops modifier-less nested types.

### C022
- key: Grep members with `^\s*(public|private|protected|internal)\b.*\(`, piped through `grep -vE '^[^(]*= '` and `grep -v '{ get'`.
- class: mechanic
- source: plugins/claude-kit/skills/csharp-style/SKILL.md:62
- provenance: ddd6c72 2026-08-23, as C021.
- verdict: keep
- reason: No finding. The `\b` and the paren-anchored filter are load-bearing (C024, C026); this pattern returns nothing on an interface file (C030).

### C023
- key: Grep regions with `^\s*#region` and take the results verbatim.
- class: mechanic
- source: plugins/claude-kit/skills/csharp-style/SKILL.md:63
- provenance: ddd6c72 2026-08-23, as C021.
- verdict: keep
- reason: No finding. On a file in canonical region order this grep alone is the map (C035).

### C024
- key: Keep the `\b` in the member pattern so ordinary body statements stay out of the outline.
- class: rule
- source: plugins/claude-kit/skills/csharp-style/SKILL.md:65
- provenance: ddd6c72 2026-08-23; the plan's review demanded each load-bearing detail be stated with what breaks without it, and c6f08c5 re-measured the figures with the shipped patterns.
- verdict: rewrite
- reason: The rule and its failure shape stay; only the measured counts in the paragraph move here (A050). Safe because the shapes, which are what stop a later session from simplifying the regex, remain in the document.
- proposed: Keep each of the three rules with its failure shape (body-line collision, default-parameter destruction, modifier-less nested type dropped); move the measured counts and file sizes to this ledger.
- baseline-test: yes

### C025
- key: Without the `\b`, `^\s*(public).*\(` matches a body line reading `publicKey.Validate(id);` and neither filter removes it.
- class: rationale-example
- source: plugins/claude-kit/skills/csharp-style/SKILL.md:65
- provenance: ddd6c72 2026-08-23; c6f08c5 records that this illustrative line came from the author's probe file rather than the corpus.
- verdict: rewrite
- reason: The collision example stays as the shape; the clause moving here: the identifier has to open with a modifier's own letters for the collision to happen, so the shape is rarer than it looks rather than absent, and the boundary costs nothing to keep.
- proposed: Keep the collision example; move the "rarer than it looks, costs nothing to keep" clause to the ledger.
- baseline-test: yes

### C026
- key: Anchor the member filter before the paren rather than using a bare `grep -v '= '`.
- class: rule
- source: plugins/claude-kit/skills/csharp-style/SKILL.md:65
- provenance: ddd6c72 2026-08-23, as C024.
- verdict: rewrite
- reason: The rule and the default-parameter failure shape stay; the measurement moves here (C027). The bare filter is the obvious mechanization and the one a session reaches for first, which is why the shape must stay in the text.

### C027
- key: A bare `grep -v '= '` destroyed 32 real signatures on a 4,347-line API client because default parameter values such as `CancellationToken cancellationToken = default` are this style's own idiom.
- class: rationale-example
- source: plugins/claude-kit/skills/csharp-style/SKILL.md:65
- provenance: ddd6c72 2026-08-23, measured on a real file; c6f08c5 confirmed the figures were re-measured with the shipped patterns.
- verdict: rewrite
- reason: The default-parameter clause stays as the failure shape; the measurement moves here: on a 4,347-line API client the bare filter removed 32 real signatures, every one carrying `= default` or a similar default value.
- proposed: Keep the default-parameter failure shape; move the count and file size to the ledger.
- baseline-test: yes

### C028
- key: Keep the modifier group in the type pattern optional so modifier-less nested types are found.
- class: rule
- source: plugins/claude-kit/skills/csharp-style/SKILL.md:65
- provenance: ddd6c72 2026-08-23; c6f08c5 corrected the accessibility statement (a nested type with no modifier is implicitly private, not internal) after the reviewers caught it.
- verdict: rewrite
- reason: The rule and its legality bound stay; the measurement moves here (C029). The accessibility correction is the reason the bound reads "only a top-level type defaults to internal", so do not "simplify" it back.

### C029
- key: Requiring a modifier dropped `class RateLimitedClient` from a 3,290-line service, leaving an outline showing one owner for two types.
- class: rationale-example
- source: plugins/claude-kit/skills/csharp-style/SKILL.md:65
- provenance: ddd6c72 2026-08-23, measured on a real file.
- verdict: rewrite
- reason: The nested-type failure shape stays; the instance moves here: with the modifier group required, `class RateLimitedClient` vanished from a 3,290-line service and the outline showed one owner for two types' members.
- proposed: Keep the nested-type failure shape; move the class name and file size to the ledger.
- baseline-test: yes

### C030
- key: On an interface file, take members with `^[[:space:]]+[A-Za-z_][^;=]*[[:space:]]+[A-Za-z_][A-Za-z0-9_<>]*[[:space:]]*\(` instead of the modifier-anchored member grep.
- class: mechanic
- source: plugins/claude-kit/skills/csharp-style/SKILL.md:67
- provenance: c6f08c5 2026-08-23, the finishing pass of the process-rule-repairs plan, added because the anchored grep gives no sign that it missed anything on an interface.
- verdict: keep
- reason: No finding on this claim. The hole is silent (an empty member list looks like a complete outline), so the bound "where the type grep shows the file is an interface" is the only trigger a session has.

### C031
- key: Do not use the interface member pattern on an ordinary class file.
- class: rule
- source: plugins/claude-kit/skills/csharp-style/SKILL.md:67
- provenance: c6f08c5 2026-08-23, as C030.
- verdict: rewrite
- reason: The prohibition and its declaration-versus-call reason stay; the paragraph's two measurements move here (C032, C064). Safe because the hole statement, the pattern, the bound and the modifier-less-member note all remain.
- proposed: Keep the hole, the interface pattern, the class-file prohibition with its declaration-versus-call reason, and the modifier-less-member note; move both measurements to the ledger.
- baseline-test: yes

### C032
- key: On a class file the interface pattern cannot tell a declaration from a call and returned 262 lines against 202 real members.
- class: rationale-example
- source: plugins/claude-kit/skills/csharp-style/SKILL.md:67
- provenance: c6f08c5 2026-08-23, measured.
- verdict: rewrite
- reason: The declaration-versus-call clause stays; the measurement moves here: on an ordinary class file the unanchored pattern returned 262 lines against 202 real members, the excess being call sites.
- proposed: Keep the declaration-versus-call clause; move the count to the ledger.
- baseline-test: yes

### C033
- key: When a declaration appears in both the type and member lists, read the repeat as confirmation rather than as two separate things.
- class: rule
- source: plugins/claude-kit/skills/csharp-style/SKILL.md:69
- provenance: ddd6c72 2026-08-23.
- verdict: keep
- reason: The positional-record and primary-constructor clause is the bound that tells a session when a repeat is expected; without it a repeat reads as a duplicate declaration.

### C034
- key: Take the `#region` labels verbatim rather than summarizing them.
- class: rule
- source: plugins/claude-kit/skills/csharp-style/SKILL.md:69
- provenance: ddd6c72 2026-08-23.
- verdict: keep
- reason: Region labels are the section structure in this style and carry intent the code does not state; a summarized label loses exactly that.

### C035
- key: Region labels carry the author intent and spec cross-references the code never states, and on a file in the canonical region order they are the whole map.
- class: rationale-example
- source: plugins/claude-kit/skills/csharp-style/SKILL.md:69
- provenance: ddd6c72 2026-08-23.
- verdict: keep
- reason: Half of it is a reading instruction (on a canonical file the region grep alone suffices) and the other half tells a session what summarizing would lose; neither is a bare why.

### C036
- key: Declare a namespace file-scoped (`namespace X;`) in a new file, and leave existing block-scoped files alone.
- class: rule
- source: plugins/claude-kit/skills/csharp-style/SKILL.md:73
- provenance: f8c0649 2026-06-10, INIT; 058e3a3 2026-07-24 re-scoped it to "when a new file declares a namespace at all" after the PrePass review, in the antipattern and reference §1 together.
- verdict: keep
- reason: Incident-born re-scoping; the reference is this skill's detail layer, not a second owner.

### C037
- key: Keep namespaces coarse and minimal, and never map folders to sub-namespaces.
- class: rule
- source: plugins/claude-kit/skills/csharp-style/SKILL.md:73
- provenance: 058e3a3 2026-07-24, the PrePass hand-edit review: Claude had generated folder-mirroring sub-namespaces.
- verdict: keep
- reason: Incident-born, the habit recurs on every new file, and no analyzer in the kit enforces namespace shape.

### C038
- key: Never write apologetic or explanatory comments such as "This handles the case where..."; write imperative section labels.
- class: rule
- source: plugins/claude-kit/skills/csharp-style/SKILL.md:74
- provenance: f8c0649 2026-06-10, INIT, in the "common AI habits" list; 058e3a3 confirmed the bans stand beside the sharpened voice rule.
- verdict: keep
- reason: The antipattern is the observed-habit side of C005 with its specimen; the list exists to name the habits a model falls into, which is the incident class.

### C039
- key: Never write change-narrative comments; a comment states what the code does now, never the session, the change, or the prior version.
- class: rule
- source: plugins/claude-kit/skills/csharp-style/SKILL.md:75
- provenance: cabbf89 2026-06-28, the doc-closeout-discipline plan (docs/archive/claude-kit_doc-closeout-discipline_spec_v1.md): the doctrine's current-state rule, the two style-skill antipatterns and the implementer-brief forwarding, baseline-tested under mimicry and deferral pressure.
- verdict: keep
- reason: The bullet already cites the doctrine and adds the C# instance for the subagent path; the wording was baseline-tested, so cutting it to a bare pointer discards that evidence.

### C040
- key: Never leave a section comment without a terminating period: write `// Save Services.` not `// Save Services`.
- class: mechanic
- source: plugins/claude-kit/skills/csharp-style/SKILL.md:76
- provenance: f8c0649 2026-06-10, INIT.
- verdict: keep
- reason: The right/wrong specimen is the antipattern surface of C004; the reference's match-the-file note governs editing legacy group labels in `RegisterServices.cs`, not a section comment a session writes.

### C041
- key: Give every `Task<T>` method the `Async` suffix.
- class: rule
- source: plugins/claude-kit/skills/csharp-style/SKILL.md:77
- provenance: f8c0649 2026-06-10, INIT.
- verdict: keep
- reason: Antipattern surface; checklist C056 is its gate and widens it to all `Task` methods.

### C042
- key: Place `CancellationToken` last in the parameter list.
- class: rule
- source: plugins/claude-kit/skills/csharp-style/SKILL.md:78
- provenance: f8c0649 2026-06-10, INIT.
- verdict: keep
- reason: Antipattern surface; checklist C056 is its gate and adds the pass-down-the-chain clause.

### C043
- key: Never remove `#region` blocks on the grounds that modern style dislikes them.
- class: rule
- source: plugins/claude-kit/skills/csharp-style/SKILL.md:79
- provenance: f8c0649 2026-06-10, INIT.
- verdict: keep
- reason: No finding. Names the exact argument a model makes when refactoring, which is the habit the list guards.

### C044
- key: Never use the null-forgiving operator `!`; use null-conditional and null-coalescing instead.
- class: rule
- source: plugins/claude-kit/skills/csharp-style/SKILL.md:80
- provenance: f8c0649 2026-06-10, INIT.
- verdict: keep
- reason: Antipattern surface; reference §10 is the detail layer of the same owner.

### C045
- key: Never put inline SQL text in application code; route data access through stored procedures with `CommandType.StoredProcedure`.
- class: rule
- source: plugins/claude-kit/skills/csharp-style/SKILL.md:81
- provenance: f8c0649 2026-06-10, INIT.
- verdict: keep
- reason: The doctrine's Defaults bullet owns the data-access default; this bullet carries the .NET call form, the language-scoped instance the map assigns to the style skill.

### C046
- key: The connection's principal is EXECUTE-only by design, so inline SQL is an architecture violation rather than a shortcut.
- class: rationale-example
- source: plugins/claude-kit/skills/csharp-style/SKILL.md:81
- provenance: f8c0649 2026-06-10, INIT.
- verdict: retire
- reason: The doctrine's Defaults bullet (operating-instructions/SKILL.md:36) states the EXECUTE-only fact whole and owns it; this copy is a duplicate. The why, for the record: the application connection principal holds EXECUTE only, so inline SQL fails at runtime under the intended grants and passes only where a developer widened them.
- proposed: Cut the clause after the semicolon in the inline-SQL antipattern; the doctrine and this ledger carry the why.
- proposed: (via A077) Cut the clause after the semicolon in the inline-SQL antipattern; the doctrine and this ledger carry the why.
- baseline-test: yes

### C047
- key: Resolve configuration options lazily at request time rather than once at startup.
- class: rule
- source: plugins/claude-kit/skills/csharp-style/SKILL.md:82
- provenance: 6b3cbec 2026-07-26, the doctrine-rightsizing plan (docs/archive/claude-kit_doctrine-rightsizing_spec_v1.md, edit E11) relocated it from the doctrine's "Don't waste your own moves" to this skill as its point-of-action home, with item-by-item operator approval. The original doctrine install narrates no incident.
- verdict: keep
- reason: Deliberately relocated here; reference §11 carries the `IOptionsMonitor<T>` / `.CurrentValue` mechanic as the detail layer.

### C048
- key: An eager startup read of configuration bakes in defaults and silently bypasses test overrides.
- class: rationale-example
- source: plugins/claude-kit/skills/csharp-style/SKILL.md:82
- provenance: 6b3cbec 2026-07-26, as C047.
- verdict: retire
- reason: The rule and the mechanic stand without it. The why, for the record: a value read once at startup is fixed before a test's configuration override is applied, so the override is silently ignored and the test exercises the default.
- proposed: Cut the clause after the dash in the configuration antipattern; the ledger carries the why.
- baseline-test: yes

### C049
- key: Order middleware by cost rather than convenience, putting cheap rejection such as rate limiting before expensive work such as authentication.
- class: rule
- source: plugins/claude-kit/skills/csharp-style/SKILL.md:83
- provenance: 6b3cbec 2026-07-26, as C047.
- verdict: keep
- reason: No finding. Relocated here on purpose; no analyzer checks pipeline order.

### C050
- key: Wrap each major section in `#region` / `#endregion` in the canonical order: Constants, Variables, Constructor, public method-group regions, Private Methods.
- class: mechanic
- source: plugins/claude-kit/skills/csharp-style/SKILL.md:87
- provenance: f8c0649 2026-06-10, INIT.
- verdict: keep
- reason: The completion gate for C013 and the one place in SKILL.md the canonical order appears; the outline section (C035) relies on that order being known.

### C051
- key: Name private fields `_camelCase`, mark injected dependencies `readonly`, and group fields under `// Group.` labels.
- class: mechanic
- source: plugins/claude-kit/skills/csharp-style/SKILL.md:88
- provenance: f8c0649 2026-06-10, INIT.
- verdict: keep
- reason: The gate for C009 plus the two naming mechanics; after C010 retires this is where SKILL.md names the `// Group.` label form.

### C052
- key: With 2+ constructor parameters, put one per line at 8-space indent with the closing `)` on its own line, and open the body with `// Save Services.`.
- class: mechanic
- source: plugins/claude-kit/skills/csharp-style/SKILL.md:89
- provenance: f8c0649 2026-06-10, INIT.
- verdict: keep
- reason: CSharpier via format-on-edit.js re-lays out parameters where a repo has it installed, which is the mechanically-enforced contract C016 already yields to; it is not machinery enforcing this line, so the line is not superseded.

### C053
- key: Write in-method section comments as `// Title.` with a terminating period and a blank line before each.
- class: mechanic
- source: plugins/claude-kit/skills/csharp-style/SKILL.md:90
- provenance: f8c0649 2026-06-10, INIT.
- verdict: keep
- reason: The gate for C004 and the only SKILL.md statement of the blank-line-before convention; the reference's "preferred" is the detail layer admitting the exception a gate does not.

### C054
- key: Use early returns with `default` rather than `null`, `is null` / `is not null` for null checks, and `??=` for late initialization.
- class: mechanic
- source: plugins/claude-kit/skills/csharp-style/SKILL.md:91
- provenance: f8c0649 2026-06-10, INIT.
- verdict: keep
- reason: The reference's early-return example (`if (document == null) return default;`) contradicts both this line and the reference's own `is null` rule two lines later; this line is the right side and the example gives way.

### C055
- key: Prefer collection expressions and spreads over older constructions: `[.. source.Where(...)]` over `.ToArray()`, `[item]` over `new[] { item }`, `[.. existing, item]` over `Append`/`Concat` plus `ToArray`.
- class: mechanic
- source: plugins/claude-kit/skills/csharp-style/SKILL.md:92
- provenance: 058e3a3 2026-07-24, grounded in a real data-loss bug: a discarded `Enumerable.Append` result in the source session.
- verdict: keep
- reason: Incident-born (a discarded `Append` return silently lost data) and the spread form makes that shape impossible; no analyzer enforces it.

### C056
- key: Put the Async suffix on all `Task` methods and pass `CancellationToken` last and down the whole chain.
- class: rule
- source: plugins/claude-kit/skills/csharp-style/SKILL.md:93
- provenance: f8c0649 2026-06-10, INIT.
- verdict: keep
- reason: The gate for C041 and C042, and the only SKILL.md statement of pass-down-the-chain and of the widening from `Task<T>` to all `Task`.

### C057
- key: Order `using` lines with System.* first, then project and third-party namespaces with third-party placed where convenient, and no blank lines between groups.
- class: mechanic
- source: plugins/claude-kit/skills/csharp-style/SKILL.md:94
- provenance: adf3d51 2026-07-24, a prior kit audit found the checklist prescribing a strict order its own reference contradicted and repaired it to match, recording that the reference stays the owner.
- verdict: keep
- reason: Already adjudicated once: a one-line summary with a §1 pointer, the reference owning the detail. Re-ordering the checklist against the reference is the drift that audit repaired.

### C058
- key: Do not write file-header comments.
- class: rule
- source: plugins/claude-kit/skills/csharp-style/SKILL.md:94
- provenance: f8c0649 2026-06-10, INIT (the line's last touch, adf3d51, changed only the using order beside it).
- verdict: keep
- reason: Gate line; reference §1 enumerates the banned header kinds as the detail layer.

### C059
- key: Log via `ILogger<T>` as the preferred pattern, or the static Serilog `Log` where existing code uses it.
- class: rule
- source: plugins/claude-kit/skills/csharp-style/SKILL.md:95
- provenance: 7964c7e 2026-06-28, "Style Cleanups", which deleted the INIT antipattern banning `ILogger<T>` and made it the preferred pattern in the checklist and reference §8 together; the message states no reason.
- verdict: keep
- reason: A deliberate reversal of an INIT ban; the reference's match-the-surrounding-file bound is the detail layer of the same rule.

### C060
- key: End log messages with a period, as in `logger.LogError(ex, "Message.")` or `Log.Error(ex, "Message.")`.
- class: rule
- source: plugins/claude-kit/skills/csharp-style/SKILL.md:95
- provenance: f8c0649 2026-06-10, INIT; 7964c7e added the second example when `ILogger<T>` became preferred.
- verdict: keep
- reason: The two examples show the period inside the string literal for both logger shapes, which is the thing a session gets wrong.

### C061
- key: Put DI registration in `Assembly/RegisterServices.cs` using `.AsImplementedInterfaces().PreserveExistingDefaults()`, grouped by domain label.
- class: mechanic
- source: plugins/claude-kit/skills/csharp-style/SKILL.md:96
- provenance: f8c0649 2026-06-10, INIT.
- verdict: keep
- reason: The gate for C011 with the file and grouping added; reference §11 is the detail layer.

### C062
- key: Declare a class's interface inline as `public class FooService : IFooService` and put the interface in `Interfaces/IFooService.cs`.
- class: mechanic
- source: plugins/claude-kit/skills/csharp-style/SKILL.md:97
- provenance: f8c0649 2026-06-10, INIT; 058e3a3 2026-07-24 promoted the Interfaces/ placement from this checklist mention to an explicit reference §1 rule after the PrePass review found co-located interfaces.
- verdict: keep
- reason: Incident-born placement rule; the reference's rule was grown from this line on purpose, so both stand as gate and detail.

### C063
- key: Add XML `/// <summary>` docs on public members where they earn their keep and are well written, not as boilerplate.
- class: rule
- source: plugins/claude-kit/skills/csharp-style/SKILL.md:97
- provenance: 7964c7e 2026-06-28, as C008: the reversal of the INIT "no XML docs" stance, installed in philosophy and checklist together.
- verdict: keep
- reason: The gate for C008; both landed in one edit as principle and gate.

### C064
- key: Cite the 885-line service interface, which the anchored member grep returns as zero members though it carries 67, as evidence the anchored pattern misses interface members.
- class: rationale-example
- source: plugins/claude-kit/skills/csharp-style/SKILL.md:67
- provenance: c6f08c5 2026-08-23, measured in the finishing pass of the process-rule-repairs plan.
- verdict: retire
- reason: The hole statement (the anchored grep returns nothing on an interface file) stays as C030's bound; the measurement moves here: an 885-line service interface returned zero members under the anchored grep while carrying 67, all of which the interface pattern found.
- proposed: Cut the "measured, an 885-line service interface returns zero members under it while carrying 67" clause; the ledger carries it.
- baseline-test: yes

## plugins/claude-kit/skills/csharp-style/references/csharp-style.md

This document is the detailed pattern reference for the operator's C# house style, using a generic document-processing library as its worked example shape. It owns every moment in which C# is written or modified: file layout and using order, namespace shape, class organization into #region blocks, field naming and grouping, constructor form, method declarations, method-body section comments, async and cancellation patterns, logging, exception handling, null handling, Autofac DI registration, naming conventions, MediatR notifications, models and settings classes, whitespace and indentation, and the skeleton for a brand-new service. A session loads it before writing or changing any C# code, which is a named-trigger load class (inferred, since the document itself states no loading rule and its content is a per-act pattern reference rather than standing doctrine).

Extracted at `6bc07fb`: whole document (`skills.csharp-style.references.csharp-style.md`).

### C001
- key: Substitute the target project's own namespaces and type names for the example names rather than copying the example names literally.
- class: rule
- source: plugins/claude-kit/skills/csharp-style/references/csharp-style.md:3
- provenance: 830ff28 2026-06-17, the fork-improvements commit that genericized the repo-specific example names (ASR.Eleos) after the reference had been written against one real library; a8770b3 2026-06-28 only reworded it to first person.
- verdict: keep
- reason: Nothing mechanical checks a generated file for copied placeholder names, so the copy-the-example-literally failure recurs; the SQL reference states the same rule for its own identifiers because neither document is loaded when the other language is written.

### C002
- key: Open a sibling file in the library and follow its layout exactly.
- class: rule
- source: plugins/claude-kit/skills/csharp-style/references/csharp-style.md:3
- provenance: f8c0649 2026-06-10 installed the sibling instruction; 830ff28 2026-06-17 added the "already written in this style" bound alongside the SKILL's Precedence section.
- verdict: keep
- reason: The bound is the whole point: mimicry is for staying consistent inside code already in this style, never a reason to follow a foreign repo, and the SKILL's Precedence paragraph is what a session reads when the two collide.

### C003
- key: Order using statements System.* first, then convenient third-party such as Serilog, then project namespaces, then other third-party such as AutoMapper and MediatR.
- class: mechanic
- source: plugins/claude-kit/skills/csharp-style/references/csharp-style.md:30
- provenance: f8c0649 2026-06-10, the kit's initial commit, which distilled the reference from the operator's own document-processing library.
- verdict: keep
- reason: The SKILL checklist cites "reference §1" for this ordering, so the reference is the only place the full order and its not-strictly-alphabetical bound are stated.

### C004
- key: Put no blank lines between the using-statement groups.
- class: mechanic
- source: plugins/claude-kit/skills/csharp-style/references/csharp-style.md:35
- provenance: f8c0649 2026-06-10.
- verdict: keep
- reason: This is the owning statement of the rule, sitting inside the using-order list where a session reads it while writing the block; §15's repeat (C114) retires to it.

### C005
- key: Put a single blank line between the using block and the namespace declaration.
- class: mechanic
- source: plugins/claude-kit/skills/csharp-style/references/csharp-style.md:37
- provenance: f8c0649 2026-06-10.
- verdict: keep
- reason: No finding; a formatter is optional in a target repo and the file-head shape is stated nowhere else.

### C006
- key: Prefer the simplest namespace shape: plugin assemblies declare no namespace at all, and a warranted namespace is typically one root namespace per project.
- class: rule
- source: plugins/claude-kit/skills/csharp-style/references/csharp-style.md:39
- provenance: 058e3a3 2026-07-24, delta 1 of the PrePass hand-edit review, where Claude-authored C# had declared namespaces the operator's plugin assemblies do not use.
- verdict: keep
- reason: Incident-born and unenforced by any hook; the counter-example namespaces name the exact shape the review rejected.

### C007
- key: Never let folders generate sub-namespaces mirroring the folder tree; folders organize files only.
- class: rule
- source: plugins/claude-kit/skills/csharp-style/references/csharp-style.md:39
- provenance: 058e3a3 2026-07-24, same PrePass delta as C006.
- verdict: keep
- reason: Folder-mirrored namespaces are the default habit of every C# generator, and nothing in the tree refuses them mechanically.

### C008
- key: Declare a namespace file-scoped with a semicolon.
- class: mechanic
- source: plugins/claude-kit/skills/csharp-style/references/csharp-style.md:39
- provenance: f8c0649 2026-06-10 installed the file-scoped rule; 058e3a3 2026-07-24 rescoped it to "when a new file declares a namespace" so it no longer implied every file declares one.
- verdict: keep
- reason: The rescoping is load-bearing beside C006: without it the file-scoped rule reads as requiring a namespace in every file.

### C009
- key: Write the file-scoped namespace as `namespace Acme.Documents;`.
- class: rationale-example
- source: plugins/claude-kit/skills/csharp-style/references/csharp-style.md:41
- provenance: f8c0649 2026-06-10 installed the specimen; a8770b3 2026-06-28 only replaced the real library name with the generic one.
- verdict: keep
- reason: Two words showing the semicolon terminator; the ledger cannot hold it more cheaply than the line does.

### C010
- key: Leave existing block-scoped namespace files as they are, and write only new files file-scoped.
- class: rule
- source: plugins/claude-kit/skills/csharp-style/references/csharp-style.md:43
- provenance: f8c0649 2026-06-10.
- verdict: keep
- reason: The owning statement of the leave-alone rule, and it already names `Assembly/RegisterServices.cs` as its example, which is why §11's repeat (C089) retires to it.

### C011
- key: Write no file-level header comments: no copyright, no author block, no license; begin files with `using`.
- class: rule
- source: plugins/claude-kit/skills/csharp-style/references/csharp-style.md:45
- provenance: f8c0649 2026-06-10.
- verdict: keep
- reason: The three named header kinds are the habitual additions the rule exists to stop and no hook strips one from a written file, so the enumeration keeps.

### C012
- key: Put interfaces in an `Interfaces/` folder, never co-located with their implementations.
- class: rule
- source: plugins/claude-kit/skills/csharp-style/references/csharp-style.md:47
- provenance: 058e3a3 2026-07-24, delta 2, which promoted this "from a s16/checklist mention to an explicit rule in reference s1" after the PrePass review found co-located interfaces.
- verdict: keep
- reason: The commit made this line the owner by design; §16's closing step (C119) is the procedure's pointer to it, not a rival.

### C013
- key: Open a file with the ordered usings, a blank line, the file-scoped namespace, then the class declaration, as `Services/Build/FormService.cs:1-13` shows.
- class: rationale-example
- source: plugins/claude-kit/skills/csharp-style/references/csharp-style.md:49
- provenance: f8c0649 2026-06-10; 830ff28 2026-06-17 genericized the names inside it.
- verdict: keep
- reason: The specimen is the only place the "third-party where convenient" slot is actually placed (Serilog mid-list, a trailing `System.Threading`), which the prose explicitly leaves loose.

### C014
- key: Organize a class into `#region` blocks in the order Constants, Variables, Constructor, public method-group regions, Private Methods.
- class: mechanic
- source: plugins/claude-kit/skills/csharp-style/references/csharp-style.md:68
- provenance: f8c0649 2026-06-10.
- verdict: keep
- reason: The canonical order is cited outside this skill (the outline recipe in `csharp-style/SKILL.md` reads regions as the file's map), so the full statement stays here.

### C015
- key: Put `private const string` declarations in `#region Constants`, and omit the region when there are none.
- class: mechanic
- source: plugins/claude-kit/skills/csharp-style/references/csharp-style.md:70
- provenance: f8c0649 2026-06-10.
- verdict: keep
- reason: No finding; the omit-if-empty clause is stated nowhere else.

### C016
- key: Put private fields in `#region Variables`, grouped by purpose with `// Group.` labels.
- class: mechanic
- source: plugins/claude-kit/skills/csharp-style/references/csharp-style.md:71
- provenance: 830ff28 2026-06-17 (em-dash replacement over the f8c0649 2026-06-10 original).
- verdict: keep
- reason: No finding; the region's contents rule.

### C017
- key: Put the single constructor in `#region Constructor` with parameters one per line.
- class: mechanic
- source: plugins/claude-kit/skills/csharp-style/references/csharp-style.md:72
- provenance: 830ff28 2026-06-17 (em-dash replacement over the f8c0649 2026-06-10 original).
- verdict: keep
- reason: Placement, not the single-constructor rule, which C030 owns; only the word "single" is shared.

### C018
- key: Name each public method-group region for what its methods do, such as `#region Form Processing`.
- class: mechanic
- source: plugins/claude-kit/skills/csharp-style/references/csharp-style.md:73
- provenance: 830ff28 2026-06-17 (em-dash replacement over the f8c0649 2026-06-10 original).
- verdict: keep
- reason: No finding; the naming rule is what makes region labels carry author intent for the outline recipe.

### C019
- key: Put `#region Private Methods` at the bottom of the class, optionally with nested regions for sub-themes.
- class: mechanic
- source: plugins/claude-kit/skills/csharp-style/references/csharp-style.md:74
- provenance: 830ff28 2026-06-17 (em-dash replacement over the f8c0649 2026-06-10 original).
- verdict: keep
- reason: The nested-region permission is stated only here.

### C020
- key: Close every `#region` with a matching `#endregion` and never leave a region open.
- class: rule
- source: plugins/claude-kit/skills/csharp-style/references/csharp-style.md:76
- provenance: f8c0649 2026-06-10.
- verdict: keep
- reason: No finding; an unclosed region breaks the file and no formatter in the kit's hook chain repairs one.

### C021
- key: Align `#region` and `#endregion` lines with the region's contents, four spaces inside a class, not with the class brace.
- class: mechanic
- source: plugins/claude-kit/skills/csharp-style/references/csharp-style.md:78
- provenance: f8c0649 2026-06-10.
- verdict: keep
- reason: No finding, and this is one rule CSharpier does not impose, since preprocessor directives are left where the author put them.

### C022
- key: Lay a class out as the skeleton shows: Constants, Variables with group labels, Constructor, a named processing region, then Private Methods with nested themed regions.
- class: rationale-example
- source: plugins/claude-kit/skills/csharp-style/references/csharp-style.md:81
- provenance: f8c0649 2026-06-10.
- verdict: keep
- reason: The skeleton carries what the prose does not: the nested Private Methods regions indented a further four spaces, which C021 states only for the outer level.

### C023
- key: Name private fields `_camelCase` with a leading underscore.
- class: mechanic
- source: plugins/claude-kit/skills/csharp-style/references/csharp-style.md:139
- provenance: f8c0649 2026-06-10.
- verdict: keep
- reason: Reference §3 is the owner; the SKILL checklist carries the twelve-word summary.

### C024
- key: Mark all injected dependencies `readonly`.
- class: rule
- source: plugins/claude-kit/skills/csharp-style/references/csharp-style.md:140
- provenance: f8c0649 2026-06-10.
- verdict: keep
- reason: Reference §3 is the owner; nothing enforces it.

### C025
- key: Use `private const` for compile-time constants, named `camelCase` for local scoped strings and `SCREAMING_SNAKE_CASE` for cross-cutting markers.
- class: mechanic
- source: plugins/claude-kit/skills/csharp-style/references/csharp-style.md:141
- provenance: 830ff28 2026-06-17 (em-dash replacement over the f8c0649 2026-06-10 original).
- verdict: keep
- reason: No finding; the two-casing split is stated only here and contradicts the default C# convention, so it cannot be inferred.

### C026
- key: Name static computed comparison properties in PascalCase, such as `IgnoreCase` and `IgnoreCaseComparer`.
- class: mechanic
- source: plugins/claude-kit/skills/csharp-style/references/csharp-style.md:142
- provenance: f8c0649 2026-06-10.
- verdict: keep
- reason: No finding; these look like fields and would otherwise take the `_camelCase` rule.

### C027
- key: Inside `#region Variables`, group fields under single-line `// Group.` label comments with a blank line between groups.
- class: mechanic
- source: plugins/claude-kit/skills/csharp-style/references/csharp-style.md:144
- provenance: f8c0649 2026-06-10.
- verdict: keep
- reason: The owning statement, stated where the grouping rule lives; §15's blank-line repeat (C112) retires to it.

### C028
- key: Use the common group labels `// Values.`, `// Mapper.`, `// Services.`, `// Settings.`, and `// State.` for their stated contents.
- class: mechanic
- source: plugins/claude-kit/skills/csharp-style/references/csharp-style.md:146
- provenance: 830ff28 2026-06-17 (em-dash replacement over the f8c0649 2026-06-10 original).
- verdict: keep
- reason: All five labels with what each holds appear only here; the SKILL names three as illustration.

### C029
- key: Write the Variables region as the `Services/Build/FormService.cs:20-31` example shows, with Values, Mapper, and Services groups separated by blank lines.
- class: rationale-example
- source: plugins/claude-kit/skills/csharp-style/references/csharp-style.md:152
- provenance: 830ff28 2026-06-17 (em-dash replacement over the f8c0649 2026-06-10 original); no commit narrates an incident for the second specimen.
- verdict: retire
- reason: Safe because the §2 skeleton (lines 89-99) already shows the same Variables region with the same three group labels, differing by one comparer line; removing the §3 copy loses no form a session needs.
- proposed: Drop the §3 "Example - Services/Build/FormService.cs:20-31" block; point at the §2 skeleton's Variables region if a cross-reference is wanted.
- proposed: Same removal as A046.
- baseline-test: yes

### C030
- key: Give a class a single primary constructor only, with no overloads and no static factories.
- class: rule
- source: plugins/claude-kit/skills/csharp-style/references/csharp-style.md:170
- provenance: f8c0649 2026-06-10.
- verdict: keep
- reason: This is the rule; C017's "single constructor" is a description of the region's contents, so the two are not duplicates.

### C031
- key: Put constructor parameters on their own lines indented eight spaces from the class brace.
- class: mechanic
- source: plugins/claude-kit/skills/csharp-style/references/csharp-style.md:171
- provenance: 830ff28 2026-06-17 (em-dash replacement over the f8c0649 2026-06-10 original).
- verdict: keep
- reason: Eight spaces is right for constructors specifically; the document's own specimens (lines 179-182) confirm it, and §15's over-generalized version (C115) retires.

### C032
- key: Put the constructor's closing `)` on its own line indented four spaces, at the level of the constructor signature.
- class: mechanic
- source: plugins/claude-kit/skills/csharp-style/references/csharp-style.md:172
- provenance: f8c0649 2026-06-10.
- verdict: keep
- reason: The four-space closing indent is stated only here; the SKILL checklist says "own line" and leaves the column open.

### C033
- key: Open the constructor body with a section-comment block describing what gets assigned, then assign directly.
- class: rule
- source: plugins/claude-kit/skills/csharp-style/references/csharp-style.md:173
- provenance: f8c0649 2026-06-10.
- verdict: keep
- reason: Stated generally here where the checklist names one specimen label, so the reference is what a session with a different assignment set reads.

### C034
- key: Treat `ArgumentNullException` guards on injected dependencies as optional; they are not required but are fine to add.
- class: rule
- source: plugins/claude-kit/skills/csharp-style/references/csharp-style.md:174
- provenance: 7964c7e 2026-06-28, an operator hand-commit that softened the prior absolute "No `ArgumentNullException` checks" to optional; the commit carries no narrative beyond its title.
- verdict: keep
- reason: No finding, and the permission is the point: without it a session reads the older kit convention as a ban.

### C035
- key: Construct AutoMapper instances inline in the constructor under a `// Save Mapper.` comment.
- class: mechanic
- source: plugins/claude-kit/skills/csharp-style/references/csharp-style.md:175
- provenance: f8c0649 2026-06-10.
- verdict: keep
- reason: No finding; the inline mapper construction is unusual enough that it is inferable from nothing else in the document.

### C036
- key: Write the constructor as the `Services/Build/FormService.cs:33-50` example shows, assigning services under `// Save Services.` then building the mapper under `// Save Mapper.`.
- class: rationale-example
- source: plugins/claude-kit/skills/csharp-style/references/csharp-style.md:177
- provenance: 830ff28 2026-06-17 (em-dash replacement over the f8c0649 2026-06-10 original).
- verdict: keep
- reason: The only place the inline `MapperConfiguration` block C035 mandates is actually shown; the §2 skeleton's constructor omits it.

### C037
- key: End every async method name in `Async`.
- class: rule
- source: plugins/claude-kit/skills/csharp-style/references/csharp-style.md:200
- provenance: f8c0649 2026-06-10.
- verdict: keep
- reason: The reference states it positively for all async methods where the SKILL states it as an antipattern keyed on `Task<T>`.

### C038
- key: Make `CancellationToken` the last parameter.
- class: rule
- source: plugins/claude-kit/skills/csharp-style/references/csharp-style.md:201
- provenance: f8c0649 2026-06-10.
- verdict: keep
- reason: Same split: the positive statement lives here, the antipattern in the SKILL.

### C039
- key: Break each parameter of a multi-parameter method onto its own line at a four-space indent, with the closing `)` on its own line at the method-signature indent.
- class: mechanic
- source: plugins/claude-kit/skills/csharp-style/references/csharp-style.md:202
- provenance: f8c0649 2026-06-10.
- verdict: keep
- reason: Four spaces is the method case and eight the constructor case; every method specimen in the document (lines 209, 246, 483) is at four, so this side wins the contention against C115.

### C040
- key: Annotate return types as nullable, such as `Task<FilledForm?>`.
- class: mechanic
- source: plugins/claude-kit/skills/csharp-style/references/csharp-style.md:203
- provenance: f8c0649 2026-06-10.
- verdict: keep
- reason: No finding; it is what makes the `default`-return rule legal.

### C041
- key: Put no method-level attributes on methods.
- class: rule
- source: plugins/claude-kit/skills/csharp-style/references/csharp-style.md:204
- provenance: f8c0649 2026-06-10.
- verdict: keep
- reason: No finding; the MediatR carve-out is stated only here.

### C042
- key: Write a method signature as the `Services/Build/FormService.cs:54-57` example shows, one parameter per line with the cancellation token last.
- class: rationale-example
- source: plugins/claude-kit/skills/csharp-style/references/csharp-style.md:206
- provenance: 830ff28 2026-06-17 (em-dash replacement over the f8c0649 2026-06-10 original); no commit narrates an incident for the second specimen.
- verdict: retire
- reason: Safe because the §6 full-method example repeats these four lines verbatim (lines 245-248), so the signature shape survives the removal.
- proposed: Drop the §5 "Example - Services/Build/FormService.cs:54-57" block; the §6 example shows the same signature.
- baseline-test: yes

### C043
- key: Organize a method body as a sequence of named sections, each preceded by a `// Title.` comment naming what the next block does, not what it did or why.
- class: rule
- source: plugins/claude-kit/skills/csharp-style/references/csharp-style.md:216
- provenance: f8c0649 2026-06-10 installed the section-comment rule; 058e3a3 2026-07-24 (delta 5) sharpened it after the PrePass hand-edit review found narrating comments in Claude-authored C#.
- verdict: keep
- reason: Incident-born, nothing mechanical checks comment voice, and the "heart of the style" opening tells a skimming session which section to weight.

### C044
- key: Write section-comment text in Title Case.
- class: mechanic
- source: plugins/claude-kit/skills/csharp-style/references/csharp-style.md:219
- provenance: f8c0649 2026-06-10.
- verdict: keep
- reason: No finding; Title Case is stated only here and is the visible signature of the style.

### C045
- key: End every section comment with a period.
- class: mechanic
- source: plugins/claude-kit/skills/csharp-style/references/csharp-style.md:220
- provenance: f8c0649 2026-06-10.
- verdict: keep
- reason: The skill's frontmatter names this a signature trait, and the reference's §6 conventions list is where the comment mechanics sit together.

### C046
- key: Put one blank line before the section comment between sections.
- class: mechanic
- source: plugins/claude-kit/skills/csharp-style/references/csharp-style.md:221
- provenance: f8c0649 2026-06-10.
- verdict: keep
- reason: The owning statement, and the only one carrying the "preferred rather than absolute" bound the checklist drops; §15's repeat (C113) retires to it.

### C047
- key: Keep section comments short, imperative, direct statements of what the next block is intended to do, as a reading aid for someone scanning the method.
- class: rule
- source: plugins/claude-kit/skills/csharp-style/references/csharp-style.md:222
- provenance: 058e3a3 2026-07-24, delta 5 of the PrePass hand-edit review plus its follow-up clarifications.
- verdict: keep
- reason: The specimen and the "incidental we" parenthetical are the resolution that commit recorded, and they are what draws the line the intent-not-vocabulary test asserts.

### C048
- key: Avoid section comments opening with "Now we...", "Here we...", or "This will...".
- class: rule
- source: plugins/claude-kit/skills/csharp-style/references/csharp-style.md:222
- provenance: f8c0649 2026-06-10 installed the banned openings; 058e3a3 2026-07-24 records that they stand after the voice rule was sharpened.
- verdict: keep
- reason: The named openings are the exact drift the hand-edit review found, and the SKILL's antipattern names a different specimen of the same class.

### C049
- key: Treat `// Abort if we don't have a Valid VIN, make no changes.` as in-voice.
- class: rationale-example
- source: plugins/claude-kit/skills/csharp-style/references/csharp-style.md:222
- provenance: 058e3a3 2026-07-24, the follow-up clarification to the PrePass review that fixed where the voice line falls.
- verdict: keep
- reason: The intent-over-vocabulary test cannot be stated without an instance whose informal "we" still passes.

### C050
- key: Never let a comment explain history, decision-making, alternatives weighed, or issues encountered; keep WHY comments rare and exceptional.
- class: rule
- source: plugins/claude-kit/skills/csharp-style/references/csharp-style.md:223
- provenance: 058e3a3 2026-07-24, delta 5; the doc-closeout-discipline plan later added the matching change-narrative antipattern to the SKILL.
- verdict: keep
- reason: Incident-born and unenforced; it is the C# face of the doctrine's current-state rule, and both copies were installed deliberately.

### C051
- key: Use the common section comments `// Validate Parameters.`, `// Return Value.`, `// Declare Variables.`, `// Get X.` / `// Extract X.` / `// Build X.` / `// Apply X.`, and `// Return the Processed Result.` for their stated roles.
- class: mechanic
- source: plugins/claude-kit/skills/csharp-style/references/csharp-style.md:225
- provenance: f8c0649 2026-06-10.
- verdict: keep
- reason: No finding; the canonical label vocabulary is what makes two files written by different sessions read alike.

### C052
- key: Return early on null or invalid input, as in `if (document == null) return default;`.
- class: rule
- source: plugins/claude-kit/skills/csharp-style/references/csharp-style.md:233
- provenance: f8c0649 2026-06-10, lifted with its guard text from the source library, whose legacy code used `== null`.
- verdict: rewrite
- reason: The rule stands; only the worked guard changes to `is null`, which is what C054, the SKILL exemplar and the §16 template all already write, so the edit removes a contradiction without touching the rule.
- proposed: Change the worked guard at line 233 and in the §6 example at line 251 to `if (document is null) return default;`, keeping the rule text unchanged.
- baseline-test: yes

### C053
- key: Return the `default` keyword rather than `null` for null returns on nullable types.
- class: mechanic
- source: plugins/claude-kit/skills/csharp-style/references/csharp-style.md:234
- provenance: f8c0649 2026-06-10.
- verdict: keep
- reason: The nullable-type bound is stated only here.

### C054
- key: Use `is null` and `is not null` rather than `== null` and `!= null`.
- class: mechanic
- source: plugins/claude-kit/skills/csharp-style/references/csharp-style.md:235
- provenance: f8c0649 2026-06-10.
- verdict: keep
- reason: This is the side history upholds in the `== null` contention; the rejected forms are named only here.

### C055
- key: Use `??=` for default assignment, as in `filledDocument ??= new();`.
- class: mechanic
- source: plugins/claude-kit/skills/csharp-style/references/csharp-style.md:236
- provenance: f8c0649 2026-06-10.
- verdict: keep
- reason: The owning statement, stated with its worked assignment beside the other body idioms; §10's repeat (C081) retires to it.

### C056
- key: Use `var` when the type is obvious from the right-hand side.
- class: mechanic
- source: plugins/claude-kit/skills/csharp-style/references/csharp-style.md:237
- provenance: f8c0649 2026-06-10.
- verdict: keep
- reason: No finding; the "obvious from the right-hand side" bound is what keeps `var` off ambiguous assignments.

### C057
- key: Write LINQ as method chains, not query syntax.
- class: rule
- source: plugins/claude-kit/skills/csharp-style/references/csharp-style.md:238
- provenance: f8c0649 2026-06-10.
- verdict: keep
- reason: No finding; no formatter converts query syntax.

### C058
- key: Use collection expressions and spreads over older constructions: `[.. source.Where(...)]` over `.ToArray()`, `[item]` over `new[] { item }`, `[.. existing, item]` over `Append`/`Concat` plus `ToArray`.
- class: rule
- source: plugins/claude-kit/skills/csharp-style/references/csharp-style.md:239
- provenance: 058e3a3 2026-07-24, delta 3, grounded in a real data-loss bug: a discarded `Enumerable.Append` result in the source session; 75913a4 2026-07-24 then removed the rationale sentence from the reference, leaving the rule bare.
- verdict: keep
- reason: Incident-born with a data-loss consequence and no machinery catches a discarded `Append`; the three named substitutions are the rule's whole content, and the operator has already ruled once that the rationale does not ride in the prose.

### C059
- key: Keep explicit constructor parentheses on named-type object initializers, writing `new FilledForm() { Title = docType }` rather than `new FilledForm { Title = docType }`.
- class: rule
- source: plugins/claude-kit/skills/csharp-style/references/csharp-style.md:240
- provenance: 058e3a3 2026-07-24, delta 4 of the PrePass hand-edit review.
- verdict: keep
- reason: No finding; incident-born, contrary to the common C# habit, and the target-typed `new()` carve-out is what keeps it from over-firing.

### C060
- key: Use string interpolation `$"..."` rather than `string.Format` or concatenation.
- class: rule
- source: plugins/claude-kit/skills/csharp-style/references/csharp-style.md:241
- provenance: f8c0649 2026-06-10.
- verdict: keep
- reason: No finding; no formatter rewrites `string.Format`.

### C061
- key: Write a method as the `Services/Build/FormService.cs:54-118` example shows: validate, declare the return value, do the work inside try under named section comments, log in catch, return at the bottom.
- class: rationale-example
- source: plugins/claude-kit/skills/csharp-style/references/csharp-style.md:243
- provenance: 830ff28 2026-06-17 (em-dash replacement over the f8c0649 2026-06-10 original).
- verdict: keep
- reason: The prose names the parts; only this specimen shows the cadence (one section comment per block, the `// Return Value.` slot before try), and cadence drift is exactly what the 2026-07-24 hand-edit review found.

### C062
- key: Aim for section comments that alone tell the story of the method.
- class: rationale-example
- source: plugins/claude-kit/skills/csharp-style/references/csharp-style.md:293
- provenance: f8c0649 2026-06-10.
- verdict: keep
- reason: This is the acceptance check for §6, applied to a session's own output, not a why; fourteen words and nothing checks it mechanically.

### C063
- key: Pass cancellation tokens down the call chain.
- class: rule
- source: plugins/claude-kit/skills/csharp-style/references/csharp-style.md:298
- provenance: f8c0649 2026-06-10.
- verdict: keep
- reason: Reference §7 gathers the async patterns; a token accepted and dropped compiles clean, so nothing catches the omission.

### C064
- key: Use `Task.FromResult(...)` in synchronous helpers that return `Task<T>` for interface uniformity, rather than converting them to a sync signature.
- class: mechanic
- source: plugins/claude-kit/skills/csharp-style/references/csharp-style.md:299
- provenance: f8c0649 2026-06-10.
- verdict: keep
- reason: No finding; it settles the interface-uniformity question a session would otherwise resolve by narrowing the signature.

### C065
- key: Use `Task.CompletedTask` in synchronous helpers returning `Task`.
- class: mechanic
- source: plugins/claude-kit/skills/csharp-style/references/csharp-style.md:300
- provenance: f8c0649 2026-06-10.
- verdict: keep
- reason: No finding; the non-generic counterpart of C064.

### C066
- key: Use `ConfigureAwait(false)` in background services under `Services/Background/*` but not in regular services, matching the surrounding file.
- class: mechanic
- source: plugins/claude-kit/skills/csharp-style/references/csharp-style.md:301
- provenance: f8c0649 2026-06-10.
- verdict: keep
- reason: No finding; the split by folder is stated only here and no analyzer in the kit enforces either side.

### C067
- key: Return `Task` or `Task<T>` and never `ValueTask`.
- class: rule
- source: plugins/claude-kit/skills/csharp-style/references/csharp-style.md:302
- provenance: 830ff28 2026-06-17 (em-dash replacement over the f8c0649 2026-06-10 original).
- verdict: keep
- reason: No finding; `ValueTask` is a common performance suggestion, so the ban has to be written.

### C068
- key: Log through `ILogger<T>` injection for new code or the static Serilog `Log`, matching the surrounding file.
- class: rule
- source: plugins/claude-kit/skills/csharp-style/references/csharp-style.md:306
- provenance: 7964c7e 2026-06-28, an operator hand-commit that replaced the prior absolute "No `ILogger<T>` is injected" with the preference plus fallback, in SKILL and reference together.
- verdict: keep
- reason: The reference carries the match-the-surrounding-file bound the checklist compresses away, and the reversal is recent enough that a session reading the old kit convention needs the current text.

### C069
- key: Include `using Serilog;` in the using list when the static `Log` is used.
- class: mechanic
- source: plugins/claude-kit/skills/csharp-style/references/csharp-style.md:307
- provenance: 7964c7e 2026-06-28, which added the "when the static `Log` is used" condition once `ILogger<T>` became the preferred path.
- verdict: keep
- reason: No finding; without the condition the line would demand a Serilog using in files that inject a logger instead.

### C070
- key: Write catch blocks in the standard shape `catch (Exception ex) { Log.Error(ex, "Failure Processing Document."); }`.
- class: mechanic
- source: plugins/claude-kit/skills/csharp-style/references/csharp-style.md:308
- provenance: f8c0649 2026-06-10.
- verdict: keep
- reason: No finding; the specimen fixes the message form as well as the shape.

### C071
- key: Use `Log.Debug($"...")` with method-name-prefixed messages for trace-level diagnostics in output services.
- class: mechanic
- source: plugins/claude-kit/skills/csharp-style/references/csharp-style.md:315
- provenance: f8c0649 2026-06-10 installed it; a8770b3 2026-06-28 only genericized the namespace inside the example string.
- verdict: keep
- reason: No finding; the method-name prefix convention appears nowhere else.

### C072
- key: End every log message with a period.
- class: mechanic
- source: plugins/claude-kit/skills/csharp-style/references/csharp-style.md:316
- provenance: f8c0649 2026-06-10.
- verdict: keep
- reason: Reference §8 owns the logging conventions; the SKILL restates it with examples in its checklist.

### C073
- key: Use `try { ... } catch (Exception ex) { Log.Error(...); }` as the dominant shape, where the catch logs and the method returns `default`.
- class: rule
- source: plugins/claude-kit/skills/csharp-style/references/csharp-style.md:320
- provenance: f8c0649 2026-06-10.
- verdict: keep
- reason: No finding; the swallow-and-return-default contract is unusual enough that a session would otherwise rethrow.

### C074
- key: Add a `finally` block for delay or sleep loops in background services.
- class: mechanic
- source: plugins/claude-kit/skills/csharp-style/references/csharp-style.md:321
- provenance: f8c0649 2026-06-10.
- verdict: keep
- reason: No finding; it keeps a background loop from starving after a thrown iteration.

### C075
- key: Use bare `throw;` sparingly, only when the exception must propagate.
- class: rule
- source: plugins/claude-kit/skills/csharp-style/references/csharp-style.md:322
- provenance: f8c0649 2026-06-10.
- verdict: keep
- reason: No finding; it is the carve-out that keeps C073 from reading as an absolute swallow.

### C076
- key: Never write `throw ex;`.
- class: rule
- source: plugins/claude-kit/skills/csharp-style/references/csharp-style.md:322
- provenance: f8c0649 2026-06-10.
- verdict: keep
- reason: No finding; `throw ex;` resets the stack trace and no analyzer is guaranteed present in a target repo.

### C077
- key: Do not define custom exception types; use the generic `Exception`.
- class: rule
- source: plugins/claude-kit/skills/csharp-style/references/csharp-style.md:323
- provenance: 830ff28 2026-06-17 (em-dash replacement over the f8c0649 2026-06-10 original).
- verdict: keep
- reason: No finding; custom exception hierarchies are a standard generated-code habit this style rejects.

### C078
- key: Enable nullable reference types with `<Nullable>enable</Nullable>` in the csproj.
- class: mechanic
- source: plugins/claude-kit/skills/csharp-style/references/csharp-style.md:327
- provenance: f8c0649 2026-06-10.
- verdict: keep
- reason: No finding; it is the precondition for the whole §10 set.

### C079
- key: Put nullable annotations on returns and parameters, such as `Task<FilledForm?>` and `Stream?`.
- class: mechanic
- source: plugins/claude-kit/skills/csharp-style/references/csharp-style.md:328
- provenance: f8c0649 2026-06-10.
- verdict: keep
- reason: No finding; C040 states it for returns, this line extends it to parameters.

### C080
- key: Suppress an unused return with a discard, as in `_ = values.TryGetValue("Key", out var value);`.
- class: mechanic
- source: plugins/claude-kit/skills/csharp-style/references/csharp-style.md:329
- provenance: f8c0649 2026-06-10.
- verdict: keep
- reason: No finding; the discard form is stated only here and appears in the §6 worked method.

### C081
- key: Use `??=` for late-init defaults.
- class: mechanic
- source: plugins/claude-kit/skills/csharp-style/references/csharp-style.md:330
- provenance: f8c0649 2026-06-10, installed in the same commit as the §6 statement; no commit narrates a separate reason for the §10 repeat.
- verdict: retire
- reason: Safe because C055 states the same rule in §6 with a worked assignment; the §10 line is four words that add nothing.
- proposed: Drop the `??=` bullet from §10; §6 keeps the rule with its example.
- proposed: Same removal as A104.
- baseline-test: yes

### C082
- key: Use `??` chains for fallback values.
- class: mechanic
- source: plugins/claude-kit/skills/csharp-style/references/csharp-style.md:331
- provenance: f8c0649 2026-06-10.
- verdict: keep
- reason: No finding; paired with C083, it is the alternative the null-forgiving ban points at.

### C083
- key: Do not use the null-forgiving operator `!`; rely on null-conditional and null-coalescing instead.
- class: rule
- source: plugins/claude-kit/skills/csharp-style/references/csharp-style.md:332
- provenance: 830ff28 2026-06-17 (em-dash replacement over the f8c0649 2026-06-10 original).
- verdict: keep
- reason: Reference §10 gathers the null-handling set; the SKILL's antipattern line is the checklist face of the same rule.

### C084
- key: Register every type in the library's `Assembly/RegisterServices.cs` Autofac module the same way.
- class: rule
- source: plugins/claude-kit/skills/csharp-style/references/csharp-style.md:336
- provenance: f8c0649 2026-06-10.
- verdict: keep
- reason: Reference §11 carries the file placement, the uniformity requirement and the code block; the checklist carries eleven words.

### C085
- key: Chain `.AsImplementedInterfaces()` on each registration so interfaces are inferred from the implementation.
- class: mechanic
- source: plugins/claude-kit/skills/csharp-style/references/csharp-style.md:344
- provenance: 830ff28 2026-06-17 (em-dash replacement over the f8c0649 2026-06-10 original).
- verdict: keep
- reason: The reference says what the call does; the SKILL says why (idempotent by default), and both halves are needed at different moments.

### C086
- key: Chain `.PreserveExistingDefaults()` on each registration so any prior registration is respected.
- class: mechanic
- source: plugins/claude-kit/skills/csharp-style/references/csharp-style.md:345
- provenance: 830ff28 2026-06-17 (em-dash replacement over the f8c0649 2026-06-10 original).
- verdict: keep
- reason: Same split as C085; this call is what makes re-execution safe.

### C087
- key: Group registrations by domain under uppercase label comments such as `// HANDLERS`, `// BACKGROUND.`, and `// SERVICES.`.
- class: mechanic
- source: plugins/claude-kit/skills/csharp-style/references/csharp-style.md:347
- provenance: f8c0649 2026-06-10.
- verdict: keep
- reason: The uppercase label form and its examples appear only here; the checklist says "grouped by domain label".

### C088
- key: Match the surrounding file on whether a registration label comment ends in a period.
- class: rule
- source: plugins/claude-kit/skills/csharp-style/references/csharp-style.md:366
- provenance: f8c0649 2026-06-10, an observation of the source library's own inconsistency carried into the reference; no incident installed it, and 830ff28 2026-06-17 later added style precedence to both style skills, which contradicts it.
- verdict: rewrite
- reason: Safe because the doctrine's stay-in-scope rule already stops a session reformatting existing labels, so dropping the match-the-file licence changes only what a session writes new, and the period rule is the skill's own signature trait.
- proposed: Replace the parenthetical at line 366 with one sentence: registration label comments end with a period like every other label comment; and make the `// HANDLERS` example at line 350 read `// HANDLERS.`.
- baseline-test: yes

### C089
- key: Leave `RegisterServices.cs` as a block-scoped namespace file when editing it.
- class: rule
- source: plugins/claude-kit/skills/csharp-style/references/csharp-style.md:368
- provenance: 830ff28 2026-06-17 (em-dash replacement over the f8c0649 2026-06-10 original), installed in the same commit as the §1 statement.
- verdict: retire
- reason: Safe because C010 states the leave-existing-block-scoped-files-alone rule and already names `Assembly/RegisterServices.cs` as its example, so the file is covered without this line.

### C090
- key: Inject `IOptionsMonitor<TSettings>` rather than `IOptions<T>` for settings, and read `.CurrentValue` at use time.
- class: rule
- source: plugins/claude-kit/skills/csharp-style/references/csharp-style.md:370
- provenance: f8c0649 2026-06-10; the matching SKILL antipattern was relocated here from the doctrine by the doctrine-rightsizing plan, carrying its incident (an eager startup read bakes in defaults and bypasses test overrides).
- verdict: keep
- reason: The reference states the mechanic (which type, read where) and the SKILL states the failure it prevents; a session needs the type name from here.

### C091
- key: Suffix types that perform core operations and orchestration with `Service`.
- class: mechanic
- source: plugins/claude-kit/skills/csharp-style/references/csharp-style.md:376
- provenance: f8c0649 2026-06-10.
- verdict: keep
- reason: No finding; the suffix table is the naming contract the DI and folder rules assume.

### C092
- key: Suffix MediatR notification handlers with `Handler`.
- class: mechanic
- source: plugins/claude-kit/skills/csharp-style/references/csharp-style.md:377
- provenance: f8c0649 2026-06-10.
- verdict: keep
- reason: No finding; paired with the `Handlers/` folder rule.

### C093
- key: Suffix static utility method containers with `Helper`.
- class: mechanic
- source: plugins/claude-kit/skills/csharp-style/references/csharp-style.md:378
- provenance: f8c0649 2026-06-10.
- verdict: keep
- reason: No finding; it is what keeps a static utility from being named `Service` and registered in DI.

### C094
- key: Suffix MediatR notifications with `Notification`.
- class: mechanic
- source: plugins/claude-kit/skills/csharp-style/references/csharp-style.md:379
- provenance: f8c0649 2026-06-10.
- verdict: keep
- reason: No finding; part of the same suffix table.

### C095
- key: Use the `Repository` suffix only for older data-access objects.
- class: mechanic
- source: plugins/claude-kit/skills/csharp-style/references/csharp-style.md:380
- provenance: f8c0649 2026-06-10.
- verdict: keep
- reason: No finding, and the legacy-only bound is the working part: it stops a session introducing a repository layer against the stored-procedure default.

### C096
- key: Prefix method names by verb: `Get*` to read or fetch, `Process*` to orchestrate a pipeline, `Create*` to build a new value, `Extract*` to pull data from a structure, `Build*` to construct a complex output, `Save*` or `Set*` to write or assign.
- class: mechanic
- source: plugins/claude-kit/skills/csharp-style/references/csharp-style.md:382
- provenance: 830ff28 2026-06-17 (em-dash replacement over the f8c0649 2026-06-10 original).
- verdict: keep
- reason: No finding; the verb-to-role mapping is stated only here and is what makes method names predictable across files.

### C097
- key: Name interfaces with an `I` prefix matching the implementation, as `IDocumentService` to `DocumentService`.
- class: mechanic
- source: plugins/claude-kit/skills/csharp-style/references/csharp-style.md:390
- provenance: f8c0649 2026-06-10.
- verdict: keep
- reason: The reference states the naming rule the SKILL's example only demonstrates.

### C098
- key: Keep MediatR notifications as simple data holders.
- class: rule
- source: plugins/claude-kit/skills/csharp-style/references/csharp-style.md:394
- provenance: f8c0649 2026-06-10.
- verdict: keep
- reason: No finding; it keeps behavior out of notifications and in handlers.

### C099
- key: Write a notification as a class implementing `INotification` with initialized auto-properties and a `CancellationToken` property, as `FileSaveNotification` shows.
- class: rationale-example
- source: plugins/claude-kit/skills/csharp-style/references/csharp-style.md:396
- provenance: f8c0649 2026-06-10.
- verdict: keep
- reason: "Simple data holder" is obeyable only from the specimen: the initialized auto-properties, the `Caller` slot and the carried `CancellationToken` are what the phrase means here and the prose lists none of them.

### C100
- key: Have handlers implement `INotificationHandler<T>`.
- class: rule
- source: plugins/claude-kit/skills/csharp-style/references/csharp-style.md:406
- provenance: f8c0649 2026-06-10.
- verdict: keep
- reason: No finding; the MediatR contract this style uses.

### C101
- key: Put handlers in the `Handlers/` folder.
- class: rule
- source: plugins/claude-kit/skills/csharp-style/references/csharp-style.md:406
- provenance: f8c0649 2026-06-10.
- verdict: keep
- reason: No finding; the folder placement is stated only here.

### C102
- key: Publish by awaiting `_mediator.Publish(...)` with the notification built inline as an object initializer across multiple lines.
- class: mechanic
- source: plugins/claude-kit/skills/csharp-style/references/csharp-style.md:408
- provenance: f8c0649 2026-06-10.
- verdict: keep
- reason: No finding; the multi-line publish shape is stated only here.

### C103
- key: Set `Caller = nameof(...)` on a published notification so handlers know who fired it.
- class: mechanic
- source: plugins/claude-kit/skills/csharp-style/references/csharp-style.md:421
- provenance: f8c0649 2026-06-10.
- verdict: keep
- reason: No finding; a convention handlers depend on at runtime, and nothing enforces it.

### C104
- key: Put models under `Models/` organized by purpose: `Models/Database/`, `Models/Documents/`, `Models/Email/`, and `Models/Settings/`.
- class: mechanic
- source: plugins/claude-kit/skills/csharp-style/references/csharp-style.md:425
- provenance: 830ff28 2026-06-17 (em-dash replacement over the f8c0649 2026-06-10 original).
- verdict: keep
- reason: No finding; the folder taxonomy pairs with C007, since these folders generate no namespaces.

### C105
- key: Write settings classes as plain DTOs with `{ get; set; }` auto-properties.
- class: rule
- source: plugins/claude-kit/skills/csharp-style/references/csharp-style.md:431
- provenance: f8c0649 2026-06-10.
- verdict: keep
- reason: No finding; settable auto-properties are what `IOptionsMonitor` binding needs.

### C106
- key: Do not use records for settings classes.
- class: rule
- source: plugins/claude-kit/skills/csharp-style/references/csharp-style.md:431
- provenance: f8c0649 2026-06-10.
- verdict: keep
- reason: No finding; records are the modern default a generator reaches for, and they break options binding here.

### C107
- key: Use collection expressions for property init values where natural.
- class: rule
- source: plugins/claude-kit/skills/csharp-style/references/csharp-style.md:433
- provenance: f8c0649 2026-06-10 for the property-init line; 058e3a3 2026-07-24 added the general collection-expression rule to §6 and the checklist.
- verdict: keep
- reason: §14 states the preference at the one site the general body rule does not obviously reach, a property declaration rather than a method body.

### C108
- key: Initialize properties as `= []`, `= string.Empty`, and `= new()` on their declarations.
- class: rationale-example
- source: plugins/claude-kit/skills/csharp-style/references/csharp-style.md:434
- provenance: f8c0649 2026-06-10.
- verdict: keep
- reason: The four specimen properties are the only place the three init forms are matched to their property types; "where natural" alone does not say which a string or a class property takes.

### C109
- key: Indent with four spaces, never tabs.
- class: mechanic
- source: plugins/claude-kit/skills/csharp-style/references/csharp-style.md:443
- provenance: f8c0649 2026-06-10.
- verdict: keep
- reason: No finding; the format-on-edit hook runs CSharpier only when it is installed and does nothing otherwise, so the prose is the only guarantee.

### C110
- key: Put one blank line between methods within a region.
- class: mechanic
- source: plugins/claude-kit/skills/csharp-style/references/csharp-style.md:444
- provenance: f8c0649 2026-06-10.
- verdict: keep
- reason: No finding; the only statement of method spacing.

### C111
- key: Put one blank line between regions, after `#endregion` and before the next `#region`.
- class: mechanic
- source: plugins/claude-kit/skills/csharp-style/references/csharp-style.md:445
- provenance: f8c0649 2026-06-10.
- verdict: keep
- reason: No finding; region spacing is not something a formatter decides, since preprocessor directives are left where the author put them.

### C112
- key: Put one blank line between field groups, after the labeled comment's group finishes.
- class: mechanic
- source: plugins/claude-kit/skills/csharp-style/references/csharp-style.md:446
- provenance: f8c0649 2026-06-10, installed in the same commit as the §3 statement; no commit narrates a separate reason for the §15 repeat.
- verdict: retire
- reason: Safe because C027 states the blank line between groups in §3, where the grouping rule a session is applying already lives.

### C113
- key: Put one blank line between logical phases inside a method, right before each `// Section.` comment.
- class: mechanic
- source: plugins/claude-kit/skills/csharp-style/references/csharp-style.md:447
- provenance: f8c0649 2026-06-10, installed in the same commit as the §6 statement; no commit narrates a separate reason for the §15 repeat.
- verdict: retire
- reason: Safe because C046 states the same blank line with the same "preferred rather than absolute" bound in §6, beside the section-comment conventions.
- proposed: Drop the logical-phases bullet from §15; §6 keeps the blank-line convention with its "preferred" bound.
- proposed: Same removal as A125.
- baseline-test: yes

### C114
- key: Put no blank line between using statements.
- class: mechanic
- source: plugins/claude-kit/skills/csharp-style/references/csharp-style.md:448
- provenance: f8c0649 2026-06-10, installed in the same commit as the §1 statement; no commit narrates a separate reason for the §15 repeat.
- verdict: retire
- reason: Safe because C004 states the rule inside the using-order list, which is what a session reads while writing the using block.

### C115
- key: Indent each parameter of a long parameter list eight spaces, with the closing `)` indented to the method signature column.
- class: mechanic
- source: plugins/claude-kit/skills/csharp-style/references/csharp-style.md:449
- provenance: f8c0649 2026-06-10, which over-generalized the constructor's eight-space indent to all parameter lists in the same commit that set methods at four.
- verdict: retire
- reason: Safe and necessary: this line contradicts C039 and every method specimen in the document, so removing it leaves C031 owning constructors at eight spaces and C039 owning methods at four.

### C116
- key: Use the full service skeleton when creating a brand-new service in `Services/Build/` or `Services/Process/`.
- class: rule
- source: plugins/claude-kit/skills/csharp-style/references/csharp-style.md:453
- provenance: f8c0649 2026-06-10.
- verdict: keep
- reason: No finding; it is what makes the §16 template the greenfield path the SKILL points at when no sibling exists.

### C117
- key: Build a new service as the `WidgetService` template shows: usings, file-scoped namespace, Variables, Constructor, a named processing region with validate/return-value/try/catch/return, and a Private Methods region.
- class: rationale-example
- source: plugins/claude-kit/skills/csharp-style/references/csharp-style.md:455
- provenance: f8c0649 2026-06-10.
- verdict: keep
- reason: C116 says to use "this skeleton", so the template is the rule's object rather than an illustration of it.

### C118
- key: Register the new service in `Assembly/RegisterServices.cs` under the appropriate label comment.
- class: rule
- source: plugins/claude-kit/skills/csharp-style/references/csharp-style.md:518
- provenance: f8c0649 2026-06-10.
- verdict: keep
- reason: §16 is a procedure, and this is the step that keeps a new service from being written and never wired; §11 owns the registration form it points at.

### C119
- key: Declare the new service's interface in `Interfaces/I<Name>Service.cs`.
- class: rule
- source: plugins/claude-kit/skills/csharp-style/references/csharp-style.md:526
- provenance: 7964c7e 2026-06-28 trimmed it to its current form when the XML-doc ban was withdrawn; the line itself dates from f8c0649 2026-06-10.
- verdict: keep
- reason: Seven words closing the §16 procedure; C012 owns the placement rule and this is the step that applies it, so removing it would end the walkthrough with the service unusable.
