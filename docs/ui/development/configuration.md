# Runtime Configuration

The UI loads `config.json` before Angular starts. Every route needs valid
configuration. Use [config.example.json](../../../src/ui/config.example.json)
as the starting point; it contains fixtures, not working registration values.

## Contract

| Field | Meaning |
| --- | --- |
| `environment` | local, dev, or prod. |
| `apiBaseUrl` | Absolute API URL including its path prefix. |
| `auth.clientId` | SPA application GUID. |
| `auth.authority` | External tenant's HTTPS authority. |
| `auth.redirectUri`, `auth.postLogoutRedirectUri` | Registered root URLs matching the running UI's origin. |
| `auth.apiScopes` | Exposed Tempics API scope URI(s), not Graph scopes. |

All fields are required; unknown fields, including functionKey, are rejected.
API URLs require HTTPS; local permits HTTP on localhost, 127.0.0.1, or [::1].
Hosted API URLs reject loopback addresses. URLs cannot contain credentials,
whitespace, query strings, fragments, or backslashes.

Exact shape and validation belong to
[the schema](../../../src/ui/src/app/shared/config/config.schema.json) and
[validator](../../../src/ui/src/app/shared/config/validate-config.ts).
Settings are frozen and loaded once per page load. They are public: never add
secrets, tokens, connection strings, or deployment credentials.

## Startup And Recovery

The loader uses no-store, rejects redirects, requires a successful JSON response,
and aborts after ten seconds. Missing/invalid settings prevent Angular startup
and API requests. Fix the file/host response and use Reload; raw errors are hidden.

Development serves ignored `public/config.json`. Production builds exclude it;
[deployment](../../operations/deployment.md) supplies the environment JSON.
A valid URL can still point to the wrong environment.

See [local setup](../../getting-started.md), [Entra setup](../../operations/entra-setup.md),
and [hosting requirements](../../operations/ui-storage.md).
