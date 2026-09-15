# API Docs

Durable documentation for the backend API under `src/api/Tempics/`.

## Ownership

- Source of truth: backend structure, coding rules, naming, testing, and local
  commands.
- Update when: API boundaries, development practices, or indexed files change.
- Validate with: compare this index against `rg --files docs/api`, verify links,
  and run `git diff --check`.

## Contents

- Architecture: [`architecture.md`](architecture.md)
- Development guidelines:
  [`development/development-guidelines.md`](development/development-guidelines.md)
- Naming conventions:
  [`development/naming-conventions.md`](development/naming-conventions.md)
- Testing guidance: [`development/testing.md`](development/testing.md)
- Build and test commands:
  [`development/build-and-test.md`](development/build-and-test.md)

## Scope

API docs own:

- Azure Functions host behavior and composition.
- HTTP routes, authentication, authorization, request, response, and error
  contracts.
- Application and domain placement rules.
- Rendering, persistence, Azure service, and external adapter boundaries.
- Backend development, build, test, configuration, and deployment guidance.

Routes, pages, forms, browser state, and frontend development guidance belong
in [`../ui/`](../ui/).
