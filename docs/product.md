# Product Target

This is the intended Tempics product. See [architecture](architecture.md) for
what exists today.

## User Workflow

1. Sign in with Microsoft Entra ID.
2. Upload reusable assets such as logos, backgrounds, and photos.
3. Create and manage AXAML image templates.
4. Define text and image parameters in each template.
5. Select a template, supply parameter values, and generate a PNG.

Templates, assets, and retained generated images belong to individual users.

## Target Boundaries

Angular owns editing, selection, input, and presentation. The Azure Functions
API owns validation, authorization, orchestration, and persistence access.
Avalonia renders AXAML to PNG; Azure hosts the application.

Keep product rules independent of HTTP and providers. Application handlers own
use cases and ports; infrastructure adapters own storage and rendering details.
Define concurrency, retry, and idempotency behavior for writes and render jobs.

## Required Safeguards

- Enforce ownership before every read, write, or render involving user data.
- Treat user AXAML, parameters, and assets as untrusted.
- Allow only supported controls, markup, resources, and URI schemes.
- Prevent arbitrary filesystem, network, environment, secret, and cross-user access.
- Validate upload type, size, dimensions, and ownership.
- Validate declared parameters, supplied values, and asset references.
- Enforce time, memory, image-size, output-size, queue, and capacity limits.
- Return safe errors and keep sensitive content out of logs.
- Test rejected inputs, ownership failures, limits, concurrency, and isolation.

The bundled sample renderer does not provide this untrusted-input boundary.

## Undecided

Accepted AXAML, parameter schema, upload limits, storage design, retention,
quotas, scheduling, isolation, and timeout enforcement still need decisions.
