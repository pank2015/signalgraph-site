---
title: "Sample Complexity: The Data Budget for Reliable Learning"
description: "A technical explainer on sample complexity \u2014 what it is, why it determines whether a learning problem is feasible, and how modern bounds shape algorithm design."
date: "2026-09-10"
format: "explainer"
concept: "sample complexity"
tldr: ["Sample complexity quantifies how many training examples a learning algorithm needs to achieve a target accuracy with high probability.", "It is the central measure of statistical efficiency in PAC learning, bandits, and distribution estimation.", "VC dimension, Rademacher complexity, and information-theoretic quantities (entropy, mutual information) govern the fundamental limits.", "Recent work has tightened bounds for agnostic PAC learning, robust learning, quantum entropy estimation, and multi-user watermark attribution.", "More data is not always better if the sample complexity scales poorly with dimension, hypothesis class size, or desired confidence."]
references: ["S1: arXiv \u2014 The data geometry of masking diffusion: Certified-optimal schedules via unmasking growth complexity \u2014 https://arxiv.org/abs/2608.13520v1", "S2: Hacker News \u2014 Incremental \u2013 A library for incremental computations \u2014 https://github.com/janestreet/incremental", "S3: arXiv \u2014 The concentration game: Bayesian updating, regret, and information \u2014 https://arxiv.org/abs/2608.18061v1", "S4: Hacker News \u2014 Mathematics of Data Science \u2014 https://arxiv.org/abs/2607.11938", "S5: arXiv \u2014 Learning Distributions from Multiple Data Providers \u2014 https://arxiv.org/abs/2607.24732v1", "S6: arXiv \u2014 Bagging Robustly Learns VC Classes with Linear Sample Complexity \u2014 https://arxiv.org/abs/2608.13514v1", "S7: arXiv \u2014 Finding Simple Proofs for First-Order Optimization \u2014 https://arxiv.org/abs/2607.08753v1", "S8: Hacker News \u2014 The efficient frontier of LLM inference \u2014 https://www.baseten.co/blog/the-efficient-frontier-of-llm-inference/", "S9: Artificial Intelligence: A Modern Approach (Russell & Norvig) \u2014 AI Russell Norvig \u2014 part 773 \u2014 pack://ai-russell-norvig", "S10: arXiv \u2014 An Optimal Agnostic PAC Algorithm \u2014 https://arxiv.org/abs/2608.06363v1", "S11: arXiv \u2014 A positive resolution of the gap-entropy conjecture \u2014 https://arxiv.org/abs/2609.10529v1", "S12: arXiv \u2014 Nearly Sample-Optimal Estimators for Quantum R\u00e9nyi and Tsallis Entropies \u2014 https://arxiv.org/abs/2608.18070v1", "S13: arXiv \u2014 Watermark Forensics for Generative Models: An Information-Theoretic Perspective \u2014 https://arxiv.org/abs/2607.13003v1", "S14: arXiv \u2014 Test-Time Scaling in Reasoning LLMs: Inference Regimes, Evaluation, and Reproducibility \u2014 https://arxiv.org/abs/2608.04001v1"]
writer: "openrouter/nvidia/nemotron-3-ultra-550b-a55b:free"
fact_check: "passed"
diagram: "2026-09-10-sample-complexity-the-data-budget-for-reliable-learning.json"
---

## What Is Sample Complexity

Sample complexity is the number of independent observations — training examples, bandit pulls, quantum measurements, or generated tokens — that a learning procedure requires to guarantee a specified level of performance with a specified confidence. It answers the engineer's question: **how much data do I need before I can trust the model?**

Formally, a learning problem specifies a hypothesis class ℓ (the set of predictors or models under consideration), a loss function, a target excess risk ε, and a failure probability δ. The sample complexity is the smallest integer “n” such that there exists an algorithm which, given n i.i.d. samples, outputs a hypothesis whose risk is within ε of the best possible in ℓ, with probability at least 1–δ.

