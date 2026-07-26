@echo off
chcp 65001 >nul
echo ============================================
echo  OtoServis API - Sunucu Kurulumu
echo  Sunucu: 37.148.211.243:5280
echo ============================================
echo.

set API_DIR=C:\OtoServis\api
set ZIP=C:\OtoServis\OtoServis-Api.zip

if not exist "%ZIP%" (
    echo HATA: %ZIP% bulunamadi!
    echo Once OtoServis-Api.zip dosyasini C:\OtoServis\ altina kopyalayin.
    pause
    exit /b 1
)

echo [1/4] .NET 8 kontrol...
dotnet --list-runtimes | findstr "Microsoft.AspNetCore.App 8" >nul
if errorlevel 1 (
    echo HATA: .NET 8 ASP.NET Core Runtime yok!
    echo Indirin: https://dotnet.microsoft.com/download/dotnet/8.0
    pause
    exit /b 1
)
echo OK

echo [2/4] Eski API durduruluyor...
taskkill /F /IM dotnet.exe 2>nul
timeout /t 2 /nobreak >nul

echo [3/4] Dosyalar aciliyor...
if not exist "%API_DIR%" mkdir "%API_DIR%"
powershell -Command "Expand-Archive -Path '%ZIP%' -DestinationPath '%API_DIR%' -Force"
echo OK

echo [4/4] API baslatiliyor...
cd /d "%API_DIR%"
set ASPNETCORE_ENVIRONMENT=Production
set ASPNETCORE_URLS=http://0.0.0.0:5280
start "OtoServis-API" /MIN dotnet OtoServis.Api.dll

echo.
echo ============================================
echo  API baslatildi!
echo  Test: http://37.148.211.243:5280/swagger
echo  Mobil: http://37.148.211.243:5280
echo ============================================
echo.
echo Demo giris:
echo   Servis Kodu: OTO-IST
echo   Telefon:     05551112233
echo   Sifre:       1234
echo.
pause
