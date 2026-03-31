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

const wxrPath = resolve(
  process.argv[2] ?? "archive/nomadicyear.WordPress.2026-03-24.xml",
);
const uploadsRoot = resolve(process.argv[3] ?? "archive/uploads");
const newUploadsRoot = resolve(process.argv[4] ?? "archive/new_uploads");
const reportBase = resolve(process.argv[5] ?? "docs/phase-4-asset-audit");

const contentRoots = [
  resolve("src/content/posts"),
  resolve("src/content/pages"),
  resolve("src/content/blog"),
  resolve("src/pages"),
];

function decodeCdata(value) {
  return value
    .replace(/^<!\[CDATA\[/, "")
    .replace(/\]\]>$/, "")
    .trim();
}

function getFirst(block, regex) {
  const match = block.match(regex);
  return match?.[1]?.trim() ?? "";
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

function writeReport(reportPathBase, report) {
  const jsonPath = `${reportPathBase}.json`;
  const mdPath = `${reportPathBase}.md`;

  mkdirSync(dirname(jsonPath), { recursive: true });
  writeFileSync(jsonPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");

  const markdown = `# Phase 4 Asset Audit

Generated: ${report.generatedAt}
WXR source: ${report.inputs.wxrPath}
Uploads root: ${report.inputs.uploadsRoot}
New uploads root: ${report.inputs.newUploadsRoot}

## New Uploads Copy Summary

- Attachment originals referenced in WXR: ${report.copySummary.referencedOriginals}
- Files copied to new uploads: ${report.copySummary.copied}
- Missing originals in source uploads: ${report.copySummary.missingFromUploads}

## Reference Audit Summary

- Content files scanned: ${report.referenceAudit.contentFilesScanned}
- Unique \`/uploads\` assets referenced: ${report.referenceAudit.uniqueAssetsReferenced}
- Assets present in both folders: ${report.referenceAudit.foundInBoth}
- Assets present only in \`uploads\`: ${report.referenceAudit.foundOnlyInUploads}
- Assets present only in \`new_uploads\`: ${report.referenceAudit.foundOnlyInNewUploads}
- Missing assets (in neither folder): ${report.referenceAudit.missingAssets}

## Missing Originals From Source Uploads (first 50)
${report.copySummary.missingSourceExamples.length === 0 ? "- none" : report.copySummary.missingSourceExamples.map((item) => `- ${item}`).join("\n")}

## Missing Referenced Assets (first 100)
${
  report.referenceAudit.missingExamples.length === 0
    ? "- none"
    : report.referenceAudit.missingExamples
        .map((item) => `- ${item.asset} (referenced by: ${item.referencedBy.join(", ")})`)
        .join("\n")
}
`;

  writeFileSync(mdPath, `${markdown}\n`, "utf8");
}

if (!existsSync(wxrPath)) {
  console.error(`WXR file not found: ${wxrPath}`);
  process.exit(1);
}
if (!existsSync(uploadsRoot)) {
  console.error(`Uploads root not found: ${uploadsRoot}`);
  process.exit(1);
}

mkdirSync(newUploadsRoot, { recursive: true });

const xml = readFileSync(wxrPath, "utf8");
const itemBlocks = xml
  .split("<item>")
  .slice(1)
  .map((part) => part.split("</item>")[0] ?? "")
  .filter(Boolean);

const referencedOriginals = new Set();

for (const block of itemBlocks) {
  const postType = decodeCdata(
    getFirst(block, /<wp:post_type>([\s\S]*?)<\/wp:post_type>/),
  );
  if (postType !== "attachment") continue;

  const attachmentUrl = decodeCdata(
    getFirst(block, /<wp:attachment_url>([\s\S]*?)<\/wp:attachment_url>/),
  );

  const metaEntries = parsePostMeta(block);
  const metaMap = Object.fromEntries(metaEntries.map((m) => [m.key, m.value]));

  const attachedFile = normalizeRelativeUploadPath(metaMap._wp_attached_file ?? "");
  if (attachedFile) {
    referencedOriginals.add(attachedFile);
    continue;
  }

  const fallback = toUploadsPathFromUrl(attachmentUrl);
  if (fallback) {
    referencedOriginals.add(normalizeRelativeUploadPath(fallback));
  }
}

let copied = 0;
const missingSource = [];

for (const relativePath of [...referencedOriginals].sort()) {
  const sourcePath = join(uploadsRoot, relativePath);
  const targetPath = join(newUploadsRoot, relativePath);

  if (!existsSync(sourcePath) || !statSync(sourcePath).isFile()) {
    missingSource.push(relativePath);
    continue;
  }

  mkdirSync(dirname(targetPath), { recursive: true });
  copyFileSync(sourcePath, targetPath);
  copied += 1;
}

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

let foundInBoth = 0;
let foundOnlyInUploads = 0;
let foundOnlyInNewUploads = 0;
const missingAssets = [];

for (const [assetPath, refs] of uploadRefs.entries()) {
  const relativePath = normalizeRelativeUploadPath(assetPath);
  const inUploads = existsSync(join(uploadsRoot, relativePath));
  const inNewUploads = existsSync(join(newUploadsRoot, relativePath));

  if (inUploads && inNewUploads) {
    foundInBoth += 1;
    continue;
  }
  if (inUploads) {
    foundOnlyInUploads += 1;
    continue;
  }
  if (inNewUploads) {
    foundOnlyInNewUploads += 1;
    continue;
  }

  missingAssets.push({
    asset: assetPath,
    referencedBy: [...refs].sort(),
  });
}

const report = {
  generatedAt: new Date().toISOString(),
  inputs: {
    wxrPath,
    uploadsRoot,
    newUploadsRoot,
  },
  copySummary: {
    referencedOriginals: referencedOriginals.size,
    copied,
    missingFromUploads: missingSource.length,
    missingSourceExamples: missingSource.slice(0, 50),
  },
  referenceAudit: {
    contentFilesScanned: filesToScan.length,
    uniqueAssetsReferenced: uploadRefs.size,
    foundInBoth,
    foundOnlyInUploads,
    foundOnlyInNewUploads,
    missingAssets: missingAssets.length,
    missingExamples: missingAssets.slice(0, 100),
  },
};

writeReport(reportBase, report);

console.log(`Created/updated: ${newUploadsRoot}`);
console.log(
  `Copied ${copied}/${referencedOriginals.size} referenced original assets from uploads.`,
);
if (missingSource.length > 0) {
  console.log(
    `Missing from source uploads (referenced originals): ${missingSource.length}`,
  );
}
console.log(
  `Missing referenced assets in both uploads + new_uploads: ${missingAssets.length}`,
);
console.log(`Report: ${reportBase}.json and ${reportBase}.md`);
