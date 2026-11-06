---
title: "Muon: A Matrix-Structured Optimizer for Neural Network Training"
description: "Muon replaces elementwise adaptive steps with matrix-aware updates via orthogonalization, offering faster pretraining convergence but a fine-tuning reversal at scale."
date: "2026-11-06"
format: "explainer"
concept: "Muon"
tldr: ["Muon is a matrix-structured optimizer that orthogonalizes weight updates instead of scaling coordinates independently like AdamW.", "It accelerates pretraining loss reduction on LLMs, but AdamW overtakes it after fine-tuning once pretraining data crosses a threshold.", "In agentic RL, applying Muon only to hidden weight matrices can nearly double validation success rates under certain advantage estimators.", "SignMuon compresses updates to 1 bit per parameter; error feedback on the gradient (not the update) restores convergence guarantees.", "Variants MuonW, MuonH, and MuonGS add weight-norm control to fix vanilla Muon's logarithmic effective-learning-rate accumulation."]
references: ["S1: arXiv \u2014 Sign compression for Muon: SignMuon, MuonSign, and the Limits of Error Feedback \u2014 https://arxiv.org/abs/2607.29674v1", "S2: arXiv \u2014 Beyond Adam: SOAP and Muon for Faster, Label-Efficient Training of Machine Learning Interatomic Potentials \u2014 https://arxiv.org/abs/2607.02499v1", "S3: arXiv \u2014 Pretraining Data Scale Reverses the Muon-AdamW Fine-Tuning Gap \u2014 https://arxiv.org/abs/2611.03633v1", "S4: arXiv \u2014 When Does Muon Help Agentic Reinforcement Learning? \u2014 https://arxiv.org/abs/2607.16169v1", "S6: arXiv \u2014 MuonGS: Pretraining LLMs with Relaxed Weight-Norm Control \u2014 https://arxiv.org/abs/2610.37647v1"]
writer: "openrouter/nvidia/nemotron-3-ultra-550b-a55b:free"
fact_check: "passed"
diagram: "2026-11-06-muon-a-matrix-structured-optimizer-for-neural-network-traini.json"
---

## What Muon Is

Muon is a **matrix-structured optimizer** for training neural networks. Unlike AdamW, which maintains per-parameter learning rates by scaling each coordinate independently, Muon treats weight matrices as matrices. It computes an update direction, then **orthogonalizes** that direction (typically via a Newton–Schulz iteration or SVD) so the step stays on or near the Stiefel manifold of matrices with orthonormal rows/columns. The result is an update that respects the geometry of the weight matrix rather than treating it as a flat vector.

The core idea: a weight matrix \(W \in \mathbb{R}^{m \times n}\) has two natural geometries — the Euclidean geometry of its entries, and the spectral geometry of its singular values and vectors. AdamW operates in the first; Muon operates in the second. At each step, Muon computes a gradient \(G\), runs it through a **Linear Minimization Oracle (LMO)** that returns a matrix \(U\) of the same shape with orthonormal rows (or columns), and steps \(W \leftarrow W - \eta U\). The LMO is typically implemented by a few iterations of the Newton–Schulz method, which approximates the polar factor \(G (G^\top G)^{-1/2}\) without a full SVD [S1].

Intuition: imagine walking on a sphere. AdamW takes a step in the ambient space and projects back; Muon computes a tangent direction and walks along the great circle. For deep networks, the spectral geometry often matters more — singular values control signal propagation, and keeping updates orthogonal prevents pathological stretching or collapsing of directions.

## Why It Matters

The optimizer is one of the few levers that changes **how fast a model learns per token** without changing the model or data. Muon matters because:

