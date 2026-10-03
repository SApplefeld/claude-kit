-- CREATE THE PROCEDURE WITH QUOTED_IDENTIFIER ON; PROCEDURES CAPTURE IT AT CREATE TIME.
;SET QUOTED_IDENTIFIER ON
GO

-- CREATE A SHELL PROCEDURE IF NONE EXISTS.
;IF OBJECT_ID('mem.usp_ListIndex', 'P') IS NULL
  EXEC ('CREATE PROCEDURE mem.usp_ListIndex AS RETURN 0;')
GO

-- ALTER THE UPDATED PROCEDURE DEFINITION.
;ALTER PROCEDURE mem.usp_ListIndex
(
	/*********************************************************************************************
	 PARAMETER NAME		DATATYPE		DEFAULT
	*********************************************************************************************/
	 @p_ProjectKey		NVARCHAR(400)	= NULL
)
AS
BEGIN	-- PROCEDURE

	/********************************************************************************************
	*********************************************************************************************
		SCRIPT:		mem.usp_ListIndex
		AUTHOR:		Scott Applefeld
		DATE:		October 3rd, 2026
		VERSION:	v1.0
	*********************************************************************************************
		NOTES:		v1.0 - 10/03/2026 - SCOTT APPLEFELD
							The index a session reads its memory from: every live record of
							one project's fleet store, the one @p_ProjectKey names, and of the
							type and operator tiers, never another project's. A live record
							is one carrying neither a deleted mark nor the archived flag. The
							rows come from mem.udf_VisibleRecords for the sandbox
							mem.CallerSandbox() resolves, so an unmapped login is answered
							with no rows. A NULL @p_ProjectKey lists the two shared tiers
							alone. Each row carries the three usage aggregates read from
							mem.Usage over every sandbox's stamps: the last read stamp, the
							last applied stamp, and the count of distinct days it was stamped
							applied. One mem.QueryLog row is written before the result
							returns, its digest a SHA-256 over the project key.

							Returns one row per record, each one column [Json] holding
							{recordId, tier, projectKey, typeName, name, description, tags,
							triggers, anchors, pinned, space, supersedes, created, origin,
							lastRead, lastApplied, appliedDays}, ordered by tier, type name
							and name.
	*********************************************************************************************
	********************************************************************************************/

	/********************************************************************************************
		SET PROCESSING VARIABLES TO INCREASE SPEED AND DATA ACCESS.
	********************************************************************************************/
	;SET NOCOUNT ON
	;SET TRANSACTION ISOLATION LEVEL READ COMMITTED

	/********************************************************************************************
		DECLARE VARIABLES FOR PROCESSING.
	********************************************************************************************/
	;DECLARE @False				BIT				= 0
			,@SandboxId			INT				= NULL
			,@RowCount			INT				= 0
			,@Digest			VARCHAR(64)		= NULL
			,@ProjectKey		NVARCHAR(400)	= NULLIF(LTRIM(RTRIM(@p_ProjectKey)), '')

	/* The Index, Created Unconditionally so an Outer Scope Cannot Plant One. */
	;CREATE TABLE #Listed (
		 [RecordId]			BIGINT			NOT NULL	PRIMARY KEY
		,[Tier]				VARCHAR(20)		NOT NULL
		,[ProjectKey]		NVARCHAR(400)	NULL
		,[TypeName]			NVARCHAR(400)	NULL
		,[Name]				NVARCHAR(200)	NOT NULL
		,[Description]		NVARCHAR(MAX)	NOT NULL
		,[Tags]				NVARCHAR(MAX)	NULL
		,[Triggers]			NVARCHAR(MAX)	NULL
		,[Anchors]			NVARCHAR(MAX)	NULL
		,[IsPinned]			BIT				NOT NULL
		,[Space]			NVARCHAR(100)	NULL
		,[SupersedesName]	NVARCHAR(200)	NULL
		,[CreatedOn]		DATE			NULL
		,[Origin]			VARCHAR(10)		NOT NULL
	)

	/********************************************************************************************
		RESOLVE THE CALLER, COLLECT THE INDEX, LOG AND RETURN.
	********************************************************************************************/
	;BEGIN TRY
		;SELECT @Digest = CONVERT(VARCHAR(64), HASHBYTES('SHA2_256', COALESCE(@ProjectKey, N'')), 2)

		/* Resolve the Caller Once; an Unmapped Login Fills Nothing Below. */
		;SELECT	@SandboxId = CS.[SandboxId]
		FROM	mem.CallerSandbox() CS

		/* Collect the Project's Live Records and the Shared Tiers' Live Records. */
		;INSERT INTO #Listed (
			 [RecordId]
			,[Tier]
			,[ProjectKey]
			,[TypeName]
			,[Name]
			,[Description]
			,[Tags]
			,[Triggers]
			,[Anchors]
			,[IsPinned]
			,[Space]
			,[SupersedesName]
			,[CreatedOn]
			,[Origin]			)
		SELECT	 [RecordId]			= V.[RecordId]
				,[Tier]				= V.[Tier]
				,[ProjectKey]		= V.[ProjectKey]
				,[TypeName]			= CASE WHEN V.[Tier] = 'type' THEN V.[Segment] END
				,[Name]				= V.[Name]
				,[Description]		= V.[Description]
				,[Tags]				= V.[Tags]
				,[Triggers]			= V.[Triggers]
				,[Anchors]			= V.[Anchors]
				,[IsPinned]			= V.[IsPinned]
				,[Space]			= V.[Space]
				,[SupersedesName]	= V.[SupersedesName]
				,[CreatedOn]		= V.[CreatedOn]
				,[Origin]			= V.[Origin]
		FROM	mem.udf_VisibleRecords(@SandboxId) V
		WHERE	V.[IsArchived] = @False
				AND (	(	V.[Tier] = 'project'
							AND V.[ProjectKey] = @ProjectKey	)
						OR V.[Tier] IN ('type', 'operator')	)

		;SELECT	@RowCount = COUNT(*)
		FROM	#Listed

		/* Log the Call Before Returning; the Result Carries Every Sandbox's Rows for the Project. */
		;INSERT INTO mem.QueryLog (
			 [Login]
			,[ProcedureName]
			,[SandboxId]
			,[ParametersDigest]
			,[RowCount]		)
		SELECT	 [Login]			= ORIGINAL_LOGIN()
				,[ProcedureName]	= 'usp_ListIndex'
				,[SandboxId]		= @SandboxId
				,[ParametersDigest]	= @Digest
				,[RowCount]			= @RowCount

		/****************************************************************************************
			DATASET 1: ONE ROW PER RECORD, WITH ITS USAGE AGGREGATES.
		****************************************************************************************/
		/* One Row per Record Rather Than One Array; sqlcmd Cuts a Single Value at 8000 Characters. */
		;WITH cteUsage AS (
			SELECT	 [RecordId]		= U.[RecordId]
					,[LastRead]		= MAX(CASE WHEN U.[Kind] = 'read' THEN U.[StampedDt] END)
					,[LastApplied]	= MAX(CASE WHEN U.[Kind] = 'applied' THEN U.[StampedDt] END)
					,[AppliedDays]	= COUNT(DISTINCT CASE WHEN U.[Kind] = 'applied' THEN CAST(U.[StampedDt] AS DATE) END)
			FROM	mem.Usage U
					INNER JOIN #Listed L
						ON L.[RecordId] = U.[RecordId]
			GROUP BY U.[RecordId]
		)
		SELECT	[Json] = (	SELECT	 [recordId]		= L.[RecordId]
									,[tier]			= L.[Tier]
									,[projectKey]	= L.[ProjectKey]
									,[typeName]		= L.[TypeName]
									,[name]			= L.[Name]
									,[description]	= L.[Description]
									,[tags]			= JSON_QUERY(L.[Tags])
									,[triggers]		= JSON_QUERY(L.[Triggers])
									,[anchors]		= JSON_QUERY(L.[Anchors])
									,[pinned]		= L.[IsPinned]
									,[space]		= L.[Space]
									,[supersedes]	= L.[SupersedesName]
									,[created]		= L.[CreatedOn]
									,[origin]		= L.[Origin]
									,[lastRead]		= U.[LastRead]
									,[lastApplied]	= U.[LastApplied]
									,[appliedDays]	= COALESCE(U.[AppliedDays], 0)
							FOR JSON PATH, WITHOUT_ARRAY_WRAPPER, INCLUDE_NULL_VALUES	)
		FROM	#Listed L
				LEFT JOIN cteUsage U
					ON U.[RecordId] = L.[RecordId]
		ORDER BY L.[Tier], L.[TypeName], L.[Name]
	END TRY
	BEGIN CATCH
		;THROW
	END CATCH
END
GO
