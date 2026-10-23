# UI Naming

## Files And Folders

- Use kebab-case and one primary concept per file. Match filenames to their
  TypeScript identifier; keep `.spec.ts` beside the code.
- Name folders by owner: page, layout, or shared capability. Match route folders
  to route paths where practical.
- Keep workflow state/types near its page; API clients and transport types belong
  in `shared/api/<domain>/`. Other behavior becomes shared when reused.
- Avoid catch-all utils, helpers, common, data, manager, or processor names.
- Default to at most 24 characters. Names of 25-28 characters need a readability
  justification; do not introduce repository-owned names above 28.
  Provider/compatibility names retain their required spelling.

## Components And Types

Use concise names such as `button.ts`, `Button`, and `app-button`.
Use app- kebab-case selectors; do not add .component or Component by default.
Add Page only to distinguish a routed container.

Use role names such as `ImageRenderApi` / `image-render-api.ts`,
`AuthSession` / `auth-session.ts`, and `RuntimeConfig` / `runtime-config.ts`.
Avoid .service, .model, .interface, and .type file suffixes.
Service is acceptable when it clearly describes a class role.

Request/Response name transport types; State names a state shape; Store names
its coordinator. Use Model only for a deliberate UI model.

## Members

- Use camelCase for functions/members/locals and PascalCase for types.
- Use affirmative boolean names and action names such as signIn instead of handleClick.
- Mark stable dependencies, inputs, outputs, signals, and configuration readonly;
  template-only members protected.
- Name pure utilities by behavior, such as `validate-config.ts`.

Do not rename existing code solely for style. See [styling](styling.md) for CSS names.
