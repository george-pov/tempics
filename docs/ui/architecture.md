# UI Architecture

The Angular application lives in `src/ui/`. Dependency versions and tooling
are defined by [package.json](../../src/ui/package.json) and
[angular.json](../../src/ui/angular.json).

## Routes

| Route | Behavior |
| --- | --- |
| `/` | Sign-in action when signed out; image generator when signed in. |
| `/image-generator` | Guarded direct route to the generator. |
| `/templates` | Guarded, lazy list of the signed-in caller's saved template names. Add opens the create page. |
| `/templates/new` | Guarded, lazy page for editing, manually previewing, and saving a new AXAML template. |
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

`pages/templates/` owns the list request's loading, loaded, and error states,
including retry. `pages/template-create/` owns the opening draft, field
validation, Cancel reset, create request state, and an optional unsaved preview.
It sends a trimmed name and the exact AXAML text through
`shared/api/templates/`. A confirmed `201` returns to `/templates`, where the
list loads again. A failed create keeps the draft and warns that the saved row
may already exist. The list presents names only; it does not fetch saved AXAML
or render previews.

Preview is a manual request through `shared/api/image-render/` for the current
nonblank AXAML. The pane starts empty. A new request or AXAML edit invalidates
older output; the page accepts only a nonempty `image/png` Blob for the current
text and revokes its object URL on replacement, edit, Cancel, or destruction.
An unrenderable draft gets generic retryable feedback. Preview allows at most
2,048 UTF-16 code units and a 2,048-byte encoded JSON request; Save remains
independent and permits up to 16,384 UTF-16 code units.

## Shared Controls

[Shared components](../../src/ui/src/app/shared/components/) keep Material UI
dependencies behind app-owned contracts. `Button` is a native action with filled,
outlined, or text appearance; `ButtonLink` is a routed anchor with the same
appearances and an optional decorative local icon. `Input` binds a typed string
form control to a labeled single-line or multiline field. Its caller owns
validation and supplies hint or error text.

`Alert` presents success or error text with the corresponding status or alert
role. `ProgressBar` shows labeled indeterminate work with one polite pending
announcement. Pages own request state and any preview object URL lifetime.

## Startup And Requests

Public JSON loads before Angular starts. MSAL initialization and redirect
completion finish before routing. All routes need valid configuration.

MSAL uses authorization code flow with PKCE and a session-storage cache.
The interceptor acquires an API access token only for the configured API
origin/path boundary. Interaction-required renewal redirects; other token
failures stop the request. Route guards govern presentation, while the API
authorizes rendering.

The generator and create page each own their PNG object URL lifetime. The
create page uses the authenticated preview endpoint without reading or writing
a saved template.

See [runtime configuration](development/configuration.md),
[API contract](../api/endpoints.md), and [development standards](development/development-guidelines.md).
