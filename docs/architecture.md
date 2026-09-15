# Architecture Overview

Tempics is a full-stack web application for creating reusable image templates
in Avalonia AXAML and rendering them as PNG images. The application is hosted
on Microsoft Azure and is split into a browser frontend and a serverless API.

## Ownership

This document is the source of truth for the shared system shape, component
responsibilities, runtime flow, Azure hosting boundary, and security boundaries.
Update it when those concerns change.

## Product Flow

1. A user signs in with a Microsoft Entra account.
2. The user uploads reusable assets, such as logos, backgrounds, and photos.
3. The user creates one or more image templates in AXAML.
4. The template defines parameters for values that can change, including text
   and images.
5. The user selects a template and supplies values for its parameters.
6. Tempics renders the completed template and returns a PNG image.

## System Responsibilities

- The Angular 22 frontend owns browser presentation, navigation, template
  editing, asset selection, parameter input, and result display.
- The Azure Functions v4 API, running on the .NET 10 isolated worker, owns API
  contracts, validation, authorization, orchestration, and persistence access.
- Microsoft Entra ID owns user authentication. The API owns authorization and
  enforces per-user access to templates, assets, and generated images.
- The Avalonia UI rendering component loads an allowed AXAML template, binds
  validated parameter values and assets, and produces PNG output.
- Azure storage services hold application metadata, uploaded assets, and any
  generated images that require durable retention.

## Runtime Flow

```text
Browser
  -> Microsoft Entra sign-in
  -> Angular application hosted on Azure
  -> authenticated Azure Functions API
  -> template, asset, and parameter validation
  -> constrained Avalonia AXAML renderer
  -> PNG result
```

The frontend may validate inputs for responsiveness, but the API remains the
authority for ownership, accepted template syntax, parameter contracts, render
limits, and persisted state.

## Azure Hosting

Tempics runs on Microsoft Azure. The deployed application includes the Angular
frontend, the Azure Functions API, Microsoft Entra integration, Azure-hosted
storage, monitoring, and deployment infrastructure.

Infrastructure definitions must keep environments reproducible and must keep
application data, identities, credentials, and configuration isolated between
environments. Deployment identities should receive only the permissions needed
for their deployment scope. Runtime components should use managed identities
where supported instead of stored credentials.

## Security Boundaries

AXAML templates, parameter values, and uploaded assets are untrusted input.
The rendering boundary must:

- allow only explicitly supported controls, markup extensions, resource
  references, and URI schemes;
- prevent filesystem, network, environment, secret, and cross-user access;
- validate upload type, size, dimensions, and ownership;
- enforce render time, memory, image-dimension, and output-size limits; and
- return safe validation errors without exposing internal paths, configuration,
  credentials, or another user's data.

## Repository Layout

- `src/ui/`: Angular frontend workspace.
- `src/api/Tempics/`: .NET Azure Functions solution.
- `docs/`: durable human-facing documentation.

Boundary-specific guidance lives in the API and UI documentation:

- API architecture: [`api/architecture.md`](api/architecture.md)
- UI architecture: [`ui/architecture.md`](ui/architecture.md)
