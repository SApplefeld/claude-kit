-- CREATE THE PROCEDURE WITH QUOTED_IDENTIFIER ON; PROCEDURES CAPTURE IT AT CREATE TIME.
;SET QUOTED_IDENTIFIER ON
GO

-- CREATE A SHELL PROCEDURE IF NONE EXISTS.
;IF OBJECT_ID('mem.usp_AppendUsage', 'P') IS NULL
  EXEC ('CREATE PROCEDURE mem.usp_AppendUsage AS RETURN 0;')
GO

-- ALTER THE UPDATED PROCEDURE DEFINITION.
;ALTER PROCEDURE mem.usp_AppendUsage
(
	/*********************************************************************************************
	 PARAMETER NAME		DATATYPE		DEFAULT
	*********************************************************************************************/
	 @p_Usage			NVARCHAR(MAX)
)
AS
BEGIN	-- PROCEDURE

	/********************************************************************************************
	*********************************************************************************************
		SCRIPT:		mem.usp_AppendUsage
		AUTHOR:		Scott Applefeld
		DATE:		September 17th, 2026
		VERSION:	v1.0
	*********************************************************************************************
		NOTES:		v1.0 - 09/17/2026 - SCOTT APPLEFELD
							Appends one batch of read or applied stamps for the calling
							sandbox. @p_Usage is a JSON array of objects {recordId, tier,
							segment, name, fileKey, kind, at, sessionId}. A stamp names its
							record either by recordId, which must be a record the caller may
							see, or by identity: the tier and segment of its store plus the
							file key or, failing that, the name, where a project tier
							identity resolves against the caller's own store only. A stamp
							that resolves to no visible record is rejected and counted rather
							than written.

							Returns one row, one column [Json], holding {appended, rejected}.
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
			,@EntryTranCount	INT				= @@TRANCOUNT
			,@SandboxId			INT				= NULL

	/* Result Counts. */
	;DECLARE @Appended			INT				= 0
			,@Rejected			INT				= 0

	/* The Batch, With the Record Each Stamp Resolves To. */
	;DECLARE @Incoming TABLE (
		 [RecordIdIn]		BIGINT			NULL
		,[Tier]				VARCHAR(20)		NULL
		,[Segment]			NVARCHAR(400)	NULL
		,[Name]				NVARCHAR(200)	NULL
		,[FileKey]			NVARCHAR(400)	NULL
		,[Kind]				VARCHAR(10)		NULL
		,[StampedDt]		DATETIMEOFFSET	NULL
		,[SessionId]		NVARCHAR(100)	NULL
		,[RecordId]			BIGINT			NULL
	)

	/********************************************************************************************
		VALIDATE THE CALLER AND THE BATCH, THEN APPEND THE RESOLVED STAMPS.
	********************************************************************************************/
	;BEGIN TRY
		/* Resolve the Caller; an Unmapped Login Writes Nothing. */
		;SELECT	@SandboxId = CS.[SandboxId]
		FROM	mem.CallerSandbox() CS

		;IF ( @SandboxId IS NULL )
			THROW 50000, 'mem.usp_AppendUsage: the calling login maps to no sandbox.', 1

		;IF ( @p_Usage IS NULL OR ISJSON(@p_Usage, ARRAY) <> 1 )
			THROW 50000, 'mem.usp_AppendUsage: @p_Usage must be a JSON array.', 1

		/* Parse the Batch Into Typed Rows, Canonicalizing the Tier and the Kind. */
		;INSERT INTO @Incoming (
			 [RecordIdIn]
			,[Tier]
			,[Segment]
			,[Name]
			,[FileKey]
			,[Kind]
			,[StampedDt]
			,[SessionId]	)
		SELECT	 [RecordIdIn]	= J.[RecordId]
				,[Tier]			= LOWER(LTRIM(RTRIM(J.[Tier])))
				,[Segment]		= CASE	WHEN LOWER(LTRIM(RTRIM(J.[Tier]))) = 'operator'
										THEN NULL
										ELSE NULLIF(LTRIM(RTRIM(J.[Segment])), '')
								  END
				,[Name]			= NULLIF(LTRIM(RTRIM(J.[Name])), '')
				,[FileKey]		= NULLIF(LTRIM(RTRIM(J.[FileKey])), '')
				,[Kind]			= LOWER(LTRIM(RTRIM(J.[Kind])))
				,[StampedDt]	= J.[StampedDt]
				,[SessionId]	= NULLIF(LTRIM(RTRIM(J.[SessionId])), '')
		FROM	OPENJSON(@p_Usage)
				WITH (	 [RecordId]		BIGINT			'$.recordId'
						,[Tier]			VARCHAR(20)		'$.tier'
						,[Segment]		NVARCHAR(400)	'$.segment'
						,[Name]			NVARCHAR(200)	'$.name'
						,[FileKey]		NVARCHAR(400)	'$.fileKey'
						,[Kind]			VARCHAR(10)		'$.kind'
						,[StampedDt]	DATETIMEOFFSET	'$.at'
						,[SessionId]	NVARCHAR(100)	'$.sessionId'	) J

		/* Refuse a Stamp Missing Its Kind or Its Time. */
		;IF EXISTS (	SELECT	NULL
						FROM	@Incoming I
						WHERE	I.[Kind] IS NULL
								OR I.[Kind] NOT IN ('read', 'applied')
								OR I.[StampedDt] IS NULL	)
			THROW 50000, 'mem.usp_AppendUsage: every stamp needs a kind of read or applied and an at timestamp.', 1

		/* Resolve Each Stamp to a Record the Caller May See, by Id First and by Identity Otherwise. */
		;UPDATE I
		SET		[RecordId] = X.[RecordId]
		FROM	@Incoming I
				CROSS APPLY (	SELECT	TOP ( 1 )
										[RecordId] = V.[RecordId]
								FROM	mem.udf_VisibleRecords(@SandboxId) V
								WHERE	(	I.[RecordIdIn] IS NOT NULL
											AND V.[RecordId] = I.[RecordIdIn]	)
										OR (	I.[RecordIdIn] IS NULL
												AND V.[Tier] = I.[Tier]
												AND EXISTS (	SELECT V.[Segment]
																INTERSECT
																SELECT I.[Segment]	)
												AND (	V.[Tier] <> 'project'
														OR V.[StoreSandboxId] = @SandboxId	)
												AND (	(	I.[FileKey] IS NOT NULL
															AND V.[FileKey] = I.[FileKey]	)
														OR (	I.[FileKey] IS NULL
																AND I.[Name] IS NOT NULL
																AND V.[Name] = I.[Name]	)	)	)
								ORDER BY V.[RecordId]	) X

		;SELECT	@Rejected = COUNT(*)
		FROM	@Incoming I
		WHERE	I.[RecordId] IS NULL

		/* Open a Transaction Unless the Caller Holds One. */
		;IF ( @EntryTranCount = 0 )
			BEGIN TRANSACTION

		/* Append the Resolved Stamps. */
		;INSERT INTO mem.Usage (
			 [RecordId]
			,[Kind]
			,[StampedDt]
			,[SandboxId]
			,[SessionId]	)
		SELECT	 [RecordId]		= I.[RecordId]
				,[Kind]			= I.[Kind]
				,[StampedDt]	= I.[StampedDt]
				,[SandboxId]	= @SandboxId
				,[SessionId]	= I.[SessionId]
		FROM	@Incoming I
		WHERE	I.[RecordId] IS NOT NULL

		;SET @Appended = @@ROWCOUNT

		/* Commit Only a Transaction This Procedure Opened. */
		;IF ( @EntryTranCount = 0 )
			COMMIT TRANSACTION

		/****************************************************************************************
			DATASET 1: THE COUNTS.
		****************************************************************************************/
		;SELECT	[Json] = (	SELECT	 [appended]	= @Appended
									,[rejected]	= @Rejected
							FOR JSON PATH, WITHOUT_ARRAY_WRAPPER	)
	END TRY
	BEGIN CATCH
		/* Unwind a Doomed Transaction, or a Healthy One This Procedure Opened. */
		;IF ( XACT_STATE() = -1 )
			ROLLBACK TRANSACTION
		ELSE IF ( XACT_STATE() = 1 AND @EntryTranCount = 0 )
			ROLLBACK TRANSACTION

		/* Restore the Entry Count With Fresh Empty Transactions so Error 266 Cannot Fire. */
		;WHILE ( @@TRANCOUNT < @EntryTranCount )
			BEGIN TRANSACTION

		/* Re-Raise so the Caller Never Reads Success From a Failed Write. */
		;THROW
	END CATCH
END
GO
