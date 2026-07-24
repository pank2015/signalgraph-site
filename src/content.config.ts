import { defineCollection, z } from "astro:content";
import { glob } from "astro/loaders";

// Post frontmatter is the contract with signalgraph-engine's publish bridge
// (engine/steps/post.py _frontmatter). Fields added there must be added here.
const posts = defineCollection({
  loader: glob({ pattern: "**/*.md", base: "./content/posts" }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    date: z.coerce.date(),
    // pillar optional: news posts orbit a pillar; ADR-0001 explainers orbit a
    // concept and may not map cleanly to one.
    pillar: z.enum(["agentic-ai", "hardware", "quantum", "data-platforms", "ea-practice"]).optional(),
    format: z.enum(["daily_signal", "deep_dive", "shift_report", "teardown", "primer", "explainer"]),
    focus: z.string().optional(),
    concept: z.string().optional(),     // explainer: the concept being taught
    diagram: z.string().optional(),     // filename under content/diagrams/
    provenance: z.string().optional(),  // filename under content/provenance/
    claims_cited: z.number().optional(),
    tldr: z.array(z.string()).optional(),
    sources_count: z.number().optional(),
    references: z.array(z.string()).optional(),  // explainer: [S#] grounding sources
    writer: z.string().optional(),
    fact_check: z.string().optional(),  // explainer: passed | flagged
    engine_run: z.string().optional(),
    draft: z.boolean().default(false),  // fixtures only — the engine never sets it
  }),
});

export const collections = { posts };
