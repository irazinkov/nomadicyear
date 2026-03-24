# Redirect Open Questions (Phase 0)

## Current Unmapped Non-Tag URLs

- `/`
- `/blog/`
- `/blank/`
- `/sample-page/`

## Proposed Handling

- `/`:
  - no redirect needed (remains homepage)
- `/blog/`:
  - no redirect needed (remains blog index)
- `/blank/`:
  - likely legacy placeholder page; choose one:
    - redirect to `/about/` (recommended if historically linked), or
    - leave unmapped and allow 404/410
- `/sample-page/`:
  - likely default WordPress sample page; choose one:
    - redirect to `/about/` (recommended if externally linked), or
    - leave unmapped and allow 404/410

## Decision Needed

- Confirm final policy for low-value legacy pages (`/blank/`, `/sample-page/`) before launch.
