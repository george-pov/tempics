# Manual Azure Development Deployment

Run these PowerShell commands from the repository root. The subscription Bicep
deployment creates the resource group and the API/UI infrastructure. Application
publication is separate: the [GitHub workflows](github-dev.md) deploy Function
code and the UI independently after their scoped access setup.
Infrastructure deployment uploads no application. The commands below remain the
manual API publication and recovery path.

## Resources And Configuration

[`bicep/dev.bicepparam`](../../bicep/dev.bicepparam) defines the development
names and capacity. [`main.bicep`](../../bicep/main.bicep) creates the resource
group; [`resources.bicep`](../../bicep/resources.bicep) creates its resources;
[`storage-access.bicep`](../../bicep/storage-access.bicep) assigns storage access.
[`ui-storage.bicep`](../../bicep/ui-storage.bicep) creates the UI storage account,
enables static website hosting, and creates the private `$web` container.

| Resource | Name |
| --- | --- |
| Resource group | `rg-tempics-dev` |
| Function App | `func-tempics-api-dev` |
| Flex Consumption plan | `asp-tempics-api-dev` |
| Host and deployment storage | `sttempicsfuncdev` |
| Private deployment container | `app-package-dev` |
| UI static website storage | `sttempicsuidev` |
| UI website container | `$web` |
| Application Insights | `appi-tempics-api-dev` |
| Log Analytics workspace | `log-tempics-dev` |

The Function uses Linux Flex Consumption FC1, .NET 10 isolated, 2048 MB,
a maximum of ten instances, and zero always-ready instances. HTTP concurrency
is one per instance to match the current renderer's serialized execution.
These are initial development settings, not measured capacity or a spending cap.
Storage and telemetry usage are billed separately from Function execution.

The Function's system-assigned identity accesses host storage and deployment
packages. Storage Shared Key and anonymous blob access are disabled. The
identity receives Storage Blob Data Owner for host/package blobs and Storage
Table Data Contributor for host diagnostic events, scoped to this storage
account. Bicep supplies the Azure Monitor connection string by resource
reference; no credentials are parameters or deployment outputs.

Bicep owns the Function app-settings collection. Add future required settings
to the template before reapplying it. The template provisions infrastructure;
publishing code is a separate command. The sample endpoint validates Entra
bearer tokens and requires the delegated `Images.Render` scope. The four
`Auth__*` app settings come from Bicep's public `auth` parameter. See
[API authentication](../api/authentication.md).

UI storage uses Standard_LRS StorageV2, HTTPS/TLS 1.2, public website network
access, and Azure login for management/uploads. Shared Key, ordinary anonymous
blob access, and cross-tenant replication are disabled. The website serves
public files independently of the container's private blob access level.
Its index and error document names are `index.html` and `404.html`; Bicep creates
neither file. See [UI hosting](ui-storage.md) for the publication contract.

