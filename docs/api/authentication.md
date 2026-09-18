# API Authentication

Every HTTP Function requires an Entra v2 access token in
`Authorization: Bearer <access-token>` with the delegated `Images.Render` scope.
The API uses `Microsoft.Identity.Web` and one Functions worker middleware to
authenticate and authorize before invoking the endpoint. The library validates
signatures, issuer, audience, and token lifetime, and manages discovery and
signing-key rotation.
The validated token must also carry this tenant's `tid`, a user object ID (`oid`),
and token version `2.0`.

`AuthorizationLevel.Anonymous` disables the Functions shared-key gate so the
worker can enforce bearer authentication. It does not make the endpoint public.
Missing, malformed, expired, or invalid tokens return 401 with a plain `Bearer`
challenge. Valid tokens without the exact scope return 403. App-only roles do
not substitute for the delegated scope. Function keys alone grant no access.
The PNG request and response remain unchanged.

The validated principal is available as `HttpContext.User`; use tenant and object
ID claims (`tid` and `oid`) when adding per-user storage. The bundled sample has
no user-owned data. Future template and asset operations must enforce ownership
in their application handlers as well as authentication at this boundary.
The current scope applies to all HTTP Functions. Review that policy when adding
capabilities beyond rendering. There is no local authentication bypass.

## Entra Registration

Use `Tempics API - Dev` in the same External ID tenant as `Tempics SPA - Dev`.
The API registration is single tenant, requests v2 access tokens, and exposes
the delegated `Images.Render` scope. The SPA requests that scope and needs its
delegated permission and administrator consent. The API needs no client secret,
redirect URI, Graph permission, or downstream token cache.

Reuse existing registrations and verify their scope and consent before creating
new ones. Keep real IDs, authority URLs, and deployment addresses in environment
configuration. The API's client ID is different from the SPA client ID and the
GitHub deployment identity. For v2 tokens the audience is the API client ID GUID,
while the SPA requests the full exposed scope URI.

## Configuration

Supply these values in the ignored API `local.settings.json` under `Values`, or
as Function App settings in Azure:

| Setting | Value |
| --- | --- |
| `Auth__Instance` | External tenant authority host, including `https://` and a trailing slash. |
| `Auth__TenantId` | External tenant GUID. |
| `Auth__ClientId` | API application client ID GUID. |
| `Auth__Issuer` | Exact `issuer` from the tenant's v2 OpenID discovery document. |

External ID may use a tenant-name host for discovery and a tenant-GUID host in
the issuer. Read the issuer from discovery; do not derive it from the UI host.
Required settings are validated at startup. No secret or access token belongs
in tracked configuration, logs, or documentation.

Bicep carries these four public settings in its `auth` parameter. The dev
parameter file reads JSON from `TP_API_AUTH_JSON`, with `instance`, `tenantId`,
`clientId`, and `issuer` fields. Set this environment variable before compiling,
previewing, or applying that parameter file. See the
[Azure deployment guide](../operations/azure-dev.md).

## Deploy And Verify

1. Configure the four API settings before deploying the protected API. Preserve
   existing Function settings when adding them.
2. Deploy the API and check unauthenticated and invalid-token requests return
   401; a real access token with `Images.Render` must return a PNG.
3. Deploy the UI with its existing bearer interceptor and public auth settings.
   The UI workflow removes legacy `functionKey` before publishing configuration.
   It no longer needs `AZURE_FUNCTION_KEY`.
4. Allow the exact UI origin through API CORS, including the `Authorization`
   header. Preflight is handled by the Functions host.

Deploy the API first: the old UI already sends bearer tokens and can call the
new API even if it also sends an obsolete key. The new UI cannot call an older
API that still requires that key. Recovery should retain bearer protection;
avoid rolling back the API to the shared-key implementation. Keep a compatible
API/UI/configuration set available before releasing further changes.

Signed fixture-token tests exercise production auth registration and middleware
without Entra network calls. These tests do not prove hosted sign-in, consent,
CORS, or deployment. Verify those separately with the intended environment.

## References

- [Microsoft.Identity.Web API setup](https://learn.microsoft.com/en-us/entra/msidweb/getting-started/quickstart-webapi)
- [Scope validation](https://learn.microsoft.com/en-us/entra/identity-platform/scenario-protected-web-api-verification-scope-app-roles)
- [Functions worker middleware](https://learn.microsoft.com/en-us/azure/azure-functions/dotnet-isolated-process-guide#middleware)
