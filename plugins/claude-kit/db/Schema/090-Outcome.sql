/*********************************************************************************
	TABLE: mem.Outcome

	One row per outcome a sandbox logged against a project store: the database
	copy of that project's outcomes.jsonl journal.
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
