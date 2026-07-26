/* ==========================================================================
   OtoServis — Müşteri / Tedarikçi birleştirme (unify contacts)
   --------------------------------------------------------------------------
   Mevcut sunucu DB'sinde çalıştırın (SSMS / sqlcmd), 06_supplier_ledger.sql'den SONRA.

   Amaç: dbo.customers ve dbo.suppliers ayrı tablolardı; artık TEK kayıt tipi
   var (dbo.customers), is_customer / is_supplier bayraklarıyla. Bir kayıt
   sadece müşteri, sadece tedarikçi ya da her ikisi birden olabilir.

   Adımlar:
   1) dbo.customers'a yeni kolonlar: is_supplier, is_customer, contact_person,
      opening_balance.
   2) UX_customers_phone benzersiz indeksini filtrelenmiş hale getiriyoruz
      (boş telefonlar artık çakışma sayılmıyor) — aşağıda neden gerektiği
      açıklanıyor.
   3) dbo.suppliers'daki her satırı, AYNI id ile dbo.customers'a taşıyoruz
      (kritik: supplier_transactions.supplier_id ve work_order_parts.supplier_id
      FK'leri hiçbir satır güncellenmeden çalışmaya devam etsin diye).
   4) FK_suptx_supplier, FK_parts_supplier, FK_stock_supplier artık
      dbo.customers(id)'e işaret edecek şekilde düşürülüp yeniden oluşturulur.
   5) dbo.vw_SupplierBalance artık dbo.customers'a bakıyor (is_supplier=1);
      dbo.vw_ShopDashboard'daki müşteri sayacı is_customer=1 ile sınırlanır
      (yoksa taşınan yalnızca-tedarikçi kayıtlar "müşteri" olarak sayılırdı).
   6) dbo.suppliers, güvenlik ağı olarak SİLİNMEDEN dbo.suppliers_deprecated
      adına yeniden adlandırılır (veri kaybı riskine karşı).

   Telefon çakışması notu:
   - dbo.customers.phone NOT NULL, dbo.suppliers.phone NULL olabiliyordu.
   - UX_customers_phone (shop_id, phone) üzerinde filtresiz bir UNIQUE INDEX
     idi; telefonu olmayan birden fazla tedarikçiyi boş string ile taşırsak
     bu indeks patlardı. Bu yüzden indeksi "WHERE phone <> N''" filtresiyle
     yeniden kuruyoruz — boş telefonlu kayıtlar artık benzersizlik kontrolüne
     girmiyor (en az invaziv çözüm; mevcut hiçbir müşteri kaydını bozmaz,
     çünkü customers.phone zaten NOT NULL'du ve gerçek veride boş string
     olması beklenmez).
   - Gerçek (boş olmayan) bir tedarikçi telefonu, aynı şubedeki bir müşterinin
     telefonuyla çakışıyorsa, INSERT'in tamamının patlamasını önlemek için
     SADECE o çakışan satıra "-T1", "-T2" ... gibi ayırt edici bir sonek
     ekliyoruz (aşağıdaki döngü). Bu nadir bir durum olduğundan aşağıya not
     düşülüyor; böyle bir çakışma olursa dükkan sahibinin o tedarikçinin
     telefon numarasını elle düzeltmesi önerilir (bkz. final rapor).
   ========================================================================== */

USE OtoServis;
GO
SET NOCOUNT ON;
GO

/* --------------------------------------------------------------------------
   1) customers — yeni alanlar
   -------------------------------------------------------------------------- */
IF COL_LENGTH(N'dbo.customers', N'is_supplier') IS NULL
BEGIN
    ALTER TABLE dbo.customers ADD is_supplier bit NOT NULL CONSTRAINT DF_customers_is_supplier DEFAULT 0;
    PRINT N'customers.is_supplier eklendi.';
END
ELSE PRINT N'customers.is_supplier zaten var.';
GO

