#Requires -Version 7.2
[CmdletBinding()]
param(
    [Parameter(Mandatory)][string]$SubscriptionId,
    [string]$ResourceGroup = 'rg-tempics-dev',
    [string]$IdentityName = 'id-tempics-gh-dev',
    [string]$FunctionAppName = 'func-tempics-api-dev',
    [string]$Repository = 'george-pov/tempics',
    [string]$EnvironmentName = 'dev',
    [switch]$InspectOnly
)
$ErrorActionPreference = 'Stop'
Import-Module (Join-Path $PSScriptRoot 'DevSetup.psm1') -Force
$context = Get-DevContext -SubscriptionId $SubscriptionId -ResourceGroup $ResourceGroup -IdentityName $IdentityName -FunctionAppName $FunctionAppName -Repository $Repository -EnvironmentName $EnvironmentName
$null = Get-DevPolicy $context
if ($InspectOnly) {
    [pscustomobject]@{ Repository = $Repository; Environment = $EnvironmentName; Branch = 'main'; Variables = $context.Variables }
    return
}
try {
    Set-DevEnvironment $context
    foreach ($item in $context.Variables.GetEnumerator()) { Set-DevVariable $context $item.Key $item.Value }
    Write-Output 'Verified dev main-only policy and seven deployment variables.'
}
catch { throw 'Dev setup failed; partial changes may exist. Inspect the target and rerun corrected setup.' }
