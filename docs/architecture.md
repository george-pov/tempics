# Current Architecture

Tempics provides Entra sign-in, rendering of a bundled AXAML sample, storage of
user-owned AXAML template text, and preview of an unsaved draft. It does not
render saved templates, upload assets, or persist generated images.
The intended capabilities belong in [Product target](product.md).

## Flow

Browser configuration -> Entra sign-in -> API access token -> sample request
-> application handler -> bundled AXAML renderer -> PNG.

Current draft -> authenticated preview request -> application handler -> shared
Avalonia renderer -> PNG. The preview path reads no saved row.

Authenticated template requests -> application handlers -> Azure Tables adapter
-> the caller's partition in the dedicated `Templates` table. Listing reads only
IDs and names; detail reads saved text. Saved AXAML never enters a render path.

The Angular UI owns navigation and presentation. The .NET isolated Azure
Functions API owns authentication, authorization, orchestration, and HTTP
responses. The sample route loads bundled AXAML; the preview route sends the
current request's AXAML to the same renderer in the Function process.

## Boundaries

- Browser configuration is public; it contains no tokens or secrets.
- API bearer validation and scope checks authorize HTTP operations. CORS
  separately controls browser origins.
- Rendering is serialized and fixed-size. The preview route accepts a request
  body of at most 2,048 bytes with at most 2,048 UTF-16 code units of AXAML and
  renders it in the Function process. The renderer is not an AXAML
  sandbox and has no hard render deadline or separate memory limit.
- Hosted Function host/package storage, UI website storage, and template data
  storage use separate accounts. The Function managed identity accesses the
  template account. Local host and template storage share an Azurite development
  account; callers cannot choose a storage partition.
- Runtime storage identity, application Entra identity, and GitHub publishing
  identity have separate responsibilities.

## Source And Details

- [UI architecture](ui/architecture.md): `src/ui/`.
- [API architecture](api/architecture.md): `src/api/Tempics.slnx`.
- [Operations](operations/README.md): current Bicep and workflow procedures.
- [Local setup](getting-started.md): run the application.

Repository definitions describe the deployment design, not live environment health.
