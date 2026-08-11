---
title: "Post-Training: The Phase After Pre-Training Where Models Learn to Be Useful"
description: "A technical explainer on post-training \u2014 what it is, why it matters, how it works, and the key techniques that turn raw pre-trained models into capable assistants."
date: "2026-08-11"
format: "explainer"
concept: "post-training"
tldr: ["Post-training is the training phase after pre-training that adapts a base model for specific behaviors using gradient updates.", "It includes supervised fine-tuning (SFT), preference optimization (RLHF, DPO), and distillation \u2014 all of which change model weights via gradients.", "Quantization and other weight modifications without gradients are not post-training, even though they change weight values.", "Post-training consumes far less compute than pre-training (\u22482% for InstructGPT) but determines whether a model is actually usable.", "Key techniques differ in data requirements, reward signals, and whether they need a reference model or teacher."]
references: ["S1: AI Engineering (Chip Huyen) \u2014 part 51 (pack://ai-engineering-by-chip-huyen)", "S2: arXiv \u2014 OPSD-V: On-Policy Self-Distillation for Post-Training Few-Step Autoregressive Video Generators (https://arxiv.org/abs/2607.08766v1)", "S3: arXiv \u2014 The Regression Tax: Decomposing Why Skills Help and Hurt LLM Agents (https://arxiv.org/abs/2607.22520v1)", "S4: arXiv \u2014 Read It Back: Pretrained MLLMs Are Zero-Shot Reward Models for Text-to-Image Generation (https://arxiv.org/abs/2607.11886v1)", "S5: arXiv \u2014 PAST-Bench: Benchmarking the Foundations of Recursive Self-Improvement in Personal Agents (https://arxiv.org/abs/2608.04003v1)", "S6: arXiv \u2014 Toward Skill-Native LLMs: Skill Entropy for Benchmarking and Training Long-Horizon Reasoning (https://arxiv.org/abs/2608.05139v1)", "S7: arXiv \u2014 Pass the Baton: Trajectory-Relayed On-Policy Distillation (https://arxiv.org/abs/2607.26057v1)", "S8: arXiv \u2014 Visual Contrastive Self-Distillation (https://arxiv.org/abs/2607.21556v1)", "S11: arXiv \u2014 Do You Really Need to Pretrain Q-Functions for Online RL Fine-Tuning? (https://arxiv.org/abs/2607.27203v1)", "S14: arXiv \u2014 Requential Coding: Pushing the Limits of Model Compression with Self-Generated Training Data (https://arxiv.org/abs/2607.11883v1)"]
writer: "openrouter/nvidia/nemotron-3-ultra-550b-a55b:free"
fact_check: "passed"
diagram: "2026-08-11-post-training-the-phase-after-pre-training-where-models-lear.json"
---

## What Post-Training Is

Post-training is any training phase that runs *after* pre-training and updates model weights through gradient-based optimization. Pre-training builds a general-purpose model by predicting the next token on massive, unlabeled corpora. Post-training takes that base model and teaches it to follow instructions, converse helpfully, reason step-by-step, or specialize for a domain — all by continuing gradient descent on new objectives and data.

The distinction matters because not every weight change counts as training. Quantization, for example, reduces the precision of weights (e.g., FP16 → INT4) and technically alters their values, but it involves no gradients, no loss function, and no backward pass. It is a *compression* technique, not a training phase [S1].

In the taxonomy from *AI Engineering*, training phases are:
- **Pre-training**: Random initialization → next-token prediction on web-scale data. For InstructGPT, this consumed ~98% of total compute and data [S1].
- **Fine-tuning**: A generic term for any post-pre-training weight update. Often used interchangeably with post-training.
- **Post-training**: The umbrella term for the phases that turn a base model into a product — supervised fine-tuning (SFT), preference learning (RLHF, DPO, etc.), and distillation.

**Analogy**: Pre-training is like sending a model to read the entire internet and learn statistical regularities of language. Post-training is the apprenticeship where it learns *how to use* that knowledge for a human user.

