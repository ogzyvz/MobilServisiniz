/* ==========================================================================
   OtoServis — İş emri: işi yapan personel ataması
   --------------------------------------------------------------------------
   Mevcut sunucu DB'sinde çalıştırın (SSMS / sqlcmd).
   - assigned_user_id   : Zaten vardı ama hiç kullanılmıyordu (dbo.users FK'lı).
   - assigned_user_name : Sistemde kayıtlı olmayan biri elle girildiğinde.
   ========================================================================== */

USE OtoServis;
GO
SET NOCOUNT ON;
GO

/* assigned_user_name yoksa ekle */
IF COL_LENGTH(N'dbo.work_orders', N'assigned_user_name') IS NULL
BEGIN
    ALTER TABLE dbo.work_orders ADD assigned_user_name nvarchar(150) NULL;
    PRINT N'assigned_user_name eklendi.';
END
ELSE
    PRINT N'assigned_user_name zaten var.';
GO

PRINT N'Tamam. Kontrol:';
SELECT COLUMN_NAME, DATA_TYPE, CHARACTER_MAXIMUM_LENGTH
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_SCHEMA = N'dbo' AND TABLE_NAME = N'work_orders'
  AND COLUMN_NAME IN (N'assigned_user_id', N'assigned_user_name')
ORDER BY COLUMN_NAME;
GO
