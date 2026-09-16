# GitHub Deployment

The [API workflow](../../.github/workflows/deploy-api.yml) publishes the .NET app
and deploys it to the selected Environment's `AZURE_FUNCTION_APP`. The
[UI workflow](../../.github/workflows/deploy-ui.yml) builds Angular, writes public
runtime configuration, and uploads it to that Environment's `AZURE_UI_STORAGE`
account and `$web` container.

Each workflow has one job and deploys to `dev` automatically on pushes to `main`.
Manual runs from `main` accept an `environment` choice of `dev` (default) or
`prod`. Each job uses the selected GitHub Environment's
variables and signs in to Azure with OIDC. Each job has a five-minute limit,
including build and deployment. Actions use major-version tags.
A successful Azure deployment action or upload command is the deployment result.
Neither workflow runs tests, artifact/hash checks, HTTP probes, or browser checks.
Infrastructure provisioning remains manual.

Dev targets `func-tempics-api-dev` and `sttempicsuidev`. The GitHub `prod`
Environment is an empty placeholder with no variables or secrets. Production
Azure resources, OIDC federation, permissions, and Environment variables must
be configured before it can deploy. The access templates below configure dev.

## Prerequisites

- Existing Linux Flex Consumption .NET 10 Function infrastructure in
  `rg-tempics-dev`, region `westus2`; see [manual Azure setup](azure-dev.md).
- PowerShell 7.2+, Azure CLI with Bicep, and GitHub CLI. Use existing `az login`
  and `gh auth login` sessions.
- An explicitly selected subscription and its matching identity tenant.
- Operator permission to deploy the access template and create its role
  assignment, plus GitHub permission to administer the repository Environment
  and variables. These are operator permissions, not runner grants.
- Separate authorization for infrastructure Apply, GitHub configuration,
  Git publication and application deployment.
- Reviewed workflow and scripts on `george-pov/tempics` branch `main` before
  dispatch. No application source changes are required by this procedure.

## 1. Preview Deployment Access

Run from the repository root. The dedicated resource-group template creates
`id-tempics-gh-dev`, federation `github-dev`, and Website Contributor
(`de139f84-1756-47ae-9be6-808fbbe84772`) scoped to the dev Function only.
It also defines Storage Blob Data Contributor
(`ba92f5b4-2d11-453d-a403-e96b0029c9fe`) at
`sttempicsuidev/blobServices/default/containers/$web` for UI uploads. Runtime
identities, runtime storage roles, app settings, and CORS remain separate.

Federation accepts issuer `https://token.actions.githubusercontent.com`, audience
`api://AzureADTokenExchange`, and subject
`repo:george-pov@287842525/tempics@1368115642:environment:dev`.
The immutable owner/repository IDs come from GitHub's OIDC configuration:
`gh api repos/george-pov/tempics/actions/oidc/customization/sub`.
Match this prefix when configuring federation; name-only subjects do not match
this repository.
The Environment branch policy and
workflow ref check separately restrict execution to `main`.

```powershell
$subscriptionId = Read-Host 'Target Azure subscription ID'
$resourceGroup = 'rg-tempics-dev'
$deploymentName = 'tempics-github-dev'

az account show --subscription $subscriptionId --query '{id:id,tenantId:tenantId,name:name}' -o json
if ($LASTEXITCODE -ne 0) { throw 'Check the selected subscription.' }
az bicep build --file bicep/github.bicep --stdout | Out-Null
if ($LASTEXITCODE -ne 0) { throw 'Bicep compilation failed.' }
az bicep build-params --file bicep/github-dev.bicepparam --stdout | Out-Null
if ($LASTEXITCODE -ne 0) { throw 'Parameter compilation failed.' }
az deployment group validate --subscription $subscriptionId --resource-group $resourceGroup --name $deploymentName --template-file bicep/github.bicep --parameters bicep/github-dev.bicepparam --output none
if ($LASTEXITCODE -ne 0) { throw 'Access validation failed.' }
az deployment group what-if --subscription $subscriptionId --resource-group $resourceGroup --name $deploymentName --template-file bicep/github.bicep --parameters bicep/github-dev.bicepparam --result-format ResourceIdOnly
if ($LASTEXITCODE -ne 0) { throw 'Access preview failed.' }
```

Review only the identity, federation, Function grant, and UI container grant.
The UI grant does not include account-wide Reader. What-If may report the
role assignment as unsupported until the new identity's principal ID exists.
Review its compiled scope and deterministic name, then verify the actual grant
after Apply. Stop if any existing resource would be changed unexpectedly.

## 2. Apply Reviewed Access

After authorization for that exact scope:

