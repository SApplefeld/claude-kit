# Rationale ledger: sql-style

This file is the rationale ledger for the documents the `sql-style` skill owns. Rule text says what happens; this ledger says why; git says when. Nobody loads it by default. A session about to change a rule in one of the documents below reads the entry for the claim it is changing first, so the reason a rule holds is not re-litigated at the next review.

Each document sits under its own heading, which opens with its inventory line (what the document is for, which moments it owns, and when a session loads it) and then carries one entry per claim, retired claims included so the next audit does not re-find them. An entry is keyed by the claim's imperative sentence and carries its class (rule, mechanic, pointer, or rationale-example), its source as file and line, its provenance (the commit, incident, memory or kaizen note that installed it, or `no provenance found`), and its verdict (keep, rewrite, or retire) with the reason. A `C` entry's source line is read at the extraction commit `6bc07fb`; an `R` entry is a claim re-extracted from a hunk the Section 5 merge changed, and its source line is read at the merged commit `d9540ad`. Claim numbers restart under every document heading, and inside a document read in chunks they restart per chunk, so an entry id is unique only under its heading and a chunked document carries the chunk in the id (`c2.C001` is claim C001 of the second chunk); a claim named inside a reason or provenance line of such a document carries the same prefix. A `C` entry whose source hunk the Section 5 merge rewrote reads `retire` and carries a `superseded-by:` line naming the `R` entry that holds the passage at the merged commit; the passage's own verdict is that entry's, so a count of retirements over this ledger leaves those records out. A reason may name the form the judge ruled toward (a pointer at the owner, a split, a fold into a neighbour), because that form is why the verdict is rewrite rather than keep or retire; what a passage becomes is the rewrite plan's to decide, and where the two differ the rewrite plan governs. The target wording a judge proposed is recorded in the corpus audit plan's scratch adjudication log (the plan is `claude-kit_corpus-audit_spec_v1.md` under `docs/`), which is that plan's transient scratch: its rewrite section consumes the log, and the rewrite plan it writes under `docs/plans/` is the durable home of any target wording once written. The baseline-test flag on a behavior-shaping rewrite rides in the entry's reason line.

## plugins/claude-kit/skills/sql-style/SKILL.md

This document is the operator's personal T-SQL house style: the deployment idioms, layout rules, comment conventions, antipatterns, and a completion checklist for SQL work, plus a procedure exemplar and a recipe for outlining a large SQL file. It owns the moments in which a session writes or modifies any SQL (stored procedures, tables, functions, indexes, install or deployment scripts, ad-hoc queries), the moment a session decides whether a repository's own contract overrides the house style, the moment a session opens a large SQL file to find one thing, and the moment a session declares SQL work complete. Its frontmatter says to use it whenever writing or modifying any SQL, even when style is not named, so the load class is `named-trigger`: it is loaded before the act of writing or changing SQL rather than at session start or at every plan run.

Extracted at `6bc07fb`: whole document (`skills.sql-style.SKILL.md`).

### C001
- key: Load and apply this T-SQL style before writing or modifying any SQL of any kind.
- class: rule
- source: plugins/claude-kit/skills/sql-style/SKILL.md:3
- provenance: f8c0649 2026-06-10, the kit's initial consolidation of the operator's house style from prior artifacts; re-quoted at 830ff28 with the CATCH trait corrected and de-named at a8770b3, neither an incident.
- verdict: keep
- reason: The description is the harness's skill-selection text, so the object-kind enumeration and trait list are what make the skill fire on SQL work with style unnamed; shortening it changes load behaviour, not prose.

### C002
- key: Read references/sql-style.md for the detailed pattern reference before writing SQL code.
- class: pointer
- source: plugins/claude-kit/skills/sql-style/SKILL.md:8
- provenance: f8c0649 2026-06-10, the initial consolidation; no incident narrative.
- verdict: keep
- reason: No finding. This sentence is what makes SKILL.md the summary layer and the reference the detail layer of one owner, which every overlap ruling in this unit rests on.

### C003
- key: Deploy stored procedures with the shell-then-ALTER idiom.
- class: rule
- source: plugins/claude-kit/skills/sql-style/SKILL.md:12
- provenance: f8c0649 2026-06-10, the initial consolidation; no incident narrative.
- verdict: keep
- reason: The philosophy point, the antipattern (C028) and the checklist (C042) are one rule at three moments, and no hook or lint enforces SQL style, so the repetition is the enforcement; the GRANT reason stays because `CREATE OR ALTER` is valid SQL a model defaults to.

### C004
- key: Deploy functions by dropping and recreating them.
- class: rule
- source: plugins/claude-kit/skills/sql-style/SKILL.md:12
- provenance: f8c0649 2026-06-10, the initial consolidation; no incident narrative.
- verdict: keep
- reason: Same three-moment structure as C003; reference §3 is the same owner's detail layer.

### C005
- key: Guard table and index creation with IF NOT EXISTS.
- class: rule
- source: plugins/claude-kit/skills/sql-style/SKILL.md:12
- provenance: f8c0649 2026-06-10, the initial consolidation; no incident narrative.
- verdict: keep
- reason: Same three-moment structure as C003; reference §4 and §5 fix the catalog views and placement, which is detail-layer content.

### C006
- key: Write every deployment script so it is idempotent and never breaks on re-execution.
- class: rule
- source: plugins/claude-kit/skills/sql-style/SKILL.md:12
- provenance: f8c0649 2026-06-10, the initial consolidation; no incident narrative.
- verdict: keep
- reason: The C# skill's idempotence rule is about C# code; each style skill owns its own language under the ownership map and a cross-language pointer sends the reader to the wrong document.

### C007
- key: Tab-align related values so names align, then types align, then defaults align.
- class: rule
- source: plugins/claude-kit/skills/sql-style/SKILL.md:13
- provenance: f8c0649 2026-06-10, the initial consolidation; no incident narrative.
- verdict: keep
- reason: The reference's four restatements are per-construct templates of the same owner; "Non-negotiable" is emphasis that holds under pressure and no incident says it misfired.

### C008
- key: Start each continuation line of a list with a leading comma so items line up.
- class: rule
- source: plugins/claude-kit/skills/sql-style/SKILL.md:14
- provenance: f8c0649 2026-06-10, the initial consolidation; no incident narrative.
- verdict: keep
- reason: Antipattern (C029) and checklist (C048) are the same rule at the writing and completion moments; the reference §12 enumeration is the detail layer.

### C009
- key: Begin statements with a leading semicolon.
- class: rule
- source: plugins/claude-kit/skills/sql-style/SKILL.md:14
- provenance: f8c0649 2026-06-10, the initial consolidation; ddd6c72 2026-08-23 cited this sentence's terminator reason as evidence the skill owns the idiom.
- verdict: keep
- reason: This is the general rule with its reason; the reference's four mentions are template annotations. The reason clause is referenced by the Outlining section at :73 and by the outline-first consult, so it is load-bearing beyond this line.

### C010
- key: Divide every procedure into named phases using section banners rather than inline narration.
- class: rule
- source: plugins/claude-kit/skills/sql-style/SKILL.md:15
- provenance: f8c0649 2026-06-10, the initial consolidation; no incident narrative.
- verdict: keep
- reason: Reference §10 is the same owner's detail layer carrying the phase order.

### C011
- key: Write section banners in the form `/********** TITLE **********/`.
- class: mechanic
- source: plugins/claude-kit/skills/sql-style/SKILL.md:15
- provenance: f8c0649 2026-06-10, the initial consolidation; no incident narrative.
- verdict: keep
- reason: The form is the skill's shorthand name for the banner style, used the same way in reference §17; the literal 92-character multi-line block is in this file's exemplar at :46-48 and in §10, so the contention with §10 is not real.

### C012
- key: When unsure, find an existing procedure or table of similar shape and copy its layout exactly.
- class: rule
- source: plugins/claude-kit/skills/sql-style/SKILL.md:16
- provenance: f8c0649 2026-06-10 for the rule; 830ff28 2026-06-17 added the foreign-repo bound in the Precedence section, ported from a peer fork.
- verdict: keep
- reason: Each style skill owns the sibling rule for its language; the SKILL carries the foreign-repo carve-out and the reference's narrower in-library mentions are consistent with it.

### C013
- key: In a greenfield repository, follow the exemplar in this skill and the full templates in the reference.
- class: rule
- source: plugins/claude-kit/skills/sql-style/SKILL.md:16
- provenance: f8c0649 2026-06-10, the initial consolidation; no incident narrative.
- verdict: keep
- reason: Each skill sends the reader to its own exemplar; a pointer to the C# skill points at the wrong language.

### C014
- key: Let a repository's mechanically-enforced contract override this style.
- class: rule
- source: plugins/claude-kit/skills/sql-style/SKILL.md:20
- provenance: 830ff28 2026-06-17, the style-precedence rule installed in the doctrine and both style skills in one change, ported from a peer fork; the live incident class is kaizen/archive/2026-07-30-reviewer-style-skill-paths.md, a reviewer that judged by repo convention.
- verdict: keep
- reason: The ownership map makes the style skills the owners and the doctrine's Defaults bullet the pointer, and the copy here is the one a subagent reads because subagents do not inherit the doctrine. The third sentence bounds the sibling rule against the legacy-sibling reading and stays.

### C015
- key: Treat this style as the default authority where no mechanically-enforced contract exists.
- class: rule
- source: plugins/claude-kit/skills/sql-style/SKILL.md:20
- provenance: 830ff28 2026-06-17, as C014.
- verdict: keep
- reason: As C014: the copy at the point of action is what reaches a reviewer or implementer subagent.

### C016
- key: Substitute the project's own schema and error-logging procedure for the exemplar's placeholders.
- class: rule
- source: plugins/claude-kit/skills/sql-style/SKILL.md:24
- provenance: 830ff28 2026-06-17, written when a concrete client schema was replaced with placeholders in the same change.
- verdict: keep
- reason: Naming `<schema>`, `<schema_owner>` and `usp_LogError` as placeholders is what stops them being copied as names; the reference's equivalent sentence covers its own examples, not this file's exemplar.

### C017
- key: Apply `WITH EXECUTE AS` only where the project uses owner-impersonation, and drop it where it does not.
- class: rule
- source: plugins/claude-kit/skills/sql-style/SKILL.md:24
- provenance: 830ff28 2026-06-17; ce7b530 2026-06-28 is the incident, a reference that framed impersonation as universal and was aligned to this sentence.
- verdict: keep
- reason: This sentence conditions the `WITH EXECUTE AS` line in the exemplar it precedes; without it the exemplar reads as universal, which is exactly the defect ce7b530 repaired in the reference. The checklist (C043) gates the same rule at completion with the inline-TVF exclusion.

### C018
- key: When opening a SQL file past roughly 1,000 lines to find one thing, grep the definitions first with line numbers.
- class: rule
- source: plugins/claude-kit/skills/sql-style/SKILL.md:69
- provenance: ddd6c72 2026-08-23, the outline-first section of docs/archive/claude-kit_process-rule-repairs_spec_v1.md, after a consult ruled language anchors cannot live in the language-agnostic doctrine.
- verdict: keep
- reason: The doctrine owns the principle and this skill owns the recipe (ownership map row 44); this sentence is the recipe's condition, not a restatement of the principle, and test/doctrine-parity.test.js pins both ends of the chain.

