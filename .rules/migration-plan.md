# Nomadic Year Migration Plan

## Goal

Migrate the 10-year-old WordPress blog "Nomadic Year" to a fast, fully static Astro site with typed Markdown content, no database, and predictable deployments.

## Stack

- Framework: Astro (pin major version for stability)
- Content: Markdown (`.md` or `.mdx`) with YAML frontmatter
- Styling: Tailwind CSS
- Hosting: Cloudflare Pages

## Working Principles

- Infrastructure first: establish local/dev/build/deploy pipeline before bulk migration.
- URL safety first: lock permalink strategy and redirects early to prevent SEO regressions.
- Zero-JS first: avoid client scripts unless required for UX.
- Phase gates: complete each phase with explicit exit criteria before moving on.
- Validation-driven migration: automated scripts must report and fail on critical data issues.

---

## Phase 0: Discovery, URL Rules, and Migration Spec

### Objective

Define what "correct migration" means before building or importing.

### Tasks

1. Export all WordPress content and media into `archive/`. — 100%
2. Crawl current production URLs and capture: — 100%
   - path, status code, title, canonical, meta description
3. Define target permalink structure for: — 100%
   - posts, categories, tags, country pages
4. Create URL mapping file (`redirects.csv`) from old URL to new URL. — 100%
5. Define taxonomy model: — 100%
   - separate fields for `country`, `categories`, `tags` (or explicitly document intentional merge)
6. Define migration KPIs: — 100%
   - redirect coverage target
   - max allowed broken internal links
   - build time target
   - performance target for key templates
7. Document all decisions in `docs/migration-spec.md`. — 100%

### Exit Criteria

- Approved permalink rules and taxonomy model.
- Initial `redirects.csv` drafted.
- KPIs and acceptance thresholds documented.

---

## Phase 1: Infrastructure Bootstrap (No Bulk Content Yet)

### Objective

Create a reliable local project and deployment pipeline first.

### Tasks

1. Initialize Astro project and commit clean baseline. — 100%
2. Install and configure Tailwind CSS. — 100%
3. Create global layout (`Layout.astro`) with nav and footer. — 100%
4. Add placeholder pages: Home, About, Destinations. — 100%
5. Add content collections scaffold in `src/content.config.ts`. — 100%
6. Set up quality tooling: — 100%
   - linting
   - formatting
   - type checks
7. Configure CI pipeline to run install, checks, and build. — 100%
8. Connect repository to Cloudflare Pages: — 50%
   - preview deploys for pull requests
   - production deploy from default branch
9. Add baseline SEO plumbing: — 100%
   - `robots.txt`
   - sitemap generation
   - reusable SEO/meta component

### Exit Criteria

- `npm run build` passes locally and in CI.
- Preview and production deployment pipelines are functional.
- Site shell is live with placeholder content.

---

## Phase 2: Content Schema and Migration Pipeline

### Objective

Build repeatable tooling to transform WordPress exports into validated Astro content.

### Tasks

1. Inspect representative export samples plus edge cases. — 100%
2. Define strict schema in `src/content.config.ts` for: — 90%
   - title, slug, date, updated date
   - excerpt, hero image, image alt
   - country, categories, tags
   - draft/published flags
3. Create migration scripts in `scripts/migrate/` to: — 90%
   - clean invalid HTML leftovers
   - remove unsupported shortcodes
   - normalize frontmatter fields
   - normalize date formats
   - normalize slugs
   - rewrite broken media paths
4. Output cleaned files into `src/content/posts/`. — 100%
5. Generate validation report with counts and error buckets: — 75%
   - schema failures
   - missing required fields
   - unresolved media
   - broken internal links in markdown
6. Fail migration command on critical errors. — 100%

### Exit Criteria

- One command converts source export into schema-valid content.
- Validation report generated and reviewed.
- Critical errors reduced to zero (or explicitly waived).

---

## Phase 3: Rendering and Routing

### Objective

Implement all key page templates and route behavior.

### Tasks

1. Build index page with post cards: — 0%
   - hero image
   - title
   - excerpt
   - publish date
2. Build single post route (`[slug].astro`) with readable typography and responsive media. — 0%
3. Build taxonomy routes: — 0%
   - `/category/[slug]`
   - `/tag/[slug]`
   - `/country/[slug]`
4. Implement pagination where needed. — 0%
5. Add canonical URLs and metadata per page. — 0%
6. Ensure route output matches permalink rules from Phase 0. — 0%

### Exit Criteria

- All primary templates render correctly with migrated content.
- Route structure matches migration spec.

---

## Phase 4: Image and Asset Optimization

### Objective

Optimize a decade of travel photography without breaking authoring flow.

### Tasks

1. Decide media strategy: — 0%
   - local repo, object storage, or hybrid
2. Normalize media naming and folder conventions. — 0%
3. Use Astro image optimization (`<Image />` or equivalent strategy) where applicable. — 0%
4. Generate responsive image variants for key breakpoints. — 0%
5. Enforce alt text and fallback behavior for missing media. — 0%
6. Measure build time and output size impact from image processing. — 0%

### Exit Criteria

- Images are optimized, responsive, and visually correct.
- Build remains within target time limits.

---

## Phase 5: SEO, Redirects, and Regression QA

### Objective

Protect discoverability and prevent launch regressions.

### Tasks

1. Run full internal link checks on built site. — 0%
2. Verify metadata parity for sampled high-traffic pages. — 0%
3. Generate and validate sitemap output. — 0%
4. Apply redirects from `redirects.csv`. — 0%
5. Test old URL samples to confirm correct 301 behavior. — 0%
6. Run accessibility checks: — 0%
   - heading hierarchy
   - alt coverage
   - color contrast on key templates

### Exit Criteria

- No critical broken links.
- Redirect coverage meets KPI target.
- SEO and accessibility checks pass defined thresholds.

---

## Phase 6: Launch and Cutover

### Objective

Move production traffic safely to the new static site.

### Tasks

1. Freeze content or define delta-import window. — 0%
2. Run final migration and production build. — 0%
3. Execute launch smoke tests on top pages and key legacy URLs. — 0%
4. Switch DNS/domain to Cloudflare Pages. — 0%
5. Monitor: — 0%
   - 404 rates
   - redirect misses
   - build/deploy logs
   - search indexing signals
6. Patch urgent redirect or content issues immediately. — 0%

### Exit Criteria

- Production cutover complete.
- Error rates within acceptable bounds for first monitoring window.

---

## Phase 7: Post-Launch Hardening

### Objective

Stabilize operations and make ongoing publishing simple.

### Tasks

1. Add scheduled link and content validation checks. — 0%
2. Document editorial workflow for new posts. — 0%
3. Archive migration scripts, logs, and mapping artifacts for reproducibility. — 0%
4. Prioritize and fix post-launch backlog items. — 0%

### Exit Criteria

- Ongoing publishing flow is documented and repeatable.
- Monitoring and maintenance checks are in place.

---

## AI Collaboration Rules

- Work phase by phase; do not jump ahead without explicit confirmation.
- Before changing architecture decisions, revisit `docs/migration-spec.md`.
- Prefer implementation and command execution over abstract advice.
- When blocked, report blocker, impact, and next best option.
