/* ==========================================================================
   OtoServis — Ödeme durumu + servis IBAN alanları
   --------------------------------------------------------------------------
   12_part_update_delete.sql'den SONRA çalıştırın.
   ========================================================================== */
USE OtoServis;
GO
SET NOCOUNT ON;
SET QUOTED_IDENTIFIER ON;
GO

IF NOT EXISTS (SELECT 1 FROM dbo.ref_work_order_status WHERE code = N'odeme_tamamlandi')
BEGIN
    INSERT INTO dbo.ref_work_order_status (code, label, sort_order, is_terminal)
    VALUES (N'odeme_tamamlandi', N'Ödeme Tamamlandı', 4, 1);
    PRINT N'ref_work_order_status.odeme_tamamlandi eklendi.';
END
ELSE
    PRINT N'ref_work_order_status.odeme_tamamlandi zaten var.';
GO

-- Sıra: tamamlandi → odeme_tamamlandi → teslim_edildi
UPDATE dbo.ref_work_order_status SET sort_order = 3 WHERE code = N'tamamlandi';
UPDATE dbo.ref_work_order_status SET sort_order = 4 WHERE code = N'odeme_tamamlandi';
UPDATE dbo.ref_work_order_status SET sort_order = 5 WHERE code = N'teslim_edildi';
UPDATE dbo.ref_work_order_status SET sort_order = 6 WHERE code = N'iptal';
PRINT N'ref_work_order_status sıralaması güncellendi (ödeme → teslim).';
GO

IF COL_LENGTH(N'dbo.shops', N'bank_iban') IS NULL
BEGIN
    ALTER TABLE dbo.shops ADD bank_iban nvarchar(34) NULL;
    PRINT N'shops.bank_iban eklendi.';
END
ELSE PRINT N'shops.bank_iban zaten var.';
GO

IF COL_LENGTH(N'dbo.shops', N'bank_name') IS NULL
BEGIN
    ALTER TABLE dbo.shops ADD bank_name nvarchar(100) NULL;
    PRINT N'shops.bank_name eklendi.';
END
ELSE PRINT N'shops.bank_name zaten var.';
GO

IF COL_LENGTH(N'dbo.shops', N'account_holder') IS NULL
BEGIN
    ALTER TABLE dbo.shops ADD account_holder nvarchar(150) NULL;
    PRINT N'shops.account_holder eklendi.';
END
ELSE PRINT N'shops.account_holder zaten var.';
GO

PRINT N'Ödeme durumu + IBAN alanları hazır.';
PRINT N'Örnek IBAN: UPDATE dbo.shops SET bank_iban=N''TR..'', bank_name=N''Banka'', account_holder=N''Ünvan'' WHERE tenant_code=N''OTO-IST'';';
GO
