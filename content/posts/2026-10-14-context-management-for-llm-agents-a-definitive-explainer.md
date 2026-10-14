---
title: "Context Management for LLM Agents: A Definitive Explainer"
description: "How AI systems select, organize, and persist the information that fills a model's context window \u2014 and why it determines whether agents succeed or fail."
date: "2026-10-14"
format: "explainer"
concept: "context management"
tldr: ["Context management is the discipline of deciding what information enters an LLM's context window, in what order, and how it evolves across steps.", "It replaces ad-hoc prompt stuffing with systematic techniques: retrieval, summarization, compression, versioned artifacts, and cross-session handover.", "Empirical work shows that smart context management beats raw context length \u2014 300 well-chosen tokens can outperform 100k noisy ones.", "Production systems treat context like code: versioned, tested, cached, and governed by policies (MCP, Redis, knowledge substrates).", "The field is young; open questions include optimal handover formats, recovery guarantees, and cost-latency trade-offs under tight budgets."]
references: ["S1: InfoQ Architecture \u2014 Context Language Models: Self-Managing Context to Improve Performance and Reduce Compute Costs \u2014 https://www.infoq.com/news/2026/10/context-language-models/", "S2: LlamaIndex Blog \u2014 Context Engineering Guide: Techniques for AI Agents \u2014 https://www.llamaindex.ai/blog/context-engineering-what-it-is-and-techniques-to-consider", "S3: InfoQ Architecture \u2014 Presentation: Context Is the New Code \u2014 https://www.infoq.com/presentations/context-as-code-devops-agents/", "S4: arXiv \u2014 Workflow as Knowledge: Semantic Persistence for LLM-Mediated Workflows \u2014 https://arxiv.org/abs/2607.08740v1", "S5: InfoQ Architecture \u2014 Presentation: Beyond Prompting: Context Engineering for Production-Grade AI \u2014 https://www.infoq.com/presentations/context-engineering-redis-llm-architecture/", "S6: InfoQ Architecture \u2014 Presentation: Context Engineering at LinkedIn \u2014 https://www.infoq.com/presentations/linkedin-context-engineering/", "S7: arXiv \u2014 Handover of In-Context Learning State Across Session Boundaries \u2014 https://arxiv.org/abs/2608.14528v1", "S9: InfoQ Architecture \u2014 Presentation: The Right 300 Tokens Beat 100k Noisy Ones \u2014 https://www.infoq.com/presentations/architecture-context-engineering/", "S11: arXiv \u2014 ReContext: Recursive Evidence Replay as LLM Harness for Long-Context Reasoning \u2014 https://arxiv.org/abs/2607.02509v1", "S13: arXiv \u2014 An Empirical Study of Harness Design for Coding Agents \u2014 https://arxiv.org/abs/2609.20804v1"]
writer: "openrouter/nvidia/nemotron-3-ultra-550b-a55b:free"
fact_check: "passed"
diagram: "2026-10-14-context-management-for-llm-agents-a-definitive-explainer.json"
---

## What It Is

Context management is the set of engineering practices that determine **what information a large language model (LLM) sees at each inference step**, how that information is selected, transformed, and retained, and how it moves across session boundaries. The **context window** — the fixed token budget the model can attend to in a single forward pass — is the scarce resource. Context management is the allocation logic for that budget.

Think of the context window as a working memory. A human tackling a complex coding task doesn't reread the entire codebase, every prior chat message, and all documentation at once. They pull the relevant file, recall a prior decision, sketch a plan, then discard what's no longer needed. Context management builds that discipline into software: **retrieval** (fetch the right pieces), **compression** (summarize or elide the rest), **persistence** (save state across restarts), and **governance** (enforce policies on what enters and when).

The term **context engineering** has emerged to distinguish this systemic work from **prompt engineering** — the craft of writing the immediate instruction. As Karpathy framed it, prompt engineering is the art of the instruction; context engineering is the art of filling the window with *just the right information for the next step* [S2].

## Why It Matters

LLMs do not "know" your codebase, your user's history, or the current system state. They only know what sits in the context window at inference time. Stuffing the window with everything — full repository, chat history, documentation — fails for three reasons:

1. **Capacity limits.** Even 128K or 1M token windows fill quickly in multi-step agent loops.
2. **Needle-in-haystack degradation.** Models struggle to locate and use relevant evidence buried in noise [S11].
3. **Cost and latency.** Token throughput scales roughly linearly with context length; bloated contexts inflate both.

Conversely, disciplined context management enables **long-horizon agency**: an agent that can debug a feature across dozens of files, pause for human review, resume tomorrow, and hand off to another agent — all without losing the thread. LinkedIn reported a **20% productivity boost with zero reliability loss** by serving procedural memory, code search, and runbooks through a structured context layer built on the Model Context Protocol (MCP) [S6].

