---
title: "Post-Training: The Phase Where Models Learn to Be Useful"
description: "A technical explainer covering what post-training is, why it matters, how it works, key techniques, applications, and trade-offs \u2014 grounded in current research."
date: "2026-10-05"
format: "explainer"
concept: "post-training"
tldr: ["Post-training is the phase after pre-training where model weights are further updated for specific capabilities like instruction following, reasoning, or domain expertise.", "It includes supervised fine-tuning (SFT), reinforcement learning (RL), distillation, and other techniques \u2014 each changing model weights with labeled or reward-supervised data.", "Post-training is far cheaper than pre-training (which consumes ~98% of compute for models like InstructGPT) but critically determines real-world usefulness.", "Key methods include RL from human feedback (RLHF), on-policy distillation, self-supervised confidence training, and reward-model-free approaches like SpectraReward.", "Trade-offs include regression risk (skills can hurt performance), computational cost of RL, and the need for careful evaluation beyond average metrics."]
references: ["S1: AI Engineering by Chip Huyen \u2014 pack://ai-engineering-by-chip-huyen", "S2: Intervention-Aware Clinical World Model for Post-Op Outcome Forecasting in Cardiology \u2014 https://arxiv.org/abs/2608.13518v1", "S3: StudentBench: AI and human tutoring yield equivalent GRE learning gains \u2014 https://arxiv.org/abs/2609.28470v1", "S4: OPSD-V: On-Policy Self-Distillation for Post-Training Few-Step Autoregressive Video Generators \u2014 https://arxiv.org/abs/2607.08766v1", "S5: The Regression Tax: Decomposing Why Skills Help and Hurt LLM Agents \u2014 https://arxiv.org/abs/2607.22520v1", "S6: PoEM: Predicting RL Outcomes from Existing Policies \u2014 https://arxiv.org/abs/2609.30226v1", "S7: Learning to Stop without Learning to Stop: Self-Supervised Confidence Training Improves Reasoning Efficiency \u2014 https://arxiv.org/abs/2609.31619v1", "S8: Post-Training Language Models for Gold-Medal Performance in Coding Competitions \u2014 https://arxiv.org/abs/2609.02849v1", "S9: Read It Back: Pretrained MLLMs Are Zero-Shot Reward Models for Text-to-Image Generation \u2014 https://arxiv.org/abs/2607.11886v1", "S11: PAST-Bench: Benchmarking the Foundations of Recursive Self-Improvement in Personal Agents \u2014 https://arxiv.org/abs/2608.04003v1", "S13: Toward Skill-Native LLMs: Skill Entropy for Benchmarking and Training Long-Horizon Reasoning \u2014 https://arxiv.org/abs/2608.05139v1", "S14: Pass the Baton: Trajectory-Relayed On-Policy Distillation \u2014 https://arxiv.org/abs/2607.26057v1"]
writer: "openrouter/nvidia/nemotron-3-ultra-550b-a55b:free"
fact_check: "passed"
diagram: "2026-10-05-post-training-the-phase-where-models-learn-to-be-useful.json"
---

## What Post-Training Is

Post-training is the phase of model development that occurs **after pre-training**, where a model's weights are further updated to specialize its behavior for particular tasks, formats, or alignment objectives. Pre-training teaches a model to predict the next token on massive, diverse corpora — learning language, world knowledge, and reasoning primitives. Post-training teaches the model **how to use** that knowledge: how to follow instructions, format answers, reason step-by-step, write code, or align with human preferences.

The term "training" is often used loosely to cover pre-training, fine-tuning, and post-training. But they are distinct phases. Pre-training starts from randomly initialized weights and consumes the vast majority of compute — for InstructGPT, pre-training accounted for **98% of overall compute and data resources** [S1]. Post-training starts from a pre-trained checkpoint and applies targeted weight updates using smaller, curated datasets or reward signals. Crucially, **not all weight changes count as training**: quantization reduces weight precision but is considered a compression technique, not training [S1].

An analogy: pre-training is like a general liberal-arts education — broad, expensive, foundational. Post-training is a specialized apprenticeship — focused, cheaper, job-ready.

## Why It Matters

A pre-trained model can complete text, but it doesn't reliably follow instructions, admit uncertainty, or solve multi-step problems in a structured way. Post-training bridges the gap between **"knows a lot"** and **"does what you ask."** It enables:

- **Instruction following**: responding to prompts as tasks rather than completions
- **Structured reasoning**: chain-of-thought, tool use, multi-step planning
- **Alignment**: helpfulness, harmlessness, honesty
- **Domain specialization**: coding, math, medical reasoning, video generation
- **Efficiency**: shorter reasoning traces, fewer tokens for the same accuracy

Without post-training, even the largest pre-trained models are difficult to deploy as reliable assistants or agents. With it, models of modest size (e.g., 30B parameters) can achieve **gold-medal performance in competitive programming** [S8] or **match expert human tutoring** on standardized tests [S3].

