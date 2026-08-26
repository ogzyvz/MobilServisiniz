# MobilServisiniz Web API (.NET 8)

SQL Server tabanlı multi-tenant oto servis backend'i. Her **servis (shop)** ayrı bir tenant'tır; JWT içindeki `shop_id` claim'i ile veri izolasyonu sağlanır.

## Gereksinimler

- [.NET 8 SDK](https://dotnet.microsoft.com/download/dotnet/8.0)
- SQL Server (LocalDB, Express veya tam sürüm)
- Veritabanı scriptleri: `mobile/db/sqlserver/`

## Kurulum

### 1. Veritabanı

```powershell
sqlcmd -S localhost -E -i ..\mobile\db\sqlserver\01_schema.sql
sqlcmd -S localhost -E -i ..\mobile\db\sqlserver\02_seed.sql
```

SQL kimlik doğrulaması kullanıyorsanız `-U kullanici -P sifre` ekleyin.

### 2. Bağlantı dizesi

`OtoServis.Api/appsettings.json` içinde `ConnectionStrings:Default` değerini güncelleyin:

```json
"Default": "Server=localhost;Database=OtoServis;Trusted_Connection=True;TrustServerCertificate=True;"
```

### 3. Çalıştırma

```powershell
cd OtoServis.Api
dotnet run
```

Swagger UI: **http://localhost:5280/swagger**

## Kimlik Doğrulama Akışı

```
POST /api/auth/login          → token + kullanıcı + servis listesi
POST /api/auth/select-shop    → yeni token (shop_id claim ile)
GET  /api/auth/shops          → bağlı servisler
```

Diğer tüm endpoint'ler `Authorization: Bearer {token}` gerektirir ve token'da `shop_id` olmalıdır.

### Demo hesap (şifre: `1234`)

| Telefon       | Servis     | Rol   |
|---------------|------------|-------|
| 05551112233   | İstanbul   | admin |
| 05337776655   | Ankara     | admin |
| 05326665544   | Bursa      | admin |
| 05325554433   | İst + Ank  | usta  |

## Endpoint'ler

| Method | Path | Açıklama |
|--------|------|----------|
| GET | `/api/dashboard` | Özet istatistikler |
| GET/POST | `/api/customers` | Müşteri listesi / yeni müşteri |
| GET/POST | `/api/vehicles` | Araç listesi / yeni araç + iş emri |
| GET | `/api/servicecatalog` | Servis kataloğu |
| GET | `/api/stock` | Stok ürünleri |
| GET | `/api/workorders` | İş emirleri |
| GET | `/api/workorders/{id}` | İş emri detayı |
| PATCH | `/api/workorders/{id}/status` | Durum güncelle |
| POST | `/api/workorders/{id}/complaints` | Şikayet ekle |
| POST | `/api/workorders/{id}/services` | İşçilik ekle |
| POST | `/api/workorders/{id}/parts` | Parça ekle (stok düşer) |
| POST | `/api/ai/scan-ruhsat` | Ruhsat fotoğrafı okuma (AI failover) |

## Yapay zekâ (ruhsat okuma)

`POST /api/ai/scan-ruhsat` — body: `{ "imageBase64": "...", "mimeType": "image/jpeg" }`

Zincir (ücretsiz öncelik): `gemini-3.5-flash-lite` → `gemini-3.5-flash` → `gpt-4o-mini` → `ocr/tesseract`.

`appsettings.json` / Production:

```json
"Ai": {
  "GeminiApiKey": "...",
  "OpenAiApiKey": "...",
  "Providers": [
    { "Name": "gemini", "Model": "gemini-3.5-flash-lite" },
    { "Name": "gemini", "Model": "gemini-3.5-flash" },
    { "Name": "openai", "Model": "gpt-4o-mini" },
    { "Name": "ocr", "Model": "tesseract" }
  ]
}
```

Anahtar alma:

- Gemini (ücretsiz): https://aistudio.google.com/app/apikey
- OpenAI (yedek): https://platform.openai.com/api-keys

## Mobil uygulama entegrasyonu

Mobil uygulama şu an yerel SQLite kullanıyor (`mobile/src/lib/db.ts`). API'ye geçmek için:

1. `mobile/src/lib/api.ts` ile HTTP client ekleyin
2. `API_BASE_URL` olarak bilgisayar IP'si + port (ör. `http://192.168.1.10:5280`)
3. Login → select-shop → token'ı AsyncStorage'da saklayın

## Üretim / Publish

```powershell
cd api
.\deploy.ps1 -SkipDeploy
```

Çıktı:
- `publish/api/` — API (port 5280)
- `publish/admin/` — Admin panel (port 5281)
- `publish/OtoServis-Api.zip` + `OtoServis-Admin.zip`

Sunucuya kurulum: **`api/DEPLOY.md`** ve **`publish/install-server.ps1`**

**Sunucu:** `37.148.211.243`  
**Mobil API adresi:** `http://37.148.211.243:5280`

## Üretim notları

- `Jwt:Key` değerini güçlü bir secret ile değiştirin
- CORS'u `AllowAnyOrigin` yerine mobil uygulama domain'ine kısıtlayın
- HTTPS kullanın
- `TrustServerCertificate=True` yalnızca geliştirme içindir
