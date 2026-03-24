# Phase 0 Risks and Mitigations

## Purpose

Track discovery-stage risks before migration implementation begins.

## Risk Register

| ID   | Risk                                           | Impact                              | Likelihood | Mitigation                                                                    | Owner | Status |
| ---- | ---------------------------------------------- | ----------------------------------- | ---------- | ----------------------------------------------------------------------------- | ----- | ------ |
| R-01 | Legacy URL patterns are inconsistent           | High SEO regression risk            | High       | Capture full URL inventory and lock permalink/redirect rules before migration | TBD   | Open   |
| R-02 | Export data has malformed frontmatter or dates | Pipeline failures and content loss  | Medium     | Validate on import and fail on critical schema errors                         | TBD   | Open   |
| R-03 | Taxonomy conflicts (`country` vs `category`)   | Route ambiguity and duplicate pages | High       | Approve taxonomy model in spec before route implementation                    | TBD   | Open   |
| R-04 | Missing or broken image references             | Broken post rendering and UX issues | High       | Add image path normalization + fallback policy in pipeline                    | TBD   | Open   |
| R-05 | Redirect map incompleteness                    | 404s and ranking loss after launch  | High       | Set redirect coverage KPI and test top legacy URLs                            | TBD   | Open   |
| R-06 | Build time spikes from large media set         | Slow CI/deploy cycle                | Medium     | Define build-time budget and optimize image strategy early                    | TBD   | Open   |

## Decisions Needed in Phase 0

1. Final permalink scheme for posts and taxonomies.
2. Whether tag pages should be indexable.
3. Country route behavior for multi-country posts.
4. Redirect fallback policy for unmatched legacy URLs.
