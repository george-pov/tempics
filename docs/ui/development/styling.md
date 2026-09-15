# UI Styling

Tempics uses SCSS for application and component styles.

## Ownership

- Keep `src/ui/src/styles.scss` limited to resets, base typography, design
  tokens, and genuinely application-wide utilities.
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
:host {
  display: block;
}

.layout {
  display: grid;
  gap: 1rem;

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
