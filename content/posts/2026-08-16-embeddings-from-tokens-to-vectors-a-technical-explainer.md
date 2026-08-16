---
title: "Embeddings: From Tokens to Vectors \u2014 A Technical Explainer"
description: "A thorough guide to embeddings: what they are, why they power modern search and AI, how they are trained, and the practical trade-offs every engineer should know."
date: "2026-08-16"
format: "explainer"
concept: "Embeddings"
tldr: ["Embeddings map discrete data (text, images, audio) into continuous vector spaces where geometric distance reflects semantic similarity.", "Dense embeddings pack meaning into fixed-size vectors; sparse embeddings retain lexical signals and are interpretable. Modern systems often combine both.", "Training objectives \u2014 from word2vec's co-occurrence prediction to contrastive learning on massive pairs \u2014 determine what 'similarity' means for a given model.", "Vector databases and approximate nearest-neighbor search make embedding-based retrieval practical at scale, but indexing strategy and dimensionality directly affect latency and recall.", "Embeddings lose explicit structure (syntax, hierarchy, provenance). They are a compressed, lossy representation \u2014 useful for retrieval and clustering, insufficient for precise reasoning."]
references: ["S1: arXiv \u2014 UEmbed: Unified Sparse and Dense Multimodal Embeddings \u2014 https://arxiv.org/abs/2608.02583v1", "S2: AI Engineering (Chip Huyen) \u2014 AI Engineering by Chip Huyen \u2014 part 249 \u2014 pack://ai-engineering-by-chip-huyen"]
writer: "openrouter/nvidia/nemotron-3-ultra-550b-a55b:free"
fact_check: "passed"
diagram: "2026-08-16-embeddings-from-tokens-to-vectors-a-technical-explainer.json"
---

## What an embedding is

An **embedding** is a function that maps a discrete object — a word, a sentence, an image patch, a user ID — to a point in a continuous vector space (usually $\mathbb{R}^d$). The defining property: *semantic similarity corresponds to geometric proximity*. Two inputs that mean similar things end up close together (high cosine similarity, low Euclidean distance); unrelated inputs end up far apart.

Think of it as a coordinate system for meaning. In a well-trained text embedding space, the vector for "king" minus "man" plus "woman" lands near "queen". Not because the model knows biology, but because the relational pattern "royal counterpart" appears consistently across the training corpus and the optimizer discovers a linear subspace that captures it.

**Glossary**: *Vector space* — a set of vectors where addition and scalar multiplication are defined. *Cosine similarity* — the cosine of the angle between two vectors; 1 means identical direction, 0 means orthogonal, -1 means opposite. *Dimensionality (d)* — the length of the vector; typical values range from 384 (small BERT) to 4096+ (large LLM hidden states).

## Why embeddings matter

Before embeddings, information retrieval relied on **lexical matching**: exact token overlap, TF-IDF weighting, inverted indices. That works for keyword search but fails on synonymy ("car" vs "automobile"), polysemy ("bank" as river vs financial), and cross-lingual or cross-modal queries.

Embeddings solve this by learning a *dense distributed representation* where each dimension participates in representing many concepts. This enables:

- **Semantic search**: query "how to fix a leaky faucet" retrieves a document titled "faucet repair guide" even with zero token overlap.
- **Retrieval-augmented generation (RAG)**: a retriever fetches the $k$ chunks whose embeddings are closest to the query embedding, then a generator conditions on them [S2].
- **Clustering and classification**: downstream tasks become simple geometry — k-means, linear probes, nearest-neighbor lookup.
- **Cross-modal alignment**: joint image-text spaces (CLIP-style) let you search images with text and vice versa.

The trade-off: embeddings are *lossy*. They discard surface form, syntax, and explicit relational structure. You cannot reconstruct the original text from its embedding (nor should you expect to).

## How embeddings are learned

### The training objective defines "similarity"

There is no single "embedding algorithm." The vector space reflects the **training objective** and **data**. Three dominant paradigms:

