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
      // filter(Boolean): explainer posts (ADR-0001) carry no pillar, so an
      // unfiltered [undefined, format] fails @astrojs/rss item validation and
      // breaks the whole build.
      categories: [post.data.pillar, post.data.format].filter(Boolean),
    })),
    customData: "<language>en</language>",
  });
}
