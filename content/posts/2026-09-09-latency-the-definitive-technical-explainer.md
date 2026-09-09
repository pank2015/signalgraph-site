---
title: "Latency: The Definitive Technical Explainer"
description: "A thorough grounding in latency \u2014 what it is, why it dominates system design, how to measure and reduce it, and where the hard trade-offs live."
date: "2026-09-09"
format: "explainer"
concept: "latency"
tldr: ["Latency is the time between a request and its response; it is not throughput, though the two interact.", "Human-perceptible thresholds (100 ms, 16 ms, 1 ms) drive very different engineering strategies.", "Tail latency (p99, p99.9) often matters more than average \u2014 a few slow requests can dominate user experience and revenue.", "Reducing latency requires attacking every layer: network physics, kernel scheduling, serialization, queueing, and application logic.", "There is no free lunch: lowering latency typically increases cost, complexity, or reduces consistency guarantees."]
references: ["S1: Hacker News \u2014 Measuring Input Latency on Linux: X11 vs. Wayland, VRR, and DXVK \u2014 https://marco-nett.de/blog/measuring-input-latency-on-linux-x11-vs-wayland-vrr-dxvk/", "S3: InfoQ Architecture \u2014 Trade-Offs in Multi-Region Architectures: Latency vs. Cost \u2014 https://www.infoq.com/articles/multi-region-latency-cost-tradeoffs/", "S4: AI Engineering (Chip Huyen) \u2014 AI Engineering by Chip Huyen \u2014 part 434 \u2014 pack://ai-engineering-by-chip-huyen", "S5: Hacker News \u2014 Networking and the Internet, from First Principles \u2014 https://fazamhd.com/mental-models/networking/", "S6: Netflix TechBlog \u2014 Thinking Fast & Slow for a Personalized Notification System \u2014 https://netflixtechblog.com/thinking-fast-slow-for-a-personalized-notification-system-4d89b26525cd", "S9: Hacker News \u2014 Incremental \u2013 A library for incremental computations \u2014 https://github.com/janestreet/incremental", "S10: Meta Engineering \u2014 Modernizing the Meta Ads Service With an Open-Source Kernel Scheduler \u2014 https://engineering.fb.com/2026/07/13/ml-applications/modernizing-the-meta-ads-service-with-an-open-source-kernel-scheduler/", "S11: InfoQ Architecture \u2014 From ms to \u00b5s: OSS Valkey Architecture Patterns for Modern AI \u2014 https://www.infoq.com/presentations/valkey-architecture-patterns/", "S13: InfoQ Architecture \u2014 Scaling Java-Based Real-Time Systems: The Hidden Tradeoffs of Event-Driven Design \u2014 https://www.infoq.com/articles/tradeoffs-event-driven-design/", "S14: arXiv \u2014 Campaign Diagrams: Visualizing the March Through the Phases of a Workload \u2014 https://arxiv.org/abs/2607.15225v1"]
writer: "openrouter/nvidia/nemotron-3-ultra-550b-a55b:free"
fact_check: "passed"
diagram: "2026-09-09-latency-the-definitive-technical-explainer.json"
---

## What Latency Is

Latency is the elapsed time between initiating an action and observing its result. In a computer system, it is the interval from when a request is issued — a keystroke, an API call, a database query — to when the corresponding response becomes available. The unit is time: milliseconds (ms), microseconds (µs), or nanoseconds (ns).

A useful analogy: latency is the length of a pipe; throughput is its diameter. You can push more water per second through a wider pipe (higher throughput), but the time for a single molecule to travel from end to end (latency) depends on the pipe's length and the fluid's velocity. Making the pipe wider does not shorten it.

Latency decomposes into three fundamental components:

*   **Propagation delay** — the time for a signal to traverse a medium. In fiber, light travels ~200 km/ms. The round-trip between New York and London is ~60 ms physics; you cannot optimize this away.
*   **Transmission delay** — the time to push bits onto the link. A 1500-byte packet on a 1 Gbps link takes ~12 µs.
*   **Processing delay** — time spent in routers, switches, OS kernels, runtimes, and application code. This is where engineering effort concentrates.

Queueing delay — time spent waiting for a shared resource — is often the largest and most variable component. It is the difference between an empty highway and rush hour.

## Why Latency Matters

Latency directly shapes user experience and business outcomes. The canonical thresholds come from human perception research:

*   **~100 ms** — the threshold for feeling "instantaneous." Jakob Nielsen's 1993 guideline remains the industry benchmark for interactive response.
*   **~16 ms** — the frame budget for 60 Hz displays. Missing it causes visible jank.
*   **~1 ms** — the target for high-frequency trading, real-time control loops, and modern AI inference pipelines.

