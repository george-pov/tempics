# API Architecture

The solution is [Tempics.slnx](../../src/api/Tempics.slnx), using .NET 10 and
Azure Functions v4 isolated worker with ASP.NET Core HTTP integration.

| Project | Owns |
| --- | --- |
| `TP.Application` | Render and saved-template use cases, ports, results, and errors. |
| `TP.Avalonia` | Bundled AXAML/assets/fonts and headless rendering. |
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

## Render Boundary

The endpoint delegates to a handler that loads the bundled template and renders
it. No request content selects AXAML, paths, or assets. See the
[endpoint contract](endpoints.md) and [authentication](authentication.md).

The shared headless session serializes work. Dimension and encoded-output limits
are defined in the endpoint contract. The size check occurs after encoding;
it is not a memory quota. Cancellation works while queued and before
dispatch, without hard preemption of synchronous rendering.

The adapter owns native resources and cleanup. Linux publication needs the
bundled fonts and native libraries described in [manual deployment](../operations/manual-api-deployment.md).

## Saved Templates

Template handlers accept the validated Entra `oid` as a user GUID. The storage
adapter uses that GUID as `PartitionKey` and a server-generated template GUID as
`RowKey`. Reads always include the caller's partition, and a mismatched stored
`UserId` fails closed. Creates insert a row; lists project metadata only and
aggregate provider pages into one HTTP response; detail returns raw saved text
only to its owner. See the [template endpoints](endpoints.md#saved-templates).

Saved AXAML is untrusted data. The save path does not parse or render it, and
the bundled renderer cannot load it. Local development uses Azurite and can
create the `Templates` table at startup. Hosted storage uses the Function managed
identity and the separate application-data account described in
[infrastructure](../operations/infrastructure.md).

Keep HTTP/configuration at the host, orchestration and ports in the application,
and framework types inside adapters. Requirements beyond this trusted sample
belong in the [product target](../product.md).
