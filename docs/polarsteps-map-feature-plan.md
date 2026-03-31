# Polarsteps-Style Route Map Feature Plan

## Document Control

- Status: Proposed (future feature candidate)
- Last updated: 2026-03-30
- Owner: Nomadic Year migration team

## Goal

Create a Polarsteps-inspired interactive route experience for `/map/` that:

- Shows the full world route as styled line segments.
- Overlays clickable post markers tied to specific locations.
- Supports story-like exploration (scroll cards + map focus).
- Keeps operations simple and low-cost for current traffic levels.

## Why This Feature

- Current map page uses an embedded Google My Maps iframe.
- The iframe limits custom interaction and post-level storytelling.
- A native map implementation can turn the route into a core content surface.

## Proposed Technical Approach

1. Mapping stack
   - Use `Mapbox GL JS` for the `/map/` route.
   - Render route and points from static data files generated at build time.

2. Data model
   - Add optional map metadata to post frontmatter:
     - `lat`, `lng`
     - `mapTitle` (override marker/card label)
     - `mapOrder` (story ordering)
     - `transport` (`drive | boat | flight`) for segment styling
   - Maintain route geometry in `route.geojson` (single/multi `LineString`).

3. Data files
   - `src/data/route.geojson`: route line segments with transport/type properties.
   - `src/data/map-steps.json`: map cards/markers (slug, title, coords, date, hero image).
   - Optional build script in `scripts/` to keep `map-steps.json` in sync with content.

4. UI/UX model
   - Desktop: split layout with sticky map + scrollable story cards.
   - Mobile: full map with bottom-sheet style cards.
   - Interactions:
     - Card focus triggers `flyTo` and marker highlight.
     - Marker click opens post preview and link to `/blog/<slug>/`.
     - Route legend for transport types.

5. Cost and reliability controls
   - Use precomputed route data (no per-view routing calls).
   - Restrict Mapbox token by domain.
   - Add usage alerts and reasonable monthly caps.
   - Lazy-load map on interaction/viewport where possible.

## Delivery Plan

1. Phase A: Data readiness
   - Extend content schema.
   - Populate coordinates/order for initial set of posts.
   - Add `route.geojson`.

2. Phase B: Functional MVP
   - Implement `/map/` with Mapbox map, route layer, and clickable markers.
   - Link markers to post pages.

3. Phase C: Storytelling UX
   - Add synchronized card list and map camera behavior.
   - Add mobile bottom-sheet interactions.

4. Phase D: Polish and QA
   - Visual tuning to match desired style direction.
   - Accessibility, performance, and regression checks.

## Acceptance Criteria

- `/map/` no longer depends on embedded iframe maps.
- Users can click a map point and open the related blog post.
- Route segments are visually distinct by transport type.
- Mobile and desktop interactions are both usable and responsive.
- Feature remains within free/low-cost map usage under expected traffic.

## Out of Scope (Initial Version)

- Real-time location tracking.
- User accounts, saved trips, or collaborative planning.
- Server-side route computation per request.
- Advanced filtering beyond basic chapter/post navigation.
