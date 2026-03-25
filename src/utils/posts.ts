import type { CollectionEntry } from "astro:content";

export type PostEntry = CollectionEntry<"posts">;

export function getPostSlug(post: PostEntry) {
  return post.data.slug ?? post.id;
}

export function getPostUrl(post: PostEntry) {
  return `/blog/${getPostSlug(post)}/`;
}

export function sortPostsByDateDesc(a: PostEntry, b: PostEntry) {
  return b.data.pubDate.valueOf() - a.data.pubDate.valueOf();
}

export function formatTaxonomyLabel(slug: string) {
  return slug
    .split("-")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}
