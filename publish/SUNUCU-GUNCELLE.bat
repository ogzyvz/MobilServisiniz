@echo off
chcp 65001 >nul
echo ============================================
echo  OtoServis GUNCELLEME (API + Admin + Platform)
echo ============================================
echo.

if "%OTOSERVIS_DB_PASS%"=="" (
    set /p OTOSERVIS_DB_PASS=Veritabani parolasi (otoservis_api kullanicisi): 
)

set BASE_DIR=C:\OtoServis
set API_DIR=%BASE_DIR%\api
set ADMIN_DIR=%BASE_DIR%\admin
set PLATFORM_DIR=%BASE_DIR%\platform
set API_ZIP=%BASE_DIR%\OtoServis-Api.zip
set ADMIN_ZIP=%BASE_DIR%\OtoServis-Admin.zip
set PLATFORM_ZIP=%BASE_DIR%\OtoServis-Platform.zip
set SQL1=%BASE_DIR%\05_work_order_assignment.sql
set SQL2=%BASE_DIR%\06_supplier_ledger.sql
set SQL3=%BASE_DIR%\07_unify_contacts.sql
set SQL4=%BASE_DIR%\08_work_order_lifecycle.sql
set SQL5=%BASE_DIR%\09_photo_item_link.sql
set SQL6=%BASE_DIR%\10_fix_quoted_identifier.sql
set SQL7=%BASE_DIR%\11_user_session.sql
set SQL8=%BASE_DIR%\12_part_update_delete.sql
set SQL9=%BASE_DIR%\13_payment_status_iban.sql
set SQL10=%BASE_DIR%\14_fix_supplier_description_encoding.sql
set SQL11=%BASE_DIR%\15_platform_admin.sql
set SQL12=%BASE_DIR%\16_shop_license.sql
set SQL13=%BASE_DIR%\17_payment_discount_supplier.sql
set SQL14=%BASE_DIR%\18_app_release.sql
set SQL15=%BASE_DIR%\19_subscription_plans.sql
set SQL16=%BASE_DIR%\20_customer_supplier_balance.sql
set SQL17=%BASE_DIR%\21_complaint_category.sql
set SQL18=%BASE_DIR%\22_activity_log.sql
set SQL19=%BASE_DIR%\23_customer_balance_fix.sql
set SQL20=%BASE_DIR%\24_fix_stale_odeme_tamamlandi_status.sql
set SQL21=%BASE_DIR%\25_rename_tamamlandi_label.sql

if not exist "%API_ZIP%" (
    echo HATA: %API_ZIP% bulunamadi!
    echo Once OtoServis-Api.zip, OtoServis-Admin.zip, OtoServis-Platform.zip
    echo ve SQL 05-25 dosyalarini C:\OtoServis\ altina kopyalayin.
    pause
    exit /b 1
)
if not exist "%ADMIN_ZIP%" (
    echo HATA: %ADMIN_ZIP% bulunamadi!
    pause
    exit /b 1
)

echo [1/7] .NET 8 kontrol...
dotnet --list-runtimes | findstr "Microsoft.AspNetCore.App 8" >nul
if errorlevel 1 (
    echo HATA: .NET 8 ASP.NET Core Runtime yok!
    pause
    exit /b 1
)
echo OK

echo [2/7] Veritabani guncellemeleri...
call :run_sql "%SQL1%" 05_work_order_assignment
call :run_sql "%SQL2%" 06_supplier_ledger
call :run_sql "%SQL3%" 07_unify_contacts
if exist "%SQL3%" (
    echo   07 notu: "UYARI:" satiri varsa telefon cakismasini SSMS'te kontrol edin.
)
call :run_sql "%SQL4%" 08_work_order_lifecycle
call :run_sql "%SQL5%" 09_photo_item_link
call :run_sql "%SQL6%" 10_fix_quoted_identifier
call :run_sql "%SQL7%" 11_user_session
call :run_sql "%SQL8%" 12_part_update_delete
call :run_sql "%SQL9%" 13_payment_status_iban
call :run_sql "%SQL10%" 14_fix_supplier_description_encoding
call :run_sql "%SQL11%" 15_platform_admin
call :run_sql "%SQL12%" 16_shop_license
call :run_sql "%SQL13%" 17_payment_discount_supplier
call :run_sql "%SQL14%" 18_app_release
call :run_sql "%SQL15%" 19_subscription_plans
call :run_sql "%SQL16%" 20_customer_supplier_balance
call :run_sql "%SQL17%" 21_complaint_category
call :run_sql "%SQL18%" 22_activity_log
call :run_sql "%SQL19%" 23_customer_balance_fix
call :run_sql "%SQL20%" 24_fix_stale_odeme_tamamlandi_status
call :run_sql "%SQL21%" 25_rename_tamamlandi_label
rem Encoding duzeltmesi EN SONDA: ara scriptler SP'yi yeniden yazsa bile Turkce bozulmasin
call :run_sql "%SQL10%" 14_fix_supplier_description_encoding

