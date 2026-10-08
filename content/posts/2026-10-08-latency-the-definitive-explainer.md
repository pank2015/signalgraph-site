---
title: "Latency: The Definitive Explainer"
description: "A thorough technical guide to latency \u2014 what it is, why it matters, how it works, key techniques, real-world applications, and honest trade-offs."
date: "2026-10-08"
format: "explainer"
concept: "latency"
tldr: ["Latency is the time between a request and its response; it dominates user experience and system economics at scale.", "Tail latency (p99, p999) matters more than averages \u2014 a few slow requests can cascade into system-wide degradation.", "Multi-region architectures can cut latency 35% via routing alone before adding new regions [S3].", "Workload-specific kernel scheduling reduced Meta's ads retrieval p99 latency by 28% and saved 3.28 MW [S10].", "Direct-access data architectures (e.g., Valkey) achieve microsecond latency by eliminating proxy overhead [S11]."]
references: ["S1: Measuring Input Latency on Linux: X11 vs. Wayland, VRR, and DXVK \u2014 https://marco-nett.de/blog/measuring-input-latency-on-linux-x11-vs-wayland-vrr-dxvk/", "S3: Trade-Offs in Multi-Region Architectures: Latency vs. Cost \u2014 https://www.infoq.com/articles/multi-region-latency-cost-tradeoffs/", "S4: AI Engineering by Chip Huyen \u2014 Chapter 9 latency metrics \u2014 pack://ai-engineering-by-chip-huyen", "S5: Networking and the Internet, from First Principles \u2014 https://fazamhd.com/mental-models/networking/", "S6: Thinking Fast & Slow for a Personalized Notification System \u2014 https://netflixtechblog.com/thinking-fast-slow-for-a-personalized-notification-system-4d89b26525cd", "S9: Incremental \u2013 A library for incremental computations \u2014 https://github.com/janestreet/incremental", "S10: Modernizing the Meta Ads Service With an Open-Source Kernel Scheduler \u2014 https://engineering.fb.com/2026/07/13/ml-applications/modernizing-the-meta-ads-service-with-an-open-source-kernel-scheduler/", "S11: From ms to \u00b5s: OSS Valkey Architecture Patterns for Modern AI \u2014 https://www.infoq.com/presentations/valkey-architecture-patterns/", "S12: Adaptive Instructed-Retriever: Frontier-Quality Search at 2x Lower Latency \u2014 https://www.databricks.com/blog/adaptive-instructed-retriever-frontier-quality-search-2x-lower-latency", "S14: Scaling Java-Based Real-Time Systems: The Hidden Tradeoffs of Event-Driven Design \u2014 https://www.infoq.com/articles/tradeoffs-event-driven-design/"]
writer: "openrouter/nvidia/nemotron-3-ultra-550b-a55b:free"
fact_check: "passed"
diagram: "2026-10-08-latency-the-definitive-explainer.json"
---

## What Latency Is

Latency is the elapsed time between initiating an action and observing its effect. In computing, it measures the delay between a request — a keystroke, an API call, a database query — and the corresponding response. The unit is time: milliseconds (ms) for most networked systems, microseconds (µs) for in-memory data layers, nanoseconds (ns) for CPU-cache interactions.

A useful analogy: bandwidth is the width of a highway (how many cars per second), latency is the time a single car takes to travel from on-ramp to exit. You can widen the highway (add bandwidth) without shortening the trip (reducing latency). Conversely, a narrow, short road can have low latency but low throughput.

Latency decomposes into components that stack in series:

* **Propagation delay** — physics-bound time for signals to traverse distance (light in fiber: ~5 µs/km).
* **Transmission delay** — time to push bits onto the link (packet size / bandwidth).
* **Processing delay** — time spent in routers, switches, OS kernels, application code.
* **Queueing delay** — time waiting for contested resources (CPU, lock, disk, network buffer).

The last two are where engineering lives. Propagation and transmission are largely fixed by geography and link speed; processing and queueing are where architecture, scheduling, and data-structure choices make the difference.

## Why Latency Matters

Latency directly shapes user perception and business outcomes. Human perceptual thresholds are well studied: ~100 ms feels instantaneous; ~300 ms feels sluggish; >1 s breaks flow. In interactive systems — gaming, trading, web apps — latency *is* the product.

