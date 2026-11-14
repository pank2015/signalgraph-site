---
title: "Quantization: Compressing Neural Networks for Efficient Inference and Training"
description: "A technical deep dive into quantization \u2014 reducing numerical precision of model parameters, activations, and optimizer states to shrink memory, accelerate compute, and enable deployment on constrained hardware."
date: "2026-11-14"
format: "explainer"
concept: "quantization"
tldr: ["Quantization maps high-precision values (FP32/FP16) to lower-precision formats (INT8, INT4, NF4), reducing memory and compute costs.", "Post-training quantization (PTQ) compresses models without retraining; quantization-aware training (QAT) recovers accuracy by simulating quantization during training.", "Mixed-precision methods allocate bits per-layer based on sensitivity, outperforming uniform quantization at the same average bit-width.", "Quantizing optimizer states (e.g., AdamW moments) cuts training memory; quantizing recurrent states in linear attention models slashes serving memory for long contexts.", "Aggressive quantization changes model behavior beyond what perplexity or accuracy metrics reveal \u2014 query/key projections are especially sensitive."]
references: ["S1: STEPQuant: When and Where Errors Matter in Delta-Rule Recurrent State Quantization \u2014 https://arxiv.org/abs/2609.38169v1", "S2: Rounding in Preconditioner Space: Redesigning 4-bit AdamW Optimizer-State Quantization \u2014 https://arxiv.org/abs/2610.12444v1", "S3: The Illusion of Equivalency: Statistical Characterization of Quantization Effects in LLMs \u2014 https://arxiv.org/abs/2607.08734v1", "S4: LeapQuant: Efficient Linear Attention with Accurate Recurrent State Quantization \u2014 https://arxiv.org/abs/2609.38166v1", "S5: MixFrag: Fragility-Guided Mixed-Precision Post-Training Quantization for Vision Transformers \u2014 https://arxiv.org/abs/2607.28589v1", "S10: SSTQ: Privacy-Preserving Vector Quantization via Subsampled Stochastic TurboQuant \u2014 https://arxiv.org/abs/2608.05127v1"]
writer: "openrouter/nvidia/nemotron-3-ultra-550b-a55b:free"
fact_check: "passed"
diagram: "2026-11-14-quantization-compressing-neural-networks-for-efficient-infer.json"
---

## What Quantization Is

Quantization is the process of representing numerical values with fewer bits than their original precision. In deep learning, this typically means converting 32-bit floating-point numbers (FP32) or 16-bit floats (FP16/BF16) into 8-bit integers (INT8), 4-bit integers (INT4), or specialized 4-bit formats like NormalFloat (NF4). The core idea is simple: neural networks are often over-parameterized, and their weights, activations, and optimizer states tolerate substantial precision reduction with minimal quality loss.

Think of it like image compression. A RAW photo stores every pixel at full precision; a JPEG discards information the human eye barely notices. Quantization discards numerical precision the model barely uses. The mapping is usually affine: a floating-point value <span class="math">x</span> becomes an integer <span class="math">q = round(x / s) + z</span>, where <span class="math">s</span> is a scale factor and <span class="math">z</span> is a zero-point. Dequantization reverses it: <span class="math">x≈ s(q - z)</span>. The scale and zero-point are calibrated per-tensor, per-channel, or per-group to minimize distortion.

## Why It Matters

Three resources drive the need for quantization: memory capacity, memory bandwidth, and compute throughput.

**Model size and memory.** A 7B-parameter model in FP16 occupies ~14 GB; in INT4 it fits in ~4 GB. This difference determines whether a model runs on a single GPU, a consumer GPU, or a phone. For serving, the KV cache (or recurrent states in linear attention) often dominates memory. Quantizing those states yields outsized savings: STEPQuant achieves over 5× recurrent-state compression and reduces total serving memory by up to 68.7% on 27B- and 48B-parameter models at a nominal 6-bit budget [S1]. LeapQuant similarly targets recurrent states in linear attention (Gated DeltaNet, Kimi Delta Attention), achieving near-lossless 8-bit quantization [S4].

**Memory bandwidth.** Arithmetic intensity (FLOPs/byte) of matrix multiplication is low; the bottleneck is moving weights from DRAM to compute units. Halving precision doubles effective bandwidth. Integer tensor cores on modern GPUs (Hopper, Blackwell) and NPUs execute INT8/INT4 GEMM at 2–4× the throughput of FP16.

