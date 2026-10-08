---
title: "Reinforcement Learning: A Definitive Explainer"
description: "How agents learn optimal behavior through trial, error, and scalar rewards \u2014 without a supervisor."
date: "2026-09-28"
format: "explainer"
concept: "Reinforcement learning"
tldr: ["RL frames learning as an agent interacting with an environment to maximize cumulative reward, not by imitating examples but by discovering what works.", "The core loop: observe state, take action, receive reward, update policy \u2014 repeated until the policy is near-optimal.", "Key algorithms differ in how they estimate value (critic) and update the policy (actor), and whether they learn a model of the environment.", "RL excels where the reward signal is clear but optimal actions are not \u2014 games, robotics, control, and increasingly LLM alignment.", "Sample inefficiency, reward hacking, and instability remain the main engineering hurdles; use supervised learning when you have labeled data."]
references: ["S1: The Little Book of Reinforcement Learning \u2014 https://github.com/alxndrTL/little-book-rl/", "S2: Artificial Intelligence: A Modern Approach (Russell & Norvig) \u2014 Chapter 21", "S3: AI Engineering (Chip Huyen) \u2014 RL for LLM post-training", "S4: The Rise of Verbal Reinforcement Learning \u2014 https://arxiv.org/abs/2609.01597v1", "S5: Physics-enhanced reinforcement learning for real-time optimal control \u2014 https://arxiv.org/abs/2607.16177v1", "S6: Do You Really Need to Pretrain Q-Functions for Online RL Fine-Tuning? \u2014 https://arxiv.org/abs/2607.27203v1", "S7: Q-based Variational Inverse Reinforcement Learning \u2014 https://arxiv.org/abs/2608.16888v1", "S8: RetireOPD: Self-Retiring On-Policy Distillation \u2014 https://arxiv.org/abs/2609.20784v1", "S9: Latent Memory Palace \u2014 https://arxiv.org/abs/2607.08724v1", "S10: OSReward \u2014 https://arxiv.org/abs/2607.28609v1", "S11: CompactionRL \u2014 https://arxiv.org/abs/2607.05378v1", "S12: Entropy-Regularized Rank-Masked Policy Optimization \u2014 https://arxiv.org/abs/2609.09135v1", "S13: A Framework for Designing Reward Functions \u2014 https://arxiv.org/abs/2608.12302v1", "S14: PoEM: Predicting RL Outcomes from Existing Policies \u2014 https://arxiv.org/abs/2609.30226v1"]
writer: "openrouter/nvidia/nemotron-3-ultra-550b-a55b:free"
fact_check: "passed"
diagram: "2026-09-28-reinforcement-learning-a-definitive-explainer.json"
---

## What It Is

Reinforcement learning (RL) is a paradigm in which an **agent** learns to make decisions by interacting with an **environment**. At each step the agent observes a **state**, selects an **action**, and receives a scalar **reward** along with the next state. The agent's goal is to learn a **policy** — a mapping from states to actions — that maximizes the expected sum of future rewards, often discounted so that near-term rewards matter more.

Unlike supervised learning, there is no dataset of correct input–output pairs. Unlike unsupervised learning, there is a clear objective: maximize reward. The agent must **explore** to discover rewarding behaviors and **exploit** what it already knows. This tension — the exploration–exploitation trade-off — is the heartbeat of RL.

Russell and Norvig capture the intuition: imagine playing a new game whose rules you don't know; after a hundred moves your opponent announces, "You lose." That sparse, delayed signal is all the agent gets [S2]. From it, the agent must infer which earlier moves were good or bad — a **credit assignment** problem.

## Why It Matters

RL solves problems where:
- The optimal behavior is not known in advance (so you cannot label data).
- The environment is sequential: today's action affects tomorrow's state.
- A scalar reward signal is available or can be designed.

Classic examples include game playing (where evaluating a board position is hard but win/loss is clear), helicopter flight (where crashing is easy to penalize but the correct control inputs are not), and robotics [S2]. In modern AI, RL is the workhorse for **post-training alignment** of large language models: given a reward model that scores outputs, RL fine-tunes the policy to maximize that score [S3].

## How It Works: The Core Loop

### Components
- **State (s)**: The information available to the agent at a time step.
- **Action (a)**: The agent's choice.
- **Reward (r)**: A scalar feedback signal.
- **Transition dynamics**: The (usually unknown) probability distribution over next states given current state and action.
- **Policy (π)**: The agent's strategy, π(a|s). Can be deterministic or stochastic.
- **Value function (V)**: Expected return from a state under the current policy.
- **Action-value function (Q)**: Expected return from taking action a in state s, then following π.
- **Model (optional)**: The agent's internal representation of transition dynamics and reward function.

### The Interaction Cycle
1. Agent observes state s_t.
2. Agent samples action a_t ~ π(·|s_t).
3. Environment emits reward r_t and next state s_{t+1}.
4. Agent stores (s_t, a_t, r_t, s_{t+1}) and updates its policy/value estimates.
5. Repeat.