### C019
- key: Use the pattern `^\s*;?\s*(CREATE|ALTER)(\s+OR\s+ALTER)?(\s+(UNIQUE|CLUSTERED|NONCLUSTERED|SPATIAL|COLUMNSTORE|FULLTEXT|XML))*\s+(PROCEDURE|TABLE|VIEW|FUNCTION|INDEX|TRIGGER|SCHEMA|TYPE)\b` to take definitions.
- class: mechanic
- source: plugins/claude-kit/skills/sql-style/SKILL.md:71
- provenance: ddd6c72 2026-08-23, each piece run against a real deployment corpus before landing; the earlier draft's simpler patterns were falsified in review.
- verdict: keep
- reason: No finding on the pattern itself. Every piece is load-bearing, and this entry is where the why now lives: the leading `;?` is needed because this style writes `;ALTER PROCEDURE` and a line-start anchor on the verb misses the defining line; the optional modifier group is needed because T-SQL writes `CREATE NONCLUSTERED INDEX`, and without it 843 of the 5,332 definitions on the measured corpus are silently dropped while `INDEX` still appears in the keyword list; the required object keyword is what keeps banner prose such as `CREATE TRANSACTION FOR PROCESSING.` out; the pattern is case-sensitive, costing 9 of 5,332 on that corpus, which only matters on a vendor script (C026); and `LOGIN`, `ROLE`, `SEQUENCE` and `SYNONYM` are outside the keyword list by design (C027).

### C020
- key: Keep every piece of the definitions pattern, since the optional `;?`, the modifier group, and the required object keyword each cover a case a simpler pattern misses.
- class: rationale-example
- source: plugins/claude-kit/skills/sql-style/SKILL.md:73
- provenance: ddd6c72 2026-08-23, a deliberate decision to ship each piece with what breaks without it; c6f08c5 2026-08-23 corrected the figures in review.
- verdict: retire
- reason: The pattern is obeyed by using it as written, so the per-piece justifications and the 843-of-5,332 measurement are rationale that now lives in the C019 entry above; the change is safe because nothing a session does differs once the pattern is copied verbatim, and the C055 read-past instruction survives as a clause.

### C021
- key: Take the banner grep second, after the definitions grep.
- class: rule
- source: plugins/claude-kit/skills/sql-style/SKILL.md:75
- provenance: ddd6c72 2026-08-23 installed the paragraph; c6f08c5 2026-08-23 repaired the ordering clause after review found it attributed a saving to ordering that ordering does not produce.
- verdict: rewrite
- reason: The rule and every sibling instruction in the paragraph survive verbatim; the rewrite removes only the two standalone rationale sentences retired under C024 and C056. The why for ordering, now here: on a 70,966-line vendor install script the banner grep returns 6,710 output lines where the definitions grep returns 820, and that volume is the price of true line numbers; taken second, only the banner hits near ranges already held are read.

### C022
- key: Read past banner hits outside the ranges the definitions grep narrowed to instead of scoping the grep.
- class: rule
- source: plugins/claude-kit/skills/sql-style/SKILL.md:75
- provenance: ddd6c72 2026-08-23, as C021.
- verdict: keep
- reason: The sentence survives verbatim in the C021 rewrite; its one-clause reason (range-restricting grep forms renumber their output) is the bound that stops a session scoping the grep under context pressure.

### C023
- key: Take banners with `grep -n -A 1 -E '^\s*/\*{3,}'`, where `-A 1` supplies the label line.
- class: mechanic
- source: plugins/claude-kit/skills/sql-style/SKILL.md:75
- provenance: ddd6c72 2026-08-23, run against a real vendor script before landing.
- verdict: keep
- reason: No finding on the mechanic itself; it survives verbatim in the C021 rewrite. The why, now here: the pattern anchors on the block-comment border alone because a dash rule is comment decoration in this style rather than section structure (C056), the border line carries no text so `-A 1` is what yields the label, a doubled border yields its second line as the label, and `GO` is never anchored on because it carries no structure and the measured script holds 936 of them (C025).

### C024
- key: Accept the banner grep's volume as the price of true line numbers, which is why it runs second.
- class: rationale-example
- source: plugins/claude-kit/skills/sql-style/SKILL.md:75
- provenance: ddd6c72 2026-08-23; the clause was repaired at c6f08c5 2026-08-23 after review caught a false attribution.
- verdict: retire
- reason: The ordering rule (C021) is obeyed without the measurement, and the figures already drifted once in review, which a ledger record does not suffer; the 6,710 / 70,966 / 820 measurement is recorded under C021.

### C025
- key: Never anchor an outline grep on `GO`.
- class: rule
- source: plugins/claude-kit/skills/sql-style/SKILL.md:75
- provenance: ddd6c72 2026-08-23, as C021.
- verdict: keep
- reason: Survives verbatim in the C021 rewrite with its figure as the bound; a `GO` anchor is the obvious wrong move on a T-SQL install script and the rule is what forecloses it.

### C026
- key: Add `-i` to the definitions grep when reading a vendor script.
- class: rule
- source: plugins/claude-kit/skills/sql-style/SKILL.md:75
- provenance: ddd6c72 2026-08-23, as C021.
- verdict: keep
- reason: Survives verbatim in the C021 rewrite; the case-sensitivity cost (9 of 5,332) is the bound that tells a session when the flag matters.

### C027
- key: Find `LOGIN`, `ROLE`, `SEQUENCE`, and `SYNONYM` objects by name rather than through the definitions pattern.
- class: rule
- source: plugins/claude-kit/skills/sql-style/SKILL.md:75
- provenance: ddd6c72 2026-08-23, as C021.
- verdict: keep
- reason: Survives verbatim in the C021 rewrite; it names the pattern's deliberate exclusions so a session does not widen the keyword list.

### C028
- key: Never use `CREATE OR ALTER PROCEDURE`; use shell-then-ALTER.
- class: rule
- source: plugins/claude-kit/skills/sql-style/SKILL.md:79
- provenance: f8c0649 2026-06-10, the initial consolidation; 830ff28 only replaced the em dash.
- verdict: keep
- reason: The antipattern names the valid-SQL default a model reaches for, which the philosophy point does not; ruled with C003.

### C029
- key: Never use trailing commas in any list.
- class: rule
- source: plugins/claude-kit/skills/sql-style/SKILL.md:80
- provenance: f8c0649 2026-06-10, the initial consolidation; 830ff28 only replaced the em dash.
- verdict: keep
- reason: The negative form at the writing moment; ruled with C008.

### C030
- key: Write SQL keywords in uppercase.
- class: rule
- source: plugins/claude-kit/skills/sql-style/SKILL.md:81
- provenance: f8c0649 2026-06-10, the initial consolidation; no incident narrative.
- verdict: keep
- reason: No finding.

### C031
- key: Bracket every column name as `[ColumnName]`.
- class: rule
- source: plugins/claude-kit/skills/sql-style/SKILL.md:82
- provenance: f8c0649 2026-06-10, the initial consolidation; no incident narrative.
- verdict: keep
- reason: Reference §12 is the same owner's detail layer with the even-when-unnecessary bound and reason.

### C032
- key: Handle routine errors by calling the project's error-logging proc in CATCH, guarded by an OBJECT_ID check, rather than RAISERROR.
- class: rule
- source: plugins/claude-kit/skills/sql-style/SKILL.md:83
- provenance: f8c0649 2026-06-10, the initial consolidation; 830ff28 genericized the proc name.
- verdict: keep
- reason: Names `RAISERROR`, the default a model writes, at the writing moment; the checklist (C052) gates the CATCH shape at completion and §11 owns the predicate and the THROW exception.

### C033
- key: Never build dynamic SQL by string concatenation.
- class: rule
- source: plugins/claude-kit/skills/sql-style/SKILL.md:84
- provenance: f8c0649 2026-06-10, the initial consolidation; no incident narrative.
- verdict: keep
- reason: No finding; the privilege-escalation bound is what lifts this out of style into security inside a `WITH EXECUTE AS` procedure.

### C034
- key: Where dynamic SQL is truly unavoidable, use `sp_executesql` with typed parameters and a justifying comment.
- class: rule
- source: plugins/claude-kit/skills/sql-style/SKILL.md:84
- provenance: f8c0649 2026-06-10, the initial consolidation; no incident narrative.
- verdict: keep
- reason: No finding; the carve-out of C033.

### C035
- key: Put `;SET NOCOUNT ON` and `;SET TRANSACTION ISOLATION LEVEL` together at the top of the procedure.
- class: rule
- source: plugins/claude-kit/skills/sql-style/SKILL.md:85
- provenance: f8c0649 2026-06-10, the initial consolidation; no incident narrative.
- verdict: keep
- reason: Names the omission at the writing moment; the checklist (C046) fixes the level per procedure kind at completion and §8 is the detail layer.

### C036
- key: Use a banner block carrying SCRIPT, AUTHOR, DATE, VERSION, and NOTES only, never verbose multi-paragraph header comments.
- class: rule
- source: plugins/claude-kit/skills/sql-style/SKILL.md:86
- provenance: f8c0649 2026-06-10, the initial consolidation; no incident narrative.
- verdict: keep
- reason: Names the verbose header a model writes; the checklist (C044) gates the fields, date format and version-note rule at completion and §6 is the detail layer.

### C037
- key: Never write change-narrative comments; state what the code does now, not the session, the change, or the prior version.
- class: rule
- source: plugins/claude-kit/skills/sql-style/SKILL.md:87
- provenance: cabbf89 2026-06-28, the doc-closeout-discipline plan (docs/archive/claude-kit_doc-closeout-discipline_spec_v1.md), which specified a one-line cross-reference to the doctrine's current-state rule in both style skills because implementers read the style skills and not the doctrine; baseline-tested under mimicry and deferral pressure.
- verdict: keep
- reason: The line already names the doctrine as owner, which is the pointer form, and its specimen phrases are the recognizable habit; compressing baseline-tested wording with no incident behind the compression is a re-baseline for nothing.

### C038
- key: Write sentence-style comments as short imperative statements of what the next block does, never history, decision narrative, or rationale essays.
- class: rule
- source: plugins/claude-kit/skills/sql-style/SKILL.md:87
- provenance: 058e3a3 2026-07-24, six deltas distilled from the operator's hand-edit review of Claude-authored code; reference §17 set as owner, §10 pointing, this antipattern line extended in the same change.
- verdict: keep
- reason: The copy at the writing moment was the install decision, and the line names the SQL comment forms the C# skill does not govern.

### C039
- key: Use `SYSDATETIMEOFFSET()` rather than `GETDATE()` for audit timestamps.
- class: rule
- source: plugins/claude-kit/skills/sql-style/SKILL.md:88
- provenance: f8c0649 2026-06-10, the initial consolidation; no incident narrative.
- verdict: keep
- reason: Reference §15 is the same owner's detail layer with the acceptable-`GETDATE()` case.

### C040
- key: Write SELECT aliases in the left-hand form `[Alias] = expression`, never `expr AS Alias`.
- class: rule
- source: plugins/claude-kit/skills/sql-style/SKILL.md:89
- provenance: f8c0649 2026-06-10, the initial consolidation; no incident narrative.
- verdict: keep
- reason: Reference §13 is the same owner's detail layer.

### C041
- key: Never use `SELECT *` in result sets returned to callers.
- class: rule
- source: plugins/claude-kit/skills/sql-style/SKILL.md:90
- provenance: f8c0649 2026-06-10, the initial consolidation; no incident narrative.
- verdict: keep
- reason: Reference §13 carries the `SELECT * INTO #Temp` carve-out, which the "returned to callers" bound already excludes.

### C042
- key: Before declaring SQL work complete, verify procs use shell-then-ALTER, functions drop-and-recreate, and tables and indexes carry IF NOT EXISTS guards.
- class: rule
- source: plugins/claude-kit/skills/sql-style/SKILL.md:94
- provenance: f8c0649 2026-06-10, the initial consolidation; no incident narrative.
- verdict: keep
- reason: The completion gate for the three deployment idioms; later incident commits (ce7b530, adf3d51) treated checklist lines as load-bearing surfaces to repair, not to fold away. Ruled with C003, C004, C005.