1. **Co-occurrence prediction (word2vec, GloVe, fastText)**. Skip-gram with negative sampling maximizes the dot product of a target word and its context words while pushing down random negatives. The result: words appearing in similar contexts get similar vectors. FastText adds subword n-grams, giving vectors for out-of-vocabulary tokens.

2. **Masked language modeling (BERT, RoBERTa, E5, BGE)**. Randomly mask tokens, predict them from bidirectional context. The [CLS] token (or mean-pooled last-layer states) becomes a sentence embedding. Fine-tuning on labeled pairs (query, relevant passage) with contrastive or triplet loss aligns the space for retrieval.

3. **Contrastive learning on massive pairs (CLIP, SigLIP, multimodal LLMs)**. Given (image, caption) pairs, maximize similarity of matching pairs and minimize non-matching pairs in a shared space. This yields *aligned* image and text embeddings — same vector space, different modalities.

### Concrete example: training a dense retriever

Suppose you want a model that embeds queries and passages so that relevant pairs are close. A standard recipe:

1. **Base model**: a pretrained transformer (e.g., BERT-base, 768-d).
2. **Contrastive fine-tuning**: for each query $q$, you have one positive passage $p^+$ and $n$ negatives $p^-_i$. Minimize:
   $$\mathcal{L} = -\log \frac{\exp(\text{sim}(q, p^+) / \tau)}{\exp(\text{sim}(q, p^+) / \tau) + \sum_i \exp(\text{sim}(q, p^-_i) / \tau)}$$
   where $\text{sim}$ is cosine similarity and $\tau$ a temperature.
3. **Hard negatives**: mine negatives that are lexically similar but semantically irrelevant (e.g., using BM25 or an earlier checkpoint). This sharpens the decision boundary.
4. **Pooling**: mean-pool the last-layer token embeddings (excluding padding), then L2-normalize so cosine similarity = dot product.

The resulting model maps any text to a 768-d unit vector. At inference, you embed the corpus once (offline), index the vectors, and embed each query online.

## Dense vs sparse vs hybrid

**Dense embeddings** (the default above) pack all information into $d$ floats. They excel at semantic matching but can miss rare terms, IDs, or exact phrases.

**Sparse embeddings** (e.g., SPLADE, uniCOIL) output a high-dimensional vector ($\sim$30k–100k, vocabulary size) where most entries are zero. Non-zero weights correspond to *expanded* query terms — the model learns to "predict" relevant vocabulary tokens. They retain lexical precision and work with inverted indices.

**Learned Sparse Retrieval (LSR)** pushes beyond exact matching toward richer semantics while staying sparse [S1]. Recent work unifies both: **UEmbed** appends $N$ learnable special tokens to the input, partitions the vocabulary into $N$ disjoint subsets, and lets each token's causal hidden state predict sparse weights over its subset. The $N$ subsets concatenate into a full sparse vector — produced in one decoder-only forward pass alongside a dense vector [S1]. UEmbed-9B reaches 71.8 (dense) and 71.0 (sparse) on MMEB-v2, outperforming multimodal embedding models trained on publicly available data [S1].

**Hybrid search** combines both: retrieve candidates with sparse (high recall on keywords), rerank with dense (semantic precision), or fuse scores. This is now standard in production RAG pipelines.

## Multimodal and beyond

Embeddings are not text-only. **Image embeddings** (ResNet, ViT, DINOv2) map pixels to vectors. **Audio embeddings** (Wav2Vec2, CLAP) map waveforms. **Multimodal embeddings** (CLIP, ImageBind, SigLIP) project multiple modalities into a *shared* space — enabling text-to-image search, zero-shot classification, and cross-modal retrieval.

**Graph embeddings** (Node2Vec, GraphSAGE, GNNs) map nodes to vectors preserving structural proximity. **Tabular embeddings** learn representations for categorical features (entity embeddings) or whole rows.

The unifying theme: *any discrete or structured input can be embedded if you define a similarity objective and a parametric encoder*.

## Applications in production

