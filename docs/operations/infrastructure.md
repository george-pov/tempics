# Development Infrastructure

Run from the repository root with PowerShell 7 and Azure CLI/Bicep.
The operator needs resource deployment and role-assignment permissions.
Use the intended Azure login/subscription and completed [Entra setup](entra-setup.md).

## Source Of Truth

- [dev.bicepparam](../../bicep/dev.bicepparam): development names and capacity.
- [main.bicep](../../bicep/main.bicep) and [resources.bicep](../../bicep/resources.bicep):
  resource group, Function, host/package storage, UI storage, dedicated template
  account and `Templates` table, and monitoring.
- [storage-access.bicep](../../bicep/storage-access.bicep): runtime grants,
  including Table Data Contributor on the template account for the Function identity.
- [ui-storage.bicep](../../bicep/ui-storage.bicep): static website settings.

These definitions support dev only. They own the Function app-settings collection,
including auth settings and `TemplateStore__TableServiceUri` from the dedicated
account's Table endpoint. Shared Key is disabled. Bicep provisions the
`Templates` table and leaves `TemplateStore__CreateResourcesIfMissing` unset
(default `false`); keep that switch off when hosted. Publication, manual CORS,
GitHub access, operator grants, and undeclared alerts are separate. Recreating
infrastructure does not restore application packages, UI files, template rows,
or those manual settings. Decide template retention, backup, and recovery before
production use.

## Preview And Apply

Use the ignored API settings configured for this deployment environment
([settings reference](../api/authentication.md#configuration)); the API need not run.

```powershell
$subscriptionId = Read-Host 'Target Azure subscription ID'
$location = 'westus2'
$deploymentName = 'tempics-dev'
$apiSettings = (Get-Content src/api/TP.AzureFunctions/local.settings.json -Raw | ConvertFrom-Json).Values
$env:TP_API_AUTH_JSON = @{
    instance = $apiSettings.Auth__Instance
    tenantId = $apiSettings.Auth__TenantId
    clientId = $apiSettings.Auth__ClientId
    issuer = $apiSettings.Auth__Issuer
} | ConvertTo-Json -Compress

az account show --subscription $subscriptionId --query '{name:name,id:id}' -o json
az deployment sub validate --subscription $subscriptionId --location $location --name $deploymentName --template-file bicep/main.bicep --parameters bicep/dev.bicepparam --output none
az deployment sub what-if --subscription $subscriptionId --location $location --name $deploymentName --template-file bicep/main.bicep --parameters bicep/dev.bicepparam --result-format ResourceIdOnly
```

Run commands one at a time and stop on errors. Confirm the subscription and
review the exact changes before applying. New-identity role assignments may not
expand in What-If; inspect their template scopes and verify grants after creation.

```powershell
az deployment sub create --subscription $subscriptionId --location $location --name $deploymentName --template-file bicep/main.bicep --parameters bicep/dev.bicepparam --query properties.provisioningState -o tsv
az deployment sub show --subscription $subscriptionId --name $deploymentName --query properties.outputs -o json
```

Check deployment success, all three storage accounts, the `Templates` table,
runtime grants, the template URI setting, and website settings.
Read actual addresses from outputs; keep them outside tracked docs. An empty
website returning 404 is expected before publication. Continue with
[GitHub setup](github-setup.md) and [deployment](deployment.md).

## Recovery

Correct failed inputs/templates and rerun the preview. Incremental deployment
does not undo partial creation or roll back code. Verify the template account,
table, URI setting, and identity grant before retrying a storage authorization
failure; do not enable Shared Key as a workaround. Recover deleted template data
from a separately established backup, not by redeploying Bicep.
