import rss from "@astrojs/rss";
import { getCollection } from "astro:content";
import { SITE } from "../config/site.mjs";

export async function GET(context) {
  const hideDrafts = !!(process.env.CI || process.env.CF_PAGES);
  const posts = (await getCollection("posts", ({ data }) => !(hideDrafts && data.draft))).sort(
    (a, b) => b.data.date.valueOf() - a.data.date.valueOf(),
  );
  return rss({
    title: SITE.title,
    description: SITE.tagline,
    site: context.site,
    items: posts.map((post) => ({
      title: post.data.title,
      description: post.data.description,
      pubDate: post.data.date,
      link: `/posts/${post.id}/`,
      categories: [post.data.pillar, post.data.format],
    })),
    customData: "<language>en</language>",
  });
}
