# API Testing

API tests protect product behavior, ownership boundaries, rendering safety,
and integration contracts rather than framework implementation details.

## Unit Tests

- Keep domain and application unit tests free of Azure, network, filesystem,
  real Avalonia windows, and real credentials.
- Test through public behavior and application-owned ports.
- Keep test data explicit, including user IDs, template IDs, asset IDs, image
  dimensions, and render limits.
- Use Arrange, Act, Assert structure.
- Verify dependency calls only when the interaction is part of the behavior.
- Avoid testing private methods, logging call shape, DI registration internals,
  or incidental collection implementation.
- Use the naming pattern in
  [`naming-conventions.md`](naming-conventions.md#test-names).

## Application Tests

- Test handlers through repository, identity, storage, and rendering ports.
- Verify request models map to domain values correctly.
- Verify ownership checks happen before content access or rendering.
- Cover validation, not-found, forbidden, conflict, timeout, cancellation, and
  dependency-failure paths.
- Verify returned results contain only caller-owned identifiers and safe error
  information.

## Rendering Tests

- Use a small fixed corpus of allowed and rejected AXAML templates.
- Cover text and image parameters, missing values, unknown parameters, invalid
  assets, maximum dimensions, timeouts, and malformed markup.
- Compare deterministic metadata or approved image snapshots where pixel output
  is the contract. Keep platform-sensitive font and raster differences out of
  brittle exact comparisons.
- Add regression tests for any template that previously escaped a sandbox or
  exhausted resources.

## Integration Tests

- Keep tests that require Azure emulators, a Functions host, or the real
  Avalonia adapter separate from unit tests.
- Default integration tests to local emulators and isolated resources.
- Require explicit opt-in before using a real Azure subscription or deployed
  endpoint.
- Create unique test resources and delete only resources created by that run.
- Keep endpoints, tokens, connection strings, and user-specific values outside
  tracked files.

Runnable commands live in [`build-and-test.md`](build-and-test.md).
