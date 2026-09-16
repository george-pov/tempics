# UI On Azure Storage

The dev Angular UI is hosted by the static website feature of the dedicated
`sttempicsuidev` storage account in `rg-tempics-dev`, West US 2. The account uses
StorageV2 and Standard_LRS. It is separate from the Function's storage account.

Read the website address from the `uiWebsiteUrl` deployment output. Keep actual
environment URLs in local configuration or deployment notes.

## Hosting Contract

- `$web` contains public compiled UI assets and public dev `config.json`.
- The index document is `index.html`; the error document is `404.html`.
- Known route `/component-lab` has an explicit entry blob and a directory
  `index.html`, copied from the root entry page. Keep these aligned on deployment.
- Missing assets and configuration return HTTP 404. The error page does not load
  Angular. Storage has no general SPA rewrite configuration; add entry blobs for
  future routes or design a separate routing layer when needed.
- Deployment sets blob content types and `Cache-Control: no-store`. This simple
  dev policy also avoids stale entry pages/configuration during manual updates.
- The account requires HTTPS/TLS 1.2 and disables Shared Key and ordinary public
  blob access. Static website files remain publicly readable at the web endpoint.
- Uploads use Azure login. The operator's Storage Blob Data Contributor role is
  scoped to `$web`; resource administration remains separate.
- API calls use the absolute URL in runtime JSON. CORS rules are configured
  manually on the API. Hosting these files does not implement Entra sign-in or
  authorize calls to the Function-key-protected sample endpoint.

## Provision Infrastructure With Bicep

Run the subscription deployment in [the Azure infrastructure guide](azure-dev.md).
`bicep/dev.bicepparam` selects `sttempicsuidev`; `bicep/main.bicep` creates the
resource group and includes `bicep/ui-storage.bicep` through the resource module.

The UI module declares the account, Blob service static website settings, and
private `$web` container. It sets the index/error document names directly through
storage API version 2025-08-01. No CLI deployment script, account key, website
upload, or extra website-enable command is required.

The same subscription deployment creates the infrastructure when the group is
absent. It also updates an existing group without uploading or deleting UI blobs.
An empty site returning 404 is expected after fresh provisioning. The actual
website URL is returned as `uiWebsiteUrl`; do not infer its regional suffix.

## Application Pipeline Boundary

The [GitHub UI workflow](github-dev.md#ui-publication-and-verification) owns
repeatable UI publication. It implements this sequence:

1. Build/test the UI and retain a configuration-free compiled artifact.
2. Generate dev `config.json` in a separate package with `package:site`, which
   reuses the existing config writer and explicit public environment variables.
3. Include `404.html` and the current route entry copies for Component Lab.
4. Upload the reviewed package to `$web` using Azure login and a scoped identity.
5. Set and verify content types, including `font/woff2` and `text/html` for the
   extensionless Component Lab entry, and `Cache-Control: no-store` for config.
6. Verify startup and route reloads after publication.

The dedicated manual access template defines the publishing identity's Storage
Blob Data Contributor grant on `$web`. Apply it and configure GitHub separately
before the first UI dispatch. A resource Owner role alone does not
provide blob data access. The manually assigned operator role from the first
publication is not embedded in Bicep or restored during group recreation.

Bicep does not build Angular, generate runtime JSON, upload entry pages/assets,
set blob content properties, configure GitHub, or change API CORS. See
[runtime configuration](../ui/development/configuration.md) for the shared
configuration contract. Keep deployment artifacts free of local settings,
source maps, Function keys, and tokens.

## Verify And Recover

After infrastructure creation, verify the account security properties, the
enabled website/index/error settings, and the private `$web` container. An empty
website returning 404 is expected until the application pipeline publishes it.

After application publication, check HTTPS `/`, `/config.json`, `/component-lab`,
and `/component-lab/` plus the
referenced scripts/styles/fonts. Confirm JSON MIME type and `no-store`, and
confirm an unknown config-like path returns 404 without application fallback.
Open Home and reload Component Lab in a browser. API CORS and authenticated
rendering require separate Azure dev integration checks.

For a failed upload, inspect the error and repeat the reviewed package upload.
For bad configuration, correct process inputs, regenerate JSON, and republish it.
For rollback, republish a compatible saved application/configuration pair.
Do not delete the API's storage or resource group as website recovery.

Retain the `ui-dev-<commit>-<run-id>-<attempt>` artifact before its 14-day expiry.
Use `Publish-Ui.ps1` with its `package/` and `blobs.json`; `-InspectOnly` checks
all hashes, MIME types, paths, and blob aliases without contacting Azure. Asset
uploads precede config and entry documents; root `index.html` is last. Upload
is not atomic, and old hashed assets remain available. The map and source
manifest stay outside public storage. See the
[UI workflow runbook](github-dev.md#ui-publication-and-verification) for commands.

## Reference

[Azure Storage static website hosting](https://learn.microsoft.com/en-us/azure/storage/blobs/storage-blob-static-website)
