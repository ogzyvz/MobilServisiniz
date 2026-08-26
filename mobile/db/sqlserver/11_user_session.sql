/* ==========================================================================
   OtoServis — Tek oturum (tek cihaz) desteği
   ========================================================================== */
USE OtoServis;
GO
SET NOCOUNT ON;
SET QUOTED_IDENTIFIER ON;
GO

IF COL_LENGTH(N'dbo.users', N'session_id') IS NULL
BEGIN
    ALTER TABLE dbo.users ADD session_id uniqueidentifier NULL;
    PRINT N'users.session_id eklendi.';
END
ELSE
    PRINT N'users.session_id zaten var.';
GO
