import { defineCollection } from "astro:content";
import { glob } from "astro/loaders";
import { z } from "astro/zod";

const postSchema = () =>
  z.object({
    title: z.string(),
    slug: z
      .string()
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
      .optional(),
    pubDate: z.coerce.date(),
    updatedDate: z.coerce.date().optional(),
    description: z.string().default(""),
    excerpt: z.string().optional(),
    heroImage: z.string().optional(),
    heroImageAlt: z.string().optional(),
    country: z.string().optional(),
    categories: z.array(z.string()).default([]),
    tags: z.array(z.string()).default([]),
    lat: z.number().min(-90).max(90).optional(),
    lng: z.number().min(-180).max(180).optional(),
    mapOrder: z.number().int().positive().optional(),
    mapTitle: z.string().optional(),
    transport: z.enum(["drive", "boat", "flight"]).optional(),
    routeWaypoints: z
      .array(
        z.object({
          label: z.string(),
          lat: z.number().min(-90).max(90),
          lng: z.number().min(-180).max(180),
          transport: z.enum(["drive", "boat", "flight"]).optional(),
          image: z.string().optional(),
          imageAlt: z.string().optional(),
          note: z.string().optional(),
          date: z.string().optional(),
        }),
      )
      .optional(),
    legacyUrl: z.string().optional(),
    status: z.enum(["publish", "draft"]).default("publish"),
    draft: z.boolean().default(false),
  });

const blog = defineCollection({
  loader: glob({ base: "./src/content/blog", pattern: "**/*.{md,mdx}" }),
  schema: postSchema,
});

const posts = defineCollection({
  loader: glob({ base: "./src/content/posts", pattern: "**/*.md" }),
  schema: postSchema,
});

const pageSchema = z.object({
  title: z.string(),
  slug: z
    .string()
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
    .optional(),
  description: z.string().default(""),
  legacyUrl: z.string().optional(),
  draft: z.boolean().default(false),
});

const pages = defineCollection({
  loader: glob({ base: "./src/content/pages", pattern: "**/*.md" }),
  schema: pageSchema,
});

export const collections = { blog, posts, pages };