### C043
- key: Put `WITH EXECUTE AS '<schema_owner>'` on procs and scalar or multi-statement functions where the codebase impersonates.
- class: rule
- source: plugins/claude-kit/skills/sql-style/SKILL.md:95
- provenance: ce7b530 2026-06-28, SQL Server rejecting `WITH EXECUTE AS` on inline TVFs so two reference templates would not deploy; the checklist line gained the exclusion and the drop case.
- verdict: keep
- reason: The exclusion is a deployment-failure class, not style, and this line is where the completion gate catches it; the reference agrees by repair.

### C044
- key: Write the banner header as SCRIPT / AUTHOR / DATE in ordinal English / VERSION / NOTES, and add a note line for a new version rather than rewriting history.
- class: mechanic
- source: plugins/claude-kit/skills/sql-style/SKILL.md:96
- provenance: f8c0649 2026-06-10, the initial consolidation; cabbf89 2026-06-28 installed the change-narrative antipattern into this file and left this line standing.
- verdict: keep
- reason: The contention with the doctrine's current-state rule is not real: that rule exempts append-only history in terms and a banner's NOTES block is a changelog. Reference §6 is the same owner's detail layer.

### C045
- key: Write `BEGIN` after `AS` followed by a tab and the trailing label `-- PROCEDURE`.
- class: mechanic
- source: plugins/claude-kit/skills/sql-style/SKILL.md:97
- provenance: f8c0649 2026-06-10, the initial consolidation; no incident narrative.
- verdict: keep
- reason: Reference §2 is the same owner's detail layer.

### C046
- key: Pair `;SET NOCOUNT ON` with `READ UNCOMMITTED` for Get* procedures and `READ COMMITTED` for writes.
- class: mechanic
- source: plugins/claude-kit/skills/sql-style/SKILL.md:98
- provenance: f8c0649 2026-06-10, the initial consolidation; no incident narrative.
- verdict: keep
- reason: The completion gate for the SET pair with the level choice; ruled with C035.

### C047
- key: Prefix parameters with `@p_`, name locals plain `@PascalCase`, and declare an `@True`/`@False` BIT pair when conditionals exist.
- class: mechanic
- source: plugins/claude-kit/skills/sql-style/SKILL.md:99
- provenance: f8c0649 2026-06-10, the initial consolidation; no incident narrative.
- verdict: keep
- reason: Reference §7, §9 and §18 are the same owner's detail layer; that the reference states each naming rule twice is the reference's concern, not this line's.

### C048
- key: Use leading commas with tab alignment in every multi-line list and give the first item a leading space.
- class: rule
- source: plugins/claude-kit/skills/sql-style/SKILL.md:100
- provenance: f8c0649 2026-06-10, the initial consolidation; no incident narrative.
- verdict: keep
- reason: The completion gate for the layout rules; ruled with C008.

### C049
- key: End `/* Sub-Section. */` comments with a period and leave group labels without one.
- class: mechanic
- source: plugins/claude-kit/skills/sql-style/SKILL.md:101
- provenance: f8c0649 2026-06-10, the initial consolidation; 058e3a3 2026-07-24 set reference §17 as the owner of the sentence-versus-label convention.
- verdict: keep
- reason: The completion gate for the punctuation convention; §17 is the same owner's detail layer.

### C050
- key: Lay out tables with `/* Group Name */` column groups, audit fields (CreatedDt/UpdatedDt with SYSDATETIMEOFFSET defaults) at the bottom, and `PK_<Table>` last.
- class: mechanic
- source: plugins/claude-kit/skills/sql-style/SKILL.md:102
- provenance: f8c0649 2026-06-10, the initial consolidation; no incident narrative.
- verdict: keep
- reason: Reference §4 and §18 are the same owner's detail layer.

### C051
- key: Name indexes `IX_<Table>_<Cols>`, give each its own IF NOT EXISTS block, and put it in the table's file.
- class: mechanic
- source: plugins/claude-kit/skills/sql-style/SKILL.md:103
- provenance: f8c0649 2026-06-10, the initial consolidation; no incident narrative.
- verdict: keep
- reason: Reference §5 and §18 are the same owner's detail layer.

### C052
- key: Wrap main logic in TRY/CATCH where CATCH audits via the project's error-logging proc and does not re-throw.
- class: rule
- source: plugins/claude-kit/skills/sql-style/SKILL.md:104
- provenance: adf3d51 2026-07-24, a kit-wide consistency audit that found this line unconditional while §11 sanctioned a nested THROW; the carve-out and §11 pointer were added with the reference staying owner.
- verdict: keep
- reason: The line already points at §11 for the exception and was repaired to agree with it; the completion gate is where an unconditional no-re-throw would otherwise be enforced wrongly.

### C053
- key: End every SQL file with `GO`.
- class: rule
- source: plugins/claude-kit/skills/sql-style/SKILL.md:105
- provenance: f8c0649 2026-06-10, the initial consolidation; no incident narrative.
- verdict: keep
- reason: Reference §2 is the same owner's detail layer.

### C054
- key: For the exact banner header format, go read reference §6.
- class: pointer
- source: plugins/claude-kit/skills/sql-style/SKILL.md:44
- provenance: f8c0649 2026-06-10, the initial consolidation; 830ff28 only replaced the em dash.
- verdict: keep
- reason: No finding; the exemplar's stand-in comment is already the pointer form.

### C055
- key: When a banner sentence happens to open with a real object keyword and false-matches the definitions grep, read past it rather than trying to filter it out.
- class: rationale-example
- source: plugins/claude-kit/skills/sql-style/SKILL.md:73
- provenance: ddd6c72 2026-08-23, as C019.
- verdict: rewrite
- reason: The instruction (read past, never filter) is a rule a session obeys and survives as one clause beside the pattern; the surrounding justification of the object-keyword requirement is rationale recorded under C019. Safe because the obeyed instruction is unchanged in substance.

### C056
- key: Do not expect or search for dash-rule comments as section banners; only the block-comment border marks section structure.
- class: rationale-example
- source: plugins/claude-kit/skills/sql-style/SKILL.md:75
- provenance: ddd6c72 2026-08-23, as C021.
- verdict: retire
- reason: The banner pattern (C023) is obeyed as written and this sentence explains what its anchor excludes; that why is recorded under C023, so nothing a session does changes when the sentence leaves the document.

## plugins/claude-kit/skills/sql-style/references/sql-style.md

This document is the detailed pattern reference for the operator's T-SQL house style, modeled on a numbered-folder, procedure-only deployment database library. It owns the moments in which a session writes or modifies any SQL: folder placement and file naming, the shell-then-ALTER procedure deployment idiom, drop-and-recreate function deployment, defensive table and index existence checks, the procedure header banner, parameter and variable declarations, SET statements, in-body section banners, TRY/CATCH with non-rethrowing audit logging, leading-comma and tab alignment, SELECT/INSERT/UPDATE layout, JOIN and CTE form, preferred string, date and null functions, temp tables, comment voice and punctuation, naming conventions, and the full procedure, table and function skeletons. A session loads it as a `named-trigger` (inferred) reference: it is pulled in before writing or modifying SQL of any kind, when the governing style skill directs a session to the detailed patterns, and its opening line names it as the pattern reference rather than an always-on or plan-scoped surface.

Extracted at `6bc07fb`: whole document (`skills.sql-style.references.sql-style.md`).

### C001
- key: Substitute the project's own schema and procedure names for the example names rather than copying them literally.
- class: rule
- source: plugins/claude-kit/skills/sql-style/references/sql-style.md:3
- provenance: 830ff28 2026-06-17, installed when the reference's one-project names (ELEOS) were genericized for team sharing ("genericize ELEOS/TMWSuite operational refs, patterns kept"); a8770b3 2026-06-28 replaced the remaining names with placeholders.
- verdict: keep
- reason: The sentence names the three identifiers a session must not copy; without it the placeholders read as the rule. Parallel lines in the SKILL exemplar and the C# reference name their own placeholders and are not duplicates.

### C002
- key: Inside a repository holding such a script library, open a sibling file in that library and follow its layout exactly.
- class: rule
- source: plugins/claude-kit/skills/sql-style/references/sql-style.md:3
- provenance: f8c0649 2026-06-10 (INIT, "When in doubt, open a sibling file"); 830ff28 2026-06-17 added the repo-kind bound alongside the style-precedence rule in the SKILL.
- verdict: keep
- reason: The SKILL owns the mimic rule with its Precedence bound (SKILL.md:16, :20); this clause is the bounded restatement at the head of the reference and is no longer than a pointer. The unbounded copy at line 689 (C170) is what retires.

### C003
- key: Place each object in its numeric-prefixed folder: 0-Client, 3-Tables, 4-Functions, 5-Procedures, 9-System, Database.
- class: mechanic
- source: plugins/claude-kit/skills/sql-style/references/sql-style.md:33
- provenance: f8c0649 2026-06-10, consolidated at kit initialization from the operator's deployment library.
- verdict: keep
- reason: No finding. The folder set is the library's layout and no machinery enforces it.

### C004
- key: Leave folder numbers 1, 2, 6, 7 and 8 unused and reserved for future categories.
- class: rule
- source: plugins/claude-kit/skills/sql-style/references/sql-style.md:44
- provenance: f8c0649 2026-06-10 (830ff28 only replaced an em dash).
- verdict: keep
- reason: No finding.

### C005
- key: Name each file `<schema>.<object>.sql`.
- class: mechanic
- source: plugins/claude-kit/skills/sql-style/references/sql-style.md:46
- provenance: f8c0649 2026-06-10.
- verdict: keep
- reason: No finding.

### C006
- key: Omit the object-type prefix from table file names.
- class: mechanic
- source: plugins/claude-kit/skills/sql-style/references/sql-style.md:49
- provenance: f8c0649 2026-06-10 (a8770b3 only replaced the schema name with a placeholder).
- verdict: keep
- reason: No finding.

### C007
- key: Name variant procedures with the suffixes `_Default`, `_Maintenance`, `_Trailers`, `_TMS`, `_Debug` or `_Custom_*`.
- class: mechanic
- source: plugins/claude-kit/skills/sql-style/references/sql-style.md:51
- provenance: f8c0649 2026-06-10; both copies came in together, no incident behind the duplicate.
- verdict: retire
- reason: §18's suffix list (lines 517 to 522) carries every suffix with its meaning and folder; line 51's list is a strict subset. Safe because the owner keeps the whole and line 51's second sentence (helper suffixes, C008) stays.

### C008
- key: Name helper sub-procedures of a parent with the suffixes `_Data`, `_Sort`, `_Stops` or `_Trips`.
- class: mechanic
- source: plugins/claude-kit/skills/sql-style/references/sql-style.md:51
- provenance: f8c0649 2026-06-10.
- verdict: keep
- reason: No finding. §18 does not carry the helper suffixes, so this sentence is their only statement.

### C009
- key: Always deploy a procedure by creating a shell if none exists and then ALTERing it; never use `CREATE OR ALTER PROCEDURE`.
- class: rule
- source: plugins/claude-kit/skills/sql-style/references/sql-style.md:55
- provenance: f8c0649 2026-06-10 (830ff28 only replaced an em dash).
- verdict: keep
- reason: The idiom is the style's first signature trait and a model's default (CREATE OR ALTER) is the banned form; no hook or lint enforces it. The reference states it whole; the SKILL summarizes.

### C010
- key: Use shell-then-ALTER because it preserves existing GRANTs and permissions across deployments.
- class: rationale-example
- source: plugins/claude-kit/skills/sql-style/references/sql-style.md:55
- provenance: f8c0649 2026-06-10.
- verdict: retire
- reason: The why: CREATE OR ALTER re-creates the object's metadata on a drop path in some tooling and a DROP/CREATE loses GRANTs, while ALTER on an existing shell keeps every permission granted to the procedure across redeployment. The SKILL still carries "preserves GRANTs" at SKILL.md:12 and :80, so nothing leaves the corpus.

