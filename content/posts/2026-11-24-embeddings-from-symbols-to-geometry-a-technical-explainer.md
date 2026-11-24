---
title: "Embeddings: From Symbols to Geometry \u2014 A Technical Explainer"
description: "A thorough guide to embeddings: what they are, why they matter, how they work, key variants, applications, and trade-offs."
date: "2026-11-24"
format: "explainer"
concept: "Embeddings"
tldr: ["Embeddings map discrete data (words, images, users) into continuous vector spaces where geometric distance reflects semantic similarity.", "They replace sparse symbolic representations (one-hot, TF-IDF, BM25) with dense vectors that capture meaning, enabling semantic search, recommendation, and multimodal reasoning.", "Modern embeddings come from transformer encoders (BERT-style), decoder-only models (UEmbed), or dual-encoder architectures (CLIP) trained with contrastive objectives.", "Static embeddings (word2vec, GloVe, Model2Vec) trade context-sensitivity for 100\u00d7 speed; dense embeddings trade compute for richer semantics.", "Key limitations: embedding spaces distort physical measurements, exhibit modality gaps in dual encoders, and remain opaque without interpretability tools like sparse autoencoders."]
references: ["S1: Google Quantum AI Blog \u2014 EmbeddingGemma 2: an open, lightweight multimodal embedding model \u2014 https://blog.google/innovation-and-ai/technology/developers-tools/embeddinggemma-2/", "S2: arXiv \u2014 Embedding Models Measure in Peculiar Ways \u2014 https://arxiv.org/abs/2609.20821v1", "S3: arXiv \u2014 User Embeddings are Superpositions of Interpretable Behavioral Modes \u2014 https://arxiv.org/abs/2611.08487v1", "S4: arXiv \u2014 UEmbed: Unified Sparse and Dense Multimodal Embeddings \u2014 https://arxiv.org/abs/2608.02583v1", "S5: Hacker News \u2014 We turned EmbeddingGemma 2 into a speech-to-text model \u2014 https://eg2.haku.sh/", "S6: arXiv \u2014 Embedding Prediction Helps Image Generation \u2014 https://arxiv.org/abs/2610.02203v1", "S7: AI Engineering (Chip Huyen) \u2014 AI Engineering by Chip Huyen \u2014 part 249 \u2014 pack://ai-engineering-by-chip-huyen", "S9: arXiv \u2014 TowerBridge: Bridging the Dual-Encoder Modality Gap via Weight-Space Programming \u2014 https://arxiv.org/abs/2611.31233v1", "S10: arXiv \u2014 Class Activation Mapping in Explainable Computer Vision: A Method-Centered Review \u2014 https://arxiv.org/abs/2608.12299v1", "S11: LlamaIndex Blog \u2014 Exploring Static Embedding Retrieval \u2014 https://www.llamaindex.ai/blog/exploring-static-embedding-retrieval"]
writer: "openrouter/nvidia/nemotron-3-ultra-550b-a55b:free"
fact_check: "passed"
diagram: "2026-11-24-embeddings-from-symbols-to-geometry-a-technical-explainer.json"
---

## What an embedding is

An **embedding** is a function that maps a discrete object — a word, a document, an image, a user session — to a point in a continuous vector space (typically $\mathbb{R}^d$). The defining property: *geometric proximity in that space corresponds to semantic similarity in the original domain*. Two sentences with similar meaning land near each other; two images of the same object cluster together; users with similar behavior get nearby vectors.

Think of it as a **semantic coordinate system**. In a 2D map, physical distance mirrors geographic distance. In an embedding space, vector distance (cosine, Euclidean, dot product) mirrors *meaning* distance. The map is learned, not hand-crafted.

**Glossary**: *Vector space* — a set of vectors closed under addition and scalar multiplication. *Dense vector* — most dimensions are non-zero (contrast with *sparse* vectors like one-hot or TF-IDF where most entries are zero). *Dimensionality* $d$ — typical values range from 64 (compact user embeddings) to 4096+ (large multimodal models).

## Why embeddings matter

Before embeddings, NLP and information retrieval relied on **sparse symbolic representations**: one-hot vectors (vocabulary-size dimensions, one 1, rest 0), term-frequency vectors, and ranking functions like **BM25** (a probabilistic scoring function, not a vector representation). These approaches:

- **Ignore semantics** — "car" and "automobile" are orthogonal in one-hot space.
- **Suffer from vocabulary mismatch** — a query for "heart attack" won't match a document containing "myocardial infarction".
- **Scale poorly** — high-dimensional sparse vectors are expensive to store and compare.

