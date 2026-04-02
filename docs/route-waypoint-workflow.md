# Route Waypoint Workflow

## Goal
Add route waypoints chronologically without breaking markers, photos, or road traces.

## Ground Rules
- `src/content/posts/*.md` is the source for marker content (label, coords, photo, blog link).
- `src/data/map-steps.json` is currently required for `scripts/map/build-route-geojson.mjs` route segmentation.
- Every waypoint update must keep these two in sync until the build script is refactored.
- For routing geometry, use OSRM (not Mapbox Directions) in this project.

## Per-Post Process (Chronological)
1. Pick the next post by `pubDate`.
2. Add/update `routeWaypoints` in the post frontmatter:
   - Required: `label`, `lat`, `lng`
   - Usually required: `transport`
   - Optional but recommended: `image`, `imageAlt`
3. Validate waypoint image paths exist under `public/`.
4. Insert matching entries into `src/data/map-steps.json` in strict `mapOrder` sequence.
5. Rebuild route data:
   - `node scripts/map/build-route-geojson.mjs`
6. Check whether new drive segments are real traces or fallback straight lines.
7. Build site:
   - `npm run build`
8. Verify in output that new stops exist and segment coordinate counts are correct.

## Required Checks

### A) Image path check
For each `image: "/uploads/...jpg"` in the edited post, confirm `public/uploads/...jpg` exists.

### B) Segment quality check
For newly added `drive` legs, coordinate counts should be meaningfully greater than `2`.
- `2` means straight fallback (not road-following).

### C) Marker presence check
Confirm stop labels appear in `dist/map/index.html`.

## If a Drive Leg Is Still Straight (coords = 2)
1. Generate a manual route trace GPX from routing service geometry.
   - Use OSRM: `https://router.project-osrm.org/route/v1/driving/...`
   - Do not use Mapbox Directions here (current token setup returns `Forbidden` for directions).
2. Save to:
   - `archive/GPS tracks/Manual/YYYYMMDD_<post>_osrm.gpx`
3. Re-run:
   - `node scripts/map/build-route-geojson.mjs`
4. Re-check coordinate counts.

## Naming and Data Conventions
- Keep labels short and location-specific.
- Keep photo paths absolute from `public` root, e.g. `/uploads/2015/11/DSC00901.jpg`.
- Use one coherent transport mode per leg (`drive`, `boat`, `flight`).
- Keep map order strictly chronological across posts.

## Do-Not-Repeat Mistakes
- Do not edit only post frontmatter without syncing `map-steps.json`.
- Do not trust image paths without file existence check.
- Do not assume traces are road-following after rebuild; always inspect coordinate counts.
- Do not skip the final `dist/map/index.html` verification.
- Do not attempt Mapbox Directions for trace generation in this repo; use OSRM instead.

## Minimal Completion Checklist
- [ ] Post `routeWaypoints` updated
- [ ] `map-steps.json` synced
- [ ] Images verified in `public/`
- [ ] `build-route-geojson.mjs` run
- [ ] New drive legs have trace-like coordinate counts
- [ ] `npm run build` passes
- [ ] Stops visible in `dist/map/index.html`