IF COL_LENGTH(N'dbo.customers', N'is_customer') IS NULL
BEGIN
    ALTER TABLE dbo.customers ADD is_customer bit NOT NULL CONSTRAINT DF_customers_is_customer DEFAULT 1;
    PRINT N'customers.is_customer eklendi.';
END
ELSE PRINT N'customers.is_customer zaten var.';
GO

IF COL_LENGTH(N'dbo.customers', N'contact_person') IS NULL
BEGIN
    ALTER TABLE dbo.customers ADD contact_person nvarchar(150) NULL;
    PRINT N'customers.contact_person eklendi.';
END
ELSE PRINT N'customers.contact_person zaten var.';
GO

IF COL_LENGTH(N'dbo.customers', N'opening_balance') IS NULL
BEGIN
    ALTER TABLE dbo.customers ADD opening_balance decimal(12,2) NOT NULL CONSTRAINT DF_customers_opening_balance DEFAULT 0;
    PRINT N'customers.opening_balance eklendi.';
END
ELSE PRINT N'customers.opening_balance zaten var.';
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_customers_is_supplier' AND object_id = OBJECT_ID(N'dbo.customers'))
    CREATE INDEX IX_customers_is_supplier ON dbo.customers(shop_id, is_supplier) WHERE is_supplier = 1;
GO

/* --------------------------------------------------------------------------
   2) UX_customers_phone — boş telefonları benzersizlik kontrolünden hariç tut
   -------------------------------------------------------------------------- */
IF EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE name = N'UX_customers_phone' AND object_id = OBJECT_ID(N'dbo.customers') AND filter_definition IS NULL
)
BEGIN
    DROP INDEX UX_customers_phone ON dbo.customers;
    CREATE UNIQUE INDEX UX_customers_phone ON dbo.customers(shop_id, phone) WHERE phone <> N'';
    PRINT N'UX_customers_phone filtrelenmiş hale getirildi (boş telefonlar artık çakışma sayılmıyor).';
END
ELSE PRINT N'UX_customers_phone zaten filtrelenmiş ya da bulunamadı.';
GO

/* --------------------------------------------------------------------------
   3) dbo.suppliers -> dbo.customers taşıma (id KORUNUR)
   -------------------------------------------------------------------------- */
IF OBJECT_ID(N'dbo.suppliers', N'U') IS NOT NULL
BEGIN
    DECLARE @supplier_id uniqueidentifier, @shop_id uniqueidentifier, @name nvarchar(200),
            @contact nvarchar(100), @phone nvarchar(30), @email nvarchar(150),
            @address nvarchar(300), @tax_no nvarchar(20), @opening_balance decimal(12,2),
            @is_active bit, @created_at datetime2(0), @updated_at datetime2(0),
            @raw_phone nvarchar(30), @final_phone nvarchar(30), @suffix int, @migrated int = 0;

    DECLARE supplier_cursor CURSOR LOCAL FAST_FORWARD FOR
        SELECT s.id, s.shop_id, s.name, s.contact, s.phone, s.email, s.address, s.tax_no,
               s.opening_balance, s.is_active, s.created_at, s.updated_at
        FROM dbo.suppliers s
        WHERE NOT EXISTS (SELECT 1 FROM dbo.customers c WHERE c.id = s.id);

    OPEN supplier_cursor;
    FETCH NEXT FROM supplier_cursor INTO @supplier_id, @shop_id, @name, @contact, @phone, @email,
        @address, @tax_no, @opening_balance, @is_active, @created_at, @updated_at;

    WHILE @@FETCH_STATUS = 0
    BEGIN
        SET @raw_phone = ISNULL(NULLIF(LTRIM(RTRIM(@phone)), N''), N'');
        SET @final_phone = @raw_phone;

        IF @final_phone <> N''
        BEGIN
            SET @suffix = 0;
            WHILE EXISTS (SELECT 1 FROM dbo.customers WHERE shop_id = @shop_id AND phone = @final_phone)
            BEGIN
                SET @suffix += 1;
                SET @final_phone = LEFT(@raw_phone, 25) + N'-T' + CAST(@suffix AS nvarchar(5));
            END
            IF @final_phone <> @raw_phone
                PRINT N'UYARI: Tedarikçi ' + CAST(@supplier_id AS nvarchar(36)) + N' (' + @name
                    + N') telefonu (' + @raw_phone + N') şubedeki bir müşteriyle çakıştığı için '
                    + @final_phone + N' olarak kaydedildi. Lütfen elle kontrol edin.';
        END

        INSERT INTO dbo.customers
            (id, shop_id, customer_type, full_name, contact_person, phone, email, address,
             tax_no, opening_balance, is_active, is_supplier, is_customer, created_at, updated_at)
        VALUES
            (@supplier_id, @shop_id, N'kurumsal', @name, @contact, @final_phone, @email, @address,
             @tax_no, @opening_balance, @is_active, 1, 0, @created_at, @updated_at);

        SET @migrated += 1;

        FETCH NEXT FROM supplier_cursor INTO @supplier_id, @shop_id, @name, @contact, @phone, @email,
            @address, @tax_no, @opening_balance, @is_active, @created_at, @updated_at;
    END

    CLOSE supplier_cursor;
    DEALLOCATE supplier_cursor;

    PRINT N'suppliers -> customers taşıması tamamlandı. Taşınan kayıt: ' + CAST(@migrated AS nvarchar(10));
