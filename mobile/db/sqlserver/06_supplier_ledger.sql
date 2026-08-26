/* ==========================================================================
   OtoServis — Tedarikçi / Cari Hesap (supplier ledger)
   --------------------------------------------------------------------------
   Mevcut sunucu DB'sinde çalıştırın (SSMS / sqlcmd).
   - suppliers tablosuna adres, vergi no, açılış bakiyesi eklenir.
   - supplier_transactions: alış / ödeme / iade hareketleri.
   - work_order_parts: parçanın stoktan mı yoksa dışarıdan mı alındığı,
     hangi tedarikçiden alındığı, alış fiyatı ve iade tarihi.
   - vw_SupplierBalance: tedarikçi bazlı güncel bakiye.
   - usp_AddPartToWorkOrder: dışarıdan alınan parçalar için cari hareketi.
   - usp_ReturnPartToSupplier: parçayı tedarikçiye iade eder (v1: tüm satır).
   ========================================================================== */

USE OtoServis;
GO
SET NOCOUNT ON;
GO
SET QUOTED_IDENTIFIER ON;
GO
SET ANSI_NULLS ON;
GO

/* Bu betik ilk kurulumda (dbo.suppliers hâlâ ayrı bir tabloyken) çalışacak
   şekilde yazıldı. 07_unify_contacts.sql daha sonra dbo.suppliers'ı
   dbo.customers'a taşıyıp dbo.suppliers_deprecated adına yeniden adlandırıyor.
   Bu betik SUNUCU-GUNCELLE.bat tarafından HER güncellemede tekrar
   çalıştırıldığı için, dbo.suppliers zaten taşınmışsa aşağıdaki
   suppliers-özel adımları atlıyoruz (aksi halde "Invalid object name
   dbo.suppliers" gibi zararsız ama kafa karıştırıcı hatalar üretirdi). */
IF OBJECT_ID(N'dbo.suppliers', N'U') IS NULL
BEGIN
    PRINT N'dbo.suppliers artık yok (muhtemelen 07_unify_contacts.sql ile dbo.customers''a taşındı) — suppliers-özel adımlar atlanıyor.';
END
GO

/* --------------------------------------------------------------------------
   suppliers — yeni alanlar
   -------------------------------------------------------------------------- */
IF OBJECT_ID(N'dbo.suppliers', N'U') IS NOT NULL
BEGIN
    IF COL_LENGTH(N'dbo.suppliers', N'address') IS NULL
    BEGIN
        ALTER TABLE dbo.suppliers ADD address nvarchar(300) NULL;
        PRINT N'suppliers.address eklendi.';
    END
    ELSE PRINT N'suppliers.address zaten var.';

    IF COL_LENGTH(N'dbo.suppliers', N'tax_no') IS NULL
    BEGIN
        ALTER TABLE dbo.suppliers ADD tax_no nvarchar(20) NULL;
        PRINT N'suppliers.tax_no eklendi.';
    END
    ELSE PRINT N'suppliers.tax_no zaten var.';

    IF COL_LENGTH(N'dbo.suppliers', N'opening_balance') IS NULL
    BEGIN
        ALTER TABLE dbo.suppliers ADD opening_balance decimal(12,2) NOT NULL CONSTRAINT DF_suppliers_opening_balance DEFAULT 0;
        PRINT N'suppliers.opening_balance eklendi.';
    END
    ELSE PRINT N'suppliers.opening_balance zaten var.';
END
GO

/* --------------------------------------------------------------------------
   supplier_transactions — cari hareketler (alış / ödeme / iade)
   -------------------------------------------------------------------------- */
