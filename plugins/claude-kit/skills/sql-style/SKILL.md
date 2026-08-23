---
name: sql-style
description: "My T-SQL house style. Use whenever writing or modifying ANY SQL: stored procedures, tables, functions, indexes, install or deployment scripts, or ad-hoc queries. Signature traits: shell-then-ALTER deployment, banner-comment headers, leading commas, tab-aligned columns, leading semicolons, audit-logging CATCH blocks that do not re-throw. Trigger on any SQL work even when style is not named."
---

# T-SQL Style

My personal SQL style. Internalize the philosophy, then consult [references/sql-style.md](references/sql-style.md) for the detailed pattern reference (all 21 sections: deployment idioms, banner formats, full procedure/table/function templates) before writing code.

## Core philosophy

1. **Idempotent and re-runnable by default.** Procedures use shell-then-ALTER (preserves GRANTs). Functions drop-and-recreate. Tables and indexes guard with IF NOT EXISTS. A deployment script never breaks on re-execution.
2. **Tab-aligned columns for related values.** Parameter lists, DECLARE blocks, column lists, SET clauses: names align, then types align, then defaults align. Non-negotiable.
3. **Leading commas, leading semicolons.** Commas start the continuation line so items line up. Statements lead with `;` to defend against missing terminators in the previous batch.
4. **Section banners over inline narration.** `/********** TITLE **********/` banners divide every procedure into named phases.
5. **Find a sibling and mimic it.** When in doubt, find an existing procedure/table solving a similar shape and copy its layout exactly. In greenfield repos, use the exemplar below and the full templates in the reference.

## Precedence

A repo's mechanically-enforced contract wins first: a committed formatter config, an `.editorconfig`, or a CI lint gate overrides this style, nothing softer does. Absent that, this style is the default authority. Philosophy point 5 (mimic a sibling) is for staying consistent inside a body of code already written in this style; a messy legacy sibling in a foreign repo is not a reason to drop the style.

## Exemplar (the deployment idiom and body skeleton)

The schema and the audit-logging proc below are placeholders (`<schema>`, `<schema_owner>`, `usp_LogError`). The pattern is what transfers: substitute the project's own schema and error-logging proc. `WITH EXECUTE AS` applies only where the project uses owner-impersonation; drop it where it does not.

```sql
-- CREATE A SHELL PROCEDURE IF NONE EXISTS.
;IF OBJECT_ID('<schema>.usp_DoSomething') IS NULL
  EXEC ('CREATE PROCEDURE <schema>.usp_DoSomething AS RETURN 0;')
GO

-- ALTER THE UPDATED PROCEDURE DEFINITION.
;ALTER PROCEDURE <schema>.usp_DoSomething
(
    /*********************************************************************************************
     PARAMETER NAME		DATATYPE		    DEFAULT
    *********************************************************************************************/
     @p_OrderNumber     INT                 = NULL
    ,@p_DriverCode      VARCHAR(50)         = NULL
)
WITH EXECUTE AS '<schema_owner>'
AS
BEGIN	-- PROCEDURE
    /* Banner header: SCRIPT / AUTHOR / DATE / VERSION / NOTES - see reference §6. */

    /********************************************************************************************
        SET PROCESSING VARIABLES TO INCREASE SPEED AND DATA ACCESS.
    ********************************************************************************************/
    ;SET NOCOUNT ON
    ;SET TRANSACTION ISOLATION LEVEL READ UNCOMMITTED

    ;BEGIN TRY
        /* Describe what this block does. */
        ;SELECT  [SomeColumn] = T.[SomeColumn]
        FROM    <schema>.SomeTable T
        WHERE   T.[OrderNumber] = @p_OrderNumber
    END TRY
    BEGIN CATCH
        /* Audit and Report Error. */
        ;IF ( OBJECT_ID('<schema>.usp_LogError') IS NOT NULL )
            EXECUTE <schema>.usp_LogError @p_ErrorData = @p_OrderNumber
    END CATCH
END
GO
```

## Outlining a large file

When you are opening a SQL file past roughly 1,000 lines to find one thing, take the definitions first, with line numbers:

`^\s*;?\s*(CREATE|ALTER)(\s+OR\s+ALTER)?(\s+(UNIQUE|CLUSTERED|NONCLUSTERED|SPATIAL|COLUMNSTORE|FULLTEXT|XML))*\s+(PROCEDURE|TABLE|VIEW|FUNCTION|INDEX|TRIGGER|SCHEMA|TYPE)\b`

Every piece of that shape is there because a simpler one fails on this style. The leading `;?` is the first: a pattern anchored on `CREATE` or `ALTER` at the start of a line cannot match `;ALTER PROCEDURE`, and the leading semicolon is this style's own defense against a missing terminator in the previous batch, so on a deployment tree written this way the simpler pattern misses the one line that defines the object. The optional modifier group is the second, and it is the one that fails invisibly: T-SQL writes `CREATE NONCLUSTERED INDEX`, so a pattern demanding the object keyword immediately after the verb drops nearly every index in the tree while still naming `INDEX` in its keyword list, so it reads as though indexes were covered. Across one real deployment corpus that group alone is worth 843 definitions out of the 5,332 the shipped pattern finds. Requiring an object keyword at all is what keeps most banner prose out, `CREATE TRANSACTION FOR PROCESSING.` among the lines it excludes; a banner sentence opening with a real object keyword still matches and is read past rather than filtered.