1. **Faster pretraining convergence.** On LLM pretraining, Muon reduces training loss faster than AdamW at the same token budget [S3].
2. **Label efficiency in scientific ML.** For machine learning interatomic potentials (MLIPs), matrix-structured optimizers including Muon, SOAP, and SOAP-Muon substantially outperform Adam in both convergence speed and final accuracy, especially when force supervision is partial [S2].
3. **Communication efficiency.** The update \(U\) is already low-rank in structure; SignMuon compresses it to **one bit per parameter** by taking the elementwise sign, enabling matrix-aware optimization under extreme communication budgets [S1].
4. **RL post-training gains.** In sparse-reward agentic RL (ALFWorld, Qwen2.5-0.5B-Instruct), applying Muon only to hidden weight matrices raised final-window validation success from 0.290 to 0.546 (+88%) under Group-in-Group Policy Optimization (GiGPO) at learning rate 3e-5 [S4].

The catch: the pretraining advantage **reverses after fine-tuning** once pretraining data crosses a threshold. At larger data budgets, AdamW yields better downstream performance [S3].

## How It Works: A Concrete Walk-Through

Consider a transformer block with weight matrix \(W \in \mathbb{R}^{d_{\text{model}} \times d_{\text{ff}}}\). At step \(t\):

1. **Gradient.** Compute \(G_t = \nabla_W \mathcal{L}\).
2. **LMO (orthogonalization).** Run \(k\) Newton–Schulz iterations on \(G_t\):
   \[
   X_0 = G_t, \quad X_{i+1} = \frac{3}{2} X_i - \frac{1}{2} X_i X_i^\top X_i
   \]
   After a few iterations (typically 5), \(X_k\) approximates the polar factor \(U_t\) — a matrix with orthonormal rows that aligns with the gradient's row space.
3. **Step.** \(W_{t+1} = W_t - \eta_t U_t\).

No per-parameter second moments, no bias correction, no weight decay in the vanilla form. The orthogonalization *is* the preconditioning.

**Why Newton–Schulz?** A full SVD costs \(O(mn \min(m,n))\). Newton–Schulz uses only matrix multiplies (\(O(mn \max(m,n))\) per iteration) and converges quadratically near the solution. Five iterations are enough for practical precision.

**Where the sign goes (SignMuon).** For distributed training, you can compress \(U_t\) to \(\operatorname{sign}(U_t)\) — one bit per entry. S1 shows that **signing after the LMO** (MuonSign) works best empirically, even though it *diverges* on a constructed linear function. Signing *before* the LMO (MuonUSign) or on both sides also diverges on that instance. The provably convergent variants (EF21-MuonUSign, EF21-MuonSign) apply **error feedback to the gradient**, not the update, and achieve the standard \(\mathcal{O}(T^{-1/2})\) rate for smooth nonconvex problems. Yet in practice — CIFAR-10, federated CIFAR-10, nanoGPT speedrun — the *heuristic* sign-after-LMO consistently beats the provably convergent ones [S1].

## Key Variants

| Variant | Modification | Guarantee / Behavior |
|---|---|---|
| **Vanilla Muon** | Bare orthogonalized step | Accumulates effective learning rate \(C_T = \sum \eta_t / \|W_t\|_F\) only **logarithmically**; may limit exploration [S6]. |
| **MuonW** | Adds weight decay (decoupled, like AdamW) | Guarantees **at least linear** accumulation of \(C_T\) under bounded update directions [S6]. |
| **MuonH** | Hard weight-norm constraint (project onto sphere) | Also guarantees linear \(C_T\) accumulation [S6]. |
| **MuonGS** | Gram–Schmidt projection: remove radial component of each update, *without* fixing norm | Proves weight norm grows \(\le \mathcal{O}(\sqrt{t})\); guarantees \(C_T = \Omega(\sqrt{T})\) [S6]. |
| **SignMuon / MuonSign** | Compress update to 1 bit via elementwise sign | Sign-after-LMO (MuonSign) is empirically strongest; provably convergent variants need error feedback on the *gradient* [S1]. |
| **SOAP / SOAP-Muon** | Hybrid: SOAP (Shampoo-like preconditioning) + Muon orthogonalization | Most robust for MLIPs; Muon alone gives only partial gains over Adam [S2]. |

