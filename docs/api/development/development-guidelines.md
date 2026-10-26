# API Development Standards

Use .NET nullable checking, clear contracts, inward dependencies, cancellation,
and explicit resource ownership. Current boundaries are in
[architecture](../architecture.md).

## Code And Boundaries

- Prefer small types, immutable records, constructor injection, and pure mapping.
- Model absence explicitly; do not suppress nullable warnings without evidence.
- Define interfaces for external capabilities or meaningful alternatives,
  not automatically for every class.
- Keep I/O async; do not block tasks with `.Result`, `.Wait()`, or
  `.GetAwaiter().GetResult()`. Pass cancellation through the call chain.
- Use `TimeProvider` for time-dependent behavior.
- Keep endpoints thin and transport types at the host. Bind focused options and
  validate them at startup; avoid scattered environment-variable reads.
- Give each handler one use case. Separate state-changing operations from queries.
- Define application-owned ports; keep SDK/framework types and lifetimes in adapters.
- Bound retries to operations safe to repeat. Provision resources outside request
  paths and prefer managed identity where supported.

## Rendering And Errors

- Keep the sample route limited to bundled AXAML. The preview route accepts
  caller AXAML under its request-size limit and renders it in the Function
  process; do not describe the renderer as a sandbox.
- Clean up native rendering resources deterministically.
- Honor queued cancellation without claiming synchronous render preemption.
- Map failures safely and consistently; do not turn cancellation into an
  ordinary render failure.
- Keep exception details, paths, credentials, and provider payloads out of responses.

## Logs And Dependencies

- Use structured events, safe correlation IDs, durations, and outcomes.
- Never log tokens, authorization headers, template/image contents, connection
  strings, or sensitive values.
- Prefer existing capabilities before adding dependencies; keep provider
  packages at adapter/host boundaries.

See [naming](naming-conventions.md), [testing](testing.md), and
[product requirements](../../product.md) for capabilities beyond the current sample.
