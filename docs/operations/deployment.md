# Application Deployment

The [API](../../.github/workflows/deploy-api.yml) and
[UI](../../.github/workflows/deploy-ui.yml) workflows own build/publication steps.
Prerequisites: [infrastructure](infrastructure.md), [deployment access](github-setup.md),
and matching [API/UI identity settings](entra-setup.md).

## Deploy

A push to main starts both workflows for dev. For manual publication, run the
required command from the repository root with an authenticated GitHub CLI:

```powershell
gh workflow run deploy-api.yml --repo george-pov/tempics --ref main -f environment=dev
gh workflow run deploy-ui.yml --repo george-pov/tempics --ref main -f environment=dev
```

For initial setup or coordinated auth changes, publish and verify the API before
the UI. The workflows run independently and do not enforce this order.

Manual dispatch also accepts prod, which requires its own configured resources
and Environment. Current Bicep parameter files cover dev only.

## Publication Behavior

Each workflow runs from main, uses its Environment's federated identity, and has
a five-minute job limit. Concurrency is per app/environment without cancelling
an active deployment.

The API publishes Linux x64 with remote build disabled. The UI production build
excludes local config; publication writes `UI_APP_CONFIG_JSON`, stripping a
legacy Function key, and uploads the [static entry/assets](ui-storage.md).
The workflow parses JSON; the browser validates its contract.

Neither workflow runs tests or hosted checks, or retains deployment artifacts.
Use workflow source for exact tool versions and build/upload commands.

## Verify The Applications

Check the intended GitHub Actions run, then:

1. Verify anonymous API requests return 401 and valid delegated tokens return a
   PNG using [manual verification](manual-api-deployment.md#verify-the-hosted-function).
2. Read the UI address from infrastructure outputs and check entry, asset, and
   configuration responses against the [hosting contract](ui-storage.md).
3. Configure the Function's exact UI CORS origin manually; confirm browser
   preflight permits Authorization. Bicep/workflows do not set CORS.
4. Sign in, generate the preview, sign out, and check direct-route reloads.

Publication success alone does not prove application behavior.

## Recovery

Correct the failed build, permission, or setting and dispatch the affected workflow.
For bad UI JSON, fix the GitHub variable and republish. For auth failures, check
[Entra setup](entra-setup.md); retain bearer protection.

To publish older code, restore that source on main through the normal Git process
and dispatch again. Keep API/UI/configuration compatible. Uploads are non-atomic
and leave old assets; rerunning overwrites completed writes. Saved compatible
packages provide a manual recovery path. Do not delete infrastructure as
application recovery.
