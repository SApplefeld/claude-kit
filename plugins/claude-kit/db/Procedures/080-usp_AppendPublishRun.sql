-- CREATE THE PROCEDURE WITH QUOTED_IDENTIFIER ON; PROCEDURES CAPTURE IT AT CREATE TIME.
;SET QUOTED_IDENTIFIER ON
GO

-- CREATE A SHELL PROCEDURE IF NONE EXISTS.
;IF OBJECT_ID('mem.usp_AppendPublishRun', 'P') IS NULL
  EXEC ('CREATE PROCEDURE mem.usp_AppendPublishRun AS RETURN 0;')
GO

-- ALTER THE UPDATED PROCEDURE DEFINITION.
;ALTER PROCEDURE mem.usp_AppendPublishRun
(
	/*********************************************************************************************
	 PARAMETER NAME		DATATYPE		DEFAULT
	*********************************************************************************************/
	 @p_Run				NVARCHAR(MAX)
)
AS
BEGIN	-- PROCEDURE

	/********************************************************************************************
	*********************************************************************************************
		SCRIPT:		mem.usp_AppendPublishRun
		AUTHOR:		Scott Applefeld
		DATE:		September 17th, 2026
		VERSION:	v1.0
	*********************************************************************************************
		NOTES:		v1.0 - 09/17/2026 - SCOTT APPLEFELD
							Records one publisher run for the calling sandbox. @p_Run is one
							JSON object {started, finished, added, changed, removed,
							embedded, spoolDrained, error}. The publisher login is
							execute-only, so this procedure is the only way a run reaches
							mem.PublishRun.

							Returns one row, one column [Json], holding {publishRunId}.
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
			,@PublishRunId		BIGINT			= NULL
			,@StartedDt			DATETIMEOFFSET	= NULL
			,@FinishedDt		DATETIMEOFFSET	= NULL
			,@AddedCount		INT				= 0
			,@ChangedCount		INT				= 0
			,@RemovedCount		INT				= 0
			,@EmbeddedCount		INT				= 0
			,@SpoolDrainedCount	INT				= 0
			,@ErrorText			NVARCHAR(MAX)	= NULL

	/********************************************************************************************
		VALIDATE THE CALLER AND THE RUN, THEN INSERT THE ROW.
	********************************************************************************************/
	;BEGIN TRY
		/* Resolve the Caller; an Unmapped Login Writes Nothing. */
		;SELECT	@SandboxId = CS.[SandboxId]
		FROM	mem.CallerSandbox() CS

		;IF ( @SandboxId IS NULL )
			THROW 50000, 'mem.usp_AppendPublishRun: the calling login maps to no sandbox.', 1

		;IF ( @p_Run IS NULL OR ISJSON(@p_Run, OBJECT) <> 1 )
			THROW 50000, 'mem.usp_AppendPublishRun: @p_Run must be a JSON object.', 1

		/* Parse the Run. */
		;SELECT	 @StartedDt			= J.[StartedDt]
				,@FinishedDt		= J.[FinishedDt]
				,@AddedCount		= COALESCE(J.[AddedCount], 0)
				,@ChangedCount		= COALESCE(J.[ChangedCount], 0)
				,@RemovedCount		= COALESCE(J.[RemovedCount], 0)
				,@EmbeddedCount		= COALESCE(J.[EmbeddedCount], 0)
				,@SpoolDrainedCount	= COALESCE(J.[SpoolDrainedCount], 0)
				,@ErrorText			= NULLIF(LTRIM(RTRIM(J.[ErrorText])), '')
		FROM	OPENJSON(@p_Run)
				WITH (	 [StartedDt]		DATETIMEOFFSET	'$.started'
						,[FinishedDt]		DATETIMEOFFSET	'$.finished'
						,[AddedCount]		INT				'$.added'
						,[ChangedCount]		INT				'$.changed'
						,[RemovedCount]		INT				'$.removed'
						,[EmbeddedCount]	INT				'$.embedded'
						,[SpoolDrainedCount]	INT			'$.spoolDrained'
						,[ErrorText]		NVARCHAR(MAX)	'$.error'	) J

		;IF ( @StartedDt IS NULL )
			THROW 50000, 'mem.usp_AppendPublishRun: the run needs a started timestamp.', 1

		/* Insert the Run. */
		;INSERT INTO mem.PublishRun (
			 [SandboxId]
			,[StartedDt]
			,[FinishedDt]
			,[AddedCount]
			,[ChangedCount]
			,[RemovedCount]
			,[EmbeddedCount]
			,[SpoolDrainedCount]
			,[ErrorText]		)
		SELECT	 [SandboxId]		= @SandboxId
				,[StartedDt]		= @StartedDt
				,[FinishedDt]		= @FinishedDt
				,[AddedCount]		= @AddedCount
				,[ChangedCount]		= @ChangedCount
				,[RemovedCount]		= @RemovedCount
				,[EmbeddedCount]	= @EmbeddedCount
				,[SpoolDrainedCount]	= @SpoolDrainedCount
				,[ErrorText]		= @ErrorText

		;SELECT @PublishRunId = SCOPE_IDENTITY()

		/****************************************************************************************
			DATASET 1: THE NEW ROW'S ID.
		****************************************************************************************/
		;SELECT	[Json] = (	SELECT	 [publishRunId]	= @PublishRunId
							FOR JSON PATH, WITHOUT_ARRAY_WRAPPER	)
	END TRY
	BEGIN CATCH
		/* Re-Raise so the Caller Never Reads Success From a Failed Write. */
		;THROW
	END CATCH
END
GO
