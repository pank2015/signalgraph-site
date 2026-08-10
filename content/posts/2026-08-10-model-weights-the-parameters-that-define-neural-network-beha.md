---
title: "Model Weights: The Parameters That Define Neural Network Behavior"
description: "A technical explainer on what model weights are, how they are learned and stored, and the techniques engineers use to manipulate them for deployment and adaptation."
date: "2026-08-10"
format: "explainer"
concept: "model weights"
tldr: ["Model weights are the learned numerical parameters that determine how a neural network transforms inputs into outputs.", "Training adjusts weights via backpropagation to minimize a loss function; inference applies fixed weights to new data.", "Techniques like quantization, low-rank adaptation (LoRA), and model merging modify weights to reduce memory, enable efficient fine-tuning, or combine capabilities.", "Individual weights can be surprisingly critical \u2014 so-called \"super weights\" \u2014 but training them in isolation fails; structured updates across layers work better.", "Open-weight releases provide the parameter values but not necessarily the training data, code, or compute needed to reproduce the model."]
references: ["S1: Anthropic \u2014 Our position on open-weights models \u2014 https://www.anthropic.com/news/position-open-weights-models", "S2: arXiv \u2014 Super Weights in LLMs and the Failure of Selective Training \u2014 https://arxiv.org/abs/2607.08733v1", "S3: AI Engineering by Chip Huyen \u2014 pack://ai-engineering-by-chip-huyen", "S6: arXiv \u2014 PagedWeight: Efficient MoE LLM Serving with Dynamic Quality-Aware Weight Quantization \u2014 https://arxiv.org/abs/2607.16184v1", "S7: Artificial Intelligence: A Modern Approach (Russell & Norvig) \u2014 pack://ai-russell-norvig", "S8: arXiv \u2014 Requential Coding: Pushing the Limits of Model Compression with Self-Generated Training Data \u2014 https://arxiv.org/abs/2607.11883v1"]
writer: "openrouter/nvidia/nemotron-3-ultra-550b-a55b:free"
fact_check: "passed"
diagram: "2026-08-10-model-weights-the-parameters-that-define-neural-network-beha.json"
---

## What model weights are

A neural network is a parameterized function. The architecture — layers, connections, activation functions — defines the *form* of that function. The **model weights** (also called parameters) are the numerical values that fill in that form. Together, they specify the exact mapping from input to output.

Concretely, in a fully connected layer, each connection between an input neuron and an output neuron has an associated weight (a scalar multiplier) and each output neuron has a bias (an additive constant). In a transformer, weights populate the query, key, value, and output projection matrices in every attention head, the feed-forward network matrices, layer-normalization scale and shift parameters, and embedding tables. A modern large language model (LLM) can contain billions to trillions of these values.

**Intuition**: if the architecture is the circuit diagram, the weights are the precise resistor and capacitor values soldered onto the board. Changing the architecture rewires the circuit; changing the weights retunes it.

Weights are *learned*, not designed. During training, an optimizer repeatedly adjusts them to minimize a loss function on a training dataset. After training, the weights are *frozen* for inference — they become static constants that the model applies to every new input.

## Why weights matter

Weights are the locus of a model's knowledge and capabilities. All the information extracted from the training corpus — facts, reasoning patterns, linguistic regularities, heuristics — is compressed into these numbers. This has several practical consequences:

*   **Portability**: A trained model is essentially a large array of numbers. Copy the weights to another machine with the same architecture and software stack, and you reproduce the model's behavior exactly. This is why weight files (often in formats like safetensors or PyTorch checkpoints) are the standard artifact for model distribution.
*   **Adaptation**: Instead of training from scratch, you can modify existing weights to specialize a model. Fine-tuning, low-rank adaptation (LoRA), and model merging all operate by changing the weight values.
*   **Resource demands**: The number and precision of weights directly determine memory footprint, storage size, and compute requirements for both training and inference. A 7B-parameter model at 16-bit precision needs ~14 GB of GPU memory just for weights; at 4-bit quantization, roughly 4 GB.
*   **Inspection and control**: Because weights are explicit arrays, you can analyze them (e.g., identify outlier values, measure sparsity), prune them, or quantize them to lower precision.

## How weights work: learning and inference

### The learning rule

Training uses **backpropagation** to compute the gradient of the loss with respect to every weight, then updates each weight in the direction that reduces loss. For a simple neuron with output $h_w(x) = g(w \cdot x)$ and squared-error loss $L = (y - h_w(x))^2$, the chain rule gives the weight update [S7]:

$$
w_i \leftarrow w_i + \alpha (y - h_w(x)) \times h_w(x)(1 - h_w(x)) \times x_i
$$

where $\alpha$ is the learning rate. In deep networks, this gradient is computed layer by layer from output to input. Modern optimizers (Adam, AdamW) adapt the step size per parameter using running estimates of first and second moments of the gradients.

### Training vs. inference

During training, weights are variables: they reside in GPU memory in high precision (typically FP32 or BF16 for master weights, FP16/BF16 for forward/backward), and they change every step. During inference, weights are constants: they are read-only, often quantized to INT8, INT4, or lower, and streamed from memory into compute units for each forward pass.

