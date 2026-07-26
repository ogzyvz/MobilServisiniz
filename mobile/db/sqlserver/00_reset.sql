/* OtoServis — Veritabanını sıfırla (temiz kurulum için) */
USE master;
GO

IF DB_ID(N'OtoServis') IS NOT NULL
BEGIN
    ALTER DATABASE OtoServis SET SINGLE_USER WITH ROLLBACK IMMEDIATE;
    DROP DATABASE OtoServis;
    PRINT N'OtoServis veritabanı silindi.';
END
ELSE
    PRINT N'OtoServis veritabanı zaten yok.';
GO
