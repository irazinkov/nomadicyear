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

export const collections = { blog, posts };
