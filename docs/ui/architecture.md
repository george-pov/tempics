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
      image-render/
    auth/
    components/
    config/
```

Route-level orchestration belongs under `pages/`. Reusable browser behavior and
components belong under `shared/`. Persistent application chrome belongs under
`layout/`. Create folders when the first real consumer needs them; do not add
empty scaffolding.

## Application Layout

`AppLayout` in `layout/app-layout/` is the parent route for Home, Image Generator,
and Component Lab. It owns the linked Tempics brand, primary navigation, and a single main
landmark with the shared content width and responsive page padding. Pages stay
lazy loaded through its child router outlet and provide their own heading and
content without adding another `main` or outer `app-container`.

Primary links identify the current page visually and through `aria-current`.
Navigation wraps on narrow screens. A keyboard skip link focuses the content;
subsequent page activations move focus there while initial loading preserves
browser focus. Each page route supplies a document title. The shell consumes
the shared authentication session for navigation, sign-out, and safe feedback.

## Sign-In Flow

Opening `/` while signed out shows a Sign in button. It redirects the current
window to Microsoft Entra External ID for email/password sign-in. Entra returns
to `/`, where Home displays the image generator for the signed-in account.
The header exposes primary navigation and Sign out while signed in.
`/image-generator` remains available as a guarded direct route;
`/component-lab` remains public.

`AuthSession` under `shared/auth/` uses `@azure/msal-browser` for authorization
code flow with PKCE, redirect completion, sign-out, and API access tokens.
An application initializer finishes MSAL initialization and redirect handling
before Angular starts routing. MSAL owns its session-storage cache and restores
the account on reload. Sign out ends the Entra session and returns to `/`.
Cancelled or denied sign-in shows safe feedback and permits another attempt.

The bearer interceptor acquires a token silently for the configured API scopes.
If Entra requires interaction, it redirects to sign-in and holds the API call.
Other token failures fail the request without sending it or retrying indefinitely.
Only requests matching the API origin and path boundary receive the token.
ID tokens are never used as API bearer tokens.

Route guards control presentation. The API validates bearer tokens and requires
the delegated `Images.Render` scope before rendering. Future user-owned resources
also need ownership checks. See [API authentication](../api/authentication.md).

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
Keep API clients and their transport types under `shared/api/`, grouped by
domain. Each client owns a focused backend capability independently of its
consuming pages. Keep page workflow and interaction state with the owning page.
Create domain folders as their clients are introduced.
Before Angular bootstrap, native fetch loads and validates `config.json`
relative to the document base URL. Application providers receive its frozen
`RuntimeConfig` through `CONFIG`. Startup fails with safe reload feedback when
configuration is unavailable or invalid; every route requires it.

API services make direct requests to the configured absolute `apiBaseUrl`.
`ImageRenderApi` in `shared/api/image-render/` appends `/renders/sample` and
preserves its empty POST/PNG Blob contract. The bearer interceptor supplies the
Entra access token; no Function key is required. API CORS must
allow the UI's exact origin and `Authorization`. See
[runtime configuration](development/configuration.md) for validation, local
setup, packaging, and the separate hosted CORS/authentication requirements.

Backend contracts are canonical. UI code may define matching frontend types
for compilation and mapping, but must update them together with the API
contract and its tests.