## Why It Matters

A raw pre-trained model completes text. It does not answer questions, follow formatting constraints, refuse unsafe requests, or chain reasoning steps reliably. Post-training closes the gap between "next-token predictor" and "useful assistant."

It also dominates *differentiation* among models. Since most labs start from similar pre-training recipes and public data, the post-training choices — data curation, reward model design, distillation strategy — become the primary lever for competitive advantage. And because post-training is orders of magnitude cheaper than pre-training, it enables rapid iteration: you can run dozens of post-training experiments for the cost of one pre-training run.

## How It Works: A Concrete Walkthrough

Imagine you have a 7B-parameter base model (call it `Base-7B`) pre-trained on 2T tokens. You want a model that solves math problems with step-by-step reasoning.

**Stage 1: Supervised Fine-Tuning (SFT)**
You collect 50k–100k high-quality (problem, solution) pairs where solutions show clear reasoning traces. You train `Base-7B` on this dataset with a standard next-token loss. The model learns the *style* and *structure* of reasoning. Weights update via backpropagation. This is post-training.

**Stage 2: Preference Optimization**
SFT solutions vary in quality. You want the model to prefer correct, well-structured reasoning over plausible-but-wrong chains. You generate multiple solutions per problem, label the best (via human annotators or a stronger model), and optimize a preference objective:
- **RLHF**: Train a reward model on comparisons, then run PPO against it.
- **DPO**: Directly optimize the policy on preference pairs without a separate reward model or RL loop.
- **KTO / ORPO / SimPO**: Variants that reduce data or compute requirements.

The model now internalizes a quality filter. Weights update again via gradients. This is post-training.

**Stage 3: Distillation (Optional)**
You have a massive teacher (e.g., 400B params) that reasons superbly but is too slow for production. You sample reasoning traces from the teacher on your target distribution, then train a smaller student (your 7B model) to match the teacher's output distributions — often using on-policy distillation where the student generates, the teacher corrects, and the student learns from the corrected trajectory [S7]. Weights update via a distillation loss (e.g., forward KL). This is post-training.

At each stage, the mechanism is the same: forward pass → loss → backward pass → weight update. The *objectives* and *data* change; the training loop does not.

## Key Techniques and Variants

### Supervised Fine-Tuning (SFT)
**What it is**: Standard next-token prediction on curated instruction–response pairs.
**Data**: 10k–1M examples, typically human-written or model-generated then filtered.
**When to use**: First step after base model; establishes format, style, and basic capability.
**Limitation**: Learns to imitate; does not inherently distinguish good from bad outputs.

### Preference Optimization
All methods below update weights via gradients on a preference signal.

| Method | Reward Signal | Reference Model Needed? | RL Loop? |
|---|---|---|---|
| **RLHF (PPO)** | Learned reward model | Yes (KL penalty) | Yes |
| **DPO** | Implicit via preference pairs | Yes (implicit) | No |
| **KTO** | Binary desirable/undesirable | Yes | No |
| **ORPO** | Odds ratio on chosen/rejected | No | No |
| **SimPO** | Length-normalized log-prob ratio | No | No |

**RLHF** was the original recipe (InstructGPT). **DPO** removed the reward model and PPO complexity, becoming the default for open-source post-training. **ORPO/SimPO** further simplify by dropping the explicit reference model, using the policy's own odds or normalized log-probabilities as the signal.

### Distillation
Transfers capability from a stronger teacher to a weaker student via gradient updates on the student.

- **Offline distillation**: Teacher generates a static dataset; student trains on it.
- **On-policy distillation (OPD)**: Student generates, teacher evaluates/corrects the student's *own* prefixes, student learns from teacher's continuation [S7].
- **Relay-OPD**: Detects when the student goes off-track (prefix failure), lets the teacher take over briefly to produce a corrective "leg," then hands back to the student. Reduces training trajectory length by >50% and outperforms standard OPD by +5.73% on math benchmarks (Qwen3-4B teacher → Qwen3-1.7B student) [S7].
- **Self-distillation**: No external teacher. The model teaches itself via asymmetric views (e.g., with/without visual context [S8], or EMA snapshots). VCSD on Qwen3-VL improved a 7-benchmark aggregate from 62.27% → 67.04% at 2B using only input conditioning asymmetry [S8].