**Training memory.** Optimizer states (momentum, variance) in AdamW consume 2× the model size in FP32. Quantizing them to 4-bit NF4 cuts this overhead dramatically. The ZIP-SR and ZE-EDEN methods redesign 4-bit optimizer-state quantization by rounding in *preconditioner space* rather than state space, preserving the adaptive learning-rate dynamics [S2].

**Energy and latency.** Lower precision reduces data movement energy (dominant in inference) and enables smaller, cheaper deployments.

## How It Works: A Concrete Walkthrough

Consider quantizing a weight matrix <span class="math">W ∈ ℝ^{d×d}</span> from FP16 to INT8 per output channel (per-column).

1.  **Calibration.** Pass a small representative dataset through the model. Record the min/max (or percentile range) of each column of <span class="math">W</span>.
2.  **Scale computation.** For column <span class="math">j</span>, set scale <span class="math">s_j = (max_j - min_j) / 255</span> (for unsigned INT8) or <span class="math">s_j = max(|min_j|, |max_j|) / 127</span> (for symmetric INT8). Zero-point <span class="math">z_j</span> aligns zero exactly.
3.  **Quantize.** <span class="math">Q_{ij} = clip(round(W_{ij} / s_j) + z_j, 0, 255)</span>.
4.  **Deploy.** Store <span class="math">Q</span> (INT8), <span class="math">s</span> (FP16), <span class="math">z</span> (INT8). At inference, the GEMM kernel loads <span class="math">Q</span>, dequantizes on the fly (or uses native INT8 tensor cores with scaled accumulation), and writes FP16/FP32 outputs.

Activation quantization follows the same pattern but requires dynamic ranges per token or static ranges from calibration. Recurrent-state quantization (S1, S4) adds a temporal dimension: errors accumulate across decoding steps, so methods like STEPQuant allocate precision spatially (per key row, per value column) and temporally (based on memory lifetime) [S1]. LeapQuant uses per-window quantization — quantizing only once per window of tokens and keeping high-precision buffered updates within the window — plus "Compensator Tokens" that preserve outlier rows/columns in high precision [S4].

## Key Techniques and Variants

### Post-Training Quantization (PTQ) vs. Quantization-Aware Training (QAT)

PTQ quantizes a pre-trained model without weight updates. It is fast (minutes) but struggles below 8-bit. QAT inserts fake-quantization nodes during training, letting the model adapt. QAT recovers more accuracy at 4-bit and below but costs full training compute.

### Uniform vs. Mixed Precision

Uniform quantization uses the same bit-width everywhere. Mixed precision allocates bits where they matter most. MixFrag estimates each ViT component’s *fragility* via KL divergence between full-precision and quantized output distributions on a calibration set, then solves a Multiple-Choice Knapsack Problem to assign bit-widths under a total budget [S5]. This yields up to 9.6 AP improvement on COCO detection over prior mixed-precision PTQ methods [S5].

### Optimizer-State Quantization

Quantizing AdamW’s first and second moments (momentum, variance) to 4-bit NF4 reduces training memory. The key insight from [S2] is that rounding error in the *state* (variance) does not linearly map to error in the *preconditioner* (1/sqrt(variance + ε)) used for adaptive steps. ZIP-SR retains zero in the second-moment codebook and computes stochastic-rounding probabilities in preconditioner space. ZE-EDEN excludes zero from the codebook and rescales the quantized block to correct the positive quantization floor. Both use targeted stochastic rounding on the LM-head first moment in the final 10% of training [S2].

### Recurrent-State Quantization for Linear Attention

Linear attention models (DeltaNet, Kimi Delta Attention) replace the growing KV cache with a fixed-size recurrent state <span class="math">S_t</span> updated each step. Quantizing <span class="math">S_t</span> is tricky: errors persist across all future steps. STEPQuant allocates precision by error magnitude and memory lifetime, jointly fitting key-row and value-column scales [S1]. LeapQuant quantizes per window and preserves outliers as high-precision Compensator Tokens [S4].

### Vector Quantization for Privacy and Communication

In federated learning, clients send quantized model updates. SSTQ combines overcomplete equal-norm tight frames, coordinate subsampling, and 1D quantization (Randomized Response or Laplace) to achieve local differential privacy with ⌈log₂ N⌉ + b bits per client, reducing codebook-dependent MSE from O(4<sup>b</sup>) to O(2<sup>b</sup>) [S10].

## Applications

