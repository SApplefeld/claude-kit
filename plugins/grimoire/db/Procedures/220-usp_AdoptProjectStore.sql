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
							that store where absent. Any other pair of keys is refused and
							nothing is written, and so is a key longer than the 400
							characters a store's key holds, which the parameters take whole
							so that no longer key is cut to name another store. The caller's sandbox comes from
							mem.CallerSandbox() and an unmapped login is refused.

							A row moves by its [StoreId] alone, so its embeddings and its
							mem.Usage rows travel with it. Where the target store holds a
							row of the same file key, compared under the database's
							collation, the two are one record: the target row wins unless
							it is live, neither archived nor deleted, of [Origin] file, and
							older by [FileModifiedDt] than an undeleted source row. A
							winning source row takes the target's slot and the target row
							moves into the source store with the deleted mark, in one
							UPDATE; a losing source row takes the deleted mark where it
							stands. So an adoption never writes a memq row and never clears
							an archived flag or a deleted mark. A source row whose file key
							an undeleted target row of another name holds is left in place
							and named. A second call changes nothing, since what stays in
							the source store is a deleted loser or a named row left in place.

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
			,@TargetName		NVARCHAR(200)	= NULL
			,@TargetDeletedDt	DATETIMEOFFSET	= NULL
			,@TargetIsArchived	BIT				= NULL
			,@TargetOrigin		VARCHAR(10)		= NULL
			,@TargetModifiedDt	DATETIMEOFFSET	= NULL

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
				OR LEFT(@FromKey, 5) <> 'path:'
				OR LEFT(@ToKey, 7) <> 'remote:'
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

			;IF ( @TargetRecordId IS NULL )
			BEGIN
				/* No Target Row: the Row Moves, Its Embeddings and Usage With It. */
				;UPDATE R
				SET		 [StoreId]		= @TargetStoreId
						,[UpdatedDt]	= @Now
				FROM	mem.Record R
				WHERE	R.[RecordId] = @RecordId

				;INSERT INTO @Outcome ( [RecordId], [Name], [Disposition] )
				SELECT @RecordId, @Name, 'moved'
			END
			ELSE IF ( @TargetDeletedDt IS NULL AND @TargetName <> @Name )
			BEGIN
				/* An Undeleted Target Row of Another Name Holds the File Key: the Row Stays and is Named. */
				;INSERT INTO @Outcome ( [RecordId], [Name], [Disposition] )
				SELECT @RecordId, @Name, 'skipped'
			END
			ELSE IF (	@SourceDeletedDt IS NULL
						AND @TargetDeletedDt IS NULL
						AND @TargetIsArchived = @False
						AND @TargetOrigin = 'file'
						AND @SourceModifiedDt IS NOT NULL
						AND @TargetModifiedDt IS NOT NULL
						AND @SourceModifiedDt > @TargetModifiedDt	)
			BEGIN
				/* The Source Row Wins: It Takes the Target's Slot and the Target Row Takes the Source's, Deleted, in One UPDATE. */
				;UPDATE R
				SET		 [StoreId]		= CASE WHEN R.[RecordId] = @RecordId THEN @TargetStoreId ELSE @SourceStoreId END
						,[DeletedDt]	= CASE WHEN R.[RecordId] = @RecordId THEN R.[DeletedDt] ELSE @Now END
						,[UpdatedDt]	= @Now
				FROM	mem.Record R
				WHERE	R.[RecordId] IN ( @RecordId, @TargetRecordId )

				;INSERT INTO @Outcome ( [RecordId], [Name], [Disposition] )
				SELECT @RecordId, @Name, 'merged'
			END
			ELSE IF ( @SourceDeletedDt IS NULL )
			BEGIN
				/* The Target Row Wins: the Source Row Takes the Deleted Mark Where It Stands. */
				;UPDATE R
				SET		 [DeletedDt]	= @Now
						,[UpdatedDt]	= @Now
				FROM	mem.Record R
				WHERE	R.[RecordId] = @RecordId

				;INSERT INTO @Outcome ( [RecordId], [Name], [Disposition] )
				SELECT @RecordId, @Name, 'merged'
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
