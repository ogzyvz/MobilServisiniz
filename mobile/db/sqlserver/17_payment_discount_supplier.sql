/*
  17 — Ödeme CRUD desteği + alış fiyatı cari senkronu + tedarikçi iskonto
  - usp_UpdateWorkOrderPart: @purchase_price
  - supplier_transactions: type iskonto + method kolonu
  - vw_SupplierBalance: iskonto düşümü
*/
USE OtoServis;
GO
SET NOCOUNT ON;
SET QUOTED_IDENTIFIER ON;
SET ANSI_NULLS ON;
GO

/* method kolonu (ödeme/iskonto için opsiyonel) */
IF COL_LENGTH(N'dbo.supplier_transactions', N'method') IS NULL
BEGIN
    ALTER TABLE dbo.supplier_transactions ADD method nvarchar(20) NULL;
    PRINT N'supplier_transactions.method eklendi.';
END
ELSE
    PRINT N'supplier_transactions.method zaten var.';
GO

/* CK: iskonto tipi */
IF EXISTS (
    SELECT 1 FROM sys.check_constraints
    WHERE name = N'CK_suptx_type' AND parent_object_id = OBJECT_ID(N'dbo.supplier_transactions')
)
BEGIN
    ALTER TABLE dbo.supplier_transactions DROP CONSTRAINT CK_suptx_type;
END
GO
ALTER TABLE dbo.supplier_transactions WITH NOCHECK
ADD CONSTRAINT CK_suptx_type CHECK (type IN (N'alis', N'odeme', N'iade', N'iskonto'));
GO
PRINT N'CK_suptx_type guncellendi (iskonto dahil).';
GO

/* Bakiye view */
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
PRINT N'vw_SupplierBalance guncellendi.';
GO

/* UpdatePart — purchase_price + alis sync */
IF OBJECT_ID(N'dbo.usp_UpdateWorkOrderPart', N'P') IS NOT NULL
    DROP PROCEDURE dbo.usp_UpdateWorkOrderPart;
GO
SET QUOTED_IDENTIFIER ON;
SET ANSI_NULLS ON;
GO
CREATE PROCEDURE dbo.usp_UpdateWorkOrderPart
    @shop_id uniqueidentifier,
    @work_order_id uniqueidentifier,
    @work_order_part_id uniqueidentifier,
    @name nvarchar(200),
    @quantity int,
    @unit_price decimal(12,2),
    @created_by uniqueidentifier = NULL,
    @purchase_price decimal(12,2) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    IF @quantity <= 0 THROW 50001, N'Miktar 0''dan buyuk olmali.', 1;

    DECLARE @stock_product_id uniqueidentifier, @old_qty int, @source nvarchar(20),
            @supplier_id uniqueidentifier, @old_purchase_price decimal(12,2),
            @returned_at datetime2(0), @wo_status nvarchar(20);
    DECLARE @desc_alis nvarchar(80) =
        NCHAR(0x0130)+N's emri i'+NCHAR(0x00E7)+N'in d'
        +NCHAR(0x0131)+NCHAR(0x015F)+N'ar'+NCHAR(0x0131)+N'dan al'+NCHAR(0x0131)+N'm: ';

    SELECT @wo_status = status
    FROM dbo.work_orders
    WHERE id = @work_order_id AND shop_id = @shop_id;
    IF @wo_status IS NULL THROW 50004, N'Is emri bu servise ait degil.', 1;

    SELECT @stock_product_id = stock_product_id, @old_qty = quantity, @source = source,
           @supplier_id = supplier_id, @old_purchase_price = purchase_price, @returned_at = returned_at
    FROM dbo.work_order_parts
    WHERE id = @work_order_part_id AND work_order_id = @work_order_id AND shop_id = @shop_id;
    IF @@ROWCOUNT = 0 THROW 50005, N'Parca bu servise ait degil.', 1;
    IF @returned_at IS NOT NULL
        THROW 50008, N'Tedarikciye iade edilmis parca duzenlenemez.', 1;

    DECLARE @new_purchase decimal(12,2) =
        CASE WHEN @purchase_price IS NULL THEN @old_purchase_price ELSE @purchase_price END;
    DECLARE @delta int = @quantity - @old_qty;

    BEGIN TRY BEGIN TRAN;
        IF @stock_product_id IS NOT NULL AND @delta <> 0 BEGIN
            IF @delta > 0 BEGIN
                IF (SELECT quantity FROM dbo.stock_products WHERE id = @stock_product_id AND shop_id = @shop_id) < @delta
                    THROW 50002, N'Yetersiz stok.', 1;
                UPDATE dbo.stock_products SET quantity = quantity - @delta
                WHERE id = @stock_product_id AND shop_id = @shop_id;
                INSERT INTO dbo.stock_movements (id, shop_id, stock_product_id, change_qty, movement_type, reason, work_order_id, created_by)
                VALUES (NEWID(), @shop_id, @stock_product_id, -@delta, N'cikis', N'Is emri parca guncelleme', @work_order_id, @created_by);
            END ELSE BEGIN
                UPDATE dbo.stock_products SET quantity = quantity + ABS(@delta)
                WHERE id = @stock_product_id AND shop_id = @shop_id;
                INSERT INTO dbo.stock_movements (id, shop_id, stock_product_id, change_qty, movement_type, reason, work_order_id, created_by)
                VALUES (NEWID(), @shop_id, @stock_product_id, ABS(@delta), N'giris', N'Is emri parca guncelleme (iade stoga)', @work_order_id, @created_by);
            END
        END

        UPDATE dbo.work_order_parts
        SET name = @name,
            quantity = @quantity,
            unit_price = @unit_price,
            purchase_price = CASE WHEN @source = N'disaridan' THEN @new_purchase ELSE purchase_price END
        WHERE id = @work_order_part_id AND work_order_id = @work_order_id AND shop_id = @shop_id;

        IF @source = N'disaridan' AND @supplier_id IS NOT NULL BEGIN
            DECLARE @alis_amount decimal(12,2) = ISNULL(@new_purchase, 0) * @quantity;
            IF EXISTS (
                SELECT 1 FROM dbo.supplier_transactions
                WHERE work_order_part_id = @work_order_part_id AND shop_id = @shop_id AND type = N'alis'
            )
            BEGIN
                IF @alis_amount > 0
                    UPDATE dbo.supplier_transactions
                    SET amount = @alis_amount, description = @desc_alis + @name
                    WHERE work_order_part_id = @work_order_part_id AND shop_id = @shop_id AND type = N'alis';
                ELSE
                    DELETE FROM dbo.supplier_transactions
                    WHERE work_order_part_id = @work_order_part_id AND shop_id = @shop_id AND type = N'alis';
            END
            ELSE IF @alis_amount > 0
                INSERT INTO dbo.supplier_transactions (id, shop_id, supplier_id, type, amount, work_order_part_id, description, created_by)
                VALUES (NEWID(), @shop_id, @supplier_id, N'alis', @alis_amount, @work_order_part_id, @desc_alis + @name, @created_by);
        END

        COMMIT;
    END TRY BEGIN CATCH IF @@TRANCOUNT > 0 ROLLBACK; THROW; END CATCH
END
GO

PRINT N'17_payment_discount_supplier OK.';
GO
