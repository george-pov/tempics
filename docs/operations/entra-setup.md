# Entra Setup

Use the intended External ID tenant and an administrator able to manage
registrations, user flows, and consent. Reuse existing registrations.
Application identity is separate from GitHub's Azure deployment identity.

## Configure Registrations

1. Register/reuse a single-tenant API (`Tempics API - Dev` for development).
   Accept v2 access tokens and expose the delegated `Images.Render` scope.
2. Register/reuse a single-tenant SPA (`Tempics SPA - Dev`). Register its
   localhost and hosted root URLs as SPA redirects. Use authorization code
   flow with PKCE; no client secret or implicit grant.
3. Configure an email/password sign-up and sign-in user flow, collecting email
   and optional display name. Link the SPA to it.
4. Give the SPA the API's delegated scope and grant administrator consent.
   Assign permitted accounts if the enterprise application requires assignment.

Neither application needs Microsoft Graph permission for this flow.
The API needs no client secret, redirect URI, or downstream token cache.

## Supply Settings

- UI: SPA client ID, external authority, registered root redirect/logout URL,
  and full exposed API scope URI.
- API: external tenant GUID, API client ID, authority instance, and exact issuer
  from the tenant's v2 OpenID discovery document.

The API client ID differs from the SPA/deployment identity. Discovery and issuer
hosts can differ; read the issuer rather than constructing it from the UI URL.

Field definitions: [UI JSON](../ui/development/configuration.md) and
[API settings](../api/authentication.md#configuration).
Store actual IDs/URLs in environment configuration, not tracked documentation.

Continue with [local setup](../getting-started.md) or
[hosted setup](README.md). Verify sign-in and API access after startup; for
failures, check redirect, user-flow association, account access, scope, and
consent before changing registrations.

## References

- [App registration](https://learn.microsoft.com/en-us/entra/identity-platform/quickstart-register-app)
- [API permission setup](https://learn.microsoft.com/en-us/entra/identity-platform/quickstart-configure-app-access-web-apis)
- [User-flow application link](https://learn.microsoft.com/en-us/entra/external-id/customers/how-to-user-flow-add-application)
- [External ID token-version requirements](https://learn.microsoft.com/en-us/entra/external-id/customers/troubleshooting-known-issues)
