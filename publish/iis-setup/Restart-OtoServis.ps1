# Restart-OtoServis.ps1
# API + Admin + Platform servislerini durdurur/baslatir.
# IIS App Pool'lari (OtoServisApiPool/OtoServisAdminPool/OtoServisPlatformPool) varsa onlari
# kullanir; henuz IIS gecisi yapilmadiysa eski dotnet konsol surecine geri duser.
#
# Kullanim:
#   .\Restart-OtoServis.ps1              (durdur + baslat)
#   .\Restart-OtoServis.ps1 -StopOnly
#   .\Restart-OtoServis.ps1 -StartOnly

param(
    [switch]$StopOnly,
    [switch]$StartOnly
)

$pools = @("OtoServisApiPool", "OtoServisAdminPool", "OtoServisPlatformPool")
$legacy = @(
    @{ Name = "OtoServis.Api";      Port = 5280; Path = "C:\OtoServis\api\OtoServis.Api.dll" },
    @{ Name = "OtoServis.Admin";    Port = 5281; Path = "C:\OtoServis\admin\OtoServis.Admin.dll" },
    @{ Name = "OtoServis.Platform"; Port = 5282; Path = "C:\OtoServis\platform\OtoServis.Platform.dll" }
)

Import-Module WebAdministration -ErrorAction SilentlyContinue
$iisAvailable = [bool](Get-Module WebAdministration -ErrorAction SilentlyContinue)
if ($iisAvailable) {
    $iisAvailable = Test-Path "IIS:\AppPools\$($pools[0])"
}

function Stop-Services {
    if ($iisAvailable) {
        Write-Host "IIS App Pool'lari durduruluyor..." -ForegroundColor Cyan
        foreach ($p in $pools) {
            if (Test-Path "IIS:\AppPools\$p") {
                Stop-WebAppPool -Name $p -ErrorAction SilentlyContinue
                Write-Host "  $p durduruldu"
            }
        }
        Start-Sleep -Seconds 2
    } else {
        Write-Host "IIS App Pool bulunamadi, eski dotnet surecleri durduruluyor..." -ForegroundColor Yellow
        foreach ($svc in $legacy) {
            try {
                Get-NetTCPConnection -LocalPort $svc.Port -ErrorAction SilentlyContinue |
                    ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }
            } catch {}
        }
        Start-Sleep -Seconds 2
    }
}

function Start-Services {
    if ($iisAvailable) {
        Write-Host "IIS App Pool'lari baslatiliyor..." -ForegroundColor Cyan
        foreach ($p in $pools) {
            if (Test-Path "IIS:\AppPools\$p") {
                Start-WebAppPool -Name $p -ErrorAction SilentlyContinue
                Write-Host "  $p baslatildi"
            }
        }
    } else {
        Write-Host "IIS App Pool bulunamadi, eski dotnet surecleri ile baslatiliyor..." -ForegroundColor Yellow
        Write-Host "  (Bu durum IIS gecisi henuz yapilmadigini gosterir — bkz. publish\iis-setup\)" -ForegroundColor DarkYellow
        $env:ASPNETCORE_ENVIRONMENT = "Production"
        foreach ($svc in $legacy) {
            if (Test-Path $svc.Path) {
                $env:ASPNETCORE_URLS = "http://0.0.0.0:$($svc.Port)"
                Start-Process -FilePath "dotnet" -ArgumentList "`"$($svc.Path)`"" -WorkingDirectory (Split-Path $svc.Path) -WindowStyle Hidden
                Write-Host "  $($svc.Name) baslatildi (port $($svc.Port))"
                Start-Sleep -Seconds 2
            }
        }
    }
}

if ($StopOnly) { Stop-Services }
elseif ($StartOnly) { Start-Services }
else { Stop-Services; Start-Services }

Write-Host ""
Write-Host "Tamamlandi. Mod: $(if ($iisAvailable) { 'IIS' } else { 'Legacy dotnet' })" -ForegroundColor Green
