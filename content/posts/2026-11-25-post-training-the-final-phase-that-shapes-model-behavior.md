---
title: "Post-Training: The Final Phase That Shapes Model Behavior"
description: "A technical explainer on post-training \u2014 what it is, why it matters, how RL and alignment techniques work, and where they're applied."
date: "2026-11-25"
format: "explainer"
concept: "post-training"
tldr: ["Post-training is the phase after pre-training where model weights are updated to align behavior with specific objectives like instruction following, safety, or domain expertise.", "It typically uses reinforcement learning (RLHF, DPO, GRPO) or supervised fine-tuning on curated data, consuming far less compute than pre-training.", "Research shows post-training often changes how models read out existing representations rather than learning new ones, and can introduce regressions.", "Key challenges include coverage collapse in RL, reward hacking, and the regression tax where new skills break existing capabilities.", "Emerging techniques like activation steering, policy prediction (PoEM), and online value-guided learning (VaM) aim to make post-training more efficient and controllable."]
references: ["S1: AI Engineering by Chip Huyen \u2014 pack://ai-engineering-by-chip-huyen", "S2: RL Post-Training in Diffusion Transformers Is Activation Steering \u2014 https://arxiv.org/abs/2611.26627v1", "S3: Represented but Misread: Post-Training Changes How Language Models Read Out What They Represent \u2014 https://arxiv.org/abs/2611.26584v1", "S4: What Matters in Quality-Aware VLA Pretraining \u2014 https://arxiv.org/abs/2610.18869v1", "S5: Continual-ARC: Measuring Skill Acquisition over a Working Lifetime \u2014 https://arxiv.org/abs/2611.14505v1", "S6: Intervention-Aware Clinical World Model for Post-Op Outcome Forecasting in Cardiology \u2014 https://arxiv.org/abs/2608.13518v1", "S7: What Improves During Pretraining? \u2014 https://arxiv.org/abs/2610.37631v1", "S8: A Theory of Policy Optimization in Post-Training: Coverage Collapse and Reference Resets \u2014 https://arxiv.org/abs/2611.14467v1", "S9: StudentBench: AI and Human Tutoring Yield Equivalent GRE Learning Gains \u2014 https://arxiv.org/abs/2609.28470v1", "S10: OPSD-V: On-Policy Self-Distillation for Post-Training Few-Step Autoregressive Video Generators \u2014 https://arxiv.org/abs/2607.08766v1", "S11: Sherpa: Teaching LLMs to Teach Adaptively \u2014 https://arxiv.org/abs/2610.08778v1", "S12: The Regression Tax: Decomposing Why Skills Help and Hurt LLM Agents \u2014 https://arxiv.org/abs/2607.22520v1", "S13: PoEM: Predicting RL Outcomes from Existing Policies \u2014 https://arxiv.org/abs/2609.30226v1", "S14: Value as Memory: Online Value-Guided Post-Training for General Robot Policies \u2014 https://arxiv.org/abs/2610.22368v1"]
writer: "openrouter/nvidia/nemotron-3-ultra-550b-a55b:free"
fact_check: "passed"
diagram: "2026-11-25-post-training-the-final-phase-that-shapes-model-behavior.json"
---

## What Post-Training Is

Post-training is the phase in a model's lifecycle where a pre-trained model — already knowledgeable about language, vision, or both — has its weights updated to behave in specific ways. Pre-training teaches a model *what* the world looks like (statistical structure of data). Post-training teaches it *how* to act: follow instructions, refuse harmful requests, write code in a particular style, or generate videos with coherent motion.

The term distinguishes this phase from pre-training (random initialization to a capable base model) and from traditional fine-tuning (adapting to a narrow task). In practice, the boundaries blur: supervised fine-tuning (SFT) on instruction data is often called post-training, as is the subsequent reinforcement learning from human feedback (RLHF). What unifies them is **changing model weights after the main pre-training run to optimize for a behavioral objective**.

An analogy: pre-training is like a student reading the entire library. Post-training is the apprenticeship — practicing specific tasks under supervision, getting feedback, and internalizing norms of good performance.

Chip Huyen notes that for InstructGPT, pre-training consumed ~98% of total compute and data resources [S1]. Post-training is relatively cheap but disproportionately shapes the model users actually experience.

## Why It Matters

