/* ==========================================================================
   OtoServis — Tedarikçi hareket açıklamalarındaki Türkçe bozulma (mojibake)
   --------------------------------------------------------------------------
   Neden: SQL prosedürleri UTF-8 dosyadan yanlış codepage ile kurulunca
   N'İş emri…' önekleri bozuk yazıldı (Ä°ÅŸ, Ã§, …). Ürün adı API'den
   geldiği için genelde sağlam kalır.

   Bu script:
   1) Mevcut bozuk description kayıtlarını düzeltir
   2) SP'leri NCHAR ile (dosya encoding'inden bağımsız) yeniden oluşturur

   13_payment_status_iban.sql'den SONRA, sqlcmd -I ile çalıştırın.
   ========================================================================== */
USE OtoServis;
GO
SET NOCOUNT ON;
SET QUOTED_IDENTIFIER ON;
SET ANSI_NULLS ON;
GO

/* ---------- 1) Mevcut kayitlari duzelt (arama kaliplari NCHAR — dosya encoding'den bagimsiz) ---------- */
/* Not: SQL Server degisken adlari case-insensitive (@foo = @FOO). Isimler tamamen benzersiz olmali. */
DECLARE @fixed int = 0;
DECLARE
    @pat_I_cap   nvarchar(2) = NCHAR(0x00C4)+NCHAR(0x00B0), /* → İ */
    @pat_i_dot   nvarchar(2) = NCHAR(0x00C4)+NCHAR(0x00B1), /* → ı */
    @pat_c_lo    nvarchar(2) = NCHAR(0x00C3)+NCHAR(0x00A7), /* → ç */
    @pat_o_lo    nvarchar(2) = NCHAR(0x00C3)+NCHAR(0x00B6), /* → ö */
    @pat_u_lo    nvarchar(2) = NCHAR(0x00C3)+NCHAR(0x00BC), /* → ü */
    @pat_c_cap   nvarchar(2) = NCHAR(0x00C3)+NCHAR(0x0087), /* → Ç */
    @pat_o_cap   nvarchar(2) = NCHAR(0x00C3)+NCHAR(0x0096), /* → Ö */
    @pat_u_cap   nvarchar(2) = NCHAR(0x00C3)+NCHAR(0x009C), /* → Ü */
    @pat_s_cp    nvarchar(2) = NCHAR(0x00C5)+NCHAR(0x0178), /* → ş (CP1252) */
    @pat_s_alt   nvarchar(2) = NCHAR(0x00C5)+NCHAR(0x017E), /* → ş alt */
    @pat_sc_cp   nvarchar(2) = NCHAR(0x00C5)+NCHAR(0x017D), /* → Ş */
    @pat_sc_alt  nvarchar(2) = NCHAR(0x00C5)+NCHAR(0x009E), /* → Ş alt */
    @pat_g_cp    nvarchar(2) = NCHAR(0x00C4)+NCHAR(0x0178), /* → ğ */
    @pat_g_alt   nvarchar(2) = NCHAR(0x00C4)+NCHAR(0x009F), /* → ğ alt */
    @pat_gc_cp   nvarchar(2) = NCHAR(0x00C4)+NCHAR(0x017E), /* → Ğ */
    @pat_gc_alt  nvarchar(2) = NCHAR(0x00C4)+NCHAR(0x009E); /* → Ğ alt */

UPDATE dbo.supplier_transactions
SET description =
    REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(
    REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(
    REPLACE(REPLACE(REPLACE(REPLACE(
        description,
        @pat_I_cap, NCHAR(0x0130)),
        @pat_s_cp, NCHAR(0x015F)),
        @pat_s_alt, NCHAR(0x015F)),
        @pat_c_lo, NCHAR(0x00E7)),
        @pat_i_dot, NCHAR(0x0131)),
        @pat_o_lo, NCHAR(0x00F6)),
        @pat_u_lo, NCHAR(0x00FC)),
        @pat_g_cp, NCHAR(0x011F)),
        @pat_g_alt, NCHAR(0x011F)),
        @pat_sc_cp, NCHAR(0x015E)),
        @pat_sc_alt, NCHAR(0x015E)),
        @pat_c_cap, NCHAR(0x00C7)),
        @pat_o_cap, NCHAR(0x00D6)),
        @pat_u_cap, NCHAR(0x00DC)),
        @pat_gc_cp, NCHAR(0x011E)),
        @pat_gc_alt, NCHAR(0x011E))
