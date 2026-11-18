---
title: "Latency: The Definitive Explainer"
description: "A thorough technical guide to latency \u2014 what it is, why it dominates system design, how to measure and reduce it, and the hard trade-offs every engineer faces."
date: "2026-11-18"
format: "explainer"
concept: "latency"
tldr: ["Latency is the time between a request and its response; it compounds across every hop in a system.", "Tail latency (P99, P999) matters more than averages for user experience and SLOs.", "Queueing delay is often the largest and most variable component \u2014 observability must capture distributions, not just averages.", "Reducing latency usually costs money (more regions, better hardware, smaller models) or consistency (async, eventual models).", "In LLM inference, new latency metrics (TTFT, TPOT) and synchronization overhead dominate at scale."]
references: ["S1: Hacker News \u2014 Measuring Input Latency on Linux: X11 vs. Wayland, VRR, and DXVK \u2014 https://marco-nett.de/blog/measuring-input-latency-on-linux-x11-vs-wayland-vrr-dxvk/", "S2: InfoQ Architecture \u2014 Presentation: Uncorking Queueing Bottlenecks with OpenTelemetry \u2014 https://www.infoq.com/presentations/opentelemetry-queue-observability/", "S4: InfoQ Architecture \u2014 Article: Trade-Offs in Multi-Region Architectures: Latency vs. Cost \u2014 https://www.infoq.com/articles/multi-region-latency-cost-tradeoffs/", "S5: AI Engineering (Chip Huyen) \u2014 AI Engineering by Chip Huyen \u2014 part 434 \u2014 pack://ai-engineering-by-chip-huyen", "S6: Hacker News \u2014 Networking and the Internet, from First Principles \u2014 https://fazamhd.com/mental-models/networking/", "S7: arXiv \u2014 Weight Placement Is Not Enough: Synchronization in Multi-Node CPU Decoding of Ternary LLMs \u2014 https://arxiv.org/abs/2610.28620v1", "S10: InfoQ Architecture \u2014 Presentation: Scaling LLM-Based Ranking Systems for Latency-Critical Search & Recommendation Workloads \u2014 https://www.infoq.com/presentations/scale-llm-ranking-systems-linkedin/"]
writer: "openrouter/nvidia/nemotron-3-ultra-550b-a55b:free"
fact_check: "passed"
diagram: "2026-11-18-latency-the-definitive-explainer.json"
---

## What Latency Is

Latency is the elapsed time between initiating an action and observing its effect. In computing, it is the interval between a request leaving a client and the corresponding response arriving back. The unit is time — milliseconds, microseconds, or nanoseconds depending on the domain.

A useful mental model: **latency is the length of the pipe**, while **bandwidth is its diameter**. You can pump more data through a wide pipe (high bandwidth), but the time for the first drop to travel from end to end (latency) is governed by physics and system design. A 1 Gbps link across the Atlantic has the same ~60 ms round-trip latency as a 100 Mbps link across the same distance; bandwidth does not shrink the distance.

Latency decomposes into four canonical components (settled networking theory):

1. **Propagation delay** — time for a signal to traverse the medium. Bounded by the speed of light (~200,000 km/s in fiber). New York to London is ~5,600 km, so one-way propagation is ~28 ms; round-trip is ~56 ms. No engineering eliminates this.
2. **Transmission delay** — time to push all bits onto the link. Packet size divided by link rate. A 1,500-byte packet on a 1 Gbps link takes ~12 µs.
3. **Processing delay** — time a router, switch, or host spends examining headers, making forwarding decisions, or executing application logic.
4. **Queueing delay** — time a packet waits in a buffer because the outgoing link is busy. This is the most variable component and the primary source of tail latency.

In distributed systems, these components repeat at every hop: client → load balancer → API gateway → service A → service B → database → back again. Latency **compounds serially** (sum of each hop) and **forks in parallel** (slowest branch determines overall latency).

## Why Latency Matters

Latency directly shapes user experience, revenue, and system correctness.

**Human perception thresholds** are well-studied: ~100 ms feels instantaneous; ~300 ms feels sluggish; ~1,000 ms breaks flow. For interactive applications (gaming, VR, typing), input-to-photon latency under 20 ms is the target. On Linux, measuring this requires capturing the full chain: keyboard interrupt → kernel → compositor → GPU → display refresh. Methodologies now exist to compare X11 vs. Wayland, VRR (variable refresh rate), and translation layers like DXVK with sub-millisecond precision [S1].

**Tail latency dominates reliability**. Averages hide outliers. A service with 50 ms average latency but 2-second P99 will feel broken to every 100th user. In distributed asynchronous queues, traditional metrics (throughput, queue depth) fall short because they don't reveal *why* a specific request stalled. Gearset replaced guesswork with OpenTelemetry tracing to implement user-centric SLOs based on latency distributions, exposing queueing bottlenecks that metrics alone missed [S2].

