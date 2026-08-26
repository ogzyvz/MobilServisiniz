/*
  Servis lisans / süre yönetimi
  - shops.license_type: trial | monthly | yearly | unlimited
  - shops.license_started_at / license_expires_at
  - shop_license_events: uzatma geçmişi
  Mevcut servisler → unlimited
*/
USE OtoServis;
GO
SET NOCOUNT ON;
SET QUOTED_IDENTIFIER ON;
SET ANSI_NULLS ON;
GO

IF COL_LENGTH(N'dbo.shops', N'license_type') IS NULL
BEGIN
    ALTER TABLE dbo.shops ADD license_type nvarchar(20) NOT NULL
        CONSTRAINT DF_shops_license_type DEFAULT (N'unlimited');
    PRINT N'shops.license_type eklendi.';
END
ELSE
    PRINT N'shops.license_type zaten var.';
GO

IF COL_LENGTH(N'dbo.shops', N'license_started_at') IS NULL
BEGIN
    ALTER TABLE dbo.shops ADD license_started_at datetime2(0) NULL;
    PRINT N'shops.license_started_at eklendi.';
END
ELSE
    PRINT N'shops.license_started_at zaten var.';
GO

IF COL_LENGTH(N'dbo.shops', N'license_expires_at') IS NULL
BEGIN
    ALTER TABLE dbo.shops ADD license_expires_at datetime2(0) NULL;
    PRINT N'shops.license_expires_at eklendi.';
END
ELSE
    PRINT N'shops.license_expires_at zaten var.';
GO

IF OBJECT_ID(N'dbo.shop_license_events', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.shop_license_events (
        id uniqueidentifier NOT NULL CONSTRAINT DF_sle_id DEFAULT NEWID(),
        shop_id uniqueidentifier NOT NULL,
        old_license_type nvarchar(20) NULL,
        new_license_type nvarchar(20) NOT NULL,
        old_expires_at datetime2(0) NULL,
        new_expires_at datetime2(0) NULL,
        note nvarchar(300) NULL,
        created_by uniqueidentifier NULL,
        created_at datetime2(0) NOT NULL CONSTRAINT DF_sle_created DEFAULT SYSUTCDATETIME(),
        CONSTRAINT PK_shop_license_events PRIMARY KEY (id),
        CONSTRAINT FK_sle_shop FOREIGN KEY (shop_id) REFERENCES dbo.shops(id) ON DELETE CASCADE,
        CONSTRAINT FK_sle_user FOREIGN KEY (created_by) REFERENCES dbo.users(id)
    );
    CREATE INDEX IX_sle_shop ON dbo.shop_license_events(shop_id, created_at DESC);
    PRINT N'shop_license_events oluşturuldu.';
END
ELSE
    PRINT N'shop_license_events zaten var.';
GO

-- Mevcut servisler sınırsız
UPDATE dbo.shops
SET license_type = N'unlimited',
    license_expires_at = NULL,
    license_started_at = COALESCE(license_started_at, created_at)
WHERE license_type IS NULL
   OR license_type = N'unlimited'
   OR (license_type = N'unlimited' AND license_started_at IS NULL);

-- DEFAULT ile gelen unlimited satırlarda started_at doldur
UPDATE dbo.shops
SET license_started_at = COALESCE(license_started_at, created_at)
WHERE license_started_at IS NULL;

PRINT N'Mevcut servisler unlimited olarak ayarlandı.';
PRINT N'16_shop_license OK.';
GO
