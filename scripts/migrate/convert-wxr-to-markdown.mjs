#!/usr/bin/env node

import {
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { join, resolve } from "node:path";

const inputPath = process.argv[2];
const outputDirArg = process.argv[3] ?? "src/content/posts";
const reportBaseArg = process.argv[4] ?? "docs/phase-2-migration-report";
const uploadsRootArg = process.argv[5];

if (!inputPath) {
  console.error(
    "Usage: node scripts/migrate/convert-wxr-to-markdown.mjs <wxr-xml-path> [output-dir] [report-base-path] [uploads-root]",
  );
  process.exit(1);
}

const outputDir = resolve(outputDirArg);
const reportBase = resolve(reportBaseArg);
const xml = readFileSync(resolve(inputPath), "utf8");

function resolveUploadsRoot() {
  if (uploadsRootArg) {
    return resolve(uploadsRootArg);
  }

  const candidates = [
    resolve(process.cwd(), "archive/uploads"),
    resolve(process.cwd(), "../../archive/uploads"),
    resolve(process.cwd(), "../../../archive/uploads"),
  ];

  for (const candidate of candidates) {
    try {
      if (statSync(candidate).isDirectory()) {
        return candidate;
      }
    } catch {
      // noop
    }
  }
  return candidates[0];
}

const uploadsRoot = resolveUploadsRoot();

const COUNTRY_CATEGORY_SLUGS = new Set([
  "argentina",
  "bolivia",
  "brazil",
  "chile",
  "china",
  "colombia",
  "costa-rica",
  "ecuador",
  "el-salvador",
  "guatemala",
  "honduras",
  "india",
  "kazakhstan",
  "kyrgyzstan",
  "laos",
  "malaysia",
  "mexico",
  "myanmar",
  "nicaragua",
  "panama",
  "paraguay",
  "peru",
  "russia",
  "south-korea",
  "thailand",
  "uruguay",
  "usa",
  "united-states",
  "vietnam",
]);

function decodeCdata(value) {
  return value
    .replace(/^<!\[CDATA\[/, "")
    .replace(/\]\]>$/, "")
    .trim();
}

function decodeHtmlEntities(input) {
  return input
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) =>
      String.fromCharCode(parseInt(code, 16)),
    )
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#039;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function getFirst(block, regex) {
  const match = block.match(regex);
  return match?.[1]?.trim() ?? "";
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

function parsePostMeta(block) {
  const metaEntries = [];
  const regex =
    /<wp:postmeta>\s*<wp:meta_key>([\s\S]*?)<\/wp:meta_key>\s*<wp:meta_value>([\s\S]*?)<\/wp:meta_value>\s*<\/wp:postmeta>/g;
  let match;
  while ((match = regex.exec(block)) !== null) {
    metaEntries.push({
      key: decodeCdata(match[1]),
      value: decodeCdata(match[2]),
    });
  }
  return metaEntries;
}

function normalizeSlug(input) {
  const value = input
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9\s-]/g, " ")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  return value || "untitled";
}

function toIsoDate(datetime) {
  if (!datetime) return "";
  if (datetime.includes("T")) return datetime;
  return `${datetime.replace(" ", "T")}Z`;
}

function cleanContent(content) {
  return content
    .replace(
      /<div[^>]*id=["']google_translate_element["'][^>]*>\s*<\/div>/gi,
      "",
    )
    .replace(
      /<script[^>]*>[\s\S]*?googleTranslateElementInit[\s\S]*?<\/script>/gi,
      "",
    )
    .replace(
      /<script[^>]*translate\.google\.com\/translate_a\/element\.js[^>]*><\/script>/gi,
      "",
    )
    .replace(/\[\/?caption[^\]]*\]/gi, "")
    .replace(/\[\/?gallery[^\]]*\]/gi, "")
    .replace(/\[(?:audio|video|embed)[^\]]*\]/gi, "")
    .replace(
      /https?:\/\/(?:www\.)?nomadicyear\.com\/?wp-content\/uploads\//gi,
      "/uploads/",
    )
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function stripHtml(input) {
  return decodeHtmlEntities(
    input.replace(/<[^>]+>/g, " ").replace(/\s+/g, " "),
  ).trim();
}