### Reinforcement Learning with Verifiable Rewards
For domains with ground truth (code execution, math, formal proofs), the reward is a deterministic function. No reward model needed. The policy optimizes directly via PPO, GRPO, or REINFORCE-style updates. This is post-training because weights change via gradients — the reward just happens to be exact.

### Skill-Aware Post-Training
Skill^2-Bench introduced **Skill Entropy** — a measure of how hard it is to switch between reasoning skills (math → planning → coding) — and **Skill-Entropy RL**, where the model predicts both the answer and the skill used at each step. The reward combines step correctness with skill-sequence alignment [S6]. This targets the *composition* of skills, not just individual skill performance.

## Applications: Where Post-Training Shows Up

1. **Chat assistants** (Claude, GPT-4o, Llama-3-Instruct): SFT + DPO/RLHF on massive preference datasets.
2. **Reasoning models** (o1-style, DeepSeek-R1, QwQ): Extended RL on verifiable rewards (math, code) with long chain-of-thought; often distilled into smaller deployable models.
3. **Code specialists** (CodeLlama, StarCoder2-Instruct, DeepSeek-Coder): SFT on code-instruction pairs + RL on unit-test pass rates.
4. **Multimodal models** (LLaVA, Qwen-VL, Molmo): SFT on image-text instruction data; sometimes preference optimization on visual quality or faithfulness.
5. **Video generation** (Self-Forcing, LongLive + OPSD-V): Few-step autoregressive video models post-trained with on-policy self-distillation using real video context as temporal supervision. Improves motion dynamics and long-horizon consistency; preferred 66% over base in user study [S2].
6. **Personal agents** (PAST-Bench setting): Agents that retain memory, skills, and tool routines across sessions. Post-training includes learning *when* to retrieve, *how* to update outdated skills, and *how* to compose procedures. Hermes+ adds targeted interventions across the agent loop to improve retention-driven gains [S5].
7. **Reward-model-free RL for image generation** (SpectraReward): Uses a pretrained MLLM's prompt-recovery log-likelihood as a reward signal for diffusion policy optimization — no labeled preferences, no reward model training. Works across 9 MLLM backbones (4B–235B) and 5 OOD benchmarks [S4].
8. **Q-function initialization for RL fine-tuning** (IPE): When fine-tuning a pretrained policy with online RL, naive Q-function pretraining often helps little. Training an ensemble of diverse policies and pooling their rollouts to bootstrap the Q-function yields 1.26× average improvement on continuous control [S11].

## Trade-offs and Limitations

**Compute vs. Capability Ceiling**
Post-training cannot add knowledge the base model never saw. It rearranges and surfaces existing capabilities. If the base model lacks French legal terminology, no amount of SFT on English contracts will create it — you need continued pre-training or retrieval.

**Data Quality > Data Quantity**
A few thousand expert-curated SFT examples often beat hundreds of thousands of noisy ones. Preference data is even more sensitive: inconsistent labels degrade the reward signal and produce sycophantic or over-optimized models.

**Reward Hacking**
All preference methods optimize a proxy. The model learns to exploit the reward model (RLHF) or the preference dataset's biases (DPO). Result: verbose, hedging, or "style-over-substance" outputs. Mitigations include KL penalties, reference models, and evaluation on held-out *capability* benchmarks, not just reward scores.

**Distillation Gaps**
A student distilled from a teacher inherits the teacher's *outputs* on the training distribution, not necessarily its *reasoning process*. Off-distribution, the student may fail catastrophically. On-policy and relay distillation [S7] narrow this by training on the student's own trajectories.

