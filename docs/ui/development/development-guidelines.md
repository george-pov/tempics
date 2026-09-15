# UI Development Guidelines

Development guidance for the Tempics Angular frontend.

## Project Defaults

- Framework: Angular 22 with standalone components.
- Language: TypeScript with strict compiler and Angular template checks.
- Styling: component-scoped SCSS with a small global entry point.
- Package manager: npm.
- Unit-test runtime: Angular unit-test builder with Vitest and jsdom.
- Principles: clear ownership, typed contracts, accessibility, predictable
  state, and small route-focused features.

Use the official Angular style guide as the upstream baseline. These repository
rules decide when local guidance is more specific.

## TypeScript

- Keep strict compiler options enabled. Do not weaken `tsconfig` settings to
  make feature code compile.
- Prefer inference when the type is obvious and explicit named types at API,
  form, route, storage, and component boundaries.
- Use `unknown` and narrow it instead of using `any` for uncertain data.
- Keep transformations pure when mapping forms, routes, configuration, and API
  contracts.
- Prefer immutable updates for arrays, objects, and state values.
- Keep one primary concept per file.

## Angular

- Use standalone components and route-level lazy loading.
- Do not add `standalone: true`; standalone is the project default.
- Do not introduce NgModules for new application code unless compatibility
  requires one.
- Keep application providers in `app.config.ts` and routes in `app.routes.ts`.
- Prefer `inject()` over constructor parameter injection for new code.
- Prefer `input()` and `output()` over decorator inputs and outputs.
- Put host bindings and listeners in the component or directive `host` object.
- Use `ChangeDetectionStrategy.OnPush` on new components.
- Mark stable dependencies, signals, inputs, outputs, and configuration
  `readonly`.
- Use `protected` for members exposed only to the template.
- Keep components focused on presentation and interaction orchestration. Move
  API access, reusable validation, branching rules, and mapping out of them.
- Keep small components colocated with their template, styles, and tests.

## State And Async Work

- Use signals for local input, loading, error, selection, and derived UI state.
- Use `computed()` for derived values and update signal values immutably.
- Use RxJS for HTTP composition, cancellation, debounce, retry policies, and
  multi-step asynchronous streams.
- Use `switchMap` when a newer action supersedes an in-flight request.
- Bind owned subscriptions to the component lifecycle with
  `takeUntilDestroyed()`.
- Handle errors without terminating streams that must respond to future user
  actions.
- Do not duplicate durable authorization or render-policy state in the browser.

## Forms And Templates

- Use typed form models. Avoid `any` controls or untyped request mapping.
- Keep form validation, cross-field rules, and request mapping in named code
  rather than large template expressions.
- UI validation improves feedback; the API remains authoritative.
- Use native Angular control flow: `@if`, `@for`, and `@switch`.
- Keep templates declarative. Move complex conditions and transformations into
  computed signals, services, or pure functions.
- Use the `async` pipe for observables consumed directly by templates.
- Prefer class and style bindings over `ngClass` and `ngStyle` in new code.

## Accessibility

- Meet WCAG AA for new and changed user-facing behavior.
- Prefer semantic HTML before ARIA.
- Provide programmatic labels, error descriptions, visible focus, keyboard
  access, and sufficient color contrast.
- Keep focus order aligned with reading order.
- Manage focus after route changes, dialogs, validation failures, and completed
  actions when default browser behavior is insufficient.
- Give concise visible link text a descriptive accessible name when its
  destination would otherwise be unclear.

## Services And HTTP

- Give each service one responsibility and a clear owner.
- Use `providedIn: 'root'` for application-wide singleton services.
- Keep page-flow services near the page that owns them. Move a service to
  `shared/` only when multiple flows use it.
- Configure `HttpClient` through application providers and prefer functional
  interceptors.
- Keep base URLs and other deployment-specific public values in typed runtime
  configuration, not page services.
- Never place secrets in browser configuration, bundles, source, or logs.
- Keep API requests, responses, and mapping typed and update them with the
  backend contract.

## Dependencies

- Prefer Angular, browser, and existing package capabilities before adding a
  dependency.
- Add UI libraries behind app-owned boundaries when their use becomes shared.
- Do not expose third-party component types or CSS internals as application
  contracts without an explicit design decision.
- Do not introduce unrelated dependencies as part of a feature.

Follow [`naming-conventions.md`](naming-conventions.md),
[`styling.md`](styling.md), and [`testing.md`](testing.md).
