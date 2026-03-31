import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, extname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, "..", "..");
const distRoot = resolve(projectRoot, "dist");
const redirectsCsvPath = resolve(projectRoot, "docs/redirects.csv");
const inventoryCsvPath = resolve(projectRoot, "docs/url-inventory.csv");
const redirectsFilePath = resolve(projectRoot, "public/_redirects");
const reportJsonPath = resolve(projectRoot, "docs/phase-5-audit-report.json");
const reportMdPath = resolve(projectRoot, "docs/phase-5-audit-report.md");
const siteOrigin = "https://nomadic-year.pages.dev";
const failOnCritical = process.argv.includes("--fail-on-critical");

function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    const next = text[i + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        cell += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === "," && !inQuotes) {
      row.push(cell);
      cell = "";
      continue;
    }

    if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && next === "\n") {
        i += 1;
      }
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
      continue;
    }

    cell += char;
  }

  if (cell.length > 0 || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }

  return rows.filter((values) => values.some((value) => value.trim().length > 0));
}

function parseCsvObjects(csvText) {
  const rows = parseCsv(csvText);
  if (rows.length === 0) return [];
  const headers = rows[0].map((value) => value.trim());
  return rows.slice(1).map((values) => {
    const entry = {};
    headers.forEach((header, index) => {
      entry[header] = values[index] ?? "";
    });
    return entry;
  });
}

function normalizePath(pathValue) {
  const raw = String(pathValue ?? "").trim();
  if (!raw) return "";
  const withoutHost = raw.replace(/^https?:\/\/[^/]+/i, "");
  const withLeadingSlash = withoutHost.startsWith("/")
    ? withoutHost
    : `/${withoutHost}`;
  const collapsed = withLeadingSlash.replace(/\/{2,}/g, "/");
  return collapsed || "/";
}

function decodePathSafely(pathValue) {
  try {
    return decodeURI(pathValue);
  } catch {
    return pathValue;
  }
}

function normalizeText(text) {
  return String(text ?? "").replace(/\s+/g, " ").trim();
}

function routeFromHtmlFile(relativeHtmlPath) {
  if (relativeHtmlPath === "index.html") return "/";
  if (relativeHtmlPath.endsWith("/index.html")) {
    return `/${relativeHtmlPath.slice(0, -"/index.html".length)}/`.replace(
      /\/{2,}/g,
      "/",
    );
  }
  return `/${relativeHtmlPath}`.replace(/\/{2,}/g, "/");
}

function collectFiles(rootDirectory) {
  const files = [];

  function walk(currentPath) {
    const entries = readdirSync(currentPath, { withFileTypes: true });
    for (const entry of entries) {
      const absolutePath = join(currentPath, entry.name);
      if (entry.isDirectory()) {
        walk(absolutePath);
      } else {
        files.push(absolutePath);
      }
    }
  }

  walk(rootDirectory);
  return files;
}

function extractAttributeValues(content, tagName, attributeName) {
  const pattern = new RegExp(
    `<${tagName}\\b[^>]*\\b${attributeName}\\s*=\\s*(\"([^\"]*)\"|'([^']*)')`,
    "gi",
  );
  const values = [];
  let match = pattern.exec(content);
  while (match) {
    values.push(match[2] ?? match[3] ?? "");
    match = pattern.exec(content);
  }
  return values;
}

function extractTagMatches(content, tagName) {
  const pattern = new RegExp(`<${tagName}\\b[^>]*>`, "gi");
  const matches = [];
  let match = pattern.exec(content);
  while (match) {
    matches.push(match[0]);
    match = pattern.exec(content);
  }
  return matches;
}

function extractTitle(content) {
  const match = content.match(/<title>([\s\S]*?)<\/title>/i);
  return normalizeText(match?.[1] ?? "");
}