Take banners second, and read past the hits outside the range the definitions narrowed to rather than trying to scope the grep, since the range-restricting forms renumber their output and the line numbers are the whole point: `grep -n -A 1 -E '^\s*/\*{3,}'`, the `-A 1` being what supplies the label, since the border line carries no text of its own. Over a whole file it returns 6,710 output lines on a 70,966-line vendor install script where the definitions grep alone returns 820, which is the price of true line numbers and the reason it is second and never first: taken after the definitions, you read only the banner hits sitting near the ranges you already hold and let the rest scroll past. A doubled border yields its second line as a label. The pattern anchors on the block-comment border alone because a dash rule is comment decoration in this style rather than section structure. Do not anchor on `GO` at all: it carries no structure, and that one install script holds 936 of them. Two limits worth knowing rather than discovering. The pattern is case-sensitive where T-SQL is not, which costs 9 definitions out of 5,332 on that corpus and matters only in a file this style did not write, so add `-i` when you are reading a vendor script. And the object-keyword list covers the kinds a deployment tree is mostly made of; `LOGIN`, `ROLE`, `SEQUENCE`, and `SYNONYM` are deliberately outside it and are found by name when you need one.

## Antipatterns (common AI habits that violate the style)

- ❌ `CREATE OR ALTER PROCEDURE` - shell-then-ALTER, always (it preserves GRANTs)
- ❌ Trailing commas in any list - leading commas, always
- ❌ Lowercase keywords - UPPERCASE always
- ❌ Unbracketed columns - `[ColumnName]` always
- ❌ `RAISERROR` for routine errors - `EXECUTE <schema>.usp_LogError @p_ErrorData = ...` in CATCH, guarded by OBJECT_ID check
- ❌ Dynamic SQL built by string concatenation - inside a `WITH EXECUTE AS` procedure this is a privilege-escalation vector, not a style issue; where dynamic SQL is truly unavoidable, `sp_executesql` with typed parameters and a justifying comment
- ❌ Skipping `;SET NOCOUNT ON` + `;SET TRANSACTION ISOLATION LEVEL` - both required, paired, at the top
- ❌ Verbose multi-paragraph header comments - banner blocks with SCRIPT/AUTHOR/DATE/VERSION/NOTES only
- ❌ Change-narrative comments ("Updated to...", "fixed the...", "per the new spec") - the doctrine's current-state rule applies: a comment or banner states what the code does now, never the session, the change, or the prior version. Sentence-style comments (`/* Sub-Section Title. */`, `-- Comment.`) are short imperative statements of what the next block does, never history, decision narrative, or rationale essays; a WHY comment is rare and exceptional. Banners and group labels are titles and are unaffected
- ❌ `GETDATE()` for audit timestamps - `SYSDATETIMEOFFSET()`
- ❌ Right-hand aliases (`expr AS Alias`) in SELECT - left-hand form: `[Alias] = expression`
- ❌ `SELECT *` in result sets returned to callers

## Checklist before declaring SQL work complete

- [ ] Procs: shell-then-ALTER; functions: drop-and-recreate; tables/indexes: IF NOT EXISTS guards
- [ ] `WITH EXECUTE AS '<schema_owner>'` on procs and scalar/multi-statement functions where the codebase uses impersonation (never on inline TVFs; dropped entirely where the codebase does not impersonate)
- [ ] Banner header: SCRIPT / AUTHOR / DATE (ordinal English) / VERSION / NOTES; new versions ADD a note line, never rewrite history
- [ ] `BEGIN	-- PROCEDURE` with tab + trailing label after `AS`
- [ ] `;SET NOCOUNT ON` paired with isolation level (`READ UNCOMMITTED` for Get*, `READ COMMITTED` for writes)
- [ ] Statements lead with `;`; parameters use `@p_` prefix; locals plain `@PascalCase`; `@True`/`@False` BIT pair when conditionals exist
- [ ] Leading commas + tab alignment in every multi-line list; first item gets a leading space
- [ ] Section banners divide logic into phases; `/* Sub-Section. */` comments end with a period; group labels do not
- [ ] Tables: `/* Group Name */` column groups, audit fields (CreatedDt/UpdatedDt, SYSDATETIMEOFFSET defaults) at the bottom, `PK_<Table>` last
- [ ] Indexes: `IX_<Table>_<Cols>`, own IF NOT EXISTS block, in the table's file
- [ ] TRY/CATCH wraps main logic; CATCH audits via the project's error-logging proc and does not re-throw (a nested CATCH whose error genuinely must propagate is the rare THROW exception; reference §11)
- [ ] File ends with `GO`
