#!/usr/bin/env node

import { readFileSync, writeFileSync } from "node:fs";

const inventoryPath = process.argv[2] ?? "docs/url-inventory.csv";
const outputPath = process.argv[3] ?? "docs/redirects.csv";

const raw = readFileSync(inventoryPath, "utf8");
const lines = raw.split(/\r?\n/).filter(Boolean);
if (lines.length <= 1) {
  console.error(`No inventory data found in ${inventoryPath}`);
  process.exit(1);
}

const paths = new Set();
for (const line of lines.slice(1)) {
  const firstComma = line.indexOf(",");
  if (firstComma === -1) continue;
  const rawPath = line.slice(0, firstComma).replace(/^"|"$/g, "");
  if (!rawPath) continue;
  paths.add(rawPath);
}

const redirects = [];

for (const path of paths) {
  const datePostMatch = path.match(/^\/\d{4}\/\d{2}\/([^/]+)\/?$/);
  if (datePostMatch) {
    redirects.push({
      old_url: path.endsWith("/") ? path : `${path}/`,
      new_url: `/blog/${datePostMatch[1]}/`,
      status_code: 301,
      priority: "high",
      notes: "legacy date-based post URL",
    });
  }
}

if (paths.has("/about-us/")) {
  redirects.push({
    old_url: "/about-us/",
    new_url: "/about/",
    status_code: 301,
    priority: "medium",
    notes: "legacy about page slug normalization",
  });
}

const explicitMappings = [
  {
    old_url: "/map/",
    new_url: "/destinations/",
    priority: "medium",
    notes: "legacy route page mapped to destinations index",
  },
  {
    old_url: "/image-gallery/",
    new_url: "/blog/image-gallery/",
    priority: "medium",
    notes: "legacy standalone page mapped to blog slug",
  },
  {
    old_url: "/photos-with-friends/",
    new_url: "/blog/photos-with-friends/",
    priority: "medium",
    notes: "legacy standalone page mapped to blog slug",
  },
  {
    old_url: "/preparation/",
    new_url: "/blog/preparation/",
    priority: "medium",
    notes: "legacy standalone page mapped to blog slug",
  },
  {
    old_url: "/south-america-expense-report-in-korean/",
    new_url: "/blog/south-america-expense-report-in-korean/",
    priority: "medium",
    notes: "legacy standalone page mapped to blog slug",
  },
  {
    old_url: "/sponsors-and-credits/",
    new_url: "/blog/sponsors-and-credits/",
    priority: "medium",
    notes: "legacy standalone page mapped to blog slug",
  },
  {
    old_url: "/travel-tips/",
    new_url: "/blog/travel-tips/",
    priority: "medium",
    notes: "legacy standalone page mapped to blog slug",
  },
  {
    old_url: "/video/",
    new_url: "/blog/video/",
    priority: "medium",
    notes: "legacy standalone page mapped to blog slug",
  },
  {
    old_url: "/media_category/lc-update-3/",
    new_url: "/blog/lc-update-3/",
    priority: "low",
    notes: "legacy media taxonomy page mapped to likely content slug",
  },
  {
    old_url: "/blank/",
    new_url: "/about/",
    priority: "low",
    notes: "legacy placeholder page consolidated to about",
  },
  {
    old_url: "/sample-page/",
    new_url: "/about/",
    priority: "low",
    notes: "default WordPress sample page consolidated to about",
  },
];

for (const mapping of explicitMappings) {
  if (paths.has(mapping.old_url)) {
    redirects.push({
      old_url: mapping.old_url,
      new_url: mapping.new_url,
      status_code: 301,
      priority: mapping.priority,
      notes: mapping.notes,
    });
  }
}

redirects.sort((a, b) => a.old_url.localeCompare(b.old_url));

const header = "old_url,new_url,status_code,priority,notes";
const rows = redirects.map((r) =>
  [r.old_url, r.new_url, r.status_code, r.priority, r.notes]
    .map((value) => {
      const s = String(value);
      return /[,"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    })
    .join(","),
);

writeFileSync(outputPath, `${header}\n${rows.join("\n")}\n`, "utf8");
console.log(`Wrote ${redirects.length} redirect rows to ${outputPath}`);