The UI publishing identity and its `$web` data role belong to the separate GitHub
access template. The previous manual operator assignment is not recreated by
this template. API CORS remains manually configured and is not owned by Bicep.
Workflow federation, Function-scoped deployment access, and UI container access use the separate
[GitHub access template and procedure](github-dev.md#1-preview-deployment-access).

The existing Application Insights smart-detection alert and its notification
action group are not declared here. Incremental deployment leaves that alert
unchanged; these templates do not promise to restore its notification setup
after deletion. Alerting ownership must be decided separately before treating
this as an exact backup of every manually/service-created resource in the group.

## Prerequisites

- PowerShell 7, Azure CLI with Bicep support, and the .NET 10 SDK.
- An Azure login with access to the target subscription. The operator needs
  resource-group creation/deployment permissions at subscription scope and
  resource management plus role-assignment write permissions for the new group.
- A region supporting .NET 10 Flex Consumption. The parameter file uses
  `westus2`.

Set the subscription explicitly for every Azure operation. The subscription
ID is a local operator value; it is not stored in the Bicep files.

```powershell
$subscriptionId = Read-Host 'Target Azure subscription ID'
$location = 'westus2'
$deploymentName = 'tempics-dev'
$resourceGroup = 'rg-tempics-dev'
$functionApp = 'func-tempics-api-dev'

az account show --subscription $subscriptionId --query '{name:name,id:id}' --output json
if ($LASTEXITCODE -ne 0) { throw 'Check the Azure login and subscription.' }
```

Use `az login` first if a login is needed. Confirm the account output is the
intended subscription. Keep the variables above aligned with the parameter
file if you change the region or names. Function App and storage names must
be globally available.

Set `TP_API_AUTH_JSON` before using `dev.bicepparam`. With the API's ignored
local settings configured for this environment, copy only its public auth values:

```powershell
$apiSettings = (Get-Content src/api/TP.AzureFunctions/local.settings.json -Raw | ConvertFrom-Json).Values
$env:TP_API_AUTH_JSON = @{
    instance = $apiSettings.Auth__Instance
    tenantId = $apiSettings.Auth__TenantId
    clientId = $apiSettings.Auth__ClientId
    issuer = $apiSettings.Auth__Issuer
} | ConvertTo-Json -Compress
```

These identify the External ID tenant and API registration, not the deployment
identity. Configure them before deploying the bearer-protected API. Never put
real tenant authority URLs or IDs in tracked parameter files.

## 1. Compile And Preview

These commands compile locally and ask Azure for a preview without creating
or changing resources. Compilation output is discarded rather than written
beside the source files.

```powershell
az bicep build --file bicep/main.bicep --stdout | Out-Null
if ($LASTEXITCODE -ne 0) { throw 'Bicep compilation failed.' }

az bicep build-params --file bicep/dev.bicepparam --stdout | Out-Null
if ($LASTEXITCODE -ne 0) { throw 'Parameter compilation failed.' }

az deployment sub validate --subscription $subscriptionId --location $location --name $deploymentName --template-file bicep/main.bicep --parameters bicep/dev.bicepparam --output none
if ($LASTEXITCODE -ne 0) { throw 'Azure provider validation failed.' }

az deployment sub what-if --subscription $subscriptionId --location $location --name $deploymentName --template-file bicep/main.bicep --parameters bicep/dev.bicepparam --result-format ResourceIdOnly
if ($LASTEXITCODE -ne 0) { throw 'Infrastructure preview failed.' }
```

Review the changes. First creation should target only `rg-tempics-dev` and its
resources. Existing unrelated groups may appear as `Ignore`. Nested role
assignments depend on the new Function identity and may not expand in What-If
until the identity exists. Investigate unexpected changes or provider errors
before applying.

## 2. Apply Infrastructure

This command creates or updates Azure resources, including the resource group.
There is no separate `az group create` step. Use this same command after an
approved group deletion to recreate the declared infrastructure. Deletion is
not part of this procedure. Incremental deployment preserves resources and blobs
that the template does not own; it does not make an existing group empty.

```powershell
az deployment sub create --subscription $subscriptionId --location $location --name $deploymentName --template-file bicep/main.bicep --parameters bicep/dev.bicepparam --query properties.provisioningState --output tsv
if ($LASTEXITCODE -ne 0) { throw 'Infrastructure deployment failed.' }

az resource list --subscription $subscriptionId --resource-group $resourceGroup --query '[].{name:name,type:type}' --output table
if ($LASTEXITCODE -ne 0) { throw 'Resource readback failed.' }

az deployment sub show --subscription $subscriptionId --name $deploymentName --query properties.outputs --output json
if ($LASTEXITCODE -ne 0) { throw 'Deployment output readback failed.' }
```

Outputs include the resource group, Function name/URL, and UI storage name/website
URL. Website settings are applied directly through the storage resource API;
there is no post-deployment script or separate website-enable command.

A freshly recreated website is empty and returns 404 until the application
pipeline uploads it. Function code, stored data, UI files, generated config,
manually set API CORS, and publishing-identity permissions are not recovered by
infrastructure deployment. Reapply their separate setup/deployment steps.

Allow time for managed identity permissions to propagate before publishing.
The role assignments are created after the Function identity exists, so an
initial storage authorization failure can be temporary. Check assignment and
deployment status before retrying; do not switch storage back to Shared Key.

## 3. Build The Function Package

Use a fresh temporary directory for each package. Publish the actual host
project for the Azure Linux architecture. No local settings file belongs in
the package.

```powershell
$packageDir = Join-Path ([IO.Path]::GetTempPath()) ('tempics-' + [guid]::NewGuid().ToString('N'))
$publishDir = Join-Path $packageDir 'publish'
$zipPath = Join-Path $packageDir 'function.zip'
New-Item -ItemType Directory -Path $packageDir -ErrorAction Stop | Out-Null

dotnet publish src/api/TP.AzureFunctions/TP.AzureFunctions.csproj --configuration Release --runtime linux-x64 --self-contained false --output $publishDir
if ($LASTEXITCODE -ne 0) { throw 'Function publish failed.' }

if (Test-Path (Join-Path $publishDir 'local.settings.json')) {
    throw 'Remove local settings from the publish configuration before packaging.'
}
foreach ($requiredFile in @('host.json', 'functions.metadata', 'worker.config.json', 'libSkiaSharp.so', 'libHarfBuzzSharp.so')) {
    if (-not (Test-Path (Join-Path $publishDir $requiredFile))) {
        throw "Required published file is missing: $requiredFile"
    }
}

[IO.Compression.ZipFile]::CreateFromDirectory($publishDir, $zipPath)
```

The ZIP contains the publish directory's contents at its root, including hidden
Functions metadata. Use the .NET compression call above because PowerShell's
`Compress-Archive` omits hidden files. Preserve a known-good ZIP for recovery.
Native library presence does not prove Azure compatibility; verify rendering
after deployment.

The Function host references `SkiaSharp.NativeAssets.Linux.NoDependencies`
and excludes the standard Linux native assets. This uses the bundled Inter font
without requiring Fontconfig in the Azure host image. Keep both native package
versions aligned with the SkiaSharp version used by Avalonia, and recheck the
published binary after dependency upgrades.

The Avalonia app builder also sets bundled Inter as its default font family.
Registering the Inter collection alone still lets startup depend on an
operating-system default font, which might not exist on the Linux host.

## 4. Publish The Package

This command deploys code to the Function App through Azure's Flex deployment
path. Remote build is disabled because the ZIP already contains published code.
Do not upload the ZIP directly to the storage container: that does not activate
the package as a Function deployment.

```powershell
az functionapp deployment source config-zip --subscription $subscriptionId --resource-group $resourceGroup --name $functionApp --src $zipPath --build-remote false --timeout 600 --output none
if ($LASTEXITCODE -ne 0) { throw 'Function package deployment failed.' }
```

## 5. Verify The Hosted Function

Read the actual hostname instead of assuming its format. Confirm an anonymous
POST is rejected and the Function is discovered.

```powershell
$appInfo = az functionapp show --subscription $subscriptionId --resource-group $resourceGroup --name $functionApp --output json | ConvertFrom-Json
if ($LASTEXITCODE -ne 0) { throw 'Function App readback failed.' }
$hostName = $appInfo.defaultHostName ?? $appInfo.properties.defaultHostName
if ([string]::IsNullOrWhiteSpace($hostName)) {
    throw 'Function hostname readback failed.'
}
$renderUrl = "https://$hostName/api/renders/sample"

az functionapp function list --subscription $subscriptionId --resource-group $resourceGroup --name $functionApp --query '[].name' --output tsv
if ($LASTEXITCODE -ne 0) { throw 'Function discovery failed.' }

$anonymous = Invoke-WebRequest -Uri $renderUrl -Method Post -SkipHttpErrorCheck
if ($anonymous.StatusCode -notin @(401, 403)) {
    throw "Expected anonymous rejection; received $($anonymous.StatusCode)."
}
```

For the authorized test, obtain an Entra API access token for the signed-in
user with the delegated `Images.Render` scope. Enter it at the secure prompt below;
never paste it into a command, URL, file, screenshot, or shell transcript.
The request sends it only in the `Authorization` header. Do not use an ID token,
Graph token, or Function key.

```powershell
$accessToken = Read-Host 'Entra API access token' -AsSecureString
$tokenValue = [System.Net.NetworkCredential]::new('', $accessToken).Password
$requestHeaders = @{ Authorization = 'Bearer ' + $tokenValue }
$pngPath = Join-Path $packageDir 'sample.png'
try {
    $result = Invoke-WebRequest -Uri $renderUrl -Method Post -Headers $requestHeaders -OutFile $pngPath -PassThru
    if ($result.StatusCode -ne 200 -or $result.Headers['Content-Type'] -notmatch '^image/png') {
        throw 'Expected a successful PNG response.'
    }
    $png = [IO.File]::ReadAllBytes($pngPath)
    if ($png.Length -lt 24 -or [Convert]::ToHexString($png[0..7]) -ne '89504E470D0A1A0A') {
        throw 'Response is not a PNG.'
    }
    $width = [uint32]([uint32]$png[16] * 16777216 + [uint32]$png[17] * 65536 + [uint32]$png[18] * 256 + $png[19])
    $height = [uint32]([uint32]$png[20] * 16777216 + [uint32]$png[21] * 65536 + [uint32]$png[22] * 256 + $png[23])
    if ($width -ne 1200 -or $height -ne 630) { throw 'Unexpected PNG dimensions.' }
    Write-Output "Verified 1200 x 630 PNG: $pngPath"
}
finally {
    $requestHeaders.Clear()
    $tokenValue = $null
    $accessToken.Dispose()
    $accessToken = $null
}
```

Open `sample.png` and confirm the sample's text, shapes, and fonts render
correctly. This is the hosted Avalonia/Skia/HarfBuzz compatibility check.
Use Application Insights to investigate errors; the Function returns safe
errors without native exception details.

## Recovery

- If Bicep fails, inspect its deployment error, correct the definition or
  parameters, and rerun What-If before reapplying. Incremental deployment
  preserves unrelated resources but does not undo partially created resources.
- If code deployment fails, inspect the Function App's Flex Consumption
  Deployment diagnostic in Azure. Retrying the known-good ZIP uses the same
  publish command. Changing Bicep does not roll back deployed code.
- A successful upload or running app is insufficient proof of image rendering.
  Verify the endpoint and visible PNG before declaring the deployment ready.

## References

- [Azure Functions infrastructure configuration](https://learn.microsoft.com/en-us/azure/azure-functions/functions-infrastructure-as-code)
- [Identity-based host storage permissions](https://learn.microsoft.com/en-us/azure/azure-functions/manage-connections?pivots=functions-auth-identity&tabs=host)
- [Flex scale limits](https://learn.microsoft.com/en-us/azure/azure-functions/event-driven-scaling#limit-scale-out)
- [Flex deployment commands](https://learn.microsoft.com/en-us/azure/azure-functions/flex-consumption-how-to)