### C011
- key: Follow the shown shell-then-ALTER block: an `;IF OBJECT_ID(...) IS NULL` shell EXEC, `GO`, then `;ALTER PROCEDURE`, `WITH EXECUTE AS`, `AS`, `BEGIN`, `END`, `GO`.
- class: rationale-example
- source: plugins/claude-kit/skills/sql-style/references/sql-style.md:59
- provenance: f8c0649 2026-06-10.
- verdict: retire
- reason: The §19 template at lines 528 to 588 carries the identical shape, so the §2 block is a duplicate specimen; the §2 key details read against §19 unchanged.

### C012
- key: Indent the shell `EXEC` line by two spaces, not a tab.
- class: mechanic
- source: plugins/claude-kit/skills/sql-style/references/sql-style.md:77
- provenance: f8c0649 2026-06-10.
- verdict: keep
- reason: No finding. A whitespace detail a template shows but prose must name.

### C013
- key: Put `WITH EXECUTE AS '<schema_owner>'` before `AS` only where the project uses owner impersonation, and drop the clause entirely where it does not.
- class: rule
- source: plugins/claude-kit/skills/sql-style/references/sql-style.md:78
- provenance: ce7b530 2026-06-28, a defect fix: the reference framed impersonation as universal and contradicted the SKILL, and two inline-TVF templates would not deploy; surfaced by comparing against a fork of the kit.
- verdict: rewrite
- reason: The condition, placement and drop case stay verbatim. Only the parenthetical "(as the project's codebase does, for a vendor-driven security constraint)" goes: it read "as the ELEOS codebase does" until a8770b3 swapped the name, and now refers to no project while implying the reader's does impersonate.

### C014
- key: Never put `WITH EXECUTE AS` on an inline table-valued function.
- class: rule
- source: plugins/claude-kit/skills/sql-style/references/sql-style.md:78
- provenance: ce7b530 2026-06-28, the same defect fix: SQL Server rejects the clause on inline TVFs, which run under ownership chaining.
- verdict: keep
- reason: A template carrying the clause failed to deploy; the rule prevents a recurrence and nothing mechanical checks generated SQL.

### C015
- key: Put a tab between `BEGIN` and the trailing inline `-- PROCEDURE` label comment.
- class: mechanic
- source: plugins/claude-kit/skills/sql-style/references/sql-style.md:79
- provenance: f8c0649 2026-06-10.
- verdict: keep
- reason: A signature whitespace detail; the reference states it beside its specimen and the SKILL checklist repeats it as a check.

### C016
- key: End the file with `GO` after the closing `END`.
- class: mechanic
- source: plugins/claude-kit/skills/sql-style/references/sql-style.md:80
- provenance: f8c0649 2026-06-10.
- verdict: keep
- reason: The reference states the closing GO in position; the checklist restates as a check.

### C017
- key: Deploy functions by dropping and recreating them rather than by the shell-then-ALTER pattern.
- class: rule
- source: plugins/claude-kit/skills/sql-style/references/sql-style.md:84
- provenance: f8c0649 2026-06-10.
- verdict: keep
- reason: The reference is the pattern owner and states the idiom with its contrast to procedures.

### C018
- key: Drop and recreate functions because they cannot be ALTERed the same way and drop-recreate is faster than the shell pattern.
- class: rationale-example
- source: plugins/claude-kit/skills/sql-style/references/sql-style.md:84
- provenance: f8c0649 2026-06-10.
- verdict: retire
- reason: The why: the shell trick (`CREATE ... AS RETURN 0`) cannot stand in for a function whose return type the real definition sets, so a placeholder-then-ALTER path does not work for functions the way it does for procedures, and functions carry no GRANTs worth preserving in this library. Safe to drop from the document because C017 is obeyed without it.

### C019
- key: Follow the shown function block: `;IF OBJECT_ID(...) IS NOT NULL` with a `DROP FUNCTION` EXEC, `GO`, then `;CREATE FUNCTION`, parameters, `RETURNS TABLE`, `AS`, `RETURN ( ... )`, `GO`.
- class: rationale-example
- source: plugins/claude-kit/skills/sql-style/references/sql-style.md:86
- provenance: f8c0649 2026-06-10; ce7b530 2026-06-28 removed the invalid EXECUTE AS line.
- verdict: retire
- reason: The §21 template at lines 644 to 674 carries the identical shape; the §3 block is a duplicate specimen.

### C020
- key: For scalar functions put `RETURN` on its own line followed by the expression.
- class: mechanic
- source: plugins/claude-kit/skills/sql-style/references/sql-style.md:104
- provenance: f8c0649 2026-06-10.
- verdict: keep
- reason: No finding.

### C021
- key: For inline table-valued functions write `RETURN ( ... query ... )`.
- class: mechanic
- source: plugins/claude-kit/skills/sql-style/references/sql-style.md:104
- provenance: f8c0649 2026-06-10.
- verdict: keep
- reason: No finding.

### C022
- key: Guard a table creation with a defensive existence check on `sys.schemas` joined to `sys.tables`, not with `OBJECT_ID`.
- class: rule
- source: plugins/claude-kit/skills/sql-style/references/sql-style.md:108
- provenance: f8c0649 2026-06-10.
- verdict: keep
- reason: The reference is the only surface naming the catalog views and ruling out OBJECT_ID; the SKILL says IF NOT EXISTS only. C026 is its in-section restatement and retires.

### C023
- key: Use the sys.schemas/sys.tables check because it reads better in the diff and protects against name collisions across schemas.
- class: rationale-example
- source: plugins/claude-kit/skills/sql-style/references/sql-style.md:108
- provenance: f8c0649 2026-06-10.
- verdict: retire
- reason: The why: the join form names schema and table on separate lines so a diff shows which changed, and it cannot match a same-named table in another schema. C022 is obeyed without it.

### C024
- key: Follow the shown ApiCalls table script: banner, `;IF NOT EXISTS` schema/table check, `BEGIN`, `;CREATE TABLE` with grouped tab-aligned columns and a trailing PK constraint, `END`, `GO`.
- class: rationale-example
- source: plugins/claude-kit/skills/sql-style/references/sql-style.md:110
- provenance: f8c0649 2026-06-10.
- verdict: retire
- reason: The §20 template at lines 594 to 638 carries the same shape end to end; the one construct only the ApiCalls script shows, a PERSISTED computed column, is stated in prose at line 163.

### C025
- key: Start a table file with the `/* TABLE: <Name> */` banner comment.
- class: mechanic
- source: plugins/claude-kit/skills/sql-style/references/sql-style.md:153
- provenance: f8c0649 2026-06-10.
- verdict: keep
- reason: No finding.

### C026
- key: Write the `IF NOT EXISTS` block as `sys.schemas` LEFT JOIN `sys.tables`.
- class: mechanic
- source: plugins/claude-kit/skills/sql-style/references/sql-style.md:154
- provenance: f8c0649 2026-06-10.
- verdict: retire
- reason: A key-details bullet restating C022 forty-six lines later in the same section with no added content (A030, A031). Safe because C022 stays and the template shows the join.

### C027
- key: Wrap the `CREATE TABLE` in `BEGIN` and `END`.
- class: mechanic
- source: plugins/claude-kit/skills/sql-style/references/sql-style.md:155
- provenance: f8c0649 2026-06-10.
- verdict: keep
- reason: No finding.

### C028
- key: Lead the `CREATE TABLE` statement with a semicolon.
- class: mechanic
- source: plugins/claude-kit/skills/sql-style/references/sql-style.md:156
- provenance: f8c0649 2026-06-10.
- verdict: keep
- reason: The reference carries no general leading-semicolon rule; it states the semicolon per construct while the SKILL (SKILL.md:14) states the general rule with its reason. The bullet is the reference's only statement for CREATE TABLE.

### C029
- key: Give the first column a leading space before `[` and every subsequent column a leading comma.
- class: mechanic
- source: plugins/claude-kit/skills/sql-style/references/sql-style.md:157
- provenance: f8c0649 2026-06-10.
- verdict: keep
- reason: §12's enumeration of where the layout applies names temp-table columns but not CREATE TABLE columns, so this bullet is the explicit statement for permanent tables (A114).

### C030
- key: Tab-align table columns name, then type, then nullability, then default.
- class: mechanic
- source: plugins/claude-kit/skills/sql-style/references/sql-style.md:158
- provenance: f8c0649 2026-06-10.
- verdict: keep
- reason: The only surface stating the four-column order with nullability; §12 states the mechanism (tabs), not the order.

### C031
- key: Group related columns with `/* Group Name */` block comments.
- class: mechanic
- source: plugins/claude-kit/skills/sql-style/references/sql-style.md:159
- provenance: f8c0649 2026-06-10.
- verdict: keep
- reason: The reference states the form with the canonical group names; the checklist restates as a check.

### C032
- key: Put a blank line between column groups.
- class: mechanic
- source: plugins/claude-kit/skills/sql-style/references/sql-style.md:160
- provenance: f8c0649 2026-06-10.
- verdict: keep
- reason: No finding.

### C033
- key: Always put the audit fields `CreatedDt` and `UpdatedDt` at the bottom of the column list, defaulted to `SYSDATETIMEOFFSET()` rather than `GETDATE()`.
- class: rule
- source: plugins/claude-kit/skills/sql-style/references/sql-style.md:161
- provenance: f8c0649 2026-06-10.
- verdict: keep
- reason: Stated where the columns are defined; the SKILL antipattern and checklist summarize it.

### C034
- key: Write default constraints inline as `DEFAULT(...)` rather than naming them separately.
- class: mechanic
- source: plugins/claude-kit/skills/sql-style/references/sql-style.md:162
- provenance: f8c0649 2026-06-10.
- verdict: keep
- reason: No finding.

### C035
- key: Write computed columns as `AS ( expression ) PERSISTED`.
- class: mechanic
- source: plugins/claude-kit/skills/sql-style/references/sql-style.md:163
- provenance: f8c0649 2026-06-10.
- verdict: keep
- reason: No finding. After C024 retires this line is the only statement of the computed-column form.

### C036
- key: Put the primary key last, name it `PK_<TableName>`, and put the name on its own line with `PRIMARY KEY CLUSTERED ( [Col] )` indented underneath.
- class: mechanic
- source: plugins/claude-kit/skills/sql-style/references/sql-style.md:164
- provenance: f8c0649 2026-06-10.
- verdict: keep
- reason: Carries position and the two-line layout, which the §18 naming row does not; only the name pattern is shared.

### C037
- key: Put indexes in the same file as the table they support and give each index its own `IF NOT EXISTS` block.
- class: rule
- source: plugins/claude-kit/skills/sql-style/references/sql-style.md:168
- provenance: f8c0649 2026-06-10.
- verdict: keep
- reason: The reference states placement and the per-index block; the checklist restates.

### C038
- key: Follow the shown index block: a `-- Check for and Create ...` comment, `;IF NOT EXISTS` over `sys.indexes`, `BEGIN`, `;CREATE NONCLUSTERED INDEX` with a leading-comma column list, `END`, `GO`.
- class: rationale-example
- source: plugins/claude-kit/skills/sql-style/references/sql-style.md:170
- provenance: f8c0649 2026-06-10.
- verdict: retire
- reason: The §20 template ends with the identical index block at lines 627 to 637; the §5 block is a duplicate specimen and the §5 bullets read against §20.

### C039
- key: Name indexes `IX_<TableName>_<ColumnList>`.
- class: mechanic
- source: plugins/claude-kit/skills/sql-style/references/sql-style.md:184
- provenance: f8c0649 2026-06-10.
- verdict: retire
- reason: The §18 row at line 512 carries the same pattern and the same example; §18 owns naming. Safe because the SKILL checklist also carries the pattern.

### C040
- key: Write each index existence check against `sys.indexes` using `OBJECT_ID(...)` and `[name] = '...'`.
- class: mechanic
- source: plugins/claude-kit/skills/sql-style/references/sql-style.md:185
- provenance: f8c0649 2026-06-10.
- verdict: keep
- reason: No finding.

