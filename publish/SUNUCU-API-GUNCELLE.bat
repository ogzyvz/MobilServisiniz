@echo off
chcp 65001 >nul
echo ============================================
echo  OtoServis API GUNCELLEME
echo  (Motor No + Motor Hacmi destekli)
echo ============================================
echo.

set API_DIR=C:\OtoServis\api
set ZIP=C:\OtoServis\OtoServis-Api.zip
set SQL=C:\OtoServis\04_add_engine_fields.sql

if not exist "%ZIP%" (
    echo HATA: %ZIP% bulunamadi!
    echo Once OtoServis-Api.zip dosyasini C:\OtoServis\ altina kopyalayin.
    pause
    exit /b 1
)

echo [1/5] .NET 8 kontrol...
dotnet --list-runtimes | findstr "Microsoft.AspNetCore.App 8" >nul
if errorlevel 1 (
    echo HATA: .NET 8 ASP.NET Core Runtime yok!
    pause
    exit /b 1
)
echo OK

echo [2/5] Veritabani motor alanlari...
if exist "%SQL%" (
    sqlcmd -S "localhost" -U "otoservis_api" -P "Dl0#Zz1!Fc2!Mm2#" -d "OtoServis" -C -i "%SQL%" -W
    if errorlevel 1 (
        echo UYARI: sqlcmd localhost basarisiz. SQL Server uzak ise SSMS ile 04_add_engine_fields.sql calistirin.
    ) else (
        echo SQL OK
    )
) else (
    echo UYARI: %SQL% yok. SSMS ile 04_add_engine_fields.sql calistirin.
)

echo [3/5] Eski API durduruluyor...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :5280 ^| findstr LISTENING') do taskkill /F /PID %%a 2>nul
taskkill /F /IM OtoServis.Api.exe 2>nul
timeout /t 2 /nobreak >nul

echo [4/5] Yeni dosyalar aciliyor...
if not exist "%API_DIR%" mkdir "%API_DIR%"
powershell -Command "Expand-Archive -Path '%ZIP%' -DestinationPath '%API_DIR%' -Force"
echo OK

echo [5/5] API baslatiliyor...
cd /d "%API_DIR%"
set ASPNETCORE_ENVIRONMENT=Production
set ASPNETCORE_URLS=http://0.0.0.0:5280
start "OtoServis-API" /MIN dotnet OtoServis.Api.dll

echo.
echo ============================================
echo  Guncelleme tamam!
echo  Test: http://37.148.211.243:5280/swagger
echo ============================================
pause
