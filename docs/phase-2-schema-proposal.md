# Phase 2 Schema Proposal

## Source

- WordPress export analysis: `docs/phase-2-export-analysis.md`

## Proposed Astro Post Frontmatter

```yaml
title: string
slug: string # optional override, kebab-case
pubDate: date
updatedDate: date?
description: string # SEO description / summary
excerpt: string? # short body preview
heroImage: image-or-string? # local Astro image metadata or URL/path
heroImageAlt: string?
country: string?
categories: string[]
tags: string[]
legacyUrl: string? # old WP URL for traceability
status: publish|draft
draft: boolean
```

## Mapping Rules from WXR

- `title` <- `<title>`
- `slug` <- `<wp:post_name>`
- `pubDate` <- `<wp:post_date>`
- `updatedDate` <- `<wp:post_modified>` when available
- `description` <- explicit excerpt when present, otherwise derived from stripped content
- `excerpt` <- `<excerpt:encoded>` (fallback derived text)
- `categories` <- taxonomy `category`
- `tags` <- taxonomy `post_tag`
- `legacyUrl` <- `<link>`
- `status` <- `<wp:status>`
- `draft` <- `status != publish`

## Edge-Case Handling

- Numeric slug:
  - keep original slug in `legacyUrl`
  - allow explicit slug remap via migration map file
- Missing excerpt:
  - derive excerpt from cleaned content, max-length cap
- Featured image:
  - resolve `_thumbnail_id` to attachment URL when available
- Non-post content:
  - ignore all non-`post` post types in public migration output

## Approval Notes

- This schema is intended to satisfy Phase 2 task 2 while remaining compatible with existing sample content.
