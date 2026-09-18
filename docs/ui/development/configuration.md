# UI Runtime Configuration

Tempics loads `config.json` relative to the document's base URL before Angular
starts. The file supplies public deployment settings through the immutable
`CONFIG` injection token. Every route, including Component Lab, requires valid
startup configuration.

## Contract

```json
{
  "environment": "local",
  "apiBaseUrl": "http://localhost:7159/api"
}
```

`environment` and `apiBaseUrl` are required. An optional `functionKey` supplies
the sample API's `x-functions-key` header. It must be a nonempty string of key
characters (letters, digits, `_`, `+`, `/`, `=`, or `-`). Other fields are rejected.
`environment` is exactly `local`, `dev`, or
`prod`. `apiBaseUrl` is an absolute HTTPS URL including the API prefix. Local
configuration also permits HTTP on `localhost`, `127.0.0.1`, or `[::1]`.
Hosted environments reject loopback addresses, including equivalent canonical
spellings. The environment label never changes server authorization.

Validation rejects missing/unknown fields, blank values, relative URLs,
whitespace, backslashes, credentials, query strings, fragments, and unsupported
schemes. Trailing slashes are removed while preserving the API path prefix.
`ImageRenderApi` appends `/renders/sample` and sends an empty POST for a PNG
Blob. When `functionKey` is present, it sends that value as `x-functions-key`.
When absent, it omits the header, preserving local Core Tools use. It does not
send an Authorization header or enable cookie credentials.

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

Edit `public/config.json` for your local API address. It and its temporary
siblings are ignored by Git. The example is tracked outside public assets and
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

Store `environment` and `apiBaseUrl` as JSON in the GitHub Environment variable
`UI_APP_CONFIG_JSON`. Set the existing sample Function key as Environment secret
`AZURE_FUNCTION_KEY`. The workflow merges it into JSON as `functionKey` using
inline Node code and writes `config.json` after the build. A missing secret fails
that step. The key is passed through the process environment, never a shell
argument or log message.

For a local copy of the production build, from `src/ui/`:

```powershell
npm ci
npm run build
'{"environment":"dev","apiBaseUrl":"https://dev.example.test/api"}' |
  Set-Content -LiteralPath dist/tempics/browser/config.json -Encoding utf8
```

The example URL is a reserved fixture. Use the intended public API URL for a
real deployment. No generator or packaging script is required. The browser
validates the JSON at startup using the contract above.

To prepare multiple environments from one build, copy the configuration-free
output and add the appropriate `config.json` to each copy. JavaScript, CSS,
HTML, and fonts stay unchanged. Changing JSON and reloading selects the new
address without recompilation.

## Hosting And Authentication Follow-Up

Browser configuration is public. The deployment deliberately exposes the
injected Function key to site visitors, who can reuse it outside the UI.
This is shared-key access, not per-user authentication. Do not add other secrets,
access tokens, connection strings, or deployment credentials to the file.

The [GitHub UI workflow](../../operations/github-dev.md#4-deploy) writes the selected
Environment's `UI_APP_CONFIG_JSON` plus its `AZURE_FUNCTION_KEY` secret to
`config.json` after the build, then
uploads that directory. It relies on Azure upload success without running tests
or hosted checks. The workflow parses JSON for injection; contract validation
happens in the browser at startup.
A valid URL can still target the wrong environment.

Hosting must serve configuration as JSON with `Cache-Control: no-store`, avoid
SPA fallback and redirects for missing config, and deliver a compatible
application/config pair. Test these rules on the chosen host. Configure hosted
API CORS to allow the UI origin and the `x-functions-key` request header.
Configure user authentication separately; local CORS or mocked browser routing
does not prove hosted access. Preserve compatible pairs for rollback.

Add `auth.clientId`, `auth.authority`, `auth.redirectUri`,
`auth.postLogoutRedirectUri`, and `auth.apiScopes` only with their first Entra/MSAL
consumers. Extend the schema, runtime type, providers, and tests
together. The current settings do not implement authentication.
