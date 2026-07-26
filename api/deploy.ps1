# OtoServis — Publish ve sunucuya deploy
# Sunucu: 37.148.211.243
# API: 5280 | Admin: 5281

param(
    [switch]$DeployOnly,
    [switch]$SkipDeploy
)

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
$PublishRoot = Join-Path (Split-Path -Parent $Root) "publish"
$Server = "37.148.211.243"
$ServerUser = "administrator"
$ServerPass = "Dl0#Zz1!Fc2!Mm2#"
$RemoteApiPath = "C:\OtoServis\api"
$RemoteAdminPath = "C:\OtoServis\admin"

function Publish-Project {
    param([string]$ProjectPath, [string]$Profile)
    Write-Host ">> Publish: $ProjectPath" -ForegroundColor Cyan
    dotnet publish $ProjectPath -p:PublishProfile=$Profile -c Release
    if ($LASTEXITCODE -ne 0) { throw "Publish failed: $ProjectPath" }
}

if (-not $DeployOnly) {
    Publish-Project "$Root\OtoServis.Api\OtoServis.Api.csproj" "Production"
    Publish-Project "$Root\OtoServis.Admin\OtoServis.Admin.csproj" "Production"

    Copy-Item "$Root\publish-templates\start-api.bat" "$PublishRoot\api\" -Force
    Copy-Item "$Root\publish-templates\start-admin.bat" "$PublishRoot\admin\" -Force

    Write-Host "`nPublish tamamlandi:" -ForegroundColor Green
    Write-Host "  API:   $PublishRoot\api"
    Write-Host "  Admin: $PublishRoot\admin"
}

if ($SkipDeploy) { exit 0 }

# --- Sunucuya kopyala (WinRM veya admin paylasimi) ---
$ApiSource = "$PublishRoot\api"
$AdminSource = "$PublishRoot\admin"

if (-not (Test-Path $ApiSource)) { throw "API publish klasoru yok. Once publish calistirin." }

Write-Host "`n>> Sunucuya deploy: $Server" -ForegroundColor Cyan

$secPass = ConvertTo-SecureString $ServerPass -AsPlainText -Force
$cred = New-Object System.Management.Automation.PSCredential($ServerUser, $secPass)

$deployScript = @"
`$apiPath = '$RemoteApiPath'
`$adminPath = '$RemoteAdminPath'
New-Item -ItemType Directory -Force -Path `$apiPath, `$adminPath | Out-Null

# Eski surecleri durdur
Get-Process -Name 'dotnet','OtoServis.Api' -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 2

# Firewall kurallari (yoksa ekle)
if (-not (Get-NetFirewallRule -DisplayName 'OtoServis API 5280' -ErrorAction SilentlyContinue)) {
    New-NetFirewallRule -DisplayName 'OtoServis API 5280' -Direction Inbound -Protocol TCP -LocalPort 5280 -Action Allow | Out-Null
}
if (-not (Get-NetFirewallRule -DisplayName 'OtoServis Admin 5281' -ErrorAction SilentlyContinue)) {
    New-NetFirewallRule -DisplayName 'OtoServis Admin 5281' -Direction Inbound -Protocol TCP -LocalPort 5281 -Action Allow | Out-Null
}

Write-Host 'Deploy klasorleri hazir.'
"@

try {
    Invoke-Command -ComputerName $Server -Credential $cred -ScriptBlock ([scriptblock]::Create($deployScript)) -ErrorAction Stop
    Write-Host "WinRM baglantisi OK" -ForegroundColor Green

    # Dosyalari zip ile gonder
    $apiZip = "$env:TEMP\otoservis-api.zip"
    $adminZip = "$env:TEMP\otoservis-admin.zip"
    if (Test-Path $apiZip) { Remove-Item $apiZip -Force }
    if (Test-Path $adminZip) { Remove-Item $adminZip -Force }
    Compress-Archive -Path "$ApiSource\*" -DestinationPath $apiZip -Force
    Compress-Archive -Path "$AdminSource\*" -DestinationPath $adminZip -Force

    Copy-Item $apiZip -Destination "\\$Server\C$\OtoServis\otoservis-api.zip" -Force
    Copy-Item $adminZip -Destination "\\$Server\C$\OtoServis\otoservis-admin.zip" -Force

    $startScript = @"
Expand-Archive -Path 'C:\OtoServis\otoservis-api.zip' -DestinationPath '$RemoteApiPath' -Force
Expand-Archive -Path 'C:\OtoServis\otoservis-admin.zip' -DestinationPath '$RemoteAdminPath' -Force

`$env:ASPNETCORE_ENVIRONMENT = 'Production'

Start-Process -FilePath 'dotnet' -ArgumentList '$RemoteApiPath\OtoServis.Api.dll' -WorkingDirectory '$RemoteApiPath' -WindowStyle Hidden
Start-Sleep -Seconds 3
Start-Process -FilePath 'dotnet' -ArgumentList '$RemoteAdminPath\OtoServis.Admin.dll' -WorkingDirectory '$RemoteAdminPath' -WindowStyle Hidden

Write-Host 'API ve Admin baslatildi.'
"@

    Invoke-Command -ComputerName $Server -Credential $cred -ScriptBlock ([scriptblock]::Create($startScript))
    Write-Host "`nDeploy basarili!" -ForegroundColor Green
    Write-Host "  API:   http://${Server}:5280/swagger"
    Write-Host "  Admin: http://${Server}:5281"
}
catch {
    Write-Host "`nOtomatik deploy basarisiz: $($_.Exception.Message)" -ForegroundColor Yellow
    Write-Host @"

Manuel deploy adimlari:
1. publish\api ve publish\admin klasorlerini sunucuya kopyalayin:
   C:\OtoServis\api
   C:\OtoServis\admin

2. Sunucuda .NET 8 Runtime yuklu olmali:
   https://dotnet.microsoft.com/download/dotnet/8.0

3. Firewall'da 5280 ve 5281 portlarini acin

4. Baslatma:
   cd C:\OtoServis\api
   set ASPNETCORE_ENVIRONMENT=Production
   dotnet OtoServis.Api.dll

   cd C:\OtoServis\admin
   set ASPNETCORE_ENVIRONMENT=Production
   dotnet OtoServis.Admin.dll

5. Test:
   http://${Server}:5280/api/auth/lookup-tenant?code=OTO-IST
   http://${Server}:5281
"@ -ForegroundColor Gray
}
