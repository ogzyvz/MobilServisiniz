/* ==========================================================================
   OtoServis — İş emri yaşam döngüsü (durum geçmişi + fotoğraf performansı)
   --------------------------------------------------------------------------
   Mevcut sunucu DB'sinde çalıştırın (SSMS / sqlcmd), 07_unify_contacts.sql'den
   SONRA.

   Bu migrasyon YENİ tablo/kolon eklemez: dbo.work_orders.started_at /
   closed_at / delivered_at, dbo.work_order_status_history (ve onu dolduran
   trg_wo_status_history tetikleyicisi) ve dbo.work_order_images tabloları
   01_schema.sql'de zaten mevcuttu ama hiçbiri API tarafından kullanılmıyordu.

   Amaç:
   1) Bu üç nesnenin gerçekten var olduğunu (guard'larla) doğrulamak — API
      artık bunlara yazıp okuyor, bu yüzden eksikse burada net bir şekilde
      görülsün.
   2) "Zaman Çizelgesi" (durum geçmişi) ve fotoğraf listeleme sorgularının
      sık çalışacağı için gerekli index'leri eklemek (bu index'ler
      01_schema.sql'de yoktu; FK'ler otomatik index oluşturmaz).
   ========================================================================== */

USE OtoServis;
GO
SET NOCOUNT ON;
GO

/* --------------------------------------------------------------------------
   1) work_orders.started_at / closed_at / delivered_at — var olduğunu doğrula
   -------------------------------------------------------------------------- */
IF COL_LENGTH(N'dbo.work_orders', N'started_at') IS NULL
BEGIN
    ALTER TABLE dbo.work_orders ADD started_at datetime2(0) NULL;
    PRINT N'work_orders.started_at eklendi.';
END
ELSE PRINT N'work_orders.started_at zaten var.';
GO

IF COL_LENGTH(N'dbo.work_orders', N'closed_at') IS NULL
BEGIN
    ALTER TABLE dbo.work_orders ADD closed_at datetime2(0) NULL;
    PRINT N'work_orders.closed_at eklendi.';
END
ELSE PRINT N'work_orders.closed_at zaten var.';
GO

IF COL_LENGTH(N'dbo.work_orders', N'delivered_at') IS NULL
BEGIN
    ALTER TABLE dbo.work_orders ADD delivered_at datetime2(0) NULL;
    PRINT N'work_orders.delivered_at eklendi.';
END
ELSE PRINT N'work_orders.delivered_at zaten var.';
GO

/* --------------------------------------------------------------------------
   2) work_order_status_history — tablo + tetikleyici var olduğunu doğrula,
      "Zaman Çizelgesi" ekranı için (work_order_id, changed_at) index'i ekle
   -------------------------------------------------------------------------- */
