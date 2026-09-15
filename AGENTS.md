# AGENTS.md

Root instructions for agents working in the Tempics repository.

## Purpose

This file is the root navigation and operating policy for agents. It contains
repository lineage, workflow rules, and task routing. It must not duplicate
durable architecture documents or individual feature records.

Use this hierarchy:

1. `AGENTS.md`: agent policy, repository context, and task routing.
2. `README.md`: concise human-facing table of contents for durable docs.
3. `docs/`: durable product, architecture, API, UI, development, and
   operations documentation.
4. `.work/`: local-only agent workflow records, feature plans, task lists,
   validation notes, reviews, decisions, and transient artifacts.

Do not reference `.work/` from `README.md` or durable documents under `docs/`.

## Read Order

Before changing code:

1. Read this file.
2. Read `docs/README.md` and the relevant durable documents.
3. Inspect the relevant source, project, and test files.
4. Inspect matching records under `.work/features/` with hidden and ignored
   files included.
5. Check the worktree with `git status --short` and preserve unrelated changes.

For narrow documentation changes, read this file, the files being changed, and
any directly relevant `.work` record.

## Task Routing

- Feature planning: inspect durable docs, current source, and the matching
  `.work/features/` record, then follow the feature-record and approval rules
  below.
- Implementation: read the approved `plan.md` and `tasks.md`, confirm execution
  approval, and update the task checkboxes and validation record as work
  proceeds.
- Frontend changes: read `docs/architecture.md`, `docs/ui/architecture.md`,
  `docs/ui/development/development-guidelines.md`,
  `docs/ui/development/naming-conventions.md`, and the relevant testing or
  styling guidance, then inspect `src/ui/` and affected API contracts.
- API, rendering, persistence, authentication, or Azure changes: read
  `docs/architecture.md`, `docs/api/architecture.md`,
  `docs/api/development/development-guidelines.md`,
  `docs/api/development/naming-conventions.md`, and
  `docs/api/development/testing.md`, then inspect `src/api/Tempics/` and all
  affected consumers.
- Reviews: compare source, tests, durable docs, the approved feature plan, and
  task completion state. Record feature-specific findings in `review.md`.
- Validation: record feature-specific evidence in `validation.md` and move only
  durable operational guidance into `docs/`.

## Repository Context

Tempics is based on ideas and experience from
[Html2B](https://github.com/george-pov/html2b). It became a separate project
after establishing that Avalonia UI can render XAML-based visual templates,
expressed as AXAML, to PNG images.

Html2B is historical and technical reference material, not part of the Tempics
product story. Do not mention Html2B in `README.md`, durable product docs, or
user-facing product copy.

Do not copy Html2B assumptions without validating them for Tempics. Tempics has
authenticated user accounts and per-user data. Authentication and authorization
must preserve ownership boundaries for templates, assets, and generated images.

## Repository Boundaries

- `src/ui/`: Angular 22 frontend workspace.
- `src/api/Tempics/`: Azure Functions v4 API using the .NET 10 isolated worker.
- `docs/`: tracked, durable human-facing documentation.
- `.work/`: ignored, local-only agent workflow and feature records.

Keep repository information in the correct location:

- Durable system behavior and architecture belong in `docs/`.
- Human-facing durable documentation navigation belongs in `README.md`.
- Agent workflow, implementation gaps, and transition notes belong in
  `AGENTS.md` or `.work/`.
- Feature-specific plans, task lists, decisions, validation, and reviews belong
  in `.work/features/`.

## Feature Records

Create one numbered folder for each feature:

```text
.work/features/
  001-example-feature/
    plan.md
    tasks.md
    decisions.md
    validation.md
    review.md
    notes.md
```

Folder names use `XXX-feature-name`, where `XXX` is the next zero-padded number
and the name is short lowercase kebab-case. Start at `001`. Determine the next
number by inspecting existing directories, including ignored files. Reuse an
existing folder when refining the same feature.

Required and optional records:

- `plan.md` is the required high-level design and phased delivery plan.
- `tasks.md` is created only after explicit plan approval and contains
  implementation-ready tasks with checkboxes.
- `decisions.md`, `validation.md`, `review.md`, and `notes.md` are optional and
  should exist only when they carry useful feature-specific information.

Use `P01`, `P02`, and so on for phases. Use sequential `T001`, `T002`, and so
on for tasks; do not restart task numbering per phase. Checkbox state in
`tasks.md` is the task-completion record.

Plans must state the goal, current state, target state, non-goals, decisions,
open questions, constraints, integration effects, security considerations,
validation, recovery, and explicit approval gate. Organize phases as small
end-to-end functional slices. `P01` should be the narrowest useful working path.

Tasks must mirror the approved phases and name the files and symbols to create,
modify, move, or delete. Include focused validation and observable proof in the
same phase as the behavior.

## Approval Gates

Planning, task design, implementation, live Azure changes, deployment,
destructive actions, and Git operations are separate authorization boundaries.

- A request to plan a feature authorizes only `plan.md` and required parent
  directories. Do not create `tasks.md` or modify application code.
- Create or update `tasks.md` only after the user explicitly approves the plan
  or directly asks for tasks against it.
- Do not implement tasks until the user explicitly approves task execution.
- Clarification, review, or agreement with a design is not implementation
  approval.
- Implementation approval does not authorize deployment, live Azure changes,
  destructive operations, commits, pushes, or pull requests.

During plan or task design, use read-only inspection. Do not run builds, tests,
restores, formatters, generators, migrations, application hosts, or other
commands that create artifacts.

## Target Product

- Host the application on Microsoft Azure.
- Implement the frontend with Angular 22.
- Implement the API as Azure Functions v4 using the .NET 10 isolated worker.
- Authenticate users with Microsoft Entra ID.
- Allow each user to create and manage multiple AXAML templates.
- Allow users to upload reusable profile assets, including images.
- Support template parameters such as text and images.
- Generate a PNG after the user selects a template and supplies parameter
  values.
- Use Avalonia UI for server-side AXAML rendering.

## Security Boundaries

Treat AXAML templates, parameter values, and uploaded assets as untrusted input.

- Restrict accepted AXAML controls, markup extensions, resource references,
  and URI schemes.
- Prevent templates from accessing the filesystem, network, environment,
  secrets, or another user's data.
- Validate upload type, size, dimensions, and ownership.
- Enforce per-user authorization on every template, asset, and generated-image
  operation.
- Apply render time, memory, image-dimension, and output-size limits.
- Keep credentials, tokens, connection strings, and user data out of source
  control, logs, documentation, and generated artifacts.

## Core Agent Rules

- Preserve user changes and do not revert unrelated modified files.
- Prefer small end-to-end slices that keep the solution buildable.
- Do not perform broad rewrites unless the user explicitly asks for them.
- Verify behavior from current source before describing it as implemented or
  tested.
- Keep `README.md` concise and focused on durable human-facing documentation
  navigation. Do not put repository history, agent instructions, implementation
  status, or transition language there.
- Update implementation, tests, and durable docs together when a contract
  changes.
- Treat frontend-backend request and response shapes as integration contracts.
- Use direct, concise language and standard ASCII characters in repository
  files.

## Validation

After implementation changes, run the smallest validation that covers the
changed surface. Record completed checks and any skipped validation, reason,
risk, and recovery path in the active feature record when one exists.

For documentation-only changes, read back changed files, verify links and paths,
search for stale names, and run `git diff --check`.