**Skill Regression**
Adding new skills (via SFT or tool-use training) can break existing ones. In agent benchmarks, the best skill sets outperformed others primarily by *regressing less*, not by gaining more. Three failure modes: (i) skill description osmosis — mere presence of a skill in context changes behavior; (ii) grounding displacement — the skill's procedure overrides input interpretation; (iii) verification displacement — the procedure suppresses the agent's own output checks [S3].

**Evaluation Blind Spots**
Standard benchmarks (MMLU, GSM8K, HumanEval) measure static capability. They miss:
- Long-horizon skill switching (Skill^2-Bench [S6])
- Retention and update across sessions (PAST-Bench [S5])
- Regression on previously solved tasks when new skills are added [S3]
- Faithfulness of distilled reasoning vs. answer matching

**When Not to Use Post-Training**
- You need new factual knowledge → continued pre-training or RAG.
- You only need inference speed/size reduction → quantization, pruning, distillation *without* gradient updates on task data (but note: distillation *with* gradients is post-training).
- You have no labeled data and no verifiable reward → unsupervised post-training is an open research area; self-distillation [S8] and SpectraReward [S4] are early steps.

## Further Reading

- **AI Engineering (Chip Huyen)** — Canonical framing of pre-training vs. fine-tuning vs. post-training; the 98% compute figure for InstructGPT [S1].
- **OPSD-V** — On-policy self-distillation for few-step autoregressive video generators [S2].
- **The Regression Tax** — Why adding skills hurts agents and how to measure it [S3].
- **SpectraReward / Self-SpectraReward** — Training-free reward models from pretrained MLLMs for image generation RL [S4].
- **PAST-Bench** — Benchmarking recursive self-improvement in personal agents with persistent memory [S5].
- **Skill^2-Bench & Skill-Entropy RL** — Measuring and training cross-skill long-horizon reasoning [S6].
- **Relay-OPD** — Trajectory-relayed on-policy distillation that fixes prefix failure [S7].
- **Visual Contrastive Self-Distillation (VCSD)** — Self-distillation via input-conditioning asymmetry, no external teacher [S8].
- **IPE (Initialization via Policy Ensemble)** — Better Q-function bootstrapping for online RL fine-tuning [S11].
- **Requential Coding** — Compression via teacher-selected student-distribution samples; PAC-Bayes generalization bounds [S14].

## References

- S1: AI Engineering (Chip Huyen) — part 51 (pack://ai-engineering-by-chip-huyen)
- S2: arXiv — OPSD-V: On-Policy Self-Distillation for Post-Training Few-Step Autoregressive Video Generators (https://arxiv.org/abs/2607.08766v1)
- S3: arXiv — The Regression Tax: Decomposing Why Skills Help and Hurt LLM Agents (https://arxiv.org/abs/2607.22520v1)
- S4: arXiv — Read It Back: Pretrained MLLMs Are Zero-Shot Reward Models for Text-to-Image Generation (https://arxiv.org/abs/2607.11886v1)
- S5: arXiv — PAST-Bench: Benchmarking the Foundations of Recursive Self-Improvement in Personal Agents (https://arxiv.org/abs/2608.04003v1)
- S6: arXiv — Toward Skill-Native LLMs: Skill Entropy for Benchmarking and Training Long-Horizon Reasoning (https://arxiv.org/abs/2608.05139v1)
- S7: arXiv — Pass the Baton: Trajectory-Relayed On-Policy Distillation (https://arxiv.org/abs/2607.26057v1)
- S8: arXiv — Visual Contrastive Self-Distillation (https://arxiv.org/abs/2607.21556v1)
- S11: arXiv — Do You Really Need to Pretrain Q-Functions for Online RL Fine-Tuning? (https://arxiv.org/abs/2607.27203v1)
- S14: arXiv — Requential Coding: Pushing the Limits of Model Compression with Self-Generated Training Data (https://arxiv.org/abs/2607.11883v1)
