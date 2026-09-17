/*********************************************************************************
	TABLE: mem.Usage

	One row per read or applied stamp a sandbox sent for a record. This is the
	database copy of each machine's usage.jsonl; the file stays complete on its
	own machine.

	KIND VALUES (fixed, lowercase):
		read		The record was surfaced to a session.
		applied		A session recorded that it acted on the record.
*********************************************************************************/
;IF NOT EXISTS(	SELECT	NULL
				FROM	sys.schemas S
						LEFT JOIN sys.tables T
							ON S.[schema_id] = T.[schema_id]
				WHERE	S.[name] = 'mem'
						AND T.[name] = 'Usage'  )
BEGIN
	;CREATE TABLE mem.Usage (
		 [UsageId]				BIGINT			NOT NULL	IDENTITY(1,1)

		/* Identity Fields */
		,[RecordId]				BIGINT			NOT NULL
		,[Kind]					VARCHAR(10)		NOT NULL
		,[StampedDt]			DATETIMEOFFSET	NOT NULL
		,[SandboxId]			INT				NOT NULL
		,[SessionId]			NVARCHAR(100)	NULL

		/* Audit Fields */
		,[CreatedDt]			DATETIMEOFFSET	NOT NULL	DEFAULT(SYSDATETIMEOFFSET())
		,[UpdatedDt]			DATETIMEOFFSET	NOT NULL	DEFAULT(SYSDATETIMEOFFSET())

		-- CHECK CONSTRAINTS.
		,CONSTRAINT		CK_Usage_Kind
						CHECK ( [Kind] IN ('read', 'applied') )

		-- FOREIGN KEYS.
		,CONSTRAINT		FK_Usage_Record
						FOREIGN KEY	( [RecordId] )
						REFERENCES	mem.Record ( [RecordId] )
		,CONSTRAINT		FK_Usage_Sandbox
						FOREIGN KEY	( [SandboxId] )
						REFERENCES	mem.Sandbox ( [SandboxId] )

		-- PRIMARY KEY.
		,CONSTRAINT		PK_Usage
						PRIMARY KEY	CLUSTERED	( [UsageId] )
	)
END
GO

-- Check for and Create IX_Usage_RecordId_Kind_StampedDt.
;IF NOT EXISTS(	SELECT	NULL
				FROM	sys.indexes I
				WHERE	I.[object_id] = OBJECT_ID('mem.Usage')
						AND I.[name] = 'IX_Usage_RecordId_Kind_StampedDt' )
BEGIN
	;CREATE NONCLUSTERED INDEX IX_Usage_RecordId_Kind_StampedDt
		ON mem.Usage (	 [RecordId]
						,[Kind]
						,[StampedDt]	)
END
GO
