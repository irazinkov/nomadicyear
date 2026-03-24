# Cloudflare Pages Setup

This project is ready for Git-based deploys on Cloudflare Pages.

## 1. Push Repository to GitHub

1. Create a GitHub repository for this project.
2. Push `main` to GitHub:
   - `git remote add origin <your-repo-url>`
   - `git push -u origin main`

## 2. Create Cloudflare Pages Project

1. In Cloudflare Dashboard, go to **Workers & Pages**.
2. Click **Create application** -> **Pages** -> **Connect to Git**.
3. Select the GitHub repository.

## 3. Configure Build Settings

- Framework preset: `Astro`
- Build command: `npm run build`
- Build output directory: `dist`
- Node version: `22.12.0`

## 4. Environment Variables

Set in Cloudflare Pages project settings:

- `SITE_URL` = your production URL (for canonical + sitemap)

## 5. Branch Deploy Strategy

- Production branch: `main`
- Preview deploys: enabled for pull requests/other branches

## 6. Verify Deploy

1. Trigger a deployment from `main`.
2. Confirm:
   - Home, About, Destinations routes load
   - `robots.txt` resolves
   - `sitemap-index.xml` resolves
