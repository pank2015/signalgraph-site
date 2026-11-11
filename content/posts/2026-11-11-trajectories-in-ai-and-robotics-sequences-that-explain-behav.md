---
title: "Trajectories in AI and Robotics: Sequences That Explain Behavior"
description: "A trajectory is a time-ordered sequence of states or state-action pairs; this explainer covers how they are used to debug agents, control robots, forecast time series, and track objects in video."
date: "2026-11-11"
format: "explainer"
concept: "trajectories"
tldr: ["A trajectory is a chronological record of what a system did and what it observed, step by step.", "In LLM agents, trajectories let you replay a session to find where reasoning went wrong.", "In robotics, trajectories are the planned or executed paths of joints, end-effectors, or tracked points.", "In forecasting, a trajectory is a full joint sample path \u2014 not just marginal quantiles \u2014 so downstream metrics stay coherent.", "Long, high-dimensional trajectories create storage, privacy, and evaluation challenges that differ by domain."]
references: ["S1: arXiv \u2014 TRAJDEBUG: Tracing Error Lifecycle to Identify Critical Failures in Long-Horizon Agent Trajectories \u2014 https://arxiv.org/abs/2608.06346v1", "S2: LangChain Blog \u2014 Trajectories now in LangSmith: A readable view of every agent session \u2014 https://www.langchain.com/blog/langsmith-trajectories-tracing", "S3: arXiv \u2014 MotionForesight: Re-purposing Video Models for Future 3D Scene-Flow Prediction \u2014 https://arxiv.org/abs/2607.16192v1", "S5: arXiv \u2014 PathFM: Fast Generative Forecasting of Multivariate Trajectories \u2014 https://arxiv.org/abs/2610.22358v1", "S6: arXiv \u2014 Coding Agents for Generalized Task and Motion Planning Problems \u2014 https://arxiv.org/abs/2609.30233v1", "S7: arXiv \u2014 Desktop-Delta Bench: Do Computer-Use Models Understand Desktop GUI Transitions? \u2014 https://arxiv.org/abs/2607.26041v1", "S8: Artificial Intelligence: A Modern Approach (Russell & Norvig) \u2014 AI Russell Norvig \u2014 part 992 (pack://ai-russell-norvig)", "S9: arXiv \u2014 TrackEverything: Long Horizon Dense Tracking via De-Duplicating 3D Scene Representations \u2014 https://arxiv.org/abs/2609.30222v1", "S10: arXiv \u2014 GeoAAC: Geometry-Based Adaptive Action Chunking from Denoising Trajectories in VLA Policies \u2014 https://arxiv.org/abs/2609.20776v1", "S11: arXiv \u2014 StageGuard: Learning Stage Transitions for Long-Horizon Robot Tasks via Agentic Distillation \u2014 https://arxiv.org/abs/2609.20791v1", "S12: arXiv \u2014 HumanTracker: Towards Comprehensive and Human-Aligned Motion Tracking Benchmark \u2014 https://arxiv.org/abs/2608.13555v1", "S13: arXiv \u2014 DreamFly: Causal Memory and Receding-Horizon Diffusion Planning for Aerial Vision-Language Navigation \u2014 https://arxiv.org/abs/2608.12308v1"]
writer: "openrouter/nvidia/nemotron-3-ultra-550b-a55b:free"
fact_check: "passed"
diagram: "2026-11-11-trajectories-in-ai-and-robotics-sequences-that-explain-behav.json"
---

## What a trajectory is

A **trajectory** is a time-ordered sequence of states — or state–action pairs — that describes how a system evolves. In discrete time it looks like \((s_0, a_0, s_1, a_1, \dots, s_T)\); in continuous time it is a curve \(x(t)\) in state space. The concept is borrowed from physics and control theory, but in modern AI it appears in at least four guises:

* **Agent trajectories** — the full conversation plus tool calls of an LLM-based agent across a session [S2].
* **Robot trajectories** — the sequence of joint configurations, end-effector poses, or contact states executed by a manipulator or mobile robot [S3][S6][S8][S10][S11][S13].
* **Forecast trajectories** — complete multivariate sample paths drawn from a generative time-series model, preserving cross-variable dependence [S5].
* **Tracking trajectories** — the 3D positions of points or objects across video frames, often reconstructed in world coordinates [S3][S9][S12].