### Concrete example: a tiny MLP

Consider a two-layer MLP with input dimension 3, hidden dimension 4, output dimension 2. The weight matrices are $W_1 \in \mathbb{R}^{4 \times 3}$ and $W_2 \in \mathbb{R}^{2 \times 4}$, plus biases $b_1 \in \mathbb{R}^4$, $b_2 \in \mathbb{R}^2$. Total parameters: $4\times3 + 4 + 2\times4 + 2 = 26$. Given input $x \in \mathbb{R}^3$, the forward pass is:

$$
h = \text{ReLU}(W_1 x + b_1) \quad \in \mathbb{R}^4
$$
$$
\hat{y} = W_2 h + b_2 \quad \in \mathbb{R}^2
$$

Training adjusts all 26 numbers so that $\hat{y}$ matches target $y$ across the dataset. Inference just runs the two matrix multiplies with the final numbers.

## Key techniques that operate on weights

### Quantization

**Quantization** reduces the numerical precision of weights (and sometimes activations) to shrink memory and accelerate compute. Common schemes:

*   **Post-training quantization (PTQ)**: Convert a trained FP16/BF16 model to INT8 or INT4 without retraining. Calibration data helps choose scaling factors.
*   **Quantization-aware training (QAT)**: Simulate quantization noise during training so the model learns to be robust to it.
*   **Dynamic/per-channel quantization**: Use different scaling factors per output channel or per token to preserve accuracy.

For Mixture-of-Experts (MoE) models, where only a subset of experts is active per token, the inactive experts' weights can be kept in low precision and dynamically re-quantized at runtime. **PagedWeight** demonstrates this: it achieves FP16-equivalent accuracy with up to 72.0% GPU memory savings and 1.94× throughput improvement, and improves quality over quantization baselines by up to 39.3% at a similar memory budget with at most 4.1% throughput loss [S6].

### Low-rank adaptation (LoRA)

**LoRA** freezes the base model weights and injects trainable low-rank matrices into selected layers (typically attention projections). For a weight matrix $W \in \mathbb{R}^{d \times k}$, LoRA learns $A \in \mathbb{R}^{d \times r}$ and $B \in \mathbb{R}^{r \times k}$ with $r \ll \min(d,k)$, so the effective update is $W + BA$. Only $A$ and $B$ are trained; the original $W$ stays fixed. At inference, $BA$ can be merged into $W$ for zero overhead.

LoRA reduces trainable parameters by orders of magnitude. In one study, vanilla LoRA updating every position in attention weight matrices through low-rank structure succeeded with only 0.16% of parameters, and applying the same low-rank update to feed-forward down-projection layers also succeeded [S2]. This demonstrates that effective fine-tuning relies on structured decompositions over entire layers rather than targeting individual coordinates.

### Quantized LoRA (QLoRA)

QLoRA combines 4-bit quantization of the base model with LoRA adapters trained in higher precision (e.g., BF16). The base weights stay frozen in 4-bit; only the LoRA parameters are updated. This enables fine-tuning large models on consumer GPUs. QLoRA also supports **model merging**: multiple LoRA adapters trained for different tasks can be combined (e.g., by weighted averaging or concatenation) into a single model without additional training [S3].

### Super weights

Recent work identified **super weights**: individual parameters whose removal (zeroing out) degrades model performance by orders of magnitude [S2]. Surprisingly, training *only* these super weights in isolation — 100 to 8,192 parameters — drops accuracy to random-guessing levels on OLMo-1B and OLMo-7B. Expanding to local neighborhoods of up to 36K parameters provides no improvement. The failure is specific to super weight coordinates: training an equal number of randomly chosen positions in the same down-projection layers *improves* over the baseline. This establishes that parameter importance does not imply parameter trainability in isolation; effective learning requires coordinated updates across structured subspaces.

### Model merging

Given multiple fine-tuned models (or LoRA adapters) derived from the same base, **model merging** combines their weights into a single model. Simple methods include linear interpolation (weight averaging) and task arithmetic (adding/subtracting weight differences). More advanced methods like TIES-MERGING trim, elect sign, and merge. Merging can yield multi-task models without further training, but interference between tasks is a known failure mode [S3].

### Parameter-efficient fine-tuning (PEFT) taxonomy

Beyond LoRA, PEFT includes:

*   **Adapter modules**: Small bottleneck layers inserted between transformer blocks.
*   **Prefix/Prompt tuning**: Learnable vectors prepended to the input or hidden states.
*   **BitFit**: Only train bias terms.
*   **Diff pruning**: Learn a sparse binary mask over weights.

The choice depends on the trade-off between parameter budget, performance, and inference overhead. LoRA and QLoRA are currently the most widely adopted for LLMs [S3].

## Applications

### Serving large models on constrained hardware

