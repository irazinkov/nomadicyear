#!/usr/bin/env node

import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, extname, join, relative, resolve } from "node:path";

const rawArgs = process.argv.slice(2);
const positionalArgs = rawArgs.filter((arg) => !arg.startsWith("--"));

const publicUploadsRoot = resolve(positionalArgs[0] ?? "public/uploads");
const reportBase = resolve(positionalArgs[1] ?? "docs/phase-4-validation-report");

const failOnMissingAlt = rawArgs.includes("--fail-on-missing-alt");

const contentRoots = [
  resolve("src/content/posts"),
  resolve("src/content/pages"),
  resolve("src/content/blog"),
  resolve("src/pages"),
];

function normalizeRelativeUploadPath(input) {
  let value = input.trim();
  value = value.replace(/\\/g, "/").replace(/^\/+/, "");
  value = value.replace(/^uploads\//, "");
  value = value.replace(/^wp-content\/uploads\//, "");
  value = value.split("?")[0]?.split("#")[0] ?? value;
  return value;
}

function toUploadsPathFromUrl(urlOrPath) {
  const value = urlOrPath.trim();
  if (!value) return "";

  let normalized = value;
  normalized = normalized.replace(
    /^https?:\/\/(?:www\.)?nomadicyear\.com\/wp-content\/uploads\//i,
    "/uploads/",
  );
  normalized = normalized.replace(/^\/?wp-content\/uploads\//i, "/uploads/");
  normalized = normalized.replace(/^uploads\//i, "/uploads/");

  const noQuery = normalized.split("?")[0]?.split("#")[0] ?? normalized;
  if (!noQuery.startsWith("/uploads/")) return "";

  try {
    return decodeURI(noQuery);
  } catch {
    return noQuery;
  }
}

function gatherFilesRecursive(rootDir, allowedExtensions) {
  if (!existsSync(rootDir)) return [];
  const results = [];
  const stack = [rootDir];

  while (stack.length > 0) {
    const current = stack.pop();
    for (const name of readdirSync(current)) {
      const absolutePath = join(current, name);
      const stats = statSync(absolutePath);
      if (stats.isDirectory()) {
        stack.push(absolutePath);
        continue;
      }
      if (!stats.isFile()) continue;
      if (allowedExtensions.has(extname(name).toLowerCase())) {
        results.push(absolutePath);
      }
    }
  }

  return results;
}

function readFrontmatter(fileText) {
  if (!fileText.startsWith("---\n")) return "";
  const end = fileText.indexOf("\n---", 4);
  if (end === -1) return "";
  return fileText.slice(4, end);
}

function parseSimpleFrontmatterScalar(frontmatterText, key) {
  const pattern = new RegExp(`^\\s*${key}\\s*:\\s*(.+)\\s*$`, "m");
  const match = frontmatterText.match(pattern);
  if (!match) return "";
  const raw = match[1].trim();
  if (!raw || raw === "null" || raw === "[]" || raw === "{}") return "";
  if (
    (raw.startsWith('"') && raw.endsWith('"')) ||
    (raw.startsWith("'") && raw.endsWith("'"))
  ) {
    return raw.slice(1, -1).trim();
  }
  return raw;
}

function parseSimpleFrontmatterArray(frontmatterText, key) {
  const pattern = new RegExp(`^\\s*${key}\\s*:\\s*\\[(.*?)\\]\\s*$`, "m");
  const match = frontmatterText.match(pattern);
  if (!match) return [];
  return match[1]
    .split(",")
    .map((value) => value.trim().replace(/^["']|["']$/g, ""))
    .filter(Boolean);
}

function existsFileWithExactCase(rootDir, relativePath) {
  const segments = relativePath.split("/").filter(Boolean);
  if (segments.length === 0) return false;

  let currentPath = rootDir;
  for (let index = 0; index < segments.length; index += 1) {
    const segment = segments[index];
    if (!existsSync(currentPath)) return false;
    const currentStats = statSync(currentPath);
    if (!currentStats.isDirectory()) return false;

    const entries = readdirSync(currentPath);
    if (!entries.includes(segment)) return false;

    currentPath = join(currentPath, segment);
    const isFinal = index === segments.length - 1;
    const nextStats = statSync(currentPath);
    if (isFinal && !nextStats.isFile()) return false;
    if (!isFinal && !nextStats.isDirectory()) return false;
  }

  return true;
}

function writeReport(basePath, report) {
  const jsonPath = `${basePath}.json`;
  const mdPath = `${basePath}.md`;

  mkdirSync(dirname(jsonPath), { recursive: true });
  writeFileSync(jsonPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");

  const markdown = `# Phase 4 Validation Report

Generated: ${report.generatedAt}
Public uploads root: ${report.inputs.publicUploadsRoot}

## Summary
- Content files scanned: ${report.summary.contentFilesScanned}
- Unique upload refs: ${report.summary.uniqueUploadRefs}
- Missing referenced upload refs: ${report.summary.missingUploadRefs}
- Markdown image alt gaps: ${report.summary.markdownImageAltGaps}
- HTML image alt gaps: ${report.summary.htmlImageAltGaps}
- Hero image alt gaps: ${report.summary.heroImageAltGaps}
- Total alt gaps: ${report.summary.totalAltGaps}

## Missing Referenced Upload Refs (first 100)
${
  report.missingUploadRefExamples.length === 0
    ? "- none"
    : report.missingUploadRefExamples
        .map(
          (item) =>
            `- ${item.asset} (referenced by: ${item.referencedBy.join(", ")})`,
        )
        .join("\n")
}

## Alt Gaps (first 100)
${
  report.altGapExamples.length === 0
    ? "- none"
    : report.altGapExamples
        .map(
          (item) =>
            `- [${item.type}] ${item.file}${item.context ? ` :: ${item.context}` : ""}`,
        )
        .join("\n")
}
`;

  writeFileSync(mdPath, `${markdown}\n`, "utf8");
}

if (!existsSync(publicUploadsRoot)) {
  console.error(`public uploads root not found: ${publicUploadsRoot}`);
  process.exit(1);
}

const filesToScan = [
  ...new Set(
    contentRoots.flatMap((root) =>
      gatherFilesRecursive(root, new Set([".md", ".mdx", ".astro", ".js", ".ts"])),
    ),
  ),
];

const uploadRefs = new Map();
const missingAltIssues = [];

const uploadPattern =
  /(?:https?:\/\/(?:www\.)?nomadicyear\.com\/wp-content\/uploads\/|\/wp-content\/uploads\/|\/uploads\/|uploads\/)[^\s"'`)<]+/gi;
const markdownImagePattern = /!\[([^\]]*)\]\(([^)\s]+(?:\s+"[^"]*")?)\)/g;
const htmlImagePattern = /<img\b([^>]*?)>/gi;

for (const filePath of filesToScan) {
  const text = readFileSync(filePath, "utf8");
  const relPath = relative(process.cwd(), filePath);

  let uploadMatch;
  while ((uploadMatch = uploadPattern.exec(text)) !== null) {
    const normalized = toUploadsPathFromUrl(uploadMatch[0]);
    if (!normalized) continue;
    const refs = uploadRefs.get(normalized) ?? new Set();
    refs.add(relPath);
    uploadRefs.set(normalized, refs);
  }

  if (filePath.endsWith(".md") || filePath.endsWith(".mdx")) {
    let markdownMatch;
    while ((markdownMatch = markdownImagePattern.exec(text)) !== null) {
      const altText = markdownMatch[1]?.trim() ?? "";
      const rawTarget = markdownMatch[2]?.trim() ?? "";
      const target = rawTarget.replace(/^<|>$/g, "");
      const normalizedTarget = toUploadsPathFromUrl(target);
      if (normalizedTarget && altText.length === 0) {
        missingAltIssues.push({
          type: "markdown-image-alt-missing",
          file: relPath,
          context: normalizedTarget,
        });
      }
    }

    let htmlMatch;
    while ((htmlMatch = htmlImagePattern.exec(text)) !== null) {
      const attrs = htmlMatch[1] ?? "";
      const srcMatch = attrs.match(/\bsrc\s*=\s*["']([^"']+)["']/i);
      const altMatch = attrs.match(/\balt\s*=\s*["']([^"']*)["']/i);
      const normalizedSrc = srcMatch ? toUploadsPathFromUrl(srcMatch[1]) : "";
      if (!normalizedSrc) continue;
      if (!altMatch || altMatch[1].trim().length === 0) {
        missingAltIssues.push({
          type: "html-image-alt-missing",
          file: relPath,
          context: normalizedSrc,
        });
      }
    }
  }

  if (filePath.includes("/src/content/posts/") && filePath.endsWith(".md")) {
    const frontmatter = readFrontmatter(text);
    if (frontmatter) {
      const heroImage = parseSimpleFrontmatterScalar(frontmatter, "heroImage");
      const heroImageAlt = parseSimpleFrontmatterScalar(frontmatter, "heroImageAlt");
      const heroImageArray = parseSimpleFrontmatterArray(frontmatter, "heroImage");
      const hasHeroImage =
        heroImage.length > 0 || heroImageArray.length > 0;
      if (hasHeroImage && heroImageAlt.trim().length === 0) {
        missingAltIssues.push({
          type: "hero-image-alt-missing",
          file: relPath,
          context: heroImage || heroImageArray.join(", "),
        });
      }
    }
  }
}

const missingUploadRefs = [];
for (const [assetPath, refs] of uploadRefs.entries()) {
  const relativePath = normalizeRelativeUploadPath(assetPath);
  if (!existsFileWithExactCase(publicUploadsRoot, relativePath)) {
    missingUploadRefs.push({
      asset: assetPath,
      referencedBy: [...refs].sort(),
    });
  }
}

const markdownImageAltGaps = missingAltIssues.filter(
  (item) => item.type === "markdown-image-alt-missing",
).length;
const htmlImageAltGaps = missingAltIssues.filter(
  (item) => item.type === "html-image-alt-missing",
).length;
const heroImageAltGaps = missingAltIssues.filter(
  (item) => item.type === "hero-image-alt-missing",
).length;

const report = {
  generatedAt: new Date().toISOString(),
  inputs: {
    publicUploadsRoot,
    failOnMissingAlt,
  },
  summary: {
    contentFilesScanned: filesToScan.length,
    uniqueUploadRefs: uploadRefs.size,
    missingUploadRefs: missingUploadRefs.length,
    markdownImageAltGaps,
    htmlImageAltGaps,
    heroImageAltGaps,
    totalAltGaps: missingAltIssues.length,
  },
  missingUploadRefExamples: missingUploadRefs.slice(0, 100),
  altGapExamples: missingAltIssues.slice(0, 100),
};

writeReport(reportBase, report);

console.log(`Validated Phase 4 media against ${publicUploadsRoot}`);
console.log(`Unique upload refs: ${uploadRefs.size}`);
console.log(`Missing referenced upload refs: ${missingUploadRefs.length}`);
console.log(`Total alt gaps: ${missingAltIssues.length}`);
console.log(`Report: ${reportBase}.json and ${reportBase}.md`);

if (missingUploadRefs.length > 0) {
  console.error(
    `Failing: ${missingUploadRefs.length} referenced upload paths are missing from public/uploads.`,
  );
  process.exit(2);
}

if (failOnMissingAlt && missingAltIssues.length > 0) {
  console.error(
    `Failing: ${missingAltIssues.length} alt gaps found with --fail-on-missing-alt enabled.`,
  );
  process.exit(3);
}

