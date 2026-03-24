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
