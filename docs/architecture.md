# Current Architecture

Tempics provides Entra sign-in and rendering of a bundled AXAML sample.
It does not accept user templates, upload assets, or persist user-owned images.
The intended capabilities belong in [Product target](product.md).

## Flow

Browser configuration -> Entra sign-in -> API access token -> sample request
-> application handler -> Avalonia renderer -> PNG preview.

The Angular UI owns navigation and presentation. The .NET isolated Azure
Functions API owns authentication, authorization, orchestration, and HTTP
responses. Only a packaged template reaches the renderer.

## Boundaries

- Browser configuration is public; it contains no tokens or secrets.
- API bearer validation and scope checks authorize rendering. CORS separately
  controls browser origins.
- Rendering is serialized and fixed-size. It is not a sandbox for arbitrary AXAML.
- Azure Function host/package storage and UI website storage are separate.
  Neither is application-data persistence.
- Runtime storage identity, application Entra identity, and GitHub publishing
  identity have separate responsibilities.

## Source And Details

- [UI architecture](ui/architecture.md): `src/ui/`.
- [API architecture](api/architecture.md): `src/api/Tempics.slnx`.
- [Operations](operations/README.md): current Bicep and workflow procedures.
- [Local setup](getting-started.md): run the application.

Repository definitions describe the deployment design, not live environment health.
