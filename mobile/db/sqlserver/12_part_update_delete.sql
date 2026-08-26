/* ==========================================================================
   OtoServis — Parça güncelle / sil (stok + tedarikçi cari tutarlılığı)
   --------------------------------------------------------------------------
   sqlcmd -I ile çalıştırın (Quoted Identifier ON).
   10_fix_quoted_identifier.sql'den SONRA.
   ========================================================================== */
USE OtoServis;
GO
SET NOCOUNT ON;
SET QUOTED_IDENTIFIER ON;
SET ANSI_NULLS ON;
GO

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
    @created_by uniqueidentifier = NULL
AS
BEGIN
    SET NOCOUNT ON;
    IF @quantity <= 0 THROW 50001, N'Miktar 0''dan büyük olmalı.', 1;

    DECLARE @stock_product_id uniqueidentifier, @old_qty int, @source nvarchar(20),
            @supplier_id uniqueidentifier, @purchase_price decimal(12,2),
            @returned_at datetime2(0), @wo_status nvarchar(20);

    SELECT @wo_status = status
    FROM dbo.work_orders
    WHERE id = @work_order_id AND shop_id = @shop_id;
    IF @wo_status IS NULL THROW 50004, N'İş emri bu servise ait değil.', 1;

    SELECT @stock_product_id = stock_product_id, @old_qty = quantity, @source = source,
           @supplier_id = supplier_id, @purchase_price = purchase_price, @returned_at = returned_at
    FROM dbo.work_order_parts
    WHERE id = @work_order_part_id AND work_order_id = @work_order_id AND shop_id = @shop_id;
    IF @@ROWCOUNT = 0 THROW 50005, N'Parça bu servise ait değil.', 1;
    IF @returned_at IS NOT NULL
        THROW 50008, N'Tedarikçiye iade edilmiş parça düzenlenemez.', 1;

    DECLARE @delta int = @quantity - @old_qty;

    BEGIN TRY BEGIN TRAN;
        IF @stock_product_id IS NOT NULL AND @delta <> 0 BEGIN
            IF @delta > 0 BEGIN
                IF (SELECT quantity FROM dbo.stock_products WHERE id = @stock_product_id AND shop_id = @shop_id) < @delta
                    THROW 50002, N'Yetersiz stok.', 1;
                UPDATE dbo.stock_products SET quantity = quantity - @delta
                WHERE id = @stock_product_id AND shop_id = @shop_id;
                INSERT INTO dbo.stock_movements (id, shop_id, stock_product_id, change_qty, movement_type, reason, work_order_id, created_by)
                VALUES (NEWID(), @shop_id, @stock_product_id, -@delta, N'cikis', N'İş emri parça güncelleme', @work_order_id, @created_by);
            END ELSE BEGIN
                UPDATE dbo.stock_products SET quantity = quantity + ABS(@delta)
                WHERE id = @stock_product_id AND shop_id = @shop_id;
                INSERT INTO dbo.stock_movements (id, shop_id, stock_product_id, change_qty, movement_type, reason, work_order_id, created_by)
                VALUES (NEWID(), @shop_id, @stock_product_id, ABS(@delta), N'giris', N'İş emri parça güncelleme (iade stoğa)', @work_order_id, @created_by);
            END
        END

        IF @source = N'disaridan' AND @supplier_id IS NOT NULL BEGIN
            DECLARE @alis_amount decimal(12,2) = ISNULL(@purchase_price, 0) * @quantity;
            IF EXISTS (
                SELECT 1 FROM dbo.supplier_transactions
                WHERE work_order_part_id = @work_order_part_id AND shop_id = @shop_id AND type = N'alis'
            )
                UPDATE dbo.supplier_transactions
                SET amount = @alis_amount,
                    description = N'İş emri için dışarıdan alım: ' + @name
                WHERE work_order_part_id = @work_order_part_id AND shop_id = @shop_id AND type = N'alis';
            ELSE IF @alis_amount > 0
                INSERT INTO dbo.supplier_transactions (id, shop_id, supplier_id, type, amount, work_order_part_id, description, created_by)
                VALUES (NEWID(), @shop_id, @supplier_id, N'alis', @alis_amount, @work_order_part_id, N'İş emri için dışarıdan alım: ' + @name, @created_by);
        END

        UPDATE dbo.work_order_parts
        SET name = @name, quantity = @quantity, unit_price = @unit_price
        WHERE id = @work_order_part_id AND work_order_id = @work_order_id AND shop_id = @shop_id;
        COMMIT;
    END TRY BEGIN CATCH IF @@TRANCOUNT > 0 ROLLBACK; THROW; END CATCH