### A Concrete Example: Gridworld
Imagine a 4×4 grid. The agent starts at (0,0); the goal is (3,3) with reward +1; a trap at (1,2) gives -1; all other steps give -0.04 (encouraging speed). The agent doesn't know the layout. It tries random moves, bumps into walls (state unchanged), eventually stumbles into the goal. It learns that states near the goal have high value, and propagates that value backward — **temporal difference learning**. After thousands of episodes, the policy becomes a near-optimal path.

### Model-Free vs. Model-Based
- **Model-free**: Learns policy or value functions directly from experience (e.g., Q-learning, policy gradients). Simpler, but sample-inefficient.
- **Model-based**: Learns a model of the environment, then plans or simulates experience. More sample-efficient but suffers from model bias.

### Value-Based vs. Policy-Based vs. Actor-Critic
- **Value-based** (DQN, Q-learning): Learn Q(s,a), derive policy by acting greedily (or ε-greedily).
- **Policy-based** (REINFORCE): Parameterize π_θ(a|s) and ascend the gradient of expected return.
- **Actor-Critic** (A2C, PPO): Maintain both a policy (actor) and a value function (critic). The critic reduces variance of the policy gradient. **Proximal Policy Optimization (PPO)** clips the policy update to prevent destructive large steps; it is the dominant algorithm for LLM fine-tuning [S3].

## Key Techniques and Variants

