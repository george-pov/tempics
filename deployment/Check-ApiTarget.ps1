#Requires -Version 7.2
[CmdletBinding()]
param([switch]$ReadAzure)
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
foreach ($name in @('AZURE_CLIENT_ID', 'AZURE_TENANT_ID', 'AZURE_SUBSCRIPTION_ID')) {
    $value = [Environment]::GetEnvironmentVariable($name)
    $parsed = [guid]::Empty
    if (-not [guid]::TryParseExact($value, 'D', [ref]$parsed) -or $parsed -eq [guid]::Empty) { throw 'Missing or invalid Azure identifier.' }
}
if ($env:AZURE_RESOURCE_GROUP -cne 'rg-tempics-dev' -or $env:AZURE_FUNCTION_APP -cne 'func-tempics-api-dev' -or $env:TP_ENV -cne 'dev') {
    throw 'Unexpected deployment target.'
}
if ($env:TP_API_URL -cnotmatch '^https://func-tempics-api-dev(?:-[a-z0-9]+)?(?:\.[a-z0-9-]+)?\.azurewebsites\.net/api$') { throw 'Invalid API URL.' }
if ($ReadAzure) {
    Import-Module (Join-Path $PSScriptRoot 'DevSetup.psm1') -Force
    $expectedId = "/subscriptions/$env:AZURE_SUBSCRIPTION_ID/resourceGroups/$env:AZURE_RESOURCE_GROUP/providers/Microsoft.Web/sites/$env:AZURE_FUNCTION_APP"
    $app = Invoke-DevCli az @('resource', 'show', '--ids', $expectedId, '--subscription', $env:AZURE_SUBSCRIPTION_ID,
        '--api-version', '2024-04-01', '--query', '{id:id,host:properties.defaultHostName,sku:properties.sku,linux:properties.reserved,runtime:properties.functionAppConfig.runtime}',
        '-o', 'json') -Operation 'Verify Function target' | ConvertFrom-Json
    if ($app.id -ine $expectedId -or $app.sku -ne 'FlexConsumption' -or $app.linux -ne $true -or
        $app.runtime.name -ne 'dotnet-isolated' -or $app.runtime.version -ne '10.0' -or
        $env:TP_API_URL -cne "https://$($app.host)/api") { throw 'Live Function target mismatch.' }
    Write-Output 'Verified existing Linux Flex .NET 10 dev Function and API URL.'
}
