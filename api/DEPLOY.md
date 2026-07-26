# MobilServisiniz — Sunucu Kurulum Rehberi

**Sunucu:** `37.148.211.243`  
**API:** port `5280`  
**Admin:** port `5281`  
**SQL Server:** `37.148.211.243` / `OtoServis` / `otoservis_api`

---

## 1. Publish (yerel makinede)

```powershell
cd api
.\deploy.ps1 -SkipDeploy
```

Çıktı klasörleri:
- `publish\api\` — REST API
- `publish\admin\` — Web admin panel
- `publish\OtoServis-Api.zip` — deploy paketi
- `publish\OtoServis-Admin.zip` — deploy paketi

---

## 2. Sunucu gereksinimleri

1. **.NET 8 Runtime (ASP.NET Core)**  
   https://dotnet.microsoft.com/download/dotnet/8.0  
   → "ASP.NET Core Runtime 8.0.x - Windows Hosting Bundle" (IIS kullanacaksanız)

2. **Firewall** — gelen TCP portları açın:
   - `5280` — API (mobil uygulama)
   - `5281` — Admin panel

```powershell
New-NetFirewallRule -DisplayName "OtoServis API 5280" -Direction Inbound -Protocol TCP -LocalPort 5280 -Action Allow
New-NetFirewallRule -DisplayName "OtoServis Admin 5281" -Direction Inbound -Protocol TCP -LocalPort 5281 -Action Allow
```

---

## 3. Sunucuya kopyalama (RDP ile)

1. Sunucuya RDP: `37.148.211.243` / `administrator`
2. Zip dosyalarını kopyalayın:
   - `publish\OtoServis-Api.zip` → `C:\OtoServis\`
   - `publish\OtoServis-Admin.zip` → `C:\OtoServis\`
3. Sunucuda PowerShell:

```powershell
New-Item -ItemType Directory -Force C:\OtoServis\api, C:\OtoServis\admin
Expand-Archive C:\OtoServis\OtoServis-Api.zip -DestinationPath C:\OtoServis\api -Force
Expand-Archive C:\OtoServis\OtoServis-Admin.zip -DestinationPath C:\OtoServis\admin -Force
```

---

## 4. Başlatma

### Yöntem A — Batch dosyası (hızlı test)

```cmd
C:\OtoServis\api\start-api.bat
C:\OtoServis\admin\start-admin.bat
```

### Yöntem B — PowerShell (arka planda)

```powershell
$env:ASPNETCORE_ENVIRONMENT = "Production"

Start-Process dotnet -ArgumentList "C:\OtoServis\api\OtoServis.Api.dll" -WorkingDirectory "C:\OtoServis\api" -WindowStyle Hidden
Start-Process dotnet -ArgumentList "C:\OtoServis\admin\OtoServis.Admin.dll" -WorkingDirectory "C:\OtoServis\admin" -WindowStyle Hidden
```

### Yöntem C — IIS (kalıcı, önerilen)

1. Hosting Bundle kurun
2. IIS'te iki site oluşturun:
   - **OtoServis-Api** → `C:\OtoServis\api`, binding `*:5280`
   - **OtoServis-Admin** → `C:\OtoServis\admin`, binding `*:5281`
3. Application Pool: **No Managed Code**, .NET CLR = boş

---

## 5. Test

| Test | URL |
|------|-----|
| API tenant | http://37.148.211.243:5280/api/auth/lookup-tenant?code=OTO-IST |
| Swagger | http://37.148.211.243:5280/swagger |
| Admin giriş | http://37.148.211.243:5281 |

**Demo giriş:** `OTO-IST` + `05551112233` + `1234`

---

## 6. Mobil uygulama

`mobile/src/lib/api-config.ts` zaten üretim adresini kullanıyor:

```
http://37.148.211.243:5280
```

API sunucuda çalıştıktan sonra APK yeniden build gerekmez (aynı URL).

---

## 7. Otomatik deploy (WinRM açıksa)

```powershell
cd api
.\deploy.ps1
```

WinRM/SMB kapalıysa yukarıdaki RDP adımlarını kullanın.
