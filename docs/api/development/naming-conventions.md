# API Naming Conventions

Naming conventions for Tempics .NET code.

## General Rules

- Use names that reveal intent at declaration and call sites.
- Prefer one consistent word for each concept.
- Avoid generic names such as `Manager`, `Processor`, `Data`, `Info`, `Helper`,
  `Utils`, and `Common` when a product or role name is available.
- Keep repository-owned names at 24 characters or fewer by default. Names from
  25 through 28 characters require a clear readability justification. Do not
  create repository-owned names longer than 28 characters.
- Provider-defined names and compatibility contracts may retain their required
  spelling and length.
- Let namespaces and containing types carry context instead of repeating every
  concept in an identifier.

## C# Casing

- Use `PascalCase` for namespaces, types, public members, constants, events, and
  record positional parameters.
- Use `camelCase` for parameters, local variables, and local functions.
- Use `_camelCase` for private instance fields when an explicit field is
  needed.
- Prefix interfaces with `I`.
- Prefix descriptive generic parameters with `T`, such as `TCommand`.
- Use `Id`, `Utc`, `Json`, `Url`, `Api`, `OAuth`, `Axaml`, and `Png`
  consistently.
- Use nouns for types and properties. Use verbs for methods.
- Use affirmative names for booleans, such as `IsValid`, `CanRender`, and
  `HasAccess`.
- Use plural nouns for collections instead of suffixing them with `List`.
- End task-returning asynchronous methods with `Async`.
- Name cancellation parameters `cancellationToken`.

## Layer Patterns

Use short role-based names:

| Boundary | Pattern | Example |
| --- | --- | --- |
| Domain | Domain noun or value object | `Template`, `TemplateParameter` |
| Command | `{Verb}{Thing}Command` | `CreateTemplateCommand` |
| Query | `{Verb}{Thing}Query` | `GetTemplateQuery` |
| Handler | `{Verb}{Thing}Handler` | `RenderImageHandler` |
| Result | `{Verb}{Thing}Result` | `RenderImageResult` |
| HTTP request | `{Verb}{Thing}Request` | `CreateTemplateRequest` |
| HTTP response | `{Verb}{Thing}Response` | `CreateTemplateResponse` |
| Persistence entity | `{Thing}Entity` | `TemplateEntity` |
| Application port | `I{Thing}{Role}` | `ITemplateRepository` |
| Provider adapter | `{Provider}{Thing}{Role}` | `AzureAssetRepository` |
| Configuration | `{Scenario}Options` | `RenderOptions` |

Use `Request` and `Response` for strongly typed transport messages. Use
`Command`, `Query`, and `Result` for application use cases. Reserve `Payload`
for opaque text, bytes, or provider-owned content.

## Operation Verbs

Use verbs consistently:

| Verb | Meaning |
| --- | --- |
| `Get` | Return one required existing value without mutation. |
| `Find` | Search for an optional value. |
| `List` | Return multiple existing values. |
| `Create` | Create a resource. |
| `Update` | Change an existing resource. |
| `Delete` | Remove a resource. |
| `Render` | Produce an image from a template and parameter values. |
| `Validate` | Check rules without mutation. |
| `Map` | Convert between boundary models. |
| `Parse` | Convert text to a typed value and fail when invalid. |
| `TryParse` | Attempt parsing and return a success indicator. |
| `Load` | Read configuration, storage, or an owned resource. |
| `Save` | Persist an application-owned value. |
| `Handle` | Execute an application command or query. |

A method named `Get`, `Find`, `List`, or `Validate` must not create, update, or
delete state.

## Files And Namespaces

- Keep one primary public concept per file and match the file name to it.
- Organize namespaces by application boundary and product concept.
- Use provider names such as `Azure` or `Avalonia` only at infrastructure or
  integration boundaries.
- Do not put provider names on domain concepts owned by Tempics.

## Test Names

Use `MethodName_Scenario_ExpectedBehavior` with PascalCase segments separated
by underscores:

```csharp
RenderAsync_UnknownAsset_ReturnsValidationFailure()
CreateTemplate_DifferentOwner_ReturnsForbidden()
```

For generic entry points such as `HandleAsync`, the first segment may name the
behavior when that makes the test clearer. Do not prefix test names with
`Test`.