Beyond perception, tail latency drives revenue. At Meta's ads serving fleet — over 5 million requests per second at peak, 400 billion per day — a few milliseconds of p99 regression measurably reduces ad relevance and advertiser ROI [S10]. The team built a custom BPF-based kernel scheduler (`sched_ext`) to reclaim 28% of p99 latency in the ads retrieval stage, yielding a 1.1% increase in ads ranked and 3.28 MW power savings [S10].

In multi-region architectures, latency determines consistency models and deployment topology. A phased optimization approach at one organization cut latency 35% through routing changes alone before adding a new region brought p99 under 60 ms [S3]. The lesson: decompose your latency budget before committing infrastructure.

For LLM serving, latency decomposes into distinct user-facing metrics: Time to First Token (TTFT), Time Per Output Token (TPOT), and total latency [S4]. TTFT governs perceived responsiveness; TPOT governs streaming smoothness. Both must be tracked per user to understand scaling behavior.

## How Latency Works: A Concrete Walk-Through

Consider a user clicking a button in a web app that triggers a personalized recommendation.

1.  **Input capture** — The OS reads the hardware interrupt. On Linux, the display server (X11 or Wayland) and compositor add frames of latency. Measurements show Wayland + VRR can reduce input-to-photon latency versus X11, but the stack matters: DXVK translation layers add overhead [S1].
2.  **Network transit** — The HTTP/2 or gRPC request traverses the client's network, ISP, CDN, and load balancer. Each hop adds processing and queueing delay.
3.  **Edge termination** — TLS termination, request parsing, routing. A proxy (Envoy, NGINX) typically adds 0.5–2 ms.
4.  **Application logic** — The service fetches user context from a feature store, runs a model, assembles a response. This is where "fast vs. slow" architecture appears: Netflix's notification system separates a fast "act" path (immediate send decision) from a slow "plan" path (long-term optimization) [S6], mirroring Kahneman's System 1 / System 2.
5.  **Data access** — The feature store read. A proxy-based Redis architecture adds CPU overhead and tail latency from the extra hop. Direct-access Valkey architectures eliminate the proxy, achieving microsecond-level p99 by letting the client talk directly to shards [S11].
6.  **Response path** — Serialization, compression, network return, client rendering.

At each stage, queueing dominates variance. A request arriving when a CPU core is saturated waits in a run queue; a database connection pool exhaustion adds seconds. The "campaign diagram" visualization technique captures this by plotting compute throughput, memory bandwidth, and latency across workload phases, revealing bottlenecks that roofline models miss [S14].

## Key Techniques and Variants

### Measure First, Optimize Second
You cannot improve what you do not instrument. The gold standard is distributed tracing (OpenTelemetry, Zipkin) with percentile histograms (p50, p95, p99, p99.9). For LLM workloads, track TTFT, TPOT, and total latency per user [S4]. Spot-check sampling works for baseline monitoring; exhaustive capture is necessary for tail investigation.

### Eliminate Hops
Every network hop adds ~0.5–2 ms and a failure domain. Direct-access data layers (Valkey, Aerospike, ScyllaDB) bypass proxies. Jane Street's `Incremental` library applies the same principle to computation: recompute only what changed, avoiding full graph re-evaluation [S9].

### Kernel and Scheduler Tuning
General-purpose schedulers (CFS) optimize for fairness, not tail latency. Meta's `sched_ext` policy pins latency-sensitive ads threads to dedicated cores, uses BPF to make scheduling decisions in-kernel, and avoids cross-CPU migrations [S10]. This is specialized work: it requires deep kernel expertise and workload characterization.

### Request Hedging and Redundancy
For idempotent reads, send duplicate requests to multiple replicas; return the first response. This trades extra load for tail latency reduction. Effective when the tail is caused by garbage collection pauses or lock contention.

### Asynchronous Pipelining
Overlap computation stages. In LLM inference, prefill and decode can overlap across requests (continuous batching). In data pipelines, campaign diagrams expose fusion opportunities across phases [S14].

### Caching and Precomputation
Move work off the critical path. Netflix precomputes notification candidates offline; the online path only ranks and selects [S6]. The trade-off: staleness vs. latency.

## Applications

**High-frequency trading** — Microsecond latency determines fill rates. Firms deploy FPGAs, kernel bypass (DPDK), and colocation to shave nanoseconds.

**Real-time gaming and VR** — Input-to-photon latency under 20 ms prevents motion sickness. The Linux display stack (X11 vs. Wayland, VRR, compositor choice) is a measurable factor [S1].

**Ad serving and recommendation** — Meta's 5M req/s fleet shows p99 latency directly correlates with revenue [S10].