## How It Works: A Concrete Walkthrough

Consider a pre-trained LLM checkpoint. Post-training typically proceeds in stages:

### 1. Supervised Fine-Tuning (SFT)
Curate a dataset of (prompt, ideal_response) pairs — e.g., coding problems with verified solutions, or user queries with expert-written answers. Train the model to maximize likelihood of the ideal responses. This teaches format, style, and basic task competence. The Nemotron-3-Nano-CC model used **22,000 curated competitive programming problems** for SFT before moving to RL [S8].

### 2. Reinforcement Learning (RL)
Define a reward function — a scalar signal scoring model outputs. This can come from:
- A **reward model** trained on human preference comparisons (RLHF)
- **Verifiable rewards**: unit test pass/fail, math answer correctness, compilation success
- **Self-supervised signals**: confidence prediction, prompt recovery likelihood

Run a policy optimization algorithm (PPO, GRPO, DPO, etc.) to maximize expected reward. The model learns strategies that SFT alone cannot teach: backtracking, self-correction, exploring multiple solution paths. For coding, Nemotron used RL with execution-based rewards to push from 130 to 291 points on IOI 2025 [S8].

### 3. Optional: Distillation or Specialized Fine-Tuning
A larger "teacher" model can generate training data for a smaller "student" (knowledge distillation), or the model can be further tuned on specific failure modes. OPSD-V uses **on-policy self-distillation** for video generation: the student rolls out autoregressive chunks while a teacher provides dense denoising-level supervision using real video context [S4]. Relay-OPD improves this by letting the teacher briefly take over when the student goes off-track, then handing back [S14].

## Key Techniques and Variants

| Technique | Supervision Source | Typical Use Case |
|-----------|-------------------|------------------|
| **SFT** | Human-written or curated (prompt, response) pairs | Format, style, basic skills |
| **RLHF / RLAIF** | Preference comparisons → reward model → RL | Alignment, instruction following |
| **RL with verifiable rewards** | Code execution, math grading, compiler feedback | Coding, math, logic |
| **On-policy distillation (OPD, Relay-OPD)** | Teacher model evaluated on student's own trajectories | Reasoning, video generation |
| **Self-supervised confidence training** | Model's own confidence predictions on intermediate reasoning steps | Reasoning efficiency |
| **Reward-model-free RL (SpectraReward, Self-SpectraReward)** | Prompt recovery likelihood from generated output | Image/video generation |
| **PoEM (Predicting RL Outcomes)** | Linear combination of existing post-trained log-policies | Avoiding re-running RL for new rewards |

### Notable Variants

- **RLHF vs. RLAIF**: Human vs. AI-generated preference labels. Both train a reward model, then run RL.
- **DPO / KTO / IPO**: Offline RL alternatives that optimize directly on preference data without a separate reward model or online rollout.
- **GRPO (Group Relative Policy Optimization)**: Used in reasoning models; compares multiple sampled completions per prompt.
- **Self-SpectraReward**: The policy's own understanding branch scores its generation branch — a closed loop with no external reward model [S9].
- **PoEM**: Given models post-trained on rewards R1, R2..., predict the policy for a new reward R_new = Σ w_i R_i by combining log-policies linearly — **without running RL** [S6].

## Applications

### Competitive Programming
Nemotron-3-Nano-CC (30B) and Ultra-CC (550B) used SFT + RL on 22K curated problems. Nano-CC went from 130 → 291 → 468 (with GenCorrect test-time compute) on IOI 2025, exceeding the gold threshold of 438.3. The prospective IOI 2026 system scored **535.4/600**, beating the top human score of 498.27 [S8].

### Reasoning Efficiency
Self-supervised confidence fine-tuning on **600 training problems** reduced generated tokens by **up to 25% at matched accuracy** across Gemma, Qwen, Nemotron, and GPT-OSS models on math, science, and coding benchmarks — without any length penalty or early-stopping mechanism at inference [S7].

### Video Generation
OPSD-V post-trains few-step autoregressive video diffusion models (Self-Forcing, LongLive) using real long-video context as dense trajectory supervision. A user study (10 participants, 20 video pairs) showed **66% preference** for OPSD-V over base models [S4].

### Image Generation
SpectraReward turns any pretrained MLLM into a reward model for text-to-image RL by measuring **prompt recovery log-likelihood** from the generated image. Validated across 2 diffusion models, 3 RL algorithms, 9 MLLM backbones (4B–235B), and 5 OOD benchmarks [S9].

### Clinical Forecasting
An intervention-aware world model post-trained on irregular post-procedure events achieves **AUROC 0.756, AUPRC 0.777** for atrial fibrillation ablation recurrence prediction, and **scar-extent MAE 2.971 percentage points** without follow-up MRI at inference [S2].

