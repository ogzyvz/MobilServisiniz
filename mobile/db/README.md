# OtoServis — Multi-Tenant Veritabanı (SQL Server)

Her **servis** (oto tamirhane) bir **tenant**'tır. Tüm iş verileri `shop_id` ile izole edilir.
Kullanıcılar `shop_users` tablosu üzerinden bir veya birden fazla servise bağlanır.

---

## Kurulum

```bash
sqlcmd -S SUNUCU\INSTANCE -i sqlserver/01_schema.sql
sqlcmd -S SUNUCU\INSTANCE -i sqlserver/02_seed.sql
```

---

## Multi-Tenant Mimari

```
                    ┌─────────────────────────────────┐
                    │         PLATFORM                │
                    │  ref_* (paylaşımlı lookup)      │
                    │  users (global kimlik)          │
                    │  vehicle_brands / models        │
                    └────────────┬────────────────────┘
                                 │
          ┌──────────────────────┼──────────────────────┐
          │                      │                      │
   ┌──────▼──────┐       ┌──────▼──────┐       ┌──────▼──────┐
   │ OTO-IST     │       │ OTO-ANK     │       │ OTO-BUR     │
   │ İstanbul    │       │ Ankara      │       │ Bursa       │
   │ (premium)   │       │ (standard)  │       │ (trial)     │
   └──────┬──────┘       └──────┬──────┘       └──────┬──────┘
          │ shop_users          │                     │
          │ customers           │                     │
          │ vehicles            │                     │
          │ service_catalog     │                     │
          │ stock_products      │                     │
          │ work_orders         │                     │
          └─────────────────────┴─────────────────────┘
```

### Temel kurallar

| Kural | Açıklama |
|-------|----------|
| **Tenant = `shops`** | Her kayıt bağımsız bir servis işletmesi (`tenant_code`, `slug`) |
| **Kullanıcı ayrımı** | `users` = platform kimliği; `shop_users` = servis üyeliği + rol |
| **Veri izolasyonu** | Müşteri, araç, stok, iş emri, katalog → hepsi `shop_id NOT NULL` |
| **Benzersizlik** | Plaka, müşteri telefonu, servis kodu → tenant içinde benzersiz |
| **Sıra numaraları** | İş emri / fatura no → `tenant_counters` (her servis kendi sayacı) |

### Giriş akışı (API'de uygulanacak)

```
1. Kullanıcı telefon + şifre ile giriş yapar  →  users tablosu
2. shop_users'dan bağlı servisler listelenir  →  vw_UserShops
3. Kullanıcı servis seçer (veya default_shop_id kullanılır)
4. Tüm API istekleri shop_id ile filtrelenir
5. shop_users.role ile yetki kontrol edilir
```

---

## Demo Servisler (3 tenant)

| Tenant | Kod | Slug | Plan | Şehir |
|--------|-----|------|------|-------|
| OtoServis İstanbul | `OTO-IST` | `otoservis-istanbul` | premium | İstanbul |
| OtoServis Ankara | `OTO-ANK` | `otoservis-ankara` | standard | Ankara |
| Hızlı Tamir Bursa | `OTO-BUR` | `hizli-tamir-bursa` | trial | Bursa |

### Demo giriş hesapları (şifre hepsi: `1234`)

| Telefon | Kullanıcı | Servis(ler) | Rol |
|---------|-----------|-------------|-----|
| `05551112233` | Demo Usta | İstanbul | admin (sahip) |
| `05337776655` | Can Özdemir | Ankara | admin (sahip) |
| `05326665544` | Serkan Aktaş | Bursa | admin (sahip) |
| `05325554433` | Emre Çoklu | İstanbul + Ankara | usta / personel |
| `05329998877` | Ahmet Korkmaz | İstanbul | usta |
| `05428887766` | Mehmet Yıldız | İstanbul | personel |
| `05000000001` | Platform Admin | — | super_admin |

---

## Tablolar

### Platform geneli (paylaşımlı)
`ref_*` tabloları, `vehicle_brands`, `vehicle_models`, `users`

### Tenant kapsamında (`shop_id` zorunlu)
`customers`, `vehicles`, `service_catalog`, `suppliers`, `stock_products`,
`appointments`, `work_orders`, `complaints`, `services`, `work_order_parts`,
`stock_movements`, `payments`, `invoices`, `work_order_images`, `audit_log`

### Üyelik
`shop_users` — kullanıcı ↔ servis ↔ rol

### Tenant sayaçları
`tenant_counters` — iş emri no, fatura no (servis başına bağımsız)

---

## Servis kataloğu (tenant'a özel)

Her servis kendi işçilik listesine ve fiyatlarına sahiptir:

```sql
-- İstanbul'daki servis listesi
SELECT code, name, category, default_price
FROM dbo.service_catalog
WHERE shop_id = 'T0000000-0000-0000-0000-000000000001' AND is_active = 1
ORDER BY sort_order;

-- Ankara farklı fiyatlarla aynı servis adını kullanabilir
-- (Periyodik Bakım: İstanbul 1400₺, Ankara 1200₺, Bursa 1100₺)
```

---

## Sık kullanılan sorgular

### Kullanıcının servisleri
```sql
SELECT * FROM dbo.vw_UserShops WHERE user_id = @user_id;
```

### Servis dashboard
```sql
SELECT * FROM dbo.vw_ShopDashboard WHERE shop_id = @shop_id;
```

### Servis iş emirleri (tenant filtresi)
```sql
SELECT wo.order_no, v.plate, c.full_name, wo.status, t.grand_total
FROM dbo.work_orders wo
JOIN dbo.vehicles v ON v.id = wo.vehicle_id
JOIN dbo.customers c ON c.id = wo.customer_id
LEFT JOIN dbo.vw_WorkOrderTotals t ON t.id = wo.id
WHERE wo.shop_id = @shop_id
ORDER BY wo.opened_at DESC;
```

### Yeni iş emri numarası al
```sql
DECLARE @no bigint;
EXEC dbo.usp_NextTenantCounter @shop_id, N'work_order_no', @no OUTPUT;
-- @no = 1003 (İstanbul için)
```

### Parça ekle (stok düşer)
```sql
EXEC dbo.usp_AddPartToWorkOrder
     @shop_id = @shop_id, @work_order_id = @wo_id,
     @stock_product_id = @stock_id, @name = N'Yağ filtresi',
     @quantity = 1, @unit_price = 320, @created_by = @user_id;
```

---

## Roller ve yetkiler

| Rol | Kapsam | Yetki |
|-----|--------|-------|
| `super_admin` | Platform | Tüm servisleri görür/yönetir |
| `admin` | Servis | Servis içi tam yetki (personel, ayarlar, raporlar) |
| `usta` | Servis | İş emri, işçilik, parça ekleme |
| `personel` | Servis | Kayıt girişi, müşteri/araç ekleme |

---

## Mobil uygulama entegrasyonu

Uygulama şu an SQLite (cihaz içi) kullanır. SQL Server'a geçişte:

1. Giriş → `users` + `shop_users` (servis seçimi ekranı eklenir)
2. Tüm API çağrılarına `shop_id` header/param eklenir
3. `service_catalog` → iş emrine işçilik eklerken hızlı seçim listesi
4. `tenant_counters` → yeni iş emri numarası

İsterseniz .NET Web API katmanını da kurabilirim.