- **LLM serving at scale.** Quantized weights (INT4/INT8) + quantized KV/recurrent states enable larger batch sizes, longer contexts, and smaller GPU fleets. STEPQuant integrated into SGLang demonstrates 68.7% serving memory reduction [S1].
- **Edge and mobile deployment.** INT8 PTQ is standard for on-device inference (TensorFlow Lite, Core ML, ONNX Runtime). Mixed-precision PTQ (MixFrag) pushes ViT classification/detection quality higher under tight bit budgets [S5].
- **Training large models.** 4-bit optimizer states (NF4 + ZIP-SR/ZE-EDEN) cut memory for AdamW, enabling larger models or batch sizes on the same hardware [S2].
- **Federated learning with privacy.** SSTQ’s communication-efficient, differentially private quantization makes cross-silo FL practical [S10].

## Trade-offs and Limitations

**Accuracy vs. bit-width.** Below 8-bit, uniform PTQ degrades perplexity and downstream task accuracy. Mixed precision and QAT recover much of it, but not all. The "illusion of equivalency" paper shows that even when perplexity matches, quantized models diverge behaviorally: *correctness agreement* (overlap in correct predictions) drops at moderate quantization, and query/key projections are consistently more sensitive than value/output projections [S3]. This means a quantized model may pass benchmark evals but fail on specific reasoning or safety tasks.

**Calibration data dependence.** PTQ needs a representative calibration set. Distribution shift between calibration and deployment data causes accuracy cliffs.

**Hardware support.** INT8 is universal. INT4 and NF4 require recent tensor cores (Ampere+) or custom kernels. Sub-byte formats (3-bit, 2-bit) need software emulation or specialized ASICs.

**Operator coverage.** Not all ops quantize cleanly. LayerNorm, Softmax, GeLU, and attention scores often stay in FP16/FP32, limiting end-to-end speedup.

**Temporal error accumulation.** In recurrent-state quantization, a small per-step error compounds over thousands of steps. STEPQuant and LeapQuant mitigate this but add algorithmic complexity [S1, S4].

**Preconditioner distortion.** Quantizing AdamW variance naively distorts the adaptive learning rate. ZIP-SR/ZE-EDEN fix this but require per-block rescaling and stochastic rounding logic [S2].

**When NOT to use quantization.**
- Safety-critical systems where behavioral divergence is unacceptable without exhaustive validation.
- Models already at the edge of numerical stability (e.g., very deep Transformers without residual scaling).
- Workloads where the quantization/dequantization overhead exceeds the compute savings (tiny matrices, memory-bound kernels with low arithmetic intensity).
- When calibration data is unavailable or cannot represent the deployment distribution.

## Further Reading

- STEPQuant: When and Where Errors Matter in Delta-Rule Recurrent State Quantization — https://arxiv.org/abs/2609.38169v1
- Rounding in Preconditioner Space: Redesigning 4-bit AdamW Optimizer-State Quantization — https://arxiv.org/abs/2610.12444v1
- The Illusion of Equivalency: Statistical Characterization of Quantization Effects in LLMs — https://arxiv.org/abs/2607.08734v1
- LeapQuant: Efficient Linear Attention with Accurate Recurrent State Quantization — https://arxiv.org/abs/2609.38166v1
- MixFrag: Fragility-Guided Mixed-Precision Post-Training Quantization for Vision Transformers — https://arxiv.org/abs/2607.28589v1
- SSTQ: Privacy-Preserving Vector Quantization via Subsampled Stochastic TurboQuant — https://arxiv.org/abs/2608.05127v1

## References

- S1: STEPQuant: When and Where Errors Matter in Delta-Rule Recurrent State Quantization — https://arxiv.org/abs/2609.38169v1
- S2: Rounding in Preconditioner Space: Redesigning 4-bit AdamW Optimizer-State Quantization — https://arxiv.org/abs/2610.12444v1
- S3: The Illusion of Equivalency: Statistical Characterization of Quantization Effects in LLMs — https://arxiv.org/abs/2607.08734v1
- S4: LeapQuant: Efficient Linear Attention with Accurate Recurrent State Quantization — https://arxiv.org/abs/2609.38166v1
- S5: MixFrag: Fragility-Guided Mixed-Precision Post-Training Quantization for Vision Transformers — https://arxiv.org/abs/2607.28589v1
- S10: SSTQ: Privacy-Preserving Vector Quantization via Subsampled Stochastic TurboQuant — https://arxiv.org/abs/2608.05127v1
