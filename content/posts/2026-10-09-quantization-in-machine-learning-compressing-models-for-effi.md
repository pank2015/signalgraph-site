---
title: "Quantization in Machine Learning: Compressing Models for Efficient Inference"
description: "A technical explainer on neural network quantization \u2014 what it is, why it matters, how it works, and the trade-offs engineers face when deploying compressed models."
date: "2026-10-09"
format: "explainer"
concept: "quantization"
tldr: ["Quantization reduces the numerical precision of model weights and activations (e.g., from 32-bit floats to 8-bit integers) to shrink memory footprint and accelerate inference.", "Post-training quantization (PTQ) applies compression after training without retraining; quantization-aware training (QAT) simulates low-precision effects during training for better accuracy.", "Mixed-precision methods allocate bits non-uniformly across layers based on sensitivity, improving the accuracy-compression Pareto frontier.", "Quantization can change model behavior even when aggregate metrics like perplexity appear preserved \u2014 decision-level divergence emerges at low bit-widths.", "Recurrent-state quantization in linear-attention models requires special handling because rounding errors accumulate across time steps."]
references: ["S1: STEPQuant: When and Where Errors Matter in Delta-Rule Recurrent State Quantization \u2014 https://arxiv.org/abs/2609.38169v1", "S2: The Illusion of Equivalency: Statistical Characterization of Quantization Effects in LLMs \u2014 https://arxiv.org/abs/2607.08734v1", "S3: LeapQuant: Efficient Linear Attention with Accurate Recurrent State Quantization \u2014 https://arxiv.org/abs/2609.38166v1", "S4: MixFrag: Fragility-Guided Mixed-Precision Post-Training Quantization for Vision Transformers \u2014 https://arxiv.org/abs/2607.28589v1", "S8: SSTQ: Privacy-Preserving Vector Quantization via Subsampled Stochastic TurboQuant \u2014 https://arxiv.org/abs/2608.05127v1"]
writer: "openrouter/nvidia/nemotron-3-ultra-550b-a55b:free"
fact_check: "passed"
diagram: "2026-10-09-quantization-in-machine-learning-compressing-models-for-effi.json"
---

## What Quantization Is

Quantization, in the context of neural networks, is the process of mapping high-precision numerical values — typically 32-bit floating-point numbers (FP32) — to a lower-precision representation such as 8-bit integers (INT8), 4-bit integers (INT4), or even lower. The core idea is simple: neural network weights and activations are stored and computed in reduced precision, which decreases memory bandwidth requirements, reduces model size on disk and in RAM, and enables faster arithmetic on hardware that supports integer tensor operations.

An intuitive analogy: imagine a high-resolution photograph stored as a 16-bit RAW file. Converting it to an 8-bit JPEG discards some color information, but the image remains recognizable while becoming dramatically smaller. In neural networks, the "image" is the model's learned parameters and intermediate activations, and the "recognizability" is task performance.

Two main paradigms exist. **Post-training quantization (PTQ)** takes a pre-trained FP32 model and converts it to low precision using a small calibration dataset to determine quantization parameters (scale and zero-point). No gradient updates occur. **Quantization-aware training (QAT)** inserts fake-quantization operators during training so the model learns to be robust to precision loss; this typically yields higher accuracy at the same bit-width but requires full training compute.

## Why It Matters

Large language models (LLMs) and vision transformers (ViTs) have parameter counts in the billions. An FP32 model with 7 billion parameters occupies ~28 GB of memory just for weights — exceeding the VRAM of many GPUs. Quantization to INT4 brings this to ~3.5 GB, enabling deployment on consumer hardware. Beyond static model size, quantization reduces the memory bandwidth pressure during inference: moving fewer bytes from memory to compute units is often the dominant latency factor on modern accelerators.

