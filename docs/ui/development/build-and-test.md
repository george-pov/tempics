# UI Build And Test

Run these commands from `src/ui/`.

## Install

For local development:

```powershell
npm install
```

Use `npm ci` for a clean reproducible CI installation.

## Development Server

```powershell
npm start
```

The development server listens on `http://localhost:4200/` by default.

## Production Build

```powershell
npm run build
```

## Unit Tests

```powershell
npm test
```

The scripts and exact dependency versions are owned by `package.json` and
`package-lock.json`. Starting the server, installing packages, building, and
testing must not be performed during plan-only or task-design work.
