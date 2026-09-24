-- DROP AND RE-CREATE THE FUNCTION.
;IF OBJECT_ID('mem.udf_VisibleRecords') IS NOT NULL
  EXEC ('DROP FUNCTION mem.udf_VisibleRecords;')
GO

;CREATE FUNCTION mem.udf_VisibleRecords
(
	@p_SandboxId	INT
)
RETURNS TABLE
AS
RETURN
(
	/********************************************************************************************
	*********************************************************************************************
		SCRIPT:		mem.udf_VisibleRecords
		AUTHOR:		Scott Applefeld
		DATE:		September 17th, 2026
		VERSION:	v1.0
	*********************************************************************************************
		NOTES:		v1.0 - 09/17/2026 - SCOTT APPLEFELD
							The one statement of what a publisher may see: every shared row,
							plus the private rows of the stores its own sandbox owns, never a
							row carrying a deleted mark. A NULL @p_SandboxId returns no rows,
							so an unmapped login is fail-closed inside the predicate itself and
							not by each caller remembering to check. Every publisher read and
							every publisher write that takes a record id filters through this
							function before it ranks or writes.
	*********************************************************************************************
	********************************************************************************************/
	SELECT	 [RecordId]					= R.[RecordId]
			,[StoreId]					= R.[StoreId]
			,[Tier]						= S.[Tier]
			,[Segment]					= S.[Segment]
			,[StoreSandboxId]			= S.[SandboxId]
			,[Name]						= R.[Name]
			,[FileKey]					= R.[FileKey]
			,[Description]				= R.[Description]
			,[Body]						= R.[Body]
			,[SupersedesName]			= R.[SupersedesName]
			,[IsArchived]				= R.[IsArchived]
			,[Visibility]				= R.[Visibility]
			,[LastPublishedBySandboxId]	= R.[LastPublishedBySandboxId]
			,[UpdatedDt]				= R.[UpdatedDt]
	FROM	mem.Record R
			INNER JOIN mem.Store S
				ON S.[StoreId] = R.[StoreId]
	WHERE	@p_SandboxId IS NOT NULL
			AND R.[DeletedDt] IS NULL
			AND (	R.[Visibility] = 'shared'
					OR S.[SandboxId] = @p_SandboxId	)
)
GO
