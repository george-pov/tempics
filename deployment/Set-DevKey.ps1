#Requires -Version 7.2
[CmdletBinding()]
param(
    [Parameter(Mandatory)][string]$SubscriptionId,
    [string]$ResourceGroup = 'rg-tempics-dev',
    [string]$FunctionAppName = 'func-tempics-api-dev',
    [string]$Repository = 'george-pov/tempics',
    [string]$EnvironmentName = 'dev',
    [Parameter(Mandatory)][string]$KeyName
)
$ErrorActionPreference = 'Stop'
Import-Module (Join-Path $PSScriptRoot 'DevSetup.psm1') -Force
$context = Get-DevContext -SubscriptionId $SubscriptionId -ResourceGroup $ResourceGroup -FunctionAppName $FunctionAppName -Repository $Repository -EnvironmentName $EnvironmentName
try { Set-DevSecret $context $KeyName }
catch { throw 'Function-key transfer failed; inspect secret metadata before an authorized retry.' }
