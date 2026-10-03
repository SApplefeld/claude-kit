/*********************************************************************************
	TABLE: mem.Store

	One row per memory store: a project tier store belongs to one sandbox and
	names the project segment; a type tier store belongs to the fleet and names
	the type; the operator tier store belongs to the fleet and names nothing.
	A NULL [SandboxId] is the fleet, by meaning and not by absence, and the
	shape check below refuses a row whose tier and nullability disagree.

	TIER VALUES (fixed, lowercase):
		project		One sandbox's project store; [SandboxId] set, [Segment] the project path.
		type		A shared type store; [SandboxId] NULL, [Segment] the type name.
		operator	The shared operator store; [SandboxId] NULL, [Segment] NULL.
*********************************************************************************/
;IF NOT EXISTS(	SELECT	NULL
				FROM	sys.schemas S
						LEFT JOIN sys.tables T
							ON S.[schema_id] = T.[schema_id]
				WHERE	S.[name] = 'mem'
						AND T.[name] = 'Store'  )
BEGIN
	;CREATE TABLE mem.Store (
		 [StoreId]				INT				NOT NULL	IDENTITY(1,1)

		/* Identity Fields */
		,[SandboxId]			INT				NULL
		,[Tier]					VARCHAR(20)		NOT NULL
		,[Segment]				NVARCHAR(400)	NULL

		/* Audit Fields */
		,[CreatedDt]			DATETIMEOFFSET	NOT NULL	DEFAULT(SYSDATETIMEOFFSET())
		,[UpdatedDt]			DATETIMEOFFSET	NOT NULL	DEFAULT(SYSDATETIMEOFFSET())

		-- CHECK CONSTRAINTS.
		,CONSTRAINT		CK_Store_Tier
						CHECK ( [Tier] IN ('project', 'type', 'operator') )
		,CONSTRAINT		CK_Store_TierShape
						CHECK (	(	[Tier] = 'project'
									AND [SandboxId] IS NOT NULL
									AND [Segment] IS NOT NULL	)
								OR (	[Tier] = 'type'
										AND [SandboxId] IS NULL
										AND [Segment] IS NOT NULL	)
								OR (	[Tier] = 'operator'
										AND [SandboxId] IS NULL
										AND [Segment] IS NULL	)	)

		-- FOREIGN KEYS.
		,CONSTRAINT		FK_Store_Sandbox
						FOREIGN KEY	( [SandboxId] )
						REFERENCES	mem.Sandbox ( [SandboxId] )

		-- PRIMARY KEY.
		,CONSTRAINT		PK_Store
						PRIMARY KEY	CLUSTERED	( [StoreId] )
	)
END
GO

-- Check for and Create IX_Store_SandboxId_Tier_Segment. A Unique Index Treats NULL as One
-- Value, so the Fleet Holds One Store per Type and One Operator Store.
;IF NOT EXISTS(	SELECT	NULL
				FROM	sys.indexes I
				WHERE	I.[object_id] = OBJECT_ID('mem.Store')
						AND I.[name] = 'IX_Store_SandboxId_Tier_Segment' )
BEGIN
	;CREATE UNIQUE NONCLUSTERED INDEX IX_Store_SandboxId_Tier_Segment
		ON mem.Store (	 [SandboxId]
						,[Tier]
						,[Segment]	)
END
GO
