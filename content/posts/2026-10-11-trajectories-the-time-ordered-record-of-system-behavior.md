---
title: "Trajectories: The Time-Ordered Record of System Behavior"
description: "A trajectory is a chronological sequence of states, actions, and observations that captures how a system \u2014 agent, robot, or model \u2014 evolves over time."
date: "2026-10-11"
format: "explainer"
concept: "trajectories"
tldr: ["A trajectory is a time-ordered log of what a system did, saw, and decided \u2014 the 'what happened' record.", "In AI agents, trajectories aggregate multi-turn conversations, tool calls, and subagent handoffs into a readable session view.", "In robotics and vision, trajectories are continuous 3D paths of objects or body parts through space and time.", "Trajectories enable debugging, imitation learning, policy evaluation, and predictive modeling across domains.", "The representation varies: discrete event logs for agents, dense geometric tracks for vision, action chunks for control."]
references: ["S1: arXiv \u2014 TRAJDEBUG: Tracing Error Lifecycle to Identify Critical Failures in Long-Horizon Agent Trajectories \u2014 https://arxiv.org/abs/2608.06346v1", "S2: LangChain Blog \u2014 Trajectories now in LangSmith: A readable view of every agent session \u2014 https://www.langchain.com/blog/langsmith-trajectories-tracing", "S3: arXiv \u2014 MotionForesight: Re-purposing Video Models for Future 3D Scene-Flow Prediction \u2014 https://arxiv.org/abs/2607.16192v1", "S4: arXiv \u2014 On the estimation and validity of AI time horizons---a statistical look at the METR plot \u2014 https://arxiv.org/abs/2610.12466v1", "S5: arXiv \u2014 Coding Agents for Generalized Task and Motion Planning Problems \u2014 https://arxiv.org/abs/2609.30233v1", "S6: arXiv \u2014 Desktop-Delta Bench: Do Computer-Use Models Understand Desktop GUI Transitions? \u2014 https://arxiv.org/abs/2607.26041v1", "S7: Artificial Intelligence: A Modern Approach (Russell & Norvig) \u2014 AI Russell Norvig \u2014 part 992", "S8: arXiv \u2014 TrackEverything: Long Horizon Dense Tracking via De-Duplicating 3D Scene Representations \u2014 https://arxiv.org/abs/2609.30222v1", "S9: arXiv \u2014 GeoAAC: Geometry-Based Adaptive Action Chunking from Denoising Trajectories in VLA Policies \u2014 https://arxiv.org/abs/2609.20776v1", "S10: arXiv \u2014 StageGuard: Learning Stage Transitions for Long-Horizon Robot Tasks via Agentic Distillation \u2014 https://arxiv.org/abs/2609.20791v1", "S11: arXiv \u2014 HumanTracker: Towards Comprehensive and Human-Aligned Motion Tracking Benchmark \u2014 https://arxiv.org/abs/2608.13555v1", "S12: arXiv \u2014 DreamFly: Causal Memory and Receding-Horizon Diffusion Planning for Aerial Vision-Language Navigation \u2014 https://arxiv.org/abs/2608.12308v1", "S13: arXiv \u2014 Never Look Back: Understanding Persistence in 3D Object Memory from Egocentric Videos \u2014 https://arxiv.org/abs/2610.10538v1", "S14: arXiv \u2014 Long-WAM: Scaling the Context of World-Action Models \u2014 https://arxiv.org/abs/2610.10528v1"]
writer: "openrouter/nvidia/nemotron-3-ultra-550b-a55b:free"
fact_check: "passed"
diagram: "2026-10-11-trajectories-the-time-ordered-record-of-system-behavior.json"
audio: "2026-10-11-trajectories-the-time-ordered-record-of-system-behavior.mp3"
---

## What Is a Trajectory

A **trajectory** is a time-ordered sequence that records the evolution of a system. The term appears across AI agents, robotics, computer vision, and control theory — each field instantiates the same core idea differently.

At its most abstract, a trajectory is a function of time: \( \tau = (s_0, a_0, o_1, s_1, a_1, o_2, \dots) \) where \( s \) are states, \( a \) are actions, and \( o \) are observations. The sequence captures *what happened, in order*.

