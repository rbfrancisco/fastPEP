# CODEX Memory - fastPEP

Last updated: 2026-02-06

## Project Snapshot
- Main app is static: `index.html`, `js/`, `css/`, `data/`.
- Admin/editor is local-only tooling: `admin/` + `server/`.
- Data source-of-truth is split JSON in `data-src/`.
- Runtime data in `data/` is compiled from `data-src/`.

## Current Build/Deploy Rules
- Production build command: `npm run build`
- Production output directory: `dist`
- `npm run build` excludes `admin/` by default.
- `npm run build:full` includes `admin/` (internal/local use only).
- Data compile command: `npm run compile-data`
- Data validation command: `npm run validate-data`
- Cloudflare build settings:
  - Build command: `npm run build`
  - Output directory: `dist`

## Local Admin Editing Workflow
- Start local server with: `npm run server`
- Default bind host: `127.0.0.1`
- Local editor URL: `http://127.0.0.1:3001/admin/`
- Write operations require env token:
  - `export ADMIN_API_TOKEN="your-token"`
- CORS is off by default; optional override with:
  - `ADMIN_CORS_ORIGIN`

## Security/Integrity Guardrails Implemented
- PUT/DELETE protected by `X-Admin-Token`.
- ID format validation on write routes and editor forms.
- Atomic JSON writes with per-type write lock.
- Main app rendering paths hardened to avoid unsafe data interpolation via `innerHTML`.
- Data integrity validator:
  - `npm run validate-data`
- Data compiler:
  - `npm run compile-data`
- Schemas:
  - `schemas/*.schema.json`
- CI validation workflow:
  - `.github/workflows/validate-data.yml`
- Optional pre-commit hook:
  - `git config core.hooksPath .githooks`

## Collaboration Notes
- Keep production surface minimal (static app only).
- Keep admin/server local-only and never deploy by default.
- Prefer small, reviewable commits with explicit verification steps.
- After structural changes, always verify:
  1. `npm run compile-data`
  2. `npm run validate-data`
  3. `npm run build`
  4. Dist contents match production expectations