IF OBJECT_ID(N'dbo.supplier_transactions', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.supplier_transactions (
        id uniqueidentifier NOT NULL CONSTRAINT DF_suptx_id DEFAULT NEWID(),
        shop_id uniqueidentifier NOT NULL,
        supplier_id uniqueidentifier NOT NULL,
        type nvarchar(20) NOT NULL,
        amount decimal(12,2) NOT NULL,
        work_order_part_id uniqueidentifier NULL,
        description nvarchar(300) NULL,
        created_by uniqueidentifier NULL,
        created_at datetime2(0) NOT NULL CONSTRAINT DF_suptx_created DEFAULT SYSUTCDATETIME(),
        CONSTRAINT PK_supplier_transactions PRIMARY KEY (id),
        CONSTRAINT FK_suptx_shop FOREIGN KEY (shop_id) REFERENCES dbo.shops(id),
        CONSTRAINT FK_suptx_supplier FOREIGN KEY (supplier_id) REFERENCES dbo.suppliers(id),
        CONSTRAINT FK_suptx_part FOREIGN KEY (work_order_part_id) REFERENCES dbo.work_order_parts(id) ON DELETE SET NULL,
        CONSTRAINT FK_suptx_user FOREIGN KEY (created_by) REFERENCES dbo.users(id),
        CONSTRAINT CK_suptx_type CHECK (type IN (N'alis', N'odeme', N'iade')),
        CONSTRAINT CK_suptx_amount CHECK (amount > 0)
    );
    CREATE INDEX IX_suptx_shop_supplier ON dbo.supplier_transactions(shop_id, supplier_id);
    CREATE INDEX IX_suptx_shop_created ON dbo.supplier_transactions(shop_id, created_at);
    PRINT N'supplier_transactions tablosu oluşturuldu.';
END
ELSE PRINT N'supplier_transactions zaten var.';
GO

/* --------------------------------------------------------------------------
   work_order_parts — kaynak (stok / dışarıdan), tedarikçi, alış fiyatı, iade
   -------------------------------------------------------------------------- */
IF COL_LENGTH(N'dbo.work_order_parts', N'source') IS NULL
BEGIN
    ALTER TABLE dbo.work_order_parts ADD source nvarchar(20) NOT NULL CONSTRAINT DF_parts_source DEFAULT N'stok';
    PRINT N'work_order_parts.source eklendi.';
END
ELSE PRINT N'work_order_parts.source zaten var.';
GO

IF NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = N'CK_parts_source')
    ALTER TABLE dbo.work_order_parts ADD CONSTRAINT CK_parts_source CHECK (source IN (N'stok', N'disaridan'));
GO

IF COL_LENGTH(N'dbo.work_order_parts', N'supplier_id') IS NULL
BEGIN
    ALTER TABLE dbo.work_order_parts ADD supplier_id uniqueidentifier NULL;
    PRINT N'work_order_parts.supplier_id eklendi.';
END
ELSE PRINT N'work_order_parts.supplier_id zaten var.';
GO

IF OBJECT_ID(N'dbo.suppliers', N'U') IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = N'FK_parts_supplier')
    ALTER TABLE dbo.work_order_parts ADD CONSTRAINT FK_parts_supplier
        FOREIGN KEY (supplier_id) REFERENCES dbo.suppliers(id) ON DELETE SET NULL;
GO

IF COL_LENGTH(N'dbo.work_order_parts', N'purchase_price') IS NULL
BEGIN
    ALTER TABLE dbo.work_order_parts ADD purchase_price decimal(12,2) NULL;
    PRINT N'work_order_parts.purchase_price eklendi.';
END
ELSE PRINT N'work_order_parts.purchase_price zaten var.';
GO

IF COL_LENGTH(N'dbo.work_order_parts', N'returned_at') IS NULL
BEGIN
    ALTER TABLE dbo.work_order_parts ADD returned_at datetime2(0) NULL;
    PRINT N'work_order_parts.returned_at eklendi.';
END
ELSE PRINT N'work_order_parts.returned_at zaten var.';
GO

/* --------------------------------------------------------------------------
   Görünümler
   -------------------------------------------------------------------------- */
/* dbo.suppliers hâlâ ayrı bir tabloysa (ilk kurulum), bu betik view'ı ondan
   oluşturur. dbo.suppliers zaten dbo.customers'a taşınmışsa BU BETİK view'a
   DOKUNMAZ — doğru (dbo.customers tabanlı) tanım 07_unify_contacts.sql
   tarafından oluşturulur/korunur. Aksi halde view burada DROP edilip
   "dbo.suppliers" artık var olmadığı için yeniden oluşturulamaz ve API
   /api/suppliers uç noktası (ve dolayısıyla mobil girişteki reloadAll)
   500 hatası verirdi. */
IF OBJECT_ID(N'dbo.suppliers', N'U') IS NOT NULL
BEGIN
    IF OBJECT_ID(N'dbo.vw_SupplierBalance', N'V') IS NOT NULL DROP VIEW dbo.vw_SupplierBalance;