All four share the same core idea: **a trajectory makes the temporal structure of behavior explicit so you can inspect, evaluate, or learn from it.**

## Why trajectories matter

### Debugging and attribution
When an agent fails, the failure is often not in the last step. The error may have occurred many turns earlier — a wrong API call, a misread document, a bad sub-agent handoff — and only cascaded later. A trajectory view aggregates messages from humans, the model, and tools **in the order they first appeared**, so you can scan for the deviation point before diving into nested traces [S2]. Specialized frameworks go further: they compress long histories at multiple granularities, trace each local error's "resolution status" (did the agent recover?), and attribute **critical errors** — the earliest mistake still responsible for the final outcome [S1].

### Verification and recovery in computer-use agents
Computer-use agents (CUAs) act through desktop GUIs. The next screenshot may be delayed, occluded, or stale. Benchmarks now isolate whether a model can **reconstruct the causal transition** produced by an action — verifying progress, rejecting stale observations, and recovering from failure [S7]. This requires reasoning over short trajectory windows (before/after frames, three-frame orderings).

### Closed-loop control and skill switching
In robotics, a trajectory is the execution trace of a policy. Hierarchical systems string skills together; deciding **when to terminate one skill and start the next** is a trajectory-classification problem. StageGuard distills VLM reasoning on demonstration trajectories into a lightweight student that predicts stage transitions in real time [S11].

### Coherent multivariate forecasting
Standard forecasting models output marginal quantiles per time step. But downstream decisions — peak load, cumulative demand, event timing — depend on the **joint dependence structure** across steps and variables. Generating full trajectories (sample paths) preserves this structure; PathFM uses flow matching to produce such paths and distills the sampler to one or two steps for speed [S5].

### Perceptually aligned evaluation
In humanoid tracking, per-frame kinematic error (MPJPE) misses artifacts humans care about: foot skating, mistimed contacts, unstable support. HumanTracker introduces a preference-aligned metric trained on human judgments of motion trajectories, revealing failures that kinematic metrics miss [S12].

## How trajectories are represented and used

### Agent sessions as trajectories
LangSmith's Trajectories view flattens a LangGraph run — main agent, sub-agents, retries, human-in-the-loop turns — into a single chronological stream. Each entry carries role (human/AI/tool), content, and metadata. You can **score** the whole trajectory with online evaluators, route it to annotation queues, or export it to datasets for supervised fine-tuning [S2]. TrajDebug adds multi-granularity compression (instruction-level, step-level, token-level) and evidence-based error identification to handle trajectories spanning hundreds of steps [S1].

### Robot trajectories: states, actions, and contacts
In manipulation, a trajectory may be:
* **Joint-space** — \(q(t)\) for each degree of freedom.
* **Task-space** — end-effector pose \(SE(3)\).
* **Contact-implicit** — sequences of contact modes (stick, slip, break) coupled with motions [S6][S10].

Flow-based Vision-Language-Action (VLA) policies generate action chunks by denoising. The **geometry of the denoising trajectory** — how much the predicted action prefix varies across diffusion steps — correlates with predictive uncertainty. GeoAAC exploits this to adapt the action-horizon length per step without retraining [S10].

### Forecast trajectories as joint sample paths
PathFM treats a multivariate series as a distribution over **complete future paths**. Flow matching learns a vector field that transports noise to data; distillation shares the history attention cache across draws, so generating \(K\) paths costs roughly one query to a quantile model. A new benchmark, fps-bench, evaluates trajectories with energy scores, variogram scores, and downstream metrics (cumulative demand, peak timing) — PathFM leads on aggregate path score [S5].

