/*
  Platform yönetim paneli — kolonlar + seed platform admin bayrağı
  - users.is_platform_admin
  - shops.max_users (NULL = plandaki limit kullanılır)

  Not: ALTER TABLE ile eklenen kolon aynı batch'te kullanılamaz → GO zorunlu.
*/
USE OtoServis;
GO
SET NOCOUNT ON;
SET QUOTED_IDENTIFIER ON;
SET ANSI_NULLS ON;
GO

IF COL_LENGTH(N'dbo.users', N'is_platform_admin') IS NULL
BEGIN
    ALTER TABLE dbo.users ADD is_platform_admin bit NOT NULL
        CONSTRAINT DF_users_is_platform_admin DEFAULT (0);
    PRINT N'users.is_platform_admin eklendi.';
END
ELSE
    PRINT N'users.is_platform_admin zaten var.';
GO

IF COL_LENGTH(N'dbo.shops', N'max_users') IS NULL
BEGIN
    ALTER TABLE dbo.shops ADD max_users int NULL;
    PRINT N'shops.max_users eklendi.';
END
ELSE
    PRINT N'shops.max_users zaten var.';
GO

-- Seed platform admin (telefon 05000000001)
UPDATE dbo.users
SET is_platform_admin = 1
WHERE phone = N'05000000001' AND is_active = 1;

IF @@ROWCOUNT > 0
    PRINT N'Platform admin bayrağı güncellendi (05000000001).';
ELSE
    PRINT N'UYARI: 05000000001 kullanıcısı bulunamadı — platform admini elle ekleyin.';

PRINT N'15_platform_admin OK.';
GO
