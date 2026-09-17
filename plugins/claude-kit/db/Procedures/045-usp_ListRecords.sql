-- CREATE THE PROCEDURE WITH QUOTED_IDENTIFIER ON; PROCEDURES CAPTURE IT AT CREATE TIME.
;SET QUOTED_IDENTIFIER ON
GO

-- CREATE A SHELL PROCEDURE IF NONE EXISTS.
;IF OBJECT_ID('mem.usp_ListRecords', 'P') IS NULL
  EXEC ('CREATE PROCEDURE mem.usp_ListRecords AS RETURN 0;')
GO

-- ALTER THE UPDATED PROCEDURE DEFINITION.
;ALTER PROCEDURE mem.usp_ListRecords
(
	/*********************************************************************************************
	 PARAMETER NAME		DATATYPE		DEFAULT
	*********************************************************************************************/
	 @p_ModelIdentity	VARCHAR(200)
)
AS
BEGIN	-- PROCEDURE

	/********************************************************************************************
	*********************************************************************************************
		SCRIPT:		mem.usp_ListRecords
		AUTHOR:		Scott Applefeld
		DATE:		September 17th, 2026
		VERSION:	v1.0
	*********************************************************************************************
		NOTES:		v1.0 - 09/17/2026 - SCOTT APPLEFELD
							The publisher's inventory of what it may see, which is the one
							thing an execute-only login cannot read for itself. It answers
							three questions in one pass: the record id every embedding write
							needs, which records carry no embedding for @p_ModelIdentity, and
							which file keys the database still holds that a walk no longer
							finds. The rows are mem.udf_VisibleRecords for the sandbox
							mem.CallerSandbox() resolves, so an unmapped login sees nothing and
							no tenancy rule is restated here. One mem.QueryLog row is written
							before the result returns, its digest a SHA-256 over the model
							identity.

							Returns ONE ROW PER RECORD, each one column [Json] holding
							{recordId, tier, segment, fileKey, name, archived, visibility,
							embedded}, ordered by tier, segment and file key. The shape is per
							row rather than one array because a client reads a value through
							sqlcmd, whose ceiling cuts a single value at 8000 characters: a few
							hundred records in one array pass that ceiling and the cut is
							silent, where a row of about 200 characters never approaches it.
							[embedded] is true where an embedding for @p_ModelIdentity exists, so
							a record embedded under another model reads as unembedded and the
							next publish re-embeds it.
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
	;DECLARE @True				BIT				= 1
			,@False				BIT				= 0
			,@SandboxId			INT				= NULL
			,@RowCount			INT				= 0
			,@Digest			VARCHAR(64)		= NULL

	/* The Visible Inventory, Created Unconditionally so an Outer Scope Cannot Plant One. */
	;CREATE TABLE #Listed (
		 [RecordId]			BIGINT			NOT NULL	PRIMARY KEY
		,[Tier]				VARCHAR(20)		NOT NULL
		,[Segment]			NVARCHAR(400)	NULL
		,[FileKey]			NVARCHAR(400)	NOT NULL
		,[Name]				NVARCHAR(200)	NOT NULL
		,[IsArchived]		BIT				NOT NULL
		,[Visibility]		VARCHAR(20)		NOT NULL
		,[IsEmbedded]		BIT				NOT NULL
	)

	/********************************************************************************************
		RESOLVE THE CALLER, COLLECT THE INVENTORY, LOG AND RETURN.
	********************************************************************************************/
	;BEGIN TRY
		;IF ( NULLIF(LTRIM(RTRIM(@p_ModelIdentity)), '') IS NULL )
			THROW 50000, 'mem.usp_ListRecords: @p_ModelIdentity is required, since the embedded flag is answered for one model.', 1

		;SELECT @Digest = CONVERT(VARCHAR(64), HASHBYTES('SHA2_256', @p_ModelIdentity), 2)

		/* Resolve the Caller Once; an Unmapped Login Fills Nothing Below. */
		;SELECT	@SandboxId = CS.[SandboxId]
		FROM	mem.CallerSandbox() CS

		/* Collect Every Visible Record and Whether This Model Has Embedded It. */
		;INSERT INTO #Listed (
			 [RecordId]
			,[Tier]
			,[Segment]
			,[FileKey]
			,[Name]
			,[IsArchived]
			,[Visibility]
			,[IsEmbedded]	)
		SELECT	 [RecordId]		= V.[RecordId]
				,[Tier]			= V.[Tier]
				,[Segment]		= V.[Segment]
				,[FileKey]		= V.[FileKey]
				,[Name]			= V.[Name]
				,[IsArchived]	= V.[IsArchived]
				,[Visibility]	= V.[Visibility]
				,[IsEmbedded]	= CASE
									WHEN EXISTS (	SELECT	NULL
													FROM	mem.Embedding E
													WHERE	E.[RecordId] = V.[RecordId]
															AND E.[ModelIdentity] = @p_ModelIdentity	)
									THEN @True
									ELSE @False
								  END
		FROM	mem.udf_VisibleRecords(@SandboxId) V

		;SELECT	@RowCount = COUNT(*)
		FROM	#Listed

		/* Log the Call Before Returning; the Result Carries Every Sandbox's Shared Keys and Names. */
		;INSERT INTO mem.QueryLog (
			 [Login]
			,[ProcedureName]
			,[SandboxId]
			,[ParametersDigest]
			,[RowCount]		)
		SELECT	 [Login]			= ORIGINAL_LOGIN()
				,[ProcedureName]	= 'usp_ListRecords'
				,[SandboxId]		= @SandboxId
				,[ParametersDigest]	= @Digest
				,[RowCount]			= @RowCount

		/****************************************************************************************
			DATASET 1: ONE ROW PER VISIBLE RECORD.
		****************************************************************************************/
		;SELECT	[Json] = (	SELECT	 [recordId]		= L.[RecordId]
									,[tier]			= L.[Tier]
									,[segment]		= L.[Segment]
									,[fileKey]		= L.[FileKey]
									,[name]			= L.[Name]
									,[archived]		= L.[IsArchived]
									,[visibility]	= L.[Visibility]
									,[embedded]		= L.[IsEmbedded]
							FOR JSON PATH, WITHOUT_ARRAY_WRAPPER, INCLUDE_NULL_VALUES	)
		FROM	#Listed L
		ORDER BY L.[Tier], L.[Segment], L.[FileKey]
	END TRY
	BEGIN CATCH
		;THROW
	END CATCH
END
GO
