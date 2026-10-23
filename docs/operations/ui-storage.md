# UI Hosting Contract

[ui-storage.bicep](../../bicep/ui-storage.bicep) defines the separate UI storage
account and static website. Read its address from `uiWebsiteUrl`; do not infer
the regional hostname or put environment URLs in tracked docs.

## Content

- `$web` contains public compiled assets and runtime JSON.
- `index.html` is the entry; `404.html` is a standalone error page.
- Each supported direct route has an explicit entry blob and directory index,
  copied from the root entry. The [UI workflow](../../.github/workflows/deploy-ui.yml)
  owns the route list.
- There is no general SPA rewrite. Missing assets/configuration return 404.
- Serve HTML, JSON, and assets with correct MIME types, including font/woff2.
  Configuration must not redirect or fall back to HTML.
- Current uploads use Cache-Control: no-store.

## Access And Recovery

The account requires HTTPS and disables Shared Key and ordinary anonymous blob
access. Static website content remains public despite the private container.
Publish using Azure login with a grant scoped to `$web`; Owner alone does not
grant blob data access.

Bicep creates settings/container, not files or per-blob content properties.
An empty provisioned website returns 404. [GitHub setup](github-setup.md) owns
publishing access; operator grants are separate.

Uploads are non-atomic and retain old assets. Check direct-route reloads, JSON,
MIME types, and missing-file behavior after publication. Follow
[deployment verification/recovery](deployment.md); API CORS and sign-in are
separate from website publication.
