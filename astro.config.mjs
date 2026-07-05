// @ts-check
import { defineConfig } from "astro/config";
import sitemap from "@astrojs/sitemap";
import { remarkClaimCites } from "./src/lib/remark-claims.mjs";

export default defineConfig({
  site: "https://signalgraph.pages.dev",
  output: "static",
  integrations: [sitemap()],
  markdown: {
    // [c:ID] markers from the engine become numbered footnote links; the
    // Provenance component renders the matching expandable claim cards.
    remarkPlugins: [remarkClaimCites],
    shikiConfig: { themes: { light: "github-light", dark: "github-dark" } },
  },
});
