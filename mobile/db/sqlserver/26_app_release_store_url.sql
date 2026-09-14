/*
  26 — app_release: apk_url -> store_url (Play Store yonlendirmesi)
  - Mobil uygulama artik APK indirip kurmuyor; guncelleme gerektiginde
    Play Store sayfasina yonlendiriyor. Kolon adi bunu yansitacak sekilde
    yeniden adlandirildi.
  - Ayrica seed/varsayilan degerler (1.0.19 / code 20) hala duruyorsa
    gercek surume (1.0.32 / code 36) ve Play Store linkine guncellenir.
    Yonetici panelden zaten ozellestirilmisse (latest_version_code <> 20)
    dokunulmaz.
*/
USE OtoServis;
GO
SET NOCOUNT ON;
SET QUOTED_IDENTIFIER ON;
SET ANSI_NULLS ON;
GO

IF COL_LENGTH('dbo.app_release', 'store_url') IS NULL
   AND COL_LENGTH('dbo.app_release', 'apk_url') IS NOT NULL
BEGIN
    EXEC sp_rename 'dbo.app_release.apk_url', 'store_url', 'COLUMN';
    PRINT N'app_release.apk_url -> store_url olarak yeniden adlandirildi.';
END
ELSE
    PRINT N'app_release.store_url zaten mevcut.';
GO

-- Hala baslangic seed degerindeyse (hic ozellestirilmemis), gercek surume guncelle.
IF EXISTS (SELECT 1 FROM dbo.app_release WHERE id = 1 AND latest_version_code = 20)
BEGIN
    UPDATE dbo.app_release
    SET latest_version = N'1.0.32',
        latest_version_code = 36,
        min_version_code = 20,
        store_url = N'https://play.google.com/store/apps/details?id=com.efogy.mobilservisiniz',
        release_notes = N'Performans ve kararlilik iyilestirmeleri.',
        updated_at = SYSUTCDATETIME()
    WHERE id = 1;
    PRINT N'app_release seed guncellendi (1.0.32 / code 36).';
END
ELSE
    PRINT N'app_release zaten ozellestirilmis, seed guncellemesi atlandi.';
GO

PRINT N'26_app_release_store_url OK.';
GO
