---
title: "On-Policy Distillation: A Definitive Explainer"
description: "How on-policy distillation closes the distribution gap in model training by supervising student-generated trajectories with dense teacher signals."
date: "2026-10-25"
format: "explainer"
concept: "On-policy distillation"
tldr: ["On-policy distillation (OPD) trains a student on its own generated rollouts while a teacher provides dense token-level supervision, eliminating the distribution mismatch of off-policy methods.", "Self-distillation variants (OPSD) remove the external teacher by giving the same model privileged information (answers, visual evidence, demonstrations) during teaching.", "Key innovations address prefix failure (Relay-OPD), privileged information leakage (DemoPSD), weak-to-strong transfer (Direct-OPD), and stage-dependent teacher reliability (RetireOPD).", "OPD is data-overfed but algorithm-starved: a single query covers ~71.5% of states visited in full-data training, yet alignment takes hundreds of steps.", "Trade-offs include compute overhead from teacher queries, sensitivity to privileged information design, and privacy risks from structured supervision imprints."]
references: ["S1: arXiv \u2014 OP-Print: Tracing Membership Imprints in On-Policy Self-Distillation \u2014 https://arxiv.org/abs/2610.31616v1", "S2: arXiv \u2014 Rethinking On-Policy Distillation of Large Language Models II: One Training Example \u2014 https://arxiv.org/abs/2609.04172v1", "S3: arXiv \u2014 Pass the Baton: Trajectory-Relayed On-Policy Distillation \u2014 https://arxiv.org/abs/2607.26057v1", "S4: arXiv \u2014 RetireOPD: Self-Retiring On-Policy Distillation for Agentic Reinforcement Learning \u2014 https://arxiv.org/abs/2609.20784v1", "S5: arXiv \u2014 Rethinking Classifier-Free Guidance in On-Policy Diffusion Distillation \u2014 https://arxiv.org/abs/2607.24731v1", "S6: arXiv \u2014 DemoPSD: Disagreement-Modulated Policy Self-Distillation \u2014 https://arxiv.org/abs/2607.02502v1", "S7: arXiv \u2014 TurnSight: Turn-Level Hindsight Self-Distillation for Tool-Integrated Reasoning \u2014 https://arxiv.org/abs/2608.04007v1", "S8: arXiv \u2014 Weak-to-Strong Generalization via Direct On-Policy Distillation \u2014 https://arxiv.org/abs/2607.05394v1", "S10: arXiv \u2014 Visual Contrastive Self-Distillation \u2014 https://arxiv.org/abs/2607.21556v1", "S12: arXiv \u2014 Reinforcement Learning with Visually Attributable On-Policy Self-Distillation \u2014 https://arxiv.org/abs/2610.26856v1", "S14: arXiv \u2014 onPanda: Efficient Annotation of On-Policy Alignment Data for LLMs and Agents via Token-Level Correction \u2014 https://arxiv.org/abs/2609.24983v1"]
writer: "openrouter/nvidia/nemotron-3-ultra-550b-a55b:free"
fact_check: "passed"
diagram: "2026-10-25-on-policy-distillation-a-definitive-explainer.json"
---

## What It Is

On-policy distillation (OPD) is a training paradigm where a **student model** generates its own sequences — called **rollouts** or **trajectories** — and a **teacher model** supplies dense, token-level supervision on those exact rollouts [S2]. The "on-policy" label comes from reinforcement learning: the student learns *on* the distribution induced by its current policy, not on a fixed dataset or the teacher's distribution.

In standard **off-policy distillation**, the teacher generates the training data (or a fixed dataset is used). The student then mimics the teacher's outputs. This creates a **distribution mismatch**: at test time, the student must generate autonomously, but it was trained on teacher-generated prefixes that may never occur under the student's own policy. Errors compound because the student never learns to recover from its own mistakes [S1][S3].

OPD closes this gap. The student rolls out. The teacher observes the student's prefix and provides a target distribution for the next token (or a correction signal). The student updates toward that target. Repeat. The supervision is **dense** (per token) rather than **sparse** (per episode), which is critical for long-horizon reasoning where a single scalar reward arrives only at the end [S4].

**Analogy**: Imagine a driving instructor. Off-policy: the instructor drives the car perfectly while you watch. On-policy: *you* drive; when you drift, the instructor gently corrects the steering *at that moment*, on the road you actually took. You learn recovery, not just imitation.

### Self-Distillation (OPSD)
A practical variant removes the external teacher entirely. The **same model** acts as both student and teacher, but with **asymmetric information access** [S6][S10]. The teacher sees privileged context — ground-truth answers, visual evidence, retrieved skills, or demonstrations — that the student does not. This information asymmetry makes the teacher's distribution sharper, providing a learning signal. At test time, the privileged context is removed; the student must perform with only the standard input [S6][S7][S10][S12].

