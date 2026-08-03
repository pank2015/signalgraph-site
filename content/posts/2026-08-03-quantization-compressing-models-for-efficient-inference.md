---
title: "Quantization: Compressing Models for Efficient Inference"
description: "A technical explainer on reducing numerical precision in neural networks \u2014 what it is, why it enables deployment at scale, how methods differ, and where the accuracy\u2013efficiency trade-offs bite."
date: "2026-08-03"
format: "explainer"
concept: "quantization"
tldr: ["Quantization reduces model weight and activation precision (e.g., FP32 \u2192 INT4) to cut memory use and speed up inference.", "Post-training quantization (PTQ) is the dominant practical approach; it requires only a small calibration set, not full retraining.", "Uniform bit-widths across all layers waste capacity; mixed-precision methods allocate bits where models are most sensitive.", "Behavioral divergence appears before accuracy drops: quantized models can match benchmarks while changing predictions on individual examples.", "Dynamic, runtime quantization (e.g., for MoE models) can balance weight precision against KV-cache pressure for better throughput."]
references: ["S1: arXiv \u2014 The Illusion of Equivalency: Statistical Characterization of Quantization Effects in LLMs \u2014 https://arxiv.org/abs/2607.08734v1", "S2: arXiv \u2014 MixFrag: Fragility-Guided Mixed-Precision Post-Training Quantization for Vision Transformers \u2014 https://arxiv.org/abs/2607.28589v1", "S8: AI Engineering (Chip Huyen) \u2014 AI Engineering by Chip Huyen \u2014 pack://ai-engineering-by-chip-huyen", "S11: arXiv \u2014 PagedWeight: Efficient MoE LLM Serving with Dynamic Quality-Aware Weight Quantization \u2014 https://arxiv.org/abs/2607.16184v1"]
writer: "openrouter/nvidia/nemotron-3-ultra-550b-a55b:free"
fact_check: "passed"
diagram: "2026-08-03-quantization-compressing-models-for-efficient-inference.json"
audio: "2026-08-03-quantization-compressing-models-for-efficient-inference.mp3"
---

## What quantization is

Quantization, in the context of neural network inference, is the process of representing model parameters and intermediate activations with fewer bits than the original floating-point format — typically FP32 or FP16 — while preserving as much task performance as possible. The core idea is straightforward: a 32-bit floating-point number occupies 4 bytes; an 8-bit integer occupies 1 byte. If you can map the model’s weight distribution into that smaller container with acceptable error, you shrink the model by up to 4× and, on hardware that supports low-precision arithmetic, accelerate matrix multiplications by a similar factor.

Think of it like image compression. A RAW photo stores every pixel at high precision; a JPEG throws away perceptual detail you won’t notice. Quantization throws away numerical detail the model (ideally) doesn’t need. The difference is that neural networks are surprisingly tolerant of reduced precision — up to a point.

## Why it matters

Memory bandwidth, not compute, is the primary bottleneck for large language model (LLM) inference. Modern GPUs can perform matrix multiplications far faster than they can feed weights from VRAM. A 70-billion-parameter model at FP16 requires ~140 GB just for weights — more than a single H100 (80 GB) or A100 (80 GB) holds. Quantization makes such models fit on fewer GPUs, or on one, and lets the memory system keep the compute units fed.

Post-training quantization (PTQ) has become the default deployment path because it avoids the cost and complexity of retraining. You take a trained FP16 model, run a small calibration dataset through it to collect activation statistics, compute per-tensor or per-channel scaling factors, and round weights to integers. The result is a quantized model ready for inference engines like TensorRT, vLLM, or llama.cpp. PTQ is widely used to deploy LLMs in resource-constrained settings [S1].

The stakes are visible in mixture-of-experts (MoE) serving. MoE models activate only a subset of experts per token, but all expert weights must reside in GPU memory. In KV-cache-intensive scenarios, the memory budget for weights competes directly with the cache. Dynamic quantization at runtime can navigate this trade-off, achieving FP16-equivalent accuracy with up to 72% GPU memory savings and 1.94× throughput improvement [S11].

## How it works: a concrete walk-through

### The basic mapping

Symmetric quantization maps a floating-point range $[-R, R]$ to signed integers $[-2^{b-1}, 2^{b-1}-1]$ via a scale factor $s = R / 2^{b-1}$. The quantized value is $q = \text{round}(x / s)$. Dequantization is $x' = q \cdot s$. Asymmetric quantization adds a zero-point offset to handle ranges that aren’t centered at zero. Per-tensor quantization uses one scale for the whole tensor; per-channel uses one scale per output channel (for weights) or per token (for activations), reducing error at the cost of more metadata.

### Calibration

PTQ needs a calibration set — typically 128–1024 sequences — to observe activation ranges. The model runs in FP16; statistics (min, max, or percentile clipping thresholds) are collected per layer. These determine the quantization parameters. No gradient updates occur.

### Sensitivity is not uniform

Not all layers tolerate the same precision. In Transformers, the query and key projections are consistently more sensitive to quantization than value and output projections [S1]. Vision Transformers show similar heterogeneity: uniform bit-widths across components overlook their differing fragility, leading to inefficient precision allocation [S2].

### Mixed-precision via fragility estimation

MixFrag addresses this by measuring each component’s quantization fragility. It quantizes one component at a time (others stay FP16), runs the calibration set, and computes the Kullback–Leibler (KL) divergence between the full-precision and quantized output distributions. Higher KL divergence means the component is more fragile. Bit allocation then becomes a Multiple-Choice Knapsack Problem (MCKP): choose a bit-width per component from a discrete set (e.g., {2, 3, 4, 8}) to maximize total fidelity under a global bit budget [S2].

