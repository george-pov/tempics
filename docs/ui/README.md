# UI Docs

Durable documentation for the Angular frontend under `src/ui/`.

## Ownership

- Source of truth: frontend structure, coding rules, naming, styling, testing,
  and local commands.
- Update when: UI boundaries, development practices, or indexed files change.
- Validate with: compare this index against `rg --files docs/ui`, verify links,
  and run `git diff --check`.

## Contents

- Architecture: [`architecture.md`](architecture.md)
- Development guidelines:
  [`development/development-guidelines.md`](development/development-guidelines.md)
- Naming conventions:
  [`development/naming-conventions.md`](development/naming-conventions.md)
- Styling guidance: [`development/styling.md`](development/styling.md)
- Testing guidance: [`development/testing.md`](development/testing.md)
- Build and test commands:
  [`development/build-and-test.md`](development/build-and-test.md)

## Scope

UI docs own:

- Browser routes, pages, components, forms, accessibility, and interaction
  state.
- Typed API clients and browser-side contract mapping.
- Frontend development, naming, styling, build, test, and deployment guidance.

Backend HTTP contracts, authorization, persistence, rendering, and Azure
Functions guidance belong in [`../api/`](../api/).