Embeddings solve all three. They **compress meaning into fixed-size dense vectors** where synonyms are neighbors, enabling:

1. **Semantic search** — retrieve by meaning, not keyword overlap.
2. **Cross-modal retrieval** — search images with text, or vice versa.
3. **Downstream transfer** — a pre-trained embedding feeds a classifier, reranker, or generator with rich features.
4. **Efficient similarity** — vector search (ANN indexes) scales to billions of items.

As Chip Huyen notes, embedding-based retrieval has two steps: embed the query with the same model used at index time, then fetch the $k$ nearest vectors from a **vector database** optimized for approximate nearest-neighbor search [S7]. The embedding model quality is the linchpin: a bad embedder makes the whole pipeline fail.

## How embeddings work: a concrete walk-through

### The modern recipe: transformer encoder + contrastive training

Most state-of-the-art text embeddings follow this pipeline:

1. **Tokenize** — split input into subword tokens (e.g., BERT WordPiece vocabulary).
2. **Embed tokens** — each token ID maps to a learned vector (the *token embedding table*).
3. **Add position embeddings** — inject sequence order information.
4. **Pass through transformer encoder** — self-attention layers mix token representations contextually.
5. **Pool** — reduce the sequence of token vectors to a single fixed-size vector (common: mean pooling over non-padding tokens, or the `[CLS]` token representation).
6. **Normalize** — L2-normalize to unit length so cosine similarity equals dot product.

**Concrete example** (mental model, not real IDs):

```
Input:  "The cat sat"
Tokens: [CLS, the, cat, sat, SEP]
Token embeddings: 5 vectors of dimension 768
Transformer layers: 12 layers of self-attention + FFN
Output: 5 contextualized vectors of dimension 768
Pool (mean): 1 vector of dimension 768
Normalize: unit vector in R^768
```

### Training objective: contrastive learning

The model learns to pull *positive pairs* (semantically related) together and push *negative pairs* apart. For text, positives are often (query, relevant passage) pairs from datasets like MS MARCO. For multimodal models (CLIP-style), positives are (image, caption) pairs [S9]. The loss is typically **InfoNCE** (a cross-entropy over similarity scores):

$$
\mathcal{L} = -\log \frac{\exp(\text{sim}(q, p^+)/\tau)}{\sum_{p} \exp(\text{sim}(q, p)/\tau)}
$$

where $\tau$ is a temperature hyperparameter. This forces the embedding space to organize around semantic similarity.

### Dual-encoder architecture for cross-modal tasks

In **CLIP-style models**, two separate towers (image encoder, text encoder) map into a *shared* embedding space. They are trained jointly on paired data. A known artifact: the **modality gap** — image and text embeddings occupy distinct regions even for matched pairs, which can hurt retrieval [S9]. TowerBridge [S9] addresses this via *weight-space programming*: an LLM agent inspects both towers, identifies directions where towers agree more on hard negatives than on matched pairs, and applies closed-form weight edits. Across 21 CLIP checkpoints, TowerBridge improves COCO test retrieval by 16.8 RSUM and Flickr30k by 6.6 on average, with no architecture change or backpropagation [S9].

## Key techniques and variants

### Dense vs. sparse embeddings

| Property | Dense (e.g., BERT, E5, GTE) | Sparse (e.g., SPLADE, uniCOIL) | Static (e.g., word2vec, GloVe, Model2Vec) |
|---|---|---|---|
| **Vector** | Fixed $d$, mostly non-zero | High-dim ($\sim$30k), few non-zero | Fixed $d$, mostly non-zero |
| **Context** | Full contextual (transformer) | Contextual (transformer) or static | **None** — single vector per token |
| **Speed** | Slow (transformer forward) | Moderate | **~100× faster** — table lookup + average [S11] |
| **Semantics** | Rich, compositional | Lexical + some semantics | Limited, no polysemy handling |
| **Use case** | Semantic search, RAG, classification | Hybrid search (BM25 + learned) | High-throughput, low-latency, on-device |

**Static embeddings** (word2vec, GloVe, fastText) assign one vector per token. Modern distillation methods like **Model2Vec** take a transformer teacher, embed its vocabulary tokens, and store the results in a lookup table. At inference, a text embedding is the average of its token vectors — no transformer pass. LlamaIndex reports ~0.05 ms per line on CPU, WASM-friendly, but notes static embeddings fail at late-interaction scoring (ColBERT-style MaxSim) because they lack token-level contextualization [S11].

