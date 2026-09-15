# UI Architecture

The Angular frontend lives under `src/ui/`. It owns browser presentation,
navigation, user input, interaction state, and typed access to the backend API.

## Technology Boundary

- Angular 22 and Angular CLI manage the application.
- TypeScript uses the strict compiler options in `src/ui/tsconfig.json`.
- SCSS is the application styling language.
- Angular routing owns browser navigation.
- Vitest with jsdom is configured through the Angular unit-test builder.
- Exact dependency versions belong to `src/ui/package.json` and its lockfile.

## Source Direction

Organize new UI behavior by ownership:

```text
src/ui/src/app/
  app.config.ts
  app.routes.ts
  layout/
  pages/
    templates/
    assets/
    render/
  shared/
    api/
    auth/
    components/
    config/
```

Route-level orchestration belongs under `pages/`. Reusable browser behavior and
components belong under `shared/`. Persistent application chrome belongs under
`layout/`. Create folders when the first real consumer needs them; do not add
empty scaffolding.

## Responsibilities

The UI owns:

- Routes, layouts, pages, components, forms, and browser interaction state.
- Template editing and parameter-value collection.
- Asset upload selection and generated-image presentation.
- Typed clients and mapping for Azure Functions HTTP contracts.
- Responsive client-side validation for user feedback.
- Tests for components, routes, clients, and user-visible behavior.

The UI does not own durable authorization, persistence rules, AXAML safety,
render limits, PNG generation, or direct Azure Storage access. Those behaviors
belong behind API use cases.

## State

Route pages own user-visible loading, mutation, validation, error, and
navigation state. Extract state beside its owning page when doing so reduces
orchestration complexity and gives the state a clear lifecycle.

Use backend-computed permissions and eligibility instead of recreating durable
authorization or rendering policy in the browser.

## API Access

Isolate HTTP access behind focused typed services. Components must not build
transport payloads ad hoc or contain reusable request and response mapping.
API services receive environment-specific public settings through a typed
configuration boundary; browser configuration must never contain secrets.

Backend contracts are canonical. UI code may define matching frontend types
for compilation and mapping, but must update them together with the API
contract and its tests.
