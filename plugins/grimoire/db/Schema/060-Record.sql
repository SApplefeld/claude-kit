/*********************************************************************************
	TABLE: mem.Record

	One row per memory record the publishers have walked, keyed on the store and
	the file key, which for a shared tier is (tier, segment, file key) since the
	store carries no sandbox. The body is cached here for private and shared
	rows alike. Deletion is [DeletedDt], a soft mark no read procedure serves,
	never a row removal. [Author] stays NULL until the record provenance plan
	fills it.

	VISIBILITY VALUES (fixed, lowercase):
		private		Served to the owning sandbox only. The default for a project store row.
		shared		Served to every sandbox. The default for a type or operator store row,
					and what mem.usp_PromoteRecord flips a private row to.
*********************************************************************************/
;IF NOT EXISTS(	SELECT	NULL
				FROM	sys.schemas S
						LEFT JOIN sys.tables T
							ON S.[schema_id] = T.[schema_id]
				WHERE	S.[name] = 'mem'
						AND T.[name] = 'Record'  )
BEGIN
	;CREATE TABLE mem.Record (
		 [RecordId]					BIGINT			NOT NULL	IDENTITY(1,1)

		/* Identity Fields */
		,[StoreId]					INT				NOT NULL
		,[Name]						NVARCHAR(200)	NOT NULL
		,[FileKey]					NVARCHAR(400)	NOT NULL

		/* Content Fields */
		,[Description]				NVARCHAR(MAX)	NOT NULL	DEFAULT('')
		,[Body]						NVARCHAR(MAX)	NOT NULL	DEFAULT('')
		,[BodyHash]					VARCHAR(128)	NOT NULL	DEFAULT('')
		,[FileModifiedDt]			DATETIMEOFFSET	NULL
		,[Machine]					NVARCHAR(100)	NULL
		,[Tags]						NVARCHAR(MAX)	NULL
		,[SupersedesName]			NVARCHAR(200)	NULL
		,[Author]					NVARCHAR(200)	NULL
		,[IsArchived]				BIT				NOT NULL	DEFAULT(0)

		/* Visibility Fields */
		,[Visibility]				VARCHAR(10)		NOT NULL
		,[LastPublishedBySandboxId]	INT				NULL
		,[LastPublishedDt]			DATETIMEOFFSET	NOT NULL	DEFAULT(SYSDATETIMEOFFSET())
		,[DeletedDt]				DATETIMEOFFSET	NULL

		/* Audit Fields */
		,[CreatedDt]				DATETIMEOFFSET	NOT NULL	DEFAULT(SYSDATETIMEOFFSET())
		,[UpdatedDt]				DATETIMEOFFSET	NOT NULL	DEFAULT(SYSDATETIMEOFFSET())

		-- CHECK CONSTRAINTS.
		,CONSTRAINT		CK_Record_Visibility
						CHECK ( [Visibility] IN ('private', 'shared') )
		,CONSTRAINT		CK_Record_Tags
						CHECK ( [Tags] IS NULL OR ISJSON([Tags]) = 1 )

		-- FOREIGN KEYS.
		,CONSTRAINT		FK_Record_Store
						FOREIGN KEY	( [StoreId] )
						REFERENCES	mem.Store ( [StoreId] )
		,CONSTRAINT		FK_Record_LastPublishedBySandbox
						FOREIGN KEY	( [LastPublishedBySandboxId] )
						REFERENCES	mem.Sandbox ( [SandboxId] )

		-- PRIMARY KEY.
		,CONSTRAINT		PK_Record
						PRIMARY KEY	CLUSTERED	( [RecordId] )
	)
END
GO

-- Check for and Create IX_Record_StoreId_FileKey.
;IF NOT EXISTS(	SELECT	NULL
				FROM	sys.indexes I
				WHERE	I.[object_id] = OBJECT_ID('mem.Record')
						AND I.[name] = 'IX_Record_StoreId_FileKey' )
BEGIN
	;CREATE UNIQUE NONCLUSTERED INDEX IX_Record_StoreId_FileKey
		ON mem.Record (	 [StoreId]
						,[FileKey]	)
END
GO

-- Check for and Create IX_Record_StoreId_Name.
;IF NOT EXISTS(	SELECT	NULL
				FROM	sys.indexes I
				WHERE	I.[object_id] = OBJECT_ID('mem.Record')
						AND I.[name] = 'IX_Record_StoreId_Name' )
BEGIN
	;CREATE NONCLUSTERED INDEX IX_Record_StoreId_Name
		ON mem.Record (	 [StoreId]
						,[Name]	)
END
GO