### Temporal Difference (TD) Learning
Updates value estimates toward a one-step target: V(s) ← V(s) + α[r + γV(s') - V(s)]. Combines bootstrapping (using current estimates) with sampling.

### Deep Q-Networks (DQN)
Uses a neural network to approximate Q(s,a). Stabilized by **experience replay** (breaking correlation) and **target networks** (slow-moving target for the Bellman update).

### Policy Gradients & PPO
Directly optimize π_θ via ∇_θ J(θ) = E[∇_θ log π_θ(a|s) · A(s,a)], where A is the advantage. PPO constrains the KL divergence between old and new policies via a clipped surrogate objective.

### Inverse Reinforcement Learning (IRL)
Infers the reward function from expert demonstrations, rather than specifying it by hand. **QVIRL** (Q-based Variational IRL) learns a posterior over rewards by learning a variational distribution over optimal Q-values, enabling uncertainty quantification and scaling to pixel observations [S7].

### Verbal Reinforcement Learning (VRL)
A rising paradigm where natural language serves as feedback. Three pillars [S4]:
1. **Language as Grounding Signal** — language defines goals, states, rewards.
2. **Language as Deliberative Feedback** — language guides reasoning at test time without parameter updates.
3. **Language as Learning Signal** — language-based feedback shapes parameters through training.

### Physics-Enhanced RL (PEARL)
For dynamical systems, PEARL exploits differentiable physics: an actor-adjoint algorithm uses automatic differentiation for short-horizon policy gradients and adjoint-based sensitivities for long-horizon returns, dramatically improving sample efficiency [S5].

### Q-Function Pretraining — or Not
Conventional wisdom says pretrain the Q-function on offline data before online fine-tuning. Recent work shows naive Q-pretraining often helps little because the pretrained Q targets the pretrained policy's Q, not the fine-tuned policy's Q. **IPE** (Initialization via Policy Ensemble) trains diverse policies and pools their rollouts to bootstrap Q-learning, yielding a 1.26× average improvement on continuous control benchmarks [S6].

### On-Policy Distillation for Agents
Multi-turn agents get a single scalar reward per trajectory. **RetireOPD** trains a skill-conditioned teacher with environment rewards, then distills into a skill-free student with adaptive retirement: the student drops the teacher once their discrepancy stops shrinking and it reaches a target fraction of the teacher's success rate. On ALFWorld, RetireOPD improves success rates by 14.1–18.8%; on WebShop, accuracy by 11.8–19.0% [S8].

### Latent Reasoning for Control
**Latent Memory Palace (LMP)** formulates reasoning as variational inference in an autoregressive latent space, enabling adaptive test-time compute allocation for continuous control [S9].

### Context Compaction for Long-Horizon Agents
**CompactionRL** jointly optimizes task execution and summary generation with token-level loss normalization and cross-trajectory generalized advantage estimation. On GLM-4.5-Air (106B-A30B), it achieves 66.8% Pass@1 on SWE-bench Verified (+7.0) and 24.5% on Terminal-Bench 2.0 (+3.1) [S11].

### Test-Time RL for Code Generation
**ERPO** (Entropy-Regularized Rank-Masked Policy Optimization) uses probe-driven rewards: execute candidate programs on generated inputs, define a Probe Consensus Reward from behavioral agreement, then apply rank masking and an entropy ceiling to prevent reward hacking [S12].

### Reward Design Framework
A formal process to derive human-aligned reward functions: distill objectives into measurable outcome variables, select a causally representative subset via minimum-cost partial cover on a causal DAG, fit weights via preference elicitation as a convex feasibility problem [S13].

### Predicting RL Outcomes Without Training
**PoEM** predicts the policy resulting from RL on a new reward function by linearly combining log-policies of models trained on existing rewards — even when rewards aren't linearly related, log-policies often span a low-rank subspace [S14].

## Applications

- **Game playing**: Atari, Go, StarCraft, Dota 2 — RL agents exceed human performance.
- **Robotics & control**: Legged locomotion, manipulation, flight control (helicopters, quadrotors). Physics-enhanced RL (PEARL) shows promise for high-dimensional dynamical systems [S5].
- **LLM alignment**: RLHF (RL from Human Feedback) and RLAIF (RL from AI Feedback) use PPO to maximize reward model scores [S3].
- **Agentic systems**: Web navigation (WebShop), embodied instruction following (ALFWorld), code generation (SWE-bench, Terminal-Bench) [S8, S11].
- **Computer-use agents**: Evaluated via VLM judges; **OSReward** benchmark reveals systematic leniency bias in current judges [S10].
- **Recommendation & advertising**: Sequential decision problems with delayed rewards.
- **Resource scheduling**: Data-center cooling, traffic light control, inventory management.

## Trade-offs and Limitations

### Sample Inefficiency
Model-free RL often requires millions of environment interactions. Model-based and physics-enhanced methods mitigate this but add complexity [S5].

### Reward Hacking
Agents exploit misspecified rewards (e.g., a cleaning robot sweeping dirt under the rug). Probe-driven rewards and entropy regularization (ERPO) are partial defenses [S12].

### Instability
Policy gradients can collapse; value estimates can diverge. PPO's clipping, target networks, and careful normalization are engineering necessities, not optional.

### Exploration in Large Spaces
ε-greedy works for small discrete actions; continuous or combinatorial spaces need structured exploration (noise injection, curiosity, ensembles).

### Sim-to-Real Gap
Policies trained in simulation often fail in the real world due to dynamics mismatch. Domain randomization and system identification help.

### Evaluation Difficulty
For open-ended tasks (code, web agents), automatic evaluation is itself an unsolved problem. VLM judges are unreliable and biased [S10].

### When NOT to Use RL
- You have a high-quality labeled dataset → supervised learning is faster and more stable.
- The reward signal is noisy, sparse, or adversarial → consider imitation learning or IRL.
- The problem is one-step (no sequential dependence) → bandits or supervised learning suffice.
- You need strong safety guarantees during learning → RL's exploration is inherently risky; use constrained RL or simulators.

## Further Reading

- **The Little Book of Reinforcement Learning** — a concise, code-first introduction [S1]
- **Artificial Intelligence: A Modern Approach (Russell & Norvig), Chapter 21** — the canonical textbook treatment [S2]
- **AI Engineering (Chip Huyen)** — practical RL for LLM post-training, PPO, reward models [S3]
- **The Rise of Verbal Reinforcement Learning** — taxonomy of language-as-feedback [S4]
- **Physics-Enhanced RL (PEARL)** — differentiable physics for sample-efficient control [S5]
- **Do You Really Need to Pretrain Q-Functions?** — IPE for online fine-tuning [S6]
- **Q-based Variational IRL (QVIRL)** — Bayesian IRL with uncertainty [S7]
- **RetireOPD** — adaptive on-policy distillation for agents [S8]
- **Latent Memory Palace** — variational latent reasoning for control [S9]
- **OSReward** — benchmark for VLM judges of computer-use agents [S10]
- **CompactionRL** — context compaction for long-horizon agentic LLMs [S11]
- **ERPO** — test-time RL for code generation via probe consensus [S12]
- **A Framework for Designing Reward Functions** — formal reward design from objectives to human-aligned weights [S13]
- **PoEM** — predicting RL outcomes from existing policies [S14]

## References

- S1: The Little Book of Reinforcement Learning — https://github.com/alxndrTL/little-book-rl/
- S2: Artificial Intelligence: A Modern Approach (Russell & Norvig) — Chapter 21
- S3: AI Engineering (Chip Huyen) — RL for LLM post-training
- S4: The Rise of Verbal Reinforcement Learning — https://arxiv.org/abs/2609.01597v1
- S5: Physics-enhanced reinforcement learning for real-time optimal control — https://arxiv.org/abs/2607.16177v1
- S6: Do You Really Need to Pretrain Q-Functions for Online RL Fine-Tuning? — https://arxiv.org/abs/2607.27203v1
- S7: Q-based Variational Inverse Reinforcement Learning — https://arxiv.org/abs/2608.16888v1
- S8: RetireOPD: Self-Retiring On-Policy Distillation — https://arxiv.org/abs/2609.20784v1
- S9: Latent Memory Palace — https://arxiv.org/abs/2607.08724v1
- S10: OSReward — https://arxiv.org/abs/2607.28609v1
- S11: CompactionRL — https://arxiv.org/abs/2607.05378v1
- S12: Entropy-Regularized Rank-Masked Policy Optimization — https://arxiv.org/abs/2609.09135v1
- S13: A Framework for Designing Reward Functions — https://arxiv.org/abs/2608.12302v1
- S14: PoEM: Predicting RL Outcomes from Existing Policies — https://arxiv.org/abs/2609.30226v1
