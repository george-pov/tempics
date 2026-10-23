# GitHub Deployment Setup

This configures publishing access, not application sign-in or publication.
Prerequisites: [infrastructure](infrastructure.md), PowerShell 7, Azure CLI/Bicep,
GitHub administration access, and permission to create Azure role assignments.

## Preview And Apply Access

The source of truth is [github.bicep](../../bicep/github.bicep),
[github-access.bicep](../../bicep/github-access.bicep), and
[github-dev.bicepparam](../../bicep/github-dev.bicepparam).

They create the development managed identity and OIDC federation, Website
Contributor at the Function, and Storage Blob Data Contributor at the UI
`$web` container. They do not grant account-wide storage access.

From the repository root, with the intended Azure/GitHub login sessions:

```powershell
$subscriptionId = Read-Host 'Target Azure subscription ID'
$resourceGroup = 'rg-tempics-dev'
az account show --subscription $subscriptionId --query '{id:id,tenantId:tenantId,name:name}' -o json
gh api repos/george-pov/tempics/actions/oidc/customization/sub
az deployment group what-if --subscription $subscriptionId --resource-group $resourceGroup --template-file bicep/github.bicep --parameters bicep/github-dev.bicepparam --result-format ResourceIdOnly
```

Run commands one at a time and stop on errors. Match the template's federation
subject to the repository's OIDC configuration, including immutable IDs.
Review the identity, federation, and exact grant scopes before applying:

```powershell
az deployment group create --subscription $subscriptionId --resource-group $resourceGroup --template-file bicep/github.bicep --parameters bicep/github-dev.bicepparam --query properties.outputs -o json
```

Verify the federation and both grants against the created identity. Allow time
for role propagation after checking the grant; do not widen roles or trust.

## Configure The Environment

In GitHub Settings > Environments, create/select `dev`, restrict deployment
branches to `main`, and set:

| Variable | Value source |
| --- | --- |
| `AZURE_CLIENT_ID` | Publishing identity client ID. |
| `AZURE_TENANT_ID` | Publishing identity tenant. |
| `AZURE_SUBSCRIPTION_ID` | Selected subscription. |
| `AZURE_FUNCTION_APP` | Target Function name. |
| `AZURE_UI_STORAGE` | Target UI storage account. |
| `UI_APP_CONFIG_JSON` | Complete [public runtime JSON](../ui/development/configuration.md#contract). |

The app-auth tenant can differ from the deployment tenant. No Function-key
secret is consumed. Verify branch restrictions and variable values before
[deployment](deployment.md).

The workflow accepts prod, but these access templates configure dev only.
Each selected environment requires its own matching resources, federation, and
settings. For access failures, correct the specific subject, grant, or setting;
reapplying this template does not change runtime auth or CORS.
