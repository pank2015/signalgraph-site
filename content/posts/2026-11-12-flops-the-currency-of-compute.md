---
title: "FLOPs: The Currency of Compute"
description: "What floating-point operations measure, why they dominate ML and HPC cost models, and where the metric breaks down."
date: "2026-11-12"
format: "explainer"
concept: "FLOPs"
tldr: ["FLOPs count floating-point arithmetic operations \u2014 adds, multiplies, fused multiply-adds \u2014 and serve as the standard proxy for compute work.", "Peak FLOPs is a hardware ceiling; achieved FLOPs is what your kernel actually delivers, and the gap is where engineering lives.", "In ML, training FLOPs scale predictably with model size and data; inference FLOPs determine latency and cost per token.", "FLOPs ignore memory bandwidth, latency, and data movement \u2014 often the real bottlenecks, especially at low arithmetic intensity.", "Sources show concrete trade-offs: distillation can cut training FLOPs 50\u00d7 (S4), while smaller models reduce compute savings from 4.39\u00d7 to 1.38\u00d7 (S9)."]
references: ["S1: Certified Parallel-in-Time Sinkhorn for Dynamic Entropic Optimal Transport \u2014 https://arxiv.org/abs/2607.24741v1", "S4: Unpacking the Compute Efficiency of Strong-to-Weak OPD against GRPO \u2014 https://arxiv.org/abs/2611.08453v1", "S9: When to Assist and What to Suggest: Joint Gating and Memory-Grounded Hint Generation \u2014 https://arxiv.org/abs/2610.40611v1", "S14: Test-Time Scaling in Reasoning LLMs: Inference Regimes, Evaluation, and Reproducibility \u2014 https://arxiv.org/abs/2608.04001v1"]
writer: "openrouter/nvidia/nemotron-3-ultra-550b-a55b:free"
fact_check: "passed"
diagram: "2026-11-12-flops-the-currency-of-compute.json"
---

## What FLOPs Is

**FLOPs** (floating-point operations) counts the elementary arithmetic operations — addition, multiplication, fused multiply-add (FMA), division, square root — performed on floating-point numbers. A **FMA** (a × b + c) counts as two FLOPs (one multiply, one add) on most architectures, though some vendors count it as one. The rate **FLOPS** (floating-point operations per second) measures throughput; **FLOPs** (plural) measures total work done.

Think of FLOPs as the "currency" of numerical compute. If a matrix multiply of two *n × n* matrices takes 2*n*³ FLOPs (n³ multiplies + n³ adds), that number stays the same whether you run it on a laptop CPU, an H100 GPU, or a TPU pod. What changes is *how fast* the hardware spends that currency.

**Precision matters**. FP64 (double), FP32 (single), FP16/BF16 (half), and INT8/INT4 (integer) each have different FLOP rates on the same chip. An NVIDIA H100 delivers ~67 TFLOPS FP64, ~990 TFLOPS FP16/BF16 tensor-core, and ~1979 TOPS INT8. The same algorithm "costs" the same FLOPs mathematically, but the *wall-time cost* depends entirely on which precision the hardware executes efficiently.

## Why It Matters

FLOPs became the lingua franca of high-performance computing (HPC) because it abstracts away ISA details and lets you compare algorithms, hardware, and implementations on equal footing. In machine learning, it plays three roles:

1. **Scaling laws**: Training FLOPs ≈ 6 × parameters × tokens (for dense transformers). This linear rule lets researchers predict loss curves and budget clusters. The Chinchilla paper and its successors showed that optimal compute allocation follows FLOP-countable ratios.
2. **Hardware procurement**: Cloud instances and on-prem clusters are priced and provisioned by peak FLOPS. A 100 TFLOP/s GPU at $2/hr implies a floor cost per training run.
3. **Optimization target**: Kernel writers chase *achieved FLOPS / peak FLOPS* (utilization). Moving from 30% to 60% utilization halves time-to-train without buying new iron.

But FLOPs is a *proxy*, not the thing itself. The real constraints are often **memory bandwidth** (bytes/s), **latency** (cycles per dependency chain), and **data movement energy** (pJ/byte). A kernel can be FLOP-bound (compute-limited) or memory-bound (bandwidth-limited); the roofline model makes this explicit.

## How It Works: Counting and Measuring

### Theoretical Count
For a given algorithm, you derive FLOPs analytically:
- Dense matmul *C = A × B* (M×K × K×N): 2·M·N·K FLOPs
- Convolution: 2 × output_elements × kernel_elements × input_channels
- Transformer self-attention: ~4 × batch × seq_len² × d_model (QKᵀ + AV) + 2 × batch × seq_len × d_model × d_ffn (FFN)
- Elementwise ops: 1 FLOP per element per operation

These counts assume exact arithmetic; fused ops, kernel fusion, and compiler rewrites can change the *executed* count.

### Hardware Counters
Modern CPUs and GPUs expose performance monitoring units (PMUs) that tally retired floating-point instructions. On NVIDIA GPUs, `nvprof`/`nsys` report `flop_count_sp`, `flop_count_hp`, `flop_count_dp` for single, half, double precision. On Intel CPUs, `perf` reads `FP_ARITH_INST_RETIRED` events. These *measured* FLOPs include overhead: loop control, address calculation, predication — so they exceed the theoretical minimum.

### Achieved vs. Peak
**Peak FLOPS** = cores × clock × SIMD width × FMAs per cycle. An H100 SM has 128 FP16 tensor cores × 4 FMAs/cycle × 1830 MHz ≈ 940 TFLOPS per SM; 132 SMs → ~124 PFLOPS theoretical (marketing rounds to 990 TFLOPS for the full GPU with sparsity).