**In LLM-based agents**, a trajectory is the chronological log of a session: user messages, model responses, tool invocations, tool results, and any subagent interactions, flattened into a single conversational view [S2]. LangSmith's Trajectories feature aggregates these across turns and subagents so a developer can ask "what did the agent actually do?" without parsing nested trace spans.

**In robotics and vision**, a trajectory is a continuous geometric path: the 3D positions of an object's surface points or a robot's joints over time [S3][S8][S11]. MotionForesight predicts future 3D scene-flow trajectories from observed video [S3]; TrackEverything maintains persistent 3D point tracks across thousands of frames by deduplicating co-located observations in world coordinates [S8]; HumanTracker evaluates humanoid motion tracking against 153 hours of optical motion trajectories from professional performers [S11].

**In planning and control**, a trajectory is a predicted or executed action sequence — often "chunked" into fixed or adaptive horizons. GeoAAC adjusts action-chunk horizons by measuring the geometry of flow-matching denoising trajectories [S9]; DreamFly uses receding-horizon diffusion planning where a \( K \)-step action trajectory is predicted but only the first step executes before replanning [S12].

## Why Trajectories Matter

Trajectories turn ephemeral execution into inspectable, reusable data. Four capabilities depend on them:

**Debugging and root-cause analysis.** Long-horizon agent sessions span many turns, retries, and subagent handoffs. A full trace is too detailed; a trajectory shows the *path* the agent took so you can spot where behavior deviated [S2]. TRAJDEBUG goes further: it traces error lifecycles across long trajectories, compressing history at multiple granularities to identify the earliest error step responsible for final failure [S1]. On TrajErrBench (486 manually annotated failed trajectories from Tau2Bench and SWE-Bench Pro), this approach outperforms baselines at critical error attribution [S1].

**Imitation and policy learning.** Demonstration trajectories teach robots when to transition between skills. StageGuard distills teacher-model reasoning on demonstration trajectories into a lightweight student VLM that predicts stage transitions in real time [S10]. Coding agents synthesize programs by interacting with simulators and observing resulting trajectories, then freeze the program for generalized task-and-motion planning [S5].

**Predictive modeling.** Video models encode priors about how objects move. MotionForesight repurposes these priors to forecast future 3D trajectories from monocular video, without object property assumptions [S3]. Long-WAM scales causal world-action models by preserving autoregressive history-to-future structure: on RoboCasa GR-1, increasing visual context from 0 to 19.2 seconds raises success from 63.3% to 78.7% [S14].

**Evaluation and benchmarking.** Desktop-Delta Bench isolates whether computer-use models understand GUI *transitions* by testing on 2,013 human-verified step-level instances from multi-app Linux trajectories [S6]. HumanTracker replaces per-frame kinematic metrics with HumanScore, a preference-aligned metric trained on 24K motions that catches contact failures kinematic averages miss [S11].

## How It Works: Two Concrete Walkthroughs

### Agent Trajectory (LangSmith)

A user asks an agent to "book a flight and email the confirmation." The session spans:
1. User message → agent reasons → calls `search_flights` tool
2. Tool returns options → agent calls `book_flight`
3. Tool returns confirmation → agent calls `send_email`
4. Tool returns success → agent replies to user

A **trace** captures every span: LLM calls, tool I/O, latency, token counts, nested subagent runs. A **trajectory** aggregates these into a single chronological conversation: human → AI → tool → tool → AI → tool → AI → human. You read it top to bottom. You can score it with an online evaluator, save it to a dataset, or send it to an annotation queue for SME review — all without expanding nested spans [S2].

### Robot 3D Trajectory (TrackEverything)

A video shows a person manipulating a cup. The system:
1. Runs a dense 3D tracker (built on a pretrained video model) on short overlapping windows
2. At window boundaries, **voxelizes** tracks and merges co-located points — deduplicating repeated observations of the same surface [S8]
3. Classifies each point as static or dynamic; only dynamic points get dense trajectory refinement
4. Uses 3D WAFT (feature sampling in the scene cloud) instead of 4D correlation volumes, fitting 1000+ frames in 40 GB GPU memory

The output: persistent 3D scene tracks in world coordinates — a trajectory for every visible point, not just sparse queries.

