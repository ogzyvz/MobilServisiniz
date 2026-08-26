/*
  20 — Müşteri alacak + tedarikçi bakiye düzeltmesi
  - vw_CustomerBalance: ödenmemiş iş emri kalanları (müşteri bize borç)
  - vw_SupplierBalance: opening + alis - odeme - iade - iskonto (shop_id filtreli)
*/
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
    ISNULL(SUM(CASE
        WHEN t.grand_total - t.paid_total > 0.005
        THEN t.grand_total - t.paid_total
        ELSE 0
    END), 0) AS balance
FROM dbo.customers c
LEFT JOIN dbo.vw_WorkOrderTotals t
    ON t.customer_id = c.id AND t.shop_id = c.shop_id
WHERE c.is_customer = 1
GROUP BY c.id, c.shop_id;
GO
PRINT N'vw_CustomerBalance olusturuldu.';
GO

IF OBJECT_ID(N'dbo.vw_SupplierBalance', N'V') IS NOT NULL DROP VIEW dbo.vw_SupplierBalance;
GO
CREATE VIEW dbo.vw_SupplierBalance AS
SELECT c.id AS supplier_id, c.shop_id,
    c.opening_balance
      + ISNULL(t.alis_total, 0)
      - ISNULL(t.odeme_total, 0)
      - ISNULL(t.iade_total, 0)
      - ISNULL(t.iskonto_total, 0) AS balance,
    t.last_transaction_at
FROM dbo.customers c
OUTER APPLY (
    SELECT
        SUM(CASE WHEN st.type = N'alis' THEN st.amount ELSE 0 END) AS alis_total,
        SUM(CASE WHEN st.type = N'odeme' THEN st.amount ELSE 0 END) AS odeme_total,
        SUM(CASE WHEN st.type = N'iade' THEN st.amount ELSE 0 END) AS iade_total,
        SUM(CASE WHEN st.type = N'iskonto' THEN st.amount ELSE 0 END) AS iskonto_total,
        MAX(st.created_at) AS last_transaction_at
    FROM dbo.supplier_transactions st
    WHERE st.supplier_id = c.id AND st.shop_id = c.shop_id
) t
WHERE c.is_supplier = 1;
GO
PRINT N'vw_SupplierBalance guncellendi (iskonto + shop_id).';
GO

PRINT N'20_customer_supplier_balance OK.';
GO
