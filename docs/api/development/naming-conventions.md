# API Naming

## Identifiers

- Use intent-revealing names and one consistent term per concept.
  Avoid generic Manager, Processor, Data, Info, Helper, Utils, and Common names.
- Default to at most 24 characters. Names of 25-28 characters need a readability
  justification; do not introduce repository-owned names above 28.
  Provider/compatibility names retain their required spelling.
- Let namespaces and containing types carry context. Match each file to one
  primary public concept; organize namespaces by boundary and product concept.
- Use PascalCase for types, namespaces, public members, constants, events, and
  positional record parameters; camelCase for parameters, locals, and local functions;
  _camelCase for explicit private instance fields.
- Prefix interfaces with I and descriptive generic parameters with T.
- Use nouns for types/properties, verbs for methods, affirmative booleans, and
  plural collection names without a List suffix.
- Use Id, Utc, Json, Url, Api, OAuth, Axaml, and Png consistently.
- End task-returning methods with Async; name cancellation parameters cancellationToken.
- Provider names belong at integration boundaries, not on product-owned domain concepts.

## Roles

Use `{Verb}{Thing}Query/Command/Handler/Result` for use cases,
`{Verb}{Thing}Request/Response` for transport, `{Thing}Entity` for persistence,
`I{Thing}{Role}` for ports, `{Provider}{Thing}{Role}` for adapters, and
`{Scenario}Options` for configuration. Domain types use domain nouns.

Current examples: `RenderSampleQuery`, `RenderSampleHandler`,
`RenderImageResult`, `IBundledTemplateSource`, and `AuthOptions`.
Reserve Payload for opaque bytes/text or provider-owned content.

## Verbs

Get returns a required value; Find returns an optional value; List returns many.
Create, Update, Delete, and Save name writes. Render produces an image.
Validate checks rules; Map converts models; Parse fails on invalid input;
TryParse reports success; Load reads; Handle executes a use case.

Get, Find, List, and Validate must not mutate state.

## Test Names

Use `MethodName_Scenario_ExpectedBehavior`, such as
`HandleAsync_NoPng_Throws` or `Render_Sample_ReturnsPng`.
For generic entry points, the first segment may name the behavior.
Do not prefix names with Test.
