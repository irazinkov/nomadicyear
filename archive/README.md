# Archive Intake

This directory stores raw exports from the existing WordPress site for Phase 0 and Phase 2 migration work.

## Expected Inputs

- WordPress XML export(s)
- Media export(s) or asset dump
- Any manually curated URL lists from analytics/search console

## Rules

- Do not edit raw export files in place.
- Keep source exports immutable and timestamped.
- Perform all cleanup/transforms in `scripts/` and write outputs elsewhere.

## Suggested Naming

- `wp-export-YYYY-MM-DD.xml`
- `media-export-YYYY-MM-DD/`
