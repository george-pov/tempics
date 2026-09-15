# API Development Guidelines

Development guidance for the Tempics .NET backend and Azure Functions host.

## Project Defaults

- Target framework: .NET 10.
- Host: Azure Functions v4 isolated worker with ASP.NET Core HTTP integration.
- Language settings: nullable reference types and implicit usings enabled.
- Composition: dependency injection configured at the host boundary.
- Telemetry: OpenTelemetry with Azure Monitor export when configured.
- Principles: clear contracts, inward dependencies, user isolation,
  observability, cancellation, and bounded resource use.

## C# Standards

- Keep nullable reference types enabled. Model absence explicitly rather than
  suppressing warnings without evidence.
- Prefer immutable records for commands, queries, results, requests, responses,
  and value-like models.
- Prefer small types with one responsibility and constructor-injected
  dependencies.
- Use interfaces at external boundaries or when multiple implementations are
  meaningful. Do not create interfaces for every class by default.
- Use `async` all the way across I/O paths. Do not block on tasks with
  `.Result`, `.Wait()`, or `.GetAwaiter().GetResult()`.
- Accept and pass `CancellationToken` through HTTP, storage, and rendering
  operations.
- Use `TimeProvider` when application behavior depends on time.
- Keep transformations pure when mapping transport, application, domain,
  persistence, and rendering models.

## Azure Functions

- Keep trigger methods thin: parse, authenticate, authorize, delegate, and map
  the result.
- Put request and response DTOs at the HTTP boundary. Do not pass
  `HttpRequest`, `IActionResult`, route values, or headers into domain code.
- Use dependency injection for application handlers and adapters.
- Bind environment configuration to focused options types and validate required
  settings during startup.
- Do not read environment variables throughout application code.
- Map known validation, not-found, conflict, authorization, throttling, and
  timeout outcomes consistently.
- Do not expose exception messages, stack traces, filesystem paths, connection
  details, or provider payloads to callers.

## Application And Domain

- Separate commands that change state from queries that read state.
- Give each handler one application use case.
- Put host-independent product invariants in domain types.
- Put workflow validation and orchestration in application handlers.
- Define ports in terms of application needs, not Azure SDK or Avalonia APIs.
- Enforce ownership before loading content or performing a render.
- Keep idempotency and concurrency behavior explicit for writes and render jobs.

## Persistence And Azure Services

- Keep Azure SDK types inside infrastructure adapters.
- Map persisted entities to application or domain models at the adapter
  boundary.
- Use optimistic concurrency where two requests can modify the same resource.
- Bound retries and use them only for operations known to be safe to repeat.
- Do not create hosted resources from request paths. Provision them through
  deployment infrastructure.
- Prefer managed identities over stored credentials where supported.

## Rendering

- Treat every AXAML document, parameter value, and asset as untrusted.
- Allow only an explicit subset of controls, markup, resources, and URI schemes.
- Resolve assets through ownership-aware application ports, never arbitrary
  filesystem or network paths.
- Apply explicit time, memory, dimension, and output-size limits.
- Translate Avalonia and encoder failures into safe application errors.
- Dispose streams, bitmaps, and other native or memory-heavy resources
  deterministically.

## Logging And Telemetry

- Use structured logging with stable event names and properties.
- Include safe correlation identifiers for request and render tracing.
- Never log access tokens, authorization headers, template content, binary
  assets, connection strings, or sensitive parameter values.
- Record durations and outcomes at API, persistence, and rendering boundaries.
- Distinguish validation failures, user errors, dependency failures, timeouts,
  cancellations, and internal faults.

## Dependencies

- Prefer framework and existing package capabilities before adding a package.
- Add dependencies only for a clear owned responsibility.
- Keep provider-specific packages in infrastructure or host projects.
- Record architectural or security-sensitive dependency choices in the active
  feature plan before implementation.

Follow [`naming-conventions.md`](naming-conventions.md) for identifiers and
[`testing.md`](testing.md) for test design.