Quantization also enables new model architectures. Linear-attention models (e.g., Gated DeltaNet, Kimi Delta Attention) replace the growing key-value cache of standard Transformers with a fixed-size recurrent state. However, this recurrent state becomes a memory bottleneck under concurrent serving. Quantizing these persistent states can yield over 5× compression and reduce total serving memory by up to 68.7% [S1].

## How It Works: A Concrete Walkthrough

Consider a single weight matrix **W** ∈ ℝ<sup>d×d</sup> in FP32. To quantize it to INT8 symmetrically (zero-point = 0):

1. **Calibration**: Pass a representative dataset through the model and record the maximum absolute value *α* = max(|**W**|) per channel (output dimension) or per tensor.
2. **Scale computation**: The scale factor *s* = *α* / 127 maps the FP32 range [-α, α] to INT8 range [-127, 127].
3. **Quantization**: **W**<sub>q</sub> = round(**W** / *s*) → INT8.
4. **Dequantization (during inference)**: **W** ≈ **W**<sub>q</sub> × *s* (often fused into the GEMM kernel).

For activations, the scale is typically computed per-token or per-tensor from calibration data. Asymmetric quantization adds a zero-point *z* to handle non-zero-centered distributions: **x**<sub>q</sub> = round(**x** / *s* + *z*).

In linear-attention recurrent states, the mechanism is more delicate. The recurrent state **S**<sub>t</sub> = **S**<sub>t-1</sub> + Δ**S**<sub>t</sub> accumulates updates across time steps. Directly quantizing **S**<sub>t</sub> at every step causes rounding errors to propagate and amplify. Two recent methods address this:

- **STEPQuant** allocates precision spatially (per key-row and value-column) and temporally (based on memory lifetime), jointly fitting scales using state distributions and key-row impact on output error [S1].
- **LeapQuant** uses per-window quantization: the state is quantized only once per window of tokens. Within a window, outputs are computed from the fixed low-bit state plus high-precision buffered updates. It also retains the largest outlier rows/columns as high-precision "Compensator Tokens" and smooths the residual before quantization [S3].

## Key Techniques and Variants

**Uniform vs. Mixed Precision**
Uniform quantization applies the same bit-width everywhere. Mixed-precision quantization assigns different bit-widths to different layers or components based on their sensitivity. MixFrag estimates per-component fragility by measuring KL divergence between full-precision and isolated quantized output distributions on a calibration set, then formulates bit allocation as a Multiple-Choice Knapsack Problem under a target bit budget [S4]. This yields state-of-the-art results on ViTs, improving AP by up to 9.6 on COCO detection under challenging mixed-precision settings [S4].

