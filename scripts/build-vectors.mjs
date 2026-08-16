// Combine per-post semantic-search vector shards into the single vectors.json
// the client fetches. Run before `astro build` (and `astro dev`) — see
// package.json. The combined file is a BUILD ARTIFACT: generated here,
// gitignored, never committed. The shards (data/search-vectors/<slug>.json,
// one per post, written by the engine inside each post PR) are the source of
// truth. This is why post PRs never conflict — each adds its own shard file
// instead of rewriting a shared index. See signalgraph-engine ADR-0003.
import fs from "node:fs";
import path from "node:path";

// Index header — keep in sync with signalgraph-engine engine/steps/vectors.py
// (MODEL / DIM / QUANTIZATION). Changes only if the embedding model changes.
const HEADER = { model: "BAAI/bge-small-en-v1.5", dim: 384, quantization: "int8-per-vector-scale" };

const SHARD_DIR = "data/search-vectors";
const OUT = "public/search/vectors.json";

const bySlug = new Map();

// Primary source: the per-post shards.
if (fs.existsSync(SHARD_DIR)) {
  for (const name of fs.readdirSync(SHARD_DIR)) {
    if (!name.endsWith(".json")) continue;
    try {
      const entry = JSON.parse(fs.readFileSync(path.join(SHARD_DIR, name), "utf8"));
      if (entry && entry.slug) bySlug.set(entry.slug, entry);
    } catch (err) {
      console.warn(`[build-vectors] skipping unreadable shard ${name}: ${err.message}`);
    }
  }
}

// Defensive transition fold-in: if a legacy monolithic vectors.json is still
// present (e.g. an old-format post PR re-created it before the engine switched
// to shards), keep its posts too so nothing drops out mid-migration. Shards
// win on slug. Harmless once the legacy file is gone.
if (fs.existsSync(OUT)) {
  try {
    const legacy = JSON.parse(fs.readFileSync(OUT, "utf8"));
    for (const p of legacy.posts ?? []) {
      if (p && p.slug && !bySlug.has(p.slug)) bySlug.set(p.slug, p);
    }
  } catch {
    /* not valid JSON — ignore, shards are authoritative */
  }
}

const posts = [...bySlug.values()].sort((a, b) => a.slug.localeCompare(b.slug));
fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify({ ...HEADER, posts }) + "\n");
console.log(`[build-vectors] wrote ${OUT} with ${posts.length} post vector(s)`);