A raw pre-trained model completes text. It doesn't answer questions, follow formatting constraints, or reliably avoid hallucinations. Post-training bridges the gap between "predicts next token" and "useful assistant."

It solves three concrete problems:

1. **Format and instruction adherence**: Base models mimic the training corpus. If the corpus contains dialogues, the model dialogues. If it contains code, it codes. Post-training makes instruction-following reliable across diverse prompts.
2. **Alignment with human preferences**: Models learn to prefer helpful, harmless, honest outputs — not just statistically probable ones.
3. **Domain specialization**: A general model can be post-trained for medicine, law, robotics, or video generation without re-running pre-training.

The leverage is high: a few thousand preference pairs or a few RL epochs can flip a model from "autocomplete" to "assistant." But the changes are not always what they seem.

## How It Works: Mechanisms and a Concrete Walkthrough

### The Core Loop

Most post-training follows a three-stage pipeline:

1. **Supervised Fine-Tuning (SFT)**: Train on high-quality (prompt, response) pairs. The model learns the *form* of desired outputs.
2. **Reward Model Training**: Train a separate model to score (prompt, response) pairs according to human preferences.
3. **Policy Optimization**: Use reinforcement learning to maximize the reward model score while staying close to the SFT model (KL regularization).

### Concrete Example: RLHF for a Chat Model

Start with a pre-trained LLM (e.g., 7B parameters).

**Step 1 — SFT**: Collect 50k–100k prompts with expert-written responses. Fine-tune the model for 1–3 epochs. The model now speaks in the right style but may still hallucinate or be sycophantic.

**Step 2 — Reward Model**: Collect 100k–1M comparisons: for each prompt, humans rank 2–4 model outputs. Train a regression head on the frozen LLM to predict a scalar reward. This model encodes "what humans like."

**Step 3 — PPO/GRPO**: Initialize the policy as the SFT model. For each batch of prompts, generate responses, score them with the reward model, and update the policy via policy gradient (PPO) or group-relative policy optimization (GRPO). A KL penalty keeps the policy from drifting too far from the SFT reference.

After ~100–500 optimization steps, the model scores higher on human evaluations.

### What Actually Changes Inside the Model

Research using linear probes and signal detection theory shows that post-training **primarily changes how representations are read out, not what is represented** [S3]. For a task like detecting AI-written German text, internal representations already separate the classes (probes achieve high accuracy), but the base model's *answers* fail to use this information. Post-training repairs the readout — but can also degrade sensitivity (Δd' = -0.34 on average across model families) [S3]. The shift occurs during SFT, implicates early layers, and transfers via mid-depth positions after the input text [S3].

In diffusion transformers, RL post-training for visual quality and text rendering can be largely replicated by **activation steering**: adding fixed, prompt-independent vectors to block outputs [S2]. On SD3.5-M, steering vectors with 0.29M parameters (65× fewer than the 18.8M LoRA) recover 90.0–96.3% of reward gains across six image models [S2]. This suggests much of RL's effect is a constant bias shift toward capabilities the base model already possesses.

## Key Techniques and Variants

| Technique | Mechanism | Typical Use | Notes |
|---|---|---|--|
| **SFT only** | Supervised learning on curated (prompt, response) | Instruction tuning, style transfer | Simple, no reward model needed |
| **RLHF (PPO)** | Policy gradient with KL penalty vs. SFT reference | Chat alignment, safety | Compute-heavy; prone to coverage collapse [S8] |
| **DPO / IPO / KTO** | Direct preference optimization — no reward model, no RL loop | Same as RLHF, cheaper | Optimizes a closed-form objective on preference pairs |
| **GRPO** | Group-relative policy optimization — no critic, uses group statistics | Large-scale RL (DeepSeek-R1 style) | Lower memory; still faces coverage collapse |
| **Activation Steering** | Add fixed vectors to activations at inference/training | Diffusion models, efficient alignment | 65× fewer params, recovers ~90%+ of RL gains [S2] |
| **Policy Prediction (PoEM)** | Predict new RL policy as linear combo of existing log-policies | Rapid reward exploration | Avoids re-running RL for each reward [S13] |
| **Online Value-Guided (VaM)** | Cache value predictions as memory; online RL with sparse rewards | Robotics, long-horizon tasks | 29.4% gain with caching, 32.8% with online RL [S14] |
| **On-Policy Self-Distillation (OPSD-V)** | Teacher with real-video context corrects student's AR rollout | Few-step video generation | Preferred 66% in user study [S10] |
| **Adaptive Teaching (Sherpa)** | Multi-turn RL with simulated student archetypes | Tutoring, pedagogy | +20.5 pp student performance [S11] |

