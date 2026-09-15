# API Build And Test

Run these commands from the repository root unless noted.

## Restore And Build

```powershell
dotnet restore src/api/Tempics/Tempics.slnx
dotnet build src/api/Tempics/Tempics.slnx --no-restore
```

## Tests

Run every backend test project included in the solution:

```powershell
dotnet test src/api/Tempics/Tempics.slnx
```

The solution currently contains only the Azure Functions host. Add dedicated
unit and integration test projects with the first behavior that needs them.

## Local Functions Host

Azure Functions Core Tools v4 is required:

```powershell
Set-Location src/api/Tempics/TP.AzureFunctions
func start
```

Do not put local secrets in tracked settings files. Starting the host is runtime
validation and must not be performed during plan-only or task-design work.
