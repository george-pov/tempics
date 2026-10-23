# Run Locally

Use PowerShell 7, Node 24/npm 12, .NET 10 SDK, Functions Core Tools v4, and
[Azurite](https://learn.microsoft.com/en-us/azure/storage/common/storage-install-azurite).
You also need [Entra registration values](operations/entra-setup.md) and a permitted
account. Local requests require real API access tokens; there is no auth bypass.

## Configure

Create `src/api/TP.AzureFunctions/local.settings.json` only if absent:

```json
{
  "IsEncrypted": false,
  "Values": {
    "AzureWebJobsStorage": "UseDevelopmentStorage=true",
    "FUNCTIONS_WORKER_RUNTIME": "dotnet-isolated",
    "Auth__Instance": "https://tenant.example.test/",
    "Auth__TenantId": "11111111-1111-1111-1111-111111111111",
    "Auth__ClientId": "22222222-2222-2222-2222-222222222222",
    "Auth__Issuer": "https://tenant.example.test/tenant-id/v2.0"
  }
}
```

Replace all four auth fixtures with your API settings; see
[authentication](api/authentication.md#configuration). Preserve existing settings.

From `src/ui/`, create the UI configuration only if absent:

```powershell
if (-not (Test-Path public/config.json)) {
    Copy-Item config.example.json public/config.json
}
```

Fill in the SPA auth values using the [configuration reference](ui/development/configuration.md).
Keep the local API at `http://localhost:7159/api` and both registered redirects
at `http://localhost:4200/`. Both settings files stay local; fixture IDs cannot sign in.

## Start

Keep these three terminals running. Begin the API/UI terminals at the repository root.

Storage emulator:

```powershell
$azuriteData = Join-Path $env:LOCALAPPDATA 'Tempics/Azurite'
New-Item -ItemType Directory -Path $azuriteData -Force | Out-Null
azurite --location $azuriteData
```

API:

```powershell
dotnet restore src/api/Tempics.slnx
Set-Location src/api/TP.AzureFunctions
func start --port 7159 --cors http://localhost:4200
```

UI:

```powershell
Set-Location src/ui
npm.cmd ci
npm.cmd start
```

Open `http://localhost:4200/`, sign in, and select Generate sample image.
Expect a 1200 x 630 preview. Stop processes with Ctrl+C in their own terminals.

If ports change, align the API URL, exact CORS origin, and registered redirects.
There is no API proxy.

## If It Fails

- Startup error: check JSON and its response content type.
- API startup: check auth settings and Azurite.
- Sign-in: check registration, redirect, user-flow link, and account access.
- Browser request: check the API port and CORS.
- 401/403/500: see [API responses](api/endpoints.md#responses).

Build/test references: [API](api/development/build-and-test.md),
[UI](ui/development/build-and-test.md).
