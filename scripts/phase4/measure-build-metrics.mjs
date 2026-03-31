#!/usr/bin/env node

import { existsSync, readdirSync, statSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, extname, join, relative, resolve } from "node:path";
import { spawnSync } from "node:child_process";

const rawArgs = process.argv.slice(2);
const positionalArgs = rawArgs.filter((arg) => !arg.startsWith("--"));
const reportBase = resolve(positionalArgs[0] ?? "docs/phase-4-build-metrics");
const skipBuild = rawArgs.includes("--skip-build");
const failOnBudget = rawArgs.includes("--fail-on-budget");

const distRoot = resolve("dist");
const buildBudgetMs = 5 * 60 * 1000;

function formatBytes(value) {
  const units = ["B", "KB", "MB", "GB", "TB"];
  let size = value;
  let unitIndex = 0;
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex += 1;
  }
  return `${size.toFixed(unitIndex === 0 ? 0 : 2)} ${units[unitIndex]}`;
}

function walkFiles(rootDir) {
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
      } else if (stats.isFile()) {
        files.push({
          absolutePath,
          relativePath: relative(rootDir, absolutePath),
          sizeBytes: stats.size,
        });
      }
    }
  }

  return files;
}

let buildDurationMs = null;
if (!skipBuild) {
  const startedAt = Date.now();
  const buildResult = spawnSync("npm", ["run", "build"], {
    stdio: "inherit",
    shell: process.platform === "win32",
  });
  buildDurationMs = Date.now() - startedAt;

  if (buildResult.status !== 0) {
    process.exit(buildResult.status ?? 1);
  }
}

if (!existsSync(distRoot)) {
  console.error(`dist root not found: ${distRoot}`);
  process.exit(1);
}

const distFiles = walkFiles(distRoot);
const imageExtensions = new Set([
  ".jpg",
  ".jpeg",
  ".png",
  ".webp",
  ".avif",
  ".gif",
  ".svg",
]);

const htmlFiles = distFiles.filter((file) => extname(file.relativePath).toLowerCase() === ".html");
const imageFiles = distFiles.filter((file) =>
  imageExtensions.has(extname(file.relativePath).toLowerCase()),
);
const uploadFiles = distFiles.filter((file) => file.relativePath.startsWith("uploads/"));

const totalBytes = distFiles.reduce((sum, file) => sum + file.sizeBytes, 0);
const imageBytes = imageFiles.reduce((sum, file) => sum + file.sizeBytes, 0);
const uploadBytes = uploadFiles.reduce((sum, file) => sum + file.sizeBytes, 0);

const topLargestFiles = [...distFiles]
  .sort((a, b) => b.sizeBytes - a.sizeBytes)
  .slice(0, 15)
  .map((file) => ({
    path: file.relativePath,
    sizeBytes: file.sizeBytes,
  }));

const buildBudgetPassed =
  buildDurationMs === null ? null : buildDurationMs <= buildBudgetMs;

const report = {
  generatedAt: new Date().toISOString(),
  inputs: {
    distRoot,
    skipBuild,
    failOnBudget,
    buildBudgetMs,
  },
  summary: {
    buildDurationMs,
    buildDurationHuman:
      buildDurationMs === null ? "n/a (skipped)" : `${(buildDurationMs / 1000).toFixed(2)}s`,
    buildBudgetPassed,
    totalFiles: distFiles.length,
    htmlFiles: htmlFiles.length,
    imageFiles: imageFiles.length,
    uploadFiles: uploadFiles.length,
    totalBytes,
    totalBytesHuman: formatBytes(totalBytes),
    imageBytes,
    imageBytesHuman: formatBytes(imageBytes),
    uploadBytes,
    uploadBytesHuman: formatBytes(uploadBytes),
  },
  topLargestFiles,
};

const jsonPath = `${reportBase}.json`;
const mdPath = `${reportBase}.md`;
mkdirSync(dirname(jsonPath), { recursive: true });
writeFileSync(jsonPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");

const markdown = `# Phase 4 Build Metrics

Generated: ${report.generatedAt}
Dist root: ${report.inputs.distRoot}

## Summary
- Build duration: ${report.summary.buildDurationHuman}
- Build budget (<= 5m): ${
  report.summary.buildBudgetPassed === null
    ? "n/a"
    : report.summary.buildBudgetPassed
      ? "PASS"
      : "FAIL"
}
- Total files: ${report.summary.totalFiles}
- HTML files: ${report.summary.htmlFiles}
- Image files: ${report.summary.imageFiles}
- Upload files: ${report.summary.uploadFiles}
- Dist size: ${report.summary.totalBytesHuman}
- Image bytes: ${report.summary.imageBytesHuman}
- Upload bytes: ${report.summary.uploadBytesHuman}

## Top Largest Files (15)
${
  report.topLargestFiles.length === 0
    ? "- none"
    : report.topLargestFiles
        .map((file) => `- ${file.path} (${formatBytes(file.sizeBytes)})`)
        .join("\n")
}
`;

writeFileSync(mdPath, `${markdown}\n`, "utf8");

console.log(`Build metrics report written: ${jsonPath} and ${mdPath}`);
console.log(
  `Build duration: ${report.summary.buildDurationHuman}, dist size: ${report.summary.totalBytesHuman}`,
);

if (failOnBudget && buildBudgetPassed === false) {
  console.error(
    `Failing: build duration ${buildDurationMs}ms exceeded budget ${buildBudgetMs}ms.`,
  );
  process.exit(2);
}
