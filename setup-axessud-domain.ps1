$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot

$cloudflared = Join-Path $PSScriptRoot 'cloudflared.exe'
if (-not (Test-Path $cloudflared)) {
    $found = Get-Command cloudflared -ErrorAction SilentlyContinue
    if ($found) { $cloudflared = $found.Source }
    else { throw 'cloudflared.exe not found beside this script.' }
}

$configDir = Join-Path $PSScriptRoot 'cloudflare'
$configPath = Join-Path $configDir 'config.yml'
$credDir = Join-Path $env:USERPROFILE '.cloudflared'
$tunnelName = 'axes-group'
$domain = 'axessud.com'

New-Item -ItemType Directory -Force -Path $configDir | Out-Null

Write-Host ''
Write-Host '=== AXES GROUP - axessud.com tunnel setup ===' -ForegroundColor Cyan
Write-Host 'A browser window will open for Cloudflare login if needed.' -ForegroundColor Yellow
Write-Host ''

& $cloudflared tunnel login
if ($LASTEXITCODE -ne 0) { throw 'cloudflared login failed.' }

$tunnelId = $null
$listJson = & $cloudflared tunnel list --output json 2>$null
if ($listJson) {
    $tunnels = $listJson | ConvertFrom-Json
    $match = @($tunnels | Where-Object { $_.name -eq $tunnelName }) | Select-Object -First 1
    if ($match) {
        $tunnelId = [string]$match.id
        Write-Host "Tunnel '$tunnelName' already exists - reusing it." -ForegroundColor Green
    }
}

if (-not $tunnelId) {
    Write-Host "Creating tunnel '$tunnelName'..." -ForegroundColor Cyan
    $createOut = & $cloudflared tunnel create $tunnelName 2>&1 | Out-String
    Write-Host $createOut
    if ($createOut -match '([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})') {
        $tunnelId = $Matches[1]
    } else {
        $listJson = & $cloudflared tunnel list --output json
        $tunnels = $listJson | ConvertFrom-Json
        $match = @($tunnels | Where-Object { $_.name -eq $tunnelName }) | Select-Object -First 1
        if ($match) { $tunnelId = [string]$match.id }
    }
}

if (-not $tunnelId) { throw 'Could not determine tunnel id.' }

$credFile = Join-Path $credDir ($tunnelId + '.json')
if (-not (Test-Path $credFile)) {
    throw ('Credentials file missing: ' + $credFile)
}

$yaml = @(
    "tunnel: $tunnelId"
    "credentials-file: $credFile"
    ''
    'ingress:'
    "  - hostname: $domain"
    '    service: http://127.0.0.1:8765'
    "  - hostname: www.$domain"
    '    service: http://127.0.0.1:8765'
    '  - service: http_status:404'
) -join "`n"
[System.IO.File]::WriteAllText($configPath, $yaml + "`n", [System.Text.UTF8Encoding]::new($false))

Write-Host ''
Write-Host ("Writing DNS routes for {0} and www.{0} ..." -f $domain) -ForegroundColor Cyan
& $cloudflared tunnel route dns $tunnelName $domain
& $cloudflared tunnel route dns $tunnelName ("www." + $domain)

$statePath = Join-Path $configDir 'tunnel-id.txt'
Set-Content -Path $statePath -Value $tunnelId -Encoding ASCII

Write-Host ''
Write-Host '=== Tunnel setup complete ===' -ForegroundColor Green
Write-Host ("Tunnel ID: {0}" -f $tunnelId)
Write-Host ("Config:    {0}" -f $configPath)
Write-Host ''
Write-Host 'Next: run start-domain-site.cmd and open https://axessud.com' -ForegroundColor Cyan
