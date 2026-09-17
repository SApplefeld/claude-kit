-- CREATE THE PROCEDURE WITH QUOTED_IDENTIFIER ON; PROCEDURES CAPTURE IT AT CREATE TIME.
;SET QUOTED_IDENTIFIER ON
GO

-- CREATE A SHELL PROCEDURE IF NONE EXISTS.
;IF OBJECT_ID('mem.usp_UpsertRecords', 'P') IS NULL
  EXEC ('CREATE PROCEDURE mem.usp_UpsertRecords AS RETURN 0;')
GO

-- ALTER THE UPDATED PROCEDURE DEFINITION.
;ALTER PROCEDURE mem.usp_UpsertRecords
(
	/*********************************************************************************************
	 PARAMETER NAME		DATATYPE		DEFAULT
	*********************************************************************************************/
	 @p_Records			NVARCHAR(MAX)
	,@p_Removed			NVARCHAR(MAX)	= NULL
)
AS
BEGIN	-- PROCEDURE

	/********************************************************************************************
	*********************************************************************************************
		SCRIPT:		mem.usp_UpsertRecords
		AUTHOR:		Scott Applefeld
		DATE:		September 17th, 2026
		VERSION:	v1.0
	*********************************************************************************************
		NOTES:		v1.0 - 09/17/2026 - SCOTT APPLEFELD
							Upserts one batch of records for the calling sandbox. @p_Records
							is a JSON array of objects {tier, segment, name, fileKey,
							description, body, bodyHash, fileModified, machine, tags,
							supersedes, archived}; @p_Removed is a JSON array of {segment,
							fileKey} naming files the caller's own project stores no longer
							hold. The caller's sandbox comes from mem.CallerSandbox() and an
							unmapped login is refused.

							A project tier row lands in the caller's own store as private; a
							type or operator tier row lands in the fleet's store as shared,
							one row serving every sandbox. On an existing row the newer file
							modification time wins and the row records the sandbox that
							published it; a row already shared stays shared, and a deleted
							mark lifts when the file is published again. A body hash or name
							change deletes the row's embeddings so the next publish re-embeds
							it. Removal is a soft mark on the caller's own private project
							rows only; a shared row is never marked removed here. A batch
							that names one file key twice in the same tier and segment keeps
							its last entry and drops the earlier ones, so the batch reads as
							the file's final state.

							Returns one row, one column [Json], holding {added, changed,
							unchanged, skippedOlder, removed}.
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
			,@Now				DATETIMEOFFSET	= SYSDATETIMEOFFSET()
			,@SandboxId			INT				= NULL
			,@LockResult		INT				= NULL

	/* Result Counts. */
	;DECLARE @Added				INT				= 0
			,@Changed			INT				= 0
			,@Unchanged			INT				= 0
			,@SkippedOlder		INT				= 0
			,@Removed			INT				= 0

	/* The Batch, With the Store and Record Each Row Resolves To and What the Batch Does to It. */
	;DECLARE @Incoming TABLE (
		 [Ordinal]			INT				NOT NULL	IDENTITY(1,1)
		,[Tier]				VARCHAR(20)		NULL
		,[Segment]			NVARCHAR(400)	NULL
		,[Name]				NVARCHAR(200)	NULL
		,[FileKey]			NVARCHAR(400)	NULL
		,[Description]		NVARCHAR(MAX)	NULL
		,[Body]				NVARCHAR(MAX)	NULL
		,[BodyHash]			VARCHAR(128)	NULL
		,[FileModifiedDt]	DATETIMEOFFSET	NULL
		,[Machine]			NVARCHAR(100)	NULL
		,[Tags]				NVARCHAR(MAX)	NULL
		,[SupersedesName]	NVARCHAR(200)	NULL
		,[IsArchived]		BIT				NULL
		,[StoreSandboxId]	INT				NULL
		,[StoreId]			INT				NULL
		,[RecordId]			BIGINT			NULL
		,[Disposition]		VARCHAR(20)		NULL
	)

	/* The File Keys the Batch Names as Removed. */
	;DECLARE @RemovedKeys TABLE (
		 [Segment]			NVARCHAR(400)	NOT NULL
		,[FileKey]			NVARCHAR(400)	NOT NULL
	)

	/********************************************************************************************
		VALIDATE THE CALLER AND THE BATCH, THEN UPSERT AS ONE UNIT.
	********************************************************************************************/
	;BEGIN TRY
		/* Resolve the Caller; an Unmapped Login Publishes Nothing. */
		;SELECT	@SandboxId = CS.[SandboxId]
		FROM	mem.CallerSandbox() CS

		;IF ( @SandboxId IS NULL )
			THROW 50000, 'mem.usp_UpsertRecords: the calling login maps to no sandbox.', 1

		;IF ( @p_Records IS NULL OR ISJSON(@p_Records, ARRAY) <> 1 )
			THROW 50000, 'mem.usp_UpsertRecords: @p_Records must be a JSON array.', 1

		;IF ( @p_Removed IS NOT NULL AND ISJSON(@p_Removed, ARRAY) <> 1 )
			THROW 50000, 'mem.usp_UpsertRecords: @p_Removed must be a JSON array when given.', 1

		/* Parse the Batch Into Typed Rows, Canonicalizing the Tier and Its Segment. */
		;INSERT INTO @Incoming (
			 [Tier]
			,[Segment]
			,[Name]
			,[FileKey]
			,[Description]
			,[Body]
			,[BodyHash]
			,[FileModifiedDt]
			,[Machine]
			,[Tags]
			,[SupersedesName]
			,[IsArchived]		)
		SELECT	 [Tier]				= LOWER(LTRIM(RTRIM(J.[Tier])))
				,[Segment]			= CASE	WHEN LOWER(LTRIM(RTRIM(J.[Tier]))) = 'operator'
											THEN NULL
											ELSE NULLIF(LTRIM(RTRIM(J.[Segment])), '')
									  END
				,[Name]				= NULLIF(LTRIM(RTRIM(J.[Name])), '')
				,[FileKey]			= NULLIF(LTRIM(RTRIM(J.[FileKey])), '')
				,[Description]		= COALESCE(J.[Description], N'')
				,[Body]				= COALESCE(J.[Body], N'')
				,[BodyHash]			= COALESCE(J.[BodyHash], '')
				,[FileModifiedDt]	= J.[FileModifiedDt]
				,[Machine]			= NULLIF(LTRIM(RTRIM(J.[Machine])), '')
				,[Tags]				= J.[Tags]
				,[SupersedesName]	= NULLIF(LTRIM(RTRIM(J.[SupersedesName])), '')
				,[IsArchived]		= COALESCE(J.[IsArchived], @False)
		FROM	OPENJSON(@p_Records)
				WITH (	 [Tier]				VARCHAR(20)		'$.tier'
						,[Segment]			NVARCHAR(400)	'$.segment'
						,[Name]				NVARCHAR(200)	'$.name'
						,[FileKey]			NVARCHAR(400)	'$.fileKey'
						,[Description]		NVARCHAR(MAX)	'$.description'
						,[Body]				NVARCHAR(MAX)	'$.body'
						,[BodyHash]			VARCHAR(128)	'$.bodyHash'
						,[FileModifiedDt]	DATETIMEOFFSET	'$.fileModified'
						,[Machine]			NVARCHAR(100)	'$.machine'
						,[Tags]				NVARCHAR(MAX)	'$.tags' AS JSON
						,[SupersedesName]	NVARCHAR(200)	'$.supersedes'
						,[IsArchived]		BIT				'$.archived'	) J

		/* Refuse a Row Whose Shape No Store Can Hold. */
		;IF EXISTS (	SELECT	NULL
						FROM	@Incoming I
						WHERE	I.[Tier] IS NULL
								OR I.[Tier] NOT IN ('project', 'type', 'operator')
								OR I.[Name] IS NULL
								OR I.[FileKey] IS NULL
								OR (	I.[Tier] IN ('project', 'type')
										AND I.[Segment] IS NULL	)	)
			THROW 50000, 'mem.usp_UpsertRecords: every record needs a tier of project, type or operator, a name, a file key, and a segment for the project and type tiers.', 1

		/* A Key Named Twice Keeps Its Last Entry; INTERSECT Treats Two NULL Segments as Equal. */
		;DELETE I
		FROM	@Incoming I
		WHERE	EXISTS (	SELECT	NULL
							FROM	@Incoming L
							WHERE	L.[Ordinal] > I.[Ordinal]
									AND L.[Tier] = I.[Tier]
									AND L.[FileKey] = I.[FileKey]
									AND EXISTS (	SELECT L.[Segment]
													INTERSECT
													SELECT I.[Segment]	)	)

		/* A Project Row Belongs to the Caller's Sandbox; a Shared Tier Row Belongs to the Fleet. */
		;UPDATE I
		SET		[StoreSandboxId] = CASE WHEN I.[Tier] = 'project' THEN @SandboxId ELSE NULL END
		FROM	@Incoming I

		/* Parse the Removed Keys, Dropping Any Entry Missing Either Half. */
		;INSERT INTO @RemovedKeys (
			 [Segment]
			,[FileKey]	)
		SELECT	 [Segment]	= LTRIM(RTRIM(J.[Segment]))
				,[FileKey]	= LTRIM(RTRIM(J.[FileKey]))
		FROM	OPENJSON(COALESCE(@p_Removed, N'[]'))
				WITH (	 [Segment]	NVARCHAR(400)	'$.segment'
						,[FileKey]	NVARCHAR(400)	'$.fileKey'	) J
		WHERE	NULLIF(LTRIM(RTRIM(J.[Segment])), '') IS NOT NULL
				AND NULLIF(LTRIM(RTRIM(J.[FileKey])), '') IS NOT NULL

		/* Open a Transaction Unless the Caller Holds One. */
		;IF ( @EntryTranCount = 0 )
			BEGIN TRANSACTION

		/* Publishes Serialize on One Fleet-Wide Application Lock, Held to the End of the Transaction. */
		/* Two Sandboxes First-Publishing One Shared Store or Record Therefore Queue Instead of Racing the Unique Index. */
		;EXEC @LockResult = sp_getapplock @Resource = 'mem.Publish', @LockMode = 'Exclusive', @LockOwner = 'Transaction', @LockTimeout = 30000
		;IF ( @LockResult < 0 )
			THROW 50000, 'mem.usp_UpsertRecords: the fleet publish lock was not acquired before the wait timed out; another publish is holding it.', 1

		/****************************************************************************************
			RESOLVE THE STORES, CREATING THE ONES THE BATCH NAMES FOR THE FIRST TIME.
		****************************************************************************************/
		/* INTERSECT Compares the Nullable Halves of the Key as Equal When Both are NULL. */
		;INSERT INTO mem.Store (
			 [SandboxId]
			,[Tier]
			,[Segment]	)
		SELECT	DISTINCT
				 [SandboxId]	= I.[StoreSandboxId]
				,[Tier]			= I.[Tier]
				,[Segment]		= I.[Segment]
		FROM	@Incoming I
		WHERE	NOT EXISTS (	SELECT	NULL
								FROM	mem.Store S
								WHERE	S.[Tier] = I.[Tier]
										AND EXISTS (	SELECT S.[SandboxId], S.[Segment]
														INTERSECT
														SELECT I.[StoreSandboxId], I.[Segment]	)	)

		;UPDATE I
		SET		[StoreId] = S.[StoreId]
		FROM	@Incoming I
				INNER JOIN mem.Store S
					ON	S.[Tier] = I.[Tier]
					AND EXISTS (	SELECT S.[SandboxId], S.[Segment]
									INTERSECT
									SELECT I.[StoreSandboxId], I.[Segment]	)

		/****************************************************************************************
			RESOLVE EACH ROW'S EXISTING RECORD AND DECIDE WHAT THE BATCH DOES TO IT.
		****************************************************************************************/
		/* Unchanged Means Every Published Field Matches and the Row Carries no Deleted Mark. */
		/* Older Means a Shared Row Already Holds a Newer File Than the One This Sandbox Has. */
		;UPDATE I
		SET		 [RecordId]		= R.[RecordId]
				,[Disposition]	= CASE
									WHEN R.[RecordId] IS NULL
									THEN 'add'
									WHEN EXISTS (	SELECT	 R.[Name], R.[Description], R.[Body], R.[BodyHash], R.[FileModifiedDt]
															,R.[Machine], R.[Tags], R.[SupersedesName], R.[IsArchived], R.[DeletedDt]
													INTERSECT
													SELECT	 I.[Name], I.[Description], I.[Body], I.[BodyHash], I.[FileModifiedDt]
															,I.[Machine], I.[Tags], I.[SupersedesName], I.[IsArchived], CAST(NULL AS DATETIMEOFFSET)	)
									THEN 'unchanged'
									WHEN I.[StoreSandboxId] IS NULL
										AND I.[FileModifiedDt] IS NOT NULL
										AND R.[FileModifiedDt] IS NOT NULL
										AND I.[FileModifiedDt] < R.[FileModifiedDt]
									THEN 'older'
									ELSE 'change'
								  END
		FROM	@Incoming I
				LEFT JOIN mem.Record R
					ON	R.[StoreId] = I.[StoreId]
					AND R.[FileKey] = I.[FileKey]

		/****************************************************************************************
			APPLY THE BATCH.
		****************************************************************************************/
		/* Drop the Embeddings of Every Row Whose Embedded Text Changed, so the Next Publish Re-Embeds It. */
		;DELETE E
		FROM	mem.Embedding E
				INNER JOIN @Incoming I
					ON I.[RecordId] = E.[RecordId]
				INNER JOIN mem.Record R
					ON R.[RecordId] = I.[RecordId]
		WHERE	I.[Disposition] = 'change'
				AND (	R.[BodyHash] <> I.[BodyHash]
						OR R.[Name] <> I.[Name]	)

		/* Update the Changed Rows. Visibility is Kept, so a Promoted Row Stays Shared. */
		;UPDATE R
		SET		 [Name]						= I.[Name]
				,[Description]				= I.[Description]
				,[Body]						= I.[Body]
				,[BodyHash]					= I.[BodyHash]
				,[FileModifiedDt]			= I.[FileModifiedDt]
				,[Machine]					= I.[Machine]
				,[Tags]						= I.[Tags]
				,[SupersedesName]			= I.[SupersedesName]
				,[IsArchived]				= I.[IsArchived]
				,[LastPublishedBySandboxId]	= @SandboxId
				,[LastPublishedDt]			= @Now
				,[DeletedDt]				= NULL
				,[UpdatedDt]				= @Now
		FROM	mem.Record R
				INNER JOIN @Incoming I
					ON I.[RecordId] = R.[RecordId]
		WHERE	I.[Disposition] = 'change'

		/* Stamp the Publish on Every Other Row the Batch Carried; an Older Copy Never Takes the Publisher Credit. */
		;UPDATE R
		SET		 [LastPublishedBySandboxId]	= CASE WHEN I.[Disposition] = 'unchanged' THEN @SandboxId ELSE R.[LastPublishedBySandboxId] END
				,[LastPublishedDt]			= @Now
		FROM	mem.Record R
				INNER JOIN @Incoming I
					ON I.[RecordId] = R.[RecordId]
		WHERE	I.[Disposition] IN ('unchanged', 'older')

		/* Insert the New Rows, Private for a Project Store and Shared for the Fleet's Stores. */
		;INSERT INTO mem.Record (
			 [StoreId]
			,[Name]
			,[FileKey]
			,[Description]
			,[Body]
			,[BodyHash]
			,[FileModifiedDt]
			,[Machine]
			,[Tags]
			,[SupersedesName]
			,[IsArchived]
			,[Visibility]
			,[LastPublishedBySandboxId]
			,[LastPublishedDt]			)
		SELECT	 [StoreId]					= I.[StoreId]
				,[Name]						= I.[Name]
				,[FileKey]					= I.[FileKey]
				,[Description]				= I.[Description]
				,[Body]						= I.[Body]
				,[BodyHash]					= I.[BodyHash]
				,[FileModifiedDt]			= I.[FileModifiedDt]
				,[Machine]					= I.[Machine]
				,[Tags]						= I.[Tags]
				,[SupersedesName]			= I.[SupersedesName]
				,[IsArchived]				= I.[IsArchived]
				,[Visibility]				= CASE WHEN I.[Tier] = 'project' THEN 'private' ELSE 'shared' END
				,[LastPublishedBySandboxId]	= @SandboxId
				,[LastPublishedDt]			= @Now
		FROM	@Incoming I
		WHERE	I.[Disposition] = 'add'

		/* Mark Removed the Caller's Own Private Project Rows the Batch Named. */
		;UPDATE R
		SET		 [DeletedDt]	= @Now
				,[UpdatedDt]	= @Now
		FROM	mem.Record R
				INNER JOIN mem.Store S
					ON S.[StoreId] = R.[StoreId]
				INNER JOIN @RemovedKeys K
					ON	K.[Segment] = S.[Segment]
					AND K.[FileKey] = R.[FileKey]
		WHERE	S.[Tier] = 'project'
				AND S.[SandboxId] = @SandboxId
				AND R.[Visibility] = 'private'
				AND R.[DeletedDt] IS NULL

		;SET @Removed = @@ROWCOUNT

		/* Commit Only a Transaction This Procedure Opened. */
		;IF ( @EntryTranCount = 0 )
			COMMIT TRANSACTION

		/****************************************************************************************
			DATASET 1: THE COUNTS.
		****************************************************************************************/
		;SELECT	 @Added			= SUM(CASE WHEN I.[Disposition] = 'add' THEN 1 ELSE 0 END)
				,@Changed		= SUM(CASE WHEN I.[Disposition] = 'change' THEN 1 ELSE 0 END)
				,@Unchanged		= SUM(CASE WHEN I.[Disposition] = 'unchanged' THEN 1 ELSE 0 END)
				,@SkippedOlder	= SUM(CASE WHEN I.[Disposition] = 'older' THEN 1 ELSE 0 END)
		FROM	@Incoming I

		;SELECT	[Json] = (	SELECT	 [added]		= COALESCE(@Added, 0)
									,[changed]		= COALESCE(@Changed, 0)
									,[unchanged]	= COALESCE(@Unchanged, 0)
									,[skippedOlder]	= COALESCE(@SkippedOlder, 0)
									,[removed]		= @Removed
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
