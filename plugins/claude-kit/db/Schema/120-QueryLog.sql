/*********************************************************************************
	TABLE: mem.QueryLog

	One row per call of a procedure that can return another sandbox's shared
	rows: mem.usp_Search and mem.usp_Nearest write one each before they return.
	[Login] is the login the procedure resolved the sandbox from: the login that
	opened the connection (ORIGINAL_LOGIN()), the only input mem.CallerSandbox()
	reads. [SessionLogin] is the security context the call ran under, as
	SUSER_SNAME() names it: the login, or for a user without a login that
	user's SID as text (S-1-9-3-...), with the user name as the fallback where
	SUSER_SNAME() is null. It is captured by the column default and never
	accepted as a parameter, and equals [Login] except under EXECUTE AS, so a
	read that ran impersonated is visible as a row whose two logins differ.
	[ParametersDigest] is a SHA-256 hex digest of the query text or the query
	vector's text, never the text itself.
*********************************************************************************/
;IF NOT EXISTS(	SELECT	NULL
				FROM	sys.schemas S
						LEFT JOIN sys.tables T
							ON S.[schema_id] = T.[schema_id]
				WHERE	S.[name] = 'mem'
						AND T.[name] = 'QueryLog'  )
BEGIN
	;CREATE TABLE mem.QueryLog (
		 [QueryLogId]			BIGINT			NOT NULL	IDENTITY(1,1)

		/* Caller Fields */
		,[Login]				NVARCHAR(128)	NOT NULL
		,[SessionLogin]			NVARCHAR(128)	NOT NULL	DEFAULT(COALESCE(SUSER_SNAME(), USER_NAME()))
		,[ProcedureName]		NVARCHAR(200)	NOT NULL
		,[SandboxId]			INT				NULL

		/* Request Fields */
		,[ParametersDigest]		VARCHAR(64)		NOT NULL
		,[RowCount]				INT				NOT NULL	DEFAULT(0)

		/* Audit Fields */
		,[CreatedDt]			DATETIMEOFFSET	NOT NULL	DEFAULT(SYSDATETIMEOFFSET())
		,[UpdatedDt]			DATETIMEOFFSET	NOT NULL	DEFAULT(SYSDATETIMEOFFSET())

		-- FOREIGN KEYS.
		,CONSTRAINT		FK_QueryLog_Sandbox
						FOREIGN KEY	( [SandboxId] )
						REFERENCES	mem.Sandbox ( [SandboxId] )

		-- PRIMARY KEY.
		,CONSTRAINT		PK_QueryLog
						PRIMARY KEY	CLUSTERED	( [QueryLogId] )
	)
END
GO

-- Check for and Create IX_QueryLog_CreatedDt.
;IF NOT EXISTS(	SELECT	NULL
				FROM	sys.indexes I
				WHERE	I.[object_id] = OBJECT_ID('mem.QueryLog')
						AND I.[name] = 'IX_QueryLog_CreatedDt' )
BEGIN
	;CREATE NONCLUSTERED INDEX IX_QueryLog_CreatedDt
		ON mem.QueryLog (  [CreatedDt]	)
END
GO