At scale, tail latency dominates. A system with 1 ms average latency but 500 ms p99 will feel broken to every user who hits the tail. Tail requests consume disproportionate resources (retries, timeouts, cascade failures) and distort capacity planning. Meta's ads fleet processes over 5 million requests per second (400+ billion daily); a few milliseconds of p99 regression measurably degrades ad relevance and advertiser ROI [S10].

Latency also compounds in distributed call chains. A service calling three dependencies at p99 10 ms each yields a p99 far worse than 30 ms — the probability of *any* dependency hitting its tail approaches 1 as fan-out grows. This is why latency budgets (allocating a total budget across hops) are standard practice in service-oriented architectures.

## How Latency Works: A Concrete Walkthrough

Consider a user clicking a button in a web app backed by a microservice architecture:

1. **Input capture** — OS interrupt → browser event loop. On Linux, the display server (X11 or Wayland) and compositor add measurable latency; VRR (Variable Refresh Rate) and DXVK (DirectX-to-Vulkan translation) introduce further variance [S1].
2. **Network transit** — TLS handshake (if new connection), TCP slow-start, propagation to load balancer.
3. **Load balancer** — routing decision, possibly cross-zone.
4. **API gateway** — auth, rate limiting, request transformation.
5. **Application service** — business logic, often fan-out to:
   - **Cache** (Redis/Valkey) — ideally sub-millisecond.
   - **Database** — index lookup, disk I/O, lock contention.
   - **Downstream services** — RPC with their own latencies.
6. **Response assembly** — serialization, compression, back through the chain.

