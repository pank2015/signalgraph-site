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

- `stencil/flowkit.schema.json` — the diagram DSL contract; every diagram on the
  site is rendered from this schema by one deterministic component
- `src/styles/tokens.css` — design tokens: dark/light themes, pillar hues,
  fluid type scale, motion rules

Site build lands in Phase 3 of the project plan.