### Multimodal embeddings

**Dual-encoder (CLIP, SigLIP, EmbeddingGemma 2)**: separate image/text towers, contrastive loss. EmbeddingGemma 2 is Google's open multimodal embedding model optimized for privacy-first (on-device) use cases [S1]. It has been repurposed by the community for speech-to-text [S5].

**Unified decoder-only (UEmbed)**: a single causal transformer produces *both* dense and sparse vectors in one forward pass. UEmbed appends $N$ learnable special tokens, partitions the vocabulary into $N$ disjoint subsets, and uses each token's hidden state to predict sparse weights over its subset. UEmbed-9B reaches 71.8 (dense) and 71.0 (sparse) on MMEB-v2, outperforming multimodal baselines trained on public data, while remaining competitive on BEIR [S4].

### Embedding prediction as generative conditioning

**NEPA (Next-Embedding Predictive Autoregression)** [S6] trains a transformer to predict the next continuous embedding in a sequence. In diffusion transformers, a class label or text prompt is embedded once and reused at every denoising step. NEPA instead predicts *clean-image embeddings* from noisy-image embeddings and conditions the generator on these predictions, recomputed at each step. NEPA-DiT-XL reaches **FID 1.32** on ImageNet $256\times256$ using about a third of the training compute of REPA [S6].

### Interpretability: embeddings as superpositions

User and item embeddings in recommender systems are dense and opaque. **Sparse autoencoders (SAEs)** can decompose them into **interpretable behavioral modes** — sparse superpositions of human-understandable concepts (e.g., "weekend shopper", "tech enthusiast") [S3]. The method is post-hoc and model-agnostic: train an SAE on frozen embeddings, recover modes, auto-label them with an LLM, then query audiences in natural language — even on embeddings never trained on text [S3].

## Applications

1. **Semantic search & RAG** — embed queries and corpus chunks, retrieve top-$k$ by cosine similarity, feed to LLM. Vector databases (Pinecone, Weaviate, Milvus, Qdrant) handle ANN indexing (HNSW, IVF, DiskANN).
2. **Recommendation & personalization** — user/item embeddings power candidate generation (two-tower models), ranking features, and cold-start via content embeddings.
3. **Cross-modal retrieval** — image search by text, video moment retrieval, audio-text matching.
4. **Clustering & deduplication** — embed documents, cluster in vector space, detect near-duplicates.
5. **Classification & few-shot learning** — embed inputs, train a linear probe or nearest-centroid classifier.
6. **Anomaly detection** — embed normal behavior, flag outliers by distance.
7. **Generative conditioning** — NEPA [S6] shows predicted embeddings can replace static condition embeddings in diffusion models.
8. **On-device / privacy-first** — EmbeddingGemma 2 [S1] and static embeddings [S11] enable local embedding without cloud round-trips.

## Trade-offs and limitations

### 1. Embedding spaces distort physical reality

Embeddings model *semantic* similarity, not physical measurement. An arXiv study [S2] tested whether embedding spaces reflect objective physical quantities (mass, distance, time, volume). Result: **physical measurement is only weakly modeled**; similarity is strongly influenced by *superficial string similarity* (e.g., "5 kg" and "5 km" are close because of "5 ", not unit semantics). Recalibration does not substantially fix this. **Do not trust embeddings for quantitative reasoning**.

### 2. Modality gap in dual encoders

CLIP-style models place image and text embeddings in separate regions of the shared space. This gap correlates with retrieval errors on hard negatives. Post-hoc removal *degrades* retrieval on every CLIP checkpoint tested [S9]. TowerBridge's targeted attenuation of specific disagreement directions improves retrieval while *preserving* the gap — suggesting the gap itself is not the enemy; misaligned directions are.

### 3. Opacity and interpretability

Dense embeddings are black boxes. SAEs [S3] and CAM-style methods [S10] (for vision) provide post-hoc explanations, but they add complexity and are not guaranteed to be faithful. For high-stakes decisions (credit, medical), this is a regulatory and ethical concern.

### 4. Static embeddings lose context

Model2Vec-style static embeddings are fast but **cannot disambiguate polysemy** ("bank" = river vs. financial). They fail at tasks requiring token-level interaction (ColBERT MaxSim) [S11]. Use them only when latency/budget dominate and semantic nuance is secondary.

### 5. Training data and domain shift

