#!/usr/bin/env node

import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { dirname, extname, join, relative, resolve } from "node:path";

const rawArgs = process.argv.slice(2);
const positionalArgs = rawArgs.filter((arg) => !arg.startsWith("--"));

const newUploadsRoot = resolve(positionalArgs[0] ?? "archive/new_uploads");
const uploadsRoot = resolve(positionalArgs[1] ?? "archive/uploads");
const publicUploadsRoot = resolve(positionalArgs[2] ?? "public/uploads");
const reportBase = resolve(
  positionalArgs[3] ?? "docs/phase-4-public-sync-report",
);

const failOnMissing = rawArgs.includes("--fail-on-missing");

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
      const stat = statSync(absolutePath);
      if (stat.isDirectory()) {
        stack.push(absolutePath);
        continue;
      }
      if (!stat.isFile()) continue;
      if (allowedExtensions.has(extname(name).toLowerCase())) {
        results.push(absolutePath);
      }
    }
  }

  return results;
}

const directoryIndexCache = new Map();

function getDirectoryIndex(directoryPath) {
  const cached = directoryIndexCache.get(directoryPath);
  if (cached) return cached;

  if (!existsSync(directoryPath)) return null;
  const stats = statSync(directoryPath);
  if (!stats.isDirectory()) return null;

  const names = readdirSync(directoryPath);
  const exact = new Set(names);
  const lowerToNames = new Map();

  for (const name of names) {
    const key = name.toLowerCase();
    const variants = lowerToNames.get(key) ?? [];
    variants.push(name);
    lowerToNames.set(key, variants);
  }

  const index = { exact, lowerToNames };
  directoryIndexCache.set(directoryPath, index);
  return index;
}

function resolveSourceFileCaseAware(rootDir, relativePath) {
  const segments = relativePath.split("/").filter(Boolean);
  if (segments.length === 0) return null;

  let currentPath = rootDir;
  let usedCaseFallback = false;
  let ambiguousFallback = false;

  for (let index = 0; index < segments.length; index += 1) {
    const segment = segments[index];
    const dirIndex = getDirectoryIndex(currentPath);
    if (!dirIndex) return null;

    let selectedName = "";
    if (dirIndex.exact.has(segment)) {
      selectedName = segment;
    } else {
      const matches = dirIndex.lowerToNames.get(segment.toLowerCase()) ?? [];
      if (matches.length === 0) return null;
      selectedName = [...matches].sort()[0];
      usedCaseFallback = true;
      if (matches.length > 1) ambiguousFallback = true;
    }

    currentPath = join(currentPath, selectedName);
    const currentStats = statSync(currentPath);
    const isFinal = index === segments.length - 1;

    if (isFinal && !currentStats.isFile()) return null;
    if (!isFinal && !currentStats.isDirectory()) return null;
  }

  return {
    path: currentPath,
    usedCaseFallback,
    ambiguousFallback,
  };
}

