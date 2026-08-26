/*
  19 — Üç paket satış: Başlangıç / Profesyonel / Kurumsal
  - feature bayrakları
  - eski trial/standard/premium → yeni kodlar
*/
USE OtoServis;
GO
SET NOCOUNT ON;
SET QUOTED_IDENTIFIER ON;
SET ANSI_NULLS ON;
GO

/* max_users NULL = sınırsız */
IF EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID(N'dbo.ref_subscription_plans')
      AND name = N'max_users' AND is_nullable = 0
)
BEGIN
    ALTER TABLE dbo.ref_subscription_plans ALTER COLUMN max_users int NULL;
    PRINT N'ref_subscription_plans.max_users nullable yapildi.';
END
GO

IF COL_LENGTH(N'dbo.ref_subscription_plans', N'feature_stock') IS NULL
    ALTER TABLE dbo.ref_subscription_plans ADD feature_stock bit NOT NULL
        CONSTRAINT DF_plan_stock DEFAULT (0);
IF COL_LENGTH(N'dbo.ref_subscription_plans', N'feature_suppliers') IS NULL
    ALTER TABLE dbo.ref_subscription_plans ADD feature_suppliers bit NOT NULL
        CONSTRAINT DF_plan_suppliers DEFAULT (0);
IF COL_LENGTH(N'dbo.ref_subscription_plans', N'feature_staff_performance') IS NULL
    ALTER TABLE dbo.ref_subscription_plans ADD feature_staff_performance bit NOT NULL
        CONSTRAINT DF_plan_perf DEFAULT (0);
IF COL_LENGTH(N'dbo.ref_subscription_plans', N'feature_ai_ruhsat') IS NULL
    ALTER TABLE dbo.ref_subscription_plans ADD feature_ai_ruhsat bit NOT NULL
        CONSTRAINT DF_plan_ai_ruhsat DEFAULT (1);
IF COL_LENGTH(N'dbo.ref_subscription_plans', N'feature_ai_invoice') IS NULL
    ALTER TABLE dbo.ref_subscription_plans ADD feature_ai_invoice bit NOT NULL
        CONSTRAINT DF_plan_ai_invoice DEFAULT (0);
IF COL_LENGTH(N'dbo.ref_subscription_plans', N'feature_api_access') IS NULL
    ALTER TABLE dbo.ref_subscription_plans ADD feature_api_access bit NOT NULL
        CONSTRAINT DF_plan_api DEFAULT (0);
GO
PRINT N'Feature kolonlari hazir.';
GO

/* Yeni plan satirlari (yoksa ekle) */
IF NOT EXISTS (SELECT 1 FROM dbo.ref_subscription_plans WHERE code = N'baslangic')
    INSERT INTO dbo.ref_subscription_plans (
        code, label, max_users, max_vehicles_per_month, monthly_price,
        feature_stock, feature_suppliers, feature_staff_performance,
        feature_ai_ruhsat, feature_ai_invoice, feature_api_access
    ) VALUES (
        N'baslangic', N'Başlangıç', 1, 100, 399,
        0, 0, 0, 1, 0, 0
    );

IF NOT EXISTS (SELECT 1 FROM dbo.ref_subscription_plans WHERE code = N'profesyonel')
    INSERT INTO dbo.ref_subscription_plans (
        code, label, max_users, max_vehicles_per_month, monthly_price,
        feature_stock, feature_suppliers, feature_staff_performance,
        feature_ai_ruhsat, feature_ai_invoice, feature_api_access
    ) VALUES (
        N'profesyonel', N'Profesyonel', 5, NULL, 599,
        1, 1, 1, 1, 0, 0
    );

IF NOT EXISTS (SELECT 1 FROM dbo.ref_subscription_plans WHERE code = N'kurumsal')
    INSERT INTO dbo.ref_subscription_plans (
        code, label, max_users, max_vehicles_per_month, monthly_price,
        feature_stock, feature_suppliers, feature_staff_performance,
        feature_ai_ruhsat, feature_ai_invoice, feature_api_access
    ) VALUES (
        N'kurumsal', N'Kurumsal', NULL, NULL, 999,
        1, 1, 1, 1, 1, 1
    );
GO

/* Shop migrate */
UPDATE dbo.shops SET subscription_plan = CASE
    WHEN subscription_plan = N'trial' THEN N'baslangic'
    WHEN subscription_plan = N'standard' THEN N'profesyonel'
    WHEN subscription_plan = N'premium' THEN N'kurumsal'
    ELSE subscription_plan
END
WHERE subscription_plan IN (N'trial', N'standard', N'premium');
GO

PRINT N'Shop plan kodlari migrate edildi.';
GO

/* Eski plan satirlari */
DELETE FROM dbo.ref_subscription_plans
WHERE code IN (N'trial', N'standard', N'premium');
GO

/* Yeni plan degerlerini tazele (tekrar calistirilabilir) */
UPDATE dbo.ref_subscription_plans SET
    label = N'Başlangıç', max_users = 1, max_vehicles_per_month = 100, monthly_price = 399,
    feature_stock = 0, feature_suppliers = 0, feature_staff_performance = 0,
    feature_ai_ruhsat = 1, feature_ai_invoice = 0, feature_api_access = 0
WHERE code = N'baslangic';

UPDATE dbo.ref_subscription_plans SET
    label = N'Profesyonel', max_users = 5, max_vehicles_per_month = NULL, monthly_price = 599,
    feature_stock = 1, feature_suppliers = 1, feature_staff_performance = 1,
    feature_ai_ruhsat = 1, feature_ai_invoice = 0, feature_api_access = 0
WHERE code = N'profesyonel';

UPDATE dbo.ref_subscription_plans SET
    label = N'Kurumsal', max_users = NULL, max_vehicles_per_month = NULL, monthly_price = 999,
    feature_stock = 1, feature_suppliers = 1, feature_staff_performance = 1,
    feature_ai_ruhsat = 1, feature_ai_invoice = 1, feature_api_access = 1
WHERE code = N'kurumsal';
GO

/* Orphan shop (beklenmez) */
UPDATE dbo.shops SET subscription_plan = N'baslangic'
WHERE subscription_plan NOT IN (N'baslangic', N'profesyonel', N'kurumsal');
GO

PRINT N'19_subscription_plans OK.';
GO