### Dynamic, runtime quantization

PagedWeight goes further: it quantizes MoE expert weights *dynamically* during serving. Experts not currently needed for the batch are kept at lower precision (or even offloaded); active experts are kept at higher precision. The system continuously rebalances precision against KV-cache size, latency, and throughput targets [S11].

## Key techniques and variants

| Approach | When it’s used | Trade-off |
|---|---|---|
| **PTQ (post-training quantization)** | Default for most deployments; no training pipeline access needed. | Simplicity vs. accuracy at very low bits (<4-bit). |
| **QAT (quantization-aware training)** | When PTQ accuracy loss is unacceptable; requires full training setup. | Higher accuracy at low bits vs. training cost and complexity. |
| **Weight-only quantization** | Memory-bound inference (e.g., LLM decoding); activations stay FP16. | Simpler kernels; less speedup than full quantization. |
| **Weight + activation quantization** | Compute-bound or throughput-critical paths; needs hardware INT8/INT4 support. | Maximum speedup; more calibration complexity. |
| **Uniform bit-width** | Baseline; easy to implement and debug. | Wastes bits on robust layers, starves sensitive ones. |
| **Mixed-precision (layer-wise)** | When calibration reveals heterogeneous sensitivity (most real models). | Better accuracy per bit; requires per-layer quantization config. |
| **Dynamic / runtime quantization** | MoE serving, variable batch sizes, strict latency SLOs. | Best memory–quality–throughput balance; most complex runtime. |

## Applications

- **LLM inference on GPUs/TPUs**: 4-bit and 8-bit quantization are standard for models from 7B to 400B+ parameters. Engines like vLLM, TensorRT-LLM, and llama.cpp rely on PTQ.
- **Vision Transformers**: Mixed-precision PTQ (e.g., MixFrag) achieves state-of-the-art results on ImageNet-1K and COCO detection/segmentation under practical bit budgets, improving prior best by up to 9.6 AP in challenging MP3/MP3 settings [S2].
- **MoE model serving**: Dynamic weight quantization (PagedWeight) enables FP16-equivalent quality with 72% memory savings and near-2× throughput on memory-sensitive workloads [S11].
- **Edge and mobile deployment**: INT8 quantization lets models run on NPUs and DSPs without floating-point units.
- **Training quantization** (less common): Quantizing gradients, optimizer states, or activations during training to reduce memory and communication — distinct from inference quantization [S8].

## Trade-offs and limitations

### The illusion of equivalence

Benchmark accuracy (perplexity, top-1) can stay flat while the model’s *behavior* changes. Across multiple models and quantization schemes from 8-bit to 2-bit, correctness agreement — the overlap in correct predictions between base and quantized models — drops significantly even when aggregate metrics look preserved. Behavioral divergence emerges under moderate quantization [S1].

### Non-linear breakpoints

Quality does not degrade smoothly with bit-width. There are sharp breakpoints at low bit-widths (especially below 4-bit) where error compounds non-linearly [S1]. Mixed-precision methods exist partly to avoid pushing any single component past its breakpoint.

### Sensitivity asymmetry

Query and key projections are consistently more sensitive than value and output projections [S1]. In Vision Transformers, component-level fragility varies enough that uniform quantization is provably suboptimal [S2]. Any practical system must account for this heterogeneity.

### Calibration dependence

PTQ quality depends on the calibration set’s representativeness. Out-of-distribution inputs can exhibit larger quantization error. There is no free lunch: if you cannot access a representative calibration set, QAT or dynamic methods may be necessary.

### Hardware support

INT4 and INT8 matrix multiply throughput varies by GPU generation (Hopper, Ampere, Blackwell). Sub-byte formats (e.g., 3-bit, 2-bit) often require custom kernels or emulation, reducing the theoretical speedup. Dynamic quantization adds runtime overhead that must be amortized.

### When not to use quantization

- **High-precision scientific computing** where numerical error accumulates unpredictably.
- **Models already at the accuracy cliff** (e.g., 2-bit PTQ on a barely-converged model).
- **Latency-critical paths where quantization kernel overhead exceeds memory savings** (rare, but possible for tiny models).
- **When you lack a calibration set** and cannot retrain.

## Further reading

- **The Illusion of Equivalency** (arXiv:2607.08734) — behavioral divergence metrics and layer-wise sensitivity analysis for LLM quantization [S1]
- **MixFrag: Fragility-Guided Mixed-Precision PTQ for Vision Transformers** (arXiv:2607.28589) — KL-divergence fragility metric and MCKP-based bit allocation [S2]
- **PagedWeight: Efficient MoE LLM Serving with Dynamic Quality-Aware Weight Quantization** (arXiv:2607.16184) — runtime quantization balancing weight precision vs. KV cache [S11]
- **AI Engineering** (Chip Huyen) — practical coverage of inference quantization, memory math, and deployment trade-offs [S8]

## References

- S1: arXiv — The Illusion of Equivalency: Statistical Characterization of Quantization Effects in LLMs — https://arxiv.org/abs/2607.08734v1
- S2: arXiv — MixFrag: Fragility-Guided Mixed-Precision Post-Training Quantization for Vision Transformers — https://arxiv.org/abs/2607.28589v1
- S8: AI Engineering (Chip Huyen) — AI Engineering by Chip Huyen — pack://ai-engineering-by-chip-huyen
- S11: arXiv — PagedWeight: Efficient MoE LLM Serving with Dynamic Quality-Aware Weight Quantization — https://arxiv.org/abs/2607.16184v1
