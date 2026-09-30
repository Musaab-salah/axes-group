$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot

$cloudflared = Join-Path $PSScriptRoot 'cloudflared.exe'
if (-not (Test-Path $cloudflared)) {
    $found = Get-Command cloudflared -ErrorAction SilentlyContinue
    if ($found) { $cloudflared = $found.Source }
    else { throw 'Download cloudflared-windows-amd64.exe, rename it cloudflared.exe, and put it beside start-site.cmd.' }
}

$python = Get-Command py -ErrorAction SilentlyContinue
$serverArgs = @('-3', (Join-Path $PSScriptRoot 'serve.py'))
if (-not $python) {
    $python = Get-Command python -ErrorAction SilentlyContinue
    $serverArgs = @((Join-Path $PSScriptRoot 'serve.py'))
}
if (-not $python) { throw 'Python 3 is required on this Windows computer.' }

$server = Start-Process -FilePath $python.Source -ArgumentList $serverArgs -WorkingDirectory $PSScriptRoot -PassThru -WindowStyle Hidden
try {
    Start-Sleep -Seconds 2
    if ($server.HasExited) { throw 'The local site server did not start. Check whether port 8765 is already in use.' }
    Write-Host 'AXES GROUP is running locally at http://127.0.0.1:8765' -ForegroundColor Cyan
    Write-Host 'Wait for the public https://....trycloudflare.com link below, then share it.' -ForegroundColor Yellow
    Write-Host 'Keep this window open to keep the public link active.' -ForegroundColor Yellow
    & $cloudflared tunnel --url http://127.0.0.1:8765
}
finally {
    if (-not $server.HasExited) { Stop-Process -Id $server.Id -Force }
}