## Why It Matters

### The Distribution Mismatch Problem
Off-policy distillation trains on teacher-generated data. The student's test-time distribution diverges from the training distribution. This is the **covariate shift** problem, exacerbated in autoregressive generation where errors cascade [S1][S3].

### Sparse vs. Dense Supervision
Reinforcement learning with verifiable rewards (RLVR) provides only a **trajectory-level scalar reward**. Credit assignment across dozens or hundreds of tokens is hard. OPD supplies **token-level supervision** from the teacher, turning a sparse RL signal into a dense teaching signal [S4][S7][S8]. This accelerates learning and enables fine-grained correction.

### Data Efficiency
Surprisingly, OPD is **data-overfed but algorithm-starved** [S2]. A single training query already reaches **71.5% of the state coverage** of full-data OPD (the fraction of states visited during full training that the query's rollouts touch). Sixteen semantically diverse queries reach **98.9% coverage** and match full-data performance. Yet alignment with the teacher slows at a similar pace whether training on one query or the whole dataset — the student absorbs supervision increasingly slowly over hundreds of steps [S2]. This means the bottleneck is *optimization*, not data diversity.

### Weak-to-Strong Transfer
Running RL on large models is expensive (rollout generation dominates compute). **Direct-OPD** runs RL on a small "weak" model, then transfers the *policy shift* (log-ratio of post-RL vs pre-RL teacher) as a dense implicit reward to a larger "strong" student — without training a reward model or running RL on the target [S8]. This reuses cheap weak-model RL compute to improve strong models.

## How It Works: Core Mechanism

### The Basic Loop
1. **Student rolls out**: Given a prompt, the student generates a sequence token by token (or in chunks).
2. **Teacher observes prefix**: At each step (or selected steps), the teacher conditions on the *student's prefix so far* plus any privileged information.
3. **Teacher provides target**: The teacher outputs a target distribution (logits, corrections, or a reward signal) for the next token(s).
4. **Student updates**: The student minimizes a loss (typically KL divergence, cross-entropy, or a policy-gradient objective) toward the teacher's target on that prefix.
5. **Repeat**: The updated student generates new rollouts; the loop continues.

### Concrete Example: Mathematical Reasoning
Consider a student solving a math word problem.
- **Student rollout**: "First, I calculate the total apples: 5 + 3 = 9." (Error: 5+3=8)
- **Teacher view**: Sees the student's prefix *and* the ground-truth answer (privileged). Knows the correct sum is 8.
- **Teacher target**: At the token "9", the teacher assigns high probability to "8" (or a correction token like "wait, that's 8").
- **Student update**: The student learns to correct *its own* error at the point it occurred, on *its own* prefix.

Contrast with off-policy: the teacher would have generated "5 + 3 = 8" from scratch. The student never sees the "9" error state during training, so it cannot learn to self-correct from that state [S3].

### Prefix Failure and the Teacher-Student Asymmetry
A critical failure mode: once the student commits to a wrong reasoning direction, *all subsequent generation builds on that deviation*. The teacher, conditioned on the student's wrong prefix, may try to **redirect** (e.g., "Actually, let me reconsider..."), while the student tends to **continue** the wrong path. This **teacher-student continuation asymmetry** produces misdirected continuations that elicit unreliable supervision and waste compute [S3].

## Key Techniques and Variants

### Relay-OPD: Intervening at Critical Points
**Relay-OPD** detects the asymmetry above as a **handoff trigger** [S3]. When the teacher's continuation diverges sharply from the student's (measured by KL or entropy), the teacher briefly **takes over** — a "teacher leg" — to steer back to a viable trajectory. The student then resumes and is optimized on the *composite* trajectory. A **relay budget** limits intervention to critical early positions, reducing trajectory length by **over 50%** while outperforming standard OPD by **+5.73%** and FastOPD by **+1.49%** on average for 1.7B models across eight math benchmarks [S3].

### DemoPSD: Selective Adoption via Reverse-KL Barycenter
Standard OPSD fits the full teacher distribution, which causes **privileged information leakage** (student encodes answer-dependent shortcuts unavailable at test time) and **overfitting to in-domain patterns**, hurting cross-domain generalization [S6]. **DemoPSD** steers the student toward a **reverse-KL barycenter target**: a weighted geometric combination of teacher and student distributions. The blend weight is **discrepancy-adaptive** at each token — high disagreement means more student preservation; low disagreement means more teacher adoption. This provably achieves **leakage attenuation** and **exploration preservation** [S6].

### RetireOPD: Adaptive Teacher Retirement for Agents
In multi-turn agent tasks, two problems emerge: (1) privileged information alone doesn't guarantee a reliable teacher, and (2) teacher benefit is **stage-dependent** — early on, dense supervision helps; later, it may hinder [S4]. **RetireOPD** first trains a **skill-conditioned teacher** with environment rewards (decoupled from the student). Then it trains the skill-free student **jointly with RL and OPD**. Crucially, **Adaptive Retirement**: the student *drops the teacher autonomously* once their discrepancy stops shrinking *and* the student reaches a target fraction of the teacher's success rate. Training then proceeds with RL alone. On Qwen2.5 (1.5B–7B), RetireOPD improves ALFWorld success by **14.1–18.8%** and WebShop accuracy by **11.8–19.0%** over RL baseline, surpassing its own teacher in every setting [S4].

### Direct-OPD: Transferring the RL Policy Shift
**Direct-OPD** avoids distilling the weak teacher's final policy (which mixes RL gains with model limitations). Instead, it computes the **log-ratio** between the post-RL teacher and its pre-RL reference checkpoint. This log-ratio is a **dense implicit reward** — it tells which actions RL made more/less likely. Direct-OPD applies this signal on the *strong student's own on-policy states*. No reward model, no RL on the target. Result: Qwen3-1.7B boosted from **48.3% to 62.4% on AIME 2024** in just 4k steps (from the paper's truncated claim) [S8].

### VCSD: Visual Contrastive Self-Distillation
For vision-language models, **VCSD** creates teacher-student asymmetry *without* privileged answers or external evidence [S10]. At each student prefix, an EMA teacher produces two next-token distributions: one conditioned on the original image, one on a **content-erased control**. The **token-wise log-probability difference** highlights candidates whose likelihood is specifically increased by the visual content. This contrast sharpens the teacher's original-image distribution within its plausible support, which is then distilled. On Qwen3-VL 2B, seven-benchmark aggregate improves **62.27% → 67.04%** [S10].

### TurnSight: Turn-Level Hindsight for Tool Use
Tool-integrated reasoning (TIR) has **turn-level structure** (tool call → observation → next reasoning). Token-level supervision misses this. **TurnSight** derives supervision from **execution-conditioned hindsight**: after a tool interaction, the teacher sees the outcome and constructs hindsight views with different lookahead horizons. **Cross-horizon directional agreement** selects reliable signals. The selected signal is normalized across sibling rollouts and modulates RL advantages while preserving their optimization direction [S7].

### Visual-Attribution Gating (VAG): Grounding Corrections in Evidence
In multimodal RLVR, privileged corrections may conflate visual evidence with linguistic priors or style shifts — **privileged-correction contamination** [S12]. **VAG** uses the **verifier-derived advantage** as an optimization anchor and validates each privileged correction against the contrast between evidence-present and evidence-degraded teacher views. Only corrections *directionally supported* by visual evidence are admitted.

### onPanda: Human-in-the-Loop Token-Level Correction
**onPanda** is an annotation tool where humans perform **token-level correction**: locate the first inappropriate token, pick a substitute or type a correction, truncate, and continue generation from the corrected prefix [S14]. This **locate-correct-continue loop** reduces median annotation time by **52%** vs. manual post-editing. The resulting data preserves the model's sampling distribution (most tokens are model-generated) and yields fine-grained supervision with precise positions and natural positive-negative pairs — ideal for on-policy SFT and preference data [S14].

### Diffusion: Positive-Direction Matching (PDM)
In diffusion models, OPD adapts by querying the teacher along student-generated trajectories. Under **classifier-free guidance (CFG)**, naive velocity matching of the CFG-composed prediction is **under-identified at the branch level**: positive- and negative-branch errors can compensate. When the teacher's negative branch retains privileged information unavailable to the student, **Negative Branch Asymmetry (NBA)** occurs — positive-branch error decreases while negative-branch error *increases* [S5]. **PDM** separately constrains the positive prediction and the CFG conditional direction, fixing NBA.

## Applications

| Domain | Method | What It Enables |
|---|---|---|
| **LLM Reasoning (Math, Code)** | Relay-OPD, DemoPSD, Direct-OPD | Dense correction on student's own reasoning traces; weak-to-strong transfer without target-model RL |
| **Agentic RL (ALFWorld, WebShop)** | RetireOPD, TurnSight | Turn-level credit assignment; adaptive teacher retirement; skill internalization from sparse rewards |
| **Vision-Language Models** | VCSD, VAG | Self-distillation without privileged answers; visually grounded corrections |
| **Diffusion Models** | PDM | Stable on-policy distillation under classifier-free guidance |
| **Data Annotation** | onPanda | Efficient human token-level correction for on-policy SFT/preference data |
| **Privacy Auditing** | OP-Print | Membership inference attacks exploiting structured supervision imprints in OPSD [S1] |

## Trade-offs and Limitations

### Compute Overhead
OPD requires **teacher queries on every student rollout step** (or selected steps). This doubles (or more) the forward-pass compute per training step compared to off-policy distillation on fixed data. Relay-OPD reduces trajectory length by >50%, partially offsetting this [S3].

### Privileged Information Design Is Critical
OPSD *requires* an information asymmetry. The choice of privileged context (answers, visual evidence, demonstrations, retrieved skills) determines what the student learns — and what leaks. Poorly designed privilege causes **leakage** (shortcuts that fail at test time) or **contamination** (corrections not grounded in the intended signal) [S6][S10][S12]. There is no universal recipe; it is task-dependent.

### Privacy Risks
The **supervision imprint** in OPSD is **sparse and structured**, concentrating on "uncertainty-sensitive correction sites" rather than the full rollout [S1]. This structure enables **membership inference attacks (OP-Print)** that aggregate teacher-student residual corrections (gray-box) or measure restart-based output-basin stability (black-box). Baseline attacks otherwise remain at random guess levels, but OP-Print succeeds — a concrete privacy concern for deployed self-distilled models [S1].

### Algorithm-Starved, Not Data-Starved
Adding more diverse queries helps state coverage (16 queries → 98.9%), but **alignment speed saturates** similarly regardless of data volume [S2]. The bottleneck is how fast the student absorbs supervision on visited states. Techniques that accelerate per-step alignment (Relay-OPD, DemoPSD's adaptive blending, RetireOPD's retirement) matter more than data scaling.

### Teacher Reliability Is Not Guaranteed
Privileged information ≠ reliable teacher. In agentic tasks, a skill-conditioned teacher can still fail [S4]. RetireOPD's decoupled teacher training + adaptive retirement addresses this, but it adds complexity (two-phase training, discrepancy monitoring).

### When NOT to Use OPD
- **Short-horizon tasks with abundant off-policy data**: Off-policy distillation on high-quality teacher data is simpler and cheaper.
- **No natural privileged information**: If you cannot define a meaningful teacher-student asymmetry, OPSD has no signal.
- **Strict privacy requirements**: The structured supervision imprint creates membership inference surface [S1].
- **Compute-constrained training**: Teacher queries on every rollout step may be prohibitive.

## Further Reading

- **OP-Print** — Membership inference attacks on on-policy self-distillation [S1]
- **Rethinking OPD II: One Training Example** — State coverage and data-overfed/algorithm-starved analysis [S2]
- **Relay-OPD** — Trajectory-relayed distillation with handoff triggers [S3]
- **RetireOPD** — Self-retiring distillation for agentic RL with adaptive retirement [S4]
- **CFG in OPD for Diffusion** — Negative Branch Asymmetry and Positive-Direction Matching [S5]
- **DemoPSD** — Disagreement-modulated policy self-distillation with reverse-KL barycenter [S6]
- **TurnSight** — Turn-level hindsight self-distillation for tool-integrated reasoning [S7]
- **Direct-OPD** — Weak-to-strong generalization via policy-shift transfer [S8]
- **VCSD** — Visual contrastive self-distillation without privileged answers [S10]
- **Visually Attributable OPSD** — Evidence-consistent corrections via Visual-Attribution Gating [S12]
- **onPanda** — Token-level correction annotation tool for on-policy alignment data [S14]

## References

- S1: arXiv — OP-Print: Tracing Membership Imprints in On-Policy Self-Distillation — https://arxiv.org/abs/2610.31616v1
- S2: arXiv — Rethinking On-Policy Distillation of Large Language Models II: One Training Example — https://arxiv.org/abs/2609.04172v1
- S3: arXiv — Pass the Baton: Trajectory-Relayed On-Policy Distillation — https://arxiv.org/abs/2607.26057v1
- S4: arXiv — RetireOPD: Self-Retiring On-Policy Distillation for Agentic Reinforcement Learning — https://arxiv.org/abs/2609.20784v1
- S5: arXiv — Rethinking Classifier-Free Guidance in On-Policy Diffusion Distillation — https://arxiv.org/abs/2607.24731v1
- S6: arXiv — DemoPSD: Disagreement-Modulated Policy Self-Distillation — https://arxiv.org/abs/2607.02502v1
- S7: arXiv — TurnSight: Turn-Level Hindsight Self-Distillation for Tool-Integrated Reasoning — https://arxiv.org/abs/2608.04007v1
- S8: arXiv — Weak-to-Strong Generalization via Direct On-Policy Distillation — https://arxiv.org/abs/2607.05394v1
- S10: arXiv — Visual Contrastive Self-Distillation — https://arxiv.org/abs/2607.21556v1
- S12: arXiv — Reinforcement Learning with Visually Attributable On-Policy Self-Distillation — https://arxiv.org/abs/2610.26856v1
- S14: arXiv — onPanda: Efficient Annotation of On-Policy Alignment Data for LLMs and Agents via Token-Level Correction — https://arxiv.org/abs/2609.24983v1
