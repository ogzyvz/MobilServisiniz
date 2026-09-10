/* ==========================================================================
   OtoServis — "odeme_tamamlandi" statusunde ama kalan borcu olan is emirlerini duzelt
   --------------------------------------------------------------------------
   Bir is emri tam odendiginde status = 'odeme_tamamlandi' oluyordu, ancak
   sonrasinda o is emrine (force ile) yeni parca/iscilik eklenmesi, mevcut
   parca/iscilik fiyatinin/miktarinin degistirilmesi, parca silinmesi veya
   tedarikciye parca iadesi yapilmasi durumunda grand_total degisiyor ve
   kalan borc yeniden olusuyordu — ama status hala 'odeme_tamamlandi' olarak
   kaliyordu (API kodunda bu islemler status senkronizasyonunu tetiklemiyordu).
   Sonuc: "Odeme bekleyen" raporunda status'u "Odeme Tamamlandi" olan ama
   gercekte kalan borcu olan araclar goruluyordu.

   API kodu duzeltildi (bu islemlerden sonra da status senkronize ediliyor),
   bu script ise DB'de zaten olusmus hatali kayitlari bir kerelik duzeltir:
   kalan borcu > 0 olan ve status = 'odeme_tamamlandi' olan is emirlerini
   'tamamlandi' statusune geri ceker.
   ========================================================================== */
USE OtoServis;
GO
SET NOCOUNT ON;
SET QUOTED_IDENTIFIER ON;
SET ANSI_NULLS ON;
GO

-- Not: dbo.trg_wo_status_history tetikleyicisi zaten status degisimini
-- work_order_status_history'e otomatik yaziyor, burada ayrica insert gerekmiyor.
UPDATE wo
SET wo.status = N'tamamlandi', wo.updated_at = SYSUTCDATETIME()
FROM dbo.work_orders wo
INNER JOIN dbo.vw_WorkOrderTotals t ON t.id = wo.id
WHERE wo.status = N'odeme_tamamlandi'
  AND t.grand_total - t.paid_total > 0.005;

PRINT N'Duzeltilen is emri sayisi: ' + CAST(@@ROWCOUNT AS NVARCHAR(10));
GO
PRINT N'24_fix_stale_odeme_tamamlandi_status OK.';
GO