END
ELSE PRINT N'dbo.suppliers bulunamadı (muhtemelen zaten taşındı).';
GO

/* --------------------------------------------------------------------------
   4) FK'leri dbo.customers'a yönlendir
   -------------------------------------------------------------------------- */
IF EXISTS (
    SELECT 1 FROM sys.foreign_keys fk
    WHERE fk.name = N'FK_suptx_supplier' AND fk.referenced_object_id = OBJECT_ID(N'dbo.suppliers')
)
BEGIN
    ALTER TABLE dbo.supplier_transactions DROP CONSTRAINT FK_suptx_supplier;
    ALTER TABLE dbo.supplier_transactions ADD CONSTRAINT FK_suptx_supplier
        FOREIGN KEY (supplier_id) REFERENCES dbo.customers(id);
    PRINT N'FK_suptx_supplier artık dbo.customers tablosuna işaret ediyor.';
END
ELSE PRINT N'FK_suptx_supplier zaten dbo.customers tablosuna işaret ediyor (ya da bulunamadı).';
GO

IF EXISTS (
    SELECT 1 FROM sys.foreign_keys fk
    WHERE fk.name = N'FK_parts_supplier' AND fk.referenced_object_id = OBJECT_ID(N'dbo.suppliers')
)
BEGIN
    ALTER TABLE dbo.work_order_parts DROP CONSTRAINT FK_parts_supplier;
    ALTER TABLE dbo.work_order_parts ADD CONSTRAINT FK_parts_supplier
        FOREIGN KEY (supplier_id) REFERENCES dbo.customers(id) ON DELETE SET NULL;
    PRINT N'FK_parts_supplier artık dbo.customers tablosuna işaret ediyor.';
END
ELSE PRINT N'FK_parts_supplier zaten dbo.customers tablosuna işaret ediyor (ya da bulunamadı).';
GO

/* stock_products.supplier_id de aynı eski suppliers tablosuna bakıyordu;
   görevde açıkça istenmese de tutarlılık için burada da yönlendiriyoruz —
   aksi halde stok ürününe yeni (yalnızca-tedarikçi) bir cari atanamazdı. */
IF EXISTS (
    SELECT 1 FROM sys.foreign_keys fk
    WHERE fk.name = N'FK_stock_supplier' AND fk.referenced_object_id = OBJECT_ID(N'dbo.suppliers')
)
BEGIN
    ALTER TABLE dbo.stock_products DROP CONSTRAINT FK_stock_supplier;
    ALTER TABLE dbo.stock_products ADD CONSTRAINT FK_stock_supplier
        FOREIGN KEY (supplier_id) REFERENCES dbo.customers(id) ON DELETE SET NULL;
    PRINT N'FK_stock_supplier artık dbo.customers tablosuna işaret ediyor.';