**Latency budgets drive architecture**. Before adding a cloud region, you must decompose your latency budget: how much for DNS, TLS, network, application, database? A phased approach at one company cut latency 35% through routing optimization alone, before a new region brought it under 60 ms [S4].

**In LLM inference, latency has new dimensions**. Chip Huyen identifies three critical metrics: Time to First Token (TTFT) — time until the first output token appears; Time Per Output Token (TPOT) — incremental latency for each subsequent token; and Total Latency — end-to-end response time. All must be tracked per user to understand scaling behavior [S5].

## How It Works: A Concrete Walkthrough

Consider a search request in a modern web application:

1. **Client** sends HTTPS request. TLS handshake (1-2 RTTs if no session resumption).
2. **DNS** resolves the domain. Cached? 0 ms. Uncached? Recursive resolution adds 20-100 ms.
3. **CDN / Edge** terminates TLS, checks cache. Hit: ~5 ms. Miss: forwards to origin.
4. **Load balancer** picks a backend. Adds ~1 ms.
5. **API Gateway** authenticates, rate-limits, routes. Adds ~2-5 ms.
6. **Search Service** (parallel fan-out):
   - Calls **Embedding Service** (vectorize query) — 10-50 ms.
   - Calls **Index Shards** (scatter-gather) — each shard searches local segment; slowest shard determines latency. P99 often 3-5x median.
   - Calls **Ranking Service** (LLM re-rank) — here latency explodes. LinkedIn distills a 7B model to 400M parameters, compresses job contexts into single-token embeddings, and eliminates bottlenecks (custom flash attention masks, Python GIL workarounds, `gc.freeze`, non-blocking CUDA copies) to meet strict P99 SLAs [S10].
7. **Aggregation & Response** — merge results, serialize, compress, send back.

At each step, **queueing delay** is the wildcard. Under load, requests queue at thread pools, connection pools, and kernel socket buffers. The distribution shifts right and develops a heavy tail. Observability that only reports mean latency will miss this entirely.

## Key Techniques and Variants

### Reducing Propagation Delay
- **Edge computing / CDNs** — move compute closer to users. Cloudflare Workers, AWS Lambda@Edge, CloudFront Functions execute in PoPs worldwide.
- **Multi-region deployment** — run active-active or active-passive in multiple AWS regions / GCP zones. Adds consistency complexity (see Trade-offs).
- **Client-side prediction** — in gaming, render locally before server confirmation.

### Reducing Transmission Delay
- **Compression** — gzip, Brotli, Zstandard for HTTP; Protocol Buffers, Avro, FlatBuffers for RPC.
- **Protocol upgrades** — HTTP/2 multiplexing, HTTP/3 (QUIC) eliminates head-of-line blocking at transport layer.
- **Payload minimization** — GraphQL field selection, sparse fieldsets, delta sync.

### Reducing Processing Delay
- **Caching** — Redis, Memcached, in-process LRU. Cache-aside, read-through, write-through patterns.
- **Precomputation** — materialized views, denormalized tables, background workers.
- **Algorithmic improvements** — better indexes (HNSW for vector search), bloom filters, partitioning.
- **Hardware acceleration** — GPUs, TPUs, DPUs, SmartNICs for crypto, compression, packet processing.

### Reducing Queueing Delay
- **Load shedding / circuit breakers** — fail fast rather than queue indefinitely.
- **Backpressure** — propagate congestion signals upstream (TCP congestion control, reactive streams).
- **Capacity planning** — provision for peak *plus* headroom; auto-scaling has its own latency (cold starts).
- **Request hedging** — send duplicate requests to multiple replicas; use first response. Adds load but cuts tail latency.

### Latency-Oriented Architectural Patterns
- **Async / Event-driven** — fire-and-forget, event sourcing, CQRS. Trades latency for throughput and decoupling. User gets immediate ACK; actual work happens later.
- **Read replicas / Follower reads** — serve stale reads from local replica; accept bounded staleness for lower latency.
- **Speculative execution** — start work before confirmation (e.g., prefetch next page).
- **Model distillation & quantization** — for LLM inference, shrink model size (7B → 400M) and quantize weights (INT4, ternary) to reduce compute and memory bandwidth pressure [S10].

## Applications: Where Latency Is the Product

### Interactive Linux Desktop
Input latency — keypress to character on screen — determines perceived "snappiness." Modern measurement uses high-speed cameras or photodiodes to capture the full chain. Wayland + VRR + DXVK can reduce latency vs. X11 by eliminating frame copies and aligning with display refresh [S1].

### Distributed Queue Observability
Asynchronous systems (Kafka, RabbitMQ, SQS) hide latency in queue dwell time. OpenTelemetry traces with span attributes (queue name, consumer lag, processing duration) let engineers correlate producer latency with consumer backlog and identify "noisy neighbor" tenants [S2].

### Multi-Region Web Services
A global user base demands regional deployments. The framework: decompose latency budget → choose deployment pattern (active-active, active-passive, read-replica) by consistency needs → optimize routing (GeoDNS, Anycast, latency-based routing) → then expand infrastructure. One team cut latency 35% via routing alone before adding a region [S4].