function summarize(text, maxLength = 180) {
  if (!text) return "";
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength).trim()}...`;
}

function yamlString(value) {
  return JSON.stringify(value ?? "");
}

function yamlArrayField(key, values) {
  if (!values.length) {
    return [`${key}: []`];
  }
  return [`${key}:`, ...values.map((value) => `  - ${yamlString(value)}`)];
}

function ensureCleanOutputDirectory(targetDir) {
  mkdirSync(targetDir, { recursive: true });
  for (const name of readdirSync(targetDir)) {
    if (name.endsWith(".md")) {
      rmSync(join(targetDir, name));
    }
  }
}

function extractUploadPaths(content) {
  const paths = new Set();
  const regex = /\/uploads\/[^\s"')<]+/g;
  let match;
  while ((match = regex.exec(content)) !== null) {
    paths.add(match[0]);
  }
  return [...paths];
}

function uploadPathExists(uploadUrlPath) {
  const relative = uploadUrlPath.replace(/^\/uploads\//, "");
  const filePath = join(uploadsRoot, relative);
  try {
    return statSync(filePath).isFile();
  } catch {
    return false;
  }
}

const itemBlocks = xml
  .split("<item>")
  .slice(1)
  .map((part) => part.split("</item>")[0] ?? "")
  .filter(Boolean);

const entries = itemBlocks.map((block) => {
  const title = decodeCdata(getFirst(block, /<title>([\s\S]*?)<\/title>/));
  const link = decodeCdata(getFirst(block, /<link>([\s\S]*?)<\/link>/));
  const postType = decodeCdata(
    getFirst(block, /<wp:post_type>([\s\S]*?)<\/wp:post_type>/),
  );
  const status = decodeCdata(
    getFirst(block, /<wp:status>([\s\S]*?)<\/wp:status>/),
  );
  const postId = decodeCdata(
    getFirst(block, /<wp:post_id>([\s\S]*?)<\/wp:post_id>/),
  );
  const slug = decodeCdata(
    getFirst(block, /<wp:post_name>([\s\S]*?)<\/wp:post_name>/),
  );
  const postDate = decodeCdata(
    getFirst(block, /<wp:post_date>([\s\S]*?)<\/wp:post_date>/),
  );
  const postDateGmt = decodeCdata(
    getFirst(block, /<wp:post_date_gmt>([\s\S]*?)<\/wp:post_date_gmt>/),
  );
  const postModified = decodeCdata(
    getFirst(block, /<wp:post_modified>([\s\S]*?)<\/wp:post_modified>/),
  );
  const postModifiedGmt = decodeCdata(
    getFirst(block, /<wp:post_modified_gmt>([\s\S]*?)<\/wp:post_modified_gmt>/),
  );
  const content = decodeCdata(
    getFirst(block, /<content:encoded>([\s\S]*?)<\/content:encoded>/),
  );
  const excerpt = decodeCdata(
    getFirst(block, /<excerpt:encoded>([\s\S]*?)<\/excerpt:encoded>/),
  );
  const attachmentUrl = decodeCdata(
    getFirst(block, /<wp:attachment_url>([\s\S]*?)<\/wp:attachment_url>/),
  );
  const categories = parseCategories(block);
  const postmeta = parsePostMeta(block);

  return {
    title,
    link,
    postType,
    status,
    postId,
    slug,
    postDate,
    postDateGmt,
    postModified,
    postModifiedGmt,
    content,
    excerpt,
    attachmentUrl,
    categories,
    postmeta,
  };
});

const attachmentById = new Map();
for (const entry of entries.filter(
  (entry) => entry.postType === "attachment",
)) {
  const metaMap = Object.fromEntries(
    entry.postmeta.map((meta) => [meta.key, meta.value]),
  );
  attachmentById.set(entry.postId, {
    url: entry.attachmentUrl,
    title: entry.title,
    alt: metaMap._wp_attachment_image_alt ?? "",
    attachedFile: metaMap._wp_attached_file ?? "",
  });
}

const posts = entries.filter((entry) => entry.postType === "post");
const usedSlugs = new Set();
const warnings = [];
const errors = [];
const unresolvedMedia = new Set();
const unresolvedFeaturedImages = [];

ensureCleanOutputDirectory(outputDir);

let generatedCount = 0;
for (const post of posts) {
  if (!post.title) {
    errors.push({
      postId: post.postId,
      slug: post.slug,
      issue: "missing_title",
    });
    continue;
  }

  const normalizedBaseSlug = normalizeSlug(
    post.slug || post.title || `post-${post.postId}`,
  );
  let finalSlug = normalizedBaseSlug;
  let dedupeCounter = 2;
  while (usedSlugs.has(finalSlug)) {
    finalSlug = `${normalizedBaseSlug}-${dedupeCounter}`;
    dedupeCounter += 1;
  }
  if (finalSlug !== normalizedBaseSlug) {
    warnings.push({
      postId: post.postId,
      slug: finalSlug,
      issue: "slug_deduplicated",
    });
  }
  usedSlugs.add(finalSlug);

  if (/^\d+$/.test(finalSlug)) {
    warnings.push({
      postId: post.postId,
      slug: finalSlug,
      issue: "numeric_slug",
    });
  }

  const categorySlugs = [
    ...new Set(
      post.categories
        .filter((category) => category.domain === "category")
        .map((category) => normalizeSlug(category.nicename || category.label)),
    ),
  ];
  const tagSlugs = [
    ...new Set(
      post.categories
        .filter((category) => category.domain === "post_tag")
        .map((category) => normalizeSlug(category.nicename || category.label)),
    ),
  ];

  const country = categorySlugs.find((slug) =>
    COUNTRY_CATEGORY_SLUGS.has(slug),
  );

  const cleanBody = cleanContent(post.content);
  if (!cleanBody) {
    warnings.push({
      postId: post.postId,
      slug: finalSlug,
      issue: "missing_content",
    });
  }

  for (const uploadPath of extractUploadPaths(cleanBody)) {
    if (!uploadPathExists(uploadPath)) {
      unresolvedMedia.add(uploadPath);
    }
  }

  const explicitExcerpt = stripHtml(post.excerpt);
  const derivedSummary = summarize(stripHtml(cleanBody), 200);
  const description = explicitExcerpt || derivedSummary;

  const metaMap = Object.fromEntries(
    post.postmeta.map((meta) => [meta.key, meta.value]),
  );
  const thumbId = metaMap._thumbnail_id;
  const featuredAttachment = thumbId ? attachmentById.get(thumbId) : undefined;

  let heroImage = "";
  let heroImageAlt = "";
  if (featuredAttachment?.url) {
    heroImage = featuredAttachment.url.replace(
      /https?:\/\/(?:www\.)?nomadicyear\.com\/wp-content\/uploads\//i,
      "/uploads/",
    );
    heroImageAlt = featuredAttachment.alt || featuredAttachment.title || "";
    if (heroImage.startsWith("/uploads/") && !uploadPathExists(heroImage)) {
      unresolvedMedia.add(heroImage);
    }
  } else if (thumbId) {
    unresolvedFeaturedImages.push({
      postId: post.postId,
      thumbId,
      slug: finalSlug,
    });
  }

  const pubDate = toIsoDate(post.postDateGmt || post.postDate);
  if (!pubDate) {
    errors.push({
      postId: post.postId,
      slug: finalSlug,
      issue: "missing_pub_date",
    });
    continue;
  }
  const updatedDate = toIsoDate(post.postModifiedGmt || post.postModified);

  const status = post.status === "publish" ? "publish" : "draft";
  const draft = status !== "publish";

  const frontmatterLines = [
    "---",
    `title: ${yamlString(post.title)}`,
    `slug: ${yamlString(finalSlug)}`,
    `pubDate: ${yamlString(pubDate)}`,
    ...(updatedDate ? [`updatedDate: ${yamlString(updatedDate)}`] : []),
    `description: ${yamlString(description)}`,
    `excerpt: ${yamlString(description)}`,
    ...(heroImage ? [`heroImage: ${yamlString(heroImage)}`] : []),
    ...(heroImageAlt ? [`heroImageAlt: ${yamlString(heroImageAlt)}`] : []),
    ...(country ? [`country: ${yamlString(country)}`] : []),
    ...yamlArrayField("categories", categorySlugs),
    ...yamlArrayField("tags", tagSlugs),
    ...(post.link ? [`legacyUrl: ${yamlString(post.link)}`] : []),
    `status: ${yamlString(status)}`,
    `draft: ${draft ? "true" : "false"}`,
    "---",
    "",
  ];

  const markdown = `${frontmatterLines.join("\n")}${cleanBody}\n`;
  writeFileSync(join(outputDir, `${finalSlug}.md`), markdown, "utf8");
  generatedCount += 1;
}

const report = {
  generatedAt: new Date().toISOString(),
  sourceWxr: resolve(inputPath),
  outputDir,
  uploadsRoot,
  totals: {
    wxrItems: entries.length,
    postsInWxr: posts.length,
    generatedPosts: generatedCount,
  },
  counts: {
    warnings: warnings.length,
    errors: errors.length,
    unresolvedMedia: unresolvedMedia.size,
    unresolvedFeaturedImages: unresolvedFeaturedImages.length,
  },
  warnings,
  errors,
  unresolvedMedia: [...unresolvedMedia].sort(),
  unresolvedFeaturedImages,
};

const reportJsonPath = `${reportBase}.json`;
const reportMdPath = `${reportBase}.md`;
writeFileSync(reportJsonPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");

const reportMarkdown = `# Phase 2 Migration Report

