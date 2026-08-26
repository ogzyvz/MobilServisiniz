/* ==========================================================================
   OtoServis — Müşteri/tedarikçi cari tutarlılığı düzeltmesi
   --------------------------------------------------------------------------
   dbo.customers hem müşterileri hem tedarikçileri tutuyor ve opening_balance
   kolonunu paylaşıyor. vw_SupplierBalance bunu hesaba katıyordu
   (opening_balance + alış - ödeme - iade - iskonto) ama vw_CustomerBalance
   HİÇ katmıyordu — sadece ödenmemiş iş emri kalanlarını topluyordu. Bir
   müşteriye açılış bakiyesi (devreden borç) girildiğinde bu tutar hem mobil
   hem admin panelde ve tüm raporlarda sessizce kayboluyordu.

   Bu script vw_CustomerBalance'ı tedarikçi tarafıyla simetrik hale getirir:
   bakiye = açılış bakiyesi + ödenmemiş iş emri kalanları.
   ========================================================================== */
USE OtoServis;
GO
SET NOCOUNT ON;
SET QUOTED_IDENTIFIER ON;
SET ANSI_NULLS ON;
GO

IF OBJECT_ID(N'dbo.vw_CustomerBalance', N'V') IS NOT NULL DROP VIEW dbo.vw_CustomerBalance;
GO
CREATE VIEW dbo.vw_CustomerBalance AS
SELECT
    c.id AS customer_id,
    c.shop_id,
    c.opening_balance + ISNULL(SUM(CASE
        WHEN t.grand_total - t.paid_total > 0.005
        THEN t.grand_total - t.paid_total
        ELSE 0
    END), 0) AS balance
FROM dbo.customers c
LEFT JOIN dbo.vw_WorkOrderTotals t
    ON t.customer_id = c.id AND t.shop_id = c.shop_id
WHERE c.is_customer = 1
GROUP BY c.id, c.shop_id, c.opening_balance;
GO
PRINT N'vw_CustomerBalance duzeltildi (opening_balance dahil edildi).';
GO

PRINT N'23_customer_balance_fix OK.';
GO
