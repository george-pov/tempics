# Component Lab

Component Lab is the visual workbench for shared Tempics UI components. Start
the UI with `npm start` from `src/ui/`, then open
`http://localhost:4200/component-lab`.

The route is public and included in production builds. It is lazy loaded,
uses local demonstration state, and requires no API, account, or stored user
data. Reloading the page restores the first registered lab and resets examples.

## Using The Workbench

Open Component Lab from the application header after signing in,
or visit `/component-lab` directly in either mode. It shares the same layout as
Home and Image Generator; the header's Image Generator link returns to the sample
image page at `/image-generator`.

Select a component from the left navigation at widths of 768px and above.
At narrower widths, use the Components menu. The first entry opens by default.

Button lab demonstrates the existing `app-button` contract:

- Filled buttons with short and longer projected labels.
- Enabled activation with a visible click counter and a disabled example.
- Native `button`, `submit`, and `reset` types in a local form. Edit the sample
  label, then use Reset to restore it. Submit updates feedback without navigation.

Use the lab to inspect spacing, wrapping, hover, pressed, disabled, and visible
keyboard focus states. Check Tab navigation and Enter/Space activation at wide
and narrow widths, and check browser zoom. These manual checks complement the
automated component tests; the lab is not an automated visual regression suite.

## Adding A Lab

1. Create `<name>-lab/` under `src/ui/src/app/pages/component-lab/` with a
   standalone OnPush component and its template.
2. Render the real shared component with representative supported inputs and
   states. Use local signals or fixed fixtures for interactions.
3. Use `LabPage` for the component heading and `LabExample` for named examples.
   Give each section a unique `titleId`; use `itemsLayout="inline"` for wrapping
   rows of examples. Keep these helpers local to the lab.
4. Add the component and its label to `lab-registry.ts`. Both navigation
   presentations and the selected example panel use this registry.
5. Validate the component's meaningful behavior in its colocated tests and
   inspect the lab in a browser after styling or component changes.

Use shared styling tokens and layout utilities so examples inherit the actual
application theme. Fix component appearance in the shared component or theme;
keep lab styles limited to workbench presentation. Do not add APIs to a shared
component solely to reproduce an example from another project.

See [styling guidance](styling.md), [testing guidance](testing.md), and
[build and test commands](build-and-test.md).
