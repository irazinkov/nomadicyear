# Future Features Backlog

## Purpose

Track non-blocking enhancements that are intentionally deferred from current migration phases.

## Status

- Last updated: 2026-03-30
- Owner: Nomadic Year migration team

## UX Enhancements

1. Lightbox polish (deferred)
   - Replace text buttons with compact icon controls.
   - Improve mobile interaction with swipe gestures.
   - Refine caption and toolbar placement for smaller screens.

2. Image browsing controls
   - Add optional zoom-in/out inside the lightbox.
   - Add optional thumbnail strip for long galleries.

3. Interactive route storytelling map (Polarsteps-inspired, deferred)
   - Replace iframe `/map/` with a native `Mapbox GL JS` experience.
   - Render full route + clickable post markers linked to `/blog/<slug>/`.
   - Add synchronized story cards and map camera movement.
   - Implementation summary: `docs/polarsteps-map-feature-plan.md`.

## Performance and Media

1. Modern format pipeline
   - Generate `webp/avif` variants for high-traffic images.
   - Keep `/uploads/...` compatibility while serving optimized sources.

2. Build-time tuning
   - Add asset size and build-time budget checks in CI.
   - Measure and reduce image payload on homepage and top posts.

## Publishing and Operations

1. Editorial tooling
   - Document image workflow for new posts (alt text, sizing, naming).
   - Add pre-publish checks for missing alt text and broken media links.

2. Observability
   - Add a post-launch report for 404 image paths and top missing assets.

3. Semantic heading normalization guardrail
   - Add a migration transform that prevents `h1 -> h3` jumps in newly imported legacy content.
