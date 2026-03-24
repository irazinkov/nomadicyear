# Migration Specification (Phase 0)

## Document Control

- Project: Nomadic Year
- Phase: 0 (Discovery, URL Rules, and Migration Spec)
- Status: Draft
- Last updated: 2026-03-24

## 1) Source of Truth

- Current production domain: `nomadicyear.com`
- Current WordPress permalink style: date-prefixed post URLs (`/YYYY/MM/<slug>/`) plus taxonomy archives
- Crawl source(s):
  - `http://nomadicyear.com/sitemap.xml` (inventory crawl)
  - child sitemaps discovered from sitemap index (All in One SEO generated)

### 1.1 Inventory Snapshot (2026-03-24)

- Candidate URLs discovered from sitemap(s): `568`
- Inventory rows written: `568`
- HTTP 200 responses: `567`
- Fetch errors: `1` (`/tag/thai-food/`)
- Notes:
  - HTTPS sitemap access from this environment produced TLS handshake errors.
  - HTTP sitemap access succeeded and was used for capture.

## 2) Target URL Strategy

Define canonical URL rules before migration implementation.

### 2.1 Routes

| Content Type | Target Route        | Notes                                                   |
| ------------ | ------------------- | ------------------------------------------------------- |
| Post         | `/blog/<slug>/`     | Keep trailing slash policy consistent across all routes |
| Category     | `/category/<slug>/` | Confirm whether categories remain public pages          |
| Tag          | `/tag/<slug>/`      | Confirm if long-tail tags should be indexable           |
| Country      | `/country/<slug>/`  | Distinct from category unless intentionally merged      |
| About        | `/about/`           | Static page                                             |
| Destinations | `/destinations/`    | Static index (phase-dependent)                          |

### 2.2 URL Rules

- Slug casing: lowercase
- Word separator: hyphen
- Trailing slash: yes
- Legacy date prefixes in URL: `TODO` (keep/remove)
- Query-string handling: ignore for canonical paths unless explicitly required

## 3) Taxonomy Model

Define data model now to avoid route churn later.

| Field        | Type     | Required | Route Impact       | Notes                                                    |
| ------------ | -------- | -------- | ------------------ | -------------------------------------------------------- |
| `country`    | string   | no       | `/country/[slug]`  | One country per post unless multi-country rule is chosen |
| `categories` | string[] | yes      | `/category/[slug]` | Primary topical grouping                                 |
| `tags`       | string[] | no       | `/tag/[slug]`      | Free-form descriptors                                    |

### 3.1 Taxonomy Decisions

- Country and category are separate: `TBD`
- Tag pages indexable by default: `TBD`
- Empty taxonomy behavior: `TBD`

## 4) Redirect Policy

- Redirect type: `301` for permanent moves
- Mapping source: `docs/redirects.csv`
- Required columns: old URL, new URL, status code, priority, notes
- Fallback:
  - unmatched legacy URL -> `/404`
  - optional country/category fallback behavior: `TBD`

## 5) Migration KPIs

| KPI                        | Target                                                         | Measurement Method                             | Status |
| -------------------------- | -------------------------------------------------------------- | ---------------------------------------------- | ------ |
| Redirect coverage          | >= 95% of legacy URLs                                          | Compare `url-inventory.csv` to `redirects.csv` | Draft  |
| Broken internal links      | 0 critical                                                     | Link checker on built output                   | Draft  |
| Metadata parity sample     | >= 95% title/description/canonical parity on sampled top pages | Sample audit sheet                             | Draft  |
| Build time budget          | <= 5 minutes (initial target)                                  | CI build timing                                | Draft  |
| Core templates performance | TBD (Lighthouse target)                                        | Lighthouse on homepage + post page             | Draft  |

## 6) Data Quality Rules

- All posts must have valid `title`, `description`, and `pubDate`.
- All public posts must resolve to one canonical URL.
- Hero image optional; if missing, use template fallback strategy.
- Any schema violations must be listed in a migration report and triaged.

## 7) Phase 0 Checklist

- [ ] Source exports placed in `archive/`
- [x] URL inventory captured in `docs/url-inventory.csv`
- [ ] Permalink strategy approved
- [ ] Taxonomy model approved
- [ ] Redirect draft created in `docs/redirects.csv`
- [ ] KPI targets approved
- [ ] Risks reviewed in `docs/phase-0-risks.md`
- [ ] Phase 0 sign-off recorded

## 8) Sign-off

- Decision owner: `TODO`
- Sign-off date: `TODO`
- Notes: `TODO`
