/* ==========================================================================
   OtoServis — Şikayet / istek kategori alanı
   --------------------------------------------------------------------------
   complaints.category: motor, fren, elektrik, klima, suspansiyon, kaporta,
   lastik, yag_bakim, diagnostik, istek, diger
   ========================================================================== */
USE OtoServis;
GO
SET NOCOUNT ON;
SET QUOTED_IDENTIFIER ON;
SET ANSI_NULLS ON;
GO

IF COL_LENGTH(N'dbo.complaints', N'category') IS NULL
BEGIN
    ALTER TABLE dbo.complaints ADD category nvarchar(30) NOT NULL
        CONSTRAINT DF_complaints_category DEFAULT N'diger';
    PRINT N'complaints.category eklendi.';
END
ELSE PRINT N'complaints.category zaten var.';
GO

IF NOT EXISTS (
    SELECT 1 FROM sys.check_constraints
    WHERE name = N'CK_complaints_category' AND parent_object_id = OBJECT_ID(N'dbo.complaints')
)
BEGIN
    ALTER TABLE dbo.complaints WITH NOCHECK ADD CONSTRAINT CK_complaints_category CHECK (
        category IN (
            N'motor', N'fren', N'elektrik', N'klima', N'suspansiyon',
            N'kaporta', N'lastik', N'yag_bakim', N'diagnostik', N'istek', N'diger'
        )
    );
    PRINT N'CK_complaints_category eklendi.';
END
ELSE PRINT N'CK_complaints_category zaten var.';
GO
