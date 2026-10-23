# UI Architecture

The Angular application lives in `src/ui/`. Dependency versions and tooling
are defined by [package.json](../../src/ui/package.json) and
[angular.json](../../src/ui/angular.json).

## Routes

| Route | Behavior |
| --- | --- |
| `/` | Sign-in action when signed out; image generator when signed in. |
| `/image-generator` | Guarded direct route to the generator. |
| `/component-lab` | Public shared-component workbench. |

[app.routes.ts](../../src/ui/src/app/app.routes.ts) defines routes. A shared layout
owns navigation, the main landmark, page spacing, and route focus.

## Ownership

- `pages/`: page workflow, loading/error state, and preview lifetime.
- `layout/`: persistent application chrome.
- `shared/api/<domain>/`: reusable API clients and transport types, independent
  of consumer count.
- `shared/auth/`: Entra session, route guard, and bearer interceptor.
- `shared/config/`: startup configuration.
- `shared/components/`: reusable controls.

## Startup And Requests

Public JSON loads before Angular starts. MSAL initialization and redirect
completion finish before routing. All routes need valid configuration.

MSAL uses authorization code flow with PKCE and a session-storage cache.
The interceptor acquires an API access token only for the configured API
origin/path boundary. Interaction-required renewal redirects; other token
failures stop the request. Route guards govern presentation, while the API
authorizes rendering.

The generator requests a PNG through its API client and owns the preview object
URL, releasing it on replacement or destruction.

See [runtime configuration](development/configuration.md),
[API contract](../api/endpoints.md), and [development standards](development/development-guidelines.md).
