# UI Naming Conventions

Naming conventions for the Tempics Angular frontend.

## General Rules

- Use kebab-case for folders and file names.
- Match a file name to its primary TypeScript identifier.
- Keep one primary concept per file.
- Keep tests beside the code under test with `.spec.ts`.
- Avoid generic names such as `utils.ts`, `helpers.ts`, `common.ts`, `data`,
  `manager`, and `processor`.
- Keep repository-owned names at 24 characters or fewer by default. Names from
  25 through 28 characters require a clear readability justification. Do not
  create repository-owned names longer than 28 characters.
- Provider-defined names and compatibility contracts may retain their required
  spelling and length.

## Folders

Folder names describe a route, page flow, layout, or shared capability:

```text
layout/app-layout/
pages/templates/
pages/template-editor/
pages/assets/
pages/render/
shared/api/
shared/auth/
shared/components/
shared/config/
```

Keep feature-owned types and services near their page flow. Move them to
`shared/` only after more than one feature owns the dependency.

## Components

Use Angular's concise file and class naming for new components:

```text
template-editor.ts
template-editor.html
template-editor.scss
template-editor.spec.ts
```

The folder, file, primary class, and selector describe the same concept:

```text
shared/components/image-preview/image-preview.ts
ImagePreview
app-image-preview
```

Use the `app-` selector prefix and kebab-case selectors. Do not add `.component`
to new file names or `Component` to class names by default. Existing names do
not require churn-only renaming.

## Routes And Pages

Route-owned folders should mirror route paths where practical. Do not append
`Page` unless it distinguishes a routed container from another concept.

Prefer:

```text
pages/templates/templates.ts
pages/template-editor/template-editor.ts
```

## Services, Models, And Types

Choose a role or data-shape name, then mirror it in kebab-case:

```text
TemplatesApi          templates-api.ts
TemplateEditorStore   template-editor-store.ts
TemplateSummary       template-summary.ts
RenderImageRequest    render-image-request.ts
```

Do not add dot-separated artifact suffixes such as `.service`, `.model`,
`.interface`, or `.type` to new files. A class may include `Service` when that
is the clearest role name.

Use `Request` and `Response` for HTTP boundary messages. Use `Model` only when
it identifies an intentional UI model rather than a generic data container.
Use `State` for a state shape and `Store` for an owner that coordinates state.

## Functions And Members

- Use `camelCase` for functions, methods, properties, parameters, and local
  variables.
- Use `PascalCase` for classes, interfaces, type aliases, and enums.
- Name booleans affirmatively with `is`, `has`, `can`, or `should`.
- Name event handlers for the action they perform, such as `saveTemplate` or
  `selectAsset`, rather than generic `handleClick` names.
- Mark stable dependencies, inputs, outputs, signals, and configuration
  `readonly`.
- Use `protected` for members read only by the template.
- Name pure utilities by behavior, such as `buildRenderRequest.ts`; do not
  create catch-all utility files.

## Styles

Use the class naming and state conventions in [`styling.md`](styling.md).