function extractMetaDescription(content) {
  const match = content.match(
    /<meta[^>]+name=["']description["'][^>]*content=["']([^"']*)["'][^>]*>/i,
  );
  return normalizeText(match?.[1] ?? "");
}

function extractCanonical(content) {
  const match = content.match(
    /<link[^>]+rel=["']canonical["'][^>]*href=["']([^"']*)["'][^>]*>/i,
  );
  return normalizeText(match?.[1] ?? "");
}

function extractXmlLocs(content) {
  const pattern = /<loc>([\s\S]*?)<\/loc>/gi;
  const values = [];
  let match = pattern.exec(content);
  while (match) {
    values.push(normalizeText(match[1]));
    match = pattern.exec(content);
  }
  return values;
}

function toDisplayList(items, formatter, fallback = "_None_") {
  if (items.length === 0) return fallback;
  return items.map((item) => `- ${formatter(item)}`).join("\n");
}

function isExternalLink(urlValue) {
  return /^(mailto:|tel:|javascript:|data:)/i.test(urlValue);
}

function hasFileExtension(pathValue) {
  const lastSegment = pathValue.split("/").pop() ?? "";
  return /\.[a-z0-9]{1,8}$/i.test(lastSegment);
}

function hexToRgb(hex) {
  const normalized = hex.replace("#", "");
  const value =
    normalized.length === 3
      ? normalized
          .split("")
          .map((char) => char + char)
          .join("")
      : normalized;
  const intValue = Number.parseInt(value, 16);
  return {
    r: (intValue >> 16) & 255,
    g: (intValue >> 8) & 255,
    b: intValue & 255,
  };
}

function srgbToLinear(value) {
  const channel = value / 255;
  return channel <= 0.03928
    ? channel / 12.92
    : ((channel + 0.055) / 1.055) ** 2.4;
}

function luminance(hex) {
  const { r, g, b } = hexToRgb(hex);
  return (
    0.2126 * srgbToLinear(r) +
    0.7152 * srgbToLinear(g) +
    0.0722 * srgbToLinear(b)
  );
}

function contrastRatio(foreground, background) {
  const lighter = Math.max(luminance(foreground), luminance(background));
  const darker = Math.min(luminance(foreground), luminance(background));
  return (lighter + 0.05) / (darker + 0.05);
}

if (!existsSync(distRoot)) {
  throw new Error(`Dist directory not found: ${distRoot}. Run a build first.`);
}

const allDistFiles = collectFiles(distRoot);
const relativeDistFiles = allDistFiles.map((filePath) =>
  relative(distRoot, filePath).replace(/\\/g, "/"),
);
const htmlFiles = relativeDistFiles.filter((filePath) => filePath.endsWith(".html"));
const absoluteDistFileSet = new Set(relativeDistFiles.map((filePath) => `/${filePath}`));

const routeToHtml = new Map();
const routablePathSet = new Set();
const htmlContentByPath = new Map();

for (const htmlFile of htmlFiles) {
  const routePath = routeFromHtmlFile(htmlFile);
  const routeNoTrailing = routePath.endsWith("/") && routePath !== "/"
    ? routePath.slice(0, -1)
    : routePath;
  const routeWithTrailing =
    routePath.endsWith("/") || hasFileExtension(routePath) ? routePath : `${routePath}/`;

  routeToHtml.set(routePath, htmlFile);
  routeToHtml.set(routeNoTrailing, htmlFile);
  routeToHtml.set(routeWithTrailing, htmlFile);
  routablePathSet.add(routePath);
  routablePathSet.add(routeNoTrailing);
  routablePathSet.add(routeWithTrailing);
}

for (const htmlFile of htmlFiles) {
  const absolutePath = resolve(distRoot, htmlFile);
  htmlContentByPath.set(htmlFile, readFileSync(absolutePath, "utf8"));
}

const internalLinkIssues = [];
let checkedInternalLinks = 0;

for (const htmlFile of htmlFiles) {
  const content = htmlContentByPath.get(htmlFile) ?? "";
  const hrefValues = extractAttributeValues(content, "a", "href");

  for (const href of hrefValues) {
    const trimmed = href.trim();
    if (!trimmed || trimmed.startsWith("#") || isExternalLink(trimmed)) {
      continue;
    }

    let resolved;
    try {
      resolved = new URL(trimmed, `${siteOrigin}/`);
    } catch {
      continue;
    }

    if (resolved.origin !== new URL(siteOrigin).origin) {
      continue;
    }

    const targetPath = normalizePath(resolved.pathname);
    const decodedTargetPath = decodePathSafely(targetPath);
    checkedInternalLinks += 1;

    if (hasFileExtension(targetPath)) {
      const fileCandidates = new Set([targetPath, decodedTargetPath]);
      const hasExistingTarget = [...fileCandidates].some((candidate) =>
        absoluteDistFileSet.has(candidate),
      );
      if (!hasExistingTarget) {
        internalLinkIssues.push({
          source: `/${htmlFile}`,
          target: targetPath,
          reason: "missing file target",
        });
      }
      continue;
    }

    const candidatePaths = new Set([
      targetPath,
      decodedTargetPath,
      targetPath.endsWith("/") ? targetPath.slice(0, -1) || "/" : `${targetPath}/`,
      decodedTargetPath.endsWith("/")
        ? decodedTargetPath.slice(0, -1) || "/"
        : `${decodedTargetPath}/`,
    ]);
    const resolvedRoute = [...candidatePaths].some((candidate) =>
      routablePathSet.has(candidate),
    );

    if (!resolvedRoute) {
      internalLinkIssues.push({
        source: `/${htmlFile}`,
        target: targetPath,
        reason: "missing route target",
      });
    }
  }
}

const inventoryRows = existsSync(inventoryCsvPath)
  ? parseCsvObjects(readFileSync(inventoryCsvPath, "utf8"))
  : [];
const inventoryByPath = new Map(
  inventoryRows.map((row) => [normalizePath(row.path), row]),
);

const redirectRows = existsSync(redirectsCsvPath)
  ? parseCsvObjects(readFileSync(redirectsCsvPath, "utf8"))
  : [];
const highPriorityRedirects = redirectRows.filter(
  (row) => normalizeText(row.priority).toLowerCase() === "high",
);
const redirectSample = (highPriorityRedirects.length > 0
  ? highPriorityRedirects
  : redirectRows
).slice(0, 25);

const metadataIssues = [];
const metadataSamples = [];

for (const row of redirectSample) {
  const oldPath = normalizePath(row.old_url);
  const newPath = normalizePath(row.new_url);
  const htmlFile =
    routeToHtml.get(newPath) ??
    routeToHtml.get(newPath.endsWith("/") ? newPath.slice(0, -1) : `${newPath}/`);
  const inventoryEntry =
    inventoryByPath.get(oldPath) ??
    inventoryByPath.get(oldPath.endsWith("/") ? oldPath.slice(0, -1) : `${oldPath}/`);

  if (!htmlFile) {
    metadataIssues.push({
      oldPath,
      newPath,
      reason: "new route missing in dist",
    });
    continue;
  }

  const content = htmlContentByPath.get(htmlFile) ?? "";
  const title = extractTitle(content);
  const description = extractMetaDescription(content);
  const canonical = extractCanonical(content);
  let canonicalPath = "";
  if (canonical) {
    try {
      canonicalPath = normalizePath(new URL(canonical, siteOrigin).pathname);
    } catch {
      canonicalPath = normalizePath(canonical);
    }
  }

  const expectedTitle = normalizeText(inventoryEntry?.title ?? "");
  const expectedDescription = normalizeText(inventoryEntry?.meta_description ?? "");
  const titleExactMatch = expectedTitle ? title === expectedTitle : null;
  const descriptionExactMatch = expectedDescription
    ? description === expectedDescription
    : null;

  metadataSamples.push({
    oldPath,
    newPath,
    titlePresent: Boolean(title),
    descriptionPresent: Boolean(description),
    canonicalPresent: Boolean(canonical),
    canonicalPath,
    canonicalPathMatchesTarget: canonicalPath
      ? normalizePath(canonicalPath) === normalizePath(newPath)
      : false,
    titleExactMatch,
    descriptionExactMatch,
  });

  if (!title || !description || !canonical) {
    metadataIssues.push({
      oldPath,
      newPath,
      reason: "missing title/description/canonical",
    });
    continue;
  }
  if (normalizePath(canonicalPath) !== normalizePath(newPath)) {
    metadataIssues.push({
      oldPath,
      newPath,
      reason: `canonical mismatch (${canonicalPath})`,
    });
  }
}

const sitemapIndexFile = resolve(distRoot, "sitemap-index.xml");
const sitemapIssues = [];
let sitemapUrlCount = 0;
let sitemapCount = 0;

if (!existsSync(sitemapIndexFile)) {
  sitemapIssues.push({
    type: "sitemap-index-missing",
    detail: "dist/sitemap-index.xml not found",
  });
} else {
  const sitemapIndexContent = readFileSync(sitemapIndexFile, "utf8");
  const sitemapLocs = extractXmlLocs(sitemapIndexContent);
  sitemapCount = sitemapLocs.length;
  for (const sitemapLoc of sitemapLocs) {
    const sitemapPath = normalizePath(new URL(sitemapLoc, siteOrigin).pathname);
    const sitemapFile = resolve(distRoot, sitemapPath.replace(/^\//, ""));
    if (!existsSync(sitemapFile)) {
      sitemapIssues.push({
        type: "sitemap-file-missing",
        detail: sitemapPath,
      });
      continue;
    }
    const sitemapContent = readFileSync(sitemapFile, "utf8");
    const urlLocs = extractXmlLocs(sitemapContent);
    sitemapUrlCount += urlLocs.length;
    for (const urlLoc of urlLocs) {
      const urlPath = normalizePath(new URL(urlLoc, siteOrigin).pathname);
      const candidates = [
        urlPath,
        urlPath.endsWith("/") ? urlPath.slice(0, -1) || "/" : `${urlPath}/`,
      ];
      if (!candidates.some((candidate) => routablePathSet.has(candidate))) {
        sitemapIssues.push({
          type: "sitemap-url-missing-route",
          detail: urlPath,
        });
      }
    }
  }
}

const redirectsMap = new Map();
if (existsSync(redirectsFilePath)) {
  const lines = readFileSync(redirectsFilePath, "utf8")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#"));
  for (const line of lines) {
    const [from = "", to = "", status = ""] = line.split(/\s+/);
    redirectsMap.set(normalizePath(from), {
      to: normalizePath(to),
      status: Number(status),
    });
  }
}

const redirectSampleIssues = [];
const redirectSampleRows = redirectSample.slice(0, 20);
for (const row of redirectSampleRows) {
  const oldPath = normalizePath(row.old_url);
  const newPath = normalizePath(row.new_url);
  const mapping = redirectsMap.get(oldPath);
  if (!mapping) {
    redirectSampleIssues.push({
      oldPath,
      newPath,
      reason: "missing redirect mapping",
    });
    continue;
  }
  if (mapping.to !== newPath || mapping.status !== 301) {
    redirectSampleIssues.push({
      oldPath,
      newPath,
      reason: `mapped to ${mapping.to} ${mapping.status}`,
    });
  }
}

const headingIssues = [];
const altIssues = [];
for (const htmlFile of htmlFiles) {
  const content = htmlContentByPath.get(htmlFile) ?? "";
  const headingLevels = [...content.matchAll(/<h([1-6])\b[^>]*>/gi)].map((match) =>
    Number(match[1]),
  );
  if (headingLevels.length > 0 && headingLevels[0] !== 1) {
    headingIssues.push({
      page: `/${htmlFile}`,
      reason: `first heading is h${headingLevels[0]} instead of h1`,
    });
  }
  for (let i = 1; i < headingLevels.length; i += 1) {
    const previous = headingLevels[i - 1];
    const current = headingLevels[i];
    if (current - previous > 1) {
      headingIssues.push({
        page: `/${htmlFile}`,
        reason: `heading jump h${previous} -> h${current}`,
      });
    }
  }

  const imgTags = extractTagMatches(content, "img");
  for (const imgTag of imgTags) {
    const altMatch = imgTag.match(/\balt\s*=\s*("([^"]*)"|'([^']*)')/i);
    const altValue = normalizeText(altMatch?.[2] ?? altMatch?.[3] ?? "");
    const isDecorative =
      /\brole\s*=\s*["']presentation["']/i.test(imgTag) ||
      /\baria-hidden\s*=\s*["']true["']/i.test(imgTag);
    if (!altMatch && !isDecorative) {
      altIssues.push({
        page: `/${htmlFile}`,
        reason: "image missing alt attribute",
      });
    } else if (!altValue && !isDecorative) {
      altIssues.push({
        page: `/${htmlFile}`,
        reason: "image has empty alt text",
      });
    }
  }
}

const contrastChecks = [
  {
    id: "body-light",
    fg: "#111827",
    bg: "#f9fafb",
    min: 4.5,
  },
  {
    id: "body-dark",
    fg: "#f3f4f6",
    bg: "#0f172a",
    min: 4.5,
  },
  {
    id: "nav-light",
    fg: "#374151",
    bg: "#f9fafb",
    min: 4.5,
  },
  {
    id: "footer-light",
    fg: "#4b5563",
    bg: "#f9fafb",
    min: 4.5,
  },
  {
    id: "active-link-light",
    fg: "#115e59",
    bg: "#f9fafb",
    min: 4.5,
  },
  {
    id: "nav-dark",
    fg: "#d1d5db",
    bg: "#0f172a",
    min: 4.5,
  },
  {
    id: "active-link-dark",
    fg: "#5eead4",
    bg: "#0f172a",
    min: 4.5,
  },
];

const contrastResults = contrastChecks.map((check) => {
  const ratio = contrastRatio(check.fg, check.bg);
  return {
    ...check,
    ratio: Number(ratio.toFixed(2)),
    pass: ratio >= check.min,
  };
});
const contrastFailures = contrastResults.filter((result) => !result.pass);

const criticalCount =
  internalLinkIssues.length +
  metadataIssues.length +
  sitemapIssues.length +
  redirectSampleIssues.length +
  altIssues.length +
  contrastFailures.length;

const report = {
  generatedAt: new Date().toISOString(),
  mode: failOnCritical ? "strict" : "report",
  summary: {
    distHtmlFiles: htmlFiles.length,
    checkedInternalLinks,
    internalLinkIssues: internalLinkIssues.length,
    metadataSamples: metadataSamples.length,
    metadataIssues: metadataIssues.length,
    sitemapCount,
    sitemapUrlCount,
    sitemapIssues: sitemapIssues.length,
    redirectMappingsLoaded: redirectsMap.size,
    redirectSamples: redirectSampleRows.length,
    redirectSampleIssues: redirectSampleIssues.length,
    headingIssues: headingIssues.length,
    altIssues: altIssues.length,
    contrastChecks: contrastResults.length,
    contrastFailures: contrastFailures.length,
    criticalCount,
  },
  internalLinks: {
    issues: internalLinkIssues,
  },
  metadataParity: {
    samples: metadataSamples,
    issues: metadataIssues,
  },
  sitemap: {
    issues: sitemapIssues,
  },
  redirects: {
    issues: redirectSampleIssues,
  },
  accessibility: {
    headingIssues,
    altIssues,
    contrastResults,
    contrastFailures,
  },
};

writeFileSync(reportJsonPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");

const md = [
  "# Phase 5 Audit Report",
  "",
  `Generated: ${report.generatedAt}`,
  `Mode: ${report.mode}`,
  "",
  "## Summary",
  `- HTML files audited: ${report.summary.distHtmlFiles}`,
  `- Internal links checked: ${report.summary.checkedInternalLinks}`,
  `- Internal link issues: ${report.summary.internalLinkIssues}`,
  `- Metadata samples checked: ${report.summary.metadataSamples}`,
  `- Metadata issues: ${report.summary.metadataIssues}`,
  `- Sitemap files discovered: ${report.summary.sitemapCount}`,
  `- Sitemap URLs discovered: ${report.summary.sitemapUrlCount}`,
  `- Sitemap issues: ${report.summary.sitemapIssues}`,
  `- Redirect mappings loaded: ${report.summary.redirectMappingsLoaded}`,
  `- Redirect sample issues: ${report.summary.redirectSampleIssues}`,
  `- Accessibility heading issues: ${report.summary.headingIssues}`,
  `- Accessibility alt issues: ${report.summary.altIssues}`,
  `- Accessibility contrast failures: ${report.summary.contrastFailures}`,
  `- Critical issue count: ${report.summary.criticalCount}`,
  "",
  "## Internal Link Issues (first 25)",
  toDisplayList(
    internalLinkIssues.slice(0, 25),
    (item) => `\`${item.source}\` -> \`${item.target}\` (${item.reason})`,
  ),
  "",
  "## Metadata Issues (first 25)",
  toDisplayList(
    metadataIssues.slice(0, 25),
    (item) => `\`${item.oldPath}\` -> \`${item.newPath}\` (${item.reason})`,
  ),
  "",
  "## Sitemap Issues (first 25)",
  toDisplayList(
    sitemapIssues.slice(0, 25),
    (item) => `${item.type}: \`${item.detail}\``,
  ),
  "",
  "## Redirect Sample Issues (first 25)",
  toDisplayList(
    redirectSampleIssues.slice(0, 25),
    (item) => `\`${item.oldPath}\` -> \`${item.newPath}\` (${item.reason})`,
  ),
  "",
  "## Accessibility Heading Issues (first 25)",
  toDisplayList(
    headingIssues.slice(0, 25),
    (item) => `\`${item.page}\`: ${item.reason}`,
  ),
  "",
  "## Accessibility Alt Issues (first 25)",
  toDisplayList(
    altIssues.slice(0, 25),
    (item) => `\`${item.page}\`: ${item.reason}`,
  ),
  "",
  "## Contrast Checks",
  toDisplayList(
    contrastResults,
    (item) =>
      `\`${item.id}\`: ratio ${item.ratio} (min ${item.min}) -> ${
        item.pass ? "PASS" : "FAIL"
      }`,
  ),
  "",
];
writeFileSync(reportMdPath, md.join("\n"), "utf8");

console.log(`Phase 5 audit report written: ${reportJsonPath} and ${reportMdPath}`);
console.log(`Critical issues: ${criticalCount}`);

if (failOnCritical && criticalCount > 0) {
  process.exit(1);
}
