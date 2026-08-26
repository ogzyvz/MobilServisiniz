/* ==========================================================================
   OtoServis — Aktivite / işlem geçmişi (audit_log genişletme)
   --------------------------------------------------------------------------
   dbo.audit_log tablosu şemada vardı ama hiç kullanılmıyordu. Bu script:
   1) customer_id, vehicle_id, description kolonlarını ekler
      (müşteri/araç bazlı hızlı sorgu + hazır Türkçe açıklama metni için).
   2) Müşteri bazlı sorguları hızlandıran index ekler.
   API tarafı her önemli işlemden sonra (müşteri/araç/iş emri/ödeme/ürün/
   tedarikçi hareketi ekleme-düzenleme-silme) buraya bir satır yazar; mobilde
   müşteri detayında "Aktivite Geçmişi" olarak gösterilir.
   ========================================================================== */
USE OtoServis;
GO
SET NOCOUNT ON;
SET QUOTED_IDENTIFIER ON;
SET ANSI_NULLS ON;
GO

IF OBJECT_ID(N'dbo.audit_log', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.audit_log (
        id bigint NOT NULL IDENTITY(1,1),
        shop_id uniqueidentifier NULL,
        user_id uniqueidentifier NULL,
        action nvarchar(50) NOT NULL,
        entity_type nvarchar(50) NOT NULL,
        entity_id uniqueidentifier NULL,
        old_values nvarchar(max) NULL, new_values nvarchar(max) NULL,
        ip_address nvarchar(45) NULL,
        created_at datetime2(0) NOT NULL DEFAULT SYSUTCDATETIME(),
        CONSTRAINT PK_audit_log PRIMARY KEY (id),
        CONSTRAINT FK_audit_shop FOREIGN KEY (shop_id) REFERENCES dbo.shops(id) ON DELETE SET NULL,
        CONSTRAINT FK_audit_user FOREIGN KEY (user_id) REFERENCES dbo.users(id)
    );
    PRINT N'audit_log tablosu oluşturuldu.';
END
ELSE PRINT N'audit_log tablosu zaten var.';
GO

IF COL_LENGTH(N'dbo.audit_log', N'customer_id') IS NULL
BEGIN
    ALTER TABLE dbo.audit_log ADD customer_id uniqueidentifier NULL;
    PRINT N'audit_log.customer_id eklendi.';
END
ELSE PRINT N'audit_log.customer_id zaten var.';
GO

IF COL_LENGTH(N'dbo.audit_log', N'vehicle_id') IS NULL
BEGIN
    ALTER TABLE dbo.audit_log ADD vehicle_id uniqueidentifier NULL;
    PRINT N'audit_log.vehicle_id eklendi.';
END
ELSE PRINT N'audit_log.vehicle_id zaten var.';
GO

IF COL_LENGTH(N'dbo.audit_log', N'description') IS NULL
BEGIN
    ALTER TABLE dbo.audit_log ADD description nvarchar(400) NULL;
    PRINT N'audit_log.description eklendi.';
END
ELSE PRINT N'audit_log.description zaten var.';
GO

IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE name = N'IX_audit_customer' AND object_id = OBJECT_ID(N'dbo.audit_log')
)
BEGIN
    CREATE INDEX IX_audit_customer ON dbo.audit_log(shop_id, customer_id, created_at DESC)
        WHERE customer_id IS NOT NULL;
    PRINT N'IX_audit_customer eklendi.';
END
ELSE PRINT N'IX_audit_customer zaten var.';
GO

PRINT N'22_activity_log OK.';
GO
