# API Commands

Run from the repository root unless shown otherwise. Use .NET 10.

## Build And Test

```powershell
dotnet restore src/api/Tempics.slnx
dotnet build src/api/Tempics.slnx --no-restore
dotnet test --solution src/api/Tempics.slnx
```

The root global.json selects Microsoft.Testing.Platform. If the runner reports
zero tests, invoke the xUnit executable directly:

```powershell
dotnet run --project src/api/TP.Api.Tests/TP.Api.Tests.csproj -c Release -- -noLogo
```

Release avoids files held by a running Debug host. A zero-test run is not test
proof. See [testing guidance](testing.md) and
[Microsoft's MTP command reference](https://learn.microsoft.com/en-us/dotnet/core/tools/dotnet-test-mtp).

## Run Locally

Complete [local configuration and emulator setup](../../getting-started.md), then:

```powershell
Set-Location src/api/TP.AzureFunctions
func start --port 7159 --cors http://localhost:4200
```

Use the explicit Core Tools command. The launch profile's port/CORS arguments
have not reliably been applied by dotnet run. Check the actual port and exact
UI origin when using an IDE. Do not use wildcard or credentialed CORS.
