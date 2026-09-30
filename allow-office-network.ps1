$ErrorActionPreference = 'Stop'
$ruleName = 'AXES GROUP Website LAN TCP 8765'
if (-not (Get-NetFirewallRule -DisplayName $ruleName -ErrorAction SilentlyContinue)) {
    New-NetFirewallRule -DisplayName $ruleName -Direction Inbound -Action Allow -Protocol TCP -LocalPort 8765 -Profile Private -RemoteAddress LocalSubnet | Out-Null
}
Write-Host 'Local office network access enabled on TCP port 8765.'
