# Phase 0 Runbook

## Goal

Complete discovery and URL safety tasks before migration implementation.

## 1) Prepare Raw Inputs

1. Place WordPress export and media dump in `archive/`.
2. Keep original files immutable.

## 2) Capture URL Inventory

Run:

```bash
npm run phase0:url-inventory -- https://<your-current-domain>
```

Output:

- `docs/url-inventory.csv`

If your sitemap is at a custom URL:

```bash
npm run phase0:url-inventory -- https://<your-current-domain>/<custom-sitemap>.xml
```

## 3) Draft Redirect Mapping

1. Open `docs/redirects.csv`.
2. Fill old URL to target URL mappings.
3. Set status code to `301` for permanent redirects.

## 4) Finalize Spec Decisions

1. Open `docs/migration-spec.md`.
2. Fill:
   - source domain and permalink rules
   - taxonomy model decisions
   - KPI targets and thresholds
3. Review risks in `docs/phase-0-risks.md`.

## 5) Phase 0 Exit Checklist

Mark complete in `docs/migration-spec.md` when all items are approved.
