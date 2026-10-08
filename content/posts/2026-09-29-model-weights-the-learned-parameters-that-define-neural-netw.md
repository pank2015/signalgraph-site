---
title: "Model Weights: The Learned Parameters That Define Neural Network Behavior"
description: "A technical explainer on what model weights are, how they work, and the techniques for managing them in modern AI systems."
date: "2026-09-29"
format: "explainer"
concept: "model weights"
tldr: ["Model weights are the learned numerical parameters that transform inputs into outputs in a neural network.", "Individual 'super weights' can be disproportionately important, but training them in isolation fails.", "Quantization and low-rank adaptation (LoRA) are the dominant techniques for reducing weight storage and compute costs.", "Open-weights models enable community research but raise safety and supply-chain considerations.", "Weight management \u2014 quantization, merging, compression \u2014 is now a core engineering discipline for deploying LLMs."]
references: ["S1: Anthropic \u2014 Our position on open-weights models \u2014 https://www.anthropic.com/news/position-open-weights-models", "S2: Interconnects \u2014 The current balance of power in open models \u2014 https://www.interconnects.ai/p/the-current-balance-of-power-in-open", "S3: arXiv \u2014 Super Weights in LLMs and the Failure of Selective Training \u2014 https://arxiv.org/abs/2607.08733v1", "S4: Chip Huyen \u2014 AI Engineering (finetuning, LoRA, PEFT, model merging chapters) \u2014 pack://ai-engineering-by-chip-huyen", "S7: arXiv \u2014 PagedWeight: Efficient MoE LLM Serving with Dynamic Quality-Aware Weight Quantization \u2014 https://arxiv.org/abs/2607.16184v1", "S9: Russell & Norvig \u2014 Artificial Intelligence: A Modern Approach (neural network weight updates) \u2014 pack://ai-russell-norvig", "S10: arXiv \u2014 Requential Coding: Pushing the Limits of Model Compression \u2014 https://arxiv.org/abs/2607.11883v1", "S14: arXiv \u2014 New LoRA Skills Should Read but Never Write (READ) \u2014 https://arxiv.org/abs/2609.31600v1"]
writer: "openrouter/nvidia/nemotron-3-ultra-550b-a55b:free"
fact_check: "passed"
diagram: "2026-09-29-model-weights-the-learned-parameters-that-define-neural-netw.json"
---

## What Model Weights Are

A **model weight** is a learned numerical parameter inside a neural network. During training, the network adjusts these numbers so that the function the network computes maps inputs to the desired outputs. In a linear layer, weights form a matrix **W** that multiplies the input vector **x**; the result **Wx** (plus a bias vector) is passed to the next layer. In a transformer — the architecture behind modern large language models (LLMs) — weights live in attention projections (query, key, value, output), feed-forward networks (two linear layers with a non-linearity between them), and layer-normalization scales and shifts.

Think of weights as the "dials" the training process turns. The architecture (number of layers, hidden size, attention heads) fixes how many dials exist and how they are wired together. Training decides where each dial sits. For a 7-billion-parameter model, there are 7 billion dials. The collective setting of all dials *is* the model.

**Glossary**: *Parameter* and *weight* are often used interchangeably. *Bias* terms are technically parameters but not weights (they add a constant rather than scaling an input). *Hyperparameters* (learning rate, batch size, number of layers) are set before training; weights are learned during training.

## Why Weights Matter

Weights are the artifact of training. They compress the statistical regularities of the training data into a reusable function. Once trained, weights let you run inference without the training data, the training code, or the compute cluster. They are the portable, deployable representation of the model.

This portability creates the **open-weights** ecosystem. When an organization releases model weights (as distinct from open-source code or open-data), anyone can download and run the model locally, fine-tune it, or study its behavior. Anthropic has argued that open-weights releases enable safety research, red-teaming, and local deployment for privacy-sensitive use cases, while also noting that weights alone do not convey the full training pipeline — data curation, compute infrastructure, and alignment procedures remain proprietary [S1]. The competitive landscape of open models is shaped by who releases weights, under what license, and at what scale [S2].

Weights also determine **inference cost**. The number of parameters dictates GPU memory (at 16-bit precision, 1 billion parameters ≈ 2 GB VRAM) and the floating-point operations (FLOPs) per token. Managing weights — compressing them, quantizing them, or updating only a subset — is therefore a first-order engineering concern for anyone serving or fine-tuning LLMs.

## How Weights Work: A Concrete Walk-Through

Consider a single linear layer in a feed-forward network: **y = Wx + b**. **W** has shape (output_dim, input_dim). Each row of **W** is a weight vector that detects a particular feature direction in the input space. The dot product **wᵢ·x** measures how much input **x** aligns with that feature. The non-linearity (ReLU, GeLU, Swish) then thresholds or smooths this activation.