### 3D tracking trajectories in world coordinates
TrackEverything represents a video as **persistent 3D scene tracks** in world coordinates. At sliding-window boundaries, a voxelization-based de-duplication merges co-located tracks, preventing redundant accumulation. Tracking decomposes into an endpoint refiner (destination + static/dynamic) and a lightweight trajectory refiner for dynamic points only. 3D WAFT replaces 4D correlation volumes with feature sampling in the scene cloud. The result: **all visible points tracked across >1000 frames within 40 GB GPU memory** [S9].

MotionForesight takes a different angle: it **repurposes video prediction priors** to forecast future 3D scene flow (point trajectories) on manipulated objects from a short observed context, without object models or language [S3].

## Key variants and techniques

| Domain | Trajectory type | Key technique | Distinctive challenge |
|---|---|---|---|
| LLM agents | Message + tool-call sequence | Multi-granularity compression, error-lifecycle tracing [S1] | Length (hundreds of steps), scattered evidence, multiple local errors |
| Computer-use agents | Screenshot + action pairs | Temporal-ordering tasks, before/after verification [S7] | Asynchrony: delayed, occluded, stale observations |
| Robot manipulation | Joint / task-space paths | Flow-matching denoising, adaptive chunking [S10] | Coupling discrete decisions to continuous geometry |
| Hierarchical robot control | Skill-level segments | Agentic distillation of VLM reasoning [S11] | Real-time stage-transition detection |
| Time-series forecasting | Multivariate sample paths | Flow matching + distillation, shared cache [S5] | Preserving cross-variable, cross-step dependence |
| 3D point tracking | World-coordinate point tracks | Voxel de-duplication, endpoint + trajectory refiners [S9] | Scaling to long videos without memory explosion |
| Interaction forecasting | Object-centered 3D scene flow | Video-model priors redirected to 3D flow [S3] | No object models, language, or auxiliary inputs |
| Humanoid motion | Full-body pose sequences | Preference-aligned metric (HumanScore) [S12] | Kinematic metrics miss contact/stability failures |

## Applications

* **Agent observability** — LangSmith Trajectories let product teams review sessions, score them, and build fine-tuning datasets [S2].
* **Critical error localization** — TrajDebug on TrajErrBench (486 annotated failed trajectories from Tau2Bench and SWE-Bench Pro) identifies the earliest responsible error, enabling targeted fixes [S1].
* **CUA reliability** — Desktop-Delta Bench (2,013 instances, ~15 apps, 50 domains) measures step-level transition understanding, a prerequisite for recovery [S7].
* **Generalized task-and-motion planning** — Coding agents synthesize programs from simulator interaction; the resulting programs are evaluated on held-out instances (98,000 episodes), outperforming hand-engineered planners [S6].
* **Adaptive robot control** — GeoAAC improves real-world success from 53.3% to 74.4% by varying action-horizon length per step [S10].
* **Hierarchical skill execution** — StageGuard enables real-time stage-transition monitoring on BEHAVIOR-1K and real robots [S11].
* **Coherent forecasting** — PathFM generates trajectories for energy, demand, and chaotic systems; distilled sampler enables direct calibration loss optimization [S5].
* **Long-horizon 3D tracking** — TrackEverything tracks all points in >1000-frame videos; MotionForesight predicts future 3D object motion from passive video [S9][S3].
* **Humanoid evaluation** — HumanTracker (153 hours, 4 motion families) and HumanScore align metrics with human perception [S12].
* **Aerial navigation** — DreamFly uses receding-horizon diffusion planning (predict \(K\), execute 1) with causal memory for VLN [S13].

## Trade-offs and limitations

