/*********************************************************************************
	TABLE: mem.Outcome

	One row per outcome a sandbox logged against a project store: the database
	copy of that project's outcomes.jsonl journal.

	[StampId] is the identifier the writing client generated for the entry, and
	the unique index over it is what makes delivery idempotent: a client that
	sends the same entry twice inserts one row. The index is unique over the
	sandbox and the stamp id together, so one sandbox's row never suppresses
	another's. [StampId] is nullable and the index is filtered, so a row written
	before the client carried one, and a client that sends none, both stand
	without the protection rather than being refused.
*********************************************************************************/
;IF NOT EXISTS(	SELECT	NULL
				FROM	sys.schemas S
						LEFT JOIN sys.tables T
							ON S.[schema_id] = T.[schema_id]
				WHERE	S.[name] = 'mem'
						AND T.[name] = 'Outcome'  )
BEGIN
	;CREATE TABLE mem.Outcome (
		 [OutcomeId]			BIGINT			NOT NULL	IDENTITY(1,1)

		/* Identity Fields */
		,[StoreId]				INT				NOT NULL
		,[ActionKey]			NVARCHAR(200)	NOT NULL
		,[SandboxId]			INT				NOT NULL
		,[LoggedDt]				DATETIMEOFFSET	NOT NULL
		,[StampId]				NVARCHAR(64)	NULL

		/* Content Fields */
		,[Result]				NVARCHAR(50)	NOT NULL	DEFAULT('')
		,[Summary]				NVARCHAR(MAX)	NOT NULL	DEFAULT('')
		,[Detail]				NVARCHAR(MAX)	NULL
		,[Tags]					NVARCHAR(MAX)	NULL

		/* Audit Fields */
		,[CreatedDt]			DATETIMEOFFSET	NOT NULL	DEFAULT(SYSDATETIMEOFFSET())
		,[UpdatedDt]			DATETIMEOFFSET	NOT NULL	DEFAULT(SYSDATETIMEOFFSET())

		-- CHECK CONSTRAINTS.
		,CONSTRAINT		CK_Outcome_Tags
						CHECK ( [Tags] IS NULL OR ISJSON([Tags]) = 1 )

		-- FOREIGN KEYS.
		,CONSTRAINT		FK_Outcome_Store
						FOREIGN KEY	( [StoreId] )
						REFERENCES	mem.Store ( [StoreId] )
		,CONSTRAINT		FK_Outcome_Sandbox
						FOREIGN KEY	( [SandboxId] )
						REFERENCES	mem.Sandbox ( [SandboxId] )

		-- PRIMARY KEY.
		,CONSTRAINT		PK_Outcome
						PRIMARY KEY	CLUSTERED	( [OutcomeId] )
	)
END
GO

-- Check for and Add StampId to a Table That Predates It.
;IF NOT EXISTS(	SELECT	NULL
				FROM	sys.columns C
				WHERE	C.[object_id] = OBJECT_ID('mem.Outcome')
						AND C.[name] = 'StampId' )
BEGIN
	;ALTER TABLE mem.Outcome ADD [StampId] NVARCHAR(64) NULL
END
GO

-- Drop the Fleet-Wide Stamp Id Index Where a Host Still Carries It.
;IF EXISTS(	SELECT	NULL
			FROM	sys.indexes I
			WHERE	I.[object_id] = OBJECT_ID('mem.Outcome')
					AND I.[name] = 'IX_Outcome_StampId' )
BEGIN
	;DROP INDEX IX_Outcome_StampId ON mem.Outcome
END
GO

-- Check for and Create IX_Outcome_SandboxId_StampId.
;IF NOT EXISTS(	SELECT	NULL
				FROM	sys.indexes I
				WHERE	I.[object_id] = OBJECT_ID('mem.Outcome')
						AND I.[name] = 'IX_Outcome_SandboxId_StampId' )
BEGIN
	;CREATE UNIQUE NONCLUSTERED INDEX IX_Outcome_SandboxId_StampId
		ON mem.Outcome (	 [SandboxId]
							,[StampId]	)
		WHERE [StampId] IS NOT NULL
END
GO

-- Check for and Create IX_Outcome_StoreId_LoggedDt.
;IF NOT EXISTS(	SELECT	NULL
				FROM	sys.indexes I
				WHERE	I.[object_id] = OBJECT_ID('mem.Outcome')
						AND I.[name] = 'IX_Outcome_StoreId_LoggedDt' )
BEGIN
	;CREATE NONCLUSTERED INDEX IX_Outcome_StoreId_LoggedDt
		ON mem.Outcome (	 [StoreId]
							,[LoggedDt]	)
END
GO