**LLM serving** — TTFT and TPOT are the new SLIs. Chip Huyen emphasizes tracking both per user to detect scaling regressions [S4].

**Multi-region databases** — Read replicas, synchronous vs. asynchronous replication, consensus protocols (Raft, Paxos) — every choice is a latency/consistency/availability trade-off [S3].

**Event-driven systems** — Java/Kafka platforms at scale (80k BHCC, 10k agents) hit partition limits, deduplication overhead, and cascading consumer failures that manifest as latency spikes [S13]. Redis-backed patterns (idempotency keys, distributed locks) mitigate but add their own latency.

## Trade-offs and Limitations

**Cost vs. Latency** — Dedicated cores, kernel bypass, colocation, and provisioned throughput (DynamoDB, Provisioned Concurrency) cost money. The 35% routing-only improvement [S3] is the exception; usually you pay.

**Complexity vs. Latency** — Custom schedulers [S10], direct-access data layers [S11], and hedged reads increase operational surface area. Debugging a BPF scheduler or a split-brain Valkey cluster is harder than tuning a connection pool.

**Consistency vs. Latency** — Strong consistency (linearizability) requires cross-region coordination. The CAP theorem is not a suggestion; it is a latency budget constraint. Eventual consistency buys latency but demands application-level conflict resolution.

**Throughput vs. Latency** — Batching increases throughput but adds queueing delay. Continuous batching in LLM serving mitigates this but requires sophisticated scheduling.

**Measurement Noise** — LLM-as-a-judge evaluations show that even byte-identical requests to the same model can return different rankings, with Spearman correlation as low as 0.40 in same-window repeats [S8]. If your latency metric depends on an LLM evaluator, your measurement instrument may be noisier than the signal.

**When NOT to Optimize Latency**

*   Batch/offline workloads where completion time matters, not per-request latency.
*   Systems where the bottleneck is external (user think time, third-party API).
*   Early-stage products where feature velocity dominates. Premature optimization of p99 is a classic trap.

## Further Reading

*   **Measuring Input Latency on Linux** — Marco Nett's deep dive into X11 vs. Wayland, VRR, and DXVK measurement methodology [S1]
*   **Trade-Offs in Multi-Region Architectures** — Uttara Asthana's framework for latency budgeting and phased deployment [S3]
*   **AI Engineering (Chip Huyen)** — Chapter 9 on LLM latency metrics (TTFT, TPOT) and monitoring strategies [S4]
*   **Networking from First Principles** — Fazal Majid's mental models for propagation, transmission, and queueing delay [S5]
*   **Modernizing Meta Ads with sched_ext** — Kernel-level tail latency optimization at 5M req/s [S10]
*   **Valkey Architecture Patterns for Modern AI** — Dumanshu Goyal on direct-access microsecond latency [S11]
*   **Campaign Diagrams** — Phase-level latency visualization for compute and memory-bound workloads [S14]
*   **Scaling Java Event-Driven Systems** — Production trade-offs at 80k BHCC [S13]

## References

- S1: Hacker News — Measuring Input Latency on Linux: X11 vs. Wayland, VRR, and DXVK — https://marco-nett.de/blog/measuring-input-latency-on-linux-x11-vs-wayland-vrr-dxvk/
- S3: InfoQ Architecture — Trade-Offs in Multi-Region Architectures: Latency vs. Cost — https://www.infoq.com/articles/multi-region-latency-cost-tradeoffs/
- S4: AI Engineering (Chip Huyen) — AI Engineering by Chip Huyen — part 434 — pack://ai-engineering-by-chip-huyen
- S5: Hacker News — Networking and the Internet, from First Principles — https://fazamhd.com/mental-models/networking/
- S6: Netflix TechBlog — Thinking Fast & Slow for a Personalized Notification System — https://netflixtechblog.com/thinking-fast-slow-for-a-personalized-notification-system-4d89b26525cd
- S9: Hacker News — Incremental – A library for incremental computations — https://github.com/janestreet/incremental
- S10: Meta Engineering — Modernizing the Meta Ads Service With an Open-Source Kernel Scheduler — https://engineering.fb.com/2026/07/13/ml-applications/modernizing-the-meta-ads-service-with-an-open-source-kernel-scheduler/
- S11: InfoQ Architecture — From ms to µs: OSS Valkey Architecture Patterns for Modern AI — https://www.infoq.com/presentations/valkey-architecture-patterns/
- S13: InfoQ Architecture — Scaling Java-Based Real-Time Systems: The Hidden Tradeoffs of Event-Driven Design — https://www.infoq.com/articles/tradeoffs-event-driven-design/
- S14: arXiv — Campaign Diagrams: Visualizing the March Through the Phases of a Workload — https://arxiv.org/abs/2607.15225v1