An embedding model trained on web text may poorly represent legal, medical, or code domains. Fine-tuning on in-domain pairs (query, passage) is often necessary. There is no universal "best" embedding; benchmarks (MTEB, MMEB, BEIR) guide selection but domain evaluation is essential.

### 6. Vector search is approximate

ANN indexes trade recall for speed. HNSW gives high recall at high memory cost; IVF+PQ compresses but loses precision. For exact nearest neighbors at scale, you need exhaustive search — often impractical. Hybrid search (sparse + dense + reranker) mitigates but adds latency.

### 7. When *not* to use embeddings

- **Exact string matching required** (IDs, codes, regex) — use inverted index.
- **Quantitative reasoning** ("which is heavier?") — embeddings fail [S2].
- **Explainability mandated** — consider sparse features or interpretable models.
- **Tiny data, simple task** — TF-IDF + logistic regression may beat a transformer embedder.
- **Real-time on microcontroller** — even static embeddings may be too large; consider hashing or quantization.

## Further reading

- **EmbeddingGemma 2** — Google's open multimodal embedding model for privacy-first use cases [S1]
- **Embedding Models Measure in Peculiar Ways** — empirical study of physical measurement in embedding spaces [S2]
- **User Embeddings are Superpositions of Interpretable Behavioral Modes** — SAE-based interpretability for user embeddings [S3]
- **UEmbed: Unified Sparse and Dense Multimodal Embeddings** — decoder-only model producing both sparse and dense vectors [S4]
- **Embedding Prediction Helps Image Generation** — NEPA for diffusion transformer conditioning [S6]
- **AI Engineering (Chip Huyen)** — embedding-based retrieval and vector databases [S7]
- **TowerBridge: Bridging the Dual-Encoder Modality Gap via Weight-Space Programming** — fixing CLIP retrieval without backprop [S9]
- **Class Activation Mapping in Explainable Computer Vision** — visual explanation methods for embedding-based models [S10]
- **Exploring Static Embedding Retrieval** — LlamaIndex's practical take on Model2Vec and static embeddings [S11]

## Key facts

- EmbeddingGemma 2 is an open multimodal embedding model optimized for privacy-first use cases [S1]
- Embedding spaces weakly model physical measurements; similarity is driven by string overlap [S2]
- User embeddings decompose into interpretable behavioral modes via sparse autoencoders [S3]
- UEmbed-9B reaches 71.8 (dense) and 71.0 (sparse) on MMEB-v2, outperforming public-data multimodal baselines [S4]
- EmbeddingGemma 2 has been repurposed for speech-to-text by the community [S5]
- NEPA-DiT-XL reaches FID 1.32 on ImageNet 256×256 using ~1/3 the training compute of REPA [S6]
- Embedding-based retrieval: embed query, fetch k nearest vectors from vector database [S7]
- TowerBridge improves COCO test retrieval by 16.8 RSUM and Flickr30k by 6.6 on average across 21 CLIP checkpoints via closed-form weight edits [S9]
- Static embeddings (Model2Vec) run ~0.05 ms per line on CPU, ~100× faster than dense models, but fail at late-interaction scoring [S11]

## References

- S1: Google Quantum AI Blog — EmbeddingGemma 2: an open, lightweight multimodal embedding model — https://blog.google/innovation-and-ai/technology/developers-tools/embeddinggemma-2/
- S2: arXiv — Embedding Models Measure in Peculiar Ways — https://arxiv.org/abs/2609.20821v1
- S3: arXiv — User Embeddings are Superpositions of Interpretable Behavioral Modes — https://arxiv.org/abs/2611.08487v1
- S4: arXiv — UEmbed: Unified Sparse and Dense Multimodal Embeddings — https://arxiv.org/abs/2608.02583v1
- S5: Hacker News — We turned EmbeddingGemma 2 into a speech-to-text model — https://eg2.haku.sh/
- S6: arXiv — Embedding Prediction Helps Image Generation — https://arxiv.org/abs/2610.02203v1
- S7: AI Engineering (Chip Huyen) — AI Engineering by Chip Huyen — part 249 — pack://ai-engineering-by-chip-huyen
- S9: arXiv — TowerBridge: Bridging the Dual-Encoder Modality Gap via Weight-Space Programming — https://arxiv.org/abs/2611.31233v1
- S10: arXiv — Class Activation Mapping in Explainable Computer Vision: A Method-Centered Review — https://arxiv.org/abs/2608.12299v1
- S11: LlamaIndex Blog — Exploring Static Embedding Retrieval — https://www.llamaindex.ai/blog/exploring-static-embedding-retrieval
