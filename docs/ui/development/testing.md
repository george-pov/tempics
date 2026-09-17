# UI Testing

Frontend tests protect user-visible behavior and app-owned contracts rather
than Angular or browser implementation details.

## Unit And Component Tests

- Keep tests beside source with `.spec.ts`.
- Use Vitest and Angular `TestBed` through the configured Angular test builder.
- Test components through rendered output, accessible roles, labels, and user
  actions where practical.
- Test pure mapping and validation logic without Angular when no framework
  behavior is involved.
- Mock or fake backend HTTP calls. Unit tests must not require a live Functions
  host, Azure service, real Entra session, network, or credentials.
- Keep fixture values explicit, especially user IDs, template IDs, asset IDs,
  parameters, and image dimensions.
- Verify loading, success, empty, validation, forbidden, and failure states for
  behavior that exposes them.
- Cover each major behavior at its owning layer and keep one integrated happy
  path through the real app shell, route, and API client with mocked HTTP.
  Do not repeat every lower-level failure case in page or startup tests.
- Keep shared-control behavior in the control's tests. Component Lab examples
  need a route smoke test, not duplicate tests of control behavior or demo copy.
- Prefer assertions about actions, state, accessible feedback, and results over
  exact incidental wording or DOM order. Keep cheap validation tables when each
  input protects an app-owned rule; fewer reported cases is not itself a goal.

## API Client Tests

- Verify method, URL, headers, request mapping, response mapping, and relevant
  cancellation behavior.
- Keep authentication mechanics behind the app-owned auth boundary.
- Do not duplicate backend authorization or AXAML validation rules in UI tests.
- When a backend contract changes, update its UI types, mapping, and tests in
  the same implementation slice.

## Tests To Avoid

- Do not test private component members directly.
- Do not assert framework-generated DOM, third-party library internals, or CSS
  layout details.
- Do not create snapshot tests for large static templates that protect no user
  behavior.
- Do not add a test solely to mirror an implementation line.

## Browser Tests

Use [Component Lab](component-lab.md) at `/component-lab` for manual visual and
interaction checks of shared components. Button lab covers filled and disabled
states, activation feedback, and native form button types. Inspect wide and
narrow layouts, browser zoom, keyboard focus, and Enter/Space activation.
Keep behavior assertions in automated tests; screenshots from the workbench
are manual evidence, not an automated regression suite.

No end-to-end test runner is currently configured. Add one through an approved
feature when a critical cross-page flow requires browser-level proof. Keep
deployed environment tests separate and require explicit authorization before
they create or modify real user data.

Runnable commands live in [`build-and-test.md`](build-and-test.md).