**Achieved FLOPS** = (theoretical FLOPs of your problem) / (elapsed seconds). If your matmul takes 2 ms on an H100 and does 2 TFLOPs, you hit 1 TFLOPS — ~0.1% of peak. The gap is *not* waste; it's memory stalls, occupancy limits, tail effects, and instruction mix.

## Key Variants and Related Metrics

| Metric | Meaning | When Used |
|---|---|---|
| **Peak FLOPS** | Hardware theoretical max | Marketing, roof lines |
| **Achieved FLOPS** | Measured on a workload | Kernel tuning, procurement |
| **MFU** (Model FLOPs Utilization) | Achieved / Peak for a model | LLM training dashboards |
| **FLOPs/byte** (Arithmetic Intensity) | Compute per data moved | Roofline analysis |
| **TOPS** | Integer ops/sec (often INT8/INT4) | Inference accelerators |
| **PetaFLOP-days** | Total FLOPs × days | Training run accounting |

**Precision tiers** are not interchangeable. FP32 is the reference for "FLOPs" in most literature; FP16/BF16 tensor cores deliver 8–16× throughput but require loss-scaling or mixed-precision recipes. INT8/INT4 quantization (as Pinterest deployed for search [S3]) cuts FLOPs *and* memory traffic, but the FLOP count alone doesn't capture the bandwidth win.

## Applications

### Training Run Accounting
A 7B-parameter model trained on 1T tokens: ~6 × 7e9 × 1e12 = 4.2e22 FLOPs ≈ 42 ZettaFLOPs. At 150 TFLOPS/GPU sustained (MFU ~35% on A100), that's ~3,200 GPU-days. This arithmetic drives cluster sizing and carbon estimates.

### Inference Cost per Token
For the same 7B model, one forward pass ≈ 2 × 7e9 = 14 GFLOPs/token (ignoring KV cache). At 500 TFLOPS sustained on an H100, that's 28 μs/token compute *lower bound* — real latency is higher due to memory-bound decode steps.

### Distillation and Compute Reduction
Research shows that **on-policy distillation (OPD)** from a GRPO-trained teacher can recover the teacher's accuracy on math with **50× fewer distillation FLOPs** than GRPO needed to reach that accuracy from scratch [S4]. However, OPD *loses* to GRPO in accuracy per training FLOP when the teacher is externally post-trained. The compute economics flip depending on *which* teacher you distill.

### Gating and Conditional Compute
A proactive assistant that gates when to generate hints saves compute: **4.39× savings with an 8B generator**, falling to **1.38× with a 1B generator** [S9]. The smaller model's lower per-token FLOPs reduces the *absolute* savings even if the gating logic is identical.

### Test-Time Scaling
"Test-time scaling" covers diverse inference algorithms (sequential reasoning, majority voting, tree search) with different **compute accounting** structures [S14]. Reporting accuracy without the inference protocol (and its FLOP cost) makes comparisons meaningless. The paper formalizes three regimes — single-trajectory, leaf-level, prefix-level — each with distinct FLOP scaling curves.

## Trade-offs and Limitations

### FLOPs ≠ Time
A memory-bound kernel (low arithmetic intensity) spends cycles waiting for DRAM. Doubling peak FLOPS changes nothing. The **roofline model**: performance = min(peak FLOPS, bandwidth × arithmetic_intensity). Optimizing FLOPs utilization only helps *above* the ridge point.

### FLOPs ≠ Energy
Data movement dominates energy: ~1 pJ/FLOP for FP16 tensor core vs. ~100 pJ/byte for HBM access. A kernel that does 2× more FLOPs but reads 10× less data can be *more* energy-efficient. Quantization (INT4) and sparsity exploit this.

### FLOPs Ignores Control Flow
Branch divergence, predicate masks, and loop overhead consume cycles but not FLOP counters. A warp with 50% divergence executes both paths — FLOPs count the *useful* ops, but the hardware paid for both.

### FLOPs Can Be Gamed
Kernel fusion reduces *measured* FLOPs (fewer round-trips to memory) but may increase *theoretical* FLOPs (recomputing intermediates). Sparse matrices skip zero multiplies — theoretical FLOPs drops, but irregular access may lower achieved FLOPS.

### When Not to Use FLOPs
- **Latency-critical paths**: Tail latency depends on queueing, not throughput.
- **Bandwidth-bound workloads**: STREAM triad, graph analytics, embedding lookups.
- **Integer-only pipelines**: Classical databases, bit-packed search (use TOPS or ops/s).
- **Energy-constrained edge**: Joules/inference matters more than FLOPs.

## Further Reading

- Certified Parallel-in-Time Sinkhorn for Dynamic Entropic Optimal Transport — arXiv:2607.24741 [S1]
- Unpacking the Compute Efficiency of Strong-to-Weak OPD against GRPO — arXiv:2611.08453 [S4]
- When to Assist and What to Suggest: Joint Gating and Memory-Grounded Hint Generation — arXiv:2610.40611 [S9]
- Test-Time Scaling in Reasoning LLMs: Inference Regimes, Evaluation, and Reproducibility — arXiv:2608.04001 [S14]

## References

- S1: Certified Parallel-in-Time Sinkhorn for Dynamic Entropic Optimal Transport — https://arxiv.org/abs/2607.24741v1
- S4: Unpacking the Compute Efficiency of Strong-to-Weak OPD against GRPO — https://arxiv.org/abs/2611.08453v1
- S9: When to Assist and What to Suggest: Joint Gating and Memory-Grounded Hint Generation — https://arxiv.org/abs/2610.40611v1
- S14: Test-Time Scaling in Reasoning LLMs: Inference Regimes, Evaluation, and Reproducibility — https://arxiv.org/abs/2608.04001v1