**MuonGS** is the newest design (S6). Instead of constraining the norm, it projects each update onto the tangent space of the current weight matrix via Gram–Schmidt: \(\Delta \leftarrow \Delta - W (W^\top W)^{-1} W^\top \Delta\). This removes the radial component, letting the norm grow slowly (\(\mathcal{O}(\sqrt{t})\)) while guaranteeing \(\Omega(\sqrt{T})\) effective learning rate accumulation — a middle ground between vanilla Muon's logarithmic stall and hard constraints.

## Applications

1. **LLM Pretraining.** Muon reduces pretraining loss faster than AdamW. The nanoGPT speedrun (a standard benchmark) shows MuonSign (sign-after-LMO) as the strongest compressed method [S1, S3].
2. **Fine-Tuning / Downstream Transfer.** **Caution:** beyond a critical pretraining token–parameter ratio, AdamW outperforms Muon after fine-tuning. The crossover moves to *smaller* ratios as model size grows [S3]. The paper explains this via the **margin-to-spread ratio**: Muon yields larger margins early; AdamW yields larger margins at scale.
3. **Agentic RL Post-Training.** On ALFWorld with Qwen2.5-0.5B-Instruct:
   - GiGPO + Muon on hidden weights: 0.290 → 0.546 success (+88%) at lr=3e-5 [S4].
   - GRPO + Muon: 0.161 → 0.268 at lr=3e-5 [S4].
   - GraphGPO + Muon at lr=1e-5: 0.901 success, AUC 0.399 → 0.556, reaches 0.5/0.75 success 30/60 updates earlier [S4].
   Effect depends on advantage estimator and learning rate; multi-seed validation is still open [S4].
4. **Scientific ML (MLIPs).** Training NequIP and Allegro models for interatomic potentials: SOAP and SOAP-Muon are consistently strong; Muon alone gives partial gains over Adam. Gains are **particularly pronounced under partial force supervision** [S2].
5. **Communication-Constrained / Federated Training.** SignMuon (1-bit updates) enables matrix-aware optimization over narrow links. Error feedback on the gradient (EF21-MuonSign) restores convergence guarantees at one bit each direction [S1].

## Trade-offs and Limitations

| Issue | Detail |
|---|---|
| **Fine-tuning reversal** | At large pretraining scale, AdamW wins downstream. Don't default to Muon if your pipeline ends with fine-tuning on massive data [S3]. |
| **Hyperparameter sensitivity** | RL results vary sharply with advantage estimator and learning rate. GiGPO benefits; GraphGPO saturates; GRPO helps modestly [S4]. |
| **Implementation complexity** | Newton–Schulz or SVD per matrix per step. More expensive than AdamW's elementwise ops; requires batched linear algebra kernels. |
| **Memory** | Stores no second-moment buffers (saves memory), but the orthogonalization may need temporary buffers for \(G G^\top\). |
| **Partial gains in some domains** | For MLIPs, Muon alone is weaker than SOAP or SOAP-Muon [S2]. |
| **Theory-practice gap for compression** | The *provably convergent* compressed variants (error feedback on gradient) trail the *heuristic* sign-after-LMO in experiments [S1]. |
| **Vanilla Muon stalls** | Without norm control, effective learning rate accumulates only logarithmically, slowing late training [S6]. Use MuonW, MuonH, or MuonGS. |

**When NOT to use Muon:**
- Small models or short runs where AdamW's simplicity wins.
- Fine-tuning-heavy pipelines with massive pretraining data — AdamW transfers better [S3].
- Settings where you cannot afford the linear-algebra overhead (e.g., CPU-only, tiny edge devices).
- When you need a drop-in replacement with zero hyperparameter search; Muon's LR schedule and norm-control variant need tuning.

## Further Reading

