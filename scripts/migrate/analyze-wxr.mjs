#!/usr/bin/env node

import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const inputPath = process.argv[2];
const outputPath = process.argv[3] ?? "docs/phase-2-export-analysis.md";

if (!inputPath) {
  console.error(
    "Usage: node scripts/migrate/analyze-wxr.mjs <path-to-wxr-xml> [output-md]",
  );
  process.exit(1);
}

const xml = readFileSync(resolve(inputPath), "utf8");
const itemBlocks = xml
  .split("<item>")
  .slice(1)
  .map((part) => part.split("</item>")[0] ?? "")
  .filter(Boolean);

function getFirst(block, regex) {
  const match = block.match(regex);
  return match?.[1]?.trim() ?? "";
}

function decodeCdata(value) {
  return value
    .replace(/^<!\[CDATA\[/, "")
    .replace(/\]\]>$/, "")
    .trim();
}

function parseCategories(block) {
  const categories = [];
  const regex =
    /<category\s+domain="([^"]+)"\s+nicename="([^"]*)">([\s\S]*?)<\/category>/g;
  let match;
  while ((match = regex.exec(block)) !== null) {
    categories.push({
      domain: match[1],
      nicename: match[2],
      label: decodeCdata(match[3]),
    });
  }
  return categories;
}

function countBy(items, selector) {
  const map = new Map();
  for (const item of items) {
    const key = selector(item);
    map.set(key, (map.get(key) ?? 0) + 1);
  }
  return [...map.entries()].sort((a, b) => b[1] - a[1]);
}

const entries = itemBlocks.map((block) => {
  const title = decodeCdata(getFirst(block, /<title>([\s\S]*?)<\/title>/));
  const postType = decodeCdata(
    getFirst(block, /<wp:post_type>([\s\S]*?)<\/wp:post_type>/),
  );
  const status = decodeCdata(
    getFirst(block, /<wp:status>([\s\S]*?)<\/wp:status>/),
  );
  const slug = decodeCdata(
    getFirst(block, /<wp:post_name>([\s\S]*?)<\/wp:post_name>/),
  );
  const postDate = decodeCdata(
    getFirst(block, /<wp:post_date>([\s\S]*?)<\/wp:post_date>/),
  );
  const content = decodeCdata(
    getFirst(block, /<content:encoded>([\s\S]*?)<\/content:encoded>/),
  );
  const excerpt = decodeCdata(
    getFirst(block, /<excerpt:encoded>([\s\S]*?)<\/excerpt:encoded>/),
  );
  const creator = decodeCdata(
    getFirst(block, /<dc:creator>([\s\S]*?)<\/dc:creator>/),
  );
  const categories = parseCategories(block);
  const hasFeaturedImageMeta =
    /<wp:meta_key><!\[CDATA\[_thumbnail_id\]\]><\/wp:meta_key>/.test(block);

  return {
    title,
    postType,
    status,
    slug,
    postDate,
    content,
    excerpt,
    creator,
    categories,
    hasFeaturedImageMeta,
  };
});

const posts = entries.filter((entry) => entry.postType === "post");
const pages = entries.filter((entry) => entry.postType === "page");
const attachments = entries.filter((entry) => entry.postType === "attachment");

const postCategories = new Set();
const postTags = new Set();
const postCountryCandidates = new Set();
for (const post of posts) {
  for (const cat of post.categories) {
    if (cat.domain === "category") {
      postCategories.add(
        cat.nicename || cat.label.toLowerCase().replace(/\s+/g, "-"),
      );
      postCountryCandidates.add(cat.label);
    }
    if (cat.domain === "post_tag") {
      postTags.add(
        cat.nicename || cat.label.toLowerCase().replace(/\s+/g, "-"),
      );
    }
  }
}

const duplicateSlugCounts = new Map();
for (const post of posts) {
  if (!post.slug) continue;
  duplicateSlugCounts.set(
    post.slug,
    (duplicateSlugCounts.get(post.slug) ?? 0) + 1,
  );
}
const duplicateSlugs = [...duplicateSlugCounts.entries()].filter(
  ([, count]) => count > 1,
);

const postDates = posts
  .map((post) => post.postDate)
  .filter(Boolean)
  .sort((a, b) => a.localeCompare(b));

const postsMissingTitle = posts.filter((post) => !post.title).length;
const postsMissingSlug = posts.filter((post) => !post.slug).length;
const postsMissingContent = posts.filter((post) => !post.content).length;
const postsMissingExcerpt = posts.filter((post) => !post.excerpt).length;
const postsWithoutCategory = posts.filter(
  (post) => !post.categories.some((category) => category.domain === "category"),
).length;
const postsWithFeaturedImageMeta = posts.filter(
  (post) => post.hasFeaturedImageMeta,
).length;
const numericSlugs = posts
  .filter((post) => /^\d+$/.test(post.slug))
  .map((post) => post.slug);

const markdown = `# Phase 2 Export Analysis

Generated: ${new Date().toISOString()}
Source: ${resolve(inputPath)}

## Inventory Summary

- Total WXR items: ${entries.length}
- Posts: ${posts.length}
- Pages: ${pages.length}
- Attachments: ${attachments.length}

## Post Quality Checks

- Posts missing title: ${postsMissingTitle}
- Posts missing slug: ${postsMissingSlug}
- Posts missing content: ${postsMissingContent}
- Posts missing excerpt: ${postsMissingExcerpt}
- Posts without category: ${postsWithoutCategory}
- Posts with featured-image metadata (\`_thumbnail_id\`): ${postsWithFeaturedImageMeta}
- Numeric slugs (potential cleanup candidates): ${numericSlugs.length}

## Date Range (Posts)

- Earliest post date: ${postDates[0] ?? "n/a"}
- Latest post date: ${postDates[postDates.length - 1] ?? "n/a"}

## Top Item Types

${countBy(entries, (entry) => entry.postType || "(missing)")
  .slice(0, 10)
  .map(([type, count]) => `- ${type}: ${count}`)
  .join("\n")}

## Top Post Statuses

${countBy(posts, (entry) => entry.status || "(missing)")
  .slice(0, 10)
  .map(([status, count]) => `- ${status}: ${count}`)
  .join("\n")}

## Taxonomy Signals from Posts

- Unique categories attached to posts: ${postCategories.size}
- Unique tags attached to posts: ${postTags.size}
- Distinct category labels (candidate countries/categories): ${postCountryCandidates.size}

## Edge Cases

- Duplicate post slugs: ${duplicateSlugs.length}
${duplicateSlugs
  .slice(0, 20)
  .map(([slug, count]) => `  - ${slug}: ${count}`)
  .join("\n")}
- Numeric-only slugs (sample): ${numericSlugs.slice(0, 20).join(", ") || "none"}

## Recommendations for Phase 2

1. Filter migration input to \`post_type=post\` and \`status=publish\` for public content.
2. Preserve legacy slugs where possible; flag numeric-only slugs for manual rename map.
3. Derive \`categories\` from taxonomy domain \`category\` and \`tags\` from \`post_tag\`.
4. Compute \`country\` from category set only when it matches approved country list.
5. Fallback excerpt strategy: use explicit excerpt when present, otherwise derive from stripped content.
6. Featured image strategy: resolve \`_thumbnail_id\` to attachment URL when available.
`;

writeFileSync(resolve(outputPath), markdown, "utf8");
console.log(`Wrote analysis report to ${resolve(outputPath)}`);
