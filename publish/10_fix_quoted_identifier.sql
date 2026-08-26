/* ==========================================================================
   OtoServis — QUOTED_IDENTIFIER düzeltmesi (ürün/stok kaydı Msg 1934)
   --------------------------------------------------------------------------
   Türkçe açıklama önekleri NCHAR ile yazılır (sqlcmd codepage'den bağımsız).
   sqlcmd -I -f 65001 ile çalıştırın.
   ========================================================================== */
USE OtoServis;
GO
SET NOCOUNT ON;
SET QUOTED_IDENTIFIER ON;
SET ANSI_NULLS ON;
GO

IF OBJECT_ID(N'dbo.usp_AddPartToWorkOrder', N'P') IS NOT NULL
    DROP PROCEDURE dbo.usp_AddPartToWorkOrder;
GO
SET QUOTED_IDENTIFIER ON;
SET ANSI_NULLS ON;
GO
CREATE PROCEDURE dbo.usp_AddPartToWorkOrder
    @shop_id uniqueidentifier, @work_order_id uniqueidentifier,
    @stock_product_id uniqueidentifier=NULL, @name nvarchar(200),
    @quantity int, @unit_price decimal(12,2), @created_by uniqueidentifier=NULL,
    @source nvarchar(20)=N'stok', @supplier_id uniqueidentifier=NULL, @purchase_price decimal(12,2)=NULL
AS
BEGIN SET NOCOUNT ON;
    IF @quantity<=0 THROW 50001, N'Miktar 0''dan buyuk olmali.', 1;
    IF NOT EXISTS (SELECT 1 FROM dbo.work_orders WHERE id=@work_order_id AND shop_id=@shop_id)
        THROW 50004, N'Is emri bu servise ait degil.', 1;

    /* "İş emri için dışarıdan alım: " */
    DECLARE @desc_alis nvarchar(80) =
        NCHAR(0x0130)+N's emri i'+NCHAR(0x00E7)+N'in d'
        +NCHAR(0x0131)+NCHAR(0x015F)+N'ar'+NCHAR(0x0131)+N'dan al'+NCHAR(0x0131)+N'm: ';

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
            VALUES (NEWID(),@shop_id,@stock_product_id,-@quantity,N'cikis',N'Is emrinde kullanildi',@work_order_id,@created_by);
        END
        IF @source = N'disaridan' AND @supplier_id IS NOT NULL AND @alis_amount > 0 BEGIN
            INSERT INTO dbo.supplier_transactions (id,shop_id,supplier_id,type,amount,work_order_part_id,description,created_by)
            VALUES (NEWID(),@shop_id,@supplier_id,N'alis',@alis_amount,@new_part_id,@desc_alis+@name,@created_by);
        END
        COMMIT;
    END TRY BEGIN CATCH IF @@TRANCOUNT>0 ROLLBACK; THROW; END CATCH
END
GO

IF OBJECT_ID(N'dbo.usp_ReturnPartToSupplier', N'P') IS NOT NULL
    DROP PROCEDURE dbo.usp_ReturnPartToSupplier;
GO
SET QUOTED_IDENTIFIER ON;
SET ANSI_NULLS ON;
GO
CREATE PROCEDURE dbo.usp_ReturnPartToSupplier
    @shop_id uniqueidentifier, @work_order_part_id uniqueidentifier, @created_by uniqueidentifier=NULL
AS
BEGIN SET NOCOUNT ON;
    DECLARE @name nvarchar(200), @source nvarchar(20), @supplier_id uniqueidentifier,
            @returned_at datetime2(0), @purchase_price decimal(12,2), @quantity int;
    /* "Tedarikçiye iade: " */
    DECLARE @desc_iade nvarchar(80) = N'Tedarik'+NCHAR(0x00E7)+N'iye iade: ';

    SELECT @name=name, @source=source, @supplier_id=supplier_id,
           @returned_at=returned_at, @purchase_price=purchase_price, @quantity=quantity
    FROM dbo.work_order_parts WHERE id=@work_order_part_id AND shop_id=@shop_id;
    IF @@ROWCOUNT = 0 THROW 50005, N'Parca bu servise ait degil.', 1;
    IF @source <> N'disaridan' OR @supplier_id IS NULL
        THROW 50006, N'Bu parca tedarikciden disaridan alinmadigi icin iade edilemez.', 1;
    IF @returned_at IS NOT NULL
        THROW 50007, N'Bu parca zaten tedarikciye iade edilmis.', 1;
    DECLARE @iade_amount decimal(12,2) = ISNULL(@purchase_price,0)*@quantity;
    BEGIN TRY BEGIN TRAN;
        UPDATE dbo.work_order_parts SET returned_at=SYSUTCDATETIME()
        WHERE id=@work_order_part_id AND shop_id=@shop_id;
        IF @iade_amount > 0 BEGIN
            INSERT INTO dbo.supplier_transactions (id,shop_id,supplier_id,type,amount,work_order_part_id,description,created_by)
            VALUES (NEWID(),@shop_id,@supplier_id,N'iade',@iade_amount,@work_order_part_id,@desc_iade+@name,@created_by);
        END
        COMMIT;
    END TRY BEGIN CATCH IF @@TRANCOUNT>0 ROLLBACK; THROW; END CATCH
END
GO

SELECT
    p.name AS proc_name,
    OBJECTPROPERTY(p.object_id, 'ExecIsQuotedIdentOn') AS quoted_ident_on,
    OBJECTPROPERTY(p.object_id, 'ExecIsAnsiNullsOn') AS ansi_nulls_on
FROM sys.procedures p
WHERE p.name IN (N'usp_AddPartToWorkOrder', N'usp_ReturnPartToSupplier');
GO

PRINT N'QUOTED_IDENTIFIER duzeltmesi tamam.';
GO