Generated: ${report.generatedAt}
Source: ${report.sourceWxr}
Output: ${report.outputDir}

## Totals
- WXR items: ${report.totals.wxrItems}
- Posts in WXR: ${report.totals.postsInWxr}
- Generated posts: ${report.totals.generatedPosts}

## Validation Buckets
- Warnings: ${report.counts.warnings}
- Errors (critical): ${report.counts.errors}
- Unresolved media paths: ${report.counts.unresolvedMedia}
- Unresolved featured images: ${report.counts.unresolvedFeaturedImages}

## Critical Errors
${report.errors.length === 0 ? "- none" : report.errors.map((error) => `- ${JSON.stringify(error)}`).join("\n")}

## Warnings (first 25)
${
  report.warnings.length === 0
    ? "- none"
    : report.warnings
        .slice(0, 25)
        .map((warning) => `- ${JSON.stringify(warning)}`)
        .join("\n")
}

## Unresolved Media (first 25)
${
  report.unresolvedMedia.length === 0
    ? "- none"
    : report.unresolvedMedia
        .slice(0, 25)
        .map((path) => `- ${path}`)
        .join("\n")
}
`;

writeFileSync(reportMdPath, `${reportMarkdown}\n`, "utf8");

console.log(`Generated ${generatedCount} markdown posts in ${outputDir}`);
console.log(`Report written to ${reportJsonPath} and ${reportMdPath}`);

if (errors.length > 0) {
  console.error(`Migration failed with ${errors.length} critical errors.`);
  process.exit(1);
}