**Intuition: the data budget.** Imagine you are tuning a classifier for fraud detection. Each labeled transaction costs money (labeling effort, privacy risk, latency). Sample complexity tells you the minimum spend to hit 99% recall at 1% false-positive rate with 95% confidence. If the budget exceeds what you can afford, the problem is statistically infeasible — no algorithm can succeed reliably.

## Why It Matters

Sample complexity separates *learnable* from *unlearnable* problems. In the early theory of machine learning, Gold’s identification-in-the-limit framework (1967) asked whether a learner eventually converges given infinite data [S9]. PAC (Probably Approximately Correct) learning, introduced by Valiant in 1984, made this quantitative: it demands convergence *with finite data* and *high probability*. The sample complexity is the price tag of that guarantee.

It matters for three practical reasons:

1. **Feasibility gate.** Before collecting data or training a model, a sample-complexity bound tells you whether the problem is solvable with your data budget.
2. **Algorithm selection.** Two algorithms for the same task may have different sample complexities. The one with lower sample complexity reaches target accuracy with fewer labels — critical when labeling is expensive (medical imaging, legal review).
3. **Architecture and hyperparameter choices.** Model capacity (depth, width, attention heads) affects the hypothesis class size, which directly impacts sample complexity. Over-parameterized models can generalize well, but only if the effective complexity (e.g., margin, norm, or compression-based measures) stays controlled.

## How It Works: A Concrete Walkthrough

Consider **binary classification** with a hypothesis class ℓ of VC dimension d. The VC dimension (Vapnik–Chervonenkis dimension) measures the largest set of points that ℓ can shatter — i.e., label in all 2ⁿ ways. It is a combinatorial measure of richness.

**Classic PAC bound (realizable case).** If the true labeling function lies in ℓ (zero Bayes risk), then for any ε, δ ∈ (0,1), a sample of size

n ≥ C · (d + log(1/δ)) / ε

suffices for empirical risk minimization (ERM) to achieve risk ≤ ε with probability ≥ 1–δ. Here C is a universal constant. The linear dependence on d is tight: there exist classes where any learner needs Ω(d/ε) samples.

**Agnostic case (noise-tolerant).** When the best hypothesis in ℓ still has risk L* > 0 (misspecification or label noise), the optimal sample complexity is

n = Θ₁₂ · ( d + log(1/δ) ) / ε²

for constant L*, but the *exact* dependence on L* was settled only recently. An optimal agnostic PAC learner achieves

L(ˆh) ≤ L* + 7·10⁸ · ( √(L*(d+log(1/δ))/n) + (d+log(1/δ))/n )

with probability 1–δ, matching lower bounds up to universal constants at every fixed L* [S10]. The leading constant 7×10⁸ is explicit but not claimed to be tight; the key is that the *form* of the bound (square-root term plus linear term) is optimal.

**Mechanism: uniform convergence.** The proof strategy bounds the supremum deviation between empirical and true risk over all h ∈ ℓ. Symmetrization, Rademacher complexity, and covering numbers are the main tools. The sample complexity emerges from solving for n such that this uniform deviation is ≤ ε/2.

## Key Techniques and Variants

### 1. Distribution-Free PAC (VC Theory)
The VC dimension gives distribution-free bounds: they hold for *any* data distribution. This is strong but often pessimistic. For specific distributions (e.g., low-noise, margin, or cluster assumptions), faster rates are possible.

### 2. Agnostic PAC with Optimal Constants
The bound above [S10] is the first to achieve the statistically optimal *form* with an explicit universal constant. Previous work had either loose constants or suboptimal dependence on L*.

### 3. Robust Learning (Adversarial Examples)
Standard PAC bounds assume test examples are drawn from the same distribution. Adversarial robustness requires the predictor to be correct on a *ball* around each test point. For VC classes, the sample complexity for robust learning was long thought to be exponential in d. A 2024 result shows that **bagging (bootstrap aggregation) combined with robust ERM achieves linear sample complexity in the dual VC dimension d**∗ [S6]. The algorithm builds O(d*) bootstrap samples, computes a robust ERM on each, and outputs the majority vote. A matching lower bound proves Ω(d*) calls to a robust ERM oracle are necessary, even with infinite data.

