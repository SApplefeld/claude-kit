-- CREATE THE PROCEDURE WITH QUOTED_IDENTIFIER ON; PROCEDURES CAPTURE IT AT CREATE TIME.
;SET QUOTED_IDENTIFIER ON
GO

-- CREATE A SHELL PROCEDURE IF NONE EXISTS.
;IF OBJECT_ID('mem.usp_Nearest', 'P') IS NULL
  EXEC ('CREATE PROCEDURE mem.usp_Nearest AS RETURN 0;')
GO

-- ALTER THE UPDATED PROCEDURE DEFINITION.
;ALTER PROCEDURE mem.usp_Nearest
(
	/*********************************************************************************************
	 PARAMETER NAME		DATATYPE		DEFAULT
	*********************************************************************************************/
	 @p_Vector			VECTOR(1024)
	,@p_Limit			INT				= 10
	,@p_ModelIdentity	VARCHAR(200)	= NULL
)
AS
BEGIN	-- PROCEDURE

	/********************************************************************************************
	*********************************************************************************************
		SCRIPT:		mem.usp_Nearest
		AUTHOR:		Scott Applefeld
		DATE:		September 17th, 2026
		VERSION:	v1.1
	*********************************************************************************************
		NOTES:		v1.1 - 09/19/2026 - SCOTT APPLEFELD
							[distance] is quantized to two decimals and typed to carry no
							more, as DECIMAL(3,2). The type is load-bearing: ROUND on a
							FLOAT quantizes the value, but FOR JSON serializes the float
							in its own form, measured as 1.200000000000000e-001 on this
							server, which reads as a guard that failed even though the
							quantization survives. The cast makes the text say what the
							value is. mem.usp_Search carries the identical expression, and
							the two are worth nothing apart; see its banner for why.

							@p_Vector is the caller's
							own and is under no obligation to embed anything, so an exact
							distance is a real-valued oracle over body text no procedure here
							returns: repeated calls with crafted vectors solve for a record's
							chunk embedding, and a promoted project record's body exists on no
							other sandbox's disk. Two decimals is what every surface that
							prints the number shows, so the rounding costs the reading nothing.

							The rounding lives in both procedures that return a distance rather
							than in whichever one needed it first, because it is a property of
							this output channel and not of one caller. mem_publisher holds
							EXECUTE on mem.usp_Search and mem.usp_Nearest alike, over one
							visible-record set, so a rounding applied to one and not the other
							is no rounding at all: the same login reads the unrounded number
							from the other procedure on the same grant. A third procedure that
							returns a distance takes this same rounding at the same place.

							What the rounding does not do is make the oracle impossible. It
							coarsens it, and the quantity of crafted queries a two-decimal
							distance still admits is unmeasured here.

					v1.0 - 09/17/2026 - SCOTT APPLEFELD
							The neighbours shape: the live records nearest to @p_Vector by
							cosine distance, each on its best chunk, over the rows the caller
							may see through mem.udf_VisibleRecords for the sandbox
							mem.CallerSandbox() resolves. An unmapped login sees nothing.
							@p_ModelIdentity, when given, keeps the scan to embeddings that
							model produced. One mem.QueryLog row is written before the result
							returns, its digest a SHA-256 over the vector's text.

							Returns one row, one column [Json], a JSON array of {recordId,
							name, fileKey, tier, segment, sandbox, visibility, description,
							distance, chunkIndex} ordered nearest first.
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
			,@Limit				INT				= NULL
			,@MaxLimit			INT				= 50
			,@RowCount			INT				= 0
			,@Digest			VARCHAR(64)		= NULL

	/* The Nearest Rows, Created Unconditionally so an Outer Scope Cannot Plant One. */
	;CREATE TABLE #Nearest (
		 [NeighbourRank]	INT				NOT NULL
		,[RecordId]			BIGINT			NOT NULL	PRIMARY KEY
		,[Distance]			FLOAT			NOT NULL
		,[ChunkIndex]		INT				NOT NULL
	)

	/********************************************************************************************
		RESOLVE THE CALLER, SCAN, LOG AND RETURN.
	********************************************************************************************/
	;BEGIN TRY
		;IF ( @p_Vector IS NULL )
			THROW 50000, 'mem.usp_Nearest: @p_Vector is required.', 1

		;IF ( @p_Limit IS NULL OR @p_Limit <= 0 )
			THROW 50000, 'mem.usp_Nearest: @p_Limit must be greater than zero.', 1

		/* Serve an Oversized Request at the Ceiling. */
		;SELECT @Limit = CASE WHEN @p_Limit > @MaxLimit THEN @MaxLimit ELSE @p_Limit END

		;SELECT @Digest = CONVERT(VARCHAR(64), HASHBYTES('SHA2_256', CAST(@p_Vector AS NVARCHAR(MAX))), 2)

		/* Resolve the Caller Once; an Unmapped Login Fills Nothing Below. */
		;SELECT	@SandboxId = CS.[SandboxId]
		FROM	mem.CallerSandbox() CS

		/* Rank the Visible Live Records by Their Best Chunk's Distance. */
		;WITH cteBestChunk AS (
			SELECT	 [RecordId]		= E.[RecordId]
					,[ChunkIndex]	= E.[ChunkIndex]
					,[Distance]		= D.[Distance]
					,[ChunkRowNumber]	= ROW_NUMBER() OVER ( PARTITION BY E.[RecordId] ORDER BY D.[Distance], E.[ChunkIndex] )
			FROM	mem.Embedding E
					INNER JOIN mem.udf_VisibleRecords(@SandboxId) V
						ON V.[RecordId] = E.[RecordId]
					CROSS APPLY ( SELECT [Distance] = VECTOR_DISTANCE('cosine', E.[Vector], @p_Vector) ) D
			WHERE	V.[IsArchived] = @False
					AND (	@p_ModelIdentity IS NULL
							OR E.[ModelIdentity] = @p_ModelIdentity	)
		)
		INSERT INTO #Nearest ( [NeighbourRank], [RecordId], [Distance], [ChunkIndex] )
		SELECT	TOP ( @Limit )
				 [NeighbourRank]	= ROW_NUMBER() OVER ( ORDER BY B.[Distance], B.[RecordId] )
				,[RecordId]			= B.[RecordId]
				,[Distance]			= B.[Distance]
				,[ChunkIndex]		= B.[ChunkIndex]
		FROM	cteBestChunk B
		WHERE	B.[ChunkRowNumber] = 1
		ORDER BY B.[Distance], B.[RecordId]

		;SELECT	@RowCount = COUNT(*)
		FROM	#Nearest

		/* Log the Call Before Returning; the Result Can Carry Another Sandbox's Shared Rows. */
		;INSERT INTO mem.QueryLog (
			 [Login]
			,[ProcedureName]
			,[SandboxId]
			,[ParametersDigest]
			,[RowCount]		)
		SELECT	 [Login]			= ORIGINAL_LOGIN()
				,[ProcedureName]	= 'usp_Nearest'
				,[SandboxId]		= @SandboxId
				,[ParametersDigest]	= @Digest
				,[RowCount]			= @RowCount

		/****************************************************************************************
			DATASET 1: THE NEIGHBOURS, NEAREST FIRST.
		****************************************************************************************/
		;SELECT	[Json] = COALESCE((
			SELECT	 [recordId]		= N.[RecordId]
					,[name]			= V.[Name]
					,[fileKey]		= V.[FileKey]
					,[tier]			= V.[Tier]
					,[segment]		= V.[Segment]
					,[sandbox]		= COALESCE(SS.[Name], PS.[Name])
					,[visibility]	= V.[Visibility]
					,[description]	= V.[Description]
					,[distance]		= CAST(ROUND(N.[Distance], 2) AS DECIMAL(3,2))
					,[chunkIndex]	= N.[ChunkIndex]
			FROM	#Nearest N
					INNER JOIN mem.udf_VisibleRecords(@SandboxId) V
						ON V.[RecordId] = N.[RecordId]
					LEFT JOIN mem.Sandbox SS
						ON SS.[SandboxId] = V.[StoreSandboxId]
					LEFT JOIN mem.Sandbox PS
						ON PS.[SandboxId] = V.[LastPublishedBySandboxId]
			ORDER BY N.[NeighbourRank]
			FOR JSON PATH, INCLUDE_NULL_VALUES ), N'[]')
	END TRY
	BEGIN CATCH
		;THROW
	END CATCH
END
GO