| Concern | Manifestation | Mitigation / Note |
|---|---|---|
| **Length and storage** | Agent sessions span many turns; robot logs run at 100–1000 Hz. | Compression (TrajDebug), distillation (PathFM), de-duplication (TrackEverything). |
| **Partial observability** | CUAs get stale/occluded screenshots; agents see only tool outputs. | Transition verification benchmarks (DDB), causal memory (DreamFly). |
| **Evaluation gap** | Kinematic metrics ≠ human preference; marginal scores ≠ path quality. | HumanScore [S12], fps-bench [S5], DDB ordering tasks [S7]. |
| **Compute vs. horizon** | Flow matching needs many steps; diffusion planning predicts \(K\) but executes 1. | Distillation to 1–2 steps [S5][S10], receding-horizon replan [S13]. |
| **Sim-to-real / domain shift** | TrackEverything trained on pseudo-GT from video models; MotionForesight uses video priors. | Generalization reported on OOD objects, views, interactions [S3][S9]. |
| **Privacy / PII** | Agent trajectories contain user data, credentials, proprietary code. | Local-only views, redaction pipelines, access-controlled annotation queues [S2]. |
| **Benchmark saturation** | DDB ordering exact-match ~65%; HumanTracker reveals kinematic metrics' blindness. | New metrics (HumanScore, path scores) and harder splits needed. |

**When not to use trajectory-based methods:**
* If the task is truly memoryless (single-step classification), a trajectory adds overhead.
* If you only need marginal quantiles and have no downstream dependence-sensitive metric, a quantile model is simpler.
* If the system has no temporal structure (e.g., batch inference on i.i.d. inputs), trajectory tooling is mismatched.

## Further reading

* **TrajDebug** — error-lifecycle tracing for long-horizon agent trajectories [S1].
* **LangSmith Trajectories** — product-oriented chronology view for agent sessions [S2].
* **MotionForesight** — video-model priors for future 3D scene-flow prediction [S3].
* **PathFM** — flow-matching generative forecasting of multivariate trajectories [S5].
* **TrackEverything** — persistent 3D scene tracks for long-horizon dense tracking [S9].
* **GeoAAC** — geometry-based adaptive action chunking from denoising trajectories [S10].
* **StageGuard** — agentic distillation for stage-transition detection [S11].
* **HumanTracker / HumanScore** — perceptually aligned humanoid motion evaluation [S12].
* **DreamFly** — causal memory and receding-horizon diffusion planning for aerial VLN [S13].
* **Desktop-Delta Bench** — step-level transition understanding for computer-use agents [S7].
* **Russell & Norvig, Ch. 25** — recursive state estimation in continuous spaces (foundational) [S8].

## References

- S1: arXiv — TRAJDEBUG: Tracing Error Lifecycle to Identify Critical Failures in Long-Horizon Agent Trajectories — https://arxiv.org/abs/2608.06346v1
- S2: LangChain Blog — Trajectories now in LangSmith: A readable view of every agent session — https://www.langchain.com/blog/langsmith-trajectories-tracing
- S3: arXiv — MotionForesight: Re-purposing Video Models for Future 3D Scene-Flow Prediction — https://arxiv.org/abs/2607.16192v1
- S5: arXiv — PathFM: Fast Generative Forecasting of Multivariate Trajectories — https://arxiv.org/abs/2610.22358v1
- S6: arXiv — Coding Agents for Generalized Task and Motion Planning Problems — https://arxiv.org/abs/2609.30233v1
- S7: arXiv — Desktop-Delta Bench: Do Computer-Use Models Understand Desktop GUI Transitions? — https://arxiv.org/abs/2607.26041v1
- S8: Artificial Intelligence: A Modern Approach (Russell & Norvig) — AI Russell Norvig — part 992 (pack://ai-russell-norvig)
- S9: arXiv — TrackEverything: Long Horizon Dense Tracking via De-Duplicating 3D Scene Representations — https://arxiv.org/abs/2609.30222v1
- S10: arXiv — GeoAAC: Geometry-Based Adaptive Action Chunking from Denoising Trajectories in VLA Policies — https://arxiv.org/abs/2609.20776v1
- S11: arXiv — StageGuard: Learning Stage Transitions for Long-Horizon Robot Tasks via Agentic Distillation — https://arxiv.org/abs/2609.20791v1
- S12: arXiv — HumanTracker: Towards Comprehensive and Human-Aligned Motion Tracking Benchmark — https://arxiv.org/abs/2608.13555v1
- S13: arXiv — DreamFly: Causal Memory and Receding-Horizon Diffusion Planning for Aerial Vision-Language Navigation — https://arxiv.org/abs/2608.12308v1
