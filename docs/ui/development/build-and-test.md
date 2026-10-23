# UI Commands

Run from `src/ui/` after [local setup](../../getting-started.md).

```powershell
npm.cmd ci
npm.cmd start
npm.cmd run build
npm.cmd test -- --watch=false
```

Run only the command needed. Start serves the UI; build creates the production
output; test runs the unit suite. Use npm.cmd to preserve flags in PowerShell.
Use npm.cmd install only when intentionally updating dependencies.

## Production Build

Output is `dist/tempics/browser` and excludes local runtime JSON. For a local
copy, add configuration explicitly:

```powershell
Copy-Item public/config.json dist/tempics/browser/config.json
```

Serve it at an origin matching its registered redirects. Hosted publication uses
environment-specific JSON from the [deployment workflow](../../operations/deployment.md).
The same build can be reused with different configuration.

Scripts and versions belong to [package.json](../../../src/ui/package.json).
See [configuration](configuration.md) and [testing](testing.md).
