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
- HTTP 200 responses: `568`
- Fetch errors: `0`
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

### 2.2 URL Rules (Approved)

- Slug casing: lowercase
- Word separator: hyphen
- Trailing slash: yes
- Legacy date prefixes in URL: remove (301 to `/blog/<slug>/`)
- Query-string handling: ignore for canonical paths unless explicitly required

## 3) Taxonomy Model

Define data model now to avoid route churn later.

| Field        | Type     | Required | Route Impact       | Notes                                                    |
| ------------ | -------- | -------- | ------------------ | -------------------------------------------------------- |
| `country`    | string   | no       | `/country/[slug]`  | One country per post unless multi-country rule is chosen |
| `categories` | string[] | yes      | `/category/[slug]` | Primary topical grouping                                 |
| `tags`       | string[] | no       | `/tag/[slug]`      | Free-form descriptors                                    |

### 3.1 Taxonomy Decisions (Approved)

- Country and category are separate: `yes`
- Tag pages are generated but not indexable by default (use `noindex` until curated): `yes`
- Empty taxonomy behavior: `no page generated`

## 4) Redirect Policy

- Redirect type: `301` for permanent moves
- Mapping source: `docs/redirects.csv`
- Required columns: old URL, new URL, status code, priority, notes
- Initial auto-drafted redirects: `86`
- Coverage snapshot (from inventory):
  - non-tag URLs: `88`
  - mapped in redirect draft: `86`
  - unmapped non-tag URLs: `/`, `/blog/` (both canonical keep-as-is routes)
  - coverage for URLs requiring redirects: `100%` (86/86)
- Fallback:
  - unmatched legacy URL -> `/404`
  - no taxonomy fallback redirects (avoid ambiguous intent)

## 5) Migration KPIs

| KPI                        | Target                                                            | Measurement Method                             | Status   |
| -------------------------- | ----------------------------------------------------------------- | ---------------------------------------------- | -------- |
| Redirect coverage          | >= 98% of URLs requiring redirects                                | Compare `url-inventory.csv` to `redirects.csv` | Approved |
| Broken internal links      | 0 critical                                                        | Link checker on built output                   | Approved |
| Metadata parity sample     | >= 95% title/description/canonical parity on top 100 legacy pages | Sample audit sheet                             | Approved |
| Build time budget          | <= 5 minutes                                                      | CI build timing                                | Approved |
| Core templates performance | Lighthouse Performance >= 90 (mobile) on homepage + post page     | Lighthouse audit                               | Approved |

## 6) Data Quality Rules

- All posts must have valid `title`, `description`, and `pubDate`.
- All public posts must resolve to one canonical URL.
- Hero image optional; if missing, use template fallback strategy.
- Any schema violations must be listed in a migration report and triaged.

## 7) Phase 0 Checklist

- [ ] Source exports placed in `archive/`
- [x] URL inventory captured in `docs/url-inventory.csv`
- [x] Permalink strategy approved
- [x] Taxonomy model approved
- [x] Redirect draft created in `docs/redirects.csv`
- [x] KPI targets approved
- [ ] Risks reviewed in `docs/phase-0-risks.md`
- [ ] Phase 0 sign-off recorded

## 8) Sign-off

- Decision owner: `TODO`
- Sign-off date: `TODO`
- Notes: `TODO`
