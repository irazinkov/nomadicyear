# UI/UX Style Guide for Nomadic Year Migration

## Design Philosophy

We are building a hyper-minimalist, typography-driven travel archive inspired by `maxpou.fr`. The design must get out of the way and let the 10 years of travel writing and photography be the absolute focal point.

## Core Tech & Tools

- **CSS Framework:** Tailwind CSS
- **Typography Plugins:** `@tailwindcss/typography` (for styling the compiled Markdown bodies)
- **Icons:** A minimal SVG set (like Heroicons or Lucide) only when absolutely necessary.

## Global Layout & Structure

1.  **Container:** The site must not be full-width. Use a narrow, highly readable central column.
    - _Tailwind Classes:_ `max-w-3xl mx-auto px-4 sm:px-6 lg:px-8`
2.  **Color Palette (Light & Dark Mode):**
    - Implement Tailwind's `dark:` variant class strategy.
    - _Light Mode:_ Background `bg-gray-50` or `bg-white`, text `text-gray-900`.
    - _Dark Mode:_ Background `bg-gray-900` or `bg-slate-900`, text `text-gray-100`.
    - _Accents:_ Choose one subtle primary color (e.g., a muted teal or blue) for links and hover states to give it a slight travel/nautical feel.
3.  **Typography:**
    - Avoid loading heavy external Google Fonts. Rely on a clean, modern system sans-serif stack (Tailwind's default `font-sans`).
    - Ensure generous line height (`leading-relaxed`) for long-form reading.

## Component Styling Instructions

### 1. Navigation & Header

- Keep it extremely simple: Site Title on the left, 2-3 links (Home, Destinations, About) and a Light/Dark mode toggle icon on the right.
- No sticky headers. Let it scroll out of view.

### 2. The Homepage (Post List)

- **Do not use image thumbnails** for the main post list.
- List the posts chronologically, ideally grouped by Year (e.g., a simple `<h2>` for "2016", followed by the posts from that year).
- Each post item should just be a flex row: the date on the left (muted text), the title on the right (bold, linked).
  - _Example layout:_ `[Oct 25]  Russia – Nizhniy Novgorod, Vladimir and Kazan`

### 3. Single Post Layout (The Markdown View)

- **Header:** Post title should be `text-4xl font-bold`, followed by the date and a reading time estimate.
- **Tags:** Render tags as small, rounded pills below the title.
  - _Tailwind Classes:_ `px-3 py-1 bg-gray-200 dark:bg-gray-800 rounded-full text-sm`.
- **Prose Body:** Wrap the `<slot />` or rendered Markdown component in Tailwind's prose class to automatically format headings, paragraphs, and lists.
  - _Tailwind Classes:_ `prose prose-lg dark:prose-invert mx-auto`.
- **Images:** Travel photos should break out slightly from the text width if possible, or at least be full-width within the prose container. Add a subtle rounded corner (`rounded-lg`) and a light shadow (`shadow-md`).

## AI Developer Instructions

When generating Astro components:

1.  Apply these Tailwind classes strictly.
2.  Ensure every component supports both light and dark mode out of the box.
3.  Do not add unnecessary borders, heavy backgrounds, or complex hover animations. Keep it "brutalist" but polished.
