# Manual API Deployment

Use this fallback to publish or recover a Function package. Routine publication
uses [GitHub](deployment.md). Run from the repository root with PowerShell 7,
.NET 10, Azure CLI, and deployment access to the configured Function.

## Build And Publish

```powershell
$subscriptionId = Read-Host 'Target Azure subscription ID'
$resourceGroup = 'rg-tempics-dev'
$functionApp = 'func-tempics-api-dev'
$packageDir = Join-Path ([IO.Path]::GetTempPath()) ('tempics-' + [guid]::NewGuid().ToString('N'))
$publishDir = Join-Path $packageDir 'publish'
$zipPath = Join-Path $packageDir 'function.zip'
New-Item -ItemType Directory -Path $packageDir | Out-Null

dotnet publish src/api/TP.AzureFunctions/TP.AzureFunctions.csproj -c Release --runtime linux-x64 --self-contained false --output $publishDir
if ($LASTEXITCODE -ne 0) { throw 'Publish failed.' }
if (Test-Path (Join-Path $publishDir 'local.settings.json')) { throw 'Local settings must not be packaged.' }
foreach ($file in @('host.json', 'functions.metadata', 'worker.config.json', 'libSkiaSharp.so', 'libHarfBuzzSharp.so')) {
    if (-not (Test-Path (Join-Path $publishDir $file))) { throw "Missing package file: $file" }
}
[IO.Compression.ZipFile]::CreateFromDirectory($publishDir, $zipPath)
az functionapp deployment source config-zip --subscription $subscriptionId --resource-group $resourceGroup --name $functionApp --src $zipPath --build-remote false --timeout 600 --output none
if ($LASTEXITCODE -ne 0) { throw 'Deployment failed.' }
```

Confirm the target and API auth settings before publishing. Keep a known-good
ZIP. Use .NET ZIP creation to preserve hidden Functions metadata. Uploading a
ZIP directly to storage does not activate a Function deployment.

The host bundles Inter and Linux native libraries without requiring Fontconfig.
Keep native packages aligned with Avalonia and recheck Linux rendering after
dependency changes; file presence alone does not prove compatibility.

## Verify The Hosted Function

This block also works without publishing. It defines its own target/output
values. Obtain an API access token through the configured SPA flow with
`Images.Render`; enter it only at the secure prompt.

```powershell
$subscriptionId = Read-Host 'Target Azure subscription ID'
$resourceGroup = 'rg-tempics-dev'
$functionApp = 'func-tempics-api-dev'
$hostName = az functionapp show --subscription $subscriptionId -g $resourceGroup -n $functionApp --query defaultHostName -o tsv
if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($hostName)) { throw 'Hostname lookup failed.' }
$renderUrl = "https://$hostName/api/renders/sample"
$anonymous = Invoke-WebRequest -Uri $renderUrl -Method Post -SkipHttpErrorCheck
if ($anonymous.StatusCode -ne 401) { throw 'Expected anonymous HTTP 401.' }

$pngPath = Join-Path ([IO.Path]::GetTempPath()) ('tempics-' + [guid]::NewGuid().ToString('N') + '.png')
$accessToken = Read-Host 'Entra API access token' -AsSecureString
try {
    $result = Invoke-WebRequest -Uri $renderUrl -Method Post -Authentication Bearer -Token $accessToken -OutFile $pngPath -PassThru
    if ($result.StatusCode -ne 200 -or $result.Headers['Content-Type'] -notmatch '^image/png') {
        throw 'Expected a successful PNG response.'
    }
} finally {
    $accessToken.Dispose()
}
Write-Output "Open and inspect: $pngPath"
```

Open the PNG and confirm 1200 x 630 dimensions, text, shapes, and fonts.
Keep tokens out of URLs, files, screenshots, and transcripts.

## Recovery

Inspect deployment diagnostics or safe API logs, correct the cause, and publish
a known-good ZIP with the same command. Preserve compatible auth settings and
bearer protection. Verify the resulting image; neither upload success nor an
infrastructure redeployment proves rendering works.