### Coverage Collapse and Reference Resets

A fundamental problem in policy-gradient post-training: **coverage collapse**. REINFORCE (the basis for PPO and GRPO) can drive the probability of optimal responses toward zero even as reward improves [S8]. The policy stops exploring good responses it once generated, stalling optimization. KL regularization to the base model does not prevent this.

The fix: **reference resets**. Instead of anchoring KL to the original SFT model, repeatedly reset the reference to the most recent policy. This is formalized in **Approximate Policy Mirror Descent (APMD)**, a meta-algorithm that solves a sequence of KL-regularized subproblems [S8]. Each subproblem is easier (stronger regularization works), and resets allow convergence to global optimality. APMD yields coverage-preserving algorithms — total samples and gradient steps governed by the base model's initial coverage of optimal responses.

## Applications

### Language Models
- **Chat assistants**: Instruction tuning + RLHF (ChatGPT, Claude, Llama-Instruct)
- **Code specialists**: Post-train base models on code + execution feedback (CodeLlama, DeepSeek-Coder)
- **Reasoning models**: Long CoT + RL on verifiable rewards (math, coding) — e.g., DeepSeek-R1, o1-style models
- **Tutoring**: Sherpa trains teachers via RL on simulated students, raising pedagogy scores from 52.5% to 79.2% [S11]

### Diffusion and Video Models
- **Image quality**: RL post-training improves text rendering, composition, aesthetics (SD3.5, FLUX variants) [S2]
- **Video generation**: OPSD-V uses on-policy self-distillation with real-video context to fix error accumulation in autoregressive rollout, improving VBenchLong scores [S10]

### Robotics and Embodied AI
- **Generalist policies**: VaM combines value caching (recent value predictions as task-progress memory) with online RL from sparse rewards. On long-horizon deformable-object and contact-rich tasks, value caching alone yields +29.4% success rate; online autonomous learning adds +32.8% over matched offline training [S14]. The online schedule runs 8× more policy iterations per gradient step with 2× lower wall-clock time.
- **Vision-Language-Action (VLA)**: Quality-aware pretraining (conditioning, filtering, weighting) followed by target-task fine-tuning. Simulation pretraining raises real-world success from 9.6% to 31.7% [S4].

### Clinical and Specialized Domains
- **Post-op forecasting**: Intervention-aware world models encode baseline imaging into 3D latent state, evolve through irregular post-procedure events. Achieves AUROC 0.756, AUPRC 0.777 for atrial fibrillation ablation recurrence [S6].

## Trade-offs and Limitations

### The Regression Tax
Adding capabilities can break existing ones. Across ~6,000 agent runs on office automation benchmarks, the best skills outperformed others primarily by **regressing less**, not by gaining more [S12]. Three mechanisms:
1. **Skill description osmosis**: A skill's mere presence in context changes behavior, even uninvoked.
2. **Grounding displacement**: The skill's prescribed procedure overrides the agent's input interpretation.
3. **Verification displacement**: The procedure suppresses checks the agent would otherwise perform.

Post-training evaluations must measure regressions, not just average improvement.

### Coverage Collapse and Optimization Instability
As noted, standard RLHF can collapse the policy's support on optimal responses [S8]. This is not a bug in implementation — it's a property of the objective. Reference resets (APMD) mitigate it but add complexity.

### Reward Hacking and Misalignment
The reward model is a proxy. Optimizing it too hard yields outputs that score high but are actually worse (verbose, sycophantic, exploitative). KL penalties help but don't eliminate the problem.

### Data Quality and Quantity
SFT and reward modeling need high-quality human data. Scaling this is expensive and introduces annotator biases. Synthetic data helps but can amplify model errors.

### Compute vs. Control
Full RLHF (PPO) needs multiple models (policy, reference, reward, critic) and complex infrastructure. DPO/GRPO reduce this but may converge to different optima. Activation steering and PoEM offer extreme efficiency but less flexibility.

