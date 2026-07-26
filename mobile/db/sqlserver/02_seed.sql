/* ==========================================================================
   OtoServis — Multi-Tenant Demo Veriler
   3 servis (tenant) + platform yöneticisi + çoklu servis kullanıcısı
   ========================================================================== */

USE OtoServis;
GO
SET NOCOUNT ON;
GO

IF NOT EXISTS (SELECT 1 FROM dbo.shops)
BEGIN

    /* Referans verileri 01_schema.sql içinde yüklenir */

    /* ====================================================================
       TENANT (SERVİS) — 3 ayrı oto servis
       ==================================================================== */
    INSERT INTO dbo.shops (id, tenant_code, slug, name, legal_name, tax_no, phone, email, address, city, district, subscription_plan) VALUES
    (N'11111111-1111-1111-1111-111111111101', N'OTO-IST', N'otoservis-istanbul', N'OtoServis İstanbul',
     N'OtoServis İstanbul Ltd.', N'1111111111', N'0216 555 00 01', N'istanbul@otoservis.com',
     N'Bağdat Cad. No:100', N'İstanbul', N'Kadıköy', N'premium'),
    (N'11111111-1111-1111-1111-111111111102', N'OTO-ANK', N'otoservis-ankara', N'OtoServis Ankara',
     N'OtoServis Ankara Ltd.', N'2222222222', N'0312 555 00 02', N'ankara@otoservis.com',
     N'Kızılay Cad. No:50', N'Ankara', N'Çankaya', N'standard'),
    (N'11111111-1111-1111-1111-111111111103', N'OTO-BUR', N'hizli-tamir-bursa', N'Hızlı Tamir Bursa',
     N'Hızlı Tamir Otomotiv', N'3333333333', N'0224 555 00 03', N'bursa@hizlitamir.com',
     N'Organize Sanayi 12. Sk.', N'Bursa', N'Nilüfer', N'trial');

    /* Tenant sayaçları */
    INSERT INTO dbo.tenant_counters (shop_id, counter_name, last_value) VALUES
    (N'11111111-1111-1111-1111-111111111101', N'work_order_no', 1002),
    (N'11111111-1111-1111-1111-111111111101', N'invoice_no', 1),
    (N'11111111-1111-1111-1111-111111111102', N'work_order_no', 1001),
    (N'11111111-1111-1111-1111-111111111102', N'invoice_no', 0),
    (N'11111111-1111-1111-1111-111111111103', N'work_order_no', 1000),
    (N'11111111-1111-1111-1111-111111111103', N'invoice_no', 0);

    /* ====================================================================
       KULLANICILAR + SERVİS ÜYELİKLERİ (shop_users)
       ==================================================================== */
    -- password_hash = SHA-256('otoservis::v1:1234')  →  tüm demo hesaplar şifre: 1234

    INSERT INTO dbo.users (id, username, full_name, phone, email, password_hash, default_shop_id) VALUES
    (N'22222222-2222-2222-2222-222222222201', N'platform',  N'Platform Admin',  N'05000000001', N'admin@otoservis.com',    N'8d58466dcaa8223599a1a7162e8d1bd4e45318c7fb24a73760c7d4f3fcfb9a93', NULL),
    (N'22222222-2222-2222-2222-222222222202', N'demo',      N'Demo Usta',     N'05551112233', N'demo@otoservis.com',     N'8d58466dcaa8223599a1a7162e8d1bd4e45318c7fb24a73760c7d4f3fcfb9a93', N'11111111-1111-1111-1111-111111111101'),
    (N'22222222-2222-2222-2222-222222222203', N'ahmetusta', N'Ahmet Korkmaz', N'05329998877', N'ahmet@otoservis.com',    N'8d58466dcaa8223599a1a7162e8d1bd4e45318c7fb24a73760c7d4f3fcfb9a93', N'11111111-1111-1111-1111-111111111101'),
    (N'22222222-2222-2222-2222-222222222204', N'mehmet',    N'Mehmet Yıldız', N'05428887766', N'mehmet@otoservis.com',   N'8d58466dcaa8223599a1a7162e8d1bd4e45318c7fb24a73760c7d4f3fcfb9a93', N'11111111-1111-1111-1111-111111111101'),
    (N'22222222-2222-2222-2222-222222222205', N'ankara_admin',N'Can Özdemir', N'05337776655', N'can@otoservis.com',      N'8d58466dcaa8223599a1a7162e8d1bd4e45318c7fb24a73760c7d4f3fcfb9a93', N'11111111-1111-1111-1111-111111111102'),
    (N'22222222-2222-2222-2222-222222222206', N'bursa_usta', N'Serkan Aktaş',  N'05326665544', N'serkan@hizlitamir.com',  N'8d58466dcaa8223599a1a7162e8d1bd4e45318c7fb24a73760c7d4f3fcfb9a93', N'11111111-1111-1111-1111-111111111103'),
    (N'22222222-2222-2222-2222-222222222207', N'coklu',     N'Emre Çoklu',    N'05325554433', N'emre@otoservis.com',     N'8d58466dcaa8223599a1a7162e8d1bd4e45318c7fb24a73760c7d4f3fcfb9a93', N'11111111-1111-1111-1111-111111111101');

    -- shop_users: kullanıcı ↔ servis üyelikleri
    INSERT INTO dbo.shop_users (shop_id, user_id, role, title, is_owner) VALUES
    -- İstanbul
    (N'11111111-1111-1111-1111-111111111101', N'22222222-2222-2222-2222-222222222202', N'admin',    N'Servis Yöneticisi', 1),
    (N'11111111-1111-1111-1111-111111111101', N'22222222-2222-2222-2222-222222222203', N'usta',     N'Kıdemli Usta', 0),
    (N'11111111-1111-1111-1111-111111111101', N'22222222-2222-2222-2222-222222222204', N'personel', N'Servis Danışmanı', 0),
    (N'11111111-1111-1111-1111-111111111101', N'22222222-2222-2222-2222-222222222207', N'usta',     N'Gezici Usta', 0),
    -- Ankara
    (N'11111111-1111-1111-1111-111111111102', N'22222222-2222-2222-2222-222222222205', N'admin',    N'Servis Yöneticisi', 1),
    -- Bursa
    (N'11111111-1111-1111-1111-111111111103', N'22222222-2222-2222-2222-222222222206', N'admin',    N'Kurucu / Usta', 1),
    -- Emre Çoklu: hem İstanbul hem Ankara'da çalışıyor
    (N'11111111-1111-1111-1111-111111111102', N'22222222-2222-2222-2222-222222222207', N'personel', N'Geçici Personel', 0);

    /* ====================================================================
       ARAÇ MARKA / MODEL (platform geneli)
       ==================================================================== */
    INSERT INTO dbo.vehicle_brands (id, name) VALUES
    (N'33333333-3333-3333-3333-333333333301', N'Volkswagen'),
    (N'33333333-3333-3333-3333-333333333302', N'Renault'),
    (N'33333333-3333-3333-3333-333333333303', N'Fiat'),
    (N'33333333-3333-3333-3333-333333333304', N'Toyota'),
    (N'33333333-3333-3333-3333-333333333305', N'Ford'),
    (N'33333333-3333-3333-3333-333333333306', N'Hyundai');

    INSERT INTO dbo.vehicle_models (id, brand_id, name) VALUES
    (N'44444444-4444-4444-4444-444444444401', N'33333333-3333-3333-3333-333333333301', N'Passat 1.6 TDI'),
    (N'44444444-4444-4444-4444-444444444402', N'33333333-3333-3333-3333-333333333302', N'Clio 1.5 dCi'),
    (N'44444444-4444-4444-4444-444444444403', N'33333333-3333-3333-3333-333333333303', N'Egea 1.4 Fire'),
    (N'44444444-4444-4444-4444-444444444404', N'33333333-3333-3333-3333-333333333304', N'Corolla 1.6'),
    (N'44444444-4444-4444-4444-444444444405', N'33333333-3333-3333-3333-333333333305', N'Transit Custom'),
    (N'44444444-4444-4444-4444-444444444406', N'33333333-3333-3333-3333-333333333306', N'i20 1.4 CRDi');

    /* ====================================================================
       SERVİS KATALOĞU — her tenant kendi listesine sahip
       ==================================================================== */

    -- İSTANBUL (25 servis)
    INSERT INTO dbo.service_catalog (shop_id, code, name, category, default_price, estimated_minutes, sort_order) VALUES
    (N'11111111-1111-1111-1111-111111111101', N'PER-001', N'Periyodik Bakım', N'periyodik', 1400, 120, 1),
    (N'11111111-1111-1111-1111-111111111101', N'YAG-001', N'Yağ ve Filtre Değişimi', N'periyodik', 1850, 60, 2),
    (N'11111111-1111-1111-1111-111111111101', N'FREN-001',N'Ön Fren Balata Değişimi', N'fren', 900, 90, 3),
    (N'11111111-1111-1111-1111-111111111101', N'KLM-001', N'Klima Gazı Dolumu', N'klima', 900, 45, 4),
    (N'11111111-1111-1111-1111-111111111101', N'LAS-001', N'Lastik Değişimi (4 adet)', N'lastik', 400, 40, 5),
    (N'11111111-1111-1111-1111-111111111101', N'GEN-001', N'Genel Kontrol', N'genel', 350, 30, 6);

    -- ANKARA (farklı fiyatlar)
    INSERT INTO dbo.service_catalog (shop_id, code, name, category, default_price, estimated_minutes, sort_order) VALUES
    (N'11111111-1111-1111-1111-111111111102', N'PER-001', N'Periyodik Bakım', N'periyodik', 1200, 120, 1),
    (N'11111111-1111-1111-1111-111111111102', N'YAG-001', N'Yağ ve Filtre Değişimi', N'periyodik', 1600, 60, 2),
    (N'11111111-1111-1111-1111-111111111102', N'FREN-001',N'Ön Fren Balata Değişimi', N'fren', 750, 90, 3),
    (N'11111111-1111-1111-1111-111111111102', N'MOT-001', N'Motor Arıza Tespiti', N'motor', 450, 60, 4);

    -- BURSA (daha az servis — trial plan)
    INSERT INTO dbo.service_catalog (shop_id, code, name, category, default_price, estimated_minutes, sort_order) VALUES
    (N'11111111-1111-1111-1111-111111111103', N'PER-001', N'Periyodik Bakım', N'periyodik', 1100, 120, 1),
    (N'11111111-1111-1111-1111-111111111103', N'YAG-001', N'Yağ Değişimi', N'periyodik', 1400, 45, 2),
    (N'11111111-1111-1111-1111-111111111103', N'GEN-001', N'Genel Kontrol', N'genel', 300, 30, 3);

    /* ====================================================================
       TEDARİKÇİ + STOK (tenant bazlı)
       ==================================================================== */

    -- İstanbul stok
    INSERT INTO dbo.suppliers (id, shop_id, name, phone) VALUES
    (N'88888888-8888-8888-8888-888888888801', N'11111111-1111-1111-1111-111111111101', N'Bosch İstanbul', N'0216 333 44 55');

    INSERT INTO dbo.stock_products (id, shop_id, supplier_id, name, category, code, price, quantity, min_quantity) VALUES
    (N'99999999-9999-9999-9999-999999999901', N'11111111-1111-1111-1111-111111111101', N'88888888-8888-8888-8888-888888888801', N'Motor Yağı 5W-30 (5L)', N'yag', N'YG-530', 1200, 24, 5),
    (N'99999999-9999-9999-9999-999999999902', N'11111111-1111-1111-1111-111111111101', N'88888888-8888-8888-8888-888888888801', N'Yağ Filtresi', N'filtre', N'FL-YAG', 320, 60, 10),
    (N'99999999-9999-9999-9999-999999999903', N'11111111-1111-1111-1111-111111111101', N'88888888-8888-8888-8888-888888888801', N'Ön Fren Balatası', N'fren', N'FR-BLT', 780, 15, 4);

    -- Ankara stok
    INSERT INTO dbo.suppliers (id, shop_id, name, phone) VALUES
    (N'88888888-8888-8888-8888-888888888802', N'11111111-1111-1111-1111-111111111102', N'Castrol Ankara', N'0312 222 33 44');

    INSERT INTO dbo.stock_products (id, shop_id, supplier_id, name, category, code, price, quantity, min_quantity) VALUES
    (N'99999999-9999-9999-9999-999999999904', N'11111111-1111-1111-1111-111111111102', N'88888888-8888-8888-8888-888888888802', N'Motor Yağı 10W-40 (4L)', N'yag', N'YG-1040', 950, 18, 5),
    (N'99999999-9999-9999-9999-999999999905', N'11111111-1111-1111-1111-111111111102', N'88888888-8888-8888-8888-888888888802', N'Hava Filtresi', N'filtre', N'FL-HVA', 280, 42, 10);

    -- Bursa stok
    INSERT INTO dbo.stock_products (id, shop_id, name, category, code, price, quantity, min_quantity) VALUES
    (N'99999999-9999-9999-9999-999999999906', N'11111111-1111-1111-1111-111111111103', N'Motor Yağı 5W-30 (5L)', N'yag', N'YG-530', 1150, 8, 3);

    /* ====================================================================
       MÜŞTERİLER + ARAÇLAR (tenant bazlı)
       ==================================================================== */

    -- İSTANBUL müşteriler
    INSERT INTO dbo.customers (id, shop_id, customer_type, full_name, phone, address, city, created_by) VALUES
    (N'55555555-5555-5555-5555-555555555501', N'11111111-1111-1111-1111-111111111101', N'bireysel', N'Ahmet Yılmaz', N'0532 111 22 33', N'Ataşehir', N'İstanbul', N'22222222-2222-2222-2222-222222222204'),
    (N'55555555-5555-5555-5555-555555555502', N'11111111-1111-1111-1111-111111111101', N'bireysel', N'Elif Demir', N'0505 444 55 66', N'Üsküdar', N'İstanbul', N'22222222-2222-2222-2222-222222222204'),
    (N'55555555-5555-5555-5555-555555555503', N'11111111-1111-1111-1111-111111111101', N'kurumsal', N'Ali Vural', N'0212 444 33 22', N'Tuzla OSB', N'İstanbul', N'22222222-2222-2222-2222-222222222202');

    INSERT INTO dbo.vehicles (id, shop_id, customer_id, brand_id, model_id, plate, brand, model, model_year, color, fuel, chassis_no, mileage) VALUES
    (N'66666666-6666-6666-6666-666666666601', N'11111111-1111-1111-1111-111111111101', N'55555555-5555-5555-5555-555555555501', N'33333333-3333-3333-3333-333333333301', N'44444444-4444-4444-4444-444444444401', N'34 ABC 123', N'Volkswagen', N'Passat 1.6 TDI', 2019, N'Beyaz', N'dizel', N'WVWZZZ3CZKE012345', 128400),
    (N'66666666-6666-6666-6666-666666666602', N'11111111-1111-1111-1111-111111111101', N'55555555-5555-5555-5555-555555555502', N'33333333-3333-3333-3333-333333333302', N'44444444-4444-4444-4444-444444444402', N'34 XY 789', N'Renault', N'Clio 1.5 dCi', 2017, N'Gri', N'dizel', N'VF1RFB00X12345678', 96750),
    (N'66666666-6666-6666-6666-666666666603', N'11111111-1111-1111-1111-111111111101', N'55555555-5555-5555-5555-555555555503', N'33333333-3333-3333-3333-333333333305', N'44444444-4444-4444-4444-444444444405', N'34 TRK 001', N'Ford', N'Transit Custom', 2020, N'Beyaz', N'dizel', N'WF0XXXGCDX1234567', 215000);

    -- ANKARA müşteriler
    INSERT INTO dbo.customers (id, shop_id, customer_type, full_name, phone, address, city, created_by) VALUES
    (N'55555555-5555-5555-5555-555555555504', N'11111111-1111-1111-1111-111111111102', N'bireysel', N'Mehmet Kaya', N'0542 777 88 99', N'Çankaya', N'Ankara', N'22222222-2222-2222-2222-222222222205'),
    (N'55555555-5555-5555-5555-555555555505', N'11111111-1111-1111-1111-111111111102', N'bireysel', N'Zeynep Şahin', N'0533 222 33 44', N'Keçiören', N'Ankara', N'22222222-2222-2222-2222-222222222205');

    INSERT INTO dbo.vehicles (id, shop_id, customer_id, brand_id, model_id, plate, brand, model, model_year, color, fuel, chassis_no, mileage) VALUES
    (N'66666666-6666-6666-6666-666666666604', N'11111111-1111-1111-1111-111111111102', N'55555555-5555-5555-5555-555555555504', N'33333333-3333-3333-3333-333333333303', N'44444444-4444-4444-4444-444444444403', N'06 DE 456', N'Fiat', N'Egea 1.4 Fire', 2021, N'Kırmızı', N'benzin', N'ZFA33400009876543', 54200),
    (N'66666666-6666-6666-6666-666666666605', N'11111111-1111-1111-1111-111111111102', N'55555555-5555-5555-5555-555555555505', N'33333333-3333-3333-3333-333333333304', N'44444444-4444-4444-4444-444444444404', N'06 ABC 999', N'Toyota', N'Corolla 1.6', 2018, N'Siyah', N'benzin', N'JTDBR32E504567890', 89000);

    -- BURSA müşteri
    INSERT INTO dbo.customers (id, shop_id, customer_type, full_name, phone, address, city, created_by) VALUES
    (N'55555555-5555-5555-5555-555555555506', N'11111111-1111-1111-1111-111111111103', N'bireysel', N'Hasan Öztürk', N'0555 987 65 43', N'Nilüfer', N'Bursa', N'22222222-2222-2222-2222-222222222206');

    INSERT INTO dbo.vehicles (id, shop_id, customer_id, brand_id, model_id, plate, brand, model, model_year, color, fuel, chassis_no, mileage) VALUES
    (N'66666666-6666-6666-6666-666666666606', N'11111111-1111-1111-1111-111111111103', N'55555555-5555-5555-5555-555555555506', N'33333333-3333-3333-3333-333333333306', N'44444444-4444-4444-4444-444444444406', N'16 BUR 55', N'Hyundai', N'i20 1.4 CRDi', 2016, N'Mavi', N'dizel', N'KMHDN45H5GU123456', 145000);

    /* ====================================================================
       İŞ EMİRLERİ (tenant bazlı, ayrı order_no)
       ==================================================================== */

    -- İstanbul iş emirleri
    INSERT INTO dbo.work_orders (id, shop_id, order_no, vehicle_id, customer_id, assigned_user_id, opened_by, status, mileage_in, opened_at) VALUES
    (N'77777777-7777-7777-7777-777777777701', N'11111111-1111-1111-1111-111111111101', 1001, N'66666666-6666-6666-6666-666666666601', N'55555555-5555-5555-5555-555555555501', N'22222222-2222-2222-2222-222222222203', N'22222222-2222-2222-2222-222222222202', N'islemde', 128400, '2026-07-14T08:30:00'),
    (N'77777777-7777-7777-7777-777777777702', N'11111111-1111-1111-1111-111111111101', 1002, N'66666666-6666-6666-6666-666666666602', N'55555555-5555-5555-5555-555555555502', NULL, N'22222222-2222-2222-2222-222222222204', N'bekliyor', 96750, '2026-07-14T09:10:00');

    -- Ankara iş emri
    INSERT INTO dbo.work_orders (id, shop_id, order_no, vehicle_id, customer_id, assigned_user_id, opened_by, status, mileage_in, opened_at, closed_at) VALUES
    (N'77777777-7777-7777-7777-777777777703', N'11111111-1111-1111-1111-111111111102', 1001, N'66666666-6666-6666-6666-666666666604', N'55555555-5555-5555-5555-555555555504', N'22222222-2222-2222-2222-222222222205', N'22222222-2222-2222-2222-222222222205', N'tamamlandi', 54200, '2026-07-13T14:00:00', '2026-07-13T17:30:00');

    /* Şikayetler */
    INSERT INTO dbo.complaints (shop_id, work_order_id, description, created_at) VALUES
    (N'11111111-1111-1111-1111-111111111101', N'77777777-7777-7777-7777-777777777701', N'Motordan tıkırtı sesi geliyor.', '2026-07-14T08:35:00'),
    (N'11111111-1111-1111-1111-111111111101', N'77777777-7777-7777-7777-777777777701', N'Ön fren balataları ses yapıyor.', '2026-07-14T08:36:00'),
    (N'11111111-1111-1111-1111-111111111101', N'77777777-7777-7777-7777-777777777702', N'Klima soğutmuyor.', '2026-07-14T09:12:00'),
    (N'11111111-1111-1111-1111-111111111102', N'77777777-7777-7777-7777-777777777703', N'Periyodik bakım istendi.', '2026-07-13T14:05:00');

    /* İşçilik (katalogdan) */
    INSERT INTO dbo.services (shop_id, work_order_id, title, price, performed_by) VALUES
    (N'11111111-1111-1111-1111-111111111101', N'77777777-7777-7777-7777-777777777701', N'Yağ ve Filtre Değişimi', 1850, N'22222222-2222-2222-2222-222222222203'),
    (N'11111111-1111-1111-1111-111111111101', N'77777777-7777-7777-7777-777777777701', N'Ön Fren Balata Değişimi', 900, N'22222222-2222-2222-2222-222222222203'),
    (N'11111111-1111-1111-1111-111111111102', N'77777777-7777-7777-7777-777777777703', N'Periyodik Bakım', 1200, N'22222222-2222-2222-2222-222222222205');

    /* Parçalar */
    INSERT INTO dbo.work_order_parts (shop_id, work_order_id, stock_product_id, name, quantity, unit_price) VALUES
    (N'11111111-1111-1111-1111-111111111101', N'77777777-7777-7777-7777-777777777701', N'99999999-9999-9999-9999-999999999901', N'Motor yağı 5W-30 (5L)', 1, 1200),
    (N'11111111-1111-1111-1111-111111111101', N'77777777-7777-7777-7777-777777777701', N'99999999-9999-9999-9999-999999999902', N'Yağ filtresi', 1, 320),
    (N'11111111-1111-1111-1111-111111111101', N'77777777-7777-7777-7777-777777777701', N'99999999-9999-9999-9999-999999999903', N'Ön fren balatası', 1, 780),
    (N'11111111-1111-1111-1111-111111111102', N'77777777-7777-7777-7777-777777777703', N'99999999-9999-9999-9999-999999999904', N'Motor yağı 10W-40 (4L)', 1, 950);

    /* Ödeme + Fatura (Ankara) */
    INSERT INTO dbo.payments (shop_id, work_order_id, amount, method, received_by, paid_at) VALUES
    (N'11111111-1111-1111-1111-111111111102', N'77777777-7777-7777-7777-777777777703', 2150, N'kart', N'22222222-2222-2222-2222-222222222205', '2026-07-13T17:35:00');

    INSERT INTO dbo.invoices (shop_id, work_order_id, invoice_no, customer_id, subtotal, discount, vat_rate, vat_amount, grand_total, issued_by) VALUES
    (N'11111111-1111-1111-1111-111111111102', N'77777777-7777-7777-7777-777777777703', 1, N'55555555-5555-5555-5555-555555555504', 2150, 0, 20, 430, 2580, N'22222222-2222-2222-2222-222222222205');

    /* Randevular */
    INSERT INTO dbo.appointments (shop_id, customer_id, vehicle_id, assigned_user_id, status, scheduled_at, subject, created_by) VALUES
    (N'11111111-1111-1111-1111-111111111101', N'55555555-5555-5555-5555-555555555502', N'66666666-6666-6666-6666-666666666602', N'22222222-2222-2222-2222-222222222203', N'bekliyor', '2026-07-15T10:00:00', N'Klima kontrolü', N'22222222-2222-2222-2222-222222222204'),
    (N'11111111-1111-1111-1111-111111111103', N'55555555-5555-5555-5555-555555555506', N'66666666-6666-6666-6666-666666666606', N'22222222-2222-2222-2222-222222222206', N'onaylandi', '2026-07-16T09:00:00', N'Yağ değişimi', N'22222222-2222-2222-2222-222222222206');

    PRINT N'Multi-tenant demo veriler yüklendi.';
    PRINT N'';
    PRINT N'=== DEMO GİRİŞ BİLGİLERİ (şifre hepsi: 1234) ===';
    PRINT N'İstanbul  → 05551112233  (Demo Usta, admin)';
    PRINT N'Ankara    → 05337776655  (Can Özdemir, admin)';
    PRINT N'Bursa     → 05326665544  (Serkan Aktaş, admin)';
    PRINT N'Çoklu     → 05325554433  (Emre Çoklu, İst+Ank)';
    PRINT N'Platform  → 05000000001  (Platform Admin)';
END
ELSE
    PRINT N'Veritabanı zaten dolu; demo veri atlandı.';
GO
