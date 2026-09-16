# GitHub Development API Deployment

The [API workflow](../../.github/workflows/deploy-api.yml) builds and tests a
Linux Function ZIP, then deploys it to `func-tempics-api-dev` using Azure OIDC.
Dispatch is manual, from `main`, into GitHub Environment `dev`. Infrastructure
provisioning remains manual. The UI continues to use the
[manual Storage publication procedure](ui-storage.md).

The [verified API run](https://github.com/george-pov/tempics/actions/runs/35044156602)
passed on 2026-09-16 UTC at source revision
`c90e41283f4d05899290c6d2dd158da5b07843c6`. Linux tests, OIDC login, scoped
deployment, anonymous rejection, and the protected 1200 x 630 PNG check passed.
The returned PNG was 222,958 bytes. Both build and deploy jobs succeeded.

## Prerequisites

- Existing Linux Flex Consumption .NET 10 Function infrastructure in
  `rg-tempics-dev`, region `westus2`; see [manual Azure setup](azure-dev.md).
- PowerShell 7.2+, Azure CLI with Bicep, and GitHub CLI. Use existing `az login`
  and `gh auth login` sessions. Setup scripts do not authenticate for you.
- An explicitly selected subscription and its matching identity tenant.
- Operator permission to deploy the access template and create its role
  assignment, plus GitHub permission to administer the repository Environment,
  variables, and secrets. These are operator permissions, not runner grants.
- Separate authorization for infrastructure Apply, GitHub configuration,
  Function-key retrieval/transfer, Git publication, and application deployment.
- Reviewed workflow and scripts on `george-pov/tempics` branch `main` before
  dispatch. No application source changes are required by this procedure.

## 1. Preview Deployment Access

Run from the repository root. The dedicated resource-group template creates
`id-tempics-gh-dev`, federation `github-dev`, and Website Contributor
(`de139f84-1756-47ae-9be6-808fbbe84772`) scoped to the dev Function only.
It does not change runtime identities, storage roles, app settings, or CORS.

Federation accepts issuer `https://token.actions.githubusercontent.com`, audience
`api://AzureADTokenExchange`, and subject
`repo:george-pov@287842525/tempics@1368115642:environment:dev`.
The immutable owner/repository IDs come from GitHub's OIDC configuration:
`gh api repos/george-pov/tempics/actions/oidc/customization/sub`.
Setup verifies this prefix; name-only subjects do not match this repository.
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

Review only the identity, federation, and Function grant. What-If may report the
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

After the identity exists, preview the proposed public settings:

```powershell
./deployment/Set-DevConfig.ps1 -SubscriptionId $subscriptionId -InspectOnly
```

After GitHub setup authorization, run without `-InspectOnly`:

```powershell
./deployment/Set-DevConfig.ps1 -SubscriptionId $subscriptionId
```

The script verifies the subscription, tenant, resource IDs, Function runtime,
hostname, repository, and default branch before writes. It creates `dev` with a
custom branch-only `main` policy if absent. A compatible existing Environment
keeps its reviewers, timers, custom protection, and other settings. Incompatible
policies stop setup for review; the script never removes existing rules.

Only these seven Environment variables are written and read back:

| Variable | Verified source |
| --- | --- |
| `AZURE_CLIENT_ID` | `id-tempics-gh-dev` client ID |
| `AZURE_TENANT_ID` | Identity tenant, matching selected subscription |
| `AZURE_SUBSCRIPTION_ID` | Explicit operator input |
| `AZURE_RESOURCE_GROUP` | `rg-tempics-dev` |
| `AZURE_FUNCTION_APP` | `func-tempics-api-dev` |
| `TP_ENV` | `dev` |
| `TP_API_URL` | Function HTTPS default hostname plus `/api` |

Setup is not transactional. After partial failure, inspect the existing state
and rerun corrected setup. Unrelated variables and secrets are preserved.

## 4. Transfer The Existing Function Key

Select an existing `RenderSample` function-scoped key by name through your
approved credential process. Obtain separate approval to retrieve and transfer
that key. Do not use a host/master key, create a key, or rotate one implicitly.

```powershell
$keyName = Read-Host 'Existing RenderSample key name (not its value)'
./deployment/Set-DevKey.ps1 -SubscriptionId $subscriptionId -KeyName $keyName
```

The script revalidates the target and protected Environment. It captures only
the selected scoped key into process memory and sends it to GitHub CLI stdin as
Environment secret `AZURE_FUNCTION_KEY`. It does not use a secret command-line
argument, transcript, temporary file, or raw native error output. Output contains
only the secret name and update timestamp; the hosted check proves usability.
Run outside shell transcripts/debug tracing. Operators own credential expiry,
revocation, and explicit rotation, including updating GitHub after a rotation.

The key is used only by workflow preflight and API verification. It never enters
the build, Function ZIP, manifest, deployment action, UI, or public runtime JSON.
The browser still makes unauthenticated requests; application sign-in remains
a separate capability. GitHub OIDC authenticates deployment only.

## 5. Dispatch And Verify

After Git publication and exact Function deployment authorization:

```powershell
gh workflow run deploy-api.yml --repo george-pov/tempics --ref main
if ($LASTEXITCODE -ne 0) { throw 'Workflow dispatch failed.' }
gh run list --repo george-pov/tempics --workflow deploy-api.yml --limit 5
```

Record the exact run URL and source SHA. Both jobs check out that SHA. The build
job has read-only repository access and no Environment or OIDC permission. It
runs solution restore/build/test and checker/setup tests, publishes `linux-x64`
with RID-specific restore, and checks the complete ZIP including hidden metadata,
native libraries, and protected `RenderSample`. Local settings are forbidden.

The artifact `api-<commit>-<run-id>-<attempt>` holds only `function.zip` and a
manifest with source SHA, run ID/attempt, and ZIP SHA-256. Deploy downloads only
that run's artifact, validates it, logs in with OIDC, and confirms the actual
Linux Flex .NET 10 target and URL before publishing with remote build disabled.
Deploy jobs serialize under `tempics-api-dev` through verification.

The hosted checker requires anonymous POST to return 401/403, then a keyed POST
to return 200 and `image/png` with a valid PNG signature/IHDR and 1200 x 630
dimensions. It rejects redirects and responses over 5 MiB, limits requests to
60 seconds, and permits at most three attempts per request only for transport,
429, and 5xx failures. Retry waits respect the 390-second overall deadline.
The summary reports upload and verification separately. A failed verification
fails the job and does not automatically roll back the deployed code.

## Recovery And Local Checks

Artifacts expire after 14 days. Preserve a known-good ZIP and its matching
manifest safely before expiry. After explicit authorization, recover by
redeploying that ZIP to the same Function using the
[manual publish command](azure-dev.md#4-publish-the-package), with remote build
disabled. Compare its SHA-256 with the retained manifest before use. Retrying a
workflow rebuilds the selected source; it is not a substitute for selecting a
known-good retained package. UI files and infrastructure are separate.

Local checks require no real key or live writes:

```powershell
node --test deployment/check-api.test.mjs
./deployment/test-setup.ps1
actionlint .github/workflows/deploy-api.yml
dotnet restore src/api/Tempics.slnx
dotnet build src/api/Tempics.slnx -c Release --no-restore
dotnet test --solution src/api/Tempics.slnx -c Release --no-build
```

`Package-Api.ps1` owns ZIP checks and manifest generation/readback;
`Check-ApiTarget.ps1` owns workflow input and filtered ARM validation. Neither
retrieves credentials. For repeatable local packaging, supply fresh publish and
artifact directories, a source SHA, and local numeric run identifiers. Local
checks do not prove hosted OIDC/RBAC or Linux rendering on the GitHub runner.

## References

- [Functions action and Flex deployment inputs](https://github.com/Azure/functions-action)
- [GitHub Environment branch policies](https://docs.github.com/en/rest/deployments/branch-policies)
- [GitHub OIDC with Azure](https://docs.github.com/en/actions/how-tos/secure-your-work/security-harden-deployments/oidc-in-azure)
- [Immutable OIDC subject reference](https://docs.github.com/en/actions/reference/security/oidc#immutable-subject-claims)
