/* ==========================================================================
   OtoServis — Motor No + Motor Hacmi alanları
   --------------------------------------------------------------------------
   Mevcut sunucu DB'sinde çalıştırın (SSMS / sqlcmd).
   - engine_no     : Motor numarası (çoğu kurulumda zaten var)
   - engine_volume : Motor hacmi (örn. 1598 cm³ / 1.6)
   ========================================================================== */

USE OtoServis;
GO
SET NOCOUNT ON;
GO

/* engine_no yoksa ekle */
IF COL_LENGTH(N'dbo.vehicles', N'engine_no') IS NULL
BEGIN
    ALTER TABLE dbo.vehicles ADD engine_no nvarchar(32) NULL;
    PRINT N'engine_no eklendi.';
END
ELSE
    PRINT N'engine_no zaten var.';
GO

/* engine_volume yoksa ekle */
IF COL_LENGTH(N'dbo.vehicles', N'engine_volume') IS NULL
BEGIN
    ALTER TABLE dbo.vehicles ADD engine_volume nvarchar(20) NULL;
    PRINT N'engine_volume eklendi.';
END
ELSE
    PRINT N'engine_volume zaten var.';
GO

PRINT N'Tamam. Kontrol:';
SELECT COLUMN_NAME, DATA_TYPE, CHARACTER_MAXIMUM_LENGTH
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_SCHEMA = N'dbo' AND TABLE_NAME = N'vehicles'
  AND COLUMN_NAME IN (N'engine_no', N'engine_volume')
ORDER BY COLUMN_NAME;
GO