## Key Techniques and Variants

| Domain | Representation | Key Innovation |
|---|---|---|
| **Agent observability** | Flattened event log (messages, tool calls, results) | Multi-granularity history compression for long-horizon error tracing [S1] |
| **Agent observability** | Conversational view with scoring/annotation hooks | Trajectories as first-class UI objects in LangSmith [S2] |
| **3D vision** | Dense per-point 3D tracks in world coordinates | Voxel deduplication + dynamic-only refinement + 3D WAFT [S8] |
| **3D vision** | Future 3D scene flow from observed video | Video-model priors redirected to 3D forecasting [S3] |
| **Humanoid tracking** | Optical motion trajectories (153 hrs, 4 families) | HumanScore: preference-aligned metric over kinematic error [S11] |
| **VLA control** | Action chunks from flow-matching denoising | GeoAAC: adaptive horizon from denoising trajectory geometry [S9] |
| **Navigation** | Receding-horizon diffusion action chunks | Plan-K, execute-one with causal memory + LiteStop termination [S12] |
| **World-action models** | Autoregressive video latents + actions | Long context only helps with AR-pretrained video foundations [S14] |
| **Stage transitions** | Demonstration trajectories + teacher explanations | Agentic distillation to lightweight student VLM [S10] |
| **GUI understanding** | Before-after frame pairs + temporal ordering | Desktop-Delta Bench: 2,013 verified transition instances [S6] |

**Discrete vs. continuous.** Agent trajectories are discrete event sequences. Robot/vision trajectories are continuous geometric curves, often sampled at frame rate. Planning trajectories sit between: discrete action tokens that imply continuous motion.

**Observed vs. predicted.** Observed trajectories come from execution or demonstration. Predicted trajectories come from models (diffusion, flow matching, autoregressive video). GeoAAC exploits the *geometry of predicted denoising trajectories* to gauge reliability [S9]. DreamFly predicts \( K \)-step chunks but executes open-loop only for one step [S12].

**Single-agent vs. multi-agent.** LangSmith trajectories aggregate across subagent handoffs [S2]. TRAJDEBUG handles multi-turn, multi-tool trajectories [S1]. Robot hierarchies (StageGuard) sequence skill trajectories [S10].

## Applications

**Agent debugging and improvement.** Trajectories let developers find root causes faster, collect SME feedback on readable sessions, and build datasets for fine-tuning from production behavior [S2]. TRAJDEBUG turns failed trajectories into actionable error attributions [S1].

**Robot skill learning and transfer.** StageGuard learns stage-transition classifiers from demonstration trajectories, enabling hierarchical policies that run on real robots [S10]. Coding agents synthesize generalized TAMP programs by exploring simulators and observing resulting trajectories [S5].

**Video understanding and prediction.** MotionForesight forecasts 3D object motion from monocular video [S3]. TrackEverything builds persistent 3D scene representations from long video [S8]. Long-WAM scales context for real-time robot control [S14].

**Benchmarking and evaluation.** Desktop-Delta Bench tests GUI transition understanding on real multi-app trajectories [S6]. HumanTracker provides perceptually aligned humanoid tracking evaluation [S11]. TrajErrBench provides 486 annotated failed agent trajectories [S1].

**Memory and spatial reasoning.** Ledger builds persistent 3D object memory from egocentric video trajectories, clustering observations by resting location and retaining objects after they leave view [S13].

## Trade-offs and Limitations

**Storage and compute.** Dense 3D trajectories (TrackEverything) track all visible points across 1000+ frames within 40 GB GPU — a breakthrough, but still resource-intensive [S8]. Agent trajectories are lighter but grow with session length; multi-granularity compression helps [S1].

**Observability vs. privacy.** Trajectories record user interactions, tool outputs, and potentially sensitive data. Production systems need redaction and access controls.

**Representation mismatch.** A trajectory optimized for debugging (readable, high-level) differs from one optimized for imitation learning (dense, low-level). Converting between representations loses information.

**Causal vs. correlational.** Observed trajectories show *what happened*, not *why*. TRAJDEBUG addresses this by tracing error lifecycles, but attribution remains inferential [S1]. In robotics, demonstration trajectories conflate intent with noise.

