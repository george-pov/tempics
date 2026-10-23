# API Endpoints

## Render Sample

`POST /api/renders/sample` with
`Authorization: Bearer <access-token>` and delegated `Images.Render` scope.

Send no application payload. Only the bundled template is rendered; request
content does not select AXAML, assets, paths, or parameters. Nothing is persisted.

## Responses

| Status | Contract |
| --- | --- |
| 200 | Raw image/png, 1200 x 630 pixels, Cache-Control: no-store; no attachment filename. |
| 401 | Missing/invalid token; WWW-Authenticate: Bearer; middleware writes no error body. |
| 403 | Valid token without the exact scope; middleware writes no error body. |
| 500 | application/problem+json with status 500, title "Image rendering failed", code "render_failed", and a request correlationId. |

Empty output or encoded PNGs above 5 MiB fail. Internal exceptions, paths, and
input content are not returned. Cancellation propagates without a dedicated
application-defined HTTP status.

The browser calls the configured API directly. CORS must allow its exact origin
and Authorization header; the Functions host handles preflight. Function keys
alone grant no access.

See [authentication](authentication.md), [local setup](../getting-started.md),
and [hosted verification](../operations/manual-api-deployment.md#verify-the-hosted-function).