### 4. Structured Query Models (Conditional Sampling)
When the learner cannot sample directly from the target distribution p but only from conditional distributions p(·|S) for queryable sets S ⊆ [n], the sample complexity depends on the *co-occurrence graph* of the query family ℘ [S5]. If the graph is complete, PAC learning requires Õ(n²/ε²) samples, and this is tight. If the whole domain [n] is queryable, ordinary sampling gives Θ(n/ε²). A sufficient condition for near-linear Õ(n/ε²) complexity is *hierarchical comparability* of the query family.

### 5. Bandits and Best-Arm Identification
In fixed-confidence best-arm identification with Gaussian arms, the instance-dependent optimal sample complexity is characterized by the *gap-entropy* formula: Θ(H(log(1/δ) + Ent(I))) where H = Σ Δ₁⁻² and Ent(I) is the entropy of the arm-identity distribution under a specific weighting [S11]. An instance-independent algorithm achieves this up to a constant factor plus a lower-order g⁻²loglog term.

### 6. Quantum Entropy Estimation
Estimating quantum Rényi entropy of order α for a d-dimensional state to additive error ε requires

- O(d²/ε¹₁₋⁺⁻¹⁺ + d¹⁻¹₁₁₁⁺/ε²) samples for 0 < α < 1,
- O(d²/ε¹₁₋⁺⁻¹⁺ + d¹⁻¹₁₁⁺/ε²) for α > 1 (Rényi),

matching recent lower bounds [S12]. The dimension dependence d² is unavoidable for α ≠ 1.

### 7. Watermark Attribution in Generative Models
Attributing a generated text to one of N users via a statistically distortion-free watermark requires Θ(log N / h) tokens, where h is the entropy rate of the source [S13]. This is the first tight entropy-rate law for multi-user attribution. Detection (distinguishing marked from unmarked) is governed by a different quantity: the *presence* (distance between marked and unmarked distributions), not information.

## Applications

- **Medical AI:** Regulatory submissions often require confidence intervals on model performance. Sample-complexity calculations determine the minimum validation cohort size.
- **A/B testing & bandits:** The gap-entropy formula [S11] tells you how many users to allocate to each variant to identify the best with 99% confidence.
- **Federated learning with restricted queries:** When clients can only answer conditional queries (e.g., “what’s the distribution of feature X given Y=y?”), the co-occurrence graph [S5] dictates whether the global model is learnable and at what sample cost.
- **Robust ML deployment:** If you need adversarial robustness, the bagging+RERM recipe [S6] gives a linear-in-d* sample complexity, making robust training feasible for larger models.
- **LLM watermarking:** The Θ(log N/h) law [S13] lets you size the token budget for user attribution in a deployed LLM.
- **Quantum characterization:** Tomography and entropy estimation of quantum devices are sample-limited; the near-optimal bounds [S12] guide experiment design.

## Trade-offs and Limitations

1. **Distribution-free vs. distribution-dependent.** VC bounds hold for all distributions but can be loose by orders of magnitude for “nice” distributions (large margin, low noise). Data-dependent bounds (Rademacher, PAC-Bayes, compression) are tighter but require empirical estimates or priors.

2. **Constants matter in practice.** The 7×10⁸ factor in the optimal agnostic PAC bound [S10] is a *universal* constant — it does not depend on d, n, or δ — but it is large. Asymptotic optimality (Θ notation) hides constants that determine whether a bound is useful at n=10⁴ vs. n=10⁶.

3. **Computational vs. statistical complexity.** A low sample complexity does not imply an efficient algorithm. The robust learning result [S6] assumes access to a robust ERM oracle, which is NP-hard for many hypothesis classes. The sample complexity is linear, but the *computational* complexity may be prohibitive.

