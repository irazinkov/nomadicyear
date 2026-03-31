#!/usr/bin/env node

import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, extname, join, relative, resolve } from "node:path";

const contentRoots = [resolve("src/content/posts"), resolve("src/content/pages"), resolve("src/content/blog")];
const reportBase = resolve(process.argv[2] ?? "docs/phase-4-alt-fix-report");

function gatherFilesRecursive(rootDir, allowedExtensions) {
  if (!existsSync(rootDir)) return [];
  const files = [];
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
        files.push(absolutePath);
      }
    }
  }

  return files;
}

function readFrontmatter(text) {
  if (!text.startsWith("---\n")) return "";
  const endIndex = text.indexOf("\n---", 4);
  if (endIndex === -1) return "";
  return text.slice(4, endIndex);
}

function parseFrontmatterTitle(text) {
  const frontmatter = readFrontmatter(text);
  if (!frontmatter) return "";
  const match = frontmatter.match(/^\s*title\s*:\s*(.+)\s*$/m);
  if (!match) return "";
  const raw = match[1].trim();
  if (
    (raw.startsWith('"') && raw.endsWith('"')) ||
    (raw.startsWith("'") && raw.endsWith("'"))
  ) {
    return raw.slice(1, -1).trim();
  }
  return raw;
}

function toUploadsPathFromUrl(urlOrPath) {
  const value = (urlOrPath ?? "").trim();
  if (!value) return "";

  let normalized = value;
  normalized = normalized.replace(
    /^https?:\/\/(?:www\.)?nomadicyear\.com\/wp-content\/uploads\//i,
    "/uploads/",
  );
  normalized = normalized.replace(/^\/?wp-content\/uploads\//i, "/uploads/");
  normalized = normalized.replace(/^uploads\//i, "/uploads/");
  normalized = normalized.split("?")[0]?.split("#")[0] ?? normalized;

  return normalized.startsWith("/uploads/") ? normalized : "";
}

function cleanLabel(label) {
  return label.replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim();
}

function isGenericAssetLabel(label) {
  const simplified = cleanLabel(label).toLowerCase();
  return /^(dsc\s*\d+|img\s*\d+|image\s*\d+|capture\s*\d+|photo\s*\d+|go\s*\d+|i\s*\d+|p\s*\d+)$/.test(
    simplified,
  );
}

function toSafeAttr(value) {
  return value.replace(/"/g, "&quot;");
}

function writeReport(basePath, report) {
  const jsonPath = `${basePath}.json`;
  const mdPath = `${basePath}.md`;

  mkdirSync(dirname(jsonPath), { recursive: true });
  writeFileSync(jsonPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");

  const markdown = `# Phase 4 Alt Fix Report

Generated: ${report.generatedAt}

## Summary
- Files scanned: ${report.summary.filesScanned}
- Files changed: ${report.summary.filesChanged}
- Alt attributes fixed: ${report.summary.altAttributesFixed}

## Changed Files
${
  report.changedFiles.length === 0
    ? "- none"
    : report.changedFiles
        .map((item) => `- ${item.file}: ${item.fixedCount} fixes`)
        .join("\n")
}
`;

  writeFileSync(mdPath, `${markdown}\n`, "utf8");
}

const filesToScan = [
  ...new Set(
    contentRoots.flatMap((root) =>
      gatherFilesRecursive(root, new Set([".md", ".mdx"])),
    ),
  ),
];

let totalFixed = 0;
const changedFiles = [];
const htmlImagePattern = /<img\b([^>]*?)>/gi;

for (const filePath of filesToScan) {
  const original = readFileSync(filePath, "utf8");
  const postTitle = parseFrontmatterTitle(original) || "Nomadic Year travel photo";
  let fallbackCounter = 0;
  let fixedInFile = 0;

  const updated = original.replace(htmlImagePattern, (fullTag, attrs) => {
    const srcMatch = attrs.match(/\bsrc\s*=\s*["']([^"']+)["']/i);
    if (!srcMatch) return fullTag;

    const normalizedSrc = toUploadsPathFromUrl(srcMatch[1]);
    if (!normalizedSrc) return fullTag;

    const altMatch = fullTag.match(/\balt\s*=\s*["']([^"']*)["']/i);
    if (altMatch && altMatch[1].trim().length > 0) {
      return fullTag;
    }

    const titleMatch = fullTag.match(/\btitle\s*=\s*["']([^"']+)["']/i);
    const titleCandidate = titleMatch ? cleanLabel(titleMatch[1]) : "";

    let nextAlt = "";
    if (titleCandidate && !isGenericAssetLabel(titleCandidate)) {
      nextAlt = titleCandidate;
    } else {
      fallbackCounter += 1;
      nextAlt = `${postTitle} photo ${fallbackCounter}`;
    }

    const escapedAlt = toSafeAttr(nextAlt);
    fixedInFile += 1;

    if (altMatch) {
      return fullTag.replace(/\balt\s*=\s*["'][^"']*["']/i, `alt="${escapedAlt}"`);
    }
    if (fullTag.endsWith("/>")) {
      return fullTag.replace(/\/>$/, ` alt="${escapedAlt}" />`);
    }
    return fullTag.replace(/>$/, ` alt="${escapedAlt}">`);
  });

  if (updated !== original) {
    writeFileSync(filePath, updated, "utf8");
    totalFixed += fixedInFile;
    changedFiles.push({
      file: relative(process.cwd(), filePath),
      fixedCount: fixedInFile,
    });
  }
}

const report = {
  generatedAt: new Date().toISOString(),
  summary: {
    filesScanned: filesToScan.length,
    filesChanged: changedFiles.length,
    altAttributesFixed: totalFixed,
  },
  changedFiles,
};

writeReport(reportBase, report);

console.log(`Files scanned: ${filesToScan.length}`);
console.log(`Files changed: ${changedFiles.length}`);
console.log(`Alt attributes fixed: ${totalFixed}`);
console.log(`Report: ${reportBase}.json and ${reportBase}.md`);

