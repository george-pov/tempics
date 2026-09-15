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
even if local settings exist. Packaging is a separate command:

```powershell
$env:TP_ENV = 'dev'
$env:TP_API_URL = 'https://dev.example.test/api'
npm run config:write -- --out dist/tempics/browser
```

Use explicit dev/prod settings for each copy of the same build. The URL above is
a reserved fixture. See [configuration](configuration.md#build-once-and-package)
for supported Node versions, tooling/source alignment, and artifact reuse.

## Unit Tests

```powershell
npm test
npm test -- --watch=false
npm run test:config
```

The Node packaging tests complement Angular tests and make no network requests.
In PowerShell environments where `npm.ps1` consumes forwarded flags, use
`npm.cmd` with the same arguments.

The scripts and exact dependency versions are owned by `package.json` and
`package-lock.json`. Starting the server, installing packages, building, and
testing must not be performed during plan-only or task-design work.