Training adjusts **W** via **gradient descent**. For a loss function *L*, the chain rule gives ∂L/∂Wᵢⱼ = (∂L/∂yᵢ) · xⱼ. The weight update is Wᵢⱼ ← Wᵢⱼ − α · ∂L/∂Wᵢⱼ, where α is the learning rate. This is the same rule derived in classic texts for logistic regression and neural networks [S9]. Over millions of steps on trillions of tokens, these incremental updates organize the weight matrices into structured representations: early layers detect syntactic patterns, middle layers compose semantic features, late layers map to next-token predictions.

In a transformer, the same principle applies at larger scale. The attention block computes **Attention(Q, K, V) = softmax(QKᵀ/√d)V**, where Q = XW_Q, K = XW_K, V = XW_V. The projection matrices W_Q, W_K, W_V, W_O are learned weights. The feed-forward block applies two linear maps with an activation: FFN(x) = GeLU(xW₁)W₂. All these matrices are weights.

## Key Techniques and Variants

### Quantization: Lower Precision, Smaller Footprint

**Quantization** maps high-precision weights (FP16, BF16) to lower-precision formats (INT8, INT4, FP8). The mapping can be uniform (linear scaling) or non-uniform (codebooks, lookup tables). The goal is to reduce memory bandwidth and compute cost with minimal accuracy loss.

**PagedWeight** demonstrates dynamic, quality-aware quantization for Mixture-of-Experts (MoE) models at serving time. It quantizes expert weights on the fly, balancing precision against KV-cache memory pressure. In memory-sensitive MoE serving scenarios, PagedWeight achieves FP16-equivalent accuracy with up to 72.0% GPU memory savings and 1.94× throughput improvement over baselines, and improves quality by up to 39.3% at similar memory budgets with at most 4.1% throughput loss [S7].

### Low-Rank Adaptation (LoRA): Updating a Small Subspace

**LoRA** (Low-Rank Adaptation) freezes the base model weights and injects trainable low-rank matrices **A** and **B** (rank *r* ≪ *d*) into selected layers: ΔW = BA. Only *r*(d_in + d_out) parameters are trained instead of d_in·d_out. Vanilla LoRA updating every position in attention weight matrices through low-rank structure succeeds with only 0.16% of parameters [S3]. Applying the same low-rank update to feed-forward down-projection layers also succeeds.

**Quantized LoRA (QLoRA)** combines 4-bit quantization of the base model with LoRA adapters, enabling fine-tuning of large models on consumer GPUs. **Model merging** combines multiple LoRA adapters (or full fine-tunes) into a single set of weights, either by weighted averaging, concatenation, or more sophisticated methods like TIES-Merging or DARE [S4].

### Super Weights: Outlier Parameters with Disproportionate Impact

Recent work identified **Super Weights** — individual parameters whose removal (zeroing out) degrades model performance by orders of magnitude [S3]. However, importance does not imply trainability in isolation. Training *only* Super Weights (100 to 8,192 parameters) drops accuracy to random-guessing levels on both OLMo-1B and OLMo-7B. Expanding to local neighborhoods of up to 36K parameters provides no improvement. The collapse is specific to Super Weight coordinates: training an equal number of randomly chosen positions in the same down_proj layers *improves* over the baseline. A 10-seed ablation confirms that constraining LoRA updates at Super Weight coordinates yields statistically indistinguishable results from unconstrained LoRA. These findings establish that **parameter importance does not imply parameter trainability in isolation**, and effective fine-tuning relies on structured decompositions over entire layers rather than targeting individual coordinates [S3].

### Open Weights vs. Closed Weights

**Open-weights models** (Llama, Mistral, OLMo, Gemma, Qwen) publish their parameter tensors under permissive or semi-permissive licenses. This enables local inference, fine-tuning, distillation, and scientific analysis. **Closed-weights models** (GPT-4, Claude, Gemini) expose only an API. The trade-off involves safety, competitive advantage, and supply-chain trust. Anthropic's position emphasizes that open weights accelerate safety research but require responsible disclosure practices [S1].

### Model Compression via Coding

**Requential coding** compresses a model by recording only the teacher-selected training samples where a student model disagrees with a teacher. The resulting code length is independent of parameter count and data entropy, and often orders of magnitude shorter than prior compressors. Holding loss fixed, larger models and ensembles compress to much smaller sizes despite more parameters. Plugged into a PAC-Bayes bound, requential codes yield state-of-the-art generalization guarantees for billion-parameter models [S10].

### READ: Composing LoRA Adapters Without Interference

**READ** (Read-only Expansion of Adapter Deltas) addresses interference when merging independently trained LoRA adapters. It rewrites each adapter into a balanced canonical form and constrains the coupling so new skills can read old skills' input subspaces but cannot write into their output subspaces. The composed update folds into base weights with no inference cost, routing, or task-specific rules [S14].

## Applications

### Serving at Scale

