$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot

$cloudflared = Join-Path $PSScriptRoot 'cloudflared.exe'
if (-not (Test-Path $cloudflared)) {
    $found = Get-Command cloudflared -ErrorAction SilentlyContinue
    if ($found) { $cloudflared = $found.Source }
    else { throw 'cloudflared.exe not found.' }
}

$configPath = Join-Path $PSScriptRoot 'cloudflare\config.yml'
if (-not (Test-Path $configPath)) {
    throw 'Missing cloudflare\config.yml — run setup-axessud-domain.cmd first.'
}

$env:Path = [System.Environment]::GetEnvironmentVariable('Path','Machine') + ';' + [System.Environment]::GetEnvironmentVariable('Path','User')
$npm = Get-Command npm -ErrorAction SilentlyContinue
if (-not $npm) { throw 'Node.js/npm is required. Install Node LTS then retry.' }

$cmsDir = Join-Path $PSScriptRoot 'cms'
$server = Start-Process -FilePath $npm.Source -ArgumentList @('run','start') -WorkingDirectory $cmsDir -PassThru -WindowStyle Hidden
try {
    Start-Sleep -Seconds 3
    if ($server.HasExited) { throw 'CMS server failed to start. Run: cd cms && npm run start' }
    Write-Host 'AXES CMS + site: http://127.0.0.1:8765' -ForegroundColor Cyan
    Write-Host 'Admin: http://127.0.0.1:8765/admin' -ForegroundColor Cyan
    Write-Host 'Public: https://axessud.com (keep this window open)' -ForegroundColor Green
    & $cloudflared tunnel --config $configPath run
}
finally {
    if (-not $server.HasExited) { Stop-Process -Id $server.Id -Force -ErrorAction SilentlyContinue }
}