IF OBJECT_ID(N'dbo.work_order_status_history', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.work_order_status_history (
        id uniqueidentifier NOT NULL CONSTRAINT DF_wosh_id_08 DEFAULT NEWID(),
        work_order_id uniqueidentifier NOT NULL,
        shop_id uniqueidentifier NOT NULL,
        old_status nvarchar(20) NULL, new_status nvarchar(20) NOT NULL,
        changed_by uniqueidentifier NULL, note nvarchar(300) NULL,
        changed_at datetime2(0) NOT NULL DEFAULT SYSUTCDATETIME(),
        CONSTRAINT PK_work_order_status_history_08 PRIMARY KEY (id),
        CONSTRAINT FK_wosh_wo_08 FOREIGN KEY (work_order_id) REFERENCES dbo.work_orders(id) ON DELETE CASCADE,
        CONSTRAINT FK_wosh_shop_08 FOREIGN KEY (shop_id) REFERENCES dbo.shops(id),
        CONSTRAINT FK_wosh_user_08 FOREIGN KEY (changed_by) REFERENCES dbo.users(id),
        CONSTRAINT FK_wosh_new_08 FOREIGN KEY (new_status) REFERENCES dbo.ref_work_order_status(code)
    );
    PRINT N'work_order_status_history tablosu oluşturuldu.';
END
ELSE PRINT N'work_order_status_history zaten var.';
GO

IF OBJECT_ID(N'dbo.trg_wo_status_history', N'TR') IS NULL
BEGIN
    EXEC(N'
    CREATE TRIGGER dbo.trg_wo_status_history ON dbo.work_orders AFTER UPDATE AS
    BEGIN SET NOCOUNT ON;
        INSERT INTO dbo.work_order_status_history (id, work_order_id, shop_id, old_status, new_status, changed_at)
        SELECT NEWID(), i.id, i.shop_id, d.status, i.status, SYSUTCDATETIME()
        FROM inserted i INNER JOIN deleted d ON i.id=d.id WHERE i.status<>d.status;
    END');
    PRINT N'trg_wo_status_history tetikleyicisi oluşturuldu.';
END
ELSE PRINT N'trg_wo_status_history zaten var.';
GO

IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE name = N'IX_wosh_wo_changed' AND object_id = OBJECT_ID(N'dbo.work_order_status_history')
)
BEGIN
    CREATE INDEX IX_wosh_wo_changed ON dbo.work_order_status_history(work_order_id, changed_at);
    PRINT N'IX_wosh_wo_changed eklendi (Zaman Çizelgesi sorgusu için).';
END
ELSE PRINT N'IX_wosh_wo_changed zaten var.';
GO

/* --------------------------------------------------------------------------
   3) work_order_images — tablo var olduğunu doğrula, listeleme sorgusu için
      (work_order_id) index'i ekle
   -------------------------------------------------------------------------- */
IF OBJECT_ID(N'dbo.work_order_images', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.work_order_images (
        id uniqueidentifier NOT NULL CONSTRAINT DF_woimg_id_08 DEFAULT NEWID(),
        shop_id uniqueidentifier NOT NULL,
        work_order_id uniqueidentifier NULL, vehicle_id uniqueidentifier NULL,
        image_type nvarchar(20) NOT NULL CONSTRAINT DF_woimg_type_08 DEFAULT N'ruhsat',
        file_path nvarchar(500) NOT NULL, mime_type nvarchar(50) NULL,
        ai_scanned bit NOT NULL DEFAULT 0, ai_result_json nvarchar(max) NULL,
        uploaded_by uniqueidentifier NULL,
        created_at datetime2(0) NOT NULL DEFAULT SYSUTCDATETIME(),
        CONSTRAINT PK_work_order_images_08 PRIMARY KEY (id),
        CONSTRAINT FK_woimg_shop_08 FOREIGN KEY (shop_id) REFERENCES dbo.shops(id),
        CONSTRAINT FK_woimg_wo_08 FOREIGN KEY (work_order_id) REFERENCES dbo.work_orders(id) ON DELETE CASCADE,
        CONSTRAINT FK_woimg_vehicle_08 FOREIGN KEY (vehicle_id) REFERENCES dbo.vehicles(id) ON DELETE SET NULL,
        CONSTRAINT FK_woimg_user_08 FOREIGN KEY (uploaded_by) REFERENCES dbo.users(id),
        CONSTRAINT CK_woimg_type_08 CHECK (image_type IN (N'ruhsat', N'arac', N'hasar', N'diger'))
    );
    PRINT N'work_order_images tablosu oluşturuldu.';
END
ELSE PRINT N'work_order_images zaten var.';
GO

IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE name = N'IX_woimg_wo' AND object_id = OBJECT_ID(N'dbo.work_order_images')
)
BEGIN
    CREATE INDEX IX_woimg_wo ON dbo.work_order_images(work_order_id, created_at);
    PRINT N'IX_woimg_wo eklendi (iş emri fotoğrafları listeleme sorgusu için).';
END
ELSE PRINT N'IX_woimg_wo zaten var.';
GO

/* complaints.work_order_id da FK ile korunuyor ama index'i yoktu; Şikayet
   sekmesi ve düzenleme uç noktası sık sık work_order_id ile filtreliyor. */
IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE name = N'IX_complaints_wo' AND object_id = OBJECT_ID(N'dbo.complaints')
)
BEGIN
    CREATE INDEX IX_complaints_wo ON dbo.complaints(work_order_id);
    PRINT N'IX_complaints_wo eklendi.';
END
ELSE PRINT N'IX_complaints_wo zaten var.';
GO

PRINT N'İş emri yaşam döngüsü migrasyonu tamamlandı.';
GO
