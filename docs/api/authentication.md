# API Authentication

All HTTP Functions require an Entra v2 API access token with delegated
`Images.Render` scope, including the saved-template routes. This applies locally
and in Azure.

Microsoft.Identity.Web validates signature, issuer, audience, and lifetime.
The worker additionally checks tenant, v2 token version, a nonempty GUID user
object ID, and the exact delegated scope. App-only roles do not substitute.

`AuthorizationLevel.Anonymous` disables the Functions key gate; worker
middleware still enforces bearer authentication. Function keys grant no access.
See [responses](endpoints.md#responses) and [auth source](../../src/api/TP.AzureFunctions/Auth/).

## Configuration

Set these under Values in ignored API `local.settings.json`, or as Function
App settings:

| Setting | Value |
| --- | --- |
| `Auth__Instance` | External authority host, HTTPS with trailing slash. |
| `Auth__TenantId` | External tenant GUID. |
| `Auth__ClientId` | API client ID GUID, not the SPA or deployment identity. |
| `Auth__Issuer` | Exact issuer from v2 OpenID discovery. |
| `TemplateStore__TableServiceUri` | Hosted table service URI of the dedicated template account; Azure requires HTTPS. |
| `TemplateStore__ConnectionString` | Local Azurite shortcut: `UseDevelopmentStorage=true`. Use this instead of the table service URI for local template storage. |
| `TemplateStore__CreateResourcesIfMissing` | Set to `true` with local Azurite storage to create the `Templates` table at API startup. |

Auth settings are validated at startup. Hosted startup requires the table
service URI and uses managed identity. The connection string and resource
creation switch are for local Azurite only. Without local template storage
configuration, the sample route can start but template requests return a safe
unavailable response.

Read the issuer from discovery; its host can differ from
the UI authority. The v2 audience is the API client ID; the SPA requests the
full exposed scope URI.

Use [Entra setup](../operations/entra-setup.md) to obtain values and
[local setup](../getting-started.md) or [infrastructure](../operations/infrastructure.md)
to supply them. Keep real IDs, hosted URLs, and tokens out of tracked examples.

Fixture tests do not prove hosted sign-in, consent, or CORS.
Use [deployment verification](../operations/deployment.md#verify-the-applications).