**Simulation-to-real gap.** Trajectories from simulators (TAMP [S5], LIBERO [S9][S14]) may not transfer. Real-world validation matters: StageGuard validates on real robots [S10]; GeoAAC reports real-world success rising from 53.3% to 74.4% [S9].

**When not to use trajectories.** If your system is single-turn, stateless, or fully observable at each step, a trajectory adds overhead without insight. If you need only aggregate metrics (success rate, latency), logs suffice. Trajectories pay off when *sequence structure* and *temporal dependencies* matter.

## Further Reading

- **TRAJDEBUG** — Error-lifecycle tracing for long-horizon agent trajectories with TrajErrBench (486 annotated failures) [S1]
- **LangSmith Trajectories** — Conversational view of agent sessions with scoring, annotation, and dataset export [S2]
- **MotionForesight** — Repurposing video models for future 3D scene-flow prediction from monocular video [S3]
- **TrackEverything** — Long-horizon dense 3D tracking via voxel deduplication and 3D WAFT (1000+ frames, 40 GB) [S8]
- **GeoAAC** — Geometry-based adaptive action chunking from flow-matching denoising trajectories (real-world 53.3% → 74.4%) [S9]
- **StageGuard** — Agentic distillation of stage transitions from demonstration trajectories for hierarchical robot control [S10]
- **HumanTracker** — 153-hour optical motion trajectory benchmark with HumanScore preference metric [S11]
- **DreamFly** — Causal memory + receding-horizon diffusion planning for aerial VLN [S12]
- **Ledger** — Persistent 3D object memory from egocentric video trajectories [S13]
- **Long-WAM** — Scaling context of causal world-action models under real-time constraints (0→19.2s context: 63.3%→78.7%) [S14]
- **Desktop-Delta Bench** — Step-level GUI transition benchmark on 2,013 verified multi-app Linux trajectories [S6]
- **Russell & Norvig** — Recursive Bayesian filtering for state trajectories in robot perception [S7]

## References

- S1: arXiv — TRAJDEBUG: Tracing Error Lifecycle to Identify Critical Failures in Long-Horizon Agent Trajectories — https://arxiv.org/abs/2608.06346v1
- S2: LangChain Blog — Trajectories now in LangSmith: A readable view of every agent session — https://www.langchain.com/blog/langsmith-trajectories-tracing
- S3: arXiv — MotionForesight: Re-purposing Video Models for Future 3D Scene-Flow Prediction — https://arxiv.org/abs/2607.16192v1
- S4: arXiv — On the estimation and validity of AI time horizons---a statistical look at the METR plot — https://arxiv.org/abs/2610.12466v1
- S5: arXiv — Coding Agents for Generalized Task and Motion Planning Problems — https://arxiv.org/abs/2609.30233v1
- S6: arXiv — Desktop-Delta Bench: Do Computer-Use Models Understand Desktop GUI Transitions? — https://arxiv.org/abs/2607.26041v1
- S7: Artificial Intelligence: A Modern Approach (Russell & Norvig) — AI Russell Norvig — part 992
- S8: arXiv — TrackEverything: Long Horizon Dense Tracking via De-Duplicating 3D Scene Representations — https://arxiv.org/abs/2609.30222v1
- S9: arXiv — GeoAAC: Geometry-Based Adaptive Action Chunking from Denoising Trajectories in VLA Policies — https://arxiv.org/abs/2609.20776v1
- S10: arXiv — StageGuard: Learning Stage Transitions for Long-Horizon Robot Tasks via Agentic Distillation — https://arxiv.org/abs/2609.20791v1
- S11: arXiv — HumanTracker: Towards Comprehensive and Human-Aligned Motion Tracking Benchmark — https://arxiv.org/abs/2608.13555v1
- S12: arXiv — DreamFly: Causal Memory and Receding-Horizon Diffusion Planning for Aerial Vision-Language Navigation — https://arxiv.org/abs/2608.12308v1
- S13: arXiv — Never Look Back: Understanding Persistence in 3D Object Memory from Egocentric Videos — https://arxiv.org/abs/2610.10538v1
- S14: arXiv — Long-WAM: Scaling the Context of World-Action Models — https://arxiv.org/abs/2610.10528v1