- **Sign compression & error feedback:** S1 — *Sign compression for Muon: SignMuon, MuonSign, and the Limits of Error Feedback* — proves divergence of sign-after-LMO, shows EF21 on gradient restores \(\mathcal{O}(T^{-1/2})\) rate, and reports empirical reversals on CIFAR-10 / nanoGPT.
- **Scientific ML (MLIPs):** S2 — *Beyond Adam: SOAP and Muon for Faster, Label-Efficient Training of Machine Learning Interatomic Potentials* — systematic comparison on NequIP/Allegro; SOAP-Muon most robust.
- **Pretraining vs. fine-tuning reversal:** S3 — *Pretraining Data Scale Reverses the Muon-AdamW Fine-Tuning Gap* — identifies token-parameter crossover, introduces margin-to-spread ratio, proves trend in linear associative memory.
- **Agentic RL:** S4 — *When Does Muon Help Agentic Reinforcement Learning?* — single-seed ALFWorld results across GiGPO/GRPO/GraphGPO; hidden-weight-only application; LR and estimator interactions.
- **Norm control theory & MuonGS:** S6 — *MuonGS: Pretraining LLMs with Relaxed Weight-Norm Control* — accumulated effective learning rate \(C_T\), logarithmic vs. linear vs. \(\sqrt{T}\) accumulation, Gram–Schmidt projection design.

## Key Facts
- Muon orthogonalizes gradient updates via a Linear Minimization Oracle (typically 5 Newton–Schulz iterations) instead of per-parameter adaptive scaling [S1].
- SignMuon compresses the Muon update to one bit per parameter by taking the elementwise sign after the LMO (MuonSign) [S1].
- Error feedback applied to the *gradient* (not the update) yields provably convergent EF21-MuonSign with \(\mathcal{O}(T^{-1/2})\) rate at one bit each direction [S1].
- In practice, the heuristic sign-after-LMO (MuonSign) outperforms the provably convergent variants on CIFAR-10, federated CIFAR-10, and nanoGPT speedrun [S1].
- For MLIPs (NequIP, Allegro), SOAP and SOAP-Muon consistently outperform Adam; Muon alone gives only partial gains; gains are largest under partial force supervision [S2].
- Muon reduces pretraining loss faster than AdamW, but beyond a critical pretraining token–parameter ratio, AdamW outperforms Muon after fine-tuning; the crossover moves to smaller ratios as model size increases [S3].
- The margin-to-spread ratio (correct logit above wrong ones relative to spread of wrong logits) explains the reversal: Muon leads at small data, AdamW at large [S3].
- In agentic RL (ALFWorld, Qwen2.5-0.5B-Instruct), Muon on hidden weights raises GiGPO success from 0.290 to 0.546 (+88%) at lr=3e-5; GRPO from 0.161 to 0.268; GraphGPO at lr=1e-5 reaches 0.901 success and 0.5/0.75 success 30/60 updates earlier [S4].
- Vanilla Muon's accumulated effective learning rate \(C_T = \sum \eta_t / \|W_t\|_F\) grows only logarithmically, potentially limiting exploration [S6].
- MuonW and MuonH guarantee at least linear \(C_T\) accumulation under bounded update directions [S6].
- MuonGS uses Gram–Schmidt projection to remove the radial component of each update, proving weight norm grows \(\le \mathcal{O}(\sqrt{t})\) and \(C_T = \Omega(\sqrt{T})\) [S6].

## References

- S1: arXiv — Sign compression for Muon: SignMuon, MuonSign, and the Limits of Error Feedback — https://arxiv.org/abs/2607.29674v1
- S2: arXiv — Beyond Adam: SOAP and Muon for Faster, Label-Efficient Training of Machine Learning Interatomic Potentials — https://arxiv.org/abs/2607.02499v1
- S3: arXiv — Pretraining Data Scale Reverses the Muon-AdamW Fine-Tuning Gap — https://arxiv.org/abs/2611.03633v1
- S4: arXiv — When Does Muon Help Agentic Reinforcement Learning? — https://arxiv.org/abs/2607.16169v1
- S6: arXiv — MuonGS: Pretraining LLMs with Relaxed Weight-Norm Control — https://arxiv.org/abs/2610.37647v1
