# UI Architecture

The Angular frontend lives under `src/ui/`. It owns browser presentation,
navigation, user input, interaction state, and typed access to the backend API.

## Technology Boundary

- Angular 22 and Angular CLI manage the application.
- TypeScript uses the strict compiler options in `src/ui/tsconfig.json`.
- SCSS is the application styling language.
- Angular Material supplies shared controls through app-owned wrappers. The
  global Sass theme uses Azure/Blue colors, local Roboto typography, and density
  zero. Shared tokens, mixins, and the responsive `app-grid` layout live under
  `src/ui/src/styles/`.
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
    component-lab/
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

## Component Workbench

`/component-lab` is a public, lazy-loaded visual workbench for shared components.
Its registry selects a lab through responsive navigation and `NgComponentOutlet`.
Lab-owned `LabPage` and `LabExample` helpers provide consistent example sections.
Button lab uses the real shared `app-button` with local interaction state.
Examples require no API or user data. See the
[Component Lab guide](development/component-lab.md) for use and extension.

## State

Route pages own user-visible loading, mutation, validation, error, and
navigation state. Extract state beside its owning page when doing so reduces
orchestration complexity and gives the state a clear lifecycle.

Use backend-computed permissions and eligibility instead of recreating durable
authorization or rendering policy in the browser.

## API Access

Isolate HTTP access behind focused typed services. Components must not build
transport payloads ad hoc or contain reusable request and response mapping.
Before Angular bootstrap, native fetch loads and validates `config.json`
relative to the document base URL. Application providers receive its frozen
`RuntimeConfig` through `CONFIG`. Startup fails with safe reload feedback when
configuration is unavailable or invalid; every route requires it.

API services make direct requests to the configured absolute `apiBaseUrl`.
`SampleRenderApi` appends `/renders/sample` and preserves its empty POST/PNG Blob
contract. If runtime settings contain `functionKey`, this request sends it as
`x-functions-key`. Deployment injects that shared key into public configuration;
it is visible to visitors and does not establish user identity. API CORS must
allow the UI's exact origin and this header. See
[runtime configuration](development/configuration.md) for validation, local
setup, packaging, and the separate hosted CORS/authentication requirements.

Backend contracts are canonical. UI code may define matching frontend types
for compilation and mapping, but must update them together with the API
contract and its tests.
