# Phase 4 Media Strategy

## Status

- Decision date: 2026-03-30
- Phase: 4 (Image and Asset Optimization)
- Decision owner: Nomadic Year migration team

## Chosen Approach

- Storage model: hybrid.
- Source of truth for originals: `archive/new_uploads/`.
- Source fallback: `archive/uploads/` for legacy files not present in `new_uploads`.
- Runtime/static serving source: `public/uploads/` (synced subset of only referenced assets).

## Why This Strategy

- Keeps all high-res originals in a migration-safe archive folder.
- Ships only assets currently referenced by site content, not all historical files.
- Preserves WordPress-authored paths (`/uploads/YYYY/MM/file.ext`) so existing markdown and links keep working.
- Allows incremental optimization later without breaking URL compatibility.

## Folder Conventions

- `archive/uploads/`: raw WordPress export mirror (never edited by migration scripts).
- `archive/new_uploads/`: curated originals copied from WXR attachment records.
- `public/uploads/`: deployable files used by the Astro site.

## Naming Conventions

- Preserve original WordPress filenames and year/month path layout.
- Do not rename legacy assets during migration to avoid broken links.
- If manual replacement is required, keep same relative path and filename.

## Optimization Strategy

- Near-term: keep existing WordPress generated variants (for example `-1024x683`) as responsive sources already embedded in content.
- Hero images:
  - local imported images use Astro `<Image />`.
  - string/path hero images (legacy `/uploads/...`) render as `<img>` and use existing variants.
- Body/page images:
  - rendered HTML is post-processed to add responsive attributes on `/uploads/...` images.
  - when multiple width variants exist, use width-based `srcset`.
  - when only one resized file plus original exists, use `1x/2x` fallback `srcset`.
- Future phase extension: generate modern formats (`webp/avif`) for high-traffic templates while preserving canonical `/uploads/...` references.

## Validation and Reporting

- Asset preparation and audit:
  - `npm run phase4:prepare-assets`
- Public sync (non-blocking):
  - `npm run phase4:sync-public`
- Public sync (blocking on missing refs):
  - `npm run phase4:sync-public:strict`
- Validation gate (fails on missing media refs, reports alt gaps):
  - `npm run phase4:validate`
- Validation gate with alt-gap enforcement:
  - `npm run phase4:validate:strict-alt`
- Alt-gap auto-fix helper:
  - `npm run phase4:fix-alt`
- Build/output measurement with budget enforcement:
  - `npm run phase4:measure`
- Reports:
  - `docs/phase-4-asset-audit.md`
  - `docs/phase-4-public-sync-report.md`
  - `docs/phase-4-validation-report.md`
  - `docs/phase-4-build-metrics.md`

## Baseline Metrics (2026-03-30)

- Referenced upload URLs in content: `5045`
- Missing referenced assets after sync: `0`
- Case-variant URL collisions detected: `4`
- Case-fallback source matches used by sync: `5`
- Missing referenced upload refs after validation: `0`
- Current alt-gap baseline (legacy content): `0` (improved from `120`)
- Dist footprint after full build: ~`1.96G`
- Build budget status (`<= 5m`): `PASS` (~`9.26s` measured)
- Responsive upload `srcset` rewrite in built HTML: enabled
