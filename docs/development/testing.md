# Testing Principles

These principles apply to UI and API unit tests. Follow the area-specific
guidance for fixtures, tools, and contracts.

- Test one logical outcome at a time. Use as many assertions as needed to prove
  that outcome, but leave unrelated behavior to separate tests.
- Assert observable behavior and public contracts rather than incidental
  structure, styling, or internal state. For a button-label test, check the
  required label; test appearance or visibility separately when either is a
  requirement.
- Keep tests independent of execution order and shared mutable state so each
  test can run alone and produce the same result.
- Keep failures focused on the behavior under test. Unrelated UI or
  implementation changes should not require widespread test updates.
