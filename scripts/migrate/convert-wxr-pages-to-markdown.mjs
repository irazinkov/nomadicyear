#!/usr/bin/env node

import {
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { join, resolve } from "node:path";

const inputPath = process.argv[2];
const outputDirArg = process.argv[3] ?? "src/content/pages";

if (!inputPath) {
  console.error(
    "Usage: node scripts/migrate/convert-wxr-pages-to-markdown.mjs <wxr-xml-path> [output-dir]",
  );
  process.exit(1);
}

const outputDir = resolve(outputDirArg);
const xml = readFileSync(resolve(inputPath), "utf8");

const INCLUDED_SLUGS = new Set([
  "video",
  "image-gallery",
  "map",
  "preparation",
  "travel-tips",
  "sponsors-and-credits",
  "photos-with-friends",
  "south-america-expense-report-in-korean",
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
    .replace(/\[(?:\/)?[a-z0-9_-]+[^\]]*\]/gi, "")
    .replace(
      /https?:\/\/(?:www\.)?nomadicyear\.com\/?wp-content\/uploads\//gi,
      "/uploads/",
    )
    .replace(
      /https?:\/\/(?:www\.)?nomadicyear\.comwp-content\/uploads\//gi,
      "/uploads/",
    )
    .replace(
      /https?:\/\/(?:www\.)?nomadicyear\.com(\d{4}\/\d{2}\/[^\s"'<>]+)/gi,
      "https://nomadicyear.com/$1",
    )
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function yamlString(value) {
  return JSON.stringify(value ?? "");
}

function ensureCleanOutputDirectory(targetDir) {
  mkdirSync(targetDir, { recursive: true });
  for (const name of readdirSync(targetDir)) {
    if (name.endsWith(".md")) {
      rmSync(join(targetDir, name));
    }
  }
}

const itemBlocks = xml
  .split("<item>")
  .slice(1)
  .map((part) => part.split("</item>")[0] ?? "")
  .filter(Boolean);

const pages = itemBlocks
  .map((block) => ({
    title: decodeCdata(getFirst(block, /<title>([\s\S]*?)<\/title>/)),
    link: decodeCdata(getFirst(block, /<link>([\s\S]*?)<\/link>/)),
    postType: decodeCdata(
      getFirst(block, /<wp:post_type>([\s\S]*?)<\/wp:post_type>/),
    ),
    status: decodeCdata(getFirst(block, /<wp:status>([\s\S]*?)<\/wp:status>/)),
    slug: decodeCdata(
      getFirst(block, /<wp:post_name>([\s\S]*?)<\/wp:post_name>/),
    ),
    content: decodeCdata(
      getFirst(block, /<content:encoded>([\s\S]*?)<\/content:encoded>/),
    ),
  }))
  .filter(
    (entry) =>
      entry.postType === "page" &&
      entry.status === "publish" &&
      INCLUDED_SLUGS.has(entry.slug),
  );

ensureCleanOutputDirectory(outputDir);

for (const page of pages) {
  const cleaned = cleanContent(page.content);
  const fallbackBody =
    page.slug === "map"
      ? '<p>Route map content from WordPress is being migrated. In the meantime, browse destinations in the <a href="/destinations/">Destinations section</a>.</p>'
      : "<p>This legacy page was migrated from WordPress and is being refined.</p>";

  const description = summarize(stripHtml(cleaned), 200);

  const frontmatterLines = [
    "---",
    `title: ${yamlString(page.title)}`,
    `slug: ${yamlString(page.slug)}`,
    `description: ${yamlString(description || `Legacy page: ${page.title}`)}`,
    ...(page.link ? [`legacyUrl: ${yamlString(page.link)}`] : []),
    "draft: false",
    "---",
    "",
  ];

  const markdown = `${frontmatterLines.join("\n")}${cleaned || fallbackBody}\n`;
  writeFileSync(join(outputDir, `${page.slug}.md`), markdown, "utf8");
}

console.log(`Generated ${pages.length} legacy pages in ${outputDir}`);
