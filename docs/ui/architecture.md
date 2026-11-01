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
| `/templates/new` | Guarded, lazy editor with a default draft, manual preview, and create. |
| `/templates/:id/edit` | The same guarded editor, loading one saved template for update and manual preview. |
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

`pages/templates/` owns the list request's loading, loaded, and error states.
A failed list load shows a generic error message without a retry action. A new
list load or completed deletion cancels an older list request so its response
cannot replace the current state. A row's Edit link opens that saved template.
A row's Delete button opens a plain-text confirmation. Only an affirmative
result sends that row's ID through the authenticated DELETE client. A successful
HTTP response removes the row and updates the count; the current API returns
`204`. Any DELETE error, including `404`, leaves the row in place with a generic
error message and no list reload.

`pages/template-editor/` owns the default create draft or a loaded saved
template, field validation, local Cancel reset, save state, and manual preview.
An edit route loads the selected detail before showing the form; a failed load
shows generic feedback and a Templates link. Save trims the name, preserves
AXAML exactly, and sends only those two fields through `shared/api/templates/`.
Create requires a confirmed `201`; update accepts a successful HTTP response
(currently `204`). Both return to `/templates` for a new list load. A failed
create keeps the draft and warns that the saved row may already exist. A failed
update keeps the draft and shows generic feedback without retrying. Back
navigates to Templates. The list presents names only; it does not fetch saved
AXAML or render previews.

Preview is a manual request through `shared/api/image-render/` for the current
nonblank unsaved AXAML in either editor mode. The pane starts empty. A new
request or AXAML edit invalidates older output; the page accepts only a
nonempty `image/png` Blob for the current
text and revokes its object URL on replacement, edit, Cancel, or destruction.
An unrenderable draft gets generic retryable feedback. Preview allows at most
2,048 UTF-16 code units and a 2,048-byte encoded JSON request; Save remains
independent and permits up to 16,384 UTF-16 code units.

## Shared Controls

[Shared components](../../src/ui/src/app/shared/components/) keep Material UI
dependencies behind app-owned contracts. `Button` is a native action with filled,
outlined, or text appearance, a destructive filled style, and full-width sizing.
`ButtonLink` is a routed anchor with the same appearances and an optional
decorative local icon. `Input` binds a typed string
form control to a labeled single-line or multiline field. Its caller owns
validation and supplies hint or error text.

`Alert` presents success or error text with the corresponding status or alert
role. `ProgressBar` shows labeled indeterminate work with one polite pending
announcement. Pages own request state and any preview object URL lifetime.
`ConfirmDialogService` opens an app-owned confirmation with configurable plain
text and normal or destructive intent. Cancel, Escape, backdrop dismissal, and
navigation do not confirm an action. The caller owns any resulting API request.

## Startup And Requests

Public JSON loads before Angular starts. MSAL initialization and redirect
completion finish before routing. All routes need valid configuration.

MSAL uses authorization code flow with PKCE and a session-storage cache.
The interceptor acquires an API access token only for the configured API
origin/path boundary. Interaction-required renewal redirects; other token
failures stop the request. Route guards govern presentation, while the API
authorizes rendering.

The generator and template editor each own their PNG object URL lifetime. The
editor uses the authenticated preview endpoint without reading or writing a
saved template.

See [runtime configuration](development/configuration.md),
[API contract](../api/endpoints.md), and [development standards](development/development-guidelines.md).
