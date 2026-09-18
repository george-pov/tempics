# UI Runtime Configuration

Tempics loads `config.json` relative to the document's base URL before Angular
starts. The file supplies public deployment settings through the immutable
`CONFIG` injection token. Every route, including Component Lab, requires valid
startup configuration.

## Contract

```json
{
  "environment": "local",
  "apiBaseUrl": "http://localhost:7159/api",
  "auth": {
    "clientId": "11111111-1111-1111-1111-111111111111",
    "authority": "https://tenant.example.test/tenant-id/v2.0",
    "redirectUri": "http://localhost:4200/",
    "postLogoutRedirectUri": "http://localhost:4200/",
    "apiScopes": ["api://example-api/Images.Render"]
  }
}
```

`environment`, `apiBaseUrl`, and `auth` are required. Other fields, including the
obsolete `functionKey`, are rejected.
`environment` is exactly `local`, `dev`, or
`prod`. `apiBaseUrl` is an absolute HTTPS URL including the API prefix. Local
configuration also permits HTTP on `localhost`, `127.0.0.1`, or `[::1]`.
Hosted environments reject loopback addresses, including equivalent canonical
spellings. The environment label never changes server authorization.

Validation rejects missing/unknown fields, blank values, relative URLs,
whitespace, backslashes, credentials, query strings, fragments, and unsupported
schemes. Trailing slashes are removed while preserving the API path prefix.
`ImageRenderApi` appends `/renders/sample` and sends an empty POST for a PNG
Blob. The bearer interceptor adds `Authorization: Bearer <access-token>` after acquiring the
configured API scope for the signed-in account. Cookie credentials stay disabled.

All five `auth` fields are required. `clientId` is the SPA application ID GUID.
`authority` is the external tenant's HTTPS authority; its hostname supplies MSAL's
known authority. `apiScopes` contains the exposed Tempics API scope, not a Graph
scope or an ID token request. Redirect and post-logout URLs must both be the
application's root URL, with the same origin as the running UI. Local HTTP is
allowed only on the three loopback hosts above. Use the actual registered SPA
redirect URL. The values in the example are fixtures and cannot sign in.

The browser uses `config.schema.json` and
`validateConfig` under `src/ui/src/app/shared/config/`. The schema validator is
`@cfworker/json-schema` 4.1.1. It interprets the schema without generated source
or runtime eval. See the [validator documentation](https://github.com/cfworker/cfworker/blob/main/packages/json-schema/README.md).

## Local Setup

From `src/ui/`, create the local file only if it does not already exist:

```powershell
if (-not (Test-Path public/config.json)) {
  Copy-Item config.example.json public/config.json
}
```

Edit `public/config.json` for your local API address and Entra registration.
It and its temporary siblings are ignored by Git. The example is tracked outside public assets and
is never used as a fallback. See [build and test](build-and-test.md) for startup
commands.

The browser calls the API directly. There is no Angular API proxy. Core Tools
must allow the UI's exact origin; for the default UI it is
`http://localhost:4200`. A different UI port needs its own exact origin in the
Core Tools invocation. Do not use a wildcard or credentialed CORS for this flow.
CORS controls browser access; it does not authenticate callers.

## Startup And Recovery

The loader uses native fetch with `cache: 'no-store'`, rejects redirects, and
aborts after ten seconds. It requires a successful HTTP status and
`application/json` content type, then parses and validates the response.
HTML from a single-page-app fallback is an error.

While loading, the page exposes an accessible status. Missing, malformed,
invalid, or timed-out settings prevent Angular startup and API requests. Startup
failure displays "Unable to start the app. Reload to try again." with a native
Reload button. Fix the JSON or host response and reload; raw settings and errors
are not displayed. Settings are loaded once per page load.

## Build Once And Package

Production builds exclude `config.json` and `config.json.*` even when local
settings exist. Both hosted dev and prod use the optimized production build.

Store `environment`, `apiBaseUrl`, and the complete `auth` object as JSON in
GitHub Environment variable `UI_APP_CONFIG_JSON`. The workflow parses it with
inline Node code, removes any obsolete `functionKey`, and writes `config.json`
after the build. No Function key or client secret is required.

For a local copy of the production build, from `src/ui/`:

```powershell
npm ci
npm run build
Copy-Item public/config.json dist/tempics/browser/config.json
```

This copy uses the local settings. For hosting, supply the intended environment,
public API URL, and registered HTTPS home URL instead. No generator or packaging
script is required. The browser validates the JSON at startup using the contract above.

To prepare multiple environments from one build, copy the configuration-free
output and add the appropriate `config.json` to each copy. JavaScript, CSS,
HTML, and fonts stay unchanged. Changing JSON and reloading selects the new
address without recompilation.

## Entra Registration

Use an external tenant with an email/password sign-up and sign-in user flow.
The flow collects email and optional display name. Register `Tempics SPA - Dev`
as a single-tenant SPA with root redirect URLs for local development and the
intended dev UI origins. Use authorization code flow with PKCE; no client secret
or implicit grant is needed. Link the SPA to the user flow. When assignment is
required on the enterprise application, assign each permitted user there.

Register `Tempics API - Dev` in the same tenant to define the token audience,
request v2 access tokens, and expose the delegated `Images.Render` scope.
Grant that scope to the SPA with administrator consent. This API registration
allows Entra to issue a Tempics access token. Configure the API's matching
[bearer validation settings](../../api/authentication.md) separately.
The frontend needs no Microsoft Graph permission.

Keep real tenant IDs, application IDs, authority URLs, and deployment addresses
in environment configuration. See Microsoft's guidance for
[app registration](https://learn.microsoft.com/en-us/entra/identity-platform/quickstart-register-app)
and [linking a user flow](https://learn.microsoft.com/en-us/graph/api/authenticationconditionsapplications-post-includeapplications?view=graph-rest-1.0).

## Hosting And API Boundary

Browser configuration is public. Do not add secrets,
access tokens, connection strings, or deployment credentials to the file.

The [GitHub UI workflow](../../operations/github-dev.md#4-deploy) writes the selected
Environment's `UI_APP_CONFIG_JSON` to `config.json` after the build, then
uploads that directory. It relies on Azure upload success without running tests
or hosted checks. The workflow parses JSON for publication; contract validation
happens in the browser at startup.
A valid URL can still target the wrong environment.

Hosting must serve configuration as JSON with `Cache-Control: no-store`, avoid
SPA fallback and redirects for missing config, and deliver a compatible
application/config pair. Test these rules on the chosen host. Configure hosted
API CORS to allow the UI origin and `Authorization`.
Deploy the bearer-protected API with its matching Entra settings before this UI;
the UI no longer sends a Function key. Local configuration must also omit
`functionKey`. Future user-owned resources still need API ownership checks.
Preserve compatible application/configuration pairs for recovery.
