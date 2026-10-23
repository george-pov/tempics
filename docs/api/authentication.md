# API Authentication

All HTTP Functions require an Entra v2 API access token with delegated
`Images.Render` scope. This applies locally and in Azure.

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

Settings are validated at startup. Read the issuer from discovery; its host can
differ from the UI authority. The v2 audience is the API client ID; the SPA
requests the full exposed scope URI.

Use [Entra setup](../operations/entra-setup.md) to obtain values and
[local setup](../getting-started.md) or [infrastructure](../operations/infrastructure.md)
to supply them. Keep real IDs, hosted URLs, and tokens out of tracked examples.

Fixture tests do not prove hosted sign-in, consent, or CORS.
Use [deployment verification](../operations/deployment.md#verify-the-applications).
