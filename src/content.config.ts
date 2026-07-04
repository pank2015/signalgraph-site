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
    pillar: z.enum(["agentic-ai", "hardware", "quantum", "data-platforms", "ea-practice"]),
    format: z.enum(["daily_signal", "deep_dive", "shift_report", "teardown", "primer"]),
    focus: z.string().optional(),
    diagram: z.string().optional(),     // filename under content/diagrams/
    provenance: z.string().optional(),  // filename under content/provenance/
    claims_cited: z.number().optional(),
    engine_run: z.string().optional(),
    draft: z.boolean().default(false),  // fixtures only — the engine never sets it
  }),
});

export const collections = { posts };
