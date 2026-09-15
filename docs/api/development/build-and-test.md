# API Build And Test

Run these commands from the repository root unless noted.

## Restore And Build

```powershell
dotnet restore src/api/Tempics.slnx
dotnet build src/api/Tempics.slnx --no-restore
```

## Tests

Run every backend test project included in the solution:

```powershell
dotnet test src/api/Tempics.slnx
```

The solution contains `TP.Application`, `TP.Avalonia`, `TP.AzureFunctions`, and
the `TP.Api.Tests` test project.

## Local Functions Host

Azure Functions Core Tools v4 is required:

```powershell
Set-Location src/api/TP.AzureFunctions
func start --port 7159 --cors http://localhost:4200
```

The UI calls the API directly. Permit only its exact local origin; if using a
different UI port, replace the CORS origin in this invocation. Do not enable a
wildcard or `--cors-credentials` for the sample flow. Match the API address in
the UI's ignored `public/config.json`; see
[UI configuration](../../ui/development/configuration.md).

The `TP.AzureFunctions` launch profile declares
`--port 7159 --cors http://localhost:4200`. With the current Worker SDK,
`dotnet run --launch-profile TP.AzureFunctions` was observed to start Core Tools
on its default port 7071 without applying those arguments. Use the explicit
`func start` command above when starting from a terminal. Verify port and CORS
when using an IDE launcher; profile contents alone do not prove host behavior.

Do not put local secrets in tracked settings files. Starting the host is runtime
validation and must not be performed during plan-only or task-design work.