```powershell
az deployment group create --subscription $subscriptionId --resource-group $resourceGroup --name $deploymentName --template-file bicep/github.bicep --parameters bicep/github-dev.bicepparam --query properties.outputs -o json
if ($LASTEXITCODE -ne 0) { throw 'Access deployment failed.' }
az identity show --subscription $subscriptionId -g $resourceGroup -n id-tempics-gh-dev --query '{id:id,clientId:clientId,principalId:principalId,tenantId:tenantId}' -o json
if ($LASTEXITCODE -ne 0) { throw 'Identity readback failed.' }
az identity federated-credential show --subscription $subscriptionId -g $resourceGroup --identity-name id-tempics-gh-dev -n github-dev --query '{id:id,issuer:issuer,subject:subject,audiences:audiences}' -o json
if ($LASTEXITCODE -ne 0) { throw 'Federation readback failed.' }
$functionId = "/subscriptions/$subscriptionId/resourceGroups/$resourceGroup/providers/Microsoft.Web/sites/func-tempics-api-dev"
az role assignment list --subscription $subscriptionId --scope $functionId --query '[].{id:id,principalId:principalId,role:roleDefinitionName,scope:scope}' -o json
if ($LASTEXITCODE -ne 0) { throw 'Role readback failed.' }
```

Match the grant's principal ID to the deployment identity and its scope exactly
to the Function. Runtime-principal grants are separate. Propagation failures
require readback and bounded waiting, not broader roles or weaker trust.

## 3. Configure The GitHub Environment

Configure the target Environment directly in GitHub when its Azure resources
are ready. Restrict its
deployment branches to `main` and set these Environment variables from the
Azure resources:

| Variable | Source (dev example) |
| --- | --- |
| `AZURE_CLIENT_ID` | `id-tempics-gh-dev` client ID |
| `AZURE_TENANT_ID` | Identity tenant, matching selected subscription |
| `AZURE_SUBSCRIPTION_ID` | Explicit operator input |
| `AZURE_FUNCTION_APP` | `func-tempics-api-dev` |
| `UI_APP_CONFIG_JSON` | Complete public runtime JSON, shown below |
| `AZURE_UI_STORAGE` | `sttempicsuidev` |

Set `UI_APP_CONFIG_JSON` to the base configuration for the target environment:

```json
{
  "environment": "dev",
  "apiBaseUrl": "https://func-tempics-api-dev.azurewebsites.net/api"
}
```

The workflows require these six variables. Previously configured
`AZURE_RESOURCE_GROUP`, `TP_ENV`, `TP_API_URL`, and `TP_UI_URL` variables are no
longer consumed by the workflows.

UI deployment also requires Environment secret `AZURE_FUNCTION_KEY`, containing
the existing sample Function key. Deployment adds it as `functionKey` to the
public `config.json`; site visitors can read and reuse that key. Keep the value
out of source and logs. The empty prod Environment needs its own settings and
key before deployment.

## 4. Deploy

Pushing to `main` automatically deploys both applications to `dev`.
To dispatch either application manually:

```powershell
gh workflow run deploy-api.yml --repo george-pov/tempics --ref main -f environment=dev
gh workflow run deploy-ui.yml --repo george-pov/tempics --ref main -f environment=dev
```

Select `prod` instead when production is configured. Both environments use the
same build and deployment steps. Run only the workflow for the application you
intend to deploy. Follow its result in GitHub Actions. Each application and
environment has its own concurrency group;
in-progress deployments are not cancelled by later dispatches.

The API uses .NET 10 and `dotnet publish` for Linux x64. The Functions action
packages the published directory and deploys it with remote build disabled.
It does not run solution tests or call the protected sample endpoint.

The UI uses Node 24 and npm 12 with `npm ci` and the production build. The
workflow parses `UI_APP_CONFIG_JSON`, adds `functionKey` from
`AZURE_FUNCTION_KEY`, and writes `config.json` with inline Node code.
It also copies the standalone `404.html` error page.
Azure CLI uploads the directory to `$web` with Azure login, overwrite enabled,
and `Cache-Control: no-store`; it infers asset MIME types from their extensions.
Two explicit HTML uploads publish the same entry page at `component-lab` and
`component-lab/index.html`. See the [Storage hosting contract](ui-storage.md).

Only the UI configuration step receives `AZURE_FUNCTION_KEY`; build and API
deployment do not use it. The frontend sends it as `x-functions-key` on sample
render requests. Manual API CORS must allow the UI origin and that header.
User authentication remains a separate responsibility.
The browser's runtime config validator still enforces the public JSON contract
at startup; deployment parses JSON for injection without running contract tests.

## Recovery

Workflows build and deploy in the same job and do not retain deployment artifacts
or manifests. Fix a failed build/upload and dispatch again. To restore an older
application version, publish that source to `main` through the normal authorized
Git process and dispatch the corresponding workflow.

Storage uploads are not atomic. A failed command leaves already uploaded files
in place, and uploads do not delete old assets. A rerun overwrites the same entry
pages and config. Infrastructure and API/UI publication remain independent.

Application publication is defined directly in the two workflow files.

## References

- [Azure Functions action](https://github.com/Azure/functions-action)
- [Azure Storage blob upload commands](https://learn.microsoft.com/en-us/cli/azure/storage/blob)
- [GitHub OIDC with Azure](https://docs.github.com/en/actions/how-tos/secure-your-work/security-harden-deployments/oidc-in-azure)
