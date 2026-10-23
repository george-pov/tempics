# UI Development Standards

Use strict TypeScript and Angular template checking. The official Angular
style guide is the baseline; these repository conventions take precedence.

## Components And Templates

- Use standalone, OnPush components and lazy routes. Omit redundant
  `standalone: true`; add NgModules only for compatibility.
- Keep providers in `app.config.ts` and routes in `app.routes.ts`.
- Prefer `inject()`, `input()`, `output()`, and component `host` bindings.
- Keep presentation and interaction in components; move reusable API, validation,
  branching, and mapping logic out. Colocate templates, styles, and tests.
- Prefer inference locally and explicit types at boundaries. Narrow `unknown`
  instead of using `any`. Keep one primary concept per file and mappings pure.
- Use typed forms and named validation/mapping logic.
- Use `@if`, `@for`, `@switch`, the async pipe for template observables,
  and class/style bindings instead of ngClass/ngStyle.
- Keep templates declarative; place complex calculations in named code.

## State And Services

- Use signals and computed values for local/derived state; update data immutably.
- Use RxJS for async composition. Use switchMap when newer work supersedes older
  work and takeUntilDestroyed for owned subscriptions.
- Handle errors so later user actions still work.
- Mark stable dependencies and values readonly; template-only members protected.
- Keep page workflow near its page. Shared behavior needs a clear owner;
  reusable API clients/types belong in `shared/api/<domain>/`.
- Use root-provided services for application singletons, configured HttpClient,
  functional interceptors, and typed runtime configuration.
- Keep HTTP contracts aligned with the backend. Use the auth interceptor;
  never put secrets or tokens in configuration, bundles, or logs.
- Browser validation and route guards do not replace API authorization.

## Accessibility And Shared Controls

- Meet WCAG AA; prefer semantic HTML over ARIA.
- Provide labels, error descriptions, visible focus, keyboard access, and contrast.
- Keep focus/reading order aligned; manage focus when default behavior is insufficient.
- Use descriptive accessible link names where visible text needs context.
- Keep shared-control examples in [Component Lab](component-lab.md).
- Prefer existing Angular/browser capabilities. Put shared third-party controls
  behind app-owned boundaries; do not expose private CSS or library internals.
  Exposing third-party types as app contracts requires a design decision.
- Avoid unrelated dependencies.

See [naming](naming-conventions.md), [styling](styling.md), and [testing](testing.md).