WHERE description LIKE N'%'+NCHAR(0x00C4)+N'%'
   OR description LIKE N'%'+NCHAR(0x00C3)+N'%'
   OR description LIKE N'%'+NCHAR(0x00C5)+N'%';

SET @fixed = @@ROWCOUNT;
PRINT CONCAT(N'supplier_transactions duzeltilen satir: ', @fixed);
GO

/* ---------- 2) SP: AddPart — açıklama NCHAR ile ---------- */
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

    /* "İş emri için dışarıdan alım: " — dosya encoding'inden bağımsız */
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

/* ---------- 3) SP: ReturnPart ---------- */
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

/* ---------- 4) Update part SP (varsa) — açıklama öneki ---------- */
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
    IF @quantity <= 0 THROW 50001, N'Miktar 0''dan buyuk olmali.', 1;

    DECLARE @stock_product_id uniqueidentifier, @old_qty int, @source nvarchar(20),
            @supplier_id uniqueidentifier, @purchase_price decimal(12,2),
            @returned_at datetime2(0), @wo_status nvarchar(20);
    DECLARE @desc_alis nvarchar(80) =
        NCHAR(0x0130)+N's emri i'+NCHAR(0x00E7)+N'in d'
        +NCHAR(0x0131)+NCHAR(0x015F)+N'ar'+NCHAR(0x0131)+N'dan al'+NCHAR(0x0131)+N'm: ';

    SELECT @wo_status = status
    FROM dbo.work_orders
    WHERE id = @work_order_id AND shop_id = @shop_id;
    IF @wo_status IS NULL THROW 50004, N'Is emri bu servise ait degil.', 1;

    SELECT @stock_product_id = stock_product_id, @old_qty = quantity, @source = source,
           @supplier_id = supplier_id, @purchase_price = purchase_price, @returned_at = returned_at
    FROM dbo.work_order_parts
    WHERE id = @work_order_part_id AND work_order_id = @work_order_id AND shop_id = @shop_id;
    IF @@ROWCOUNT = 0 THROW 50005, N'Parca bu servise ait degil.', 1;
    IF @returned_at IS NOT NULL
        THROW 50008, N'Tedarikciye iade edilmis parca duzenlenemez.', 1;

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

        IF @source = N'disaridan' AND @supplier_id IS NOT NULL BEGIN
            DECLARE @alis_amount decimal(12,2) = ISNULL(@purchase_price, 0) * @quantity;
            IF EXISTS (
                SELECT 1 FROM dbo.supplier_transactions
                WHERE work_order_part_id = @work_order_part_id AND shop_id = @shop_id AND type = N'alis'
            )
                UPDATE dbo.supplier_transactions
                SET amount = @alis_amount, description = @desc_alis + @name
                WHERE work_order_part_id = @work_order_part_id AND shop_id = @shop_id AND type = N'alis';
            ELSE IF @alis_amount > 0
                INSERT INTO dbo.supplier_transactions (id, shop_id, supplier_id, type, amount, work_order_part_id, description, created_by)
                VALUES (NEWID(), @shop_id, @supplier_id, N'alis', @alis_amount, @work_order_part_id, @desc_alis + @name, @created_by);
        END

        UPDATE dbo.work_order_parts
        SET name = @name, quantity = @quantity, unit_price = @unit_price
        WHERE id = @work_order_part_id AND work_order_id = @work_order_id AND shop_id = @shop_id;
        COMMIT;
    END TRY BEGIN CATCH IF @@TRANCOUNT > 0 ROLLBACK; THROW; END CATCH
END
GO

PRINT N'Tedarikci aciklama encoding duzeltmesi tamam.';
GO
