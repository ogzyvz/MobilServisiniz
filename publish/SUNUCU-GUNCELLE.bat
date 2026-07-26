@echo off
chcp 65001 >nul
echo ============================================
echo  OtoServis GUNCELLEME (API + Admin)
echo  Cari/Tedarikci + Personel Atama + Arac Devri
echo ============================================
echo.

set BASE_DIR=C:\OtoServis
set API_DIR=%BASE_DIR%\api
set ADMIN_DIR=%BASE_DIR%\admin
set API_ZIP=%BASE_DIR%\OtoServis-Api.zip
set ADMIN_ZIP=%BASE_DIR%\OtoServis-Admin.zip
set SQL1=%BASE_DIR%\05_work_order_assignment.sql
set SQL2=%BASE_DIR%\06_supplier_ledger.sql

if not exist "%API_ZIP%" (
    echo HATA: %API_ZIP% bulunamadi!
    echo Once OtoServis-Api.zip, OtoServis-Admin.zip, 05_work_order_assignment.sql ve
    echo 06_supplier_ledger.sql dosyalarini C:\OtoServis\ altina kopyalayin.
    pause
    exit /b 1
)
if not exist "%ADMIN_ZIP%" (
    echo HATA: %ADMIN_ZIP% bulunamadi!
    pause
    exit /b 1
)

echo [1/6] .NET 8 kontrol...
dotnet --list-runtimes | findstr "Microsoft.AspNetCore.App 8" >nul
if errorlevel 1 (
    echo HATA: .NET 8 ASP.NET Core Runtime yok!
    pause
    exit /b 1
)
echo OK

echo [2/6] Veritabani guncellemeleri (personel atama + cari/tedarikci)...
if exist "%SQL1%" (
    sqlcmd -S "localhost" -U "otoservis_api" -P "Dl0#Zz1!Fc2!Mm2#" -d "OtoServis" -C -i "%SQL1%" -W
    if errorlevel 1 (
        echo UYARI: sqlcmd 05_work_order_assignment basarisiz. SSMS ile calistirin.
    ) else (
        echo SQL 05 OK
    )
) else (
    echo UYARI: %SQL1% yok. SSMS ile 05_work_order_assignment.sql calistirin.
)
if exist "%SQL2%" (
    sqlcmd -S "localhost" -U "otoservis_api" -P "Dl0#Zz1!Fc2!Mm2#" -d "OtoServis" -C -i "%SQL2%" -W
    if errorlevel 1 (
        echo UYARI: sqlcmd 06_supplier_ledger basarisiz. SSMS ile calistirin.
    ) else (
        echo SQL 06 OK
    )
) else (
    echo UYARI: %SQL2% yok. SSMS ile 06_supplier_ledger.sql calistirin.
)

echo [3/6] Eski API/Admin durduruluyor...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :5280 ^| findstr LISTENING') do taskkill /F /PID %%a 2>nul
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :5281 ^| findstr LISTENING') do taskkill /F /PID %%a 2>nul
taskkill /F /IM OtoServis.Api.exe 2>nul
taskkill /F /IM OtoServis.Admin.exe 2>nul
timeout /t 2 /nobreak >nul

echo [4/6] Yeni API dosyalari aciliyor...
if not exist "%API_DIR%" mkdir "%API_DIR%"
powershell -Command "Expand-Archive -Path '%API_ZIP%' -DestinationPath '%API_DIR%' -Force"
echo OK

echo [5/6] Yeni Admin dosyalari aciliyor...
if not exist "%ADMIN_DIR%" mkdir "%ADMIN_DIR%"
powershell -Command "Expand-Archive -Path '%ADMIN_ZIP%' -DestinationPath '%ADMIN_DIR%' -Force"
echo OK

echo [6/6] API ve Admin baslatiliyor...
cd /d "%API_DIR%"
set ASPNETCORE_ENVIRONMENT=Production
set ASPNETCORE_URLS=http://0.0.0.0:5280
start "OtoServis-API" /MIN dotnet OtoServis.Api.dll

timeout /t 3 /nobreak >nul

cd /d "%ADMIN_DIR%"
set ASPNETCORE_URLS=http://0.0.0.0:5281
start "OtoServis-Admin" /MIN dotnet OtoServis.Admin.dll

echo.
echo ============================================
echo  Guncelleme tamam!
echo  API test:   http://37.148.211.243:5280/swagger
echo  Admin test: http://37.148.211.243:5281
echo ============================================
pause
