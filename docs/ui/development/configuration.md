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

These are the only accepted fields. `environment` is exactly `local`, `dev`, or
`prod`. `apiBaseUrl` is an absolute HTTPS URL including the API prefix. Local
configuration also permits HTTP on `localhost`, `127.0.0.1`, or `[::1]`.
Hosted environments reject loopback addresses, including equivalent canonical
spellings. The environment label never changes server authorization.

Validation rejects missing/unknown fields, blank values, relative URLs,
whitespace, backslashes, credentials, query strings, fragments, and unsupported
schemes. Trailing slashes are removed while preserving the API path prefix.
`SampleRenderApi` appends `/renders/sample` and sends an empty POST for a PNG
Blob without Function keys, Authorization headers, or credentialed requests.

The browser and packaging script share `config.schema.json` and
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

Use Node satisfying the Angular toolchain engines:
`^22.22.3 || ^24.15.0 || >=26.0.0`. Node's native
[TypeScript stripping](https://nodejs.org/api/typescript.html) lets the packaging
script import the authored validator; Angular compilation still checks types.
The UI package declares ES module format for this shared tooling.

From `src/ui/`:

```powershell
npm ci
npm run build
$env:TP_ENV = 'dev'
$env:TP_API_URL = 'https://dev.example.test/api'
npm run config:write -- --out dist/tempics/browser
```

The example URL is a reserved fixture. Set the process variables to the intended
public endpoint when preparing a real package. `TP_ENV` and `TP_API_URL` are
required; there is no inferred/default environment. Packaging accepts only
`dev` or `prod` and serializes only `environment` and `apiBaseUrl`.

The output must be an existing directory below `src/ui/dist` containing a regular
`index.html`. Source/public paths and symbolic-link escapes are rejected. The
script validates first, writes an exclusively created temporary sibling, and
renames it to `config.json`. Invalid inputs and failed writes preserve an
existing config. Error messages identify fields or safe failure categories
without printing values.

Production builds exclude `config.json` and `config.json.*` even when a local
file exists. Development assets include the local JSON but exclude temporary
siblings. Build modes do not select deployment environments: both hosted dev
and prod use the optimized production build.

Keep the original build configuration-free. Copy its output to separate
directories under `dist`, then package each with explicit dev/prod variables.
Packaging performs no install, build, bundle edits, or TypeScript generation.
All JavaScript, CSS, HTML, fonts, and other static assets stay identical.
Changing JSON and reloading selects the new address without recompilation.

A separate packaging runner must check out source matching the compiled
artifact and install the locked tooling dependencies before invoking the
script. Carry the source revision and lockfile with the artifact provenance.

## Hosting And Authentication Follow-Up

Browser configuration is public. Never include client secrets, Function keys,
access tokens, connection strings, or deployment credentials.

A future deployment workflow should map the chosen GitHub Environment's values
to `TP_ENV` and `TP_API_URL` as process variables, not executable script text.
Require explicit dev/prod selection and verify the expected API host and UI
origin. A valid URL can still target the wrong environment.

Hosting must serve configuration as JSON with `Cache-Control: no-store`, avoid
SPA fallback and redirects for missing config, and deliver a compatible
application/config pair. Test these rules on the chosen host. Configure hosted
API CORS and authentication separately; local CORS or mocked browser routing
does not prove hosted access. Preserve compatible pairs for rollback.

Add `auth.clientId`, `auth.authority`, `auth.redirectUri`,
`auth.postLogoutRedirectUri`, and `auth.apiScopes` only with their first Entra/MSAL
consumers. Extend the schema, runtime type, generator, providers, and tests
together. The current settings do not implement authentication.
