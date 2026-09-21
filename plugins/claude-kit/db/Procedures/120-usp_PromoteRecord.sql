-- CREATE THE PROCEDURE WITH QUOTED_IDENTIFIER ON; PROCEDURES CAPTURE IT AT CREATE TIME.
;SET QUOTED_IDENTIFIER ON
GO

-- CREATE A SHELL PROCEDURE IF NONE EXISTS.
;IF OBJECT_ID('mem.usp_PromoteRecord', 'P') IS NULL
  EXEC ('CREATE PROCEDURE mem.usp_PromoteRecord AS RETURN 0;')
GO

-- ALTER THE UPDATED PROCEDURE DEFINITION.
;ALTER PROCEDURE mem.usp_PromoteRecord
(
	/*********************************************************************************************
	 PARAMETER NAME		DATATYPE		DEFAULT
	*********************************************************************************************/
	 @p_SandboxName		NVARCHAR(100)
	,@p_Segment			NVARCHAR(400)
	,@p_Name			NVARCHAR(200)
	,@p_Tier			VARCHAR(20)		= 'project'
)
AS
BEGIN	-- PROCEDURE

	/********************************************************************************************
	*********************************************************************************************
		SCRIPT:		mem.usp_PromoteRecord
		AUTHOR:		Scott Applefeld
		DATE:		September 17th, 2026
		VERSION:	v1.0
	*********************************************************************************************
		NOTES:		v1.0 - 09/17/2026 - SCOTT APPLEFELD
							Flips one private record to shared so every sandbox can read it.
							The record is named by the sandbox that owns it, the tier and
							segment of its store, and its name. Only a member of mem_curator,
							db_owner or sysadmin may promote: the role grant is the outer
							gate and this check inside the body is the inner one, so a
							procedure granted to the wrong role by a later script still
							refuses. A name that matches no private live row, or more than
							one, is refused rather than guessed at, and so is a tier other
							than project, since the type and operator tiers hold no private
							row.

							Returns one row, one column [Json], holding {recordId, name,
							visibility}.
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
	;DECLARE @SandboxId			INT				= NULL
			,@RecordId			BIGINT			= NULL
			,@MatchCount		INT				= 0
			,@Tier				VARCHAR(20)		= LOWER(LTRIM(RTRIM(@p_Tier)))

	/********************************************************************************************
		GATE THE CALLER, RESOLVE THE ROW, AND FLIP IT.
	********************************************************************************************/
	;BEGIN TRY
		/* The Inner Gate: Curator, Database Owner or Server Administrator. */
		;IF (	COALESCE(IS_ROLEMEMBER('mem_curator'), 0) <> 1
				AND COALESCE(IS_MEMBER('db_owner'), 0) <> 1
				AND COALESCE(IS_SRVROLEMEMBER('sysadmin'), 0) <> 1	)
			THROW 50000, 'mem.usp_PromoteRecord: the caller is not a member of mem_curator.', 1

		/* Only a Project Store Holds Private Rows; the Shared Tiers are Shared by Construction. */
		;IF ( @Tier IS NULL OR @Tier <> 'project' )
			THROW 50000, 'mem.usp_PromoteRecord: @p_Tier must be project; a type or operator tier record is already shared and has nothing to promote.', 1

		;IF ( @p_Name IS NULL OR LTRIM(RTRIM(@p_Name)) = '' )
			THROW 50000, 'mem.usp_PromoteRecord: @p_Name is required.', 1

		/* Resolve the Sandbox Named. */
		;SELECT	@SandboxId = SB.[SandboxId]
		FROM	mem.Sandbox SB
		WHERE	SB.[Name] = @p_SandboxName

		;IF ( @SandboxId IS NULL )
			THROW 50000, 'mem.usp_PromoteRecord: @p_SandboxName names no sandbox.', 1

		/* Find the One Private Live Row in the Sandbox's Store. */
		;SELECT	 @MatchCount	= COUNT(*)
				,@RecordId		= MIN(R.[RecordId])
		FROM	mem.Record R
				INNER JOIN mem.Store S
					ON S.[StoreId] = R.[StoreId]
		WHERE	S.[SandboxId] = @SandboxId
				AND S.[Tier] = @Tier
				AND EXISTS (	SELECT S.[Segment]
								INTERSECT
								SELECT NULLIF(LTRIM(RTRIM(@p_Segment)), '')	)
				AND R.[Name] = LTRIM(RTRIM(@p_Name))
				AND R.[Visibility] = 'private'
				AND R.[DeletedDt] IS NULL

		;IF ( @MatchCount = 0 )
			THROW 50000, 'mem.usp_PromoteRecord: no private live record matches the sandbox, tier, segment and name given.', 1

		;IF ( @MatchCount > 1 )
			THROW 50000, 'mem.usp_PromoteRecord: more than one private live record matches; promote by a unique name.', 1

		/* Flip the Row. */
		;UPDATE R
		SET		 [Visibility]	= 'shared'
				,[UpdatedDt]	= SYSDATETIMEOFFSET()
		FROM	mem.Record R
		WHERE	R.[RecordId] = @RecordId

		/****************************************************************************************
			DATASET 1: THE PROMOTED ROW.
		****************************************************************************************/
		;SELECT	[Json] = (	SELECT	 [recordId]		= R.[RecordId]
									,[name]			= R.[Name]
									,[visibility]	= R.[Visibility]
							FROM	mem.Record R
							WHERE	R.[RecordId] = @RecordId
							FOR JSON PATH, WITHOUT_ARRAY_WRAPPER	)
	END TRY
	BEGIN CATCH
		;THROW
	END CATCH
END
GO
