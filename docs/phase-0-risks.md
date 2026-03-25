# Phase 0 Risks and Mitigations

## Purpose

Document migration risks with concrete mitigation plans and validation criteria before and during implementation.

## Risk Register (Summary)

| ID   | Risk                                           | Impact                                    | Likelihood | Owner | Status                                   |
| ---- | ---------------------------------------------- | ----------------------------------------- | ---------- | ----- | ---------------------------------------- |
| R-01 | Legacy URL patterns are inconsistent           | High SEO and traffic regression risk      | High       | Team  | Mitigated (Phase 0), validate pre-launch |
| R-02 | Export data is malformed or incomplete         | Data loss, failed imports, broken content | Medium     | Team  | Open (Phase 2)                           |
| R-03 | Taxonomy ambiguity (`country` vs `categories`) | Duplicate/conflicting route behavior      | High       | Team  | Mitigated (Phase 0), enforce in pipeline |
| R-04 | Missing or broken image references             | Broken post rendering and poor UX         | High       | Team  | Open (Phase 2/4)                         |
| R-05 | Redirect map incompleteness                    | 404s, ranking loss, link equity leakage   | High       | Team  | Mitigated (draft), validate pre-launch   |
| R-06 | Build-time spikes from media volume            | Slow/unstable CI and deploy pipeline      | Medium     | Team  | Open (Phase 4)                           |

## Detailed Risk Plan

### R-01 Legacy URL Inconsistency

**Failure mode**

- Old WordPress URLs (`/YYYY/MM/slug/`, taxonomy pages, legacy static pages) do not map cleanly to new Astro routes.
- Result: 404s, SEO ranking drops, broken inbound links.

**Mitigation**

- Keep `docs/url-inventory.csv` as source list of legacy URLs.
- Keep `docs/redirects.csv` as explicit 301 mapping table.
- Lock canonical permalink policy in `docs/migration-spec.md`.
- Test sampled high-value legacy URLs before cutover.

**Validation**

- Redirect coverage KPI met.
- Legacy sample test passes (expected 301 + correct destination).
- Post-launch 404 logs show no high-value unresolved legacy URLs.

---

### R-02 Malformed Export Data

**Failure mode**

- Missing or malformed dates, slugs, titles, or content in WXR.
- WordPress artifacts (shortcodes/HTML) break markdown conversion.

**Mitigation**

- Strict schema in `src/content.config.ts`.
- Migration scripts generate validation report and fail on critical errors.
- Non-critical issues routed to triage report for cleanup.

**Validation**

- Zero critical schema failures in generated posts.
- Every migrated public post has valid required frontmatter.
- Validation report produced on every migration run.

---

### R-03 Taxonomy Ambiguity (`country` vs `categories`)

**Failure mode**

- Same concept represented in multiple fields, causing duplicate pages or unclear filtering.

**Mitigation**

- Approved model:
  - `country`: optional single semantic country value
  - `categories`: topical grouping
  - `tags`: free-form labels
- Enforce normalization in migration pipeline.
- Reject or map unknown taxonomy values explicitly.

**Validation**

- No duplicate taxonomy routes for the same concept.
- Generated content conforms to approved taxonomy structure.

---

### R-04 Missing or Broken Image References

**Failure mode**

- Content references images not present locally or with invalid paths.
- Featured image references cannot be resolved from attachment metadata.

**Mitigation**

- Build media manifest from `archive/uploads`.
- Resolve `_thumbnail_id` -> attachment URL/path mapping.
- Rewrite body image paths and report unresolved references.
- Use fallback behavior where image resolution fails.

**Validation**

- Unresolved image report generated and reviewed.
- Critical posts/pages have no broken hero images.
- Broken image checks on sampled migrated posts pass.

---

### R-05 Redirect Map Incompleteness

**Failure mode**

- Redirect coverage appears high overall but misses important pages.

**Mitigation**

- Auto-generate baseline redirect draft from inventory.
- Add manual mappings for non-standard legacy pages.
- Keep open-questions list for low-confidence routes.
- Patch redirect map using launch/post-launch 404 telemetry.

**Validation**

- Coverage KPI met for URLs requiring redirects.
- Top legacy traffic URLs explicitly verified.
- `docs/redirects.csv` reviewed before production cutover.

---

### R-06 Build-Time Spikes from Large Media Set

**Failure mode**

- Large media corpus causes slow builds/timeouts.

**Mitigation**

- Set build-time budget and monitor in CI.
- Avoid unnecessary image processing for non-referenced assets.
- Prefer staged optimization strategy for large archives.
- Move heavy media paths to object storage/CDN if required.

**Validation**

- CI build duration stays within budget.
- Performance targets met on key templates (homepage + post page).

## Phase 0 Review Log

- Reviewed on: `2026-03-24`
- Reviewer: `Project team`
- Outcome:
  - URL strategy, taxonomy decisions, and KPI thresholds documented in `docs/migration-spec.md`
  - Redirect draft created and validated against inventory
  - Remaining open risks carried into implementation phases
