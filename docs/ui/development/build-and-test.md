# UI Build And Test

Run these commands from `src/ui/`.

## Install

For local development:

```powershell
npm install
```

Use `npm ci` for a clean reproducible CI installation.

## Development Server

Create ignored local settings from the tracked example only when absent:

```powershell
if (-not (Test-Path public/config.json)) {
  Copy-Item config.example.json public/config.json
}
```

Replace the example authentication values with the Entra SPA registration and
API scope, using the registered localhost root URL for both redirects.

In a separate terminal, start the API from `src/api/TP.AzureFunctions/`:

```powershell
func start --port 7159 --cors http://localhost:4200
```

Then start the UI from `src/ui/`:

```powershell
npm start
```

The development server listens on `http://localhost:4200/` by default.
The browser calls the configured API directly. There is no API proxy. If using
a different UI port, pass that exact UI origin to Core Tools. Keep
`public/config.json` aligned with the API port. See the
[API command guide](../../api/development/build-and-test.md) for the launch-profile
limitation and [runtime configuration](configuration.md) for the full contract.

## Production Build

```powershell
npm run build
```

The optimized output under `dist/tempics/browser` contains no runtime JSON,
even if local settings exist. The deployment workflow writes the complete JSON
from GitHub Environment variable `UI_APP_CONFIG_JSON` to `config.json`.
For a local copy of the build, copy your complete configuration:

```powershell
Copy-Item public/config.json dist/tempics/browser/config.json
```

Use explicit dev/prod settings and registered HTTPS redirects for hosted copies.
See [configuration](configuration.md#build-once-and-package)
for the runtime JSON contract.

## Unit Tests

```powershell
npm test
npm test -- --watch=false
```

In PowerShell environments where `npm.ps1` consumes forwarded flags, use
`npm.cmd` with the same arguments.

The scripts and exact dependency versions are owned by `package.json` and
`package-lock.json`. Starting the server, installing packages, building, and
testing must not be performed during plan-only or task-design work.