## How It Works: A Concrete Walkthrough

Imagine a coding agent tasked with "Add retry logic to the payment service." A single inference step might assemble context as follows:

1. **Task specification** — the user request, acceptance criteria, and relevant constraints (e.g., "idempotent, max 3 retries, exponential backoff").
2. **Retrieved artifacts** — a semantic search over the codebase returns the payment service file, the existing retry utility, and the circuit-breaker config. A **reranker** reorders them by relevance to the specific task [S5].
3. **Compressed history** — prior turns ("I tried adding retries but it broke idempotency") are summarized into a few sentences rather than replayed verbatim [S5].
4. **Skill definitions** — lazy-loaded **versioned context artifacts** describe how to run tests, lint, or invoke the deployment CLI. These are fetched on demand, not preloaded [S9].
5. **Policy guardrails** — a system prompt encodes organizational rules: "Never commit secrets," "Follow the error-handling pattern in `utils/errors.py`."

The assembled context — perhaps 3,000 tokens — feeds the model. The model proposes a diff. The harness executes tests. If tests fail, the error output and stack trace enter the next turn's context, while the oldest, least relevant history may be **elided** (dropped) or **summarized** by a smaller, cheaper model [S13]. This loop repeats until success or escalation.

**Key components** recurring across systems:
- **Retrieval layer** (vector search, keyword, graph traversal) — finds candidate artifacts.
- **Reranker / selector** — scores candidates for the current query.
- **Compressor** — summarization, elision, or **recursive evidence replay** (ReContext) that re-presents high-signal passages before generation [S11].
- **Persistence store** — Redis for short-term memory, knowledge graphs or object stores for long-term semantic persistence [S4, S5].
- **Handover protocol** — a structured record (decisions, constraints, sufficient statistics) passed when a session ends or an agent swaps [S7].
- **Governance** — CI/CD for context artifacts, security scanning, evals ("LLM-as-a-judge") [S3, S9].

## Key Techniques and Variants

### 1. Rule-Based Elision + LLM Summarization (Staging)
Drop low-signal content (verbose logs, boilerplate) via deterministic rules, then summarize the remainder with a small LLM. An empirical study of 176 matched settings across four models on SWE-Bench Verified and Terminal-Bench 2.1 found this **staging strategy provides the strongest overall efficiency** among five context-management strategies tested. Making elided content recoverable added machinery the models rarely used and yielded **no accuracy gain** [S13].

### 2. Recursive Evidence Replay (ReContext)
At inference time, use the model's own attention patterns as relevance signals to build a query-conditioned evidence pool, then replay that pool before final generation — preserving the full original context. Training-free; improves evidence utilization on 128K-context benchmarks across Qwen3-4B, Qwen3-8B, and Llama3-8B [S11].

### 3. Semantic Persistence / Knowledge Substrate
Represent workflow definitions, instances, inference records, and context snapshots as **persistent knowledge objects** with identity and dependency relations. Distinguish **derive** (deterministic computation over state) from **infer** (LLM judgment under declared context and policy). Enables inspectable, resumable, reviewable workflows [S4].

### 4. Model Context Protocol (MCP)
A standardized interface for serving context — procedural memory, code search, runbooks — to agents. Decouples context providers from consumers, enabling organizational context layers. LinkedIn's implementation powers their coding agents with search, runbooks, and procedural memory via MCP [S6].

### 5. Context-as-Code Practices
Version control context artifacts (prompts, few-shot examples, skill definitions). Run **LLM-as-a-judge evaluations** on them. Package and distribute via internal registries. Apply security scanning. Treat context changes like code changes: review, test, deploy [S3, S9].

### 6. Cross-Session Handover
When a session ends (window full, restart, agent swap), transfer a **task-relative in-context learning (ICL) state**. Theory distinguishes **exact recovery** (bit-for-bit) from **predictive equivalence** (preserving the target distribution). A three-part record stores decisions/constraints exactly, task-justified statistics for repeated evidence, and original observations not captured by statistics. Gaussian linear regression yields exact finite-dimensional handover; nonparametric bounds relate memory to squared prediction error [S7].

## Applications

- **Coding agents** — The most mature domain. Harnesses vary planning, action space, and context management; context management's value **increases as context-window budget tightens**, primarily by preventing overflow failures [S13].
- **Enterprise knowledge assistants** — Long-term memory via Redis + vector search; semantic caching to deduplicate repeated queries; reranking to mitigate "context rot" (stale or irrelevant retrieved chunks) [S5].
- **Multi-agent workflows** — Handover protocols let a researcher agent pass synthesized findings to a writer agent; a planner agent passes a structured plan to an executor [S7].
- **Computer-use agents** — Context includes GUI state transitions (screenshots, action traces). Benchmarks like Desktop-Delta Bench measure whether models can reconstruct causal transitions — critical for rejecting stale observations and recovering from failure [S14].
- **Organizational memory** — LinkedIn's context layer serves runbooks, code search, and procedural memory to all agents via MCP, turning tribal knowledge into queryable context [S6].

