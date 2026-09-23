---
title: "On-policy distillation: definition, mechanisms, and applications"
description: "Explains on-policy distillation, its purpose, how it transfers dense token-level supervision from a teacher to a student using the student's own trajectories."
date: "2026-09-23"
format: "explainer"
concept: "On-policy distillation"
tldr: ["On-policy distillation (OPD) lets a student model learn from a teacher by generating its own trajectories and receiving dense token\u2011level feedback on each step.", "It addresses the sparsity of reinforcement\u2011learning rewards, improving sample efficiency and enabling smaller models to inherit capabilities of larger teachers.", "Core OPD alternates between student rollouts and teacher\u2011provided supervision, updating the student via a loss such as KL divergence between token distributions.", "Variants like Relay\u2011OPD, RetireOPD, and DemoPSD mitigate specific failure modes such as prefix failure, stale teacher signals, and privileged\u2011information leakage.", "Applications span mathematical reasoning, agentic tasks, diffusion\u2011based video control, and visual reasoning, with trade\u2011offs around compute, teacher quality, and convergence speed."]
references: ["S1: arXiv \u2014 Rethinking On-Policy Distillation of Large Language Models II: One Training Example (https://arxiv.org/abs/2609.04172v1)", "S2: arXiv \u2014 Pass the Baton: Trajectory-Relayed On-Policy Distillation (https://arxiv.org/abs/2607.26057v1)", "S3: arXiv \u2014 RetireOPD: Self-Retiring On-Policy Distillation for Agentic Reinforcement Learning (https://arxiv.org/abs/2609.20784v1)", "S4: arXiv \u2014 Rethinking Classifier-Free Guidance in On-Policy Diffusion Distillation (https://arxiv.org/abs/2607.24731v1)", "S5: arXiv \u2014 DemoPSD: Disagreement-Modulated Policy Self-Distillation (https://arxiv.org/abs/2607.02502v1)", "S6: arXiv \u2014 TurnSight: Turn-Level Hindsight Self-Distillation for Tool-Integrated Reasoning (https://arxiv.org/abs/2608.04007v1)", "S7: arXiv \u2014 Weak-to-Strong Generalization via Direct On-Policy Distillation (https://arxiv.org/abs/2607.05394v1)", "S8: arXiv \u2014 Visual Contrastive Self-Distillation (https://arxiv.org/abs/2607.21556v1)"]
writer: "openrouter/nvidia/nemotron-3-super-120b-a12b:free"
fact_check: "passed"
diagram: "2026-09-23-on-policy-distillation-definition-mechanisms-and-application.json"
---

## What it is
On-policy distillation (OPD) is a training paradigm where a student model generates rollouts using its current policy, and a teacher model provides dense token‑level supervision on those same rollouts. The student then updates its parameters to match the teacher’s token distributions, typically via a loss such as KL divergence. Intuitively, it is like an apprentice practicing a task while a master watches and gives feedback on each action, rather than only giving a score at the end.

## Why it matters
Reinforcement learning often supplies only a scalar reward per trajectory, making credit assignment difficult and requiring many samples to learn. OPD supplies a richer signal at every token, accelerating learning and allowing a smaller student to distill knowledge from a larger, more capable teacher. This is especially valuable when training large models is costly, as the student can improve by re‑using the teacher’s expertise without needing new environment interactions.

## How it works
The basic OPD loop proceeds as follows:
1. The student samples a trajectory (e.g., a sequence of tokens or actions) using its current policy.
2. The teacher, given the same prefix, produces a token‑level distribution (or action probabilities) for each step.
3. A loss measures the divergence between the student’s and teacher’s distributions at each token (commonly KL divergence or mean‑squared error on logits).
4. The student’s parameters are updated to reduce this loss, and the loop repeats.

A concrete example from language‑model reasoning: the student attempts to solve a math problem step by step. After each generated step, the teacher provides the likelihood of the next correct token, guiding the student toward better reasoning paths.