Quantization (PTQ, GPTQ, AWQ, dynamic quantization) lets teams run 7B–70B parameter models on single GPUs with 24–80 GB VRAM. PagedWeight extends this to MoE serving by dynamically quantizing inactive expert weights, balancing KV-cache pressure against weight precision [S6].

### Rapid domain adaptation

Instead of full fine-tuning (which requires storing multiple full-model copies), teams train LoRA adapters per domain/task. A single base model + dozens of 10–100 MB adapters replaces dozens of 10–100 GB full models. Adapters can be hot-swapped at inference time.

### Federated and privacy-preserving training

In federated learning, clients compute weight updates locally; only the updates (or LoRA deltas) leave the device. The server aggregates them into a global model. This keeps raw data on-device.

### Model compression for edge deployment

Quantization + pruning + knowledge distillation can shrink a model by 10–50× for mobile/embedded deployment. Requential coding shows that the *information content* of a trained model can be far smaller than its parameter count suggests: holding loss fixed, larger models and ensembles compress to much smaller sizes despite more parameters [S8].

### Open-weight model ecosystems

Organizations release model weights (e.g., Llama, Gemma, OLMo, Nemotron) under licenses that permit commercial use, modification, and redistribution. Anthropic distinguishes **open weights** (releasing the parameter values) from **open source** (releasing training data, code, and infrastructure). Open weights enable community fine-tuning, analysis, and deployment, but do not by themselves enable full reproduction or auditing of the training process [S1].

## Trade-offs and limitations

### Quantization degrades quality, especially at very low bit-widths

INT4 quantization is now standard for 7B+ models, but INT3 and below typically cause noticeable degradation in reasoning, coding, and instruction following. Accuracy recovery techniques (GPTQ, AWQ, QAT, dynamic quantization) add complexity. For MoE, the trade-off is three-way: weight precision vs. KV-cache size vs. throughput [S6].

### LoRA can underperform full fine-tuning on complex tasks

LoRA excels at style, format, and knowledge injection. It struggles with tasks requiring deep representation changes (e.g., learning a new language, major reasoning skill acquisition). Full fine-tuning or larger ranks (higher $r$) help but increase memory and compute.

### Super weights are brittle

The existence of super weights suggests the loss landscape has extremely sensitive directions. However, targeting them for training or pruning is counterproductive. Their presence complicates pruning and quantization: naive magnitude-based pruning may remove a super weight and collapse performance. Structured pruning (removing entire channels/heads) is safer.

### Model merging is not compositional

Merging two models fine-tuned on different tasks does not reliably yield a model that excels at both. Interference, catastrophic forgetting, and representation misalignment are common. Evaluation is essential; there is no guarantee of positive transfer.

### Open weights ≠ open science

Access to weights enables inference and fine-tuning, but not:

*   Reproduction of training (data, compute, hyperparameters, seed)
*   Full auditing for biases, copyrighted content, or safety issues
*   Verification of the training pipeline (e.g., no hidden distillation)

Teams building on open-weight models should treat them as opaque artifacts with unknown provenance unless the provider releases full training transparency artifacts [S1].

### Weight-file security

Weight files are large binary blobs. Malicious pickled PyTorch checkpoints can execute arbitrary code on load. The industry is moving to **safetensors** (a safe, memory-mappable format with no executable code) as the standard distribution format. Always verify checksums and prefer safetensors over `.pt`/`.bin`.

## Further reading

*   **Anthropic — Our position on open-weights models** [S1]: The distinction between open weights and open source, and the implications for safety and ecosystem.
*   **Super Weights in LLMs and the Failure of Selective Training** [S2]: Discovery of super weights, the failure of isolated training, and the success of structured low-rank updates.
*   **AI Engineering by Chip Huyen** [S3]: Comprehensive coverage of fine-tuning, LoRA, QLoRA, model merging, and when to fine-tune vs. use RAG.
*   **PagedWeight: Efficient MoE LLM Serving with Dynamic Quality-Aware Weight Quantization** [S6]: Runtime weight quantization for MoE serving with memory-accuracy-throughput trade-offs.
*   **Artificial Intelligence: A Modern Approach (Russell & Norvig)** [S7]: Textbook derivation of backpropagation weight updates via the chain rule.
*   **Requential Coding: Pushing the Limits of Model Compression with Self-Generated Training Data** [S8]: Information-theoretic view of model compression; larger models can compress more despite more parameters.

## References

- S1: Anthropic — Our position on open-weights models — https://www.anthropic.com/news/position-open-weights-models
- S2: arXiv — Super Weights in LLMs and the Failure of Selective Training — https://arxiv.org/abs/2607.08733v1
- S3: AI Engineering by Chip Huyen — pack://ai-engineering-by-chip-huyen
- S6: arXiv — PagedWeight: Efficient MoE LLM Serving with Dynamic Quality-Aware Weight Quantization — https://arxiv.org/abs/2607.16184v1
- S7: Artificial Intelligence: A Modern Approach (Russell & Norvig) — pack://ai-russell-norvig
- S8: arXiv — Requential Coding: Pushing the Limits of Model Compression with Self-Generated Training Data — https://arxiv.org/abs/2607.11883v1
