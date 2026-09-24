/*********************************************************************************
	TABLE: mem.PublishRun

	One row per publisher run a sandbox reported, with the counts its summary
	line carries. mem.usp_Health reads the latest row per sandbox carrying no
	error text as the last clean publish.
*********************************************************************************/
;IF NOT EXISTS(	SELECT	NULL
				FROM	sys.schemas S
						LEFT JOIN sys.tables T
							ON S.[schema_id] = T.[schema_id]
				WHERE	S.[name] = 'mem'
						AND T.[name] = 'PublishRun'  )
BEGIN
	;CREATE TABLE mem.PublishRun (
		 [PublishRunId]			BIGINT			NOT NULL	IDENTITY(1,1)

		/* Identity Fields */
		,[SandboxId]			INT				NOT NULL
		,[StartedDt]			DATETIMEOFFSET	NOT NULL
		,[FinishedDt]			DATETIMEOFFSET	NULL

		/* Count Fields */
		,[AddedCount]			INT				NOT NULL	DEFAULT(0)
		,[ChangedCount]			INT				NOT NULL	DEFAULT(0)
		,[RemovedCount]			INT				NOT NULL	DEFAULT(0)
		,[EmbeddedCount]		INT				NOT NULL	DEFAULT(0)
		,[SpoolDrainedCount]	INT				NOT NULL	DEFAULT(0)

		/* Error Fields */
		,[ErrorText]			NVARCHAR(MAX)	NULL

		/* Audit Fields */
		,[CreatedDt]			DATETIMEOFFSET	NOT NULL	DEFAULT(SYSDATETIMEOFFSET())
		,[UpdatedDt]			DATETIMEOFFSET	NOT NULL	DEFAULT(SYSDATETIMEOFFSET())

		-- FOREIGN KEYS.
		,CONSTRAINT		FK_PublishRun_Sandbox
						FOREIGN KEY	( [SandboxId] )
						REFERENCES	mem.Sandbox ( [SandboxId] )

		-- PRIMARY KEY.
		,CONSTRAINT		PK_PublishRun
						PRIMARY KEY	CLUSTERED	( [PublishRunId] )
	)
END
GO

-- Check for and Create IX_PublishRun_SandboxId_StartedDt.
;IF NOT EXISTS(	SELECT	NULL
				FROM	sys.indexes I
				WHERE	I.[object_id] = OBJECT_ID('mem.PublishRun')
						AND I.[name] = 'IX_PublishRun_SandboxId_StartedDt' )
BEGIN
	;CREATE NONCLUSTERED INDEX IX_PublishRun_SandboxId_StartedDt
		ON mem.PublishRun (	 [SandboxId]
							,[StartedDt]	)
END
GO
