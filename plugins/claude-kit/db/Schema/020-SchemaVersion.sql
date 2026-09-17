/*********************************************************************************
	TABLE: mem.SchemaVersion

	One row per schema version the installer has applied. The installer reads
	MAX([Version]) before it applies anything and refuses to run when the
	database carries a version newer than the scripts it holds. The version the
	scripts carry arrives as the sqlcmd scripting variable KitSchemaVersion,
	which Install-MemoryDatabase.ps1 sets from its own constant, so the two
	surfaces cannot disagree.
*********************************************************************************/
;IF NOT EXISTS(	SELECT	NULL
				FROM	sys.schemas S
						LEFT JOIN sys.tables T
							ON S.[schema_id] = T.[schema_id]
				WHERE	S.[name] = 'mem'
						AND T.[name] = 'SchemaVersion'  )
BEGIN
	;CREATE TABLE mem.SchemaVersion (
		 [Version]				INT				NOT NULL

		/* Description Fields */
		,[Notes]				NVARCHAR(400)	NOT NULL	DEFAULT('')

		/* Audit Fields */
		,[CreatedDt]			DATETIMEOFFSET	NOT NULL	DEFAULT(SYSDATETIMEOFFSET())
		,[UpdatedDt]			DATETIMEOFFSET	NOT NULL	DEFAULT(SYSDATETIMEOFFSET())

		-- PRIMARY KEY.
		,CONSTRAINT		PK_SchemaVersion
						PRIMARY KEY	CLUSTERED	( [Version] )
	)
END
GO

-- Record the Version These Scripts Carry, Once.
;IF NOT EXISTS(	SELECT	NULL
				FROM	mem.SchemaVersion V
				WHERE	V.[Version] = $(KitSchemaVersion)  )
BEGIN
	;INSERT INTO mem.SchemaVersion (
		 [Version]
		,[Notes]		)
	SELECT	 [Version]	= $(KitSchemaVersion)
			,[Notes]	= N'Shared index, journals, curation and the role model.'
END
GO