## Trade-offs and Limitations

| Dimension | Reality |
|---|---|
| **Complexity vs. gain** | Staging (elision + summarization) wins on efficiency; recoverable elision adds complexity without measurable accuracy improvement [S13]. |
| **Retrieval quality** | Reranking helps but adds latency. Semantic caching reduces cost but risks serving stale answers [S5]. |
| **Handover fidelity** | Exact recovery is expensive (bit-for-bit). Predictive equivalence is cheaper but theoretical guarantees hold only under exogeneity conditions [S7]. |
| **Evaluation gap** | Most harnesses evaluate end-to-end; component-level context-management ablations are rare. The 176-setting study is a notable exception [S13]. |
| **Cost under tight budgets** | Context management shines when tokens are scarce. With generous windows (128K+), naive stuffing sometimes "works" — but cost and latency still scale [S9, S13]. |
| **Human-in-the-loop** | Checkpointing for human approval requires serializable, reviewable context snapshots — not yet standard [S4]. |
| **Standardization** | MCP is gaining traction but not universal. Context artifact formats, versioning schemas, and eval harnesses remain fragmented [S3, S6, S9]. |

**When not to invest heavily:**
- Single-turn, low-stakes tasks (chat, classification) where a well-crafted prompt suffices.
- Prototypes where speed of iteration outweighs context efficiency.
- Domains with tiny, static context (e.g., fixed few-shot classification).

## Further Reading

- **Context Language Models (CLMs)** — Meta/MIT/UW research on models that self-manage context via learned editing operations [S1].
- **LlamaIndex Context Engineering Guide** — Practical taxonomy distinguishing context engineering from prompt engineering [S2].
- **Context Is the New Code (Debois)** — Treating context artifacts as versioned, tested, deployable software assets [S3].
- **Workflow as Knowledge (arXiv:2607.08740)** — Semantic persistence model with derive/infer distinction and knowledge substrate [S4].
- **Beyond Prompting: Context Engineering for Production-Grade AI (Ferreira)** — Redis, summarization, semantic caching, cost control [S5].
- **Context Engineering at LinkedIn (Prakash)** — MCP-based organizational context layer, 20% productivity boost [S6].
- **Handover of In-Context Learning State (arXiv:2608.14528)** — Theory and method for cross-session context transfer [S7].
- **ReContext (arXiv:2607.02509)** — Training-free recursive evidence replay for long-context reasoning [S11].
- **Empirical Study of Harness Design (arXiv:2609.20804)** — Component-level ablations of context management in coding agents [S13].
- **The Right 300 Tokens Beat 100k Noisy Ones (Sadogursky & Debois)** — Lazy-loaded skills, versioned artifacts, external memory banks, LLM-as-a-judge evals [S9].

## References

- S1: InfoQ Architecture — Context Language Models: Self-Managing Context to Improve Performance and Reduce Compute Costs — https://www.infoq.com/news/2026/10/context-language-models/
- S2: LlamaIndex Blog — Context Engineering Guide: Techniques for AI Agents — https://www.llamaindex.ai/blog/context-engineering-what-it-is-and-techniques-to-consider
- S3: InfoQ Architecture — Presentation: Context Is the New Code — https://www.infoq.com/presentations/context-as-code-devops-agents/
- S4: arXiv — Workflow as Knowledge: Semantic Persistence for LLM-Mediated Workflows — https://arxiv.org/abs/2607.08740v1
- S5: InfoQ Architecture — Presentation: Beyond Prompting: Context Engineering for Production-Grade AI — https://www.infoq.com/presentations/context-engineering-redis-llm-architecture/
- S6: InfoQ Architecture — Presentation: Context Engineering at LinkedIn — https://www.infoq.com/presentations/linkedin-context-engineering/
- S7: arXiv — Handover of In-Context Learning State Across Session Boundaries — https://arxiv.org/abs/2608.14528v1
- S9: InfoQ Architecture — Presentation: The Right 300 Tokens Beat 100k Noisy Ones — https://www.infoq.com/presentations/architecture-context-engineering/
- S11: arXiv — ReContext: Recursive Evidence Replay as LLM Harness for Long-Context Reasoning — https://arxiv.org/abs/2607.02509v1
- S13: arXiv — An Empirical Study of Harness Design for Coding Agents — https://arxiv.org/abs/2609.20804v1
