// @ts-check
import { defineConfig } from "astro/config";
import sitemap from "@astrojs/sitemap";
import { remarkClaimCites } from "./src/lib/remark-claims.mjs";

export default defineConfig({
  // Deployed as a Cloudflare Worker (wrangler.jsonc); this drives
  // canonical/OG URLs and the sitemap. Keep in sync with SITE_ORIGIN.
  site: "https://signalgraph.dev1-parsa.workers.dev",
  output: "static",
  integrations: [sitemap()],
  // Search moved from a standalone page into the header dropdown; keep old
  // /search/ links (indexes, bookmarks) landing somewhere sensible.
  redirects: { "/search/": "/" },
  markdown: {
    // [c:ID] markers from the engine become numbered footnote links; the
    // Provenance component renders the matching expandable claim cards.
    remarkPlugins: [remarkClaimCites],
    shikiConfig: { themes: { light: "github-light", dark: "github-dark" } },
  },
});
