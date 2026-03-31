# Phase 4 Asset Runbook

## Objective

Prepare, verify, and publish all image assets referenced by migrated content.

## Preconditions

- WordPress XML export exists in `archive/`.
- Full uploads mirror exists in `archive/uploads/`.
- Project dependencies installed (`npm install`).

## Steps

1. Build curated originals and run archive audit.
   - Command: `npm run phase4:prepare-assets`
   - Output:
     - `archive/new_uploads/`
     - `docs/phase-4-asset-audit.json`
     - `docs/phase-4-asset-audit.md`

2. Sync only referenced assets into deployable public folder.
   - Command: `npm run phase4:sync-public`
   - Strict command (CI-safe): `npm run phase4:sync-public:strict`
   - Output:
     - `public/uploads/`
     - `docs/phase-4-public-sync-report.json`
     - `docs/phase-4-public-sync-report.md`

3. Verify project health.
   - Commands:
     - `npm run lint`
     - `npm run check`
     - `npm run phase4:validate:strict-alt`
     - `npm run phase4:measure`
     - `npm run build`

4. Validate reports before merge.
   - `missing refs` must be `0` in `docs/phase-4-public-sync-report.md`.
   - `missing referenced upload refs` must be `0` in `docs/phase-4-validation-report.md`.
   - `build budget` must be `PASS` in `docs/phase-4-build-metrics.md`.
   - built HTML should include responsive upload `srcset` values (sample check):
     - `rg -n 'srcset="/uploads/' dist/blog/india-stuck-in-mumbai-with-no-money/index.html`
   - Track `total alt gaps` trend in `docs/phase-4-validation-report.md` and reduce over time.
   - Review `duplicate normalized target paths` and `case-variant path collisions` for any path-risk follow-up.

## Operational Rules

- Do not modify files under `archive/uploads/` manually.
- Treat `archive/new_uploads/` as migration artifacts, not hand-edited content.
- Treat `public/uploads/` as generated deploy input; regenerate via script when content changes.