END
ELSE PRINT N'FK_stock_supplier zaten dbo.customers tablosuna işaret ediyor (ya da bulunamadı).';
GO

/* --------------------------------------------------------------------------
   5) vw_SupplierBalance — artık dbo.customers (is_supplier=1) üzerinden
   -------------------------------------------------------------------------- */
IF OBJECT_ID(N'dbo.vw_SupplierBalance', N'V') IS NOT NULL DROP VIEW dbo.vw_SupplierBalance;
GO
CREATE VIEW dbo.vw_SupplierBalance AS
SELECT c.id AS supplier_id, c.shop_id,
    c.opening_balance + ISNULL(t.alis_total, 0) - ISNULL(t.odeme_total, 0) - ISNULL(t.iade_total, 0) AS balance,
    t.last_transaction_at
FROM dbo.customers c
OUTER APPLY (
    SELECT
        SUM(CASE WHEN st.type = N'alis' THEN st.amount ELSE 0 END) AS alis_total,
        SUM(CASE WHEN st.type = N'odeme' THEN st.amount ELSE 0 END) AS odeme_total,
        SUM(CASE WHEN st.type = N'iade' THEN st.amount ELSE 0 END) AS iade_total,
        MAX(st.created_at) AS last_transaction_at
    FROM dbo.supplier_transactions st
    WHERE st.supplier_id = c.id
) t
WHERE c.is_supplier = 1;
GO

/* vw_ShopDashboard'daki "customers" sayacı is_customer filtresi olmadan
   dbo.customers'ın tamamını sayıyordu; birleştirmeden sonra bu, taşınan
   yalnızca-tedarikçi kayıtlarını da "müşteri" olarak saymaya başlardı.
   Sayacı is_customer=1 ile sınırlıyoruz ki dashboard eskisi gibi doğru
   müşteri sayısını göstersin. */
IF OBJECT_ID(N'dbo.vw_ShopDashboard', N'V') IS NOT NULL DROP VIEW dbo.vw_ShopDashboard;
GO
CREATE VIEW dbo.vw_ShopDashboard AS
SELECT s.id shop_id, s.tenant_code, s.name shop_name,
    (SELECT COUNT(*) FROM dbo.work_orders wo WHERE wo.shop_id=s.id AND wo.status=N'bekliyor') waiting,
    (SELECT COUNT(*) FROM dbo.work_orders wo WHERE wo.shop_id=s.id AND wo.status=N'islemde') in_progress,
    (SELECT COUNT(*) FROM dbo.customers c WHERE c.shop_id=s.id AND c.is_active=1 AND c.is_customer=1) customers,
    (SELECT COUNT(*) FROM dbo.vehicles v WHERE v.shop_id=s.id AND v.is_active=1) vehicles,
    (SELECT COUNT(*) FROM dbo.shop_users su WHERE su.shop_id=s.id AND su.is_active=1) staff_count,
    (SELECT COUNT(*) FROM dbo.stock_products sp WHERE sp.shop_id=s.id AND sp.is_active=1 AND sp.quantity<=sp.min_quantity) low_stock
FROM dbo.shops s WHERE s.is_active=1;
GO

/* --------------------------------------------------------------------------
   6) dbo.suppliers — güvenlik ağı olarak yeniden adlandır (silinmedi)
   -------------------------------------------------------------------------- */
IF OBJECT_ID(N'dbo.suppliers', N'U') IS NOT NULL
BEGIN
    EXEC sp_rename N'dbo.suppliers', N'suppliers_deprecated';
    PRINT N'dbo.suppliers -> dbo.suppliers_deprecated olarak yeniden adlandırıldı (veri kaybı olmasın diye silinmedi).';
END
ELSE PRINT N'dbo.suppliers zaten yeniden adlandırılmış veya mevcut değil.';
GO

PRINT N'Müşteri/Tedarikçi birleştirme migrasyonu tamamlandı.';
GO