Weight quantization (INT4, FP8, dynamic per-expert) is standard for deploying LLMs on GPU clusters. PagedWeight's dynamic MoE weight quantization directly addresses the tension between expert-weight memory and KV-cache growth in long-context serving [S7].

### Parameter-Efficient Fine-Tuning (PEFT)

LoRA and its variants (QLoRA, DoRA, LoRA+) let teams adapt open-weights models to domain tasks with 0.1–1% of full-parameter compute. This is the default path for enterprise adoption of open models [S4].

### Model Merging and Multi-Task Adaptation

Merging multiple LoRA adapters (or full fine-tunes) into a single model avoids serving multiple checkpoints. Techniques include linear merging, TIES-Merging (trim, elect sign, merge), and DARE (drop and rescale). READ provides a theoretically grounded alternative that prevents interference [S4, S14].

### Research and Auditing

Open weights enable mechanistic interpretability (probing, activation patching, super-weight analysis [S3]), safety evaluation (red-teaming, capability assessment), and fairness auditing. They also enable distillation — training smaller student models on larger teachers' outputs.

### Compression for Edge and Archival

Requential coding and other compression schemes target scenarios where model weights must be transmitted over constrained links or stored long-term with minimal bits [S10].

## Trade-offs and Limitations

### Quantization Accuracy Loss

Aggressive quantization (INT4, INT3) degrades quality, especially for reasoning-heavy tasks. Dynamic, quality-aware methods (PagedWeight) mitigate this but add serving complexity. Calibration data is often required for post-training quantization.

### LoRA Expressivity Ceiling

LoRA's low-rank constraint limits the complexity of adaptations. For large domain shifts or new languages, full fine-tuning may still be necessary. LoRA also requires choosing target modules (attention only? feed-forward? both?) and rank — hyperparameters that affect results.

### Super Weights Are Not Levers

The super-weight discovery is scientifically valuable but not an engineering lever: you cannot fine-tune by updating only super weights [S3]. Pruning them destroys capability; training them in isolation fails. They reveal structure, not a shortcut.

### Open Weights ≠ Open Source

Releasing weights does not release training data, code, or compute. Reproducing a model from weights alone is infeasible. License terms (e.g., Llama's acceptable use policy, Mistral's non-commercial restrictions) constrain commercial deployment. Supply-chain risks (backdoors, data contamination) exist for any artifact you did not train yourself.

### Merging Instability

Naive weight averaging of fine-tuned models often degrades performance on individual tasks. READ and TIES-Merging improve matters but do not guarantee Pareto optimality across all merged tasks. Evaluation remains essential.

### Compression Generalization Gaps

Requential coding's generalization guarantees hold under PAC-Bayes assumptions. Practical compression ratios depend on teacher-student agreement, which varies by task and model scale. The method is not yet a standard deployment tool.

## Further Reading

- **Anthropic**: "Our position on open-weights models" — policy framing for open-weights releases [S1]
- **Interconnects**: "The current balance of power in open models" — landscape analysis of open-weights models [S2]
- **arXiv**: "Super Weights in LLMs and the Failure of Selective Training" — empirical study of outlier parameters [S3]
- **Chip Huyen, AI Engineering**: Chapters on fine-tuning, LoRA, QLoRA, model merging, and when not to fine-tune [S4]
- **arXiv**: "PagedWeight: Efficient MoE LLM Serving with Dynamic Quality-Aware Weight Quantization" — runtime weight quantization for MoE [S7]
- **arXiv**: "Requential Coding: Pushing the Limits of Model Compression with Self-Generated Training Data" — compression via teacher-student disagreement [S10]
- **arXiv": "New LoRA Skills Should Read but Never Write (READ)" — interference-free adapter composition [S14]
- **Russell & Norvig, AI: A Modern Approach**: Neural network weight updates, chain rule derivation [S9]

## References

- S1: Anthropic — Our position on open-weights models — https://www.anthropic.com/news/position-open-weights-models
- S2: Interconnects — The current balance of power in open models — https://www.interconnects.ai/p/the-current-balance-of-power-in-open
- S3: arXiv — Super Weights in LLMs and the Failure of Selective Training — https://arxiv.org/abs/2607.08733v1
- S4: Chip Huyen — AI Engineering (finetuning, LoRA, PEFT, model merging chapters) — pack://ai-engineering-by-chip-huyen
- S7: arXiv — PagedWeight: Efficient MoE LLM Serving with Dynamic Quality-Aware Weight Quantization — https://arxiv.org/abs/2607.16184v1
- S9: Russell & Norvig — Artificial Intelligence: A Modern Approach (neural network weight updates) — pack://ai-russell-norvig
- S10: arXiv — Requential Coding: Pushing the Limits of Model Compression — https://arxiv.org/abs/2607.11883v1
- S14: arXiv — New LoRA Skills Should Read but Never Write (READ) — https://arxiv.org/abs/2609.31600v1
