# Component Lab

After [local setup](../../getting-started.md), open
`http://localhost:4200/component-lab`. The route is public, included in production,
and needs valid startup configuration. Examples use local state without API calls
or user data.

Select a component from the navigation. Reload resets its examples. Use the lab
to inspect supported states, narrow/wide layouts, zoom, focus, and keyboard
activation. Automated behavior checks stay in component tests.

## Add Or Update A Lab

1. Create an OnPush example component under
   `src/ui/src/app/pages/component-lab/`.
2. Render the real shared control with representative inputs and local fixtures.
3. Use the local `LabPage` and `LabExample` helpers; each example needs a unique
   `titleId`. Use `itemsLayout="inline"` for wrapping rows.
4. Register the example in
   [lab-registry.ts](../../../src/ui/src/app/pages/component-lab/lab-registry.ts).
5. Check keyboard behavior and appearance after changing the shared control.

Keep lab helpers local. Fix control styling in the control/theme, and do not
add control APIs solely for a demonstration. Follow [styling](styling.md) and
[testing](testing.md).