1. **Semantic search & RAG** — The dominant pattern: embed corpus chunks → index in vector DB → embed query → ANN search → rerank → generate [S2]. Vector databases (Milvus, Pinecone, Weaviate, Qdrant, Vespa) handle the ANN indexing (HNSW, IVF, DiskANN) and filtering.
2. **Recommendation** — User and item embeddings (two-tower models) enable dot-product scoring at scale. Cold-start items get embeddings from content (text, images).
3. **Deduplication & clustering** — Near-duplicate detection in datasets (e.g., LAION, Common Crawl) uses embedding similarity thresholds.
4. **Anomaly detection** — Embed normal behavior; flag outliers by distance to nearest neighbors or cluster centroids.
5. **Cross-lingual transfer** — Multilingual embeddings (LaBSE, mUSE, M3E) align 100+ languages; fine-tune on one language, retrieve in another.
6. **Agentic workflows** — Embeddings serve as memory: store (observation, action, outcome) tuples; retrieve relevant episodes by similarity to current context [S1].

## Trade-offs and limitations

| Dimension | Consideration |
|---|---|
|**Dimensionality**| Larger $d$ → more capacity but higher storage, slower ANN, more compute for dot products. Typical sweet spot: 768–1536 for dense; 30k+ for sparse (but sparse). |
|**Static vs contextual**| Static (word2vec) = one vector per token, fast but context-blind. Contextual (BERT, LLM) = different vector per occurrence, richer but heavier. |
|**Domain shift**| Embeddings trained on web text degrade on legal, medical, or code corpora. Domain-adaptive pretraining or fine-tuning is often necessary. |
|**Interpretability**| Dense vectors are opaque. Sparse vectors are interpretable (non-zero dims = terms). Hybrid gives both. |
|**Position & structure**| Standard pooling discards token order. For tasks needing syntax (code, logic), consider structural encoders or late interaction (ColBERT). |
|**Bias & fairness**| Embeddings reflect corpus biases (gender, racial, cultural). Mitigation: debiasing subspaces, counterfactual data augmentation, or post-hoc constraints. |
|**Freshness**| Embeddings are static snapshots. New entities, slang, or events require re-embedding or incremental update strategies. |
|**Adversarial robustness**| Small perturbations can flip nearest neighbors. Certified defenses are an open research area. |

**When NOT to use embeddings**:
- Exact-match requirements (IDs, SKUs, regex patterns) — use inverted index or SQL.
- Structured reasoning (arithmetic, logic, multi-hop) — use symbolic systems or LLMs with tools.
- Explainable decisions where you must trace *why* — embeddings give proximity, not provenance.
- Tiny datasets where TF-IDF + BM25 outperforms learned models.

## Further reading

- **UEmbed: Unified Sparse and Dense Multimodal Embeddings** — introduces a decoder-only model producing both sparse and dense vectors in one pass, with benchmarks on MMEB-v2 and BEIR [S1].
- **AI Engineering (Chip Huyen)** — Chapter 3 covers embedding fundamentals; Chapter 6 details embedding-based retrieval, vector databases, and reranking [S2].
- **Sentence Embeddings Benchmarks** — MTEB (Massive Text Embedding Benchmark) and MMEB (Multimodal) for standardized evaluation across tasks.
- **Vector Database Internals** — HNSW, IVF-PQ, DiskANN, and filtering strategies (e.g., Vespa's hybrid search).
- **Contrastive Learning Papers** — SimCLR, MoCo, CLIP, SigLIP, E5, BGE, GTE for the evolution of training objectives.

## Key facts
- UEmbed-9B reaches 71.8 (dense) and 71.0 (sparse) on MMEB-v2, outperforming multimodal embedding models trained on publicly available data [S1].
- Embedding-based retrieval consists of: (1) embedding the query with the same model used at indexing time, (2) fetching $k$ chunks whose embeddings are closest to the query embedding [S2].
- Vector databases store vectors; the hard part is vector search — finding close vectors efficiently via indexing (HNSW, IVF, etc.) [S2].

## References

- S1: arXiv — UEmbed: Unified Sparse and Dense Multimodal Embeddings — https://arxiv.org/abs/2608.02583v1
- S2: AI Engineering (Chip Huyen) — AI Engineering by Chip Huyen — part 249 — pack://ai-engineering-by-chip-huyen
