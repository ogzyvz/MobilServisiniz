/* ==========================================================================
   OtoServis — Fotoğrafları şikayet/işlem satırına bağlama
   --------------------------------------------------------------------------
   Mevcut sunucu DB'sinde çalıştırın (SSMS / sqlcmd), 08_work_order_lifecycle.sql'den
   SONRA.

   Amaç:
   dbo.work_order_images tablosunda şu ana kadar sadece work_order_id ve
   image_type vardı — bir fotoğrafın iş emrindeki HANGİ şikayete ya da HANGİ
   işleme ait olduğu tutulmuyordu (mobil tarafta tüm "hasar"/"diger" fotoğrafları
   tek bir ortak galeride gösteriliyordu). Bu migrasyon nullable complaint_id /
   service_id kolonlarını ekler; NULL değerler eski/ilişkisiz fotoğrafları temsil
   eder ve mobil tarafta ayrıca gösterilmeye devam eder.
   ========================================================================== */

USE OtoServis;
GO
SET NOCOUNT ON;
GO

/* --------------------------------------------------------------------------
   1) work_order_images.complaint_id / service_id — yoksa ekle
   -------------------------------------------------------------------------- */
IF COL_LENGTH(N'dbo.work_order_images', N'complaint_id') IS NULL
BEGIN
    ALTER TABLE dbo.work_order_images ADD complaint_id uniqueidentifier NULL;
    PRINT N'work_order_images.complaint_id eklendi.';
END
ELSE PRINT N'work_order_images.complaint_id zaten var.';
GO

IF COL_LENGTH(N'dbo.work_order_images', N'service_id') IS NULL
BEGIN
    ALTER TABLE dbo.work_order_images ADD service_id uniqueidentifier NULL;
    PRINT N'work_order_images.service_id eklendi.';
END
ELSE PRINT N'work_order_images.service_id zaten var.';
GO

/* --------------------------------------------------------------------------
   2) Foreign key'ler (varsa dbo.complaints / dbo.services tablolarına).
      ON DELETE NO ACTION: bir şikayet/işlem silinse de fotoğraf kaydı ve
      dosyası kalsın (mevcut work_order_id FK'si CASCADE zaten iş emri
      silinince fotoğrafları temizliyor).
   -------------------------------------------------------------------------- */
IF OBJECT_ID(N'dbo.complaints', N'U') IS NOT NULL
   AND OBJECT_ID(N'dbo.FK_woimg_complaint', N'F') IS NULL
BEGIN
    ALTER TABLE dbo.work_order_images ADD CONSTRAINT FK_woimg_complaint
        FOREIGN KEY (complaint_id) REFERENCES dbo.complaints(id) ON DELETE NO ACTION;
    PRINT N'FK_woimg_complaint eklendi.';
END
ELSE PRINT N'FK_woimg_complaint zaten var (ya da dbo.complaints yok).';
GO

IF OBJECT_ID(N'dbo.services', N'U') IS NOT NULL
   AND OBJECT_ID(N'dbo.FK_woimg_service', N'F') IS NULL
BEGIN
    ALTER TABLE dbo.work_order_images ADD CONSTRAINT FK_woimg_service
        FOREIGN KEY (service_id) REFERENCES dbo.services(id) ON DELETE NO ACTION;
    PRINT N'FK_woimg_service eklendi.';
END
ELSE PRINT N'FK_woimg_service zaten var (ya da dbo.services yok).';
GO

/* --------------------------------------------------------------------------
   3) Sorgu performansı için index'ler
   -------------------------------------------------------------------------- */
IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE name = N'IX_woimg_complaint' AND object_id = OBJECT_ID(N'dbo.work_order_images')
)
BEGIN
    CREATE INDEX IX_woimg_complaint ON dbo.work_order_images(complaint_id);
    PRINT N'IX_woimg_complaint eklendi.';
END
ELSE PRINT N'IX_woimg_complaint zaten var.';
GO

IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE name = N'IX_woimg_service' AND object_id = OBJECT_ID(N'dbo.work_order_images')
)
BEGIN
    CREATE INDEX IX_woimg_service ON dbo.work_order_images(service_id);
    PRINT N'IX_woimg_service eklendi.';
END
ELSE PRINT N'IX_woimg_service zaten var.';
GO

PRINT N'Fotoğraf-şikayet/işlem bağlantısı migrasyonu tamamlandı.';
GO
