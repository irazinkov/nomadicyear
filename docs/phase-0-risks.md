# Phase 0 Risks and Mitigations

## Purpose

Track discovery-stage risks before migration implementation begins.

## Risk Register

| ID   | Risk                                           | Impact                              | Likelihood | Mitigation                                                                    | Owner | Status                    |
| ---- | ---------------------------------------------- | ----------------------------------- | ---------- | ----------------------------------------------------------------------------- | ----- | ------------------------- |
| R-01 | Legacy URL patterns are inconsistent           | High SEO regression risk            | High       | Capture full URL inventory and lock permalink/redirect rules before migration | Team  | Mitigated (Phase 0)       |
| R-02 | Export data has malformed frontmatter or dates | Pipeline failures and content loss  | Medium     | Validate on import and fail on critical schema errors                         | Team  | Open (Phase 2)            |
| R-03 | Taxonomy conflicts (`country` vs `category`)   | Route ambiguity and duplicate pages | High       | Approve taxonomy model in spec before route implementation                    | Team  | Mitigated (Phase 0)       |
| R-04 | Missing or broken image references             | Broken post rendering and UX issues | High       | Add image path normalization + fallback policy in pipeline                    | Team  | Open (Phase 2/4)          |
| R-05 | Redirect map incompleteness                    | 404s and ranking loss after launch  | High       | Set redirect coverage KPI and test top legacy URLs                            | Team  | Mitigated (Phase 0 draft) |
| R-06 | Build time spikes from large media set         | Slow CI/deploy cycle                | Medium     | Define build-time budget and optimize image strategy early                    | Team  | Open (Phase 4)            |

## Phase 0 Review Log

- Reviewed on: `2026-03-24`
- Reviewer: `Project team`
- Outcome:
  - URL strategy, taxonomy decisions, and KPI thresholds documented in `docs/migration-spec.md`
  - Initial redirect map drafted with full coverage of discovered URLs requiring redirects
  - Remaining open risks carried into implementation phases