END
GO
IF OBJECT_ID(N'dbo.suppliers', N'U') IS NOT NULL AND OBJECT_ID(N'dbo.vw_SupplierBalance', N'V') IS NULL
EXEC(N'
CREATE VIEW dbo.vw_SupplierBalance AS
SELECT s.id AS supplier_id, s.shop_id,
    s.opening_balance + ISNULL(t.alis_total, 0) - ISNULL(t.odeme_total, 0) - ISNULL(t.iade_total, 0) - ISNULL(t.iskonto_total, 0) AS balance,
    t.last_transaction_at
FROM dbo.suppliers s
OUTER APPLY (
    SELECT
        SUM(CASE WHEN st.type = N''alis'' THEN st.amount ELSE 0 END) AS alis_total,
        SUM(CASE WHEN st.type = N''odeme'' THEN st.amount ELSE 0 END) AS odeme_total,
        SUM(CASE WHEN st.type = N''iade'' THEN st.amount ELSE 0 END) AS iade_total,
        SUM(CASE WHEN st.type = N''iskonto'' THEN st.amount ELSE 0 END) AS iskonto_total,
        MAX(st.created_at) AS last_transaction_at
    FROM dbo.supplier_transactions st
    WHERE st.supplier_id = s.id AND st.shop_id = s.shop_id
) t;
');
GO

/* parts_total artık iade edilmiş (returned_at dolu) parçaları saymaz. */
IF OBJECT_ID(N'dbo.vw_WorkOrderTotals', N'V') IS NOT NULL DROP VIEW dbo.vw_WorkOrderTotals;
GO
CREATE VIEW dbo.vw_WorkOrderTotals AS
SELECT wo.id, wo.shop_id, wo.order_no, wo.status, wo.customer_id, wo.vehicle_id,
    ISNULL(l.labor_total,0) labor_total, ISNULL(p.parts_total,0) parts_total,
    wo.discount_amount,
    ISNULL(l.labor_total,0)+ISNULL(p.parts_total,0)-wo.discount_amount grand_total,
    ISNULL(pay.paid_total,0) paid_total
FROM dbo.work_orders wo
OUTER APPLY (SELECT SUM(s.price) labor_total FROM dbo.services s WHERE s.work_order_id=wo.id) l
OUTER APPLY (SELECT SUM(pp.quantity*pp.unit_price) parts_total FROM dbo.work_order_parts pp WHERE pp.work_order_id=wo.id AND pp.returned_at IS NULL) p
OUTER APPLY (SELECT SUM(py.amount) paid_total FROM dbo.payments py WHERE py.work_order_id=wo.id) pay;
GO

/* --------------------------------------------------------------------------
   Stored procedure'ler
   --------------------------------------------------------------------------
   ÖNEMLİ: sqlcmd varsayılanında QUOTED_IDENTIFIER kapalıdır. stock_products
   üzerinde filtrelenmiş indeks (UX_stock_code) olduğu için prosedürler
   QUOTED_IDENTIFIER OFF ile oluşturulursa stok düşümü UPDATE'i Msg 1934 ile
   patlar ve mobil tarafta HTTP 500 görünür. CREATE PROCEDURE öncesi mutlaka
   açık tutulmalı; SUNUCU-GUNCELLE.bat ayrıca sqlcmd -I kullanır.
   -------------------------------------------------------------------------- */
SET QUOTED_IDENTIFIER ON;
GO
SET ANSI_NULLS ON;
GO
IF OBJECT_ID(N'dbo.usp_AddPartToWorkOrder', N'P') IS NOT NULL DROP PROCEDURE dbo.usp_AddPartToWorkOrder;
GO
CREATE PROCEDURE dbo.usp_AddPartToWorkOrder
    @shop_id uniqueidentifier, @work_order_id uniqueidentifier,
    @stock_product_id uniqueidentifier=NULL, @name nvarchar(200),
    @quantity int, @unit_price decimal(12,2), @created_by uniqueidentifier=NULL,
    @source nvarchar(20)=N'stok', @supplier_id uniqueidentifier=NULL, @purchase_price decimal(12,2)=NULL
AS
BEGIN SET NOCOUNT ON;
    IF @quantity<=0 THROW 50001, N'Miktar 0''dan büyük olmalı.', 1;
    IF NOT EXISTS (SELECT 1 FROM dbo.work_orders WHERE id=@work_order_id AND shop_id=@shop_id)
        THROW 50004, N'İş emri bu servise ait değil.', 1;
    DECLARE @new_part_id uniqueidentifier = NEWID();
    DECLARE @alis_amount decimal(12,2) = ISNULL(@purchase_price,0)*@quantity;
    BEGIN TRY BEGIN TRAN;
        INSERT INTO dbo.work_order_parts
            (id,shop_id,work_order_id,stock_product_id,name,quantity,unit_price,source,supplier_id,purchase_price)
        VALUES
            (@new_part_id,@shop_id,@work_order_id,@stock_product_id,@name,@quantity,@unit_price,@source,@supplier_id,@purchase_price);
        IF @stock_product_id IS NOT NULL BEGIN
            IF (SELECT quantity FROM dbo.stock_products WHERE id=@stock_product_id AND shop_id=@shop_id)<@quantity
                THROW 50002, N'Yetersiz stok.', 1;
            UPDATE dbo.stock_products SET quantity=quantity-@quantity WHERE id=@stock_product_id AND shop_id=@shop_id;
            INSERT INTO dbo.stock_movements (id,shop_id,stock_product_id,change_qty,movement_type,reason,work_order_id,created_by)
            VALUES (NEWID(),@shop_id,@stock_product_id,-@quantity,N'cikis',N'İş emrinde kullanıldı',@work_order_id,@created_by);
        END
        /* CK_suptx_amount amount > 0 ister; bedelsiz alımda cari satırı yazma. */
        IF @source = N'disaridan' AND @supplier_id IS NOT NULL AND @alis_amount > 0 BEGIN
            INSERT INTO dbo.supplier_transactions (id,shop_id,supplier_id,type,amount,work_order_part_id,description,created_by)
            VALUES (NEWID(),@shop_id,@supplier_id,N'alis',@alis_amount,@new_part_id,N'İş emri için dışarıdan alım: '+@name,@created_by);
        END
        COMMIT;
    END TRY BEGIN CATCH IF @@TRANCOUNT>0 ROLLBACK; THROW; END CATCH
END
GO

SET QUOTED_IDENTIFIER ON;
GO
SET ANSI_NULLS ON;
GO
IF OBJECT_ID(N'dbo.usp_ReturnPartToSupplier', N'P') IS NOT NULL DROP PROCEDURE dbo.usp_ReturnPartToSupplier;
GO
CREATE PROCEDURE dbo.usp_ReturnPartToSupplier
    @shop_id uniqueidentifier, @work_order_part_id uniqueidentifier, @created_by uniqueidentifier=NULL
AS
BEGIN SET NOCOUNT ON;
    DECLARE @name nvarchar(200), @source nvarchar(20), @supplier_id uniqueidentifier,
            @returned_at datetime2(0), @purchase_price decimal(12,2), @quantity int;
    SELECT @name=name, @source=source, @supplier_id=supplier_id,
           @returned_at=returned_at, @purchase_price=purchase_price, @quantity=quantity
    FROM dbo.work_order_parts WHERE id=@work_order_part_id AND shop_id=@shop_id;
    IF @@ROWCOUNT = 0 THROW 50005, N'Parça bu servise ait değil.', 1;
    IF @source <> N'disaridan' OR @supplier_id IS NULL
        THROW 50006, N'Bu parça bir tedarikçiden dışarıdan alınmadığı için iade edilemez.', 1;
    IF @returned_at IS NOT NULL
        THROW 50007, N'Bu parça zaten tedarikçiye iade edilmiş.', 1;
    DECLARE @iade_amount decimal(12,2) = ISNULL(@purchase_price,0)*@quantity;
    BEGIN TRY BEGIN TRAN;
        UPDATE dbo.work_order_parts SET returned_at=SYSUTCDATETIME()
        WHERE id=@work_order_part_id AND shop_id=@shop_id;
        IF @iade_amount > 0 BEGIN
            INSERT INTO dbo.supplier_transactions (id,shop_id,supplier_id,type,amount,work_order_part_id,description,created_by)
            VALUES (NEWID(),@shop_id,@supplier_id,N'iade',@iade_amount,@work_order_part_id,N'Tedarikçiye iade: '+@name,@created_by);
        END
        COMMIT;
    END TRY BEGIN CATCH IF @@TRANCOUNT>0 ROLLBACK; THROW; END CATCH
END
GO

PRINT N'Cari (tedarikçi) hesap şeması hazır.';
GO
