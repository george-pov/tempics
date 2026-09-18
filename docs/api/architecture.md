# API Architecture

The backend API lives under `src/api/Tempics/`. It uses Azure Functions v4 on
the .NET 10 isolated worker. HTTP and host concerns stay at the outer boundary;
product rules and application behavior remain independent of Azure Functions.

## Current Boundary

`TP.AzureFunctions` is the current host project. It owns Functions startup,
dependency injection, HTTP triggers, runtime configuration, and telemetry
registration. Keep endpoint classes thin as product behavior is introduced.

The host validates Entra bearer tokens through `Microsoft.Identity.Web` and
`BearerTokenMiddleware`. Every HTTP Function requires the delegated
`Images.Render` scope before endpoint execution. See
[authentication](authentication.md) for configuration and deployment ordering.

## Dependency Direction

Backend dependencies point inward:

```text
Azure Functions host
  -> application use cases and ports
  -> domain concepts and rules

Infrastructure adapters
  -> application ports
  -> domain concepts and rules
```

Domain and application code must not depend on Azure Functions, HTTP request
types, Azure SDK storage types, Avalonia host details, or authentication
frameworks.

## Responsibilities

### Domain

Own concepts and rules that remain true regardless of delivery or persistence,
including templates, template parameters, asset references, render requests,
and ownership-safe state transitions.

Do not place HTTP DTOs, storage entities, Azure clients, configuration binding,
logging adapters, or rendering-framework types in the domain boundary.

### Application

Own commands, queries, handlers, results, read models, validation, and ports for
persistence, rendering, identity, clocks, and other external capabilities.
Application handlers coordinate one use case and depend on interfaces defined
for application needs.

### Infrastructure

Own concrete Azure storage, Avalonia rendering, telemetry, and other external
adapters. Keep SDK types, serialization, retries, paging, concurrency tokens,
and provider-specific behavior inside this boundary.

### Azure Functions host

Own HTTP triggers, transport DTOs, route and header parsing, authentication and
authorization at the HTTP boundary, status-code mapping, dependency injection,
and configuration wiring. Each endpoint should delegate to one application use
case instead of containing product rules.

## Request Flow

```text
authenticated HTTP request
  -> parse and validate transport contract
  -> establish user identity
  -> execute application command or query
  -> call domain behavior and required ports
  -> map result to HTTP response
```

Every template, asset, and generated-image operation must carry an established
user identity through the use case and enforce ownership before reading or
writing data.

## Rendering Boundary

The application requests rendering through an application-owned port. The
Avalonia adapter is responsible for constrained AXAML loading, parameter and
asset binding, rasterization, time and memory limits, and PNG encoding.

Do not expose Avalonia control instances or framework-specific exceptions
through application or HTTP contracts. Return application-owned results and
safe errors.

## Placement Checklist

- Product concept or host-independent rule: domain.
- User action or system workflow: application command, query, or handler.
- Database, Azure SDK, Avalonia, filesystem, clock, or external call:
  infrastructure adapter behind an application port.
- HTTP shape, status, identity extraction, DI, or host configuration: Azure
  Functions host.
- Type requires an inward project to reference an outer framework: move the
  type outward or introduce an application-owned abstraction.
