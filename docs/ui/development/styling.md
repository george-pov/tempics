# UI Styling

Tempics uses SCSS for application and component styles.

## Ownership

- Keep `src/ui/src/styles.scss` limited to resets, base typography, design
  tokens, the Material theme, local font declarations, and shared layout imports.
- Define shared tokens in `src/ui/src/styles/_variables.scss`, reusable mixins
  in `_mixins.scss`, and global layout utilities in `_layout.scss`.
- Keep component styles beside the component they own.
- Prefer component encapsulation over global selectors.
- Use `:host` for component display, sizing, layout participation, and
  host-level state.

## Naming

- Use short semantic component-local classes such as `.layout`, `.header`,
  `.content`, `.preview`, `.actions`, `.field`, and `.message`.
- Prefix rare global application classes with `app-`.
- Use readable state classes such as `.is-selected`, `.is-loading`, and
  `.has-error`.
- Do not introduce BEM-style `__` element or `--` modifier names.
- Do not name classes after incidental colors, positions, or DOM depth.

## Layout

- Use `.app-container` for centered content up to 72rem, with 1rem horizontal
  padding increasing to 2rem at 768px.
- Use `.app-grid` for a 12-column grid. Direct children span all 12 columns by
  default; `.app-col-1` through `.app-col-12` set explicit spans.
- Responsive spans use `.app-col-sm-N` (600px), `.app-col-md-N` (768px), and
  `.app-col-lg-N` (1024px), where `N` is 1 through 12.
- `.app-actions` wraps actions with a shared gap. Add `.app-actions-end` for
  end alignment or `.app-actions-stack-mobile` to stack below 600px.
- `.app-field-row` wraps fields while preserving their intrinsic widths.
- Spacing utilities use steps `0`, `1`, `2`, `3`, `4`, `6`, `8`, and `12`, each
  worth 0.25rem. Use `.app-gap-N`, `.app-m-N`, and `.app-p-N`; margin/padding
  support `t`, `r`, `b`, `l`, `x`, and `y` suffixes before the step, such as
  `.app-mb-0` or `.app-py-8`. Auto margins use `.app-mx-auto`, `.app-ml-auto`,
  and `.app-mr-auto`.
- Override local gaps with `--app-grid-gap`, `--app-actions-gap`, or
  `--app-field-row-gap`, or use the shared gap classes.
- Prefer native document flow when no layout primitive is needed.
- Prefer flexbox for one-dimensional alignment and spacing.
- Use CSS grid for genuinely two-dimensional layouts such as template galleries
  or editor panels.
- Avoid absolute positioning for ordinary page layout.
- Keep SCSS nesting shallow; two levels is the normal limit.
- Keep responsive behavior mobile-first and based on content needs rather than
  device names.

## Component Example

```scss
@use 'src/styles/variables' as *;
@use 'src/styles/mixins' as app;

@include app.page-host;

.layout {
  display: grid;
  gap: $app-space-4;

  .actions {
    display: flex;
    justify-content: flex-end;
  }

  &.is-loading {
    cursor: progress;
  }
}
```

## Libraries And Encapsulation

- Define the Material theme once in `styles.scss` with `mat.theme`: Azure
  primary, Blue tertiary, Roboto typography, and density zero. Do not also load
  a prebuilt theme through `angular.json`.
- Font files and provenance live under `src/ui/public/fonts/`. Roboto weights
  300, 400, and 500 and Material Symbols Outlined load from the same origin.
- Keep Material controls behind app-owned wrappers such as `app-button`.
- Use documented theming APIs, inputs, host classes, and CSS custom properties
  when styling a third-party UI library.
- Do not depend on generated or private library selectors.
- Avoid new `::ng-deep` usage.
- Wrap repeated third-party controls behind app-owned components when Tempics
  needs a stable shared contract.

## Accessibility

- Do not rely on color alone to communicate state.
- Preserve visible focus and sufficient contrast.
- Respect user motion preferences for nonessential animation.
- Keep text usable under browser zoom and narrow viewports.
- Use visually hidden content only for information that remains available to
  assistive technology.

Do not rename existing classes only for style preference. Move touched code
toward these rules when the change is safe and in scope.
