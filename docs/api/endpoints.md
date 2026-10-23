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
| 401 | Missing/invalid token; WWW-Authenticate: Bearer; no-store; middleware writes no error body. |
| 403 | Valid token without the exact scope; no-store; middleware writes no error body. |
| 500 | application/problem+json with status 500, title "Image rendering failed", code "render_failed", and a request correlationId. |

Empty output or encoded PNGs above 5 MiB fail. Internal exceptions, paths, and
input content are not returned. Cancellation propagates without a dedicated
application-defined HTTP status.

Shared API exception middleware maps render failures to the safe 500 problem
above. Bearer authentication still produces the bodyless 401/403 responses.

The browser calls the configured API directly. CORS must allow its exact origin
and Authorization header; the Functions host handles preflight. Function keys
alone grant no access.

See [authentication](authentication.md), [local setup](../getting-started.md),
and [hosted verification](../operations/manual-api-deployment.md#verify-the-hosted-function).

## Saved Templates

The following routes require the same bearer token and delegated `Images.Render`
scope as the sample route. The API derives ownership from the validated Entra
`oid`; request bodies cannot set `userId`. Saved AXAML is stored as text and is
never sent to the sample renderer.

| Route | Request | Success |
| --- | --- | --- |
| `POST /api/templates` | JSON `{ "name": "...", "template": "..." }` | `201 Created`, `{ "id": "guid", "name": "trimmed name" }`, and `Location: /api/templates/{id}`. |
| `GET /api/templates` | No query parameters. | `200 OK`, `{ "items": [{ "id": "guid", "name": "..." }] }` with every template owned by the caller. |
| `GET /api/templates/{id}` | Template GUID in the path. | `200 OK`, `{ "id": "guid", "name": "...", "template": "exact saved text" }`. |

Names are trimmed, must be nonempty, and can contain at most 100 UTF-16 code
units. Template text must contain a non-whitespace character and can contain at
most 16,384 UTF-16 code units; its content is preserved exactly. Duplicate
names are allowed. The server generates each ID and inserts a new row rather
than overwriting one.

The list contains IDs and names, never template text. The adapter reads all
provider pages before returning one response. The expected scale is about 1,000
templates per user; response size grows with the user's template count. A list
is not a snapshot of concurrent inserts.

Malformed JSON, unknown create fields, invalid names, and invalid GUIDs return
`400`. Template text above 16,384 UTF-16 code units or a JSON request body above
128 KiB returns `413`.
Detail returns the same `404` for an absent ID and another user's ID. Storage
unavailability or provider failures return `503`; other failures return `500`.
These are problem responses with a safe code and correlation ID. They contain no
stored text, user IDs, provider details, or credentials. Every template response
uses `Cache-Control: no-store`; authentication failures retain the `401` and `403`
behavior described [above](#responses).

Shared API exception middleware maps thrown template input and storage failures
to these problem responses. The routes return explicit validation and 404
results.
