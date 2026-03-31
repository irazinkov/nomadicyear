import { existsSync, readdirSync, statSync } from "node:fs";
import { extname, join } from "node:path";

const uploadsRoot = join(process.cwd(), "public", "uploads");
const variantSuffixPattern = /-(\d+)x(\d+)$/;
const directoryCache = new Map();

function normalizeUploadsPath(pathValue) {
  let value = String(pathValue ?? "").trim();
  if (!value) return "";

  value = value.replace(
    /^https?:\/\/(?:www\.)?nomadicyear\.com\/wp-content\/uploads\//i,
    "/uploads/",
  );
  value = value.replace(/^\/?wp-content\/uploads\//i, "/uploads/");
  value = value.replace(/^uploads\//i, "/uploads/");
  value = value.split("?")[0]?.split("#")[0] ?? value;

  return value.startsWith("/uploads/") ? value : "";
}

function getDirectoryEntries(relativeDirectory) {
  const cached = directoryCache.get(relativeDirectory);
  if (cached) return cached;

  const directoryPath = join(uploadsRoot, relativeDirectory);
  if (!existsSync(directoryPath)) return [];
  if (!statSync(directoryPath).isDirectory()) return [];

  const entries = readdirSync(directoryPath);
  directoryCache.set(relativeDirectory, entries);
  return entries;
}

function parseVariantWidth(fileStem) {
  const match = fileStem.match(variantSuffixPattern);
  if (!match) return undefined;
  return Number(match[1]);
}

function getResponsiveSourceData(srcValue) {
  const normalizedPath = normalizeUploadsPath(srcValue);
  if (!normalizedPath) return null;

  const relativePath = normalizedPath.replace(/^\/uploads\//, "");
  const pathSegments = relativePath.split("/");
  if (pathSegments.length < 2) return null;

  const filename = pathSegments[pathSegments.length - 1] ?? "";
  const relativeDirectory = pathSegments.slice(0, -1).join("/");
  const extension = extname(filename).toLowerCase();
  if (!extension) return null;

  const requestedStem = filename.slice(0, -extension.length);
  const canonicalStem = requestedStem.replace(variantSuffixPattern, "");

  const entries = getDirectoryEntries(relativeDirectory);
  if (entries.length === 0) return null;

  const variants = [];
  for (const entry of entries) {
    const entryExtension = extname(entry).toLowerCase();
    if (entryExtension !== extension) continue;

    const entryStem = entry.slice(0, -entryExtension.length);
    const entryCanonicalStem = entryStem.replace(variantSuffixPattern, "");
    if (entryCanonicalStem !== canonicalStem) continue;

    variants.push({
      filename: entry,
      width: parseVariantWidth(entryStem),
    });
  }

  if (variants.length === 0) return null;

  const toUrl = (name) =>
    `/uploads/${relativeDirectory ? `${relativeDirectory}/` : ""}${name}`.replace(
      /\/+/g,
      "/",
    );

  const sourceEntryByLower = new Map(
    variants.map((variant) => [variant.filename.toLowerCase(), variant.filename]),
  );
  const requestedEntry =
    sourceEntryByLower.get(filename.toLowerCase()) ?? variants[0]?.filename ?? filename;
  const requestedSrc = toUrl(requestedEntry);
  const canonicalFilename = `${canonicalStem}${extension}`;
  const canonicalEntry = sourceEntryByLower.get(canonicalFilename.toLowerCase());
  const canonicalSrc = canonicalEntry ? toUrl(canonicalEntry) : null;

  const variantWithWidths = variants
    .filter((variant) => typeof variant.width === "number")
    .sort((a, b) => (a.width ?? 0) - (b.width ?? 0));

  const dedupedByWidth = new Map();
  for (const variant of variantWithWidths) {
    const width = variant.width;
    if (!width) continue;
    dedupedByWidth.set(width, toUrl(variant.filename));
  }

  let srcset = "";
  if (dedupedByWidth.size >= 2) {
    srcset = [...dedupedByWidth.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([width, path]) => `${path} ${width}w`)
      .join(", ");
  } else {
    const entriesByWidth = [...dedupedByWidth.entries()].sort((a, b) => a[0] - b[0]);
    const largestSizedSrc = entriesByWidth.at(-1)?.[1] ?? null;

    if (canonicalSrc && requestedSrc !== canonicalSrc) {
      srcset = `${requestedSrc} 1x, ${canonicalSrc} 2x`;
    } else if (canonicalSrc && largestSizedSrc && largestSizedSrc !== canonicalSrc) {
      srcset = `${largestSizedSrc} 1x, ${canonicalSrc} 2x`;
    }
  }

  if (!srcset) return null;

  return {
    src: requestedSrc,
    srcset,
    sizes: "(max-width: 768px) 100vw, 768px",
  };
}

function visit(node, visitor) {
  visitor(node);
  if (!node || !Array.isArray(node.children)) return;
  for (const child of node.children) {
    visit(child, visitor);
  }
}

const imgTagPattern = /<img\b[^>]*>/gi;
const attrPattern = /([^\s=/>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;

function parseImgAttributes(imgTag) {
  const body = imgTag.replace(/^<img\b/i, "").replace(/\/?>$/, "").trim();
  const attributes = [];
  let match = attrPattern.exec(body);

  while (match) {
    const name = match[1];
    const rawValue = match[2] ?? match[3] ?? match[4];
    attributes.push({
      name,
      lowerName: name.toLowerCase(),
      value: rawValue ?? true,
    });
    match = attrPattern.exec(body);
  }

  attrPattern.lastIndex = 0;
  return attributes;
}

function findAttribute(attributes, attributeName) {
  const needle = attributeName.toLowerCase();
  return attributes.find((attribute) => attribute.lowerName === needle);
}

function upsertAttribute(attributes, attributeName, value, onlyIfMissing = false) {
  const existing = findAttribute(attributes, attributeName);
  if (existing) {
    if (!onlyIfMissing) {
      existing.value = value;
    }
    return;
  }

  attributes.push({
    name: attributeName,
    lowerName: attributeName.toLowerCase(),
    value,
  });
}

function stringifyImgTag(attributes, selfClosing) {
  const serializedAttributes = attributes.map((attribute) => {
    if (attribute.value === true) return attribute.name;
    const encodedValue = String(attribute.value).replace(/"/g, "&quot;");
    return `${attribute.name}="${encodedValue}"`;
  });

  return `<img${serializedAttributes.length ? ` ${serializedAttributes.join(" ")}` : ""}${selfClosing ? " /" : ""}>`;
}

export function rewriteResponsiveUploadImgTags(rawHtml) {
  if (typeof rawHtml !== "string" || rawHtml.length === 0) return rawHtml;
  return rawHtml.replace(imgTagPattern, (imgTag) => {
    const attributes = parseImgAttributes(imgTag);
    const srcAttribute = findAttribute(attributes, "src");
    if (!srcAttribute || typeof srcAttribute.value !== "string") return imgTag;

    const responsiveData = getResponsiveSourceData(srcAttribute.value);
    if (!responsiveData) return imgTag;

    upsertAttribute(attributes, "src", responsiveData.src);
    upsertAttribute(attributes, "srcset", responsiveData.srcset);
    upsertAttribute(attributes, "sizes", responsiveData.sizes, true);
    upsertAttribute(attributes, "loading", "lazy", true);
    upsertAttribute(attributes, "decoding", "async", true);

    return stringifyImgTag(attributes, /\/>\s*$/.test(imgTag));
  });
}

export default function rehypeResponsiveUploads() {
  return function transformer(tree) {
    visit(tree, (node) => {
      if (!node) return;

      if (node.type === "raw" && typeof node.value === "string") {
        node.value = rewriteResponsiveUploadImgTags(node.value);
        return;
      }

      if (node.type !== "element" || node.tagName !== "img") return;

      node.properties = node.properties ?? {};
      const srcValue = node.properties.src;
      if (typeof srcValue !== "string") return;

      const responsiveData = getResponsiveSourceData(srcValue);
      if (!responsiveData) return;

      node.properties.src = responsiveData.src;
      node.properties.srcset = responsiveData.srcset;
      if (!node.properties.sizes) {
        node.properties.sizes = responsiveData.sizes;
      }
      if (!node.properties.loading) {
        node.properties.loading = "lazy";
      }
      if (!node.properties.decoding) {
        node.properties.decoding = "async";
      }
    });
  };
}
