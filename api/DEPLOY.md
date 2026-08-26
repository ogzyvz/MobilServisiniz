# MobilServisiniz — Sunucu Kurulum Rehberi

**Sunucu:** `37.148.211.243`  
**API:** port `5280`  
**Admin (servis paneli):** port `5281`  
**Platform (tüm servisler):** port `5282`  
**SQL Server:** `37.148.211.243` / `OtoServis` / `otoservis_api`

---

## 1. Publish (yerel makinede)

```powershell
cd api
.\deploy.ps1 -SkipDeploy
```

Çıktı klasörleri:
- `publish\api\` — REST API
- `publish\admin\` — Servis web paneli
- `publish\platform\` — Platform yönetim paneli
- `publish\OtoServis-Api.zip`
- `publish\OtoServis-Admin.zip`
- `publish\OtoServis-Platform.zip`

Platform / lisans SQL:
- `publish\15_platform_admin.sql`
- `publish\16_shop_license.sql`

---

## 2. Sunucu gereksinimleri

1. **.NET 8 Runtime (ASP.NET Core)**  
   https://dotnet.microsoft.com/download/dotnet/8.0  

2. **Firewall** — gelen TCP portları açın:
   - `5280` — API
   - `5281` — Admin
   - `5282` — Platform

```powershell
New-NetFirewallRule -DisplayName "OtoServis API 5280" -Direction Inbound -Protocol TCP -LocalPort 5280 -Action Allow
New-NetFirewallRule -DisplayName "OtoServis Admin 5281" -Direction Inbound -Protocol TCP -LocalPort 5281 -Action Allow
New-NetFirewallRule -DisplayName "OtoServis Platform 5282" -Direction Inbound -Protocol TCP -LocalPort 5282 -Action Allow
```

---

## 3. Sunucuya kopyalama (RDP ile)

1. Zip + SQL dosyalarını `C:\OtoServis\` altına kopyalayın
2. PowerShell:

```powershell
New-Item -ItemType Directory -Force C:\OtoServis\api, C:\OtoServis\admin, C:\OtoServis\platform
Expand-Archive C:\OtoServis\OtoServis-Api.zip -DestinationPath C:\OtoServis\api -Force
Expand-Archive C:\OtoServis\OtoServis-Admin.zip -DestinationPath C:\OtoServis\admin -Force
Expand-Archive C:\OtoServis\OtoServis-Platform.zip -DestinationPath C:\OtoServis\platform -Force
```

---

## 4. Başlatma

```cmd
C:\OtoServis\api\start-api.bat
C:\OtoServis\admin\start-admin.bat
C:\OtoServis\platform\start-platform.bat
```

Veya `SUNUCU-GUNCELLE.bat` (SQL + zip açma + başlatma).

---

## 5. Test

| Test | URL |
|------|-----|
| API Swagger | http://37.148.211.243:5280/swagger |
| Admin giriş | http://37.148.211.243:5281 |
| Platform giriş | http://37.148.211.243:5282 |

**Admin demo:** `OTO-IST` + `05551112233` + `1234`  
**Platform demo:** `05000000001` + `1234` (önce `15_platform_admin.sql`)

---

## 6. Mobil uygulama

`mobile/src/lib/api-config.ts` → `http://37.148.211.243:5280`

---

## 7. Otomatik deploy (WinRM açıksa)

```powershell
cd api
.\deploy.ps1
```