### C041
- key: Write the index column list inside `( ... )` in the leading-comma and tab-alignment style.
- class: mechanic
- source: plugins/claude-kit/skills/sql-style/references/sql-style.md:186
- provenance: f8c0649 2026-06-10.
- verdict: keep
- reason: Already reads as a pointer at the §12 style rather than a restatement of its shape (A114).

### C042
- key: Introduce each index block with a short `-- Check for and Create <IndexName>.` comment.
- class: mechanic
- source: plugins/claude-kit/skills/sql-style/references/sql-style.md:187
- provenance: f8c0649 2026-06-10.
- verdict: keep
- reason: No finding.

### C043
- key: Give every procedure a metadata banner inside `BEGIN -- PROCEDURE` documenting purpose, author, version and history, and never skip it.
- class: rule
- source: plugins/claude-kit/skills/sql-style/references/sql-style.md:191
- provenance: f8c0649 2026-06-10.
- verdict: rewrite
- reason: The contents and the never-skip fold into one sentence; the two emphasis sentences add no instruction. The doctrine's current-state rule does not conflict: the NOTES block is an append-only per-object changelog, which the doctrine exempts by name (A051).

### C044
- key: Follow the shown banner: two asterisk rows, SCRIPT/AUTHOR/DATE/VERSION lines, an asterisk row, a NOTES entry, then two closing asterisk rows.
- class: rationale-example
- source: plugins/claude-kit/skills/sql-style/references/sql-style.md:196
- provenance: f8c0649 2026-06-10; a8770b3 2026-06-28 replaced the author and company with placeholders.
- verdict: keep
- reason: The §6 conventions describe this specimen's rows and its worked ordinal date; the §19 template shows only placeholders, so this is the one specimen with the date and NOTES entry as written.

### C045
- key: Make the banner's top and bottom rows about 92 asterisks wide, counted by eye rather than strictly.
- class: mechanic
- source: plugins/claude-kit/skills/sql-style/references/sql-style.md:211
- provenance: f8c0649 2026-06-10.
- verdict: keep
- reason: Sizes the header banner and admits eyeballing; C082 sizes a different object.

### C046
- key: Bookend the SCRIPT/AUTHOR/DATE/VERSION block with two adjacent asterisk lines.
- class: mechanic
- source: plugins/claude-kit/skills/sql-style/references/sql-style.md:212
- provenance: f8c0649 2026-06-10.
- verdict: keep
- reason: No finding.

### C047
- key: Separate the metadata block from the NOTES section with one asterisk line.
- class: mechanic
- source: plugins/claude-kit/skills/sql-style/references/sql-style.md:213
- provenance: f8c0649 2026-06-10.
- verdict: keep
- reason: No finding.

### C048
- key: Write the banner DATE in ordinal English format such as "February 16th, 2025", not "2025-02-16".
- class: mechanic
- source: plugins/claude-kit/skills/sql-style/references/sql-style.md:214
- provenance: f8c0649 2026-06-10.
- verdict: keep
- reason: The reference states the format with a worked date and counter-example; the checklist says "ordinal English".

### C049
- key: Lead each NOTES entry with `vN.N - MM/DD/YYYY - AUTHOR NAME - COMPANY` and indent the body underneath.
- class: mechanic
- source: plugins/claude-kit/skills/sql-style/references/sql-style.md:215
- provenance: f8c0649 2026-06-10.
- verdict: keep
- reason: No finding.

### C050
- key: Write AUTHOR as the author's name alone or as `<Author Name> / <Company>`.
- class: mechanic
- source: plugins/claude-kit/skills/sql-style/references/sql-style.md:216
- provenance: f8c0649 2026-06-10; a8770b3 2026-06-28 replaced the operator's name and company with placeholders.
- verdict: keep
- reason: No finding.

### C051
- key: When bumping the version, add a new note line above the previous one and do not rewrite the existing history.
- class: rule
- source: plugins/claude-kit/skills/sql-style/references/sql-style.md:217
- provenance: f8c0649 2026-06-10.
- verdict: keep
- reason: The NOTES block is an append-only changelog, exempt from the doctrine's current-state rule by name (A060); the reference states the rule with the note's position and the checklist restates.

### C052
- key: Declare procedure parameters inside parentheses after the procedure name.
- class: mechanic
- source: plugins/claude-kit/skills/sql-style/references/sql-style.md:221
- provenance: f8c0649 2026-06-10.
- verdict: keep
- reason: No finding.

### C053
- key: Make the first row inside the parameter list a comment row showing the PARAMETER NAME, DATATYPE and DEFAULT column headings.
- class: mechanic
- source: plugins/claude-kit/skills/sql-style/references/sql-style.md:221
- provenance: f8c0649 2026-06-10.
- verdict: keep
- reason: No finding.

### C054
- key: Follow the shown parameter block: heading comment row, a first parameter with a leading space, subsequent parameters with leading commas, then `)`, `WITH EXECUTE AS`, `AS`, `BEGIN`.
- class: rationale-example
- source: plugins/claude-kit/skills/sql-style/references/sql-style.md:223
- provenance: f8c0649 2026-06-10.
- verdict: retire
- reason: The §19 template at lines 535 to 545 carries the identical parameter block shape; the §7 block is a duplicate specimen and the §7 conventions read against §19.

### C055
- key: Prefix input parameter names with `@p_`.
- class: mechanic
- source: plugins/claude-kit/skills/sql-style/references/sql-style.md:242
- provenance: f8c0649 2026-06-10.
- verdict: retire
- reason: The §18 row at line 508 carries the same pattern and example and the SKILL checklist carries the prefix; C076 still bars @p_ on locals. Nothing leaves the corpus.

### C056
- key: Give the first parameter a leading space and every subsequent parameter a leading comma.
- class: mechanic
- source: plugins/claude-kit/skills/sql-style/references/sql-style.md:243
- provenance: f8c0649 2026-06-10.
- verdict: retire
- reason: A pure instance of C096, and §12's enumeration names parameter lists explicitly (A114).

### C057
- key: Tab-align the parameter name column, then the type column, then the default column.
- class: mechanic
- source: plugins/claude-kit/skills/sql-style/references/sql-style.md:244
- provenance: f8c0649 2026-06-10.
- verdict: keep
- reason: §12 states tabs and leading commas but not the name/type/default order; this bullet is the reference's statement of the order for parameters.

### C058
- key: Default parameters to `= NULL` by default, `= 0` for counts and numerics, and `= 1` for flags meaning on.
- class: mechanic
- source: plugins/claude-kit/skills/sql-style/references/sql-style.md:245
- provenance: f8c0649 2026-06-10.
- verdict: keep
- reason: No finding.

### C059
- key: Put `OUTPUT` parameters at the end of the parameter list.
- class: mechanic
- source: plugins/claude-kit/skills/sql-style/references/sql-style.md:246
- provenance: f8c0649 2026-06-10.
- verdict: keep
- reason: No finding.

### C060
- key: Declare table-valued parameters with `READONLY`.
- class: mechanic
- source: plugins/claude-kit/skills/sql-style/references/sql-style.md:247
- provenance: f8c0649 2026-06-10.
- verdict: keep
- reason: No finding.

### C061
- key: Put the closing `)` and the `WITH EXECUTE AS '<schema_owner>'` line at the procedure-signature column.
- class: mechanic
- source: plugins/claude-kit/skills/sql-style/references/sql-style.md:248
- provenance: f8c0649 2026-06-10.
- verdict: keep
- reason: No finding.

### C062
- key: Match the surrounding files when choosing between the parenthesized parameter wrapper and the older no-parentheses style; either is acceptable.
- class: rule
- source: plugins/claude-kit/skills/sql-style/references/sql-style.md:250
- provenance: f8c0649 2026-06-10.
- verdict: keep
- reason: Both wrapper forms are house style, so matching siblings picks between two house-approved forms and defers to no foreign convention; the SKILL's Precedence section governs a sibling written outside the style (A070).

### C063
- key: Open every procedure body with two paired SET statements inside their own banner section.
- class: rule
- source: plugins/claude-kit/skills/sql-style/references/sql-style.md:254
- provenance: f8c0649 2026-06-10.
- verdict: keep
- reason: The reference states the pair with its banner; the SKILL antipattern bars skipping them. C068 adds the banner wording latitude.

### C064
- key: Follow the shown opening: a banner reading "SET PROCESSING VARIABLES TO INCREASE SPEED AND DATA ACCESS." then `;SET NOCOUNT ON` and `;SET TRANSACTION ISOLATION LEVEL READ UNCOMMITTED`.
- class: rationale-example
- source: plugins/claude-kit/skills/sql-style/references/sql-style.md:256
- provenance: f8c0649 2026-06-10.
- verdict: retire
- reason: The §19 template at lines 559 to 563 carries the block verbatim, banner wording included.

### C065
- key: Always include `SET NOCOUNT ON`.
- class: rule
- source: plugins/claude-kit/skills/sql-style/references/sql-style.md:264
- provenance: f8c0649 2026-06-10.
- verdict: keep
- reason: The reference states it as mandatory; the SKILL restates as antipattern and check.

### C066
- key: Pair the SET with `SET TRANSACTION ISOLATION LEVEL READ UNCOMMITTED` for read-heavy procedures and `READ COMMITTED` for write, transactional and audit procedures.
- class: mechanic
- source: plugins/claude-kit/skills/sql-style/references/sql-style.md:265
- provenance: f8c0649 2026-06-10.
- verdict: keep
- reason: The reference states both levels with the procedure families; the checklist summarizes.

### C067
- key: Lead both SET statements with a semicolon.
- class: mechanic
- source: plugins/claude-kit/skills/sql-style/references/sql-style.md:268
- provenance: f8c0649 2026-06-10.
- verdict: keep
- reason: As C028: the reference states the semicolon per construct and carries no general rule; the SKILL owns the general rule.

### C068
- key: Wrap the SET statements in a section banner naming what they are for.
- class: mechanic
- source: plugins/claude-kit/skills/sql-style/references/sql-style.md:269
- provenance: f8c0649 2026-06-10.
- verdict: keep
- reason: The two banner wordings it gives end in a period because they are imperative sentences; the contradiction with C081 is real and C081 is the side that gives way (A081).

### C069
- key: Do not use `SET XACT_ABORT`; handle errors with TRY/CATCH instead.
- class: rule
- source: plugins/claude-kit/skills/sql-style/references/sql-style.md:271
- provenance: f8c0649 2026-06-10.
- verdict: keep
- reason: No finding.

### C070
- key: Declare variables in grouped `;DECLARE` blocks, grouped by purpose, with tabs aligned.
- class: rule
- source: plugins/claude-kit/skills/sql-style/references/sql-style.md:275
- provenance: f8c0649 2026-06-10.
- verdict: keep
- reason: No finding.

### C071
- key: Follow the shown DECLARE block: a banner reading "DECLARE VARIABLES FOR PROCESSING." then `;DECLARE @True BIT = 1` with subsequent variables on leading-comma lines, tab-aligned.
- class: rationale-example
- source: plugins/claude-kit/skills/sql-style/references/sql-style.md:277
- provenance: f8c0649 2026-06-10.
- verdict: retire
- reason: The §19 template at lines 565 to 569 carries the DECLARE block with the same banner and alignment.

### C072
- key: Introduce a declaration block with one `;DECLARE` keyword and continue subsequent variables with a leading comma.
- class: mechanic
- source: plugins/claude-kit/skills/sql-style/references/sql-style.md:288
- provenance: f8c0649 2026-06-10.
- verdict: keep
- reason: The single-DECLARE-keyword instruction is content §12 does not carry; only the leading-comma continuation is shared.

### C073
- key: Tab-align the variable name, then type, then default.
- class: mechanic
- source: plugins/claude-kit/skills/sql-style/references/sql-style.md:289
- provenance: f8c0649 2026-06-10.
- verdict: keep
- reason: As C057: the reference's only statement of the column order for DECLARE blocks; §12 does not carry the order.

