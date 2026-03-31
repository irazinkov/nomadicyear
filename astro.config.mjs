// @ts-check

import mdx from "@astrojs/mdx";
import sitemap from "@astrojs/sitemap";
import { defineConfig } from "astro/config";

import tailwindcss from "@tailwindcss/vite";
import rehypeResponsiveUploads from "./src/plugins/rehype-responsive-uploads.mjs";

// https://astro.build/config
export default defineConfig({
  site: process.env.SITE_URL ?? "https://nomadic-year.pages.dev",
  integrations: [mdx(), sitemap()],
  markdown: {
    rehypePlugins: [rehypeResponsiveUploads],
  },

  vite: {
    plugins: [tailwindcss()],
  },
});
