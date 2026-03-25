# Phase 2 Export Analysis

Generated: 2026-03-25T00:24:13.389Z
Source: /Users/ivanrazinkov/Desktop/NomadicYear/archive/nomadicyear.WordPress.2026-03-24.xml

## Inventory Summary

- Total WXR items: 5781
- Posts: 74
- Pages: 13
- Attachments: 5665

## Post Quality Checks

- Posts missing title: 0
- Posts missing slug: 0
- Posts missing content: 1
- Posts missing excerpt: 74
- Posts without category: 0
- Posts with featured-image metadata (`_thumbnail_id`): 71
- Numeric slugs (potential cleanup candidates): 1

## Date Range (Posts)

- Earliest post date: 2015-07-30 20:55:00
- Latest post date: 2024-11-20 10:52:08

## Top Item Types

- attachment: 5665
- post: 74
- page: 13
- visualizer: 13
- nav_menu_item: 8
- es_template: 3
- tablepress_table: 3
- custom_css: 1
- wp_global_styles: 1

## Top Post Statuses

- publish: 74

## Taxonomy Signals from Posts

- Unique categories attached to posts: 27
- Unique tags attached to posts: 480
- Distinct category labels (candidate countries/categories): 27

## Edge Cases

- Duplicate post slugs: 0

- Numeric-only slugs (sample): 566

## Recommendations for Phase 2

1. Filter migration input to `post_type=post` and `status=publish` for public content.
2. Preserve legacy slugs where possible; flag numeric-only slugs for manual rename map.
3. Derive `categories` from taxonomy domain `category` and `tags` from `post_tag`.
4. Compute `country` from category set only when it matches approved country list.
5. Fallback excerpt strategy: use explicit excerpt when present, otherwise derive from stripped content.
6. Featured image strategy: resolve `_thumbnail_id` to attachment URL when available.