### C074
- key: Declare `@True BIT = 1` and `@False BIT = 0` at the top of a procedure with conditional logic and use them in place of literal `1` and `0`.
- class: rule
- source: plugins/claude-kit/skills/sql-style/references/sql-style.md:290
- provenance: f8c0649 2026-06-10.
- verdict: keep
- reason: Instructs declaring and using the pair; the §18 row only names and types it.

### C075
- key: Name local variables plain `@PascalCase` with no `@v_` or `@local_` prefix.
- class: mechanic
- source: plugins/claude-kit/skills/sql-style/references/sql-style.md:291
- provenance: f8c0649 2026-06-10.
- verdict: keep
- reason: Names the rejected prefixes, which neither the SKILL nor the §18 row carries.

### C076
- key: Never use the `@p_` prefix for a local variable; reserve it for parameters.
- class: rule
- source: plugins/claude-kit/skills/sql-style/references/sql-style.md:292
- provenance: f8c0649 2026-06-10.
- verdict: keep
- reason: No finding. After C055 retires this line still bars the prefix on locals.

### C077
- key: Use multiple `;DECLARE` blocks with separate banners when a procedure has many conceptually distinct variable groups.
- class: rule
- source: plugins/claude-kit/skills/sql-style/references/sql-style.md:293
- provenance: f8c0649 2026-06-10.
- verdict: keep
- reason: No finding.

### C078
- key: Introduce every logical phase inside the procedure body with a section banner.
- class: rule
- source: plugins/claude-kit/skills/sql-style/references/sql-style.md:297
- provenance: f8c0649 2026-06-10.
- verdict: keep
- reason: The reference states the rule with the phase order beneath it; the SKILL philosophy line summarizes.

### C079
- key: Order the standard phases: SET processing variables, DECLARE variables, temporary tables, retrieve or populate base data, validation and guard checks, main logic, output result sets, then cleanup and finalization.
- class: mechanic
- source: plugins/claude-kit/skills/sql-style/references/sql-style.md:299
- provenance: f8c0649 2026-06-10.
- verdict: keep
- reason: No finding.

### C080
- key: Follow the shown banner form: an asterisk line, an indented uppercase title such as `DATASET 1: MESSAGE HEADER`, then a closing asterisk line.
- class: rationale-example
- source: plugins/claude-kit/skills/sql-style/references/sql-style.md:310
- provenance: f8c0649 2026-06-10.
- verdict: keep
- reason: The document's only specimen of a label-style banner without a period; after C081's rewrite it is the label half of the sentence-versus-label pair.

### C081
- key: Write the banner-internal title in uppercase with no terminating period.
- class: mechanic
- source: plugins/claude-kit/skills/sql-style/references/sql-style.md:316
- provenance: f8c0649 2026-06-10.
- verdict: rewrite
- reason: Four of the document's five banner specimens (lines 258, 279, 331, 572) end in a period and one (312) does not; the specimens are copied from the operator's library and follow §17's sentence-versus-label convention, so the flat "no period" was an authored over-generalization. Rewrite to: uppercase; a period when the title is an imperative sentence, none when it is a label, per §17.

### C082
- key: Make the banner asterisk lines 92 characters wide.
- class: mechanic
- source: plugins/claude-kit/skills/sql-style/references/sql-style.md:316
- provenance: f8c0649 2026-06-10.
- verdict: keep
- reason: The SKILL's `/********** TITLE **********/` is the style's shorthand name, not a competing single-line shape; the SKILL's own exemplar renders the 92-asterisk multi-line form (A094).

### C083
- key: Indent the banner title by one leading space plus a tab inside the banner.
- class: mechanic
- source: plugins/claude-kit/skills/sql-style/references/sql-style.md:316
- provenance: f8c0649 2026-06-10.
- verdict: keep
- reason: No finding.

### C084
- key: Introduce a sub-section inside a banner with a single-line `/* Sub-Section Title. */` block comment ending in a period, stating briefly what the next block does.
- class: mechanic
- source: plugins/claude-kit/skills/sql-style/references/sql-style.md:318
- provenance: 058e3a3 2026-07-24, the PrePass hand-edit review: the operator's review of Claude-authored code found narrative comments, and the fix made §17 the voice owner with §10 pointing at it.
- verdict: keep
- reason: The commit that owns this passage shaped it as the in-context pointer at §17; it carries the form and period at the moment of use and is already the pointer shape the one-owner rule asks for.

### C085
- key: Read section 17 for the comment voice when writing sub-section comments.
- class: pointer
- source: plugins/claude-kit/skills/sql-style/references/sql-style.md:318
- provenance: 058e3a3 2026-07-24.
- verdict: keep
- reason: No finding. This is the pointer 058e3a3 installed.

### C086
- key: Write a sub-section comment like `/* Make Table to Track the Messages to Resend. */` immediately above the statement it introduces.
- class: rationale-example
- source: plugins/claude-kit/skills/sql-style/references/sql-style.md:320
- provenance: f8c0649 2026-06-10.
- verdict: retire
- reason: The §19 template shows a sub-section comment above the statement it introduces at line 575; the §10 specimen duplicates it.

### C087
- key: Wrap the main logic of every non-trivial procedure in a `BEGIN TRY` / `BEGIN CATCH` block.
- class: rule
- source: plugins/claude-kit/skills/sql-style/references/sql-style.md:327
- provenance: f8c0649 2026-06-10.
- verdict: keep
- reason: The reference states the wrapping with its non-trivial bound; the checklist restates.

### C088
- key: Have the CATCH call `usp_AuditError` to log the failure and not re-throw, so the caller does not fail.
- class: rule
- source: plugins/claude-kit/skills/sql-style/references/sql-style.md:327
- provenance: f8c0649 2026-06-10.
- verdict: keep
- reason: A signature trait the SKILL description names; the reference states the call, the non-rethrow and its reason. The nested-CATCH exception lives at C094, not here.

### C089
- key: Follow the shown TRY/CATCH block: a banner, `;BEGIN TRY` with commented sub-blocks doing the upsert, `END TRY`, `BEGIN CATCH` with a guarded `usp_AuditError` call, `END CATCH`.
- class: rationale-example
- source: plugins/claude-kit/skills/sql-style/references/sql-style.md:329
- provenance: f8c0649 2026-06-10.
- verdict: keep
- reason: The only specimen of the upsert shape: `END ELSE BEGIN` on one line, the SCOPE_IDENTITY retrieval, and the guarded CATCH in context; the §19 template shows a bare SELECT inside TRY.

### C090
- key: Put `;BEGIN TRY`, `END TRY`, `BEGIN CATCH` and `END CATCH` each on their own line.
- class: mechanic
- source: plugins/claude-kit/skills/sql-style/references/sql-style.md:360
- provenance: f8c0649 2026-06-10.
- verdict: keep
- reason: No finding.

### C091
- key: Guard the error-logger call with `IF (OBJECT_ID('<schema>.usp_AuditError') IS NOT NULL)`.
- class: rule
- source: plugins/claude-kit/skills/sql-style/references/sql-style.md:361
- provenance: f8c0649 2026-06-10.
- verdict: keep
- reason: The reference gives the exact predicate; the SKILL says "guarded by OBJECT_ID check".

### C092
- key: Guard the logger call because it protects against deployments where the error logger is not yet present.
- class: rationale-example
- source: plugins/claude-kit/skills/sql-style/references/sql-style.md:361
- provenance: f8c0649 2026-06-10.
- verdict: retire
- reason: The why: procedures deploy in folder order and a partial or first deployment can run a procedure before usp_AuditError exists, and an unguarded EXECUTE of a missing procedure inside CATCH raises a second error that escapes to the caller. C091 is obeyed without it.

### C093
- key: Write `END ELSE BEGIN` on a single line with one space on each side of `ELSE`.
- class: mechanic
- source: plugins/claude-kit/skills/sql-style/references/sql-style.md:362
- provenance: f8c0649 2026-06-10.
- verdict: keep
- reason: No finding.

### C094
- key: Use `THROW` only inside a nested CATCH where the error genuinely needs to propagate.
- class: rule
- source: plugins/claude-kit/skills/sql-style/references/sql-style.md:363
- provenance: f8c0649 2026-06-10.
- verdict: keep
- reason: The only prose statement of the THROW exception; the SKILL checklist cites §11 for it (SKILL.md:104), so retiring it would break that pointer.

### C095
- key: Apply the leading-comma and tab-alignment layout to parameter lists, variable declarations, SELECT, INSERT and temp-table column lists, INSERT VALUES rows, UPDATE SET clauses, ORDER BY, GROUP BY and PARTITION BY clauses, and any list that wraps across lines.
- class: rule
- source: plugins/claude-kit/skills/sql-style/references/sql-style.md:367
- provenance: f8c0649 2026-06-10.
- verdict: keep
- reason: §12 is the layout owner; this states where it applies and C096 states the shape.

### C096
- key: Give the first list item a leading space and each subsequent item a leading comma sitting in a column aligned with the previous comma.
- class: mechanic
- source: plugins/claude-kit/skills/sql-style/references/sql-style.md:378
- provenance: f8c0649 2026-06-10.
- verdict: keep
- reason: The owner's statement of the shape; the per-construct instances in §4, §5, §7 and §9 were ruled individually (C056 retires, C029, C041 and C072 keep).

### C097
- key: Write a wrapped SELECT list like `;SELECT [MessageId] = M.[MessageId]` with following columns on leading-comma lines aligned by tabs.
- class: rationale-example
- source: plugins/claude-kit/skills/sql-style/references/sql-style.md:380
- provenance: f8c0649 2026-06-10.
- verdict: keep
- reason: The owner section's specimen of the comma column across continuation rows; no template shows a multi-column SELECT with continuation lines, and prose cannot carry where the columns fall.

### C098
- key: Do the alignment with tab characters rather than spaces, treating one tab as four columns of width.
- class: mechanic
- source: plugins/claude-kit/skills/sql-style/references/sql-style.md:386
- provenance: f8c0649 2026-06-10.
- verdict: keep
- reason: The only surface fixing the tab width.

### C099
- key: Always wrap column names in square brackets, even where they are not required.
- class: rule
- source: plugins/claude-kit/skills/sql-style/references/sql-style.md:388
- provenance: f8c0649 2026-06-10.
- verdict: keep
- reason: The reference states the even-when-unnecessary bound; the SKILL antipattern summarizes.

### C100
- key: Always alias output columns in the left-hand `[Alias] = expression` form.
- class: rule
- source: plugins/claude-kit/skills/sql-style/references/sql-style.md:393
- provenance: f8c0649 2026-06-10.
- verdict: keep
- reason: The positive statement of the alias form; the SKILL antipattern bars the other.

### C101
- key: Write output aliases like `SELECT [DriverId] = D.[Id]` followed by `,[FullName] = CONCAT(D.[First], ' ', D.[Last])`.
- class: rationale-example
- source: plugins/claude-kit/skills/sql-style/references/sql-style.md:394
- provenance: f8c0649 2026-06-10.
- verdict: retire
- reason: The §12 specimen fourteen lines earlier (C097) shows the identical shape with continuation rows; this two-line block adds nothing.

### C102
- key: Alias tables in FROM and JOIN clauses with a short identifier and no `AS` keyword.
- class: mechanic
- source: plugins/claude-kit/skills/sql-style/references/sql-style.md:398
- provenance: f8c0649 2026-06-10.
- verdict: keep
- reason: No finding.

### C103
- key: Write a FROM/JOIN like `FROM <schema>.DocumentHistory H` with the `LEFT JOIN` indented under it and its `ON` clause indented further.
- class: rationale-example
- source: plugins/claude-kit/skills/sql-style/references/sql-style.md:399
- provenance: f8c0649 2026-06-10.
- verdict: keep
- reason: The JOIN-under-FROM and ON-under-JOIN indentation appears in no prose sentence; the specimen is the layout's only statement.