**Outlier Handling**
Transformer weights and activations often contain outlier channels with unusually large magnitudes. These outliers force a large quantization scale, wasting precision on the bulk of values. Techniques include: outlier-aware quantization (separate high-precision handling for outliers), smoothing (shifting magnitude between weights and activations via mathematically equivalent transformations), and Compensator Tokens (LeapQuant's approach of preserving outlier rows in high precision) [S3].

**Vector Quantization for Communication**
In federated learning, quantization reduces client-to-server communication. SSTQ combines overcomplete equal-norm tight frames, coordinate subsampling, and privacy-aware 1D quantization to achieve optimal mean-squared-error scaling with only ⌈log₂ N⌉ + *b* bits per client, where *N* = Θ(*d*) is the frame size [S8]. It reduces codebook-dependent MSE scaling from O(4<sup>b</sup>) to O(2<sup>b</sup>) via a surrogate privacy-aware codebook objective [S8].

**Behavioral Evaluation Beyond Accuracy**
Conventional metrics (perplexity, task accuracy) can mask behavioral changes. The "correctness agreement" metric measures overlap in correct predictions between base and quantized models, independent of absolute accuracy. Across models and quantization schemes from 8-bit to 2-bit, behavioral divergence emerges under moderate quantization even when task performance appears preserved. Query and key projections are consistently more sensitive than value and output projections, with non-linear breakpoints at low bit-widths [S2].

## Applications

- **LLM serving**: INT4/INT8 weight quantization is standard for deploying Llama, Qwen, and similar models on consumer GPUs and CPUs. SGLang integrates 6-bit STEPQuant kernels for recurrent-state compression in linear-attention models [S1].
- **Vision Transformers on edge devices**: MixFrag's mixed-precision PTQ enables ViT deployment on mobile/embedded hardware with competitive ImageNet-1K and COCO performance [S4].
- **Federated learning**: SSTQ reduces uplink communication while providing local differential privacy, evaluated on CIFAR-10 and Fashion-MNIST [S8].
- **Long-context linear attention**: LeapQuant enables near-lossless 8-bit recurrent-state quantization for Qwen, Kimi, and GLM model families, reducing the inference bottleneck of repeated state reads/writes [S3].

## Trade-offs and Limitations

**Accuracy degradation** is the primary cost. At 8-bit, degradation is often negligible for many tasks. At 4-bit and below, perplexity increases and task performance drops, especially for reasoning-heavy benchmarks. Mixed-precision and QAT mitigate but do not eliminate this.

**Behavioral divergence** occurs even when aggregate metrics look fine. A quantized model may give different answers on the same prompts, fail on different subsets of data, or exhibit shifted calibration. Correctness agreement reveals this divergence [S2]. For safety-critical or consistency-sensitive applications, this matters.

**Error accumulation in recurrent states** makes linear-attention models uniquely vulnerable. Standard PTQ fails because quantization noise compounds over thousands of time steps. Specialized methods (STEPQuant, LeapQuant) are required [S1, S3].

**Hardware support** varies. INT8 is widely accelerated (TensorRT, ONNX Runtime, PyTorch native). INT4 and lower often require custom kernels or specific hardware (e.g., Hopper's FP8, Blackwell's INT4 tensor cores). Sub-byte formats (3-bit, 2-bit) typically need lookup-table-based decompression, adding compute overhead.

**Calibration data sensitivity**: PTQ quality depends on the calibration set's representativeness. Domain shift between calibration and deployment data can cause accuracy cliffs.

**When NOT to use quantization**:
- When model quality is paramount and compute/memory are abundant (e.g., training, high-stakes inference).
- For models with extreme outlier sensitivity where even mixed-precision fails to recover accuracy.
- When the deployment target lacks low-precision kernel support and software emulation would negate speed gains.
- In federated settings where privacy-utility trade-offs of quantization-based compression are unacceptable.

## Further Reading

- STEPQuant: When and Where Errors Matter in Delta-Rule Recurrent State Quantization — https://arxiv.org/abs/2609.38169v1
- The Illusion of Equivalency: Statistical Characterization of Quantization Effects in LLMs — https://arxiv.org/abs/2607.08734v1
- LeapQuant: Efficient Linear Attention with Accurate Recurrent State Quantization — https://arxiv.org/abs/2609.38166v1
- MixFrag: Fragility-Guided Mixed-Precision Post-Training Quantization for Vision Transformers — https://arxiv.org/abs/2607.28589v1
- SSTQ: Privacy-Preserving Vector Quantization via Subsampled Stochastic TurboQuant — https://arxiv.org/abs/2608.05127v1

## References

- S1: STEPQuant: When and Where Errors Matter in Delta-Rule Recurrent State Quantization — https://arxiv.org/abs/2609.38169v1
- S2: The Illusion of Equivalency: Statistical Characterization of Quantization Effects in LLMs — https://arxiv.org/abs/2607.08734v1
- S3: LeapQuant: Efficient Linear Attention with Accurate Recurrent State Quantization — https://arxiv.org/abs/2609.38166v1
- S4: MixFrag: Fragility-Guided Mixed-Precision Post-Training Quantization for Vision Transformers — https://arxiv.org/abs/2607.28589v1
- S8: SSTQ: Privacy-Preserving Vector Quantization via Subsampled Stochastic TurboQuant — https://arxiv.org/abs/2608.05127v1
