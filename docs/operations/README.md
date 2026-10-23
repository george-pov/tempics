# Operations

These guides describe the repository's current infrastructure and deployment
procedures. They do not certify that a hosted environment is configured or healthy.

## Initial Environment Setup

1. [Configure Entra](entra-setup.md): registrations, user flow, scope, consent,
   and API/UI configuration values.
2. [Provision infrastructure](infrastructure.md): development resource group,
   Function, storage, monitoring, and runtime identity grants.
3. [Configure GitHub deployment access](github-setup.md): federated publishing
   identity, scoped roles, branch restriction, and Environment variables.
4. [Deploy and verify the API](deployment.md): publish the protected API and
   check rejection/authenticated rendering.
5. Configure the API's exact UI CORS origin, then
   [deploy and verify the UI](deployment.md#verify-the-applications).

The application workflows are independent. Enforce the API-first sequence
manually for initial setup; a push to main starts both workflows.

## Routine Tasks

| Task | Guide |
| --- | --- |
| Publish API or UI and recover a failed run | [Application deployment](deployment.md) |
| Change infrastructure or inspect provisioning limits | [Development infrastructure](infrastructure.md) |
| Configure deployment permissions or Environment variables | [GitHub setup](github-setup.md) |
| Configure sign-in, redirects, or API scope | [Entra setup](entra-setup.md) |
| Publish or recover a Function package manually | [Manual API deployment](manual-api-deployment.md) |
| Inspect static route, MIME, cache, and configuration behavior | [UI hosting contract](ui-storage.md) |

Application identity, runtime storage identity, and GitHub publishing identity
have separate responsibilities. Settings and public contract definitions remain
in the [API authentication](../api/authentication.md) and
[UI configuration](../ui/development/configuration.md) references.

For local development, use [Run locally](../getting-started.md).
Return to the [documentation index](../README.md).