4. **Model mismatch.** All PAC bounds assume the hypothesis class ℓ contains a good predictor (realizable) or measure distance to the best in ℓ (agnostic). If the true function is far from ℓ, the bounds guarantee only that you find the best *approximation* in ℓ — which may still be poor.

5. **IID assumption.** Most classical bounds assume independent, identically distributed samples. Time-series, spatial data, and adaptive data collection (active learning, bandits) violate this. The concentration game framework [S3] extends the analysis to adaptive settings via an information-theoretic ledger, but the sample-complexity formulas change.

6. **When NOT to use sample-complexity-driven design.** If you have abundant data (web-scale, simulated environments) and the bottleneck is compute or engineering, optimizing for minimal samples is the wrong objective. Similarly, in exploratory research where the hypothesis class is unknown, sample-complexity bounds are not actionable.

## Further Reading

- **Optimal agnostic PAC learning:** [S10] An Optimal Agnostic PAC Algorithm — settles the constant-factor sample complexity.
- **Robust learning with bagging:** [S6] Bagging Robustly Learns VC Classes with Linear Sample Complexity — exponential improvement for adversarial robustness.
- **Conditional query models:** [S5] Learning Distributions from Multiple Data Providers — co-occurrence graph governs learnability.
- **Best-arm identification:** [S11] A positive resolution of the gap-entropy conjecture — instance-optimal sample complexity for Gaussian bandits.
- **Quantum entropy estimation:** [S12] Nearly Sample-Optimal Estimators for Quantum Rényi and Tsallis Entropies — dimension-dependent bounds matching lower bounds.
- **Watermark forensics:** [S13] Watermark Forensics for Generative Models — entropy-rate law for multi-user attribution.
- **Foundational theory:** [S9] Artificial Intelligence: A Modern Approach (Russell & Norvig) — historical context on Gold, Kolmogorov complexity, and the “no data like more data” principle.
- **Adaptive concentration:** [S3] The concentration game: Bayesian updating, regret, and information — unified information-theoretic account of sequential learning.

## References

- S1: arXiv — The data geometry of masking diffusion: Certified-optimal schedules via unmasking growth complexity — https://arxiv.org/abs/2608.13520v1
- S2: Hacker News — Incremental – A library for incremental computations — https://github.com/janestreet/incremental
- S3: arXiv — The concentration game: Bayesian updating, regret, and information — https://arxiv.org/abs/2608.18061v1
- S4: Hacker News — Mathematics of Data Science — https://arxiv.org/abs/2607.11938
- S5: arXiv — Learning Distributions from Multiple Data Providers — https://arxiv.org/abs/2607.24732v1
- S6: arXiv — Bagging Robustly Learns VC Classes with Linear Sample Complexity — https://arxiv.org/abs/2608.13514v1
- S7: arXiv — Finding Simple Proofs for First-Order Optimization — https://arxiv.org/abs/2607.08753v1
- S8: Hacker News — The efficient frontier of LLM inference — https://www.baseten.co/blog/the-efficient-frontier-of-llm-inference/
- S9: Artificial Intelligence: A Modern Approach (Russell & Norvig) — AI Russell Norvig — part 773 — pack://ai-russell-norvig
- S10: arXiv — An Optimal Agnostic PAC Algorithm — https://arxiv.org/abs/2608.06363v1
- S11: arXiv — A positive resolution of the gap-entropy conjecture — https://arxiv.org/abs/2609.10529v1
- S12: arXiv — Nearly Sample-Optimal Estimators for Quantum Rényi and Tsallis Entropies — https://arxiv.org/abs/2608.18070v1
- S13: arXiv — Watermark Forensics for Generative Models: An Information-Theoretic Perspective — https://arxiv.org/abs/2607.13003v1
- S14: arXiv — Test-Time Scaling in Reasoning LLMs: Inference Regimes, Evaluation, and Reproducibility — https://arxiv.org/abs/2608.04001v1
