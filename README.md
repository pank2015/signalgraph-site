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

The public face: an [Astro](https://astro.build) static site served by a Cloudflare
Worker (`src/worker.ts` + `wrangler.jsonc` — assets binding for the static build,
`/api/*` for the small backend below). Content (posts, diagram DSL, provenance JSON,
search vectors) arrives as pull requests from the private engine.

- `content/` — engine-written posts (`[c:ID]` citations), Flowkit diagram JSON,
  per-post provenance JSON (verbatim quotes, trust tiers, freshness)
- `src/components/FlowDiagram.astro` — THE Flowkit stencil renderer (dagre at
  build time → static SVG + CSS animation + click-to-zoom overlay; the LLM never emits SVG)
- `src/components/Provenance.astro` — compact collapsed provenance disclosure
- `src/lib/remark-claims.mjs` — strips `[c:ID]` markers from rendered prose and removes the old Sources section
- `stencil/flowkit.schema.json` — the diagram DSL contract; vendored into the engine
- `src/styles/tokens.css` — design tokens: dark/light themes, pillar hues,
  fluid type scale, motion rules
- `src/worker.ts` + `wrangler.jsonc` — the Cloudflare Worker: static assets for every
  route except `/api/request-topic`, which is the backend for `src/pages/request.astro`
  (public "request a topic" form — Turnstile + per-IP KV rate limit, creates a
  `topic-request` issue on the private engine repo, never triggers the engine directly;
  see `signalgraph-engine/README.md` §18 for one-time operator setup)

## Develop

```
npm install
npm run dev         # astro dev server; local draft fixtures visible
npm run build       # static build + Pagefind search index (drafts hidden on CI / CF deploy)
npm run preview     # serve dist/ via astro's own server (search works here)
npm run worker:dev  # build, then `wrangler dev` — exercises the Worker incl. /api/request-topic
npm run deploy      # build, then `wrangler deploy`
```

`npm run worker:dev` needs `.dev.vars` (gitignored; copy `.dev.vars.example`) for
`GH_ISSUE_TOKEN`/`TURNSTILE_SECRET` if you want to exercise the real GitHub/Turnstile
calls locally; without it the endpoint still runs but every submission fails
Turnstile verification (fail-closed, not fail-open).

Design contract: dark-first with a no-flash light toggle; fluid type; 70ch measure;
44px tap targets; diagrams pan on phones, never squash; animation runs only
in-viewport and is disabled under `prefers-reduced-motion`. Post pages ship
&lt; 60 KB of JavaScript.