### C104
- key: Use single-letter table aliases, switching to multi-letter mnemonics only where letters collide.
- class: mechanic
- source: plugins/claude-kit/skills/sql-style/references/sql-style.md:404
- provenance: f8c0649 2026-06-10.
- verdict: keep
- reason: No finding.

### C105
- key: Never use `SELECT *` in production SELECTs that return result sets to callers.
- class: rule
- source: plugins/claude-kit/skills/sql-style/references/sql-style.md:406
- provenance: f8c0649 2026-06-10.
- verdict: keep
- reason: Carries the SELECT * INTO carve-out the SKILL antipattern omits.

### C106
- key: Write an INSERT as `;INSERT INTO <table> (` with a leading-comma column list, then a SELECT using the `[Alias] = value` form with COALESCE defaults.
- class: rationale-example
- source: plugins/claude-kit/skills/sql-style/references/sql-style.md:411
- provenance: f8c0649 2026-06-10.
- verdict: keep
- reason: No template shows an INSERT; the right-aligned closing paren and the SELECT-fed form are visible only here.

### C107
- key: Align the closing `)` of an INSERT column list to the right, after a tab.
- class: mechanic
- source: plugins/claude-kit/skills/sql-style/references/sql-style.md:426
- provenance: f8c0649 2026-06-10.
- verdict: keep
- reason: No finding.

### C108
- key: Write the SELECT feeding an INSERT in the same `[Alias] = value` form as a regular SELECT.
- class: mechanic
- source: plugins/claude-kit/skills/sql-style/references/sql-style.md:427
- provenance: f8c0649 2026-06-10.
- verdict: keep
- reason: No finding.

### C109
- key: Write an UPDATE as `;UPDATE C` then a standalone `SET` with leading-comma assignments, then `FROM` and `WHERE` aligned with `SET`.
- class: rationale-example
- source: plugins/claude-kit/skills/sql-style/references/sql-style.md:432
- provenance: f8c0649 2026-06-10.
- verdict: keep
- reason: No template shows a full UPDATE; the FROM/WHERE column alignment with SET is a position only the specimen carries.

### C110
- key: Lead the `UPDATE` statement with a semicolon.
- class: mechanic
- source: plugins/claude-kit/skills/sql-style/references/sql-style.md:440
- provenance: f8c0649 2026-06-10.
- verdict: keep
- reason: As C028.

### C111
- key: Put the `SET` keyword on its own and give the first assignment a leading space.
- class: mechanic
- source: plugins/claude-kit/skills/sql-style/references/sql-style.md:441
- provenance: f8c0649 2026-06-10.
- verdict: keep
- reason: No finding.

### C112
- key: Align `FROM` and `WHERE` with `SET`.
- class: mechanic
- source: plugins/claude-kit/skills/sql-style/references/sql-style.md:442
- provenance: f8c0649 2026-06-10.
- verdict: keep
- reason: No finding.

### C113
- key: Write an upsert as `IF (@p_Id > 0) BEGIN /* update */ END ELSE BEGIN /* insert; SCOPE_IDENTITY() */ END`.
- class: mechanic
- source: plugins/claude-kit/skills/sql-style/references/sql-style.md:444
- provenance: f8c0649 2026-06-10.
- verdict: keep
- reason: No finding.

### C114
- key: Write `LEFT JOIN` rather than `LEFT OUTER JOIN`, and `INNER JOIN` rather than bare `JOIN`.
- class: mechanic
- source: plugins/claude-kit/skills/sql-style/references/sql-style.md:449
- provenance: f8c0649 2026-06-10.
- verdict: keep
- reason: No finding.

### C115
- key: Wrap multi-condition `ON` clauses in parentheses and align the `AND`s.
- class: mechanic
- source: plugins/claude-kit/skills/sql-style/references/sql-style.md:450
- provenance: f8c0649 2026-06-10.
- verdict: keep
- reason: No finding.

### C116
- key: Write a multi-condition ON like `ON ( H.[Id] = TRY_PARSE(...) AND H.[EmployeeStatusCode] = 'A' ) OR H.[DriverId] = @p_UserName` with the operators aligned.
- class: rationale-example
- source: plugins/claude-kit/skills/sql-style/references/sql-style.md:451
- provenance: f8c0649 2026-06-10.
- verdict: keep
- reason: The only specimen of the parenthesized, operator-aligned ON clause C115 describes.

### C117
- key: Use `OUTER APPLY` freely for correlated subqueries.
- class: rule
- source: plugins/claude-kit/skills/sql-style/references/sql-style.md:457
- provenance: f8c0649 2026-06-10.
- verdict: keep
- reason: No finding.

### C118
- key: Name CTEs `cte<Name>`.
- class: mechanic
- source: plugins/claude-kit/skills/sql-style/references/sql-style.md:460
- provenance: f8c0649 2026-06-10.
- verdict: retire
- reason: The §18 row at line 515 carries the same pattern and example; §18 owns naming.

### C119
- key: Lead the `WITH` with a semicolon prefix.
- class: mechanic
- source: plugins/claude-kit/skills/sql-style/references/sql-style.md:461
- provenance: f8c0649 2026-06-10.
- verdict: keep
- reason: As C028.

### C120
- key: Write each CTE body inside `( ... )` following the standard SELECT layout.
- class: mechanic
- source: plugins/claude-kit/skills/sql-style/references/sql-style.md:462
- provenance: f8c0649 2026-06-10.
- verdict: keep
- reason: No finding.

### C121
- key: Separate chained CTEs with a comma followed by a new `cte<Name> AS ( ... )`.
- class: mechanic
- source: plugins/claude-kit/skills/sql-style/references/sql-style.md:463
- provenance: f8c0649 2026-06-10.
- verdict: keep
- reason: No finding.

### C122
- key: Use recursive CTEs freely where geographic or hierarchical traversal is needed.
- class: rule
- source: plugins/claude-kit/skills/sql-style/references/sql-style.md:464
- provenance: f8c0649 2026-06-10.
- verdict: keep
- reason: No finding.

### C123
- key: Prefer `CONCAT` over `+` for string concatenation because it is null-safe.
- class: rule
- source: plugins/claude-kit/skills/sql-style/references/sql-style.md:468
- provenance: f8c0649 2026-06-10.
- verdict: keep
- reason: No finding.

### C124
- key: Prefer `COALESCE` over `ISNULL` for value defaulting.
- class: rule
- source: plugins/claude-kit/skills/sql-style/references/sql-style.md:469
- provenance: f8c0649 2026-06-10.
- verdict: keep
- reason: No finding.

### C125
- key: Use `IS NULL` for existence checks in WHERE clauses.
- class: rule
- source: plugins/claude-kit/skills/sql-style/references/sql-style.md:470
- provenance: f8c0649 2026-06-10.
- verdict: keep
- reason: No finding.

### C126
- key: Use `TRY_PARSE` or `TRY_CONVERT` for safe casts, which return NULL on failure.
- class: rule
- source: plugins/claude-kit/skills/sql-style/references/sql-style.md:471
- provenance: f8c0649 2026-06-10.
- verdict: keep
- reason: No finding.

### C127
- key: Use `FORMAT` for user-facing strings.
- class: rule
- source: plugins/claude-kit/skills/sql-style/references/sql-style.md:472
- provenance: f8c0649 2026-06-10.
- verdict: keep
- reason: No finding.

### C128
- key: Use `CONVERT` for internal conversions because it is more performant than FORMAT.
- class: rule
- source: plugins/claude-kit/skills/sql-style/references/sql-style.md:473
- provenance: f8c0649 2026-06-10.
- verdict: keep
- reason: No finding.

### C129
- key: Use `SYSDATETIMEOFFSET()` for audit timestamps in preference to `GETDATE()`.
- class: rule
- source: plugins/claude-kit/skills/sql-style/references/sql-style.md:474
- provenance: f8c0649 2026-06-10.
- verdict: keep
- reason: Stated beside the GETDATE() carve-out (C130); the SKILL antipattern summarizes.

### C130
- key: Use `GETDATE()` only for transient or comparison logic where timezone does not matter.
- class: rule
- source: plugins/claude-kit/skills/sql-style/references/sql-style.md:475
- provenance: f8c0649 2026-06-10.
- verdict: keep
- reason: No finding.

### C131
- key: Name temp tables `#PascalCase`.
- class: mechanic
- source: plugins/claude-kit/skills/sql-style/references/sql-style.md:479
- provenance: f8c0649 2026-06-10; a8770b3 2026-06-28 genericized one example name.
- verdict: retire
- reason: The §18 row at line 514 carries the same pattern with overlapping examples; §18 owns naming.

### C132
- key: Always check `IF (OBJECT_ID('tempdb..#Name') IS NULL)` before creating a temp table.
- class: rule
- source: plugins/claude-kit/skills/sql-style/references/sql-style.md:480
- provenance: f8c0649 2026-06-10.
- verdict: keep
- reason: Composes with C135: the guard wraps whatever creates the table, SELECT INTO included (A140).

### C133
- key: Comment the purpose of a temp table with a sentence-style block comment above it.
- class: mechanic
- source: plugins/claude-kit/skills/sql-style/references/sql-style.md:481
- provenance: f8c0649 2026-06-10.
- verdict: keep
- reason: No finding.

### C134
- key: Declare temp tables shared with nested EXEC calls in the outer procedure and rely on temp-table scoping.
- class: rule
- source: plugins/claude-kit/skills/sql-style/references/sql-style.md:482
- provenance: f8c0649 2026-06-10.
- verdict: keep
- reason: No finding.

### C135
- key: Use `SELECT INTO #Name FROM ...` where you want to inherit the schema from a function or query.
- class: rule
- source: plugins/claude-kit/skills/sql-style/references/sql-style.md:483
- provenance: f8c0649 2026-06-10.
- verdict: keep
- reason: Sanctions a creation form; C132's guard still wraps it (A140).

### C136
- key: Use the `/********** TITLE **********/` banner style for major section dividers inside a procedure.
- class: mechanic
- source: plugins/claude-kit/skills/sql-style/references/sql-style.md:489
- provenance: f8c0649 2026-06-10.
- verdict: keep
- reason: The table's shorthand label for the banner style whose exact shape §10 shows; not a competing single-line form (A142).

### C137
- key: Use `/* Sub-section Title. */` single-line block comments for smaller groupings and end them with a period.
- class: mechanic
- source: plugins/claude-kit/skills/sql-style/references/sql-style.md:490
- provenance: f8c0649 2026-06-10; 058e3a3 2026-07-24 made §17 the comment-voice owner.
- verdict: keep
- reason: §17 owns the comment forms; the checklist restates the period as a check.

### C138
- key: Use `/* Group Name */` with no period for group dividers inside a CREATE TABLE column list.
- class: mechanic
- source: plugins/claude-kit/skills/sql-style/references/sql-style.md:491
- provenance: f8c0649 2026-06-10.
- verdict: keep
- reason: §17 owns the comment forms.

### C139
- key: Use `-- Comment.` ending in a period for inline comments and labels above blocks.
- class: mechanic
- source: plugins/claude-kit/skills/sql-style/references/sql-style.md:492
- provenance: f8c0649 2026-06-10.
- verdict: keep
- reason: No finding.

### C140
- key: Use `-- TITLE.` for top-of-file pre-banner comments.
- class: mechanic
- source: plugins/claude-kit/skills/sql-style/references/sql-style.md:493
- provenance: f8c0649 2026-06-10.
- verdict: keep
- reason: No finding.

### C141
- key: End comments that are sentences with a period and leave comments that are labels or titles without one.
- class: rule
- source: plugins/claude-kit/skills/sql-style/references/sql-style.md:495
- provenance: f8c0649 2026-06-10.
- verdict: keep
- reason: The governing convention the checklist forms instantiate; after C081's rewrite it also governs banner titles.

