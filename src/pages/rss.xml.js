import { getCollection } from "astro:content";
import rss from "@astrojs/rss";
import { SITE_DESCRIPTION, SITE_TITLE } from "../consts";
import { getPostUrl, sortPostsByDateDesc } from "../utils/posts";

export async function GET(context) {
  const posts = (await getCollection("posts"))
    .filter((post) => !post.data.draft)
    .sort(sortPostsByDateDesc);
  return rss({
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    site: context.site,
    items: posts.map((post) => ({
      ...post.data,
      link: getPostUrl(post),
    })),
  });
}
