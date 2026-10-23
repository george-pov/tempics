# API Testing

Tests live in `src/api/TP.Api.Tests/`; use the
[command guide](build-and-test.md) to run them.

- Test handlers through application-owned ports with explicit fixtures.
- Use the shared renderer fixture for real Avalonia/resource tests; keep native
  lifetime and cleanup deterministic.
- Test PNG metadata, safe HTTP failures, cancellation, and authentication through
  observable contracts.
- Auth tests use signed fixture tokens and local discovery data, not live Entra.
- Keep ordinary unit tests free of Azure, network, filesystem, and credentials.
- Assert dependency calls only when the interaction is part of the contract.
- Use Arrange, Act, Assert and the [test naming convention](naming-conventions.md#test-names).
- Avoid private-method, incidental logging, and framework-internals assertions.
- Account for platform-sensitive fonts/rasterization in image comparisons.

Tests do not prove hosted sign-in, consent, CORS, Linux compatibility, or arbitrary
AXAML isolation. Verify the environment separately using
[deployment checks](../../operations/deployment.md#verify-the-applications).
Real-resource checks require explicit opt-in; use isolated resources and clean
up only what the run created.