### When NOT to Use Post-Training
- **You need new knowledge, not new behavior**: If the model lacks facts, use RAG or continued pre-training.
- **The base model is too weak**: Post-training amplifies accessible capabilities. If the base model never generates a correct reasoning trace, RL cannot find it (coverage = 0).
- **Rapid iteration on reward functions**: Each reward change traditionally requires re-running RL. PoEM [S13] changes this but is not yet standard.
- **Safety-critical systems without verification**: Post-training can introduce subtle regressions. Formal verification or heavy testing is needed.

## Further Reading

- **AI Engineering by Chip Huyen** — Part 51: Clear framing of pre-training vs. fine-tuning vs. post-training, with the 98% compute statistic for InstructGPT [S1]
- **RL Post-Training in Diffusion Transformers Is Activation Steering** (arXiv:2611.26627) — Steering vectors recover 90%+ of RL gains with 65× fewer parameters [S2]
- **Represented but Misread: Post-Training Changes How Language Models Read Out What They Represent** (arXiv:2611.26584) — Probe vs. answer analysis showing readout changes, sensitivity loss, SFT-stage shift [S3]
- **A Theory of Policy Optimization in Post-Training: Coverage Collapse and Reference Resets** (arXiv:2611.14467) — Formal analysis of coverage collapse, APMD, reference resets [S8]
- **OPSD-V: On-Policy Self-Distillation for Post-Training Few-Step Autoregressive Video Generators** (arXiv:2607.08766) — Video post-training with real-video context, 66% user preference [S10]
- **Sherpa: Teaching LLMs to Teach Adaptively** (arXiv:2610.08778) — Multi-turn RL with simulated students, +20.5 pp gains [S11]
- **PoEM: Predicting RL Outcomes from Existing Policies** (arXiv:2609.30226) — Linear combination of log-policies predicts new RL results without training [S13]
- **Value as Memory: Online Value-Guided Post-Training for General Robot Policies** (arXiv:2610.22368) — VaM framework, +29.4%/+32.8% success rates, 8× iteration speedup [S14]
- **The Regression Tax: Decomposing Why Skills Help and Hurt LLM Agents** (arXiv:2607.22520) — Regressions dominate skill evaluation, three causal mechanisms [S12]
- **What Matters in Quality-Aware VLA Pretraining** (arXiv:2610.18869) — Conditioning, filtering, weighting for robotics, simulation-to-real transfer [S4]

## References

- S1: AI Engineering by Chip Huyen — pack://ai-engineering-by-chip-huyen
- S2: RL Post-Training in Diffusion Transformers Is Activation Steering — https://arxiv.org/abs/2611.26627v1
- S3: Represented but Misread: Post-Training Changes How Language Models Read Out What They Represent — https://arxiv.org/abs/2611.26584v1
- S4: What Matters in Quality-Aware VLA Pretraining — https://arxiv.org/abs/2610.18869v1
- S5: Continual-ARC: Measuring Skill Acquisition over a Working Lifetime — https://arxiv.org/abs/2611.14505v1
- S6: Intervention-Aware Clinical World Model for Post-Op Outcome Forecasting in Cardiology — https://arxiv.org/abs/2608.13518v1
- S7: What Improves During Pretraining? — https://arxiv.org/abs/2610.37631v1
- S8: A Theory of Policy Optimization in Post-Training: Coverage Collapse and Reference Resets — https://arxiv.org/abs/2611.14467v1
- S9: StudentBench: AI and Human Tutoring Yield Equivalent GRE Learning Gains — https://arxiv.org/abs/2609.28470v1
- S10: OPSD-V: On-Policy Self-Distillation for Post-Training Few-Step Autoregressive Video Generators — https://arxiv.org/abs/2607.08766v1
- S11: Sherpa: Teaching LLMs to Teach Adaptively — https://arxiv.org/abs/2610.08778v1
- S12: The Regression Tax: Decomposing Why Skills Help and Hurt LLM Agents — https://arxiv.org/abs/2607.22520v1
- S13: PoEM: Predicting RL Outcomes from Existing Policies — https://arxiv.org/abs/2609.30226v1
- S14: Value as Memory: Online Value-Guided Post-Training for General Robot Policies — https://arxiv.org/abs/2610.22368v1
