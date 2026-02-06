# Agent Data Guide

This file is for AI/code agents editing FastPEP data safely.

## Source of Truth
- Edit split files in `data-src/` only.
- Do not hand-edit compiled runtime files in `data/`.

## Folder Mapping
- `data-src/medications/<id>.json`
- `data-src/medication-classes/<id>.json`
- `data-src/physical-exam/<id>.json`
- `data-src/conditions/<id>.json`

## ID Rules
- IDs must match: `^[a-z0-9]+(?:-[a-z0-9]+)*$`
- Use lowercase letters, numbers, and hyphens only.

## Required Workflow After Any Data Edit
1. `npm run compile-data`
2. `npm run validate-data`
3. Confirm changes in `data/*.json` are expected compiled output.

## Build Commands
- Production: `npm run build` (excludes `admin/`)
- Internal/local full package: `npm run build:full`

## Local Admin Mode
- Start: `npm run server`
- URL: `http://127.0.0.1:3001/admin/`
- Writes require `ADMIN_API_TOKEN` and update `data-src/`, then auto-compile `data/`.

## Schema Files
- `schemas/medication.schema.json`
- `schemas/medication-class.schema.json`
- `schemas/physical-exam-addon.schema.json`
- `schemas/condition.schema.json`

Validation script enforces:
- Schema compliance
- Cross-file references
- Compiled/runtime sync (`data/` matches `data-src/`)