### LLM-Powered Search & Ranking
LinkedIn serves LLM re-ranking under strict P99 SLAs. Techniques: model distillation (7B → 400M), context compression (job descriptions → single-token embeddings, 10x throughput), kernel-level optimizations (flash attention masks, non-blocking CUDA copies), runtime tricks (`gc.freeze`, GIL workarounds) [S10].

### Ternary LLM Inference on Multi-Socket CPUs
Ternary models (weights in {-1, 0, 1}) read only a few GB/token, yet on dual-socket, 4-NUMA-node servers, synchronization dominates. Threads spend 20-48% of each token waiting at barriers. Per-thread traces show most wait is for slowest threads per node; barrier latency itself reaches 12% of token time for small models. Megatron-style column split beats row-owned split by reducing cross-node reductions and wait time [S7].

## Trade-offs and Limitations

### Latency vs. Consistency
Strong consistency (linearizability) requires coordination — consensus (Raft, Paxos), distributed locks, synchronous replication. Each round-trip adds latency. Eventual consistency (async replication, CRDTs, last-writer-wins) removes coordination from the critical path but introduces staleness, conflicts, and semantic complexity. The CAP theorem is not a suggestion.

### Latency vs. Cost
Multi-region deployments multiply infrastructure spend (compute, storage, data transfer). Edge functions have higher per-invocation cost than centralized compute. Provisioning for P99 instead of average means 2-10x capacity. GPU inference for low-latency LLM serving is expensive; CPU inference with ternary quantization trades latency for cost [S7].

### Latency vs. Throughput
Batching increases throughput but adds queueing latency (wait for batch to fill). Small batches = low latency, low hardware utilization. Large batches = high throughput, high latency. The optimal batch size depends on the SLO.

### Latency vs. Correctness (Speculative Execution)
Hedged requests, speculative prefetch, and optimistic UI updates improve perceived latency but risk wasted work, cache pollution, and incorrect state if speculation fails. Idempotency keys and compensation logic become mandatory.

### When NOT to Optimize Latency
- **Batch / offline workloads** — ETL, model training, report generation. Throughput and cost matter; latency doesn't.
- **Internal admin tools** — used by few humans; "good enough" is fine.
- **Non-critical paths** — logging, analytics, telemetry. Fire-and-forget.
- **When physics wins** — intercontinental RTT is ~150 ms. No amount of engineering reduces it below ~70 ms one-way. Design for it (async, offline-first) instead of fighting it.

## Further Reading

- **Measuring Input Latency on Linux: X11 vs. Wayland, VRR, and DXVK** — Marco Nett's methodology for end-to-end input latency measurement with photodiodes and high-speed cameras [S1].
- **Uncorking Queueing Bottlenecks with OpenTelemetry** — Gearset's move from metrics to traces for queue observability and user-centric SLOs [S2].
- **Trade-Offs in Multi-Region Architectures: Latency vs. Cost** — Uttara Asthana's framework for latency budget decomposition, deployment pattern selection, and phased optimization [S4].
- **AI Engineering (Chip Huyen), Chapter 9** — LLM-specific latency metrics (TTFT, TPOT, total latency) and per-user tracking strategies [S5].
- **Scaling LLM-Based Ranking Systems for Latency-Critical Search** — LinkedIn's production techniques: distillation, context compression, kernel and runtime optimizations [S10].
- **Weight Placement Is Not Enough: Synchronization in Multi-Node CPU Decoding of Ternary LLMs** — NUMA-aware synchronization bottlenecks and barrier analysis in CPU LLM inference [S7].
- **Networking and the Internet, from First Principles** — Fazal Majid's mental models for propagation, transmission, and queueing delay [S6].

## References

- S1: Hacker News — Measuring Input Latency on Linux: X11 vs. Wayland, VRR, and DXVK — https://marco-nett.de/blog/measuring-input-latency-on-linux-x11-vs-wayland-vrr-dxvk/
- S2: InfoQ Architecture — Presentation: Uncorking Queueing Bottlenecks with OpenTelemetry — https://www.infoq.com/presentations/opentelemetry-queue-observability/
- S4: InfoQ Architecture — Article: Trade-Offs in Multi-Region Architectures: Latency vs. Cost — https://www.infoq.com/articles/multi-region-latency-cost-tradeoffs/
- S5: AI Engineering (Chip Huyen) — AI Engineering by Chip Huyen — part 434 — pack://ai-engineering-by-chip-huyen
- S6: Hacker News — Networking and the Internet, from First Principles — https://fazamhd.com/mental-models/networking/
- S7: arXiv — Weight Placement Is Not Enough: Synchronization in Multi-Node CPU Decoding of Ternary LLMs — https://arxiv.org/abs/2610.28620v1
- S10: InfoQ Architecture — Presentation: Scaling LLM-Based Ranking Systems for Latency-Critical Search & Recommendation Workloads — https://www.infoq.com/presentations/scale-llm-ranking-systems-linkedin/
