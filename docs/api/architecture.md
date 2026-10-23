# API Architecture

The solution is [Tempics.slnx](../../src/api/Tempics.slnx), using .NET 10 and
Azure Functions v4 isolated worker with ASP.NET Core HTTP integration.

| Project | Owns |
| --- | --- |
| `TP.Application` | Sample use case, template/renderer ports, results, and errors. |
| `TP.Avalonia` | Bundled AXAML/assets/fonts and headless rendering. |
| `TP.AzureFunctions` | Composition, bearer middleware, HTTP mapping, and telemetry. |
| `TP.Api.Tests` | Handler, renderer, endpoint, and authentication tests. |

The host composes the application and adapter. The adapter depends on application
ports; the application has no HTTP, Avalonia, or storage SDK dependency.
There is no separate domain project or application-data persistence.

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

Keep HTTP/configuration at the host, orchestration and ports in the application,
and framework types inside adapters. Requirements beyond this trusted sample
belong in the [product target](../product.md).
