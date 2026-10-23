# UI Testing

Use Vitest and Angular TestBed through the configured unit-test builder.
Keep `.spec.ts` files beside the code. Commands are in
[build and test](build-and-test.md).

- Test rendered behavior, accessible roles, user actions, and app-owned contracts.
- Test pure logic without Angular where possible.
- Fake HTTP and authentication; unit tests need no network, host, or real account.
- Cover meaningful loading, success, failure, and cancellation behavior at its
  owning layer, with one integrated shell/route/client happy path using mocked HTTP.
- Keep control behavior in control tests. Component Lab needs route coverage,
  not duplicate control tests.
- Verify API method, URL, headers, mapping, and cancellation. Update client tests
  with backend contract changes; do not duplicate server authorization rules.
- Prefer behavior over incidental wording or DOM order. Avoid private members,
  framework-generated DOM, library internals, CSS-layout assertions, large
  snapshots, and tests that merely repeat implementation.

Use [Component Lab](component-lab.md) for manual keyboard, responsive, zoom, and
appearance checks. Screenshots are not an automated regression suite.
No end-to-end runner is configured. Keep live-environment checks separate and
obtain authorization before modifying real user data.
