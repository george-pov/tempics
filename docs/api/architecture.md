# API Architecture

The solution is [Tempics.slnx](../../src/api/Tempics.slnx), using .NET 10 and
Azure Functions v4 isolated worker with ASP.NET Core HTTP integration.

| Project | Owns |
| --- | --- |
| `TP.Application` | Render and saved-template use cases, ports, results, and errors. |
| `TP.Avalonia` | Bundled AXAML/assets/fonts and headless AXAML-to-PNG rendering. |
| `TP.TableStorage` | Azure Tables mapping and owner-scoped persistence. |
| `TP.AzureFunctions` | Composition, bearer middleware, HTTP mapping, and telemetry. |
| `TP.Api.Tests` | Handler, renderer, endpoint, and authentication tests. |

The host composes the application and adapters. Adapters depend on application
ports; the application has no HTTP, Avalonia, or storage SDK dependency. There
is no separate domain project.

`ApiExceptionMiddleware` wraps bearer authentication and HTTP Function calls.
It maps thrown failures through `ApiErrorResults` to safe `ProblemDetails` action
results, which the ASP.NET Core integration writes. Normal bearer 401/403
denials remain bodyless, explicit validation and 404 results stay in the routes,
and cancellation propagates.

## Render Boundaries

The sample handler loads only bundled AXAML. No request content selects its
markup, paths, or assets. The draft preview handler accepts at most 2,048 UTF-16
code units of unsaved AXAML from a request body of at most 2,048 bytes.
Both handlers use the same in-process Avalonia runtime loader and shared
headless session. Rendering is serialized. Cancellation works while queued and
before dispatch, without hard preemption of synchronous rendering. Caller AXAML
is not restricted to a control subset, and the renderer is not a sandbox. Both
routes require a 1200 x 630 image and reject an empty or greater-than-5-MiB
encoded PNG. These output checks do not limit rendering memory or time.
Preview reads no saved template or asset.

## Saved Templates

Template handlers accept the validated Entra `oid` as a user GUID. The storage
adapter uses that GUID as `PartitionKey` and a server-generated template GUID as
`RowKey`. Reads always include the caller's partition, and a mismatched stored
`UserId` fails closed. Creates insert a row; lists project metadata only and
aggregate provider pages into one HTTP response; detail returns raw saved text
only to its owner. Update and delete verify the existing owner row before
replacing or permanently removing it. PUT never creates a row. Successful
competing updates use last-write-wins behavior, with edit and retry coordination
left to the caller. See the [template endpoints](endpoints.md#saved-templates).

Saved AXAML is untrusted data. The save path does not parse or render it, and
the bundled renderer cannot load it. Local development uses Azurite and can
create the `Templates` table at startup. Hosted storage uses the Function managed
identity and the separate application-data account described in
[infrastructure](../operations/infrastructure.md).
neither render route reads a saved row. Local development uses Azurite and can
create the `Templates` table at startup. Hosted storage uses the Function managed
identity and the separate application-data account described in
[infrastructure](../operations/infrastructure.md).
the bundled renderer cannot load it. Storage registration selects either a
connection string or an HTTPS table service URI with `DefaultAzureCredential`.
An explicit startup setting can create the `Templates` table; the documented
local Azurite setup enables it. Hosted Bicep provisions the table and uses the
Function managed identity with the separate application-data account described
in [infrastructure](../operations/infrastructure.md).

Keep HTTP/configuration at the host, orchestration and ports in the application,
and framework types inside adapters. Further capabilities belong in the
[product target](../product.md).