Each hop adds processing and queueing delay. Under load, queueing grows non-linearly (Little's Law: L = λW). A 10% utilization increase near saturation can double queueing delay.

**Key metrics** (from LLM serving but broadly applicable) [S4]:
* **Time to First Token (TTFT)** — time until first byte of response; critical for streaming UX.
* **Time Per Output Token (TPOT)** — incremental cost per unit of output.
* **Total latency** — end-to-end completion time.
* Track these *per user* to see scaling behavior under concurrent load.

## Key Techniques and Variants

### 1. Reduce Work (Algorithmic / Data-Structure)
* **Incremental computation** — recompute only what changed. Jane Street's Incremental library propagates changes through a dependency graph, turning O(n) recomputes into O(changed) [S9].
* **Adaptive retrieval** — Databricks' Adaptive Instructed-Retriever achieves frontier-quality search at 2× lower latency by dynamically selecting retrieval strategies [S12].

### 2. Move Compute Closer (Topology)
* **Multi-region deployment** — place replicas near users. A phased approach: first optimize routing (cut latency 35% [S3]), then add regions to push p99 under 60 ms.
* **Edge computing** — run logic at CDN PoPs or cell towers.

### 3. Eliminate Hops and Copies (Data Path)
* **Direct-access data layers** — Valkey (Redis fork) removes proxy sidecars, achieving microsecond latency by letting clients talk directly to shards [S11]. Proxies add CPU overhead, tail latency, and blast radius.
* **Kernel-bypass networking** — DPDK, io_uring, XDP move packet processing to userspace, avoiding kernel context switches.

### 4. Scheduling and Prioritization (Resource Contention)
* **Workload-aware scheduling** — Meta built a custom `sched_ext` (BPF-based) scheduler for ads retrieval, cutting p99 latency 28%, saving 3.28 MW, and increasing ads ranked 1.1% [S10]. General-purpose CFS cannot optimize for tail latency of specific workloads.
* **Priority inversion avoidance** — priority inheritance, lock-free data structures.

### 5. Architectural Patterns
* **Dual-path (fast/slow) decomposition** — Netflix's notification system separates a fast "act" path (immediate send decision) from a slow "plan" path (long-term optimization) [S6], mirroring Kahneman's System 1 / System 2. Robotics and LLM agents use the same pattern.
* **Event-driven vs. request-response** — Event-driven decouples latency from throughput but adds queueing variance and debugging complexity [S14].

## Applications

### Real-Time Ad Serving (Meta)
5M+ req/s, p99 latency directly ties to revenue. Custom kernel scheduler + BPF = 28% p99 improvement [S10].

### AI Feature Stores / Vector Search (Valkey)
Microsecond latency for feature lookup enables real-time personalization and fraud detection. Direct-access architecture removes proxy tax [S11].

### Interactive Linux Desktop (Gaming / VR)
Input latency measurement reveals X11 vs. Wayland differences, VRR impact, DXVK overhead [S1]. Sub-10 ms end-to-end is target for competitive gaming.

### Multi-Region Web Services
Routing optimization alone cut latency 35% before new region deployment brought p99 under 60 ms [S3]. Framework: decompose latency budget → choose deployment pattern by consistency/traffic profile → optimize → expand.

### High-Frequency Trading
Microsecond and nanosecond optimization: kernel bypass, FPGA offload, colocation, custom NICs. Latency *is* alpha.

### LLM Inference Serving
TTFT and TPOT are the user-facing metrics; batching improves throughput but hurts TTFT. Continuous batching, speculation, and KV-cache management are active research [S4].

## Trade-offs and Limitations

### Latency vs. Throughput
Batching increases throughput but adds queueing delay (wait for batch to fill). Continuous batching mitigates but adds scheduler complexity.

### Latency vs. Consistency
Strong consistency (linearizability) requires coordination (quorum, consensus) — adds round-trips. Eventual consistency lowers latency but shifts complexity to application (conflict resolution, read-your-writes).

### Latency vs. Cost
Multi-region reduces latency but multiplies infrastructure cost (replication, data transfer, operational complexity). The InfoQ framework emphasizes optimizing *before* expanding [S3].

### Latency vs. Observability
Adding tracing, metrics, logging *adds* latency. Sampling helps but loses tail visibility — exactly where you need it most.

### When NOT to Optimize Latency
* **Batch / offline workloads** — throughput and cost dominate; latency is irrelevant.
* **Already below perceptual threshold** — pushing 5 ms → 2 ms on a background API yields no user value.
* **High variance, low volume** — optimizing the tail of a rarely-used endpoint wastes engineering time.

### Measurement Pitfalls
* **Averages hide tails** — always report p50, p95, p99, p999.
* **Coordinated omission** — measuring only completed requests misses timed-out ones; use HdrHistogram or similar.
* **Instrumentation overhead** — eBPF / kernel tracing adds less noise than userspace probes.

## Further Reading

* **Measuring Input Latency on Linux** — Marco Nett's deep dive into X11, Wayland, VRR, DXVK measurement methodology [S1]
* **Trade-Offs in Multi-Region Architectures** — Uttara Asthana's framework for latency budgeting and phased region expansion [S3]
* **AI Engineering (Chip Huyen)** — Chapter 9 on latency metrics (TTFT, TPOT) for LLM serving [S4]
* **Networking from First Principles** — Fazal Majid's mental models for propagation, queueing, congestion [S5]
* **Modernizing Meta Ads with sched_ext** — BPF-based kernel scheduling for tail-latency reduction [S10]
* **Valkey Architecture Patterns** — Dumanshu Goyal on direct-access microsecond data layers [S11]
* **Adaptive Instructed-Retriever** — Databricks' 2× latency reduction via adaptive retrieval [S12]
* **Event-Driven Design Trade-offs** — Sagar Deepak Joshi on Java/Kafka real-time systems at 80k BHCC [S14]

## References

- S1: Measuring Input Latency on Linux: X11 vs. Wayland, VRR, and DXVK — https://marco-nett.de/blog/measuring-input-latency-on-linux-x11-vs-wayland-vrr-dxvk/
- S3: Trade-Offs in Multi-Region Architectures: Latency vs. Cost — https://www.infoq.com/articles/multi-region-latency-cost-tradeoffs/
- S4: AI Engineering by Chip Huyen — Chapter 9 latency metrics — pack://ai-engineering-by-chip-huyen
- S5: Networking and the Internet, from First Principles — https://fazamhd.com/mental-models/networking/
- S6: Thinking Fast & Slow for a Personalized Notification System — https://netflixtechblog.com/thinking-fast-slow-for-a-personalized-notification-system-4d89b26525cd
- S9: Incremental – A library for incremental computations — https://github.com/janestreet/incremental
- S10: Modernizing the Meta Ads Service With an Open-Source Kernel Scheduler — https://engineering.fb.com/2026/07/13/ml-applications/modernizing-the-meta-ads-service-with-an-open-source-kernel-scheduler/
- S11: From ms to µs: OSS Valkey Architecture Patterns for Modern AI — https://www.infoq.com/presentations/valkey-architecture-patterns/
- S12: Adaptive Instructed-Retriever: Frontier-Quality Search at 2x Lower Latency — https://www.databricks.com/blog/adaptive-instructed-retriever-frontier-quality-search-2x-lower-latency
- S14: Scaling Java-Based Real-Time Systems: The Hidden Tradeoffs of Event-Driven Design — https://www.infoq.com/articles/tradeoffs-event-driven-design/