echo [3/7] Servisler durduruluyor (IIS varsa App Pool, yoksa eski surec)...
if exist "%BASE_DIR%\iis-setup\Restart-OtoServis.ps1" (
    powershell -ExecutionPolicy Bypass -File "%BASE_DIR%\iis-setup\Restart-OtoServis.ps1" -StopOnly
) else (
    for /f "tokens=5" %%a in ('netstat -ano ^| findstr :5280 ^| findstr LISTENING') do taskkill /F /PID %%a 2>nul
    for /f "tokens=5" %%a in ('netstat -ano ^| findstr :5281 ^| findstr LISTENING') do taskkill /F /PID %%a 2>nul
    for /f "tokens=5" %%a in ('netstat -ano ^| findstr :5282 ^| findstr LISTENING') do taskkill /F /PID %%a 2>nul
    taskkill /F /IM OtoServis.Api.exe 2>nul
    taskkill /F /IM OtoServis.Admin.exe 2>nul
    taskkill /F /IM OtoServis.Platform.exe 2>nul
    timeout /t 2 /nobreak >nul
)

echo [4/7] Yeni API dosyalari aciliyor...
if not exist "%API_DIR%" mkdir "%API_DIR%"
powershell -Command "Expand-Archive -Path '%API_ZIP%' -DestinationPath '%API_DIR%' -Force"
echo OK

echo [5/7] Yeni Admin dosyalari aciliyor...
if not exist "%ADMIN_DIR%" mkdir "%ADMIN_DIR%"
powershell -Command "Expand-Archive -Path '%ADMIN_ZIP%' -DestinationPath '%ADMIN_DIR%' -Force"
echo OK

echo [6/7] Yeni Platform dosyalari aciliyor...
if exist "%PLATFORM_ZIP%" (
    if not exist "%PLATFORM_DIR%" mkdir "%PLATFORM_DIR%"
    powershell -Command "Expand-Archive -Path '%PLATFORM_ZIP%' -DestinationPath '%PLATFORM_DIR%' -Force"
    echo OK
) else (
    echo UYARI: %PLATFORM_ZIP% yok — Platform atlandi.
)

echo [7/7] Servisler baslatiliyor (IIS varsa App Pool, yoksa eski surec)...
if exist "%BASE_DIR%\iis-setup\Restart-OtoServis.ps1" (
    powershell -ExecutionPolicy Bypass -File "%BASE_DIR%\iis-setup\Restart-OtoServis.ps1" -StartOnly
) else (
    cd /d "%API_DIR%"
    set ASPNETCORE_ENVIRONMENT=Production
    set ASPNETCORE_URLS=http://0.0.0.0:5280
    start "OtoServis-API" /MIN dotnet OtoServis.Api.dll

    timeout /t 3 /nobreak >nul

    cd /d "%ADMIN_DIR%"
    set ASPNETCORE_URLS=http://0.0.0.0:5281
    start "OtoServis-Admin" /MIN dotnet OtoServis.Admin.dll

    if exist "%PLATFORM_DIR%\OtoServis.Platform.dll" (
        timeout /t 2 /nobreak >nul
        cd /d "%PLATFORM_DIR%"
        set ASPNETCORE_URLS=http://0.0.0.0:5282
        start "OtoServis-Platform" /MIN dotnet OtoServis.Platform.dll
    )
)

echo.
echo ============================================
echo  Guncelleme tamam!
echo  API:      https://api.mobilservisiniz.com/swagger   (eski: http://37.148.211.243:5280/swagger)
echo  Admin:    https://panel.mobilservisiniz.com          (eski: http://37.148.211.243:5281)
echo  Platform: https://yonetim.mobilservisiniz.com        (eski: http://37.148.211.243:5282)
echo ============================================
pause
exit /b 0

:run_sql
if exist "%~1" (
    rem UTF-8: ara ara Turkce bozulmasinin ana nedeni sqlcmd'in OEM/ANSI okumasiydi
    chcp 65001 >nul
    sqlcmd -S "localhost" -U "otoservis_api" -P "%OTOSERVIS_DB_PASS%" -d "OtoServis" -C -I -f 65001 -i "%~1" -W
    if errorlevel 1 (
        echo UYARI: sqlcmd %~2 basarisiz. SSMS ile calistirin.
    ) else (
        echo SQL %~2 OK
    )
) else (
    echo UYARI: %~1 yok. SSMS ile %~2.sql calistirin.
)
exit /b 0