One‑shot OPD—training on a single query—keeps improving for hundreds of steps and recovers most of full‑data OPD’s gain across task domains and model families [S1]. A single query already reaches 71.5% state coverage, most of it within the first 100 steps [S1]. Adding semantically distinct queries raises coverage and validation accuracy together, until 16 queries reach 98.9% and match full‑data training [S1]. Alignment slows at a similar pace whether OPD trains on one query or the whole dataset, and even a fixed set of states takes hundreds of steps to absorb [S1]. Consequently, OPD is data‑overfed but algorithm‑starved: its rollouts quickly expose broad supervision, while the student absorbs that supervision increasingly slowly [S1]. The state‑coverage result extends to multi‑teacher OPD, where 16 semantically diverse queries per domain match full‑data MOPD [S1].

## Key techniques or variants
Several refinements address specific failure modes of vanilla OPD:

- **Relay‑OPD** (Pass the Baton) detects when the student commits to a wrong prefix and lets the teacher briefly take over to produce a corrective leg, after which the student resumes [S2]. With a Qwen3‑4B‑Instruct‑2507 teacher and Qwen3‑0.6B/1.7B‑Non‑Thinking students on eight mathematical reasoning benchmarks, Relay‑OPD achieves the best or second‑best results on every benchmark, outperforming standard OPD by +5.73% and the strongest baseline FastOPD by +1.49% on average for 1.7B, with consistent gains at 0.6B [S2]. Training trajectory length is reduced by over 50% [S2].

- **RetireOPD** (Self‑Retiring OPD) first trains a skill‑conditioned teacher with environment rewards, then jointly trains a skill‑free student with RL and OPD. The student drops the teacher via Adaptive Retirement once their discrepancy stops shrinking and it reaches a target fraction of the teacher’s success rate [S3]. Across Qwen2.5 models from 1.5B to 7B, RetireOPD improves ALFWorld success rate over RL baseline by 14.1% to 18.8% and WebShop accuracy by 11.8% to 19.0%, and surpasses its own skill‑conditioned teacher in every setting [S3].

- **Positive‑Direction Matching (PDM)** addresses Negative Branch Asymmetry (NBA) in diffusion models under classifier‑free guidance. The standard velocity‑matching objective is under‑identified at the branch level: positive‑ and negative‑branch errors can compensate in the guided prediction [S4]. This failure mode is termed Negative Branch Asymmetry (NBA) [S4]. PDM is a branch‑aware OPD objective that separately constrains the positive prediction and the CFG conditional direction to mitigate NBA [S4].

- **DemoPSD** (Disagreement‑Modulated Policy Self‑Distillation) steers the student toward a reverse‑KL barycenter target, a weighted geometric combination of the teacher and student distributions, balancing learning from the teacher with preserving the student’s own reasoning capacity [S5]. DemoPSD achieves leakage attenuation (mitigation of privileged information leakage) and exploration preservation [S5].

- **TurnSight** derives supervision from execution‑conditioned hindsight, builds multiple hindsight views with different lookahead horizons, and selects reliable supervision through cross‑horizon directional agreement [S6]. The selected hindsight signal is normalized across sibling rollouts and used to adaptively modulate RL advantages while preserving their original optimization direction [S6].

- **Direct‑OPD** transfers the weak model’s RL‑induced policy shift by comparing the post‑RL teacher with its own pre‑RL reference and treating their log‑ratio as a dense implicit reward for the student [S7]. Direct‑OPD boosts Qwen3‑1.7B from 48.3% to 62.4% on AIME 2024 in just 4 [S7].

- **VCSD** (Visual Contrastive Self‑Distillation) creates an on‑policy signal by contrasting the teacher’s next‑token distribution conditioned on the original image with one conditioned on a content‑erased control, sharpening the teacher’s distribution using the visual‑content‑specific likelihood difference [S8]. Using ViRL39K dataset, VCSD consistently outperforms matched OPSD across Qwen3‑VL and Qwen3.5 models; for example, on Qwen3‑VL it improves the seven‑benchmark aggregate from 62.27% → 67.04% at 2B [S8].