### Tutoring
StudentBench (175K+ messages, 2,383 participants) found AI tutoring **statistically equivalent to expert human tutoring** for GRE gains (p=.015), with one AI tutor achieving parity at **918× lower cost** ($0.0052 vs $4.81 per percentage point gained) [S3].

### Agent Skills
Adding procedural skills to LLM agents introduces a **regression tax**: skills can cause regressions (tasks solved without skills but failed with them). The best skills outperform primarily by **regressing less, not by gaining more** [S5].

## Trade-offs and Limitations

### Regression Risk
Skills or fine-tuning data can introduce **skill description osmosis** (behavior changes just from context presence), **grounding displacement** (procedure overrides input interpretation), and **verification displacement** (procedure suppresses output checks) [S5]. Evaluation must measure regressions, not just average gains.

### RL Instability and Cost
RL post-training is **computationally intensive, sometimes unstable, and must be rerun from scratch** when the reward changes or rewards are combined [S6]. PoEM mitigates this but is an approximation.

### Error Accumulation in Autoregressive Generation
Few-step AR video models suffer error accumulation and weakened motion dynamics during long rollouts. OPSD-V helps but doesn't eliminate the fundamental challenge [S4].

### Data and Curation Bottlenecks
High-quality SFT data (22K curated problems [S8], 600 confidence problems [S7]) requires expert effort. Synthetic data helps but must be verified.

### Evaluation Gaps
Average metrics hide regressions [S5]. Benchmarks like Skill²-Bench measure skill-switching entropy [S13], and PAST-Bench measures recursive self-improvement [S11], but real-world deployment reveals failure modes benchmarks miss.

### When NOT to Use Post-Training
- If the base model already solves your task reliably (check first)
- If you lack curated data or a reliable reward signal
- If the task is better handled by retrieval, tool use, or prompt engineering
- If compute budget is extremely tight and quantization/distillation suffices

## Further Reading

- **AI Engineering by Chip Huyen** — Clear framing of pre-training vs. fine-tuning vs. post-training, with the 98% compute statistic for InstructGPT [S1]
- **OPSD-V: On-Policy Self-Distillation for Post-Training Few-Step Autoregressive Video Generators** — Dense trajectory supervision for video [S4]
- **The Regression Tax: Decomposing Why Skills Help and Hurt LLM Agents** — Rigorous measurement of skill-induced regressions [S5]
- **PoEM: Predicting RL Outcomes from Existing Policies** — Avoiding re-running RL for new rewards [S6]
- **Learning to Stop without Learning to Stop** — Self-supervised confidence training for reasoning efficiency [S7]
- **Post-Training Language Models for Gold-Medal Performance in Coding Competitions** — End-to-end SFT+RL pipeline with test-time compute [S8]
- **Read It Back: Pretrained MLLMs Are Zero-Shot Reward Models** — SpectraReward and Self-SpectraReward for image generation [S9]
- **Pass the Baton: Trajectory-Relayed On-Policy Distillation** — Relay-OPD for reasoning distillation [S14]
- **Toward Skill-Native LLMs: Skill Entropy** — Benchmarking and training for cross-skill long-horizon reasoning [S13]
- **PAST-Bench: Benchmarking Recursive Self-Improvement in Personal Agents** — Measuring retained experience gains [S11]

## References

- S1: AI Engineering by Chip Huyen — pack://ai-engineering-by-chip-huyen
- S2: Intervention-Aware Clinical World Model for Post-Op Outcome Forecasting in Cardiology — https://arxiv.org/abs/2608.13518v1
- S3: StudentBench: AI and human tutoring yield equivalent GRE learning gains — https://arxiv.org/abs/2609.28470v1
- S4: OPSD-V: On-Policy Self-Distillation for Post-Training Few-Step Autoregressive Video Generators — https://arxiv.org/abs/2607.08766v1
- S5: The Regression Tax: Decomposing Why Skills Help and Hurt LLM Agents — https://arxiv.org/abs/2607.22520v1
- S6: PoEM: Predicting RL Outcomes from Existing Policies — https://arxiv.org/abs/2609.30226v1
- S7: Learning to Stop without Learning to Stop: Self-Supervised Confidence Training Improves Reasoning Efficiency — https://arxiv.org/abs/2609.31619v1
- S8: Post-Training Language Models for Gold-Medal Performance in Coding Competitions — https://arxiv.org/abs/2609.02849v1
- S9: Read It Back: Pretrained MLLMs Are Zero-Shot Reward Models for Text-to-Image Generation — https://arxiv.org/abs/2607.11886v1
- S11: PAST-Bench: Benchmarking the Foundations of Recursive Self-Improvement in Personal Agents — https://arxiv.org/abs/2608.04003v1
- S13: Toward Skill-Native LLMs: Skill Entropy for Benchmarking and Training Long-Horizon Reasoning — https://arxiv.org/abs/2608.05139v1
- S14: Pass the Baton: Trajectory-Relayed On-Policy Distillation — https://arxiv.org/abs/2607.26057v1
