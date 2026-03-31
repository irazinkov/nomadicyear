import { existsSync, readdirSync, statSync } from "node:fs";
import { extname, join } from "node:path";

const uploadsRoot = join(process.cwd(), "public", "uploads");
const variantSuffixPattern = /-(\d+)x(\d+)$/;
const directoryCache = new Map<string, string[]>();

type Variant = {
  filename: string;
  width?: number;
};

function normalizeUploadsPath(path: string) {
  const cleanPath = path.split("?")[0]?.split("#")[0] ?? path;
  if (!cleanPath.startsWith("/uploads/")) return "";
  return cleanPath;
}

function getDirectoryEntries(relativeDirectory: string) {
  const cached = directoryCache.get(relativeDirectory);
  if (cached) return cached;

  const directoryPath = join(uploadsRoot, relativeDirectory);
  if (!existsSync(directoryPath)) return [];
  if (!statSync(directoryPath).isDirectory()) return [];

  const entries = readdirSync(directoryPath);
  directoryCache.set(relativeDirectory, entries);
  return entries;
}

function parseVariantWidth(fileStem: string) {
  const match = fileStem.match(variantSuffixPattern);
  if (!match) return undefined;
  return Number(match[1]);
}

export function getUploadResponsiveSources(path: string) {
  const normalizedPath = normalizeUploadsPath(path);
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

  const variants: Variant[] = [];
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

  const urlFor = (name: string) =>
    `/uploads/${relativeDirectory ? `${relativeDirectory}/` : ""}${name}`.replace(
      /\/+/g,
      "/",
    );

  const variantWithWidths = variants
    .filter((variant) => typeof variant.width === "number")
    .sort((a, b) => (a.width ?? 0) - (b.width ?? 0));

  const dedupedByWidth = new Map<number, string>();
  for (const variant of variantWithWidths) {
    const width = variant.width;
    if (!width) continue;
    dedupedByWidth.set(width, urlFor(variant.filename));
  }

  if (dedupedByWidth.size < 2) return null;

  const srcset = [...dedupedByWidth.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([width, assetPath]) => `${assetPath} ${width}w`)
    .join(", ");

  const sourceEntryByLower = new Map(
    variants.map((variant) => [variant.filename.toLowerCase(), variant.filename]),
  );
  const requestedEntry =
    sourceEntryByLower.get(filename.toLowerCase()) ?? variants[0]?.filename ?? filename;

  return {
    src: urlFor(requestedEntry),
    srcset,
    sizes: "(max-width: 768px) 100vw, 768px",
  };
}
