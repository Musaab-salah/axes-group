$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot

$python = Get-Command py -ErrorAction SilentlyContinue
$pythonArgs = @('-3', (Join-Path $PSScriptRoot 'serve.py'))
if (-not $python) {
    $python = Get-Command python -ErrorAction SilentlyContinue
    $pythonArgs = @((Join-Path $PSScriptRoot 'serve.py'))
}
if (-not $python) { throw 'Python 3 is required on this Windows computer.' }

$defaultRoute = Get-NetRoute -AddressFamily IPv4 -DestinationPrefix '0.0.0.0/0' -ErrorAction SilentlyContinue |
    Sort-Object RouteMetric, InterfaceMetric | Select-Object -First 1
$localIP = $null
if ($defaultRoute) {
    $localIP = Get-NetIPAddress -AddressFamily IPv4 -InterfaceIndex $defaultRoute.InterfaceIndex -ErrorAction SilentlyContinue |
        Where-Object { $_.IPAddress -notlike '169.254.*' } | Select-Object -First 1 -ExpandProperty IPAddress
}

Write-Host 'AXES GROUP - office computer website' -ForegroundColor Cyan
Write-Host 'On this computer: http://127.0.0.1:8765' -ForegroundColor Green
if ($localIP) {
    Write-Host ("From the office network: http://{0}:8765" -f $localIP) -ForegroundColor Green
} else {
    Write-Host 'Run ipconfig to find this computer IPv4 address; use http://IP:8765' -ForegroundColor Yellow
}
Write-Host 'Keep this window open. Press Ctrl+C to stop the site.' -ForegroundColor Yellow
& $python.Source @pythonArgs
