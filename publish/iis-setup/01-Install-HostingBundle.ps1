# 01-Install-HostingBundle.ps1
# Sunucuda (RDP ile, yonetici PowerShell) BIR KEZ calistirilir.
# IIS rolunu, .NET 8 ASP.NET Core Hosting Bundle'i ve URL Rewrite modulunu kurar.
#
# Kullanim:
#   cd C:\OtoServis\iis-setup
#   .\01-Install-HostingBundle.ps1

$ErrorActionPreference = "Stop"

Write-Host "=== 1/4: IIS rolu kuruluyor ===" -ForegroundColor Cyan
Install-WindowsFeature -Name Web-Server -IncludeManagementTools | Out-Null
Install-WindowsFeature -Name Web-Http-Redirect | Out-Null
Write-Host "IIS rolu OK" -ForegroundColor Green

$tempDir = "$env:TEMP\otoservis-iis-setup"
New-Item -ItemType Directory -Force -Path $tempDir | Out-Null

Write-Host "`n=== 2/4: ASP.NET Core Hosting Bundle (.NET 8) indiriliyor ===" -ForegroundColor Cyan
# Microsoft'un daima en son .NET 8.x hosting bundle'ina yonlendiren kalici (aka.ms) linki:
$hostingBundleUrl = "https://aka.ms/dotnetcore-8-0-windowshosting"
$hostingBundlePath = Join-Path $tempDir "dotnet-hosting-bundle.exe"
try {
    Invoke-WebRequest -Uri $hostingBundleUrl -OutFile $hostingBundlePath -UseBasicParsing
} catch {
    Write-Host "UYARI: Otomatik indirme basarisiz." -ForegroundColor Yellow
    Write-Host "Elle indirin: https://dotnet.microsoft.com/download/dotnet/8.0 -> 'Hosting Bundle'" -ForegroundColor Yellow
    Write-Host "Indirdikten sonra bu scripti tekrar calistirin veya installer'i elle calistirin." -ForegroundColor Yellow
    exit 1
}

Write-Host "Hosting Bundle kuruluyor (sessiz mod)..." -ForegroundColor Cyan
Start-Process -FilePath $hostingBundlePath -ArgumentList "/quiet", "/norestart" -Wait
Write-Host "Hosting Bundle OK" -ForegroundColor Green

Write-Host "`n=== 3/4: URL Rewrite modulu indiriliyor ===" -ForegroundColor Cyan
$rewriteUrl = "https://download.microsoft.com/download/1/2/8/128E2E22-C1B9-44A4-BE2A-5859ED1D4592/rewrite_amd64_en-US.msi"
$rewritePath = Join-Path $tempDir "urlrewrite.msi"
try {
    Invoke-WebRequest -Uri $rewriteUrl -OutFile $rewritePath -UseBasicParsing
    Write-Host "URL Rewrite kuruluyor (sessiz mod)..." -ForegroundColor Cyan
    Start-Process -FilePath "msiexec.exe" -ArgumentList "/i", "`"$rewritePath`"", "/quiet", "/norestart" -Wait
    Write-Host "URL Rewrite OK" -ForegroundColor Green
} catch {
    Write-Host "UYARI: URL Rewrite otomatik indirilemedi." -ForegroundColor Yellow
    Write-Host "Elle indirip kurun: https://www.iis.net/downloads/microsoft/url-rewrite" -ForegroundColor Yellow
}

Write-Host "`n=== 4/4: IIS/WAS yeniden baslatiliyor ===" -ForegroundColor Cyan
net stop was /y | Out-Null
net start w3svc | Out-Null
Write-Host "IIS yeniden baslatildi" -ForegroundColor Green

Write-Host "`n=== Dogrulama ===" -ForegroundColor Cyan
Write-Host "IIS Manager'i acip Server (root) -> Modules listesinde 'AspNetCoreModuleV2' gorunmeli."
Write-Host "Kontrol icin: dotnet --info  (ASP.NET Core Runtime 8.x listelenmeli)"
dotnet --list-runtimes

Write-Host "`nTamamlandi. Sirada: 02-Create-Sites.ps1" -ForegroundColor Green
