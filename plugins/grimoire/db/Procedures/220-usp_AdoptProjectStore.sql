-- CREATE THE PROCEDURE WITH QUOTED_IDENTIFIER ON; PROCEDURES CAPTURE IT AT CREATE TIME.
;SET QUOTED_IDENTIFIER ON
GO

-- CREATE A SHELL PROCEDURE IF NONE EXISTS.
;IF OBJECT_ID('mem.usp_AdoptProjectStore', 'P') IS NULL
  EXEC ('CREATE PROCEDURE mem.usp_AdoptProjectStore AS RETURN 0;')
GO

-- ALTER THE UPDATED PROCEDURE DEFINITION.
;ALTER PROCEDURE mem.usp_AdoptProjectStore
(
	/*********************************************************************************************
	 PARAMETER NAME		DATATYPE		DEFAULT
	*********************************************************************************************/
	 @p_FromKey			NVARCHAR(4000)	= NULL
	,@p_ToKey			NVARCHAR(4000)	= NULL
)
AS
BEGIN	-- PROCEDURE

	/********************************************************************************************
	*********************************************************************************************
		SCRIPT:		mem.usp_AdoptProjectStore
		AUTHOR:		Scott Applefeld
		DATE:		October 3rd, 2026
		VERSION:	v1.0
	*********************************************************************************************
		NOTES:		v1.0 - 10/03/2026 - SCOTT APPLEFELD
							Moves a project's records from the fleet store keyed by its
							folder name, @p_FromKey, which opens path:, into the fleet store
							keyed by its git remote, @p_ToKey, which opens remote:, creating
							that store where absent. Both prefixes compare case-sensitively.
							Any other pair of keys is refused and nothing is written, and so
							is a key longer than the 400 characters a store's key holds,
							which the parameters take whole so that no longer key is cut
							to name another store. The caller's sandbox comes from
							mem.CallerSandbox() and an unmapped login is refused.

							A row moves by its [StoreId] alone, so its embeddings and its
							mem.Usage rows travel with it. Where the target store holds a
							row of the same file key, compared under the database's
							collation, the two are one record, and the rules run in order.
							A target row whose name differs from the source row's, in case
							alone included where the target is deleted, or by more where it
							is not, leaves the source row in place, named as skipped. A
							source row of [Origin] memq is never deleted: over a live,
							unarchived file-origin target it wins whatever the file times,
							and over any other target it stays in place, named as skipped.
							Otherwise the target row wins unless it is live, neither
							archived nor deleted, of [Origin] file, and older by
							[FileModifiedDt] than an undeleted source row. A winning source
							row takes the target's slot. The row that loses, the target
							row a source row beats or the source row a target row beats,
							moves with the deleted mark into the caller's older store: the
							store of the caller's sandbox, tier project, whose segment is
							@p_FromKey after path:, created where absent. So a fleet store
							keeps no deleted row from an adoption, and an adoption never
							writes or deletes a memq row and never clears an archived flag
							or a deleted mark.

							That older store holds one row per file key. Where it already
							holds a deleted row of the loser's file key, that row is
							rewritten in place with the loser's fields and keeps its deleted
							mark, and the loser's own row is removed with its mem.Embedding
							and mem.Usage rows; a deleted loser's usage and embeddings are
							not kept. Where it holds a live row of the file key, the
							caller's own older copy, no loser is placed over it: the source
							row and the target row both stay as they are and the source row
							is named as skipped, until the caller's next publish retires
							that older row. A second call changes nothing, since what stays
							in the source store is a named row left in place.

							Calls serialize with every publish on the fleet publish lock.
							Returns one row, one column [Json], holding {moved, merged,
							skipped, mergedNames, skippedNames}.
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
			,@FromKey			NVARCHAR(4000)	= NULLIF(LTRIM(RTRIM(@p_FromKey)), '')
			,@ToKey				NVARCHAR(4000)	= NULLIF(LTRIM(RTRIM(@p_ToKey)), '')
			,@SourceStoreId		INT				= NULL
			,@TargetStoreId		INT				= NULL
			,@RecordId			BIGINT			= NULL
			,@TargetRecordId	BIGINT			= NULL
			,@Name				NVARCHAR(200)	= NULL
			,@SourceDeletedDt	DATETIMEOFFSET	= NULL
			,@SourceModifiedDt	DATETIMEOFFSET	= NULL
			,@SourceOrigin		VARCHAR(10)		= NULL
			,@TargetName		NVARCHAR(200)	= NULL
			,@TargetDeletedDt	DATETIMEOFFSET	= NULL
			,@TargetIsArchived	BIT				= NULL
			,@TargetOrigin		VARCHAR(10)		= NULL
			,@TargetModifiedDt	DATETIMEOFFSET	= NULL
			,@OlderStoreId		INT				= NULL
			,@OlderRecordId		BIGINT			= NULL
			,@OlderDeletedDt	DATETIMEOFFSET	= NULL
			,@LoserRecordId		BIGINT			= NULL
			,@Action			VARCHAR(10)		= NULL

	/* What the Adoption Did to Each Source Row. */
	;DECLARE @Outcome TABLE (
		 [RecordId]			BIGINT			NOT NULL
		,[Name]				NVARCHAR(200)	NOT NULL
		,[Disposition]		VARCHAR(10)		NOT NULL
	)

	/********************************************************************************************
		VALIDATE THE CALLER AND THE KEYS, THEN MOVE THE ROWS AS ONE UNIT.
	********************************************************************************************/
	;BEGIN TRY
		/* Resolve the Caller; an Unmapped Login Writes Nothing. */
		;SELECT	@SandboxId = CS.[SandboxId]
		FROM	mem.CallerSandbox() CS

		;IF ( @SandboxId IS NULL )
			THROW 50000, 'mem.usp_AdoptProjectStore: the calling login maps to no sandbox.', 1

		/* Only a Folder-Name Key Is Adopted, and Only Into a Remote Key. */
		;IF (	@FromKey IS NULL
				OR @ToKey IS NULL
				OR LEFT(@FromKey, 5) COLLATE Latin1_General_CS_AS <> 'path:'
				OR LEFT(@ToKey, 7) COLLATE Latin1_General_CS_AS <> 'remote:'
				OR LEN(@FromKey) < 6
				OR LEN(@ToKey) < 8	)
			THROW 50000, 'mem.usp_AdoptProjectStore: @p_FromKey must open path: and @p_ToKey must open remote:.', 1

		/* A Key Longer Than a Store Holds Names No Store; Cut to 400 It Would Name Another. */
		;IF ( LEN(@FromKey) > 400 OR LEN(@ToKey) > 400 )
			THROW 50000, 'mem.usp_AdoptProjectStore: a project key holds at most 400 characters.', 1

		/* Open a Transaction Unless the Caller Holds One. */
		;IF ( @EntryTranCount = 0 )
			BEGIN TRANSACTION

		/* An Adoption Takes the Fleet Publish Lock, so It Never Interleaves With a Publish of Either Store. */
		;EXEC @LockResult = sp_getapplock @Resource = 'mem.Publish', @LockMode = 'Exclusive', @LockOwner = 'Transaction', @LockTimeout = 30000
		;IF ( @LockResult < 0 )
			THROW 50000, 'mem.usp_AdoptProjectStore: the fleet publish lock was not acquired before the wait timed out; another publish is holding it.', 1

		/****************************************************************************************
			RESOLVE THE TWO STORES.
		****************************************************************************************/
		;SELECT	@SourceStoreId = S.[StoreId]
		FROM	mem.Store S
		WHERE	S.[Tier] = 'project'
				AND S.[ProjectKey] = @FromKey

		;SELECT	@TargetStoreId = S.[StoreId]
		FROM	mem.Store S
		WHERE	S.[Tier] = 'project'
				AND S.[ProjectKey] = @ToKey

		;IF ( @SourceStoreId IS NOT NULL AND @TargetStoreId IS NULL )
		BEGIN
			;INSERT INTO mem.Store (
				 [SandboxId]
				,[Tier]
				,[Segment]
				,[ProjectKey]	)
			SELECT	 [SandboxId]	= NULL
					,[Tier]			= 'project'
					,[Segment]		= NULL
					,[ProjectKey]	= @ToKey

			;SET @TargetStoreId = SCOPE_IDENTITY()
		END

		/* The Caller's Older Store for the Folder's Segment, Where It Has One; a Loser Creates It Below. */
		;SELECT	@OlderStoreId = S.[StoreId]
		FROM	mem.Store S
		WHERE	S.[SandboxId] = @SandboxId
				AND S.[Tier] = 'project'
				AND S.[Segment] = SUBSTRING(@FromKey, 6, 400)
				AND S.[ProjectKey] IS NULL

		/****************************************************************************************
			MOVE, MERGE OR LEAVE EACH SOURCE ROW.
		****************************************************************************************/
		;SELECT	@RecordId = MIN(R.[RecordId])
		FROM	mem.Record R
		WHERE	R.[StoreId] = @SourceStoreId

		;WHILE ( @RecordId IS NOT NULL )
		BEGIN
			;SELECT	 @Name				= R.[Name]
					,@SourceDeletedDt	= R.[DeletedDt]
					,@SourceModifiedDt	= R.[FileModifiedDt]
					,@SourceOrigin		= R.[Origin]
					,@TargetRecordId	= NULL
					,@TargetName		= NULL
					,@TargetDeletedDt	= NULL
					,@TargetIsArchived	= NULL
					,@TargetOrigin		= NULL
					,@TargetModifiedDt	= NULL
			FROM	mem.Record R
			WHERE	R.[RecordId] = @RecordId

			/* The Target Row of the Same File Key, Equal Under the Database's Collation. */
			;SELECT	 @TargetRecordId	= T.[RecordId]
					,@TargetName		= T.[Name]
					,@TargetDeletedDt	= T.[DeletedDt]
					,@TargetIsArchived	= T.[IsArchived]
					,@TargetOrigin		= T.[Origin]
					,@TargetModifiedDt	= T.[FileModifiedDt]
			FROM	mem.Record T
					INNER JOIN mem.Record R
						ON R.[RecordId] = @RecordId
			WHERE	T.[StoreId] = @TargetStoreId
					AND T.[FileKey] = R.[FileKey]

			/* The Caller's Older Row of the Same File Key, Equal Under the Database's Collation. */
			;SELECT	 @OlderRecordId		= NULL
					,@OlderDeletedDt	= NULL
					,@LoserRecordId		= NULL
					,@Action			= NULL

			;SELECT	 @OlderRecordId		= O.[RecordId]
					,@OlderDeletedDt	= O.[DeletedDt]
			FROM	mem.Record O
					INNER JOIN mem.Record R
						ON R.[RecordId] = @RecordId
			WHERE	O.[StoreId] = @OlderStoreId
					AND O.[FileKey] = R.[FileKey]

			/************************************************************************************
				DECIDE WHAT THE ROW DOES.
			************************************************************************************/
			;IF ( @TargetRecordId IS NULL )
			BEGIN
				/* No Target Row: the Row Moves, Its Embeddings and Usage With It. */
				;SET @Action = 'move'
			END
			ELSE IF (	( @TargetDeletedDt IS NULL AND @TargetName <> @Name )
						OR ( @TargetDeletedDt IS NOT NULL AND @TargetName COLLATE Latin1_General_CS_AS <> @Name COLLATE Latin1_General_CS_AS )	)
			BEGIN
				/* A Target Row of Another Name Holds the File Key: the Row Stays and is Named. A Deleted One Differing in Case Alone is Another Name. */
				;SET @Action = 'skip'
			END
			ELSE IF ( @SourceDeletedDt IS NOT NULL )
			BEGIN
				/* A Deleted Source Row Over a Target Row of Its Name Changes Nothing. */
				;SET @Action = NULL
			END
			ELSE IF ( @OlderRecordId IS NOT NULL AND @OlderDeletedDt IS NULL )
			BEGIN
				/* The Caller's Own Live Older Copy Holds the Slot a Loser Would Take: Both Rows Stay and the Row is Named. */
				;SET @Action = 'skip'
			END
			ELSE IF ( @SourceOrigin = 'memq' )
			BEGIN
				/* A memq Source Row is Never Deleted: It Takes a Live, Unarchived File Target's Slot Whatever the Times, and Otherwise Stays and is Named. */
				;IF ( @TargetDeletedDt IS NULL AND @TargetIsArchived = @False AND @TargetOrigin = 'file' )
				BEGIN
					;SELECT	 @Action		= 'win'
							,@LoserRecordId	= @TargetRecordId
				END ELSE BEGIN
					;SET @Action = 'skip'
				END
			END
			ELSE IF (	@TargetDeletedDt IS NULL
						AND @TargetIsArchived = @False
						AND @TargetOrigin = 'file'
						AND @SourceModifiedDt IS NOT NULL
						AND @TargetModifiedDt IS NOT NULL
						AND @SourceModifiedDt > @TargetModifiedDt	)
			BEGIN
				/* The Source Row Wins and the Target Row Loses. */
				;SELECT	 @Action		= 'win'
						,@LoserRecordId	= @TargetRecordId
			END
			ELSE
			BEGIN
				/* The Target Row Wins and the Source Row Loses. */
				;SELECT	 @Action		= 'lose'
						,@LoserRecordId	= @RecordId
			END

			/************************************************************************************
				APPLY WHAT WAS DECIDED.
			************************************************************************************/
			;IF ( @LoserRecordId IS NOT NULL AND @OlderStoreId IS NULL )
			BEGIN
				/* The Caller's Older Store for the Folder's Segment, Created Where Absent. */
				;INSERT INTO mem.Store (
					 [SandboxId]
					,[Tier]
					,[Segment]	)
				SELECT	 [SandboxId]	= @SandboxId
						,[Tier]			= 'project'
						,[Segment]		= SUBSTRING(@FromKey, 6, 400)

				;SET @OlderStoreId = SCOPE_IDENTITY()
			END

			;IF ( @LoserRecordId IS NOT NULL AND @OlderRecordId IS NULL )
			BEGIN
				/* The Loser Moves Into the Older Store With the Deleted Mark, Its Embeddings and Usage With It. */
				;UPDATE R
				SET		 [StoreId]		= @OlderStoreId
						,[DeletedDt]	= @Now
						,[UpdatedDt]	= @Now
				FROM	mem.Record R
				WHERE	R.[RecordId] = @LoserRecordId
			END
			ELSE IF ( @LoserRecordId IS NOT NULL )
			BEGIN
				/* The Older Store's Deleted Row Takes the Loser's Fields and Keeps Its Deleted Mark; Vectors Made From Other Text Go. */
				;DELETE E
				FROM	mem.Embedding E
						INNER JOIN mem.Record O
							ON O.[RecordId] = E.[RecordId]
						INNER JOIN mem.Record L
							ON L.[RecordId] = @LoserRecordId
				WHERE	E.[RecordId] = @OlderRecordId
						AND (	O.[BodyHash] <> L.[BodyHash]
								OR O.[Name] <> L.[Name]	)

				;UPDATE O
				SET		 [Name]						= L.[Name]
						,[Description]				= L.[Description]
						,[Body]						= L.[Body]
						,[BodyHash]					= L.[BodyHash]
						,[FileModifiedDt]			= L.[FileModifiedDt]
						,[Machine]					= L.[Machine]
						,[Tags]						= L.[Tags]
						,[SupersedesName]			= L.[SupersedesName]
						,[Author]					= L.[Author]
						,[IsArchived]				= L.[IsArchived]
						,[Space]					= L.[Space]
						,[Triggers]					= L.[Triggers]
						,[Anchors]					= L.[Anchors]
						,[IsPinned]					= L.[IsPinned]
						,[CreatedOn]				= L.[CreatedOn]
						,[Origin]					= L.[Origin]
						,[WrittenBySandboxId]		= L.[WrittenBySandboxId]
						,[Visibility]				= L.[Visibility]
						,[LastPublishedBySandboxId]	= L.[LastPublishedBySandboxId]
						,[LastPublishedDt]			= L.[LastPublishedDt]
						,[UpdatedDt]				= @Now
				FROM	mem.Record O
						INNER JOIN mem.Record L
							ON L.[RecordId] = @LoserRecordId
				WHERE	O.[RecordId] = @OlderRecordId

				/* The Loser's Own Row Goes, With the Rows That Hang From It. */
				;DELETE E
				FROM	mem.Embedding E
				WHERE	E.[RecordId] = @LoserRecordId

				;DELETE U
				FROM	mem.Usage U
				WHERE	U.[RecordId] = @LoserRecordId

				;DELETE R
				FROM	mem.Record R
				WHERE	R.[RecordId] = @LoserRecordId
			END

			;IF ( @Action IN ('move', 'win') )
			BEGIN
				/* The Source Row Takes the Target Store's Slot, Its Embeddings and Usage With It. */
				;UPDATE R
				SET		 [StoreId]		= @TargetStoreId
						,[UpdatedDt]	= @Now
				FROM	mem.Record R
				WHERE	R.[RecordId] = @RecordId
			END

			;IF ( @Action IS NOT NULL )
			BEGIN
				;INSERT INTO @Outcome (
					 [RecordId]
					,[Name]
					,[Disposition]	)
				SELECT	 [RecordId]		= @RecordId
						,[Name]			= @Name
						,[Disposition]	= CASE @Action
											WHEN 'move'	THEN 'moved'
											WHEN 'skip'	THEN 'skipped'
											ELSE 'merged'
										  END
			END

			;SELECT	@RecordId = MIN(R.[RecordId])
			FROM	mem.Record R
			WHERE	R.[StoreId] = @SourceStoreId
					AND R.[RecordId] > @RecordId
		END

		/* Commit Only a Transaction This Procedure Opened. */
		;IF ( @EntryTranCount = 0 )
			COMMIT TRANSACTION

		/****************************************************************************************
			DATASET 1: THE COUNTS AND THE NAMES A READER ACTS ON.
		****************************************************************************************/
		;SELECT	[Json] = (	SELECT	 [moved]			= (	SELECT COUNT(*) FROM @Outcome O WHERE O.[Disposition] = 'moved' )
									,[merged]			= (	SELECT COUNT(*) FROM @Outcome O WHERE O.[Disposition] = 'merged' )
									,[skipped]			= (	SELECT COUNT(*) FROM @Outcome O WHERE O.[Disposition] = 'skipped' )
									,[mergedNames]		= JSON_QUERY(COALESCE((	SELECT	'[' + STRING_AGG(CAST(N'"' + STRING_ESCAPE(O.[Name], 'json') + N'"' AS NVARCHAR(MAX)), N',')
																							WITHIN GROUP ( ORDER BY O.[RecordId] ) + ']'
																				FROM	@Outcome O
																				WHERE	O.[Disposition] = 'merged'	), N'[]'))
									,[skippedNames]		= JSON_QUERY(COALESCE((	SELECT	'[' + STRING_AGG(CAST(N'"' + STRING_ESCAPE(O.[Name], 'json') + N'"' AS NVARCHAR(MAX)), N',')
																							WITHIN GROUP ( ORDER BY O.[RecordId] ) + ']'
																				FROM	@Outcome O
																				WHERE	O.[Disposition] = 'skipped'	), N'[]'))
							FOR JSON PATH, WITHOUT_ARRAY_WRAPPER	)
	END TRY
	BEGIN CATCH
		/* Unwind Only a Transaction This Procedure Opened; a Caller's is the Caller's to Unwind. */
		/* A ROLLBACK Inside an INSERT-EXEC Raises Error 3915 in Place of the Server's Own Error Text. */
		;IF ( XACT_STATE() <> 0 AND @EntryTranCount = 0 )
			ROLLBACK TRANSACTION

		/* Re-Raise so the Caller Never Reads Success From a Failed Write. */
		;THROW
	END CATCH
END
GO
