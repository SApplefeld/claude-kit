/*********************************************************************************
	TABLE: mem.Usage

	One row per read or applied stamp a sandbox sent for a record. This is the
	database copy of each machine's usage.jsonl; the file stays complete on its
	own machine.

	KIND VALUES (fixed, lowercase):
		read		The record was surfaced to a session.
		applied		A session recorded that it acted on the record.

	[StampId] is the identifier the writing client generated for the stamp, and
	the unique index over it is what makes delivery idempotent: a client that
	sends the same stamp twice inserts one row. The index is unique over the
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
		,[StampId]				NVARCHAR(64)	NULL

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

-- Check for and Add StampId to a Table That Predates It.
;IF NOT EXISTS(	SELECT	NULL
				FROM	sys.columns C
				WHERE	C.[object_id] = OBJECT_ID('mem.Usage')
						AND C.[name] = 'StampId' )
BEGIN
	;ALTER TABLE mem.Usage ADD [StampId] NVARCHAR(64) NULL
END
GO

-- Drop the Fleet-Wide Stamp Id Index Where a Host Still Carries It.
;IF EXISTS(	SELECT	NULL
			FROM	sys.indexes I
			WHERE	I.[object_id] = OBJECT_ID('mem.Usage')
					AND I.[name] = 'IX_Usage_StampId' )
BEGIN
	;DROP INDEX IX_Usage_StampId ON mem.Usage
END
GO

-- Check for and Create IX_Usage_SandboxId_StampId.
;IF NOT EXISTS(	SELECT	NULL
				FROM	sys.indexes I
				WHERE	I.[object_id] = OBJECT_ID('mem.Usage')
						AND I.[name] = 'IX_Usage_SandboxId_StampId' )
BEGIN
	;CREATE UNIQUE NONCLUSTERED INDEX IX_Usage_SandboxId_StampId
		ON mem.Usage (	 [SandboxId]
						,[StampId]	)
		WHERE [StampId] IS NOT NULL
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
