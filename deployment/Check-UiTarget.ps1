#Requires -Version 7.2
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
# Reuse public dev API/identity checks without requesting Function management data.
& (Join-Path $PSScriptRoot 'Check-ApiTarget.ps1')
if ($env:AZURE_UI_STORAGE -cne 'sttempicsuidev' -or
    $env:TP_UI_URL -cnotmatch '^https://sttempicsuidev\.z[0-9]+\.web\.core\.windows\.net/$') {
    throw 'Invalid dev UI target.'
}
Write-Output 'Verified explicit dev UI and API deployment inputs.'
