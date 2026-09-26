---
name: sql-style
description: "My T-SQL house style. Use whenever writing or modifying ANY SQL: stored procedures, tables, functions, indexes, install or deployment scripts, or ad-hoc queries. Signature traits: shell-then-ALTER deployment, banner-comment headers, leading commas, tab-aligned columns, leading semicolons, audit-logging CATCH blocks that do not re-throw. Trigger on any SQL work even when style is not named."
---

# T-SQL Style

Read [references/sql-style.md](references/sql-style.md), the detailed pattern reference, before writing code.

## Core Philosophy

1. **Idempotent deployment.** Procedures use shell-then-ALTER, which preserves GRANTs. Functions drop and recreate. Tables and indexes guard with IF NOT EXISTS. A script never breaks on re-execution.
2. **Tab alignment.** In parameter, DECLARE, column and SET lists, names align, then types, then defaults. Non-negotiable.
3. **Leading commas and semicolons.** A comma starts each continuation line so items line up. Statements lead with `;` to guard against a missing terminator in the previous batch.
4. **Banners over narration.** `/********** TITLE **********/` banners divide every procedure into named phases.
5. **Mimic a sibling.** When unsure, copy the layout of an existing procedure or table of similar shape. In a greenfield repo, use the exemplar below and the reference's templates.

## Precedence

A committed formatter config, `.editorconfig` or CI lint gate overrides this style, and nothing softer does. Otherwise this style is the default authority. Point 5 keeps a body already in this style consistent, so a messy legacy sibling in a foreign repo is no reason to drop it.

## Deployment Exemplar

`<schema>`, `<schema_owner>` and `usp_LogError` are placeholders for the project's own. Keep `WITH EXECUTE AS` only where the project uses owner-impersonation.

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

In a SQL file past roughly 1,000 lines opened to find one thing, grep the definitions first, with line numbers, using this pattern as written:

`^\s*;?\s*(CREATE|ALTER)(\s+OR\s+ALTER)?(\s+(UNIQUE|CLUSTERED|NONCLUSTERED|SPATIAL|COLUMNSTORE|FULLTEXT|XML))*\s+(PROCEDURE|TABLE|VIEW|FUNCTION|INDEX|TRIGGER|SCHEMA|TYPE)\b`

A banner sentence opening with an object keyword still matches and is read past rather than filtered.

Take banners second with `grep -n -A 1 -E '^\s*/\*{3,}'`, where `-A 1` supplies the label the border lacks, and a doubled border's second line is the label. Read past hits outside the definitions' ranges rather than scoping the grep, since range-restricting forms renumber lines. Never anchor on `GO`: it carries no structure, and one vendor install script holds 936. The pattern is case-sensitive, missing 9 of 5,332 definitions on one corpus, so add `-i` for a vendor script. Find `LOGIN`, `ROLE`, `SEQUENCE` and `SYNONYM` by name, as the pattern excludes them by design.

## Antipatterns

- ❌ `CREATE OR ALTER PROCEDURE` - shell-then-ALTER, which preserves GRANTs
- ❌ Trailing commas in any list - leading commas
- ❌ Lowercase keywords - UPPERCASE
- ❌ Unbracketed columns - `[ColumnName]`
- ❌ `RAISERROR` for routine errors - `EXECUTE <schema>.usp_LogError @p_ErrorData = ...` in CATCH, guarded by an OBJECT_ID check
- ❌ Dynamic SQL built by string concatenation - a privilege-escalation vector inside a `WITH EXECUTE AS` procedure. Where unavoidable, use `sp_executesql` with typed parameters and a justifying comment
- ❌ Skipping `;SET NOCOUNT ON` + `;SET TRANSACTION ISOLATION LEVEL` - both required, paired, at the top
- ❌ Verbose multi-paragraph header comments - banner blocks with SCRIPT/AUTHOR/DATE/VERSION/NOTES only
- ❌ Change-narrative comments ("Updated to...", "fixed the...", "per the new spec") - per the doctrine's current-state rule, a comment states what the code does now. Sentence-style comments (`/* Sub-Section Title. */`, `-- Comment.`) state what the next block does, never history or rationale. Under the doctrine's prose register, a section comment is the rule alone, and a rare WHY comment adds its reason as its own sentence, with at most one case. Banners and group labels are titles and are unaffected
- ❌ `GETDATE()` for audit timestamps - `SYSDATETIMEOFFSET()`
- ❌ Right-hand aliases (`expr AS Alias`) in SELECT - left-hand form: `[Alias] = expression`
- ❌ `SELECT *` in result sets returned to callers

## Completion Checklist

- [ ] Procs shell-then-ALTER, functions drop-and-recreate, tables and indexes IF NOT EXISTS
- [ ] `WITH EXECUTE AS '<schema_owner>'` on procs and scalar or multi-statement functions where the codebase impersonates, never on inline TVFs
- [ ] Banner header: SCRIPT / AUTHOR / DATE (ordinal English) / VERSION / NOTES, a new version adding a note line rather than rewriting history
- [ ] `BEGIN	-- PROCEDURE` with tab + trailing label after `AS`
- [ ] `;SET NOCOUNT ON` paired with an isolation level: `READ UNCOMMITTED` for Get*, `READ COMMITTED` for writes
- [ ] `;`-led statements, `@p_` parameters, plain `@PascalCase` locals, an `@True`/`@False` BIT pair where conditionals exist
- [ ] Leading commas + tab alignment in every multi-line list, first item with a leading space
- [ ] Section banners for phases, `/* Sub-Section. */` comments ending in a period, group labels without one
- [ ] Tables: `/* Group Name */` column groups, audit fields (CreatedDt/UpdatedDt, SYSDATETIMEOFFSET defaults) at the bottom, `PK_<Table>` last
- [ ] Indexes: `IX_<Table>_<Cols>`, own IF NOT EXISTS block, in the table's file
- [ ] TRY/CATCH around main logic, CATCH auditing via the project's error-logging proc without re-throwing, bar a nested CATCH whose error must propagate (reference §11)
- [ ] File ends with `GO`