### C142
- key: Keep sentence-style comments short imperative statements of what the next block does, as a reading aid for someone scanning the procedure.
- class: rule
- source: plugins/claude-kit/skills/sql-style/references/sql-style.md:497
- provenance: 058e3a3 2026-07-24, the operator's hand-edit review of Claude-authored code (2026-07-21) found narrative comments; the voice rule was installed in the C# reference, the SQL reference and the SQL SKILL in one commit.
- verdict: keep
- reason: Incident-born and unenforced by any hook; each surface governs its own comment syntax, so the parallel C# and SKILL lines are installs, not duplicates.

### C143
- key: Never put history, decision narrative, rationale essays or issues encountered into comments, and keep WHY comments rare and exceptional.
- class: rule
- source: plugins/claude-kit/skills/sql-style/references/sql-style.md:497
- provenance: 058e3a3 2026-07-24, same incident as C142.
- verdict: keep
- reason: The four-item list is the incident's content (what the review found comments carrying); compressing it drops "issues encountered", which the operator named.

### C144
- key: Use a single schema, referenced as `<schema>`, for all objects.
- class: mechanic
- source: plugins/claude-kit/skills/sql-style/references/sql-style.md:503
- provenance: f8c0649 2026-06-10; a8770b3 2026-06-28 replaced the schema name with a placeholder.
- verdict: keep
- reason: No finding.

### C145
- key: Name tables in PascalCase with no prefix.
- class: mechanic
- source: plugins/claude-kit/skills/sql-style/references/sql-style.md:504
- provenance: f8c0649 2026-06-10.
- verdict: keep
- reason: No finding.

### C146
- key: Name procedures `usp_<PascalCase>`.
- class: mechanic
- source: plugins/claude-kit/skills/sql-style/references/sql-style.md:505
- provenance: f8c0649 2026-06-10.
- verdict: keep
- reason: No finding.

### C147
- key: Name functions `udf_<PascalCase>`.
- class: mechanic
- source: plugins/claude-kit/skills/sql-style/references/sql-style.md:506
- provenance: f8c0649 2026-06-10.
- verdict: keep
- reason: No finding.

### C148
- key: Name triggers and jobs `JOB.<schema>.<Name>`.
- class: mechanic
- source: plugins/claude-kit/skills/sql-style/references/sql-style.md:507
- provenance: f8c0649 2026-06-10; a8770b3 2026-06-28 replaced the schema name with a placeholder.
- verdict: keep
- reason: No finding.

### C149
- key: Name parameters `@p_<PascalCase>`.
- class: mechanic
- source: plugins/claude-kit/skills/sql-style/references/sql-style.md:508
- provenance: f8c0649 2026-06-10.
- verdict: keep
- reason: §18 is the naming owner; the §7 copy (C055) retires in its favor.

### C150
- key: Name local variables `@<PascalCase>`.
- class: mechanic
- source: plugins/claude-kit/skills/sql-style/references/sql-style.md:509
- provenance: f8c0649 2026-06-10.
- verdict: keep
- reason: §18 is the naming owner; C075 keeps beside it for the rejected prefixes.

### C151
- key: Name boolean locals `@True` and `@False`, typed BIT with values 1 and 0, declared at the top of procedures that use them.
- class: mechanic
- source: plugins/claude-kit/skills/sql-style/references/sql-style.md:510
- provenance: f8c0649 2026-06-10.
- verdict: keep
- reason: §18 is the naming owner; C074 keeps beside it for the declare-and-use instruction.

### C152
- key: Name primary keys `PK_<TableName>`.
- class: mechanic
- source: plugins/claude-kit/skills/sql-style/references/sql-style.md:511
- provenance: f8c0649 2026-06-10.
- verdict: keep
- reason: §18 is the naming owner; C036 keeps beside it for position and layout.

### C153
- key: Name indexes `IX_<TableName>_<ColList>`.
- class: mechanic
- source: plugins/claude-kit/skills/sql-style/references/sql-style.md:512
- provenance: f8c0649 2026-06-10.
- verdict: keep
- reason: §18 is the naming owner; the §5 copy (C039) retires in its favor.

### C154
- key: Name types `<schema>.<PascalCase>`.
- class: mechanic
- source: plugins/claude-kit/skills/sql-style/references/sql-style.md:513
- provenance: f8c0649 2026-06-10; a8770b3 2026-06-28 replaced the schema name with a placeholder.
- verdict: keep
- reason: No finding.

### C155
- key: Name temp tables `#<PascalCase>`.
- class: mechanic
- source: plugins/claude-kit/skills/sql-style/references/sql-style.md:514
- provenance: f8c0649 2026-06-10.
- verdict: keep
- reason: §18 is the naming owner; the §16 copy (C131) retires in its favor.

### C156
- key: Name CTEs `cte<PascalCase>`.
- class: mechanic
- source: plugins/claude-kit/skills/sql-style/references/sql-style.md:515
- provenance: f8c0649 2026-06-10.
- verdict: keep
- reason: §18 is the naming owner; the §14 copy (C118) retires in its favor.

### C157
- key: Use the `_Default` suffix for the default variant of a procedure.
- class: mechanic
- source: plugins/claude-kit/skills/sql-style/references/sql-style.md:518
- provenance: f8c0649 2026-06-10 (830ff28 only replaced an em dash).
- verdict: keep
- reason: §18 owns the suffix conventions with their meanings; the §1 list (C007) retires in its favor.

### C158
- key: Use the `_Maintenance` and `_Trailers` suffixes for domain-specific variants.
- class: mechanic
- source: plugins/claude-kit/skills/sql-style/references/sql-style.md:519
- provenance: f8c0649 2026-06-10.
- verdict: keep
- reason: As C157.

### C159
- key: Use the `_TMS` suffix for a TMS-specific entry point and put it in `9-System/`.
- class: mechanic
- source: plugins/claude-kit/skills/sql-style/references/sql-style.md:520
- provenance: f8c0649 2026-06-10.
- verdict: keep
- reason: As C157; also the only line carrying the folder for the TMS variant.

### C160
- key: Use the `_Debug` suffix for the debugging counterpart of a procedure.
- class: mechanic
- source: plugins/claude-kit/skills/sql-style/references/sql-style.md:521
- provenance: f8c0649 2026-06-10.
- verdict: keep
- reason: As C157.

### C161
- key: Use the `_Custom_<Vendor>` suffix for client or vendor-specific custom processing.
- class: mechanic
- source: plugins/claude-kit/skills/sql-style/references/sql-style.md:522
- provenance: f8c0649 2026-06-10.
- verdict: keep
- reason: As C157.

### C162
- key: Build a new procedure in `5-Procedures/` from the full procedure skeleton given here.
- class: rule
- source: plugins/claude-kit/skills/sql-style/references/sql-style.md:526
- provenance: f8c0649 2026-06-10.
- verdict: keep
- reason: No finding.

### C163
- key: Follow the full procedure skeleton: shell EXEC, ALTER with parameter block, `WITH EXECUTE AS`, `BEGIN -- PROCEDURE`, header banner, SET banner, DECLARE banner, MAIN LOGIC TRY/CATCH, `END`, `GO`.
- class: rationale-example
- source: plugins/claude-kit/skills/sql-style/references/sql-style.md:528
- provenance: f8c0649 2026-06-10.
- verdict: keep
- reason: The rule's object, and after this pass the owner of the procedure shapes that §2, §7, §8, §9 and §10 now point at (C011, C054, C064, C071, C086).

### C164
- key: Build a new table in `3-Tables/` from the full table skeleton given here.
- class: rule
- source: plugins/claude-kit/skills/sql-style/references/sql-style.md:592
- provenance: f8c0649 2026-06-10.
- verdict: keep
- reason: No finding.

### C165
- key: Follow the full table skeleton: TABLE banner, `;IF NOT EXISTS` schema/table check, `CREATE TABLE` with grouped columns, Audit Fields and the PK, `GO`, then an index existence block.
- class: rationale-example
- source: plugins/claude-kit/skills/sql-style/references/sql-style.md:594
- provenance: f8c0649 2026-06-10.
- verdict: keep
- reason: The rule's object, and after this pass the owner of the table and index shapes §4 and §5 point at (C024, C038).

### C166
- key: Build a new inline table-valued function in `4-Functions/` from the full function skeleton given here.
- class: rule
- source: plugins/claude-kit/skills/sql-style/references/sql-style.md:642
- provenance: f8c0649 2026-06-10.
- verdict: keep
- reason: No finding.

### C167
- key: Follow the full function skeleton: drop check and `GO`, `;CREATE FUNCTION` with parameters, `RETURNS TABLE`, `AS RETURN (`, header banner, SELECT body, `)`, `GO`.
- class: rationale-example
- source: plugins/claude-kit/skills/sql-style/references/sql-style.md:644
- provenance: f8c0649 2026-06-10; ce7b530 2026-06-28 removed the invalid EXECUTE AS line from this template.
- verdict: keep
- reason: The rule's object, and after this pass the owner of the function shape §3 points at (C019). Do not re-add WITH EXECUTE AS here: it does not deploy on an inline TVF.

### C168
- key: For a scalar function replace `RETURNS TABLE ... RETURN ( SELECT ... )` with `RETURNS <type>`, `WITH EXECUTE AS`, `AS`, `BEGIN`, a declared result variable, and `RETURN @Result`.
- class: mechanic
- source: plugins/claude-kit/skills/sql-style/references/sql-style.md:676
- provenance: f8c0649 2026-06-10.
- verdict: keep
- reason: No finding.

### C169
- key: Write a scalar function body as `RETURNS VARCHAR(MAX)`, `WITH EXECUTE AS '<schema_owner>'`, `AS BEGIN`, `DECLARE @Result VARCHAR(MAX) = ''`, then `RETURN @Result` and `END`.
- class: rationale-example
- source: plugins/claude-kit/skills/sql-style/references/sql-style.md:678
- provenance: f8c0649 2026-06-10; ce7b530 2026-06-28 deliberately kept the EXECUTE AS clause here (valid on scalar functions).
- verdict: keep
- reason: C168's sentence is "replace X with:" and has no content without this block; the clause is shown unconditionally as on every procedure skeleton, with C013 governing when to drop it.

### C170
- key: When in doubt about a layout decision, find a sibling file in the same folder that solves a similar shape of problem and copy its layout exactly.
- class: rule
- source: plugins/claude-kit/skills/sql-style/references/sql-style.md:689
- provenance: f8c0649 2026-06-10; the bound it lacks was installed by 830ff28 2026-06-17 in the SKILL's Precedence section and in line 3.
- verdict: retire
- reason: The third statement of the mimic rule and the only one without the foreign-repo bound; SKILL.md:16 with :20 owns it whole and line 3 restates it bounded. Safe because a session reaching this line has already loaded both.

### C171
- key: Where the project impersonates the schema owner, apply WITH EXECUTE AS to every procedure and to scalar or multi-statement functions, not only procedures.
- class: mechanic
- source: plugins/claude-kit/skills/sql-style/references/sql-style.md:78
- provenance: ce7b530 2026-06-28, the same defect fix as C013 and C014.
- verdict: keep
- reason: States which object kinds the clause reaches, which C013 does not; the SKILL checklist carries the same reach as a check. C013's rewrite trims only the dangling parenthetical beside it.

### C172
- key: Order the numbered deployment folders so each runs only after the dependencies it needs already exist.
- class: rationale-example
- source: plugins/claude-kit/skills/sql-style/references/sql-style.md:35
- provenance: f8c0649 2026-06-10.
- verdict: retire
- reason: The why: deployment runs the folders in numeric order, so tables (3) must exist before functions (4) reference them, functions before procedures (5), and the system entry points (9) last against the full schema, with 0-Client first for environment values. C003's placement is obeyed from the Folder and Contents columns alone.
