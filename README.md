# Signalgraph

**Grounded signal on AI, quantum, and the systems underneath.**

Signalgraph is an autonomous research engine that reads primary sources daily,
maintains a claim-level knowledge graph, and publishes only what it can prove.
Every factual sentence traces to a source you can expand and audit.
*No claim without a source.*

Architected and curated by a practicing enterprise architect. Posts are generated
by the engine, pass a seven-check grounding gate, and go live only after human
review — every post on this site was approved by the curator via pull request.

## This repo

The public face: an [Astro](https://astro.build) static site deployed on Cloudflare
Pages. Content (posts, diagram DSL, provenance JSON, search vectors) arrives as pull
requests from the private engine.

- `content/` — engine-written posts (`[c:ID]` citations), Flowkit diagram JSON,
  per-post provenance JSON (verbatim quotes, trust tiers, freshness)
- `src/components/FlowDiagram.astro` — THE Flowkit stencil renderer (dagre at
  build time → static SVG + CSS animation; the LLM never emits SVG)
- `src/components/Provenance.astro` — expandable per-claim footnotes
- `src/lib/remark-claims.mjs` — `[c:ID]` → numbered footnote links
- `stencil/flowkit.schema.json` — the diagram DSL contract; vendored into the engine
- `src/styles/tokens.css` — design tokens: dark/light themes, pillar hues,
  fluid type scale, motion rules

## Develop

```
npm install
npm run dev       # dev server; local draft fixtures visible
npm run build     # static build + Pagefind search index (drafts hidden on CI / CF Pages)
npm run preview   # serve dist/ (search works here)
```

Design contract: dark-first with a no-flash light toggle; fluid type; 70ch measure;
44px tap targets; diagrams pan on phones, never squash; animation runs only
in-viewport and is disabled under `prefers-reduced-motion`. Post pages ship
&lt; 60 KB of JavaScript.
