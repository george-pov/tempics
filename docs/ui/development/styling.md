# UI Styling

Use component-scoped SCSS and shared tokens. The source owns exact token values,
breakpoints, utility classes, theme colors, and font declarations.

## Ownership

- [styles.scss](../../../src/ui/src/styles.scss): resets, typography, Material
  theme, fonts, and shared imports.
- [styles/](../../../src/ui/src/styles/): tokens, mixins, and layout utilities.
- Component styles: local appearance and layout.

Prefer encapsulation; use :host for component sizing and layout participation.
Use AppLayout's outer container and main landmark without duplicating them.
Use the existing app-grid, spacing, and action utilities where they fit.

## Rules

- Use short semantic local classes and app- for global classes.
  State classes use is- or has-. Avoid BEM __/-- names and incidental color/position names.
- Prefer normal flow, flexbox for one dimension, and grid for two dimensions.
  Avoid absolute positioning for ordinary layout.
- Keep nesting shallow and responsive behavior mobile-first and content-driven.
- Define the Material theme once with its supported Sass API; do not combine it
  with a prebuilt theme.
- Keep shared Material controls behind app-owned wrappers.
  Use supported inputs/theming APIs rather than private selectors or new ::ng-deep.
- Keep fonts local with provenance under `src/ui/public/fonts/`.
- Preserve contrast, focus, keyboard use, zoom, and narrow layouts. Do not rely
  on color alone; respect reduced motion and accessible hidden-text behavior.
- Avoid churn-only class renaming.

Check shared appearance in [Component Lab](component-lab.md).