function writeReport(reportPathBase, report) {
  const jsonPath = `${reportPathBase}.json`;
  const mdPath = `${reportPathBase}.md`;

  mkdirSync(dirname(jsonPath), { recursive: true });
  writeFileSync(jsonPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");

  const markdown = `# Phase 4 Public Upload Sync Report

Generated: ${report.generatedAt}
Inputs:
- new_uploads: ${report.inputs.newUploadsRoot}
- uploads: ${report.inputs.uploadsRoot}
- target public/uploads: ${report.inputs.publicUploadsRoot}

## Summary
- Content files scanned: ${report.summary.contentFilesScanned}
- Unique upload refs: ${report.summary.uniqueUploadRefs}
- Copied from new_uploads: ${report.summary.copiedFromNewUploads}
- Copied from uploads fallback: ${report.summary.copiedFromUploadsFallback}
- Missing refs: ${report.summary.missingRefs}
- Unique target files written: ${report.summary.uniqueTargetFilesWritten}
- Duplicate normalized target paths: ${report.summary.duplicateNormalizedTargetPaths}
- Case-variant path collisions: ${report.summary.caseVariantPathCollisions}
- Case-fallback source matches used: ${report.summary.caseFallbackSourceMatches}
- Ambiguous case-fallback matches: ${report.summary.ambiguousCaseFallbackMatches}

## Missing Refs (first 100)
${
  report.missingExamples.length === 0
    ? "- none"
    : report.missingExamples
        .map((item) => `- ${item.asset} (referenced by: ${item.referencedBy.join(", ")})`)
        .join("\n")
}

## Duplicate Normalized Target Paths (first 100)
${
  report.duplicateTargetPathExamples.length === 0
    ? "- none"
    : report.duplicateTargetPathExamples
        .map(
          (item) =>
            `- ${item.normalizedPath}: ${item.assets.join(", ")}`,
        )
        .join("\n")
}

## Case-Variant Path Collisions (first 100)
${
  report.caseVariantCollisionExamples.length === 0
    ? "- none"
    : report.caseVariantCollisionExamples
        .map(
          (item) =>
            `- ${item.normalizedLowerPath}: ${item.variants.join(", ")}`,
        )
        .join("\n")
}

## Ambiguous Case-Fallback Matches (first 100)
${
  report.ambiguousCaseFallbackExamples.length === 0
    ? "- none"
    : report.ambiguousCaseFallbackExamples
        .map(
          (item) =>
            `- ${item.asset} -> ${item.sourceRoot}/${item.resolvedPath}`,
        )
        .join("\n")
}
`;

  writeFileSync(mdPath, `${markdown}\n`, "utf8");
}

if (!existsSync(newUploadsRoot)) {
  console.error(`new_uploads root not found: ${newUploadsRoot}`);
  process.exit(1);
}
if (!existsSync(uploadsRoot)) {
  console.error(`uploads root not found: ${uploadsRoot}`);
  process.exit(1);
}

mkdirSync(publicUploadsRoot, { recursive: true });

const filesToScan = [
  ...new Set(
    contentRoots.flatMap((root) =>
      gatherFilesRecursive(root, new Set([".md", ".mdx", ".astro", ".js", ".ts"])),
    ),
  ),
];

const uploadRefs = new Map();
const uploadPattern =
  /(?:https?:\/\/(?:www\.)?nomadicyear\.com\/wp-content\/uploads\/|\/wp-content\/uploads\/|\/uploads\/|uploads\/)[^\s"'`)<]+/gi;

for (const filePath of filesToScan) {
  const text = readFileSync(filePath, "utf8");
  let match;
  while ((match = uploadPattern.exec(text)) !== null) {
    const normalized = toUploadsPathFromUrl(match[0]);
    if (!normalized) continue;

    const refs = uploadRefs.get(normalized) ?? new Set();
    refs.add(relative(process.cwd(), filePath));
    uploadRefs.set(normalized, refs);
  }
}

let copiedFromNewUploads = 0;
let copiedFromUploadsFallback = 0;
const missing = [];
const writtenTargetFiles = new Set();
const duplicateTargetPathMap = new Map();
const lowerCasePathVariants = new Map();
let caseFallbackSourceMatches = 0;
const ambiguousCaseFallbackMatches = [];

for (const [assetPath, refs] of uploadRefs.entries()) {
  const relativePath = normalizeRelativeUploadPath(assetPath);
  const normalizedLowerPath = relativePath.toLowerCase();
  const caseVariants = lowerCasePathVariants.get(normalizedLowerPath) ?? new Set();
  caseVariants.add(relativePath);
  lowerCasePathVariants.set(normalizedLowerPath, caseVariants);

  const pathAssets = duplicateTargetPathMap.get(relativePath) ?? new Set();
  pathAssets.add(assetPath);
  duplicateTargetPathMap.set(relativePath, pathAssets);

  const targetPath = join(publicUploadsRoot, relativePath);

  let sourcePath = "";
  const fromNewUploads = resolveSourceFileCaseAware(newUploadsRoot, relativePath);
  if (fromNewUploads) {
    sourcePath = fromNewUploads.path;
    copiedFromNewUploads += 1;
    if (fromNewUploads.usedCaseFallback) {
      caseFallbackSourceMatches += 1;
    }
    if (fromNewUploads.ambiguousFallback) {
      ambiguousCaseFallbackMatches.push({
        asset: assetPath,
        sourceRoot: "new_uploads",
        resolvedPath: relative(newUploadsRoot, fromNewUploads.path),
      });
    }
  } else {
    const fromUploads = resolveSourceFileCaseAware(uploadsRoot, relativePath);
    if (fromUploads) {
      sourcePath = fromUploads.path;
      copiedFromUploadsFallback += 1;
      if (fromUploads.usedCaseFallback) {
        caseFallbackSourceMatches += 1;
      }
      if (fromUploads.ambiguousFallback) {
        ambiguousCaseFallbackMatches.push({
          asset: assetPath,
          sourceRoot: "uploads",
          resolvedPath: relative(uploadsRoot, fromUploads.path),
        });
      }
    }
  }

  if (!sourcePath) {
    missing.push({
      asset: assetPath,
      referencedBy: [...refs].sort(),
    });
    continue;
  }

  mkdirSync(dirname(targetPath), { recursive: true });
  copyFileSync(sourcePath, targetPath);
  writtenTargetFiles.add(relativePath);
}

const duplicateTargetPathExamples = [...duplicateTargetPathMap.entries()]
  .filter(([, assetPaths]) => assetPaths.size > 1)
  .map(([normalizedPath, assetPaths]) => ({
    normalizedPath,
    assets: [...assetPaths].sort(),
  }))
  .slice(0, 100);

const caseVariantCollisionExamples = [...lowerCasePathVariants.entries()]
  .filter(([, variants]) => variants.size > 1)
  .map(([normalizedLowerPath, variants]) => ({
    normalizedLowerPath,
    variants: [...variants].sort(),
  }))
  .slice(0, 100);

const ambiguousCaseFallbackExamples = ambiguousCaseFallbackMatches.slice(0, 100);

const report = {
  generatedAt: new Date().toISOString(),
  inputs: {
    newUploadsRoot,
    uploadsRoot,
    publicUploadsRoot,
    failOnMissing,
  },
  summary: {
    contentFilesScanned: filesToScan.length,
    uniqueUploadRefs: uploadRefs.size,
    copiedFromNewUploads,
    copiedFromUploadsFallback,
    missingRefs: missing.length,
    uniqueTargetFilesWritten: writtenTargetFiles.size,
    duplicateNormalizedTargetPaths: duplicateTargetPathExamples.length,
    caseVariantPathCollisions: caseVariantCollisionExamples.length,
    caseFallbackSourceMatches,
    ambiguousCaseFallbackMatches: ambiguousCaseFallbackExamples.length,
  },
  missingExamples: missing.slice(0, 100),
  duplicateTargetPathExamples,
  caseVariantCollisionExamples,
  ambiguousCaseFallbackExamples,
};

writeReport(reportBase, report);

console.log(`Synced referenced assets to ${publicUploadsRoot}`);
console.log(`Copied from new_uploads: ${copiedFromNewUploads}`);
console.log(`Copied from uploads fallback: ${copiedFromUploadsFallback}`);
console.log(`Missing refs: ${missing.length}`);
console.log(`Unique target files written: ${writtenTargetFiles.size}`);
console.log(
  `Duplicate normalized target paths: ${duplicateTargetPathExamples.length}`,
);
console.log(
  `Case-variant path collisions: ${caseVariantCollisionExamples.length}`,
);
console.log(`Case-fallback source matches used: ${caseFallbackSourceMatches}`);
console.log(
  `Ambiguous case-fallback matches: ${ambiguousCaseFallbackExamples.length}`,
);
console.log(`Report: ${reportBase}.json and ${reportBase}.md`);

if (failOnMissing && missing.length > 0) {
  console.error(
    `Failing because --fail-on-missing was set and ${missing.length} refs are missing.`,
  );
  process.exit(2);
}
