/* ==========================================================================
   OtoServis — "tamamlandi" durum etiketini netlestir: "Servis Tamamlandi"
   --------------------------------------------------------------------------
   "Tamamlandi" etiketi mustericilere/kullanicilara belirsiz geliyordu:
   bu durum sadece tamir/iscilik isinin bittigini ifade ediyor, odemenin
   veya araç teslim sürecinin bitmis olmasi anlamina gelmiyor (o anlamlar
   sirasiyla "odeme_tamamlandi" ve "teslim_edildi" durumlarina karsilik
   geliyor). Bu script, kod (status) degismeden sadece goruntulenen etiketi
   guncelliyor: "Tamamlandi" -> "Servis Tamamlandi".
   ========================================================================== */
USE OtoServis;
GO
SET NOCOUNT ON;
SET QUOTED_IDENTIFIER ON;
SET ANSI_NULLS ON;
GO

UPDATE dbo.ref_work_order_status
SET label = N'Servis Tamamlandı'
WHERE code = N'tamamlandi';

PRINT N'Guncellenen ref_work_order_status satiri: ' + CAST(@@ROWCOUNT AS NVARCHAR(10));
GO
PRINT N'25_rename_tamamlandi_label OK.';
GO
