#!/usr/bin/env node

import { writeFileSync } from "node:fs";

const arg = process.argv[2];
const outputPath = process.argv[3] ?? "docs/url-inventory.csv";

if (!arg) {
  console.error(
    "Usage: node scripts/phase0/capture-url-inventory.mjs <domain-or-sitemap-url> [output-csv]",
  );
  process.exit(1);
}

const now = new Date().toISOString();
const visitedSitemaps = new Set();
const discoveredPageUrls = new Set();

const seedUrl = new URL(arg.startsWith("http") ? arg : `https://${arg}`);
const siteOrigin = seedUrl.origin;
const initialSitemaps = seedUrl.pathname.endsWith(".xml")
  ? [seedUrl.toString()]
  : [`${siteOrigin}/sitemap.xml`];

function extractLocs(xml) {
  const locs = [];
  const regex = /<loc>(.*?)<\/loc>/gims;
  let match;
  while ((match = regex.exec(xml)) !== null) {
    locs.push(match[1].trim());
  }
  return locs;
}

function csvEscape(value) {
  const stringValue = String(value ?? "");
  if (/[,"\n]/.test(stringValue)) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }
  return stringValue;
}

function parseTag(html, regex) {
  const match = html.match(regex);
  return match?.[1]?.trim() ?? "";
}

async function fetchText(url) {
  try {
    const response = await fetch(url, { redirect: "follow" });
    const body = await response.text();
    return { ok: true, status: response.status, body, finalUrl: response.url };
  } catch (error) {
    return {
      ok: false,
      status: 0,
      body: "",
      finalUrl: url,
      error: String(error),
    };
  }
}

async function discoverFromSitemaps(sitemapUrls) {
  const queue = [...sitemapUrls];

  while (queue.length > 0) {
    const sitemapUrl = queue.shift();
    if (!sitemapUrl || visitedSitemaps.has(sitemapUrl)) {
      continue;
    }
    visitedSitemaps.add(sitemapUrl);

    const result = await fetchText(sitemapUrl);
    if (!result.ok || result.status >= 400) {
      continue;
    }

    const xml = result.body;
    const locs = extractLocs(xml);
    const isSitemapIndex = /<sitemapindex/i.test(xml);

    for (const loc of locs) {
      try {
        const absolute = new URL(loc, siteOrigin).toString();
        if (isSitemapIndex || absolute.endsWith(".xml")) {
          if (!visitedSitemaps.has(absolute)) {
            queue.push(absolute);
          }
        } else {
          discoveredPageUrls.add(absolute);
        }
      } catch {
        // ignore invalid URLs
      }
    }
  }
}

function sortUrlsByPath(urls) {
  return urls.sort((a, b) => {
    const pathA = new URL(a).pathname;
    const pathB = new URL(b).pathname;
    return pathA.localeCompare(pathB);
  });
}

async function buildInventoryRows(urls) {
  const rows = [];

  for (const url of urls) {
    const page = await fetchText(url);
    const pathname = new URL(page.finalUrl || url).pathname || "/";

    const title = parseTag(page.body, /<title[^>]*>([\s\S]*?)<\/title>/i);
    const canonical = parseTag(
      page.body,
      /<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)["'][^>]*>/i,
    );
    const metaDescription = parseTag(
      page.body,
      /<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)["'][^>]*>/i,
    );

    rows.push({
      url_path: pathname,
      status_code: page.status || 0,
      title,
      canonical_url: canonical,
      meta_description: metaDescription,
      source: "sitemap",
      last_checked_utc: now,
      notes: page.ok ? "" : "fetch_error",
    });
  }

  return rows;
}

async function main() {
  await discoverFromSitemaps(initialSitemaps);

  const urls = sortUrlsByPath([...discoveredPageUrls]);
  const rows = await buildInventoryRows(urls);

  const header = [
    "url_path",
    "status_code",
    "title",
    "canonical_url",
    "meta_description",
    "source",
    "last_checked_utc",
    "notes",
  ];

  const lines = [header.join(",")];
  for (const row of rows) {
    lines.push(
      [
        row.url_path,
        row.status_code,
        row.title,
        row.canonical_url,
        row.meta_description,
        row.source,
        row.last_checked_utc,
        row.notes,
      ]
        .map(csvEscape)
        .join(","),
    );
  }

  writeFileSync(outputPath, `${lines.join("\n")}\n`, "utf8");
  console.log(`Wrote ${rows.length} URLs to ${outputPath}`);
}

await main();