END
GO

IF OBJECT_ID(N'dbo.usp_DeleteWorkOrderPart', N'P') IS NOT NULL
    DROP PROCEDURE dbo.usp_DeleteWorkOrderPart;
GO
SET QUOTED_IDENTIFIER ON;
SET ANSI_NULLS ON;
GO
CREATE PROCEDURE dbo.usp_DeleteWorkOrderPart
    @shop_id uniqueidentifier,
    @work_order_id uniqueidentifier,
    @work_order_part_id uniqueidentifier,
    @created_by uniqueidentifier = NULL
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @stock_product_id uniqueidentifier, @qty int, @source nvarchar(20),
            @supplier_id uniqueidentifier, @returned_at datetime2(0), @name nvarchar(200),
            @wo_status nvarchar(20);

    SELECT @wo_status = status
    FROM dbo.work_orders
    WHERE id = @work_order_id AND shop_id = @shop_id;
    IF @wo_status IS NULL THROW 50004, N'İş emri bu servise ait değil.', 1;

    SELECT @stock_product_id = stock_product_id, @qty = quantity, @source = source,
           @supplier_id = supplier_id, @returned_at = returned_at, @name = name
    FROM dbo.work_order_parts
    WHERE id = @work_order_part_id AND work_order_id = @work_order_id AND shop_id = @shop_id;
    IF @@ROWCOUNT = 0 THROW 50005, N'Parça bu servise ait değil.', 1;
    IF @returned_at IS NOT NULL
        THROW 50008, N'Tedarikçiye iade edilmiş parça silinemez.', 1;

    BEGIN TRY BEGIN TRAN;
        IF @stock_product_id IS NOT NULL AND @qty > 0 BEGIN
            UPDATE dbo.stock_products SET quantity = quantity + @qty
            WHERE id = @stock_product_id AND shop_id = @shop_id;
            INSERT INTO dbo.stock_movements (id, shop_id, stock_product_id, change_qty, movement_type, reason, work_order_id, created_by)
            VALUES (NEWID(), @shop_id, @stock_product_id, @qty, N'giris', N'İş emrinden parça silindi (stoğa iade)', @work_order_id, @created_by);
        END

        -- Dışarıdan alım cari hareketlerini temizle (iade edilmişse zaten yukarıda engellendi)
        DELETE FROM dbo.supplier_transactions
        WHERE work_order_part_id = @work_order_part_id AND shop_id = @shop_id;

        DELETE FROM dbo.work_order_parts
        WHERE id = @work_order_part_id AND work_order_id = @work_order_id AND shop_id = @shop_id;
        COMMIT;
    END TRY BEGIN CATCH IF @@TRANCOUNT > 0 ROLLBACK; THROW; END CATCH
END
GO

SELECT
    p.name AS proc_name,
    OBJECTPROPERTY(p.object_id, 'ExecIsQuotedIdentOn') AS quoted_ident_on
FROM sys.procedures p
WHERE p.name IN (N'usp_UpdateWorkOrderPart', N'usp_DeleteWorkOrderPart');
GO

PRINT N'Parça güncelle/sil prosedürleri hazır.';
GO