## Applications
OPD has been applied to a variety of domains:
- Mathematical reasoning: Relay‑OPD and Direct‑OPD show gains on benchmarks such as GSM8K, MATH, and AIME [S2, S7].
- Agentic reinforcement learning: RetireOPD improves performance in ALFWorld (a household‑task environment) and WebShop (a simulated e‑commerce environment) [S3].
- Diffusion models for video control: PDM enables stable OPD under classifier‑free guidance for dense‑to‑sparse video control tasks [S4].
- Visual reasoning in multimodal LLMs: VCSD enhances visual question answering and image‑captioning benchmarks [S8].
- Code generation and tool‑integrated reasoning: TurnSight provides turn‑level hindsight signals for tool‑using agents [S6].
- General LLM self‑distillation: DemoPSD mitigates privileged‑information leakage while preserving exploration [S5].

## Trade‑offs and limitations
Despite its strengths, OPD has notable constraints:
- It is data‑overfed but algorithm‑starved: rollouts quickly cover many states, yet the student absorbs supervision slowly, requiring hundreds of steps to converge [S1].
- Prefix failure can cause the student to persist in early mistakes, leading to unreliable supervision; methods like Relay‑OPD mitigate this but add complexity [S2].
- The quality of the teacher is crucial; a weak or biased teacher can transfer errors or privileged information that harms generalization [S5].
- In diffusion settings, naive OPD under classifier‑free guidance can induce antagonistic branch‑error dynamics (NBA) unless branch‑aware objectives like PDM are used [S4].
- Each OPD variant introduces additional hyper‑parameters (e.g., relay budget, retirement thresholds) that must be tuned for the target task.
- Compute overhead can be significant because the teacher must be queried at every training step, although techniques such as limited relay budgets or adaptive teacher retirement aim to reduce this cost.

## Further reading
The core ideas and empirical results discussed above are drawn from the following works:
- S1: arXiv — Rethinking On-Policy Distillation of Large Language Models II: One Training Example (https://arxiv.org/abs/2609.04172v1)
- S2: arXiv — Pass the Baton: Trajectory-Relayed On-Policy Distillation (https://arxiv.org/abs/2607.26057v1)
- S3: arXiv — RetireOPD: Self-Retiring On-Policy Distillation for Agentic Reinforcement Learning (https://arxiv.org/abs/2609.20784v1)
- S4: arXiv — Rethinking Classifier-Free Guidance in On-Policy Diffusion Distillation (https://arxiv.org/abs/2607.24731v1)
- S5: arXiv — DemoPSD: Disagreement-Modulated Policy Self-Distillation (https://arxiv.org/abs/2607.02502v1)
- S6: arXiv — TurnSight: Turn-Level Hindsight Self-Distillation for Tool-Integrated Reasoning (https://arxiv.org/abs/2608.04007v1)
- S7: arXiv — Weak-to-Strong Generalization via Direct On-Policy Distillation (https://arxiv.org/abs/2607.05394v1)
- S8: arXiv — Visual Contrastive Self-Distillation (https://arxiv.org/abs/2607.21556v1)

## References

- S1: arXiv — Rethinking On-Policy Distillation of Large Language Models II: One Training Example (https://arxiv.org/abs/2609.04172v1)
- S2: arXiv — Pass the Baton: Trajectory-Relayed On-Policy Distillation (https://arxiv.org/abs/2607.26057v1)
- S3: arXiv — RetireOPD: Self-Retiring On-Policy Distillation for Agentic Reinforcement Learning (https://arxiv.org/abs/2609.20784v1)
- S4: arXiv — Rethinking Classifier-Free Guidance in On-Policy Diffusion Distillation (https://arxiv.org/abs/2607.24731v1)
- S5: arXiv — DemoPSD: Disagreement-Modulated Policy Self-Distillation (https://arxiv.org/abs/2607.02502v1)
- S6: arXiv — TurnSight: Turn-Level Hindsight Self-Distillation for Tool-Integrated Reasoning (https://arxiv.org/abs/2608.04007v1)
- S7: arXiv — Weak-to-Strong Generalization via Direct On-Policy Distillation (https://arxiv.org/abs/2607.05394v1)
- S8: arXiv — Visual Contrastive Self-Distillation (https://arxiv.org/abs/2607.21556v1)
